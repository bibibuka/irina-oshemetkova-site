/* Small tools for reflection. Answers stay in this page and are never sent or stored. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const setText = (selector, text) => { const node = $(selector); if (node) node.textContent = text; };
  const focus = (node) => {
    if (!node) return;
    node.setAttribute('tabindex', '-1');
    node.focus({ preventScroll: true });
  };

  function closeOtherDialogs(except = null) {
    $$('dialog[open]').forEach((dialog) => { if (dialog !== except) dialog.close(); });
  }

  function openDialog(dialog) {
    if (!dialog) return;
    closeOtherDialogs(dialog);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    $('#menu-toggle')?.setAttribute('aria-expanded', 'false');
    $('#menu-toggle')?.setAttribute('aria-label', 'Открыть меню');
    $('#main-nav')?.classList.remove('is-open');
    dialog.scrollTop = 0;
  }

  // Run before app.js's delegated clicks, so its breathing and booking dialogs
  // never open over a second modal when reached from a recommendation.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const trigger = target?.closest('[data-practice], [data-booking]');
    if (!trigger) return;
    const destination = trigger.hasAttribute('data-booking') ? $('#booking-dialog') : $('#practice-dialog');
    closeOtherDialogs(destination);
  }, true);

  const guide = $('#guide-dialog');
  const guideQuestions = [
    {
      title: 'На каком вы сейчас этапе?',
      options: [
        ['planning', 'Планирую беременность', 'Ожидание, решения, неопределённость'],
        ['pregnancy', 'Жду ребёнка', 'Перемены и подготовка к встрече'],
        ['motherhood', 'Я уже мама', 'Новая жизнь и место для себя'],
        ['loss', 'Проживаю утрату', 'Бережно, без чужих сроков'],
        ['unsure', 'Мне сложно определиться', 'Можно начать с того, что есть'],
      ],
    },
    {
      title: 'Что сейчас хочется поддержать?',
      options: [
        ['calm', 'Хочется немного спокойствия', 'Побыть в настоящем моменте'],
        ['connection', 'Нужна поддержка близких', 'Найти слова и попросить о помощи'],
        ['energy', 'Хочется выдохнуть и отдохнуть', 'Заметить свои потребности'],
        ['talk', 'Хочется поговорить', 'Разобраться в чувствах вместе'],
      ],
    },
    {
      title: 'Сколько времени есть для себя?',
      options: [
        ['minute', 'Одна свободная минута', 'Небольшая пауза прямо сейчас'],
        ['few', 'Несколько спокойных минут', 'Можно немного задержаться'],
        ['talk', 'Хочу выделить время на разговор', 'Познакомиться с психологом'],
      ],
    },
  ];
  const stageContext = {
    planning: 'На пути к материнству бывает много ожидания и неопределённости. Вашим чувствам тоже нужно место.',
    pregnancy: 'В ожидании ребёнка можно испытывать разные чувства одновременно. Начните с того, что важно вам сейчас.',
    motherhood: 'Среди забот о ребёнке ваши собственные потребности остаются важными. Пусть этот шаг будет посильным.',
    loss: 'У горя нет правильного расписания. Можно ничего не решать прямо сейчас и выбирать только ту поддержку, которая вам подходит.',
    unsure: 'Чтобы обратиться за поддержкой, необязательно сразу находить точные слова. Начать можно с ощущения «мне сейчас непросто».',
  };
  const stageTopics = {
    planning: 'Планирование беременности', pregnancy: 'Поддержка в беременности',
    motherhood: 'Поддержка в материнстве', loss: 'Бережная поддержка после утраты', unsure: 'Хочу разобраться в своих чувствах',
  };
  const needTopics = { calm: 'тревога и опора', connection: 'поддержка и отношения с близкими', energy: 'усталость и забота о себе', talk: 'хочется быть услышанной' };
  let guideStep = 0;
  let guideAnswers = [null, null, null];

  function renderGuide(moveFocus = false) {
    const options = $('#guide-options');
    if (!guide || !options) return;
    guide.setAttribute('aria-labelledby', 'guide-question');
    if ($('#guide-form-area')) $('#guide-form-area').hidden = false;
    if ($('#guide-result')) $('#guide-result').hidden = true;
    setText('#guide-step', `Шаг ${guideStep + 1} из 3`);
    setText('#guide-question', guideQuestions[guideStep].title);
    options.replaceChildren();
    guideQuestions[guideStep].options.forEach(([value, label, description]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'guide-option';
      button.dataset.guideValue = value;
      const selected = guideAnswers[guideStep] === value;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
      const title = document.createElement('strong');
      title.textContent = label;
      const detail = document.createElement('span');
      detail.textContent = description;
      button.append(title, detail);
      button.addEventListener('click', () => {
        guideAnswers[guideStep] = value;
        $$('.guide-option', options).forEach((option) => {
          const active = option === button;
          option.setAttribute('aria-pressed', String(active));
          option.classList.toggle('selected', active);
        });
        if ($('#guide-next')) $('#guide-next').disabled = false;
      });
      options.append(button);
    });
    const back = $('#guide-back');
    if (back) back.disabled = guideStep === 0;
    const next = $('#guide-next');
    if (next) {
      next.disabled = !guideAnswers[guideStep];
      next.textContent = guideStep === 2 ? 'Показать мой первый шаг' : 'Дальше';
    }
    guide.scrollTop = 0;
    if (moveFocus) focus($('#guide-question'));
  }

  function actionButton(text, attribute, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${primary ? 'button-primary' : 'button-outline'}`;
    button.textContent = text;
    button.setAttribute(attribute, '');
    return button;
  }

  function showGuideResult() {
    const [stage, need, time] = guideAnswers;
    if (!stage || !need || !time || !guide) return;
    const wantsConversation = time === 'talk' || need === 'talk';
    let title;
    let suggestion;
    let tool;
    let label;
    if (wantsConversation) {
      title = 'Начать с разговора';
      suggestion = 'Можно подготовить короткое сообщение Ирине. На первой встрече не нужно приходить с готовым планом: достаточно рассказать, что хочется обсудить.';
      tool = time === 'minute' ? 'data-practice' : 'data-builder';
      label = time === 'minute' ? 'А пока — минута для себя' : 'Сначала найти слова для близкого';
    } else if (need === 'connection' || (need === 'energy' && time === 'few')) {
      title = need === 'energy' ? 'Освободить немного места для отдыха' : 'Попросить о конкретной поддержке';
      suggestion = time === 'minute'
        ? 'Попробуйте выбрать одну короткую просьбу, которую можно сказать близкому. В конструкторе есть готовые примеры — их можно изменить под себя.'
        : 'Подумайте, какое небольшое действие близкого сейчас было бы полезным. Конструктор поможет соединить ваши чувства, потребность и конкретную просьбу.';
      tool = 'data-builder';
      label = 'Составить просьбу о поддержке';
    } else if (time === 'minute') {
      title = 'Оставить одну минуту себе';
      suggestion = 'Если сейчас удобно, устройтесь чуть комфортнее и попробуйте короткую дыхательную паузу. Следуйте своему ритму; завершить можно в любой момент.';
      tool = 'data-practice';
      label = 'Открыть минутную практику';
    } else {
      title = 'Заметить то, что рядом';
      suggestion = 'Можно ненадолго перевести внимание на предметы, звуки и ощущения вокруг. Практика 5–4–3–2–1 проходит в вашем темпе; любой шаг можно пропустить.';
      tool = 'data-grounding';
      label = 'Попробовать 5–4–3–2–1';
    }
    setText('#guide-step', 'Ваш первый шаг');
    setText('#guide-result-title', title);
    setText('#guide-result-copy', `${stageContext[stage]} ${suggestion}`);
    const actions = $('#guide-result-actions');
    if (actions) {
      const practice = actionButton(label, tool, !wantsConversation);
      const booking = actionButton('Обсудить это с Ириной', 'data-booking', wantsConversation);
      booking.dataset.topic = `${stageTopics[stage]}: ${needTopics[need]}`;
      actions.replaceChildren(...(wantsConversation ? [booking, practice] : [practice, booking]));
    }
    if ($('#guide-form-area')) $('#guide-form-area').hidden = true;
    if ($('#guide-result')) $('#guide-result').hidden = false;
    guide.setAttribute('aria-labelledby', 'guide-result-title');
    guide.scrollTop = 0;
    focus($('#guide-result-title'));
  }

  function resetGuide() {
    guideStep = 0;
    guideAnswers = [null, null, null];
    renderGuide(Boolean(guide?.open));
  }
  $('#guide-next')?.addEventListener('click', () => {
    if (!guideAnswers[guideStep]) return;
    if (guideStep === 2) showGuideResult();
    else { guideStep += 1; renderGuide(true); }
  });
  $('#guide-back')?.addEventListener('click', () => {
    if (guideStep > 0) { guideStep -= 1; renderGuide(true); }
  });
  $('#guide-restart')?.addEventListener('click', resetGuide);

  const grounding = $('#grounding-dialog');
  const groundingSteps = [
    ['5', 'Вещей, которые вы видите', 'Оглядитесь и назовите про себя пять предметов. Заметьте их цвет, форму или свет на поверхности. Не торопитесь.'],
    ['4', 'Звука, которые вы слышите', 'Прислушайтесь к четырём звукам рядом или вдалеке. Тихий гул, шорох одежды и собственное дыхание тоже считаются.'],
    ['3', 'Ощущения прикосновения', 'Заметьте три доступные фактуры: одежду на коже, поверхность под ладонью, опору под ногами. Какие они — тёплые, гладкие, мягкие?'],
    ['2', 'Запаха, которые вы замечаете', 'Попробуйте найти два знакомых запаха вокруг. Если сейчас их не замечаете, можно вспомнить приятные запахи или перейти дальше.'],
    ['1', 'Вкус, который вы чувствуете', 'Заметьте один вкус. Можно сделать глоток воды или просто вспомнить знакомый вкус. Выберите то, что сейчас удобно.'],
  ];
  let groundingStep = 0;

  function renderGrounding(moveFocus = false) {
    if (!grounding) return;
    const complete = groundingStep === groundingSteps.length;
    const step = groundingSteps[groundingStep];
    setText('#grounding-count', complete ? '✓' : step[0]);
    setText('#grounding-title', complete ? 'Вы здесь' : step[1]);
    setText('#grounding-description', complete
      ? 'Практика завершена. Заметьте, как вам сейчас, без ожидания определённого результата. Можно ещё немного побыть здесь или вернуться к своим делам.'
      : step[2]);
    setText('#grounding-progress', complete ? 'Пять шагов позади · в вашем темпе' : `Шаг ${groundingStep + 1} из 5 · можно пропустить`);
    const dots = $('#grounding-dots');
    if (dots) {
      dots.setAttribute('aria-hidden', 'true');
      dots.replaceChildren(...groundingSteps.map((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'grounding-dot';
        dot.classList.toggle('active', index === groundingStep);
        dot.classList.toggle('done', index < groundingStep);
        return dot;
      }));
    }
    const back = $('#grounding-back');
    if (back) back.disabled = groundingStep === 0;
    const next = $('#grounding-next');
    if (next) {
      next.hidden = complete;
      next.textContent = groundingStep === 4 ? 'Завершить практику' : 'Дальше';
    }
    if ($('#grounding-restart')) $('#grounding-restart').hidden = !complete;
    grounding.classList.toggle('is-complete', complete);
    if (moveFocus) focus($('#grounding-title'));
  }
  function resetGrounding(moveFocus = false) {
    groundingStep = 0;
    renderGrounding(moveFocus);
  }
  $('#grounding-next')?.addEventListener('click', () => {
    if (groundingStep < groundingSteps.length) { groundingStep += 1; renderGrounding(true); }
  });
  $('#grounding-back')?.addEventListener('click', () => {
    if (groundingStep > 0) { groundingStep -= 1; renderGrounding(true); }
  });
  $('#grounding-restart')?.addEventListener('click', () => resetGrounding(true));

  const builder = $('#builder-dialog');
  const builderForm = $('#request-builder');
  const builderPresets = {
    rest: { situation: 'я весь день в заботах', feeling: 'усталость', need: 'отдохнуть', request: 'дать мне полчаса тишины сегодня' },
    listen: { situation: 'мне непросто разобраться в своих переживаниях', feeling: 'растерянность', need: 'быть услышанной', request: 'немного послушать меня без советов' },
    chores: { situation: 'домашних дел становится слишком много', feeling: 'усталость', need: 'почувствовать поддержку', request: 'взять на себя ужин сегодня' },
  };
  let builderRevision = 0;
  function normalize(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function fieldValue(selector, fallback) {
    const field = $(selector);
    const limit = field?.maxLength > 0 ? field.maxLength : 500;
    return normalize(field?.value).slice(0, limit) || fallback;
  }
  function renderBuilder() {
    builderRevision += 1;
    const situation = fieldValue('#builder-situation', 'мне непросто');
    const feeling = fieldValue('#builder-feeling', 'усталость');
    const need = fieldValue('#builder-need', 'почувствовать поддержку');
    const request = fieldValue('#builder-request', 'немного побыть рядом').replace(/[.!?…]+$/, '');
    setText('#builder-preview', `Когда ${situation}, я чувствую ${feeling}. Мне важно ${need}. Можешь, пожалуйста, ${request}?`);
    setText('#builder-copy-status', '');
    setText('#builder-copy', 'Скопировать просьбу');
  }
  function clearPresetSelection() {
    $$('[data-request-preset]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }
  builderForm?.addEventListener('submit', (event) => event.preventDefault());
  builderForm?.addEventListener('input', () => { clearPresetSelection(); renderBuilder(); });
  builderForm?.addEventListener('change', () => { clearPresetSelection(); renderBuilder(); });
  $('#builder-reset')?.addEventListener('click', (event) => {
    event.preventDefault();
    builderForm?.reset();
    clearPresetSelection();
    renderBuilder();
    $('#builder-situation')?.focus();
  });
  $('#builder-copy')?.addEventListener('click', async () => {
    const preview = $('#builder-preview');
    if (!preview?.textContent) return;
    const revision = builderRevision;
    const text = preview.textContent;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; }
    } catch { /* A selectable preview remains available if clipboard access is denied. */ }
    if (revision !== builderRevision) return;
    if (!copied) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(preview);
      selection?.removeAllRanges();
      selection?.addRange(range);
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    setText('#builder-copy', copied ? 'Скопировано ✓' : 'Скопировать просьбу');
    setText('#builder-copy-status', copied ? 'Текст скопирован. Вы сами решаете, когда и кому его отправить.' : 'Не удалось скопировать автоматически. Текст выделен: нажмите Ctrl+C или удерживайте его для копирования.');
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    if (target.closest('[data-guide]')) {
      event.preventDefault();
      resetGuide();
      openDialog(guide);
      focus($('#guide-question'));
    } else if (target.closest('[data-grounding]')) {
      event.preventDefault();
      resetGrounding();
      openDialog(grounding);
      focus($('#grounding-title'));
    } else if (target.closest('[data-builder]')) {
      event.preventDefault();
      openDialog(builder);
      $('#builder-situation')?.focus();
    }
    const preset = target.closest('[data-request-preset]');
    const values = preset && builderPresets[preset.dataset.requestPreset];
    if (values) {
      event.preventDefault();
      Object.entries(values).forEach(([key, value]) => { const field = $(`#builder-${key}`); if (field) field.value = value; });
      clearPresetSelection();
      preset.setAttribute('aria-pressed', 'true');
      renderBuilder();
    }
  });

  const comfortToggle = $('#comfort-toggle');
  function renderComfort() {
    if (!comfortToggle) return;
    const large = document.documentElement.classList.contains('comfort-mode');
    comfortToggle.setAttribute('aria-pressed', String(large));
    comfortToggle.title = large ? 'Обычный текст' : 'Крупный текст';
    comfortToggle.setAttribute('aria-label', large ? 'Вернуть обычный размер текста' : 'Включить крупный текст');
  }
  comfortToggle?.addEventListener('click', () => {
    document.documentElement.classList.toggle('comfort-mode');
    renderComfort();
  });

  renderGuide();
  renderGrounding();
  renderBuilder();
  renderComfort();
})();
