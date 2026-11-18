# CLAUDE.md — Curio

Contexto completo del proyecto (filosofía, stack, arquitectura, estado y siguientes pasos):

@AGENTS.md

## Antes de tocar algo

- **Producto y diseño:** lee `docs/PRODUCTO.md` y la sección "Pantallas v2" de
  `docs/DESIGN.md`, y mira las capturas `docs/design/mockups/v2-*.png` antes de implementar
  cualquier pantalla. La lista de tarjetas (v1) ya **no** es la pantalla principal en el
  diseño, aunque hoy sigue siendo lo implementado en Inicio.
- **APIs:** `docs/APIS.md`. Todas se verificaron contra las APIs reales (2026-11-17) y tienen
  fixtures en `test/fixtures/`. Si una cambia, regraba su fixture.

## Cómo trabajar en este repo

- La lógica va en `src/core`, `src/db`, `src/ingest` y `src/backup`: TypeScript puro y probado
  con `node:test` + `node:sqlite`. No importes `expo-*` ni `react-native` ahí.
- Lo que depende de Expo va solo en `src/platform/` y `app/`.
- Después de cada cambio de lógica, ejecuta:
  ```sh
  npm test && npm run typecheck
  ```
- Para un cambio de esquema, agrega una migración nueva; nunca edites una publicada.
- Si un dato nuevo pertenece al usuario (guardados, valoraciones, historial,
  preferencias), debe entrar al respaldo JSON. Agrega el test de ida y vuelta.
- Si cambias reglas del scorer, sube `SCORER_VERSION` y agrega casos de prueba.
- Textos de la interfaz en español neutro, sin signos de exclamación. Identificadores en inglés.
- Todo se lee dentro de la app: nunca abras el navegador (`expo-web-browser`, `Linking`). El
  original se muestra como atribución en el lector (`app/leer/[id].tsx`).
- Pregunta antes de:
  - Agregar una dependencia a la lógica pura.
  - Agregar una fuente que pida API key.
  - Agregar cualquier mecánica de enganche que no esté en `docs/PRODUCTO.md` (rachas,
    notificaciones, contadores, autoplay infinito sin cierre).

## Primera tarea sugerida

El proyecto Expo ya está integrado (los tests de Node usan `tsconfig.test.json`). Sigue con
los pasos 1–2 de "Siguientes pasos" en `AGENTS.md` (probar en un dispositivo) y después el
paso 3 (modelo v2 en `src/core`).
