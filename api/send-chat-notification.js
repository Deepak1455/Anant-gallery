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

    // Parallel fetch for ultra-low latency
    const needsSenderLookup = !String(senderName || '').trim() || !String(senderPhotoUrl || '').trim();
    const [userDoc, senderDoc] = await Promise.all([
      userRef.get(),
      needsSenderLookup ? senderRef.get().catch(() => null) : Promise.resolve(null),
    ]);

    if (!userDoc.exists) return res.status(404).json({ error: 'Recipient user not found' });

    const recipientData = userDoc.data() || {};
    const fcmToken = recipientData.fcmToken || '';
    if (!fcmToken) return res.status(200).json({ skipped: true, reason: 'No fcmToken' });

    let resolvedName = String(senderName || '').trim();
    let rawSenderPhoto = String(senderPhotoUrl || '').trim();
    if (senderDoc && senderDoc.exists) {
      const sData = senderDoc.data() || {};
      if (!resolvedName) resolvedName = sData.name || sData.displayName || 'Anant User';
      if (!rawSenderPhoto) {
        rawSenderPhoto = sData.photoUrl || sData.avatarUrl || sData.profilePhoto || '';
      }
    }

    const finalSenderName = resolvedName || 'Anant Secure Chat';
    const validImageUrl = sanitizeImageUrl(rawSenderPhoto);

    let singleLineBody =
      messageType === 'photo'
        ? 'Sent a view-limit protected photo'
        : String(messagePreview || 'New secure message').slice(0, 180);

    if (type === 'chat_request') {
      singleLineBody = 'Sent you a Secure Chat request';
    } else if (type === 'request_accepted') {
      singleLineBody = 'Accepted your Secure Chat request';
    }

    const supportsRichPush = recipientData.richNotifications === true;
    const collapseKey = String(chatId || senderUid).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

    // Fallback stacking only needed if device hasn't registered rich Data-Only support
    let stackedTitle = finalSenderName;
    let stackedBody = singleLineBody;

    if (!supportsRichPush && type === 'secure_chat' && chatId) {
      try {
        // FIXED: Node.js Firebase Admin SDK uses .doc(), NOT .document()
        const recentSnap = await db
          .collection('secure_chats')
          .doc(chatId)
          .collection('messages')
          .orderBy('timestamp', 'desc')
          .limit(6)
          .get();

        const unseenLines = [];
        for (const doc of recentSnap.docs) {
          const m = doc.data() || {};
          const isSeen = m.seen === true || m.isSeen === true;
          if (m.senderId === senderUid && !isSeen) {
            const line =
              m.type === 'photo'
                ? 'Sent a view-limit protected photo'
                : String(m.text || m.message || '').trim().slice(0, 80);
            if (line) unseenLines.unshift(line);
          }
        }

        if (unseenLines.length > 1) {
          stackedTitle = `${finalSenderName} (${unseenLines.length} new messages)`;
          stackedBody = unseenLines.slice(-4).join('\n');
        }
      } catch (_) {
        // Safe fallback
      }
    }

    const baseData = {
      type: String(type),
      chatId: String(chatId),
      senderUid: String(senderUid),
      senderName: finalSenderName,
      senderEmail: String(senderEmail),
      senderPhotoUrl: validImageUrl,
      messageId: String(messageId),
      messageType: String(messageType),
      messagePreview: singleLineBody,
      timestamp: String(Date.now()),
    };

    const messagePayload = supportsRichPush
      ? {
          token: fcmToken,
          data: baseData,
          android: {
            priority: 'high',
            ttl: 86400 * 1000,
            collapseKey,
          },
        }
      : {
          token: fcmToken,
          notification: {
            title: stackedTitle,
            body: stackedBody,
          },
          data: baseData,
          android: {
            priority: 'high',
            ttl: 86400 * 1000,
            collapseKey,
            notification: {
              channelId: 'anant_secure_chat_v2',
              sound: 'default',
              defaultSound: true,
              defaultVibrateTimings: true,
              priority: 'max',
              visibility: 'private',
              clickAction: 'OPEN_SECURE_CHAT',
              tag: String(chatId || senderUid),
            },
          },
        };

    try {
      const fcmResponse = await admin.messaging().send(messagePayload);
      return res.status(200).json({
        success: true,
        mode: supportsRichPush ? 'instagram_rich_data' : 'stacked_single_card',
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
