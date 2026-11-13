// hud-manager/translations/build.mjs
//
// Таблица строк для переводчиков и сборка языков из неё.
//
// Интерфейс HUD написан по-русски, английский — словарь i18n-en.js. Другие
// языки идут ЧЕРЕЗ английский: переводчик видит английскую строку и пишет
// рядом свою, русский — только колонка для справки. Ключ строки — сам
// английский текст: одинаковые английские строки переводятся один раз.
//
//   node translations/build.mjs           — обновить template.csv, каждую
//                                           <код>.csv (новые строки добавятся
//                                           пустыми) и собрать <код>.js
//   node translations/build.mjs --check   — ничего не писать; код 1, если
//                                           что-то устарело (для тестов)
//
// Файлы:
//   template.csv   — все строки, колонка translation пустая (генерируется)
//   <код>.csv      — работа переводчика: zh.csv, es.csv, pt-BR.csv …
//   <код>.js       — собранный язык, его грузит i18n.js (генерируется)
//   languages.js   — список собранных языков для меню (генерируется)
//   meta.js        — какие строки есть, какие пишет код, правила CSS-подписей:
//                    по нему HUD сам собирает язык из файла, загруженного в
//                    настройках (генерируется)
//   table.js       — разбор и проверка таблицы, общее с браузером

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { разобратьCSV, вCSV, проверитьПеревод, отделать, собратьCSS, собратьЯзык, ЛИТЕРАЛ_CSS } from './table.js';
// Пример «Кастомизации» (выдуманная история) — тоже в таблицу: куски текста английского примера.
import * as ПРИМЕР_EN from '../render/sample-hud-en.js';
import { кускиПримера } from '../render/sample-translate.js';

export { разобратьCSV, проверитьПеревод, отделать, собратьCSS, собратьЯзык };

const ПАПКА = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ПАПКА, '..');
const ПРОВЕРКА = process.argv.includes('--check');

const { СЛОВАРЬ_EN, ШАБЛОНЫ_EN, ЗОДИАК_EN, КОД_EN } = await import(pathToFileURL(path.join(КОРЕНЬ, 'i18n-en.js')).href);

// --- Строки ---------------------------------------------------------------------

// Шаблон словаря — регулярка по русской строке. Для справки переводчику
// показываем её по-человечески: «(\d+) (?:год|года|лет)» → «{1} год/года/лет».
export function шаблонПоЛюдски(src) {
  let s = src.replace(/^\^/, '').replace(/\$$/, '');
  let n = 0;
  const стек = [];
  let итог = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      const d = s[i + 1];
      итог += d === 'd' ? '#' : d === 's' ? ' ' : d === 'p' ? (i += s.slice(i).indexOf('}') - 1, '') : d;
      i++;
      continue;
    }
    if (c === '(') {
      const незахват = s[i + 1] === '?';
      if (незахват) i += s[i + 2] === '<' ? 3 : 2;
      стек.push({ захват: !незахват, номер: незахват ? 0 : ++n, начало: итог.length });
      continue;
    }
    if (c === ')') {
      const г = стек.pop();
      if (г && г.захват) итог = итог.slice(0, г.начало) + '{' + г.номер + '}';
      if (s[i + 1] === '?') i++;
      continue;
    }
    if (c === '|') { итог += '/'; continue; }
    if (c === '[') { const j = s.indexOf(']', i); итог += j > i ? '' : c; if (j > i) i = j; continue; }
    if ('?*+'.includes(c)) continue;
    if (c === '.') { итог += '…'; continue; }
    итог += c;
  }
  return итог.replace(/\s+/g, ' ').trim();
}

const вСкобки = (en) => en.replace(/\$(\d)/g, '{$1}');

// --- Английский, который код пишет сам ------------------------------------------
//
// Ветки «английский() ? 'EN' : 'RU'», «ен ? …», L('ru', 'en') — мимо словаря.
// Видимые игроку строки из них тоже идут в таблицу: ${…} → {1}, {2}.
// Не берём то, что уходит модели (инструкции, сводки, строка быта), —
// модель в любом языке пишет HUD по-английски.
const МИМО_ФАЙЛОВ = new Set(['lore.js', 'prompt.js', 'prompt-en.js', 'whats-new.js', 'render/life.js', 'render/assistant.js', 'bump-version.cjs']);
const МИМО_СТРОК = new Set(['en-US', 'English', '"rainy night in the car"', 'Clothing', 'Event', 'secret', 'fired', 'New',
  'bat: cracked at the handle; folding knife: in the jacket pocket, hidden', 'MIR']);

function литерал(s, i) {
  const q = s[i];
  if (!`'"\``.includes(q)) return null;
  let j = i + 1, out = '', n = 0;
  while (j < s.length && s[j] !== q) {
    if (s[j] === '\\') { out += s[j + 1]; j += 2; continue; }
    if (q === '`' && s[j] === '$' && s[j + 1] === '{') {
      let глуб = 1; j += 2;
      while (j < s.length && глуб) {
        if (s[j] === '{') глуб++;
        else if (s[j] === '}') глуб--;
        else if (`'"\``.includes(s[j])) { const в = литерал(s, j); if (в) { j = в.конец; continue; } }
        j++;
      }
      out += '{' + (++n) + '}';
      continue;
    }
    out += s[j++];
  }
  return { текст: out, конец: j + 1 };
}
// Номера мест по порядку: «{3} of {4}» → «{1} of {2}».
const перенумеровать = (s) => { let n = 0; const м = new Map(); return s.replace(/\{(\d)\}/g, (_, k) => '{' + (м.get(k) || (м.set(k, ++n), n)) + '}'); };
// Кусок разметки — на тексты между тегами и подсказки в title/placeholder/aria-label.
function куски(текст) {
  if (!/<[a-z/]/i.test(текст)) return [текст];
  const out = [];
  текст.replace(/\b(?:title|placeholder|aria-label|data-tip)="([^"]*)"/g, (_, v) => { out.push(v); return ''; });
  for (const t of текст.replace(/<[^>]*>/g, '\u0000').split('\u0000')) out.push(t);
  return out;
}
const чистый = (s) => перенумеровать(s.trim().replace(/^\(([^()]*)\)$/, '$1').replace(/:$/, '').trim());

/** Английские строки из веток кода: [{english, где}]. */
export function строкиКода() {
  const файлы = [];
  (function обход(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'tests', 'translations', 'imported-plans', 'docs'].includes(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) обход(p);
      else if (e.name.endsWith('.js') && !/^i18n|^sample-hud/.test(e.name)) файлы.push(p);
    }
  })(КОРЕНЬ);
  const найдено = new Map();
  for (const f of файлы.sort()) {
    const имя = path.relative(КОРЕНЬ, f).replace(/\\/g, '/');
    if (МИМО_ФАЙЛОВ.has(имя)) continue;
    const s = fs.readFileSync(f, 'utf8');
    const взять = (поз, где) => {
      const л = литерал(s, поз);
      if (!л || /[а-яё]/i.test(л.текст)) return;
      for (const к of куски(л.текст)) {
        const t = чистый(к);
        if (!/[A-Za-z]{2}/.test(t) || МИМО_СТРОК.has(t) || найдено.has(t)) continue;
        // Без номера строки: правка выше по файлу не должна менять таблицу.
        найдено.set(t, имя);
      }
    };
    let m;
    const rx = /(?:английский\(\)|(?<![А-Яа-яЁёA-Za-z_$.])(?:ен|en|англ))\s*\?\s*/g;
    while ((m = rx.exec(s))) взять(m.index + m[0].length, m.index);
    const rl = /(?<![А-Яа-яЁёA-Za-z_$.])L\(\s*/g;
    while ((m = rl.exec(s))) {
      const п = литерал(s, m.index + m[0].length);
      const к = п && s.slice(п.конец).match(/^\s*,\s*/);
      if (к) взять(п.конец + к[0].length, m.index);
    }
  }
  return [...найдено].map(([english, где]) => ({ english, где }));
}

// --- Подписи в CSS --------------------------------------------------------------
//
// Часть подписей — в CSS (content: '…'): для английского они продублированы
// в css/lang-en.css. Для языка из таблицы эти правила пересобираются с его
// строками и ставятся на страницу отдельным <style> (i18n.js).
const ФАЙЛ_CSS = path.join(КОРЕНЬ, 'css', 'lang-en.css');
/** Правила lang-en.css с подписями: [{правило, строки}]. */
export function правилаCSS() {
  if (!fs.existsSync(ФАЙЛ_CSS)) return [];
  const css = fs.readFileSync(ФАЙЛ_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of css.matchAll(/[^{}]+\{[^{}]*\bcontent\s*:[^{}]*\}/g)) {
    const правило = m[0].trim();
    const строки = [...правило.slice(правило.indexOf('{')).matchAll(ЛИТЕРАЛ_CSS)].map(x => x[1] ?? x[2]).filter(s => /\p{L}{2}/u.test(s));
    if (строки.length) out.push({ правило, строки });
  }
  return out;
}
/** Все строки для перевода, по порядку словаря: [{english, russian, kind, код}]. */
export function собратьСтроки() {
  const поАнгл = new Map();
  // код — английский, который код пишет сам: только эти строки HUD узнаёт
  // в английском тексте на странице (иначе персонаж по имени Leo стал бы знаком зодиака).
  const добавить = (english, russian, kind, код = false) => {
    const был = поАнгл.get(english);
    if (был) { if (был.ru.length < 3 && !был.ru.includes(russian)) был.ru.push(russian); был.код ||= код; return; }
    поАнгл.set(english, { english, ru: [russian], kind, код });
  };
  добавить('@language', 'Name of your language as shown in the language menu, e.g. 中文 or Español', 'name');
  for (const [ru, en] of Object.entries(СЛОВАРЬ_EN)) добавить(en, ru, 'text');
  for (const [rx, en] of ШАБЛОНЫ_EN) добавить(вСкобки(en), шаблонПоЛюдски(rx), 'pattern');
  for (const [ru, en] of Object.entries(ЗОДИАК_EN)) добавить(en, ru + ' (zodiac sign)', 'text');
  // Английский из кода: без русского оригинала, в справке — где он.
  const вид = (en) => (/\{\d\}/.test(en) ? 'pattern' : 'text');
  for (const en of КОД_EN) добавить(en, '(written by code)', вид(en), true);
  for (const с of строкиКода()) добавить(с.english, '(written by code: ' + с.где + ')', вид(с.english), true);
  for (const п of правилаCSS()) for (const s of п.строки) добавить(s, '(CSS label in css/lang-en.css; \\A is a line break)', 'text');
  // Пример: в самом конце таблицы, чтобы переводчик сначала шёл по интерфейсу.
  for (const к of кускиПримера(ПРИМЕР_EN)) добавить(к, '(Customization sample: the made-up story in the preview)', 'text');
  return [...поАнгл.values()].map(с => ({ english: с.english, russian: с.ru.join(' | '), kind: с.kind, код: с.код }));
}

const ЗАГОЛОВОК = ['english', 'translation', 'context', 'kind', 'notes'];

/** Справка для сборки языка: все строки, строки кода, правила CSS-подписей. */
export function собратьМету(строки = собратьСтроки()) {
  const все = строки.filter(с => с.kind !== 'name');
  return { keys: все.map(с => с.english), code: все.filter(с => с.код).map(с => с.english), css: правилаCSS() };
}

// --- Сборка ---------------------------------------------------------------------

// Только из командной строки: тесты берут отсюда функции и ничего не пишут.
const ЗАПУСК = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url.split("?")[0];
if (ЗАПУСК) собрать();

function собрать() {
const строки = собратьСтроки();
const устарело = [];
const записать = (файл, содержимое) => {
  const путь = path.join(ПАПКА, файл);
  const было = fs.existsSync(путь) ? fs.readFileSync(путь, 'utf8') : null;
  if (было === содержимое) return;
  if (ПРОВЕРКА) { устарело.push(файл); return; }
  fs.writeFileSync(путь, содержимое);
  console.log('записан', файл);
};

записать('template.csv', вCSV([ЗАГОЛОВОК, ...строки.map(с => [с.english, '', с.russian, с.kind, ''])]));
const мета = собратьМету(строки);
записать('meta.js', '// Generated by translations/build.mjs — what HUD needs to build a language from a translator\'s CSV.\n'
  + `export default ${JSON.stringify(мета)};\n`);

const КОД = /^([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)\.csv$/;
const языки = [];
for (const файл of fs.readdirSync(ПАПКА).sort()) {
  const m = файл.match(КОД);
  if (!m || ['ru', 'en'].includes(m[1])) continue;
  const код = m[1];
  const итог = собратьЯзык(fs.readFileSync(path.join(ПАПКА, файл), 'utf8'), мета, код);
  if (итог.ошибка) { console.error(файл + ': ' + итог.ошибка + ', skipped'); process.exitCode = 1; continue; }
  const { язык, готово, всего, перевод, заметки } = итог;
  const ошибки = итог.ошибки.map(о => `  «${о.english.slice(0, 60)}»: ${о.беда}`);
  const имя = язык.name, процент = язык.done;
  // Строки, которых больше нет в HUD (английский текст поменялся), — в конец, чтобы перевод не пропал.
  const есть = new Set(строки.map(с => с.english));
  const старые = [...перевод.keys()].filter(en => !есть.has(en));
  записать(файл, вCSV([ЗАГОЛОВОК,
    ...строки.map(с => [с.english, перевод.get(с.english) || '', с.russian, с.kind, заметки.get(с.english) || '']),
    ...старые.map(en => [en, перевод.get(en), '', 'unused', заметки.get(en) || ''])]));
  записать(код + '.js', `// Generated by translations/build.mjs from ${файл} — do not edit, edit the CSV.\n`
    + `export default ${JSON.stringify(язык, null, 0)};\n`);
  языки.push({ code: код, name: имя, done: процент });
  if (!ПРОВЕРКА) {
    console.log(`${код} (${имя}): ${готово} of ${всего} — ${процент}%` + (старые.length ? `, unused old rows: ${старые.length}` : ''));
    if (ошибки.length) console.log('rows skipped:\n' + ошибки.slice(0, 40).join('\n') + (ошибки.length > 40 ? `\n  … and ${ошибки.length - 40} more` : ''));
  }
}

записать('languages.js', '// Generated by translations/build.mjs — the built languages for the HUD language menu.\n'
  + `export const ЯЗЫКИ = ${JSON.stringify(языки)};\n`);

if (ПРОВЕРКА && устарело.length) {
  console.log('устарело (запусти node translations/build.mjs): ' + устарело.join(', '));
  process.exitCode = 1;
}
}
