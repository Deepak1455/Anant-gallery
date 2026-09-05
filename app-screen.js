// ==========================================================================
// APP SCREEN LAYOUT & HIGH-PERFORMANCE PWA ENGINE (SMART SCROLL SELECTION)
// ==========================================================================

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
    padding: 8px;
    border-radius: 12px;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.menu-btn:active { 
    transform: scale(0.88); 
    background: rgba(0,0,0,0.05);
}

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

/* 🌟 SMART, FAST & SMOOTH HORIZONTAL SCROLL SELECTION HEADER */
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
    padding: 0 10px;
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

#cancelSelect {
    padding: 8px;
    cursor: pointer;
    font-size: 1.15rem;
    color: var(--text-main, #0f172a);
    border-radius: 50%;
    transition: transform 0.15s ease, background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

#cancelSelect:active {
    transform: scale(0.86);
    background: rgba(0,0,0,0.06);
}

#selectionCount { 
    font-weight: 700; 
    font-size: 0.95rem; 
    color: var(--text-main, #0f172a);
    white-space: nowrap;
}

/* 🌟 SMOOTH HORIZONTAL SCROLL BAR FOR ALL SELECTION ACTION ICONS */
.selection-actions { 
    display: flex; 
    gap: 8px; 
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    padding: 4px 4px 6px 4px;
    scroll-behavior: smooth;
    overscroll-behavior-x: contain;
    flex: 1;
    margin-left: auto;
    scroll-snap-type: x proximity;
}

/* SLEEK MODERN MICRO SCROLLBAR */
.selection-actions::-webkit-scrollbar { 
    height: 3px; 
}

.selection-actions::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.03);
    border-radius: 10px;
}

.selection-actions::-webkit-scrollbar-thumb {
    background: var(--accent, #4f46e5);
    border-radius: 10px;
}

.selection-actions i { 
    font-size: 1.2rem; 
    cursor: pointer; 
    padding: 8px 10px; 
    border-radius: 12px;
    color: var(--text-main, #0f172a);
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.14s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease;
    scroll-snap-align: start;
    user-select: none;
}

.selection-actions i:active { 
    transform: scale(0.85); 
    background: rgba(79, 70, 229, 0.1);
}

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

.btn-pwa-install:active { 
    transform: scale(0.92); 
}

.btn-pwa-close {
    background: transparent;
    border: none;
    color: var(--text-muted, #64748b);
    font-size: 0.95rem;
    padding: 6px;
    cursor: pointer;
    border-radius: 50%;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-pwa-close:active { 
    transform: scale(0.85); 
}

/* 🌟 CUSTOM INSTALL INSTRUCTION MODAL */
.pwa-guide-modal {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 10005;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
}

.pwa-guide-card {
    background: var(--bg-card, #ffffff);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.15));
    border-radius: 24px;
    padding: 24px 20px;
    width: 100%;
    max-width: 320px;
    text-align: center;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
    animation: popUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popUp {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

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
 * 🌟 Show Custom Visual PWA Install Guide
 */
function showInstallGuide() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let guide = document.createElement('div');
    guide.className = 'pwa-guide-modal';
    guide.innerHTML = `
        <div class="pwa-guide-card">
            <div class="pwa-install-icon-box" style="margin:0 auto 14px auto; width:52px; height:52px; font-size:1.5rem;">
                <i class="fa-solid fa-cloud-arrow-down"></i>
            </div>
            <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">Install Anant Gallery</h3>
            <p style="font-size:0.84rem; color:var(--text-muted); line-height:1.45; margin-bottom:20px;">
                ${isIOS 
                    ? `Tap the <strong>Share</strong> button <i class="fa-solid fa-arrow-up-from-bracket" style="color:var(--accent);"></i> at bottom and choose <strong>'Add to Home Screen'</strong>.`
                    : `Tap top-right menu <i class="fa-solid fa-ellipsis-vertical" style="color:var(--accent);"></i> and select <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong>.`}
            </p>
            <button id="closePwaGuide" style="width:100%; padding:12px; border-radius:14px; background:var(--accent); color:#ffffff; font-weight:700; border:none; cursor:pointer;">Got it!</button>
        </div>
    `;
    document.body.appendChild(guide);
    guide.querySelector('#closePwaGuide').onclick = () => guide.remove();
    guide.onclick = (e) => { if (e.target === guide) guide.remove(); };
}

/**
 * 🌟 Check & Render PWA Card Board
 */
export function checkAndRenderPWAInstallBanner() {
    if (isAppInstalled()) {
        removePWAInstallBannerImmediately();
        return;
    }

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

    // 🌟 Instant 1-Tap Native Install Trigger
    document.getElementById('btnPwaInstallAction')?.addEventListener('click', async () => {
        const promptEvent = window.deferredInstallPrompt;
        if (promptEvent) {
            promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            if (outcome === 'accepted') {
                smoothRemovePWABanner();
            }
            window.deferredInstallPrompt = null;
        } else {
            showInstallGuide();
        }
    });

    document.getElementById('btnPwaDismissAction')?.addEventListener('click', () => {
        sessionStorage.setItem('anant_pwa_dismissed', 'true');
        smoothRemovePWABanner();
    });
}

export function smoothRemovePWABanner() {
    const banner = document.getElementById('pwaInstallBoard');
    if (!banner) return;
    banner.classList.add('pwa-leaving');
    setTimeout(() => { banner.remove(); }, 280);
}

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

        <!-- 🌟 SMART ANDROID COMPATIBLE FILE INPUT (ZERO LAG & DIRECT GALLERY PICKER) -->
        <input type="file" id="fileInput" accept="image/*" multiple style="position:fixed; top:-9999px; left:-9999px; opacity:0; width:1px; height:1px; pointer-events:none;">
        <div id="toast">Message</div>
    `;

    document.body.appendChild(appScreenDiv);
}

function setupPWAEventListeners() {
    window.addEventListener('anant_pwa_ready', () => {
        if (!isAppInstalled()) {
            checkAndRenderPWAInstallBanner();
        }
    });

    window.addEventListener('appinstalled', () => {
        window.deferredInstallPrompt = null;
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
