// Registro de fuentes. Solo APIs públicas sin key: nada que esconder en el binario.

import type { Source, SourceKind } from './types.ts';
import { MET_SOURCE } from './normalizers/met.ts';
import { COMMONS_SOURCE, WIKIPEDIA_SOURCES } from './normalizers/wikipedia.ts';
import { CONVERSATION_SOURCE } from './normalizers/conversation.ts';
import { WIKIDATA_ART_SOURCE } from './normalizers/wikidata.ts';
import { NASA_SOURCE } from './normalizers/nasa.ts';
import { SINC_SOURCE } from './normalizers/sinc.ts';
import { AIC_SOURCE, CLEVELAND_SOURCE, VAM_SOURCE } from './normalizers/museums.ts';
import { INATURALIST_SOURCE } from './normalizers/inaturalist.ts';
import { EPIC_SOURCE } from './normalizers/epic.ts';
import { EUROPEPMC_SOURCE } from './normalizers/europepmc.ts';

export const SOURCES: Record<string, Source> = Object.fromEntries(
  [
    MET_SOURCE, ...WIKIPEDIA_SOURCES, COMMONS_SOURCE, CONVERSATION_SOURCE, WIKIDATA_ART_SOURCE, NASA_SOURCE,
    SINC_SOURCE, AIC_SOURCE, CLEVELAND_SOURCE, VAM_SOURCE, INATURALIST_SOURCE, EPIC_SOURCE, EUROPEPMC_SOURCE,
  ].map((s) => [s.id, s]),
);

/** Fuente desconocida (p. ej. una tarjeta importada de una versión futura): confianza neutra. */
export function sourceKindOf(sourceId: string): SourceKind {
  return SOURCES[sourceId]?.kind ?? 'magazine';
}

export function sourceNameOf(sourceId: string): string {
  return SOURCES[sourceId]?.name ?? sourceId;
}
