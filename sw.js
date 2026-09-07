// ==========================================================================
// ANANT GALLERY SERVICE WORKER - SMART AUTO-SHARE & INSTANT SYNC ENGINE v25
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v25';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v25';
const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 3;

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/loadingphoto.png',
    '/icon-192.png',
    '/icon-512.png',
    '/privacy.html'
];

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 🌟 बिना किसी देरी के 0.01 सेकंड में सर्विस वर्कर को एक्टिव करें (पहला क्लिक फिक्स)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            for (const asset of PRECACHE_ASSETS) {
                try { await cache.add(asset); } catch (e) {}
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_VERSION && key !== IMAGE_CACHE_NAME) {
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

// 🌟 100% BULLETPROOF SMART 1-TAP SHARE INTERCEPTOR
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // गैलरी से आने वाले शेयर अनुरोध को पकड़ें
    if (event.request.method === 'POST' && url.pathname.includes('share-target')) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const recordsToSave = [];

                    for (const [key, val] of formData.entries()) {
                        // किसी भी प्रकार की इमेज फ़ाइल को तुरंत मेमोरी में बदलें
                        if (val && (typeof val === 'object' || val instanceof Blob)) {
                            let buffer = null;
                            try {
                                buffer = await val.arrayBuffer();
                            } catch (e) {
                                try {
                                    buffer = await new Response(val).arrayBuffer();
                                } catch (err) {}
                            }

                            if (buffer && buffer.byteLength > 0) {
                                recordsToSave.push({
                                    fileBuffer: buffer,
                                    fileName: val.name || `gallery_shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`,
                                    fileType: val.type || "image/jpeg",
                                    fileSize: buffer.byteLength,
                                    lastModified: Date.now(),
                                    uid: null,
                                    currentView: "photos",
                                    retryCount: 0,
                                    addedAt: Date.now()
                                });
                            }
                        }
                    }

                    // IndexedDB में बिना किसी रुकावट के तुरंत सेव करें
                    if (recordsToSave.length > 0) {
                        const db = await openDB();
                        await new Promise((resolve, reject) => {
                            const tx = db.transaction(STORE_NAME, "readwrite");
                            const store = tx.objectStore(STORE_NAME);
                            for (const r of recordsToSave) store.add(r);
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                        });

                        // खुली हुई स्क्रीन को तुरंत ऑटोमैटिक अपलोड शुरू करने का सिग्नल भेजें
                        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                        for (const client of clients) {
                            client.postMessage({ action: 'trigger-sync', sharedCount: recordsToSave.length });
                        }
                    }
                } catch (err) {
                    console.error("[SW Share Target Error]:", err);
                }

                // 🌟 पहले क्लिक का फिक्स: Absolute URL से रीडायरेक्ट (ताकि पहला क्लिक कभी फेल न हो)
                const redirectTarget = new URL('/?shared=1', self.location.origin).href;
                return Response.redirect(redirectTarget, 303);
            })()
        );
        return;
    }

    // सामान्य नेविगेशन अनुरोध (फ़ास्ट लोड)
    if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open(CACHE_VERSION);
                return (await cache.match('/index.html')) || (await cache.match('/'));
            })
        );
        return;
    }

    // कैश्ड फ़ाइल्स और इमेजेस
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request);
            })
        );
    }
});
