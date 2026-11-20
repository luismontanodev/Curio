// Marca de video sobre un póster en las listas (Destacados, Explorar, Guardados): ícono de
// reproducir y duración. En las listas no se reproduce nada solo: el video se ve al abrirlo.

import { StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';

import type { Card } from '../core/types.ts';
import { formatDuration } from '../core/video.ts';
import { useTheme } from '../platform/app-state.tsx';

export function VideoBadge({ card, size = 'large' }: { card: Card; size?: 'large' | 'small' }) {
  const t = useTheme();
  if (card.type !== 'video') return null;
  const big = size === 'large';
  return (
    <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={[styles.play, big ? styles.playLarge : styles.playSmall]}>
          <Play size={big ? 26 : 18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
        </View>
      </View>
      {card.video ? (
        <View pointerEvents="none" style={styles.duration}>
          <Text style={[t.type.meta, { color: '#FFFFFF', fontFamily: t.fonts.body.semibold }]}>
            {formatDuration(card.video.durationSec)}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  play: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  playLarge: { width: 60, height: 60, borderRadius: 30 },
  playSmall: { width: 40, height: 40, borderRadius: 20 },
  duration: {
    position: 'absolute',
    right: 8,
    top: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
