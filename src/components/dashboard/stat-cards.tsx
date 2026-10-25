'use client';

import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import type { PortfolioSummary } from '@/lib/portfolio';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HINTS, InfoHint } from '@/components/info-hint';
import { cn, formatPercent } from '@/lib/utils';

function StatCard({ label, children, footer, className }: { label: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col justify-between gap-3 p-5', className)}>
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-2xl font-semibold tracking-tight">{children}</div>
      </div>
      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </Card>
  );
}

/** Indicatore compatto della fila scorrevole su smartphone. */
function KpiChip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div role="listitem" className="min-w-[46%] shrink-0 snap-start rounded-xl bg-accent/70 p-3 dark:bg-muted">
      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

interface StatCardsProps {
  summary: PortfolioSummary;
  loading: boolean;
  /** "oggi" se i prezzi sono della giornata, altrimenti "ultima seduta" */
  dayLabel?: string;
}

export function StatCards({ summary, loading, dayLabel = 'oggi' }: StatCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  const { netWorth, liquidity, investments, other, investedCost, unrealizedPL, unrealizedPLPct, realizedPL, dayChange, dayChangePct, hasDayChange, accruedInterestNet, lockedLiquidity, nextUnlock, missingFx } = summary;
  const share = (v: number) => (netWorth > 0 ? formatPercent(v / netWorth, { signed: false, digits: 0 }) : '—');
  const previousNetWorth = netWorth - dayChange;

  const netDayPct = previousNetWorth > 0 ? dayChange / previousNetWorth : 0;

  return (
    <div className="space-y-3">
      {/* Smartphone: patrimonio in evidenza e indicatori in una fila scorrevole */}
      <Card className="p-4 sm:hidden">
        <p className="text-sm font-medium text-muted-foreground">Patrimonio netto</p>
        <Money value={netWorth} className="mt-1 block text-[28px] font-bold leading-9 tracking-tight" />
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {hasDayChange ? (
            <>
              <Trend value={dayChange} pct={netDayPct} />
              <span>{dayLabel}</span>
            </>
          ) : (
            <span>Conti e investimenti</span>
          )}
        </p>
        <div className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1" role="list" aria-label="Indicatori">
          <KpiChip label="Liquidità">
            <Money value={liquidity} className="text-lg font-semibold" />
            <span className="block text-xs text-muted-foreground">
              {lockedLiquidity > 0 ? <>disp. <Money value={liquidity - lockedLiquidity} /></> : `${share(liquidity)} del patrimonio`}
            </span>
          </KpiChip>
          <KpiChip label="Investimenti">
            <Money value={investments} className="text-lg font-semibold" />
            <span className="block text-xs">
              {hasDayChange ? <Trend pct={dayChangePct} showIcon={false} /> : <span className="text-muted-foreground">{share(investments)} del patrimonio</span>}
              {hasDayChange && <span className="text-muted-foreground"> {dayLabel}</span>}
            </span>
          </KpiChip>
          <KpiChip label={<>Plusvalenze latenti <InfoHint text={HINTS.unrealized} /></>}>
            <Trend pct={unrealizedPLPct} className="text-lg font-semibold" />
            <span className="block text-xs text-muted-foreground">su <Money value={investedCost} /> investiti</span>
          </KpiChip>
          {lockedLiquidity > 0 && (
            <KpiChip label={<>Liquidità vincolata <InfoHint text={HINTS.locked} /></>}>
              <Money value={lockedLiquidity} className="text-lg font-semibold" />
              <span className="block text-xs text-muted-foreground">
                {nextUnlock ? `fino al ${format(parseISO(nextUnlock), 'dd/MM/yyyy')}` : 'nei conti deposito'}
              </span>
            </KpiChip>
          )}
        </div>
      </Card>

      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Patrimonio netto"
          className="border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent"
          footer={
            hasDayChange ? (
              <span className="flex flex-wrap items-center gap-x-1.5">
                <Trend value={dayChange} pct={netDayPct} />
                <span>{dayLabel}</span>
              </span>
            ) : other > 0 ? (
              <span>di cui altri beni <Money value={other} /></span>
            ) : (
              <span>Conti e investimenti</span>
            )
          }
        >
          <Money value={netWorth} className="text-3xl" />
        </StatCard>

        <StatCard
          label="Liquidità"
          footer={
            <>
              {lockedLiquidity > 0 ? (
                <>
                  <p>disponibile <Money value={liquidity - lockedLiquidity} /></p>
                  <p className="flex flex-wrap items-center gap-x-1">
                    vincolata <Money value={lockedLiquidity} />
                    <InfoHint text={HINTS.locked} />
                    {nextUnlock && <span>fino al {format(parseISO(nextUnlock), 'dd/MM/yyyy')}</span>}
                  </p>
                </>
              ) : (
                <p>{share(liquidity)} del patrimonio</p>
              )}
              {accruedInterestNet > 0 && (
                <p className="flex flex-wrap items-center gap-x-1">
                  interessi maturati <Money value={accruedInterestNet} className="text-positive" signed />
                  <InfoHint text={HINTS.accrued} />
                </p>
              )}
            </>
          }
        >
          <Money value={liquidity} />
        </StatCard>

        <StatCard
          label="Investimenti"
          footer={
            hasDayChange ? (
              <span className="flex flex-wrap items-center gap-x-1.5">
                <Trend value={dayChange} pct={dayChangePct} />
                <span>{dayLabel}</span>
              </span>
            ) : (
              <span>{share(investments)} del patrimonio</span>
            )
          }
        >
          <Money value={investments} />
        </StatCard>

        <StatCard
          label={<>Plus/minusvalenze latenti <InfoHint text={HINTS.unrealized} /></>}
          footer={
            <>
              <p>su <Money value={investedCost} /> investiti</p>
              {Math.abs(realizedPL) > 0.005 && (
                <p className="flex flex-wrap items-center gap-x-1">
                  realizzate <Money value={realizedPL} signed /> <InfoHint text={HINTS.realized} />
                </p>
              )}
            </>
          }
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            <Trend value={unrealizedPL} showIcon={false} className="font-semibold" />
            <Trend pct={unrealizedPLPct} className="text-sm" />
          </span>
        </StatCard>
      </div>

      {missingFx.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-cat-4" />
          Tasso di cambio non disponibile per {missingFx.join(', ')}: questi asset sono esclusi dai totali.
        </p>
      )}
    </div>
  );
}
