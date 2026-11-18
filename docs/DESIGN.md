# Diseño — Curio

Simple, intuitiva y calmada. Lila / morado claro con blanco en tema claro; morado noche en
tema oscuro (no negro puro: cansa menos en lecturas largas). Los tokens están en
`src/ui/theme.ts`; este documento explica cómo usarlos.

## Principios

- **Calma sobre estímulo:** sin degradados llamativos, sin contadores, sin badges rojos.
- **Contenido primero:** la tarjeta es protagonista; el chrome es mínimo.
- **Honestidad visible:** fuente y licencia siempre a la vista.
- **Un acento:** el lila primario marca selección y acción principal; nada más compite.

## Paleta

### Tema claro

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#FFFFFF` | Fondo de pantalla |
| `card` | `#FFFFFF` | Tarjetas (con borde) |
| `soft` | `#F3EDFC` | Superficie lila: placeholders de imagen, chips inactivos de palabra, efemérides, botón de filtros |
| `border` | `#E6DCF7` | Bordes de tarjetas, chips inactivos, separadores |
| `text` | `#1F1633` | Texto principal |
| `muted` | `#5F5675` | Texto secundario, metadatos |
| `primary` | `#7B5CC6` | Botón principal, chip activo, switch encendido |
| `primaryText` | `#6B4FB8` | Texto/íconos en acento (etiquetas de tema, ícono activo) |
| `onPrimary` | `#FFFFFF` | Texto sobre `primary` |
| `trackOff` | `#D9CFEA` | Riel del switch apagado |

### Tema oscuro

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#14101E` | Fondo |
| `card` | `#1E182D` | Tarjetas |
| `soft` | `#2A2140` | Superficie lila |
| `border` | `#352B4F` | Bordes |
| `text` | `#F3EEFC` | Texto principal |
| `muted` | `#B5AACB` | Secundario |
| `primary` | `#C3AEF6` | Acción principal (lila claro) |
| `primaryText` | `#C9B6F8` | Texto/íconos en acento |
| `onPrimary` | `#1F1633` | Texto sobre `primary` (oscuro, no blanco) |
| `trackOff` | `#463B60` | Switch apagado |

### Contraste verificado (WCAG)

Claro:
- `text`/`bg`: 17.2
- `muted`/`bg`: 6.8
- `muted`/`soft`: 6.0
- `primaryText`/`bg`: 6.1
- `primaryText`/`soft`: 5.3
- `onPrimary`/`primary`: 5.0

Oscuro:
- `text`/`bg`: 16.4
- `muted`/`bg`: 8.5
- `muted`/`card`: 7.8
- `muted`/`soft`: 6.9
- `primaryText`/`bg`: 10.3
- `primaryText`/`soft`: 8.3
- `onPrimary`/`primary`: 8.8

Todos ≥ 4.5:1. Si agregas un color, verifica que siga cumpliéndolo.

## Tipografía

- **Space Grotesk** (500/600/700): títulos, nombre de la app.
- **Inter** (400/500/600): texto, etiquetas, botones.
- En Expo: `@expo-google-fonts/space-grotesk` y `@expo-google-fonts/inter` (o `expo-font`).

| Rol | Fuente | Tamaño / peso |
|---|---|---|
| Logo "Curio" | Space Grotesk | 22 / 700, tracking −0.02em |
| Título de pantalla | Space Grotesk | 22 / 700 |
| Título de tarjeta con imagen | Space Grotesk | 20 / 600, interlineado 1.25 |
| Título de tarjeta de texto | Space Grotesk | 18 / 600, interlineado 1.3 |
| Cuerpo / resumen | Inter | 14 / 400, interlineado 1.45, color `muted` |
| Etiqueta de tema ("ARTE · GRABADO JAPONÉS") | Inter | 11 / 600, mayúsculas, tracking 0.08em, color `primaryText` |
| Encabezado de sección ("TEMAS") | Inter | 13 / 600, mayúsculas, tracking 0.06em, color `muted` |
| Metadatos (fuente, lectura) | Inter | 12 / 400, `muted` |
| Chip | Inter | 14 (600 si activo) |
| Botón principal | Inter | 16 / 600 |
| Tab bar | Inter | 11 (600 si activo) |

## Espaciado y forma

- Margen lateral de pantalla: 20 (feed: 16 para tarjetas, 20 para chips y texto).
- Separación entre tarjetas: 16. Entre secciones de Filtros: 22.
- Radios:
  - Tarjeta 20; grupo de switches 16; botón principal, input y control segmentado 14.
  - Ícono-botón 12; segmento interno 10.
  - Chips en forma de píldora (alto 36 → radio 18; chip de palabra 32 → 16).
- Objetivos táctiles mínimos: 44 × 44.
- Sombras: ninguna salvo el segmento seleccionado (sombra sutil de 1–2 px).

## Pantallas

Referencia visual:

- `docs/design/mockups/*.png` — capturas a 2× (390 × 844): `01-feed-claro`, `02-feed-oscuro`,
  `03-filtros-claro`, `04-filtros-oscuro`, `05-paleta`. Junto a cada una está su `.html` estático.
  En las capturas los títulos salen en Inter porque Space Grotesk no estaba instalada al
  generarlas; en la app van en Space Grotesk.
- `docs/design/source/*.dc.html` — fuentes del canvas original (formato propio del editor
  de diseño; solo como referencia).

En Filtros el contenido es más alto que la pantalla: va dentro de un `ScrollView` con el
botón "Aplicar filtros" fijo abajo.

### 1. Feed (`app/index.tsx`)

1. **Header** (padding 20/16/12/20):
   - Izquierda: logo (cuadro 32 × 32, radio 10, fondo `primary`, ícono de sol/lupa en `onPrimary`) + "Curio".
   - Derecha: botón de tema (luna, transparente) y botón de filtros (íconos de sliders, fondo `soft`, ícono `primaryText`). Ambos 44 × 44, radio 12.
2. **Chips de tema** (scroll horizontal): "Todo" activo por defecto (`primary` / `onPrimary`). Inactivos con borde `border` y fondo transparente. Alto 36, padding horizontal 16, separación 8.
3. **Línea de estado del filtro:** ícono de escudo con palomita (`primaryText`) + "Filtro anti-sensacionalismo: **estricto**" (13, `muted`, el nivel en `text` 600). Tocarla abre Filtros.
4. **Lista** (FlashList o FlatList con `onEndReached` → `getFeedPage` con `nextCursor`). Tres variantes de tarjeta:
   - **Con imagen** (obra del Met, imagen de Commons):
     - Imagen arriba de 168 de alto (`resizeMode: cover`); mientras carga, placeholder `soft` con ícono.
     - Etiqueta de tema, título 20, resumen, y una fila con fuente · licencia a la izquierda y los botones Guardar y Compartir (44 × 44) a la derecha.
   - **Texto** (artículo):
     - Etiqueta, título 18 y resumen.
     - Si el artículo tiene imagen, miniatura de 76 × 76 (radio 12) a la derecha del título.
     - Metadatos: "Wikipedia · CC BY-SA 4.0 · Lectura de 4 min". El idioma ("En inglés") solo
       aparece si el usuario lee en más de un idioma.
   - **Efeméride** (`type: 'event'`):
     - Fondo `soft` y sin borde.
     - Etiqueta "HOY EN LA HISTORIA · 17 NOV", título "1869: …" y resumen.
5. **Tarjeta de pausa** cada `prefs.pauseEvery` tarjetas (si no es `null`):
   - Fondo `soft`, texto tranquilo: "Llevas un buen rato leyendo. ¿Una pausa?"
   - Botones "Seguir" (secundario) y "Terminar por hoy" (primario).
   - Sin culpa ni gamificación.
6. **Scroll infinito, sin "fin del feed":** cuando se acaban las tarjetas del teléfono se piden
   más a las fuentes (con los mismos filtros de calidad; nunca contenido de menor calidad para
   rellenar). El pie muestra "Buscando más tarjetas…" con un indicador; si no hay red, "Sin
   conexión por ahora. Lo que ya tienes sigue aquí." con botón "Reintentar"; si las fuentes no
   tienen nada nuevo con esos filtros, "No encontramos más tarjetas…" con "Buscar de nuevo".
7. **Tab bar** (4 columnas, borde superior `border`, padding inferior para el área segura):
   - Inicio, Destacados, Guardados, Mis datos.
   - El activo va en `primaryText` 600; el resto en `muted`.
8. Tocar una tarjeta abre el **lector dentro de la app** (`app/leer/[id].tsx`). Nada abre el navegador.
9. Marcar como vistas (`markSeen`) las tarjetas que pasaron por pantalla (viewability ≥ 60 % durante ~1 s), en lotes.
10. *Pull to refresh* → `refresh()` del hook de ingesta (forzado).

### 2. Filtros (`app/filtros.tsx`)

1. **Header:** flecha atrás (44 × 44) + "Filtros".
2. **TEMAS:**
   - Chips multiselección: Ciencia, Tecnología, Arte, Cultura, Historia, Naturaleza, Espacio, Música.
   - Activos en `primary`. Al menos uno siempre activo (`sanitizePrefs` lo garantiza).
3. **IDIOMAS DEL CONTENIDO:** chips multiselección Español, English, Français, Português (al
   menos uno). Pista: "Solo verás tarjetas en estos idiomas. Las obras del Met y las imágenes
   de la NASA solo existen en inglés." La interfaz siempre está en español.
3. **NIVEL DE FILTRO:**
   - Control segmentado Suave / Moderado / Estricto sobre fondo `soft`; el seleccionado va en `card` con sombra sutil.
   - Debajo, una explicación (13, `muted`): "Oculta títulos con mayúsculas excesivas, signos de exclamación, preguntas gancho y listas tipo «10 cosas que…»."
4. **Grupo de switches** (tarjeta con borde, filas separadas por `border`). Cada fila tiene título 15/500 y una pista 12 `muted`:
   - Ocultar títulos sensacionalistas — "Análisis del tono del título" → `hideSensational`
   - Ocultar clickbait — "Preguntas gancho, «no creerás…»" → `hideClickbait`
   - Solo fuentes verificadas — "Museos, enciclopedias, revistas" → `onlyVerified`
   - Pausa sugerida — "Aviso cada 20 tarjetas" → `pauseEvery` (20 / `null`)
   - Switch de 48 × 28: encendido en `primary` con perilla `onPrimary`; apagado en `trackOff` con perilla blanca.
5. **PALABRAS BLOQUEADAS:**
   - Chips `soft` con botón × (28 × 28, `accessibilityLabel` "Quitar palabra").
   - Input "Añadir palabra o frase…" (alto 44, borde `border`).
6. **Botón fijo inferior** "Aplicar filtros" (alto 50, radio 14, `primary`) → `setPrefs`.

### Destacados (`app/(tabs)/destacados.tsx`)

- Título "Destacados" y una línea: "Artículos que la comunidad de Wikipedia revisó a fondo y
  marcó como destacados por su calidad."
- Solo artículos destacados de Wikipedia en los idiomas del usuario, de **todos** los temas
  (también aparecen mezclados en Inicio). Incluye los ya vistos: es una sección para volver.
- Misma tarjeta de texto (con miniatura) y mismo scroll infinito que Inicio.

### Lector (`app/leer/[id].tsx`)

- Barra: flecha atrás a la izquierda; Guardar y Compartir a la derecha (44 × 44).
- Imagen principal a lo ancho: 320 de alto con `contain` para obras e imágenes (se ve la obra
  completa sobre `soft`); 220 con `cover` para artículos.
- Etiqueta, título (Space Grotesk 26/32), metadatos y, si aplica, el resumen en Inter 500.
- Texto en Inter 16/26; subtítulos en Space Grotesk 19; citas con borde izquierdo `primary`;
  imágenes internas en proporción 3:2 con pie de foto en `muted`. Todo el texto es seleccionable.
- Mientras se descarga el artículo de Wikipedia: indicador y "Cargando el artículo…". Si falla,
  caja `soft` con "No se pudo cargar el texto completo…" y "Reintentar".
- **Atribución al final** (caja `soft`): fuente, licencia, fecha y la dirección del original como
  texto seleccionable (no es un enlace). En The Conversation se agrega "Publicado originalmente
  en The Conversation y reproducido sin cambios bajo licencia Creative Commons".

### 3. Guardados (pendiente de diseño fino)

- Misma tarjeta del feed, ordenada por `savedAt` desc (`listSaved`).
- Deslizar o mantener presionado para quitar.
- Estado vacío: "Aquí aparecerán las tarjetas que guardes."

### 4. Mis datos (pendiente de diseño fino)

Pantalla que materializa la filosofía de la app:

- **Encabezado:** "Tus datos viven en este teléfono. Puedes llevártelos cuando quieras."
- **Exportar mis datos** → `shareBackup` (abre la hoja nativa de compartir).
- **Importar respaldo** → elegir modo antes de abrir el archivo:
  - "Combinar con lo que tengo" (`merge`)
  - "Reemplazar todo" (`replace`, con confirmación)
- Tras importar, resumir el resultado: "Se agregaron 12 guardados · 2 ya estaban · 1 se descartó por venir incompleto".
- **Información:** número de tarjetas en el feed, guardados y última actualización (`lastIngestAt`).

### Tema claro / oscuro

- Por defecto sigue al sistema (`useColorScheme`). El botón de luna permite fijarlo.
- La elección se guarda en `AppPrefs.theme` (`system` | `light` | `dark`) y entra en el respaldo.

## Íconos

Trazos de 1.8 px, terminaciones redondeadas (estilo Lucide; `lucide-react-native` encaja).
Los usados en el diseño son: luna, sliders, escudo con palomita, imagen, marcador (guardar),
compartir (flecha arriba en caja), casa, lupa, persona, flecha izquierda y ×.
Nada de emoji en la interfaz.

## Copy

Español neutro, tono calmado. Sin signos de exclamación en la interfaz (coherente con el
filtro). Botones con verbos: "Aplicar filtros", "Exportar mis datos", "Seguir".
