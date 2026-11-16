// hud-manager/tests/chat-looks.mjs
//
// Своё оформление у каждого чата (chat-looks.js): вид запоминается за чатом,
// в котором его поменяли, и возвращается при переходе; чат без своего вида
// получает общий; промпты и блоки не переносятся; вид можно взять из другого
// чата и вернуть общий. Свой вид лежит и в самом чате (chat_metadata): его
// не затрёт копия настроек с другого устройства; сохранение, пришедшее до
// смены вида, не пишет прежний вид в новый чат.
// node tests/chat-looks.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, append() {}, appendChild() {} });
globalThis.document = { createElement: узел, createElementNS: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), getElementById: () => null, addEventListener() {}, head: узел(), body: узел() };
let чат = 'Нора - 2026-11-01@10h00m', имя = 'Нора';
// Метаданные у каждого чата свои, как в Таверне.
const метаданные = {};
let записейЧата = 0, грузится = false;
// Пока Таверна грузит чат: id уже новый, сообщений нет, метаданные — пустая заготовка.
globalThis.SillyTavern = { getContext: () => ({ chat: грузится ? [] : [{ mes: '' }], getCurrentChatId: () => чат, name2: имя, chatMetadata: грузится ? {} : чат ? (метаданные[чат] ||= {}) : {}, saveMetadataDebounced: () => { записейЧата++; } }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const м = (ф) => import('file:///' + path.join(КОРЕНЬ, ф).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
const { settings } = await м('settings.js');
const В = await м('chat-looks.js');

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, подробно); } else console.log('✓', что); };

const тосты = [];
let перерисовок = 0, сохранений = 0;
const сохранить = () => { сохранений++; В.запомнитьВидЧата(); };
В.подключитьВидЧатов({ saveSettings: сохранить, applyThemeColors() {}, перерисовать: () => перерисовок++, showHudToast: (т, з) => тосты.push(з) });

const ключи = В.КЛЮЧИ_ВИДА_ЧАТА();
проверить('в вид входят эпоха, тема, палитра, шрифты, виды блоков', ['era', 'themePreset', 'themePalette', 'fontMain', 'iconSet', 'sectionSkin'].filter(k => k in settings || k === 'era').every(k => ключи.includes(k)) && ключи.some(k => /View$/.test(k)), ключи.filter(k => /^(era|theme|font|icon)/.test(k)).join());
проверить('картинка фона, промпты, блоки и лимиты в вид не входят', !['bgImage', 'nsfwPrompt', 'enableDiary', 'enablePhone', 'hudMaxTokens', 'tokenBudget', 'chatLooks', 'lookCommon', 'lookPerChat'].some(k => ключи.includes(k)));

// Чат А: вид не меняли — своего вида нет.
settings.era = 'modern'; settings.themePreset = 'cyberpunk'; settings.enableDiary = true;
В.видЧатаПриСмене();
сохранить();
проверить('без правок вида свой вид у чата не появляется', !settings.chatLooks[чат] && settings.lookCommon && settings.lookCommon.themePreset === 'cyberpunk');
settings.enableDiary = false; сохранить();
проверить('правка не вида (дневник) тоже не создаёт вид чата', !settings.chatLooks[чат]);

// Поменяли вид в А — он запомнился за А.
settings.era = 'medieval'; settings.themePreset = 'medieval'; сохранить();
const А = чат;
проверить('правка вида запоминается за открытым чатом', settings.chatLooks[А]?.vars.era === 'medieval' && settings.chatLooks[А].vars.themePreset === 'medieval' && settings.chatLooks[А].name === 'Нора');
проверить('при первом своём виде — подсказка', тосты.includes('Оформление этого чата'));
проверить('свой вид записан и в сам чат', метаданные[А]?.[В.КЛЮЧ_В_ЧАТЕ]?.vars?.themePreset === 'medieval' && записейЧата > 0);

// Чат Б без своего вида — общий.
чат = 'Ида - 2026-11-02@12h00m'; имя = 'Ида';
В.видЧатаПриСмене();
проверить('чат без своего вида получает общий', settings.era === 'modern' && settings.themePreset === 'cyberpunk');
проверить('общие настройки при смене чата не трогаются', settings.enableDiary === false);
проверить('смена вида перерисовывает карточки', перерисовок > 0);

// Свой вид в Б, назад в А.
settings.themePreset = 'kawaii'; сохранить();
const Б = чат;
чат = А; имя = 'Нора';
В.видЧатаПриСмене();
проверить('назад в первый чат — его вид вернулся', settings.era === 'medieval' && settings.themePreset === 'medieval');
чат = Б; имя = 'Ида';
В.видЧатаПриСмене();
проверить('во второй — его вид', settings.era === 'modern' && settings.themePreset === 'kawaii');

// Взять вид из А в Б.
В.взятьВид(А);
проверить('вид другого чата берётся в открытый', settings.era === 'medieval' && settings.themePreset === 'medieval' && settings.chatLooks[Б].vars.era === 'medieval');
проверить('исходный чат не меняется', settings.chatLooks[А].vars.themePreset === 'medieval');

// Вернуть общий в Б.
В.вернутьОбщий();
проверить('«Вернуть общее» — свой вид забыт, общий на месте', !settings.chatLooks[Б] && settings.era === 'modern' && settings.themePreset === 'cyberpunk');

// Сделать общим.
settings.themePreset = 'noir'; сохранить();
В.сделатьОбщим();
проверить('«Сделать общим» — вид становится общим', settings.lookCommon.themePreset === 'noir');

// Забыть вид из списка.
В.забытьВид(А);
проверить('вид чата можно убрать из списка', !settings.chatLooks[А]);

// Стартовый экран: правки — в общий вид.
чат = ''; В.видЧатаПриСмене(); settings.themePreset = 'ocean'; сохранить();
проверить('без открытого чата правки идут в общий вид', settings.lookCommon.themePreset === 'ocean' && !settings.chatLooks['']);

// Сохранение до смены вида: чат уже другой, вид в настройках — прежнего.
чат = 'Нора - 2026-11-01@10h00m'; имя = 'Нора'; В.видЧатаПриСмене();
settings.noImages = 'on'; settings.bgDragon = 'on'; сохранить();
const Н = чат;
проверить('у чата свой вид: без картинок и с драконом', settings.chatLooks[Н].vars.noImages === 'on' && settings.chatLooks[Н].vars.bgDragon === 'on');
чат = Б; имя = 'Ида'; грузится = true;
const записейДо = записейЧата;
settings.headerOrnament = 'off'; сохранить();   // чат грузится, CHAT_CHANGED ещё не дошёл
проверить('пока чат грузится, вид не пишется ни в чат, ни в список', записейЧата === записейДо && settings.noImages === 'on' && settings.chatLooks[Б]?.vars?.noImages !== 'on');
грузится = false;
settings.headerOrnament = 'theme'; сохранить();   // загрузился, CHAT_CHANGED ещё не дошёл
проверить('сохранение до смены вида не пишет прежний вид в новый чат', settings.chatLooks[Б]?.vars?.noImages !== 'on' && settings.noImages !== 'on' && settings.bgDragon !== 'on');
В.видЧатаПриСмене();
settings.noImages = 'off'; settings.bgDragon = 'off'; сохранить();
проверить('правка в другом чате не трогает вид первого', settings.chatLooks[Н].vars.noImages === 'on' && settings.chatLooks[Н].vars.bgDragon === 'on');

// Другое устройство затёрло настройки: списка видов нет, вид — в самом чате.
const затёрто = structuredClone(settings.chatLooks);
settings.chatLooks = {};
чат = Н; имя = 'Нора'; В.видЧатаПриСмене();
проверить('вид чата возвращается из самого чата, если список затёрт', settings.noImages === 'on' && settings.bgDragon === 'on' && settings.chatLooks[Н]?.vars?.bgDragon === 'on');
// В списке запись свежее, чем в чате (чат не успел сохраниться) — берётся она и пишется в чат.
settings.chatLooks[Н] = { name: 'Нора', at: Date.now() + 5000, vars: { ...затёрто[Н].vars, bgDragon: 'off' } };
чат = Б; имя = 'Ида'; В.видЧатаПриСмене();
чат = Н; имя = 'Нора'; В.видЧатаПриСмене();
проверить('из двух записей — более свежая, и чат догоняет', settings.bgDragon === 'off' && метаданные[Н][В.КЛЮЧ_В_ЧАТЕ].vars.bgDragon === 'off');
// Вид из прежних версий (только в списке) переезжает в чат при открытии.
const Т = 'Тая - 2026-11-04@08h00m';
settings.chatLooks[Т] = { name: 'Тая', at: 1, vars: { themePreset: 'rose' } };
чат = Т; имя = 'Тая'; В.видЧатаПриСмене();
проверить('вид из списка переезжает в чат', settings.themePreset === 'rose' && метаданные[Т]?.[В.КЛЮЧ_В_ЧАТЕ]?.vars?.themePreset === 'rose');
// Убрали из списка, находясь в другом чате: запись в том чате больше не действует.
чат = Б; имя = 'Ида'; В.видЧатаПриСмене();
В.забытьВид(Т);
чат = Т; имя = 'Тая'; В.видЧатаПриСмене();
проверить('убранный из списка вид не возвращается из чата', settings.themePreset !== 'rose' && !settings.chatLooks[Т] && !метаданные[Т][В.КЛЮЧ_В_ЧАТЕ]);

// Вкладки и «Минимализм» — тоже вид чата.
проверить('порядок, закреплённые и скрытые вкладки — в виде чата', ['tabOrder', 'tabPinned', 'tabHidden', 'minimalBackup'].every(k => ключи.includes(k)));
settings.tabHidden = ['phone']; settings.minimalBackup = { pillIcons: 'on' }; сохранить();
чат = Б; имя = 'Ида'; В.видЧатаПриСмене();
проверить('скрытые вкладки и запас «Минимализма» не переходят в другой чат', !(settings.tabHidden || []).includes('phone') && settings.minimalBackup === undefined);
чат = Т; имя = 'Тая'; В.видЧатаПриСмене();
проверить('и возвращаются в своём', (settings.tabHidden || []).includes('phone') && settings.minimalBackup?.pillIcons === 'on');

// Выключено — оформление одно.
settings.lookPerChat = false;
чат = 'Тео - 2026-11-03@09h00m';
const былоВидов = Object.keys(settings.chatLooks).length;
settings.themePreset = 'western'; сохранить(); В.видЧатаПриСмене();
проверить('выключено: вид не запоминается и не подменяется', Object.keys(settings.chatLooks).length === былоВидов && settings.themePreset === 'western');
settings.lookPerChat = true;

// Панель.
чат = Б;
const html = В.разметкаВидаЧатов();
проверить('панель: статус, выбор чата, кнопки', html.includes('hud-chatlook-status') && html.includes('value="common"') && html.includes('data-chatlook="take"') && html.includes('data-chatlook="common"') && html.includes('data-chatlook="reset"'));
settings.chatLooks['x'] = { name: '<img src=x onerror=1>', at: 1, vars: {} };
проверить('панель: имя чата экранировано', !В.разметкаВидаЧатов().includes('<img'));

// Связка в коде.
const инд = fs.readFileSync(path.join(КОРЕНЬ, 'index.js'), 'utf8');
const сохр = инд.slice(инд.indexOf('  function saveSettings() {'), инд.indexOf('отправитьНаСервер();', инд.indexOf('  function saveSettings() {')));
проверить('код: saveSettings запоминает вид чата до записи', сохр.includes('запомнитьВидЧата()') && сохр.indexOf('запомнитьВидЧата()') < сохр.indexOf("localStorage.setItem('hud_settings'"));
проверить('код: смена чата подменяет вид', /CHAT_CHANGED, \(\) => \{ try \{ видЧатаПриСмене\(\)/.test(инд));
const ui = fs.readFileSync(path.join(КОРЕНЬ, 'settings-ui.js'), 'utf8');
проверить('код: блок в «Отображении», с выключателем', ui.indexOf("подгруппа('🎨 Оформление по чатам'") > ui.indexOf("группа('✨ Отображение'") && ui.includes("getElementById('hud-look-per-chat')"));
const en = fs.readFileSync(path.join(КОРЕНЬ, 'i18n-en.js'), 'utf8');
проверить('английский: подписи блока переведены', ['Своё оформление у каждого чата', 'Взять в этот чат', 'Сделать общим', 'Вернуть общее', 'Оформление этого чата'].every(с => en.includes(JSON.stringify(с) + ':')));

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exit(провалов ? 1 : 0);
