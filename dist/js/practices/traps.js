// «Ловушки мышления»: twelve flip cards and a tiny «find the trap» game.
import { h, icon } from '../core/dom.js';
import { shuffled } from '../core/phrases.js';
import { TRAPS } from '../content/thinking.js';

export const title = 'Ловушки мышления';

export function render(body, api) {
  const cards = TRAPS.map((trap, index) => h('button', {
    class: 'trap', type: 'button', aria: { pressed: 'false', label: `${trap.name}. Пример: ${trap.example}. Как узнать: ${trap.how} Вопрос, который помогает: ${trap.question}` },
    onclick: (event) => { const card = event.currentTarget; card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true')); },
  },
  h('span', { class: 'trap__inner', 'aria-hidden': 'true' },
    h('span', { class: 'trap__face trap__front' },
      h('span', { class: 'trap__num' }, String(index + 1).padStart(2, '0')),
      h('span', { class: 'trap__name' }, trap.name),
      h('span', { class: 'trap__ex' }, trap.example),
      h('span', { class: 'trap__hint' }, 'перевернуть'),
    ),
    h('span', { class: 'trap__face trap__back' },
      h('span', {}, h('b', {}, 'Как узнать'), trap.how),
      h('span', {}, h('b', {}, 'Вопрос, который помогает'), trap.question),
    ),
  )));

  // Game
  let order = shuffled(TRAPS);
  let round = 0;
  const thought = h('p', { class: 'trap-game__thought', 'aria-live': 'polite' });
  const options = h('div', { class: 'trap-game__options', role: 'group', aria: { label: 'На какую ловушку похоже' } });
  const feedback = h('p', { class: 'trap-game__feedback', role: 'status' });
  const nextRound = () => {
    if (round >= order.length) { order = shuffled(TRAPS); round = 0; }
    const answer = order[round++];
    const others = shuffled(TRAPS.filter((trap) => trap !== answer)).slice(0, 2);
    thought.textContent = answer.example;
    feedback.textContent = '';
    options.replaceChildren(...shuffled([answer, ...others]).map((trap) => h('button', {
      class: 'chip chip--small', type: 'button',
      onclick: () => {
        options.querySelectorAll('button').forEach((button) => { button.disabled = true; button.dataset.state = button.textContent === answer.name ? 'right' : 'other'; });
        feedback.replaceChildren(
          trap === answer ? 'Да, похоже на ' : 'Можно увидеть и так. Чаще это называют ',
          h('b', {}, `«${answer.name}»`), '. ',
          `Вопрос, который помогает: ${answer.question}`,
        );
      },
    }, trap.name)));
  };

  api.show(
    h('p', { class: 'p-lead', 'data-autofocus': '', tabindex: '-1' }, 'Двенадцать привычных поворотов мысли. Они бывают у всех — это не диагноз и не «ошибка». Нажмите на карточку, чтобы перевернуть.'),
    h('div', { class: 'traps-grid' }, cards),
    h('section', { class: 'trap-game', aria: { label: 'Мини-игра: найдите ловушку' } },
      h('p', { class: 'p-label' }, 'Мини-игра: на какую ловушку похожа мысль?'),
      thought, options, feedback,
      h('div', { class: 'p-row' },
        h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: nextRound }, icon('shuffle'), 'Ещё мысль'),
        h('button', { class: 'btn btn--primary btn--small', type: 'button', onclick: () => api.open('thought') }, 'Разобрать свою мысль', icon('arrow', 'icon-arrow')),
      ),
    ),
    api.cta('Узнали свою ловушку?', 'Заметить привычный поворот мысли — уже полдела. На консультации мы разберём, откуда он берётся и как с ним жить спокойнее.'),
  );
  nextRound();
}
