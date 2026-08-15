// ==========================================================================
// 1. ALL IMPORTS
// ==========================================================================
import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    updateDoc, 
    writeBatch, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { initSettings, resetPinLock } from "./settings.js";
import { initAppScreen } from "./app-screen.js";
import { renderProfileScreen } from "./profile.js";
import { SmartExitManager } from "./exit-handler.js";
import { renderGroupedGallery } from "./gallery-card.js";
import { initImageViewer, openImageViewer, closeImageViewer, isImageViewerOpen, handleImageDeleted, shareSinglePhotoDirect } from "./image-viewer.js";
import { renderFavoritesScreen, stopFavoritesListener, batchUnfavoritePhotos } from "./favorites.js";
import { renderHiddenScreen, stopHiddenListener, lockVault } from "./hidden-photos.js";
import { 
    renderAlbumsScreen, 
    renderAlbumsMainBoard, 
    openAlbumDetail,
    stopAlbumsListener, 
    stopAlbumDetailListener, 
    showAddToAlbumModal, 
    removePhotosFromAlbum,
    showCustomDeleteModal
} from "./albums.js";
import { uploadPhotoToTelegram, uploadBatchPhotos } from "./telegram-photo.js";
import { initOfflineSync, processOfflineQueue } from "./offline-sync.js";
import { runAutoTrashPurge } from "./trash-purge.js";
import { initSplashScreen, hideSplashScreen } from "./splash-screen.js";

setPersistence(auth, browserLocalPersistence).catch(err => console.warn("Persistence Error:", err));

// ==========================================================================
// 2. INITIALIZE APP MODULES
// ==========================================================================
initSplashScreen();
initAppScreen();
initSettings();
initOfflineSync(() => currentUser, uploadPhotoToTelegram, showToast);

// ==========================================================================
// 3. STATE VARIABLES & DOM ELEMENTS
// ==========================================================================
let currentUser = null;
let isSelectionMode = false;
let selectedIds = new Set();
let galleryData = []; 
let currentView = 'photos'; 
let unsubscribe = null; 

const galleryContent = document.getElementById('galleryContent');
const selectionHeader = document.getElementById('selectionHeader');
const selectionCount = document.getElementById('selectionCount');
const selectActions = document.getElementById('selectActions');
const toast = document.getElementById('toast');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');

// ==========================================================================
// 4. GLOBAL HELPERS
// ==========================================================================
function showToast(msg) {
    if (!toast) return;
    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.top = "100px";
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        toast.style.top = "80px"; 
    }, 2800);
}

function showConfirmModal({ title, message, icon = "fa-trash", confirmText = "Confirm", onConfirm }) {
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);

    let overlay = document.getElementById("customConfirmOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "customConfirmOverlay";
        overlay.className = "album-modal-overlay";
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="album-modal-card">
            <div style="width:55px; height:55px; border-radius:50%; background:rgba(239, 68, 68, 0.12); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:1.4rem; margin:0 auto 14px auto;">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="album-modal-title">${title}</div>
            <div class="album-modal-sub">${message}</div>
            <div class="album-modal-actions">
                <button class="album-modal-btn cancel" id="confirmCancelBtn">Cancel</button>
                <button class="album-modal-btn danger" id="confirmOkBtn">${confirmText}</button>
            </div>
        </div>
    `;

    overlay.style.display = "flex";
    const close = () => { overlay.style.display = "none"; };
    document.getElementById("confirmCancelBtn").onclick = close;
    document.getElementById("confirmOkBtn").onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };
}

async function downloadPhoto(imageUrl, filename = `anant-gallery-${Date.now()}.jpg`) {
    try {
        const proxyUrl = `/api/upload?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(imageUrl, '_blank');
    }
}

async function multiDownload() {
    if (selectedIds.size === 0) return;
    showToast(`Downloading ${selectedIds.size} photos...`);
    const downloadPromises = Array.from(selectedIds).map((id, index) => {
        let item = galleryData.find(x => x.id === id);
        let imgUrl = item ? item.image : null;
        if (!imgUrl) {
            const cardImg = document.querySelector(`.photo-card[data-id="${id}"] img`);
            if (cardImg) imgUrl = cardImg.src;
        }
        if (imgUrl) return downloadPhoto(imgUrl, `anant-gallery-${Date.now()}-${index + 1}.jpg`);
        return Promise.resolve();
    });
    await Promise.all(downloadPromises);
    showToast("Photos saved successfully!");
    exitSelectionMode();
}

// 🌟 100% WORKING SELECTION MODE DIRECT SHARE (INSTANT BATCH SHARE)
async function multiSharePhotos() {
    if (selectedIds.size === 0) return;
    
    if (navigator.vibrate) navigator.vibrate(25);
    showToast(`Preparing ${selectedIds.size} photo(s) to share...`);

    try {
        const selectedItems = [];
        selectedIds.forEach(id => {
            const found = galleryData.find(x => x.id === id);
            if (found && found.image) {
                selectedItems.push(found);
            } else {
                const card = document.querySelector(`.photo-card[data-id="${id}"]`);
                const img = card ? card.querySelector('img') : null;
                if (img && img.src) {
                    selectedItems.push({ id, image: img.src });
                }
            }
        });

        if (selectedItems.length === 0) {
            showToast("No photos found to share!");
            return;
        }

        // Single Selection -> Share Directly
        if (selectedItems.length === 1) {
            await shareSinglePhotoDirect(selectedItems[0].image);
            exitSelectionMode();
            return;
        }

        // Multiple Selection -> Proxy Blob Array
        const filesToShare = [];
        for (let i = 0; i < selectedItems.length; i++) {
            try {
                const imgUrl = selectedItems[i].image;
                const proxyUrl = `/api/upload?url=${encodeURIComponent(imgUrl)}`;
                const res = await fetch(proxyUrl);
                const blob = await res.blob();
                filesToShare.push(new File([blob], `anant-gallery-${Date.now()}-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' }));
            } catch (e) {
                console.warn("Item fetch error during share:", e);
            }
        }

        if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
            await navigator.share({
                title: 'Anant Gallery',
                text: `Shared ${filesToShare.length} photos via Anant Gallery - Infinite Cloud 📸`,
                files: filesToShare
            });
        } else if (navigator.share) {
            await navigator.share({
                title: 'Anant Gallery',
                text: `Shared ${selectedItems.length} photos via Anant Gallery 📸`,
                url: selectedItems[0].image
            });
        } else {
            showToast("Direct share not supported on this device");
        }
        exitSelectionMode();
    } catch (err) {
        if (err.name !== 'AbortError') {
            showToast("Failed to share photos");
        }
    }
}

// ==========================================================================
// 5. INIT IMAGE VIEWER
// ==========================================================================
initImageViewer({
    getCurrentView: () => currentView,
    onDownload: (imageData) => {
        const url = typeof imageData === 'object' ? imageData.image : imageData;
        downloadPhoto(url, `anant-gallery-${Date.now()}.jpg`);
    },
    onAddToAlbum: (docId) => {
        showAddToAlbumModal([docId], currentUser, () => {
            handleImageDeleted(docId);
        }, showToast);
    },
    onToggleFav: async (docId, newFavStatus) => {
        try {
            await updateDoc(doc(db, "user_photos", docId), { isFavorite: newFavStatus });
            showToast(newFavStatus ? "Added to Favorites" : "Removed from Favorites");
        } catch (err) {
            showToast("Failed to update status");
        }
    },
    onToggleHide: async (docId, shouldHide) => {
        try {
            await updateDoc(doc(db, "user_photos", docId), { isHidden: shouldHide });
            showToast(shouldHide ? "Moved to Private Photos" : "Restored to Gallery");
        } catch (err) {
            showToast("Failed to update status");
        }
    },
    onMoveToTrash: (docId) => {
        showConfirmModal({
            title: "Move to Trash?",
            message: "Item will be stored in trash bin for 30 days before permanent deletion.",
            icon: "fa-trash",
            confirmText: "Move to Trash",
            onConfirm: async () => {
                await updateDoc(doc(db, "user_photos", docId), { 
                    isDeleted: true,
                    deletedAt: serverTimestamp()
                });
                showToast("Moved to Trash");
                handleImageDeleted(docId);
            }
        });
    },
    onRestore: async (docId) => {
        await updateDoc(doc(db, "user_photos", docId), { 
            isDeleted: false,
            deletedAt: null 
        });
        showToast("Restored");
        handleImageDeleted(docId);
    },
    onDeletePerm: (docId) => {
        showConfirmModal({
            title: "Delete Permanently?",
            message: "This photo will be permanently removed. This action cannot be undone.",
            icon: "fa-ban",
            confirmText: "Delete",
            onConfirm: async () => {
                await deleteDoc(doc(db, "user_photos", docId));
                showToast("Permanently Deleted");
                handleImageDeleted(docId);
            }
        });
    }
});

// ==========================================================================
// 6. AUTHENTICATION ENGINE
// ==========================================================================
let isLogin = true;
const toggleAuthBtn = document.getElementById('toggleAuth');
const authBtn = document.getElementById('authBtn');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('pass');

if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        if (authBtn) authBtn.innerText = isLogin ? "Enter Gallery" : "Create Account";
        toggleAuthBtn.innerHTML = isLogin 
            ? "New here? <span>Create Account</span>" 
            : "Have account? <span>Log In</span>";
    });
}

async function handleAuth() {
    const email = emailInput ? emailInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!email || !pass) return showToast("Enter Email and Password!");
    if (pass.length < 6) return showToast("Password must be 6+ characters!");

    if (authBtn) {
        authBtn.disabled = true;
        authBtn.innerText = isLogin ? "Logging in..." : "Creating Account...";
        authBtn.style.opacity = "0.75";
    }

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, pass);
            showToast("Welcome Back!");
        } else {
            await createUserWithEmailAndPassword(auth, email, pass);
            showToast("Account Created Successfully!");
        }
    } catch (e) {
        let msg = "Authentication failed!";
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') msg = "Incorrect Email or Password!";
        else if (e.code === 'auth/user-not-found') msg = "No account found with this email!";
        else if (e.code === 'auth/email-already-in-use') msg = "Email is already registered! Please Log In.";
        else if (e.code === 'auth/invalid-email') msg = "Please enter a valid email address!";
        else if (e.code === 'auth/network-request-failed') msg = "Network error! Check your connection.";
        showToast(msg);
    } finally {
        if (authBtn) {
            authBtn.disabled = false;
            authBtn.innerText = isLogin ? "Enter Gallery" : "Create Account";
            authBtn.style.opacity = "1";
        }
    }
}

if (authBtn) authBtn.addEventListener('click', handleAuth);
if (passInput) {
    passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAuth();
    });
}
if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && passInput) passInput.focus();
    });
}

onAuthStateChanged(auth, (user) => {
    hideSplashScreen();
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');

    if (user) {
        currentUser = user;
        if (authScreen) authScreen.style.display = 'none';
        if (appScreen) {
            appScreen.style.display = 'flex';
            appScreen.style.opacity = '1';
        }
        switchView('photos');
        processOfflineQueue(user, uploadPhotoToTelegram, showToast);
        runAutoTrashPurge(user, showToast);
    } else {
        currentUser = null;
        resetPinLock();
        lockVault();
        if (appScreen) appScreen.style.display = 'none';
        if (authScreen) {
            authScreen.style.display = 'flex';
            authScreen.style.opacity = '1';
        }
    }
});

// ==========================================================================
// 7. SWITCH VIEW FUNCTION
// ==========================================================================
function switchView(view, extraParam = null) {
    currentView = view;
    exitSelectionMode();
    
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    stopFavoritesListener();
    stopHiddenListener();
    stopAlbumsListener();
    stopAlbumDetailListener();

    ['navPhotos', 'navAlbums', 'navFavorites', 'navHidden', 'navTrash', 'navProfile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id.toLowerCase().includes(view));
    });
    
    const countBadge = document.getElementById('photoCountBadge');
    const headerActions = document.querySelector('#mainHeader .header-actions');
    const mainMenuBtn = document.getElementById('menuBtn');

    if (view === 'album_detail' && extraParam) {
        const album = extraParam;
        if (mainMenuBtn) {
            mainMenuBtn.className = "fa-solid fa-arrow-left menu-btn";
            mainMenuBtn.onclick = (e) => {
                e.stopPropagation();
                switchView('photos');
            };
        }
        document.getElementById('pageTitle').innerText = album.name;
        if (countBadge) {
            countBadge.style.display = 'inline-block';
            countBadge.innerText = 'Loading...';
        }
        if (headerActions) {
            headerActions.innerHTML = `
                <i class="fa-solid fa-trash-can" id="headerDeleteAlbumBtn" style="font-size: 1.25rem; cursor: pointer; color: var(--danger); padding: 4px;" title="Delete Album"></i>
            `;
            document.getElementById('headerDeleteAlbumBtn').onclick = () => {
                showCustomDeleteModal(album, currentUser, () => switchView('photos'), showToast);
            };
        }

        openAlbumDetail(album, galleryContent, currentUser, {
            getIsSelectionMode: () => isSelectionMode,
            enterSelectionMode,
            toggleSelection,
            selectId,
            deselectId,
            showToast,
            switchView,
            updateBadge: (count) => {
                if (countBadge) countBadge.innerText = `${count} ${count === 1 ? 'photo' : 'photos'}`;
            }
        });
        return;
    }

    if (mainMenuBtn) {
        mainMenuBtn.className = "fa-solid fa-bars menu-btn";
        mainMenuBtn.onclick = openSidebar;
    }

    if (headerActions) {
        headerActions.innerHTML = `
            <i class="fa-solid fa-cloud-arrow-up" id="forceUploadBtn" style="font-size: 1.3rem; cursor: pointer; color: var(--text-main);" title="Upload Photo"></i>
        `;
        document.getElementById('forceUploadBtn').onclick = () => {
            document.getElementById('fileInput')?.click();
        };
    }
    
    if (view === 'photos') {
        document.getElementById('pageTitle').innerText = 'My Photos';
        if (countBadge) countBadge.style.display = 'inline-block';
        loadGalleryData('photos');
    } else if (view === 'albums') {
        document.getElementById('pageTitle').innerText = 'Albums';
        if (countBadge) countBadge.style.display = 'inline-block';
        if (headerActions) headerActions.innerHTML = '';
        renderAlbumsScreen(galleryContent, currentUser, {
            getIsSelectionMode: () => isSelectionMode,
            enterSelectionMode,
            toggleSelection,
            selectId,
            deselectId,
            showToast,
            switchView
        });
    } else if (view === 'favorites') {
        document.getElementById('pageTitle').innerText = 'Favorites';
        if (countBadge) countBadge.style.display = 'inline-block';
        renderFavoritesScreen(galleryContent, currentUser, {
            getIsSelectionMode: () => isSelectionMode,
            enterSelectionMode,
            toggleSelection,
            selectId,
            deselectId,
            showToast
        });
    } else if (view === 'hidden') {
        document.getElementById('pageTitle').innerText = 'Private Photos';
        if (countBadge) countBadge.style.display = 'inline-block';
        if (headerActions) headerActions.innerHTML = '';
        renderHiddenScreen(galleryContent, currentUser, {
            getIsSelectionMode: () => isSelectionMode,
            enterSelectionMode,
            toggleSelection,
            selectId,
            deselectId
        });
    } else if (view === 'trash') {
        document.getElementById('pageTitle').innerText = 'Trash Bin';
        if (countBadge) countBadge.style.display = 'inline-block';
        if (headerActions) headerActions.innerHTML = '';
        runAutoTrashPurge(currentUser, showToast);
        loadGalleryData('trash');
    } else if (view === 'profile') {
        document.getElementById('pageTitle').innerText = 'My Profile';
        if (countBadge) countBadge.style.display = 'none';
        if (headerActions) headerActions.innerHTML = '';
        renderProfileScreen(galleryContent, currentUser);
    }

    const trashBanner = document.getElementById('trashBanner');
    if (trashBanner) trashBanner.style.display = view === 'trash' ? 'block' : 'none';
}

// ==========================================================================
// 8. SIDEBAR LISTENERS
// ==========================================================================
const openSidebar = () => {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) {
        sidebarOverlay.style.display = 'block';
        setTimeout(() => sidebarOverlay.style.opacity = '1', 10);
    }
};

const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) {
        sidebarOverlay.style.opacity = '0';
        setTimeout(() => sidebarOverlay.style.display = 'none', 250);
    }
};

if (menuBtn) menuBtn.addEventListener('click', openSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

document.getElementById('navPhotos')?.addEventListener('click', () => { switchView('photos'); closeSidebar(); });
document.getElementById('navAlbums')?.addEventListener('click', () => { switchView('albums'); closeSidebar(); });
document.getElementById('navFavorites')?.addEventListener('click', () => { switchView('favorites'); closeSidebar(); });
document.getElementById('navHidden')?.addEventListener('click', () => { switchView('hidden'); closeSidebar(); });
document.getElementById('navTrash')?.addEventListener('click', () => { switchView('trash'); closeSidebar(); });
document.getElementById('navProfile')?.addEventListener('click', () => { switchView('profile'); closeSidebar(); });

const exitManager = new SmartExitManager({
    isLightboxOpen: () => isImageViewerOpen(),
    closeLightbox: () => closeImageViewer(),
    isSelectionMode: () => isSelectionMode,
    exitSelection: () => exitSelectionMode(),
    isSidebarOpen: () => sidebar && sidebar.classList.contains('open'),
    closeSidebar,
    getCurrentView: () => currentView,
    switchView
});

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    exitManager.showExitModal();
});

// ==========================================================================
// 9. HIGH-PERFORMANCE GALLERY LOAD
// ==========================================================================
function loadGalleryData(view) {
    if (unsubscribe) unsubscribe();
    galleryContent.innerHTML = `<div class="grid" style="padding:10px;">${'<div class="skeleton" style="border-radius:12px;"></div>'.repeat(9)}</div>`;

    const isTrash = view === 'trash';
    const q = query(
        collection(db, "user_photos"), 
        where("uid", "==", currentUser.uid)
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        galleryContent.innerHTML = "";
        galleryData = [];
        const rawData = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const docIsDeleted = data.isDeleted === true;
            const docIsFavorite = data.isFavorite === true;
            const docIsHidden = data.isHidden === true;
            const hasAlbum = !!data.albumId;

            if (isTrash) {
                if (docIsDeleted) rawData.push({ id: docSnap.id, ...data });
            } else {
                if (!docIsDeleted && !docIsFavorite && !docIsHidden && !hasAlbum) {
                    rawData.push({ id: docSnap.id, ...data });
                }
            }
        });

        if (view === 'photos') {
            renderAlbumsMainBoard(galleryContent, currentUser, {
                switchView,
                showToast,
                getIsSelectionMode: () => isSelectionMode,
                getSelectedIds: () => Array.from(selectedIds),
                exitSelectionMode
            });
        }
        
        const countBadge = document.getElementById('photoCountBadge');
        if (rawData.length === 0) {
            if (countBadge) countBadge.innerText = view === 'photos' ? '0 photos' : '0 items in trash';
            const emptyNotice = document.createElement('div');
            emptyNotice.style.cssText = "text-align:center; padding:40px 20px; color:var(--text-muted, #64748b); font-size:0.9rem;";
            emptyNotice.innerHTML = isTrash ? 'Trash Bin is Empty' : 'All photos are organized in albums!';
            galleryContent.appendChild(emptyNotice);
            return;
        }

        rawData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        galleryData = rawData;
        if (countBadge) countBadge.innerText = `${rawData.length} ${rawData.length === 1 ? 'photo' : 'photos'}`;

        const photosSection = document.createElement('div');
        photosSection.id = "mainPhotosSection";
        galleryContent.appendChild(photosSection);

        renderGroupedGallery(rawData, photosSection, {
            getIsSelectionMode: () => isSelectionMode,
            enterSelectionMode,
            toggleSelection,
            selectId,
            deselectId,
            onToggleFav: async (docId, newFavStatus) => {
                await updateDoc(doc(db, "user_photos", docId), { isFavorite: newFavStatus });
            },
            openLightbox: (index) => {
                openImageViewer(index, rawData, currentView);
            }
        });
    });
}

// ==========================================================================
// 10. SELECTION MODE WITH PROMINENT FIRST-POSITION SHARE BUTTON
// ==========================================================================
function enterSelectionMode(initialId, customContext) {
    isSelectionMode = true;
    selectionHeader.style.display = 'flex';
    document.getElementById('mainHeader').style.display = 'none';

    document.getElementById('albumsMainBoard')?.classList.add('selection-active');
    if (navigator.vibrate) navigator.vibrate(30);
    
    // 🌟 1ST POSITION: SKY BLUE DIRECT SHARE ICON (#0284c7)
    if (currentView === 'photos' || customContext === 'album') {
        selectActions.innerHTML = `
            <i class="fa-solid fa-share-nodes" id="multiShareBtn" style="color: #0284c7; font-size: 1.3rem;" title="Direct Share"></i>
            <i class="fa-solid fa-download" id="multiDownloadBtn" style="color: var(--accent);" title="Save Photos"></i>
            <i class="fa-solid fa-folder-plus" id="multiAlbumBtn" style="color: #0ea5e9;" title="Move to Album"></i>
            ${customContext === 'album' ? `<i class="fa-solid fa-folder-minus" id="multiRemoveAlbumBtn" style="color: #f59e0b;" title="Remove from Album"></i>` : ''}
            <i class="fa-solid fa-heart" id="multiFavBtn" style="color: #ec4899;" title="Add Favorites"></i>
            <i class="fa-solid fa-eye-slash" id="multiHideBtn" style="color: #6366f1;" title="Move Private"></i>
            <i class="fa-solid fa-trash" id="multiTrashBtn" style="color: var(--danger);" title="Trash"></i>
        `;
        document.getElementById('multiShareBtn').onclick = multiSharePhotos;
        document.getElementById('multiDownloadBtn').onclick = multiDownload;
        document.getElementById('multiAlbumBtn').onclick = () => {
            showAddToAlbumModal(Array.from(selectedIds), currentUser, exitSelectionMode, showToast);
        };
        if (document.getElementById('multiRemoveAlbumBtn')) {
            document.getElementById('multiRemoveAlbumBtn').onclick = async () => {
                await removePhotosFromAlbum(Array.from(selectedIds), showToast);
                exitSelectionMode();
            };
        }
        document.getElementById('multiFavBtn').onclick = multiFav;
        document.getElementById('multiHideBtn').onclick = () => multiHideAction(true);
        document.getElementById('multiTrashBtn').onclick = multiMoveToTrash;

    } else if (currentView === 'favorites') {
        selectActions.innerHTML = `
            <i class="fa-solid fa-share-nodes" id="multiShareBtn" style="color: #0284c7; font-size: 1.3rem;" title="Direct Share"></i>
            <i class="fa-solid fa-download" id="multiDownloadBtn" style="color: var(--accent);" title="Save Photos"></i>
            <i class="fa-solid fa-heart-crack" id="multiUnfavBtn" style="color: #ec4899;" title="Remove from Favorites"></i>
            <i class="fa-solid fa-eye-slash" id="multiHideBtn" style="color: #6366f1;" title="Move Private"></i>
            <i class="fa-solid fa-trash" id="multiTrashBtn" style="color: var(--danger);" title="Trash"></i>
        `;
        document.getElementById('multiShareBtn').onclick = multiSharePhotos;
        document.getElementById('multiDownloadBtn').onclick = multiDownload;
        document.getElementById('multiUnfavBtn').onclick = async () => {
            const idsToUnfav = Array.from(selectedIds);
            await batchUnfavoritePhotos(idsToUnfav, showToast, exitSelectionMode);
        };
        document.getElementById('multiHideBtn').onclick = () => multiHideAction(true);
        document.getElementById('multiTrashBtn').onclick = multiMoveToTrash;

    } else if (currentView === 'hidden') {
        selectActions.innerHTML = `
            <i class="fa-solid fa-share-nodes" id="multiShareBtn" style="color: #0284c7; font-size: 1.3rem;" title="Direct Share"></i>
            <i class="fa-solid fa-eye" id="multiUnhideBtn" style="color: var(--success);" title="Unhide Photos"></i>
            <i class="fa-solid fa-trash" id="multiTrashBtn" style="color: var(--danger);" title="Trash"></i>
        `;
        document.getElementById('multiShareBtn').onclick = multiSharePhotos;
        document.getElementById('multiUnhideBtn').onclick = () => multiHideAction(false);
        document.getElementById('multiTrashBtn').onclick = multiMoveToTrash;
    } else {
        selectActions.innerHTML = `
            <i class="fa-solid fa-rotate-left" id="multiRestoreBtn" style="color: var(--success);" title="Restore Photos"></i>
            <i class="fa-solid fa-ban" id="multiDeleteBtn" style="color: var(--danger);" title="Delete Permanently"></i>
        `;
        document.getElementById('multiRestoreBtn').onclick = multiRestore;
        document.getElementById('multiDeleteBtn').onclick = multiDeletePerm;
    }

    selectId(initialId, document.querySelector(`div[data-id="${initialId}"]`));
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedIds.clear();
    document.querySelectorAll('.photo-card.selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('albumsMainBoard')?.classList.remove('selection-active');
    selectionHeader.style.display = 'none';
    document.getElementById('mainHeader').style.display = 'flex';
}

function selectId(id, element) {
    if (!element) element = document.querySelector(`div[data-id="${id}"]`);
    if (!selectedIds.has(id)) {
        selectedIds.add(id);
        if (element) element.classList.add('selected');
    }
    selectionCount.innerText = `${selectedIds.size} Selected`;
}

function deselectId(id, element) {
    if (!element) element = document.querySelector(`div[data-id="${id}"]`);
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
        if (element) element.classList.remove('selected');
    }
    selectionCount.innerText = `${selectedIds.size} Selected`;
    if (selectedIds.size === 0) exitSelectionMode();
}

function toggleSelection(id, element) {
    if (!element) element = document.querySelector(`div[data-id="${id}"]`);
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
        if (element) element.classList.remove('selected');
    } else {
        selectedIds.add(id);
        if (element) element.classList.add('selected');
    }
    selectionCount.innerText = `${selectedIds.size} Selected`;
    if (selectedIds.size === 0) exitSelectionMode();
}

document.getElementById('cancelSelect')?.addEventListener('click', exitSelectionMode);

async function batchUpdatePhotos(updateFields, toastMsg) {
    if (selectedIds.size === 0) return;
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
        batch.update(doc(db, "user_photos", id), updateFields);
    });
    await batch.commit();
    showToast(toastMsg);
    exitSelectionMode();
}

async function multiHideAction(shouldHide) {
    await batchUpdatePhotos({ isHidden: shouldHide }, shouldHide ? "Moved to Private Photos" : "Restored to Gallery");
}

function multiMoveToTrash() {
    if (selectedIds.size === 0) return;
    showConfirmModal({
        title: "Move to Trash?",
        message: `Move ${selectedIds.size} item(s) to Trash?`,
        icon: "fa-trash",
        confirmText: "Move to Trash",
        onConfirm: async () => {
            await batchUpdatePhotos({ 
                isDeleted: true, 
                deletedAt: serverTimestamp() 
            }, "Moved to Trash");
        }
    });
}

async function multiFav() {
    await batchUpdatePhotos({ isFavorite: true }, "Added to Favorites");
}

async function multiRestore() {
    await batchUpdatePhotos({ isDeleted: false, deletedAt: null }, "Restored Photos");
}

function multiDeletePerm() {
    if (selectedIds.size === 0) return;
    showConfirmModal({
        title: "Delete Permanently?",
        message: `Permanently delete ${selectedIds.size} item(s)?`,
        icon: "fa-ban",
        confirmText: "Delete Permanently",
        onConfirm: async () => {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, "user_photos", id)));
            await batch.commit();
            showToast("Permanently Deleted");
            exitSelectionMode();
        }
    });
}

// ==========================================================================
// 11. FILE UPLOAD ENGINE
// ==========================================================================
const fileInputEl = document.getElementById('fileInput');
if (fileInputEl) {
    fileInputEl.addEventListener('change', async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files).filter(f => f && (f.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(f.name)));
        if (!files.length) return showToast("Please select valid photos!");
        await uploadBatchPhotos(files, currentUser, currentView, showToast);
        e.target.value = '';
    });
}
