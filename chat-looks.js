// hud-manager/chat-looks.js
//
// Своё оформление у каждого чата (настройка lookPerChat). Эпоха, тема,
// палитра, шрифты, виды блоков, украшения — всё, что меняет вид, HUD
// запоминает отдельно для каждой истории и возвращает при переходе в неё.
// Остальное — промпты, лимиты, блоки, модели — общее для всех чатов.
//
// Как устроено:
// — снимок вида — значения ключей из КЛЮЧИ_ВИДА_ЧАТА;
// — settings.chatLooks[id чата] = { name, at, vars } — свой вид чата;
//   settings.lookCommon — общий вид: для чатов, у которых своего нет;
// — saveSettings (index.js) зовёт запомнитьВидЧата: вид поменялся — снимок
//   уходит в открытый чат, без чата — в общий. Неизменный вид ничего не
//   создаёт: чат получает свой вид, только когда в нём что-то поменяли;
// — при смене чата видЧатаПриСмене кладёт его вид (или общий) в settings.
//
// Картинка фона в снимок не входит: она тяжёлая (до 3 МБ) и общая.

import { settings, defaultSettings, КЛЮЧИ_АВТО, КЛЮЧИ_МЕСТ } from './settings.js?v=23.89.34';
import { КЛЮЧИ_ВИДА } from './themes.js?v=23.89.34';
import { ВИДЫ_БЛОКОВ } from './render/views.js?v=23.89.34';
import { КЛЮЧИ_ПАНЕЛИ } from './events.js?v=23.89.34';
import { escapeHtml } from './utils.js?v=23.89.34';
import { база, присутствиеМагии, магияВМире, видМагииВМире, технологии } from './era.js?v=23.89.34';

// Эпоха — тоже вид истории: в средневековом чате нет телефона.
const ЭПОХА = ['era', 'fantasyMagic', 'magicPresence', 'techLevel', 'modernComms', 'eraModern', 'eraMagic'];
const ЕЩЁ = ['themePreset', 'themePalette', 'iconSet', 'glassType', 'themeScene', 'noImages', 'headerOrnament', 'avatarDeco', 'avatarShape', 'sceneHidden'];
// Не вид или не для снимка: картинки тяжёлые, остальное — поведение окна.
const НЕ_В_СНИМОК = new Set(['bgImage', 'customDetailMode', 'customClickNav', 'tokenBudget', 'containerQueries', 'startingStyle', 'themeSwitchFade', 'secretsAutoRaise']);

let ключи = null;
/** Ключи, которые чат помнит сам. Список собирается один раз. */
export function КЛЮЧИ_ВИДА_ЧАТА() {
  if (!ключи) ключи = [...new Set([...ЭПОХА, ...ЕЩЁ, ...КЛЮЧИ_ВИДА, ...КЛЮЧИ_АВТО, ...Object.values(КЛЮЧИ_МЕСТ), ...ВИДЫ_БЛОКОВ.map(б => б.ключ), ...КЛЮЧИ_ПАНЕЛИ])]
    .filter(k => k && !НЕ_В_СНИМОК.has(k));
  return ключи;
}

const копия = (v) => (v && typeof v === 'object' ? structuredClone(v) : v);
/** Снимок текущего вида: только заданные значения. */
export function снимокВидаЧата() {
  const о = {};
  for (const k of КЛЮЧИ_ВИДА_ЧАТА()) if (settings[k] !== undefined) о[k] = копия(settings[k]);
  return о;
}

let связь = { applyThemeColors() {}, перерисовать() {}, showHudToast() {} };
export function подключитьВидЧатов(с) { связь = { ...связь, ...с }; }

const контекст = () => { try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; } };
/** Id открытого чата или '' (стартовый экран). */
export function idЧата() {
  const ctx = контекст();
  try { return String((typeof ctx?.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx?.chatId) || ''); } catch (_) { return ''; }
}
/** Подпись чата для списка «взять из чата»: персонаж или группа. */
function имяЧата() {
  const ctx = контекст();
  if (!ctx) return '';
  if (ctx.groupId) { const г = (ctx.groups || []).find(x => String(x.id) === String(ctx.groupId)); return (г && г.name) || 'Группа'; }
  return String(ctx.name2 || (ctx.characters && ctx.characters[ctx.characterId] && ctx.characters[ctx.characterId].name) || '');
}

const включено = () => settings.lookPerChat !== false;
const виды = () => (settings.chatLooks && typeof settings.chatLooks === 'object' ? settings.chatLooks : (settings.chatLooks = {}));
let последний = '';   // снимок вида, который уже записан (или только что положен)
let начато = false;

/** Первый запуск: нынешний вид — общий, от него и считаем изменения. */
function начать() {
  if (начато) return;
  начато = true;
  if (!settings.lookCommon || typeof settings.lookCommon !== 'object') settings.lookCommon = снимокВидаЧата();
  последний = JSON.stringify(снимокВидаЧата());
}

/** Из saveSettings: вид поменялся — запомнить его за открытым чатом (или общим). */
export function запомнитьВидЧата() {
  if (!включено()) return;
  начать();
  const снимок = снимокВидаЧата();
  const json = JSON.stringify(снимок);
  if (json === последний) return;
  последний = json;
  const id = idЧата();
  if (!id) { settings.lookCommon = снимок; return; }
  const новый = !виды()[id];
  виды()[id] = { name: имяЧата(), at: Date.now(), vars: снимок };
  if (новый) связь.showHudToast('info', 'Оформление этого чата', 'HUD запомнил вид для этой истории. Другие чаты остались как были. Сделать вид общим — в настройках, «Оформление по чатам».');
}

/** Положить вид в настройки: чего в нём нет — из общего, потом заводское. */
function положить(vars) {
  const общий = settings.lookCommon || {};
  for (const k of КЛЮЧИ_ВИДА_ЧАТА()) {
    if (vars && k in vars) settings[k] = копия(vars[k]);
    else if (k in общий) settings[k] = копия(общий[k]);
    else if (defaultSettings[k] !== undefined) settings[k] = копия(defaultSettings[k]);
  }
}

/** Применить вид без записи его куда-либо: тема, стили, карточки, поля настроек. */
function применить(vars, { тихо = false } = {}) {
  const до = JSON.stringify(снимокВидаЧата());
  положить(vars);
  const после = JSON.stringify(снимокВидаЧата());
  последний = после;
  if (до === после) return false;
  связь.saveSettings?.();
  try { связь.applyThemeColors(); } catch (e) { console.warn('[TavernOS HUD] вид чата', e); }
  синхронизироватьПоля();
  связь.перерисовать();
  if (!тихо) обновитьПанель();
  return true;
}

/** CHAT_CHANGED: вид этого чата, а если своего нет — общий. */
export function видЧатаПриСмене() {
  if (!включено()) { обновитьПанель(); return; }
  начать();
  const id = idЧата();
  const свой = id && виды()[id];
  if (свой && имяЧата() && свой.name !== имяЧата()) свой.name = имяЧата();
  применить(свой ? свой.vars : settings.lookCommon, { тихо: true });
  обновитьПанель();
}

// Поля, которые уже на странице (панель, открытая Кастомизация), — к новым значениям.
function синхронизироватьПоля() {
  if (typeof document === 'undefined') return;
  const свои = new Set(КЛЮЧИ_ВИДА_ЧАТА());
  document.querySelectorAll('[data-key]').forEach(inp => {
    const k = inp.dataset.key;
    if (!свои.has(k) || !('value' in inp) || settings[k] === undefined || typeof settings[k] === 'object') return;
    if (inp.type === 'checkbox') inp.checked = !!settings[k];
    else if (inp.type === 'color' && !settings[k]) return;
    else inp.value = String(settings[k]);
  });
  // Эпоха — три настройки (era.js): база, магия в мире и её вид, технологии.
  const поле = (id, v) => { const э = document.getElementById(id); if (э && v) э.value = v; };
  поле('hud-era', база()); поле('hud-magic-presence', присутствиеМагии()); поле('hud-tech-level', технологии());
  if (магияВМире()) поле('hud-fantasy-magic', видМагииВМире());
  document.querySelectorAll('.hud-era-magic, .hud-era-powers').forEach(б => { б.hidden = !магияВМире(); });
  document.querySelectorAll('.hud-era-block').forEach(б => { б.hidden = б.dataset.era !== (/medieval/.test(String(settings.era || '')) ? 'medieval' : 'modern'); });
}

// --- Действия из панели ------------------------------------------------------

/** Нынешний вид — общий для всех чатов без своего. */
export function сделатьОбщим() {
  начать();
  settings.lookCommon = снимокВидаЧата();
  связь.saveSettings?.();
  связь.showHudToast('success', 'Общее оформление', 'Этот вид получат все чаты, у которых нет своего.');
  обновитьПанель();
}
/** Забыть свой вид открытого чата и вернуть общий. */
export function вернутьОбщий() {
  const id = idЧата();
  if (id) delete виды()[id];
  применить(settings.lookCommon, { тихо: true });
  связь.saveSettings?.();
  связь.showHudToast('success', 'Общее оформление', 'У этого чата больше нет своего вида.');
  обновитьПанель();
}
/** Взять вид другого чата (или общий) — он станет видом открытого. */
export function взятьВид(откуда) {
  const id = idЧата();
  const источник = откуда === 'common' ? settings.lookCommon : виды()[откуда]?.vars;
  if (!источник) return;
  применить(источник, { тихо: true });
  if (id) виды()[id] = { name: имяЧата(), at: Date.now(), vars: снимокВидаЧата() };
  else settings.lookCommon = снимокВидаЧата();
  последний = JSON.stringify(снимокВидаЧата());
  связь.saveSettings?.();
  связь.showHudToast('success', 'Оформление перенесено', откуда === 'common' ? 'Чат получил общий вид.' : `Вид из чата «${виды()[откуда]?.name || ''}».`);
  обновитьПанель();
}
/** Убрать сохранённый вид чата из списка. */
export function забытьВид(id) {
  if (!id || !виды()[id]) return;
  const открытый = id === idЧата();
  delete виды()[id];
  if (открытый) применить(settings.lookCommon, { тихо: true });
  связь.saveSettings?.();
  обновитьПанель();
}

// --- Панель ------------------------------------------------------------------

const дата = (t) => { try { return new Date(t).toLocaleDateString(); } catch (_) { return ''; } };
// Подпись в списке: название чата, как в списке чатов Таверны; имя
// персонажа — впереди, если его нет в названии; в конце — когда сохранён.
const сжать = (s) => String(s || '').toLowerCase().replace(/[\s_\-]+/g, '');
function подпись(id, в) {
  const название = id.length > 44 ? id.slice(0, 43) + '…' : id;
  const имя = в.name && !сжать(id).includes(сжать(в.name)) ? в.name + ' · ' : '';
  return имя + название + (в.at ? ' · ' + дата(в.at) : '');
}
/** Разметка блока «Оформление по чатам» (settings-ui.js). */
export function разметкаВидаЧатов() {
  const id = idЧата();
  const список = Object.entries(виды()).filter(([к]) => к !== id).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const статус = !включено() ? 'Выключено: оформление одно на все чаты.'
    : !id ? 'Чат не открыт — правки идут в общее оформление.'
      : виды()[id] ? 'У этого чата своё оформление.' : 'Этот чат на общем оформлении. Поменяете вид — он запомнится за чатом.';
  const опции = `<option value="common">Общее оформление</option>` + список.map(([к, в]) => `<option value="${escapeHtml(к)}">${escapeHtml(подпись(к, в))}</option>`).join('');
  return `<div class="hud-chatlook-status">${escapeHtml(статус)}</div>`
    + (включено() ? `<div class="hud-chatlook-row"><select class="hud-theme-select-input hud-chatlook-from" aria-label="Чей вид взять">${опции}</select>`
      + `<button type="button" class="hud-set-tool-btn" data-chatlook="take"${id ? '' : ' disabled'}>Взять в этот чат</button>`
      + `<button type="button" class="hud-set-tool-btn" data-chatlook="forget" title="Убрать вид выбранного чата из списка">✕</button></div>`
      + `<div class="hud-chatlook-row"><button type="button" class="hud-set-tool-btn" data-chatlook="common">Сделать общим</button>`
      + `<button type="button" class="hud-set-tool-btn" data-chatlook="reset"${id && виды()[id] ? '' : ' disabled'}>Вернуть общее</button></div>` : '');
}
export function обновитьПанель() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.hud-chatlook-box').forEach(б => { б.innerHTML = разметкаВидаЧатов(); });
}
/** Кнопки блока — один обработчик на документ. */
export function обработатьНажатие(e) {
  const кн = e.target.closest?.('[data-chatlook]');
  if (!кн) return false;
  e.preventDefault();
  const выбор = кн.closest('.hud-chatlook-box')?.querySelector('.hud-chatlook-from')?.value || '';
  const д = кн.dataset.chatlook;
  if (д === 'take') взятьВид(выбор);
  else if (д === 'forget') { if (выбор && выбор !== 'common') забытьВид(выбор); }
  else if (д === 'common') сделатьОбщим();
  else if (д === 'reset') вернутьОбщий();
  return true;
}
