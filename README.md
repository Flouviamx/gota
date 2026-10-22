# Gota

Los íconos de [Flouvia](https://flouvia.com), dibujados a mano, con esquinas continuas, un
solo trazo de 1.5 y una firma propia — los contenedores llevan la esquina inferior derecha recta,
como la gota del isotipo de Flouvia, y los globos de conversación son la gota misma.

## Uso

SVG sueltos en `svg/` (24 × 24, `stroke="currentColor"`), o desde el paquete:

```js
import { toSvg } from '@flouvia/gota';
toSvg('mail', { variant: 'fill', weight: 'bold', enclosure: 'circle', slash: true });

import { Icon } from '@flouvia/gota/react';
<Icon name="mail" />                              // 1em, asentado en la línea como una letra
<Icon name="bell" variant="fill" weight="light" scale="large" />
<Icon name="mic" slash enclosure="circle" size={20} />
```

- **Grosores:** `light`, `regular`, `bold`. **Estilos:** `outline` y `fill`.
- **Formas:** normal, `enclosure: 'circle' | 'square'` y `slash`.
- **Junto al texto:** por omisión mide `1em` y baja `-0.125em`, como una letra; `scale`
  (`small`, `medium`, `large`) lo ajusta. Sin React: `@flouvia/gota/icons.css` y la clase `.fi`.
- SVG sueltos: `svg/` (regular) y `svg/fill/`; la matriz completa en `dist/svg/<grosor>/<estilo>/`.

## Desarrollo

```bash
node scripts/build.mjs                 # valida todo y genera svg/ y dist/
node scripts/build.mjs --check <cat>   # valida una categoría
node scripts/sheet.mjs <cat|all>       # hoja de revisión en previews/
node scripts/variants-sheet.mjs <cat>  # hoja de variantes (relleno, grosores, 16 px reales…)
node scripts/qa.mjs [cat]              # control de calidad automático
npm test                               # pruebas del motor
```

Cada categoría vive en `src/icons/<categoría>.mjs` y se dibuja con `engine/geometry.mjs`.
Las reglas de diseño están en [DESIGN.md](./DESIGN.md); la guía del proyecto, en
[CLAUDE.md](./CLAUDE.md) y [docs/](./docs/README.md).

## Licencia

[MIT](./LICENSE) © 2026 Flouvia
