import assert from 'node:assert/strict';
import { loadSource } from '../lib/sources.js';
import { loadItems } from '../lib/items.js';
await Promise.all(['metatft', 'academy', 'qq'].map(async source => {
  const data = await loadSource(source);
  assert.ok(data.comps.length, `${source}: empty response`);
  for (const comp of data.comps) {
    assert.ok(['SS', 'S', 'A'].includes(comp.tier));
    assert.ok(comp.units.length);
    if (comp.teamCode) assert.match(comp.teamCode, new RegExp(`^02[0-9a-f]{30}${data.set}$`));
    else assert.ok(comp.codeReason);
  }
  console.log(`${source}: ${data.comps.length} decks, ${data.comps.filter(c => c.teamCode).length} team codes`);
}));
const items = await loadItems();
for (const type of ['artifacts', 'emblems']) {
  const rows = Object.values(items.tabs[type]).flat();
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.name && row.icon && Array.isArray(row.comps)));
  console.log(`${type}: ${new Set(rows.map(row => row.id)).size} items`);
}
