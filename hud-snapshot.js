// hud-manager/hud-snapshot.js
//
// Снимок последнего HUD для инструкции модели и решение, нужна ли в промте
// часть про близость.
//
// Снимок — последний HUD из истории, свёрнутый в короткие коды промта, без
// пустых полей и без выключенных в настройках разделов. Модель получает его
// в конце инструкции и обновляет под свой ответ, а не собирает мир заново.
//
// Часть про близость (фазы, подробности, кинки, поза, звуки…) — самая тяжёлая
// в промте. Вне интимной сцены она не нужна: ни в правилах, ни в схеме, ни в
// снимке. Решаем автоматически по снимку (идёт ли сцена) и по словам в
// последних сообщениях (начинается ли она).

import { settings } from './settings.js?v=23.79.4';
import { т } from './i18n.js?v=23.79.4';
import { наложитьНаСнимок } from './snapshot-edits.js?v=23.79.4';
import { mapKey, имяБезПриставки } from './utils.js?v=23.79.4';
import { свернутьКоды, НАЗВАНИЯ_КОДОВ } from './codes.js?v=23.79.4';
import { разобратьHUDСырой } from './hud-parser.js?v=23.79.4';
import { заменитьHudБлоки } from './hud-block.js?v=23.79.4';
import { упомянутВТексте } from './names.js?v=23.79.4';

const объект = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Коды полей в том виде, в каком их просит промт.
const ПОЛЯ_СЦЕНЫ = ['T', 'Wt', 'Dt', 'At', 'Md', 'Tw'];
const ПОЛЯ_ПЕРСОНАЖА = ['N', 'A', 'C', 'Ap', 'R', 'B', 'H', 'Ill', 'Prg', 'Mns', 'Ph', 'Bs', 'L', 'Th', 'K', 'Ex', 'D', 'I', 'G', 'S', 'Rl', 'Mm', 'Fl',
  'Jl', 'St', 'Eo', 'X', 'SxL', 'SxC', 'SxR', 'Ln', 'Tr', 'Fr', 'SS', 'Pos', 'Rnd', 'Dur', 'Prt', 'Org', 'Vit', 'Snd', 'BM', 'W', 'Kn', 'Ft',
  'NG', 'NT', 'ND', 'Mrk', 'AC', 'SxV'];
const ПОЛЯ_ИГРОКА = ['A', 'C', 'Ap', 'H', 'Ill', 'Prg', 'Mns', 'Rl', 'L', 'Mrk', 'UW'];

// Поля близости. Вне сцены их нет ни в схеме, ни в снимке; устойчивые черты
// (кинки, фетиши, последний секс) HUD на экране берёт из прошлых ходов.
export const NSFW_ПЕРСОНАЖА = ['SS', 'Pos', 'Rnd', 'Dur', 'Prt', 'Org', 'Vit', 'Snd', 'BM', 'W', 'Kn', 'Ft', 'NG', 'NT', 'ND', 'AC', 'SxV', 'SxL', 'SxC', 'SxR'];
export const NSFW_ИГРОКА = ['UW'];
// По ним видно, что сцена идёт прямо сейчас.
const ИДЁТ_СЦЕНА = ['SS', 'W', 'ND', 'AC', 'SxV', 'Pos', 'Org'];

const вКоды = (коды) => Object.fromEntries(коды.map(к => [mapKey(к).toLowerCase(), к]));
const КОДЫ_СЦЕНЫ = вКоды(ПОЛЯ_СЦЕНЫ);
const КОДЫ_ПЕРСОНАЖА = вКоды(ПОЛЯ_ПЕРСОНАЖА);
const КОДЫ_ИГРОКА = вКоды(ПОЛЯ_ИГРОКА);

function свернутьПоля(о, карта) {
  const out = {};
  for (const [k, v] of Object.entries(о)) {
    const код = карта[mapKey(k).toLowerCase()] || k;
    if (!(код in out) || k === код) out[код] = v;
  }
  return out;
}

const ЗАГЛУШКА = /^(?:|empty|none|null|undefined|n\/a|нет|пусто|-|—)$/i;
export function непусто(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.some(непусто);
  if (объект(v)) return Object.values(v).some(непусто);
  return !ЗАГЛУШКА.test(String(v).trim());
}

// Пустые строки, «empty», пустые списки и объекты убираем на любой глубине.
function вычистить(v) {
  if (Array.isArray(v)) {
    const out = v.map(вычистить).filter(x => x !== undefined);
    return out.length ? out : undefined;
  }
  if (объект(v)) {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const чистое = вычистить(x);
      if (чистое !== undefined) out[k] = чистое;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') return ЗАГЛУШКА.test(v.trim()) ? undefined : v.trim();
  return v;
}

const убрать = (о, ключи) => { if (объект(о)) ключи.forEach(k => { delete о[k]; }); };

/**
 * Весь HUD из текста блока — в кодах промта, ничего не выбрасывая. Этим же
 * форматом модель пишет HUD сама; снимок и сохранение после перегенерации
 * берут его отсюда. null, если блок не разобрался.
 */
export function HUDвКодах(текстБлока) {
  let сырой;
  try { сырой = разобратьHUDСырой(текстБлока); } catch (_) { return null; }
  if (!объект(сырой)) return null;
  const к = свернутьКоды(JSON.parse(JSON.stringify(сырой)));
  if (объект(к.sc)) к.sc = свернутьПоля(к.sc, КОДЫ_СЦЕНЫ);
  // Поворот сюжета живёт один ход: в снимке для следующего хода его нет,
  // иначе модель повторяла бы вчерашний поворот как новый.
  if (объект(к.sc)) delete к.sc.Tw;
  if (объект(к.cs)) к.cs = [к.cs];
  if (Array.isArray(к.cs)) к.cs = к.cs.map(c => (объект(c) ? свернутьПоля(c, КОДЫ_ПЕРСОНАЖА) : c));
  if (объект(к.us)) к.us = свернутьПоля(к.us, КОДЫ_ИГРОКА);
  return к;
}

// Поля персонажа, которые модель пишет заново каждый ход: мысль этого
// мгновения, ожидание и реальность этого хода, скрытое действие прямо сейчас.
// Старый текст в снимок не идёт, как и дневник: модель его копировала, а что
// было в прошлом ходе, знает из текста ответа и «События» сводки.
export const СВЕЖИЕ_ПЕРСОНАЖА = ['Th', 'Ex', 'D'];

// Вырезанное свежее нельзя просто убрать: в длинном чате модель читает снимок
// как образец ответа — чего в нём нет, того она и не пишет. Поэтому на месте
// вырезанного стоит метка. Угловые скобки по правилам схемы значат «заполни
// настоящим содержимым», а ключ остаётся в структуре.
export const МЕТКА_НОВОГО = '<new this turn>';
// Сколько последних строк маршрута и истории настроений, и сообщений каждой
// переписки, видит модель в снимке.
export const ХВОСТ_ИСТОРИИ = 4;
export const ХВОСТ_ПЕРЕПИСКИ = 3;

// --- Персонажи вне сцены -----------------------------------------------------
// HUD — не снимок сцены, а живой мир: кто не в кадре, всё равно живёт —
// переходит с места на место, пишет и звонит, меняет планы, настроение и
// отношения, у него идёт цикл и болит рана. Поэтому вне сцены остаётся всё
// живое, а уходит то, что видно только в кадре или почти не меняется:
// внешность, одежда, ключевые мысли, вещи, реплики, страхи, отметины,
// воспоминания, разоблачение, ожидание и подтекст хода. На экране их держит
// прежняя карточка (render/carryover.js, вернутьЧерты).
export const ВНЕ_СЦЕНЫ_БЕЗ = ['Ap', 'C', 'K', 'I', 'Mm', 'Ln', 'Fr', 'Mrk', 'Eo', 'Ex', 'D'];
// Место — началом адреса: «город, особняк, парк» общие, а последняя часть —
// уточнение («у подоконника», «на краю кровати»), по которому люди в одной
// сцене расходятся. Одна сцена — когда начало одного адреса продолжает
// другой: «комната 308» и «комната 308, у окна» — вместе, «бальная зала» и
// «барная стойка в галерее» — нет.
const началоМеста = (v) => {
  const части = String(Array.isArray(v) ? v.join(', ') : v || '').toLowerCase().replace(/ё/g, 'е').split(/\s+[—–-]\s+/)[0].split(',').map(s => s.trim()).filter(Boolean);
  return части.length >= 3 ? части.slice(0, -1).slice(0, 3) : части;
};
const однаСцена = (а, б) => а.length > 0 && б.length > 0 && а.slice(0, Math.min(а.length, б.length)).every((ч, i) => ч === б[i]);
/**
 * Кто из персонажей снимка вне сцены: не главный персонаж карточки, не назван
 * в последних сообщениях, не там же, где {{user}} или главный, не в близости.
 * При трёх персонажах и меньше — никто: короче почти не станет.
 */
export function внеСцены(снимок, { тексты = [], главный = '' } = {}) {
  if (!объект(снимок) || settings.hudAwayShort === false) return [];
  const cs = (Array.isArray(снимок.cs) ? снимок.cs : []).filter(c => объект(c) && c.N);
  if (cs.length <= 3) return [];
  const текст = (Array.isArray(тексты) ? тексты : [тексты]).join('\n');
  const имяГлавного = имяБезПриставки(String(главный || ''));
  // Имена — без приставки карточки («THE REGENTS  Tristan Kingsley»): иначе
  // сравнивалось бы первое слово, «THE».
  const имя = (c) => имяБезПриставки(String(c.N)) || String(c.N);
  const этоГлавный = (c) => имяГлавного && (упомянутВТексте(имяГлавного, имя(c)) || упомянутВТексте(имя(c), имяГлавного));
  const места = [началоМеста(объект(снимок.us) && снимок.us.L)];
  cs.filter(этоГлавный).forEach(c => места.push(началоМеста(c.L)));
  return cs.filter(c => {
    if (этоГлавный(c)) return false;
    if (упомянутВТексте(текст, имя(c))) return false;
    const м = началоМеста(c.L);
    if (!м.length || места.some(о => однаСцена(о, м))) return false;
    if (ИДЁТ_СЦЕНА.some(k => поСути(c[k]))) return false;
    return true;
  }).map(c => String(c.N));
}
// Кто вне сцены в уже собранной строке снимка — для легенды того же запроса.
const внеПоСтроке = new Map();
const МЕТКА_СНОВ = '<new this turn — only if someone slept; otherwise []>';

/**
 * Снимок из текста блока [HUD]…[/HUD]: объект в кодах промта, без пустого и
 * без выключенных разделов. Поля близости пока остаются — решение о них
 * принимается позже, и снимок нужен для этого решения.
 */
export function собратьСнимок(текстБлока) {
  const к = HUDвКодах(текстБлока);
  if (!к) return null;

  // Не состояние, а свежий текст хода: запись дневника, дневник тела, сны,
  // гороскоп, «судьба» и комментарии модель каждый ход пишет заново. В снимке
  // они стоили около пятой части токенов и подталкивали переписать вчерашнее.
  delete к.dy; delete к.bd; delete к.dr;
  убрать(к.wd, ['zd', 'fate', 'com']);
  (Array.isArray(к.cs) ? к.cs : []).forEach(c => убрать(c, СВЕЖИЕ_ПЕРСОНАЖА));

  // Выключенное в настройках модели не показываем: иначе она перепишет его в ответ.
  const выкл = (ключ) => settings[ключ] === false;
  if (!settings.enablePhone) { delete к.cm; delete к.phn; }
  else if (выкл('phoneAppMessages')) delete к.cm;
  if (к.phn && typeof к.phn === 'object' && выкл('phoneAppHealth')) delete к.phn.hl;
  if (!settings.enableIntercepts) delete к.tp;
  // Перехваты — модели только последнее сообщение каждой переписки. Целиком
  // она переписывала их из снимка слово в слово, ход за ходом, без единой
  // новой строки; прежние сообщения на экране держит перенос из прошлых
  // ходов (render/carryover.js), он же склеивает повторы.
  else if (Array.isArray(к.tp)) к.tp.forEach(п => { if (объект(п) && Array.isArray(п.ms)) п.ms = п.ms.filter(непусто).slice(-1); });
  // Переписки, маршрут и истории настроений — только хвост. Модель дописывает
  // к нему новое; прежнее на экране держит перенос из прошлых ходов
  // (render/carryover.js). Целиком они стоили около трети снимка памяти и
  // переписывались слово в слово.
  if (объект(к.cm)) for (const ч of Object.values(к.cm)) { if (объект(ч) && Array.isArray(ч.ms)) ч.ms = ч.ms.filter(непусто).slice(-ХВОСТ_ПЕРЕПИСКИ); }
  if (объект(к.me)) {
    if (объект(к.me.rt)) for (const кто of Object.keys(к.me.rt)) { if (Array.isArray(к.me.rt[кто])) к.me.rt[кто] = к.me.rt[кто].filter(непусто).slice(-ХВОСТ_ИСТОРИИ); }
    if (объект(к.me.md)) for (const кто of Object.values(к.me.md)) { if (объект(кто) && Array.isArray(кто.hs)) кто.hs = кто.hs.filter(непусто).slice(-ХВОСТ_ИСТОРИИ); }
  }
  if (!settings.enableDiary) { delete к.dy; delete к.bd; }
  if (!settings.enableDreams) delete к.dr;
  if (!settings.enableMemory) delete к.me;
  else if (выкл('enableGuns')) убрать(к.me, ['gun']);
  if (!settings.enableUserBlock) delete к.us;
  if (выкл('enableCompanions')) delete к.pet;
  if (выкл('enableCombat')) delete к.cb;
  if (!settings.enableWorld) delete к.wd;
  else {
    if (выкл('enableHoroscope')) убрать(к.wd, ['zd', 'fate']);
    if (выкл('enableEconomy')) убрать(к.wd, ['eco']);
    if (выкл('enableEvents')) убрать(к.wd, ['afs']);
    if (выкл('enableCity')) убрать(к.wd, ['cty']);
    if (выкл('showComments')) убрать(к.wd, ['com']);
  }
  const поПерсонажам = (ключи) => { (Array.isArray(к.cs) ? к.cs : []).forEach(c => убрать(c, ключи)); убрать(к.us, ключи); };
  if (выкл('enableIllness')) поПерсонажам(['Ill']);
  if (выкл('enablePregnancy')) поПерсонажам(['Prg']);
  if (выкл('enableMenstruation')) поПерсонажам(['Mns']);
  if (выкл('enableIntimacyExtras')) поПерсонажам(['Pos', 'Rnd', 'Dur', 'Prt', 'Org', 'Vit', 'Snd', 'Mrk']);

  // Метки на месте вырезанного — ровно там, где схема это поле просит.
  // Записи дневника тела (bd) строкаСнимка уберёт вне близости, как и схема.
  (Array.isArray(к.cs) ? к.cs : []).forEach(c => { if (объект(c)) СВЕЖИЕ_ПЕРСОНАЖА.forEach(k => { c[k] = МЕТКА_НОВОГО; }); });
  if (settings.enableDiary) { к.dy = [МЕТКА_НОВОГО]; к.bd = [МЕТКА_НОВОГО]; }
  if (settings.enableDreams) к.dr = [МЕТКА_СНОВ];
  if (settings.enableWorld) {
    const мир = объект(к.wd) ? к.wd : (к.wd = {});
    if (!выкл('enableHoroscope')) { мир.zd = [МЕТКА_НОВОГО]; мир.fate = [МЕТКА_НОВОГО]; }
    if (settings.showComments) мир.com = [МЕТКА_НОВОГО];
  }

  const чистый = вычистить(к);
  return объект(чистый) ? чистый : null;
}

// Идёт ли близость по последнему HUD: фаза, NSFW, «после», поза.
// Фаза 1 — сцены нет, даже когда строка не пустая: модель пишет её номером
// со словом («1 — empty»). Раньше такая строка считалась идущей сценой, промт
// просил близость, модель снова писала «1 — empty» — и так без конца.
const ФАЗА_ПУСТАЯ = /^\s*(?:(?:phase|фаза)\s*)?1(?![\d.,])|^\s*(?:empty|none|нет|пусто)(?![\p{L}])|(?<![\p{L}])(?:empty|none)\s*$/iu;
export const идётПоФазе = (v) => поСути(v) && !ФАЗА_ПУСТАЯ.test(String(Array.isArray(v) ? v.join(' ') : v).trim());
// «0: empty», «0 — none», «—»: число и заглушка — это пусто. Такими модель
// обнуляет поля сцены в фазе 1, и они не должны включать близость.
const ТОЛЬКО_ЗАГЛУШКА = /^(?:[\d\s.,:;%\/—–-]|empty|none|null|нет|пусто|n\/a)*$/iu;
export const поСути = (v) => непусто(v) && !ТОЛЬКО_ЗАГЛУШКА.test(String(Array.isArray(v) ? v.join(' ') : v).trim());

export function близостьВСнимке(снимок) {
  if (!объект(снимок)) return false;
  const персонажи = Array.isArray(снимок.cs) ? снимок.cs : [];
  if (персонажи.some(c => объект(c) && (идётПоФазе(c.SS) || ИДЁТ_СЦЕНА.some(k => k !== 'SS' && поСути(c[k]))))) return true;
  return объект(снимок.us) && поСути(снимок.us.UW);
}

// Слова близости. Сильное слово решает само, слабых нужно два разных:
// «голая» бывает в ванной, «стон» — от боли, а вместе они уже сцена.
// «Член» сам по себе не берём: «член совета» — обычная фраза; его узнают
// по глаголам рядом («встал», «набух», «вошёл в…»).
const СИЛЬНЫЕ = /(?<![\p{L}])(?:секс|трах|выеб|отъеб|минет|отсос|куннилинг|куни(?![\p{L}])|оргазм|кончил|кончила|кончает|кончить|кончаю|клитор|вагин|влагалищ|эрекци|стояк|презерватив|пенетрац|дроч|онанир|мастурбац|дилдо|вибратор(?![\p{L}])|страпон|фистинг|fisting|римминг|догги(?![\p{L}])|раком(?![\p{L}])|член\s+(?:встал|набух|уперся|д[её]рнулся|дрогнул)|тв[её]рд\p{L}*\s+член|sex(?![\p{L}])|fuck|cock(?![\p{L}])|pussy|orgasm|blowjob|condom|cunnilingus|erection|dick(?![\p{L}])|cum(?![\p{L}])|cumming|clit(?![\p{L}])|vagina|penis|handjob|deepthroat|dildo|vibrator|strap-?on|masturbat|jerk(?:s|ed|ing)? (?:him |himself |her )?off|creampie|doggy(?![\p{L}])|rimming|horny|penetrat)/iu;
const СЛАБЫЕ = [
  // «обнажённая правда», «обнажённый клинок» — не про тело.
  /(?<![\p{L}])(?:голая|голый|голые|голой|обнаж[её]нн\p{L}*(?![\s\u2800]+(?:правд|истин|нерв|душ|клин|меч|шпаг|зуб|провод|корн))|нагишом|naked|nude)/iu,
  /(?<![\p{L}])(?:раздева|раздел(?:ась|ся|ись)|сорвал\p{L}* (?:с неё|с нее|с него|одежд|бель)|undress|strip(?:s|ped|ping)?(?![\p{L}])|topless|took off (?:her|his) (?:clothes|shirt|dress|bra|panties|top))/iu,
  /(?<![\p{L}])(?:стон(?:ет|ы|ал|ала|ом|ами|ут)?(?![\p{L}])|застонал|moan|groan|whimper)/iu,
  /(?<![\p{L}])(?:возбужд|твердеющ|набухш|aroused|arousal|throbbing|hard(?:ening|ened)? (?:cock|length|shaft))/iu,
  // Не «соскользнула»: только формы слова «сосок».
  /(?<![\p{L}])(?:сос(?:ок|ки|ка|ку|ков|кам|ками|ках)(?![\p{L}])|лобок|промежност|nipple|perineum|mound)/iu,
  /(?<![\p{L}])(?:смазк|влажн\p{L}* (?:между|внутри)|wet between|slick (?:between|with)|soaked through|dripping wet)/iu,
  // Одиночный «толчок» бывает какой угодно; ритм — это «толчки», «толчками».
  /(?<![\p{L}])(?:толч(?:ки|ками|ков)|вход(?:ит|ил) в не[её]|проник|thrust|inside (?:her|him)(?![\p{L}])|entered (?:her|him)|slid into (?:her|him))/iu,
  /(?<![\p{L}])(?:ласка(?:ет|ть|ми)|бёдра раздв|бедра раздв|ноги раздв|между (?:её|ее|его) (?:ног|бёдер|бедер)|spread her|caress|between (?:her|his) (?:legs|thighs)|spread (?:her|his) legs|parted (?:her|his) thighs)/iu,
  // Грудь трогают: мнёт, сжимает, целует — само по себе слабое, но с любым
  // вторым слабым словом — уже сцена.
  /(?<![\p{L}])(?:груд(?:ь|и|ей|ями)?\s*(?:его|её|ее)?\s*(?:мн[её]т|сжима|сжал|ласка|гладит|целует|лижет|обхватил|мял|губами)|(?:мн[её]т|сжима|сжал|ласкает|гладит|целует|лижет)\s+(?:её|ее|его)?\s*груд|(?:grop|squeez|fondl|cupp?|knead|kiss|lick|suck)\p{L}* (?:her |his )?(?:breasts?|tits|nipples?)|(?:breasts?|tits|nipples?) (?:in|under|against) (?:his|her) (?:hands?|palms?|mouth|lips))/iu,
  // Язык и губы за работой: не «лижет мороженое», а с объектом.
  /(?<![\p{L}])(?:вылизыва|лизат\p{L}*\s+(?:её|ее|его)|лижет\s+(?:её|ее|его)|облизыва\p{L}*\s+(?:её|ее|его)|языком\s+(?:между|внутри|на ней)|(?:licks?|licking|licked|laps?|lapping) (?:at )?(?:her|his|between)|tongue (?:between|inside|deep in|on (?:her|his) (?:clit|folds|cock)))/iu,
  // Пальцы там, где уже не невинно.
  /(?<![\p{L}])(?:трогает\s+(?:себя\s+)?(?:между|там)|пальц\p{L}*\s+(?:внутрь|скольз\p{L}*\s*(?:внутрь|по|вниз|ниже)|круж\p{L}*\s+на)|touch(?:es|ing)? (?:her|him)self|fingers? (?:slid|slip|slide|sliding|slipping|inside|circl)\p{L}*|rub(?:s|bing)? (?:her|his) (?:clit|folds))/iu,
  // Влажность — не только от дождя: где и куда течёт.
  /(?<![\p{L}])(?:влажно\s+между\s+ног|теч[её]т\s+по\s+б[её]драм|истекает\s+соком|смазк\p{L}*\s+(?:по|на|между)|wet between (?:her )?legs|dripping down (?:her )?thighs|soak(?:ed|ing)? (?:her|through her) panties)/iu,
  // Скачет верхом, седлает — поза, а не конный спорт.
  /(?<![\p{L}])(?:скачет\s+на\s+(?:н[её]м|нем|его\s+б[её]драх)|оседлала|rid(?:es|ing) (?:him|her)(?![\p{L}])|straddl)/iu,
  // Дыхание сбилось не от бега по лестнице.
  /(?<![\p{L}])(?:дыхание\s+(?:сби|участил|перехват)|дышит\s+(?:часто|прерывисто)\s+(?:от|и\s+(?:стон|шепч|хвата))|breath (?:hitch|catch|quicken)\p{L}*|breathing (?:hard|heavily|raggedly)|panting)/iu,
];
export function словаБлизости(тексты) {
  const текст = заменитьHudБлоки((Array.isArray(тексты) ? тексты : [тексты]).filter(Boolean).join('\n'), ' ');
  if (!текст.trim()) return false;
  if (СИЛЬНЫЕ.test(текст)) return true;
  return СЛАБЫЕ.filter(rx => rx.test(текст)).length >= 2;
}

/**
 * Нужна ли в инструкции часть про близость. Настройка nsfwPrompt:
 * 'always' — всегда, 'never' — никогда, 'auto' (по умолчанию) — когда сцена
 * идёт по последнему HUD или начинается по словам последних сообщений.
 */
export function решитьNSFW(снимок, тексты) {
  const режим = settings.nsfwPrompt || 'auto';
  if (режим === 'always') return true;
  if (режим === 'never') return false;
  return близостьВСнимке(снимок) || словаБлизости(тексты);
}

/* Бой в промте — только когда он нужен (combatPrompt: 'auto'): в прошлом HUD
   бой не кончился, или в последних сообщениях опасность — выстрел, нож,
   драка, погоня, — или свежая рана. В мирных ходах блок не стоит ничего. */
const ОПАСНОСТЬ_СИЛЬНО = /(?<![\p{L}])(?:выстрел\p{L}*|стреля\p{L}*|напал\p{L}*|нападени\p{L}*|драк\p{L}*|дерут\p{L}*|погон\p{L}*|гонятся|засад\p{L}*|взрыв\p{L}*|перестрелк\p{L}*|атаков\p{L}*|бросился на|замахнул\p{L}*|gunshot|gunfire|shots? (?:fired|rang)|shoot(?:s|ing)?(?![\p{L}])|fired (?:at|a shot)|attack(?:s|ed|ing)?(?![\p{L}])|ambush|explosion|exploded|firefight|shootout|chase|chasing|lunge[sd]? at|threw a punch|swung at|brawl|fistfight)/iu;
const ОПАСНОСТЬ = /(?<![\p{L}])(?:пистолет\p{L}*|револьвер\p{L}*|винтовк\p{L}*|автомат(?![\p{L}])|ружь\p{L}*|нож(?:ом|и|а)?(?![\p{L}])|кинжал\p{L}*|клинок|меч(?:ом|а)?(?![\p{L}])|кастет\p{L}*|прицел\p{L}*|курок|граната|ранен\p{L}*|кулаком|удар(?:ил|ила|ом)|gun(?![\p{L}])|guns|pistol|revolver|rifle|shotgun|knife|knives|dagger|blade|sword|brass knuckles|trigger|grenade|wounded|punch(?:ed|es)?|fight(?:s|ing)?(?![\p{L}])|bleeding)/giu;
export function решитьБой(снимок, тексты) {
  if (settings.enableCombat === false) return false;
  const режим = settings.combatPrompt || 'auto';
  if (режим === 'always') return true;
  if (режим === 'never') return false;
  const cb = объект(снимок) ? снимок.cb : null;
  if (объект(cb) && непусто(cb.st) && !/кончен|закончен|over/i.test(String(cb.st))) return true;
  const весь = (Array.isArray(тексты) ? тексты : []).join('\n');
  if (ОПАСНОСТЬ_СИЛЬНО.test(весь)) return true;
  if (new Set((весь.match(ОПАСНОСТЬ) || []).map(w => w.toLowerCase().slice(0, 5))).size >= 2) return true;
  // Свежая рана в прошлом HUD.
  const люди = объект(снимок) ? [...(Array.isArray(снимок.cs) ? снимок.cs : []), снимок.us].filter(объект) : [];
  return люди.some(c => /(?:^|;|\|)\s*sg\s*:\s*fresh/i.test(String(c.Ill || '')) && /пул|огнестр|ножев|порез|колот|перелом|gunshot|bullet|stab|knife|cut(?![a-z])|fracture|broken/i.test(String(c.Ill || '')));
}

// Строка снимка для промта: компактный JSON. Без близости — без её полей.
export function строкаСнимка(снимок, nsfw, сцена = null) {
  if (!объект(снимок)) return '';
  const копия = JSON.parse(JSON.stringify(снимок));
  // Правки игрока (snapshot-edits.js): «отметил, что Лена знает» — модели.
  try { наложитьНаСнимок(копия); } catch (_) { /* без правок */ }
  // Вне сцены — живое без кадра; близость у них не идёт (её нет в кадре),
  // от неё — только «когда и с кем», как вне сцены у всех.
  const вне = сцена ? внеСцены(копия, сцена) : [];
  // Вернулись в сцену — в прошлом HUD были записаны коротко, теперь в кадре.
  // Кто был коротким, считает вызывающий до того, как вернёт им карточку из
  // истории (index.js, дополнитьКарточкиСнимка); без этого — по самой копии.
  const короткие = сцена ? (Array.isArray(сцена.короткие) ? сцена.короткие : короткиеВСнимке(копия)) : [];
  const вернулись = короткие.filter(н => !вне.includes(н) && (Array.isArray(копия.cs) ? копия.cs : []).some(c => объект(c) && String(c.N) === н));
  const когдаИСКем = (v) => String(Array.isArray(v) ? v.join('; ') : v || '').split(';').map(s => s.trim()).filter(s => /^(dt|pr|en)\s*[:：]/i.test(s)).join('; ');
  if (вне.length) (Array.isArray(копия.cs) ? копия.cs : []).forEach(c => {
    if (!объект(c) || !вне.includes(String(c.N))) return;
    const коротко = settings.nsfwPrompt !== 'never' ? когдаИСКем(c.SxL) : '';
    убрать(c, ВНЕ_СЦЕНЫ_БЕЗ);
    убрать(c, NSFW_ПЕРСОНАЖА);
    if (коротко) c.SxL = коротко;
  });
  if (!nsfw) {
    // «Последний секс» вне сцены — когда, с кем и чем кончилось (защита и риск): схема просит эту
    // часть и вне близости, чтобы запись не устаревала. Подробности остаются
    // в карточке (render/carryover.js), в инструкцию вне сцены не идут.
    (Array.isArray(копия.cs) ? копия.cs : []).forEach(c => {
      const коротко = объект(c) && settings.nsfwPrompt !== 'never' ? когдаИСКем(c.SxL) : '';
      убрать(c, NSFW_ПЕРСОНАЖА);
      if (коротко) c.SxL = коротко;
    });
    убрать(копия.us, NSFW_ИГРОКА);
    delete копия.bd;
  }
  const чистый = вычистить(копия);
  const строка = объект(чистый) ? JSON.stringify(чистый) : '';
  if (строка && (вне.length || вернулись.length)) {
    внеПоСтроке.set(строка, { вне, вернулись });
    while (внеПоСтроке.size > 6) внеПоСтроке.delete(внеПоСтроке.keys().next().value);
  }
  return строка;
}

/** Кто в снимке записан коротко, как вне сцены: без внешности и одежды. */
export function короткиеВСнимке(снимок) {
  return (объект(снимок) && Array.isArray(снимок.cs) ? снимок.cs : []).filter(c => объект(c) && c.N && !непусто(c.Ap) && !непусто(c.C)).map(c => String(c.N));
}

/** Мягкое напоминание: вернувшиеся в сцену пишутся снова по общим правилам. */
export function строкаВернулись(имена) {
  if (!Array.isArray(имена) || !имена.length) return '';
  return `Back in the scene now: ${имена.join(', ')}. Last turn they were away and written short; now they are here, so write them in full by the general rules again — C, K, Ex, D, Eo, Ln and the rest. Their Ap above comes from earlier turns: keep it unless their look has changed.`;
}

/** Строка для модели: кто вне сцены и как их писать. Пусто, если таких нет. */
export function строкаВнеСцены(имена) {
  if (!Array.isArray(имена) || !имена.length) return '';
  return `Away from the scene right now: ${имена.join(', ')}. Above they carry only their living state — place, status, body and health, cycle, goals, schedule, thought, relationships, trust, flags. They go on living off-screen: they move, text and call, change plans, moods and relationships — update all of that. Write them in your HUD in the same short form: HUD keeps the rest of their card (appearance, clothes, things, lines, fears, marks, memories) from earlier turns. If one of them enters the scene in your reply, add the scene fields (C, K, Ex, D, Eo, Ln); Ap only if their look has changed.`;
}

/* Легенда снимка: расшифровка только тех кодов, что в нём есть. Схема с
   описаниями стоит в инструкции на тысячи токенов выше, а снимок модель
   читает и как факты мира для самого ответа — там «Rl», «Kn», «stt» без
   подсказки непонятны. Названия английские, теми же словами, что в схеме:
   русские стоили вдвое больше токенов. Код, уже расшифрованный в одном
   разделе, в следующем не повторяем (C у персонажа и у игрока — одно). */
const НАЗВАНИЯ_ПОЛЕЙ = {
  T: 'time', Wt: 'weather', Dt: 'date', At: 'atmosphere', Md: 'mood',
  N: 'name', A: 'age', C: 'clothing', Ap: 'appearance', R: 'role', B: 'body and mind', H: 'health', Ill: 'illnesses and injuries',
  Prg: 'pregnancy', Mns: 'cycle', Ph: 'physiology', L: 'location', Th: 'thought', K: 'key thoughts', Ex: 'expectation vs reality',
  D: 'hidden subtext', I: 'inventory', G: 'goals', S: 'schedule', Rl: 'relationships', Mm: 'memories', Fl: 'flags', Jl: 'jealousy',
  St: 'status', Eo: 'exposure', X: 'conflict', Ln: 'lines', Tr: 'trust', Fr: 'fears', Mrk: 'body marks',
  SxL: 'last encounter', SxC: 'sex count', SxR: 'sex regularity', SxV: 'sex review', SS: 'scene phase', Pos: 'position', Rnd: 'round',
  Dur: 'duration', Prt: 'protection', Org: 'orgasm readiness', Vit: 'vitals', Snd: 'sounds', BM: 'body map', W: 'intimate state',
  Kn: 'kinks', Ft: 'fetishes', NG: 'never', NT: 'turn-offs', ND: 'intimate detail', AC: 'aftercare', UW: 'intimate state',
};
const НАЗВАНИЯ_РАЗДЕЛОВ = { us: '{{user}}', cm: 'chats (last messages each; HUD keeps the earlier ones)', phn: 'phone', tp: 'intercepts (last message each)', pet: 'companions', sm: 'casket', lt: 'letters', ov: 'overheard' };
const ПОЯСНЕНИЯ = { md: 'mood (hs: last lines; HUD keeps the earlier ones)', rt: 'route (last lines; HUD keeps the earlier ones — add new moves after them)', hd: 'does NOT know', knw: 'knows', stt: 'status', lv: 'level', f: 'fact', n: 'name', src: 'source' };

export function легендаСнимка(строка) {
  let с;
  try { с = typeof строка === 'string' ? JSON.parse(строка) : строка; } catch (_) { return ''; }
  if (!объект(с)) return '';
  // Запасные названия — русские; на английском интерфейсе — переводом (i18n.js).
  const имяПоля = (код) => НАЗВАНИЯ_ПОЛЕЙ[код] || т(String(mapKey(код))).toLowerCase();
  const уже = new Set();
  const поля = (объекты) => {
    const коды = [];
    объекты.filter(объект).forEach(о => Object.keys(о).forEach(k => { if (!коды.includes(k)) коды.push(k); }));
    const новые = коды.filter(k => !уже.has(k));
    новые.forEach(k => уже.add(k));
    const out = новые.map(k => `${k} ${имяПоля(k)}`).join(', ');
    return out || (коды.length ? 'same codes' : '');
  };
  const подразделы = (о, словарь) => Object.keys(объект(о) ? о : {}).map(k => `${k} ${ПОЯСНЕНИЯ[k] || (словарь[k] ? т(словарь[k]) : k)}`).join(', ');
  const части = [];
  for (const [код, знач] of Object.entries(с)) {
    const раздел = НАЗВАНИЯ_РАЗДЕЛОВ[код] || (НАЗВАНИЯ_КОДОВ.корень[код] ? т(НАЗВАНИЯ_КОДОВ.корень[код]) : код);
    let внутри = '';
    if (код === 'sc' || код === 'us') внутри = поля([знач]);
    else if (код === 'cs') внутри = поля(Array.isArray(знач) ? знач : [знач]);
    else if (код === 'me' && объект(знач)) {
      внутри = подразделы(знач, НАЗВАНИЯ_КОДОВ.память);
      const секреты = (Array.isArray(знач.sec) ? знач.sec : []).filter(объект);
      if (секреты.length) {
        const ключи = [...new Set(секреты.flatMap(x => Object.keys(x)))];
        внутри += `; sec items: ${ключи.map(k => `${k} ${ПОЯСНЕНИЯ[k] || (НАЗВАНИЯ_КОДОВ.секрет[k] ? т(НАЗВАНИЯ_КОДОВ.секрет[k]) : k)}`).join(', ')}`;
      }
    } else if (код === 'wd') внутри = подразделы(знач, НАЗВАНИЯ_КОДОВ.мир);
    else if (код === 'phn') внутри = подразделы(знач, НАЗВАНИЯ_КОДОВ.телефон);
    части.push(внутри ? `${код} ${раздел} (${внутри})` : `${код} ${раздел}`);
  }
  const легенда = части.join(' · ');
  const о = typeof строка === 'string' ? внеПоСтроке.get(строка) : null;
  const доп = о ? [строкаВнеСцены(о.вне), строкаВернулись(о.вернулись)].filter(Boolean) : [];
  return доп.length ? легенда + '\n' + доп.join('\n') : легенда;
}

// Тексты последнего сообщения игрока и последнего ответа персонажа — для
// решения о близости. Берём из самого чата, а не из запроса: в запросе рядом
// лежат вставки пресета, и NSFW-разрешение пресета со «словами» включало бы
// близость каждый ход.
export function последниеТекстыЧата(чат, доИндекса = Infinity) {
  const out = [];
  let игрок = false, ответ = false;
  const конец = Math.min(Array.isArray(чат) ? чат.length : 0, доИндекса);
  for (let i = конец - 1; i >= 0 && !(игрок && ответ); i--) {
    const m = чат[i];
    if (!m || m.is_system || typeof m.mes !== 'string') continue;
    if (m.is_user && !игрок) { игрок = true; out.push(m.mes); }
    else if (!m.is_user && !ответ) { ответ = true; out.push(m.mes); }
  }
  return out;
}
