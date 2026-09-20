// ==========================================================================
// SMART EXIT & LAYERED BACK-NAVIGATION ENGINE (60FPS ULTRA-SMOOTH)
// ==========================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --------------------------------------------------------------------------
// 1. DYNAMIC ULTRA-SMOOTH 60FPS CSS (NO LAGGY BLURS)
// --------------------------------------------------------------------------
const injectExitStyles = () => {
    if (document.getElementById('exit-styles')) return;
    const style = document.createElement('style');
    style.id = 'exit-styles';
    style.textContent = `
        /* 🌟 NATIVE DOUBLE-BACK EXIT TOAST PILL */
        #exitQuickToast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translate3d(-50%, 60px, 0);
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            padding: 10px 22px;
            border-radius: 30px;
            font-size: 0.84rem;
            font-weight: 700;
            z-index: 1000006 !important;
            opacity: 0;
            pointer-events: none;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease;
            white-space: nowrap;
            user-select: none;
        }

        #exitQuickToast.show {
            transform: translate3d(-50%, 0, 0);
            opacity: 1;
        }

        /* 🌟 LOGOUT MODAL OVERLAY */
        #exitModalOverlay {
            position: fixed; 
            inset: 0;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            z-index: 1000005;
            display: flex; 
            align-items: center; 
            justify-content: center;
            opacity: 0; 
            pointer-events: none;
            transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
        }

        #exitModalOverlay.active {
            opacity: 1; 
            pointer-events: auto;
        }

        /* LOGOUT CARD WITH HARDWARE ACCELERATION */
        .exit-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
            border-radius: 28px;
            padding: 26px 20px 20px 20px;
            width: 90%; 
            max-width: 325px;
            text-align: center;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
            transform: translate3d(0, 15px, 0) scale(0.92);
            transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            will-change: transform;
        }

        #exitModalOverlay.active .exit-modal-card {
            transform: translate3d(0, 0, 0) scale(1);
        }

        .exit-icon-box {
            width: 58px; 
            height: 58px;
            background: rgba(239, 68, 68, 0.12);
            color: #ef4444;
            border-radius: 50%;
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-size: 1.45rem;
            margin: 0 auto 14px auto;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .exit-title {
            font-size: 1.2rem; 
            font-weight: 800; 
            color: var(--text-main, #0f172a); 
            margin-bottom: 6px;
        }

        .exit-sub {
            font-size: 0.82rem; 
            color: var(--text-muted, #64748b); 
            margin-bottom: 20px; 
            line-height: 1.45;
        }

        .exit-btn-group {
            display: flex; 
            gap: 10px;
        }

        .exit-btn {
            flex: 1; 
            padding: 12px;
            border-radius: 14px; 
            border: none;
            font-weight: 700; 
            font-size: 0.9rem;
            cursor: pointer; 
            transition: transform 0.14s ease;
        }

        .exit-btn:active { 
            transform: scale(0.95); 
        }

        .exit-btn-cancel {
            background: rgba(100, 116, 139, 0.12); 
            color: var(--text-muted, #64748b);
        }

        .exit-btn-confirm {
            background: #ef4444; 
            color: #ffffff;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
        }

        /* 🌟 SILKY APP LOGOUT ANIMATION */
        .app-exit-smooth {
            transition: opacity 0.22s ease, transform 0.22s ease !important;
            opacity: 0 !important;
            transform: scale(0.96) !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. DOM INJECTION FOR QUICK TOAST & LOGOUT MODAL
// --------------------------------------------------------------------------
const createExitElements = () => {
    if (!document.getElementById('exitQuickToast')) {
        const toastEl = document.createElement('div');
        toastEl.id = 'exitQuickToast';
        toastEl.innerText = "Press back again to exit";
        document.body.appendChild(toastEl);
    }

    if (!document.getElementById('exitModalOverlay')) {
        const modal = document.createElement('div');
        modal.id = 'exitModalOverlay';
        modal.innerHTML = `
            <div class="exit-modal-card">
                <div class="exit-icon-box">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </div>
                <div class="exit-title">Log Out of Gallery?</div>
                <div class="exit-sub">Are you sure you want to sign out of your account on this device?</div>
                <div class="exit-btn-group">
                    <button class="exit-btn exit-btn-cancel" id="exitCancelBtn">Cancel</button>
                    <button class="exit-btn exit-btn-confirm" id="exitConfirmBtn">Log Out</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
};

// --------------------------------------------------------------------------
// 3. SMART EXIT MANAGER CLASS
// --------------------------------------------------------------------------
export class SmartExitManager {
    constructor(appCallbacks) {
        this.callbacks = appCallbacks;
        this.modalOverlay = null;
        this.quickToast = null;
        this.lastBackTime = 0;
        this.toastTimer = null;
        this.isExiting = false;
        this.init();
    }

    init() {
        injectExitStyles();
        createExitElements();

        this.modalOverlay = document.getElementById('exitModalOverlay');
        this.quickToast = document.getElementById('exitQuickToast');

        document.getElementById('exitCancelBtn')?.addEventListener('click', () => this.hideExitModal());
        document.getElementById('exitConfirmBtn')?.addEventListener('click', () => this.performSmoothLogout());

        this.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.hideExitModal();
        });

        // Desktop Escape Key Support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.handleSmartBackPress();
        });

        this.setupHistoryStack();
    }

    setupHistoryStack() {
        // सिंगल क्लीन हिस्ट्री स्टेट (ताकि ब्राउज़र लूप में न फँसे)
        window.history.replaceState({ root: true }, null, window.location.href);
        window.history.pushState({ page: 'main' }, null, window.location.href);

        window.addEventListener('popstate', () => {
            if (this.isExiting) return;
            const handled = this.handleSmartBackPress();
            
            // अगर बैक अभी ऐप को एग्जिट नहीं कर रहा, तो स्टेट रीस्टोर रखें
            if (handled) {
                window.history.pushState({ page: 'main' }, null, window.location.href);
            }
        });
    }

    // ----------------------------------------------------------------------
    // 🌟 SMART 5-LEVEL BACK PRESS ROUTING
    // ----------------------------------------------------------------------
    handleSmartBackPress() {
        // 1. अगर लॉगआउट मॉडल खुला है तो बंद करो
        if (this.modalOverlay && this.modalOverlay.classList.contains('active')) {
            this.hideExitModal();
            return true;
        }

        // 2. अगर कोई फोटो फुलस्क्रीन खुली है तो बंद करो
        if (this.callbacks.isLightboxOpen && this.callbacks.isLightboxOpen()) {
            this.callbacks.closeLightbox();
            return true;
        }

        // 3. अगर फोटो सिलेक्शन मोड ऑन है तो बंद करो
        if (this.callbacks.isSelectionMode && this.callbacks.isSelectionMode()) {
            this.callbacks.exitSelection();
            return true;
        }

        // 4. अगर साइडबार खुला है तो बंद करो
        if (this.callbacks.isSidebarOpen && this.callbacks.isSidebarOpen()) {
            this.callbacks.closeSidebar();
            return true;
        }

        // 5. अगर होम स्क्रीन (Photos) पर नहीं हैं तो पहले होम पर ले जाओ
        if (this.callbacks.getCurrentView && this.callbacks.getCurrentView() !== 'photos') {
            this.callbacks.switchView('photos');
            return true;
        }

        // 🌟 6. होम स्क्रीन पर नेटिव डबल-टैप एग्जिट (बिना लॉगआउट किए)
        const now = Date.now();
        if (now - this.lastBackTime < 2000) {
            // 2 सेकंड में दोबारा दबाया ➔ सीधे ऐप बंद करें
            this.isExiting = true;
            this.hideQuickToast();
            
            const appScreen = document.getElementById('appScreen');
            if (appScreen) appScreen.classList.add('app-exit-smooth');

            setTimeout(() => {
                window.history.back(); // नेटिव बैक एग्जिट
            }, 100);
            return false;
        }

        // पहला बैक प्रेस ➔ सिर्फ टोस्ट दिखाएँ और हल्का वाइब्रेट करें
        this.lastBackTime = now;
        if (navigator.vibrate) navigator.vibrate(18);
        this.showQuickToast();
        return true;
    }

    showQuickToast() {
        if (!this.quickToast) return;
        if (this.toastTimer) clearTimeout(this.toastTimer);

        this.quickToast.classList.add('show');
        this.toastTimer = setTimeout(() => {
            this.hideQuickToast();
        }, 1900);
    }

    hideQuickToast() {
        if (this.quickToast) this.quickToast.classList.remove('show');
    }

    showExitModal() {
        if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
        if (this.modalOverlay) this.modalOverlay.classList.add('active');
    }

    hideExitModal() {
        if (this.modalOverlay) this.modalOverlay.classList.remove('active');
    }

    // साइडबार से जब यूज़र खुद लॉगआउट पर क्लिक करे
    async performSmoothLogout() {
        this.hideExitModal();

        const appScreen = document.getElementById('appScreen');
        if (appScreen) appScreen.classList.add('app-exit-smooth');

        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Logout Error:", err);
        } finally {
            if (appScreen) appScreen.classList.remove('app-exit-smooth');
        }
    }
}
