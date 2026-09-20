// ==========================================================================
// ANANT GALLERY - ULTRA-PREMIUM IMMERSIVE IMAGE VIEWER & QUALITY ENHANCER
// ==========================================================================

const BASE_SERVER_URL = "https://anant-gallery.vercel.app";

let currentIndex = -1;
let photosList = [];
let callbacks = {};

// ZOOM & PAN STATE
let currentScale = 1;
let currentX = 0;
let currentY = 0;
let initialDistance = 0;
let initialScale = 1;
let startX = 0;
let startY = 0;
let isDragging = false;
let tsX = 0, tsY = 0;
let lastTapTime = 0;

// --------------------------------------------------------------------------
// 1. DYNAMIC STYLES (IMMERSIVE OLED DARK GLASS & QUALITY ENHANCER)
// --------------------------------------------------------------------------
const viewerStyles = `
#lightbox {
    position: fixed;
    inset: 0;
    background: rgba(5, 8, 15, 0.96);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    z-index: 2000;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0;
    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
}

#lightbox.active { 
    opacity: 1; 
}

/* 🌟 ULTRA-PREMIUM CARD BOARD CONTAINER */
.lb-card-board {
    width: 100%;
    height: 100%;
    height: 100dvh;
    background: #070a12;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    transform: translateZ(0);
}

/* 🌟 SLEEK FLOATING GLASS HEADER */
.lb-header {
    height: 64px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 20;
    gap: 12px;
    flex-shrink: 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.lb-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

#closeLb {
    color: #f8fafc;
    font-size: 1.25rem;
    cursor: pointer;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.14s ease, background 0.15s ease;
}

#closeLb:active { 
    transform: scale(0.88); 
    background: rgba(255, 255, 255, 0.15);
}

.lb-counter {
    font-size: 0.82rem;
    color: #a5b4fc;
    background: rgba(79, 70, 229, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.35);
    padding: 5px 12px;
    border-radius: 20px;
    font-weight: 800;
    letter-spacing: 0.4px;
    white-space: nowrap;
    user-select: none;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 2px 10px rgba(79, 70, 229, 0.25);
}

/* 🌟 SMART HORIZONTAL SCROLL ACTION BAR */
.lb-actions-wrapper {
    display: flex;
    align-items: center;
    overflow: hidden;
    position: relative;
    flex: 1;
    margin-left: auto;
}

.lb-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    padding: 4px 2px;
    margin-left: auto;
}

.lb-actions::-webkit-scrollbar { display: none; }

.lb-action-btn {
    font-size: 1.15rem;
    cursor: pointer;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.14s ease, background 0.15s ease;
    user-select: none;
}

.lb-action-btn:active { 
    transform: scale(0.86); 
    background: rgba(255, 255, 255, 0.15);
}

#lbFavBtn { color: #cbd5e1; }
#lbFavBtn.active { color: #ec4899 !important; background: rgba(236, 72, 153, 0.15); border-color: rgba(236, 72, 153, 0.3); }
#lbAlbumBtn { color: #38bdf8; }
#lbHideBtn { color: #818cf8; }
#lbUnhideBtn { color: #4ade80; }
#lbDownloadBtn { color: #60a5fa; }
#lbTrashBtn { color: #f87171; }
#lbRestoreBtn { color: #4ade80; }
#lbDelPermBtn { color: #ef4444; }

/* 🌟 MAIN PHOTO STAGE & QUALITY ENHANCER */
.lb-img-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 10px;
    background: radial-gradient(circle at 50% 50%, #0e1526 0%, #060911 100%);
    overflow: hidden;
    touch-action: none;
    user-select: none;
}

#lbImage {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 18px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    transform-origin: center center;
    will-change: transform, opacity;
    user-select: none;
    -webkit-user-drag: none;
    opacity: 0;
    transition: opacity 0.25s ease;
    image-rendering: -webkit-optimize-contrast; /* 🌟 सुपर-क्रिस्प इमेज क्वालिटी */
}

#lbImage.loaded {
    opacity: 1 !important;
}

/* 🌟 LOADER SPINNER (NO MORE UGLY BROKEN ICON) */
.lb-loader {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #818cf8;
    z-index: 5;
    pointer-events: none;
}

.lb-loader i {
    font-size: 2.2rem;
    animation: spin 0.9s linear infinite;
}

.lb-loader-text {
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.3px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* 🌟 GORGEOUS ERROR & RETRY CARD */
.lb-error-box {
    position: absolute;
    inset: 0;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 20px;
    text-align: center;
    z-index: 6;
}

.lb-error-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
}

.lb-error-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
}

.lb-error-sub {
    font-size: 0.8rem;
    color: #94a3b8;
    max-width: 260px;
    line-height: 1.4;
}

.btn-lb-retry {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #ffffff;
    border: none;
    padding: 10px 20px;
    border-radius: 14px;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(79, 70, 229, 0.35);
    transition: transform 0.14s ease;
}

.btn-lb-retry:active {
    transform: scale(0.94);
}

/* DESKTOP PREV / NEXT ARROWS */
.lb-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(15, 23, 42, 0.7);
    color: #ffffff;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    transition: background 0.2s, transform 0.15s;
}

.lb-nav:active {
    transform: translateY(-50%) scale(0.9);
}

.lb-prev { left: 14px; }
.lb-next { right: 14px; }

@media(max-width: 600px) {
    .lb-nav { display: none; }
    .lb-img-container { padding: 6px; }
    #lbImage { border-radius: 14px; }
}
`;

function injectStyles() {
    if (document.getElementById('image-viewer-styles')) return;
    const style = document.createElement('style');
    style.id = 'image-viewer-styles';
    style.textContent = viewerStyles;
    document.head.appendChild(style);
}

function injectHTML() {
    if (document.getElementById('lightbox')) return;
    const lightboxContainer = document.createElement('div');
    lightboxContainer.id = 'lightbox';
    lightboxContainer.innerHTML = `
        <div class="lb-card-board">
            <div class="lb-header">
                <div class="lb-header-left">
                    <i class="fa-solid fa-arrow-left" id="closeLb" title="Back to Gallery"></i>
                    <span id="lbCounter" class="lb-counter">1 / 1</span>
                </div>
                <div class="lb-actions-wrapper">
                    <div id="lbActions" class="lb-actions"></div>
                </div>
            </div>
            <div class="lb-img-container" id="lbImgContainer">
                <div class="lb-nav lb-prev" id="prevBtn" title="Previous"><i class="fa-solid fa-chevron-left"></i></div>
                
                <!-- 🌟 LOADER SPINNER -->
                <div class="lb-loader" id="lbLoader">
                    <i class="fa-solid fa-circle-notch"></i>
                    <span class="lb-loader-text">Enhancing 4K Photo...</span>
                </div>

                <!-- 🌟 ERROR CARD -->
                <div class="lb-error-box" id="lbErrorBox">
                    <div class="lb-error-icon"><i class="fa-solid fa-cloud-arrow-down"></i></div>
                    <div class="lb-error-title">Photo Loading Failed</div>
                    <div class="lb-error-sub">Check internet connection or tap retry to re-fetch from cloud.</div>
                    <button class="btn-lb-retry" id="btnLbRetry"><i class="fa-solid fa-rotate-right"></i> Retry Photo</button>
                </div>

                <img src="" id="lbImage" alt="" draggable="false">
                
                <div class="lb-nav lb-next" id="nextBtn" title="Next"><i class="fa-solid fa-chevron-right"></i></div>
            </div>
        </div>
    `;
    document.body.appendChild(lightboxContainer);
}

// --------------------------------------------------------------------------
// 2. ZOOM & PAN ENGINE (60FPS HARDWARE ACCELERATED)
// --------------------------------------------------------------------------
function applyTransform(animate = false) {
    const lbImage = document.getElementById('lbImage');
    if (!lbImage) return;

    if (currentScale <= 1) {
        currentScale = 1;
        currentX = 0;
        currentY = 0;
    }

    lbImage.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    lbImage.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${currentScale})`;
}

export function resetZoom(animate = false) {
    currentScale = 1;
    currentX = 0;
    currentY = 0;
    applyTransform(animate);
}

function setupZoomAndPan() {
    const container = document.getElementById('lbImgContainer');
    if (!container) return;

    // Double Tap Zoom
    container.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTapTime < 280) {
            if (currentScale > 1) {
                resetZoom(true);
            } else {
                currentScale = 2.4;
                currentX = 0;
                currentY = 0;
                applyTransform(true);
            }
            if (navigator.vibrate) navigator.vibrate(12);
        }
        lastTapTime = now;
    });

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialScale = currentScale;
        } else if (e.touches.length === 1) {
            if (currentScale > 1) {
                isDragging = true;
                startX = e.touches[0].clientX - currentX;
                startY = e.touches[0].clientY - currentY;
            } else {
                tsX = e.touches[0].clientX;
                tsY = e.touches[0].clientY;
            }
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (initialDistance > 0) {
                currentScale = Math.min(Math.max(initialScale * (dist / initialDistance), 1), 3.8);
                applyTransform(false);
            }
        } else if (e.touches.length === 1 && isDragging && currentScale > 1) {
            currentX = e.touches[0].clientX - startX;
            currentY = e.touches[0].clientY - startY;
            applyTransform(false);
        }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        isDragging = false;
        if (currentScale < 1) resetZoom(true);

        if (currentScale === 1 && e.changedTouches.length === 1) {
            let diffX = e.changedTouches[0].clientX - tsX;
            let diffY = e.changedTouches[0].clientY - tsY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 42) {
                if (diffX < 0) showNextImage();
                else showPrevImage();
            } else if (Math.abs(diffY) > 85 && diffY > 0) {
                closeImageViewer();
            }
        }
    });
}

// --------------------------------------------------------------------------
// 3. INITIALIZE & CLOSE (WITH 2GB RAM INSTANT MEMORY RELEASE)
// --------------------------------------------------------------------------
export function initImageViewer(options = {}) {
    callbacks = options;
    injectStyles();
    injectHTML();
    setupZoomAndPan();

    document.getElementById('closeLb').onclick = closeImageViewer;
    document.getElementById('nextBtn').onclick = showNextImage;
    document.getElementById('prevBtn').onclick = showPrevImage;

    document.addEventListener('keydown', (e) => {
        if (!isImageViewerOpen()) return;
        if (e.key === 'ArrowRight') showNextImage();
        else if (e.key === 'ArrowLeft') showPrevImage();
        else if (e.key === 'Escape') closeImageViewer();
    });
}

export function isImageViewerOpen() {
    const lightbox = document.getElementById('lightbox');
    return lightbox && lightbox.style.display === 'flex' && lightbox.classList.contains('active');
}

export function openImageViewer(index, list, currentView) {
    currentIndex = index;
    photosList = [...list];
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    resetZoom(false);
    updateViewerContent(currentView);
    lightbox.style.display = 'flex';
    requestAnimationFrame(() => lightbox.classList.add('active'));
}

export function closeImageViewer() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    resetZoom(false);
    lightbox.classList.remove('active');
    setTimeout(() => {
        lightbox.style.display = 'none';
        const lbImg = document.getElementById('lbImage');
        if (lbImg) {
            lbImg.src = '';
            lbImg.classList.remove('loaded');
        }
    }, 220);
}

export function handleImageDeleted(docId) {
    const targetIndex = photosList.findIndex(item => item.id === docId);
    if (targetIndex !== -1) photosList.splice(targetIndex, 1);
    if (photosList.length === 0) return closeImageViewer();
    if (currentIndex >= photosList.length) currentIndex = photosList.length - 1;
    updateViewerContent(callbacks.getCurrentView ? callbacks.getCurrentView() : 'photos');
}

function showNextImage() {
    if (currentIndex < photosList.length - 1) {
        currentIndex++;
        resetZoom(false);
        updateViewerContent(callbacks.getCurrentView ? callbacks.getCurrentView() : 'photos');
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

function showPrevImage() {
    if (currentIndex > 0) {
        currentIndex--;
        resetZoom(false);
        updateViewerContent(callbacks.getCurrentView ? callbacks.getCurrentView() : 'photos');
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

// --------------------------------------------------------------------------
// 4. SMART IMAGE LOADER & DUAL FALLBACK (NO BROKEN ICON)
// --------------------------------------------------------------------------
function setupSmartImageLoader(data) {
    const lbImage = document.getElementById('lbImage');
    const loader = document.getElementById('lbLoader');
    const errorBox = document.getElementById('lbErrorBox');
    const retryBtn = document.getElementById('btnLbRetry');

    if (!lbImage || !loader || !errorBox) return;

    // Reset States
    lbImage.classList.remove('loaded');
    loader.style.display = 'flex';
    errorBox.style.display = 'none';

    // 🌟 Sanitize Image URL
    let targetUrl = data.image || '';
    if (targetUrl.startsWith('/api/')) {
        targetUrl = `${BASE_SERVER_URL}${targetUrl}`;
    }

    let retryCount = 0;

    lbImage.onload = () => {
        loader.style.display = 'none';
        errorBox.style.display = 'none';
        lbImage.classList.add('loaded');
    };

    lbImage.onerror = () => {
        if (retryCount === 0) {
            retryCount++;
            // 🚀 फॉलबैक: सर्वर से फ़ाइल ID के साथ पुनः प्रयास
            if (data.fileId) {
                lbImage.src = `${BASE_SERVER_URL}/api/upload?file_id=${encodeURIComponent(data.fileId)}`;
            } else if (data.image && data.image.includes('workers.dev')) {
                const parts = data.image.split('?');
                lbImage.src = `${BASE_SERVER_URL}/api/upload?${parts[1] || ''}`;
            } else {
                const sep = targetUrl.includes('?') ? '&' : '?';
                lbImage.src = `${targetUrl}${sep}retry=${Date.now()}`;
            }
        } else {
            // अगर फॉलबैक भी फेल हो जाए ➔ ब्रोकेन आइकॉन छुपाएं और सुंदर रीट्राय कार्ड दिखाएं
            loader.style.display = 'none';
            lbImage.classList.remove('loaded');
            errorBox.style.display = 'flex';
        }
    };

    retryBtn.onclick = () => {
        retryCount = 0;
        loader.style.display = 'flex';
        errorBox.style.display = 'none';
        const sep = targetUrl.includes('?') ? '&' : '?';
        lbImage.src = `${targetUrl}${sep}manual=${Date.now()}`;
    };

    lbImage.src = targetUrl;
}

// --------------------------------------------------------------------------
// 5. RENDER VIEWER ACTIONS & HIGH QUALITY DOWNLOAD
// --------------------------------------------------------------------------
function updateViewerContent(currentView) {
    const data = photosList[currentIndex];
    if (!data) return;

    const lbActions = document.getElementById('lbActions');
    const lbCounter = document.getElementById('lbCounter');

    if (lbCounter) lbCounter.innerText = `${currentIndex + 1} / ${photosList.length}`;

    // 🌟 लोड और एन्हांसमेंट ट्रिगर
    setupSmartImageLoader(data);

    if (lbActions) {
        if (currentView === 'photos' || currentView === 'favorites' || currentView === 'album') {
            const isFav = data.isFavorite === true;
            
            lbActions.innerHTML = `
                <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart lb-action-btn ${isFav ? 'active' : ''}" id="lbFavBtn" title="Favorite"></i>
                <i class="fa-solid fa-folder-plus lb-action-btn" id="lbAlbumBtn" title="Move to Album"></i>
                <i class="fa-solid fa-eye-slash lb-action-btn" id="lbHideBtn" title="Move to Private Photos"></i>
                <i class="fa-solid fa-download lb-action-btn" id="lbDownloadBtn" title="Save in 4K Original"></i>
                <i class="fa-solid fa-trash lb-action-btn" id="lbTrashBtn" title="Trash"></i>
            `;

            document.getElementById('lbFavBtn').onclick = () => {
                const newFavStatus = !data.isFavorite;
                data.isFavorite = newFavStatus;
                if (callbacks.onToggleFav) callbacks.onToggleFav(data.id, newFavStatus);

                if (currentView === 'favorites' && !newFavStatus) {
                    handleImageDeleted(data.id);
                } else if ((currentView === 'photos' || currentView === 'album') && newFavStatus) {
                    handleImageDeleted(data.id);
                } else {
                    const favBtn = document.getElementById('lbFavBtn');
                    if (favBtn) {
                        favBtn.className = `${data.isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart lb-action-btn ${data.isFavorite ? 'active' : ''}`;
                    }
                }
            };

            document.getElementById('lbAlbumBtn').onclick = () => {
                if (callbacks.onAddToAlbum) callbacks.onAddToAlbum(data.id);
            };

            document.getElementById('lbHideBtn').onclick = () => {
                if (callbacks.onToggleHide) callbacks.onToggleHide(data.id, true);
                handleImageDeleted(data.id);
            };

            document.getElementById('lbDownloadBtn').onclick = () => {
                if (navigator.vibrate) navigator.vibrate(15);
                if (callbacks.onDownload) callbacks.onDownload(data.image || data);
            };

            document.getElementById('lbTrashBtn').onclick = () => {
                if (callbacks.onMoveToTrash) callbacks.onMoveToTrash(data.id);
            };

        } else if (currentView === 'hidden') {
            lbActions.innerHTML = `
                <i class="fa-solid fa-eye lb-action-btn" id="lbUnhideBtn" title="Restore to Gallery"></i>
                <i class="fa-solid fa-download lb-action-btn" id="lbDownloadBtn" title="Save to Phone"></i>
                <i class="fa-solid fa-trash lb-action-btn" id="lbTrashBtn" title="Trash"></i>
            `;

            document.getElementById('lbUnhideBtn').onclick = () => {
                if (callbacks.onToggleHide) callbacks.onToggleHide(data.id, false);
                handleImageDeleted(data.id);
            };

            document.getElementById('lbDownloadBtn').onclick = () => {
                if (navigator.vibrate) navigator.vibrate(15);
                if (callbacks.onDownload) callbacks.onDownload(data.image || data);
            };

            document.getElementById('lbTrashBtn').onclick = () => {
                if (callbacks.onMoveToTrash) callbacks.onMoveToTrash(data.id);
            };

        } else if (currentView === 'trash') {
            lbActions.innerHTML = `
                <i class="fa-solid fa-rotate-left lb-action-btn" id="lbRestoreBtn" title="Restore"></i>
                <i class="fa-solid fa-ban lb-action-btn" id="lbDelPermBtn" title="Delete Permanently"></i>
            `;

            document.getElementById('lbRestoreBtn').onclick = () => {
                if (callbacks.onRestore) callbacks.onRestore(data.id);
            };
            document.getElementById('lbDelPermBtn').onclick = () => {
                if (callbacks.onDeletePerm) callbacks.onDeletePerm(data.id);
            };
        }
    }
}
