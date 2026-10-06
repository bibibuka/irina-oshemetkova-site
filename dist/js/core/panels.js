// Tabs whose panels are also navigation targets. The practices block keeps every
// practice in its own panel (#pogoda, #dyhanie, #polka…); jumpTo() calls revealPanel()
// first, so any link, action or «Что дальше» that points into a closed panel opens it.
// Without JS every panel stays visible, one after another.
import { $$ } from './dom.js';

function panelOf(tab) { return document.getElementById(tab.getAttribute('aria-controls')); }
function tabOf(panel) { return document.querySelector(`[role="tab"][aria-controls="${CSS.escape(panel.id)}"]`); }

/** Open the tab that owns `panel`. Returns true when something changed. */
export function selectTab(tab, { focus = false } = {}) {
  const list = tab?.closest('[role="tablist"]');
  if (!list) return false;
  const already = tab.getAttribute('aria-selected') === 'true' && !panelOf(tab)?.hidden;
  $$('[role="tab"]', list).forEach((other) => {
    const on = other === tab;
    other.setAttribute('aria-selected', String(on));
    other.tabIndex = on ? 0 : -1;
    const panel = panelOf(other);
    if (panel) panel.hidden = !on;
  });
  if (focus) tab.focus();
  if (!already) {
    const panel = panelOf(tab);
    // Features that measured themselves while hidden get a chance to measure again.
    document.dispatchEvent(new CustomEvent('panel:show', { detail: { id: panel?.id, panel } }));
    window.dispatchEvent(new Event('resize'));
  }
  return !already;
}

/** If `el` sits inside a closed panel, open that panel (synchronously, before measuring). */
export function revealPanel(el) {
  const panel = el?.closest?.('[data-tab-panel]');
  if (!panel || !panel.hidden) return false;
  const tab = tabOf(panel);
  return tab ? selectTab(tab) : false;
}

export function initPanels() {
  $$('[data-tabs]').forEach((list) => {
    const tabs = $$('[role="tab"]', list);
    if (!tabs.length) return;
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', (event) => {
        const index = tabs.indexOf(tab);
        const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const target = tabs[(next + tabs.length) % tabs.length];
        selectTab(target, { focus: true });
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
    const initial = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
    tabs.forEach((tab) => { const panel = panelOf(tab); if (panel) panel.hidden = tab !== initial; });
    list.closest('[data-tabs-root]')?.setAttribute('data-tabs-ready', '');
  });
  // A shared link straight to a practice (…/#slova) opens its panel.
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  // The browser could not scroll to a closed panel on its own: open it, then bring it into view.
  if (target && revealPanel(target)) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
