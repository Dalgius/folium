'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfYear, subDays, subMonths, subYears } from 'date-fns';
import type { Asset } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { buildHistory, dayKey, todayKey, type FxRates, type PricePoint } from '@/lib/portfolio';
import { getFxHistory, getPriceHistory } from '@/services/finance.service';

export type Period = '1M' | '3M' | '6M' | 'YTD' | '1A' | '5A' | 'MAX';

export const PERIODS: { value: Period; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1A', label: '1A' },
  { value: '5A', label: '5A' },
  { value: 'MAX', label: 'Max' },
];

/** Prima data rilevante del portafoglio (prima operazione o primo saldo). */
export function firstActivity(assets: Asset[]): string {
  const days = assets.flatMap(a => [
    ...(a.transactions ?? []).map(t => dayKey(t.date)),
    ...(a.balanceHistory ?? []).map(b => dayKey(b.date)),
  ]).filter((d): d is string => !!d);
  return days.length ? days.sort()[0] : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
}

function periodStart(period: Period, assets: Asset[]): string {
  const today = new Date();
  const first = firstActivity(assets);
  let start: Date;
  switch (period) {
    case '1M': start = subMonths(today, 1); break;
    case '3M': start = subMonths(today, 3); break;
    case '6M': start = subMonths(today, 6); break;
    case 'YTD': start = startOfYear(today); break;
    case '1A': start = subYears(today, 1); break;
    case '5A': start = subYears(today, 5); break;
    case 'MAX': return first;
  }
  const key = format(start, 'yyyy-MM-dd');
  // Non partire prima della prima attività: il grafico sarebbe piatto a zero
  return key < first ? first : key;
}

interface MarketData {
  key: string;
  prices: Record<string, PricePoint[]>;
  fxHistory: Record<string, PricePoint[]>;
}

export function usePortfolioHistory(assets: Asset[], fx: FxRates, period: Period) {
  const start = useMemo(() => periodStart(period, assets), [period, assets]);
  const tickers = useMemo(
    () => Array.from(new Set(assets.filter(a => isMarketAsset(a.type) && a.ticker).map(a => a.ticker!.toUpperCase()))).sort(),
    [assets],
  );
  const currencies = useMemo(
    () => Array.from(new Set(assets.map(a => a.currency))).filter(c => c !== 'EUR').sort(),
    [assets],
  );
  // Si scaricano anche alcuni giorni prima dell'inizio per avere l'ultima chiusura nota
  const fetchFrom = format(subDays(parseISO(start), 10), 'yyyy-MM-dd');
  const key = `${fetchFrom}|${tickers.join(',')}|${currencies.join(',')}`;

  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    Promise.all([
      tickers.length ? getPriceHistory(tickers, fetchFrom) : Promise.resolve({}),
      currencies.length ? getFxHistory(currencies, fetchFrom) : Promise.resolve({}),
    ])
      .then(([prices, fxHistory]) => {
        if (!cancelled) setData({ key, prices: prices ?? {}, fxHistory: fxHistory ?? {} });
      })
      .catch(err => {
        console.error('Storico non disponibile', err);
        if (!cancelled) {
          setError(true);
          setData({ key, prices: {}, fxHistory: {} });
        }
      });
    return () => {
      cancelled = true;
    };
    // `key` riassume tickers, valute e data di inizio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = !data || data.key !== key;

  const points = useMemo(() => {
    if (!data || assets.length === 0) return [];
    const today = todayKey();
    // Aggiunge il prezzo live di oggi se lo storico non lo contiene ancora
    const prices: Record<string, PricePoint[]> = { ...data.prices };
    for (const asset of assets) {
      const ticker = asset.ticker?.toUpperCase();
      if (!ticker || !asset.lastPrice) continue;
      const series = prices[ticker] ?? [];
      if (!series.length || series[series.length - 1].date < today) {
        prices[ticker] = [...series, { date: today, close: asset.lastPrice }];
      }
    }
    return buildHistory({ assets, prices, fxHistory: data.fxHistory, fxNow: fx, start, end: today });
  }, [data, assets, fx, start]);

  return { points, loading, error };
}
