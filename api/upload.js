// ==========================================================================
// VERCEL SECURE SERVERLESS API - UPLOAD & CORS IMAGE PROXY
// ==========================================================================

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // 🌟 1. GET REQUEST: IMAGE PROXY FOR 100% WORKING DIRECT SHARE
    if (req.method === 'GET') {
        const url = new URL(req.url, `https://${req.headers.host}`).searchParams.get('url');
        if (!url) return res.status(400).json({ error: 'Missing image URL' });

        try {
            const imageRes = await fetch(url);
            if (!imageRes.ok) throw new Error('Failed to fetch from Telegram');
            const arrayBuffer = await imageRes.arrayBuffer();

            res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.status(200).send(Buffer.from(arrayBuffer));
        } catch (e) {
            return res.status(500).json({ error: 'Proxy fetch failed' });
        }
    }

    // 🌟 2. POST REQUEST: SECURE UPLOAD
    if (req.method === 'POST') {
        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Missing Server Secrets' });
        }

        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return res.status(400).json({ error: 'No image provided' });
            }

            const formData = new FormData();
            formData.append('chat_id', CHAT_ID);
            formData.append('photo', new Blob([fileBuffer], { type: 'image/jpeg' }), 'photo.jpg');

            const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: formData,
            });

            const telegramData = await telegramRes.json();
            if (!telegramData.ok) {
                return res.status(500).json({ error: telegramData.description || 'Telegram API Error' });
            }

            const photos = telegramData.result.photo;
            const highestResPhoto = photos[photos.length - 1];
            const fileId = highestResPhoto.file_id;

            const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
            const fileData = await fileRes.json();

            if (!fileData.ok || !fileData.result.file_path) {
                return res.status(500).json({ error: 'Could not fetch file path' });
            }

            const imageUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;

            return res.status(200).json({
                ok: true,
                imageUrl: imageUrl,
                fileId: fileId,
            });
        } catch (err) {
            return res.status(500).json({ error: err.message || 'Internal Server Error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
