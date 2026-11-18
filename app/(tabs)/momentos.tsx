// Momentos: uno a la vez, a pantalla completa, con swipe vertical e infinito.
// Cada N momentos (Pausa sugerida, en Filtros) aparece una página para parar.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type LayoutChangeEvent, type ListViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Coffee } from 'lucide-react-native';

import type { Moment } from '../../src/core/types.ts';
import { getCard } from '../../src/db/cards.ts';
import { MomentPage } from '../../src/components/moment-page.tsx';
import { MoreFooter } from '../../src/components/more-footer.tsx';
import { Button, Notice } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { openReader, shareMoment } from '../../src/platform/card-actions.ts';
import { useMomentStream, type ReelItem } from '../../src/platform/use-moment-stream.ts';
import { useTabReselect } from '../../src/platform/use-tab-reselect.ts';

/** Cuando faltan estos momentos para el final, se pide el siguiente lote. */
const PREFETCH = 4;

export default function MomentsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const c = t.colors;
  const insets = useSafeAreaInsets();
  const { savedIds, toggleSaved, prefs } = useAppState();
  const { items, loaded, more, loadMore, retry, reached, restart } = useMomentStream();
  const [height, setHeight] = useState(0);
  const [resting, setResting] = useState(false);
  const list = useRef<FlatList<ReelItem>>(null);

  // Tocar "Momentos" estando aquí: un lote nuevo desde arriba (lo visto no se repite).
  useTabReselect(() => {
    setResting(false);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    void restart();
  });

  // Al mostrar un momento: cuenta como visto y, si quedan pocos, se pide el siguiente lote.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const v = viewableItems[0];
    if (v?.index == null) return;
    const item = itemsRef.current[v.index];
    if (item?.kind === 'moment') reached(item.moment);
    if (itemsRef.current.length - v.index <= PREFETCH) void loadMore();
  }).current;

  const onSave = useCallback(
    async (m: Moment) => {
      if (!m.cardId) return;
      const card = await getCard(db, m.cardId);
      if (card) await toggleSaved(card);
    },
    [db, toggleSaved],
  );
  const onShare = useCallback((m: Moment) => void shareMoment(m).catch(() => {}), []);
  const onDeepen = useCallback((m: Moment) => (m.cardId ? openReader(m.cardId) : undefined), []);

  const renderItem = useCallback(
    ({ item, index }: { item: ReelItem; index: number }) =>
      item.kind === 'moment' ? (
        <MomentPage
          moment={item.moment}
          height={height}
          topInset={insets.top}
          bottomInset={0}
          saved={!!item.moment.cardId && savedIds.has(item.moment.cardId)}
          showHint={index < 2}
          onSave={(m) => void onSave(m)}
          onShare={onShare}
          onDeepen={onDeepen}
        />
      ) : (
        <PausePage
          height={height}
          every={prefs.pauseEvery}
          onContinue={() => list.current?.scrollToIndex({ index: index + 1, animated: true })}
          onStop={() => setResting(true)}
        />
      ),
    [height, insets.top, savedIds, onSave, onShare, onDeepen, prefs.pauseEvery],
  );

  if (resting) {
    return (
      <Centered>
        <Notice title="Buen momento para descansar" body="Lo que guardaste te espera en Mis datos. Aquí seguirá habiendo momentos cuando vuelvas.">
          <Button label="Volver a los momentos" variant="secondary" height={48} onPress={() => setResting(false)} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        </Notice>
      </Centered>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.image }]} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && items.length > 0 ? (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(i) => i.key}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          ListFooterComponent={
            more === 'offline' || more === 'exhausted' ? (
              <View style={[styles.footer, { height, backgroundColor: c.bg }]}>
                <MoreFooter more={more} onRetry={() => void retry()} />
              </View>
            ) : undefined
          }
        />
      ) : (
        <View style={[styles.center, { backgroundColor: c.bg }]}>
          {!loaded || more === 'fetching' ? (
            <>
              <ActivityIndicator color={c.primaryText} />
              <Text style={[t.type.body, { color: c.muted, marginTop: 12 }]}>Buscando momentos…</Text>
            </>
          ) : (
            <MoreFooter more={more} onRetry={() => void retry()} />
          )}
        </View>
      )}

      {/* Título discreto arriba a la izquierda, como orientación. */}
      <View pointerEvents="none" style={[styles.badge, { top: insets.top + 10, backgroundColor: c.card }]}>
        <Text style={[t.type.chipActive, { fontSize: 13, color: c.text }]}>Momentos</Text>
      </View>
    </View>
  );
}

/** Pausa sugerida: tranquila, sin culpa. "Seguir" pasa al siguiente momento. */
function PausePage({
  height,
  every,
  onContinue,
  onStop,
}: {
  height: number;
  every: number | null;
  onContinue: () => void;
  onStop: () => void;
}) {
  const t = useTheme();
  const c = t.colors;
  return (
    <View style={[styles.pause, { height, backgroundColor: c.soft }]}>
      <View style={[styles.pauseIcon, { backgroundColor: c.card }]}>
        <Coffee size={26} color={c.primaryText} strokeWidth={1.8} />
      </View>
      <Text accessibilityRole="header" style={[t.type.hookLarge, { color: c.text, textAlign: 'center', marginTop: 20 }]}>
        ¿Una pausa?
      </Text>
      <Text style={[t.type.payoff, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>
        Llevas {every ?? 'varios'} momentos. Lo que no alcanzaste a ver seguirá aquí.
      </Text>
      <View style={{ alignSelf: 'stretch', marginTop: 28 }}>
        <Button label="Terminar por hoy" onPress={onStop} />
        <Button label="Seguir" variant="secondary" onPress={onContinue} style={{ marginTop: 10 }} />
      </View>
      <Text style={[t.type.meta, { color: c.muted, textAlign: 'center', marginTop: 16 }]}>
        Puedes cambiar o apagar este aviso en Filtros.
      </Text>
      <Button
        label="Ir a Filtros"
        variant="secondary"
        height={44}
        onPress={() => router.push('/filtros')}
        style={{ marginTop: 4, alignSelf: 'center', borderColor: 'transparent', backgroundColor: 'transparent' }}
      />
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  const c = useTheme().colors;
  return <View style={[styles.center, { backgroundColor: c.bg, paddingHorizontal: 24 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { justifyContent: 'center' },
  badge: { position: 'absolute', left: 16, paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center' },
  pause: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  pauseIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
