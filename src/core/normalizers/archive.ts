// Internet Archive (películas de colecciones curadas, p. ej. Prelinger y Ephemera) → RawCard.
// 1. GET https://archive.org/advancedsearch.php  (mediatype:movies, licencias de valor exacto)
// 2. GET https://archive.org/metadata/{identifier} → licencia (se verifica aquí, campo por campo)
//    y archivos: se usa el derivado "512Kb MPEG4" (≈ 3.7 MB por 52 s).
// Sin licencia clara → se descarta. Muchos son largos: solo entran los de 15–60 s (el resto
// queda para Profundizar o paquetes curados, más adelante).

import type { RawCard, Source } from '../types.ts';
import { stripTags } from '../blocks.ts';
import { classifyTopic } from '../classify.ts';
import { parseDuration } from '../video.ts';

export const ARCHIVE_SOURCE: Source = { id: 'internet-archive', name: 'Internet Archive', kind: 'museum' };

/** Licencias aceptadas (valor exacto de `licenseurl`, con y sin https/barra final) → etiqueta. */
const LICENSES: [RegExp, string][] = [
  [/^creativecommons\.org\/licenses\/publicdomain$/, 'Dominio público'],
  [/^creativecommons\.org\/publicdomain\/mark\/1\.0$/, 'Dominio público'],
  [/^creativecommons\.org\/publicdomain\/zero\/1\.0$/, 'CC0'],
  [/^creativecommons\.org\/licenses\/by\/(2\.0|2\.5|3\.0|4\.0)$/, 'CC BY'],
  [/^creativecommons\.org\/licenses\/by-sa\/(2\.0|2\.5|3\.0|4\.0)$/, 'CC BY-SA'],
];

/** Etiqueta de licencia, o null si no es de dominio público ni abierta (→ se descarta). */
export function archiveLicense(licenseurl: unknown): string | null {
  if (typeof licenseurl !== 'string') return null;
  const key = licenseurl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  for (const [re, label] of LICENSES) {
    const m = re.exec(key);
    if (m) return m[1] ? `${label} ${m[1]}` : label;
  }
  return null;
}

export interface ArchiveDoc {
  identifier: string;
  title?: string;
  licenseurl?: string;
  runtime?: string;
}

export interface ArchiveFile {
  name: string;
  format: string;
  length?: string;
  width?: string;
  height?: string;
}

export interface ArchiveMetadata {
  metadata?: {
    identifier?: string;
    title?: string;
    description?: string | string[];
    licenseurl?: string;
    creator?: string | string[];
    date?: string;
    year?: string;
    collection?: string | string[];
  };
  files?: ArchiveFile[];
}

/** Derivados MP4 en orden de preferencia: el más ligero primero. */
const MP4_FORMATS = ['512Kb MPEG4', 'h.264', 'MPEG4', 'h.264 IA'];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const download = (id: string, name: string) => `https://archive.org/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`;

export function normalizeArchive(meta: ArchiveMetadata): RawCard | null {
  const m = meta.metadata;
  const id = m?.identifier?.trim();
  const title = m?.title ? stripTags(m.title) : '';
  const license = archiveLicense(m?.licenseurl); // la licencia del elemento, no la de la búsqueda
  if (!id || !title || !license) return null;

  const files = meta.files ?? [];
  const mp4 = MP4_FORMATS.map((f) => files.find((x) => x.format === f && /\.mp4$/i.test(x.name))).find(Boolean);
  const durationSec = parseDuration(mp4?.length);
  if (!mp4 || durationSec === null) return null;

  const thumb =
    files.find((f) => f.format === 'Item Tile')?.name ??
    files.find((f) => f.format === 'Thumbnail')?.name;

  const description = stripTags(first(m?.description) ?? '');
  const year = m?.year ?? m?.date?.slice(0, 4);
  const creator = first(m?.creator)?.trim();
  const summary = [description.length > 400 ? `${description.slice(0, 399).trimEnd()}…` : description, year]
    .filter(Boolean)
    .join(' · ');
  const dim = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

  return {
    id: `${ARCHIVE_SOURCE.id}:${id}`,
    sourceId: ARCHIVE_SOURCE.id,
    externalId: id,
    type: 'video',
    topic: classifyTopic(title, description, 'historia'),
    lang: 'en',
    title,
    summary: summary || undefined,
    imageUrl: thumb ? download(id, thumb) : undefined,
    url: `https://archive.org/details/${encodeURIComponent(id)}`,
    license,
    video: {
      url: download(id, mp4.name),
      mime: 'video/mp4',
      durationSec,
      ...(dim(mp4.width) ? { width: dim(mp4.width)! } : {}),
      ...(dim(mp4.height) ? { height: dim(mp4.height)! } : {}),
    },
    ...(creator ? { credit: creator } : {}),
  };
}
