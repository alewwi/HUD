// hud-manager/render/powers.js
//
// Силы фэнтези (era.js) — в обеих эпохах и при обоих уровнях магии. Части
// те же, слова свои: в приземлённом — врождённые дары (стихии, духи, ци), в
// явной магии — школы и заклинания (порталы, иллюзии, проклятия, обереги).
// Пять частей:
//
//   · Мана — метка mn в «Состоянии тела» (Bs). Тратится на дар, а
//     возвращается по времени сцены: ~10 за час отдыха, ночь сна — полностью.
//     HUD сам знает время сцены, поэтому считает, когда мана будет полной,
//     и напоминает модели, сколько её было на прошлом ходу.
//   · Способности (Ab) — что человек умеет, на каком уровне, чего дар НЕ
//     может и чего стоит. Модель держит силу в этих рамках.
//   · Отдача — перенапряжение уходит в «Болезни и травмы» записью
//     «отдача: …» одной из четырёх ступеней: головокружение, кровь из носа,
//     обморок, тяжёлая травма. Срок у ступени свой; HUD отсчитывает его по
//     времени сюжета от первого хода, где отдача появилась.
//   · Чары (Ef) — что на человеке действует сейчас и до какого часа. Остаток
//     HUD считает сам по времени сцены, истёкшее напоминает снять.
//   · Тело и сила — цикл, беременность, раны и усталость меняют контроль над
//     даром. HUD это уже знает; по настройке (settings.powersBody) подсказывает
//     модели, показывает в карточке, или и то и другое.
//
// Модель пишет это в любом фэнтези (силыВМире), вид зависит только от
// данных. Вне фэнтези записанное не показываем.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { settings } from '../settings.js?v=23.89.64';
import { магияВМире, заклинанияВМире } from '../era.js?v=23.89.64';
import { escapeHtml, перевестиМетку } from '../utils.js?v=23.89.64';
import { видБлока } from './views.js?v=23.89.64';
import { рисунокАтласа } from './power-atlas.js?v=23.89.64';

/* --- Включено ли ----------------------------------------------------------- */

/** Модель ведёт силы: в мире есть магия — скрытая или общедоступная. */
export const силыВМире = () => магияВМире();
/** Подпись блока чар: в явной магии — «Чары» (заклинания, проклятия,
 *  обереги), в приземлённой — «Эффекты» (метка духа, перекрытая ци, яд). */
export const имяЧар = () => (заклинанияВМире() ? 'Чары' : 'Эффекты');
/** Записанное показываем, пока в мире есть магия. */
export const силыНаЭкране = () => магияВМире();
/** Часть сил включена: mana | abilities | effects | backlash. */
export const частьСил = (к) => settings[{ mana: 'powersMana', abilities: 'powersAbilities', effects: 'powersEffects', backlash: 'powersBacklash' }[к]] !== false;
/** Тело и сила: 'both' | 'model' | 'me' | 'off'. */
export const телоИСила = () => (['both', 'model', 'me', 'off'].includes(settings.powersBody) ? settings.powersBody : 'both');

/** Маны за час отдыха; ночь сна возвращает всё. */
export const МАНА_В_ЧАС = 10;

/* --- Разбор ---------------------------------------------------------------- */

const Ч = 3600000;
const пусто = (v) => { const s = String(v ?? '').trim(); return !s || /^(empty|none|null|nc|нет|пусто)$/i.test(s); };
const э = (s) => escapeHtml(String(s ?? ''));

/** «nm: …; mst: …» → { 'что это': …, 'мастерство': … } (метки и коды, и по-русски). */
export function поМеткамСил(группа) {
  const out = {};
  String(группа || '').split(/;|\n/).forEach(часть => {
    const m = часть.match(/^\s*([^:：]{1,30})[:：]\s*(.*)$/);
    if (!m) { if (часть.trim() && !out['что это']) out['что это'] = часть.trim(); return; }
    out[перевестиМетку(m[1]).toLowerCase().trim()] = m[2].trim();
  });
  return out;
}
const группы = (текст) => (пусто(текст) ? [] : String(текст).split(/\s*\|\s*|\n{2,}/).filter(г => !пусто(г)));

// Уровни мастерства: четыре шага.
const УРОВНИ = [
  [/master|мастер|виртуоз|велик/i, 4, 'мастер'],
  [/adept|опытн|адепт|сильн|продвин/i, 3, 'опытный'],
  [/trained|обучен|умел|ученик|средн/i, 2, 'обученный'],
  [/novice|нович|начина|слаб|пробужд|зачат/i, 1, 'новичок'],
];
function уровень(текст) {
  const у = УРОВНИ.find(([rx]) => rx.test(String(текст || '')));
  return у ? { n: у[1], имя: у[2] } : null;
}

/** Способности: [{ что, уровень, может, предел, цена }]. */
export function разобратьСпособности(текст) {
  return группы(текст).map(г => {
    const п = поМеткамСил(г);
    const что = п['что это'] || п['дар'] || '';
    if (!что) return null;
    return { что, уровень: уровень(п['мастерство'] || п['уровень']), мастерство: п['мастерство'] || п['уровень'] || '',
      может: п['может'] || '', предел: п['предел'] || п['не может'] || '', цена: п['цена'] || '' };
  }).filter(Boolean);
}

/** Чары: [{ что, источник, до, проявление }]. */
export function разобратьЧары(текст) {
  return группы(текст).map(г => {
    const п = поМеткамСил(г);
    const что = п['что это'] || '';
    if (!что) return null;
    return { что, источник: п['источник'] || '', до: п['до'] || '', проявление: п['симптомы'] || п['проявление'] || '' };
  }).filter(Boolean);
}

/* --- Время сцены ----------------------------------------------------------- */

// «21:40 | поздний вечер» → минуты от полуночи.
export function минутыИзВремени(т) {
  const m = String(т || '').match(/(\d{1,2})[:.](\d{2})/);
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}
// «17.10.2024» → полночь UTC; без даты — null.
function датаМс(т, годЗапас = null) {
  const s = String(т || '');
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) { const y = +m[3]; return Date.UTC(y < 100 ? 2000 + y : y, +m[2] - 1, +m[1]); }
  m = s.match(/(?:^|[^\d.:])(\d{1,2})\.(\d{1,2})(?![.\d:])/);
  if (m && годЗапас && +m[2] >= 1 && +m[2] <= 12) return Date.UTC(годЗапас, +m[2] - 1, +m[1]);
  return null;
}
/** Миг сцены в мс (UTC-часы как часы сюжета) или null. */
export function мигСцены(дата, время) {
  const д = датаМс(дата), м = минутыИзВремени(время);
  if (м === null) return null;
  return (д ?? 0) + м * 60000;
}
/** «до 23:30» / «19.10 08:00» / «завтра 07:00» → мс или null. Без даты — ближайшее
 *  такое время: прошедшее меньше 12 ч назад — сегодня (срок вышел), иначе завтра. */
export function мигДо(до, сейчас) {
  if (!Number.isFinite(сейчас)) return null;
  const s = String(до || '');
  const м = минутыИзВремени(s.replace(/\d{1,2}\.\d{1,2}(?:\.\d{2,4})?/, ' '));
  const год = new Date(сейчас).getUTCFullYear();
  const д = датаМс(s, год);
  const полночь = Math.floor(сейчас / 864e5) * 864e5;
  if (д !== null) return д + (м ?? 0) * 60000;
  if (м === null) return null;
  let миг = полночь + м * 60000;
  if (/завтра|tomorrow/i.test(s)) миг += 864e5;
  else if (сейчас - миг > 12 * Ч) миг += 864e5;
  return миг;
}
/** «ещё 1 ч 20 мин» / «ещё 3 дн.» по миллисекундам. */
export function сколькоОсталось(мс) {
  if (!Number.isFinite(мс)) return '';
  if (мс <= 0) return 'истекло';
  const мин = Math.round(мс / 60000);
  if (мин < 60) return `ещё ${Math.max(1, мин)} мин`;
  const ч = Math.floor(мин / 60), ост = мин % 60;
  if (ч < 48) return `ещё ${ч} ч${ост ? ` ${ост} мин` : ''}`;
  return `ещё ${Math.round(ч / 24)} дн.`;
}
const чч = (мс) => { const д = new Date(мс); return String(д.getUTCHours()).padStart(2, '0') + ':' + String(д.getUTCMinutes()).padStart(2, '0'); };

/* --- Отдача ---------------------------------------------------------------- */

// Четыре ступени по силе перенапряжения. Срок — сколько часов сюжета держится.
export const СТУПЕНИ_ОТДАЧИ = [
  { n: 1, имя: 'головокружение', часов: 1, rx: /головокруж|кружится голова|мутит|темнеет в глазах|dizz|lighthead/iu },
  { n: 2, имя: 'кровь из носа', часов: 3, rx: /кровь из носа|носов\p{L}* кровотеч|кровотечени\p{L}* из носа|nosebleed|bloody nose/iu },
  { n: 3, имя: 'обморок', часов: 12, rx: /обморок|потер\p{L}* сознан|без сознания|отключил|faint|black(?:ed)? out|passed out|unconscious/iu },
  { n: 4, имя: 'тяжёлая травма', часов: 240, rx: /тяж[её]л\p{L}*|выгор|надорв|разрыв|ожог канал|кома|severe|burn(?:ed|t)? out|torn|coma/iu },
];
const ЭТО_ОТДАЧА = /отдач|перенапряж|надрыв дара|перегруз\p{L}* дар|backlash|overstrain/iu;
/** Запись болезни — отдача дара? Тогда её ступень (1–4), иначе 0. */
export function ступеньОтдачи(что, симптомы = '') {
  if (!ЭТО_ОТДАЧА.test(String(что || ''))) return 0;
  const текст = String(что || '') + ' ' + String(симптомы || '');
  let n = 0;
  for (const с of СТУПЕНИ_ОТДАЧИ) if (с.rx.test(текст)) n = Math.max(n, с.n);
  return n || 1;
}
/** Лесенка отдачи для карточки болезни: четыре шага, текущий горит. */
export function лесенкаОтдачи(n, осталосьЧ = null) {
  if (!n) return '';
  const шаги = СТУПЕНИ_ОТДАЧИ.map(с => `<li class="${с.n < n ? 'is-past' : с.n === n ? 'is-now' : ''}"><i aria-hidden="true"></i><span>${э(с.имя)}</span></li>`).join('');
  const срок = n < 4 && Number.isFinite(осталосьЧ)
    ? (осталосьЧ > 0 ? `<small class="hud-bl-left">пройдёт через ~${осталосьЧ < 1 ? Math.max(5, Math.round(осталосьЧ * 60)) + ' мин' : Math.round(осталосьЧ) + ' ч'}</small>`
      : '<small class="hud-bl-left is-over">срок вышел — должно пройти</small>')
    : n < 4 ? `<small class="hud-bl-left">держится ~${СТУПЕНИ_ОТДАЧИ[n - 1].часов} ч</small>` : '';
  // Узкая карточка: подписи у точек прячутся, текущая ступень — одной строкой.
  const сейчас = `<b class="hud-bl-now">${n} из 4 · ${э(СТУПЕНИ_ОТДАЧИ[n - 1].имя)}</b>`;
  return `<div class="hud-bl" style="--bl:${n}"><ol>${шаги}</ol>${сейчас}${срок}</div>`;
}

/* --- Тело и сила ------------------------------------------------------------ */

// Поле по любому из имён (в карточке русские названия, в снимке — коды).
function поле(о, ...имена) {
  if (!о || typeof о !== 'object') return '';
  const низ = имена.map(и => и.toLowerCase());
  const к = Object.keys(о).find(k => низ.includes(k.toLowerCase()));
  const v = к ? о[к] : '';
  const s = typeof v === 'string' ? v : v && typeof v === 'object' ? Object.entries(v).map(([a, b]) => `${a}: ${b}`).join('; ') : String(v ?? '');
  return пусто(s) ? '' : s;
}
const число = (s) => { const m = String(s ?? '').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };

/** Мана из «Состояния тела»: число 0–100 или null. */
export function манаИз(bs) {
  const п = поМеткамСил(bs);
  const v = п['мана'] ?? п['mana'];
  const n = число(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

/**
 * Что в теле сейчас меняет силу. [{ знак: 'up'|'down', что, как, модели }].
 * up — сила рвётся, контроль слабее; down — дар слабее, звать его труднее.
 */
export function телоМеняетСилу(о, датаСцены = null) {
  const ф = [];
  const цикл = поМеткамСил(поле(о, 'Цикл', 'Mns', 'Менструальный цикл'));
  const фаза = String(цикл['фаза'] || '').toLowerCase();
  const день = число(цикл['день цикла']), длина = число(цикл['длина цикла']) || 28;
  let пмс = false;
  const окно = String(цикл['пмс'] || '').split(/[–—-]/);
  const сегодня = датаМс(датаСцены);
  if (сегодня !== null && окно.length === 2) {
    const год = new Date(сегодня).getUTCFullYear();
    const а = датаМс(окно[0], год), б = датаМс(окно[1], год);
    if (а !== null && б !== null) пмс = сегодня >= а && сегодня <= б;
  }
  if (!пмс && /luteal|лютеин/.test(фаза) && день && длина - день <= 5) пмс = true;
  if (!/paused|пауз/.test(фаза)) {
    if (/ovulat|овуляц/.test(фаза)) ф.push({ знак: 'up', что: 'Овуляция', как: 'сила на подъёме и рвётся наружу — держать её труднее', модели: 'ovulation — the gift surges and is harder to hold back; a burst can come out stronger than meant' });
    else if (/menstru|менстр|месячн/.test(фаза)) ф.push({ знак: 'down', что: 'Месячные', как: 'дар тише, спазмы сбивают сосредоточенность', модели: 'her period — the gift runs lower and cramps break her focus' });
    if (пмс) ф.push({ знак: 'up', что: 'ПМС', как: 'сила вспыхивает от эмоций, контроль хуже', модели: 'PMS — the gift flares with emotion, control is shaky' });
  }
  const срок = число(поМеткамСил(поле(о, 'Беременность', 'Prg'))['неделя']);
  if (срок && срок >= 28) ф.push({ знак: 'down', что: `Беременность, ${срок}-я неделя`, как: 'тело на первом месте: силу звать тяжелее, перенапряжение опасно для малыша', модели: `late pregnancy (week ${срок}) — the body comes first: the gift is heavy to call, and overstrain endangers the baby` });
  else if (срок && срок <= 12) ф.push({ знак: 'down', что: `Беременность, ${срок}-я неделя`, как: 'тошнота и усталость сбивают сосредоточенность', модели: `early pregnancy (week ${срок}) — nausea and fatigue break concentration` });
  else if (срок) ф.push({ знак: 'up', что: `Беременность, ${срок}-я неделя`, как: 'сила ровнее, но вспыхивает, когда защищает', модели: `pregnancy (week ${срок}) — steadier, but the gift flares when protecting` });
  const болезни = группы(поле(о, 'Болезни и травмы', 'Ill')).map(поМеткамСил);
  if (болезни.some(б => ступеньОтдачи(б['что это'], б['симптомы']))) ф.push({ знак: 'down', что: 'Отдача', как: 'уже перенапряжён: новое сильное усилие — следующая ступень отдачи', модели: 'already in backlash — any strong use now risks the next backlash stage' });
  const рана = болезни.find(б => !ступеньОтдачи(б['что это'], б['симптомы']) && /fresh|worsen|свеж|ухудш/i.test(б['стадия'] || ''));
  if (рана) ф.push({ знак: 'down', что: 'Рана', как: `${рана['что это'] || 'свежая травма'} — боль сбивает, дар слабее`, модели: `a fresh wound (${рана['что это'] || 'injury'}) — pain breaks focus, the gift is weaker` });
  const bs = поМеткамСил(поле(о, 'Состояние тела', 'Bs'));
  const силы = число(bs['энергия']), стресс = число(bs['стресс']), мана = манаИз(поле(о, 'Состояние тела', 'Bs'));
  if (силы !== null && силы <= 20) ф.push({ знак: 'down', что: 'Без сил', как: 'дар отзывается вяло', модели: 'exhausted — the gift answers sluggishly' });
  if (стресс !== null && стресс >= 80) ф.push({ знак: 'up', что: 'На пределе', как: 'сила срывается с эмоциями', модели: 'on edge — the gift slips out with emotion' });
  if (мана !== null && мана <= 15) ф.push({ знак: 'down', что: 'Мана на исходе', как: 'сильное усилие сейчас — почти наверняка отдача', модели: `mana nearly gone (${мана}) — a strong effort now almost surely means backlash` });
  return ф;
}

/* --- Разметка --------------------------------------------------------------- */

const ПУТИ = {
  fire: 'M12 21c-3.6 0-6-2.5-6-5.8 0-3.4 2.8-5.2 3.4-8.7 1.9 1.4 2.9 3.3 2.9 5.2.9-.7 1.5-1.9 1.7-3.1 2.3 1.9 4 4.2 4 6.6 0 3.3-2.5 5.8-6 5.8Z',
  water: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z M9 14.5a3 3 0 0 0 3 3',
  earth: 'M3 19 9.5 8l3.6 5.9 2.4-3.4L21 19Z M8 19l2.5-4',
  air: 'M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5 M3 13.5h14.5a2.5 2.5 0 1 1-2.5 2.5 M3 18h6',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6Z',
  spirit: 'M12 3c-4 0-6.5 3-6.5 7v10l2.2-1.6L10 20l2-1.6 2 1.6 2.3-1.6 2.2 1.6V10c0-4-2.5-7-6.5-7Z M9.5 10h.01 M14.5 10h.01',
  leaf: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z M5 19l8-8',
  blood: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z',
  mind: 'M12 4a7 7 0 0 0-4 12.7V20h8v-3.3A7 7 0 0 0 12 4Z M9.5 20.5h5',
  star: 'M12 3l1.8 5.5H19l-4.4 3.3 1.7 5.5L12 14l-4.3 3.3 1.7-5.5L5 8.5h5.2Z',
  portal: 'M12 3.5c3.6 0 6.5 3.8 6.5 8.5s-2.9 8.5-6.5 8.5-6.5-3.8-6.5-8.5 2.9-8.5 6.5-8.5Z M12 7.5c1.7 0 3 2 3 4.5s-1.3 4.5-3 4.5-3-2-3-4.5 1.3-4.5 3-4.5Z',
  shield: 'M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  skull: 'M12 3.5a7 7 0 0 0-7 7c0 2.6 1.3 4.3 3 5.3V19h8v-3.2c1.7-1 3-2.7 3-5.3a7 7 0 0 0-7-7Z M9.5 11h.01 M14.5 11h.01 M11 19v-2 M13 19v-2',
  hourglass: 'M7 3h10 M7 21h10 M8 3c0 5 8 5 8 9s-8 4-8 9 M16 3c0 5-8 5-8 9',
  up: 'M12 19V6 M6.5 11.5 12 6l5.5 5.5',
  down: 'M12 5v13 M6.5 12.5 12 18l5.5-5.5',
};
// Сдвиг к оптическому центру: рисунки в квадрате 24×24 сидят неровно (звезда выше, огонь ниже).
const ЦЕНТР = { fire: [0, -1.8], earth: [0, -1.5], air: [.5, .7], bolt: [.5, 0], spirit: [0, .5], leaf: [-.5, .5], star: [0, 1.9], skull: [0, .8], up: [0, -.5], down: [0, .5] };
const ик = (к) => { const п = ПУТИ[к] ? к : 'star', [x, y] = ЦЕНТР[п] || [0, 0];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ПУТИ[п]}"${x || y ? ` transform="translate(${x} ${y})"` : ''}/></svg>`; };
const СТИХИИ = [
  // Школы явной магии — раньше стихий: «огненный щит» — защита, а не огонь.
  [/портал|телепорт|пространств|перемещ|portal|teleport|blink/iu, 'portal', '#8fa8ff'],
  [/обере|защит|щит|барьер|ward|shield|barrier|abjur/iu, 'shield', '#9fd4ff'],
  [/иллюз|морок|личин|гламур|illusion|glamou?r/iu, 'eye', '#e0a3f0'],
  [/некро|смерт|прокля|порч|necro|death|curse|hex/iu, 'skull', '#a9b98a'],
  [/огон|огн|пламя|пламен|жар|пепел|fire|flame|ember/iu, 'fire', '#ff8a4c'],
  [/молни|гроз|электр|lightning|storm/iu, 'bolt', '#ffd84a'],
  [/(?<![\p{L}])вод|лёд|лед(?![\p{L}])|ледян|снег|туман|water|ice|frost/iu, 'water', '#62b6ff'],
  [/земл|камен|металл|песок|глин|earth|stone|metal|sand/iu, 'earth', '#c49a5a'],
  [/воздух|ветер|ветр|вихр|air|wind/iu, 'air', '#b9e3e0'],
  [/кров|blood/iu, 'blood', '#e0566b'],
  [/исцел|целит|целеб|лечен|лечеб|растен|трав|heal|plant/iu, 'leaf', '#7fd08a'],
  [/дух|душ|призрак|spirit|ghost/iu, 'spirit', '#b9a3ff'],
  [/разум|мысл|телепат|сон|mind|dream/iu, 'mind', '#d99be8'],
];
function стихия(название, описание = '') {
  // Сначала по названию: «чутьё на духов» с «духом воды» в описании — духи, не вода.
  const с = СТИХИИ.find(([rx]) => rx.test(String(название || ''))) || СТИХИИ.find(([rx]) => rx.test(String(описание || '')));
  return с ? { ик: с[1], c: с[2] } : { ик: 'star', c: '#e8c66a' };
}

/** Мана: когда будет полной по времени сцены (при отдыхе). */
export function манаПолнаяК(мана, сейчас) {
  if (!Number.isFinite(мана) || мана >= 100 || !Number.isFinite(сейчас)) return null;
  return сейчас + Math.ceil((100 - мана) / МАНА_В_ЧАС) * Ч;
}

// Мастерство словами мира: где заклинания — ученик…магистр, где врождённые
// дары — новичок…мастер. Вид один, меняются только слова.
const РАНГИ = { чары: ['ученик', 'подмастерье', 'адепт', 'магистр'], дары: ['новичок', 'обученный', 'опытный', 'мастер'] };
const РИМ = ['I', 'II', 'III', 'IV'];
const рангМира = (у) => (заклинанияВМире() ? РАНГИ.чары : РАНГИ.дары)[у.n - 1];
function числоДаров(n) {
  const слова = заклинанияВМире() ? ['заклинание', 'заклинания', 'заклинаний'] : ['дар', 'дара', 'даров'];
  const к = n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
  return `${n} ${слова[к]}`;
}

/* --- Гримуар: разворот книги ------------------------------------------------- */

const ФЛЕРОН = '<svg class="pw-g-fleuron" viewBox="0 0 64 12" aria-hidden="true"><path d="M2 6h20M42 6h20" class="ln"/><path d="M32 1.5c2.6 2 2.6 7 0 9-2.6-2-2.6-7 0-9Z M24 6c3-2.6 5.2-2.6 6 0-.8 2.6-3 2.6-6 0Z M40 6c-3-2.6-5.2-2.6-6 0 .8 2.6 3 2.6 6 0Z"/><circle cx="20" cy="6" r="1"/><circle cx="44" cy="6" r="1"/></svg>';

// Запись книги: буквица с печатью стихии, закладка-лента (чем длиннее, тем
// выше мастерство), «может» — текстом страницы, «не может» — пометкой
// красными чернилами на полях, цена — сноской под чертой.
function листГримуара(д, с) {
  const буква = (String(д.что).match(/\p{L}|\p{N}/u) || ['✦'])[0].toLocaleUpperCase('ru');
  const ранг = д.уровень
    ? `<span class="pw-g-rank" title="${э(д.мастерство)}"><b>${э(рангМира(д.уровень))}</b><small>${РИМ[д.уровень.n - 1]} из IV</small></span>`
    : д.мастерство ? `<span class="pw-g-rank"><b>${э(д.мастерство)}</b></span>` : '';
  const лента = д.уровень ? `<span class="pw-g-ribbon" style="--lv:${д.уровень.n}" aria-hidden="true"></span>` : '';
  const детали = [
    д.может ? `<p class="hud-pw-row is-can"><span class="pw-g-lab">Может</span> ${э(д.может)}</p>` : '',
    д.предел ? `<p class="hud-pw-row is-lim"><span class="pw-g-lab">Не может</span> ${э(д.предел)}</p>` : '',
    д.цена ? `<p class="hud-pw-row is-cost"><span class="pw-g-lab">Цена</span> ${э(д.цена)}</p>` : '',
  ].join('');
  return `<article class="hud-pw-card" style="--pw:${с.c}">${лента}`
    + `<div class="hud-pw-head"><span class="pw-g-init" aria-hidden="true"><span class="pw-g-letter">${э(буква)}</span><span class="hud-pw-ico">${ик(с.ик)}</span></span>`
    + `<span class="pw-g-title"><b>${э(д.что)}</b>${ранг}</span></div>`
    + (детали ? `<div class="hud-pw-details">${детали}</div>` : '') + '</article>';
}

/* --- Атлас даров: лист карты ------------------------------------------------- */

// Ранг — созвездие из четырёх звёзд: горят столько, сколько ступеней.
const ЗВЁЗДЫ = [[4, 12], [14, 5], [25, 10], [36, 3.5]];
function созвездие(n) {
  const линии = ЗВЁЗДЫ.slice(1).map(([x, y], i) => `<path d="M${ЗВЁЗДЫ[i][0]} ${ЗВЁЗДЫ[i][1]}L${x} ${y}" class="ln${i + 2 <= n ? ' on' : ''}"/>`).join('');
  const звёзды = ЗВЁЗДЫ.map(([x, y], i) => (i < n
    ? `<path class="st" d="M${x} ${y - 3.4}L${x + 1} ${y - 1}L${x + 3.4} ${y}L${x + 1} ${y + 1}L${x} ${y + 3.4}L${x - 1} ${y + 1}L${x - 3.4} ${y}L${x - 1} ${y - 1}Z"/>`
    : `<circle cx="${x}" cy="${y}" r="1.4" class="st-off"/>`)).join('');
  return `<svg class="pw-a-stars" viewBox="0 0 40 16" aria-hidden="true">${линии}${звёзды}</svg>`;
}
// Пунктир пути от картуша к гравюре — как маршрут на старой карте.
const ПУТЬ = '<svg class="pw-a-route" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M14 33C30 40 40 12 54 22S70 34 76 20" vector-effect="non-scaling-stroke"/></svg>';
const РОЗА = '<svg class="pw-a-rose" viewBox="-20 -20 40 40" aria-hidden="true"><circle r="13.5" class="ring"/><circle r="11" class="ring thin"/>'
  + '<path d="M-9.5-9.5-1.6-1.6M9.5-9.5 1.6-1.6M9.5 9.5 1.6 1.6M-9.5 9.5-1.6 1.6" class="diag"/>'
  + '<path d="M0-19 3-3 19 0 3 3 0 19-3 3-19 0-3-3Z" class="pt"/><path d="M0-19 3-3 0 0Z M19 0 3 3 0 0Z M0 19-3 3 0 0Z M-19 0-3-3 0 0Z" class="lit"/><circle r="1.6" class="hub"/></svg>';
// Условные знаки легенды: путь (что может), граница (чего не может), пошлина (цена).
const знак = (d) => `<svg class="pw-a-sym" viewBox="0 0 26 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ЛЕГЕНДА = {
  путь: знак('<path d="M2 9.5C7 9.5 8 3 13 3s6.5 6 9 6" stroke-dasharray="2.4 2.2"/><circle cx="23.5" cy="8.5" r="1.6" fill="currentColor"/>'),
  граница: знак('<path d="M1.5 6h23" stroke-dasharray="5 2.2 1 2.2"/><path d="M6 3v6M19 3v6" stroke-width="1.1"/>'),
  пошлина: знак('<path d="M1.5 6h5.5M19 6h5.5"/><circle cx="13" cy="6" r="4.6"/><path d="M13 3.6v4.8M11.3 4.8h3.4" stroke-width="1.1"/>'),
};
function листАтласа(д, с) {
  const ранг = д.уровень
    ? `<span class="hud-pw-lv pw-a-rank" title="${э(д.мастерство)}">${созвездие(д.уровень.n)}<b>${э(рангМира(д.уровень))}</b></span>`
    : д.мастерство ? `<span class="hud-pw-lv pw-a-rank"><b>${э(д.мастерство)}</b></span>` : '';
  const детали = [
    ['is-can', 'Может', д.может, ЛЕГЕНДА.путь],
    ['is-lim', 'Не может', д.предел, ЛЕГЕНДА.граница],
    ['is-cost', 'Цена', д.цена, ЛЕГЕНДА.пошлина],
  ].filter(([, , т]) => т).map(([к, м, т, з]) => `<li class="hud-pw-row ${к}"><span>${з}${м}</span><p>${э(т)}</p></li>`).join('');
  return `<article class="hud-pw-card" style="--pw:${с.c}"><div class="hud-pw-plate">${ПУТЬ}${рисунокАтласа(с.ик)}${РОЗА}`
    + `<div class="hud-pw-head"><span class="hud-pw-ico" aria-hidden="true">${ик(с.ик)}</span><b>${э(д.что)}</b>${ранг}</div></div>`
    + (детали ? `<ul class="hud-pw-details">${детали}</ul>` : '') + '</article>';
}

/* --- Карточки (прежний вид) ------------------------------------------------- */

function карточкаДара(д, с) {
  const пипсы = д.уровень ? `<span class="hud-pw-lv" title="${э(д.мастерство)}">${[1, 2, 3, 4].map(i => `<i aria-hidden="true"${i <= д.уровень.n ? ' class="on"' : ''}></i>`).join('')}<em>${э(д.уровень.имя)}</em></span>`
    : д.мастерство ? `<span class="hud-pw-lv"><em>${э(д.мастерство)}</em></span>` : '';
  const детали = [['is-can', 'Может', д.может], ['is-lim', 'Не может', д.предел], ['is-cost', 'Цена', д.цена]]
    .filter(([, , т]) => т).map(([к, м, т]) => `<div class="hud-pw-row ${к}"><span>${м}</span><p>${э(т)}</p></div>`).join('');
  return `<article class="hud-pw-card" style="--pw:${с.c}"><div class="hud-pw-head"><span class="hud-pw-ico" aria-hidden="true">${ик(с.ик)}</span><b>${э(д.что)}</b>${пипсы}</div>${детали}</article>`;
}

/**
 * Блок «Способности»: дары в выбранном виде (Гримуар, Атлас даров,
 * Карточки), полоска маны со сроком и что в теле меняет силу (если настройка
 * показывает это игроку). Вид один на любое фэнтези — меняются только слова.
 */
export function видСпособностей(value, о = null) {
  const дары = разобратьСпособности(value);
  if (!дары.length) return '';
  const вид = видБлока('abilitiesView');
  const лист = вид === 'grimoire' ? листГримуара : вид === 'atlas' ? листАтласа : карточкаДара;
  const карточки = дары.map(д => лист(д, стихия(д.что, д.может))).join('');
  const список = вид === 'grimoire'
    ? `<div class="pw-g-book"><div class="pw-g-run"><span>${заклинанияВМире() ? 'Гримуар' : 'Книга даров'}</span>${ФЛЕРОН}<span>${числоДаров(дары.length)}</span></div><div class="hud-pw-list">${карточки}</div></div>`
    : `<div class="hud-pw-list">${карточки}</div>`;
  // Мана и срок, когда наполнится.
  const мана = частьСил('mana') && о ? манаИз(поле(о, 'Состояние тела', 'Bs')) : null;
  const сейчас = о ? мигСцены(о.__датаСцены, о.__времяСцены) : null;
  const полная = манаПолнаяК(мана, сейчас);
  const полоса = мана === null ? '' : `<div class="hud-pw-mana${мана <= 15 ? ' is-low' : ''}"><span>Мана</span><i><i style="width:${мана}%"></i></i><b>${мана}</b>`
    + `<small>${мана >= 100 ? 'полная' : полная !== null ? `полная к ${чч(полная)}, если отдыхать` : `+${МАНА_В_ЧАС} за час отдыха`}</small></div>`;
  // Тело и сила — игроку.
  const показать = телоИСила() === 'both' || телоИСила() === 'me';
  const ф = показать && о ? телоМеняетСилу(о, о.__датаСцены) : [];
  const тело = ф.length ? `<div class="hud-pw-body"><span class="hud-pw-body-t">Тело и сила</span>${ф.map(x => `<span class="hud-pw-f is-${x.знак}" title="${э(x.как)}">${ик(x.знак)}<b>${э(x.что)}</b><small>${э(x.как)}</small></span>`).join('')}</div>` : '';
  return `<div class="hud-pw${вид !== 'classic' ? ' is-' + вид : ''}">${полоса}${список}${тело}</div>`;
}

/* --- Чары / Эффекты ---------------------------------------------------------- */

// Чары со сроком по времени сцены: миг конца, остаток, вышло ли, цвет стихии.
function чарыСоСроком(value, о) {
  const сейчас = о ? мигСцены(о.__датаСцены, о.__времяСцены) : null;
  const чары = разобратьЧары(value).map(ч => {
    const конец = мигДо(ч.до, сейчас);
    const ост = конец !== null ? конец - сейчас : null;
    const вышло = ост !== null && ост <= 0, с = стихия(ч.что, `${ч.источник} ${ч.проявление}`);
    // Истёкшие — серые: цвет стихии остаётся только у действующих.
    return { ...ч, конец, ост, вышло, с: вышло ? { ик: с.ик, c: '#8d8a96' } : с };
  });
  return { сейчас, чары };
}
const срокЧар = (ч) => (ч.ост !== null
  ? `<span class="hud-ef-left${ч.вышло ? ' is-over' : ч.ост < Ч ? ' is-soon' : ''}">${ик('hourglass')}<b>${э(сколькоОсталось(ч.ост))}</b><small>${ч.вышло ? 'должно было кончиться в ' : 'до '}${э(чч(ч.конец))}</small></span>`
  : ч.до ? `<span class="hud-ef-left">${ик('hourglass')}<small>${э(ч.до)}</small></span>`
    : '<span class="hud-ef-left is-free"><small>без срока</small></span>');
const подписиЧар = (ч) => (ч.источник ? `<p class="hud-ef-src">от: ${э(ч.источник)}</p>` : '') + (ч.проявление ? `<p class="hud-ef-sy">${э(ч.проявление)}</p>` : '');

// Циферблат суток: полночь сверху, полдень снизу, ночь — тёмная половина.
// Каждые чары — своё кольцо: дуга от стрелки «сейчас» до часа, когда кончатся;
// истёкшие — серый пунктир от конца до «сейчас» и крестик.
const уголМига = (мс) => ((мс % 864e5) + 864e5) % 864e5 / 864e5 * 360;
const точка = (r, у) => { const р = (у - 90) * Math.PI / 180; return `${(r * Math.cos(р)).toFixed(2)} ${(r * Math.sin(р)).toFixed(2)}`; };
function дуга(r, у0, у1) {
  const д = Math.max(1.5, ((у1 - у0) % 360 + 360) % 360);
  return `M${точка(r, у0)}A${r} ${r} 0 ${д > 180 ? 1 : 0} 1 ${точка(r, у0 + д)}`;
}
function циферблат(чары, сейчас) {
  const ун = уголМига(сейчас);
  const шаг = Math.min(6.4, 22 / Math.max(1, чары.length));
  const толщина = Math.min(3.6, шаг * .58).toFixed(2);
  const засечки = Array.from({ length: 24 }, (_, i) => `<path d="M${точка(i % 6 ? 47 : 45, i * 15)}L${точка(49.5, i * 15)}"${i % 6 ? '' : ' class="big"'}/>`).join('');
  const часы = [[0, '00'], [6, '06'], [12, '12'], [18, '18']].map(([ч, т]) => `<text x="${точка(54.5, ч * 15).split(' ')[0]}" y="${(+точка(54.5, ч * 15).split(' ')[1] + 2.4).toFixed(2)}">${т}</text>`).join('');
  const кольца = чары.map((ч, i) => {
    const r = +(40 - i * шаг).toFixed(2);
    let s = `<circle r="${r}" class="track"/>`;
    if (ч.конец === null) return s;
    const ук = уголМига(ч.конец);
    if (ч.вышло) {
      if (-ч.ост < 864e5) s += `<path d="${дуга(r, ук, ун)}" class="past"/>`;
      const [x, y] = точка(r, ук).split(' ').map(Number);
      return s + `<path d="M${x - 2} ${y - 2}l4 4M${x + 2} ${y - 2}l-4 4" class="cross"/>`;
    }
    s += ч.ост >= 864e5 ? `<circle r="${r}" class="arc full" style="--ef:${ч.с.c};stroke-width:${толщина}"/>`
      : `<path d="${дуга(r, ун, ук)}" class="arc" style="--ef:${ч.с.c};stroke-width:${толщина}"/>`;
    return s + `<circle cx="${точка(r, ук).split(' ')[0]}" cy="${точка(r, ук).split(' ')[1]}" r="${(+толщина * .78 + .9).toFixed(2)}" class="end" style="--ef:${ч.с.c}"/>`;
  }).join('');
  const внутри = 40 - (чары.length - 1) * шаг - шаг * .6;
  return `<svg class="pw-d-dial" viewBox="-60 -60 120 120" aria-hidden="true">`
    + `<circle r="51" class="face"/><path d="M0 0L${точка(51, 270)}A51 51 0 0 1 ${точка(51, 90)}Z" class="night"/><circle r="51" class="rim"/>`
    + `<g class="ticks">${засечки}</g><g class="hours">${часы}</g>${кольца}`
    + `<path d="M${точка(Math.max(14, внутри), ун)}L${точка(50, ун)}" class="hand"/><circle cx="${точка(50, ун).split(' ')[0]}" cy="${точка(50, ун).split(' ')[1]}" r="2.1" class="tip"/>`
    + (внутри >= 15 ? `<text y="2.6" class="now">${чч(сейчас)}</text>` : '<circle r="2.4" class="hub"/>') + '</svg>';
}

// Ярлыки: бумажные талисманы на шнуре. Хвост ярлыка тлеет — чем меньше
// осталось (из 12 часов), тем короче; истёкший — обугленный, без хвоста.
// Письмена на хвосте: в мире заклинаний — знаки, у врождённых даров — мазки кисти.
const ЗНАКИ_ХВОСТА = 'M6 4l4 6 4-6M10 10v6M5 22h10M10 22l-4 8M10 22l4 8M7 39a3 3 0 1 0 6 0 3 3 0 1 0-6 0M10 45v8M6 49h8';
const МАЗКИ_ХВОСТА = 'M10 3c-2 5 2 8 0 13M5 21c4-1 7 1 10 0M8 27c1 6-2 9 0 14M13 29c-1 4 1 7 0 10M6 47c3 1 6-1 8 1';
const НАКЛОН = [-2.2, 1.6, -.9, 2.4, -1.4];
function ярлык(ч, i) {
  const доля = ч.ост === null ? 1 : ч.вышло ? 0 : Math.min(1, ч.ост / (12 * Ч));
  const класс = ч.вышло ? ' is-over' : ч.ост === null ? ' is-free' : ч.ост < Ч ? ' is-soon' : '';
  return `<li class="pw-t-tag${класс}" style="--ef:${ч.с.c};--left:${доля.toFixed(2)};--tilt:${НАКЛОН[i % НАКЛОН.length]}deg">`
    + '<div class="pw-t-hang"><span class="pw-t-knot" aria-hidden="true"></span>'
    + `<div class="pw-t-paper"><span class="pw-t-seal" aria-hidden="true">${ик(ч.с.ик)}</span><b>${э(ч.что)}</b>${срокЧар(ч)}${подписиЧар(ч)}</div>`
    + `<span class="pw-t-tail" aria-hidden="true"><svg viewBox="0 0 20 60"><path d="${заклинанияВМире() ? ЗНАКИ_ХВОСТА : МАЗКИ_ХВОСТА}"/></svg><span class="pw-t-ember"></span></span></div></li>`;
}

/** Блок «Чары»/«Эффекты»: что действует, от кого и сколько осталось по времени
 *  сцены — списком, на циферблате суток или ярлыками-талисманами. */
export function видЧар(value, о = null) {
  const { сейчас, чары } = чарыСоСроком(value, о);
  if (!чары.length) return '';
  const вид = видБлока('effectsView');
  if (вид === 'dial') {
    const легенда = чары.map(ч => `<li class="pw-d-item${ч.вышло ? ' is-over' : ''}" style="--ef:${ч.с.c}"><span class="pw-d-key" aria-hidden="true">${ик(ч.с.ик)}</span>`
      + `<div><div class="hud-ef-head"><b>${э(ч.что)}</b>${срокЧар(ч)}</div>${подписиЧар(ч)}</div></li>`).join('');
    const есть = Number.isFinite(сейчас);
    return `<div class="hud-ef is-dial"><div class="pw-d-wrap${есть ? '' : ' no-time'}">${есть ? `<div class="pw-d-face">${циферблат(чары.slice(0, 6), сейчас)}</div>` : ''}<ol class="pw-d-legend">${легенда}</ol></div></div>`;
  }
  if (вид === 'tags') return `<div class="hud-ef is-tags"><ul class="pw-t-row">${чары.map(ярлык).join('')}</ul></div>`;
  return `<div class="hud-ef">${чары.map(ч => `<div class="hud-ef-item${ч.вышло ? ' is-over' : ''}"><div class="hud-ef-head"><b>${э(ч.что)}</b>${ч.ост === null && !ч.до ? '' : срокЧар(ч)}</div>${подписиЧар(ч)}</div>`).join('')}</div>`;
}

/* --- Заметка модели на ход (turn-notes.js) ---------------------------------- */

/**
 * Строки для «THIS TURN»: сколько маны было на прошлом ходу и как она
 * возвращается, какие чары кончаются или кончились, что в теле меняет силу.
 * люди — [{ имя, з }] из снимка последнего HUD (коды полей).
 */
export function заметкаСил(люди, sc) {
  if (!силыВМире()) return [];
  const строки = [];
  const сейчас = мигСцены(sc?.Dt, sc?.T);
  const маны = [], чары = [], тело = [];
  for (const { имя, з } of люди) {
    if (!з || typeof з !== 'object') continue;
    const дар = !пусто(поле(з, 'Ab'));
    const м = частьСил('mana') ? манаИз(поле(з, 'Bs')) : null;
    if (м !== null && м < 100) маны.push(`${имя} ${м}`);
    if (частьСил('effects')) for (const ч of разобратьЧары(поле(з, 'Ef'))) {
      const до = мигДо(ч.до, сейчас);
      if (до === null) continue;
      if (до <= сейчас) чары.push(`«${ч.что}» on ${имя} ended at ${чч(до)} — drop it from Ef unless the story renews it`);
      else if (до - сейчас <= 2 * Ч) чары.push(`«${ч.что}» on ${имя} ends at ${чч(до)}`);
    }
    const кому = телоИСила();
    if (дар && (кому === 'both' || кому === 'model')) {
      const ф = телоМеняетСилу(з, sc?.Dt);
      if (ф.length) тело.push(`${имя}: ${ф.map(x => x.модели).join('; ')}`);
    }
  }
  if (маны.length) строки.push(`Mana at the last HUD (${sc?.T ? String(sc.T).split('|')[0].trim() : 'last turn'}): ${маны.join(', ')}. It returns about ${МАНА_В_ЧАС} per hour of rest and fully after a night's sleep; ${заклинанияВМире() ? 'every spell spends it' : 'using the gift spends it'}. Count the time your reply covers before writing mn.`);
  if (чары.length) строки.push(`Effects by story time: ${чары.join('; ')}.`);
  if (тело.length) строки.push(`Body and power — let this shape how well each ${заклинанияВМире() ? 'caster’s magic' : 'gift'} obeys, shown in the scene and never named as a rule: ${тело.join(' | ')}.`);
  return строки;
}
