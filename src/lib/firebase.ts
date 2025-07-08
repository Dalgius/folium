import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Aggiungo un controllo di validazione per le variabili d'ambiente.
// Questo aiuterà a diagnosticare problemi di configurazione.
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  throw new Error(
    "ERRORE CRITICO: NEXT_PUBLIC_FIREBASE_API_KEY non trovata. " +
    "Controlla i seguenti punti:\n" +
    "1. Esiste un file `.env` nella cartella principale del progetto?\n" +
    "2. Il file `.env` contiene la riga 'NEXT_PUBLIC_FIREBASE_API_KEY=...' con la tua chiave?\n" +
    "3. Hai riavviato il server di sviluppo dopo aver creato o modificato il file `.env`?"
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
