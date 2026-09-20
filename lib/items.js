import { fetchData } from './sources.js';

export function parseItemDataset(html) {
  const json = html.match(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error('TFTable 페이지의 데이터 구조가 변경되었습니다.');
  const dataset = JSON.parse(json)?.props?.pageProps?.dataset;
  for (const type of ['artifacts', 'emblems']) {
    if (!Array.isArray(dataset?.tabs?.[type]?.rows) || !Array.isArray(dataset.tabs[type].all_artifact_ids)) throw new Error('TFTable 티어 데이터가 없습니다.');
  }
  return dataset;
}

export function itemTier(strength, type) {
  if (!Number.isFinite(strength)) return null;
  if (strength > (type === 'emblems' ? 0.5 : 0.6)) return 'op';
  if (strength >= 0.3) return 'good';
  if (strength >= 0.1) return 'normal';
  return null;
}

// Mirror TFTable's default grouped view: hide conditional comps, best three
// qualifying pairs per item; essentials may also appear in ordinary tiers.
export function groupItems(dataset, type) {
  const tab = dataset.tabs[type];
  const conditional = new Set(dataset.metadata?.conditional_comp_keys || []);
  const tiers = Object.fromEntries(['essential', 'op', 'good', 'normal', 'unplayable'].map(t => [t, []]));
  const seen = new Set();
  for (const row of tab.rows) {
    const comps = row.comps.filter(c => !conditional.has(c.comp_id) && itemTier(-c.item_strength, type))
      .sort((a,b) => a.item_strength - b.item_strength || (b.sample_with || 0) - (a.sample_with || 0)).slice(0,3);
    if (!comps.length) continue;
    const strength = -comps[0].item_strength;
    tiers[itemTier(strength, type)].push({ id: row.artifact_id, strength, comps });
    seen.add(row.artifact_id);
  }
  for (const row of tab.essentials || []) {
    const comps = row.comps.filter(c => !conditional.has(c.comp_id));
    if (!comps.length) continue;
    tiers.essential.push({ id: row.artifact_id, strength: null, comps });
    seen.add(row.artifact_id);
  }
  for (const t of ['op', 'good', 'normal']) tiers[t].sort((a,b) => b.strength - a.strength);
  tiers.essential.sort((a,b) => Math.max(...b.comps.map(c => c.frequency || 0)) - Math.max(...a.comps.map(c => c.frequency || 0)));
  tiers.unplayable = tab.all_artifact_ids.filter(id => !seen.has(id)).sort().map(id => ({ id, strength: null, comps: [] }));
  return tiers;
}

export async function loadItems() {
  const dataset = parseItemDataset(await fetchData('https://tftable.cc/item-tierlist', false));
  const setNumbers = [...new Set(dataset.tabs.emblems.all_artifact_ids.map(id => id.match(/^DA_(\d+)_/)?.[1]).filter(Boolean))];
  if (setNumbers.length !== 1) throw new Error('아이템 세트를 확인할 수 없습니다.');
  const set = setNumbers[0];
  const [lookup, cards] = await Promise.all([
    fetchData(`https://data.metatft.com/lookups/TFTSet${set}_latest_ko_kr.json`),
    fetchData('https://tftable.cc/data/__shared/composition-cards.json').catch(() => ({ cards: [] })),
  ]);
  if (lookup?._metadata?.set !== `TFTSet${set}`) throw new Error('아이템 이름 데이터의 세트가 일치하지 않습니다.');
  const items = new Map(lookup.items.map(i => [i.apiName, i]));
  const units = new Map(lookup.units.flatMap(u => [u.apiName, ...(u.assetNames || [])].map(id => [id, u])));
  const names = new Map((cards.cards || []).map(c => [c.key, c.display_name_ko || c.display_name_en]));
  const icon = (id, folder) => `https://tftable.cc/set${set}/${folder}/${encodeURIComponent(id)}.webp`;
  const tabs = {};
  for (const type of ['artifacts', 'emblems']) tabs[type] = Object.fromEntries(Object.entries(groupItems(dataset, type)).map(([tier, rows]) => [tier, rows.map(row => ({
    ...row, name: items.get(row.id)?.name || row.id, icon: icon(row.id, 'item-webp'),
    comps: row.comps.map(c => ({ name: names.get(c.comp_id) || c.comp_id, strength: Number.isFinite(c.item_strength) ? -c.item_strength : null,
      carrier: units.get(c.top_carrier_unit_id)?.name || c.top_carrier_unit_id || '',
      carrierIcon: c.top_carrier_unit_id ? icon(c.top_carrier_unit_id, 'avatar-webp') : null,
    })),
  }))]));
  return { set: `TFTSet${set}`, updatedAt: dataset.metadata?.generated_at, fetchedAt: new Date().toISOString(), tabs };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET 요청만 지원합니다.' }); }
  try {
    const result = await loadItems();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: error.message });
  }
}
