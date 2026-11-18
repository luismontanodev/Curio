// Destacados (inicio): artículos que la comunidad de Wikipedia revisó y marcó como de calidad,
// en los idiomas del usuario. Es "lo que sigues": vuelve aquí y siempre hay algo que vale la pena.

import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LocateFixed, Moon, SlidersHorizontal, Sun } from 'lucide-react-native';

import { TOPICS } from '../../src/core/types.ts';
import { wikipediaSource } from '../../src/core/normalizers/wikipedia.ts';
import type { Card } from '../../src/core/types.ts';
import { FeedCard } from '../../src/components/feed-card.tsx';
import { MoreFooter } from '../../src/components/more-footer.tsx';
import { ICON, IconButton } from '../../src/components/primitives.tsx';
import { useIngest } from '../../src/platform/ingest-context.tsx';
import { useTabReselect } from '../../src/platform/use-tab-reselect.ts';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { useCardHandlers } from '../../src/platform/card-actions.ts';
import { useInfiniteFeed } from '../../src/platform/use-infinite-feed.ts';

export default function FeaturedScreen() {
  const t = useTheme();
  const c = t.colors;
  const { prefs, savedIds, updatePrefs } = useAppState();
  const handlers = useCardHandlers();
  const { refresh } = useIngest();
  const [refreshing, setRefreshing] = useState(false);

  // Todos los temas: un destacado de música o de geografía también vale la pena aquí.
  // Idiomas y filtros de calidad, los del usuario.
  const featuredPrefs = useMemo(() => ({ ...prefs, topics: [...TOPICS] }), [prefs]);
  const sources = useMemo(() => prefs.languages.map((l) => wikipediaSource(l).id), [prefs.languages]);
  const { cards, loaded, more, loadFirst, loadMore, retryMore } = useInfiniteFeed({
    prefs: featuredPrefs,
    types: ['article'],
    sources,
    externalPrefixes: ['fa:', 'tfa:'], // destacados de verdad, no resultados de búsqueda
    hideSeen: false, // es una sección para volver: lo ya visto sigue aquí
    only: ['articles'],
  });

  const renderItem = useCallback(
    // Un poco de texto bajo el título (2 líneas): da contexto sin llenar la pantalla.
    ({ item }: { item: Card }) => <FeedCard card={item} saved={savedIds.has(item.id)} teaserLines={2} {...handlers} />,
    [savedIds, handlers],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      await loadFirst();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, loadFirst]);

  // Tocar "Destacados" estando aquí: sube al inicio y actualiza.
  const list = useRef<FlatList<Card>>(null);
  useTabReselect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    void onRefresh();
  });

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <FlatList
        ref={list}
        data={cards}
        keyExtractor={(card) => card.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={[styles.logo, { backgroundColor: c.primary, borderRadius: t.radius.logo }]}>
                <LocateFixed size={18} color={c.onPrimary} strokeWidth={2} />
              </View>
              <Text style={[t.type.logo, { color: c.text, flex: 1, marginLeft: 10 }]}>Curio</Text>
              <IconButton
                label={t.name === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
                onPress={() => void updatePrefs({ ...prefs, theme: t.name === 'dark' ? 'light' : 'dark' })}
              >
                {t.name === 'dark' ? (
                  <Sun size={ICON.size} color={c.text} strokeWidth={ICON.stroke} />
                ) : (
                  <Moon size={ICON.size} color={c.text} strokeWidth={ICON.stroke} />
                )}
              </IconButton>
              <View style={{ width: 8 }} />
              <IconButton label="Filtros" filled onPress={() => router.push('/filtros')}>
                <SlidersHorizontal size={ICON.size} color={c.primaryText} strokeWidth={ICON.stroke} />
              </IconButton>
            </View>
            <Text accessibilityRole="header" style={[t.type.screenTitle, { color: c.text, paddingHorizontal: 20 }]}>
              Destacados
            </Text>
            <Text style={[t.type.body, { color: c.muted, paddingHorizontal: 20, marginTop: 4, marginBottom: 16 }]}>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primaryText} colors={[c.primary]} />
        }
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
  topBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 16, paddingTop: 12, paddingBottom: 12 },
  logo: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
