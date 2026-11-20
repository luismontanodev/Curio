// Degradado lineal con react-native-svg (ya es dependencia por los íconos): sin paquetes nuevos.
// Llena a su padre (posición absoluta); el padre decide la forma (radio, overflow hidden).

import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function Gradient({
  colors,
  direction = 'horizontal',
  style,
}: {
  colors: readonly [string, string];
  /** `horizontal`: de izquierda a derecha (acento). `vertical`: de arriba abajo (velo sobre fotos). */
  direction?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
}) {
  // Un id por instancia: varios degradados en pantalla no se pisan.
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const end = direction === 'horizontal' ? { x2: '1', y2: '0' } : { x2: '0', y2: '1' };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" {...end}>
            <Stop offset="0" stopColor={colors[0]} stopOpacity={1} />
            <Stop offset="1" stopColor={colors[1]} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Velo oscuro (de transparente a negro) en la parte de abajo de una foto, para el texto. */
export function Scrim({ height = '65%' }: { height?: `${number}%` | number }) {
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={[styles.scrim, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="0.45" stopColor="#000000" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.85} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
