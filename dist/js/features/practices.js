// The practices block: filter on the page and one «room» (full-screen sheet) that
// hosts any practice. Each practice lives in js/practices/<id>.js and exports
// { title, render(body, api) → cleanup, dark?, quiet? }.
import { $, $$, h, icon, announce, focusQuietly } from '../core/dom.js';
import { registerAction, runAction } from '../core/actions.js';
import { openSheet, closeSheet, isOpen } from '../core/sheets.js';
import { prefs } from '../core/prefs.js';
import { pick } from '../core/phrases.js';
import { celebrate } from '../core/celebrate.js';
import { PRACTICE_DONE } from '../content/voice.js';

const IDS = ['breath', 'grounding', 'thought', 'feelings', 'envelope', 'noise', 'words', 'request', 'traps', 'deck', 'flashback', 'stop'];
const RANDOM = ['breath', 'grounding', 'feelings', 'deck'];
const TOPICS = {
  breath: 'тревога', grounding: 'тревога', thought: 'мысли, которые не отпускают', feelings: 'усталость и выгорание',
  envelope: 'мысли по кругу перед сном', noise: 'сон и усталость', words: 'разговоры с близкими', request: 'как просить о помощи',
  traps: 'мысли, которые не отпускают', deck: '', flashback: 'утрата', stop: 'как разделить нагрузку, когда сил совсем мало',
};

const sheet = () => $('#sheet-room');
let current = null; // { id, cleanup }
let lastOpener = null;

function cleanupCurrent() {
  if (!current) return;
  try { current.cleanup?.(); } catch (error) { console.error(error); }
  current = null;
}

function makeApi(id, mod, body) {
  const progress = $('[data-room-progress]');
  const quiet = () => Boolean(mod.quiet) || prefs.quiet;
  return {
    body,
    get quiet() { return quiet(); },
    setProgress(text) { if (progress) progress.textContent = text || ''; },
    /** Swap the room content (one step at a time) and move focus to its start. */
    show(...nodes) {
      body.replaceChildren(...nodes.flat().filter(Boolean));
      body.firstElementChild?.classList.add('p-step-enter');
      const target = $('[data-autofocus]', body) || $('#room-title');
      requestAnimationFrame(() => focusQuietly(target));
      const scroller = $('.room', sheet());
      if (scroller) scroller.scrollTop = 0;
    },
    open: (other) => openPractice(other),
    /** The soft bridge to a real conversation (quieter wording in quiet mode). */
    cta(title, text) {
      const write = () => this.write();
      if (quiet()) {
        return h('div', { class: 'p-cta' },
          h('p', { class: 'p-cta__title' }, 'Если захочется поговорить с живым человеком'),
          h('p', {}, 'Напишите мне — отвечу лично, когда буду на связи. Можно в своём темпе, без готовых слов.'),
          h('button', { class: 'btn btn--light btn--small', type: 'button', onclick: write }, 'Написать Ирине'));
      }
      return h('div', { class: 'p-cta' },
        h('p', { class: 'p-cta__title' }, title || 'Практика помогает в моменте.'),
        h('p', {}, text || 'На консультации мы разберёмся, откуда берётся то, что сейчас тяжело, и найдём, что помогает именно вам.'),
        h('button', { class: 'btn btn--light btn--small', type: 'button', onclick: write }, 'Записаться к Ирине', icon('arrow', 'icon-arrow')));
    },
    write: (topic) => runAction('write', { topic: topic ?? TOPICS[id] }),
    /** Common finish: a phrase without pressure, «ещё раз», and the bridge to a real conversation. */
    done({ phrase, again, extra } = {}) {
      this.setProgress('Готово');
      const text = phrase || pick(PRACTICE_DONE, 'practice_done');
      const phraseNode = h('p', { class: 'p-done__phrase', 'data-autofocus': '', tabindex: '-1' }, text);
      const doneBlock = h('div', { class: 'p-done' },
        phraseNode,
        extra || null,
        h('div', { class: 'p-row' },
          again ? h('button', { class: 'btn btn--primary btn--small', type: 'button', onclick: again }, 'Ещё раз') : null,
          h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => closeRoom() }, 'Другая практика'),
        ),
      );
      const cta = this.cta();
      this.show(doneBlock, cta);
      announce(text);
      if (!quiet()) setTimeout(() => celebrate('sprout', phraseNode), 250);
    },
  };
}

async function openPractice(id, opener = null) {
  if (id === 'random') id = RANDOM[Math.floor(Math.random() * RANDOM.length)];
  if (!IDS.includes(id)) return;
  let mod;
  try { mod = await import(`../practices/${id}.js`); } catch (error) { console.error(error); return; }
  cleanupCurrent();
  const dialog = sheet();
  const body = $('[data-room-body]', dialog);
  const title = $('[data-room-title]', dialog);
  title.textContent = mod.title;
  body.replaceChildren();
  dialog.classList.toggle('is-dark', Boolean(mod.dark));
  dialog.dataset.practice = id;
  $('[data-room-progress]', dialog).textContent = '';
  if (mod.quiet) prefs.enterQuiet(id);
  if (!isOpen(dialog)) {
    openSheet(dialog, { opener: opener || lastOpener || document.activeElement, focus: '[data-room-title]' });
  } else {
    requestAnimationFrame(() => focusQuietly(title));
  }
  const api = makeApi(id, mod, body);
  current = { id, cleanup: null };
  try { current.cleanup = mod.render(body, api) || null; } catch (error) { console.error(error); }
  const scroller = $('.room', dialog);
  if (scroller) scroller.scrollTop = 0;
}

function closeRoom() {
  closeSheet('sheet-room');
}

function initFilter() {
  const box = $('[data-practice-filter]');
  if (!box) return;
  const cards = $$('[data-practice-card]');
  const alert = $('[data-practice-alert]');
  const status = $('[data-filter-status]');
  box.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    $$('[data-filter]', box).forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
    const filter = chip.dataset.filter;
    let shown = 0;
    cards.forEach((card) => {
      const match = filter === 'all' || card.dataset.tags.split(' ').includes(filter);
      card.hidden = !match;
      if (match) shown += 1;
    });
    // «Очень тяжело»: the emergency stop goes first and the numbers are visible.
    const grid = $('[data-practice-grid]');
    const stop = $('[data-practice-card="stop"]');
    if (filter === 'hard') { grid.prepend(stop); prefs.enterQuiet('hard'); } else grid.append(stop);
    if (alert) alert.hidden = filter !== 'hard';
    if (status) status.textContent = filter === 'all' ? 'Показаны все практики' : `Подходящих практик: ${shown}`;
  });
}

export function init() {
  registerAction('practice', (el, detail = {}) => {
    lastOpener = el || null;
    openPractice(detail.practice, el);
  });
  $('[data-room-back]')?.addEventListener('click', closeRoom);
  document.addEventListener('sheet:close', (event) => {
    // The close event is queued: if a practice was reopened meanwhile, keep it.
    if (event.detail.id !== 'sheet-room' || sheet().open) return;
    cleanupCurrent();
    const dialog = sheet();
    dialog.classList.remove('is-dark');
    $('[data-room-body]', dialog).replaceChildren();
  });
  initFilter();
}
