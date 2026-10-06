// Site-wide state that features read: theme (light by default, dark on request), part of day, motion,
// text size, the visitor's stage and quiet mode. Everything is reflected on <html>.
import { store } from './store.js';
import { partOfDay, watchTime, now } from './time.js';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

export const STAGES = {
  planning: { label: 'Планирую', long: 'Планирую беременность' },
  pregnancy: { label: 'Жду малыша', long: 'Жду малыша' },
  postpartum: { label: 'Малыш родился', long: 'Малыш уже родился' },
  loss: { label: 'Пережила потерю', long: 'Пережила потерю' },
  close: { label: 'Я близкий человек', long: 'Я близкий человек' },
  none: { label: 'Не хочу отвечать', long: 'Не хочу отвечать' },
};

// Dev preview only: ?stage=loss&tod=night&theme=night
if (params.get('stage') && STAGES[params.get('stage')]) store.set('stage', params.get('stage'));
if (['day', 'night'].includes(params.get('theme'))) store.set('theme', params.get('theme'));

export const prefs = {
  get stage() { return store.get('stage', null); },
  setStage(stage) { store.set('stage', STAGES[stage] ? stage : null); apply(); },
  get theme() { return store.get('theme') === 'night' ? 'night' : 'day'; },
  setTheme(theme) { store.set('theme', theme === 'night' ? 'night' : 'day'); apply(); },
  get isNight() { return root.dataset.theme === 'night'; },
  get part() { return root.dataset.part || partOfDay(); },
  get motion() { return store.get('motion', 'auto'); },
  setMotion(value) { store.set('motion', value); apply(); },
  get reducedMotion() {
    const pref = store.get('motion', 'auto');
    return pref === 'reduced' || (pref === 'auto' && systemReduced.matches);
  },
  get textLarge() { return store.get('textLarge', false); },
  setTextLarge(value) { store.set('textLarge', Boolean(value)); apply(); },
  get sound() { return store.get('sound', false); },
  setSound(value) { store.set('sound', Boolean(value)); },
  get vibration() { return store.get('vibration', false); },
  setVibration(value) { store.set('vibration', Boolean(value)); },
  /** Quiet mode: loss stage, or the help sheet / crisis hint was shown during this visit. */
  get quiet() { return store.get('stage') === 'loss' || store.temp.get('quiet') === true; },
  enterQuiet(reason = 'help') { store.temp.set('quiet', true); store.temp.set('quietReason', reason); apply(); },
};

function themeColor() {
  const value = getComputedStyle(root).getPropertyValue('--paper').trim() || '#f8f7f2';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  meta.content = value;
}

export function apply(date = now()) {
  const night = prefs.theme === 'night';
  const previousTheme = root.dataset.theme;
  root.dataset.theme = night ? 'night' : 'day';
  root.dataset.part = partOfDay(date);
  root.dataset.stage = prefs.stage || 'unset';
  root.classList.toggle('motion-reduced', prefs.reducedMotion);
  root.classList.toggle('motion-allowed', store.get('motion', 'auto') === 'full');
  root.classList.toggle('text-large', prefs.textLarge);
  root.classList.toggle('is-quiet', prefs.quiet);
  themeColor();
  if (previousTheme && previousTheme !== root.dataset.theme) {
    document.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: root.dataset.theme } }));
  }
  document.dispatchEvent(new CustomEvent('prefs:apply', { detail: { date } }));
}

export function initPrefs() {
  watchTime(apply);
  systemReduced.addEventListener?.('change', () => apply());
  store.subscribe((key) => { if (key === '*') apply(); });
}
