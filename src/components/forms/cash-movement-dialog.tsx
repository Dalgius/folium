'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Asset, CashMovement } from '@/types';
import { dayKey, latestBalance } from '@/lib/portfolio';
import { notInFuture, parseDecimal, requiredDate, requiredNumber, toInput, todayInput } from '@/lib/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/fields';
import { Segmented } from '@/components/segmented';
import { Money } from '@/components/money';

const schema = z.object({
  amount: requiredNumber({ positive: true }),
  date: requiredDate().refine(notInFuture, 'La data non può essere futura'),
  description: z.string().trim().max(120, 'Al massimo 120 caratteri').optional(),
});

type Values = z.infer<typeof schema>;
type Direction = 'out' | 'in';

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'out', label: 'Uscita' },
  { value: 'in', label: 'Entrata' },
];

interface CashMovementDialogProps {
  asset: Asset | null;
  /** Movimento da modificare; se manca se ne crea uno nuovo */
  movement?: CashMovement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (assetId: string, movement: Omit<CashMovement, 'id' | 'createdAt'>, movementId?: string) => Promise<boolean>;
}

export function CashMovementDialog({ asset, movement, open, onOpenChange, onSubmit }: CashMovementDialogProps) {
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const [direction, setDirection] = useState<Direction>('out');

  useEffect(() => {
    if (!open) return;
    if (movement) {
      setDirection(movement.amount >= 0 ? 'in' : 'out');
      form.reset({ amount: toInput(Math.abs(movement.amount), 2), date: dayKey(movement.date) ?? todayInput(), description: movement.description ?? '' });
    } else {
      setDirection('out');
      form.reset({ amount: '', date: todayInput(), description: '' });
    }
  }, [open, movement, form]);

  if (!asset) return null;

  async function submit(v: Values) {
    const value = parseDecimal(v.amount);
    const ok = await onSubmit(
      asset!.id,
      { date: v.date, amount: direction === 'in' ? value : -value, description: v.description || undefined },
      movement?.id,
    );
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{movement ? 'Modifica movimento' : 'Nuovo movimento'}</DialogTitle>
          <DialogDescription>
            {asset.name} · saldo attuale <Money value={latestBalance(asset)} currency={asset.currency} />
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <Segmented options={DIRECTIONS} value={direction} onChange={setDirection} ariaLabel="Tipo di movimento" className="w-full [&>button]:flex-1" />
            <TextField control={form.control} name="amount" label="Importo" inputMode="decimal" suffix={asset.currency} placeholder="0,00" autoFocus />
            <TextField control={form.control} name="description" label="Descrizione (facoltativa)" placeholder="Es. stipendio, bolletta luce" />
            <TextField
              control={form.control}
              name="date"
              label="Data"
              type="date"
              max={todayInput()}
              description="Il saldo del conto si aggiorna da solo. Se poi registri il saldo della banca, i movimenti precedenti risultano già compresi."
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>{movement ? 'Salva' : direction === 'in' ? 'Registra entrata' : 'Registra uscita'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
