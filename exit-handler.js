// ==========================================================================
// SMART EXIT HANDLER & LAYERED BACK-NAVIGATION MANAGER
// ==========================================================================

import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --------------------------------------------------------------------------
// 1. DYNAMIC LIGHT & DARK THEME EXIT MODAL CSS
// --------------------------------------------------------------------------
const injectExitStyles = () => {
    if (document.getElementById('exit-styles')) return;
    const style = document.createElement('style');
    style.id = 'exit-styles';
    style.textContent = `
        /* Exit Modal Overlay */
        #exitModalOverlay {
            position: fixed; 
            inset: 0;
            background: rgba(15, 23, 42, 0.72);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 10000;
            display: flex; 
            align-items: center; 
            justify-content: center;
            opacity: 0; 
            pointer-events: none;
            transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #exitModalOverlay.active {
            opacity: 1; 
            pointer-events: auto;
        }

        /* Exit Modal Card */
        .exit-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
            border-radius: 28px;
            padding: 30px 24px 24px 24px;
            width: 90%; 
            max-width: 340px;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            transform: scale(0.85) translateY(15px);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        #exitModalOverlay.active .exit-modal-card {
            transform: scale(1) translateY(0);
        }

        /* Exit Icon Box */
        .exit-icon-box {
            width: 64px; 
            height: 64px;
            background: rgba(239, 68, 68, 0.12);
            color: #ef4444;
            border-radius: 50%;
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-size: 1.6rem;
            margin: 0 auto 18px auto;
            border: 1px solid rgba(239, 68, 68, 0.2);
            box-shadow: 0 8px 20px rgba(239, 68, 68, 0.15);
        }

        .exit-title {
            font-size: 1.3rem; 
            font-weight: 700; 
            color: var(--text-main, #0f172a); 
            margin-bottom: 8px;
        }
        .exit-sub {
            font-size: 0.88rem; 
            color: var(--text-muted, #64748b); 
            margin-bottom: 24px; 
            line-height: 1.45;
        }

        /* Modal Buttons */
        .exit-btn-group {
            display: flex; 
            gap: 12px;
        }
        .exit-btn {
            flex: 1; 
            padding: 14px;
            border-radius: 16px; 
            border: none;
            font-weight: 600; 
            font-size: 0.95rem;
            cursor: pointer; 
            transition: transform 0.15s, background 0.2s;
        }
        .exit-btn-cancel {
            background: rgba(100, 116, 139, 0.12); 
            color: var(--text-muted, #64748b);
        }
        .exit-btn-cancel:active { 
            transform: scale(0.95); 
        }
        .exit-btn-confirm {
            background: #ef4444; 
            color: #ffffff;
            box-shadow: 0 8px 20px rgba(239, 68, 68, 0.35);
        }
        .exit-btn-confirm:active { 
            transform: scale(0.95); 
        }

        /* Ultra Smooth App Exit Keyframes */
        .app-exit-smooth {
            animation: appExitAnim 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
        @keyframes appExitAnim {
            0% {
                opacity: 1;
                transform: scale(1);
                filter: blur(0px);
            }
            100% {
                opacity: 0;
                transform: scale(0.92) translateY(12px);
                filter: blur(10px);
            }
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. DYNAMIC EXIT MODAL HTML
// --------------------------------------------------------------------------
const createExitModalHTML = () => {
    if (document.getElementById('exitModalOverlay')) return;
    
    const modal = document.createElement('div');
    modal.id = 'exitModalOverlay';
    modal.innerHTML = `
        <div class="exit-modal-card">
            <div class="exit-icon-box">
                <i class="fa-solid fa-right-from-bracket"></i>
            </div>
            <div class="exit-title">Exit Anant Gallery?</div>
            <div class="exit-sub">Are you sure you want to exit and close your secure cloud session?</div>
            <div class="exit-btn-group">
                <button class="exit-btn exit-btn-cancel" id="exitCancelBtn">Stay Here</button>
                <button class="exit-btn exit-btn-confirm" id="exitConfirmBtn">Log Out</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// --------------------------------------------------------------------------
// 3. SMART EXIT MANAGER CLASS
// --------------------------------------------------------------------------
export class SmartExitManager {
    constructor(appCallbacks) {
        this.callbacks = appCallbacks;
        this.modalOverlay = null;
        this.lastBackPressTime = 0;
        this.init();
    }

    init() {
        injectExitStyles();
        createExitModalHTML();

        this.modalOverlay = document.getElementById('exitModalOverlay');

        document.getElementById('exitCancelBtn')?.addEventListener('click', () => this.hideExitModal());
        document.getElementById('exitConfirmBtn')?.addEventListener('click', () => this.performSmoothExit());

        this.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.hideExitModal();
        });

        // Keyboard 'Escape' Key support for Desktop
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleSmartBackPress();
            }
        });

        this.setupHistoryState();
    }

    setupHistoryState() {
        window.history.pushState({ page: 'gallery' }, null, window.location.href);

        window.addEventListener('popstate', () => {
            window.history.pushState({ page: 'gallery' }, null, window.location.href);
            this.handleSmartBackPress();
        });
    }

    // ----------------------------------------------------------------------
    // SMART LAYER-BY-LAYER BACK PRESS HANDLER
    // ----------------------------------------------------------------------
    handleSmartBackPress() {
        const now = Date.now();
        if (now - this.lastBackPressTime < 250) return;
        this.lastBackPressTime = now;

        if (navigator.vibrate) navigator.vibrate(20);

        if (this.modalOverlay && this.modalOverlay.classList.contains('active')) {
            this.hideExitModal();
            return;
        }

        if (this.callbacks.isLightboxOpen && this.callbacks.isLightboxOpen()) {
            this.callbacks.closeLightbox();
            return;
        }

        if (this.callbacks.isSelectionMode && this.callbacks.isSelectionMode()) {
            this.callbacks.exitSelection();
            return;
        }

        if (this.callbacks.isSidebarOpen && this.callbacks.isSidebarOpen()) {
            this.callbacks.closeSidebar();
            return;
        }

        if (this.callbacks.getCurrentView && this.callbacks.getCurrentView() !== 'photos') {
            this.callbacks.switchView('photos');
            return;
        }

        this.showExitModal();
    }

    showExitModal() {
        if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
        if (this.modalOverlay) this.modalOverlay.classList.add('active');
    }

    hideExitModal() {
        if (this.modalOverlay) this.modalOverlay.classList.remove('active');
    }

    async performSmoothExit() {
        this.hideExitModal();

        const appScreen = document.getElementById('appScreen');
        if (appScreen) {
            appScreen.classList.add('app-exit-smooth');
        }

        await new Promise(resolve => setTimeout(resolve, 320));

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Logout Error:", err);
        } finally {
            if (appScreen) appScreen.classList.remove('app-exit-smooth');
        }
    }
}