// ==========================================================================
// VERCEL SERVERLESS API - MULTI-BOT, MULTI-CHANNEL, SENDMEDIAGROUP & SMART CDN
// ==========================================================================

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    },
};

const CLOUDFLARE_CDN_URL = "https://anant-cdn.dt8484970.workers.dev";

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

    // --------------------------------------------------------------------------
    // 🌟 1. GET: DIRECT ULTRA-FAST HIGH RESOLUTION STREAMING
    // --------------------------------------------------------------------------
    if (req.method === 'GET') {
        const fileId = req.query.file_id || req.query.id;
        const preferredBotIdx = parseInt(req.query.b, 10);

        if (fileId) {
            const tokensToTry = [];
            if (!isNaN(preferredBotIdx) && BOT_TOKENS[preferredBotIdx]) {
                tokensToTry.push(BOT_TOKENS[preferredBotIdx]);
            }
            BOT_TOKENS.forEach(t => {
                if (!tokensToTry.includes(t)) tokensToTry.push(t);
            });

            for (const token of tokensToTry) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000);

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

                            res.setHeader('Content-Type', contentType);
                            res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
                            return res.status(200).send(Buffer.from(arrayBuffer));
                        }
                    }
                } catch (err) {}
            }

            return res.status(404).json({ error: 'Photo not found' });
        }

        return res.status(400).json({ error: 'Missing file_id' });
    }

    // --------------------------------------------------------------------------
    // 🌟 2. POST: 4-PHOTO BATCH SENDMEDIAGROUP & DIRECT STREAMING URL
    // --------------------------------------------------------------------------
    if (req.method === 'POST') {
        try {
            const contentTypeHeader = req.headers['content-type'] || '';
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBodyBuffer = Buffer.concat(chunks);

            if (rawBodyBuffer.length === 0) {
                return res.status(400).json({ error: 'No image data' });
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

            const startBotIndex = Math.floor(Math.random() * BOT_TOKENS.length);
            const targetChatId = CHAT_IDS[Math.floor(Math.random() * CHAT_IDS.length)];
            let lastError = null;

            // 🚀 BATCH UPLOAD: sendMediaGroup
            if (uploadedPhotos.length >= 2) {
                const photosToBatch = uploadedPhotos.slice(0, 5);

                for (let i = 0; i < BOT_TOKENS.length; i++) {
                    const currentBotIdx = (startBotIndex + i) % BOT_TOKENS.length;
                    const token = BOT_TOKENS[currentBotIdx];

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

                        const mediaRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
                            method: 'POST',
                            body: form
                        });

                        const mediaData = await mediaRes.json();

                        if (mediaData.ok && Array.isArray(mediaData.result)) {
                            const results = mediaData.result.map((msg, idx) => {
                                const photos = msg.photo || [];
                                const largest = photos[photos.length - 1];
                                const fileId = largest ? largest.file_id : (msg.document ? msg.document.file_id : null);
                                return {
                                    fileId: fileId,
                                    imageUrl: `/api/upload?file_id=${encodeURIComponent(fileId)}&b=${currentBotIdx}`,
                                    filename: photosToBatch[idx]?.filename || `photo_${idx}.jpg`,
                                    index: idx
                                };
                            });

                            return res.status(200).json({
                                ok: true,
                                batch: true,
                                botIndex: currentBotIdx,
                                results: results
                            });
                        } else {
                            lastError = mediaData.description || 'sendMediaGroup rejected';
                        }
                    } catch (botErr) {
                        lastError = botErr.message;
                    }
                }

                return res.status(500).json({ error: `Batch upload failed: ${lastError}` });
            }

            // 🚀 SINGLE UPLOAD
            const singleBuffer = uploadedPhotos.length === 1 ? uploadedPhotos[0].data : rawBodyBuffer;

            for (let i = 0; i < BOT_TOKENS.length; i++) {
                const currentBotIdx = (startBotIndex + i) % BOT_TOKENS.length;
                const token = BOT_TOKENS[currentBotIdx];

                try {
                    let fileId = null;

                    const photoForm = new FormData();
                    photoForm.append('chat_id', targetChatId);
                    photoForm.append('photo', new Blob([singleBuffer], { type: 'image/jpeg' }), 'photo.jpg');

                    const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                        method: 'POST',
                        body: photoForm,
                    });

                    const photoData = await photoRes.json();

                    if (photoData.ok && photoData.result?.photo) {
                        const photos = photoData.result.photo;
                        fileId = photos[photos.length - 1].file_id;
                    } else {
                        const docForm = new FormData();
                        docForm.append('chat_id', targetChatId);
                        docForm.append('document', new Blob([singleBuffer], { type: 'image/jpeg' }), 'photo.jpg');

                        const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                            method: 'POST',
                            body: docForm,
                        });

                        const docData = await docRes.json();
                        if (docData.ok && docData.result?.document) {
                            fileId = docData.result.document.file_id;
                        } else {
                            lastError = docData.description || photoData.description || "Upload rejected";
                            continue;
                        }
                    }

                    if (fileId) {
                        return res.status(200).json({
                            ok: true,
                            batch: false,
                            fileId: fileId,
                            imageUrl: `/api/upload?file_id=${encodeURIComponent(fileId)}&b=${currentBotIdx}`,
                            botIndex: currentBotIdx
                        });
                    }
                } catch (botErr) {
                    lastError = botErr.message;
                }
            }

            return res.status(500).json({ error: `Upload failed: ${lastError}` });

        } catch (err) {
            return res.status(500).json({ error: err.message || 'Upload error' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
