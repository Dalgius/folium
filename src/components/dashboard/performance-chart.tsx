'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { LineChart } from 'lucide-react';
import type { Asset } from '@/types';
import type { FxRates, HistoryPoint } from '@/lib/portfolio';
import { periodReturn } from '@/lib/portfolio';
import { PERIODS, isIntradayPeriod, usePortfolioHistory, type Period } from '@/hooks/use-portfolio-history';
import { usePrivacy } from '@/hooks/use-privacy';
import { Money } from '@/components/money';
import { Trend } from '@/components/trend';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/segmented';
import { HINTS, InfoHint } from '@/components/info-hint';
import { formatCurrency } from '@/lib/utils';

type Mode = 'netWorth' | 'investments';

const MODES: { value: Mode; label: string }[] = [
  { value: 'netWorth', label: 'Patrimonio' },
  { value: 'investments', label: 'Investimenti' },
];

const STORAGE_KEY = 'folium:chart';

/** Periodo e serie scelti l'ultima volta (solo su questo browser). */
function loadPrefs(): { period?: Period; mode?: Mode } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      period: PERIODS.some(p => p.value === saved.period) ? saved.period : undefined,
      mode: MODES.some(m => m.value === saved.mode) ? saved.mode : undefined,
    };
  } catch {
    return {};
  }
}

function savePrefs(prefs: { period: Period; mode: Mode }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // archiviazione non disponibile (navigazione privata): si usano i valori predefiniti
  }
}

interface PerformanceChartProps {
  assets: Asset[];
  fx: FxRates;
  hasInvestments: boolean;
}

export function PerformanceChart({ assets, fx, hasInvestments }: PerformanceChartProps) {
  const [period, setPeriodState] = useState<Period>('1A');
  const [modeState, setModeState] = useState<Mode>('netWorth');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { hidden } = usePrivacy();
  const mode: Mode = hasInvestments ? modeState : 'netWorth';
  const { points, loading } = usePortfolioHistory(assets, fx, period);

  // Letto dopo il montaggio per non creare differenze con il rendering sul server
  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.period) setPeriodState(prefs.period);
    if (prefs.mode) setModeState(prefs.mode);
  }, []);
  const setPeriod = (value: Period) => {
    setPeriodState(value);
    savePrefs({ period: value, mode: modeState });
  };
  const setMode = (value: Mode) => {
    setModeState(value);
    savePrefs({ period, mode: value });
  };

  const data = useMemo(
    () => points.map(p => ({ ...p, value: mode === 'netWorth' ? p.netWorth : p.investments })),
    [points, mode],
  );

  const endIndex = hoverIndex ?? data.length - 1;
  const current = data[endIndex];
  const first = data[0];

  const change = useMemo(() => {
    if (!current || !first) return { gain: 0, pct: 0 };
    if (mode === 'investments') return periodReturn(data.slice(0, endIndex + 1));
    const gain = current.value - first.value;
    return { gain, pct: first.value > 0 ? gain / first.value : 0 };
  }, [data, endIndex, current, first, mode]);

  const intraday = isIntradayPeriod(period);
  const spanDays = data.length > 1 ? differenceInCalendarDays(parseISO(data[data.length - 1].date), parseISO(data[0].date)) : 0;
  const tickFormat = period === '1G'
    ? 'HH:mm'
    : period === '1S'
      ? 'EEE d'
      : spanDays > 400 ? 'MMM yy' : spanDays > 60 ? 'MMM' : 'd MMM';
  const pointFormat = intraday ? 'd MMM, HH:mm' : 'd MMM yyyy';
  // Sulla settimana un'etichetta per giorno: il primo orario di ciascun giorno
  const weekTicks = useMemo(() => {
    if (period !== '1S') return undefined;
    const seen = new Set<string>();
    return data.filter(p => {
      const day = format(parseISO(p.date), 'yyyy-MM-dd');
      if (seen.has(day)) return false;
      seen.add(day);
      return true;
    }).map(p => p.date);
  }, [data, period]);
  const isEmpty = !loading && (data.length < 2 || data.every(d => d.value === 0));

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          {hasInvestments ? (
            <Segmented options={MODES} value={mode} onChange={setMode} size="sm" ariaLabel="Serie del grafico" />
          ) : (
            <h2 className="text-sm font-medium text-muted-foreground">Andamento del patrimonio</h2>
          )}
          <div className="pt-2">
            {loading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              <>
                <Money value={current?.value ?? 0} className="text-3xl font-semibold tracking-tight" />
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                  <Trend value={change.gain} pct={change.pct} />
                  <span className="text-muted-foreground">
                    {hoverIndex !== null && current
                      ? `al ${format(parseISO(current.date), pointFormat, { locale: it })}`
                      : mode === 'investments'
                        ? (
                          <span className="inline-flex items-center gap-1">
                            rendimento nel periodo, al netto dei versamenti
                            <InfoHint text={HINTS.periodReturn} />
                          </span>
                        )
                        : period === '1G'
                          ? "nell'ultima seduta"
                          : 'nel periodo'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} size="sm" ariaLabel="Periodo" className="self-start" />
      </div>

      {mode === 'investments' && !isEmpty && (
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-primary" /> Valore di mercato
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Capitale investito
            <InfoHint text={HINTS.invested} />
          </span>
        </div>
      )}

      <div className="mt-4 min-h-[260px] w-full flex-1 sm:min-h-[300px]">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <LineChart className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Nessuno storico disponibile</p>
            <p className="text-xs text-muted-foreground">Il grafico apparirà quando ci saranno dati per il periodo scelto.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
              onMouseMove={(e) => setHoverIndex(typeof e?.activeTooltipIndex === 'number' ? e.activeTooltipIndex : null)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--chart-grid))" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                ticks={weekTicks}
                tickMargin={8}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(d: string) => format(parseISO(d), tickFormat, { locale: it })}
              />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={hidden ? 8 : 64}
                tickCount={5}
                domain={[(min: number) => Math.max(0, min - (min * 0.04)), 'auto']}
                tick={hidden ? false : { fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(v: number) => formatCurrency(v, 'EUR', { compact: true })}
              />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                content={<ChartTooltip mode={mode} intraday={intraday} />}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#fillValue)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                isAnimationActive={false}
              />
              {mode === 'investments' && (
                <Line
                  type="stepAfter"
                  dataKey="invested"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function ChartTooltip({ active, payload, mode, intraday }: { active?: boolean; payload?: { payload: HistoryPoint & { value: number } }[]; mode: Mode; intraday: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1.5 text-xs text-muted-foreground">{format(parseISO(p.date), intraday ? 'EEEE d MMMM, HH:mm' : 'EEEE d MMMM yyyy', { locale: it })}</p>
      {mode === 'netWorth' ? (
        <div className="space-y-1">
          <Row label="Patrimonio" value={<Money value={p.netWorth} className="font-semibold" />} />
          <Row label="Investimenti" value={<Money value={p.investments} />} />
          <Row label="Liquidità e altri beni" value={<Money value={p.cash} />} />
        </div>
      ) : (
        <div className="space-y-1">
          <Row label="Valore" value={<Money value={p.investments} className="font-semibold" />} />
          <Row label="Investito" value={<Money value={p.invested} />} />
          <Row label="Guadagno" value={<Trend value={p.investments - p.invested} showIcon={false} />} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
