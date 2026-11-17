// hud-manager/tests/settings-easy.mjs
//
// Настройки для новичка (settings-easy.js): быстрый старт ставит понятные
// наборы и узнаёт, какой стоит; первый запуск — обычный HUD; зависимые и
// тонкие пункты ссылаются на настоящие поля панели; цены блоков считаются и
// настройки после подсчёта те же; новые подписи переведены.
// node tests/settings-easy.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, append() {}, appendChild() {} });
globalThis.document = { createElement: узел, createElementNS: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), getElementById: () => null, addEventListener() {}, head: узел(), body: узел() };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const м = (ф) => import('file:///' + path.join(КОРЕНЬ, ф).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
const { settings, defaultSettings } = await м('settings.js');
const Л = await м('settings-easy.js');

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, подробно); } else console.log('✓', что); };
const сохранено = { n: 0 };
const основа = { saveSettings: () => сохранено.n++ };

// Заводские настройки — это «Полный».
проверить('заводские настройки — полный HUD', Л.уровеньСейчас() === 'full');
const доНабора = сохранено.n;
Л.применитьВыбор('level', 'light', основа);
проверить('набор — одним сохранением, а не на каждое поле', сохранено.n - доНабора === 1, String(сохранено.n - доНабора));
const доПовтора = сохранено.n;
Л.применитьВыбор('level', 'light', основа);
проверить('тот же набор ещё раз — ничего не сохраняет', сохранено.n === доПовтора);
проверить('лёгкий: без телефона, мира, быта и дневника, с памятью, телом и боем', settings.enablePhone === false && settings.enableWorld === false && settings.enableLife === false && settings.enableDiary === false
  && settings.enableMemory === true && settings.enableBodyState === true && settings.enableCombat === true && settings.factions === 'off');
проверить('лёгкий узнаётся', Л.уровеньСейчас() === 'light' && сохранено.n > 0);
Л.применитьВыбор('level', 'normal', основа);
проверить('обычный: телефон, мир, быт, дневник — да; гороскоп, экономика, сны, перехваты — нет', settings.enablePhone && settings.enableWorld && settings.enableLife && settings.enableDiary
  && !settings.enableHoroscope && !settings.enableEconomy && !settings.enableDreams && !settings.enableIntercepts && Л.уровеньСейчас() === 'normal');
settings.enableHoroscope = true;
проверить('блок, включённый руками, — «своё»', Л.уровеньСейчас() === 'custom');
Л.применитьВыбор('level', 'full', основа);
проверить('полный — заводские значения', Л.РАЗМЕР_HUD.every(([к]) => String(settings[к]) === String(defaultSettings[к])) && Л.уровеньСейчас() === 'full');
проверить('уровни отличаются: лёгкий < обычный < полный по числу включённого', (() => { const вкл = (у) => Л.наборУровня(у).filter(п => п[2] === true).length; return вкл('light') < вкл('normal') && вкл('normal') < вкл('full'); })());
проверить('вид на экране уровни не трогают', !Л.РАЗМЕР_HUD.some(([к]) => ['enableFamilyTree', 'enableSceneClock', 'enableTempo', 'enablePerception'].includes(к)));

// 18+.
Л.применитьВыбор('adult', 'no', основа);
проверить('18+ «нет»: правила близости не уходят, блоки близости выключены', settings.nsfwPrompt === 'never' && settings.enableIntimacyExtras === false && settings.enableTempo === false && Л.выборСейчас('adult') === 'no');
Л.применитьВыбор('adult', 'yes', основа);
проверить('18+ «да»: по сцене', settings.nsfwPrompt === 'auto' && settings.enableIntimacyExtras === true && Л.выборСейчас('adult') === 'yes');
settings.nsfwPrompt = 'always';
Л.применитьВыбор('adult', 'yes', основа);
проверить('18+ «да» не сбивает «Всегда»', settings.nsfwPrompt === 'always');

// Модель.
Л.применитьВыбор('model', 'small', основа);
проверить('слабая модель: сжатые значения, неполный HUD — только предупреждение', settings.hudCompact === true && settings.hudCompleteCheck === 'warn' && Л.выборСейчас('model') === 'small');
Л.применитьВыбор('model', 'big', основа);
проверить('сильная модель: подробно, неполный досоздаётся', settings.hudCompact === false && settings.hudCompleteCheck === 'regen' && Л.выборСейчас('model') === 'big');

// Как появляется HUD (без панели — прямо в настройки).
Л.применитьВыбор('appear', 'button', основа);
проверить('только по кнопке: ни в ответе, ни отдельно', settings.autoInject === false && settings.hudSeparate === false && Л.выборСейчас('appear') === 'button');
Л.применитьВыбор('appear', 'with', основа);
проверить('вместе с ответом', settings.autoInject === true && Л.выборСейчас('appear') === 'with');

// Первый запуск.
const новичок = {};
Л.первыйЗапуск(новичок);
проверить('первый запуск: обычный HUD и «Основные», с отметкой «не сверено»', новичок.settingsView === 'simple' && Л.уровеньСейчас(новичок) === 'normal' && новичок.hudFirstRun === true);
проверить('у прежних пользователей панель как была', defaultSettings.settingsView === 'all');

// Цены: подсчёт возвращает настройки как были.
const снимок = JSON.stringify(settings);
const цены = Л.посчитатьЦены((о) => Object.keys(settings).filter(к => settings[к] === true).join(' ') + (о.nsfw ? ' близость' : ''), (s) => s.length);
проверить('цены: у включаемых блоков есть цена, у уровней — растёт', цены.блоки.enablePhone > 0 && цены.уровни.light < цены.уровни.normal && цены.уровни.normal < цены.уровни.full);
проверить('цены: после подсчёта настройки те же', JSON.stringify(settings) === снимок);
{
  // По шагу за раз: между шагами (когда может сработать что угодно, хоть
  // сохранение) настройки — настоящие, не подменённые.
  let чистоМежду = true, шагов = 0;
  const итог = await Л.посчитатьЦеныПостепенно((о) => Object.keys(settings).filter(к => settings[к] === true).join(' '), (s) => s.length,
    async () => { шагов++; if (JSON.stringify(settings) !== снимок) чистоМежду = false; });
  проверить('цены по шагам: между шагами настройки не подменены', чистоМежду && шагов > 20 && итог.блоки.enablePhone > 0, String(шагов));
}

// Поля, на которые ссылается модуль, есть в панели.
const ui = fs.readFileSync(path.join(КОРЕНЬ, 'settings-ui.js'), 'utf8') + fs.readFileSync(path.join(КОРЕНЬ, 'settings-deep.js'), 'utf8');
const естьПоле = (id) => ui.includes(`'${id}'`) || ui.includes(`"${id}"`);
const нетПолей = [...new Set([...Л.РАЗМЕР_HUD.map(с => с[1]), ...Object.values(Л.НАБОРЫ).flatMap(н => Object.values(н).flat().map(п => п[1])), ...Л.ЗАВИСИМЫЕ.flat().filter(x => typeof x === 'string'), ...Л.ТОНКИЕ, 'hud-auto-inject', 'hud-separate', 'hud-cache-stable'])].filter(id => !естьПоле(id));
проверить('все поля быстрого старта, зависимых и тонких — в панели', !нетПолей.length, нетПолей.join(', '));
проверить('панель: поиск и быстрый старт сверху, лёгкость подключена', ui.indexOf('${разметкаВерха()}') < ui.indexOf("группа('🚀 Быстрый старт'") && ui.includes('${разметкаБыстрогоСтарта()}') && ui.includes('подключитьЛёгкость(wrapper, основа)'));
проверить('панель: мир — в быстром старте', (() => { const i = ui.indexOf("группа('🚀 Быстрый старт'"), j = ui.indexOf("группа('🧩 Что показывает HUD'"); const к = ui.slice(i, j); return ['hud-era', 'hud-tech-level', 'hud-magic-presence', 'hud-fantasy-magic'].every(id => к.includes(`id="${id}"`)); })());
const разметка = Л.разметкаБыстрогоСтарта() + Л.разметкаВерха();
проверить('быстрый старт: четыре ряда, у каждого варианта пояснение', (разметка.match(/data-qs-row=/g) || []).length === 4 && !/<button(?![^>]*title=)[^>]*>/.test(разметка));
проверить('гайд не берёт в название «?» и цену', fs.readFileSync(path.join(КОРЕНЬ, 'guide.js'), 'utf8').includes('.hud-set-q, .hud-set-cost'));

// Перевод: каждая русская строка модуля — в словаре.
const en = fs.readFileSync(path.join(КОРЕНЬ, 'i18n-en.js'), 'utf8');
// Тексты и подписи (title, aria-label, placeholder) разметки и строки, которые модуль ставит сам.
const html = Л.разметкаБыстрогоСтарта() + Л.разметкаВерха();
const куски = [...html.matchAll(/>([^<>]+)</g)].map(x => x[1]).concat([...html.matchAll(/(?:title|aria-label|placeholder)="([^"]+)"/g)].map(x => x[1]))
  .map(с => с.replace(/&laquo;|&raquo;/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()).filter(с => /[А-Яа-яЁё]/.test(с));
const строки = [...new Set(куски.concat(['Найдено', 'Ничего не нашлось', 'Сейчас — своё: блоки выбраны вручную, в «Что показывает HUD». Нажмите любой вариант, чтобы поставить его набор.',
  'Примерно столько токенов этот блок добавляет к инструкции HUD в каждом запросе. Ответ модели с этим блоком тоже длиннее.']))]
  .map(с => с.replace(/^[^А-Яа-яЁёA-Za-z0-9«]+s*/u, '').replace(/[.:]$/, ''));
const нетПеревода = строки.filter(с => !en.includes(JSON.stringify(с) + ':'));
проверить('перевод: все подписи модуля в словаре', !нетПеревода.length, нетПеревода.join(' | '));

// --- Кастомизация (customize-easy.js) ---
const кст = fs.readFileSync(path.join(КОРЕНЬ, 'customize.js'), 'utf8');
проверить('кастомизация: «?» и поиск подключаются при каждой сборке панели', (кст.match(/подключитьЛёгкостьОкна\(панель\)/g) || []).length === 2 && кст.includes('class="hud-custom-search"'));
// Ряды без пояснения — только виды блоков и баннер (их подписи говорят сами за себя и собираются из данных).
const голые = [...кст.matchAll(/<div class="hud-theme-row"><label>([^<]*)<\/label>/g)].map(м => м[1]).filter(п => !п.includes('${'));
проверить('кастомизация: у каждого ряда настройки есть пояснение', !голые.length, голые.join(' | '));
проверить('кастомизация: без «Старт/Конец», «Оверлей», «Инфоблок», «&» в названиях', !/Фон \(Старт\)|Оверлей|Инфоблок|Бейдж уведомл|<summary>[^<]*&/.test(кст));
const словарь = fs.readFileSync(path.join(КОРЕНЬ, 'i18n-en.js'), 'utf8');
const подписи = [...кст.matchAll(/<div class="hud-theme-row" title="([^"]+)"><label>([^<:]+):?<\/label>/g)].flatMap(м => [м[1].replace(/&quot;/g, '"').replace(/[.]$/, ''), м[2]]).filter(с => !с.includes('${'));
// Через сам переводчик: старые пояснения с «ёлочками» лежат в словаре кусками.
settings.language = 'en';
const { перевести } = await м('i18n.js');
const безПеревода = подписи.filter(с => перевести(с) === null);
settings.language = 'ru';
проверить('кастомизация: новые подписи и пояснения переведены', подписи.length > 80 && !безПеревода.length, безПеревода.slice(0, 5).join(' | '));
const лёгкостьОкна = fs.readFileSync(path.join(КОРЕНЬ, 'customize-easy.js'), 'utf8');
проверить('кастомизация: «?» рядом с подписью, а не в ней — переход из примера читает подпись', лёгкостьОкна.includes("метка.insertAdjacentHTML('afterend'"));
проверить('кастомизация: поиск раскрывает «Подробно» только на время поиска', лёгкостьОкна.includes('подробно.dataset.wasHidden') && лёгкостьОкна.includes("подробно.hidden = подробно.dataset.wasHidden === '1'"));

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exit(провалов ? 1 : 0);
