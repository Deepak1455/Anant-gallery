// ==========================================================================
// APP SCREEN LAYOUT & CORE VIEW ENGINE (SMART SCROLL SELECTION)
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
`;

function injectStyles() {
    if (document.getElementById('app-screen-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-screen-styles';
    style.textContent = appScreenStyles;
    document.head.appendChild(style);
}

// 🌟 बैनर फ़ंक्शंस (यह सुनिश्चित करते हैं कि अगर कोई पुराना बैनर DOM में हो तो तुरंत हट जाए)
export function checkAndRenderPWAInstallBanner() {
    removePWAInstallBannerImmediately();
}

export function smoothRemovePWABanner() {
    removePWAInstallBannerImmediately();
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

        <!-- 🌟 DIRECT GALLERY PICKER -->
        <input type="file" id="fileInput" accept="image/*" multiple style="position:fixed; top:-9999px; left:-9999px; opacity:0; width:1px; height:1px; pointer-events:none;">
    `;

    document.body.appendChild(appScreenDiv);
}

export function initAppScreen() {
    injectStyles();
    injectHTML();
    removePWAInstallBannerImmediately();
}