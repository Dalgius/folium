'use client';

import type { ComponentType } from 'react';
import {
  type LucideProps,
  Landmark,
  PiggyBank,
  Layers,
  CandlestickChart,
  Briefcase,
  Bitcoin,
  Gem,
} from 'lucide-react';
import type { AssetType } from '@/types';
import { typeMeta } from '@/lib/asset-types';
import { cn } from '@/lib/utils';

const ICONS: Record<AssetType, ComponentType<LucideProps>> = {
  'Conto Bancario': Landmark,
  'Conto Deposito': PiggyBank,
  ETF: Layers,
  Azione: CandlestickChart,
  Fondo: Briefcase,
  Crypto: Bitcoin,
  Altro: Gem,
};

export function AssetIcon({ type, ...props }: LucideProps & { type: AssetType }) {
  const Icon = ICONS[type] ?? Gem;
  return <Icon {...props} />;
}

/** Icona dell'asset su sfondo tinto con il colore della sua categoria. */
export function AssetBadge({ type, className, size = 'md' }: { type: AssetType; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = typeMeta(type).color;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg',
        size === 'sm' && 'h-7 w-7',
        size === 'md' && 'h-9 w-9',
        size === 'lg' && 'h-11 w-11 rounded-xl',
        className,
      )}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      aria-hidden
    >
      <AssetIcon type={type} className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2} />
    </span>
  );
}

export function CategoryDot({ type, className }: { type: AssetType; className?: string }) {
  return <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: typeMeta(type).color }} aria-hidden />;
}
