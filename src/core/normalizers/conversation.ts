// The Conversation (feeds Atom por sección) → RawCard con texto completo.
// GET https://theconversation.com/{edición}/{sección}/articles.atom?page=N
// Artículos escritos por académicos bajo CC BY-ND 4.0: se pueden republicar completos y
// sin cambios, con atribución. Por eso es la fuente que se lee entera dentro de la app.

import type { Lang, RawCard, Source, Topic } from '../types.ts';
import { decodeEntities, htmlToBlocks, stripTags } from '../blocks.ts';
import { classifyTopic } from '../classify.ts';
import { estimateReadMinutes } from '../read-time.ts';

export const CONVERSATION_SOURCE: Source = {
  id: 'theconversation',
  name: 'The Conversation',
  kind: 'magazine',
  license: 'CC BY-ND 4.0',
};

export interface AtomEntry {
  id: string;
  title: string;
  link?: string;
  published?: string;
  summary?: string;
  author?: string;
  contentHtml?: string;
}

const tag = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? m[1] : undefined;
};

const unCdata = (s: string) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');

/** Parser mínimo de Atom: solo lo que usamos de cada `<entry>`. */
export function parseAtom(xml: string): AtomEntry[] {
  const entries: AtomEntry[] = [];
  for (const chunk of xml.split(/<entry\b[^>]*>/i).slice(1)) {
    const entry = chunk.split(/<\/entry>/i)[0];
    const id = tag(entry, 'id')?.trim();
    const title = tag(entry, 'title');
    if (!id || !title) continue;
    const link =
      /<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"/i.exec(entry)?.[1] ??
      /<link\b[^>]*href="([^"]+)"/i.exec(entry)?.[1];
    const author = tag(tag(entry, 'author') ?? '', 'name');
    const content = tag(entry, 'content');
    entries.push({
      id,
      title: stripTags(decodeEntities(unCdata(title))),
      link: link ? decodeEntities(link) : undefined,
      published: tag(entry, 'published')?.trim(),
      summary: tag(entry, 'summary') ? stripTags(decodeEntities(unCdata(tag(entry, 'summary')!))) : undefined,
      author: author ? stripTags(decodeEntities(author)) : undefined,
      // `type="html"`: el HTML viene escapado una vez.
      contentHtml: content ? decodeEntities(unCdata(content)) : undefined,
    });
  }
  return entries;
}

export function normalizeConversation(entry: AtomEntry, lang: Lang, fallbackTopic: Topic = 'ciencia'): RawCard | null {
  const url = entry.link;
  if (!url?.startsWith('https://') || !entry.title.trim()) return null;
  const articleId = /(\d+)$/.exec(entry.id)?.[1] ?? /-(\d+)$/.exec(url)?.[1];
  if (!articleId) return null;

  const blocks = entry.contentHtml ? htmlToBlocks(entry.contentHtml) : [];
  const firstImage = blocks.find((b) => b.kind === 'img');
  const imageUrl = firstImage?.kind === 'img' ? firstImage.src : undefined;
  // La imagen principal ya va arriba en el lector: no se repite como primer bloque.
  const body = blocks.filter((b) => b !== firstImage);
  if (entry.author) body.unshift({ kind: 'quote', text: entry.author });

  const text = body.map((b) => (b.kind === 'img' ? '' : b.text)).join(' ');
  const published = entry.published && !Number.isNaN(Date.parse(entry.published)) ? entry.published : undefined;
  return {
    id: `${CONVERSATION_SOURCE.id}:${articleId}`,
    sourceId: CONVERSATION_SOURCE.id,
    externalId: articleId,
    type: 'article',
    topic: classifyTopic(entry.title, entry.summary ?? '', fallbackTopic),
    lang,
    title: entry.title,
    summary: entry.summary,
    imageUrl,
    url,
    license: CONVERSATION_SOURCE.license,
    readMinutes: text ? estimateReadMinutes(text) : undefined,
    publishedAt: published,
    body: body.length > 1 ? body : undefined,
  };
}
