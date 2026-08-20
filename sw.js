// ==========================================================================
// ANANT GALLERY SERVICE WORKER - SMART PHONE CACHING & WEB SHARE TARGET
// ==========================================================================

const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 3;

// 🌟 Local Phone Image Cache Storage
const IMAGE_CACHE_NAME = "anant-photos-cache-v1";

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

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== IMAGE_CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ----------------------------------------------------------------------
    // 🌟 1. WEB SHARE TARGET HANDLER (Mobile Gallery Direct Share)
    // ----------------------------------------------------------------------
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

    // ----------------------------------------------------------------------
    // 🌟 2. SMART CACHE-FIRST IMAGE ENGINE (Reduces Cloudflare Requests by 90%+)
    // ----------------------------------------------------------------------
    const isImageFetch = 
        event.request.method === 'GET' && 
        (url.hostname.includes('workers.dev') || url.pathname.startsWith('/api/upload'));

    if (isImageFetch) {
        event.respondWith(
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
                // 1. फोन की मेमोरी (Cache) में चेक करें
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    // 🚀 Cloudflare को कोई कॉल नहीं जाएगी (0 Requests!)
                    return cachedResponse;
                }

                // 2. अगर फोन में नहीं है, तो पहली बार Cloudflare से डाउनलोड करें
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse && networkResponse.status === 200) {
                        // हमेशा के लिए फोन में सेव कर लें
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (err) {
                    return cachedResponse || new Response('Offline Image', { status: 503 });
                }
            })
        );
    }
});
