// «Карманная версия» — the phone mock-up: the bot's replies appear one by one, once,
// when the phone comes into view. A visible button stops the animation (WCAG 2.2.2).
import { $, $$ } from '../core/dom.js';
import { prefs } from '../core/prefs.js';

const GREETING = {
  morning: 'Доброе утро 🌿 Как ты этим утром?',
  day: 'Добрый день 🌿 Как идёт твой день?',
  evening: 'Добрый вечер 🌿 Как ты к вечеру?',
  night: 'Доброй ночи 🌿 Как проходит твоя ночь?',
};

export function init() {
  const phone = $('[data-bot-demo]');
  if (!phone) return;
  const greeting = $('[data-bot-greeting]', phone);
  const setGreeting = () => { if (greeting) greeting.textContent = GREETING[prefs.part] || GREETING.day; };
  setGreeting();
  document.addEventListener('prefs:apply', setGreeting);

  const bubbles = $$('.phone__chat > li', phone);
  const pause = $('[data-bot-pause]', phone);
  if (prefs.reducedMotion || prefs.quiet || !('IntersectionObserver' in window)) return;
  let timers = [];
  const showAll = () => {
    timers.forEach(clearTimeout);
    timers = [];
    bubbles.forEach((bubble) => bubble.classList.remove('is-waiting'));
    if (pause) pause.hidden = true;
  };
  bubbles.forEach((bubble) => bubble.classList.add('is-waiting'));
  phone.classList.add('is-animated');
  pause?.addEventListener('click', showAll);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    io.disconnect();
    if (pause) pause.hidden = false;
    bubbles.forEach((bubble, index) => {
      timers.push(setTimeout(() => {
        bubble.classList.remove('is-waiting');
        if (index === bubbles.length - 1 && pause) pause.hidden = true;
      }, 500 + index * 1600));
    });
  }, { threshold: 0.4 });
  io.observe(phone);
}
