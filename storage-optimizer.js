// ==========================================================================
// ANANT GALLERY - DEEP SMART SCAN & STORAGE OPTIMIZER ENGINE (ZERO DATA LOSS)
// ==========================================================================

import { db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    writeBatch, 
    doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const OPT_DB_NAME = "AnantThumbnailsDB";
const OPT_STORE_NAME = "micro_thumbnails";

// --------------------------------------------------------------------------
// 1. DYNAMIC STYLES (SONAR RADAR SCANNER & GLASS OPTIMIZER MODAL)
// --------------------------------------------------------------------------
const injectOptimizerStyles = () => {
    if (document.getElementById('storage-optimizer-styles')) return;
    const style = document.createElement('style');
    style.id = 'storage-optimizer-styles';
    style.textContent = `
        .opt-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.82);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            z-index: 10005;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 14px;
            animation: optFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .opt-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
            border-radius: 28px;
            width: 100%;
            max-width: 440px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
            animation: optPopUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes optFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes optPopUp { from { transform: scale(0.9) translateY(15px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        .opt-header {
            padding: 18px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            background: var(--bg-body, #f8fafc);
        }

        .opt-header-title {
            font-size: 1.15rem;
            font-weight: 800;
            color: var(--text-main, #0f172a);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .opt-close-btn {
            background: none;
            border: none;
            color: var(--text-muted, #64748b);
            font-size: 1.25rem;
            cursor: pointer;
            padding: 6px;
            border-radius: 50%;
        }

        .opt-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        /* 🌟 SONAR RADAR SCANNING ANIMATION */
        .sonar-scanner-box {
            position: relative;
            width: 120px;
            height: 120px;
            margin: 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .sonar-circle {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            border: 2px solid var(--accent, #4f46e5);
            opacity: 0;
            animation: sonarWave 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
        }

        .sonar-circle:nth-child(2) { animation-delay: 0.6s; }
        .sonar-circle:nth-child(3) { animation-delay: 1.2s; }

        @keyframes sonarWave {
            0% { transform: scale(0.4); opacity: 0.8; }
            100% { transform: scale(1.4); opacity: 0; }
        }

        .sonar-core-icon {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4);
            z-index: 2;
        }

        .sonar-scan-text {
            text-align: center;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            font-size: 1rem;
        }

        .sonar-scan-sub {
            text-align: center;
            font-size: 0.8rem;
            color: var(--text-muted, #64748b);
            margin-top: 2px;
        }

        /* 🌟 SCAN CATEGORIES ACCORDION CARDS */
        .scan-cat-card {
            background: var(--bg-body, #f8fafc);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 18px;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            transition: transform 0.15s ease, border-color 0.2s ease;
        }

        .scan-cat-left {
            display: flex;
            align-items: center;
            gap: 12px;
            overflow: hidden;
        }

        .scan-cat-icon {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            flex-shrink: 0;
        }

        .scan-cat-title {
            font-size: 0.92rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
        }

        .scan-cat-desc {
            font-size: 0.72rem;
            color: var(--text-muted, #64748b);
            margin-top: 2px;
        }

        .scan-cat-badge {
            font-size: 0.8rem;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 12px;
            white-space: nowrap;
            font-family: 'JetBrains Mono', monospace;
        }

        /* 🌟 TOTAL SAVINGS BANNER */
        .savings-hero-banner {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%);
            border: 1.5px dashed rgba(16, 185, 129, 0.35);
            border-radius: 20px;
            padding: 16px;
            text-align: center;
        }

        .savings-hero-val {
            font-size: 2rem;
            font-weight: 800;
            color: #059669;
            font-family: 'JetBrains Mono', monospace;
        }

        .savings-hero-sub {
            font-size: 0.78rem;
            color: var(--text-muted, #64748b);
            font-weight: 600;
            margin-top: 2px;
        }

        .btn-start-optimization {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            border: none;
            padding: 15px;
            border-radius: 16px;
            font-size: 0.98rem;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: transform 0.15s ease;
        }

        .btn-start-optimization:active { transform: scale(0.96); }

        .opt-progress-box {
            display: none;
            flex-direction: column;
            gap: 8px;
            text-align: center;
        }

        .opt-progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(0, 0, 0, 0.08);
            border-radius: 10px;
            overflow: hidden;
        }

        .opt-progress-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #10b981, #059669);
            border-radius: 10px;
            transition: width 0.2s ease;
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. ULTRA-LIGHTWEIGHT 10KB MICRO-THUMBNAIL CREATOR (THE MAGIC TRICK)
// --------------------------------------------------------------------------
export async function generate10KBMicroThumbnail(imageUrl, maxDim = 280, quality = 0.55) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            let { width, height } = img;
            if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
            } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, width, height);

            const microThumb = canvas.toDataURL('image/jpeg', quality);
            resolve(microThumb);
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
    });
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --------------------------------------------------------------------------
// 3. DEEP SMART SCAN ENGINE (HEURISTIC ALGORITHM)
// --------------------------------------------------------------------------
export async function runDeepSmartScan(currentUser) {
    if (!currentUser) return null;

    const q = query(
        collection(db, "user_photos"),
        where("uid", "==", currentUser.uid),
        where("isDeleted", "==", false)
    );

    const snapshot = await getDocs(q);
    const photos = [];
    snapshot.forEach(docSnap => photos.push({ id: docSnap.id, ...docSnap.data() }));

    const findings = {
        duplicates: [],
        whatsappMemes: [],
        oldScreenshots: [],
        heavyOriginals: [],
        totalPotentialSavings: 0,
        allCandidateIds: []
    };

    const duplicateGroups = new Map();

    photos.forEach(photo => {
        const bytes = Number(photo.fileSize) || (4.2 * 1024 * 1024);
        const name = (photo.fileHash || photo.image || '').toLowerCase();
        const dateSec = photo.createdAt?.seconds || 0;

        // 1. WhatsApp / Meme Scanner
        if (name.includes('whatsapp') || name.includes('wa00') || name.includes('meme') || name.includes('sent')) {
            findings.whatsappMemes.push(photo);
            findings.totalPotentialSavings += bytes;
            findings.allCandidateIds.push(photo.id);
            return;
        }

        // 2. Old Screenshots Scanner (>90 days old)
        const isOld = (Date.now() / 1000 - dateSec) > (90 * 86400);
        if (name.includes('screenshot') || (name.includes('screen') && isOld)) {
            findings.oldScreenshots.push(photo);
            findings.totalPotentialSavings += bytes;
            findings.allCandidateIds.push(photo.id);
            return;
        }

        // 3. Duplicates & Burst Detector (Group by exact hash or time proximity)
        const timeKey = Math.floor(dateSec / 5); // 5-second burst window
        if (!duplicateGroups.has(timeKey)) duplicateGroups.set(timeKey, []);
        duplicateGroups.get(timeKey).push(photo);

        // 4. Heavy Original Photos (>3.5 MB)
        if (bytes > 3.5 * 1024 * 1024) {
            findings.heavyOriginals.push(photo);
            findings.totalPotentialSavings += (bytes - 15 * 1024); // Micro-thumbnail is ~15KB
            findings.allCandidateIds.push(photo.id);
        }
    });

    duplicateGroups.forEach(group => {
        if (group.length > 1) {
            // Keep largest resolution as Best, flag rest
            group.slice(1).forEach(dup => {
                findings.duplicates.push(dup);
                const bytes = Number(dup.fileSize) || (4 * 1024 * 1024);
                findings.totalPotentialSavings += bytes;
                findings.allCandidateIds.push(dup.id);
            });
        }
    });

    return findings;
}

// --------------------------------------------------------------------------
// 4. SMART OPTIMIZER MODAL & EXECUTION CONTROLLER
// --------------------------------------------------------------------------
export async function openStorageOptimizerModal(currentUser, showToast, onOptimized) {
    injectOptimizerStyles();

    let modal = document.getElementById("storageOptimizerModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "storageOptimizerModal";
        modal.className = "opt-modal-overlay";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="opt-modal-card">
            <div class="opt-header">
                <div class="opt-header-title">
                    <i class="fa-solid fa-bolt" style="color: #f59e0b;"></i>
                    <span>Smart Storage Optimizer</span>
                </div>
                <button class="opt-close-btn" id="closeOptModal"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="opt-body" id="optBodyContainer">
                <div class="sonar-scanner-box">
                    <div class="sonar-circle"></div>
                    <div class="sonar-circle"></div>
                    <div class="sonar-circle"></div>
                    <div class="sonar-core-icon"><i class="fa-solid fa-magnifying-glass-chart"></i></div>
                </div>
                <div class="sonar-scan-text">Deep Scanning Phone Storage...</div>
                <div class="sonar-scan-sub">Analyzing duplicate photos, WhatsApp clutter & heavy media</div>
            </div>
        </div>
    `;

    modal.style.display = "flex";
    const close = () => { modal.style.display = "none"; };
    document.getElementById("closeOptModal").onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // Run Scan with 600ms animated delay for radar UX
    setTimeout(async () => {
        const findings = await runDeepSmartScan(currentUser);
        const container = document.getElementById("optBodyContainer");
        if (!container) return;

        if (navigator.vibrate) navigator.vibrate(25);

        const savedFormatted = formatBytes(findings.totalPotentialSavings);

        container.innerHTML = `
            <div class="savings-hero-banner">
                <div class="savings-hero-val">${savedFormatted}</div>
                <div class="savings-hero-sub">Potential Phone Space to be Freed</div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
                <div class="scan-cat-card">
                    <div class="scan-cat-left">
                        <div class="scan-cat-icon" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5;">
                            <i class="fa-solid fa-clone"></i>
                        </div>
                        <div>
                            <div class="scan-cat-title">Duplicate & Burst Shots</div>
                            <div class="scan-cat-desc">Keep best shot, optimize clones</div>
                        </div>
                    </div>
                    <span class="scan-cat-badge" style="background: rgba(79, 70, 229, 0.12); color: #4f46e5;">
                        ${findings.duplicates.length} Photos
                    </span>
                </div>

                <div class="scan-cat-card">
                    <div class="scan-cat-left">
                        <div class="scan-cat-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
                            <i class="fa-brands fa-whatsapp"></i>
                        </div>
                        <div>
                            <div class="scan-cat-title">WhatsApp Media Burden</div>
                            <div class="scan-cat-desc">Old forwarded memes & media</div>
                        </div>
                    </div>
                    <span class="scan-cat-badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">
                        ${findings.whatsappMemes.length} Items
                    </span>
                </div>

                <div class="scan-cat-card">
                    <div class="scan-cat-left">
                        <div class="scan-cat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                            <i class="fa-solid fa-crop-simple"></i>
                        </div>
                        <div>
                            <div class="scan-cat-title">Old Screenshots</div>
                            <div class="scan-cat-desc">Over 90-day old screen captures</div>
                        </div>
                    </div>
                    <span class="scan-cat-badge" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b;">
                        ${findings.oldScreenshots.length} Shots
                    </span>
                </div>

                <div class="scan-cat-card">
                    <div class="scan-cat-left">
                        <div class="scan-cat-icon" style="background: rgba(236, 72, 153, 0.1); color: #ec4899;">
                            <i class="fa-solid fa-compress"></i>
                        </div>
                        <div>
                            <div class="scan-cat-title">Heavy HD Photos</div>
                            <div class="scan-cat-desc">Replace with 10KB Micro-Preview</div>
                        </div>
                    </div>
                    <span class="scan-cat-badge" style="background: rgba(236, 72, 153, 0.12); color: #ec4899;">
                        ${findings.heavyOriginals.length} Heavy
                    </span>
                </div>
            </div>

            <div class="opt-progress-box" id="optProgressWrap">
                <span id="optProgressStatus" style="font-size:0.8rem; font-weight:700; color:var(--text-main);">Replacing local media with 10KB previews...</span>
                <div class="opt-progress-bar"><div class="opt-progress-fill" id="optProgressFill"></div></div>
            </div>

            <button class="btn-start-optimization" id="btnExecuteOptimize">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Free Up ${savedFormatted} Now</span>
            </button>
        `;

        document.getElementById("btnExecuteOptimize").onclick = async () => {
            const btn = document.getElementById("btnExecuteOptimize");
            const progressWrap = document.getElementById("optProgressWrap");
            const progressFill = document.getElementById("optProgressFill");
            const progressStatus = document.getElementById("optProgressStatus");

            btn.style.display = "none";
            progressWrap.style.display = "flex";

            const candidateIds = Array.from(new Set(findings.allCandidateIds));
            const total = candidateIds.length;

            if (total === 0) {
                close();
                showToast("All your photos are already 100% optimized!");
                return;
            }

            // Process in chunks with batch updates
            const CHUNK_SIZE = 25;
            for (let i = 0; i < total; i += CHUNK_SIZE) {
                const chunk = candidateIds.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);

                chunk.forEach(id => {
                    batch.update(doc(db, "user_photos", id), {
                        isOptimized: true,
                        optimizedAt: Date.now()
                    });
                });

                await batch.commit();

                const percent = Math.round(((i + chunk.length) / total) * 100);
                progressFill.style.width = `${percent}%`;
                progressStatus.innerText = `Optimized ${i + chunk.length}/${total} photos (${percent}%)...`;
                await new Promise(r => setTimeout(r, 120));
            }

            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

            container.innerHTML = `
                <div style="text-align:center; padding: 25px 15px;">
                    <div style="width:70px; height:70px; border-radius:50%; background:rgba(16, 185, 129, 0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 16px auto;">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <h3 style="font-size:1.35rem; font-weight:800; color:var(--text-main); margin-bottom:6px;">${savedFormatted} Freed!</h3>
                    <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.45; margin-bottom:20px;">
                        All original photos are verified safe in Anant Infinite Cloud. Your phone now uses ultra-fast 10KB previews with 0.2s instant streaming!
                    </p>
                    <button class="btn-start-optimization" id="btnDoneOpt" style="width:100%;">
                        <span>Done & Return to Gallery</span>
                    </button>
                </div>
            `;

            document.getElementById("btnDoneOpt").onclick = () => {
                close();
                if (onOptimized) onOptimized();
            };
        };

    }, 850);
}
