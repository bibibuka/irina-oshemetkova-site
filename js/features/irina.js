// «Я — Ирина»: the photo answers the hero (window by day, portrait at night),
// principle cards turn over, documents open in one lightbox with ← → and Esc.
import { $, $$ } from '../core/dom.js';
import { prefs } from '../core/prefs.js';
import { openSheet } from '../core/sheets.js';

function renderPhoto() {
  const day = $('.irina__img--day');
  const night = $('.irina__img--night');
  if (!day || !night) return;
  const evening = ['evening', 'night'].includes(prefs.part);
  if (evening && !night.getAttribute('src') && night.dataset.src) {
    night.addEventListener('load', () => night.classList.add('is-ready'), { once: true });
    night.src = night.dataset.src;
  }
  const showNight = evening && Boolean(night.getAttribute('src'));
  $('.irina__arch')?.classList.toggle('is-night', showNight);
  day.setAttribute('aria-hidden', String(showNight));
  night.setAttribute('aria-hidden', String(!showNight));
}

function initPrinciples() {
  $$('[data-flip]').forEach((card) => card.addEventListener('click', () => {
    card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
  }));
}

function initLightbox() {
  const docs = $$('[data-doc]');
  const img = $('[data-lightbox-img]');
  const caption = $('[data-lightbox-caption]');
  const count = $('[data-lightbox-count]');
  if (!docs.length || !img) return;
  let index = 0;
  const show = (next) => {
    index = (next + docs.length) % docs.length;
    const thumb = $('img', docs[index]);
    img.src = thumb.currentSrc || thumb.src;
    img.alt = thumb.alt;
    img.width = thumb.width; img.height = thumb.height;
    caption.textContent = `${$('.doc__name', docs[index])?.textContent || ''} — ${$('.doc__where', docs[index])?.textContent || ''}`;
    count.textContent = `${index + 1} из ${docs.length}`;
  };
  docs.forEach((doc, i) => doc.addEventListener('click', () => {
    show(i);
    openSheet('sheet-doc', { opener: doc, focus: '[data-lightbox-caption]' });
  }));
  $('[data-lightbox-prev]')?.addEventListener('click', () => show(index - 1));
  $('[data-lightbox-next]')?.addEventListener('click', () => show(index + 1));
  $('#sheet-doc')?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });
  document.addEventListener('sheet:close', (event) => {
    // Return focus to the document that is shown now, not the one that opened the lightbox.
    if (event.detail.id === 'sheet-doc') requestAnimationFrame(() => requestAnimationFrame(() => docs[index]?.focus({ preventScroll: true })));
  });
}

export function init() {
  renderPhoto();
  initPrinciples();
  initLightbox();
  document.addEventListener('prefs:apply', renderPhoto);
}
