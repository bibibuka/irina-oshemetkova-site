// «Попросить о помощи»: fact → feeling → need → one concrete request (NVC scheme from the bot).
import { h } from '../core/dom.js';
import { watchField } from '../core/safety.js';
import { REQUEST } from '../content/words.js';
import { chips, copyShare, status as statusLine } from './ui.js';

export const title = 'Попросить о помощи';

export function render(body, api) {
  const s = { fact: '', feeling: '', need: '', ask: '' };
  const result = h('p', { class: 'rq-result', 'aria-live': 'polite' });
  const status = statusLine();
  const blank = (value) => value.trim() || '…';
  const text = () => `Когда ${blank(s.fact)}, я чувствую ${blank(s.feeling)}, потому что мне важно ${blank(s.need)}. Можешь, пожалуйста, ${blank(s.ask).replace(/[.?!]+$/, '')}?`;
  const update = () => {
    result.replaceChildren(
      'Когда ', h('mark', {}, blank(s.fact)), ', я чувствую ', h('mark', {}, blank(s.feeling)),
      ', потому что мне важно ', h('mark', {}, blank(s.need)), '. Можешь, пожалуйста, ', h('mark', {}, blank(s.ask).replace(/[.?!]+$/, '')), '?',
    );
  };

  const input = (key, label, placeholder) => {
    const el = h('input', { class: 'input', id: `rq-${key}`, maxlength: '160', placeholder });
    el.addEventListener('input', () => { s[key] = el.value; update(); });
    watchField(el);
    return { el, node: h('div', { class: 'field' }, h('label', { for: `rq-${key}` }, label), el) };
  };
  const fact = input('fact', 'Когда… — что происходит, без упрёков', 'я весь день одна с малышом');
  const ask = input('ask', 'Можешь, пожалуйста… — одно конкретное действие', 'взять малыша на час вечером');
  const feelings = chips(REQUEST.feelings, { label: 'Я чувствую', onChange: ([value]) => { s.feeling = value || ''; update(); } });
  const needs = chips(REQUEST.needs, { label: 'Мне важно', onChange: ([value]) => { s.need = value || ''; update(); } });
  const presets = h('div', { class: 'chips-row' }, REQUEST.presets.map((preset) => h('button', {
    class: 'chip chip--small', type: 'button',
    onclick: () => {
      Object.assign(s, { fact: preset.fact, feeling: preset.feeling, need: preset.need, ask: preset.ask });
      fact.el.value = preset.fact; ask.el.value = preset.ask;
      feelings.set([preset.feeling]); needs.set([preset.need]);
      update();
    },
  }, preset.label)));

  api.show(
    h('p', { class: 'p-lead', 'data-autofocus': '', tabindex: '-1' }, 'Просьба без упрёков слышна лучше, чем жалоба. Соберите её из четырёх частей — или начните с примера.'),
    h('div', { class: 'p-panel rq-form' },
      h('div', { class: 'field' }, h('p', { class: 'p-label' }, 'Начать с примера'), presets),
      fact.node,
      h('div', { class: 'field' }, h('p', { class: 'p-label' }, 'Я чувствую…'), feelings.node),
      h('div', { class: 'field' }, h('p', { class: 'p-label' }, 'Потому что мне важно…'), needs.node),
      ask.node,
    ),
    h('p', { class: 'p-label' }, 'Ваша просьба'),
    result,
    copyShare(text, { status, small: false }),
    status,
    h('p', { class: 'p-note' }, 'Одна просьба — одно действие. Так её легче услышать и выполнить.'),
    api.cta('Просить о помощи — навык, ему можно научиться.', 'Если просьбы не слышат или говорить о своих нуждах трудно — это хорошая тема для консультации, одной или вдвоём с партнёром.'),
  );
  update();
}
