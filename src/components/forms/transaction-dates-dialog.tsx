'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { Asset } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { dayKey, invalidSellIds, sortTransactions } from '@/lib/portfolio';
import { todayInput } from '@/lib/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AssetBadge } from '@/components/asset-icons';
import { Money } from '@/components/money';
import { cn, formatNumber } from '@/lib/utils';

interface TransactionDatesDialogProps {
  assets: Asset[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (changes: { assetId: string; txId: string; date: string }[]) => Promise<boolean>;
}

const keyOf = (assetId: string, txId: string) => `${assetId}:${txId}`;

/** Tabella per correggere in blocco le date delle operazioni (es. dopo un'importazione). */
export function TransactionDatesDialog({ assets, open, onOpenChange, onSubmit }: TransactionDatesDialogProps) {
  const [dates, setDates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDates({});
    setSearch('');
  }, [open]);

  const securities = useMemo(
    () => assets.filter(a => isMarketAsset(a.type) && a.transactions?.length).sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [assets],
  );

  // Errori calcolati sulle date modificate, titolo per titolo
  const { errors, changes } = useMemo(() => {
    const errors = new Map<string, string>();
    const changes: { assetId: string; txId: string; date: string }[] = [];
    const today = todayInput();
    for (const asset of securities) {
      let touched = false;
      const next = (asset.transactions ?? []).map(tx => {
        const edited = dates[keyOf(asset.id, tx.id)];
        if (edited === undefined || edited === dayKey(tx.date)) return tx;
        touched = true;
        const key = keyOf(asset.id, tx.id);
        if (!edited) errors.set(key, 'Inserisci una data');
        else if (edited > today) errors.set(key, 'La data non può essere futura');
        else changes.push({ assetId: asset.id, txId: tx.id, date: edited });
        return { ...tx, date: edited || tx.date };
      });
      if (!touched) continue;
      for (const id of invalidSellIds(next)) {
        const key = keyOf(asset.id, id);
        if (!errors.has(key)) errors.set(key, 'Vendita precedente agli acquisti: controlla le date');
      }
    }
    return { errors, changes };
  }, [securities, dates]);

  const query = search.trim().toLowerCase();
  const visible = query
    ? securities.filter(a => a.name.toLowerCase().includes(query) || a.ticker?.toLowerCase().includes(query))
    : securities;
  const count = changes.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!count || errors.size) return;
    setSaving(true);
    const ok = await onSubmit(changes);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Correggi date</DialogTitle>
          <DialogDescription>
            Modifica le date di acquisto e vendita: grafico storico e rendimenti nel periodo dipendono da queste date.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca titolo…" className="h-9 pl-9" aria-label="Cerca titolo" />
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-lg border" role="table" aria-label="Operazioni">
            {visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nessun titolo trovato.</p>
            ) : (
              visible.map(asset => (
                <div key={asset.id} role="rowgroup" className="border-b last:border-b-0">
                  <div role="row" className="flex items-center gap-2 bg-muted/30 px-3 py-2">
                    <AssetBadge type={asset.type} size="sm" />
                    <span role="rowheader" className="min-w-0 truncate text-sm font-medium">{asset.name}</span>
                    {asset.ticker && <span className="shrink-0 text-xs text-muted-foreground">{asset.ticker}</span>}
                  </div>
                  {sortTransactions(asset.transactions ?? []).map(tx => {
                    const key = keyOf(asset.id, tx.id);
                    const original = dayKey(tx.date) ?? '';
                    const value = dates[key] ?? original;
                    const error = errors.get(key);
                    const edited = value !== original;
                    return (
                      <div key={tx.id} role="row" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:pl-12', edited && 'bg-accent/40')}>
                        <span role="cell" className="flex-1 text-sm">
                          <Badge variant={tx.type === 'buy' ? 'secondary' : 'outline'} className="mr-2 w-[72px] justify-center">
                            {tx.type === 'buy' ? 'Acquisto' : 'Vendita'}
                          </Badge>
                          <span className="tabular">{formatNumber(tx.quantity)} × <Money value={tx.price} currency={asset.currency} /></span>
                        </span>
                        <span role="cell" className="flex flex-col items-end">
                          <Input
                            type="date"
                            value={value}
                            max={todayInput()}
                            onChange={e => setDates(d => ({ ...d, [key]: e.target.value }))}
                            aria-label={`Data ${tx.type === 'buy' ? "dell'acquisto" : 'della vendita'} di ${asset.name}`}
                            aria-invalid={!!error}
                            className={cn('h-8 w-40 text-sm', error && 'border-destructive')}
                          />
                          {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className={cn('text-sm', errors.size ? 'text-destructive' : 'text-muted-foreground')}>
              {errors.size
                ? errors.size === 1 ? '1 data da correggere' : `${errors.size} date da correggere`
                : count === 0 ? 'Nessuna modifica' : count === 1 ? '1 data modificata' : `${count} date modificate`}
            </p>
            <Button type="submit" disabled={!count || errors.size > 0 || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {count > 1 ? `Salva ${count} modifiche` : 'Salva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
