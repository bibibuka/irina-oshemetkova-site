// «Что сказать, когда…» — tabs by addressee, every phrase can be copied, shared or
// reworked; some have a «мягче / твёрже» pair. A guest menu card, the «Как мне помочь»
// memo and a request builder (fact → feeling → need → one request). Nothing is sent
// unless the visitor taps «Отправить».
import { $, $$, h, icon, announce, uid } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { copyText, shareText, canShareText, renderCard, fileFromBlob, shareOrDownload, plain } from '../core/share.js';
import { watchField } from '../core/safety.js';
import { DEFAULT_TAB, BUILDER, buildRequest, GUESTS, MEMO_TITLE } from '../content/words.js';

let tabs = [];
let touched = false;
let builder = null;

/* ---------- Shared actions ---------- */
async function copy(text, button, node) {
  const ok = await copyText(text, node);
  flash(button, ok ? 'Скопировано' : 'Выделено — скопируй вручную');
  announce(ok ? 'Текст скопирован.' : 'Текст выделен — его можно скопировать вручную.');
}
async function send(text) {
  if (canShareText()) {
    const result = await shareText({ text });
    if (result !== 'unsupported') return;
  }
  window.open(`https://t.me/share/url?url=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}
function flash(button, label) {
  const span = $('span', button);
  if (!span) return;
  const original = span.dataset.label || span.textContent;
  span.dataset.label = original;
  span.textContent = label;
  clearTimeout(button._flash);
  button._flash = setTimeout(() => { span.textContent = original; }, 2200);
}
const actionButton = (iconName, label, onclick) => h('button', { type: 'button', class: 'icon-btn', onclick }, icon(iconName), h('span', {}, label));

/* ---------- Tabs ---------- */
function visibleTabs() { return tabs.filter((tab) => getComputedStyle(tab).display !== 'none'); }

function selectTab(key, { focus = false } = {}) {
  const tab = tabs.find((item) => item.dataset.wordsTab === key && getComputedStyle(item).display !== 'none') || visibleTabs()[0];
  if (!tab) return;
  const changed = tab.getAttribute('aria-selected') !== 'true';
  tabs.forEach((other) => {
    const on = other === tab;
    other.setAttribute('aria-selected', String(on));
    other.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(other.getAttribute('aria-controls'));
    if (!panel) return;
    panel.hidden = !on;
    // A new page of the book: its phrases arrive one after another.
    if (on && changed) { panel.classList.remove('appear-kids'); void panel.offsetWidth; panel.classList.add('appear-kids'); }
  });
  if (focus) tab.focus();
}

/** Switched from deep inside a long page to a short one (the contents stick on wide screens):
 *  bring the start of the new page back under the practices tab bar. */
function bringPageIntoView() {
  const tab = tabs.find((item) => item.getAttribute('aria-selected') === 'true');
  const page = tab && document.getElementById(tab.getAttribute('aria-controls'));
  if (!page) return;
  const bar = ($('.praktiki__nav') || $('.site-header'))?.getBoundingClientRect().bottom || 0;
  const top = page.getBoundingClientRect().top;
  if (top < bar) window.scrollTo({ top: top + window.scrollY - bar - 16, behavior: prefs.reducedMotion ? 'auto' : 'smooth' });
}

function initTabs() {
  const list = $('[data-words-tabs]');
  if (!list) return;
  tabs = $$('[role="tab"]', list);
  tabs.forEach((tab) => tab.addEventListener('click', () => { touched = true; selectTab(tab.dataset.wordsTab); bringPageIntoView(); }));
  list.addEventListener('keydown', (event) => {
    const shown = visibleTabs();
    const index = shown.indexOf(document.activeElement);
    if (index < 0) return;
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (event.key in moves) next = (index + moves[event.key] + shown.length) % shown.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = shown.length - 1;
    if (next == null) return;
    event.preventDefault();
    touched = true;
    selectTab(shown[next].dataset.wordsTab, { focus: true });
    bringPageIntoView();
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-words-open]');
    if (link?.dataset.wordsOpen) { touched = true; selectTab(link.dataset.wordsOpen); }
  });
  const byStage = () => { if (!touched) selectTab(DEFAULT_TAB[prefs.stage] || 'partner'); };
  byStage();
  document.addEventListener('stage:change', () => {
    const current = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    if (!touched || (current && getComputedStyle(current).display === 'none')) { touched = false; byStage(); }
  });
}

/* ---------- Phrases ---------- */
function enhancePhrase(quote) {
  const p = $('p', quote);
  if (!p || $('.phrase__actions', quote)) return;
  const soft = p.textContent.trim();
  const firm = quote.dataset.firm;
  const text = () => plain(p.textContent.trim());
  const bar = h('div', { class: 'phrase__actions' },
    actionButton('copy', 'Скопировать', (event) => copy(text(), event.currentTarget, p)),
    actionButton('share', 'Отправить', () => send(text())),
    actionButton('pencil', 'Переделать под себя', () => rework(text())));
  if (firm) {
    const seg = h('div', { class: 'seg seg--tiny', role: 'group', aria: { label: 'Тон фразы' } },
      ['мягче', 'твёрже'].map((label, index) => h('button', {
        type: 'button', aria: { pressed: String(index === 0) },
        onclick: (event) => {
          p.textContent = index === 0 ? soft : firm;
          $$('button', event.currentTarget.parentElement).forEach((b) => b.setAttribute('aria-pressed', String(b === event.currentTarget)));
        },
      }, label)));
    bar.prepend(seg);
  }
  quote.append(bar);
}

/* ---------- Guest menu ---------- */
function initGuests() {
  const box = $('[data-guest-menu]');
  if (!box) return;
  const chosen = new Set(GUESTS.items.slice(0, 3));
  const own = h('input', { class: 'input input--line', maxlength: '80', placeholder: GUESTS.own, aria: { label: 'Своё' } });
  let file = null;
  let timer = 0;
  const lines = () => [...chosen, own.value.trim()].filter(Boolean);
  const asText = () => `${GUESTS.title}:\n${lines().map((line) => `— ${line}`).join('\n')}`;
  const save = actionButton('image', 'Сохранить открытку', () => { if (file) shareOrDownload(file, GUESTS.title); });
  const prepare = () => {
    clearTimeout(timer);
    save.disabled = true;
    timer = setTimeout(() => {
      renderCard({ text: lines().map((line) => line[0].toUpperCase() + line.slice(1)).join(' · '), caption: 'Что сейчас помогает больше всего', theme: 'peach' })
        .then((blob) => { if (blob) { file = fileFromBlob(blob, 'menu-dlya-gostey.png'); save.disabled = false; } })
        .catch(() => { save.hidden = true; });
    }, 500);
  };
  const items = GUESTS.items.map((item) => h('button', {
    type: 'button', class: 'guest-item', aria: { pressed: String(chosen.has(item)) },
    onclick: (event) => {
      if (chosen.has(item)) chosen.delete(item); else chosen.add(item);
      event.currentTarget.setAttribute('aria-pressed', String(chosen.has(item)));
      prepare();
    },
  }, icon('check', 'guest-item__mark'), item));
  own.addEventListener('input', prepare);
  box.replaceChildren(
    h('h3', { class: 'guest-menu__title' }, GUESTS.title),
    h('p', { class: 'guest-menu__intro' }, GUESTS.intro),
    h('div', { class: 'guest-menu__items', role: 'group', aria: { label: 'Что помогает' } }, items, own),
    h('div', { class: 'phrase__actions' },
      actionButton('copy', 'Скопировать текстом', (event) => copy(asText(), event.currentTarget)),
      actionButton('share', 'Поделиться', () => send(asText())),
      save),
  );
  prepare();
}

function initMemo() {
  const memo = $('[data-help-memo]');
  if (!memo || $('.phrase__actions', memo)) return;
  const asText = () => `${MEMO_TITLE}:\n${$$('li', memo).map((li, i) => `${i + 1}. ${li.textContent.trim()}`).join('\n')}`;
  let file = null;
  const save = actionButton('image', 'Сохранить открытку', () => { if (file) shareOrDownload(file, MEMO_TITLE); });
  save.disabled = true;
  renderCard({ text: $$('li', memo).map((li) => li.textContent.trim().replace(/\.$/, '')).join(' · '), caption: MEMO_TITLE, theme: 'day' })
    .then((blob) => { if (blob) { file = fileFromBlob(blob, 'kak-mne-pomoch.png'); save.disabled = false; } })
    .catch(() => { save.hidden = true; });
  memo.append(h('div', { class: 'phrase__actions' },
    actionButton('copy', 'Скопировать', (event) => copy(asText(), event.currentTarget)),
    actionButton('share', 'Отправить', () => send(asText())),
    save));
}

/* ---------- Request builder ---------- */
function initBuilder() {
  const box = $('[data-builder]');
  if (!box) return;
  const state = { fact: '', feeling: '', need: '', ask: '' };
  let edited = false;
  const out = h('p', { class: 'builder__result', 'aria-live': 'polite' });
  const editId = uid('edit');
  const edit = h('textarea', { class: 'textarea builder__edit', id: editId, rows: '3', maxlength: '600' });
  const fields = {};
  const update = () => {
    const sentence = buildRequest(state);
    out.textContent = sentence;
    if (!edited) edit.value = sentence;
  };
  const row = (key) => {
    const config = BUILDER[key];
    const id = uid(key);
    const input = h('input', { class: 'input input--line', id, maxlength: '160', placeholder: config.placeholder, autocomplete: 'off' });
    input.addEventListener('input', () => {
      state[key] = input.value.trim();
      if (chipsBox) $$('.chip', chipsBox).forEach((chip) => chip.setAttribute('aria-pressed', String(chip.textContent === state[key])));
      update();
    });
    fields[key] = input;
    const chipsBox = config.chips ? h('div', { class: 'chips-row' }, config.chips.map((text) => h('button', {
      type: 'button', class: 'chip chip--small', aria: { pressed: 'false' },
      onclick: () => { input.value = text; input.dispatchEvent(new Event('input')); },
    }, text))) : null;
    watchField(input, input);
    return h('div', { class: 'builder__row' }, h('label', { class: 'label', for: id }, config.label), chipsBox, input);
  };
  const presetsBox = h('p', { class: 'builder__presets' });
  const renderPresets = () => {
    const presets = BUILDER.presets.filter((preset) => {
      if (preset.label === 'После утраты') return prefs.stage === 'loss';
      if (preset.label === 'Усталость после родов') return !['loss', 'planning'].includes(prefs.stage);
      return true;
    });
    presetsBox.replaceChildren('Начать с примера: ', ...presets.map((preset) => h('button', {
      type: 'button', class: 'link', onclick: () => {
        ['fact', 'feeling', 'need', 'ask'].forEach((key) => { fields[key].value = preset[key]; fields[key].dispatchEvent(new Event('input')); });
        edited = false; update();
      },
    }, preset.label)));
  };
  edit.addEventListener('input', () => { edited = true; });
  watchField(edit, edit);
  const reset = () => {
    Object.keys(state).forEach((key) => { state[key] = ''; fields[key].value = ''; });
    $$('.chip[aria-pressed="true"]', box).forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
    edited = false;
    update();
  };
  box.replaceChildren(
    h('h3', { class: 'builder__title' }, BUILDER.title),
    h('p', { class: 'builder__lead' }, BUILDER.lead),
    presetsBox,
    h('div', { class: 'builder__rows' }, row('fact'), row('feeling'), row('need'), row('ask')),
    h('div', { class: 'builder__out' },
      out,
      h('label', { class: 'label', for: editId }, BUILDER.editLabel),
      edit,
      h('div', { class: 'phrase__actions' },
        actionButton('copy', 'Скопировать', (event) => copy(edit.value.trim(), event.currentTarget, edit)),
        actionButton('share', 'Отправить', () => send(edit.value.trim())),
        actionButton('arrow-left', 'Начать заново', reset))),
  );
  renderPresets();
  update();
  builder = { renderPresets, setText(text) { edited = true; edit.value = text; edit.focus(); edit.setSelectionRange(text.length, text.length); } };
}

function rework(text) {
  touched = true;
  selectTab('own');
  builder?.setText(text);
  document.getElementById('w-own')?.scrollIntoView({ behavior: prefs.reducedMotion ? 'auto' : 'smooth', block: 'center' });
}

export function init() {
  initTabs();
  $$('[data-phrase]').forEach(enhancePhrase);
  initGuests();
  initMemo();
  initBuilder();
  const guests = $('[data-guest-menu]');
  const showGuests = () => { if (guests) guests.hidden = ['loss', 'planning'].includes(prefs.stage); };
  showGuests();
  document.addEventListener('stage:change', () => { showGuests(); builder?.renderPresets(); });
}
