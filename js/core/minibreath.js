// A small 3–6 breathing guide (inhale 3 s, exhale 6 s) for the emergency stop and
// the «очень тяжело» answer. Text always counts; the circle moves only when motion is welcome.
import { prefs } from './prefs.js';

/**
 * startMiniBreath(root) — root contains `.mini-breath__circle` and `[data-mini-text]`.
 * Returns stop(). Stops by itself when root leaves the document.
 */
export function startMiniBreath(root) {
  const circle = root.querySelector('.mini-breath__circle');
  const text = root.querySelector('[data-mini-text]');
  let second = 0;
  let timer = 0;
  root.classList.toggle('is-static', prefs.reducedMotion);
  // A per-second countdown is too chatty for screen readers: describe the rhythm once instead.
  text?.setAttribute('aria-live', 'off');
  text?.setAttribute('aria-hidden', 'true');
  if (!root.querySelector('.mini-breath__sr')) {
    const sr = document.createElement('p');
    sr.className = 'visually-hidden mini-breath__sr';
    sr.textContent = 'Вдох на 3 счёта, медленный выдох на 6. Круг считает за тебя.';
    root.append(sr);
  }
  const tick = () => {
    if (!root.isConnected) { clearInterval(timer); return; }
    const t = second % 9;
    const inhale = t < 3;
    const left = inhale ? 3 - t : 9 - t;
    if (text) text.textContent = `${inhale ? 'Вдох' : 'Выдох'}… ${left}`;
    if (circle && t === 0) { circle.classList.remove('is-out'); circle.classList.add('is-in'); }
    if (circle && t === 3) { circle.classList.remove('is-in'); circle.classList.add('is-out'); }
    second += 1;
  };
  tick();
  timer = setInterval(tick, 1000);
  return () => { clearInterval(timer); circle?.classList.remove('is-in', 'is-out'); };
}
