import { createLookup, decorateComp, parseAcademy, parseQQ } from './tft.js';

export async function fetchData(url, json = true) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: json ? 'application/json' : 'text/html,text/plain' } });
  if (!response.ok) throw new Error(`원본 서버 응답 오류 (${response.status})`);
  return json ? response.json() : response.text();
}

const lookups = new Map();
export async function getLookup(set) {
  if (!/^TFTSet\d+(?:_\w+)?$/.test(set)) throw new Error('알 수 없는 세트');
  const old = lookups.get(set);
  if (old && old.expires > Date.now()) return old.value;
  const value = createLookup(await fetchData(`https://data.metatft.com/lookups/${set}_latest_ko_kr.json`), set);
  lookups.set(set, { value, expires: Date.now() + 300000 });
  return value;
}

export async function loadSource(source) {
  let result;
  if (source === 'metatft') {
    const payload = await fetchData('https://api-hc.metatft.com/tft-comps-api/comps_data?queue=1100');
    const data = payload?.results?.data;
    if (!data?.cluster_details || !Object.keys(data.cluster_details).length) throw new Error('MetaTFT 데이터 구조가 변경되었습니다.');
    const lookup = await getLookup(data.tft_set);
    result = { set: data.tft_set,
      tierNote: '원시 평균 순위 기준 S(<4.25), A(<4.50). 원본의 필터·보정 적용 티어와 다를 수 있습니다. SS는 별도 생성하지 않습니다.',
      comps: Object.values(data.cluster_details).filter(c => Number.isFinite(c.overall?.avg) && c.overall.avg < 4.5).sort((a,b) => a.overall.avg - b.overall.avg).map(c => ({
        id: String(c.Cluster), name: c.name_string.split(',').map(id => lookup.names.get(id.trim()) || id.trim()).join(' · '),
        tier: c.overall.avg < 4.25 ? 'S' : 'A', avgPlacement: c.overall.avg,
        unitIds: c.units_string.split(',').map(id => id.trim()).filter(Boolean), sourceUrl: 'https://www.metatft.com/comps',
      })),
    };
  } else if (source === 'academy') {
    result = { ...parseAcademy(await fetchData('https://tftacademy.com/tierlist/comps/__data.json')), tierNote: 'Academy의 공개 SS·S·A 티어와 표시 순서입니다.' };
  } else if (source === 'qq') {
    const config = await fetchData('https://lol.qq.com/tft/js/tft-mode-registry.js', false);
    const season = config.match(/window\.CurrentSet\s*=\s*'(s\d+)'/)?.[1];
    if (!season) throw new Error('QQ 현재 세트를 확인할 수 없습니다.');
    const payload = await fetchData(`https://game.gtimg.cn/images/lol/act/tftzlkauto/json/lineupJson/${season}/6/lineup_detail_total.json`);
    result = { set: `TFTSet${season.slice(1)}`, comps: parseQQ(payload, season), tierNote: 'QQ의 공개 SS·S·A 티어와 표시 순서입니다. 덱명은 원문입니다.' };
  } else throw new Error('지원하지 않는 데이터 소스');
  const lookup = await getLookup(result.set);
  return { source, ...result, fetchedAt: new Date().toISOString(), lookupMetadata: lookup.metadata, comps: result.comps.map(c => decorateComp(c, lookup)) };
}

export function sourceHandler(source) {
  return async (req, res) => {
    if (req.method && req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'GET 요청만 지원합니다.' }); }
    try {
      const data = await loadSource(source);
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(data);
    } catch (error) {
      console.error(`${source}:`, error.message);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ source, error: error.message });
    }
  };
}
