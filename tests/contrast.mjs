// hud-manager/tests/contrast.mjs
//
// Контраст тем (contrast.js) и «Подробно» в кастомизации: node tests/contrast.mjs
//
// Для текста: акцент после автоподбора ≥ 4,5 к фону карточки, свой цвет
// текста темы ≥ 4,5. Для линий и значков (WCAG 1.4.11): сырой акцент ≥ 3.
// Темы, которые сегодня не проходят по линиям, записаны в
// tests/contrast-baseline.json как известный долг: тест падает, если пара
// стала хуже или появилась новая ниже 3:1, и подсказывает убрать тему из
// долга, если она стала лучше. Долг может только уменьшаться.
//   node tests/contrast.mjs --update   переписать долг по текущим темам

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} } });
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел() };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const модуль = (имя) => import('file:///' + path.join(КОРЕНЬ, имя).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

let всего = 0;
const провалы = [];
const проверить = (имя, ок, подробно = '') => { всего++; if (!ок) провалы.push(имя + (подробно ? ' — ' + подробно : '')); };

const K = await модуль('contrast.js');
const T = await модуль('themes.js');
const D = await модуль('customize-detail.js');

// --- Чистые функции ---------------------------------------------------------
проверить('контраст: чёрный/белый = 21', Math.abs(K.контраст('#000', '#fff') - 21) < 1e-9);
проверить('контраст: #777 на белом ≈ 4,48', Math.abs(K.контраст('#777777', '#ffffff') - 4.48) < 0.01, K.контраст('#777777', '#ffffff'));
проверить('разбор: #abc, #aabbcc80, rgba()', K.вHex(K.разобратьЦвет('#abc')) === '#aabbcc' && Math.abs(K.разобратьЦвет('#aabbcc80').a - 128 / 255) < 1e-9 && K.разобратьЦвет('rgba(10, 20, 30, .5)').a === 0.5);
проверить('разбор: мусор → null', K.разобратьЦвет('accent') === null && K.разобратьЦвет('') === null);
const хороший = K.подобратьТекст('#ffffff', '#101010');
проверить('подбор: читаемый цвет не меняется', !хороший.подправлен && хороший.цвет === '#ffffff');
const египет = K.подобратьТекст('#c9a227', '#e4dbc3');
проверить('подбор: золото на пергаменте темнеет до ≥ 4,5', египет.подправлен && египет.достигнут && египет.стало >= 4.5 && K.яркость(египет.цвет) < K.яркость('#c9a227'), JSON.stringify(египет));
// Тон сохраняется: у подправленного цвета каналы в том же порядке (жёлтый остаётся жёлтым).
const к = K.разобратьЦвет(египет.цвет);
проверить('подбор: тон тот же (r ≥ g > b)', к.r >= к.g && к.g > к.b, египет.цвет);
const тёмный = K.подобратьТекст('#3a2a8a', '#121212');
проверить('подбор: на тёмном фоне светлеет', тёмный.подправлен && K.яркость(тёмный.цвет) > K.яркость('#3a2a8a') && тёмный.стало >= 4.5);
const два = K.подобратьКФонам('#e0568f', ['#ffffff', '#f0d0e0']);
проверить('подбор к двум фонам: читаем на худшем', два.достигнут && K.худшийКонтраст(два.цвет, ['#ffffff', '#f0d0e0']) >= 4.5);
проверить('значок: ok/warn/bad/na и число с запятой', K.значокКонтраста(4.8).состояние === 'ok' && K.значокКонтраста(4.8).текст === 'AA 4,8 ✓'
  && K.значокКонтраста(3.5).состояние === 'warn' && K.значокКонтраста(2.1).состояние === 'bad' && K.значокКонтраста(2.1).текст === '2,1 ✗' && K.значокКонтраста(NaN).состояние === 'na');
проверить('значок: 4,49 не округляется до «4,5 ✓»', K.значокКонтраста(4.49).состояние === 'warn' && K.значокКонтраста(4.49).текст.startsWith('4,4'));

// --- Темы ------------------------------------------------------------------
const ДОЛГ_ПУТЬ = path.join(КОРЕНЬ, 'tests', 'contrast-baseline.json');
const долг = fs.existsSync(ДОЛГ_ПУТЬ) ? JSON.parse(fs.readFileSync(ДОЛГ_ПУТЬ, 'utf8')) : {};
const сейчасДолг = {};
const подсказки = [];
for (const id of T.HUD_THEME_IDS) {
  const v = T.themeVars(id);
  const фоны = K.фоныКарточки(v);
  if (!фоны.length || !v.accentColor) { подсказки.push(`${id}: фон или акцент не заданы — не определено`); continue; }
  const текст = K.текстНаКарточке(v.accentColor, v, K.ПОДЛОЖКА_ТЁМНАЯ);
  проверить(`тема ${id}: акцент как текст ≥ 4,5 после подбора`, текст.стало >= 4.5, `${v.accentColor} → ${текст.цвет} = ${текст.стало.toFixed(2)}`);
  if (v.textColor) {
    const кт = K.худшийКонтраст(v.textColor, фоны);
    проверить(`тема ${id}: свой цвет текста ≥ 4,5`, кт >= 4.5, кт.toFixed(2));
  }
  const линии = K.худшийКонтраст(v.accentColor, фоны);
  if (линии < K.НОРМА_ЛИНИЙ) сейчасДолг[id] = Number(линии.toFixed(2));
  const было = долг[id];
  if (было == null) проверить(`тема ${id}: акцент как линия ≥ 3 (новой пары ниже 3:1 нет в долге)`, линии >= K.НОРМА_ЛИНИЙ, линии.toFixed(2));
  else {
    проверить(`тема ${id}: долг по линиям не вырос (было ${было})`, линии >= было - 0.005, линии.toFixed(2));
    if (линии >= K.НОРМА_ЛИНИЙ) подсказки.push(`${id}: линии теперь ${линии.toFixed(2)} ≥ 3 — можно убрать из долга (--update)`);
  }
}
if (process.argv.includes('--update')) { fs.writeFileSync(ДОЛГ_ПУТЬ, JSON.stringify(сейчасДолг, null, 2) + '\n'); console.log('долг переписан:', сейчасДолг); }
подсказки.forEach(п => console.log('  · ' + п));

// --- CSS: подобранный акцент только как текст, всегда с запасным значением ---
const css = (ф) => fs.readFileSync(path.join(КОРЕНЬ, ф), 'utf8');
const всеCSS = [...fs.readdirSync(path.join(КОРЕНЬ, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f),
  ...fs.readdirSync(path.join(КОРЕНЬ, 'css', 'themes')).filter(f => f.endsWith('.css')).map(f => 'css/themes/' + f)];
const использования = всеCSS.flatMap(ф => [...css(ф).matchAll(/([-\w]+)\s*:\s*var\(--hud-accent-text\b([^;}]*)/g)].map(м => ({ ф, свойство: м[1], хвост: м[2] })));
проверить('--hud-accent-text только в color, -webkit-text-fill-color и accent-color (флажки)', использования.every(и => /^(?:-webkit-text-fill-|accent-)?color$/.test(и.свойство)), использования.filter(и => !/^(?:-webkit-text-fill-|accent-)?color$/.test(и.свойство)).map(и => и.ф + ' ' + и.свойство).join(', '));
проверить('--hud-accent-text всегда с запасным var(--hud-accent…)', использования.length > 40 && использования.every(и => /^\s*,\s*var\(--hud-accent\b/.test(и.хвост)), String(использования.length));
проверить('локальный акцент (цвет группы, телефон) сбрасывает подобранный', /--hud-accent:\s*var\(--kind-ink\);[\s\S]{0,200}--hud-accent-text:\s*initial/.test(css('css/misc.css')) && /hud-phone-home-screen \{[^}]*--hud-accent-text:\s*initial/.test(css('css/base.css')));

// --- «Подробно» --------------------------------------------------------------
const разметка = fs.readFileSync(path.join(КОРЕНЬ, 'customize.js'), 'utf8');
проверить('«Подробно»: каждый раздел из списка есть в разметке', D.ПОДРОБНО_РАЗДЕЛЫ.every(id => разметка.includes(`data-sec="${id}"`)), D.ПОДРОБНО_РАЗДЕЛЫ.filter(id => !разметка.includes(`data-sec="${id}"`)).join());
проверить('«Подробно»: склонение', D.подписьПодробно(1) === 'Подробно · 1 настройка' && D.подписьПодробно(3) === 'Подробно · 3 настройки' && D.подписьПодробно(11) === 'Подробно · 11 настроек' && D.подписьПодробно(72) === 'Подробно · 72 настройки' && D.подписьПодробно(65) === 'Подробно · 65 настроек');
проверить('«Подробно»: плоский режим не раскладывает', D.разложитьПодробно({ querySelector: () => null }, { режим: 'flat' }) === null);
const S = await модуль('settings.js');
проверить('настройки волны 3: умолчания', S.defaultSettings.autoAccentText === 'on' && S.defaultSettings.customDetailMode === 'split' && S.defaultSettings.containerQueries === 'off' && S.defaultSettings.iconSet === 'emoji' && S.defaultSettings.lightFollowsTime === 'off' && S.defaultSettings.silhouetteLook === 'neutral' && S.defaultSettings.bodyDiaryHand === 'off');

console.log(`\nпроверок: ${всего}, провалов: ${провалы.length}`);
if (провалы.length) { console.log(провалы.map(п => ' ✗ ' + п).join('\n')); process.exitCode = 1; }
