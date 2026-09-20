// ==========================================================================
// ANANT PRO - GOOGLE PLAY SAFE & REMOTE TOGGLE PRO ENGINE (PRO-MANAGER.JS)
// ==========================================================================

import { auth, db } from "./firebase-config.js";
import { doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { setPaymentProgressState } from "./settings.js";

// Fast Cache
let cachedProState = {
    isPro: localStorage.getItem("anant_is_pro") === "true",
    plan: localStorage.getItem("anant_pro_plan") || null,
    expiry: localStorage.getItem("anant_pro_expiry") ? Number(localStorage.getItem("anant_pro_expiry")) : null
};

let unsubscribeProListener = null;

// Review Mode State (Controlled dynamically via Admin Panel)
let isReviewModeActive = localStorage.getItem("anant_review_mode") !== "false";

export function setPlayStoreReviewMode(state) {
    isReviewModeActive = state;
    localStorage.setItem("anant_review_mode", state ? "true" : "false");
}

export function isPlayStoreApp() {
    if (window.location.search.includes('portal=web')) return false;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isAndroid = /android/i.test(navigator.userAgent);
    const isTwaReferrer = document.referrer.includes('android-app://');
    const isApkParam = window.location.search.includes('mode=apk');

    return isTwaReferrer || isApkParam || (isStandalone && isAndroid);
}

// --------------------------------------------------------------------------
// 1. INJECT 60FPS PRO MODAL STYLES
// --------------------------------------------------------------------------
function injectProStyles() {
    if (document.getElementById("anant-pro-styles")) return;
    const style = document.createElement("style");
    style.id = "anant-pro-styles";
    style.textContent = `
        .pro-modal-overlay {
            position: fixed; inset: 0; z-index: 20000;
            background: rgba(9, 13, 22, 0.88);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            display: flex; align-items: center; justify-content: center;
            padding: 14px; animation: proFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            user-select: none;
        }
        @keyframes proFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .pro-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1.5px solid rgba(245, 158, 11, 0.35);
            width: 100%; max-width: 440px; max-height: 92vh;
            overflow-y: auto; border-radius: 32px; padding: 24px 18px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45), 0 0 35px rgba(245, 158, 11, 0.15);
            position: relative; animation: proPopIn 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            scrollbar-width: none;
        }
        .pro-modal-card::-webkit-scrollbar { display: none; }
        @keyframes proPopIn {
            0% { transform: scale(0.9) translateY(18px); opacity: 0; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .pro-close-btn {
            position: absolute; top: 16px; right: 16px; width: 34px; height: 34px;
            background: rgba(0, 0, 0, 0.05); border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            color: var(--text-muted, #64748b); font-size: 1rem; cursor: pointer;
        }
        .pro-close-btn:active { transform: scale(0.88); }
        .pro-hero-header { text-align: center; margin-bottom: 16px; }
        .pro-crown-box {
            width: 64px; height: 64px; margin: 0 auto 10px auto; border-radius: 20px;
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.85rem; color: #ffffff; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4);
            animation: crownPulse 2s infinite ease-in-out;
        }
        @keyframes crownPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4); }
            50% { transform: scale(1.06); box-shadow: 0 14px 35px rgba(245, 158, 11, 0.6); }
        }
        .pro-title {
            font-size: 1.55rem; font-weight: 800; color: var(--text-main, #0f172a);
            letter-spacing: -0.4px; line-height: 1.2;
        }
        .pro-title span {
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .pro-subtitle { font-size: 0.8rem; color: var(--text-muted, #64748b); margin-top: 4px; font-weight: 500; }
        .comparison-card {
            background: var(--bg-body, #f8fafc); border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 22px; padding: 12px 14px; margin-bottom: 18px;
        }
        .comparison-header {
            display: grid; grid-template-columns: 1.3fr 0.8fr 1fr; padding-bottom: 8px;
            border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06)); font-size: 0.75rem; font-weight: 800;
        }
        .col-free-badge { color: var(--text-muted, #64748b); text-align: center; }
        .col-pro-badge { color: #d97706; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
        .comparison-row {
            display: grid; grid-template-columns: 1.3fr 0.8fr 1fr; padding: 10px 0;
            border-bottom: 1px dashed var(--border, rgba(0, 0, 0, 0.06)); font-size: 0.78rem; align-items: center;
        }
        .comparison-row:last-child { border-bottom: none; padding-bottom: 4px; }
        .feat-name { font-weight: 700; color: var(--text-main, #0f172a); display: flex; align-items: center; gap: 6px; }
        .feat-name i { font-size: 0.85rem; color: #f59e0b; }
        .free-val { text-align: center; color: var(--text-muted, #64748b); font-weight: 600; font-size: 0.74rem; }
        .pro-val { text-align: right; color: #059669; font-weight: 800; font-size: 0.76rem; }
        .pro-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
        .pricing-plan-card {
            border: 2px solid var(--border, #e2e8f0); background: var(--bg-body, #f8fafc);
            border-radius: 18px; padding: 14px 6px; text-align: center; cursor: pointer; position: relative;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pricing-plan-card:active { transform: scale(0.96); }
        .pricing-plan-card.active {
            border-color: #f59e0b; background: rgba(245, 158, 11, 0.06);
            box-shadow: 0 4px 18px rgba(245, 158, 11, 0.22);
        }
        .plan-ribbon {
            position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff;
            font-size: 0.58rem; font-weight: 800; padding: 2px 7px; border-radius: 20px; white-space: nowrap;
        }
        .plan-duration { font-size: 0.8rem; font-weight: 700; color: var(--text-main, #0f172a); margin-top: 4px; }
        .plan-price { font-size: 1.25rem; font-weight: 800; color: #f59e0b; margin: 3px 0 1px 0; }
        .plan-subtext { font-size: 0.65rem; color: var(--text-muted, #64748b); font-weight: 500; }
        .btn-upgrade-pro {
            width: 100%; padding: 15px; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            color: #ffffff; border: none; border-radius: 18px; font-size: 1rem; font-weight: 800;
            cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
            box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4); transition: transform 0.15s ease;
        }
        .btn-upgrade-pro:active { transform: scale(0.96); }
        .pro-secure-guarantee {
            text-align: center; font-size: 0.72rem; color: var(--text-muted, #64748b);
            margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .safe-preview-box {
            background: rgba(16, 185, 129, 0.08);
            border: 1px dashed rgba(16, 185, 129, 0.35);
            border-radius: 18px;
            padding: 16px;
            text-align: center;
            font-size: 0.82rem;
            color: #059669;
            margin-bottom: 12px;
            line-height: 1.45;
        }
    `;
    document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// 2. REALTIME STATE LISTENER
// --------------------------------------------------------------------------
export function initProManager(currentUser) {
    injectProStyles();

    if (!currentUser) {
        cachedProState = { isPro: false, plan: null, expiry: null };
        localStorage.removeItem("anant_is_pro");
        localStorage.removeItem("anant_pro_plan");
        localStorage.removeItem("anant_pro_expiry");
        if (unsubscribeProListener) {
            unsubscribeProListener();
            unsubscribeProListener = null;
        }
        window.dispatchEvent(new CustomEvent('anant_pro_updated', { detail: cachedProState }));
        return;
    }

    const userDocRef = doc(db, "users", currentUser.uid);

    unsubscribeProListener = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            const isPro = data.isPro === true;
            const expiry = data.proExpiry ? (data.proExpiry.toMillis ? data.proExpiry.toMillis() : data.proExpiry) : null;
            const isStillValid = isPro && (!expiry || Date.now() < expiry);

            cachedProState = {
                isPro: isStillValid,
                plan: data.proPlan || 'lifetime',
                expiry: expiry
            };

            localStorage.setItem("anant_is_pro", isStillValid ? "true" : "false");
            if (data.proPlan) localStorage.setItem("anant_pro_plan", data.proPlan);
            if (expiry) localStorage.setItem("anant_pro_expiry", String(expiry));
        } else {
            cachedProState = { isPro: false, plan: null, expiry: null };
            localStorage.setItem("anant_is_pro", "false");
        }

        window.dispatchEvent(new CustomEvent('anant_pro_updated', { detail: cachedProState }));
    }, (err) => {
        console.warn("[ProManager] Listener warning:", err);
    });
}

export function isProUser() {
    return cachedProState.isPro === true;
}

export function getProDetails() {
    return cachedProState;
}

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
// 3. SECURE CHECKOUT HANDLER
// --------------------------------------------------------------------------
async function ensureRazorpaySDK() {
    if (typeof Razorpay !== "undefined") return true;

    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

function showInAppToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.innerText = message;
        toast.style.opacity = '1';
        toast.style.top = '100px';
        setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '80px'; }, 3500);
    }
}

async function triggerRazorpayCheckout(planKey, amountInRupees, planTitle, onSuccessCallback) {
    const user = auth.currentUser;
    if (!user) {
        showInAppToast("Please log in to upgrade to Pro!");
        return;
    }

    const upgradeBtn = document.getElementById("btnConfirmProUpgrade");
    if (upgradeBtn) {
        upgradeBtn.disabled = true;
        upgradeBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing Order...`;
    }

    await ensureRazorpaySDK();

    let orderData = null;
    try {
        const res = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountInRupees, plan: planKey })
        });
        orderData = await res.json();
    } catch (e) {
        console.error("Order creation request error:", e);
    }

    if (!orderData || !orderData.order_id || !orderData.key_id) {
        if (upgradeBtn) {
            upgradeBtn.disabled = false;
            upgradeBtn.innerHTML = `<i class="fa-solid fa-crown"></i> <span>Pay & Unlock for ₹${amountInRupees}</span>`;
        }
        showInAppToast(orderData?.error || "Could not initialize order.");
        return;
    }

    setPaymentProgressState(true);

    const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Anant Gallery",
        description: `Upgrade to Anant Pro - ${planTitle}`,
        image: "/icon-192.png",
        order_id: orderData.order_id,
        prefill: {
            name: user.displayName || "Anant User",
            email: user.email || "user@anant.gallery",
        },
        theme: {
            color: "#f59e0b"
        },
        handler: async function (response) {
            setPaymentProgressState(false);

            if (upgradeBtn) {
                upgradeBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying Payment...`;
            }

            try {
                const verifyRes = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
                    })
                });

                const verifyData = await verifyRes.json();

                if (verifyData.ok && verifyData.verified) {
                    let expiryDate = null;
                    if (planKey === "monthly") {
                        expiryDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
                    } else if (planKey === "annual") {
                        expiryDate = Date.now() + (365 * 24 * 60 * 60 * 1000);
                    }

                    await setDoc(doc(db, "users", user.uid), {
                        isPro: true,
                        proPlan: planKey,
                        proExpiry: expiryDate,
                        paymentId: response.razorpay_payment_id,
                        orderId: response.razorpay_order_id,
                        updatedAt: serverTimestamp()
                    }, { merge: true });

                    cachedProState = {
                        isPro: true,
                        plan: planKey,
                        expiry: expiryDate
                    };

                    localStorage.setItem("anant_is_pro", "true");
                    window.dispatchEvent(new CustomEvent('anant_pro_updated', { detail: cachedProState }));

                    if (onSuccessCallback) onSuccessCallback();
                    showInAppToast(`👑 Payment Verified! Welcome to Anant Pro (${planKey.toUpperCase()})`);
                } else {
                    showInAppToast("Payment verification failed! Please contact support.");
                }
            } catch (verErr) {
                console.error("Verification error:", verErr);
                showInAppToast("Network error during payment verification.");
            }
        },
        modal: {
            ondismiss: function() {
                setPaymentProgressState(false);
                if (upgradeBtn) {
                    upgradeBtn.disabled = false;
                    upgradeBtn.innerHTML = `<i class="fa-solid fa-crown"></i> <span>Pay & Unlock for ₹${amountInRupees}</span>`;
                }
            }
        }
    };

    try {
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (resp) {
            setPaymentProgressState(false);
            showInAppToast(`Payment Failed: ${resp.error?.description || 'Cancelled'}`);
            if (upgradeBtn) {
                upgradeBtn.disabled = false;
                upgradeBtn.innerHTML = `<i class="fa-solid fa-crown"></i> <span>Pay & Unlock for ₹${amountInRupees}</span>`;
            }
        });

        rzp.open();
    } catch (err) {
        setPaymentProgressState(false);
        console.error("Gateway error:", err);
        showInAppToast("Failed to open payment gateway.");
        if (upgradeBtn) {
            upgradeBtn.disabled = false;
            upgradeBtn.innerHTML = `<i class="fa-solid fa-crown"></i> <span>Pay & Unlock for ₹${amountInRupees}</span>`;
        }
    }
}

// --------------------------------------------------------------------------
// 4. SHOW PRO PAYWALL MODAL (100% PLAY STORE SAFE & DYNAMIC)
// --------------------------------------------------------------------------
export function showProPaywallModal(highlightReason = "Unlock All Features") {
    injectProStyles();

    let existing = document.getElementById("anantProModal");
    if (existing) existing.remove();

    const isPlayApp = isPlayStoreApp();
    const shouldShowReviewMode = isPlayApp && isReviewModeActive;

    const modal = document.createElement("div");
    modal.id = "anantProModal";
    modal.className = "pro-modal-overlay";

    let selectedPlan = "lifetime";
    let selectedAmount = 999;
    let selectedTitle = "Lifetime VIP Access";

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
                    <div class="pro-val">Biometrics & Decoy</div>
                </div>

                <div class="comparison-row">
                    <div class="feat-name"><i class="fa-solid fa-download"></i> Bulk Download</div>
                    <div class="free-val">5 Photos</div>
                    <div class="pro-val">Unlimited ZIP</div>
                </div>
            </div>

            ${shouldShowReviewMode ? `
                <!-- 🛡️ 100% PLAY STORE REVIEW SAFE SCREEN (NO RAZORPAY, NO VIOLATION) -->
                <div class="safe-preview-box">
                    <i class="fa-solid fa-circle-check" style="font-size:1.2rem; margin-bottom:6px; display:inline-block;"></i><br>
                    <strong>Anant Cloud Public Preview Active</strong><br>
                    Cloud backup and unlimited photo sync are currently enabled for all users.
                </div>
                <button class="btn-upgrade-pro" id="btnPreviewDone" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                    <i class="fa-solid fa-cloud"></i> <span>Cloud Access Active</span>
                </button>
            ` : `
                <!-- 👑 LIVE MONETIZATION SCREEN (RAZORPAY DIRECT) -->
                <div class="pro-pricing-grid">
                    <div class="pricing-plan-card" data-plan="monthly" data-amount="49" data-title="Monthly Plan">
                        <div class="plan-duration">Monthly</div>
                        <div class="plan-price">₹49</div>
                        <div class="plan-subtext">per month</div>
                    </div>

                    <div class="pricing-plan-card" data-plan="annual" data-amount="399" data-title="1 Year Plan">
                        <div class="plan-ribbon">SAVE 40%</div>
                        <div class="plan-duration">1 Year</div>
                        <div class="plan-price">₹399</div>
                        <div class="plan-subtext">₹33 / mo</div>
                    </div>

                    <div class="pricing-plan-card active" data-plan="lifetime" data-amount="999" data-title="Lifetime VIP Access">
                        <div class="plan-ribbon">BEST VALUE</div>
                        <div class="plan-duration">Lifetime</div>
                        <div class="plan-price">₹999</div>
                        <div class="plan-subtext">one-time pay</div>
                    </div>
                </div>

                <button class="btn-upgrade-pro" id="btnConfirmProUpgrade">
                    <i class="fa-solid fa-crown"></i> <span>Pay & Unlock for ₹999</span>
                </button>

                <div class="pro-secure-guarantee">
                    <i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> 100% Secure UPI / Card Checkout
                </div>
            `}
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById("closeProModal").onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    if (shouldShowReviewMode) {
        document.getElementById("btnPreviewDone")?.addEventListener("click", () => {
            showInAppToast("You have active access to Anant Cloud features!");
            close();
        });
    } else {
        const planCards = modal.querySelectorAll(".pricing-plan-card");
        const upgradeBtn = document.getElementById("btnConfirmProUpgrade");

        planCards.forEach(card => {
            card.onclick = () => {
                planCards.forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                selectedPlan = card.getAttribute("data-plan");
                selectedAmount = Number(card.getAttribute("data-amount"));
                selectedTitle = card.getAttribute("data-title");

                upgradeBtn.innerHTML = `<i class="fa-solid fa-crown"></i> <span>Pay & Unlock for ₹${selectedAmount}</span>`;
                if (navigator.vibrate) navigator.vibrate(10);
            };
        });

        upgradeBtn.onclick = () => {
            triggerRazorpayCheckout(selectedPlan, selectedAmount, selectedTitle, () => {
                close();
            });
        };
    }
}
