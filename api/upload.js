// ==========================================================================
// VERCEL SECURE SERVERLESS API - AUTO-CLEANED TOKEN TELEGRAM PROXY
// ==========================================================================

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 🌟 Auto-Clean BOT_TOKEN (Removes accidental 'bot' prefix, quotes or spaces)
    let rawToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let BOT_TOKEN = rawToken.replace(/^["']|["']$/g, '').trim();
    if (BOT_TOKEN.toLowerCase().startsWith('bot')) {
        BOT_TOKEN = BOT_TOKEN.slice(3).trim();
    }

    let rawChatId = process.env.TELEGRAM_CHAT_ID || '';
    const CHAT_ID = rawChatId.replace(/^["']|["']$/g, '').trim();

    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(500).json({ 
            error: 'Server Config Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in Vercel!' 
        });
    }

    // 🌟 1. GET REQUEST: STREAM FROM TELEGRAM CDN
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const legacyUrl = req.query.url;

        if (fileId) {
            try {
                const pathRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
                const pathData = await pathRes.json();

                if (!pathData.ok || !pathData.result?.file_path) {
                    return res.status(404).json({ error: 'Photo not found on Telegram' });
                }

                const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pathData.result.file_path}`;
                const fileResponse = await fetch(telegramFileUrl);

                if (!fileResponse.ok) {
                    return res.status(fileResponse.status).json({ error: 'Failed to fetch image from Telegram' });
                }

                const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
                const arrayBuffer = await fileResponse.arrayBuffer();

                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
                return res.status(200).send(Buffer.from(arrayBuffer));
            } catch (err) {
                return res.status(500).json({ error: 'Proxy fetch failed: ' + err.message });
            }
        }

        if (legacyUrl) {
            try {
                const imageRes = await fetch(decodeURIComponent(legacyUrl));
                if (!imageRes.ok) return res.status(imageRes.status).json({ error: 'Image fetch error' });
                const arrayBuffer = await imageRes.arrayBuffer();
                res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
                return res.status(200).send(Buffer.from(arrayBuffer));
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        }

        return res.status(400).json({ error: 'Missing file_id' });
    }

    // 🌟 2. POST REQUEST: BULLETPROOF UPLOAD
    if (req.method === 'POST') {
        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return res.status(400).json({ error: 'No image data received' });
            }

            // STAGE 1: Try sendPhoto
            let fileId = null;
            const photoForm = new FormData();
            photoForm.append('chat_id', CHAT_ID);
            photoForm.append('photo', new Blob([fileBuffer], { type: 'image/jpeg' }), 'photo.jpg');

            const photoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: photoForm,
            });

            const photoData = await photoRes.json();

            if (photoData.ok && photoData.result?.photo) {
                const photos = photoData.result.photo;
                fileId = photos[photos.length - 1].file_id;
            } else {
                // STAGE 2: Fallback to sendDocument
                const docForm = new FormData();
                docForm.append('chat_id', CHAT_ID);
                docForm.append('document', new Blob([fileBuffer], { type: 'image/jpeg' }), 'photo.jpg');

                const docRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
                    method: 'POST',
                    body: docForm,
                });

                const docData = await docRes.json();
                if (docData.ok && docData.result?.document) {
                    fileId = docData.result.document.file_id;
                } else {
                    const finalErr = docData.description || photoData.description || "Telegram Rejected Upload";
                    return res.status(500).json({ error: `Telegram Error: ${finalErr}` });
                }
            }

            const secureImageUrl = `/api/upload?file_id=${encodeURIComponent(fileId)}`;

            return res.status(200).json({
                ok: true,
                fileId: fileId,
                imageUrl: secureImageUrl
            });

        } catch (err) {
            return res.status(500).json({ error: err.message || 'Upload failed' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
