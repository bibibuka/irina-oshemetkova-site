// «Что сказать близким»: ready phrases with copy / share.
import { h, uid } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { WORDS } from '../content/words.js';
import { copyShare, status as statusLine } from './ui.js';

export const title = 'Что сказать близким';

export function render(body, api) {
  const status = statusLine();
  const list = h('div', { class: 'w-list', role: 'tabpanel', tabindex: '0' });
  const tabs = WORDS.map((group) => h('button', {
    type: 'button', role: 'tab', id: uid('wtab'), aria: { selected: 'false' }, tabindex: '-1', dataset: { group: group.id },
    onclick: () => select(group.id, false),
  }, group.label));
  const tablist = h('div', { class: 'w-tabs', role: 'tablist', aria: { label: 'Кому' } }, tabs);
  tablist.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (index < 0 || !step) return;
    event.preventDefault();
    select(WORDS[(index + step + WORDS.length) % WORDS.length].id, true);
  });

  function select(id, focus) {
    const group = WORDS.find((item) => item.id === id);
    tabs.forEach((tab) => {
      const on = tab.dataset.group === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) { list.setAttribute('aria-labelledby', tab.id); if (focus) tab.focus(); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    });
    if (group.quiet) prefs.enterQuiet('words-loss');
    status.textContent = '';
    list.replaceChildren(
      ...group.phrases.map((phrase) => h('blockquote', { class: `phrase${phrase.urgent ? ' phrase--urgent' : ''}` },
        h('p', {}, phrase.text),
        phrase.note ? h('footer', {}, phrase.note) : null,
        copyShare(() => phrase.text, { status }),
      )),
      group.memo ? h('div', { class: 'help-memo' },
        h('h3', {}, 'Как мне помочь'),
        h('ol', {}, group.memo.map((line) => h('li', {}, line))),
        copyShare(() => `Как мне помочь:\n${group.memo.map((line, i) => `${i + 1}. ${line}`).join('\n')}`, { status }),
      ) : null,
    );
  }

  api.show(
    h('p', { class: 'p-lead', 'data-autofocus': '', tabindex: '-1' }, 'Слова для трудных разговоров. Берите как есть или переделайте под себя — ничего не уйдёт, пока вы сами не нажмёте «отправить».'),
    tablist, list, status,
    h('div', { class: 'p-row' },
      h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => api.open('request') }, 'Собрать свою просьбу'),
    ),
    api.cta('Разговоры с близкими — частая тема на встречах.', 'Как говорить о своих чувствах, просить о помощи и держать границы с родными — с этим можно прийти на консультацию, одной или вдвоём.'),
  );
  select('partner', false);
}
