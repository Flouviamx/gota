# Flouvia Icons

El set de íconos de [Flouvia](https://flouvia.com): dibujado a mano, con esquinas continuas, un
solo trazo de 1.5 y una firma propia — los contenedores llevan la esquina inferior derecha recta,
como la gota del isotipo de Flouvia, y los globos de conversación son la gota misma.

## Uso

SVG sueltos en `svg/` (24 × 24, `stroke="currentColor"`), o desde el paquete:

```js
import { icons } from '@flouvia/icons';          // nombre → trazos (d de cada path)
import { Icon } from '@flouvia/icons/react';     // <Icon name="mail" size={20} />
```

## Desarrollo

```bash
node scripts/build.mjs                 # valida todo y genera svg/ y dist/
node scripts/build.mjs --check <cat>   # valida una categoría
node scripts/sheet.mjs <cat|all>       # hoja de revisión en previews/
```

Cada categoría vive en `src/icons/<categoría>.mjs` y se dibuja con `engine/geometry.mjs`.
Las reglas de diseño están en [DESIGN.md](./DESIGN.md).

## Licencia

[MIT](./LICENSE) © 2026 Flouvia
