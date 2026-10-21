'use client';

import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { useTheme } from 'next-themes';
import { format } from 'date-fns';
import { Download, FileJson, LogOut } from 'lucide-react';
import type { Asset } from '@/types';
import { auth } from '@/lib/firebase';
import { buildMovements, movementsToCsv } from '@/lib/movements';
import { useAuth } from '@/hooks/use-auth';
import { usePrivacy } from '@/hooks/use-privacy';
import { Segmented } from '@/components/segmented';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark' | 'system';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
  { value: 'system', label: 'Sistema' },
];

const AMOUNTS: { value: 'shown' | 'hidden'; label: string }[] = [
  { value: 'shown', label: 'Visibili' },
  { value: 'hidden', label: 'Nascosti' },
];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPanel({ assets }: { assets: Asset[] }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { hidden, toggle } = usePrivacy();
  const stamp = format(new Date(), 'yyyy-MM-dd');

  function exportJson() {
    const data = assets.map(({ userId: _userId, ...asset }) => asset);
    download(`folium-backup-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), assets: data }, null, 2), 'application/json');
  }

  function exportCsv() {
    // BOM iniziale: Excel riconosce l'UTF-8 (accenti e simbolo dell'euro)
    download(`folium-movimenti-${stamp}.csv`, '﻿' + movementsToCsv(buildMovements(assets)), 'text/csv;charset=utf-8');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Section title="Account">
        <Row label="Accesso effettuato come" description={user?.email ?? '—'}>
          <Button variant="outline" onClick={() => signOut(auth)}>
            <LogOut /> Esci
          </Button>
        </Row>
      </Section>

      <Section title="Aspetto">
        <Row label="Tema" description="«Sistema» segue l'impostazione del dispositivo.">
          <Segmented options={THEMES} value={(theme as Theme) ?? 'system'} onChange={setTheme} ariaLabel="Tema" />
        </Row>
        <Row label="Importi" description="Nascondili quando usi l'app in pubblico o condividi lo schermo. Puoi farlo anche con l'icona a forma di occhio in alto.">
          <Segmented options={AMOUNTS} value={hidden ? 'hidden' : 'shown'} onChange={v => (v === 'hidden') !== hidden && toggle()} ariaLabel="Importi" />
        </Row>
      </Section>

      <Section title="Dati">
        <Row label="Movimenti in CSV" description="Acquisti, vendite e saldi, da aprire con Excel o Numbers.">
          <Button variant="outline" onClick={exportCsv} disabled={!assets.length}>
            <Download /> Scarica CSV
          </Button>
        </Row>
        <Row label="Backup completo" description="Tutti gli asset con operazioni e saldi, in formato JSON.">
          <Button variant="outline" onClick={exportJson} disabled={!assets.length}>
            <FileJson /> Scarica JSON
          </Button>
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="border-b px-5 py-3 text-base font-semibold">{title}</h2>
      <div className="divide-y">{children}</div>
    </Card>
  );
}

function Row({ label, description, children }: { label: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
