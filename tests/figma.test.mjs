// The Figma library builder (scripts/figma/code.js), run against a small stand-in for Figma's plugin
// API: what it builds the first time, and that a second run redraws the same nodes in place (their
// keys and overrides survive) and reports, without deleting, a set whose icon left Gota.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../scripts/figma/code.js', import.meta.url), 'utf8');

function fakeFigma() {
  let ids = 0;
  const node = (type, extra = {}) => {
    const n = { id: `${type}:${++ids}`, type, name: '', x: 0, y: 0, width: 0, height: 0, parent: null, children: [], shared: {}, ...extra };
    n.appendChild = (child) => {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
      child.parent = n;
      n.children.push(child);
    };
    n.resizeWithoutConstraints = (w, h) => Object.assign(n, { width: w, height: h });
    n.setSharedPluginData = (ns, key, value) => {
      n.shared[`${ns}.${key}`] = value;
    };
    n.getSharedPluginData = (ns, key) => n.shared[`${ns}.${key}`] ?? '';
    return n;
  };
  const root = node('DOCUMENT');
  const sent = [];
  const figma = {
    root,
    sent,
    createPage: () => {
      const page = node('PAGE', { loadAsync: async () => {} });
      root.appendChild(page);
      return page;
    },
    createComponent: () => node('COMPONENT'),
    createVector: () => node('VECTOR'),
    combineAsVariants: (components, parent) => {
      const set = node('COMPONENT_SET');
      parent.appendChild(set);
      for (const c of components) set.appendChild(c);
      return set;
    },
    showUI: () => {},
    notify: () => {},
    closePlugin: () => {},
    ui: { postMessage: (m) => sent.push(m), onmessage: null },
  };
  vm.runInNewContext(CODE, { figma, __html__: '', setTimeout });
  return figma;
}
// Objects made inside the plugin's context have that context's prototypes
const plain = (v) => JSON.parse(JSON.stringify(v));

const paths = (tag) => ({ outline: ['L', 'R', 'B'].map((w) => `M 0 0 L ${tag} ${w} Z`), fill: ['L', 'R', 'B'].map((w) => `M 1 1 L ${tag} ${w} Z`) });
const data = (icons) => ({ version: '0', categories: [{ id: 'nucleo', label: 'Núcleo', icons: icons.map((name) => ({ name, description: `${name} words`, paths: paths(name) })) }] });

test('figma: one page per category, one set per icon with Style × Weight, each a 24 grid vector', async () => {
  const figma = fakeFigma();
  await figma.ui.onmessage({ type: 'build', data: data(['bell', 'card']) });
  assert.equal(figma.sent.at(-1).type, 'done');
  assert.deepEqual(plain([figma.sent.at(-1).stats.created, figma.sent.at(-1).stats.updated]), [2, 0]);
  const [page] = figma.root.children;
  assert.equal(page.name, 'Núcleo');
  const bell = page.children.find((n) => n.name === 'bell');
  assert.equal(bell.type, 'COMPONENT_SET');
  assert.equal(bell.description, 'bell words');
  assert.deepEqual(
    bell.children.map((c) => c.name),
    ['Outline', 'Fill'].flatMap((s) => ['Light', 'Regular', 'Bold'].map((w) => `Style=${s}, Weight=${w}`)),
  );
  // A row per style, a column per weight; every variant 24 × 24 with one scaling vector
  const bold = bell.children.find((c) => c.name === 'Style=Fill, Weight=Bold');
  assert.deepEqual([bold.x, bold.y, bold.width, bold.height], [96, 56, 24, 24]);
  const [vector] = bold.children;
  assert.equal(vector.name, 'Icon');
  assert.deepEqual(plain(vector.vectorPaths), [{ windingRule: 'NONZERO', data: 'M 1 1 L bell B Z' }]);
  assert.deepEqual(plain(vector.constraints), { horizontal: 'SCALE', vertical: 'SCALE' });
});

test('figma: a second run redraws the same nodes and keeps a set whose icon left', async () => {
  const figma = fakeFigma();
  await figma.ui.onmessage({ type: 'build', data: data(['bell', 'card']) });
  const before = figma.root.children[0].children.find((n) => n.name === 'bell').children.map((c) => [c.id, c.children[0].id]);
  const next = data(['bell']);
  next.categories[0].icons[0].paths.outline[0] = 'M 0 0 L 9 9 Z';
  await figma.ui.onmessage({ type: 'build', data: next });
  const { stats } = figma.sent.at(-1);
  assert.deepEqual(plain([stats.created, stats.updated, stats.gone]), [0, 1, ['Núcleo / card']]);
  assert.equal(figma.root.children.length, 1);
  const bell = figma.root.children[0].children.find((n) => n.name === 'bell');
  assert.deepEqual(
    bell.children.map((c) => [c.id, c.children[0].id]),
    before,
  );
  assert.equal(bell.children[0].children[0].vectorPaths[0].data, 'M 0 0 L 9 9 Z');
  assert.ok(figma.root.children[0].children.some((n) => n.name === 'card'));
});

test('figma: the plugin code is plain ES2017, as Figma\'s sandbox runs it', () => {
  const code = CODE.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\?\.|\?\?|\.\.\./); // optional chaining, nullish coalescing, spread
});