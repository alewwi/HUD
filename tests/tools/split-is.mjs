// Раскрывает «:is(список)» в правой части селектора на отдельные селекторы.
//
// Зачем: браузер раскладывает правила по «корзинам» по правой части селектора
// (класс, тег, id). Правило с правой частью «:is(.a, .b, …)» в корзину не
// попадает и проверяется у КАЖДОГО элемента страницы при каждом пересчёте
// стилей. В длинном чате это десятки миллисекунд на клик (замер SelectorStats:
// 74 703 проверки на селектор за четыре переключения вкладок).
//
// Раскрываем только там, где смысл и каскад точно прежние:
//   • это :is (не :where — у того нулевая специфичность);
//   • все варианты — простые составные селекторы без комбинаторов и скобок;
//   • у всех вариантов одинаковая специфичность (у :is она — по самому
//     специфичному варианту, раскрытие её не меняет только при равенстве).
//
//   node tests/tools/split-is.mjs [--write] [файлы…]   (по умолчанию — css/*.css)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const аргументы = process.argv.slice(2);
const писать = аргументы.includes('--write');
const файлы = аргументы.filter(a => !a.startsWith('--'));
const список = файлы.length ? файлы : fs.readdirSync(path.join(КОРЕНЬ, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f);

// Делит по запятым верхнего уровня.
function поЗапятым(s) {
  const out = []; let глуб = 0, нач = 0, кав = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (кав) { if (c === '\\') i++; else if (c === кав) кав = ''; continue; }
    if (c === '"' || c === "'") кав = c;
    else if (c === '(' || c === '[') глуб++;
    else if (c === ')' || c === ']') глуб--;
    else if (c === ',' && глуб === 0) { out.push(s.slice(нач, i)); нач = i + 1; }
  }
  out.push(s.slice(нач));
  return out;
}
// Специфичность простого составного селектора без скобок: [id, класс, тег].
function специфичность(простой) {
  const s = простой.trim();
  if (/[()]/.test(s)) return null;
  const id = (s.match(/#[\w-]+/g) || []).length;
  const кл = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length + (s.match(/(?<!:):(?!:)[\w-]+/g) || []).length;
  const тег = (s.replace(/\[[^\]]*\]/g, '').match(/^[a-z][\w-]*/i) ? 1 : 0) + (s.match(/::[\w-]+/g) || []).length;
  return id + ',' + кл + ',' + тег;
}
// Индекс начала последнего составного (после последнего комбинатора верхнего уровня).
function началоПоследнего(sel) {
  let глуб = 0, кав = '', последний = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (кав) { if (c === '\\') i++; else if (c === кав) кав = ''; continue; }
    if (c === '"' || c === "'") кав = c;
    else if (c === '(' || c === '[') глуб++;
    else if (c === ')' || c === ']') глуб--;
    else if (глуб === 0 && /[\s>+~]/.test(c)) последний = i + 1;
  }
  return последний;
}
// Раскрыть один селектор (без запятых верхнего уровня). null — не трогаем.
function раскрыть(sel) {
  const s = sel.trim();
  const i = началоПоследнего(s);
  const префикс = s.slice(0, i), последний = s.slice(i);
  if (!последний.startsWith(':is(')) return null;
  // Закрывающая скобка :is(
  let глуб = 0, конец = -1;
  for (let k = 3; k < последний.length; k++) {
    if (последний[k] === '(') глуб++;
    else if (последний[k] === ')') { глуб--; if (глуб === 0) { конец = k; break; } }
  }
  if (конец < 0) return null;
  const внутри = последний.slice(4, конец), хвост = последний.slice(конец + 1);
  const варианты = поЗапятым(внутри).map(x => x.trim()).filter(Boolean);
  if (варианты.length < 2) return null;
  if (варианты.some(v => /[\s>+~()]/.test(v))) return null;
  const сп = new Set(варианты.map(специфичность));
  if (сп.size !== 1 || сп.has(null)) return null;
  // «:is(.a, .b)::before» — хвост приклеивается к каждому варианту.
  return варианты.map(v => префикс + v + хвост);
}

let всего = 0;
for (const ф of список) {
  const путь = path.join(КОРЕНЬ, ф);
  const css = fs.readFileSync(путь, 'utf8');
  const патчи = [];
  let раскрыто = 0, i = 0, нач = 0;
  const стек = [];
  // Проходим текст и берём прелюдии правил (текст перед «{»), кроме @-правил и кадров анимаций.
  while (i < css.length) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const к = css.indexOf('*/', i + 2);
      const пусто = !css.slice(нач, i).trim();
      i = к < 0 ? css.length : к + 2;
      // Комментарий перед правилом — не часть селектора.
      if (пусто) нач = i;
      continue;
    }
    if (c === '"' || c === "'") { const к = css.indexOf(c, i + 1); i = к < 0 ? css.length : к + 1; continue; }
    if (c === '{') {
      const прелюдия = css.slice(нач, i);
      const текст = прелюдия.trim();
      const вКадрах = стек.includes('keyframes');
      const at = текст.startsWith('@');
      стек.push(at ? (/@(-\w+-)?keyframes/.test(текст) ? 'keyframes' : 'at') : 'rule');
      if (!at && !вКадрах && текст.includes(':is(') && !прелюдия.includes('/*')) {
        const ведущие = прелюдия.match(/^\s*/)[0];
        const замыкающие = прелюдия.match(/\s*$/)[0] || ' ';
        let менял = false;
        const новые = поЗапятым(текст).flatMap(сел => { const р = раскрыть(сел); if (р) { менял = true; раскрыто++; return р; } return [сел.trim()]; });
        if (менял) патчи.push([нач, i, ведущие + новые.join(', ') + замыкающие]);
      }
      нач = i + 1; i++; continue;
    }
    if (c === '}') { стек.pop(); нач = i + 1; i++; continue; }
    if (c === ';') { нач = i + 1; i++; continue; }
    i++;
  }
  let новый = css;
  for (const [a, b, т] of патчи.sort((x, y) => y[0] - x[0])) новый = новый.slice(0, a) + т + новый.slice(b);
  if (раскрыто) console.log(ф.padEnd(30), 'раскрыто:', String(раскрыто).padStart(4), ' размер', css.length, '→', новый.length);
  всего += раскрыто;
  if (писать && раскрыто) fs.writeFileSync(путь, новый);
}
console.log('всего раскрыто:', всего, писать ? '(записано)' : '(пробный прогон; --write — записать)');
