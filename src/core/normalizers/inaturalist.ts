// iNaturalist → RawCard (Naturaleza). Observaciones de "grado de investigación" (identificación
// verificada por la comunidad) con foto bajo CC BY o CC0. El nombre común llega en el idioma
// pedido (`locale`), así que sirve para los cuatro idiomas.

import type { Lang, RawCard, Source } from '../types.ts';

export const INATURALIST_SOURCE: Source = { id: 'inaturalist', name: 'iNaturalist', kind: 'encyclopedia' };

export interface InatObservation {
  id: number;
  observed_on?: string | null;
  place_guess?: string | null;
  license_code?: string | null;
  user?: { login?: string; name?: string | null };
  taxon?: {
    id: number;
    name?: string;
    rank?: string;
    preferred_common_name?: string | null;
    iconic_taxon_name?: string | null;
  } | null;
  photos?: { url?: string; license_code?: string | null; attribution?: string }[];
}

const LICENSES: Record<string, string> = { 'cc-by': 'CC BY 4.0', cc0: 'CC0 · Dominio público' };

/** "…/square.jpg" → "…/large.jpg" (1024 px; `square` es de 75 px). */
export const inatPhotoUrl = (url: string) => url.replace(/\/(square|thumb|small|medium)\.(jpe?g|png)$/i, '/large.$2');

const MONTHS: Record<Lang, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
};

/** "Fotografiada en Hawera en octubre de 2014 por Emily Roberts", en el idioma de la tarjeta. */
function caption(o: InatObservation, lang: Lang): string {
  const who = o.user?.name?.trim() || o.user?.login;
  const d = o.observed_on && /^(\d{4})-(\d{2})/.exec(o.observed_on);
  const when = d ? `${MONTHS[lang][Number(d[2]) - 1]} ${lang === 'en' ? '' : lang === 'fr' ? '' : 'de '}${d[1]}` : undefined;
  const where = o.place_guess?.trim();
  const t = {
    es: ['Fotografiada', 'en', 'en', 'por'],
    en: ['Photographed', 'in', 'in', 'by'],
    fr: ['Photographiée', 'à', 'en', 'par'],
    pt: ['Fotografada', 'em', 'em', 'por'],
  }[lang];
  return [t[0], where && `${t[1]} ${where}`, when && `${t[2]} ${when}`, who && `${t[3]} ${who}`].filter(Boolean).join(' ') + '.';
}

export function normalizeObservation(o: InatObservation, lang: Lang): RawCard | null {
  const photo = o.photos?.[0];
  const license = LICENSES[photo?.license_code ?? ''];
  const taxon = o.taxon;
  if (!photo?.url?.startsWith('https://') || !license || !taxon?.name) return null;

  const common = taxon.preferred_common_name?.trim();
  const title = common ? `${common.charAt(0).toLocaleUpperCase(lang)}${common.slice(1)}` : taxon.name;
  return {
    id: `${INATURALIST_SOURCE.id}:${lang}:${o.id}`,
    sourceId: INATURALIST_SOURCE.id,
    externalId: `${lang}:${o.id}`,
    type: 'image',
    topic: 'naturaleza',
    lang,
    title,
    summary: [common ? taxon.name : undefined, caption(o, lang)].filter(Boolean).join(' · '),
    imageUrl: inatPhotoUrl(photo.url),
    url: `https://www.inaturalist.org/observations/${o.id}`,
    license: photo.attribution ? `${license} · ${photo.attribution.replace(/,? some rights reserved.*$/i, '').trim()}` : license,
  };
}
