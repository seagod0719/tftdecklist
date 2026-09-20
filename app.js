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
  if (Number.isFinite(comp.avgPlacement)) header.append(element('span', `평균 ${comp.avgPlacement.toFixed(2)}등`, 'comp-note'));
  const units = element('div', '', 'comp-units');
  comp.units.forEach(unit => units.append(element('span', unit.name, 'unit')));
  const button = element('button', '팀코드 복사', 'copy-btn');
  button.disabled = !comp.teamCode;
  li.append(header, units, button);
  if (comp.teamCode) {
    const input = element('input', '', 'code-field');
    input.value = comp.teamCode;
    input.readOnly = true;
    input.setAttribute('aria-label', `${comp.name} 팀코드`);
    input.addEventListener('click', () => input.select());
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(comp.teamCode);
        status.textContent = `${comp.name} 팀코드를 복사했습니다. 게임의 팀 플래너에 붙여넣으세요.`;
        button.textContent = '복사 완료';
        setTimeout(() => { button.textContent = '팀코드 복사'; }, 2000);
      } catch {
        input.focus(); input.select();
        status.textContent = '클립보드 접근이 제한되었습니다. 선택된 팀코드를 Ctrl+C로 복사하세요.';
      }
    });
    li.append(input);
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
    note.textContent = `${data.set} · ${data.comps.length}개 덱 · 수집 ${new Date(data.fetchedAt).toLocaleString('ko-KR')}\n${data.tierNote}`;
    tiers.forEach(tier => {
      const comps = data.comps.filter(comp => comp.tier === tier);
      lists[tier].replaceChildren(...(comps.length ? comps.map(card) : [element('li', '해당 티어의 덱이 없습니다.', 'tier-item')]));
    });
  } catch (error) {
    note.textContent = `불러오기 실패: ${error.message}`;
    const retry = element('button', '다시 시도', 'retry-btn');
    retry.addEventListener('click', () => load(source)); note.append(retry);
    Object.values(lists).forEach(list => list.replaceChildren(element('li', '원본 연결을 확인한 뒤 다시 시도하세요.', 'tier-item')));
  }
}
await Promise.allSettled(Object.keys(sources).map(load));
