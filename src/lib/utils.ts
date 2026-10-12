import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Currency } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LOCALE = 'it-IT';
const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(key: string, options: Intl.NumberFormatOptions) {
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, options);
    formatterCache.set(key, f);
  }
  return f;
}

/** Importo in valuta, sempre in formato italiano (1.234,56 €). */
export function formatCurrency(amount: number, currency: Currency = 'EUR', options: { signed?: boolean; compact?: boolean } = {}) {
  const { signed = false, compact = false } = options;
  try {
    return formatter(`cur-${currency}-${signed}-${compact}`, {
      style: 'currency',
      currency,
      signDisplay: signed ? 'exceptZero' : 'auto',
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Percentuale da valore decimale (0.025 → +2,50%). */
export function formatPercent(value: number, options: { signed?: boolean; digits?: number } = {}) {
  const { signed = true, digits = 2 } = options;
  return formatter(`pct-${signed}-${digits}`, {
    style: 'percent',
    signDisplay: signed ? 'exceptZero' : 'auto',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Numero con fino a `maxDigits` decimali (quantità, prezzi). */
export function formatNumber(value: number, maxDigits = 4) {
  return formatter(`num-${maxDigits}`, { maximumFractionDigits: maxDigits }).format(value);
}

/** Classe di colore per valori positivi/negativi. */
export function trendClass(value: number | null | undefined) {
  if (value == null || Math.abs(value) < 1e-9) return 'text-muted-foreground';
  return value > 0 ? 'text-positive' : 'text-negative';
}
