// ==========================================================================
// APP SCREEN LAYOUT COMPONENT - SMART CARD-BOARD TOAST & THEME ENGINE
// ==========================================================================

// 1. AUTO-INJECT APP SCREEN CSS STYLES (LIGHT / DARK THEME COMPATIBLE)
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

// 2. AUTO-INJECT HTML LAYOUT
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

// 3. MAIN INITIALIZATION FUNCTION
export function initAppScreen() {
    injectStyles();
    injectHTML();
}