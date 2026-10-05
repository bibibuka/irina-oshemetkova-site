// Features talk to each other through named actions, never through imports.
// Markup: <button data-action="practice" data-practice="grounding">…</button>
// Code:   registerAction('practice', (el, detail) => …); runAction('practice', { practice: 'grounding' });
import { on } from './dom.js';
import { jumpTo, focusTarget } from './motion.js';

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

/** Bring a section into view (a calm dissolve when it is far) and move focus to its heading. */
export function goTo(selector, { focus = true, onDone } = {}) {
  const target = document.querySelector(selector);
  if (!target) return;
  jumpTo(target, {
    onDone: () => {
      if (focus) focusTarget(target);
      onDone?.(target);
    },
  });
}
