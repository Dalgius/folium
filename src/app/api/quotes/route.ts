import { isValidSymbol, parseChartQuote, type Quote } from '@/lib/yahoo-chart';
import { fetchChart, mapLimit, parseSymbols } from '@/lib/yahoo-edge';

export const runtime = 'edge';

const MAX_SYMBOLS = 30;

/** GET /api/quotes?symbols=ISP.MI,AAPL → { quotes: { SIMBOLO: Quote }, errors: { SIMBOLO: motivo } } */
export async function GET(request: Request) {
  const symbols = parseSymbols(new URL(request.url).searchParams.get('symbols'), MAX_SYMBOLS).filter(isValidSymbol);
  const quotes: Record<string, Quote> = {};
  const errors: Record<string, string> = {};

  await mapLimit(symbols, 4, async symbol => {
    try {
      const quote = parseChartQuote(await fetchChart(symbol, { range: '5d', interval: '1d' }), symbol);
      if (quote) quotes[symbol] = quote;
      else errors[symbol] = 'Nessun prezzo nella risposta';
    } catch (error) {
      errors[symbol] = error instanceof Error ? error.message : String(error);
    }
  });

  if (Object.keys(errors).length) console.warn('Quotazioni non disponibili:', JSON.stringify(errors));

  const allFailed = symbols.length > 0 && Object.keys(quotes).length === 0;
  return Response.json(
    { quotes, errors },
    {
      // La CDN di Vercel riusa la risposta per un minuto: meno richieste a Yahoo
      headers: { 'Cache-Control': allFailed ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' },
    },
  );
}
