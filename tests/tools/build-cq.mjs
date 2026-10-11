// Контейнерные запросы из блоков @media (max-width: 600px).
//
//   node tests/tools/build-cq.mjs           пересобрать копии во всех css/*.css
//   node tests/tools/build-cq.mjs --check   только проверить, что копии свежие (для тестов)
//   CQ=470 node tests/tools/build-cq.mjs    другой порог ширины карточки
//
// Каждый «узкий» блок @media получает копию сразу за собой — между метками
// «cq ↓» и «cq ↑». Копия срабатывает, когда ОКНО широкое (там старый блок
// молчит), а сама КАРТОЧКА узкая: узкая колонка чата на большом мониторе,
// боковая панель. В узком окне работает прежний блок, копия молчит — поэтому
// на телефоне вид не меняется ни на пиксель.
//
// Копия стоит на месте оригинала, а не в отдельном файле в конце: так у неё
// тот же порядок в каскаде, и правила, которые перебивали узкий блок, так же
// перебивают и копию.
//
// Без контейнера @container hud не срабатывает вовсе: контейнер объявляет
// css/platform.css только под html.hud-cq (настройка containerQueries).
//
// Править руками нужно оригинальный блок @media; копию — этим скриптом.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ПРОВЕРКА = process.argv.includes('--check');
// Порог — ширина карточки в живой Таверне при окне 600px: 466px (замер, 23.49).
export const ПОРОГ = Number(process.env.CQ) || 470;
const НАЧАЛО = '/* cq ↓ копия блока выше для узкой карточки в широком окне — tests/tools/build-cq.mjs, руками не править */';
const КОНЕЦ = '/* cq ↑ */';

const УЗКИЙ = /@media\s+((?:screen\s+and\s+)?)\(\s*max-width\s*:\s*600px\s*\)([^{]*)\{/g;

// Конец блока по скобкам — с учётом строк и комментариев.
function конецБлока(т, i) {
  let глубина = 0;
  for (; i < т.length; i++) {
    const c = т[i];
    if (c === '/' && т[i + 1] === '*') { i = т.indexOf('*/', i + 2) + 1; if (i === 0) return -1; continue; }
    if (c === '"' || c === "'") { const к = c; i++; while (i < т.length && т[i] !== к) { if (т[i] === '\\') i++; i++; } continue; }
    if (c === '{') глубина++;
    else if (c === '}') { глубина--; if (глубина === 0) return i; }
  }
  return -1;
}

export function пересобрать(текст, порог = ПОРОГ) {
  const nl = текст.includes('\r\n') ? '\r\n' : '\n';
  // Старые копии — прочь, потом заново.
  const экр = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let т = текст.replace(new RegExp(String.raw`(?:\r?\n)?` + экр(НАЧАЛО) + String.raw`[\s\S]*?` + экр(КОНЕЦ), 'g'), '');
  let выход = '', позиция = 0, блоков = 0;
  УЗКИЙ.lastIndex = 0;
  let м;
  while ((м = УЗКИЙ.exec(т))) {
    const откр = м.index + м[0].length - 1;
    const конец = конецБлока(т, откр);
    if (конец < 0) break;
    const тело = т.slice(откр + 1, конец);
    const прочее = (м[2] || '').trim();
    const условие = `@media ${м[1] || ''}(min-width: 601px)${прочее ? ' ' + прочее : ''}`;
    выход += т.slice(позиция, конец + 1) + nl + НАЧАЛО + nl + `${условие} { @container hud (max-width: ${порог}px) {${тело}} }` + nl + КОНЕЦ;
    позиция = конец + 1;
    УЗКИЙ.lastIndex = конец + 1;
    блоков++;
  }
  выход += т.slice(позиция);
  return { текст: выход, блоков };
}

const это = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (это) {
  const файлы = fs.readdirSync(path.join(КОРЕНЬ, 'css')).filter(f => f.endsWith('.css') && f !== 'all.css');
  let всего = 0, устарело = [];
  for (const ф of файлы) {
    const полный = path.join(КОРЕНЬ, 'css', ф);
    const было = fs.readFileSync(полный, 'utf8');
    const { текст, блоков } = пересобрать(было);
    всего += блоков;
    if (текст !== было) {
      if (ПРОВЕРКА) устарело.push(ф);
      else { fs.writeFileSync(полный, текст); console.log(`${ф}: ${блоков}`); }
    }
  }
  if (ПРОВЕРКА) {
    if (устарело.length) { console.log('Копии устарели: ' + устарело.join(', ') + ' — node tests/tools/build-cq.mjs'); process.exitCode = 1; }
    else console.log(`Копии свежие: ${всего} блоков`);
  } else console.log(`Блоков: ${всего}, порог карточки ${ПОРОГ}px`);
}
