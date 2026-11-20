// Wikimedia Commons (videos) → RawCard.
// GET https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:video …
//     &prop=imageinfo|videoinfo&iiprop=url|mime|size|extmetadata&viprop=derivatives
// Commons guarda WebM/Ogg, que iOS no reproduce de forma nativa. Pero ofrece una
// transcodificación **360p.mpeg4.mov** (MPEG-4 Part 2 en QuickTime, ≈ 0.9 Mbps) que iOS y
// Android sí reproducen: es la que se usa. ⚠️ Pendiente de verificar en un iPhone real.

import type { RawCard, Source } from '../types.ts';
import { stripTags } from '../blocks.ts';
import { classifyTopic } from '../classify.ts';
import { fileTitleToText } from './wikipedia.ts';

export const COMMONS_VIDEO_SOURCE: Source = { id: 'commons-video', name: 'Wikimedia Commons', kind: 'encyclopedia' };

export interface CommonsVideoPage {
  pageid?: number;
  title: string; // "File:Algo.webm"
  imageinfo?: {
    url?: string;
    descriptionurl?: string;
    duration?: number;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
  videoinfo?: {
    duration?: number;
    derivatives?: { src: string; type?: string; transcodekey?: string; width?: number; height?: number; bandwidth?: number }[];
  }[];
}

/** La transcodificación que se reproduce en iOS y Android. */
export const IOS_DERIVATIVE = '360p.mpeg4.mov';

/** Licencias libres que Commons usa (Commons no admite NC ni ND). */
const FREE_LICENSE = /^(CC0|CC BY(-SA)? \d\.\d|CC BY(-SA)?|Public domain|PD.*)$/i;

/**
 * Póster: Commons genera fotogramas de video como miniaturas
 * (…/thumb/2/28/X.webm/{ancho}px--X.webm.jpg). 960 px es un tamaño estándar de Wikimedia.
 */
export function commonsVideoPoster(fileUrl: string, width = 960): string | undefined {
  // La API agrega parámetros de seguimiento (?utm_source=…): se quitan.
  const clean = fileUrl.replace(/[?#].*$/, '');
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w\/\w\w)\/([^/?#]+)$/.exec(clean);
  return m ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${width}px--${m[2]}.jpg` : undefined;
}

const meta = (p: CommonsVideoPage, key: string) => {
  const v = p.imageinfo?.[0]?.extmetadata?.[key]?.value;
  return v ? stripTags(v) : undefined;
};

export function normalizeCommonsVideo(p: CommonsVideoPage): RawCard | null {
  const ii = p.imageinfo?.[0];
  const vi = p.videoinfo?.[0];
  const license = meta(p, 'LicenseShortName');
  const derivative = vi?.derivatives?.find((d) => d.transcodekey === IOS_DERIVATIVE);
  const durationSec = vi?.duration ?? ii?.duration;
  const title = fileTitleToText(p.title ?? '');
  if (!ii?.url || !ii.descriptionurl || !derivative?.src.startsWith('https://') || !title) return null;
  if (!license || !FREE_LICENSE.test(license) || typeof durationSec !== 'number') return null;

  const description = meta(p, 'ImageDescription') ?? '';
  const artist = meta(p, 'Artist');
  const summary = description.length > 400 ? `${description.slice(0, 399).trimEnd()}…` : description;

  return {
    id: `${COMMONS_VIDEO_SOURCE.id}:${p.title}`,
    sourceId: COMMONS_VIDEO_SOURCE.id,
    externalId: p.title,
    type: 'video',
    topic: classifyTopic(title, description, 'naturaleza'),
    lang: 'en',
    title,
    summary: summary || undefined,
    imageUrl: commonsVideoPoster(ii.url),
    url: ii.descriptionurl,
    license,
    video: {
      url: derivative.src,
      mime: 'video/quicktime',
      durationSec,
      ...(derivative.width ? { width: derivative.width } : {}),
      ...(derivative.height ? { height: derivative.height } : {}),
    },
    ...(artist ? { credit: artist } : {}),
  };
}
