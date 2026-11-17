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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      recipientUid = '',
      chatId = '',
      senderUid = '',
      senderName = 'Anant Secure Chat',
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
      return res.status(200).json({ skipped: true, reason: 'Self message' });
    }

    const userDoc = await admin.firestore().collection('users').doc(recipientUid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    const fcmToken = userDoc.data()?.fcmToken || '';
    if (!fcmToken) {
      return res.status(200).json({ skipped: true, reason: 'No fcmToken' });
    }

    const safeBody =
      messageType === 'photo'
        ? 'Sent a view-limit protected photo'
        : String(messagePreview || 'New secure message').slice(0, 180);

    const fcmResponse = await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: String(senderName || 'Anant Secure Chat'),
        body: safeBody,
      },
      data: {
        type: 'secure_chat',
        chatId: String(chatId),
        senderUid: String(senderUid),
        senderName: String(senderName),
        senderEmail: String(senderEmail),
        senderPhotoUrl: String(senderPhotoUrl),
        messageId: String(messageId),
        messageType: String(messageType),
        messagePreview: safeBody,
      },
      android: {
        priority: 'high',
        collapseKey: String(chatId || senderUid),
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
    });

    return res.status(200).json({ success: true, messageId: fcmResponse });
  } catch (err) {
    console.error('Push notification error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
