'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Asset, Transaction, TransactionType } from '@/types';
import { computePosition, lastPrice } from '@/lib/portfolio';
import { notInFuture, optionalNumber, optionalNumberValue, parseDecimal, requiredDate, requiredNumber, toInput, todayInput } from '@/lib/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/segmented';
import { TextField } from '@/components/forms/fields';
import { Money } from '@/components/money';
import { formatNumber } from '@/lib/utils';

const baseSchema = z.object({
  date: requiredDate().refine(notInFuture, 'La data non può essere futura'),
  quantity: requiredNumber({ positive: true }),
  price: requiredNumber({ positive: true }),
  fees: optionalNumber({ min: 0 }),
});

type Values = z.infer<typeof baseSchema>;

interface TransactionDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (assetId: string, tx: Omit<Transaction, 'id'>) => Promise<boolean>;
}

export function TransactionDialog({ asset, open, onOpenChange, onSubmit }: TransactionDialogProps) {
  const [type, setType] = useState<TransactionType>('buy');
  const held = asset ? computePosition(asset.transactions).quantity : 0;

  const schema = baseSchema.superRefine((v, ctx) => {
    if (type === 'sell' && parseDecimal(v.quantity) > held + 1e-9) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: `Puoi vendere al massimo ${formatNumber(held)}` });
    }
  });

  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open && asset) {
      setType('buy');
      form.reset({ date: todayInput(), quantity: '', price: toInput(lastPrice(asset), 4), fees: '' });
    }
  }, [open, asset, form]);

  if (!asset) return null;
  const [quantity, price, fees] = form.watch(['quantity', 'price', 'fees']);
  const gross = (parseDecimal(quantity) || 0) * (parseDecimal(price) || 0);
  const total = type === 'buy' ? gross + (parseDecimal(fees) || 0) : gross - (parseDecimal(fees) || 0);

  async function submit(v: Values) {
    const ok = await onSubmit(asset!.id, {
      type,
      date: v.date,
      quantity: parseDecimal(v.quantity),
      price: parseDecimal(v.price),
      fees: optionalNumberValue(v.fees),
    });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registra operazione</DialogTitle>
          <DialogDescription>{asset.name} · in portafoglio {formatNumber(held)}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <Segmented
              options={[{ value: 'buy', label: 'Acquisto' }, { value: 'sell', label: 'Vendita' }]}
              value={type}
              onChange={v => { setType(v); form.clearErrors(); }}
              ariaLabel="Tipo di operazione"
              className="w-full [&>button]:flex-1"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="quantity" label="Quantità" inputMode="decimal" autoFocus />
              <TextField control={form.control} name="price" label="Prezzo unitario" inputMode="decimal" suffix={asset.currency} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="date" label="Data" type="date" max={todayInput()} />
              <TextField control={form.control} name="fees" label="Commissioni" inputMode="decimal" suffix={asset.currency} placeholder="0" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{type === 'buy' ? 'Totale da investire' : 'Incasso netto'}</span>
              <Money value={total} currency={asset.currency} className="font-semibold" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {type === 'buy' ? 'Registra acquisto' : 'Registra vendita'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
