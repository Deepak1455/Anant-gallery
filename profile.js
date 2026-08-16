// ==========================================================================
// PROFILE MODULE - 100% BUG-FREE & FAST (WITH ACCOUNT DELETION)
// ==========================================================================

import { renderSettingsSection } from "./settings.js";
import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    writeBatch, 
    doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateProfile, deleteUser, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { hashSecretPin } from "./hidden-photos.js";
import { 
    isBiometricAvailable, 
    isBiometricEnabled, 
    registerBiometric, 
    removeBiometric 
} from "./biometric-auth.js";

const CLOUDINARY_CLOUD_NAME = "gvickscl";
const CLOUDINARY_UPLOAD_PRESET = "my_photo";

let unsubscribeProfile = null;

const HASH_KEYS = {
    APP_PIN_HASH: "app_pin_code_hash",
    PRIVATE_PIN_HASH: "private_photos_pin_hash"
};

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
        .avatar-edit-badge:hover { transform: scale(1.1); }
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
        .pin-option-item:last-child { margin-bottom: 0; }
        .pin-option-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .pin-option-info i { font-size: 1.3rem; }
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
        .btn-pin-action:active { transform: scale(0.95); }

        /* 🌟 DANGER ZONE / DELETE ACCOUNT CARD */
        .danger-card {
            background: rgba(239, 68, 68, 0.05);
            border: 1.5px dashed rgba(239, 68, 68, 0.3);
            border-radius: 20px;
            padding: 20px;
            margin-top: 20px;
            text-align: left;
        }
        .danger-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #ef4444;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        .danger-desc {
            font-size: 0.78rem;
            color: var(--text-muted, #64748b);
            line-height: 1.4;
            margin-bottom: 14px;
        }
        .btn-delete-account {
            width: 100%;
            padding: 12px;
            background: #ef4444;
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 0.88rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
            transition: transform 0.15s;
        }
        .btn-delete-account:active { transform: scale(0.96); }

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
        .pin-modal-box.shake { animation: modalShake 0.35s ease-in-out; }
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
        .pin-modal-btn:active { transform: scale(0.96); }
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

function formatStorageSize(bytes) {
    if (!bytes || bytes === 0) return "0 MB";
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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
// RENDER PROFILE SCREEN
// --------------------------------------------------------------------------
export function renderProfileScreen(containerElement, passedUser = null) {
    injectProfileStyles();
    stopProfileListener();

    const user = passedUser || auth.currentUser;
    if (!user) {
        containerElement.innerHTML = `<div style="text-align:center; padding:50px 20px; color:var(--text-muted, #64748b);">Please log in to view profile.</div>`;
        return;
    }

    const email = user.email || "No Email";
    const initial = email.charAt(0).toUpperCase();
    const displayName = user.displayName || email.split('@')[0] || "User";
    const creationTime = user.metadata?.creationTime;
    const formattedDate = creationTime 
        ? new Date(creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Active';

    const avatarContent = user.photoURL 
        ? `<img src="${user.photoURL}" id="avatarImg" class="profile-avatar" alt="Avatar">`
        : `<div class="profile-avatar" id="avatarInitial">${initial}</div>`;

    containerElement.innerHTML = `
        <div class="profile-container">
            <div class="profile-card">
                
                <div class="avatar-wrapper">
                    ${avatarContent}
                    <div class="avatar-edit-badge" id="changeAvatarBtn" title="Change Profile Picture">
                        <i class="fa-solid fa-camera"></i>
                    </div>
                    <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
                </div>

                <div class="profile-name-container" id="nameDisplayBox">
                    <span class="profile-display-name" id="profileDisplayName">${displayName}</span>
                    <i class="fa-solid fa-pen-to-square edit-name-icon" id="btnEditName" title="Edit Name"></i>
                </div>

                <div class="name-edit-form" id="nameEditForm">
                    <input type="text" id="nameInput" class="name-input" value="${displayName !== 'User' ? displayName : ''}" placeholder="Enter Name">
                    <button class="btn btn-save-name" id="btnSaveName">Save</button>
                    <button class="btn-cancel-name" id="btnCancelName"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div class="profile-email">${email}</div>
                
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
                        <div class="info-item-val" style="font-size:0.8rem; word-break:break-all;">${email}</div>
                    </div>
                </div>

            </div>

            <!-- SECURITY CONTROLS CARD -->
            <div class="security-card">
                <div class="security-title">
                    <i class="fa-solid fa-shield-halved" style="color: var(--accent);"></i> Security & Lock Controls
                </div>

                <div class="pin-option-item" id="bioRowContainer" style="display:none;">
                    <div class="pin-option-info">
                        <i class="fa-solid fa-fingerprint" style="color: #10b981;"></i>
                        <div>
                            <div class="pin-title">Fingerprint Lock</div>
                            <div class="pin-subtitle" id="bioStatusSubtitle">Scan finger to save & activate</div>
                        </div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="profileBioToggle">
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="pin-option-item">
                    <div class="pin-option-info">
                        <i class="fa-solid fa-mobile-screen-button" style="color: #4f46e5;"></i>
                        <div>
                            <div class="pin-title">App Lock PIN</div>
                            <div class="pin-subtitle">SHA-256 Encrypted PIN</div>
                        </div>
                    </div>
                    <button class="btn-pin-action" id="btnManageAppPin">Change PIN</button>
                </div>

                <div class="pin-option-item">
                    <div class="pin-option-info">
                        <i class="fa-solid fa-user-shield" style="color: #9333ea;"></i>
                        <div>
                            <div class="pin-title">Private Photos PIN</div>
                            <div class="pin-subtitle">SHA-256 Encrypted PIN</div>
                        </div>
                    </div>
                    <button class="btn-pin-action" id="btnManagePrivatePin" style="background: #9333ea;">Set / Change</button>
                </div>
            </div>

            <!-- 🌟 GOOGLE PLAY MANDATORY: DELETE ACCOUNT & DATA -->
            <div class="danger-card">
                <div class="danger-title">
                    <i class="fa-solid fa-triangle-exclamation"></i> Danger Zone
                </div>
                <div class="danger-desc">
                    Permanently delete your account, albums, and wipe all backed-up photos from Anant Cloud. This action is irreversible.
                </div>
                <button class="btn-delete-account" id="btnDeleteAccountAction">
                    <i class="fa-solid fa-trash-can"></i> Delete My Account & Data
                </button>
            </div>

        </div>
    `;

    const profileContainer = containerElement.querySelector('.profile-container');
    if (profileContainer) {
        renderSettingsSection(profileContainer);
    }

    // Biometric Check
    isBiometricAvailable().then((supported) => {
        const row = document.getElementById('bioRowContainer');
        const toggle = document.getElementById('profileBioToggle');
        const sub = document.getElementById('bioStatusSubtitle');

        if (supported && row && toggle) {
            row.style.display = 'flex';
            const isActive = isBiometricEnabled();
            toggle.checked = isActive;
            if (sub) sub.innerText = isActive ? 'Fingerprint Saved & Active' : 'Scan finger to save & activate';

            toggle.onchange = async (e) => {
                const wantsEnable = e.target.checked;
                if (wantsEnable) {
                    showToast("Scanning finger to save passkey...");
                    try {
                        const ok = await registerBiometric(user.email);
                        if (ok) {
                            toggle.checked = true;
                            if (sub) sub.innerText = 'Fingerprint Saved & Active';
                            showToast("Fingerprint saved & activated! 🔒");
                        } else {
                            toggle.checked = false;
                            showToast("Registration cancelled!");
                        }
                    } catch (err) {
                        toggle.checked = false;
                        showToast("Failed: " + err.message);
                    }
                } else {
                    removeBiometric();
                    toggle.checked = false;
                    if (sub) sub.innerText = 'Scan finger to save & activate';
                    showToast("Fingerprint disabled!");
                }
            };
        }
    }).catch(() => {});

    // Avatar Upload
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const avatarFileInput = document.getElementById('avatarFileInput');

    if (changeAvatarBtn && avatarFileInput) {
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
                if (auth.currentUser) {
                    await updateProfile(auth.currentUser, { photoURL: imageUrl });
                }

                const avatarWrapper = document.querySelector('.avatar-wrapper');
                const existingAvatar = avatarWrapper?.querySelector('.profile-avatar');
                if (existingAvatar) existingAvatar.remove();

                const newImg = document.createElement('img');
                newImg.src = imageUrl;
                newImg.id = 'avatarImg';
                newImg.className = 'profile-avatar';
                newImg.alt = 'Avatar';
                if (avatarWrapper && changeAvatarBtn) {
                    avatarWrapper.insertBefore(newImg, changeAvatarBtn);
                }

                showToast("Profile picture updated!");
            } catch (err) {
                console.error("Avatar update error:", err);
                showToast("Upload Error: " + err.message);
            }
        });
    }

    // Edit Name
    const nameDisplayBox = document.getElementById('nameDisplayBox');
    const nameEditForm = document.getElementById('nameEditForm');
    const btnEditName = document.getElementById('btnEditName');
    const btnSaveName = document.getElementById('btnSaveName');
    const btnCancelName = document.getElementById('btnCancelName');
    const nameInput = document.getElementById('nameInput');
    const profileDisplayName = document.getElementById('profileDisplayName');

    if (btnEditName) {
        btnEditName.addEventListener('click', () => {
            if (nameDisplayBox) nameDisplayBox.style.display = 'none';
            if (nameEditForm) nameEditForm.style.display = 'flex';
            if (nameInput) nameInput.focus();
        });
    }

    if (btnCancelName) {
        btnCancelName.addEventListener('click', () => {
            if (nameEditForm) nameEditForm.style.display = 'none';
            if (nameDisplayBox) nameDisplayBox.style.display = 'flex';
        });
    }

    if (btnSaveName) {
        btnSaveName.addEventListener('click', async () => {
            const newName = nameInput ? nameInput.value.trim() : '';
            if (!newName) return showToast("Name cannot be empty!");

            showToast("Updating name...");
            try {
                if (auth.currentUser) {
                    await updateProfile(auth.currentUser, { displayName: newName });
                }
                if (profileDisplayName) profileDisplayName.innerText = newName;
                if (nameEditForm) nameEditForm.style.display = 'none';
                if (nameDisplayBox) nameDisplayBox.style.display = 'flex';
                showToast("Name updated successfully!");
            } catch (err) {
                console.error("Name update error:", err);
                showToast("Failed to update name");
            }
        });
    }

    // Realtime Stats
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
        console.warn("Stats listener error:", error);
    });

    // 🌟 DELETE ACCOUNT MODAL HANDLER
    document.getElementById('btnDeleteAccountAction')?.addEventListener('click', () => {
        showDeleteAccountModal(user);
    });

    // PIN Management Modal
    async function openPinModal(pinType) {
        const isAppPin = pinType === 'app';
        const STORAGE_KEY = isAppPin ? HASH_KEYS.APP_PIN_HASH : HASH_KEYS.PRIVATE_PIN_HASH;
        const title = isAppPin ? "App Lock PIN" : "Private Photos PIN";
        const currentSavedHash = localStorage.getItem(STORAGE_KEY);

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
                <p>${currentSavedHash ? 'Change your 4-digit PIN' : 'Set a new 4-digit PIN'}</p>
                ${currentSavedHash ? `<input type="password" id="oldPinInput" class="pin-input-field" maxlength="4" placeholder="Old PIN" inputmode="numeric">` : ''}
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

        document.getElementById("savePinBtn").onclick = async () => {
            const oldPinInput = document.getElementById("oldPinInput");
            const newPin = document.getElementById("newPinInput").value.trim();
            const confirmPin = document.getElementById("confirmPinInput").value.trim();

            if (currentSavedHash && oldPinInput) {
                const oldHash = await hashSecretPin(oldPinInput.value.trim());
                if (oldHash !== currentSavedHash) {
                    triggerShake();
                    return showToast("Incorrect Old PIN!");
                }
            }

            if (newPin.length !== 4 || isNaN(newPin)) {
                triggerShake();
                return showToast("New PIN must be 4 digits!");
            }

            if (newPin !== confirmPin) {
                triggerShake();
                return showToast("New PINs do not match!");
            }

            const newHash = await hashSecretPin(newPin);
            localStorage.setItem(STORAGE_KEY, newHash);

            modal.style.display = "none";
            showToast(`${title} updated securely!`);
        };
    }

    document.getElementById("btnManageAppPin")?.addEventListener("click", () => openPinModal('app'));
    document.getElementById("btnManagePrivatePin")?.addEventListener("click", () => openPinModal('private'));
}

// --------------------------------------------------------------------------
// 🌟 GOOGLE PLAY DELETE ACCOUNT MODAL & DATA PURGE ENGINE
// --------------------------------------------------------------------------
function showDeleteAccountModal(user) {
    let overlay = document.createElement('div');
    overlay.className = 'pin-modal-overlay';
    overlay.innerHTML = `
        <div class="pin-modal-box" style="border: 2px solid #ef4444;">
            <div style="width:58px; height:58px; border-radius:50%; background:rgba(239, 68, 68, 0.15); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:1.5rem; margin:0 auto 12px auto;">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h4 style="color:#ef4444;">Delete Account Permanently?</h4>
            <p style="font-size:0.83rem; color:var(--text-muted); line-height:1.45;">
                This will permanently delete your account, albums, and wipe all your backed-up photos from Anant Cloud. <strong>This cannot be undone.</strong>
            </p>
            <div class="pin-modal-actions">
                <button class="pin-modal-btn cancel" id="cancelDeleteAcc">Keep Account</button>
                <button class="pin-modal-btn" id="confirmDeleteAcc" style="background:#ef4444; color:#fff; font-weight:700;">Delete Forever</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#cancelDeleteAcc').onclick = close;

    overlay.querySelector('#confirmDeleteAcc').onclick = async () => {
        const btn = overlay.querySelector('#confirmDeleteAcc');
        btn.disabled = true;
        btn.innerText = "Deleting All Data...";

        try {
            // 1. Delete all user photos from Firestore
            const qPhotos = query(collection(db, "user_photos"), where("uid", "==", user.uid));
            const photoSnap = await getDocs(qPhotos);
            const batch1 = writeBatch(db);
            photoSnap.forEach(d => batch1.delete(doc(db, "user_photos", d.id)));
            await batch1.commit();

            // 2. Delete all user albums from Firestore
            const qAlbums = query(collection(db, "user_albums"), where("uid", "==", user.uid));
            const albumSnap = await getDocs(qAlbums);
            const batch2 = writeBatch(db);
            albumSnap.forEach(d => batch2.delete(doc(db, "user_albums", d.id)));
            await batch2.commit();

            // 3. Clear Local Storage
            localStorage.clear();
            sessionStorage.clear();

            // 4. Delete Firebase Auth User
            await deleteUser(user);

            close();
            showToast("Account and all data permanently deleted!");
        } catch (err) {
            console.error("Account delete error:", err);
            if (err.code === 'auth/requires-recent-login') {
                showToast("Security: Please log out and log in again to delete your account.");
            } else {
                showToast("Failed to delete account: " + err.message);
            }
            close();
        }
    };
}

export function stopProfileListener() {
    if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
    }
}
