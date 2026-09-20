const sources = { metatft: 'MetaTFT', academy: 'TFT Academy', qq: 'LOL QQ' };
const tiers = ['SS', 'S', 'A'];
const status = document.getElementById('copy-status');
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function card(comp) {
  const li = element('li', '', 'tier-item');
  const header = element('div', '', 'comp-header');
  header.append(element('span', comp.name));
  const meta = element('span', '', 'comp-meta');
  if (Number.isFinite(comp.avgPlacement)) meta.append(element('span', `평균 ${comp.avgPlacement.toFixed(2)}등`, 'comp-note'));
  const units = element('div', '', 'comp-units');
  comp.units.forEach(unit => {
    const tile = element('span', '', 'unit');
    if (unit.icon) tile.append(portrait(unit.icon, unit.name));
    tile.append(element('span', unit.name)); units.append(tile);
  });
  const button = element('button', '복사', 'copy-btn');
  button.setAttribute('aria-label', `${comp.name} 팀코드 복사`);
  button.title = comp.teamCode ? '팀코드 복사' : comp.codeReason;
  button.disabled = !comp.teamCode;
  meta.append(button); header.append(meta);
  li.append(header, units);
  if (comp.teamCode) {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(comp.teamCode);
        status.textContent = `${comp.name} 팀코드를 복사했습니다. 게임의 팀 플래너에 붙여넣으세요.`;
        button.textContent = '완료';
        setTimeout(() => { button.textContent = '복사'; }, 2000);
        const message = status.textContent;
        setTimeout(() => { if (status.textContent === message) status.textContent = ''; }, 4000);
      } catch {
        status.textContent = '클립보드 접근이 제한되었습니다. 브라우저의 클립보드 권한을 확인해주세요.';
      }
    });
  } else li.append(element('p', comp.codeReason, 'comp-note'));
  if (comp.omitted?.length) li.append(element('p', '팀코드에서 소환물은 제외됩니다.', 'comp-note'));
  const link = element('a', '원본 보기 ↗', 'source-link');
  link.href = comp.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
  li.append(link);
  return li;
}

async function load(source) {
  const lists = Object.fromEntries(tiers.map(tier => [tier, document.getElementById(`${source}-${tier.toLowerCase()}-list`)]));
  const column = lists.SS.closest('.column');
  let note = column.querySelector('.source-status');
  if (!note) { note = element('div', '', 'source-status'); note.setAttribute('aria-live', 'polite'); column.querySelector('.site-title').after(note); }
  note.textContent = `${sources[source]} 연결 중…`;
  Object.values(lists).forEach(list => list.replaceChildren(element('li', '로딩 중…', 'tier-item')));
  try {
    const response = await fetch(`/api/${source}`, { signal: AbortSignal.timeout(55000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '데이터를 불러오지 못했습니다.');
    if (!Array.isArray(data.comps)) throw new Error('잘못된 데이터 응답입니다.');
    note.textContent = `${data.set} · ${data.comps.length}개 덱 수집 · SS/S/A 각각 최대 10개 표시 · ${new Date(data.fetchedAt).toLocaleString('ko-KR')}\n${data.tierNote}`;
    tiers.forEach(tier => {
      const comps = data.comps.filter(comp => comp.tier === tier).slice(0, 10);
      lists[tier].replaceChildren(...(comps.length ? comps.map(card) : [element('li', '해당 티어의 덱이 없습니다.', 'tier-item')]));
    });
  } catch (error) {
    note.textContent = `불러오기 실패: ${error.message}`;
    const retry = element('button', '다시 시도', 'retry-btn');
    retry.addEventListener('click', () => load(source)); note.append(retry);
    Object.values(lists).forEach(list => list.replaceChildren(element('li', '원본 연결을 확인한 뒤 다시 시도하세요.', 'tier-item')));
  }
}
Promise.allSettled(Object.keys(sources).map(load));

function portrait(src, name) {
  const img = element('img');
  img.src = src; img.alt = name; img.loading = 'lazy'; img.width = 40; img.height = 40;
  img.addEventListener('error', () => { img.hidden = true; });
  return img;
}
const itemPanel = document.getElementById('items-view');
let itemData, itemRequest;
async function showItems(type) {
  itemPanel.replaceChildren(element('p', '티어 데이터를 불러오는 중…', 'source-status'));
  try {
    if (!itemData) {
      itemRequest ||= fetch('/api/items', { signal: AbortSignal.timeout(40000) }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '불러오기 실패');
        return data;
      }).finally(() => { itemRequest = null; });
      itemData = await itemRequest;
    }
    if (location.hash !== `#${type}`) return;
    const link = element('a', 'TFTable 원본 ↗', 'source-link');
    link.href = `https://tftable.cc/item-tierlist#${type}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
    itemPanel.replaceChildren(element('h2', type === 'artifacts' ? '유물 티어' : '상징 티어'), link,
      element('p', `${itemData.set} · 원본 갱신 ${new Date(itemData.updatedAt).toLocaleString('ko-KR')}`, 'source-status'),
      element('p', '아이템과 덱의 조합 강도입니다. 원본 기본 보기처럼 전용 증강 덱은 제외합니다.', 'source-status'));
    const labels = { essential: 'Essential · 필수', op: 'OP · 최상', good: 'Good · 강력', normal: 'Normal · 보통', unplayable: 'Unplayable · 비추천' };
    for (const [tier, label] of Object.entries(labels)) {
      const rows = itemData.tabs[type][tier];
      if (!rows.length) continue;
      const section = element('section', '', `item-tier ${tier}`);
      section.append(element('h3', `${label} (${rows.length})`));
      const grid = element('div', '', 'item-grid');
      rows.forEach(row => {
        const card = element('article', '', 'tier-item');
        const head = element('div', '', 'item-heading');
        head.append(portrait(row.icon, row.name), element('strong', row.name)); card.append(head);
        row.comps.forEach(comp => {
          const recommendation = element('div', '', 'recommendation');
          if (comp.carrierIcon) recommendation.append(portrait(comp.carrierIcon, comp.carrier));
          recommendation.append(element('span', `${comp.name} · ${comp.carrier}${Number.isFinite(comp.strength) ? ` · 강도 ${comp.strength.toFixed(2)}` : ''}`));
          card.append(recommendation);
        });
        grid.append(card);
      });
      section.append(grid); itemPanel.append(section);
    }
  } catch (error) {
    if (location.hash !== `#${type}`) return;
    const retry = element('button', '다시 시도', 'retry-btn');
    retry.addEventListener('click', () => showItems(type));
    itemPanel.replaceChildren(element('p', `불러오기 실패: ${error.message}`), retry);
  }
}
function navigate() {
  const view = ['#artifacts', '#emblems'].includes(location.hash) ? location.hash.slice(1) : 'comps';
  document.getElementById('comps-view').hidden = view !== 'comps';
  itemPanel.hidden = view === 'comps';
  document.querySelectorAll('[data-view]').forEach(link => {
    const active = link.dataset.view === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (view !== 'comps') showItems(view);
}
window.addEventListener('hashchange', navigate);
navigate();
