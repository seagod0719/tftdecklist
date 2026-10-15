import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, initTheme, THEME_KEY } from '../theme-toggle.js';

function fakeInterface(start = undefined) {
  function makeButton(theme) {
    return {
      dataset: { themeOption: theme },
      pressed: null,
      events: {},
      setAttribute(name, value) {
        if (name === 'aria-pressed') this.pressed = value;
      },
      addEventListener(event, listener) { this.events[event] = listener; },
      click() { this.events.click(); },
    };
  }
  const light = makeButton('light');
  const dark = makeButton('dark');
  const root = { dataset: { theme: start } };
  const doc = { documentElement: root, querySelectorAll: () => [light, dark] };
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  return { doc, root, light, dark, data, storage };
}

test('default is dark with dark button selected', () => {
  const ctx = fakeInterface();
  initTheme(ctx.doc, ctx.storage);
  assert.equal(ctx.root.dataset.theme, 'dark');
  assert.equal(ctx.light.pressed, 'false');
  assert.equal(ctx.dark.pressed, 'true');
});

test('clicking sun sets light, saves it, and updates pressed state', () => {
  const ctx = fakeInterface();
  initTheme(ctx.doc, ctx.storage);
  ctx.light.click();
  assert.equal(ctx.root.dataset.theme, 'light');
  assert.equal(ctx.data.get(THEME_KEY), 'light');
  assert.equal(ctx.light.pressed, 'true');
  assert.equal(ctx.dark.pressed, 'false');
  ctx.dark.click();
  assert.equal(ctx.root.dataset.theme, 'dark');
  assert.equal(ctx.data.get(THEME_KEY), 'dark');
  assert.equal(ctx.dark.pressed, 'true');
});

test('saved theme is restored without relying on tab content', () => {
  const ctx = fakeInterface('dark');
  ctx.data.set(THEME_KEY, 'light');
  initTheme(ctx.doc, ctx.storage);
  assert.equal(ctx.root.dataset.theme, 'light');
  assert.equal(ctx.light.pressed, 'true');
});

test('disabled storage never prevents appearance change', () => {
  const ctx = fakeInterface();
  const blocked = {
    getItem() { throw Error('storage blocked'); },
    setItem() { throw Error('storage blocked'); },
  };
  assert.doesNotThrow(() => initTheme(ctx.doc, blocked));
  assert.doesNotThrow(() => ctx.light.click());
  assert.equal(ctx.root.dataset.theme, 'light');
});

test('unknown themes are normalized to dark', () => {
  const ctx = fakeInterface();
  assert.equal(applyTheme('unexpected', ctx.root, [ctx.light, ctx.dark]), 'dark');
  assert.equal(ctx.dark.pressed, 'true');
});
