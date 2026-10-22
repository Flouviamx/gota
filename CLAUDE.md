# Gota — guía operativa

`CLAUDE.md` es el router del repositorio: qué es Gota, reglas que no se negocian, comandos, estructura y a qué documento ir antes de editar. El detalle vive en [`docs/`](./docs/README.md) y en [`DESIGN.md`](./DESIGN.md) (las reglas de dibujo); no se copia en otro lado.

## Qué es
Gota es la librería de íconos de Flouvia (`@flouvia/gota`, licencia MIT): dibujada a mano con un motor de geometría propio, esquinas continuas, un trazo de 1.5 en un solo tono y una firma — los contenedores llevan la esquina inferior derecha recta, como la gota del isotipo de Flouvia, y los globos de conversación son la gota misma. Nació el 21 oct 2026 a partir del set de `flouvia-web` ([historia](./docs/history.md)).

**Meta de la v1: 10,000 íconos, y no se publica nada antes** ([plan por fases](./docs/roadmap.md)). La página pública vivirá en `gota.flouvia.com`.

## Inicio obligatorio
1. `git status --short`: conserva trabajo ajeno (agentes o sesiones en paralelo pueden estar editando `src/icons/`).
2. Lee [`docs/README.md`](./docs/README.md) y abre los documentos que su matriz pide para la tarea; para dibujar, siempre [`DESIGN.md`](./DESIGN.md) y el núcleo (`src/icons/nucleo.mjs` y sus hojas).
3. Revisa el estado en [`docs/roadmap.md`](./docs/roadmap.md) y las decisiones ya tomadas en [`docs/decisions.md`](./docs/decisions.md) antes de proponer algo: lo descartado no se vuelve a discutir sin un motivo nuevo.

Al cerrar: el trabajo queda en commits locales y se anota en [`docs/history.md`](./docs/history.md). Aún no hay remoto: crear el repo en GitHub y publicar en npm requiere el OK del dueño.

## Comandos
```bash
node scripts/build.mjs                    # valida todo y genera svg/, svg/fill/ y dist/ (la matriz completa)
node scripts/build.mjs --check <cat>      # valida una categoría (no escribe)
node scripts/sheet.mjs <cat|all>          # hoja de dibujo: 96 px con keylines, 24, 18, pastilla y fondo claro
node scripts/variants-sheet.mjs <cat|all> # hoja de variantes: relleno, grosores, círculo, cuadrado, tachado, 16 px reales, espejo, niveles, movimiento
node scripts/qa.mjs [cat]                 # QA automático: área, densidad, silueta del relleno, casi duplicados
npm test                                  # pruebas del motor (node:test)
```
Node ≥ 22, sin dependencias de npm: Chrome del sistema renderiza las hojas (`CHROME` para otra ruta).

## Reglas que no se negocian
- **Calidad nivel Apple, genuinamente diseñada:** nada copiado de Lucide, Feather, Heroicons, Tabler, Phosphor ni SF Symbols; cada metáfora se construye con el motor.
- **Un solo tono:** sin opacidades, duotono, degradados ni cambios de color en ninguna variante.
- **La firma** (esquina inferior derecha recta en contenedores, `drop()` en globos) y las keylines de [`DESIGN.md`](./DESIGN.md) en todo ícono.
- **Datos, no archivos:** cada ícono es una definición en `src/icons/<categoría>.mjs`; todo SVG, paquete y hoja se genera. `svg/`, `dist/` y `previews/` nunca van al repo.
- **Sin basura:** nada de íconos de prueba, archivos temporales ni scripts de un solo uso en el repo.
- **Nada se publica antes de los 10,000**, y para publicar: cero avisos de QA y revisión del dueño.
- Nombres de íconos en kebab-case en inglés; copy, comentarios y docs en español.

## Estructura
```text
engine/geometry.mjs   Primitivas de dibujo: sq (squircle), circ, dot, drop, arc, polar, head, roundpoly, line, rot.
engine/variants.mjs   Variantes sin redibujar: render, snap (16 px), transform, encierros, tachado, espejo, niveles, movimiento.
src/icons/*.mjs       Una categoría por archivo: { category, label, icons: { nombre: definición } }. Fuente de verdad.
src/i18n/*.json       Etiquetas en 10 idiomas y palabras de búsqueda (es/en) de cada categoría.
scripts/              load (carga y valida), build, sheet, variants-sheet, qa, chrome (Chrome sin ventana).
tests/                Pruebas del motor.
DESIGN.md             Reglas de dibujo (las lee todo agente que dibuja).
```

## Documentación
| Tema | Documento |
|---|---|
| Reglas de dibujo, keylines, firma, relleno, 16 px, espejo, niveles, movimiento, piezas, idiomas | [`DESIGN.md`](./DESIGN.md) |
| Formato de datos de un ícono y su validación | [`docs/format.md`](./docs/format.md) |
| Motor de geometría y de variantes | [`docs/engine.md`](./docs/engine.md) |
| Build, salidas, paquete y qué se sube | [`docs/build.md`](./docs/build.md) |
| Producción con agentes: rondas, categorías, prompts, hojas | [`docs/production.md`](./docs/production.md) |
| Calidad: QA automático, pruebas y compuertas de revisión | [`docs/quality.md`](./docs/quality.md) |
| Fases y subfases, estado y lo que sigue | [`docs/roadmap.md`](./docs/roadmap.md) |
| Propuestas y decisiones (sí, no, distinto y por qué) | [`docs/decisions.md`](./docs/decisions.md) |
| Bitácora: qué se hizo, cómo y cuándo | [`docs/history.md`](./docs/history.md) |
