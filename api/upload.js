// ==========================================================================
// VERCEL SECURE SERVERLESS API - ROBUST TELEGRAM STORAGE & CDN PROXY
// ==========================================================================

export const config = {
    api: {
        bodyParser: false, // High-performance raw binary streaming
    },
};

export default async function handler(req, res) {
    // 🌟 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : null;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID.trim() : null;

    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(500).json({ 
            error: 'Server Config Error: Vercel Environment Variables (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID) missing!' 
        });
    }

    // 🌟 2. GET REQUEST: FETCH & STREAM IMAGE FROM TELEGRAM CDN (ZERO TOKEN EXPOSED)
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const legacyUrl = req.query.url;

        if (fileId) {
            try {
                const pathRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
                const pathData = await pathRes.json();

                if (!pathData.ok || !pathData.result?.file_path) {
                    return res.status(404).json({ error: 'Photo not found on Telegram cloud' });
                }

                const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pathData.result.file_path}`;
                const fileResponse = await fetch(telegramFileUrl);

                if (!fileResponse.ok) {
                    return res.status(fileResponse.status).json({ error: 'Failed to download from Telegram' });
                }

                const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
                const arrayBuffer = await fileResponse.arrayBuffer();

                // ⚡ 1-Year Fast Browser & Edge CDN Cache
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400');
                
                return res.status(200).send(Buffer.from(arrayBuffer));
            } catch (err) {
                return res.status(500).json({ error: 'Proxy fetch failed: ' + err.message });
            }
        }

        if (legacyUrl) {
            try {
                const targetUrl = decodeURIComponent(legacyUrl);
                const imageRes = await fetch(targetUrl);
                if (!imageRes.ok) return res.status(imageRes.status).json({ error: 'Failed to fetch remote image' });

                const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
                const arrayBuffer = await imageRes.arrayBuffer();

                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
                return res.status(200).send(Buffer.from(arrayBuffer));
            } catch (err) {
                return res.status(500).json({ error: 'Legacy Proxy Error: ' + err.message });
            }
        }

        return res.status(400).json({ error: 'Missing parameter: file_id or url' });
    }

    // 🌟 3. POST REQUEST: BULLETPROOF 2-STAGE UPLOAD TO TELEGRAM
    if (req.method === 'POST') {
        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return res.status(400).json({ error: 'No image data received on server' });
            }

            // STAGE 1: Try upload via sendPhoto
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
                // STAGE 2 (FALLBACK): If sendPhoto fails (e.g. format/aspect-ratio issue), upload as Document
                console.warn("[Telegram sendPhoto Failed, Trying sendDocument Fallback]:", photoData.description);
                
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
                    console.error("[Telegram Upload Completely Failed]:", finalErr);
                    return res.status(500).json({ error: `Telegram Error: ${finalErr}` });
                }
            }

            // 🌟 Secure Masked URL (Zero Bot Token Exposed)
            const secureImageUrl = `/api/upload?file_id=${encodeURIComponent(fileId)}`;

            return res.status(200).json({
                ok: true,
                fileId: fileId,
                imageUrl: secureImageUrl
            });

        } catch (err) {
            console.error("[Serverless Handler Crash]:", err);
            return res.status(500).json({ error: 'Server Crash: ' + (err.message || 'Unknown Error') });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
