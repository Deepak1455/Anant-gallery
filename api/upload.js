// ==========================================================================
// VERCEL SECURE SERVERLESS API - TOKEN-SAFE TELEGRAM STORAGE & CDN PROXY
// ==========================================================================

export const config = {
    api: {
        bodyParser: false, // High-performance binary stream upload
    },
};

export default async function handler(req, res) {
    // 🌟 1. CORS Headers for Secure Global Access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(500).json({ error: 'Server configuration error: Missing Secrets (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)' });
    }

    // 🌟 2. GET REQUEST: SECURELY STREAM IMAGE WITHOUT EXPOSING BOT TOKEN
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const legacyUrl = req.query.url;

        // CASE A: SECURE PROXY BY TELEGRAM FILE_ID (100% TOKEN PROTECTED)
        if (fileId) {
            try {
                // Fetch file path securely on server side
                const pathRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
                const pathData = await pathRes.json();

                if (!pathData.ok || !pathData.result?.file_path) {
                    return res.status(404).json({ error: 'Photo not found on cloud' });
                }

                const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pathData.result.file_path}`;
                const fileResponse = await fetch(telegramFileUrl);

                if (!fileResponse.ok) {
                    return res.status(fileResponse.status).json({ error: 'Failed to fetch image from Telegram' });
                }

                const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
                const arrayBuffer = await fileResponse.arrayBuffer();

                // ⚡ ULTRA-FAST 1-YEAR VERCEL EDGE & BROWSER CDN CACHE
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400');
                
                return res.status(200).send(Buffer.from(arrayBuffer));
            } catch (err) {
                console.error("[Proxy FileId Error]:", err);
                return res.status(500).json({ error: 'Proxy fetch failed: ' + err.message });
            }
        }

        // CASE B: LEGACY URL PROXY (FOR EXTERNAL/CLOUDINARY DOWNLOADS)
        if (legacyUrl) {
            try {
                const targetUrl = decodeURIComponent(legacyUrl);
                const imageRes = await fetch(targetUrl);
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

        return res.status(400).json({ error: 'Missing parameter: file_id or url' });
    }

    // 🌟 3. POST REQUEST: UPLOAD TO TELEGRAM & RETURN CLEAN MASKED URL
    if (req.method === 'POST') {
        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return res.status(400).json({ error: 'No image binary received' });
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
                console.error("[Telegram Upload Error]:", telegramData);
                return res.status(500).json({ error: telegramData.description || 'Telegram API Upload Error' });
            }

            const photos = telegramData.result.photo;
            const highestResPhoto = photos[photos.length - 1];
            const fileId = highestResPhoto.file_id;

            // 🌟 MASKED URL: NO BOT TOKEN EXPOSED TO CLIENT OR FIRESTORE
            const secureImageUrl = `/api/upload?file_id=${encodeURIComponent(fileId)}`;

            return res.status(200).json({
                ok: true,
                fileId: fileId,
                imageUrl: secureImageUrl
            });
        } catch (err) {
            console.error("[Serverless Handler Error]:", err);
            return res.status(500).json({ error: err.message || 'Internal Server Error' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
