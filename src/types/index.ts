export type AssetType = 'Azione' | 'ETF' | 'Conto Bancario';

export const assetTypes: AssetType[] = ['Azione', 'ETF', 'Conto Bancario'];

export interface Asset {
  id: string;
  name: string;
  ticker?: string;
  type: AssetType;
  initialValue: number;
  currentValue: number;
  quantity?: number;
  purchasePrice?: number;
  purchaseDate?: string;
}
