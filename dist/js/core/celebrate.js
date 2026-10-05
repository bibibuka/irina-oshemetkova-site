// The only celebration on the site: a sprout that draws itself, or a few petals.
// Never in quiet mode (loss stage, help shown, «тяжело», crisis words), never with
// reduced motion, and not more often than once every ten minutes.
import { prefs } from './prefs.js';

let last = 0;
const COOLDOWN = 10 * 60 * 1000;

export function canCelebrate() {
  return !prefs.quiet && !prefs.reducedMotion && Date.now() - last > COOLDOWN;
}

const SPROUT = '<svg viewBox="0 0 64 64" aria-hidden="true"><path pathLength="1" d="M32 58V30"/><path pathLength="1" d="M32 40C18 41 14 32 14 24c12 0 18 5 18 16Z"/><path pathLength="1" d="M32 34c-1-13 8-18 18-18 0 11-6 19-18 18Z"/></svg>';
const PETAL = '<svg viewBox="0 0 20 28" aria-hidden="true"><path d="M10 1C3 9 3 19 10 27c7-8 7-18 0-26Z"/></svg>';

function host(anchor) {
  const layer = document.createElement('div');
  layer.className = 'celebration';
  const rect = anchor?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  layer.style.left = `${rect.left + rect.width / 2}px`;
  layer.style.top = `${rect.top + rect.height / 2}px`;
  document.body.append(layer);
  return layer;
}

/** celebrate('sprout' | 'petals', anchorElement). Returns true if shown. */
export function celebrate(kind = 'sprout', anchor = null) {
  if (!canCelebrate()) return false;
  last = Date.now();
  const layer = host(anchor);
  if (kind === 'petals') {
    for (let i = 0; i < 6; i += 1) {
      const petal = document.createElement('span');
      petal.className = 'celebration__petal';
      petal.innerHTML = PETAL;
      petal.style.setProperty('--dx', `${(i - 2.5) * 34 + (Math.random() * 20 - 10)}px`);
      petal.style.setProperty('--rot', `${Math.random() * 200 - 100}deg`);
      petal.style.setProperty('--delay', `${i * 70}ms`);
      layer.append(petal);
    }
  } else {
    const sprout = document.createElement('span');
    sprout.className = 'celebration__sprout';
    sprout.innerHTML = SPROUT;
    layer.append(sprout);
  }
  setTimeout(() => layer.remove(), 2600);
  return true;
}
