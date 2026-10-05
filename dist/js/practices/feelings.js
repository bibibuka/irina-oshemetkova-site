// «Контакт с чувствами»: three short steps for tiredness and burnout.
import { h } from '../core/dom.js';
import { watchField } from '../core/safety.js';
import { chips, nav } from './ui.js';

export const title = 'Контакт с чувствами';

const PLACES = ['голова', 'горло', 'плечи', 'грудь', 'живот', 'спина', 'руки', 'ноги', 'не могу понять'];
const PAIRS = [['тёплое', 'прохладное'], ['сжатое', 'разлитое'], ['тяжёлое', 'лёгкое']];
const VOICES = ['«я устала»', '«мне тревожно»', '«мне нужен отдых»', '«мне одиноко»', '«побудь со мной»'];

export function render(body, api) {
  const notes = { place: [], sense: [], voice: [], own: '' };

  const one = () => {
    api.setProgress('Шаг 1 из 3');
    const places = chips(PLACES, { multiple: true, label: 'Где в теле', onChange: (values) => { notes.place = values; } });
    places.set(notes.place);
    api.show(
      h('div', { class: 'p-panel' },
        h('p', { class: 'p-big', 'data-autofocus': '', tabindex: '-1' }, 'Устройтесь удобно, можно закрыть глаза на минутку. Где в теле вы сейчас что-то чувствуете?'),
        h('p', { class: 'p-note' }, 'Напряжение, тепло, тяжесть — что угодно. Просто найдите это место. Отмечать необязательно.'),
        places.node,
      ),
      nav({ next: two }),
    );
  };

  const two = () => {
    api.setProgress('Шаг 2 из 3');
    const rows = PAIRS.map((pair) => {
      const group = chips(pair, { label: pair.join(' или '), onChange: () => { notes.sense = groups.flatMap((g) => g.values()); } });
      group.set(notes.sense);
      return group;
    });
    const groups = rows;
    api.show(
      h('div', { class: 'p-panel' },
        h('p', { class: 'p-big', 'data-autofocus': '', tabindex: '-1' }, 'Положите ладонь на это место, если дотягиваетесь. Какое это ощущение?'),
        h('p', { class: 'p-note' }, 'Побудьте с ним несколько секунд, ничего не меняя.'),
        h('div', { class: 'pair-chips' }, rows.map((row) => h('div', { class: 'pair-chips__row' }, row.node))),
      ),
      nav({ back: one, next: three }),
    );
  };

  const three = () => {
    api.setProgress('Шаг 3 из 3');
    const voices = chips(VOICES, { multiple: true, label: 'Что оно говорит', onChange: (values) => { notes.voice = values; } });
    voices.set(notes.voice);
    const own = h('textarea', { class: 'textarea', rows: '2', maxlength: '300', placeholder: 'Или своими словами', 'aria-label': 'Что говорит ощущение — своими словами' });
    own.value = notes.own;
    own.addEventListener('input', () => { notes.own = own.value; });
    watchField(own);
    api.show(
      h('div', { class: 'p-panel' },
        h('p', { class: 'p-big', 'data-autofocus': '', tabindex: '-1' }, 'Если бы это ощущение могло говорить, что бы оно сказало?'),
        h('p', { class: 'p-note' }, 'Не торопитесь, послушайте.'),
        voices.node, own,
      ),
      nav({ back: two, next: finish, nextLabel: 'Готово' }),
    );
  };

  const finish = () => {
    const parts = [];
    if (notes.place.length) parts.push(`где: ${notes.place.join(', ')}`);
    if (notes.sense.length) parts.push(`какое: ${notes.sense.join(', ')}`);
    const said = [...notes.voice, notes.own.trim() && `«${notes.own.trim()}»`].filter(Boolean);
    if (said.length) parts.push(`говорит: ${said.join(', ')}`);
    api.done({
      phrase: 'Вы только что сделали важное — услышали себя.',
      extra: parts.length ? h('p', { class: 'p-note' }, `Что вы заметили — ${parts.join('; ')}. Это видно только вам и исчезнет, когда вы закроете страницу.`) : null,
      again: () => { notes.place = []; notes.sense = []; notes.voice = []; notes.own = ''; one(); },
    });
  };

  one();
}
