# Formato de un ícono

> **Fuente de verdad:** `src/icons/<categoría>.mjs` (dibujo y datos de diseño) y `src/i18n/<categoría>.json` (idiomas). La validación vive en `scripts/load.mjs`; cómo se dibuja cada campo, en [`DESIGN.md`](../DESIGN.md).

[← Índice](./README.md)

## Archivo de categoría
```js
import { arc, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

const icons = {
  bell: {
    tags: ['campana', 'avisos', 'notifications'],          // búsqueda básica (es + en), ≥ 2
    d: [body, clapper],                                     // trazos en ORDEN DE DIBUJO
    fill: { solid: [body, clapper] },                       // o false si es solo líneas
    parts: { body: [0], clapper: [1] },                     // piezas con nombre → data-part
    motion: { effect: 'ring', origin: [12, 3.25] },         // gesto propio
  },
};
export default { category: 'comunicacion', label: 'Comunicación y personas', icons };
```
Los trazos se calculan con el motor (constantes y funciones locales permitidas). `nucleo.mjs` es la referencia: define `icons`, y al final asigna `fill`, `parts`, `motion`, `mirror`, `levels` y `variants` por bloques.

## Campos
| Campo | Tipo | Obligatorio | Qué es |
|---|---|---|---|
| `tags` | `string[]` (≥ 2) | sí | Palabras de búsqueda básicas, español e inglés |
| `d` | `string[]` | sí | Trazos (`d` de cada `path`), en orden de dibujo, lienzo de 24 |
| `fill` | `{ solid, cut?, lines? }` o `false` | ronda 2 en adelante | Versión rellena con los mismos trazos; `false` = solo líneas |
| `small` | `{ d, fill? }` | solo si hace falta | Dibujo propio para ≤ 18 px |
| `variants` | `{ circle?, square?, slash?: false }` | no | Apaga variantes automáticas que no tienen sentido |
| `mirror` | `true` | direccionales | Se voltea en idiomas de derecha a izquierda |
| `levels` | `number[][]` (≥ 2) | íconos de cantidad | Índices de `d` por nivel, de menos a más |
| `parts` | `{ nombre: number[] }` | con `motion`, `levels` o insignia | Piezas con nombre (kebab-case en inglés) |
| `motion` | `{ effect, parts?, origin?, vector? }` | si tiene gesto propio | `effect` ∈ `ring`, `wiggle`, `spin`, `beat`, `slide`, `float`, `bounce`; `parts` por nombre o índice |

## Idiomas (`src/i18n/<categoría>.json`)
```json
{ "bell": { "label": { "es": "Campana", "en": "Bell", "pt": "…", "fr": "…", "de": "…", "it": "…", "ja": "…", "zh": "…", "ko": "…", "ar": "…" },
            "keywords": { "es": ["≥ 6 sinónimos y usos"], "en": ["≥ 6"] } } }
```
Idiomas: `es`, `en`, `pt`, `fr`, `de`, `it`, `ja`, `zh`, `ko`, `ar` (`LANGS` en `scripts/load.mjs`). Cada ícono de la categoría debe tener su entrada y no puede haber entradas huérfanas.

## Validación (`scripts/load.mjs`)
- Nombres en kebab-case, únicos en todo el set (se reporta el choque a las dos categorías).
- Trazos que empiezan en `M` y solo usan comandos SVG de path.
- `fill.solid`/`cut`/`lines`, `small.d`: listas de trazos válidos.
- `levels` y `parts`: índices válidos de `d`; `motion.parts`: nombres de `parts` o índices.
- `motion.effect` dentro de `MOTION`; `origin`/`vector` son `[x, y]`.
- `variants`: solo `circle`/`square`/`slash` en `false`.
- Idiomas: los 10 `label` y ≥ 6 `keywords` en es y en.
Un archivo de categoría que no carga se reporta sin tumbar a los demás (útil con agentes en paralelo).
