// A minimal OpenType (TrueType outlines) writer for Gota's icon fonts and the typefaces drawn with
// its engine, with no dependencies: glyf/loca, cmap (formats 4 and 12), hmtx, name, OS/2, post,
// gasp, a GSUB with ligatures (a name typed as text becomes its icon) and single substitutions (a
// typeface's features: case, tnum…), a GPOS with pair kerning (glyph pairs and classes), and for a
// variable font fvar, gvar, HVAR and STAT (and GDEF, for kerning that changes with the axis); plus
// WOFF2 (brotli, glyf and loca untransformed, which the format allows). Coordinates are integers in
// font units.
//   font({ family, style, weightClass, unitsPerEm, glyphs, cmap, ligatures, substitutions, kerning, axis, metrics, ranges }) → Buffer (sfnt)
// metrics (a typeface's vertical metrics, in font units): { ascender, descender, lineGap, xHeight,
// capHeight, winAscent, winDescent }; without them, the icons' square (ascender = em, descender 0).
// ranges: OS/2's four Unicode range words (the icons': Basic Latin and the Private Use Areas).
// fsType: OS/2 embedding (0 installable, the icons'; 2 restricted). names: copyright, trademark,
// manufacturer, designer, url, license, licenseUrl.
//   woff2(sfnt) → Buffer
// glyphs: [{ name, advance, contours: [[{ x, y, on }], …], overlap?, deltas?: [[[dx, dy], …] per region],
//   advanceDeltas?: [dx per region] }] (a glyph whose width changes along the axis: its phantom
//   advance point moves, and HVAR says so too)
// substitutions: [{ tag, map: Map(glyph → glyph) }], one lookup per feature
// kerning: { pairs: [{ first, second, value, deltas? }], classes: { first: [[glyph…]…], second:
//   [[glyph…]…], values: [{ first, second, value, deltas? }] } }: glyph pairs (exceptions, applied
//   first) and class pairs (indices into the class lists); `deltas`, one per region, for a value
//   that changes along the axis
// axis (variable): { tag, min, default, max, regions: [-1, 1] (peaks of each delta set), instances: [{ name, value }] }
import { brotliCompressSync, constants } from 'node:zlib';

// ── Bytes ──
class Writer {
  constructor() {
    this.b = [];
  }
  get length() {
    return this.b.length;
  }
  u8(v) {
    this.b.push(v & 255);
    return this;
  }
  u16(v) {
    return this.u8(v >> 8).u8(v);
  }
  i16(v) {
    return this.u16(v & 0xffff);
  }
  u32(v) {
    return this.u16((v >>> 16) & 0xffff).u16(v & 0xffff);
  }
  fixed(v) {
    return this.u32(Math.round(v * 65536) >>> 0);
  }
  f2dot14(v) {
    return this.i16(Math.round(v * 16384));
  }
  tag(s) {
    for (const c of s.padEnd(4, ' ')) this.u8(c.charCodeAt(0));
    return this;
  }
  bytes(list) {
    for (const v of list) this.b.push(v);
    return this;
  }
  pad(n = 4) {
    while (this.b.length % n) this.b.push(0);
    return this;
  }
  /** Writes a 16-bit placeholder; returns a setter for it. */
  slot16() {
    const at = this.b.length;
    this.u16(0);
    return (v) => {
      this.b[at] = (v >> 8) & 255;
      this.b[at + 1] = v & 255;
    };
  }
  slot32() {
    const at = this.b.length;
    this.u32(0);
    return (v) => {
      for (let k = 0; k < 4; k++) this.b[at + k] = (v >>> (24 - 8 * k)) & 255;
    };
  }
  buffer() {
    return Buffer.from(this.b);
  }
}
const checksum = (buf) => {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 4) sum = (sum + ((buf[i] << 24) | ((buf[i + 1] ?? 0) << 16) | ((buf[i + 2] ?? 0) << 8) | (buf[i + 3] ?? 0))) >>> 0;
  return sum;
};
const log2 = (n) => Math.floor(Math.log2(n));

// ── Glyphs ──
function bounds(g) {
  const pts = g.contours.flat();
  if (!pts.length) return [0, 0, 0, 0];
  return [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))];
}
/** A simple glyph: contours of points, no instructions. */
function simpleGlyph(g) {
  const w = new Writer();
  if (!g.contours.length) return w.buffer();
  const [x0, y0, x1, y1] = bounds(g);
  w.i16(g.contours.length).i16(x0).i16(y0).i16(x1).i16(y1);
  let end = -1;
  for (const c of g.contours) w.u16((end += c.length));
  w.u16(0);
  const pts = g.contours.flat();
  const flags = [];
  const xs = new Writer();
  const ys = new Writer();
  let [px, py] = [0, 0];
  pts.forEach((p, i) => {
    let f = p.on ? 0x01 : 0;
    if (i === 0 && g.overlap) f |= 0x40;
    const [dx, dy] = [p.x - px, p.y - py];
    if (dx === 0) f |= 0x10;
    else if (Math.abs(dx) <= 255) {
      f |= 0x02 | (dx > 0 ? 0x10 : 0);
      xs.u8(Math.abs(dx));
    } else xs.i16(dx);
    if (dy === 0) f |= 0x20;
    else if (Math.abs(dy) <= 255) {
      f |= 0x04 | (dy > 0 ? 0x20 : 0);
      ys.u8(Math.abs(dy));
    } else ys.i16(dy);
    flags.push(f);
    [px, py] = [p.x, p.y];
  });
  w.bytes(flags).bytes(xs.b).bytes(ys.b);
  return w.pad(4).buffer();
}

// ── Packed deltas (gvar) ──
function packDeltas(values) {
  const w = new Writer();
  let i = 0;
  while (i < values.length) {
    if (values[i] === 0) {
      let n = 0;
      while (i + n < values.length && values[i + n] === 0 && n < 64) n++;
      w.u8(0x80 | (n - 1));
      i += n;
    } else if (Math.abs(values[i]) <= 127) {
      let n = 0;
      while (i + n < values.length && values[i + n] !== 0 && Math.abs(values[i + n]) <= 127 && n < 64) n++;
      w.u8(n - 1);
      for (let k = 0; k < n; k++) w.u8(values[i + k] & 255);
      i += n;
    } else {
      let n = 0;
      while (i + n < values.length && Math.abs(values[i + n]) > 127 && n < 64) n++;
      w.u8(0x40 | (n - 1));
      for (let k = 0; k < n; k++) w.i16(values[i + k]);
      i += n;
    }
  }
  return w.b;
}

// ── Tables ──
function nameTable(records) {
  const w = new Writer();
  const list = records.map(([id, text]) => ({ id, data: Buffer.from(text, 'utf16le').swap16() })).sort((a, b) => a.id - b.id);
  w.u16(0).u16(list.length).u16(6 + 12 * list.length);
  let offset = 0;
  for (const r of list) {
    w.u16(3).u16(1).u16(0x409).u16(r.id).u16(r.data.length).u16(offset);
    offset += r.data.length;
  }
  for (const r of list) w.bytes(r.data);
  return w.buffer();
}
function cmapTable(map) {
  const codes = [...map.keys()].sort((a, b) => a - b);
  const runs = (list, contiguous) => {
    const out = [];
    for (const c of list) {
      const last = out.at(-1);
      if (last && c === last.end + 1 && contiguous(last, c)) last.end = c;
      else out.push({ start: c, end: c, glyph: map.get(c) });
    }
    return out;
  };
  const same = (r, c) => map.get(c) === r.glyph + (c - r.start);
  // Format 4: the BMP
  const bmp = runs(codes.filter((c) => c <= 0xffff), same);
  const segs = [...bmp, { start: 0xffff, end: 0xffff, glyph: 0, last: true }];
  const f4 = new Writer();
  const n = segs.length;
  f4.u16(4).u16(16 + 8 * n).u16(0).u16(2 * n).u16(2 * 2 ** log2(n)).u16(log2(n)).u16(2 * n - 2 * 2 ** log2(n));
  for (const s of segs) f4.u16(s.end);
  f4.u16(0);
  for (const s of segs) f4.u16(s.start);
  for (const s of segs) f4.u16(s.last ? 1 : (s.glyph - s.start) & 0xffff);
  for (const _ of segs) f4.u16(0);
  // Format 12: everything
  const groups = runs(codes, same);
  const f12 = new Writer();
  f12.u16(12).u16(0).u32(16 + 12 * groups.length).u32(0).u32(groups.length);
  for (const g of groups) f12.u32(g.start).u32(g.end).u32(g.glyph);
  const w = new Writer();
  const encodings = [
    [0, 3, 'f4'],
    [0, 4, 'f12'],
    [3, 1, 'f4'],
    [3, 10, 'f12'],
  ];
  w.u16(0).u16(encodings.length);
  const base = 4 + 8 * encodings.length;
  const at = { f4: base, f12: base + f4.length };
  for (const [p, e, t] of encodings) w.u16(p).u16(e).u32(at[t]);
  w.bytes(f4.b).bytes(f12.b);
  return w.buffer();
}
// ── Layout tables (GSUB, GPOS) ──
const coverage = (w, glyphs) => {
  w.u16(1).u16(glyphs.length);
  for (const g of glyphs) w.u16(g);
};
/** ClassDef format 2: runs of consecutive glyphs in the same class. */
function classDef(w, classes) {
  const list = classes.flatMap((set, i) => set.map((g) => [g, i + 1])).sort((a, b) => a[0] - b[0]);
  const ranges = [];
  for (const [g, c] of list) {
    const last = ranges.at(-1);
    if (last && last[1] === g - 1 && last[2] === c) last[1] = g;
    else ranges.push([g, g, c]);
  }
  w.u16(2).u16(ranges.length);
  for (const [a, b, c] of ranges) w.u16(a).u16(b).u16(c);
}
/**
 * A GSUB or GPOS: scripts DFLT and latn, each with every feature; the features, sorted by tag, each
 * with its lookups; every subtable behind an extension (`extension`: 7 in GSUB, 9 in GPOS), so
 * offsets never overflow however large a subtable grows.
 */
function layoutTable(features, lookups, extension) {
  // features: [{ tag, lookups: [index…] }]; lookups: [{ type, subtables: [bytes…] }]
  const sorted = [...features].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const w = new Writer();
  w.u16(1).u16(0);
  const scriptList = w.slot16();
  const featureList = w.slot16();
  const lookupList = w.slot16();
  scriptList(w.length);
  const sl = w.length;
  w.u16(2);
  const scripts = ['DFLT', 'latn'].map((tag) => {
    w.tag(tag);
    return w.slot16();
  });
  for (const set of scripts) {
    set(w.length - sl);
    // The default language system right after the script table (offset 4), using every feature
    w.u16(4).u16(0);
    w.u16(0).u16(0xffff).u16(sorted.length);
    sorted.forEach((_, i) => w.u16(i));
  }
  featureList(w.length);
  const fl = w.length;
  w.u16(sorted.length);
  const featureSlots = sorted.map((f) => {
    w.tag(f.tag);
    return w.slot16();
  });
  sorted.forEach((f, i) => {
    featureSlots[i](w.length - fl);
    w.u16(0).u16(f.lookups.length);
    for (const l of f.lookups) w.u16(l);
  });
  lookupList(w.length);
  const ll = w.length;
  w.u16(lookups.length);
  const lookupSlots = lookups.map(() => w.slot16());
  const pending = [];
  lookups.forEach((lookup, i) => {
    lookupSlots[i](w.length - ll);
    const at = w.length;
    w.u16(extension).u16(0).u16(lookup.subtables.length);
    const subSlots = lookup.subtables.map(() => w.slot16());
    lookup.subtables.forEach((bytes, k) => {
      subSlots[k](w.length - at);
      const ext = w.length;
      w.u16(1).u16(lookup.type);
      pending.push({ ext, set: w.slot32(), bytes });
    });
  });
  for (const p of pending) {
    p.set(w.length - p.ext);
    w.bytes(p.bytes);
  }
  return w.buffer();
}
/** Ligature substitution subtables, one per first glyph (through extensions, so any number fits). */
function ligatureSubtables(ligatures) {
  // ligatures: [{ components: [glyphId…], glyph }]; grouped by the first component
  const byFirst = new Map();
  for (const l of ligatures) {
    if (!byFirst.has(l.components[0])) byFirst.set(l.components[0], []);
    byFirst.get(l.components[0]).push(l);
  }
  const firsts = [...byFirst.keys()].sort((a, b) => a - b);
  // One LigatureSubst subtable per first glyph, the longest sequences first (the shaper takes the first that matches)
  return firsts.map((first) => {
    const set = byFirst.get(first).sort((a, b) => b.components.length - a.components.length);
    const w = new Writer();
    w.u16(1);
    const cover = w.slot16();
    w.u16(1);
    const setOffset = w.slot16();
    setOffset(w.length);
    const setStart = w.length;
    w.u16(set.length);
    const ligSlots = set.map(() => w.slot16());
    set.forEach((l, i) => {
      ligSlots[i](w.length - setStart);
      w.u16(l.glyph).u16(l.components.length);
      for (const c of l.components.slice(1)) w.u16(c);
    });
    cover(w.length);
    coverage(w, [first]);
    return w.b;
  });
}
/** A single substitution (format 2): each covered glyph becomes its alternate. */
function singleSubtable(map) {
  const from = [...map.keys()].sort((a, b) => a - b);
  const w = new Writer();
  w.u16(2);
  const cover = w.slot16();
  w.u16(from.length);
  for (const g of from) w.u16(map.get(g));
  cover(w.length);
  coverage(w, from);
  return w.b;
}
/** GSUB: the ligatures ('liga', the icons') and each single substitution feature (a typeface's). */
function gsubTable(ligatures, substitutions) {
  const features = [];
  const lookups = [];
  if (ligatures.length) {
    features.push({ tag: 'liga', lookups: [lookups.length] });
    lookups.push({ type: 4, subtables: ligatureSubtables(ligatures) });
  }
  for (const { tag, map } of substitutions) {
    if (!map.size) continue;
    features.push({ tag, lookups: [lookups.length] });
    lookups.push({ type: 1, subtables: [singleSubtable(map)] });
  }
  return layoutTable(features, lookups, 7);
}

// ── Variation stores (HVAR, GDEF) ──
/**
 * An ItemVariationStore with one set of rows: the regions are the axis's ends (a peak of -1 or
 * 1, as gvar's shared tuples), each row one delta per region, as 16-bit words.
 */
function variationStore(rows, peaks) {
  const w = new Writer();
  w.u16(1);
  const regionsAt = w.slot32();
  w.u16(1);
  const dataAt = w.slot32();
  regionsAt(w.length);
  w.u16(1).u16(peaks.length);
  for (const p of peaks) w.f2dot14(Math.min(0, p)).f2dot14(p).f2dot14(Math.max(0, p));
  dataAt(w.length);
  w.u16(rows.length).u16(peaks.length).u16(peaks.length);
  peaks.forEach((_, i) => w.u16(i));
  for (const row of rows) for (const d of row) w.i16(d);
  return w.b;
}
/** HVAR: each glyph's advance deltas, with the glyph's index as its row (no mapping). */
function hvarTable(rows, peaks) {
  const w = new Writer();
  w.u16(1).u16(0).u32(20).u32(0).u32(0).u32(0);
  w.bytes(variationStore(rows, peaks));
  return w.buffer();
}
/** GDEF 1.3: only the variation store kerning's device tables point into. */
function gdefTable(rows, peaks) {
  const w = new Writer();
  w.u16(1).u16(3).u16(0).u16(0).u16(0).u16(0).u16(0).u32(18);
  w.bytes(variationStore(rows, peaks));
  return w.buffer();
}

/**
 * GPOS: one 'kern' lookup of pair adjustments (the first glyph's advance): glyph pairs first, then
 * class pairs. A value that changes along the axis points to a row of GDEF's variation store
 * (`row(deltas)` gives its index) through a VariationIndex device table.
 */
function gposTable(kerning, row) {
  const varies = (r) => row && r.deltas?.some((d) => d !== 0);
  const variable = Boolean(row) && [...kerning.pairs, ...(kerning.classes?.values ?? [])].some(varies);
  const format = 0x0004 | (variable ? 0x0040 : 0);
  // A value record (its advance, and where its device table will be) and the device tables after it
  const value = (w, r, devices, start) => {
    w.i16(r?.value ?? 0);
    if (!variable) return;
    if (r && varies(r)) devices.push({ set: w.slot16(), index: row(r.deltas), start });
    else w.u16(0);
  };
  // Each device table once, after the subtable; a record points to it from its own base
  const writeDevices = (w, devices) => {
    const written = new Map();
    for (const d of devices) {
      if (!written.has(d.index)) {
        written.set(d.index, w.length);
        w.u16(0).u16(d.index).u16(0x8000);
      }
      d.set(written.get(d.index) - d.start);
    }
  };
  const subtables = [];
  if (kerning.pairs.length) {
    const byFirst = new Map();
    for (const p of kerning.pairs) {
      if (!byFirst.has(p.first)) byFirst.set(p.first, []);
      byFirst.get(p.first).push(p);
    }
    const firsts = [...byFirst.keys()].sort((a, b) => a - b);
    const w = new Writer();
    const devices = [];
    w.u16(1);
    const cover = w.slot16();
    w.u16(format).u16(0).u16(firsts.length);
    const setSlots = firsts.map(() => w.slot16());
    firsts.forEach((first, i) => {
      // A PairSet's device offsets count from the PairSet itself (as HarfBuzz and fontTools read them)
      const start = w.length;
      setSlots[i](start);
      const set = byFirst.get(first).sort((a, b) => a.second - b.second);
      w.u16(set.length);
      for (const p of set) {
        w.u16(p.second);
        value(w, p, devices, start);
      }
    });
    cover(w.length);
    coverage(w, firsts);
    writeDevices(w, devices);
    subtables.push(w.b);
  }
  if (kerning.classes?.values.length) {
    const { first, second, values } = kerning.classes;
    const at = new Map(values.map((v) => [`${v.first},${v.second}`, v]));
    const w = new Writer();
    const devices = [];
    w.u16(2);
    const cover = w.slot16();
    w.u16(format).u16(0);
    const firstDef = w.slot16();
    const secondDef = w.slot16();
    w.u16(first.length + 1).u16(second.length + 1);
    // Class 0 of each side holds every glyph in no class: its row and column stay at zero
    for (let i = 0; i <= first.length; i++) for (let j = 0; j <= second.length; j++) value(w, i && j ? at.get(`${i - 1},${j - 1}`) : null, devices, 0);
    cover(w.length);
    coverage(w, first.flat().sort((a, b) => a - b));
    firstDef(w.length);
    classDef(w, first);
    secondDef(w.length);
    classDef(w, second);
    writeDevices(w, devices);
    subtables.push(w.b);
  }
  return layoutTable([{ tag: 'kern', lookups: [0] }], [{ type: 2, subtables }], 9);
}

/** The font (sfnt) as a Buffer. */
export function font({ family, style = 'Regular', weightClass = 400, unitsPerEm, version = '1.000', glyphs, cmap, ligatures = [], substitutions = [], kerning = null, axis = null, names = {}, metrics = null, ranges = [1, 1 << 28, 1 << 26, 0], fsType = 0 }) {
  const tables = {};
  const upm = unitsPerEm;
  const v = { ascender: upm, descender: 0, lineGap: 0, xHeight: 0, capHeight: 0, winAscent: upm, winDescent: 0, ...metrics };
  const numGlyphs = glyphs.length;
  // glyf / loca
  const glyf = new Writer();
  const loca = [0];
  const encoded = glyphs.map(simpleGlyph);
  for (const g of encoded) {
    glyf.bytes(g);
    loca.push(glyf.length);
  }
  tables.glyf = glyf.buffer();
  const lw = new Writer();
  for (const o of loca) lw.u32(o);
  tables.loca = lw.buffer();
  // Metrics
  const boxes = glyphs.map(bounds);
  const inked = boxes.filter((_, i) => glyphs[i].contours.length);
  const [xMin, yMin, xMax, yMax] = [Math.min(...inked.map((b) => b[0])), Math.min(...inked.map((b) => b[1])), Math.max(...inked.map((b) => b[2])), Math.max(...inked.map((b) => b[3]))];
  const head = new Writer();
  const created = 3870000000; // a fixed date, for reproducible builds (2026)
  head.u32(0x00010000).fixed(Number(version)).u32(0).u32(0x5f0f3cf5).u16(0x0009).u16(upm);
  head.u32(0).u32(created).u32(0).u32(created);
  head.i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(weightClass >= 700 ? 1 : 0).u16(8).i16(2).i16(1).i16(0);
  tables.head = head.buffer();
  const hhea = new Writer();
  const advances = glyphs.map((g) => g.advance);
  const lsbs = glyphs.map((g, i) => (g.contours.length ? boxes[i][0] : 0));
  const rsbs = glyphs.map((g, i) => (g.contours.length ? g.advance - boxes[i][2] : 0));
  hhea.u32(0x00010000).i16(v.ascender).i16(v.descender).i16(v.lineGap).u16(Math.max(...advances)).i16(Math.min(...lsbs)).i16(Math.min(...rsbs)).i16(xMax);
  hhea.i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs);
  tables.hhea = hhea.buffer();
  const hmtx = new Writer();
  glyphs.forEach((g, i) => hmtx.u16(g.advance).i16(lsbs[i]));
  tables.hmtx = hmtx.buffer();
  const maxp = new Writer();
  maxp.u32(0x00010000).u16(numGlyphs).u16(Math.max(...glyphs.map((g) => g.contours.flat().length))).u16(Math.max(...glyphs.map((g) => g.contours.length)));
  maxp.u16(0).u16(0).u16(1).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
  tables.maxp = maxp.buffer();
  // OS/2 (version 4)
  const os2 = new Writer();
  const wide = advances.filter((a) => a > 0);
  const codes = [...cmap.keys()];
  os2.u16(4).i16(Math.round(wide.reduce((s, a) => s + a, 0) / Math.max(1, wide.length))).u16(weightClass).u16(5).u16(fsType);
  for (const v of [0.65, 0.6, 0, 0.075, 0.65, 0.6, 0, 0.35]) os2.i16(Math.round(v * upm));
  os2.i16(Math.round(0.05 * upm)).i16(Math.round(0.25 * upm)).i16(0).bytes(new Array(10).fill(0));
  // Unicode ranges (the icons': Basic Latin, for the names typed as ligatures, and the Private Use Areas)
  for (const r of ranges) os2.u32(r >>> 0);
  os2.tag('FLVA');
  os2.u16((weightClass >= 700 ? 0x20 : 0x40) | 0x80).u16(Math.min(...codes)).u16(Math.min(0xffff, Math.max(...codes)));
  os2.i16(v.ascender).i16(v.descender).i16(v.lineGap).u16(v.winAscent).u16(Math.abs(v.winDescent)).u32(1).u32(0).i16(v.xHeight).i16(v.capHeight).u16(0).u16(0x20).u16(Math.max(kerning ? 2 : 1, ...ligatures.map((l) => l.components.length)));
  tables['OS/2'] = os2.buffer();
  // post (version 3: no glyph names)
  const post = new Writer();
  post.u32(0x00030000).u32(0).i16(-Math.round(0.075 * upm)).i16(Math.round(0.05 * upm)).u32(0).u32(0).u32(0).u32(0).u32(0);
  tables.post = post.buffer();
  // Smooth at every size, no hinting
  tables.gasp = new Writer().u16(1).u16(1).u16(0xffff).u16(0x000f).buffer();
  tables.cmap = cmapTable(cmap);
  if (ligatures.length || substitutions.some((s) => s.map.size)) tables.GSUB = gsubTable(ligatures, substitutions);
  // Kerning: values that change along the axis get rows in GDEF's variation store
  const kernRows = [];
  const kernRow = new Map();
  if (kerning && (kerning.pairs.length || kerning.classes?.values.length)) {
    const row = axis
      ? (deltas) => {
          const key = deltas.join(',');
          if (!kernRow.has(key)) kernRow.set(key, kernRows.push(deltas) - 1);
          return kernRow.get(key);
        }
      : null;
    tables.GPOS = gposTable(kerning, row);
    if (kernRows.length) tables.GDEF = gdefTable(kernRows, axis.regions);
  }
  // name
  const ps = `${family.replace(/\s+/g, '')}-${style.replace(/\s+/g, '')}`;
  const records = [
    [0, names.copyright ?? ''],
    [1, family],
    [2, style],
    [3, `${version};FLVA;${ps}`],
    [4, `${family} ${style}`],
    [5, `Version ${version}`],
    [6, ps],
    [7, names.trademark ?? ''],
    [8, names.manufacturer ?? 'Flouvia'],
    [9, names.designer ?? 'Flouvia'],
    [11, names.url ?? ''],
    [13, names.license ?? ''],
    [14, names.licenseUrl ?? ''],
  ].filter(([, t]) => t);
  if (axis) {
    records.push([25, family.replace(/\s+/g, '')], [256, 'Weight']);
    axis.instances.forEach((inst, i) => records.push([257 + i, inst.name]));
    // fvar
    const fvar = new Writer();
    fvar.u16(1).u16(0).u16(16).u16(2).u16(1).u16(20).u16(axis.instances.length).u16(8);
    fvar.tag(axis.tag).fixed(axis.min).fixed(axis.default).fixed(axis.max).u16(0).u16(256);
    axis.instances.forEach((inst, i) => fvar.u16(257 + i).u16(0).fixed(inst.value));
    tables.fvar = fvar.buffer();
    // STAT (1.1): the axis and a value per instance, Regular elidable
    const stat = new Writer();
    stat.u16(1).u16(1).u16(8).u16(1).u32(20).u16(axis.instances.length).u32(28).u16(2);
    stat.tag(axis.tag).u16(256).u16(0);
    const valueAt = 2 * axis.instances.length;
    axis.instances.forEach((_, i) => stat.u16(valueAt + 12 * i));
    axis.instances.forEach((inst, i) => stat.u16(1).u16(0).u16(inst.value === axis.default ? 0x0002 : 0).u16(257 + i).fixed(inst.value));
    tables.STAT = stat.buffer();
    // gvar: two shared peak tuples (the axis's ends); each glyph with deltas gets both, over all its points
    const gvar = new Writer();
    gvar.u16(1).u16(0).u16(1).u16(axis.regions.length);
    const sharedAt = gvar.slot32();
    gvar.u16(numGlyphs).u16(1);
    const dataAt = gvar.slot32();
    const offsets = glyphs.map(() => gvar.slot32());
    const lastOffset = gvar.slot32();
    sharedAt(gvar.length);
    for (const peak of axis.regions) gvar.f2dot14(peak);
    dataAt(gvar.length);
    const data0 = gvar.length;
    glyphs.forEach((g, gi) => {
      offsets[gi](gvar.length - data0);
      if (!g.deltas && !g.advanceDeltas?.some((d) => d !== 0)) return;
      // Every point, the four phantom points last: the origin stays and the advance point moves
      // with the glyph's width
      const points = g.contours.flat().length;
      const series = axis.regions.map((_, k) => {
        const set = g.deltas?.[k] ?? Array.from({ length: points }, () => [0, 0]);
        const all = [...set, [0, 0], [g.advanceDeltas?.[k] ?? 0, 0], [0, 0], [0, 0]];
        return [...packDeltas(all.map((d) => d[0])), ...packDeltas(all.map((d) => d[1]))];
      });
      gvar.u16(0x8000 | series.length);
      const dataOffset = gvar.slot16();
      const start = gvar.length - 4;
      series.forEach((s, ri) => gvar.u16(s.length).u16(ri));
      dataOffset(gvar.length - start);
      // Shared point numbers (0: every point), then each tuple's deltas
      gvar.u8(0);
      series.forEach((s) => gvar.bytes(s));
      gvar.pad(2);
    });
    lastOffset(gvar.length - data0);
    tables.gvar = gvar.buffer();
    // HVAR: the advances' deltas again, so a layout engine needn't run gvar to measure text
    if (glyphs.some((g) => g.advanceDeltas?.some((d) => d !== 0))) tables.HVAR = hvarTable(glyphs.map((g) => axis.regions.map((_, k) => g.advanceDeltas?.[k] ?? 0)), axis.regions);
  }
  tables.name = nameTable(records);
  return assemble(tables);
}

function assemble(tables) {
  const tags = Object.keys(tables).sort();
  const n = tags.length;
  const header = new Writer();
  header.u32(0x00010000).u16(n).u16(16 * 2 ** log2(n)).u16(log2(n)).u16(n * 16 - 16 * 2 ** log2(n));
  let offset = 12 + 16 * n;
  const body = [];
  const dir = [];
  for (const tag of tags) {
    const data = tables[tag];
    dir.push({ tag, sum: checksum(data), offset, length: data.length });
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    body.push(padded);
    offset += padded.length;
  }
  for (const r of dir) header.tag(r.tag).u32(r.sum).u32(r.offset).u32(r.length);
  const out = Buffer.concat([header.buffer(), ...body]);
  // head.checkSumAdjustment
  const headAt = dir.find((r) => r.tag === 'head').offset;
  out.writeUInt32BE((0xb1b0afba - checksum(out)) >>> 0, headAt + 8);
  return out;
}

// ── WOFF2 ──
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
const base128 = (v) => {
  const out = [];
  do {
    out.unshift(v & 0x7f);
    v = Math.floor(v / 128);
  } while (v > 0);
  return out.map((b, i) => (i < out.length - 1 ? b | 0x80 : b));
};
/** WOFF2 from an sfnt: tables brotli-compressed as one stream, glyf and loca with the null transform. */
export function woff2(sfnt) {
  const n = sfnt.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < n; i++) {
    const at = 12 + 16 * i;
    const tag = sfnt.toString('latin1', at, at + 4);
    const offset = sfnt.readUInt32BE(at + 8);
    const length = sfnt.readUInt32BE(at + 12);
    tables.push({ tag, data: sfnt.subarray(offset, offset + length) });
  }
  // loca right after glyf
  const glyfAt = tables.findIndex((t) => t.tag === 'glyf');
  const locaAt = tables.findIndex((t) => t.tag === 'loca');
  if (glyfAt >= 0 && locaAt >= 0) tables.splice(glyfAt + 1, 0, ...tables.splice(locaAt, 1));
  const dir = new Writer();
  for (const t of tables) {
    const k = KNOWN.indexOf(t.tag);
    // Transformation version 3 (null) for glyf and loca, 0 (null) for the rest
    const version = t.tag === 'glyf' || t.tag === 'loca' ? 3 : 0;
    dir.u8((k < 0 ? 63 : k) | (version << 6));
    if (k < 0) dir.tag(t.tag);
    dir.bytes(base128(t.data.length));
  }
  const stream = Buffer.concat(tables.map((t) => t.data));
  const compressed = brotliCompressSync(stream, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_FONT, [constants.BROTLI_PARAM_SIZE_HINT]: stream.length } });
  const total = 48 + dir.length + compressed.length;
  const padded = total + ((4 - (total % 4)) % 4);
  const head = new Writer();
  head.u32(0x774f4632).u32(sfnt.readUInt32BE(0)).u32(padded).u16(n).u16(0).u32(sfnt.length).u32(compressed.length).u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
  return Buffer.concat([head.buffer(), dir.buffer(), compressed, Buffer.alloc(padded - total)]);
}

// ── Reading back (to check what was written) ──
/**
 * The glyphs of an sfnt written here: [{ contours: [[{ x, y, on }]], deltas: [[[dx, dy]…] per shared
 * tuple] | null, advanceDeltas?: [dx per shared tuple] }], read from glyf/loca and gvar with no
 * shared code with the writer.
 */
export function readGlyphs(sfnt) {
  const tables = {};
  for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    tables[sfnt.toString('latin1', at, at + 4)] = sfnt.subarray(sfnt.readUInt32BE(at + 8), sfnt.readUInt32BE(at + 8) + sfnt.readUInt32BE(at + 12));
  }
  const { glyf, loca, maxp, gvar } = tables;
  const count = maxp.readUInt16BE(4);
  const glyphs = [];
  for (let g = 0; g < count; g++) {
    const [a, b] = [loca.readUInt32BE(4 * g), loca.readUInt32BE(4 * g + 4)];
    if (a === b) {
      glyphs.push({ contours: [], deltas: null, points: 0 });
      continue;
    }
    const d = glyf.subarray(a, b);
    const nc = d.readInt16BE(0);
    let p = 10;
    const ends = [];
    for (let i = 0; i < nc; i++, p += 2) ends.push(d.readUInt16BE(p));
    p += 2 + d.readUInt16BE(p);
    const n = ends.at(-1) + 1;
    const flags = [];
    while (flags.length < n) {
      const f = d[p++];
      flags.push(f);
      if (f & 0x08) for (let r = d[p++]; r > 0; r--) flags.push(f);
    }
    const coords = (short, same) => {
      const out = [];
      let v = 0;
      for (const f of flags) {
        if (f & short) v += f & same ? d[p++] : -d[p++];
        else if (!(f & same)) {
          v += d.readInt16BE(p);
          p += 2;
        }
        out.push(v);
      }
      return out;
    };
    const xs = coords(0x02, 0x10);
    const ys = coords(0x04, 0x20);
    const contours = [];
    let s = 0;
    for (const e of ends) {
      contours.push(flags.slice(s, e + 1).map((f, k) => ({ x: xs[s + k], y: ys[s + k], on: Boolean(f & 1) })));
      s = e + 1;
    }
    glyphs.push({ contours, deltas: null, points: n });
  }
  if (gvar) {
    const long = gvar.readUInt16BE(14) & 1;
    const dataAt = gvar.readUInt32BE(16);
    const off = (g) => (long ? gvar.readUInt32BE(20 + 4 * g) : 2 * gvar.readUInt16BE(20 + 2 * g));
    for (let g = 0; g < count; g++) {
      const [a, b] = [off(g), off(g + 1)];
      if (a === b) continue;
      const v = gvar.subarray(dataAt + a, dataAt + b);
      const tuples = v.readUInt16BE(0) & 0x0fff;
      let p = v.readUInt16BE(2);
      // Shared point numbers: 0 means every point
      if (v[p++] !== 0) throw new Error('gvar: only "every point" is read here');
      const total = glyphs[g].points + 4;
      const unpack = () => {
        const out = [];
        while (out.length < total) {
          const c = v[p++];
          const run = (c & 0x3f) + 1;
          for (let k = 0; k < run; k++) {
            if (c & 0x80) out.push(0);
            else if (c & 0x40) {
              out.push(v.readInt16BE(p));
              p += 2;
            } else out.push(v.readInt8(p++));
          }
        }
        return out;
      };
      const sets = [];
      for (let t = 0; t < tuples; t++) {
        const [dx, dy] = [unpack(), unpack()];
        const region = v.readUInt16BE(6 + 4 * t) & 0x0fff;
        sets[region] = dx.slice(0, glyphs[g].points).map((x, k) => [x, dy[k]]);
        (glyphs[g].advanceDeltas ??= [])[region] = dx[glyphs[g].points + 1];
      }
      glyphs[g].deltas = glyphs[g].points ? sets : null;
    }
  }
  return glyphs;
}
