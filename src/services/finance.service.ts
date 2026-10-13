'use server';

import yahooFinance from 'yahoo-finance2';

/**
 * Ricerca titoli su Yahoo Finance, eseguita sul server.
 * Prezzi e storico arrivano invece dalle route Edge (/api/quotes, /api/history),
 * perché Yahoo rifiuta le richieste di quotazioni dai server Node di Vercel.
 */

yahooFinance.suppressNotices(['yahooSurvey']);

/** Accettiamo le risposte anche se Yahoo ne cambia il formato (le controlliamo noi). */
const LENIENT = { validateResult: false } as const;

const SEARCH_TTL = 5 * 60 * 1000;
const cache = new Map<string, { expires: number; value: unknown }>();

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
    if (found.length) cache.set(key, { expires: Date.now() + SEARCH_TTL, value: results });
    return found;
  } catch (error) {
    console.error('Errore nella ricerca titoli:', error);
    return [];
  }
}
