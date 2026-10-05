/* The site is entirely local: forms prepare text and never send or store it. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arrow = '<span aria-hidden="true">↗</span>';
  const icons = {
    leaf: '<path d="M19 4C10 3 4 8 5 14c1 5 8 6 11 2 3-4 3-8 3-12Z"/><path d="M4 21 16 8M8 17l-1-5m5 1 5 1"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    heart: '<path d="m12 20-8-8C-1 6 7 1 12 7c5-6 13-1 8 5Z"/>',
    circles: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    horizon: '<path d="M3 17h18M5 21h14M7 13a5 5 0 0 1 10 0M12 2v3M3 6l2 2m14 0 2-2"/>',
    waves: '<path d="M2 7c3-4 5 4 10 0s7 4 10 0M2 12c3-4 5 4 10 0s7 4 10 0M2 17c3-4 5 4 10 0s7 4 10 0"/>',
  };

  const support = {
    planning: [
      { title: 'На пути к материнству', text: 'Когда очень хочется ребёнка, а ожидание становится непростым. Место для ваших чувств, сомнений и надежд.', icon: 'leaf' },
      { title: 'Поддержка в программе ЭКО', text: 'Бережное сопровождение на этапах лечения: как проживать неопределённость и находить опору в повседневности.', icon: 'sun' },
      { title: 'Вы и ваши отношения', text: 'Как говорить с партнёром о важном, слышать друг друга и оставаться близкими на общем пути.', icon: 'circles' },
    ],
    pregnancy: [
      { title: 'Тревога и новые чувства', text: 'В беременности бывает место и радости, и страху. Вместе разберёмся, что тревожит именно вас и какая поддержка сейчас нужна.', icon: 'leaf' },
      { title: 'Навстречу родам', text: 'Подготовка к встрече с малышом: ваши ожидания, страхи, внутренние опоры и доверие к себе.', icon: 'sun' },
      { title: 'Отношения в переменах', text: 'Как быть услышанной, говорить о своих потребностях и сохранять близость, когда привычная жизнь меняется.', icon: 'circles' },
    ],
    motherhood: [
      { title: 'Мама тоже нуждается в заботе', text: 'Усталость, новые роли и непривычные чувства после рождения ребёнка. Здесь можно говорить о своём опыте без оценки.', icon: 'heart' },
      { title: 'Найти место для себя', text: 'Как замечать свои потребности среди забот о малыше и искать посильные способы восстановления.', icon: 'leaf' },
      { title: 'Близость в новой семье', text: 'Распределение забот, поддержка партнёра и границы с близкими — то, о чём не всегда легко договориться самостоятельно.', icon: 'circles' },
    ],
    loss: [
      { title: 'Проживание утраты', text: 'Бережное пространство для горя, памяти и любых ваших чувств. Без требования «держаться» и без чужих сроков.', icon: 'waves' },
      { title: 'Быть рядом с близкими', text: 'Как рассказать о том, что с вами происходит, обозначить границы и попросить о той поддержке, которая вам подходит.', icon: 'heart' },
      { title: 'Ваш собственный темп', text: 'Маленькие опоры в повседневной жизни. Двигаться дальше можно только тогда и так, как это возможно для вас.', icon: 'horizon' },
    ],
  };

  function selectStage(stage, moveFocus = false) {
    if (!Object.hasOwn(support, stage)) return;
    $$('button[data-stage]').forEach((tab) => {
      const selected = tab.dataset.stage === stage;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });
    const cards = $('#support-cards');
    if (!cards) return;
    cards.setAttribute('aria-labelledby', `stage-${stage}`);
    cards.innerHTML = support[stage].map((card, index) => `
      <article class="support-card">
        <div class="card-top"><span class="card-number">0${index + 1}</span><svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[card.icon]}</svg></div>
        <h3>${card.title}</h3>
        <p>${card.text}</p>
        <button class="text-link" type="button" data-booking data-topic="${card.title}">Обсудить на консультации ${arrow}</button>
      </article>`).join('');
  }

  const header = $('#site-header');
  const menuToggle = $('#menu-toggle');
  const nav = $('#main-nav');
  function setMenu(open) {
    menuToggle?.setAttribute('aria-expanded', String(open));
    menuToggle?.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav?.classList.toggle('is-open', open);
  }
  menuToggle?.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a, [data-booking]')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
    const tab = event.target.closest('button[data-stage]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = $$('button[data-stage]');
    const current = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    selectStage(tabs[next].dataset.stage, true);
  });
  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  function updateDialogState() {
    document.documentElement.classList.toggle('dialog-open', Boolean($('dialog[open]')));
  }
  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    setMenu(false);
    dialog.showModal();
    updateDialogState();
  }
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', updateDialogState);
  });

  const educationDialog = $('#education-dialog');
  const certificateDialog = $('#certificate-dialog');
  const certificateImage = $('#certificate-image');
  const certificateCaption = $('#certificate-caption');
  let educationOpener = null;
  let certificateOpener = null;
  function openCertificate(button) {
    if (!certificateDialog || !certificateImage || !button.dataset.certificate) return;
    certificateOpener = button;
    certificateImage.src = button.dataset.certificate;
    certificateImage.alt = button.dataset.caption || 'Документ об образовании Ирины Ошемётковой';
    if (certificateCaption) certificateCaption.textContent = button.dataset.caption || 'Документ об образовании';
    educationDialog?.close();
    openDialog(certificateDialog);
  }
  $('#certificate-back')?.addEventListener('click', () => {
    certificateDialog?.close();
    openDialog(educationDialog);
    requestAnimationFrame(() => {
      if (educationDialog?.open && certificateOpener?.isConnected) certificateOpener.focus({ preventScroll: true });
    });
  });
  // Closing an enlarged document never returns keyboard focus into a hidden gallery.
  certificateDialog?.addEventListener('close', () => {
    requestAnimationFrame(() => {
      if (!$('dialog[open]') && educationOpener?.isConnected) educationOpener.focus({ preventScroll: true });
    });
  });
  educationDialog?.addEventListener('close', () => {
    requestAnimationFrame(() => {
      if (!$('dialog[open]') && educationOpener?.isConnected) educationOpener.focus({ preventScroll: true });
    });
  });

  const bookingDialog = $('#booking-dialog');
  const bookingForm = $('#booking-form');
  const bookingName = $('#booking-name');
  const bookingTopic = $('#booking-topic');
  const bookingReady = $('#booking-ready');
  const bookingMessage = $('#booking-message');
  const copyButton = $('#copy-message');
  let copyReset;
  function hidePreparedMessage() {
    if (bookingReady) bookingReady.hidden = true;
    if (copyButton) copyButton.textContent = 'Скопировать текст';
  }
  function openBooking(topic) {
    if (topic && bookingTopic) bookingTopic.value = topic;
    hidePreparedMessage();
    openDialog(bookingDialog);
  }
  if (bookingName) bookingName.required = true;
  bookingForm?.addEventListener('input', (event) => {
    if (event.target !== bookingMessage) hidePreparedMessage();
  });
  bookingForm?.addEventListener('change', hidePreparedMessage);
  bookingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;
    const name = bookingName?.value.trim() || '';
    if (!name) {
      bookingName?.setCustomValidity('Пожалуйста, напишите, как к вам обращаться.');
      bookingName?.reportValidity();
      return;
    }
    const format = $('input[name="format"]:checked', bookingForm)?.value === 'offline' ? 'очно' : 'онлайн';
    const topic = bookingTopic?.value.trim();
    const message = `Ирина, здравствуйте! Меня зовут ${name}. Хочу записаться на консультацию ${format}.${topic ? `\n\nМне хотелось бы обсудить: ${topic}` : ''}\n\nПодскажите, пожалуйста, какие есть свободные даты и как подготовиться к первой встрече?`;
    if (bookingMessage) bookingMessage.value = message;
    if (bookingReady) {
      bookingReady.hidden = false;
      bookingReady.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
    }
  });
  bookingName?.addEventListener('input', () => bookingName.setCustomValidity(''));
  copyButton?.addEventListener('click', async () => {
    if (!bookingMessage?.value) return;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookingMessage.value);
        copied = true;
      }
    } catch { /* The selected text remains available if clipboard access is blocked. */ }
    if (!copied) {
      bookingMessage.focus();
      bookingMessage.select();
      bookingMessage.setSelectionRange(0, bookingMessage.value.length);
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    copyButton.textContent = copied ? 'Скопировано ✓' : 'Выделено — нажмите Ctrl+C';
    clearTimeout(copyReset);
    copyReset = setTimeout(() => { copyButton.textContent = 'Скопировать текст'; }, 3500);
  });

  const practiceDialog = $('#practice-dialog');
  const practiceStart = $('#practice-start');
  const practiceReset = $('#practice-reset');
  const practiceOrb = $('#practice-orb');
  const practicePhase = $('#practice-phase');
  const practiceTime = $('#practice-time');
  const practiceHint = $('#practice-hint');
  const practiceProgress = $('#practice-progress');
  practicePhase?.setAttribute('aria-live', 'polite');
  practiceTime?.setAttribute('aria-live', 'off');
  let practiceInterval = null;
  let elapsedMs = 0;
  let startedAt = 0;
  let running = false;
  let lastPhase = '';
  function stopClock() {
    clearInterval(practiceInterval);
    practiceInterval = null;
  }
  function renderPractice() {
    const elapsed = Math.min(60000, elapsedMs + (running ? performance.now() - startedAt : 0));
    const seconds = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
    if (practiceTime) practiceTime.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const progress = elapsed / 600;
    if (practiceProgress) {
      practiceProgress.style.setProperty('--practice-progress', `${progress}%`);
      if (practiceProgress.tagName.toLowerCase() === 'circle') {
        practiceProgress.setAttribute('pathLength', '100');
        practiceProgress.style.strokeDasharray = '100';
        practiceProgress.style.strokeDashoffset = String(100 - progress);
      } else practiceProgress.style.width = `${progress}%`;
      practiceProgress.setAttribute('aria-valuenow', String(Math.round(progress)));
    }
    if (elapsed >= 60000) {
      elapsedMs = 60000;
      running = false;
      stopClock();
      if (practicePhase) practicePhase.textContent = 'Минута для себя';
      if (practiceHint) practiceHint.textContent = 'Практика завершена. Заметьте, как вы сейчас себя чувствуете. Можно просто побыть здесь ещё немного.';
      if (practiceStart) practiceStart.textContent = 'Повторить практику';
      practiceOrb?.classList.remove('breathing-in', 'breathing-out', 'is-paused');
      return;
    }
    if (!running) return;
    const phase = elapsed % 10000 < 4000 ? 'in' : 'out';
    if (lastPhase !== phase) {
      lastPhase = phase;
      if (practicePhase) practicePhase.textContent = phase === 'in' ? 'Мягкий вдох' : 'Спокойный выдох';
      if (practiceHint) practiceHint.textContent = 'Дышите без усилия. Вы можете выбрать свой ритм и остановиться в любой момент.';
      practiceOrb?.style.setProperty('--breath-duration', phase === 'in' ? '4s' : '6s');
      practiceOrb?.classList.toggle('breathing-in', phase === 'in');
      practiceOrb?.classList.toggle('breathing-out', phase === 'out');
    }
  }
  function resetPractice() {
    stopClock();
    elapsedMs = 0;
    running = false;
    lastPhase = '';
    practiceOrb?.classList.remove('breathing-in', 'breathing-out', 'is-paused');
    if (practiceStart) practiceStart.textContent = 'Начать практику';
    if (practicePhase) practicePhase.textContent = 'Побудьте с собой';
    if (practiceHint) practiceHint.textContent = 'Устройтесь удобно. Дышите в комфортном темпе, без задержек. При дискомфорте остановитесь.';
    renderPractice();
  }
  practiceStart?.addEventListener('click', () => {
    if (running) {
      elapsedMs += performance.now() - startedAt;
      running = false;
      stopClock();
      practiceOrb?.classList.add('is-paused');
      practiceStart.textContent = 'Продолжить';
      if (practicePhase) practicePhase.textContent = 'Пауза';
      if (practiceHint) practiceHint.textContent = 'Просто дышите так, как удобно вам. Продолжите, когда захотите.';
      renderPractice();
      return;
    }
    if (elapsedMs >= 60000) resetPractice();
    running = true;
    startedAt = performance.now();
    lastPhase = '';
    practiceOrb?.classList.remove('is-paused');
    practiceStart.textContent = 'Пауза';
    renderPractice();
    practiceInterval = setInterval(renderPractice, 100);
  });
  practiceReset?.addEventListener('click', resetPractice);
  practiceDialog?.addEventListener('close', resetPractice);
  // Returning to a hidden tab never advances the practice without the visitor.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) practiceStart?.click();
  });

  const articles = {
    anxiety: {
      title: 'Когда тревоги становится много',
      paragraphs: [
        'Ожидание ребёнка может сопровождаться самыми разными переживаниями. Иногда тревога появляется даже тогда, когда внешне всё спокойно. Ваши чувства не делают вас «неправильной» будущей мамой.',
        'Попробуйте заметить, что именно занимает ваши мысли: конкретный вопрос, неопределённость или усталость от большого количества информации. Это разные ситуации, и поддержка в них тоже может быть разной.',
        'Необязательно справляться со всем самостоятельно. Если тревога мешает обычной жизни, об этом можно поговорить с психологом, а вопросы о физическом самочувствии обсудить с вашим врачом.',
      ],
      steps: ['Назовите про себя то, что чувствуете, без оценки: «Сейчас мне тревожно».', 'Отделите то, что вы знаете, от того, что пока только предполагаете.', 'Выберите один посильный шаг: сделать паузу в чтении новостей, записать вопрос или попросить близкого побыть рядом.'],
    },
    support: {
      title: 'Как попросить о поддержке',
      paragraphs: [
        'Близкие не всегда понимают, какая помощь нужна, даже когда очень хотят поддержать. Просьба о конкретном действии часто понятнее, чем ожидание, что другой человек догадается сам.',
        'Поддержка может выглядеть по-разному: разговор без советов, приготовленный ужин, прогулка вместе или время на отдых. Вы вправе выбирать то, что подходит именно вам.',
        'Если договориться с первого раза не получилось, это не отменяет ваших потребностей. Можно вернуться к разговору в более спокойный момент и вместе поискать выполнимый вариант.',
      ],
      steps: ['Начните с себя: «Я устала и мне сейчас нужна помощь».', 'Сформулируйте одну конкретную просьбу: «Можешь сегодня взять на себя ужин?»', 'Уточните, какая поддержка вам важна: «Мне сейчас хочется, чтобы меня выслушали, без советов».'],
    },
    selfcare: {
      title: 'Забота о себе без чувства вины',
      paragraphs: [
        'Забота о себе не обязана быть большим планом или ещё одной задачей, с которой нужно отлично справиться. Иногда это стакан воды, удобное положение или несколько минут тишины.',
        'Когда ресурсов мало, привычные советы могут звучать недостижимо. Вместо идеального режима можно искать самое маленькое действие, доступное сегодня, и замечать реальную помощь, которая вам нужна.',
        'Ваши потребности имеют значение рядом с потребностями ребёнка и семьи. Не нужно сначала заслужить право на отдых или дождаться, когда все дела будут закончены.',
      ],
      steps: ['Спросите себя: «Что сейчас было бы для меня чуть бережнее?»', 'Выберите одно небольшое действие, на которое действительно есть силы.', 'Подумайте, что можно упростить, отложить или разделить с кем-то из близких.'],
    },
  };
  function openArticle(id) {
    const article = articles[id];
    if (!article) return;
    const title = $('#article-title');
    const body = $('#article-body');
    if (title) title.textContent = article.title;
    if (body) body.innerHTML = `${article.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}<h3>Небольшие шаги, которые можно попробовать</h3><ol>${article.steps.map((step) => `<li>${step}</li>`).join('')}</ol><p class="article-note">Этот текст — повод прислушаться к себе. Индивидуальную ситуацию можно обсудить на консультации.</p>`;
    const booking = $('#article-booking');
    if (booking) booking.dataset.topic = article.title;
    openDialog($('#article-dialog'));
  }

  const moods = {
    tired: { text: 'Похоже, сейчас вам особенно нужна забота. Разрешите себе маленькую паузу — здесь ничего не нужно успевать.', action: '<button type="button" class="text-link" data-practice>Минута для себя <span aria-hidden="true">↗</span></button>' },
    anxious: { text: 'Спасибо, что заметили это чувство. Можно на минуту вернуться к своему дыханию, если сейчас вам это комфортно.', action: '<button type="button" class="text-link" data-practice>Попробовать практику <span aria-hidden="true">↗</span></button>' },
    okay: { text: 'Хорошо, что сейчас есть немного спокойствия. Можно заметить, что помогает вам чувствовать себя именно так, и взять это с собой.', action: '<a class="text-link" href="#support">Посмотреть, чем я могу помочь <span aria-hidden="true">↗</span></a>' },
  };
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;
    const close = target.closest('[data-close]');
    if (close) { close.closest('dialog')?.close(); return; }
    if (target.closest('[data-privacy]')) {
      event.preventDefault();
      openDialog($('#privacy-dialog'));
      return;
    }
    const education = target.closest('[data-education]');
    if (education) {
      event.preventDefault();
      educationOpener = education;
      openDialog(educationDialog);
      return;
    }
    const certificate = target.closest('#education-grid [data-certificate]');
    if (certificate) {
      event.preventDefault();
      openCertificate(certificate);
      return;
    }
    const stage = target.closest('button[data-stage]');
    if (stage) { selectStage(stage.dataset.stage); return; }
    const booking = target.closest('[data-booking]');
    if (booking) {
      event.preventDefault();
      const currentDialog = booking.closest('dialog');
      if (currentDialog && currentDialog !== bookingDialog) currentDialog.close();
      openBooking(booking.dataset.topic);
      return;
    }
    if (target.closest('[data-practice]')) {
      event.preventDefault();
      openDialog(practiceDialog);
      return;
    }
    const article = target.closest('[data-article]');
    if (article) { event.preventDefault(); openArticle(article.dataset.article); return; }
    const mood = target.closest('button[data-mood]');
    if (mood && moods[mood.dataset.mood]) {
      $$('#mood-options button[data-mood]').forEach((button) => {
        const active = button === mood;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      const response = $('#mood-response');
      const content = moods[mood.dataset.mood];
      if (response) {
        response.hidden = false;
        response.innerHTML = `<p>${content.text}</p>${content.action}`;
      }
    }
  });

  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    reveals.forEach((element) => observer.observe(element));
  } else reveals.forEach((element) => element.classList.add('is-visible'));
  const year = $('#current-year');
  if (year) year.textContent = String(new Date().getFullYear());
  selectStage('pregnancy');
  resetPractice();
})();
