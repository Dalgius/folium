
'use server';
import yahooFinance from 'yahoo-finance2';
import { AssetType, type Currency } from '@/types';

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
    
    // Use flatMap to filter and map in one step, which can be more robust for type inference.
    return (results.quotes || []).flatMap((q): SearchResult[] => {
      if (isEquityOrEtf(q)) {
        return [{
          ticker: q.symbol,
          name: q.longname || q.shortname,
          exchange: q.exchange,
          type: q.quoteType
        }];
      }
      return [];
    });
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

export async function getExchangeRate(from: Currency, to: Currency): Promise<number | null> {
    if (from === to) return 1;
    try {
        const ticker = `${from}${to}=X`;
        const result = await yahooFinance.quote(ticker);
        if (result && result.regularMarketPrice) {
            return result.regularMarketPrice;
        }
        console.warn(`Could not find exchange rate for ticker: ${ticker}`);
        return null;
    } catch (error) {
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
             console.warn(`Exchange rate not found for ${from} to ${to} (ticker: ${ticker})`);
        } else {
            console.error(`Error getting exchange rate for ${from} to ${to}:`, error);
        }
        return null;
    }
}

export interface HistoricalDataPoint {
  date: Date;
  close: number;
}

export async function getHistoricalData(ticker: string, startDate: string): Promise<HistoricalDataPoint[]> {
  try {
    const results = await yahooFinance.historical(ticker, {
      period1: startDate,
      interval: '1d'
    });
    return results.map(r => ({ date: r.date, close: r.close! })).filter(r => r.close);
  } catch (error) {
    console.warn(`Dati storici non trovati per ${ticker}. Potrebbe essere un ticker non valido o delistato.`, error);
    return [];
  }
}
