// hud-manager/adapt-prompt.js
//
// Самоподстраивающийся промт: какие поля модель регулярно оставляет пустыми —
// тем одна короткая строка-напоминание в инструкции.
//
// Счёт — на чат и на модель (метаданные чата, ключ — модель). Одна модель
// всегда забывает мысли, другая — гороскоп; общий счётчик после смены модели
// усиливал бы то, что у новой и так в порядке, и тратил токены впустую.
//
// Четыре ограничения, без которых это вредно:
//  • минимум наблюдений (hudAdaptMin, 12 ходов, где поле было нужно) — иначе
//    случайный пропуск во втором ходу навсегда добавил бы строку;
//  • потолок — три поля и одна строка: усиление платится токенами;
//  • забывание — скользящее окно последних 50 ходов: модель обновили, она
//    стала лучше — промт это заметит;
//  • не усиливать выключенное: пропуск снов при выключенных снах — решение
//    человека, а не ошибка модели.

import { settings } from './settings.js?v=23.48.3';
import { extractHudBlock } from './hud-block.js?v=23.48.3';
import { HUDвКодах, непусто } from './hud-snapshot.js?v=23.48.3';

const КЛЮЧ = 'tavernosHudFieldStats';
const ОКНО = 50;

// Поля, которые схема требует каждый ход (как в hud-check.js → чегоНеХватает),
// и что выключает каждое. Подпись — для модели и для панели бюджета.
export const ПОЛЯ = {
  Th: { имя: 'мысли', модели: 'Th (thoughts)', вкл: () => true },
  Ex: { имя: 'ожидание и реальность', модели: 'Ex (expectation vs reality)', вкл: () => true },
  dy: { имя: 'дневник', модели: 'dy (diary)', вкл: () => !!settings.enableDiary },
  zd: { имя: 'гороскоп', модели: 'wd.zd (horoscope)', вкл: () => !!settings.enableWorld && settings.enableHoroscope !== false },
};

const объект = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const МЕТКА = /<\s*new this turn\b[^>]*>/i;
function заполнено(v) {
  if (Array.isArray(v)) return v.some(заполнено);
  if (объект(v)) return Object.values(v).some(заполнено);
  return непусто(v) && !МЕТКА.test(String(v));
}

/** Что было нужно в этом ходу и что из этого пусто: { код: true (пропущено) | false }. */
export function наблюденияПолей(текст) {
  const блок = extractHudBlock(String(текст || ''));
  if (!блок) return null;
  const к = HUDвКодах(блок);
  if (!к) return null;
  const люди = (Array.isArray(к.cs) ? к.cs : []).filter(объект);
  const out = {};
  if (люди.length) {
    out.Th = люди.some(c => !заполнено(c.Th));
    out.Ex = люди.some(c => !заполнено(c.Ex));
    if (ПОЛЯ.dy.вкл()) out.dy = !заполнено(к.dy);
  }
  if (ПОЛЯ.zd.вкл()) out.zd = !заполнено(к.wd && к.wd.zd);
  return out;
}

// Модель, которой сейчас идёт запрос: у каждой — свой счёт.
export function профильМодели() {
  try {
    const c = window.SillyTavern?.getContext?.();
    const модель = c?.getChatCompletionModel?.() || c?.chatCompletionSettings?.model || c?.textCompletionSettings?.model || c?.onlineStatus || '';
    return String((c?.mainApi || c?.main_api || '') + ':' + модель).slice(0, 120) || 'default';
  } catch (_) { return 'default'; }
}

function хранилище(мета, создать = false) {
  if (!мета) return null;
  if (!объект(мета[КЛЮЧ])) { if (!создать) return null; мета[КЛЮЧ] = {}; }
  return мета[КЛЮЧ];
}

/** Учесть ответ: наблюдения → окно последних 50 по каждому полю. true — записали. */
export function учестьОтвет(мета, профиль, наблюдения) {
  if (!наблюдения || !Object.keys(наблюдения).length) return false;
  const х = хранилище(мета, true);
  if (!х) return false;
  const п = х[профиль] = объект(х[профиль]) ? х[профиль] : {};
  for (const [код, пропущено] of Object.entries(наблюдения)) {
    const ряд = Array.isArray(п[код]) ? п[код] : [];
    ряд.push(пропущено ? 1 : 0);
    п[код] = ряд.slice(-ОКНО);
  }
  return true;
}

/** Статистика модели: [{ код, имя, нужен, пропущен, доля }], самые забываемые первыми. */
export function статистикаПолей(мета, профиль) {
  const п = (хранилище(мета) || {})[профиль] || {};
  return Object.entries(п).filter(([код, ряд]) => ПОЛЯ[код] && Array.isArray(ряд) && ряд.length)
    .map(([код, ряд]) => { const пропущен = ряд.reduce((s, x) => s + (x ? 1 : 0), 0); return { код, имя: ПОЛЯ[код].имя, нужен: ряд.length, пропущен, доля: пропущен / ряд.length }; })
    .sort((a, b) => b.доля - a.доля);
}

/** Слабые поля модели: не больше трёх, минимум наблюдений, доля пропусков > 30%, только включённые. */
export function слабыеПоля(мета, профиль, минимум = Number(settings.hudAdaptMin) || 12) {
  return статистикаПолей(мета, профиль)
    .filter(с => с.нужен >= минимум && с.доля > 0.3 && ПОЛЯ[с.код].вкл())
    .slice(0, 3);
}

/** Строка в инструкцию; пусто — усиливать нечего или выключено. */
export function строкаУсиления(мета, профиль) {
  if (settings.hudAdaptPrompt === false) return '';
  const слабые = слабыеПоля(мета, профиль);
  if (!слабые.length) return '';
  return `You regularly leave ${слабые.map(с => ПОЛЯ[с.код].модели).join(', ')} empty. Fill them every turn.`;
}
