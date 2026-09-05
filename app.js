// ==========================================================================
// ANANT GALLERY - MASTER CONTROLLER & PRO SUBSCRIPTION ENGINE (APP.JS)
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    sendPasswordResetEmail, 
    GoogleAuthProvider, 
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
    setDoc,
    updateDoc, 
    writeBatch, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { initSettings, resetPinLock, checkAppPinLock } from "./settings.js";
import { initAppScreen, checkAndRenderPWAInstallBanner } from "./app-screen.js";
import { renderProfileScreen, stopProfileListener } from "./profile.js";
import { SmartExitManager } from "./exit-handler.js";
import { renderGroupedGallery } from "./gallery-card.js";
import { 
    initImageViewer, 
    openImageViewer, 
    closeImageViewer, 
    isImageViewerOpen, 
    handleImageDeleted 
} from "./image-viewer.js";
import { 
    renderFavoritesScreen, 
    stopFavoritesListener, 
    batchUnfavoritePhotos 
} from "./favorites.js";
import { 
    renderHiddenScreen, 
    stopHiddenListener, 
    lockVault 
} from "./hidden-photos.js";
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
import { initProManager, showProPaywallModal, isProUser, guardProFeature, setPlayStoreReviewMode } from "./pro-manager.js";

// 🌟 3 SUPER ADMIN EMAILS
const SUPER_ADMIN_EMAILS = [
    "dt8484970@gmail.com",
    "dt4527129@gmail.com",
    "anantgalleryogr@gmail.com"
];

setPersistence(auth, browserLocalPersistence).catch(() => {});

// --------------------------------------------------------------------------
// 1. INITIALIZE APP MODULES
// --------------------------------------------------------------------------
initSplashScreen();
initAppScreen();
initSettings();
initOfflineSync(() => currentUser, uploadPhotoToTelegram, showToast);

// --------------------------------------------------------------------------
// 2. STATE VARIABLES & DOM ELEMENTS CACHE
// --------------------------------------------------------------------------
let currentUser = null;
let isSelectionMode = false;
let selectedIds = new Set();
let galleryData = []; 
let currentView = 'photos'; 
let unsubscribe = null; 
let unsubscribeGlobalConfig = null;
let toastTimer = null;
let galleryRenderTimer = null;
let isUploadAllowedGlobally = true;

const galleryContent = document.getElementById('galleryContent');
const selectionHeader = document.getElementById('selectionHeader');
const selectionCount = document.getElementById('selectionCount');
const selectActions = document.getElementById('selectActions');
const toast = document.getElementById('toast');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);

    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.top = "95px";

    toastTimer = setTimeout(() => { 
        toast.style.opacity = '0'; 
        toast.style.top = "75px"; 
    }, 3000);
}

function showConfirmModal({ title, message, icon = "fa-trash", confirmText = "Confirm", onConfirm }) {
    if (navigator.vibrate) navigator.vibrate([25, 35, 25]);

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

// --------------------------------------------------------------------------
// 🌟 HELPER: SYNC USER ACCOUNT TO FIRESTORE (ADMIN PANEL VISIBILITY)
// --------------------------------------------------------------------------
async function syncUserToFirestore(user) {
    if (!user) return;
    try {
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : "User"),
            photoURL: user.photoURL || "",
            lastLoginAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.warn("[User Sync Note]:", e);
    }
}

// --------------------------------------------------------------------------
// 3. REALTIME ADMIN REMOTE CONTROL & MAINTENANCE ENGINE
// --------------------------------------------------------------------------
function setupGlobalAdminListener() {
    if (unsubscribeGlobalConfig) unsubscribeGlobalConfig();

    const configDoc = doc(db, "app_config", "global_settings");

    unsubscribeGlobalConfig = onSnapshot(configDoc, (snap) => {
        if (!snap.exists()) return;
        const config = snap.data();

        // 🛡️ 1. Realtime Play Store Review Mode Sync
        setPlayStoreReviewMode(config.playStoreReviewMode !== false);

        // 2. Maintenance Mode
        let maintOverlay = document.getElementById("appMaintenanceOverlay");
        if (config.maintenanceMode) {
            if (!maintOverlay) {
                maintOverlay = document.createElement("div");
                maintOverlay.id = "appMaintenanceOverlay";
                maintOverlay.style.cssText = `
                    position: fixed; inset: 0; z-index: 999999;
                    background: linear-gradient(135deg, #090d16 0%, #0f172a 100%);
                    color: #ffffff; display: flex; flex-direction: column;
                    align-items: center; justify-content: center; text-align: center;
                    padding: 24px; font-family: 'Outfit', sans-serif;
                `;
                maintOverlay.innerHTML = `
                    <div style="width:75px; height:75px; border-radius:50%; background:rgba(245, 158, 11, 0.15); color:#f59e0b; display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin-bottom:20px; box-shadow:0 0 25px rgba(245,158,11,0.2);">
                        <i class="fa-solid fa-wrench"></i>
                    </div>
                    <h2 style="font-size:1.6rem; font-weight:800; margin-bottom:8px;">Under Scheduled Maintenance</h2>
                    <p style="font-size:0.9rem; color:#94a3b8; max-width:320px; line-height:1.5;">
                        Anant Infinite Cloud servers are currently undergoing maintenance for speed upgrades. We'll be back shortly!
                    </p>
                `;
                document.body.appendChild(maintOverlay);
            }
        } else if (maintOverlay) {
            maintOverlay.remove();
        }

        // 3. Upload Kill-Switch
        isUploadAllowedGlobally = config.allowUploads !== false;

        // 4. Global Broadcast Banner
        let banner = document.getElementById("adminBroadcastBanner");
        if (config.broadcastNotice && config.broadcastNotice.trim()) {
            if (!banner) {
                banner = document.createElement("div");
                banner.id = "adminBroadcastBanner";
                banner.style.cssText = `
                    background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
                    color: #ffffff; padding: 9px 16px; text-align: center;
                    font-size: 0.82rem; font-weight: 700; position: sticky;
                    top: 70px; z-index: 49; box-shadow: 0 4px 14px rgba(79,70,229,0.3);
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    animation: fadeInUp 0.3s ease-out;
                `;
                const scrollCont = document.getElementById("scrollContainer");
                if (scrollCont) {
                    scrollCont.parentElement.insertBefore(banner, scrollCont);
                } else {
                    document.body.prepend(banner);
                }
            }
            banner.innerHTML = `<i class="fa-solid fa-bullhorn" style="color:#fbbf24;"></i> <span>${config.broadcastNotice}</span>`;
        } else if (banner) {
            banner.remove();
        }
    });
}

// --------------------------------------------------------------------------
// 4. BULLETPROOF PHOTO DOWNLOAD ENGINE
// --------------------------------------------------------------------------
function getExtensionFromMime(mimeType) {
    if (!mimeType) return 'jpg';
    const type = mimeType.toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('heic') || type.includes('heif')) return 'heic';
    return 'jpg';
}

async function downloadPhoto(imageUrl, customFilename = null) {
    try {
        let downloadUrl = imageUrl;

        if (imageUrl.startsWith('/api/') || imageUrl.includes('workers.dev')) {
            downloadUrl = imageUrl.includes('?') ? `${imageUrl}&dl=1` : `${imageUrl}?dl=1`;
        } else if (!imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
            downloadUrl = `/api/upload?url=${encodeURIComponent(imageUrl)}&dl=1`;
        }

        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Network fetch failed");

        const blob = await response.blob();
        const ext = getExtensionFromMime(blob.type);
        const finalFilename = customFilename ? (customFilename.endsWith(`.${ext}`) ? customFilename : `${customFilename}.${ext}`) : `anant-gallery-${Date.now()}.${ext}`;

        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = blobUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }, 3000);

        return true;
    } catch (e) {
        console.warn("Direct blob save failed, using fallback:", e);
        const fallbackUrl = imageUrl.includes('?') ? `${imageUrl}&dl=1` : `${imageUrl}?dl=1`;
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.download = `anant-gallery-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 1000);
        return true;
    }
}

async function multiDownload() {
    if (selectedIds.size === 0) return;

    if (!isProUser() && selectedIds.size > 5) {
        guardProFeature("Bulk Download 5+ Photos with Anant Pro", () => {
            multiDownload();
        });
        return;
    }

    const idsArray = Array.from(selectedIds);
    showToast(`Saving ${idsArray.length} photo(s) to phone gallery...`);

    let downloaded = 0;
    for (let i = 0; i < idsArray.length; i++) {
        const id = idsArray[i];
        const item = galleryData.find(x => x.id === id);
        if (item && item.image) {
            await downloadPhoto(item.image, `anant-gallery-${Date.now()}-${i + 1}`);
            downloaded++;
            await new Promise(res => setTimeout(res, 250));
        }
    }

    showToast(`Saved ${downloaded} photo(s) to Gallery! ⚡`);
    exitSelectionMode();
}

// --------------------------------------------------------------------------
// 5. INIT IMAGE VIEWER (LIGHTBOX)
// --------------------------------------------------------------------------
initImageViewer({
    getCurrentView: () => currentView,
    onDownload: (imageData) => {
        const url = typeof imageData === 'object' ? imageData.image : imageData;
        downloadPhoto(url);
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

// --------------------------------------------------------------------------
// 6. AUTH CONTROLLER (GOOGLE SIGN-IN & 30s COOLDOWN RESET)
// --------------------------------------------------------------------------
let isLogin = true;
let isResetCooldown = false;

const toggleAuthBtn = document.getElementById('toggleAuth');
const forgotPassBtn = document.getElementById('forgotPassBtn');
const authBtn = document.getElementById('authBtn');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('pass');

if (toggleAuthBtn) {
    toggleAuthBtn.onclick = (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        if (authBtn) authBtn.innerText = isLogin ? "Enter Gallery" : "Create Account";
        toggleAuthBtn.innerHTML = isLogin 
            ? "New here? <span>Create Account</span>" 
            : "Have account? <span>Log In</span>";
        if (forgotPassBtn) forgotPassBtn.style.display = isLogin ? 'block' : 'none';
    };
}

if (forgotPassBtn) {
    forgotPassBtn.onclick = async () => {
        if (isResetCooldown) {
            return showToast("⏳ Please wait 30s before requesting another link.");
        }

        const email = emailInput ? emailInput.value.trim() : '';
        if (!email) {
            if (emailInput) emailInput.focus();
            return showToast("⚠️ Enter your email address above first!");
        }

        forgotPassBtn.style.opacity = '0.6';
        forgotPassBtn.innerText = "Sending Link...";

        try {
            await sendPasswordResetEmail(auth, email);
            if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
            
            showToast("✅ Password reset link sent directly to your Inbox!");
            
            isResetCooldown = true;
            let cooldownSeconds = 30;
            const timer = setInterval(() => {
                cooldownSeconds--;
                if (cooldownSeconds <= 0) {
                    clearInterval(timer);
                    isResetCooldown = false;
                    forgotPassBtn.style.opacity = '1';
                    forgotPassBtn.innerText = "Forgot Password?";
                } else {
                    forgotPassBtn.innerText = `Resend in ${cooldownSeconds}s`;
                }
            }, 1000);

        } catch (err) {
            forgotPassBtn.style.opacity = '1';
            forgotPassBtn.innerText = "Forgot Password?";
            
            if (err.code === 'auth/user-not-found') {
                showToast("❌ No account found with this email!");
            } else if (err.code === 'auth/invalid-email') {
                showToast("❌ Invalid email address!");
            } else {
                showToast("⚠️ Could not send reset link. Try again later.");
            }
        }
    };
}

async function handleAuth() {
    const email = emailInput ? emailInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!email || !pass) return showToast("Enter Email and Password!");
    if (pass.length < 6) return showToast("Password must be 6+ characters!");

    if (authBtn) {
        authBtn.disabled = true;
        authBtn.innerText = isLogin ? "Logging in..." : "Creating Account...";
    }

    try {
        let userCredential;
        if (isLogin) {
            userCredential = await signInWithEmailAndPassword(auth, email, pass);
            showToast("Welcome Back!");
        } else {
            userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            showToast("Account Created Successfully!");
        }
        await syncUserToFirestore(userCredential.user);
    } catch (e) {
        let msg = "Authentication failed!";
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') msg = "Incorrect Email or Password!";
        else if (e.code === 'auth/user-not-found') msg = "No account found with this email!";
        else if (e.code === 'auth/email-already-in-use') msg = "Email already registered! Please Log In.";
        showToast(msg);
    } finally {
        if (authBtn) {
            authBtn.disabled = false;
            authBtn.innerText = isLogin ? "Enter Gallery" : "Create Account";
        }
    }
}

async function handleGoogleAuth() {
    if (googleAuthBtn) {
        googleAuthBtn.disabled = true;
        googleAuthBtn.style.opacity = '0.75';
    }

    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        if (navigator.vibrate) navigator.vibrate(15);
        showToast("Connecting securely to Google...");
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        await syncUserToFirestore(user);
        showToast(`Welcome, ${user.displayName || 'User'}! ⚡`);
    } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user') {
            showToast("Google Sign-In cancelled or failed.");
        }
    } finally {
        if (googleAuthBtn) {
            googleAuthBtn.disabled = false;
            googleAuthBtn.style.opacity = '1';
        }
    }
}

if (authBtn) authBtn.onclick = handleAuth;
if (googleAuthBtn) googleAuthBtn.onclick = handleGoogleAuth;

if (passInput) passInput.onkeydown = (e) => { if (e.key === 'Enter') handleAuth(); };
if (emailInput) emailInput.onkeydown = (e) => { if (e.key === 'Enter' && passInput) passInput.focus(); };

// --------------------------------------------------------------------------
// 7. AUTH STATE CHANGED & SMART SYNC
// --------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    hideSplashScreen();
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');

    if (user) {
        currentUser = user;
        if (authScreen) authScreen.style.display = 'none';
        if (appScreen) {
            appScreen.style.display = 'flex';
            requestAnimationFrame(() => appScreen.style.opacity = '1');
        }
        
        await syncUserToFirestore(user);
        initProManager(user);
        setupSidebarLinks(user);
        setupFileInput(); // 🌟 Ensure File Input is always ready

        setupGlobalAdminListener();
        checkAppPinLock();
        switchView('photos');
        processOfflineQueue(user, uploadPhotoToTelegram, showToast);
        runAutoTrashPurge(user, showToast);
    } else {
        currentUser = null;
        initProManager(null);
        resetPinLock();
        lockVault();
        if (appScreen) appScreen.style.display = 'none';
        if (authScreen) {
            authScreen.style.display = 'flex';
            requestAnimationFrame(() => authScreen.style.opacity = '1');
        }
    }
});

function setupSidebarLinks(user) {
    const existingPro = document.getElementById('sidebarProBadge');
    if (existingPro) existingPro.remove();

    const navProfile = document.getElementById('navProfile');
    if (navProfile && navProfile.parentElement) {
        const proItem = document.createElement('div');
        proItem.id = 'sidebarProBadge';
        proItem.className = 'sb-item';
        
        const isPro = isProUser();
        proItem.style.cssText = 'color: #f59e0b; font-weight: 800;';
        proItem.innerHTML = `<i class="fa-solid fa-crown"></i> ${isPro ? 'Anant Pro Active' : 'Upgrade to Pro'}`;
        
        proItem.onclick = () => {
            closeSidebar();
            if (!isPro) {
                showProPaywallModal("Get Unlimited 4K Cloud Power");
            } else {
                switchView('profile');
            }
        };
        navProfile.parentElement.insertBefore(proItem, navProfile);
    }

    const existingAdmin = document.getElementById('navAdminPortal');
    if (existingAdmin) existingAdmin.remove();

    if (user && user.email && (SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) || user.email.endsWith('@admin.com'))) {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn && logoutBtn.parentElement) {
            const adminItem = document.createElement('div');
            adminItem.id = 'navAdminPortal';
            adminItem.className = 'sb-item';
            adminItem.style.cssText = 'color: #f59e0b; margin-top: auto; font-weight: 700;';
            adminItem.innerHTML = `<i class="fa-solid fa-sliders"></i> Admin Center`;
            adminItem.onclick = () => { window.location.href = 'admin.html'; };
            logoutBtn.parentElement.insertBefore(adminItem, logoutBtn);
        }
    }
}

window.addEventListener('anant_pro_updated', () => {
    if (currentUser) {
        setupSidebarLinks(currentUser);
    }
});

// --------------------------------------------------------------------------
// 8. ULTRA-SMOOTH VIEW SWITCHER
// --------------------------------------------------------------------------
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
    stopProfileListener();

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
            if (!isUploadAllowedGlobally) {
                return showToast("Uploads are temporarily paused by Admin!");
            }
            if (navigator.vibrate) navigator.vibrate(15);
            const input = getOrCreateFileInput();
            input.click();
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

    checkAndRenderPWAInstallBanner();
}

// --------------------------------------------------------------------------
// 9. SIDEBAR CONTROLLER
// --------------------------------------------------------------------------
const openSidebar = () => {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) {
        sidebarOverlay.style.display = 'block';
        requestAnimationFrame(() => sidebarOverlay.style.opacity = '1');
    }
};

const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) {
        sidebarOverlay.style.opacity = '0';
        setTimeout(() => sidebarOverlay.style.display = 'none', 250);
    }
};

if (menuBtn) menuBtn.onclick = openSidebar;
if (sidebarOverlay) sidebarOverlay.onclick = closeSidebar;

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

// --------------------------------------------------------------------------
// 10. GALLERY DATA STREAM
// --------------------------------------------------------------------------
function loadGalleryData(view) {
    if (unsubscribe) unsubscribe();
    galleryContent.innerHTML = `<div class="grid" style="padding:10px;">${'<div class="skeleton" style="border-radius:12px;"></div>'.repeat(9)}</div>`;

    const isTrash = view === 'trash';
    const q = query(
        collection(db, "user_photos"), 
        where("uid", "==", currentUser.uid)
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        if (galleryRenderTimer) clearTimeout(galleryRenderTimer);

        galleryRenderTimer = setTimeout(() => {
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
        }, 120);
    });
}

// --------------------------------------------------------------------------
// 11. SMART SELECTION MODE
// --------------------------------------------------------------------------
function enterSelectionMode(initialId, customContext) {
    isSelectionMode = true;
    selectionHeader.style.display = 'flex';
    document.getElementById('mainHeader').style.display = 'none';

    document.getElementById('albumsMainBoard')?.classList.add('selection-active');
    if (navigator.vibrate) navigator.vibrate(25);
    
    if (currentView === 'photos' || customContext === 'album') {
        selectActions.innerHTML = `
            <i class="fa-solid fa-download" id="multiDownloadBtn" style="color: var(--accent);" title="Save to Gallery"></i>
            <i class="fa-solid fa-folder-plus" id="multiAlbumBtn" style="color: #0ea5e9;" title="Move to Album"></i>
            ${customContext === 'album' ? `<i class="fa-solid fa-folder-minus" id="multiRemoveAlbumBtn" style="color: #f59e0b;" title="Remove from Album"></i>` : ''}
            <i class="fa-solid fa-heart" id="multiFavBtn" style="color: #ec4899;" title="Add Favorites"></i>
            <i class="fa-solid fa-eye-slash" id="multiHideBtn" style="color: #6366f1;" title="Move Private"></i>
            <i class="fa-solid fa-trash" id="multiTrashBtn" style="color: var(--danger);" title="Trash"></i>
        `;
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
            <i class="fa-solid fa-download" id="multiDownloadBtn" style="color: var(--accent);" title="Save to Gallery"></i>
            <i class="fa-solid fa-heart-crack" id="multiUnfavBtn" style="color: #ec4899;" title="Remove from Favorites"></i>
            <i class="fa-solid fa-eye-slash" id="multiHideBtn" style="color: #6366f1;" title="Move Private"></i>
            <i class="fa-solid fa-trash" id="multiTrashBtn" style="color: var(--danger);" title="Trash"></i>
        `;
        document.getElementById('multiDownloadBtn').onclick = multiDownload;
        document.getElementById('multiUnfavBtn').onclick = async () => {
            const idsToUnfav = Array.from(selectedIds);
            await batchUnfavoritePhotos(idsToUnfav, showToast, exitSelectionMode);
        };
        document.getElementById('multiHideBtn').onclick = () => multiHideAction(true);
        document.getElementById('multiTrashBtn').onclick = multiMoveToTrash;

    } else if (currentView === 'hidden') {
        selectActions.innerHTML = `
            <i class="fa-solid fa-eye" id="multiUnhideBtn" style="color: var(--success);" title="Unhide Photos"></i>
            <i class="fa-solid fa-download" id="multiDownloadBtn" style="color: var(--accent);" title="Save to Gallery"></i>
            <i class="fa-solid fa-trash" id="multiTrashBtn" style="color: var(--danger);" title="Trash"></i>
        `;
        document.getElementById('multiDownloadBtn').onclick = multiDownload;
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

// --------------------------------------------------------------------------
// 🌟 SMART SHARE-TARGET RECEIVER & FILE UPLOAD ENGINE (AUTO-SYNC FIX)
// --------------------------------------------------------------------------
function getOrCreateFileInput() {
    let input = document.getElementById('fileInput');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'fileInput';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.cssText = 'position:fixed; top:-9999px; left:-9999px; opacity:0; width:1px; height:1px; pointer-events:none;';
        document.body.appendChild(input);
    }
    return input;
}

function setupFileInput() {
    const fileInputEl = getOrCreateFileInput();
    
    fileInputEl.onchange = async (e) => {
        if (!isUploadAllowedGlobally) {
            e.target.value = '';
            return showToast("⚠️ Cloud uploads are temporarily paused by Admin!");
        }

        if (!e.target.files || e.target.files.length === 0) return;

        const files = Array.from(e.target.files).filter(f => f && (f.size > 0 || f.type?.startsWith('image/')));

        if (!files.length) {
            e.target.value = '';
            return showToast("Please select valid photos!");
        }

        if (navigator.vibrate) navigator.vibrate(15);
        await uploadBatchPhotos(files, currentUser, currentView, showToast);
        e.target.value = '';
    };
}

// 🌟 फोन की गैलरी से शेयर होकर आने वाले फोटो को पकड़ने का अचूक इंजन
let isSharedIncoming = window.location.search.includes('shared=1');

function checkIncomingSharedPhotos() {
    if (!isSharedIncoming) return;

    // जब तक यूजर लोड नहीं हो जाता, तब तक इंतज़ार करें
    const waitForUserAndUpload = () => {
        if (currentUser) {
            isSharedIncoming = false;
            window.history.replaceState({}, document.title, window.location.pathname);
            showToast("📥 Photos received from Gallery! Starting Cloud Backup...");
            
            setTimeout(() => {
                processOfflineQueue(currentUser, uploadPhotoToTelegram, showToast);
            }, 600);
        } else {
            setTimeout(waitForUserAndUpload, 300);
        }
    };

    waitForUserAndUpload();
}

// सर्विस वर्कर का इंस्टेंट मैसेज पकड़ें
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.action === 'trigger-sync') {
            const triggerSync = () => {
                if (currentUser) {
                    const count = event.data.sharedCount || "";
                    showToast(`📥 ${count ? count + ' ' : ''}Photos received from Gallery! Uploading...`);
                    processOfflineQueue(currentUser, uploadPhotoToTelegram, showToast);
                } else {
                    setTimeout(triggerSync, 400);
                }
            };
            triggerSync();
        }
    });
}

window.addEventListener('focus', () => {
    if (currentUser) {
        processOfflineQueue(currentUser, uploadPhotoToTelegram, showToast);
    }
});

setupFileInput();
checkIncomingSharedPhotos();
