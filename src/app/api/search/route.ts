import { parseSearchResults, type SearchResult } from '@/lib/yahoo-chart';
import { fetchSearch } from '@/lib/yahoo-edge';

export const runtime = 'edge';

/** GET /api/search?q=apple → { results: SearchResult[], error?: string } */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2 || q.length > 64) return Response.json({ results: [] });

  let results: SearchResult[] = [];
  let error: string | undefined;
  try {
    results = parseSearchResults(await fetchSearch(q));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn('Ricerca non disponibile:', q, error);
  }

  return Response.json(
    { results, ...(error ? { error } : {}) },
    {
      // Si mettono in cache solo le risposte con risultati: quelle vuote sono spesso errori temporanei
      headers: { 'Cache-Control': results.length ? 'public, s-maxage=300, stale-while-revalidate=3600' : 'no-store' },
      status: error ? 502 : 200,
    },
  );
}
