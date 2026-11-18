// Una página del Momento, inmersiva (estilo Reels): la imagen ocupa toda la pantalla y el
// texto va encima, sobre un velo oscuro abajo. Acciones en columna a la derecha: guardar,
// enviar y leer. Doble toque sobre la imagen guarda (nunca quita), con una animación breve.

import { memo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Bookmark, ImageIcon, Send } from 'lucide-react-native';

import type { Moment } from '../core/types.ts';
import { useTheme } from '../platform/app-state.tsx';
import { RemoteImage } from '../platform/remote-image.tsx';
import { TOPIC_LABELS } from '../ui/format.ts';
import { ICON } from './primitives.tsx';

interface Props {
  moment: Moment;
  height: number;
  /** Margen superior (área segura) para no chocar con la píldora "Momentos". */
  topInset: number;
  bottomInset: number;
  saved: boolean;
  showHint: boolean;
  onSave: (m: Moment) => void;
  onShare: (m: Moment) => void;
  onDeepen: (m: Moment) => void;
}

const DOUBLE_TAP_MS = 280;
/** Velo de abajo hacia arriba en franjas (sin librería de degradados): de 0 a 0.78 de opacidad. */
const SCRIM = [0.0, 0.08, 0.18, 0.3, 0.42, 0.54, 0.64, 0.72, 0.78];
const WHITE = '#FFFFFF';
const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 };

function MomentPageBase({ moment, height, topInset, bottomInset, saved, showHint, onSave, onShare, onDeepen }: Props) {
  const t = useTheme();
  const c = t.colors;
  const image = moment.media?.imageUrl;
  const tone = t.topics[moment.topic] ?? { fg: c.primaryText, bg: c.image };
  const [open, setOpen] = useState(false);

  // Sobre una foto el texto va en blanco; sin foto, con los colores del tema.
  const ink = image ? WHITE : c.text;
  const inkSoft = image ? 'rgba(255,255,255,0.86)' : c.muted;
  const savedInk = image ? WHITE : c.primaryText;

  // --- Doble toque para guardar ------------------------------------------------
  const lastTap = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;
  const onVisualPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!saved) onSave(moment); // como Instagram: el doble toque solo guarda
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 650, useNativeDriver: true }).start();
    } else {
      lastTap.current = now;
    }
  };
  const burstStyle = {
    opacity: burst.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ scale: burst.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.5, 1.15, 1] }) }],
  };

  return (
    <View style={{ height, backgroundColor: image ? '#000' : tone.bg }}>
      {/* Visual a pantalla completa. */}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {image ? (
          <>
            <ImageIcon size={36} color="rgba(255,255,255,0.5)" strokeWidth={ICON.stroke} />
            <RemoteImage uri={image} fit="contain" recyclingKey={moment.id} accessibilityLabel={moment.hook} />
          </>
        ) : (
          <Text style={[t.type.welcome, { color: tone.fg, opacity: 0.35, marginTop: -height * 0.25 + topInset }]}>
            {TOPIC_LABELS[moment.topic]}
          </Text>
        )}
      </View>

      {/* Doble toque en cualquier parte de la imagen. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onVisualPress}
        accessibilityRole="image"
        accessibilityLabel={moment.hook}
        accessibilityHint="Toca dos veces para guardar"
      />

      {/* Marcador que aparece al guardar con doble toque. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, burstStyle]}>
        <Bookmark size={96} color={WHITE} fill={WHITE} strokeWidth={1.5} />
      </Animated.View>

      {/* Velo para que el texto se lea sobre cualquier foto. */}
      {image ? (
        <View pointerEvents="none" style={[styles.scrim, { height: height * 0.55 }]}>
          {SCRIM.map((o, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${o})` }} />
          ))}
        </View>
      ) : null}

      {/* Texto abajo a la izquierda. */}
      <View pointerEvents="box-none" style={[styles.text, { paddingBottom: 20 + bottomInset }]}>
        <View style={[styles.topicPill, { backgroundColor: tone.bg }]}>
          <Text style={[t.type.topicLabel, { color: tone.fg }]} numberOfLines={1}>
            {[TOPIC_LABELS[moment.topic], moment.label].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={[t.type.hook, { color: ink, marginTop: 10 }, image ? shadow : null]} numberOfLines={open ? 6 : 3}>
          {moment.hook}
        </Text>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityHint={open ? 'Muestra menos' : 'Muestra el texto completo'}
        >
          <Text style={[t.type.payoff, { color: inkSoft, marginTop: 6 }, image ? shadow : null]} numberOfLines={open ? undefined : 2}>
            {moment.payoff}
          </Text>
        </Pressable>
        {showHint ? (
          <Text style={[t.type.meta, { color: inkSoft, marginTop: 12 }, image ? shadow : null]}>
            Desliza hacia arriba para el siguiente · toca dos veces para guardar
          </Text>
        ) : null}
      </View>

      {/* Acciones a la derecha, como en Reels. */}
      <View style={[styles.actions, { bottom: 24 + bottomInset }]}>
        <Action label={saved ? 'Guardado' : 'Guardar'} a11y={saved ? 'Quitar de guardados' : 'Guardar'} color={ink} onImage={!!image} onPress={() => onSave(moment)}>
          <Bookmark size={26} color={saved ? savedInk : ink} fill={saved ? savedInk : 'transparent'} strokeWidth={ICON.stroke} />
        </Action>
        <Action label="Enviar" a11y="Enviar a alguien" color={ink} onImage={!!image} onPress={() => onShare(moment)}>
          <Send size={26} color={ink} strokeWidth={ICON.stroke} />
        </Action>
        <Action label="Leer" a11y="Leer completo" color={ink} onImage={!!image} onPress={() => onDeepen(moment)}>
          <BookOpen size={26} color={ink} strokeWidth={ICON.stroke} />
        </Action>
      </View>
    </View>
  );
}

function Action({
  label,
  a11y,
  color,
  onImage,
  onPress,
  children,
}: {
  label: string;
  a11y: string;
  color: string;
  onImage: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
    >
      {children}
      <Text style={[t.type.tab, { color, marginTop: 4 }, onImage ? shadow : null]}>{label}</Text>
    </Pressable>
  );
}

export const MomentPage = memo(MomentPageBase);

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  text: { position: 'absolute', left: 0, right: 76, bottom: 0, paddingLeft: 20 },
  topicPill: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center' },
  actions: { position: 'absolute', right: 10, alignItems: 'center', gap: 14 },
  action: { width: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
});
