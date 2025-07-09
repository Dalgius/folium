
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
    dailyChange?: number;
    dailyChangePercent?: number;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
    if (!ticker) return null;
    
    try {
        const result = await yahooFinance.quote(ticker, { fields: [
            'regularMarketPrice', 
            'currency',
            'longName',
            'shortName',
            'regularMarketPreviousClose',
            'regularMarketChange',
            'regularMarketChangePercent',
            'marketState'
        ]});
        
        if (!result || !result.regularMarketPrice || !result.currency) {
            console.warn(`Incomplete quote data for ${ticker}`, result);
            return null;
        }
        
        const name = result.longName || result.shortName || ticker;
        const price = result.regularMarketPrice;
        const currency = result.currency;

        // Initialize change variables
        let dailyChange: number | undefined;
        let dailyChangePercent: number | undefined;

        // Method 1: Use pre-calculated values if market is open
        if (result.regularMarketChange !== undefined && result.regularMarketChangePercent !== undefined) {
            dailyChange = result.regularMarketChange;
            // Handle both decimal (0.05) and percentage (5) formats
            dailyChangePercent = Math.abs(result.regularMarketChangePercent) < 1 
                ? result.regularMarketChangePercent * 100 
                : result.regularMarketChangePercent;
        }
        // Method 2: Calculate from previous close if available
        else if (result.regularMarketPreviousClose !== undefined && result.regularMarketPreviousClose > 0) {
            dailyChange = price - result.regularMarketPreviousClose;
            dailyChangePercent = (dailyChange / result.regularMarketPreviousClose) * 100;
        }
        // Method 3: Fallback to historical data
        else {
            try {
                const historical = await getHistoricalData(ticker, getPreviousTradingDay());
                if (historical.length > 0) {
                    const lastClose = historical[historical.length - 1].close;
                    dailyChange = price - lastClose;
                    dailyChangePercent = (dailyChange / lastClose) * 100;
                }
            } catch (histError) {
                console.warn(`Historical data fallback failed for ${ticker}`, histError);
            }
        }

        return {
            price,
            currency,
            name,
            dailyChange,
            dailyChangePercent,
        };

    } catch (error) {
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
            console.warn(`Ticker not found: ${ticker}`);
        } else {
            console.error(`Error getting quote for ${ticker}:`, error);
        }
        return null;
    }
}


export async function getExchangeRate(from: Currency, to: Currency): Promise<number | null> {
    if (from === to) return 1;
    const ticker = `${from}${to}=X`;
    try {
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


// Helper function to get previous trading day date string
function getPreviousTradingDay(): string {
    const date = new Date();
    // If today is Sunday(0), go back to Friday (subtract 2 days)
    // If today is Saturday(6), go back to Friday (subtract 1 day)
    // If today is Monday(1), go back to Friday (subtract 3 days)
    const dayOfWeek = date.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    let daysToSubtract = 1; // Default for Tue-Fri
    if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2;
    } else if (dayOfWeek === 6) { // Saturday
        daysToSubtract = 1;
    } else if (dayOfWeek === 1) { // Monday
        daysToSubtract = 3;
    }
    date.setDate(date.getDate() - daysToSubtract);
    return date.toISOString().split('T')[0];
}
