'use client';

import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { useTheme } from 'next-themes';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, Eye, EyeOff, LogOut, Monitor, Moon, Plus, RefreshCw, Sun } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { usePrivacy } from '@/hooks/use-privacy';
import { FoliumLogo } from '@/components/folium-logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  refreshing: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onAdd: () => void;
  canRefresh: boolean;
  /** Titoli con prezzo non aggiornato */
  staleCount?: number;
}

export function AppHeader({ refreshing, lastRefresh, onRefresh, onAdd, canRefresh, staleCount = 0 }: AppHeaderProps) {
  const { user } = useAuth();
  const { hidden, toggle } = usePrivacy();
  const { theme, setTheme } = useTheme();
  const initial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png?v=2" alt="" width={32} height={32} priority />
          <FoliumLogo className="h-6 w-auto text-primary" aria-label="Folium" />
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {staleCount > 0 && !refreshing ? (
              <span
                role="status"
                className="mr-1 inline-flex items-center gap-1 rounded-full bg-cat-4/15 px-2 py-0.5 text-xs font-medium text-foreground"
                title={`${staleCount} ${staleCount === 1 ? 'titolo ha' : 'titoli hanno'} un prezzo non aggiornato`}
              >
                <Clock className="h-3.5 w-3.5 text-cat-4" aria-hidden />
                <span className="hidden sm:inline">{staleCount === 1 ? '1 prezzo non aggiornato' : `${staleCount} prezzi non aggiornati`}</span>
                <span className="sm:hidden">{staleCount}</span>
              </span>
            ) : lastRefresh ? (
              <span role="status" className="mr-1 text-xs text-muted-foreground">
                <span className="hidden md:inline">Aggiornato alle </span>
                {format(lastRefresh, 'HH:mm', { locale: it })}
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onRefresh} disabled={!canRefresh || refreshing} aria-label="Aggiorna quotazioni">
                  <RefreshCw className={cn(refreshing && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {refreshing
                  ? 'Aggiornamento in corso…'
                  : lastRefresh
                    ? `Aggiorna quotazioni (ultimo aggiornamento alle ${format(lastRefresh, 'HH:mm', { locale: it })})`
                    : 'Aggiorna quotazioni'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggle} aria-label={hidden ? 'Mostra importi' : 'Nascondi importi'} aria-pressed={hidden}>
                  {hidden ? <EyeOff /> : <Eye />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hidden ? 'Mostra importi' : 'Nascondi importi'}</TooltipContent>
            </Tooltip>

            <Button onClick={onAdd} className="ml-1 hidden sm:inline-flex">
              <Plus /> Aggiungi
            </Button>
            <Button onClick={onAdd} size="icon" className="sm:hidden" aria-label="Aggiungi">
              <Plus />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1 rounded-full" aria-label="Menu utente">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {initial}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs text-muted-foreground">Accesso effettuato come</p>
                  <p className="truncate text-sm font-medium">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" /> Chiaro</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" /> Scuro</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system"><Monitor className="mr-2 h-4 w-4" /> Sistema</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut(auth)}>
                  <LogOut className="mr-2 h-4 w-4" /> Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TooltipProvider>
      </div>
    </header>
  );
}
