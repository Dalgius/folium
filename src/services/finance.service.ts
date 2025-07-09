
'use server';
import yahooFinance from 'yahoo-finance2';
import { AssetType, type Currency } from '@/types';

export interface SearchResult {
  ticker: string;
  name: string | undefined;
  exchange: string;
  type: string;
}

interface EquityOrEtfQuote {
  symbol: string;
  longname?: string;
  shortname?: string;
  exchange: string;
  quoteType: 'EQUITY' | 'ETF';
  isYahooFinance: true;
}

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
    return [];
  }
}

export interface Quote {
    price: number;
    currency: string;
    name: string;
    dailyChange?: number;
    dailyChangePercent?: number; // Should be a decimal, e.g., 0.025 for 2.5%
}

function normalizePercentage(value: number | undefined): number | undefined {
    if (value === undefined || value === null) return undefined;
    if (value === 0) return 0;
    
    // Yahoo can return 2.5 (for 2.5%) or 0.025 (also for 2.5%).
    // This ensures we always return a decimal representation (e.g., 0.025).
    return Math.abs(value) > 1 ? value / 100 : value;
}

function getPreviousTradingDay(): string {
    const date = new Date();
    const dayOfWeek = date.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    let daysToSubtract = 1; // Default for Tue-Fri
    if (dayOfWeek === 0) { // Sunday
        daysToSubtract = 2;
    } else if (dayOfWeek === 1) { // Monday
        daysToSubtract = 3;
    } else if (dayOfWeek === 6) { // Saturday
        daysToSubtract = 1;
    }
    date.setDate(date.getDate() - daysToSubtract);
    return date.toISOString().split('T')[0];
}

async function getQuoteViaQuoteEndpoint(ticker: string): Promise<Quote | null> {
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

        let dailyChange: number | undefined;
        let dailyChangePercent: number | undefined;

        // Method 1: Calculate from previous close (most reliable)
        if (result.regularMarketPreviousClose && result.regularMarketPreviousClose > 0) {
            dailyChange = price - result.regularMarketPreviousClose;
            dailyChangePercent = (dailyChange / result.regularMarketPreviousClose);
        }
        // Method 2: Use pre-calculated values as a fallback
        else if (result.regularMarketChange !== undefined && result.regularMarketChangePercent !== undefined) {
            dailyChange = result.regularMarketChange;
            dailyChangePercent = normalizePercentage(result.regularMarketChangePercent);
        }
        // Method 3: Fallback to historical data
        else {
            try {
                const historical = await getHistoricalData(ticker, getPreviousTradingDay());
                if (historical.length > 0) {
                    const lastClose = historical[historical.length - 1].close;
                    dailyChange = price - lastClose;
                    dailyChangePercent = lastClose > 0 ? (dailyChange / lastClose) : 0;
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
            console.warn(`(Primary) Ticker not found: ${ticker}`);
        } else {
            console.error(`(Primary) Error getting quote for ${ticker}:`, error);
        }
        return null;
    }
}

async function getQuoteViaSummaryEndpoint(ticker: string): Promise<Quote | null> {
    try {
        const result = await yahooFinance.quoteSummary(ticker, {
            modules: ['price']
        });
        
        const priceData = result.price;
        if (!priceData || !priceData.regularMarketPrice || !priceData.currency) {
            return null;
        }
        
        return {
            price: priceData.regularMarketPrice,
            currency: priceData.currency,
            name: priceData.longName || priceData.shortName || ticker,
            dailyChange: priceData.regularMarketChange,
            dailyChangePercent: normalizePercentage(priceData.regularMarketChangePercent),
        };
    } catch (error) {
        console.error(`Alternative quote method failed for ${ticker}:`, error);
        return null;
    }
}

function validateQuoteData(quote: Quote): boolean {
    const isValid =
        quote.price > 0 &&
        quote.currency &&
        quote.currency.length === 3 &&
        quote.name &&
        quote.name.length > 0;
    return isValid;
}

export async function getQuote(ticker: string): Promise<Quote | null> {
    if (!ticker || ticker.trim().length === 0) {
        console.warn('Invalid ticker provided');
        return null;
    }
    
    const cleanTicker = ticker.trim().toUpperCase();
    
    const primaryQuote = await getQuoteViaQuoteEndpoint(cleanTicker);
    if (primaryQuote && validateQuoteData(primaryQuote)) {
        return primaryQuote;
    }
    
    console.warn(`Primary quote method failed for ${cleanTicker}, trying alternative.`);
    const secondaryQuote = await getQuoteViaSummaryEndpoint(cleanTicker);
    
    if (secondaryQuote && validateQuoteData(secondaryQuote)) {
        return secondaryQuote;
    }
    
    console.error(`All quote methods failed for ${cleanTicker}`);
    return null;
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
