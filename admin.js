// ==========================================================================
// ANANT GALLERY - COMMAND CENTER LOGIC (100% LIVE, FAST & ERROR-FREE)
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🌟 SUPER ADMIN EMAILS
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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --------------------------------------------------------------------------
// 1. AUTHENTICATION & ACCESS GUARD
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
    listenToTelemetryAndPhotos();
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
            if (!usersMap.has(uid)) {
                usersMap.set(uid, { count: 0, bytes: 0, favs: 0, trash: 0 });
            }

            const uData = usersMap.get(uid);
            uData.count++;
            const bytes = Number(d.fileSize) || (3.5 * 1024 * 1024);
            uData.bytes += bytes;
            totalBytes += bytes;

            if (d.isDeleted === true) {
                trash++;
                uData.trash++;
            } else {
                active++;
                if (d.isFavorite === true) uData.favs++;
            }
        });

        // 1. UPDATE TELEMETRY NUMBERS
        const elTotal = document.getElementById("valTotalPhotos");
        const elActive = document.getElementById("valActivePhotos");
        const elUsers = document.getElementById("valTotalUsers");
        const elStorage = document.getElementById("valTotalStorage");
        const elTrash = document.getElementById("valTrashCount");

        if (elTotal) elTotal.innerText = total;
        if (elActive) elActive.innerText = `${active} active`;
        if (elUsers) elUsers.innerText = usersMap.size;
        if (elStorage) elStorage.innerText = formatBytes(totalBytes);
        if (elTrash) elTrash.innerText = trash;

        // 2. RENDER PHOTO STREAM (Sorted by createdAt client-side)
        rawPhotos.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderPhotoStream(rawPhotos.slice(0, 30));

        // 3. RENDER USER DIRECTORY TABLE
        renderUserTable(usersMap);

    }, (err) => {
        console.error("Firestore Read Error:", err);
        showToast("Firestore Permission Error! Check Security Rules.");
    });
}

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
        card.innerHTML = `
            <img src="${p.image}" loading="lazy" alt="Cloud Photo" onerror="this.src='loadingphoto.png'">
            <div class="admin-photo-overlay">
                <button class="btn-mod-delete" title="Delete Photo" data-id="${p.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="photo-meta-info" title="UID: ${p.uid || 'Anonymous'}">
                    ${p.uid ? p.uid.substring(0, 6) + '..' : 'User'}
                </div>
            </div>
        `;

        card.querySelector(".btn-mod-delete").onclick = async () => {
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

function renderUserTable(usersMap) {
    const tableBody = document.getElementById("userTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (usersMap.size === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-muted);">No user accounts found.</td></tr>`;
        return;
    }

    usersMap.forEach((stats, uid) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="color:var(--accent); font-weight:700;">${uid.substring(0, 10)}...</td>
            <td>${stats.count}</td>
            <td>${formatBytes(stats.bytes)}</td>
            <td>${stats.favs} ❤️</td>
            <td>${stats.trash} 🗑️</td>
        `;
        tableBody.appendChild(tr);
    });
}

document.getElementById("btnRefreshStream")?.addEventListener("click", () => {
    listenToTelemetryAndPhotos();
    showToast("Refreshed!");
});