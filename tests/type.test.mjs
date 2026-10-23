// Typefaces drawn with the engine (scripts/type.mjs): a two-letter typeface built in a temporary
// folder, its fonts read back. They need canvaskit-wasm (npm ci).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readGlyphs } from '../scripts/sfnt.mjs';

const SOURCE = `export default ({ circ, line, dot }) => ({
  family: 'Probe Sans', version: '1.000', copyright: 'Copyright (c) 2026 Probe', trademark: 'Probe is a mark', manufacturer: 'Probe', designer: 'Probe', url: 'https://example.com', licenseUrl: 'https://example.com/terms',
  metrics: { em: 20, ascender: 15.5, descender: -4.5, lineGap: 4, xHeight: 10, capHeight: 14, winAscent: 19, winDescent: -5.5 },
  capMarkShift: -4,
  glyphs: [
    { char: 'o', name: 'o', w: 8.8, l: 1.2, r: 1.2, d: [circ(4.4, -5, 4.4)] },
    { char: 'i', name: 'i', w: 0, l: 1.55, r: 1.55, d: [line([0, -9.25], [0, -0.75]), dot(0, -12.35, 0.3)] },
    { char: ' ', name: 'space', w: 0, l: 2.1, r: 2.1, d: [] },
  ],
  marks: { acute: [line([-0.7, -11.5], [0.9, -13.5])] },
  composites: [{ char: 'ó', name: 'oacute', base: 'o', mark: 'acute', cap: false }],
  words: ['oi'],
});
`;

test('type: a typeface as fonts (variable and static), its glyphs read back, its words as outlines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'type-'));
  try {
    writeFileSync(join(dir, 'glyphs.mjs'), SOURCE);
    writeFileSync(join(dir, 'LICENSE'), 'Probe: all rights reserved.\n');
    execFileSync(process.execPath, [new URL('../scripts/type.mjs', import.meta.url).pathname, dir, '--no-specimen']);
    assert.deepEqual(readdirSync(join(dir, 'fonts')).sort(), ['ProbeSans-Bold.ttf', 'ProbeSans-Bold.woff2', 'ProbeSans-Light.ttf', 'ProbeSans-Light.woff2', 'ProbeSans-Regular.ttf', 'ProbeSans-Regular.woff2', 'ProbeSans[wght].ttf', 'ProbeSans[wght].woff2', 'probe-sans.css']);
    // .notdef, o, i, space, oacute; the o a ring (two contours), the i a stem and its dot, the space empty
    const regular = readGlyphs(readFileSync(join(dir, 'fonts', 'ProbeSans-Regular.ttf')));
    assert.deepEqual(regular.map((g) => g.contours.length), [0, 2, 2, 0, 3]);
    // The variable font moves every point between Light and Bold
    const variable = readGlyphs(readFileSync(join(dir, 'fonts', 'ProbeSans[wght].ttf')));
    assert.ok(variable[1].deltas?.length === 2);
    // Embedding restricted (OS/2 fsType 2)
    const sfnt = readFileSync(join(dir, 'fonts', 'ProbeSans-Regular.ttf'));
    const os2 = [...Array(sfnt.readUInt16BE(4)).keys()].map((i) => 12 + 16 * i).find((o) => sfnt.toString('latin1', o, o + 4) === 'OS/2');
    assert.equal(sfnt.readUInt16BE(sfnt.readUInt32BE(os2 + 8) + 8), 2);
    assert.match(readFileSync(join(dir, 'words', 'oi-regular.svg'), 'utf8'), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="[^"]+" fill="currentColor"><path fill-rule="nonzero" d="M/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
