// ==========================================================================
// ANANT GALLERY SERVICE WORKER - FIXES GITHUB PAGES 405 NOT ALLOWED ERROR
// ==========================================================================

const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 2;

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
    return self.clients.claim();
});

// 🌟 INTERCEPT SHARE TARGET 'POST' REQUESTS TO ELIMINATE 405 NOT ALLOWED ERROR
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // यदि शेयर टारगेट द्वारा फोटो शेयर की गई है
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
                                fileName: file.name || "shared_photo.jpg",
                                fileType: file.type || "image/jpeg",
                                fileSize: file.size,
                                uid: null,
                                currentView: "photos",
                                retryCount: 0,
                                addedAt: Date.now()
                            });
                        }
                    }
                } catch (err) {
                    console.error("[SW] Error handling share target:", err);
                }

                // 🌟 Redirect via GET request (GitHub Pages accepts GET request!)
                return Response.redirect('./', 303);
            })()
        );
    }
});
