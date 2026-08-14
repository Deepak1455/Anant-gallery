// ==========================================================================
// APP SCREEN LAYOUT COMPONENT - SMART PWA INSTALL CARD-BOARD & THEME ENGINE
// ==========================================================================

let deferredPrompt = null;

// --------------------------------------------------------------------------
// 1. AUTO-INJECT APP SCREEN CSS STYLES (LIGHT / DARK THEME COMPATIBLE)
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
    background: var(--bg-glass, rgba(255, 255, 255, 0.92)); 
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

/* 🌟 SMART PWA INSTALL CARD BOARD STYLES */
#pwaInstallCard {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.14) 0%, rgba(147, 51, 234, 0.14) 100%) !important;
    border: 1.5px solid rgba(79, 70, 229, 0.3) !important;
    border-radius: 20px !important;
    padding: 14px 16px !important;
    margin: 12px 10px 8px 10px !important;
    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.12) !important;
    animation: pwaCardPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    position: relative;
    z-index: 10;
}

@keyframes pwaCardPop {
    0% { opacity: 0; transform: translateY(-10px) scale(0.95); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

.pwa-card-left {
    display: flex;
    align-items: center;
    gap: 12px;
    overflow: hidden;
}

.pwa-card-logo {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.8);
    flex-shrink: 0;
}

.pwa-card-text {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.pwa-card-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-main, #0f172a);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pwa-card-sub {
    font-size: 0.75rem;
    color: var(--text-muted, #64748b);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pwa-card-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

.pwa-install-btn {
    background: linear-gradient(135deg, var(--accent, #4f46e5) 0%, #9333ea 100%);
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    transition: transform 0.15s ease, opacity 0.2s;
}

.pwa-install-btn:active {
    transform: scale(0.94);
}

.pwa-close-btn {
    font-size: 1.1rem;
    color: var(--text-muted, #64748b);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    transition: color 0.2s;
}

.pwa-close-btn:hover {
    color: #ef4444;
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
// 2. AUTO-INJECT HTML LAYOUT
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
            <!-- 🌟 SMART PWA INSTALL CARD BOARD -->
            <div id="pwaInstallCard">
                <div class="pwa-card-left">
                    <img src="loadingphoto.png" class="pwa-card-logo" alt="Anant Gallery" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1375/1375106.png';">
                    <div class="pwa-card-text">
                        <div class="pwa-card-title">Install Anant Gallery</div>
                        <div class="pwa-card-sub">Get native app experience & fast multi-select</div>
                    </div>
                </div>
                <div class="pwa-card-right">
                    <button id="pwaInstallBtn" class="pwa-install-btn">Install</button>
                    <i class="fa-solid fa-xmark pwa-close-btn" id="pwaCloseBtn" title="Dismiss"></i>
                </div>
            </div>

            <div id="trashBanner" style="display:none;">
                <div class="trash-info">Items in trash are deleted forever after 30 days.</div>
            </div>
            <div id="galleryContent">
                <!-- Date Headers, Grids, or Profile go here -->
            </div>
        </div>

        <!-- ONLY PHONE PHOTO GALLERY INPUT ENGINE -->
        <input type="file" id="fileInput" accept="image/*" multiple style="position: absolute; top: -9999px; left: -9999px; opacity: 0; pointer-events: none;">

        <!-- SMART CARD-BOARD TOAST -->
        <div id="toast">Message</div>
    `;

    document.body.appendChild(appScreenDiv);
}

// --------------------------------------------------------------------------
// 3. SMART PWA INSTALL ENGINE (GUARANTEED VISIBILITY IN BROWSER)
// --------------------------------------------------------------------------
function initPwaInstallEngine() {
    const card = document.getElementById('pwaInstallCard');
    if (!card) return;

    // A. अगर ऐप पहले से इंस्टॉल होकर standalone मोड में चल रही है तो ही छुपाएँ
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    
    if (isStandalone) {
        card.style.display = 'none';
        return;
    }

    // B. ब्राउज़र में हमेशा कार्ड दिखाएँ (Clear any stale hide locks)
    card.style.display = 'flex';

    // C. PWA Install Event Catch
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!isStandalone) {
            card.style.display = 'flex';
        }
    });

    // D. जब ऐप सफलतापूर्वक इंस्टॉल हो जाए
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        card.style.display = 'none';
        
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = "Anant Gallery Installed Successfully!";
            toast.style.opacity = '1';
            toast.style.top = "100px";
            setTimeout(() => { toast.style.opacity = '0'; toast.style.top = "80px"; }, 3000);
        }
    });

    // E. Install Button Click Listener
    document.getElementById('pwaInstallBtn')?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                card.style.display = 'none';
            }
            deferredPrompt = null;
        } else {
            // Smart Universal Instructions for Android / iOS
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                alert("To Install: Tap Safari Share icon (↑) -> Tap 'Add to Home Screen'");
            } else {
                alert("To Install: Tap Chrome Menu (3-Dots ⋮) -> Tap 'Install app' or 'Add to Home screen'");
            }
        }
    });

    // F. Close (X) Button Listener (Hides temporarily for current page load)
    document.getElementById('pwaCloseBtn')?.addEventListener('click', () => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            card.style.display = 'none';
        }, 250);
    });
}

// --------------------------------------------------------------------------
// 4. MAIN INITIALIZATION FUNCTION
// --------------------------------------------------------------------------
export function initAppScreen() {
    injectStyles();
    injectHTML();
    initPwaInstallEngine();
}
