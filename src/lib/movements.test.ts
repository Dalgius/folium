import { describe, expect, it } from 'vitest';
import type { Asset } from '@/types';
import { buildMovements, movementsToCsv } from './movements';

const assets: Asset[] = [
  {
    id: 'etf',
    name: 'Vanguard FTSE All-World',
    type: 'ETF',
    currency: 'EUR',
    initialValue: 0,
    currentValue: 0,
    transactions: [
      { id: 'b', type: 'buy', date: '2024-01-10', quantity: 10, price: 100, fees: 2 },
      { id: 's', type: 'sell', date: '2024-06-10T12:00:00.000Z', quantity: 4, price: 120, fees: 1 },
    ],
  },
  {
    id: 'cc',
    name: 'Conto "principale"',
    type: 'Conto Bancario',
    currency: 'EUR',
    initialValue: 0,
    currentValue: 0,
    balanceHistory: [
      { date: '2024-03-01', value: 1500 },
      { date: '2024-01-01', value: 1000 },
    ],
  },
];

describe('buildMovements', () => {
  it('unisce operazioni e saldi, dal più recente, con importi e variazioni', () => {
    const list = buildMovements(assets);
    expect(list.map(m => `${m.date} ${m.kind}`)).toEqual([
      '2024-06-10 sell',
      '2024-03-01 balance',
      '2024-01-10 buy',
      '2024-01-01 opening',
    ]);
    expect(list[0].amount).toBe(479);
    expect(list[1].change).toBe(500);
    expect(list[2].amount).toBe(1002);
    expect(list[3].change).toBeUndefined();
  });
});

describe('movementsToCsv', () => {
  it('usa ";" e la virgola decimale, con i testi tra virgolette se serve', () => {
    const csv = movementsToCsv(buildMovements(assets)).split('\n');
    expect(csv[0]).toBe('Data;Asset;Tipo;Movimento;Quantità;Prezzo;Commissioni;Importo;Variazione;Valuta');
    expect(csv[1]).toBe('2024-06-10;Vanguard FTSE All-World;ETF;Vendita;4;120;1;479;;EUR');
    expect(csv[2]).toBe('2024-03-01;"Conto ""principale""";Conto Bancario;Saldo;;;;1500;500;EUR');
  });
});
