import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Currency } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: Currency = 'EUR') {
  let locale;
  // Simple check for common currencies
  switch (currency.toUpperCase()) {
      case 'EUR':
          locale = 'it-IT';
          break;
      case 'USD':
          locale = 'en-US';
          break;
      case 'GBP':
          locale = 'en-GB';
          break;
      case 'JPY':
          locale = 'ja-JP';
          break;
      default:
          locale = 'en-US'; // Fallback locale
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    // Fallback for unsupported currencies
    return `${amount.toFixed(2)} ${currency}`;
  }
}
