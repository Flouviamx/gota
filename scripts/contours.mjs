// Path data → TrueType contours: on- and off-curve points in the path's own units, quadratic
// (cubics split until each piece strays under 0.005), each contour closed on its own. Shared by the
// icon fonts (scripts/font.mjs) and typefaces built on the engine (scripts/type.mjs).
export function parse(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const contours = [];
  let cur = null;
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = '';
  let i = 0;
  const n = () => Number(tokens[i++]);
  const close = () => {
    // A contour comes back to its start; TrueType closes it on its own (within a rounding: masters write thousandths)
    if (cur?.length > 1 && cur.at(-1).on && Math.abs(cur.at(-1).x - sx) < 0.005 && Math.abs(cur.at(-1).y - sy) < 0.005) cur.pop();
    [x, y] = [sx, sy];
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === 'm') cmd = 'l';
    else if (cmd === 'M') cmd = 'L';
    const rel = cmd === cmd.toLowerCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    switch (cmd.toUpperCase()) {
      case 'M':
        if (cur) close();
        [x, y] = [n() + ox, n() + oy];
        [sx, sy] = [x, y];
        cur = [{ x, y, on: true }];
        contours.push(cur);
        break;
      case 'L':
        [x, y] = [n() + ox, n() + oy];
        cur.push({ x, y, on: true });
        break;
      case 'H':
        x = n() + (rel ? x : 0);
        cur.push({ x, y, on: true });
        break;
      case 'V':
        y = n() + (rel ? y : 0);
        cur.push({ x, y, on: true });
        break;
      case 'Q': {
        const [cx, cy, px, py] = [n() + ox, n() + oy, n() + ox, n() + oy];
        cur.push({ x: cx, y: cy, on: false }, { x: px, y: py, on: true });
        [x, y] = [px, py];
        break;
      }
      case 'C': {
        // A cubic as quadratics: split until each piece's quadratic strays under 0.005
        const p = [[x, y], [n() + ox, n() + oy], [n() + ox, n() + oy], [n() + ox, n() + oy]];
        const dev = Math.hypot(p[3][0] - 3 * p[2][0] + 3 * p[1][0] - p[0][0], p[3][1] - 3 * p[2][1] + 3 * p[1][1] - p[0][1]) * (Math.sqrt(3) / 36);
        const k = Math.max(1, Math.ceil(Math.cbrt(dev / 0.005)));
        const at = (t) => {
          const u = 1 - t;
          return [0, 1].map((a) => u * u * u * p[0][a] + 3 * u * u * t * p[1][a] + 3 * u * t * t * p[2][a] + t * t * t * p[3][a]);
        };
        const tan = (t) => {
          const u = 1 - t;
          return [0, 1].map((a) => 3 * u * u * (p[1][a] - p[0][a]) + 6 * u * t * (p[2][a] - p[1][a]) + 3 * t * t * (p[3][a] - p[2][a]));
        };
        for (let s = 0; s < k; s++) {
          const [t0, t1] = [s / k, (s + 1) / k];
          const [a, b] = [at(t0), at(t1)];
          const [da, db] = [tan(t0).map((v) => v / k), tan(t1).map((v) => v / k)];
          // The control point: the end tangents averaged (exact for a quadratic)
          const c = [0, 1].map((m) => (a[m] + da[m] / 2 + (b[m] - db[m] / 2)) / 2);
          cur.push({ x: c[0], y: c[1], on: false }, { x: b[0], y: b[1], on: true });
        }
        [x, y] = p[3];
        break;
      }
      case 'Z':
        close();
        cur = null;
        break;
      default:
        throw new Error(`Unexpected path command ${cmd}`);
    }
  }
  return contours.filter((c) => c.length > 2);
}

const area = (c) => c.reduce((s, p, i) => s + p.x * c[(i + 1) % c.length].y - c[(i + 1) % c.length].x * p.y, 0) / 2;
/** TrueType turns outer contours clockwise: the largest one decides for the whole set (they're wound by depth). */
export const clockwise = (sets) => {
  const ref = sets[0];
  const big = ref.reduce((b, c) => (Math.abs(area(c)) > Math.abs(area(b)) ? c : b), ref[0]);
  return big && area(big) > 0 ? sets.map((cs) => cs.map((c) => [...c].reverse())) : sets;
};
/** Do two sets of contours have the same structure (contours, points, and which points are on the curve)? */
export const sameShape = (a, b) => a.length === b.length && a.every((c, i) => c.length === b[i].length && c.every((p, k) => p.on === b[i][k].on));
