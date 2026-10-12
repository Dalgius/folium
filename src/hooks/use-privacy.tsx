'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'folium:privacy';

interface PrivacyContextType {
  hidden: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({ hidden: false, toggle: () => {} });

/** Modalità privacy: nasconde gli importi (utile in pubblico o condividendo lo schermo). */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // storage non disponibile: si resta in modalità visibile
    }
  }, []);

  const toggle = useCallback(() => {
    setHidden(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export const usePrivacy = () => useContext(PrivacyContext);
