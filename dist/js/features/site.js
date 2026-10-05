// Page-level behaviour: greeting, theme, phone bar, menu, stage tabs, documents, help sheet.
import { $, $$, on, announce } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { partOfDay } from '../core/time.js';
import { pick } from '../core/phrases.js';
import { openSheet, closeSheet } from '../core/sheets.js';
import { goTo } from '../core/actions.js';
import { copyText, shareText } from '../core/share.js';
import { GREETINGS, CALM } from '../content/voice.js';

function initGreeting() {
  const node = $('[data-greeting]');
  const update = () => { if (node) node.textContent = GREETINGS[partOfDay()][0]; };
  update();
  document.addEventListener('prefs:apply', update);
}

function initTheme() {
  const button = $('[data-theme-toggle]');
  if (!button) return;
  const sync = () => {
    const night = prefs.isNight;
    button.setAttribute('aria-pressed', String(night));
    button.setAttribute('aria-label', night ? 'Включить дневную тему' : 'Включить ночную тему');
    button.title = night ? 'Дневная тема' : 'Ночная тема';
  };
  button.addEventListener('click', () => {
    prefs.setTheme(prefs.isNight ? 'day' : 'night');
    sync();
    announce(prefs.isNight ? 'Ночная тема включена' : 'Дневная тема включена');
  });
  document.addEventListener('prefs:apply', sync);
  sync();
}

/** The phone booking bar appears once the hero is gone and hides over the booking form. */
function initPhoneBar() {
  const bar = $('[data-mbar]');
  if (!bar || !('IntersectionObserver' in window)) { bar?.classList.add('is-visible'); return; }
  const seen = { hero: true, booking: false };
  const update = () => bar.classList.toggle('is-visible', !seen.hero && !seen.booking);
  const watch = (selector, key) => {
    const target = $(selector);
    if (!target) return;
    new IntersectionObserver(([entry]) => { seen[key] = entry.isIntersecting; update(); }, { rootMargin: key === 'hero' ? '-30% 0px 0px 0px' : '0px 0px -40% 0px' }).observe(target);
  };
  watch('#top', 'hero');
  watch('#zapis', 'booking');
}

function initMenu() {
  on(document, 'click', '[data-close-nav]', (event, link) => {
    event.preventDefault();
    closeSheet('sheet-menu');
    const target = link.getAttribute('href');
    setTimeout(() => goTo(target), 80);
  });
}

/** «С чем я помогаю»: an accessible tablist. */
function initDoors() {
  const root = $('[data-doors]');
  if (!root) return;
  const tabs = $$('[role="tab"]', root);
  const select = (tab, { focus = false, scroll = true } = {}) => {
    tabs.forEach((other) => {
      const active = other === tab;
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(other.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) tab.focus();
    if (scroll) tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefs.reducedMotion ? 'auto' : 'smooth' });
    if (tab.dataset.door === 'loss') prefs.enterQuiet('loss');
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], { focus: true });
    });
  });
  // Without JS every panel stays visible; with JS only the selected one.
  select(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0], { scroll: false });
  root.dataset.ready = 'true';
}

/** Education documents in a lightbox. */
function initDocs() {
  const docs = $$('.doc[data-doc]');
  const img = $('[data-lightbox-img]');
  const caption = $('[data-lightbox-caption]');
  const count = $('[data-lightbox-count]');
  if (!docs.length || !img) return;
  let index = 0;
  const show = (i) => {
    index = (i + docs.length) % docs.length;
    const source = $('img', docs[index]);
    img.src = source.currentSrc || source.src;
    img.alt = source.alt;
    caption.textContent = docs[index].dataset.caption || source.alt;
    count.textContent = `${index + 1} из ${docs.length}`;
  };
  docs.forEach((doc, i) => doc.addEventListener('click', () => { show(i); openSheet('sheet-doc', { opener: doc, focus: '[data-lightbox-caption]' }); }));
  $('[data-lightbox-prev]')?.addEventListener('click', () => show(index - 1));
  $('[data-lightbox-next]')?.addEventListener('click', () => show(index + 1));
  $('#sheet-doc')?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });
}

function textOf(selector) { return $(selector)?.textContent.trim() || ''; }

function initHelp() {
  const status = $('[data-help-status]');
  const say = (message) => { if (status) status.textContent = message; announce(message); };
  document.addEventListener('sheet:open', (event) => { if (event.detail.id === 'sheet-help') prefs.enterQuiet('help'); });
  on(document, 'click', '[data-copy-number]', async (event, button) => {
    const ok = await copyText(button.dataset.copyNumber);
    say(ok ? `Номер ${button.dataset.copyNumber} скопирован.` : `Номер: ${button.dataset.copyNumber}`);
  });
  on(document, 'click', '[data-copy-text]', async (event, button) => {
    const source = $(button.dataset.copyText);
    const ok = await copyText(textOf(button.dataset.copyText), source);
    say(ok ? 'Текст скопирован. Его можно вставить в сообщение.' : 'Текст выделен — скопируйте его вручную.');
  });
  on(document, 'click', '[data-share-text]', async (event, button) => {
    const text = textOf(button.dataset.shareText);
    const result = await shareText({ text });
    if (result === 'unsupported') {
      const ok = await copyText(text, $(button.dataset.shareText));
      say(ok ? 'Текст скопирован. Вставьте его в мессенджер.' : 'Текст выделен — скопируйте его вручную.');
    }
  });
}

function initCalm() {
  const text = $('[data-calm-text]');
  $('[data-calm-next]')?.addEventListener('click', () => {
    if (!text) return;
    const current = text.textContent.trim();
    text.textContent = pick(CALM.filter((line) => line !== current), 'calm');
  });
}

export function init() {
  initGreeting();
  initTheme();
  initPhoneBar();
  initMenu();
  initDoors();
  initDocs();
  initHelp();
  initCalm();
  $$('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
}
