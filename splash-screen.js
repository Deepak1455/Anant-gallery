// ==========================================================================
// ANANT GALLERY - SMART FAST SPLASH SCREEN (INSTANT SHARE SUPPORT)
// ==========================================================================

let isSplashHidden = false;

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
            transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s ease !important;
            user-select: none;
        }

        #splashOverlay.hide {
            opacity: 0 !important;
            transform: scale(1.05) !important;
            pointer-events: none !important;
        }

        .splash-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 20px;
        }

        .splash-brand-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.4), rgba(147, 51, 234, 0.4));
            border: 2px solid rgba(255, 255, 255, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.2rem;
            color: #ffffff;
            box-shadow: 0 12px 35px rgba(79, 70, 229, 0.45);
        }

        .splash-brand-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
        }

        .splash-brand-title {
            font-size: 2.2rem;
            font-weight: 800;
            color: #ffffff;
            margin-top: 16px;
            background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .splash-tagline {
            font-size: 0.85rem;
            color: #cbd5e1;
            margin-top: 4px;
        }
    `;
    document.head.appendChild(style);
};

export function initSplashScreen(logoUrl = "loadingphoto.png") {
    // 🌟 यदि गैलरी से फ़ोटो शेयर होकर आई है, तो स्पलैश स्क्रीन बिल्कुल न दिखाएँ (0ms Fast)
    if (window.location.search.includes('shared=1')) {
        return;
    }

    injectSplashStyles();
    if (document.getElementById('splashOverlay')) return;

    isSplashHidden = false;

    const overlay = document.createElement('div');
    overlay.id = 'splashOverlay';
    overlay.innerHTML = `
        <div class="splash-content">
            <div class="splash-brand-icon">
                <img src="${logoUrl}" class="splash-brand-img" alt="Anant" onerror="this.src='/icon-192.png'">
            </div>
            <div class="splash-brand-title">Anant Gallery</div>
            <div class="splash-tagline">Infinite Memories, Unlimited Cloud</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // सिर्फ 800ms का स्मूथ ऑटो-हाइड
    setTimeout(() => forceHideSplash(), 800);
}

export function hideSplashScreen() {
    forceHideSplash();
}

function forceHideSplash() {
    if (isSplashHidden) return;
    isSplashHidden = true;
    const overlay = document.getElementById('splashOverlay');
    if (overlay) {
        overlay.classList.add('hide');
        setTimeout(() => overlay.remove(), 250);
    }
}
