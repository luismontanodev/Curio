// Arte vía Wikidata (SPARQL) → RawCard, en el idioma que el usuario lee.
// Pinturas con imagen en Commons y artículo en la Wikipedia de ese idioma: título, autor y
// fecha llegan traducidos por la comunidad, y el artículo se lee completo dentro de la app.

import type { Lang, RawCard, Source } from '../types.ts';

export const WIKIDATA_ART_SOURCE: Source = {
  id: 'wikidata-arte',
  name: 'Wikipedia · Wikimedia Commons',
  kind: 'encyclopedia',
  license: 'Texto CC BY-SA 4.0 · Imagen de Commons',
};

interface Binding {
  value: string;
}

export interface ArtBinding {
  item: Binding;
  label: Binding;
  image: Binding;
  article: Binding;
  creatorLabel?: Binding;
  inception?: Binding;
  description?: Binding;
}

/** `http://commons.wikimedia.org/wiki/Special:FilePath/X.jpg` → https y con ancho acotado. */
export function commonsImageUrl(filePath: string, width = 960): string | null {
  const m = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/(.+)$/.exec(filePath);
  if (!m) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=${width}`;
}

/** Año de un `xsd:dateTime` de Wikidata ("1660-01-01T00:00:00Z", "-0350-…" = 351 a. C.). */
export function yearOf(iso?: string): string | undefined {
  const m = /^(-?)(\d{1,4})-/.exec(iso ?? '');
  if (!m) return undefined;
  const y = Number(m[2]);
  return m[1] ? `${y + 1} a. C.` : String(y);
}

export function normalizeArtBinding(b: ArtBinding, lang: Lang): RawCard | null {
  const qid = /\/(Q\d+)$/.exec(b.item?.value ?? '')?.[1];
  const imageUrl = b.image ? commonsImageUrl(b.image.value) : null;
  const url = b.article?.value;
  const title = b.label?.value?.trim();
  if (!qid || !imageUrl || !url?.startsWith('https://') || !title || /^Q\d+$/.test(title)) return null;

  const creator = b.creatorLabel?.value?.trim();
  const year = yearOf(b.inception?.value);
  // "cuadro de Vincent van Gogh" repite al autor que ya va en el resumen: se omite.
  const rawDesc = b.description?.value?.trim();
  const desc = rawDesc && !(creator && rawDesc.toLowerCase().includes(creator.toLowerCase())) ? rawDesc : undefined;
  const summary = [creator && !/^Q\d+$/.test(creator) ? creator : undefined, year, desc]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `${WIKIDATA_ART_SOURCE.id}:${lang}:${qid}`,
    sourceId: WIKIDATA_ART_SOURCE.id,
    externalId: `${lang}:${qid}`,
    type: 'artwork',
    topic: 'arte',
    lang,
    title,
    summary: summary || undefined,
    imageUrl,
    url,
    license: WIKIDATA_ART_SOURCE.license,
  };
}
