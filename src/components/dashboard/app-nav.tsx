'use client';

import { ArrowLeftRight, LayoutDashboard, List, Settings } from 'lucide-react';
import type { Tab } from '@/hooks/use-tab';
import { cn } from '@/lib/utils';

const ITEMS: { tab: Tab; label: string; icon: typeof List }[] = [
  { tab: 'panoramica', label: 'Panoramica', icon: LayoutDashboard },
  { tab: 'posizioni', label: 'Posizioni', icon: List },
  { tab: 'movimenti', label: 'Movimenti', icon: ArrowLeftRight },
  { tab: 'impostazioni', label: 'Impostazioni', icon: Settings },
];

interface AppNavProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

/** Schede in alto su schermi larghi, barra in basso su mobile. */
export function AppNav({ tab, onChange }: AppNavProps) {
  const link = (item: (typeof ITEMS)[number], variant: 'top' | 'bottom') => {
    const active = item.tab === tab;
    const Icon = item.icon;
    return (
      <a
        key={item.tab}
        href={item.tab === 'panoramica' ? '#' : `#${item.tab}`}
        aria-current={active ? 'page' : undefined}
        onClick={e => {
          e.preventDefault();
          onChange(item.tab);
        }}
        className={cn(
          'flex items-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'top'
            ? cn('h-11 gap-2 border-b-2 px-1 text-sm', active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
            : cn('h-16 flex-1 flex-col justify-center gap-0.5 rounded-md text-[11px]', active ? 'text-primary' : 'text-muted-foreground'),
        )}
      >
        {variant === 'top' ? (
          <Icon className="h-4 w-4" aria-hidden />
        ) : (
          // Su mobile la voce attiva ha l'icona dentro una pillola, come nel mockup
          <span className={cn('flex h-7 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-accent')}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
        {item.label}
      </a>
    );
  };

  return (
    <>
      <nav aria-label="Sezioni" className="sticky top-16 z-20 hidden border-b bg-background sm:block">
        <div className="container mx-auto flex gap-6 px-4 sm:px-6 lg:px-8">{ITEMS.map(item => link(item, 'top'))}</div>
      </nav>
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden"
      >
        {ITEMS.map(item => link(item, 'bottom'))}
      </nav>
    </>
  );
}
