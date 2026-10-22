# Decisiones

> Cada propuesta, de quién vino y qué se decidió: **sí**, **distinto** (se hace, pero de otra forma), **después** o **no**, con su motivo. Antes de proponer algo, búscalo aquí: lo descartado no se reabre sin un motivo nuevo.

[← Índice](./README.md)

## Origen y alcance
| # | Propuesta | De | Decisión | Motivo |
|---|---|---|---|---|
| 1 | Dejar los íconos estilo Lucide de `flouvia-web` | dueño | **sí** | Quiere algo único y premium, «tipo Apple» |
| 2 | Qué usar: set propio de Flouvia, Phosphor Light o Solar Linear | Claude (3 opciones) | **sí: set propio** | El más único; SF Symbols no se puede usar en web (licencia solo para plataformas de Apple) |
| 3 | Dónde: solo sitio público, o sitio + portal + Ops | Claude | **sitio, portal y Ops** (dueño) | Un solo lenguaje en todo Flouvia |
| 4 | «Nivel Apple, dibujos bien hechos, no copies» tras la primera versión | dueño | **sí** | Se redibujó todo: esquinas continuas (squircle), keylines, recortes, metáforas desde la geometría |
| 5 | Nada translúcido | dueño | **sí** | Se quitó el duotono; regla del set: un solo tono en toda variante |
| 6 | Publicar un set de íconos SVG de Flouvia (primero los necesarios) | dueño | **sí** | Origen de Gota |

## La librería
| # | Propuesta | De | Decisión | Motivo |
|---|---|---|---|---|
| 7 | Repo: nuevo (`flouvia-icons`) o carpeta dentro de `flouvia-web` | Claude | **repo nuevo** (dueño) | No mezclar miles de íconos que el sitio no usa con código de producción |
| 8 | Licencia: MIT, CC BY 4.0 o uso propio | Claude | **MIT** (dueño) | Máxima adopción y visibilidad |
| 9 | Ritmo: lotes por categoría con revisión, o todo de una con agentes en paralelo | Claude | **agentes en paralelo** (dueño) | Velocidad; la consistencia la cuidan críticos y QA |
| 10 | Nombre: Gota, Caudal, Trazo o Flouvia Symbols | Claude | **Gota** (dueño) | Su firma es la gota del isotipo; corto, propio, en español |
| 11 | Versiones 1.0 ≈ 1,000 → 2.0 ≈ 3,000 → 3.0 ≈ 6,000 → 4.0 = 10,000 | Claude | **no** | El dueño decidió: **la v1 es de 10,000 y no se publica nada antes** |
| 12 | GitHub solo con lo necesario, sin basura | dueño | **sí** | Solo fuente; SVG/`dist`/hojas se generan y van a Releases (ZIP) y npm |
| 13 | Página pública | dueño | **sí, en `gota.flouvia.com`** | Proyecto propio en Vercel; va en la fase 4 |
| 14 | Variantes estilo SF Symbols (relleno, grosores, círculo/cuadrado/tachado, encaje con el texto) con los primeros 1,000, la página después | dueño | **sí** | Para no rehacer: el relleno se dibuja; el resto sale del motor |

## Ser la número 1
| # | Propuesta | De | Decisión | Motivo / dónde |
|---|---|---|---|---|
| 15 | Tamaños ópticos (16 px ajustado al pixel o redibujado) | Claude | **sí, desde los primeros 1,000** | `snap` + `small` ([motor](./engine.md)) |
| 16 | Grosor continuo y fuente de íconos variable | Claude | **sí** | SVG continuo ya; `.woff2` variable en la fase 2 (lo más difícil: contornos compatibles) |
| 17 | Espejo para árabe y hebreo | Claude | **sí** | `mirror` + `data-rtl="mirror"` |
| 18 | Animación nativa estilo SF Symbols en web | Claude | **sí** | Datos ya (`motion`, `parts`, orden de dibujo); el runtime en la fase 2 |
| 19 | Ecosistema: Figma, Xcode, Android, paquetes por framework, MCP | Claude | **sí** | Fase 2, sobre el mismo motor |
| 20 | Búsqueda por significado y accesibilidad multilingüe | Claude | **sí** | `src/i18n/` con 10 idiomas y palabras de uso (es/en) |
| 21 | Hacer todo lo anterior desde los primeros 1,000 | dueño | **sí** | Separado en datos por ícono (ronda 2) y salidas del motor (fase 2) |

## Análisis externo 1 (pegado por el dueño)
| # | Propuesta | Decisión | Motivo |
|---|---|---|---|
| 22 | Capas con nombre y orden de trazos para animar | **sí, distinto** | `parts` con nombre → `data-part` en cada trazo; **nunca `id`** (chocan con varios íconos en la página). El orden de dibujo en `d` ya existía. Sin operaciones booleanas: el relleno usa máscaras |
| 23 | Morphing: igualar el número de nodos de todos los íconos | **distinto** | Deformaría los dibujos y no hace falta (GSAP MorphSVG transforma trazos con distinto número de puntos). ~50 pares curados con estructura compatible + «reemplazar» genérico (fase 2) |
| 24 | Metadatos en el SVG: `data-rtl`, `data-level` | **sí** | Hecho en el build. Los niveles inactivos se **ocultan**, no se vuelven translúcidos |
| 25 | Tabla «líderes sin grosor variable ni tamaño óptico» | **corregida** | Material Symbols ya es variable (grosor, relleno, tamaño óptico) y SF Symbols ya anima; el diferenciador real es la web y la calidad del set |
| 26 | Fuente variable `.woff2` con eje `wght` | **sí** | Fase 2 |
| 27 | Símbolos de Xcode usables con `Image(systemName:)` | **sí, corregido** | Los símbolos propios se usan con `Image("nombre")`; `systemName` es solo para los de Apple. Plantillas Ultralight/Regular/Black × 3 tamaños |
| 28 | Servidor MCP como distribución | **sí** | Remoto en `gota.flouvia.com/mcp`, búsqueda es/en, devuelve el SVG exacto |

## Prácticas «pro pro pro»
| # | Propuesta | De | Decisión | Dónde |
|---|---|---|---|---|
| 29 | Pruebas automáticas del motor | Claude | **sí, hecho** | `tests/engine.test.mjs` (12) |
| 30 | Cero avisos de QA para publicar | Claude | **sí** | [Calidad › Compuertas](./quality.md#compuertas) |
| 31 | Mapa de migración desde Lucide/Heroicons/SF con codemod | Claude | **sí** | Fase 2.8 |
| 32 | Versiones semánticas, changelog y alias de renombres | Claude | **sí** | Desde la primera publicación |

## Análisis externo 2 (pegado por el dueño)
| # | Propuesta | Decisión | Motivo |
|---|---|---|---|
| 33 | «Smart SVG»: el ícono se reacomoda según el aspecto del contenedor | **no** | Los íconos viven en cajas cuadradas; SVG no tiene condicionales (habría que meter JS). Lo útil —cambiar el dibujo según el tamaño— ya está con 16 px |
| 34 | Íconos con estado que reciben un valor en vivo | **sí, curados** | ~30 diseñados a propósito, `--gota-value` con `@property`, fase 2. En la ronda 2 los de cantidad marcan su pieza `level`/`progress` |
| 35 | Clima que cambia de color según humedad u hora | **no** | Rompe el principio de un solo tono; es efecto, no utilidad |
| 36 | Generador IA de íconos faltantes con la geometría del set | **después** | «Gota a pedido» tras la v1: motor + QA + revisión, en minutos. No se promete «milisegundos» ni «infinito» sin filtro |
| 37 | MCP que lee el código y ajusta grosor y radios a la app | **a medias** | Sí: `weight="auto"` iguala el peso del texto (como SF Symbols), resuelto en el componente. No: radios que cambian por app (rompe la identidad) |

## Decisiones de diseño y técnicas (Claude, durante la construcción)
- **Firma:** esquina inferior derecha recta en contenedores; globos con `drop()`.
- **Relleno con máscaras**, no con operaciones booleanas: `solid`/`cut`/`lines`; las `lines` llevan aire de 1.5 (calendario con argollas separadas, como SF Symbols).
- `fill: false` para íconos de solo líneas; tachado apagado en líneas sueltas (tachar una flecha no dice nada).
- Encierros al 58 % (círculo) y 60 % (cuadrado con la firma).
- 16 px: ajuste al pixel automático; dibujo propio solo donde no alcance.
- Grosores nombrados light 1 / regular 1.5 / bold 2, sobre un grosor continuo.
- Idiomas en archivos aparte (`src/i18n/`) para que diseño e idiomas trabajen en paralelo sin chocar.
- Umbrales de QA afinados (similitud 0.975 y exención de familias; sin aviso de «ligero»).
- La carpeta se renombra a `~/Desktop/gota` cuando no haya agentes trabajando.
