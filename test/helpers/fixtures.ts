import type { Card, RawCard, Topic } from '../../src/core/types.ts';
import { withQuality } from '../../src/core/scorer.ts';
import { sourceKindOf } from '../../src/core/sources.ts';
import type { FetchLike, HttpResponse } from '../../src/ingest/http.ts';

let seq = 0;

export function makeCard(over: Partial<RawCard> & { ingestedAt?: string } = {}): Card {
  seq++;
  const raw: RawCard = {
    id: over.id ?? `wikipedia-es:test-${seq}`,
    sourceId: 'wikipedia-es',
    externalId: `test-${seq}`,
    type: 'article',
    topic: 'ciencia' as Topic,
    lang: 'es',
    title: `Artículo de prueba ${seq}`,
    url: `https://es.wikipedia.org/wiki/Prueba_${seq}`,
    ...over,
  };
  const card = withQuality(raw, sourceKindOf(raw.sourceId));
  return { ...card, ingestedAt: over.ingestedAt ?? new Date(Date.UTC(2026, 10, 17, 12, 0, 0, seq)).toISOString() };
}

/** fetch falso: rutea por prefijo de URL. Las rutas pueden ser objetos o funciones. */
export function fakeFetch(routes: Record<string, unknown | ((url: string) => unknown)>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string): Promise<HttpResponse> => {
    calls.push(url);
    const key = Object.keys(routes)
      .filter((k) => url.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    if (key === undefined) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    const v = routes[key];
    const body = typeof v === 'function' ? (v as (u: string) => unknown)(url) : v;
    if (body instanceof Error) throw body;
    // Un string se sirve como texto (feeds Atom); lo demás como JSON.
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

/** rng determinista para que los tests no dependan del azar. */
export function seededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
