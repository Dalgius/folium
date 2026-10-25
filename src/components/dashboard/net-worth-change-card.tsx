'use client';

import { useMemo } from 'react';
import { endOfMonth, format, parseISO, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Asset } from '@/types';
import { netWorthChange, type FxRates, type NetWorthChange } from '@/lib/portfolio';
import { usePortfolioHistory } from '@/hooks/use-portfolio-history';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HINTS, InfoHint } from '@/components/info-hint';

interface NetWorthChangeCardProps {
  assets: Asset[];
  fx: FxRates;
}

/** Come è cambiato il patrimonio questo mese e da inizio anno, e perché. */
export function NetWorthChangeCard({ assets, fx }: NetWorthChangeCardProps) {
  const { points, loading } = usePortfolioHistory(assets, fx, 'YTD');

  const periods = useMemo(() => {
    const today = new Date();
    const month = format(today, 'LLLL', { locale: it });
    return [
      {
        key: 'month',
        title: month.charAt(0).toUpperCase() + month.slice(1),
        startOfPeriod: format(startOfMonth(today), 'yyyy-MM-dd'),
        result: netWorthChange(points, format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')),
      },
      {
        key: 'year',
        title: 'Da inizio anno',
        startOfPeriod: format(startOfYear(today), 'yyyy-MM-dd'),
        result: netWorthChange(points, format(startOfYear(today), 'yyyy-MM-dd')),
      },
    ];
  }, [points]);

  if (!loading && periods.every(p => !p.result)) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {periods.map(p => (
        <Card key={p.key} className="p-3.5 sm:p-5" role="region" aria-label={p.title}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <Period title={p.title} startOfPeriod={p.startOfPeriod} result={p.result} />
          )}
        </Card>
      ))}
    </div>
  );
}

function Period({ title, startOfPeriod, result }: { title: string; startOfPeriod: string; result: NetWorthChange | null }) {
  if (!result) {
    return (
      <>
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Non ci sono ancora dati per questo periodo.</p>
      </>
    );
  }
  // Se lo storico comincia dopo l'inizio del periodo lo si dice, invece di far credere che copra tutto
  const late = result.since > startOfPeriod;
  return (
    <>
      <h2 className="text-sm font-medium text-muted-foreground">
        {title}
        {late && <span className="font-normal"> · dal {format(parseISO(result.since), 'd MMM', { locale: it })}</span>}
      </h2>
      {/* Su smartphone importo e percentuale vanno a capo per stare nella mezza card */}
      <Trend value={result.change} className="mt-1.5 text-base font-semibold sm:hidden" />
      <Trend pct={result.pct} showIcon={false} className="block text-xs sm:hidden" />
      <Trend value={result.change} pct={result.pct} className="mt-1.5 hidden text-xl font-semibold sm:inline-flex" />
      <dl className="mt-3 space-y-1.5 text-xs sm:text-sm">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <dt className="flex items-center gap-1 text-muted-foreground sm:gap-1.5">
            <span className="sm:hidden">Mercati</span>
            <span className="hidden sm:inline">Rendimento dei mercati</span>
            <InfoHint text={HINTS.market} />
          </dt>
          <dd><Money value={result.market} signed className="font-medium" /></dd>
        </div>
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <dt className="flex items-center gap-1 text-muted-foreground sm:gap-1.5">
            <span className="sm:hidden">Risparmi</span>
            <span className="hidden sm:inline">Risparmi e altre variazioni</span>
            <InfoHint text={HINTS.savings} />
          </dt>
          <dd><Money value={result.other} signed className="font-medium" /></dd>
        </div>
      </dl>
    </>
  );
}
