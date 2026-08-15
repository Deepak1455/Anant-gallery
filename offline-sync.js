// ==========================================================================
// ULTRA-SCALABLE OFFLINE SYNC ENGINE (HIGH PERFORMANCE & ZERO RAM CRASH)
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
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 30px;
            font-size: 0.82rem;
            font-weight: 700;
            box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4), 0 0 15px rgba(245, 158, 11, 0.2);
            z-index: 1200;
            display: none;
            align-items: center;
            gap: 10px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease;
            will-change: transform, opacity;
            user-select: none;
            transform: translate3d(0, 0, 0);
        }

        #offlineQueueBadge.syncing {
            background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4), 0 0 15px rgba(147, 51, 234, 0.3);
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

        @keyframes badgePopIn {
            0% { opacity: 0; transform: translate3d(0, 20px, 0) scale(0.85); }
            100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
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
// 3. SMART ACTIVE NETWORK CHECK
// --------------------------------------------------------------------------
async function checkRealOnlineStatus() {
    if (!navigator.onLine) return false;
    try {
        await fetch("https://www.google.com/favicon.ico", {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-store"
        });
        return true;
    } catch {
        return false;
    }
}

// --------------------------------------------------------------------------
// 4. ADD PHOTO TO QUEUE (PRESERVES LASTMODIFIED FOR ZERO DUPLICATE ERRORS)
// --------------------------------------------------------------------------
export async function addToOfflineQueue(file, uid, currentView, showToast) {
    try {
        injectBadgeStyles();
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        const item = {
            fileBlob: file,
            fileName: file.name,
            fileType: file.type || "image/jpeg",
            fileSize: file.size,
            lastModified: file.lastModified || Date.now(), // 🌟 सुरक्षित Timestamp
            uid: uid,
            currentView: currentView || "photos",
            retryCount: 0,
            addedAt: Date.now()
        };

        store.add(item);

        tx.oncomplete = () => {
            if (showToast) {
                showToast("Offline: Photo saved to queue! Will auto-upload when online.");
            }
            updateOfflineBadge();
        };
    } catch (err) {
        console.error("[OfflineSync] Queue Save Error:", err);
    }
}

// --------------------------------------------------------------------------
// 5. FAST QUEUE COUNT
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

// --------------------------------------------------------------------------
// 6. STREAMED BATCH FETCHER (FETCHES IN CHUNKS OF 10 FOR HIGH MEMORY SAFETY)
// --------------------------------------------------------------------------
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
        console.error("[OfflineSync] Cursor Fetch Error:", err);
        return [];
    }
}

// Delete item after successful sync
async function removeQueueItem(id) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
    } catch (err) {
        console.error("[OfflineSync] Delete Item Error:", err);
    }
}

// --------------------------------------------------------------------------
// 7. HIGH-PERFORMANCE QUEUE PROCESSOR
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
        showToast(`Online! Syncing ${totalInQueue} offline photo(s) to cloud...`);
    }

    let processedCount = 0;
    let successCount = 0;

    try {
        while (isSyncing && navigator.onLine) {
            const chunk = await fetchNextChunk(10);
            if (chunk.length === 0) break;

            for (const item of chunk) {
                if (!navigator.onLine) {
                    if (showToast) showToast("Connection lost. Sync paused.");
                    isSyncing = false;
                    break;
                }

                // Skip corrupted items with 3+ failures
                if (item.retryCount >= 3) {
                    await removeQueueItem(item.id);
                    processedCount++;
                    continue;
                }

                // 🌟 ओरिजिनल lastModified के साथ File बनाएँ
                const fileToUpload = new File(
                    [item.fileBlob],
                    item.fileName || "photo.jpg",
                    { 
                        type: item.fileType || "image/jpeg",
                        lastModified: item.lastModified || Date.now()
                    }
                );

                try {
                    const success = await uploadFn(fileToUpload, currentUser, item.currentView, null, { isQueueSync: true });

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
                    console.error("[OfflineSync] Item Sync Error:", item.id, err);
                }

                processedCount++;
                const remaining = Math.max(0, totalInQueue - processedCount);
                
                // Live UI Progress Update
                updateOfflineBadge(true, remaining, totalInitialBatchCount);

                // Throttling to prevent API rate limits
                await new Promise(res => setTimeout(res, 250));
            }
        }
    } catch (err) {
        console.error("[OfflineSync] Sync Engine Error:", err);
    } finally {
        isSyncing = false;
        const finalCount = await getQueueCount();
        updateOfflineBadge(false, finalCount);

        if (successCount > 0 && showToast) {
            if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
            showToast(`Auto-synced ${successCount} photo(s) to Anant Cloud!`);
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
            badge.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> ${count} Queued Offline`;
        }

        badge.style.display = "flex";
        badge.style.animation = "badgePopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards";
    } else if (badge) {
        badge.style.opacity = "0";
        badge.style.transform = "translate3d(0, 20px, 0) scale(0.85)";
        setTimeout(() => {
            if (badge) badge.style.display = "none";
        }, 280);
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
        }, 1000);
    };

    window.addEventListener("online", () => {
        if (showToast) showToast("Network connected! Preparing background sync...");
        triggerSync();
    });

    window.addEventListener("offline", () => {
        if (showToast) showToast("You are offline. Photos will be saved to queue!");
        updateOfflineBadge(false);
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && navigator.onLine) {
            triggerSync();
        }
    });

    setTimeout(() => {
        updateOfflineBadge(false);
        if (navigator.onLine) {
            triggerSync();
        }
    }, 1500);
}
