// Explorar: cuadrícula de 2 columnas (como Instagram) con recomendaciones para ti (locales,
// por intención y con su porqué) y búsqueda en tu teléfono y en Wikipedia. Chips por tema.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react-native';

import { TOPICS, type Card, type Topic } from '../../src/core/types.ts';
import { ExploreTile } from '../../src/components/explore-tile.tsx';
import { MoreFooter } from '../../src/components/more-footer.tsx';
import { Chip, ICON, IconButton, Notice, SectionLabel } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { useCardHandlers } from '../../src/platform/card-actions.ts';
import { useRecommendations, useSearch } from '../../src/platform/use-explore.ts';
import { useTabReselect } from '../../src/platform/use-tab-reselect.ts';
import { TOPIC_LABELS, reasonLabel } from '../../src/ui/format.ts';

type Tile = { card: Card; note?: string };
type Row =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'pair'; key: string; tiles: Tile[] }
  | { kind: 'note'; key: string; text: string };

const GUTTER = 16;
const GAP = 12;

/** Agrupa de dos en dos: cada fila de la lista es una fila de la cuadrícula. */
function pairs(tiles: Tile[], prefix: string): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < tiles.length; i += 2) {
    const two = tiles.slice(i, i + 2);
    out.push({ kind: 'pair', key: `${prefix}${two.map((x) => x.card.id).join('+')}`, tiles: two });
  }
  return out;
}

export default function ExploreScreen() {
  const t = useTheme();
  const c = t.colors;
  const { prefs } = useAppState();
  const { onOpen } = useCardHandlers();
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - GUTTER * 2 - GAP) / 2);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);

  // Todos los temas son chips (Naturaleza, Arte, Espacio…), estén o no encendidos en Filtros:
  // elegir uno es una decisión explícita de ver ese tema.
  const activeTopic = topic;
  const explorePrefs = useMemo(() => (activeTopic ? { ...prefs, topics: [activeTopic] } : prefs), [prefs, activeTopic]);
  const { recs, loaded, more, loadMore, reload, retry } = useRecommendations(explorePrefs);
  const search = useSearch(prefs, query);
  const searching = query.trim().length >= 2;
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo<Row[]>(() => {
    if (!searching) return pairs(recs.map((r) => ({ card: r.card, note: reasonLabel(r.reason) })), 'p-');
    const out: Row[] = [];
    if (search.local.length > 0) {
      out.push({ kind: 'section', key: 's-local', title: 'En tu teléfono' });
      out.push(...pairs(search.local.map((card) => ({ card })), 'l-'));
    }
    if (search.remote.length > 0) {
      out.push({ kind: 'section', key: 's-remote', title: 'Relacionado en Wikipedia' });
      out.push(...pairs(search.remote.map((card) => ({ card })), 'r-'));
    }
    if (search.status === 'offline') {
      out.push({ kind: 'note', key: 'offline', text: 'Sin conexión: solo se muestran resultados de tu teléfono.' });
    }
    return out;
  }, [searching, recs, search.local, search.remote, search.status]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'section') return <SectionLabel style={styles.section}>{item.title}</SectionLabel>;
      if (item.kind === 'note') {
        return <Text style={[t.type.meta, { color: c.muted, paddingHorizontal: 20, marginTop: 12 }]}>{item.text}</Text>;
      }
      return (
        <View style={styles.pair}>
          {item.tiles.map((tile) => (
            <ExploreTile key={tile.card.id} card={tile.card} note={tile.note} width={tileWidth} onOpen={onOpen} />
          ))}
        </View>
      );
    },
    [onOpen, tileWidth, t, c.muted],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  // Tocar "Explorar" estando aquí: sube al inicio; si había búsqueda la borra, si no, recomienda de nuevo.
  const list = useRef<FlatList<Row>>(null);
  useTabReselect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: true });
    if (query) setQuery('');
    else void onRefresh();
  });

  const filterOn = prefs.hideSensational || prefs.hideClickbait;

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[t.type.screenTitle, { color: c.text, flex: 1 }]}>
          Explorar
        </Text>
        <IconButton label="Filtros" filled onPress={() => router.push('/filtros')}>
          <SlidersHorizontal size={ICON.size} color={c.primaryText} strokeWidth={ICON.stroke} />
        </IconButton>
      </View>

      <View style={[styles.search, { borderColor: c.border, borderRadius: t.radius.input, backgroundColor: c.card }]}>
        <Search size={18} color={c.muted} strokeWidth={ICON.stroke} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar temas, obras, personas…"
          placeholderTextColor={c.muted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Buscar"
          style={[t.type.chip, styles.input, { color: c.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10} style={styles.clear}>
            <X size={18} color={c.muted} strokeWidth={ICON.stroke} />
          </Pressable>
        ) : null}
      </View>

      {!searching ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Para ti" active={activeTopic === null} onPress={() => setTopic(null)} />
            {TOPICS.map((tp) => (
              <Chip key={tp} label={TOPIC_LABELS[tp]} active={activeTopic === tp} onPress={() => setTopic(tp)} />
            ))}
          </ScrollView>
          <Pressable onPress={() => router.push('/filtros')} accessibilityRole="button" accessibilityHint="Abre los filtros" style={styles.status}>
            <ShieldCheck size={16} color={c.primaryText} strokeWidth={ICON.stroke} />
            <Text style={{ fontFamily: t.fonts.body.regular, fontSize: 13, color: c.muted, marginLeft: 8, flex: 1 }}>
              Filtro anti-sensacionalismo:{' '}
              <Text style={{ fontFamily: t.fonts.body.semibold, color: c.text }}>{filterOn ? prefs.level : 'apagado'}</Text>
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );

  const empty = searching ? (
    search.status === 'searching' || search.status === 'idle' ? (
      <View style={styles.loading}>
        <ActivityIndicator color={c.primaryText} />
      </View>
    ) : (
      <Notice
        title="Sin resultados"
        body={search.status === 'offline' ? 'Sin conexión y nada en tu teléfono con esas palabras.' : 'Prueba con otras palabras.'}
      />
    )
  ) : loaded ? (
    <MoreFooter more={more} onRetry={() => void retry()} />
  ) : (
    <View style={styles.loading}>
      <ActivityIndicator color={c.primaryText} />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          !searching && recs.length > 0 ? (
            <MoreFooter more={more} onRetry={() => void retry()} />
          ) : searching && search.status === 'searching' && rows.length > 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primaryText} />
            </View>
          ) : undefined
        }
        ItemSeparatorComponent={Separator}
        onEndReached={() => (searching ? undefined : void loadMore())}
        onEndReachedThreshold={1.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          searching ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primaryText} colors={[c.primary]} />
          )
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const Separator = () => <View style={{ height: 16 }} />;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 16, paddingTop: 12, paddingBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, marginHorizontal: 20, paddingLeft: 14, height: 44 },
  input: { flex: 1, height: 44, paddingHorizontal: 10 },
  clear: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: 20, gap: 8, paddingVertical: 4, marginTop: 12 },
  status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 44, marginBottom: 4 },
  section: { paddingHorizontal: 20, marginTop: 16, marginBottom: -4 },
  pair: { flexDirection: 'row', gap: GAP, paddingHorizontal: GUTTER },
  loading: { alignItems: 'center', paddingVertical: 48 },
});
