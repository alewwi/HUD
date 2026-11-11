// hud-manager/translations/table.js
//
// Таблица переводчика → язык HUD. Общее для сборки (build.mjs, Node) и для
// загрузки файла прямо в настройках HUD (i18n.js, браузер): переводчик
// проверяет свою таблицу у себя, без Node и без правки файлов расширения.
// Здесь — только чистые функции, без fs и без страницы.

/** Разбор CSV: запятая, точка с запятой (Excel в части стран) или табуляция. */
export function разобратьCSV(текст) {
  текст = String(текст).replace(/^﻿/, '');
  const перваяСтрока = текст.split(/\r?\n/, 1)[0];
  const вне = перваяСтрока.replace(/"[^"]*"/g, '');
  const разд = [',', ';', '\t'].sort((a, b) => вне.split(b).length - вне.split(a).length)[0];
  const строки = [];
  let ряд = [], поле = '', вКавычках = false;
  for (let i = 0; i < текст.length; i++) {
    const c = текст[i];
    if (вКавычках) {
      if (c === '"') { if (текст[i + 1] === '"') { поле += '"'; i++; } else вКавычках = false; }
      else поле += c;
    } else if (c === '"') вКавычках = true;
    else if (c === разд) { ряд.push(поле); поле = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && текст[i + 1] === '\n') i++;
      ряд.push(поле); поле = '';
      if (ряд.some(x => x !== '')) строки.push(ряд);
      ряд = [];
    } else поле += c;
  }
  ряд.push(поле);
  if (ряд.some(x => x !== '')) строки.push(ряд);
  return строки;
}

const ячейка = (v) => (/[",\n\r;\t]|^\s|\s$/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
// BOM и CRLF — чтобы Excel открыл UTF-8 без кракозябр.
export const вCSV = (ряды) => '﻿' + ряды.map(р => р.map(ячейка).join(',')).join('\r\n') + '\r\n';

// Теги разметки как они есть: <b>, </b>, <time> …
const тегиИз = (s) => (s.match(/<\/?[a-z][^<>]*>/gi) || []).sort().join('\u0000');
/**
 * Проверка перевода: те же {1}, {2} и те же теги — буква в букву. Перевод
 * попадает и в разметку, поэтому своих тегов, «<!--» и т. п. в нём быть не
 * может. null — всё хорошо, иначе — что не так (по-английски, для переводчика).
 */
export function проверитьПеревод(english, перевод) {
  const метки = (s) => (s.match(/\{\d\}/g) || []).sort().join();
  if (метки(english) !== метки(перевод)) return 'placeholders differ: ' + (метки(english) || 'none') + ' vs ' + (метки(перевод) || 'none');
  if (тегиИз(english) !== тегиИз(перевод)) return 'HTML tags differ (keep exactly the tags of the English)';
  // «<» перед буквой — только там, где он есть в английском (строка паспорта «IDRUS<<AGE<…»).
  const начала = (s) => (s.replace(/<\/?[a-z][^<>]*>/gi, '').match(/<[\p{L}!/?]/gu) || []);
  const можно = начала(english);
  for (const н of начала(перевод)) { const i = можно.indexOf(н); if (i < 0) return 'a "<" that starts markup is not allowed'; можно.splice(i, 1); }
  return null;
}
/**
 * Края пробелов — как в английском. Прямые двойные кавычки, которых нет в
 * английском, — типографскими: перевод попадает и в атрибуты title="…".
 */
export function отделать(english, перевод) {
  let t = перевод.trim();
  if (!english.includes('"')) { let откр = true; t = t.replace(/"/g, () => ((откр = !откр) ? '”' : '“')); }
  return english.match(/^\s*/)[0] + t + english.match(/\s*$/)[0];
}

// --- Подписи в CSS --------------------------------------------------------------
export const ЛИТЕРАЛ_CSS = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
// Строка для CSS: кавычки и обратные косые экранируются, «\A» (перенос) остаётся.
const вСтрокуCSS = (s) => "'" + s.replace(/\\(?!A\b|A )/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\A ') + "'";
/** Правила css/lang-en.css с подписями языка; правило без единого перевода не попадает. */
export function собратьCSS(правила, словарь) {
  return правила.map(({ правило }) => {
    let было = false;
    // :root:root — сильнее английского правила при любом порядке стилей.
    const новое = правило.replace(/^\s*:root/gm, ':root:root').replace(/,\s*:root(?!:root)/g, ', :root:root')
      .replace(/(\{[\s\S]*\})/, (тело) => тело.replace(ЛИТЕРАЛ_CSS, (лит, a, b) => {
        const t = словарь[a ?? b];
        if (t === undefined) return лит;
        было = true;
        return вСтрокуCSS(t);
      }));
    return было ? новое : '';
  }).filter(Boolean).join('\n');
}

// --- Язык из таблицы ------------------------------------------------------------

/**
 * Собрать язык из текста CSV переводчика.
 * мета — { keys: все английские строки, code: строки, которые пишет код, css: правила подписей }.
 * Итог: { язык: {code, name, done, strings, code_strings, css}, готово, всего, ошибки, перевод, заметки }
 * или { ошибка } — когда это не таблица переводчика.
 */
export function собратьЯзык(текстCSV, мета, код) {
  const ряды = разобратьCSV(текстCSV);
  const шапка = (ряды.shift() || []).map(h => String(h).trim().toLowerCase());
  const к = (имя) => шапка.indexOf(имя);
  if (к('english') < 0 || к('translation') < 0) return { ошибка: 'no "english" / "translation" columns' };
  const перевод = new Map(), заметки = new Map();
  for (const р of ряды) {
    const en = р[к('english')] ?? '';
    if (!en) continue;
    const t = р[к('translation')] ?? '';
    if (t.trim()) перевод.set(en, t);
    const з = к('notes') >= 0 ? р[к('notes')] ?? '' : '';
    if (з) заметки.set(en, з);
  }
  const strings = {};
  const ошибки = [];
  let готово = 0;
  for (const en of мета.keys) {
    const t = перевод.get(en);
    if (t === undefined) continue;
    const беда = проверитьПеревод(en, t);
    if (беда) { ошибки.push({ english: en, беда }); continue; }
    strings[en] = отделать(en, t);
    готово++;
  }
  const name = (перевод.get('@language') || код).replace(/\s+/g, ' ').trim().slice(0, 40);
  const всего = мета.keys.length;
  const done = всего ? Math.floor((готово / всего) * 100) : 0;
  const code_strings = мета.code.filter(en => strings[en] !== undefined);
  const css = собратьCSS(мета.css, strings);
  return { язык: { code: код, name, done, strings, code_strings, css }, готово, всего, ошибки, перевод, заметки };
}
