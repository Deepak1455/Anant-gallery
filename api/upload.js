// ==========================================================================
// VERCEL SECURE SERVERLESS API - TELEGRAM UPLOAD PROXY (TOKEN HIDDEN)
// ==========================================================================

export const config = {
    api: {
        bodyParser: false, // Allows streaming raw binary file upload
    },
};

export default async function handler(req, res) {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'Server configuration error: Missing Secrets' });
    }

    try {
        // Collect raw image chunks from request stream
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const fileBuffer = Buffer.concat(chunks);

        if (fileBuffer.length === 0) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        // Build FormData for Telegram Bot API
        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('photo', new Blob([fileBuffer], { type: 'image/jpeg' }), 'photo.jpg');

        // 1. Send Photo to Telegram
        const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData,
        });

        const telegramData = await telegramRes.json();
        if (!telegramData.ok) {
            return res.status(500).json({ error: telegramData.description || 'Telegram API Error' });
        }

        // 2. Get highest resolution file_id
        const photos = telegramData.result.photo;
        const highestResPhoto = photos[photos.length - 1];
        const fileId = highestResPhoto.file_id;

        // 3. Get File Path
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();

        if (!fileData.ok || !fileData.result.file_path) {
            return res.status(500).json({ error: 'Could not fetch file path' });
        }

        const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;

        // Return clean URL & fileId to frontend (Bot Token never exposed)
        return res.status(200).json({
            ok: true,
            imageUrl: imageUrl,
            fileId: fileId,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
