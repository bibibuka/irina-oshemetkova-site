// «Колода опор» — draw a card, it turns over; another one; keep it (memory only);
// a postcard or a lock-screen picture without names. No repeats of the last 12.
import { $, $$, h, icon, announce } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { pick } from '../core/phrases.js';
import { renderCard, fileFromBlob, shareOrDownload, copyText } from '../core/share.js';
import { MOODS, CARDS, MOOD_FROM_CHECKIN, MOOD_FROM_STAGE, LOCK_NOTE } from '../content/deck.js';

const MAX_SAVED = 30;
const state = { mood: 'all', chosen: false, phrase: '', drawn: false, files: {} };
let el = {};

function moodAllowed(mood) {
  if (mood.loud && prefs.quiet) return false;
  if (!mood.stages) return true;
  return mood.stages.includes(prefs.stage);
}

function poolFor(moodId) {
  if (moodId !== 'all') return CARDS[moodId] || [];
  const extra = ['pregnancy', 'loss'].filter((id) => prefs.stage === id);
  const skip = new Set(['pregnancy', 'loss', ...(prefs.quiet ? ['good'] : [])]);
  return [...Object.entries(CARDS).filter(([id]) => !skip.has(id)).flatMap(([, list]) => list), ...extra.flatMap((id) => CARDS[id])];
}

function defaultMood() {
  const fromCheckin = MOOD_FROM_CHECKIN[store.temp.get('mood')];
  const fromStage = MOOD_FROM_STAGE[prefs.stage];
  const id = fromCheckin && fromCheckin !== 'plain' ? fromCheckin : fromStage || fromCheckin || 'all';
  return MOODS.find((mood) => mood.id === id && moodAllowed(mood)) ? id : 'all';
}

function renderMoods() {
  const box = el.moods;
  box.replaceChildren(...MOODS.filter(moodAllowed).map((mood) => h('button', {
    type: 'button', class: 'chip chip--quiet', aria: { pressed: String(mood.id === state.mood) },
    onclick: () => { state.chosen = true; setMood(mood.id); },
  }, mood.label)));
}

function setMood(id) {
  state.mood = id;
  $$('button', el.moods).forEach((button) => button.setAttribute('aria-pressed', String(button.textContent === MOODS.find((m) => m.id === id)?.label)));
}

function prepareFiles(phrase) {
  state.files = {};
  const theme = prefs.isNight ? 'night' : 'peach';
  const ready = (key, button) => (blob) => { if (blob && state.phrase === phrase) { state.files[key] = fileFromBlob(blob, `opora-${key}.png`); button.disabled = false; button.removeAttribute('aria-busy'); } };
  [el.card, el.lock].forEach((button) => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });
  renderCard({ text: phrase, caption: '', theme, size: 'story' }).then(ready('card', el.card)).catch(() => { el.card.hidden = true; });
  renderCard({ text: phrase, theme: prefs.isNight ? 'night' : 'day', size: 'phone' }).then(ready('lock', el.lock)).catch(() => { el.lock.hidden = true; });
}

function draw() {
  const phrase = pick(poolFor(state.mood), `deck-${state.mood}`);
  if (!phrase) return;
  const first = !state.drawn;
  state.drawn = true;
  state.phrase = phrase;
  const flipIn = () => {
    el.text.textContent = phrase;
    el.mood.textContent = state.mood === 'all' ? '' : MOODS.find((mood) => mood.id === state.mood)?.label || '';
    el.stack.classList.add('is-drawn');
    el.stack.classList.remove('is-turning');
    announce(phrase);
  };
  if (first || prefs.reducedMotion) flipIn();
  else {
    el.stack.classList.add('is-turning');
    el.stack.classList.remove('is-drawn');
    setTimeout(flipIn, 380);
  }
  el.drawButton.querySelector('span').textContent = 'Ещё одну';
  el.after.hidden = false;
  el.note.textContent = '';
  prepareFiles(phrase);
}

function keep() {
  if (!state.phrase) return;
  if (!store.memory) {
    el.note.replaceChildren('Чтобы опора осталась на этом устройстве, включи память — ',
      h('button', { type: 'button', class: 'link', dataset: { action: 'settings', focus: 'data' } }, 'в настройках'),
      '. Или просто скопируй её себе.');
    return;
  }
  const saved = store.get('opory', []);
  if (!saved.includes(state.phrase)) store.set('opory', [state.phrase, ...saved].slice(0, MAX_SAVED));
  el.note.textContent = 'Оставлено на этом устройстве.';
  renderSaved();
}

function renderSaved() {
  const box = el.saved;
  const saved = store.memory ? store.get('opory', []) : [];
  if (!saved.length) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  box.replaceChildren(
    h('h3', { class: 'deck-saved__title' }, 'Мои опоры'),
    h('ul', { class: 'deck-saved__list', role: 'list' }, saved.slice(0, 6).map((phrase) => h('li', {},
      h('p', {}, phrase),
      h('button', { type: 'button', class: 'icon-btn', aria: { label: `Убрать: ${phrase}` }, onclick: () => {
        store.set('opory', store.get('opory', []).filter((item) => item !== phrase));
        renderSaved();
      } }, icon('close'))))),
    saved.length > 6 ? h('p', { class: 'note' }, `И ещё ${saved.length - 6}.`) : null,
  );
}

function build(root) {
  el.moods = h('div', { class: 'deck__moods chips-row', role: 'group', aria: { label: 'Какое сейчас настроение' } });
  el.text = h('p', { class: 'deck-card__text' });
  el.mood = h('p', { class: 'deck-card__mood' });
  el.stack = h('div', { class: 'deck__stack', 'aria-live': 'off' },
    h('span', { class: 'deck__under deck__under--3', 'aria-hidden': 'true' }),
    h('span', { class: 'deck__under deck__under--2', 'aria-hidden': 'true' }),
    h('span', { class: 'deck__under deck__under--1', 'aria-hidden': 'true' }),
    h('div', { class: 'deck-card' },
      h('div', { class: 'deck-card__back', 'aria-hidden': 'true' }, icon('flower', 'deck-card__flower')),
      h('div', { class: 'deck-card__face' }, icon('quote', 'deck-card__quote'), el.text, el.mood)));
  el.drawButton = h('button', { type: 'button', class: 'btn btn--primary deck__draw', onclick: draw }, icon('leaf'), h('span', {}, 'Вытянуть карточку'));
  el.card = h('button', { type: 'button', class: 'icon-btn', onclick: () => { if (state.files.card) shareOrDownload(state.files.card, 'Опора'); } }, icon('image'), h('span', {}, 'Открытка для подруги'));
  el.lock = h('button', { type: 'button', class: 'icon-btn', onclick: () => { if (state.files.lock) shareOrDownload(state.files.lock, 'Опора'); } }, icon('download'), h('span', {}, 'На экран блокировки'));
  el.note = h('p', { class: 'deck__note', role: 'status' });
  el.after = h('div', { class: 'deck__after', hidden: true },
    h('div', { class: 'phrase__actions' },
      h('button', { type: 'button', class: 'icon-btn', onclick: keep }, icon('heart'), h('span', {}, 'Оставить себе')),
      h('button', { type: 'button', class: 'icon-btn', onclick: async () => {
        const ok = await copyText(state.phrase, el.text);
        el.note.textContent = ok ? 'Скопировано.' : 'Фраза выделена — её можно скопировать вручную.';
      } }, icon('copy'), h('span', {}, 'Скопировать')),
      el.card, el.lock),
    h('p', { class: 'deck__lock-note' }, LOCK_NOTE),
    el.note);
  el.saved = h('div', { class: 'deck-saved', hidden: true });
  root.replaceChildren(el.moods, el.stack, h('div', { class: 'deck__controls' }, el.drawButton), el.after, el.saved);
}

export function init() {
  const root = $('[data-deck]');
  if (!root) return;
  build(root);
  state.mood = defaultMood();
  renderMoods();
  renderSaved();
  const refresh = () => {
    if (!state.chosen) state.mood = defaultMood();
    if (!MOODS.find((mood) => mood.id === state.mood && moodAllowed(mood))) state.mood = 'all';
    renderMoods();
  };
  document.addEventListener('mood:change', refresh);
  document.addEventListener('stage:change', refresh);
  document.addEventListener('store:change', (event) => { if (['opory', 'memory', '*'].includes(event.detail?.key)) renderSaved(); });
}
