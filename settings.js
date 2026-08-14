// ==========================================================================
// APP PREFERENCES & SMART SUNSET-TO-SUNRISE AUTO THEME ENGINE
// ==========================================================================

const KEYS = {
    THEME: 'app_theme',
    GRID_COLS: 'app_grid_cols',
    PIN: 'app_pin_code',
    PIN_ENABLED: 'app_pin_enabled'
};

let isUnlocked = false;
let autoThemeCheckInterval = null;

// System Color Scheme Query
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// Toast Helper
const showToast = (msg) => {
    const toast = document.getElementById('toast');
    if (!toast) return alert(msg);
    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.top = "100px";
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        toast.style.top = "80px"; 
    }, 2500);
};

// --------------------------------------------------------------------------
// 1. SMART TIME-AWARE + SYSTEM THEME APPLIER
// --------------------------------------------------------------------------
export function isNightTime() {
    const currentHour = new Date().getHours();
    // 7:00 PM (19) से लेकर सुबह 6:00 AM (6) तक रात मानी जाएगी
    return currentHour >= 19 || currentHour < 6;
}

export function applyTheme(themeMode) {
    let effectiveTheme = themeMode;

    if (!themeMode || themeMode === 'auto') {
        // 🌟 DUAL DETECTION: या तो फोन का डार्क मोड ON हो या रात का समय हो (7 PM - 6 AM)
        const isDarkRequired = systemDarkQuery.matches || isNightTime();
        effectiveTheme = isDarkRequired ? 'dark' : 'light';
    }

    // Set Attributes on Root Elements
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.body.setAttribute('data-theme', effectiveTheme);

    // 🌟 Sync Mobile Browser Status Bar Color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', effectiveTheme === 'dark' ? '#0f172a' : '#f8fafc');
    }
}

// --------------------------------------------------------------------------
// 2. REALTIME LISTENERS & AUTO NIGHT WATCHER
// --------------------------------------------------------------------------
const handleThemeCheck = () => {
    const savedTheme = localStorage.getItem(KEYS.THEME) || 'auto';
    if (savedTheme === 'auto') {
        applyTheme('auto');

        const manualToggle = document.getElementById('manualThemeToggle');
        if (manualToggle) {
            const isDarkNow = systemDarkQuery.matches || isNightTime();
            manualToggle.checked = isDarkNow;
        }
    }
};

// Listen to System Dark Mode Toggle
if (systemDarkQuery.addEventListener) {
    systemDarkQuery.addEventListener('change', handleThemeCheck);
} else if (systemDarkQuery.addListener) {
    systemDarkQuery.addListener(handleThemeCheck);
}

// 🌟 Start Interval to automatically turn Dark Mode at 7:00 PM without reloading
if (!autoThemeCheckInterval) {
    autoThemeCheckInterval = setInterval(() => {
        const savedTheme = localStorage.getItem(KEYS.THEME) || 'auto';
        if (savedTheme === 'auto') {
            applyTheme('auto');
        }
    }, 60000); // Check every minute
}

// --------------------------------------------------------------------------
// 3. DYNAMIC CSS FOR LIGHT / DARK THEMES & PIN LOCK
// --------------------------------------------------------------------------
const injectSettingsStyles = () => {
    let existingStyle = document.getElementById('settings-styles');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'settings-styles';
    style.textContent = `
        /* Smooth Theme Fade Animation */
        body, #appScreen, .profile-card, .settings-card, header, #sidebar, .all-photos-board, .albums-main-board {
            transition: background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease !important;
        }

        /* 🌟 LIGHT THEME (EXPLICIT) */
        [data-theme="light"] {
            --bg-body: #f8fafc !important;
            --bg-card: #ffffff !important;
            --bg-glass: rgba(255, 255, 255, 0.92) !important;
            --accent: #4f46e5 !important;
            --accent-glow: rgba(79, 70, 229, 0.25) !important;
            --danger: #ef4444 !important;
            --success: #16a34a !important;
            --text-main: #0f172a !important;
            --text-muted: #64748b !important;
            --border: rgba(0, 0, 0, 0.08) !important;
        }

        /* 🌟 EYE-FRIENDLY NIGHT DARK THEME */
        [data-theme="dark"] {
            --bg-body: #0f172a !important;
            --bg-card: #1e293b !important;
            --bg-glass: rgba(15, 23, 42, 0.94) !important;
            --accent: #818cf8 !important;
            --accent-glow: rgba(129, 140, 248, 0.3) !important;
            --danger: #f87171 !important;
            --success: #34d399 !important;
            --text-main: #f8fafc !important;
            --text-muted: #94a3b8 !important;
            --border: rgba(255, 255, 255, 0.12) !important;
        }

        [data-theme="dark"] body {
            background-color: #0f172a !important;
            color: #f8fafc !important;
            background-image: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, #0f172a 75%) !important;
        }

        [data-theme="light"] body {
            background-color: #f8fafc !important;
            color: #0f172a !important;
            background-image: radial-gradient(circle at 50% 0%, rgba(79, 70, 229, 0.08) 0%, #f8fafc 75%) !important;
        }

        /* 🔒 APP LOCK OVERLAY STYLES */
        #pinLockOverlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: var(--bg-body, #f8fafc);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            user-select: none;
        }

        #pinLockOverlay.unlocking {
            opacity: 0 !important;
            transform: scale(1.08) !important;
            pointer-events: none !important;
        }

        .app-lock-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            max-width: 320px;
        }

        .app-lock-logo-box {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(147, 51, 234, 0.2));
            border: 2px solid rgba(79, 70, 229, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.25);
            overflow: hidden;
            color: var(--accent, #4f46e5);
            font-size: 1.8rem;
        }

        .app-lock-logo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
        }

        .pin-title { 
            font-size: 1.45rem; 
            font-weight: 700; 
            margin-bottom: 6px; 
            color: var(--text-main, #0f172a); 
        }
        
        .pin-sub { 
            font-size: 0.85rem; 
            color: var(--text-muted, #64748b); 
            margin-bottom: 30px; 
        }

        .pin-dots { 
            display: flex; 
            gap: 18px; 
            margin-bottom: 40px; 
            transition: transform 0.2s ease;
        }

        .pin-dot {
            width: 18px; 
            height: 18px; 
            border-radius: 50%;
            border: 2px solid var(--border, #cbd5e1); 
            background: transparent;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .pin-dot.filled { 
            background: var(--accent, #4f46e5); 
            border-color: var(--accent, #4f46e5);
            transform: scale(1.15);
            box-shadow: 0 0 12px rgba(79, 70, 229, 0.4);
        }

        .pin-dots.shake {
            animation: pinShake 0.35s ease-in-out;
        }

        @keyframes pinShake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-12px); }
            40%, 80% { transform: translateX(12px); }
        }

        .pin-keypad {
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 20px 25px;
            max-width: 280px; 
            width: 100%;
        }

        .keypad-btn {
            width: 72px;
            height: 72px;
            margin: 0 auto;
            border-radius: 50%; 
            border: 1px solid var(--border, rgba(0,0,0,0.08));
            background: var(--bg-card, #ffffff); 
            font-size: 1.5rem; 
            font-weight: 600;
            color: var(--text-main, #0f172a); 
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.04);
            cursor: pointer; 
            transition: transform 0.12s, background 0.12s; 
            display: flex;
            align-items: center; 
            justify-content: center;
            outline: none;
        }

        .keypad-btn:active { 
            transform: scale(0.88); 
            background: rgba(79, 70, 229, 0.15) !important; 
            border-color: var(--accent, #4f46e5);
        }

        /* SETTINGS UI COMPONENTS */
        .settings-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0,0,0,0.08));
            border-radius: 20px;
            padding: 20px;
            margin-top: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.03);
            text-align: left;
        }
        .settings-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text-main, #0f172a);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .setting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px dashed var(--border, rgba(0,0,0,0.08));
        }
        .setting-row:last-child { border-bottom: none; }
        .setting-label {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-main, #0f172a);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .setting-label i {
            font-size: 1.1rem;
            color: var(--accent, #4f46e5);
            width: 20px;
        }
        .setting-desc {
            font-size: 0.75rem;
            color: var(--text-muted, #64748b);
            font-weight: 400;
            margin-top: 2px;
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 46px;
            height: 26px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; cursor: pointer; inset: 0;
            background-color: #cbd5e1; transition: .3s; border-radius: 24px;
        }
        .slider:before {
            position: absolute; content: ""; height: 20px; width: 20px;
            left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        input:checked + .slider { background-color: var(--accent, #4f46e5); }
        input:checked + .slider:before { transform: translateX(20px); }

        .grid-btn-group {
            display: flex;
            gap: 6px;
            background: rgba(0,0,0,0.04);
            padding: 4px;
            border-radius: 10px;
        }
        .grid-option-btn {
            border: none;
            background: transparent;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-muted, #64748b);
            cursor: pointer;
            transition: 0.2s;
        }
        .grid-option-btn.active {
            background: var(--bg-card, #ffffff);
            color: var(--accent, #4f46e5);
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }

        /* SMART PIN MODAL */
        .smart-modal-overlay {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            animation: fadeInModal 0.25s ease-out forwards;
        }
        @keyframes fadeInModal {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .smart-modal-card {
            background: var(--bg-card, #ffffff);
            border: 1px solid var(--border, rgba(0,0,0,0.1));
            border-radius: 24px;
            padding: 28px 22px;
            width: 100%; max-width: 320px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            animation: popUpModal 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes popUpModal {
            from { transform: scale(0.85); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .smart-modal-icon {
            width: 54px; height: 54px; border-radius: 50%;
            background: rgba(79, 70, 229, 0.1);
            color: var(--accent, #4f46e5);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; margin: 0 auto 15px auto;
        }
        .smart-modal-title {
            font-size: 1.2rem; font-weight: 700; color: var(--text-main, #0f172a);
            margin-bottom: 6px;
        }
        .smart-modal-sub {
            font-size: 0.82rem; color: var(--text-muted, #64748b);
            margin-bottom: 20px; font-weight: 400;
        }
        .smart-pin-inputs {
            display: flex; justify-content: center; gap: 10px; margin-bottom: 24px;
        }
        .pin-box-input {
            width: 44px; height: 50px;
            border-radius: 12px;
            border: 2px solid var(--border, #cbd5e1);
            background: var(--bg-body, #f8fafc);
            text-align: center; font-size: 1.4rem; font-weight: 700;
            color: var(--text-main, #0f172a); outline: none;
            transition: all 0.2s;
            padding: 0 !important;
        }
        .pin-box-input:focus {
            border-color: var(--accent, #4f46e5);
            box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15);
        }
        .smart-modal-actions {
            display: flex; gap: 10px;
        }
        .smart-btn {
            flex: 1; padding: 12px; border-radius: 14px;
            font-weight: 600; font-size: 0.9rem; cursor: pointer;
            border: none; transition: transform 0.15s, opacity 0.15s;
        }
        .smart-btn:active { transform: scale(0.96); }
        .smart-btn-cancel {
            background: rgba(100, 116, 139, 0.12);
            color: var(--text-muted, #64748b);
        }
        .smart-btn-confirm {
            background: var(--accent, #4f46e5);
            color: #ffffff;
            box-shadow: 0 8px 18px -4px rgba(79, 70, 229, 0.4);
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 4. SMART PIN MODAL PROMPT
// --------------------------------------------------------------------------
function showSmartPinModal({ title, subtitle, icon, onConfirm, onCancel }) {
    injectSettingsStyles();

    const overlay = document.createElement('div');
    overlay.className = 'smart-modal-overlay';
    overlay.innerHTML = `
        <div class="smart-modal-card">
            <div class="smart-modal-icon">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="smart-modal-title">${title}</div>
            <div class="smart-modal-sub">${subtitle}</div>
            
            <div class="smart-pin-inputs">
                <input type="password" maxlength="1" class="pin-box-input" id="p1" inputmode="numeric">
                <input type="password" maxlength="1" class="pin-box-input" id="p2" inputmode="numeric">
                <input type="password" maxlength="1" class="pin-box-input" id="p3" inputmode="numeric">
                <input type="password" maxlength="1" class="pin-box-input" id="p4" inputmode="numeric">
            </div>

            <div class="smart-modal-actions">
                <button class="smart-btn smart-btn-cancel" id="smartCancelBtn">Cancel</button>
                <button class="smart-btn smart-btn-confirm" id="smartConfirmBtn">Confirm</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const inputs = overlay.querySelectorAll('.pin-box-input');
    inputs[0].focus();

    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < 3) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    const getPin = () => Array.from(inputs).map(i => i.value).join('');
    const close = () => overlay.remove();

    overlay.querySelector('#smartCancelBtn').addEventListener('click', () => {
        close();
        if (onCancel) onCancel();
    });

    overlay.querySelector('#smartConfirmBtn').addEventListener('click', () => {
        const pin = getPin();
        close();
        if (onConfirm) onConfirm(pin);
    });
}

// --------------------------------------------------------------------------
// 5. FULL SCREEN APP LOCK OVERLAY
// --------------------------------------------------------------------------
function showPinLockOverlay(correctPin) {
    if (document.getElementById('pinLockOverlay')) return;

    let enteredPin = "";

    const overlay = document.createElement('div');
    overlay.id = 'pinLockOverlay';
    overlay.innerHTML = `
        <div class="app-lock-card">
            <div class="app-lock-logo-box">
                <img src="loadingphoto.png" class="app-lock-logo-img" alt="Anant Gallery" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fa-solid fa-lock" style="display:none;"></i>
            </div>
            <div class="pin-title">Anant Gallery Locked</div>
            <div class="pin-sub">Enter 4-Digit Security PIN</div>
            <div class="pin-dots" id="appPinDots">
                <div class="pin-dot" id="dot1"></div>
                <div class="pin-dot" id="dot2"></div>
                <div class="pin-dot" id="dot3"></div>
                <div class="pin-dot" id="dot4"></div>
            </div>
            <div class="pin-keypad">
                <button class="keypad-btn" data-num="1">1</button>
                <button class="keypad-btn" data-num="2">2</button>
                <button class="keypad-btn" data-num="3">3</button>
                <button class="keypad-btn" data-num="4">4</button>
                <button class="keypad-btn" data-num="5">5</button>
                <button class="keypad-btn" data-num="6">6</button>
                <button class="keypad-btn" data-num="7">7</button>
                <button class="keypad-btn" data-num="8">8</button>
                <button class="keypad-btn" data-num="9">9</button>
                <button class="keypad-btn" style="visibility:hidden;"></button>
                <button class="keypad-btn" data-num="0">0</button>
                <button class="keypad-btn" id="keypadBack"><i class="fa-solid fa-backspace" style="font-size:1.2rem;"></i></button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const updateDots = () => {
        for (let i = 1; i <= 4; i++) {
            const dot = document.getElementById(`dot${i}`);
            if (dot) dot.classList.toggle('filled', i <= enteredPin.length);
        }
    };

    overlay.querySelectorAll('.keypad-btn[data-num]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (enteredPin.length < 4) {
                if (navigator.vibrate) navigator.vibrate(12);
                enteredPin += btn.getAttribute('data-num');
                updateDots();

                if (enteredPin.length === 4) {
                    if (enteredPin === correctPin) {
                        isUnlocked = true;
                        if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
                        overlay.classList.add('unlocking');
                        setTimeout(() => overlay.remove(), 280);
                    } else {
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        const dotsContainer = document.getElementById('appPinDots');
                        if (dotsContainer) {
                            dotsContainer.classList.add('shake');
                            setTimeout(() => dotsContainer.classList.remove('shake'), 380);
                        }
                        showToast("Incorrect PIN!");
                        enteredPin = "";
                        updateDots();
                    }
                }
            }
        });
    });

    document.getElementById('keypadBack')?.addEventListener('click', () => {
        if (enteredPin.length > 0) {
            if (navigator.vibrate) navigator.vibrate(10);
            enteredPin = enteredPin.slice(0, -1);
            updateDots();
        }
    });
}

// --------------------------------------------------------------------------
// 6. AUTO-LOCK ON BACKGROUND / TAB CHANGE
// --------------------------------------------------------------------------
document.addEventListener('visibilitychange', () => {
    const isPinEnabled = localStorage.getItem(KEYS.PIN_ENABLED) === 'true';
    const savedPin = localStorage.getItem(KEYS.PIN);

    if (document.hidden) {
        if (isPinEnabled) isUnlocked = false;
    } else {
        if (isPinEnabled && savedPin && !isUnlocked) {
            showPinLockOverlay(savedPin);
        }
        // App active hone par dobara time check karega
        handleThemeCheck();
    }
});

// --------------------------------------------------------------------------
// 7. INITIALIZE PREFERENCES
// --------------------------------------------------------------------------
export function initSettings() {
    injectSettingsStyles();

    const savedTheme = localStorage.getItem(KEYS.THEME) || 'auto';
    applyTheme(savedTheme);

    const savedCols = localStorage.getItem(KEYS.GRID_COLS) || '3';
    document.documentElement.style.setProperty('--grid-cols', savedCols);

    const isPinEnabled = localStorage.getItem(KEYS.PIN_ENABLED) === 'true';
    const savedPin = localStorage.getItem(KEYS.PIN);

    if (isPinEnabled && savedPin && !isUnlocked) {
        showPinLockOverlay(savedPin);
    }
}

export function resetPinLock() {
    isUnlocked = false;
}

initSettings();

// --------------------------------------------------------------------------
// 8. RENDER SETTINGS UI SECTION
// --------------------------------------------------------------------------
export function renderSettingsSection(containerElement) {
    injectSettingsStyles();

    const currentTheme = localStorage.getItem(KEYS.THEME) || 'auto';
    const isAutoTheme = currentTheme === 'auto';
    const isDarkManual = currentTheme === 'dark' || (isAutoTheme && (systemDarkQuery.matches || isNightTime()));
    const currentCols = localStorage.getItem(KEYS.GRID_COLS) || '3';
    const isPinEnabled = localStorage.getItem(KEYS.PIN_ENABLED) === 'true';

    const existing = containerElement.querySelector('.settings-card');
    if (existing) existing.remove();

    const section = document.createElement('div');
    section.className = 'settings-card';
    section.innerHTML = `
        <div class="settings-title">
            <i class="fa-solid fa-sliders"></i> App Preferences
        </div>

        <div class="setting-row">
            <div>
                <div class="setting-label">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Auto System Theme
                </div>
                <div class="setting-desc">Auto Night Mode (7 PM - 6 AM) & Phone Sync</div>
            </div>
            <label class="switch">
                <input type="checkbox" id="autoThemeToggle" ${isAutoTheme ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>

        <div class="setting-row" id="manualThemeRow" style="opacity: ${isAutoTheme ? '0.45' : '1'}; pointer-events: ${isAutoTheme ? 'none' : 'auto'};">
            <div>
                <div class="setting-label">
                    <i class="fa-solid fa-moon"></i> Dark Mode
                </div>
                <div class="setting-desc">Eye-friendly dark background</div>
            </div>
            <label class="switch">
                <input type="checkbox" id="manualThemeToggle" ${isDarkManual ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>

        <div class="setting-row">
            <div>
                <div class="setting-label">
                    <i class="fa-solid fa-table-cells"></i> Gallery Grid View
                </div>
                <div class="setting-desc">Photos per row on screen</div>
            </div>
            <div class="grid-btn-group">
                <button class="grid-option-btn ${currentCols === '2' ? 'active' : ''}" data-cols="2">2 Cols</button>
                <button class="grid-option-btn ${currentCols === '3' ? 'active' : ''}" data-cols="3">3 Cols</button>
                <button class="grid-option-btn ${currentCols === '4' ? 'active' : ''}" data-cols="4">4 Cols</button>
            </div>
        </div>

        <div class="setting-row">
            <div>
                <div class="setting-label">
                    <i class="fa-solid fa-shield-halved"></i> App PIN Lock
                </div>
                <div class="setting-desc">Require PIN to open gallery</div>
            </div>
            <label class="switch">
                <input type="checkbox" id="pinToggle" ${isPinEnabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
    `;

    containerElement.appendChild(section);

    const autoToggle = document.getElementById('autoThemeToggle');
    const manualToggle = document.getElementById('manualThemeToggle');
    const manualRow = document.getElementById('manualThemeRow');

    // 🌟 AUTO SYSTEM THEME TOGGLE
    autoToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (enabled) {
            localStorage.setItem(KEYS.THEME, 'auto');
            applyTheme('auto');
            manualRow.style.opacity = '0.45';
            manualRow.style.pointerEvents = 'none';
            manualToggle.checked = systemDarkQuery.matches || isNightTime();
            showToast("Auto Night & System Theme Enabled!");
        } else {
            const chosen = manualToggle.checked ? 'dark' : 'light';
            localStorage.setItem(KEYS.THEME, chosen);
            applyTheme(chosen);
            manualRow.style.opacity = '1';
            manualRow.style.pointerEvents = 'auto';
            showToast(`Manual ${chosen === 'dark' ? 'Dark' : 'Light'} Mode Active!`);
        }
    });

    // 🌟 MANUAL DARK MODE TOGGLE
    manualToggle.addEventListener('change', (e) => {
        const mode = e.target.checked ? 'dark' : 'light';
        localStorage.setItem(KEYS.THEME, mode);
        applyTheme(mode);
        showToast(`${mode === 'dark' ? 'Dark' : 'Light'} Mode Active!`);
    });

    // GRID COLS SELECTOR
    section.querySelectorAll('.grid-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            section.querySelectorAll('.grid-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const cols = btn.getAttribute('data-cols');
            localStorage.setItem(KEYS.GRID_COLS, cols);
            document.documentElement.style.setProperty('--grid-cols', cols);
        });
    });

    // PIN LOCK TOGGLE
    document.getElementById('pinToggle').addEventListener('click', (e) => {
        e.preventDefault();
        const isCurrentlyEnabled = localStorage.getItem(KEYS.PIN_ENABLED) === 'true';

        if (!isCurrentlyEnabled) {
            showSmartPinModal({
                title: "Set Security PIN",
                subtitle: "Enter a 4-digit PIN to lock your gallery",
                icon: "fa-shield-halved",
                onConfirm: (enteredPin) => {
                    if (enteredPin && /^\d{4}$/.test(enteredPin)) {
                        localStorage.setItem(KEYS.PIN, enteredPin);
                        localStorage.setItem(KEYS.PIN_ENABLED, 'true');
                        document.getElementById('pinToggle').checked = true;
                        showToast("App PIN Lock Enabled!");
                    } else {
                        showToast("PIN must be exactly 4 digits!");
                        document.getElementById('pinToggle').checked = false;
                    }
                },
                onCancel: () => {
                    document.getElementById('pinToggle').checked = false;
                }
            });
        } else {
            const savedPin = localStorage.getItem(KEYS.PIN);
            showSmartPinModal({
                title: "Disable PIN Lock",
                subtitle: "Enter current 4-digit PIN to disable lock",
                icon: "fa-lock-open",
                onConfirm: (enteredPin) => {
                    if (enteredPin === savedPin) {
                        localStorage.setItem(KEYS.PIN_ENABLED, 'false');
                        document.getElementById('pinToggle').checked = false;
                        showToast("App PIN Lock Disabled!");
                    } else {
                        showToast("Incorrect PIN!");
                        document.getElementById('pinToggle').checked = true;
                    }
                },
                onCancel: () => {
                    document.getElementById('pinToggle').checked = true;
                }
            });
        }
    });
}