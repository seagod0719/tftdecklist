import { createTeamCode } from './tft.js';

export const DAKGG_URL = 'https://lolchess.gg/decks';
export const DAKGG_API_URL = 'https://tft.dakgg.io/api/v1/meta-decks?shard=global&queueId=1100&dt=3&tierId=1&hl=ko&from=web';

const validImage = url => typeof url === 'string' && /^https:\/\/[^\s]+$/i.test(url) ? url : null;

// DAK.GG's public Meta Trends response uses no SS/S/A field on each deck.
// Keep the dashboard's tiers as an explicitly documented average-placement grouping.
function dashboardTier(avg) {
  return avg < 4.25 ? 'S' : avg < 4.5 ? 'A' : 'B';
}

export function parseDakgg(payload) {
  if (!/^set\d+$/.test(payload?.season || '') || !Array.isArray(payload?.metaDeckList?.metaDecks)
      || !payload.metaDeckList.metaDecks.length || !Array.isArray(payload?.refs?.champions)) {
    throw new Error('DAK.GG 메타 덱 데이터 구조가 변경되었습니다.');
  }
  const source = payload.metaDeckList;
  if (!Number.isFinite(source.updatedAt) || !Number.isFinite(source.patch)
      || source.queueId !== 1100) throw new Error('DAK.GG 패치 또는 갱신 정보를 확인할 수 없습니다.');
  const championRefs = new Map(payload.refs.champions.filter(ref => typeof ref?.key === 'string')
    .map(ref => [ref.key, ref]));
  const comps = source.metaDecks.map((deck, index) => {
    if (!deck?.key || !Number.isFinite(deck.avgPlacement) || !Array.isArray(deck.deck?.champions)
        || !deck.deck.champions.length || deck.deck.champions.length > 10
        || deck.deck.champions.some(unit => typeof unit?.key !== 'string' || !unit.key)) {
      throw new Error('DAK.GG 덱 구성 또는 평균 등수 데이터가 올바르지 않습니다.');
    }
    const unitIds = deck.deck.champions.map(unit => unit.key);
    return {
      id: String(deck.key), name: deck.deckNameKo || deck.deckNameEn || `덱 ${index + 1}`,
      tier: dashboardTier(deck.avgPlacement), avgPlacement: deck.avgPlacement,
      winRate: Number.isFinite(deck.winRate) ? deck.winRate : null,
      topRate: Number.isFinite(deck.topRate) ? deck.topRate : null,
      unitIds, sourceUrl: DAKGG_URL,
      units: unitIds.map(id => ({
        id, name: championRefs.get(id)?.name || id,
        cost: championRefs.get(id)?.cost ?? null,
        icon: validImage(championRefs.get(id)?.imageUrl),
      })),
    };
  });
  return {
    set: `TFTSet${payload.season.slice(3)}`,
    patch: payload.patchRevisions?.find(p => p.patch === source.patch && p.revision === source.revision)?.patchVersion || String(source.patch),
    updatedAt: new Date(source.updatedAt).toISOString(),
    tierNote: 'DAK.GG 메타 통계(최근 2일·Master+) 기반입니다. 원본 API는 덱별 티어를 제공하지 않아 이 화면에서는 평균 등수로 S(<4.25), A(<4.50), B(그 외)를 구분합니다.',
    comps: comps.sort((a, b) => a.avgPlacement - b.avgPlacement),
  };
}

export function decorateDakggComp(comp, lookup) {
  const codes = lookup
    ? createTeamCode(comp.unitIds, lookup)
    : { teamCode: null, codeReason: '유닛 코드 매핑 서버에 연결할 수 없어 복사를 지원하지 않습니다.', omitted: [] };
  return { ...comp, ...codes };
}
