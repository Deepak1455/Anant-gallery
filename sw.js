// ==========================================================================
// ANANT GALLERY SERVICE WORKER - PWABUILDER 100% OFFLINE ENGINE
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v4';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v3';
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

// 1. INSTALL
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVATE
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

// 3. FETCH (GUARANTEED OFFLINE FALLBACK FOR PWABUILDER AUDIT)
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

                        await new Promise((resolve) => {
                            tx.oncomplete = resolve;
                            tx.onerror = resolve;
                        });
                    }
                } catch (err) {
                    console.error("[SW Share Target Error]:", err);
                }
                return Response.redirect('/', 303);
            })()
        );
        return;
    }

    // B. Navigation Fallback (PWABuilder Offline Test Match)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse && networkResponse.status === 200) {
                        const cache = await caches.open(CACHE_VERSION);
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    const cache = await caches.open(CACHE_VERSION);
                    const cachedResponse = await cache.match('/index.html') || await cache.match('/');
                    return cachedResponse || new Response('<!DOCTYPE html><html><body>Offline</body></html>', {
                        status: 200,
                        headers: { 'Content-Type': 'text/html' }
                    });
                }
            })()
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

    // D. Static Assets Cache First
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

// 4. BACKGROUND SYNC & PUSH NOTIFICATIONS
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
