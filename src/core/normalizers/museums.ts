// Museos con API abierta y sin key → RawCard (arte, en inglés).
// - Art Institute of Chicago: dominio público (CC0), imágenes IIIF del tamaño que se pida.
// - Cleveland Museum of Art: Open Access CC0, con textos de sala y "fun facts".
// - Victoria and Albert Museum (V&A): diseño y artes decorativas; imágenes para uso no comercial.

import type { RawCard, Source } from '../types.ts';
import { stripTags } from '../blocks.ts';

export const AIC_SOURCE: Source = { id: 'aic', name: 'Art Institute of Chicago', kind: 'museum', license: 'CC0 · Dominio público' };
export const CLEVELAND_SOURCE: Source = { id: 'cleveland', name: 'Cleveland Museum of Art', kind: 'museum', license: 'CC0 · Dominio público' };
export const VAM_SOURCE: Source = { id: 'vam', name: 'V&A', kind: 'museum', license: '© V&A · uso no comercial' };

const join = (...parts: (string | undefined | null)[]) =>
  parts.map((p) => p?.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');

const paragraphs = (html?: string | null) =>
  html ? html.split(/<\/p>|\n{2,}/).map((p) => stripTags(p)).filter(Boolean) : [];

// --- Art Institute of Chicago ------------------------------------------------

export interface AicArtwork {
  id: number;
  title?: string;
  artist_display?: string;
  date_display?: string;
  medium_display?: string;
  image_id?: string | null;
  is_public_domain?: boolean;
  short_description?: string | null;
  description?: string | null;
  thumbnail?: { alt_text?: string } | null;
}

/** 843 px de ancho: el tamaño que el AIC recomienda (ya está en su caché). */
export const aicImageUrl = (iiif: string, imageId: string) => `${iiif}/${imageId}/full/843,/0/default.jpg`;

export function normalizeAic(a: AicArtwork, iiifUrl = 'https://www.artic.edu/iiif/2'): RawCard | null {
  if (!a.is_public_domain || !a.image_id || !a.title?.trim()) return null;
  const artist = a.artist_display?.split('\n')[0];
  const desc = paragraphs(a.description);
  const short = a.short_description ? stripTags(a.short_description) : desc[0];
  return {
    id: `${AIC_SOURCE.id}:${a.id}`,
    sourceId: AIC_SOURCE.id,
    externalId: String(a.id),
    type: 'artwork',
    topic: 'arte',
    lang: 'en',
    title: a.title.trim(),
    summary: join(artist, a.date_display, a.medium_display) || undefined,
    imageUrl: aicImageUrl(iiifUrl.replace(/^http:/, 'https:'), a.image_id),
    url: `https://www.artic.edu/artworks/${a.id}`,
    license: AIC_SOURCE.license,
    body: [short, ...desc.filter((p) => p !== short)].filter(Boolean).map((t) => ({ kind: 'p' as const, text: t! })).slice(0, 12) || undefined,
  };
}

// --- Cleveland Museum of Art -------------------------------------------------

export interface ClevelandArtwork {
  id: number;
  accession_number?: string;
  title?: string;
  creation_date?: string;
  creators?: { description?: string }[];
  type?: string;
  technique?: string;
  wall_description?: string | null;
  fun_fact?: string | null;
  digital_description?: string | null;
  share_license_status?: string;
  url?: string;
  images?: { web?: { url?: string } | null } | null;
}

export function normalizeCleveland(a: ClevelandArtwork): RawCard | null {
  const image = a.images?.web?.url;
  if (a.share_license_status !== 'CC0' || !image?.startsWith('https://') || !a.title?.trim()) return null;
  const creator = a.creators?.[0]?.description;
  const texts = [a.fun_fact, a.wall_description, a.digital_description].map((t) => (t ? stripTags(t) : '')).filter(Boolean);
  return {
    id: `${CLEVELAND_SOURCE.id}:${a.id}`,
    sourceId: CLEVELAND_SOURCE.id,
    externalId: String(a.id),
    type: 'artwork',
    topic: 'arte',
    lang: 'en',
    title: a.title.trim(),
    summary: join(creator, a.creation_date, a.technique) || undefined,
    imageUrl: image,
    url: a.url?.startsWith('https://') ? a.url : `https://clevelandart.org/art/${a.accession_number ?? a.id}`,
    license: CLEVELAND_SOURCE.license,
    body: texts.length ? texts.map((t) => ({ kind: 'p' as const, text: t })) : undefined,
  };
}

// --- Victoria and Albert Museum ----------------------------------------------

export interface VamRecord {
  systemNumber: string;
  objectType?: string;
  _primaryTitle?: string;
  _primaryMaker?: { name?: string };
  _primaryDate?: string;
  _primaryPlace?: string;
  _images?: { _iiif_image_base_url?: string };
}

export function normalizeVam(r: VamRecord): RawCard | null {
  const base = r._images?._iiif_image_base_url;
  const title = r._primaryTitle?.trim() || r.objectType?.trim();
  if (!r.systemNumber || !base?.startsWith('https://') || !title) return null;
  return {
    id: `${VAM_SOURCE.id}:${r.systemNumber}`,
    sourceId: VAM_SOURCE.id,
    externalId: r.systemNumber,
    type: 'artwork',
    topic: 'arte',
    lang: 'en',
    title,
    summary: join(r._primaryMaker?.name, r._primaryDate, r._primaryPlace, r.objectType !== title ? r.objectType : undefined) || undefined,
    imageUrl: `${base.replace(/\/?$/, '/')}full/!800,800/0/default.jpg`,
    url: `https://collections.vam.ac.uk/item/${r.systemNumber}/`,
    license: VAM_SOURCE.license,
  };
}
