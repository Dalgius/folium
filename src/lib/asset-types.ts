import type { AssetType } from '@/types';

export type AssetGroup = 'liquidity' | 'investments' | 'other';

export interface AssetTypeMeta {
  label: string;
  plural: string;
  group: AssetGroup;
  /** Il valore deriva da quotazioni di mercato (ticker + operazioni) */
  isMarket: boolean;
  /** Colore categoriale (CSS var definita in globals.css) */
  color: string;
}

// L'ordine definisce l'ordine di visualizzazione e l'assegnazione dei colori:
// il colore segue la categoria, non la posizione in classifica.
export const ASSET_TYPES: AssetType[] = [
  'Conto Bancario',
  'Conto Deposito',
  'ETF',
  'Azione',
  'Fondo',
  'Crypto',
  'Altro',
];

export const ASSET_TYPE_META: Record<AssetType, AssetTypeMeta> = {
  'Conto Bancario': { label: 'Conto corrente', plural: 'Conti correnti', group: 'liquidity', isMarket: false, color: 'hsl(var(--cat-3))' },
  'Conto Deposito': { label: 'Conto deposito', plural: 'Conti deposito', group: 'liquidity', isMarket: false, color: 'hsl(var(--cat-4))' },
  ETF: { label: 'ETF', plural: 'ETF', group: 'investments', isMarket: true, color: 'hsl(var(--cat-1))' },
  Azione: { label: 'Azione', plural: 'Azioni', group: 'investments', isMarket: true, color: 'hsl(var(--cat-2))' },
  Fondo: { label: 'Fondo', plural: 'Fondi', group: 'investments', isMarket: true, color: 'hsl(var(--cat-5))' },
  Crypto: { label: 'Crypto', plural: 'Crypto', group: 'investments', isMarket: true, color: 'hsl(var(--cat-7))' },
  Altro: { label: 'Altro', plural: 'Altri beni', group: 'other', isMarket: false, color: 'hsl(var(--cat-6))' },
};

export const GROUP_LABEL: Record<AssetGroup, string> = {
  liquidity: 'Liquidità',
  investments: 'Investimenti',
  other: 'Altri beni',
};

export const isMarketAsset = (type: AssetType) => ASSET_TYPE_META[type]?.isMarket ?? false;

export const typeMeta = (type: AssetType): AssetTypeMeta =>
  ASSET_TYPE_META[type] ?? ASSET_TYPE_META.Altro;

/** Mappa il quoteType di Yahoo Finance su un tipo di asset. */
export function assetTypeFromQuoteType(quoteType: string): AssetType {
  switch (quoteType) {
    case 'ETF':
      return 'ETF';
    case 'MUTUALFUND':
      return 'Fondo';
    case 'CRYPTOCURRENCY':
      return 'Crypto';
    default:
      return 'Azione';
  }
}
