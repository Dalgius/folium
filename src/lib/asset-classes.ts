import type { Asset, AssetClass } from '@/types';

export interface AssetClassMeta {
  label: string;
  /** Colore categoriale: stessa palette delle categorie, in ordine fisso */
  color: string;
}

// L'ordine definisce l'ordine di visualizzazione e l'assegnazione dei colori
export const ASSET_CLASSES: AssetClass[] = ['azionario', 'obbligazionario', 'liquidita', 'materie-prime', 'immobiliare', 'altro', 'crypto'];

export const ASSET_CLASS_META: Record<AssetClass, AssetClassMeta> = {
  azionario: { label: 'Azionario', color: 'hsl(var(--cat-1))' },
  obbligazionario: { label: 'Obbligazionario', color: 'hsl(var(--cat-2))' },
  liquidita: { label: 'Liquidità', color: 'hsl(var(--cat-3))' },
  'materie-prime': { label: 'Materie prime', color: 'hsl(var(--cat-4))' },
  immobiliare: { label: 'Immobiliare', color: 'hsl(var(--cat-5))' },
  altro: { label: 'Altri beni', color: 'hsl(var(--cat-6))' },
  crypto: { label: 'Crypto', color: 'hsl(var(--cat-7))' },
};

export const classMeta = (c: AssetClass): AssetClassMeta => ASSET_CLASS_META[c] ?? ASSET_CLASS_META.altro;

// Parole chiave nei nomi di ETF e fondi (Yahoo e Directa, anche abbreviati)
const RULES: [AssetClass, RegExp][] = [
  ['materie-prime', /\b(gold|oro|silver|argento|platinum|platino|palladium|palladio|commodit\w*|physical|precious|metals?|oil|petrolio|brent|wti)\b/i],
  ['liquidita', /\b(money market|monetari\w*|overnight|estr|ultra ?short)\b/i],
  ['obbligazionario', /\b(bonds?|bd|obblig\w*|govt?|government|govies|treasur\w*|gilts?|aggregate|aggr?|btp|bund|t-?bills?|fixed income|high yield|sovereign|tips|inflation[- ]linked|corporate)\b/i],
  ['immobiliare', /\b(real estate|reits?|property|properties|immobil\w*|epra)\b/i],
];

/** Classe proposta in automatico dal tipo e dal nome dello strumento. */
export function inferAssetClass(asset: Pick<Asset, 'type' | 'name'>): AssetClass {
  switch (asset.type) {
    case 'Conto Bancario':
    case 'Conto Deposito':
      return 'liquidita';
    case 'Altro':
      return 'altro';
    case 'Crypto':
      return 'crypto';
    case 'Azione':
      return 'azionario';
  }
  return RULES.find(([, re]) => re.test(asset.name))?.[0] ?? 'azionario';
}

/** Classe effettiva: quella scelta dall'utente, altrimenti quella automatica. */
export const assetClassOf = (asset: Pick<Asset, 'type' | 'name' | 'assetClass'>): AssetClass =>
  asset.assetClass ?? inferAssetClass(asset);
