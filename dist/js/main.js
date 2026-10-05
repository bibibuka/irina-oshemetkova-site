// Entry point. Core first (preferences, sheets, actions, motion), then every feature
// is loaded on its own: one broken feature never takes the others down.
import { initPrefs } from './core/prefs.js';
import { initSheets } from './core/sheets.js';
import { initActions } from './core/actions.js';
import { initReveals, initHeader, initSectionSpy, initKeyboardAwareDock } from './core/motion.js';
import { $$ } from './core/dom.js';

const FEATURES = [
  'help', 'settings', 'hero', 'checkin', 'doors', 'breath', 'letter', 'irina',
  'practices', 'thought', 'words', 'deck', 'night', 'bot',
];

function safely(name, fn) {
  try { fn(); } catch (error) { console.error(`[${name}]`, error); }
}

function autosizeFallback() {
  if (window.CSS?.supports?.('field-sizing', 'content')) return;
  const fit = (area) => {
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight + 2, window.innerHeight * 0.5)}px`;
  };
  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) { event.target.classList.add('is-autosize'); fit(event.target); }
  });
}

function boot() {
  // Sheets push a history entry so «Назад» closes them; keep the browser from jumping the page when it pops.
  try { history.scrollRestoration = 'manual'; } catch { /* old browsers */ }
  safely('prefs', initPrefs);
  safely('sheets', initSheets);
  safely('actions', initActions);
  safely('header', initHeader);
  safely('reveals', initReveals);
  safely('spy', initSectionSpy);
  safely('dock', initKeyboardAwareDock);
  safely('autosize', autosizeFallback);
  safely('year', () => $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); }));

  const loading = FEATURES.map((name) => import(`./features/${name}.js`)
    .then((module) => safely(name, () => module.init?.()))
    .catch((error) => console.error(`[${name}] failed to load`, error)));
  Promise.allSettled(loading).then(() => {
    document.documentElement.dataset.features = 'ready';
    document.dispatchEvent(new CustomEvent('features:ready'));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
