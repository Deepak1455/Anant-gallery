// ==========================================================================
// ANANT GALLERY SERVICE WORKER - SMART OFFLINE PHOTO CACHE ENGINE v28
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v28';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v28';
const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 3;

// 🌟 ऑफलाइन के लिए जरूरी सभी कोर फाइल्स
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/app-screen.js',
    '/gallery-card.js',
    '/image-viewer.js',
    '/albums.js',
    '/favorites.js',
    '/hidden-photos.js',
    '/profile.js',
    '/settings.js',
    '/exit-handler.js',
    '/offline-sync.js',
    '/telegram-photo.js',
    '/trash-purge.js',
    '/splash-screen.js',
    '/biometric-auth.js',
    '/pro-manager.js',
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

// 🌟 तुरंत एक्टिवेट करें
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

// 🌟 100% BULLETPROOF OFFLINE PHOTO ENGINE
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. गैलरी से शेयर होकर आने वाली फोटो को पकड़ें
    if (event.request.method === 'POST' && url.pathname.includes('share-target')) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const recordsToSave = [];

                    for (const [key, val] of formData.entries()) {
                        if (val && (typeof val === 'object' || val instanceof Blob)) {
                            let buffer = null;
                            try { buffer = await val.arrayBuffer(); } catch (e) {}

                            if (buffer && buffer.byteLength > 0) {
                                const cleanType = (val.type && val.type.startsWith('image/')) ? val.type : "image/jpeg";
                                const cleanName = val.name || `gallery_shared_${Date.now()}.jpg`;

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

                    if (recordsToSave.length > 0) {
                        const db = await openDB();
                        await new Promise((resolve, reject) => {
                            const tx = db.transaction(STORE_NAME, "readwrite");
                            const store = tx.objectStore(STORE_NAME);
                            for (const r of recordsToSave) store.add(r);
                            tx.oncomplete = () => { db.close(); resolve(); };
                            tx.onerror = () => { db.close(); reject(tx.error); };
                        });

                        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                        for (const client of clients) {
                            client.postMessage({ action: 'trigger-sync', sharedCount: recordsToSave.length });
                        }
                    }
                } catch (err) {
                    console.error("[SW Share Target Error]:", err);
                }

                return Response.redirect(new URL('/?shared=1', self.location.origin).href, 303);
            })()
        );
        return;
    }

    // 🌟 2. स्मार्ट फोटो कैशिंग (फोटो को बिना नेट के देखने का मुख्य इंजन)
    const isImageRequest = 
        event.request.destination === 'image' || 
        url.pathname.includes('/api/upload') ||
        /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url.pathname);

    if (isImageRequest && event.request.method === 'GET') {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                // पहले चेक करो क्या फोटो फोन के ऑफलाइन मेमोरी में पहले से सेव है?
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    // 🚀 0ms में फोन से ही तुरंत फोटो दिखाएं!
                    return cachedResponse;
                }

                // अगर ऑफलाइन मेमोरी में नहीं है, तो इंटरनेट से लाओ और चुपचाप सेव कर लो
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (networkErr) {
                    // अगर इंटरनेट बंद है और फोटो पहले नहीं खुली थी, तो लोडिंग इमेज दिखाएं
                    return cachedResponse || (await caches.match('/loadingphoto.png'));
                }
            })
        );
        return;
    }

    // 3. नेविगेशन रिक्वेस्ट (पेज ऑफलाइन लोड करने के लिए)
    if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open(CACHE_VERSION);
                return (await cache.match('/index.html')) || (await cache.match('/'));
            })
        );
        return;
    }

    // 4. अन्य सभी फाइल्स (CSS, JS, Fonts)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request).then((resp) => {
                    if (resp && resp.status === 200 && (url.origin === self.location.origin)) {
                        const clone = resp.clone();
                        caches.open(CACHE_VERSION).then(c => c.put(event.request, clone));
                    }
                    return resp;
                });
            })
        );
    }
});
