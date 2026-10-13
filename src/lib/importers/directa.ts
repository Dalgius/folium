import { parseDecimal } from '@/lib/forms';

/** Una posizione letta dall'esportazione del portafoglio di Directa. */
export interface DirectaPosition {
  name: string;
  /** Ticker come appare su Directa (i titoli USA iniziano con ".") */
  ticker: string;
  isin: string;
  quantity: number;
  /** Prezzo medio di carico, nella valuta del titolo */
  avgPrice: number;
  /** Ultimo prezzo, nella valuta del titolo */
  price: number;
  currency: string;
  /** Valore di carico in EUR (Directa converte i titoli in valuta) */
  costEur: number;
  /** Valore attuale in EUR */
  valueEur: number;
  /** Simboli Yahoo Finance probabili, in ordine di preferenza */
  yahooCandidates: string[];
}

export interface DirectaPortfolio {
  /** Data di estrazione (yyyy-MM-dd), se presente */
  extractedAt: string | null;
  positions: DirectaPosition[];
  /** Righe scartate perché incomplete */
  skipped: number;
}

/** Normalizza un'intestazione: minuscolo, senza accenti né spazi superflui. */
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const COLUMNS = {
  name: ['strumento'],
  ticker: ['ticker'],
  isin: ['isin'],
  price: ['prezzo'],
  quantity: ['quantita'],
  cost: ['valore di carico'],
  value: ['valore attuale'],
  avgPrice: ['prezzo medio'],
  currency: ['divisa', 'valuta'],
} as const;

type Column = keyof typeof COLUMNS;

function splitLine(line: string, separator: string): string[] {
  // Directa non usa virgolette, ma gestiamo comunque i campi quotati
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === separator && !quoted) {
      cells.push(current.trim());
      current = '';
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Simboli Yahoo candidati a partire dal ticker Directa. */
export function yahooCandidates(ticker: string, currency: string): string[] {
  const t = ticker.trim().toUpperCase();
  if (!t) return [];
  // Mercati USA: Directa antepone un punto (".AAPL" → "AAPL")
  if (t.startsWith('.')) return [t.slice(1)];
  // Il resto è quotato su Borsa Italiana (azioni MTA ed ETFplus)
  return currency === 'EUR' ? [`${t}.MI`] : [`${t}.MI`, t];
}

/** Riconosce se il testo è un'esportazione del portafoglio di Directa. */
export function isDirectaPortfolio(text: string): boolean {
  return /strumento\s*;\s*ticker\s*;\s*isin/i.test(text.slice(0, 4000));
}

export function parseDirectaPortfolio(text: string): DirectaPortfolio {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);

  const dateMatch = text.match(/Data estrazione\s*:\s*(\d{4})[/-](\d{2})[/-](\d{2})/i);
  const extractedAt = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

  const headerIndex = lines.findIndex(l => /strumento/i.test(l) && /isin/i.test(l));
  if (headerIndex === -1) {
    throw new Error('Intestazione non trovata: il file non sembra un portafoglio esportato da Directa.');
  }

  const separator = lines[headerIndex].includes(';') ? ';' : ',';
  const header = splitLine(lines[headerIndex], separator).map(normalize);
  const index = {} as Record<Column, number>;
  (Object.keys(COLUMNS) as Column[]).forEach(col => {
    index[col] = header.findIndex(h => (COLUMNS[col] as readonly string[]).includes(h));
  });

  const required: Column[] = ['name', 'ticker', 'isin', 'quantity', 'avgPrice'];
  const missing = required.filter(c => index[c] === -1);
  if (missing.length) {
    throw new Error(`Colonne mancanti nel file: ${missing.join(', ')}.`);
  }

  const positions: DirectaPosition[] = [];
  let skipped = 0;

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.replace(/[;,\s]/g, '')) continue;
    const cells = splitLine(line, separator);
    const get = (col: Column) => (index[col] >= 0 ? cells[index[col]] ?? '' : '');

    const name = get('name');
    const ticker = get('ticker');
    // La riga dei totali non ha nome né ticker
    if (!name && !ticker) continue;

    const quantity = parseDecimal(get('quantity'));
    const avgPrice = parseDecimal(get('avgPrice'));
    if (!ticker || !(quantity > 0) || !(avgPrice > 0)) {
      skipped++;
      continue;
    }

    const currency = (get('currency') || 'EUR').toUpperCase();
    const number = (col: Column) => {
      const n = parseDecimal(get(col));
      return Number.isFinite(n) ? n : 0;
    };

    positions.push({
      name: name || ticker,
      ticker,
      isin: get('isin').toUpperCase(),
      quantity,
      avgPrice,
      price: number('price'),
      currency,
      costEur: number('cost'),
      valueEur: number('value'),
      yahooCandidates: yahooCandidates(ticker, currency),
    });
  }

  return { extractedAt, positions, skipped };
}
