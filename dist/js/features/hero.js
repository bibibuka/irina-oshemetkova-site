// «Окно»: greeting by part of day, the stage question and its quiet reply, the
// threshold before the loss pages, the window photo and the rotating badge.
// The chosen stage also re-orders the middle sections (DOM move keeps tab order).
import { $, $$, h, announce } from '../core/dom.js';
import { prefs, STAGES } from '../core/prefs.js';
import { store } from '../core/store.js';
import { registerAction, runAction, goTo } from '../core/actions.js';
import { openSheet, closeSheet } from '../core/sheets.js';
import { isNightLightHours } from '../core/time.js';
import { pick } from '../core/phrases.js';
import {
  SALUTES, GREETING_LINES, NIGHT_POSTPARTUM, LOSS_LINES, BADGE, PART_ICON, HERO, STAGE_REPLIES, WELCOME_BACK, COMEBACK,
} from '../content/greetings.js';

const FLOW = {
  default: ['doors', 'breath', 'shelf', 'thought', 'words'],
  planning: ['thought', 'words', 'doors', 'breath', 'shelf'],
  pregnancy: ['breath', 'doors', 'shelf', 'thought', 'words'],
  postpartum: ['shelf', 'words', 'breath', 'doors', 'thought'],
  loss: ['breath', 'shelf', 'words', 'doors', 'thought'],
  close: ['words', 'doors', 'breath', 'shelf', 'thought'],
};

let greetingKey = '';
let titleKey = '';

function heroVariant() {
  const stage = prefs.stage;
  if (stage === 'postpartum' && isNightLightHours()) return 'nightPostpartum';
  return HERO[stage] ? stage : 'default';
}

function renderGreeting() {
  const node = $('[data-greeting]');
  if (!node) return;
  const part = prefs.part;
  const stage = prefs.stage;
  const nightBaby = stage === 'postpartum' && part === 'night';
  const key = `${part}|${stage}|${nightBaby}`;
  const iconUse = $('[data-part-icon]');
  if (iconUse) iconUse.setAttribute('href', `#i-${PART_ICON[part] || 'leaf'}`);
  if (key === greetingKey) return;
  greetingKey = key;
  let text;
  if (nightBaby) text = pick(NIGHT_POSTPARTUM, 'greet-night-baby');
  else if (stage === 'loss') text = `${part === 'night' ? 'Тихой ночи' : 'Здравствуй'}. ${pick(LOSS_LINES, 'greet-loss')}`;
  else text = `${pick(SALUTES[part], `salute-${part}`)}. ${pick(GREETING_LINES[part], `greet-${part}`)}`;
  node.textContent = text;
}

function renderTitle() {
  const title = $('[data-hero-title]');
  const lead = $('[data-hero-lead]');
  if (!title || !lead) return;
  const variant = heroVariant();
  const note = $('[data-night-note]');
  if (note) note.hidden = !isNightLightHours() || variant === 'nightPostpartum';
  if (variant === titleKey) return;
  const first = !titleKey;
  titleKey = variant;
  const { title: [plain, accent], lead: text } = HERO[variant];
  const update = () => {
    title.replaceChildren(
      h('span', { class: 'line' }, h('span', { class: 'line__i' }, plain.trim())), ' ',
      h('em', { class: 'line' }, h('span', { class: 'line__i' }, accent)));
    lead.textContent = text;
  };
  if (first) {
    // The page already shows these words and the intro may be animating them: leave them be.
    if (title.textContent.replace(/\s+/g, ' ').trim() !== `${plain.trim()} ${accent}`) update();
    else if (lead.textContent !== text) lead.textContent = text;
    return;
  }
  if (prefs.reducedMotion) { update(); return; }
  title.classList.remove('is-relit');
  update();
  void title.offsetWidth;
  title.classList.add('is-relit');
}

function renderBadge() {
  const path = $('[data-badge-text]');
  if (!path) return;
  const text = prefs.quiet ? BADGE.quiet : BADGE[prefs.part] || BADGE.day;
  if (path.textContent !== text) path.textContent = text;
  path.setAttribute('textLength', '279');
  path.setAttribute('lengthAdjust', 'spacing');
}

/** Morning/day: the bright portrait. Evening/night: Irina by the window with a cup. */
function renderWindow() {
  const evening = ['evening', 'night'].includes(prefs.part);
  const day = $('.arch-window__img--day');
  const eve = $('.arch-window__img--evening');
  if (!day || !eve) return;
  if (evening && !eve.getAttribute('src') && eve.dataset.src) {
    eve.addEventListener('load', () => eve.classList.add('is-ready'), { once: true });
    eve.src = eve.dataset.src;
    if (eve.complete) eve.classList.add('is-ready');
  }
  const showEvening = evening && eve.getAttribute('src');
  day.setAttribute('aria-hidden', showEvening ? 'true' : 'false');
  eve.setAttribute('aria-hidden', showEvening ? 'false' : 'true');
  $('.arch-window')?.classList.toggle('is-evening', Boolean(showEvening));
}

function renderStageControls() {
  const stage = prefs.stage;
  $$('[data-action="stage"]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.stage === stage)));
}

function arrangeFlow() {
  const flow = $('[data-flow]');
  if (!flow) return;
  const order = FLOW[prefs.stage] || FLOW.default;
  const items = new Map($$('[data-flow-item]', flow).map((el) => [el.dataset.flowItem, el]));
  const current = $$('[data-flow-item]', flow).map((el) => el.dataset.flowItem).join();
  if (current === order.join()) return;
  order.forEach((key) => { const el = items.get(key); if (el) flow.append(el); });
}

function replyStep(step) {
  if (step.action) {
    return h('button', {
      type: 'button', class: 'link',
      dataset: { action: step.action, pattern: step.pattern, start: step.pattern ? 'true' : null, topic: step.topic, format: step.format },
    }, step.label);
  }
  return h('a', { class: 'link', href: step.href, dataset: { wordsOpen: step.words } }, step.label);
}

function showReply(stage) {
  const box = $('[data-stage-reply]');
  const reply = STAGE_REPLIES[stage];
  if (!box || !reply) return;
  box.replaceChildren(h('div', { class: 'stage-reply appear' },
    h('p', { class: 'stage-reply__text' }, reply.text),
    h('p', { class: 'stage-reply__next' }, reply.next.map((step, index) => [index ? h('span', { class: 'stage-reply__dot', 'aria-hidden': 'true' }, '·') : null, replyStep(step)])),
  ));
}

function renderWelcome() {
  const node = $('[data-welcome]');
  if (!node || !store.memory) return;
  const last = Number(store.get('lastVisit', 0));
  store.set('lastVisit', Date.now());
  if (!last) return;
  const days = (Date.now() - last) / 86400000;
  if (days < 0.25) return;
  const stage = prefs.stage;
  const line = days >= 7 ? pick(COMEBACK, 'comeback') : pick([...(WELCOME_BACK[stage] || []), ...WELCOME_BACK.all], 'welcome');
  node.textContent = line;
  node.hidden = false;
}

function renderAll() {
  renderGreeting();
  renderTitle();
  renderBadge();
  renderWindow();
  renderStageControls();
}

function chooseStage(el, { stage }) {
  if (!STAGES[stage]) return;
  const fromSheet = el?.closest('dialog.sheet');
  const lossChip = $('[data-stage-pick] [data-stage="loss"]');
  prefs.setStage(stage);
  arrangeFlow();
  renderAll();
  showReply(stage);
  document.dispatchEvent(new CustomEvent('stage:change', { detail: { stage } }));
  if (stage === 'loss') {
    openSheet('sheet-threshold', { opener: el && !fromSheet ? el : lossChip });
    return;
  }
  announce(STAGE_REPLIES[stage]?.text || '');
}

function initThreshold() {
  $$('[data-threshold]').forEach((button) => button.addEventListener('click', () => {
    const choice = button.dataset.threshold;
    if (choice === 'support') { openSheet('sheet-help', { opener: $('[data-stage-pick] [data-stage="loss"]') }); return; }
    closeSheet('sheet-threshold');
    if (choice === 'breathe') { runAction('breathe', { pattern: '36' }); return; }
    const first = $('[data-flow] > [data-flow-item]');
    setTimeout(() => goTo(first ? `#${first.id}` : '#pogoda'), 60);
  }));
}

export function init() {
  arrangeFlow();
  renderAll();
  renderWelcome();
  registerAction('stage', chooseStage);
  initThreshold();
  document.addEventListener('prefs:apply', renderAll);
  document.addEventListener('store:change', (event) => {
    if (['stage', '*'].includes(event.detail?.key)) { arrangeFlow(); renderAll(); }
  });
}
