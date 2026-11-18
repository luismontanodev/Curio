// Scroll infinito: primero lee lo que hay en el teléfono (por cursor); cuando se acaba,
// pide más a las fuentes y agrega lo nuevo abajo, sin repetir lo que ya está en pantalla.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { Card, CardType, FilterPrefs } from '../core/types.ts';
import { getFeedPage, type FeedCursor } from '../db/cards.ts';
import type { JobKind } from '../ingest/ingest.ts';
import { queueIngest } from './ingest-queue.ts';

const PAGE_SIZE = 20;
/** Si una vuelta a la red no trae nada nuevo (todo ya estaba), se intenta otra antes de rendirse. */
const NETWORK_ATTEMPTS = 2;

/**
 * - `idle`: hay más en el teléfono o aún no se pidió.
 * - `fetching`: pidiendo más a las fuentes.
 * - `offline`: ninguna fuente respondió.
 * - `exhausted`: las fuentes respondieron pero no había nada nuevo con estos filtros.
 */
export type MoreState = 'idle' | 'fetching' | 'offline' | 'exhausted';

export interface InfiniteFeedOptions {
  prefs: FilterPrefs;
  types?: CardType[];
  sources?: string[];
  hideSeen?: boolean;
  /** Qué fuentes pedir al traer más (por defecto, todas). */
  only?: JobKind[];
}

export function useInfiniteFeed({ prefs, types, sources, hideSeen = true, only }: InfiniteFeedOptions) {
  const db = useSQLiteContext();
  const [cards, setCards] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState<MoreState>('idle');
  const busy = useRef(false);
  const request = useRef(0); // descarta respuestas de cargas que ya se reemplazaron
  const cardsRef = useRef<Card[]>([]);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Claves estables para que pasar arreglos nuevos en cada render no recargue la lista.
  const typesKey = types?.join(',') ?? '';
  const sourcesKey = sources?.join(',') ?? '';
  const onlyKey = only?.join(',') ?? '';
  const options = useMemo(
    () => ({
      types: typesKey ? (typesKey.split(',') as CardType[]) : undefined,
      sources: sourcesKey ? sourcesKey.split(',') : undefined,
      only: onlyKey ? (onlyKey.split(',') as JobKind[]) : undefined,
    }),
    [typesKey, sourcesKey, onlyKey],
  );

  const page = useCallback(
    (from: FeedCursor | null, exclude: Card[]) =>
      getFeedPage(db, prefs, {
        cursor: from,
        limit: PAGE_SIZE,
        hideSeen,
        types: options.types,
        sources: options.sources,
        excludeIds: exclude.map((c) => c.id),
      }),
    [db, prefs, hideSeen, options],
  );

  const loadFirst = useCallback(async () => {
    const id = ++request.current;
    const first = await page(null, []);
    if (id !== request.current) return;
    setCards(first.cards);
    setCursor(first.nextCursor);
    setMore('idle');
    setLoaded(true);
  }, [page]);

  useEffect(() => {
    loadFirst().catch((e) => console.warn('No se pudo leer el feed', e));
  }, [loadFirst]);

  const append = (next: Card[]) =>
    setCards((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      return [...prev, ...next.filter((c) => !ids.has(c.id))];
    });

  /** Pide más a las fuentes y agrega lo nuevo. Devuelve cuántas tarjetas entraron a la lista. */
  const fetchFromNetwork = useCallback(async () => {
    const id = request.current;
    setMore('fetching');
    for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt++) {
      const report = await queueIngest(db, { more: true, only: options.only });
      if (id !== request.current) return;
      const offline = Object.values(report.sources).every((s) => s.error);
      // Lo nuevo entra con fecha más reciente: se busca desde arriba excluyendo lo que ya se ve.
      const fresh = await page(null, cardsRef.current);
      if (id !== request.current) return;
      if (fresh.cards.length > 0) {
        append(fresh.cards);
        setCursor(fresh.nextCursor);
        setMore('idle');
        return;
      }
      if (offline) return setMore('offline');
    }
    setMore('exhausted');
  }, [db, options.only, page]);

  const loadMore = useCallback(async () => {
    if (busy.current || !loaded || more === 'offline' || more === 'exhausted') return;
    busy.current = true;
    try {
      if (cursor) {
        const id = request.current;
        const next = await page(cursor, cardsRef.current);
        if (id !== request.current) return;
        append(next.cards);
        setCursor(next.nextCursor);
        if (next.cards.length > 0 || next.nextCursor) return;
      }
      await fetchFromNetwork();
    } catch (e) {
      console.warn('No se pudo traer más', e);
      setMore('offline');
    } finally {
      busy.current = false;
    }
  }, [cursor, loaded, more, page, fetchFromNetwork]);

  /** Botón "Reintentar"/"Buscar de nuevo" del pie de la lista. */
  const retryMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fetchFromNetwork();
    } catch (e) {
      console.warn('No se pudo traer más', e);
      setMore('offline');
    } finally {
      busy.current = false;
    }
  }, [fetchFromNetwork]);

  return { cards, loaded, more, loadFirst, loadMore, retryMore };
}
