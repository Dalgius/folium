'use client';

import type { PricePoint } from '@/lib/portfolio';
import type { Quote } from '@/lib/yahoo-chart';
import { searchSecurities, type SearchResult } from '@/services/finance.service';

export type { Quote } from '@/lib/yahoo-chart';
export type { SearchResult } from '@/services/finance.service';

/**
 * Dati di mercato per il browser. Prezzi e storico arrivano dalle route Edge
 * (/api/quotes, /api/history): i server Node di Vercel sono bloccati da Yahoo.
 * La ricerca resta una server action, perché quell'endpoint non è bloccato.
 */

const CHUNK = 25;

const unique = (symbols: string[]) =>
  Array.from(new Set(symbols.map(s => s?.trim().toUpperCase()).filter(Boolean)));

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.warn('Richiesta dati di mercato non riuscita', url, error);
    return null;
  }
}

/** Quotazioni correnti, indicizzate per simbolo maiuscolo. */
export async function getQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  const symbols = unique(tickers);
  const parts = await Promise.all(
    chunks(symbols, CHUNK).map(group =>
      getJson<{ quotes?: Record<string, Quote> }>(`/api/quotes?symbols=${encodeURIComponent(group.join(','))}`),
    ),
  );
  return Object.assign({}, ...parts.map(p => p?.quotes ?? {}));
}

export async function getQuote(ticker: string): Promise<Quote | null> {
  const symbol = ticker.trim().toUpperCase();
  return (await getQuotes([symbol]))[symbol] ?? null;
}

const fxSymbol = (from: string, to: string) => `${from}${to}=X`;

/** Tassi di cambio correnti verso `to` (default EUR). */
export async function getExchangeRates(currencies: string[], to = 'EUR'): Promise<Record<string, number>> {
  const needed = unique(currencies).filter(c => c !== to && /^[A-Z]{3}$/.test(c));
  const rates: Record<string, number> = { [to]: 1 };
  if (needed.length === 0) return rates;
  const quotes = await getQuotes(needed.map(c => fxSymbol(c, to)));
  for (const c of needed) {
    const q = quotes[fxSymbol(c, to)];
    if (q?.price) rates[c] = q.price;
  }
  return rates;
}

/** Storico delle chiusure giornaliere dalla data `start` (yyyy-MM-dd). */
export async function getPriceHistory(tickers: string[], start: string): Promise<Record<string, PricePoint[]>> {
  const symbols = unique(tickers);
  const parts = await Promise.all(
    chunks(symbols, CHUNK).map(group =>
      getJson<{ history?: Record<string, PricePoint[]> }>(
        `/api/history?start=${start}&symbols=${encodeURIComponent(group.join(','))}`,
      ),
    ),
  );
  return Object.assign({}, ...parts.map(p => p?.history ?? {}));
}

/** Storico dei cambi valuta→`to` dalla data `start`. */
export async function getFxHistory(currencies: string[], start: string, to = 'EUR'): Promise<Record<string, PricePoint[]>> {
  const needed = unique(currencies).filter(c => c !== to && /^[A-Z]{3}$/.test(c));
  if (needed.length === 0) return {};
  const history = await getPriceHistory(needed.map(c => fxSymbol(c, to)), start);
  return Object.fromEntries(needed.map(c => [c, history[fxSymbol(c, to)] ?? []]));
}

/**
 * Ricerca titoli. Cercando un ticker senza suffisso ("ISP") la quotazione di
 * Borsa Italiana va in cima; se Yahoo non la propone, la verifichiamo direttamente.
 */
export async function searchWithMilan(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  const found = (await searchSecurities(q)) ?? [];
  const milan = `${q.toUpperCase()}.MI`;
  if (/^[A-Z0-9]{1,5}$/i.test(q) && !found.some(r => r.ticker.toUpperCase() === milan)) {
    const quote = await getQuote(milan);
    if (quote) found.unshift({ ticker: milan, name: quote.name, exchange: 'Milano', type: quote.quoteType ?? 'EQUITY' });
  }
  return [...found].sort((a, b) => Number(b.ticker.toUpperCase() === milan) - Number(a.ticker.toUpperCase() === milan));
}

// ---------------------------------------------------------------------------
// Abbinamento dei titoli importati da un broker
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

export interface MatchResult {
  matches: (SecurityMatch | null)[];
  /** false se Yahoo non ha restituito nulla (né quotazioni né risultati di ricerca) */
  reachable: boolean;
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
export async function matchSecurities(items: SecurityToMatch[]): Promise<MatchResult> {
  const quotes = await getQuotes(items.flatMap(i => i.candidates));

  const matches: (SecurityMatch | null)[] = items.map(item => {
    for (const candidate of item.candidates) {
      const q = quotes[candidate.toUpperCase()];
      if (q && q.currency === item.currency.toUpperCase()) {
        return { symbol: q.ticker, name: q.name, quoteType: q.quoteType, price: q.price, currency: q.currency, source: 'ticker' };
      }
    }
    return null;
  });

  // Ricerca per ISIN per i titoli non trovati
  let searchAnswered = false;
  const pending = items.map((item, i) => ({ item, i })).filter(({ i }) => !matches[i]);
  const found = await mapLimit(pending, 2, async ({ item }) => {
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(item.isin)) return null;
    const results = (await searchSecurities(item.isin)) ?? [];
    if (results.length === 0) return null;
    searchAnswered = true;
    return (
      results.find(r => item.candidates.some(c => c.toUpperCase() === r.ticker.toUpperCase())) ??
      (item.currency === 'EUR' ? results.find(r => r.ticker.endsWith('.MI')) : undefined) ??
      results[0]
    );
  });

  const extraQuotes = await getQuotes(found.filter((r): r is SearchResult => !!r).map(r => r.ticker));
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
