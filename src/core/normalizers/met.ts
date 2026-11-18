// The Met Collection API → RawCard
// GET https://collectionapi.metmuseum.org/public/collection/v1/objects/{objectID}
// Solo se aceptan obras de dominio público con imagen.

import type { RawCard, Source } from '../types.ts';

export const MET_SOURCE: Source = {
  id: 'met',
  name: 'The Met',
  kind: 'museum',
  license: 'CC0 · Dominio público',
};

/** Subconjunto de campos de la respuesta que usamos. */
export interface MetObject {
  objectID: number;
  isPublicDomain: boolean;
  primaryImageSmall?: string;
  primaryImage?: string;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  medium?: string;
  department?: string;
  culture?: string;
  objectURL?: string;
}

export function normalizeMet(obj: MetObject): RawCard | null {
  const image = obj.primaryImageSmall || obj.primaryImage;
  if (!obj.isPublicDomain || !image || !obj.title?.trim()) return null;

  const summary = [obj.artistDisplayName, obj.objectDate, obj.medium]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');

  return {
    id: `met:${obj.objectID}`,
    sourceId: MET_SOURCE.id,
    externalId: String(obj.objectID),
    type: 'artwork',
    topic: 'arte',
    lang: 'en', // los metadatos del Met vienen en inglés
    title: obj.title.trim(),
    summary: summary || undefined,
    imageUrl: image,
    url: obj.objectURL ?? `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
    license: MET_SOURCE.license,
  };
}
