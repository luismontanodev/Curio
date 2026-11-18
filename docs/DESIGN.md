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
| `trackOff` | `#D9CFEA` | Riel del switch apagado; segmentos pendientes de la barra de capítulo |
| `image` | `#E9E0FA` | Fondo mientras carga una imagen a pantalla completa (v2) |

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
| `trackOff` | `#463B60` | Switch apagado; segmentos pendientes de la barra de capítulo |
| `image` | `#2A2140` | Fondo mientras carga una imagen (v2) |

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

## Referencias visuales

- `docs/design/mockups/*.png` son capturas a 2× (390 × 844). Junto a cada una está su `.html` estático.
  - **v2 (vigente):** `v2-01-bienvenida`, `v2-02-momento-claro`, `v2-03-momento-oscuro`,
    `v2-04-profundizar`, `v2-05-microjuego`, `v2-06-linea-de-tiempo`, `v2-07-cierre-capitulo`.
  - **v1:** `01-feed-claro`, `02-feed-oscuro`, `03-filtros-claro`, `04-filtros-oscuro`, `05-paleta`.
  - En las capturas los títulos salen en Inter porque Space Grotesk no estaba instalada al
    generarlas; en la app van en Space Grotesk.
- `docs/design/source/*.dc.html` son las fuentes del canvas de diseño (formato propio del
  editor; solo como referencia).
- El concepto, las reglas y el modelo de datos de v2 están en `docs/PRODUCTO.md`. Léelo antes de esta sección.

## Navegación vigente (2026-11-17)

Cuatro pestañas al estilo Instagram (reemplaza "Bienvenida → Momento ⇅ … (10) → Cierre"):

| Pestaña | Qué es | Archivo |
|---|---|---|
| **Destacados** (inicio) | Artículos destacados de Wikipedia en los idiomas del usuario ("lo que sigues"). Encabezado con logo, tema y filtros | `app/(tabs)/index.tsx` |
| **Explorar** | Buscador ("Buscar temas, obras, personas…") + chips "Para ti" y temas + recomendaciones con su porqué. Al buscar: "En tu teléfono" y "Relacionado en Wikipedia" | `app/(tabs)/explorar.tsx` |
| **Momentos** | Los momentos a pantalla completa con swipe vertical, **infinitos**, sin barra de progreso ni ×. Píldora "Momentos" arriba a la izquierda. Cada N, página de pausa: "¿Una pausa?", "Terminar por hoy" (primario) y "Seguir" | `app/(tabs)/momentos.tsx` |
| **Mis datos** | Filas "Guardados (N)" y "Filtros", respaldo, tema e información | `app/(tabs)/perfil.tsx` |

Guardados (`app/guardados.tsx`), Filtros y el Lector se abren encima, con flecha atrás.

- **Barra inferior:** la pestaña activa lleva una píldora `soft` (56 × 30, radio 15) detrás
  del ícono, con trazo más grueso. **Tocar la pestaña activa** sube al inicio y actualiza
  (Destacados y Explorar actualizan; Explorar con búsqueda la borra; Momentos trae un lote nuevo).
- **Tarjeta compacta (menos texto a la vista):** imagen arriba (200 de alto) siempre que la
  haya; etiqueta solo con el tema; título en 2 líneas (con imagen) o 3 (sin imagen); resumen
  oculto con imagen y en 2 líneas sin ella; abajo, una sola línea "Fuente · licencia corta"
  ("The Met · Dominio público") y "Más" para ver el resumen completo y los detalles (licencia
  completa, idioma, tiempo de lectura). En Explorar, el porqué va en `primaryText` sobre la etiqueta.
- **Momento (inmersivo, estilo Reels):** la imagen ocupa toda la pantalla (completa, sobre su
  copia desenfocada) y el texto va encima, abajo a la izquierda, en blanco con sombra suave
  sobre un velo negro de abajo hacia arriba (55 % del alto, 0 → 0.78). Arriba del gancho, una
  píldora con el tema en sus colores. Gancho en 3 líneas; payoff en 2 (al tocarlo se ve
  completo). Acciones en columna a la derecha: Guardar, Enviar, Leer (íconos de 26 con su
  etiqueta). **Doble toque** sobre la imagen guarda (nunca quita) con un marcador grande que
  aparece y se desvanece (~650 ms). Sin imagen: fondo del color del tema y texto en `text`.
- **Destacados:** 2 líneas de resumen bajo el título (`teaserLines`), aunque haya imagen.
- **Temas como chips en Explorar:** todos (Ciencia, Tecnología, Arte, Cultura, Historia,
  Naturaleza, Espacio, Música), estén o no encendidos en Filtros.
- **Barra inferior:** fondo `card`, altura 64 + área segura (queda por encima de los botones
  de Android, nunca detrás).
- **Explorar en cuadrícula** de 2 columnas (margen 16, separación 12): mosaico con imagen
  (proporción 4:5, `cover`), etiqueta del tema en su color y título en 2 líneas; sin imagen,
  el mosaico es del color del tema con el título grande. Guardar y compartir quedan en el lector.
- **Imágenes:** se pide 960 px a Wikimedia (tamaño estándar; los no estándar se limitan) y,
  si falla, la original. Obras, imágenes del Momento y de la tarjeta se muestran **completas**
  (`contain`) sobre la misma imagen desenfocada, para no recortarlas ni deformarlas.

### Colores por tema

Dan identidad sin competir con el lila, que sigue marcando selección y acción. `fg` para
etiquetas y texto (≥ 4.79:1 sobre `card`, `bg` y su propio tinte); `bg` para fondos
(placeholder de imagen, efemérides, mosaicos sin foto). Tokens en `topicColors` (`src/ui/theme.ts`).

| Tema | Claro fg / bg | Oscuro fg / bg |
|---|---|---|
| Ciencia | `#0F766E` / `#E3F4F1` | `#5EEAD4` / `#12302D` |
| Tecnología | `#1D4ED8` / `#E6EDFC` | `#93C5FD` / `#172345` |
| Arte | `#B23A0B` / `#FDEBE1` | `#FDBA74` / `#3A2216` |
| Cultura | `#9A5B06` / `#FBF0D9` | `#FCD34D` / `#382C12` |
| Historia | `#8B5A34` / `#F4EAE1` | `#E2BC94` / `#33261C` |
| Naturaleza | `#166534` / `#E4F4E8` | `#86EFAC` / `#14301D` |
| Espacio | `#4338CA` / `#EAE9FB` | `#A5B4FC` / `#1F1C48` |
| Música | `#BE185D` / `#FCE7F0` | `#F9A8D4` / `#3A1228` |
Las secciones de abajo siguen valiendo para el **contenido** de cada pantalla (hoja del momento,
profundizar, microjuego, línea de tiempo); la Bienvenida y el Cierre de capítulo quedan como
referencia de diseño, sin implementar.

## Pantallas v2 — momentos (experiencia principal)

Navegación:

```
Bienvenida (solo la primera vez) → Momento ⇅ Momento ⇅ … (10) → Cierre de capítulo
                                      ↕ Profundizar (hoja)
```

### Bienvenida (`app/bienvenida.tsx`, solo en el primer arranque)

- La mitad superior (540) es una **imagen real del primer capítulo**, sin texto encima.
- Hoja inferior (radio superior 28, padding 28/24/34) con:
  - Logo + "Curio".
  - "Un minuto de asombro." (Space Grotesk 34/700, tracking −0.02em).
  - "Arte, ciencia e historia. Una cosa a la vez, y un final cuando terminas." (16, `muted`).
- Botón "Empezar" (alto 52, `primary`).
- Nota: "Sin cuentas. Lo que guardas se queda en tu teléfono." (12, `muted`).
- Sin registro, permisos ni carrusel de onboarding.

### Momento (`app/index.tsx`, pantalla principal)

- **Swipe vertical** a pantalla completa, un momento por página (`FlatList` con `pagingEnabled`
  o un pager vertical). Precarga la imagen del siguiente.
- **Visual:** ocupa la pantalla detrás de todo (600 de alto en el mockup; en la app, todo el
  alto por encima de la hoja). Usa `resizeMode: cover`; con `focus`, aplica un encuadre o zoom inicial.
  Mientras carga, se muestra el color `image`.
- **Superposición superior** (padding 14/16):
  - Barra de progreso de 10 segmentos (alto 4, separación 4, radio 2): completados en
    `primary`, pendientes en `trackOff`.
  - Debajo, una píldora con "Capítulo 1 · Mar y viento" (fondo `card`, 13/600) y un botón
    cerrar circular de 44 (fondo `card`) que lleva al Cierre.
- **`detail-zoom`:** un anillo de 72 px con borde de 2 en `primary` sobre el detalle, más la
  etiqueta "Aquí está" (píldora `primary`). Aparece al tocar la imagen o tras ~2 s, para que la
  persona tenga oportunidad de buscarlo antes.
- **Hoja inferior** (alto ~300, radio superior 28, fondo `card`, padding 10/20/22):
  - Asa de 36 × 4.
  - Etiqueta: "ARTE · LA GRAN OLA DE KANAGAWA".
  - **Gancho** en Space Grotesk 24/600, interlineado 1.22.
  - **Payoff** en 15, `muted`.
  - Acciones abajo: Guardar y Enviar a alguien (íconos de 44) y, a la derecha, la píldora
    "Profundizar" (fondo `soft`, texto `primaryText`, chevron arriba).
  - Pista: "Desliza hacia arriba para el siguiente momento" (12, `muted`). Ocúltala después
    de los primeros momentos.
- Sin contadores, sin autor famoso destacado, sin "tendencia".

### Profundizar (hoja expandida, mismo `app/index.tsx`)

- La hoja sube a ~640 de alto; el visual queda reducido arriba.
- Chevron abajo (44) para volver.
- Contenido:
  - "EN 30 SEGUNDOS" (etiqueta).
  - Título (Space Grotesk 22/600).
  - Párrafo de contexto (15, interlineado 1.55, color `text`).
  - Ficha en una cuadrícula de 2 columnas sobre `soft` (radio 16, padding 14): Autor, Fecha, Técnica, Licencia.
- Abajo:
  - Botón secundario "Leer más · 5 min" (borde `border`, alto 50) que abre el **lector dentro
    de la app** (`app/leer/[id].tsx`).
  - Atribución "Original en The Met" (`muted`), sin ↗: la dirección del original se muestra
    en el lector como texto seleccionable y se puede compartir, pero **nada abre el navegador**
    (regla vigente desde v1; ver Lector).

### Microjuego `which-first`

- Pregunta en Space Grotesk 28/700: "¿Qué existió primero?".
- Dos opciones de 172 de alto (radio 20). Al elegir:
  - La correcta queda con borde 2 `primary`, fondo `soft` y la píldora "✓ Primero".
  - La otra conserva su estilo normal.
  - Cada opción muestra su dato ("Ya se enseñaba ahí hacia 1096" / "Fundada en 1325").
- Debajo, el payoff en un bloque `soft` (radio 16, padding 16).
- Sin puntos, sin "¡Correcto!" ni sonidos de premio: el premio es el dato.

### Línea de tiempo `timeline`

- Gancho grande (Space Grotesk 30/700).
- Línea horizontal con puntos en posición **proporcional al año** (calcúlalo; no lo maquetes a mano).
- Corchetes con la duración entre eventos: el que sostiene el gancho va en `primary` y
  `primaryText`; el otro en `muted`.
- Etiquetas debajo de cada punto: nombre (14/600) y fecha (12, `muted`).
- Payoff en un bloque `soft`.
- Accesibilidad: `accessibilityLabel` con la línea completa en texto.

### Cierre de capítulo (`app/cierre.tsx`)

- Ícono ✓ en un cuadro `soft` (48, radio 16), "Capítulo terminado" (Space Grotesk 30/700) y
  "Mar y viento · 10 momentos · unos 6 minutos" (`muted`).
- **HOY DESCUBRISTE:** una lista con borde (radio 16) de los momentos, cada uno con miniatura
  de 40 y una línea. Muestra 4 y luego "y 6 más · 2 guardados".
- **¿Valió la pena?** Dos botones iguales: "Sí" / "No mucho". La valoración se guarda en local.
- Abajo:
  - **"Terminar por hoy"** es el botón primario: la app recomienda parar.
  - "Otro capítulo" es el secundario.
  - Nota: "Mañana habrá un capítulo nuevo."

### Lo que pasa a segundo plano desde v1

- La **lista de tarjetas** (Feed v1) ya no es la pantalla principal. Se reutiliza para
  **Guardados**, **Destacados** y, si vuelve, un **Explorar** por tema (se quitó en v1 porque
  buscar solo entre lo local se encimaba con Guardados).
- Hoy (antes de implementar v2) la lista sigue siendo Inicio, con scroll infinito y la
  tarjeta de pausa como punto de parada; el cierre de capítulo la reemplaza en v2.
- **Filtros** y **Mis datos** siguen igual. Accede a ellos desde un menú de perfil, no desde
  la pantalla del momento.

## Pantallas v1 — lista (referencia; ver arriba qué se reutiliza)

En Filtros el contenido es más alto que la pantalla: va dentro de un `ScrollView` con el
botón "Aplicar filtros" fijo abajo.

### 1. Feed en lista (v1; hoy es Inicio y la base de Guardados y Destacados)

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
