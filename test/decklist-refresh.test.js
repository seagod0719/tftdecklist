import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Minimal DOM contract for the decklist's three independent source columns.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.events = {};
    this.attributes = {};
    this.textContent = '';
    this.disabled = false;
  }
  append(...nodes) { this.children.push(...nodes); }
  after(node) { this.column.note = node; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(event, listener) { this.events[event] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  closest(selector) { assert.equal(selector, '.column'); return this.column; }
  querySelector(selector) {
    if (selector === '.source-status') return this.note || null;
    if (selector === '.site-title') return this.title;
    throw new Error('Unexpected selector: ' + selector);
  }
  click() { return this.events.click?.(); }
}

function fixture() {
  const button = new Element('button');
  const time = new Element('p');
  const columns = {};
  const nodes = {
    'comps-refresh-btn': button,
    'comps-refresh-time': time,
    'copy-status': new Element('p'),
    'items-view': new Element('main'),
    'recent-wins-view': new Element('main'),
    'comps-view': new Element('main'),
  };
  for (const [source, tiers] of Object.entries({
    metatft: ['ss', 's', 'a'], academy: ['ss', 's', 'a'], dakgg: ['s', 'a', 'b'],
  })) {
    const column = new Element('section');
    column.title = new Element('div');
    column.title.column = column;
    columns[source] = column;
    for (const tier of tiers) {
      const list = new Element('ul');
      list.column = column;
      nodes[`${source}-${tier}-list`] = list;
    }
  }
  const requests = [];
  let failingSource = null;
  let block = null;
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (block) await block;
    if (failingSource && url === '/api/' + failingSource) throw new Error('Test source offline');
    return {
      ok: true,
      json: async () => ({
        set: 'TFTSet18', comps: [], tierNote: 'Test', fetchedAt: '2026-10-26T09:00:00Z',
      }),
    };
  };
  const document = {
    getElementById: id => {
      assert.ok(nodes[id], 'Missing DOM id: ' + id);
      return nodes[id];
    },
    createElement: tag => new Element(tag),
    querySelectorAll: () => [],
  };
  const context = {
    document, fetch, AbortSignal, navigator: {}, location: { hash: '#comps' },
    window: { addEventListener() {} }, setTimeout, Date, console, Promise,
  };
  runInNewContext(readFileSync(new URL('../app.js', import.meta.url), 'utf8'), context, { filename: 'app.js' });
  return { button, time, nodes, columns, requests,
    fail: value => { failingSource = value; },
    defer: value => { block = value; },
  };
}

async function settled() {
  await new Promise(resolve => setImmediate(resolve));
}

test('decklist refresh checks all three sources and shows the last checked time', async () => {
  const ui = fixture();
  await settled();
  assert.equal(ui.requests.length, 3);
  assert.equal(ui.button.disabled, false);
  assert.match(ui.time.textContent, /마지막 확인: .*3\/3개 사이트 성공/);
  assert.ok(ui.requests.every(r => r.options.cache === 'no-store'));
  await ui.button.click();
  assert.equal(ui.requests.length, 6);
  assert.match(ui.time.textContent, /3\/3개 사이트 성공/);
});

test('refresh prevents duplicates while loading and shows partial failure', async () => {
  const ui = fixture();
  await settled();
  const previousItems = ui.nodes['dakgg-s-list'].children;
  ui.fail('dakgg');
  let release;
  ui.defer(new Promise(resolve => { release = resolve; }));
  const pending = ui.button.click();
  assert.equal(ui.button.disabled, true);
  ui.button.click();
  assert.equal(ui.requests.length, 6, 'second click cannot start additional fetches');
  release();
  await pending;
  assert.equal(ui.button.disabled, false);
  assert.match(ui.time.textContent, /2\/3개 사이트 성공/);
  assert.match(ui.columns.dakgg.note.textContent, /불러오기 실패/);
  assert.deepEqual(ui.nodes['dakgg-s-list'].children, previousItems);
  assert.equal(ui.button.attributes['aria-busy'], undefined);
});
