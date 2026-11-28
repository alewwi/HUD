// hud-manager/phone-float.js
//
// Плавающий телефон. Круглая кнопка у края окна (её можно перетащить) — по
// нажатию телефон последнего хода поднимается поверх чата, как будто его
// подносят к глазам: чат за ним гаснет и размывается.
//
// Аппарат тот же, что во вкладке «Телефон»: index.js собирает карточку хода
// тем же путём, что для панели сбоку, только с одними вкладками телефона
// (собратьКарточкуПанели(id, обёртка, { телефоны: true })). Обёртка
// .hud-side-mes несёт mesid — по нему переписка игрока, звонки, фото и
// перегенерация находят своё сообщение (closest('.mes, .hud-side-mes')).
//
// Чей телефон — решает настройка «Персонажа нет в сцене — телефон»: при
// «оба» в карточке два телефона, и в окне над аппаратом переключатель.
// Собирается только открытое окно; закрытое держит одну кнопку и значок
// непрочитанных.

import { settings } from './settings.js?v=23.90.15';
import { непрочитанные } from './render/msg-feed.js?v=23.90.15';
import { namesLikelySame } from './names.js?v=23.90.15';

// Из index.js (геттеры — значения живые): getStContextSafe, saveSettings,
// readCardUiState, applyCardUiState, собратьКарточкуПанели,
// оживитьКарточкуПанели, ключКарточкиПанели, последнийСHud, разборНомера.
let основа = null;
export function подключить(связь) { основа = связь; }

// Размер кнопки — по факту (на узком экране она меньше), до вставки — 50.
const размер = () => (кнопка && кнопка.offsetWidth) || 50;
const ПОРОГ = 6;            // сдвиг пальца, после которого это перетаскивание, а не нажатие
const ПОЛЯ = 6;             // кнопка не подходит к краю окна ближе
const УХОД = 320;           // столько длится опускание телефона, мс

let включена = false;
let кнопка = null, значок = null, окно = null, обёртка = null, владельцы = null, пусто = null;
let показан = null, ключ = '', таймер = 0, таймерЗначка = 0, таймерУхода = 0, нужнаСила = false;
// Какой телефон открыт, когда их два (номер вкладки телефона в карточке).
let выбран = 0;
// Вид телефона (экран, приложение, открытый чат) между открытиями окна.
let прошлыйВид = null;
const подписки = [];
const таймерыРазвода = [];

const открыто = () => !!(окно && окно.classList.contains('is-open'));

// --- Значки ---------------------------------------------------------------------
const ЗНАЧОК_ТЕЛЕФОНА = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.4 5h3.2"/><circle cx="12" cy="18.2" r=".9"/></svg>';
const ЗНАЧОК_ЗАКРЫТЬ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';

/** Включить: кнопка, подписки на события Таверны. Повторный вызов — сверить вид. */
export function включить() {
  // Повторно — после сохранения настроек: «Вернуть кнопку к краю», место с
  // другого устройства — кнопка встаёт по ним сразу, а не после смены окна.
  if (включена) { разложить(); показатьКнопку(); значокПозже(); return; }
  включена = true;
  кнопка = document.createElement('button');
  кнопка.type = 'button';
  кнопка.id = 'hud-pf-btn';
  кнопка.className = 'hud-pf-btn';
  кнопка.setAttribute('aria-label', 'Телефон');
  кнопка.title = 'Телефон. Перетащите, чтобы передвинуть';
  кнопка.innerHTML = ЗНАЧОК_ТЕЛЕФОНА + '<span class="hud-pf-badge" hidden></span>';
  значок = кнопка.querySelector('.hud-pf-badge');
  document.body.appendChild(кнопка);
  кнопка.addEventListener('pointerdown', тянуть);
  кнопка.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); переключить(); } });
  // Касания кнопки — её собственные: свайпы Таверны тут ни при чём.
  ['touchstart', 'touchmove', 'touchend'].forEach(тип => кнопка.addEventListener(тип, e => e.stopPropagation(), { passive: true }));
  window.addEventListener('resize', разложить, { passive: true });
  document.addEventListener('keydown', поEsc, true);
  document.addEventListener('click', отметитьПрочтение, true);

  const ctx = основа.getStContextSafe();
  const ист = ctx && ctx.eventSource, типы = ctx && (ctx.event_types || ctx.eventTypes);
  if (ист && типы) {
    const на = (имя, f) => { if (типы[имя]) { ист.on(типы[имя], f); подписки.push([типы[имя], f]); } };
    на('CHAT_CHANGED', () => { показан = null; ключ = ''; прошлыйВид = null; выбран = 0; прочитано.clear(); if (открыто()) закрыть(); заметить(null, true); });
    ['MESSAGE_RECEIVED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHARACTER_MESSAGE_RENDERED', 'GENERATION_ENDED']
      .forEach(имя => на(имя, () => заметить()));
  }
  разложить();
  показатьКнопку();
  значокПозже();
  // Кнопка «Телефона» другого расширения (Phone-ST, #gp-fab) появляется, когда
  // оно загрузится: разводим кнопки ещё раз чуть позже.
  for (const мс of [1500, 5000]) таймерыРазвода.push(setTimeout(разложить, мс));
}

/** Выключить: убрать всё, что поставили. */
export function выключить() {
  if (!включена) return;
  включена = false;
  [таймер, таймерЗначка, таймерУхода, ...таймерыРазвода].forEach(clearTimeout);
  таймерыРазвода.length = 0;
  const ctx = основа.getStContextSafe();
  const ист = ctx && ctx.eventSource;
  if (ист) подписки.forEach(([тип, f]) => { try { (ист.removeListener || ист.off).call(ист, тип, f); } catch (_) {} });
  подписки.length = 0;
  window.removeEventListener('resize', разложить);
  window.visualViewport?.removeEventListener('resize', подогнатьОкно);
  window.visualViewport?.removeEventListener('scroll', подогнатьОкно);
  document.removeEventListener('keydown', поEsc, true);
  document.removeEventListener('click', отметитьПрочтение, true);
  прочитано.clear();
  document.documentElement.classList.remove('hud-pf-open');
  [кнопка, окно].forEach(у => у && у.remove());
  кнопка = значок = окно = обёртка = владельцы = пусто = null;
  показан = null; ключ = ''; прошлыйВид = null;
}

// Кнопка видна, когда в чате есть ход с HUD: без него телефону нечего показать.
function показатьКнопку() {
  if (!кнопка) return;
  let есть = false;
  try { есть = основа.последнийСHud() != null; } catch (_) { есть = false; }
  кнопка.hidden = !есть;
}

// --- Место кнопки ------------------------------------------------------------------
// Запомненное место — доли окна (центр кнопки): после поворота экрана или
// смены размера окна кнопка остаётся там же относительно краёв.
// Настройки синхронизируются между устройствами, поэтому место у узкого
// экрана (телефон, ≤600px) и широкого своё: кнопку, отведённую на ПК влево
// вниз, телефон не получает. Старое место {x, y} годится для обоих.
const видЭкрана = () => (window.innerWidth <= 600 ? 'narrow' : 'wide');
function запомненноеМесто() {
  const п = settings.phoneFloatPos;
  if (!п || typeof п !== 'object') return null;
  return п[видЭкрана()] || (Number.isFinite(п.x) ? п : null);
}
function запомнитьМесто(x, y) {
  const было = settings.phoneFloatPos && typeof settings.phoneFloatPos === 'object' ? settings.phoneFloatPos : {};
  const п = { wide: было.wide || (Number.isFinite(было.x) ? { x: было.x, y: было.y } : undefined), narrow: было.narrow || (Number.isFinite(было.x) ? { x: было.x, y: было.y } : undefined) };
  п[видЭкрана()] = { x, y };
  settings.phoneFloatPos = Object.fromEntries(Object.entries(п).filter(([, з]) => з));
}
function место() {
  const ш = window.innerWidth, в = window.innerHeight;
  const п = запомненноеМесто();
  let x, y;
  if (п && Number.isFinite(п.x) && Number.isFinite(п.y)) { x = п.x * ш - размер() / 2; y = п.y * в - размер() / 2; }
  // У правого края, в верхней трети: ниже — кнопки Таверны и полоса музыки.
  else { x = ш - размер() - 14; y = Math.round(в * 0.36); }
  return прижать(x, y);
}
const прижать = (x, y) => ({
  x: Math.round(Math.max(ПОЛЯ, Math.min(x, window.innerWidth - размер() - ПОЛЯ))),
  y: Math.round(Math.max(ПОЛЯ, Math.min(y, window.innerHeight - размер() - ПОЛЯ))),
});
function поставить(x, y) {
  кнопка.style.left = x + 'px';
  кнопка.style.top = y + 'px';
}

function разложить() {
  if (!кнопка) return;
  const м = место();
  поставить(м.x, м.y);
  развести(м);
}

// Не лечь на кнопку «Телефона» Phone-ST: при пересечении встаём над ней (или
// под, если сверху места нет). Место не запоминаем — это только раскладка.
function развести(м) {
  const чужая = document.getElementById('gp-fab');
  if (!чужая || чужая.classList.contains('gp-hidden') || !чужая.getClientRects().length) return;
  const r = чужая.getBoundingClientRect();
  const зазор = 10;
  const пересеклись = м.x < r.right + зазор && м.x + размер() > r.left - зазор && м.y < r.bottom + зазор && м.y + размер() > r.top - зазор;
  if (!пересеклись) return;
  const выше = r.top - зазор - размер();
  const ниже = r.bottom + зазор;
  const н = прижать(м.x, выше >= ПОЛЯ ? выше : ниже);
  поставить(н.x, н.y);
}

// Перетаскивание: сдвинули дальше порога — едем за пальцем и запоминаем
// место; не сдвинули — это нажатие.
function тянуть(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const начало = { x: e.clientX, y: e.clientY };
  const r = кнопка.getBoundingClientRect();
  let сдвиг = false;
  try { кнопка.setPointerCapture(e.pointerId); } catch (_) { /* указатель уже отпущен */ }
  const ход = (ev) => {
    const dx = ev.clientX - начало.x, dy = ev.clientY - начало.y;
    if (!сдвиг && Math.hypot(dx, dy) < ПОРОГ) return;
    if (!сдвиг) { сдвиг = true; кнопка.classList.add('is-dragging'); }
    const н = прижать(r.left + dx, r.top + dy);
    поставить(н.x, н.y);
  };
  const конец = (ev) => {
    кнопка.removeEventListener('pointermove', ход);
    кнопка.removeEventListener('pointerup', конец);
    кнопка.removeEventListener('pointercancel', конец);
    кнопка.classList.remove('is-dragging');
    if (сдвиг) {
      const к = кнопка.getBoundingClientRect();
      запомнитьМесто(+((к.left + размер() / 2) / window.innerWidth).toFixed(4), +((к.top + размер() / 2) / window.innerHeight).toFixed(4));
      основа.saveSettings();
    } else if (ev.type === 'pointerup') переключить();
  };
  кнопка.addEventListener('pointermove', ход);
  кнопка.addEventListener('pointerup', конец);
  кнопка.addEventListener('pointercancel', конец);
}

// --- Значок непрочитанных ------------------------------------------------------------
// Тот же счёт, что у иконки «Сообщения» на домашнем экране (msg-feed.js), по
// развёрнутому HUD последнего хода. Считаем в стороне от событий: разбор с
// переносом из прошлых ходов не бесплатный.
function значокПозже() {
  clearTimeout(таймерЗначка);
  таймерЗначка = setTimeout(обновитьЗначок, 700);
}
// Прочитанное. Телефон снимает непрочитанное только в разметке (events.js,
// markChatRead), в HUD оно так и остаётся «Unread». Значок помнит, сколько
// строк было в чате, когда его открыли: пришло новое — снова считается.
// Ключ — ход, телефон (1 — основной, 2 — второй) и имя чата (data-chat-key).
const прочитано = new Map();
const ключПрочтения = (id, тел, чат) => `${id}|${тел}|${чат}`;
// Чужое имя «empty»/«none» — не владелец.
const владелецИли = (имя, запас) => { const в = String(имя || '').trim(); return в && !/^(empty|none)$/i.test(в) ? в : запас; };

function обновитьЗначок() {
  if (!значок) return;
  let n = 0;
  try {
    const id = основа.последнийСHud();
    const данные = id == null ? null : основа.разборНомера(id);
    const сосчитать = (чаты, телефон, тел) => {
      const хозяин = String((телефон && телефон.owner) || '').trim();
      for (const [имя, ч] of Object.entries(чаты || {})) {
        const строки = Array.isArray(ч && ч.messages) ? ч.messages : [];
        if ((прочитано.get(ключПрочтения(id, тел, имя)) ?? -1) >= строки.length) continue;
        n += непрочитанные(строки, владелецИли(ч && ч.owner, хозяин)).length;
      }
    };
    if (данные && settings.phoneAppMessages !== false) {
      сосчитать(данные.chatsMap, данные.phone, 1);
      if (второйВиден(данные)) сосчитать(данные.phone2.chatsMap, данные.phone2.phone, 2);
    }
  } catch (_) { n = 0; }
  значок.hidden = n <= 0;
  значок.textContent = n > 9 ? '9+' : String(n);
  кнопка.classList.toggle('has-unread', n > 0);
}

// Второй телефон в карточке есть не всегда: index.js прячет его, если он того
// же владельца или персонаж карточки в сцене. Значок считает его по тем же
// правилам, иначе светил бы чужими непрочитанными, которых не открыть.
function второйВиден(данные) {
  if (settings.phoneWhenCharAway !== 'both' || !данные.phone2 || typeof данные.phone2 !== 'object') return false;
  const втор = данные.phone2;
  const чей = владелецИли((втор.phone && втор.phone.owner) || Object.values(втор.chatsMap || {}).map(ч => ч && ч.owner).find(Boolean), '');
  const основной = String((данные.phone && данные.phone.owner) || '').trim();
  let чар = '';
  try { чар = String(основа.getStContextSafe()?.name2 || '').trim(); } catch (_) { чар = ''; }
  if (чей && основной && namesLikelySame(чей, основной)) return false;
  if (чей && чар && namesLikelySame(чей, чар)) return false;
  return !(чар && (данные.characters || []).some(c => c && c['Имя'] && namesLikelySame(String(c['Имя']), чар)));
}

// Открыли чат в телефоне этого хода (в окне или в карточке ленты) — его
// непрочитанные значок больше не считает.
function отметитьПрочтение(e) {
  const цель = e.target && e.target.closest && e.target.closest('.hud-phone-chat-row, .hud-phone-notif[data-chat-target], .hud-phone-lock-notice[data-chat-target]');
  if (!цель) return;
  setTimeout(() => {
    try {
      const корень = цель.closest('.mes, .hud-side-mes');
      const id = основа.последнийСHud();
      if (!корень || id == null || Number(корень.getAttribute('mesid')) !== id) return;
      const вкладка = цель.closest('.hud-tab-content');
      const тело = вкладка && вкладка.querySelector('.hud-phone-subbody.active[data-chat-key]');
      if (!тело) return;
      const тел = /^content-phone2-/.test(вкладка.id) ? 2 : 1;
      const данные = основа.разборНомера(id);
      const чаты = тел === 2 ? данные && данные.phone2 && данные.phone2.chatsMap : данные && данные.chatsMap;
      const ч = чаты && чаты[тело.dataset.chatKey];
      if (!ч) return;
      прочитано.set(ключПрочтения(id, тел, тело.dataset.chatKey), Array.isArray(ч.messages) ? ч.messages.length : 0);
      значокПозже();
    } catch (_) { /* значок — не повод ломать нажатие */ }
  }, 0);
}

// --- Окно ----------------------------------------------------------------------------
function создатьОкно() {
  окно = document.createElement('div');
  окно.className = 'hud-pf';
  окно.hidden = true;
  окно.setAttribute('role', 'dialog');
  окно.setAttribute('aria-modal', 'true');
  окно.setAttribute('aria-label', 'Телефон');
  окно.innerHTML = `<div class="hud-pf-stage">
      <div class="hud-pf-bar">
        <div class="hud-pf-owners" role="tablist" aria-label="Чей телефон" hidden></div>
        <button type="button" class="hud-pf-close" aria-label="Закрыть телефон" title="Закрыть телефон">${ЗНАЧОК_ЗАКРЫТЬ}</button>
      </div>
      <div class="hud-pf-hold">
        <div class="hud-side-mes hud-pf-mes"><div class="mes_text"></div></div>
        <div class="hud-pf-empty" hidden>${ЗНАЧОК_ТЕЛЕФОНА}<b>В последнем ходе телефона нет</b><small>Он появится, когда модель впишет телефон в HUD</small></div>
      </div>
    </div>`;
  обёртка = окно.querySelector('.hud-pf-mes');
  владельцы = окно.querySelector('.hud-pf-owners');
  пусто = окно.querySelector('.hud-pf-empty');
  document.body.appendChild(окно);
  окно.querySelector('.hud-pf-close').addEventListener('click', () => закрыть());
  // Нажатие мимо телефона опускает его. Только когда и нажали, и отпустили на
  // подложке: свайп по экрану блокировки, ушедший пальцем выше аппарата, даёт
  // click по общему предку — подложке, и телефон закрывался бы посреди жеста.
  let нажатоМимо = false;
  окно.addEventListener('pointerdown', (e) => { нажатоМимо = подложка(e.target); });
  окно.addEventListener('click', (e) => {
    const мимо = нажатоМимо && подложка(e.target);
    нажатоМимо = false;
    // Идёт звонок или открыт лист «+» — их закрывают их же кнопки.
    if (мимо && !занят()) закрыть();
  });
  владельцы.addEventListener('click', выбратьВладельца);
  ['touchstart', 'touchend'].forEach(тип => окно.addEventListener(тип, e => e.stopPropagation(), { passive: true }));
  // touchmove — свой: он не доходит до документа, а там events.js не даёт
  // жесту на экране блокировки прокручивать страницу (старый Safari).
  окно.addEventListener('touchmove', (e) => {
    e.stopPropagation();
    const замок = e.target.closest && e.target.closest('.hud-phone-lockscreen');
    const корпус = замок && замок.closest('.hud-phone-emulator');
    if (корпус && !корпус.classList.contains('unlocked') && e.touches.length < 2 && e.cancelable) e.preventDefault();
  }, { passive: false });
  // Tab не уходит из окна в чат за ним: оно модальное.
  окно.addEventListener('keydown', держатьФокус);
  window.visualViewport?.addEventListener('resize', подогнатьОкно, { passive: true });
  window.visualViewport?.addEventListener('scroll', подогнатьОкно, { passive: true });
}

// Экранная клавиатура на телефоне сжимает видимую часть окна, а fixed-слой
// остаётся во весь экран — поле ввода уходило бы под клавиатуру. Окно
// повторяет видимую часть (visualViewport).
function подогнатьОкно() {
  if (!окно || окно.hidden) return;
  const вв = window.visualViewport;
  if (!вв || (вв.scale && Math.abs(вв.scale - 1) > 0.05)) { окно.style.removeProperty('--hud-pf-h'); окно.style.removeProperty('--hud-pf-top'); return; }
  окно.style.setProperty('--hud-pf-h', Math.round(вв.height) + 'px');
  окно.style.setProperty('--hud-pf-top', Math.round(вв.offsetTop || 0) + 'px');
}

export function переключить() { открыто() ? закрыть() : открыть(); }

export function открыть() {
  if (!включена) return;
  if (!окно) создатьОкно();
  clearTimeout(таймерУхода);
  окно.hidden = false;
  подогнатьОкно();
  обновить(false);
  // Класс — после кадра раскладки: переход поднимает телефон снизу. Не через
  // requestAnimationFrame — в фоновой вкладке он не приходит вовсе.
  void окно.offsetWidth;
  окно.classList.add('is-open');
  кнопка.classList.add('is-on');
  кнопка.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('hud-pf-open');
  setTimeout(() => { if (открыто()) окно.querySelector('.hud-pf-close')?.focus({ preventScroll: true }); }, 60);
}

export function закрыть() {
  if (!открыто()) return;
  окно.classList.remove('is-open');
  кнопка.classList.remove('is-on');
  кнопка.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('hud-pf-open');
  // Вид телефона запоминаем: открыли снова — тот же экран и тот же чат.
  if (обёртка && обёртка.querySelector('.hud-os-card')) прошлыйВид = снятьВид();
  clearTimeout(таймерУхода);
  таймерУхода = setTimeout(() => {
    if (открыто() || !окно) return;
    окно.hidden = true;
    // Закрытое окно не держит второй копии телефона: меньше узлов на странице,
    // и переписка игрока не ищет чат в невидимом аппарате.
    обёртка.querySelector('.mes_text').innerHTML = '';
    обёртка.removeAttribute('mesid');
    показан = null; ключ = '';
    кнопка?.focus({ preventScroll: true });
  }, УХОД);
}

const подложка = (у) => !!у && (у === окно || (у.classList && (у.classList.contains('hud-pf-stage') || у.classList.contains('hud-pf-hold'))));
// Внутри телефона идёт своё: звонок, лист «+», лист фона чата.
const занят = () => !!(окно && окно.querySelector('.hud-uc-call, .hud-uc-sheet, .hud-chatbg-sheet'));

function поEsc(e) {
  if (e.key !== 'Escape' || !открыто() || e.defaultPrevented) return;
  // Поверх телефона открыто его же окно (снимок, подтверждение, расшифровка) — Esc его.
  if (document.querySelector('.hud-modal-overlay, .hud-be-overlay, .hud-cp')) return;
  // Esc в поле ввода убирает поле (index.js), второй — уже телефон; звонок и
  // листы закрываются своими кнопками и своим Esc.
  const ц = e.target;
  if (ц && ц.closest && (ц.closest('textarea, input, select, [contenteditable="true"]'))) return;
  if (занят()) return;
  e.preventDefault();
  закрыть();
}

function держатьФокус(e) {
  if (e.key !== 'Tab' || !открыто()) return;
  const все = [...окно.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(у => !у.disabled && !у.closest('[hidden]') && у.getClientRects().length);
  if (!все.length) return;
  const первый = все[0], последний = все[все.length - 1];
  if (e.shiftKey && document.activeElement === первый) { e.preventDefault(); последний.focus(); }
  else if (!e.shiftKey && document.activeElement === последний) { e.preventDefault(); первый.focus(); }
}

/** Сообщение изменилось (или вид карточек): пересобрать, если окно открыто. */
export function заметить(id = null, сила = false) {
  if (!включена) return;
  if (сила) нужнаСила = true;
  показатьКнопку();
  значокПозже();
  развести(место());
  clearTimeout(таймер);
  // Запись в HUD этого хода (переписка игрока, правка) — пересобираем сразу:
  // переписка ищет открытый чат в окне через считанные миллисекунды, чтобы
  // прокрутить ленту, вернуть поле и показать ответ по одному, и должна
  // найти уже новый аппарат, а не тот, что вот-вот заменится.
  if (сила && открыто() && Number.isInteger(id) && id === показан) return обновить(true);
  таймер = setTimeout(() => обновить(false), 150);
}

// Сборка идёт — новый повод ждёт её конца: оживление карточки может само
// сообщить об изменении, и пересборка внутри пересборки разорвала бы окно.
let собираю = false;
function обновить(сила) {
  if (!включена) return;
  clearTimeout(таймер);
  if (собираю) { if (сила) нужнаСила = true; таймер = setTimeout(() => обновить(false), 60); return; }
  if (нужнаСила) { сила = true; нужнаСила = false; }
  if (!окно || окно.hidden) { ключ = ''; return; }
  let последний = null;
  try { последний = основа.последнийСHud(); } catch (_) { последний = null; }
  собираю = true;
  try { показать(последний, сила); } finally { собираю = false; }
}

function показать(id, сила) {
  const текст = обёртка.querySelector('.mes_text');
  const нет = () => {
    текст.innerHTML = ''; обёртка.removeAttribute('mesid');
    показан = null; ключ = '';
    пусто.hidden = false; владельцы.hidden = true;
  };
  if (id == null) return нет();
  const новый = основа.ключКарточкиПанели(id);
  if (!сила && новый === ключ && id === показан && текст.querySelector('.hud-os-card')) return;
  // Вид до пересборки (экран телефона, открытое приложение и чат) — вернём.
  const состояние = текст.querySelector('.hud-os-card') ? снятьВид() : прошлыйВид;
  обёртка.setAttribute('mesid', String(id));
  let итог = null;
  try { итог = основа.собратьКарточкуПанели(id, обёртка, { телефоны: true }); } catch (err) { console.error('[TavernOS HUD] плавающий телефон: карточка не собралась', err); }
  if (!итог || !/data-tab-id="phone"/.test(итог.html)) {
    // Ход ещё печатается — оставляем прежний телефон, если он был.
    if (итог || !текст.querySelector('.hud-os-card')) нет();
    return;
  }
  пусто.hidden = true;
  текст.innerHTML = итог.html;
  показан = id; ключ = новый;
  const карточка = текст.querySelector('.hud-os-card');
  if (!карточка) return нет();
  // Карточка в окне всегда раскрыта: свернуть её некуда.
  const свёртка = карточка.querySelector(':scope > .hud-toggle-input');
  if (свёртка) { свёртка.checked = true; свёртка.disabled = true; }
  основа.оживитьКарточкуПанели(обёртка, итог.лень);
  if (состояние) {
    обёртка.__hudUiState = { ...состояние, свёрнута: true };
    try { основа.applyCardUiState(обёртка); } catch (_) { /* вид не вернулся — телефон всё равно есть */ }
  }
  прошлыйВид = null;
  разметитьВладельцев(карточка);
  if (состояние && состояние.чат) вернутьЧат(карточка, состояние.чат, состояние);
}

// Открытая переписка в общее состояние карточки не входит: в ленте её
// возвращает сама переписка игрока (user-chat-ui.js), а окно пересобирается
// позже неё — и после ответа собеседника оказывалось в списке чатов.
// Запоминаем чат по его имени (data-chat-key): номер меняется, когда чат с
// новым сообщением поднимается наверх списка.
function снятьВид() {
  let вид = null;
  try { вид = основа.readCardUiState(обёртка); } catch (_) { вид = null; }
  const тело = обёртка.querySelector('.hud-tab-content.active .hud-phone-subbody.active[data-chat-key]');
  const лента = тело && тело.querySelector('.hud-phone-chat-area');
  // Внизу ленты (или почти) — после пересборки снова вниз, к новым сообщениям;
  // листали выше — остаёмся там же.
  const внизу = !лента || лента.scrollHeight - лента.scrollTop - лента.clientHeight < 200;
  return вид ? { ...вид, чат: тело ? тело.dataset.chatKey : '', лентаВнизу: внизу, лентаСверху: лента ? лента.scrollTop : 0 } : null;
}
function вернутьЧат(карточка, ключЧата, { лентаВнизу = true, лентаСверху = 0 } = {}) {
  const вкладка = карточка.querySelector('.hud-tab-content.active');
  const тело = вкладка && [...вкладка.querySelectorAll('.hud-phone-subbody[data-chat-key]')].find(т => т.dataset.chatKey === ключЧата);
  if (!тело) return;
  const эмулятор = тело.closest('.hud-phone-emulator');
  if (эмулятор && !эмулятор.classList.contains('unlocked')) return;
  if (!тело.classList.contains('active')) {
    const ряд = вкладка.querySelector(`.hud-phone-chat-row[data-chat-target="${CSS.escape(тело.id)}"]`);
    if (ряд) ряд.click();
  }
  const лента = тело.querySelector('.hud-phone-chat-area');
  if (лента) лента.scrollTop = лентаВнизу ? лента.scrollHeight : лентаСверху;
}

// --- Владельцы -------------------------------------------------------------------
// Вкладки телефонов в карточке спрятаны; над аппаратом — переключатель с
// именами владельцев (подпись берём из шапки приложения телефона).
function вкладкиТелефонов(карточка) {
  return [...карточка.querySelectorAll('.hud-tab[data-tab-id="phone"]')];
}
function имяВладельца(карточка, вкладка, i) {
  const тело = карточка.querySelector('#' + CSS.escape(вкладка.dataset.target || ''));
  const имя = тело && тело.querySelector('.hud-phone-app-owner');
  const текст = (имя && имя.textContent || '').trim();
  return текст || (i === 0 ? 'Телефон' : 'Второй телефон');
}
function разметитьВладельцев(карточка) {
  const вкладки = вкладкиТелефонов(карточка);
  if (вкладки.length < 2) { владельцы.hidden = true; владельцы.innerHTML = ''; выбран = 0; return; }
  if (выбран >= вкладки.length) выбран = 0;
  const активная = вкладки[выбран];
  if (активная && !активная.classList.contains('active')) активная.click();
  владельцы.innerHTML = вкладки.map((в, i) => `<button type="button" class="hud-pf-owner${i === выбран ? ' is-on' : ''}" role="tab" aria-selected="${i === выбран}" data-pf-owner="${i}">${ЗНАЧОК_ТЕЛЕФОНА}<span data-i18n-skip></span></button>`).join('');
  владельцы.querySelectorAll('[data-pf-owner] span').forEach((s, i) => { s.textContent = имяВладельца(карточка, вкладки[i], i); });
  владельцы.hidden = false;
}
function выбратьВладельца(e) {
  const кн = e.target.closest && e.target.closest('[data-pf-owner]');
  if (!кн) return;
  const i = Number(кн.dataset.pfOwner);
  const карточка = обёртка.querySelector('.hud-os-card');
  const вкладка = карточка && вкладкиТелефонов(карточка)[i];
  if (!вкладка) return;
  выбран = i;
  if (!вкладка.classList.contains('active')) вкладка.click();
  владельцы.querySelectorAll('[data-pf-owner]').forEach((b, j) => { b.classList.toggle('is-on', j === i); b.setAttribute('aria-selected', String(j === i)); });
}

export const _дляТестов = { место, прижать, запомнитьМесто };
