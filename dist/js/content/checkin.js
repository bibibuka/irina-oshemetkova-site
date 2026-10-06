// «Как ты сейчас?» — the bot's checkin_2…10 pools, curated for the site: the site
// does not record anything, so no «записала»; it is not present, so no «я рядом».

export const MOODS = {
  good: 'хорошо', ok: 'нормально', meh: 'так себе', hard: 'тяжело', 'very-hard': 'очень тяжело',
};

export const CHECKIN = {
  good: [
    'Можно просто побыть в этом хорошем.', 'Хорошо тоже заслуживает отметки.', 'Сегодня можно заметить и приятное.',
    'Необязательно делать хороший день ещё продуктивнее.', 'Можно просто порадоваться своему самочувствию.',
    'Можно никуда не торопиться из этого состояния.', 'Приятно отметить такой момент.',
  ],
  ok: [
    'Ровный день — тоже хороший день.', '«Нормально» тоже стоит отмечать.', 'Можно не искать более яркое слово.',
    'Дню не обязательно быть особенным.', 'Не нужно придумывать вывод.', 'Обычные дни тоже составляют историю.',
    'Не каждый день требует большого рассказа.',
  ],
  meh: [
    '«Так себе» — честный ответ, и это важно.', 'Бывают дни, которые просто нужно прожить.', 'Не нужно называть это хорошим состоянием.',
    'Можно не объяснять всё прямо сейчас.', 'Сегодня можно выбирать что-то посильное.', 'Необязательно находить одну причину.',
    'Можно дать этому состоянию место.', 'Точного названия чувств не требуется.', 'Сейчас можно не требовать от себя большего.',
  ],
  hard: [
    'Слышу, что сейчас тяжело. Не нужно делать вид, что всё нормально.', 'Тяжёлые дни тоже часть пути, и ты не одна в них.',
    'Можно начать с того, что сейчас посильно.', 'Необязательно объяснять, почему тяжело.', 'Можно не пытаться исправить весь день сразу.',
    'Тебе не нужно доказывать, что это трудно.', 'Поддержку можно попросить даже без подробного рассказа.', 'Сложный день не нужно описывать красиво.',
  ],
  'very-hard': [
    'Слышу, как тебе сейчас тяжело. Спасибо, что сказала, — это уже шаг.', 'Когда очень тяжело, не нужно справляться одной.',
    'Не нужно искать более мягкое слово.', 'Можно попросить поддержки, не объясняя всё сразу.',
    'Дальше можно идти совсем небольшими шагами.', 'Слова «очень тяжело» уже передают важное.',
  ],
};

/** Next steps. `action` goes through the action registry, `href` is a plain link, `sheet` opens a sheet. */
export const STEPS = {
  breath36: { icon: 'wave', label: 'Подышать со мной', sub: '≈ 1 мин, длинный выдох', action: 'breathe', data: { pattern: '36', length: '60', start: 'true' }, breathing: true },
  square: { icon: 'wave', label: 'Подышать квадратом', sub: '4–4–4–4, ровный ритм', action: 'breathe', data: { pattern: 'square', length: '60', start: 'true' }, breathing: true },
  grounding: { icon: 'eye', label: 'Вернуться в момент', sub: '5-4-3-2-1, ≈ 2 мин', action: 'practice', data: { practice: 'grounding' } },
  feelings: { icon: 'body', label: 'Контакт с чувствами', sub: '≈ 3 мин, можно без слов', action: 'practice', data: { practice: 'feelings' } },
  envelope: { icon: 'envelope', label: 'Отложить мысли до утра', sub: 'конверт подождёт', action: 'practice', data: { practice: 'envelope' } },
  thought: { icon: 'pencil', label: 'Разобрать мысль', sub: '≈ 3 минуты', href: '#razbor' },
  words: { icon: 'quote', label: 'Найти слова для близкого', sub: 'готовые фразы', href: '#slova', words: 'partner' },
  stopWords: { icon: 'quote', label: 'Стоп-фразы для советчиков', sub: 'спокойно и твёрдо', href: '#slova', words: 'advice' },
  guests: { icon: 'people', label: 'Меню помощи для гостей', sub: 'что принести и чем помочь', href: '#slova', words: 'family' },
  deck: { icon: 'leaf', label: 'Вытянуть опору', sub: 'одна короткая фраза', href: '#opory' },
  bot: { icon: 'chat', label: 'Карманная версия', sub: 'бот для дней между встречами', href: '#bot' },
  write: { icon: 'envelope', label: 'Написать Ирине', sub: 'письмо соберётся само', action: 'write' },
  stop: { icon: 'anchor', label: 'Экстренная остановка', sub: 'пять шагов, по одному', action: 'stop' },
  choose: { icon: 'shuffle', label: 'Выбери за меня', sub: 'когда сил на выбор мало', action: 'choose-practice' },
};

export const ROUTES = {
  good: ['deck', 'bot'],
  ok: ['deck', 'grounding'],
  meh: ['breath36', 'grounding', 'deck'],
  hard: ['breath36', 'feelings', 'write'],
};

/** «Что сейчас громче?» — refines the route. `night` steps are added in the evening and at night. */
export const LOUDER = {
  anxiety: { steps: ['breath36', 'grounding'], night: 'envelope', topic: 'тревога' },
  tired: { steps: ['feelings', 'deck'], postpartum: 'guests', topic: 'усталость' },
  loop: { steps: ['thought', 'grounding'], night: 'envelope', topic: 'мысли, которые не отпускают' },
  lonely: { steps: ['words', 'bot', 'write'], topic: 'одиночество' },
  anger: { steps: ['square', 'stopWords', 'feelings'], topic: 'злость и раздражение' },
  empty: { steps: ['feelings', 'deck', 'write'], topic: 'пустота' },
  unknown: { steps: ['choose', 'deck'], topic: '' },
};

export const MOOD_TOPIC = { hard: 'сейчас тяжело', 'very-hard': 'сейчас очень тяжело' };
