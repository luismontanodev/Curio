// Datos del lector: la tarjeta completa y su texto. Si la fuente dio el artículo entero
// (The Conversation) se usa tal cual; si es de Wikipedia, se pide el texto al abrirlo.

import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { Card, ContentBlock } from '../core/types.ts';
import { getCard, markSeen } from '../db/cards.ts';
import { fetchWikipediaArticle, parseWikipediaUrl } from '../ingest/article.ts';

export type ReaderState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; card: Card; blocks: ContentBlock[]; text: 'full' | 'loading' | 'summary' | 'error' };

// Artículos ya descargados en esta sesión: volver a abrir uno no gasta red.
const articleCache = new Map<string, ContentBlock[]>();

export function useReader(id: string) {
  const db = useSQLiteContext();
  const [state, setState] = useState<ReaderState>({ status: 'loading' });

  const load = useCallback(async () => {
    const card = await getCard(db, id);
    if (!card) return setState({ status: 'missing' });
    void markSeen(db, [card.id]).catch(() => {});

    if (card.body?.length) return setState({ status: 'ready', card, blocks: card.body, text: 'full' });
    if (!parseWikipediaUrl(card.url)) return setState({ status: 'ready', card, blocks: [], text: 'summary' });

    const cached = articleCache.get(card.url);
    if (cached) return setState({ status: 'ready', card, blocks: cached, text: 'full' });

    setState({ status: 'ready', card, blocks: [], text: 'loading' });
    try {
      const blocks = await fetchWikipediaArticle(fetch, card.url);
      if (blocks) articleCache.set(card.url, blocks);
      setState({ status: 'ready', card, blocks: blocks ?? [], text: blocks ? 'full' : 'summary' });
    } catch (e) {
      console.warn('No se pudo cargar el artículo', e);
      setState({ status: 'ready', card, blocks: [], text: 'error' });
    }
  }, [db, id]);

  useEffect(() => {
    load().catch((e) => {
      console.warn('No se pudo abrir la tarjeta', e);
      setState({ status: 'missing' });
    });
  }, [load]);

  return { state, retry: load };
}
