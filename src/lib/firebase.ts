
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
    console.error("\n\n\n--- FIREBASE CONFIGURATION ERROR ---");
    console.error("The following required environment variables are missing:");
    missingKeys.forEach(key => console.error(`- ${key}`));
    console.error("\nPLEASE CHECK THE FOLLOWING:");
    console.error("1. You have a file named '.env' in the root of your project.");
    console.error("2. The file contains all the necessary NEXT_PUBLIC_FIREBASE_* variables.");
    console.error("3. You have RESTARTED your development server (e.g., `npm run dev`) after modifying the .env file.");
    console.error("The application may not work correctly until this is resolved.");
    console.error("---------------------------------------\n\n\n");
}


let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// We still try to initialize, but the error will be logged.
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

db = getFirestore(app);
auth = getAuth(app);


export { db, auth };
