# Curio — núcleo local-first

Feed de ciencia, arte y cultura **sin servidor**: el teléfono consulta APIs públicas,
filtra el sensacionalismo y guarda todo en una base SQLite propia. El usuario es dueño
de sus datos y puede llevárselos en un archivo JSON legible.

## Cómo fluye la información

```
APIs públicas sin key           Teléfono del usuario
─────────────────────           ─────────────────────────────────────────────
The Met (búsqueda + objeto) ─┐
                             ├─► ingest/  →  core/scorer  →  SQLite (curio.db)
Wikipedia ES "featured"     ─┘   (al abrir      (puntaje        │
  · artículo destacado            la app,        anti-          ├─► feed (cursor, filtros)
  · imagen del día                cada ≥3 h)     sensacionalismo)├─► guardados
  · efemérides                                                   └─► respaldo .json ⇄ usuario
```

Se ignoran a propósito *most read* y *news* del feed de Wikipedia: premian lo popular y lo urgente.

## Estructura

| Carpeta | Qué hay | ¿Depende de Expo? |
|---|---|---|
| `src/core/` | Tipos, scorer, fuentes y normalizadores | No |
| `src/db/` | Migraciones, tarjetas, guardados, vistos, preferencias | No (usa la interfaz `SqlDb`) |
| `src/ingest/` | Fetchers del Met y Wikipedia, orquestador | No (recibe `fetch`) |
| `src/backup/` | Exportar, validar e importar el respaldo JSON | No |
| `src/platform/` | Pegamento con Expo: archivo de respaldo, hook de ingesta | Sí |
| `app/_layout.tsx` | Abre la base y migra antes de renderizar | Sí |
| `test/` | 70 tests con SQLite real (`node:sqlite`) | No |

`SqlDb` (`src/db/sql.ts`) es el mismo subconjunto de métodos que `SQLiteDatabase` de
expo-sqlite (`execAsync`, `runAsync`, `getFirstAsync`, `getAllAsync`, `withTransactionAsync`).
En la app se pasa la conexión de Expo tal cual; en los tests, un adaptador sobre `node:sqlite`.

## Montarlo en Expo

```sh
npx create-expo-app@latest curio
cd curio
npx expo install expo-sqlite expo-file-system expo-sharing expo-document-picker
```

Copia `src/` y `app/_layout.tsx` al proyecto. En el `tsconfig.json` de Expo agrega
`"allowImportingTsExtensions": true` (los imports usan extensión `.ts` para que el mismo
código corra en Node sin compilar). Si Metro se queja de esos imports, quita la extensión
`.ts` de los imports en `src/` y `app/`.

Antes de publicar, cambia el contacto en `USER_AGENT` (`src/ingest/http.ts`):
Wikimedia pide que los clientes se identifiquen.

Uso típico en pantallas:

```ts
const db = useSQLiteContext();
const { refresh } = useIngestOnOpen();          // ingesta al abrir / volver a primer plano
const prefs = await getPrefs(db);
const page = await getFeedPage(db, prefs, { cursor, limit: 20 });
await markSeen(db, visibles.map((c) => c.id));  // al pasar tarjetas
await shareBackup(db);                          // "Exportar mis datos"
await pickAndImportBackup(db, 'merge');         // "Importar respaldo"
```

## Probar la lógica sin teléfono

```sh
npm test         # Node 22.18+ (corre .ts directo y trae SQLite integrado)
npm run typecheck
```

## Base local

`PRAGMA user_version` guarda la versión del esquema. Para cambiarlo, **agrega** una
migración al final de `MIGRATIONS`; no edites una ya publicada.

- `cards`: el feed. Se podan las de más de 30 días que no estén guardadas.
- `card_views`: lo visto, para no repetir (se borra en cascada con la poda).
- `saved_cards`: copia completa de cada guardado; sobrevive a la poda.
- `kv`: preferencias (JSON) y estado (`lastIngestAt`).

Si cambias reglas del scorer, sube `SCORER_VERSION`: la siguiente ingesta recalcula
las tarjetas viejas.

## Formato del respaldo (`curio-respaldo-AAAA-MM-DD.json`)

```json
{
  "format": "curio-backup",
  "version": 1,
  "exportedAt": "2026-11-17T18:00:00.000Z",
  "scorerVersion": 1,
  "prefs": {
    "topics": ["ciencia", "tecnologia", "arte", "cultura", "historia"],
    "level": "estricto",
    "hideSensational": true,
    "hideClickbait": true,
    "onlyVerified": true,
    "blockedWords": ["urgente"],
    "languages": ["es"],
    "pauseEvery": 20,
    "theme": "system"
  },
  "saved": [
    { "savedAt": "2026-11-10T00:00:00.000Z", "card": { "id": "met:45434", "title": "…", "url": "https://…", "…": "…" } }
  ]
}
```

Al importar, el archivo se trata como no confiable: se valida campo por campo, solo se
aceptan URLs `http(s)`, los puntajes se recalculan y lo inválido se descarta (y se cuenta).

- **merge**: agrega guardados nuevos, adopta las preferencias del archivo y suma las palabras bloqueadas.
- **replace**: el teléfono queda exactamente como el respaldo.

## Límites conocidos

- iOS restringe el trabajo en segundo plano: la ingesta ocurre al abrir la app, no con la app cerrada.
- Las tarjetas del Met y las descripciones de Commons llegan en inglés.
- El tema de la imagen del día y del artículo destacado es `cultura` por defecto; la API no lo clasifica.
