import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemTier, groupItems, parseItemDataset } from '../lib/items.js';

test('TFTable artifact and emblem tier boundaries differ', () => {
  assert.equal(itemTier(0.6, 'artifacts'), 'good');
  assert.equal(itemTier(0.6001, 'artifacts'), 'op');
  assert.equal(itemTier(0.5, 'emblems'), 'good');
  assert.equal(itemTier(0.5001, 'emblems'), 'op');
  assert.equal(itemTier(0.3, 'artifacts'), 'good');
  assert.equal(itemTier(0.1, 'emblems'), 'normal');
  assert.equal(itemTier(0.09, 'emblems'), null);
  assert.equal(itemTier(NaN, 'artifacts'), null);
});
test('grouping excludes conditional pairs, keeps best three and essentials', () => {
  const pair = (id, strength) => ({ comp_id: id, item_strength: -strength });
  const dataset = { metadata: { conditional_comp_keys: ['hidden'] }, tabs: { artifacts: {
    all_artifact_ids: ['a','b','c'], rows: [{ artifact_id: 'a', comps: [pair('hidden', 9), pair('1', 0.1), pair('2', 0.4), pair('3', 0.5), pair('4', 0.7)] }],
    essentials: [{ artifact_id: 'b', comps: [{ comp_id: 'base', frequency: 0.7 }] }],
  } } };
  const tiers = groupItems(dataset, 'artifacts');
  assert.deepEqual(tiers.op[0].comps.map(c => c.comp_id), ['4','3','2']);
  assert.equal(tiers.essential[0].id, 'b');
  assert.deepEqual(tiers.unplayable.map(c => c.id), ['c']);
});
test('changed or missing embedded datasets fail explicitly', () => {
  assert.throws(() => parseItemDataset('<html>Unavailable</html>'));
  assert.throws(() => parseItemDataset('<script id="__NEXT_DATA__">{"props":{}}</script>'));
});
