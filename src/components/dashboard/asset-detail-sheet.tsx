'use client';

import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { ArrowLeftRight, ArrowDownUp, Pencil, RotateCcw, Trash2, Wallet, X } from 'lucide-react';
import type { Holding } from '@/lib/portfolio';
import { accountLedger, isStale, sortBalances, sortTransactions } from '@/lib/portfolio';
import type { Asset } from '@/types';
import { typeMeta } from '@/lib/asset-types';
import { assetClassOf, classMeta } from '@/lib/asset-classes';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AssetBadge } from '@/components/asset-icons';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { HINTS, InfoHint } from '@/components/info-hint';
import { cn, formatNumber, formatPercent, trendClass } from '@/lib/utils';
import type { HoldingAction } from '@/components/dashboard/holdings-list';

interface AssetDetailSheetProps {
  holding: Holding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: HoldingAction, assetId: string) => void;
  onEditTransaction: (assetId: string, txId: string) => void;
  onDeleteTransaction: (assetId: string, txId: string) => Promise<boolean>;
  onDeleteBalance: (assetId: string, date: string) => Promise<boolean>;
  onEditCashMovement: (assetId: string, movementId: string) => void;
  onDeleteCashMovement: (assetId: string, movementId: string) => Promise<boolean>;
  /** "oggi" o "ultima seduta" */
  dayLabel?: string;
}

const fmtDate = (d: string, pattern = 'd MMM yyyy') => format(parseISO(d), pattern, { locale: it });

function Metric({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-muted/50 p-3', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}

export function AssetDetailSheet({
  holding,
  open,
  onOpenChange,
  onAction,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteBalance,
  onEditCashMovement,
  onDeleteCashMovement,
  dayLabel = 'oggi',
}: AssetDetailSheetProps) {
  if (!holding) return null;
  const { asset } = holding;
  const meta = typeMeta(asset.type);
  const transactions = sortTransactions(asset.transactions ?? []).reverse();
  const balances = sortBalances(asset.balanceHistory).reverse();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="space-y-3 border-b p-5 text-left">
          <div className="flex items-center gap-3 pr-6">
            <AssetBadge type={asset.type} size="lg" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{asset.name}</SheetTitle>
              <SheetDescription className="truncate">
                {[
                  meta.label,
                  // Per ETF e fondi il tipo non dice cosa contengono: si aggiunge la classe
                  asset.type === 'ETF' || asset.type === 'Fondo' ? classMeta(assetClassOf(asset)).label.toLowerCase() : null,
                  asset.ticker,
                  asset.institution,
                ].filter(Boolean).join(' · ')}
              </SheetDescription>
            </div>
          </div>
          <div>
            <Money value={holding.value} currency={asset.currency} className="text-3xl font-semibold tracking-tight" />
            {asset.currency !== 'EUR' && holding.valueEur !== null && (
              <p className="text-sm text-muted-foreground">≈ <Money value={holding.valueEur} /></p>
            )}
            {holding.pl !== undefined && (
              <p className="mt-1 text-sm"><Trend value={holding.pl} pct={holding.plPct} currency={asset.currency} /> <span className="text-muted-foreground">dall&apos;acquisto</span></p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {meta.isMarket ? (
              <Button size="sm" onClick={() => onAction('transaction', asset.id)}><ArrowLeftRight /> Registra operazione</Button>
            ) : (
              <>
                {asset.type === 'Conto Bancario' && (
                  <Button size="sm" onClick={() => onAction('cash', asset.id)}><ArrowDownUp /> Movimento</Button>
                )}
                <Button size="sm" variant={asset.type === 'Conto Bancario' ? 'outline' : 'default'} onClick={() => onAction('balance', asset.id)}>
                  <Wallet /> {asset.type === 'Altro' ? 'Aggiorna valore' : asset.type === 'Conto Bancario' ? 'Allinea saldo' : 'Aggiorna saldo'}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => onAction('edit', asset.id)}><Pencil /> Modifica</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onAction('delete', asset.id)}><Trash2 /> Elimina</Button>
          </div>
        </SheetHeader>

        <div className="space-y-6 p-5">
          {meta.isMarket && (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Quantità">{formatNumber(holding.quantity ?? 0)}</Metric>
              <Metric label="Peso sul patrimonio"><span className="tabular">{formatPercent(holding.weight, { signed: false, digits: 1 })}</span></Metric>
              <Metric label="Prezzo attuale">
                {holding.price !== undefined ? <Money value={holding.price} currency={asset.currency} /> : '—'}
                {asset.lastUpdated && (
                  <p className={cn('text-xs font-normal', isStale(asset) ? 'text-cat-4' : 'text-muted-foreground')}>
                    {isStale(asset) ? 'non aggiornato, ' : ''}del {fmtDate(asset.lastUpdated, 'd MMM, HH:mm')}
                  </p>
                )}
              </Metric>
              <Metric label="Prezzo medio di carico"><Money value={holding.avgPrice ?? 0} currency={asset.currency} /></Metric>
              <Metric label="Investito"><Money value={holding.costBasis ?? 0} currency={asset.currency} /></Metric>
              <Metric label={dayLabel === 'oggi' ? 'Oggi' : 'Ultima seduta'}>{holding.dayChangePct !== undefined ? <Trend pct={holding.dayChangePct} /> : '—'}</Metric>
              {Math.abs(holding.realized ?? 0) > 0.005 && (
                <Metric label="Plus/minus realizzate" className="col-span-2"><Trend value={holding.realized} currency={asset.currency} /></Metric>
              )}
            </div>
          )}

          {holding.deposit && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Tasso lordo</p><p className="font-medium">{asset.interestRate?.toLocaleString('it-IT')}%</p></div>
                <div><p className="text-xs text-muted-foreground">Ritenuta</p><p className="font-medium">{(asset.taxRate ?? 26).toLocaleString('it-IT')}%</p></div>
                {asset.startDate && <div><p className="text-xs text-muted-foreground">Apertura</p><p className="font-medium">{fmtDate(asset.startDate)}</p></div>}
                <div><p className="text-xs text-muted-foreground">Scadenza</p><p className="font-medium">{asset.maturityDate ? fmtDate(asset.maturityDate) : 'Libero'}</p></div>
              </div>
              {holding.deposit.progress !== null && <Progress value={holding.deposit.progress * 100} className="h-1.5" aria-label="Avanzamento del vincolo" />}
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">Interessi netti maturati <InfoHint text={HINTS.accrued} /></span>
                <Money value={holding.deposit.accruedNet} currency={asset.currency} signed className="font-medium text-positive" />
              </div>
              {holding.deposit.atMaturityNet !== null && (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Interessi netti a scadenza</span>
                  <Money value={holding.deposit.atMaturityNet} currency={asset.currency} signed className="font-medium" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Stima con capitalizzazione semplice; non include l&apos;imposta di bollo (0,20% annuo).</p>
            </div>
          )}

          {asset.notes && <p className="rounded-lg bg-muted/50 p-3 text-sm">{asset.notes}</p>}

          {meta.isMarket ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Operazioni</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna operazione registrata.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {transactions.map(tx => (
                    <li key={tx.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <Badge variant={tx.type === 'buy' ? 'secondary' : 'outline'} className="w-[72px] justify-center">
                        {tx.type === 'buy' ? 'Acquisto' : 'Vendita'}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="tabular">{formatNumber(tx.quantity)} × <Money value={tx.price} currency={asset.currency} /></p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(tx.date)}{tx.fees ? <> · comm. <Money value={tx.fees} currency={asset.currency} /></> : null}
                        </p>
                      </div>
                      <Money value={tx.quantity * tx.price} currency={asset.currency} className="font-medium" />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Modifica operazione"
                        onClick={() => onEditTransaction(asset.id, tx.id)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Elimina operazione"
                        onClick={() => onDeleteTransaction(asset.id, tx.id)}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : asset.type === 'Conto Bancario' ? (
            <LedgerSection
              asset={asset}
              onRestart={() => onAction('restart', asset.id)}
              onEdit={id => onEditCashMovement(asset.id, id)}
              onDelete={id => onDeleteCashMovement(asset.id, id)}
            />
          ) : (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Storico</h3>
              {balances.length > 1 && <BalanceSparkline points={[...balances].reverse()} currency={asset.currency} />}
              <ul className="divide-y rounded-lg border">
                {balances.map(b => (
                  <li key={b.date} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="flex-1 text-muted-foreground">{fmtDate(b.date, 'd MMMM yyyy')}</span>
                    <Money value={b.value} currency={asset.currency} className="font-medium" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Elimina saldo"
                      disabled={balances.length <= 1}
                      onClick={() => onDeleteBalance(asset.id, b.date)}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const LEDGER_LABEL = { opening: 'Saldo iniziale', snapshot: 'Saldo registrato', adjustment: 'Allineamento', movement: '' } as const;

/** Libro del conto corrente: ogni riga con il saldo dopo il movimento. */
function LedgerSection({ asset, onRestart, onEdit, onDelete }: { asset: Asset; onRestart: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const entries = accountLedger(asset).reverse();
  const legacySnapshots = (asset.balanceHistory?.length ?? 0) > 1;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Movimenti</h3>
        <Button variant="ghost" size="sm" className="-mr-2 h-8 text-xs text-muted-foreground" onClick={onRestart}>
          <RotateCcw /> Ricomincia dai movimenti
        </Button>
      </div>
      {legacySnapshots && (
        <div className="mb-3 rounded-lg border border-cat-4/40 bg-cat-4/10 p-3 text-sm">
          <p>Questo conto ha ancora i saldi registrati mese per mese. Per avere il saldo come somma dei movimenti, imposta un saldo iniziale e registra entrate e uscite da quella data.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onRestart}><RotateCcw /> Ricomincia dai movimenti</Button>
        </div>
      )}
      <ul className="divide-y rounded-lg border">
        {entries.map(e => {
          const label = e.kind === 'movement' ? e.description || (e.amount >= 0 ? 'Entrata' : 'Uscita') : LEDGER_LABEL[e.kind];
          return (
            <li key={e.key} className={cn('flex items-center gap-3 px-3 py-2.5 text-sm', e.excluded && 'opacity-60', e.kind === 'opening' && 'bg-muted/40')}>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate', e.kind !== 'movement' && 'font-medium')}>{label}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(e.date)}
                  {e.excluded && ' · prima del saldo iniziale, non conteggiato'}
                </p>
              </div>
              <div className="text-right">
                {e.kind === 'opening' ? (
                  <Money value={e.amount} currency={asset.currency} className="font-medium" />
                ) : (
                  <Money value={e.amount} currency={asset.currency} signed className={cn('font-medium', trendClass(e.amount))} />
                )}
                {e.balance !== null && e.kind !== 'opening' && (
                  <p className="text-xs text-muted-foreground">saldo <Money value={e.balance} currency={asset.currency} /></p>
                )}
              </div>
              {e.movementId ? (
                <>
                  <Button variant="ghost" size="icon-sm" aria-label="Modifica movimento" onClick={() => onEdit(e.movementId!)}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Elimina movimento" onClick={() => onDelete(e.movementId!)}>
                    <X />
                  </Button>
                </>
              ) : (
                <span className="w-[88px] sm:w-[72px]" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {entries.length <= 1 && (
        <p className="mt-2 text-sm text-muted-foreground">Registra entrate e uscite con «Movimento»: il saldo è il saldo iniziale più la loro somma.</p>
      )}
    </section>
  );
}

function BalanceSparkline({ points, currency }: { points: { date: string; value: number }[]; currency: string }) {
  return (
    <div className="mb-3 h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow">
                  <p className="text-muted-foreground">{fmtDate(payload[0].payload.date)}</p>
                  <Money value={payload[0].payload.value} currency={currency} className="font-medium" />
                </div>
              ) : null
            }
          />
          <Area type="stepAfter" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#fillBalance)" isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
