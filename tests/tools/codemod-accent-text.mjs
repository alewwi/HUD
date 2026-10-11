// Акцент как ТЕКСТ → var(--hud-accent-text, <как было>).
//
//   node tests/tools/codemod-accent-text.mjs          показать, что будет заменено
//   node tests/tools/codemod-accent-text.mjs --write  заменить
//
// Трогаем только свойства color и -webkit-text-fill-color, значение которых
// начинается с var(--hud-accent…). Рамки, фоны, тени и свечение (text-shadow)
// не трогаем: им нужен чистый акцент. --hud-accent-text пишет applyThemeColors
// (index.js) только когда акцент на фоне карточки нечитаем; в остальное время
// его нет, и срабатывает запасное значение — то, что стояло раньше.
//
// Локальные --v-acc и --t-acc идут и в текст, и в рамки, поэтому их скрипт
// не меняет — только печатает места, где они попадают в color.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ПИСАТЬ = process.argv.includes('--write');
const файлы = [
  ...fs.readdirSync(path.join(КОРЕНЬ, 'css')).filter(f => f.endsWith('.css')).map(f => path.join('css', f)),
  ...fs.readdirSync(path.join(КОРЕНЬ, 'css', 'themes')).filter(f => f.endsWith('.css')).map(f => path.join('css', 'themes', f)),
];

// var(--hud-accent) | var(--hud-accent, #fff) | var(--hud-accent, var(--x)) — до одной вложенности.
const ЗНАЧЕНИЕ = String.raw`var\(\s*--hud-accent\s*(?:,(?:[^()]|\([^()]*\))*)?\)`;
const ПРАВИЛО = new RegExp(String.raw`(?<![-\w])((?:-webkit-text-fill-)?color\s*:\s*)(` + ЗНАЧЕНИЕ + String.raw`)(?=\s*(?:!important\s*)?[;}])`, 'g');
const ЛОКАЛЬНЫЕ = /(?<![-\w])(?:-webkit-text-fill-)?color\s*:\s*[^;{}]*var\(\s*--(?:v|t)-acc\b[^;{}]*/g;
const ОСТАЛЬНОЕ = /(?<![-\w])(?:-webkit-text-fill-)?color\s*:(?!\s*var\(\s*--hud-accent)\s*[^;{}]*var\(\s*--hud-accent\b[^;{}]*/g;

let заменено = 0, пропущено = 0;
const локальные = [], пропуски = [];
for (const ф of файлы) {
  const полный = path.join(КОРЕНЬ, ф);
  const было = fs.readFileSync(полный, 'utf8');
  const номер = (i) => было.slice(0, i).split('\n').length;
  let n = 0;
  const стало = было.replace(ПРАВИЛО, (м, свойство, значение, i) => { n++; return свойство + 'var(--hud-accent-text, ' + значение + ')'; });
  for (const м of было.matchAll(ЛОКАЛЬНЫЕ)) локальные.push(`${ф}:${номер(м.index)}  ${м[0].trim().slice(0, 90)}`);
  for (const м of было.matchAll(ОСТАЛЬНОЕ)) { пропущено++; пропуски.push(`${ф}:${номер(м.index)}  ${м[0].trim().slice(0, 90)}`); }
  if (n) { заменено += n; console.log(`${ф}: ${n}`); if (ПИСАТЬ) fs.writeFileSync(полный, стало); }
}
console.log(`\nЗаменено: ${заменено}${ПИСАТЬ ? '' : ' (пробный прогон, --write — записать)'}`);
console.log(`Пропущено (акцент внутри смеси или градиента — цвет текста не чистый акцент): ${пропущено}`);
пропуски.forEach(с => console.log('  ' + с));
console.log(`\nЛокальные --v-acc/--t-acc в color — решать вручную: ${локальные.length}`);
локальные.forEach(с => console.log('  ' + с));
