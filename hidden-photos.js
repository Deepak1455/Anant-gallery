// ==========================================================================
// PRIVATE PHOTOS MODULE - PRO BIOMETRICS, DECOY VAULT & FREE PIN LOCK
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
import { isBiometricAvailable, authenticateWithBiometric } from "./biometric-auth.js";
import { isProUser, guardProFeature } from "./pro-manager.js";

const SALT = "anant_vault_secure_salt_#2026";
const DECOY_PIN = "0000"; // 🌟 Decoy/Fake Vault PIN for Pro

export async function hashSecretPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + SALT);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

let unsubscribeHidden = null;
let isVaultUnlocked = false;
let isDecoyMode = false;
let failedAttempts = 0;
let lockoutTimer = null;

document.addEventListener("visibilitychange", () => {
    if (document.hidden) lockVault();
});

// --------------------------------------------------------------------------
// SMART PIN & BIOMETRIC MODAL
// --------------------------------------------------------------------------
async function showPinModal(onSuccess) {
    if (isVaultUnlocked) {
        onSuccess(isDecoyMode);
        return;
    }

    let savedHash = localStorage.getItem("private_photos_pin_hash");
    if (!savedHash) {
        const oldPlain = localStorage.getItem("private_photos_pin") || "1234";
        savedHash = await hashSecretPin(oldPlain);
        localStorage.setItem("private_photos_pin_hash", savedHash);
    }

    const hasBiometric = await isBiometricAvailable();
    const isPro = isProUser();

    let pinModal = document.getElementById("vaultPinModal");
    if (!pinModal) {
        pinModal = document.createElement("div");
        pinModal.id = "vaultPinModal";
        pinModal.className = "vault-modal-overlay";
        document.body.appendChild(pinModal);
    }

    pinModal.innerHTML = `
        <div class="vault-modal-card">
            <div class="vault-logo-box">
                <i class="fa-solid fa-user-shield"></i>
            </div>
            <h3>Private Photos</h3>
            <p id="vaultStatusText">${isPro ? 'Enter PIN or Scan Fingerprint' : 'Enter 4-Digit Security PIN'}</p>
            
            ${hasBiometric ? `
                <button type="button" class="vault-btn biometric" id="vaultBiometricBtn">
                    <i class="fa-solid fa-fingerprint" style="font-size:1.15rem;"></i>
                    <span>Unlock with Fingerprint ${!isPro ? '<i class="fa-solid fa-crown" style="color:#f59e0b; margin-left:4px;"></i>' : ''}</span>
                </button>
            ` : ''}

            <input type="password" id="vaultPinInput" maxlength="4" placeholder="••••" autocomplete="off" inputmode="numeric" />
            
            <div class="vault-modal-btns">
                <button id="cancelPinBtn" class="vault-btn secondary">Cancel</button>
                <button id="submitPinBtn" class="vault-btn primary">Unlock</button>
            </div>
        </div>
    `;

    pinModal.style.display = "flex";
    const pinInput = document.getElementById("vaultPinInput");
    const statusText = document.getElementById("vaultStatusText");
    pinInput.value = "";

    // 🌟 Biometric Handler with Pro Check
    const biometricBtn = document.getElementById("vaultBiometricBtn");
    if (biometricBtn) {
        biometricBtn.onclick = async () => {
            if (!isProUser()) {
                guardProFeature("Biometric Fingerprint Vault is an Anant Pro Feature");
                return;
            }

            const verified = await authenticateWithBiometric();
            if (verified) {
                if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
                isVaultUnlocked = true;
                isDecoyMode = false;
                pinModal.style.display = "none";
                onSuccess(false);
            }
        };

        if (isPro) {
            setTimeout(() => biometricBtn.click(), 200);
        }
    }

    // 🌟 PIN & Decoy Vault Check
    const handleUnlock = async () => {
        if (lockoutTimer) return;

        const enteredPin = pinInput.value.trim();
        if (enteredPin.length !== 4) return;

        // 👑 Pro Decoy Fake Vault Trigger (Entering 0000 opens empty vault)
        if (isProUser() && enteredPin === DECOY_PIN) {
            isVaultUnlocked = true;
            isDecoyMode = true;
            pinModal.style.display = "none";
            onSuccess(true);
            return;
        }

        const inputHash = await hashSecretPin(enteredPin);

        if (inputHash === savedHash) {
            failedAttempts = 0;
            isVaultUnlocked = true;
            isDecoyMode = false;
            pinModal.style.display = "none";
            onSuccess(false);
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
        if (pinInput.value.length === 4) handleUnlock();
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
// RENDER PRIVATE PHOTOS SCREEN
// --------------------------------------------------------------------------
export function renderHiddenScreen(container, currentUser, callbacks) {
    showPinModal((isDecoy) => {
        stopHiddenListener();

        // If Decoy Vault opened -> Show empty safe view
        if (isDecoy) {
            container.innerHTML = `
                <div class="vault-header-banner">
                    <i class="fa-solid fa-user-shield"></i>
                    <span>Private Photos (Decoy Safe)</span>
                </div>
                <div style="text-align:center; padding:60px 20px; color: var(--text-muted, #64748b);">
                    <i class="fa-solid fa-lock-open" style="font-size: 3rem; margin-bottom: 15px; opacity:0.4;"></i>
                    <p style="font-weight: 500;">No private photos in this album.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="vault-header-banner">
                <i class="fa-solid fa-user-shield"></i>
                <span>Private Photos Active - Encrypted Space</span>
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

export function stopHiddenListener() {
    isVaultUnlocked = false;
    isDecoyMode = false;
    if (unsubscribeHidden) {
        unsubscribeHidden();
        unsubscribeHidden = null;
    }
}

export function lockVault() {
    isVaultUnlocked = false;
    isDecoyMode = false;
    stopHiddenListener();
}
