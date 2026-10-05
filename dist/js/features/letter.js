// «Начнём с разговора?» — a letter the visitor sends herself. Nothing is submitted:
// the text is copied, or put into Telegram / SMS / mail only by her tap.
// Also the calm card «Перед встречей» and the FAQ order at night.
import { $, $$, h, announce, focusQuietly } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction } from '../core/actions.js';
import { jumpTo } from '../core/motion.js';
import { closeSheet, openSheets } from '../core/sheets.js';
import { copyText } from '../core/share.js';
import { pick } from '../core/phrases.js';
import { celebrate } from '../core/celebrate.js';
import { watchField } from '../core/safety.js';
import { isNightLightHours } from '../core/time.js';
import { TOPICS, FORMAT_SENTENCE, GREETING, CLOSING, SUBJECT, CALM, SENT } from '../content/letter.js';

const PHONE = '+79217557171';
const MAIL = 'irinaoshemetkova@gmail.com';
const state = { format: 'online', topics: new Set(), extra: [], days: new Set(), times: new Set(), tried: false };
let el = {};

function timeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || /^(UTC|Etc\/)/.test(zone) || zone === 'Europe/Moscow') return '';
    return zone;
  } catch { return ''; }
}

function sentence(text) {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /[.!?…]$/.test(clean) ? clean : `${clean}.`;
}

function joinOr(list) {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} или ${list[list.length - 1]}`;
}

function compose() {
  const parts = [GREETING];
  const name = el.name?.value.trim().replace(/\s+/g, ' ');
  if (name) parts.push(`Меня зовут ${name}.`);
  parts.push(FORMAT_SENTENCE[state.format] || FORMAT_SENTENCE.unknown);
  const topics = [...state.topics].filter((topic) => topic !== 'пока не знаю');
  if (topics.length) parts.push(`С чем хочется прийти: ${topics.join(', ')}.`);
  else if (state.topics.has('пока не знаю')) parts.push('Пока не знаю, с чего начать, — хочется просто поговорить.');
  const own = sentence(el.topic?.value || '');
  if (own) parts.push(own);
  const days = [...state.days].map((day) => `в ${day}`);
  const times = [...state.times];
  if (days.length || times.length) parts.push(`Мне обычно удобно ${[joinOr(days), joinOr(times)].filter(Boolean).join(', ')}.`);
  const zone = timeZone();
  if (zone) parts.push(`Мой часовой пояс — ${zone}.`);
  const tried = store.temp.get('tried');
  if (state.tried && tried?.size) parts.push(`На сайте я уже попробовала: ${[...tried].join(', ')}.`);
  parts.push(CLOSING);
  return parts.join(' ');
}

let lastText = '';
let lastFlash = 0;
function update() {
  const text = compose();
  if (el.preview) {
    el.preview.textContent = text;
    // The preview «takes the ink» when the letter changes; typing does not make it flicker.
    const box = el.preview.parentElement;
    if (lastText && text !== lastText && Date.now() - lastFlash > 700) {
      lastFlash = Date.now();
      box.classList.remove('is-updated');
      void box.offsetWidth;
      box.classList.add('is-updated');
    }
    lastText = text;
  }
  if (el.sms) el.sms.href = `sms:${PHONE}?&body=${encodeURIComponent(text)}`;
  if (el.mail) el.mail.href = `mailto:${MAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(text)}`;
  const tried = store.temp.get('tried');
  if (el.tried) el.tried.hidden = !tried?.size;
  return text;
}

function renderTopics() {
  const box = $('[data-letter-topics]');
  if (!box) return;
  const list = [...new Set([...(TOPICS[prefs.stage] || TOPICS.default), ...state.extra])];
  box.replaceChildren(...list.map((topic) => h('button', {
    type: 'button', class: 'chip chip--small', dataset: { value: topic }, aria: { pressed: String(state.topics.has(topic)) },
  }, topic)));
}

function setFormat(value) {
  state.format = value;
  $$('[data-letter-format] [data-value]').forEach((chip) => {
    const on = chip.dataset.value === value;
    chip.setAttribute('aria-checked', String(on));
    chip.tabIndex = on ? 0 : -1;
  });
  update();
}

function addTopic(topic) {
  if (!topic) return;
  const known = [...(TOPICS[prefs.stage] || TOPICS.default), ...state.extra];
  if (!known.includes(topic)) state.extra.push(topic);
  state.topics.add(topic);
  renderTopics();
  update();
}

function afterSend(button, message) {
  if (el.status) el.status.textContent = message;
  announce(message);
  celebrate('petals', button);
}

function bind() {
  const formatGroup = $('[data-letter-format]');
  formatGroup?.setAttribute('role', 'radiogroup');
  formatGroup?.setAttribute('aria-label', 'Как удобнее');
  $$('[data-letter-format] [data-value]').forEach((chip) => chip.addEventListener('click', () => setFormat(chip.dataset.value)));
  formatGroup?.addEventListener('keydown', (event) => {
    const chips = $$('[data-value]', formatGroup);
    const index = chips.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (index < 0 || !step) return;
    event.preventDefault();
    const next = chips[(index + step + chips.length) % chips.length];
    setFormat(next.dataset.value);
    next.focus();
  });
  $('[data-letter-topics]')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-value]');
    if (!chip) return;
    const topic = chip.dataset.value;
    if (state.topics.has(topic)) state.topics.delete(topic); else state.topics.add(topic);
    chip.setAttribute('aria-pressed', String(state.topics.has(topic)));
    update();
  });
  [['[data-letter-days]', state.days], ['[data-letter-times]', state.times]].forEach(([selector, set]) => {
    $$(`${selector} [data-value]`).forEach((chip) => chip.addEventListener('click', () => {
      const value = chip.dataset.value;
      if (set.has(value)) set.delete(value); else set.add(value);
      chip.setAttribute('aria-pressed', String(set.has(value)));
      update();
    }));
  });
  el.name?.addEventListener('input', update);
  el.topic?.addEventListener('input', update);
  el.tried?.addEventListener('click', () => {
    state.tried = !state.tried;
    el.tried.setAttribute('aria-checked', String(state.tried));
    update();
  });
  el.telegram?.addEventListener('click', () => {
    // Copy inside the tap, then let the link open the chat with Irina.
    copyText(update(), el.preview).then((ok) => afterSend(el.telegram, ok
      ? `Текст скопирован. В Telegram вставь его в чат с Ириной. ${SENT}`
      : 'Не получилось скопировать — текст письма выделен, его можно скопировать вручную и вставить в чат.'));
  });
  el.sms?.addEventListener('click', () => { update(); afterSend(el.sms, SENT); });
  el.mail?.addEventListener('click', () => { update(); afterSend(el.mail, SENT); });
  if (el.topic) watchField(el.topic, el.topic);
  document.addEventListener('stage:change', () => { renderTopics(); update(); });
  document.addEventListener('practice:done', update);
}

function initCalm() {
  const text = $('[data-calm-text]');
  $('[data-calm-next]')?.addEventListener('click', () => {
    const current = text.textContent;
    let next = pick(CALM, 'calm');
    if (next === current) next = pick(CALM, 'calm');
    text.textContent = next;
    text.classList.remove('is-new');
    void text.offsetWidth;
    text.classList.add('is-new');
  });
}

function initFaq() {
  const faq = $('[data-faq]');
  const night = $('[data-faq-item="night"]');
  if (!faq || !night) return;
  const order = () => {
    if (isNightLightHours() || prefs.isNight) {
      if (faq.firstElementChild !== night) {
        faq.prepend(night);
        $$('details', faq).forEach((item) => { item.open = item === night; });
      }
    }
  };
  order();
  document.addEventListener('theme:change', order);
}

function initAboutColumn() {
  const about = $('.vstrecha__about');
  if (!about || !('ResizeObserver' in window)) return;
  new ResizeObserver(() => about.style.setProperty('--about-h', `${Math.ceil(about.offsetHeight)}px`)).observe(about);
}

export function init() {
  const root = $('[data-letter]');
  initCalm();
  initFaq();
  initAboutColumn();
  if (!root) return;
  el = {
    name: $('#letter-name'), topic: $('#letter-topic'), preview: $('[data-letter-preview]'),
    telegram: $('[data-letter-telegram]'), sms: $('[data-letter-sms]'), mail: $('[data-letter-mail]'),
    status: $('[data-letter-status]'), tried: $('[data-letter-tried]'), tz: $('[data-letter-tz]'),
  };
  const zone = timeZone();
  if (el.tz) el.tz.textContent = zone ? `Твой часовой пояс — ${zone}. Он попадёт в письмо, чтобы было проще договориться о времени.` : '';
  renderTopics();
  bind();
  setFormat('online');

  let arriving = 0;
  // «Написать Ирине» from anywhere: the page brings the letter itself into view (not the section
  // top), the letter greets the visitor with a soft glow and the cursor waits in the name field.
  registerAction('write', (button, detail = {}) => {
    if (openSheets().length) closeSheet();
    if (detail.format === 'pair') setFormat('pair');
    if (detail.topic) addTopic(detail.topic);
    setTimeout(() => jumpTo(root, {
      onDone: () => {
        root.classList.remove('is-arriving');
        void root.offsetWidth;
        root.classList.add('is-arriving');
        clearTimeout(arriving);
        arriving = setTimeout(() => root.classList.remove('is-arriving'), 2200);
        focusQuietly(el.name || $('#vstrecha-title'));
      },
    }), 60);
  });
}
