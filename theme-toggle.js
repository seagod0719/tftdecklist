export const THEME_KEY = 'tft-theme';

export function applyTheme(theme, root, buttons) {
  const selected = theme === 'light' ? 'light' : 'dark';
  root.dataset.theme = selected;
  buttons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeOption === selected));
  });
  return selected;
}

export function initTheme(doc, storage) {
  const buttons = [...doc.querySelectorAll('[data-theme-option]')];
  let saved = null;
  try { saved = storage?.getItem(THEME_KEY); } catch { /* storage may be disabled */ }

  // The head bootstrap script applies the saved light theme before first paint.
  const initial = saved === 'light' || saved === 'dark' ? saved : doc.documentElement.dataset.theme;
  applyTheme(initial, doc.documentElement, buttons);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const selected = applyTheme(button.dataset.themeOption, doc.documentElement, buttons);
      try { storage?.setItem(THEME_KEY, selected); } catch { /* still switch visually */ }
    });
  }
}

if (typeof document !== 'undefined') {
  let storage;
  try { storage = window.localStorage; } catch { /* privacy mode */ }
  initTheme(document, storage);
}
