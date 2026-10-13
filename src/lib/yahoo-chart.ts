import type { PricePoint } from '@/lib/portfolio';

/**
 * Lettura delle risposte dell'endpoint "chart" (v8) di Yahoo Finance.
 * Funzioni pure, usate dalle route Edge e dai test.
 */

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

/**
 * Alcune borse quotano in sottounità (es. Londra in pence: "GBp").
 * Converte prezzo e valuta nell'unità principale.
 */
export function normalizeCurrency(currency: string | undefined): { currency: string | undefined; factor: number } {
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

/** Simbolo valido per Yahoo (lettere, cifre e . - ^ =). */
export const isValidSymbol = (s: string) => /^[A-Z0-9.^=-]{1,32}$/i.test(s);

interface ChartResult {
  meta?: {
    symbol?: string;
    currency?: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    longName?: string;
    shortName?: string;
    instrumentType?: string;
  };
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
}

function firstResult(json: unknown): ChartResult | null {
  const result = (json as { chart?: { result?: ChartResult[] | null } })?.chart?.result;
  return Array.isArray(result) && result.length ? result[0] : null;
}

const utcDay = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);

/** Chiusure giornaliere (data UTC yyyy-MM-dd) già convertite nell'unità principale. */
export function parseChartHistory(json: unknown): PricePoint[] {
  const result = firstResult(json);
  if (!result) return [];
  const { factor } = normalizeCurrency(result.meta?.currency);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: PricePoint[] = [];
  timestamps.forEach((t, i) => {
    const close = closes[i];
    if (typeof t === 'number' && typeof close === 'number' && close > 0) {
      points.push({ date: utcDay(t), close: close * factor });
    }
  });
  return points;
}

/** Quotazione corrente con variazione rispetto all'ultima chiusura precedente. */
export function parseChartQuote(json: unknown, requested: string): Quote | null {
  const result = firstResult(json);
  const meta = result?.meta;
  if (!meta) return null;
  const { currency, factor } = normalizeCurrency(meta.currency);
  if (!meta.regularMarketPrice || meta.regularMarketPrice <= 0 || !currency) return null;
  const price = meta.regularMarketPrice * factor;
  const marketTime = typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime : Math.floor(Date.now() / 1000);

  // Chiusura precedente: ultima barra giornaliera prima del giorno dell'ultimo prezzo
  const marketDay = utcDay(marketTime);
  let previous: number | undefined;
  for (const point of parseChartHistory(json)) {
    if (point.date < marketDay) previous = point.close;
  }
  if (previous === undefined) {
    const fallback = meta.previousClose ?? meta.chartPreviousClose;
    if (fallback) previous = fallback * factor;
  }

  const dailyChange = previous && previous > 0 ? price - previous : undefined;
  return {
    ticker: (meta.symbol ?? requested).toUpperCase(),
    price,
    currency,
    name: meta.longName || meta.shortName || requested,
    dailyChange,
    dailyChangePercent: dailyChange !== undefined && previous ? dailyChange / previous : undefined,
    marketTime: new Date(marketTime * 1000).toISOString(),
    quoteType: meta.instrumentType,
  };
}
