// Taxonomy (src/taxonomy.json): every category planned once, every round in its place, and
// adopted icons moving to their category with their languages.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adopt, loadAll } from '../scripts/load.mjs';

test('taxonomy: every category file is planned, and every round has its place', async () => {
  const { categories, errors, taxonomy } = await loadAll();
  assert.deepEqual(errors.filter((e) => e.includes('taxonomy')), []);
  const planned = new Set(taxonomy.categories.map((c) => c.id));
  for (const c of categories) assert.ok(planned.has(c.category), c.category);
  // Rounds 3 to 11 each draw their categories; round 12, the sweep, adds to them and closes the set
  // for v1 (decision 89)
  for (let r = 3; r <= 11; r++) assert.ok(taxonomy.rounds[r] && taxonomy.categories.some((c) => c.round === r), `round ${r}`);
  assert.ok(taxonomy.rounds[12] && taxonomy.v1);
});

test('taxonomy: a category adopts its icons, with their languages, only once its file exists', () => {
  const source = () => ({ category: 'lugares', icons: { sun: { d: [] }, map: { d: [] } }, i18n: { sun: { label: { es: 'Sol' } }, map: {} } });
  const tax = { categories: [{ id: 'clima', adopts: ['sun'] }] };
  const before = [source()];
  adopt(before, tax);
  assert.ok(before[0].icons.sun, 'without clima.mjs, the sun stays in lugares');
  const after = [source(), { category: 'clima', icons: { sleet: { d: [] } }, i18n: {} }];
  adopt(after, tax);
  assert.deepEqual(Object.keys(after[0].icons), ['map']);
  assert.deepEqual(Object.keys(after[1].icons), ['sleet', 'sun']);
  assert.equal(after[1].i18n.sun.label.es, 'Sol');
});
