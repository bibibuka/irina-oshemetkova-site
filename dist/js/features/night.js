// «Ночник». By day it is a dark band after «Ирина»; from 22:00 to 6:00 it moves to the
// top as «Ночная смена» with human clocks («Начало четвёртого»). The sleep noise is
// generated in the browser as a WAV blob and played through <audio loop>, so it keeps
// playing with the screen locked and gets lock-screen controls (Media Session).
import { $, $$, h, focusQuietly } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction, runAction, goTo } from '../core/actions.js';
import { closeSheet, openSheets } from '../core/sheets.js';
import { now, humanTime, isNightLightHours } from '../core/time.js';

const TITLES = {
  default: ['Ночь. ', 'Не нужно решать всё сейчас.'],
  postpartum: ['Ночная смена? ', 'Ты не одна в ней.'],
  pregnancy: ['Не спится? ', 'Можно просто подышать.'],
  planning: ['Ночью мысли бывают громче. ', 'Их можно отложить до утра.'],
  loss: ['Тихой ночи. ', 'Здесь можно просто быть.'],
  close: ['Не спится? ', 'Здесь всё под рукой.'],
};
const NIGHT_LEAD = 'Сейчас я, скорее всего, сплю — поэтому заранее оставила здесь всё, что может пригодиться ночью. Читать ничего не нужно.';
const NOISE_NAMES = { white: 'Ровный шум', pink: 'Мягкий шум', brown: 'Глубокий шум', shh: 'Шшш' };

let el = {};
let preview = false;
let previousTheme = null;
const original = {};

/* ---------- Placement and texts ---------- */
function atTop() { return preview || (prefs.isNight && isNightLightHours()); }

function place() {
  const section = el.section;
  const main = $('#main');
  const irina = $('#irina');
  if (!section || !main) return;
  const top = atTop();
  if (top && section.nextElementSibling !== main) main.before(section);
  if (!top && irina && irina.nextElementSibling !== section) irina.after(section);
  section.classList.toggle('is-top', top);
  section.classList.toggle('is-band', !top);
  section.classList.add('is-placed');
  renderTexts(top);
}

function renderTexts(top) {
  const title = $('[data-night-title]', el.section);
  const lead = $('[data-night-lead]', el.section);
  if (title && lead) {
    if (top) {
      const [plain, accent] = TITLES[prefs.stage] || TITLES.default;
      title.replaceChildren(plain, h('em', {}, accent));
      lead.textContent = NIGHT_LEAD;
    } else {
      title.innerHTML = original.title;
      lead.textContent = original.lead;
    }
  }
  const loss = prefs.stage === 'loss';
  const hardTitle = $('[data-hard-title]', el.section);
  const hardSub = $('[data-hard-sub]', el.section);
  if (hardTitle) hardTitle.textContent = loss ? 'Если накрывает воспоминание' : 'Мне сейчас очень тяжело';
  if (hardSub) hardSub.textContent = loss ? 'вернуться в сегодня, тихо' : 'пять шагов, чтобы переждать';
  const noiseTile = $('[data-noise-tile]', el.section);
  if (noiseTile) noiseTile.textContent = prefs.quiet ? 'Тихий шум для сна' : prefs.stage === 'postpartum' ? 'Шум для малыша' : 'Шум для сна';
  const previewButton = $('[data-night-preview]', el.section);
  if (previewButton) previewButton.textContent = preview ? 'Вернуть дневной вид' : 'Посмотреть, как это выглядит ночью';
}

function renderClock() {
  const date = now();
  const time = $('[data-human-time]', el.section);
  const line = $('[data-clock-line]', el.section);
  if (time) time.textContent = humanTime(date);
  if (line) {
    const hm = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const day = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    line.textContent = `${hm} · ${day}`;
  }
}

function startClock() {
  renderClock();
  const msToMinute = 60000 - (Date.now() % 60000) + 50;
  setTimeout(() => { renderClock(); setInterval(renderClock, 60000); }, msToMinute);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderClock(); });
}

/* ---------- Noise: generated WAV ---------- */
const SAMPLE_RATE = 22050;
const SECONDS = 24;
const FADE = 1.5;

function generate(type, level) {
  const length = SAMPLE_RATE * SECONDS;
  const data = new Float32Array(length);
  let last = 0; let lp = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  // band-pass state for «шшш»
  let bp1 = 0; let bp2 = 0;
  const pinkSample = (white) => {
    b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852; b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
    const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    return out;
  };
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    let sample;
    if (type === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      sample = last * 3.5;
      lp += 0.35 * (sample - lp);
      sample = lp;
    } else if (type === 'pink') {
      sample = pinkSample(white);
    } else if (type === 'shh') {
      const pink = pinkSample(white);
      // crude band-pass around 3 kHz: high-pass then low-pass one-pole filters
      bp1 += 0.6 * (pink - bp1);
      const high = pink - bp1;
      bp2 += 0.55 * (high - bp2);
      const t = i / SAMPLE_RATE;
      const envelope = 0.35 + 0.65 * Math.sin((Math.PI * t) / 2.2) ** 2;
      sample = bp2 * 3.2 * envelope;
    } else {
      lp += 0.7 * (white - lp);
      sample = lp * 0.5;
    }
    data[i] = sample;
  }
  // seamless loop: crossfade the tail into the head
  const fade = Math.floor(SAMPLE_RATE * FADE);
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    data[i] = data[i] * k + data[length - fade + i] * (1 - k);
  }
  const usable = length - fade;
  const gain = 0.5 * level;
  const buffer = new ArrayBuffer(44 + usable * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + usable * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, usable * 2, true);
  for (let i = 0; i < usable; i += 1) {
    const v = Math.max(-1, Math.min(1, data[i] * gain));
    view.setInt16(44 + i * 2, v * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const noise = { type: 'pink', minutes: 30, level: 0.35, audio: null, url: '', deadline: 0, ticker: 0, title: document.title };

function noiseStatus() {
  const status = $('[data-noise-status]', el.section);
  if (!status) return;
  if (!noise.audio || noise.audio.paused) { status.textContent = ''; document.title = noise.title; return; }
  const name = NOISE_NAMES[noise.type];
  if (!noise.deadline) { status.textContent = `${name} — пока не выключишь.`; document.title = `◐ ${name} · ${noise.title}`; return; }
  const left = Math.max(0, Math.ceil((noise.deadline - Date.now()) / 60000));
  status.textContent = `${name} · ещё ${left} мин. Перед концом звук плавно затихнет.`;
  document.title = `◐ ${name} · ещё ${left} мин`;
}

function setToggle(playing) {
  const toggle = $('[data-noise-toggle]', el.section);
  if (!toggle) return;
  $('span', toggle).textContent = playing ? 'Выключить' : 'Включить';
  $('use', toggle)?.setAttribute('href', playing ? '#i-pause' : '#i-play');
  toggle.setAttribute('aria-pressed', String(playing));
  $('[data-noise]', el.section)?.classList.toggle('is-playing', playing);
}

function load() {
  const wasPlaying = noise.audio && !noise.audio.paused;
  const blob = generate(noise.type, noise.level);
  const url = URL.createObjectURL(blob);
  if (!noise.audio) {
    noise.audio = new Audio();
    noise.audio.loop = true;
    noise.audio.setAttribute('playsinline', '');
    noise.audio.addEventListener('pause', () => { setToggle(false); noiseStatus(); });
    noise.audio.addEventListener('play', () => { setToggle(true); noiseStatus(); });
  }
  const previous = noise.url;
  noise.url = url;
  noise.audio.src = url;
  noise.audio.volume = 1;
  if (previous) setTimeout(() => URL.revokeObjectURL(previous), 2000);
  return wasPlaying;
}

function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: NOISE_NAMES[noise.type], artist: 'Ночник', artwork: [{ src: 'assets/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] });
    navigator.mediaSession.setActionHandler('play', () => noise.audio?.play());
    navigator.mediaSession.setActionHandler('pause', () => noise.audio?.pause());
    navigator.mediaSession.setActionHandler('stop', () => stopNoise());
  } catch { /* partial support */ }
}

function tick() {
  if (!noise.audio || noise.audio.paused) return;
  if (noise.deadline) {
    const left = noise.deadline - Date.now();
    if (left <= 0) { stopNoise(); return; }
    // the last two minutes fade out (iOS ignores volume: there it simply stops at the end)
    noise.audio.volume = left < 120000 ? Math.max(0.05, left / 120000) : 1;
  }
  noiseStatus();
}

function startNoise() {
  if (prefs.quiet && noise.type === 'shh') setType('pink');
  load();
  noise.deadline = noise.minutes ? Date.now() + noise.minutes * 60000 : 0;
  const playing = noise.audio.play();
  playing?.catch?.(() => { const status = $('[data-noise-status]', el.section); if (status) status.textContent = 'Браузер не дал включить звук. Попробуй нажать ещё раз.'; });
  mediaSession();
  clearInterval(noise.ticker);
  noise.ticker = setInterval(tick, 1000);
  noiseStatus();
}

function stopNoise() {
  clearInterval(noise.ticker);
  if (noise.audio) { noise.audio.pause(); noise.audio.currentTime = 0; }
  noise.deadline = 0;
  setToggle(false);
  noiseStatus();
}

function setType(type) {
  noise.type = type;
  $$('[data-noise-type]', el.section).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.noiseType === type)));
}

function bindNoise() {
  $$('[data-noise-type]', el.section).forEach((button) => button.addEventListener('click', () => {
    setType(button.dataset.noiseType);
    if (noise.audio && !noise.audio.paused) { load(); noise.audio.play(); mediaSession(); }
    remember();
  }));
  $$('[data-noise-timer]', el.section).forEach((button) => button.addEventListener('click', () => {
    noise.minutes = Number(button.dataset.noiseTimer);
    $$('[data-noise-timer]', el.section).forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    if (noise.audio && !noise.audio.paused) { noise.deadline = noise.minutes ? Date.now() + noise.minutes * 60000 : 0; noise.audio.volume = 1; noiseStatus(); }
    remember();
  }));
  $$('[data-noise-level]', el.section).forEach((button) => button.addEventListener('click', () => {
    noise.level = Number(button.dataset.noiseLevel);
    $$('[data-noise-level]', el.section).forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    if (noise.audio && !noise.audio.paused) { load(); noise.audio.play(); }
    remember();
  }));
  $('[data-noise-toggle]', el.section)?.addEventListener('click', () => {
    if (noise.audio && !noise.audio.paused) stopNoise(); else startNoise();
  });
  document.addEventListener('visibilitychange', tick);
}

/** The noise choice is kept only with memory on. */
function remember() { if (store.memory) store.set('noise', { type: noise.type, minutes: noise.minutes, level: noise.level }); }
function restore() {
  const saved = store.get('noise');
  if (!saved) return;
  if (NOISE_NAMES[saved.type]) setType(saved.type);
  const timer = $(`[data-noise-timer="${saved.minutes}"]`, el.section);
  if (timer) timer.click();
  const level = $(`[data-noise-level="${saved.level}"]`, el.section);
  if (level) level.click();
}

/* ---------- Init ---------- */
export function init() {
  el.section = $('#nochnik');
  if (!el.section) return;
  original.title = $('[data-night-title]', el.section)?.innerHTML || '';
  original.lead = $('[data-night-lead]', el.section)?.textContent || '';
  place();
  startClock();
  bindNoise();
  restore();
  document.addEventListener('prefs:apply', place);
  // Switching the page back to day by hand ends the night preview.
  document.addEventListener('theme:change', (event) => { if (event.detail?.theme === 'day' && preview) { preview = false; place(); } });
  document.addEventListener('stage:change', () => renderTexts(atTop()));

  registerAction('night-preview', (button) => {
    preview = !preview;
    if (preview) {
      previousTheme = prefs.theme;
      runAction('theme', { themeValue: 'night' }, button);
    } else {
      runAction('theme', { themeValue: previousTheme || 'auto' }, button);
    }
    place();
    setTimeout(() => goTo('#nochnik', { focus: false }), 60);
    setTimeout(() => focusQuietly($('[data-night-preview]', el.section)), prefs.reducedMotion ? 80 : 700);
  });
  registerAction('noise-focus', () => {
    if (openSheets().length) closeSheet();
    setTimeout(() => {
      goTo('#noise', { focus: false });
      setTimeout(() => focusQuietly($('[data-noise-toggle]', el.section)), prefs.reducedMotion ? 30 : 650);
    }, 60);
  });
}
