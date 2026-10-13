import { describe, expect, it } from 'vitest';
import { isDirectaPortfolio, parseDirectaPortfolio, yahooCandidates } from './directa';

// Estratto anonimizzato di un'esportazione reale (stesso formato: BOM, ";" e virgola decimale)
const SAMPLE = [
  '﻿Portafoglio : TOTALE;;;;;;;;;;;;;;',
  'Conto : X0000 MARIO ROSSI;;;;;;;;;;;;;;',
  'Data estrazione : 2026/10/13 9:43:55;;;;;;;;;;;;;;',
  ';;;;;;;;;;;;;;',
  'Valore portafoglio : 5432,10€;;;;;;;;;;;;;;',
  ';;;;;;;;;;;;;;',
  ';;;;;;;;;;;;;;',
  'Strumento;Ticker;Isin;Prezzo;Trend %;Quantita;Valore di carico;Valore attuale;Gain/Loss €;Gain/Loss %;Gain/Loss € Intraday;Prezzo medio;Bid;Ask;Divisa',
  'INTESA SANPAOLO;ISP;IT0000072618;6,237;0,86;50;177,75;311,75;134;75,39;2,55;3,555;6,235;6,237;EUR',
  'VANGUARD FTSE DEVELOP WORLD UCITS ETF A;VHVE;IE00BK5BQV03;137,22;-0,29;28;2564,24;3841,88;1277,64;49,83;-11,48;91,58;137,21;137,25;EUR',
  'APPLE INC;.AAPL;US0378331005;340,97;1,28;6;1015,23;1833,83;818,6;80,63;0;188,7651;0;0;USD',
  ';;;;;;3757,22;5987,46;2230,24;59,36;-8,93;;;;',
].join('\n');

describe('parseDirectaPortfolio', () => {
  it('riconosce il formato', () => {
    expect(isDirectaPortfolio(SAMPLE)).toBe(true);
    expect(isDirectaPortfolio('data;importo\n2024-01-01;10')).toBe(false);
  });

  it('legge data di estrazione e posizioni, ignorando la riga dei totali', () => {
    const { extractedAt, positions, skipped } = parseDirectaPortfolio(SAMPLE);
    expect(extractedAt).toBe('2026-10-13');
    expect(skipped).toBe(0);
    expect(positions).toHaveLength(3);
    expect(positions[0]).toMatchObject({
      name: 'INTESA SANPAOLO',
      ticker: 'ISP',
      isin: 'IT0000072618',
      quantity: 50,
      avgPrice: 3.555,
      price: 6.237,
      currency: 'EUR',
      costEur: 177.75,
      yahooCandidates: ['ISP.MI'],
    });
  });

  it('mantiene il prezzo medio nella valuta del titolo per i titoli USA', () => {
    const apple = parseDirectaPortfolio(SAMPLE).positions[2];
    expect(apple.currency).toBe('USD');
    expect(apple.avgPrice).toBeCloseTo(188.7651);
    expect(apple.yahooCandidates).toEqual(['AAPL']);
  });

  it('accetta fine riga Windows', () => {
    expect(parseDirectaPortfolio(SAMPLE.replace(/\n/g, '\r\n')).positions).toHaveLength(3);
  });

  it('segnala un file senza intestazione', () => {
    expect(() => parseDirectaPortfolio('a;b;c\n1;2;3')).toThrow(/Directa/);
  });
});

describe('yahooCandidates', () => {
  it('mappa i mercati', () => {
    expect(yahooCandidates('.MSFT', 'USD')).toEqual(['MSFT']);
    expect(yahooCandidates('xdw0', 'EUR')).toEqual(['XDW0.MI']);
  });
});
