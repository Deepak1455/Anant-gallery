// ==========================================================================
// ANANT GALLERY SERVICE WORKER - ULTRA FAST CACHING, OFFLINE ENGINE & PWA SYNC
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v2';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v1';
const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 3;

// 🌟 App Shell Precaching (Offline Support & Instant Load)
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/loadingphoto.png',
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

// --------------------------------------------------------------------------
// 1. INSTALL LIFECYCLE (Precaching App Shell)
// --------------------------------------------------------------------------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn('[SW] Precache soft-warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// --------------------------------------------------------------------------
// 2. ACTIVATE LIFECYCLE (Cache Cleanup & Immediate Control)
// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// 3. FETCH CONTROLLER (SMART CACHING + OFFLINE FALLBACK + SHARE TARGET)
// --------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 🚀 A. WEB SHARE TARGET HANDLER (Mobile Direct Gallery Share)
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

    // 🚀 B. SMART CACHE-FIRST FOR IMAGES (Zero Extra Calls to Cloudflare)
    const isImageFetch = 
        event.request.method === 'GET' && 
        (url.hostname.includes('workers.dev') || url.pathname.startsWith('/api/upload'));

    if (isImageFetch) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

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

    // 🚀 C. STALE-WHILE-REVALIDATE FOR APP SHELL & OFFLINE NAVIGATION
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_VERSION).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // अगर यूजर ऑफलाइन है और नया पेज लोड कर रहा है
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });

                return cachedResponse || fetchPromise;
            })
        );
    }
});

// --------------------------------------------------------------------------
// 4. BACKGROUND SYNC & PERIODIC SYNC (PWABUILDER GREEN BADGES)
// --------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-photos') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ action: 'trigger-sync' });
                });
            })
        );
    }
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-cloud-updates') {
        event.waitUntil(Promise.resolve());
    }
});

// --------------------------------------------------------------------------
// 5. PUSH NOTIFICATIONS HANDLER
// --------------------------------------------------------------------------
self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        const options = {
            body: data.body || "New memories backed up to Anant Cloud!",
            icon: "/loadingphoto.png",
            badge: "/loadingphoto.png",
            vibrate: [100, 50, 100],
            data: { url: data.url || "/" }
        };
        event.waitUntil(
            self.registration.showNotification(data.title || "Anant Gallery", options)
        );
    } catch (e) {
        const text = event.data.text();
        event.waitUntil(
            self.registration.showNotification("Anant Gallery", {
                body: text,
                icon: "/loadingphoto.png"
            })
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow(event.notification.data?.url || '/');
        })
    );
});
