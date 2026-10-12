import { z } from 'zod';
import { format } from 'date-fns';

/** Interpreta un numero scritto all'italiana ("1.234,56") o con il punto ("1234.56"). */
export function parseDecimal(value: string | number | undefined | null): number {
  if (typeof value === 'number') return value;
  if (!value) return NaN;
  let s = value.trim().replace(/\s|€|\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return s === '' ? NaN : Number(s);
}

/** Numero come stringa nel formato italiano, per precompilare i campi. */
export function toInput(value: number | undefined | null, maxDigits = 6): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return value.toLocaleString('it-IT', { maximumFractionDigits: maxDigits, useGrouping: false });
}

export const todayInput = () => format(new Date(), 'yyyy-MM-dd');

export const requiredNumber = (opts: { min?: number; positive?: boolean; max?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, 'Campo obbligatorio')
    .refine(v => !Number.isNaN(parseDecimal(v)), 'Inserisci un numero valido')
    .refine(v => !opts.positive || parseDecimal(v) > 0, 'Deve essere maggiore di zero')
    .refine(v => opts.min === undefined || parseDecimal(v) >= opts.min, `Deve essere almeno ${opts.min}`)
    .refine(v => opts.max === undefined || parseDecimal(v) <= opts.max, `Deve essere al massimo ${opts.max}`);

export const optionalNumber = (opts: { min?: number; max?: number } = {}) =>
  z
    .string()
    .trim()
    .optional()
    .refine(v => !v || !Number.isNaN(parseDecimal(v)), 'Inserisci un numero valido')
    .refine(v => !v || opts.min === undefined || parseDecimal(v) >= opts.min, `Deve essere almeno ${opts.min}`)
    .refine(v => !v || opts.max === undefined || parseDecimal(v) <= opts.max, `Deve essere al massimo ${opts.max}`);

export const optionalNumberValue = (v: string | undefined) => (v ? parseDecimal(v) : undefined);

export const requiredDate = (label = 'una data') =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `Inserisci ${label}`);

export const notInFuture = (v: string) => v <= todayInput();
