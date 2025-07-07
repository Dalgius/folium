
'use server';
import yahooFinance from 'yahoo-finance2';
import { AssetType } from '@/types';

export interface SearchResult {
  ticker: string;
  name: string | undefined;
  exchange: string;
  type: string;
}

export async function searchSecurities(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }
  try {
    const results = await yahooFinance.search(query, { newsCount: 0 });
    return (results.quotes || [])
      .filter(q => q.isYahooFinance && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && q.symbol && !q.symbol.includes('='))
      .map(q => ({
        ticker: q.symbol,
        name: q.longname || q.shortname,
        exchange: q.exchange,
        type: q.quoteType
      }));
  } catch (error) {
    console.error('Error searching securities:', error);
    // This can happen for various reasons, like network issues or API changes.
    // Returning an empty array is a safe fallback.
    return [];
  }
}

export interface Quote {
    price: number;
    currency: string;
    name: string;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
    if (!ticker) return null;
    try {
        const result = await yahooFinance.quote(ticker);
        if (result && result.regularMarketPrice && result.currency && (result.longName || result.shortName)) {
            return {
                price: result.regularMarketPrice,
                currency: result.currency,
                name: result.longName || result.shortName || ticker,
            };
        }
        return null;
    } catch (error) {
        console.error(`Error getting quote for ${ticker}:`, error);
        return null;
    }
}
