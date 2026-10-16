import type { PricePoint } from '@/lib/portfolio';
import { isValidSymbol, parseChartHistory } from '@/lib/yahoo-chart';
import { fetchChart, mapLimit, parseSymbols } from '@/lib/yahoo-edge';

export const runtime = 'edge';

const MAX_SYMBOLS = 30;

const RANGES = new Set(['1d', '5d']);
const INTERVALS = new Set(['5m', '15m', '30m', '1h', '1d']);

/**
 * GET /api/history?symbols=ISP.MI,AAPL&start=2024-01-01            → chiusure giornaliere
 * GET /api/history?symbols=ISP.MI,AAPL&range=1d&interval=5m         → dati infragiornalieri
 * Risposta: { history: { SIMBOLO: PricePoint[] }, errors }
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const interval = params.get('interval') ?? '1d';
  const range = params.get('range');
  if (!INTERVALS.has(interval)) {
    return Response.json({ error: 'Parametro interval non valido' }, { status: 400 });
  }

  let chartParams: Record<string, string>;
  if (range) {
    if (!RANGES.has(range)) return Response.json({ error: 'Parametro range non valido' }, { status: 400 });
    chartParams = { range, interval };
  } else {
    const start = params.get('start') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return Response.json({ error: 'Parametro start non valido (yyyy-MM-dd)' }, { status: 400 });
    }
    chartParams = {
      period1: String(Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 1000)),
      period2: String(Math.floor(Date.now() / 1000)),
      interval,
    };
  }
  const intraday = interval !== '1d';
  const symbols = parseSymbols(params.get('symbols'), MAX_SYMBOLS).filter(isValidSymbol);

  const history: Record<string, PricePoint[]> = {};
  const errors: Record<string, string> = {};
  await mapLimit(symbols, 4, async symbol => {
    try {
      history[symbol] = parseChartHistory(await fetchChart(symbol, chartParams), { intraday });
    } catch (error) {
      history[symbol] = [];
      errors[symbol] = error instanceof Error ? error.message : String(error);
    }
  });

  if (Object.keys(errors).length) console.warn('Storico non disponibile:', JSON.stringify(errors));

  const allFailed = symbols.length > 0 && Object.keys(errors).length === symbols.length;
  return Response.json(
    { history, errors },
    {
      headers: {
        'Cache-Control': allFailed
          ? 'no-store'
          : intraday
            ? 'public, s-maxage=120, stale-while-revalidate=300'
            : 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    },
  );
}
