// ==========================================================================
// APP SCREEN LAYOUT COMPONENT - SMART CARD-BOARD TOAST, THEME & PWA INSTALL
// ==========================================================================

let deferredInstallPrompt = null;

// --------------------------------------------------------------------------
// 1. CHECK IF APP IS ALREADY INSTALLED (PWA / APK STANDALONE CHECK)
// --------------------------------------------------------------------------
export function isAppInstalled() {
    // 1. Android / Chrome / Desktop PWA Standalone Mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // 2. iOS Safari Add to Home Screen Mode
    const isIOSStandalone = window.navigator.standalone === true;
    // 3. Android TWA / APK Wrapper Check
    const isAndroidApp = document.referrer.includes('android-app://') || window.location.search.includes('mode=apk');
    // 4. LocalStorage Dismiss / Install Flag
    const isManuallyInstalled = localStorage.getItem('anant_app_installed') === 'true';

    return isStandalone || isIOSStandalone || isAndroidApp || isManuallyInstalled;
}

// --------------------------------------------------------------------------
// 2. AUTO-INJECT APP SCREEN CSS STYLES (LIGHT / DARK & PWA GLASS CARD)
// --------------------------------------------------------------------------
const appScreenStyles = `
/* APP SCREEN CONTAINER */
#appScreen { 
    display: none; 
    flex-direction: column; 
    height: 100vh; 
    width: 100%; 
    opacity: 0; 
    transition: opacity 0.35s ease; 
    position: relative; 
    overflow: hidden;
    background: var(--bg-body, #f8fafc);
}

/* MAIN HEADER GLASS CARD BOARD */
#mainHeader {
    height: 70px; 
    padding: 0 20px; 
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
}

.header-left { 
    display: flex; 
    align-items: center; 
    gap: 15px; 
}

.menu-btn { 
    font-size: 1.25rem; 
    cursor: pointer; 
    color: var(--text-main, #0f172a); 
    padding: 6px;
    border-radius: 10px;
    transition: transform 0.15s ease, background 0.2s ease;
}

.menu-btn:active {
    transform: scale(0.9);
}

.header-title-box { 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
}

.header-title { 
    font-size: 1.25rem; 
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

/* SELECTION HEADER CARD BOARD */
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
    padding: 0 20px;
    border-bottom: 2px solid var(--accent, #4f46e5);
    box-shadow: 0 4px 18px rgba(0,0,0,0.06);
}

#selectionCount { 
    font-weight: 600; 
    font-size: 1.15rem; 
    color: var(--text-main, #0f172a);
}

.selection-actions { 
    display: flex; 
    gap: 18px; 
    align-items: center;
}

.selection-actions i { 
    font-size: 1.25rem; 
    cursor: pointer; 
    padding: 6px; 
    border-radius: 8px;
    color: var(--text-main, #0f172a);
    transition: transform 0.15s ease;
}

.selection-actions i:active {
    transform: scale(0.88);
}

.scroll-container {
    flex: 1; 
    overflow-y: auto; 
    padding: 70px 0 100px 0;
    scroll-behavior: smooth; 
    -webkit-overflow-scrolling: touch;
}

/* TRASH INFO BANNER */
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

/* 🌟 SMART PWA / APK INSTALL CARD BOARD */
.pwa-install-board {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%);
    border: 1px solid rgba(79, 70, 229, 0.22);
    border-radius: 20px;
    padding: 12px 14px;
    margin: 10px 10px 14px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 4px 18px rgba(79, 70, 229, 0.06);
    animation: pwaPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.pwa-install-board.pwa-leaving {
    transform: scale(0.85) translateY(-14px) !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

@keyframes pwaPopIn {
    0% { opacity: 0; transform: translateY(-10px) scale(0.95); }
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
    transition: transform 0.15s ease;
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
    transition: transform 0.15s ease;
}

.btn-pwa-close:active {
    transform: scale(0.85);
}

/* 🌟 ULTRA-SMOOTH CARD-BOARD FLOATING TOAST NOTIFICATION */
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

// --------------------------------------------------------------------------
// 3. PWA INSTALL BANNER CONTROLLER (AUTO-REMOVE ON INSTALLED)
// --------------------------------------------------------------------------
export function checkAndRenderPWAInstallBanner() {
    // 🌟 अगर ऐप पहले से इंस्टॉल है या APK मोड में है, तो कार्ड कभी नहीं दिखेगा
    if (isAppInstalled()) {
        removePWAInstallBannerImmediately();
        return;
    }

    const scrollContainer = document.getElementById('scrollContainer');
    if (!scrollContainer) return;

    // अगर पहले से कार्ड मौजूद है तो दोबारा न बनाएं
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

    // गैलरी कंटेंट से ठीक ऊपर जोड़ें
    const galleryContent = document.getElementById('galleryContent');
    if (galleryContent) {
        scrollContainer.insertBefore(pwaBoard, galleryContent);
    } else {
        scrollContainer.prepend(pwaBoard);
    }

    // इंस्टॉल बटन क्लिक हैंडलर
    document.getElementById('btnPwaInstallAction')?.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                localStorage.setItem('anant_app_installed', 'true');
                smoothRemovePWABanner();
            }
            deferredInstallPrompt = null;
        } else {
            // iOS या ब्राउज़र प्रॉम्प्ट फॉलबैक
            alert("To install: Tap the browser share/menu button (⋮ or Share) and select 'Add to Home Screen' / 'Install App'.");
        }
    });

    // डिसमिस बटन (स्मूथ क्लोज)
    document.getElementById('btnPwaDismissAction')?.addEventListener('click', () => {
        smoothRemovePWABanner();
    });
}

export function smoothRemovePWABanner() {
    const banner = document.getElementById('pwaInstallBoard');
    if (!banner) return;
    banner.classList.add('pwa-leaving');
    setTimeout(() => {
        banner.remove();
    }, 280);
}

export function removePWAInstallBannerImmediately() {
    const banner = document.getElementById('pwaInstallBoard');
    if (banner) banner.remove();
}

// --------------------------------------------------------------------------
// 4. AUTO-INJECT HTML LAYOUT
// --------------------------------------------------------------------------
function injectHTML() {
    if (document.getElementById('appScreen')) return;

    const appScreenDiv = document.createElement('div');
    appScreenDiv.id = 'appScreen';
    appScreenDiv.innerHTML = `
        <!-- Normal Header -->
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

        <!-- Selection Header -->
        <div id="selectionHeader">
            <i class="fa-solid fa-xmark" id="cancelSelect" style="padding:10px; cursor:pointer;"></i>
            <div id="selectionCount">0 Selected</div>
            <div class="selection-actions" id="selectActions">
                <!-- Injected via JS based on context -->
            </div>
        </div>

        <!-- Scrollable Area -->
        <div class="scroll-container" id="scrollContainer">
            <div id="trashBanner" style="display:none;">
                <div class="trash-info">Items in trash are deleted forever after 30 days.</div>
            </div>
            <div id="galleryContent">
                <!-- Date Headers, Grids, or Profile go here -->
            </div>
        </div>

        <input type="file" id="fileInput" hidden accept="image/jpeg,image/png,image/webp,image/heic,image/gif,image/*" multiple>

        <!-- SMART CARD-BOARD TOAST -->
        <div id="toast">Message</div>
    `;

    document.body.appendChild(appScreenDiv);
}

// --------------------------------------------------------------------------
// 5. SETUP GLOBAL PWA EVENT LISTENERS
// --------------------------------------------------------------------------
function setupPWAEventListeners() {
    // 🌟 1. ब्राउज़र का 'beforeinstallprompt' इवेंट कैप्चर करना
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;

        // अगर पहले से ऐप में नहीं है तभी कार्ड रेंडर करो
        if (!isAppInstalled()) {
            checkAndRenderPWAInstallBanner();
        }
    });

    // 🌟 2. ऐप इंस्टॉल होते ही तुरंत बैनर रिमूव करना
    window.addEventListener('appinstalled', () => {
        localStorage.setItem('anant_app_installed', 'true');
        deferredInstallPrompt = null;
        smoothRemovePWABanner();
    });

    // 🌟 3. डिस्प्ले मोड बदलने पर (जैसे स्टैंडअलोन में स्विच होने पर)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
        if (e.matches) {
            removePWAInstallBannerImmediately();
        }
    });
}

// --------------------------------------------------------------------------
// 6. MAIN INITIALIZATION FUNCTION
// --------------------------------------------------------------------------
export function initAppScreen() {
    injectStyles();
    injectHTML();
    setupPWAEventListeners();

    // प्रारंभिक चेक
    if (!isAppInstalled()) {
        setTimeout(() => checkAndRenderPWAInstallBanner(), 600);
    }
}
