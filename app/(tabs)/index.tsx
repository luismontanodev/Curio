// Feed: scroll infinito (lo del teléfono y, al acabarse, más de las fuentes), filtros del
// usuario y una pausa sugerida cada N tarjetas.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
  type ListViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LocateFixed, Moon, ShieldCheck, SlidersHorizontal, Sun } from 'lucide-react-native';

import type { Topic } from '../../src/core/types.ts';
import { markSeen } from '../../src/db/cards.ts';
import type { JobKind } from '../../src/ingest/ingest.ts';
import { FeedCard } from '../../src/components/feed-card.tsx';
import { MoreFooter } from '../../src/components/more-footer.tsx';
import { PauseCard } from '../../src/components/pause-card.tsx';
import { Button, Chip, ICON, IconButton, Notice } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { useCardHandlers } from '../../src/platform/card-actions.ts';
import { useInfiniteFeed } from '../../src/platform/use-infinite-feed.ts';
import { useIngestOnOpen } from '../../src/platform/use-ingest-on-open.ts';
import { TOPIC_LABELS, withPauses, type FeedRow } from '../../src/ui/format.ts';

const SEEN_FLUSH_MS = 1500;

/** Con un tema elegido, "traer más" solo pide a las fuentes que lo alimentan. */
const TOPIC_JOBS: Record<Topic, JobKind[]> = {
  ciencia: ['conversation', 'articles'],
  tecnologia: ['conversation', 'articles'],
  arte: ['art', 'met', 'articles'],
  cultura: ['articles', 'featured'],
  historia: ['featured', 'articles'],
  naturaleza: ['conversation', 'articles'],
  espacio: ['nasa', 'conversation', 'articles'],
  musica: ['articles'],
};

export default function FeedScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const c = t.colors;
  const { prefs, updatePrefs, savedIds } = useAppState();
  const handlers = useCardHandlers();
  const { last, busy, refresh } = useIngestOnOpen();

  const [topic, setTopic] = useState<Topic | null>(null); // null = "Todo"
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedPauses, setDismissedPauses] = useState<ReadonlySet<string>>(new Set());
  const [resting, setResting] = useState(false);

  // Si el tema elegido ya no está en las preferencias, vuelve a "Todo".
  const activeTopic = topic && prefs.topics.includes(topic) ? topic : null;
  const feedPrefs = useMemo(() => (activeTopic ? { ...prefs, topics: [activeTopic] } : prefs), [prefs, activeTopic]);
  const feed = useInfiniteFeed({ prefs: feedPrefs, only: activeTopic ? TOPIC_JOBS[activeTopic] : undefined });
  const { cards, loaded, more, loadFirst, loadMore, retryMore } = feed;

  // Al cambiar de tema o de filtros, las pausas vuelven a empezar.
  useEffect(() => setDismissedPauses(new Set()), [feedPrefs]);

  // Llegaron tarjetas nuevas y el feed está vacío: se muestran de inmediato.
  // Si el usuario ya está leyendo, no se mueve la lista; aparecen al jalar para actualizar.
  useEffect(() => {
    if (last && last.inserted > 0 && cards.length === 0) void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  // Lista vacía con la ingesta de apertura ya terminada (p. ej. un tema sin tarjetas aún):
  // se pide más a la red sin esperar a que el usuario haga scroll.
  useEffect(() => {
    if (loaded && !busy && cards.length === 0 && more === 'idle') void loadMore();
  }, [loaded, busy, cards.length, more, loadMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      await loadFirst();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, loadFirst]);

  // --- Vistos: ≥ 60 % en pantalla durante ~1 s, guardados en lotes ---------------
  const pendingSeen = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSeen = useCallback(() => {
    flushTimer.current = null;
    const ids = [...pendingSeen.current];
    pendingSeen.current.clear();
    if (ids.length > 0) markSeen(db, ids).catch((e) => console.warn('No se pudieron marcar como vistas', e));
  }, [db]);

  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushSeen();
    },
    [flushSeen],
  );

  // FlatList exige que onViewableItemsChanged no cambie: se fija una vez y lee el flush por ref.
  const flushSeenRef = useRef(flushSeen);
  useEffect(() => {
    flushSeenRef.current = flushSeen;
  }, [flushSeen]);
  const onViewableItemsChanged = useRef(({ changed }: { changed: ListViewToken[] }) => {
    for (const v of changed) {
      const row = v.item as FeedRow;
      if (v.isViewable && row.kind === 'card') pendingSeen.current.add(row.card.id);
    }
    if (pendingSeen.current.size > 0 && !flushTimer.current) {
      flushTimer.current = setTimeout(() => flushSeenRef.current(), SEEN_FLUSH_MS);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 1000 }).current;

  // --- Filas ------------------------------------------------------------------
  const rows = useMemo(
    () => withPauses(cards, prefs.pauseEvery, dismissedPauses),
    [cards, prefs.pauseEvery, dismissedPauses],
  );

  const continueReading = useCallback((key: string) => setDismissedPauses((prev) => new Set(prev).add(key)), []);
  const stopForToday = useCallback(() => setResting(true), []);

  const renderItem = useCallback(
    ({ item }: { item: FeedRow }) =>
      item.kind === 'card' ? (
        <FeedCard card={item.card} saved={savedIds.has(item.card.id)} {...handlers} />
      ) : (
        <PauseCard onContinue={() => continueReading(item.key)} onStop={stopForToday} />
      ),
    [savedIds, handlers, continueReading, stopForToday],
  );

  const filterOn = prefs.hideSensational || prefs.hideClickbait;

  const header = useMemo(
    () => (
      <View>
        <View style={styles.topBar}>
          <View style={[styles.logo, { backgroundColor: c.primary, borderRadius: t.radius.logo }]}>
            <LocateFixed size={18} color={c.onPrimary} strokeWidth={2} />
          </View>
          <Text accessibilityRole="header" style={[t.type.logo, { color: c.text, flex: 1, marginLeft: 10 }]}>
            Curio
          </Text>
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todo" active={activeTopic === null} onPress={() => setTopic(null)} />
          {prefs.topics.map((tp) => (
            <Chip key={tp} label={TOPIC_LABELS[tp]} active={activeTopic === tp} onPress={() => setTopic(tp)} />
          ))}
        </ScrollView>

        <Pressable
          onPress={() => router.push('/filtros')}
          accessibilityRole="button"
          accessibilityHint="Abre los filtros"
          style={styles.status}
        >
          <ShieldCheck size={16} color={c.primaryText} strokeWidth={ICON.stroke} />
          <Text style={{ fontFamily: t.fonts.body.regular, fontSize: 13, color: c.muted, marginLeft: 8, flex: 1 }}>
            Filtro anti-sensacionalismo:{' '}
            <Text style={{ fontFamily: t.fonts.body.semibold, color: c.text }}>{filterOn ? prefs.level : 'apagado'}</Text>
          </Text>
        </Pressable>
      </View>
    ),
    [t, c, prefs, activeTopic, filterOn, updatePrefs],
  );

  const empty =
    !loaded || (busy && cards.length === 0) ? (
      <View style={styles.loading}>
        <ActivityIndicator color={c.primaryText} />
        <Text style={[t.type.body, { color: c.muted, marginTop: 12 }]}>Buscando tarjetas…</Text>
      </View>
    ) : (
      <MoreFooter more={more} onRetry={() => void retryMore()} />
    );

  if (resting) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.rest}>
          <Notice
            title="Buen momento para descansar"
            body="Lo que guardaste te espera en Guardados. El feed seguirá aquí cuando vuelvas."
          >
            <Button
              label="Volver al feed"
              variant="secondary"
              height={44}
              onPress={() => setResting(false)}
              style={{ marginTop: 24, alignSelf: 'stretch' }}
            />
          </Notice>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={cards.length > 0 ? <MoreFooter more={more} onRetry={() => void retryMore()} /> : undefined}
        ItemSeparatorComponent={Separator}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={1.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Tarjetas altas con imagen: pocas por lote para que el hilo de JS no se atore al hacer scroll.
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={60}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primaryText} colors={[c.primary]} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const Separator = () => <View style={{ height: 16 }} />;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 16, paddingTop: 12, paddingBottom: 12 },
  logo: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 44, marginBottom: 4 },
  loading: { alignItems: 'center', paddingVertical: 64 },
  rest: { flex: 1, justifyContent: 'center' },
});
