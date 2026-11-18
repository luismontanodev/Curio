// NASA Image and Video Library → RawCard. Sin key; dominio público.
// GET https://images-api.nasa.gov/search?q=<tema>&media_type=image&page=N
// Descripciones en inglés: solo entra al feed si el usuario lee inglés.

import type { RawCard, Source } from '../types.ts';
import { stripTags } from '../blocks.ts';

export const NASA_SOURCE: Source = {
  id: 'nasa',
  name: 'NASA',
  kind: 'journal',
  license: 'Dominio público (NASA)',
};

export interface NasaItem {
  data?: { nasa_id?: string; title?: string; description?: string; date_created?: string; center?: string }[];
  links?: { href?: string; rel?: string; render?: string }[];
}

const MAX_SUMMARY = 400;

export function normalizeNasa(item: NasaItem): RawCard | null {
  const d = item.data?.[0];
  const thumb = item.links?.find((l) => l.render === 'image' && l.href?.startsWith('https://'))?.href;
  if (!d?.nasa_id || !d.title?.trim() || !thumb) return null;

  // La miniatura (~thumb) es pequeña; ~medium existe para casi todas y se ve bien en la tarjeta.
  const imageUrl = thumb.replace(/~(thumb|small)\.(jpg|png)$/i, '~medium.$2');
  const description = d.description ? stripTags(d.description) : '';
  const summary = description.length > MAX_SUMMARY ? `${description.slice(0, MAX_SUMMARY - 1).trimEnd()}…` : description;
  const published = d.date_created && !Number.isNaN(Date.parse(d.date_created)) ? d.date_created : undefined;

  return {
    id: `${NASA_SOURCE.id}:${d.nasa_id}`,
    sourceId: NASA_SOURCE.id,
    externalId: d.nasa_id,
    type: 'image',
    topic: 'espacio',
    lang: 'en',
    title: stripTags(d.title),
    summary: summary || undefined,
    imageUrl,
    url: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
    license: NASA_SOURCE.license,
    publishedAt: published,
    body: description.length > MAX_SUMMARY ? [{ kind: 'p', text: description }] : undefined,
  };
}
