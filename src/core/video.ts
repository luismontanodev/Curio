// Video corto: duraciones, validación y cuántos videos caben en una lista. Puro y probado.

import type { Card, DataSaverMode, VideoInfo, VideoMime } from './types.ts';

/** Un video entra como momento principal solo si dura entre 15 y 60 s. */
export const MOMENT_MIN_SEC = 15;
export const MOMENT_MAX_SEC = 60;
export const VIDEO_MIMES: readonly VideoMime[] = ['video/mp4', 'video/quicktime'];

export const isMomentLength = (sec: number | null | undefined): sec is number =>
  typeof sec === 'number' && Number.isFinite(sec) && sec >= MOMENT_MIN_SEC && sec <= MOMENT_MAX_SEC;

/**
 * Segundos a partir de los formatos reales de las fuentes:
 * NASA "0:01:35" o "27.73 s"; Internet Archive "0:52", "00:01:00", "15:00" o "178.02".
 * Formato desconocido → null (y el video no entra como momento).
 */
export function parseDuration(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  let m = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?$/i.exec(t);
  if (m) return Number(m[1]) > 0 ? Number(m[1]) : null;
  return null;
}

/** "0:42", "1:05". */
export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const u = v.trim();
  if (u.startsWith('https://')) return u;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  return null;
};

/** Valida un video que viene de la base o de un respaldo (entrada no confiable). */
export function parseVideo(input: unknown): VideoInfo | null {
  if (typeof input !== 'object' || input === null) return null;
  const o = input as Record<string, unknown>;
  const url = httpsUrl(o.url);
  const mime = VIDEO_MIMES.includes(o.mime as VideoMime) ? (o.mime as VideoMime) : null;
  const durationSec = parseDuration(o.durationSec);
  if (!url || !mime || durationSec === null || durationSec > 6 * 3600) return null;
  const dim = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 10_000 ? v : undefined);
  const width = dim(o.width);
  const height = dim(o.height);
  return { url, mime, durationSec, ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

/**
 * Listas (Destacados, Explorar): más posts que videos. Un video solo entra si antes hubo al
 * menos `postsPerVideo` posts desde el último video; los demás se quedan fuera de esta página.
 */
export function capVideos(cards: Card[], postsPerVideo = 4): Card[] {
  const out: Card[] = [];
  let sinceVideo = 0; // el primer video llega después de los primeros posts
  for (const c of cards) {
    if (c.type === 'video') {
      if (sinceVideo < postsPerVideo) continue;
      sinceVideo = 0;
    } else {
      sinceVideo++;
    }
    out.push(c);
  }
  return out;
}

/** Intercala videos entre posts: uno después de cada `postsPerVideo` posts (Destacados). */
export function interleaveVideos(posts: Card[], videos: Card[], postsPerVideo = 4): Card[] {
  const out: Card[] = [];
  let v = 0;
  posts.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % postsPerVideo === 0 && v < videos.length) out.push(videos[v++]);
  });
  return out;
}

/**
 * Idiomas para videos: los del usuario más inglés. Las tres fuentes de video publican en
 * inglés y el video es sobre todo visual; la tarjeta muestra "En inglés" (decisión 2026-11-18).
 */
export function videoLanguages<L extends string>(languages: readonly L[]): (L | 'en')[] {
  return languages.includes('en' as L) ? [...languages] : [...languages, 'en'];
}

/** Tipo de conexión, reducido a lo que importa para gastar datos. */
export type Connection = 'wifi' | 'cellular' | 'offline' | 'unknown';

/**
 * ¿Hay que ahorrar datos ahora? Con 'cellular', solo con datos móviles o si la red aún no
 * se conoce (más vale no arrancar un video que gastar datos sin querer).
 */
export function savingData(mode: DataSaverMode, connection: Connection): boolean {
  if (mode === 'always') return true;
  if (mode === 'off') return false;
  return connection === 'cellular' || connection === 'unknown';
}
