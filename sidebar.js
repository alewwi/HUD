// hud-manager/sidebar.js
//
// Панель HUD сбоку окна. Это та же карточка, что в сообщении, только в
// другом месте: index.js собирает её из данных сообщения тем же путём, что и
// в чате (перенос из прошлых ходов, черты, доверие), — все виды, темы и
// рисунки работают сами. Кнопки на карточке находят своё сообщение через
// обёртку .hud-side-mes[mesid] (closest('.mes, .hud-side-mes')).
//
// Показывает HUD последнего ответа и идёт за ним (новый ответ, свайп,
// перегенерация, правка); стрелками можно листать прошлые ходы. ПК — панель
// у края под полосой Таверны: ширина тянется за край или заполняет место до
// колонки чата. Узкий экран (≤1000px, как у самой Таверны) — выезжающая
// панель с затемнением. Грузится, только когда панель включена.

import { settings } from './settings.js?v=23.88.8';
import { английский } from './i18n.js?v=23.88.8';

// Из index.js (геттеры — значения живые): getStContextSafe, saveSettings,
// собратьКарточкуПанели, оживитьКарточкуПанели, ключКарточкиПанели,
// соседСHud, последнийСHud, ходовНазад, ходыВокруг, readCardUiState,
// applyCardUiState, вернутьПрокрутку.
let основа = null;
export function подключить(связь) { основа = связь; }

const УЗКО = 1000;          // тот же порог, что у мобильной раскладки Таверны
const МИН_ШИРИНА = 300;
const ДО_ЧАТА_МИН = 300;    // меньше места до колонки чата — панель ложится поверх
const ОСТАВИТЬ_ЧАТА = 280;  // шире не тянется: хоть полоска чата остаётся видна
const ПРИЛИПАНИЕ = 18;      // у края колонки чата ширина прилипает к «до чата»
const ТОЧЕК = 9;

let включена = false;
let панель = null, обёртка = null, область = null, затемнение = null, кнопка = null;
// Номер сообщения, который смотрят вручную; null — идём за последним.
let закреп = null;
let показан = null, ключ = '', нужнаСила = false, таймер = 0;
let наблюдатель = null, направляющая = null;
const подписки = [];

const узко = () => window.innerWidth <= УЗКО;
const открыта = () => !!(панель && панель.classList.contains('is-open'));

function ходов(n) {
  if (английский()) return n === 1 ? '1 turn back' : n + ' turns back';
  const д = n % 10, с = n % 100;
  const слово = д === 1 && с !== 11 ? 'ход' : д >= 2 && д <= 4 && (с < 12 || с > 14) ? 'хода' : 'ходов';
  return `${n} ${слово} назад`;
}

// Шапка: марка и кнопки окна, под ней — капсула хода (‹ #188 · последний
// ход ›) с точками ближайших ходов и «к последнему», когда смотрят старый.
function разметка() {
  return `<div class="hud-side-grip" title="Потяните, чтобы изменить ширину. У края колонки чата ширина прилипает к ней"><i></i></div>
    <div class="hud-side-head">
      <div class="hud-side-top">
        <span class="hud-side-brand"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><b>TavernOS</b><small>HUD</small></span>
        <span class="hud-side-gap"></span>
        <button type="button" class="hud-side-btn" data-side="edge" title=""><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
        <button type="button" class="hud-side-btn" data-side="fit" title=""><i class="fa-solid fa-left-right"></i></button>
        <button type="button" class="hud-side-btn" data-side="close" title="Закрыть панель"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="hud-side-nav">
        <div class="hud-side-capsule">
          <button type="button" class="hud-side-btn" data-side="prev" title="Предыдущий ход"><i class="fa-solid fa-chevron-left"></i></button>
          <div class="hud-side-where"><span class="hud-side-label"><b></b><small></small></span><span class="hud-side-dots" role="group" aria-label="Ходы"></span></div>
          <button type="button" class="hud-side-btn" data-side="next" title="Следующий ход"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <button type="button" class="hud-side-last" data-side="last" title="К последнему ходу"><span>к последнему</span><i class="fa-solid fa-angles-right"></i></button>
      </div>
    </div>
    <div class="hud-side-scroll">
      <div class="hud-side-mes"><div class="mes_text"></div></div>
      <div class="hud-side-empty" hidden><i class="fa-solid fa-layer-group" aria-hidden="true"></i><b>В этом чате пока нет HUD</b><small>Он появится здесь после ответа с блоком HUD</small></div>
    </div>`;
}

/** Включить панель: кнопка в полосе Таверны, сама панель, подписки. */
export function включить() {
  if (включена) { разложить(); заметить(null, true); return; }
  включена = true;
  панель = document.createElement('aside');
  панель.id = 'hud-side';
  панель.className = 'hud-side';
  панель.setAttribute('aria-label', 'HUD');
  панель.innerHTML = разметка();
  обёртка = панель.querySelector('.hud-side-mes');
  область = панель.querySelector('.hud-side-scroll');
  затемнение = document.createElement('div');
  затемнение.className = 'hud-side-backdrop';
  document.body.append(затемнение, панель);

  панель.addEventListener('click', поКнопке);
  область.addEventListener('scroll', () => панель.classList.toggle('is-scrolled', область.scrollTop > 2), { passive: true });
  обёртка.addEventListener('animationend', () => обёртка.classList.remove('is-in-prev', 'is-in-next', 'is-in'));
  затемнение.addEventListener('click', () => закрыть());
  // Касания внутри панели — её собственные: свайпы Таверны («следующий
  // вариант ответа») и закрытие её выдвижных панелей тут ни при чём.
  ['touchstart', 'touchmove', 'touchend'].forEach(т => панель.addEventListener(т, e => e.stopPropagation(), { passive: true }));
  панель.querySelector('.hud-side-grip').addEventListener('pointerdown', тянуть);
  document.addEventListener('keydown', поEsc);

  поставитьКнопку();
  window.addEventListener('resize', разложить, { passive: true });
  const колонка = document.getElementById('sheld');
  if (колонка && typeof ResizeObserver === 'function') { наблюдатель = new ResizeObserver(() => разложить()); наблюдатель.observe(колонка); }

  const ctx = основа.getStContextSafe();
  const ист = ctx && ctx.eventSource, типы = ctx && (ctx.event_types || ctx.eventTypes);
  if (ист && типы) {
    const на = (имя, f) => { if (типы[имя]) { ист.on(типы[имя], f); подписки.push([типы[имя], f]); } };
    на('CHAT_CHANGED', () => { закреп = null; заметить(null, true); });
    ['MESSAGE_RECEIVED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHARACTER_MESSAGE_RENDERED', 'GENERATION_ENDED']
      .forEach(имя => на(имя, () => заметить()));
  }

  // На узком экране панель закрывает чат — открывается только по нажатию.
  if (settings.hudSideOpen !== false && !узко()) открыть();
  else разложить();
}

/** Выключить: убрать всё, что поставили. */
export function выключить() {
  if (!включена) return;
  включена = false;
  clearTimeout(таймер);
  const ctx = основа.getStContextSafe();
  const ист = ctx && ctx.eventSource;
  if (ист) подписки.forEach(([тип, f]) => { try { (ист.removeListener || ист.off).call(ист, тип, f); } catch (_) {} });
  подписки.length = 0;
  if (наблюдатель) { наблюдатель.disconnect(); наблюдатель = null; }
  window.removeEventListener('resize', разложить);
  document.removeEventListener('keydown', поEsc);
  [панель, затемнение, кнопка, направляющая].forEach(у => у && у.remove());
  панель = обёртка = область = затемнение = кнопка = направляющая = null;
  document.documentElement.classList.remove('hud-side-open');
  закреп = показан = null; ключ = '';
}

function поставитьКнопку() {
  const полоса = document.getElementById('top-settings-holder');
  if (!полоса) return;
  кнопка = document.createElement('div');
  кнопка.id = 'hud-side-button';
  кнопка.className = 'drawer';
  кнопка.innerHTML = '<div class="drawer-toggle"><div class="drawer-icon fa-solid fa-table-columns fa-fw closedIcon interactable" role="button" tabindex="0" title="HUD сбоку"></div></div>';
  const рядом = document.getElementById('extensions-settings-button');
  if (рядом && рядом.parentElement === полоса) полоса.insertBefore(кнопка, рядом);
  else полоса.appendChild(кнопка);
  const значок = кнопка.querySelector('.drawer-icon');
  значок.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); переключить(); });
  значок.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); переключить(); } });
}

function отметитьКнопку() {
  const значок = кнопка && кнопка.querySelector('.drawer-icon');
  if (!значок) return;
  значок.classList.toggle('openIcon', открыта());
  значок.classList.toggle('closedIcon', !открыта());
}

export function переключить() { открыта() ? закрыть() : открыть(); }

/** Открыть панель; с номером — показать этот ход. */
export function открыть(id = null) {
  if (!включена) return;
  if (Number.isInteger(id)) закреп = id;
  панель.classList.add('is-open');
  document.documentElement.classList.add('hud-side-open');
  if (!узко() && settings.hudSideOpen !== true) { settings.hudSideOpen = true; основа.saveSettings(); }
  разложить();
  отметитьКнопку();
  обновить(Number.isInteger(id));
}

export function закрыть() {
  if (!открыта()) return;
  панель.classList.remove('is-open');
  отметитьЗаглушку(null);
  document.documentElement.classList.remove('hud-side-open');
  if (!узко() && settings.hudSideOpen !== false) { settings.hudSideOpen = false; основа.saveSettings(); }
  разложить();
  отметитьКнопку();
}

function поEsc(e) {
  if (e.key === 'Escape' && открыта() && узко() && !e.defaultPrevented) закрыть();
}

/* Ширина и место. ПК: своя ширина (тянется за край) или «до чата» — всё
   место между колонкой чата и краем окна; места мало — своя ширина поверх.
   Узкий экран: выезжающая панель, ширину задаёт CSS. */
function разложить() {
  if (!панель) return;
  const край = settings.hudSideEdge === 'left' ? 'left' : 'right';
  панель.dataset.edge = край;
  затемнение.dataset.edge = край;
  const сторона = панель.querySelector('[data-side="edge"]');
  if (сторона) сторона.title = край === 'right' ? 'Перенести панель к левому краю' : 'Перенести панель к правому краю';
  const мобильная = узко();
  панель.classList.toggle('is-drawer', мобильная);
  затемнение.classList.toggle('is-on', мобильная && открыта());
  let ширина = обрезать(Number(settings.hudSideWidth) || 420);
  let доЧата = false;
  if (!мобильная && settings.hudSideFit === 'chat') {
    const место = местоДоЧата(край);
    if (место >= ДО_ЧАТА_МИН) { ширина = место; доЧата = true; }
  }
  панель.classList.toggle('is-fit', доЧата);
  if (!мобильная) панель.style.setProperty('--hud-side-w', ширина + 'px');
  else панель.style.removeProperty('--hud-side-w');
  const fit = панель.querySelector('[data-side="fit"]');
  if (fit) {
    fit.hidden = мобильная;
    fit.classList.toggle('is-on', settings.hudSideFit === 'chat');
    fit.title = settings.hudSideFit === 'chat'
      ? (доЧата ? 'Ширина — до колонки чата. Нажмите — своя ширина' : 'До колонки чата мало места — панель своей ширины поверх чата. Нажмите — своя ширина')
      : 'Ширина своя (тянется за край). Нажмите — до колонки чата';
  }
}

const обрезать = (ш) => Math.round(Math.max(МИН_ШИРИНА, Math.min(ш, window.innerWidth - ОСТАВИТЬ_ЧАТА)));
// Свободное место между колонкой чата и краем окна.
function местоДоЧата(край) {
  const колонка = document.getElementById('sheld');
  const r = колонка && колонка.getBoundingClientRect();
  return r ? Math.floor(край === 'right' ? window.innerWidth - r.right : r.left) : 0;
}

// Ширина — за край панели со стороны чата: от узкой до почти всего окна,
// поверх чата. У края колонки чата прилипает: отпустили там — «до чата»,
// и дальше панель сама следит за шириной колонки.
function тянуть(e) {
  if (узко() || e.button !== 0) return;
  e.preventDefault();
  const край = панель.dataset.edge;
  const ручка = e.currentTarget;
  try { ручка.setPointerCapture(e.pointerId); } catch (_) { /* указатель уже отпущен */ }
  панель.classList.add('is-resizing');
  const место = местоДоЧата(край);
  const можноПрилипнуть = место >= ДО_ЧАТА_МИН;
  if (можноПрилипнуть && !направляющая) {
    направляющая = document.createElement('div');
    направляющая.className = 'hud-side-guide';
    направляющая.innerHTML = '<span>до чата</span>';
    document.body.appendChild(направляющая);
  }
  if (направляющая) направляющая.style.left = (край === 'right' ? window.innerWidth - место : место) + 'px';
  let прилипла = панель.classList.contains('is-fit');
  const ход = (ev) => {
    let ширина = обрезать(край === 'right' ? window.innerWidth - ev.clientX : ev.clientX);
    прилипла = можноПрилипнуть && Math.abs(ширина - место) <= ПРИЛИПАНИЕ;
    if (прилипла) ширина = место;
    панель.style.setProperty('--hud-side-w', ширина + 'px');
    панель.classList.toggle('is-fit', прилипла);
    if (направляющая) направляющая.classList.toggle('is-on', прилипла);
    if (!прилипла) settings.hudSideWidth = ширина;
  };
  const конец = () => {
    ручка.removeEventListener('pointermove', ход);
    ручка.removeEventListener('pointerup', конец);
    ручка.removeEventListener('pointercancel', конец);
    панель.classList.remove('is-resizing');
    if (направляющая) { направляющая.remove(); направляющая = null; }
    settings.hudSideFit = прилипла ? 'chat' : 'manual';
    основа.saveSettings();
    разложить();
  };
  ручка.addEventListener('pointermove', ход);
  ручка.addEventListener('pointerup', конец);
  ручка.addEventListener('pointercancel', конец);
}

function поКнопке(e) {
  const кн = e.target.closest && e.target.closest('[data-side]');
  if (!кн || !панель.contains(кн) || кн.disabled) return;
  e.preventDefault();
  const что = кн.dataset.side;
  if (что === 'close') return закрыть();
  if (что === 'edge') {
    settings.hudSideEdge = settings.hudSideEdge === 'left' ? 'right' : 'left';
    основа.saveSettings();
    // Тот же выбор в настройках расширения, если панель настроек уже открыта.
    const выбор = document.getElementById('hud-side-edge');
    if (выбор) выбор.value = settings.hudSideEdge;
    return разложить();
  }
  if (что === 'fit') {
    settings.hudSideFit = settings.hudSideFit === 'chat' ? 'manual' : 'chat';
    основа.saveSettings();
    return разложить();
  }
  if (что === 'last') { направление = 'next'; закреп = null; return обновить(false); }
  if (что === 'go') return перейти(Number(кн.dataset.go));
  if (показан == null) return;
  перейти(основа.соседСHud(показан, что === 'prev' ? -1 : 1));
}

// На ход с этим номером (стрелки, точки); направление — для въезда карточки.
let направление = '';
function перейти(id) {
  if (!Number.isInteger(id) || id === показан) return;
  направление = показан != null && id < показан ? 'prev' : 'next';
  закреп = id === основа.последнийСHud() ? null : id;
  обновить(false);
}

/** Сообщение изменилось (или вид карточек): пересобрать, если нужно. */
export function заметить(id = null, сила = false) {
  if (!включена) return;
  if (сила) нужнаСила = true;
  clearTimeout(таймер);
  таймер = setTimeout(() => обновить(false), 120);
}

function обновить(сила) {
  if (!включена) return;
  clearTimeout(таймер);
  if (нужнаСила) { сила = true; нужнаСила = false; }
  // Закрытая панель не собирает ничего: соберёт при открытии.
  if (!открыта()) { ключ = ''; return; }
  const последний = основа.последнийСHud();
  if (закреп != null && (закреп === последний || основа.ключКарточкиПанели(закреп) === '')) закреп = null;
  показать(закреп ?? последний, сила);
  отметитьЗаглушку(показан);
}

// «Только сбоку»: кнопка «HUD ›» того хода, что сейчас в панели, подсвечена.
function отметитьЗаглушку(id) {
  document.querySelectorAll('#chat .hud-side-stub.is-shown').forEach(з => {
    if (String(з.closest('.mes')?.getAttribute('mesid')) !== String(id)) з.classList.remove('is-shown');
  });
  if (id == null) return;
  const з = document.querySelector(`#chat .mes[mesid="${id}"] .hud-side-stub`);
  if (з) з.classList.add('is-shown');
}

function подписать(id, последний) {
  const где = панель.querySelector('.hud-side-where');
  где.querySelector('b').textContent = id == null ? 'HUD' : '#' + id;
  где.querySelector('small').textContent = id == null ? '' : id === последний ? 'последний ход' : ходов(основа.ходовНазад(id));
  // Точки — ближайшие ходы с HUD; нажатие переносит на ход.
  const ходы = id == null ? [] : основа.ходыВокруг(id, ТОЧЕК);
  где.querySelector('.hud-side-dots').innerHTML = ходы.length > 1 ? ходы.map(j =>
    `<button type="button" class="hud-side-dot${j === id ? ' is-cur' : ''}${j === последний ? ' is-last' : ''}" data-side="go" data-go="${j}" title="#${j}" aria-label="#${j}"${j === id ? ' aria-current="true"' : ''}></button>`).join('') : '';
  панель.querySelector('[data-side="prev"]').disabled = id == null || основа.соседСHud(id, -1) == null;
  панель.querySelector('[data-side="next"]').disabled = id == null || id === последний;
  панель.classList.toggle('is-old', id != null && id !== последний);
}

function показать(id, сила) {
  const текст = обёртка.querySelector('.mes_text');
  const пусто = панель.querySelector('.hud-side-empty');
  const последний = основа.последнийСHud();
  подписать(id, последний);
  if (id == null) {
    текст.innerHTML = ''; обёртка.removeAttribute('mesid');
    показан = null; ключ = '';
    пусто.hidden = false;
    return;
  }
  пусто.hidden = true;
  const новый = основа.ключКарточкиПанели(id);
  if (!сила && новый === ключ && id === показан && текст.querySelector('.hud-os-card')) return;
  // Вид до пересборки: открытая вкладка, раскрытое, экран телефона — и на
  // другом ходу тоже, чтобы листать ходы, не теряя места.
  const состояние = текст.querySelector('.hud-os-card') ? основа.readCardUiState(обёртка) : null;
  const сверху = область.scrollTop;
  обёртка.setAttribute('mesid', String(id));
  let итог = null;
  try { итог = основа.собратьКарточкуПанели(id, обёртка); } catch (err) { console.error('[TavernOS HUD] панель: карточка не собралась', err); }
  if (!итог) {
    // Ход не разобрался (ещё печатается) — оставляем прежнюю карточку.
    if (!текст.querySelector('.hud-os-card')) { пусто.hidden = false; }
    return;
  }
  const другойХод = показан != null && id !== показан;
  текст.innerHTML = итог.html;
  if (другойХод) {
    обёртка.classList.remove('is-in-prev', 'is-in-next', 'is-in');
    void обёртка.offsetWidth;
    обёртка.classList.add(направление === 'prev' ? 'is-in-prev' : направление === 'next' ? 'is-in-next' : 'is-in');
  }
  направление = '';
  показан = id; ключ = новый;
  const карточка = текст.querySelector('.hud-os-card');
  if (!карточка) return;
  // В панели карточка всегда раскрыта: свернуть её некуда.
  const свёртка = карточка.querySelector(':scope > .hud-toggle-input');
  if (свёртка) { свёртка.checked = true; свёртка.disabled = true; }
  основа.оживитьКарточкуПанели(обёртка, итог.лень);
  if (состояние) {
    обёртка.__hudUiState = { ...состояние, свёрнута: true };
    основа.applyCardUiState(обёртка);
  }
  основа.вернутьПрокрутку(обёртка);
  область.scrollTop = сверху;
}

export const _дляТестов = { ходов };
