// ==========================================================================
// ANANT PRO - SUBSCRIPTION ENGINE & FREE vs PRO COMPARISON PAYWALL
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Pro State Cache
let currentProState = {
    isPro: false,
    plan: null,
    expiry: null
};

let unsubscribeProListener = null;

// --------------------------------------------------------------------------
// 1. INJECT ULTRA-MODERN 60FPS GLASSMORPHIC PRO STYLES
// --------------------------------------------------------------------------
function injectProStyles() {
    if (document.getElementById("anant-pro-styles")) return;
    const style = document.createElement("style");
    style.id = "anant-pro-styles";
    style.textContent = `
        /* 🌟 PRO PAYWALL OVERLAY */
        .pro-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 20000;
            background: rgba(9, 13, 22, 0.88);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 14px;
            animation: proFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            user-select: none;
        }

        @keyframes proFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .pro-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1.5px solid rgba(245, 158, 11, 0.35);
            width: 100%;
            max-width: 440px;
            max-height: 92vh;
            overflow-y: auto;
            border-radius: 32px;
            padding: 24px 18px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45), 0 0 35px rgba(245, 158, 11, 0.15);
            position: relative;
            animation: proPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            scrollbar-width: none;
        }

        .pro-modal-card::-webkit-scrollbar { display: none; }

        @keyframes proPopIn {
            0% { transform: scale(0.9) translateY(20px); opacity: 0; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
        }

        .pro-close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 34px;
            height: 34px;
            background: rgba(0, 0, 0, 0.05);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted, #64748b);
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.15s ease;
        }

        .pro-close-btn:active { transform: scale(0.88); }

        .pro-hero-header {
            text-align: center;
            margin-bottom: 16px;
        }

        .pro-crown-box {
            width: 64px;
            height: 64px;
            margin: 0 auto 10px auto;
            border-radius: 20px;
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.85rem;
            color: #ffffff;
            box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4);
            animation: crownPulse 2s infinite ease-in-out;
        }

        @keyframes crownPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4); }
            50% { transform: scale(1.06); box-shadow: 0 14px 35px rgba(245, 158, 11, 0.6); }
        }

        .pro-title {
            font-size: 1.55rem;
            font-weight: 800;
            color: var(--text-main, #0f172a);
            letter-spacing: -0.4px;
            line-height: 1.2;
        }

        .pro-title span {
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .pro-subtitle {
            font-size: 0.8rem;
            color: var(--text-muted, #64748b);
            margin-top: 4px;
            font-weight: 500;
        }

        /* 🌟 FREE VS PRO COMPARISON MATRIX */
        .comparison-card {
            background: var(--bg-body, #f8fafc);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 22px;
            padding: 12px 14px;
            margin-bottom: 18px;
        }

        .comparison-header {
            display: grid;
            grid-template-columns: 1.3fr 0.8fr 1fr;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
            font-size: 0.75rem;
            font-weight: 800;
            align-items: center;
        }

        .col-free-badge {
            color: var(--text-muted, #64748b);
            text-align: center;
        }

        .col-pro-badge {
            color: #d97706;
            text-align: right;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
        }

        .comparison-row {
            display: grid;
            grid-template-columns: 1.3fr 0.8fr 1fr;
            padding: 10px 0;
            border-bottom: 1px dashed var(--border, rgba(0, 0, 0, 0.06));
            font-size: 0.78rem;
            align-items: center;
        }

        .comparison-row:last-child {
            border-bottom: none;
            padding-bottom: 4px;
        }

        .feat-name {
            font-weight: 700;
            color: var(--text-main, #0f172a);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .feat-name i {
            font-size: 0.85rem;
            color: #f59e0b;
        }

        .free-val {
            text-align: center;
            color: var(--text-muted, #64748b);
            font-weight: 600;
            font-size: 0.74rem;
        }

        .pro-val {
            text-align: right;
            color: #059669;
            font-weight: 800;
            font-size: 0.76rem;
        }

        /* 🌟 PRICING CARDS GRID */
        .pro-pricing-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 18px;
        }

        .pricing-plan-card {
            border: 2px solid var(--border, #e2e8f0);
            background: var(--bg-body, #f8fafc);
            border-radius: 18px;
            padding: 14px 6px;
            text-align: center;
            cursor: pointer;
            position: relative;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pricing-plan-card:active { transform: scale(0.96); }

        .pricing-plan-card.active {
            border-color: #f59e0b;
            background: rgba(245, 158, 11, 0.06);
            box-shadow: 0 4px 18px rgba(245, 158, 11, 0.22);
        }

        .plan-ribbon {
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            font-size: 0.58rem;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 20px;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .plan-duration {
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            margin-top: 4px;
        }

        .plan-price {
            font-size: 1.25rem;
            font-weight: 800;
            color: #f59e0b;
            font-family: 'Outfit', sans-serif;
            margin: 3px 0 1px 0;
        }

        .plan-subtext {
            font-size: 0.65rem;
            color: var(--text-muted, #64748b);
            font-weight: 500;
        }

        /* 🌟 CTA ACTION BUTTON */
        .btn-upgrade-pro {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            color: #ffffff;
            border: none;
            border-radius: 18px;
            font-size: 1rem;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4);
            transition: transform 0.15s ease, box-shadow 0.2s ease;
        }

        .btn-upgrade-pro:active {
            transform: scale(0.96);
            box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
        }

        .pro-secure-guarantee {
            text-align: center;
            font-size: 0.72rem;
            color: var(--text-muted, #64748b);
            margin-top: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
    `;
    document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// 2. REALTIME PRO STATUS LISTENER & FIRESTORE SYNC
// --------------------------------------------------------------------------
export function initProManager(currentUser) {
    injectProStyles();

    if (!currentUser) {
        currentProState = { isPro: false, plan: null, expiry: null };
        if (unsubscribeProListener) {
            unsubscribeProListener();
            unsubscribeProListener = null;
        }
        return;
    }

    const userDocRef = doc(db, "users", currentUser.uid);

    unsubscribeProListener = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            const isPro = data.isPro === true;
            const expiry = data.proExpiry ? (data.proExpiry.toMillis ? data.proExpiry.toMillis() : data.proExpiry) : null;

            const isStillValid = isPro && (!expiry || Date.now() < expiry);

            currentProState = {
                isPro: isStillValid,
                plan: data.proPlan || 'lifetime',
                expiry: expiry
            };
        } else {
            currentProState = { isPro: false, plan: null, expiry: null };
        }
    }, (err) => {
        console.warn("[ProManager] Listener error:", err);
    });
}

export function isProUser() {
    return currentProState.isPro === true;
}

// --------------------------------------------------------------------------
// 3. SMART PRO FEATURE GUARD
// --------------------------------------------------------------------------
export function guardProFeature(featureName, onAllowed) {
    if (isProUser()) {
        if (onAllowed) onAllowed();
        return true;
    } else {
        if (navigator.vibrate) navigator.vibrate(20);
        showProPaywallModal(featureName);
        return false;
    }
}

// --------------------------------------------------------------------------
// 4. SHOW PRO PAYWALL MODAL (WITH FREE VS PRO COMPARISON MATRIX)
// --------------------------------------------------------------------------
export function showProPaywallModal(highlightReason = "Unlock All Features") {
    injectProStyles();

    let existing = document.getElementById("anantProModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "anantProModal";
    modal.className = "pro-modal-overlay";

    let selectedPlan = "lifetime"; // Default Best Value

    modal.innerHTML = `
        <div class="pro-modal-card">
            <button class="pro-close-btn" id="closeProModal"><i class="fa-solid fa-xmark"></i></button>
            
            <div class="pro-hero-header">
                <div class="pro-crown-box">
                    <i class="fa-solid fa-crown"></i>
                </div>
                <div class="pro-title">Upgrade to <span>Anant Pro</span></div>
                <div class="pro-subtitle">${highlightReason}</div>
            </div>

            <!-- 🌟 FREE VS PRO COMPARISON TABLE -->
            <div class="comparison-card">
                <div class="comparison-header">
                    <span>Feature</span>
                    <span class="col-free-badge">Free Plan</span>
                    <span class="col-pro-badge"><i class="fa-solid fa-crown"></i> Pro</span>
                </div>

                <div class="comparison-row">
                    <div class="feat-name"><i class="fa-solid fa-gem"></i> Quality</div>
                    <div class="free-val">1080p HD</div>
                    <div class="pro-val">Original 4K / RAW</div>
                </div>

                <div class="comparison-row">
                    <div class="feat-name"><i class="fa-solid fa-bolt"></i> Upload Limit</div>
                    <div class="free-val">15 at once</div>
                    <div class="pro-val">Unlimited 500+</div>
                </div>

                <div class="comparison-row">
                    <div class="feat-name"><i class="fa-solid fa-folder-tree"></i> Albums</div>
                    <div class="free-val">Max 5</div>
                    <div class="pro-val">Unlimited Folders</div>
                </div>

                <div class="comparison-row">
                    <div class="feat-name"><i class="fa-solid fa-fingerprint"></i> Vault Lock</div>
                    <div class="free-val">PIN Only</div>
                    <div class="pro-val">Biometric & Decoy</div>
                </div>
            </div>

            <!-- Plans Switcher -->
            <div class="pro-pricing-grid">
                <div class="pricing-plan-card" data-plan="monthly">
                    <div class="plan-duration">Monthly</div>
                    <div class="plan-price">₹49</div>
                    <div class="plan-subtext">per month</div>
                </div>

                <div class="pricing-plan-card" data-plan="annual">
                    <div class="plan-ribbon">SAVE 40%</div>
                    <div class="plan-duration">1 Year</div>
                    <div class="plan-price">₹399</div>
                    <div class="plan-subtext">₹33 / mo</div>
                </div>

                <div class="pricing-plan-card active" data-plan="lifetime">
                    <div class="plan-ribbon">BEST VALUE</div>
                    <div class="plan-duration">Lifetime</div>
                    <div class="plan-price">₹999</div>
                    <div class="plan-subtext">one-time pay</div>
                </div>
            </div>

            <button class="btn-upgrade-pro" id="btnConfirmProUpgrade">
                <i class="fa-solid fa-crown"></i> <span>Upgrade for ₹999</span>
            </button>

            <div class="pro-secure-guarantee">
                <i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> 100% Secure Checkout • Instant Activation
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById("closeProModal").onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    const planCards = modal.querySelectorAll(".pricing-plan-card");
    const upgradeBtn = document.getElementById("btnConfirmProUpgrade");

    planCards.forEach(card => {
        card.onclick = () => {
            planCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            selectedPlan = card.getAttribute("data-plan");
            
            let priceText = "₹999";
            if (selectedPlan === "monthly") priceText = "₹49";
            if (selectedPlan === "annual") priceText = "₹399";

            upgradeBtn.innerHTML = `<i class="fa-solid fa-crown"></i> <span>Upgrade for ${priceText}</span>`;
            if (navigator.vibrate) navigator.vibrate(10);
        };
    });

    // 🌟 Instant Activation Trigger
    upgradeBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) return alert("Please log in to upgrade!");

        upgradeBtn.disabled = true;
        upgradeBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Activating Pro...`;

        try {
            let expiryDate = null;
            if (selectedPlan === "monthly") {
                expiryDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
            } else if (selectedPlan === "annual") {
                expiryDate = Date.now() + (365 * 24 * 60 * 60 * 1000);
            }

            await setDoc(doc(db, "users", user.uid), {
                isPro: true,
                proPlan: selectedPlan,
                proExpiry: expiryDate,
                updatedAt: serverTimestamp()
            }, { merge: true });

            currentProState = {
                isPro: true,
                plan: selectedPlan,
                expiry: expiryDate
            };

            close();

            const toast = document.getElementById("toast");
            if (toast) {
                toast.innerText = "👑 Welcome to Anant Pro! All features unlocked.";
                toast.style.opacity = '1';
                toast.style.top = '100px';
                setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '80px'; }, 3500);
            }
        } catch (err) {
            console.error("Pro Upgrade Error:", err);
            alert("Upgrade failed: " + err.message);
        } finally {
            upgradeBtn.disabled = false;
        }
    };
}
