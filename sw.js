// ==========================================================================
// ANANT GALLERY SERVICE WORKER - BULLETPROOF SHARE TARGET & SINGLE-WINDOW
// ==========================================================================

const CACHE_VERSION = 'anant-shell-v16';
const IMAGE_CACHE_NAME = 'anant-photos-cache-v13';
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
        caches.open(CACHE_VERSION).then(async (cache) => {
            for (const asset of PRECACHE_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (e) {}
            }
        }).then(() => self.skipWaiting())
    );
});

// 2. ACTIVATE & CLEANUP OLD CACHES
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
// 🌟 3. FETCH CONTROLLER & ANDROID GALLERY SHARE TARGET (AUTO-CLOSE DUPLICATE)
// --------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // A. ANDROID GALLERY SHARE TARGET HANDLER
    if (event.request.method === 'POST' && (url.pathname.endsWith('share-target') || url.pathname.includes('share-target'))) {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const mediaFiles = [];

                    // Android OS Gallery से आने वाली हर इमेज फ़ाइल को पकड़ें
                    for (const [key, val] of formData.entries()) {
                        if (val && typeof val === 'object' && val.size > 0) {
                            mediaFiles.push(val);
                        }
                    }

                    if (mediaFiles.length > 0) {
                        // 🌟 STEP 1: पहले सभी फ़ाइलों को मेमोरी में पढ़ें (बिना DB ट्रांजेक्शन खोले)
                        const recordsToSave = [];
                        for (const file of mediaFiles) {
                            let buffer = null;
                            try {
                                buffer = await file.arrayBuffer();
                            } catch (err) {
                                buffer = null;
                            }

                            recordsToSave.push({
                                fileBuffer: buffer,
                                fileBlob: buffer ? null : file,
                                fileName: file.name || `gallery_shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`,
                                fileType: file.type || "image/jpeg",
                                fileSize: buffer ? buffer.byteLength : file.size,
                                lastModified: file.lastModified || Date.now(),
                                uid: null,
                                currentView: "photos",
                                retryCount: 0,
                                addedAt: Date.now()
                            });
                        }

                        // 🌟 STEP 2: IndexedDB में एक साथ सुरक्षित सेव करें
                        if (recordsToSave.length > 0) {
                            const db = await openDB();
                            await new Promise((resolve, reject) => {
                                const tx = db.transaction(STORE_NAME, "readwrite");
                                const store = tx.objectStore(STORE_NAME);

                                for (const record of recordsToSave) {
                                    store.add(record);
                                }

                                tx.oncomplete = () => resolve();
                                tx.onerror = () => reject(tx.error);
                                tx.onabort = () => reject(tx.error);
                            });
                        }

                        // 🌟 STEP 3: डुप्लीकेट विंडो बंद करने और ऐप फ़ोकस करने का लॉजिक
                        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                        const openAppClient = clients.find(c => c.url.includes(self.location.origin) && !c.url.includes('share-target'));

                        if (openAppClient && 'focus' in openAppClient) {
                            await openAppClient.focus();
                            openAppClient.postMessage({ 
                                action: 'trigger-sync',
                                sharedCount: mediaFiles.length 
                            });

                            // शेयर वाली अस्थायी विंडो को तुरंत बंद करें ताकि मल्टीटास्किंग में नए ऐप न बनें
                            return new Response(
                                '<!DOCTYPE html><html><head><script>window.close(); setTimeout(()=>{ window.location.replace("/?shared=1"); }, 150);</script></head><body style="background:#090d16;"></body></html>',
                                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                            );
                        }
                    }
                } catch (err) {
                    console.error("[SW Share Target Error]:", err);
                }

                // अगर ऐप पहले से खुली नहीं थी तो रीडायरेक्ट करके खोलें
                return Response.redirect('/?shared=1', 303);
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
