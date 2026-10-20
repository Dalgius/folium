'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
  className?: string;
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Controllo a segmenti (filtri, periodi, modalità). Le frecce spostano la selezione, come in un radiogroup. */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', ariaLabel, className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex(o => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    if (e.key in STEP) next = (selectedIndex + STEP[e.key] + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1', className)}
    >
      {options.map((option, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={option.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (selectedIndex < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'shrink-0 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
