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
  const out = src.replace(/(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(\?v=[^'"]*)?(['"])/g,
    (_m, a, spec, _q, z) => `${a}${spec}?v=${v}${z}`);
  if (out !== src) pending.push({ file: f, text: out });
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

console.log(`версия ${v}: обновлено файлов — ${touched} (включая manifest.json)`);
