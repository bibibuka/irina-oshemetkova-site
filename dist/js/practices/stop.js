// «Экстренная остановка»: five big steps, one per screen (from the bot's first-aid plan
// for acute exhaustion after birth). Dark, quiet, no celebration.
import { h, icon } from '../core/dom.js';
import { openSheet } from '../core/sheets.js';
import { copyText, shareText } from '../core/share.js';
import { status as statusLine } from './ui.js';

export const title = 'Экстренная остановка';
export const dark = true;
export const quiet = true;

const MESSAGE = 'Мне плохо. Я не справляюсь. Пожалуйста, приезжай как можно скорее и побудь с малышом пару часов.';

export function render(body, api) {
  let breathTimer = 0;
  let index = 0;

  /** Inhale 3 — exhale 6, counted down once a second (the circle follows in CSS). */
  const miniBreath = () => {
    const text = h('p', { class: 'mini-breath__text' }, 'Вдох… 3');
    let t = 0;
    clearInterval(breathTimer);
    breathTimer = setInterval(() => {
      t = (t + 1) % 9;
      text.textContent = t < 3 ? `Вдох… ${3 - t}` : `Выдох… ${9 - t}`;
    }, 1000);
    return h('div', { class: 'mini-breath' }, h('div', { class: 'mini-breath__circle', 'aria-hidden': 'true' }), text);
  };

  const status = statusLine();
  const steps = [
    () => [
      h('h3', {}, 'Малыш в безопасности.'),
      h('p', {}, 'Если чувствуете, что теряете контроль, положите малыша в кроватку на спину, без лишних предметов рядом, и выйдите из комнаты на несколько минут. Так можно. Это безопаснее, чем оставаться рядом, когда накрывает.'),
    ],
    () => [
      h('h3', {}, 'Прохладная вода.'),
      h('p', {}, 'Умойте лицо прохладной водой или подержите руки под струёй. Выпейте стакан воды медленными глотками.'),
    ],
    () => [
      h('h3', {}, 'Пол под вами.'),
      h('p', {}, 'Сядьте на пол, обопритесь спиной. Вдох на 3 — медленный выдох на 6, сквозь сомкнутые губы.'),
      miniBreath(),
    ],
    () => [
      h('h3', {}, 'Позовите своего человека.'),
      h('p', {}, 'Партнёра, маму, подругу. Можно отправить готовое сообщение:'),
      h('p', { class: 'stop-step__message' }, MESSAGE),
      h('div', { class: 'stop-step__actions' },
        h('button', { class: 'btn btn--light', type: 'button', onclick: async () => { const ok = await copyText(MESSAGE); status.textContent = ok ? 'Скопировано. Вставьте в сообщение.' : 'Не получилось скопировать.'; } }, icon('copy'), 'Скопировать'),
        h('a', { class: 'btn btn--on-band', href: `https://t.me/share/url?url=%20&text=${encodeURIComponent(MESSAGE)}`, target: '_blank', rel: 'noopener noreferrer' }, icon('telegram'), 'В Telegram'),
        h('a', { class: 'btn btn--on-band', href: `sms:?&body=${encodeURIComponent(MESSAGE)}` }, icon('sms'), 'SMS'),
        typeof navigator.share === 'function' ? h('button', { class: 'btn btn--on-band', type: 'button', onclick: () => shareText({ text: MESSAGE }) }, icon('share'), 'Ещё куда-то') : null,
      ),
      status,
    ],
    () => [
      h('h3', {}, 'Если рядом никого.'),
      h('p', {}, 'Позвоните на линию помощи — там ответят сейчас.'),
      h('div', { class: 'stop-step__actions' },
        h('a', { class: 'btn btn--light', href: 'tel:88002000122' }, icon('phone'), '8-800-2000-122'),
        h('button', { class: 'btn btn--on-band', type: 'button', onclick: (event) => openSheet('sheet-help', { opener: event.currentTarget }) }, 'Все номера'),
      ),
      h('p', {}, 'Если есть мысли навредить себе или малышу — звоните ', h('a', { href: 'tel:112' }, '112'), ' прямо сейчас.'),
    ],
  ];

  const after = () => {
    clearInterval(breathTimer);
    api.setProgress('Когда станет тише');
    api.show(
      h('section', { class: 'stop-step' },
        h('h3', { 'data-autofocus': '', tabindex: '-1' }, 'Когда станет тише.'),
        h('p', {}, 'Срыв — не приговор и не характеристика вас как мамы. Это сигнал, что сил осталось слишком мало и нагрузку важно делить. Если хочется, можно сказать малышу: «Мама очень устала и испугалась, но сейчас всё хорошо. Я люблю тебя».'),
      ),
      api.cta(),
      h('div', { class: 'stop__nav' },
        h('button', { class: 'btn btn--on-band', type: 'button', onclick: () => show(steps.length - 1) }, icon('arrow-left'), 'Назад'),
        h('button', { class: 'btn btn--light', type: 'button', onclick: () => api.write('как разделить нагрузку, когда сил совсем мало') }, 'Обсудить с Ириной'),
      ),
    );
  };

  const show = (i) => {
    index = i;
    clearInterval(breathTimer);
    status.textContent = '';
    api.setProgress(`Шаг ${index + 1} из ${steps.length}`);
    const [heading, ...rest] = steps[index]();
    heading.setAttribute('data-autofocus', '');
    heading.setAttribute('tabindex', '-1');
    api.show(
      h('div', { class: 'stop' },
        h('div', { class: 'stop__dots', 'aria-hidden': 'true' }, steps.map((_, n) => h('span', { class: n <= index ? 'is-on' : null }))),
        h('section', { class: 'stop-step' }, h('span', { class: 'stop-step__num', 'aria-hidden': 'true' }, String(index + 1)), heading, ...rest),
        h('div', { class: 'stop__nav' },
          index > 0 ? h('button', { class: 'btn btn--on-band', type: 'button', onclick: () => show(index - 1) }, icon('arrow-left'), 'Назад') : h('span'),
          h('button', { class: 'btn btn--light', type: 'button', onclick: () => (index < steps.length - 1 ? show(index + 1) : after()) }, 'Дальше', icon('arrow', 'icon-arrow')),
        ),
      ),
    );
  };

  show(0);
  return () => clearInterval(breathTimer);
}
