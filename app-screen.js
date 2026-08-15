// ==========================================================================
// APP SCREEN LAYOUT & HIGH-PERFORMANCE PWA ENGINE (ULTRA-SMOOTH & FAST)
// ==========================================================================

let deferredInstallPrompt = null;

/**
 * 🌟 Smart Standalone & App Mode Detection
 */
export function isAppInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator.standalone === true;
    const isAndroidApp = document.referrer.includes('android-app://') || window.location.search.includes('mode=apk');

    return isStandalone || isIOSStandalone || isAndroidApp;
}

const appScreenStyles = `
#appScreen { 
    display: none; 
    flex-direction: column; 
    height: 100vh; 
    width: 100%; 
    opacity: 0; 
    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
    position: relative; 
    overflow: hidden;
    background: var(--bg-body, #f8fafc);
}

#mainHeader {
    height: 70px; 
    padding: 0 16px; 
    display: flex; 
    align-items: center; 
    justify-content: space-between;
    background: var(--bg-glass, rgba(255, 255, 255, 0.88)); 
    backdrop-filter: blur(16px); 
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
    position: absolute; 
    top: 0; 
    left: 0; 
    right: 0; 
    z-index: 50;
    box-shadow: 0 2px 12px rgba(0,0,0,0.03);
    transform: translateZ(0);
}

.header-left { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
}

.menu-btn { 
    font-size: 1.25rem; 
    cursor: pointer; 
    color: var(--text-main, #0f172a); 
    padding: 6px;
    border-radius: 10px;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease;
}

.menu-btn:active { transform: scale(0.9); }

.header-title-box { 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
}

.header-title { 
    font-size: 1.2rem; 
    font-weight: 700; 
    color: var(--text-main, #0f172a); 
    line-height: 1.1; 
}

.header-subtitle { 
    font-size: 0.75rem; 
    color: var(--accent, #4f46e5); 
    font-weight: 600; 
    margin-top: 3px; 
    letter-spacing: 0.3px; 
}

/* 🌟 SMOOTH HORIZONTAL SCROLLABLE SELECTION HEADER */
#selectionHeader {
    position: absolute; 
    top: 0; 
    left: 0; 
    right: 0; 
    height: 70px;
    background: var(--bg-card, #ffffff); 
    z-index: 51; 
    display: none;
    align-items: center; 
    justify-content: space-between; 
    padding: 0 12px;
    border-bottom: 2px solid var(--accent, #4f46e5);
    box-shadow: 0 4px 18px rgba(0,0,0,0.06);
    gap: 8px;
    transform: translateZ(0);
}

.selection-left-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

#selectionCount { 
    font-weight: 700; 
    font-size: 1rem; 
    color: var(--text-main, #0f172a);
    white-space: nowrap;
}

.selection-actions { 
    display: flex; 
    gap: 14px; 
    align-items: center;
    overflow-x: auto;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    padding: 4px 6px;
    scroll-behavior: smooth;
    flex: 1;
    justify-content: flex-end;
}

.selection-actions::-webkit-scrollbar { display: none; }

.selection-actions i { 
    font-size: 1.2rem; 
    cursor: pointer; 
    padding: 6px 8px; 
    border-radius: 8px;
    color: var(--text-main, #0f172a);
    flex-shrink: 0;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.selection-actions i:active { transform: scale(0.88); }

.scroll-container {
    flex: 1; 
    overflow-y: auto; 
    padding: 70px 0 100px 0;
    scroll-behavior: smooth; 
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
}

.trash-info {
    padding: 14px 18px; 
    text-align: center; 
    color: var(--text-muted, #64748b); 
    font-size: 0.85rem;
    background: var(--bg-card, #ffffff); 
    margin: 12px 10px; 
    border-radius: 14px;
    border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
}

/* 🌟 ULTRA-SMOOTH PWA INSTALL CARD BOARD */
.pwa-install-board {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.09) 0%, rgba(147, 51, 234, 0.09) 100%);
    border: 1px solid rgba(79, 70, 229, 0.22);
    border-radius: 20px;
    padding: 12px 14px;
    margin: 10px 10px 14px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.08);
    animation: pwaPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform, opacity;
}

.pwa-install-board.pwa-leaving {
    transform: scale(0.88) translateY(-14px) !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

@keyframes pwaPopIn {
    0% { opacity: 0; transform: translateY(-12px) scale(0.94); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

.pwa-install-left {
    display: flex;
    align-items: center;
    gap: 12px;
    overflow: hidden;
}

.pwa-install-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 1.25rem;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    overflow: hidden;
}

.pwa-install-icon-img { 
    width: 100%; 
    height: 100%; 
    object-fit: cover; 
}

.pwa-install-text-box {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.pwa-install-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-main, #0f172a);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pwa-install-sub {
    font-size: 0.72rem;
    color: var(--text-muted, #64748b);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pwa-install-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.btn-pwa-install {
    background: linear-gradient(135deg, var(--accent, #4f46e5) 0%, #9333ea 100%);
    color: #ffffff;
    border: none;
    padding: 8px 14px;
    border-radius: 12px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
}

.btn-pwa-install:active { transform: scale(0.92); }

.btn-pwa-close {
    background: transparent;
    border: none;
    color: var(--text-muted, #64748b);
    font-size: 0.95rem;
    padding: 6px;
    cursor: pointer;
    border-radius: 50%;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-pwa-close:active { transform: scale(0.85); }

#toast {
    position: fixed; 
    top: 80px; 
    left: 50%; 
    transform: translateX(-50%);
    background: var(--bg-card, #ffffff); 
    color: var(--text-main, #0f172a);
    padding: 12px 24px; 
    border-radius: 30px;
    font-size: 0.88rem; 
    font-weight: 600;
    z-index: 9999; 
    pointer-events: none; 
    opacity: 0; 
    border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), top 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
    max-width: 88%;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
`;

function injectStyles() {
    if (document.getElementById('app-screen-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-screen-styles';
    style.textContent = appScreenStyles;
    document.head.appendChild(style);
}

/**
 * 🌟 Fast PWA Card Checker & Renderer
 */
export function checkAndRenderPWAInstallBanner() {
    if (isAppInstalled()) {
        removePWAInstallBannerImmediately();
        return;
    }

    // यदि यूज़र ने इसी सेशन में कार्ड को क्लोज़ किया हो तो दोबारा न दिखाएं
    if (sessionStorage.getItem('anant_pwa_dismissed') === 'true') {
        return;
    }

    const scrollContainer = document.getElementById('scrollContainer');
    if (!scrollContainer) return;
    if (document.getElementById('pwaInstallBoard')) return;

    const pwaBoard = document.createElement('div');
    pwaBoard.id = 'pwaInstallBoard';
    pwaBoard.className = 'pwa-install-board';
    pwaBoard.innerHTML = `
        <div class="pwa-install-left">
            <div class="pwa-install-icon-box">
                <img src="loadingphoto.png" class="pwa-install-icon-img" alt="Anant" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fa-solid fa-infinity" style="display:none;"></i>
            </div>
            <div class="pwa-install-text-box">
                <div class="pwa-install-title">Install Anant Gallery</div>
                <div class="pwa-install-sub">Faster experience & offline cloud</div>
            </div>
        </div>
        <div class="pwa-install-actions">
            <button class="btn-pwa-install" id="btnPwaInstallAction">Install App</button>
            <button class="btn-pwa-close" id="btnPwaDismissAction" title="Dismiss">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    const galleryContent = document.getElementById('galleryContent');
    if (galleryContent) {
        scrollContainer.insertBefore(pwaBoard, galleryContent);
    } else {
        scrollContainer.prepend(pwaBoard);
    }

    // 🌟 Install Click Handler
    document.getElementById('btnPwaInstallAction')?.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                smoothRemovePWABanner();
            }
            deferredInstallPrompt = null;
        } else {
            // iOS Safari & Other Browsers Smart Instructions
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                alert("To Install: Tap the Share button (⎋) at the bottom and select 'Add to Home Screen' (+).");
            } else {
                alert("To Install: Tap your browser menu (⋮) at top-right and select 'Install app' or 'Add to Home screen'.");
            }
        }
    });

    // 🌟 Dismiss Click Handler
    document.getElementById('btnPwaDismissAction')?.addEventListener('click', () => {
        sessionStorage.setItem('anant_pwa_dismissed', 'true');
        smoothRemovePWABanner();
    });
}

/**
 * 🌟 Smooth Slide-Out Removal
 */
export function smoothRemovePWABanner() {
    const banner = document.getElementById('pwaInstallBoard');
    if (!banner) return;
    banner.classList.add('pwa-leaving');
    setTimeout(() => { banner.remove(); }, 280);
}

/**
 * 🌟 Immediate Removal (Used when App runs in standalone mode)
 */
export function removePWAInstallBannerImmediately() {
    const banner = document.getElementById('pwaInstallBoard');
    if (banner) banner.remove();
}

function injectHTML() {
    if (document.getElementById('appScreen')) return;

    const appScreenDiv = document.createElement('div');
    appScreenDiv.id = 'appScreen';
    appScreenDiv.innerHTML = `
        <header id="mainHeader">
            <div class="header-left">
                <i class="fa-solid fa-bars menu-btn" id="menuBtn"></i>
                <div class="header-title-box">
                    <div class="header-title" id="pageTitle">My Photos</div>
                    <div class="header-subtitle" id="photoCountBadge">0 photos</div>
                </div>
            </div>
            <div class="header-actions">
                <i class="fa-solid fa-cloud-arrow-up" id="forceUploadBtn" style="font-size: 1.3rem; cursor: pointer; color: var(--text-main);" title="Upload Photo"></i>
            </div>
        </header>

        <!-- 🌟 SMART SCROLLABLE SELECTION HEADER -->
        <div id="selectionHeader">
            <div class="selection-left-group">
                <i class="fa-solid fa-xmark" id="cancelSelect" style="padding:8px; cursor:pointer; font-size:1.15rem;"></i>
                <div id="selectionCount">0 Selected</div>
            </div>
            <div class="selection-actions" id="selectActions"></div>
        </div>

        <div class="scroll-container" id="scrollContainer">
            <div id="trashBanner" style="display:none;">
                <div class="trash-info">Items in trash are deleted forever after 30 days.</div>
            </div>
            <div id="galleryContent"></div>
        </div>

        <input type="file" id="fileInput" hidden accept="image/jpeg,image/png,image/webp,image/heic,image/gif,image/*" multiple>
        <div id="toast">Message</div>
    `;

    document.body.appendChild(appScreenDiv);
}

function setupPWAEventListeners() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (!isAppInstalled()) {
            checkAndRenderPWAInstallBanner();
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        smoothRemovePWABanner();
    });

    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
        if (e.matches) removePWAInstallBannerImmediately();
    });
}

export function initAppScreen() {
    injectStyles();
    injectHTML();
    setupPWAEventListeners();

    if (!isAppInstalled()) {
        setTimeout(() => checkAndRenderPWAInstallBanner(), 300);
    }
}
