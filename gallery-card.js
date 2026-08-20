// ==========================================================================
// GALLERY CARD & UNIFIED ALL-PHOTOS BOARD COMPONENT (WITH SMART DUAL-FALLBACK)
// ==========================================================================

const dateCache = new Map();

// --------------------------------------------------------------------------
// 1. DYNAMIC STYLES FOR UNIFIED BOARD, PHOTO CARDS & SELECTION
// --------------------------------------------------------------------------
const injectCardBoardStyles = () => {
    if (document.getElementById('card-board-styles')) return;
    const style = document.createElement('style');
    style.id = 'card-board-styles';
    style.textContent = `
        /* 🌟 SINGLE UNIFIED ALL-PHOTOS CARD BOARD */
        .all-photos-board {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 24px;
            padding: 16px 14px 22px 14px;
            margin: 10px 10px 30px 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .all-photos-board-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            padding: 0 4px;
        }

        .all-photos-board-title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* 🌟 TIMELINE INLINE DATE DIVIDERS */
        .timeline-date-divider {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 16px 0 10px 0;
            padding-left: 2px;
        }

        .timeline-date-divider:first-child {
            margin-top: 2px;
        }

        .timeline-date-pill {
            background: rgba(79, 70, 229, 0.1);
            color: var(--accent, #4f46e5);
            border: 1px solid rgba(79, 70, 229, 0.2);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.76rem;
            font-weight: 700;
            letter-spacing: 0.3px;
        }

        .timeline-date-line {
            flex: 1;
            height: 1px;
            background: var(--border, rgba(0, 0, 0, 0.06));
        }

        /* PHOTO GRID */
        .timeline-grid {
            display: grid;
            grid-template-columns: repeat(var(--grid-cols, 3), 1fr);
            gap: 10px;
            margin-bottom: 6px;
        }

        @media (min-width: 600px) {
            .timeline-grid {
                grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
                gap: 12px;
            }
        }

        /* PHOTO CARDS */
        .photo-card {
            position: relative;
            aspect-ratio: 1 / 1;
            background: var(--bg-body, #f8fafc);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
            user-select: none;
            -webkit-user-drag: none;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .photo-card:active {
            transform: scale(0.96);
        }

        .photo-card.photo-locked {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
        }

        .photo-card.is-new-photo {
            animation: newPhotoPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
            will-change: transform, opacity;
        }

        @keyframes newPhotoPopIn {
            0% { opacity: 0; transform: scale(0.85); }
            100% { opacity: 1; transform: scale(1); }
        }

        /* 🌟 SILKY SMOOTH IMAGE LOADING */
        .photo-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: opacity 0.25s ease, transform 0.35s ease;
            pointer-events: none;
            opacity: 0;
        }

        .photo-card img.loaded {
            opacity: 1 !important;
        }

        /* 🌟 SOFT BROKEN IMAGE FALLBACK */
        .photo-error-box {
            position: absolute;
            inset: 0;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(239, 68, 68, 0.06);
            color: var(--text-muted, #64748b);
            font-size: 0.75rem;
            gap: 4px;
            z-index: 1;
        }

        .photo-error-box i {
            font-size: 1.4rem;
            color: #ef4444;
            opacity: 0.6;
        }

        /* 🟦 BLUE TICK SELECTION */
        .photo-card.selected::after {
            content: '';
            position: absolute;
            inset: 0;
            border: 3.5px solid #2563eb !important;
            border-radius: 14px;
            pointer-events: none;
            box-shadow: inset 0 0 12px rgba(37, 99, 235, 0.35);
            z-index: 3;
            transition: opacity 0.2s ease;
        }

        .check-circle {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 22px;
            height: 22px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
            border: 2px solid #ffffff !important;
            border-radius: 50%;
            color: #ffffff !important;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            opacity: 0;
            transform: scale(0) rotate(-45deg);
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            z-index: 4;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.4);
        }

        .photo-card.selected .check-circle {
            opacity: 1 !important;
            transform: scale(1) rotate(0deg) !important;
        }

        .fav-icon {
            position: absolute;
            bottom: 6px;
            right: 6px;
            color: #ec4899;
            font-size: 12px;
            filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35));
            display: none;
            z-index: 2;
        }

        .photo-card.is-fav .fav-icon {
            display: block;
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. HELPER: FORMAT DATE LABEL
// --------------------------------------------------------------------------
export function getDateLabel(timestamp) {
    if (!timestamp) return "Recent Photos";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const timeMs = date.getTime();
    
    const dayKey = Math.floor(timeMs / 86400000); 
    if (dateCache.has(dayKey)) return dateCache.get(dayKey);

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let label = "";
    if (date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()) {
        label = "Today";
    } else if (date.getFullYear() === yesterday.getFullYear() &&
               date.getMonth() === yesterday.getMonth() &&
               date.getDate() === yesterday.getDate()) {
        label = "Yesterday";
    } else {
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (dateCache.size > 100) dateCache.clear();
    dateCache.set(dayKey, label);
    return label;
}

// --------------------------------------------------------------------------
// 3. SMART DRAG & AUTO-SCROLL SELECTION ENGINE
// --------------------------------------------------------------------------
let isDragSelecting = false;
let dragMode = 'select';
let rangeAnchorIndex = null;
let lastTouchedIndex = null;
let autoScrollFrame = null;
let autoScrollSpeed = 0;
let currentTouchPos = { x: 0, y: 0 };
let activeCallbacks = null;

function applyRangeAction(targetIndex, callbacks, mode = 'select') {
    if (rangeAnchorIndex === null || targetIndex === null) return;

    const start = Math.min(rangeAnchorIndex, targetIndex);
    const end = Math.max(rangeAnchorIndex, targetIndex);

    const allCards = document.querySelectorAll('.photo-card');
    allCards.forEach(card => {
        const idx = parseInt(card.dataset.index, 10);
        if (!isNaN(idx)) {
            const cardId = card.dataset.id;
            if (idx >= start && idx <= end) {
                if (mode === 'select' && callbacks.selectId) {
                    callbacks.selectId(cardId, card);
                } else if (mode === 'unselect' && callbacks.deselectId) {
                    callbacks.deselectId(cardId, card);
                }
            }
        }
    });
}

function startAutoScroll() {
    if (autoScrollFrame) return;

    const autoScrollLoop = () => {
        if (!isDragSelecting) {
            stopAutoScroll();
            return;
        }

        if (autoScrollSpeed !== 0) {
            const scrollContainer = document.getElementById('scrollContainer') || window;
            if (scrollContainer.scrollBy) {
                scrollContainer.scrollBy({ top: autoScrollSpeed, behavior: 'instant' });
            } else {
                window.scrollBy({ top: autoScrollSpeed, behavior: 'instant' });
            }

            if (currentTouchPos.x && currentTouchPos.y && activeCallbacks) {
                const elementUnderTouch = document.elementFromPoint(currentTouchPos.x, currentTouchPos.y);
                const targetCard = elementUnderTouch?.closest('.photo-card');

                if (targetCard && targetCard.dataset.index !== undefined) {
                    const targetIdx = parseInt(targetCard.dataset.index, 10);
                    if (!isNaN(targetIdx) && targetIdx !== lastTouchedIndex) {
                        lastTouchedIndex = targetIdx;
                        applyRangeAction(targetIdx, activeCallbacks, dragMode);
                        if (navigator.vibrate) navigator.vibrate(10);
                    }
                }
            }
        }
        autoScrollFrame = requestAnimationFrame(autoScrollLoop);
    };

    autoScrollFrame = requestAnimationFrame(autoScrollLoop);
}

function stopAutoScroll() {
    if (autoScrollFrame) {
        cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
    }
    autoScrollSpeed = 0;
}

// --------------------------------------------------------------------------
// 4. CREATE PHOTO CARD (WITH DUAL-ENGINE AUTO-FALLBACK)
// --------------------------------------------------------------------------
export function createPhotoCard(data, globalIndex, callbacks, isNew = false) {
    const div = document.createElement('div');
    
    if (isNew) {
        div.className = `photo-card is-new-photo ${data.isFavorite ? 'is-fav' : ''}`;
        setTimeout(() => {
            div.classList.remove('is-new-photo');
            div.classList.add('photo-locked');
        }, 250);
    } else {
        div.className = `photo-card photo-locked ${data.isFavorite ? 'is-fav' : ''}`;
    }

    div.dataset.id = data.id;
    div.dataset.index = globalIndex;

    div.innerHTML = `
        <img src="${data.image}" loading="lazy" decoding="async" draggable="false" alt="Photo">
        <div class="photo-error-box">
            <i class="fa-solid fa-cloud-arrow-down"></i>
            <span>Retry</span>
        </div>
        <div class="check-circle"><i class="fa-solid fa-check"></i></div>
        <div class="fav-icon" title="Toggle Favorite"><i class="fa-solid fa-heart"></i></div>
    `;

    const imgEl = div.querySelector('img');
    const errorBox = div.querySelector('.photo-error-box');

    // 🌟 Smooth Loaded Fade-in
    imgEl.onload = () => {
        imgEl.classList.add('loaded');
        if (errorBox) errorBox.style.display = 'none';
    };

    // 🌟 SMART DUAL AUTO-FALLBACK: Cloudflare ➔ Vercel Direct /api/upload
    let retries = 0;
    imgEl.onerror = () => {
        if (retries === 0) {
            retries++;
            // Fallback: If Cloudflare failed or timed out, switch immediately to Vercel internal API
            if (data.fileId) {
                imgEl.src = `/api/upload?file_id=${encodeURIComponent(data.fileId)}`;
            } else if (data.image && data.image.includes('workers.dev')) {
                const parts = data.image.split('?');
                imgEl.src = `/api/upload?${parts[1] || ''}`;
            } else {
                const sep = data.image.includes('?') ? '&' : '?';
                imgEl.src = `${data.image}${sep}r=${Date.now()}`;
            }
        } else if (retries === 1) {
            retries++;
            setTimeout(() => {
                const sep = imgEl.src.includes('?') ? '&' : '?';
                imgEl.src = `${imgEl.src}${sep}retry=${Date.now()}`;
            }, 600);
        } else {
            imgEl.style.display = 'none';
            if (errorBox) errorBox.style.display = 'flex';
        }
    };

    if (errorBox) {
        errorBox.onclick = (e) => {
            e.stopPropagation();
            retries = 0;
            imgEl.style.display = 'block';
            errorBox.style.display = 'none';
            imgEl.src = `/api/upload?file_id=${encodeURIComponent(data.fileId || '')}&manual=${Date.now()}`;
        };
    }

    div.querySelector('.fav-icon')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks.onToggleFav) callbacks.onToggleFav(data.id, !data.isFavorite);
    });

    let pressTimer = null;

    const startPress = () => {
        pressTimer = setTimeout(() => {
            const isAlreadySelected = div.classList.contains('selected');

            if (!callbacks.getIsSelectionMode()) {
                callbacks.enterSelectionMode(data.id);
                dragMode = 'select';
            } else {
                dragMode = isAlreadySelected ? 'unselect' : 'select';
            }

            isDragSelecting = true;
            rangeAnchorIndex = globalIndex;
            lastTouchedIndex = globalIndex;
            activeCallbacks = callbacks;

            if (dragMode === 'select') {
                if (callbacks.selectId) callbacks.selectId(data.id, div);
            } else {
                if (callbacks.deselectId) callbacks.deselectId(data.id, div);
            }

            if (navigator.vibrate) navigator.vibrate(25);
        }, 280);
    };

    const cancelPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        isDragSelecting = false;
        stopAutoScroll();
    };

    div.addEventListener('touchstart', startPress, { passive: true });

    div.addEventListener('touchmove', (e) => {
        if (isDragSelecting) {
            if (e.cancelable) e.preventDefault();

            const touch = e.touches[0];
            currentTouchPos.x = touch.clientX;
            currentTouchPos.y = touch.clientY;

            const topBoundary = 120;
            const bottomBoundary = window.innerHeight - 120;

            if (touch.clientY < topBoundary) {
                const intensity = Math.min(1, (topBoundary - touch.clientY) / topBoundary);
                autoScrollSpeed = -Math.round(12 + intensity * 26);
                startAutoScroll();
            } else if (touch.clientY > bottomBoundary) {
                const intensity = Math.min(1, (touch.clientY - bottomBoundary) / 120);
                autoScrollSpeed = Math.round(12 + intensity * 26);
                startAutoScroll();
            } else {
                autoScrollSpeed = 0;
            }

            const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetCard = elementUnderTouch?.closest('.photo-card');

            if (targetCard && targetCard.dataset.index !== undefined) {
                const targetIdx = parseInt(targetCard.dataset.index, 10);
                if (!isNaN(targetIdx) && targetIdx !== lastTouchedIndex) {
                    lastTouchedIndex = targetIdx;
                    applyRangeAction(targetIdx, callbacks, dragMode);
                    if (navigator.vibrate) navigator.vibrate(10);
                }
            }
        } else {
            cancelPress();
        }
    }, { passive: false });

    div.addEventListener('touchend', cancelPress);
    div.addEventListener('touchcancel', cancelPress);

    // TAP / CLICK HANDLER
    div.addEventListener('click', () => {
        if (callbacks.getIsSelectionMode()) {
            callbacks.toggleSelection(data.id, div);
            if (navigator.vibrate) navigator.vibrate(12);
        } else {
            const currentGlobalIndex = parseInt(div.dataset.index, 10);
            callbacks.openLightbox(isNaN(currentGlobalIndex) ? globalIndex : currentGlobalIndex);
        }
    });

    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!callbacks.getIsSelectionMode()) callbacks.enterSelectionMode(data.id);
    });

    return div;
}

// --------------------------------------------------------------------------
// 5. RENDER UNIFIED ALL-PHOTOS CARD BOARD
// --------------------------------------------------------------------------
export function renderGroupedGallery(data, container, callbacks) {
    injectCardBoardStyles();
    container.innerHTML = "";

    if (!data || data.length === 0) return;

    const board = document.createElement('div');
    board.className = 'all-photos-board';
    board.innerHTML = `
        <div class="all-photos-board-header">
            <div class="all-photos-board-title">
                <i class="fa-regular fa-images" style="color:var(--accent);"></i> All Photos
            </div>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${data.length} ${data.length === 1 ? 'photo' : 'photos'}</span>
        </div>
        <div id="unifiedTimelineStream"></div>
    `;

    const stream = board.querySelector('#unifiedTimelineStream');

    const globalIndexMap = new Map();
    data.forEach((item, index) => globalIndexMap.set(item.id, index));

    const groupsByDate = new Map();
    data.forEach(item => {
        const label = getDateLabel(item.createdAt);
        if (!groupsByDate.has(label)) groupsByDate.set(label, []);
        groupsByDate.get(label).push(item);
    });

    groupsByDate.forEach((items, dateLabel) => {
        const divider = document.createElement('div');
        divider.className = 'timeline-date-divider';
        divider.innerHTML = `
            <span class="timeline-date-pill">${dateLabel}</span>
            <div class="timeline-date-line"></div>
        `;

        const grid = document.createElement('div');
        grid.className = 'timeline-grid';

        items.forEach(item => {
            const card = createPhotoCard(item, globalIndexMap.get(item.id), callbacks, false);
            grid.appendChild(card);
        });

        stream.appendChild(divider);
        stream.appendChild(grid);
    });

    container.appendChild(board);
}
