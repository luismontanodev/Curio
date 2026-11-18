// Destacados: artículos que la comunidad de Wikipedia revisó y marcó como de calidad, en los
// idiomas del usuario. También aparecen mezclados en Inicio; aquí se leen todos juntos.

import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TOPICS } from '../../src/core/types.ts';
import { wikipediaSource } from '../../src/core/normalizers/wikipedia.ts';
import type { Card } from '../../src/core/types.ts';
import { FeedCard } from '../../src/components/feed-card.tsx';
import { MoreFooter } from '../../src/components/more-footer.tsx';
import { ScreenTitle } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { useCardHandlers } from '../../src/platform/card-actions.ts';
import { useInfiniteFeed } from '../../src/platform/use-infinite-feed.ts';

export default function FeaturedScreen() {
  const t = useTheme();
  const c = t.colors;
  const { prefs, savedIds } = useAppState();
  const handlers = useCardHandlers();

  // Todos los temas: un destacado de música o de geografía también vale la pena aquí.
  // Idiomas y filtros de calidad, los del usuario.
  const featuredPrefs = useMemo(() => ({ ...prefs, topics: [...TOPICS] }), [prefs]);
  const sources = useMemo(() => prefs.languages.map((l) => wikipediaSource(l).id), [prefs.languages]);
  const { cards, loaded, more, loadMore, retryMore } = useInfiniteFeed({
    prefs: featuredPrefs,
    types: ['article'],
    sources,
    hideSeen: false, // es una sección para volver: lo ya visto sigue aquí
    only: ['articles'],
  });

  const renderItem = useCallback(
    ({ item }: { item: Card }) => <FeedCard card={item} saved={savedIds.has(item.id)} {...handlers} />,
    [savedIds, handlers],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <FlatList
        data={cards}
        keyExtractor={(card) => card.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <ScreenTitle>Destacados</ScreenTitle>
            <Text style={[t.type.body, { color: c.muted, paddingHorizontal: 20, marginBottom: 16 }]}>
              Artículos que la comunidad de Wikipedia revisó a fondo y marcó como destacados por su calidad.
            </Text>
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <MoreFooter more={more} onRetry={() => void retryMore()} />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primaryText} />
            </View>
          )
        }
        ListFooterComponent={cards.length > 0 ? <MoreFooter more={more} onRetry={() => void retryMore()} /> : undefined}
        ItemSeparatorComponent={Separator}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={1.5}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const Separator = () => <View style={{ height: 16 }} />;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { alignItems: 'center', paddingVertical: 64 },
});
