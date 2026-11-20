// NASA Image and Video Library (videos) → RawCard. Sin key; dominio público.
// 1. GET https://images-api.nasa.gov/search?q=<tema>&media_type=video  → candidatos
// 2. GET https://images-assets.nasa.gov/video/{nasa_id}/metadata.json  → duración (QuickTime:Duration)
// 3. GET https://images-api.nasa.gov/asset/{nasa_id}                   → variantes MP4 y miniaturas
// Se usa `~mobile.mp4` (≈ 2.5 MB por minuto; `~medium` pesa ~7 veces más y el original cientos de MB).
// Reglas de uso de la NASA: no se sugiere que la NASA respalde la app, y se descarta lo que
// tenga señales de material de terceros (la NASA no puede ceder derechos ajenos).

import type { RawCard, Source } from '../types.ts';
import { stripTags } from '../blocks.ts';
import { classifyTopic } from '../classify.ts';
import { parseDuration } from '../video.ts';

export const NASA_VIDEO_SOURCE: Source = {
  id: 'nasa-video',
  name: 'NASA',
  kind: 'journal',
  license: 'Dominio público (NASA)',
};

export interface NasaVideoItem {
  href?: string;
  data?: { nasa_id?: string; title?: string; description?: string; center?: string; date_created?: string }[];
}

export type NasaVideoMetadata = Record<string, unknown>;

/** Variantes en orden de preferencia: la más ligera que se vea bien en un teléfono. */
const MP4_PREFERENCE = ['mobile', 'small', 'preview', 'medium'];
const POSTER_PREFERENCE = ['medium', 'small', 'large', 'thumb'];

/** Señales de material de terceros: con derechos ajenos, el contenido no es de dominio público. */
const THIRD_PARTY = /©|\bcopyright(ed)?\b|all rights reserved|used (with|by) permission|courtesy of (?!nasa)/i;

/** Las URLs del asset vienen en http y con espacios: https y codificadas. */
export const assetUrl = (href: string) => encodeURI(href.trim().replace(/^http:\/\//, 'https://'));

function pick(hrefs: string[], ext: string, order: string[]): string | undefined {
  for (const v of order) {
    const found = hrefs.find((h) => h.toLowerCase().endsWith(`~${v}.${ext}`));
    if (found) return found;
  }
  return undefined;
}

/** Duración en segundos desde metadata.json; null si no la trae. */
export function nasaDuration(meta: NasaVideoMetadata): number | null {
  for (const key of ['QuickTime:Duration', 'Composite:Duration', 'QuickTime:MediaDuration', 'QuickTime:TrackDuration']) {
    const d = parseDuration(meta[key]);
    if (d !== null) return d;
  }
  return null;
}

export function normalizeNasaVideo(item: NasaVideoItem, meta: NasaVideoMetadata, assetHrefs: string[]): RawCard | null {
  const d = item.data?.[0];
  const id = d?.nasa_id?.trim();
  const title = d?.title ? stripTags(d.title) : '';
  if (!id || !title) return null;

  const description = stripTags(String(d?.description ?? meta['AVAIL:Description'] ?? ''));
  const rights = [description, meta['XMP:Rights'], meta['AVAIL:SecondaryCreator'], meta['XMP:Credit'], meta['IPTC:CopyrightNotice']]
    .filter((x) => typeof x === 'string')
    .join(' ');
  if (THIRD_PARTY.test(rights)) return null;

  const durationSec = nasaDuration(meta);
  const mp4 = pick(assetHrefs, 'mp4', MP4_PREFERENCE);
  if (durationSec === null || !mp4) return null;
  const poster = pick(assetHrefs, 'jpg', POSTER_PREFERENCE);

  const center = d?.center?.trim();
  const summary = description.length > 400 ? `${description.slice(0, 399).trimEnd()}…` : description;
  const published = d?.date_created && !Number.isNaN(Date.parse(d.date_created)) ? new Date(d.date_created).toISOString() : undefined;

  return {
    id: `${NASA_VIDEO_SOURCE.id}:${id}`,
    sourceId: NASA_VIDEO_SOURCE.id,
    externalId: id,
    type: 'video',
    topic: classifyTopic(title, description, 'espacio'),
    lang: 'en',
    title,
    summary: summary || undefined,
    imageUrl: poster ? assetUrl(poster) : undefined,
    url: `https://images.nasa.gov/details/${encodeURIComponent(id)}`,
    license: NASA_VIDEO_SOURCE.license,
    publishedAt: published,
    video: { url: assetUrl(mp4), mime: 'video/mp4', durationSec },
    credit: center ? `NASA ${center}` : 'NASA',
  };
}
