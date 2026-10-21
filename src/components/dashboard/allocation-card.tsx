'use client';

import { useEffect, useState } from 'react';
import { PieChart } from 'lucide-react';
import type { PortfolioSummary } from '@/lib/portfolio';
import { typeMeta } from '@/lib/asset-types';
import { classMeta } from '@/lib/asset-classes';
import { Segmented } from '@/components/segmented';
import { Money } from '@/components/money';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent } from '@/lib/utils';

type View = 'type' | 'class';

const VIEWS: { value: View; label: string }[] = [
  { value: 'type', label: 'Categoria' },
  { value: 'class', label: 'Classe' },
];

const STORAGE_KEY = 'folium:allocation';

export function AllocationCard({ summary, loading }: { summary: PortfolioSummary; loading: boolean }) {
  const [view, setViewState] = useState<View>('type');

  // Letto dopo il montaggio per non creare differenze con il rendering sul server
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'class') setViewState('class');
    } catch {
      // archiviazione non disponibile: si resta sulla vista per categoria
    }
  }, []);
  const setView = (value: View) => {
    setViewState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignorato
    }
  };

  // Stessa forma per le due viste: chiave, etichetta, colore
  const allocation = view === 'type'
    ? summary.allocation.map(s => ({ key: s.type, label: typeMeta(s.type).plural, color: typeMeta(s.type).color, value: s.value, share: s.share }))
    : summary.classAllocation.map(s => ({ key: s.assetClass, label: classMeta(s.assetClass).label, color: classMeta(s.assetClass).color, value: s.value, share: s.share }));

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Allocazione</h2>
          <p className="text-sm text-muted-foreground">
            {view === 'type' ? 'Ripartizione del patrimonio per categoria' : 'Ripartizione per classe di attivo'}
          </p>
        </div>
        <Segmented options={VIEWS} value={view} onChange={setView} size="sm" ariaLabel="Raggruppa per" className="shrink-0" />
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
