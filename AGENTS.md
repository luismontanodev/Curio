# AGENTS.md — Curio

Guía para agentes de código (Codex y similares) y para quien retome el proyecto.
Léela completa antes de cambiar algo.

## Qué es

**Curio** es una app móvil (Android + iOS) de scroll infinito con contenido de **ciencia,
arte, cultura e historia**, diseñada para no provocar *brain rot*:

- Filtra títulos sensacionalistas y clickbait con un scorer de reglas.
- Solo usa fuentes curadas (museos, enciclopedias), sin métricas de popularidad.
- Sugiere una pausa cada N tarjetas.

## Filosofía (no negociable)

> **El usuario es dueño de lo que consume.** Es la espina dorsal de la app.

1. **Local-first, sin servidor.** La base de datos vive en el teléfono (SQLite). No hay
   backend, cuentas ni nube propia.
2. **Solo APIs públicas sin key.** Nada secreto dentro del binario. Una fuente que pide key
   no se agrega sin discutirlo (requeriría un proxy y rompe el punto 1).
3. **Datos portables.** El usuario exporta e importa todo en un JSON legible
   (`curio-backup` v1). Cualquier dato nuevo que sea "del usuario" (guardados,
   preferencias, notas futuras) **debe** entrar en el respaldo.
4. **Nada de mecánicas de enganche.** Sin likes, contadores, rachas, notificaciones
   push de "vuelve", *most read* ni *breaking news*.
5. **Transparencia.** Cada tarjeta muestra su fuente, su licencia y un enlace al original.

## Stack

- **App:** React Native + **Expo** (SDK 58, New Architecture obligatoria), expo-router,
  TypeScript estricto.
- **UI:** Space Grotesk + Inter (`@expo-google-fonts/*`), íconos `lucide-react-native` (+ `react-native-svg`).
- **Base local:** `expo-sqlite`.
- **Archivos:** `expo-file-system` (API `File`/`Paths`), `expo-sharing`, `expo-document-picker`.
- **Lógica de dominio:** TypeScript puro, sin dependencias, probada en Node 22.18+ con
  `node:test` y `node:sqlite` (el mismo motor SQLite).
- El autor es ingeniero backend (Node.js ESM, TypeScript): prioriza código explícito,
  probado y sin magia.

## Estado actual

| Pieza | Estado |
|---|---|
| `src/core` — tipos, scorer, clasificador de temas, bloques de lectura, fuentes, normalizadores | ✅ Hecho y probado |
| `src/db` — migraciones (v2), feed con cursor por idioma/tipo/fuente, vistos, guardados con texto completo, prefs | ✅ Hecho y probado con SQLite real |
| `src/ingest` — Wikipedia (es/en/fr/pt), The Conversation, Wikidata (arte), Met, NASA; modo "traer más" | ✅ Verificado contra las APIs reales (2026-11-17); fixtures reales en `test/fixtures/` |
| `src/backup` — exportar/validar/importar JSON | ✅ Hecho y probado |
| `src/platform` — respaldo, ingesta en cola, feed infinito, lector, imágenes (expo-image), estado compartido | ✅ Typecheckea y empaqueta (Metro); ⚠️ **sin probar en un dispositivo** |
| `src/ui` — tokens (`theme.ts`) y textos derivados (`format.ts`) | ✅ Hecho; `format.ts` probado |
| `src/components` — primitivas, tarjeta del feed, tarjeta de pausa, pie del scroll infinito | ✅ Escrito; ⚠️ sin probar en dispositivo |
| Pantallas `app/` — Inicio, Destacados, Guardados, Mis datos, Filtros, Lector | ✅ Escritas; ⚠️ sin probar en dispositivo |
| Proyecto Expo (SDK 58) | ✅ Creado; `npx expo export --platform android` empaqueta sin errores |

`npm test` → 70/70 pasan. `npm run typecheck` → limpio (app con `tsconfig.json`; lógica pura y
tests con `tsconfig.test.json`, que agrega los tipos de Node).

## Siguientes pasos (en orden)

1. **Correr la app en un dispositivo** (`npx expo run:android` / `run:ios`; expo-sqlite necesita
   build de desarrollo o Expo Go compatible con SDK 58) y revisar las pantallas contra
   `docs/design/mockups/*.png`.
2. **Verificar `src/platform/backup-file.ts`** en dispositivo (API de `File`/`Paths`,
   `Sharing.shareAsync`, `DocumentPicker.getDocumentAsync`).
3. Cambiar el contacto de `USER_AGENT` en `src/ingest/http.ts` (Wikimedia lo pide).
4. Fuentes nuevas sin key (candidata principal: Art Institute of Chicago). Ver `docs/APIS.md`.

### Notas de la interfaz

- **Rutas:** `app/_layout.tsx` (fuentes, SQLite, `AppStateProvider`) → `app/(tabs)/` con
  `index` (Inicio), `destacados`, `guardados`, `perfil` (Mis datos); encima, `app/filtros.tsx`
  y `app/leer/[id].tsx` (lector).
- **Todo se lee dentro de la app. Nunca abras el navegador** (`expo-web-browser`, `Linking`).
  El lector usa `card.body` si la fuente dio el texto completo (The Conversation, CC BY-ND) o
  pide el artículo a Wikipedia al abrir (`fetchWikipediaArticle`). El enlace original se muestra
  como atribución seleccionable y se puede compartir, pero no se navega.
- **Scroll infinito** (`src/platform/use-infinite-feed.ts`): primero el teléfono por cursor; al
  acabarse, `runIngest({ more: true })` (página siguiente de The Conversation, efemérides de otro
  día, más destacados y arte) y se agrega lo nuevo con `excludeIds`. Nunca hay "fin del feed":
  el pie dice "Buscando más…", "Sin conexión" o "No encontramos más", con botón para reintentar.
- **Ingesta en cola** (`ingest-queue.ts`): una a la vez, porque expo-sqlite comparte la conexión.
- **Idiomas:** `FilterPrefs.languages` (es/en/fr/pt). La interfaz siempre en español; el feed
  solo muestra tarjetas en esos idiomas y la ingesta solo pide esos idiomas. Met y NASA solo
  entran con inglés.
- **Estado compartido:** `src/platform/app-state.tsx` (`useAppState`, `useTheme`). Después de
  importar un respaldo se llama `reload()`. `toggleSaved` es estable (lee un ref) para no
  redibujar toda la lista al guardar.
- **Tema:** `AppPrefs.theme` (`system` | `light` | `dark`) vive en las preferencias y viaja en el respaldo.
- **Imágenes:** siempre con `RemoteImage` (expo-image, caché en disco y `CLIENT_HEADERS`).
- **Componentes** en `src/components/` no importan `expo-*` directamente; lo que lo necesita
  (imágenes, compartir, SQLite, navegación) va en `src/platform/`.
- Los tipos de rutas (`.expo/types`) se regeneran con `npx expo start`; si el typecheck se queja
  de un `href`, arráncalo una vez.

## Arquitectura

```
APIs públicas sin key (por idioma)    Teléfono
──────────────────────────────────    ─────────────────────────────────────────────────
Wikipedia featured + destacados ─┐
The Conversation (Atom, completo)─┤
Wikidata SPARQL (arte)           ├─► src/ingest → classify + scorer → SQLite (curio.db)
The Met, NASA (solo inglés)     ─┘    al abrir (≥ 3 h), al jalar,        ├─► feed infinito
                                       o "traer más" al final del feed   ├─► lector (en la app)
Wikipedia (texto del artículo) ──────────────── al abrir el lector ───────┤
                                                                          ├─► guardados
                                                                          └─► respaldo .json
```

### Carpetas

| Ruta | Contenido | ¿Depende de Expo? |
|---|---|---|
| `src/core/types.ts` | `Card`, `RawCard`, `FilterPrefs`, `AppPrefs`, `Topic`… | No |
| `src/core/scorer.ts` | Scorer anti-sensacionalismo, `evaluate`, `findBlockedWord`, `normalize` | No |
| `src/core/sources.ts` | Registro de fuentes y su `kind` | No |
| `src/core/normalizers/` | Respuesta de API → `RawCard` (Met, Wikipedia, Commons, The Conversation, Wikidata, NASA) | No |
| `src/core/classify.ts` | Tema por palabras clave (Tecnología, Espacio, Naturaleza, Música) para fuentes que no clasifican | No |
| `src/core/blocks.ts` | HTML / texto de Wikipedia → `ContentBlock[]` para el lector; validación de bloques | No |
| `src/db/sql.ts` | Interfaz `SqlDb` (= subconjunto de `SQLiteDatabase` de expo-sqlite) | No |
| `src/db/migrations.ts` | `MIGRATIONS` + `migrate()` con `PRAGMA user_version` | No |
| `src/db/cards.ts` | Insertar, `getFeedPage`, vistos, guardados, poda, rescore | No |
| `src/db/prefs.ts` | Preferencias en tabla `kv`, `sanitizePrefs` | No |
| `src/ingest/` | `http.ts` (fetch inyectable), un fetcher por fuente, `article.ts` (texto para el lector), `ingest.ts` | No |
| `src/backup/backup.ts` | Formato `curio-backup` v1: export, parse (no confiable), import | No |
| `src/ui/theme.ts` | Tokens de color, tipografía, espaciado, radios | No |
| `src/ui/format.ts` | Textos derivados de una tarjeta, resumen de importación, pausas | No |
| `src/components/` | Primitivas, tarjeta del feed, tarjeta de pausa | Usa React Native, no `expo-*` |
| `src/platform/` | Pegamento con Expo | **Sí** |
| `app/` | Rutas de expo-router | **Sí** |
| `test/` | Tests con `node:sqlite` (adaptador en `test/helpers/node-db.ts`) | No |
| `docs/` | Diseño, APIs, fuentes del canvas | — |

### Decisiones clave

- **`SqlDb` como frontera.** Todo `src/db`, `src/ingest` y `src/backup` reciben un `SqlDb`.
  En la app se pasa la conexión de expo-sqlite tal cual; en tests, el adaptador de
  `node:sqlite`. No importes `expo-*` fuera de `src/platform` y `app/`.
- **`fetch` inyectable** (`FetchLike`): la ingesta se prueba sin red.
- **Feed por cursor** `(ingested_at, id)` descendente: estable aunque entren tarjetas
  mientras el usuario scrollea. Nunca uses `OFFSET`.
- **Mezcla de fuentes:** la ingesta baraja el lote y escalona `ingested_at` 1 ms por
  tarjeta para que el feed alterne fuentes.
- **Palabras bloqueadas en JS**, no en SQL (normalización sin acentos igual al scorer);
  `getFeedPage` lee en lotes hasta llenar la página.
- **Guardados = copia completa** (`card_json`): sobreviven a la poda de 30 días y son lo
  que viaja en el respaldo.
- **La ingesta solo marca `lastIngestAt` si alguna fuente respondió**, para reintentar al
  volver a abrir sin red.
- **Respaldo importado = entrada no confiable:** validación campo por campo, solo URLs
  `http(s)`, puntajes recalculados, inválidos descartados y contados.

## Scorer anti-sensacionalismo

Dos categorías con puntaje independiente (el usuario puede apagar cada una):

- **Sensacionalismo:**
  - Mayúsculas: ≥30 % de palabras gritadas suma +3; si son menos, +1 por palabra, máximo +2. No cuentan las siglas en lista blanca (NASA, UNESCO, ADN…).
  - `!` y `¡`: +2 cada uno, máximo +4.
  - Palabras emocionales: +1.5.
  - Superlativos: +1.
  - Emoji: +1.
- **Clickbait:**
  - Frases gancho ("no creerás", "you won't believe"…): +3.
  - Listicle ("10 cosas…"): +2.
  - Pregunta: +1.5.
  - Inicio vago ("Esto…", "Así…"): +1.5.

Multiplicador por confianza de la fuente: museum/encyclopedia ×0.5, journal ×0.7,
magazine ×1, news ×1.2. Umbral máximo por categoría: suave 6, moderado 4, estricto 2.5.

Las frases se comparan normalizadas (minúsculas, sin acentos ni apóstrofos) y con límites
de palabra ("viral" no coincide con "antiviral").

**Si cambias reglas o pesos, sube `SCORER_VERSION`**: `rescoreOutdated` recalcula las
tarjetas viejas en la siguiente ingesta. Agrega un caso de prueba por cada regla nueva en
`test/scorer.test.ts` (títulos legítimos que deben pasar + títulos que deben caer).

## Base local (SQLite)

- `cards` — el feed. `source_kind` se copia en la fila para evitar joins. `body` (migración 2)
  guarda el texto completo en JSON; el feed no lo lee (`LIST_COLUMNS`), solo `getCard`.
  Poda: >30 días y no guardada.
- `card_views` — vistos (FK con `on delete cascade`).
- `saved_cards` — `card_id`, `saved_at`, `card_json` (copia completa, con `body`).
- `kv` — `prefs` (JSON saneado con `sanitizePrefs`), `lastIngestAt` y `conversationPage:<lang>`
  (página siguiente de The Conversation para "traer más").
- Preferencias guardadas por versiones anteriores (sin `languages`) ganan el tema Tecnología al
  leerse (`upgradeStoredPrefs`); los respaldos importados no se tocan.

**Migraciones:** agrega una nueva al final de `MIGRATIONS`; **nunca** edites una publicada.
`migrate()` rechaza bases con versión mayor que la conocida.

## Formato del respaldo

Ver `README.md` § "Formato del respaldo". Si agregas campos: súbelos como opcionales en la
misma versión si son retrocompatibles; si no, sube `BACKUP_VERSION` y mantén la lectura de
versiones anteriores.

## Convenciones

- TypeScript estricto, ESM, imports con extensión `.ts`, solo sintaxis "erasable" (sin
  `enum`, sin `namespace`, sin parameter properties): el código corre directo en Node.
- Sin dependencias en la lógica pura. Pregunta antes de agregar una.
- Textos para el usuario en **español**; identificadores en inglés.
- Errores que verá el usuario: mensajes en español, claros, sin jerga.
- Cada cambio de lógica viene con tests. Ejecuta `npm test && npm run typecheck`.
- Accesibilidad: objetivos táctiles ≥ 44 px, contraste ≥ 4.5:1, `accessibilityLabel` en botones de solo ícono.

## Comandos

```sh
npm test            # node --test con node:sqlite (Node ≥ 22.18)
npm run typecheck   # tsc sin emitir
```

## Documentos

- `docs/DESIGN.md` — layout, paleta clara/oscura, tipografía, pantallas y componentes.
- `docs/APIS.md` — APIs usadas, campos, candidatas y descartadas.
- `docs/design/source/` — fuentes `.dc.html` del canvas de diseño original (referencia visual;
  usan un runtime propio, no se ejecutan tal cual).
