'use server';

import yahooFinance from 'yahoo-finance2';
import type { PricePoint } from '@/lib/portfolio';

yahooFinance.suppressNotices(['yahooSurvey']);

// ---------------------------------------------------------------------------
// Cache in memoria (per istanza server) per non interrogare Yahoo a ogni richiesta
// ---------------------------------------------------------------------------

const cache = new Map<string, { expires: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

/**
 * Yahoo cambia spesso il formato delle risposte: con la validazione attiva
 * la libreria scarta l'intera risposta se un solo campo non corrisponde allo
 * schema atteso. Accettiamo i dati così come arrivano e li controlliamo noi.
 */
const LENIENT = { validateResult: false } as const;

const QUOTE_TTL = 60 * 1000;
const HISTORY_TTL = 6 * 60 * 60 * 1000;
const MAX_SYMBOLS = 100;

const cleanSymbols = (symbols: string[]) =>
  Array.from(new Set(symbols.map(s => s?.trim().toUpperCase()).filter(s => s && s.length <= 32))).slice(0, MAX_SYMBOLS);

/**
 * Alcune borse quotano in sottounità (es. Londra in pence: "GBp").
 * Converte prezzo e valuta nell'unità principale.
 */
function normalizeCurrency(currency: string | undefined): { currency: string | undefined; factor: number } {
  switch (currency) {
    case 'GBp':
    case 'GBX':
      return { currency: 'GBP', factor: 0.01 };
    case 'ZAc':
      return { currency: 'ZAR', factor: 0.01 };
    case 'ILA':
      return { currency: 'ILS', factor: 0.01 };
    default:
      return { currency: currency?.toUpperCase(), factor: 1 };
  }
}

// ---------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------

export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

const SEARCHABLE_TYPES = new Set(['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY']);

export async function searchSecurities(query: string): Promise<SearchResult[]> {
  const q = query?.trim();
  if (!q || q.length < 2 || q.length > 64) return [];
  try {
    const key = `search:${q.toLowerCase()}`;
    const hit = cache.get(key);
    const results = (hit && hit.expires > Date.now()
      ? hit.value
      : await yahooFinance.search(q, { newsCount: 0, quotesCount: 12 }, LENIENT)) as { quotes?: unknown[] };
    const found = (results?.quotes ?? []).flatMap((item: unknown): SearchResult[] => {
      const quote = item as Record<string, unknown>;
      if (quote.isYahooFinance === false || typeof quote.symbol !== 'string') return [];
      if (!SEARCHABLE_TYPES.has(String(quote.quoteType)) || quote.symbol.includes('=')) return [];
      return [{
        ticker: quote.symbol,
        name: String(quote.longname ?? quote.shortname ?? quote.symbol),
        exchange: String(quote.exchDisp ?? quote.exchange ?? ''),
        type: String(quote.quoteType),
      }];
    });
    // Non memorizziamo i risultati vuoti, spesso dovuti a errori temporanei
    if (found.length) cache.set(key, { expires: Date.now() + QUOTE_TTL, value: results });
    return found;
  } catch (error) {
    console.error('Errore nella ricerca titoli:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Quotazioni
// ---------------------------------------------------------------------------

export interface Quote {
  ticker: string;
  price: number;
  currency: string;
  name: string;
  /** Variazione giornaliera per unità */
  dailyChange?: number;
  /** Variazione giornaliera decimale (0.025 = +2,5%) */
  dailyChangePercent?: number;
  /** Timestamp ISO dell'ultima quotazione */
  marketTime?: string;
  /** Tipo di strumento secondo Yahoo (EQUITY, ETF, MUTUALFUND, CRYPTOCURRENCY…) */
  quoteType?: string;
}

type RawQuote = {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: Date | number;
  currency?: string;
  longName?: string;
  shortName?: string;
  quoteType?: string;
};

/** Data da Date o timestamp Unix (secondi o millisecondi). */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value < 1e11 ? value * 1000 : value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const toIsoTime = (value: unknown) => toDate(value)?.toISOString();

function toQuote(raw: RawQuote): Quote | null {
  const { currency, factor } = normalizeCurrency(raw.currency);
  if (!raw.regularMarketPrice || raw.regularMarketPrice <= 0 || !currency) return null;
  const price = raw.regularMarketPrice * factor;

  let dailyChange: number | undefined;
  let dailyChangePercent: number | undefined;
  if (raw.regularMarketPreviousClose && raw.regularMarketPreviousClose > 0) {
    const previous = raw.regularMarketPreviousClose * factor;
    dailyChange = price - previous;
    dailyChangePercent = dailyChange / previous;
  } else if (raw.regularMarketChange !== undefined && raw.regularMarketChangePercent !== undefined) {
    dailyChange = raw.regularMarketChange * factor;
    // Yahoo restituisce la percentuale già moltiplicata per 100
    dailyChangePercent = raw.regularMarketChangePercent / 100;
  }

  return {
    ticker: raw.symbol,
    price,
    currency,
    name: raw.longName || raw.shortName || raw.symbol,
    dailyChange,
    dailyChangePercent,
    marketTime: toIsoTime(raw.regularMarketTime),
    quoteType: raw.quoteType,
  };
}

async function fetchQuotes(symbols: string[]): Promise<RawQuote[]> {
  try {
    const result = await yahooFinance.quote(symbols, { return: 'array' }, LENIENT);
    return (Array.isArray(result) ? result : []) as RawQuote[];
  } catch (error) {
    // Un singolo simbolo non valido può far fallire l'intera richiesta: riprova uno
    // per uno, pochi alla volta per non incorrere nei limiti di Yahoo
    console.warn('Richiesta multipla fallita, riprovo singolarmente:', describeError(error));
    const single = await mapLimit(symbols, 3, s =>
      yahooFinance.quote(s, {}, LENIENT).then(r => (r ?? null) as RawQuote | null).catch(error => {
        console.warn(`Quotazione non disponibile per ${s}:`, describeError(error));
        return null;
      }),
    );
    return single.filter((q): q is RawQuote => !!q && typeof q.symbol === 'string');
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Quotazioni correnti per più ticker in un'unica richiesta. */
export async function getQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  const symbols = cleanSymbols(tickers);
  if (symbols.length === 0) return {};
  const key = `quotes:${[...symbols].sort().join(',')}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Record<string, Quote>;
  try {
    const raw = await fetchQuotes(symbols);
    const result: Record<string, Quote> = {};
    for (const r of raw) {
      const quote = toQuote(r);
      if (quote) result[r.symbol.toUpperCase()] = quote;
    }
    // Un risultato vuoto di solito indica un errore temporaneo: non lo memorizziamo
    if (Object.keys(result).length) cache.set(key, { expires: Date.now() + QUOTE_TTL, value: result });
    return result;
  } catch (error) {
    console.error('Errore nel recupero delle quotazioni:', error);
    return {};
  }
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  const quotes = await getQuotes([ticker]);
  return quotes[ticker.trim().toUpperCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Abbinamento titoli importati da un broker
// ---------------------------------------------------------------------------

export interface SecurityToMatch {
  isin: string;
  /** Simboli Yahoo probabili, in ordine di preferenza */
  candidates: string[];
  currency: string;
}

export interface SecurityMatch {
  symbol: string;
  name: string;
  quoteType?: string;
  price?: number;
  currency?: string;
  /** Come è stato trovato: dal ticker del broker o cercando l'ISIN */
  source: 'ticker' | 'isin';
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

/**
 * Trova il simbolo Yahoo di ciascun titolo: prima prova i ticker candidati
 * (verificando che la valuta coincida), poi cerca per ISIN.
 */
export interface MatchResult {
  matches: (SecurityMatch | null)[];
  /** false se Yahoo non ha restituito nulla (né quotazioni né risultati di ricerca) */
  reachable: boolean;
}

export async function matchSecurities(items: SecurityToMatch[]): Promise<MatchResult> {
  const list = items.slice(0, MAX_SYMBOLS);
  const quotes = await getQuotes(list.flatMap(i => i.candidates));

  const matches: (SecurityMatch | null)[] = list.map(item => {
    for (const candidate of item.candidates) {
      const q = quotes[candidate.toUpperCase()];
      if (q && q.currency === item.currency.toUpperCase()) {
        return { symbol: q.ticker, name: q.name, quoteType: q.quoteType, price: q.price, currency: q.currency, source: 'ticker' };
      }
    }
    return null;
  });

  // Ricerca per ISIN per i titoli non trovati
  const pending = list.map((item, i) => ({ item, i })).filter(({ i }) => !matches[i]);
  let searchAnswered = false;
  const found = await mapLimit(pending, 2, async ({ item }) => {
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(item.isin)) return null;
    const results = await searchSecurities(item.isin);
    if (results.length === 0) return null;
    searchAnswered = true;
    const preferred =
      results.find(r => item.candidates.some(c => c.toUpperCase() === r.ticker.toUpperCase())) ??
      (item.currency === 'EUR' ? results.find(r => r.ticker.endsWith('.MI')) : undefined) ??
      results[0];
    return preferred;
  });

  const extraQuotes = await getQuotes(found.filter(Boolean).map(r => r!.ticker));
  pending.forEach(({ i }, k) => {
    const result = found[k];
    if (!result) return;
    const q = extraQuotes[result.ticker.toUpperCase()];
    matches[i] = {
      symbol: result.ticker,
      name: q?.name ?? result.name,
      quoteType: result.type,
      price: q?.price,
      currency: q?.currency,
      source: 'isin',
    };
  });

  return { matches, reachable: Object.keys(quotes).length > 0 || searchAnswered };
}

// ---------------------------------------------------------------------------
// Tassi di cambio
// ---------------------------------------------------------------------------

const fxSymbol = (from: string, to: string) => `${from}${to}=X`;

/** Tassi di cambio correnti verso `to` (default EUR). */
export async function getExchangeRates(currencies: string[], to = 'EUR'): Promise<Record<string, number>> {
  const unique = Array.from(new Set(currencies.map(c => c?.toUpperCase()).filter(Boolean)));
  const rates: Record<string, number> = { [to]: 1 };
  const needed = unique.filter(c => c !== to && /^[A-Z]{3}$/.test(c));
  if (needed.length === 0) return rates;

  const quotes = await getQuotes(needed.map(c => fxSymbol(c, to)));
  for (const c of needed) {
    const q = quotes[fxSymbol(c, to)];
    if (q?.price) rates[c] = q.price;
  }
  return rates;
}

// ---------------------------------------------------------------------------
// Storico prezzi
// ---------------------------------------------------------------------------

async function fetchHistory(symbol: string, start: string): Promise<PricePoint[]> {
  return cached(`history:${symbol}:${start}`, HISTORY_TTL, async () => {
    const result = await yahooFinance.chart(symbol, { period1: start, interval: '1d', return: 'array' }, LENIENT);
    const { factor } = normalizeCurrency(result?.meta?.currency);
    const quotes: { date?: unknown; close?: number | null }[] = result?.quotes ?? [];
    return quotes.flatMap(q => {
      const date = toDate(q.date);
      if (!date || q.close == null || !(q.close > 0)) return [];
      return [{ date: date.toISOString().slice(0, 10), close: q.close * factor }];
    });
  });
}

/** Storico delle chiusure giornaliere dalla data `start` (yyyy-MM-dd). */
export async function getPriceHistory(tickers: string[], start: string): Promise<Record<string, PricePoint[]>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return {};
  const symbols = cleanSymbols(tickers);
  const entries = await Promise.all(
    symbols.map(async symbol => {
      try {
        return [symbol, await fetchHistory(symbol, start)] as const;
      } catch (error) {
        console.warn(`Storico non disponibile per ${symbol}:`, error);
        return [symbol, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/** Storico dei cambi valuta→`to` dalla data `start`. */
export async function getFxHistory(currencies: string[], start: string, to = 'EUR'): Promise<Record<string, PricePoint[]>> {
  const needed = Array.from(new Set(currencies.map(c => c?.toUpperCase()))).filter(c => c && c !== to && /^[A-Z]{3}$/.test(c));
  const history = await getPriceHistory(needed.map(c => fxSymbol(c, to)), start);
  return Object.fromEntries(needed.map(c => [c, history[fxSymbol(c, to)] ?? []]));
}
