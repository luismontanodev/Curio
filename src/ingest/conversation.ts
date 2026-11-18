// The Conversation: secciones de ciencia y tecnología por edición. Paginado con `?page=N`,
// así que sirve para el scroll infinito: cada "traer más" pide la página siguiente.

import type { Lang, RawCard, Topic } from '../core/types.ts';
import { normalizeConversation, parseAtom } from '../core/normalizers/conversation.ts';
import { getText, type FetchLike } from './http.ts';

export const CONVERSATION_BASE = 'https://theconversation.com';

/** Secciones verificadas el 2026-11-17. La edición en portugués no tiene sección de ciencia. */
export const CONVERSATION_FEEDS: Record<Lang, { path: string; topic: Topic }[]> = {
  es: [{ path: 'es/ciencia', topic: 'ciencia' }], // "Ciencia + Tecnología"
  en: [{ path: 'us/technology', topic: 'ciencia' }], // "Science + Tech"
  fr: [
    { path: 'fr/technologie', topic: 'ciencia' }, // "Science"
    { path: 'fr/environnement', topic: 'naturaleza' },
  ],
  pt: [],
};

export const conversationFeedUrl = (path: string, page: number) =>
  `${CONVERSATION_BASE}/${path}/articles.atom${page > 1 ? `?page=${page}` : ''}`;

/** `entries` cuenta lo que trajo la página (aunque ya estuviera guardado): 0 = se acabaron las páginas. */
export async function fetchConversationCards(
  fetch: FetchLike,
  opts: { lang: Lang; page: number; existing: Set<string> },
): Promise<{ cards: RawCard[]; entries: number }> {
  const feeds = CONVERSATION_FEEDS[opts.lang];
  const cards: RawCard[] = [];
  let entries = 0;
  for (const feed of feeds) {
    const xml = await getText(fetch, conversationFeedUrl(feed.path, opts.page));
    for (const entry of parseAtom(xml)) {
      entries++;
      const card = normalizeConversation(entry, opts.lang, feed.topic);
      if (card && !opts.existing.has(card.externalId)) cards.push(card);
    }
  }
  return { cards, entries };
}
