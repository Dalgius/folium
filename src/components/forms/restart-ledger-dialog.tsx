'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import type { Asset, BalanceSnapshot } from '@/types';
import { notInFuture, parseAmount, requiredDate, requiredNumber, todayInput } from '@/lib/forms';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TextField } from '@/components/forms/fields';

const schema = z.object({
  value: requiredNumber(),
  date: requiredDate().refine(notInFuture, 'La data non può essere futura'),
});

type Values = z.infer<typeof schema>;

interface RestartLedgerDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (assetId: string, opening: BalanceSnapshot) => Promise<boolean>;
}

/** Riparte da un saldo iniziale: da lì in poi il saldo è la somma dei movimenti. */
export function RestartLedgerDialog({ asset, open, onOpenChange, onSubmit }: RestartLedgerDialogProps) {
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) form.reset({ value: '0', date: `${new Date().getFullYear()}-01-01` });
  }, [open, form]);

  if (!asset) return null;
  const saved = asset.balanceHistory?.length ?? 0;

  async function submit(v: Values) {
    const ok = await onSubmit(asset!.id, { date: v.date, value: parseAmount(v.value) });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ricomincia dai movimenti</DialogTitle>
          <DialogDescription>
            {asset.name}: da questa data il saldo sarà il saldo iniziale più le entrate e meno le uscite che registri.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="date" label="Dal giorno" type="date" max={todayInput()} />
              <TextField control={form.control} name="value" label="Saldo iniziale" inputMode="decimal" suffix={asset.currency} />
            </div>
            <p className="text-xs text-muted-foreground">
              0 € se registri tutto dall&apos;apertura del conto, oppure il saldo all&apos;inizio dell&apos;estratto conto da cui parti.
            </p>
            {saved > 1 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  I {saved} saldi registrati finora per questo conto verranno sostituiti dal saldo iniziale. I movimenti già inseriti restano.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>Imposta saldo iniziale</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
