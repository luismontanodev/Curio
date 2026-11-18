// NASA EPIC → RawCard: la Tierra completa, fotografiada desde el satélite DSCOVR.
// GET https://epic.gsfc.nasa.gov/api/natural (sin key, dominio público).
// El texto se calcula de los datos (fecha, distancia y centro de la foto): honesto por
// construcción, así que se puede dar en cualquier idioma de la app.

import type { Lang, RawCard, Source } from '../types.ts';

export const EPIC_SOURCE: Source = { id: 'nasa-epic', name: 'NASA EPIC', kind: 'journal', license: 'Dominio público (NASA)' };

export interface EpicImage {
  identifier: string;
  image: string; // "epic_1b_20261114004554"
  date: string; // "2026-11-14 00:41:06"
  centroid_coordinates?: { lat: number; lon: number };
  dscovr_j2000_position?: { x: number; y: number; z: number };
}

const TEXT: Record<'es' | 'en', { title: (d: string) => string; summary: (km: string, lat: string, lon: string) => string }> = {
  es: {
    title: (d) => `La Tierra completa, vista desde el espacio el ${d}`,
    summary: (km, lat, lon) => `Foto de la cámara EPIC de la NASA, a unos ${km} km de distancia. En el centro: latitud ${lat}, longitud ${lon}.`,
  },
  en: {
    title: (d) => `The whole Earth, seen from space on ${d}`,
    summary: (km, lat, lon) => `Taken by NASA's EPIC camera about ${km} km away. Center of the image: latitude ${lat}, longitude ${lon}.`,
  },
};

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Solo español e inglés: es una foto del día, no vale la pena repetirla en cada idioma. */
export function normalizeEpic(img: EpicImage, lang: Lang): RawCard | null {
  if (lang !== 'es' && lang !== 'en') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(img.date ?? '');
  if (!m || !/^epic_[\w]+$/.test(img.image ?? '')) return null;
  const [, y, mo, d] = m;
  const pos = img.dscovr_j2000_position;
  const km = pos ? Math.round(Math.hypot(pos.x, pos.y, pos.z) / 10_000) * 10_000 : null;
  const c = img.centroid_coordinates;
  const day = lang === 'es' ? `${Number(d)} de ${MONTHS_ES[Number(mo) - 1]} de ${y}` : `${MONTHS_EN[Number(mo) - 1]} ${Number(d)}, ${y}`;
  const fmt = (n: number) => n.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US');

  return {
    id: `${EPIC_SOURCE.id}:${lang}:${y}${mo}${d}`,
    sourceId: EPIC_SOURCE.id,
    externalId: `${lang}:${y}${mo}${d}`,
    type: 'image',
    topic: 'espacio',
    lang,
    title: TEXT[lang].title(day),
    summary: km && c ? TEXT[lang].summary(fmt(km), c.lat.toFixed(1), c.lon.toFixed(1)) : undefined,
    imageUrl: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${mo}/${d}/jpg/${img.image}.jpg`,
    url: `https://epic.gsfc.nasa.gov/?date=${y}-${mo}-${d}`,
    license: EPIC_SOURCE.license,
  };
}
