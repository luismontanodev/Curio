// Piezas básicas de la interfaz, todas a partir de los tokens de src/ui/theme.ts.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../platform/app-state.tsx';

/** Tamaño y trazo de los íconos (estilo Lucide, trazo 1.8). */
export const ICON = { size: 22, stroke: 1.8 } as const;

const pressedOpacity = ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.6 : 1 });

// --- Botón de ícono ------------------------------------------------------------

export function IconButton({
  label,
  onPress,
  children,
  filled = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  /** Fondo `soft` (botón de filtros). */
  filled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s) => [
        styles.iconButton,
        { borderRadius: t.radius.iconButton, backgroundColor: filled ? t.colors.soft : 'transparent' },
        pressedOpacity(s),
      ]}
    >
      {children}
    </Pressable>
  );
}

// --- Chips -------------------------------------------------------------------------

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={(s) => [
        styles.chip,
        {
          height: t.size.chipHeight,
          borderRadius: t.size.chipHeight / 2,
          backgroundColor: active ? t.colors.primary : 'transparent',
          borderColor: active ? t.colors.primary : t.colors.border,
        },
        pressedOpacity(s),
      ]}
    >
      <Text style={[active ? t.type.chipActive : t.type.chip, { color: active ? t.colors.onPrimary : t.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// --- Botones -----------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  height,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={(s) => [
        styles.button,
        {
          height: height ?? t.size.buttonHeight,
          borderRadius: t.radius.button,
          backgroundColor: primary ? t.colors.primary : t.colors.card,
          borderColor: primary ? t.colors.primary : t.colors.border,
          opacity: disabled ? 0.5 : s.pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={[t.type.button, { color: primary ? t.colors.onPrimary : t.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

// --- Switch (48 × 28) --------------------------------------------------------------

/** Solo el dibujo: la fila completa es la que recibe el toque (objetivo ≥ 44). */
export function SwitchTrack({ on }: { on: boolean }) {
  const t = useTheme();
  const { width, height, knob } = t.size.switch;
  const gap = (height - knob) / 2;
  return (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: on ? t.colors.primary : t.colors.trackOff }}>
      <View
        style={{
          position: 'absolute',
          top: gap,
          left: on ? width - knob - gap : gap,
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          backgroundColor: on ? t.colors.onPrimary : '#FFFFFF',
        }}
      />
    </View>
  );
}

export function SwitchRow({
  title,
  hint,
  value,
  onChange,
  first = false,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      style={[styles.switchRow, !first && { borderTopWidth: 1, borderTopColor: t.colors.border }]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[t.type.rowTitle, { color: t.colors.text }]}>{title}</Text>
        <Text style={[t.type.meta, { color: t.colors.muted, marginTop: 2 }]}>{hint}</Text>
      </View>
      <SwitchTrack on={value} />
    </Pressable>
  );
}

// --- Control segmentado ----------------------------------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.segmented, { backgroundColor: t.colors.soft, borderRadius: t.radius.segmented }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[
              styles.segment,
              { borderRadius: t.radius.segment },
              selected && [styles.segmentShadow, { backgroundColor: t.colors.card }],
            ]}
          >
            <Text style={[selected ? t.type.chipActive : t.type.chip, { fontSize: 15, color: selected ? t.colors.text : t.colors.muted }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Textos ------------------------------------------------------------------------

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={style}>
      <Text accessibilityRole="header" style={[t.type.sectionLabel, { color: t.colors.muted }]}>
        {children}
      </Text>
    </View>
  );
}

/** Mensaje centrado y tranquilo para estados vacíos o de fin. */
export function Notice({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.notice}>
      <Text style={[t.type.cardTitle, { color: t.colors.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[t.type.body, { color: t.colors.muted, textAlign: 'center', marginTop: 8 }]}>{body}</Text> : null}
      {children}
    </View>
  );
}

/** Encabezado de pantalla de pestaña: título grande a la izquierda. */
export function ScreenTitle({ children, right }: { children: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.screenTitle}>
      <Text accessibilityRole="header" style={[t.type.screenTitle, { color: t.colors.text, flex: 1 }]}>
        {children}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 },
  segmented: { flexDirection: 'row', padding: 4 },
  segment: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  segmentShadow: {
    shadowColor: '#1F1633',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  notice: { paddingHorizontal: 32, paddingVertical: 48, alignItems: 'center' },
  screenTitle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, minHeight: 60 },
});
