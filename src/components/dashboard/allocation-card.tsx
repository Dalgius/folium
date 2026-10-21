'use client';

import { useEffect, useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';
import { allocationBy, type Holding } from '@/lib/portfolio';
import { typeMeta } from '@/lib/asset-types';
import { classMeta } from '@/lib/asset-classes';
import { Segmented } from '@/components/segmented';
import { Money } from '@/components/money';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent } from '@/lib/utils';

type View = 'type' | 'class';
type Scope = 'all' | 'investments';

const VIEWS: { value: View; label: string }[] = [
  { value: 'type', label: 'Categoria' },
  { value: 'class', label: 'Classe' },
];

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Patrimonio' },
  { value: 'investments', label: 'Investimenti' },
];

const VIEW_KEY = 'folium:allocation';
const SCOPE_KEY = 'folium:allocation-scope';

/** Preferenza salvata nel browser, letta dopo il montaggio per non creare differenze con il rendering sul server. */
function useStoredChoice<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key) as T | null;
      if (saved && allowed.includes(saved)) setValue(saved);
    } catch {
      // archiviazione non disponibile: si usa il valore predefinito
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // ignorato
    }
  };
  return [value, set];
}

export function AllocationCard({ holdings, loading }: { holdings: Holding[]; loading: boolean }) {
  const [view, setView] = useStoredChoice<View>(VIEW_KEY, 'type', ['type', 'class']);
  const [savedScope, setScope] = useStoredChoice<Scope>(SCOPE_KEY, 'all', ['all', 'investments']);
  const hasInvestments = holdings.some(h => h.group === 'investments');
  const scope: Scope = hasInvestments ? savedScope : 'all';

  // Stessa forma per le due viste: chiave, etichetta, colore
  const { allocation, total } = useMemo(() => {
    const scoped = scope === 'investments' ? holdings.filter(h => h.group === 'investments') : holdings;
    const allocation = view === 'type'
      ? allocationBy(scoped, 'type').map(s => ({ ...s, label: typeMeta(s.key).plural, color: typeMeta(s.key).color }))
      : allocationBy(scoped, 'class').map(s => ({ ...s, label: classMeta(s.key).label, color: classMeta(s.key).color }));
    return { allocation, total: allocation.reduce((sum, s) => sum + s.value, 0) };
  }, [holdings, scope, view]);

  const subject = scope === 'investments' ? 'Investimenti' : 'Patrimonio';

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Allocazione</h2>
      <p className="text-sm text-muted-foreground">
        {subject} per {view === 'type' ? 'categoria' : 'classe di attivo'}
        {!loading && total > 0 && <> · su <Money value={total} /></>}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasInvestments && <Segmented options={SCOPES} value={scope} onChange={setScope} size="sm" ariaLabel="Ambito" />}
        <Segmented options={VIEWS} value={view} onChange={setView} size="sm" ariaLabel="Raggruppa per" />
      </div>

      {loading ? (
        <div className="mt-5 space-y-4">
          <Skeleton className="h-3 w-full" />
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      ) : allocation.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <PieChart className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nessun dato da mostrare</p>
        </div>
      ) : (
        <>
          <TooltipProvider delayDuration={100}>
            <div className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Barra di allocazione">
              {allocation.map(slice => (
                <Tooltip key={slice.key}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full min-w-[4px] first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-80"
                      style={{ width: `${slice.share * 100}%`, backgroundColor: slice.color }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {slice.label}: {formatPercent(slice.share, { signed: false, digits: 1 })}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <ul className="mt-5 space-y-3">
            {allocation.map(slice => (
              <li key={slice.key} className="flex items-center gap-3 text-sm">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
                <span className="flex-1 truncate">{slice.label}</span>
                <Money value={slice.value} className="text-muted-foreground" />
                <span className="w-14 text-right font-medium tabular">{formatPercent(slice.share, { signed: false, digits: 1 })}</span>
              </li>
            ))}
          </ul>
          {view === 'class' && (
            <p className="mt-4 text-xs text-muted-foreground">
              La classe dei titoli è proposta dal nome: puoi cambiarla da «Modifica dettagli».
            </p>
          )}
        </>
      )}
    </Card>
  );
}
