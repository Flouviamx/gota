# Calidad

> **Fuente de verdad:** `scripts/qa.mjs`, `scripts/sheet.mjs`, `scripts/variants-sheet.mjs`, `tests/engine.test.mjs`.

[← Índice](./README.md)

## Hojas de revisión (se miran, no se suponen)
- **`sheet.mjs`** — 40 íconos por página: cada uno a 96 px con keylines (círculo r 9, cuadrado 17.5, apaisado 19 × 14, vertical 14.5 × 18.5 y el área de 20), a 24 y 18 px, en pastilla oscura de 36 px y sobre fondo claro. Avisa lo que sale de 1.75–22.25.
- **`variants-sheet.mjs`** — 30 por página: contorno, relleno, ligero, negrita, círculo, cuadrado, tachado y relleno en círculo (a 32 y 18 px); **16 px reales** (rasterizados a 1x en un canvas y ampliados sin suavizar, como en una pantalla normal); y, si los tiene, espejo, niveles a la mitad y el cuadro extremo de su movimiento. Marca en naranja lo que falta (`sin relleno`, `sin idiomas`) y en azul el efecto o el `16 propio`.

## QA automático (`qa.mjs`)
Renderiza todo el set en Chrome y avisa:
| Aviso | Regla |
|---|---|
| `área` | Algún trazo sale de 1.75–22.25 (medido con `getBBox`) |
| `denso` | Más de 28 % de tinta a 32 px: probablemente sobran piezas. Umbral fijo (antes era el percentil 98 del set y se movía al crecer el set) |
| `silueta` | El relleno cambia la caja del dibujo más de 1 px a 32 px |
| `doble` | Dos íconos casi iguales a 32 px (similitud de coseno ≥ 0.975), salvo los de una misma familia (mismo primer segmento del nombre o uno prefijo del otro) |
| `suelto` | Un trazo abierto de menos de 2 de largo que no es un punto: un fragmento |
| `roza` | Un trazo termina a entre 0.35 y 2.85 de otro (de centro a centro) sin tocarlo: o toca, o deja 1.5 de aire. No cuenta si esos dos trazos se cruzan o se tocan en otro punto |
Las líneas sueltas son ligeras por naturaleza: no hay aviso de "muy ligero". Los umbrales se ajustaron sobre el núcleo y la ronda 1 (al principio 0.93 de similitud y aviso de ligeros: demasiado ruido).

## Pruebas del motor (`npm test`)
Quince pruebas: redondeo; esquinas continuas y la firma; cierre de `drop`, `circ` y `roundpoly`; largo de las puntas; `transform` (escala, arcos, absolutos); `snap` a centros de pixel; un solo tono y trazo redondo; `data-part`/`data-level` y nunca `id`; niveles con `value`; espejo solo en direccionales y `data-rtl`; máscara del relleno y aire de las líneas; grosor continuo; `snap` sin deformar círculos; insignias (máscara, aire, punto que sale entero, relleno calado); `cursor` cerrado y dentro del lienzo.

## Compuertas
- Ningún agente termina con `build.mjs --check` en error.
- Cada ronda cierra con `qa.mjs` completo y la muestra al dueño.
- **Publicar** exige cero avisos de QA, pruebas en verde y la revisión del dueño de la hoja completa.
