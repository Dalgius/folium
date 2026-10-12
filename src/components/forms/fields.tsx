'use client';

import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: ReactNode;
  className?: string;
}

export function TextField<T extends FieldValues>({
  control, name, label, description, className, placeholder, suffix, type = 'text', inputMode, max, autoFocus,
}: FieldProps<T> & {
  placeholder?: string;
  suffix?: string;
  type?: 'text' | 'date';
  inputMode?: 'decimal' | 'text';
  max?: string;
  autoFocus?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                type={type}
                inputMode={inputMode}
                placeholder={placeholder}
                max={max}
                autoFocus={autoFocus}
                autoComplete="off"
                className={cn(suffix && 'pr-12', inputMode === 'decimal' && 'tabular')}
              />
            </FormControl>
            {suffix && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>
            )}
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK'];

export function CurrencyField<T extends FieldValues>({ control, name, label, className, disabled }: FieldProps<T> & { disabled?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Valuta" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
