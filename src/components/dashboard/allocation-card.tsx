'use client';

import { PieChart } from 'lucide-react';
import type { PortfolioSummary } from '@/lib/portfolio';
import { typeMeta } from '@/lib/asset-types';
import { Money } from '@/components/money';
import { CategoryDot } from '@/components/asset-icons';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent } from '@/lib/utils';

export function AllocationCard({ summary, loading }: { summary: PortfolioSummary; loading: boolean }) {
  const { allocation } = summary;

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Allocazione</h2>
      <p className="text-sm text-muted-foreground">Ripartizione del patrimonio per categoria</p>

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
                <Tooltip key={slice.type}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full min-w-[4px] first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-80"
                      style={{ width: `${slice.share * 100}%`, backgroundColor: typeMeta(slice.type).color }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {typeMeta(slice.type).plural}: {formatPercent(slice.share, { signed: false, digits: 1 })}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <ul className="mt-5 space-y-3">
            {allocation.map(slice => (
              <li key={slice.type} className="flex items-center gap-3 text-sm">
                <CategoryDot type={slice.type} />
                <span className="flex-1 truncate">{typeMeta(slice.type).plural}</span>
                <Money value={slice.value} className="text-muted-foreground" />
                <span className="w-14 text-right font-medium tabular">{formatPercent(slice.share, { signed: false, digits: 1 })}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
