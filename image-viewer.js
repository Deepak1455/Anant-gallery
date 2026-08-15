// ==========================================================================
// IMAGE VIEWER (LIGHTBOX) - SMART SMOOTH HORIZONTAL SCROLL ACTION BAR
// ==========================================================================

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
// 1. DYNAMIC STYLES (SMOOTH HORIZONTAL SCROLLABLE ICON BAR)
// --------------------------------------------------------------------------
const viewerStyles = `
#lightbox {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    z-index: 2000;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 10px;
    opacity: 0;
    transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

#lightbox.active { opacity: 1; }

.lb-card-board {
    width: 100%;
    max-width: 920px;
    height: 92vh;
    background: var(--bg-card, #ffffff);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
    border-radius: 26px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    animation: lbPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes lbPopIn {
    from { transform: scale(0.92) translateY(12px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
}

.lb-header {
    height: 64px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-body, #f8fafc);
    border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
    z-index: 10;
    gap: 8px;
}

.lb-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

#closeLb {
    color: var(--text-main, #0f172a);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: transform 0.15s ease, background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

#closeLb:active { 
    transform: scale(0.86); 
    background: rgba(0,0,0,0.06);
}

.lb-counter {
    font-size: 0.8rem;
    color: var(--accent, #4f46e5);
    background: rgba(79, 70, 229, 0.1);
    border: 1px solid rgba(79, 70, 229, 0.2);
    padding: 5px 11px;
    border-radius: 14px;
    font-weight: 700;
    letter-spacing: 0.4px;
    white-space: nowrap;
    user-select: none;
}

/* 🌟 SMART, FAST & ULTRA-SMOOTH HORIZONTAL SCROLL ACTION BAR */
.lb-actions-wrapper {
    display: flex;
    align-items: center;
    overflow: hidden;
    position: relative;
    flex: 1;
    max-width: 100%;
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
    overscroll-behavior-x: contain;
    padding: 6px 4px 8px 4px;
    margin-left: auto;
    scroll-snap-type: x proximity;
}

/* 🌟 SLEEK MODERN MICRO SCROLLBAR */
.lb-actions::-webkit-scrollbar {
    height: 3.5px;
}

.lb-actions::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.04);
    border-radius: 10px;
}

.lb-actions::-webkit-scrollbar-thumb {
    background: var(--accent, #4f46e5);
    border-radius: 10px;
    opacity: 0.7;
}

.lb-actions::-webkit-scrollbar-thumb:hover {
    background: #9333ea;
}

/* ACTION ICONS WITH FAST HAPTIC-LIKE TAP FEEDBACK */
.lb-action-btn {
    font-size: 1.18rem;
    cursor: pointer;
    padding: 8px 10px;
    border-radius: 12px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.14s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease;
    scroll-snap-align: start;
    user-select: none;
}

.lb-action-btn:active { 
    transform: scale(0.85); 
    background: rgba(79, 70, 229, 0.1);
}

#lbShareBtn { color: #0284c7; }
#lbFavBtn { color: #64748b; }
#lbFavBtn.active { color: #ec4899 !important; }
#lbAlbumBtn { color: #0ea5e9; }
#lbHideBtn { color: #6366f1; }
#lbUnhideBtn { color: #16a34a; }
#lbDownloadBtn { color: var(--accent, #4f46e5); }
#lbTrashBtn { color: #ef4444; }
#lbRestoreBtn { color: #16a34a; }
#lbDelPermBtn { color: #ef4444; }

.lb-img-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 10px;
    background: #080c14;
    overflow: hidden;
    touch-action: none;
    user-select: none;
}

#lbImage {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    transform-origin: center center;
    will-change: transform;
    user-select: none;
    -webkit-user-drag: none;
    transition: opacity 0.2s ease;
}

.lb-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.88);
    color: #0f172a;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    transition: background 0.2s, transform 0.2s;
    backdrop-filter: blur(8px);
}

.lb-nav:hover {
    background: var(--accent, #4f46e5);
    color: #ffffff;
    transform: translateY(-50%) scale(1.08);
}

.lb-prev { left: 14px; }
.lb-next { right: 14px; }

@media(max-width: 600px) {
    .lb-card-board { height: 95vh; border-radius: 22px; }
    .lb-nav { display: none; }
    .lb-header { padding: 0 8px; }
    .lb-action-btn { font-size: 1.15rem; padding: 7px 8px; }
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
                    <i class="fa-solid fa-xmark" id="closeLb" title="Close"></i>
                    <span id="lbCounter" class="lb-counter">1 / 1</span>
                </div>
                <div class="lb-actions-wrapper">
                    <div id="lbActions" class="lb-actions"></div>
                </div>
            </div>
            <div class="lb-img-container" id="lbImgContainer">
                <div class="lb-nav lb-prev" id="prevBtn" title="Previous"><i class="fa-solid fa-chevron-left"></i></div>
                <img src="" id="lbImage" alt="Full View" draggable="false">
                <div class="lb-nav lb-next" id="nextBtn" title="Next"><i class="fa-solid fa-chevron-right"></i></div>
            </div>
        </div>
    `;
    document.body.appendChild(lightboxContainer);
}

// --------------------------------------------------------------------------
// 2. 100% WORKING DIRECT WEB SHARE (BRANDED: ANANT GALLERY)
// --------------------------------------------------------------------------
export async function shareSinglePhotoDirect(imageUrl) {
    try {
        if (navigator.vibrate) navigator.vibrate(25);

        const proxyUrl = `/api/upload?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        const blob = await response.blob();
        
        const fileName = `anant-gallery-${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Anant Gallery',
                text: 'Shared via Anant Gallery - Infinite Cloud 📸',
                files: [file]
            });
        } else if (navigator.share) {
            await navigator.share({
                title: 'Anant Gallery',
                text: 'Shared via Anant Gallery - Infinite Cloud 📸',
                url: imageUrl
            });
        } else {
            await navigator.clipboard.writeText(imageUrl);
            alert("Photo link copied to clipboard!");
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            try {
                if (navigator.share) {
                    await navigator.share({
                        title: 'Anant Gallery',
                        text: 'Shared via Anant Gallery 📸',
                        url: imageUrl
                    });
                }
            } catch (e) {
                console.error("Share error:", e);
            }
        }
    }
}

// --------------------------------------------------------------------------
// 3. ZOOM & PAN ENGINE
// --------------------------------------------------------------------------
function applyTransform(animate = false) {
    const lbImage = document.getElementById('lbImage');
    if (!lbImage) return;

    if (currentScale <= 1) {
        currentScale = 1;
        currentX = 0;
        currentY = 0;
    }

    lbImage.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    lbImage.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
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

    container.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTapTime < 280) {
            if (currentScale > 1) {
                resetZoom(true);
            } else {
                currentScale = 2.5;
                currentX = 0;
                currentY = 0;
                applyTransform(true);
            }
            if (navigator.vibrate) navigator.vibrate(15);
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
                currentScale = Math.min(Math.max(initialScale * (dist / initialDistance), 1), 4);
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

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
                if (diffX < 0) showNextImage();
                else showPrevImage();
            } else if (Math.abs(diffY) > 90 && diffY > 0) {
                closeImageViewer();
            }
        }
    });

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        currentScale = Math.min(Math.max(currentScale + delta, 1), 4);
        if (currentScale === 1) {
            currentX = 0;
            currentY = 0;
        }
        applyTransform(true);
    }, { passive: false });
}

// --------------------------------------------------------------------------
// 4. INITIALIZE IMAGE VIEWER
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
    setTimeout(() => lightbox.classList.add('active'), 10);
}

export function closeImageViewer() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    resetZoom(false);
    lightbox.classList.remove('active');
    setTimeout(() => {
        lightbox.style.display = 'none';
    }, 280);
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
// 5. RENDER VIEWER ACTIONS WITH SMOOTH HORIZONTAL SCROLL
// --------------------------------------------------------------------------
function updateViewerContent(currentView) {
    const data = photosList[currentIndex];
    if (!data) return;

    const lbImage = document.getElementById('lbImage');
    const lbActions = document.getElementById('lbActions');
    const lbCounter = document.getElementById('lbCounter');

    if (lbCounter) lbCounter.innerText = `${currentIndex + 1} / ${photosList.length}`;

    if (lbImage) {
        lbImage.src = data.image;
        lbImage.style.opacity = 1;
    }

    if (lbActions) {
        if (currentView === 'photos' || currentView === 'favorites' || currentView === 'album') {
            const isFav = data.isFavorite === true;
            
            lbActions.innerHTML = `
                <i class="fa-solid fa-share-nodes lb-action-btn" id="lbShareBtn" title="Direct Share"></i>
                <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart lb-action-btn ${isFav ? 'active' : ''}" id="lbFavBtn" title="Favorite"></i>
                <i class="fa-solid fa-folder-plus lb-action-btn" id="lbAlbumBtn" title="Move to Album"></i>
                <i class="fa-solid fa-eye-slash lb-action-btn" id="lbHideBtn" title="Move to Private Photos"></i>
                <i class="fa-solid fa-download lb-action-btn" id="lbDownloadBtn" title="Save to Phone"></i>
                <i class="fa-solid fa-trash lb-action-btn" id="lbTrashBtn" title="Trash"></i>
            `;

            document.getElementById('lbShareBtn').onclick = () => {
                shareSinglePhotoDirect(data.image);
            };

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
                    if (favBtn) favBtn.className = `${data.isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart lb-action-btn ${data.isFavorite ? 'active' : ''}`;
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
                if (callbacks.onDownload) callbacks.onDownload(data.image);
            };

            document.getElementById('lbTrashBtn').onclick = () => {
                if (callbacks.onMoveToTrash) callbacks.onMoveToTrash(data.id);
            };

        } else if (currentView === 'hidden') {
            lbActions.innerHTML = `
                <i class="fa-solid fa-share-nodes lb-action-btn" id="lbShareBtn" title="Direct Share"></i>
                <i class="fa-solid fa-eye lb-action-btn" id="lbUnhideBtn" title="Restore to Gallery"></i>
                <i class="fa-solid fa-download lb-action-btn" id="lbDownloadBtn" title="Save to Phone"></i>
                <i class="fa-solid fa-trash lb-action-btn" id="lbTrashBtn" title="Trash"></i>
            `;

            document.getElementById('lbShareBtn').onclick = () => {
                shareSinglePhotoDirect(data.image);
            };
            document.getElementById('lbUnhideBtn').onclick = () => {
                if (callbacks.onToggleHide) callbacks.onToggleHide(data.id, false);
                handleImageDeleted(data.id);
            };
            document.getElementById('lbDownloadBtn').onclick = () => {
                if (callbacks.onDownload) callbacks.onDownload(data.image);
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
