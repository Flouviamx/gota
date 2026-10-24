// Controles y formularios (controls and forms): text fields and their states, selects, choices,
// switches, sliders, buttons, chips, pickers, ratings, codes, and form layouts. Everything is
// computed with engine/geometry.mjs; see DESIGN.md.
//
// One base for each family, so a variant reads by its mark and never by a slightly different
// base: the FIELD (a 19 × 12 container with the signature corner: text inputs, selects, codes),
// the PILL (the switch's track from sistema: switches, buttons, segmented controls) and the CHIP (a
// short pill: tokens, filters, status labels). Every field-based icon is the FIELD, search fields
// included. Marks live in the field's two ends, inside its 6-tall band (centerlines from 9 to 15,
// 1.5 of paper from the edges). Status and actions go in the engine's badges; a pictogram too large
// for the band (a copy, a calendar, a person, a tag, a paint drop) is a custom piece in the badge's
// place, and the engine clears the base around it.
import { arc, badge, circ, cursor, dot, f, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────
const P = ([x, y]) => `${f(x)} ${f(y)}`;
const BR = { square: ['br'] };
/** Container with the signature corner: a square bottom-right corner. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Horizontal capsule: the same construction as sistema's switch track. */
const pill = (x, y, w, h) => {
  const r = h / 2;
  return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
};
/** Vertical capsule. */
const vpill = (x, y, w, h) => {
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
};
/** Chevron centered on (cx, cy), `w` wide and `h` deep, pointing down (or up). */
const chevron = (cx, cy, w, h, up = false) => {
  const s = up ? -1 : 1;
  return line([cx - w / 2, cy - (s * h) / 2], [cx, cy + (s * h) / 2], [cx + w / 2, cy - (s * h) / 2]);
};
/** An x: two strokes crossing at (cx, cy), each arm `a` along both axes. */
const ex = (cx, cy, a) => [line([cx - a, cy - a], [cx + a, cy + a]), line([cx + a, cy - a], [cx - a, cy + a])];
/** A check `w` wide, its corner low and left of center, as in the engine's check badge. */
const check = (cx, cy, w) => line([cx - w * 0.5, cy + w * 0.04], [cx - w * 0.15, cy + w * 0.38], [cx + w * 0.5, cy - w * 0.34]);
/** A plus with arms of `a`. */
const plus = (cx, cy, a) => [vl(cx, cy - a, cy + a), hl(cx - a, cx + a, cy)];
/** A closed outline that retraces an open polyline: the area a custom badge clears around it. */
const retrace = (pts) => `M${pts.map(P).join('L')}${pts.length > 2 ? `L${pts.slice(1, -1).reverse().map(P).join('L')}` : ''}Z`;
/** A custom piece in the badge's place: the engine clears the base around `knock`. */
const piece = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

// The continuous corner of the engine's sq() (Figma's smoothing, 0.6), to find the middle of a
// rounded corner: a stroke that starts there touches the outline exactly (an envelope's flap).
function cornerInset(r, s = 0.6) {
  const p = (1 + s) * r;
  const a90 = 90 * (1 - s);
  const L = Math.sin(((a90 / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a90) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  // Distance from the corner point to the middle of its arc, along each side
  const sag = r - Math.sqrt(r * r - (L * L) / 2);
  return d + L / 2 - sag / Math.SQRT2;
}

// ── Dashed outlines ───────────────────────────────────────────────────────────────────────
// Every path is a solid stroke, so a dashed outline is drawn as separate dashes: the outline is
// sampled and cut into equal dashes with a gap of 3 between their ends (the 1.5 of clearance
// between pieces); each dash is a polyline that follows the curve (straight runs are merged).
function samples(d, step = 0.2) {
  const tk = d.match(/[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const pts = [];
  let i = 0;
  let cmd = '';
  let cur = [0, 0];
  let start = [0, 0];
  const n = () => Number.parseFloat(tk[i++]);
  const push = (p) => pts.push(p);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const o = rel ? cur : [0, 0];
    if (C === 'Z') {
      push(start);
      cur = start;
      continue;
    }
    if (C === 'M') {
      cur = start = [o[0] + n(), o[1] + n()];
      push(cur);
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      cur = [o[0] + n(), o[1] + n()];
      push(cur);
    } else if (C === 'H') {
      cur = [(rel ? cur[0] : 0) + n(), cur[1]];
      push(cur);
    } else if (C === 'V') {
      cur = [cur[0], (rel ? cur[1] : 0) + n()];
      push(cur);
    } else if (C === 'C') {
      const [a, b, e] = [[o[0] + n(), o[1] + n()], [o[0] + n(), o[1] + n()], [o[0] + n(), o[1] + n()]];
      const p0 = cur;
      const m = Math.max(4, Math.ceil(Math.hypot(e[0] - p0[0], e[1] - p0[1]) / step) * 2);
      for (let k = 1; k <= m; k++) {
        const t = k / m;
        const u = 1 - t;
        push([u * u * u * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0], u * u * u * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1]]);
      }
      cur = e;
    } else if (C === 'A') {
      let [rx] = [n(), n()];
      n();
      const large = n();
      const sweep = n();
      const e = [o[0] + n(), o[1] + n()];
      const p0 = cur;
      // Endpoints to center (circular arcs only)
      const hx = (p0[0] - e[0]) / 2;
      const hy = (p0[1] - e[1]) / 2;
      const h2 = hx * hx + hy * hy;
      if (h2 > rx * rx) rx = Math.sqrt(h2);
      const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, (rx * rx - h2) / h2));
      const c = [k * hy + (p0[0] + e[0]) / 2, -k * hx + (p0[1] + e[1]) / 2];
      const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
      let da = Math.atan2(e[1] - c[1], e[0] - c[0]) - a0;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      const m = Math.max(4, Math.ceil((Math.abs(da) * rx) / step));
      for (let q = 1; q <= m; q++) push([c[0] + rx * Math.cos(a0 + (da * q) / m), c[1] + rx * Math.sin(a0 + (da * q) / m)]);
      cur = e;
    }
  }
  return pts;
}
/**
 * A closed outline as dashes about `dash` long with gaps of `gap`; `center` is a point of the
 * outline that falls in the middle of a dash (a square corner: a gap across it would be short).
 */
function dashed(d, { dash = 2.5, gap = 3, center } = {}) {
  const pts = samples(d);
  const acc = [0];
  for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const L = acc[acc.length - 1];
  const n = Math.max(1, Math.round(L / (dash + gap)));
  const per = L / n;
  let phase = 0;
  if (center) {
    let best = 0;
    pts.forEach((p, k) => {
      if (Math.hypot(p[0] - center[0], p[1] - center[1]) < Math.hypot(pts[best][0] - center[0], pts[best][1] - center[1])) best = k;
    });
    phase = (acc[best] - (per - gap) / 2) / per;
  }
  const at = (s) => {
    const t = ((s % L) + L) % L;
    let k = 1;
    while (k < acc.length - 1 && acc[k] < t) k++;
    const u = (t - acc[k - 1]) / (acc[k] - acc[k - 1] || 1);
    return { p: [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u], k };
  };
  const out = [];
  for (let q = 0; q < n; q++) {
    const s0 = (q + phase) * per;
    const s1 = s0 + per - gap;
    const run = [at(s0).p];
    for (let s = s0; ; ) {
      const t = ((s % L) + L) % L;
      let k = 1;
      while (k < acc.length - 1 && acc[k] <= t) k++;
      const next = acc[k] + (s - t);
      if (next >= s1) break;
      run.push(pts[k]);
      s = next + 1e-9;
    }
    run.push(at(s1).p);
    // Merge straight runs: drop a point that lies on the line between its neighbours
    const keep = run.filter((p, j) => {
      if (j === 0 || j === run.length - 1) return true;
      const [a, b] = [run[j - 1], run[j + 1]];
      return Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) > 1e-4;
    });
    const uniq = keep.filter((p, j) => j === 0 || Math.hypot(p[0] - keep[j - 1][0], p[1] - keep[j - 1][1]) > 0.004);
    out.push(line(...uniq));
  }
  return out;
}

// ── The bases ─────────────────────────────────────────────────────────────────────────────
// The field: 19 × 12 with the signature corner. Its marks stay in the band from 9 to 15.
const FIELD = box(2.5, 6, 19, 12, 3.5);
/** The text caret near the field's left end. */
const CARET = vl(6.75, 9, 15);
// The pill: the switch's track (sistema's toggle-on/off), for switches, buttons and segmented
// controls (never for a field: a search field is the field). Its marks stay within 3 of its two end
// centers (8.5, 12) and (15.5, 12).
const PILL = pill(2.5, 6, 19, 12);
/** The switch's knob (sistema: r 3, at 8.5 off and 15.5 on). */
const KNOB = (x) => circ(x, 12, 3);
// The chip: a short pill, 15.5 × 10. Its marks stay within 2 of its end centers (9.25, 12) and (14.75, 12).
const CHIP = pill(4.25, 7, 15.5, 10);
// The form's small field (4.25 tall, radius 1.5) for form layouts, and the form itself: edicion's
// `form` with the same measures, two labels and their fields.
const slot = (x, y, w) => box(x, y, w, 4.25, 1.5);
// Raised 0.5 for its badges: the pencil's end then stands clear of the first field at every weight.
const FORM = [hl(4.25, 10.25, 2.75), slot(3.25, 5.75, 17.5), hl(4.25, 10.25, 13), slot(3.25, 16, 17.5)];

// ── Marks for the field's ends ────────────────────────────────────────────────────────────
// The magnifier at the field's left end (the search fields are the field, not a capsule): lens
// r 2.25, handle at 45°, the same in all three so a variant reads by its other end.
const LENS = circ(8, 11.25, 2.25);
const HANDLE = line(polar(8, 11.25, 2.25, 45), [11.5, 14.75]);
/**
 * The core link laid flat (as calendario's calendar-link) at the height of the field's band: two
 * hooks with short straight runs, so they read as chain links and not as parentheses, and the bar
 * between them, its ends 2.9 from the hooks' ends.
 */
const LINK = ['M9.25 9.5H8A2.5 2.5 0 0 0 8 14.5H9.25', 'M14.75 9.5H16A2.5 2.5 0 0 1 16 14.5H14.75', hl(10.75, 13.25, 12)];
/**
 * comercio's price tag (a pentagon, its point up and left, and its eyelet) at `k` of its size,
 * centered on `c`.
 */
function priceTag(c, k) {
  const [L, H, nose] = [17.5 * k, 5.75 * k, 5.5 * k];
  const at = ([x, y]) => {
    const p = rot([x - L * 0.52, y], [0, 0], 45);
    return [p[0] + c[0], p[1] + c[1]];
  };
  const body = roundpoly([[0, 0], [nose, -H], [L, -H], [L, H], [nose, H]].map(at), [1.6, 1.4, 2.4, 2.4, 1.4].map((r) => r * k * 1.2));
  // The eyelet a dense dot, 1 further in than the point's shoulders so it stays apart at bold
  return { body, hole: dot(...at([nose + 1, 0]), 0.3) };
}
/**
 * The core person's shoulders at `k` of their size, standing on `by` and centered on `cx`: the
 * same curve, its bottom corners rounded and its crown flat.
 */
const shoulders = (cx, by, k) =>
  `M${P([cx - 5.65 * k, by])}H${f(cx + 5.65 * k)}A${f(1.6 * k)} ${f(1.6 * k)} 0 0 0 ${P([cx + 7.22 * k, by - 1.92 * k])}C${P([cx + 6.5 * k, by - 5.15 * k])} ${P([cx + 3.6 * k, by - 7 * k])} ${P([cx, by - 7 * k])}C${P([cx - 3.6 * k, by - 7 * k])} ${P([cx - 6.5 * k, by - 5.15 * k])} ${P([cx - 7.22 * k, by - 1.92 * k])}A${f(1.6 * k)} ${f(1.6 * k)} 0 0 0 ${P([cx - 5.65 * k, by])}Z`;
// Envelope (7 × 5.5) with its flap from the middle of each top corner.
const ENVELOPE = (() => {
  const [x, y, w, h, r] = [5.5, 9.25, 7, 5.5, 1.25];
  const u = cornerInset(r);
  return [box(x, y, w, h, r), line([x + u, y + u], [x + w / 2, y + h * 0.55], [x + w - u, y + u])];
})();
/** The lugares map pin: a circle and its two tangents meeting at the tip. */
const pin = ([cx, cy], r) => {
  const a = polar(cx, cy, r, 45);
  const b = polar(cx, cy, r, 135);
  return `M${P(a)}A${f(r)} ${f(r)} 0 1 0 ${P(b)}L${P([cx, cy + r * Math.SQRT2])}Z`;
};
/** The same pin turned point up: a drop of paint (a color). */
const paintDrop = (cx, cy, r) => turnPath(pin([cx, cy], r), 180, [cx, cy]);

// ── Choices ───────────────────────────────────────────────────────────────────────────────
/**
 * A small checked box (7 or less a side holds no check with its clearance): the check runs out past
 * the top-right corner and goes in as a custom piece, so the engine clears the box around it.
 */
function checked(x, y, s) {
  // Its ends and corner stand where the clearance cuts the box the same at every weight
  const pts = [[x + 2, y + s / 2], [x + s / 2, y + s - 2], [x + s + 1, y - 1.25]];
  return { box: box(x, y, s, s, 2), badge: piece([line(...pts)], retrace(pts)) };
}
/** A wavy line from x0 to x1: half waves `h` long and `a` high (distorted characters). */
const wave = (x0, x1, y, a, h) => {
  let d = `M${P([x0, y])}Q${P([x0 + h / 2, y - 2 * a])} ${P([x0 + h, y])}`;
  for (let x = x0 + 2 * h; x <= x1 + 1e-6; x += h) d += `T${P([x, y])}`;
  return d;
};
// The select: the field with its value and a chevron at the right end; raised by 3.25 when it wears
// a badge, so the chevron stays clear of it at every weight.
const select = (dy = 0) => [box(2.5, 6 + dy, 19, 12, 3.5), hl(6.25, 11.25, 12 + dy), chevron(16.25, 12 + dy, 4, 2)];

// ── Pickers, ratings and codes ────────────────────────────────────────────────────────────
/** A five-point star: `ro` to its tips, `ri` to its inner corners (rounded 0.45 and 0.25). */
const star = (cx, cy, ro, ri) =>
  roundpoly(
    Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? ri : ro, -90 + i * 36)),
    Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.25 : 0.45)),
  );
/** An eye: two arcs meeting at its corners, from (x0, cy) to (x1, cy), `h` from the axis to each lid. */
const eye = (x0, x1, cy, h) => {
  const c = (x1 - x0) / 2;
  const r = (c * c + h * h) / (2 * h);
  return `M${P([x0, cy])}A${f(r)} ${f(r)} 0 0 1 ${P([x1, cy])}A${f(r)} ${f(r)} 0 0 1 ${P([x0, cy])}Z`;
};
// The password field: the base field and its dots (the engine drops any a badge touches)
const PASSWORD = (dy = 0) => [box(2.5, 6 + dy, 19, 12, 3.5), dot(6.75, 12 + dy), dot(10.75, 12 + dy), dot(14.75, 12 + dy)];
/** An open polyline with circular corners of radius `r` (connectors). */
function rline(pts, r) {
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, v, b] = [pts[i - 1], pts[i], pts[i + 1]];
    const u = [(a[0] - v[0]) / Math.hypot(a[0] - v[0], a[1] - v[1]), (a[1] - v[1]) / Math.hypot(a[0] - v[0], a[1] - v[1])];
    const w = [(b[0] - v[0]) / Math.hypot(b[0] - v[0], b[1] - v[1]), (b[1] - v[1]) / Math.hypot(b[0] - v[0], b[1] - v[1])];
    const cross = u[0] * w[1] - u[1] * w[0];
    d += `L${P([v[0] + u[0] * r, v[1] + u[1] * r])}A${f(r)} ${f(r)} 0 0 ${cross > 0 ? 0 : 1} ${P([v[0] + w[0] * r, v[1] + w[1] * r])}`;
  }
  return `${d}L${P(pts[pts.length - 1])}`;
}

const icons = {
  // ── Text fields ──
  input: {
    tags: ['campo de texto', 'entrada', 'escribir', 'text field', 'input', 'short answer'],
    d: [FIELD, CARET],
  },
  'input-search': {
    tags: ['barra de búsqueda', 'buscar', 'campo de búsqueda', 'search bar', 'search field', 'search input'],
    // The field with the magnifier at its left end and room after it for the query
    d: [FIELD, LENS, HANDLE],
  },
  'input-search-filter': {
    tags: ['buscar y filtrar', 'filtros', 'refinar búsqueda', 'search filter', 'filter button', 'refine'],
    // The funnel at the right end: a rounded triangle and its stem
    d: [FIELD, LENS, HANDLE, roundpoly([[13.5, 9.25], [18.5, 9.25], [16, 12.6]], [0.75, 0.75, 0.6]), vl(16, 12.1, 14.75)],
  },
  'input-search-shortcut': {
    tags: ['búsqueda rápida', 'atajo de teclado', 'paleta de comandos', 'command search', 'keyboard shortcut', 'cmd k'],
    // The keycap that sits at the right end of a Cmd-K bar, 2.9 clear of the handle's end
    d: [FIELD, LENS, HANDLE, sq(14, 9.75, 4.5, 4.5, 1.25)],
  },
  'input-clear': {
    tags: ['borrar campo', 'limpiar', 'vaciar', 'clear input', 'clearable', 'reset field'],
    d: [FIELD, CARET, ...ex(16.75, 12, 1.75)],
  },
  'input-focus': {
    tags: ['campo enfocado', 'foco', 'anillo de foco', 'focus ring', 'focused', 'keyboard focus'],
    // The ring follows the field 3 away: the inner field is 13 × 6 (radius 2) inside the ring (radius 5)
    d: [box(2.5, 6, 19, 12, 5), box(5.5, 9, 13, 6, 2)],
  },
  'input-check': {
    tags: ['campo válido', 'validado', 'correcto', 'valid field', 'validated', 'success'],
    d: [FIELD, CARET],
    badge: badge('check'),
  },
  'input-alert': {
    tags: ['campo con aviso', 'advertencia', 'revisar', 'field warning', 'attention', 'check value'],
    d: [FIELD, CARET],
    badge: badge('alert'),
  },
  'input-x': {
    tags: ['campo inválido', 'error de validación', 'incorrecto', 'invalid field', 'validation error', 'field error'],
    d: [FIELD, CARET],
    badge: badge('x'),
  },
  'input-lock': {
    tags: ['solo lectura', 'campo bloqueado', 'no editable', 'read only', 'locked field', 'disabled input'],
    d: [FIELD, CARET],
    badge: badge('lock'),
  },
  'input-plus': {
    tags: ['agregar campo', 'nueva pregunta', 'campo personalizado', 'add field', 'add question', 'custom field'],
    d: [FIELD, CARET],
    badge: badge('plus'),
  },
  'input-required': {
    tags: ['campo obligatorio', 'requerido', 'asterisco', 'required field', 'mandatory', 'asterisk'],
    // A six-arm asterisk over the field's top-right corner, which the engine clears
    d: [FIELD, CARET],
    badge: piece([-90, -30, 30].map((a) => line(polar(19.5, 4.5, 2.5, a), polar(19.5, 4.5, 2.5, a + 180))), circ(19.5, 4.5, 2.5)),
  },
  'input-number': {
    tags: ['campo numérico', 'número', 'cantidad', 'number input', 'spin box', 'numeric'],
    d: [FIELD, chevron(17, 9.75, 3, 1.5, true), chevron(17, 14.25, 3, 1.5)],
  },
  'input-currency': {
    tags: ['monto', 'precio', 'importe', 'amount', 'currency input', 'price field'],
    // The dollar sign in the badge's place (the band is too short for its two bowls)
    d: [FIELD, CARET],
    badge: piece(dollar(17.25, 17.25, 6.25, 4.5, 1), circ(17.25, 17.25, 4.25)),
  },
  'input-percent': {
    tags: ['porcentaje', 'tasa', 'descuento', 'percent input', 'percentage', 'rate'],
    d: [FIELD, dot(13.25, 9.75), dot(17.75, 14.25), line([13.25, 14.75], [17.75, 9.25])],
  },
  'input-email': {
    tags: ['campo de correo', 'email', 'correo electrónico', 'email field', 'email input', 'address'],
    d: [FIELD, ...ENVELOPE],
  },
  'input-phone': {
    tags: ['campo de teléfono', 'número telefónico', 'celular', 'phone field', 'phone number', 'tel input'],
    d: [FIELD, 'M7.1 9.1c.55-.3 1.2-.1 1.45.45l.55 1.2c.2.45.05.95-.3 1.25l-.4.35a5.5 5.5 0 0 0 1.95 1.95l.35-.4c.3-.35.8-.5 1.25-.3l1.2.55c.55.25.75.9.45 1.45-.6 1.05-1.85 1.45-3 .95A8.5 8.5 0 0 1 5.4 12.1c-.5-1.15-.1-2.4 1.7-3Z'],
  },
  'input-url': {
    tags: ['campo de enlace', 'sitio web', 'url', 'link field', 'website', 'url input'],
    // The link laid flat across the band (overlapping rings this small read as a scribble)
    d: [FIELD, ...LINK],
  },
  'input-location': {
    tags: ['campo de dirección', 'ubicación', 'autocompletar lugar', 'address field', 'location input', 'places'],
    d: [FIELD, pin([8.25, 11.4], 2.4)],
  },
  'input-date': {
    tags: ['campo de fecha', 'fecha', 'calendario', 'date field', 'date input', 'date picker'],
    // A calendar in the badge's place: its header and two rings that cross the top
    d: [FIELD, CARET],
    badge: (() => {
      const page = box(13, 13.5, 8.5, 8, 2);
      const rings = [vl(15.5, 12, 15), vl(19, 12, 15)];
      const header = hl(13, 21.5, 16.5);
      return piece([page, header, ...rings], box(13, 12, 8.5, 9.5, 2), { solid: [page], cut: [header], lines: rings });
    })(),
  },
  'input-time': {
    tags: ['campo de hora', 'hora', 'horario', 'time field', 'time input', 'time picker'],
    d: [FIELD, CARET],
    badge: badge('clock'),
  },
  'input-color': {
    tags: ['campo de color', 'hexadecimal', 'muestra de color', 'color field', 'hex', 'color input'],
    // The hex value in the field and the swatch, a drop of paint, in the badge's place (inside the
    // band the drop was a speck)
    d: [FIELD, hl(6.25, 10.5, 12)],
    badge: (() => {
      const swatch = paintDrop(17.25, 18.25, 3);
      return piece([swatch], swatch, { solid: [swatch] });
    })(),
  },
  'input-tags': {
    tags: ['campo de etiquetas', 'etiquetas', 'tokens', 'tag input', 'tags field', 'token input'],
    // comercio's price tag in the badge's place (a chip inside the band read as a segmented control)
    d: [FIELD, CARET],
    badge: (() => {
      const tag = priceTag([17, 17], 0.5);
      return piece([tag.body, tag.hole], tag.body, { solid: [tag.body], cut: [tag.hole] });
    })(),
  },
  'input-file': {
    tags: ['adjuntar archivo', 'subir archivo', 'elegir archivo', 'file input', 'attach file', 'upload field'],
    d: [FIELD, vl(16.5, 9, 12.15), line([14.75, 10.75], [16.5, 9], [18.25, 10.75]), hl(14.5, 18.5, 15)],
  },
  'input-submit': {
    tags: ['formulario en línea', 'suscribirse', 'enviar correo', 'inline form', 'newsletter', 'submit field'],
    // The button segment takes the right end, set off by a divider
    d: [FIELD, vl(13, 6, 18), hl(16, 18.5, 12), line([16.75, 10.25], [18.5, 12], [16.75, 13.75])],
  },
  'input-person': {
    tags: ['campo de persona', 'asignar', 'responsable', 'person field', 'assignee', 'user picker'],
    // The set's person (a head and the core's shoulders) in the badge's place: inside the band a dot
    // over an arc read as a frown
    d: [FIELD, CARET],
    badge: (() => {
      const head = circ(16.75, 13.25, 1.5);
      const body = shoulders(16.75, 21.5, 0.55);
      return piece([head, body], `${head}${body}`, { solid: [head, body] });
    })(),
  },
  'input-voice': {
    tags: ['dictado', 'búsqueda por voz', 'micrófono', 'voice input', 'dictation', 'voice search'],
    // The microphone in the badge's place: its capsule, the cradle and the stand
    d: [FIELD, CARET],
    badge: piece([vpill(16, 11.25, 2.5, 5), `${arc(17.25, 15, 4.25, 0, 180).d}M17.25 19.25V21.5`], 'M13 15A4.25 4.25 0 0 0 21.5 15L18.5 12.5A1.25 1.25 0 0 0 16 12.5Z'),
  },
  'inline-edit': {
    tags: ['editar en línea', 'renombrar', 'editar texto', 'inline edit', 'rename', 'edit in place'],
    d: [hl(3.25, 15.25, 8.5), ...[3.25, 8.25, 13.25].map((x) => hl(x, x + 2, 12.75))],
    badge: badge('edit'),
  },
  'input-loading': {
    tags: ['validando', 'cargando sugerencias', 'comprobando', 'input loading', 'checking', 'fetching'],
    d: [FIELD, arc(16.25, 12, 2.25, -90, 180).d],
  },
  'input-hint': {
    tags: ['texto de ayuda', 'pista', 'descripción del campo', 'helper text', 'hint', 'field description'],
    // The field raised and a short line under its left end (a long one read as a monitor's stand)
    d: [box(2.5, 4.25, 19, 12, 3.5), vl(6.75, 7.25, 13.25), hl(2.75, 8.75, 19.75)],
  },
  'input-hidden': {
    tags: ['campo oculto', 'valor oculto', 'parámetro', 'hidden field', 'hidden input', 'tracking'],
    d: dashed(FIELD, { center: [21.5, 18] }),
  },
  autofill: {
    tags: ['autocompletar', 'rellenar automáticamente', 'gestor de contraseñas', 'autofill', 'password manager', 'saved data'],
    // The value and a key: its bow (r 1.75, so its hole stays open at 18 px), its shaft and its bit
    d: [FIELD, hl(6.25, 9, 12), circ(13.75, 12, 1.75), line([15.5, 12], [18.5, 12], [18.5, 14.25])],
  },
  textarea: {
    tags: ['área de texto', 'texto largo', 'descripción', 'textarea', 'multi-line', 'long answer'],
    // Three lines of decreasing length and the resize grip in the square corner: two parallel
    // strokes 3 apart, 3 inside its edges
    d: [box(3.25, 3.25, 17.5, 17.5, 4), hl(7.25, 16.75, 7.75), hl(7.25, 13.5, 11), hl(7.25, 9.75, 14.25), line([15.25, 17.75], [17.75, 15.25]), line([12.26, 16.5], [16.5, 12.26])],
  },

  // ── Selects and lists ──
  select: {
    tags: ['desplegable', 'selector', 'elegir opción', 'select', 'dropdown', 'picker'],
    d: select(),
  },
  'select-open': {
    tags: ['desplegable abierto', 'opciones', 'lista de opciones', 'open dropdown', 'options', 'menu list'],
    // The field and its panel share an edge: the chevron up above, three options below and the
    // check beside the chosen one
    d: [box(4, 2.25, 16, 19.5, 3.5), hl(4, 20, 9.75), chevron(15.5, 6, 3, 1.5, true), hl(13.25, 17, 12.75), hl(13.25, 17, 15.75), hl(13.25, 15.5, 18.75), check(8.75, 15.75, 3.5)],
  },
  'select-search': {
    tags: ['selector con búsqueda', 'filtrar opciones', 'desplegable buscable', 'searchable select', 'filter options', 'autocomplete'],
    d: select(-3.25),
    badge: badge('search'),
  },
  'select-plus': {
    tags: ['crear opción', 'nueva etiqueta', 'agregar categoría', 'creatable select', 'add option', 'new tag'],
    d: select(-3.25),
    badge: badge('plus'),
  },
  combobox: {
    tags: ['cuadro combinado', 'sugerencias', 'escribir o elegir', 'combobox', 'suggestions', 'typeahead'],
    d: [FIELD, CARET, chevron(16.25, 12, 4, 2)],
  },
  listbox: {
    tags: ['lista de selección', 'opciones visibles', 'lista', 'listbox', 'list select', 'options list'],
    // Three rows; the chosen one sits in a band 3 from its line and from the others
    d: [box(4, 3, 16, 18, 3.5), hl(10, 15.5, 6), pill(7, 9, 10, 6), hl(10, 14, 12), hl(10, 13.25, 18)],
  },
  'transfer-list': {
    tags: ['lista de transferencia', 'mover elementos', 'doble lista', 'transfer list', 'dual list', 'move items'],
    d: [box(2.5, 3.25, 5, 17.5, 2), box(16.5, 3.25, 5, 17.5, 2), line([10.5, 6.25], [13.25, 9], [10.5, 11.75]), line([13.5, 13], [10.75, 15.75], [13.5, 18.5])],
  },

  // ── Checkboxes, radios and choices ──
  'checkbox-group': {
    tags: ['casillas', 'varias opciones', 'opción múltiple', 'checkboxes', 'multiple choice', 'check all that apply'],
    d: [checked(3.25, 3.75, 7).box, hl(13.75, 20.75, 7.25), box(3.25, 13.75, 7, 7, 2), hl(13.75, 18.5, 17.25)],
    badge: checked(3.25, 3.75, 7).badge,
  },
  'checkbox-tree': {
    tags: ['casillas anidadas', 'árbol de permisos', 'jerarquía', 'nested checkboxes', 'checkbox tree', 'permissions'],
    // The parent checked; the elbow runs from it to its two children
    d: [checked(4.25, 3.25, 7).box, 'M6 10.25V20H14.25M6 13.5H14.25', box(14.25, 11.5, 4, 4, 1.25), box(14.25, 18, 4, 4, 1.25)],
    badge: checked(4.25, 3.25, 7).badge,
  },
  'checkbox-consent': {
    tags: ['aceptar términos', 'consentimiento', 'suscribirse', 'accept terms', 'consent', 'opt in'],
    d: [checked(3.25, 5.25, 7).box, hl(14.25, 20.75, 7), hl(14.25, 20.75, 11.5), hl(14.25, 17.75, 16)],
    badge: checked(3.25, 5.25, 7).badge,
  },
  'checkbox-alert': {
    tags: ['casilla requerida', 'aceptar términos', 'error de casilla', 'required checkbox', 'unchecked error', 'consent required'],
    d: [box(3.25, 3.25, 17.5, 17.5, 4)],
    badge: badge('alert'),
  },
  'radio-group': {
    tags: ['opción única', 'botones de opción', 'elegir una', 'radio buttons', 'single choice', 'multiple choice question'],
    d: [circ(6.5, 7.25, 3.25), dot(6.5, 7.25), hl(12.75, 20.75, 7.25), circ(6.5, 16.75, 3.25), hl(12.75, 18, 16.75)],
  },
  'choice-grid': {
    tags: ['cuadrícula', 'matriz', 'escala por fila', 'grid question', 'matrix', 'likert grid'],
    // Two rows of three options; the chosen one in each row is a solid disc
    d: [circ(4.5, 7.75, 2.25), dot(12, 7.75, 1), circ(19.5, 7.75, 2.25), circ(4.5, 16.25, 2.25), circ(12, 16.25, 2.25), dot(19.5, 16.25, 1)],
  },
  'choice-card': {
    tags: ['tarjeta de opción', 'elegir plan', 'método de envío', 'choice card', 'plan picker', 'selectable card'],
    // A card as wide as the square keyline, so the radio (radio-group's, 3 from the top and right
    // edges) sits in its top-right corner and not in its middle (centered, it read as a speaker),
    // and the two lines of its text below
    d: [box(3.25, 2.75, 17.5, 18.5, 4), circ(14.5, 9, 3.25), dot(14.5, 9), hl(7.25, 15.75, 15.25), hl(7.25, 11.5, 18.25)],
  },
  'image-choice': {
    tags: ['elegir imagen', 'opción con foto', 'selección visual', 'picture choice', 'image options', 'visual choice'],
    // Each tile's mountain rises from its bottom edge and comes down on its right side
    d: [box(2.5, 5.5, 7.75, 9, 2), line([4, 14.5], [6.75, 10.5], [10.25, 14]), box(13.25, 5.5, 7.75, 9, 2), line([14.75, 14.5], [17.5, 10.5], [21, 14])],
    badge: badge('check'),
  },
  'yes-no': {
    tags: ['sí o no', 'pregunta binaria', 'aprobar o rechazar', 'yes no', 'binary choice', 'true false'],
    d: [PILL, vl(12, 6, 18), check(7.25, 12.25, 3.25), ...ex(16.25, 12, 1.25)],
  },
  ranking: {
    tags: ['ordenar', 'clasificación', 'preferencia', 'ranking', 'rank order', 'reorder'],
    d: [hl(3.25, 14, 6), hl(3.25, 11.75, 12), hl(3.25, 9.5, 18), vl(17.75, 8.25, 15.75), line([15.75, 10.25], [17.75, 8.25], [19.75, 10.25]), line([15.75, 13.75], [17.75, 15.75], [19.75, 13.75])],
  },
  captcha: {
    tags: ['captcha', 'no soy un robot', 'verificación humana', 'human check', 'bot protection', 'recaptcha'],
    d: [checked(3.25, 8.5, 7).box, wave(13.25, 20.75, 9.75, 1, 1.875), wave(13.25, 20.75, 14.75, 1, 1.875)],
    badge: checked(3.25, 8.5, 7).badge,
  },

  // ── Switches ──
  'toggle-mixed': {
    tags: ['interruptor mixto', 'parcial', 'indeterminado', 'mixed switch', 'partial', 'indeterminate toggle'],
    // The switch's track with its knob in the middle
    d: [PILL, KNOB(12)],
  },
  'toggle-lock': {
    tags: ['ajuste bloqueado', 'administrado', 'interruptor bloqueado', 'locked setting', 'managed', 'locked toggle'],
    // The knob off, on the left: switched on it would sit under the lock
    d: [PILL, KNOB(8.5)],
    badge: badge('lock'),
  },

  // ── Sliders and dials ──
  'slider-single': {
    tags: ['deslizador', 'control deslizante', 'volumen', 'slider', 'range slider', 'value slider'],
    // As the core `sliders`: the track meets the knob on both sides
    d: [hl(2.75, 12.5, 12), hl(17.5, 21.25, 12), circ(15, 12, 2.5)],
  },
  'slider-range': {
    tags: ['rango de precios', 'mínimo y máximo', 'filtro de rango', 'range slider', 'price filter', 'min max slider'],
    d: [hl(2.5, 4.75, 12), hl(9.75, 14.25, 12), hl(19.25, 21.5, 12), circ(7.25, 12, 2.5), circ(16.75, 12, 2.5)],
  },
  'slider-steps': {
    tags: ['deslizador por pasos', 'niveles', 'escala', 'stepped slider', 'steps', 'discrete slider'],
    d: [hl(3.25, 9.5, 9.5), hl(14.5, 20.75, 9.5), circ(12, 9.5, 2.5), ...[3.25, 7.625, 12, 16.375, 20.75].map((x) => vl(x, 15, 17))],
  },
  'slider-histogram': {
    tags: ['histograma de precios', 'distribución', 'filtro de precio', 'histogram slider', 'price distribution', 'range filter'],
    // Four bars standing 3 above the range slider's knobs
    d: [vl(5.5, 8.5, 12), vl(9.75, 4.5, 12), vl(14.25, 6.5, 12), vl(18.5, 9, 12), hl(2.5, 4.75, 17.5), hl(9.75, 14.25, 17.5), hl(19.25, 21.5, 17.5), circ(7.25, 17.5, 2.5), circ(16.75, 17.5, 2.5)],
  },
  'slider-value': {
    tags: ['valor del deslizador', 'globo de valor', 'etiqueta de valor', 'slider value', 'value label', 'tooltip slider'],
    // slider-single lowered, and its value on a label centered over the knob (ventanas' tooltip
    // card, its value line inside; the drop beside the knob read as a person)
    d: [hl(2.75, 12.5, 17.5), hl(17.5, 21.25, 17.5), circ(15, 17.5, 2.5), box(10.25, 3.5, 9.5, 6.5, 2.5), hl(13.25, 16.75, 6.75)],
  },
  'slider-vertical': {
    tags: ['deslizador vertical', 'volumen', 'brillo', 'vertical slider', 'fader', 'brightness'],
    d: [hl(2.75, 12.5, 12), hl(17.5, 21.25, 12), circ(15, 12, 2.5)].map((d) => turnPath(d, -90)),
  },
  'slider-radial': {
    tags: ['deslizador circular', 'termostato', 'temporizador', 'radial slider', 'circular slider', 'dial'],
    // Three quarters of a circle open at the bottom; the arc meets the knob on both sides
    d: [arc(12, 13, 8.25, 135, 312.6).d, arc(12, 13, 8.25, 347.4, 405).d, circ(...polar(12, 13, 8.25, 330), 2.5)],
  },
  knob: {
    tags: ['perilla', 'potenciómetro', 'girar', 'knob', 'rotary', 'dial'],
    // The indicator runs from the rim toward the center, and the arc around the knob shows how far it
    // has been turned, from 7:30 to the indicator (an audio knob's ring). Ticks around it read as
    // a stopwatch's buttons or an alarm clock's feet.
    d: [circ(12, 13, 5.5), line(polar(12, 13, 5.5, 300), polar(12, 13, 2.25, 300)), arc(12, 13, 8.75, 135, 300).d],
  },

  // ── Buttons ──
  button: {
    tags: ['botón', 'llamada a la acción', 'pulsar', 'button', 'call to action', 'cta'],
    // The pill raised so the engine's pointer fits below it, pressing its lower right
    d: [pill(2.5, 3.5, 19, 12), hl(9, 15, 9.5)],
    badge: piece([cursor([15.5, 12.5], 0.5)], cursor([15.5, 12.5], 0.5), { solid: [cursor([15.5, 12.5], 0.5)] }),
  },
  'button-group': {
    tags: ['grupo de botones', 'botones unidos', 'barra de botones', 'button group', 'toolbar', 'joined buttons'],
    d: [PILL, vl(8.83, 6, 18), vl(15.17, 6, 18)],
  },
  'button-split': {
    tags: ['botón dividido', 'más acciones', 'acción principal', 'split button', 'more actions', 'menu button'],
    d: [PILL, vl(12.75, 6, 18), hl(5.75, 9.75, 12), chevron(16.9, 12, 2.5, 1.25)],
  },
  'button-dropdown': {
    tags: ['botón con menú', 'desplegable', 'filtro con opciones', 'menu button', 'dropdown button', 'filter menu'],
    d: [PILL, hl(6.5, 11.5, 12), chevron(16, 12, 3, 1.5)],
  },
  'button-loading': {
    tags: ['botón cargando', 'enviando', 'procesando', 'button loading', 'submitting', 'busy button'],
    d: [PILL, arc(12, 12, 2.75, -90, 180).d],
  },
  'button-floating': {
    tags: ['botón flotante', 'acción principal', 'crear', 'floating action button', 'fab', 'primary action'],
    // The screen's bottom-right corner (square: the signature) and the round button with its plus
    d: [line([21, 3.25], [21, 21], [3.25, 21]), circ(12.5, 12.5, 5.25), ...plus(12.5, 12.5, 2.25)],
  },
  'segmented-control': {
    tags: ['control segmentado', 'pestañas', 'modo de vista', 'segmented control', 'toggle group', 'view switcher'],
    // The chosen segment is a pill 3 inside the track's left end; the other two split by a divider
    d: [PILL, pill(5.5, 9, 8, 6), vl(17.25, 10, 14)],
  },
  'number-stepper': {
    tags: ['contador', 'cantidad', 'más y menos', 'stepper', 'quantity', 'increment'],
    // The minus and the plus in the pill's two ends (the value has no room between them)
    d: [PILL, hl(6.75, 10.25, 12), ...plus(15.5, 12, 1.75)],
  },
  'slide-to-confirm': {
    tags: ['deslizar para confirmar', 'deslizar para pagar', 'desbloquear', 'slide to confirm', 'swipe to pay', 'slide to unlock'],
    // The knob at the start and the arrow that shows where to drag it
    d: [PILL, KNOB(8.5), hl(14.5, 18.4, 12), line([16.9, 10.5], [18.4, 12], [16.9, 13.5])],
  },

  // ── Chips ──
  chip: {
    tags: ['chip', 'ficha', 'etiqueta removible', 'chip', 'token', 'removable tag'],
    d: [CHIP, hl(7.5, 10.75, 12), ...ex(14.75, 12, 1.25)],
  },
  'chip-selected': {
    tags: ['filtro activo', 'chip seleccionado', 'filtro aplicado', 'selected chip', 'active filter', 'filter on'],
    d: [CHIP, check(9.4, 12.1, 3.4), hl(14.1, 16.25, 12)],
  },
  'chip-avatar': {
    tags: ['chip de persona', 'destinatario', 'mención', 'person chip', 'recipient', 'mention'],
    d: [CHIP, circ(9.25, 12, 2), hl(14.25, 16.5, 12)],
  },
  'chip-add': {
    tags: ['agregar filtro', 'agregar etiqueta', 'agregar persona', 'add chip', 'add filter', 'add tag'],
    d: [...dashed(CHIP), ...plus(12, 12, 1.75)],
  },
  'chip-group': {
    tags: ['grupo de chips', 'filtros', 'temas', 'chip group', 'filters', 'suggestions'],
    d: [pill(2.5, 4.5, 9, 6), pill(14.5, 4.5, 7, 6), pill(6.5, 13.5, 15, 6)],
  },
  'status-label': {
    tags: ['etiqueta de estado', 'estado', 'activo', 'status label', 'status badge', 'status pill'],
    d: [CHIP, dot(9.25, 12), hl(13, 16.5, 12)],
  },

  // ── Pickers ──
  'date-picker': {
    tags: ['selector de fecha', 'calendario desplegable', 'elegir fecha', 'date picker', 'calendar popover', 'choose date'],
    // As select-open, the field and its panel in one: the date in the field's row and, below the
    // divider, two rows of days with the chosen one ringed (r 1.5 holds its hole at 18 px; the days
    // stand 4.8 from it so a pixel of paper is left). A short field apart from the panel read as a
    // tab, and the panel under it as a cash register.
    d: (() => {
      const days = [];
      for (const y of [13.25, 18.05]) for (const x of [7.3, 12, 16.7]) if (!(x === 12 && y === 13.25)) days.push(dot(x, y, 0.3));
      return [box(4, 2.75, 16, 18.5, 3.5), hl(4, 20, 8.75), hl(7.25, 11.75, 5.75), circ(12, 13.25, 1.5), ...days];
    })(),
  },
  'time-picker': {
    tags: ['selector de hora', 'reloj', 'elegir hora', 'time picker', 'clock dial', 'choose time'],
    // Four ticks on the rim and a hand that ends in the ring you drag
    d: [circ(12, 12, 9), ...[-90, 0, 90, 180].map((a) => line(polar(12, 12, 9, a), polar(12, 12, 7, a))), line([12, 12], polar(12, 12, 3, -45)), circ(...polar(12, 12, 4.5, -45), 1.5)],
  },
  'wheel-picker': {
    tags: ['rueda de selección', 'selector móvil', 'desplazar valores', 'wheel picker', 'scroll picker', 'spinner picker'],
    // The chosen value in its band; the others shrink toward the edges
    d: [pill(2.5, 8.75, 19, 6.5), hl(6, 18, 12), hl(7.75, 16.25, 5.75), hl(9.75, 14.25, 2.75), hl(7.75, 16.25, 18.25), hl(9.75, 14.25, 21.25)],
  },
  'color-picker': {
    tags: ['selector de color', 'espectro', 'tono', 'color picker', 'spectrum', 'hue'],
    // The spectrum with its ring handle, and the hue slider beside it (a track and its knob)
    d: [box(2.75, 5.25, 13.5, 13.5, 3.5), circ(11.5, 10, 1.75), vl(20.5, 5.25, 7.5), vl(20.5, 10.5, 18.75), circ(20.5, 9, 1.5)],
  },
  'color-swatches': {
    tags: ['muestras de color', 'paleta', 'variantes de color', 'color swatches', 'palette', 'color options'],
    // The chosen swatch circled by a ring 3 away
    d: [circ(7.25, 7.25, 2.25), circ(7.25, 7.25, 5.25), circ(17.75, 7.25, 2.25), circ(7.25, 17.75, 2.25), circ(17.75, 17.75, 2.25)],
  },
  dropzone: {
    tags: ['zona de carga', 'arrastrar archivos', 'soltar aquí', 'dropzone', 'drag and drop', 'upload area'],
    d: [...dashed(box(2.5, 5, 19, 14, 4), { center: [21.5, 19] }), vl(12, 8.25, 15.75), line([9, 11.25], [12, 8.25], [15, 11.25])],
  },
  'avatar-upload': {
    tags: ['foto de perfil', 'cambiar avatar', 'subir foto', 'avatar upload', 'profile photo', 'change picture'],
    // The person in their circle (comunicacion's person-circle) and a camera in the badge's place
    d: [circ(12, 12, 9), circ(12, 9.5, 3.25), arc(12, 21.25, 6.25, 202.17, 337.83).d],
    badge: (() => {
      // The body and its viewfinder in one outline (a separate hump changed with the weight)
      const body = roundpoly([[13, 15], [15.5, 15], [16.25, 13.25], [18.5, 13.25], [19.25, 15], [21.75, 15], [21.75, 21.5], [13, 21.5]], [2, 0.5, 0.6, 0.6, 0.5, 2, 0, 2]);
      const lens = dot(17.375, 18.25);
      return piece([body, lens], body, { solid: [body], cut: [lens] });
    })(),
  },

  // ── Ratings ──
  'rating-stars': {
    tags: ['calificación', 'estrellas', 'reseña', 'star rating', 'rating', 'review'],
    d: [star(5, 13.25, 3.25, 1.6), star(12, 10.25, 3.25, 1.6), star(19, 13.25, 3.25, 1.6)],
  },
  'rating-emoji': {
    tags: ['satisfacción', 'caritas', 'encuesta de satisfacción', 'emoji rating', 'csat', 'feedback'],
    // Two faces drawn by their features: a frown and a smile
    d: [dot(5, 9.5), dot(8.5, 9.5), arc(6.75, 17.75, 3, 210, 330).d, dot(15.5, 9.5), dot(19, 9.5), arc(17.25, 12.25, 3, 30, 150).d],
  },
  'rating-scale': {
    tags: ['escala de opinión', 'nps', 'escala likert', 'opinion scale', 'linear scale', 'likert'],
    // Three points over the scale's line; the chosen one is a solid disc
    d: [circ(4.5, 10, 2.25), circ(12, 10, 2.25), dot(19.5, 10, 1), hl(2.5, 21.5, 16)],
  },

  // ── Codes and passwords ──
  'one-time-code': {
    tags: ['código de verificación', 'código de un solo uso', 'otp', 'one-time code', 'verification code', 'otp input'],
    // The field split into cells (three: four leave no room for a digit): two digits typed, the caret in the next
    d: [FIELD, vl(8.83, 6, 18), vl(15.17, 6, 18), dot(5.67, 12), dot(12, 12), vl(18.33, 9, 15)],
  },
  passcode: {
    tags: ['código de acceso', 'pin', 'bloqueo', 'passcode', 'pin entry', 'lock screen'],
    // Two digits typed (solid) and two to go (rings)
    d: [dot(3.5, 12, 1), dot(9.17, 12, 1), circ(14.83, 12, 1.5), circ(20.5, 12, 1.5)],
  },
  'password-strength': {
    tags: ['seguridad de contraseña', 'contraseña débil', 'medidor', 'password strength', 'strength meter', 'weak password'],
    d: [...PASSWORD(-2.5), hl(2.5, 7.5, 19.5), hl(10.5, 15.5, 19.5), hl(18.5, 20.5, 19.5)],
  },
  'password-reveal': {
    tags: ['mostrar contraseña', 'ver contraseña', 'revelar', 'show password', 'reveal', 'password visibility'],
    // The eye in the badge's place, its pupil a dot
    d: PASSWORD().slice(0, 3),
    badge: (() => {
      const lids = eye(13, 21.5, 17.25, 3);
      return piece([lids, dot(17.25, 17.25)], lids, { solid: [lids], cut: [dot(17.25, 17.25)] });
    })(),
  },
  'password-reset': {
    tags: ['restablecer contraseña', 'cambiar contraseña', 'olvidé mi contraseña', 'reset password', 'change password', 'forgot password'],
    d: PASSWORD(),
    badge: badge('sync'),
  },
  'validation-rules': {
    tags: ['requisitos', 'reglas de contraseña', 'validación', 'requirements', 'password rules', 'validation'],
    d: [check(6, 7.75, 5), hl(11.5, 20.75, 7.75), ...ex(6, 16.25, 1.75), hl(11.5, 18, 16.25)],
  },

  // ── Forms ──
  'form-check': {
    tags: ['formulario enviado', 'formulario completo', 'listo', 'form submitted', 'form complete', 'sent'],
    d: FORM,
    badge: badge('check'),
  },
  'form-alert': {
    tags: ['errores en el formulario', 'revisar formulario', 'campos con error', 'form errors', 'form warning', 'fix fields'],
    d: FORM,
    badge: badge('alert'),
  },
  'form-plus': {
    tags: ['nuevo formulario', 'crear formulario', 'agregar formulario', 'new form', 'create form', 'add form'],
    d: FORM,
    badge: badge('plus'),
  },
  'form-lock': {
    tags: ['formulario cerrado', 'no acepta respuestas', 'bloqueado', 'form closed', 'locked form', 'closed survey'],
    d: FORM,
    badge: badge('lock'),
  },
  'form-edit': {
    tags: ['editar formulario', 'modificar campos', 'diseñar formulario', 'edit form', 'form builder', 'modify form'],
    d: FORM,
    badge: badge('edit'),
  },
  'form-gear': {
    tags: ['ajustes del formulario', 'configurar formulario', 'opciones', 'form settings', 'form options', 'configure form'],
    d: FORM,
    badge: badge('gear'),
  },
  'form-columns': {
    tags: ['formulario en columnas', 'dos columnas', 'diseño de formulario', 'two-column form', 'form layout', 'columns'],
    d: [hl(4.25, 8.25, 3.25), slot(3.25, 6.25, 7.25), hl(14.5, 18.5, 3.25), slot(13.5, 6.25, 7.25), hl(4.25, 10.25, 13.5), slot(3.25, 16.5, 17.5)],
  },
  'form-inline': {
    tags: ['formulario horizontal', 'etiquetas al lado', 'formulario en línea', 'horizontal form', 'inline labels', 'form layout'],
    d: [hl(3.25, 6.75, 8.375), slot(9.75, 6.25, 11), hl(3.25, 6.75, 15.625), slot(9.75, 13.5, 11)],
  },
  'input-key-value': {
    tags: ['clave y valor', 'variables de entorno', 'metadatos', 'key value', 'environment variables', 'headers'],
    // A short key and a long value in each row (nearly equal, the four read as a grid of tiles)
    d: [slot(3.25, 6.25, 4.5), slot(10.75, 6.25, 10), slot(3.25, 13.5, 4.5), slot(10.75, 13.5, 10)],
  },
  fieldset: {
    tags: ['grupo de campos', 'sección del formulario', 'leyenda', 'fieldset', 'field group', 'legend'],
    // The frame's top edge breaks for the legend near its left end, as in a form (centered, the gap
    // read as a notepad's): the legend 3 from the frame on each side
    d: [box(3.25, 4.5, 17.5, 16, 2.25).replace(/Z$/, '').replace(/^M/, 'M16.35 4.5L'), hl(9.85, 13.35, 4.5), hl(6.25, 17.75, 10), hl(6.25, 13.5, 15)],
  },
  'form-steps': {
    tags: ['formulario por pasos', 'asistente', 'varios pasos', 'multi-step form', 'wizard', 'form steps'],
    // The steps across the top (the first one current, solid) and the step's fields below
    d: [dot(5.25, 4.5, 1), hl(6.25, 10.5, 4.5), circ(12, 4.5, 1.5), hl(13.5, 17.25, 4.5), circ(18.75, 4.5, 1.5), slot(4, 9.25, 16), slot(4, 16.5, 16)],
  },
  'form-login': {
    tags: ['iniciar sesión', 'formulario de acceso', 'correo y contraseña', 'sign in', 'login form', 'log in'],
    d: [box(4, 2.5, 16, 5, 1.75), box(4, 10.5, 16, 5, 1.75), ...[7.25, 10.25, 13.25].map((x) => dot(x, 13, 0.3)), pill(4, 18.5, 7.5, 3.25)],
  },
  'form-logic': {
    tags: ['lógica condicional', 'ramificación', 'saltar preguntas', 'conditional logic', 'branching', 'skip logic'],
    // The question's connector forks into the two fields that can follow it
    d: [slot(6.75, 2.75, 10.5), vl(12, 7, 11.75), rline([[6.25, 16.5], [6.25, 11.75], [17.75, 11.75], [17.75, 16.5]], 1.5), slot(2.5, 16.5, 7.5), slot(14, 16.5, 7.5)],
  },
  survey: {
    tags: ['encuesta', 'cuestionario', 'responder', 'survey', 'questionnaire', 'poll'],
    // A page with two answers: the chosen one solid
    d: [box(4.75, 2.75, 14.5, 18.5, 3.75), dot(9.25, 9, 1), hl(13.75, 16.25, 9), circ(9.25, 15, 1.5), hl(13.75, 16.25, 15)],
  },
  accordion: {
    tags: ['acordeón', 'secciones plegables', 'preguntas frecuentes', 'accordion', 'collapsible', 'faq'],
    // Three rows: the open one taller, holding its text; the chevron on the first
    d: [box(4.25, 2.25, 15.5, 19.5, 3.5), hl(4.25, 19.75, 9.75), hl(4.25, 19.75, 17.75), chevron(14.5, 6, 3, 1.5), hl(7.25, 12, 13.75)],
  },
  'progress-steps': {
    tags: ['indicador de pasos', 'progreso', 'pasos del pago', 'step indicator', 'progress steps', 'checkout steps'],
    // As form-steps' row: the current step a solid disc, the ones to come rings, the line between
    // them touching both (a dot inside a ring this small was lost at 18 px and closed at bold)
    d: [dot(4, 12, 1), hl(5, 9, 12), circ(11.25, 12, 2.25), hl(13.5, 16.5, 12), circ(18.75, 12, 2.25)],
  },
};

/** The comercio dollar sign, compact: an S of two half ellipses and its stubs. */
function dollar(cx, cy, h, w, stub) {
  const ry = h / 4;
  const rx = w / 2;
  const at = (c, deg) => [c[0] + rx * Math.cos((deg * Math.PI) / 180), c[1] + ry * Math.sin((deg * Math.PI) / 180)];
  const up = [cx, cy - ry];
  const lo = [cx, cy + ry];
  const T0 = [cx, cy - h / 2];
  const B0 = [cx, cy + h / 2];
  const R = `${f(rx)} ${f(ry)}`;
  return [
    `M${P([cx, T0[1] - stub])}L${P(T0)}A${R} 0 0 0 ${P([cx, cy])}A${R} 0 0 1 ${P(B0)}L${P([cx, B0[1] + stub])}`,
    `M${P(T0)}A${R} 0 0 1 ${P(at(up, -28))}`,
    `M${P(B0)}A${R} 0 0 1 ${P(at(lo, 152))}`,
  ];
}

// ── Fill (DESIGN.md › Fill), by index into d ──────────────────────────────────────────────
// `solid` is filled (closed shapes only), `cut` knocked out, `lines` stays a line with a clearance of
// paper, `wire` stays a line flush with the fill. Badges bring their own.
const FILL = {
  input: { solid: [0], cut: [1] },
  'input-search': { solid: [0], cut: [1, 2] },
  'input-search-filter': { solid: [0], cut: [1, 2, 3, 4] },
  'input-search-shortcut': { solid: [0], cut: [1, 2, 3] },
  'input-clear': { solid: [0], cut: [1, 2, 3] },
  'input-focus': { solid: [1], lines: [0] },
  'input-number': { solid: [0], cut: [1, 2] },
  'input-percent': { solid: [0], cut: [1, 2, 3] },
  'input-email': { solid: [0], cut: [1, 2] },
  'input-phone': { solid: [0], cut: [1] },
  'input-url': { solid: [0], cut: [1, 2, 3] },
  'input-location': { solid: [0], cut: [1] },
  'input-color': { solid: [0], cut: [1] },
  'input-tags': { solid: [0], cut: [1] },
  'input-file': { solid: [0], cut: [1, 2, 3] },
  'input-submit': { solid: [0], cut: [1, 2, 3] },
  'input-person': { solid: [0], cut: [1] },
  'input-loading': { solid: [0], cut: [1] },
  'input-hint': { solid: [0], cut: [1], lines: [2] },
  autofill: { solid: [0], cut: [1, 2, 3] },
  textarea: { solid: [0], cut: [1, 2, 3, 4, 5] },
  select: { solid: [0], cut: [1, 2] },
  'select-open': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'select-search': { solid: [0], cut: [1, 2] },
  'select-plus': { solid: [0], cut: [1, 2] },
  combobox: { solid: [0], cut: [1, 2] },
  listbox: { solid: [0], cut: [1, 2, 3, 4] },
  'transfer-list': { solid: [0, 1], lines: [2, 3] },
  'checkbox-group': { solid: [0, 2], lines: [1, 3] },
  'checkbox-tree': { solid: [0, 2, 3], wire: [1] },
  'checkbox-consent': { solid: [0], lines: [1, 2, 3] },
  'checkbox-alert': { solid: [0] },
  'radio-group': { solid: [0, 3], cut: [1], lines: [2, 4] },
  'choice-card': { solid: [0], cut: [1, 2, 3, 4] },
  'image-choice': { solid: [0, 2], cut: [1, 3] },
  'yes-no': { solid: [0], cut: [1, 2, 3, 4] },
  captcha: { solid: [0], lines: [1, 2] },
  'toggle-mixed': { solid: [0], cut: [1] },
  'toggle-lock': { solid: [0], cut: [1] },
  'slider-single': { solid: [2], wire: [0, 1] },
  'slider-range': { solid: [3, 4], wire: [0, 1, 2] },
  'slider-steps': { solid: [2], wire: [0, 1], lines: [3, 4, 5, 6, 7] },
  'slider-histogram': { solid: [7, 8], wire: [4, 5, 6], lines: [0, 1, 2, 3] },
  'slider-value': { solid: [2, 3], wire: [0, 1], cut: [4] },
  'slider-vertical': { solid: [2], wire: [0, 1] },
  'slider-radial': { solid: [2], wire: [0, 1] },
  knob: { solid: [0], cut: [1], lines: [2] },
  button: { solid: [0], cut: [1] },
  'button-group': { solid: [0], cut: [1, 2] },
  'button-split': { solid: [0], cut: [1, 2, 3] },
  'button-dropdown': { solid: [0], cut: [1, 2] },
  'button-loading': { solid: [0], cut: [1] },
  'button-floating': { solid: [1], cut: [2, 3], lines: [0] },
  'segmented-control': { solid: [0], cut: [1, 2] },
  'number-stepper': { solid: [0], cut: [1, 2, 3] },
  'slide-to-confirm': { solid: [0], cut: [1, 2, 3] },
  chip: { solid: [0], cut: [1, 2, 3] },
  'chip-selected': { solid: [0], cut: [1, 2] },
  'chip-avatar': { solid: [0], cut: [1, 2] },
  'chip-group': { solid: [0, 1, 2] },
  'status-label': { solid: [0], cut: [1, 2] },
  'date-picker': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] },
  'time-picker': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'wheel-picker': { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
  'color-picker': { solid: [0, 4], cut: [1], wire: [2, 3] },
  'color-swatches': { solid: [0, 2, 3, 4], lines: [1] },
  'avatar-upload': { solid: [0], cut: [1, 2] },
  'rating-stars': { solid: [0, 1, 2] },
  'one-time-code': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'password-strength': { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6] },
  'password-reveal': { solid: [0], cut: [1, 2] },
  'password-reset': { solid: [0], cut: [1, 2, 3] },
  'form-columns': { solid: [1, 3, 5], lines: [0, 2, 4] },
  'form-inline': { solid: [1, 3], lines: [0, 2] },
  'input-key-value': { solid: [0, 1, 2, 3] },
  'form-steps': { solid: [0, 2, 4, 5, 6], wire: [1, 3] },
  'form-login': { solid: [0, 1, 5], cut: [2, 3, 4] },
  'form-logic': { solid: [0, 3, 4], wire: [1, 2] },
  survey: { solid: [0], cut: [1, 2, 3, 4] },
  accordion: { solid: [0], cut: [1, 2, 3, 4] },
};
for (const name of ['input-check', 'input-alert', 'input-x', 'input-lock', 'input-plus', 'input-required', 'input-time', 'input-currency', 'input-date', 'input-voice']) FILL[name] = { solid: [0], cut: [1] };
// The form keeps edicion's fill: its fields solid, its labels lines
for (const name of ['form-check', 'form-alert', 'form-plus', 'form-lock', 'form-edit', 'form-gear']) FILL[name] = { solid: [1, 3], lines: [0, 2] };
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// Open lines, dashes and bare marks: their filled version is the outline itself (a dashed outline
// can't be filled, and the fieldset's frame is open for its legend). Rows of options and steps too:
// their state is a solid disc among rings, and filling the rings would erase it.
for (const name of ['inline-edit', 'input-hidden', 'ranking', 'chip-add', 'dropzone', 'rating-emoji', 'validation-rules', 'fieldset', 'choice-grid', 'rating-scale', 'passcode', 'progress-steps'])
  icons[name].fill = false;

// ── Named parts ───────────────────────────────────────────────────────────────────────────
const all = (name) => icons[name].d.map((_, i) => i);
const PARTS = {
  input: { field: [0], caret: [1] },
  'input-search': { field: [0], lens: [1], handle: [2] },
  'input-search-filter': { field: [0], lens: [1], handle: [2], filter: [3, 4] },
  'input-search-shortcut': { field: [0], lens: [1], handle: [2], key: [3] },
  'input-clear': { field: [0], caret: [1], mark: [2, 3] },
  'input-focus': { ring: [0], field: [1] },
  'input-number': { field: [0], up: [1], down: [2] },
  'input-percent': { field: [0], mark: [1, 2, 3] },
  'input-email': { field: [0], envelope: [1, 2] },
  'input-phone': { field: [0], handset: [1] },
  'input-url': { field: [0], link: [1, 2, 3] },
  'input-location': { field: [0], pin: [1] },
  'input-color': { field: [0], value: [1] },
  'input-tags': { field: [0], caret: [1] },
  'input-file': { field: [0], arrow: [1, 2], base: [3] },
  'input-submit': { field: [0], divider: [1], arrow: [2, 3] },
  'input-person': { field: [0], caret: [1] },
  'inline-edit': { text: [0], underline: [1, 2, 3] },
  'input-loading': { field: [0], spinner: [1] },
  'input-hint': { field: [0], caret: [1], hint: [2] },
  'input-hidden': { field: all('input-hidden') },
  autofill: { field: [0], value: [1], key: [2, 3] },
  textarea: { field: [0], text: [1, 2, 3], grip: [4, 5] },
  select: { field: [0], value: [1], chevron: [2] },
  'select-open': { field: [0], divider: [1], chevron: [2], options: [3, 4, 5], mark: [6] },
  'select-search': { field: [0], value: [1], chevron: [2] },
  'select-plus': { field: [0], value: [1], chevron: [2] },
  combobox: { field: [0], caret: [1], chevron: [2] },
  listbox: { frame: [0], options: [1, 3, 4], highlight: [2] },
  'transfer-list': { available: [0], chosen: [1], arrows: [2, 3] },
  'checkbox-group': { box: [0, 2], labels: [1, 3] },
  'checkbox-tree': { parent: [0], branch: [1], children: [2, 3] },
  'checkbox-consent': { box: [0], text: [1, 2, 3] },
  'checkbox-alert': { box: [0] },
  'radio-group': { radio: [0, 3], dot: [1], labels: [2, 4] },
  'choice-grid': { options: [0, 2, 3, 4], chosen: [1, 5] },
  'choice-card': { card: [0], radio: [1], dot: [2], text: [3, 4] },
  'image-choice': { tiles: [0, 2], mountains: [1, 3] },
  'yes-no': { bar: [0], divider: [1], yes: [2], no: [3, 4] },
  ranking: { items: [0, 1, 2], arrow: [3, 4, 5] },
  captcha: { box: [0], text: [1, 2] },
  'toggle-mixed': { track: [0], knob: [1] },
  'toggle-lock': { track: [0], knob: [1] },
  'slider-single': { track: [0, 1], knob: [2] },
  'slider-range': { track: [0, 1, 2], knob: [3, 4] },
  'slider-steps': { track: [0, 1], knob: [2], ticks: [3, 4, 5, 6, 7] },
  'slider-histogram': { bars: [0, 1, 2, 3], track: [4, 5, 6], knob: [7, 8] },
  'slider-value': { track: [0, 1], knob: [2], bubble: [3], value: [4] },
  'slider-vertical': { track: [0, 1], knob: [2] },
  'slider-radial': { track: [0, 1], knob: [2] },
  knob: { dial: [0], indicator: [1], level: [2] },
  button: { body: [0], label: [1] },
  'button-group': { body: [0], dividers: [1, 2] },
  'button-split': { body: [0], divider: [1], label: [2], chevron: [3] },
  'button-dropdown': { body: [0], label: [1], chevron: [2] },
  'button-loading': { body: [0], spinner: [1] },
  'button-floating': { screen: [0], button: [1], mark: [2, 3] },
  'segmented-control': { track: [0], selected: [1], divider: [2] },
  'number-stepper': { body: [0], minus: [1], plus: [2, 3] },
  'slide-to-confirm': { track: [0], knob: [1], arrow: [2, 3] },
  chip: { body: [0], label: [1], mark: [2, 3] },
  'chip-selected': { body: [0], mark: [1], label: [2] },
  'chip-avatar': { body: [0], avatar: [1], label: [2] },
  'chip-add': { body: all('chip-add').slice(0, -2), mark: all('chip-add').slice(-2) },
  'chip-group': { chips: [0, 1, 2] },
  'status-label': { body: [0], dot: [1], label: [2] },
  'date-picker': { panel: [0], divider: [1], value: [2], selected: [3], days: all('date-picker').slice(4) },
  'time-picker': { dial: [0], ticks: [1, 2, 3, 4], hand: [5, 6] },
  'wheel-picker': { band: [0], selected: [1], values: [2, 3, 4, 5] },
  'color-picker': { spectrum: [0], handle: [1], track: [2, 3], knob: [4] },
  'color-swatches': { swatches: [0, 2, 3, 4], ring: [1] },
  dropzone: { area: all('dropzone').slice(0, -2), arrow: all('dropzone').slice(-2) },
  'avatar-upload': { frame: [0], person: [1, 2] },
  'rating-stars': { stars: [0, 1, 2] },
  'rating-emoji': { sad: [0, 1, 2], happy: [3, 4, 5] },
  'rating-scale': { options: [0, 1], chosen: [2], scale: [3] },
  'one-time-code': { field: [0], dividers: [1, 2], digits: [3, 4], caret: [5] },
  passcode: { filled: [0, 1], empty: [2, 3] },
  'password-strength': { field: [0], dots: [1, 2, 3], level: [4, 5, 6] },
  'password-reveal': { field: [0], dots: [1, 2] },
  'password-reset': { field: [0], dots: [1, 2, 3] },
  'form-columns': { labels: [0, 2, 4], fields: [1, 3, 5] },
  'form-inline': { labels: [0, 2], fields: [1, 3] },
  'input-key-value': { keys: [0, 2], values: [1, 3] },
  fieldset: { frame: [0], legend: [1], fields: [2, 3] },
  'form-steps': { steps: [0, 1, 2, 3, 4], fields: [5, 6] },
  'form-login': { fields: [0, 1], dots: [2, 3, 4], button: [5] },
  'form-logic': { question: [0], branch: [1, 2], fields: [3, 4] },
  survey: { page: [0], chosen: [1], options: [2, 3, 4] },
  accordion: { frame: [0], dividers: [1, 2], chevron: [3], content: [4] },
  'progress-steps': { current: [0], line: [1, 3], steps: [2, 4] },
  'validation-rules': { pass: [0], rules: [1, 4], fail: [2, 3] },
};
for (const name of ['input-check', 'input-alert', 'input-x', 'input-lock', 'input-plus', 'input-required', 'input-time', 'input-currency', 'input-date', 'input-voice']) PARTS[name] = { field: [0], caret: [1] };
for (const name of ['form-check', 'form-alert', 'form-plus', 'form-lock', 'form-edit', 'form-gear']) PARTS[name] = { labels: [0, 2], fields: [1, 3] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────
const BC = [17.25, 17.25];
const MOTION = {
  'input-search': { effect: 'wiggle', parts: ['lens', 'handle'], origin: [8, 11.25] },
  'input-phone': { effect: 'ring', parts: ['handset'], origin: [8.75, 12] },
  'input-location': { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] },
  'input-file': { effect: 'bounce', parts: ['arrow'], vector: [0, -1.5] },
  'input-submit': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'input-loading': { effect: 'spin', parts: ['spinner'], origin: [16.25, 12] },
  'input-time': { effect: 'spin', parts: ['badge'], origin: BC },
  'inline-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'form-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'form-gear': { effect: 'spin', parts: ['badge'], origin: BC },
  'password-reset': { effect: 'spin', parts: ['badge'], origin: BC },
  'button-loading': { effect: 'spin', parts: ['spinner'], origin: [12, 12] },
  button: { effect: 'bounce', parts: ['badge'], vector: [-1, -1] },
  'slide-to-confirm': { effect: 'slide', parts: ['knob'], vector: [2.5, 0] },
  'time-picker': { effect: 'spin', parts: ['hand'], origin: [12, 12] },
  dropzone: { effect: 'bounce', parts: ['arrow'], vector: [0, -2] },
  'rating-stars': { effect: 'beat', origin: [12, 12] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Levels and values ─────────────────────────────────────────────────────────────────────
// Quantities: the strength bars and the stars light up from the first
icons['password-strength'].levels = [[4], [5], [6]];
icons['rating-stars'].levels = [[0], [1], [2]];
// The knob's ring is drawn as far as the value and its indicator turns with it, from 7:30 up to
// where it is drawn (the full value); the picker's hand goes round
icons.knob.value = { draw: ['level'], turn: { parts: ['indicator'], origin: [12, 13], from: 135, to: 300, at: 300 } };
icons['time-picker'].value = { turn: { parts: ['hand'], origin: [12, 12], from: -90, to: 270, at: -45 } };

// ── Mirroring (DESIGN.md › Mirroring) ─────────────────────────────────────────────────────
// What reads from the start: a field's caret, value and trailing marks, lists of options, sliders
// that grow, switches, the start of a sequence (steps, scales, digits typed)
for (const name of [
  'input', 'input-search', 'input-search-filter', 'input-search-shortcut', 'input-clear', 'input-check', 'input-alert', 'input-x', 'input-lock', 'input-plus',
  'input-required', 'input-number', 'input-currency', 'input-percent', 'input-email', 'input-phone', 'input-url', 'input-location', 'input-date', 'input-time',
  'input-color', 'input-tags', 'input-file', 'input-submit', 'input-person', 'input-voice', 'inline-edit', 'input-loading', 'input-hint', 'autofill',
  'textarea', 'select', 'select-open', 'select-search', 'select-plus', 'combobox', 'listbox', 'transfer-list', 'checkbox-group', 'checkbox-tree',
  'checkbox-consent', 'radio-group', 'choice-card', 'yes-no', 'ranking', 'captcha', 'toggle-lock', 'slider-single', 'slider-range', 'slider-steps',
  'slider-histogram', 'slider-value', 'button-split', 'button-dropdown', 'button-floating', 'segmented-control', 'number-stepper', 'slide-to-confirm',
  'chip', 'chip-selected', 'chip-avatar', 'status-label', 'date-picker', 'rating-emoji', 'rating-scale', 'one-time-code', 'passcode', 'password-strength',
  'password-reveal', 'password-reset', 'validation-rules', 'form-inline', 'input-key-value', 'form-steps', 'form-login', 'survey', 'accordion', 'progress-steps',
])
  icons[name].mirror = true;

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already enclosed
off(['time-picker', 'avatar-upload'], { circle: false });
off(['textarea', 'checkbox-alert', 'select-open', 'listbox', 'accordion'], { square: false });
// A slash says nothing through loose marks, spinners and switches (as in sistema), or through a
// field that is already hidden
off(['passcode', 'ranking', 'validation-rules', 'rating-emoji', 'input-hidden', 'input-loading', 'button-loading', 'toggle-mixed', 'toggle-lock', 'slide-to-confirm'], { slash: false });

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────
// At 16 px a pixel measures 1.5 and pixel centers fall at 0.75 + 1.5k: these drawings are made on
// that grid (g(column, row) is a pixel's center), with fewer pieces and a pixel of space between
// them. The field grows to 10 pixels so its marks get 6 rows; the pill and the chip are on the same
// grid (a capsule whose height spans an even or odd number of pixels lands its ends on pixels).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...cr) => line(...cr.map(([c, r]) => g(c, r)));
const pbox = (c0, r0, c1, r1, rad = 1.5, square = ['br']) => sq(px(c0), px(r0), 1.5 * (c1 - c0), 1.5 * (r1 - r0), rad, { square });
const ppill = (c0, r0, c1, r1) => pill(px(c0), px(r0), 1.5 * (c1 - c0), 1.5 * (r1 - r0));
/** A ring `n` pixels across centered on (c, r): x.5 puts the center on a pixel edge. */
const pring = (c, r, n) => circ(px(c), px(r), (1.5 * (n - 1)) / 2);
/** A one-pixel dot and a 2 × 2 one (the latter on the pixel edges at (c, r)). */
const p1 = (c, r) => dot(px(c), px(r), 0.25);
const p2 = (c, r) => dot(1.5 * c, 1.5 * r, 1);
const F16 = pbox(1, 3, 14, 12, 3);
const C16 = pl([3, 5], [3, 10]);
const P16 = ppill(1, 3, 14, 12);
const CHIP16 = ppill(2, 4, 13, 11);
// The lens a 4-pixel square ring (a 4-pixel circle grays out), its handle a diagonal run
const LENS16 = [pbox(3, 5, 6, 8, 0.75, []), pl([6, 8], [8, 10])];
const RING = circ(17.25, 17.25, 4.25);
/** A small version: `spec` picks the fill by index into d; `badge` a pixel badge. */
const sm = (d, spec, extra = {}) => {
  const pick = (ix) => ix.map((i) => d[i]);
  const fill = spec && { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
  return { d, ...(fill && { fill }), ...extra };
};
/** A custom piece at 16 px: like the engine's, it clears the badge's circle plus the piece. */
const piece16 = (d, fill) => ({ d, knock: `${RING}${d.join('')}`, ...(fill && { fill }) });
/** The small checked box: the check runs past the box's top-right corner, cleared like at 24 px. */
const checked16 = (c, r, n) => {
  const pts = [g(c + 1, r + 2), g(c + 2, r + 3), g(c + n + 1, r - 1)];
  return { box: pbox(c, r, c + n - 1, r + n - 1, 1.2), badge: { d: [line(...pts)], knock: retrace(pts) } };
};
const b16 = (kind) => badge(kind, { size: 16 });

const SMALL = {
  'input-search': sm([F16, ...LENS16], { solid: [0], cut: [1, 2] }),
  'input-search-filter': sm([F16, ...LENS16, `M${P(g(8, 5))}H${f(px(12))}L${P(g(10, 7))}Z`, pl([10, 7], [10, 10])], { solid: [0], cut: [1, 2, 3, 4] }),
  'input-search-shortcut': sm([F16, ...LENS16, pbox(10, 6, 12, 8, 0.75, [])], { solid: [0], cut: [1, 2, 3] }),
  'input-clear': sm([F16, C16, pl([9, 6], [12, 9]), pl([12, 6], [9, 9])], { solid: [0], cut: [1, 2, 3] }),
  'input-required': sm([F16, C16], { solid: [0], cut: [1] }, { badge: piece16([pl([12, 0.5], [12, 4.5]), pl([10, 1], [14, 4]), pl([14, 1], [10, 4])]) }),
  'input-number': sm([F16, pl([9, 6], [10, 5], [11, 6]), pl([9, 9], [10, 10], [11, 9])], { solid: [0], cut: [1, 2] }),
  'input-currency': sm([F16, C16], { solid: [0], cut: [1] }, { badge: piece16([pl([12, 9], [10, 9], [10, 11], [12, 11], [12, 13], [10, 13]), pl([11, 8], [11, 9]), pl([11, 13], [11, 14])]) }),
  'input-percent': sm([F16, p2(7, 6), pl([7, 10], [11, 6]), p2(12, 10)], { solid: [0], cut: [1, 2, 3] }),
  'input-email': sm([F16, pbox(3, 5, 9, 10, 1.5), pl([4, 6], [6, 8], [8, 6])], { solid: [0], cut: [1, 2] }),
  'input-phone': sm([F16, pl([5, 6], [4, 5], [3, 6], [3, 8], [5, 10], [6, 10], [7, 9], [6, 8])], { solid: [0], cut: [1] }),
  'input-url': sm([F16, pl([5, 5], [4, 5], [3, 6], [3, 8], [4, 9], [5, 9]), pl([10, 5], [11, 5], [12, 6], [12, 8], [11, 9], [10, 9]), pl([7, 7], [8, 7])], { solid: [0], cut: [1, 2, 3] }),
  'input-location': sm([F16, roundpoly([g(4, 5), g(6, 5), g(7, 6), g(7, 7), g(5, 9), g(3, 7), g(3, 6)], 0.3)], { solid: [0], cut: [1] }),
  'input-date': sm([F16, C16], { solid: [0], cut: [1] }, { badge: piece16([pbox(9, 9, 14, 14, 1.5), pl([9, 11], [14, 11]), pl([10, 8], [10, 9]), pl([13, 8], [13, 9])]) }),
  'input-color': sm([F16, pl([3, 7], [6, 7])], { solid: [0], cut: [1] }, {
    badge: (() => {
      const swatch = roundpoly([g(11, 9), g(13, 11), g(13, 13), g(12, 14), g(10, 14), g(9, 13), g(9, 11)], 0.3);
      return piece16([swatch], { solid: [swatch] });
    })(),
  }),
  'input-tags': sm([F16, C16], { solid: [0], cut: [1] }, {
    badge: (() => {
      const tag = roundpoly([g(8, 8), g(11, 8), g(14, 11), g(11, 14), g(8, 11)], 0.3);
      return piece16([tag, p1(10, 10)], { solid: [tag], cut: [p1(10, 10)] });
    })(),
  }),
  'input-file': sm([F16, pl([10, 5], [10, 8]), pl([8, 7], [10, 5], [12, 7]), pl([8, 10], [12, 10])], { solid: [0], cut: [1, 2, 3] }),
  'input-submit': sm([F16, pl([8, 3], [8, 12]), pl([10, 7], [12, 7]), pl([11, 6], [12, 7], [11, 8])], { solid: [0], cut: [1, 2, 3] }),
  'input-person': sm([F16, C16], { solid: [0], cut: [1] }, {
    badge: (() => {
      const [head, body] = [pring(11, 9, 3), roundpoly([g(9, 14), g(9, 13), g(10, 12), g(12, 12), g(13, 13), g(13, 14)], 0.3)];
      return piece16([head, body], { solid: [head, body] });
    })(),
  }),
  'input-voice': sm([F16, C16], { solid: [0], cut: [1] }, { badge: piece16([vpill(px(10), px(8), 3, 4.5), `${arc(px(11), px(11), 3, 0, 180).d}M${P(g(11, 13))}V${f(px(14))}`]) }),
  'input-loading': sm([F16, pl([10, 6], [9, 7], [9, 8], [10, 9], [11, 9], [12, 8], [12, 7])], { solid: [0], cut: [1] }),
  autofill: sm([F16, pl([3, 7], [5, 7]), pring(8, 7, 3), pl([10, 7], [12, 7], [12, 9])], { solid: [0], cut: [1, 2, 3] }),
  textarea: sm([pbox(2, 2, 13, 13, 3), pl([4, 5], [10, 5]), pl([4, 7], [8, 7]), pl([4, 9], [6, 9]), pl([10, 11], [11, 10]), pl([8, 11], [11, 8])], { solid: [0], cut: [1, 2, 3, 4, 5] }),
  select: sm([F16, pl([3, 7], [6, 7]), pl([8, 6], [10, 8], [12, 6])], { solid: [0], cut: [1, 2] }),
  'select-open': sm([pbox(2, 1, 13, 14, 2), pl([2, 6], [13, 6]), pl([9, 4], [10, 3], [11, 4]), pl([8, 8], [11, 8]), pl([8, 10], [11, 10]), pl([8, 12], [10, 12]), pl([3, 10], [4, 11], [6, 9])], { solid: [0], cut: [1, 2, 3, 4, 5, 6] }),
  'select-search': sm([pbox(1, 1, 14, 10, 3), pl([3, 5], [6, 5]), pl([8, 4], [10, 6], [12, 4])], { solid: [0], cut: [1, 2] }, { badge: b16('search') }),
  'select-plus': sm([pbox(1, 1, 14, 10, 3), pl([3, 5], [6, 5]), pl([8, 4], [10, 6], [12, 4])], { solid: [0], cut: [1, 2] }, { badge: b16('plus') }),
  combobox: sm([F16, C16, pl([8, 6], [10, 8], [12, 6])], { solid: [0], cut: [1, 2] }),
  listbox: sm([pbox(2, 1, 13, 13, 2), pl([6, 3], [10, 3]), ppill(4, 5, 11, 9), pl([6, 7], [9, 7]), pl([6, 11], [8, 11])], { solid: [0], cut: [1, 2, 3, 4] }),
  'transfer-list': sm([pbox(1, 2, 4, 13, 1.2), pbox(11, 2, 14, 13, 1.2), pl([6, 3], [8, 5], [6, 7]), pl([9, 8], [7, 10], [9, 12])], { solid: [0, 1], lines: [2, 3] }),
  'radio-group': sm([pring(4, 4, 5), p1(4, 4), pl([8, 4], [13, 4]), pring(4, 11, 5), pl([8, 11], [12, 11])], { solid: [0, 3], cut: [1], lines: [2, 4] }),
  'choice-card': sm([pbox(2, 1, 13, 14, 2), pring(9, 5, 5), p1(9, 5), pl([4, 10], [11, 10]), pl([4, 12], [7, 12])], { solid: [0], cut: [1, 2, 3, 4] }),
  'image-choice': sm([pbox(1, 3, 6, 9, 1.2), pl([2, 9], [4, 6], [6, 8]), pbox(8, 3, 13, 9, 1.2), pl([9, 9], [11, 6], [13, 8])], { solid: [0, 2], cut: [1, 3] }, { badge: b16('check') }),
  'yes-no': sm([P16, pl([7, 3], [7, 12]), pl([3, 7], [4, 8], [6, 6]), pl([9, 6], [11, 8]), pl([11, 6], [9, 8])], { solid: [0], cut: [1, 2, 3, 4] }),
  ranking: sm([pl([1, 3], [9, 3]), pl([1, 8], [7, 8]), pl([1, 13], [5, 13]), pl([12, 4], [12, 12]), pl([10, 6], [12, 4], [14, 6]), pl([10, 10], [12, 12], [14, 10])], null),
  knob: sm([pring(7, 8, 7), pl([9, 6], [8, 7]), arc(px(7), px(8), 7.5, 135, 300).d], { solid: [0], cut: [1], lines: [2] }),
  button: sm([ppill(1, 1, 14, 9), pl([5, 5], [9, 5])], { solid: [0], cut: [1] }, { badge: { d: [cursor(g(10, 7), 0.45)], knock: cursor(g(10, 7), 0.45), fill: { solid: [cursor(g(10, 7), 0.45)] } } }),
  'button-split': sm([P16, pl([9, 3], [9, 12]), pl([4, 7], [6, 7]), pl([10, 7], [11, 8], [12, 7])], { solid: [0], cut: [1, 2, 3] }),
  'button-dropdown': sm([P16, pl([4, 7], [7, 7]), pl([9, 7], [10, 8], [11, 7])], { solid: [0], cut: [1, 2] }),
  'button-loading': sm([P16, pl([7, 6], [6, 7], [6, 8], [7, 9], [8, 9], [9, 8], [9, 7])], { solid: [0], cut: [1] }),
  'segmented-control': sm([P16, ppill(3, 6, 8, 9), pl([11, 6], [11, 9])], { solid: [0], cut: [1, 2] }),
  'number-stepper': sm([P16, pl([3, 7], [5, 7]), pl([11, 6], [11, 8]), pl([10, 7], [12, 7])], { solid: [0], cut: [1, 2, 3] }),
  'slide-to-confirm': sm([P16, pring(5.5, 7.5, 6), pl([10, 7], [12, 7]), pl([11, 6], [12, 7], [11, 8])], { solid: [0], cut: [1, 2, 3] }),
  chip: sm([CHIP16, pl([5, 7], [7, 7]), pl([9, 6], [11, 8]), pl([11, 6], [9, 8])], { solid: [0], cut: [1, 2, 3] }),
  'chip-selected': sm([CHIP16, pl([4, 7], [5, 8], [7, 6]), pl([9, 7], [11, 7])], { solid: [0], cut: [1, 2] }),
  'chip-avatar': sm([CHIP16, pbox(4, 6, 7, 9, 0.9, []), pl([9, 7], [11, 7])], { solid: [0], cut: [1, 2] }),
  'chip-group': sm([ppill(1, 2, 7, 6), ppill(9, 2, 14, 6), ppill(4, 9, 14, 13)], { solid: [0, 1, 2] }),
  'status-label': sm([CHIP16, p2(6, 8), pl([9, 7], [11, 7])], { solid: [0], cut: [1, 2] }),
  'date-picker': sm([pbox(2, 1, 13, 14, 2), pl([2, 5], [13, 5]), pl([4, 3], [8, 3]), pring(8, 8, 3), p1(5, 8), p1(11, 8), p1(5, 11), p1(8, 11), p1(11, 11)], { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] }),
  'time-picker': sm([pring(7, 7, 13), pl([7, 1], [7, 3]), pl([11, 7], [13, 7]), pl([7, 11], [7, 13]), pl([1, 7], [3, 7]), pl([7, 7], [9, 5]), p2(10, 5)], { solid: [0], cut: [1, 2, 3, 4, 5, 6] }),
  'wheel-picker': sm([ppill(1, 5, 14, 9), pl([4, 7], [11, 7]), pl([5, 3], [10, 3]), pl([6, 1], [9, 1]), pl([5, 11], [10, 11]), pl([6, 13], [9, 13])], { solid: [0], cut: [1], lines: [2, 3, 4, 5] }),
  'color-picker': sm([pbox(1, 2, 10, 11, 2), pring(7, 5, 3), pl([13, 2], [13, 4]), pl([13, 8], [13, 11]), pring(13, 6, 3)], { solid: [0, 4], cut: [1], wire: [2, 3] }),
  // Square swatches: at this size a ring is a gray smudge
  'color-swatches': sm([pbox(3, 3, 6, 6, 0.9, []), pbox(1, 1, 8, 8, 1.5, []), pbox(10, 3, 13, 6, 0.9, []), pbox(3, 10, 6, 13, 0.9, []), pbox(10, 10, 13, 13, 0.9, [])], { solid: [0, 2, 3, 4], lines: [1] }),
  'avatar-upload': sm([pring(7.5, 7.5, 13), pring(7.5, 5.5, 4), arc(12, 20.25, 5.25, 205, 335).d], { solid: [0], cut: [1, 2] }, {
    badge: piece16([roundpoly([g(9, 10), g(10, 10), g(11, 9), g(12, 9), g(13, 10), g(14, 10), g(14, 14), g(9, 14)], [0.4, 0.2, 0.2, 0.2, 0.2, 0.4, 0, 0.4]), p2(12, 12)], { solid: [roundpoly([g(9, 10), g(10, 10), g(11, 9), g(12, 9), g(13, 10), g(14, 10), g(14, 14), g(9, 14)], [0.4, 0.2, 0.2, 0.2, 0.2, 0.4, 0, 0.4])], cut: [p2(12, 12)] }),
  }),
  // Small stars close up into solid ones, which read as stars at this size
  'rating-stars': sm([star(px(3), px(9), 3.2, 1.3), star(px(7.5), px(7), 3.2, 1.3), star(px(12), px(9), 3.2, 1.3)], { solid: [0, 1, 2] }),
  'rating-emoji': sm([p1(2, 6), p1(5, 6), pl([2, 10], [3, 9], [4, 9], [5, 10]), p1(10, 6), p1(13, 6), pl([10, 9], [11, 10], [12, 10], [13, 9])], null),
  'rating-scale': sm([pring(2.5, 6.5, 4), pring(7.5, 6.5, 4), p2(13, 7), pl([1, 11], [14, 11])], null),
  'one-time-code': sm([F16, pl([5, 3], [5, 12]), pl([9, 3], [9, 12]), pl([3, 7], [3, 8]), pl([7, 7], [7, 8]), pl([11, 5], [11, 10])], { solid: [0], cut: [1, 2, 3, 4, 5] }),
  passcode: sm([p2(2, 8), p2(5, 8), pring(8, 8, 3), pring(12, 8, 3)], null),
  'password-strength': sm([pbox(1, 1, 14, 10, 3), p2(4, 6), p2(7, 6), p2(10, 6), pl([1, 13], [4, 13]), pl([6, 13], [9, 13]), pl([11, 13], [12, 13])], { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6] }),
  'password-reveal': sm([F16, p2(4, 8), p2(7, 8)], { solid: [0], cut: [1, 2] }, {
    badge: piece16([roundpoly([g(8, 11), g(10, 9), g(12, 9), g(14, 11), g(12, 13), g(10, 13)], 0.3), p1(11, 11)], { solid: [roundpoly([g(8, 11), g(10, 9), g(12, 9), g(14, 11), g(12, 13), g(10, 13)], 0.3)], cut: [p1(11, 11)] }),
  }),
  'password-reset': sm([F16, p2(4, 8), p2(7, 8), p2(10, 8)], { solid: [0], cut: [1, 2, 3] }, { badge: b16('sync') }),
  'validation-rules': sm([pl([1, 4], [2, 5], [5, 2]), pl([7, 4], [13, 4]), pl([2, 10], [5, 13]), pl([5, 10], [2, 13]), pl([7, 11], [12, 11])], null),
  'form-columns': sm([pl([2, 1], [4, 1]), pbox(1, 3, 6, 6, 1.2), pl([9, 1], [11, 1]), pbox(8, 3, 14, 6, 1.2), pl([2, 8], [4, 8]), pbox(1, 10, 14, 13, 1.2)], { solid: [1, 3, 5], lines: [0, 2, 4] }),
  'form-inline': sm([pl([1, 4], [3, 4]), pbox(5, 2, 14, 6, 1.2), pl([1, 11], [3, 11]), pbox(5, 9, 14, 13, 1.2)], { solid: [1, 3], lines: [0, 2] }),
  'input-key-value': sm([pbox(1, 2, 4, 6, 1.2), pbox(6, 2, 14, 6, 1.2), pbox(1, 9, 4, 13, 1.2), pbox(6, 9, 14, 13, 1.2)], { solid: [0, 1, 2, 3] }),
  'form-steps': sm([dot(px(2), px(2), 0.75), pl([3, 2], [5, 2]), pring(7, 2, 3), pl([9, 2], [11, 2]), pring(13, 2, 3), pbox(1, 5, 14, 8, 1.2), pbox(1, 11, 14, 14, 1.2)], { solid: [0, 2, 4, 5, 6], wire: [1, 3] }),
  'form-login': sm([pbox(1, 1, 14, 4, 1.2), pbox(1, 6, 14, 10, 1.2), p1(4, 8), p1(6, 8), p1(8, 8), ppill(1, 12, 6, 14)], { solid: [0, 1, 5], cut: [2, 3, 4] }),
  survey: sm([pbox(3, 1, 12, 14, 2), pring(6, 5, 3), p1(6, 5), pl([8, 5], [10, 5]), pring(6, 10, 3), pl([8, 10], [10, 10])], { solid: [0], cut: [1, 2, 3, 4, 5] }),
  accordion: sm([pbox(2, 1, 13, 14, 2), pl([2, 6], [13, 6]), pl([2, 11], [13, 11]), pl([9, 3], [10, 4], [11, 3]), pl([5, 8], [9, 8])], { solid: [0], cut: [1, 2, 3, 4] }),
  'progress-steps': sm([dot(px(2), px(7), 0.75), pl([3, 7], [6, 7]), pring(7, 7, 3), pl([8, 7], [11, 7]), pring(12, 7, 3)], null),
  'slider-value': sm([pl([1, 11], [7, 11]), pl([11, 11], [14, 11]), pring(9, 11, 5), pbox(6, 2, 12, 6, 1.2), pl([8, 4], [10, 4])], { solid: [2, 3], wire: [0, 1], cut: [4] }),
};
// The checked boxes keep their check running out of the corner
{
  const a = checked16(2, 2, 5);
  SMALL['checkbox-group'] = sm([a.box, pl([9, 4], [13, 4]), pbox(2, 9, 6, 13, 1.2), pl([9, 11], [12, 11])], { solid: [0, 2], lines: [1, 3] }, { badge: a.badge });
  const t = checked16(2, 1, 5);
  SMALL['checkbox-tree'] = sm([t.box, `M${P(g(3, 5))}V${f(px(12))}H${f(px(8))}M${P(g(3, 8))}H${f(px(8))}`, pbox(9, 7, 11, 9, 0.6), pbox(9, 11, 11, 13, 0.6)], { solid: [0, 2, 3], wire: [1] }, { badge: t.badge });
  const c = checked16(1, 4, 5);
  SMALL['checkbox-consent'] = sm([c.box, pl([9, 4], [13, 4]), pl([9, 7], [13, 7]), pl([9, 10], [11, 10])], { solid: [0], lines: [1, 2, 3] }, { badge: c.badge });
  const k = checked16(1, 5, 5);
  SMALL.captcha = sm([k.box, pl([8, 6], [9, 5], [10, 6], [11, 5], [12, 6], [13, 5]), pl([8, 10], [9, 9], [10, 10], [11, 9], [12, 10], [13, 9])], { solid: [0], lines: [1, 2] }, { badge: k.badge });
}
for (const [name, small] of Object.entries(SMALL)) icons[name].small = small;

export default { category: 'controles', label: 'Controles y formularios', icons };
