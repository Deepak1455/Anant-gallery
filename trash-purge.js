// ==========================================================================
// 30-DAY AUTO TRASH PURGE MODULE
// ==========================================================================

import { db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    writeBatch, 
    doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const PURGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --------------------------------------------------------------------------
// 1. RUN AUTO TRASH PURGE ENGINE
// --------------------------------------------------------------------------
export async function runAutoTrashPurge(currentUser, showToast) {
    if (!currentUser) return;

    try {
        const q = query(
            collection(db, "user_photos"),
            where("uid", "==", currentUser.uid),
            where("isDeleted", "==", true)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const now = Date.now();
        const batch = writeBatch(db);
        let expiredCount = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let deletedTime = null;

            // Extract deletion time
            if (data.deletedAt?.seconds) {
                deletedTime = data.deletedAt.seconds * 1000;
            } else if (data.createdAt?.seconds) {
                deletedTime = data.createdAt.seconds * 1000; // Fallback for old trash items
            }

            if (deletedTime) {
                const daysInTrash = (now - deletedTime) / MS_PER_DAY;
                if (daysInTrash >= PURGE_DAYS) {
                    batch.delete(doc(db, "user_photos", docSnap.id));
                    expiredCount++;
                }
            }
        });

        if (expiredCount > 0) {
            await batch.commit();
            if (showToast) {
                showToast(`Auto-Purge: ${expiredCount} expired trash item(s) permanently deleted!`);
            }
        }
    } catch (err) {
        console.error("Auto Trash Purge Error:", err);
    }
}

// --------------------------------------------------------------------------
// 2. HELPER: CALCULATE REMAINING DAYS IN TRASH FOR A PHOTO
// --------------------------------------------------------------------------
export function getRemainingTrashDays(deletedAtTimestamp) {
    if (!deletedAtTimestamp) return 30;
    const deletedTime = deletedAtTimestamp.seconds ? deletedAtTimestamp.seconds * 1000 : new Date(deletedAtTimestamp).getTime();
    const now = Date.now();
    const daysPassed = Math.floor((now - deletedTime) / MS_PER_DAY);
    const remaining = PURGE_DAYS - daysPassed;
    return remaining > 0 ? remaining : 0;
}