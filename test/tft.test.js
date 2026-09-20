import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLookup, createTeamCode, decodeReferences, parseQQ, parseAcademy } from '../lib/tft.js';
const lookup = createLookup({ _metadata: { set: 'TFTSet18' }, units: [
  { apiName: 'TFT18_Aphelios', assetNames: ['DA_18_Aphelios'], name: '아펠리오스', code: '3ef' },
  { apiName: 'tree', shopUnit: false },
] }, 'TFTSet18');
test('asset aliases encode using exact unit code with ten padded slots', () => {
  assert.equal(createTeamCode(['DA_18_Aphelios'], lookup).teamCode, '023ef' + '000'.repeat(9) + 'TFTSet18');
});
test('summons excluded, unknown units block incomplete codes', () => {
  assert.deepEqual(createTeamCode(['DA_18_Aphelios', 'tree'], lookup).omitted, ['tree']);
  assert.equal(createTeamCode(['DA_18_Aphelios', 'unknown'], lookup).teamCode, null);
  assert.equal(createTeamCode([], lookup).teamCode, null);
});
test('do not silently truncate teams above ten units', () => {
  assert.equal(createTeamCode(Array(11).fill('DA_18_Aphelios'), lookup).teamCode, null);
});
test('duplicate unit slots are preserved', () => {
  assert.equal(createTeamCode(['DA_18_Aphelios', 'DA_18_Aphelios'], lookup).teamCode, '023ef3ef' + '000'.repeat(8) + 'TFTSet18');
});
test('reject mismatched set and malformed unit code', () => {
  assert.throws(() => createLookup({ units: [], _metadata: { set: 'TFTSet17' } }, 'TFTSet18'));
  assert.equal(createTeamCode(['a'], { set: 'TFTSet18', units: new Map([['a', { code: 'zz1' }]]) }).teamCode, null);
});
test('decode reference tables without evaluating code and reject invalid refs', () => {
  assert.equal(decodeReferences([{ guides: 1 }, [2], { title: 3 }, 'test']).guides[0].title, 'test');
  assert.throws(() => decodeReferences([{ guides: 5 }]));
  assert.throws(() => parseAcademy({ nodes: [] }));
});
test('QQ nested JSON supports literal newlines and filters unpublished/lower tiers', () => {
  const row = { id: '1', status: '5', quality: 'SS', sortID: '1', detail: '{"mode_season":"s18","line_name":"a\nb","hero_location":[{"chess_type":"hero","hero_id":"DA_18_Aphelios"}]}' };
  const result = parseQQ({ lineup_list: [row, { ...row, quality: 'B' }, { ...row, status: '0' }] }, 's18');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].unitIds, ['DA_18_Aphelios']);
  assert.throws(() => parseQQ({ lineup_list: [row] }, 's17'));
});
