// Литералы → токены css/tokens.css, только при ТОЧНОМ совпадении значения.
//
//   node tests/tools/codemod-tokens.mjs css/life.css css/combat.css    пробный прогон
//   node tests/tools/codemod-tokens.mjs --write css/life.css           записать
//
// Меняем одно-значные gap / row-gap / column-gap, border-radius и font-size.
// «gap: 6px 8px», «border-radius: 8px 8px 0 0», calc() и em не трогаем:
// там токен — уже решение о вёрстке, а не перевод один к одному.
// Токены равны литералам (tokens.css), поэтому снимки не меняются.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const аргументы = process.argv.slice(2);
const ПИСАТЬ = аргументы.includes('--write');
const файлы = аргументы.filter(а => !а.startsWith('--'));
if (!файлы.length) { console.error('Укажите файлы: css/life.css …'); process.exit(1); }

// Таблица — из самого tokens.css: значение токена при плотности 1.
const токены = fs.readFileSync(path.join(КОРЕНЬ, 'css', 'tokens.css'), 'utf8');
// --hud-fs-min — пол для нового кода, а не замена литералу: его пропускаем.
const таблица = (префикс) => Object.fromEntries([...токены.matchAll(new RegExp(String.raw`(--${префикс}-[\w-]+)\s*:\s*(?:calc\(\s*)?([\d.]+px)`, 'g'))].filter(м => м[1] !== '--hud-fs-min').map(м => [м[2], м[1]]));
const РАССТОЯНИЯ = таблица('hud-sp'), СКРУГЛЕНИЯ = таблица('hud-r'), ШРИФТ = таблица('hud-fs');

const ПРАВИЛА = [
  [/(?<![-\w])((?:row-|column-)?gap\s*:\s*)([\d.]+px)(?=\s*(?:!important\s*)?[;}])/g, РАССТОЯНИЯ],
  [/(?<![-\w])(border-radius\s*:\s*)([\d.]+px)(?=\s*(?:!important\s*)?[;}])/g, СКРУГЛЕНИЯ],
  [/(?<![-\w])(font-size\s*:\s*)([\d.]+px)(?=\s*(?:!important\s*)?[;}])/g, ШРИФТ],
];

let итого = 0;
for (const ф of файлы) {
  const полный = path.resolve(КОРЕНЬ, ф);
  let текст = fs.readFileSync(полный, 'utf8');
  const счёт = {};
  for (const [re, словарь] of ПРАВИЛА) {
    текст = текст.replace(re, (м, свойство, значение) => {
      const т = словарь[значение];
      if (!т) return м;
      счёт[т] = (счёт[т] || 0) + 1;
      return свойство + `var(${т})`;
    });
  }
  const n = Object.values(счёт).reduce((а, б) => а + б, 0);
  итого += n;
  console.log(`${ф}: ${n}  ${Object.entries(счёт).map(([т, к]) => `${т}×${к}`).join(' ')}`);
  if (ПИСАТЬ && n) fs.writeFileSync(полный, текст);
}
console.log(`\nВсего: ${итого}${ПИСАТЬ ? '' : ' (пробный прогон, --write — записать)'}`);
