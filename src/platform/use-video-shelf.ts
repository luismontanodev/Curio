// Videos para intercalar en listas (Destacados): pocos, ya descargados como tarjetas.
// Solo se lee la base (pósters y metadatos): ningún video se descarga hasta abrirlo.

import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { TOPICS, type Card, type FilterPrefs } from '../core/types.ts';
import { videoLanguages } from '../core/video.ts';
import { getFeedPage } from '../db/cards.ts';

export function useVideoShelf(prefs: FilterPrefs, limit = 20) {
  const db = useSQLiteContext();
  const [videos, setVideos] = useState<Card[]>([]);

  const load = useCallback(async () => {
    // Videos: todos los temas y los idiomas del usuario más inglés (ver videoLanguages).
    const page = await getFeedPage(
      db,
      { ...prefs, topics: [...TOPICS], languages: videoLanguages(prefs.languages) },
      { types: ['video'], hideSeen: false, limit },
    );
    setVideos(page.cards);
  }, [db, prefs, limit]);

  useEffect(() => {
    load().catch((e) => console.warn('No se pudieron leer los videos', e));
  }, [load]);

  return { videos, reload: load };
}
