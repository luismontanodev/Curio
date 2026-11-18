// Texto completo en bloques simples (párrafo, subtítulo, cita, imagen) para leer dentro de la app.
// Puro y sin dependencias: convierte el HTML de las fuentes y el texto plano de Wikipedia.

import type { ContentBlock } from './types.ts';

const MAX_BLOCKS = 400;
const MAX_TEXT = 4000;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Quita etiquetas y deja el texto legible, en una sola línea. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const httpsUrl = (src: string): string | null => {
  const u = decodeEntities(src).trim();
  if (u.startsWith('https://')) return u;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`; // iOS bloquea http
  return null;
};

/**
 * HTML de un artículo → bloques. Solo entiende lo que usan las fuentes (p, h2–h4, blockquote,
 * figure/img/figcaption, li). Descarta scripts, estilos, iframes y píxeles de conteo:
 * nada que rastree al lector ni que lo saque de la app.
 */
export function htmlToBlocks(html: string): ContentBlock[] {
  const clean = html
    .replace(/<(script|style|iframe|noscript|svg)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const blocks: ContentBlock[] = [];
  const re = /<(p|h[1-6]|blockquote|li|figcaption)\b[^>]*>([\s\S]*?)<\/\1>|<img\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) && blocks.length < MAX_BLOCKS) {
    if (m[3] !== undefined) {
      const attrs = m[3];
      const src = /\bsrc\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? /\bsrc\s*=\s*'([^']+)'/i.exec(attrs)?.[1];
      const url = src ? httpsUrl(src) : null;
      const w = Number(/\bwidth\s*=\s*"?(\d+)/i.exec(attrs)?.[1] ?? NaN);
      const tracking = (url && /counter\.|\/count\.gif|pixel|beacon/i.test(url)) || (Number.isFinite(w) && w <= 2);
      if (url && !tracking) blocks.push({ kind: 'img', src: url });
      continue;
    }
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]).slice(0, MAX_TEXT);
    if (!text || text === '_') continue;
    if (tag === 'figcaption') {
      const last = blocks.at(-1);
      if (last?.kind === 'img' && !last.caption) last.caption = text;
      continue;
    }
    if (tag === 'blockquote') blocks.push({ kind: 'quote', text });
    else if (tag[0] === 'h') blocks.push({ kind: 'h', text });
    else if (tag === 'li') blocks.push({ kind: 'p', text: `• ${text}` });
    else blocks.push({ kind: 'p', text });
  }
  return blocks;
}

/** Secciones que no aportan a la lectura dentro de la app (todas son listas de enlaces). */
const SKIP_SECTIONS = new Set([
  'referencias', 'notas', 'bibliografia', 'enlaces externos', 'vease tambien', 'fuentes', 'notas y referencias',
  'references', 'notes', 'bibliography', 'external links', 'see also', 'further reading', 'sources', 'citations',
  'notes et references', 'liens externes', 'voir aussi', 'bibliographie', 'articles connexes',
  'referencias bibliograficas', 'ligacoes externas', 'ver tambem', 'bibliografia adicional',
]);

const plain = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Texto plano de Wikipedia (`prop=extracts&explaintext&exsectionformat=wiki`) → bloques.
 * Los encabezados llegan como "== Título ==". Se cortan referencias y enlaces externos.
 */
export function wikiTextToBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let skipLevel = 0; // nivel del encabezado que se está saltando (0 = ninguno)
  for (const raw of text.replace(/[​-‍﻿]/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = /^(={2,6})\s*(.*?)\s*\1$/.exec(line);
    if (h) {
      const level = h[1].length;
      if (skipLevel && level > skipLevel) continue;
      skipLevel = SKIP_SECTIONS.has(plain(h[2])) ? level : 0;
      if (!skipLevel && h[2]) blocks.push({ kind: 'h', text: h[2] });
      continue;
    }
    if (skipLevel) continue;
    blocks.push({ kind: 'p', text: line.slice(0, MAX_TEXT) });
    if (blocks.length >= MAX_BLOCKS) break;
  }
  // Un subtítulo sin texto debajo (su sección era solo una lista que se quitó) no aporta.
  return blocks.filter((b, i) => b.kind !== 'h' || (blocks[i + 1] && blocks[i + 1].kind !== 'h'));
}

/** Valida bloques que vienen de la base o de un respaldo importado (entrada no confiable). */
export function parseBlocks(input: unknown): ContentBlock[] {
  if (!Array.isArray(input)) return [];
  const out: ContentBlock[] = [];
  for (const b of input.slice(0, MAX_BLOCKS)) {
    if (typeof b !== 'object' || b === null) continue;
    const o = b as Record<string, unknown>;
    if ((o.kind === 'p' || o.kind === 'h' || o.kind === 'quote') && typeof o.text === 'string' && o.text.trim()) {
      out.push({ kind: o.kind, text: o.text.slice(0, MAX_TEXT) });
    } else if (o.kind === 'img' && typeof o.src === 'string') {
      const src = httpsUrl(o.src);
      if (!src) continue;
      const caption = typeof o.caption === 'string' && o.caption.trim() ? o.caption.slice(0, MAX_TEXT) : undefined;
      out.push(caption ? { kind: 'img', src, caption } : { kind: 'img', src });
    }
  }
  return out;
}
