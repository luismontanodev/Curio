// Explorar: recomendaciones (local, por intención) con scroll infinito, y búsqueda en el
// teléfono y en Wikipedia.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { TOPICS, type Card, type FilterPrefs } from '../core/types.ts';
import { evaluate, withQuality } from '../core/scorer.ts';
import { sourceKindOf } from '../core/sources.ts';
import { recommend, type Recommendation } from '../core/recommend.ts';
import { getFeedPage, insertCards, listSaved, searchCards } from '../db/cards.ts';
import { searchWikipedia } from '../ingest/search.ts';
import { queueIngest } from './ingest-queue.ts';
import type { MoreState } from './use-infinite-feed.ts';

const PAGE = 20;
const NETWORK_ATTEMPTS = 2;

export function useRecommendations(prefs: FilterPrefs) {
  const db = useSQLiteContext();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState<MoreState>('idle');
  const working = useRef(false);
  const recsRef = useRef<Recommendation[]>([]);
  const request = useRef(0);
  useEffect(() => {
    recsRef.current = recs;
  }, [recs]);

  const page = useCallback(async () => {
    const shown = recsRef.current.map((r) => r.card);
    const [pool, saved] = await Promise.all([
      getFeedPage(db, prefs, { limit: 100, hideSeen: true, excludeIds: shown.map((c) => c.id) }),
      listSaved(db),
    ]);
    return recommend(pool.cards, saved.map((s) => s.card), { limit: PAGE, after: shown });
  }, [db, prefs]);

  const loadMore = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    const id = request.current;
    setMore('fetching');
    try {
      let next = await page();
      let offline = false;
      for (let attempt = 0; next.length === 0 && attempt < NETWORK_ATTEMPTS; attempt++) {
        const report = await queueIngest(db, { more: true });
        offline = Object.values(report.sources).every((s) => s.error);
        next = await page();
        if (offline) break;
      }
      if (id !== request.current) return;
      if (next.length > 0) {
        setRecs((prev) => [...prev, ...next.filter((r) => !prev.some((p) => p.card.id === r.card.id))]);
        setMore('idle');
      } else setMore(offline ? 'offline' : 'exhausted');
    } catch (e) {
      console.warn('No se pudieron traer recomendaciones', e);
      setMore('offline');
    } finally {
      setLoaded(true);
      working.current = false;
    }
  }, [db, page]);

  const reload = useCallback(async () => {
    request.current++;
    recsRef.current = [];
    setRecs([]);
    setLoaded(false);
    working.current = false;
    await loadMore();
  }, [loadMore]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  const retry = useCallback(async () => {
    setMore('idle');
    await loadMore();
  }, [loadMore]);

  return { recs, loaded, more, loadMore, reload, retry };
}

export type SearchStatus = 'idle' | 'searching' | 'done' | 'offline';

/**
 * Búsqueda: primero lo del teléfono (al instante), luego Wikipedia en cada idioma del
 * usuario. Los temas no limitan (es una búsqueda explícita); idiomas y calidad sí.
 * Lo que llega de Wikipedia se guarda como tarjeta para poder leerlo en la app.
 */
export function useSearch(prefs: FilterPrefs, query: string) {
  const db = useSQLiteContext();
  const [local, setLocal] = useState<Card[]>([]);
  const [remote, setRemote] = useState<Card[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLocal([]);
      setRemote([]);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    const searchPrefs = { ...prefs, topics: [...TOPICS] };
    const timer = setTimeout(async () => {
      setStatus('searching');
      try {
        const found = await searchCards(db, searchPrefs, q);
        if (cancelled) return;
        setLocal(found);

        const results = await Promise.allSettled(prefs.languages.map((l) => searchWikipedia(fetch, l, q, 8)));
        if (cancelled) return;
        const now = new Date();
        const cards = results
          .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
          .map((raw) => withQuality(raw, sourceKindOf(raw.sourceId), now))
          .filter((c) => evaluate(c, sourceKindOf(c.sourceId), searchPrefs).show);
        await insertCards(db, cards);
        const localIds = new Set(found.map((c) => c.id));
        setRemote(cards.filter((c) => !localIds.has(c.id)));
        setStatus(results.every((r) => r.status === 'rejected') ? 'offline' : 'done');
      } catch (e) {
        console.warn('Búsqueda fallida', e);
        if (!cancelled) setStatus('offline');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [db, prefs, query]);

  return { local, remote, status };
}
