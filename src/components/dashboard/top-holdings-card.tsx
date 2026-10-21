'use client';

import { ArrowRight } from 'lucide-react';
import type { Holding } from '@/lib/portfolio';
import { typeMeta } from '@/lib/asset-types';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { AssetBadge } from '@/components/asset-icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPercent } from '@/lib/utils';

const LIMIT = 5;

interface TopHoldingsCardProps {
  holdings: Holding[];
  onSelect: (id: string) => void;
  onShowAll: () => void;
  /** "oggi" o "ultima seduta" */
  dayLabel?: string;
}

/** Le posizioni più grandi, per il colpo d'occhio in Panoramica. */
export function TopHoldingsCard({ holdings, onSelect, onShowAll, dayLabel = 'oggi' }: TopHoldingsCardProps) {
  const top = holdings
    .filter(h => h.valueEur !== null && h.valueEur > 0)
    .sort((a, b) => (b.valueEur ?? 0) - (a.valueEur ?? 0))
    .slice(0, LIMIT);

  if (top.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Posizioni principali</h2>
        <Button variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary" onClick={onShowAll}>
          Vedi tutte ({holdings.length}) <ArrowRight />
        </Button>
      </div>
      <ul className="mt-3 divide-y">
        {top.map(h => (
          <li key={h.asset.id}>
            <button
              type="button"
              onClick={() => onSelect(h.asset.id)}
              className="flex w-full items-center gap-3 rounded-md py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AssetBadge type={h.asset.type} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{h.asset.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {typeMeta(h.asset.type).label} · {formatPercent(h.weight, { signed: false, digits: 1 })} del patrimonio
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <Money value={h.valueEur ?? 0} className="block font-medium" />
                {h.dayChangePct !== undefined && (
                  <span className="text-xs">
                    <Trend pct={h.dayChangePct} showIcon={false} /> <span className="sr-only">{dayLabel}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
