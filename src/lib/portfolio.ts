import { addDays, differenceInCalendarDays, format, isValid, parseISO, subDays } from 'date-fns';
import type { Asset, AssetClass, AssetType, BalanceSnapshot, CashMovement, Transaction } from '@/types';
import { ASSET_TYPES, isMarketAsset, typeMeta, type AssetGroup } from '@/lib/asset-types';
import { ASSET_CLASSES, assetClassOf } from '@/lib/asset-classes';

export const BASE_CURRENCY = 'EUR';
export const DEFAULT_TAX_RATE = 26;

/** Normalizza una data (ISO completa o yyyy-MM-dd) nel giorno locale yyyy-MM-dd. */
export function dayKey(value: string | Date | undefined | null): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
}

export const todayKey = () => format(new Date(), 'yyyy-MM-dd');

// ---------------------------------------------------------------------------
// Posizioni su titoli
// ---------------------------------------------------------------------------

export interface Position {
  quantity: number;
  /** Costo residuo delle quote detenute (metodo del costo medio), commissioni incluse */
  costBasis: number;
  /** Prezzo medio di carico */
  avgPrice: number;
  /** Plus/minusvalenze realizzate con le vendite */
  realized: number;
  /** Capitale netto immesso: acquisti - incassi da vendite */
  netInvested: number;
  firstDate: string | null;
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => (dayKey(a.date) ?? '').localeCompare(dayKey(b.date) ?? ''));
}

/** Calcola la posizione con il metodo del costo medio ponderato. */
export function computePosition(transactions: Transaction[] = [], upTo?: string): Position {
  let quantity = 0;
  let costBasis = 0;
  let realized = 0;
  let netInvested = 0;
  let firstDate: string | null = null;

  for (const tx of sortTransactions(transactions)) {
    const day = dayKey(tx.date);
    if (upTo && day && day > upTo) break;
    const fees = tx.fees ?? 0;
    if (tx.type === 'buy') {
      quantity += tx.quantity;
      costBasis += tx.quantity * tx.price + fees;
      netInvested += tx.quantity * tx.price + fees;
      if (!firstDate) firstDate = day;
    } else {
      const sold = Math.min(tx.quantity, quantity);
      const avg = quantity > 0 ? costBasis / quantity : 0;
      const proceeds = sold * tx.price - fees;
      realized += proceeds - avg * sold;
      costBasis -= avg * sold;
      quantity -= sold;
      netInvested -= proceeds;
    }
  }

  // Evita residui numerici dopo una vendita totale
  if (Math.abs(quantity) < 1e-9) {
    quantity = 0;
    costBasis = 0;
  }

  return {
    quantity,
    costBasis,
    avgPrice: quantity > 0 ? costBasis / quantity : 0,
    realized,
    netInvested,
    firstDate,
  };
}

/**
 * Vendite che, in ordine cronologico, superano le quote possedute in quel momento
 * (per esempio dopo aver spostato la data di un acquisto più avanti di una vendita).
 */
export function invalidSellIds(transactions: Transaction[] = []): string[] {
  let quantity = 0;
  const invalid: string[] = [];
  for (const tx of sortTransactions(transactions)) {
    if (tx.type === 'buy') quantity += tx.quantity;
    else if (tx.quantity > quantity + 1e-9) invalid.push(tx.id);
    else quantity -= tx.quantity;
  }
  return invalid;
}

/** Ultimo prezzo unitario noto per un titolo. */
export function lastPrice(asset: Asset): number | undefined {
  if (asset.lastPrice && asset.lastPrice > 0) return asset.lastPrice;
  if (asset.quantity && asset.quantity > 0 && asset.currentValue > 0) return asset.currentValue / asset.quantity;
  return undefined;
}

// ---------------------------------------------------------------------------
// Conti e beni a valore manuale
// ---------------------------------------------------------------------------

export function sortBalances(history: BalanceSnapshot[] = []): BalanceSnapshot[] {
  return [...history].sort((a, b) => (dayKey(a.date) ?? '').localeCompare(dayKey(b.date) ?? ''));
}

/** Saldo attuale: ultimo saldo registrato più le entrate e uscite successive. */
export function latestBalance(asset: Asset): number {
  const history = sortBalances(asset.balanceHistory);
  if (!history.length) return asset.currentValue ?? 0;
  return accountBalanceAt(history, asset.cashMovements, '9999-12-31');
}

/**
 * Il movimento è già compreso in questo saldo registrato?
 * Sì se è di un giorno precedente; nello stesso giorno, se è stato inserito prima del saldo
 * (i saldi senza ora di registrazione valgono come registrati a inizio giornata).
 */
function coveredBy(snapshot: BalanceSnapshot, movement: CashMovement): boolean {
  const snapDay = dayKey(snapshot.date) ?? '';
  const moveDay = dayKey(movement.date) ?? '';
  if (moveDay !== snapDay) return moveDay < snapDay;
  return !!snapshot.at && movement.createdAt <= snapshot.at;
}

/**
 * Saldo di un conto in una certa data: ultimo saldo registrato fino a quel giorno
 * più i movimenti inseriti dopo di esso. Il saldo registrato è il dato della banca:
 * i movimenti precedenti sono già compresi e non vengono sommati di nuovo.
 */
export function accountBalanceAt(sortedHistory: BalanceSnapshot[], movements: CashMovement[] = [], day: string): number {
  if (sortedHistory.length === 0) {
    return movements.reduce((sum, m) => ((dayKey(m.date) ?? '') <= day ? sum + m.amount : sum), 0);
  }
  let anchor: BalanceSnapshot | null = null;
  for (const snap of sortedHistory) {
    if ((dayKey(snap.date) ?? '') <= day) anchor = snap;
    else break;
  }
  // Prima del primo saldo noto si assume il primo valore registrato
  if (!anchor) return sortedHistory[0].value;
  let value = anchor.value;
  for (const m of movements) {
    if ((dayKey(m.date) ?? '') <= day && !coveredBy(anchor, m)) value += m.amount;
  }
  return value;
}

/** Il primo saldo registrato che comprende già il movimento, se c'è. */
export function coveringSnapshot(sortedHistory: BalanceSnapshot[], movement: CashMovement): BalanceSnapshot | null {
  return sortedHistory.find(s => coveredBy(s, movement)) ?? null;
}

export interface LedgerEntry {
  key: string;
  kind: 'opening' | 'snapshot' | 'movement' | 'adjustment';
  date: string;
  /** Variazione portata dalla riga (per il saldo iniziale: il saldo stesso) */
  amount: number;
  /** Saldo dopo la riga; null per i movimenti precedenti al saldo iniziale */
  balance: number | null;
  description?: string;
  movementId?: string;
  /** Movimento datato prima del saldo iniziale: non conteggiato */
  excluded?: boolean;
}

/**
 * Libro del conto in ordine cronologico, con il saldo progressivo:
 * saldo iniziale + entrate − uscite (+ allineamenti). Gli eventuali saldi registrati
 * dopo il primo (dati precedenti al libro dei movimenti) riallineano il saldo.
 */
export function accountLedger(asset: Asset): LedgerEntry[] {
  const history = sortBalances(asset.balanceHistory);
  type Event = { day: string; stamp: string; snapshot?: BalanceSnapshot; movement?: CashMovement };
  const events: Event[] = [
    // I saldi senza ora valgono come registrati a inizio giornata
    ...history.map(s => ({ day: dayKey(s.date) ?? s.date, stamp: s.at ?? '', snapshot: s })),
    ...(asset.cashMovements ?? []).map(m => ({ day: dayKey(m.date) ?? m.date, stamp: m.createdAt, movement: m })),
  ].sort((a, b) => a.day.localeCompare(b.day) || a.stamp.localeCompare(b.stamp));

  const entries: LedgerEntry[] = [];
  let balance: number | null = null;
  for (const e of events) {
    if (e.snapshot) {
      const opening = balance === null;
      const amount = opening ? e.snapshot.value : e.snapshot.value - balance!;
      balance = e.snapshot.value;
      entries.push({ key: `s:${e.snapshot.date}`, kind: opening ? 'opening' : 'snapshot', date: e.day, amount, balance });
    } else if (e.movement) {
      const m = e.movement;
      if (balance === null) {
        entries.push({ key: `m:${m.id}`, kind: m.kind === 'adjustment' ? 'adjustment' : 'movement', date: e.day, amount: m.amount, balance: null, description: m.description, movementId: m.id, excluded: true });
        continue;
      }
      balance += m.amount;
      entries.push({ key: `m:${m.id}`, kind: m.kind === 'adjustment' ? 'adjustment' : 'movement', date: e.day, amount: m.amount, balance, description: m.description, movementId: m.id });
    }
  }
  return entries;
}

/** Importo dell'allineamento che porta il saldo calcolato a quello indicato dalla banca. */
export function adjustmentFor(asset: Asset, date: string, target: number): number {
  const current = accountBalanceAt(sortBalances(asset.balanceHistory), asset.cashMovements, date);
  return Math.round((target - current) * 100) / 100;
}

export function sortCashMovements(movements: CashMovement[] = []): CashMovement[] {
  return [...movements].sort((a, b) => (dayKey(a.date) ?? '').localeCompare(dayKey(b.date) ?? '') || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Saldo valido in una certa data (ultimo saldo registrato fino a quel giorno).
 * Prima del primo saldo noto si assume il primo valore registrato.
 */
export function balanceAt(sortedHistory: BalanceSnapshot[], day: string): number {
  if (sortedHistory.length === 0) return 0;
  let value = sortedHistory[0].value;
  for (const snap of sortedHistory) {
    if ((dayKey(snap.date) ?? '') <= day) value = snap.value;
    else break;
  }
  return value;
}

/** Inserisce (o sostituisce, se nello stesso giorno) un saldo nello storico. */
export function upsertBalance(history: BalanceSnapshot[] = [], snapshot: BalanceSnapshot): BalanceSnapshot[] {
  const day = dayKey(snapshot.date);
  const rest = history.filter(s => dayKey(s.date) !== day);
  return sortBalances([...rest, { date: day ?? snapshot.date, value: snapshot.value, at: snapshot.at ?? new Date().toISOString() }]);
}

// ---------------------------------------------------------------------------
// Conti deposito
// ---------------------------------------------------------------------------

export interface DepositInterest {
  principal: number;
  accruedGross: number;
  accruedNet: number;
  atMaturityGross: number | null;
  atMaturityNet: number | null;
  /** Avanzamento del vincolo 0..1 */
  progress: number | null;
  daysToMaturity: number | null;
  matured: boolean;
}

/** Stima degli interessi (capitalizzazione semplice, ACT/365, al netto della ritenuta). */
export function depositInterest(asset: Asset, today: Date = new Date()): DepositInterest | null {
  if (asset.type !== 'Conto Deposito' || !asset.interestRate) return null;
  const principal = latestBalance(asset);
  const rate = asset.interestRate / 100;
  const tax = (asset.taxRate ?? DEFAULT_TAX_RATE) / 100;
  const start = asset.startDate ? parseISO(asset.startDate) : asset.purchaseDate ? parseISO(asset.purchaseDate) : null;
  const end = asset.maturityDate ? parseISO(asset.maturityDate) : null;
  if (!start || !isValid(start)) return null;

  const accrualEnd = end && isValid(end) && end < today ? end : today;
  const elapsed = Math.max(0, differenceInCalendarDays(accrualEnd, start));
  const accruedGross = principal * rate * (elapsed / 365);

  let atMaturityGross: number | null = null;
  let progress: number | null = null;
  let daysToMaturity: number | null = null;
  if (end && isValid(end)) {
    const total = Math.max(1, differenceInCalendarDays(end, start));
    atMaturityGross = principal * rate * (total / 365);
    progress = Math.min(1, Math.max(0, elapsed / total));
    daysToMaturity = differenceInCalendarDays(end, today);
  }

  return {
    principal,
    accruedGross,
    accruedNet: accruedGross * (1 - tax),
    atMaturityGross,
    atMaturityNet: atMaturityGross === null ? null : atMaturityGross * (1 - tax),
    progress,
    daysToMaturity,
    matured: daysToMaturity !== null && daysToMaturity <= 0,
  };
}

// ---------------------------------------------------------------------------
// Vista aggregata del portafoglio
// ---------------------------------------------------------------------------

export type FxRates = Record<string, number>;

export const fxRate = (rates: FxRates, currency: string) =>
  currency === BASE_CURRENCY ? 1 : rates?.[currency] ?? null;

export interface Holding {
  asset: Asset;
  group: AssetGroup;
  /** Valore nella valuta dell'asset */
  value: number;
  /** Valore in EUR (null se manca il cambio) */
  valueEur: number | null;
  fx: number | null;
  // Solo titoli
  quantity?: number;
  price?: number;
  avgPrice?: number;
  costBasis?: number;
  costBasisEur?: number | null;
  pl?: number;
  plPct?: number;
  realized?: number;
  dayChange?: number;
  dayChangeEur?: number | null;
  dayChangePct?: number;
  // Solo conti deposito
  deposit?: DepositInterest | null;
  /** Peso sul patrimonio totale (0..1) */
  weight: number;
}

export function buildHoldings(assets: Asset[], rates: FxRates): Holding[] {
  const holdings: Holding[] = assets.map(asset => {
    const meta = typeMeta(asset.type);
    const fx = fxRate(rates, asset.currency);

    if (meta.isMarket) {
      const position = computePosition(asset.transactions);
      const price = lastPrice(asset);
      const value = price !== undefined ? position.quantity * price : asset.currentValue ?? 0;
      const pl = value - position.costBasis;
      const dayChange = asset.dailyChange !== undefined ? asset.dailyChange * position.quantity : undefined;
      return {
        asset,
        group: meta.group,
        value,
        valueEur: fx === null ? null : value * fx,
        fx,
        quantity: position.quantity,
        price,
        avgPrice: position.avgPrice,
        costBasis: position.costBasis,
        costBasisEur: fx === null ? null : position.costBasis * fx,
        pl,
        plPct: position.costBasis > 0 ? pl / position.costBasis : 0,
        realized: position.realized,
        dayChange,
        dayChangeEur: dayChange === undefined || fx === null ? null : dayChange * fx,
        dayChangePct: asset.dailyChangePercent,
        weight: 0,
      };
    }

    const value = latestBalance(asset);
    return {
      asset,
      group: meta.group,
      value,
      valueEur: fx === null ? null : value * fx,
      fx,
      deposit: depositInterest(asset),
      weight: 0,
    };
  });

  const total = holdings.reduce((sum, h) => sum + Math.max(0, h.valueEur ?? 0), 0);
  holdings.forEach(h => {
    h.weight = total > 0 ? Math.max(0, h.valueEur ?? 0) / total : 0;
  });
  return holdings;
}

export interface AllocationSlice {
  type: AssetType;
  value: number;
  share: number;
  count: number;
}

export interface ClassSlice {
  assetClass: AssetClass;
  value: number;
  share: number;
  count: number;
}

export interface Slice<K extends string> {
  key: K;
  value: number;
  share: number;
  count: number;
}

/**
 * Ripartizione per categoria o per classe di attivo, dalla voce più grande.
 * Le quote sono calcolate sul totale positivo degli holding passati
 * (tutto il patrimonio o, filtrando prima, i soli investimenti).
 */
export function allocationBy(holdings: Holding[], by: 'type'): Slice<AssetType>[];
export function allocationBy(holdings: Holding[], by: 'class'): Slice<AssetClass>[];
export function allocationBy(holdings: Holding[], by: 'type' | 'class'): Slice<string>[] {
  const groups = new Map<string, { value: number; count: number }>();
  for (const h of holdings) {
    if (h.valueEur === null || h.fx === null) continue;
    const key = by === 'type' ? h.asset.type : assetClassOf(h.asset);
    const slot = groups.get(key) ?? { value: 0, count: 0 };
    slot.value += h.valueEur;
    slot.count += 1;
    groups.set(key, slot);
  }
  const order: string[] = by === 'type' ? ASSET_TYPES : ASSET_CLASSES;
  const positive = Array.from(groups.values()).reduce((s, v) => s + Math.max(0, v.value), 0);
  return order
    .filter(key => groups.has(key))
    .map(key => {
      const { value, count } = groups.get(key)!;
      return { key, value, count, share: positive > 0 ? Math.max(0, value) / positive : 0 };
    })
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

export interface PortfolioSummary {
  netWorth: number;
  liquidity: number;
  investments: number;
  other: number;
  investedCost: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
  realizedPL: number;
  dayChange: number;
  dayChangePct: number;
  hasDayChange: boolean;
  accruedInterestNet: number;
  /** Parte della liquidità in conti deposito vincolati non ancora scaduti */
  lockedLiquidity: number;
  /** Scadenza del vincolo più vicina (yyyy-MM-dd) */
  nextUnlock: string | null;
  allocation: AllocationSlice[];
  /** Ripartizione per classe di attivo (azionario, obbligazionario…) */
  classAllocation: ClassSlice[];
  /** Valute per cui non è disponibile il cambio (esclusi dai totali) */
  missingFx: string[];
}

export function summarize(holdings: Holding[], today: string = todayKey()): PortfolioSummary {
  let liquidity = 0, investments = 0, other = 0, investedCost = 0, realizedPL = 0;
  let dayChange = 0, accruedInterestNet = 0, lockedLiquidity = 0;
  let nextUnlock: string | null = null;
  let hasDayChange = false;
  const missingFx = new Set<string>();

  for (const h of holdings) {
    if (h.valueEur === null || h.fx === null) {
      missingFx.add(h.asset.currency);
      continue;
    }
    if (h.group === 'liquidity') liquidity += h.valueEur;
    else if (h.group === 'investments') investments += h.valueEur;
    else other += h.valueEur;

    if (h.costBasis !== undefined) investedCost += h.costBasis * h.fx;
    if (h.realized) realizedPL += h.realized * h.fx;
    if (h.dayChangeEur != null) {
      dayChange += h.dayChangeEur;
      hasDayChange = true;
    }
    if (h.deposit) accruedInterestNet += h.deposit.accruedNet * h.fx;
    const maturity = h.asset.type === 'Conto Deposito' ? dayKey(h.asset.maturityDate) : null;
    if (maturity && maturity > today) {
      lockedLiquidity += h.valueEur;
      if (!nextUnlock || maturity < nextUnlock) nextUnlock = maturity;
    }
  }

  const netWorth = liquidity + investments + other;
  const allocation = allocationBy(holdings, 'type').map(({ key, ...rest }) => ({ type: key, ...rest }));
  const classAllocation = allocationBy(holdings, 'class').map(({ key, ...rest }) => ({ assetClass: key, ...rest }));

  const unrealizedPL = investments - investedCost;
  const previousInvestments = investments - dayChange;

  return {
    netWorth,
    liquidity,
    investments,
    other,
    investedCost,
    unrealizedPL,
    unrealizedPLPct: investedCost > 0 ? unrealizedPL / investedCost : 0,
    realizedPL,
    dayChange,
    dayChangePct: previousInvestments > 0 ? dayChange / previousInvestments : 0,
    hasDayChange,
    accruedInterestNet,
    lockedLiquidity,
    nextUnlock,
    allocation,
    classAllocation,
    missingFx: Array.from(missingFx),
  };
}

// ---------------------------------------------------------------------------
// Freschezza dei prezzi
// ---------------------------------------------------------------------------

/** Giorno lavorativo precedente (yyyy-MM-dd), saltando sabato e domenica. */
function previousBusinessDay(now: Date): string {
  let d = subDays(now, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = subDays(d, 1);
  return format(d, 'yyyy-MM-dd');
}

/**
 * Prezzo non aggiornato: l'ultimo aggiornamento è precedente al giorno
 * lavorativo prima di oggi. Vale solo per i titoli quotati.
 */
export function isStale(asset: Asset, now: Date = new Date()): boolean {
  if (!isMarketAsset(asset.type)) return false;
  const last = dayKey(asset.lastUpdated);
  if (!last) return true;
  return last < previousBusinessDay(now);
}

/**
 * Etichetta della variazione giornaliera: "oggi" se almeno un prezzo è della
 * giornata, altrimenti "ultima seduta" (sera, fine settimana, festivi).
 */
export function dayChangeLabel(marketTimes: (string | undefined)[], now: Date = new Date()): 'oggi' | 'ultima seduta' {
  const today = format(now, 'yyyy-MM-dd');
  return marketTimes.some(t => dayKey(t) === today) ? 'oggi' : 'ultima seduta';
}

// ---------------------------------------------------------------------------
// Serie storiche
// ---------------------------------------------------------------------------

export interface PricePoint {
  /** yyyy-MM-dd */
  date: string;
  close: number;
}

export interface HistoryPoint {
  date: string;
  /** Patrimonio totale in EUR */
  netWorth: number;
  /** Valore di mercato dei titoli in EUR */
  investments: number;
  /** Capitale netto investito nei titoli in EUR */
  invested: number;
  /** Conti e altri beni in EUR */
  cash: number;
}

export interface HistoryInput {
  assets: Asset[];
  /** Prezzi storici per ticker */
  prices: Record<string, PricePoint[]>;
  /** Cambi storici valuta→EUR */
  fxHistory: Record<string, PricePoint[]>;
  /** Cambi correnti, usati quando manca lo storico */
  fxNow: FxRates;
  start: string;
  end?: string;
  /** Numero massimo di punti restituiti */
  maxPoints?: number;
}

/** Restituisce una funzione che dà l'ultimo valore noto fino al giorno richiesto (giorni crescenti). */
function carryForward(series: PricePoint[] | undefined, { backfill = false } = {}) {
  const sorted = series ? [...series].sort((a, b) => a.date.localeCompare(b.date)) : [];
  let i = 0;
  // Con `backfill`, prima del primo punto si usa il primo valore noto
  let last: number | undefined = backfill ? sorted[0]?.close : undefined;
  return (day: string): number | undefined => {
    while (i < sorted.length && sorted[i].date <= day) {
      last = sorted[i].close;
      i++;
    }
    return last;
  };
}

export function buildHistory({ assets, prices, fxHistory, fxNow, start, end = todayKey(), maxPoints = 400 }: HistoryInput): HistoryPoint[] {
  if (start > end) return [];

  const market = assets.filter(a => isMarketAsset(a.type));
  const manual = assets.filter(a => !isMarketAsset(a.type));

  const fxLookups = new Map<string, (day: string) => number | undefined>();
  for (const currency of new Set(assets.map(a => a.currency))) {
    if (currency !== BASE_CURRENCY) fxLookups.set(currency, carryForward(fxHistory[currency]));
  }
  const fxAt = (currency: string, day: string): number | null => {
    if (currency === BASE_CURRENCY) return 1;
    return fxLookups.get(currency)?.(day) ?? fxNow?.[currency] ?? null;
  };

  const marketState = market.map(asset => {
    // Posizione cumulata dopo ogni giorno con operazioni
    const txs = sortTransactions(asset.transactions ?? []);
    const timeline: { day: string; position: Position }[] = [];
    txs.forEach((tx, i) => {
      const day = dayKey(tx.date) ?? '';
      const position = computePosition(txs.slice(0, i + 1));
      if (timeline.length && timeline[timeline.length - 1].day === day) timeline[timeline.length - 1].position = position;
      else timeline.push({ day, position });
    });
    return { asset, timeline, cursor: -1, price: carryForward(asset.ticker ? prices[asset.ticker] : undefined) };
  });
  const manualState = manual.map(asset => ({ asset, history: sortBalances(asset.balanceHistory), movements: asset.cashMovements ?? [] }));

  const points: HistoryPoint[] = [];
  for (let d = parseISO(start); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
    const day = format(d, 'yyyy-MM-dd');
    let investments = 0;
    let invested = 0;
    let cash = 0;

    for (const state of marketState) {
      const fx = fxAt(state.asset.currency, day);
      // Il lookup va chiamato ogni giorno per avanzare il cursore
      const close = state.price(day);
      while (state.cursor + 1 < state.timeline.length && state.timeline[state.cursor + 1].day <= day) state.cursor++;
      if (fx === null || state.cursor < 0) continue;
      const position = state.timeline[state.cursor].position;
      const unitPrice = close ?? position.avgPrice;
      investments += position.quantity * unitPrice * fx;
      invested += position.netInvested * fx;
    }

    for (const { asset, history, movements } of manualState) {
      const fx = fxAt(asset.currency, day);
      if (fx === null) continue;
      cash += accountBalanceAt(history, movements, day) * fx;
    }

    points.push({ date: day, netWorth: investments + cash, investments, invested, cash });
  }

  return downsample(points, maxPoints);
}

export interface IntradayInput {
  assets: Asset[];
  /** Prezzi infragiornalieri per ticker (date ISO con orario) */
  prices: Record<string, PricePoint[]>;
  /** Cambi infragiornalieri valuta→EUR */
  fxHistory: Record<string, PricePoint[]>;
  fxNow: FxRates;
  maxPoints?: number;
}

/** Posizione valida in un certo giorno, per giorni crescenti. */
function positionCursor(asset: Asset) {
  const txs = sortTransactions(asset.transactions ?? []);
  const timeline: { day: string; position: Position }[] = [];
  txs.forEach((tx, i) => {
    const day = dayKey(tx.date) ?? '';
    const position = computePosition(txs.slice(0, i + 1));
    if (timeline.length && timeline[timeline.length - 1].day === day) timeline[timeline.length - 1].position = position;
    else timeline.push({ day, position });
  });
  let cursor = -1;
  return (day: string): Position | null => {
    while (cursor + 1 < timeline.length && timeline[cursor + 1].day <= day) cursor++;
    return cursor < 0 ? null : timeline[cursor].position;
  };
}

/**
 * Andamento infragiornaliero (ultima seduta o settimana). L'asse dei tempi è
 * l'unione degli orari di tutti i titoli; ogni prezzo resta valido fino al
 * successivo e, prima del primo, vale il primo noto (le borse aprono a orari diversi).
 */
export function buildIntradayHistory({ assets, prices, fxHistory, fxNow, maxPoints = 400 }: IntradayInput): HistoryPoint[] {
  const market = assets.filter(a => isMarketAsset(a.type));
  const manual = assets.filter(a => !isMarketAsset(a.type));

  const times = Array.from(
    new Set(market.flatMap(a => (a.ticker ? prices[a.ticker.toUpperCase()] ?? [] : []).map(p => p.date))),
  ).sort();
  if (times.length === 0) return [];

  const fxLookups = new Map<string, (time: string) => number | undefined>();
  for (const currency of new Set(assets.map(a => a.currency))) {
    if (currency !== BASE_CURRENCY) fxLookups.set(currency, carryForward(fxHistory[currency], { backfill: true }));
  }
  // Una sola lettura per valuta e istante: i cursori avanzano solo in avanti
  const fxAt = (time: string) => {
    const rates = new Map<string, number | null>();
    return (currency: string): number | null => {
      if (currency === BASE_CURRENCY) return 1;
      if (!rates.has(currency)) rates.set(currency, fxLookups.get(currency)?.(time) ?? fxNow?.[currency] ?? null);
      return rates.get(currency)!;
    };
  };

  const marketState = market.map(asset => ({
    asset,
    position: positionCursor(asset),
    price: carryForward(asset.ticker ? prices[asset.ticker.toUpperCase()] : undefined, { backfill: true }),
  }));
  const manualState = manual.map(asset => ({ asset, history: sortBalances(asset.balanceHistory), movements: asset.cashMovements ?? [] }));

  const points = times.map(time => {
    const day = dayKey(time) ?? time.slice(0, 10);
    const fx = fxAt(time);
    let investments = 0;
    let invested = 0;
    let cash = 0;

    for (const state of marketState) {
      const close = state.price(time);
      const position = state.position(day);
      const rate = fx(state.asset.currency);
      if (!position || rate === null) continue;
      investments += position.quantity * (close ?? position.avgPrice) * rate;
      invested += position.netInvested * rate;
    }
    for (const { asset, history, movements } of manualState) {
      const rate = fx(asset.currency);
      if (rate !== null) cash += accountBalanceAt(history, movements, day) * rate;
    }
    return { date: time, netWorth: investments + cash, investments, invested, cash };
  });

  return downsample(points, maxPoints);
}

export function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result = points.filter((_, i) => i % step === 0);
  if (result[result.length - 1] !== points[points.length - 1]) result.push(points[points.length - 1]);
  return result;
}

export interface PeriodReturn {
  /** Guadagno al netto dei versamenti */
  gain: number;
  /** Guadagno rispetto al capitale impegnato nel periodo (valore iniziale + nuovi versamenti) */
  pct: number;
}

/**
 * Rendimento nel periodo depurato dei flussi (acquisti/vendite), ricavati dalle
 * variazioni del capitale investito. La percentuale è calcolata sul capitale
 * impegnato: valore a inizio periodo più i versamenti successivi.
 */
export function periodReturn(points: Pick<HistoryPoint, 'investments' | 'invested'>[]): PeriodReturn {
  if (points.length < 2) return { gain: 0, pct: 0 };
  const first = points[0];
  const last = points[points.length - 1];

  let netFlow = 0;
  let deposits = 0;
  for (let i = 1; i < points.length; i++) {
    const flow = points[i].invested - points[i - 1].invested;
    netFlow += flow;
    if (flow > 0) deposits += flow;
  }

  const gain = last.investments - first.investments - netFlow;
  const capital = first.investments + deposits;
  return { gain, pct: capital > 0 ? gain / capital : 0 };
}

export interface NetWorthChange {
  /** Variazione del patrimonio netto nel periodo, in EUR */
  change: number;
  pct: number;
  /** Parte dovuta all'andamento dei titoli (al netto di acquisti e vendite) */
  market: number;
  /** Il resto: nuovi risparmi sui conti, interessi, valore degli altri beni */
  other: number;
  /** Data del punto di partenza effettivo */
  since: string;
}

/**
 * Variazione del patrimonio da una data (esclusa) a oggi, scomposta tra mercati e risparmi.
 * Gli acquisti di titoli spostano denaro dai conti agli investimenti: non cambiano il patrimonio
 * e non vengono contati né come rendimento né come risparmio.
 */
export function netWorthChange(points: HistoryPoint[], from: string): NetWorthChange | null {
  if (points.length < 2) return null;
  let baseIndex = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].date.slice(0, 10) <= from) baseIndex = i;
    else break;
  }
  const span = points.slice(baseIndex);
  if (span.length < 2) return null;
  const base = span[0];
  const last = span[span.length - 1];
  const change = last.netWorth - base.netWorth;
  const market = periodReturn(span).gain;
  return {
    change,
    pct: base.netWorth > 0 ? change / base.netWorth : 0,
    market,
    other: change - market,
    since: base.date.slice(0, 10),
  };
}
