// «Полка практик»: objects on a shelf, each opens a full-screen «room».
// 5-4-3-2-1, «Контакт с чувствами», «Отложить мысли до утра» (with a morning envelope
// that exists only with memory on), «Если накрывает воспоминание» (loss stage only),
// «Выбери за меня» and «Помогло — запомнить».
import { $, $$, h, icon, announce, focusQuietly } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction, runAction, goTo } from '../core/actions.js';
import { openSheet, closeSheet, isOpen } from '../core/sheets.js';
import { pick, pickFrom } from '../core/phrases.js';
import { celebrate } from '../core/celebrate.js';
import { watchField } from '../core/safety.js';
import { buzz, vibrationSupported } from '../core/audio.js';
import { renderCard, fileFromBlob, shareOrDownload } from '../core/share.js';
import { now, partOfDay, isNightLightHours } from '../core/time.js';
import {
  PRACTICE_INTRO, PRACTICE_DONE, PRACTICE_NAMES, GROUNDING, FEELINGS, ENVELOPE, FLASHBACK, PART_WORD,
} from '../content/practices.js';

const ENVELOPE_TTL = 48 * 3600000;
let el = {};
const room = { id: null, keys: null, swipe: null };

/* ---------- Room shell ---------- */
function setProgress(text) { el.progress.textContent = text || ''; }
function setBody(...children) {
  el.body.replaceChildren(...children.flat().filter(Boolean));
  el.scroll.scrollTop = 0;
}
function navRow({ back, next, nextLabel = 'Дальше' }) {
  return h('div', { class: 'room__nav' },
    back ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: back }, icon('arrow-left'), 'Назад') : h('span'),
    next ? h('button', { type: 'button', class: 'btn btn--primary', onclick: next }, nextLabel, icon('arrow', 'icon-arrow')) : null);
}
function focusText() { requestAnimationFrame(() => focusQuietly($('.room__text', el.body) || el.title)); }

function markTried(id) {
  const tried = store.temp.get('tried') || new Set();
  tried.add(PRACTICE_NAMES[id]?.split(',')[0] || id);
  store.temp.set('tried', tried);
  document.dispatchEvent(new CustomEvent('practice:done', { detail: { practice: id } }));
}

function finish(id, { lead = '', extra = null } = {}) {
  room.keys = null;
  room.swipe = null;
  delete el.room.dataset.sense;
  setProgress('Готово');
  const phrase = pick(PRACTICE_DONE, 'practice-done');
  const phraseNode = h('p', { class: 'room__done', tabindex: '-1' }, phrase);
  setBody(
    lead ? h('p', { class: 'room__lead-big' }, lead) : null,
    extra,
    phraseNode,
    h('div', { class: 'room__actions' },
      h('button', { type: 'button', class: 'btn btn--soft', onclick: () => start(id) }, 'Ещё раз'),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { closeSheet('sheet-room'); setTimeout(() => goTo('#polka'), 80); } }, 'Другая практика'),
      h('button', { type: 'button', class: 'btn btn--ghost', dataset: { action: 'helped', practice: id } }, icon('heart'), 'Помогло — запомнить')),
    h('p', { class: 'room__note', role: 'status', dataset: { helpedNote: '' } }),
  );
  markTried(id);
  requestAnimationFrame(() => { focusQuietly(phraseNode); celebrate('sprout', phraseNode); });
}

/* ---------- 5-4-3-2-1 ---------- */
function grounding(step = 0) {
  if (step >= GROUNDING.length) { finish('grounding', { lead: 'Ты здесь.' }); return; }
  const item = GROUNDING[step];
  el.room.dataset.sense = item.sense;
  setProgress(`Шаг ${step + 1} из ${GROUNDING.length}`);
  const dots = Array.from({ length: item.n }, (_, i) => h('button', {
    type: 'button', class: 'ground__dot', aria: { pressed: 'false', label: `Отметить: ${i + 1} из ${item.n}` },
    onclick: (event) => {
      const dot = event.currentTarget;
      dot.setAttribute('aria-pressed', String(dot.getAttribute('aria-pressed') !== 'true'));
      if (prefs.vibration && vibrationSupported()) buzz(12);
    },
  }));
  const back = step ? () => grounding(step - 1) : null;
  const next = () => grounding(step + 1);
  setBody(
    h('div', { class: 'ground' },
      h('span', { class: 'ground__num', 'aria-hidden': 'true' }, String(item.n)),
      h('span', { class: 'ground__icon', 'aria-hidden': 'true' }, icon(item.icon)),
      h('p', { class: 'room__text', tabindex: '-1' }, item.text),
      h('div', { class: 'ground__dots', role: 'group', aria: { label: 'Можно отмечать касанием — а можно не трогать' } }, dots)),
    navRow({ back, next, nextLabel: step === GROUNDING.length - 1 ? 'Готово' : 'Дальше' }),
  );
  room.keys = { left: back, right: next };
  room.swipe = { left: next, right: back };
  focusText();
}

/* ---------- Контакт с чувствами ---------- */
const BODY_ZONES = {
  head: '<circle cx="80" cy="36" r="21"/>',
  throat: '<rect x="71" y="58" width="18" height="15" rx="6"/>',
  shoulders: '<ellipse cx="80" cy="84" rx="44" ry="10"/>',
  chest: '<ellipse cx="80" cy="114" rx="29" ry="19"/>',
  belly: '<ellipse cx="80" cy="156" rx="27" ry="20"/>',
  arms: '<rect x="22" y="92" width="16" height="104" rx="8"/><rect x="122" y="92" width="16" height="104" rx="8"/>',
  legs: '<rect x="55" y="192" width="22" height="112" rx="10"/><rect x="83" y="192" width="22" height="112" rx="10"/>',
};
const SILHOUETTE = 'M80 15a21 21 0 1 1 0 42 21 21 0 0 1 0-42Zm-9 43h18v14c15 2 33 6 39 16 4 8 5 40 4 106m-80-106c-6-10-6 98-6 106m22-102c-2 30-4 66 3 92l-2 120m42-212c2 30 4 66-3 92l2 120m-60-212c-15 2-33 6-39 16';

function bodyFigure(state, onPick) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 160 320');
  svg.setAttribute('class', 'body-map');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path class="body-map__outline" d="${SILHOUETTE}"/>${Object.entries(BODY_ZONES).map(([key, shape]) => `<g class="body-map__zone" data-zone="${key}">${shape}</g>`).join('')}`;
  svg.addEventListener('click', (event) => {
    const zone = event.target.closest?.('[data-zone]');
    if (zone) onPick(zone.dataset.zone);
  });
  const sync = () => $$('[data-zone]', svg).forEach((zone) => zone.classList.toggle('is-on', zone.dataset.zone === state.zone));
  sync();
  return { svg, sync };
}

function feelings(step = 0, state = { zone: null, pairs: {}, voice: null, own: '' }) {
  el.room.dataset.sense = 'feel';
  room.swipe = null;
  if (step >= 3) { feelingsFinal(state); return; }
  setProgress(`Шаг ${step + 1} из 3`);
  const back = step ? () => feelings(step - 1, state) : null;
  const next = () => feelings(step + 1, state);
  room.keys = { left: back, right: next };
  const text = h('p', { class: 'room__text', tabindex: '-1' }, FEELINGS.steps[step]);
  if (step === 0) {
    let figure;
    const chips = [...FEELINGS.zones, FEELINGS.unknown].map(([key, label]) => h('button', {
      type: 'button', class: 'chip chip--small', dataset: { zoneChip: key }, aria: { pressed: String(state.zone === key) },
      onclick: () => pickZone(key),
    }, label));
    const pickZone = (key) => {
      state.zone = state.zone === key ? null : key;
      chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.zoneChip === state.zone)));
      figure.sync();
    };
    figure = bodyFigure(state, pickZone);
    setBody(text, h('div', { class: 'feel-map' }, figure.svg, h('div', { class: 'chips-row', role: 'group', aria: { label: 'Где в теле' } }, chips)), navRow({ next }));
  } else if (step === 1) {
    const rows = FEELINGS.pairs.map((pair, index) => h('div', { class: 'seg', role: 'group', aria: { label: pair.join(' или ') } },
      pair.map((word) => h('button', {
        type: 'button', aria: { pressed: String(state.pairs[index] === word) },
        onclick: (event) => {
          state.pairs[index] = state.pairs[index] === word ? null : word;
          $$('button', event.currentTarget.parentElement).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === state.pairs[index])));
        },
      }, word))));
    setBody(text, h('div', { class: 'feel-pairs' }, rows), h('p', { class: 'room__hint' }, 'Можно ничего не выбирать — просто побыть с ощущением.'), navRow({ back, next }));
  } else {
    const field = h('textarea', { class: 'textarea textarea--line', rows: '2', maxlength: '200', placeholder: 'Или своими словами', aria: { label: 'Что говорит ощущение — своими словами' } });
    field.value = state.own;
    field.addEventListener('input', () => { state.own = field.value; });
    const voices = FEELINGS.voices.map((voice) => h('button', {
      type: 'button', class: 'bubble-chip', aria: { pressed: String(state.voice === voice) },
      onclick: (event) => {
        state.voice = state.voice === voice ? null : voice;
        $$('.bubble-chip', el.body).forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === state.voice)));
      },
    }, voice));
    setBody(text, h('div', { class: 'chips-row feel-voices', role: 'group', aria: { label: 'Подсказки' } }, voices), field, navRow({ back, next, nextLabel: 'Готово' }));
    watchField(field, field);
  }
  focusText();
}

function feelingsSentence(state) {
  const zone = [...FEELINGS.zones, FEELINGS.unknown].find(([key]) => key === state.zone);
  const where = zone ? zone[2] : 'где-то внутри';
  const adjectives = Object.values(state.pairs).filter(Boolean);
  const said = state.own.trim() || state.voice;
  let line = `Я услышала себя: ${where}${adjectives.length ? ` — ${adjectives.join(', ')}` : ''}.`;
  if (said) line += ` Оно говорит: «${said.replace(/[«»]/g, '')}».`;
  return line;
}

function feelingsFinal(state) {
  const sentence = feelingsSentence(state);
  let file = null;
  const save = h('button', { type: 'button', class: 'btn btn--ghost btn--small', 'aria-busy': 'true', disabled: true }, icon('image'), 'Сохранить картинкой');
  renderCard({ text: sentence.replace(/^Я услышала себя: /, ''), caption: 'Я услышала себя', theme: prefs.isNight ? 'night' : 'peach' })
    .then((blob) => { if (blob) { file = fileFromBlob(blob, 'ya-uslyshala-sebya.png'); save.disabled = false; save.removeAttribute('aria-busy'); } })
    .catch(() => { save.hidden = true; });
  save.addEventListener('click', () => { if (file) shareOrDownload(file, 'Я услышала себя'); });
  finish('feelings', {
    lead: FEELINGS.final,
    extra: h('figure', { class: 'heard-card' }, h('p', {}, sentence), h('figcaption', {}, save)),
  });
}

/* ---------- Отложить мысли до утра ---------- */
function envelope() {
  room.keys = null; room.swipe = null;
  el.room.dataset.sense = 'night';
  setProgress('');
  el.title.textContent = isNightLightHours() ? ENVELOPE.titleNight : ENVELOPE.title;
  const field = h('textarea', { class: 'textarea envelope__field', rows: '6', maxlength: '2000', placeholder: ENVELOPE.placeholder, aria: { label: 'Что крутится в голове' } });
  const status = h('p', { class: 'room__note', role: 'status' });
  const letGo = h('button', { type: 'button', class: 'btn btn--primary', onclick: () => release(field) }, 'Отпустить');
  const keep = h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => seal(field, status) }, icon('envelope'), 'Положить в конверт до утра');
  setBody(
    h('p', { class: 'room__text', tabindex: '-1' }, ENVELOPE.lead),
    h('div', { class: 'envelope__paper' }, field),
    h('div', { class: 'room__actions' }, letGo, keep),
    h('p', { class: 'room__hint' }, ENVELOPE.keepNote),
    status,
  );
  watchField(field, field);
  focusText();
}

function afterEnvelope(sealed) {
  setBody(
    sealed ? h('div', { class: 'envelope-art is-sealing', 'aria-hidden': 'true' },
      h('svg', { ns: 'svg', viewBox: '0 0 140 100', class: 'envelope-art__svg' })) : null,
    h('p', { class: 'room__lead-big', tabindex: '-1' }, ENVELOPE.after),
    sealed ? h('p', { class: 'room__hint' }, ENVELOPE.sealed) : null,
    h('div', { class: 'room__actions' },
      h('button', { type: 'button', class: 'btn btn--soft', dataset: { action: 'breathe', pattern: '36', length: '3c', start: 'true' } }, icon('wave'), 'Подышать 3 круга'),
      h('button', { type: 'button', class: 'btn btn--ghost', dataset: { action: 'noise-focus' } }, icon('sound'), 'Включить шум')),
  );
  const art = $('.envelope-art__svg', el.body);
  if (art) art.innerHTML = '<rect x="6" y="14" width="128" height="80" rx="6"/><path class="flap" d="m8 18 62 44 62-44"/><circle class="seal" cx="70" cy="62" r="11"/>';
  markTried('envelope');
  requestAnimationFrame(() => focusQuietly($('.room__lead-big', el.body)));
}

function release(field) {
  const text = field.value;
  if (!text.trim() || prefs.reducedMotion) { field.value = ''; afterEnvelope(false); return; }
  const melt = h('div', { class: 'envelope__melt', 'aria-hidden': 'true' });
  const total = Math.min(text.length, 600);
  [...text.slice(0, 600)].forEach((char, index) => {
    melt.append(h('span', { style: { animationDelay: `${Math.round((index / total) * 1200)}ms` } }, char));
  });
  field.value = '';
  field.replaceWith(melt);
  setTimeout(() => afterEnvelope(false), 1700);
}

function seal(field, status) {
  if (!field.value.trim()) { status.textContent = 'Конверт пока пустой — можно выписать хотя бы пару слов.'; field.focus(); return; }
  if (!store.memory) {
    status.replaceChildren(ENVELOPE.needMemory, ' ',
      h('button', { type: 'button', class: 'link', dataset: { action: 'settings', focus: 'data' } }, 'Включить память'));
    return;
  }
  store.set('envelope', { text: field.value.trim(), at: Date.now() });
  field.value = '';
  afterEnvelope(true);
  renderMorning();
}

/* ---------- Если накрывает воспоминание ---------- */
function flashback() {
  room.keys = null; room.swipe = null;
  el.room.dataset.sense = 'quiet';
  setProgress('');
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(now());
  const anchor = h('p', { class: 'room__anchor room__text', tabindex: '-1' }, FLASHBACK.anchor(date, PART_WORD[partOfDay()]));
  const feetOut = h('p', { class: 'room__hint', role: 'status' });
  let timer = 0;
  const feet = h('button', { type: 'button', class: 'btn btn--soft', onclick: () => {
    clearInterval(timer);
    let left = 30;
    feet.disabled = true;
    feetOut.textContent = `${FLASHBACK.feet} ${left}`;
    timer = setInterval(() => {
      left -= 1;
      if (!el.body.contains(feet)) { clearInterval(timer); return; }
      feetOut.textContent = left > 0 ? `${FLASHBACK.feet} ${left}` : 'Ты здесь. Стопы на полу.';
      if (left <= 0) { clearInterval(timer); feet.disabled = false; }
    }, 1000);
  } }, icon('body'), 'Почувствовать стопы — 30 секунд');
  const questions = h('ol', { class: 'room__questions', role: 'list' });
  let asked = 0;
  const more = h('button', { type: 'button', class: 'link', onclick: () => {
    questions.append(h('li', { class: 'appear' }, FLASHBACK.questions[asked]));
    asked += 1;
    if (asked >= FLASHBACK.questions.length) more.hidden = true;
    else more.textContent = 'Следующий вопрос';
  } }, 'Вместо «почему?» — один вопрос «как?»');
  setBody(
    anchor,
    h('div', { class: 'room__actions' }, feet),
    feetOut,
    questions, more,
    h('p', { class: 'room__hint room__hint--irina' }, FLASHBACK.irina, ' ',
      h('button', { type: 'button', class: 'link', dataset: { action: 'write', topic: 'утрата' } }, 'Написать Ирине')),
    h('div', { class: 'room__actions' }, h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => finish('flashback') }, 'Готово')),
  );
  focusText();
}

/* ---------- Opening ---------- */
const TITLES = {
  grounding: 'Вернуться в момент', feelings: 'Контакт с чувствами', envelope: ENVELOPE.title, flashback: 'Если накрывает воспоминание',
};

function start(id) {
  room.id = id;
  el.title.textContent = TITLES[id];
  el.room.classList.toggle('room--quiet', id === 'flashback');
  if (id === 'grounding') grounding(0);
  else if (id === 'feelings') feelings(0);
  else if (id === 'envelope') envelope();
  else if (id === 'flashback') flashback();
}

function openRoom(id, opener) {
  if (!TITLES[id]) return;
  if (!isOpen('sheet-room')) openSheet('sheet-room', { opener, focus: '[data-room-title]' });
  start(id);
}

function chooseForMe(opener) {
  const pool = ['grounding', 'feelings', ...(store.get('noBreathing') ? [] : ['breath'])];
  const choice = pool[Math.floor(Math.random() * pool.length)];
  const card = $(`[data-shelf-item="${choice === 'breath' ? 'choose' : choice}"]`);
  const track = $('[data-shelf-track]');
  const go = () => {
    track?.classList.remove('is-shuffling');
    if (choice === 'breath') runAction('breathe', { pattern: '36', length: '60', start: 'true' });
    else openRoom(choice, opener);
  };
  if (prefs.reducedMotion || !track) { card?.classList.add('is-chosen'); setTimeout(() => card?.classList.remove('is-chosen'), 1200); go(); return; }
  track.classList.add('is-shuffling');
  card?.classList.add('is-chosen');
  setTimeout(() => card?.classList.remove('is-chosen'), 1600);
  setTimeout(go, 900);
}

/* ---------- Shelf, memory shelf, morning envelope ---------- */
function renderIntro() {
  const node = $('[data-practice-intro]');
  if (!node) return;
  const night = prefs.part === 'night' || isNightLightHours();
  node.textContent = pickFrom('practice-intro', night ? PRACTICE_INTRO.night : [], PRACTICE_INTRO[prefs.stage] || [], night ? [] : PRACTICE_INTRO.all);
}

const SHELF_ORDER = {
  default: ['grounding', 'feelings', 'envelope', 'stop', 'flashback', 'choose'],
  postpartum: ['stop', 'grounding', 'feelings', 'envelope', 'flashback', 'choose'],
  loss: ['flashback', 'grounding', 'feelings', 'envelope', 'stop', 'choose'],
};

function arrangeShelf() {
  const track = $('[data-shelf-track]');
  if (!track) return;
  const order = SHELF_ORDER[prefs.stage] || SHELF_ORDER.default;
  const current = $$('[data-shelf-item]', track).map((item) => item.dataset.shelfItem).join();
  if (current !== order.join()) order.forEach((key) => { const item = $(`[data-shelf-item="${key}"]`, track); if (item) track.append(item); });
  const flash = $('[data-shelf-item="flashback"]', track);
  if (flash) flash.hidden = prefs.stage !== 'loss';
  updateCounter();
}

function updateCounter() {
  const track = $('[data-shelf-track]');
  const counter = $('[data-shelf-counter]');
  if (!track || !counter) return;
  const items = $$('.shelf-item', track).filter((item) => !item.hidden);
  const width = items[0]?.getBoundingClientRect().width || 1;
  const index = Math.min(items.length, Math.round(track.scrollLeft / (width + 16)) + 1);
  counter.textContent = `${index} / ${items.length}`;
}

function renderHelped() {
  const box = $('[data-helped-shelf]');
  if (!box) return;
  const helped = store.get('helped');
  if (!helped || !PRACTICE_NAMES[helped]) { box.hidden = true; box.replaceChildren(); return; }
  const again = helped === 'breath'
    ? h('button', { type: 'button', class: 'btn btn--soft btn--small', dataset: { action: 'breathe', pattern: '36', start: 'true' } }, 'Повторить')
    : h('button', { type: 'button', class: 'btn btn--soft btn--small', dataset: { action: 'practice', practice: helped } }, 'Повторить');
  box.replaceChildren(
    icon('heart', 'helped-shelf__icon'),
    h('p', {}, `Тебе помогало: ${PRACTICE_NAMES[helped]}. Повторим?`),
    again,
    h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { store.set('helped', null); announce('Убрано из сохранённых.'); } }, 'Убрать'),
    h('p', { class: 'helped-shelf__note' }, 'Хранится только в этом браузере.'),
  );
  box.hidden = false;
}

function renderMorning() {
  const box = $('[data-morning-envelope]');
  if (!box) return;
  const saved = store.get('envelope');
  if (!saved?.at) { box.hidden = true; box.replaceChildren(); return; }
  if (Date.now() - saved.at > ENVELOPE_TTL) { store.set('envelope', null); box.hidden = true; return; }
  const created = new Date(saved.at);
  const today = now();
  const nextDay = today.toDateString() !== created.toDateString() || today - created > 6 * 3600000;
  if (!nextDay || today.getHours() < 6) { box.hidden = true; return; }
  const morning = today.getHours() < 12;
  const throwAway = () => { store.set('envelope', null); box.replaceChildren(h('p', { role: 'status' }, 'Конверт выброшен. Можно идти в день налегке.')); setTimeout(() => { box.hidden = true; }, 5000); };
  box.replaceChildren(
    icon('envelope', 'morning-envelope__icon'),
    h('p', { class: 'morning-envelope__text' }, morning ? ENVELOPE.morning : ENVELOPE.later),
    h('div', { class: 'morning-envelope__actions' },
      h('button', { type: 'button', class: 'btn btn--soft btn--small', onclick: () => {
        box.replaceChildren(
          h('p', { class: 'morning-envelope__text' }, ENVELOPE.opened),
          h('blockquote', { class: 'morning-envelope__note' }, saved.text),
          h('div', { class: 'morning-envelope__actions' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: throwAway }, 'Выбросить конверт')),
        );
      } }, 'Открыть'),
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: throwAway }, 'Выбросить не читая')),
  );
  box.hidden = false;
}

function helped(button, { practice }) {
  const note = button?.closest('.room, .breath-done, [data-breath-done]')?.querySelector('[data-helped-note]') || $('[data-helped-note]');
  if (!PRACTICE_NAMES[practice]) return;
  let text;
  if (store.memory) {
    store.set('helped', practice);
    text = `Сохранено на этом устройстве: ${PRACTICE_NAMES[practice]}. Повторить или убрать можно на полке практик.`;
  } else {
    text = 'Хорошо, что помогло. Чтобы сайт запомнил это на этом устройстве, включи память в настройках — или просто возвращайся сюда.';
  }
  if (note) note.textContent = text;
  announce(text);
}

function bindRoom() {
  el.enough?.addEventListener('click', () => closeSheet('sheet-room'));
  el.room.closest('dialog')?.addEventListener('keydown', (event) => {
    if (!room.keys || event.target.closest('textarea, input')) return;
    if (event.key === 'ArrowRight' && room.keys.right) { event.preventDefault(); room.keys.right(); }
    if (event.key === 'ArrowLeft' && room.keys.left) { event.preventDefault(); room.keys.left(); }
  });
  let startX = null;
  el.body.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'mouse') startX = event.clientX; });
  el.body.addEventListener('pointerup', (event) => {
    if (startX == null || !room.swipe) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 60) return;
    const go = dx < 0 ? room.swipe.left : room.swipe.right;
    go?.();
  });
  document.addEventListener('sheet:close', (event) => {
    if (event.detail.id === 'sheet-room') { room.id = null; room.keys = null; room.swipe = null; }
  });
}

export function init() {
  const sheet = $('#sheet-room');
  el = {
    room: $('[data-room]'), scroll: $('[data-room]'), title: $('[data-room-title]'), progress: $('[data-room-progress]'),
    body: $('[data-room-body]'), enough: $('[data-room-enough]'),
  };
  if (sheet && el.room) bindRoom();
  const stamp = $('[data-today-stamp]');
  if (stamp) stamp.textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(now());
  renderIntro();
  arrangeShelf();
  renderHelped();
  renderMorning();
  $('[data-shelf-track]')?.addEventListener('scroll', () => requestAnimationFrame(updateCounter), { passive: true });
  window.addEventListener('resize', updateCounter);
  document.addEventListener('stage:change', () => { renderIntro(); arrangeShelf(); });
  document.addEventListener('store:change', (event) => {
    const key = event.detail?.key;
    if (['helped', '*', 'memory'].includes(key)) renderHelped();
    if (['envelope', '*', 'memory'].includes(key)) renderMorning();
    if (['stage', '*'].includes(key)) arrangeShelf();
  });
  registerAction('practice', (button, { practice }) => openRoom(practice, button));
  registerAction('choose-practice', (button) => chooseForMe(button));
  registerAction('helped', helped);
}
