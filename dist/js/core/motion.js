// One-shot reveals, split headings, the drifting window light and the header state.
// Content is always visible by default: motion classes are added only by JS, and
// never when the visitor prefers less motion.
import { $, $$ } from './dom.js';
import { prefs } from './prefs.js';

/** Wrap each word of a heading in spans so lines can rise one after another. */
export function splitWords(el) {
  if (!el || el.dataset.split) return;
  el.dataset.split = 'true';
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); return; }
          const word = document.createElement('span');
          word.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'w__i';
          inner.textContent = part;
          word.append(inner);
          frag.append(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && !['BR', 'SVG'].includes(child.nodeName.toUpperCase())) {
        walk(child);
      }
    });
  };
  walk(el);
  $$('.w__i', el).forEach((inner, index) => inner.style.setProperty('--i', index));
}

export function initReveals() {
  const targets = $$('[data-reveal]');
  if (prefs.reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  $$('[data-reveal="words"]').forEach(splitWords);
  document.documentElement.classList.add('reveals-on');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
  // Safety net: never leave content hidden (e.g. printing, anchor jumps).
  window.addEventListener('beforeprint', () => targets.forEach((el) => el.classList.add('is-in')));
}

export function initHeader() {
  const header = $('.site-header');
  if (!header) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    document.documentElement.style.setProperty('--scroll', String(Math.min(1, window.scrollY / 1600)));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/** Bottom dock and header nav: highlight the section in view. */
export function initSectionSpy() {
  const links = $$('[data-spy]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map();
  links.forEach((link) => {
    const id = link.getAttribute('href')?.replace('#', '');
    if (!id) return;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(link);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.removeAttribute('aria-current'));
      (byId.get(entry.target.id) || []).forEach((link) => link.setAttribute('aria-current', 'true'));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const section = document.getElementById(id); if (section) io.observe(section); });
}

/** Hide the phone dock while the on-screen keyboard is open. */
export function initKeyboardAwareDock() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => document.documentElement.classList.toggle('keyboard-open', vv.height < window.innerHeight * 0.75);
  vv.addEventListener('resize', update);
}
