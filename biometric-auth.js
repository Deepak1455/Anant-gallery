// ==========================================================================
// HARDWARE-LEVEL BIOMETRIC / FINGERPRINT ENGINE (WEBAUTHN API FOR PWA & APK)
// ==========================================================================

export async function isBiometricAvailable() {
    if (window.PublicKeyCredential && 
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        try {
            return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
            return false;
        }
    }
    return false;
}

export function isBiometricEnabled() {
    return localStorage.getItem("anant_biometric_enabled") === "true";
}

export function setBiometricEnabled(enabled) {
    localStorage.setItem("anant_biometric_enabled", enabled ? "true" : "false");
}

export async function registerBiometric(userEmail = "user@anant.gallery") {
    const available = await isBiometricAvailable();
    if (!available) throw new Error("Biometric sensor not available on this device.");

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: challenge,
            rp: { name: "Anant Gallery", id: window.location.hostname },
            user: {
                id: userId,
                name: userEmail,
                displayName: "Anant Gallery User"
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 },   // ES256
                { type: "public-key", alg: -257 }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                requireResidentKey: false
            },
            timeout: 60000
        }
    });

    if (credential) {
        setBiometricEnabled(true);
        return true;
    }
    return false;
}

export async function authenticateWithBiometric() {
    const available = await isBiometricAvailable();
    if (!available) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                timeout: 60000,
                userVerification: "required"
            }
        });
        return !!assertion;
    } catch (err) {
        // Fallback: If not yet registered on this domain, try register-and-verify
        if (err.name === 'InvalidStateError' || err.name === 'NotAllowedError') {
            try {
                return await registerBiometric();
            } catch (regErr) {
                return false;
            }
        }
        return false;
    }
}
