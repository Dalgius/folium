'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Money } from '@/components/money';
import { cn, formatPercent, trendClass } from '@/lib/utils';

interface TrendProps {
  /** Variazione assoluta */
  value?: number | null;
  /** Variazione percentuale decimale */
  pct?: number | null;
  currency?: string;
  className?: string;
  showIcon?: boolean;
}

/** Variazione con segno, freccia e colore (mai solo colore). */
export function Trend({ value, pct, currency = 'EUR', className, showIcon = true }: TrendProps) {
  const ref = value ?? pct ?? 0;
  const Icon = Math.abs(ref) < 1e-9 ? Minus : ref > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium tabular', trendClass(ref), className)}>
      {showIcon && <Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />}
      {value != null && <Money value={value} currency={currency} signed />}
      {pct != null && (value != null ? <span className="opacity-90">({formatPercent(pct)})</span> : <span>{formatPercent(pct)}</span>)}
    </span>
  );
}
