import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAKGG_API_URL, DAKGG_URL, parseDakgg, decorateDakggComp } from '../lib/dakgg.js';
import { createLookup } from '../lib/tft.js';

const payload = {
  season: 'set18',
  patchRevisions: [{ patch: 1804, revision: 1, patchVersion: '18.4b' }],
  metaDeckList: {
    queueId: 1100, patch: 1804, revision: 1, updatedAt: 1792087377000,
    metaDecks: [
      { key: 'one', deckNameKo: '덱 1', avgPlacement: 4.1, winRate: 15.4, topRate: 57.3,
        deck: { champions: [{ key: 'DA_18_Ahri' }, { key: 'DA_18_Kennen' }] } },
      { key: 'two', deckNameKo: '덱 2', avgPlacement: 4.3,
        deck: { champions: [{ key: 'DA_18_Ahri' }] } },
      { key: 'three', deckNameEn: 'Comp Three', avgPlacement: 4.7,
        deck: { champions: [{ key: 'DA_18_Kennen' }] } },
    ],
  },
  refs: { champions: [
    { key: 'DA_18_Ahri', name: '아리', cost: 4, imageUrl: 'https://cdn.lolchess.gg/upload/images/champions/ahri.jpg' },
    { key: 'DA_18_Kennen', name: '케넨', cost: 2, imageUrl: 'javascript:alert(1)' },
  ] },
};

test('DAK.GG public API and source page remain distinct', () => {
  assert.match(DAKGG_API_URL, /tft\.dakgg\.io\/api\/v1\/meta-decks/);
  assert.equal(DAKGG_URL, 'https://lolchess.gg/decks');
});

test('parse Korean meta decks and show S/A/B tiers transparently', () => {
  const data = parseDakgg(payload);
  assert.equal(data.set, 'TFTSet18');
  assert.equal(data.patch, '18.4b');
  assert.deepEqual(data.comps.map(c => c.tier), ['S', 'A', 'B']);
  assert.deepEqual(data.comps[0].unitIds, ['DA_18_Ahri', 'DA_18_Kennen']);
  assert.equal(data.comps[0].units[0].name, '아리');
  assert.equal(data.comps[0].units[0].cost, 4);
  assert.equal(data.comps[0].units[1].icon, null);
  assert.equal(data.comps[0].winRate, 15.4);
  assert.equal(data.comps[2].name, 'Comp Three');
});

test('complete team codes use validated lookup; failed lookup keeps cards', () => {
  const data = parseDakgg(payload);
  const lookup = createLookup({ _metadata: { set: 'TFTSet18' }, units: [
    { apiName: 'DA_18_Ahri', name: '아리', code: '001' },
    { apiName: 'DA_18_Kennen', name: '케넨', code: '002' },
  ] }, 'TFTSet18');
  const valid = decorateDakggComp(data.comps[0], lookup);
  assert.equal(valid.teamCode, '02001002' + '000'.repeat(8) + 'TFTSet18');
  assert.equal(decorateDakggComp(data.comps[0], null).teamCode, null);
  assert.match(decorateDakggComp(data.comps[0], null).codeReason, /복사/);
});

test('reject malformed source payloads instead of inventing decks', () => {
  assert.throws(() => parseDakgg({}));
  assert.throws(() => parseDakgg({ ...payload, season: 'set17', metaDeckList: { ...payload.metaDeckList, metaDecks: [] } }));
  assert.throws(() => parseDakgg({ ...payload, metaDeckList: {
    ...payload.metaDeckList, metaDecks: [{ ...payload.metaDeckList.metaDecks[0], avgPlacement: null }],
  } }));
  assert.throws(() => parseDakgg({ ...payload, metaDeckList: { ...payload.metaDeckList, queueId: 999 } }));
});
