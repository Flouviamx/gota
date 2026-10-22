// Variantes de cada ícono sin redibujarlo: grosor (continuo), encerrado en círculo o cuadrado,
// tachado, espejo para idiomas de derecha a izquierda, niveles (0–1), tamaño de 16 px ajustado al
// pixel y el cuadro extremo de su movimiento. El relleno (`fill`) y el dibujo de 16 px (`small`)
// sí se dibujan en la definición. Todo sale como el contenido de un <svg viewBox="0 0 24 24">.
// Ver DESIGN.md › Relleno, Variantes y Movimiento.
import { circ, f, sq } from './geometry.mjs';

/** Grosores del set: el dibujo está pensado para el regular. */
export const WEIGHTS = { light: 1, regular: 1.5, bold: 2 };

// ── Transformar un path (escala uniforme + traslación) ──
const NUMS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function parse(d) {
  const out = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  let cmd = null;
  let args = [];
  const flush = () => {
    if (!cmd) return;
    const n = NUMS[cmd.toUpperCase()];
    if (n === 0) out.push([cmd, []]);
    else
      for (let i = 0; i < args.length; i += n) {
        // tras M, los pares siguientes son L implícitos
        const c = i > 0 && cmd === 'M' ? 'L' : i > 0 && cmd === 'm' ? 'l' : cmd;
        out.push([c, args.slice(i, i + n)]);
      }
    args = [];
  };
  for (const m of d.matchAll(re)) {
    if (m[1]) {
      flush();
      cmd = m[1];
    } else args.push(Number(m[2]));
  }
  flush();
  return out;
}

/**
 * Ajuste al pixel para 16 px: allí el trazo de 1.5 mide 1 px exacto y los centros de pixel caen en
 * 0.75 + 1.5k del lienzo de 24. Los tramos horizontales y verticales se mueven a esos centros para
 * que se vean nítidos; las curvas solo acompañan a sus extremos.
 */
export function snap(d, step = 1.5, offset = 0.75) {
  const S = (v) => Math.round((v - offset) / step) * step + offset;
  const EPS = 0.06;
  // A absoluto (transform sin escala) y por tramos, con su punto de inicio y de fin
  const segs = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  for (const [c, a] of parse(transform(d, 1, 0, 0))) {
    const g = { c, a: [...a], x0: x, y0: y };
    if (c === 'M') [x, y, sx, sy] = [a[0], a[1], a[0], a[1]];
    else if (c === 'L' || c === 'T') [x, y] = a;
    else if (c === 'H') x = a[0];
    else if (c === 'V') y = a[0];
    else if (c === 'C') [x, y] = [a[4], a[5]];
    else if (c === 'S' || c === 'Q') [x, y] = [a[2], a[3]];
    else if (c === 'A') [x, y] = [a[5], a[6]];
    else if (c === 'Z') [x, y] = [sx, sy];
    g.x1 = x;
    g.y1 = y;
    segs.push(g);
  }
  // Coordenadas de los tramos rectos alineados a un eje: esas se mueven al centro del pixel
  const xs = [];
  const ys = [];
  for (const g of segs) {
    if (!['L', 'H', 'V', 'Z'].includes(g.c)) continue;
    if (Math.abs(g.x0 - g.x1) < EPS) xs.push((g.x0 + g.x1) / 2);
    if (Math.abs(g.y0 - g.y1) < EPS) ys.push((g.y0 + g.y1) / 2);
  }
  const dx = (v) => {
    const u = xs.find((k) => Math.abs(k - v) < EPS);
    return u === undefined ? 0 : S(u) - v;
  };
  const dy = (v) => {
    const u = ys.find((k) => Math.abs(k - v) < EPS);
    return u === undefined ? 0 : S(u) - v;
  };
  // Cada punto se mueve con su extremo; los controles de una curva, con el extremo al que tocan
  return segs
    .map(({ c, a, x0, y0, x1, y1 }) => {
      const [ex, ey] = [dx(x1), dy(y1)];
      const [bx, by] = [dx(x0), dy(y0)];
      if (c === 'M' || c === 'L' || c === 'T') return `${c}${f(x1 + ex)} ${f(y1 + ey)}`;
      if (c === 'H') return `H${f(x1 + ex)}`;
      if (c === 'V') return `V${f(y1 + ey)}`;
      if (c === 'C') return `C${f(a[0] + bx)} ${f(a[1] + by)} ${f(a[2] + ex)} ${f(a[3] + ey)} ${f(x1 + ex)} ${f(y1 + ey)}`;
      if (c === 'S' || c === 'Q') return `${c}${f(a[0] + ex)} ${f(a[1] + ey)} ${f(x1 + ex)} ${f(y1 + ey)}`;
      if (c === 'A') return `A${f(a[0])} ${f(a[1])} ${f(a[2])} ${a[3]} ${a[4]} ${f(x1 + ex)} ${f(y1 + ey)}`;
      return 'Z';
    })
    .join('');
}

/** Path a coordenadas absolutas y transformado: p' = p · s + (tx, ty). */
export function transform(d, s, tx, ty) {
  const o = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const X = (v) => f(v * s + tx);
  const Y = (v) => f(v * s + ty);
  for (const [c, a] of parse(d)) {
    const rel = c === c.toLowerCase() && c !== 'z';
    const C = c.toUpperCase();
    const ax = (v) => (rel ? x + v : v);
    const ay = (v) => (rel ? y + v : v);
    if (C === 'M') {
      x = ax(a[0]);
      y = ay(a[1]);
      sx = x;
      sy = y;
      o.push(`M${X(x)} ${Y(y)}`);
    } else if (C === 'L' || C === 'T') {
      x = ax(a[0]);
      y = ay(a[1]);
      o.push(`${C}${X(x)} ${Y(y)}`);
    } else if (C === 'H') {
      x = rel ? x + a[0] : a[0];
      o.push(`H${X(x)}`);
    } else if (C === 'V') {
      y = rel ? y + a[0] : a[0];
      o.push(`V${Y(y)}`);
    } else if (C === 'C') {
      const p = [ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3]), ax(a[4]), ay(a[5])];
      x = p[4];
      y = p[5];
      o.push(`C${X(p[0])} ${Y(p[1])} ${X(p[2])} ${Y(p[3])} ${X(p[4])} ${Y(p[5])}`);
    } else if (C === 'S' || C === 'Q') {
      const p = [ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3])];
      x = p[2];
      y = p[3];
      o.push(`${C}${X(p[0])} ${Y(p[1])} ${X(p[2])} ${Y(p[3])}`);
    } else if (C === 'A') {
      x = ax(a[5]);
      y = ay(a[6]);
      o.push(`A${f(a[0] * s)} ${f(a[1] * s)} ${f(a[2])} ${a[3]} ${a[4]} ${X(x)} ${Y(y)}`);
    } else if (C === 'Z') {
      x = sx;
      y = sy;
      o.push('Z');
    }
  }
  return o.join('');
}

// ── Piezas de SVG ──
const strokeAttrs = (w) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

/** Encerrar: el dibujo se reduce al centro y lo rodea un círculo (r 9) o un cuadrado con la firma. */
export const ENCLOSURES = {
  circle: { shape: circ(12, 12, 9), scale: 0.58 },
  square: { shape: sq(3.25, 3.25, 17.5, 17.5, 4.25, { square: ['br'] }), scale: 0.6 },
};
const shrink = (ds, scale) => ds.map((d) => transform(d, scale, 12 * (1 - scale), 12 * (1 - scale)));

// Tachado: de arriba a la izquierda a abajo a la derecha, con aire de 1.5 a cada lado
const SLASH = 'M3.6 3.6 20.4 20.4';

/**
 * Contenido SVG de un ícono en una variante.
 * icon: { d, fill?: { solid, cut?, lines? } } · style: 'outline' | 'fill'
 * enclosure: null | 'circle' | 'square' · slash: boolean · weight: número de trazo · id: único por SVG (máscaras)
 */
/** Índices de d de unas piezas, por nombre (icon.parts) o por número. */
const indices = (icon, list) => (list ?? []).flatMap((p) => (Number.isInteger(p) ? [p] : (icon.parts?.[p] ?? [])));

/** Atributos de cada trazo de d: su pieza (data-part) y su nivel (data-level, desde 1). */
function tagsOf(icon) {
  const t = new Map();
  const add = (i, attr) => t.set(icon.d[i], `${t.get(icon.d[i]) ?? ''} ${attr}`);
  for (const [name, ix] of Object.entries(icon.parts ?? {})) for (const i of ix) add(i, `data-part="${name}"`);
  (icon.levels ?? []).forEach((ix, n) => ix.forEach((i) => add(i, `data-level="${n + 1}"`)));
  return t;
}

/** El dibujo que corresponde: el de 16 px (`small`) o su ajuste al pixel, los niveles y el movimiento. */
function resolve(icon, { size, value, frame }) {
  const small = size && size <= 18 ? icon.small : null;
  let d = small ? small.d : icon.d;
  let fill = small ? (small.fill ?? null) : (icon.fill ?? null);
  // Niveles (wifi, batería, volumen…): con value < 1 se ocultan los niveles que no alcanza
  if (icon.levels && value !== undefined && value < 1 && !small) {
    const shown = Math.round(Math.max(0, Math.min(1, value)) * icon.levels.length);
    const hide = new Set(icon.levels.slice(shown).flat().map((i) => icon.d[i]));
    d = d.filter((p) => !hide.has(p));
    if (fill) fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.filter((p) => !hide.has(p))]));
  }
  // Cuadro extremo del movimiento (para revisar piezas y pivote en las hojas)
  let moved = null;
  if (frame && icon.motion) moved = new Set((icon.motion.parts ? indices(icon, icon.motion.parts) : icon.d.map((_, i) => i)).map((i) => icon.d[i]));
  const tags = small ? new Map() : tagsOf(icon);
  if (size && size <= 18 && !small) {
    for (const [p, t] of [...tags]) tags.set(snap(p), t);
    d = d.map((p) => snap(p));
    if (fill) fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map((p) => snap(p))]));
    moved = moved && new Set([...moved].map((p) => snap(p)));
  }
  return { d, fill, moved, tags };
}

/** Transformación SVG del cuadro extremo de cada efecto (ver DESIGN.md › Movimiento). */
export function motionTransform({ effect, origin = [12, 12], vector = [0, -2] }) {
  const [ox, oy] = origin;
  if (effect === 'ring' || effect === 'wiggle') return `rotate(${effect === 'ring' ? 18 : 10} ${ox} ${oy})`;
  if (effect === 'spin') return `rotate(90 ${ox} ${oy})`;
  if (effect === 'beat') return `translate(${ox} ${oy}) scale(1.18) translate(${-ox} ${-oy})`;
  if (effect === 'slide' || effect === 'float' || effect === 'bounce') return `translate(${vector[0]} ${vector[1]})`;
  return '';
}

export function render(icon, { style = 'outline', enclosure = null, slash = false, weight = 1.5, id = 'i', size, rtl = false, value, frame = false } = {}) {
  const enc = enclosure ? ENCLOSURES[enclosure] : null;
  const r = resolve(icon, { size, value, frame });
  icon = { ...icon, d: r.d, fill: r.fill ?? undefined };
  const paths = (ds) => ds.map((d) => `<path d="${d}"${r.tags.get(d) ?? ''}/>`).join('');
  const k = enc ? enc.scale : 1;
  const fill = style === 'fill' && icon.fill ? icon.fill : null;
  const g = (ds) => (enc ? shrink(ds, k) : ds);
  const defs = [];
  const body = [];
  const masks = [];
  // Recorte del tachado (aplica a todo lo de abajo)
  if (slash) masks.push(`<path d="${SLASH}" stroke="black" stroke-width="${f(weight + 3)}" stroke-linecap="round"/>`);

  if (enc && style === 'fill') {
    // Encerrado y relleno: el contenedor sólido y el dibujo calado
    const glyph = g(icon.d);
    defs.push(`<mask id="${id}-e" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${glyph.map((d) => `<path d="${d}" fill="none" stroke="black" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}${masks.join('')}</mask>`);
    body.push(`<path d="${enc.shape}" fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linejoin="round" mask="url(#${id}-e)"/>`);
  } else {
    const content = [];
    if (enc) content.push(`<path d="${enc.shape}" ${strokeAttrs(weight)}/>`);
    if (fill) {
      // Lo calado (`cut`) se recorta al ancho del trazo; las líneas sueltas (`lines`) van encima
      // y se separan del relleno con un aire de 1.5 a cada lado
      const cuts = g(fill.cut ?? []).map((d) => `<path d="${d}" fill="none" stroke="black" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"/>`);
      const halos = g(fill.lines ?? []).map((d) => `<path d="${d}" fill="none" stroke="black" stroke-width="${f(weight + 3)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      defs.push(`<mask id="${id}-f" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${cuts.join('')}${halos.join('')}</mask>`);
      content.push(`<g fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-f)">${paths(g(fill.solid))}</g>`);
      if (fill.lines?.length) content.push(`<g ${strokeAttrs(weight)}>${paths(g(fill.lines))}</g>`);
    } else content.push(`<g ${strokeAttrs(weight)}>${paths(g(icon.d))}</g>`);
    if (masks.length) {
      defs.push(`<mask id="${id}-s" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${masks.join('')}</mask>`);
      body.push(`<g mask="url(#${id}-s)">${content.join('')}</g>`);
    } else body.push(...content);
  }
  if (slash) body.push(`<path d="${SLASH}" ${strokeAttrs(weight)}/>`);
  let inner = body.join('');
  // Movimiento: el cuadro extremo de las piezas que se mueven (solo en las hojas de revisión)
  if (r.moved?.size && !enc) {
    const t = motionTransform(icon.motion);
    const still = icon.d.filter((p) => !r.moved.has(p));
    const go = icon.d.filter((p) => r.moved.has(p));
    inner = `<g ${strokeAttrs(weight)}>${paths(still)}<g transform="${t}">${paths(go)}</g></g>`;
  }
  // Espejo para idiomas de derecha a izquierda (solo los íconos direccionales)
  if (rtl && icon.mirror) inner = `<g transform="matrix(-1 0 0 1 24 0)">${inner}</g>`;
  return `${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${inner}`;
}

/** El archivo SVG; los íconos direccionales llevan data-rtl="mirror" para voltearse en árabe o hebreo. */
export const svgFile = (inner, icon) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"${icon?.mirror ? ' data-rtl="mirror"' : ''}>${inner}</svg>\n`;
