// «5-4-3-2-1»: one sense per screen. Ticking the dots is optional — nothing needs answering.
import { h, icon } from '../core/dom.js';
import { nav } from './ui.js';

export const title = '5-4-3-2-1: вернуться в момент';

const STEPS = [
  { n: 5, sense: 'вижу', icon: 'eye', text: 'Оглянитесь и найдите пять вещей, которые видите. Не торопитесь — назовите их про себя: цвет, форму, маленькую деталь.' },
  { n: 4, sense: 'слышу', icon: 'ear', text: 'Прислушайтесь и найдите четыре звука вокруг. Даже самые тихие считаются.' },
  { n: 3, sense: 'касаюсь', icon: 'hand', text: 'Найдите три предмета, к которым можно прикоснуться. Какие они — гладкие, тёплые, шершавые?' },
  { n: 2, sense: 'чувствую запах', icon: 'nose', text: 'Заметьте два запаха. Если не находятся — просто сделайте медленный вдох носом.' },
  { n: 1, sense: 'вкус', icon: 'cup', text: 'И последнее — один вкус. Можно сделать глоток воды или чая.' },
];

export function render(body, api) {
  const step = (index) => {
    const item = STEPS[index];
    api.setProgress(`Шаг ${index + 1} из ${STEPS.length}`);
    const dots = Array.from({ length: item.n }, (_, i) => h('button', {
      type: 'button', aria: { pressed: 'false', label: `Отметить ${i + 1} из ${item.n}` },
      onclick: (event) => { const b = event.currentTarget; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); },
    }, icon('check')));
    api.show(
      h('section', { class: 'g-step', aria: { label: `Шаг ${index + 1} из ${STEPS.length}` } },
        h('span', { class: 'g-step__num', 'aria-hidden': 'true' }, String(item.n)),
        h('span', { class: 'g-step__sense' }, icon(item.icon), item.sense),
        h('p', { class: 'g-step__text', 'data-autofocus': '', tabindex: '-1' }, item.text),
        h('div', { class: 'g-dots', role: 'group', aria: { label: 'Можно отмечать по одному' } }, dots),
        h('p', { class: 'g-hint' }, 'Отмечать необязательно — это просто опора для внимания.'),
      ),
      nav({
        back: index > 0 ? () => step(index - 1) : null,
        next: () => (index < STEPS.length - 1 ? step(index + 1) : api.done({ again: () => step(0) })),
        nextLabel: index < STEPS.length - 1 ? 'Дальше' : 'Готово',
      }),
    );
  };
  step(0);
}
