// «Письмо Ирине»: the visitor assembles a short message and sends it herself.
// Nothing is sent by the site; the text is copied and the chosen app is opened.
import { $, $$, h, announce } from '../core/dom.js';
import { registerAction, goTo } from '../core/actions.js';
import { openSheets, closeSheet } from '../core/sheets.js';
import { copyText } from '../core/share.js';
import { celebrate } from '../core/celebrate.js';
import { watchField } from '../core/safety.js';

const PHONE = '+79217557171';
const EMAIL = 'irinaoshemetkova@gmail.com';
const BASE_TOPICS = ['тревога', 'усталость после родов', 'страх родов', 'ожидание беременности, ЭКО', 'утрата', 'отношения в паре', 'отношения с родными'];
const FORMAT_TEXT = { online: ' онлайн', spb: ' очно в Петербурге', pair: ' для пары', unknown: '' };

let root;
const state = { format: 'online', topics: new Set() };

function topicChip(topic, pressed = false) {
  return h('button', { class: 'chip chip--small', type: 'button', aria: { pressed: String(pressed) }, dataset: { value: topic } }, topic);
}

function timezoneNote() {
  try {
    const offset = -new Date().getTimezoneOffset() / 60;
    if (offset === 3) return '';
    const sign = offset >= 0 ? '+' : '−';
    const value = Number.isInteger(offset) ? Math.abs(offset) : Math.abs(offset).toFixed(1).replace('.', ',');
    return ` (у меня UTC${sign}${value})`;
  } catch { return ''; }
}

function compose() {
  const name = $('#letter-name', root)?.value.trim();
  const own = $('#letter-topic', root)?.value.trim();
  const pressed = (selector) => $$(`${selector} [aria-pressed="true"]`, root).map((chip) => chip.dataset.value);
  const days = pressed('[data-letter-days]');
  const lines = [`Ирина, здравствуйте!${name ? ` Меня зовут ${name}.` : ''}`];
  lines.push(`Хочу записаться на консультацию${FORMAT_TEXT[state.format] ?? ''}.${state.format === 'unknown' ? ' Формат хотелось бы обсудить.' : ''}`);
  if (state.topics.size) lines.push(`С чем хочу прийти: ${[...state.topics].join(', ')}.`);
  if (own) lines.push(own);
  if (days.length) lines.push(`Мне удобнее ${days.join(', ')}${timezoneNote()}.`);
  lines.push('Подскажите, пожалуйста, ближайшее свободное время?');
  return lines.join('\n');
}

function update() {
  const text = compose();
  $('[data-letter-preview]', root).textContent = text;
  const sms = $('[data-letter-sms]', root);
  const mail = $('[data-letter-mail]', root);
  if (sms) sms.href = `sms:${PHONE}?&body=${encodeURIComponent(text)}`;
  if (mail) mail.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Запись на консультацию')}&body=${encodeURIComponent(text)}`;
}

function setFormat(value, focus = false) {
  if (!FORMAT_TEXT.hasOwnProperty(value)) return;
  state.format = value;
  $$('[data-letter-format] [role="radio"]', root).forEach((radio) => {
    const on = radio.dataset.value === value;
    radio.setAttribute('aria-checked', String(on));
    radio.tabIndex = on ? 0 : -1;
    if (on && focus) radio.focus();
  });
  update();
}

function addTopic(topic) {
  if (!topic) return;
  const box = $('[data-letter-topics]', root);
  let chip = $$('button', box).find((button) => button.dataset.value === topic);
  if (!chip) { chip = topicChip(topic); box.prepend(chip); }
  chip.setAttribute('aria-pressed', 'true');
  state.topics.add(topic);
  update();
}

function initForm() {
  const box = $('[data-letter-topics]', root);
  BASE_TOPICS.forEach((topic) => box.append(topicChip(topic)));
  box.addEventListener('click', (event) => {
    const chip = event.target.closest('button[data-value]');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(on));
    if (on) state.topics.add(chip.dataset.value); else state.topics.delete(chip.dataset.value);
    update();
  });
  $('[data-letter-days]', root)?.addEventListener('click', (event) => {
    const chip = event.target.closest('button[data-value]');
    if (!chip) return;
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    update();
  });
  const formats = $('[data-letter-format]', root);
  formats?.addEventListener('click', (event) => {
    const radio = event.target.closest('[role="radio"]');
    if (radio) setFormat(radio.dataset.value);
  });
  formats?.addEventListener('keydown', (event) => {
    const radios = $$('[role="radio"]', formats);
    const index = radios.findIndex((radio) => radio.getAttribute('aria-checked') === 'true');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    setFormat(radios[(index + step + radios.length) % radios.length].dataset.value, true);
  });
  ['#letter-name', '#letter-topic'].forEach((selector) => $(selector, root)?.addEventListener('input', update));
  watchField($('#letter-topic', root));

  const status = $('[data-letter-status]', root);
  $('[data-letter-telegram]', root)?.addEventListener('click', async (event) => {
    const link = event.currentTarget;
    const ok = await copyText(compose(), $('[data-letter-preview]', root));
    const message = ok
      ? 'Текст письма скопирован. В Telegram откройте чат и вставьте его — Ирина ответит лично.'
      : 'Не получилось скопировать автоматически: текст выделен — скопируйте его и вставьте в чат.';
    status.textContent = message;
    announce(message);
    celebrate('petals', link);
  });
  update();
}

export function init() {
  root = $('[data-letter]');
  if (!root) return;
  initForm();
  registerAction('write', (el, detail = {}) => {
    if (detail.topic) addTopic(detail.topic);
    if (detail.format) setFormat(detail.format);
    const delay = openSheets().length ? 120 : 0;
    openSheets().forEach((sheet) => closeSheet(sheet));
    setTimeout(() => goTo('#zapis'), delay);
  });
}
