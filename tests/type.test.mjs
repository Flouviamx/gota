// Typefaces drawn with the engine (scripts/type.mjs): a two-letter typeface built in a temporary
// folder, its fonts read back. They need canvaskit-wasm (npm ci).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readGlyphs } from '../scripts/sfnt.mjs';

const SOURCE = `export default ({ circ, line, dot, stroke = 1.5 }) => ({
  family: 'Probe Sans', version: '1.000', copyright: 'Copyright (c) 2026 Probe', trademark: 'Probe is a mark', manufacturer: 'Probe', designer: 'Probe', url: 'https://example.com', licenseUrl: 'https://example.com/terms',
  metrics: { em: 20, ascender: 15.5, descender: -4.5, lineGap: 4, xHeight: 10, capHeight: 14, winAscent: 19, winDescent: -5.5 },
  pen: { contrast: 0.88 },
  capMarkShift: -4,
  glyphs: [
    // The o widens with the stroke, and so does its spacing
    { char: 'o', name: 'o', w: 8.8 + (stroke - 1.5), l: 1.2 + (stroke - 1.5) / 2, r: 1.2 + (stroke - 1.5) / 2, d: [circ(4.4 + (stroke - 1.5) / 2, -5, 4.4)] },
    { char: 'i', name: 'i', w: 0, l: 1.55, r: 1.55, d: [line([0, -9.25], [0, -0.75]), { solid: circ(0, -12.35, 0.3 + stroke / 2) }] },
    { char: 'T', name: 'T', w: 8.4, l: 0.6, r: 0.6, d: [line([0, -13.25], [8.4, -13.25]), line([4.2, -13.25], [4.2, -0.75])] },
    { char: '-', name: 'hyphen', w: 3.6, l: 1.1, r: 1.1, d: [line([0, -5], [3.6, -5])] },
    { char: null, name: 'hyphen.case', w: 3.6, l: 1.1, r: 1.1, d: [line([0, -7], [3.6, -7])] },
    { char: ' ', name: 'space', w: 0, l: 2.1, r: 2.1, d: [] },
  ],
  marks: { acute: [line([-0.7, -11.5], [0.9, -13.5])] },
  composites: [{ char: 'ó', name: 'oacute', base: 'o', mark: 'acute', cap: false }],
  kerning: { groups: { T_: ['T'], _o: ['o'] }, pairs: [['@T_', '@_o', stroke > 1.5 ? -1.6 : -1.9], ['T', '-', -1]] },
  words: ['oi', 'To'],
});
`;

test('type: a typeface as fonts (variable and static), its glyphs read back, its words as outlines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'type-'));
  try {
    writeFileSync(join(dir, 'glyphs.mjs'), SOURCE);
    writeFileSync(join(dir, 'LICENSE'), 'Probe: all rights reserved.\n');
    execFileSync(process.execPath, [new URL('../scripts/type.mjs', import.meta.url).pathname, dir, '--no-specimen']);
    assert.deepEqual(readdirSync(join(dir, 'fonts')).sort(), ['ProbeSans-Bold.ttf', 'ProbeSans-Bold.woff2', 'ProbeSans-Light.ttf', 'ProbeSans-Light.woff2', 'ProbeSans-Regular.ttf', 'ProbeSans-Regular.woff2', 'ProbeSans[wght].ttf', 'ProbeSans[wght].woff2', 'probe-sans.css']);
    // .notdef, o, i, T, hyphen, hyphen.case, space, oacute; the o a ring (two contours), the i a stem and its dot (a solid), the space empty
    const regular = readGlyphs(readFileSync(join(dir, 'fonts', 'ProbeSans-Regular.ttf')));
    assert.deepEqual(regular.map((g) => g.contours.length), [0, 2, 2, 1, 1, 1, 0, 3]);
    // The variable font moves every point between Light and Bold, and the o's advance with them
    const sfnt = readFileSync(join(dir, 'fonts', 'ProbeSans[wght].ttf'));
    const variable = readGlyphs(sfnt);
    assert.ok(variable[1].deltas?.length === 2);
    assert.ok(variable[1].advanceDeltas[0] < 0 && variable[1].advanceDeltas[1] > 0);
    // Kerning, its variation, the advances' and a feature: GPOS, GDEF, HVAR and GSUB
    const tags = Array.from({ length: sfnt.readUInt16BE(4) }, (_, i) => sfnt.toString('latin1', 12 + 16 * i, 16 + 16 * i));
    for (const t of ['GDEF', 'GPOS', 'GSUB', 'HVAR']) assert.ok(tags.includes(t), t);
    // Embedding restricted (OS/2 fsType 2)
    const static_ = readFileSync(join(dir, 'fonts', 'ProbeSans-Regular.ttf'));
    const os2 = [...Array(static_.readUInt16BE(4)).keys()].map((i) => 12 + 16 * i).find((o) => static_.toString('latin1', o, o + 4) === 'OS/2');
    assert.equal(static_.readUInt16BE(static_.readUInt32BE(os2 + 8) + 8), 2);
    assert.match(readFileSync(join(dir, 'words', 'oi-regular.svg'), 'utf8'), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="[^"]+" fill="currentColor"><path fill-rule="nonzero" d="M/);
    // Words are kerned: the o of "To" sits 1.9 closer at regular, 1.6 at bold
    const word = (weight) => JSON.parse(readFileSync(join(dir, 'words', `to-${weight}.json`), 'utf8'));
    assert.equal(word('regular').letters[1].x, 7.7);
    assert.equal(word('bold').letters[1].x, 8);
    // A subset keeps those characters, their alternates and the kerning between them
    const out = join(dir, 'subset');
    execFileSync(process.execPath, [new URL('../scripts/type.mjs', import.meta.url).pathname, dir, '--subset', 'T-', '--out', out]);
    assert.deepEqual(readGlyphs(readFileSync(join(out, 'ProbeSans-Regular.ttf'))).map((g) => g.contours.length), [0, 1, 1, 1]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
