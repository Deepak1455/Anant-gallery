// ==========================================================================
// ALBUMS & COLLECTIONS MODULE - PRO UNLIMITED & FREE 5-ALBUMS LIMIT GUARD
// ==========================================================================

import { db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    addDoc, 
    doc, 
    updateDoc, 
    writeBatch, 
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderGroupedGallery } from "./gallery-card.js";
import { openImageViewer } from "./image-viewer.js";
import { isProUser, guardProFeature } from "./pro-manager.js";

let unsubscribeAlbums = null;
let unsubscribeAlbumDetail = null;

// 🌟 FREE TIER ALBUM LIMIT
const FREE_ALBUM_LIMIT = 5;

// --------------------------------------------------------------------------
// 1. DYNAMIC STYLES FOR ALBUMS, TOP CAROUSEL, ANIMATIONS & GLASS MODALS
// --------------------------------------------------------------------------
const injectAlbumsStyles = () => {
    if (document.getElementById('albums-styles')) return;
    const style = document.createElement('style');
    style.id = 'albums-styles';
    style.textContent = `
        /* 🌟 TOP ALBUMS CAROUSEL ON APP SCREEN */
        .albums-main-board {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0,0,0,0.08));
            border-radius: 22px;
            padding: 14px 14px 16px 14px;
            margin: 10px 10px 14px 10px;
            box-shadow: 0 4px 18px rgba(0,0,0,0.03);
            animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .albums-main-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding: 0 2px;
        }

        .albums-main-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .albums-main-scroll {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding: 2px 2px 6px 2px;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }

        .albums-main-scroll::-webkit-scrollbar { 
            display: none; 
        }

        .album-mini-card {
            min-width: 100px;
            max-width: 100px;
            background: var(--bg-body, #f8fafc);
            border: 1px solid var(--border, rgba(0,0,0,0.06));
            border-radius: 16px;
            overflow: hidden;
            cursor: pointer;
            text-align: center;
            flex-shrink: 0;
            position: relative;
            transition: transform 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .album-mini-card:active { 
            transform: scale(0.94); 
        }

        .selection-active .album-mini-card:not(.album-mini-create) {
            border: 2px dashed #0ea5e9 !important;
            box-shadow: 0 0 14px rgba(14, 165, 233, 0.28);
            animation: pulseMiniCard 1.8s infinite;
        }

        @keyframes pulseMiniCard {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
        }

        .move-indicator-badge {
            display: none;
            position: absolute;
            top: 4px;
            left: 50%;
            transform: translateX(-50%);
            background: #0ea5e9;
            color: #ffffff;
            font-size: 0.62rem;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 8px;
            z-index: 5;
            white-space: nowrap;
        }

        .selection-active .move-indicator-badge { 
            display: block; 
        }

        .album-mini-cover {
            width: 100%;
            height: 70px;
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(147, 51, 234, 0.12));
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .album-mini-cover img { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
        }

        .album-mini-cover i { 
            font-size: 1.5rem; 
            color: var(--accent, #4f46e5); 
        }

        .album-mini-name {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            padding: 6px 4px 2px 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .album-mini-count {
            font-size: 0.68rem;
            color: var(--text-muted, #64748b);
            padding-bottom: 6px;
        }

        .album-mini-create {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1.5px dashed var(--accent, #4f46e5);
            background: rgba(79, 70, 229, 0.04);
            height: 105px;
        }

        .album-mini-create i { 
            font-size: 1.4rem; 
            color: var(--accent, #4f46e5); 
            margin-bottom: 4px; 
        }

        .album-mini-create span { 
            font-size: 0.72rem; 
            font-weight: 700; 
            color: var(--accent, #4f46e5); 
        }

        /* 🌟 DEDICATED ALBUMS SCREEN */
        .albums-container {
            padding: 12px 10px 40px 10px;
            animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .albums-top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding: 0 4px;
        }

        .albums-top-title {
            font-size: 1.15rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
        }

        .btn-create-album {
            background: linear-gradient(135deg, var(--accent, #4f46e5) 0%, #9333ea 100%);
            color: #ffffff;
            border: none;
            padding: 10px 16px;
            border-radius: 14px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
            transition: transform 0.15s;
        }

        .btn-create-album:active {
            transform: scale(0.94);
        }

        .albums-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
        }

        @media (min-width: 650px) {
            .albums-grid {
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 18px;
            }
        }

        .album-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 18px;
            overflow: hidden;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .album-card:active {
            transform: scale(0.97);
        }

        .album-cover-box {
            width: 100%;
            aspect-ratio: 1 / 1;
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        .album-cover-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.35s ease;
        }

        .album-cover-icon {
            font-size: 2.8rem;
            color: var(--accent, #4f46e5);
            opacity: 0.8;
        }

        .album-info-box {
            padding: 12px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .album-name {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .album-count {
            font-size: 0.75rem;
            color: var(--text-muted, #64748b);
            margin-top: 2px;
            font-weight: 500;
        }

        .album-menu-btn {
            font-size: 1rem;
            color: var(--text-muted, #64748b);
            padding: 6px;
            border-radius: 50%;
            cursor: pointer;
        }

        /* 🌟 ULTRA-SMOOTH CARD LEAVING ANIMATION */
        .photo-card.card-leaving {
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            transform: scale(0.68) translateY(-10px) !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }

        /* 🌟 CUSTOM GLASS MODAL */
        .album-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.72);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .album-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
            width: 90%;
            max-width: 330px;
            border-radius: 24px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
        }

        .album-modal-title {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            margin-bottom: 6px;
        }

        .album-modal-sub {
            font-size: 0.85rem;
            color: var(--text-muted, #64748b);
            margin-bottom: 18px;
            line-height: 1.4;
        }

        .album-modal-input {
            width: 100%;
            padding: 12px 14px;
            border: 1.5px solid var(--border, #cbd5e1);
            background: var(--bg-body, #f8fafc);
            color: var(--text-main, #0f172a);
            border-radius: 14px;
            font-size: 0.95rem;
            margin-bottom: 18px;
            outline: none;
        }

        .album-modal-input:focus {
            border-color: var(--accent, #4f46e5);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .album-modal-actions {
            display: flex;
            gap: 10px;
        }

        .album-modal-btn {
            flex: 1;
            padding: 12px;
            border-radius: 14px;
            border: none;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: transform 0.15s;
        }

        .album-modal-btn:active {
            transform: scale(0.95);
        }

        .album-modal-btn.cancel {
            background: rgba(100, 116, 139, 0.12);
            color: var(--text-muted, #64748b);
        }

        .album-modal-btn.primary {
            background: var(--accent, #4f46e5);
            color: #ffffff;
            box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
        }

        .album-modal-btn.danger {
            background: #ef4444;
            color: #ffffff;
            box-shadow: 0 8px 18px rgba(239, 68, 68, 0.35);
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. CHECK DUPLICATE ALBUM NAME (CASE-INSENSITIVE)
// --------------------------------------------------------------------------
async function isAlbumNameDuplicate(uid, albumName, excludeAlbumId = null) {
    const qAlbums = query(collection(db, "user_albums"), where("uid", "==", uid));
    const snapshot = await getDocs(qAlbums);
    const target = albumName.trim().toLowerCase();

    for (const docSnap of snapshot.docs) {
        if (excludeAlbumId && docSnap.id === excludeAlbumId) continue;
        const existingName = (docSnap.data().name || "").trim().toLowerCase();
        if (existingName === target) return true;
    }
    return false;
}

// --------------------------------------------------------------------------
// 3. RENDER TOP ALBUMS CAROUSEL ON APP SCREEN (SMART TAP-TO-MOVE)
// --------------------------------------------------------------------------
export function renderAlbumsMainBoard(containerElement, currentUser, callbacks) {
    injectAlbumsStyles();

    let board = document.getElementById('albumsMainBoard');
    if (!board) {
        board = document.createElement('div');
        board.id = 'albumsMainBoard';
        board.className = 'albums-main-board';
        containerElement.prepend(board);
    }

    if (callbacks.getIsSelectionMode && callbacks.getIsSelectionMode()) {
        board.classList.add('selection-active');
    } else {
        board.classList.remove('selection-active');
    }

    const qAlbums = query(collection(db, "user_albums"), where("uid", "==", currentUser.uid));

    onSnapshot(qAlbums, async (snapshot) => {
        if (!document.getElementById('albumsMainBoard')) return;

        const albums = [];
        snapshot.forEach(docSnap => albums.push({ id: docSnap.id, ...docSnap.data() }));

        const photosRef = collection(db, "user_photos");
        const qPhotos = query(photosRef, where("uid", "==", currentUser.uid), where("isDeleted", "==", false));
        const photoSnap = await getDocs(qPhotos);

        const albumPhotoMap = new Map();
        photoSnap.forEach(pDoc => {
            const pData = pDoc.data();
            if (pData.albumId && !pData.isHidden && !pData.isFavorite) {
                if (!albumPhotoMap.has(pData.albumId)) albumPhotoMap.set(pData.albumId, []);
                albumPhotoMap.get(pData.albumId).push(pData.image);
            }
        });

        const isSelecting = callbacks.getIsSelectionMode && callbacks.getIsSelectionMode();

        board.innerHTML = `
            <div class="albums-main-header">
                <div class="albums-main-title">
                    <i class="fa-solid fa-folder-open" style="color:var(--accent);"></i>
                    <span>${isSelecting ? 'Tap Album to Move Photos' : 'Albums & Folders'}</span>
                </div>
                <span style="font-size:0.75rem; color:var(--accent); font-weight:600; cursor:pointer;" id="seeAllAlbumsBtn">View All</span>
            </div>
            <div class="albums-main-scroll" id="albumsMainScroll">
                <div class="album-mini-card album-mini-create" id="btnCreateMiniAlbum">
                    <i class="fa-solid fa-plus"></i>
                    <span>New Album</span>
                </div>
            </div>
        `;

        document.getElementById('seeAllAlbumsBtn')?.addEventListener('click', () => {
            if (callbacks.switchView) callbacks.switchView('albums');
        });

        document.getElementById('btnCreateMiniAlbum')?.addEventListener('click', () => {
            showCustomCreateAlbumModal(currentUser, callbacks.showToast, async (newAlbumId, albumName) => {
                if (callbacks.getIsSelectionMode && callbacks.getIsSelectionMode()) {
                    const selectedList = callbacks.getSelectedIds ? callbacks.getSelectedIds() : [];
                    if (selectedList.length > 0) {
                        await movePhotosToAlbumDirectly(selectedList, newAlbumId, albumName, callbacks);
                    }
                }
            });
        });

        const scrollContainer = document.getElementById('albumsMainScroll');

        albums.forEach(album => {
            const photosInAlbum = albumPhotoMap.get(album.id) || [];
            const photoCount = photosInAlbum.length;
            const cover = photosInAlbum[0] || null;

            const miniCard = document.createElement('div');
            miniCard.className = 'album-mini-card';
            miniCard.innerHTML = `
                <div class="move-indicator-badge">Move Here</div>
                <div class="album-mini-cover">
                    ${cover ? `<img src="${cover}" alt="${album.name}" loading="lazy">` : `<i class="fa-solid fa-folder-open"></i>`}
                </div>
                <div class="album-mini-name">${album.name}</div>
                <div class="album-mini-count">${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}</div>
            `;

            miniCard.addEventListener('click', async () => {
                if (callbacks.getIsSelectionMode && callbacks.getIsSelectionMode()) {
                    const selectedList = callbacks.getSelectedIds ? callbacks.getSelectedIds() : [];
                    if (selectedList.length > 0) {
                        await movePhotosToAlbumDirectly(selectedList, album.id, album.name, callbacks);
                    }
                } else {
                    if (callbacks.switchView) callbacks.switchView('album_detail', album);
                }
            });

            scrollContainer.appendChild(miniCard);
        });
    });
}

// --------------------------------------------------------------------------
// 4. DIRECT PHOTO TRANSFER FUNCTION (REMOVES FROM MAIN GALLERY)
// --------------------------------------------------------------------------
async function movePhotosToAlbumDirectly(photoIds, albumId, albumName, callbacks) {
    try {
        const batch = writeBatch(db);
        photoIds.forEach(id => {
            batch.update(doc(db, "user_photos", id), { albumId: albumId });
        });
        await batch.commit();

        if (callbacks.exitSelectionMode) callbacks.exitSelectionMode();
        if (callbacks.showToast) callbacks.showToast(`Moved ${photoIds.length} photo(s) to "${albumName}"!`);
    } catch (e) {
        if (callbacks.showToast) callbacks.showToast("Failed to move photos to album!");
    }
}

// --------------------------------------------------------------------------
// 5. RENDER DEDICATED ALBUMS SCREEN
// --------------------------------------------------------------------------
export function renderAlbumsScreen(containerElement, currentUser, callbacks) {
    injectAlbumsStyles();
    stopAlbumDetailListener();
    stopAlbumsListener();

    if (!currentUser) return;

    containerElement.innerHTML = `
        <div class="albums-container" id="albumsMainContent">
            <div class="albums-top-bar">
                <div class="albums-top-title">Collections & Folders</div>
                <button class="btn-create-album" id="btnNewAlbum">
                    <i class="fa-solid fa-folder-plus"></i> New Album
                </button>
            </div>
            <div class="albums-grid" id="albumsListGrid">
                ${'<div class="skeleton" style="border-radius:18px; aspect-ratio:1/1.2;"></div>'.repeat(4)}
            </div>
        </div>
    `;

    document.getElementById('btnNewAlbum')?.addEventListener('click', () => {
        showCustomCreateAlbumModal(currentUser, callbacks.showToast);
    });

    const albumsRef = collection(db, "user_albums");
    const qAlbums = query(albumsRef, where("uid", "==", currentUser.uid));

    unsubscribeAlbums = onSnapshot(qAlbums, async (snapshot) => {
        const grid = document.getElementById('albumsListGrid');
        if (!grid) return;

        const albums = [];
        snapshot.forEach(docSnap => albums.push({ id: docSnap.id, ...docSnap.data() }));

        const countBadge = document.getElementById('photoCountBadge');
        if (countBadge) {
            countBadge.style.display = 'inline-block';
            countBadge.innerText = `${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`;
        }

        if (albums.length === 0) {
            grid.parentElement.innerHTML = `
                <div class="albums-top-bar">
                    <div class="albums-top-title">Collections & Folders</div>
                    <button class="btn-create-album" id="btnNewAlbumEmpty"><i class="fa-solid fa-folder-plus"></i> New Album</button>
                </div>
                <div style="text-align:center; padding:70px 20px; color:var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size:3.5rem; color:var(--accent); margin-bottom:14px; display:inline-block;"></i>
                    <h3 style="color:var(--text-main); font-weight:700; margin-bottom:6px;">No Albums Created</h3>
                    <p style="font-size:0.88rem;">Organize your memories into custom folders like Trips, Family, Documents or Screenshots!</p>
                </div>
            `;
            document.getElementById('btnNewAlbumEmpty')?.addEventListener('click', () => {
                showCustomCreateAlbumModal(currentUser, callbacks.showToast);
            });
            return;
        }

        const photosRef = collection(db, "user_photos");
        const qPhotos = query(photosRef, where("uid", "==", currentUser.uid), where("isDeleted", "==", false));
        const photoSnap = await getDocs(qPhotos);

        const albumPhotoMap = new Map();
        photoSnap.forEach(pDoc => {
            const pData = pDoc.data();
            if (pData.albumId && !pData.isHidden && !pData.isFavorite) {
                if (!albumPhotoMap.has(pData.albumId)) albumPhotoMap.set(pData.albumId, []);
                albumPhotoMap.get(pData.albumId).push(pData.image);
            }
        });

        grid.innerHTML = "";
        albums.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        albums.forEach(album => {
            const photosInAlbum = albumPhotoMap.get(album.id) || [];
            const photoCount = photosInAlbum.length;
            const coverImage = photosInAlbum[0] || null;

            const card = document.createElement('div');
            card.className = 'album-card';
            card.dataset.id = album.id;

            card.innerHTML = `
                <div class="album-cover-box">
                    ${coverImage ? `<img src="${coverImage}" class="album-cover-img" alt="${album.name}" loading="lazy">` : `<i class="fa-solid fa-folder-open album-cover-icon"></i>`}
                </div>
                <div class="album-info-box">
                    <div style="overflow:hidden;">
                        <div class="album-name">${album.name}</div>
                        <div class="album-count">${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}</div>
                    </div>
                    <i class="fa-solid fa-ellipsis-vertical album-menu-btn" title="Album Options"></i>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.album-menu-btn')) return;
                if (callbacks.switchView) callbacks.switchView('album_detail', album);
            });

            card.querySelector('.album-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                showAlbumMenuModal(album, currentUser, callbacks.showToast, () => {
                    renderAlbumsScreen(containerElement, currentUser, callbacks);
                });
            });

            grid.appendChild(card);
        });
    });
}

// --------------------------------------------------------------------------
// 6. RENDER DEDICATED FULLSCREEN ALBUM DETAIL SCREEN
// --------------------------------------------------------------------------
export function openAlbumDetail(album, containerElement, currentUser, callbacks) {
    stopAlbumDetailListener();
    stopAlbumsListener();

    containerElement.innerHTML = `
        <div id="albumPhotosContent" style="padding: 10px 0 40px 0; width: 100%;">
            <div class="grid" style="padding: 10px;">${'<div class="skeleton" style="border-radius:12px;"></div>'.repeat(6)}</div>
        </div>
    `;

    const photosRef = collection(db, "user_photos");
    const qAlbumPhotos = query(
        photosRef,
        where("uid", "==", currentUser.uid),
        where("albumId", "==", album.id),
        where("isDeleted", "==", false)
    );

    unsubscribeAlbumDetail = onSnapshot(qAlbumPhotos, (snapshot) => {
        const content = document.getElementById('albumPhotosContent');
        if (!content) return;

        const rawData = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.isHidden !== true && data.isFavorite !== true) {
                rawData.push({ id: docSnap.id, ...data });
            }
        });

        if (callbacks.updateBadge) {
            callbacks.updateBadge(rawData.length);
        }

        if (rawData.length === 0) {
            content.innerHTML = `
                <div style="text-align:center; padding:70px 20px; color:var(--text-muted);">
                    <i class="fa-solid fa-images" style="font-size:3rem; color:var(--accent); opacity:0.6; margin-bottom:12px; display:inline-block;"></i>
                    <h3 style="color:var(--text-main); font-weight:700; margin-bottom:6px;">Album is Empty</h3>
                    <p style="font-size:0.85rem;">Select photos from your main gallery and tap this album to move them here!</p>
                </div>
            `;
            return;
        }

        rawData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const newIds = new Set(rawData.map(item => item.id));
        const existingCards = content.querySelectorAll('.photo-card');
        if (existingCards.length > 0) {
            existingCards.forEach(card => {
                const cardId = card.dataset.id;
                if (!newIds.has(cardId)) {
                    card.classList.add('card-leaving');
                    setTimeout(() => {
                        card.remove();
                    }, 250);
                }
            });
        }

        renderGroupedGallery(rawData, content, {
            getIsSelectionMode: callbacks.getIsSelectionMode,
            enterSelectionMode: (id) => callbacks.enterSelectionMode(id, 'album'),
            toggleSelection: callbacks.toggleSelection,
            selectId: callbacks.selectId,
            deselectId: callbacks.deselectId,
            onToggleFav: async (docId, newFavStatus) => {
                try {
                    await updateDoc(doc(db, "user_photos", docId), { isFavorite: newFavStatus });
                    if (callbacks.showToast) callbacks.showToast(newFavStatus ? "Added to Favorites (Moved from Album)" : "Removed from Favorites");
                } catch (err) {
                    if (callbacks.showToast) callbacks.showToast("Failed to update status");
                }
            },
            openLightbox: (index) => {
                openImageViewer(index, rawData, 'album');
            }
        });
    });
}

// --------------------------------------------------------------------------
// 7. SMART "ADD TO ALBUM" PICKER MODAL (WITH PRO LIMIT GUARD)
// --------------------------------------------------------------------------
export async function showAddToAlbumModal(photoIds, currentUser, onSuccess, showToast) {
    if (!photoIds || photoIds.length === 0) return;

    injectAlbumsStyles();

    let modal = document.getElementById('albumPickerModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'albumPickerModal';
        modal.className = 'album-modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="album-modal-card" style="max-height:80vh; display:flex; flex-direction:column; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div class="album-modal-title" style="margin:0;">Move to Album</div>
                <i class="fa-solid fa-xmark" id="closeAlbumPicker" style="cursor:pointer; font-size:1.2rem; color:var(--text-muted);"></i>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:14px;">
                <input type="text" id="newAlbumInlineInput" class="album-modal-input" placeholder="Create new album..." style="margin-bottom:0; font-size:0.88rem; padding:10px 12px;">
                <button class="album-modal-btn primary" id="btnCreateAndAdd" style="padding:10px 14px; font-size:0.85rem; flex:none;">Create</button>
            </div>
            <div id="albumPickerList" style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:8px;">
                <div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.85rem;">Loading albums...</div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    const close = () => { modal.style.display = 'none'; };
    document.getElementById('closeAlbumPicker').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    const addPhotosToAlbum = async (albumId, albumName) => {
        try {
            const batch = writeBatch(db);
            photoIds.forEach(id => {
                batch.update(doc(db, "user_photos", id), { albumId: albumId });
            });
            await batch.commit();
            close();
            if (showToast) showToast(`Moved ${photoIds.length} photo(s) to "${albumName}"!`);
            if (onSuccess) onSuccess();
        } catch (err) {
            if (showToast) showToast("Failed to move photos to album!");
        }
    };

    document.getElementById('btnCreateAndAdd').onclick = async () => {
        const input = document.getElementById('newAlbumInlineInput');
        const name = input.value.trim();
        if (!name) return;

        // 🔒 FREE LIMIT CHECK (MAX 5 ALBUMS)
        if (!isProUser()) {
            const qCount = query(collection(db, "user_albums"), where("uid", "==", currentUser.uid));
            const countSnap = await getDocs(qCount);
            if (countSnap.size >= FREE_ALBUM_LIMIT) {
                close();
                guardProFeature("Create Unlimited Custom Albums with Anant Pro");
                return;
            }
        }

        const isDuplicate = await isAlbumNameDuplicate(currentUser.uid, name);
        if (isDuplicate) {
            if (showToast) showToast(`Album "${name}" already exists! Choose another name.`);
            return;
        }

        try {
            const newAlbumRef = await addDoc(collection(db, "user_albums"), {
                uid: currentUser.uid,
                name: name,
                createdAt: serverTimestamp()
            });
            await addPhotosToAlbum(newAlbumRef.id, name);
        } catch (err) {
            if (showToast) showToast("Failed to create album!");
        }
    };

    const qAlbums = query(collection(db, "user_albums"), where("uid", "==", currentUser.uid));
    const snap = await getDocs(qAlbums);
    const pickerList = document.getElementById('albumPickerList');
    pickerList.innerHTML = "";

    if (snap.empty) {
        pickerList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.85rem;">No albums yet. Type name above to create one!</div>`;
        return;
    }

    snap.forEach(docSnap => {
        const alb = { id: docSnap.id, ...docSnap.data() };
        const item = document.createElement('div');
        item.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--bg-body); border-radius:12px; cursor:pointer; border:1px solid var(--border);";
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-folder-open" style="color:var(--accent); font-size:1.15rem;"></i>
                <span style="font-weight:600; font-size:0.9rem; color:var(--text-main);">${alb.name}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.75rem;"></i>
        `;
        item.onclick = () => addPhotosToAlbum(alb.id, alb.name);
        pickerList.appendChild(item);
    });
}

// --------------------------------------------------------------------------
// 8. CUSTOM CREATE ALBUM MODAL (FREE MAX 5 & PRO UNLIMITED GUARD)
// --------------------------------------------------------------------------
export async function showCustomCreateAlbumModal(currentUser, showToast, onSuccess) {
    // 🔒 1. FREE USER ALBUM LIMIT CHECK (MAX 5 ALBUMS)
    if (!isProUser()) {
        try {
            const qCount = query(collection(db, "user_albums"), where("uid", "==", currentUser.uid));
            const countSnap = await getDocs(qCount);

            if (countSnap.size >= FREE_ALBUM_LIMIT) {
                guardProFeature("Create Unlimited Custom Collections with Anant Pro", () => {
                    showCustomCreateAlbumModal(currentUser, showToast, onSuccess);
                });
                return;
            }
        } catch (e) {
            console.warn("Album check error:", e);
        }
    }

    let overlay = document.createElement('div');
    overlay.className = 'album-modal-overlay';
    overlay.innerHTML = `
        <div class="album-modal-card">
            <div class="album-modal-title">New Album</div>
            <div class="album-modal-sub">Enter unique name for your folder</div>
            <input type="text" id="customAlbumNameInput" class="album-modal-input" placeholder="e.g. Trips, Family, Documents" autocomplete="off">
            <div class="album-modal-actions">
                <button class="album-modal-btn cancel" id="cancelCreateAlbum">Cancel</button>
                <button class="album-modal-btn primary" id="confirmCreateAlbum">Create</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#customAlbumNameInput');
    setTimeout(() => input.focus(), 100);

    const close = () => overlay.remove();
    overlay.querySelector('#cancelCreateAlbum').onclick = close;

    overlay.querySelector('#confirmCreateAlbum').onclick = async () => {
        const name = input.value.trim();
        if (!name) return;

        const isDuplicate = await isAlbumNameDuplicate(currentUser.uid, name);
        if (isDuplicate) {
            if (showToast) showToast(`Album "${name}" already exists! Choose another name.`);
            return;
        }

        try {
            const docRef = await addDoc(collection(db, "user_albums"), {
                uid: currentUser.uid,
                name: name,
                createdAt: serverTimestamp()
            });
            close();
            if (showToast) showToast(`Album "${name}" created!`);
            if (onSuccess) onSuccess(docRef.id, name);
        } catch (e) {
            if (showToast) showToast("Error creating album!");
        }
    };
}

function showAlbumMenuModal(album, currentUser, showToast, onRefresh) {
    let overlay = document.createElement('div');
    overlay.className = 'album-modal-overlay';
    overlay.innerHTML = `
        <div class="album-modal-card">
            <div class="album-modal-title">${album.name}</div>
            <div class="album-modal-sub">Choose album action</div>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                <button class="album-modal-btn primary" id="btnMenuRename" style="padding:14px;"><i class="fa-solid fa-pen" style="margin-right:8px;"></i> Rename Album</button>
                <button class="album-modal-btn danger" id="btnMenuDelete" style="padding:14px;"><i class="fa-solid fa-trash" style="margin-right:8px;"></i> Delete Album</button>
                <button class="album-modal-btn cancel" id="btnMenuCancel" style="padding:12px;">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();

    overlay.querySelector('#btnMenuCancel').onclick = close;

    overlay.querySelector('#btnMenuRename').onclick = () => {
        close();
        showCustomRenameModal(album, currentUser, showToast, onRefresh);
    };

    overlay.querySelector('#btnMenuDelete').onclick = () => {
        close();
        showCustomDeleteModal(album, currentUser, onRefresh, showToast);
    };
}

function showCustomRenameModal(album, currentUser, showToast, onRefresh) {
    let overlay = document.createElement('div');
    overlay.className = 'album-modal-overlay';
    overlay.innerHTML = `
        <div class="album-modal-card">
            <div class="album-modal-title">Rename Album</div>
            <div class="album-modal-sub">Enter a new name for "${album.name}"</div>
            <input type="text" id="customRenameInput" class="album-modal-input" value="${album.name}">
            <div class="album-modal-actions">
                <button class="album-modal-btn cancel" id="cancelRename">Cancel</button>
                <button class="album-modal-btn primary" id="confirmRename">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#customRenameInput');
    setTimeout(() => input.focus(), 100);

    const close = () => overlay.remove();
    overlay.querySelector('#cancelRename').onclick = close;

    overlay.querySelector('#confirmRename').onclick = async () => {
        const newName = input.value.trim();
        if (!newName || newName === album.name) return close();

        const isDuplicate = await isAlbumNameDuplicate(currentUser.uid, newName, album.id);
        if (isDuplicate) {
            if (showToast) showToast(`Album "${newName}" already exists!`);
            return;
        }

        try {
            await updateDoc(doc(db, "user_albums", album.id), { name: newName });
            close();
            if (showToast) showToast("Album renamed!");
            if (onRefresh) onRefresh();
        } catch (e) {
            if (showToast) showToast("Rename failed!");
        }
    };
}

export function showCustomDeleteModal(album, currentUser, onSuccess, showToast) {
    let overlay = document.createElement('div');
    overlay.className = 'album-modal-overlay';
    overlay.innerHTML = `
        <div class="album-modal-card">
            <div style="width:55px; height:55px; border-radius:50%; background:rgba(239, 68, 68, 0.12); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:1.4rem; margin:0 auto 14px auto;">
                <i class="fa-solid fa-trash-can"></i>
            </div>
            <div class="album-modal-title">Delete Album?</div>
            <div class="album-modal-sub">Delete "${album.name}"? Photos will NOT be deleted, they will return to your All Photos gallery.</div>
            <div class="album-modal-actions">
                <button class="album-modal-btn cancel" id="cancelDeleteAlbum">Cancel</button>
                <button class="album-modal-btn danger" id="confirmDeleteAlbum">Delete</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#cancelDeleteAlbum').onclick = close;

    overlay.querySelector('#confirmDeleteAlbum').onclick = async () => {
        try {
            const qPhotos = query(collection(db, "user_photos"), where("uid", "==", currentUser.uid), where("albumId", "==", album.id));
            const snap = await getDocs(qPhotos);
            const batch = writeBatch(db);
            snap.forEach(pDoc => batch.update(doc(db, "user_photos", pDoc.id), { albumId: null }));
            batch.delete(doc(db, "user_albums", album.id));
            await batch.commit();

            close();
            if (showToast) showToast(`Album "${album.name}" deleted! Photos restored to Gallery.`);
            if (onSuccess) onSuccess();
        } catch (err) {
            if (showToast) showToast("Failed to delete album!");
        }
    };
}

// --------------------------------------------------------------------------
// 9. REMOVE PHOTOS FROM ALBUM (RESTORES TO ALL PHOTOS)
// --------------------------------------------------------------------------
export async function removePhotosFromAlbum(photoIds, showToast) {
    if (!photoIds || photoIds.length === 0) return;
    try {
        const batch = writeBatch(db);
        photoIds.forEach(id => batch.update(doc(db, "user_photos", id), { albumId: null }));
        await batch.commit();
        if (showToast) showToast("Photos returned to All Photos!");
    } catch (err) {
        if (showToast) showToast("Failed to remove from album!");
    }
}

export function stopAlbumsListener() {
    if (unsubscribeAlbums) {
        unsubscribeAlbums();
        unsubscribeAlbums = null;
    }
}

export function stopAlbumDetailListener() {
    if (unsubscribeAlbumDetail) {
        unsubscribeAlbumDetail();
        unsubscribeAlbumDetail = null;
    }
}
