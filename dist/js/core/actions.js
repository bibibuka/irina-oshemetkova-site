// Features talk to each other through named actions, never through imports.
// Markup: <button data-action="practice" data-practice="grounding">…</button>
// Code:   registerAction('practice', (el, detail) => …); runAction('practice', { practice: 'grounding' });
import { on } from './dom.js';

const handlers = new Map();
const queued = [];

export function registerAction(name, handler) {
  handlers.set(name, handler);
  for (let i = queued.length - 1; i >= 0; i -= 1) {
    if (queued[i].name === name) { const { el, detail } = queued.splice(i, 1)[0]; handler(el, detail); }
  }
}

/** Runs now if registered, otherwise once the feature registers (lazy-loaded features). */
export function runAction(name, detail = {}, el = null) {
  const handler = handlers.get(name);
  if (handler) return handler(el, detail);
  queued.push({ name, el, detail });
  return undefined;
}

export function hasAction(name) { return handlers.has(name); }

export function initActions() {
  on(document, 'click', '[data-action]', (event, el) => {
    event.preventDefault();
    runAction(el.dataset.action, { ...el.dataset }, el);
  });
}

/** Smoothly bring a section into view and move focus to its heading. */
export function goTo(selector, { focus = true } = {}) {
  const target = document.querySelector(selector);
  if (!target) return;
  const reduced = document.documentElement.classList.contains('motion-reduced');
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (focus) {
    const heading = target.matches('h1, h2, h3') ? target : target.querySelector('h2, h3');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      setTimeout(() => heading.focus({ preventScroll: true }), reduced ? 0 : 500);
    }
  }
}
