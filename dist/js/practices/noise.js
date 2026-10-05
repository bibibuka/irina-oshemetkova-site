// «Шум для сна»: noise generated right here as a WAV loop and played through <audio>,
// so it keeps playing with the screen locked. It keeps playing after the room is closed;
// the card on the page shows that it is on.
import { h, icon, announce } from '../core/dom.js';
import { seg, status as statusLine } from './ui.js';

export const title = 'Шум для сна';

const TYPES = { pink: 'Мягкий', white: 'Ровный', brown: 'Глубокий' };
const TIMERS = { '15': '15 минут', '30': '30 минут', '60': '1 час', '0': 'Пока не выключу' };
const LEVELS = { '0.35': 'Тише', '0.6': 'Средне', '0.9': 'Громче' };

const player = { audio: null, url: '', type: 'pink', timer: '30', level: '0.35', endsAt: 0, stopTimer: 0, fadeTimer: 0, listeners: new Set() };

/** Seamless loop: render a little more than needed and cross-fade the tail into the head. */
function makeWav(type, seconds = 12, rate = 22050) {
  const length = seconds * rate;
  const fade = Math.floor(rate * 0.6);
  const raw = new Float32Array(length + fade);
  let last = 0; let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * white) / 1.02; raw[i] = last * 3.2; }
    else if (type === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759; b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856; b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.1; b6 = white * 0.115926;
    } else raw[i] = white * 0.32;
  }
  for (let i = 0; i < fade; i += 1) { const k = i / fade; raw[i] = raw[i] * k + raw[length + i] * (1 - k); }
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i += 1) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, raw[i])) * 0x7fff, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

function emit() { player.listeners.forEach((fn) => fn()); syncCard(); }
const playing = () => Boolean(player.audio && !player.audio.paused);

function syncCard() {
  const label = document.querySelector('[data-practice-card="noise"] .pcard__open span');
  if (label) label.textContent = playing() ? 'Играет — открыть' : 'Включить';
}

function clearTimers() { clearTimeout(player.stopTimer); clearInterval(player.fadeTimer); player.endsAt = 0; }

function armTimer() {
  clearTimers();
  const minutes = Number(player.timer);
  if (!minutes) return;
  player.endsAt = Date.now() + minutes * 60000;
  player.stopTimer = setTimeout(() => stop(true), Math.max(0, minutes * 60000 - 20000));
}

function setSource() {
  if (player.url) URL.revokeObjectURL(player.url);
  player.url = URL.createObjectURL(makeWav(player.type));
  player.audio.src = player.url;
}

function play() {
  if (!player.audio) {
    player.audio = new Audio();
    player.audio.loop = true;
    player.audio.setAttribute('playsinline', '');
    player.audio.addEventListener('pause', emit);
    player.audio.addEventListener('play', emit);
  }
  clearInterval(player.fadeTimer);
  if (!player.audio.src) setSource();
  player.audio.volume = Number(player.level);
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: `Шум для сна · ${TYPES[player.type]}`, artist: 'Ирина Ошемёткова' }); } catch { /* optional */ }
    try { navigator.mediaSession.setActionHandler('pause', () => stop(false)); navigator.mediaSession.setActionHandler('play', play); } catch { /* optional */ }
  }
  armTimer();
  return player.audio.play().catch(() => { emit(); });
}

/** Stop now or fade out over ~20 seconds. */
function stop(fade = false) {
  if (!player.audio) return;
  clearTimers();
  if (!fade) { player.audio.pause(); emit(); return; }
  const start = player.audio.volume;
  let step = 0;
  player.fadeTimer = setInterval(() => {
    step += 1;
    player.audio.volume = Math.max(0, start * (1 - step / 40));
    if (step >= 40) { clearInterval(player.fadeTimer); player.audio.pause(); player.audio.volume = Number(player.level); emit(); }
  }, 500);
}

export function render(body, api) {
  const status = statusLine();
  status.classList.add('noise__status');
  const wrap = h('div', { class: 'noise' });
  const toggle = h('button', { class: 'btn btn--primary btn--large', type: 'button', onclick: () => (playing() ? stop(false) : play()) });
  const update = () => {
    wrap.classList.toggle('is-playing', playing());
    toggle.replaceChildren(icon(playing() ? 'pause' : 'play'), playing() ? 'Выключить' : 'Включить');
    if (playing()) {
      const left = player.endsAt ? Math.max(1, Math.round((player.endsAt - Date.now()) / 60000)) : 0;
      status.textContent = left ? `Играет · выключится сам примерно через ${left} мин, плавно` : 'Играет, пока вы не выключите';
    } else status.textContent = 'Выключено';
  };
  player.listeners.add(update);
  const refresh = setInterval(update, 30000);

  wrap.append(
    h('div', { class: 'noise__orb', 'aria-hidden': 'true' }),
    h('div', { class: 'noise__group' }, h('p', { class: 'p-label' }, 'Звук'), seg('Звук', Object.entries(TYPES).map(([value, label]) => ({ value, label })), player.type, (value) => {
      player.type = value;
      if (player.audio) { const was = playing(); setSource(); if (was) play(); }
      announce(`Звук: ${TYPES[value]}`);
    })),
    h('div', { class: 'noise__group' }, h('p', { class: 'p-label' }, 'Таймер'), seg('Таймер', Object.entries(TIMERS).map(([value, label]) => ({ value, label })), player.timer, (value) => { player.timer = value; if (playing()) armTimer(); update(); })),
    h('div', { class: 'noise__group' }, h('p', { class: 'p-label' }, 'Громкость'), seg('Громкость', Object.entries(LEVELS).map(([value, label]) => ({ value, label })), player.level, (value) => { player.level = value; if (player.audio) player.audio.volume = Number(value); })),
    toggle, status,
    h('p', { class: 'noise__safety' }, 'Поставьте телефон подальше от кроватки — метра на два — и делайте тише, чем кажется нужным. Экран можно заблокировать: шум продолжит играть. На iPhone громкость — кнопками телефона.'),
  );
  api.show(
    h('p', { class: 'p-lead', 'data-autofocus': '', tabindex: '-1' }, 'Ровный фоновый шум помогает многим — и малышам, и взрослым. Звук создаётся прямо в браузере, ничего не скачивается.'),
    wrap,
  );
  update();
  return () => { player.listeners.delete(update); clearInterval(refresh); };
}
