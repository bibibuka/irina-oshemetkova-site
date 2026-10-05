// «Колода опор»: pull a card, flip it, keep it as a picture.
import { h, icon, announce } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { pick } from '../core/phrases.js';
import { renderCard, fileFromBlob, shareOrDownload, copyText } from '../core/share.js';
import { DECK, ALL_DECK } from '../content/voice.js';
import { status as statusLine } from './ui.js';

export const title = 'Колода опор';

export function render(body, api) {
  let category = 'all';
  let phrase = '';
  let file = null;
  let flipTimer = 0;
  const status = statusLine();
  const phraseEl = h('p', { class: 'deck__phrase' });
  const card = h('div', { class: 'deck__card' },
    h('div', { class: 'deck__inner' },
      h('div', { class: 'deck__face deck__front', 'aria-hidden': 'true' }, h('div', {}, icon('flower'), h('p', {}, 'Вытяните карту'))),
      h('div', { class: 'deck__face deck__back' }, h('div', {}, icon('flower', 'deck__flower')), phraseEl),
    ),
  );
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const pool = () => (category === 'all' ? ALL_DECK : DECK[category].phrases);

  const prepare = async () => {
    file = null;
    try {
      const blob = await renderCard({ text: phrase, caption: 'Колода опор', footer: 'Ирина Ошемёткова · перинатальный психолог', theme: prefs.isNight ? 'night' : 'peach' });
      if (blob) file = fileFromBlob(blob, 'opora.png');
    } catch { file = null; }
  };

  const draw = () => {
    const next = pick(pool(), `deck-${category}`);
    const reveal = () => {
      phrase = next;
      phraseEl.textContent = next;
      card.classList.add('is-flipped');
      live.textContent = next;
      drawBtn.replaceChildren(icon('shuffle'), 'Ещё одну');
      actions.hidden = false;
      status.textContent = '';
      prepare();
    };
    if (card.classList.contains('is-flipped') && !prefs.reducedMotion) {
      card.classList.remove('is-flipped');
      clearTimeout(flipTimer);
      flipTimer = setTimeout(reveal, 420);
    } else reveal();
  };

  const drawBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: draw }, icon('cards'), 'Вытянуть карту');
  const actions = h('div', { class: 'deck__actions', hidden: true },
    h('button', {
      class: 'btn btn--ghost btn--small', type: 'button',
      onclick: async () => {
        if (!file) await prepare();
        if (!file) { status.textContent = 'Не получилось сделать картинку в этом браузере.'; return; }
        const result = await shareOrDownload(file, 'Колода опор');
        status.textContent = result === 'downloaded' ? 'Картинка сохранена в загрузки.' : result === 'shared' ? 'Готово.' : '';
      },
    }, icon('image'), 'Сохранить картинкой'),
    h('button', {
      class: 'btn btn--ghost btn--small', type: 'button',
      onclick: async () => { const ok = await copyText(phrase); status.textContent = ok ? 'Фраза скопирована.' : 'Не получилось скопировать.'; announce(status.textContent); },
    }, icon('copy'), 'Скопировать'),
  );

  const cats = h('div', { class: 'deck__cats', role: 'group', aria: { label: 'Про что карта' } },
    [['all', 'Любая'], ...Object.entries(DECK).map(([key, group]) => [key, group.label])].map(([key, label]) => h('button', {
      class: 'chip chip--small', type: 'button', aria: { pressed: String(key === 'all') }, dataset: { cat: key },
      onclick: (event) => {
        category = key;
        cats.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button === event.currentTarget)));
        if (DECK[key]?.quiet) prefs.enterQuiet('deck-loss');
        draw();
      },
    }, label)),
  );

  api.show(
    h('p', { class: 'p-lead', 'data-autofocus': '', tabindex: '-1' }, 'Короткие фразы, на которые можно опереться, когда своих слов не хватает. Выберите, про что сейчас, — или просто вытяните карту.'),
    h('div', { class: 'deck' }, cats, card, live, drawBtn, actions, status),
    api.cta('Хочется больше опоры, чем одна фраза?', 'На консультации мы найдём, что поддерживает именно вас, — и как возвращаться к этому в трудные дни.'),
  );
  return () => clearTimeout(flipTimer);
}
