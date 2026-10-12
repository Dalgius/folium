'use client';

import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarClock } from 'lucide-react';
import type { Holding } from '@/lib/portfolio';
import { Money } from '@/components/money';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** Scadenze dei conti deposito vincolati, dalla più vicina. */
export function MaturitiesCard({ holdings, onSelect }: { holdings: Holding[]; onSelect: (id: string) => void }) {
  const deposits = holdings
    .filter(h => h.asset.type === 'Conto Deposito' && h.asset.maturityDate && h.deposit)
    .sort((a, b) => a.asset.maturityDate!.localeCompare(b.asset.maturityDate!));

  if (deposits.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Scadenze vincoli</h2>
      </div>
      <ul className="mt-4 space-y-4">
        {deposits.map(({ asset, deposit }) => {
          const days = deposit!.daysToMaturity ?? 0;
          return (
            <li key={asset.id}>
              <button type="button" onClick={() => onSelect(asset.id)} className="w-full space-y-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{asset.name}</span>
                  <span className={cn('shrink-0 text-xs', days <= 30 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {days <= 0 ? 'Scaduto' : days === 1 ? 'Domani' : `tra ${days} giorni`}
                  </span>
                </div>
                <Progress value={(deposit!.progress ?? 0) * 100} className="h-1.5" aria-label="Avanzamento del vincolo" />
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                  <span>{format(parseISO(asset.maturityDate!), 'd MMM yyyy', { locale: it })} · {asset.interestRate?.toLocaleString('it-IT')}% lordo</span>
                  {deposit!.atMaturityNet !== null && (
                    <span>interessi netti <Money value={deposit!.atMaturityNet} currency={asset.currency} className="text-positive" signed /></span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
