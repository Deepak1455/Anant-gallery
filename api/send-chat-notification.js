import crypto from 'crypto';
import admin from 'firebase-admin';

let parsedServiceAccount = {};

if (!admin.apps.length) {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT || '{}').trim();
  parsedServiceAccount = JSON.parse(rawJson);
  if (parsedServiceAccount.private_key) {
    parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
  }
  admin.initializeApp({
    credential: admin.credential.cert(parsedServiceAccount),
  });
} else {
  try {
    parsedServiceAccount = JSON.parse((process.env.FIREBASE_SERVICE_ACCOUNT || '{}').trim());
  } catch (_) {}
}

// 100% Zero-Firestore In-Memory Caches (Unlimited Free!)
const threadCache = globalThis.__anantThreadCache || (globalThis.__anantThreadCache = new Map());
const userPrefsCache = globalThis.__anantUserPrefsCache || (globalThis.__anantUserPrefsCache = new Map());

function getSecretUserTopic(uid) {
  const secret =
    process.env.PUSH_TOPIC_SECRET ||
    parsedServiceAccount.private_key_id ||
    parsedServiceAccount.project_id ||
    'anant_gallery_hmac_v1';
  const digest = crypto
    .createHmac('sha256', String(secret))
    .update(String(uid).trim())
    .digest('hex')
    .slice(0, 32);
  return `ag_u_${digest}`;
}

function sanitizeImageUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (clean.startsWith('/api/')) return `https://anant-gallery.vercel.app${clean}`;
  if (clean.startsWith('https://')) return clean;
  return '';
}

function isCurrentlyQuietHours(prefs) {
  if (!prefs || prefs.quietHoursEnabled !== true) return false;
  const offsetMin = Number.isFinite(prefs.timezoneOffsetMin) ? prefs.timezoneOffsetMin : 330; // Default IST (+5:30)
  const localMs = Date.now() + offsetMin * 60 * 1000;
  const hour = new Date(localMs).getUTCHours();
  const start = Number.isFinite(prefs.quietStartHour) ? prefs.quietStartHour : 23;
  const end = Number.isFinite(prefs.quietEndHour) ? prefs.quietEndHour : 7;
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

async function sendWithTopicFallback(basePayload, directToken, recipientTopic, forceTopic) {
  const useTopic = !directToken || forceTopic === true;
  if (useTopic) {
    const messageId = await admin.messaging().send({
      ...basePayload,
      topic: recipientTopic,
    });
    return { messageId, mode: 'unlimited_secret_topic' };
  }

  try {
    const messageId = await admin.messaging().send({
      ...basePayload,
      token: directToken,
    });
    return { messageId, mode: 'unlimited_direct_token' };
  } catch (_) {
    const messageId = await admin.messaging().send({
      ...basePayload,
      topic: recipientTopic,
    });
    return { messageId, mode: 'fallback_secret_topic' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Firebase ID token' });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decoded = await admin.auth().verifyIdToken(idToken);

    const parsedBody =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const {
      type = 'secure_chat', // 'register_device' | 'unregister_device' | 'update_prefs' | 'clear_thread' | 'test_push' | 'secure_chat' | 'chat_request' | 'request_accepted' | 'screenshot_alert' | 'reaction'
      fcmToken = '',
      recipientUid = '',
      recipientFcmToken = '',
      targetChannelId = 'anant_secure_chat_v3',
      chatId = '',
      senderUid = '',
      senderName = '',
      senderEmail = '',
      senderPhotoUrl = '',
      messageId = '',
      messageType = 'text',
      messagePreview = 'New secure message',
      viewLimit = 0,
      stackedLines: clientStackedLines = null,
      testViaTopic = false,
      privacyMode,
      quietHoursEnabled,
      quietStartHour,
      quietEndHour,
      timezoneOffsetMin,
      mutedChatIds,
    } = parsedBody;

    // Helper to merge user preferences in memory (0 Firestore writes)
    const savePrefsIfProvided = (uid) => {
      const prev = userPrefsCache.get(uid) || {};
      const next = {
        privacyMode: typeof privacyMode === 'boolean' ? privacyMode : Boolean(prev.privacyMode),
        quietHoursEnabled:
          typeof quietHoursEnabled === 'boolean'
            ? quietHoursEnabled
            : Boolean(prev.quietHoursEnabled),
        quietStartHour: Number.isFinite(Number(quietStartHour))
          ? Number(quietStartHour)
          : (prev.quietStartHour ?? 23),
        quietEndHour: Number.isFinite(Number(quietEndHour))
          ? Number(quietEndHour)
          : (prev.quietEndHour ?? 7),
        timezoneOffsetMin: Number.isFinite(Number(timezoneOffsetMin))
          ? Number(timezoneOffsetMin)
          : (prev.timezoneOffsetMin ?? 330),
        mutedChatIds: Array.isArray(mutedChatIds)
          ? mutedChatIds.map((id) => String(id).trim()).filter(Boolean)
          : (prev.mutedChatIds || []),
      };
      userPrefsCache.set(uid, next);
      return next;
    };

    // 1) REGISTER DEVICE TO UNLIMITED PRIVATE FCM TOPIC
    if (type === 'register_device') {
      const cleanToken = String(fcmToken || recipientFcmToken || '').trim();
      if (!cleanToken) {
        return res.status(400).json({ error: 'Missing fcmToken' });
      }
      const savedPrefs = savePrefsIfProvided(decoded.uid);
      const userTopic = getSecretUserTopic(decoded.uid);
      const subRes = await admin.messaging().subscribeToTopic([cleanToken], userTopic);
      return res.status(200).json({
        success: subRes.successCount >= 1 && subRes.failureCount === 0,
        mode: 'topic_registered',
        topic: userTopic,
        prefs: savedPrefs,
        successCount: subRes.successCount,
        failureCount: subRes.failureCount,
      });
    }

    // 2) UPDATE PRIVACY MODE / QUIET HOURS / MUTED CHATS (0 Firestore calls)
    if (type === 'update_prefs') {
      const savedPrefs = savePrefsIfProvided(decoded.uid);
      return res.status(200).json({
        success: true,
        mode: 'prefs_updated',
        prefs: savedPrefs,
      });
    }

    // 3) UNREGISTER DEVICE ON LOGOUT
    if (type === 'unregister_device') {
      const cleanToken = String(fcmToken || recipientFcmToken || '').trim();
      if (!cleanToken) {
        return res.status(400).json({ error: 'Missing fcmToken' });
      }
      const userTopic = getSecretUserTopic(decoded.uid);
      const unsubRes = await admin.messaging().unsubscribeFromTopic([cleanToken], userTopic);
      return res.status(200).json({
        success: unsubRes.failureCount === 0,
        mode: 'topic_unregistered',
        topic: userTopic,
        successCount: unsubRes.successCount,
      });
    }

    // 4) CLEAR UNREAD THREAD COUNT INSTANTLY WHEN CHAT IS OPENED
    if (type === 'clear_thread') {
      const clearKey = String(chatId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (clearKey) {
        threadCache.delete(`${decoded.uid}::${clearKey}`);
      }
      return res.status(200).json({ success: true, mode: 'thread_cleared', chatId: clearKey });
    }

    const effectiveSenderUid = String(senderUid || decoded.uid).trim();
    const effectiveRecipientUid =
      type === 'test_push' ? decoded.uid : String(recipientUid || '').trim();

    if (!effectiveRecipientUid || decoded.uid !== effectiveSenderUid) {
      return res.status(403).json({ error: 'Invalid sender or recipient' });
    }
    if (type !== 'test_push' && effectiveRecipientUid === effectiveSenderUid) {
      return res.status(200).json({ skipped: true, reason: 'Self message skipped' });
    }

    const recipientPrefs = userPrefsCache.get(effectiveRecipientUid) || {};
    const directToken = String(recipientFcmToken || fcmToken || '').trim();
    const recipientTopic = getSecretUserTopic(effectiveRecipientUid);
    const validImageUrl = sanitizeImageUrl(senderPhotoUrl);

    // 5) INSTANT LIVE TEST PUSH
    if (type === 'test_push') {
      const testBase = {
        notification: {
          title: 'Anant Gallery Secure Chat',
          body: 'Advance push alerts are active and working smoothly.',
        },
        data: {
          type: 'test_push',
          senderUid: effectiveSenderUid,
          senderName: String(senderName || '').trim() || 'Anant Gallery',
          senderPhotoUrl: validImageUrl,
          messagePreview: 'Advance push alerts are active and working smoothly.',
          timestamp: String(Date.now()),
        },
        android: {
          priority: 'high',
          ttl: 300 * 1000,
          notification: {
            channelId: String(targetChannelId || 'anant_secure_chat_v3').trim(),
            defaultSound: true,
            defaultVibrateTimings: true,
            priority: 'max',
            visibility: 'public',
          },
        },
      };

      const result = await sendWithTopicFallback(
        testBase,
        directToken,
        recipientTopic,
        testViaTopic === true
      );

      return res.status(200).json({
        success: true,
        mode: `test_${result.mode}`,
        messageId: result.messageId,
      });
    }

    // 6) ADVANCE SMART SECURE CHAT / SECURITY / REACTION PUSH
    const finalSenderName = String(senderName || '').trim() || 'Anant Secure Chat';

    let singleLineBody =
      messageType === 'photo'
        ? Number(viewLimit) > 0
          ? `Sent a protected photo (${Number(viewLimit)} view limit)`
          : 'Sent a view-limit protected photo'
        : String(messagePreview || 'New secure message').trim().slice(0, 180);

    if (type === 'chat_request') {
      singleLineBody = 'Sent you a Secure Chat request';
    } else if (type === 'request_accepted') {
      singleLineBody = 'Accepted your Secure Chat request';
    } else if (type === 'screenshot_alert') {
      singleLineBody = 'Security Alert: Captured a screenshot in Secure Chat';
    } else if (type === 'reaction') {
      singleLineBody = String(messagePreview || 'Reacted to your message').trim().slice(0, 140);
    }

    const now = Date.now();
    const finalMessageId = String(messageId || `${now}_${Math.random().toString(36).slice(2, 7)}`);
    const threadKey = String(chatId || effectiveSenderUid).replace(/[^a-zA-Z0-9_-]/g, '_');

    let stackedLines = [singleLineBody];
    if (Array.isArray(clientStackedLines) && clientStackedLines.length > 0) {
      stackedLines = clientStackedLines
        .map((s) => String(s || '').trim().slice(0, 120))
        .filter(Boolean)
        .slice(-6);
    } else if ((type === 'secure_chat' || type === 'reaction') && threadKey) {
      const cacheKey = `${effectiveRecipientUid}::${threadKey}`;
      const prev = threadCache.get(cacheKey);
      const isFresh = prev && now - prev.updatedAt < 20 * 60 * 1000;
      const prevLines = isFresh ? prev.lines : [];
      const prevIds = isFresh ? prev.ids : [];

      if (!prevIds.includes(finalMessageId)) {
        stackedLines = [...prevLines, singleLineBody].slice(-6);
        threadCache.set(cacheKey, {
          lines: stackedLines,
          ids: [...prevIds, finalMessageId].slice(-10),
          updatedAt: now,
        });
      } else if (prevLines.length > 0) {
        stackedLines = prevLines;
      }
    }

    // Privacy Lock Mode: Hide actual message text on lockscreen if enabled by recipient
    const isPrivacyMode = recipientPrefs.privacyMode === true;
    const isChatMuted =
      Array.isArray(recipientPrefs.mutedChatIds) &&
      recipientPrefs.mutedChatIds.includes(String(chatId));
    const isQuietNow =
      type !== 'screenshot_alert' && (isChatMuted || isCurrentlyQuietHours(recipientPrefs));

    const finalChannelId = isQuietNow
      ? 'anant_secure_chat_quiet_v3'
      : String(targetChannelId || 'anant_secure_chat_v3').trim();

    const displayTitle = isPrivacyMode
      ? 'Anant Secure Chat'
      : stackedLines.length > 1
        ? `${finalSenderName} (${stackedLines.length} new messages)`
        : finalSenderName;

    const displayBody = isPrivacyMode
      ? stackedLines.length > 1
        ? `${stackedLines.length} new encrypted messages`
        : 'New encrypted message'
      : stackedLines.join('\n');

    const baseData = {
      type: String(type),
      chatId: String(chatId),
      senderUid: effectiveSenderUid,
      senderName: finalSenderName,
      senderEmail: String(senderEmail),
      senderPhotoUrl: validImageUrl,
      messageId: finalMessageId,
      messageType: String(messageType),
      messagePreview: singleLineBody,
      stackedLinesJson: JSON.stringify(stackedLines),
      unreadCount: String(stackedLines.length),
      privacyMode: String(isPrivacyMode),
      isQuiet: String(isQuietNow),
      timestamp: String(now),
    };

    // Clean 100% Vivo-proof stacked card (NO giant photo cutting off stacked text!)
    const basePayload = {
      notification: {
        title: displayTitle,
        body: displayBody,
      },
      data: baseData,
      android: {
        priority: isQuietNow ? 'normal' : 'high',
        ttl: 86400 * 1000,
        notification: {
          channelId: finalChannelId,
          defaultSound: !isQuietNow,
          defaultVibrateTimings: !isQuietNow,
          priority: isQuietNow ? 'low' : 'max',
          visibility: 'private',
          tag: threadKey,
        },
      },
    };

    const result = await sendWithTopicFallback(basePayload, directToken, recipientTopic, false);

    return res.status(200).json({
      success: true,
      mode: result.mode,
      channelId: finalChannelId,
      privacyMode: isPrivacyMode,
      isQuiet: isQuietNow,
      stackedCount: stackedLines.length,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('Push notification error:', err);
    return res.status(500).json({
      error: err?.message || 'Internal error',
      code: err?.code || 'unknown',
    });
  }
}
