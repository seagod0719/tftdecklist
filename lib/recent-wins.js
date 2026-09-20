import { fetchData, getLookup } from './sources.js';
import { decorateComp } from './tft.js';

export const SHARDS = ['br1', 'eun1', 'euw1', 'jp1', 'kr', 'la1', 'la2', 'me1', 'na1', 'oc1', 'ru', 'sg2', 'tr1', 'tw2', 'vn2'];
export const SOURCE_URL = 'https://lolchess.gg/recent-win-decks';
const API_URL = 'https://tft.dakgg.io/api/v1/recent-win-matches';

export function selectRecentMatches(payloads, limit = 200) {
  const unique = new Map();
  for (const payload of payloads) {
    if (!Array.isArray(payload?.matches)) throw new Error('롤체지지 우승 데이터 구조가 변경되었습니다.');
    for (const match of payload.matches) {
      if (match.queueId !== 1100) continue;
      if (!SHARDS.includes(match.shard) || !match.matchId || !Number.isFinite(match.gameCreatedAt) || !/^set\d+$/.test(match.season)) {
        throw new Error('롤체지지 경기 정보를 확인할 수 없습니다.');
      }
      const winners = match.participants?.filter(p => p.placement === 1);
      if (winners?.length !== 1 || !winners[0].units?.length || winners[0].units.some(u => typeof u.character_id !== 'string' || !u.character_id)) {
        throw new Error('롤체지지 우승 유닛 정보를 확인할 수 없습니다.');
      }
      unique.set(`${match.shard}:${match.matchId}`, { ...match, winner: winners[0] });
    }
  }
  return [...unique.values()].sort((a, b) => b.gameCreatedAt - a.gameCreatedAt || `${a.shard}:${a.matchId}`.localeCompare(`${b.shard}:${b.matchId}`)).slice(0, limit);
}

function combinations(ids, size, visit, start = 0, selected = []) {
  if (selected.length === size) { visit([...selected]); return; }
  for (let i = start; i <= ids.length - (size - selected.length); i++) {
    selected.push(ids[i]); combinations(ids, size, visit, i + 1, selected); selected.pop();
  }
}

// Pick the most frequent six-unit core, assign its matches once, then repeat.
// A shared core avoids transitive A~B~C merges where A and C share fewer than six.
export function rankWinDecks(matches, maxGroups = 5) {
  const cores = new Map();
  matches.forEach((match, index) => {
    const ids = [...new Set(match.unitIds)].sort();
    if (ids.length > 20) throw new Error('유닛 수가 예상 범위를 벗어났습니다.');
    combinations(ids, 6, core => {
      const key = JSON.stringify([match.season, core]);
      if (!cores.has(key)) cores.set(key, { core, members: [] });
      cores.get(key).members.push(index);
    });
  });
  const assigned = new Set(), groups = [];
  while (groups.length < maxGroups) {
    let best;
    for (const candidate of cores.values()) {
      const members = candidate.members.filter(index => !assigned.has(index));
      if (members.length < 2) continue;
      if (!best || members.length > best.members.length || (members.length === best.members.length && members[0] < best.members[0])) {
        best = { core: candidate.core, members };
      }
    }
    if (!best) break;
    best.members.forEach(index => assigned.add(index));
    const members = best.members.map(index => matches[index]);
    const common = members[0].unitIds.filter(id => members.every(m => m.unitIds.includes(id)));
    groups.push({ wins: members.length, coreUnitIds: common, representative: members[0] });
  }
  return groups;
}

export async function loadRecentWins() {
  // The page's global feed is capped at 75. Merge the same page's regional feeds.
  const payloads = await Promise.all(SHARDS.map(shard => fetchData(`${API_URL}?shard=${shard}`)));
  const recent = selectRecentMatches(payloads);
  if (!recent.length) throw new Error('롤체지지에서 최근 우승 기록을 제공하지 않습니다.');
  const sets = [...new Set(recent.map(match => match.season))];
  const lookups = new Map(await Promise.all(sets.map(async season => [season, await getLookup(season.replace('set', 'TFTSet'))])));
  const matches = recent.map(match => {
    const lookup = lookups.get(match.season);
    const ids = match.winner.units.map(u => u.character_id).filter(id => lookup.units.get(id)?.shopUnit !== false);
    return { ...match, unitIds: [...new Set(ids.map(id => lookup.units.get(id)?.apiName || id))] };
  });
  const groups = rankWinDecks(matches);
  const cutoff = recent.at(-1).gameCreatedAt;
  const limited = payloads.some(p => p.matches.length >= 75 && Math.min(...p.matches.map(m => m.gameCreatedAt)) > cutoff);
  return {
    source: 'lolchess', sourceUrl: SOURCE_URL, fetchedAt: new Date().toISOString(),
    updatedAt: Math.min(...payloads.map(p => p.meta?.updatedAt).filter(Number.isFinite)),
    sampleSize: recent.length, requestedSampleSize: 200, regionCount: SHARDS.length,
    newestAt: recent[0].gameCreatedAt, oldestAt: cutoff,
    warning: [recent.length < 200 ? `원본에서 확보한 ${recent.length}경기만 분석했습니다.` : '', limited ? '지역별 제공 한도로 일부 최신 경기가 누락될 수 있습니다.' : ''].filter(Boolean).join(' '),
    method: '동일한 6종 유닛을 공유하는 우승 덱을 가장 큰 그룹부터 묶습니다. 한 경기는 한 번만 집계하며, 동률은 최신 경기 우선입니다. 별 등급·아이템은 무시하고 소환물은 제외합니다.',
    comps: groups.map((group, index) => {
      const match = group.representative, lookup = lookups.get(match.season);
      const core = decorateComp({ unitIds: group.coreUnitIds }, lookup).units;
      return { ...decorateComp({ id: `${match.shard}:${match.matchId}`, name: `${index + 1}위 · ${core.map(u => u.name).join(' · ')}`,
        unitIds: match.unitIds, sourceUrl: SOURCE_URL }, lookup),
      rank: index + 1, wins: group.wins, sampleShare: group.wins / recent.length, coreUnits: core,
      set: lookup.set, representativeAt: match.gameCreatedAt };
    }),
  };
}

let cached, inFlight;
export default async function recentWinsHandler(req, res) {
  if (req.method && req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET 요청만 지원합니다.' }); }
  try {
    if (!cached || cached.expires <= Date.now()) {
      inFlight ||= loadRecentWins().then(data => { cached = { data, expires: Date.now() + 300000 }; return data; }).finally(() => { inFlight = null; });
      await inFlight;
    }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(cached.data);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: `최근 우승 덱 수집 실패: ${error.message}` });
  }
}
