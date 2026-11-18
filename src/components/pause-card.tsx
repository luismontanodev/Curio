// Tarjeta de pausa: un aviso tranquilo, sin culpa ni gamificación.

import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../platform/app-state.tsx';
import { Button } from './primitives.tsx';

export function PauseCard({ onContinue, onStop }: { onContinue: () => void; onStop: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.colors.soft, borderRadius: t.radius.card }]}>
      <Text style={[t.type.cardTitle, { color: t.colors.text }]}>Llevas un buen rato leyendo. ¿Una pausa?</Text>
      <Text style={[t.type.body, { color: t.colors.muted, marginTop: 6 }]}>
        Lo que no alcanzaste a ver seguirá aquí cuando vuelvas.
      </Text>
      <View style={styles.actions}>
        <Button label="Seguir" variant="secondary" height={44} onPress={onContinue} style={{ flex: 1 }} />
        <Button label="Terminar por hoy" height={44} onPress={onStop} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, padding: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
