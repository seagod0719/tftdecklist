export const TOP_TIERS = ['SS', 'S', 'A'];

export function createLookup(data, set) {
  if (!Array.isArray(data?.units) || data?._metadata?.set !== set) throw new Error('유닛 데이터의 세트가 일치하지 않습니다.');
  const units = new Map(), names = new Map();
  for (const group of ['units', 'traits']) for (const entry of data[group] || []) {
    for (const key of [entry.apiName, entry.characterName, ...(entry.assetNames || [])].filter(Boolean)) {
      names.set(key, entry.name);
      if (group === 'units') units.set(key, entry);
    }
  }
  return { units, names, set, metadata: data._metadata };
}

// MetaTFT planner: version + ten hexadecimal unit slots + set key.
export function createTeamCode(ids, lookup) {
  const width = ['TFTSet13', 'TFTSet4_Act2'].includes(lookup.set) ? 2 : 3;
  const codes = [], omitted = [], missing = [];
  for (const id of ids) {
    const unit = lookup.units.get(id);
    if (!unit) { missing.push(id); continue; }
    if (!unit.code && unit.shopUnit === false) { omitted.push(id); continue; }
    if (typeof unit.code !== 'string' || !new RegExp(`^[0-9a-f]{${width}}$`, 'i').test(unit.code) || /^0+$/.test(unit.code)) {
      missing.push(id); continue;
    }
    codes.push(unit.code.toLowerCase());
  }
  if (missing.length) return { teamCode: null, codeReason: `유닛 코드 확인 필요: ${missing.join(', ')}`, omitted };
  if (!codes.length || codes.length > 10) return { teamCode: null, codeReason: '팀코드는 유닛 1~10개만 지원합니다.', omitted };
  return { teamCode: (width === 3 ? '02' : '01') + codes.join('') + '0'.repeat((10 - codes.length) * width) + lookup.set, codeReason: null, omitted };
}

export function decorateComp(comp, lookup) {
  return { ...comp, units: comp.unitIds.map(id => ({ id, name: lookup.units.get(id)?.name || id, cost: lookup.units.get(id)?.cost ?? null })), ...createTeamCode(comp.unitIds, lookup) };
}

// Parse SvelteKit reference tables as data; never execute remote scripts.
export function decodeReferences(table) {
  if (!Array.isArray(table)) throw new Error('잘못된 Academy 데이터');
  const cache = new Map();
  function resolve(index) {
    if (index === -1) return undefined;
    if (!Number.isInteger(index) || index < 0 || index >= table.length) throw new Error('잘못된 Academy 참조');
    if (cache.has(index)) return cache.get(index);
    const value = table[index];
    if (value === null || typeof value !== 'object') return value;
    const result = Array.isArray(value) ? [] : Object.create(null);
    cache.set(index, result);
    for (const [key, ref] of Object.entries(value)) result[key] = resolve(ref);
    return result;
  }
  return resolve(0);
}

export function parseAcademy(payload) {
  const nodes = (payload.nodes || []).filter(n => n?.type === 'data').map(n => decodeReferences(n.data));
  const guides = nodes.find(n => Array.isArray(n.guides))?.guides;
  if (!guides?.length) throw new Error('Academy 덱 데이터 구조가 변경되었습니다.');
  const publicGuides = guides.filter(g => g.isPublic === true);
  const sets = [...new Set(publicGuides.map(g => g.set))];
  if (sets.length !== 1 || !Number.isInteger(sets[0])) throw new Error('Academy 세트를 확인할 수 없습니다.');
  return { set: `TFTSet${sets[0]}`, patch: nodes.find(n => n.patch)?.patch, updatedAt: nodes.find(n => n.lastUpdated)?.lastUpdated,
    comps: publicGuides.filter(g => TOP_TIERS.includes(g.tier)).sort((a,b) => a.displayIndex - b.displayIndex).map(g => ({
      id: g.id, name: g.title, tier: g.tier, unitIds: g.finalComp.map(u => u.apiName),
      sourceUrl: `https://tftacademy.com/tierlist/comps/${encodeURIComponent(g.compSlug)}`,
    })),
  };
}

export function parseQQ(payload, set) {
  if (!Array.isArray(payload?.lineup_list) || !payload.lineup_list.length) throw new Error('QQ 덱 데이터 구조가 변경되었습니다.');
  return payload.lineup_list.filter(r => String(r.status) === '5' && TOP_TIERS.includes(r.quality))
    .sort((a,b) => Number(a.sortID) - Number(b.sortID)).map(row => {
      // QQ embeds literal control characters inside nested JSON strings.
      const detail = typeof row.detail === 'string' ? JSON.parse(row.detail.replace(/[\u0000-\u001f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)) : row.detail;
      if (detail.mode_season !== set || !Array.isArray(detail.hero_location)) throw new Error('QQ 세트 또는 유닛 데이터가 일치하지 않습니다.');
      return { id: row.id, name: detail.line_name, tier: row.quality,
        unitIds: detail.hero_location.filter(u => u.chess_type === 'hero').map(u => u.hero_id), sourceUrl: 'https://lol.qq.com/tft/#/index' };
    });
}
