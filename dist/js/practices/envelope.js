// «Отложить мысли до утра»: write it out, seal it, let it wait. Nothing is stored.
import { h, icon } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { watchField } from '../core/safety.js';
import { copyText } from '../core/share.js';
import { status as statusLine } from './ui.js';

export const title = 'Отложить мысли до утра';

const ENVELOPE = '<svg viewBox="0 0 150 108" aria-hidden="true"><rect x="3" y="3" width="144" height="102" rx="8"/><path d="m5 8 70 52 70-52"/><circle cx="75" cy="60" r="12"/></svg>';

export function render(body, api) {
  let timer = 0;
  const start = () => {
    api.setProgress('');
    const paper = h('textarea', {
      class: 'env-paper', rows: '6', maxlength: '2000', 'data-autofocus': '',
      'aria-label': 'Мысли, которые крутятся в голове',
      placeholder: 'Всё, что крутится в голове. Списком, обрывками — как получится.',
    });
    const status = statusLine();
    const seal = () => {
      const finish = () => api.done({
        phrase: 'Конверт запечатан до утра.',
        extra: h('div', { class: 'env-seal' },
          envelopeArt(),
          h('p', { class: 'p-big' }, '«Я вижу эти мысли. Я вернусь к ним завтра утром, а сейчас я отдыхаю».'),
          h('p', { class: 'p-note' }, 'Текст стёрт и нигде не сохранился.'),
          h('div', { class: 'p-row' },
            h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => api.open('noise') }, icon('wave'), 'Шум для сна'),
            h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => api.open('breath') }, icon('leaf'), 'Подышать перед сном'),
          ),
        ),
        again: start,
      });
      paper.readOnly = true;
      if (prefs.reducedMotion) { paper.value = ''; finish(); return; }
      paper.classList.add('is-folding');
      timer = setTimeout(() => { paper.value = ''; finish(); }, 900);
    };
    api.show(
      h('p', { class: 'p-lead' }, 'Выпишите всё, что не даёт уснуть. Потом запечатаем — и мысли подождут до утра. Ничего не сохраняется и никуда не отправляется.'),
      paper,
      h('div', { class: 'p-row' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: seal }, icon('envelope'), 'Запечатать до утра'),
        h('button', {
          class: 'btn btn--ghost', type: 'button',
          onclick: async () => {
            if (!paper.value.trim()) { status.textContent = 'Пока нечего копировать.'; return; }
            const ok = await copyText(paper.value, paper);
            status.textContent = ok ? 'Скопировано — можно сохранить себе в заметки.' : 'Текст выделен — скопируйте его вручную.';
          },
        }, icon('copy'), 'Сохранить себе'),
      ),
      status,
    );
    watchField(paper);
  };
  start();
  return () => clearTimeout(timer);
}

/** Static, trusted markup — never visitor text. */
function envelopeArt() {
  const holder = h('div', { 'aria-hidden': 'true' });
  holder.innerHTML = ENVELOPE;
  return holder;
}
