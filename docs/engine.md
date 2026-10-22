# Motor

> **Fuente de verdad:** `engine/geometry.mjs` y `engine/variants.mjs`. Pruebas en `tests/engine.test.mjs`.

[← Índice](./README.md)

## Geometría (`engine/geometry.mjs`)
Todo trabaja en el lienzo de 24 y devuelve el `d` de un path con dos decimales como máximo (`f`).
| Función | Qué dibuja |
|---|---|
| `sq(x, y, w, h, r, { square, smoothing })` | Rectángulo de **esquinas continuas** (algoritmo de suavizado de esquinas de Figma, suavizado 0.6). `square: ['br']` = la firma. El radio no pasa de min(w, h) / 3.2 |
| `circ(cx, cy, r)` · `dot(x, y, r = 0.7)` | Círculo; punto que con el trazo de 1.5 se ve sólido |
| `drop(cx, cy, r)` | La gota del isotipo: círculo con la esquina inferior derecha recta |
| `arc(cx, cy, r, a0, a1)` | Arco en grados (horario si a1 > a0); devuelve `{ d, end, tangent }` |
| `head(tip, dir, len = 6, spread = 45)` | Punta de flecha (6 en rectas, 3.4 en arcos) |
| `roundpoly(pts, radius)` | Polígono con esquinas redondeadas (radio por esquina o uno solo) |
| `polar`, `line`, `rot` | Punto en un círculo, línea por puntos, giro de un punto |

## Variantes (`engine/variants.mjs`)
`render(icon, opciones)` devuelve el contenido de un `<svg viewBox="0 0 24 24">`; `svgFile(inner, icon)` lo envuelve (y agrega `data-rtl="mirror"` si el ícono es direccional).
| Opción | Efecto |
|---|---|
| `style: 'outline' \| 'fill'` | El relleno usa una máscara: `solid` relleno y con trazo (misma silueta), `cut` calado al ancho del trazo, `lines` encima con aire de 1.5 (halo de trazo + 3) |
| `weight` | Grosor **continuo** (los nombrados: `WEIGHTS` = light 1, regular 1.5, bold 2) |
| `enclosure: 'circle' \| 'square'` | Encierro: círculo r 9 con el dibujo al 58 %, o cuadrado con la firma al 60 %. Con `fill`, el contenedor va sólido y el dibujo calado |
| `slash` | Tache de (3.6, 3.6) a (20.4, 20.4) con aire de 1.5 a cada lado (máscara de trazo + 3) |
| `size` | ≤ 18: usa `small` si existe; si no, **ajuste al pixel** (`snap`) |
| `rtl` | Voltea (`matrix(-1 0 0 1 24 0)`) solo si `icon.mirror` |
| `value` (0–1) | Con `levels`, oculta los niveles que no alcanza |
| `frame` | Dibuja el cuadro extremo del `motion` (hojas de revisión) |
| `id` | Prefijo de las máscaras; único por SVG en la página |
Cada trazo sale con `data-part` (de `parts`) y `data-level` (de `levels`, desde 1). Nunca `id` en los trazos.

### Ajuste al pixel (`snap`)
A 16 px el trazo de 1.5 mide 1 px y los centros de pixel caen en 0.75 + 1.5k del lienzo de 24. `snap` pasa el path a absoluto (`transform` sin escala), detecta los tramos rectos horizontales y verticales (tolerancia 0.06) y los mueve al centro de pixel más cercano; cada punto se mueve con su extremo y los controles de una curva con el extremo al que tocan, así las esquinas continuas acompañan.

### `transform(d, s, tx, ty)`
Parser propio de paths (M L H V C S Q T A Z, absolutos y relativos, L implícitos tras M) que devuelve el path en absoluto, escalado y movido; los arcos escalan su radio. Lo usan los encierros y `snap`.

### Movimiento
`motionTransform(motion)` da la transformación del cuadro extremo: `ring` 18°, `wiggle` 10°, `spin` 90° sobre `origin`; `beat` escala 1.18; `slide`/`float`/`bounce` se desplazan `vector`. La animación real (fase 2) leerá los mismos datos.
