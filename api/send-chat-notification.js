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
        : String(messagePreview || 'New secure message').slice(0, 180);

    if (type === 'chat_request') {
      singleLineBody = 'Sent you a Secure Chat request';
    } else if (type === 'request_accepted') {
      singleLineBody = 'Accepted your Secure Chat request';
    }

    // Default to Instagram Data-Only Rich Push unless explicitly disabled
    const supportsRichPush = recipientData.richNotifications !== false;

    const baseData = {
      type: String(type),
      chatId: String(chatId),
      senderUid: String(senderUid),
      senderName: finalSenderName,
      senderEmail: String(senderEmail),
      senderPhotoUrl: validImageUrl,
      messageId: String(messageId || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      messageType: String(messageType),
      messagePreview: singleLineBody,
      timestamp: String(Date.now()),
    };

    // IMPORTANT: Never use collapseKey for chat messages so rapid bursts are NEVER dropped
    const messagePayload = supportsRichPush
      ? {
          token: fcmToken,
          data: baseData,
          android: {
            priority: 'high',
            ttl: 86400 * 1000,
          },
        }
      : {
          token: fcmToken,
          notification: {
            title: finalSenderName,
            body: singleLineBody,
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
              tag: String(chatId || senderUid),
            },
          },
        };

    try {
      const fcmResponse = await admin.messaging().send(messagePayload);
      return res.status(200).json({
        success: true,
        mode: supportsRichPush ? 'instagram_rich_data' : 'fallback_single_card',
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
