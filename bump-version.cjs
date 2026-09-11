// Смена версии ассетов расширения.
//
// SillyTavern подставляет значения manifest.js/css в URL как есть, а
// относительные импорты ES-модулей браузер тянет по их собственным адресам.
// Без ?v= телефон продолжает исполнять старую копию модуля даже после
// перезагрузки страницы — правка есть в файле, но не в браузере.
// Запуск:  node bump-version.cjs 22.1.1
//
// ЗАПИСЬ АТОМАРНАЯ И ДВУХФАЗНАЯ — это не перестраховка, а следствие аварии.
// Прежняя версия писала через fs.writeFileSync прямо в исходник. Этот вызов
// сначала обрезает файл до нуля и только потом пишет: когда на диске кончилось
// место, обрезание удалось, запись упала, и events.js с hud-parser.js остались
// пустыми — исходники были уничтожены без предупреждения, а повторный запуск
// после ошибки добил второй файл.
// Теперь так не выйдет: сперва всё новое содержимое пишется во временные файлы
// рядом, и только когда записались ВСЕ до единого, они переименовываются поверх
// оригиналов. rename в пределах одного тома атомарен, места не требует и
// оборваться на полпути не может. Любая ошибка на первой фазе — временные
// файлы удаляются, оригиналы остаются нетронутыми.
const fs = require('fs'), path = require('path');
const v = process.argv[2];
if (!v) { console.error('usage: node bump-version.cjs <version>'); process.exit(1); }
// Версия уходит и в манифест, и в хвосты ?v= у полусотни импортов.
// Опечатка вроде «22.83» или «v22.83.0» разъедется по всему проекту и
// вылезет потом загадочным «модуль не тот». Проверяем сразу.
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(v)) {
  console.error('Версия должна быть вида X.Y.Z (можно с суффиксом через дефис), а не «' + v + '». Ничего не изменено.');
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js') && !e.name.endsWith('.cjs')) files.push(p);
  }
})(__dirname);

// Готовим новое содержимое, ничего не записывая.
const pending = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // from './x.js' | from './x.js?v=старая'  ->  from './x.js?v=новая'
  let out = src.replace(/(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(\?v=[^'"]*)?(['"])/g,
    (_m, a, spec, _q, z) => `${a}${spec}?v=${v}${z}`);
  // То же для динамических import('./x.js?v=...'): их этот скрипт раньше не
  // замечал, и модуль оставался с версией времён своего появления — браузер
  // мог отдать из кэша давнюю копию.
  //
  // Только для СВОИХ файлов. Путь, уходящий выше папки расширения, — это
  // модуль самого SillyTavern, и хвост ?v= создаёт его вторую копию: у неё
  // своё состояние и свой кэш книг, а значит запись уходит мимо настоящего.
  out = out.replace(/(import\(\s*['"])(\.{1,2}\/[^'"?]+\.js)(\?v=[^'"]*)?(['"]\s*\))/g,
    (m, a, spec, q, z) => {
      const выходитИзПапки = (spec.match(/\.\.\//g) || []).length >= 2;
      if (выходитИзПапки) return m;
      return `${a}${spec}?v=${v}${z}`;
    });
  if (out !== src) pending.push({ file: f, text: out });
}

// Стили разрезаны на части и подключаются из style.css через @import.
// Манифест ставит хвост ?v= только самому style.css, поэтому части нужно
// пометить здесь — иначе браузер оставит их в кэше и после обновления.
{
  const cssPath = path.join(__dirname, 'style.css');
  if (fs.existsSync(cssPath)) {
    const src = fs.readFileSync(cssPath, 'utf8');
    const out = src.replace(/(@import\s+url\(['\"])([^'\"?]+\.css)(\?v=[^'\"]*)?(['\"]\))/g,
      (_m, a, spec, _q, z) => `${a}${spec}?v=${v}${z}`);
    if (out !== src) pending.push({ file: cssPath, text: out });
  }
}

const mPath = path.join(__dirname, 'manifest.json');
const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
m.js = 'index.js?v=' + v;
m.css = 'style.css?v=' + v;
m.version = v;
pending.push({ file: mPath, text: JSON.stringify(m, null, 2) + '\n' });

// Проверяем место заранее: писать впритык нельзя даже атомарно.
const needed = pending.reduce((n, p) => n + Buffer.byteLength(p.text, 'utf8'), 0);
try {
  const st = fs.statfsSync(__dirname);
  const free = st.bavail * st.bsize;
  if (free < needed * 3) {
    console.error(`Мало места: свободно ${(free / 1048576).toFixed(1)} МБ, нужно с запасом ` +
                  `${(needed * 3 / 1048576).toFixed(1)} МБ. Ничего не изменено.`);
    process.exit(1);
  }
} catch (e) { /* statfs есть не везде — тогда полагаемся на двухфазность */ }

// Фаза 1: пишем всё во временные файлы. Оригиналы пока не тронуты.
const staged = [];
try {
  for (const p of pending) {
    const tmp = p.file + '.bump-tmp';
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, p.text, 'utf8');
      fs.fsyncSync(fd);           // без fsync ошибка может всплыть уже после close
    } finally { fs.closeSync(fd); }
    staged.push({ tmp, file: p.file });
  }
} catch (err) {
  for (const s of staged) { try { fs.unlinkSync(s.tmp); } catch (e) {} }
  console.error('Запись не удалась, оригиналы не изменены:', err.message);
  process.exit(1);
}

// Фаза 2: подменяем. rename места не требует и не может оставить пустой файл.
let touched = 0;
for (const s of staged) { fs.renameSync(s.tmp, s.file); touched++; }

// Сверяем то, что получилось на диске: манифест и хвосты ?v= должны
// совпадать до единого. Расхождение здесь — это браузер, который тянет
// половину модулей из старого кэша.
const проверка = JSON.parse(fs.readFileSync(mPath, 'utf8'));
const беды = [];
if (проверка.version !== v) беды.push('manifest.version = ' + проверка.version);
if (проверка.js !== 'index.js?v=' + v) беды.push('manifest.js = ' + проверка.js);
if (проверка.css !== 'style.css?v=' + v) беды.push('manifest.css = ' + проверка.css);
const чужие = new Set();
// Проверяем и модули, и оглавление стилей: разъехаться может и то, и то.
const проверяемые = files.concat([path.join(__dirname, 'style.css')].filter(p => fs.existsSync(p)));
for (const f of проверяемые) {
  const текст = fs.readFileSync(f, 'utf8');
  for (const m2 of текст.matchAll(/\?v=(\d+\.\d+\.\d+[0-9A-Za-z.-]*)/g)) {
    if (m2[1] !== v) чужие.add(path.basename(f) + ' → ' + m2[1]);
  }
}
if (чужие.size) беды.push('чужие версии в импортах: ' + [...чужие].join(', '));
if (беды.length) {
  console.error('Версии разъехались:\n  ' + беды.join('\n  '));
  process.exit(1);
}

console.log(`версия ${v}: обновлено файлов — ${touched} (включая manifest.json), версии сходятся`);
