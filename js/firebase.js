/**
 * firebase.js - Central Firebase Configuration & Initialization
 * Is file ko 'js' folder ke andar save karein.
 */

// 1. Firebase SDK Modules ko Import karein (CDN link se)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ============================================================
// 🔥 STEP 1: APNI FIREBASE CONFIG YAHAN PASTE KAREIN
// ============================================================
// Firebase Console -> Project Settings -> General -> Your Apps me milega.
const firebaseConfig = {
  apiKey: "AIzaSyDR2VVPz4c0nNgt-SbwJ8RlomParlmcbCo",
  authDomain: "creatorkun-89ef1.firebaseapp.com",
  projectId: "creatorkun-89ef1",
  storageBucket: "creatorkun-89ef1.firebasestorage.app",
  messagingSenderId: "1077320715434",
  appId: "1:1077320715434:web:0366d94fdd3147d91814d3",
  measurementId: "G-F3LB3ZPLFQ"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 3. Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Future me images/assets save karne ke liye

// 4. Persistence Set Karein (Very Important)
// Isse user refresh karne par automatically log-out nahi hoga
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log("Firebase Auth Persistence: Local Storage Enabled.");
    })
    .catch((error) => {
        console.error("Auth Persistence Error:", error);
    });

// 5. Exports (Taaki app.js aur pages/dashboard.js ise use kar sakein)
export { app, auth, db, storage };