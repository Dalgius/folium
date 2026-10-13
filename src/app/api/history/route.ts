import type { PricePoint } from '@/lib/portfolio';
import { isValidSymbol, parseChartHistory } from '@/lib/yahoo-chart';
import { fetchChart, mapLimit, parseSymbols } from '@/lib/yahoo-edge';

export const runtime = 'edge';

const MAX_SYMBOLS = 30;

/** GET /api/history?symbols=ISP.MI,AAPL&start=2024-01-01 → { history: { SIMBOLO: PricePoint[] }, errors } */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const start = params.get('start') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return Response.json({ error: 'Parametro start non valido (yyyy-MM-dd)' }, { status: 400 });
  }
  const symbols = parseSymbols(params.get('symbols'), MAX_SYMBOLS).filter(isValidSymbol);
  const period1 = String(Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 1000));
  const period2 = String(Math.floor(Date.now() / 1000));

  const history: Record<string, PricePoint[]> = {};
  const errors: Record<string, string> = {};
  await mapLimit(symbols, 4, async symbol => {
    try {
      history[symbol] = parseChartHistory(await fetchChart(symbol, { period1, period2, interval: '1d' }));
    } catch (error) {
      history[symbol] = [];
      errors[symbol] = error instanceof Error ? error.message : String(error);
    }
  });

  if (Object.keys(errors).length) console.warn('Storico non disponibile:', JSON.stringify(errors));

  const allFailed = symbols.length > 0 && Object.keys(errors).length === symbols.length;
  return Response.json(
    { history, errors },
    { headers: { 'Cache-Control': allFailed ? 'no-store' : 'public, s-maxage=21600, stale-while-revalidate=86400' } },
  );
}
