// ==========================================================================
// ANANT GALLERY SERVICE WORKER - BULLETPROOF OFFLINE ENGINE
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v5';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v4';
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

// 1. INSTALL WITH SAFE TRY/CATCH PRECACHE
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            for (const asset of PRECACHE_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (e) {}
            }
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVATE & CLEANUP
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

// 3. FETCH CONTROLLER (EXACT PWABUILDER OFFLINE CRITERIA)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // A. Web Share Target
    if (event.request.method === 'POST' && url.pathname.includes('share-target')) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const mediaFiles = formData.getAll('photos');

                    if (mediaFiles && mediaFiles.length > 0) {
                        const db = await openDB();
                        const tx = db.transaction(STORE_NAME, "readwrite");
                        const store = tx.objectStore(STORE_NAME);

                        for (const file of mediaFiles) {
                            store.add({
                                fileBlob: file,
                                fileName: file.name || `shared_${Date.now()}.jpg`,
                                fileType: file.type || "image/jpeg",
                                fileSize: file.size,
                                lastModified: file.lastModified || Date.now(),
                                uid: null,
                                currentView: "photos",
                                retryCount: 0,
                                addedAt: Date.now()
                            });
                        }

                        await new Promise(resolve => {
                            tx.oncomplete = resolve;
                            tx.onerror = resolve;
                        });
                    }
                } catch (err) {}
                return Response.redirect('/', 303);
            })()
        );
        return;
    }

    // B. Navigation & HTML Offline Fallback
    if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'))) {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open(CACHE_VERSION);
                return (await cache.match('/index.html')) || (await cache.match('/')) || new Response(
                    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Anant Gallery</title></head><body style="background:#090d16; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center;"><div><h2>You are offline</h2><p>Please check your connection.</p></div></body></html>',
                    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            })
        );
        return;
    }

    // C. Images Cache
    const isImageFetch = 
        event.request.method === 'GET' && 
        (url.hostname.includes('workers.dev') || url.pathname.startsWith('/api/upload'));

    if (isImageFetch) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;

                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (err) {
                    return cachedResponse || new Response('Offline Image', { status: 503 });
                }
            })
        );
        return;
    }

    // D. Static Assets Cache
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_VERSION).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
        );
    }
});

// 4. SYNC & PUSH
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-photos') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach(client => client.postMessage({ action: 'trigger-sync' }));
            })
        );
    }
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-cloud-updates') {
        event.waitUntil(Promise.resolve());
    }
});

self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        const options = {
            body: data.body || "New memories backed up to Anant Cloud!",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [100, 50, 100],
            data: { url: data.url || "/" }
        };
        event.waitUntil(
            self.registration.showNotification(data.title || "Anant Gallery", options)
        );
    } catch (e) {
        event.waitUntil(
            self.registration.showNotification("Anant Gallery", {
                body: event.data.text(),
                icon: "/icon-192.png"
            })
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) return clientList[0].focus();
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});
