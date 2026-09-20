// ==========================================================================
// VERCEL SERVERLESS API - SMART BOT POOL HEALTH MONITOR & AUTO LOAD BALANCER
// ==========================================================================

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    },
};

const CLOUDFLARE_CDN_URL = "https://anant-cdn.dt8484970.workers.dev";

// --------------------------------------------------------------------------
// 1. GLOBAL BOT HEALTH MATRIX (PERSISTENT ACROSS WARM SERVERLESS INVOCATIONS)
// --------------------------------------------------------------------------
const botHealthMatrix = new Map();

function getBotHealth(token) {
    if (!botHealthMatrix.has(token)) {
        botHealthMatrix.set(token, {
            activeRequests: 0,
            cooldownUntil: 0,
            consecutiveErrors: 0,
            totalSuccess: 0,
            lastUsed: 0,
            avgLatency: 120
        });
    }
    return botHealthMatrix.get(token);
}

function recordBotSuccess(token, latencyMs) {
    const health = getBotHealth(token);
    health.consecutiveErrors = 0;
    health.cooldownUntil = 0;
    health.totalSuccess++;
    health.lastUsed = Date.now();
    health.avgLatency = Math.round((health.avgLatency * 0.7) + (latencyMs * 0.3));
}

function recordBotFailure(token, errorData = null) {
    const health = getBotHealth(token);
    health.consecutiveErrors++;
    health.lastUsed = Date.now();

    // 🌟 Handle 429 Too Many Requests with Telegram's retry_after
    if (errorData && (errorData.error_code === 429 || errorData.retry_after)) {
        const retrySec = errorData.parameters?.retry_after || errorData.retry_after || 15;
        health.cooldownUntil = Date.now() + (retrySec * 1000);
    } else {
        // Soft cooldown for network/auth failures
        health.cooldownUntil = Date.now() + Math.min(60000, health.consecutiveErrors * 5000);
    }
}

// Rank bots based on availability, active load, health and latency
function getRankedBots(botTokens, preferredIndex = null) {
    const now = Date.now();

    return botTokens
        .map((token, index) => {
            const health = getBotHealth(token);
            const isCoolingDown = health.cooldownUntil > now;

            let penalty = 0;
            if (isCoolingDown) penalty += 10000 + (health.cooldownUntil - now);
            penalty += health.consecutiveErrors * 800;
            penalty += health.activeRequests * 150;
            penalty += health.avgLatency;

            // Prioritize preferred bot if it's healthy
            if (preferredIndex !== null && index === preferredIndex && !isCoolingDown) {
                penalty -= 250;
            }

            return { token, index, health, penalty, isCoolingDown };
        })
        .sort((a, b) => a.penalty - b.penalty);
}

// --------------------------------------------------------------------------
// 2. CONFIGURATION & PARSING HELPERS
// --------------------------------------------------------------------------
function getBotTokens() {
    const raw = process.env.TELEGRAM_BOT_TOKEN || '';
    return raw
        .split(',')
        .map(t => t.replace(/^["']|["']$/g, '').trim())
        .map(t => t.toLowerCase().startsWith('bot') ? t.slice(3).trim() : t)
        .filter(t => t.length > 10);
}

function getChatIds() {
    const raw = process.env.TELEGRAM_CHAT_ID || '';
    return raw
        .split(',')
        .map(id => id.replace(/^["']|["']$/g, '').trim())
        .filter(id => id.length > 5);
}

function parseMultipartBuffer(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    let start = 0;

    while ((start = buffer.indexOf(boundaryBuffer, start)) !== -1) {
        start += boundaryBuffer.length;
        if (buffer.slice(start, start + 2).toString() === '--') break;
        if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;

        const nextBoundary = buffer.indexOf(boundaryBuffer, start);
        if (nextBoundary === -1) break;

        const partBuffer = buffer.slice(start, nextBoundary - 2);
        const headerEnd = partBuffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
            const headerStr = partBuffer.slice(0, headerEnd).toString('utf-8');
            const body = partBuffer.slice(headerEnd + 4);
            const nameMatch = headerStr.match(/name="([^"]+)"/);
            const filenameMatch = headerStr.match(/filename="([^"]+)"/);
            const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

            parts.push({
                name: nameMatch ? nameMatch[1] : null,
                filename: filenameMatch ? filenameMatch[1] : 'photo.jpg',
                contentType: typeMatch ? typeMatch[1].trim() : 'image/jpeg',
                data: body
            });
        }
        start = nextBoundary;
    }
    return parts;
}

// --------------------------------------------------------------------------
// 3. MAIN SERVERLESS HANDLER
// --------------------------------------------------------------------------
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKENS = getBotTokens();
    const CHAT_IDS = getChatIds();

    if (BOT_TOKENS.length === 0 || CHAT_IDS.length === 0) {
        return res.status(500).json({ 
            error: 'Server Config Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing!' 
        });
    }

    // ----------------------------------------------------------------------
    // 🌟 GET: ZERO-DOWNTIME HIGH RESOLUTION IMAGE STREAMING & PROXY
    // ----------------------------------------------------------------------
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const preferredBotIdx = parseInt(req.query.b, 10);
        const targetUrl = req.query.url;

        // 🚀 URL Direct Proxy
        if (targetUrl) {
            try {
                const proxyRes = await fetch(decodeURIComponent(targetUrl));
                if (proxyRes.ok) {
                    const contentType = proxyRes.headers.get('content-type') || 'image/jpeg';
                    const arrayBuffer = await proxyRes.arrayBuffer();

                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
                    return res.status(200).send(Buffer.from(arrayBuffer));
                }
            } catch (err) {}
        }

        // 🚀 Smart Load-Balanced Telegram File Streamer
        if (fileId) {
            const rankedBots = getRankedBots(BOT_TOKENS, isNaN(preferredBotIdx) ? null : preferredBotIdx);

            for (const botItem of rankedBots) {
                const token = botItem.token;
                const health = botItem.health;
                health.activeRequests++;
                const startTime = Date.now();

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6500);

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
                            recordBotSuccess(token, Date.now() - startTime);
                            const contentType = fileResponse.headers.get('content-type') || 'image/jpeg';
                            const arrayBuffer = await fileResponse.arrayBuffer();

                            res.setHeader('Content-Type', contentType);
                            res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
                            return res.status(200).send(Buffer.from(arrayBuffer));
                        }
                    }

                    recordBotFailure(token, pathData);
                } catch (err) {
                    recordBotFailure(token);
                } finally {
                    health.activeRequests = Math.max(0, health.activeRequests - 1);
                }
            }

            return res.status(404).json({ error: 'Photo not found or all bots busy' });
        }

        return res.status(400).json({ error: 'Missing file_id or url' });
    }

    // ----------------------------------------------------------------------
    // 🌟 POST: AUTO-FAILOVER BATCH & SINGLE UPLOAD ENGINE
    // ----------------------------------------------------------------------
    if (req.method === 'POST') {
        try {
            const contentTypeHeader = req.headers['content-type'] || '';
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBodyBuffer = Buffer.concat(chunks);

            if (rawBodyBuffer.length === 0) {
                return res.status(400).json({ error: 'No image data received' });
            }

            let uploadedPhotos = [];
            if (contentTypeHeader.includes('multipart/form-data')) {
                const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
                if (boundaryMatch) {
                    const boundary = boundaryMatch[1] || boundaryMatch[2];
                    const parts = parseMultipartBuffer(rawBodyBuffer, boundary);
                    uploadedPhotos = parts.filter(p => p.data && p.data.length > 0);
                }
            }

            const targetChatId = CHAT_IDS[Math.floor(Math.random() * CHAT_IDS.length)];
            const rankedBots = getRankedBots(BOT_TOKENS);
            let lastError = null;

            // 🚀 BATCH UPLOAD: sendMediaGroup (UP TO 10 PHOTOS PER CHUNK)
            if (uploadedPhotos.length >= 2) {
                const photosToBatch = uploadedPhotos.slice(0, 10);

                for (const botItem of rankedBots) {
                    const token = botItem.token;
                    const botIdx = botItem.index;
                    const health = botItem.health;
                    health.activeRequests++;
                    const startTime = Date.now();

                    try {
                        const mediaArray = photosToBatch.map((_, idx) => ({
                            type: 'photo',
                            media: `attach://photo_${idx}`
                        }));

                        const form = new FormData();
                        form.append('chat_id', targetChatId);
                        form.append('media', JSON.stringify(mediaArray));

                        photosToBatch.forEach((photoPart, idx) => {
                            form.append(
                                `photo_${idx}`, 
                                new Blob([photoPart.data], { type: photoPart.contentType || 'image/jpeg' }), 
                                photoPart.filename || `photo_${idx}.jpg`
                            );
                        });

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 20000);

                        const mediaRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
                            method: 'POST',
                            body: form,
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);

                        const mediaData = await mediaRes.json();

                        if (mediaData.ok && Array.isArray(mediaData.result)) {
                            recordBotSuccess(token, Date.now() - startTime);

                            const results = mediaData.result.map((msg, idx) => {
                                const photos = msg.photo || [];
                                const largest = photos[photos.length - 1];
                                const fileId = largest ? largest.file_id : (msg.document ? msg.document.file_id : null);
                                return {
                                    fileId: fileId,
                                    imageUrl: `/api/upload?file_id=${encodeURIComponent(fileId)}&b=${botIdx}`,
                                    filename: photosToBatch[idx]?.filename || `photo_${idx}.jpg`,
                                    index: idx
                                };
                            });

                            return res.status(200).json({
                                ok: true,
                                batch: true,
                                botIndex: botIdx,
                                results: results
                            });
                        } else {
                            recordBotFailure(token, mediaData);
                            lastError = mediaData.description || 'sendMediaGroup failed';
                        }
                    } catch (botErr) {
                        recordBotFailure(token);
                        lastError = botErr.message;
                    } finally {
                        health.activeRequests = Math.max(0, health.activeRequests - 1);
                    }
                }

                return res.status(500).json({ error: `All bots busy: ${lastError}` });
            }

            // 🚀 SINGLE PHOTO UPLOAD
            const singleBuffer = uploadedPhotos.length === 1 ? uploadedPhotos[0].data : rawBodyBuffer;
            const singleMime = uploadedPhotos.length === 1 ? (uploadedPhotos[0].contentType || 'image/jpeg') : 'image/jpeg';
            const singleName = uploadedPhotos.length === 1 ? (uploadedPhotos[0].filename || 'photo.jpg') : 'photo.jpg';

            for (const botItem of rankedBots) {
                const token = botItem.token;
                const botIdx = botItem.index;
                const health = botItem.health;
                health.activeRequests++;
                const startTime = Date.now();

                try {
                    let fileId = null;

                    const photoForm = new FormData();
                    photoForm.append('chat_id', targetChatId);
                    photoForm.append('photo', new Blob([singleBuffer], { type: singleMime }), singleName);

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 12000);

                    const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                        method: 'POST',
                        body: photoForm,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    const photoData = await photoRes.json();

                    if (photoData.ok && photoData.result?.photo) {
                        const photos = photoData.result.photo;
                        fileId = photos[photos.length - 1].file_id;
                    } else {
                        // Fallback: sendDocument
                        const docForm = new FormData();
                        docForm.append('chat_id', targetChatId);
                        docForm.append('document', new Blob([singleBuffer], { type: singleMime }), singleName);

                        const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                            method: 'POST',
                            body: docForm
                        });

                        const docData = await docRes.json();
                        if (docData.ok && docData.result?.document) {
                            fileId = docData.result.document.file_id;
                        } else {
                            recordBotFailure(token, docData.ok ? photoData : docData);
                            lastError = docData.description || photoData.description || "Upload rejected";
                            continue;
                        }
                    }

                    if (fileId) {
                        recordBotSuccess(token, Date.now() - startTime);

                        return res.status(200).json({
                            ok: true,
                            batch: false,
                            fileId: fileId,
                            imageUrl: `/api/upload?file_id=${encodeURIComponent(fileId)}&b=${botIdx}`,
                            botIndex: botIdx
                        });
                    }
                } catch (botErr) {
                    recordBotFailure(token);
                    lastError = botErr.message;
                } finally {
                    health.activeRequests = Math.max(0, health.activeRequests - 1);
                }
            }

            return res.status(500).json({ error: `Upload failover exhausted: ${lastError}` });

        } catch (err) {
            return res.status(500).json({ error: err.message || 'Server error' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
