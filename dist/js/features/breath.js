// «Подыши со мной» — the breathing circle, right on the page. Timing and easing follow
// the bot's animation: radius 78→176 (scale .443→1), ease = 0.5 − 0.5·cos(πt),
// a ±2% pulse on the pause, halo glow tied to the phase. Reduced motion: a text timer.
import { $, $$, clamp, focusQuietly } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction, goTo } from '../core/actions.js';
import { closeSheet, openSheets } from '../core/sheets.js';
import { pick } from '../core/phrases.js';
import { celebrate } from '../core/celebrate.js';
import { keepAwake } from '../core/wakelock.js';
import { ensureAudio, glide, bell, buzz, vibrationSupported } from '../core/audio.js';
import { BREATH, PRACTICE_DONE } from '../content/practices.js';

const MIN = 0.443;
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const SQUARE_EDGES = [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]];

const s = {
  pattern: '36', length: '60', custom: { in: 4, out: 6 },
  running: false, paused: false, elapsed: 0, last: 0, raf: 0, phaseKey: '',
  eyes: false, dim: false,
};
let el = {};

function seconds(n) {
  const mod10 = n % 10; const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'секунда';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'секунды';
  return 'секунд';
}

function phases() {
  if (s.pattern === 'custom') return [['in', s.custom.in], ['out', s.custom.out]];
  return BREATH.patterns[s.pattern].phases;
}
const cycleLength = () => phases().reduce((sum, [, d]) => sum + d, 0);
function cycleCount() {
  if (s.length === '3c') return 3;
  return Math.max(1, Math.round((s.length === '180' ? 180 : 60) / cycleLength()));
}

function position(elapsed) {
  const list = phases();
  const length = cycleLength();
  const cycle = Math.floor(elapsed / length);
  let t = elapsed - cycle * length;
  for (let index = 0; index < list.length; index += 1) {
    const [kind, d] = list[index];
    if (t < d || index === list.length - 1) return { cycle, index, kind, d, p: clamp(t / d, 0, 1), left: Math.max(0, d - t) };
    t -= d;
  }
  return null;
}

function describe() {
  const list = phases();
  if (list.length === 2) return `Вдох на ${list[0][1]} — выдох на ${list[1][1]}`;
  return list.map(([kind, d]) => `${BREATH.phaseNames[kind].toLowerCase()} ${d}`).join(' — ').replace(/^./, (c) => c.toUpperCase());
}

function setVars({ scale, glow, dot = null, ring = 0, bar = 0 }) {
  const root = el.section;
  root.style.setProperty('--b-scale', scale.toFixed(4));
  root.style.setProperty('--b-glow', glow.toFixed(3));
  root.style.setProperty('--b-flower', (0.9 + 0.15 * clamp((scale - MIN) / (1 - MIN), 0, 1)).toFixed(4));
  if (el.progress) el.progress.style.strokeDashoffset = String(100 - ring * 100);
  if (el.bar) el.bar.style.width = `${(bar * 100).toFixed(2)}%`;
  if (dot) { root.style.setProperty('--b-dx', `${(dot[0] * 100).toFixed(2)}%`); root.style.setProperty('--b-dy', `${(dot[1] * 100).toFixed(2)}%`); }
}

function visual(pos) {
  const { kind, p } = pos;
  if (prefs.reducedMotion) return { scale: 0.72, glow: 0.25 };
  if (kind === 'in') return { scale: MIN + (1 - MIN) * ease(p), glow: 0.5 * ease(p) };
  if (kind === 'hold') return { scale: 1 + 0.023 * Math.sin(3 * Math.PI * p), glow: 0.5 + 0.15 * Math.sin(3 * Math.PI * p) };
  if (kind === 'out') return { scale: 1 - (1 - MIN) * ease(p), glow: 0.5 * (1 - ease(p)) };
  return { scale: MIN + 0.012 * Math.sin(3 * Math.PI * p), glow: 0.04 };
}

function idle() {
  setVars({ scale: prefs.reducedMotion ? 0.72 : 0.62, glow: 0.12, dot: [0, 0], ring: 0, bar: 0 });
  el.phase.textContent = 'Готова?';
  el.secs.textContent = '';
  el.count.textContent = describe();
  if (el.dimPhase) el.dimPhase.textContent = '';
}

function onPhase(pos) {
  const name = BREATH.phaseNames[pos.kind];
  el.live.textContent = `${name}, ${pos.d} ${seconds(pos.d)}`;
  if (el.dimPhase) el.dimPhase.textContent = name;
  if (prefs.sound || s.eyes) {
    if (pos.kind === 'in') glide(196, 247, pos.d);
    else if (pos.kind === 'out') glide(247, 196, pos.d);
    if (s.eyes) bell(pos.kind === 'in' ? 392 : pos.kind === 'out' ? 330 : 440, 0.035);
  }
  if (prefs.vibration && vibrationSupported()) buzz(pos.kind === 'in' ? 30 : pos.kind === 'out' ? [15, 60, 15] : 10);
}

function render(pos) {
  const length = cycleLength();
  const total = cycleCount() * length;
  const look = visual(pos);
  let dot = null;
  if (s.pattern === 'square') {
    const [[x0, y0], [x1, y1]] = SQUARE_EDGES[pos.index % 4];
    dot = [x0 + (x1 - x0) * pos.p, y0 + (y1 - y0) * pos.p];
  }
  setVars({ ...look, dot, ring: (s.elapsed % length) / length, bar: prefs.reducedMotion ? pos.p : s.elapsed / total });
  const key = `${pos.cycle}-${pos.index}`;
  const name = BREATH.phaseNames[pos.kind];
  el.phase.textContent = prefs.reducedMotion ? `${name}…` : name;
  el.secs.textContent = String(Math.max(1, Math.ceil(pos.left - 1e-6)));
  el.count.textContent = `круг ${Math.min(pos.cycle + 1, cycleCount())} из ${cycleCount()}`;
  if (key !== s.phaseKey) { s.phaseKey = key; onPhase(pos); }
}

function frame(now) {
  if (!s.running || s.paused) return;
  s.elapsed += Math.min(0.25, (now - s.last) / 1000);
  s.last = now;
  if (s.elapsed >= cycleCount() * cycleLength()) { finish(true); return; }
  render(position(s.elapsed));
  s.raf = requestAnimationFrame(frame);
}

function setStartButton(mode) {
  const label = { start: 'Начать', pause: 'Пауза', resume: 'Продолжить' }[mode];
  el.start.querySelector('span').textContent = label;
  el.start.querySelector('use')?.setAttribute('href', mode === 'pause' ? '#i-pause' : '#i-play');
}

function start() {
  cancelAnimationFrame(s.raf);
  if (prefs.sound || s.eyes) ensureAudio();
  s.running = true; s.paused = false; s.elapsed = 0; s.phaseKey = ''; s.last = performance.now();
  el.done.hidden = true;
  el.stop.hidden = false;
  el.root.classList.add('is-running');
  el.section.classList.add('is-breathing');
  setStartButton('pause');
  keepAwake('breath', true);
  const tried = store.temp.get('tried') || new Set();
  tried.add('дыхание');
  store.temp.set('tried', tried);
  document.dispatchEvent(new CustomEvent('practice:done', { detail: { practice: 'breath' } }));
  if (s.eyes) showOverlay('eyes');
  render(position(0));
  s.raf = requestAnimationFrame(frame);
}

function pause() {
  if (!s.running || s.paused) return;
  s.paused = true;
  cancelAnimationFrame(s.raf);
  keepAwake('breath', false);
  setStartButton('resume');
  el.phase.textContent = 'На паузе';
  el.secs.textContent = '';
  el.live.textContent = 'Пауза';
  if (s.eyes) hideOverlay();
}

function resume() {
  if (!s.running || !s.paused) return;
  if (prefs.sound || s.eyes) ensureAudio();
  s.paused = false; s.last = performance.now(); s.phaseKey = '';
  keepAwake('breath', true);
  setStartButton('pause');
  if (s.eyes) showOverlay('eyes');
  s.raf = requestAnimationFrame(frame);
}

function finish(completed) {
  if (!s.running) return;
  s.running = false; s.paused = false;
  cancelAnimationFrame(s.raf);
  keepAwake('breath', false);
  hideOverlay();
  el.root.classList.remove('is-running');
  el.section.classList.remove('is-breathing');
  el.stop.hidden = true;
  setStartButton('start');
  idle();
  const phrase = completed ? pick(PRACTICE_DONE, 'practice-done') : BREATH.stopped;
  el.donePhrase.textContent = phrase;
  el.done.hidden = false;
  el.live.textContent = completed ? `Готово. ${phrase}` : phrase;
  focusQuietly(el.done);
  if (completed) celebrate('sprout', el.donePhrase);
}

function reset() {
  if (s.running) {
    s.running = false; s.paused = false;
    cancelAnimationFrame(s.raf);
    keepAwake('breath', false);
    hideOverlay();
    el.root.classList.remove('is-running');
    el.section.classList.remove('is-breathing');
    el.stop.hidden = true;
    setStartButton('start');
  }
  idle();
}

/* ----- Dim screen and «закрой глаза» ----- */
function showOverlay(mode) {
  if (!el.dimmer) return;
  el.dimmer.hidden = false;
  el.dimmer.classList.toggle('is-eyes', mode === 'eyes');
  document.documentElement.classList.add('is-dimmed');
  if (mode === 'dim') { s.dim = true; requestAnimationFrame(() => el.dimExit?.focus({ preventScroll: true })); }
}
function hideOverlay() {
  if (!el.dimmer || el.dimmer.hidden) return;
  const wasDim = s.dim;
  el.dimmer.hidden = true;
  s.dim = false;
  document.documentElement.classList.remove('is-dimmed');
  if (wasDim) el.dimButton?.focus({ preventScroll: true });
}

/* ----- Settings ----- */
function setPattern(pattern) {
  if (!BREATH.patterns[pattern]) return;
  s.pattern = pattern;
  $$('[data-breath-patterns] [data-pattern]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pattern === pattern)));
  if (el.note) el.note.textContent = BREATH.patterns[pattern].note;
  if (el.custom) el.custom.hidden = pattern !== 'custom';
  el.stageBox?.classList.toggle('is-square', pattern === 'square');
  reset();
}
function setLength(length) {
  if (!['60', '3c', '180'].includes(length)) return;
  s.length = length;
  $$('[data-breath-lengths] [data-length]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.length === length)));
  reset();
}
function syncSwitches() {
  $$('[data-breath-opt]').forEach((button) => {
    const key = button.dataset.breathOpt;
    const on = key === 'eyes' ? s.eyes : key === 'sound' ? prefs.sound : prefs.vibration;
    button.setAttribute('aria-checked', String(Boolean(on)));
  });
}
function renderTexts() {
  if (el.lead) el.lead.textContent = prefs.isNight || prefs.part === 'night' ? BREATH.lead.night : BREATH.lead.default;
  if (el.safety) el.safety.textContent = prefs.stage === 'pregnancy' ? BREATH.safety.pregnancy : BREATH.safety.default;
}

function bind() {
  el.start.addEventListener('click', () => {
    if (!s.running) start(); else if (s.paused) resume(); else pause();
  });
  el.stop.addEventListener('click', () => finish(false));
  $('[data-breath-again]')?.addEventListener('click', () => start());
  $$('[data-breath-patterns] [data-pattern]').forEach((b) => b.addEventListener('click', () => setPattern(b.dataset.pattern)));
  $$('[data-breath-lengths] [data-length]').forEach((b) => b.addEventListener('click', () => setLength(b.dataset.length)));
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.step;
    s.custom[key] = clamp(s.custom[key] + Number(b.dataset.delta), 2, 8);
    const out = $(key === 'in' ? '[data-custom-in]' : '[data-custom-out]');
    if (out) out.textContent = `${s.custom[key]} с`;
    reset();
  }));
  $$('[data-breath-opt]').forEach((button) => {
    if (button.dataset.breathOpt === 'vibration' && vibrationSupported()) button.hidden = false;
    button.addEventListener('click', () => {
      const key = button.dataset.breathOpt;
      if (key === 'sound') { const next = !prefs.sound; prefs.setSound(next); if (next) ensureAudio(); }
      if (key === 'vibration') prefs.setVibration(!prefs.vibration);
      if (key === 'eyes') {
        s.eyes = !s.eyes;
        if (s.eyes && !prefs.sound && !(prefs.vibration && vibrationSupported())) { prefs.setSound(true); ensureAudio(); }
        if (s.eyes && s.running && !s.paused) showOverlay('eyes');
        if (!s.eyes) hideOverlay();
      }
      syncSwitches();
    });
  });
  el.dimButton?.addEventListener('click', () => {
    if (prefs.sound || s.eyes) ensureAudio();
    showOverlay('dim');
    if (!s.running) start(); else if (s.paused) resume();
  });
  el.dimExit?.addEventListener('click', (event) => { event.stopPropagation(); hideOverlay(); finish(false); });
  el.dimmer?.addEventListener('click', (event) => {
    if (event.target.closest('[data-dim-exit]')) return;
    if (el.dimmer.classList.contains('is-eyes')) pause();
  });
  el.section.addEventListener('keydown', (event) => {
    if (event.key === ' ' && !event.target.closest('button, a, input, textarea, select')) {
      event.preventDefault();
      el.start.click();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !s.running || openSheets().length) return;
    if (s.dim || el.section.contains(document.activeElement) || (el.dimmer && !el.dimmer.hidden)) { hideOverlay(); finish(false); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('store:change', (event) => { if (['sound', 'vibration', '*'].includes(event.detail?.key)) syncSwitches(); });
  document.addEventListener('prefs:apply', renderTexts);
  document.addEventListener('stage:change', renderTexts);
}

export function init() {
  const section = $('#dyhanie');
  const root = $('[data-breath]');
  if (!section || !root) return;
  el = {
    section, root,
    stageBox: $('[data-breath-stage]', root),
    phase: $('[data-breath-phase]', root), secs: $('[data-breath-secs]', root), count: $('[data-breath-count]', root),
    bar: $('[data-breath-bar]', root), live: $('[data-breath-live]', root), progress: $('[data-breath-progress]', root),
    start: $('[data-breath-start]', root), stop: $('[data-breath-stop]', root),
    done: $('[data-breath-done]', section), donePhrase: $('[data-breath-done-phrase]', section),
    note: $('[data-pattern-note]', section), custom: $('[data-breath-custom]', section),
    lead: $('[data-breath-lead]', section), safety: $('[data-breath-safety]', section),
    dimmer: $('[data-breath-dimmer]', section), dimPhase: $('[data-dim-phase]', section), dimExit: $('[data-dim-exit]', section),
    dimButton: $('[data-breath-dim]', section),
  };
  if (el.progress) el.progress.style.strokeDasharray = '100';
  root.classList.toggle('is-static', prefs.reducedMotion);
  bind();
  syncSwitches();
  renderTexts();
  idle();
  document.addEventListener('prefs:apply', () => root.classList.toggle('is-static', prefs.reducedMotion));

  registerAction('breathe', (button, detail = {}) => {
    if (prefs.sound || s.eyes) ensureAudio();
    if (openSheets().length) closeSheet();
    if (detail.pattern) setPattern(detail.pattern);
    if (detail.length) setLength(detail.length);
    setTimeout(() => {
      goTo('#dyhanie', { focus: false });
      const go = () => {
        if (detail.start === 'true' && !s.running) start();
        focusQuietly(el.start);
      };
      setTimeout(go, prefs.reducedMotion ? 30 : 650);
    }, 60);
  });
}
