// ==========================================================================
// ANANT GALLERY SERVICE WORKER - SMART AUTO-SHARE & INSTANT SYNC ENGINE v26
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v26';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v26';
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

// 🌟 बिना किसी देरी के तुरंत सर्विस वर्कर को एक्टिवेट करें
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
                        // किसी भी प्रकार की इमेज फ़ाइल को सुरक्षित मेमोरी बफर में बदलें
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
                                // 🌟 MIME-Type और File Name सैनिटाइज़ेशन
                                const cleanType = (val.type && val.type.startsWith('image/')) ? val.type : "image/jpeg";
                                let cleanName = val.name || "";
                                if (!/\.(jpg|jpeg|png|webp|gif|heic)$/i.test(cleanName)) {
                                    cleanName = `gallery_shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
                                }

                                recordsToSave.push({
                                    fileBuffer: buffer,
                                    fileName: cleanName,
                                    fileType: cleanType,
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

                    // IndexedDB में सुरक्षित सेव करें और कनेक्शन बंद करें
                    if (recordsToSave.length > 0) {
                        const db = await openDB();
                        await new Promise((resolve, reject) => {
                            const tx = db.transaction(STORE_NAME, "readwrite");
                            const store = tx.objectStore(STORE_NAME);
                            for (const r of recordsToSave) store.add(r);
                            tx.oncomplete = () => {
                                db.close(); // 🌟 कनेक्शन तुरंत सुरक्षित बंद करें
                                resolve();
                            };
                            tx.onerror = () => {
                                db.close();
                                reject(tx.error);
                            };
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

                // 🌟 Absolute 303 Redirect ताकि ब्राउज़र तुरंत ऐप के होमपेज पर आ जाए
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
