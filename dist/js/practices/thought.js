// «Разобрать тревожную мысль»: situation → thought → feeling → a fairer look.
// From the bot's CBT flow. When the feeling is unbearable, the wizard stops and
// offers a person instead of an exercise.
import { h, icon } from '../core/dom.js';
import { openSheet } from '../core/sheets.js';
import { watchField } from '../core/safety.js';
import { copyText } from '../core/share.js';
import { detectTrap, CONTEXTS, EMOTIONS } from '../content/thinking.js';
import { chips, nav, status as statusLine } from './ui.js';

export const title = 'Разобрать тревожную мысль';

const STRENGTH = ['еле заметно', 'еле заметно', 'ощутимо', 'ощутимо', 'сильно', 'сильно', 'очень сильно', 'очень сильно', 'невыносимо', 'невыносимо'];

function meter(label, value, onChange) {
  const output = h('span', { class: 't-meter__value' }, STRENGTH[value - 1]);
  const input = h('input', { type: 'range', min: '1', max: '10', step: '1', value: String(value), 'aria-label': label, 'aria-valuetext': STRENGTH[value - 1] });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    output.textContent = STRENGTH[v - 1];
    input.setAttribute('aria-valuetext', STRENGTH[v - 1]);
    onChange(v);
  });
  return h('div', { class: 't-meter' }, output, input, h('div', { class: 't-meter__labels', 'aria-hidden': 'true' }, h('span', {}, 'еле заметно'), h('span', {}, 'невыносимо')));
}

function field(value, placeholder, label, rows = 3) {
  const area = h('textarea', { class: 'textarea', rows: String(rows), maxlength: '600', placeholder, 'aria-label': label, 'data-autofocus': '' });
  area.value = value;
  watchField(area);
  return area;
}

export function render(body, api) {
  const s = { situation: '', thought: '', emotion: '', before: 6, alt: '', after: 6 };
  const trap = () => detectTrap(s.thought);

  const one = () => {
    api.setProgress('Шаг 1 из 4 · ситуация');
    const area = field(s.situation, 'Например: вечер, малыш долго не засыпал, муж задерживался', 'Ситуация');
    area.addEventListener('input', () => { s.situation = area.value; });
    const quick = h('div', { class: 'chips-row' }, CONTEXTS.map((context) => h('button', {
      class: 'chip chip--small', type: 'button',
      onclick: () => { area.value = area.value.trim() ? `${area.value.trim()}, ${context}` : context[0].toUpperCase() + context.slice(1); s.situation = area.value; area.focus(); },
    }, context)));
    const note = statusLine();
    api.show(
      h('p', { class: 'p-lead' }, 'Это не тест и не диагноз — просто способ посмотреть на мысль чуть со стороны. Всё остаётся в этом окне.'),
      h('div', { class: 't-step' },
        h('p', { class: 't-q' }, 'Что происходило, когда стало тяжело?'),
        h('p', { class: 't-hint' }, 'Коротко: где вы были, что случилось, кто был рядом.'),
        quick, area, note,
      ),
      nav({ next: () => { if (!s.situation.trim()) { note.textContent = 'Можно парой слов — как получится.'; area.focus(); return; } two(); } }),
    );
  };

  const two = () => {
    api.setProgress('Шаг 2 из 4 · мысль');
    const area = field(s.thought, 'Например: «Я плохая мать, раз не могу его успокоить»', 'Мысль');
    const hint = h('div', { class: 't-detect', hidden: true, 'aria-live': 'polite' });
    const update = () => {
      s.thought = area.value;
      const found = trap();
      hint.hidden = !found;
      if (found) hint.replaceChildren(icon('cloud'), h('p', {}, 'Похоже на ловушку ', h('b', {}, `«${found.name}»`), ` — ${found.how.toLowerCase()} Это не диагноз, просто привычный поворот мысли.`));
    };
    area.addEventListener('input', update);
    const note = statusLine();
    api.show(
      h('div', { class: 't-step' },
        h('p', { class: 't-q' }, 'Какая мысль промелькнула в тот момент?'),
        h('p', { class: 't-hint' }, 'Первая, какая пришла. Как будто её сказали вслух.'),
        area, hint, note,
      ),
      nav({ back: one, next: () => { if (!s.thought.trim()) { note.textContent = 'Напишите мысль хотя бы коротко — с ней и будем работать.'; area.focus(); return; } three(); } }),
    );
    update();
  };

  const three = () => {
    api.setProgress('Шаг 3 из 4 · чувство');
    const emotions = chips(EMOTIONS, { label: 'Чувство', onChange: ([value]) => { s.emotion = value || ''; } });
    if (s.emotion) emotions.set([s.emotion]);
    api.show(
      h('div', { class: 't-step' },
        h('p', { class: 't-q', 'data-autofocus': '', tabindex: '-1' }, 'Что вы почувствовали?'),
        emotions.node,
        h('p', { class: 'p-label' }, 'Насколько сильно?'),
        meter('Сила чувства', s.before, (v) => { s.before = v; }),
      ),
      nav({ back: two, next: () => (s.before >= 9 ? safety() : four()) }),
    );
  };

  const safety = () => {
    api.setProgress('Пауза');
    api.show(
      h('div', { class: 't-safety' },
        h('p', { class: 't-q', 'data-autofocus': '', tabindex: '-1' }, 'Сейчас чувство очень сильное.'),
        h('p', {}, 'В таком состоянии лучше не разбираться в одиночку. Можно сначала немного успокоить тело — или поговорить с живым человеком.'),
        h('div', { class: 'p-row' },
          h('button', { class: 'btn btn--primary btn--small', type: 'button', onclick: () => api.open('breath') }, icon('wave'), 'Подышать минуту'),
          h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: (event) => openSheet('sheet-help', { opener: event.currentTarget }) }, icon('lifebuoy'), 'Номера помощи'),
          h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => api.write('очень сильные чувства, разобрать мысль вместе') }, 'Записаться к Ирине'),
        ),
        h('button', { class: 'link', type: 'button', onclick: four }, 'Всё равно продолжить разбор'),
      ),
    );
  };

  const four = () => {
    api.setProgress('Шаг 4 из 4 · взгляд со стороны');
    const found = trap();
    const area = field(s.alt, 'Например: «Мне сейчас очень трудно, и я всё равно стараюсь»', 'Мысль справедливее', 3);
    area.removeAttribute('data-autofocus');
    area.addEventListener('input', () => { s.alt = area.value; });
    const questions = [
      'Что говорит о том, что эта мысль не совсем верна?',
      'Что бы вы сказали подруге, если бы она так подумала о себе?',
      found ? found.question : 'Если посмотреть на ситуацию через неделю — как она будет выглядеть?',
    ];
    api.show(
      h('div', { class: 't-step' },
        h('p', { class: 't-cloud', 'data-cap': 'Мысль', 'data-autofocus': '', tabindex: '-1' }, s.thought),
        h('ol', { class: 't-questions', role: 'list' }, questions.map((q) => h('li', {}, q))),
        h('p', { class: 't-q' }, 'Как бы эта мысль звучала справедливее?'),
        h('p', { class: 't-hint' }, 'Не обязательно позитивнее — просто честнее и бережнее к себе.'),
        area,
        h('p', { class: 'p-label' }, 'Насколько сильное чувство сейчас?'),
        meter('Сила чувства сейчас', s.after, (v) => { s.after = v; }),
      ),
      nav({ back: three, next: result, nextLabel: 'Показать итог' }),
    );
  };

  const result = () => {
    const found = trap();
    const diff = s.after - s.before;
    const comment = diff < 0
      ? 'Чувство стало чуть тише. Это заметная перемена.'
      : diff === 0
        ? 'Сила чувства не изменилась — так тоже бывает. Это не значит, что вы что-то сделали не так.'
        : 'Стало тяжелее. Такие мысли лучше разбирать вместе со специалистом — не оставайтесь с этим одна.';
    const row = (label, value, cls) => (value ? h('div', { class: cls || null }, h('dt', {}, label), h('dd', {}, value)) : null);
    const summary = h('dl', { class: 't-result' },
      row('Ситуация', s.situation),
      row('Мысль', s.thought),
      row('Чувство', [s.emotion, STRENGTH[s.before - 1]].filter(Boolean).join(', ')),
      found ? row('Похоже на ловушку', found.name) : null,
      row('Взгляд справедливее', s.alt.trim(), 't-result__new'),
    );
    const bars = h('div', { class: 't-bars', 'aria-hidden': 'true' },
      h('div', { class: 't-bar' }, h('span'), h('small', {}, 'было')),
      h('div', { class: 't-bar t-bar--after' }, h('span'), h('small', {}, 'стало')),
    );
    bars.querySelectorAll('span').forEach((bar, i) => bar.style.setProperty('--v', String(i === 0 ? s.before : s.after)));
    const status = statusLine();
    const asText = () => [
      'Мой разбор мысли',
      `Ситуация: ${s.situation}`,
      `Мысль: ${s.thought}`,
      `Чувство: ${[s.emotion, STRENGTH[s.before - 1]].filter(Boolean).join(', ')} → ${STRENGTH[s.after - 1]}`,
      found ? `Похоже на ловушку: ${found.name}` : '',
      s.alt.trim() ? `Взгляд справедливее: ${s.alt.trim()}` : '',
    ].filter(Boolean).join('\n');
    api.done({
      phrase: comment,
      extra: h('div', { class: 't-step' },
        bars, summary,
        h('div', { class: 'p-row' },
          h('button', {
            class: 'btn btn--ghost btn--small', type: 'button',
            onclick: async () => { const ok = await copyText(asText()); status.textContent = ok ? 'Разбор скопирован — его можно взять с собой на консультацию.' : 'Не получилось скопировать.'; },
          }, icon('copy'), 'Скопировать разбор'),
        ),
        status,
      ),
      again: () => { Object.assign(s, { situation: '', thought: '', emotion: '', before: 6, alt: '', after: 6 }); one(); },
    });
  };

  one();
}
