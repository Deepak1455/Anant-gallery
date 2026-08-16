// ==========================================================================
// VERCEL SERVERLESS API - MULTI-BOT LOAD BALANCING & CDN STREAMING ENGINE
// ==========================================================================

export const config = {
    api: {
        bodyParser: false, // High-speed raw binary streaming
        responseLimit: false,
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
    // Enable CORS for all domains
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKENS = getBotTokens();
    const rawChatId = process.env.TELEGRAM_CHAT_ID || '';
    const CHAT_ID = rawChatId.replace(/^["']|["']$/g, '').trim();

    if (BOT_TOKENS.length === 0 || !CHAT_ID) {
        return res.status(500).json({ 
            error: 'Server Config Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in Vercel Environment Variables!' 
        });
    }

    // --------------------------------------------------------------------------
    // 🌟 1. GET REQUEST: FETCH & STREAM PHOTO USING ALL AVAILABLE BOTS (CDN CACHED)
    // --------------------------------------------------------------------------
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const legacyUrl = req.query.url;
        const preferredBotIdx = parseInt(req.query.b, 10);

        if (fileId) {
            // Build ordered list of tokens: preferred bot first, then all remaining bots
            const tokensToTry = [];
            if (!isNaN(preferredBotIdx) && BOT_TOKENS[preferredBotIdx]) {
                tokensToTry.push(BOT_TOKENS[preferredBotIdx]);
            }
            BOT_TOKENS.forEach(t => {
                if (!tokensToTry.includes(t)) tokensToTry.push(t);
            });

            let lastErrorMsg = 'File not found';

            for (const token of tokensToTry) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per bot

                    const pathRes = await fetch(
                        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
                        { signal: controller.signal }
                    );
                    clearTimeout(timeoutId);

                    const pathData = await pathRes.json();

                    if (pathData.ok && pathData.result?.file_path) {
                        const telegramFileUrl = `https://api.telegram.org/file/bot${token}/${pathData.result.file_path}`;
                        const fileResponse = await fetch(telegramFileUrl);

                        if (fileResponse.ok) {
                            const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
                            const arrayBuffer = await fileResponse.arrayBuffer();

                            // 🌟 Vercel Edge CDN Caching (1 Year immutable cache)
                            res.setHeader('Content-Type', contentType);
                            res.setHeader(
                                'Cache-Control', 
                                'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400'
                            );
                            return res.status(200).send(Buffer.from(arrayBuffer));
                        }
                    } else {
                        lastErrorMsg = pathData.description || 'Telegram getFile rejected';
                    }
                } catch (err) {
                    lastErrorMsg = err.message || 'Network fetch error';
                    console.warn(`[Bot Fetch Warning]: ${err.message}`);
                }
            }

            return res.status(404).json({ 
                error: 'Photo not found on any Telegram Bot',
                details: lastErrorMsg 
            });
        }

        // Legacy URL fallback proxy
        if (legacyUrl) {
            try {
                const imageRes = await fetch(decodeURIComponent(legacyUrl));
                if (!imageRes.ok) return res.status(imageRes.status).json({ error: 'Image fetch error' });
                
                const arrayBuffer = await imageRes.arrayBuffer();
                res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
                return res.status(200).send(Buffer.from(arrayBuffer));
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        }

        return res.status(400).json({ error: 'Missing file_id query parameter' });
    }

    // --------------------------------------------------------------------------
    // 🌟 2. POST REQUEST: LOAD-BALANCED PARALLEL UPLOAD WITH AUTOMATIC FAILOVER
    // --------------------------------------------------------------------------
    if (req.method === 'POST') {
        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return res.status(400).json({ error: 'No image data received in request' });
            }

            // Pick a random starting bot index for even load distribution
            const startIndex = Math.floor(Math.random() * BOT_TOKENS.length);
            let lastError = null;

            for (let i = 0; i < BOT_TOKENS.length; i++) {
                const currentBotIdx = (startIndex + i) % BOT_TOKENS.length;
                const token = BOT_TOKENS[currentBotIdx];

                try {
                    let fileId = null;

                    // STAGE 1: Try sendPhoto (Optimized for standard images)
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
                        // STAGE 2: Fallback to sendDocument (For larger or heavy formats)
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
                            lastError = docData.description || photoData.description || "Upload rejected by Telegram";
                            continue; // Switch to next bot
                        }
                    }

                    if (fileId) {
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
                    console.warn(`[Bot ${currentBotIdx} Failed, retrying with next bot]:`, botErr.message);
                }
            }

            return res.status(500).json({ 
                error: `All ${BOT_TOKENS.length} bots failed to upload. Last error: ${lastError}` 
            });

        } catch (err) {
            return res.status(500).json({ error: err.message || 'Internal Upload Error' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
