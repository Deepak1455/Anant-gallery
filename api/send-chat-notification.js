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

const threadCache = globalThis.__anantThreadCache || (globalThis.__anantThreadCache = new Map());

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
    // Stale/invalid direct token -> automatically fallback to Secret Topic (NO 500 crash!)
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
      type = 'secure_chat',
      deliveryMode = 'hybrid',
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
      stackedLines: clientStackedLines = null,
      testViaTopic = false,
    } = parsedBody;

    // 1) REGISTER DEVICE TO PRIVATE UNLIMITED FCM TOPIC
    if (type === 'register_device') {
      const cleanToken = String(fcmToken || recipientFcmToken || '').trim();
      if (!cleanToken) {
        return res.status(400).json({ error: 'Missing fcmToken' });
      }
      const userTopic = getSecretUserTopic(decoded.uid);
      const subRes = await admin.messaging().subscribeToTopic([cleanToken], userTopic);
      return res.status(200).json({
        success: subRes.successCount >= 1 && subRes.failureCount === 0,
        mode: 'topic_registered',
        topic: userTopic,
        successCount: subRes.successCount,
        failureCount: subRes.failureCount,
        errors: (subRes.errors || []).map((e) => e.error?.message || 'unknown'),
      });
    }

    // 2) UNREGISTER DEVICE ON LOGOUT
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

    const effectiveSenderUid = String(senderUid || decoded.uid).trim();
    const effectiveRecipientUid =
      type === 'test_push' ? decoded.uid : String(recipientUid || '').trim();

    if (!effectiveRecipientUid || decoded.uid !== effectiveSenderUid) {
      return res.status(403).json({ error: 'Invalid sender or recipient' });
    }
    if (type !== 'test_push' && effectiveRecipientUid === effectiveSenderUid) {
      return res.status(200).json({ skipped: true, reason: 'Self message skipped' });
    }

    const finalChannelId = String(targetChannelId || 'anant_secure_chat_v3').trim();
    const directToken = String(recipientFcmToken || fcmToken || '').trim();
    const recipientTopic = getSecretUserTopic(effectiveRecipientUid);

    // 3) INSTANT LIVE TEST PUSH
    if (type === 'test_push') {
      const testBase = {
        notification: {
          title: 'Anant Gallery Secure Chat',
          body: 'Unlimited push notifications are active on this device.',
        },
        data: {
          type: 'test_push',
          senderName: 'Anant Gallery',
          messagePreview: 'Unlimited push notifications are active on this device.',
          timestamp: String(Date.now()),
        },
        android: {
          priority: 'high',
          ttl: 300 * 1000,
          notification: {
            channelId: finalChannelId,
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
        channelId: finalChannelId,
        messageId: result.messageId,
      });
    }

    // 4) UNLIMITED SECURE CHAT / REQUEST PUSH
    const finalSenderName = String(senderName || '').trim() || 'Anant Secure Chat';
    const validImageUrl = sanitizeImageUrl(senderPhotoUrl);

    let singleLineBody =
      messageType === 'photo'
        ? 'Sent a view-limit protected photo'
        : String(messagePreview || 'New secure message').trim().slice(0, 180);

    if (type === 'chat_request') {
      singleLineBody = 'Sent you a Secure Chat request';
    } else if (type === 'request_accepted') {
      singleLineBody = 'Accepted your Secure Chat request';
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
    } else if (type === 'secure_chat' && threadKey) {
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

    const stackedTitle =
      stackedLines.length > 1
        ? `${finalSenderName} (${stackedLines.length} new messages)`
        : finalSenderName;
    const stackedBody = stackedLines.join('\n');

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
      unreadCount: String(stackedLines.length),
      timestamp: String(now),
    };

    const isDataOnly = deliveryMode === 'data_only';

    const basePayload = isDataOnly
      ? {
          data: baseData,
          android: {
            priority: 'high',
            ttl: 86400 * 1000,
          },
        }
      : {
          notification: {
            title: stackedTitle,
            body: stackedBody,
          },
          data: baseData,
          android: {
            priority: 'high',
            ttl: 86400 * 1000,
            notification: {
              channelId: finalChannelId,
              defaultSound: true,
              defaultVibrateTimings: true,
              priority: 'max',
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
