// Time of day as the bot understands it: утро 5–11, день 11–17, вечер 17–23, ночь 23–5.
const params = new URLSearchParams(location.search);
const PREVIEW_PART = params.get('tod'); // dev preview: ?tod=night

export function now() {
  if (PREVIEW_PART) {
    const preview = new Date();
    const hour = { morning: 8, day: 14, evening: 20, night: 3 }[PREVIEW_PART];
    if (hour != null) preview.setHours(hour, 10, 0, 0);
    return preview;
  }
  return new Date();
}

export function partOfDay(date = now()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'night';
}

/** The automatic «ночник» window is a little wider than the bot's night. */
export function isNightLightHours(date = now()) {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

const ORDINAL_GENITIVE = ['двенадцатого', 'первого', 'второго', 'третьего', 'четвёртого', 'пятого', 'шестого', 'седьмого', 'восьмого', 'девятого', 'десятого', 'одиннадцатого'];
const CARDINAL = ['двенадцать', 'час', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать'];
const CARDINAL_GENITIVE = ['двенадцати', 'часа', 'двух', 'трёх', 'четырёх', 'пяти', 'шести', 'семи', 'восьми', 'девяти', 'десяти', 'одиннадцати'];

/** «Около трёх», «Начало четвёртого», «Половина четвёртого», «Скоро четыре», «Почти четыре». */
export function humanTime(date = now()) {
  const m = date.getMinutes();
  const hour = date.getHours() % 12;
  const next = (hour + 1) % 12;
  if (m < 5) return `Около ${CARDINAL_GENITIVE[hour]}`;
  if (m < 25) return `Начало ${ORDINAL_GENITIVE[next]}`;
  if (m < 35) return `Половина ${ORDINAL_GENITIVE[next]}`;
  if (m < 53) return `Скоро ${CARDINAL[next]}`;
  return `Почти ${CARDINAL[next]}`;
}

/** Calls fn now and whenever the part of day may have changed (checked each minute). */
export function watchTime(fn) {
  let last = '';
  const tick = () => {
    const date = now();
    const key = `${partOfDay(date)}|${isNightLightHours(date)}|${date.getHours()}:${date.getMinutes()}`;
    if (key !== last) { last = key; fn(date); }
  };
  tick();
  const timer = setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  return () => clearInterval(timer);
}

export const PART_LABELS = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' };
