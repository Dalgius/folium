import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const keyMap: { [key: string]: string } = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID'
};

const missingKeys = (Object.keys(firebaseConfig) as Array<keyof typeof firebaseConfig>)
    .filter(key => !firebaseConfig[key])
    .map(key => keyMap[key]);

if (missingKeys.length > 0) {
    throw new Error(
        `ERRORE CRITICO DI CONFIGURAZIONE FIREBASE:\n\n` +
        `Impossibile inizializzare Firebase. Le seguenti variabili d'ambiente sono mancanti o non accessibili:\n` +
        `- ${missingKeys.join('\n- ')}\n\n` +
        `PER FAVORE, CONTROLLA QUESTI PUNTI:\n` +
        `1. Esiste un file .env nella cartella principale del progetto?\n` +
        `2. Hai compilato TUTTE le variabili d'ambiente in .env con i valori del tuo progetto Firebase?\n` +
        `3. IMPORTANTE: Hai riavviato il server di sviluppo (es. 'npm run dev') DOPO aver modificato il file .env?\n` +
        `4. Le variabili iniziano tutte con "NEXT_PUBLIC_"?\n`
    );
}


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
