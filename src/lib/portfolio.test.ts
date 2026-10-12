import { describe, expect, it } from 'vitest';
import type { Asset } from '@/types';
import {
  balanceAt,
  buildHistory,
  buildHoldings,
  computePosition,
  depositInterest,
  periodReturn,
  summarize,
  upsertBalance,
} from './portfolio';

const etf = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'etf',
  name: 'Vanguard FTSE All-World',
  type: 'ETF',
  ticker: 'VWCE.DE',
  currency: 'EUR',
  initialValue: 0,
  currentValue: 0,
  transactions: [
    { id: '1', type: 'buy', date: '2024-01-10', quantity: 10, price: 100 },
    { id: '2', type: 'buy', date: '2024-02-10', quantity: 10, price: 120, fees: 2 },
  ],
  lastPrice: 130,
  dailyChange: 1,
  dailyChangePercent: 1 / 129,
  ...overrides,
});

describe('computePosition', () => {
  it('calcola quantità e prezzo medio con le commissioni', () => {
    const p = computePosition(etf().transactions);
    expect(p.quantity).toBe(20);
    expect(p.costBasis).toBe(2202);
    expect(p.avgPrice).toBeCloseTo(110.1);
    expect(p.netInvested).toBe(2202);
    expect(p.firstDate).toBe('2024-01-10');
  });

  it('applica il costo medio alle vendite e registra il realizzato', () => {
    const p = computePosition([
      { id: '1', type: 'buy', date: '2024-01-01', quantity: 10, price: 100 },
      { id: '2', type: 'sell', date: '2024-03-01', quantity: 4, price: 150 },
    ]);
    expect(p.quantity).toBe(6);
    expect(p.costBasis).toBe(600);
    expect(p.realized).toBe(200);
    expect(p.netInvested).toBe(400);
  });

  it('ordina le operazioni per data e rispetta il limite temporale', () => {
    const p = computePosition(
      [
        { id: '2', type: 'buy', date: '2024-05-01', quantity: 5, price: 10 },
        { id: '1', type: 'buy', date: '2024-01-01', quantity: 5, price: 20 },
      ],
      '2024-02-01',
    );
    expect(p.quantity).toBe(5);
    expect(p.avgPrice).toBe(20);
  });

  it('azzera la posizione dopo una vendita totale', () => {
    const p = computePosition([
      { id: '1', type: 'buy', date: '2024-01-01', quantity: 3, price: 10 },
      { id: '2', type: 'sell', date: '2024-02-01', quantity: 3, price: 12 },
    ]);
    expect(p.quantity).toBe(0);
    expect(p.costBasis).toBe(0);
    expect(p.realized).toBe(6);
  });
});

describe('saldi', () => {
  const history = [
    { date: '2024-01-01', value: 1000 },
    { date: '2024-03-01', value: 1500 },
  ];

  it('restituisce il saldo valido in una data', () => {
    expect(balanceAt(history, '2023-12-01')).toBe(1000);
    expect(balanceAt(history, '2024-02-15')).toBe(1000);
    expect(balanceAt(history, '2024-03-01')).toBe(1500);
  });

  it('sostituisce il saldo dello stesso giorno', () => {
    const next = upsertBalance(history, { date: '2024-03-01', value: 1600 });
    expect(next).toHaveLength(2);
    expect(next[1].value).toBe(1600);
  });
});

describe('depositInterest', () => {
  it('stima gli interessi netti maturati e a scadenza', () => {
    const deposit: Asset = {
      id: 'dep',
      name: 'Deposito 12 mesi',
      type: 'Conto Deposito',
      currency: 'EUR',
      initialValue: 10000,
      currentValue: 10000,
      balanceHistory: [{ date: '2024-01-01', value: 10000 }],
      interestRate: 4,
      startDate: '2024-01-01',
      maturityDate: '2025-01-01',
    };
    const result = depositInterest(deposit, new Date(2024, 6, 1))!;
    expect(result.accruedGross).toBeCloseTo(10000 * 0.04 * (182 / 365));
    expect(result.accruedNet).toBeCloseTo(result.accruedGross * 0.74);
    expect(result.atMaturityNet).toBeCloseTo(10000 * 0.04 * (366 / 365) * 0.74);
    expect(result.matured).toBe(false);
  });
});

describe('buildHoldings / summarize', () => {
  it('aggrega patrimonio, liquidità e plusvalenze in EUR', () => {
    const assets: Asset[] = [
      etf(),
      {
        id: 'usd',
        name: 'Apple',
        type: 'Azione',
        ticker: 'AAPL',
        currency: 'USD',
        initialValue: 0,
        currentValue: 0,
        transactions: [{ id: '1', type: 'buy', date: '2024-01-01', quantity: 10, price: 100 }],
        lastPrice: 110,
      },
      {
        id: 'cc',
        name: 'Conto corrente',
        type: 'Conto Bancario',
        currency: 'EUR',
        initialValue: 5000,
        currentValue: 5000,
      },
    ];
    const holdings = buildHoldings(assets, { USD: 0.9 });
    const summary = summarize(holdings);
    expect(summary.investments).toBeCloseTo(2600 + 990);
    expect(summary.liquidity).toBe(5000);
    expect(summary.netWorth).toBeCloseTo(8590);
    expect(summary.investedCost).toBeCloseTo(2202 + 900);
    expect(summary.dayChange).toBeCloseTo(20);
    expect(summary.allocation[0].type).toBe('Conto Bancario');
    expect(holdings.reduce((s, h) => s + h.weight, 0)).toBeCloseTo(1);
  });

  it('esclude dai totali gli asset senza tasso di cambio', () => {
    const summary = summarize(
      buildHoldings([{ ...etf(), currency: 'CHF' }], {}),
    );
    expect(summary.netWorth).toBe(0);
    expect(summary.missingFx).toEqual(['CHF']);
  });
});

describe('buildHistory / periodReturn', () => {
  it('ricostruisce il valore giornaliero e depura i versamenti', () => {
    const asset = etf({
      transactions: [
        { id: '1', type: 'buy', date: '2024-01-02', quantity: 10, price: 100 },
        { id: '2', type: 'buy', date: '2024-01-04', quantity: 10, price: 110 },
      ],
    });
    const points = buildHistory({
      assets: [asset],
      prices: {
        'VWCE.DE': [
          { date: '2024-01-02', close: 100 },
          { date: '2024-01-03', close: 105 },
          { date: '2024-01-04', close: 110 },
          { date: '2024-01-05', close: 121 },
        ],
      },
      fxHistory: {},
      fxNow: {},
      start: '2024-01-02',
      end: '2024-01-05',
    });
    expect(points.map(p => p.investments)).toEqual([1000, 1050, 2200, 2420]);
    expect(points.map(p => p.invested)).toEqual([1000, 1000, 2100, 2100]);

    const result = periodReturn(points);
    // Guadagno = 2420 - 1000 - 1100 di nuovi acquisti
    expect(result.gain).toBeCloseTo(320);
    // Capitale impegnato = 1000 iniziali + 1100 versati
    expect(result.pct).toBeCloseTo(320 / 2100);
  });

  it('riduce il numero di punti mantenendo l\'ultimo', () => {
    const points = buildHistory({
      assets: [{ id: 'c', name: 'c', type: 'Conto Bancario', currency: 'EUR', initialValue: 1, currentValue: 1 }],
      prices: {},
      fxHistory: {},
      fxNow: {},
      start: '2020-01-01',
      end: '2024-12-31',
      maxPoints: 100,
    });
    expect(points.length).toBeLessThanOrEqual(101);
    expect(points[points.length - 1].date).toBe('2024-12-31');
  });
});
