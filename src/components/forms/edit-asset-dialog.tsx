'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Asset, AssetClass } from '@/types';
import { isMarketAsset } from '@/lib/asset-types';
import { ASSET_CLASSES, classMeta, inferAssetClass } from '@/lib/asset-classes';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/forms/fields';
import { AccountForm } from '@/components/forms/account-form';

const securitySchema = z.object({
  name: z.string().trim().min(2, 'Inserisci un nome'),
  institution: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  assetClass: z.string(),
});

const AUTO = 'auto';

interface EditAssetDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (assetId: string, patch: Partial<Asset>) => Promise<boolean>;
}

export function EditAssetDialog({ asset, open, onOpenChange, onSubmit }: EditAssetDialogProps) {
  if (!asset) return null;
  const submit = async (patch: Partial<Asset>) => {
    const ok = await onSubmit(asset.id, patch);
    if (ok) onOpenChange(false);
    return ok;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifica dettagli</DialogTitle>
          <DialogDescription>{asset.name}</DialogDescription>
        </DialogHeader>
        {isMarketAsset(asset.type) ? (
          <SecurityDetailsForm asset={asset} open={open} onSubmit={submit} />
        ) : (
          <AccountForm
            key={asset.id}
            type={asset.type as 'Conto Bancario' | 'Conto Deposito' | 'Altro'}
            asset={asset}
            onSubmit={data => submit(data as Partial<Asset>)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SecurityDetailsForm({ asset, open, onSubmit }: { asset: Asset; open: boolean; onSubmit: (patch: Partial<Asset>) => Promise<boolean> }) {
  const form = useForm<z.infer<typeof securitySchema>>({ resolver: zodResolver(securitySchema) });

  useEffect(() => {
    if (open) form.reset({ name: asset.name, institution: asset.institution ?? '', notes: asset.notes ?? '', assetClass: asset.assetClass ?? AUTO });
  }, [open, asset, form]);

  const automatic = classMeta(inferAssetClass({ type: asset.type, name: form.watch('name') || asset.name })).label;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(v => onSubmit({
          name: v.name,
          institution: v.institution || undefined,
          notes: v.notes || undefined,
          assetClass: v.assetClass === AUTO ? undefined : (v.assetClass as AssetClass),
        }))}
        className="space-y-4"
      >
        <TextField control={form.control} name="name" label="Nome" />
        <TextField control={form.control} name="institution" label="Broker" placeholder="Es. Directa, Fineco, Scalable" />
        <FormField
          control={form.control}
          name="assetClass"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Classe di attivo</FormLabel>
              {/* Radix può segnalare un valore vuoto quando il form viene reimpostato: lo si ignora */}
              <Select onValueChange={v => v && field.onChange(v)} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue>
                      {field.value === AUTO ? `Automatica (${automatic})` : classMeta(field.value as AssetClass).label}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={AUTO}>Automatica ({automatic})</SelectItem>
                  {ASSET_CLASSES.filter(c => c !== 'altro').map(c => <SelectItem key={c} value={c}>{classMeta(c).label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormDescription>Serve per l&apos;allocazione per classe: azionario, obbligazionario, materie prime…</FormDescription>
            </FormItem>
          )}
        />
        <TextField control={form.control} name="notes" label="Note" placeholder="Es. PAC mensile" />
        <p className="text-xs text-muted-foreground">Quantità e prezzi si gestiscono dalle operazioni, nel dettaglio del titolo.</p>
        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting}>Salva modifiche</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
