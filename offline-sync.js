// ==========================================================================
// ULTRA-SCALABLE OFFLINE SYNC ENGINE (SMART, SMOOTH & ULTRA-FAST 60FPS)
// ==========================================================================

const DB_NAME = "GalleryOfflineDB";
const STORE_NAME = "offline_uploads";
const DB_VERSION = 3;

let isSyncing = false;
let syncDebounceTimer = null;
let totalInitialBatchCount = 0;
let dbInstance = null;

// --------------------------------------------------------------------------
// 1. INJECT ULTRA-SMOOTH PROGRESS BADGE STYLES (60FPS HARDWARE ACCELERATED)
// --------------------------------------------------------------------------
function injectBadgeStyles() {
    if (document.getElementById("offline-sync-styles")) return;
    const style = document.createElement("style");
    style.id = "offline-sync-styles";
    style.textContent = `
        #offlineQueueBadge {
            position: fixed;
            bottom: 25px;
            right: 20px;
            background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 30px;
            font-size: 0.82rem;
            font-weight: 700;
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4), 0 0 15px rgba(147, 51, 234, 0.3);
            z-index: 1000004 !important;
            display: none;
            align-items: center;
            gap: 10px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease;
            will-change: transform, opacity;
            user-select: none;
            transform: translate3d(0, 0, 0);
        }

        #offlineQueueBadge.syncing {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
            border-color: rgba(255, 255, 255, 0.35);
        }

        #offlineQueueBadge i.spin {
            animation: syncSpin 1.1s linear infinite;
        }

        .badge-progress-mini {
            width: 50px;
            height: 5px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 10px;
            overflow: hidden;
            display: inline-block;
            margin-left: 4px;
        }

        .badge-progress-fill {
            height: 100%;
            width: 0%;
            background: #ffffff;
            border-radius: 10px;
            transition: width 0.2s ease-out;
            will-change: width;
        }

        @keyframes syncSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// 2. OPTIMIZED INDEXEDDB CONTROLLER (CONNECTION POOLING)
// --------------------------------------------------------------------------
function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            dbInstance.onclose = () => { dbInstance = null; };
            resolve(dbInstance);
        };

        request.onerror = () => reject(request.error);
    });
}

// --------------------------------------------------------------------------
// 🌟 3. FAST & RELIABLE NETWORK CHECK
// --------------------------------------------------------------------------
async function checkRealOnlineStatus() {
    if (!navigator.onLine) return false;
    try {
        const res = await fetch("/loadingphoto.png", { method: "HEAD", cache: "no-store" });
        return res.ok;
    } catch {
        return navigator.onLine;
    }
}

// --------------------------------------------------------------------------
// 🌟 4. ULTRA-FAST MEMORY-SAFE COMPRESSION
// --------------------------------------------------------------------------
async function compressForOfflineStorage(file, maxDimension = 2048, quality = 0.85) {
    if (file.size <= 400 * 1024 && (file.type === "image/jpeg" || file.type === "image/webp")) {
        return file;
    }

    try {
        if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(file);
            let { width, height } = bitmap;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, width, height);
            bitmap.close();

            const compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (compressedBlob && compressedBlob.size < file.size) {
                return compressedBlob;
            }
        }
    } catch (e) {}

    return file;
}

// --------------------------------------------------------------------------
// 5. ADD PHOTO TO QUEUE (ARRAYBUFFER SUPPORT)
// --------------------------------------------------------------------------
export async function addToOfflineQueue(file, uid, currentView, showToast) {
    try {
        injectBadgeStyles();
        const readyBlob = await compressForOfflineStorage(file);
        const buffer = await readyBlob.arrayBuffer();

        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const item = {
            fileBuffer: buffer,
            fileName: file.name || `photo_${Date.now()}.jpg`,
            fileType: readyBlob.type || "image/jpeg",
            fileSize: buffer.byteLength,
            lastModified: file.lastModified || Date.now(),
            uid: uid,
            currentView: currentView || "photos",
            retryCount: 0,
            addedAt: Date.now()
        };

        store.add(item);

        tx.oncomplete = () => {
            if (showToast) {
                showToast("📥 Photo saved! Will upload automatically.");
            }
            updateOfflineBadge();
        };
    } catch (err) {
        console.error("[OfflineSync] Queue Save Error:", err);
    }
}

// --------------------------------------------------------------------------
// 6. FAST QUEUE COUNT
// --------------------------------------------------------------------------
export async function getQueueCount() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const req = store.count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => resolve(0);
        });
    } catch {
        return 0;
    }
}

async function fetchNextChunk(limit = 10) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve) => {
            const items = [];
            const req = store.openCursor();

            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (err) {
        return [];
    }
}

async function removeQueueItem(id) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
    } catch (err) {}
}

// --------------------------------------------------------------------------
// 🌟 7. 100% RELIABLE BULLETPROOF QUEUE PROCESSOR (NEVER HANGS)
// --------------------------------------------------------------------------
export async function processOfflineQueue(currentUser, uploadFn, showToast) {
    if (isSyncing || !currentUser) return;

    const isConnected = await checkRealOnlineStatus();
    if (!isConnected) {
        updateOfflineBadge(false);
        return;
    }

    const totalInQueue = await getQueueCount();
    if (totalInQueue === 0) {
        updateOfflineBadge(false);
        return;
    }

    isSyncing = true;
    totalInitialBatchCount = totalInQueue;

    if (showToast) {
        showToast(`📥 Uploading ${totalInQueue} photo(s) to Cloud...`);
    }

    let processedCount = 0;
    let successCount = 0;

    try {
        while (isSyncing && navigator.onLine) {
            const chunk = await fetchNextChunk(6);
            if (chunk.length === 0) break;

            const CONCURRENCY = 2;
            let index = 0;

            async function worker() {
                while (index < chunk.length && navigator.onLine) {
                    const item = chunk[index++];

                    // अगर फ़ाइल 3 बार फेल हो चुकी है तो कतार से हटा दें ताकि अटके नहीं
                    if ((item.retryCount || 0) >= 3) {
                        await removeQueueItem(item.id);
                        processedCount++;
                        continue;
                    }

                    const rawData = item.fileBuffer ? new Uint8Array(item.fileBuffer) : (item.fileBlob || []);
                    const fileToUpload = new File(
                        [rawData],
                        item.fileName || `photo_${Date.now()}.jpg`,
                        { 
                            type: item.fileType || "image/jpeg",
                            lastModified: item.lastModified || Date.now()
                        }
                    );

                    try {
                        const success = await uploadFn(fileToUpload, currentUser, item.currentView || "photos", null, { 
                            isQueueSync: true,
                            skipDuplicateCheck: false 
                        });

                        // 🌟 चाहे नया अपलोड हो या डुप्लीकेट की वजह से true मिला हो, कतार से तुरंत हटाएँ
                        if (success) {
                            await removeQueueItem(item.id);
                            successCount++;
                        } else {
                            const db = await openDB();
                            const tx = db.transaction(STORE_NAME, "readwrite");
                            item.retryCount = (item.retryCount || 0) + 1;
                            tx.objectStore(STORE_NAME).put(item);
                        }
                    } catch (err) {
                        console.warn("[Queue Worker Handled Error]:", err);
                        // एरर आने पर भी retryCount बढ़ाएँ और कतार में अपडेट करें (कभी हैंग नहीं होगा)
                        try {
                            const db = await openDB();
                            const tx = db.transaction(STORE_NAME, "readwrite");
                            item.retryCount = (item.retryCount || 0) + 1;
                            if (item.retryCount >= 3) {
                                tx.objectStore(STORE_NAME).delete(item.id);
                            } else {
                                tx.objectStore(STORE_NAME).put(item);
                            }
                        } catch (e) {}
                    }

                    processedCount++;
                    const remaining = Math.max(0, totalInQueue - processedCount);
                    updateOfflineBadge(true, remaining, totalInitialBatchCount);
                }
            }

            const workers = [];
            for (let i = 0; i < Math.min(CONCURRENCY, chunk.length); i++) {
                workers.push(worker());
            }
            await Promise.all(workers);
        }
    } catch (err) {
        console.error("[OfflineSync Master Loop Error]:", err);
    } finally {
        isSyncing = false;
        const finalCount = await getQueueCount();
        updateOfflineBadge(false, finalCount);

        if (successCount > 0 && showToast) {
            if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
            showToast(`Uploaded ${successCount} photo(s) to Anant Cloud! ⚡`);
        }
    }
}

// --------------------------------------------------------------------------
// 8. LIVE FLOATING PROGRESS BADGE CONTROLLER
// --------------------------------------------------------------------------
export async function updateOfflineBadge(syncingStatus = false, currentCount = null, totalBatch = null) {
    injectBadgeStyles();

    const count = currentCount !== null ? currentCount : await getQueueCount();
    let badge = document.getElementById("offlineQueueBadge");

    if (count > 0) {
        if (!badge) {
            badge = document.createElement("div");
            badge.id = "offlineQueueBadge";
            document.body.appendChild(badge);
        }

        if (syncingStatus || isSyncing) {
            const total = totalBatch || totalInitialBatchCount || count;
            const done = Math.max(0, total - count);
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;

            badge.className = "syncing";
            badge.innerHTML = `
                <i class="fa-solid fa-cloud-arrow-up spin"></i>
                <span>Syncing ${done}/${total} (${percent}%)</span>
                <div class="badge-progress-mini">
                    <div class="badge-progress-fill" style="width: ${percent}%;"></div>
                </div>
            `;
        } else {
            badge.className = "";
            badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> ${count} Queued`;
        }

        badge.style.display = "flex";
    } else if (badge) {
        badge.style.display = "none";
    }
}

// --------------------------------------------------------------------------
// 9. EVENT LISTENERS INITIALIZATION
// --------------------------------------------------------------------------
export function initOfflineSync(getCurrentUser, uploadFn, showToast) {
    injectBadgeStyles();

    const triggerSync = () => {
        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
            const user = getCurrentUser();
            if (user) {
                processOfflineQueue(user, uploadFn, showToast);
            }
        }, 600);
    };

    window.addEventListener("online", triggerSync);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && navigator.onLine) triggerSync();
    });

    setTimeout(triggerSync, 1000);
}
