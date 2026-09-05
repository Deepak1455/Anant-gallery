// ==========================================================================
// ANANT GALLERY SERVICE WORKER - ANDROID STREAMING SHARE ENGINE v22
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v22';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v22';
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            for (const asset of PRECACHE_ASSETS) {
                try { await cache.add(asset); } catch (e) {}
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_VERSION && key !== IMAGE_CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 🌟 100% BULLETPROOF ANDROID SHARE INTERCEPTOR
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname.includes('share-target')) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const recordsToSave = [];

                    for (const [key, val] of formData.entries()) {
                        // किसी भी प्रकार की इमेज फ़ाइल को पकड़ें (size चेक किए बिना)
                        if (val && (typeof val === 'object' || val instanceof Blob)) {
                            let buffer = null;
                            try {
                                // Android Stream को सुरक्षित ArrayBuffer में बदलें
                                buffer = await new Response(val).arrayBuffer();
                            } catch (e) {
                                try { buffer = await val.arrayBuffer(); } catch (err) {}
                            }

                            if (buffer && buffer.byteLength > 0) {
                                recordsToSave.push({
                                    fileBuffer: buffer,
                                    fileName: val.name || `shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`,
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

                    // IndexedDB में तुरंत सेव करें
                    if (recordsToSave.length > 0) {
                        const db = await openDB();
                        await new Promise((resolve, reject) => {
                            const tx = db.transaction(STORE_NAME, "readwrite");
                            const store = tx.objectStore(STORE_NAME);
                            for (const r of recordsToSave) store.add(r);
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                        });

                        // खुली हुई स्क्रीन को तुरंत अपलोड करने का आदेश दें
                        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                        const openApp = clients.find(c => c.url.includes(self.location.origin) && !c.url.includes('share-target'));
                        if (openApp) {
                            openApp.postMessage({ action: 'trigger-sync', sharedCount: recordsToSave.length });
                        }
                    }
                } catch (err) {
                    console.error("[SW Share Target Error]:", err);
                }

                // Android TWA को तुरंत मुख्य गैलरी पेज पर भेजें
                return Response.redirect('/?shared=1', 303);
            })()
        );
        return;
    }

    // सामान्य नेविगेशन
    if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open(CACHE_VERSION);
                return (await cache.match('/index.html')) || (await cache.match('/'));
            })
        );
        return;
    }

    // इमेज और बाकी फाइल्स
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request);
            })
        );
    }
});
