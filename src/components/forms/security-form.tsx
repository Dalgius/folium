'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info, Loader2, Search, X } from 'lucide-react';
import type { Asset, NewAsset } from '@/types';
import { assetTypeFromQuoteType, typeMeta } from '@/lib/asset-types';
import { notInFuture, optionalNumber, optionalNumberValue, parseDecimal, requiredDate, requiredNumber, toInput, todayInput } from '@/lib/forms';
import { getQuote, searchSecurities, type Quote, type SearchResult } from '@/services/finance.service';
import { newId } from '@/services/asset.service';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TextField } from '@/components/forms/fields';
import { AssetBadge } from '@/components/asset-icons';
import { Money } from '@/components/money';
import { cn } from '@/lib/utils';

const schema = z.object({
  date: requiredDate().refine(notInFuture, 'La data non può essere futura'),
  quantity: requiredNumber({ positive: true }),
  price: requiredNumber({ positive: true }),
  fees: optionalNumber({ min: 0 }),
  institution: z.string().trim().optional(),
});

type Values = z.infer<typeof schema>;

interface Selected {
  result: SearchResult;
  quote: Quote | null;
}

export function SecurityForm({ assets, onSubmit, onBack }: { assets: Asset[]; onSubmit: (data: NewAsset) => Promise<boolean>; onBack?: () => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayInput(), quantity: '', price: '', fees: '', institution: '' },
  });

  useEffect(() => {
    if (selected) return;
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const found = await searchSecurities(q);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, selected]);

  async function choose(result: SearchResult) {
    setSelected({ result, quote: null });
    setResults([]);
    setLoadingQuote(true);
    const quote = await getQuote(result.ticker);
    setSelected({ result, quote });
    setLoadingQuote(false);
    if (quote) form.setValue('price', toInput(quote.price, 4));
    const existing = assets.find(a => a.ticker?.toUpperCase() === result.ticker.toUpperCase());
    if (existing?.institution) form.setValue('institution', existing.institution);
  }

  const existing = selected ? assets.find(a => a.ticker?.toUpperCase() === selected.result.ticker.toUpperCase()) : undefined;
  const currency = existing?.currency ?? selected?.quote?.currency ?? 'EUR';
  const type = selected ? assetTypeFromQuoteType(selected.result.type) : 'Azione';

  const [quantity, price, fees] = form.watch(['quantity', 'price', 'fees']);
  const total = (parseDecimal(quantity) || 0) * (parseDecimal(price) || 0) + (parseDecimal(fees) || 0);

  async function submit(v: Values) {
    if (!selected) return;
    const quote = selected.quote;
    const data: NewAsset = {
      name: existing?.name ?? quote?.name ?? selected.result.name,
      type: existing?.type ?? type,
      ticker: selected.result.ticker,
      currency,
      institution: v.institution || undefined,
      transactions: [{
        id: newId(),
        type: 'buy',
        date: v.date,
        quantity: parseDecimal(v.quantity),
        price: parseDecimal(v.price),
        fees: optionalNumberValue(v.fees),
      }],
      lastPrice: quote?.price,
      dailyChange: quote?.dailyChange,
      dailyChangePercent: quote?.dailyChangePercent,
      lastUpdated: quote ? new Date().toISOString() : undefined,
      initialValue: 0,
      currentValue: 0,
    };
    await onSubmit(data);
  }

  return (
    <div className="space-y-4">
      {!selected ? (
        <div className="space-y-2">
          <label htmlFor="security-search" className="text-sm font-medium">Cerca un titolo</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="security-search"
              value={term}
              onChange={e => setTerm(e.target.value)}
              placeholder="Nome, ticker o ISIN (es. VWCE, Apple, IE00BK5BQT80)"
              className="pl-9"
              autoFocus
              autoComplete="off"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">Azioni, ETF, fondi e criptovalute tramite Yahoo Finance.</p>
          {results.length > 0 && (
            <ul className="max-h-72 overflow-y-auto rounded-lg border" role="listbox" aria-label="Risultati">
              {results.map(r => (
                <li key={r.ticker}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <AssetBadge type={assetTypeFromQuoteType(r.type)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.ticker} · {r.exchange} · {typeMeta(assetTypeFromQuoteType(r.type)).label}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && term.trim().length >= 2 && results.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nessun risultato. Prova con il ticker o l&apos;ISIN.</p>
          )}
          {onBack && (
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={onBack}>Indietro</Button>
            </DialogFooter>
          )}
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <AssetBadge type={existing?.type ?? type} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{existing?.name ?? selected.quote?.name ?? selected.result.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.result.ticker} · {selected.result.exchange}
                  {loadingQuote ? ' · caricamento prezzo…' : selected.quote ? <> · <Money value={selected.quote.price} currency={currency} /></> : ' · prezzo non disponibile'}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setSelected(null); form.reset(); }} aria-label="Cambia titolo">
                <X />
              </Button>
            </div>

            {existing && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Hai già questo titolo in portafoglio: l&apos;acquisto verrà aggiunto alla posizione esistente e il prezzo medio ricalcolato.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="quantity" label="Quantità" inputMode="decimal" placeholder="10" autoFocus />
              <TextField control={form.control} name="price" label="Prezzo unitario" inputMode="decimal" suffix={currency} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="date" label="Data acquisto" type="date" max={todayInput()} />
              <TextField control={form.control} name="fees" label="Commissioni" inputMode="decimal" suffix={currency} placeholder="0" />
            </div>
            <TextField control={form.control} name="institution" label="Broker (facoltativo)" placeholder="Es. Directa, Fineco, Scalable" />

            <div className={cn('flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm', total <= 0 && 'opacity-60')}>
              <span className="text-muted-foreground">Totale investito</span>
              <Money value={total} currency={currency} className="font-semibold" />
            </div>

            <DialogFooter className="gap-2 pt-1 sm:gap-0">
              {onBack && <Button type="button" variant="ghost" onClick={onBack}>Indietro</Button>}
              <Button type="submit" disabled={form.formState.isSubmitting || loadingQuote}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                {existing ? 'Aggiungi acquisto' : 'Aggiungi titolo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      )}
    </div>
  );
}
