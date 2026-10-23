// «Письмо Ирине». The visitor writes to Irina on «вы»; the form itself speaks on «ты».
// Sentences are gender-neutral («Хочу записаться»), because partners write too.

export const TOPICS = {
  default: ['тревога в беременности', 'ЭКО и ожидание', 'усталость после родов', 'отношения в паре', 'утрата', 'пока не знаю'],
  planning: ['ЭКО и ожидание', 'тревога', 'отношения в паре', 'пока не знаю'],
  pregnancy: ['тревога в беременности', 'страх родов', 'отношения в паре', 'пока не знаю'],
  postpartum: ['усталость после родов', 'отношения в паре', 'границы с родными', 'пока не знаю'],
  loss: ['утрата', 'отношения в паре', 'беременность после утраты', 'пока не знаю'],
  close: ['отношения в паре', 'как поддержать близкую', 'пока не знаю'],
};

export const FORMAT_SENTENCE = {
  online: 'Хочу записаться на консультацию онлайн.',
  spb: 'Хочу записаться на очную консультацию в Петербурге.',
  pair: 'Мы хотим записаться на консультацию вдвоём.',
  unknown: 'Хочу записаться на консультацию.',
};

/** «Как ты обо мне узнала?» — Irina wants to know where people come from. The answer only goes
 *  into the letter the visitor sends herself; the site neither sees nor keeps it. */
export const SOURCES = {
  doctor: 'от врача', friends: 'от знакомых', telegram: 'из Telegram', search: 'из поиска',
};
export const SOURCE_LINE = 'Откуда я о вас знаю:';

export const GREETING = 'Ирина, здравствуйте!';
export const CLOSING = 'Подскажите, пожалуйста, ближайшие свободные даты?';
export const SUBJECT = 'Запись на консультацию';

export const SENT = 'Хорошо, что ты выбираешь заботу о себе.';
