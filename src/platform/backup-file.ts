// Pegamento con Expo: escribir/compartir y elegir/leer el archivo de respaldo.
// Requiere: npx expo install expo-file-system expo-sharing expo-document-picker
// Usa la API de archivos `File`/`Paths` de expo-file-system (SDK 54+).

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  type ImportMode,
  type ImportReport,
} from '../backup/backup.ts';

/** Genera el JSON y abre la hoja nativa de compartir (Archivos, Drive, correo, AirDrop…). */
export async function shareBackup(db: SQLiteDatabase): Promise<void> {
  const backup = await exportBackup(db);
  const file = new File(Paths.cache, backupFileName());
  if (file.exists) file.delete();
  file.create();
  file.write(serializeBackup(backup));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartir archivos no está disponible en este dispositivo.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Guardar respaldo de Curio',
  });
}

export interface PickedImport {
  report: ImportReport;
  rejected: number;
}

/** El usuario elige un .json; se valida y se importa. null si canceló. */
export async function pickAndImportBackup(db: SQLiteDatabase, mode: ImportMode): Promise<PickedImport | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;

  const text = await new File(res.assets[0].uri).text();
  const { backup, rejected } = parseBackup(text); // lanza BackupError con mensaje para el usuario
  const report = await importBackup(db, backup, mode);
  return { report, rejected };
}
