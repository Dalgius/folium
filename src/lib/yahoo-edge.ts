/**
 * Richieste all'endpoint "chart" di Yahoo dalle funzioni Edge di Vercel.
 * I server Node di Vercel (AWS) ricevono "Too Many Requests" su ogni richiesta;
 * le funzioni Edge escono da una rete diversa.
 */

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
};

export class YahooError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'YahooError';
  }
}

/** Scarica il JSON del grafico provando entrambi gli host di Yahoo. */
export async function fetchChart(symbol: string, params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams(params).toString();
  let lastError: YahooError | null = null;
  for (const host of HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`;
    const response = await fetch(url, { headers: HEADERS, cache: 'no-store' });
    if (response.ok) return response.json();
    const text = (await response.text()).slice(0, 120).trim();
    lastError = new YahooError(`${host} ${response.status}: ${text}`, response.status);
    // Simbolo inesistente: inutile provare l'altro host
    if (response.status === 404) break;
  }
  throw lastError ?? new YahooError('Nessuna risposta da Yahoo', 0);
}

/** Esegue `fn` sugli elementi con al massimo `limit` operazioni contemporanee. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

export const parseSymbols = (value: string | null, max: number) =>
  Array.from(new Set((value ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean))).slice(0, max);
