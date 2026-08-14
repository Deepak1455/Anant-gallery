// ==========================================================================
// ANANT GALLERY - EXACT 3-SECOND GRADIENT SPLASH SCREEN MODULE
// ==========================================================================

let startTime = 0;
let isSplashHidden = false;
let autoHideTimer = null;

// --------------------------------------------------------------------------
// 1. DYNAMIC CSS FOR GRADIENT SPLASH OVERLAY & BRANDING
// --------------------------------------------------------------------------
const injectSplashStyles = () => {
    if (document.getElementById('splash-styles')) return;
    const style = document.createElement('style');
    style.id = 'splash-styles';
    style.textContent = `
        #splashOverlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e1b4b 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
            will-change: opacity, transform;
            user-select: none;
        }

        #splashOverlay.hide {
            opacity: 0 !important;
            transform: scale(1.06) !important;
            pointer-events: none !important;
        }

        .splash-content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 20px;
            animation: splashPopUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes splashPopUp {
            0% { opacity: 0; transform: translateY(18px) scale(0.92); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .splash-brand-icon {
            width: 85px;
            height: 85px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.4), rgba(147, 51, 234, 0.4));
            border: 2px solid rgba(255, 255, 255, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.2rem;
            color: #ffffff;
            box-shadow: 0 12px 35px rgba(79, 70, 229, 0.45);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            overflow: hidden;
        }

        .splash-brand-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
        }

        .splash-brand-title {
            font-size: 2.3rem;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.5px;
            margin-top: 18px;
            text-shadow: 0 4px 20px rgba(0,0,0,0.6);
            background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .splash-tagline {
            font-size: 0.85rem;
            color: #cbd5e1;
            margin-top: 4px;
            letter-spacing: 0.5px;
            font-weight: 500;
            text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        .splash-loader-bar {
            width: 140px;
            height: 4px;
            background: rgba(255, 255, 255, 0.18);
            border-radius: 10px;
            overflow: hidden;
            margin-top: 30px;
        }

        .splash-loader-fill {
            height: 100%;
            width: 60%;
            background: linear-gradient(90deg, #6366f1, #a855f7);
            border-radius: 10px;
            animation: splashShimmer 1.2s infinite ease-in-out;
        }

        @keyframes splashShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
        }
    `;
    document.head.appendChild(style);
};

// --------------------------------------------------------------------------
// 2. INITIALIZE GRADIENT SPLASH SCREEN (EXACT 3 SECONDS)
// --------------------------------------------------------------------------
export function initSplashScreen(logoUrl = "loadingphoto.png") {
    injectSplashStyles();

    if (document.getElementById('splashOverlay')) return;

    isSplashHidden = false;
    startTime = Date.now(); // Record start time

    const overlay = document.createElement('div');
    overlay.id = 'splashOverlay';
    
    overlay.innerHTML = `
        <div class="splash-content">
            <div class="splash-brand-icon">
                <img src="${logoUrl}" class="splash-brand-img" alt="Anant Gallery" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fa-solid fa-infinity" style="display:none;"></i>
            </div>
            <div class="splash-brand-title">Anant Gallery</div>
            <div class="splash-tagline">Infinite Memories, Unlimited Cloud</div>
            <div class="splash-loader-bar">
                <div class="splash-loader-fill"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fallback: Ensure it hides after 3 seconds
    autoHideTimer = setTimeout(() => {
        forceHideSplash();
    }, 3000);
}

// --------------------------------------------------------------------------
// 3. HIDE SPLASH SCREEN AFTER EXACTLY 3 SECONDS (CALLED FROM APP.JS)
// --------------------------------------------------------------------------
export function hideSplashScreen() {
    if (isSplashHidden) return;

    const MIN_DISPLAY_TIME = 3000; // Exact 3 Seconds
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsedTime);

    if (autoHideTimer) clearTimeout(autoHideTimer);

    setTimeout(() => {
        forceHideSplash();
    }, remainingTime);
}

// --------------------------------------------------------------------------
// 4. FORCE FADE OUT SPLASH
// --------------------------------------------------------------------------
function forceHideSplash() {
    if (isSplashHidden) return;
    isSplashHidden = true;

    const overlay = document.getElementById('splashOverlay');
    if (overlay) {
        overlay.classList.add('hide');
        setTimeout(() => {
            overlay.remove();
        }, 400);
    }
}