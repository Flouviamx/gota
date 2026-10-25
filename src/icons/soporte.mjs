// Soporte y servicio (support and service): tickets and their states, queues and assignment, the
// agent, call centers and chat, internal notes, escalation and SLAs, help centers and guides,
// feedback, repairs and status pages. Everything is computed with the engine (engine/geometry.mjs)
// on the rules in DESIGN.md.
//
// The family is built on adopted bases, read from their categories and never redrawn: the core
// ticket (Núcleo: its notches and its perforation), comunicacion's headset over the core person,
// the core bubble (the drop), shield, globe, magnifier and refresh, navegacion's browser, archivos'
// books, dispositivos' smartphone, lugares' map pin and sistema's wrench. A state of a ticket is a status badge on the
// whole ticket; a piece that sits on top of another (a wrench over a phone, the headset over a
// head, a paper tab in front of its dispenser) is a custom badge the engine clears, never a hand cut.
import { arc, badge, circ, dot, drop, f, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import navegacion from './navegacion.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${P(V)}`;
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
    s += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${s}L${P(pts.at(-1))}`;
}
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** A piece scaled by `s` about `o` and moved by (dx, dy). */
const move = (d, s = 1, o = [12, 12], dx = 0, dy = 0) => transform(d, s, o[0] * (1 - s) + dx, o[1] * (1 - s) + dy);
/** A custom piece on top of the base: the engine clears the base around `knock`. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** An arc arrow: the arc and its head (arms of 3.4 on arc arrows, DESIGN.md › Arrows). */
const arcArrow = (cx, cy, r, a0, a1, len = 3.4) => {
  const a = arc(cx, cy, r, a0, a1);
  return [a.d, head(a.end, a.tangent, len)];
};
/**
 * A question mark: a hook of radius r around (cx, cy) that turns into a stem 1.3 r below it, and its
 * point `gap` further down (3.7 keeps 1.5 of paper between the stem's cap and the point's disc).
 */
const question = (cx, cy, r, gap = 3.7) => {
  const [a, b] = [polar(cx, cy, r, 165), polar(cx, cy, r, 45)];
  const stem = cy + 1.3 * r;
  return [
    `M${P(a)}A${f(r)} ${f(r)} 0 1 1 ${P(b)}C${P([b[0] - 0.27 * r, b[1] + 0.27 * r])} ${P([cx, cy + 0.95 * r])} ${P([cx, stem])}`,
    dot(cx, stem + gap),
  ];
};

// ── Adopted bases ─────────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const TICKET = N.ticket.d;
const SHIELD = N.shield.d[0];
const SEARCH = N.search.d;
const BROWSER = navegacion.icons.browser.d;
const BOOK = archivos.icons.book.d;
const PHONE = dispositivos.icons.smartphone.d;
const PIN = lugares.icons['map-pin'].d[0];
const WRENCH = sistema.icons.wrench.d[0];

// ── The ticket ────────────────────────────────────────────────────────────────────────────────
// Núcleo's ticket: corners of r 2.85, notches of r 2.25 at mid-height, the perforation 6.25 from the
// right edge in two dashes that leave the notches' line free. Smaller tickets are built on the same
// construction (`ticket`), so they keep its corners and notches.
/** A ticket of the core's construction: corners of r, notches of nr at mid-height. */
function ticket(x, y, w, h, r = 2.85, nr = 2.25) {
  const [x1, y1, cy] = [x + w, y + h, y + h / 2];
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x1, y + r])}V${f(cy - nr)}A${f(nr)} ${f(nr)} 0 0 0 ${P([x1, cy + nr])}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x1 - r, y1])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y1 - r])}V${f(cy + nr)}A${f(nr)} ${f(nr)} 0 0 0 ${P([x, cy - nr])}Z`;
}
/** The perforation at x: two dashes 3 in from the edges, 3 apart across the notches' line. */
const perforation = (x, y, h) => [vl(x, y + 3, y + h / 2 - 1.5), vl(x, y + h / 2 + 1.5, y + h - 3)];

// Badges at the engine's spot
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);
/** A status badge of our own: the engine's solid disc with `marks` cut out (marketing's megaphone-pause). */
const status = (marks) => own([RING, ...marks], RING, { solid: [RING], cut: marks });
/** On hold: two bars cut out of the disc. */
const PAUSE = status([vl(16, 15.5, 19), vl(18.5, 15.5, 19)]);
/**
 * Reopen: a counterclockwise arc arrow cut out of the disc (a status: the ticket's states are all
 * discs), open on the left with its head at the top left, as oficina's reopen badge (task-reopen):
 * open at the top, it read as a power button. Its glyph without the disc changed the ticket's
 * structure with the weight.
 */
const REOPEN = status(arcArrow(...BC, 2.1, 150, -150, 1.6));

/**
 * The ticket under a corner badge: the badge clears its lower dash whole, and the upper one stops at
 * 10 so its end stays out of the clearance at every weight (at 10.5 it came in and out of it, and the
 * fill's cut joined the badge's paper at some weights and not at others).
 */
const TICKET_B = [TICKET[0], vl(15, 7.75, 10)];

const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Tickets ───────────────────────────────────────────────────────────────────────────────────
add('ticket-plus', ['nuevo ticket', 'abrir solicitud', 'crear caso', 'new ticket', 'open request'], TICKET_B, { badge: badge('plus') });
add('ticket-check', ['ticket resuelto', 'caso cerrado', 'solucionado', 'solved ticket', 'resolved'], TICKET_B, { badge: badge('check') });
add('ticket-clock', ['ticket pendiente', 'en espera del cliente', 'tiempo de respuesta', 'pending ticket', 'awaiting reply'], TICKET_B, { badge: badge('clock') });
add('ticket-alert', ['ticket urgente', 'en riesgo', 'prioridad alta', 'urgent ticket', 'at risk'], TICKET_B, { badge: badge('alert') });
add('ticket-escalated', ['ticket escalado', 'siguiente nivel', 'nivel 2', 'escalated ticket', 'tier 2'], TICKET_B, { badge: badge('arrow-up') });
// The queue: a shorter ticket in front (the core's corners, notches and perforation) and the top
// edges of two more behind it, each 3 higher and narrower, as notification-stack's cards
add('ticket-stack', ['cola de tickets', 'bandeja de casos', 'vista', 'ticket queue', 'ticket view'], [
  ticket(2.75, 8.25, 18.5, 13),
  ...perforation(15, 8.25, 13),
  hl(5.25, 5, 19),
  hl(2.25, 7.5, 16.5),
]);
// Merge: two strokes meet in a Y whose stem runs into the left notch of a shorter ticket
add('ticket-merge', ['fusionar tickets', 'duplicados', 'unir casos', 'merge tickets', 'duplicates'], [
  ticket(9.75, 5.5, 11.5, 13),
  ...perforation(16.25, 5.5, 13),
  line([3, 8], [7, 12], [12, 12]),
  line([3, 16], [7, 12]),
]);
// Split: the ticket parted along its perforation, the stub 2.5 lower and 3.5 apart; the cut edges
// are straight, with square corners
add('ticket-split', ['dividir ticket', 'separar caso', 'nuevo caso', 'split ticket', 'split conversation'], [
  'M12.75 3.75H5.35A2.85 2.85 0 0 0 2.5 6.6V8.5A2.25 2.25 0 0 1 2.5 13V14.9A2.85 2.85 0 0 0 5.35 17.75H12.75Z',
  'M16.25 6.25H18.65A2.85 2.85 0 0 1 21.5 9.1V11A2.25 2.25 0 0 0 21.5 15.5V17.4A2.85 2.85 0 0 1 18.65 20.25H16.25Z',
]);
// Linked: two flat tickets (the core's corners and notches, no perforation: at this height it
// crowded them), one above the other on the square's keylines, joined at their centers
add('ticket-link', ['tickets relacionados', 'vincular casos', 'incidente y problema', 'linked tickets', 'related tickets'], [
  ticket(3.25, 3.25, 17.5, 7.25, 2, 1.75),
  ticket(3.25, 13.5, 17.5, 7.25, 2, 1.75),
  vl(12, 10.5, 13.5),
]);
add('ticket-reopen', ['reabrir ticket', 'volver a abrir', 'caso reabierto', 'reopen ticket', 'reopened'], TICKET_B, { badge: REOPEN });
add('ticket-hold', ['ticket en espera', 'en pausa', 'esperando a terceros', 'on hold', 'ticket paused'], TICKET_B, { badge: PAUSE });

// ── Queues and assignment ─────────────────────────────────────────────────────────────────────
// Take a number: the dispenser (the signature corner) and the paper tab, torn in a zigzag, pulled out
// of it: its top edge (the slot) inside the dispenser, in front of its lower edge, a piece the engine
// clears from 12.25 down, so the edge keeps a straight stub on each side at every weight (a wider tab
// left the right stub at the square corner). With the tab's sides on the edge itself it read as a
// mushroom. Filled, the dispenser is solid and the paper stays a line: solid, the two read as a T-shirt
const numberTab = (top) => `M8.5 ${top}V19.5L10.25 21.25L12 19.5L13.75 21.25L15.5 19.5V${top}Z`;
add('take-a-number', ['tomar turno', 'turnero', 'fila', 'take a number', 'queue ticket', 'turn'], [sq(3.75, 2.75, 16.5, 9, 3, { square: ['br'] })], {
  badge: own([numberTab(8.75)], numberTab(12.25)),
});
// Round robin: three agents on a ring of r 7.25 and the three arc arrows that hand the turn on
const RR = [12, 12.25];
const RR_ARROW = arcArrow(...RR, 7.25, -90 + 37.5, 30 - 37.5);
add('round-robin', ['asignación por turnos', 'rotación', 'reparto equitativo', 'round robin', 'rotation'], [
  ...[0, 120, 240].map((deg) => circ(...polar(...RR, 7.25, -90 + deg), 1.75)),
  ...[0, 120, 240].flatMap((deg) => RR_ARROW.map((d) => (deg ? turnPath(d, deg, RR) : d))),
]);
// Omnichannel: the core inbox's tray (its lower part: the dip, the sides and the signature corner)
const TRAY = `${N.inbox.d[1]}V20.25H9.4c-2.24 0 -3.36 0 -4.22 -0.44a4 4 0 0 1 -1.75 -1.75c-0.44 -0.86 -0.44 -1.98 -0.44 -4.22Z`;
// and over it three channels, each a line from its source (a dot) toward the tray: bare strokes read
// as rays leaving the tray, and strokes that join read as a download arrow
add('omnichannel', ['omnicanal', 'bandeja unificada', 'todos los canales', 'omnichannel', 'unified inbox'], [
  TRAY,
  line([4.25, 4.25], [9, 9]),
  vl(12, 3.25, 10),
  line([19.75, 4.25], [15, 9]),
  dot(4.25, 4.25),
  dot(12, 3.25),
  dot(19.75, 4.25),
]);

// ── Agents ────────────────────────────────────────────────────────────────────────────────────
// The agent: the core person and comunicacion's headset over it (its band, two cups and the boom
// that turns toward the mouth, ending in the capsule), a piece the engine clears from the head
/** The core person at scale s about the middle of its base. */
const personAt = (s) => N.person.d.map((d) => move(d, s, [12, 20.6]));
/**
 * The headset over a head at (cx, cy) of radius hr: the band, cups that hang from its ends (the band
 * ends on their tops), and the boom straight from the left cup's inner side to the capsule at the
 * corner of the mouth, on the head's outline, so the head is cut once and the shoulders not at all.
 */
function headset(cx, cy, hr, { w = 3, mic = [1.6, 2.25] } = {}) {
  const R = hr + 3.25;
  const band = arc(cx, cy, R, 180, 360).d;
  const cup = (x) => sq(x - w / 2, cy, w, 5.25, w / 2);
  const end = [cx - mic[0] * (hr / 3.145), cy + mic[1] * (hr / 3.145)];
  const boom = line([cx - R + w / 2, end[1]], end);
  const dotD = dot(...end);
  const cups = [cup(cx - R), cup(cx + R)];
  return { band, cups, boom, mic: dotD, d: [band, ...cups, boom, dotD] };
}
const AGENT_S = 0.85;
const AGENT = personAt(AGENT_S);
const AGENT_HEAD = [12, 20.6 - 13.15 * AGENT_S];
const AGENT_KIT = headset(...AGENT_HEAD, 3.7 * AGENT_S);
add('support-agent', ['agente de soporte', 'hablar con un agente', 'atención', 'support agent', 'talk to an agent'], AGENT, {
  badge: own(AGENT_KIT.d, `${AGENT_KIT.cups.join('')}${AGENT_KIT.boom}${AGENT_KIT.mic}`, { solid: [...AGENT_KIT.cups, AGENT_KIT.mic], wire: [AGENT_KIT.band, AGENT_KIT.boom] }),
});
// Under a badge the headset keeps its band and cups: the badge says the rest (the boom would be a stub)
add('headset-clock', ['horario de atención', 'horas de soporte', 'disponibilidad', 'support hours', 'business hours'], [
  arc(12, 12, 8.25, 180, 360).d,
  sq(3.75, 12, 4.5, 6.75, 1.5, { square: ['tl'] }),
  sq(15.75, 12, 4.5, 6.75, 1.5, { square: ['tr'] }),
], { badge: badge('clock') });

// ── Calls and chat ────────────────────────────────────────────────────────────────────────────
// IVR: the core handset at 0.6 on the left, and to its right the menu: a bracket whose three
// branches end in dots, 3 clear of the handset (at 1.7 they ran together at bold)
const PHONE_S = move(N.phone.d[0], 0.6, [3.25, 12], -0.6, 0.25);
add('phone-menu', ['menú telefónico', 'marque uno', 'conmutador', 'phone menu', 'ivr', 'call tree'], [
  PHONE_S,
  rline([[19.5, 4.75], [16.25, 4.75], [16.25, 19.25], [19.5, 19.25]], [0, 2, 2, 0]),
  hl(12, 16.25, 19.5),
  dot(20.25, 4.75),
  dot(20.25, 12),
  dot(20.25, 19.25),
]);
// Launcher: the top-left corner of a page and the bubble button over its bottom right corner
add('chat-launcher', ['lanzador de chat', 'botón de chat', 'messenger', 'chat launcher', 'chat button'], [
  rline([[3.25, 15.5], [3.25, 3.25], [15.5, 3.25]], [0, 4, 0]),
  drop(15.25, 15.25, 5.5),
]);
// The widget: the panel with its header and two messages, and its launcher below at its right edge,
// together the portrait keyline; the launcher stands 3 below the panel (at 2.25 they touched at bold)
add('chat-widget', ['widget de chat', 'chat en vivo', 'panel de chat', 'chat widget', 'live chat'], [
  sq(4.75, 2.25, 14.5, 12, 3, { square: ['br'] }),
  hl(5.25, 4.75, 19.25),
  hl(8.25, 8, 13),
  hl(11.25, 11, 16),
  drop(17, 19.5, 2.25),
]);
// An internal note: the core bubble dashed (only agents see it) with the message's two lines
/** Dashes along the drop: n of them, each `len` long, one centered on the square corner. */
function dashedDrop(cx, cy, r, n, len) {
  const segs = [
    { l: Math.PI * 1.5 * r, at: (s) => polar(cx, cy, r, 90 + (s / r) * (180 / Math.PI)), arc: true },
    { l: r, at: (s) => [cx + r, cy + s] },
    { l: r, at: (s) => [cx + r - s, cy + r] },
  ];
  // Path order: from the bottom middle, around the round part, down the right side and back along the bottom
  const total = segs.reduce((t, s) => t + s.l, 0);
  const span = (s0, s1) => {
    let out = '';
    let base = 0;
    for (const s of segs) {
      const [a, b] = [Math.max(s0, base), Math.min(s1, base + s.l)];
      if (b > a) {
        const [p0, p1] = [s.at(a - base), s.at(b - base)];
        out += out ? '' : `M${P(p0)}`;
        out += s.arc ? `A${f(r)} ${f(r)} 0 0 1 ${P(p1)}` : `L${P(p1)}`;
      }
      base += s.l;
    }
    return out;
  };
  const step = total / n;
  const corner = total - r; // where the square corner falls along the path
  return Array.from({ length: n }, (_, k) => {
    const mid = corner + k * step;
    const [s0, s1] = [mid - len / 2, mid + len / 2].map((v) => ((v % total) + total) % total);
    if (s1 < s0) return `${span(s0, total)}${span(0, s1).replace(/^M[^AL]*/, '')}`;
    return span(s0, s1);
  });
}
add('internal-note', ['nota interna', 'solo agentes', 'comentario privado', 'internal note', 'private comment'], [
  ...dashedDrop(12, 11.75, 8.75, 10, 2.75),
  hl(10.25, 8, 15.5),
  hl(13.75, 8, 12.25),
]);
// A complaint: a bubble that shouts, its round part jagged and its corner the drop's square one
const SHOUT = (() => {
  const [cx, cy, n] = [12, 11.75, 6];
  const pts = [[20.75, 20.5]];
  const rr = [0];
  for (let i = 0; i <= 2 * n; i++) {
    const a = 90 + (270 * i) / (2 * n);
    const edge = i === 0 || i === 2 * n;
    pts.push(polar(cx, cy, edge ? 8.75 : i % 2 ? 6.6 : 9.4, a));
    rr.push(edge ? 0.4 : 0.7);
  }
  return roundpoly(pts, rr);
})();
add('complaint', ['queja', 'reclamo', 'inconformidad', 'complaint', 'grievance'], [SHOUT, vl(12, 8, 12.25), dot(12, 15.95)]);

// ── Escalation and service levels ─────────────────────────────────────────────────────────────
// Escalate: three steps rising to the right, and the arrow that climbs over them to the top step
add('escalate', ['escalar', 'siguiente nivel', 'subir de nivel', 'escalate', 'next tier'], [
  roundpoly([[4.5, 20.75], [4.5, 18], [10, 18], [10, 14.25], [15.5, 14.25], [15.5, 10.5], [20.75, 10.5], [20.75, 20.75]], [1, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 1]),
  line([3.25, 13.5], [12.75, 5.25]),
  head([12.75, 5.25], [9.5, -8.25]),
]);
// SLA: the core shield holding a clock's hands (at twelve and eight, clear of a badge's corner)
const SLA_HANDS = line([12, 7.5], [12, 12], polar(12, 12, 3.25, 150));
add('sla', ['acuerdo de nivel de servicio', 'tiempo garantizado', 'compromiso', 'sla', 'service level'], [SHIELD, SLA_HANDS]);
add('sla-breach', ['sla incumplido', 'fuera de tiempo', 'vencido', 'sla breach', 'overdue'], [SHIELD, SLA_HANDS], { badge: badge('alert') });
// 24/7: the core refresh, the ring arrow that runs clockwise, around a clock's hands. A face inside
// the ring could not keep its hands and the arrowhead clear of it (navegacion's history is the same
// clock turning back, counterclockwise)
add('around-the-clock', ['24/7', 'siempre abierto', 'todo el día', 'around the clock', 'always open'], [
  ...N.refresh.d,
  line([12, 8.15], [12, 12.4], [14.85, 14.15]),
]);
// Follow the sun: the core globe at 0.62, the arc 3 out from it over its top, and at the arc's end the
// sun, a ring whose rays fan out away from the globe. The sun stands clear of the globe and the arc
// (2.85 between strokes): cleared from them, its clearance cut the globe's ring next to the pole, where
// the meridian meets it, and the pieces joined at some weights and not at others
const FTS = [9, 15];
const FTS_G = 9 * 0.62;
const FTS_SUN = [16, 7.75];
const FTS_SR = 1.5;
const FTS_END = (() => {
  // Where the arc stops: 2.85 from the sun's ring
  const [R, D, gap] = [FTS_G + 3, Math.hypot(FTS_SUN[0] - FTS[0], FTS_SUN[1] - FTS[1]), FTS_SR + 2.85];
  const at = (Math.atan2(FTS_SUN[1] - FTS[1], FTS_SUN[0] - FTS[0]) * 180) / Math.PI;
  return at - (Math.acos((R * R + D * D - gap * gap) / (2 * R * D)) * 180) / Math.PI;
})();
add('follow-the-sun', ['seguir al sol', 'zonas horarias', 'soporte global', 'follow the sun', 'global support'], [
  ...N.globe.d.map((d) => move(d, 0.62, [12, 12], FTS[0] - 12, FTS[1] - 12)),
  arc(...FTS, FTS_G + 3, -145, FTS_END).d,
  circ(...FTS_SUN, FTS_SR),
  ...[-65, -20, 25].map((a) => line(polar(...FTS_SUN, FTS_SR + 2.9, a), polar(...FTS_SUN, FTS_SR + 5, a))),
]);

// ── Help center and guides ────────────────────────────────────────────────────────────────────
// Knowledge base: an open book, low and wide, and a large question mark standing over its spine
const KB_BOOK = 'M12 16A12 12 0 0 0 2.75 14.25L2.75 19.5A12 12 0 0 1 12 21.25A12 12 0 0 1 21.25 19.5L21.25 14.25A12 12 0 0 0 12 16Z';
add('knowledge-base', ['base de conocimiento', 'centro de ayuda', 'artículos', 'knowledge base', 'help center'], [
  KB_BOOK,
  vl(12, 16, 21.25),
  ...question(12, 5, 2.25),
]);
// The repairs: sistema's wrench at 0.64 in front of a book or a phone moved 1.5 to the left, its head
// straddling the container's right edge (its center 0.25 past it) at mid-height and its handle on the
// cover or the screen, a piece the engine clears. The container keeps its top, its corners and the
// phone its speaker; the check of smartphone-repair-check fits below the wrench. Lying across the whole
// container, the wrench ate its top right corner and the speaker, and the cuts changed with the weight
const WRENCH_HEAD = [12 + 5.125 * Math.SQRT1_2, 12 - 5.125 * Math.SQRT1_2]; // its head's center
/** sistema's wrench at 0.64 with its head's center at (x, y). */
const wrenchAt = (x, y) => move(WRENCH, 0.64, WRENCH_HEAD, x - WRENCH_HEAD[0], y - WRENCH_HEAD[1]);
const left = (ds) => ds.map((d) => move(d, 1, [12, 12], -1.5));
// Repair guide: archivos' book (without its ribbon, which the handle would cut)
const GUIDE = left([BOOK[0], BOOK[1]]);
const GUIDE_WRENCH = wrenchAt(18, 10.25);
add('repair-guide', ['guía de reparación', 'manual', 'cómo arreglar', 'repair guide', 'how-to'], GUIDE, {
  badge: own([GUIDE_WRENCH], GUIDE_WRENCH, { solid: [GUIDE_WRENCH] }),
});
// Search the help center: the core magnifier with a question mark in its lens
add('search-question', ['buscar ayuda', 'preguntas frecuentes', 'buscar respuesta', 'search help', 'faq search'], [
  ...SEARCH,
  ...question(10.6, 8.25, 1.5, 3.55),
]);
// A workaround: the path stopped by a bar, and the arrow that leaves it, goes over the bar and
// comes back down to carry on
const WY = 12.75;
add('workaround', ['solución alterna', 'rodeo', 'alternativa', 'workaround', 'detour'], [
  hl(WY, 2.75, 9.5),
  vl(9.5, WY - 2.5, WY + 2.5),
  `M4 ${f(WY)}${arc(9.5, WY, 5.5, 180, 360).d.replace(/^M[^A]*/, '')}H21.25`,
  head([21.25, WY], [1, 0]),
]);
// Community help: two people (the core's clients) and a speech bubble with a question mark
const ASK = (() => {
  const b = drop(...BC, 4.25);
  const q = badge('question').d.slice(1);
  return own([RING, b, ...q], b, { solid: [RING, b], cut: q });
})();
add('community-help', ['ayuda de la comunidad', 'foro de soporte', 'clientes ayudan', 'community help', 'peer support'], N.clients.d, { badge: ASK });

// ── Feedback ──────────────────────────────────────────────────────────────────────────────────
// Satisfaction kiosk: a slanted panel on a post, its question and three round buttons on it
add('feedback-kiosk', ['terminal de satisfacción', 'encuesta en tienda', 'botones de opinión', 'feedback kiosk', 'satisfaction terminal'], [
  roundpoly([[2.75, 3.25], [21.25, 3.25], [19.25, 14.25], [4.75, 14.25]], 2),
  hl(6.75, 8, 16),
  dot(8, 10.5),
  dot(12, 10.5),
  dot(16, 10.5),
  vl(12, 14.25, 20.75),
  hl(20.75, 8, 16),
]);

// ── Repairs ───────────────────────────────────────────────────────────────────────────────────
// The device in for repair: dispositivos' smartphone and the wrench (above). It stays a line in the
// fill as well: with the check's disc it has to (only a status ring is solid in every style), and the
// pair keeps one drawing
const REPAIR = left(PHONE);
const REPAIR_WRENCH = wrenchAt(16.5, 10.25);
add('smartphone-repair', ['reparar celular', 'servicio técnico', 'agendar reparación', 'phone repair', 'device repair'], REPAIR, {
  badge: own([REPAIR_WRENCH], REPAIR_WRENCH),
});
add('smartphone-repair-check', ['reparación lista', 'equipo listo', 'reparado', 'repair complete', 'device ready'], REPAIR, {
  badge: own([RING, badge('check').d[1], REPAIR_WRENCH], `${RING}${REPAIR_WRENCH}`, { solid: [RING], cut: [badge('check').d[1]], wire: [REPAIR_WRENCH] }),
});
// A cracked screen: the smartphone with a zigzag crack running down from its right edge
add('smartphone-cracked', ['pantalla rota', 'celular estrellado', 'daño', 'cracked screen', 'broken phone'], [
  ...PHONE,
  line([17.75, 8.75], [14.25, 11.25], [15.25, 13.5], [11.5, 15.5], [12.25, 17.75], [9.25, 21.25]),
]);
// Service center: lugares' map pin with a wrench in its head
const PIN_WRENCH = (() => {
  const c = [12, 10.25];
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const J = [c[0] + 1.6 * u[0], c[1] + 1.6 * u[1]];
  const jaw = arc(...J, 2, -45 + 50, 315 - 50).d;
  const back = polar(...J, 2, 135);
  return [jaw, line(back, [c[0] - 3.6 * u[0], c[1] - 3.6 * u[1]])];
})();
add('service-center', ['centro de servicio', 'taller autorizado', 'dónde reparar', 'service center', 'repair shop'], [PIN, ...PIN_WRENCH]);
// Status page: navegacion's browser (it is a public web page) whose rows each end in a status dot.
// Two rows: under the bar, three would bring the dots closer than their clearance, and a document
// with three is negocios' scorecard
add('status-page', ['página de estado', 'estado del servicio', 'disponibilidad', 'status page', 'uptime'], [
  ...BROWSER,
  ...[12, 16.5].flatMap((y) => [hl(y, 7, 13), dot(16.75, y)]),
]);

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: `solid` filled (closed shapes), `cut` knocked out, `lines` on top with a
// clearance of paper, `wire` on top and attached. Badges carry their own.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const TICKET_FILL = { solid: [0], cut: [1] };
const FILL = {
  'ticket-stack': { solid: [0], cut: [1, 2], lines: [3, 4] },
  'ticket-merge': { solid: [0], cut: [1, 2], wire: [3, 4] },
  'ticket-split': { solid: [0, 1] },
  'ticket-link': { solid: [0, 1], wire: [2] },
  'take-a-number': { solid: [0] },
  'round-robin': { solid: [0, 1, 2], lines: range(3, 8) },
  omnichannel: { solid: [0], lines: range(1, 6) },
  'support-agent': { solid: [0, 1] },
  'headset-clock': { solid: [1, 2], wire: [0] },
  'phone-menu': { solid: [0, 3, 4, 5], wire: [1, 2] },
  'chat-launcher': { solid: [1], wire: [0] },
  'chat-widget': { solid: [0, 4], cut: [1, 2, 3] },
  complaint: { solid: [0], cut: [1, 2] },
  escalate: { solid: [0], lines: [1, 2] },
  sla: { solid: [0], cut: [1] },
  'sla-breach': { solid: [0], cut: [1] },
  'follow-the-sun': { solid: [0, 4], cut: [1, 2], lines: [3, 5, 6, 7] },
  'knowledge-base': { solid: [0, 3], cut: [1], lines: [2] },
  'repair-guide': { solid: [0], cut: [1] },
  'community-help': { solid: [0, 1], lines: [2, 3] },
  'feedback-kiosk': { solid: [0], cut: [1, 2, 3, 4], wire: [5, 6] },
  'smartphone-repair': { solid: [0], cut: [1] },
  'smartphone-repair-check': { solid: [0], cut: [1] },
  'smartphone-cracked': { solid: [0], cut: [1, 2] },
  'service-center': { solid: [0], cut: [1, 2] },
  'status-page': { solid: [0], cut: range(1, 5) },
};
const TICKETS = ['ticket-plus', 'ticket-check', 'ticket-clock', 'ticket-alert', 'ticket-escalated', 'ticket-reopen', 'ticket-hold'];
for (const name of TICKETS) FILL[name] = TICKET_FILL;
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, ix]) => [k, pick(ix)]));
}
// Made only of lines: the dashed bubble, the magnifier (as the core search and its family), the detour
// and the ring arrow (as the core refresh)
for (const name of ['internal-note', 'search-question', 'workaround', 'around-the-clock']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const PARTS = {
  'ticket-stack': { body: [0], perforation: [1, 2], stack: [3, 4] },
  'ticket-merge': { body: [0], perforation: [1, 2], branches: [3, 4] },
  'ticket-split': { body: [0], stub: [1] },
  'ticket-link': { body: [0], linked: [1], link: [2] },
  'take-a-number': { dispenser: [0] },
  'round-robin': { agents: [0, 1, 2], arrows: range(3, 8) },
  omnichannel: { tray: [0], channels: range(1, 6) },
  'support-agent': { head: [0], body: [1] },
  'headset-clock': { band: [0], cups: [1, 2] },
  'phone-menu': { handset: [0], menu: [1, 2], options: [3, 4, 5] },
  'chat-launcher': { page: [0], button: [1] },
  'chat-widget': { panel: [0], header: [1], messages: [2, 3], button: [4] },
  'internal-note': { bubble: range(0, 9), lines: [10, 11] },
  complaint: { bubble: [0], mark: [1, 2] },
  escalate: { stairs: [0], arrow: [1, 2] },
  sla: { shield: [0], hands: [1] },
  'sla-breach': { shield: [0], hands: [1] },
  'around-the-clock': { arrow: [0, 1], hands: [2] },
  'follow-the-sun': { globe: [0, 1, 2], path: [3], sun: [4, 5, 6, 7] },
  'knowledge-base': { book: [0, 1], mark: [2, 3] },
  'repair-guide': { cover: [0], spine: [1] },
  'search-question': { lens: [0], handle: [1], mark: [2, 3] },
  workaround: { path: [0], bar: [1], detour: [2, 3] },
  'community-help': { front: [0, 1], back: [2, 3] },
  'feedback-kiosk': { panel: [0], label: [1], buttons: [2, 3, 4], stand: [5, 6] },
  'smartphone-repair': { phone: [0], speaker: [1] },
  'smartphone-repair-check': { phone: [0], speaker: [1] },
  'smartphone-cracked': { phone: [0], speaker: [1], crack: [2] },
  'service-center': { pin: [0], wrench: [1, 2] },
  'status-page': { window: [0], bar: [1], rows: [2, 4], status: [3, 5] },
};
for (const name of TICKETS) PARTS[name] = { body: [0], perforation: [1] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const MOTION = {
  'ticket-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'ticket-escalated': { effect: 'slide', parts: ['badge'], vector: [0, -1.5] },
  'ticket-reopen': { effect: 'spin', parts: ['badge'], origin: BC },
  'ticket-merge': { effect: 'slide', parts: ['branches'], vector: [1.5, 0] },
  'ticket-split': { effect: 'slide', parts: ['stub'], vector: [1.5, 0] },
  'take-a-number': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
  'round-robin': { effect: 'spin', parts: ['arrows'], origin: RR },
  omnichannel: { effect: 'slide', parts: ['channels'], vector: [0, 1.5] },
  'phone-menu': { effect: 'ring', parts: ['handset'], origin: [7.75, 12.25] },
  'chat-launcher': { effect: 'bounce', parts: ['button'], vector: [0, -1.5] },
  complaint: { effect: 'wiggle', origin: [12, 20.5] },
  escalate: { effect: 'slide', parts: ['arrow'], vector: [1.5, -1.3] },
  sla: { effect: 'spin', parts: ['hands'], origin: [12, 12] },
  'sla-breach': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'around-the-clock': { effect: 'spin', parts: ['arrow'], origin: [12, 12.4] },
  'follow-the-sun': { effect: 'wiggle', parts: ['sun'], origin: FTS },
  'knowledge-base': { effect: 'bounce', parts: ['mark'], vector: [0, -1.5] },
  'repair-guide': { effect: 'wiggle', parts: ['badge'], origin: [18, 10.25] },
  workaround: { effect: 'slide', parts: ['detour'], vector: [1.5, 0] },
  'smartphone-repair': { effect: 'wiggle', parts: ['badge'], origin: [16.5, 10.25] },
  'service-center': { effect: 'bounce', vector: [0, -2] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirroring (DESIGN.md › Mirroring) ─────────────────────────────────────────────────────────
// What reads in a direction: the merge that flows into the ticket, the menu that branches out, the
// stairs that rise and the detour that carries on
for (const name of ['ticket-merge', 'phone-menu', 'escalate', 'workaround']) icons[name].mirror = true;

// ── Automatic variants ────────────────────────────────────────────────────────────────────────
// Already a ring: no circle around it. A slash through a detour says nothing.
for (const name of ['around-the-clock', 'round-robin']) icons[name].variants = { circle: false };
icons.workaround.variants = { slash: false };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps each drawing to the pixel grid and swaps the standard badges for their pixel
// versions; what still doesn't read is drawn again here, from pixel center to pixel center (a pixel
// is 1.5 of the canvas, its centers at 0.75 + 1.5k).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
const small = (name, d, fill, badge16) => {
  icons[name].small = { d, ...(fill && { fill }), ...(badge16 && { badge: badge16 }) };
};
/** The 24 px drawing with the engine's snap, and a pixel badge in place of ours. */
const snapped16 = (name, badge16) => {
  const { d, fill } = icons[name];
  const sn = snapper([...d, ...Object.values(fill || {}).flat()]);
  small(name, d.map(sn), fill && Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])), badge16);
};
// Reopen and hold, as the engine's pixel badges: no disc, a larger sign. Reopen is oficina's pixel
// arc arrow (task-reopen), hold two bars of five pixels
{
  const a = `M${P(g(9, 11))}A3 3 0 1 0 ${P(g(11, 9))}`;
  const h = pl([12, 8], [11, 9], [12, 10]);
  snapped16('ticket-reopen', { d: [a, h], knock: `${RING}${a}${h}` });
  const bars = [pl([10, 9], [10, 13]), pl([12, 9], [12, 13])];
  snapped16('ticket-hold', { d: bars, knock: `${RING}${bars.join('')}` });
}
// The agent: a head of four pixels, the band two pixels out, cups of two by four, the boom under the
// head toward the face, and the shoulders
{
  const [x, y] = g(7.5, 5.5);
  const head = circ(x, y, 2.25);
  const band = arc(x, y, 5.25, 180, 360).d;
  const cups = [sq(x - 6.75, y + 0.75, 1.5, 4.5, 0.75), sq(x + 5.25, y + 0.75, 1.5, 4.5, 0.75)];
  const boom = line([x - 5.25, y + 5.25], [x - 2.25, y + 5.25]);
  const body = `M${P([x - 5.25, y + 12.75])}V${f(y + 11.25)}A3 3 0 0 1 ${P([x - 2.25, y + 8.25])}H${f(x + 2.25)}A3 3 0 0 1 ${P([x + 5.25, y + 11.25])}V${f(y + 12.75)}Z`;
  small('support-agent', [head, body, band, ...cups, boom], { solid: [head, body, ...cups], wire: [band, boom] });
}
// Round robin: the three agents on a pixel ring and the arcs between them, without heads (two
// pixels of arrowhead read as noise)
{
  const C = [12, 12.75];
  const R = 7.5;
  const at = (deg) => polar(...C, R, deg);
  const agents = [-90, 30, 150].map((d) => circ(...at(d), 2.25));
  const arcs = [-90, 30, 150].map((d) => arc(...C, R, d + 30, d + 90).d);
  small('round-robin', [...agents, ...arcs], { solid: agents, lines: arcs });
}
// Follow the sun: the globe of eight pixels (its ring, meridian and equator) and the sun a ring of
// three pixels over its top right; the arc between them would only blur the globe's top
{
  const G = g(6, 10);
  const globe = [circ(...G, 6), `M${P(g(6, 6))}A7.5 7.5 0 0 1 ${P(g(6, 14))}A7.5 7.5 0 0 1 ${P(g(6, 6))}Z`, pl([2, 10], [10, 10])];
  const sun = circ(...g(12, 4), 1.5);
  small('follow-the-sun', [...globe, sun], { solid: [globe[0], sun], cut: [globe[1], globe[2]] });
}
// The widget: the panel snapped to the pixel and its launcher a drop of three pixels, two below it
// and flush with its right edge (snapped as drawn, the launcher was a grey blur)
{
  const panel = icons['chat-widget'].d.slice(0, 4);
  const sn = snapper(panel);
  const launcher = drop(px(11), px(13), 1.5);
  small('chat-widget', [...panel.map(sn), launcher], { solid: [sn(panel[0]), launcher], cut: panel.slice(1).map(sn) });
}
// Take a number: the dispenser and the tab with a torn edge of single pixels
{
  const box = sq(px(2), px(1), 18, 9, 2.25, { square: ['br'] });
  const torn = [[5, 13], [6, 14], [7, 13], [8, 14], [9, 13], [10, 14], [11, 13]];
  const tab = `${pl([5, 4], ...torn, [11, 4])}Z`;
  small('take-a-number', [box], { solid: [box] }, { d: [tab], knock: `${pl([5, 7.5], ...torn, [11, 7.5])}Z` });
}
// The repairs at 16 px: the wrench is a line (its jaw a ring of four pixels open to the top right,
// its handle a diagonal) beside the top right corner of a narrower book or phone, which keeps its
// shape; the check goes in its corner below
{
  const J = g(12, 4);
  const w = [arc(...J, 2.25, 5, 265).d, line([J[0] - 1.5, J[1] + 1.5], [J[0] - 6, J[1] + 6])];
  const knock = w.join('');
  const book = [sq(...g(2, 1), 10.5, 19.5, 2.25, { square: ['br'] }), pl([4, 1], [4, 14])];
  small('repair-guide', book, { solid: [book[0]], cut: [book[1]] }, { d: w, knock });
  const phone = [sq(...g(2, 1), 9, 19.5, 2.25, { square: ['br'] }), pl([4, 3], [6, 3])];
  small('smartphone-repair', phone, { solid: [phone[0]], cut: [phone[1]] }, { d: w, knock });
  const chk = badge('check', { size: 16 });
  small('smartphone-repair-check', phone, { solid: [phone[0]], cut: [phone[1]] }, { d: [...w, ...chk.d], knock: `${knock}${chk.knock}` });
}

export default { category: 'soporte', label: 'Soporte y servicio', icons };
