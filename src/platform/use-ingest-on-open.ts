// Corre la ingesta al abrir la app y cada vez que vuelve al primer plano.
// runIngest respeta el intervalo mínimo, así que llamarla seguido es barato.
// Úsalo una sola vez (en el feed): cada instancia escucha AppState por su cuenta.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import type { IngestReport } from '../ingest/ingest.ts';
import { queueIngest } from './ingest-queue.ts';

export function useIngestOnOpen() {
  const db = useSQLiteContext();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<IngestReport | null>(null);

  const ingest = useCallback(
    async (force = false) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        setLast(await queueIngest(db, { force }));
      } catch (e) {
        console.warn('Ingesta fallida', e); // sin red: el feed sigue funcionando con lo local
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [db],
  );

  useEffect(() => {
    void ingest();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ingest();
    });
    return () => sub.remove();
  }, [ingest]);

  const refresh = useCallback(() => ingest(true), [ingest]);
  return { last, busy, refresh };
}
