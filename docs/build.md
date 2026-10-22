# Build, salidas y publicación

> **Fuente de verdad:** `scripts/build.mjs`, `package.json`, `.gitignore`.

[← Índice](./README.md)

## Qué genera `node scripts/build.mjs`
| Salida | Contenido |
|---|---|
| `svg/<nombre>.svg` · `svg/fill/<nombre>.svg` | Regular, contorno y relleno |
| `dist/svg/<light\|regular\|bold>/<outline\|fill>/<nombre>[-circle\|-square\|-slash].svg` | La matriz completa (≈ 24 archivos por ícono, menos los que apaga `variants`) |
| `dist/icons.json` | Por ícono: categoría, tags, trazos y todos sus datos (`fill`, `small`, `variants`, `mirror`, `levels`, `motion`, `parts`) |
| `dist/index.js` + `index.d.ts` | `icons`, `categories`, `render`, `WEIGHTS` y `toSvg(nombre, { variant, weight, enclosure, slash })`; `IconName` tipado |
| `dist/geometry.js` · `dist/variants.js` | El motor, para dibujar cualquier combinación en el navegador |
| `dist/react.js` + `react.d.ts` | `<Icon name variant weight enclosure slash scale size />`: por omisión mide `1em` y baja `-0.125em` como una letra; `scale` small 0.85 / medium 1 / large 1.25; máscaras con `useId` |
| `dist/icons.css` | `.fi`, `.fi-sm`, `.fi-lg` para íconos junto al texto sin React |
Con `--check <categoría>` solo valida (lo usan los agentes mientras dibujan).

## Qué va al repositorio y qué no
- **Se sube:** `src/` (los dibujos y los idiomas), `engine/`, `scripts/`, `tests/`, `docs/`, `CLAUDE.md`, `DESIGN.md`, `README.md`, `LICENSE`, `package.json`.
- **No se sube** (`.gitignore`): `svg/`, `dist/`, `previews/`. Todo se regenera.

## Publicación (cuando haya 10,000)
- **npm:** `@flouvia/gota` con `dist/`, `svg/`, `LICENSE` y `README.md` (`files` del `package.json`). Exports: `.`, `./react`, `./svg/*`, `./icons.json`, `./icons.css`.
- **GitHub Releases:** una GitHub Action, al etiquetar una versión, corre el build y adjunta un ZIP con los SVG ordenados por grosor y estilo.
- Versiones semánticas, changelog y alias para los renombres ([decisiones](./decisions.md)).
- Página: `gota.flouvia.com` ([roadmap](./roadmap.md)).
