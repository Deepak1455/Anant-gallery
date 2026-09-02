// ==========================================================================
// UNLIMITED ANANT CLOUD PHOTO UPLOAD MODULE (PRO UNLIMITED & FREE 15-LIMIT)
// ==========================================================================
import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    where,
    getDocs,
    writeBatch,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { addToOfflineQueue } from "./offline-sync.js";
import { isProUser, guardProFeature } from "./pro-manager.js";

// 🌟 SECURE PROXY ENDPOINT
const UPLOAD_API_ENDPOINT = "/api/upload";

// 🌟 FREE TIER LIMIT (अधिकतम 15 फ़ोटो एक साथ)
const FREE_BATCH_LIMIT = 15;

// --------------------------------------------------------------------------
// 1. SMART FLOATING PROGRESS BAR STYLES (60FPS HARDWARE ACCELERATED)
// --------------------------------------------------------------------------
const photoCSS = `
    .photo-upload-topbar {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translate3d(-50%, -120px, 0);
        width: 92%;
        max-width: 400px;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 20px;
        padding: 12px 18px;
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.35);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        opacity: 0;
        pointer-events: none;
        transition: transform 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease;
        will-change: transform, opacity;
        user-select: none;
    }
    .photo-upload-topbar.active {
        transform: translate3d(-50%, 0, 0);
        opacity: 1;
        pointer-events: auto;
    }
    .photo-topbar-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .photo-topbar-left {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
    }
    .photo-topbar-icon {
        width: 34px;
        height: 34px;
        background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
        color: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .photo-topbar-text {
        display: flex;
        flex-direction: column;
        text-align: left;
        overflow: hidden;
    }
    .photo-topbar-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: #f8fafc;
        line-height: 1.2;
    }
    .photo-topbar-sub {
        font-size: 0.72rem;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .photo-topbar-percent {
        font-size: 0.88rem;
        font-weight: 800;
        color: #818cf8;
        font-family: 'JetBrains Mono', monospace;
        flex-shrink: 0;
    }
    .topbar-progress-bg {
        width: 100%;
        height: 5px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        overflow: hidden;
    }
    .topbar-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #6366f1, #a855f7);
        border-radius: 10px;
        transition: width 0.18s ease-out;
        will-change: width;
    }
`;

(function injectPhotoStyles() {
    if (!document.getElementById("telegram-photo-styles")) {
        const styleTag = document.createElement("style");
        styleTag.id = "telegram-photo-styles";
        styleTag.textContent = photoCSS;
        document.head.appendChild(styleTag);
    }
})();

// --------------------------------------------------------------------------
// 2. HELPER: EXTRACT USER METADATA (FOR ADMIN PANEL)
// --------------------------------------------------------------------------
function getUserMeta(user) {
    if (!user) return { userName: "Anonymous", userEmail: "cloud@user" };
    const name = user.displayName || (user.email ? user.email.split('@')[0] : "User");
    const email = user.email || `${user.uid.substring(0, 8)}@cloud`;
    return { userName: name, userEmail: email };
}

// --------------------------------------------------------------------------
// 3. PROGRESS BAR CONTROLLER
// --------------------------------------------------------------------------
function getTopProgressBar() {
    let topBar = document.getElementById("photoTopProgressBar");
    if (!topBar) {
        topBar = document.createElement("div");
        topBar.id = "photoTopProgressBar";
        topBar.className = "photo-upload-topbar";
        topBar.innerHTML = `
            <div class="photo-topbar-content">
                <div class="photo-topbar-left">
                    <div class="photo-topbar-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                    <div class="photo-topbar-text">
                        <span class="photo-topbar-title" id="photoUploadTitle">Anant Cloud Backup</span>
                        <span class="photo-topbar-sub" id="photoUploadStatus">Optimizing HD photos...</span>
                    </div>
                </div>
                <div class="photo-topbar-percent" id="photoPercentText">0%</div>
            </div>
            <div class="topbar-progress-bg">
                <div class="topbar-progress-fill" id="photoProgressBar"></div>
            </div>
        `;
        document.body.appendChild(topBar);
    }
    return topBar;
}

function showProgressModal(statusText = "Syncing with Anant Cloud...") {
    const topBar = getTopProgressBar();
    document.getElementById("photoUploadStatus").innerText = statusText;
    document.getElementById("photoProgressBar").style.width = "0%";
    document.getElementById("photoPercentText").innerText = "0%";
    topBar.style.display = "flex";
    requestAnimationFrame(() => topBar.classList.add("active"));
}

function updateProgress(percent, statusText) {
    const bar = document.getElementById("photoProgressBar");
    const text = document.getElementById("photoPercentText");
    const status = document.getElementById("photoUploadStatus");

    if (bar) bar.style.width = `${percent}%`;
    if (text) text.innerText = `${percent}%`;
    if (status && statusText) status.innerText = statusText;
}

function hideProgressModal() {
    const topBar = document.getElementById("photoTopProgressBar");
    if (topBar) {
        topBar.classList.remove("active");
        setTimeout(() => { topBar.style.display = "none"; }, 320);
    }
}

// --------------------------------------------------------------------------
// 🌟 4. SMART COMPRESSION (Pro = Original 4K/RAW, Free = HD 1080p Smart Compression)
// --------------------------------------------------------------------------
async function smartCompressImage(file, maxDimension = 2048, quality = 0.85) {
    // 👑 Anant Pro: Zero Compression, Original Quality Backed up!
    if (isProUser()) {
        return file;
    }

    // 🆓 Free: If already small web image, don't recompress
    if (file.size <= 350 * 1024 && (file.type === "image/jpeg" || file.type === "image/webp")) {
        return file;
    }

    try {
        // Fast Method 1: Hardware-Accelerated createImageBitmap
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

    // Method 2: Standard Image Object Fallback
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;

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
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                resolve((blob && blob.size < file.size) ? blob : file);
            }, 'image/jpeg', quality);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });
}

// --------------------------------------------------------------------------
// 5. FAST FILE HASH & DUPLICATE CHECK
// --------------------------------------------------------------------------
export async function calculateFileHash(file) {
    const safeName = (file.name || 'photo').replace(/[^a-zA-Z0-9]/g, '');
    return `hash_${file.size}_${file.lastModified || 0}_${safeName}`;
}

async function isDuplicatePhoto(uid, fileHash) {
    try {
        const q = query(
            collection(db, "user_photos"), 
            where("uid", "==", uid),
            where("fileHash", "==", fileHash)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return false;
        return querySnapshot.docs.some(docSnap => docSnap.data().isDeleted !== true);
    } catch (err) {
        return false;
    }
}

export async function batchFilterDuplicates(files, currentUser) {
    try {
        const q = query(
            collection(db, "user_photos"), 
            where("uid", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const existingHashes = new Set();
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.fileHash && data.isDeleted !== true) {
                existingHashes.add(data.fileHash);
            }
        });

        const uniqueFiles = [];
        let skippedCount = 0;

        for (const file of files) {
            const hash = await calculateFileHash(file);
            if (existingHashes.has(hash)) {
                skippedCount++;
            } else {
                uniqueFiles.push(file);
                existingHashes.add(hash);
            }
        }

        return { uniqueFiles, skippedCount };
    } catch (err) {
        return { uniqueFiles: files, skippedCount: 0 };
    }
}

// --------------------------------------------------------------------------
// 🌟 6. SENDMEDIAGROUP CHUNK UPLOAD (UP TO 10 PHOTOS IN 1 REQUEST)
// --------------------------------------------------------------------------
async function uploadMediaGroupChunk(chunkFiles, currentUser, currentView, onProgress) {
    const compressionPromises = chunkFiles.map(file => smartCompressImage(file));
    const compressedBlobs = await Promise.all(compressionPromises);

    const hashPromises = chunkFiles.map(file => calculateFileHash(file));
    const fileHashes = await Promise.all(hashPromises);

    const formData = new FormData();
    compressedBlobs.forEach((blob, idx) => {
        const originalName = chunkFiles[idx].name || `photo_${idx}.jpg`;
        formData.append('photos', blob, originalName);
    });

    const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            try {
                const resJson = JSON.parse(xhr.responseText);
                if (xhr.status === 200 && resJson.ok) {
                    resolve(resJson);
                } else {
                    reject(new Error(resJson.error || `Upload failed (${xhr.status})`));
                }
            } catch (err) {
                reject(new Error("Server returned invalid response"));
            }
        };

        xhr.onerror = () => reject(new Error("Network connection error"));
        xhr.open("POST", UPLOAD_API_ENDPOINT);
        xhr.send(formData);
    });

    const { userName, userEmail } = getUserMeta(currentUser);

    if (response.batch && Array.isArray(response.results)) {
        const batch = writeBatch(db);

        response.results.forEach((item, idx) => {
            const originalFile = chunkFiles[idx] || {};
            const docRef = doc(collection(db, "user_photos"));

            batch.set(docRef, {
                uid: currentUser.uid,
                userName: userName,
                userEmail: userEmail,
                image: item.imageUrl,
                fileId: item.fileId,
                fileHash: fileHashes[idx],
                fileSize: originalFile.size || 0,
                createdAt: serverTimestamp(),
                isFavorite: currentView === 'favorites',
                isHidden: currentView === 'hidden',
                isDeleted: false
            });
        });

        await batch.commit();
        return response.results.length;
    } else if (response.fileId) {
        await addDoc(collection(db, "user_photos"), {
            uid: currentUser.uid,
            userName: userName,
            userEmail: userEmail,
            image: response.imageUrl,
            fileId: response.fileId,
            fileHash: fileHashes[0],
            fileSize: chunkFiles[0].size || 0,
            createdAt: serverTimestamp(),
            isFavorite: currentView === 'favorites',
            isHidden: currentView === 'hidden',
            isDeleted: false
        });
        return 1;
    }

    return 0;
}

// --------------------------------------------------------------------------
// 🌟 7. MASTER BATCH CONTROLLER (FREE: 15 LIMIT, PRO: UNLIMITED)
// --------------------------------------------------------------------------
export async function uploadBatchPhotos(files, currentUser, currentView, showToast) {
    if (!files || files.length === 0) return;

    // 🔒 1. FREE USER BATCH LIMIT GUARD (Max 15 Photos for Free, Unlimited for Pro)
    if (!isProUser() && files.length > FREE_BATCH_LIMIT) {
        guardProFeature("Upload 15+ Photos Simultaneously with Anant Pro", () => {
            // Callback: अगर यूज़र Pro ले लेता है तो अनरिस्ट्रिक्टेड अपलोड आगे बढ़ेगा
            uploadBatchPhotos(files, currentUser, currentView, showToast);
        });
        return;
    }

    if (!navigator.onLine) {
        for (const file of files) {
            await addToOfflineQueue(file, currentUser.uid, currentView, null);
        }
        if (showToast) showToast(`Offline: ${files.length} photo(s) queued for upload!`);
        return;
    }

    const { uniqueFiles, skippedCount } = await batchFilterDuplicates(files, currentUser);

    if (uniqueFiles.length === 0) {
        if (showToast) showToast(`All ${files.length} photo(s) already exist in gallery!`);
        return;
    }

    const totalFiles = uniqueFiles.length;
    if (skippedCount > 0 && showToast) {
        showToast(`Uploading ${totalFiles} photos (${skippedCount} duplicates skipped)`);
    }

    showProgressModal(`Preparing Cloud Batch...`);

    const CHUNK_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
        chunks.push(uniqueFiles.slice(i, i + CHUNK_SIZE));
    }

    let processedCount = 0;
    let successfulUploads = 0;

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const currentChunk = chunks[chunkIdx];

        try {
            if (currentChunk.length === 1) {
                const result = await uploadPhotoToTelegram(currentChunk[0], currentUser, currentView, null, {
                    isQueueSync: true,
                    skipDuplicateCheck: true
                });
                if (result) successfulUploads++;
                processedCount++;
            } else {
                const uploadedCount = await uploadMediaGroupChunk(
                    currentChunk, 
                    currentUser, 
                    currentView, 
                    (percent) => {
                        const basePercent = Math.round((processedCount / totalFiles) * 100);
                        const chunkContribution = Math.round((percent / 100) * (currentChunk.length / totalFiles) * 100);
                        const totalPercent = Math.min(99, basePercent + chunkContribution);
                        updateProgress(totalPercent, `Uploading Photos (${processedCount + currentChunk.length}/${totalFiles})...`);
                    }
                );
                successfulUploads += uploadedCount;
                processedCount += currentChunk.length;
            }

            const overallPercent = Math.round((processedCount / totalFiles) * 100);
            updateProgress(overallPercent, `Backed up ${processedCount}/${totalFiles} photos...`);

        } catch (chunkErr) {
            console.error("[Batch Chunk Error]:", chunkErr);
            for (const file of currentChunk) {
                try {
                    await uploadPhotoToTelegram(file, currentUser, currentView, null, { isQueueSync: true, skipDuplicateCheck: true });
                    successfulUploads++;
                } catch {
                    await addToOfflineQueue(file, currentUser.uid, currentView, null);
                }
                processedCount++;
            }
        }
    }

    hideProgressModal();

    if (successfulUploads > 0 && showToast) {
        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
        showToast(`Backed up ${successfulUploads} photo(s) to Anant Cloud! ⚡`);
    }

    return successfulUploads > 0;
}

// --------------------------------------------------------------------------
// 🌟 8. SINGLE PHOTO UPLOAD ENGINE
// --------------------------------------------------------------------------
export async function uploadPhotoToTelegram(file, currentUser, currentView, showToast, options = {}) {
    if (!navigator.onLine && !options.isQueueSync) {
        await addToOfflineQueue(file, currentUser.uid, currentView, showToast);
        return false;
    }

    try {
        const fileHash = await calculateFileHash(file);
        
        if (!options.skipDuplicateCheck) {
            const duplicate = await isDuplicatePhoto(currentUser.uid, fileHash);
            if (duplicate && !options.isQueueSync) {
                if (showToast) showToast("Photo already exists in gallery!");
                return false;
            }
        }

        if (!options.isQueueSync) {
            showProgressModal(isProUser() ? "Securing 4K Original Photo..." : "Optimizing photo quality...");
        }

        const compressedFile = await smartCompressImage(file);
        if (!options.isQueueSync) updateProgress(30, "Securing Anant Cloud Backup...");

        const { userName, userEmail } = getUserMeta(currentUser);

        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && !options.isQueueSync) {
                    const percent = 30 + Math.round((event.loaded / event.total) * 60);
                    updateProgress(percent, "Uploading to Telegram Cloud...");
                }
            };

            xhr.onload = async () => {
                let response = {};
                try {
                    response = JSON.parse(xhr.responseText);
                } catch {
                    response = { error: "Server returned non-JSON response" };
                }

                if (xhr.status === 200 && response.ok && response.fileId) {
                    try {
                        if (!options.isQueueSync) updateProgress(95, "Saving Cloud Index...");

                        const secureMaskedUrl = response.imageUrl || `/api/upload?file_id=${encodeURIComponent(response.fileId)}`;

                        await addDoc(collection(db, "user_photos"), {
                            uid: currentUser.uid,
                            userName: userName,
                            userEmail: userEmail,
                            image: secureMaskedUrl,
                            fileId: response.fileId,
                            fileHash: fileHash,
                            fileSize: file.size,
                            createdAt: serverTimestamp(),
                            isFavorite: currentView === 'favorites',
                            isHidden: currentView === 'hidden',
                            isDeleted: false
                        });

                        if (!options.isQueueSync) {
                            updateProgress(100, "Done!");
                            setTimeout(() => {
                                hideProgressModal();
                                if (showToast) showToast(isProUser() ? "4K Photo backed up in Original Quality! 👑" : "Photo backed up securely!");
                            }, 250);
                        }

                        resolve(true);
                    } catch (firestoreErr) {
                        if (!options.isQueueSync) hideProgressModal();
                        if (showToast) showToast("Firestore Error: " + firestoreErr.message);
                        reject(firestoreErr);
                    }
                } else {
                    if (!options.isQueueSync) hideProgressModal();
                    const errText = response.error || `Upload Failed (${xhr.status})`;
                    if (showToast) showToast(errText);
                    reject(new Error(errText));
                }
            };

            xhr.onerror = async () => {
                if (!options.isQueueSync) {
                    hideProgressModal();
                    await addToOfflineQueue(file, currentUser.uid, currentView, showToast);
                }
                reject(new Error("Network connection failed during upload"));
            };

            xhr.open("POST", UPLOAD_API_ENDPOINT);
            xhr.setRequestHeader("Content-Type", "application/octet-stream");
            xhr.send(compressedFile);
        });
    } catch (e) {
        if (!options.isQueueSync) {
            hideProgressModal();
            await addToOfflineQueue(file, currentUser.uid, currentView, showToast);
        }
        throw e;
    }
}
