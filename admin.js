// ==========================================================================
// ANANT GALLERY - COMMAND CENTER LOGIC (100% REALTIME FIRESTORE ENGINE)
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    limit, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🌟 SUPER ADMIN EMAILS (आपका ईमेल यहाँ जोड़ दिया गया है)
const SUPER_ADMIN_EMAILS = [
    "dt8484970@gmail.com",
    "admin@anant.gallery"
];

let currentUser = null;
let toastTimer = null;

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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --------------------------------------------------------------------------
// 1. ADMIN AUTHENTICATION GUARD
// --------------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (user && (SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase()) || user.email?.endsWith("@admin.com"))) {
        currentUser = user;
        const emailDisplay = document.getElementById("adminEmailDisplay");
        if (emailDisplay) emailDisplay.innerText = user.email;
        
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
    listenToTelemetry();
    loadRecentPhotoStream();
    loadUserDirectory();
}

// --------------------------------------------------------------------------
// 3. REMOTE APP CONTROLS (CONFIG LISTEN & UPDATE)
// --------------------------------------------------------------------------
function listenToGlobalAppConfig() {
    const configDocRef = doc(db, "app_config", "global_settings");

    onSnapshot(configDocRef, (snap) => {
        if (!snap.exists()) {
            setDoc(configDocRef, {
                maintenanceMode: false,
                allowUploads: true,
                broadcastNotice: ""
            });
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
    });

    document.getElementById("toggleMaintenance")?.addEventListener("change", async (e) => {
        await updateDoc(configDocRef, { maintenanceMode: e.target.checked });
        showToast(e.target.checked ? "🚨 Maintenance Mode Enabled Globally!" : "✅ App is Live for all users!");
    });

    document.getElementById("toggleUploads")?.addEventListener("change", async (e) => {
        await updateDoc(configDocRef, { allowUploads: e.target.checked });
        showToast(e.target.checked ? "✅ Uploads Enabled" : "⚠️ Uploads Paused Globally!");
    });

    document.getElementById("btnPublishNotice")?.addEventListener("click", async () => {
        const input = document.getElementById("broadcastInput");
        const msg = input.value.trim();
        if (!msg) return showToast("Enter notice message!");
        await updateDoc(configDocRef, { broadcastNotice: msg });
        input.value = "";
        showToast("📢 Broadcast notice published to all users!");
    });

    document.getElementById("btnClearNotice")?.addEventListener("click", async () => {
        await updateDoc(configDocRef, { broadcastNotice: "" });
        showToast("Banner notice cleared!");
    });
}

// --------------------------------------------------------------------------
// 4. REALTIME TELEMETRY STATS
// --------------------------------------------------------------------------
function listenToTelemetry() {
    const photosRef = collection(db, "user_photos");

    onSnapshot(photosRef, (snapshot) => {
        let total = snapshot.size;
        let active = 0;
        let trash = 0;
        let totalBytes = 0;
        const usersSet = new Set();

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.uid) usersSet.add(d.uid);
            totalBytes += (d.fileSize || 3.5 * 1024 * 1024);

            if (d.isDeleted === true) {
                trash++;
            } else {
                active++;
            }
        });

        const elTotal = document.getElementById("valTotalPhotos");
        const elActive = document.getElementById("valActivePhotos");
        const elUsers = document.getElementById("valTotalUsers");
        const elStorage = document.getElementById("valTotalStorage");
        const elTrash = document.getElementById("valTrashCount");

        if (elTotal) elTotal.innerText = total;
        if (elActive) elActive.innerText = `${active} active`;
        if (elUsers) elUsers.innerText = usersSet.size;
        if (elStorage) elStorage.innerText = formatBytes(totalBytes);
        if (elTrash) elTrash.innerText = trash;
    });
}

// --------------------------------------------------------------------------
// 5. LIVE RECENT PHOTO STREAM & MODERATION
// --------------------------------------------------------------------------
async function loadRecentPhotoStream() {
    const streamGrid = document.getElementById("adminPhotoGrid");
    const countBadge = document.getElementById("streamCount");
    if (!streamGrid) return;
    
    streamGrid.innerHTML = `<div class="stream-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching stream...</div>`;

    const q = query(collection(db, "user_photos"), orderBy("createdAt", "desc"), limit(36));
    const snap = await getDocs(q);

    if (snap.empty) {
        streamGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">No photos uploaded yet.</div>`;
        return;
    }

    if (countBadge) countBadge.innerText = `Showing ${snap.size} latest`;
    streamGrid.innerHTML = "";

    snap.forEach((docSnap) => {
        const p = docSnap.data();
        const card = document.createElement("div");
        card.className = "admin-photo-card";
        card.innerHTML = `
            <img src="${p.image}" loading="lazy" alt="Cloud Photo" onerror="this.src='loadingphoto.png'">
            <div class="admin-photo-overlay">
                <button class="btn-mod-delete" title="Delete from Cloud" data-id="${docSnap.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="photo-meta-info" title="UID: ${p.uid || 'Anonymous'}">
                    UID: ${p.uid ? p.uid.substring(0, 8) + '...' : 'Unknown'}
                </div>
            </div>
        `;

        card.querySelector(".btn-mod-delete").onclick = async () => {
            if (confirm("Delete this photo permanently from the cloud?")) {
                await deleteDoc(doc(db, "user_photos", docSnap.id));
                card.remove();
                showToast("Photo permanently deleted by Admin!");
            }
        };

        streamGrid.appendChild(card);
    });
}

document.getElementById("btnRefreshStream")?.addEventListener("click", loadRecentPhotoStream);

// --------------------------------------------------------------------------
// 6. USER EXPLORER DIRECTORY
// --------------------------------------------------------------------------
async function loadUserDirectory() {
    const tableBody = document.getElementById("userTableBody");
    if (!tableBody) return;
    
    const photosRef = collection(db, "user_photos");
    const snap = await getDocs(photosRef);

    const userStats = new Map();

    snap.forEach((docSnap) => {
        const d = docSnap.data();
        const uid = d.uid || "Anonymous";

        if (!userStats.has(uid)) {
            userStats.set(uid, { count: 0, bytes: 0, favs: 0, trash: 0 });
        }

        const curr = userStats.get(uid);
        curr.count++;
        curr.bytes += (d.fileSize || 3.5 * 1024 * 1024);
        if (d.isFavorite) curr.favs++;
        if (d.isDeleted) curr.trash++;
    });

    tableBody.innerHTML = "";
    userStats.forEach((stats, uid) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="color:var(--accent); font-weight:700;">${uid}</td>
            <td>${stats.count} photos</td>
            <td>${formatBytes(stats.bytes)}</td>
            <td>${stats.favs} ❤️</td>
            <td>${stats.trash} 🗑️</td>
            <td>
                <button class="btn-inspect-user" data-uid="${uid}">Filter Stream</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}
