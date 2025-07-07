export type AssetType = 'Stock' | 'ETF' | 'Bank Account';

export const assetTypes: AssetType[] = ['Stock', 'ETF', 'Bank Account'];

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  initialValue: number;
  currentValue: number;
}
