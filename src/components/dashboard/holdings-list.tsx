'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowDownUp, ArrowLeftRight, CalendarDays, ChevronDown, MoreHorizontal, Pencil, PencilLine, Search, SearchX, Trash2, Wallet, Clock } from 'lucide-react';
import type { Holding } from '@/lib/portfolio';
import { GROUP_LABEL, typeMeta, type AssetGroup } from '@/lib/asset-types';
import { coveringSnapshot, isStale, latestBalance, sortBalances } from '@/lib/portfolio';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { AssetBadge } from '@/components/asset-icons';
import { Segmented } from '@/components/segmented';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatNumber, formatPercent } from '@/lib/utils';

export type HoldingAction = 'details' | 'transaction' | 'balance' | 'cash' | 'edit' | 'delete';

type Filter = 'all' | AssetGroup;
type Sort = 'value' | 'name' | 'performance' | 'day';

const GROUP_ORDER: AssetGroup[] = ['liquidity', 'investments', 'other'];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'value', label: 'Valore' },
  { value: 'name', label: 'Nome' },
  { value: 'performance', label: 'Rendimento' },
  { value: 'day', label: 'Variazione giornaliera' },
];

// Colonne su desktop: nome | dettaglio | oggi | valore | rendimento | peso | azioni
const GRID = 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_56px_40px] md:items-center md:gap-4';

/** Rendimento di un bene a valore manuale rispetto al primo saldo registrato. */
function manualChange(h: Holding) {
  const history = sortBalances(h.asset.balanceHistory);
  if (history.length < 2) return null;
  const first = history[0].value;
  const change = latestBalance(h.asset) - first;
  return { change, pct: first > 0 ? change / first : 0 };
}

function performanceOf(h: Holding): number {
  if (h.plPct !== undefined) return h.plPct;
  if (h.deposit) return h.deposit.principal > 0 ? h.deposit.accruedNet / h.deposit.principal : 0;
  return h.group === 'other' ? manualChange(h)?.pct ?? 0 : 0;
}

const COLLAPSED_KEY = 'folium:collapsed-groups';

interface HoldingsListProps {
  holdings: Holding[];
  loading: boolean;
  onAction: (action: HoldingAction, assetId: string) => void;
  /** Azioni su tutto un gruppo: aggiornamento dei saldi o correzione delle date */
  onBulkAction?: (kind: 'balances' | 'dates') => void;
  /** "oggi" o "ultima seduta" */
  dayLabel?: string;
}

export function HoldingsList({ holdings, loading, onAction, onBulkAction, dayLabel = 'oggi' }: HoldingsListProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('value');
  const [search, setSearch] = useState('');

  const presentGroups = GROUP_ORDER.filter(g => holdings.some(h => h.group === g));
  const filterOptions: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Tutte' },
    ...presentGroups.map(g => ({ value: g as Filter, label: GROUP_LABEL[g] })),
  ];
  const activeFilter = filter === 'all' || presentGroups.includes(filter) ? filter : 'all';

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = (h: Holding) =>
      !term || [h.asset.name, h.asset.ticker, h.asset.institution, typeMeta(h.asset.type).label].some(v => v?.toLowerCase().includes(term));

    const compare = (a: Holding, b: Holding) => {
      switch (sort) {
        case 'name': return a.asset.name.localeCompare(b.asset.name, 'it');
        case 'performance': return performanceOf(b) - performanceOf(a);
        case 'day': return (b.dayChangePct ?? -Infinity) - (a.dayChangePct ?? -Infinity);
        default: return (b.valueEur ?? 0) - (a.valueEur ?? 0);
      }
    };

    return GROUP_ORDER.filter(g => activeFilter === 'all' || g === activeFilter)
      .map(group => {
        const items = holdings.filter(h => h.group === group && matches(h)).sort(compare);
        const total = items.reduce((s, h) => s + (h.valueEur ?? 0), 0);
        return { group, items, total };
      })
      .filter(g => g.items.length > 0);
  }, [holdings, activeFilter, sort, search]);

  // Gruppi chiusi, ricordati nel browser
  const [collapsed, setCollapsed] = useState<AssetGroup[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
      if (Array.isArray(saved)) setCollapsed(saved);
    } catch {
      // archiviazione non disponibile: tutti i gruppi aperti
    }
  }, []);
  const toggleGroup = (group: AssetGroup) =>
    setCollapsed(current => {
      const next = current.includes(group) ? current.filter(g => g !== group) : [...current, group];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // ignorato
      }
      return next;
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">Posizioni</h2>
          {presentGroups.length > 1 && (
            <Segmented options={filterOptions} value={activeFilter} onChange={setFilter} size="sm" ariaLabel="Filtra per gruppo" />
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-56 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca…" className="h-9 pl-9" aria-label="Cerca posizioni" />
          </div>
          <Select value={sort} onValueChange={v => setSort(v as Sort)}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Ordina per">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map(s => <SelectItem key={s.value} value={s.value}>Ordina: {s.label}</SelectItem>)}
            </SelectContent>
          </Select>
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
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nessuna posizione trovata</p>
          <p className="text-sm text-muted-foreground">Prova a cambiare filtro o ricerca.</p>
        </div>
      ) : (
        <div role="table" aria-label="Posizioni">
          <div role="row" className={cn('hidden border-b bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground', GRID)}>
            <span role="columnheader">Nome</span>
            <span role="columnheader">Dettaglio</span>
            <span role="columnheader" className="text-right">{dayLabel === 'oggi' ? 'Oggi' : 'Ultima seduta'}</span>
            <span role="columnheader" className="text-right">Valore</span>
            <span role="columnheader" className="text-right">Rendimento</span>
            <span role="columnheader" className="text-right">Peso</span>
            <span />
          </div>
          {groups.map(({ group, items, total }) => (
            <div key={group} role="rowgroup">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={!collapsed.includes(group) || !!search}
                  aria-controls={`group-${group}`}
                  className="-ml-1 flex h-8 items-center gap-1.5 rounded-md px-1 uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed.includes(group) && !search && '-rotate-90')} aria-hidden />
                  {GROUP_LABEL[group]}
                  <span className="font-normal normal-case tracking-normal">({items.length})</span>
                </button>
                <div className="flex items-center gap-3">
                  {onBulkAction && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs normal-case tracking-normal text-primary hover:text-primary"
                      onClick={() => onBulkAction(group === 'investments' ? 'dates' : 'balances')}
                    >
                      {group === 'investments' ? <><CalendarDays /> Correggi date</> : <><PencilLine /> {group === 'other' ? 'Aggiorna valori' : 'Aggiorna saldi'}</>}
                    </Button>
                  )}
                  <Money value={total} className="normal-case tracking-normal" />
                </div>
              </div>
              {/* Durante una ricerca i gruppi chiusi si riaprono, per non nascondere i risultati */}
              <ul id={`group-${group}`} className="divide-y" hidden={collapsed.includes(group) && !search}>
                {items.map(h => <HoldingRow key={h.asset.id} holding={h} onAction={onAction} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function HoldingRow({ holding: h, onAction }: { holding: Holding; onAction: HoldingsListProps['onAction'] }) {
  const { asset } = h;
  const meta = typeMeta(asset.type);
  const subtitle = [meta.isMarket ? asset.ticker : meta.label, asset.institution].filter(Boolean).join(' · ');
  const stale = isStale(asset);

  let detail: ReactNode = <span className="text-muted-foreground">—</span>;
  let detailSub: ReactNode = null;
  let performance: ReactNode = <span className="text-muted-foreground">—</span>;
  let performanceSub: ReactNode = null;

  if (meta.isMarket && h.quantity !== undefined) {
    detail = (
      <span className="tabular">
        {formatNumber(h.quantity)} × {h.price !== undefined ? <Money value={h.price} currency={asset.currency} /> : '—'}
      </span>
    );
    detailSub = <span>PMC <Money value={h.avgPrice ?? 0} currency={asset.currency} /></span>;
    performance = <Trend value={h.pl} showIcon={false} currency={asset.currency} />;
    performanceSub = <Trend pct={h.plPct} showIcon={false} />;
  } else if (h.deposit) {
    detail = <span>{asset.interestRate?.toLocaleString('it-IT')}% lordo</span>;
    detailSub = asset.maturityDate ? <span>scade il {format(parseISO(asset.maturityDate), 'dd/MM/yyyy')}</span> : <span>senza vincolo</span>;
    performance = <Money value={h.deposit.accruedNet} currency={asset.currency} signed className="text-positive" />;
    performanceSub = <span>interessi maturati</span>;
  } else {
    const history = sortBalances(asset.balanceHistory);
    const last = history[history.length - 1];
    if (last) {
      detail = <span className="text-muted-foreground">Saldo al {format(parseISO(last.date), 'dd/MM/yyyy')}</span>;
      // Entrate e uscite inserite dopo l'ultimo saldo registrato, già sommate al valore
      const after = (asset.cashMovements ?? []).filter(m => !coveringSnapshot(history, m)).length;
      if (after) detailSub = <span>+ {after === 1 ? '1 movimento successivo' : `${after} movimenti successivi`}</span>;
    }
    const change = h.group === 'other' ? manualChange(h) : null;
    if (change) {
      performance = <Trend value={change.change} showIcon={false} currency={asset.currency} />;
      performanceSub = <Trend pct={change.pct} showIcon={false} />;
    }
  }

  const mobileTrend = h.plPct !== undefined
    ? <Trend pct={h.plPct} className="text-xs" />
    : h.deposit
      ? <span className="text-xs text-positive"><Money value={h.deposit.accruedNet} currency={asset.currency} signed /> maturati</span>
      : <span className="text-xs text-muted-foreground">{formatPercent(h.weight, { signed: false, digits: 1 })}</span>;

  return (
    <li
      role="row"
      tabIndex={0}
      onClick={() => onAction('details', asset.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAction('details', asset.id);
        }
      }}
      className={cn('flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5', GRID)}
    >
      <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
        <AssetBadge type={asset.type} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium" title={asset.name}>
            <span className="truncate">{asset.name}</span>
            {stale && (
              <span className="inline-flex shrink-0 text-cat-4" title={`Prezzo non aggiornato${asset.lastUpdated ? ` (del ${format(parseISO(asset.lastUpdated), 'dd/MM HH:mm')})` : ''}`}>
                <Clock className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Prezzo non aggiornato</span>
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Mobile: valore e rendimento a destra */}
      <div className="flex flex-col items-end md:hidden">
        <Money value={h.value} currency={asset.currency} className="font-semibold" />
        {mobileTrend}
      </div>

      <div role="cell" className="hidden min-w-0 text-sm md:block">
        <div className="truncate">{detail}</div>
        {detailSub && <div className="truncate text-xs text-muted-foreground">{detailSub}</div>}
      </div>
      <div role="cell" className="hidden text-right text-sm md:block">
        {h.dayChangePct !== undefined ? (
          <>
            <Trend pct={h.dayChangePct} showIcon={false} />
            {h.dayChange !== undefined && <div className="text-xs"><Trend value={h.dayChange} showIcon={false} currency={asset.currency} className="font-normal" /></div>}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div role="cell" className="hidden text-right md:block">
        <Money value={h.value} currency={asset.currency} className="font-semibold" />
        {asset.currency !== 'EUR' && h.valueEur !== null && (
          <div className="text-xs text-muted-foreground"><Money value={h.valueEur} /></div>
        )}
      </div>
      <div role="cell" className="hidden text-right text-sm md:block">
        <div>{performance}</div>
        {performanceSub && <div className="text-xs text-muted-foreground">{performanceSub}</div>}
      </div>
      <div role="cell" className="hidden text-right text-sm tabular text-muted-foreground md:block">
        {formatPercent(h.weight, { signed: false, digits: 1 })}
      </div>
      <div role="cell" className="hidden md:block" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <RowMenu holding={h} onAction={onAction} />
      </div>
    </li>
  );
}

export function RowMenu({ holding: h, onAction }: { holding: Holding; onAction: HoldingsListProps['onAction'] }) {
  const isMarket = typeMeta(h.asset.type).isMarket;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Azioni per ${h.asset.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {isMarket ? (
          <DropdownMenuItem onSelect={() => onAction('transaction', h.asset.id)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Registra operazione
          </DropdownMenuItem>
        ) : (
          <>
            {h.asset.type === 'Conto Bancario' && (
              <DropdownMenuItem onSelect={() => onAction('cash', h.asset.id)}>
                <ArrowDownUp className="mr-2 h-4 w-4" /> Registra movimento
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onAction('balance', h.asset.id)}>
              <Wallet className="mr-2 h-4 w-4" /> {h.asset.type === 'Altro' ? 'Aggiorna valore' : 'Aggiorna saldo'}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => onAction('edit', h.asset.id)}>
          <Pencil className="mr-2 h-4 w-4" /> Modifica dettagli
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction('delete', h.asset.id)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
