// ==========================================================================
// UNLIMITED ANANT CLOUD PHOTO UPLOAD MODULE (SMART, SMOOTH & ULTRA-FAST)
// ==========================================================================
import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { addToOfflineQueue } from "./offline-sync.js";
import { isProUser, guardProFeature } from "./pro-manager.js";

const UPLOAD_API_ENDPOINT = "/api/upload";
const FREE_BATCH_LIMIT = 15;

// --------------------------------------------------------------------------
// 1. SMART FLOATING PROGRESS BAR STYLES (60FPS HARDWARE ACCELERATED)
// --------------------------------------------------------------------------
const photoCSS = `
    .photo-upload-topbar {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translate3d(-50%, -130px, 0);
        width: 92%;
        max-width: 420px;
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 22px;
        padding: 12px 18px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        z-index: 99999;
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
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
        color: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
    }
    .photo-topbar-icon i.spin {
        animation: uploadSpin 1.1s linear infinite;
    }
    @keyframes uploadSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .photo-topbar-text {
        display: flex;
        flex-direction: column;
        text-align: left;
        overflow: hidden;
    }
    .photo-topbar-title {
        font-size: 0.86rem;
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
        font-size: 0.9rem;
        font-weight: 800;
        color: #818cf8;
        font-family: 'JetBrains Mono', monospace;
        flex-shrink: 0;
    }
    .topbar-progress-bg {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        overflow: hidden;
    }
    .topbar-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #6366f1, #a855f7, #38bdf8);
        border-radius: 10px;
        transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1);
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

function getUserMeta(user) {
    if (!user) return { userName: "Anonymous", userEmail: "cloud@user" };
    const name = user.displayName || (user.email ? user.email.split('@')[0] : "User");
    const email = user.email || `${user.uid.substring(0, 8)}@cloud`;
    return { userName: name, userEmail: email };
}

function getTopProgressBar() {
    let topBar = document.getElementById("photoTopProgressBar");
    if (!topBar) {
        topBar = document.createElement("div");
        topBar.id = "photoTopProgressBar";
        topBar.className = "photo-upload-topbar";
        topBar.innerHTML = `
            <div class="photo-topbar-content">
                <div class="photo-topbar-left">
                    <div class="photo-topbar-icon"><i class="fa-solid fa-cloud-arrow-up spin"></i></div>
                    <div class="photo-topbar-text">
                        <span class="photo-topbar-title" id="photoUploadTitle">Anant Infinite Cloud</span>
                        <span class="photo-topbar-sub" id="photoUploadStatus">Preparing fast upload...</span>
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

    requestAnimationFrame(() => {
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.innerText = `${percent}%`;
        if (status && statusText) status.innerText = statusText;
    });
}

function hideProgressModal() {
    const topBar = document.getElementById("photoTopProgressBar");
    if (topBar) {
        topBar.classList.remove("active");
        setTimeout(() => { topBar.style.display = "none"; }, 320);
    }
}

// --------------------------------------------------------------------------
// 🌟 2. ULTRA-FAST GPU ACCELERATED COMPRESSION (ZERO UI FREEZE & NO LEAKS)
// --------------------------------------------------------------------------
async function smartCompressImage(file) {
    // अगर GIF, SVG या पहले से छोटी फ़ाइल (2.5MB से कम) है तो कम्प्रेशन स्किप करें
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
        return file;
    }
    if (file.size <= 2.5 * 1024 * 1024 && (file.type === "image/jpeg" || file.type === "image/webp")) {
        return file;
    }

    const isPro = isProUser();
    // Pro: 3840px (Ultra 4K), Free: 2048px (Crisp 2K HD)
    const maxDimension = isPro ? 3840 : 2048;
    const quality = isPro ? 0.90 : 0.82;

    try {
        if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(file);
            try {
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

                // GPU Offscreen Canvas अगर उपलब्ध हो (UI को बिना ब्लॉक किए)
                if (typeof OffscreenCanvas !== 'undefined') {
                    const offCanvas = new OffscreenCanvas(width, height);
                    const ctx = offCanvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(bitmap, 0, 0, width, height);

                    const blob = await offCanvas.convertToBlob({ type: 'image/jpeg', quality: quality });
                    if (blob && blob.size <= 3.8 * 1024 * 1024) return blob;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(bitmap, 0, 0, width, height);

                const compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                if (compressedBlob && compressedBlob.size <= 3.8 * 1024 * 1024) {
                    return compressedBlob;
                }
            } finally {
                bitmap.close(); // 🌟 Out Of Memory (Crash) से बचाने के लिए तुरंत बंद करें
            }
        }
    } catch (e) {
        console.warn("[Compression Fallback]:", e);
    }

    // HTML Image Fallback
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
                resolve((blob && blob.size <= 3.8 * 1024 * 1024) ? blob : file);
            }, 'image/jpeg', quality);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });
}

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

// --------------------------------------------------------------------------
// 🌟 3. ULTRA-FAST BATCH CONTROLLER (3-PARALLEL STREAMS, 0% PHONE LAG)
// --------------------------------------------------------------------------
export async function uploadBatchPhotos(files, currentUser, currentView, showToast) {
    if (!files || files.length === 0) return;

    // 🔒 Free User Batch Limit (Max 15)
    if (!isProUser() && files.length > FREE_BATCH_LIMIT) {
        guardProFeature("Upload 15+ Photos Simultaneously with Anant Pro", () => {
            uploadBatchPhotos(files, currentUser, currentView, showToast);
        });
        return;
    }

    // अगर ऑफलाइन हैं तो तुरंत IndexedDB में सुरक्षित करें
    if (!navigator.onLine) {
        for (const file of files) {
            await addToOfflineQueue(file, currentUser.uid, currentView, null);
        }
        if (showToast) showToast(`Offline: ${files.length} photo(s) queued for upload!`);
        return;
    }

    // डुप्लीकेट फोटो को तुरंत फिल्टर करें
    let uniqueFiles = [];
    let skippedCount = 0;

    try {
        const q = query(collection(db, "user_photos"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const existingHashes = new Set();
        
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.fileHash && data.isDeleted !== true) {
                existingHashes.add(data.fileHash);
            }
        });

        for (const file of files) {
            const hash = await calculateFileHash(file);
            if (existingHashes.has(hash)) {
                skippedCount++;
            } else {
                uniqueFiles.push(file);
                existingHashes.add(hash);
            }
        }
    } catch {
        uniqueFiles = files;
    }

    if (uniqueFiles.length === 0) {
        if (showToast) showToast(`All ${files.length} photo(s) already exist in gallery!`);
        return;
    }

    const totalFiles = uniqueFiles.length;
    if (skippedCount > 0 && showToast) {
        showToast(`Uploading ${totalFiles} photos (${skippedCount} duplicates skipped)`);
    }

    showProgressModal(`Uploading ${totalFiles} photo(s)...`);

    let completedCount = 0;
    let successfulUploads = 0;

    // 🌟 3-Parallel Worker Streams: बहुत तेज गति से बिना हैंग हुए अपलोड
    const CONCURRENCY = 3;
    let fileIndex = 0;

    async function worker() {
        while (fileIndex < totalFiles) {
            const currentIndex = fileIndex++;
            const file = uniqueFiles[currentIndex];

            try {
                const res = await uploadPhotoToTelegram(file, currentUser, currentView, null, {
                    isQueueSync: true,
                    skipDuplicateCheck: true
                });
                if (res) successfulUploads++;
            } catch (err) {
                console.warn("[Upload Error on File]:", file.name, err);
                await addToOfflineQueue(file, currentUser.uid, currentView, null);
            }

            completedCount++;
            const percent = Math.round((completedCount / totalFiles) * 100);
            updateProgress(percent, `Uploaded ${completedCount}/${totalFiles} photo(s)...`);
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, totalFiles); i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    hideProgressModal();

    if (successfulUploads > 0 && showToast) {
        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
        showToast(`Uploaded ${successfulUploads} photo(s) to Anant Cloud! ⚡`);
    }

    return successfulUploads > 0;
}

// --------------------------------------------------------------------------
// 🌟 4. SINGLE PHOTO UPLOAD ENGINE (SOLID RETRY & FIRESTORE INDEX)
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

        // कंप्रेस करके साइज को हमेशा 3.8MB से नीचे रखें
        const compressedFile = await smartCompressImage(file);
        if (!options.isQueueSync) updateProgress(35, "Connecting to Cloud Storage...");

        const { userName, userEmail } = getUserMeta(currentUser);

        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && !options.isQueueSync) {
                    const percent = 35 + Math.round((event.loaded / event.total) * 55);
                    updateProgress(percent, "Uploading to Cloud...");
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
                                if (showToast) showToast("Photo backed up securely! ⚡");
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
