# Producto — Curio v2: momentos de asombro

## El problema que resolvió esta versión

En la primera prueba con usuarios (amigos, sin contexto), la reacción fue: **"¿De noticias?"**.
El feed v1 tenía la anatomía de un lector de noticias: lista de tarjetas con título,
resumen, fuente y "Hoy en la historia". La gente lo reconocía en un segundo como Google News.

**Conclusión:** el concepto estaba bien; la *forma* no. Cambia la unidad de contenido:
de "artículo con título" a **"momento de asombro"**.

## Posicionamiento

> **Curio: un minuto de asombro. Arte, ciencia e historia, una cosa a la vez.**

- La primera pantalla muestra una imagen, no texto.
- En la primera impresión se evitan las palabras "feed", "artículos", "noticias" y "fuentes".
- Prueba de éxito: al ver la app 5 segundos sin explicación, alguien dice algo como
  *"es como TikTok pero de cosas curiosas"*.

## Mecánicas de enganche: qué se adopta y qué se cambia

| Mecánica (TikTok / Reels) | Qué hace | En Curio |
|---|---|---|
| Una cosa a la vez, pantalla completa | Cero decisiones | **Se adopta.** Swipe vertical entre momentos |
| Recompensa en menos de 2 s | Lo sensorial va antes que el texto | **Se adopta.** Imagen, sonido o dato primero |
| Recompensa variable | No sabes qué sigue | **Se adopta**, con variedad de formatos y un piso de calidad alto |
| Sin puntos de parada | Nunca hay final | **Se cambia:** capítulos de 10 momentos con cierre |
| Optimiza tiempo de visualización con señales implícitas | Compulsión | **Se cambia:** personalización por intención (guardar, "más de esto", temas), solo en el teléfono |
| Likes y vistas | Prueba social | **Se elimina.** Compartir con una persona concreta |
| Creadores con personalidad | Hay una voz | **Se adapta:** colecciones con voz curatorial ("Mar y viento", "Animales imposibles") |
| Identidad y progreso | Pertenencia | **Se adapta:** mapa de curiosidad y colecciones. Sin rachas que castigan |

No se busca igualar la retención de TikTok: parte de ella viene de quitar los puntos de
parada. La meta es **que la gente vuelva porque quiere**. Referencia: Wordle (finito,
diario y aun así un fenómeno).

## La regla de los ganchos: curiosidad sí, clickbait no

- **Clickbait:** abre una duda y la cierra en otro lado (o nunca).
- **Gancho de Curio:** abre una duda y la **cierra en el mismo momento, en segundos**.

Consecuencias técnicas:

- El scorer actual (`src/core/scorer.ts`) se sigue usando para todo título que viene de
  una fuente externa.
- Los ganchos que genera o cura Curio pasan por una variante (`scoreHook`, pendiente):
  - Se siguen castigando todas las señales de **sensacionalismo** y las **frases gancho** ("no creerás"…).
  - Se permiten la **pregunta** y el **inicio vago** solo si el momento trae `payoff` no vacío.
- Todo gancho debe ser verificable con las fuentes del propio momento. Si no se puede
  sostener, no se publica.

## Anatomía de un momento

1. **Visual** a pantalla casi completa: obra, animal, mapa, línea de tiempo o sonido.
2. **Gancho** de una línea (hasta ~90 caracteres).
3. **Payoff**: la respuesta o el dato que cierra la duda (una línea).
4. **Profundidad por niveles**, siempre opcional:
   - 5 s → el momento
   - 30 s → hoja expandida con contexto y ficha
   - 5 min → lectura
   - original → enlace a la fuente
5. **Acciones:** guardar, enviar a alguien, profundizar. Nada más.

## Formatos

| Formato | Ejemplo | Fuente de datos |
|---|---|---|
| `image-fact` | Obra o foto con un dato | Met, Commons |
| `detail-zoom` | "Busca el monte Fuji: está ahí, diminuto, entre las olas" + círculo sobre el detalle | Met + coordenadas curadas |
| `which-first` | "¿Qué existió primero? Oxford o Tenochtitlan" | Paquetes curados / fechas |
| `timeline` | "Cleopatra vivió más cerca del iPhone que de la Gran Pirámide" | Fechas (calculado) |
| `text-fact` | "Este animal puede secarse por completo y volver a la vida con agua" | Wikipedia |
| `sound` | Canto de un ave o un instrumento | Commons (audio) — pendiente |
| `event` | Efeméride del día, reescrita como momento | Wikipedia featured |
| `video` | Clip de 15 a 60 s: un eclipse, una erupción, una película de archivo. Con audio (un toque lo silencia), en bucle, póster mientras carga | NASA, Internet Archive, Commons |

**Formato `video` (2026-11-18).** `media.videoUrl`, `media.imageUrl` (póster), `media.durationSec`,
`media.mimeType`, licencia y autor (`credit`), y enlace al original en `sources`. Solo es momento
principal si dura de 15 a 60 s; lo más largo queda para Profundizar o paquetes curados. El
gancho y el payoff siguen la regla de los ganchos: el título de la fuente pasa por el scorer y
el payoff es su descripción (la duda se cierra en la misma pantalla). En Momentos hay un
selector **Posts | Videos**; en Destacados y Explorar los videos aparecen con su póster, como
mucho uno cada cuatro publicaciones.

**Filtros en Momentos (2026-11-19).** Imágenes y videos no dependen de los temas ni del nivel
de filtro del usuario (lo dejaban casi vacío): entran todos los temas, en sus idiomas más inglés.
Se mantienen siempre las palabras bloqueadas y un piso anti-clickbait (nivel suave): la regla de
los ganchos no cambia. Los momentos de texto sí siguen los filtros del usuario.

Regla de mezcla en un capítulo: no más de 2 momentos seguidos del mismo formato ni de la
misma fuente.

## Capítulos

- 10 momentos con título temático ("Mar y viento").
- Barra de progreso segmentada arriba.
- Al terminar aparece la pantalla de **Cierre**:
  - Lo que descubriste.
  - "¿Valió la pena?" (Sí / No mucho).
  - "Terminar por hoy" como botón primario y "Otro capítulo" como secundario.
- Hay un capítulo nuevo cada día. Se pueden pedir más: el infinito existe, pero siempre
  con puntos de parada.
- El historial de capítulos y las valoraciones son datos del usuario: **entran en el
  respaldo JSON** (sube `BACKUP_VERSION` o agrégalos como campos opcionales).

## De dónde salen los ganchos (sin servidor ni keys)

1. **Calculados a partir de datos**, honestos por construcción:
   - Edad del artista al crear la obra: `objectBeginDate − artistBeginDate`. Verifica que el Met traiga esos campos.
   - Comparaciones de fechas para `timeline` y `which-first`.
2. **Paquetes curados** (`curio-pack`): JSON estático en un repo público de GitHub, que
   la app descarga. No hay servidor y cualquiera puede auditarlos. Se validan como
   entrada no confiable, igual que el respaldo.
3. **Sección "¿Sabías que…?" de Wikipedia en español.** Falta comprobar cómo extraerla de
   forma estable.
4. *(Futuro, con cautela)* un modelo de lenguaje en el dispositivo para redactar ganchos,
   siempre verificados contra los datos del momento.

## Modelo de datos propuesto (aún no implementado)

```ts
type MomentFormat = 'image-fact' | 'detail-zoom' | 'which-first' | 'timeline' | 'text-fact' | 'sound' | 'event';
type HookOrigin = 'computed' | 'curated' | 'source';

interface Moment {
  id: string;
  format: MomentFormat;
  topic: Topic;
  hook: string;               // ≤ ~90 caracteres
  payoff: string;             // cierra la duda del gancho
  hookOrigin: HookOrigin;
  depth?: { short?: string; readUrl?: string };
  media?: {
    imageUrl?: string;
    audioUrl?: string;
    focus?: { x: number; y: number; r: number }; // 0..1 sobre la imagen, para detail-zoom
  };
  choices?: { label: string; detail: string; correct: boolean }[];   // which-first
  timeline?: { label: string; year: number; note?: string }[];      // timeline (años negativos = a. C.)
  sources: { sourceId: string; url: string; license?: string }[];   // al menos una
  cardId?: string;            // tarjeta de origen, si viene de la ingesta actual
  quality: QualityScore;
}

interface Chapter {
  id: string;
  title: string;
  momentIds: string[];        // 10
  createdAt: string;
  completedAt?: string;
  rating?: 'yes' | 'no';
}
```

Formato de paquete curado:

```json
{
  "format": "curio-pack",
  "version": 1,
  "id": "mar-y-viento",
  "title": "Mar y viento",
  "lang": "es",
  "moments": [ { "id": "…", "format": "detail-zoom", "hook": "…", "payoff": "…", "sources": [ … ] } ]
}
```

## Métricas sanas (locales, sin telemetría)

- **Capítulos terminados vs. abandonados.**
- **Vuelta voluntaria al día siguiente.**
- **Guardados y envíos por capítulo.**
- **"¿Valió la pena?"** al cierre.

No se mide el tiempo en la app como objetivo. En pruebas con amigos, pregunta en persona o
pídeles que exporten su respaldo.
