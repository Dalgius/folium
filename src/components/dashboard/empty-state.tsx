'use client';

import Image from 'next/image';
import type { AssetType } from '@/types';
import type { AddKind } from '@/components/forms/add-asset-dialog';
import { AssetBadge } from '@/components/asset-icons';
import { Card } from '@/components/ui/card';

const STEPS: { kind: AddKind; badge: AssetType; title: string; text: string }[] = [
  { kind: 'Conto Bancario', badge: 'Conto Bancario', title: 'Aggiungi un conto corrente', text: 'Parti dalla liquidità che hai in banca.' },
  { kind: 'Conto Deposito', badge: 'Conto Deposito', title: 'Aggiungi un conto deposito', text: 'Tieni d’occhio tassi, interessi e scadenze.' },
  { kind: 'security', badge: 'ETF', title: 'Aggiungi un investimento', text: 'ETF, azioni, fondi e crypto con prezzi aggiornati.' },
];

export function EmptyState({ onAdd }: { onAdd: (kind: AddKind) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center px-6 pb-8 pt-10 text-center">
        <Image src="/logo.png?v=2" alt="" width={56} height={56} />
        <h2 className="mt-4 text-xl font-semibold">Benvenuto in Folium</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Raccogli in un unico posto conti, depositi e investimenti per vedere quanto vale davvero il tuo patrimonio e come cresce nel tempo.
        </p>
      </div>
      <div className="grid gap-px border-t bg-border sm:grid-cols-3">
        {STEPS.map(step => (
          <button
            key={step.kind}
            type="button"
            onClick={() => onAdd(step.kind)}
            className="flex items-start gap-3 bg-card p-5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <AssetBadge type={step.badge} size="lg" />
            <span>
              <span className="block font-medium">{step.title}</span>
              <span className="block text-sm text-muted-foreground">{step.text}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="border-t px-5 py-3 text-center text-sm text-muted-foreground">
        Investi con Directa?{' '}
        <button type="button" onClick={() => onAdd('import')} className="font-medium text-primary hover:underline">
          Importa il portafoglio dal file CSV
        </button>
      </div>
    </Card>
  );
}
