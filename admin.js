// ==========================================================================
// ANANT GALLERY - COMMAND CENTER (INTERACTIVE MODAL, REALTIME TABS & SYNC)
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🌟 SUPER ADMIN EMAILS
const SUPER_ADMIN_EMAILS = [
    "dt8484970@gmail.com",
    "admin@anant.gallery",
    "vikash@gmail.com"
];

let currentUser = null;
let toastTimer = null;
let cachedUsersMap = new Map();
let currentSearchTerm = "";

// Active inspected user in modal
let selectedUserForModal = null;
let currentModalFilterTab = 'photos'; // 'photos' | 'favs' | 'trash' | 'all'

function showToast(msg) {
    const t = document.getElementById("adminToast");
    if (!t) return;
    if (toastTimer) clearTimeout(toastTimer);
    t.innerText = msg;
    t.classList.add("show");
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --------------------------------------------------------------------------
// 1. AUTHENTICATION & ACCESS GUARD
// --------------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (user && (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase()) || user.email?.endsWith("@admin.com"))) {
        currentUser = user;
        const emailDisplay = document.getElementById("adminEmailDisplay");
        if (emailDisplay) emailDisplay.innerText = user.displayName || user.email;
        
        const deniedScreen = document.getElementById("accessDeniedScreen");
        if (deniedScreen) deniedScreen.style.display = "none";
        
        initAdminDashboard();
    } else {
        const deniedScreen = document.getElementById("accessDeniedScreen");
        if (deniedScreen) deniedScreen.style.display = "flex";
    }
});

document.getElementById("btnBackToApp")?.addEventListener("click", () => {
    window.location.href = "/";
});
document.getElementById("btnExitAdmin")?.addEventListener("click", () => {
    window.location.href = "/";
});

// --------------------------------------------------------------------------
// 2. DASHBOARD INITIALIZATION
// --------------------------------------------------------------------------
function initAdminDashboard() {
    listenToGlobalAppConfig();
    listenToTelemetryAndPhotos();
    setupUserSearch();
    setupModalTabs();
}

// --------------------------------------------------------------------------
// 3. REMOTE APP CONTROLS (REALTIME)
// --------------------------------------------------------------------------
function listenToGlobalAppConfig() {
    const configDocRef = doc(db, "app_config", "global_settings");

    onSnapshot(configDocRef, (snap) => {
        if (!snap.exists()) {
            setDoc(configDocRef, {
                maintenanceMode: false,
                allowUploads: true,
                broadcastNotice: ""
            }, { merge: true });
            return;
        }

        const data = snap.data();
        const toggleMaint = document.getElementById("toggleMaintenance");
        const toggleUp = document.getElementById("toggleUploads");
        const previewBox = document.getElementById("noticePreviewBox");
        const previewText = document.getElementById("noticePreviewText");

        if (toggleMaint) toggleMaint.checked = !!data.maintenanceMode;
        if (toggleUp) toggleUp.checked = data.allowUploads !== false;

        if (data.broadcastNotice && data.broadcastNotice.trim()) {
            if (previewBox) previewBox.style.display = "block";
            if (previewText) previewText.innerText = data.broadcastNotice;
        } else {
            if (previewBox) previewBox.style.display = "none";
        }
    }, (err) => {
        console.warn("Config listener error:", err);
    });

    document.getElementById("toggleMaintenance")?.addEventListener("change", async (e) => {
        try {
            await setDoc(configDocRef, { maintenanceMode: e.target.checked }, { merge: true });
            showToast(e.target.checked ? "🚨 Maintenance Enabled!" : "✅ App Live for Users!");
        } catch (err) {
            showToast("Failed to update: " + err.message);
        }
    });

    document.getElementById("toggleUploads")?.addEventListener("change", async (e) => {
        try {
            await setDoc(configDocRef, { allowUploads: e.target.checked }, { merge: true });
            showToast(e.target.checked ? "✅ Uploads Enabled" : "⚠️ Uploads Paused Globally!");
        } catch (err) {
            showToast("Failed to update: " + err.message);
        }
    });

    document.getElementById("btnPublishNotice")?.addEventListener("click", async () => {
        const input = document.getElementById("broadcastInput");
        const msg = input.value.trim();
        if (!msg) return showToast("Enter notice message!");
        try {
            await setDoc(configDocRef, { broadcastNotice: msg }, { merge: true });
            input.value = "";
            showToast("📢 Notice Published to all users!");
        } catch (err) {
            showToast("Publish error: " + err.message);
        }
    });

    document.getElementById("btnClearNotice")?.addEventListener("click", async () => {
        try {
            await setDoc(configDocRef, { broadcastNotice: "" }, { merge: true });
            showToast("Banner Cleared!");
        } catch (err) {
            showToast("Clear error: " + err.message);
        }
    });
}

// --------------------------------------------------------------------------
// 4. REALTIME TELEMETRY, LIVE PHOTO STREAM & USER DIRECTORY
// --------------------------------------------------------------------------
function listenToTelemetryAndPhotos() {
    const photosRef = collection(db, "user_photos");

    onSnapshot(photosRef, (snapshot) => {
        let total = snapshot.size;
        let active = 0;
        let trash = 0;
        let totalBytes = 0;
        const usersMap = new Map();
        const rawPhotos = [];

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const photoId = docSnap.id;
            rawPhotos.push({ id: photoId, ...d });

            const uid = d.uid || "Anonymous";
            
            const userName = d.userName || d.userEmail?.split('@')[0] || (uid.length > 8 ? uid.substring(0, 8) : uid);
            const userEmail = d.userEmail || `${uid.substring(0, 8)}@cloud`;

            if (!usersMap.has(uid)) {
                usersMap.set(uid, { 
                    uid: uid,
                    name: userName,
                    email: userEmail,
                    count: 0, 
                    activeCount: 0,
                    bytes: 0, 
                    favs: 0, 
                    trash: 0,
                    photos: []
                });
            }

            const uData = usersMap.get(uid);
            if (d.userName && uData.name.startsWith(uid.substring(0, 4))) uData.name = d.userName;
            if (d.userEmail && uData.email.includes('@cloud')) uData.email = d.userEmail;

            uData.count++;
            const bytes = Number(d.fileSize) || (3.5 * 1024 * 1024);
            uData.bytes += bytes;
            totalBytes += bytes;
            uData.photos.push({ id: photoId, ...d });

            if (d.isDeleted === true) {
                trash++;
                uData.trash++;
            } else {
                active++;
                uData.activeCount++;
                if (d.isFavorite === true) uData.favs++;
            }
        });

        cachedUsersMap = usersMap;

        // 1. UPDATE TELEMETRY CARDS
        const elTotal = document.getElementById("valTotalPhotos");
        const elActive = document.getElementById("valActivePhotos");
        const elUsers = document.getElementById("valTotalUsers");
        const elStorage = document.getElementById("valTotalStorage");
        const elTrash = document.getElementById("valTrashCount");
        const userBadge = document.getElementById("valTotalUsersBadge");

        if (elTotal) elTotal.innerText = total;
        if (elActive) elActive.innerText = `${active} active`;
        if (elUsers) elUsers.innerText = usersMap.size;
        if (elStorage) elStorage.innerText = formatBytes(totalBytes);
        if (elTrash) elTrash.innerText = trash;
        
        // Live Total User Count Badge
        if (userBadge) userBadge.innerText = `${usersMap.size} ${usersMap.size === 1 ? 'Account' : 'Accounts'}`;

        // 2. RENDER GLOBAL PHOTO STREAM
        rawPhotos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderPhotoStream(rawPhotos.slice(0, 36));

        // 3. RENDER ADVANCED USER DIRECTORY
        filterAndRenderUsers();

        // 4. AUTO-REFRESH MODAL IF OPEN
        if (selectedUserForModal && usersMap.has(selectedUserForModal.uid)) {
            selectedUserForModal = usersMap.get(selectedUserForModal.uid);
            updateModalUI();
        }

    }, (err) => {
        console.error("Firestore Read Error:", err);
        showToast("Firestore Permission Error! Check Security Rules.");
    });
}

// --------------------------------------------------------------------------
// 5. RENDER PHOTO STREAM (WITH USER DETAILS)
// --------------------------------------------------------------------------
function renderPhotoStream(photos) {
    const streamGrid = document.getElementById("adminPhotoGrid");
    const countBadge = document.getElementById("streamCount");
    if (!streamGrid) return;

    if (photos.length === 0) {
        streamGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No photos in cloud yet.</div>`;
        if (countBadge) countBadge.innerText = `0 recent`;
        return;
    }

    if (countBadge) countBadge.innerText = `${photos.length} latest`;
    streamGrid.innerHTML = "";

    photos.forEach((p) => {
        const card = document.createElement("div");
        card.className = "admin-photo-card";
        
        const uploaderName = p.userName || (p.uid ? p.uid.substring(0, 8) : "User");

        card.innerHTML = `
            <img src="${p.image}" loading="lazy" alt="Cloud Photo" onerror="this.src='/loadingphoto.png'">
            <div class="admin-photo-overlay">
                <button class="btn-mod-delete" title="Delete Photo" data-id="${p.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="photo-meta-info" title="Uploaded by: ${uploaderName} (UID: ${p.uid || 'N/A'})">
                    <i class="fa-solid fa-user"></i> ${uploaderName}
                </div>
            </div>
        `;

        card.querySelector(".btn-mod-delete").onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Permanently delete this photo from cloud?")) {
                try {
                    await deleteDoc(doc(db, "user_photos", p.id));
                    card.remove();
                    showToast("Photo deleted permanently by Admin!");
                } catch (err) {
                    showToast("Delete failed: " + err.message);
                }
            }
        };

        streamGrid.appendChild(card);
    });
}

// --------------------------------------------------------------------------
// 6. USER SEARCH ENGINE
// --------------------------------------------------------------------------
function setupUserSearch() {
    const searchInput = document.getElementById("userSearchInput");
    searchInput?.addEventListener("input", (e) => {
        currentSearchTerm = e.target.value.toLowerCase().trim();
        filterAndRenderUsers();
    });
}

function filterAndRenderUsers() {
    const tableBody = document.getElementById("userTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (cachedUsersMap.size === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">No registered accounts found.</td></tr>`;
        return;
    }

    const filteredUsers = Array.from(cachedUsersMap.values()).filter(u => {
        if (!currentSearchTerm) return true;
        return (
            (u.name && u.name.toLowerCase().includes(currentSearchTerm)) ||
            (u.email && u.email.toLowerCase().includes(currentSearchTerm)) ||
            (u.uid && u.uid.toLowerCase().includes(currentSearchTerm))
        );
    });

    if (filteredUsers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">No users matching "${currentSearchTerm}"</td></tr>`;
        return;
    }

    filteredUsers.forEach((user) => {
        const tr = document.createElement("tr");
        const initial = user.name.charAt(0).toUpperCase();

        tr.innerHTML = `
            <td>
                <div class="user-profile-cell">
                    <div class="user-avatar-small">${initial}</div>
                    <div>
                        <div class="user-name-title">${user.name}</div>
                        <div class="user-email-sub">${user.email}</div>
                    </div>
                </div>
            </td>
            <td><strong>${user.count}</strong></td>
            <td><span style="font-family:'JetBrains Mono'; font-weight:700; color:var(--accent);">${formatBytes(user.bytes)}</span></td>
            <td>${user.favs} ❤️</td>
            <td>${user.trash} 🗑️</td>
            <td>
                <button class="btn-inspect-user" data-uid="${user.uid}">
                    <i class="fa-solid fa-eye"></i> View Photos
                </button>
            </td>
        `;

        tr.querySelector(".btn-inspect-user").onclick = () => {
            selectedUserForModal = user;
            currentModalFilterTab = 'photos';
            openUserInspectModal(user);
        };

        tableBody.appendChild(tr);
    });
}

// --------------------------------------------------------------------------
// 🌟 7. VIEW PHOTOS MODAL (100% IDENTICAL TO PROVEN LIVE STREAM GRID)
// --------------------------------------------------------------------------
function setupModalTabs() {
    document.getElementById("tabStatPhotos")?.addEventListener("click", () => switchModalTab('photos'));
    document.getElementById("tabStatFavs")?.addEventListener("click", () => switchModalTab('favs'));
    document.getElementById("tabStatTrash")?.addEventListener("click", () => switchModalTab('trash'));
    document.getElementById("tabStatStorage")?.addEventListener("click", () => switchModalTab('all'));
}

function switchModalTab(tabKey) {
    currentModalFilterTab = tabKey;
    if (navigator.vibrate) navigator.vibrate(15);
    updateModalUI();
}

function openUserInspectModal(user) {
    const modal = document.getElementById("userInspectModal");
    if (!modal) return;

    selectedUserForModal = user;
    updateModalUI();
    modal.style.display = "flex";
}

function updateModalUI() {
    if (!selectedUserForModal) return;
    const user = selectedUserForModal;

    // 1. Update Profile Header
    document.getElementById("modalUserAvatar").innerText = user.name.charAt(0).toUpperCase();
    document.getElementById("modalUserName").innerText = user.name;
    document.getElementById("modalUserEmail").innerText = `${user.email} (UID: ${user.uid})`;

    // 2. Update Stats
    document.getElementById("modalTotalPhotos").innerText = user.count;
    document.getElementById("modalTotalStorage").innerText = formatBytes(user.bytes);
    document.getElementById("modalFavPhotos").innerText = user.favs;
    document.getElementById("modalTrashPhotos").innerText = user.trash;

    // 3. Highlight Active Tab
    document.getElementById("tabStatPhotos")?.classList.toggle('active', currentModalFilterTab === 'photos');
    document.getElementById("tabStatFavs")?.classList.toggle('active', currentModalFilterTab === 'favs');
    document.getElementById("tabStatTrash")?.classList.toggle('active', currentModalFilterTab === 'trash');
    document.getElementById("tabStatStorage")?.classList.toggle('active', currentModalFilterTab === 'all');

    // 4. Filter Photos
    let filteredList = [];
    let headingText = "Active Photos";

    if (currentModalFilterTab === 'photos') {
        filteredList = user.photos.filter(p => !p.isDeleted);
        headingText = "Active Photos";
    } else if (currentModalFilterTab === 'favs') {
        filteredList = user.photos.filter(p => p.isFavorite && !p.isDeleted);
        headingText = "Favorite Photos ❤️";
    } else if (currentModalFilterTab === 'trash') {
        filteredList = user.photos.filter(p => p.isDeleted);
        headingText = "Trash Bin Photos 🗑️";
    } else {
        filteredList = [...user.photos];
        headingText = "All Uploaded Photos";
    }

    document.getElementById("modalGalleryHeading").innerText = headingText;
    document.getElementById("modalGalleryCountBadge").innerText = `(${filteredList.length})`;

    // 5. Render Exact Proven 3-Column Square Grid
    const grid = document.getElementById("modalUserPhotosGrid");
    grid.innerHTML = "";

    if (filteredList.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:45px 15px; color:var(--text-muted); font-size:0.85rem;">No ${headingText.toLowerCase()} found for this account.</div>`;
        return;
    }

    filteredList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const fragment = document.createDocumentFragment();

    filteredList.forEach(p => {
        const card = document.createElement("div");
        card.className = "admin-photo-card"; // Same exact class as working live stream
        card.innerHTML = `
            <img src="${p.image}" loading="lazy" alt="User Photo" onerror="this.src='/loadingphoto.png'">
            <div class="admin-photo-overlay">
                <button class="btn-mod-delete" title="Delete Photo" data-id="${p.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="photo-meta-info">${p.isFavorite ? '❤️ Fav' : (p.isDeleted ? '🗑️ Trash' : 'Active')}</div>
            </div>
        `;

        card.querySelector(".btn-mod-delete").onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Delete this photo permanently for this user?")) {
                try {
                    await deleteDoc(doc(db, "user_photos", p.id));
                    card.remove();
                    showToast("Photo deleted permanently!");
                } catch (err) {
                    showToast("Delete failed: " + err.message);
                }
            }
        };

        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
}

document.getElementById("closeInspectModal")?.addEventListener("click", () => {
    const modal = document.getElementById("userInspectModal");
    if (modal) modal.style.display = "none";
    selectedUserForModal = null;
});

document.getElementById("userInspectModal")?.addEventListener("click", (e) => {
    if (e.target.id === "userInspectModal") {
        e.target.style.display = "none";
        selectedUserForModal = null;
    }
});

document.getElementById("btnRefreshStream")?.addEventListener("click", () => {
    listenToTelemetryAndPhotos();
    showToast("Telemetry & Photos Refreshed!");
});
