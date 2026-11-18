# AGENTS.md — Curio

Guía para agentes de código (Codex y similares) y para quien retome el proyecto.
Léela completa antes de cambiar algo.

## Qué es

**Curio: un minuto de asombro.** App móvil (Android + iOS) de **momentos** de arte, ciencia e
historia: uno a la vez, a pantalla completa, con swipe vertical. El enganche es el de
TikTok/Reels, pero en versión sana:

- Cada momento es una imagen o visual, un **gancho** honesto y su **payoff** en la misma pantalla.
- Los momentos corren en un **scroll infinito** con una **pausa sugerida** cada N (configurable).
- Filtra sensacionalismo y clickbait con un scorer de reglas.
- Solo usa fuentes curadas (museos, enciclopedias), sin métricas de popularidad.

> **Importante (v2):** la primera versión era un feed en lista y la gente lo confundía con
> una app de noticias. La experiencia principal ahora son los momentos. Lee
> `docs/PRODUCTO.md` antes de diseñar o implementar cualquier pantalla.
>
> **Navegación (decisión del 2026-11-17, al estilo Instagram):** cuatro pestañas —
> **Destacados** (inicio: "lo que sigues"), **Explorar** (recomendaciones + búsqueda),
> **Momentos** (reels infinitos) y **Mis datos** (con Guardados y Filtros). Reemplaza a los
> capítulos de 10 con Cierre que proponía `docs/PRODUCTO.md`.

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
   El enlace es atribución (texto seleccionable y compartible): la lectura ocurre dentro de
   la app y nada abre el navegador.
6. **Curiosidad sí, clickbait no.** Un gancho puede abrir una duda solo si la cierra en el
   mismo momento (`payoff`). Todo gancho debe poder sostenerse con las fuentes del propio
   momento. Si no se puede verificar, no se publica.
7. **Siempre hay una pausa.** El contenido es infinito, pero la app sugiere parar cada N
   momentos (Pausa sugerida, en Filtros) con "Terminar por hoy" como botón principal, y
   nunca empuja a seguir. *(Antes: "siempre hay un final", con capítulos de 10 y cierre;
   cambió por decisión de producto el 2026-11-17.)*

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
| `src/ingest` — Wikipedia (es/en/fr/pt), The Conversation, Wikidata (arte), Met, NASA, Agencia SINC, Cleveland, V&A, iNaturalist, NASA EPIC, Europe PMC (Art Institute listo pero apagado); modo "traer más" | ✅ Verificado contra las APIs reales (2026-11-17); fixtures reales en `test/fixtures/` |
| `src/backup` — exportar/validar/importar JSON | ✅ Hecho y probado |
| `src/platform` — respaldo, ingesta en cola, feed infinito, lector, imágenes (expo-image), estado compartido | ✅ Typecheckea y empaqueta (Metro); ⚠️ **sin probar en un dispositivo** |
| `src/ui` — tokens (`theme.ts`, incluye los de v2) y textos derivados (`format.ts`) | ✅ Hecho; `format.ts` probado |
| `src/components` — primitivas, tarjeta del feed, página de momento, pie del scroll infinito | ✅ Escrito; ⚠️ sin probar en dispositivo |
| Pantallas `app/` — Destacados, Explorar, Momentos, Mis datos (+ Guardados, Filtros, Lector) | ✅ Escritas; ⚠️ sin probar en dispositivo |
| Proyecto Expo (SDK 58) | ✅ Creado; `npx expo export --platform android` empaqueta sin errores |
| Diseño v2 (momentos): bienvenida, momento, profundizar, microjuego, línea de tiempo, cierre | ✅ Diseñado: `docs/DESIGN.md` + `docs/design/mockups/v2-*.png` |
| Modelo `Moment`, `scoreHook`, mezcla con variedad (`src/core/moments.ts`, `src/db/moments.ts`) | ✅ Hecho y probado |
| Recomendación de Explorar (`src/core/recommend.ts`) y búsqueda (teléfono + Wikipedia, `src/ingest/search.ts`) | ✅ Hecho y probado |
| Pantallas v2: Profundizar (hoja), Bienvenida, Microjuego, Línea de tiempo | ❌ Pendiente |

`npm test` → 102/102 pasan. `npm run typecheck` → limpio (app con `tsconfig.json`; lógica pura y
tests con `tsconfig.test.json`, que agrega los tipos de Node).

## Siguientes pasos (en orden)

1. **Correr la app en un dispositivo** (`npx expo run:android` / `run:ios`; expo-sqlite necesita
   build de desarrollo o Expo Go compatible con SDK 58) y revisar las pantallas contra
   `docs/design/mockups/*.png`.
2. **Verificar `src/platform/backup-file.ts`** en dispositivo (API de `File`/`Paths`,
   `Sharing.shareAsync`, `DocumentPicker.getDocumentAsync`).
3. ✅ **Modelo v2 en `src/core`** (puro y probado): `Moment`, `scoreHook` (pregunta e inicio vago
   solo con payoff), `Card → Moment` (`image-fact`, `text-fact`, `event`), ganchos calculados
   (`which-first`, `timeline`) y `mixMoments` (lotes sin más de 2 seguidos del mismo formato o
   fuente). Pendiente: la edad del artista (el Met trae `objectBeginDate`/`artistBeginDate`;
   hoy `MetObject` no los lee).
4. ✅ **Navegación v2 al estilo Instagram** (ver "Notas de la interfaz"). Los capítulos de 10
   se descartaron: la migración 3 (tabla `chapters`) queda en desuso pero no se quita
   porque ya se aplicó en dispositivos.
5. **Pantallas v2 pendientes**, en este orden: Profundizar (hoy el botón abre directo el lector;
   falta la hoja de 30 s con ficha) → Microjuego y Línea de tiempo (el modelo ya los calcula;
   al pintarlos, agrégalos a `RENDERED_FORMATS`) → Bienvenida.
6. Paquetes curados `curio-pack` (JSON estático en un repo público), validados como
   entrada no confiable. Ver `docs/PRODUCTO.md`.
7. Cambiar el contacto de `USER_AGENT` en `src/ingest/http.ts` (Wikimedia lo pide).
8. Fuentes nuevas sin key (candidata principal: Art Institute of Chicago). Ver `docs/APIS.md`.

Ya hechos (de la lista de v2): proyecto Expo creado, APIs verificadas contra respuestas
reales, `src/platform` compilado y empaquetado.

### Notas de la interfaz

- **Rutas:** `app/_layout.tsx` (fuentes, SQLite, `AppStateProvider`, `IngestProvider`) →
  `app/(tabs)/`: `index` (**Destacados**, inicio), `explorar`, `momentos`, `perfil` (Mis datos);
  apiladas encima: `app/guardados.tsx` y `app/filtros.tsx` (se abren desde Mis datos, Explorar y
  Destacados) y `app/leer/[id].tsx` (lector).
- **Destacados:** solo artículos realmente destacados (`externalPrefixes: ['fa:', 'tfa:']`); los
  resultados de búsqueda de Wikipedia usan ids `pg:` y no se cuelan.
- **Explorar:** `recommend` ordena lo no visto por afinidad con **lo guardado** (intención, no
  tiempo de visualización), frescura, imagen y calidad, sin más de 2 seguidas del mismo tema;
  cada tarjeta dice por qué aparece ("Porque guardaste arte", "Nuevo para ti"). La búsqueda
  muestra primero lo del teléfono y luego "Relacionado en Wikipedia" en los idiomas del
  usuario; esos resultados se guardan como tarjetas para leerlos en el lector.
- **Momentos:** `useMomentStream` arma lotes de 12 (`mixMoments`) de lo no visto y, al
  acercarse al final, trae más de la red (`more`). Cada `pauseEvery` momentos entra una
  página de pausa ("Terminar por hoy" / "Seguir"). Un momento mostrado marca su tarjeta como
  vista. Los ganchos de fuente usan el título (hasta 120 caracteres) y el payoff es el resumen
  si cabe (220) o su primera oración; las efemérides en español calculan el payoff con la fecha.
  Los ganchos calculados usan el texto del propio hecho como etiqueta, nunca el título de la página.
- **Todo se lee dentro de la app. Nunca abras el navegador** (`expo-web-browser`, `Linking`).
  El lector usa `card.body` si la fuente dio el texto completo (The Conversation, CC BY-ND) o
  pide el artículo a Wikipedia al abrir (`fetchWikipediaArticle`). El enlace original se muestra
  como atribución seleccionable y se puede compartir, pero no se navega.
- **Scroll infinito** (`src/platform/use-infinite-feed.ts`): primero el teléfono por cursor; al
  acabarse, `runIngest({ more: true })` (página siguiente de The Conversation, efemérides de otro
  día, más destacados y arte) y se agrega lo nuevo con `excludeIds`. El *contenido* no se
  acaba: el pie dice "Buscando más…", "Sin conexión" o "No encontramos más", con botón para
  reintentar. La *experiencia* sí tiene paradas (filosofía 7): la pausa sugerida en Momentos.
- **Tarjeta compacta y pestañas:** ver "Navegación vigente" en `docs/DESIGN.md`
  (`cardSource`/`shortLicense` mantienen fuente y licencia a la vista en una línea; "Más"
  despliega el resto). `useTabReselect` hace que tocar la pestaña activa suba y actualice.
  Guardados filtra con `savedIds`, así que quitar un guardado se ve al instante.
- **Imágenes y Wikimedia:** `sharperImageUrl` pide 960 px (tamaño estándar) con vuelta a la
  original si falla. **Usa solo tamaños estándar de Wikimedia** (120, 250, 330, 500, 960, 1280…):
  el 2026-11-18 respondió 429 (*Too many requests*) a toda la IP tras muchas pruebas; los
  tamaños no estándar y un User-Agent sin contacto real se limitan más.
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

- `docs/PRODUCTO.md` — **empieza aquí**: concepto v2 (momentos), mecánicas de enganche sanas,
  regla de ganchos, formatos, capítulos y modelo de datos propuesto.
- `docs/DESIGN.md` — layout, paleta clara/oscura, tipografía, pantallas v2 y v1, componentes.
- `docs/APIS.md` — APIs usadas, campos, candidatas y descartadas.
- `docs/design/source/` — fuentes `.dc.html` del canvas de diseño original (referencia visual;
  usan un runtime propio, no se ejecutan tal cual).
