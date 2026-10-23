// A gentle, local check of free text for words of acute danger (from the bot's
// detector). It never blocks, never sends anything; it only offers help nearby.
import { h, icon } from './dom.js';
import { prefs } from './prefs.js';
import { openSheet } from './sheets.js';

const CRISIS = [
  'суицид', 'убить себя', 'убью себя', 'не хочу жить', 'не хочу больше жить', 'не хочется жить', 'жить не хочется',
  'не вижу смысла жить', 'нет смысла жить', 'покончить с собой', 'покончить с жизнью', 'свести сч[её]ты с жизнью',
  'наложить на себя руки', 'руки на себя наложить', 'вскрыть вены', 'порезать вены', 'резать вены', 'повеситься',
  'спрыгнуть с крыши', 'спрыгнуть с моста', 'выпрыгнуть из окна', 'шагнуть из окна', 'наглотаться таблеток', 'выпить все таблетки',
  'выпить всю упаковку', 'горсть таблеток', 'конец всему', 'хочу умереть', 'хочется умереть', 'лучше бы я умерла',
  'лучше бы меня не было', 'всем будет лучше без меня', 'никому не нужна',
  'меня бь[её]т', 'бь[её]т меня', 'муж бь[её]т', 'меня бьют', 'поднимает на меня руку', 'избивает', 'изнасиловани', 'изнасиловал',
  'навредить ребенку', 'навредить ребёнку', 'причинить вред ребенку', 'причинить вред ребёнку', 'навредить малышу',
];
const PATTERN = new RegExp(`(^|[^а-яё])(${CRISIS.join('|')})`, 'i');

export function hasCrisisWords(text) {
  return PATTERN.test(String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')) ||
    PATTERN.test(String(text || '').toLowerCase().replace(/\s+/g, ' '));
}

function hintCard() {
  return h('div', { class: 'crisis-hint', role: 'note' },
    icon('lifebuoy', 'crisis-hint__icon'),
    h('div', {},
      h('p', { class: 'crisis-hint__title' }, 'Похоже, сейчас очень тяжело.'),
      h('p', {}, 'Твой текст остаётся только здесь. Если тебе или кому-то рядом опасно прямо сейчас — позвони 112. Можно открыть номера помощи и выбрать, кому позвонить.'),
      h('button', { type: 'button', class: 'btn btn--small btn--soft', onclick: (event) => openSheet('sheet-help', { opener: event.currentTarget }) }, 'Номера помощи'),
    ),
  );
}

/**
 * Watch a textarea/input. Shows the hint once below `anchor` (defaults to the field)
 * when crisis words appear; hides it if the text no longer contains them.
 */
export function watchField(field, anchor = field) {
  if (!field) return;
  let card = null;
  let timer = 0;
  const check = () => {
    const found = hasCrisisWords(field.value);
    if (found && !card) {
      card = hintCard();
      anchor.insertAdjacentElement('afterend', card);
      prefs.enterQuiet('crisis');
    } else if (!found && card) {
      card.remove();
      card = null;
    }
  };
  field.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(check, 450); });
  field.addEventListener('blur', check);
}
