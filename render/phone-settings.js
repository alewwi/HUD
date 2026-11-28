// hud-manager/render/phone-settings.js
//
// Всё, что про сам аппарат, а не про его данные:
// — приложение «Настройки» внутри телефона: те же ключи, что в основных
//   настройках и в Кастомизации. Поля темы носят классы .hud-theme-*-input —
//   их разбирает общий обработчик (events.js): наследование темы, запись,
//   применение и синхронизация с открытой Кастомизацией уже там;
// — физические кнопки: цифры кнопочного, «назад» на Android, виджет;
// — свой фон у отдельного чата.
//
// Разметку «Настроек» собираем при открытии приложения: так значения всегда
// свежие, а каждая карточка с телефоном не тащит сотню полей.

import { settings, унаследованноеТелефоном } from '../settings.js?v=23.90.14';
import { escapeHtml, hudHashSeed } from '../utils.js?v=23.90.14';
import { ВИДЫ_БЛОКОВ } from './views.js?v=23.90.14';

let сохранить = () => {}, применить = () => {}, перерисовать = () => {};
export function подключитьТелефонные(связь) {
  сохранить = связь.saveSettings || сохранить;
  применить = связь.applyThemeColors || применить;
  перерисовать = связь.перерисоватьКарточкиЧата || перерисовать;
}

// --- Варианты -----------------------------------------------------------------
export const ВИДЫ_АППАРАТА = [['iphone', 'Айфон'], ['android', 'Андроид'], ['keypad', 'Кнопочный']];
export const ТРЕЩИНЫ = [['off', 'Целый'], ['light', 'Трещина'], ['heavy', 'Разбит']];
export const СТИЛИ_УВЕДОМЛЕНИЙ = [['stack', 'Стопка'], ['pill', 'Пилюля'], ['ring', 'Таймер-кольцо'], ['bubble', 'Пузырь']];
export const ЧАСЫ_БЛОКИРОВКИ = [['classic', 'Обычные'], ['stacked', 'В два ряда'], ['thin', 'Тонкие'], ['mono', 'Табло'], ['analog', 'Со стрелками']];
export const ПРИЛОЖЕНИЯ_ТЕЛЕФОНА = [['phoneAppCalls', 'Звонки'], ['phoneAppWeather', 'Погода'], ['phoneAppHealth', 'Здоровье'], ['phoneAppMessages', 'Сообщения'], ['phoneAppContacts', 'Контакты'],
  ['phoneAppWallet', 'Кошелёк'], ['phoneAppCalendar', 'Календарь'], ['phoneAppGallery', 'Галерея'], ['phoneAppNotes', 'Заметки'], ['phoneAppMaps', 'Карты'],
  ['phoneAppSearch', 'Поиск'], ['phoneAppMusic', 'Музыка'], ['phoneAppRumors', 'Слухи']];

// Значение на корне страницы — вид выбирается стилями, без перерисовки карточек.
export function применитьВидТелефона(root) {
  if (!root || !root.dataset) return;
  const из = (список, ключ) => (список.some(([к]) => к === settings[ключ]) ? settings[ключ] : список[0][0]);
  root.dataset.hudPhone = из(ВИДЫ_АППАРАТА, 'phoneDevice');
  root.dataset.hudPhoneCracks = из(ТРЕЩИНЫ, 'phoneCracks');
  root.dataset.hudPhoneNotif = из(СТИЛИ_УВЕДОМЛЕНИЙ, 'phoneNotifStyle');
  root.dataset.hudPhoneClock = из(ЧАСЫ_БЛОКИРОВКИ, 'phoneLockClock');
  // Аватарки в чатах на узком экране (css/compact.css): общий выключатель и где.
  if (root.classList) {
    const есть = settings.phoneChatAvatars !== false;
    for (const [ключ, класс] of АВАТАРКИ_ЧАТОВ) root.classList.toggle(класс, есть && settings[ключ] !== false);
  }
}
// Ключ настройки → класс на корне страницы.
export const АВАТАРКИ_ЧАТОВ = [['phoneChatAvatarsGroup', 'hud-msgava-group'], ['phoneChatAvatarsPrivate', 'hud-msgava-private'], ['phoneChatAvatarsIntercepts', 'hud-msgava-intercept']];
export const ГАЛКИ_АВАТАРОК = [['phoneChatAvatarsGroup', 'В групповых', 'Лица у входящих в групповых переписках: по ним видно, кто из участников пишет'],
  ['phoneChatAvatarsPrivate', 'В личных чатах', 'Лицо собеседника у входящих в личной переписке'],
  ['phoneChatAvatarsIntercepts', 'В перехватах', 'Лица у сообщений в перехваченных чужих переписках']];

// --- Приложение «Настройки» ---------------------------------------------------
const значения = () => (settings.phoneThemeAuto !== false ? { ...settings, ...унаследованноеТелефоном() } : settings);
const строка = (подпись, поле) => `<div class="hud-pset-row"><label>${подпись}</label><div class="hud-pset-field">${поле}</div></div>`;
const выбор = (ключ, варианты, текущее) => `<select class="hud-theme-select-input" data-key="${ключ}">${варианты.map(([к, п]) => `<option value="${к}"${String(текущее) === к ? ' selected' : ''}>${escapeHtml(п)}</option>`).join('')}</select>`;
const цвет = (ключ, с) => `<input type="color" class="hud-theme-color-input" data-key="${ключ}" value="${escapeHtml(String(с[ключ] || '#000000'))}">`;
const ползунок = (ключ, от, до, с, единица = 'px') => `<input type="range" class="hud-theme-range-input" data-key="${ключ}" min="${от}" max="${до}" value="${escapeHtml(String(с[ключ] ?? от))}"><span>${escapeHtml(String(с[ключ] ?? от))}${единица}</span>`;
const раздел = (заголовок, тело) => `<section class="hud-pset-group"><h4>${заголовок}</h4>${тело}</section>`;

export function разметкаНастроек() {
  const с = значения();
  const виды = ((ВИДЫ_БЛОКОВ.find(в => в.ключ === 'phoneIconsView') || {}).виды) || { auto: 'Авто по теме' };
  const аппарат = строка('Вид телефона', выбор('phoneDevice', ВИДЫ_АППАРАТА, settings.phoneDevice || 'iphone'))
    + строка('Состояние экрана', выбор('phoneCracks', ТРЕЩИНЫ, settings.phoneCracks || 'off'))
    + строка('Цвет корпуса', цвет('phoneFrameColor', с));
  const блокировка = строка('Часы', выбор('phoneLockClock', ЧАСЫ_БЛОКИРОВКИ, settings.phoneLockClock || 'classic'))
    + строка('Уведомления', выбор('phoneNotifStyle', СТИЛИ_УВЕДОМЛЕНИЙ, settings.phoneNotifStyle || 'stack'))
    + строка('Карточек уведомлений', ползунок('phoneNotifMax', 1, 5, с, ''))
    + строка('Плотность уведомлений', ползунок('phoneNotifAlpha', 40, 100, с, '%'));
  const тема = `<label class="hud-pset-row is-check"><input type="checkbox" class="hud-phone-theme-auto"${settings.phoneThemeAuto !== false ? ' checked' : ''}><span>Наследовать тему HUD</span></label>`
    + строка('Фон: начало', цвет('phoneBgStart', с))
    + строка('Фон: конец', цвет('phoneBgEnd', с))
    + строка('Прозрачность фона', ползунок('phoneBgAlpha', 0, 100, с, '%'))
    + строка('Акцент', цвет('phoneAccent', с))
    + строка('Блюр стекла', ползунок('phoneBlur', 0, 30, с))
    + строка('Свечение экрана', ползунок('phoneScreenGlow', 0, 100, с, '%'))
    + строка('Свечение телефона', выбор('phoneGlow', [['on', 'Включено'], ['off', 'Выключено']], settings.phoneGlow === 'off' ? 'off' : 'on'))
    + строка('Шрифт', `<select class="hud-theme-select-input" data-key="phoneFont" data-pset-fonts="1"><option value="${escapeHtml(String(с.phoneFont || 'inherit'))}">…</option></select>`)
    + строка('Размер шрифта', ползунок('phoneFontSize', 10, 20, с))
    + строка('Скругление иконок', ползунок('phoneIconRadius', 6, 26, с));
  const пузыри = строка('Входящие', цвет('msgInBg', с) + ползунок('msgInAlpha', 0, 100, с, '%'))
    + строка('Исходящие: начало', цвет('msgOutStart', с))
    + строка('Исходящие: конец', цвет('msgOutEnd', с) + ползунок('msgOutAlpha', 0, 100, с, '%'))
    + строка('Скругление пузырей', ползунок('phoneBubbleRadius', 2, 24, с))
    + `<label class="hud-pset-row is-check"><input type="checkbox" data-pset-ava="phoneChatAvatars"${settings.phoneChatAvatars !== false ? ' checked' : ''}><span>Аватарки в чатах на узких экранах</span></label>`
    + ГАЛКИ_АВАТАРОК.map(([к, п]) => `<label class="hud-pset-row is-check hud-pset-sub" data-pset-ava-where${settings.phoneChatAvatars !== false ? '' : ' hidden'}><input type="checkbox" data-pset-ava="${к}"${settings[к] !== false ? ' checked' : ''}><span>${п}</span></label>`).join('');
  const значки = строка('Иконки приложений', `<select data-pset-redraw="phoneIconsView">${Object.entries(виды).map(([к, п]) => `<option value="${к}"${(settings.phoneIconsView || 'auto') === к ? ' selected' : ''}>${escapeHtml(п)}</option>`).join('')}</select>`);
  const галка = (ключ, подпись) => `<label class="hud-pset-row is-check"><input type="checkbox" data-pset-app="${ключ}"${settings[ключ] !== false ? ' checked' : ''}><span>${подпись}</span></label>`;
  const приложения = ПРИЛОЖЕНИЯ_ТЕЛЕФОНА.map(([к, п]) => галка(к, п)).join('');
  const общее = галка('enablePhone', 'Просить модель вести телефон');
  return `<div class="hud-pset">${раздел('Аппарат', аппарат)}${раздел('Блокировка и уведомления', блокировка)}${раздел('Тема', тема)}${раздел('Сообщения', пузыри)}${раздел('Значки', значки)}${раздел('Приложения', приложения)}${раздел('Телефон', общее)}</div>`;
}

export function наполнитьНастройки(вид) {
  const место = вид && вид.querySelector('[data-pset-host]');
  if (!место) return;
  место.innerHTML = разметкаНастроек();
  // Обои — сразу под «Аппаратом»: они у этого телефона, у его владельца.
  const корпус = вид.closest('.hud-phone-emulator');
  const ключ = корпус && корпус.dataset.wallK;
  if (ключ) {
    const владелец = ((вид.querySelector('.hud-phone-app-owner')) || {}).textContent || '';
    const аппарат = место.querySelector('.hud-pset-group');
    if (аппарат) аппарат.insertAdjacentHTML('afterend', разделОбоев(ключ, владелец.trim()));
  }
  // Список шрифтов живёт в Кастомизации, а её модуль грузится по требованию.
  import('../customize.js?v=23.90.14').then(м => {
    const поле = место.querySelector('[data-pset-fonts]');
    if (поле) { const с = значения(); поле.innerHTML = м.makeFontOptions(с.phoneFont); }
  }).catch(() => {});
}

// Плитка или экран приложения меняются только перерисовкой. Пока человек в
// «Настройках», карточку не трогаем: иначе экран дёргался бы на каждой галочке.
let нужнаПерерисовка = false;

function записать(ключ, значение) {
  settings[ключ] = значение;
  сохранить();
  нужнаПерерисовка = true;
  // Галочка в панели расширения построена заранее — держим её в том же виде.
  if (typeof document === 'undefined') return;
  document.querySelectorAll(`[data-phone-app-key="${ключ}"]`).forEach(x => { x.checked = !!значение; });
  if (ключ === 'enablePhone') { const x = document.getElementById('hud-enable-phone'); if (x) x.checked = !!значение; }
}

export function изменениеНастроек(e) {
  const цель = e.target;
  if (!цель || !цель.dataset) return false;
  if (цель.dataset.psetApp) { записать(цель.dataset.psetApp, цель.checked); return true; }
  if (цель.dataset.psetRedraw) { записать(цель.dataset.psetRedraw, цель.value); return true; }
  // Аватарки в чатах — классы на корне: применяем сразу, перерисовка не нужна.
  if (цель.dataset.psetAva) {
    settings[цель.dataset.psetAva] = цель.checked;
    сохранить(); применить(); отразитьАватарки();
    return true;
  }
  return false;
}

// Галочки аватарок живут в двух местах — в панели расширения и в «Настройках»
// телефона (а телефонов на странице может быть несколько). После любой правки
// все копии встают по settings: иначе открытый телефон показывал старое и
// следующим нажатием записывал его обратно.
export function отразитьАватарки() {
  if (typeof document === 'undefined') return;
  const есть = settings.phoneChatAvatars !== false;
  document.querySelectorAll('#hud-phone-chat-avatars, [data-pset-ava="phoneChatAvatars"]').forEach(x => { x.checked = есть; });
  document.querySelectorAll('[data-pset-ava-where], .hud-phone-ava-where').forEach(x => { x.hidden = !есть; });
  for (const [ключ] of ГАЛКИ_АВАТАРОК) document.querySelectorAll(`[data-phone-ava-key="${ключ}"], [data-pset-ava="${ключ}"]`).forEach(x => { x.checked = settings[ключ] !== false; });
}

// --- Кнопки аппарата ----------------------------------------------------------
const открытыйВид = (эмулятор) => эмулятор.querySelector('.hud-phone-app-view.active');
function назад(эмулятор) {
  const вид = открытыйВид(эмулятор);
  if (!вид) return;
  const кнопка = вид.querySelector('.hud-phone-subbody.active .hud-phone-back') || вид.querySelector('.hud-phone-app-title .hud-phone-back');
  if (кнопка) кнопка.click();
}
const домой = (эмулятор) => { const к = эмулятор.querySelector('.hud-phone-home-btn'); if (к) к.click(); };
function отпереть(эмулятор) { эмулятор.classList.add('unlocked'); }

function нажатьКлавишу(эмулятор, клавиша) {
  if (!эмулятор.classList.contains('unlocked')) { if (клавиша === 'ok') отпереть(эмулятор); return; }
  if (клавиша === 'back') return назад(эмулятор);
  if (клавиша === 'home' || клавиша === '#') return домой(эмулятор);
  if (клавиша === '*') { эмулятор.classList.remove('unlocked'); return; }
  if (!/^\d$/.test(клавиша) || открытыйВид(эмулятор)) return;
  const плитки = эмулятор.querySelectorAll('.hud-phone-app');
  const плитка = плитки[клавиша === '0' ? 9 : +клавиша - 1];
  if (плитка) плитка.click();
}

// --- Свой фон у чата ----------------------------------------------------------
export const ФОНЫ_ЧАТА = [
  ['night', 'linear-gradient(165deg, #141a33, #05070f)'],
  ['rose', 'linear-gradient(165deg, #3d1428, #120610)'],
  ['sea', 'linear-gradient(165deg, #0d3442, #04121a)'],
  ['forest', 'linear-gradient(165deg, #173322, #060f09)'],
  ['ember', 'linear-gradient(165deg, #43200f, #120804)'],
  ['violet', 'linear-gradient(165deg, #2c1a4d, #0b0616)'],
  ['dots', 'radial-gradient(rgba(255,255,255,.13) 1px, transparent 1.6px) 0 0 / 14px 14px, #10121a'],
  ['lines', 'repeating-linear-gradient(135deg, rgba(255,255,255,.055) 0 2px, transparent 2px 13px), #12141c'],
];
const ПОЛЕ_ФОНОВ = 'hud_phone_chat_bg';
const контекст = () => { try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; } };
const метаЧата = (ctx = контекст()) => (ctx && (ctx.chatMetadata || ctx.chat_metadata)) || null;
export const ключФонаЧата = (имя) => hudHashSeed(String(имя || '').trim().toLowerCase()).toString(36);

// Метаданные чата приходят и из чужих файлов (импорт): в стиль попадают только
// наши же снимки — data:-картинки, которые делает сжатьСнимок, — и ключи из
// букв и цифр (ключФонаЧата). Иначе чужой чат подсунул бы адрес-«маячок» или
// кусок CSS в селектор.
const СНИМОК = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
const снимокИли = (img) => { const s = String(img || ''); return s.length < 4e6 && СНИМОК.test(s) ? s : ''; };
const КЛЮЧ = /^[a-z0-9]{1,16}$/;
export const правилоФона = (ключ, запись) => {
  if (!КЛЮЧ.test(String(ключ))) return '';
  const пресет = запись && запись.p ? (ФОНЫ_ЧАТА.find(([к]) => к === запись.p) || [])[1] : '';
  const img = запись && снимокИли(запись.img);
  const фон = пресет || (img ? `linear-gradient(rgba(0,0,0,.42), rgba(0,0,0,.42)), url("${img}") center / cover` : '');
  // !important: часть тем делает ленту прозрачной тем же способом.
  return фон ? `.hud-phone-chat-area.hud-phone-chat-area[data-bgk="${ключ}"]{background:${фон} !important;}` : '';
};

// --- Обои экрана блокировки и домашнего экрана --------------------------------
// У каждого владельца телефона свои, в метаданных чата — как фоны чатов.
// Корпус несёт ключ владельца (data-wall-k, render/phone.js). Те же
// градиенты, что у фонов чата, и несколько своих; или своё фото.
export const ОБОИ = [
  ...ФОНЫ_ЧАТА,
  ['aurora', 'radial-gradient(120% 70% at 18% 8%, rgba(64, 200, 170, .42), transparent 60%), radial-gradient(100% 60% at 88% 34%, rgba(120, 90, 230, .42), transparent 62%), linear-gradient(170deg, #0b1424, #05060c)'],
  ['dusk', 'linear-gradient(180deg, #1c1030 0%, #3d1d3f 50%, #6e2f42 84%, #7d3c40 100%)'],
  ['nebula', 'radial-gradient(60% 45% at 72% 28%, rgba(222, 133, 159, .34), transparent 70%), radial-gradient(55% 42% at 24% 72%, rgba(90, 120, 255, .3), transparent 70%), #06070d'],
  ['mono', 'linear-gradient(160deg, #23262d, #0b0c0f)'],
];
const ПОЛЕ_ОБОЕВ = 'hud_phone_wall';
export const ГДЕ_ОБОИ = [['lock', 'Экран блокировки'], ['home', 'Главный экран']];
// Фото притемняем: часы и подписи белые, на светлом снимке их не было бы видно.
const фонОбоев = (запись, тень) => {
  const пресет = запись && запись.p ? (ОБОИ.find(([к]) => к === запись.p) || [])[1] : '';
  if (пресет) return пресет;
  const img = запись && снимокИли(запись.img);
  return img ? `linear-gradient(rgba(0,0,0,${тень}), rgba(0,0,0,${тень})), url("${img}") center / cover` : '';
};
export const правилоОбоев = (ключ, обои) => {
  if (!обои || typeof обои !== 'object' || !КЛЮЧ.test(String(ключ))) return '';
  const корпус = `.hud-phone-emulator[data-wall-k="${ключ}"]`;
  const блок = фонОбоев(обои.lock, .3), дом = фонОбоев(обои.home, .4);
  // Удвоенный класс и !important: светлые темы и эпохи красят эти экраны так же.
  // Обои главного экрана — под всем разблокированным экраном, как у настоящего
  // телефона: и под строкой состояния, и под полосой «домой»; сам домашний
  // экран прозрачный. Приложения непрозрачны и закрывают их как прежде.
  return (блок ? `${корпус} .hud-phone-lockscreen.hud-phone-lockscreen{background:${блок} !important;}` : '')
    + (дом ? `${корпус} .hud-phone-unlocked.hud-phone-unlocked{background:${дом} !important;}${корпус} .hud-phone-home-screen.hud-phone-home-screen{background:transparent !important;}` : '');
};

let прошлыеФоны = null, прошлыеОбои = null, прошлаяВерсия = -1, версияФонов = 0;
export function обновитьФоныЧатов(force = false) {
  if (typeof document === 'undefined' || !document.head || typeof document.head.appendChild !== 'function') return;
  const мета = метаЧата() || {};
  const фоны = мета[ПОЛЕ_ФОНОВ] || null, обои = мета[ПОЛЕ_ОБОЕВ] || null;
  if (!force && фоны === прошлыеФоны && обои === прошлыеОбои && прошлаяВерсия === версияФонов) return;
  прошлыеФоны = фоны; прошлыеОбои = обои; прошлаяВерсия = версияФонов;
  let стиль = document.getElementById('hud-chat-bg');
  if (!стиль) { стиль = document.createElement('style'); стиль.id = 'hud-chat-bg'; document.head.appendChild(стиль); }
  стиль.textContent = Object.entries(фоны || {}).map(([к, з]) => правилоФона(к, з)).join('')
    + Object.entries(обои || {}).map(([к, з]) => правилоОбоев(к, з)).join('');
}
function сохранитьМету(ctx) {
  версияФонов++;
  обновитьФоныЧатов(true);
  try { (ctx.saveMetadataDebounced || ctx.saveMetadata || (() => {})).call(ctx); } catch (_) { /* запишется со следующим сохранением чата */ }
}
function записатьФон(ключ, запись) {
  const ctx = контекст(), мета = метаЧата(ctx);
  if (!мета) return;
  const фоны = мета[ПОЛЕ_ФОНОВ] || (мета[ПОЛЕ_ФОНОВ] = {});
  if (запись) фоны[ключ] = запись; else delete фоны[ключ];
  сохранитьМету(ctx);
}
function записатьОбои(ключ, где, запись) {
  const ctx = контекст(), мета = метаЧата(ctx);
  if (!мета || !ГДЕ_ОБОИ.some(([г]) => г === где) || !КЛЮЧ.test(String(ключ))) return;
  // Пишем только то, что потом нарисуем: известный вариант или наш снимок.
  if (запись && !(запись.p && ОБОИ.some(([к]) => к === запись.p)) && !снимокИли(запись.img)) return;
  if (!мета[ПОЛЕ_ОБОЕВ] || typeof мета[ПОЛЕ_ОБОЕВ] !== 'object') мета[ПОЛЕ_ОБОЕВ] = {};
  const все = мета[ПОЛЕ_ОБОЕВ];
  if (!все[ключ] || typeof все[ключ] !== 'object') все[ключ] = {};
  const свои = все[ключ];
  if (запись) свои[где] = запись; else delete свои[где];
  if (!Object.keys(свои).length) delete все[ключ];
  сохранитьМету(ctx);
}
const обоиВладельца = (ключ) => { const з = (((метаЧата() || {})[ПОЛЕ_ОБОЕВ] || {})[ключ]); return з && typeof з === 'object' ? з : {}; };

// Раздел «Обои» в «Настройках» телефона: свой у каждого владельца.
function разделОбоев(ключ, владелец) {
  const свои = обоиВладельца(ключ);
  const ряд = ([где, подпись]) => {
    const з = свои[где] || null;
    const плитки = ОБОИ.map(([к, css]) => `<button type="button" class="hud-wall-swatch${з && з.p === к ? ' is-on' : ''}" data-wall-preset="${к}" style="background:${css}" aria-label="Обои" aria-pressed="${!!(з && з.p === к)}"></button>`).join('');
    const фото = з && з.img ? `<span class="hud-wall-photo-mark">своё фото</span>` : '';
    return `<div class="hud-wall-row" data-wall-where="${где}"><div class="hud-wall-head"><span>${подпись}</span>${фото}</div>`
      + `<div class="hud-wall-grid">${плитки}</div>`
      + `<div class="hud-chatbg-row"><button type="button" data-wall-photo="1">Своё фото</button><button type="button" data-wall-reset="1"${з ? '' : ' disabled'}>Как было</button></div></div>`;
  };
  // Имя владельца — мимо переводчика интерфейса (i18n.js): имя, совпавшее со
  // словом словаря, иначе «перевелось» бы.
  return раздел(`Обои${владелец ? ` · <span data-i18n-skip>${escapeHtml(владелец)}</span>` : ''}`, ГДЕ_ОБОИ.map(ряд).join('')).replace('<section class="hud-pset-group"', `<section class="hud-pset-group hud-pset-walls" data-wall-k="${escapeHtml(ключ)}"`);
}
function перерисоватьОбои(раздел) {
  const вид = раздел && раздел.closest('.hud-phone-app-view');
  const владелец = ((вид && вид.querySelector('.hud-phone-app-owner')) || {}).textContent || '';
  раздел.outerHTML = разделОбоев(раздел.dataset.wallK, владелец.trim());
}
function кликПоОбоям(e) {
  const раздел = e.target.closest('.hud-pset-walls[data-wall-k]');
  if (!раздел) return false;
  const ряд = e.target.closest('[data-wall-where]');
  if (!ряд) return false;
  const ключ = раздел.dataset.wallK, где = ряд.dataset.wallWhere;
  const пресет = e.target.closest('[data-wall-preset]');
  if (пресет) { e.preventDefault(); записатьОбои(ключ, где, { p: пресет.dataset.wallPreset }); перерисоватьОбои(раздел); return true; }
  if (e.target.closest('[data-wall-reset]')) { e.preventDefault(); записатьОбои(ключ, где, null); перерисоватьОбои(раздел); return true; }
  if (e.target.closest('[data-wall-photo]')) {
    e.preventDefault();
    const поле = document.createElement('input');
    поле.type = 'file'; поле.accept = 'image/*';
    поле.onchange = () => {
      const ф = поле.files && поле.files[0];
      if (ф) сжатьСнимок(ф, 960).then(img => { записатьОбои(ключ, где, { img }); if (раздел.isConnected) перерисоватьОбои(раздел); }).catch(() => {});
    };
    поле.click();
    return true;
  }
  return false;
}

// Снимок в метаданных чата: только уменьшенный, иначе файл чата распухнет.
function сжатьСнимок(файл, край = 720) {
  return new Promise((готово, сбой) => {
    const чтение = new FileReader();
    чтение.onerror = () => сбой(new Error('файл'));
    чтение.onload = () => {
      const img = new Image();
      img.onerror = () => сбой(new Error('картинка'));
      img.onload = () => {
        const доля = Math.min(1, край / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * доля); c.height = Math.round(img.height * доля);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const webp = c.toDataURL('image/webp', 0.78);
        готово(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.78));
      };
      img.src = чтение.result;
    };
    чтение.readAsDataURL(файл);
  });
}
const закрытьЛист = (корень) => { const л = корень && корень.querySelector('.hud-chatbg-sheet'); if (л) л.remove(); };
function открытьЛист(кнопка) {
  const тело = кнопка.closest('.hud-phone-subbody');
  if (!тело) return;
  if (тело.querySelector('.hud-chatbg-sheet')) return закрытьЛист(тело);
  const лист = document.createElement('div');
  лист.className = 'hud-chatbg-sheet';
  лист.dataset.bgk = кнопка.dataset.chatBg;
  лист.innerHTML = `<b>Фон этого чата</b><div class="hud-chatbg-grid">${ФОНЫ_ЧАТА.map(([к, css]) => `<button type="button" class="hud-chatbg-swatch" data-bg-preset="${к}" style="background:${css}" aria-label="Фон"></button>`).join('')}</div>`
    + `<div class="hud-chatbg-row"><button type="button" data-bg-photo="1">Своё фото</button><button type="button" data-bg-reset="1">Сбросить</button><button type="button" data-bg-close="1">Закрыть</button></div>`;
  тело.appendChild(лист);
}
function кликПоЛисту(e) {
  const лист = e.target.closest('.hud-chatbg-sheet');
  if (!лист) return false;
  e.preventDefault();
  const тело = лист.closest('.hud-phone-subbody');
  const ключ = лист.dataset.bgk;
  const пресет = e.target.closest('[data-bg-preset]');
  if (пресет) { записатьФон(ключ, { p: пресет.dataset.bgPreset }); закрытьЛист(тело); return true; }
  if (e.target.closest('[data-bg-reset]')) { записатьФон(ключ, null); закрытьЛист(тело); return true; }
  if (e.target.closest('[data-bg-close]')) { закрытьЛист(тело); return true; }
  if (e.target.closest('[data-bg-photo]')) {
    const поле = document.createElement('input');
    поле.type = 'file'; поле.accept = 'image/*';
    поле.onchange = () => { const ф = поле.files && поле.files[0]; if (ф) сжатьСнимок(ф).then(img => { записатьФон(ключ, { img }); закрытьЛист(тело); }).catch(() => {}); };
    поле.click();
  }
  return true;
}

/** Нажатия по кнопкам аппарата, виджету и листу фона. true — нажатие было здесь. */
export function кликТелефона(e) {
  if (!e.target || !e.target.closest) return false;
  if (кликПоЛисту(e)) return true;
  if (кликПоОбоям(e)) return true;
  // Вышли из «Настроек» — самое время показать то, что там поменяли.
  if (нужнаПерерисовка && e.target.closest('.hud-phone-back, .hud-phone-home-btn, .hud-phone-nav-btn, .hud-phone-keys [data-key]')) {
    const вид = e.target.closest('.hud-phone-shell')?.querySelector('.hud-phone-app-view.active');
    if (вид && вид.dataset.phoneView === 'settings') {
      setTimeout(() => { if (нужнаПерерисовка && !document.querySelector('.hud-phone-app-view.active[data-phone-view="settings"]')) { нужнаПерерисовка = false; перерисовать(); } }, 0);
    }
  }
  const клавиша = e.target.closest('.hud-phone-keys [data-key]');
  if (клавиша) {
    e.preventDefault();
    const эмулятор = клавиша.closest('.hud-phone-shell').querySelector('.hud-phone-emulator');
    if (эмулятор) нажатьКлавишу(эмулятор, клавиша.dataset.key);
    return true;
  }
  const навигация = e.target.closest('.hud-phone-nav-btn');
  if (навигация) {
    e.preventDefault();
    const эмулятор = навигация.closest('.hud-phone-emulator');
    if (эмулятор) (навигация.dataset.nav === 'back' ? назад : домой)(эмулятор);
    return true;
  }
  const фон = e.target.closest('.hud-phone-options[data-chat-bg]');
  if (фон) { e.preventDefault(); открытьЛист(фон); return true; }
  return false;
}
