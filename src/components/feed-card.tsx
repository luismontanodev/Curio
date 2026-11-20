// Tarjeta del feed, compacta y visual: con foto, la imagen va a sangre y el tema y el título
// encima, sobre un velo oscuro; debajo, una línea con fuente y licencia. El resumen y los detalles aparecen con "Más" (si el usuario quiere).
// Tocarla abre el lector dentro de la app.

import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, ImageIcon, Share } from 'lucide-react-native';

import type { Card } from '../core/types.ts';
import { useAppState, useTheme } from '../platform/app-state.tsx';
import { RemoteImage } from '../platform/remote-image.tsx';
import { VideoBadge } from './video-badge.tsx';
import { cardMeta, cardSource, cardTopicLabel, cardVariant } from '../ui/format.ts';
import { ICON, IconButton, TopicPill } from './primitives.tsx';
import { Scrim } from './gradient.tsx';

interface Props {
  card: Card;
  saved: boolean;
  onOpen: (card: Card) => void;
  onToggleSave: (card: Card) => void;
  onShare: (card: Card) => void;
  onLongPress?: (card: Card) => void;
  /** Línea pequeña sobre la etiqueta, p. ej. por qué se recomienda ("Porque guardaste arte"). */
  note?: string;
  /** Líneas de resumen bajo el título cuando hay imagen (por defecto 0: la imagen ya da contexto). */
  teaserLines?: number;
}

function FeedCardBase({ card, saved, onOpen, onToggleSave, onShare, onLongPress, note, teaserLines = 0 }: Props) {
  const t = useTheme();
  const c = t.colors;
  const showLang = useAppState().prefs.languages.length > 1;
  const [expanded, setExpanded] = useState(false);
  const variant = cardVariant(card);
  const isEvent = variant === 'event';
  const withImage = variant === 'image' && !!card.imageUrl;
  const tone = t.topics[card.topic] ?? { fg: c.primaryText, bg: c.soft, solid: c.primary };

  // Sin imagen, dos líneas de resumen dan contexto; con imagen, la imagen ya lo da.
  const summaryLines = expanded ? undefined : withImage ? teaserLines : 2;
  const hasMore = !!card.summary || !!card.readMinutes || showLang || !!card.license;

  return (
    <Pressable
      onPress={() => onOpen(card)}
      onLongPress={onLongPress ? () => onLongPress(card) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${cardSource(card)}`}
      accessibilityHint="Abre la lectura dentro de Curio"
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: t.radius.card,
          backgroundColor: isEvent ? tone.bg : c.card,
          borderColor: isEvent ? tone.bg : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {withImage ? (
        <View style={[styles.image, { height: t.size.cardImageHeight, backgroundColor: tone.bg }]}>
          <ImageIcon size={28} color={tone.fg} strokeWidth={ICON.stroke} />
          <RemoteImage uri={card.imageUrl!} fit="contain" recyclingKey={card.id} />
          <Scrim />
          <VideoBadge card={card} />
          <View style={styles.overlay} pointerEvents="none">
            <TopicPill label={cardTopicLabel(card)} color={tone.solid} />
            <Text style={[t.type.cardTitleLarge, styles.overlayTitle]} numberOfLines={expanded ? 4 : 3}>
              {card.title}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {note ? (
          <Text style={[t.type.meta, { color: c.primaryText, marginBottom: 4 }]} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
        {withImage ? null : (
          <>
            <TopicPill label={cardTopicLabel(card)} color={tone.solid} />
            <Text style={[t.type.cardTitle, { color: c.text, marginTop: 8 }]} numberOfLines={expanded ? undefined : 3}>
              {card.title}
            </Text>
          </>
        )}
        {card.summary && summaryLines !== 0 ? (
          <Text style={[t.type.body, { color: c.muted, marginTop: withImage ? 0 : 6 }]} numberOfLines={summaryLines}>
            {card.summary}
          </Text>
        ) : null}
        {expanded ? (
          <Text style={[t.type.meta, { color: c.muted, marginTop: 8 }]}>{cardMeta(card, { showLang })}</Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={[t.type.meta, { color: c.muted, flex: 1 }]} numberOfLines={1}>
            {cardSource(card)}
          </Text>
          {hasMore ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Ver menos' : 'Ver más'}
              hitSlop={6}
              style={styles.more}
            >
              <Text style={[t.type.chipActive, { fontSize: 13, color: c.primaryText }]}>{expanded ? 'Menos' : 'Más'}</Text>
            </Pressable>
          ) : null}
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
        </View>
      </View>
    </Pressable>
  );
}

export const FeedCard = memo(FeedCardBase);

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderWidth: 1, overflow: 'hidden' },
  image: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  overlay: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  overlayTitle: { color: '#FFFFFF', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginRight: -8 },
  more: { height: 44, paddingHorizontal: 10, justifyContent: 'center' },
});
