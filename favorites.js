// ==========================================================================
// FAVORITES SCREEN MODULE - SMART MULTI-SELECT BLUE-TICK UNFAVORITE
// ==========================================================================

import { db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    updateDoc, 
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderGroupedGallery } from "./gallery-card.js";
import { openImageViewer } from "./image-viewer.js";

let unsubscribeFavs = null;

// --------------------------------------------------------------------------
// 1. DYNAMIC CSS & SMOOTH CARD LEAVING ANIMATIONS
// --------------------------------------------------------------------------
const injectFavoritesStyles = () => {
    if (document.getElementById('favorites-styles')) return;
    const style = document.createElement('style');
    style.id = 'favorites-styles';
    style.textContent = `
        .favorites-container {
            padding: 10px 10px 40px 10px;
            animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            width: 100%;
        }

        .favorites-empty {
            text-align: center;
            padding: 70px 20px;
            color: var(--text-muted, #64748b);
            animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .favorites-empty i {
            font-size: 3.5rem;
            color: #ec4899;
            margin-bottom: 16px;
            display: inline-block;
            filter: drop-shadow(0 8px 20px rgba(236, 72, 153, 0.28));
            animation: heartPulse 2s ease-in-out infinite;
        }

        @keyframes heartPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
        }

        .favorites-empty h3 {
            font-size: 1.25rem;
            color: var(--text-main, #0f172a);
            margin-bottom: 8px;
            font-weight: 700;
        }

        .favorites-empty p {
            font-size: 0.88rem;
            color: var(--text-muted, #64748b);
            max-width: 280px;
            margin: 0 auto;
            line-height: 1.45;
        }

        /* 🌟 ULTRA-SMOOTH CARD UN-FAVORITE LEAVING ANIMATION */
        .photo-card.card-leaving {
            transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
            transform: scale(0.68) translateY(-12px) !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. RENDER FAVORITES SCREEN
// --------------------------------------------------------------------------
export function renderFavoritesScreen(containerElement, currentUser, callbacks) {
    injectFavoritesStyles();

    if (!currentUser) {
        containerElement.innerHTML = `<div style="text-align:center; padding:50px; color:var(--text-muted, #64748b);">Please log in to view favorites.</div>`;
        return;
    }

    containerElement.innerHTML = `
        <div class="favorites-container" id="favoritesContent">
            <div class="grid" style="padding: 10px;">
                ${'<div class="skeleton" style="border-radius:14px; aspect-ratio:1/1;"></div>'.repeat(6)}
            </div>
        </div>
    `;

    stopFavoritesListener();

    const photosRef = collection(db, "user_photos");
    const qFavs = query(
        photosRef,
        where("uid", "==", currentUser.uid),
        where("isFavorite", "==", true)
    );

    // REALTIME FIRESTORE SNAPSHOT
    unsubscribeFavs = onSnapshot(qFavs, (snapshot) => {
        const favoritesContent = document.getElementById('favoritesContent');
        if (!favoritesContent) return;

        const rawData = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Exclude Deleted and Private items
            if (data.isDeleted !== true && data.isHidden !== true) {
                rawData.push({ id: docSnap.id, ...data });
            }
        });

        // 1. UPDATE HEADER PHOTO COUNT BADGE
        const countBadge = document.getElementById('photoCountBadge');
        if (countBadge) {
            countBadge.style.display = 'inline-block';
            countBadge.innerText = `${rawData.length} ${rawData.length === 1 ? 'favorite' : 'favorites'}`;
        }

        // 2. EMPTY STATE
        if (rawData.length === 0) {
            favoritesContent.innerHTML = `
                <div class="favorites-empty">
                    <i class="fa-solid fa-heart"></i>
                    <h3>No Favorites Yet</h3>
                    <p>Tap the heart icon on any photo in your gallery to add it to your favorites!</p>
                </div>
            `;
            return;
        }

        rawData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        // 3. SMOOTH CARD REMOVAL WITHOUT GLITCHING
        const newIds = new Set(rawData.map(item => item.id));
        const existingCards = favoritesContent.querySelectorAll('.photo-card');

        if (existingCards.length > 0) {
            let removedCount = 0;
            existingCards.forEach(card => {
                const cardId = card.dataset.id;
                if (!newIds.has(cardId)) {
                    removedCount++;
                    card.classList.add('card-leaving');
                    setTimeout(() => {
                        card.remove();
                    }, 260);
                }
            });
        }

        // 4. RENDER UNIFIED GROUPED GALLERY
        renderGroupedGallery(rawData, favoritesContent, {
            getIsSelectionMode: callbacks.getIsSelectionMode,
            enterSelectionMode: (id) => callbacks.enterSelectionMode(id, 'favorites'),
            toggleSelection: callbacks.toggleSelection,
            selectId: callbacks.selectId,
            deselectId: callbacks.deselectId,
            // 🌟 SINGLE TAP UNFAVORITE HANDLER
            onToggleFav: async (docId, newFavStatus) => {
                try {
                    const cardEl = document.querySelector(`.photo-card[data-id="${docId}"]`);
                    if (cardEl && !newFavStatus) {
                        cardEl.classList.add('card-leaving');
                    }
                    await updateDoc(doc(db, "user_photos", docId), { isFavorite: newFavStatus });
                    if (callbacks.showToast) {
                        callbacks.showToast(newFavStatus ? "Added to Favorites" : "Removed from Favorites");
                    }
                } catch (e) {
                    console.error("[Favorites] Error updating favorite status:", e);
                }
            },
            openLightbox: (index) => {
                openImageViewer(index, rawData, 'favorites');
            }
        });

    }, (err) => {
        console.error("[Favorites] Snapshot error:", err);
    });
}

// --------------------------------------------------------------------------
// 3. SMART MULTI-SELECT BLUE-TICK UNFAVORITE BATCH ENGINE
// --------------------------------------------------------------------------
export async function batchUnfavoritePhotos(photoIds, showToast, onComplete) {
    if (!photoIds || photoIds.length === 0) return;
    
    // Animate all selected blue-tick cards out simultaneously
    photoIds.forEach(id => {
        const cardEl = document.querySelector(`.photo-card[data-id="${id}"]`);
        if (cardEl) {
            cardEl.classList.add('card-leaving');
        }
    });

    // Wait 180ms for visual feedback before firing batch
    await new Promise(res => setTimeout(res, 180));

    try {
        const batch = writeBatch(db);
        photoIds.forEach(id => {
            batch.update(doc(db, "user_photos", id), { isFavorite: false });
        });
        await batch.commit();

        if (onComplete) onComplete();
        if (showToast) showToast(`Removed ${photoIds.length} photo(s) from Favorites!`);
    } catch (err) {
        if (showToast) showToast("Failed to remove from favorites!");
    }
}

// --------------------------------------------------------------------------
// 4. STOP LISTENER AND PREVENT MEMORY LEAKS
// --------------------------------------------------------------------------
export function stopFavoritesListener() {
    if (unsubscribeFavs) {
        unsubscribeFavs();
        unsubscribeFavs = null;
    }
}