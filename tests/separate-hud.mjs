// hud-manager/tests/separate-hud.mjs
//
// HUD отдельным запросом после ответа и профили подключения:
// — историю может вести одна модель (часто локальная), HUD — профиль
//   перегенерации, автоматически после каждого ответа;
// — «HUD в каждом ответе» и «HUD отдельным запросом» — одно из двух;
// — профиль Text Completion (локальная модель) получает сообщения в шаблоне
//   instruct, а не склеенным текстом без ролей.
// node tests/separate-hud.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const код = (ф) => fs.readFileSync(path.join(КОРЕНЬ, ф), 'utf8').replace(/\r\n/g, '\n');
let всего = 0, провалов = 0;
const проверить = (что, ок) => { всего++; if (!ок) { провалов++; console.log('✗', что); } else console.log('✓', что); };

const настройки = код('settings.js'), панель = код('settings-ui.js'), главный = код('index.js');
проверить('настройка hudSeparate по умолчанию выключена', /\n  hudSeparate: false,/.test(настройки));
проверить('галка в панели — рядом с профилем регена', панель.indexOf("галка('hud-separate'") > 0 && панель.indexOf("галка('hud-separate'") < панель.indexOf('id="hud-regen-profile"'));
проверить('включая «отдельно», выключаем «в каждом ответе», и наоборот',
  /settings\.hudSeparate && settings\.autoInject\) \{\s*settings\.autoInject = false/.test(панель) && /settings\.autoInject && settings\.hudSeparate\) \{ settings\.hudSeparate = false/.test(панель));
проверить('после ответа — HUD отдельным запросом, только когда «в каждом ответе» выключен',
  /if \(!settings\.hudSeparate \|\| settings\.autoInject\) return/.test(главный) && /отдельныйHUD\(messageId, type\)/.test(главный));
проверить('отдельный HUD: не для ответа с HUD, не дважды, не после «стоп»',
  /extractHudBlock\(String\(текст\)\)\) return 'есть HUD'/.test(главный) && /отдельноСделано\.has\(ключ\)/.test(главный) && /отдельноОстановлено = Date\.now\(\)/.test(главный));
проверить('отдельный HUD — тем же путём, что кнопка ➕ (профиль регена)', /return \(await перегенерироватьHUDСообщения\(id\)\)/.test(главный));
for (const ф of ['regen.js', 'render/music.js', 'render/assistant.js']) {
  проверить(`${ф}: профиль Text Completion — с шаблоном instruct`, /includeInstruct: true/.test(код(ф)) && !/includeInstruct: false/.test(код(ф)));
}

// Два обновления в одном посте: соседняя плашка сохраняет объект и обработчик.
const { подключить, показатьБлок } = await import('../regen.js');
const плашка = new EventTarget();
let нажатия = 0;
плашка.addEventListener('click', () => нажатия++);
const узлы = [плашка];
const текст = { querySelector: () => узлы[1], appendChild: узел => узлы.push(узел) };
const сообщение = { querySelector: () => текст };
globalThis.document = { querySelector: () => сообщение, createTextNode: textContent => ({ textContent }) };
const получено = [];
подключить({ safeProcessMessage: () => {
  получено.push(узлы[1].textContent);
  узлы[1] = { replaceWith: новый => { узлы[1] = новый; } };
} });
показатьБлок(0, '[HUD]первый[/HUD]');
показатьБлок(0, '[HUD]второй[/HUD]');
узлы[0].dispatchEvent(new Event('click'));
проверить('создание и замена HUD сохраняют чужую плашку и её обработчик', узлы.length === 2 && узлы[0] === плашка && нажатия === 1 && получено.join(' ') === '[HUD]первый[/HUD] [HUD]второй[/HUD]');

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
