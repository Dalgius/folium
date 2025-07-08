
'use server';
import yahooFinance from 'yahoo-finance2';
import { AssetType } from '@/types';

export interface SearchResult {
  ticker: string;
  name: string | undefined;
  exchange: string;
  type: string;
}

// A more specific type for the quotes we are interested in from the search results.
interface EquityOrEtfQuote {
  symbol: string;
  longname?: string;
  shortname?: string;
  exchange: string;
  quoteType: 'EQUITY' | 'ETF';
  isYahooFinance: true;
}

// Type guard to check if a quote from yahooFinance.search is the type we want.
function isEquityOrEtf(quote: any): quote is EquityOrEtfQuote {
  return (
    quote &&
    quote.isYahooFinance === true &&
    (quote.quoteType === 'EQUITY' || quote.quoteType === 'ETF') &&
    typeof quote.symbol === 'string' &&
    !quote.symbol.includes('=')
  );
}


export async function searchSecurities(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }
  try {
    const results = await yahooFinance.search(query, { newsCount: 0 });
    
    // Use the type guard in the filter to ensure type safety
    return (results.quotes || [])
      .filter(isEquityOrEtf)
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
