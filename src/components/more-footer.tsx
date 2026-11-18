// Pie del scroll infinito: buscando más, sin conexión o nada nuevo. Nunca "fin del feed".

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../platform/app-state.tsx';
import type { MoreState } from '../platform/use-infinite-feed.ts';
import { Button } from './primitives.tsx';

export function MoreFooter({ more, onRetry }: { more: MoreState; onRetry: () => void }) {
  const t = useTheme();
  const c = t.colors;

  if (more === 'idle' || more === 'fetching') {
    return (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <ActivityIndicator color={c.primaryText} />
        {more === 'fetching' ? (
          <Text style={[t.type.body, { color: c.muted, marginLeft: 10 }]}>Buscando más tarjetas…</Text>
        ) : null}
      </View>
    );
  }

  const offline = more === 'offline';
  return (
    <View style={styles.box}>
      <Text style={[t.type.body, { color: c.muted, textAlign: 'center' }]}>
        {offline
          ? 'Sin conexión por ahora. Lo que ya tienes sigue aquí.'
          : 'No encontramos más tarjetas con tus filtros en este momento.'}
      </Text>
      <Button
        label={offline ? 'Reintentar' : 'Buscar de nuevo'}
        variant="secondary"
        height={44}
        onPress={onRetry}
        style={{ marginTop: 12, alignSelf: 'center', minWidth: 180 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  box: { paddingHorizontal: 32, paddingVertical: 28 },
});
