// hud-manager/names.js
//
// Нечёткое сопоставление имён: транслитерация кириллицы и приведение к
// фонетической латинице. Нужно графу отношений, чтобы «Michael», «Майкл» и
// «Майкл Смит» схлопывались в один узел. Вынесено из index.js без изменения
// поведения.

// ========= SMART NAME / RELATION PARSER =========
// Один и тот же персонаж может приходить как "Michael", "Майкл", "Mайкл",
// "Майкл Смит", "Michael Smith" и т.п. Граф сначала собирает все реальные
// имена, затем пытается сопоставить каждую ссылку с уже существующим узлом,
// и только после этого создаёт новый узел.
import { известнаяФамилия, нужноПолноеИмя, иероглифыИКана, разборВосточногоИмени, ОБЩИЕ_СЛОВА, словоИмени } from './korean-names.js?v=23.90.15';
import { settings } from './settings.js?v=23.90.15';

export function normalizeNameText(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .replace(/[’'`]/g, '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е');
}

export function transliterateCyrillic(name) {
  const src = normalizeNameText(name);
  const table = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  // «ье» звучит «йе»: «Моро», «Оливье» — как французские Moreau, Olivier.
  return Array.from(src.replace(/ье/g, 'йе')).map(ch => table[ch] ?? ch).join('');
}

export function nameLettersOnly(name) {
  return transliterateCyrillic(name).replace(/[^a-z0-9]+/g, '');
}

// Фонетика имени — чистая функция строки, а зовут её на каждое сравнение и
// каждое упоминание в тексте: запоминаем (только короткие строки — имена).
const памятьФонетики = new Map();
export function namePhoneticLatin(name) {
  const s = String(name ?? '');
  if (s.length > 120) return фонетикаСразу(s);
  let v = памятьФонетики.get(s);
  if (v === undefined) {
    v = фонетикаСразу(s);
    if (памятьФонетики.size >= 20000) памятьФонетики.clear();
    памятьФонетики.set(s, v);
  }
  return v;
}
function фонетикаСразу(name) {
  let s = nameLettersOnly(name);
  if (!s) return '';
  // Сводим распространённые варианты английского написания к близкой
  // фонетической форме, чтобы Michael/Mайкл, Sergei/Сергей и т.п. сближались.
  s = s
    // «Анджела» / «Angela»: «дж» перед е, и в английском — это g.
    .replace(/dzh(?=[ei])/g, 'g')
    // Французское -ier на конце читается «-ье»: Moreau — Моро.
    .replace(/ier$/, 'ye')
    // Немая e в английском: Kate, Jane, Grace читаются «эй» — Кейт, Джейн, Грейс.
    .replace(/ace$/, 'eys')
    .replace(/a([bdfgklmnprstvz])e$/, 'ey$1')
    .replace(/michael/g, 'maykl')
    .replace(/alexander/g, 'aleksandr')
    .replace(/alexandra/g, 'aleksandra')
    .replace(/catherine/g, 'katrin')
    .replace(/katherine/g, 'katrin')
    .replace(/caitlin/g, 'keytlin')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/th/g, 't')
    .replace(/wh/g, 'w')
    .replace(/gh/g, 'g')
    .replace(/ee/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/ou/g, 'u')
    .replace(/au/g, 'o')
    .replace(/ow/g, 'o')
    .replace(/ay/g, 'ey')
    .replace(/ai/g, 'ey')
    .replace(/ei/g, 'ey')
    .replace(/ie/g, 'i')
    .replace(/j/g, 'y')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/w/g, 'v');
  return s;
}

function nameConsonantSignature(name) {
  const s = namePhoneticLatin(name);
  return s.replace(/[aeiouy]+/g, '');
}

function nameVariants(name) {
  const raw = normalizeNameText(name);
  if (!raw) return new Set();
  const translit = nameLettersOnly(raw);
  const phonetic = namePhoneticLatin(raw);
  const consonants = nameConsonantSignature(raw);
  const squashed = raw.replace(/[^a-zа-я0-9]+/gi, '');
  const tokens = raw.split(/\s+/).filter(Boolean);
  const tokenTranslit = tokens.map(x => nameLettersOnly(x)).join('');
  // Одни согласные — примета только длинного имени: у «Анны» и «Инны» они
  // одни и те же (nn), у «Мии» и «Маи» тоже (m).
  return new Set([raw.replace(/[^a-zа-я0-9]+/gi, ''), translit, phonetic, consonants.length >= 4 ? consonants : '', squashed, tokenTranslit].filter(Boolean));
}

// --- Имена из настроек аватарок ---------------------------------------------
// В настройках одна картинка задаётся списком написаний: «Дамиан, Damian,
// Damian Hartley». Раз пользователь перечислил их вместе, это один человек —
// и наоборот, имена из разных списков разводим, даже если буквы похожи.
// Списки читаются заново, только когда настройки изменились.
let подписьСписков = null, спискиАватарок = [];
function группыАватарок() {
  const сырые = [settings.avatarCharNames, settings.avatarUserNames]
    .concat((Array.isArray(settings.avatarOverrides) ? settings.avatarOverrides : []).map(з => з && з.names));
  const подпись = JSON.stringify(сырые);
  if (подпись !== подписьСписков) {
    подписьСписков = подпись;
    спискиАватарок = сырые
      // Приставку карточки («THE LANTERNS Damian») снимаем и здесь: иначе
      // по первому слову «the» с персонажем сходилось название группы
      // «The Lanterns», и групповой чат в телефоне назывался списком участников.
      .map(строка => String(строка || '').split(/[,;\n]/).map(н => normalizeNameText(безПриставки(н)).toLowerCase()).filter(Boolean))
      .filter(список => список.length > 0);
    // Списки поменялись — прежние ответы «один ли это человек» уже неверны.
    памятьСравнений.clear();
  }
  return спискиАватарок;
}

// Память сравнений. Одни и те же пары имён сравниваются тысячи раз за
// отрисовку: перенос списков, сдвиги доверия, граф, быт — каждый ход истории
// на каждого персонажа. Транслитерация, фонетика и Левенштейн съедали до 40%
// времени сборки карточки. Ответ зависит только от двух строк и списков
// аватарок; списки сверяем на каждом вызове, но дёшево — сравнением самих
// строк, без JSON: правка списка сразу сбрасывает память.
const памятьСравнений = new Map();
const ПРЕДЕЛ_ПАМЯТИ = 20000;
let былиСписки = null;
function сверитьСписки() {
  try {
    const о = Array.isArray(settings.avatarOverrides) ? settings.avatarOverrides : [];
    const б = былиСписки;
    const те = б && б.ch === settings.avatarCharNames && б.us === settings.avatarUserNames && б.n === о.length && о.every((з, i) => (з && з.names) === б.имена[i]);
    if (те) return;
    былиСписки = { ch: settings.avatarCharNames, us: settings.avatarUserNames, n: о.length, имена: о.map(з => з && з.names) };
    группыАватарок();
  } catch (_) { /* без настроек — как раньше */ }
}

// true — пользователь назвал их одним человеком, false — разными,
// null — в списках их нет, решать дальше по буквам.
function поСпискамАватарок(A, B) {
  let группы;
  try { группы = группыАватарок(); } catch (_) { return null; }
  if (!группы.length) return null;
  // Имя из списка узнаём целиком или по первому слову: в переписке человек
  // встречается и полным именем, и одним лишь именем.
  // И в падеже: в списке «София», в тексте «Софию», «Софией».
  const вСписке = (имя, список) => {
    const н = имя.toLowerCase(), первое = н.split(' ')[0], зв = namePhoneticLatin(первое);
    return список.some(x => {
      const xп = x.split(' ')[0];
      const совпали = сравнитьПолныеИмена(н, x);
      if (совпали !== null) return совпали;
      if (x === н || xп === первое) return true;
      const зx = namePhoneticLatin(xп);
      return зв.length >= 3 && зx.length >= 3 && (сПадежом(зв, зx) || (зв.replace(ГЛАСНЫЕ_В_КОНЦЕ, '') === зx.replace(ГЛАСНЫЕ_В_КОНЦЕ, '') && зв.replace(ГЛАСНЫЕ_В_КОНЦЕ, '').length >= 3 && !несклоняемоеПродлено(зв, зx)));
    });
  };
  const гA = группы.filter(г => вСписке(A, г));
  const гB = группы.filter(г => вСписке(B, г));
  if (!гA.length || !гB.length) return null;
  if (гA.some(г => гB.includes(г))) return true;
  return false;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      cur.push(Math.min(
        cur[j] + 1,
        prev[j + 1] + 1,
        prev[j] + (a[i] === b[j] ? 0 : 1)
      ));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Первые слова имён (уже в фонетической латинице). Одна буква разницы — это
// опечатка или транслитерация только у длинного имени и не в первой букве:
// «Мия» и «Мая», «Лея» и «Лия», «Мария» и «Дария» — разные люди. Падеж
// («Софии», «Дамиана», «Анны») — та же основа без конечных гласных.
const ГЛАСНЫЕ_В_КОНЦЕ = /[aeiouy]+$/;
// Короткое имя в другой азбуке — транслитерация: «Мия» / «Mia», «Кейт» /
// «Kate», «Ной» / «Noah». Тут сравниваем согласные (немая h не в счёт) и
// звучание в целом. Разные героини одного сюжета обычно в одной азбуке —
// «Мия» и «Мая» так не сольются.
const КИРИЛЛИЦА = /[а-яё]/i;
// Немая h — в конце и после гласной (Noah, Sarah), но не в sh, kh, zh, ch, th:
// иначе «Шеф» (shef) сходил за Marie (mari).
const согласные = (s) => s.replace(/(?<![skzct])h/g, '').replace(/[aeiouy]+/g, '');
// Падежные окончания в транслитерации: «Ноланом», «Дареном», «Дамиану», «Софии».
const ПАДЕЖ = /^(?:a|ya|u|yu|e|i|y|om|em|oy|ey|oyu|eyu|am|yam|ym|im|akh|yakh|ov|ev)$/;
function сПадежом(a, b) {
  const [к, д] = a.length <= b.length ? [a, b] : [b, a];
  return к.length >= 3 && д.startsWith(к) && ПАДЕЖ.test(д.slice(к.length));
}
// Начало «Дж» / J / Y: «Джейн» (dzheyn → geyn) и Jane (yeyn) — одно и то же.
const начало = (s) => s.replace(/^(?:dzh|g(?=[ei])|y)/, 'J');
function несклоняемоеПродлено(a, b) {
  const [к, д] = a.length <= b.length ? [a, b] : [b, a];
  return к !== д && д.startsWith(к) && /[ieou]$/.test(к) && /^[aeiouy]/.test(д.slice(к.length));
}
function первыеСловаСовпадают(a, b, исхA = '', исхB = '') {
  if (a === b) return true;
  // Имя на -и, -е, -о, -у не склоняется: «Софию», «Софии», «София» — это
  // другое имя (София), а не падеж Мари. Если у игрока это один человек —
  // для этого списки имён под картинкой.
  if (несклоняемоеПродлено(a, b)) return false;
  if (КИРИЛЛИЦА.test(исхA) !== КИРИЛЛИЦА.test(исхB)) { a = начало(a); b = начало(b); if (a === b) return true; }
  // Опечатка — не в первой и не в последней букве: последняя у нас падеж
  // («Грея» — это Грей, а не Grace), первая — другое имя («Мария» / «Дария»).
  if (Math.min(a.length, b.length) >= 5 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1] && levenshtein(a, b) <= 1) return true;
  const оa = a.replace(ГЛАСНЫЕ_В_КОНЦЕ, ''), оb = b.replace(ГЛАСНЫЕ_В_КОНЦЕ, '');
  if (оa.length >= 3 && оa === оb) return true;
  if (сПадежом(a, b) || сПадежом(оa, b) || сПадежом(a, оb)) return true;
  if (КИРИЛЛИЦА.test(исхA) !== КИРИЛЛИЦА.test(исхB)) {
    // «Ксавье» / «Ксавьер» — Xavier по-французски и по-английски.
    const [к, д] = a.length <= b.length ? [a, b] : [b, a];
    if (к.length >= 5 && д.length === к.length + 1 && д.startsWith(к) && !/[aeiouy]/.test(д.slice(-1))) return true;
    // s и z в транслитерации путаются: «Изольда» (izolda) — Isolde.
    const сa = согласные(a).replace(/z(?!h)/g, 's'), сb = согласные(b).replace(/z(?!h)/g, 's');
    const началоТо = a[0] === b[0] || (/^[aeiouy]/.test(a) && /^[aeiouy]/.test(b));
    // У коротких имён две согласные на всех: «Yasmin» и «Бетти», «Nolan» и «Рид»
    // по ним совпадали — две правки им не прощаем.
    if (сa && сa === сb && началоТо) return levenshtein(a, b) <= (сa.length === 2 ? 1 : 2);
  }
  return false;
}

// Общее сравнение имён для всего HUD: транслитерация, фонетика, опечатка в одну
// букву. Уменьшительных форм здесь нет намеренно: «Лиза» и «Elizabeth» в одном
// сюжете могут оказаться разными людьми, и граф, аватарки и сводка их бы слили.
// --- Мужское и женское имя одного корня -------------------------------------
// «Ян» и «Яна», «Иван» и «Ивана», «Александр» и «Александра», «Евгений» и
// «Евгения», Daniel и Daniela. По буквам второе — падеж первого (у Ивана), и
// сравнение их сливало: цикл и беременность жены доставались мужу, его вещи —
// ей. Когда оба стоят в одном HUD отдельными людьми, это два человека — до
// перезагрузки страницы. Падеж без такой пары по-прежнему узнаётся.
const РАЗНЫЕ_ЛЮДИ = new Set();
// ОБЩИЕ_СЛОВА (korean-names.js): слово, которое в этом чате носят двое с
// полными именами. Одно такое слово никого не выбирает.
// Чат сменился — пары и общие слова прошлого чата забываем: «Ян» и «Яна»
// из одной истории не должны разводить падеж «Яна» в другой.
let чатРеестра = null;
function сверитьЧатРеестра() {
  let чат = '';
  try { const ctx = globalThis.SillyTavern?.getContext?.(); чат = String(ctx?.chatId ?? ctx?.getCurrentChatId?.() ?? ''); } catch (_) { чат = ''; }
  if (чат === чатРеестра) return;
  чатРеестра = чат;
  if (РАЗНЫЕ_ЛЮДИ.size || ОБЩИЕ_СЛОВА.size) { РАЗНЫЕ_ЛЮДИ.clear(); ОБЩИЕ_СЛОВА.clear(); памятьСравнений.clear(); }
}
function словоОбщееВЧате(слово, полное) {
  if (!ОБЩИЕ_СЛОВА.size) return false;
  const с = словоИмени(слово);
  return полное.some(ч => словоИмени(ч) === с) && ОБЩИЕ_СЛОВА.has(с);
}
const первоеСловоИмени = (имя) => normalizeNameText(безПриставки(имя)).split(' ')[0] || '';
function женскоеОтМужского(м, ж) {
  if (м.length < 2) return false;
  const хвост = ж.slice(м.length);
  if (ж.length > м.length && ж.startsWith(м) && /^(?:а|я|ия|a|ia)$/.test(хвост) && !/[аяеиоуыэюaeiouy]$/.test(м)) return true;
  // Евгений → Евгения, Виталий → Виталия
  return /[ий]й$/.test(м) && ж === м.slice(0, -1) + 'я';
}
const ключПары = (а, б) => (а < б ? а + '\u0001' + б : б + '\u0001' + а);
/** Имена людей одного HUD: пары «Ян» / «Яна» запоминаются как разные люди. */
export function запомнитьРазныхЛюдей(имена) {
  сверитьЧатРеестра();
  const полные = [...new Set((Array.isArray(имена) ? имена : []).map(и => normalizeNameText(безПриставки(и))).filter(и => и.includes(' ')))];
  for (let i = 0; i < полные.length; i++) for (let j = i + 1; j < полные.length; j++) {
    const а = полные[i], б = полные[j];
    if (!нужноПолноеИмя(а) && !нужноПолноеИмя(б) && !разборВосточногоИмени(а) && !разборВосточногоИмени(б)) continue;
    const сб = new Set(б.split(' '));
    for (const слово of а.split(' ')) {
      if (!сб.has(слово) || ОБЩИЕ_СЛОВА.has(словоИмени(слово)) || namesLikelySame(а, б)) continue;
      ОБЩИЕ_СЛОВА.add(словоИмени(слово));
      памятьСравнений.clear();
    }
  }
  const слова = [...new Set((Array.isArray(имена) ? имена : []).map(первоеСловоИмени).filter(Boolean))];
  if (слова.length < 2) return;
  for (let i = 0; i < слова.length; i++) for (let j = i + 1; j < слова.length; j++) {
    const а = слова[i], б = слова[j];
    if (!женскоеОтМужского(а, б) && !женскоеОтМужского(б, а)) continue;
    const к = ключПары(а, б);
    if (РАЗНЫЕ_ЛЮДИ.has(к)) continue;
    РАЗНЫЕ_ЛЮДИ.add(к);
    памятьСравнений.clear();
  }
}
function разныеЛюди(a, b) {
  if (!РАЗНЫЕ_ЛЮДИ.size) return false;
  const а = первоеСловоИмени(a), б = первоеСловоИмени(b);
  return !!а && !!б && а !== б && РАЗНЫЕ_ЛЮДИ.has(ключПары(а, б));
}

/**
 * Тот же человек — строго: одно и то же имя, или одно имя с фамилией с одной
 * стороны («Вера» и «Вера Смирнова»). Без уменьшительных и созвучий: для
 * игрока (user-chat.js, сторона пузыря) «Макс» и «Максим», «Ян» и «Яна» —
 * разные люди, иначе ответы Максима выбрасывались бы как написанные за игрока.
 */
export function тотЖеСтрого(a, b) {
  const слова = (v) => String(v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`.,;:!?()[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
  const А = слова(a), Б = слова(b);
  if (!А.length || !Б.length) return false;
  if (А.join(' ') === Б.join(' ')) return true;
  return А[0] === Б[0] && (А.length === 1 || Б.length === 1);
}

export function namesLikelySame(a, b) {
  const sa = String(a ?? ''), sb = String(b ?? '');
  if (sa === sb) return !!normalizeNameText(sa);
  сверитьСписки();
  const k = sa + '\u0001' + sb;
  let v = памятьСравнений.get(k);
  if (v === undefined) {
    v = сравнитьИмена(sa, sb);
    if (памятьСравнений.size >= ПРЕДЕЛ_ПАМЯТИ) памятьСравнений.clear();
    памятьСравнений.set(k, v);
  }
  return v;
}
// Приставка карточки («THE LANTERNS  Damian Hartley») — не часть имени: по
// общему первому слову «the» Нолан и Дамиан из одной карточки сходили за одного.
// Слова капслоком впереди, если дальше есть строчные буквы (как имяБезПриставки).
function безПриставки(имя) {
  const слова = String(имя ?? '').trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < слова.length - 1 && !известнаяФамилия(слова[i]) && /^[\p{Lu}\d'’&.-]{2,}$/u.test(слова[i]) && /\p{Ll}/u.test(слова.slice(i + 1).join(' '))) i++;
  return слова.slice(i).join(' ');
}
// Личные имена при общей фамилии: «Минсу» и Minsu — одно, «Минсу» и «Минсук» —
// разные. Падеж узнаём, только когда одна форма похожа на именительный:
// «Анна»/«Анны», «Минсук»/«Минсуком», «Ковальский»/«Ковальского». «Минсу» и
// «Минсо» не склоняются друг в друга.
const ОКОНЧАНИЕ_ЛИЧНОГО = /(?:ого|его|ому|ему|ыми|ими|ой|ей|ою|ею|ом|ем|ым|им|ую|юю|ая|яя|ий|ый|а|я|у|ю|е|ы|и|о)$/u;
const ИМЕНИТЕЛЬНЫЙ = new Set(['', 'а', 'я', 'ий', 'ый', 'ой', 'ая', 'яя']);
function личныеСовпали(x, y) {
  const лат = s => transliterateCyrillic(s).replace(/dzh/g, 'j').replace(/oo/g, 'u').replace(/[\s-]/g, '');
  if (лат(x) === лат(y)) return true;
  if (!/^[а-яё\s-]+$/u.test(x + y)) return false;
  const разбор = s => { const с = s.replace(/[\s-]/g, ''); const к = (с.match(ОКОНЧАНИЕ_ЛИЧНОГО) || [''])[0]; return [с.slice(0, с.length - к.length), к]; };
  const [ох, кх] = разбор(x), [оy, кy] = разбор(y);
  return ох.length >= 2 && ох === оy && (ИМЕНИТЕЛЬНЫЙ.has(кх) || ИМЕНИТЕЛЬНЫЙ.has(кy));
}
// true / false — решено по фамилии и личному имени; null — решать как раньше.
function сравнитьПолныеИмена(a, b) {
  if (/^[가-힣\s]+$/u.test(a) && /^[가-힣\s]+$/u.test(b)) return a.replace(/\s/g, '') === b.replace(/\s/g, '');
  if (иероглифыИКана(a) || иероглифыИКана(b)) return a.replace(/\s/g, '') === b.replace(/\s/g, '');
  const ta = a.trim().split(/\s+/).filter(Boolean), tb = b.trim().split(/\s+/).filter(Boolean);
  if (ta.length < 2 && tb.length < 2) return null;
  // Одно слово против полного имени: «Ким» при двух Кимах в одном HUD —
  // неизвестно кто. Иначе — как раньше: «Ян» — это «Ян Ковальский».
  if (ta.length < 2 || tb.length < 2) return словоОбщееВЧате(ta.length < 2 ? ta[0] : tb[0], ta.length < 2 ? tb : ta) ? false : null;
  const ра = разборВосточногоИмени(a), рб = разборВосточногоИмени(b);
  if (!ра || !рб) return null;
  if (ра.фамилия !== рб.фамилия) return false;
  return личныеСовпали(ра.личное, рб.личное);
}

function сравнитьИмена(a, b) {
  a = безПриставки(a); b = безПриставки(b);
  const A = normalizeNameText(a), B = normalizeNameText(b);
  if (!A || !B) return false;
  if (A === B) return true;
  // Списки имён из настроек аватарок — прямое указание пользователя, и оно
  // главнее любых догадок по буквам: перечисленные под одной картинкой имена
  // сливаются, а имена под разными картинками остаются разными людьми.
  const сказано = поСпискамАватарок(A, B);
  if (сказано !== null) return сказано;
  if (разныеЛюди(a, b)) return false;
  const корейское = сравнитьПолныеИмена(A, B);
  if (корейское !== null) return корейское;
  if (nameVariants(A).has(nameVariants(B).values().next().value)) return true;

  const va = nameVariants(A), vb = nameVariants(B);
  for (const x of va) if (vb.has(x)) return true;

  const ta = A.split(/\s+/), tb = B.split(/\s+/);
  // "Анна" и "Anna Smith" должны ссылаться на одного человека, если
  // совпадает первый/единственный идентифицирующий токен.
  const aFirst = namePhoneticLatin(ta[0] || A);
  const bFirst = namePhoneticLatin(tb[0] || B);
  if (aFirst && bFirst && первыеСловаСовпадают(aFirst, bFirst, ta[0] || A, tb[0] || B)) return true;

  // Одна фамилия — ещё не один человек: у «Иды Олдридж» и «Нины Олдридж»
  // длинная общая фамилия растворяла разницу в именах, и сёстры сливались.
  // Когда у обоих есть имя и фамилия, имена сверяем отдельно: опечатку
  // прощаем («Изольда» / «Isolde»), другое имя — нет.
  if (ta.length >= 2 && tb.length >= 2) {
    const fa = namePhoneticLatin(ta[0]), fb = namePhoneticLatin(tb[0]);
    if (fa && fb && fa !== fb && levenshtein(fa, fb) > (Math.min(fa.length, fb.length) >= 6 ? 2 : 1)) return false;
  }

  const ca = nameConsonantSignature(A), cb = nameConsonantSignature(B);
  if (ca && cb) {
    const dist = levenshtein(ca, cb);
    // Две правки прощаем только длинным подписям, и меряем по короткой из
    // двух: у «утренний» (trnn) и «Дамиан» (trstn) расстояние 2, и по
    // длинной они сходили за одного человека — чужой чат подписывался
    // именем владельца, а чужие реплики вставали справа.
    const minLen = Math.min(ca.length, cb.length);
    // Согласных мало, и по ним одному человеку легко сойти за другого:
    // «Дамиан» (trstn) и «Кристина» (krstn) отличаются одной буквой.
    // Поэтому спрашиваем ещё и полное звучание: «Изольда» и «Isolde» по нему
    // рядом (izolda / isolde), а Дамиан с Кристиной — нет.
    const полное = levenshtein(namePhoneticLatin(A), namePhoneticLatin(B));
    if (полное > 2) return false;
    // У коротких имён одна-две согласные: «Ева» (v) и «Ана» (n), «Ария» (r)
    // и «Мария» (mr) по ним отличались на одну букву и сливались.
    if (minLen < 4) return false;
    if (dist <= 1 || (minLen >= 6 && dist <= 2)) return true;
  }
  return false;
}

// --- Уменьшительные формы ----------------------------------------------------
// «Миша» и «Michael». Транслитерация сама этого не видит: у «Миши» и «Майкла»
// разные согласные. Используются ТОЛЬКО в найтиПоИмени и только как самое
// слабое совпадение — в общее сравнение имён не входят.
const ПОЛНЫЕ_ФОРМЫ = {
  'миша': ['михаил'], 'мишка': ['михаил'], 'саша': ['александр', 'александра'], 'шура': ['александр', 'александра'],
  'женя': ['евгений', 'евгения'], 'леша': ['алексей'], 'алеша': ['алексей'], 'дима': ['дмитрий'], 'митя': ['дмитрий'],
  'коля': ['николай'], 'катя': ['екатерина'], 'настя': ['анастасия'], 'маша': ['мария'], 'таня': ['татьяна'],
  'лена': ['елена'], 'оля': ['ольга'], 'юля': ['юлия'], 'ваня': ['иван'], 'вова': ['владимир'], 'володя': ['владимир'],
  'петя': ['петр'], 'сережа': ['сергей'], 'паша': ['павел'], 'костя': ['константин'], 'наташа': ['наталья'],
  'света': ['светлана'], 'аня': ['анна'], 'даша': ['дарья'], 'соня': ['софья', 'софия'], 'лиза': ['елизавета'],
  'леня': ['леонид'], 'гоша': ['георгий'], 'ира': ['ирина'], 'вика': ['виктория'], 'витя': ['виктор'],
  'гриша': ['григорий'], 'рома': ['роман'], 'толя': ['анатолий'], 'слава': ['вячеслав', 'ярослав'], 'галя': ['галина'],
  'mike': ['michael'], 'mikey': ['michael'], 'mick': ['michael'], 'alex': ['alexander', 'alexandra'],
  'kate': ['catherine', 'katherine'], 'katie': ['catherine', 'katherine'], 'liz': ['elizabeth'], 'lizzy': ['elizabeth'],
  'beth': ['elizabeth'], 'bob': ['robert'], 'rob': ['robert'], 'bobby': ['robert'], 'bill': ['william'], 'will': ['william'],
  'dick': ['richard'], 'rick': ['richard'], 'richie': ['richard'], 'tom': ['thomas'], 'tommy': ['thomas'],
  'jim': ['james'], 'jimmy': ['james'], 'jack': ['john'], 'johnny': ['john'], 'tony': ['anthony'], 'sam': ['samuel', 'samantha'],
  'chris': ['christopher', 'christina'], 'nick': ['nicholas'], 'dan': ['daniel'], 'danny': ['daniel'], 'ben': ['benjamin'],
  'matt': ['matthew'], 'andy': ['andrew'], 'jen': ['jennifer'], 'jenny': ['jennifer'],
  'maggie': ['margaret'], 'meg': ['margaret'], 'eddie': ['edward'], 'ed': ['edward'], 'ted': ['edward'],
};

function полныеФормы(слово) {
  const s = String(слово || '').toLowerCase().replace(/ё/g, 'е');
  return [s, ...(ПОЛНЫЕ_ФОРМЫ[s] || [])];
}

// Совпадение через полную форму: первое слово каждого имени пробуем в полной
// форме («Миша» → «Михаил»), остальное — как есть.
function совпадаютЧерезПолнуюФорму(a, b) {
  const A = String(a ?? '').trim().split(/\s+/), B = String(b ?? '').trim().split(/\s+/);
  if (!A[0] || !B[0]) return false;
  const низA = A[0].toLowerCase().replace(/ё/g, 'е'), низB = B[0].toLowerCase().replace(/ё/g, 'е');
  for (const fa of полныеФормы(A[0])) for (const fb of полныеФормы(B[0])) {
    if (fa === низA && fb === низB) continue;
    if (namesLikelySame([fa, ...A.slice(1)].join(' '), [fb, ...B.slice(1)].join(' '))) return true;
  }
  return false;
}

// --- Падежи ------------------------------------------------------------------
// «сестра Гордона», «мать Софии», «жена Дамиана Хартли»: имя стоит в
// косвенном падеже. Отдаём возможные именительные формы — от них уже
// работает обычное сравнение. Латиница остаётся как есть.
const ОКОНЧАНИЯ = [
  ['ами', ''], ['ями', ''], ['ого', ''], ['его', ''], ['ому', ''], ['ему', ''],
  ['ией', 'ия'], ['ии', 'ия'], ['ии', 'и'], ['ию', 'ия'], ['ой', 'а'], ['ей', 'я'], ['ей', 'и'], ['ом', ''], ['ем', ''], ['ым', ''], ['им', ''],
  ['а', ''], ['я', 'й'], ['я', 'ь'], ['у', 'а'], ['ю', 'я'], ['ы', 'а'], ['и', 'а'], ['и', 'я'], ['е', 'а'], ['е', 'я'], ['е', ''], ['у', ''], ['ю', 'й'],
];
function формыСлова(слово) {
  const s = String(слово || '').replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  const out = [s];
  if (!/[а-яё]/i.test(s)) return out;
  const низ = s.toLowerCase();
  for (const [конец, замена] of ОКОНЧАНИЯ) {
    if (низ.length >= конец.length + 3 && низ.endsWith(конец)) {
      const форма = s.slice(0, s.length - конец.length) + замена;
      if (!out.includes(форма)) out.push(форма);
    }
  }
  return out;
}
export function формыИмени(имя) {
  const слова = String(имя || '').trim().split(/\s+/).filter(Boolean);
  if (!слова.length) return [];
  const первые = формыСлова(слова[0]);
  const хвосты = слова.length > 1 ? [...new Set([слова.slice(1).join(' '), слова.slice(1).map(w => формыСлова(w)[1] || w).join(' ')])] : [''];
  const out = [];
  for (const п of первые) for (const х of хвосты) out.push((п + ' ' + х).trim());
  return out;
}

// Кто из списка имён назван в тексте. Три ступени, сильная главнее слабой:
//   3 — звучит один в один («Дамиана» → Damian);
//   2 — похоже по общему сравнению (опечатка, другое написание);
//   1 — только через уменьшительную форму («Миши» → Michael).
// Побеждает высшая ступень. Если на ней двое — не угадываем: -1.
export function найтиПоИмени(имя, имена) {
  const формы = формыИмени(имя);
  if (!формы.length) return -1;
  const звук = (w) => namePhoneticLatin(w);
  let лучший = -1, лучшийСчёт = 0, спор = false;
  (имена || []).forEach((другое, i) => {
    const первоеДругого = String(другое || '').trim().split(/\s+/)[0] || '';
    let счёт = 0;
    if (нужноПолноеИмя(имя) || нужноПолноеИмя(другое)) {
      счёт = namesLikelySame(имя, другое) ? 3 : 0;
    } else for (const ф of формы) {
      const первое = ф.split(/\s+/)[0];
      if (звук(первое) && звук(первое) === звук(первоеДругого)) { счёт = 3; break; }
      if (namesLikelySame(ф, другое)) счёт = Math.max(счёт, 2);
      else if (совпадаютЧерезПолнуюФорму(ф, другое)) счёт = Math.max(счёт, 1);
    }
    if (!счёт) return;
    if (счёт > лучшийСчёт) { лучший = i; лучшийСчёт = счёт; спор = false; }
    else if (счёт === лучшийСчёт) спор = true;
  });
  return спор ? -1 : лучший;
}

// Все написания человека, которые пользователь перечислил под одной
// картинкой в настройках аватарок («Энджи, Анджела, Ева, Angela»).
// Без списков — только само имя.
export function алиасыИмени(имя) {
  const н = normalizeNameText(имя);
  if (!н) return [];
  let группы = [];
  try { группы = группыАватарок(); } catch (_) { группы = []; }
  const первое = н.split(' ')[0];
  const out = new Set([н]);
  for (const г of группы) if (г.some(x => сравнитьПолныеИмена(x, н) ?? (x === н || x.split(' ')[0] === первое))) г.forEach(x => out.add(x));
  return [...out];
}

// Назван ли человек в тексте: любым написанием из списков аватарок, в
// падеже («Анджелой»), транслитом («Marie» — «Мари»). Смотрим слова
// с большой буквы — имена в тексте пишут так.
// Где человек назван в тексте впервые: позиция слова или -1. Те же правила,
// что у упомянутВТексте: падеж, транслит, написания из списков аватарок.
export function гдеУпомянут(текст, имя) {
  const s = String(текст || '');
  if (!s.trim() || !String(имя || '').trim()) return -1;
  const алиасы = алиасыИмени(имя);
  let позиция = -1;
  const короткие = [];
  for (const а of алиасы) {
    if (!нужноПолноеИмя(а)) { короткие.push(а.split(' ')[0]); continue; }
    if (!а.includes(' ') && (известнаяФамилия(а) || [...а].length === 1)) continue;
    const шаблон = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー\s]+$/u.test(а)
      ? [...а.replace(/\s/g, '')].join('\\s*')
      : а.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+');
    const м = new RegExp('(?<![\\p{L}-])' + шаблон + '(?![\\p{L}-])', 'iu').exec(s);
    if (м && (позиция < 0 || м.index < позиция)) позиция = м.index;
  }
  for (const м of s.matchAll(/(?<![\p{L}])\p{Lu}[\p{L}'’-]{1,}/gu)) {
    if (короткие.some(а => а.length >= 2 && namesLikelySame(м[0], а))) return позиция < 0 ? м.index : Math.min(позиция, м.index);
  }
  return позиция;
}

export function упомянутВТексте(текст, имя) {
  return гдеУпомянут(текст, имя) >= 0;
}
