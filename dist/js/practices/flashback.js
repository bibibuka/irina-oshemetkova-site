// «Если накрывает воспоминание»: a quiet anchor to today. No animation, no celebration.
import { h } from '../core/dom.js';
import { now, PART_LABELS, partOfDay } from '../core/time.js';

export const title = 'Если накрывает воспоминание';
export const quiet = true;

export function render(body, api) {
  let timer = 0;
  const date = now().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const part = PART_LABELS[partOfDay()];
  const feet = h('button', { class: 'btn btn--ghost', type: 'button' }, 'Побыть со стопами 30 секунд');
  const feetText = h('p', { class: 'p-note fb-timer', 'aria-live': 'polite' });
  feet.addEventListener('click', () => {
    clearInterval(timer);
    let left = 30;
    feet.disabled = true;
    feetText.textContent = 'Почувствуйте, как стопы касаются пола. Осталось 30 секунд.';
    timer = setInterval(() => {
      left -= 1;
      if (left % 5 === 0 && left > 0) feetText.textContent = `Стопы на полу. Осталось ${left} секунд.`;
      if (left <= 0) { clearInterval(timer); feet.disabled = false; feetText.textContent = 'Готово. Можно побыть так ещё — или идти дальше.'; }
    }, 1000);
  });

  api.show(
    h('p', { class: 'p-lead', 'data-autofocus': '', tabindex: '-1' }, 'Когда затягивает в тяжёлое воспоминание, это не значит, что с вами что-то не так. Так психика пытается встроить пережитое в историю жизни. Вот короткий якорь в сегодняшний день.'),
    h('p', { class: 'fb-anchor' }, 'Это воспоминание. Это было тогда. Сейчас ', h('b', {}, `${date}, ${part}`), '. Я здесь, и я в безопасности.'),
    h('ol', { class: 't-questions', role: 'list' },
      h('li', {}, 'Скажите это себе — вслух или про себя.'),
      h('li', {}, 'Назовите место, где вы сейчас, и три предмета вокруг.'),
      h('li', {}, 'Почувствуйте стопы на полу. Если хочется — умойтесь прохладной водой.'),
    ),
    h('div', { class: 'p-row' }, feet), feetText,
    h('div', { class: 'p-panel' },
      h('p', { class: 'p-label' }, 'Вместо «Почему?» — «Как?»'),
      h('ul', { class: 'fb-how', role: 'list' },
        h('li', {}, 'Как я могу поддержать себя сегодня?'),
        h('li', {}, 'Как мне прожить эту минуту?'),
        h('li', {}, 'Кто может побыть со мной рядом?'),
      ),
    ),
    h('p', { class: 'p-note' }, 'Если воспоминания и тяжёлые сны не становятся тише со временем и мешают жить — это повод обратиться к специалисту, который работает с горем и утратой.'),
    h('div', { class: 'p-nav' }, h('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: () => api.done({ phrase: 'Вы вернулись в сегодняшний день. Можно побыть в тишине столько, сколько нужно.' }),
    }, 'Готово')),
  );
  return () => clearInterval(timer);
}
