// Raíz de la app (expo-router): carga las fuentes, abre la base local y aplica
// migraciones antes de mostrar nada.

import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { setVideoCacheSizeAsync } from 'expo-video';
import { SQLiteProvider } from 'expo-sqlite';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';

import { migrate } from '../src/db/migrations.ts';
import { AppStateProvider, useTheme } from '../src/platform/app-state.tsx';
import { IngestProvider } from '../src/platform/ingest-context.tsx';
import { colors } from '../src/ui/theme.ts';

void SplashScreen.preventAutoHideAsync();

/**
 * Caché de videos en disco (expo-video): lo ya visto no se vuelve a descargar. Se acota a
 * 150 MB (por defecto puede llegar a 1 GB); al llenarse, se borra lo más viejo.
 * Va en un efecto y no al cargar el módulo: el build (`expo export:embed`) evalúa este archivo
 * en Node, donde expo-video no tiene la función y lanzaría un error que rompe el APK.
 */
function limitVideoCache() {
  if (Platform.OS === 'web') return;
  try {
    void setVideoCacheSizeAsync(150 * 1024 * 1024).catch(() => {});
  } catch {
    // Sin el módulo nativo (p. ej. al generar el build) no hay caché que acotar.
  }
}

export default function RootLayout() {
  useEffect(limitVideoCache, []);
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [dbError, setDbError] = useState<Error | null>(null);
  const ready = fontsLoaded || fontError !== null; // sin fuentes se usa la del sistema

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  if (dbError) return <DatabaseError error={dbError} />;

  return (
    <SQLiteProvider
      databaseName="curio.db"
      onInit={async (db) => {
        await migrate(db);
      }}
      onError={setDbError}
    >
      <AppStateProvider>
        <IngestProvider>
          <RootStack />
        </IngestProvider>
      </AppStateProvider>
    </SQLiteProvider>
  );
}

function RootStack() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="filtros" />
        <Stack.Screen name="guardados" />
        <Stack.Screen name="leer/[id]" />
      </Stack>
    </>
  );
}

/** Si la base no abre (p. ej. es de una versión más nueva de la app), se explica en lugar de quedar en blanco. */
function DatabaseError({ error }: { error: Error }) {
  const c = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View style={[styles.error, { backgroundColor: c.bg }]}>
      <Text style={[styles.errorTitle, { color: c.text }]}>No se pudo abrir tus datos</Text>
      <Text style={[styles.errorBody, { color: c.muted }]}>{error.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  errorBody: { fontSize: 14, lineHeight: 20 },
});
