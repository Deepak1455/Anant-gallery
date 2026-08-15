// ==========================================================================
// ANANT GALLERY SERVICE WORKER - HIGH CAPACITY WEB SHARE TARGET & OFFLINE DB
// ==========================================================================

const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 3; // 🌟 Exactly matched with offline-sync.js

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

// 🌟 93+ PHOTOS SHARE TARGET INTERCEPTOR
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // जब मोबाइल गैलरी से फोटोज़ Anant Gallery में शेयर की जाएँ
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
                                uid: null, // ऐप ओपन होते ही करंट लॉग-इन यूज़र से मैप हो जाएगा
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
                    console.error("[SW Share Target] Error saving shared photos:", err);
                }

                // फोटोज़ सेव होने के बाद ऐप की मेन स्क्रीन पर रीडायरेक्ट करें
                return Response.redirect('/', 303);
            })()
        );
    }
});
