// Mosaico de Explorar (cuadrícula de 2 columnas, como Instagram): foto a sangre con el tema y
// el título encima. Sin foto, el mosaico se rellena con el color sólido de su tema. Tocarlo abre el lector; guardar y compartir
// están ahí, para no llenar la cuadrícula de botones.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '../core/types.ts';
import { useTheme } from '../platform/app-state.tsx';
import { RemoteImage } from '../platform/remote-image.tsx';
import { VideoBadge } from './video-badge.tsx';
import { cardSource, cardTopicLabel } from '../ui/format.ts';
import { Scrim } from './gradient.tsx';
import { TopicPill } from './primitives.tsx';

interface Props {
  card: Card;
  width: number;
  onOpen: (card: Card) => void;
  /** Por qué se recomienda ("Porque guardaste arte"); va pequeño bajo el título. */
  note?: string;
}

function ExploreTileBase({ card, width, onOpen, note }: Props) {
  const t = useTheme();
  const c = t.colors;
  const tone = t.topics[card.topic] ?? { fg: c.primaryText, bg: c.soft, solid: c.primary };
  const visualHeight = Math.round(width * 1.3);

  return (
    <Pressable
      onPress={() => onOpen(card)}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${cardSource(card)}`}
      accessibilityHint="Abre la lectura dentro de Curio"
      style={({ pressed }) => [{ width, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {/* Con foto: a sangre, con el tema y el título encima. Sin foto: el color sólido del tema. */}
      <View style={[styles.visual, { height: visualHeight, backgroundColor: card.imageUrl ? tone.bg : tone.solid, borderRadius: t.radius.group }]}>
        {card.imageUrl ? (
          <>
            <RemoteImage uri={card.imageUrl} recyclingKey={card.id} width={500} />
            <Scrim height="70%" />
            <VideoBadge card={card} size="small" />
          </>
        ) : null}
        <View style={styles.overlay} pointerEvents="none">
          {card.imageUrl ? (
            <TopicPill label={cardTopicLabel(card)} color={tone.solid} small />
          ) : (
            <Text style={[t.type.topicLabel, { color: '#FFFFFF', opacity: 0.9 }]} numberOfLines={1}>
              {cardTopicLabel(card)}
            </Text>
          )}
          <Text
            style={[card.imageUrl ? t.type.chipActive : t.type.cardTitle, styles.title, card.imageUrl && { lineHeight: 19 }]}
            numberOfLines={card.imageUrl ? 3 : 6}
          >
            {card.title}
          </Text>
        </View>
      </View>
      {note ? (
        <Text style={[t.type.meta, { color: c.muted, marginTop: 6 }]} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const ExploreTile = memo(ExploreTileBase);

const styles = StyleSheet.create({
  visual: { overflow: 'hidden' },
  overlay: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  title: { color: '#FFFFFF', marginTop: 6, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
});
