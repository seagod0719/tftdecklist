import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRecentMatches, rankWinDecks } from '../lib/recent-wins.js';

const match = (id, time = id) => ({ matchId: id, shard: 'kr', queueId: 1100, season: 'set18', gameCreatedAt: time,
  participants: [{ placement: 8, units: [{ character_id: 'loser' }] }, { placement: 1, units: [{ character_id: 'winner' }] }] });
const deck = (units, season = 'set18') => ({ unitIds: units.split(''), season });

test('selects newest 200 unique ranked matches and only the winner', () => {
  const matches = Array.from({ length: 220 }, (_, i) => match(i + 1));
  const result = selectRecentMatches([{ matches }, { matches: [match(220), { ...match(999), queueId: 1160 }] }]);
  assert.equal(result.length, 200);
  assert.equal(result[0].matchId, 220);
  assert.equal(result.at(-1).matchId, 21);
  assert.equal(result[0].winner.units[0].character_id, 'winner');
});
test('changed schema fails rather than displaying invented counts', () => {
  assert.throws(() => selectRecentMatches([{}]));
  assert.throws(() => selectRecentMatches([{ matches: [{ ...match(1), participants: [] }] }]));
});
test('counts unique species, prevents transitive and double counted groups', () => {
  const result = rankWinDecks([deck('abcdefg'), deck('abcdefh'), deck('bcdefhi'), deck('abcdeeeee')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].wins, 2);
  assert.deepEqual(result[0].coreUnitIds, 'abcdef'.split(''));
});
test('ranks largest groups first, separates seasons and caps output at five', () => {
  const rows = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < i + 2; j++) rows.push({ unitIds: Array.from({ length: 6 }, (_, n) => `${i}-${n}`), season: 'set18' });
  rows.push({ ...rows[0], season: 'set17' });
  const result = rankWinDecks(rows);
  assert.deepEqual(result.map(r => r.wins), [8, 7, 6, 5, 4]);
  assert.equal(rankWinDecks([deck('abcdef'), deck('abcdef', 'set17')]).length, 0);
});
