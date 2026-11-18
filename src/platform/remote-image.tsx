// Imagen remota con caché en disco (expo-image) e identificación ante Wikimedia.
// Si no carga, deja ver el placeholder de abajo en lugar de un hueco.

import { useState } from 'react';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';

import { CLIENT_HEADERS } from '../ingest/http.ts';

export function RemoteImage({
  uri,
  style,
  contentFit = 'cover',
  recyclingKey,
  accessibilityLabel,
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** En listas: evita que una celda reciclada muestre por un instante la imagen anterior. */
  recyclingKey?: string;
  accessibilityLabel?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === uri) return null; // el contenedor muestra su placeholder

  return (
    <Image
      // Wikimedia responde 403 al User-Agent por defecto de Android: hay que identificarse.
      source={{ uri, headers: { ...CLIENT_HEADERS } }}
      style={style ?? StyleSheet.absoluteFill}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey}
      transition={150}
      onError={(e) => {
        console.warn('Imagen no disponible', uri, e.error);
        setFailed(uri);
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
}
