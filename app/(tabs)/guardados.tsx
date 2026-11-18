// Guardados: copias completas, más recientes primero. Sobreviven a la poda del feed.

import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import type { Card } from '../../src/core/types.ts';
import { listSaved, type SavedCard } from '../../src/db/cards.ts';
import { FeedCard } from '../../src/components/feed-card.tsx';
import { Notice, ScreenTitle } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { useCardHandlers } from '../../src/platform/card-actions.ts';

export default function SavedScreen() {
  const db = useSQLiteContext();
  const c = useTheme().colors;
  const { removeSaved, savedVersion } = useAppState();
  const { onOpen, onShare } = useCardHandlers();
  const [items, setItems] = useState<SavedCard[] | null>(null);

  // Se relee al entrar a la pestaña y cada vez que cambian los guardados.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listSaved(db)
        .then((s) => !cancelled && setItems(s))
        .catch((e) => console.warn('No se pudieron leer los guardados', e));
      return () => {
        cancelled = true;
      };
    }, [db, savedVersion]),
  );

  // Quitar pide confirmación: un guardado puede ya no existir en el feed.
  const confirmRemove = useCallback(
    (card: Card) => {
      Alert.alert('¿Quitar de guardados?', card.title, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            removeSaved(card.id).catch(() => Alert.alert('No se pudo quitar', 'Inténtalo de nuevo en un momento.'));
          },
        },
      ]);
    },
    [removeSaved],
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedCard }) => (
      <FeedCard card={item.card} saved onOpen={onOpen} onShare={onShare} onToggleSave={confirmRemove} onLongPress={confirmRemove} />
    ),
    [onOpen, onShare, confirmRemove],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenTitle>Guardados</ScreenTitle>
      <FlatList
        data={items ?? []}
        keyExtractor={(s) => s.card.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        ListEmptyComponent={
          items === null ? undefined : (
            <Notice
              title="Aquí aparecerán las tarjetas que guardes"
              body="Toca el marcador de cualquier tarjeta. Lo guardado se queda en tu teléfono y viaja en tu respaldo."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const Separator = () => <View style={{ height: 16 }} />;

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
