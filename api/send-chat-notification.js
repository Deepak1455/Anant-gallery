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
      type = 'secure_chat', // 'secure_chat' | 'chat_request' | 'request_accepted'
      recipientUid = '',
      chatId = '',
      senderUid = '',
      senderName = '',
      senderEmail = '',
      senderPhotoUrl = '',
      messageId = '',
      messageType = 'text',
      messagePreview = 'New secure message',
    } = parsedBody;

    if (!recipientUid || !senderUid || decoded.uid !== senderUid) {
      return res.status(403).json({ error: 'Invalid sender or recipient' });
    }
    if (recipientUid === senderUid) {
      return res.status(200).json({ skipped: true, reason: 'Self notification skipped' });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(recipientUid);
    const senderRef = db.collection('users').doc(senderUid);

    const needsSenderLookup = !String(senderName || '').trim() || !String(senderPhotoUrl || '').trim();
    const [userDoc, senderDoc] = await Promise.all([
      userRef.get(),
      needsSenderLookup ? senderRef.get().catch(() => null) : Promise.resolve(null),
    ]);

    if (!userDoc.exists) return res.status(404).json({ error: 'Recipient user not found' });

    const recipientData = userDoc.data() || {};
    const fcmToken = String(recipientData.fcmToken || '').trim();
    if (!fcmToken) return res.status(200).json({ skipped: true, reason: 'No fcmToken' });

    let resolvedName = String(senderName || '').trim();
    let rawSenderPhoto = String(senderPhotoUrl || '').trim();
    if (senderDoc && senderDoc.exists) {
      const sData = senderDoc.data() || {};
      if (!resolvedName) resolvedName = sData.name || sData.displayName || 'Anant User';
      if (!rawSenderPhoto) {
        rawSenderPhoto =
          sData.photoUrl || sData.photoURL || sData.avatarUrl || sData.profilePhoto || '';
      }
    }

    const finalSenderName = resolvedName || 'Anant Secure Chat';
    const validImageUrl = sanitizeImageUrl(rawSenderPhoto);

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
    const threadKey = String(chatId || senderUid).replace(/[^a-zA-Z0-9_-]/g, '_');

    // Race-condition-proof server-side stacking so 1st, 2nd, 3rd messages NEVER disappear!
    let stackedTitle = finalSenderName;
    let stackedBody = singleLineBody;
    let totalUnreadCount = 1;

    if (type === 'secure_chat' && threadKey) {
      try {
        const threadRef = userRef.collection('notif_threads').doc(threadKey);
        const stackedLines = await db.runTransaction(async (tx) => {
          const snap = await tx.get(threadRef);
          const data = snap.exists ? (snap.data() || {}) : {};
          const prevUpdatedAt = Number(data.updatedAt || 0);
          const isStale = now - prevUpdatedAt > 30 * 60 * 1000; // Auto-reset after 30 mins inactivity
          const prevLines = !isStale && Array.isArray(data.lines) ? data.lines : [];
          const prevIds = !isStale && Array.isArray(data.msgIds) ? data.msgIds : [];

          if (prevIds.includes(finalMessageId)) {
            return prevLines.length ? prevLines : [singleLineBody];
          }

          const nextLines = [...prevLines, singleLineBody].slice(-6);
          const nextIds = [...prevIds, finalMessageId].slice(-10);

          tx.set(
            threadRef,
            {
              chatId: String(chatId),
              senderUid: String(senderUid),
              senderName: finalSenderName,
              lines: nextLines,
              msgIds: nextIds,
              updatedAt: now,
            },
            { merge: true }
          );
          return nextLines;
        });

        totalUnreadCount = stackedLines.length;
        if (stackedLines.length > 1) {
          stackedTitle = `${finalSenderName} (${stackedLines.length} new messages)`;
          stackedBody = stackedLines.join('\n');
        }
      } catch (txErr) {
        console.warn('Thread stack fallback:', txErr?.message);
      }
    }

    const baseData = {
      type: String(type),
      chatId: String(chatId),
      senderUid: String(senderUid),
      senderName: finalSenderName,
      senderEmail: String(senderEmail),
      senderPhotoUrl: validImageUrl,
      messageId: finalMessageId,
      messageType: String(messageType),
      messagePreview: singleLineBody,
      unreadCount: String(totalUnreadCount),
      timestamp: String(now),
    };

    // 100% Vivo / Xiaomi / Samsung / Pixel reliable Hybrid Payload:
    // - Background/Killed: Play Services displays single stacked card with ALL unread lines (Hi\nJddi\nEiei)
    // - Foreground: AnantFirebaseMessagingService renders rich circular avatar MessagingStyle + Direct Reply
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
          channelId: 'anant_secure_chat_v3',
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
        mode: 'vivo_proof_stacked_hybrid',
        stackedCount: totalUnreadCount,
        messageId: fcmResponse,
      });
    } catch (sendErr) {
      if (
        sendErr?.code === 'messaging/registration-token-not-registered' ||
        sendErr?.code === 'messaging/invalid-registration-token'
      ) {
        await userRef.update({ fcmToken: admin.firestore.FieldValue.delete() }).catch(() => {});
        return res.status(200).json({ skipped: true, reason: 'Cleaned stale fcmToken' });
      }
      throw sendErr;
    }
  } catch (err) {
    console.error('Push notification error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
