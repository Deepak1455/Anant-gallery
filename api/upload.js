// ==========================================================================
// VERCEL SECURE SERVERLESS API - TELEGRAM UPLOAD & CORS-FREE IMAGE PROXY
// ==========================================================================

export const config = {
    api: {
        bodyParser: false, // Binary stream upload support
    },
};

export default async function handler(req, res) {
    // Enable CORS for all clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 🌟 1. GET PROXY: FOR 100% WORKING SHARE & DOWNLOAD (NO CORS ERRORS)
    if (req.method === 'GET') {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'Missing image url parameter' });
        }

        try {
            const imageRes = await fetch(decodeURIComponent(url));
            if (!imageRes.ok) {
                return res.status(imageRes.status).json({ error: 'Failed to fetch remote image' });
            }

            const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
            const arrayBuffer = await imageRes.arrayBuffer();

            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
            return res.status(200).send(Buffer.from(arrayBuffer));
        } catch (err) {
            return res.status(500).json({ error: 'Proxy Error: ' + err.message });
        }
    }

    // 🌟 2. POST UPLOAD: FOR SECURE TELEGRAM BOT UPLOADS
    if (req.method === 'POST') {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return res.status(500).json({ error: 'Server configuration error: Missing Secrets' });
        }

        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return res.status(400).json({ error: 'No image data provided' });
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
