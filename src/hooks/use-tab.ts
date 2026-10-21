'use client';

import { useCallback, useEffect, useState } from 'react';

export type Tab = 'panoramica' | 'posizioni' | 'movimenti' | 'impostazioni';

const TABS: Tab[] = ['panoramica', 'posizioni', 'movimenti', 'impostazioni'];

const fromHash = (hash: string): Tab => {
  const value = hash.replace(/^#/, '') as Tab;
  return TABS.includes(value) ? value : 'panoramica';
};

/**
 * Scheda attiva, salvata nell'hash dell'indirizzo (#posizioni…):
 * il tasto Indietro del browser e i link diretti funzionano senza router.
 */
export function useTab(): [Tab, (tab: Tab) => void] {
  const [tab, setTabState] = useState<Tab>('panoramica');

  useEffect(() => {
    const read = () => setTabState(fromHash(window.location.hash));
    read();
    window.addEventListener('hashchange', read);
    window.addEventListener('popstate', read);
    return () => {
      window.removeEventListener('hashchange', read);
      window.removeEventListener('popstate', read);
    };
  }, []);

  const setTab = useCallback((next: Tab) => {
    const url = next === 'panoramica' ? window.location.pathname + window.location.search : `#${next}`;
    if (fromHash(window.location.hash) !== next) window.history.pushState(null, '', url);
    setTabState(next);
    window.scrollTo({ top: 0 });
  }, []);

  return [tab, setTab];
}
