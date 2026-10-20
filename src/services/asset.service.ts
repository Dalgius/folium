import { db, auth } from '@/lib/firebase';
import type { Asset, BalanceSnapshot, NewAsset, Transaction } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { computePosition, dayKey, latestBalance, lastPrice, sortBalances, sortTransactions } from '@/lib/portfolio';
import { parseISO } from 'date-fns';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  writeBatch,
  Timestamp,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

const COLLECTION = 'assets';

const toIso = (value: unknown): string | undefined => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return undefined;
};

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Converte un documento Firestore in Asset.
 * I documenti creati con le versioni precedenti (senza storico operazioni o saldi)
 * vengono normalizzati al volo, senza bisogno di migrazioni.
 */
function fromFirestore(snap: QueryDocumentSnapshot<DocumentData>): Asset {
  const data = snap.data();
  const purchaseDate = toIso(data.purchaseDate);

  const asset: Asset = {
    id: snap.id,
    name: data.name ?? 'Senza nome',
    type: data.type ?? 'Altro',
    currency: data.currency || 'EUR',
    userId: data.userId,
    institution: data.institution,
    notes: data.notes,
    ticker: data.ticker,
    lastPrice: data.lastPrice,
    dailyChange: data.dailyChange,
    dailyChangePercent: data.dailyChangePercent,
    lastUpdated: toIso(data.lastUpdated),
    marketTime: toIso(data.marketTime),
    interestRate: data.interestRate,
    taxRate: data.taxRate,
    startDate: toIso(data.startDate),
    maturityDate: toIso(data.maturityDate),
    quantity: data.quantity,
    purchasePrice: data.purchasePrice,
    purchaseDate,
    initialValue: data.initialValue ?? 0,
    currentValue: data.currentValue ?? 0,
  };

  if (isMarketAsset(asset.type)) {
    asset.transactions = Array.isArray(data.transactions)
      ? (data.transactions as Transaction[])
      : asset.quantity && asset.purchasePrice
        ? [{
            id: 'legacy',
            type: 'buy',
            date: dayKey(purchaseDate) ?? dayKey(new Date())!,
            quantity: asset.quantity,
            price: asset.purchasePrice,
          }]
        : [];

    // Titoli di Londra salvati in pence dalle versioni precedenti
    if (asset.currency === 'GBp') {
      asset.currency = 'GBP';
      asset.transactions = asset.transactions.map(t => ({ ...t, price: t.price / 100 }));
      if (asset.lastPrice) asset.lastPrice /= 100;
      if (asset.dailyChange) asset.dailyChange /= 100;
      asset.currentValue /= 100;
    }
  } else {
    asset.balanceHistory = Array.isArray(data.balanceHistory)
      ? sortBalances(data.balanceHistory as BalanceSnapshot[])
      : [{ date: dayKey(purchaseDate) ?? dayKey(new Date())!, value: asset.currentValue }];
  }

  return asset;
}

/** Ricalcola i campi denormalizzati, utili per ordinamenti e compatibilità. */
function withDerivedFields(asset: Partial<NewAsset> & Pick<NewAsset, 'type'>): DocumentData {
  const data: DocumentData = { ...asset };

  if (isMarketAsset(asset.type) && asset.transactions) {
    const transactions = sortTransactions(asset.transactions);
    const position = computePosition(transactions);
    const price = lastPrice({ ...(asset as Asset), quantity: position.quantity }) ?? position.avgPrice;
    data.transactions = transactions;
    data.quantity = position.quantity;
    data.purchasePrice = position.avgPrice;
    data.initialValue = position.costBasis;
    data.currentValue = position.quantity * price;
    data.purchaseDate = position.firstDate ? parseISO(position.firstDate) : new Date();
  } else if (asset.balanceHistory) {
    const history = sortBalances(asset.balanceHistory);
    data.balanceHistory = history;
    data.initialValue = history[0]?.value ?? 0;
    data.currentValue = latestBalance({ ...(asset as Asset), balanceHistory: history });
    data.purchaseDate = history[0] ? parseISO(history[0].date) : new Date();
  }

  if (typeof data.purchaseDate === 'string') data.purchaseDate = parseISO(data.purchaseDate);

  // Firestore non accetta valori undefined negli oggetti annidati
  if (Array.isArray(data.transactions)) data.transactions = data.transactions.map(stripUndefined);
  if (Array.isArray(data.balanceHistory)) data.balanceHistory = data.balanceHistory.map(stripUndefined);
  delete data.id;
  delete data.userId;
  return data;
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export async function getAssets(): Promise<Asset[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(collection(db, COLLECTION), where('userId', '==', user.uid));
  const snapshot = await getDocs(q);
  const assets = snapshot.docs.map(fromFirestore);

  // Migrazione una tantum dei titoli salvati in pence: riscrive i valori in sterline
  const legacyPence = snapshot.docs.filter(d => d.data().currency === 'GBp').map(d => d.id);
  if (legacyPence.length) {
    await Promise.all(assets.filter(a => legacyPence.includes(a.id)).map(saveAsset));
  }
  return assets;
}

export async function addAsset(asset: NewAsset): Promise<Asset> {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere loggato per aggiungere un asset.');
  const data = stripUndefined(withDerivedFields(asset));
  const ref = await addDoc(collection(db, COLLECTION), { ...data, userId: user.uid });
  return { ...asset, id: ref.id, userId: user.uid, ...pickDerived(data) };
}

/** Salva l'asset completo (dopo modifiche a operazioni, saldi o dettagli). */
export async function saveAsset(asset: Asset): Promise<Asset> {
  const data = withDerivedFields(asset);
  // I campi svuotati (undefined) vengono rimossi dal documento
  const update = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
  await updateDoc(doc(db, COLLECTION, asset.id), update);
  return { ...asset, ...pickDerived(data) };
}

export async function deleteAsset(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/** Aggiorna in blocco i prezzi di mercato con una sola scrittura. */
export async function savePrices(
  updates: { id: string; lastPrice: number; dailyChange?: number; dailyChangePercent?: number; currentValue: number; marketTime?: string }[],
): Promise<void> {
  if (updates.length === 0) return;
  const batch = writeBatch(db);
  const lastUpdated = new Date().toISOString();
  for (const { id, ...fields } of updates) {
    const data: DocumentData = { ...fields, lastUpdated };
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    batch.update(doc(db, COLLECTION, id), data);
  }
  await batch.commit();
}

function pickDerived(data: DocumentData): Partial<Asset> {
  return {
    quantity: data.quantity as number | undefined,
    purchasePrice: data.purchasePrice as number | undefined,
    initialValue: (data.initialValue as number) ?? 0,
    currentValue: (data.currentValue as number) ?? 0,
    purchaseDate: data.purchaseDate instanceof Date ? data.purchaseDate.toISOString() : undefined,
  };
}
