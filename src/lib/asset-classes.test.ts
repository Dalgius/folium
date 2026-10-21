import { describe, expect, it } from 'vitest';
import type { AssetType } from '@/types';
import { assetClassOf, inferAssetClass } from './asset-classes';

const etf = (name: string, type: AssetType = 'ETF') => ({ name, type });

describe('inferAssetClass', () => {
  it('riconosce obbligazionari, materie prime, monetari e immobiliari dal nome', () => {
    expect(inferAssetClass(etf('Vanguard Global Aggregate Bond UCITS ETF EUR Hedged Acc'))).toBe('obbligazionario');
    expect(inferAssetClass(etf('ISHARES CORE EUR GOVT BOND'))).toBe('obbligazionario');
    expect(inferAssetClass(etf('iShares Core € Corp Bond UCITS ETF'))).toBe('obbligazionario');
    expect(inferAssetClass(etf('VANGUARD GLB AGGR BD'))).toBe('obbligazionario');
    expect(inferAssetClass(etf('Invesco Physical Gold A'))).toBe('materie-prime');
    expect(inferAssetClass(etf('WisdomTree Physical Silver'))).toBe('materie-prime');
    expect(inferAssetClass(etf('Xtrackers II EUR Overnight Rate Swap UCITS ETF'))).toBe('liquidita');
    expect(inferAssetClass(etf('Xtrackers FTSE Developed Europe Real Estate'))).toBe('immobiliare');
    expect(inferAssetClass(etf('Eurizon Obbligazionario Euro', 'Fondo'))).toBe('obbligazionario');
  });

  it('considera azionari gli altri ETF e usa il tipo per gli altri asset', () => {
    expect(inferAssetClass(etf('Vanguard FTSE All-World UCITS ETF (Acc)'))).toBe('azionario');
    expect(inferAssetClass(etf('iShares Core MSCI EM IMI UCITS ETF'))).toBe('azionario');
    expect(inferAssetClass(etf('Barrick Gold Corp', 'Azione'))).toBe('azionario');
    expect(inferAssetClass(etf('Bitcoin EUR', 'Crypto'))).toBe('crypto');
    expect(inferAssetClass(etf('Conto Fineco', 'Conto Bancario'))).toBe('liquidita');
    expect(inferAssetClass(etf('Deposito', 'Conto Deposito'))).toBe('liquidita');
    expect(inferAssetClass(etf('Fondo pensione', 'Altro'))).toBe('altro');
  });

  it('la scelta manuale prevale', () => {
    expect(assetClassOf({ ...etf('Vanguard LifeStrategy 60% Equity'), assetClass: 'obbligazionario' })).toBe('obbligazionario');
  });
});
