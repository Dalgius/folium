'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Asset, BalanceSnapshot } from '@/types';
import { latestBalance } from '@/lib/portfolio';
import { notInFuture, parseDecimal, requiredDate, requiredNumber, toInput, todayInput } from '@/lib/forms';
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

  if (!asset) return null;

  async function submit(v: Values) {
    const ok = await onSubmit(asset!.id, { date: v.date, value: parseDecimal(v.value) });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{asset.type === 'Altro' ? 'Aggiorna valore' : 'Aggiorna saldo'}</DialogTitle>
          <DialogDescription>
            {asset.name} · attuale <Money value={latestBalance(asset)} currency={asset.currency} />
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="value" label={asset.type === 'Altro' ? 'Nuovo valore' : 'Nuovo saldo'} inputMode="decimal" suffix={asset.currency} autoFocus />
            <TextField
              control={form.control}
              name="date"
              label="Data"
              type="date"
              max={todayInput()}
              description="Il saldo precedente resta nello storico, per seguirne l'andamento."
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>Salva</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
