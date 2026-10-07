// One manager for every overlay («шторка» on phones, centred card on desktop).
// Native <dialog> gives focus trapping and Esc; we add: one sheet at a time,
// focus return, scroll lock, backdrop dismiss and «Назад» on phones closes the sheet.
import { $, $$, focusQuietly, on } from './dom.js';

const openers = new Map();
let pendingBack = false;

function sheetFrom(target) {
  if (!target) return null;
  if (target instanceof HTMLDialogElement) return target;
  return document.getElementById(String(target).replace(/^#/, ''));
}

function syncLock() {
  document.documentElement.classList.toggle('is-locked', Boolean($('dialog.sheet[open]')));
}

export function isOpen(target) { return Boolean(sheetFrom(target)?.open); }
export function openSheets() { return $$('dialog.sheet[open]'); }

/**
 * openSheet('sheet-help', { opener: button, focus: '#selector' })
 * Closes any other open sheet first (sheets never stack).
 */
export function openSheet(target, { opener = document.activeElement, focus } = {}) {
  const sheet = sheetFrom(target);
  if (!sheet) return null;
  openSheets().forEach((other) => { if (other !== sheet) closeSheet(other, { switching: true }); });
  if (opener instanceof HTMLElement && !sheet.contains(opener)) openers.set(sheet.id, opener);
  if (!sheet.open) {
    sheet.showModal();
    sheet.scrollTop = 0;
    const scroller = $('.sheet__scroll', sheet);
    if (scroller) scroller.scrollTop = 0;
  }
  syncLock();
  try {
    if (history.state?.sheet) history.replaceState({ sheet: sheet.id }, '');
    else history.pushState({ sheet: sheet.id }, '');
  } catch { /* history may be unavailable in sandboxed previews */ }
  const focusTarget = (focus && $(focus, sheet)) || $('[autofocus]', sheet) || $('.sheet__title, h2', sheet);
  requestAnimationFrame(() => focusQuietly(focusTarget));
  document.dispatchEvent(new CustomEvent('sheet:open', { detail: { id: sheet.id, sheet } }));
  return sheet;
}

export function closeSheet(target, { switching = false, fromHistory = false } = {}) {
  const sheet = sheetFrom(target) || $('dialog.sheet[open]');
  if (!sheet?.open) return;
  sheet.dataset.closing = switching ? 'switch' : 'user';
  sheet.close();
  if (!switching && !fromHistory && history.state?.sheet && !openSheets().length) {
    pendingBack = true;
    try { history.back(); } catch { pendingBack = false; }
  }
}

function handleClosed(sheet) {
  syncLock();
  const switching = sheet.dataset.closing === 'switch';
  delete sheet.dataset.closing;
  document.dispatchEvent(new CustomEvent('sheet:close', { detail: { id: sheet.id, sheet } }));
  const opener = openers.get(sheet.id);
  openers.delete(sheet.id);
  if (!switching && opener?.isConnected && !openSheets().length) {
    requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  }
}

export function initSheets() {
  $$('dialog.sheet').forEach((sheet) => {
    sheet.addEventListener('close', () => handleClosed(sheet));
    sheet.addEventListener('cancel', (event) => {
      // Esc: route through closeSheet so history stays consistent.
      event.preventDefault();
      closeSheet(sheet);
    });
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet) closeSheet(sheet);
    });
  });
  on(document, 'click', '[data-close]', (event, button) => {
    const sheet = button.closest('dialog.sheet');
    if (!sheet) return;
    event.preventDefault();
    closeSheet(sheet);
  });
  on(document, 'click', '[data-open-sheet]', (event, button) => {
    event.preventDefault();
    openSheet(button.dataset.openSheet, { opener: button });
  });
  window.addEventListener('popstate', () => {
    if (pendingBack) { pendingBack = false; return; }
    openSheets().forEach((sheet) => closeSheet(sheet, { fromHistory: true }));
  });
}
