# Fuentes de contenido — Curio

Regla: **solo APIs públicas sin key** (ver filosofía en `AGENTS.md`).
✅ Verificados contra las APIs reales el 2026-11-17. Las respuestas grabadas (recortadas) están en
`test/fixtures/` y se prueban en `test/real-fixtures.test.ts`.

**Identificación obligatoria:** Wikimedia responde **403** al User-Agent por defecto de
Android (`okhttp/x`), tanto en la API como en las imágenes, y `Api-User-Agent` solo no basta.
Todas las peticiones mandan `CLIENT_HEADERS` (`src/ingest/http.ts`) y `<FeedCard>` los pasa
como `headers` de la imagen.

## En uso

### The Met Collection API — `met` (kind `museum`)

- Base: `https://collectionapi.metmuseum.org/public/collection/v1`
- Sin key; JSON. Datos e imágenes de dominio público bajo CC0 (Open Access, más de
  490 000 imágenes).
- Flujo (`src/ingest/met.ts`):
  1. `GET /public/collection/v1.1/search?isHighlight=true&hasImages=true&limit=500&q=<tema al azar>` →
     `{ total, objectIDs: number[] | null }`. **`/v1/search` se retiró el 2026-10-01 (responde 410).**
     La v1.1 pagina con `offset`/`limit` (100 por defecto, 500 como máximo). Con `isHighlight`,
     cada tema trae menos de 500 (landscape 296, astronomy 7), así que basta una página.
  2. Barajar, quitar los ya guardados y pedir `count × 3` candidatos.
  3. `GET /objects/{id}` (máximo 3 en paralelo) → solo entra si `isPublicDomain` y hay `primaryImageSmall`.
- Campos usados: `objectID`, `isPublicDomain`, `primaryImageSmall`, `primaryImage`,
  `title`, `artistDisplayName`, `objectDate`, `medium`, `objectURL`.
- Verificado: `q` con varias palabras funciona ("musical instruments" → 155). El Met pide no
  pasar de 80 peticiones por segundo. Casi todos los destacados son de dominio público con imagen.
- Los metadatos vienen en inglés (`lang: 'en'`).

### Wikipedia en español, feed "featured" — `wikipedia-es` y `wikimedia-commons` (kind `encyclopedia`)

- `GET https://es.wikipedia.org/api/rest_v1/feed/featured/{YYYY}/{MM}/{DD}` (mes y día con
  dos dígitos).
- Una llamada trae:
  - `image` → imagen del día de Commons (`topic: cultura`, `type: image`, licencia de la respuesta).
    La descripción llega **en español** y se usa como título. `artist` llega a veces como
    `{ html, text }` y a veces como texto plano.
  - `onthisday` → efemérides (`topic: historia`, `type: event`), unas 7 por día. Se quita
    "(en la imagen)" del título porque la tarjeta de efeméride no muestra foto.
  - `tfa` → **no viene en la Wikipedia en español** (revisado en 5 fechas). El normalizador lo
    sigue aceptando por si aparece; los artículos salen de la fuente siguiente.
- **Ignorados a propósito:** `mostread` (popularidad) y `news` (urgencia).
- Identificación: `User-Agent` + `Api-User-Agent` con contacto (`USER_AGENT` en `src/ingest/http.ts`).
- Licencia del texto: CC BY-SA 4.0 (atribuir y enlazar al original, que ya se hace).
- La ruta `rest_v1` sigue vigente (2026-11-17).

### Wikipedia en español, artículos destacados — `wikipedia-es` (job `wikipedia-es-destacados`)

Reemplaza al `tfa` que no existe en español: artículos que la comunidad revisó y marcó como
destacados (calidad, no popularidad).

- `GET https://es.wikipedia.org/w/api.php` con `action=query`, `generator=categorymembers`,
  `gcmtitle=Categoría:Wikipedia:Artículos destacados`, `gcmlimit=20`,
  `gcmstartsortkeyprefix=<inicial al azar>`, `prop=extracts|pageimages|info`, `exintro`,
  `explaintext`, `exsentences=3`, `piprop=thumbnail`, `pithumbsize=640`, `inprop=url`,
  `format=json`, `formatversion=2` (ver `featuredArticlesUrl`).
- Una sola llamada trae 20 artículos con resumen, miniatura y URL. La categoría está en orden
  alfabético y tiene más de 1 000 artículos: empezar en una inicial al azar da variedad sin
  descargar la lista completa.
- Entran 4 por ingesta e idioma (`articleCount`), sin repetir (`externalId` = `fa:<pageid>`).
- Los extractos traen espacios de ancho cero junto a las referencias; `cleanText` los quita.
- Tema inferido con `classifyTopic` (palabras clave); si no hay señal clara, `cultura`.
- Categoría por idioma (`FEATURED_ARTICLES_CATEGORY`): es `Categoría:Wikipedia:Artículos destacados`,
  en `Category:Featured articles`, fr `Catégorie:Article de qualité`, pt `Categoria:!Artigos destacados`.
- La Wikipedia en inglés sí trae `tfa` en el feed del día.

### Wikipedia, texto completo para el lector (`src/ingest/article.ts`)

- Al abrir una tarjeta cuya URL es de Wikipedia: `action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=<título>`.
- `wikiTextToBlocks` convierte "== Sección ==" en subtítulos y quita Referencias, Notas,
  Bibliografía, Enlaces externos y Véase también (en los 4 idiomas).

### The Conversation — `theconversation` (kind `magazine`, CC BY-ND 4.0)

- `GET https://theconversation.com/{sección}/articles.atom?page=N` (Atom, 25 artículos por página).
- **Trae el artículo completo** en `<content type="html">`: se convierte en bloques (`htmlToBlocks`)
  y se lee entero en la app. La licencia CC BY-ND permite republicar sin cambios y con
  atribución; el lector muestra autor, licencia y original.
- Se descarta el píxel de conteo (`counter.theconversation.com/.../count.gif`): no rastreamos al lector.
- Secciones verificadas el 2026-11-17: es `es/ciencia` ("Ciencia + Tecnología"), en `us/technology`
  ("Science + Tech"), fr `fr/technologie` ("Science") y `fr/environnement`. La edición de
  Brasil no tiene sección de ciencia (404).
- Paginado: "traer más" pide la página siguiente (`kv` `conversationPage:<lang>`); vuelve a la 1
  si una página no existe o viene vacía, o tras 40 páginas.
- Tema: `classifyTopic` separa Tecnología, Espacio y Naturaleza; si no, el de la sección.

### Wikidata SPARQL — `wikidata-arte` (kind `encyclopedia`)

- `GET https://query.wikidata.org/sparql?format=json&query=…` (ver `artQuery`): pinturas
  (`wdt:P31 wd:Q3305213`) con imagen (`P18`) y artículo en la Wikipedia del idioma, con título,
  autor y descripción en ese idioma. Es el arte en español (el Met solo publica en inglés).
- Contar resultados tarda más de un minuto (timeout); una página de 30 con `OFFSET` al azar
  tarda 2–5 s si el `OFFSET` es menor a ~2000 (4000 tarda ~20 s). Tiempo límite: 25 s.
- Imagen: `Special:FilePath/<archivo>?width=960` en https (Wikidata la da en http).
- Al abrirla, el lector carga el artículo de Wikipedia sobre la obra.

### NASA Image and Video Library — `nasa` (kind `journal`, dominio público)

- `GET https://images-api.nasa.gov/search?q=<tema>&media_type=image&page_size=40&page=1..3`. Sin key.
- Solo en inglés: entra al feed si el usuario eligió inglés. Imagen `~medium`.

### Fuentes agregadas el 2026-11-18 (`src/ingest/more-sources.ts`, fixtures reales en `test/fixtures/`)

| Fuente | id / kind | Idiomas | Licencia | Notas |
|---|---|---|---|---|
| **Agencia SINC** — `https://www.agenciasinc.es/feed/{Ciencia|Innova|Salud|Reportajes}` | `sinc` / magazine | es | **CC BY 4.0** (textos; citar a SINC y enlazar). Fotos: la licencia de su autor | RSS con el artículo completo en `content:encoded` → se lee en la app. Cada feed pesa ~3 MB (150 artículos): se pide **una sección por ingesta** y se toman los 40 más recientes. Restricción: no publicar obras hechas mayormente de contenido de SINC (Curio mezcla muchas fuentes) |
| **Cleveland Museum of Art** — `openaccess-api.clevelandart.org/api/artworks/?q=&has_image=1&cc0=1` | `cleveland` / museum | en | CC0 | Imagen `images.web`; textos de sala, `fun_fact` y descripción como cuerpo |
| **V&A** — `api.vam.ac.uk/v2/objects/search?q=&images_exist=1` | `vam` / museum | en | Imágenes para uso no comercial | Imagen IIIF `…/full/!800,800/0/default.jpg`. La búsqueda no trae descripción |
| **iNaturalist** — `api.inaturalist.org/v1/observations?quality_grade=research&photo_license=cc-by,cc0&iconic_taxa=&locale=` | `inaturalist` / encyclopedia | es, en, fr, pt (nombre común según `locale`) | CC BY 4.0 / CC0 por foto, con atribución a quien la tomó | Foto `…/large.jpg` (1024 px; `square` es de 75). Una observación por especie. Alimenta la pestaña **Naturaleza** |
| **NASA EPIC** — `epic.gsfc.nasa.gov/api/natural` | `nasa-epic` / journal | es, en | Dominio público | La Tierra completa del día. Título y resumen **calculados** (fecha, distancia del satélite, centro de la foto). Imagen `…/jpg/{image}.jpg` |
| **Europe PMC** — `ebi.ac.uk/europepmc/webservices/rest/search?resultType=core` | `europepmc` / journal | en | Solo CC (`cc by`, `cc0`, `cc by-sa`) | Artículos de investigación de acceso abierto, tipo `paper`; el resumen es el cuerpo. Título y resumen suelen estar en inglés aunque el artículo no lo esté |
| **Art Institute of Chicago** — `api.artic.edu` | `aic` / museum | en | CC0 | ⚠️ **Apagado.** La API responde (con la cabecera `AIC-User-Agent`), pero el servidor de imágenes IIIF da **403** a clientes que no son navegador. No se disfraza el User-Agent. El normalizador y el fetcher están probados, listos para activarse |

**Probadas y descartadas (2026-11-18):** Science Museum Group y Library of Congress (403 a
clientes que no son navegador), Openverse (504), Gutendex (sin respuesta). Siguen fuera por
pedir key: Smithsonian, Europeana, Harvard Art Museums y la API clásica del Rijksmuseum.

## Candidatas sin key (siguiente en agregar)

| Fuente | Por qué | Nota |
|---|---|---|
| **Art Institute of Chicago API** | Arte, filtro de dominio público, imágenes IIIF | Respondió 403 a un cliente genérico el 2026-11-17; revisar |
| **Cleveland Museum of Art Open Access** | Arte CC0 | Sin key |
| **arXiv API** | Ciencia (preprints) | Sin key; títulos técnicos, en inglés; pensar en un modo "avanzado" |
| **Europe PMC** | Biomedicina de acceso abierto | Sin key; técnico |

**Descartada a propósito:** Hacker News (`beststories`): ordena por votos, es decir, por
popularidad, y casi todo enlaza fuera. Choca con la filosofía.

Para agregar una fuente:
1. Normalizador en `src/core/normalizers/` que devuelva `RawCard | null`.
2. Registro en `src/core/sources.ts` con su `kind`.
3. Fetcher en `src/ingest/` con `FetchLike` inyectado.
4. Job en `runIngest` (con su `JobKind` y en qué idiomas corre).
5. Tests con fixture real.
6. Si trae el texto completo y la licencia lo permite, llénalo en `body` (bloques); si no, el
   lector mostrará resumen e imagen.

## Descartadas por ahora (piden key)

- **NASA APOD** (`api.nasa.gov`): `DEMO_KEY` tiene límites bajos; una key propia quedaría
  dentro del binario.
- **Smithsonian Open Access** (vía api.data.gov): requiere key.
- **Europeana**: requiere key.

Si en el futuro se decide usarlas, la opción coherente con la filosofía es un proxy mínimo
y sin estado (p. ej. una Azure Function) que solo agregue la key, sin guardar datos del usuario.
