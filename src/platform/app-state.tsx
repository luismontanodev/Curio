// Estado compartido por las pantallas: preferencias (con el tema resuelto) y guardados.
// Todo vive en SQLite; este contexto solo evita releerlo en cada pantalla.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import type { AppPrefs, Card } from '../core/types.ts';
import { listSavedIds, saveCard, unsaveCard } from '../db/cards.ts';
import { DEFAULT_PREFS, getPrefs, setPrefs } from '../db/prefs.ts';
import { theme as buildTheme, type Theme } from '../ui/theme.ts';

interface AppStateValue {
  prefs: AppPrefs;
  /** Guarda las preferencias (saneadas) y avisa a todas las pantallas. */
  updatePrefs: (next: AppPrefs) => Promise<void>;
  savedIds: ReadonlySet<string>;
  toggleSaved: (card: Card) => Promise<void>;
  removeSaved: (cardId: string) => Promise<void>;
  /** Relee todo de la base (p. ej. después de importar un respaldo). */
  reload: () => Promise<void>;
  /** Cambia cada vez que cambian los guardados: sirve como dependencia para recargar listas. */
  savedVersion: number;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [prefs, setPrefsState] = useState<AppPrefs | null>(null);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set());
  const [savedVersion, setSavedVersion] = useState(0);

  const reload = useCallback(async () => {
    const [p, ids] = await Promise.all([getPrefs(db), listSavedIds(db)]);
    setPrefsState(p);
    setSavedIds(ids);
    setSavedVersion((v) => v + 1);
  }, [db]);

  useEffect(() => {
    reload().catch((e) => {
      console.warn('No se pudieron leer las preferencias', e);
      setPrefsState({ ...DEFAULT_PREFS });
    });
  }, [reload]);

  const updatePrefs = useCallback(
    async (next: AppPrefs) => {
      setPrefsState(await setPrefs(db, next));
    },
    [db],
  );

  const removeSaved = useCallback(
    async (cardId: string) => {
      await unsaveCard(db, cardId);
      setSavedIds((prev) => {
        const s = new Set(prev);
        s.delete(cardId);
        return s;
      });
      setSavedVersion((v) => v + 1);
    },
    [db],
  );

  // Estable aunque cambien los guardados: si dependiera de `savedIds`, cada toque en
  // "Guardar" volvería a dibujar todas las tarjetas de la lista.
  const savedRef = useRef(savedIds);
  useEffect(() => {
    savedRef.current = savedIds;
  }, [savedIds]);

  const toggleSaved = useCallback(
    async (card: Card) => {
      if (savedRef.current.has(card.id)) return removeSaved(card.id);
      await saveCard(db, card);
      setSavedIds((prev) => new Set(prev).add(card.id));
      setSavedVersion((v) => v + 1);
    },
    [db, removeSaved],
  );

  const value = useMemo(
    () => (prefs ? { prefs, updatePrefs, savedIds, toggleSaved, removeSaved, reload, savedVersion } : null),
    [prefs, updatePrefs, savedIds, toggleSaved, removeSaved, reload, savedVersion],
  );

  // Hasta leer las preferencias no se pinta nada: evita un destello con el tema equivocado.
  if (!value) return null;
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(AppStateContext);
  if (!v) throw new Error('useAppState debe usarse dentro de <AppStateProvider>');
  return v;
}

/** Tema efectivo: la preferencia del usuario o, si es 'system', el del teléfono. */
export function useTheme(): Theme {
  const ctx = useContext(AppStateContext);
  const system = useColorScheme();
  const pref = ctx?.prefs.theme ?? 'system';
  const name = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return useMemo(() => buildTheme(name), [name]);
}
