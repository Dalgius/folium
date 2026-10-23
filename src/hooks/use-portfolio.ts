'use client';

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, BalanceSnapshot, CashMovement, NewAsset, Transaction } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { buildHoldings, computePosition, summarize, upsertBalance, type FxRates } from '@/lib/portfolio';
import { addAsset, deleteAsset, getAssets, newId, saveAsset, saveAssets, savePrices } from '@/services/asset.service';
import { getExchangeRates, getQuotes } from '@/lib/market';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { ToastAction, type ToastActionElement } from '@/components/ui/toast';

const AUTO_REFRESH_MS = 5 * 60 * 1000;
/** Tempo a disposizione per annullare un'eliminazione prima della scrittura su Firestore */
const UNDO_MS = 6000;

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
            marketTime: quote.marketTime,
          };
          // Si salva se il prezzo cambia o se l'ultimo salvataggio ha più di un'ora,
          // così la data di aggiornamento resta affidabile senza scrivere a ogni refresh
          const savedAt = asset.lastUpdated ? Date.parse(asset.lastUpdated) : 0;
          if (next.lastPrice !== asset.lastPrice || next.dailyChange !== asset.dailyChange || Date.now() - savedAt > 60 * 60 * 1000) {
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

  // Eliminazioni in attesa: vengono scritte alla scadenza, oppure annullate
  const pendingRef = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; commit: () => Promise<void> }>());

  /**
   * Applica subito un'eliminazione allo stato locale e mostra un toast con "Annulla".
   * La scrittura su Firestore parte solo alla scadenza; se fallisce, lo stato viene ripristinato.
   */
  const deleteWithUndo = useCallback(
    ({ title, apply, restore, write, error }: { title: string; apply: () => void; restore: () => void; write: () => Promise<void>; error: string }) => {
      const key = newId();
      const commit = async () => {
        pendingRef.current.delete(key);
        try {
          await write();
        } catch (e) {
          restore();
          fail(error, e);
        }
      };
      apply();
      pendingRef.current.set(key, { timer: setTimeout(commit, UNDO_MS), commit });
      toast({
        title,
        duration: UNDO_MS,
        action: createElement(
          ToastAction,
          {
            altText: 'Annulla eliminazione',
            onClick: () => {
              const pending = pendingRef.current.get(key);
              if (!pending) return;
              clearTimeout(pending.timer);
              pendingRef.current.delete(key);
              restore();
            },
          },
          'Annulla',
        ) as unknown as ToastActionElement,
      });
    },
    [fail, toast],
  );

  // Alla chiusura della pagina (o all'uscita) le eliminazioni in attesa vengono scritte subito
  useEffect(() => {
    const flush = () => {
      for (const { timer, commit } of [...pendingRef.current.values()]) {
        clearTimeout(timer);
        void commit();
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  /** Salva lo stato locale corrente di un asset (dopo un'eliminazione confermata). */
  const saveCurrent = async (assetId: string) => {
    const current = findAsset(assetId);
    if (current) replace(await saveAsset(current));
  };

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
    async (items: { data: NewAsset; replaceId?: string }[], { onFixDates }: { onFixDates?: () => void } = {}) => {
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
        toast({
          title: `Importati ${imported} titoli`,
          description: onFixDates ? 'Puoi correggere le date di acquisto in qualsiasi momento.' : undefined,
          action: onFixDates
            ? (createElement(ToastAction, { altText: 'Correggi le date di acquisto', onClick: onFixDates }, 'Correggi date') as unknown as ToastActionElement)
            : undefined,
        });
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

  const updateTransaction = useCallback(
    async (assetId: string, txId: string, tx: Omit<Transaction, 'id'>) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      return persist(
        { ...asset, transactions: (asset.transactions ?? []).map(t => (t.id === txId ? { ...tx, id: txId } : t)) },
        'Operazione aggiornata',
      );
    },
    [persist],
  );

  const deleteTransaction = useCallback(
    async (assetId: string, txId: string) => {
      const tx = findAsset(assetId)?.transactions?.find(t => t.id === txId);
      if (!tx) return false;
      const patch = (fn: (list: Transaction[]) => Transaction[]) =>
        setAssets(current => current.map(a => (a.id === assetId ? { ...a, transactions: fn(a.transactions ?? []) } : a)));
      deleteWithUndo({
        title: 'Operazione eliminata',
        apply: () => patch(list => list.filter(t => t.id !== txId)),
        restore: () => patch(list => [...list, tx]),
        write: () => saveCurrent(assetId),
        error: "Impossibile eliminare l'operazione.",
      });
      return true;
    },
    [deleteWithUndo],
  );

  /** Entrata (importo positivo) o uscita (negativo) su un conto corrente. */
  const addCashMovement = useCallback(
    async (assetId: string, movement: Omit<CashMovement, 'id' | 'createdAt'>) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      const created: CashMovement = { ...movement, id: newId(), createdAt: new Date().toISOString() };
      return persist(
        { ...asset, cashMovements: [...(asset.cashMovements ?? []), created] },
        movement.amount >= 0 ? 'Entrata registrata' : 'Uscita registrata',
      );
    },
    [persist],
  );

  const updateCashMovement = useCallback(
    async (assetId: string, movementId: string, movement: Omit<CashMovement, 'id' | 'createdAt'>) => {
      const asset = findAsset(assetId);
      if (!asset) return false;
      return persist(
        { ...asset, cashMovements: (asset.cashMovements ?? []).map(m => (m.id === movementId ? { ...m, ...movement } : m)) },
        'Movimento aggiornato',
      );
    },
    [persist],
  );

  const deleteCashMovement = useCallback(
    async (assetId: string, movementId: string) => {
      const movement = findAsset(assetId)?.cashMovements?.find(m => m.id === movementId);
      if (!movement) return false;
      const patch = (fn: (list: CashMovement[]) => CashMovement[]) =>
        setAssets(current => current.map(a => (a.id === assetId ? { ...a, cashMovements: fn(a.cashMovements ?? []) } : a)));
      deleteWithUndo({
        title: 'Movimento eliminato',
        apply: () => patch(list => list.filter(m => m.id !== movementId)),
        restore: () => patch(list => [...list, movement]),
        write: () => saveCurrent(assetId),
        error: 'Impossibile eliminare il movimento.',
      });
      return true;
    },
    [deleteWithUndo],
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
      const snapshot = asset?.balanceHistory?.find(b => b.date === date);
      if (!asset || !snapshot || asset.balanceHistory!.length <= 1) return false;
      deleteWithUndo({
        title: 'Saldo eliminato',
        apply: () =>
          setAssets(current =>
            current.map(a => (a.id === assetId ? { ...a, balanceHistory: (a.balanceHistory ?? []).filter(b => b.date !== date) } : a)),
          ),
        restore: () =>
          setAssets(current =>
            current.map(a => (a.id === assetId ? { ...a, balanceHistory: upsertBalance(a.balanceHistory, snapshot) } : a)),
          ),
        write: () => saveCurrent(assetId),
        error: 'Impossibile eliminare il saldo.',
      });
      return true;
    },
    [deleteWithUndo],
  );

  /** Salva in blocco più asset modificati, con un solo messaggio finale. */
  const persistMany = useCallback(
    async (list: Asset[], success: string, error: string) => {
      if (list.length === 0) return true;
      try {
        const saved = await saveAssets(list);
        const byId = new Map(saved.map(a => [a.id, a]));
        setAssets(current => current.map(a => byId.get(a.id) ?? a));
        toast({ title: success });
        return true;
      } catch (e) {
        fail(error, e);
        return false;
      }
    },
    [fail, toast],
  );

  /** Cambia la data di più operazioni, anche di titoli diversi. */
  const updateTransactionDates = useCallback(
    async (changes: { assetId: string; txId: string; date: string }[]) => {
      const byAsset = new Map<string, Map<string, string>>();
      for (const { assetId, txId, date } of changes) {
        if (!byAsset.has(assetId)) byAsset.set(assetId, new Map());
        byAsset.get(assetId)!.set(txId, date);
      }
      const list = [...byAsset].flatMap(([assetId, dates]) => {
        const asset = findAsset(assetId);
        if (!asset) return [];
        return [{ ...asset, transactions: (asset.transactions ?? []).map(t => (dates.has(t.id) ? { ...t, date: dates.get(t.id)! } : t)) }];
      });
      const n = changes.length;
      return persistMany(list, n === 1 ? 'Data aggiornata' : `Date aggiornate (${n} operazioni)`, 'Impossibile aggiornare le date.');
    },
    [persistMany],
  );

  /** Registra il saldo di più conti nella stessa data. */
  const setBalances = useCallback(
    async (entries: { assetId: string; snapshot: BalanceSnapshot }[]) => {
      const list = entries.flatMap(({ assetId, snapshot }) => {
        const asset = findAsset(assetId);
        return asset ? [{ ...asset, balanceHistory: upsertBalance(asset.balanceHistory, snapshot) }] : [];
      });
      const n = list.length;
      return persistMany(list, n === 1 ? 'Saldo aggiornato' : `Saldi aggiornati (${n})`, 'Impossibile aggiornare i saldi.');
    },
    [persistMany],
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
      const asset = findAsset(assetId);
      if (!asset) return false;
      deleteWithUndo({
        title: `${asset.name} eliminato`,
        apply: () => setAssets(current => current.filter(a => a.id !== assetId)),
        restore: () => setAssets(current => (current.some(a => a.id === assetId) ? current : [...current, asset])),
        write: () => deleteAsset(assetId),
        error: "Impossibile eliminare l'asset.",
      });
      return true;
    },
    [deleteWithUndo],
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
    updateTransaction,
    deleteTransaction,
    setBalance,
    setBalances,
    addCashMovement,
    updateCashMovement,
    deleteCashMovement,
    updateTransactionDates,
    deleteBalance,
    updateDetails,
    remove,
  };
}

export type PortfolioApi = ReturnType<typeof usePortfolio>;
