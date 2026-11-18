// Europe PMC → RawCard (ciencia, artículos de investigación de acceso abierto).
// GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?...&resultType=core (sin key).
// Solo entran artículos con licencia Creative Commons; título y resumen suelen venir en
// inglés aunque el artículo esté en otro idioma, así que la tarjeta es `en`.

import type { RawCard, Source } from '../types.ts';
import { stripTags } from '../blocks.ts';
import { classifyTopic } from '../classify.ts';
import { estimateReadMinutes } from '../read-time.ts';

export const EUROPEPMC_SOURCE: Source = { id: 'europepmc', name: 'Europe PMC', kind: 'journal' };

export interface PmcResult {
  id: string;
  source?: string;
  pmcid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  journalInfo?: { journal?: { title?: string } };
  pubYear?: string;
  license?: string;
  isOpenAccess?: string;
  abstractText?: string;
}

const MAX_SUMMARY = 300;

export function normalizePmc(r: PmcResult): RawCard | null {
  const license = r.license?.trim().toLowerCase();
  const title = r.title ? stripTags(r.title).replace(/^\[(.*)\]\.?$/, '$1').replace(/\.$/, '') : '';
  const abstract = r.abstractText ? stripTags(r.abstractText) : '';
  if (!r.id || !title || !abstract || r.isOpenAccess !== 'Y' || !license?.startsWith('cc')) return null;

  const journal = r.journalTitle ?? r.journalInfo?.journal?.title;
  const summary = abstract.length > MAX_SUMMARY ? `${abstract.slice(0, MAX_SUMMARY - 1).trimEnd()}…` : abstract;
  const src = r.source ?? 'MED';
  return {
    id: `${EUROPEPMC_SOURCE.id}:${src}:${r.id}`,
    sourceId: EUROPEPMC_SOURCE.id,
    externalId: `${src}:${r.id}`,
    type: 'paper',
    topic: classifyTopic(title, abstract, 'ciencia'),
    lang: 'en',
    title,
    summary,
    url: `https://europepmc.org/article/${src}/${r.id}`,
    license: license.toUpperCase().replace(/^CC /, 'CC '),
    readMinutes: estimateReadMinutes(abstract),
    publishedAt: r.pubYear && /^\d{4}$/.test(r.pubYear) ? `${r.pubYear}-01-01T00:00:00.000Z` : undefined,
    body: [
      ...(r.authorString ? [{ kind: 'quote' as const, text: [r.authorString, journal, r.pubYear].filter(Boolean).join(' · ') }] : []),
      { kind: 'h' as const, text: 'Resumen' },
      { kind: 'p' as const, text: abstract },
    ],
  };
}
