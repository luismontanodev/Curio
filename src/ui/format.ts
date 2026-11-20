// Textos que la interfaz deriva de los datos. Puro (sin React Native) para probarlo en Node.

import type { ImportReport } from '../backup/backup.ts';
import type { Reason } from '../core/recommend.ts';
import { sourceNameOf } from '../core/sources.ts';
import type { Card, CardType, FilterLevel, Lang, Topic } from '../core/types.ts';

export const TOPIC_LABELS: Record<Topic, string> = {
  ciencia: 'Ciencia',
  tecnologia: 'Tecnología',
  arte: 'Arte',
  cultura: 'Cultura',
  historia: 'Historia',
  naturaleza: 'Naturaleza',
  espacio: 'Espacio',
  musica: 'Música',
};

export const LEVEL_LABELS: Record<FilterLevel, string> = {
  suave: 'Suave',
  moderado: 'Moderado',
  estricto: 'Estricto',
};

export const LANG_LABELS: Record<Lang, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
};

/** "En inglés", "En francés"… para la línea de metadatos. */
const LANG_META: Record<Lang, string> = { es: 'En español', en: 'En inglés', fr: 'En francés', pt: 'En portugués' };

const TYPE_LABELS: Record<CardType, string> = {
  artwork: 'Obra de arte',
  image: 'Imagen',
  article: 'Artículo',
  paper: 'Artículo científico',
  event: 'Efeméride',
  video: 'Video',
};

/** Tipo según la fuente: un artículo de Wikipedia es "destacado"; uno de The Conversation, divulgación. */
function typeLabel(card: Card): string {
  if (card.type === 'artwork' && card.sourceId === 'met') return 'Obra de museo';
  if (card.type === 'image' && card.sourceId === 'wikimedia-commons') return 'Imagen del día';
  if (card.type === 'image' && card.sourceId === 'nasa') return 'Imagen de la NASA';
  if (card.type === 'article' && card.sourceId === 'theconversation') return 'Divulgación';
  if (card.type === 'article' && card.sourceId.startsWith('wikipedia-')) {
    return /^t?fa:/.test(card.externalId) ? 'Artículo destacado' : 'Artículo';
  }
  return TYPE_LABELS[card.type] ?? card.type;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cómo se dibuja la tarjeta. Las efemérides llevan su propio estilo; las obras e imágenes, imagen arriba. */
export type CardVariant = 'image' | 'text' | 'event';

export function cardVariant(card: Card): CardVariant {
  if (card.type === 'event') return 'event';
  // Imagen primero siempre que haya una: más familiar y menos texto que leer.
  if (card.imageUrl) return 'image';
  return 'text';
}

/** Licencia en pocas palabras para la línea de la tarjeta; la completa va en "Más" y en el lector. */
export function shortLicense(license?: string): string | undefined {
  if (!license) return undefined;
  if (/dominio p[uú]blico|public domain|CC0/i.test(license)) return 'Dominio público';
  const cc = /CC BY(-[A-Z]{2})*/i.exec(license);
  return cc ? cc[0].toUpperCase() : license;
}

/** Línea corta de transparencia: "The Met · Dominio público". */
export function cardSource(card: Card): string {
  return [sourceNameOf(card.sourceId), shortLicense(card.license)].filter(Boolean).join(' · ');
}

/** Etiqueta corta sobre el título: solo el tema ("Arte"), o la fecha si es efeméride. */
export function cardTopicLabel(card: Card, now = new Date()): string {
  return card.type === 'event' ? cardKicker(card, now) : TOPIC_LABELS[card.topic] ?? card.topic;
}

/**
 * Mes y día de una efeméride. El id externo lleva la fecha consultada (`otd:MMDD:…`);
 * si no se puede leer, se usa el día en que entró al teléfono.
 */
export function eventMonthDay(card: Card): { month: number; day: number } {
  const m = /^otd:(\d{2})(\d{2}):/.exec(card.externalId);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  const d = new Date(card.ingestedAt);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

/** Etiqueta sobre el título ("Arte · Obra de museo", "Hoy en la historia · 17 nov"). La UI la pone en mayúsculas. */
export function cardKicker(card: Card, now = new Date()): string {
  if (card.type === 'event') {
    const { month, day } = eventMonthDay(card);
    const isToday = month === now.getMonth() + 1 && day === now.getDate();
    return `${isToday ? 'Hoy en la historia' : 'En la historia'} · ${day} ${MONTHS[month - 1]}`;
  }
  return `${TOPIC_LABELS[card.topic] ?? card.topic} · ${typeLabel(card)}`;
}

/**
 * Línea de transparencia: fuente, licencia, idioma y tiempo de lectura. El idioma solo se
 * muestra si el usuario lee en más de uno (si todo está en español, decirlo es ruido).
 */
export function cardMeta(card: Card, opts: { showLang?: boolean } = {}): string {
  const parts = [sourceNameOf(card.sourceId)];
  if (card.license) parts.push(card.license);
  if (opts.showLang) parts.push(LANG_META[card.lang] ?? card.lang);
  if (card.readMinutes) parts.push(`Lectura de ${card.readMinutes} min`);
  return parts.join(' · ');
}

/** Por qué aparece una recomendación en Explorar (transparencia). */
export function reasonLabel(reason: Reason): string {
  if (reason.kind === 'topic') return `Porque guardaste ${(TOPIC_LABELS[reason.topic] ?? reason.topic).toLocaleLowerCase('es')}`;
  if (reason.kind === 'source') return `Porque guardaste de ${sourceNameOf(reason.sourceId)}`;
  return 'Nuevo para ti';
}

/** "17 nov 2026, 18:05" en la hora local del teléfono. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumen para el usuario después de importar un respaldo. */
export function importSummary(report: ImportReport, rejected: number): string {
  const parts: string[] = [];
  if (report.savedRemoved > 0) {
    parts.push(`Se quitaron ${plural(report.savedRemoved, 'guardado anterior', 'guardados anteriores')}`);
  }
  parts.push(`Se ${report.savedAdded === 1 ? 'agregó' : 'agregaron'} ${plural(report.savedAdded, 'guardado', 'guardados')}`);
  if (report.savedKept > 0) parts.push(`${report.savedKept} ya ${report.savedKept === 1 ? 'estaba' : 'estaban'}`);
  if (rejected > 0) {
    parts.push(`${rejected} se ${rejected === 1 ? 'descartó' : 'descartaron'} por venir incompleto${rejected === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}
