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

import { settings } from './settings.js?v=23.9.2';
import { mapKey } from './utils.js?v=23.9.2';
import { свернутьКоды, НАЗВАНИЯ_КОДОВ } from './codes.js?v=23.9.2';
import { разобратьHUDСырой } from './hud-parser.js?v=23.9.2';
import { заменитьHudБлоки } from './hud-block.js?v=23.9.2';

const объект = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Коды полей в том виде, в каком их просит промт.
const ПОЛЯ_СЦЕНЫ = ['T', 'Wt', 'Dt', 'At', 'Md'];
const ПОЛЯ_ПЕРСОНАЖА = ['N', 'A', 'C', 'Ap', 'R', 'B', 'H', 'Ill', 'Prg', 'Mns', 'Ph', 'L', 'Th', 'K', 'Ex', 'D', 'I', 'G', 'S', 'Rl', 'Mm', 'Fl',
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
  if (!settings.enableDiary) { delete к.dy; delete к.bd; }
  if (!settings.enableDreams) delete к.dr;
  if (!settings.enableMemory) delete к.me;
  else if (выкл('enableGuns')) убрать(к.me, ['gun']);
  if (!settings.enableUserBlock) delete к.us;
  if (выкл('enableCompanions')) delete к.pet;
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
const СИЛЬНЫЕ = /(?<![\p{L}])(?:секс|трах|выеб|отъеб|минет|отсос|куннилинг|оргазм|кончил|кончила|кончает|кончить|кончаю|клитор|вагин|влагалищ|эрекци|стояк|презерватив|пенетрац|sex(?![\p{L}])|fuck|cock(?![\p{L}])|pussy|orgasm|blowjob|condom|cunnilingus|erection)/iu;
const СЛАБЫЕ = [
  // «обнажённая правда», «обнажённый клинок» — не про тело.
  /(?<![\p{L}])(?:голая|голый|голые|голой|обнаж[её]нн\p{L}*(?![\s\u2800]+(?:правд|истин|нерв|душ|клин|меч|шпаг|зуб|провод|корн))|нагишом|naked|nude)/iu,
  /(?<![\p{L}])(?:раздева|раздел(?:ась|ся|ись)|сорвал\p{L}* (?:с неё|с нее|с него|одежд|бель)|undress)/iu,
  /(?<![\p{L}])(?:стон(?:ет|ы|ал|ала|ом|ами|ут)?(?![\p{L}])|застонал|moan)/iu,
  /(?<![\p{L}])(?:возбужд|твердеющ|набухш|aroused)/iu,
  // Не «соскользнула»: только формы слова «сосок».
  /(?<![\p{L}])(?:сос(?:ок|ки|ка|ку|ков|кам|ками|ках)(?![\p{L}])|лобок|промежност|nipple)/iu,
  /(?<![\p{L}])(?:смазк|влажн\p{L}* (?:между|внутри)|wet between)/iu,
  // Одиночный «толчок» бывает какой угодно; ритм — это «толчки», «толчками».
  /(?<![\p{L}])(?:толч(?:ки|ками|ков)|вход(?:ит|ил) в не[её]|проник|thrust)/iu,
  /(?<![\p{L}])(?:ласка(?:ет|ть|ми)|бёдра раздв|бедра раздв|между (?:её|ее|его) (?:ног|бёдер|бедер)|spread her)/iu,
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

// Строка снимка для промта: компактный JSON. Без близости — без её полей.
export function строкаСнимка(снимок, nsfw) {
  if (!объект(снимок)) return '';
  const копия = JSON.parse(JSON.stringify(снимок));
  if (!nsfw) {
    (Array.isArray(копия.cs) ? копия.cs : []).forEach(c => убрать(c, NSFW_ПЕРСОНАЖА));
    убрать(копия.us, NSFW_ИГРОКА);
    delete копия.bd;
  }
  const чистый = вычистить(копия);
  return объект(чистый) ? JSON.stringify(чистый) : '';
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
  SxL: 'last sex', SxC: 'sex count', SxR: 'sex regularity', SxV: 'sex review', SS: 'scene phase', Pos: 'position', Rnd: 'round',
  Dur: 'duration', Prt: 'protection', Org: 'orgasm readiness', Vit: 'vitals', Snd: 'sounds', BM: 'body map', W: 'intimate state',
  Kn: 'kinks', Ft: 'fetishes', NG: 'never', NT: 'turn-offs', ND: 'intimate detail', AC: 'aftercare', UW: 'intimate state',
};
const НАЗВАНИЯ_РАЗДЕЛОВ = { us: '{{user}}', cm: 'chats', phn: 'phone', tp: 'intercepts', pet: 'companions', sm: 'casket', lt: 'letters', ov: 'overheard' };
const ПОЯСНЕНИЯ = { hd: 'does NOT know', knw: 'knows', stt: 'status', lv: 'level', f: 'fact', n: 'name', src: 'source' };

export function легендаСнимка(строка) {
  let с;
  try { с = typeof строка === 'string' ? JSON.parse(строка) : строка; } catch (_) { return ''; }
  if (!объект(с)) return '';
  const имяПоля = (код) => НАЗВАНИЯ_ПОЛЕЙ[код] || String(mapKey(код)).toLowerCase();
  const уже = new Set();
  const поля = (объекты) => {
    const коды = [];
    объекты.filter(объект).forEach(о => Object.keys(о).forEach(k => { if (!коды.includes(k)) коды.push(k); }));
    const новые = коды.filter(k => !уже.has(k));
    новые.forEach(k => уже.add(k));
    const out = новые.map(k => `${k} ${имяПоля(k)}`).join(', ');
    return out || (коды.length ? 'same codes' : '');
  };
  const подразделы = (о, словарь) => Object.keys(объект(о) ? о : {}).map(k => `${k} ${ПОЯСНЕНИЯ[k] || словарь[k] || k}`).join(', ');
  const части = [];
  for (const [код, знач] of Object.entries(с)) {
    const раздел = НАЗВАНИЯ_РАЗДЕЛОВ[код] || НАЗВАНИЯ_КОДОВ.корень[код] || код;
    let внутри = '';
    if (код === 'sc' || код === 'us') внутри = поля([знач]);
    else if (код === 'cs') внутри = поля(Array.isArray(знач) ? знач : [знач]);
    else if (код === 'me' && объект(знач)) {
      внутри = подразделы(знач, НАЗВАНИЯ_КОДОВ.память);
      const секреты = (Array.isArray(знач.sec) ? знач.sec : []).filter(объект);
      if (секреты.length) {
        const ключи = [...new Set(секреты.flatMap(x => Object.keys(x)))];
        внутри += `; sec items: ${ключи.map(k => `${k} ${ПОЯСНЕНИЯ[k] || НАЗВАНИЯ_КОДОВ.секрет[k] || k}`).join(', ')}`;
      }
    } else if (код === 'wd') внутри = подразделы(знач, НАЗВАНИЯ_КОДОВ.мир);
    else if (код === 'phn') внутри = подразделы(знач, НАЗВАНИЯ_КОДОВ.телефон);
    части.push(внутри ? `${код} ${раздел} (${внутри})` : `${код} ${раздел}`);
  }
  return части.join(' · ');
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
