# Gota

[English](./README.md) · **Español**

Los íconos de [Flouvia](https://flouvia.com), dibujados a mano, con esquinas continuas, un
solo trazo de 1.5 y una firma propia — los contenedores llevan la esquina inferior derecha recta,
como la gota del isotipo de Flouvia, y los globos de conversación son la gota misma.

## Uso

Importa los íconos que usa cada página: cada uno lleva solo sus propios datos.

```js
import { BellIcon, MailIcon } from '@flouvia/gota/react/icons';    // o /vue/icons
<MailIcon />                                       // 1em, asentado en la línea como una letra
<BellIcon variant="fill" weight="light" scale="large" />
<BellIcon slash />                                 // el bell-off dibujado a mano

import { IconBase } from '@flouvia/gota/react';     // un componente, cualquier ícono: puede animar el cambio
import { CloseIcon, MenuIcon } from '@flouvia/gota/icons';
<IconBase icon={open ? CloseIcon : MenuIcon} transition="auto" />

import { svg } from '@flouvia/gota/core';           // sin framework
svg(MailIcon, { variant: 'fill', weight: 'bold', enclosure: 'circle' });
```

Por nombre, con el set completo (prototipos, nombres que llegan en tiempo de ejecución):
`<Icon name="mail" />` desde `@flouvia/gota/react`, o `toSvg('mail')` desde `@flouvia/gota`.

- **Grosores:** `light`, `regular`, `bold`. **Estilos:** `outline` y `fill`.
- **Formas:** normal, `enclosure: 'circle' | 'square'` y `slash`.
- **Junto al texto:** por omisión mide `1em` y baja `-0.125em`, como una letra; `scale`
  (`small`, `medium`, `large`) lo ajusta. Sin React: `@flouvia/gota/icons.css` y la clase `.fi`.
- **Valores:** `value={0.6}` en wifi, señal, batería, volumen, un temporizador, un medidor, una brújula…: se encienden niveles, un anillo se dibuja hasta ahí, una aguja gira, y un valor nuevo se anima.
- **Peso del texto:** `weight="auto"` iguala el trazo al peso del texto que lo rodea.
- **Movimiento:** `effect="auto"` reproduce el gesto propio del ícono (`play`: `hover`, `once`, `loop`);
  `transition="auto"` anima un cambio de `name` o de `slash`: una insignia o una diagonal se dibujan
  solas, menú ↔ cerrar y otros pares curados se transforman, el resto se reemplaza. Quieto con
  movimiento reducido.
- **Vue, Svelte, Astro:** `@flouvia/gota/vue` (y `/vue/icons`), `/svelte` (y `/svelte/base`) y `/astro`, con las mismas props.
- **Sprite:** `@flouvia/gota/sprite.svg` (y `sprite-fill.svg`), `<svg><use href="sprite.svg#gota-bell"/></svg>`; `sprite()` arma uno solo con tus íconos.
- **Búsqueda por significado:** `searchIcons('cobrar')` desde `@flouvia/gota/search` (español e inglés).
- **Para agentes de IA:** un servidor MCP, `gota-mcp`, para encontrar íconos e insertar su código.
- **Nativos:** los vector drawables de Android y un catálogo de Xcode con símbolos propios (`Image("bell")`, todos los pesos y escalas) vienen en el ZIP de cada versión.
- **Fuente de íconos:** `@flouvia/gota/font.css`, luego `<i class="gota">bell</i>` (el nombre es una ligadura) o el punto de código del ícono (`fonts/codepoints.json`); `.gota-fill` para el estilo relleno. Variable: el trazo sigue a `font-weight`, de 300 (light) a 700 (bold), como hace `weight="auto"`.
- **SVG sueltos:** `svg/` (regular) y `svg/fill/`; la matriz completa en `dist/svg/<grosor>/<estilo>/`.

## Desarrollo

```bash
node scripts/build.mjs                 # valida todo y genera svg/ y dist/
node scripts/build.mjs --check <cat>   # valida una categoría
node scripts/sheet.mjs <cat|all>       # hoja de revisión en previews/
node scripts/variants-sheet.mjs <cat>  # hoja de variantes (relleno, grosores, 16 px reales…)
node scripts/transitions-sheet.mjs     # cuadros de cada transición
node scripts/sheets.mjs                # todas las hojas, más previews/index.html
node scripts/qa.mjs [cat]              # control de calidad automático
npm test                               # pruebas del motor y de las funciones
```

Cada categoría vive en `src/icons/<categoría>.mjs` y se dibuja con `engine/geometry.mjs`.
Las reglas de diseño están en [DESIGN.md](./DESIGN.md); la guía del proyecto, en
[CLAUDE.md](./CLAUDE.md) y [docs/](./docs/README.md) (en inglés).

## Licencia

[MIT](./LICENSE) © 2026 Flouvia
