'use client';

import { usePrivacy } from '@/hooks/use-privacy';
import { cn, formatCurrency } from '@/lib/utils';

interface MoneyProps {
  value: number;
  currency?: string;
  signed?: boolean;
  compact?: boolean;
  className?: string;
}

/** Importo formattato che rispetta la modalità privacy. */
export function Money({ value, currency = 'EUR', signed, compact, className }: MoneyProps) {
  const { hidden } = usePrivacy();
  return (
    <span className={cn('tabular whitespace-nowrap', className)}>
      {hidden ? '•••••' : formatCurrency(value, currency, { signed, compact })}
    </span>
  );
}
