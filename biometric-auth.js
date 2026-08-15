// ==========================================================================
// HARDWARE-LEVEL BIOMETRIC / FINGERPRINT ENGINE (SAVE & AUTHENTICATE)
// ==========================================================================

// Helper: Convert ArrayBuffer to Base64URL
function bufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Helper: Convert Base64URL to ArrayBuffer
function base64ToBuffer(base64) {
    let str = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

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

export function isBiometricRegistered() {
    return !!localStorage.getItem("anant_biometric_credential_id");
}

export function isBiometricEnabled() {
    return localStorage.getItem("anant_biometric_enabled") === "true" && isBiometricRegistered();
}

export function removeBiometric() {
    localStorage.removeItem("anant_biometric_credential_id");
    localStorage.setItem("anant_biometric_enabled", "false");
}

// 🌟 1. उंगली को डिवाइस पर रजिस्टर / सेव करना (Fingerprint Registration)
export async function registerBiometric(userEmail = "user@anant.gallery") {
    const available = await isBiometricAvailable();
    if (!available) throw new Error("Biometric hardware not available on this device.");

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
                displayName: userEmail.split('@')[0] || "Anant User"
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

    if (credential && credential.rawId) {
        const rawIdBase64 = bufferToBase64(credential.rawId);
        localStorage.setItem("anant_biometric_credential_id", rawIdBase64);
        localStorage.setItem("anant_biometric_enabled", "true");
        return true;
    }
    return false;
}

// 🌟 2. सेव की हुई उंगली से अनलॉक करना (Fingerprint Authentication)
export async function authenticateWithBiometric() {
    const available = await isBiometricAvailable();
    if (!available) return false;

    const credId = localStorage.getItem("anant_biometric_credential_id");
    if (!credId) {
        return false;
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    try {
        const rawBuffer = base64ToBuffer(credId);
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge,
                allowCredentials: [{
                    id: rawBuffer,
                    type: 'public-key',
                    transports: ['internal']
                }],
                timeout: 60000,
                userVerification: "required"
            }
        });
        return !!assertion;
    } catch (err) {
        console.warn("Biometric cancelled or failed:", err);
        return false;
    }
}
