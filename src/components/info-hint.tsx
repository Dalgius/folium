'use client';

import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Icona (i) con una spiegazione breve, raggiungibile anche da tastiera.
 * Con il mouse si apre al passaggio; su smartphone un tocco la apre e la lascia aperta
 * finché non si tocca altrove o di nuovo l'icona (il Tooltip di Radix si chiuderebbe al tocco).
 */
export function InfoHint({ text, label = 'Cosa significa?', className }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  // Stato al momento del tocco: il tocco sull'icona chiude il fumetto prima del click
  const openAtPointerDown = useRef(false);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label} ${text}`}
            className={cn(
              'relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              // Area di tocco più ampia dell'icona
              'before:absolute before:-inset-3 before:content-[""]',
              className,
            )}
            onPointerDown={() => {
              openAtPointerDown.current = open;
            }}
            onClick={e => {
              e.stopPropagation();
              // Impedisce la chiusura automatica del Tooltip al click
              e.preventDefault();
              setOpen(!openAtPointerDown.current);
              openAtPointerDown.current = !openAtPointerDown.current;
            }}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent collisionPadding={12} className="max-w-[min(20rem,calc(100vw-24px))] text-xs leading-relaxed">
          {text}
        </TooltipContent>
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
  lockedInterest: 'Interessi netti stimati che i depositi vincolati renderanno alla scadenza, già al netto della ritenuta (capitalizzazione semplice, bollo escluso).',
  market: 'Quanto hanno guadagnato o perso i tuoi titoli nel periodo, senza contare acquisti e vendite.',
  savings: 'Il resto della variazione: soldi nuovi sui conti, interessi dei depositi, valore aggiornato degli altri beni. Gli acquisti di titoli spostano denaro e non contano.',
} as const;
