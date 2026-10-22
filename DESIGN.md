# Gota — reglas de diseño

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
- **Insignias** (más, menos, check, x, alerta, info, reloj, flechas, estrella, candado, punto de
  aviso): **siempre las del motor**, `badge: badge('plus')`, en el campo `badge` (no en `d`). El
  motor despeja la base con un aire exacto de 1.5 y quita enteros los puntos que toca. **Nunca se
  recorta la base a mano**: los cortes a mano dejan puntas redondas en lugares arbitrarios y
  fragmentos. Una pieza propia encima de otra (el puntero sobre un cuadro) va igual:
  `badge: { d, knock, fill }`. A 16 px las insignias estándar cambian solas a su versión de pixel
  (sin anillo, el signo más grande): no se copian `badge16` en las categorías.
- **Puntero:** siempre `cursor(punta, escala)` del motor; nunca uno dibujado a mano.
- **Sin fragmentos ni roces:** ningún trazo abierto de menos de 2; un trazo que termina junto a
  otro o lo toca o deja 1.5 de aire (3 de centro a centro). El QA los marca (`suelto`, `roza`).
- Pocas piezas: a 18 px tiene que leerse. Si necesita más de ~6 trazos, simplifica.
- Nada de texto ni letras dibujadas salvo que la letra sea el concepto (p. ej. `a-letter`).

## Relleno
Cada ícono que tiene un cuerpo lleva su versión rellena en `fill`, hecha con **sus mismos trazos**
(nunca se redibuja la silueta: el relleno y el contorno deben coincidir al pixel):
- `solid`: las figuras que se rellenan (también conservan su trazo, así la silueta es idéntica).
- `cut`: los detalles que quedan dentro del relleno y se **calan** al ancho del trazo (renglones de
  un documento, la solapa del sobre, las manecillas del reloj, el signo de una insignia).
- `lines`: trazos abiertos que siguen siendo línea y se separan del relleno con **aire de 1.5**
  (las argollas del calendario, el asa del maletín, la persona de atrás en un grupo).
- `wire`: trazos abiertos que siguen siendo línea **pegados** al relleno, sin aire (el arco del
  candado, la aguja de la chincheta, la línea de una ruta, las barras de unos deslizadores).
- En `solid` **solo van figuras cerradas** (terminan en `Z`): un trazo abierto se rellenaría como
  una cuña. Si lo que se rellena es un trazo abierto del contorno (la media luna de un badajo, el
  cuerpo de un cilindro), se pasa cerrado: `${trazo}Z`. El QA lo marca como `abierto`.
- Insignias sobre un objeto (más, check, x, reloj en la esquina): el círculo de la insignia va en
  `solid` y su signo en `cut`.
- Los íconos hechos solo de líneas abiertas (flechas, chevrons, check, más, x, ondas) llevan
  **`fill: false`**: su versión rellena es el mismo contorno.
- Ejemplos completos: el bloque `FILL` al final de `src/icons/nucleo.mjs`.

## Variantes automáticas
El build saca de cada ícono, sin redibujarlo: los grosores **ligero (1)**, **regular (1.5)** y
**negrita (2)**; las versiones **en círculo** (r 9, el dibujo al 58 %), **en cuadrado** (con la
esquina de la gota, al 60 %) y **tachada** (con aire de 1.5 a cada lado del tache); y sus
combinaciones con el relleno. Se apagan con `variants: { circle: false, square: false, slash: false }`:
- `circle`/`square: false` cuando el ícono ya viene encerrado (`*-circle`, `*-square`, un reloj,
  un globo) o cuando reducido al 58 % deja de leerse.
- `slash: false` en líneas sueltas (flechas, chevrons, check, x, más, puntos) y cuando ya existe
  una versión `-off` dibujada a mano.
Revísalas con `node scripts/variants-sheet.mjs <categoría>`.

## 16 px
A 16 px el trazo de 1.5 mide 1 px y el build **ajusta al pixel** cada dibujo (los tramos rectos
caen en el centro del pixel). Si aun así un ícono no se lee (demasiado detalle, piezas que se
juntan), lleva su propio dibujo simplificado en `small: { d, fill }`, con las mismas reglas y
**menos piezas**: quita los detalles secundarios, junta lo que se empasta y deja aire de 1.5
(1 px) como mínimo. Revisa la columna «16 px (1x)» de la hoja de variantes: es lo que ve una
pantalla normal, pixel por pixel.

## Espejo (derecha a izquierda)
`mirror: true` en lo que tiene dirección de lectura: flechas y chevrons laterales, avanzar o
retroceder, responder, enviar, deshacer o rehacer, listas con sangría, bocinas, lápices, gráficas
que crecen. **No** se voltean: relojes y lo que gira en el sentido del reloj, check, signos y
números, logotipos, objetos simétricos ni los que representan algo físico con un lado fijo.

## Niveles
Los íconos que expresan una cantidad (wifi, señal, batería, volumen, intensidad) marcan sus
niveles: `levels: [[índices de d del primero], [del segundo], …]`, de menos a más. Con un valor de
0 a 1 se encienden los niveles que alcanza (wifi a la mitad = la mitad de sus arcos).

## Movimiento
Todos los íconos pueden **dibujarse**, **rebotar** y **reemplazarse** por otro sin datos extra.
Los que tienen un gesto propio lo declaran en `motion`:
| `effect` | Qué hace | Ejemplos | Datos |
|---|---|---|---|
| `ring` | oscila desde un pivote, como algo que suena | campana, teléfono | `origin` (el cuelgue) |
| `wiggle` | se balancea un poco | alerta, llave, lápiz | `origin` |
| `spin` | gira | actualizar, cargando, engrane, manecillas | `origin`, `parts` |
| `beat` | late (crece y vuelve) | corazón, rayo | `origin` |
| `slide` | se desplaza en su dirección | flechas, enviar, salir | `vector` |
| `float` | flota | nube, globo | `vector` |
| `bounce` | salta hacia un lado | pin, descarga | `vector` |
`parts` son las piezas que se mueven, por nombre o por índice de `d` (si no, todo el ícono); `origin` es el pivote en el
lienzo de 24; `vector` el desplazamiento. El orden de `d` es el **orden de dibujo** (de lo
principal a los detalles): así se anima al dibujarse. La hoja muestra el cuadro extremo del
movimiento para revisar piezas y pivote.

## Piezas con nombre
Lo que se anima, cambia de estado o es una insignia lleva nombre en `parts: { nombre: [índices
de d] }`, en kebab-case en inglés y del vocabulario común del set: `body`, `badge`, `mark` (el
signo de una insignia o alerta), `clapper`, `hands`, `needle`, `lid`, `handle`, `shackle`,
`screen`, `wave`, `arrow`, `level`… Es obligatorio en todo ícono con `motion`, `levels` o
insignia; en los demás, cuando haya piezas con sentido propio. En el SVG generado cada trazo
lleva su `data-part` (y `data-level` si es un nivel), y el `<svg>` de los direccionales lleva
`data-rtl="mirror"`. Nunca `id`: chocan cuando hay varios íconos en una página.

## Idiomas y búsqueda
Cada categoría tiene `src/i18n/<categoría>.json`:
`{ "nombre": { "label": { "es", "en", "pt", "fr", "de", "it", "ja", "zh", "ko", "ar" },
"keywords": { "es": [≥6], "en": [≥6] } } }`.
- `label`: la etiqueta de accesibilidad, breve y natural en cada idioma («Campana», «Bell»…),
  con mayúscula inicial donde el idioma la use.
- `keywords`: sinónimos y **usos** para buscar por significado: lo que el ícono es y para qué se
  usa («cobrar» encuentra cartera, factura y terminal). Sin repetir el nombre ni rellenar.

## Nombres y tags
- Nombre en **kebab-case, en inglés**, objeto primero y variante después: `file-plus`,
  `arrow-up-right`, `bell-off`, `cloud-download`. Únicos en todo el set.
- `tags`: al menos tres palabras, en español y en inglés, para la búsqueda.

## Proceso
1. Dibuja en lotes de ~20 en `src/icons/<categoría>.mjs` con las funciones del motor.
2. `node scripts/build.mjs --check <categoría>` (nombres, tags, trazos).
3. `node scripts/sheet.mjs <categoría>` y **mira cada página** de `previews/`: peso,
   alineación con las keylines, legibilidad a 18 px, sobre oscuro y sobre claro.
4. `node scripts/variants-sheet.mjs <categoría>`: relleno, grosores, círculo, cuadrado, tachado,
   16 px reales, espejo, niveles y movimiento.
5. `node scripts/qa.mjs <categoría>`: fuera del área, demasiado denso, relleno que cambia la
   silueta y casi duplicados contra todo el set.
6. Corrige y repite hasta que cada ícono se vea de la misma mano que el núcleo.
