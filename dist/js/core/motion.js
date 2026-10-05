// Motion: one-shot reveals, split headings, the window light, the header (glass,
// reading progress, nav pill), soft ripples and calm long jumps.
// Content is always visible by default: hidden states exist only after JS adds
// html.reveals-on, an observed element is never clipped itself (IntersectionObserver
// must be able to see it), and a sweep shows anything the observer may have missed.
import { $, $$ } from './dom.js';
import { prefs } from './prefs.js';

const root = document.documentElement;

/** Wrap each word of a heading in spans so lines can rise one after another. */
export function splitWords(el) {
  if (!el || el.dataset.split === 'true') return;
  el.dataset.split = 'true';
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        // Split on ordinary spaces only: a no-break space keeps «с\u00a0разговора» on one line.
        const parts = child.textContent.split(/([ \t\n\r\f]+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^[ \t\n\r\f]+$/.test(part)) { frag.append(document.createTextNode(part)); return; }
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

/* ---------- Reveals ---------- */
// Headings rise word by word; blocks rise; the items of a group arrive one after another.
const HEADINGS = 'main h2, .traps__title, .principles__title, .docs__title, .svet__head h2';
const BLOCKS = [
  '.section .lead', '.pogoda__sub', '.traps__sub', '.docs__sub', '.notebook', '.trap-game', '.book', '.deck__moods', '.deck__stack', '.deck__controls',
  '.letter', '.phone', '.karman__honest', '.karman__actions', '.irina__text > p', '.calm-card', '.facts',
  '.vstrecha__about > .note', '.breath', '.breath-settings', '.dyhanie__lead', '.dyhanie__side',
  '.next-line', '.svet__head > p', '.svet__head > .btn',
].join(', ');
const PHOTOS = '.irina__arch, .opory__arch, .voprosy__arch';
// [container, items, grid] — in a grid the wave runs diagonally, row by row.
const GROUPS = [
  ['.weather', '.weather__tile'], ['.doors__row', '.door'], ['.shelf__track', '.shelf-item'],
  ['.traps__fan', '.trap', true], ['.principles', ':scope > *', true], ['.docs', ':scope > li'],
  ['.first-steps', ':scope > li'], ['.faq', ':scope > details'], ['.svet__cols', ':scope > *'], ['.karman__features', ':scope > li', true],
];

function columnsOf(box) {
  const style = getComputedStyle(box);
  if (style.display !== 'grid') return 0;
  return style.gridTemplateColumns.split(' ').filter(Boolean).length;
}
const SKIP = '.okno, dialog, .dock, [data-reveal="none"]';

let observer = null;
const pending = new Set();

function show(el, { instant = false } = {}) {
  if (instant) el.classList.add('is-shown');
  el.classList.add('is-in');
  pending.delete(el);
  observer?.unobserve(el);
}

function inView(el, limit = window.innerHeight) {
  const rect = el.getBoundingClientRect();
  return (rect.width || rect.height) && rect.top < limit;
}

/** Show everything that is in view or already scrolled past: nothing may stay hidden. */
export function sweepReveals({ instant = false } = {}) {
  const limit = window.innerHeight * 0.96;
  pending.forEach((el) => { if (inView(el, limit)) show(el, { instant }); });
}

function watch(el, type, stagger, firstPass) {
  if (el.dataset.revealDone || el.closest(SKIP)) return;
  el.dataset.revealDone = 'true';
  if (type) el.dataset.reveal = type;
  if (stagger) el.style.setProperty('--stagger', String(stagger));
  if (el.dataset.reveal === 'words' || el.dataset.reveal === 'light') {
    el.dataset.reveal = 'words';
    splitWords(el);
  }
  // Already on screen at the very first paint: stay put, the first screen has its own intro.
  if (firstPass && inView(el)) { show(el, { instant: true }); return; }
  pending.add(el);
  observer?.observe(el);
}

function tagAll(firstPass = false) {
  $$('[data-reveal]').forEach((el) => watch(el, null, 0, firstPass));
  $$(HEADINGS).forEach((el) => watch(el, 'words', 0, firstPass));
  $$(PHOTOS).forEach((el) => watch(el, 'photo', 0, firstPass));
  $$(BLOCKS).forEach((el) => {
    // After a heading in the same column, a block waits for the words to rise.
    const heading = el.parentElement && $(':scope > h2, :scope > h3', el.parentElement);
    const after = heading && heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
    watch(el, 'rise', after ? 2 : 0, firstPass);
  });
  GROUPS.forEach(([container, item, grid]) => {
    $$(container).forEach((box) => {
      const columns = grid ? columnsOf(box) : 0;
      $$(item, box).forEach((el, index) => {
        const wave = columns ? (index % columns) + Math.floor(index / columns) : index;
        watch(el, 'rise', Math.min(wave, 7), firstPass);
      });
    });
  });
}

export function initReveals() {
  if (!('IntersectionObserver' in window)) {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    return;
  }
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) show(entry.target); });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  root.classList.add('reveals-on');
  tagAll(true);
  // Late content (features render after boot) joins in; a sweep backs the observer up.
  document.addEventListener('features:ready', () => { tagAll(); sweepReveals(); });
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(sweepReveals, 140); };
  window.addEventListener('scroll', later, { passive: true });
  window.addEventListener('resize', later);
  window.addEventListener('load', () => setTimeout(sweepReveals, 600));
  window.addEventListener('beforeprint', () => pending.forEach((el) => show(el, { instant: true })));
}

/* ---------- Header: glass on scroll, reading progress, the window light, hero depth ---------- */
export function initHeader() {
  const header = $('.site-header');
  if (!header) return;
  const light = $('.daylight');
  const progress = $('.site-progress');
  const hero = $('.okno__window');
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    // Variables live on the elements that use them: a change on <html> would restyle the whole page.
    light?.style.setProperty('--scroll', String(Math.min(1, y / 1600)));
    if (progress) {
      const max = root.scrollHeight - window.innerHeight;
      progress.style.setProperty('--progress', String(max > 0 ? Math.min(1, y / max) : 0));
    }
    if (hero && y < window.innerHeight * 1.4) hero.style.setProperty('--sy', String(Math.round(y)));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
  // Over a dark band the glass turns dark too, so the bar never looks like a pale patch.
  const dark = $$('.band, .svet');
  if (!dark.length || !('IntersectionObserver' in window)) return;
  const under = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) under.add(entry.target); else under.delete(entry.target); });
    header.classList.toggle('is-on-dark', under.size > 0);
  }, { rootMargin: '0px 0px -93% 0px' });
  dark.forEach((section) => io.observe(section));
}

/** Bottom dock and header nav: highlight the section in view. */
export function initSectionSpy() {
  const links = $$('[data-spy]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  const ids = new Set(links.map((link) => link.getAttribute('href')?.replace('#', '')).filter(Boolean));
  // Only the section crossing the middle of the screen is current; between them, nothing is.
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
    const id = [...visible].pop() || null;
    links.forEach((link) => {
      if (id && link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    document.dispatchEvent(new CustomEvent('spy:change', { detail: { id } }));
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach((id) => { const section = document.getElementById(id); if (section) io.observe(section); });
}

/** A soft pill slides under the nav link you point at and rests on the section in view. */
export function initNavPill() {
  const nav = $('.site-nav');
  if (!nav) return;
  const pill = document.createElement('span');
  pill.className = 'site-nav__pill';
  pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);
  const links = $$('a', nav);
  let hovering = null;
  const current = () => links.find((link) => link.hasAttribute('aria-current'));
  const place = (link) => {
    if (!link || !link.offsetWidth) { nav.classList.remove('has-pill'); return; }
    nav.style.setProperty('--pill-x', `${link.offsetLeft}px`);
    nav.style.setProperty('--pill-w', `${link.offsetWidth}px`);
    if (!nav.classList.contains('has-pill')) {
      nav.classList.add('has-pill');
      requestAnimationFrame(() => nav.classList.add('pill-ready'));
    }
  };
  links.forEach((link) => {
    const enter = () => { hovering = link; place(link); };
    link.addEventListener('pointerenter', enter);
    link.addEventListener('focus', enter);
    link.addEventListener('blur', () => { hovering = null; place(current()); });
  });
  nav.addEventListener('pointerleave', () => { hovering = null; place(current()); });
  document.addEventListener('spy:change', () => { if (!hovering) place(current()); });
  window.addEventListener('resize', () => place(hovering || current()));
  document.fonts?.ready.then(() => place(hovering || current()));
}

/* ---------- Soft ripples ---------- */
const RIPPLE = [
  '.btn', '.chip', '.seg button', '.weather__tile', '.stage-option',
  '.bubble-chip', '.icon-btn', '.theme-toggle', '.step', '.door__frame', '.book__toc [role="tab"]',
].join(', ');

export function initRipples() {
  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || prefs.reducedMotion) return;
    const target = event.target instanceof Element ? event.target : null;
    let host = target?.closest(RIPPLE);
    if (host?.classList.contains('door')) host = $('.door__frame', host);
    if (!host || host.disabled || host.closest('.sheet--stop, .sheet--help')) return;
    const rect = host.getBoundingClientRect();
    const size = Math.hypot(rect.width, rect.height) * 2.1;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.cssText = `left:${event.clientX - rect.left}px;top:${event.clientY - rect.top}px;width:${size}px;height:${size}px`;
    host.append(dot);
    const remove = () => dot.remove();
    dot.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 1200);
  }, { passive: true });
}

/* ---------- Calm long jumps ---------- */
const FAR = 1.6; // viewport heights: further than this, the page dissolves instead of flying

function scrollMargin(el) {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop);
  return Number.isFinite(margin) && margin > 0 ? margin : (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0);
}

function instantScroll(top) {
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, top);
  root.style.scrollBehavior = previous;
}

function afterScroll(done) {
  let finished = false;
  const finish = () => { if (finished) return; finished = true; window.removeEventListener('scrollend', finish); done(); };
  if ('onscrollend' in window) window.addEventListener('scrollend', finish, { once: true });
  setTimeout(finish, 900);
}

/** Move focus to a target without scrolling: the element itself if it can hold focus, else its heading. */
export function focusTarget(target) {
  const own = target.matches('[tabindex], a[href], button, input, select, textarea') ? target : null;
  const heading = own || (target.matches('h1, h2, h3') ? target : $('h1, h2, h3', target));
  if (!heading) return;
  if (!heading.hasAttribute('tabindex') && !own) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/**
 * jumpTo('#vstrecha') — a far jump dissolves into the place (View Transitions), a near one
 * scrolls smoothly, less motion jumps at once. `offset` overrides the scroll margin.
 */
export function jumpTo(target, { offset, onDone } = {}) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  const margin = offset ?? scrollMargin(el);
  const top = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - margin));
  const done = () => onDone?.(el);
  if (Math.abs(top - window.scrollY) < 2) { done(); return; }
  if (prefs.reducedMotion) { instantScroll(top); done(); return; }
  const far = Math.abs(top - window.scrollY) > window.innerHeight * FAR;
  if (far && document.startViewTransition && document.visibilityState === 'visible') {
    root.classList.add('vt-jump');
    const transition = document.startViewTransition(() => { instantScroll(top); sweepReveals({ instant: true }); });
    transition.finished.finally(() => { root.classList.remove('vt-jump'); done(); });
    return;
  }
  window.scrollTo({ top, behavior: 'smooth' });
  afterScroll(done);
}

export function initJumps() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link || link.hasAttribute('data-open-sheet') || link.hasAttribute('data-action')) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = id && document.getElementById(id);
    if (!target || target.closest('dialog')) return;
    event.preventDefault();
    jumpTo(target, { onDone: focusTarget });
  });
}

/** Hide the phone dock while the on-screen keyboard is open. */
export function initKeyboardAwareDock() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => root.classList.toggle('keyboard-open', vv.height < window.innerHeight * 0.75);
  vv.addEventListener('resize', update);
}
