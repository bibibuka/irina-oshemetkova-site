// «Как мне удобнее» and «Что знает этот сайт»: theme switch, comfort switches,
// the memory switch, a readable list of everything known, and «Стереть всё».
import { $, $$, h, announce } from '../core/dom.js';
import { prefs, STAGES } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction } from '../core/actions.js';
import { openSheet } from '../core/sheets.js';
import { vibrationSupported } from '../core/audio.js';

const THEME_LABEL = { auto: 'ночник сам по времени', night: 'ночник всегда', day: 'без ночника' };
const PRACTICE_LABEL = { breath: 'дыхание', grounding: '5-4-3-2-1', feelings: 'контакт с чувствами', envelope: 'конверт до утра', flashback: 'возвращение в сегодня' };

/** Every key the site may know, in plain words. */
function describe(key, value) {
  switch (key) {
    case 'stage': return value ? ['Этап', STAGES[value]?.long || value] : null;
    case 'theme': return value && value !== 'auto' ? ['Ночник', THEME_LABEL[value]] : null;
    case 'textLarge': return value ? ['Текст', 'крупный'] : null;
    case 'motion': return value && value !== 'auto' ? ['Движение', value === 'reduced' ? 'меньше' : 'полное'] : null;
    case 'sound': return value ? ['Звук в практиках', 'включён'] : null;
    case 'vibration': return value ? ['Вибрация', 'включена'] : null;
    case 'noBreathing': return value ? ['Дыхательные практики', 'не предлагать'] : null;
    case 'helped': return value ? ['Помогло', PRACTICE_LABEL[value] || value] : null;
    case 'opory': return Array.isArray(value) && value.length ? ['Опоры', String(value.length)] : null;
    case 'envelope': return value ? ['Конверт до утра', '1'] : null;
    case 'noise': return value ? ['Шум для сна', 'запомнен'] : null;
    case 'lastVisit': return value ? ['Последний визит', new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })] : null;
    case 'quietUntil': return value > Date.now() ? ['Тихий режим', `до ${new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`] : null;
    default: return null;
  }
}

function known() {
  return Object.entries(store.snapshot()).map(([key, value]) => [key, describe(key, value)]).filter(([, row]) => row);
}

function renderDataList() {
  const list = $('[data-data-list]');
  if (!list) return;
  const rows = known();
  const caption = store.memory ? 'Хранится в этом браузере:' : 'Только на открытой странице — исчезнет, когда закроешь вкладку:';
  if (!rows.length) {
    list.replaceChildren(h('li', { class: 'is-empty' }, store.memory ? 'Пока здесь пусто.' : 'Пока здесь пусто. На устройстве ничего не хранится.'));
    return;
  }
  list.replaceChildren(
    h('li', { class: 'is-empty' }, caption),
    ...rows.map(([key, [label, value]]) => h('li', {},
      h('span', {}, h('b', {}, label), `: ${value}`),
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', dataset: { forgetKey: key }, aria: { label: `Удалить: ${label}` } }, 'Удалить'))),
  );
}

function renderFooter() {
  const data = $('[data-footer-data]');
  if (data) {
    const rows = known();
    if (store.memory && rows.length) data.textContent = `Хранится в этом браузере: ${rows.map(([, [label]]) => label.toLowerCase()).join(', ')}.`;
    else if (store.memory) data.textContent = 'Память включена, но пока здесь ничего не хранится.';
    else data.textContent = 'Сейчас здесь ничего не хранится.';
  }
  const comfort = $('[data-footer-prefs]');
  if (comfort) {
    comfort.textContent = [
      THEME_LABEL[prefs.theme] ? THEME_LABEL[prefs.theme].replace(/^./, (c) => c.toUpperCase()) : 'Ночник сам по времени',
      prefs.textLarge ? 'крупный текст' : 'обычный текст',
      prefs.reducedMotion ? 'меньше движения' : 'спокойное движение',
      prefs.sound ? 'звук в практиках' : null,
    ].filter(Boolean).join(' · ');
  }
}

function syncSwitches() {
  const values = {
    textLarge: prefs.textLarge, motion: prefs.motion === 'reduced', sound: prefs.sound, vibration: prefs.vibration,
    noBreathing: Boolean(store.get('noBreathing')), memory: store.memory,
  };
  $$('[data-set]').forEach((button) => button.setAttribute('aria-checked', String(Boolean(values[button.dataset.set]))));
  $$('[data-action="theme"]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeValue === prefs.theme)));
}

function renderAll() { syncSwitches(); renderDataList(); renderFooter(); }

function status(text) {
  const node = $('[data-settings-status]');
  if (node) node.textContent = text;
  announce(text);
}

function toggle(key) {
  switch (key) {
    case 'textLarge': prefs.setTextLarge(!prefs.textLarge); break;
    case 'motion': prefs.setMotion(prefs.motion === 'reduced' ? 'auto' : 'reduced'); break;
    case 'sound': prefs.setSound(!prefs.sound); break;
    case 'vibration': prefs.setVibration(!prefs.vibration); break;
    case 'noBreathing': store.set('noBreathing', store.get('noBreathing') ? null : true); break;
    case 'memory':
      if (store.memory) { store.disableMemory(); status('Память выключена. Всё, что было сохранено в этом браузере, стёрто.'); }
      else if (store.enableMemory()) status('Память включена. Этап, опоры, конверт и настройки будут храниться только в этом браузере.');
      else status('Этот браузер не даёт сохранять данные — например, в приватном режиме. Всё работает и без памяти.');
      break;
    default: return;
  }
  renderAll();
}

function setTheme(value, origin) {
  const run = () => prefs.setTheme(value);
  const root = document.documentElement;
  if (document.startViewTransition && !prefs.reducedMotion && origin) {
    const rect = origin.getBoundingClientRect();
    root.style.setProperty('--vt-x', `${rect.left + rect.width / 2}px`);
    root.style.setProperty('--vt-y', `${rect.top + rect.height / 2}px`);
    root.classList.add('vt-reveal');
    const transition = document.startViewTransition(run);
    transition.finished.finally(() => root.classList.remove('vt-reveal'));
  } else run();
  renderAll();
}

function forgetConfirm(host, onDone) {
  host.hidden = false;
  const done = () => {
    store.forgetAll();
    host.replaceChildren(h('p', { role: 'status' }, 'Готово. Здесь больше ничего нет.'));
    announce('Готово. Здесь больше ничего нет.');
    renderAll();
    onDone?.();
    setTimeout(() => { host.hidden = true; host.replaceChildren(); }, 6000);
  };
  const cancel = h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { host.hidden = true; host.replaceChildren(); } }, 'Отмена');
  host.replaceChildren(
    h('p', {}, 'Стереть этап, опоры, конверт и настройки с этого устройства?'),
    h('div', { class: 'forget-confirm__actions' },
      h('button', { type: 'button', class: 'btn btn--danger-ghost btn--small', onclick: done }, 'Стереть'), cancel),
  );
  requestAnimationFrame(() => cancel.focus());
}

export function init() {
  $$('[data-set="vibration"]').forEach((button) => { button.hidden = !vibrationSupported(); });
  $$('[data-set]').forEach((button) => button.addEventListener('click', () => toggle(button.dataset.set)));
  $('[data-data-list]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-forget-key]');
    if (!button) return;
    store.set(button.dataset.forgetKey, null);
    if (button.dataset.forgetKey === 'stage') prefs.setStage(null);
    status('Удалено.');
    renderAll();
  });
  registerAction('theme', (button, { themeValue }) => {
    if (['auto', 'day', 'night'].includes(themeValue)) setTheme(themeValue, button);
  });
  registerAction('settings', (button, { focus }) => {
    renderAll();
    openSheet('sheet-settings', { opener: button, focus: focus === 'data' ? '#settings-data .settings-group__title' : undefined });
  });
  registerAction('forget', (button) => {
    let host = button?.closest('.svet__col')?.querySelector('[data-forget-confirm]');
    if (!host) {
      const sheetHost = button?.closest('.settings-data');
      if (sheetHost) {
        host = $('.forget-confirm', sheetHost) || h('div', { class: 'forget-confirm' });
        if (!host.isConnected) $('.settings-data__actions', sheetHost)?.after(host);
      }
    }
    if (host) forgetConfirm(host);
  });
  document.addEventListener('store:change', renderAll);
  document.addEventListener('prefs:apply', () => { syncSwitches(); renderFooter(); });
  renderAll();
}
