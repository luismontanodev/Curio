// Agencia SINC (agencia pública española de divulgación científica), RSS por sección.
// GET https://www.agenciasinc.es/feed/{Ciencia|Salud|Innova|Reportajes|Entrevistas}
// Textos bajo CC BY 4.0 (citar a SINC y enlazar; verificado en /Sobre-SINC/Licencia-CC el
// 2026-11-18). Las fotos pueden tener la licencia de su autor. Trae el artículo completo
// en `content:encoded`, así que se lee entero en la app.

import type { RawCard, Source, Topic } from '../types.ts';
import { decodeEntities, htmlToBlocks, stripTags } from '../blocks.ts';
import { classifyTopic } from '../classify.ts';
import { estimateReadMinutes } from '../read-time.ts';

export const SINC_SOURCE: Source = {
  id: 'sinc',
  name: 'Agencia SINC',
  kind: 'magazine',
  license: 'CC BY 4.0',
};

export interface RssItem {
  title: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  author?: string;
  description?: string;
  contentHtml?: string;
}

const tag = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? m[1] : undefined;
};
const unCdata = (s: string) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
const text = (s?: string) => (s ? stripTags(decodeEntities(unCdata(s))) : undefined);

/** Parser mínimo de RSS 2.0: solo lo que usamos de cada `<item>`. */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const chunk of xml.split(/<item\b[^>]*>/i).slice(1)) {
    const item = chunk.split(/<\/item>/i)[0];
    const title = text(tag(item, 'title'));
    if (!title) continue;
    const content = tag(item, 'content:encoded');
    items.push({
      title,
      link: text(tag(item, 'link')),
      guid: text(tag(item, 'guid')),
      pubDate: text(tag(item, 'pubDate')),
      author: text(tag(item, 'author')) ?? text(tag(item, 'dc:creator')),
      description: text(tag(item, 'description')),
      contentHtml: content ? unCdata(content) : undefined,
    });
  }
  return items;
}

const https = (u?: string) => (u ? u.trim().replace(/^http:\/\//, 'https://') : undefined);

export function normalizeSinc(item: RssItem, fallbackTopic: Topic = 'ciencia'): RawCard | null {
  const url = https(item.link ?? item.guid);
  if (!url?.startsWith('https://www.agenciasinc.es/')) return null;
  const slug = url.replace(/^https:\/\/www\.agenciasinc\.es\//, '').replace(/[?#].*$/, '');
  if (!slug) return null;

  const blocks = item.contentHtml ? htmlToBlocks(item.contentHtml) : [];
  const firstImage = blocks.find((b) => b.kind === 'img');
  const imageUrl = firstImage?.kind === 'img' ? firstImage.src : undefined;
  const body = blocks.filter((b) => b !== firstImage);
  if (item.author) body.unshift({ kind: 'quote', text: `${item.author} · Agencia SINC` });
  const bodyText = body.map((b) => (b.kind === 'img' ? '' : b.text)).join(' ');
  const published = item.pubDate && !Number.isNaN(Date.parse(item.pubDate)) ? new Date(item.pubDate).toISOString() : undefined;

  return {
    id: `${SINC_SOURCE.id}:${slug}`,
    sourceId: SINC_SOURCE.id,
    externalId: slug,
    type: 'article',
    topic: classifyTopic(item.title, item.description ?? '', fallbackTopic),
    lang: 'es',
    title: item.title,
    summary: item.description,
    imageUrl,
    url,
    license: SINC_SOURCE.license,
    readMinutes: bodyText ? estimateReadMinutes(bodyText) : undefined,
    publishedAt: published,
    body: body.length > 1 ? body : undefined,
  };
}
