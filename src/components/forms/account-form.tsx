'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Asset, AssetType, NewAsset } from '@/types';
import { DEFAULT_TAX_RATE } from '@/lib/portfolio';
import {
  notInFuture,
  optionalNumber,
  optionalNumberValue,
  parseDecimal,
  requiredDate,
  requiredNumber,
  toInput,
  todayInput,
} from '@/lib/forms';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { CurrencyField, TextField } from '@/components/forms/fields';

type ManualType = Extract<AssetType, 'Conto Bancario' | 'Conto Deposito' | 'Altro'>;

const schema = z
  .object({
    name: z.string().trim().min(2, 'Inserisci un nome'),
    institution: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    currency: z.string().min(3),
    balance: z.string().optional(),
    balanceDate: z.string().optional(),
    interestRate: optionalNumber({ min: 0, max: 100 }),
    taxRate: optionalNumber({ min: 0, max: 100 }),
    startDate: z.string().optional(),
    maturityDate: z.string().optional(),
  });

type Values = z.infer<typeof schema>;

const PLACEHOLDERS: Record<ManualType, { name: string; institution: string }> = {
  'Conto Bancario': { name: 'Es. Conto principale', institution: 'Es. Intesa Sanpaolo' },
  'Conto Deposito': { name: 'Es. Deposito vincolato 12 mesi', institution: 'Es. Banca Ifis' },
  Altro: { name: 'Es. Fondo pensione, TFR, immobile…', institution: 'Es. Fondo Cometa' },
};

interface AccountFormProps {
  type: ManualType;
  /** Se presente, il form modifica l'asset (il saldo si aggiorna dal dialog dedicato) */
  asset?: Asset;
  onSubmit: (data: NewAsset | Partial<Asset>) => Promise<boolean>;
  onBack?: () => void;
}

export function AccountForm({ type, asset, onSubmit, onBack }: AccountFormProps) {
  const isEdit = !!asset;
  const isDeposit = type === 'Conto Deposito';

  const refined = schema.superRefine((v, ctx) => {
    if (!isEdit) {
      const balance = requiredNumber({ min: 0 }).safeParse(v.balance ?? '');
      if (!balance.success) ctx.addIssue({ code: 'custom', path: ['balance'], message: balance.error.issues[0].message });
      if (!v.balanceDate || !requiredDate().safeParse(v.balanceDate).success) ctx.addIssue({ code: 'custom', path: ['balanceDate'], message: 'Inserisci una data' });
      else if (!notInFuture(v.balanceDate)) ctx.addIssue({ code: 'custom', path: ['balanceDate'], message: 'La data non può essere futura' });
    }
    if (isDeposit) {
      if (!v.interestRate) ctx.addIssue({ code: 'custom', path: ['interestRate'], message: 'Inserisci il tasso' });
      if (!v.startDate) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Inserisci la data di apertura' });
      if (v.startDate && v.maturityDate && v.maturityDate <= v.startDate) {
        ctx.addIssue({ code: 'custom', path: ['maturityDate'], message: 'La scadenza deve seguire la data di apertura' });
      }
    }
  });

  const form = useForm<Values>({
    resolver: zodResolver(refined),
    defaultValues: {
      name: asset?.name ?? '',
      institution: asset?.institution ?? '',
      notes: asset?.notes ?? '',
      currency: asset?.currency ?? 'EUR',
      balance: '',
      balanceDate: todayInput(),
      interestRate: toInput(asset?.interestRate),
      taxRate: toInput(asset?.taxRate ?? DEFAULT_TAX_RATE),
      startDate: asset?.startDate?.slice(0, 10) ?? todayInput(),
      maturityDate: asset?.maturityDate?.slice(0, 10) ?? '',
    },
  });

  async function submit(v: Values) {
    const details: Partial<Asset> = {
      name: v.name,
      institution: v.institution || undefined,
      notes: v.notes || undefined,
    };
    if (isDeposit) {
      details.interestRate = optionalNumberValue(v.interestRate);
      details.taxRate = optionalNumberValue(v.taxRate) ?? DEFAULT_TAX_RATE;
      details.startDate = v.startDate || undefined;
      details.maturityDate = v.maturityDate || undefined;
    }

    if (isEdit) {
      await onSubmit(details);
      return;
    }

    const balance = parseDecimal(v.balance);
    const created: NewAsset = {
      ...details,
      name: v.name,
      type,
      currency: v.currency,
      balanceHistory: [{ date: v.balanceDate!, value: balance }],
      initialValue: balance,
      currentValue: balance,
    };
    await onSubmit(created);
  }

  const placeholders = PLACEHOLDERS[type];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <TextField control={form.control} name="name" label="Nome" placeholder={placeholders.name} autoFocus={!isEdit} />
        <TextField control={form.control} name="institution" label={type === 'Altro' ? 'Gestore (facoltativo)' : 'Banca (facoltativo)'} placeholder={placeholders.institution} />

        {!isEdit && (
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <TextField control={form.control} name="balance" label={isDeposit ? 'Capitale depositato' : type === 'Altro' ? 'Valore attuale' : 'Saldo attuale'} inputMode="decimal" placeholder="0,00" />
            <CurrencyField control={form.control} name="currency" label="Valuta" />
          </div>
        )}
        {!isEdit && (
          <TextField control={form.control} name="balanceDate" label="Data del saldo" type="date" max={todayInput()} />
        )}

        {isDeposit && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="interestRate" label="Tasso lordo annuo" inputMode="decimal" suffix="%" placeholder="3,50" />
              <TextField control={form.control} name="taxRate" label="Ritenuta" inputMode="decimal" suffix="%" description="26% per i conti deposito" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="startDate" label="Data di apertura" type="date" />
              <TextField control={form.control} name="maturityDate" label="Scadenza vincolo" type="date" description="Vuoto se libero" />
            </div>
          </>
        )}

        {type === 'Altro' && <TextField control={form.control} name="notes" label="Note (facoltative)" placeholder="Es. valore stimato a fine anno" />}

        <DialogFooter className="gap-2 pt-2 sm:gap-0">
          {onBack && <Button type="button" variant="ghost" onClick={onBack}>Indietro</Button>}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {isEdit ? 'Salva modifiche' : 'Aggiungi'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
