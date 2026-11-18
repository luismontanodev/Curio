// Ingesta al abrir la app y al volver a primer plano, una sola vez para toda la app
// (antes vivía en el feed; ahora la pantalla principal es el Momento).

import { createContext, useContext, type ReactNode } from 'react';

import { useIngestOnOpen } from './use-ingest-on-open.ts';

type IngestValue = ReturnType<typeof useIngestOnOpen>;

const IngestContext = createContext<IngestValue | null>(null);

export function IngestProvider({ children }: { children: ReactNode }) {
  const value = useIngestOnOpen();
  return <IngestContext.Provider value={value}>{children}</IngestContext.Provider>;
}

export function useIngest(): IngestValue {
  const v = useContext(IngestContext);
  if (!v) throw new Error('useIngest debe usarse dentro de <IngestProvider>');
  return v;
}
