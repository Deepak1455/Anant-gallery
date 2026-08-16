// ==========================================================================
// VERCEL SERVERLESS API - MULTI-BOT LOAD BALANCING & CDN STREAMING ENGINE
// ==========================================================================

export const config = {
    api: {
        bodyParser: false, // High-speed raw binary streaming
    },
};

// 🌟 Helper: Parse & Clean Multiple Bot Tokens from Environment Variable
function getBotTokens() {
    const raw = process.env.TELEGRAM_BOT_TOKEN || '';
    return raw
        .split(',')
        .map(t => t.replace(/^["']|["']$/g, '').trim())
        .map(t => t.toLowerCase().startsWith('bot') ? t.slice(3).trim() : t)
        .filter(t => t.length > 10);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKENS = getBotTokens();
    const rawChatId = process.env.TELEGRAM_CHAT_ID || '';
    const CHAT_ID = rawChatId.replace(/^["']|["']$/g, '').trim();

    if (BOT_TOKENS.length === 0 || !CHAT_ID) {
        return res.status(500).json({ 
            error: 'Server Config Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in Vercel!' 
        });
    }

    // 🌟 1. GET REQUEST: STREAM PHOTO USING MULTI-BOT POOL
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const legacyUrl = req.query.url;
        const preferredBotIdx = parseInt(req.query.b, 10);

        if (fileId) {
            // Reorder tokens to try preferred bot first, then others as fallback
            const tokensToTry = [];
            if (!isNaN(preferredBotIdx) && BOT_TOKENS[preferredBotIdx]) {
                tokensToTry.push(BOT_TOKENS[preferredBotIdx]);
            }
            BOT_TOKENS.forEach(t => {
                if (!tokensToTry.includes(t)) tokensToTry.push(t);
            });

            for (const token of tokensToTry) {
                try {
                    const pathRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
                    const pathData = await pathRes.json();

                    if (pathData.ok && pathData.result?.file_path) {
                        const telegramFileUrl = `https://api.telegram.org/file/bot${token}/${pathData.result.file_path}`;
                        const fileResponse = await fetch(telegramFileUrl);

                        if (fileResponse.ok) {
                            const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
                            const arrayBuffer = await fileResponse.arrayBuffer();

                            res.setHeader('Content-Type', contentType);
                            res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400');
                            return res.status(200).send(Buffer.from(arrayBuffer));
                        }
                    }
                } catch (err) {
                    console.warn(`[Bot CDN Fetch Retry]:`, err.message);
                }
            }

            return res.status(404).json({ error: 'Photo not found on any Telegram Bot' });
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

    // 🌟 2. POST REQUEST: MULTI-BOT LOAD BALANCED UPLOAD WITH AUTO-FAILOVER
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

            // Shuffle / Pick a random starting bot from pool for equal load distribution
            const startIndex = Math.floor(Math.random() * BOT_TOKENS.length);
            let lastError = null;

            for (let i = 0; i < BOT_TOKENS.length; i++) {
                const currentBotIdx = (startIndex + i) % BOT_TOKENS.length;
                const token = BOT_TOKENS[currentBotIdx];

                try {
                    // STAGE 1: Try sendPhoto
                    let fileId = null;
                    const photoForm = new FormData();
                    photoForm.append('chat_id', CHAT_ID);
                    photoForm.append('photo', new Blob([fileBuffer], { type: 'image/jpeg' }), 'photo.jpg');

                    const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
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

                        const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                            method: 'POST',
                            body: docForm,
                        });

                        const docData = await docRes.json();
                        if (docData.ok && docData.result?.document) {
                            fileId = docData.result.document.file_id;
                        } else {
                            lastError = docData.description || photoData.description || "Upload rejected";
                            continue; // Try next bot in pool
                        }
                    }

                    if (fileId) {
                        // 🌟 Return Masked URL with Bot Index for lightning-fast retrieval
                        const secureImageUrl = `/api/upload?file_id=${encodeURIComponent(fileId)}&b=${currentBotIdx}`;

                        return res.status(200).json({
                            ok: true,
                            fileId: fileId,
                            imageUrl: secureImageUrl,
                            botIndex: currentBotIdx
                        });
                    }
                } catch (botErr) {
                    lastError = botErr.message;
                    console.warn(`[Bot ${currentBotIdx} Failed, switching to next bot]:`, botErr.message);
                }
            }

            return res.status(500).json({ 
                error: `All ${BOT_TOKENS.length} bots failed. Last error: ${lastError}` 
            });

        } catch (err) {
            return res.status(500).json({ error: err.message || 'Upload failed' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
