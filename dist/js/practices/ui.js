// Small building blocks shared by the practices.
import { h, icon, announce } from '../core/dom.js';
import { copyText, shareText } from '../core/share.js';

/** Segmented control: seg('Ритм', [{ value, label }], current, onChange) */
export function seg(label, options, current, onChange) {
  const group = h('div', { class: 'seg', role: 'group', aria: { label } });
  const buttons = options.map((option) => h('button', {
    type: 'button',
    aria: { pressed: String(option.value === current) },
    dataset: { value: option.value },
    onclick: () => {
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button === buttonFor(option.value))));
      onChange(option.value);
    },
  }, option.label));
  const buttonFor = (value) => buttons.find((button) => button.dataset.value === value);
  group.append(...buttons);
  return group;
}

/** Chips with single or multiple choice. Returns { node, values() }. */
export function chips(items, { multiple = false, label = '', onChange = () => {} } = {}) {
  const node = h('div', { class: 'chips-row', role: 'group', aria: label ? { label } : null });
  const buttons = items.map((item) => h('button', {
    class: 'chip chip--small', type: 'button', aria: { pressed: 'false' }, dataset: { value: item },
    onclick: (event) => {
      const button = event.currentTarget;
      const on = button.getAttribute('aria-pressed') !== 'true';
      if (!multiple) buttons.forEach((other) => other.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', String(on));
      onChange(values());
    },
  }, item));
  const values = () => buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.dataset.value);
  const set = (list) => buttons.forEach((button) => button.setAttribute('aria-pressed', String(list.includes(button.dataset.value))));
  node.append(...buttons);
  return { node, values, set };
}

/** «Назад / Дальше» row. Pass null to omit a button. */
export function nav({ back = null, next = null, nextLabel = 'Дальше', backLabel = 'Назад' } = {}) {
  return h('div', { class: 'p-nav' },
    back ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: back }, icon('arrow-left'), backLabel) : null,
    next ? h('button', { class: 'btn btn--primary', type: 'button', onclick: next }, nextLabel, icon('arrow', 'icon-arrow')) : null,
  );
}

/** Copy (and, where supported, share) buttons for a piece of text. */
export function copyShare(getText, { status = null, small = true } = {}) {
  const say = (message) => { if (status) status.textContent = message; announce(message); };
  const cls = `btn btn--ghost${small ? ' btn--small' : ''}`;
  return h('div', { class: 'phrase__actions' },
    h('button', {
      class: cls, type: 'button',
      onclick: async () => { const ok = await copyText(getText()); say(ok ? 'Скопировано. Можно вставить в сообщение.' : 'Не получилось скопировать — выделите текст вручную.'); },
    }, icon('copy'), 'Скопировать'),
    typeof navigator.share === 'function' ? h('button', {
      class: cls, type: 'button',
      onclick: async () => { const result = await shareText({ text: getText() }); if (result === 'shared') say('Отправлено.'); },
    }, icon('share'), 'Отправить') : null,
  );
}

export const status = () => h('p', { class: 'p-status', role: 'status' });
