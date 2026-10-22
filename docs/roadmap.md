# Roadmap

> Estado al 21 oct 2026. Al avanzar una subfase, se marca aquí y se anota en [Historia](./history.md).

[← Índice](./README.md)

**Meta de la v1: 10,000 íconos. Nada se publica antes.** Cada ronda de ~1,000 lleva unas 3 horas de agentes.

## Fase 0 · Cimientos ✅
- [x] Motor de geometría: esquinas continuas, keylines, la gota (`engine/geometry.mjs`).
- [x] Reglas de dibujo (`DESIGN.md`), build, hojas de revisión.
- [x] Núcleo de 50 íconos (`src/icons/nucleo.mjs`), la vara del set.

## Fase 1 · Primeros ~1,000 completos (en curso)
- [ ] 1.1 Dibujo base y crítica por categoría — ronda 1: ~1,000 dibujados, críticos terminando.
- [x] 1.2 Formato extendido: relleno, 16 px (`small` y ajuste al pixel), espejo, niveles, piezas con nombre, movimiento, 10 idiomas, metadatos `data-*`, hoja de variantes, QA automático y pruebas del motor.
- [ ] 1.3 Auditoría de cobertura y dibujo de lo que falte (1 agente).
- [ ] 1.4 Diseño por ícono: relleno, 16 px, variantes, espejo, niveles, piezas (`level`/`progress` en los de cantidad) y movimiento (10 agentes).
- [ ] 1.5 Idiomas: etiquetas en 10 idiomas y palabras de búsqueda por significado (10 agentes, en paralelo con 1.4).
- [ ] 1.6 QA completo y arreglos.
- [ ] 1.7 Revisión del dueño sobre una muestra y ajustes de rumbo.

## Fase 2 · Salidas, probadas con esos 1,000
Va antes de escalar: un cambio de formato cuesta poco con 1,000 y muchísimo con 10,000.
- [ ] 2.1 Animaciones en web: dibujar, rebotar, reemplazar (genéricas) y los efectos propios (`ring`, `wiggle`, `spin`, `beat`, `slide`, `float`, `bounce`), niveles con valor.
- [ ] 2.2 ~50 morphs curados (play ↔ pausa, menú ↔ X, más ↔ X, contorno ↔ relleno…) dibujados con estructura compatible; el resto usa «reemplazar».
- [ ] 2.3 ~30 íconos con valor en vivo (`--gota-value` con `@property`): descarga, carga, batería, volumen, temporizador, termómetro. Un solo tono.
- [ ] 2.4 Grosor continuo en los paquetes y `weight="auto"` (iguala el peso del texto); fuente de íconos variable `.woff2` con eje de grosor (contornos compatibles entre maestros).
- [ ] 2.5 Paquetes React, Vue, Svelte y Astro con importación por ícono; sprite SVG; Android Vector Drawables; símbolos personalizados de Xcode (Ultralight/Regular/Black × 3 tamaños, uso con `Image("nombre")`).
- [ ] 2.6 Figma: biblioteca o plugin con las variantes como propiedades.
- [ ] 2.7 Búsqueda por significado (es/en) y servidor MCP remoto en `gota.flouvia.com/mcp`.
- [ ] 2.8 Mapa de migración desde Lucide, Heroicons y SF Symbols, con codemod.

## Fase 3 · Escalar a 10,000
- [ ] 3.1 Taxonomía de los ~9,000 restantes por dominios (salud, educación, comida, deportes, herramientas, ciencia, industria, hogar, animales, IA, transporte…), sin repetir conceptos.
- [ ] 3.2 Modificadores curados en el motor: insignias con recorte (+, −, ✓, ×, reloj, candado, alerta, estrella), direcciones y niveles.
- [ ] 3.3 Nueve rondas de ~1,000: cada agente entrega todo de una vez, con crítico, QA y muestra al dueño.

## Fase 4 · Lanzamiento de la v1 (10,000)
- [ ] 4.1 Página para explorar, buscar y copiar (SVG, JSX, Figma) en `gota.flouvia.com`.
- [ ] 4.2 GitHub solo con la fuente; GitHub Action que publica el ZIP en cada versión; npm `@flouvia/gota`.
- [ ] 4.3 Cero avisos de QA, revisión completa del dueño, documentación y anuncio.

## Después de la v1
- «Gota a pedido»: un ícono que falte se dibuja con el motor, pasa QA y revisión y entra a la librería en minutos.
- `flouvia-web` deja su set propio (`src/components/icons.ts`) y consume `@flouvia/gota`.
