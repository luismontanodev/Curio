// Lector: todo se lee dentro de Curio. El enlace al original queda como atribución
// (texto seleccionable y botón de compartir), nunca como navegación.

import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, ChevronLeft, ImageIcon, Share } from 'lucide-react-native';

import type { Card, ContentBlock } from '../../src/core/types.ts';
import { sourceNameOf } from '../../src/core/sources.ts';
import { Button, ICON, IconButton, Notice } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { useCardHandlers } from '../../src/platform/card-actions.ts';
import { RemoteImage } from '../../src/platform/remote-image.tsx';
import { useReader } from '../../src/platform/use-reader.ts';
import { cardKicker, cardMeta, cardVariant, formatDateTime } from '../../src/ui/format.ts';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const c = t.colors;
  const { savedIds, prefs } = useAppState();
  const { onShare, onToggleSave } = useCardHandlers();
  const { state, retry } = useReader(String(id ?? ''));

  const card = state.status === 'ready' ? state.card : null;
  const saved = card ? savedIds.has(card.id) : false;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <IconButton label="Volver" onPress={() => router.back()}>
          <ChevronLeft size={26} color={c.text} strokeWidth={ICON.stroke} />
        </IconButton>
        <View style={{ flex: 1 }} />
        {card ? (
          <>
            <IconButton label={saved ? 'Quitar de guardados' : 'Guardar'} onPress={() => onToggleSave(card)}>
              <Bookmark
                size={ICON.size}
                color={saved ? c.primaryText : c.text}
                fill={saved ? c.primaryText : 'transparent'}
                strokeWidth={ICON.stroke}
              />
            </IconButton>
            <IconButton label="Compartir" onPress={() => onShare(card)}>
              <Share size={ICON.size} color={c.text} strokeWidth={ICON.stroke} />
            </IconButton>
          </>
        ) : null}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primaryText} />
        </View>
      ) : state.status === 'missing' || !card ? (
        <Notice title="Esta tarjeta ya no está" body="Se borró del teléfono. Si la habías guardado, búscala en Guardados." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {card.imageUrl ? <Hero card={card} /> : null}

          <View style={styles.content}>
            <Text style={[t.type.topicLabel, { color: c.primaryText }]}>{cardKicker(card)}</Text>
            <Text accessibilityRole="header" style={[t.type.readerTitle, { color: c.text, marginTop: 8 }]} selectable>
              {card.title}
            </Text>
            <Text style={[t.type.meta, { color: c.muted, marginTop: 8 }]}>
              {cardMeta(card, { showLang: prefs.languages.length > 1 })}
            </Text>

            {/* Resumen: siempre si no hay texto completo; con texto completo, solo si aporta (The Conversation). */}
            {card.summary && (state.text !== 'full' || card.sourceId === 'theconversation') ? (
              <Text style={[t.type.reading, { color: c.text, marginTop: 20, fontFamily: t.fonts.body.medium }]} selectable>
                {card.summary}
              </Text>
            ) : null}

            {state.text === 'loading' ? (
              <View style={styles.loadingText}>
                <ActivityIndicator color={c.primaryText} />
                <Text style={[t.type.body, { color: c.muted, marginLeft: 10 }]}>Cargando el artículo…</Text>
              </View>
            ) : null}

            {state.text === 'error' ? (
              <View style={[styles.box, { backgroundColor: c.soft, borderRadius: t.radius.group }]}>
                <Text style={[t.type.body, { color: c.text }]}>
                  No se pudo cargar el texto completo. Revisa tu conexión e inténtalo de nuevo.
                </Text>
                <Button label="Reintentar" variant="secondary" height={44} onPress={() => void retry()} style={{ marginTop: 12 }} />
              </View>
            ) : null}

            {state.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}

            <Attribution card={card} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Imagen principal: obras e imágenes completas (contain); artículos recortados (cover). */
function Hero({ card }: { card: Card }) {
  const t = useTheme();
  const whole = cardVariant(card) === 'image';
  return (
    <View style={[styles.hero, { height: whole ? 320 : 220, backgroundColor: t.colors.soft }]}>
      <ImageIcon size={32} color={t.colors.primaryText} strokeWidth={ICON.stroke} />
      <RemoteImage uri={card.imageUrl!} contentFit={whole ? 'contain' : 'cover'} accessibilityLabel={card.title} />
    </View>
  );
}

function Block({ block }: { block: ContentBlock }) {
  const t = useTheme();
  const c = t.colors;
  switch (block.kind) {
    case 'h':
      return (
        <Text accessibilityRole="header" style={[t.type.readerHeading, { color: c.text, marginTop: 28 }]} selectable>
          {block.text}
        </Text>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: c.primary }]}>
          <Text style={[t.type.readingQuote, { color: c.muted }]} selectable>
            {block.text}
          </Text>
        </View>
      );
    case 'img':
      return (
        <View style={{ marginTop: 20 }}>
          <View style={[styles.inlineImage, { backgroundColor: c.soft, borderRadius: t.radius.group }]}>
            <ImageIcon size={24} color={c.primaryText} strokeWidth={ICON.stroke} />
            <RemoteImage uri={block.src} contentFit="contain" accessibilityLabel={block.caption} />
          </View>
          {block.caption ? <Text style={[t.type.meta, { color: c.muted, marginTop: 6 }]}>{block.caption}</Text> : null}
        </View>
      );
    default:
      return (
        <Text style={[t.type.reading, { color: c.text, marginTop: 16 }]} selectable>
          {block.text}
        </Text>
      );
  }
}

/** Atribución exigida por las licencias (CC BY-SA, CC BY-ND): fuente, licencia y dirección del original. */
function Attribution({ card }: { card: Card }) {
  const t = useTheme();
  const c = t.colors;
  return (
    <View style={[styles.box, { backgroundColor: c.soft, borderRadius: t.radius.group, marginTop: 32 }]}>
      <Text style={[t.type.rowTitle, { color: c.text }]}>Fuente: {sourceNameOf(card.sourceId)}</Text>
      {card.license ? (
        <Text style={[t.type.meta, { color: c.muted, marginTop: 4 }]}>Licencia: {card.license}</Text>
      ) : null}
      {card.publishedAt ? (
        <Text style={[t.type.meta, { color: c.muted, marginTop: 2 }]}>Publicado: {formatDateTime(card.publishedAt)}</Text>
      ) : null}
      {card.sourceId === 'theconversation' ? (
        <Text style={[t.type.meta, { color: c.muted, marginTop: 8 }]}>
          Publicado originalmente en The Conversation y reproducido sin cambios bajo licencia Creative Commons.
        </Text>
      ) : null}
      <Text style={[t.type.meta, { color: c.muted, marginTop: 8 }]}>Original:</Text>
      <Text style={[t.type.meta, { color: c.text }]} selectable>
        {card.url}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  loadingText: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  box: { padding: 16, marginTop: 20 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 16 },
  inlineImage: { width: '100%', aspectRatio: 3 / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
