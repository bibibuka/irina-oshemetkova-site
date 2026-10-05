// «Как ты сейчас?» — five states of inner weather, one phrase, no more than three steps.
// «Тяжело» and «очень тяжело» switch the page to quiet mode and light the lamp;
// «очень тяжело» shows help first, without any motion except the slow breathing circle.
import { $, $$, h, icon, announce } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction } from '../core/actions.js';
import { pick } from '../core/phrases.js';
import { celebrate } from '../core/celebrate.js';
import { startMiniBreath } from '../core/minibreath.js';
import { CHECKIN, STEPS, ROUTES, LOUDER, MOOD_TOPIC, MOODS } from '../content/checkin.js';

const ORDER = ['good', 'ok', 'meh', 'hard', 'very-hard'];
const state = { mood: null, louder: null };
let stopMini = null;

function isEvening() { return ['evening', 'night'].includes(prefs.part) || prefs.isNight; }

function routeFor(mood, louder) {
  let ids;
  if (mood === 'very-hard') {
    ids = ['write', 'grounding'];
  } else if (louder && LOUDER[louder] && mood !== 'good') {
    const rule = LOUDER[louder];
    ids = [...rule.steps];
    if (rule.night && isEvening()) ids.splice(1, 0, rule.night);
    if (rule.postpartum && prefs.stage === 'postpartum') ids.splice(1, 0, rule.postpartum);
  } else {
    ids = [...(ROUTES[mood] || ROUTES.meh)];
  }
  if (store.get('noBreathing')) ids = ids.map((id) => (STEPS[id]?.breathing ? 'grounding' : id));
  if (prefs.stage === 'loss') ids = ids.map((id) => (id === 'guests' ? 'deck' : id));
  ids = [...new Set(ids)];
  if (mood === 'hard' && !ids.includes('write')) ids = [...ids.slice(0, 2), 'write'];
  return ids.slice(0, 3);
}

function stepNode(id, topic) {
  const step = STEPS[id];
  if (!step) return null;
  const inner = [
    h('span', { class: 'step__icon', 'aria-hidden': 'true' }, icon(step.icon)),
    h('span', { class: 'step__text' }, h('span', { class: 'step__label' }, step.label), h('span', { class: 'step__sub' }, step.sub)),
    icon('arrow', 'step__arrow'),
  ];
  if (step.action) {
    const data = { action: step.action, ...(step.data || {}) };
    if (step.action === 'write' && topic) data.topic = topic;
    return h('li', {}, h('button', { type: 'button', class: 'step', dataset: data }, inner));
  }
  return h('li', {}, h('a', { class: 'step', href: step.href, dataset: { wordsOpen: step.words } }, inner));
}

function helpBlock() {
  const withBaby = !['loss', 'planning'].includes(prefs.stage);
  return h('div', { class: 'checkin-help' },
    h('p', {}, 'Если тебе сейчас опасно — ', h('a', { href: 'tel:112' }, '112'), '.'),
    h('p', { class: 'checkin-help__row' },
      h('a', { class: 'btn btn--danger btn--small', href: 'tel:112' }, icon('phone'), 'Позвонить 112'),
      h('a', { class: 'btn btn--ghost btn--small', href: 'tel:88002000122' }, icon('phone'), '8-800-2000-122')),
    h('p', { class: 'note' }, 'Телефон доверия, в том числе для родителей, — если хочется поговорить с человеком прямо сейчас.'),
    withBaby ? h('p', {}, 'Если ты с малышом и чувствуешь, что на грани, — ',
      h('button', { type: 'button', class: 'link', dataset: { action: 'stop' } }, 'Экстренная остановка, 5 шагов'), '.') : null,
    h('p', { class: 'note' }, 'Этот сайт и я — не экстренная служба: я не на дежурстве и могу ответить не сразу. ',
      h('button', { type: 'button', class: 'link', dataset: { openSheet: 'sheet-help' } }, 'Все номера помощи')),
  );
}

function miniBreath() {
  if (store.get('noBreathing')) return null;
  return h('div', { class: 'mini-breath mini-breath--inline', dataset: { miniBreath: '' } },
    h('div', { class: 'mini-breath__circle', 'aria-hidden': 'true' }),
    h('div', {},
      h('p', { class: 'mini-breath__cap' }, 'Подышать минуту прямо здесь'),
      h('p', { class: 'mini-breath__text', dataset: { miniText: '' } }, 'Вдох… 3')),
  );
}

function renderAnswer(container, mood, { compact = false } = {}) {
  stopMini?.();
  stopMini = null;
  const phrase = pick(CHECKIN[mood], `checkin-${mood}`);
  const topic = (state.louder && LOUDER[state.louder]?.topic) || MOOD_TOPIC[mood] || '';
  const steps = routeFor(mood, compact ? null : state.louder).slice(0, compact ? 2 : 3);
  const phraseNode = h('p', { class: 'answer__phrase', tabindex: '-1' }, phrase);
  const mini = mood === 'very-hard' ? miniBreath() : null;
  const card = h('div', { class: ['answer', 'appear', `answer--${mood}`, compact && 'answer--compact'] },
    phraseNode,
    mood === 'very-hard' ? helpBlock() : null,
    mini,
    h('div', { class: 'answer__next' },
      h('p', { class: 'answer__cap' }, 'Можно начать с этого:'),
      h('ul', { class: 'steps', role: 'list' }, steps.map((id) => stepNode(id, topic)))),
  );
  container.replaceChildren(card);
  container.hidden = false;
  if (mini) stopMini = startMiniBreath(mini);
  announce(phrase);
  return phraseNode;
}

function setQuietness(mood) {
  const heavy = mood === 'hard' || mood === 'very-hard';
  document.documentElement.classList.toggle('lamp-on', heavy);
  if (heavy) prefs.enterQuiet('checkin');
}

function select(mood) {
  if (!CHECKIN[mood]) return;
  const changed = state.mood !== mood;
  state.mood = mood;
  if (changed) state.louder = null;
  store.temp.set('mood', mood);
  $$('.weather__tile').forEach((tile) => {
    const on = tile.dataset.mood === mood;
    tile.setAttribute('aria-checked', String(on));
    tile.tabIndex = on ? 0 : -1;
    tile.classList.toggle('is-picked', on && changed);
  });
  const louder = $('[data-louder]');
  if (louder) {
    louder.hidden = !['ok', 'meh', 'hard'].includes(mood);
    if (changed) $$('[data-louder-value]', louder).forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
  }
  setQuietness(mood);
  const container = $('[data-checkin-answer]');
  if (container) {
    const phrase = renderAnswer(container, mood);
    if (mood === 'good' || mood === 'ok') celebrate('sprout', phrase);
  }
  document.dispatchEvent(new CustomEvent('mood:change', { detail: { mood } }));
}

function nightAnswer(el, mood) {
  const host = el.closest('[data-night-moods]');
  $$('[data-action="checkin"]', host).forEach((pebble) => pebble.setAttribute('aria-pressed', String(pebble === el)));
  let box = $('.nochnik__answer', host);
  if (!box) { box = h('div', { class: 'nochnik__answer' }); host.append(box); }
  state.mood = mood;
  store.temp.set('mood', mood);
  setQuietness(mood);
  renderAnswer(box, mood, { compact: true });
  document.dispatchEvent(new CustomEvent('mood:change', { detail: { mood } }));
}

function initWeather() {
  const group = $('[data-weather]');
  if (!group) return;
  const tiles = $$('.weather__tile', group);
  tiles.forEach((tile, index) => {
    tile.tabIndex = index === 0 ? 0 : -1;
    tile.addEventListener('click', () => select(tile.dataset.mood));
    tile.addEventListener('animationend', () => tile.classList.remove('is-picked'));
  });
  group.addEventListener('keydown', (event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const focused = tiles.indexOf(document.activeElement);
    const current = focused >= 0 ? focused : Math.max(0, ORDER.indexOf(state.mood));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ORDER.length - 1 : (current + keys[event.key] + ORDER.length) % ORDER.length;
    select(ORDER[next]);
    tiles.find((tile) => tile.dataset.mood === ORDER[next])?.focus();
  });
  $$('[data-louder-value]').forEach((chip) => chip.addEventListener('click', () => {
    const value = chip.dataset.louderValue;
    state.louder = state.louder === value ? null : value;
    $$('[data-louder-value]').forEach((other) => other.setAttribute('aria-pressed', String(other.dataset.louderValue === state.louder)));
    const container = $('[data-checkin-answer]');
    if (container && state.mood) renderAnswer(container, state.mood);
  }));
}

export function init() {
  initWeather();
  registerAction('checkin', (el, { mood }) => {
    if (!MOODS[mood]) return;
    if (el?.closest('[data-night-moods]')) nightAnswer(el, mood);
    else select(mood);
  });
}
