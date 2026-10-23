import { describe, expect, it } from 'vitest';
import type { Asset } from '@/types';
import {
  allocationBy,
  balanceAt,
  buildHistory,
  buildHoldings,
  buildIntradayHistory,
  computePosition,
  dayChangeLabel,
  depositInterest,
  invalidSellIds,
  isStale,
  netWorthChange,
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

describe('invalidSellIds', () => {
  it('segnala le vendite che superano le quote possedute in quel momento', () => {
    const txs = [
      { id: 'b1', type: 'buy' as const, date: '2024-03-01', quantity: 10, price: 100 },
      { id: 's1', type: 'sell' as const, date: '2024-02-01', quantity: 5, price: 110 },
      { id: 's2', type: 'sell' as const, date: '2024-04-01', quantity: 10, price: 120 },
    ];
    expect(invalidSellIds(txs)).toEqual(['s1']);
    expect(invalidSellIds([txs[0], { ...txs[1], date: '2024-03-15' }])).toEqual([]);
    expect(invalidSellIds([txs[0], { ...txs[2], quantity: 11 }])).toEqual(['s2']);
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
    expect(summary.classAllocation.map(c => c.assetClass)).toEqual(['liquidita', 'azionario']);
    expect(summary.classAllocation[1].value).toBeCloseTo(2600 + 990);
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

describe('allocationBy', () => {
  it('ripartisce i soli investimenti per categoria e per classe', () => {
    const holdings = buildHoldings([
      etf(),
      etf({ id: 'bond', name: 'Vanguard Global Aggregate Bond', lastPrice: 100 }),
      { ...etf({ id: 'btc', name: 'Bitcoin', type: 'Crypto', lastPrice: 50 }) },
      { id: 'cc', name: 'Conto', type: 'Conto Bancario', currency: 'EUR', initialValue: 0, currentValue: 0, balanceHistory: [{ date: '2024-01-01', value: 10000 }] },
    ], {});
    const investments = holdings.filter(h => h.group === 'investments');

    const byType = allocationBy(investments, 'type');
    expect(byType.map(s => s.key)).toEqual(['ETF', 'Crypto']);
    expect(byType[0].value).toBeCloseTo(2600 + 2000);
    expect(byType.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);

    const byClass = allocationBy(investments, 'class');
    expect(byClass.map(s => s.key)).toEqual(['azionario', 'obbligazionario', 'crypto']);
    expect(byClass[0].share).toBeCloseTo(2600 / 5600);

    // Sull'intero patrimonio il conto corrente entra come liquidità
    expect(allocationBy(holdings, 'class')[0].key).toBe('liquidita');
  });
});

describe('liquidità vincolata', () => {
  const deposit = (id: string, maturityDate?: string): Asset => ({
    id,
    name: `Deposito ${id}`,
    type: 'Conto Deposito',
    currency: 'EUR',
    initialValue: 1000,
    currentValue: 1000,
    balanceHistory: [{ date: '2026-01-01', value: 1000 }],
    maturityDate,
  });

  it('separa i depositi non ancora scaduti e indica la scadenza più vicina', () => {
    const holdings = buildHoldings([deposit('a', '2027-06-30'), deposit('b', '2026-12-31'), deposit('c', '2026-03-01'), deposit('d')], {});
    const summary = summarize(holdings, '2026-10-20');
    const valueOf = (id: string) => holdings.find(h => h.asset.id === id)!.valueEur!;
    expect(summary.lockedLiquidity).toBeCloseTo(valueOf('a') + valueOf('b'));
    expect(summary.nextUnlock).toBe('2026-12-31');
  });

  it('senza vincoli attivi è zero', () => {
    const summary = summarize(buildHoldings([deposit('c', '2026-03-01')], {}), '2026-10-20');
    expect(summary.lockedLiquidity).toBe(0);
    expect(summary.nextUnlock).toBeNull();
  });
});

describe('isStale / dayChangeLabel', () => {
  // martedì 20 ottobre 2026, ore 10
  const tuesday = new Date(2026, 9, 20, 10);
  const monday = new Date(2026, 9, 19, 10);

  it("segnala i prezzi più vecchi dell'ultimo giorno lavorativo", () => {
    expect(isStale(etf({ lastUpdated: new Date(2026, 9, 19, 18).toISOString() }), tuesday)).toBe(false);
    expect(isStale(etf({ lastUpdated: new Date(2026, 9, 16, 18).toISOString() }), tuesday)).toBe(true);
    expect(isStale(etf({ lastUpdated: undefined }), tuesday)).toBe(true);
  });

  it('il fine settimana non conta', () => {
    // lunedì: un prezzo di venerdì è ancora valido
    expect(isStale(etf({ lastUpdated: new Date(2026, 9, 16, 18).toISOString() }), monday)).toBe(false);
    expect(isStale(etf({ lastUpdated: new Date(2026, 9, 15, 18).toISOString() }), monday)).toBe(true);
  });

  it('ignora conti e depositi', () => {
    expect(isStale({ id: 'cc', name: 'Conto', type: 'Conto Bancario', currency: 'EUR', initialValue: 0, currentValue: 0 }, tuesday)).toBe(false);
  });

  it('parla di "oggi" solo se una quotazione è di oggi', () => {
    expect(dayChangeLabel([new Date(2026, 9, 20, 9).toISOString()], tuesday)).toBe('oggi');
    expect(dayChangeLabel([new Date(2026, 9, 19, 17).toISOString(), undefined], tuesday)).toBe('ultima seduta');
    expect(dayChangeLabel([], tuesday)).toBe('ultima seduta');
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

describe('buildIntradayHistory', () => {
  it('unisce gli orari dei titoli e riporta in avanti i prezzi', () => {
    const milano: Asset = {
      id: 'isp', name: 'Intesa', type: 'Azione', ticker: 'ISP.MI', currency: 'EUR', initialValue: 0, currentValue: 0,
      transactions: [{ id: '1', type: 'buy', date: '2024-01-01', quantity: 10, price: 5 }],
    };
    const usa: Asset = {
      id: 'aapl', name: 'Apple', type: 'Azione', ticker: 'AAPL', currency: 'USD', initialValue: 0, currentValue: 0,
      transactions: [{ id: '1', type: 'buy', date: '2024-01-01', quantity: 1, price: 100 }],
    };
    const conto: Asset = {
      id: 'cc', name: 'Conto', type: 'Conto Bancario', currency: 'EUR', initialValue: 1000, currentValue: 1000,
      balanceHistory: [{ date: '2024-01-01', value: 1000 }],
    };
    const points = buildIntradayHistory({
      assets: [milano, usa, conto],
      prices: {
        'ISP.MI': [
          { date: '2026-10-13T07:00:00.000Z', close: 6 },
          { date: '2026-10-13T15:00:00.000Z', close: 6.2 },
        ],
        // Wall Street apre dopo Milano: prima del primo prezzo vale il primo noto
        AAPL: [
          { date: '2026-10-13T13:30:00.000Z', close: 110 },
          { date: '2026-10-13T19:00:00.000Z', close: 120 },
        ],
      },
      fxHistory: { USD: [{ date: '2026-10-13T00:00:00.000Z', close: 0.9 }] },
      fxNow: { USD: 0.8 },
    });

    expect(points.map(p => p.date)).toEqual([
      '2026-10-13T07:00:00.000Z',
      '2026-10-13T13:30:00.000Z',
      '2026-10-13T15:00:00.000Z',
      '2026-10-13T19:00:00.000Z',
    ]);
    expect(points.map(p => p.investments)).toEqual([60 + 99, 60 + 99, 62 + 99, 62 + 108]);
    expect(points.every(p => p.cash === 1000)).toBe(true);
    expect(points[0].invested).toBeCloseTo(50 + 90);
    expect(points[3].netWorth).toBeCloseTo(1170);
  });

  it('senza prezzi restituisce una serie vuota', () => {
    expect(buildIntradayHistory({ assets: [], prices: {}, fxHistory: {}, fxNow: {} })).toEqual([]);
  });
});

describe('netWorthChange', () => {
  const pt = (date: string, cash: number, investments: number, invested: number) =>
    ({ date, cash, investments, invested, netWorth: cash + investments });

  it("separa il rendimento dei mercati dai risparmi", () => {
    const points = [
      pt('2026-09-30', 10000, 5000, 4000),
      // acquisto di 1000 € pagato dal conto: il patrimonio non cambia
      pt('2026-10-05', 9000, 6000, 5000),
      // i prezzi salgono di 300 €
      pt('2026-10-15', 9000, 6300, 5000),
      // arrivano 1500 € di risparmi sul conto
      pt('2026-10-23', 10500, 6300, 5000),
    ];
    const r = netWorthChange(points, '2026-09-30')!;
    expect(r.change).toBe(1800);
    expect(r.market).toBeCloseTo(300);
    expect(r.other).toBeCloseTo(1500);
    expect(r.pct).toBeCloseTo(1800 / 15000);
    expect(r.since).toBe('2026-09-30');
  });

  it("parte dal primo punto se lo storico inizia dopo la data richiesta", () => {
    const r = netWorthChange([pt('2026-03-12', 1000, 0, 0), pt('2026-10-23', 1200, 0, 0)], '2025-12-31')!;
    expect(r.since).toBe('2026-03-12');
    expect(r.other).toBe(200);
    expect(r.market).toBe(0);
  });

  it('senza dati sufficienti restituisce null', () => {
    expect(netWorthChange([pt('2026-10-23', 1, 0, 0)], '2026-09-30')).toBeNull();
    expect(netWorthChange([pt('2026-10-22', 1, 0, 0), pt('2026-10-23', 1, 0, 0)], '2026-10-23')).toBeNull();
  });
});
