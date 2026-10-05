// Safety layer: the «Помощь сейчас» sheet, the five-step «Экстренная остановка»,
// copy/share helpers for numbers and ready messages, and quiet mode on open.
// Texts here never vary (like the bot's SOS screens).
import { $, $$, on, focusQuietly } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction, runAction } from '../core/actions.js';
import { openSheet } from '../core/sheets.js';
import { copyText, shareText, canShareText } from '../core/share.js';
import { startMiniBreath } from '../core/minibreath.js';

const QUIET_HOURS = 24;
const STEPS = 5;
let step = 1;
let stopMini = null;

function statusFor(node) {
  return node.closest('dialog')?.querySelector('[role="status"]') || node.closest('section, .help-layer, div')?.querySelector('[role="status"]');
}
function say(node, text) {
  const status = statusFor(node);
  if (status) { status.textContent = ''; requestAnimationFrame(() => { status.textContent = text; }); }
}
const textOf = (selector) => $(selector)?.textContent.trim() || '';

function enterQuiet(reason) {
  prefs.enterQuiet(reason);
  if (store.memory) store.set('quietUntil', Date.now() + QUIET_HOURS * 3600000);
}

/* ----- Emergency stop ----- */
function showStep(next, { focus = true } = {}) {
  step = Math.max(1, Math.min(STEPS + 1, next));
  $$('[data-stop-step]').forEach((section) => { section.hidden = Number(section.dataset.stopStep) !== step; });
  const progress = $('[data-stop-progress]');
  if (progress) progress.textContent = step <= STEPS ? `Шаг ${step} из ${STEPS}` : 'Когда станет тише';
  const prev = $('[data-stop-prev]');
  const nextButton = $('[data-stop-next]');
  if (prev) prev.hidden = step === 1;
  if (nextButton) {
    nextButton.hidden = step > STEPS;
    nextButton.textContent = step === STEPS ? 'Когда станет тише' : 'Дальше';
  }
  stopMini?.();
  stopMini = null;
  const mini = $(`[data-stop-step="${step}"] [data-mini-breath]`);
  if (mini) stopMini = startMiniBreath(mini);
  if (focus) focusQuietly($(`[data-stop-step="${step}"] h3`));
}

function openStop(opener) {
  enterQuiet('stop');
  openSheet('sheet-stop', { opener, focus: '[data-stop-step="1"] h3' });
  showStep(1, { focus: false });
}

function bindStop() {
  $('[data-stop-next]')?.addEventListener('click', () => showStep(step + 1));
  $('[data-stop-prev]')?.addEventListener('click', () => showStep(step - 1));
  $('#sheet-stop')?.addEventListener('keydown', (event) => {
    if (event.target.closest('textarea, input')) return;
    if (event.key === 'ArrowRight' && step <= STEPS) { event.preventDefault(); showStep(step + 1); }
    if (event.key === 'ArrowLeft' && step > 1) { event.preventDefault(); showStep(step - 1); }
  });
  document.addEventListener('sheet:close', (event) => {
    if (event.detail.id === 'sheet-stop') { stopMini?.(); stopMini = null; }
  });
}

/* ----- Copy and share ----- */
function bindCopyShare() {
  on(document, 'click', '[data-copy-number]', async (event, button) => {
    const number = button.dataset.copyNumber;
    const ok = await copyText(number, button);
    say(button, ok ? `Номер ${number} скопирован.` : `Не получилось скопировать. Номер: ${number}.`);
  });
  on(document, 'click', '[data-copy-text]', async (event, button) => {
    const source = $(button.dataset.copyText);
    const ok = await copyText(textOf(button.dataset.copyText), source);
    say(button, ok ? 'Текст скопирован — его можно вставить в сообщение.' : 'Текст выделен — его можно скопировать вручную.');
  });
  on(document, 'click', '[data-share-text]', async (event, button) => {
    const text = textOf(button.dataset.shareText);
    if (canShareText()) {
      const result = await shareText({ text });
      if (result !== 'unsupported') return;
    }
    const ok = await copyText(text, $(button.dataset.shareText));
    say(button, ok ? 'Текст скопирован — вставь его в мессенджер.' : 'Текст выделен — его можно скопировать вручную.');
  });
  // Links get their final href just before the tap is handled, so the text is always current.
  on(document, 'click', '[data-share-telegram]', (event, link) => {
    link.href = `https://t.me/share/url?url=${encodeURIComponent(textOf(link.dataset.shareTelegram))}`;
  });
  on(document, 'click', '[data-share-sms]', (event, link) => {
    link.href = `sms:?&body=${encodeURIComponent(textOf(link.dataset.shareSms))}`;
  });
}

export function init() {
  if (store.get('quietUntil', 0) > Date.now()) prefs.enterQuiet('help');
  document.addEventListener('sheet:open', (event) => { if (event.detail.id === 'sheet-help') enterQuiet('help'); });
  bindStop();
  bindCopyShare();
  registerAction('stop', (el) => openStop(el));
  registerAction('very-hard', (el) => {
    if (prefs.stage === 'postpartum') openStop(el);
    else if (prefs.stage === 'loss') runAction('practice', { practice: 'flashback' }, el);
    else openSheet('sheet-help', { opener: el });
  });
}
