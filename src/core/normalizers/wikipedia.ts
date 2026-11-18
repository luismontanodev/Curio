// Wikipedia (es, en, fr, pt) → RawCard
// Feed "featured": GET https://{lang}.wikipedia.org/api/rest_v1/feed/featured/{YYYY}/{MM}/{DD}
// Trae imagen del día (image), efemérides (onthisday) y, en algunos idiomas, artículo del día (tfa).
// `mostread` y `news` se ignoran a propósito: premian popularidad y urgencia.

import { LANGS, type Lang, type RawCard, type Source } from '../types.ts';
import { estimateReadMinutes } from '../read-time.ts';
import { classifyTopic } from '../classify.ts';

export function wikipediaSource(lang: Lang): Source {
  return { id: `wikipedia-${lang}`, name: 'Wikipedia', kind: 'encyclopedia', license: 'CC BY-SA 4.0' };
}

export const WIKIPEDIA_ES_SOURCE: Source = wikipediaSource('es');
export const WIKIPEDIA_SOURCES: Source[] = LANGS.map(wikipediaSource);

export const COMMONS_SOURCE: Source = {
  id: 'wikimedia-commons',
  name: 'Wikimedia Commons',
  kind: 'encyclopedia',
};

interface WikiPage {
  pageid?: number;
  title: string;
  titles?: { normalized?: string };
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

export interface OnThisDayEvent {
  text: string;
  year: number;
  pages: WikiPage[];
}

export interface FeaturedImage {
  title: string; // "File:Algo.jpg"
  thumbnail?: { source: string };
  description?: { text?: string; lang?: string };
  /** En la respuesta real llega a veces como objeto `{ html, text }` y a veces como texto plano. */
  artist?: string | { text?: string };
  license?: { type?: string };
  file_page?: string;
}

/**
 * Página de la API de acción (`generator=categorymembers` + `prop=extracts|pageimages|info`),
 * usada para los artículos destacados: el feed en español no trae `tfa`.
 */
export interface FeaturedArticlePage {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: { source: string };
  fullurl?: string;
}

export interface FeaturedFeed {
  tfa?: WikiPage;
  image?: FeaturedImage;
  onthisday?: OnThisDayEvent[];
}

const MAX_TITLE = 140;

/** Quita espacios de ancho cero (los extractos reales los traen junto a las referencias) y colapsa espacios. */
export function cleanText(text: string): string {
  return text.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

function clip(text: string, max = MAX_TITLE): string {
  const t = cleanText(text);
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const cleanOrUndefined = (text?: string) => (text ? cleanText(text) || undefined : undefined);

const pad = (n: number) => String(n).padStart(2, '0');

/** "(en la imagen)", "(pictured)", "(sur la photo)"… remiten a una foto que la efeméride no muestra. */
const PICTURED = /\s*\((en la (imagen|foto|fotografía)|pictured|illustré|sur la photo|na imagem|na foto)\)/gi;

export function normalizeOnThisDay(ev: OnThisDayEvent, month: number, day: number, lang: Lang = 'es'): RawCard | null {
  const page = ev.pages?.[0];
  const url = page?.content_urls?.desktop?.page;
  if (!ev.text?.trim() || !page || !url || !Number.isFinite(ev.year)) return null;

  const source = wikipediaSource(lang);
  const key = `otd:${pad(month)}${pad(day)}:${ev.year}:${page.pageid ?? page.title}`;
  return {
    id: `${source.id}:${key}`,
    sourceId: source.id,
    externalId: key,
    type: 'event',
    topic: 'historia',
    lang,
    title: `${ev.year}: ${clip(ev.text.replace(PICTURED, ''))}`,
    summary: cleanOrUndefined(page.extract),
    imageUrl: page.thumbnail?.source,
    url,
    license: source.license,
    readMinutes: page.extract ? estimateReadMinutes(page.extract) : undefined,
  };
}

export function normalizeFeaturedArticle(tfa: WikiPage, lang: Lang = 'es'): RawCard | null {
  const url = tfa.content_urls?.desktop?.page;
  const title = tfa.titles?.normalized ?? tfa.title;
  if (!url || !title?.trim()) return null;

  const source = wikipediaSource(lang);
  const key = `tfa:${tfa.pageid ?? title}`;
  const summary = cleanOrUndefined(tfa.extract);
  return {
    id: `${source.id}:${key}`,
    sourceId: source.id,
    externalId: key,
    type: 'article',
    topic: classifyTopic(title, summary ?? '', 'cultura'),
    lang,
    title: clip(title),
    summary,
    imageUrl: tfa.thumbnail?.source,
    url,
    license: source.license,
  };
}

/** "File:Gran_Cañón_al_atardecer.jpg" → "Gran Cañón al atardecer" */
export function fileTitleToText(fileTitle: string): string {
  return fileTitle
    .replace(/^(File|Archivo|Fichero|Fichier|Arquivo):/i, '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Imagen del día. El feed trae la descripción en el idioma de esa Wikipedia
 * (`description.lang`), que describe la imagen mejor que el nombre del archivo:
 * se usa como título y el nombre del archivo queda de respaldo.
 */
export function normalizePictureOfDay(img: FeaturedImage, feedLang: Lang = 'es'): RawCard | null {
  const imageUrl = img.thumbnail?.source;
  const url = img.file_page;
  const fileName = fileTitleToText(img.title ?? '');
  const description = cleanOrUndefined(img.description?.text);
  const title = description ?? fileName;
  if (!imageUrl || !url || !title || !img.title) return null;

  const descLang = img.description?.lang as Lang | undefined;
  const lang: Lang = description && descLang ? (LANGS.includes(descLang) ? descLang : 'en') : feedLang;
  const credit = cleanOrUndefined(typeof img.artist === 'string' ? img.artist : img.artist?.text);
  return {
    // Una por idioma: la misma imagen se describe distinto en cada Wikipedia.
    id: `${COMMONS_SOURCE.id}:${lang}:${img.title}`,
    sourceId: COMMONS_SOURCE.id,
    externalId: `${lang}:${img.title}`,
    type: 'image',
    topic: 'cultura',
    lang,
    title: clip(title),
    summary: credit ? `Imagen del día en Wikimedia Commons. Autor: ${credit}` : 'Imagen del día en Wikimedia Commons.',
    imageUrl,
    url,
    license: img.license?.type,
  };
}

/** Artículo destacado (categoría curada por la comunidad de Wikipedia, no por popularidad). */
export function normalizeFeaturedArticlePage(page: FeaturedArticlePage, lang: Lang = 'es'): RawCard | null {
  const url = page.fullurl;
  if (!url || !page.title?.trim() || !Number.isFinite(page.pageid)) return null;

  const source = wikipediaSource(lang);
  const key = `fa:${page.pageid}`;
  const summary = cleanOrUndefined(page.extract);
  return {
    id: `${source.id}:${key}`,
    sourceId: source.id,
    externalId: key,
    type: 'article',
    // La API no clasifica: se infiere por palabras clave y, si no hay señal clara, cultura.
    topic: classifyTopic(page.title, summary ?? '', 'cultura'),
    lang,
    title: clip(page.title),
    summary,
    imageUrl: page.thumbnail?.source,
    url,
    license: source.license,
  };
}

/**
 * Resultado de búsqueda (`generator=search`): misma forma que los destacados, pero con id
 * `pg:<pageid>` para que no se confunda con ellos (Destacados filtra por `fa:`/`tfa:`).
 */
export function normalizeSearchPage(page: FeaturedArticlePage, lang: Lang = 'es'): RawCard | null {
  const card = normalizeFeaturedArticlePage(page, lang);
  if (!card) return null;
  const key = `pg:${page.pageid}`;
  return { ...card, id: `${card.sourceId}:${key}`, externalId: key };
}

export function normalizeFeatured(feed: FeaturedFeed, month: number, day: number, lang: Lang = 'es'): RawCard[] {
  const out: (RawCard | null)[] = [
    feed.tfa ? normalizeFeaturedArticle(feed.tfa, lang) : null,
    feed.image ? normalizePictureOfDay(feed.image, lang) : null,
    ...(feed.onthisday ?? []).map((ev) => normalizeOnThisDay(ev, month, day, lang)),
  ];
  return out.filter((c): c is RawCard => c !== null);
}
