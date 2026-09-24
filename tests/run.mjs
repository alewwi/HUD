// hud-manager/tests/run.mjs
//
// Все тесты разом: node tests/run.mjs
// Запускает каждый файл tests/*.mjs отдельным процессом (у каждого своё
// окружение-заглушка браузера) и собирает итог.

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ПАПКА = path.dirname(fileURLToPath(import.meta.url));
const файлы = fs.readdirSync(ПАПКА).filter(f => f.endsWith('.mjs') && f !== 'run.mjs').sort();
let упало = 0;
for (const f of файлы) {
  const р = spawnSync(process.execPath, [path.join(ПАПКА, f)], { encoding: 'utf8' });
  const вывод = (р.stdout || '') + (р.stderr || '');
  const итог = (вывод.match(/проверок: \d+, провалов: \d+/g) || []).pop() || 'нет итога';
  const ок = р.status === 0 && / провалов: 0$/.test(итог);
  if (!ок) упало++;
  console.log((ок ? '✓ ' : '✗ ') + f.padEnd(22) + итог);
  if (!ок) console.log(вывод.split('\n').filter(s => /✗|Error|at /.test(s)).slice(0, 12).map(s => '    ' + s).join('\n'));
}
console.log(упало ? `\nупало наборов: ${упало}` : '\nвсе наборы прошли');
process.exitCode = упало ? 1 : 0;
