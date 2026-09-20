// ==========================================================================
// ANANT GALLERY - FIREBASE CLIENT CONFIG (ULTRA-FAST & CUSTOM DOMAIN AUTH)
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🌟 SMART DOMAIN DETECTION (Vercel Domain for Custom Branding, Local for Testing)
const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

// Production me Vercel domain dikhega, local me default
const activeAuthDomain = isLocalhost 
    ? "my-photo-d96e9.firebaseapp.com" 
    : "anant-gallery.vercel.app";

const firebaseConfig = {
    apiKey: "AIzaSyA4XN_xT6WroBZl6ZzPZ_UvGmHrm-6VU6w",
    authDomain: activeAuthDomain,
    projectId: "my-photo-d96e9",
    storageBucket: "my-photo-d96e9.firebasestorage.app",
    messagingSenderId: "467289242886",
    appId: "1:467289242886:web:2fdb862c36956befcdf287"
};

// Initialize App
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
