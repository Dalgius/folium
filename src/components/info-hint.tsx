'use client';

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Icona (i) con una spiegazione breve, raggiungibile anche da tastiera. */
export function InfoHint({ text, label = 'Cosa significa?', className }: { text: string; label?: string; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label} ${text}`}
            className={cn(
              'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
            onClick={e => e.stopPropagation()}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const HINTS = {
  unrealized: 'Guadagno o perdita sui titoli che possiedi ancora: valore attuale meno quanto hai pagato (prezzo medio di carico, commissioni incluse). Diventa reale solo vendendo.',
  realized: 'Guadagno o perdita già incassati con le vendite, calcolati sul prezzo medio di carico.',
  periodReturn: 'Quanto è cresciuto il valore nel periodo senza contare i soldi che hai aggiunto o tolto con acquisti e vendite.',
  invested: 'Soldi versati negli investimenti (acquisti meno incassi delle vendite) fino a quella data.',
  accrued: 'Stima degli interessi netti maturati finora sui conti deposito, già al netto della ritenuta. Non include il bollo dello 0,20%.',
  locked: 'Soldi nei conti deposito vincolati: non sono disponibili fino alla scadenza.',
  market: 'Quanto hanno guadagnato o perso i tuoi titoli nel periodo, senza contare acquisti e vendite.',
  savings: 'Il resto della variazione: soldi nuovi sui conti, interessi dei depositi, valore aggiornato degli altri beni. Gli acquisti di titoli spostano denaro e non contano.',
} as const;
