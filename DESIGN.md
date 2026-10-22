# Flouvia Icons — reglas de diseño

Un set dibujado de verdad, no una variación de otra librería. Cada ícono se construye con el
motor (`engine/geometry.mjs`) sobre estas reglas; si una regla estorba a un dibujo, gana la
regla y se replantea el dibujo. Los 50 de `src/icons/nucleo.mjs` son la vara: todo lo nuevo
debe sentirse de la misma mano.

## Lienzo y trazo
- Lienzo de **24 × 24**. Área viva de 20 (2–22): el *path* nunca sale de 1.75–22.25 (la hoja
  de revisión lo avisa).
- **Trazo de 1.5**, centrado, `stroke-linecap` y `stroke-linejoin` **redondos**. Un solo tono:
  sin rellenos, sin opacidades, sin duotono, sin degradados. Todo es `path` con `stroke`.
- Coordenadas con dos decimales como máximo; prefiere medidas en cuartos (x.25, x.5, x.75).

## Keylines (que todos pesen igual)
| Forma base | Medida del path |
|---|---|
| Círculo | r 9 (centro 12, 12) |
| Cuadrado | 17.5 × 17.5 (3.25–20.75) |
| Apaisado | 19 × 14 (2.5–21.5 × 5–19) |
| Vertical | 14.5 × 18.5 (4.75–19.25 × 2.75–21.25) |
Una forma triangular o de pico puede tocar 2.4–21.6 para compensar ópticamente.

## Esquinas
- **Continuas**: `sq()` (squircle con suavizado 0.6), nunca un rectángulo con arcos circulares.
  Radio 4 en contenedores grandes (≥ 14 de lado), 3–3.5 en medianos, 2–2.25 en piezas de 7–8.
- Polígonos (triángulos, flechas gruesas, hexágonos): `roundpoly()` con radios 0.8–2.6.
- **La firma de Flouvia:** los contenedores (sobre, tarjeta, calendario, documento, carpeta,
  maletín, bandeja, candado, caja de proyecto, ventanas, pantallas de dispositivo) llevan la
  esquina **inferior derecha recta**: `sq(..., { square: ['br'] })`, como la gota del isotipo.
  Los globos de conversación son la gota misma: `drop()`. No se aplica a formas que no son
  contenedores (círculos, flechas, personas, objetos orgánicos).

## Detalle
- **Puntos**: `dot(x, y)` (r 0.7 → se ven de ~2.9). En grupos densos (días de un calendario),
  r 0.3. Todos los puntos de un ícono del mismo tamaño.
- **Separaciones**: dos trazos paralelos a no menos de 3 entre centros (1.5 de aire). Cuando
  una figura pasa detrás de otra, se corta dejando 1.5 de hueco (recorte), no se encima.
- **Flechas**: brazos de 6 a 45° en flechas rectas; de 3.4 en flechas de arco (`head()`, con
  la tangente de `arc()`).
- **Insignias** (más, menos, check, x, alerta sobre otro ícono): círculo de r 4–4.5 en la
  esquina inferior derecha, recortando 1.5 alrededor al objeto base.
- Pocas piezas: a 18 px tiene que leerse. Si necesita más de ~6 trazos, simplifica.
- Nada de texto ni letras dibujadas salvo que la letra sea el concepto (p. ej. `a-letter`).

## Nombres y tags
- Nombre en **kebab-case, en inglés**, objeto primero y variante después: `file-plus`,
  `arrow-up-right`, `bell-off`, `cloud-download`. Únicos en todo el set.
- `tags`: al menos tres palabras, en español y en inglés, para la búsqueda.

## Proceso
1. Dibuja en lotes de ~20 en `src/icons/<categoría>.mjs` con las funciones del motor.
2. `node scripts/build.mjs --check <categoría>` (nombres, tags, trazos).
3. `node scripts/sheet.mjs <categoría>` y **mira cada página** de `previews/`: peso,
   alineación con las keylines, legibilidad a 18 px, sobre oscuro y sobre claro.
4. Corrige y repite hasta que cada ícono se vea de la misma mano que el núcleo.
