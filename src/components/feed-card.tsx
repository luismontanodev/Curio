// Tarjeta del feed en sus tres variantes: con imagen, de texto y efeméride.
// Fuente y licencia siempre visibles; tocarla abre el lector dentro de la app.

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, ImageIcon, Share } from 'lucide-react-native';

import type { Card } from '../core/types.ts';
import { useAppState, useTheme } from '../platform/app-state.tsx';
import { RemoteImage } from '../platform/remote-image.tsx';
import { cardKicker, cardMeta, cardVariant } from '../ui/format.ts';
import { ICON, IconButton } from './primitives.tsx';

interface Props {
  card: Card;
  saved: boolean;
  onOpen: (card: Card) => void;
  onToggleSave: (card: Card) => void;
  onShare: (card: Card) => void;
  onLongPress?: (card: Card) => void;
}

function FeedCardBase({ card, saved, onOpen, onToggleSave, onShare, onLongPress }: Props) {
  const t = useTheme();
  const c = t.colors;
  const showLang = useAppState().prefs.languages.length > 1;
  const variant = cardVariant(card);
  const meta = cardMeta(card, { showLang });

  const isEvent = variant === 'event';
  const titleStyle = variant === 'image' ? t.type.cardTitleLarge : t.type.cardTitle;
  // Artículos con miniatura: una imagen pequeña a la derecha, sin robarle espacio al texto.
  const thumb = variant === 'text' && card.imageUrl ? card.imageUrl : null;

  return (
    <Pressable
      onPress={() => onOpen(card)}
      onLongPress={onLongPress ? () => onLongPress(card) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${meta}`}
      accessibilityHint="Abre la lectura dentro de Curio"
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: t.radius.card,
          backgroundColor: isEvent ? c.soft : c.card,
          borderColor: isEvent ? c.soft : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {variant === 'image' && card.imageUrl ? (
        <View style={[styles.image, { height: t.size.cardImageHeight, backgroundColor: c.soft }]}>
          <ImageIcon size={28} color={c.primaryText} strokeWidth={ICON.stroke} />
          <RemoteImage uri={card.imageUrl} recyclingKey={card.id} />
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={[t.type.topicLabel, { color: c.primaryText }]} numberOfLines={1}>
          {cardKicker(card)}
        </Text>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[titleStyle, { color: c.text, marginTop: 6 }]} numberOfLines={4}>
              {card.title}
            </Text>
            {card.summary ? (
              <Text style={[t.type.body, { color: c.muted, marginTop: 6 }]} numberOfLines={thumb ? 3 : 4}>
                {card.summary}
              </Text>
            ) : null}
          </View>
          {thumb ? (
            <View style={[styles.thumb, { backgroundColor: c.soft, borderRadius: t.radius.iconButton }]}>
              <ImageIcon size={20} color={c.primaryText} strokeWidth={ICON.stroke} />
              <RemoteImage uri={thumb} recyclingKey={`${card.id}:thumb`} />
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[t.type.meta, { color: c.muted, flex: 1 }]} numberOfLines={2}>
            {meta}
          </Text>
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
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 76, height: 76, marginTop: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginRight: -8 },
});
