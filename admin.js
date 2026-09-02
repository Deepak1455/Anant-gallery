// ==========================================================================
// ANANT GALLERY - COMMAND CENTER & PRO SUBSCRIPTION CONTROLLER (ADMIN.JS)
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🌟 SUPER ADMIN EMAILS
const SUPER_ADMIN_EMAILS = [
    "dt8484970@gmail.com",
    "dt4527129@gmail.com",
    "anantgalleryogr@gmail.com"
];

let currentUser = null;
let toastTimer = null;
let cachedUsersMap = new Map();
let usersProDataMap = new Map();
let currentSearchTerm = "";

let selectedUserForModal = null;
let currentModalFilterTab = 'photos';

function showToast(msg) {
    const t = document.getElementById("adminToast");
    if (!t) return;
    if (toastTimer) clearTimeout(toastTimer);
    t.style.display = "block";
    t.innerText = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    toastTimer = setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => { t.style.display = "none"; }, 300);
    }, 2800);
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 1. AUTH GUARD
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

document.getElementById("btnBackToApp")?.addEventListener("click", () => { window.location.href = "/"; });
document.getElementById("btnExitAdmin")?.addEventListener("click", () => { window.location.href = "/"; });

function initAdminDashboard() {
    listenToGlobalAppConfig();
    listenToTelemetryAndPhotos();
    setupUserSearch();
    setupModalTabs();
    setupProGrantActions();
}

// 2. REMOTE APP CONTROLS
function listenToGlobalAppConfig() {
    const configDocRef = doc(db, "app_config", "global_settings");

    onSnapshot(configDocRef, (snap) => {
        if (!snap.exists()) {
            setDoc(configDocRef, { maintenanceMode: false, allowUploads: true, broadcastNotice: "" }, { merge: true });
            return;
        }

        const data = snap.data();
        const toggleMaint = document.getElementById("toggleMaintenance");
        const toggleUp = document.getElementById("toggleUploads");
        const previewBox = document.getElementById("noticePreviewBox");
        const previewText = document.getElementById("noticePreviewText");
        const liveBadge = document.getElementById("liveNoticeBadge");

        if (toggleMaint) toggleMaint.checked = !!data.maintenanceMode;
        if (toggleUp) toggleUp.checked = data.allowUploads !== false;

        if (data.broadcastNotice && data.broadcastNotice.trim()) {
            if (previewBox) previewBox.style.display = "flex";
            if (previewText) previewText.innerText = data.broadcastNotice;
            if (liveBadge) liveBadge.style.display = "flex";
        } else {
            if (previewBox) previewBox.style.display = "none";
            if (liveBadge) liveBadge.style.display = "none";
        }
    });

    document.getElementById("toggleMaintenance")?.addEventListener("change", async (e) => {
        await setDoc(configDocRef, { maintenanceMode: e.target.checked }, { merge: true });
        showToast(e.target.checked ? "🚨 Maintenance Enabled!" : "✅ App Live for Users!");
    });

    document.getElementById("toggleUploads")?.addEventListener("change", async (e) => {
        await setDoc(configDocRef, { allowUploads: e.target.checked }, { merge: true });
        showToast(e.target.checked ? "✅ Uploads Enabled" : "⚠️ Uploads Paused Globally!");
    });

    document.getElementById("btnPublishNotice")?.addEventListener("click", async () => {
        const input = document.getElementById("broadcastInput");
        const msg = input.value.trim();
        if (!msg) return showToast("Enter notice message!");
        await setDoc(configDocRef, { broadcastNotice: msg }, { merge: true });
        input.value = "";
        showToast("📢 Notice Published!");
    });

    document.getElementById("btnClearNotice")?.addEventListener("click", async () => {
        await setDoc(configDocRef, { broadcastNotice: "" }, { merge: true });
        showToast("Banner Cleared!");
    });
}

// 3. REALTIME TELEMETRY & DATA STREAM
function listenToTelemetryAndPhotos() {
    const photosRef = collection(db, "user_photos");
    const usersRef = collection(db, "users");

    try {
        onSnapshot(usersRef, (usersSnap) => {
            usersProDataMap.clear();
            let proCount = 0;

            usersSnap.forEach((uDoc) => {
                const u = uDoc.data();
                const isProValid = u.isPro === true && (!u.proExpiry || Date.now() < (u.proExpiry.toMillis ? u.proExpiry.toMillis() : u.proExpiry));
                if (isProValid) proCount++;

                usersProDataMap.set(uDoc.id, {
                    isPro: isProValid,
                    proPlan: u.proPlan || 'lifetime',
                    proExpiry: u.proExpiry
                });
            });

            const proCountVal = document.getElementById("valProUsersCount");
            const proSub = document.getElementById("valProSubscribers");
            if (proCountVal) proCountVal.innerText = proCount;
            if (proSub) proSub.innerText = `${proCount} Pro Active`;

            cachedUsersMap.forEach((val, key) => {
                const proData = usersProDataMap.get(key);
                if (proData) {
                    val.isPro = proData.isPro;
                    val.proPlan = proData.proPlan;
                }
            });

            filterAndRenderUsers();
        });
    } catch (e) {}

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
                const proData = usersProDataMap.get(uid) || { isPro: false, proPlan: null };
                usersMap.set(uid, { 
                    uid: uid,
                    name: userName,
                    email: userEmail,
                    isPro: proData.isPro,
                    proPlan: proData.proPlan,
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

        const elTotal = document.getElementById("valTotalPhotos");
        const elActive = document.getElementById("valActivePhotos");
        const elUsers = document.getElementById("valTotalUsers");
        const elStorage = document.getElementById("valTotalStorage");
        const userBadge = document.getElementById("valTotalUsersBadge");

        if (elTotal) elTotal.innerText = total;
        if (elActive) elActive.innerText = `${active} active`;
        if (elUsers) elUsers.innerText = usersMap.size;
        if (elStorage) elStorage.innerText = formatBytes(totalBytes);
        if (userBadge) userBadge.innerText = `${usersMap.size} ${usersMap.size === 1 ? 'Account' : 'Accounts'}`;

        rawPhotos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderPhotoStream(rawPhotos.slice(0, 36));
        filterAndRenderUsers();

        if (selectedUserForModal && usersMap.has(selectedUserForModal.uid)) {
            selectedUserForModal = usersMap.get(selectedUserForModal.uid);
            updateModalUI();
        }
    });
}

// 4. USER DIRECTORY RENDERER
function setupUserSearch() {
    document.getElementById("userSearchInput")?.addEventListener("input", (e) => {
        currentSearchTerm = e.target.value.toLowerCase().trim();
        filterAndRenderUsers();
    });
}

function filterAndRenderUsers() {
    const tableBody = document.getElementById("userTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (cachedUsersMap.size === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No accounts found.</td></tr>`;
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

    filteredUsers.forEach((user) => {
        const tr = document.createElement("tr");
        const initial = user.name.charAt(0).toUpperCase();

        const planBadge = user.isPro 
            ? `<span class="admin-pro-badge"><i class="fa-solid fa-crown"></i> PRO</span>`
            : `<span class="admin-free-badge">FREE</span>`;

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
            <td>${planBadge}</td>
            <td><strong>${user.activeCount}</strong></td>
            <td><span style="font-family:'JetBrains Mono'; font-weight:700; color:var(--accent);">${formatBytes(user.bytes)}</span></td>
            <td>${user.favs} ❤️</td>
            <td>
                <button class="btn-inspect-user" data-uid="${user.uid}">
                    <i class="fa-solid fa-sliders"></i> Manage
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

// 🌟 5. PRO SUBSCRIPTION GRANT/REVOKE CONTROLLER (100% WORKING)
function setupProGrantActions() {
    document.getElementById("btnGrantProLifetime")?.addEventListener("click", () => updateSelectedUserPlan("lifetime"));
    document.getElementById("btnGrantPro1Year")?.addEventListener("click", () => updateSelectedUserPlan("annual"));
    document.getElementById("btnGrantPro1Month")?.addEventListener("click", () => updateSelectedUserPlan("monthly"));
    document.getElementById("btnRevokePro")?.addEventListener("click", () => updateSelectedUserPlan("free"));
}

async function updateSelectedUserPlan(planType) {
    if (!selectedUserForModal) return;
    const uid = selectedUserForModal.uid;

    let isPro = planType !== "free";
    let expiryDate = null;

    if (planType === "monthly") {
        expiryDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
    } else if (planType === "annual") {
        expiryDate = Date.now() + (365 * 24 * 60 * 60 * 1000);
    }

    try {
        await setDoc(doc(db, "users", uid), {
            isPro: isPro,
            proPlan: isPro ? planType : null,
            proExpiry: expiryDate,
            updatedByAdmin: currentUser ? currentUser.email : "Super Admin",
            updatedAt: serverTimestamp()
        }, { merge: true });

        selectedUserForModal.isPro = isPro;
        selectedUserForModal.proPlan = isPro ? planType : null;

        updateModalUI();
        filterAndRenderUsers();
        showToast(isPro ? `👑 Granted ${planType.toUpperCase()} Pro to ${selectedUserForModal.name}!` : `User downgraded to Free Plan.`);
    } catch (err) {
        console.error("Firestore Permission Error:", err);
        showToast("Update failed: Check Firestore Rules in Firebase Console!");
    }
}

// 6. USER INSPECTOR MODAL
function setupModalTabs() {
    document.getElementById("tabStatPhotos")?.addEventListener("click", () => switchModalTab('photos'));
    document.getElementById("tabStatFavs")?.addEventListener("click", () => switchModalTab('favs'));
    document.getElementById("tabStatTrash")?.addEventListener("click", () => switchModalTab('trash'));
    document.getElementById("tabStatStorage")?.addEventListener("click", () => switchModalTab('all'));
}

function switchModalTab(tabKey) {
    currentModalFilterTab = tabKey;
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

    document.getElementById("modalUserAvatar").innerText = user.name.charAt(0).toUpperCase();
    document.getElementById("modalUserName").innerText = user.name;
    document.getElementById("modalUserEmail").innerText = `${user.email} (UID: ${user.uid})`;

    const proBadge = document.getElementById("modalProBadge");
    const statusText = document.getElementById("modalSubscriptionStatusText");

    if (user.isPro) {
        if (proBadge) {
            proBadge.className = "admin-pro-badge";
            proBadge.innerHTML = `<i class="fa-solid fa-crown"></i> PRO (${(user.proPlan || 'lifetime').toUpperCase()})`;
        }
        if (statusText) {
            statusText.innerText = `Active: ${(user.proPlan || 'Lifetime').toUpperCase()}`;
            statusText.style.color = "#d97706";
        }
    } else {
        if (proBadge) {
            proBadge.className = "admin-free-badge";
            proBadge.innerText = "FREE";
        }
        if (statusText) {
            statusText.innerText = "Plan: Free Tier";
            statusText.style.color = "#64748b";
        }
    }

    document.getElementById("modalTotalPhotos").innerText = user.activeCount;
    document.getElementById("modalTotalStorage").innerText = formatBytes(user.bytes);
    document.getElementById("modalFavPhotos").innerText = user.favs;
    document.getElementById("modalTrashPhotos").innerText = user.trash;

    document.getElementById("tabStatPhotos")?.classList.toggle('active', currentModalFilterTab === 'photos');
    document.getElementById("tabStatFavs")?.classList.toggle('active', currentModalFilterTab === 'favs');
    document.getElementById("tabStatTrash")?.classList.toggle('active', currentModalFilterTab === 'trash');
    document.getElementById("tabStatStorage")?.classList.toggle('active', currentModalFilterTab === 'all');

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

    const grid = document.getElementById("modalUserPhotosGrid");
    grid.innerHTML = "";

    if (filteredList.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:35px 15px; color:var(--text-muted); font-size:0.85rem;">No ${headingText.toLowerCase()} found.</div>`;
        return;
    }

    filteredList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    filteredList.forEach(p => {
        const card = document.createElement("div");
        card.className = "admin-photo-card";
        card.innerHTML = `
            <img src="${p.image}" loading="lazy" alt="User Photo" onerror="this.src='/loadingphoto.png'">
            <div class="admin-photo-overlay">
                <button class="btn-mod-delete" title="Delete Photo" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                <div class="photo-meta-info">${p.isFavorite ? '❤️ Fav' : (p.isDeleted ? '🗑️ Trash' : 'Active')}</div>
            </div>
        `;

        card.querySelector(".btn-mod-delete").onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Delete this photo permanently?")) {
                await deleteDoc(doc(db, "user_photos", p.id));
                card.remove();
                showToast("Photo deleted!");
            }
        };

        grid.appendChild(card);
    });
}

document.getElementById("closeInspectModal")?.addEventListener("click", () => {
    document.getElementById("userInspectModal").style.display = "none";
    selectedUserForModal = null;
});

// 7. RENDER GLOBAL PHOTO STREAM
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
                <button class="btn-mod-delete" title="Delete Photo" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                <div class="photo-meta-info"><i class="fa-solid fa-user"></i> ${uploaderName}</div>
            </div>
        `;

        card.querySelector(".btn-mod-delete").onclick = async (e) => {
            e.stopPropagation();
            if (confirm("Delete this photo from cloud?")) {
                await deleteDoc(doc(db, "user_photos", p.id));
                card.remove();
                showToast("Photo deleted permanently by Admin!");
            }
        };

        streamGrid.appendChild(card);
    });
}

document.getElementById("btnRefreshStream")?.addEventListener("click", () => {
    const icon = document.getElementById("refreshIcon");
    if (icon) {
        icon.classList.remove("spin");
        void icon.offsetWidth;
        icon.classList.add("spin");
    }
    listenToTelemetryAndPhotos();
    showToast("Telemetry & Photos Refreshed!");
});
