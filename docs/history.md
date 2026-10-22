# Historia

> Bitácora de lo que se hizo, cómo y por qué. Lo más nuevo arriba. Las decisiones con su motivo están en [Decisiones](./decisions.md).

[← Índice](./README.md)

## 21 oct 2026 — Nace Gota

### En `flouvia-web` (de donde salió el set)
- El dueño pide quitar los íconos estilo Lucide. Primera versión: 50 íconos generados con un script de Python fuera del repo (retícula de 24, trazo 1.5, la firma de la esquina recta y globos con la gota).
- Al verla pide «nivel Apple, dibujos genuinamente diseñados». Segunda versión, redibujada desde cero:
  - esquinas continuas (squircle con suavizado 0.6, algoritmo de Figma) en lugar de arcos circulares;
  - keylines fijas;
  - metáforas construidas desde la geometría: lápiz, clip, avión, teléfono y llave.
- Pide «nada translúcido»: se elimina el duotono de los íconos de capacidades.
- Se integra el set en `src/components/icons.ts` (nombres en camelCase), con `Icon.astro` para el sitio y `portal/Icon.tsx` para el portal y Ops. Commit `8c6892b` de `flouvia-web`.

### Repo `flouvia-icons` (futuro `gota`)
- **Decisiones del dueño:** repo propio, licencia MIT y agentes en paralelo.
- **Motor:** se porta a JavaScript (`engine/geometry.mjs`), con `sq`, `circ`, `dot`, `drop`, `arc`, `head`, `roundpoly`, `line` y `rot`.
- **Base del repo:**
  - `DESIGN.md` con keylines, esquinas, firma, detalle, nombres y proceso;
  - `scripts/load.mjs` (carga y valida sin tumbar por un archivo roto) y `scripts/build.mjs`;
  - `scripts/sheet.mjs`: hoja con keylines, tamaños, pastilla y fondo claro;
  - el núcleo de 50 en `src/icons/nucleo.mjs`, en kebab-case.
- Commit `f9102e9`.
- **Ronda 1 de dibujo:** 9 categorías con dibujante y crítico (ver [Producción](./production.md#ronda-1--dibujo-base-21-oct-2026)). Hacia las 20:50 el set ya tenía ~1,000 íconos y los críticos seguían revisando. Workflow `wf_0024a5b2-d6e`.
- **Variantes estilo SF Symbols** (`engine/variants.mjs`):
  - relleno con máscaras (`solid`, `cut`, `lines` con aire de 1.5);
  - grosores 1 / 1.5 / 2 y continuo;
  - círculo, cuadrado con la firma y tachado con aire;
  - el build genera la matriz completa en `dist/svg/`, `react.js` (con `scale` y `1em`) e `icons.css`;
  - `scripts/chrome.mjs` y `scripts/variants-sheet.mjs`.
  - El núcleo recibe sus rellenos como ejemplo.
- **Nombre:** Gota (`@flouvia/gota`). README, `DESIGN.md` y paquete actualizados.
- **Lo que se sube:** `svg/` y `dist/` salen del git; solo la fuente va al repo.
- **El dueño fija la meta:** v1 de 10,000 íconos, nada se publica antes, y la página en `gota.flouvia.com`.
- **Formato extendido** para no rehacer nada (todo desde los primeros 1,000):
  - `small` y `snap` (ajuste al pixel a 16 px);
  - `mirror`, `levels`, `motion`, `parts` (nombres → `data-part`) y `data-level`;
  - `data-rtl="mirror"` en el `<svg>`;
  - `fill: false` para los íconos de solo líneas;
  - idiomas en `src/i18n/` (10 idiomas y palabras de búsqueda).
  - Validación en `load.mjs` y núcleo actualizado como ejemplo.
- **La hoja de variantes ahora muestra:** 16 px rasterizados a 1x, espejo, niveles a la mitad y el cuadro extremo del movimiento.
- **QA automático** (`scripts/qa.mjs`): área, densidad, silueta del relleno y casi duplicados, con umbrales afinados. Encontró `cloud-sun` fuera del área, ~20 íconos demasiado densos, un ícono de prueba olvidado (`zz-bell-plus-top`) y pares casi idénticos. Se corrigen en la ronda 2.
- **Pruebas del motor:** `tests/engine.test.mjs`, 12 pruebas en verde (`npm test`).
- **Análisis externos del dueño:** se evaluaron uno por uno ([decisiones 22–37](./decisions.md)). Se adoptaron piezas con nombre, metadatos `data-*`, íconos con valor en vivo y `weight="auto"`; se corrigieron datos de la competencia y se descartaron el «smart SVG» y los cambios de color.
- **Documentación:** `CLAUDE.md` como router y `docs/` por dominio (este archivo, decisiones, roadmap, formato, motor, build, producción, calidad).
- **Detalles que señaló el dueño.** El puntero de navegación, el corazón con pulso y el globo con candado mostraron un problema de fondo: piezas dibujadas a mano y recortes a mano. Se resolvió en el sistema, no ícono por ícono:
  - `cursor()` en el motor: punta casi viva, porque un radio grande en 45° la volvía roma y alta;
  - insignias estándar `badge()` con recorte automático de 1.5;
  - los puntos que toca una insignia salen enteros;
  - el QA suma `suelto` (fragmentos) y `roza` (casi toques);
  - se corrigió `snap`, que tomaba el cierre de un círculo como línea y deformaba los círculos a 16 px;
  - 15 pruebas en verde.
- **El núcleo quedó en cero avisos de QA:** aire de los signos de alerta, la cabeza de atrás de clientes, la ruta que ahora toca sus círculos, la perforación del boleto (dos rayas), los corchetes de código, el badajo de la campana, el globo con solo ecuador y la tabla con columnas desde el encabezado.
- **Navegación:** `cursor`, `cursor-click` (destellos con aire) y `drag-drop` (puntero como insignia) pasaron al motor. Al set del sitio en `flouvia-web` le llegan estos cambios cuando consuma Gota.
- **Ronda 1 cerrada** (workflow `wf_0024a5b2-d6e`: 18 agentes, 0 errores, 1 h 47 min, ~6.1 M tokens de subagentes): 993 íconos.
  - Los críticos rediseñaron metáforas confusas (el cubo de pintura, el lazo, la cita) y quitaron conceptos repetidos entre categorías, con su reemplazo.
  - Acercaron cada ícono al núcleo y se adelantaron con rellenos, espejo y movimiento en navegación.
  - Avisaron de los choques entre variantes automáticas y dibujadas. Se resolvió con una regla: **la dibujada a mano gana** (`arrow-right-circle`, `bell-off`…), en el build, en `toSvg` y en React (`resolveIcon`).
  - La densidad del QA pasó a un umbral fijo de 28 %.
  - Pendientes para la ronda 2: 268 avisos (la mayoría en comercio), relleno en casi todas las categorías, idiomas y etiquetas entre categorías (responder, organigrama, quitar enlace).

## 22 oct 2026 — Ronda 2 y fase 1.6
- **Ronda 2** (workflow `wf_72d40526-58d`: 20 agentes, 0 errores, ~3 h 40 min, ~6.6 M tokens).
  - **Cobertura:** ~400 conceptos revisados y +40 comunes (menos, sincronizar, navegador, ©, ®, ™, café, puerta, reciclaje…). Descartados con motivo: urna, moto y desagrupar.
  - **Diseño:** 834 íconos con relleno, 191 con dibujo de 16 px, 142 con espejo, 17 con niveles, 366 con movimiento y 700 con piezas con nombre; insignias y punteros pasaron al motor.
  - **Idiomas:** los 1,033 en 10 idiomas, más las etiquetas entre categorías.
  - QA en 0 avisos con las reglas de entonces. Commit `293849c`.
- **Fallos del motor que encontraron los agentes** (commit `e24342b`):
  - el paquete **no llevaba las insignias**;
  - el relleno encerrado las omitía;
  - a 16 px las insignias de anillo se empastaban, las puntas de flecha se desfasaban del asta y los puntos salían grises;
  - los trazos abiertos dentro de `solid` se rellenaban como cuña (el arco del candado era una cúpula);
  - la hoja de dibujo no mostraba insignias y el cuadro de movimiento no movía la insignia.

  Se resolvieron con:
  - export completo y relleno encerrado con insignia;
  - el tipo `wire`;
  - `badge(kind, { size })` con la versión de pixel que diseñaron las categorías, ya en el motor, incluido el candado;
  - `snapper` (un ajuste por ícono) y puntos a esquina de pixel;
  - quitar puntos por distancia real;
  - estrella redibujada, hoja de dibujo con el render y regla `abierto` en el QA.
  - 21 pruebas.
- **Arreglos por categoría:** la primera pasada (`wf_8337a449-604`) dejó listas archivos, comunicación y edición (commit `308464a`).
  - Las otras seis no editaron nada. El último mensaje del dueño era una pregunta («¿cuáles son las fases 2, 3 y 4?») y, por precaución, entendieron que nadie había pedido cambios.
  - **Lección:** cada encargo de agentes cita la autorización explícita del dueño. Se relanzó con su «sigue» (`wf_4ddb4532-a93`).
