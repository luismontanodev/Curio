// Imagen remota con caché en disco (expo-image) e identificación ante Wikimedia.
// - Pide una versión nítida (sharperImageUrl) y, si falla, vuelve a la original.
// - `fit="contain"` muestra la obra completa, sin recortarla ni estirarla, sobre una copia
//   desenfocada de sí misma que llena el espacio (como Instagram).
// - Si nada carga, deja ver el placeholder del contenedor en lugar de un hueco.

import { useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';

import { sharperImageUrl } from '../core/images.ts';
import { CLIENT_HEADERS } from '../ingest/http.ts';

type Stage = 'sharp' | 'original' | 'failed';

export function RemoteImage({
  uri,
  style,
  fit = 'cover',
  recyclingKey,
  accessibilityLabel,
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** `cover` llena y recorta (mosaicos); `contain` muestra la imagen completa con fondo desenfocado. */
  fit?: 'cover' | 'contain';
  /** En listas: evita que una celda reciclada muestre por un instante la imagen anterior. */
  recyclingKey?: string;
  accessibilityLabel?: string;
}) {
  const sharp = sharperImageUrl(uri);
  const [state, setState] = useState<{ uri: string; stage: Stage }>({ uri, stage: sharp === uri ? 'original' : 'sharp' });
  // Si cambia la imagen (celda reciclada), se empieza de nuevo.
  const current = state.uri === uri ? state.stage : sharp === uri ? 'original' : 'sharp';
  if (current === 'failed') return null;

  const src = { uri: current === 'sharp' ? sharp : uri, headers: { ...CLIENT_HEADERS } };
  const onError = () => setState({ uri, stage: current === 'sharp' ? 'original' : 'failed' });

  if (fit === 'cover') {
    return (
      <Image
        source={src}
        style={style ?? StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        transition={150}
        onError={onError}
        accessibilityLabel={accessibilityLabel}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, style as object]}>
      {/* Fondo: la misma imagen, desenfocada y oscurecida apenas, para no dejar franjas vacías. */}
      <Image
        source={src}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={28}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ? `${recyclingKey}:bg` : undefined}
        accessible={false}
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <Image
        source={src}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        transition={150}
        onError={onError}
        accessibilityLabel={accessibilityLabel}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.12)' },
});
