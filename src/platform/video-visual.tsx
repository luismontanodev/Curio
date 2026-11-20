// Video de un momento (expo-video). Pensado para cargar rápido y gastar pocos datos:
// - Solo existe reproductor para el momento visible y el siguiente (precarga); los demás
//   muestran solo el póster.
// - Caché en disco (useCaching): un video ya visto no se vuelve a descargar.
// - Búfer corto: se descargan unos segundos por delante, no el archivo completo.
// - Póster mientras carga; con "Ahorro de datos", no arranca solo: botón para reproducir.
// - Con audio por defecto y en bucle; el usuario lo silencia con un toque.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { Play } from 'lucide-react-native';

import type { Card, Moment } from '../core/types.ts';
import { formatDuration } from '../core/video.ts';
import { CLIENT_HEADERS } from '../ingest/http.ts';
import { RemoteImage } from './remote-image.tsx';
import { useTheme } from './app-state.tsx';

/** Segundos que se descargan por adelantado: suficiente para no cortarse, sin bajar todo. */
const FORWARD_BUFFER_SEC = 6;
/** Tope de búfer en memoria (Android): ~6 MB alcanza para clips de 360–480p. */
const MAX_BUFFER_BYTES = 6 * 1024 * 1024;

export function VideoVisual({
  moment,
  active,
  preload,
  muted,
  dataSaver,
}: {
  moment: Moment;
  /** Visible en pantalla: se reproduce. */
  active: boolean;
  /** El siguiente: se prepara (descarga el inicio) pero no se reproduce. */
  preload: boolean;
  muted: boolean;
  /** "Ahorro de datos": no arranca solo, hay que tocar "Reproducir". */
  dataSaver: boolean;
}) {
  const t = useTheme();
  // Con ahorro de datos hace falta un toque; si el ahorro se apaga (p. ej. llega el Wi-Fi), arranca solo.
  const [tapped, setTapped] = useState(false);
  const started = !dataSaver || tapped;
  const url = moment.media?.videoUrl;
  const wanted = !!url && started && (active || (preload && !dataSaver));

  const source: VideoSource = wanted
    ? { uri: url, headers: { ...CLIENT_HEADERS }, useCaching: true, contentType: 'progressive' }
    : null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = muted;
    p.bufferOptions = {
      preferredForwardBufferDuration: FORWARD_BUFFER_SEC,
      maxBufferBytes: MAX_BUFFER_BYTES,
      minBufferForPlayback: 1,
    };
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (wanted && active) player.play();
    else player.pause();
  }, [player, wanted, active]);

  // Al salir de pantalla y volver con "Ahorro de datos", vuelve a pedir el toque.
  useEffect(() => {
    if (!active) setTapped(false);
  }, [active]);

  const ready = wanted && status === 'readyToPlay';
  const poster = moment.media?.imageUrl;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Póster: visible mientras el video carga (o si no se va a cargar). */}
      {poster ? <RemoteImage uri={poster} fit="contain" recyclingKey={`${moment.id}:poster`} accessibilityLabel={moment.hook} /> : null}

      {wanted ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : null}

      {!started ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Pressable
            onPress={() => setTapped(true)}
            accessibilityRole="button"
            accessibilityLabel="Reproducir video"
            style={({ pressed }) => [styles.play, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Play size={30} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
          </Pressable>
          <Text style={[t.type.meta, styles.hint]}>Ahorro de datos: toca para reproducir</Text>
        </View>
      ) : null}

      {/* Cargando: una señal discreta sobre el póster para que no parezca congelado. */}
      {wanted && active && !ready && status !== 'error' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <View style={styles.loading}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        </View>
      ) : null}

      {wanted && status === 'error' ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text style={[t.type.meta, styles.hint]}>No se pudo cargar el video</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#FFFFFF', marginTop: 10, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
});

/**
 * Video en el lector (desde Destacados, Explorar o Guardados): póster con botón de
 * reproducir; al tocarlo carga el video con audio y controles nativos. No arranca solo.
 */
export function ReaderVideo({ card }: { card: Card }) {
  const t = useTheme();
  const [started, setStarted] = useState(false);
  const url = card.video?.url;
  const source: VideoSource = started && url ? { uri: url, headers: { ...CLIENT_HEADERS }, useCaching: true, contentType: 'progressive' } : null;
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.bufferOptions = { preferredForwardBufferDuration: FORWARD_BUFFER_SEC, maxBufferBytes: MAX_BUFFER_BYTES };
  });

  useEffect(() => {
    if (started) player.play();
  }, [player, started]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {card.imageUrl ? <RemoteImage uri={card.imageUrl} fit="contain" accessibilityLabel={card.title} /> : null}
      {started ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls allowsPictureInPicture={false} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Pressable
            onPress={() => setStarted(true)}
            accessibilityRole="button"
            accessibilityLabel="Reproducir video"
            style={({ pressed }) => [styles.play, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Play size={30} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.5} />
          </Pressable>
          {card.video ? <Text style={[t.type.meta, styles.hint]}>{formatDuration(card.video.durationSec)}</Text> : null}
        </View>
      )}
    </View>
  );
}
