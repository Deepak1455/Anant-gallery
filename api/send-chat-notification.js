import admin from 'firebase-admin';

if (!admin.apps.length) {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT || '{}').trim();
  const serviceAccount = JSON.parse(rawJson);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Warm in-memory caches (0 Firestore Reads/Writes on repeat messages!)
const tokenCache = globalThis.__anantTokenCache || (globalThis.__anantTokenCache = new Map());
const threadCache = globalThis.__anantThreadCache || (globalThis.__anantThreadCache = new Map());

function sanitizeImageUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (clean.startsWith('/api/')) return `https://anant-gallery.vercel.app${clean}`;
  if (clean.startsWith('https://')) return clean;
  return '';
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
      type = 'secure_chat', // 'secure_chat' | 'chat_request' | 'request_accepted' | 'test_push'
      recipientUid = '',
      recipientFcmToken = '',
      targetChannelId: clientChannelId = '',
      chatId = '',
      senderUid = '',
      senderName = '',
      senderEmail = '',
      senderPhotoUrl = '',
      messageId = '',
      messageType = 'text',
      messagePreview = 'New secure message',
      stackedLines: clientStackedLines = null,
    } = parsedBody;

    const effectiveSenderUid = senderUid || decoded.uid;
    const effectiveRecipientUid = type === 'test_push' ? decoded.uid : recipientUid;

    if (!effectiveRecipientUid || decoded.uid !== effectiveSenderUid) {
      return res.status(403).json({ error: 'Invalid sender or recipient' });
    }
    if (type !== 'test_push' && effectiveRecipientUid === effectiveSenderUid) {
      return res.status(200).json({ skipped: true, reason: 'Self notification skipped' });
    }

    // 1) Resolve FCM Token with ZERO Firestore reads if provided by app or cached
    let fcmToken = String(recipientFcmToken || '').trim();
    let targetChannelId = String(clientChannelId || '').trim();
    let usedFirestore = false;

    const cached = tokenCache.get(effectiveRecipientUid);
    if (!fcmToken && cached && Date.now() - cached.savedAt < 10 * 60 * 1000) {
      fcmToken = cached.fcmToken;
      if (!targetChannelId) targetChannelId = cached.channelId;
    }

    if (fcmToken) {
      tokenCache.set(effectiveRecipientUid, {
        fcmToken,
        channelId: targetChannelId || 'anant_secure_chat_v3',
        savedAt: Date.now(),
      });
    } else {
      // Fallback: Read Firestore ONLY if client did not send recipientFcmToken
      try {
        usedFirestore = true;
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(effectiveRecipientUid).get();
        if (!userDoc.exists) {
          return res.status(404).json({ error: 'Recipient user not found' });
        }
        const rData = userDoc.data() || {};
        fcmToken = String(rData.fcmToken || '').trim();
        if (!targetChannelId) {
          targetChannelId = String(rData.notifChannelId || 'anant_secure_chat_v3').trim();
        }
        if (fcmToken) {
          tokenCache.set(effectiveRecipientUid, {
            fcmToken,
            channelId: targetChannelId,
            savedAt: Date.now(),
          });
        }
      } catch (fsErr) {
        const isQuota = fsErr?.code === 8 || String(fsErr?.message || '').includes('RESOURCE_EXHAUSTED');
        return res.status(isQuota ? 503 : 500).json({
          success: false,
          error: isQuota
            ? 'Firestore daily quota exceeded. Pass recipientFcmToken from Android to bypass Firestore.'
            : (fsErr?.message || 'Firestore lookup failed'),
        });
      }
    }

    if (!fcmToken) {
      return res.status(200).json({
        success: false,
        skipped: true,
        reason: 'Recipient has no fcmToken synced yet',
      });
    }

    const finalChannelId = targetChannelId || 'anant_secure_chat_v3';

    // 2) Instant Live Test Push (Works with 0 Firestore calls!)
    if (type === 'test_push') {
      const testResp = await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: 'Anant Gallery Secure Chat',
          body: 'Push notifications are active and working smoothly on this device.',
        },
        data: {
          type: 'test_push',
          senderName: 'Anant Gallery',
          messagePreview: 'Push notifications are active and working smoothly on this device.',
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
      });

      return res.status(200).json({
        success: true,
        mode: 'test_push_zero_firestore',
        channelId: finalChannelId,
        messageId: testResp,
      });
    }

    const finalSenderName = String(senderName || '').trim() || 'Anant Secure Chat';
    const validImageUrl = sanitizeImageUrl(senderPhotoUrl);

    let singleLineBody =
      messageType === 'photo'
        ? 'Sent a view-limit protected photo'
        : String(messagePreview || 'New secure message').trim().slice(0, 140);

    if (type === 'chat_request') {
      singleLineBody = 'Sent you a Secure Chat request';
    } else if (type === 'request_accepted') {
      singleLineBody = 'Accepted your Secure Chat request';
    }

    const now = Date.now();
    const finalMessageId = String(messageId || `${now}_${Math.random().toString(36).slice(2, 7)}`);
    const threadKey = String(chatId || effectiveSenderUid).replace(/[^a-zA-Z0-9_-]/g, '_');

    // 3) Zero-Firestore In-Memory Multi-Message Stacking (Hi\nJddi\nEiei)
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
      senderUid: String(effectiveSenderUid),
      senderName: finalSenderName,
      senderEmail: String(senderEmail),
      senderPhotoUrl: validImageUrl,
      messageId: finalMessageId,
      messageType: String(messageType),
      messagePreview: singleLineBody,
      unreadCount: String(stackedLines.length),
      timestamp: String(now),
    };

    const messagePayload = {
      token: fcmToken,
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
          clickAction: 'OPEN_SECURE_CHAT',
          tag: threadKey,
        },
      },
    };

    try {
      const fcmResponse = await admin.messaging().send(messagePayload);
      return res.status(200).json({
        success: true,
        mode: usedFirestore ? 'hybrid_firestore_fallback' : 'zero_firestore_ultra_fast',
        channelId: finalChannelId,
        stackedCount: stackedLines.length,
        messageId: fcmResponse,
      });
    } catch (sendErr) {
      if (
        sendErr?.code === 'messaging/registration-token-not-registered' ||
        sendErr?.code === 'messaging/invalid-registration-token'
      ) {
        tokenCache.delete(effectiveRecipientUid);
        return res.status(200).json({ skipped: true, reason: 'Stale fcmToken skipped' });
      }
      throw sendErr;
    }
  } catch (err) {
    console.error('Push notification error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
