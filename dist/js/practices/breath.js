// «Подышать со мной»: a living circle (radius 0.45 → 1, sine easing, as in the bot's animation).
import { h, icon, announce } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { keepAwake } from '../core/wakelock.js';
import { ensureAudio, glide } from '../core/audio.js';
import { seg } from './ui.js';

export const title = 'Подышать со мной';

const PATTERNS = {
  '36': { label: 'Длинный выдох · 3–6', note: 'Без задержек — самый мягкий ритм.', phases: [['Вдох', 3, 'in'], ['Выдох', 6, 'out']] },
  square: { label: 'Квадрат · 4–4–4–4', note: 'Ровный ритм, когда нужно собраться.', phases: [['Вдох', 4, 'in'], ['Задержка', 4, 'hold-in'], ['Выдох', 4, 'out'], ['Пауза', 4, 'hold-out']] },
  '478': { label: '4–7–8', note: 'С задержкой. Если неприятно — сократите её или выберите длинный выдох.', phases: [['Вдох', 4, 'in'], ['Задержка', 7, 'hold-in'], ['Выдох', 8, 'out']] },
};
const LENGTHS = { '60': { label: '1 минута', seconds: 60 }, '3c': { label: '3 круга', cycles: 3 }, '180': { label: '3 минуты', seconds: 180 } };
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export function render(body, api) {
  let pattern = '36';
  let length = '60';
  let sound = false;
  let frame = 0;
  let running = false;
  let paused = false;
  let startedAt = 0;
  let pausedAt = 0;
  let lastPhase = '';

  const disc = h('div', { class: 'breath__disc', 'aria-hidden': 'true' });
  const ringProgress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('class', 'breath__ring');
  ring.setAttribute('viewBox', '0 0 200 200');
  ring.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  [[track, 'breath__ring-track'], [ringProgress, 'breath__ring-progress']].forEach(([circle, cls]) => {
    circle.setAttribute('class', cls); circle.setAttribute('cx', '100'); circle.setAttribute('cy', '100'); circle.setAttribute('r', '96'); circle.setAttribute('pathLength', '100');
    ring.append(circle);
  });
  const phaseEl = h('span', { class: 'breath__phase' }, 'Готовы?');
  const secsEl = h('span', { class: 'breath__secs', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'breath__stage' }, ring, disc, h('div', { class: 'breath__readout' }, phaseEl, secsEl));
  const countEl = h('p', { class: 'breath__count' });
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const noteEl = h('p', { class: 'breath__note' });

  const startBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: () => (running ? togglePause() : start()) }, icon('play'), h('span', {}, 'Начать'));
  const stopBtn = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true, onclick: () => finish(true) }, 'Достаточно');
  const soundBtn = h('button', {
    class: 'toggle-row', type: 'button', role: 'switch', aria: { checked: 'false' },
    onclick: () => { sound = !sound; soundBtn.setAttribute('aria-checked', String(sound)); if (sound) ensureAudio(); },
  }, icon('sound'), h('span', {}, 'Тихий звук на вдохе и выдохе'));

  const settings = h('div', { class: 'breath__settings' },
    seg('Ритм', Object.entries(PATTERNS).map(([value, item]) => ({ value, label: item.label })), pattern, (value) => { pattern = value; resetView(); }),
    seg('Сколько', Object.entries(LENGTHS).map(([value, item]) => ({ value, label: item.label })), length, (value) => { length = value; resetView(); }),
  );

  const cycleLength = () => PATTERNS[pattern].phases.reduce((sum, phase) => sum + phase[1], 0);
  const cycles = () => LENGTHS[length].cycles || Math.max(1, Math.round(LENGTHS[length].seconds / cycleLength()));
  const total = () => cycles() * cycleLength();

  function describe() {
    const phases = PATTERNS[pattern].phases;
    return phases.map(([name, secs]) => `${name.toLowerCase()} на ${secs}`).join(' — ').replace(/^./, (c) => c.toUpperCase());
  }

  function resetView() {
    if (running) stop();
    noteEl.textContent = `${PATTERNS[pattern].note} Если кружится голова или неприятно — дышите в своём ритме. Остановиться можно в любой момент.`;
    countEl.textContent = `${describe()} · ${cycles()} ${plural(cycles(), 'круг', 'круга', 'кругов')}`;
    phaseEl.textContent = 'Готовы?';
    secsEl.textContent = '';
    paint(0, 0, 0);
  }

  function paint(value, glow, progress) {
    const scale = prefs.reducedMotion ? 0.82 : 0.45 + 0.55 * value;
    disc.style.setProperty('--s', scale.toFixed(4));
    disc.style.setProperty('--g', glow.toFixed(3));
    ringProgress.style.setProperty('--progress', (100 - progress * 100).toFixed(2));
  }

  function tick(now) {
    if (!running || paused) return;
    const t = (now - startedAt) / 1000;
    const all = total();
    if (t >= all) { finish(false); return; }
    const len = cycleLength();
    const cycle = Math.floor(t / len);
    let within = t - cycle * len;
    let name = ''; let kind = ''; let secs = 0; let p = 0;
    for (const [phaseName, phaseSecs, phaseKind] of PATTERNS[pattern].phases) {
      if (within < phaseSecs) { name = phaseName; kind = phaseKind; secs = phaseSecs; p = within / phaseSecs; break; }
      within -= phaseSecs;
    }
    let value = 0; let glow = 0;
    if (kind === 'in') { value = ease(p); glow = 0.5 * p; }
    else if (kind === 'hold-in') { value = 1 + 0.02 * Math.sin(3 * Math.PI * p); glow = 0.5 + 0.15 * Math.sin(3 * Math.PI * p); }
    else if (kind === 'out') { value = 1 - ease(p); glow = 0.5 * (1 - p); }
    paint(value, glow, t / all);
    secsEl.textContent = String(Math.max(1, Math.ceil(secs * (1 - p))));
    const key = `${cycle}:${name}`;
    if (key !== lastPhase) {
      lastPhase = key;
      phaseEl.textContent = name;
      countEl.textContent = `круг ${cycle + 1} из ${cycles()}`;
      live.textContent = `${name}, ${secs} ${plural(secs, 'секунда', 'секунды', 'секунд')}`;
      if (sound && kind === 'in') glide(196, 247, secs);
      if (sound && kind === 'out') glide(247, 196, secs);
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (sound) ensureAudio();
    running = true; paused = false; lastPhase = '';
    startedAt = performance.now();
    settings.hidden = true;
    stopBtn.hidden = false;
    startBtn.replaceChildren(icon('pause'), h('span', {}, 'Пауза'));
    api.setProgress('Дышим');
    keepAwake('breath', true);
    frame = requestAnimationFrame(tick);
  }

  function togglePause() {
    if (!running) return;
    if (!paused) {
      paused = true; pausedAt = performance.now(); cancelAnimationFrame(frame);
      phaseEl.textContent = 'Пауза';
      startBtn.replaceChildren(icon('play'), h('span', {}, 'Продолжить'));
    } else {
      paused = false; startedAt += performance.now() - pausedAt; lastPhase = '';
      startBtn.replaceChildren(icon('pause'), h('span', {}, 'Пауза'));
      frame = requestAnimationFrame(tick);
    }
  }

  function stop() {
    running = false; paused = false;
    cancelAnimationFrame(frame);
    keepAwake('breath', false);
    settings.hidden = false;
    stopBtn.hidden = true;
    startBtn.replaceChildren(icon('play'), h('span', {}, 'Начать'));
    api.setProgress('');
  }

  function finish(early) {
    stop();
    api.done({
      phrase: early ? 'Хорошо, остановились. Даже пара кругов дыхания — уже забота о себе.' : undefined,
      again: () => { api.show(view); resetView(); },
    });
  }

  const onVisibility = () => { if (document.hidden && running && !paused) togglePause(); };
  document.addEventListener('visibilitychange', onVisibility);

  const view = h('div', { class: 'breath' },
    h('p', { class: 'p-lead' }, 'Круг дышит — вы следуете за ним. Плечи расслаблены, никуда не торопимся.'),
    settings, stage, countEl, live,
    h('div', { class: 'breath__controls' }, startBtn, stopBtn),
    soundBtn, noteEl,
  );
  api.show(view);
  resetView();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

function plural(n, one, few, many) {
  const mod10 = n % 10; const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
