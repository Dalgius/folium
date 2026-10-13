'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, BalanceSnapshot, NewAsset, Transaction } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { buildHoldings, computePosition, summarize, upsertBalance, type FxRates } from '@/lib/portfolio';
import { addAsset, deleteAsset, getAssets, newId, saveAsset, savePrices } from '@/services/asset.service';
import { getExchangeRates, getQuotes } from '@/lib/market';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export function usePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fx, setFx] = useState<FxRates>({ EUR: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const assetsRef = useRef<Asset[]>([]);
  assetsRef.current = assets;

  const fail = useCallback(
    (description: string, error: unknown) => {
      console.error(description, error);
      toast({ title: 'Qualcosa è andato storto', description, variant: 'destructive' });
    },
    [toast],
  );

  /** Aggiorna prezzi di mercato e tassi di cambio, poi salva i nuovi prezzi. */
  const refreshMarket = useCallback(
    async (list: Asset[] = assetsRef.current, { silent = true } = {}) => {
      if (list.length === 0) return;
      setRefreshing(true);
      try {
        const tickers = list.filter(a => isMarketAsset(a.type) && a.ticker).map(a => a.ticker!.toUpperCase());
        // Con l'aggiornamento manuale si saltano le risposte in cache (60 s) per avere prezzi freschi
        const fresh = !silent;
        const [quotesResult, ratesResult] = await Promise.all([
          getQuotes(tickers, { fresh }),
          getExchangeRates(list.map(a => a.currency), 'EUR', { fresh }),
        ]);
        // Se la funzione sul server va in errore o in timeout il risultato può mancare:
        // si tengono i prezzi e i cambi già noti
        const quotes = quotesResult ?? {};
        if (ratesResult && typeof ratesResult === 'object') {
          setFx(current => ({ ...current, ...ratesResult, EUR: 1 }));
        }

        const updates: Parameters<typeof savePrices>[0] = [];
        const prices = new Map<string, Partial<Asset>>();
        for (const asset of list) {
          const quote = asset.ticker ? quotes[asset.ticker.toUpperCase()] : undefined;
          if (!quote || !isMarketAsset(asset.type)) continue;
          const { quantity } = computePosition(asset.transactions);
          const next = {
            lastPrice: quote.price,
            dailyChange: quote.dailyChange,
            dailyChangePercent: quote.dailyChangePercent,
            currentValue: quantity * quote.price,
          };
          if (next.lastPrice !== asset.lastPrice || next.dailyChange !== asset.dailyChange) {
            updates.push({ id: asset.id, ...next });
          }
          prices.set(asset.id, { ...next, lastUpdated: new Date().toISOString() });
        }

        // Unisce solo i campi di prezzo, per non sovrascrivere modifiche avvenute nel frattempo
        setAssets(current =>
          current.map(a => {
            const p = prices.get(a.id);
            if (!p) return a;
            return { ...a, ...p, currentValue: computePosition(a.transactions).quantity * p.lastPrice! };
          }),
        );
        setLastRefresh(new Date());

        const missing = tickers.filter(t => !quotes[t]);
        if (!silent && missing.length === tickers.length && tickers.length > 0) {
          toast({ title: 'Quotazioni non disponibili', description: 'Yahoo Finance non ha risposto: restano gli ultimi prezzi noti.', variant: 'destructive' });
        } else if (!silent && missing.length) {
          toast({ title: 'Quotazioni parziali', description: `Nessun prezzo per: ${missing.join(', ')}` });
        } else if (!silent) {
          toast({ title: 'Quotazioni aggiornate', description: `${tickers.length} titoli aggiornati alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` });
        }
        savePrices(updates).catch(error => console.warn('Salvataggio prezzi non riuscito', error));
      } catch (error) {
        if (!silent) fail('Impossibile aggiornare le quotazioni.', error);
      } finally {
        setRefreshing(false);
      }
    },
    [fail, toast],
  );

  // Caricamento iniziale
  useEffect(() => {
    if (!user) {
      setAssets([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAssets()
      .then(list => {
        if (cancelled) return;
        setAssets(list);
        setLoading(false);
        refreshMarket(list);
      })
      .catch(error => {
        if (cancelled) return;
        setLoading(false);
        fail('Impossibile caricare i dati dal database.', error);
      });
    return () => {
      cancelled = true;
    };
  }, [user, refreshMarket, fail]);

  // Aggiornamento automatico mentre la pagina è visibile
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshMarket();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshMarket]);

  const replace = (asset: Asset) => setAssets(current => current.map(a => (a.id === asset.id ? asset : a)));

  const persist = useCallback(
    async (asset: Asset, success?: string) => {
      try {
        const saved = await saveAsset(asset);
        replace(saved);
        if (success) toast({ title: success });
        return true;
      } catch (error) {
        fail('Impossibile salvare le modifiche.', error);
        return false;
      }
    },
    [fail, toast],
  );

  const findAsset = (id: string) => assetsRef.current.find(a => a.id === id);

  /** Crea un nuovo asset; un titolo già presente riceve invece una nuova operazione. */
  const create = useCallback(
    async (data: NewAsset) => {
      const existing =
        isMarketAsset(data.type) && data.ticker
          ? assetsRef.current.find(a => a.ticker?.toUpperCase() === data.ticker!.toUpperCase())
          : undefined;
      if (existing) {
        return persist(
          { ...existing, transactions: [...(existing.transactions ?? []), ...(data.transactions ?? [])] },
          `Operazione aggiunta a ${existing.name}`,
        );
      }
      try {
        const created = await addAsset(data);
        setAssets(current => [...current, created]);
        toast({ title: `${created.name} aggiunto al portafoglio` });
        if (data.currency !== 'EUR' && !fx[data.currency]) refreshMarket([...assetsRef.current, created]);
        return true;
      } catch (error) {
        fail("Impossibile aggiungere l'asset.", error);
        return false;
      }
    },
    [persist, fail, toast, fx, refreshMarket],
  );

  /**
   * Importa posizioni da un broker. Se `replaceId` è indicato, la posizione
   * esistente viene allineata a quella importata (operazioni sostituite).
   */
  const importPositions = useCallback(
    async (items: { data: NewAsset; replaceId?: string }[]) => {
      let imported = 0;
      const failed: string[] = [];
      // Elenco aggiornato localmente: lo stato React si aggiorna solo al render successivo
      let list = [...assetsRef.current];
      for (const { data, replaceId } of items) {
        try {
          if (replaceId) {
            const existing = findAsset(replaceId);
            if (!existing) continue;
            const saved = await saveAsset({ ...existing, ...data, id: existing.id, name: existing.name });
            replace(saved);
            list = list.map(a => (a.id === saved.id ? saved : a));
          } else {
            const created = await addAsset(data);
            setAssets(current => [...current, created]);
            list.push(created);
          }
          imported++;
        } catch (error) {
          console.error('Importazione non riuscita per', data.name, error);
          failed.push(data.name);
        }
      }
      if (failed.length) {
        toast({ title: `Importati ${imported} titoli su ${items.length}`, description: `Non riusciti: ${failed.join(', ')}`, variant: 'destructive' });
      } else {
        toast({ title: `Importati ${imported} titoli` });
      }
      refreshMarket(list);
      return failed.length === 0;
    },
    [toast, refreshMarket],
  );

  const addTransaction = useCallback(
    async (assetId: string, tx: Omit<Transaction, 'id'>) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      return persist(
        { ...asset, transactions: [...(asset.transactions ?? []), { ...tx, id: newId() }] },
        tx.type === 'buy' ? 'Acquisto registrato' : 'Vendita registrata',
      );
    },
    [persist],
  );

  const deleteTransaction = useCallback(
    async (assetId: string, txId: string) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      return persist({ ...asset, transactions: (asset.transactions ?? []).filter(t => t.id !== txId) }, 'Operazione eliminata');
    },
    [persist],
  );

  const setBalance = useCallback(
    async (assetId: string, snapshot: BalanceSnapshot) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      return persist({ ...asset, balanceHistory: upsertBalance(asset.balanceHistory, snapshot) }, 'Saldo aggiornato');
    },
    [persist],
  );

  const deleteBalance = useCallback(
    async (assetId: string, date: string) => {
      const asset = findAsset(assetId);
      if (!asset || (asset.balanceHistory?.length ?? 0) <= 1) return false;
      return persist({ ...asset, balanceHistory: asset.balanceHistory!.filter(b => b.date !== date) }, 'Saldo eliminato');
    },
    [persist],
  );

  const updateDetails = useCallback(
    async (assetId: string, patch: Partial<Asset>) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      return persist({ ...asset, ...patch, id: asset.id, type: asset.type }, 'Modifiche salvate');
    },
    [persist],
  );

  const remove = useCallback(
    async (assetId: string) => {
      try {
        await deleteAsset(assetId);
        setAssets(current => current.filter(a => a.id !== assetId));
        toast({ title: 'Asset eliminato' });
        return true;
      } catch (error) {
        fail("Impossibile eliminare l'asset.", error);
        return false;
      }
    },
    [fail, toast],
  );

  const holdings = useMemo(() => buildHoldings(assets, fx), [assets, fx]);
  const summary = useMemo(() => summarize(holdings), [holdings]);

  return {
    assets,
    holdings,
    summary,
    fx,
    loading,
    refreshing,
    lastRefresh,
    refresh: () => refreshMarket(assetsRef.current, { silent: false }),
    create,
    importPositions,
    addTransaction,
    deleteTransaction,
    setBalance,
    deleteBalance,
    updateDetails,
    remove,
  };
}

export type PortfolioApi = ReturnType<typeof usePortfolio>;
