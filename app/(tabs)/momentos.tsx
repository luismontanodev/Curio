// Momentos: uno a la vez, a pantalla completa, con swipe vertical e infinito.
// Cada N momentos (Pausa sugerida, en Filtros) aparece una página para parar.
// Arriba a la derecha: Posts | Videos. Los videos llevan audio; un toque los silencia.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type ListViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Coffee, Volume2, VolumeX } from 'lucide-react-native';

import type { Moment } from '../../src/core/types.ts';
import { formatDuration } from '../../src/core/video.ts';
import { getCard } from '../../src/db/cards.ts';
import type { MomentMode } from '../../src/db/moments.ts';
import { MomentAction, MomentPage } from '../../src/components/moment-page.tsx';
import { VideoVisual } from '../../src/platform/video-visual.tsx';
import { MoreFooter } from '../../src/components/more-footer.tsx';
import { Button, Notice } from '../../src/components/primitives.tsx';
import { Gradient } from '../../src/components/gradient.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { openReader, shareMoment } from '../../src/platform/card-actions.ts';
import { useMomentStream, type ReelItem } from '../../src/platform/use-moment-stream.ts';
import { useTabReselect } from '../../src/platform/use-tab-reselect.ts';

/** Cuando faltan estos momentos para el final, se pide el siguiente lote. */
const PREFETCH = 4;
/** Videos que se preparan por delante del visible (sin "Ahorro de datos"): solo el inicio de cada uno. */
const PRELOAD_AHEAD = 2;
/** Constante: FlatList no admite cambiarlo entre renders. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

export default function MomentsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const c = t.colors;
  const insets = useSafeAreaInsets();
  const { savedIds, toggleSaved, prefs, saveData } = useAppState();
  const [mode, setMode] = useState<MomentMode>('posts');
  const { items, loaded, more, loadMore, retry, reached, restart } = useMomentStream(mode);
  const [height, setHeight] = useState(0);
  // Índice visible: el video visible se reproduce y el siguiente se precarga.
  const [activeIndex, setActiveIndex] = useState(0);
  // Sonido: activado por defecto; un toque lo silencia en todos los videos.
  const [muted, setMuted] = useState(false);
  const [resting, setResting] = useState(false);
  const list = useRef<FlatList<ReelItem>>(null);

  // Tocar "Momentos" estando aquí: un lote nuevo desde arriba (lo visto no se repite).
  useTabReselect(() => {
    setResting(false);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    void restart();
  });

  // Al mostrar un momento: cuenta como visto y, si quedan pocos, se pide el siguiente lote.
  // `onViewable` debe ser estable (FlatList no acepta cambiarlo), así que lee lo vigente de
  // refs: si guardara el `loadMore` del primer render, en Videos pediría lotes de posts.
  const itemsRef = useRef(items);
  const loadMoreRef = useRef(loadMore);
  const reachedRef = useRef(reached);
  useEffect(() => {
    itemsRef.current = items;
    loadMoreRef.current = loadMore;
    reachedRef.current = reached;
  }, [items, loadMore, reached]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const v = viewableItems[0];
    if (v?.index == null) return;
    setActiveIndex(v.index);
    const item = itemsRef.current[v.index];
    if (item?.kind === 'moment') reachedRef.current(item.moment);
    if (itemsRef.current.length - v.index <= PREFETCH) void loadMoreRef.current();
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
          {...(item.moment.format === 'video'
            ? {
                visual: (
                  <VideoVisual
                    moment={item.moment}
                    active={index === activeIndex}
                    preload={index > activeIndex && index <= activeIndex + PRELOAD_AHEAD}
                    muted={muted}
                    dataSaver={saveData}
                  />
                ),
                onSingleTap: () => setMuted((m) => !m),
                badge: item.moment.media?.durationSec ? formatDuration(item.moment.media.durationSec) : undefined,
                extraActions: (
                  <MomentAction
                    label={muted ? 'Sin sonido' : 'Sonido'}
                    a11y={muted ? 'Activar el sonido' : 'Silenciar'}
                    color="#FFFFFF"
                    onImage
                    onPress={() => setMuted((m) => !m)}
                  >
                    {muted ? (
                      <VolumeX size={26} color="#FFFFFF" strokeWidth={1.8} />
                    ) : (
                      <Volume2 size={26} color="#FFFFFF" strokeWidth={1.8} />
                    )}
                  </MomentAction>
                ),
              }
            : {})}
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
    [height, insets.top, savedIds, onSave, onShare, onDeepen, prefs.pauseEvery, saveData, activeIndex, muted],
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
          // Un pase corto basta: se ajusta por intervalo según la velocidad del dedo (no hace
          // falta arrastrar media pantalla, como con pagingEnabled) y nunca salta más de uno.
          snapToInterval={height}
          snapToAlignment="start"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={VIEWABILITY}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          // 5 pantallas montadas (2 por delante): los videos precargados necesitan existir.
          windowSize={5}
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
      <View pointerEvents="none" style={[styles.badge, styles.glass, { top: insets.top + 10 }]}>
        <Text style={[t.type.chipActive, { fontSize: 13, color: '#FFFFFF' }]}>Momentos</Text>
      </View>

      {/* Arriba a la derecha: Posts | Videos. */}
      <View style={[styles.switch, styles.glass, { top: insets.top + 8 }]} accessibilityRole="radiogroup">
        {(
          [
            ['posts', 'Posts'],
            ['videos', 'Videos'],
          ] as const
        ).map(([value, label]) => {
          const on = mode === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                if (on) return;
                list.current?.scrollToOffset({ offset: 0, animated: false });
                setMode(value);
                setActiveIndex(0);
                setResting(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={value === 'videos' ? 'Ver videos' : 'Ver posts'}
              hitSlop={{ top: 6, bottom: 6 }}
              style={styles.switchItem}
            >
              {on ? <Gradient colors={c.accent} /> : null}
              <Text style={[t.type.chipActive, { fontSize: 13, color: on ? c.onPrimary : '#FFFFFF' }]}>{label}</Text>
            </Pressable>
          );
        })}
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
  switch: { position: 'absolute', right: 16, flexDirection: 'row', padding: 3, borderRadius: 19, gap: 2 },
  switchItem: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center', overflow: 'hidden' },
  // Translúcido: se lee sobre cualquier foto sin tapar el momento.
  glass: { backgroundColor: 'rgba(12,11,18,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  pause: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  pauseIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
