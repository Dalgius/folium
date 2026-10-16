import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseChartHistory, parseChartQuote } from './yahoo-chart';
import { GET as quotesRoute } from '@/app/api/quotes/route';
import { GET as historyRoute } from '@/app/api/history/route';

const day = (d: string) => Math.floor(new Date(`${d}T08:00:00Z`).getTime() / 1000);

function chart(symbol: string, opts: { currency?: string; price?: number; closes?: number[]; days?: string[]; type?: string } = {}) {
  const days = opts.days ?? ['2026-10-09', '2026-10-12', '2026-10-13'];
  const closes = opts.closes ?? [6.1, 6.18, 6.23];
  return {
    chart: {
      error: null,
      result: [{
        meta: {
          symbol,
          currency: opts.currency ?? 'EUR',
          regularMarketPrice: opts.price ?? closes[closes.length - 1],
          regularMarketTime: day(days[days.length - 1]) + 3600,
          chartPreviousClose: 5.9,
          longName: `${symbol} Inc.`,
          instrumentType: opts.type ?? 'EQUITY',
        },
        timestamp: days.map(day),
        indicators: { quote: [{ close: closes }] },
      }],
    },
  };
}

describe('parseChartQuote', () => {
  it('calcola la variazione sulla chiusura precedente', () => {
    const q = parseChartQuote(chart('ISP.MI'), 'ISP.MI')!;
    expect(q.price).toBe(6.23);
    expect(q.currency).toBe('EUR');
    expect(q.dailyChange).toBeCloseTo(0.05);
    expect(q.dailyChangePercent).toBeCloseTo(0.05 / 6.18);
    expect(q.quoteType).toBe('EQUITY');
    expect(q.name).toBe('ISP.MI Inc.');
  });

  it('converte i pence in sterline', () => {
    const q = parseChartQuote(chart('VUSA.L', { currency: 'GBp', closes: [9000, 9100], days: ['2026-10-12', '2026-10-13'] }), 'VUSA.L')!;
    expect(q.currency).toBe('GBP');
    expect(q.price).toBe(91);
    expect(q.dailyChange).toBeCloseTo(1);
  });

  it('ignora risposte senza prezzo', () => {
    expect(parseChartQuote({ chart: { result: null, error: { code: 'Not Found' } } }, 'X')).toBeNull();
  });
});

describe('parseChartHistory', () => {
  it('restituisce le chiusure valide per data', () => {
    const h = parseChartHistory(chart('AAPL', { closes: [1, 0, 3] }));
    expect(h.map(p => p.date)).toEqual(['2026-10-09', '2026-10-13']);
  });

  it('con intraday mantiene data e ora', () => {
    const h = parseChartHistory(chart('AAPL'), { intraday: true });
    expect(h[0].date).toBe('2026-10-09T08:00:00.000Z');
  });
});

describe('route Edge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('passa al secondo host se il primo risponde 429 e non ripete i 404', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = new URL(url);
      calls.push(`${u.host}${u.pathname}`);
      const symbol = decodeURIComponent(u.pathname.split('/').pop()!);
      if (symbol === 'NOPE.MI') return new Response('{"chart":{"result":null}}', { status: 404 });
      if (u.host.startsWith('query1')) return new Response('Too Many Requests', { status: 429 });
      return Response.json(chart(symbol));
    }));

    const res = await quotesRoute(new Request('https://folium.test/api/quotes?symbols=isp.mi,AAPL,NOPE.MI,bad%20sym'));
    const body = await res.json();
    expect(Object.keys(body.quotes).sort()).toEqual(['AAPL', 'ISP.MI']);
    expect(body.errors['NOPE.MI']).toMatch(/404/);
    expect(calls.filter(c => c.includes('NOPE.MI'))).toHaveLength(1);
    expect(res.headers.get('Cache-Control')).toMatch(/s-maxage=60/);
  });

  it('non mette in cache una risposta senza alcuna quotazione', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Too Many Requests', { status: 429 })));
    const res = await quotesRoute(new Request('https://folium.test/api/quotes?symbols=ISP.MI'));
    expect((await res.json()).quotes).toEqual({});
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('accetta range e interval infragiornalieri e rifiuta i valori non ammessi', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      return Response.json(chart(decodeURIComponent(new URL(url).pathname.split('/').pop()!)));
    }));
    const ok = await historyRoute(new Request('https://folium.test/api/history?symbols=ISP.MI&range=1d&interval=5m'));
    const body = await ok.json();
    expect(body.history['ISP.MI'][0].date).toMatch(/T08:00:00.000Z$/);
    expect(urls[0]).toContain('range=1d');
    expect(urls[0]).toContain('interval=5m');
    expect(ok.headers.get('Cache-Control')).toMatch(/s-maxage=120/);

    expect((await historyRoute(new Request('https://folium.test/api/history?symbols=ISP.MI&range=10y&interval=5m'))).status).toBe(400);
    expect((await historyRoute(new Request('https://folium.test/api/history?symbols=ISP.MI&range=1d&interval=1s'))).status).toBe(400);
  });

  it('restituisce lo storico e valida la data di inizio', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(chart(decodeURIComponent(new URL(url).pathname.split('/').pop()!)))));
    const ok = await historyRoute(new Request('https://folium.test/api/history?symbols=ISP.MI&start=2026-10-01'));
    expect((await ok.json()).history['ISP.MI']).toHaveLength(3);
    const bad = await historyRoute(new Request('https://folium.test/api/history?symbols=ISP.MI&start=ieri'));
    expect(bad.status).toBe(400);
  });
});
