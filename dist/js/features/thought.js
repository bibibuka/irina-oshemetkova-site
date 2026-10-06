// «Мысль не отпускает? Разберём её.» — four steps from the bot's CBT module, computed
// entirely in the browser. Traps are underlined while typing; strength is a vessel with
// words, never numbers; «невыносимо» stops the exercise and offers a person and help.
// Below: twelve trap cards that turn over and the «Найди ловушку» game.
import { $, $$, h, icon, announce, focusQuietly } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction, goTo } from '../core/actions.js';
import { watchField } from '../core/safety.js';
import { renderCard, fileFromBlob, shareOrDownload } from '../core/share.js';
import { shuffled } from '../core/phrases.js';
import {
  STEP_NAMES, SITUATION, THOUGHT, FEELING, SAFETY, REFRAME, OUTCOME, LOSS_GUILT, BODY_NOTE,
  TRAPS, GUILT_MARKERS, BODY_MARKERS, GAME, GAME_TEXT,
} from '../content/thought.js';

const LETTERS = 'а-яё';
const boundary = (list) => new RegExp(`(^|[^${LETTERS}])(${list.join('|')})(?=$|[^${LETTERS}])`, 'giu');
const TRAP_RE = TRAPS.map((trap) => ({ trap, re: boundary(trap.markers) }));
const GUILT_RE = boundary(GUILT_MARKERS);
const BODY_RE = boundary(BODY_MARKERS);
const TRAP_BY_ID = Object.fromEntries(TRAPS.map((trap) => [trap.id, trap]));

const blank = () => ({ situation: '', thought: '', emotions: new Set(), before: 5, answers: ['', '', ''], q: 0, after: 5 });
let s = blank();
let el = {};

/* ---------- Detection ---------- */
export function findTraps(text) {
  const ranges = [];
  TRAP_RE.forEach(({ trap, re }) => {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text))) {
      const start = match.index + match[1].length;
      ranges.push({ start, end: start + match[2].length, trap });
      if (re.lastIndex === match.index) re.lastIndex += 1;
    }
  });
  ranges.sort((a, b) => a.start - b.start || TRAPS.indexOf(a.trap) - TRAPS.indexOf(b.trap));
  const merged = [];
  ranges.forEach((range) => { if (!merged.length || range.start >= merged[merged.length - 1].end) merged.push(range); });
  const first = TRAPS.find((trap) => merged.some((range) => range.trap === trap)) || null;
  return { ranges: merged, first };
}
const test = (re, text) => { re.lastIndex = 0; return re.test(text); };

function paintMirror(mirror, text, ranges) {
  const parts = [];
  let cursor = 0;
  ranges.forEach(({ start, end, trap }) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(h('mark', { title: trap.name }, text.slice(start, end)));
    cursor = end;
  });
  parts.push(`${text.slice(cursor)}\n`);
  mirror.replaceChildren(...parts);
}

function thoughtField(value, onInput) {
  const area = h('textarea', { class: 'textarea textarea--line thought-field__area', id: 'thought-text', rows: '3', maxlength: '600', 'aria-describedby': 'thought-hint thought-trap' });
  area.value = value;
  const mirror = h('div', { class: 'thought-field__mirror', 'aria-hidden': 'true' });
  const trapLine = h('p', { class: 'thought-trap', id: 'thought-trap', 'aria-live': 'polite' });
  let timer = 0;
  let lastNote = '';
  const lossGuilt = (text) => prefs.stage === 'loss' && test(GUILT_RE, text);
  const paint = () => {
    const text = area.value;
    const guilt = lossGuilt(text);
    const found = guilt ? { ranges: [], first: null } : findTraps(text);
    paintMirror(mirror, text, found.ranges);
    return { guilt, first: found.first, text };
  };
  const check = () => {
    const { guilt, first, text } = paint();
    const notes = [];
    if (guilt) notes.push(LOSS_GUILT);
    else if (first) notes.push(`Похоже на ловушку «${first.name}» — ${first.how}. В неё попадают все.`);
    if (prefs.stage === 'pregnancy' && test(BODY_RE, text)) notes.push(BODY_NOTE);
    const note = notes.join(' ');
    if (note !== lastNote) { lastNote = note; trapLine.textContent = note; }
  };
  area.addEventListener('input', () => {
    onInput(area.value);
    paint();
    clearTimeout(timer);
    timer = setTimeout(check, 400);
  });
  area.addEventListener('scroll', () => { mirror.scrollTop = area.scrollTop; });
  check();
  return { wrap: h('div', { class: 'thought-field' }, mirror, area), area, trapLine };
}

/* ---------- Pieces ---------- */
function vessel(value, caption) {
  return h('div', { class: 'vessel', style: { '--fill': String(value / 10) } },
    h('div', { class: 'vessel__glass', 'aria-hidden': 'true' }, h('span', { class: 'vessel__water' })),
    caption ? h('p', { class: 'vessel__cap' }, caption) : null,
    h('p', { class: 'vessel__word' }, FEELING.levels[value - 1]));
}

function strength(value, label, onChange) {
  const id = `strength-${label === FEELING.strength ? 'before' : 'after'}`;
  const glass = vessel(value);
  const input = h('input', {
    type: 'range', min: '1', max: '10', step: '1', value: String(value), id, class: 'strength__range',
    aria: { valuetext: FEELING.levels[value - 1] },
  });
  input.addEventListener('input', () => {
    const next = Number(input.value);
    input.setAttribute('aria-valuetext', FEELING.levels[next - 1]);
    glass.style.setProperty('--fill', String(next / 10));
    $('.vessel__word', glass).textContent = FEELING.levels[next - 1];
    onChange(next);
  });
  return h('div', { class: 'strength' },
    h('label', { for: id, class: 'strength__label' }, label),
    h('div', { class: 'strength__row' }, glass,
      h('div', { class: 'strength__scale' }, input,
        h('div', { class: 'strength__ends', 'aria-hidden': 'true' }, h('span', {}, 'еле заметно'), h('span', {}, 'невыносимо')))));
}

function nav(back, next, nextLabel = 'Дальше') {
  return h('div', { class: 'notebook__nav' },
    back ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: back }, icon('arrow-left'), 'Назад') : h('span'),
    next ? h('button', { type: 'button', class: 'btn btn--primary', onclick: next }, nextLabel, icon('arrow', 'icon-arrow')) : null);
}

function setDots(index) {
  $$('li', el.dots).forEach((dot, i) => {
    if (i === index) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current');
    dot.classList.toggle('is-done', i < index);
  });
}

function show(...nodes) {
  el.page.replaceChildren(...nodes.flat().filter(Boolean));
  el.page.classList.remove('appear');
  void el.page.offsetWidth;
  el.page.classList.add('appear');
}
const focusFirst = (selector) => requestAnimationFrame(() => focusQuietly($(selector, el.page)));

/* ---------- Steps ---------- */
function stepSituation() {
  setDots(0);
  const area = h('textarea', { class: 'textarea textarea--line', id: 'situation-text', rows: '2', maxlength: '600', 'aria-describedby': 'situation-hint' });
  area.value = s.situation;
  area.addEventListener('input', () => { s.situation = area.value; });
  const contexts = [...SITUATION.contexts.all, ...(SITUATION.contexts[prefs.stage] || [])];
  const chips = h('div', { class: 'chips-row', role: 'group', aria: { label: 'Подсказки, чтобы начать' } }, contexts.map((context) => h('button', {
    type: 'button', class: 'chip chip--quiet', onclick: () => {
      const rest = area.value.trim();
      area.value = rest.startsWith(context) ? rest : `${context}${rest ? `, ${rest}` : ', '}`;
      s.situation = area.value;
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    },
  }, context)));
  show(
    h('label', { class: 'notebook__q', for: 'situation-text' }, SITUATION.q),
    h('p', { class: 'notebook__hint', id: 'situation-hint' }, SITUATION.hint),
    chips, area,
    nav(null, () => { stepThought(); focusFirst('textarea'); }),
  );
  watchField(area, area);
}

function stepThought() {
  setDots(1);
  const field = thoughtField(s.thought, (value) => { s.thought = value; });
  const warn = h('p', { class: 'notebook__warn', role: 'status' });
  show(
    h('label', { class: 'notebook__q', for: 'thought-text' }, THOUGHT.q),
    h('p', { class: 'notebook__hint', id: 'thought-hint' }, THOUGHT.hint),
    field.wrap, field.trapLine, warn,
    nav(() => { stepSituation(); focusFirst('textarea'); }, () => {
      if (!s.thought.trim()) { warn.textContent = 'Здесь нужна хотя бы пара слов — так проще посмотреть на мысль со стороны.'; field.area.focus(); return; }
      stepFeeling(); focusFirst('.notebook__q');
    }),
  );
  watchField(field.area, field.trapLine);
}

function stepFeeling() {
  setDots(2);
  const chips = FEELING.emotions.map((emotion) => h('button', {
    type: 'button', class: 'chip chip--small', aria: { pressed: String(s.emotions.has(emotion)) },
    onclick: (event) => {
      if (s.emotions.has(emotion)) s.emotions.delete(emotion); else s.emotions.add(emotion);
      event.currentTarget.setAttribute('aria-pressed', String(s.emotions.has(emotion)));
    },
  }, emotion));
  show(
    h('p', { class: 'notebook__q', tabindex: '-1' }, FEELING.q),
    h('p', { class: 'notebook__hint' }, FEELING.hint),
    h('div', { class: 'chips-row', role: 'group', aria: { label: FEELING.q } }, chips),
    strength(s.before, FEELING.strength, (value) => { s.before = value; }),
    nav(() => { stepThought(); focusFirst('textarea'); }, () => {
      if (s.before >= 9) stepSafety(); else { s.q = 0; stepReframe(); }
      focusFirst('.notebook__q, .notebook__safety');
    }),
  );
}

function stepSafety() {
  setDots(2);
  const topic = 'хочется разобраться с мыслями, которые не отпускают';
  show(
    h('div', { class: 'notebook__safety', tabindex: '-1' },
      h('p', { class: 'notebook__safety-text' }, SAFETY.text),
      h('div', { class: 'actions-row' },
        store.get('noBreathing') ? null : h('button', { type: 'button', class: 'btn btn--soft', dataset: { action: 'breathe', pattern: '36', length: '60', start: 'true' } }, icon('wave'), 'Подышать вместе'),
        h('button', { type: 'button', class: 'btn btn--soft', dataset: { action: 'write', topic } }, icon('envelope'), 'Написать Ирине'),
        h('button', { type: 'button', class: 'btn btn--ghost', dataset: { openSheet: 'sheet-help' } }, icon('lifebuoy'), 'Номера помощи'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { stepResult(true); focusFirst('.notebook__q'); } }, icon('download'), 'Сохранить, чтобы обсудить на встрече')),
      h('p', { class: 'note' }, SAFETY.note)),
    nav(() => { stepFeeling(); focusFirst('.notebook__q'); }, null),
  );
  prefs.enterQuiet('thought');
}

function stepReframe() {
  setDots(3);
  const index = s.q;
  const id = `reframe-${index}`;
  const area = h('textarea', { class: 'textarea textarea--line', id, rows: '2', maxlength: '600', placeholder: REFRAME.placeholder });
  area.value = s.answers[index];
  area.addEventListener('input', () => { s.answers[index] = area.value; });
  show(
    h('p', { class: 'notebook__cloud', 'aria-label': 'Твоя мысль' }, `«${s.thought.trim()}»`),
    h('p', { class: 'notebook__step-cap' }, `${REFRAME.title} · вопрос ${index + 1} из ${REFRAME.questions.length}`),
    h('label', { class: 'notebook__q', for: id }, REFRAME.questions[index]),
    area,
    nav(() => {
      if (index > 0) { s.q -= 1; stepReframe(); } else stepFeeling();
      focusFirst('textarea, .notebook__q');
    }, () => {
      if (index < REFRAME.questions.length - 1) { s.q += 1; stepReframe(); focusFirst('textarea'); } else { stepAfter(); focusFirst('.notebook__q'); }
    }),
  );
  watchField(area, area);
}

function stepAfter() {
  setDots(3);
  show(
    h('p', { class: 'notebook__q', tabindex: '-1' }, REFRAME.again),
    strength(s.after, REFRAME.again.replace('А сейчас н', 'Сейчас н'), (value) => { s.after = value; }),
    nav(() => { s.q = REFRAME.questions.length - 1; stepReframe(); focusFirst('textarea'); }, () => { stepResult(false); focusFirst('.notebook__q'); }, 'Посмотреть итог'),
  );
}

function stepResult(fromSafety) {
  $$('li', el.dots).forEach((dot) => { dot.removeAttribute('aria-current'); dot.classList.add('is-done'); });
  const alternative = s.answers[2].trim();
  const outcome = fromSafety ? '' : s.after < s.before ? OUTCOME.lower : s.after > s.before ? OUTCOME.higher : OUTCOME.same;
  const emotions = [...s.emotions].join(', ');
  const summary = [
    s.situation.trim() && `Ситуация: ${s.situation.trim().replace(/[,;\s]+$/, '')}`,
    `Мысль: «${s.thought.trim()}»`,
    `Чувство: ${emotions || 'не названо'} — ${FEELING.levels[s.before - 1]}`,
    alternative && `Справедливее: «${alternative}»`,
    !fromSafety && `Сейчас: ${FEELING.levels[s.after - 1]}`,
  ].filter(Boolean);
  let file = null;
  const save = h('button', { type: 'button', class: 'btn btn--soft', disabled: true, 'aria-busy': 'true' }, icon('image'), 'Сохранить карточку для встречи');
  renderCard({
    text: alternative || s.thought.trim(),
    caption: alternative ? 'Как эта мысль звучит справедливее' : 'Мысль, которую хочу обсудить',
    footer: alternative ? `Было: «${s.thought.trim().slice(0, 64)}${s.thought.trim().length > 64 ? '…' : ''}»` : '',
    theme: prefs.isNight ? 'night' : 'day',
  }).then((blob) => { if (blob) { file = fileFromBlob(blob, 'razbor-mysli.png'); save.disabled = false; save.removeAttribute('aria-busy'); } }).catch(() => { save.hidden = true; });
  save.addEventListener('click', () => { if (file) shareOrDownload(file, 'Разбор мысли'); });
  show(
    h('p', { class: 'notebook__q', tabindex: '-1' }, fromSafety ? 'Сохранить, чтобы обсудить на встрече' : 'Итог'),
    fromSafety ? null : h('div', { class: 'vessels' }, vessel(s.before, 'было'), vessel(s.after, 'сейчас')),
    outcome ? h('p', { class: 'notebook__outcome' }, outcome) : null,
    alternative ? h('div', { class: 'notebook__shift' },
      h('p', { class: 'notebook__old' }, `«${s.thought.trim()}»`),
      h('p', { class: 'notebook__new' }, `«${alternative}»`)) : null,
    h('ul', { class: 'notebook__summary', role: 'list' }, summary.map((line) => h('li', {}, line))),
    h('div', { class: 'actions-row' },
      save,
      h('button', { type: 'button', class: 'btn btn--ghost', dataset: { action: 'write', topic: 'хочется разобраться с мыслями, которые не отпускают' } }, 'Обсудить с Ириной'),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { s = blank(); stepSituation(); focusFirst('textarea'); } }, 'Разобрать другую мысль'),
      h('button', { type: 'button', class: 'link', onclick: () => { s = blank(); stepSituation(); announce('Разбор стёрт.'); goTo('#razbor'); } }, 'Закрыть и стереть')),
    h('p', { class: 'note' }, 'Ничего не сохраняется: карточка — только если ты сама её скачаешь.'),
  );
  const tried = store.temp.get('tried') || new Set();
  tried.add('разбор мысли');
  store.temp.set('tried', tried);
  document.dispatchEvent(new CustomEvent('practice:done', { detail: { practice: 'thought' } }));
}

/* ---------- Traps deck and game ---------- */
function renderTraps() {
  const fan = $('[data-traps-fan]');
  if (!fan) return;
  fan.replaceChildren(...TRAPS.map((trap) => h('button', {
    type: 'button', class: 'trap', aria: { pressed: 'false' }, dataset: { trap: trap.id },
    onclick: (event) => {
      const card = event.currentTarget;
      card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
    },
  },
  // Front: the name and how the thought sounds; back: how to notice it and the question that helps.
  h('span', { class: 'trap__face trap__front' },
    h('span', { class: 'trap__name' }, trap.name),
    h('span', { class: 'trap__example' }, `«${trap.example.replace(/\.$/, '')}»`),
    h('span', { class: 'trap__hint' }, 'перевернуть')),
  h('span', { class: 'trap__face trap__back' },
    h('span', { class: 'trap__row' }, h('b', {}, 'Как узнать: '), trap.how, '.'),
    h('span', { class: 'trap__row' }, h('b', {}, 'Вопрос, который помогает: '), trap.ask)))));
}

let gameQueue = [];
function renderGame() {
  const box = $('[data-trap-game]');
  if (!box) return;
  if (!gameQueue.length) gameQueue = shuffled(GAME);
  const round = gameQueue.shift();
  const feedback = h('p', { class: 'trap-game__feedback', 'aria-live': 'polite' });
  const options = h('div', { class: 'chips-row', role: 'group', aria: { label: 'Какая ловушка?' } }, round.options.map((id) => h('button', {
    type: 'button', class: 'chip chip--small', aria: { pressed: 'false' },
    onclick: (event) => {
      $$('button', options).forEach((b) => b.setAttribute('aria-pressed', String(b === event.currentTarget)));
      const answer = TRAP_BY_ID[round.answer];
      feedback.textContent = id === round.answer ? GAME_TEXT.right(answer.name, answer.ask) : GAME_TEXT.other(answer.name);
    },
  }, TRAP_BY_ID[id].name)));
  box.replaceChildren(
    h('h4', { class: 'trap-game__title' }, GAME_TEXT.title),
    h('p', { class: 'trap-game__thought' }, `«${round.thought}»`),
    options, feedback,
    h('p', { class: 'trap-game__more' },
      h('button', { type: 'button', class: 'link', onclick: () => { renderGame(); $('.trap-game__thought', box)?.setAttribute('tabindex', '-1'); focusQuietly($('.trap-game__thought', box)); } }, 'Ещё мысль'),
      h('button', { type: 'button', class: 'link', dataset: { action: 'thought' } }, 'Разобрать свою мысль')),
  );
}

export function init() {
  el = { root: $('[data-thought]'), page: $('[data-thought-page]'), dots: $('[data-thought-dots]') };
  renderTraps();
  renderGame();
  if (!el.root || !el.page) return;
  stepSituation();
  document.addEventListener('stage:change', () => { if ($('#situation-text', el.page) && !s.situation) stepSituation(); });
  registerAction('thought', () => {
    goTo('#razbor', { focus: false, onDone: () => focusQuietly($('textarea, .notebook__q', el.page)) });
  });
}
