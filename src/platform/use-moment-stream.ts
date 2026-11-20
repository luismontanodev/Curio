// Momentos como scroll infinito: lotes variados (mixMoments) de lo no visto; cuando se
// acaban, se trae más de las fuentes. Cada `pauseEvery` momentos entra una página de pausa
// (Pausa sugerida, configurable en Filtros): el contenido no se acaba, pero la app sugiere parar.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { Moment } from '../core/types.ts';
import { BATCH_SIZE, RENDERED_FORMATS, VIDEO_FORMATS, mixMoments } from '../core/moments.ts';
import { markSeen } from '../db/cards.ts';
import { momentCandidates, type MomentMode } from '../db/moments.ts';
import { useAppState } from './app-state.tsx';
import { useIngest } from './ingest-context.tsx';
import { queueIngest } from './ingest-queue.ts';
import type { MoreState } from './use-infinite-feed.ts';

export type ReelItem = { kind: 'moment'; key: string; moment: Moment } | { kind: 'pause'; key: string };

/** Si un lote sale con menos de esto, se pide más a la red antes de mostrarlo. */
const MIN_BATCH = 4;
const NETWORK_ATTEMPTS = 2;
const VIDEO_JOBS = ['nasa-video', 'archive-video', 'commons-video'] as const;
/**
 * Videos: si en el teléfono quedan menos que esto sin ver, se piden más a la red en segundo
 * plano, sin esperar a que se acaben (la ingesta de video tarda varios segundos).
 */
const VIDEO_RESERVE = 12;

/** `mode`: "posts" (imágenes y texto) o "videos" (clips de 15 a 60 s). */
export function useMomentStream(mode: MomentMode = 'posts') {
  const db = useSQLiteContext();
  const { prefs } = useAppState();
  const { busy: ingesting } = useIngest();
  const [items, setItems] = useState<ReelItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState<MoreState>('idle');
  const working = useRef(false);
  // Cambia al reiniciar (otro modo u otros filtros): un lote que llega tarde de la
  // generación anterior se descarta en vez de mezclar posts entre los videos.
  const generation = useRef(0);
  const refilling = useRef(false);
  const itemsRef = useRef<ReelItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const shownMoments = () => itemsRef.current.flatMap((i) => (i.kind === 'moment' ? [i.moment] : []));

  /** Inserta una pausa cada `pauseEvery` momentos, contando los que ya estaban. */
  const withPauses = useCallback(
    (prev: ReelItem[], next: Moment[]): ReelItem[] => {
      const out = [...prev];
      let count = prev.filter((i) => i.kind === 'moment').length;
      for (const m of next) {
        out.push({ kind: 'moment', key: m.id, moment: m });
        count++;
        if (prefs.pauseEvery && count % prefs.pauseEvery === 0) out.push({ kind: 'pause', key: `pause-${count}` });
      }
      return out;
    },
    [prefs.pauseEvery],
  );

  const nextBatch = useCallback(async () => {
    const shown = shownMoments();
    const exclude = shown.flatMap((m) => (m.cardId ? [m.cardId] : []));
    const formats = mode === 'videos' ? VIDEO_FORMATS : RENDERED_FORMATS;
    const pick = async () =>
      mixMoments(await momentCandidates(db, prefs, { excludeCardIds: exclude, mode }), { size: BATCH_SIZE, after: shown, formats, strict: mode !== 'videos' });

    const candidates = await momentCandidates(db, prefs, { excludeCardIds: exclude, mode });
    let batch = mixMoments(candidates, { size: BATCH_SIZE, after: shown, formats, strict: mode !== 'videos' });
    let offline = false;
    // Quedan pocos videos: se piden más ya, sin bloquear este lote.
    if (mode === 'videos' && batch.length >= MIN_BATCH && candidates.length < VIDEO_RESERVE && !refilling.current) {
      refilling.current = true;
      void queueIngest(db, { more: true, only: [...VIDEO_JOBS] })
        .catch(() => {})
        .finally(() => {
          refilling.current = false;
        });
    }
    for (let attempt = 0; batch.length < MIN_BATCH && attempt < NETWORK_ATTEMPTS; attempt++) {
      // En Videos solo se piden fuentes de video: no se descarga lo demás.
      const report = await queueIngest(db, { more: true, only: mode === 'videos' ? [...VIDEO_JOBS] : undefined });
      offline = Object.values(report.sources).every((s) => s.error);
      batch = await pick();
      if (offline) break;
    }
    return { batch, offline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, prefs, mode]);

  const loadMore = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    const gen = generation.current;
    setMore('fetching');
    try {
      const { batch, offline } = await nextBatch();
      if (gen !== generation.current) return;
      if (batch.length > 0) {
        setItems((prev) => withPauses(prev, batch));
        setMore('idle');
      } else setMore(offline ? 'offline' : 'exhausted');
    } catch (e) {
      console.warn('No se pudieron traer más momentos', e);
      if (gen === generation.current) setMore('offline');
    } finally {
      if (gen === generation.current) {
        setLoaded(true);
        working.current = false;
      }
    }
  }, [nextBatch, withPauses]);

  /** Filtros cambiados: se empieza de nuevo (lo ya visto no se repite). */
  const restart = useCallback(async () => {
    generation.current++;
    itemsRef.current = [];
    setItems([]);
    setLoaded(false);
    working.current = false;
    await loadMore();
  }, [loadMore]);

  useEffect(() => {
    void restart();
    // Solo cuando cambian los filtros que afectan qué momentos entran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, mode]);

  // Primer arranque: la base está vacía hasta que termina la ingesta de apertura.
  useEffect(() => {
    if (!ingesting && loaded && itemsRef.current.length === 0) void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingesting]);

  /** Al mostrar un momento: su tarjeta cuenta como vista (no se repite en Momentos). */
  const reached = useCallback(
    (m: Moment) => {
      if (m.cardId) void markSeen(db, [m.cardId]).catch(() => {});
    },
    [db],
  );

  const retry = useCallback(async () => {
    setMore('idle');
    await loadMore();
  }, [loadMore]);

  return { items, loaded, more, loadMore, retry, reached, restart };
}
