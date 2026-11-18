// Mosaico de Explorar (cuadrícula de 2 columnas, como Instagram): imagen y título corto.
// Sin foto, el mosaico toma el color de su tema. Tocarlo abre el lector; guardar y compartir
// están ahí, para no llenar la cuadrícula de botones.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Card } from '../core/types.ts';
import { useTheme } from '../platform/app-state.tsx';
import { RemoteImage } from '../platform/remote-image.tsx';
import { cardSource, cardTopicLabel } from '../ui/format.ts';

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
  const tone = t.topics[card.topic] ?? { fg: c.primaryText, bg: c.soft };
  const visualHeight = Math.round(width * 1.2);

  return (
    <Pressable
      onPress={() => onOpen(card)}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${cardSource(card)}`}
      accessibilityHint="Abre la lectura dentro de Curio"
      style={({ pressed }) => [{ width, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.visual, { height: visualHeight, backgroundColor: tone.bg, borderRadius: t.radius.group }]}>
        {card.imageUrl ? (
          <RemoteImage uri={card.imageUrl} recyclingKey={card.id} />
        ) : (
          // Sin imagen: el título grande sobre el color del tema.
          <View style={styles.textOnly}>
            <Text style={[t.type.topicLabel, { color: tone.fg }]} numberOfLines={1}>
              {cardTopicLabel(card)}
            </Text>
            <Text style={[t.type.cardTitle, { color: c.text, marginTop: 6 }]} numberOfLines={5}>
              {card.title}
            </Text>
          </View>
        )}
      </View>
      {card.imageUrl ? (
        <>
          <Text style={[t.type.topicLabel, { color: tone.fg, marginTop: 8 }]} numberOfLines={1}>
            {cardTopicLabel(card)}
          </Text>
          <Text style={[t.type.chipActive, { color: c.text, marginTop: 2, lineHeight: 19 }]} numberOfLines={2}>
            {card.title}
          </Text>
        </>
      ) : null}
      {note ? (
        <Text style={[t.type.meta, { color: c.muted, marginTop: 4 }]} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const ExploreTile = memo(ExploreTileBase);

const styles = StyleSheet.create({
  visual: { overflow: 'hidden' },
  textOnly: { flex: 1, padding: 14, justifyContent: 'flex-end' },
});
