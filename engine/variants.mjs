// Variantes de cada ícono sin redibujarlo: grosor (continuo), encerrado en círculo o cuadrado,
// tachado, espejo para idiomas de derecha a izquierda, niveles (0–1), tamaño de 16 px ajustado al
// pixel y el cuadro extremo de su movimiento. El relleno (`fill`) y el dibujo de 16 px (`small`)
// sí se dibujan en la definición. Todo sale como el contenido de un <svg viewBox="0 0 24 24">.
// Ver DESIGN.md › Relleno, Variantes y Movimiento.
import { badge, circ, f, sq } from './geometry.mjs';

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
  return snapper([d], step, offset)(d);
}

/**
 * Ajuste al pixel de un ícono entero: las coordenadas que se mueven salen de TODOS sus trazos, y
 * cada trazo se mueve con los mismos desplazamientos. Así la punta de una flecha acompaña a su
 * asta aunque sean trazos distintos. Los puntos (círculos de r < 1) van a una esquina de pixel con
 * r 1: cubren 2 × 2 pixeles nítidos en lugar de una mancha gris.
 */
export function snapper(list, step = 1.5, offset = 0.75) {
  const S = (v) => Math.round((v - offset) / step) * step + offset;
  const EPS = 0.06;
  const segsOf = (d) => {
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
    return segs;
  };
  // Coordenadas de los tramos rectos alineados a un eje, de todos los trazos
  const xs = [];
  const ys = [];
  for (const d of list) {
    if (asCircle(d)?.r < 1) continue;
    for (const g of segsOf(d)) {
      if (!['L', 'H', 'V', 'Z'].includes(g.c)) continue;
      // Un tramo de largo cero (el cierre de un círculo) no es ni horizontal ni vertical
      if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) < EPS) continue;
      if (Math.abs(g.x0 - g.x1) < EPS) xs.push((g.x0 + g.x1) / 2);
      if (Math.abs(g.y0 - g.y1) < EPS) ys.push((g.y0 + g.y1) / 2);
    }
  }
  const dx = (v) => {
    const u = xs.find((k) => Math.abs(k - v) < EPS);
    return u === undefined ? 0 : S(u) - v;
  };
  const dy = (v) => {
    const u = ys.find((k) => Math.abs(k - v) < EPS);
    return u === undefined ? 0 : S(u) - v;
  };
  return (d) => {
    const dot = asCircle(d);
    if (dot && dot.r < 1) {
      const E = (v) => Math.round(v / step) * step;
      return circleD(E(dot.cx), E(dot.cy), 1);
    }
    // Cada punto se mueve con su extremo; los controles de una curva, con el extremo al que tocan
    return segsOf(d)
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
  };
}
const circleD = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;

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
// ── Puntos y áreas despejadas ──
// Un punto (círculo de r < 1, como los de dot()) que toca el área de una insignia se quita entero:
// medio punto es un fragmento, no un detalle.
const CIRCLE = /^M(-?[\d.]+) (-?[\d.]+)A([\d.]+) [\d.]+ 0 1 0 (-?[\d.]+) (-?[\d.]+)A/;
function asCircle(d) {
  const m = d.trim().match(CIRCLE);
  if (!m) return null;
  const r = Number(m[3]);
  return { cx: Number(m[1]) + r, cy: Number(m[2]), r };
}
/** Puntos de un trazo en absoluto (los extremos de cada tramo y los controles de sus curvas). */
function pointsOf(d) {
  const pts = [];
  for (const [c, a] of parse(transform(d, 1, 0, 0))) {
    if (c === 'H' || c === 'V' || c === 'Z') continue;
    for (let i = 0; i + 1 < a.length; i += 2) if (c !== 'A' || i === 5) pts.push([a[i], a[i + 1]]);
    if (c === 'A') pts.push([a[5], a[6]]);
  }
  return pts;
}
/** ¿El punto `dot` toca el área despejada por `knock` (con su aire)? Por distancia real a la figura. */
function dotInKnock(dot, knock, weight) {
  const halo = weight / 2 + 1.5 + weight / 2;
  const reach = halo + dot.r + weight / 2;
  const c = asCircle(knock);
  if (c) return Math.hypot(dot.cx - c.cx, dot.cy - c.cy) < c.r + reach;
  // Distancia a la línea poligonal de la figura y, si es cerrada, si el punto cae dentro
  const pts = pointsOf(knock);
  let min = Infinity;
  let inside = false;
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[(k + 1) % pts.length];
    const L = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-9;
    const t = Math.max(0, Math.min(1, ((dot.cx - ax) * (bx - ax) + (dot.cy - ay) * (by - ay)) / L));
    min = Math.min(min, Math.hypot(dot.cx - (ax + t * (bx - ax)), dot.cy - (ay + t * (by - ay))));
    if (ay > dot.cy !== by > dot.cy && dot.cx < ((bx - ax) * (dot.cy - ay)) / (by - ay) + ax) inside = !inside;
  }
  return min < reach || (/[zZ]\s*$/.test(knock) && inside);
}

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
function resolve(icon, { size, value, frame, spec }) {
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
  const mv = spec ?? (frame ? icon.motion : null);
  if (mv) moved = new Set((mv.parts ? indices(icon, mv.parts) : icon.d.map((_, i) => i)).map((i) => icon.d[i]));
  const tags = small ? new Map() : tagsOf(icon);
  let bdg = small ? (small.badge ?? null) : (icon.badge ?? null);
  const tiny = size && size <= 18;
  if (tiny && bdg) {
    // A 16 px: la insignia estándar usa su versión de pixel; una propia se ajusta al pixel
    if (bdg.kind && !small) bdg = badge(bdg.kind, { size });
    else if (!small) {
      const sn = snapper([...bdg.d, bdg.knock]);
      bdg = { d: bdg.d.map(sn), knock: sn(bdg.knock), ...(bdg.fill && { fill: Object.fromEntries(Object.entries(bdg.fill).map(([k, v]) => [k, v.map(sn)])) }) };
    }
  }
  if (tiny && !small) {
    const sn = snapper([...d, ...Object.values(fill ?? {}).flat()]);
    for (const [p, t] of [...tags]) tags.set(sn(p), t);
    d = d.map(sn);
    if (fill) fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)]));
    moved = moved && new Set([...moved].map(sn));
  }
  const badgeOut = bdg;
  return { d, fill, moved, tags, badge: badgeOut };
}

/**
 * El efecto que se anima y sus datos. `effect`: 'auto' (el gesto propio del ícono; si no tiene,
 * niveles si los tiene, si no rebote), uno de MOTION ('ring', 'wiggle', 'spin', 'beat', 'slide',
 * 'float', 'bounce') o uno genérico: 'draw' (se dibuja trazo por trazo) o 'levels'.
 */
export function effectOf(icon, effect = 'auto') {
  if (effect && effect !== 'auto') return effect;
  return icon.motion?.effect ?? (icon.levels ? 'levels' : 'bounce');
}
function motionSpec(icon, effect) {
  const e = effectOf(icon, effect);
  if (icon.motion?.effect === e) return { ...icon.motion };
  // Genéricos: todo el ícono, pivote al centro y un salto corto hacia arriba
  return { effect: e, origin: [12, 12], vector: e === 'slide' ? [2, 0] : [0, -2] };
}
/** Pivote y desplazamiento de un grupo animado, como variables CSS (ver engine/motion.css). */
const motionStyle = ({ origin = [12, 12], vector = [0, -2] }) => `transform-origin:${f(origin[0])}px ${f(origin[1])}px;--dx:${f(vector[0])}px;--dy:${f(vector[1])}px`;

/** Transformación SVG del cuadro extremo de cada efecto (ver DESIGN.md › Movimiento). */
export function motionTransform({ effect, origin = [12, 12], vector = [0, -2] }) {
  const [ox, oy] = origin;
  if (effect === 'ring' || effect === 'wiggle') return `rotate(${effect === 'ring' ? 18 : 10} ${ox} ${oy})`;
  if (effect === 'spin') return `rotate(90 ${ox} ${oy})`;
  if (effect === 'beat') return `translate(${ox} ${oy}) scale(1.18) translate(${-ox} ${-oy})`;
  if (effect === 'slide' || effect === 'float' || effect === 'bounce') return `translate(${vector[0]} ${vector[1]})`;
  return '';
}

export function render(icon, { style = 'outline', enclosure = null, slash = false, weight = 1.5, id = 'i', size, rtl = false, value, frame = false, animate = null } = {}) {
  const enc = enclosure ? ENCLOSURES[enclosure] : null;
  // Animación: el efecto pedido con sus datos (piezas, pivote, desplazamiento)
  const spec = animate && !enc ? motionSpec(icon, animate) : null;
  const r = resolve(icon, { size, value, frame, spec });
  if (r.badge) {
    // Los puntos que tocan el área de la insignia salen enteros (contorno y relleno)
    const gone = new Set(r.d.filter((d) => { const c = asCircle(d); return c && c.r < 1 && dotInKnock(c, r.badge.knock, weight); }));
    if (gone.size) {
      r.d = r.d.filter((d) => !gone.has(d));
      if (r.fill) r.fill = Object.fromEntries(Object.entries(r.fill).map(([k, v]) => [k, v.filter((d) => !gone.has(d))]));
    }
  }
  icon = { ...icon, d: r.d, fill: r.fill ?? undefined };
  // Al animar, cada trazo visible lleva pathLength=1 y su orden de dibujo (--i) y nivel (--l)
  const order = new Map(icon.d.map((d, i) => [d, i]));
  const lvl = (d) => (r.tags.get(d) ?? '').match(/data-level="(\d+)"/)?.[1];
  const anim = (d) => (spec ? ` pathLength="1" style="--i:${order.get(d) ?? 0}${lvl(d) ? `;--l:${lvl(d)}` : ''}"` : '');
  const paths = (ds) => ds.map((d) => `<path d="${d}"${r.tags.get(d) ?? ''}${anim(d)}/>`).join('');
  const k = enc ? enc.scale : 1;
  const fill = style === 'fill' && icon.fill ? icon.fill : null;
  const g = (ds) => (enc ? shrink(ds, k) : ds);
  const black = (ds, w = weight) => ds.map((d) => `<path d="${d}" fill="none" stroke="black" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const maskOf = (name, content) => `<mask id="${id}-${name}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${content}</mask>`;
  const defs = [];
  const body = [];
  // Cuadro extremo del movimiento (hojas de revisión): las piezas que se mueven y, si la insignia
  // se mueve, también su recorte
  const t = frame && icon.motion ? motionTransform(icon.motion) : '';
  const mv = t ? icon.motion : spec;
  // Lo que se mueve va en un grupo: con el cuadro extremo (hojas) o con la clase de la animación
  const wrapAttr = t ? ` transform="${t}"` : spec ? ` class="gota-m" style="${motionStyle(spec)}"` : '';
  const badgeMoves = Boolean(wrapAttr) && (mv?.parts ?? []).includes('badge');
  const moving = (ds) => (wrapAttr && r.moved?.size ? [ds.filter((p) => !r.moved.has(p)), ds.filter((p) => r.moved.has(p))] : [ds, []]);
  const split = (ds, draw) => {
    const [still, go] = moving(ds);
    return `${draw(still)}${go.length ? `<g${wrapAttr}>${draw(go)}</g>` : ''}`;
  };
  // Recortes: el tachado (aplica a todo) y el área de la insignia (aplica a la base)
  const slashCut = slash ? `<path d="${SLASH}" stroke="black" stroke-width="${f(weight + 3)}" stroke-linecap="round"/>` : '';
  const kn = r.badge ? g([r.badge.knock])[0] : null;
  const knockCut = kn ? (badgeMoves ? `<g${wrapAttr}>` : '') + `<path d="${kn}" fill="black" stroke="black" stroke-width="${f(weight + 3)}" stroke-linejoin="round"/>` + (badgeMoves ? '</g>' : '') : '';
  if (kn) defs.push(maskOf('k', knockCut));

  if (enc && style === 'fill') {
    // Encerrado y relleno: el contenedor sólido y el dibujo calado; cerca de la insignia la base no
    // se cala (el recorte de la insignia la despeja) y la insignia se cala completa
    const base = black(g(icon.d));
    const badge = r.badge ? black(g(r.badge.d)) : '';
    defs.push(maskOf('e', `${kn ? `<g mask="url(#${id}-k)">${base}</g>` : base}${badge}${slashCut}`));
    body.push(`<path d="${enc.shape}" fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linejoin="round" mask="url(#${id}-e)"/>`);
  } else {
    const content = [];
    if (enc) content.push(`<path d="${enc.shape}" ${strokeAttrs(weight)}/>`);
    if (fill) {
      // solid: se rellena y conserva su trazo · cut: se cala al ancho del trazo · lines: van encima
      // con 1.5 de aire · wire: van encima pegadas, sin aire (el arco de un candado, una aguja)
      defs.push(maskOf('f', `${split(g(fill.cut ?? []), (ds) => black(ds))}${split(g(fill.lines ?? []), (ds) => black(ds, weight + 3))}`));
      content.push(`<g fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-f)">${split(g(fill.solid), paths)}</g>`);
      const over = [...(fill.lines ?? []), ...(fill.wire ?? [])];
      if (over.length) content.push(`<g ${strokeAttrs(weight)}>${split(g(over), paths)}</g>`);
    } else content.push(`<g ${strokeAttrs(weight)}>${split(g(icon.d), paths)}</g>`);
    const base = content.join('');
    // La base queda bajo el recorte de la insignia; todo, bajo el del tachado
    let layer = kn ? `<g mask="url(#${id}-k)">${base}</g>` : base;
    if (r.badge) {
      const bf = style === 'fill' ? r.badge.fill : null;
      const move = badgeMoves ? wrapAttr : '';
      if (bf) {
        defs.push(maskOf('b', black(g(bf.cut ?? []))));
        layer += `<g data-part="badge"${move} fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-b)">${g(bf.solid).map((d) => `<path d="${d}"/>`).join('')}</g>`;
        if (bf.wire?.length) layer += `<g${move} ${strokeAttrs(weight)}>${g(bf.wire).map((d) => `<path d="${d}"/>`).join('')}</g>`;
      } else layer += `<g data-part="badge"${move} ${strokeAttrs(weight)}>${g(r.badge.d).map((d) => `<path d="${d}"/>`).join('')}</g>`;
    }
    if (slashCut) {
      defs.push(maskOf('s', slashCut));
      layer = `<g mask="url(#${id}-s)">${layer}</g>`;
    }
    body.push(layer);
  }
  if (slash) body.push(`<path d="${SLASH}" ${strokeAttrs(weight)}/>`);
  let inner = body.join('');
  // Espejo para idiomas de derecha a izquierda (solo los íconos direccionales)
  if (rtl && icon.mirror) inner = `<g transform="matrix(-1 0 0 1 24 0)">${inner}</g>`;
  return `${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${inner}`;
}

/** El archivo SVG; los íconos direccionales llevan data-rtl="mirror" para voltearse en árabe o hebreo. */
export const svgFile = (inner, icon, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"${icon?.mirror ? ' data-rtl="mirror"' : ''}${extra}>${inner}</svg>\n`;
/** Atributos del <svg> animado: la clase de Gota, el efecto y cuándo se reproduce (hover, loop, once). */
export const motionAttrs = (icon, effect = 'auto', play = 'hover') => ` class="gota" data-effect="${effectOf(icon, effect)}" data-play="${play}"`;
