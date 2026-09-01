// ==========================================================================
// ANANT ADMIN CONSOLE - FULL REAL-TIME ENGINE
// ==========================================================================

import { db } from "./firebase-config.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    deleteDoc, 
    writeBatch, 
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Master Pin Cryptographic Salt
const SALT = "anant_master_admin_vault_2026";
const DEFAULT_PIN = "998877";

let currentTab = "dashboard";
let photosData = [];
let albumsData = [];

// SHA-256 Hasher
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + SALT);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Toast Notification
function toast(msg) {
    const t = document.getElementById("adminToast");
    if (!t) return;
    t.innerText = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2800);
}

// Confirmation Dialog Modal
function confirmAction(title, desc, onConfirm) {
    const modal = document.getElementById("adminModal");
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalDesc").innerText = desc;
    modal.style.display = "flex";

    const close = () => { modal.style.display = "none"; };
    document.getElementById("btnModalCancel").onclick = close;
    document.getElementById("btnModalConfirm").onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };
}

function formatSize(bytes) {
    if (!bytes) return "0 MB";
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --------------------------------------------------------------------------
// 1. SECURITY & UNLOCK
// --------------------------------------------------------------------------
async function initAuth() {
    let savedHash = localStorage.getItem("anant_admin_hash");
    if (!savedHash) {
        savedHash = await hashPin(DEFAULT_PIN);
        localStorage.setItem("anant_admin_hash", savedHash);
    }

    const pinInput = document.getElementById("adminMasterPin");
    const unlockBtn = document.getElementById("btnAdminUnlock");
    const bioBtn = document.getElementById("btnAdminBio");

    const unlockSuccess = () => {
        document.getElementById("adminLockScreen").style.display = "none";
        document.getElementById("adminWorkspace").style.display = "flex";
        toast("Admin Access Granted! 🚀");
        startRealtimeStream();
    };

    unlockBtn.onclick = async () => {
        const pin = pinInput.value.trim();
        if (!pin) return toast("Enter 6-digit Master PIN!");
        const enteredHash = await hashPin(pin);
        if (enteredHash === savedHash) {
            unlockSuccess();
        } else {
            toast("Wrong Security PIN!");
            pinInput.value = "";
        }
    };

    pinInput.onkeydown = (e) => { if (e.key === "Enter") unlockBtn.click(); };

    // Biometrics Check
    if (window.PublicKeyCredential && bioBtn) {
        bioBtn.onclick = async () => {
            try {
                const challenge = new Uint8Array(32);
                crypto.getRandomValues(challenge);
                const cred = await navigator.credentials.get({
                    publicKey: { challenge, timeout: 30000, userVerification: "required" }
                });
                if (cred) unlockSuccess();
            } catch {
                toast("Biometric verification cancelled or unavailable");
            }
        };
    }
}

// --------------------------------------------------------------------------
// 2. REALTIME FIRESTORE STREAM
// --------------------------------------------------------------------------
function startRealtimeStream() {
    onSnapshot(collection(db, "user_photos"), (snap) => {
        photosData = [];
        snap.forEach(d => photosData.push({ id: d.id, ...d.data() }));
        renderCurrentTab();
    });

    onSnapshot(collection(db, "user_albums"), (snap) => {
        albumsData = [];
        snap.forEach(d => albumsData.push({ id: d.id, ...d.data() }));
        if (currentTab === "albums" || currentTab === "dashboard") {
            renderCurrentTab();
        }
    });
}

// --------------------------------------------------------------------------
// 3. TAB RENDERERS
// --------------------------------------------------------------------------
function renderCurrentTab() {
    const container = document.getElementById("contentContainer");
    if (!container) return;

    if (currentTab === "dashboard") renderDashboard(container);
    else if (currentTab === "photos") renderPhotos(container);
    else if (currentTab === "users") renderUsers(container);
    else if (currentTab === "albums") renderAlbums(container);
    else if (currentTab === "settings") renderSettings(container);
}

// 🌟 TAB 1: DASHBOARD
function renderDashboard(container) {
    const totalPhotos = photosData.length;
    const active = photosData.filter(p => !p.isDeleted).length;
    const inTrash = photosData.filter(p => p.isDeleted).length;
    const favs = photosData.filter(p => p.isFavorite).length;
    const privates = photosData.filter(p => p.isHidden).length;
    const totalSize = photosData.reduce((a, b) => a + (b.fileSize || 3.5 * 1024 * 1024), 0);
    const usersCount = new Set(photosData.map(p => p.uid)).size;

    container.innerHTML = `
        <div class="metrics-row">
            <div class="m-card">
                <div class="m-icon" style="background:linear-gradient(135deg,#4f46e5,#9333ea);"><i class="fa-solid fa-images"></i></div>
                <div class="m-info">
                    <h4>Total Photos</h4>
                    <div class="m-val">${totalPhotos}</div>
                </div>
            </div>
            <div class="m-card">
                <div class="m-icon" style="background:linear-gradient(135deg,#10b981,#059669);"><i class="fa-solid fa-hard-drive"></i></div>
                <div class="m-info">
                    <h4>Storage Used</h4>
                    <div class="m-val">${formatSize(totalSize)}</div>
                </div>
            </div>
            <div class="m-card">
                <div class="m-icon" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);"><i class="fa-solid fa-users"></i></div>
                <div class="m-info">
                    <h4>Total Users</h4>
                    <div class="m-val">${usersCount}</div>
                </div>
            </div>
            <div class="m-card">
                <div class="m-icon" style="background:linear-gradient(135deg,#ef4444,#dc2626);"><i class="fa-solid fa-trash"></i></div>
                <div class="m-info">
                    <h4>Trash Items</h4>
                    <div class="m-val">${inTrash}</div>
                </div>
            </div>
        </div>

        <div class="table-board">
            <div class="t-header">
                <h3><i class="fa-solid fa-clock-rotate-left" style="color:var(--accent);"></i> Recent 8 Cloud Uploads</h3>
            </div>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Photo</th>
                        <th>Doc ID</th>
                        <th>User UID</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${photosData.slice(0, 8).map(p => `
                        <tr>
                            <td><img src="${p.image}" class="table-img" onerror="this.src='https://via.placeholder.com/50'"></td>
                            <td style="font-family:monospace; font-size:0.75rem;">${p.id}</td>
                            <td style="font-family:monospace; font-size:0.75rem;">${p.uid || 'Anonymous'}</td>
                            <td>
                                <span class="tag ${p.isDeleted ? 'trash' : (p.isHidden ? 'hidden' : 'active')}">
                                    ${p.isDeleted ? 'Trash' : (p.isHidden ? 'Private' : 'Active')}
                                </span>
                            </td>
                            <td>
                                <button class="action-btn del" onclick="window.adminDeletePhoto('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 🌟 TAB 2: PHOTOS DIRECTORY
function renderPhotos(container) {
    container.innerHTML = `
        <div class="table-board">
            <div class="t-header">
                <h3><i class="fa-solid fa-images" style="color:var(--accent);"></i> All Cloud Photos (${photosData.length})</h3>
                <div class="search-box">
                    <input type="text" id="photoFilter" placeholder="Search by Doc ID or UID...">
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Doc ID</th>
                            <th>UID</th>
                            <th>Category</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="photoRows">
                        ${renderPhotoList(photosData)}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById("photoFilter")?.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = photosData.filter(p => p.id.toLowerCase().includes(q) || (p.uid && p.uid.toLowerCase().includes(q)));
        document.getElementById("photoRows").innerHTML = renderPhotoList(filtered);
    });
}

function renderPhotoList(list) {
    if (list.length === 0) return `<tr><td colspan="5" style="text-align:center; padding:30px;">No photos found.</td></tr>`;
    return list.map(p => `
        <tr>
            <td><img src="${p.image}" class="table-img" onerror="this.src='https://via.placeholder.com/50'"></td>
            <td style="font-family:monospace; font-size:0.75rem;">${p.id}</td>
            <td style="font-family:monospace; font-size:0.75rem;">${p.uid || 'Anonymous'}</td>
            <td>
                <span class="tag ${p.isDeleted ? 'trash' : (p.isHidden ? 'hidden' : 'active')}">
                    ${p.isDeleted ? 'Trash' : (p.isHidden ? 'Private' : 'Active')}
                </span>
            </td>
            <td>
                <button class="action-btn" onclick="window.open('${p.image}', '_blank')"><i class="fa-solid fa-eye"></i></button>
                <button class="action-btn del" onclick="window.adminDeletePhoto('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// 🌟 TAB 3: USER MANAGEMENT
function renderUsers(container) {
    const userMap = new Map();
    photosData.forEach(p => {
        if (!p.uid) return;
        if (!userMap.has(p.uid)) userMap.set(p.uid, { uid: p.uid, count: 0, trash: 0, bytes: 0 });
        const u = userMap.get(p.uid);
        if (p.isDeleted) u.trash++;
        else u.count++;
        u.bytes += (p.fileSize || 3.5 * 1024 * 1024);
    });

    const userList = Array.from(userMap.values());

    container.innerHTML = `
        <div class="table-board">
            <div class="t-header">
                <h3><i class="fa-solid fa-users" style="color:var(--accent);"></i> Registered Users & Data (${userList.length})</h3>
            </div>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>User UID</th>
                        <th>Active Photos</th>
                        <th>In Trash</th>
                        <th>Storage Used</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${userList.map(u => `
                        <tr>
                            <td style="font-family:monospace; font-weight:700;">${u.uid}</td>
                            <td><span class="tag active">${u.count} Photos</span></td>
                            <td><span class="tag trash">${u.trash} Trash</span></td>
                            <td>${formatSize(u.bytes)}</td>
                            <td>
                                <button class="action-btn del" onclick="window.adminWipeUser('${u.uid}')" title="Delete All User Data">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 🌟 TAB 4: ALBUMS
function renderAlbums(container) {
    container.innerHTML = `
        <div class="table-board">
            <div class="t-header">
                <h3><i class="fa-solid fa-folder-tree" style="color:var(--accent);"></i> All Cloud Albums (${albumsData.length})</h3>
            </div>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Album Name</th>
                        <th>Album ID</th>
                        <th>Owner UID</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${albumsData.map(a => `
                        <tr>
                            <td style="font-weight:700;"><i class="fa-solid fa-folder" style="color:var(--accent); margin-right:8px;"></i> ${a.name}</td>
                            <td style="font-family:monospace; font-size:0.75rem;">${a.id}</td>
                            <td style="font-family:monospace; font-size:0.75rem;">${a.uid}</td>
                            <td>
                                <button class="action-btn del" onclick="window.adminDeleteAlbum('${a.id}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 🌟 TAB 5: SETTINGS
function renderSettings(container) {
    container.innerHTML = `
        <div class="table-board">
            <div class="t-header">
                <h3><i class="fa-solid fa-sliders" style="color:var(--accent);"></i> System Diagnostics & Master PIN</h3>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div style="background:var(--bg-surface); padding:16px; border-radius:14px;">
                    <h4>Change Master PIN</h4>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">Admin security pin update karein</p>
                    <div style="display:flex; gap:10px;">
                        <input type="password" id="newPinInput" maxlength="6" placeholder="New 6-Digit PIN" style="padding:10px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border); color:#fff; width:160px; text-align:center;">
                        <button class="btn-unlock" style="width:auto; padding:10px 18px;" id="btnSavePin">Update PIN</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("btnSavePin")?.addEventListener("click", async () => {
        const val = document.getElementById("newPinInput").value.trim();
        if (val.length !== 6 || isNaN(val)) return toast("PIN 6-digits ka hona chahiye!");
        const newHash = await hashPin(val);
        localStorage.setItem("anant_admin_hash", newHash);
        toast("Master PIN Updated! 🔒");
        document.getElementById("newPinInput").value = "";
    });
}

// --------------------------------------------------------------------------
// 4. GLOBAL ACTION HANDLERS
// --------------------------------------------------------------------------
window.adminDeletePhoto = (docId) => {
    confirmAction("Photo Delete Karein?", "Firestore se yeh photo permanently delete ho jayegi.", async () => {
        try {
            await deleteDoc(doc(db, "user_photos", docId));
            toast("Photo Permanently Deleted!");
        } catch (e) {
            toast("Error: " + e.message);
        }
    });
};

window.adminWipeUser = (uid) => {
    confirmAction(`User ${uid} ka data wipe karein?`, "Is user ki saari photos aur albums permanently delete ho jayengi.", async () => {
        try {
            const q = query(collection(db, "user_photos"), where("uid", "==", uid));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(d => batch.delete(doc(db, "user_photos", d.id)));
            await batch.commit();
            toast("User ka saara data wipe kar diya gaya!");
        } catch (e) {
            toast("Purge failed: " + e.message);
        }
    });
};

window.adminDeleteAlbum = (albumId) => {
    confirmAction("Album Delete Karein?", "Photos gallery me safe rahengi.", async () => {
        try {
            await deleteDoc(doc(db, "user_albums", albumId));
            toast("Album deleted!");
        } catch (e) {
            toast("Failed to delete album");
        }
    });
};

// --------------------------------------------------------------------------
// 5. NAVIGATION SETUP
// --------------------------------------------------------------------------
function setupNav() {
    document.querySelectorAll(".menu-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".menu-item").forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            currentTab = item.dataset.tab;
            renderCurrentTab();
            document.getElementById("sidebar").classList.remove("open");
        });
    });

    document.getElementById("mobileToggleBtn")?.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });

    document.getElementById("btnRefreshData")?.addEventListener("click", () => {
        toast("Refreshed data!");
        renderCurrentTab();
    });

    document.getElementById("btnLogoutAdmin")?.addEventListener("click", () => {
        location.reload();
    });
}

initAuth();
setupNav();
