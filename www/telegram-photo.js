// ==========================================================================
// UNLIMITED ANANT CLOUD PHOTO UPLOAD ENGINE (PARALLEL & PIPELINED 60FPS)
// ==========================================================================

import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    where,
    getDocs,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { addToOfflineQueue } from "./offline-sync.js";
import { isProUser, guardProFeature } from "./pro-manager.js";

const UPLOAD_API_ENDPOINT = "https://anant-gallery.vercel.app/api/upload";
const FREE_BATCH_LIMIT = 15;

// --------------------------------------------------------------------------
// 1. DYNAMIC PROGRESS BAR STYLES (HARDWARE ACCELERATED)
// --------------------------------------------------------------------------
const photoCSS = `
    .photo-upload-topbar {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translate3d(-50%, -120px, 0);
        width: 92%;
        max-width: 420px;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 24px;
        padding: 12px 18px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        z-index: 1000005 !important;
        display: flex;
        flex-direction: column;
        gap: 8px;
        opacity: 0;
        pointer-events: none;
        transition: transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.22s ease;
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
        animation: uploadSpin 0.9s linear infinite;
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
        font-size: 0.92rem;
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
        transition: width 0.15s cubic-bezier(0.16, 1, 0.3, 1);
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
                        <span class="photo-topbar-sub" id="photoUploadStatus">Connecting to storage...</span>
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

export function showProgressModal(statusText = "Syncing with Anant Cloud...") {
    const topBar = getTopProgressBar();
    document.getElementById("photoUploadStatus").innerText = statusText;
    document.getElementById("photoProgressBar").style.width = "0%";
    document.getElementById("photoPercentText").innerText = "0%";
    topBar.style.display = "flex";
    requestAnimationFrame(() => topBar.classList.add("active"));
}

export function updateProgress(percent, statusText) {
    const bar = document.getElementById("photoProgressBar");
    const text = document.getElementById("photoPercentText");
    const status = document.getElementById("photoUploadStatus");

    requestAnimationFrame(() => {
        if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        if (text) text.innerText = `${Math.round(percent)}%`;
        if (status && statusText) status.innerText = statusText;
    });
}

export function hideProgressModal() {
    const topBar = document.getElementById("photoTopProgressBar");
    if (topBar) {
        topBar.classList.remove("active");
        setTimeout(() => { topBar.style.display = "none"; }, 280);
    }
}

// --------------------------------------------------------------------------
// 2. ULTRA-FAST GPU ACCELERATED COMPRESSION (ZERO LEAKS & OOM SAFE)
// --------------------------------------------------------------------------
async function smartCompressImage(file) {
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
        return file;
    }
    // अगर फ़ाइल पहले से 2MB से छोटी है और JPEG/WEBP है, तो री-कंप्रेशन छोड़ें (Instant)
    if (file.size <= 2 * 1024 * 1024 && (file.type === "image/jpeg" || file.type === "image/webp")) {
        return file;
    }

    const isPro = isProUser();
    const maxDimension = isPro ? 3840 : 2048; // Pro: 4K, Free: 2K HD
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

                if (typeof OffscreenCanvas !== 'undefined') {
                    const offCanvas = new OffscreenCanvas(width, height);
                    const ctx = offCanvas.getContext('2d', { alpha: false });
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'medium';
                    ctx.drawImage(bitmap, 0, 0, width, height);

                    const blob = await offCanvas.convertToBlob({ type: 'image/jpeg', quality });
                    if (blob) return blob;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(bitmap, 0, 0, width, height);

                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                if (blob) return blob;
            } finally {
                bitmap.close(); // RAM तुरंत खाली करें
            }
        }
    } catch (e) {
        console.warn("[Compression Fast-Pass Failed, using fallback]:", e);
    }

    return file;
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
            where("fileHash", "==", fileHash),
            limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return false;
        return querySnapshot.docs[0].data().isDeleted !== true;
    } catch {
        return false;
    }
}

// --------------------------------------------------------------------------
// 3. ULTRA-FAST BATCH UPLOAD ENGINE (PIPELINED WITH LIVE STREAMING)
// --------------------------------------------------------------------------
export async function uploadBatchPhotos(files, currentUser, currentView, showToast) {
    if (!files || files.length === 0) return;

    if (!isProUser() && files.length > FREE_BATCH_LIMIT) {
        guardProFeature("Upload 15+ Photos Simultaneously with Anant Pro", () => {
            uploadBatchPhotos(files, currentUser, currentView, showToast);
        });
        return;
    }

    if (!navigator.onLine) {
        for (const file of files) {
            await addToOfflineQueue(file, currentUser.uid, currentView, null);
        }
        if (showToast) showToast(`Offline: ${files.length} photo(s) queued! 📥`);
        return;
    }

    showProgressModal(`Preparing ${files.length} photo(s)...`);

    // 🌟 तेज डुप्लिकेट चेकिंग (सिर्फ 1 बैच में)
    let uniqueFiles = [];
    let skippedCount = 0;

    try {
        const fileHashes = await Promise.all(files.map(f => calculateFileHash(f)));
        const existingHashes = new Set();

        // 30 के चंक में सिर्फ ज़रूरी क्वेरी (No Full Scan)
        for (let i = 0; i < fileHashes.length; i += 30) {
            const chunk = fileHashes.slice(i, i + 30);
            const q = query(
                collection(db, "user_photos"),
                where("uid", "==", currentUser.uid),
                where("fileHash", "in", chunk)
            );
            const snap = await getDocs(q);
            snap.forEach(d => {
                if (d.data().isDeleted !== true) existingHashes.add(d.data().fileHash);
            });
        }

        files.forEach((f, idx) => {
            if (existingHashes.has(fileHashes[idx])) {
                skippedCount++;
            } else {
                uniqueFiles.push(f);
            }
        });
    } catch {
        uniqueFiles = files;
    }

    if (uniqueFiles.length === 0) {
        hideProgressModal();
        if (showToast) showToast(`All ${files.length} photo(s) already exist in gallery! ✅`);
        return;
    }

    const totalFiles = uniqueFiles.length;
    let completedCount = 0;
    let successfulUploads = 0;
    const CONCURRENCY = 3; // 3 पैरेलल स्ट्रीम्स (4G/5G पर सबसे संतुलित)

    // लाइव बाइट प्रोग्रेस ट्रैकर
    const fileProgressMap = new Array(totalFiles).fill(0);
    const updateOverallProgress = () => {
        const totalProgress = fileProgressMap.reduce((a, b) => a + b, 0);
        const percent = Math.min(100, Math.round(totalProgress / totalFiles));
        updateProgress(percent, `Uploading ${completedCount}/${totalFiles} photo(s)...`);
    };

    let fileIndex = 0;

    async function worker() {
        while (fileIndex < totalFiles) {
            const currentIndex = fileIndex++;
            const file = uniqueFiles[currentIndex];

            try {
                const res = await uploadPhotoToTelegram(file, currentUser, currentView, null, {
                    isQueueSync: true,
                    skipDuplicateCheck: true,
                    suppressProgress: true,
                    onFileProgress: (filePercent) => {
                        fileProgressMap[currentIndex] = filePercent;
                        updateOverallProgress();
                    }
                });

                if (res) successfulUploads++;
                fileProgressMap[currentIndex] = 100;
            } catch (err) {
                console.warn("[Upload retry/queue fallback]:", file.name, err);
                await addToOfflineQueue(file, currentUser.uid, currentView, null);
            }

            completedCount++;
            updateOverallProgress();
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, totalFiles); i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    hideProgressModal();

    if (successfulUploads > 0 && showToast) {
        if (navigator.vibrate) navigator.vibrate([20, 35, 20]);
        showToast(`Uploaded ${successfulUploads} photo(s) to Cloud! ⚡`);
    }

    return successfulUploads > 0;
}

// --------------------------------------------------------------------------
// 4. SINGLE PHOTO UPLOAD ENGINE (WITH LIVE XHR STREAMING)
// --------------------------------------------------------------------------
export async function uploadPhotoToTelegram(file, currentUser, currentView, showToast, options = {}) {
    if (!navigator.onLine && !options.isQueueSync) {
        await addToOfflineQueue(file, currentUser.uid, currentView, showToast);
        return false;
    }

    try {
        const fileHash = await calculateFileHash(file);
        
        // 🌟 डुप्लीकेट होने पर तुरंत 0ms में हल करें
        if (!options.skipDuplicateCheck) {
            const duplicate = await isDuplicatePhoto(currentUser.uid, fileHash);
            if (duplicate) {
                if (showToast) showToast("Photo already exists in cloud! ✅");
                hideProgressModal();
                return true;
            }
        }

        const showUI = !options.suppressProgress;
        if (showUI) {
            showProgressModal(isProUser() ? "Securing 4K Photo..." : "Optimizing image...");
            updateProgress(15, "Compressing photo...");
        }

        // कंप्रेस करके नेटवर्क के लिए तैयार करें
        const compressedFile = await smartCompressImage(file);
        if (showUI) updateProgress(35, "Connecting to Cloud Storage...");

        const { userName, userEmail } = getUserMeta(currentUser);

        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const uploadFraction = event.loaded / event.total;
                    const percent = Math.round(35 + uploadFraction * 55);

                    if (showUI) {
                        updateProgress(percent, "Uploading to Cloud...");
                    }
                    if (options.onFileProgress) {
                        options.onFileProgress(Math.round(uploadFraction * 100));
                    }
                }
            };

            xhr.onload = async () => {
                let response = {};
                try {
                    response = JSON.parse(xhr.responseText);
                } catch {
                    response = { error: "Server error" };
                }

                if (xhr.status === 200 && response.ok && response.fileId) {
                    try {
                        if (showUI) updateProgress(95, "Saving Cloud Index...");

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

                        if (showUI) {
                            updateProgress(100, "Completed!");
                            setTimeout(() => {
                                hideProgressModal();
                                if (showToast) showToast("Photo backed up securely! ⚡");
                            }, 220);
                        }

                        resolve(true);
                    } catch (firestoreErr) {
                        if (showUI) hideProgressModal();
                        reject(firestoreErr);
                    }
                } else {
                    if (showUI) hideProgressModal();
                    reject(new Error(response.error || "Upload failed"));
                }
            };

            xhr.onerror = async () => {
                if (showUI) hideProgressModal();
                if (!options.isQueueSync) {
                    await addToOfflineQueue(file, currentUser.uid, currentView, showToast);
                }
                reject(new Error("Network connection error"));
            };

            xhr.open("POST", UPLOAD_API_ENDPOINT);
            xhr.setRequestHeader("Content-Type", "application/octet-stream");
            xhr.send(compressedFile);
        });
    } catch (e) {
        hideProgressModal();
        if (!options.isQueueSync) {
            await addToOfflineQueue(file, currentUser.uid, currentView, showToast);
        }
        throw e;
    }
}
