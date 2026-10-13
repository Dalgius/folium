'use client';

import { useMemo, useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2, RefreshCw, XCircle } from 'lucide-react';
import type { Asset, AssetType, NewAsset } from '@/types';
import { assetTypeFromQuoteType, typeMeta } from '@/lib/asset-types';
import { isDirectaPortfolio, parseDirectaPortfolio, type DirectaPosition } from '@/lib/importers/directa';
import { todayInput } from '@/lib/forms';
import { getQuote, matchSecurities, type Quote, type SecurityMatch } from '@/lib/market';
import { searchSecurities } from '@/services/finance.service';
import { newId } from '@/services/asset.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Money } from '@/components/money';
import { AssetBadge } from '@/components/asset-icons';
import { cn, formatNumber } from '@/lib/utils';

const INSTITUTION = 'Directa';
/** Scarto oltre il quale il prezzo Yahoo è considerato sospetto */
const PRICE_TOLERANCE = 0.1;

interface Row {
  key: string;
  position: DirectaPosition;
  symbol: string;
  match: SecurityMatch | null;
  checking: boolean;
  include: boolean;
}

export interface ImportItem {
  data: NewAsset;
  replaceId?: string;
}

interface ImportDirectaProps {
  assets: Asset[];
  onImport: (items: ImportItem[]) => Promise<boolean>;
  onBack?: () => void;
}

function guessType(row: Row): AssetType {
  if (row.match?.quoteType) return assetTypeFromQuoteType(row.match.quoteType);
  return /\b(ETF|ETC|UCITS)\b/i.test(row.position.name) ? 'ETF' : 'Azione';
}

/** Nome da usare: quello di Yahoo se significativo, altrimenti quello di Directa. */
function displayName(row: Row): string {
  const name = row.match?.name?.trim();
  return name && name.toUpperCase() !== row.match?.symbol.toUpperCase() ? name : row.position.name;
}

function rowIssue(row: Row): { level: 'error' | 'warning'; text: string } | null {
  if (!row.symbol) return { level: 'error', text: 'Titolo non trovato su Yahoo Finance: inserisci il simbolo a mano' };
  if (!row.match) return { level: 'warning', text: 'Nessuna quotazione per questo simbolo: verificalo (per Borsa Italiana serve .MI). Se lo importi comunque uso il prezzo di Directa' };
  if (row.match.currency && row.match.currency !== row.position.currency) {
    return { level: 'warning', text: `Valuta diversa: Yahoo ${row.match.currency}, Directa ${row.position.currency}` };
  }
  const { price } = row.match;
  const reference = row.position.price;
  if (price && reference > 0 && Math.abs(price - reference) / reference > PRICE_TOLERANCE) {
    return { level: 'warning', text: `Prezzo diverso da Directa (${formatNumber(price, 2)} contro ${formatNumber(reference, 2)}): verifica il simbolo` };
  }
  return null;
}

export function ImportDirecta({ assets, onImport, onBack }: ImportDirectaProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [date, setDate] = useState(todayInput());
  const [matching, setMatching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingBySymbol = useMemo(() => {
    const map = new Map<string, Asset>();
    assets.forEach(a => a.ticker && map.set(a.ticker.toUpperCase(), a));
    return map;
  }, [assets]);

  const update = (key: string, patch: Partial<Row>) =>
    setRows(current => current?.map(r => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  async function loadFile(file: File) {
    setError(null);
    setRows(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      if (!isDirectaPortfolio(text)) {
        setError("Il file non sembra un'esportazione del portafoglio di Directa (mancano le colonne Strumento, Ticker e Isin).");
        return;
      }
      const portfolio = parseDirectaPortfolio(text);
      if (portfolio.positions.length === 0) {
        setError('Nel file non ci sono posizioni da importare.');
        return;
      }
      if (portfolio.extractedAt && portfolio.extractedAt <= todayInput()) setDate(portfolio.extractedAt);

      const initial: Row[] = portfolio.positions.map((position, i) => ({
        key: `${position.isin || position.ticker}-${i}`,
        position,
        symbol: '',
        match: null,
        checking: true,
        include: false,
      }));
      setRows(initial);
      setMatching(true);

      setUnreachable(false);
      const { matches, reachable } = await matchSecurities(
        portfolio.positions.map(p => ({ isin: p.isin, candidates: p.yahooCandidates, currency: p.currency })),
      );
      setUnreachable(!reachable);
      setRows(initial.map((row, i) => {
        const match = matches[i] ?? null;
        const symbol = match?.symbol ?? '';
        const next = { ...row, match, symbol, checking: false };
        // Restano escluse, finché l'utente non le seleziona, le posizioni già presenti
        // (verrebbero sostituite) e quelle con un abbinamento dubbio
        return { ...next, include: !!symbol && !existingBySymbol.has(symbol.toUpperCase()) && !rowIssue(next) };
      }));
    } catch (e) {
      console.error(e);
      // Se l'abbinamento fallisce le righe restano modificabili a mano
      setUnreachable(true);
      setRows(current => current?.map(r => ({ ...r, checking: false })) ?? null);
      if (!(e instanceof Error) || !/Directa|Colonne|Intestazione/.test(e.message)) return;
      setError(e.message);
      setRows(null);
    } finally {
      setMatching(false);
    }
  }

  /**
   * Cerca la quotazione del simbolo inserito a mano. Se non la trova prova
   * ad aggiungere ".MI" (Borsa Italiana) e infine la ricerca per nome o ticker.
   */
  async function resolveSymbol(symbol: string, currency: string): Promise<Quote | null> {
    const direct = await getQuote(symbol);
    if (direct) return direct;
    if (!symbol.includes('.') && currency === 'EUR') {
      const milan = await getQuote(`${symbol}.MI`);
      if (milan) return milan;
    }
    const [first] = await searchSecurities(symbol);
    return first ? getQuote(first.ticker) : null;
  }

  async function changeSymbol(row: Row, value: string) {
    const symbol = value.trim().toUpperCase();
    if (symbol === row.symbol && row.match) return;
    if (!symbol) {
      update(row.key, { symbol: '', match: null, include: false });
      return;
    }
    update(row.key, { symbol, checking: true });
    const quote = await resolveSymbol(symbol, row.position.currency);
    update(row.key, {
      checking: false,
      symbol: quote?.ticker.toUpperCase() ?? symbol,
      match: quote ? { symbol: quote.ticker, name: quote.name, quoteType: quote.quoteType, price: quote.price, currency: quote.currency, source: 'ticker' } : null,
      include: !!quote,
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  const selected = rows?.filter(r => r.include && r.symbol) ?? [];
  const selectedCost = selected.reduce((s, r) => s + r.position.costEur, 0);
  const replacing = selected.filter(r => existingBySymbol.has(r.symbol.toUpperCase())).length;

  async function submit() {
    if (!selected.length) return;
    setSubmitting(true);
    const items: ImportItem[] = selected.map(row => {
      const { position, match } = row;
      const existing = existingBySymbol.get(row.symbol.toUpperCase());
      const sameCurrency = !match?.currency || match.currency === position.currency;
      return {
        replaceId: existing?.id,
        data: {
          name: displayName(row),
          type: existing?.type ?? guessType(row),
          ticker: row.symbol,
          currency: position.currency,
          institution: INSTITUTION,
          transactions: [{ id: newId(), type: 'buy', date, quantity: position.quantity, price: position.avgPrice }],
          lastPrice: sameCurrency && match?.price ? match.price : position.price || undefined,
          lastUpdated: new Date().toISOString(),
          initialValue: 0,
          currentValue: 0,
        },
      };
    });
    await onImport(items);
    setSubmitting(false);
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-primary bg-accent/60' : 'hover:border-primary/50 hover:bg-muted/50',
          )}
        >
          <FileUp className="h-8 w-8 text-muted-foreground" />
          <span className="font-medium">Trascina qui il file CSV o fai clic per sceglierlo</span>
          <span className="text-sm text-muted-foreground">Esportazione del portafoglio di Directa (es. P_TOTALE_….csv)</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          Il file viene letto nel browser: per trovare le quotazioni vengono usati solo ticker e ISIN dei titoli.
        </p>
        {onBack && (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onBack}>Indietro</Button>
          </DialogFooter>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{fileName}</span> · {rows.length} posizioni
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={matching || submitting}>
          <RefreshCw /> Cambia file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {unreachable && !matching && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Yahoo Finance non ha risposto, quindi nessun titolo è stato abbinato. Riprova tra qualche minuto con «Cambia file»
            oppure inserisci i simboli a mano (per Borsa Italiana basta il ticker: aggiungo io «.MI»).
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Directa non indica le date di acquisto: ogni posizione viene registrata come un unico acquisto al prezzo medio di carico.
          {replacing > 0 && ' Le posizioni già presenti selezionate verranno sostituite con quelle del file.'}
        </AlertDescription>
      </Alert>

      <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-lg border" aria-label="Posizioni da importare">
        {rows.map(row => {
          const issue = rowIssue(row);
          const existing = row.symbol ? existingBySymbol.get(row.symbol.toUpperCase()) : undefined;
          const type = existing?.type ?? guessType(row);
          return (
            <li key={row.key} className={cn('flex gap-3 px-3 py-2.5', !row.include && 'bg-muted/30')}>
              <input
                type="checkbox"
                className="mt-2.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                checked={row.include}
                disabled={!row.symbol || row.checking}
                onChange={e => update(row.key, { include: e.target.checked })}
                aria-label={`Importa ${row.position.name}`}
              />
              <AssetBadge type={type} size="sm" className="mt-1" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="truncate text-sm font-medium" title={row.position.name}>{displayName(row)}</p>
                  <p className="text-sm tabular">
                    {formatNumber(row.position.quantity)} × <Money value={row.position.avgPrice} currency={row.position.currency} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{row.position.ticker} · {row.position.isin} · {typeMeta(type).label}</span>
                  <span aria-hidden>→</span>
                  <Input
                    key={row.symbol}
                    defaultValue={row.symbol}
                    placeholder="Simbolo Yahoo"
                    onBlur={e => changeSymbol(row, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                    className="h-7 w-28 px-2 text-xs uppercase"
                    aria-label={`Simbolo Yahoo per ${row.position.name}`}
                    disabled={row.checking}
                  />
                  {row.checking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : !issue && row.symbol ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-positive" aria-label="Abbinato" />
                  ) : null}
                  {existing && <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">già in portafoglio</span>}
                </div>
                {issue && !row.checking && (
                  <p className={cn('flex items-center gap-1.5 text-xs', issue.level === 'error' ? 'text-destructive' : 'text-foreground')}>
                    <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', issue.level === 'warning' && 'text-cat-4')} />
                    {issue.text}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <label htmlFor="import-date" className="text-sm font-medium">Data degli acquisti</label>
          <Input id="import-date" type="date" value={date} max={todayInput()} onChange={e => setDate(e.target.value)} className="w-44" />
          <p className="max-w-xs text-xs text-muted-foreground">Nel grafico storico i titoli compaiono da questa data.</p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="text-muted-foreground">{selected.length} titoli selezionati{replacing > 0 && ` (${replacing} da aggiornare)`}</p>
          <p>valore di carico <Money value={selectedCost} className="font-semibold" /></p>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        {onBack && <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>Indietro</Button>}
        <Button type="button" onClick={submit} disabled={!selected.length || matching || submitting || !date}>
          {(submitting || matching) && <Loader2 className="animate-spin" />}
          {matching ? 'Ricerca dei titoli…' : `Importa ${selected.length} titoli`}
        </Button>
      </DialogFooter>
    </div>
  );
}
