'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, FileUp } from 'lucide-react';
import type { Asset, AssetType, NewAsset } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AssetBadge } from '@/components/asset-icons';
import { SecurityForm } from '@/components/forms/security-form';
import { AccountForm } from '@/components/forms/account-form';
import { ImportDirecta, type ImportItem } from '@/components/forms/import-directa';
import { cn } from '@/lib/utils';

export type AddKind = 'security' | 'Conto Bancario' | 'Conto Deposito' | 'Altro' | 'import';

const OPTIONS: { kind: AddKind; badge: AssetType; title: string; description: string }[] = [
  { kind: 'Conto Bancario', badge: 'Conto Bancario', title: 'Conto corrente', description: 'Saldo di un conto bancario o carta' },
  { kind: 'Conto Deposito', badge: 'Conto Deposito', title: 'Conto deposito', description: 'Libero o vincolato, con calcolo degli interessi' },
  { kind: 'security', badge: 'ETF', title: 'Titolo quotato', description: 'Azioni, ETF, fondi e crypto con prezzi aggiornati' },
  { kind: 'Altro', badge: 'Altro', title: 'Altro bene', description: 'Fondo pensione, TFR, immobili… a valore manuale' },
];

const TITLES: Record<AddKind, string> = {
  security: 'Aggiungi un titolo',
  'Conto Bancario': 'Nuovo conto corrente',
  'Conto Deposito': 'Nuovo conto deposito',
  Altro: 'Nuovo bene',
  import: 'Importa da Directa',
};

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: AddKind | null;
  assets: Asset[];
  onCreate: (data: NewAsset) => Promise<boolean>;
  onImport: (items: ImportItem[]) => Promise<boolean>;
}

export function AddAssetDialog({ open, onOpenChange, initialKind, assets, onCreate, onImport }: AddAssetDialogProps) {
  const [kind, setKind] = useState<AddKind | null>(initialKind ?? null);

  useEffect(() => {
    if (open) setKind(initialKind ?? null);
  }, [open, initialKind]);

  const submit = async (data: NewAsset) => {
    const ok = await onCreate(data);
    if (ok) onOpenChange(false);
    return ok;
  };
  const back = initialKind ? undefined : () => setKind(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[92vh] overflow-y-auto', kind === 'import' ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{kind ? TITLES[kind] : 'Cosa vuoi aggiungere?'}</DialogTitle>
          {!kind && <DialogDescription>Scegli il tipo di conto o investimento da monitorare.</DialogDescription>}
        </DialogHeader>

        {!kind && (
          <div className="grid gap-2 pt-1">
            {OPTIONS.map(o => (
              <button
                key={o.kind}
                type="button"
                onClick={() => setKind(o.kind)}
                className="group flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <AssetBadge type={o.badge} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{o.title}</span>
                  <span className="block text-sm text-muted-foreground">{o.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setKind('import')}
              className="group mt-1 flex items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FileUp className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Importa da Directa</span>
                <span className="block text-sm text-muted-foreground">Carica il CSV del portafoglio e aggiungi tutti i titoli insieme</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        {kind === 'security' && <SecurityForm assets={assets} onSubmit={submit} onBack={back} />}
        {kind === 'import' && (
          <ImportDirecta
            assets={assets}
            onBack={back}
            onImport={async items => {
              const ok = await onImport(items);
              if (ok) onOpenChange(false);
              return ok;
            }}
          />
        )}
        {kind && kind !== 'security' && kind !== 'import' && (
          <AccountForm key={kind} type={kind} onSubmit={data => submit(data as NewAsset)} onBack={back} />
        )}
      </DialogContent>
    </Dialog>
  );
}
