// ==========================================================================
// PROFILE MODULE - ANANT CLOUD BRANDED & DUAL PIN MANAGEMENT
// ==========================================================================

import { renderSettingsSection } from "./settings.js";
import { auth, db } from "./firebase-config.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Cloudinary Credentials (For Profile Avatar)
const CLOUDINARY_CLOUD_NAME = "gvickscl";
const CLOUDINARY_UPLOAD_PRESET = "my_photo";

let unsubscribeProfile = null;

// Standardized Storage Keys Across Entire App
const KEYS = {
    APP_PIN: "app_pin_code",
    PRIVATE_PIN: "private_photos_pin"
};

// --------------------------------------------------------------------------
// 1. DYNAMIC STYLES FOR PROFILE & PIN MANAGEMENT
// --------------------------------------------------------------------------
const injectProfileStyles = () => {
    if (document.getElementById('profile-styles')) {
        document.getElementById('profile-styles').remove();
    }
    const style = document.createElement('style');
    style.id = 'profile-styles';
    style.textContent = `
        .profile-container {
            max-width: 520px;
            margin: 20px auto;
            padding: 0 15px 40px 15px;
            animation: fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .profile-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 24px;
            padding: 30px 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            position: relative;
            overflow: hidden;
            margin-bottom: 20px;
        }
        
        /* AVATAR STYLES */
        .avatar-wrapper {
            position: relative;
            width: 90px;
            height: 90px;
            margin: 0 auto 15px auto;
        }
        .profile-avatar {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.2rem;
            font-weight: 700;
            color: #ffffff;
            box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
            border: 3px solid #ffffff;
            text-transform: uppercase;
            overflow: hidden;
            object-fit: cover;
        }
        .avatar-edit-badge {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 28px;
            height: 28px;
            background: var(--accent, #4f46e5);
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            transition: transform 0.2s, background 0.2s;
        }
        .avatar-edit-badge:hover {
            transform: scale(1.1);
        }

        /* DISPLAY NAME STYLES */
        .profile-name-container {
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .profile-display-name {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
        }
        .edit-name-icon {
            font-size: 0.95rem;
            color: var(--accent, #4f46e5);
            cursor: pointer;
            padding: 4px;
            transition: transform 0.2s;
        }
        .edit-name-icon:hover {
            transform: scale(1.15);
        }

        .name-edit-form {
            display: none;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-bottom: 10px;
        }
        .name-input {
            padding: 6px 12px !important;
            font-size: 0.9rem !important;
            width: 170px !important;
            border-radius: 10px !important;
        }
        .btn-save-name {
            padding: 6px 12px !important;
            font-size: 0.8rem !important;
            width: auto !important;
            border-radius: 10px !important;
        }
        .btn-cancel-name {
            background: none;
            border: none;
            color: var(--danger, #ef4444);
            cursor: pointer;
            font-size: 1.1rem;
            padding: 4px;
        }

        .profile-email {
            font-size: 0.88rem;
            color: var(--text-muted, #64748b);
            word-break: break-all;
            margin-bottom: 12px;
        }
        .profile-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(79, 70, 229, 0.08);
            color: var(--accent, #4f46e5);
            font-size: 0.8rem;
            padding: 5px 14px;
            border-radius: 20px;
            font-weight: 600;
            margin-bottom: 25px;
            border: 1px solid rgba(79, 70, 229, 0.2);
        }
        
        /* STATS & STORAGE CARD */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 15px;
        }
        .stat-card {
            background: var(--bg-body, #f8fafc);
            padding: 14px 10px;
            border-radius: 16px;
            border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
            text-align: center;
        }
        .stat-value {
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            line-height: 1.1;
        }
        .stat-label {
            font-size: 0.72rem;
            color: var(--text-muted, #64748b);
            margin-top: 4px;
            font-weight: 500;
        }

        .storage-analytics-card {
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%);
            border: 1px solid rgba(79, 70, 229, 0.2);
            border-radius: 20px;
            padding: 20px;
            margin-top: 18px;
            text-align: left;
        }
        .storage-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        .storage-title-box {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .storage-icon-wrapper {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
            color: #ffffff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }
        .storage-main-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
        }
        .storage-sub-title {
            font-size: 0.75rem;
            color: var(--text-muted, #64748b);
        }
        .storage-badge-unlimited {
            background: rgba(34, 197, 94, 0.15);
            color: #16a34a;
            border: 1px solid rgba(34, 197, 94, 0.3);
            font-size: 0.72rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .storage-big-value {
            font-size: 1.8rem;
            font-weight: 800;
            color: #4f46e5;
            margin: 10px 0 6px 0;
            display: flex;
            align-items: baseline;
            gap: 6px;
        }
        .storage-big-value span {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted, #64748b);
        }
        .storage-progress-bg {
            width: 100%;
            height: 8px;
            background: rgba(0, 0, 0, 0.06);
            border-radius: 10px;
            overflow: hidden;
        }
        .storage-progress-fill {
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, #4f46e5, #9333ea);
        }

        .info-list {
            margin-top: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .info-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            background: var(--bg-body, #f8fafc);
            border-radius: 14px;
            font-size: 0.88rem;
            border: 1px solid var(--border, rgba(0, 0, 0, 0.05));
        }

        /* --- 🛡️ DUAL PIN SECURITY CARD STYLES --- */
        .security-card {
            background: var(--bg-card, #ffffff);
            border-radius: 20px;
            padding: 20px;
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            box-shadow: 0 4px 20px rgba(0,0,0,0.03);
            margin-top: 15px;
            text-align: left;
        }
        .security-title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .pin-option-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px;
            background: var(--bg-body, #f8fafc);
            border-radius: 14px;
            border: 1px solid var(--border, rgba(0, 0, 0, 0.05));
            margin-bottom: 10px;
        }
        .pin-option-item:last-child {
            margin-bottom: 0;
        }
        .pin-option-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .pin-option-info i {
            font-size: 1.3rem;
        }
        .pin-title {
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--text-main, #0f172a);
        }
        .pin-subtitle {
            font-size: 0.75rem;
            color: var(--text-muted, #64748b);
        }
        .btn-pin-action {
            background: var(--accent, #4f46e5);
            color: #ffffff;
            border: none;
            padding: 8px 14px;
            border-radius: 10px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s;
        }
        .btn-pin-action:active {
            transform: scale(0.95);
        }

        /* 🌟 PIN CHANGE MODAL */
        .pin-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.72);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: modalFadeIn 0.22s ease-out;
        }
        .pin-modal-box {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
            width: 90%;
            max-width: 330px;
            border-radius: 24px;
            padding: 26px 20px;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.25);
            animation: modalPopUp 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transition: transform 0.2s ease;
        }
        .pin-modal-box.shake {
            animation: modalShake 0.35s ease-in-out;
        }
        @keyframes modalShake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-10px); }
            40%, 80% { transform: translateX(10px); }
        }
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPopUp { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }

        .pin-modal-box h4 {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            margin-bottom: 4px;
        }
        .pin-modal-box p {
            font-size: 0.82rem;
            color: var(--text-muted, #64748b);
            margin-bottom: 18px;
        }
        .pin-input-field {
            width: 100%;
            padding: 12px;
            border: 1.5px solid var(--border, #cbd5e1);
            background: var(--bg-body, #f8fafc);
            color: var(--text-main, #0f172a);
            border-radius: 14px;
            font-size: 1.15rem;
            text-align: center;
            letter-spacing: 8px;
            margin-bottom: 12px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pin-input-field:focus {
            border-color: var(--accent, #4f46e5);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }
        .pin-modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 12px;
        }
        .pin-modal-btn {
            flex: 1;
            padding: 13px;
            border-radius: 14px;
            border: none;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: transform 0.15s;
        }
        .pin-modal-btn:active {
            transform: scale(0.96);
        }
        .pin-modal-btn.save {
            background: var(--accent, #4f46e5);
            color: #ffffff;
            box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
        }
        .pin-modal-btn.cancel {
            background: rgba(100, 116, 139, 0.12);
            color: var(--text-muted, #64748b);
        }
    `;
    document.head.appendChild(style);
};

// Helper: Format Storage Bytes
function formatStorageSize(bytes) {
    if (!bytes || bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Toast Notification
const showToast = (msg) => {
    const toast = document.getElementById('toast');
    if (!toast) return alert(msg);
    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.top = "100px";
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        toast.style.top = "80px"; 
    }, 3000);
};

// --------------------------------------------------------------------------
// 2. RENDER PROFILE SCREEN
// --------------------------------------------------------------------------
export function renderProfileScreen(containerElement) {
    injectProfileStyles();

    const user = auth.currentUser;
    if (!user) {
        containerElement.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted, #64748b);">Please log in to view profile.</div>`;
        return;
    }

    const initial = user.email ? user.email.charAt(0).toUpperCase() : 'U';
    const displayName = user.displayName || "User";
    const creationTime = user.metadata.creationTime;
    const formattedDate = creationTime 
        ? new Date(creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';

    const avatarContent = user.photoURL 
        ? `<img src="${user.photoURL}" id="avatarImg" class="profile-avatar" alt="Avatar">`
        : `<div class="profile-avatar" id="avatarInitial">${initial}</div>`;

    containerElement.innerHTML = `
        <div class="profile-container">
            <div class="profile-card">
                
                <!-- AVATAR WITH CAMERA BADGE -->
                <div class="avatar-wrapper">
                    ${avatarContent}
                    <div class="avatar-edit-badge" id="changeAvatarBtn" title="Change Profile Picture">
                        <i class="fa-solid fa-camera"></i>
                    </div>
                    <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
                </div>

                <!-- DISPLAY NAME & EDIT CONTROL -->
                <div class="profile-name-container" id="nameDisplayBox">
                    <span class="profile-display-name" id="profileDisplayName">${displayName}</span>
                    <i class="fa-solid fa-pen-to-square edit-name-icon" id="btnEditName" title="Edit Name"></i>
                </div>

                <!-- EDIT NAME FORM -->
                <div class="name-edit-form" id="nameEditForm">
                    <input type="text" id="nameInput" class="name-input" value="${displayName !== 'User' ? displayName : ''}" placeholder="Enter Name">
                    <button class="btn btn-save-name" id="btnSaveName">Save</button>
                    <button class="btn-cancel-name" id="btnCancelName"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div class="profile-email">${user.email}</div>
                
                <div class="profile-badge">
                    <i class="fa-solid fa-shield-halved"></i> Active Cloud Storage
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <i class="fa-regular fa-images" style="color: #4f46e5;"></i>
                        <div class="stat-value" id="totalPhotosCount">0</div>
                        <div class="stat-label">Gallery Photos</div>
                    </div>
                    <div class="stat-card">
                        <i class="fa-solid fa-heart" style="color: #ec4899;"></i>
                        <div class="stat-value" id="favPhotosCount">0</div>
                        <div class="stat-label">Favorites</div>
                    </div>
                    <div class="stat-card">
                        <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                        <div class="stat-value" id="trashPhotosCount">0</div>
                        <div class="stat-label">In Trash</div>
                    </div>
                </div>

                <!-- SMART CLOUD STORAGE TRACKER CARD BOARD (ANANT CLOUD BRANDED) -->
                <div class="storage-analytics-card">
                    <div class="storage-card-header">
                        <div class="storage-title-box">
                            <div class="storage-icon-wrapper">
                                <i class="fa-solid fa-infinity"></i>
                            </div>
                            <div>
                                <div class="storage-main-title">Phone Storage Saved</div>
                                <div class="storage-sub-title">Anant Infinite Cloud Backup</div>
                            </div>
                        </div>
                        <div class="storage-badge-unlimited">
                            <i class="fa-solid fa-cloud"></i> Unlimited
                        </div>
                    </div>

                    <div class="storage-big-value" id="savedStorageVal">
                        0 MB <span>phone memory freed</span>
                    </div>

                    <div class="storage-progress-bg">
                        <div class="storage-progress-fill"></div>
                    </div>
                </div>

                <div class="info-list">
                    <div class="info-item">
                        <div class="info-item-left">
                            <i class="fa-regular fa-calendar" style="color:#16a34a;"></i> Member Since
                        </div>
                        <div class="info-item-val">${formattedDate}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-left">
                            <i class="fa-solid fa-envelope" style="color:#ca8a04;"></i> Account Email
                        </div>
                        <div class="info-item-val" style="font-size:0.8rem; word-break:break-all;">${user.email}</div>
                    </div>
                </div>

            </div>

            <!-- 🛡️ DUAL PIN SECURITY MANAGEMENT CARD -->
            <div class="security-card">
                <div class="security-title">
                    <i class="fa-solid fa-key" style="color: var(--accent);"></i> PIN Security Controls
                </div>

                <!-- 1. App Lock PIN Option -->
                <div class="pin-option-item">
                    <div class="pin-option-info">
                        <i class="fa-solid fa-mobile-screen-button" style="color: #4f46e5;"></i>
                        <div>
                            <div class="pin-title">App Lock PIN</div>
                            <div class="pin-subtitle">Used to lock gallery app</div>
                        </div>
                    </div>
                    <button class="btn-pin-action" id="btnManageAppPin">Change PIN</button>
                </div>

                <!-- 2. Private Photos PIN Option -->
                <div class="pin-option-item">
                    <div class="pin-option-info">
                        <i class="fa-solid fa-user-shield" style="color: #9333ea;"></i>
                        <div>
                            <div class="pin-title">Private Photos PIN</div>
                            <div class="pin-subtitle">Used to unlock Private Photos</div>
                        </div>
                    </div>
                    <button class="btn-pin-action" id="btnManagePrivatePin" style="background: #9333ea;">Set / Change</button>
                </div>
            </div>

        </div>
    `;

    // Render Settings Preferences below
    const profileContainer = containerElement.querySelector('.profile-container');
    if (profileContainer) {
        renderSettingsSection(profileContainer);
    }

    // A. CHANGE AVATAR LOGIC
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarFileInput = document.getElementById('avatarFileInput');

    changeAvatarBtn.addEventListener('click', () => avatarFileInput.click());

    avatarFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast("Uploading profile picture...");
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "Upload failed");

            const imageUrl = data.secure_url;
            await updateProfile(auth.currentUser, { photoURL: imageUrl });

            const avatarWrapper = document.querySelector('.avatar-wrapper');
            const existingAvatar = avatarWrapper.querySelector('.profile-avatar');
            if (existingAvatar) existingAvatar.remove();

            const newImg = document.createElement('img');
            newImg.src = imageUrl;
            newImg.id = 'avatarImg';
            newImg.className = 'profile-avatar';
            newImg.alt = 'Avatar';
            avatarWrapper.insertBefore(newImg, changeAvatarBtn);

            showToast("Profile picture updated!");
        } catch (err) {
            console.error("Avatar update error:", err);
            showToast("Upload Error: " + err.message);
        }
    });

    // B. EDIT DISPLAY NAME LOGIC
    const nameDisplayBox = document.getElementById('nameDisplayBox');
    const nameEditForm = document.getElementById('nameEditForm');
    const btnEditName = document.getElementById('btnEditName');
    const btnSaveName = document.getElementById('btnSaveName');
    const btnCancelName = document.getElementById('btnCancelName');
    const nameInput = document.getElementById('nameInput');
    const profileDisplayName = document.getElementById('profileDisplayName');

    btnEditName.addEventListener('click', () => {
        nameDisplayBox.style.display = 'none';
        nameEditForm.style.display = 'flex';
        nameInput.focus();
    });

    btnCancelName.addEventListener('click', () => {
        nameEditForm.style.display = 'none';
        nameDisplayBox.style.display = 'flex';
    });

    btnSaveName.addEventListener('click', async () => {
        const newName = nameInput.value.trim();
        if (!newName) return showToast("Name cannot be empty!");

        showToast("Updating name...");
        try {
            await updateProfile(auth.currentUser, { displayName: newName });
            profileDisplayName.innerText = newName;
            nameEditForm.style.display = 'none';
            nameDisplayBox.style.display = 'flex';
            showToast("Name updated successfully!");
        } catch (err) {
            console.error("Name update error:", err);
            showToast("Failed to update name");
        }
    });

    // C. REALTIME STATS & STORAGE LISTENER
    if (unsubscribeProfile) unsubscribeProfile();

    const photosRef = collection(db, "user_photos");
    const qUserPhotos = query(photosRef, where("uid", "==", user.uid));

    unsubscribeProfile = onSnapshot(qUserPhotos, (snapshot) => {
        let totalPhotos = 0;
        let trashPhotos = 0;
        let favPhotos = 0;
        let totalBytesSaved = 0;
        const DEFAULT_PHOTO_SIZE = 3.5 * 1024 * 1024;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const photoBytes = data.fileSize || DEFAULT_PHOTO_SIZE;
            totalBytesSaved += photoBytes;

            if (data.isDeleted === true) {
                trashPhotos++;
            } else {
                totalPhotos++;
                if (data.isFavorite === true) {
                    favPhotos++;
                }
            }
        });

        const totalEl = document.getElementById('totalPhotosCount');
        const favEl = document.getElementById('favPhotosCount');
        const trashEl = document.getElementById('trashPhotosCount');
        const storageValEl = document.getElementById('savedStorageVal');
        
        if (totalEl) totalEl.innerText = totalPhotos;
        if (favEl) favEl.innerText = favPhotos;
        if (trashEl) trashEl.innerText = trashPhotos;

        if (storageValEl) {
            const formattedStorage = formatStorageSize(totalBytesSaved);
            storageValEl.innerHTML = `${formattedStorage} <span>phone memory freed</span>`;
        }
    }, (error) => {
        console.error("Error listening to profile stats:", error);
    });

    // D. DUAL PIN MANAGEMENT MODAL LOGIC
    function openPinModal(pinType) {
        const isAppPin = pinType === 'app';
        const STORAGE_KEY = isAppPin ? KEYS.APP_PIN : KEYS.PRIVATE_PIN;
        const title = isAppPin ? "App Lock PIN" : "Private Photos PIN";
        const currentSavedPin = localStorage.getItem(STORAGE_KEY) || (isAppPin ? "" : "1234");

        let modal = document.getElementById("managePinModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "managePinModal";
            modal.className = "pin-modal-overlay";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="pin-modal-box" id="pinModalCard">
                <h4>${title}</h4>
                <p>${currentSavedPin ? 'Change your 4-digit PIN' : 'Set a new 4-digit PIN'}</p>
                ${currentSavedPin ? `<input type="password" id="oldPinInput" class="pin-input-field" maxlength="4" placeholder="Old PIN" inputmode="numeric">` : ''}
                <input type="password" id="newPinInput" class="pin-input-field" maxlength="4" placeholder="New 4-Digit PIN" inputmode="numeric">
                <input type="password" id="confirmPinInput" class="pin-input-field" maxlength="4" placeholder="Confirm New PIN" inputmode="numeric">
                <div class="pin-modal-actions">
                    <button class="pin-modal-btn cancel" id="closePinModal">Cancel</button>
                    <button class="pin-modal-btn save" id="savePinBtn">Save PIN</button>
                </div>
            </div>
        `;

        modal.style.display = "flex";

        const triggerShake = () => {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            const card = document.getElementById('pinModalCard');
            if (card) {
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 380);
            }
        };

        document.getElementById("closePinModal").onclick = () => {
            modal.style.display = "none";
        };

        document.getElementById("savePinBtn").onclick = () => {
            const oldPinInput = document.getElementById("oldPinInput");
            const newPin = document.getElementById("newPinInput").value.trim();
            const confirmPin = document.getElementById("confirmPinInput").value.trim();

            if (currentSavedPin && oldPinInput && oldPinInput.value.trim() !== currentSavedPin) {
                triggerShake();
                return showToast("Incorrect Old PIN!");
            }

            if (newPin.length !== 4 || isNaN(newPin)) {
                triggerShake();
                return showToast("New PIN must be 4 digits!");
            }

            if (newPin !== confirmPin) {
                triggerShake();
                return showToast("New PINs do not match!");
            }

            localStorage.setItem(STORAGE_KEY, newPin);

            if (!isAppPin) {
                localStorage.setItem("vault_pin", newPin);
            }

            modal.style.display = "none";
            showToast(`${title} updated successfully!`);
        };
    }

    document.getElementById("btnManageAppPin")?.addEventListener("click", () => openPinModal('app'));
    document.getElementById("btnManagePrivatePin")?.addEventListener("click", () => openPinModal('private'));
}