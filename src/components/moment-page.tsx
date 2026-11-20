// Una página del Momento, inmersiva (estilo Reels): la imagen ocupa toda la pantalla y el
// texto va encima, sobre un velo oscuro abajo. Acciones en columna a la derecha: guardar,
// enviar y leer. Doble toque sobre la imagen guarda (nunca quita), con una animación breve.

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Bookmark, ImageIcon, Send } from 'lucide-react-native';

import type { Moment } from '../core/types.ts';
import { useTheme } from '../platform/app-state.tsx';
import { RemoteImage } from '../platform/remote-image.tsx';
import { TOPIC_LABELS } from '../ui/format.ts';
import { ICON, TopicPill } from './primitives.tsx';
import { Gradient, Scrim } from './gradient.tsx';

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
  /** Visual propio (p. ej. el video); por defecto, la imagen del momento. */
  visual?: ReactNode;
  /** Toque simple sobre el visual (en videos: silenciar o activar el sonido). */
  onSingleTap?: () => void;
  /** Acciones extra arriba de la columna (p. ej. el botón de sonido). */
  extraActions?: ReactNode;
  /** Etiqueta pequeña junto al tema (p. ej. la duración del video). */
  badge?: string;
}

const DOUBLE_TAP_MS = 280;
const WHITE = '#FFFFFF';
const shadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 };

function MomentPageBase({
  moment, height, topInset, bottomInset, saved, showHint, onSave, onShare, onDeepen, visual, onSingleTap, extraActions, badge,
}: Props) {
  const t = useTheme();
  const c = t.colors;
  const image = moment.media?.imageUrl;
  const tone = t.topics[moment.topic] ?? { fg: c.primaryText, bg: c.image, solid: c.primary };
  const [open, setOpen] = useState(false);

  // Siempre sobre algo oscuro (foto con velo, o el degradado del tema): texto en blanco.
  const ink = WHITE;
  const inkSoft = 'rgba(255,255,255,0.86)';
  const savedInk = WHITE;

  // --- Doble toque para guardar ------------------------------------------------
  const lastTap = useRef(0);
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (singleTimer.current) clearTimeout(singleTimer.current); }, []);
  const burst = useRef(new Animated.Value(0)).current;
  const onVisualPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (singleTimer.current) clearTimeout(singleTimer.current); // era doble toque, no simple
      if (!saved) onSave(moment); // como Instagram: el doble toque solo guarda
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 650, useNativeDriver: true }).start();
    } else {
      lastTap.current = now;
      if (onSingleTap) {
        // Se espera un instante: si llega un segundo toque, es doble (guardar), no simple.
        singleTimer.current = setTimeout(onSingleTap, DOUBLE_TAP_MS);
      }
    }
  };
  const burstStyle = {
    opacity: burst.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ scale: burst.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.5, 1.15, 1] }) }],
  };

  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {/* Sin foto: degradado del color del tema a casi negro. */}
      {!image && !visual ? <Gradient colors={[tone.solid, '#0C0B12']} direction="vertical" /> : null}
      {/* Visual a pantalla completa. */}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {visual ? (
          visual
        ) : image ? (
          <>
            <ImageIcon size={36} color="rgba(255,255,255,0.5)" strokeWidth={ICON.stroke} />
            <RemoteImage uri={image} fit="contain" recyclingKey={moment.id} accessibilityLabel={moment.hook} />
          </>
        ) : (
          <Text style={[t.type.welcome, { color: WHITE, opacity: 0.22, fontSize: 52, lineHeight: 56, marginTop: -height * 0.25 + topInset }]}>
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
        accessibilityHint={onSingleTap ? 'Toca para silenciar o activar el sonido; dos veces para guardar' : 'Toca dos veces para guardar'}
      />

      {/* Marcador que aparece al guardar con doble toque. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, burstStyle]}>
        <Bookmark size={96} color={WHITE} fill={WHITE} strokeWidth={1.5} />
      </Animated.View>

      {/* Velo para que el texto se lea sobre cualquier foto. */}
      {image ? <Scrim height={height * 0.55} /> : null}

      {/* Texto abajo a la izquierda. */}
      <View pointerEvents="box-none" style={[styles.text, { paddingBottom: 20 + bottomInset }]}>
        <TopicPill label={[TOPIC_LABELS[moment.topic], moment.label, badge].filter(Boolean).join(' · ')} color={tone.solid} />
        <Text style={[t.type.hook, { color: ink, marginTop: 10 }, shadow]} numberOfLines={open ? 6 : 3}>
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
        {extraActions}
        <Action label={saved ? 'Guardado' : 'Guardar'} a11y={saved ? 'Quitar de guardados' : 'Guardar'} color={ink} onImage onPress={() => onSave(moment)}>
          <Bookmark size={26} color={saved ? savedInk : ink} fill={saved ? savedInk : 'transparent'} strokeWidth={ICON.stroke} />
        </Action>
        <Action label="Enviar" a11y="Enviar a alguien" color={ink} onImage onPress={() => onShare(moment)}>
          <Send size={26} color={ink} strokeWidth={ICON.stroke} />
        </Action>
        <Action label="Leer" a11y="Leer completo" color={ink} onImage onPress={() => onDeepen(moment)}>
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
  text: { position: 'absolute', left: 0, right: 76, bottom: 0, paddingLeft: 20 },
  actions: { position: 'absolute', right: 10, alignItems: 'center', gap: 14 },
  action: { width: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
});

/** Botón de la columna de acciones (para acciones extra con el mismo estilo). */
export { Action as MomentAction };
