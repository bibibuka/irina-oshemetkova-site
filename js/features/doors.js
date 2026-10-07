// «С чем ко мне приходят» — five doors as a tablist. Without JS every panel is visible.
// The door that opens first follows the chosen stage.
import { $, $$ } from '../core/dom.js';
import { prefs } from '../core/prefs.js';

const BY_STAGE = { planning: 'planning', pregnancy: 'pregnancy', postpartum: 'postpartum', loss: 'loss', close: 'close' };

export function init() {
  const root = $('[data-doors]');
  if (!root) return;
  const tabs = $$('[role="tab"]', root);
  let touched = false;

  const select = (tab, { focus = false } = {}) => {
    tabs.forEach((other) => {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(other.getAttribute('aria-controls'));
      if (panel) {
        panel.hidden = !on;
        if (on) { panel.classList.remove('appear'); void panel.offsetWidth; panel.classList.add('appear'); }
      }
    });
    // The spread takes the light of the open chapter (doors.css): the accent changes inside the block too.
    const spread = root.closest('.spread');
    if (spread) spread.dataset.chapter = tab.dataset.door;
    if (focus) tab.focus();
  };

  // On a phone the chapter opens below the list: bring its start into view if it is off screen.
  const follow = (tab) => {
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (!panel || !window.matchMedia('(max-width: 860px)').matches) return;
    const top = panel.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.7) panel.scrollIntoView({ behavior: prefs.reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => { touched = true; select(tab); follow(tab); }));
  root.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (event.key in moves) next = (index + moves[event.key] + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next == null) return;
    event.preventDefault();
    touched = true;
    select(tabs[next], { focus: true });
  });

  const byStage = () => {
    const key = BY_STAGE[prefs.stage] || 'planning';
    const tab = tabs.find((item) => item.dataset.door === key) || tabs[0];
    if (tab) select(tab);
  };
  byStage();
  root.closest('.dveri')?.setAttribute('data-doors-ready', '');
  document.addEventListener('stage:change', () => { if (!touched) byStage(); });
}
