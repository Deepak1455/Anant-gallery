// ==========================================================================
// PRIVATE PHOTOS MODULE - ULTRA-SECURE (SHA-256 HASHED, FAST & SMART LOCK)
// ==========================================================================
import { db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderGroupedGallery } from "./gallery-card.js";
import { openImageViewer } from "./image-viewer.js";

// --------------------------------------------------------------------------
// 1. DYNAMIC CSS FOR PIN MODAL, VAULT BANNER & CARD ANIMATIONS
// --------------------------------------------------------------------------
const vaultCSS = `
    .vault-header-banner {
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(236, 72, 153, 0.1));
        border: 1px dashed rgba(79, 70, 229, 0.35);
        padding: 14px 20px;
        margin: 15px 12px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--accent, #4f46e5);
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        animation: fadeInUp 0.35s ease;
    }

    .vault-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.82);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: vaultFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .vault-modal-card {
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        width: 90%;
        max-width: 320px;
        border-radius: 24px;
        padding: 30px 24px;
        text-align: center;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        animation: vaultPopUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .vault-logo-box {
        width: 70px;
        height: 70px;
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(147, 51, 234, 0.2));
        border: 2px solid rgba(79, 70, 229, 0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px auto;
        box-shadow: 0 8px 20px rgba(79, 70, 229, 0.2);
        overflow: hidden;
        color: var(--accent, #4f46e5);
        font-size: 1.6rem;
    }

    .vault-logo-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
    }

    .vault-modal-card h3 {
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--text-main, #0f172a);
        margin-bottom: 6px;
    }

    .vault-modal-card p {
        font-size: 0.85rem;
        color: var(--text-muted, #64748b);
        margin-bottom: 22px;
    }

    #vaultPinInput {
        width: 170px;
        text-align: center;
        font-size: 1.8rem;
        letter-spacing: 12px;
        padding: 10px 14px;
        background: var(--bg-body, #f8fafc);
        border: 2px solid var(--border, #cbd5e1);
        border-radius: 16px;
        margin-bottom: 24px;
        color: var(--text-main, #0f172a);
        outline: none;
        transition: all 0.2s;
    }

    #vaultPinInput:focus {
        border-color: var(--accent, #4f46e5);
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15);
    }

    .vault-modal-btns {
        display: flex;
        gap: 12px;
    }

    .vault-btn {
        flex: 1;
        padding: 14px;
        border-radius: 14px;
        border: none;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: transform 0.15s, opacity 0.2s;
    }

    .vault-btn:active {
        transform: scale(0.96);
    }

    .vault-btn.primary {
        background: var(--accent, #4f46e5);
        color: #ffffff;
        box-shadow: 0 8px 18px rgba(79, 70, 229, 0.35);
    }

    .vault-btn.secondary {
        background: rgba(100, 116, 139, 0.12);
        color: var(--text-muted, #64748b);
    }

    @keyframes vaultFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes vaultPopUp { from { opacity: 0; transform: scale(0.88) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes vaultShake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-8px); }
        40%, 80% { transform: translateX(8px); }
    }
    .vault-shake { 
        animation: vaultShake 0.35s ease-in-out; 
        border-color: #ef4444 !important; 
    }
`;

(function injectVaultStyles() {
    if (!document.getElementById("vault-styles-injected")) {
        const styleTag = document.createElement("style");
        styleTag.id = "vault-styles-injected";
        styleTag.textContent = vaultCSS;
        document.head.appendChild(styleTag);
    }
})();

// --------------------------------------------------------------------------
// 2. CRYPTOGRAPHIC SHA-256 HASH ENGINE
// --------------------------------------------------------------------------
const SALT = "anant_vault_secure_salt_#2026";

export async function hashSecretPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + SALT);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// --------------------------------------------------------------------------
// 3. STATE & AUTO-LOCK CONTROLLER
// --------------------------------------------------------------------------
let unsubscribeHidden = null;
let isVaultUnlocked = false;
let failedAttempts = 0;
let lockoutTimer = null;

// Auto-lock when tab changes or phone goes to background
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        lockVault();
    }
});

// --------------------------------------------------------------------------
// 4. SMART PIN MODAL WITH BRUTE-FORCE SHIELD
// --------------------------------------------------------------------------
async function showPinModal(onSuccess) {
    if (isVaultUnlocked) {
        onSuccess();
        return;
    }

    let savedHash = localStorage.getItem("private_photos_pin_hash") || localStorage.getItem("vault_pin_hash");
    
    // Auto-migrate legacy plaintext PIN to SHA-256 Hash
    if (!savedHash) {
        const oldPlain = localStorage.getItem("private_photos_pin") || localStorage.getItem("vault_pin") || "1234";
        savedHash = await hashSecretPin(oldPlain);
        localStorage.setItem("private_photos_pin_hash", savedHash);
    }

    let pinModal = document.getElementById("vaultPinModal");
    if (!pinModal) {
        pinModal = document.createElement("div");
        pinModal.id = "vaultPinModal";
        pinModal.className = "vault-modal-overlay";
        pinModal.innerHTML = `
            <div class="vault-modal-card">
                <div class="vault-logo-box">
                    <img src="loadingphoto.png" class="vault-logo-img" alt="Private Photos" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <i class="fa-solid fa-user-lock" style="display:none;"></i>
                </div>
                <h3>Private Photos</h3>
                <p id="vaultStatusText">Enter 4-Digit Security PIN</p>
                <input type="password" id="vaultPinInput" maxlength="4" placeholder="••••" autocomplete="off" inputmode="numeric" />
                <div class="vault-modal-btns">
                    <button id="cancelPinBtn" class="vault-btn secondary">Cancel</button>
                    <button id="submitPinBtn" class="vault-btn primary">Unlock</button>
                </div>
            </div>
        `;
        document.body.appendChild(pinModal);
    }

    pinModal.style.display = "flex";
    const pinInput = document.getElementById("vaultPinInput");
    const statusText = document.getElementById("vaultStatusText");
    pinInput.value = "";
    setTimeout(() => pinInput.focus(), 100);

    const handleUnlock = async () => {
        if (lockoutTimer) return;

        const enteredPin = pinInput.value.trim();
        if (enteredPin.length !== 4) return;

        const inputHash = await hashSecretPin(enteredPin);

        if (inputHash === savedHash) {
            failedAttempts = 0;
            isVaultUnlocked = true;
            pinModal.style.display = "none";
            onSuccess();
        } else {
            failedAttempts++;
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            pinInput.value = "";
            pinInput.classList.add("vault-shake");
            setTimeout(() => pinInput.classList.remove("vault-shake"), 400);

            if (failedAttempts >= 3) {
                let timeLeft = 30;
                pinInput.disabled = true;
                statusText.innerText = `Too many attempts! Wait ${timeLeft}s`;
                statusText.style.color = "#ef4444";

                lockoutTimer = setInterval(() => {
                    timeLeft--;
                    statusText.innerText = `Too many attempts! Wait ${timeLeft}s`;
                    if (timeLeft <= 0) {
                        clearInterval(lockoutTimer);
                        lockoutTimer = null;
                        failedAttempts = 0;
                        pinInput.disabled = false;
                        statusText.innerText = "Enter 4-Digit Security PIN";
                        statusText.style.color = "var(--text-muted)";
                        pinInput.focus();
                    }
                }, 1000);
            }
        }
    };

    pinInput.oninput = () => {
        if (pinInput.value.length === 4) {
            handleUnlock();
        }
    };

    document.getElementById("submitPinBtn").onclick = handleUnlock;
    document.getElementById("cancelPinBtn").onclick = () => {
        pinModal.style.display = "none";
    };

    pinInput.onkeyup = (e) => {
        if (e.key === "Enter") handleUnlock();
    };
}

// --------------------------------------------------------------------------
// 5. RENDER PRIVATE PHOTOS SCREEN
// --------------------------------------------------------------------------
export function renderHiddenScreen(container, currentUser, callbacks) {
    showPinModal(() => {
        stopHiddenListener();

        container.innerHTML = `
            <div class="vault-header-banner">
                <i class="fa-solid fa-user-shield"></i>
                <span>Private Photos Active - Locked Space</span>
            </div>
            <div id="hiddenGalleryGrid">
                <div class="grid" style="padding:10px;">
                    <div class="skeleton" style="border-radius:12px; aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="border-radius:12px; aspect-ratio:1/1;"></div>
                    <div class="skeleton" style="border-radius:12px; aspect-ratio:1/1;"></div>
                </div>
            </div>
        `;

        const hiddenGridContainer = document.getElementById("hiddenGalleryGrid");

        const q = query(
            collection(db, "user_photos"),
            where("uid", "==", currentUser.uid),
            where("isHidden", "==", true),
            where("isDeleted", "==", false)
        );

        unsubscribeHidden = onSnapshot(q, (snapshot) => {
            hiddenGridContainer.innerHTML = "";
            const rawData = [];

            snapshot.forEach((docSnap) => {
                rawData.push({ id: docSnap.id, ...docSnap.data() });
            });

            const countBadge = document.getElementById('photoCountBadge');
            if (countBadge) {
                countBadge.innerText = `${rawData.length} ${rawData.length === 1 ? 'private photo' : 'private photos'}`;
            }

            if (rawData.length === 0) {
                hiddenGridContainer.innerHTML = `
                    <div style="text-align:center; padding:60px 20px; color: var(--text-muted, #64748b);">
                        <i class="fa-solid fa-lock-open" style="font-size: 3rem; margin-bottom: 15px; opacity:0.4;"></i>
                        <p style="font-weight: 500;">No private photos yet.</p>
                    </div>`;
                return;
            }

            rawData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            renderGroupedGallery(rawData, hiddenGridContainer, {
                getIsSelectionMode: callbacks.getIsSelectionMode,
                enterSelectionMode: callbacks.enterSelectionMode,
                toggleSelection: callbacks.toggleSelection,
                selectId: callbacks.selectId,
                deselectId: callbacks.deselectId,
                onToggleFav: async (docId, newFavStatus) => {
                    await updateDoc(doc(db, "user_photos", docId), { isFavorite: newFavStatus });
                },
                openLightbox: (index) => {
                    openImageViewer(index, rawData, 'hidden');
                }
            });
        });
    });
}

// --------------------------------------------------------------------------
// 6. AUTO-LOCK & ACTIONS
// --------------------------------------------------------------------------
export function stopHiddenListener() {
    isVaultUnlocked = false;
    if (unsubscribeHidden) {
        unsubscribeHidden();
        unsubscribeHidden = null;
    }
}

export function lockVault() {
    isVaultUnlocked = false;
    stopHiddenListener();
}
