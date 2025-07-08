
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, missingKeys } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const keyMap: { [key: string]: string } = {
    apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'NEXT_PUBLIC_FIREBASE_APP_ID'
};

const FirebaseConfigError = () => (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="w-full max-w-2xl">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errore Critico: Configurazione Firebase Mancante</AlertTitle>
                <AlertDescription>
                    <div className="space-y-4 mt-2">
                        <p>Impossibile inizializzare Firebase. Le seguenti variabili d'ambiente sono mancanti o non sono state caricate correttamente:</p>
                        <ul className="list-disc list-inside font-mono bg-destructive/10 p-3 rounded-md text-sm">
                           {missingKeys.map(key => <li key={key}>{keyMap[key as keyof typeof keyMap] || key}</li>)}
                        </ul>
                        <p className="font-semibold">Cosa fare adesso:</p>
                        <ol className="list-decimal list-inside space-y-2">
                            <li><strong>Controlla il file <code>.env</code></strong>: Assicurati che esista un file chiamato <code>.env</code> (o <code>.env.local</code>) nella cartella principale del tuo progetto.</li>
                            <li><strong>Compila le Variabili</strong>: Apri il file <code>.env</code> e assicurati che TUTTE le variabili d'ambiente di Firebase siano presenti e abbiano un valore corretto.</li>
                            <li><strong>RIAVVIA IL SERVER</strong>: Questo è il passo più importante e spesso dimenticato. Dopo aver modificato il file <code>.env</code>, devi <strong>fermare (Ctrl+C) e riavviare</strong> il server di sviluppo (<code>npm run dev</code>).</li>
                            <li><strong>Verifica i Prefissi</strong>: Assicurati che tutte le variabili nel file <code>.env</code> inizino con <code>NEXT_PUBLIC_</code>.</li>
                            <li><strong>Abilita l'Autenticazione</strong>: Vai alla tua Console Firebase, nella sezione "Authentication" > "Sign-in method" e assicurati che il metodo "Email/Password" sia abilitato.</li>
                        </ol>
                    </div>
                </AlertDescription>
            </Alert>
        </div>
    </div>
);


interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // The crucial check. If this fails, show the error page.
  if (!auth) {
    return <FirebaseConfigError />;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      const isAuthPage = pathname === '/login' || pathname === '/signup';
      if (!user && !isAuthPage) {
        router.push('/login');
      }
      if (user && isAuthPage) {
        router.push('/');
      }
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );
  }

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (!user && !isAuthPage) {
      return null;
  }
  if (user && isAuthPage) {
      return null;
  }


  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
