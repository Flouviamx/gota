// Archivos y nube: el archivo y sus tipos, carpetas, nube, almacenamiento, adjuntos,
// portapapeles, libros y publicaciones, versiones y respaldo. Todo se calcula con el motor
// (engine/geometry.mjs) sobre las reglas de DESIGN.md: trazo de 1.5, keylines, esquinas continuas
// y la esquina inferior derecha recta en los contenedores. El archivo base es el `document` del
// núcleo sin renglones; la carpeta repite la del núcleo. Las insignias (más, check, reloj…) son
// las del motor: `badge` despeja la base con aire exacto; nunca se recorta a mano.
import { arc, badge, circ, dot, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

// ── Utilidades locales ────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const deg = (v) => (v * 180) / Math.PI;

/** Solo el tramo «A…» de un arco del motor, para encadenarlo dentro de un path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');

/** Polilínea con los vértices interiores redondeados (radio por vértice o uno para todos). */
function roundline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const v = [B[0] - V[0], B[1] - V[1]];
    const lu = Math.hypot(...u);
    const lv = Math.hypot(...v);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/**
 * Contorno de un sq() con huecos. Cada hueco va de `from` a `to` en sentido horario, y cada
 * extremo es [borde, coordenada] sobre un tramo recto: 't' arriba (x), 'r' derecha (y),
 * 'b' abajo (x), 'l' izquierda (y). Sin huecos devuelve el sq() cerrado.
 */
function box(x, y, w, h, r, { square = [], gaps = [] } = {}) {
  const d = sq(x, y, w, h, r, { square });
  if (!gaps.length) return d;
  const k = d
    .slice(1, -1)
    .split('L')
    .map((s) => (s.includes('c') ? s.slice(s.indexOf('c')) : '')); // [tr, br, bl, tl]
  const p = (c) => (square.includes(c) ? 0 : 1.6 * r);
  const E = [
    { at: (c) => [c, y], end: [x + w - p('tr'), y], dir: 1 },
    { at: (c) => [x + w, c], end: [x + w, y + h - p('br')], dir: 1 },
    { at: (c) => [c, y + h], end: [x + p('bl'), y + h], dir: -1 },
    { at: (c) => [x, c], end: [x, y + p('tl')], dir: -1 },
  ];
  const idx = { t: 0, r: 1, b: 2, l: 3 };
  const piece = ([ea, ca], [eb, cb]) => {
    let e = idx[ea];
    const target = idx[eb];
    let s = `M${pt(E[e].at(ca))}`;
    if (e === target && (cb - ca) * E[e].dir > 0) return `${s}L${pt(E[e].at(cb))}`;
    do {
      s += `L${pt(E[e].end)}${k[e]}`;
      e = (e + 1) % 4;
    } while (e !== target);
    return `${s}L${pt(E[target].at(cb))}`;
  };
  return gaps.map((g, i) => piece(g.to, gaps[(i + 1) % gaps.length].from)).join('');
}


/**
 * Recorte por cápsulas de un contorno hecho de arcos y rectas: quita lo que queda a menos de
 * `rad` de cada segmento (el hueco de 1.5 cuando una figura pasa delante de otra) y devuelve el
 * resto como un solo `d`. Primitivas: { a: [cx, cy, r, a0, a1] } o { l: [p0, p1] }.
 */
function clip(prims, caps, closed = true) {
  const at = (q, t) =>
    q.a ? polar(q.a[0], q.a[1], q.a[2], q.a[3] + t * (q.a[4] - q.a[3])) : [q.l[0][0] + t * (q.l[1][0] - q.l[0][0]), q.l[0][1] + t * (q.l[1][1] - q.l[0][1])];
  const dist = (p, [a, b]) => {
    const v = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] ** 2 + v[1] ** 2 || 1)));
    return Math.hypot(p[0] - a[0] - t * v[0], p[1] - a[1] - t * v[1]);
  };
  const hidden = (p) => caps.some((c) => dist(p, c.seg) < c.rad);
  const runs = [];
  let cur = null;
  prims.forEach((q, qi) => {
    const S = 400;
    let prev = hidden(at(q, 0));
    let start = prev ? null : 0;
    const edges = [];
    for (let i = 1; i <= S; i++) {
      const t = i / S;
      const now = hidden(at(q, t));
      if (now !== prev) {
        let lo = (i - 1) / S;
        let hi = t;
        for (let k = 0; k < 40; k++) {
          const m = (lo + hi) / 2;
          if (hidden(at(q, m)) === prev) lo = m;
          else hi = m;
        }
        const e = (lo + hi) / 2;
        if (now) edges.push([start, e]);
        else start = e;
      }
      prev = now;
    }
    if (start !== null) edges.push([start, 1]);
    for (const [t0, t1] of edges) {
      if (cur && t0 === 0 && cur.endQ === qi - 1 && cur.endT === 1) cur.segs.push({ q, t0, t1 });
      else {
        cur = { segs: [{ q, t0, t1 }] };
        runs.push(cur);
      }
      cur.endQ = qi;
      cur.endT = t1;
    }
    if (!edges.length || edges[edges.length - 1][1] !== 1) cur = null;
  });
  // Un contorno cerrado que no se cortó en su arranque se une con el último tramo.
  const whole = closed && runs.length === 1 && runs[0].segs.length === prims.length && runs[0].segs.every((s) => s.t0 === 0 && s.t1 === 1);
  if (closed && !whole && runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    if (first.segs[0].t0 === 0 && first.segs[0].q === prims[0] && last.endQ === prims.length - 1 && last.endT === 1) {
      last.segs.push(...first.segs);
      runs.shift();
    }
  }
  const out = runs.map((run) => {
    let s = `M${pt(at(run.segs[0].q, run.segs[0].t0))}`;
    for (const { q, t0, t1 } of run.segs) {
      const e = at(q, t1);
      if (q.a) {
        const span = (t1 - t0) * (q.a[4] - q.a[3]);
        s += `A${N(q.a[2])} ${N(q.a[2])} 0 ${Math.abs(span) > 180 ? 1 : 0} ${span > 0 ? 1 : 0} ${pt(e)}`;
      } else s += `L${pt(e)}`;
    }
    return s;
  });
  return out.join('') + (whole ? 'Z' : '');
}

/** Almendra (ojo) de dos arcos: cuerda de 2·hc y flecha `sag` arriba y abajo de `c`. */
function lens([cx, cy], hc, sag) {
  const r = (hc * hc + sag * sag) / (2 * sag);
  const a = deg(Math.asin(hc / r));
  return `M${pt([cx - hc, cy])}${arcTo(cx, cy - sag + r, r, -90 - a, -90 + a)}${arcTo(cx, cy + sag - r, r, 90 - a, 90 + a)}Z`;
}

// ── Piezas base ───────────────────────────────────────────────────────────────────────────────
// El archivo: el `document` del núcleo (14.5 × 18.5, radio 3.75, esquina inferior derecha recta).
const F = [4.75, 2.75, 14.5, 18.5, 3.75];
const file = () => sq(...F, { square: ['br'] });

// Insignias propias (las que el motor no trae), en el mismo lugar que las suyas: centro
// (17.25, 17.25), círculo de r 4.25; `knock` es el área que el motor despeja con 1.5 de aire.
const BC = [17.25, 17.25];
const BR = 4.25;
const RING = circ(...BC, BR);
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** Lápiz: punta en `tip`, cuerpo hacia `a` grados, largo `len` hasta el centro del remate. */
function pencil(tip, a, len, hw = 1.5, tipLen = 3) {
  const u = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
  const n = [-u[1], u[0]];
  const at = (s, o) => [tip[0] + u[0] * s + n[0] * o, tip[1] + u[1] * s + n[1] * o];
  const outline = `M${pt(tip)}L${pt(at(tipLen, -hw))}L${pt(at(len, -hw))}A${N(hw)} ${N(hw)} 0 0 1 ${pt(at(len, hw))}L${pt(at(tipLen, hw))}Z`;
  return [outline, line(at(tipLen, -hw), at(tipLen, hw))];
}

/**
 * Sincronizar: dos flechas de arco; `s0` y `s1` abren el hueco antes y después de cada punta y
 * `t` gira el par (para alejar las puntas de un borde cercano).
 */
function syncGlyph([cx, cy], r, len = 2.6, s0 = 20, s1 = 30, t = 0) {
  const a = arc(cx, cy, r, 180 + s0 + t, 360 - s1 + t);
  const b = arc(cx, cy, r, s0 + t, 180 - s1 + t);
  return [a.d, head(a.end, a.tangent, len), b.d, head(b.end, b.tangent, len)];
}

/** Corazón: dos lóbulos que se cruzan arriba y dos tangentes que bajan a la punta. */
function heart([cx, cy], r = 2.25, a = 1.6, h = 4.25) {
  const P = [cx, cy + h];
  const lobe = (C, side) => {
    const L = Math.hypot(P[0] - C[0], P[1] - C[1]);
    return ang(C, P) + side * deg(Math.acos(r / L));
  };
  const Cl = [cx - a, cy];
  const Cr = [cx + a, cy];
  const top = [cx, cy - Math.sqrt(r * r - a * a)];
  const t1 = lobe(Cl, 1);
  const t2 = lobe(Cr, -1);
  const c1 = ang(Cl, top);
  const c2 = ang(Cr, top);
  return `M${pt(P)}L${pt(polar(...Cl, r, t1))}${arcTo(...Cl, r, t1, c1 + 360)}${arcTo(...Cr, r, c2, t2 + 360)}Z`;
}

const OWN = {
  // Pregunta: el gancho y su punto dentro del círculo.
  question() {
    const [cx, cy] = BC;
    const hook = `M${pt([cx - 1.3, cy - 1.3])}${arcTo(cx, cy - 1.3, 1.3, 180, 400)}L${pt([cx, cy - 0.05])}`;
    const mark = circ(cx, cy + 2.15, 0.35);
    return own([RING, hook, mark], RING, { solid: [RING], cut: [hook, mark] });
  },
  // Corazón, sin círculo: la figura misma es la insignia; despeja el círculo entero (así no
  // quedan pedazos de la base junto a su punta).
  heart() {
    const h = heart([BC[0], 16.25]);
    return own([h], RING, { solid: [h] });
  },
  // Lupa: el lente es el círculo de la insignia (r 3.25) y el mango sale hacia la esquina.
  search() {
    const r = 3.25;
    const lensC = circ(...BC, r);
    const p = polar(...BC, r, 45);
    const end = [21.25, 21.25];
    const handle = line(p, end);
    return own([lensC, handle], `${RING}M${pt(p)}L${pt(end)}Z`, { solid: [lensC, handle] });
  },
  // Sincronizar: las flechas de arco ocupan el círculo de la insignia (en relleno siguen siendo línea).
  sync() {
    return own(syncGlyph(BC, 3.75, 2.4, 25, 35), RING);
  },
  // Persona que se asoma por la esquina (compartir).
  person() {
    const h = circ(BC[0], 14.75, 1.85);
    const s = `M${pt([BC[0] - 3.25, 21.75])}${arcTo(BC[0], 21.75, 3.25, 180, 360)}Z`;
    return own([h, s], `${h}${s}`, { solid: [h, s] });
  },
  // La nube del set a escala, sentada en la esquina.
  cloud() {
    const c = clip(cloudPrims(5.6, 0.45, 5.2), []);
    return own([c], c, { solid: [c] });
  },
  // Sello con su listón: el certificado.
  seal() {
    const c = [BC[0], 15.25];
    const s = circ(...c, 3.25);
    const tail = roundline([[c[0] - 2, 17.8], [c[0] - 2, 22], [c[0], 20.75], [c[0] + 2, 22], [c[0] + 2, 17.8]], [0, 0.4, 0.4, 0.4, 0]);
    return own([s, tail], `${s}${tail}Z`, { solid: [s, tail] });
  },
};

// ── Íconos ────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
const withBadge = (name, tags, base, b) => add(name, tags, base, { badge: b });

// ── Archivo ───────────────────────────────────────────────────────────────────────────────────
// El archivo de texto no se repite aquí: es el `document` del núcleo (el archivo con renglones).
add('file', ['archivo', 'en blanco', 'hoja', 'file', 'blank file'], [file()]);
withBadge('file-plus', ['archivo nuevo', 'agregar archivo', 'crear', 'new file', 'add file'], [file()], badge('plus'));
withBadge('file-minus', ['quitar archivo', 'eliminar', 'menos', 'remove file', 'delete file'], [file()], badge('minus'));
withBadge('file-check', ['archivo aprobado', 'listo', 'verificado', 'file approved', 'file done'], [file()], badge('check'));
withBadge('file-x', ['archivo rechazado', 'error', 'cancelar', 'file error', 'file rejected'], [file()], badge('x'));
withBadge('file-alert', ['archivo con aviso', 'advertencia', 'problema', 'file warning', 'file issue'], [file()], badge('alert'));
withBadge('file-clock', ['archivo reciente', 'reloj', 'pendiente', 'recent file', 'pending file'], [file()], badge('clock'));
withBadge('file-star', ['archivo destacado', 'estrella', 'favorito', 'starred file', 'favorite'], [file()], badge('star'));
withBadge('file-move', ['mover archivo', 'trasladar', 'cambiar de lugar', 'move file', 'relocate'], [file()], badge('arrow-right'));
withBadge('file-question', ['archivo desconocido', 'pregunta', 'formato no reconocido', 'unknown file', 'file help'], [file()], OWN.question());
withBadge('file-heart', ['me gusta', 'archivo guardado', 'colección', 'liked file', 'saved file'], [file()], OWN.heart());
withBadge('file-search', ['buscar archivo', 'lupa', 'encontrar', 'find file', 'search file'], [file()], OWN.search());

// Candado dentro del archivo: el `lock` del núcleo a escala, centrado en el archivo.
const miniLock = sq(8.5, 11.25, 7, 5.5, 1.6, { square: ['br'] });
add('file-lock', ['archivo protegido', 'candado', 'privado', 'locked file', 'private file'], [file(), miniLock, `M10 11.25V9.75${arcTo(12, 9.75, 2, 180, 360)}V11.25`]);
// Desbloqueado: el arco se levanta 3.25 y suelta su pata derecha.
add('file-unlock', ['archivo desbloqueado', 'abierto', 'sin candado', 'unlocked file', 'unlock file'], [file(), miniLock, `M10 11.25V8${arcTo(12, 8, 2, 180, 360)}`]);
// Lápiz que escribe dentro del archivo.
add('file-edit', ['editar archivo', 'lápiz', 'modificar', 'edit file', 'write'], [file(), ...pencil([8.5, 16.25], -45, 10, 1.5, 3)]);
// Separador: el listón del libro, colgado del borde de arriba.
add('file-bookmark', ['archivo marcado', 'separador', 'guardado', 'bookmarked file', 'saved document'], [
  file(),
  roundline([[11, 2.75], [11, 9.75], [12.5, 8.5], [14, 9.75], [14, 2.75]], [0, 0.4, 0.4, 0.4, 0]),
]);

// ── Tipos de archivo: el glifo vive en el centro óptico del archivo (12, 12) ────────────────
add('file-code', ['archivo de código', 'código fuente', 'programación', 'code file', 'source code'], [file(), line([10.25, 9.5], [7.75, 12], [10.25, 14.5]), line([13.75, 9.5], [16.25, 12], [13.75, 14.5])]);
add('file-image', ['archivo de imagen', 'foto', 'fotografía', 'image file', 'photo'], [file(), dot(14.75, 8.5), roundline([[7.75, 16.75], [10.75, 12.5], [13, 15.25], [14.5, 13.75], [16.25, 16.25]], [0, 0.75, 0.6, 0.6, 0])]);
add('file-video', ['archivo de video', 'película', 'grabación', 'video file', 'movie'], [file(), roundpoly([[9.75, 8.5], [16.25, 12], [9.75, 15.5]], 1.3)]);
add('file-audio', ['archivo de audio', 'música', 'canción', 'audio file', 'music'], [file(), circ(10.75, 15.75, 1.75), `M12.5 15.75V7.75${arcTo(12.5, 11.25, 3.5, -90, 0)}`]);
// PDF, sin letras: la página impresa, con su titular arriba y la figura fija abajo, de margen a
// margen (la figura abajo evita que la página se lea como una cara).
add('file-pdf', ['pdf', 'documento portátil', 'documento impreso', 'pdf file', 'portable document'], [
  file(),
  line([8.25, 7], [15.75, 7]),
  line([8.25, 10], [12.75, 10]),
  sq(8.25, 13, 7.5, 4.25, 1.3),
]);
// ZIP: tres dientes que alternan a 3 (sus puntas, a 3 entre sí) y el tirador de la cremallera.
add('file-zip', ['archivo comprimido', 'zip', 'cremallera', 'compressed file', 'archive file'], [
  file(),
  line([9.75, 5.75], [12, 5.75]),
  line([12, 8.75], [14.25, 8.75]),
  line([9.75, 11.75], [12, 11.75]),
  sq(10.25, 14.75, 3.5, 3.5, 1.05),
]);
// Hoja de cálculo: encabezado y columna de etiquetas, de borde a borde.
add('file-spreadsheet', ['hoja de cálculo', 'tabla', 'excel', 'spreadsheet', 'sheet'], [file(), line([4.75, 8.75], [19.25, 8.75]), line([4.75, 15], [19.25, 15]), line([10.75, 8.75], [10.75, 21.25])]);
// Presentación: tres cuartos de pastel y la rebanada que sale, a 3 en diagonal.
{
  const r = 3;
  const c = [10.5, 13.5];
  const q = [c[0] + 3, c[1] - 3];
  add('file-presentation', ['presentación', 'diapositivas', 'gráfica de pastel', 'presentation file', 'slides'], [
    file(),
    `M${pt(c)}L${pt([c[0] + r, c[1]])}${arcTo(...c, r, 0, 270)}Z`,
    `M${pt(q)}L${pt([q[0], q[1] - r])}${arcTo(...q, r, -90, 0)}Z`,
  ]);
}
// Fuente: la A es el concepto.
{
  const top = [12, 7.5];
  const L = [8.75, 16.5];
  const R = [15.25, 16.5];
  const y = 13.5;
  const xl = top[0] + ((L[0] - top[0]) * (y - top[1])) / (L[1] - top[1]);
  add('file-font', ['fuente', 'tipografía', 'tipo de letra', 'font file', 'typeface'], [file(), roundline([L, top, R], [0, 0.6, 0]), line([xl, y], [24 - xl, y])]);
}
// JSON: dos llaves.
{
  const brace = (x, s) => roundline([[x + 1.25 * s, 7.75], [x, 7.75], [x, 11], [x - 1.25 * s, 12], [x, 13], [x, 16.25], [x + 1.25 * s, 16.25]], [0, 1, 0.8, 0, 0.8, 1, 0]);
  add('file-json', ['json', 'datos', 'configuración', 'json file', 'data file'], [file(), brace(9.25, 1), brace(14.75, -1)]);
}
// Terminal: el indicador y el cursor.
add('file-terminal', ['script', 'terminal', 'comandos', 'script file', 'shell'], [file(), line([8.75, 9.25], [11.5, 12], [8.75, 14.75]), line([13, 15], [15.5, 15])]);
// Modelo 3D: el cubo del núcleo a escala.
{
  const c = [12, 12];
  const s = 4.1;
  const P = (a, r = s) => polar(c[0], c[1], r, a);
  add('file-3d', ['modelo 3d', 'cubo', 'objeto', '3d file', '3d model'], [
    file(),
    roundpoly([-90, -30, 30, 90, 150, 210].map((a) => P(a)), 0.7),
    line(P(210), c, P(-30)),
    line(c, P(90)),
  ]);
}
// Persona dentro del archivo: expediente, currículum.
add('file-person', ['expediente', 'currículum', 'perfil', 'profile file', 'resume'], [file(), circ(12, 9.25, 2.5), `M8.25 17.75${arcTo(12, 17.75, 3.75, 180, 360)}Z`]);
// Firma: el trazo de la firma sobre su línea, abajo, donde se firma una hoja.
add('file-signature', ['firma', 'firmar', 'contrato', 'signature', 'sign document'], [
  file(),
  `M8.25 14.25${arcTo(9.75, 14.25, 1.5, 180, 360)}${arcTo(12.75, 14.25, 1.5, 180, 0)}${arcTo(15.75, 14.25, 1.5, 180, 270)}`,
  line([8.25, 17.75], [15.75, 17.75]),
]);
// Certificado: dos líneas de texto y el sello con su listón en la esquina.
withBadge('file-certificate', ['certificado', 'diploma', 'constancia', 'certificate file', 'credential'], [file(), line([8.5, 7.5], [13.5, 7.5]), line([8.5, 10.5], [11.5, 10.5])], OWN.seal());

// ── Contenido y acciones dentro del archivo ───────────────────────────────────────────────────
// Bajar y subir: la flecha dentro del archivo.
add('file-download', ['descargar archivo', 'bajar', 'guardar', 'download file', 'save file'], [file(), line([12, 7.5], [12, 16.5]), head([12, 16.5], [0, 1], 4.25)]);
add('file-upload', ['subir archivo', 'cargar', 'adjuntar', 'upload file', 'attach file'], [file(), line([12, 16.5], [12, 7.5]), head([12, 7.5], [0, -1], 4.25)]);
// Transferir: una flecha sube y otra baja; sus puntas, a 3 del borde y de la otra flecha.
add('file-transfer', ['transferir archivo', 'subir y bajar', 'intercambio', 'file transfer', 'exchange'], [
  file(),
  line([9.6, 16.75], [9.6, 7.75]),
  head([9.6, 7.75], [0, -1], 2.75),
  line([14.4, 7.75], [14.4, 16.75]),
  head([14.4, 16.75], [0, 1], 2.75),
]);
// Importar y exportar: la flecha entra o sale cruzando el borde; el archivo se abre a su paso y
// queda a 3 de las puntas.
{
  const y = 12;
  const imp = [8.75, 3.5, 12.5, 17, 3.25];
  add('file-import', ['importar', 'entrada', 'cargar datos', 'import', 'file input'], [
    box(...imp, { square: ['br'], gaps: [{ from: ['l', y + 3], to: ['l', y - 3] }] }),
    line([2.75, y], [15.5, y]),
    head([15.5, y], [1, 0], 4.25),
  ]);
  const exp = [2.75, 3.5, 12.5, 17, 3.25];
  add('file-export', ['exportar', 'salida', 'sacar datos', 'export', 'file output'], [
    box(...exp, { square: ['br'], gaps: [{ from: ['r', y - 3], to: ['r', y + 3] }] }),
    line([8.5, y], [21.25, y]),
    head([21.25, y], [1, 0], 4.25),
  ]);
}
// Compartir: la flecha de reenviar, dentro del archivo.
add('file-share', ['compartir archivo', 'reenviar', 'enviar', 'share file', 'forward file'], [file(), `M8.75 16.5V14${arcTo(12, 14, 3.25, 180, 270)}H15.75`, head([15.75, 10.75], [1, 0], 3.4)]);
// Comparar: más arriba, menos abajo.
add('file-diff', ['comparar', 'diferencias', 'cambios', 'diff', 'compare files'], [file(), line([12, 7.5], [12, 12.5]), line([9.5, 10], [14.5, 10]), line([9.5, 16.5], [14.5, 16.5])]);
// Gráfica de barras: reporte.
add('file-chart', ['reporte', 'gráfica', 'informe', 'report', 'chart file'], [file(), line([9, 16.5], [9, 12.75]), line([12, 16.5], [12, 7.75]), line([15, 16.5], [15, 10.5])]);
// Analítica: la tendencia que sube.
add('file-analytics', ['analítica', 'tendencia', 'métricas', 'analytics file', 'trend report'], [file(), roundline([[8.25, 16.25], [10.75, 12.5], [13, 14.5], [15.75, 9]], [0, 0.75, 0.75, 0])]);
// Vista previa: el ojo.
add('file-preview', ['vista previa', 'ver archivo', 'visualizar', 'preview', 'view file'], [file(), lens([12, 12], 4.5, 3.25), dot(12, 12)]);
// Generado con IA: el destello de cuatro puntas.
{
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(polar(12, 12, i % 2 ? 1.5 : 4.75, -90 + i * 45));
  add('file-sparkle', ['generado con ia', 'inteligencia artificial', 'resumen automático', 'ai file', 'ai generated'], [file(), roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.5 : 0.6)))]);
}
add('file-sync', ['sincronizar archivo', 'actualizar', 'al día', 'sync file', 'update file'], [file(), ...syncGlyph([12, 12], 3.75)]);

// Varios archivos: el de atrás asoma como escuadra a 3.5 del de enfrente.
const FRONT = [7.75, 6.25, 12.5, 15, 3.5];
const BACK = [4.25, 2.75, 12.5, 15, 3.5];
add('files', ['archivos', 'varios documentos', 'copias', 'files', 'documents'], [box(...FRONT, { square: ['br'] }), box(...BACK, { square: ['br'], gaps: [{ from: ['t', 14.65], to: ['l', 14.5] }] })]);

// Escanear: las cuatro escuadras del visor alrededor de una hoja.
{
  const k = (a, b, c) => roundline([a, b, c], [0, 2.25, 0]);
  add('file-scan', ['escanear', 'digitalizar', 'escáner', 'scan document', 'scanner'], [
    k([3, 7.75], [3, 3], [7.75, 3]),
    k([16.25, 3], [21, 3], [21, 7.75]),
    k([21, 16.25], [21, 21], [16.25, 21]),
    k([7.75, 21], [3, 21], [3, 16.25]),
    sq(8.25, 6.75, 7.5, 10.5, 2.25, { square: ['br'] }),
  ]);
}
// Triturar: la hoja entra por la boca de la trituradora y sale en cuatro tiras alineadas con
// sus bordes.
{
  const mouth = 9.25;
  const base = 14.5;
  add('file-shredder', ['triturar', 'destruir archivo', 'borrado seguro', 'shred', 'shredder'], [
    box(7.25, 2.75, 9.5, 14, 2.5, { square: ['br'], gaps: [{ from: ['r', mouth], to: ['l', mouth] }] }),
    sq(2.75, mouth, 18.5, base - mouth, 1.6, { square: ['br'] }),
    ...[7.25, 10.4, 13.6, 16.75].map((x) => line([x, base], [x, 20.75])),
  ]);
}

// ── Carpetas ──────────────────────────────────────────────────────────────────────────────────
// La carpeta del núcleo (radio 2.85, la pestaña con su caída de 2.4, esquina inferior derecha
// recta); `s` la escala.
function folder({ x = 2.75, y = 4.5, w = 18.5, h = 15, s = 1 } = {}) {
  const r = 2.85 * s;
  const k = (v) => N(v * s);
  const R = N(r);
  const tab = `h${k(2.83)}c${k(0.66)} 0 ${k(1.3)} ${k(0.27)} ${k(1.77)} ${k(0.74)}l${k(0.93)} ${k(0.93)}c${k(0.47)} ${k(0.47)} ${k(1.1)} ${k(0.73)} ${k(1.77)} ${k(0.73)}`;
  return `M${pt([x, y + r])}a${R} ${R} 0 0 1 ${R} -${R}${tab}H${N(x + w - r)}a${R} ${R} 0 0 1 ${R} ${R}V${N(y + h)}H${N(x + r)}a${R} ${R} 0 0 1 -${R} -${R}Z`;
}
const DIV = line([2.75, 10.25], [21.25, 10.25]); // el pliegue del frente, como en el núcleo
// Con insignia la carpeta sube 0.75: el pliegue queda a 3.25 del círculo y la insignia no lo muerde.
const FOLDER = [folder({ y: 3.75 }), line([2.75, 9.5], [21.25, 9.5])];

withBadge('folder-plus', ['carpeta nueva', 'agregar carpeta', 'crear', 'new folder', 'add folder'], FOLDER, badge('plus'));
withBadge('folder-minus', ['quitar carpeta', 'eliminar carpeta', 'menos', 'remove folder', 'delete folder'], FOLDER, badge('minus'));
withBadge('folder-check', ['carpeta aprobada', 'lista', 'completa', 'folder approved', 'folder done'], FOLDER, badge('check'));
withBadge('folder-x', ['carpeta con error', 'rechazada', 'cancelar', 'folder error', 'folder rejected'], FOLDER, badge('x'));
withBadge('folder-alert', ['carpeta con aviso', 'advertencia', 'problema', 'folder warning', 'folder issue'], FOLDER, badge('alert'));
withBadge('folder-download', ['descargar carpeta', 'bajar', 'guardar', 'download folder', 'save folder'], FOLDER, badge('arrow-down'));
withBadge('folder-upload', ['subir carpeta', 'cargar', 'enviar carpeta', 'upload folder', 'send folder'], FOLDER, badge('arrow-up'));
withBadge('folder-clock', ['carpeta reciente', 'reloj', 'historial', 'recent folder', 'folder history'], FOLDER, badge('clock'));
withBadge('folder-move', ['mover carpeta', 'trasladar', 'reubicar', 'move folder', 'relocate folder'], FOLDER, badge('arrow-right'));
withBadge('folder-star', ['carpeta destacada', 'estrella', 'favorita', 'starred folder', 'favorite folder'], FOLDER, badge('star'));
withBadge('folder-lock', ['carpeta protegida', 'candado', 'privada', 'locked folder', 'private folder'], FOLDER, badge('lock'));
withBadge('folder-heart', ['me gusta', 'carpeta guardada', 'colección', 'liked folder', 'saved folder'], FOLDER, OWN.heart());
withBadge('folder-search', ['buscar carpeta', 'lupa', 'explorar', 'find folder', 'search folder'], FOLDER, OWN.search());
withBadge('folder-sync', ['sincronizar carpeta', 'actualizar', 'respaldo continuo', 'sync folder', 'update folder'], FOLDER, OWN.sync());
withBadge('folder-shared', ['carpeta compartida', 'equipo', 'colaborar', 'shared folder', 'team folder'], FOLDER, OWN.person());
withBadge('folder-cloud', ['carpeta en la nube', 'en línea', 'carpeta remota', 'cloud folder', 'online folder'], FOLDER, OWN.cloud());

// Abierta: la tapa del frente se inclina hacia adelante y su lado izquierdo muere en la esquina.
{
  const r = 2.85;
  const T1 = [6.75, 12.75];
  const T2 = [21.6, 12.75];
  const B2 = [18.5, 19.5];
  const dir = [B2[0] - T2[0], B2[1] - T2[1]];
  // Dónde toca el lado izquierdo (paralelo al derecho) la esquina inferior izquierda.
  const C = [2.75 + r, 19.5 - r];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    const q = [T1[0] + dir[0] * m, T1[1] + dir[1] * m];
    if (Math.hypot(q[0] - C[0], q[1] - C[1]) > r && !(q[0] < C[0] && q[1] > C[1])) lo = m;
    else hi = m;
  }
  const S = [T1[0] + dir[0] * lo, T1[1] + dir[1] * lo];
  const tab = 'h2.83c.66 0 1.3.27 1.77.74l.93.93c.47.47 1.1.73 1.77.73';
  // Un solo trazo: rellenado, su cierre (del fondo al arranque de la tapa) deja la boca abierta.
  add('folder-open', ['carpeta abierta', 'abrir', 'explorar', 'open folder', 'browse'], [
    `${roundline([S, T1, T2, B2], [0, 1.6, 1.6, 0])}H${N(2.75 + r)}a${r} ${r} 0 0 1 -${r} -${r}V7.35a${r} ${r} 0 0 1 ${r} -${r}${tab}H16.4a${r} ${r} 0 0 1 ${r} ${r}`,
  ]);
}
// Varias carpetas: la de atrás asoma como escuadra a 3 de la de enfrente, con sus dos lados
// hasta donde empezarían sus esquinas (como `files`).
add('folders', ['carpetas', 'varias carpetas', 'directorios', 'folders', 'directories'], [
  folder({ x: 5.75, y: 7.5, w: 15.5, h: 13 }),
  line([5.75, 13.25], [21.25, 13.25]),
  `M2.75 14.65V7.35a2.85 2.85 0 0 1 2.85-2.85H15.4`,
]);
// Árbol: una carpeta raíz y dos hijas colgadas de su tronco.
{
  const s = 0.5;
  const small = (x, y) => folder({ x, y, w: 9, h: 4.75, s });
  add('folder-tree', ['árbol de carpetas', 'jerarquía', 'estructura', 'folder tree', 'directory tree'], [
    small(2.75, 2.75),
    small(12.25, 8.75),
    small(12.25, 16.5),
    roundline([[5.75, 7.5], [5.75, 19.5], [12.25, 19.5]], [0, 2.25, 0]),
    line([5.75, 11.75], [12.25, 11.75]),
  ]);
}

// ── Nube ──────────────────────────────────────────────────────────────────────────────────────
// Tres círculos y una base recta: la bocanada grande al centro, dos menores a los lados (la
// misma nube que `cloud` en Lugares). Se calcula como arcos exactos (con sus intersecciones)
// para poder recortarla con clip(). El hueco más amplio de adentro está en (12.4, 12.45), a 5.8
// del contorno: ahí se centran los glifos, a 3 o más del borde.
function meet([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  const p = [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d];
  const q = [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d];
  return p[1] < q[1] ? p : q; // la de arriba
}
function ang([cx, cy], [x, y]) {
  return deg(Math.atan2(y - cy, x - cx));
}
function cloudPrims(oy = 0, k = 1, ox = 0) {
  const T = ([x, y, r]) => [ox + 12 + (x - 12) * k, oy + 12 + (y - 12) * k, r * k];
  const A = T([7.25, 14.25, 4]);
  const B = T([12.5, 10.75, 5.5]);
  const C = T([17.25, 14.5, 3.75]);
  const ab = meet(A, B);
  const bc = meet(B, C);
  const base = A[1] + A[2];
  return [
    { a: [...C, 90, ang(C, bc)] },
    { a: [...B, ang(B, bc), ang(B, ab)] },
    { a: [...A, ang(A, ab), -270] },
    { l: [[A[0], base], [C[0], base]] },
  ];
}
const cloud = (oy = 0, caps = []) => clip(cloudPrims(oy), caps);
const cap = (p0, p1, rad = 3) => ({ seg: [p0, p1], rad });
const CX = 12.4; // eje de los glifos dentro de la nube

// Subir y bajar: la flecha cruza la base de la nube, que se abre a su paso.
add('cloud-upload', ['subir a la nube', 'cargar', 'respaldar', 'cloud upload', 'backup to cloud'], [cloud(-2.5, [cap([12, 8.75], [12, 21.5])]), line([12, 21.5], [12, 8.75]), head([12, 8.75], [0, -1], 3.75)]);
add('cloud-download', ['bajar de la nube', 'descargar', 'recuperar', 'cloud download', 'restore from cloud'], [cloud(-2.5, [cap([12, 9], [12, 21.75])]), line([12, 9], [12, 21.75]), head([12, 21.75], [0, 1], 3.75)]);

// Estados dentro de la nube.
add('cloud-check', ['guardado en la nube', 'sincronizado', 'respaldado', 'cloud saved', 'synced'], [cloud(), line([9.25, 13.25], [11.25, 15.25], [15, 11.5])]);
add('cloud-x', ['error de nube', 'no se subió', 'falló', 'cloud error', 'upload failed'], [cloud(), line([CX - 2.1, 10.65], [CX + 2.1, 14.85]), line([CX + 2.1, 10.65], [CX - 2.1, 14.85])]);
add('cloud-plus', ['agregar a la nube', 'nuevo', 'subir más', 'cloud add', 'add to cloud'], [cloud(), line([CX, 10.25], [CX, 15.25]), line([CX - 2.5, 12.75], [CX + 2.5, 12.75])]);
add('cloud-minus', ['quitar de la nube', 'eliminar', 'liberar espacio', 'cloud remove', 'remove from cloud'], [cloud(), line([CX - 2.5, 12.75], [CX + 2.5, 12.75])]);
add('cloud-alert', ['aviso de nube', 'problema de sincronización', 'atención', 'cloud warning', 'sync issue'], [cloud(), line([CX, 8.25], [CX, 11.2]), dot(CX, 14.75)]);
{
  const c = [11.75, 12];
  const r = 2.5;
  add('cloud-search', ['buscar en la nube', 'lupa', 'encontrar', 'cloud search', 'find in cloud'], [cloud(), circ(...c, r), line(polar(...c, r, 45), [15, 15.25])]);
}
// Sincronizar: el par de flechas más grande que cabe en el hueco con sus puntas lejos del borde.
add('cloud-sync', ['sincronizar', 'nube', 'al día', 'cloud sync', 'syncing'], [cloud(), ...syncGlyph([CX, 12.3], 2.5, 1.9, 25, 45, 10)]);
// Candado: el del núcleo a escala, en el hueco de la nube.
add('cloud-lock', ['nube privada', 'candado', 'cifrado', 'cloud lock', 'secure cloud'], [
  cloud(),
  sq(CX - 3, 11, 6, 4.25, 1.4, { square: ['br'] }),
  `M${N(CX - 1.5)} 11V9.75${arcTo(CX, 9.75, 1.5, 180, 360)}V11`,
]);
{
  // El rayo del núcleo a escala: un zigzag de seis vértices con esquinas suaves.
  const V = [[13.1, 4.25], [5.4, 12.85], [11.35, 12.85], [10.9, 19.75], [18.6, 11.15], [12.65, 11.15]];
  const k = 0.5;
  const P = V.map(([x, y]) => [CX + (x - 12) * k, 12.2 + (y - 12) * k]);
  add('cloud-bolt', ['nube rápida', 'rayo', 'instantáneo', 'cloud fast', 'edge'], [cloud(), roundpoly(P, [0.5, 0.6, 0.3, 0.5, 0.6, 0.3])]);
}
// Sin conexión: la diagonal corta la nube con 1.5 de aire.
add('cloud-off', ['sin nube', 'sin conexión', 'desconectado', 'cloud off', 'offline'], [cloud(0, [cap([3.75, 4.25], [20.25, 20.75])]), line([3.75, 4.25], [20.25, 20.75])]);
// La nube del set dentro del archivo (la mayor que cabe con 1.5 de aire).
add('file-cloud', ['archivo en la nube', 'en línea', 'almacenado en la nube', 'cloud file', 'online file'], [file(), clip(cloudPrims(0.75, 0.45), [])]);

// ── Almacenamiento ────────────────────────────────────────────────────────────────────────────
// Disco duro: la unidad abierta, con su plato, el eje y el brazo lector; el plato se corta
// bajo el brazo con 1.5 de aire y queda a 3 de la caja y del eje del brazo.
{
  const c = [12, 10];
  const r = 4.25;
  const pivot = [15.75, 17.75];
  const pr = 1.1;
  const tip = [14.25, 12.75];
  const from = polar(...pivot, pr, deg(Math.atan2(tip[1] - pivot[1], tip[0] - pivot[0])));
  add('hard-drive', ['disco duro', 'almacenamiento', 'disco', 'hard drive', 'storage'], [
    sq(4.75, 2.75, 14.5, 18.5, 3.75, { square: ['br'] }),
    clip([{ a: [...c, r, 0, 360] }], [cap(from, tip, 3.05)]),
    dot(...c),
    circ(...pivot, pr),
    line(from, tip),
  ]);
}
// La unidad (disco externo, servidor, respaldo): la ranura a la izquierda y la luz a la derecha.
const unit = (y, h, r) => [sq(2.75, y, 18.5, h, r, { square: ['br'] }), line([6.25, y + h / 2], [10.25, y + h / 2]), dot(17.25, y + h / 2)];
add('external-drive', ['disco externo', 'unidad', 'almacenamiento', 'external drive', 'drive'], unit(7.5, 9, 2.75));
// Servidor de archivos: una carpeta asentada sobre la unidad.
add('file-server', ['servidor de archivos', 'nas', 'red', 'file server', 'network storage'], [folder({ x: 2.75, y: 2.75, w: 18.5, h: 8 }), ...unit(13.75, 6.75, 2.1)]);
// Respaldo: la flecha da la vuelta y vuelve a entrar a la unidad.
{
  const a = arc(12, 11, 6.5, 0, -180);
  add('backup', ['respaldo', 'copia de seguridad', 'restaurar', 'backup', 'time machine'], [a.d, head(a.end, a.tangent, 3.4), ...unit(14, 7.25, 2.25)]);
}
// Archivero: tres cajones con su jaladera.
add('filing-cabinet', ['archivero', 'cajones', 'expedientes', 'filing cabinet', 'records'], [
  sq(4.75, 2.75, 14.5, 18.5, 3.75, { square: ['br'] }),
  line([4.75, 8.75], [19.25, 8.75]),
  line([4.75, 15.25], [19.25, 15.25]),
  line([10.5, 5.75], [13.5, 5.75]),
  line([10.5, 12], [13.5, 12]),
  line([10.5, 18.25], [13.5, 18.25]),
]);
// Papelera, restaurar: el bote de Edición (`trash`) con la flecha que saca el archivo.
add('trash-restore', ['restaurar', 'recuperar de la papelera', 'deshacer borrado', 'restore', 'undelete'], [
  line([3.5, 6], [20.5, 6]),
  roundline([[9.25, 6], [9.25, 3.25], [14.75, 3.25], [14.75, 6]], [0, 1.25, 1.25, 0]),
  sq(5.25, 9, 13.5, 12.25, 3.25, { square: ['br'] }),
  line([12, 18.25], [12, 12.25]),
  head([12, 12.25], [0, -1], 3.25),
]);

// ── Adjuntos ──────────────────────────────────────────────────────────────────────────────────
// Clip: tres rectas paralelas a 3 y tres medias vueltas, girado 45°.
{
  const c = [12, 12.25];
  const R = (p) => rot(p, c, 45);
  const A = (o, r, a0, a1) => arcTo(...R(o), r, a0 + 45, a1 + 45);
  add('paperclip', ['clip', 'adjunto', 'adjuntar', 'attachment', 'attach'], [
    `M${pt(R([13.5, 8]))}L${pt(R([13.5, 15]))}${A([12, 15], 1.5, 0, 180)}L${pt(R([10.5, 6]))}${A([13.5, 6], 3, 180, 360)}L${pt(R([16.5, 17]))}${A([12, 17], 4.5, 0, 180)}L${pt(R([7.5, 9]))}`,
  ]);
}

// ── Portapapeles ──────────────────────────────────────────────────────────────────────────────
// La tabla se abre arriba y sus esquinas terminan justo en los costados de la pinza; misma
// tabla y misma pinza (5.7 × 3.5) que `paste` y `clipboard-check` de Edición.
function clipboard(x = 4.75, w = 14.5) {
  const r = 2.75;
  const y = 4.5;
  const p = 1.6 * r;
  return [
    box(x, y, w, 16.75, r, { square: ['br'], gaps: [{ from: ['t', x + p], to: ['t', x + w - p] }] }),
    sq(x + p, 2.75, w - 2 * p, 3.5, 1.05),
  ];
}
add('clipboard', ['portapapeles', 'tabla', 'notas', 'clipboard', 'board'], clipboard());
// Lista: viñeta y renglón con 1.5 de aire entre ellos (a 18 px no se juntan).
add('clipboard-list', ['lista', 'pendientes', 'tareas', 'checklist', 'to-do'], [
  ...clipboard(),
  ...[10.5, 14, 17.5].flatMap((y) => [dot(8.5, y), line([12.25, y], [16.25, y])]),
]);
add('clipboard-plus', ['agregar', 'nueva lista', 'nueva nota', 'clipboard add', 'new list'], [...clipboard(), line([12, 11], [12, 16.5]), line([9.25, 13.75], [14.75, 13.75])]);
add('clipboard-x', ['quitar', 'rechazado', 'vaciar', 'clipboard remove', 'rejected'], [...clipboard(), line([9.9, 11.65], [14.1, 15.85]), line([14.1, 11.65], [9.9, 15.85])]);
// Copiar al portapapeles: la flecha entra por el costado.
{
  const x = 8.25;
  const w = 13;
  const y = 13.25;
  const [, pinza] = clipboard(x, w);
  const r = 2.75;
  const p = 1.6 * r;
  add('clipboard-copy', ['copiar', 'al portapapeles', 'guardar copia', 'copy to clipboard', 'copy'], [
    box(x, 4.5, w, 16.75, r, { square: ['br'], gaps: [{ from: ['l', y + 3], to: ['l', y - 3] }, { from: ['t', x + p], to: ['t', x + w - p] }] }),
    pinza,
    line([2.75, y], [15.25, y]),
    head([15.25, y], [1, 0], 3.75),
  ]);
}
// Hoja de horas: el reloj tan grande como cabe; las manecillas, a 3 de la carátula.
add('clipboard-clock', ['hoja de horas', 'tiempo', 'registro de horas', 'timesheet', 'time log'], [...clipboard(), circ(12, 13.75, 4.25), line([12, 12.35], [12, 13.75], [13.2, 14.45])]);
add('clipboard-person', ['expediente', 'ficha', 'registro', 'record', 'patient chart'], [...clipboard(), circ(12, 10.6, 2), `M8.25 18.25${arcTo(12, 18.25, 3.75, 180, 360)}Z`]);
add('clipboard-edit', ['editar lista', 'lápiz', 'llenar formulario', 'edit clipboard', 'fill form'], [...clipboard(), ...pencil([8.75, 17.75], -45, 9.5, 1.5, 3)]);

// ── Libros y publicaciones ────────────────────────────────────────────────────────────────────
// Arco de una cuerda con flecha `sag`: sweep 1 se curva a la izquierda del avance en pantalla.
function bow(p0, p1, sag, sweep) {
  const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const r = (c * c) / (8 * sag) + sag / 2;
  return `A${N(r)} ${N(r)} 0 0 ${sweep} ${pt(p1)}`;
}
// Cuaderno: la pasta y los aros del espiral que la atraviesan por el lomo.
add('notebook', ['cuaderno', 'libreta', 'apuntes', 'notebook', 'notes'], [
  sq(6.25, 2.75, 13, 18.5, 3, { square: ['br'] }),
  line([3.75, 8.5], [8.75, 8.5]),
  line([3.75, 12], [8.75, 12]),
  line([3.75, 15.5], [8.75, 15.5]),
]);
// Libro: la pasta, el lomo (justo donde termina la esquina) y el listón del separador.
add('book', ['libro', 'lectura', 'manual', 'book', 'guide'], [
  sq(4.75, 2.75, 14.5, 18.5, 2.5, { square: ['br'] }),
  line([8.75, 2.75], [8.75, 21.25]),
  roundline([[12.25, 2.75], [12.25, 9.75], [13.75, 8.5], [15.25, 9.75], [15.25, 2.75]], [0, 0.4, 0.4, 0.4, 0]),
]);
// Libro abierto: dos páginas en ala de gaviota sobre el lomo.
{
  const sT = [12, 7.25];
  const sB = [12, 19.75];
  const L = [[2.75, 5.5], [2.75, 18]];
  const R = [[21.25, 5.5], [21.25, 18]];
  add('book-open', ['libro abierto', 'leer', 'documentación', 'open book', 'read'], [
    `M${pt(sT)}${bow(sT, L[0], 1.1, 0)}L${pt(L[1])}${bow(L[1], sB, 1.1, 1)}${bow(sB, R[1], 1.1, 1)}L${pt(R[0])}${bow(R[0], sT, 1.1, 0)}Z`,
    line(sT, sB),
  ]);
}
// Librero: dos libros de pie, uno recargado y el estante.
{
  const pivot = [16.1, 20.25];
  const t = -18;
  const C = [[0, 0], [0, -14], [4, -14], [4, 0]].map(([x, y]) => rot([pivot[0] + x, pivot[1] + y], pivot, t));
  add('bookshelf', ['librero', 'biblioteca', 'colección', 'library', 'bookshelf'], [
    roundline([[3.25, 20.25], [3.25, 8.25], [7.25, 8.25], [7.25, 4.75], [11.75, 4.75], [11.75, 20.25]], [0, 1.25, 0, 1.25, 1.25, 0]),
    line([7.25, 8.25], [7.25, 20.25]),
    roundpoly(C, 1.1),
    line([2.5, 20.25], [21.5, 20.25]),
  ]);
}
// Pila de libros acostados: cada lomo con su canto de hojas.
add('books', ['libros', 'pila de libros', 'estudio', 'books', 'reading list'], [
  sq(3.25, 16.75, 17.5, 4.5, 1.4, { square: ['br'] }),
  sq(5.25, 12.25, 14.5, 4.5, 1.4, { square: ['br'] }),
  sq(4.25, 7.75, 13, 4.5, 1.4, { square: ['br'] }),
  line([17.25, 16.75], [17.25, 21.25]),
  line([16.25, 12.25], [16.25, 16.75]),
  line([14.25, 7.75], [14.25, 12.25]),
]);
// Periódico: la plana (esquinas continuas arriba; abajo recta, donde asienta el doblez), el
// doblez a la izquierda, el titular, la foto y dos líneas.
add('newspaper', ['periódico', 'noticias', 'prensa', 'revista', 'newspaper', 'news'], [
  sq(6.25, 4.25, 15, 15.5, 3.5, { square: ['br', 'bl'] }),
  roundline([[6.25, 9.25], [2.75, 9.25], [2.75, 19.75], [6.25, 19.75]], [0, 1.25, 2.5, 0]),
  line([9.75, 8], [18.25, 8]),
  sq(9.75, 11, 3.25, 5.25, 1),
  line([16, 12], [18.25, 12]),
  line([16, 15.25], [18.25, 15.25]),
]);

// ── Versiones ─────────────────────────────────────────────────────────────────────────────────
// Versiones: tres hojas escalonadas; las de atrás asoman como escuadras a 3 de la siguiente.
{
  const r = 3;
  const p = 1.6 * r;
  const sheets = [[3.75, 2.75], [6.75, 5.75], [9.75, 8.75]].map(([x, y]) => [x, y, 11, 12.5, r]);
  const behind = (b, n) => box(...b, { square: ['br'], gaps: [{ from: ['t', n[0] + n[2] - p], to: ['l', n[1] + n[3] - p] }] });
  add('versions', ['historial de versiones', 'versiones', 'revisiones', 'version history', 'revisions'], [
    behind(sheets[0], sheets[1]),
    behind(sheets[1], sheets[2]),
    sq(...sheets[2], { square: ['br'] }),
  ]);
}

// ── Variantes, espejo y movimiento ────────────────────────────────────────────────────────────
// Ya viene tachado: no se vuelve a tachar.
icons['cloud-off'].variants = { slash: false };
// Con insignia en la esquina: el tache la atravesaría.
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { slash: false };
// El visor ya lo encierra.
icons['file-scan'].variants = { circle: false, square: false };

// Espejo: lo que entra, sale, se reenvía o crece hacia un lado.
for (const name of ['file-import', 'file-export', 'file-share', 'file-move', 'folder-move', 'clipboard-copy', 'file-analytics']) icons[name].mirror = true;

// Movimiento: parts = índices de d que se mueven; origin = pivote; vector = desplazamiento.
icons['file-download'].motion = { effect: 'bounce', parts: [1, 2], vector: [0, 2] };
icons['file-upload'].motion = { effect: 'bounce', parts: [1, 2], vector: [0, -2] };
icons['cloud-download'].motion = { effect: 'bounce', parts: [1, 2], vector: [0, 2] };
icons['cloud-upload'].motion = { effect: 'bounce', parts: [1, 2], vector: [0, -2] };
icons['trash-restore'].motion = { effect: 'bounce', parts: [3, 4], vector: [0, -2] };
icons['file-import'].motion = { effect: 'slide', parts: [1, 2], vector: [2, 0] };
icons['file-export'].motion = { effect: 'slide', parts: [1, 2], vector: [2, 0] };
icons['clipboard-copy'].motion = { effect: 'slide', parts: [2, 3], vector: [2, 0] };
icons['file-sync'].motion = { effect: 'spin', parts: [1, 2, 3, 4], origin: [12, 12] };
icons['cloud-sync'].motion = { effect: 'spin', parts: [1, 2, 3, 4], origin: [CX, 12.3] };
icons.paperclip.motion = { effect: 'wiggle', origin: [12, 12.25] };

// Relleno (DESIGN.md › Relleno), por índice de d: por omisión el cuerpo (el primer trazo) se
// rellena y los detalles se calan; aquí van las excepciones. `lines` sigue siendo línea con 1.5 de
// aire alrededor; lo que toca al cuerpo y debe seguir unido va en `solid`.
const all = (name) => icons[name].d.map((_, i) => i);
const FILL = {
  files: { solid: [0], lines: [1] },
  'file-scan': { solid: [4], lines: [0, 1, 2, 3] },
  'file-shredder': { solid: all('file-shredder') },
  'file-import': { solid: [0], lines: [1, 2] },
  'file-export': { solid: [0], lines: [1, 2] },
  folders: { solid: [0], cut: [1], lines: [2] },
  'folder-tree': { solid: all('folder-tree') },
  'cloud-upload': { solid: [0], lines: [1, 2] },
  'cloud-download': { solid: [0], lines: [1, 2] },
  'cloud-off': { solid: [0], lines: [1] },
  'file-server': { solid: [0, 1], cut: [2, 3] },
  backup: { solid: [2], cut: [3, 4], lines: [0, 1] },
  'trash-restore': { solid: [0, 1, 2], cut: [3, 4] },
  'clipboard-copy': { solid: [0, 1], lines: [2, 3] },
  notebook: { solid: all('notebook') },
  bookshelf: { solid: [0, 2, 3], cut: [1] },
  books: { solid: [0, 1, 2], cut: [3, 4, 5] },
  newspaper: { solid: [0, 1], cut: [2, 3, 4, 5] },
  versions: { solid: [2], lines: [0, 1] },
};
// El portapapeles: la tabla y la pinza se rellenan; lo de adentro se cala.
for (const name of Object.keys(icons)) if (name.startsWith('clipboard') && !FILL[name]) FILL[name] = { solid: [0, 1], cut: all(name).slice(2) };
for (const [name, icon] of Object.entries(icons)) {
  const spec = FILL[name] ?? { solid: [0], cut: all(name).slice(1) };
  const pick = (ix) => ix.map((i) => icon.d[i]);
  icon.fill = { solid: pick(spec.solid), ...(spec.cut?.length && { cut: pick(spec.cut) }), ...(spec.lines?.length && { lines: pick(spec.lines) }) };
}
// La trituradora: la hoja y la máquina se separan por el canto de la boca; los libros apilados,
// por los cantos que comparten (sus hojas no caben caladas en 4.5 de grueso).
icons['file-shredder'].fill.cut = [line([4.75, 9.25], [19.25, 9.25])];
icons.books.fill = { solid: icons.books.fill.solid, cut: [line([7.5, 12.25], [16.5, 12.25]), line([7.5, 16.75], [19, 16.75])] };
// Solo una línea abierta: su relleno es el mismo contorno.
icons.paperclip.fill = false;

export default { category: 'archivos', label: 'Archivos y nube', icons };
