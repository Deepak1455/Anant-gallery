// ==========================================================================
// GALLERY CARD & UNIFIED ALL-PHOTOS BOARD (2GB RAM OPTIMIZED & 60FPS SMOOTH)
// ==========================================================================

const dateCache = new Map();
const BASE_SERVER_URL = "https://anant-gallery.vercel.app";

// --------------------------------------------------------------------------
// 1. DYNAMIC STYLES (VIRTUAL CONTENT-VISIBILITY & 60FPS ACCELERATION)
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
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
            animation: fadeInUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            contain: content;
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

        /* 🌟 TIMELINE DATE DIVIDERS */
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
            gap: 8px;
            margin-bottom: 6px;
        }

        @media (min-width: 600px) {
            .timeline-grid {
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                gap: 12px;
            }
        }

        /* 🌟 2GB RAM SUPERPOWER: VIRTUAL GPU-SAFE CARD (ZERO MEMORY BLOAT) */
        .photo-card {
            position: relative;
            aspect-ratio: 1 / 1;
            background: var(--bg-body, #f8fafc);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
            cursor: pointer;
            user-select: none;
            -webkit-user-drag: none;
            display: flex;
            align-items: center;
            justify-content: center;
            /* 🚀 स्क्रीन से बाहर की फोटो को रैम से मुक्त रखता है */
            content-visibility: auto;
            contain-intrinsic-size: 110px 110px;
            contain: layout style paint;
            transform: translateZ(0);
        }

        .photo-card:active {
            transform: scale(0.96);
        }

        .photo-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .photo-card img.loaded {
            opacity: 1 !important;
        }

        /* BROKEN IMAGE FALLBACK */
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
            font-size: 1.3rem;
            color: #ef4444;
            opacity: 0.7;
        }

        /* BLUE TICK SELECTION */
        .photo-card.selected::after {
            content: '';
            position: absolute;
            inset: 0;
            border: 3.5px solid #2563eb !important;
            border-radius: 14px;
            pointer-events: none;
            z-index: 3;
        }

        .check-circle {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 22px;
            height: 22px;
            background: #2563eb !important;
            border: 2px solid #ffffff !important;
            border-radius: 50%;
            color: #ffffff !important;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            opacity: 0;
            transform: scale(0);
            transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
            z-index: 4;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
        }

        .photo-card.selected .check-circle {
            opacity: 1 !important;
            transform: scale(1) !important;
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

        /* LIVE TRASH COUNTDOWN CIRCLE */
        .trash-countdown-pill {
            position: absolute;
            bottom: 6px;
            left: 6px;
            background: rgba(15, 23, 42, 0.88);
            border-radius: 20px;
            padding: 3px 7px 3px 4px;
            display: flex;
            align-items: center;
            gap: 5px;
            z-index: 3;
            pointer-events: none;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
        }

        .trash-progress-ring {
            width: 16px;
            height: 16px;
            transform: rotate(-90deg);
            display: block;
            flex-shrink: 0;
        }

        .trash-ring-bg {
            fill: none;
            stroke: rgba(255, 255, 255, 0.15);
            stroke-width: 2.8;
        }

        .trash-ring-bar {
            fill: none;
            stroke-width: 2.8;
            stroke-linecap: round;
        }

        .trash-days-text {
            font-size: 0.65rem;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            color: #ffffff;
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. HELPER: FORMAT DATE LABEL & TRASH DAYS
// --------------------------------------------------------------------------
export function getDateLabel(timestamp) {
    if (!timestamp) return "Recent Photos";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dayKey = Math.floor(date.getTime() / 86400000); 
    if (dateCache.has(dayKey)) return dateCache.get(dayKey);

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let label = "";
    if (date.toDateString() === today.toDateString()) {
        label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
        label = "Yesterday";
    } else {
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (dateCache.size > 80) dateCache.clear();
    dateCache.set(dayKey, label);
    return label;
}

function calculateRemainingTrashDays(timestamp) {
    if (!timestamp) return 30;
    const deletedTime = timestamp.seconds ? timestamp.seconds * 1000 : new Date(timestamp).getTime();
    const daysPassed = Math.floor((Date.now() - deletedTime) / (24 * 60 * 60 * 1000));
    const remaining = 30 - daysPassed;
    return remaining > 0 ? remaining : 0;
}

// --------------------------------------------------------------------------
// 3. SMART DRAG & AUTO-SCROLL SELECTION ENGINE (OPTIMIZED)
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
        if (!isNaN(idx) && idx >= start && idx <= end) {
            const cardId = card.dataset.id;
            if (mode === 'select' && callbacks.selectId) {
                callbacks.selectId(cardId, card);
            } else if (mode === 'unselect' && callbacks.deselectId) {
                callbacks.deselectId(cardId, card);
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
// 4. CREATE PHOTO CARD COMPONENT (FAST & LEAK-FREE)
// --------------------------------------------------------------------------
export function createPhotoCard(data, globalIndex, callbacks) {
    const div = document.createElement('div');
    div.className = `photo-card ${data.isFavorite ? 'is-fav' : ''}`;
    div.dataset.id = data.id;
    div.dataset.index = globalIndex;

    // 🌟 TRASH COUNTDOWN CIRCLE
    let trashBadgeHTML = '';
    if (data.isDeleted === true) {
        const daysLeft = calculateRemainingTrashDays(data.deletedAt || data.createdAt);
        const strokeColor = daysLeft < 10 ? '#ef4444' : (daysLeft <= 24 ? '#f59e0b' : '#22c55e');
        const circumference = 40.84;
        const progressFraction = Math.max(0, Math.min(1, daysLeft / 30));
        const strokeOffset = (circumference * (1 - progressFraction)).toFixed(1);

        trashBadgeHTML = `
            <div class="trash-countdown-pill" title="${daysLeft} days remaining">
                <svg class="trash-progress-ring" viewBox="0 0 16 16">
                    <circle class="trash-ring-bg" cx="8" cy="8" r="6.5"/>
                    <circle class="trash-ring-bar" cx="8" cy="8" r="6.5" 
                            stroke="${strokeColor}" 
                            stroke-dasharray="${circumference}" 
                            stroke-dashoffset="${strokeOffset}"/>
                </svg>
                <span class="trash-days-text">${daysLeft === 0 ? 'Today' : `${daysLeft}d`}</span>
            </div>
        `;
    }

    let initialImageUrl = data.image || '';
    if (initialImageUrl.startsWith('/api/')) {
        initialImageUrl = `${BASE_SERVER_URL}${initialImageUrl}`;
    }

    div.innerHTML = `
        <img src="${initialImageUrl}" loading="lazy" decoding="async" draggable="false" alt="">
        <div class="photo-error-box">
            <i class="fa-solid fa-rotate-right"></i>
            <span>Retry</span>
        </div>
        <div class="check-circle"><i class="fa-solid fa-check"></i></div>
        <div class="fav-icon" title="Toggle Favorite"><i class="fa-solid fa-heart"></i></div>
        ${trashBadgeHTML}
    `;

    const imgEl = div.querySelector('img');
    const errorBox = div.querySelector('.photo-error-box');

    imgEl.onload = () => {
        imgEl.classList.add('loaded');
        if (errorBox) errorBox.style.display = 'none';
    };

    // 🌟 SMART DUAL FALLBACK
    let retries = 0;
    imgEl.onerror = () => {
        if (retries === 0) {
            retries++;
            if (data.fileId) {
                imgEl.src = `${BASE_SERVER_URL}/api/upload?file_id=${encodeURIComponent(data.fileId)}`;
            } else if (data.image && data.image.includes('workers.dev')) {
                const parts = data.image.split('?');
                imgEl.src = `${BASE_SERVER_URL}/api/upload?${parts[1] || ''}`;
            } else {
                const sep = imgEl.src.includes('?') ? '&' : '?';
                imgEl.src = `${imgEl.src}${sep}r=${Date.now()}`;
            }
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
            imgEl.src = `${BASE_SERVER_URL}/api/upload?file_id=${encodeURIComponent(data.fileId || '')}&manual=${Date.now()}`;
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

            if (navigator.vibrate) navigator.vibrate(20);
        }, 260);
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

            const topBoundary = 110;
            const bottomBoundary = window.innerHeight - 110;

            if (touch.clientY < topBoundary) {
                autoScrollSpeed = -18;
                startAutoScroll();
            } else if (touch.clientY > bottomBoundary) {
                autoScrollSpeed = 18;
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
// 5. DOCUMENT-FRAGMENT RENDERER (FASTEST BATCH RENDER FOR 2GB RAM)
// --------------------------------------------------------------------------
export function renderGroupedGallery(data, container, callbacks) {
    injectCardBoardStyles();
    container.innerHTML = "";

    if (!data || data.length === 0) return;

    const isTrashView = data[0].isDeleted === true;
    const boardTitle = isTrashView 
        ? '<i class="fa-solid fa-trash-can" style="color:var(--danger, #ef4444);"></i> Trash Bin' 
        : '<i class="fa-regular fa-images" style="color:var(--accent);"></i> All Photos';

    const board = document.createElement('div');
    board.className = 'all-photos-board';
    board.innerHTML = `
        <div class="all-photos-board-header">
            <div class="all-photos-board-title">${boardTitle}</div>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${data.length} photos</span>
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

    // 🌟 DOCUMENT-FRAGMENT: पूरा लेआउट बैकग्राउंड में 0ms में तैयार करता है
    const fragment = document.createDocumentFragment();

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
            const card = createPhotoCard(item, globalIndexMap.get(item.id), callbacks);
            grid.appendChild(card);
        });

        fragment.appendChild(divider);
        fragment.appendChild(grid);
    });

    stream.appendChild(fragment);
    container.appendChild(board);
}
