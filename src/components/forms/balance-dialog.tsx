'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Asset, BalanceSnapshot } from '@/types';
import { adjustmentFor, latestBalance } from '@/lib/portfolio';
import { notInFuture, parseAmount, requiredDate, requiredNumber, toInput, todayInput } from '@/lib/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/fields';
import { Money } from '@/components/money';

const schema = z.object({
  value: requiredNumber(),
  date: requiredDate().refine(notInFuture, 'La data non può essere futura'),
});

type Values = z.infer<typeof schema>;

interface BalanceDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (assetId: string, snapshot: BalanceSnapshot) => Promise<boolean>;
}

export function BalanceDialog({ asset, open, onOpenChange, onSubmit }: BalanceDialogProps) {
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open && asset) form.reset({ value: toInput(latestBalance(asset), 2), date: todayInput() });
  }, [open, asset, form]);

  const ledger = asset?.type === 'Conto Bancario';
  const [watchedValue, watchedDate] = form.watch(['value', 'date']);
  const target = parseAmount(watchedValue ?? '');
  const difference = ledger && asset && watchedDate && !Number.isNaN(target) ? adjustmentFor(asset, watchedDate, target) : null;

  if (!asset) return null;

  async function submit(v: Values) {
    const ok = await onSubmit(asset!.id, { date: v.date, value: parseAmount(v.value) });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{asset.type === 'Altro' ? 'Aggiorna valore' : ledger ? 'Allinea saldo' : 'Aggiorna saldo'}</DialogTitle>
          <DialogDescription>
            {asset.name} · attuale <Money value={latestBalance(asset)} currency={asset.currency} />
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="value" label={asset.type === 'Altro' ? 'Nuovo valore' : ledger ? 'Saldo della banca' : 'Nuovo saldo'} inputMode="decimal" suffix={asset.currency} autoFocus />
            <TextField
              control={form.control}
              name="date"
              label="Data"
              type="date"
              max={todayInput()}
              description={ledger
                ? 'La differenza con il saldo calcolato dai movimenti diventa una riga «Allineamento».'
                : "Il saldo precedente resta nello storico, per seguirne l'andamento."}
            />
            {ledger && difference !== null && (
              <p className="text-sm">
                {difference === 0 ? 'Il saldo è già allineato.' : <>Allineamento: <Money value={difference} currency={asset.currency} signed className="font-medium" /></>}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>Salva</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
