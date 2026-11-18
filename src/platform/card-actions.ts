// Abrir, compartir y guardar una tarjeta. Abrir lleva al lector de la app: nada sale de Curio.

import { useMemo } from 'react';
import { Alert, Share } from 'react-native';
import { router } from 'expo-router';

import type { Card } from '../core/types.ts';
import { useAppState } from './app-state.tsx';

/** Manejadores estables para <FeedCard>: leer, compartir y guardar, con errores en español. */
export function useCardHandlers() {
  const { toggleSaved } = useAppState();
  return useMemo(
    () => ({
      onOpen: (card: Card) => openReader(card.id),
      onShare: (card: Card) => {
        shareCard(card).catch(() => Alert.alert('No se pudo compartir', 'Inténtalo de nuevo en un momento.'));
      },
      onToggleSave: (card: Card) => {
        toggleSaved(card).catch(() => Alert.alert('No se pudo guardar', 'Inténtalo de nuevo en un momento.'));
      },
    }),
    [toggleSaved],
  );
}

export function openReader(cardId: string): void {
  router.push({ pathname: '/leer/[id]', params: { id: cardId } });
}

/** Solo se comparten enlaces http(s): la tarjeta pudo venir de un respaldo importado. */
const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

/** Compartir manda título y enlace al original a la hoja del sistema; la app no navega a ningún lado. */
export async function shareCard(card: Card): Promise<void> {
  if (!isWebUrl(card.url)) return;
  await Share.share({ title: card.title, message: `${card.title}\n${card.url}`, url: card.url });
}
