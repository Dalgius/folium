'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeftRight, Search, SearchX } from 'lucide-react';
import type { Asset } from '@/types';
import { buildMovements, isCashFlow, isTrade, MOVEMENT_LABEL, type Movement } from '@/lib/movements';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { AssetBadge } from '@/components/asset-icons';
import { Segmented } from '@/components/segmented';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatNumber, trendClass } from '@/lib/utils';

type Filter = 'all' | 'trades' | 'accounts';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'trades', label: 'Titoli' },
  { value: 'accounts', label: 'Conti' },
];

const PAGE = 60;

interface MovementsListProps {
  assets: Asset[];
  loading: boolean;
  onSelect: (assetId: string) => void;
}

/** Cronologia di acquisti, vendite e saldi registrati, raggruppata per mese. */
export function MovementsList({ assets, loading, onSelect }: MovementsListProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => buildMovements(assets), [assets]);
  const query = search.trim().toLowerCase();
  const filtered = all.filter(m => {
    if (filter === 'trades' && !isTrade(m)) return false;
    if (filter === 'accounts' && isTrade(m)) return false;
    return !query || m.assetName.toLowerCase().includes(query) || !!m.description?.toLowerCase().includes(query);
  });
  const shown = filtered.slice(0, limit);

  const months = useMemo(() => {
    const groups: { key: string; label: string; items: Movement[]; income: number; expense: number }[] = [];
    for (const m of shown) {
      const key = m.date.slice(0, 7);
      if (groups.at(-1)?.key !== key) groups.push({ key, label: format(parseISO(m.date), 'MMMM yyyy', { locale: it }), items: [], income: 0, expense: 0 });
      const group = groups.at(-1)!;
      group.items.push(m);
      if (m.kind === 'income') group.income += m.amount;
      if (m.kind === 'expense') group.expense += m.amount;
    }
    return groups;
  }, [shown]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">Movimenti</h2>
          <Segmented options={FILTERS} value={filter} onChange={v => { setFilter(v); setLimit(PAGE); }} size="sm" ariaLabel="Tipo di movimento" />
        </div>
        <div className="relative lg:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE); }} placeholder="Cerca…" className="h-9 pl-9" aria-label="Cerca movimenti" />
        </div>
      </div>

      {loading ? (
        <div className="divide-y">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          {all.length === 0 ? <ArrowLeftRight className="h-8 w-8 text-muted-foreground" /> : <SearchX className="h-8 w-8 text-muted-foreground" />}
          <p className="mt-3 font-medium">{all.length === 0 ? 'Nessun movimento' : 'Nessun movimento trovato'}</p>
          <p className="text-sm text-muted-foreground">
            {all.length === 0 ? 'Acquisti, vendite, entrate, uscite e saldi compariranno qui.' : 'Prova a cambiare filtro o ricerca.'}
          </p>
        </div>
      ) : (
        <>
          {months.map(month => (
            <section key={month.key} aria-label={month.label}>
              <h3 className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b bg-muted/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">
                <span>{month.label}</span>
                {(month.income !== 0 || month.expense !== 0) && (
                  <span className="font-normal normal-case tracking-normal">
                    entrate <Money value={month.income} signed className="font-medium text-foreground" />
                    {' · '}uscite <Money value={month.expense} signed className="font-medium text-foreground" />
                  </span>
                )}
              </h3>
              <ul className="divide-y">
                {month.items.map(m => <MovementRow key={m.id} movement={m} onSelect={onSelect} />)}
              </ul>
            </section>
          ))}
          {filtered.length > limit && (
            <div className="border-t p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + PAGE)}>
                Mostra altri ({filtered.length - limit})
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function MovementRow({ movement: m, onSelect }: { movement: Movement; onSelect: (assetId: string) => void }) {
  const trade = isTrade(m);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(m.assetId)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-5"
      >
        <span className="w-10 shrink-0 text-center text-xs leading-tight text-muted-foreground">
          <span className="block text-base font-semibold text-foreground tabular">{format(parseISO(m.date), 'd')}</span>
          {format(parseISO(m.date), 'EEE', { locale: it })}
        </span>
        <AssetBadge type={m.assetType} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{m.assetName}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={m.kind === 'sell' || m.kind === 'expense' ? 'outline' : 'secondary'} className="px-1.5 py-0 text-[11px] font-medium">{MOVEMENT_LABEL[m.kind]}</Badge>
            {trade && (
              <span className="truncate tabular">
                {formatNumber(m.quantity!)} × <Money value={m.price!} currency={m.currency} />
              </span>
            )}
            {m.description && <span className="truncate">{m.description}</span>}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm">
          <Money value={m.amount} currency={m.currency} signed={isCashFlow(m)} className={cn('block font-medium', isCashFlow(m) && trendClass(m.amount))} />
          {m.change !== undefined && <Trend value={m.change} currency={m.currency} showIcon={false} className="text-xs" />}
        </span>
      </button>
    </li>
  );
}
