'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { Asset, AssetType, BalanceSnapshot } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { latestBalance, sortBalances } from '@/lib/portfolio';
import { parseDecimal, toInput, todayInput } from '@/lib/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssetBadge } from '@/components/asset-icons';
import { Money } from '@/components/money';
import { cn } from '@/lib/utils';

const GROUPS: { type: AssetType; label: string }[] = [
  { type: 'Conto Bancario', label: 'Conti correnti' },
  { type: 'Conto Deposito', label: 'Conti deposito' },
  { type: 'Altro', label: 'Altri beni' },
];

interface BalancesDialogProps {
  assets: Asset[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entries: { assetId: string; snapshot: BalanceSnapshot }[]) => Promise<boolean>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Come parseDecimal, ma negli importi "4.000" o "12.500" sono migliaia, non decimali. */
const parseAmount = (raw: string) => parseDecimal(/^\s*-?\d{1,3}(\.\d{3})+\s*$/.test(raw) ? raw.replace(/\./g, '') : raw);

/** Aggiornamento dei saldi di tutti i conti in un'unica finestra (routine di inizio mese). */
export function BalancesDialog({ assets, open, onOpenChange, onSubmit }: BalancesDialogProps) {
  const accounts = useMemo(() => assets.filter(a => !isMarketAsset(a.type)), [assets]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayInput());
  const [saving, setSaving] = useState(false);

  // Si riparte dai saldi attuali a ogni apertura
  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(accounts.map(a => [a.id, toInput(latestBalance(a), 2)])));
    setDate(todayInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rows = accounts.map(asset => {
    const raw = values[asset.id] ?? '';
    const value = parseAmount(raw);
    const invalid = raw.trim() === '' || Number.isNaN(value);
    const changed = !invalid && round2(value) !== round2(latestBalance(asset));
    return { asset, raw, value, invalid, changed };
  });
  const changed = rows.filter(r => r.changed);
  const invalidCount = rows.filter(r => r.invalid).length;
  const dateInvalid = !date || date > todayInput();

  /** Invio passa al conto successivo, come in un foglio di calcolo. */
  function nextOnEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...(e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[data-balance]') ?? [])];
    const next = inputs[inputs.indexOf(e.currentTarget) + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      e.currentTarget.blur();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!changed.length || invalidCount || dateInvalid) return;
    setSaving(true);
    const ok = await onSubmit(changed.map(r => ({ assetId: r.asset.id, snapshot: { date, value: r.value } })));
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Aggiorna saldi</DialogTitle>
          <DialogDescription>Scrivi i saldi nuovi: vengono salvati solo quelli che cambi, tutti alla stessa data.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <label htmlFor="balances-date" className="text-sm font-medium">Data</label>
            <Input
              id="balances-date"
              type="date"
              value={date}
              max={todayInput()}
              onChange={e => setDate(e.target.value)}
              className={cn('w-44', dateInvalid && 'border-destructive')}
            />
          </div>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {GROUPS.map(group => {
              const items = rows.filter(r => r.asset.type === group.type);
              if (!items.length) return null;
              return (
                <section key={group.type} aria-label={group.label}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                  <ul className="divide-y rounded-lg border">
                    {items.map(({ asset, raw, invalid, changed: isChanged }) => {
                      const last = sortBalances(asset.balanceHistory).at(-1);
                      return (
                        <li key={asset.id} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5', isChanged && 'bg-accent/40')}>
                          <AssetBadge type={asset.type} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{asset.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {asset.institution && `${asset.institution} · `}
                              ultimo <Money value={latestBalance(asset)} currency={asset.currency} />
                              {last && ` al ${format(parseISO(last.date), 'dd/MM/yyyy')}`}
                            </p>
                          </div>
                          <div className="relative w-full sm:w-44">
                            <Input
                              data-balance
                              value={raw}
                              onChange={e => setValues(v => ({ ...v, [asset.id]: e.target.value }))}
                              onKeyDown={nextOnEnter}
                              onFocus={e => e.currentTarget.select()}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`Nuovo saldo di ${asset.name}`}
                              aria-invalid={invalid}
                              className={cn('tabular pr-12 text-right', invalid && 'border-destructive')}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{asset.currency}</span>
                          </div>
                          {isChanged && <span className="sr-only">modificato</span>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className={cn('text-sm', invalidCount ? 'text-destructive' : 'text-muted-foreground')}>
              {invalidCount
                ? `${invalidCount === 1 ? '1 importo non valido' : `${invalidCount} importi non validi`}`
                : changed.length
                  ? `${changed.length === 1 ? '1 saldo modificato' : `${changed.length} saldi modificati`}`
                  : 'Nessuna modifica'}
            </p>
            <Button type="submit" disabled={!changed.length || invalidCount > 0 || dateInvalid || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {changed.length > 1 ? `Salva ${changed.length} saldi` : 'Salva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
