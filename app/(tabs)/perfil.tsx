// Mis datos: la filosofía de la app hecha pantalla. Exportar, importar y saber qué hay en el teléfono.

import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { BackupError, type ImportMode } from '../../src/backup/backup.ts';
import type { ThemePref } from '../../src/core/types.ts';
import { countCards } from '../../src/db/cards.ts';
import { getLastIngestAt } from '../../src/ingest/ingest.ts';
import { Button, NavRow, ScreenTitle, SectionLabel, Segmented } from '../../src/components/primitives.tsx';
import { useAppState, useTheme } from '../../src/platform/app-state.tsx';
import { pickAndImportBackup, shareBackup } from '../../src/platform/backup-file.ts';
import { useTabReselect } from '../../src/platform/use-tab-reselect.ts';
import { formatDateTime, importSummary } from '../../src/ui/format.ts';

const THEME_OPTIONS: readonly { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

interface Info {
  cards: number;
  lastIngestAt: string | null;
}

export default function MyDataScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const c = t.colors;
  const { prefs, updatePrefs, savedIds, reload } = useAppState();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    const [cards, lastIngestAt] = await Promise.all([countCards(db), getLastIngestAt(db)]);
    setInfo({ cards, lastIngestAt });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadInfo().catch((e) => console.warn('No se pudo leer la información', e));
    }, [loadInfo]),
  );

  // Tocar "Mis datos" estando aquí: sube al inicio y actualiza la información.
  const scroll = useRef<ScrollViewInstance>(null);
  useTabReselect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
    void loadInfo();
  });

  const onExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      await shareBackup(db);
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : 'Inténtalo de nuevo en un momento.');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (mode: ImportMode) => {
    setBusy('import');
    setMessage(null);
    try {
      const res = await pickAndImportBackup(db, mode);
      if (!res) return; // canceló
      await reload();
      await loadInfo();
      setMessage(importSummary(res.report, res.rejected));
    } catch (e) {
      Alert.alert(
        'No se pudo importar',
        e instanceof BackupError ? e.message : 'El archivo no se pudo leer. Revisa que sea un respaldo de Curio.',
      );
    } finally {
      setBusy(null);
    }
  };

  const onReplace = () => {
    Alert.alert(
      '¿Reemplazar todo?',
      'Tus guardados y preferencias actuales se cambiarán por los del respaldo. Esto no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', style: 'destructive', onPress: () => void runImport('replace') },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenTitle>Mis datos</ScreenTitle>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <Text style={[t.type.cardTitle, { color: c.text }]}>
          Tus datos viven en este teléfono. Puedes llevártelos cuando quieras.
        </Text>
        <Text style={[t.type.body, { color: c.muted, marginTop: 8 }]}>
          No hay cuentas ni servidores. El respaldo es un archivo JSON legible con tus guardados y preferencias.
        </Text>

        <View style={[styles.group, { borderColor: c.border, borderRadius: t.radius.group, marginTop: 20 }]}>
          <NavRow first label="Guardados" value={String(savedIds.size)} onPress={() => router.push('/guardados')} />
          <NavRow label="Filtros" value={prefs.level} onPress={() => router.push('/filtros')} />
        </View>

        <SectionLabel style={styles.section}>Respaldo</SectionLabel>
        <Button
          label={busy === 'export' ? 'Preparando…' : 'Exportar mis datos'}
          onPress={() => void onExport()}
          disabled={busy !== null}
          style={{ marginTop: 12 }}
        />

        <Text style={[t.type.rowTitle, { color: c.text, marginTop: 20 }]}>Importar respaldo</Text>
        <Text style={[t.type.meta, { color: c.muted, marginTop: 2 }]}>Elige cómo antes de abrir el archivo.</Text>
        <Button
          label="Combinar con lo que tengo"
          variant="secondary"
          height={44}
          onPress={() => void runImport('merge')}
          disabled={busy !== null}
          style={{ marginTop: 12 }}
        />
        <Button
          label="Reemplazar todo"
          variant="secondary"
          height={44}
          onPress={onReplace}
          disabled={busy !== null}
          style={{ marginTop: 8 }}
        />
        {message ? (
          <View style={[styles.message, { backgroundColor: c.soft, borderRadius: t.radius.group }]} accessibilityLiveRegion="polite">
            <Text style={[t.type.body, { color: c.text }]}>{message}</Text>
          </View>
        ) : null}

        <SectionLabel style={styles.section}>Tema</SectionLabel>
        <View style={{ marginTop: 12 }}>
          <Segmented options={THEME_OPTIONS} value={prefs.theme} onChange={(theme) => void updatePrefs({ ...prefs, theme })} />
        </View>

        <SectionLabel style={styles.section}>En este teléfono</SectionLabel>
        <View style={[styles.group, { borderColor: c.border, borderRadius: t.radius.group }]}>
          <InfoRow first label="Tarjetas en el feed" value={info ? String(info.cards) : '—'} />
          <InfoRow label="Guardados" value={String(savedIds.size)} />
          <InfoRow
            label="Última actualización"
            value={info?.lastIngestAt ? formatDateTime(info.lastIngestAt) : 'Todavía no'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: t.colors.border }]}>
      <Text style={[t.type.rowTitle, { color: t.colors.text, flex: 1 }]}>{label}</Text>
      <Text style={[t.type.body, { color: t.colors.muted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  section: { marginTop: 28 },
  message: { padding: 14, marginTop: 12 },
  group: { borderWidth: 1, marginTop: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
});
