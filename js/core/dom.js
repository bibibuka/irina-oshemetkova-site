// Small DOM helpers. Text always goes in as text, never as HTML.
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * h('button', { class: 'btn', onclick: fn, dataset: { x: 1 }, aria: { pressed: 'false' } }, 'Текст', childNode)
 * Strings become text nodes; arrays are flattened; null/false are skipped.
 */
export function h(tag, attrs = {}, ...children) {
  const el = tag === 'svg' || attrs?.ns === 'svg'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false || key === 'ns') continue;
    if (key === 'class') el.setAttribute('class', Array.isArray(value) ? value.filter(Boolean).join(' ') : value);
    else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => { if (v != null) el.dataset[k] = String(v); });
    else if (key === 'aria') Object.entries(value).forEach(([k, v]) => { if (v != null) el.setAttribute(`aria-${k}`, String(v)); });
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'text') el.textContent = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Inline sprite icon: icon('arrow') → <svg class="icon"><use href="#i-arrow"/></svg> */
export function icon(name, extraClass = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon icon-${name} ${extraClass}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/** Delegated listener: on(document, 'click', '[data-open]', (event, match) => …) */
export function on(root, type, selector, handler, options) {
  root.addEventListener(type, (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const match = target?.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  }, options);
}

let uidCounter = 0;
export const uid = (prefix = 'u') => `${prefix}-${++uidCounter}`;

/** Move focus to a node without scrolling, making it focusable if needed. */
export function focusQuietly(node) {
  if (!node) return;
  if (!node.matches('a[href], button, input, select, textarea, [tabindex]')) node.setAttribute('tabindex', '-1');
  node.focus({ preventScroll: true });
}

/** Announce a short message to screen readers through a shared polite live region. */
export function announce(message) {
  let region = document.getElementById('sr-announcer');
  if (!region) {
    region = h('div', { id: 'sr-announcer', class: 'visually-hidden', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.append(region);
  }
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
