// color-picker.js — своя палитра вместо системной для цветов «Кастомизации».
//
// Системный выбор цвета на телефоне — крошечный квадрат и чужое окно, а на
// ПК не видно, на что цвет ляжет. Здесь: полосы тона, насыщенности и
// светлоты, поле HEX, цвета темы образцами — и живой предпросмотр ровно той
// плашки, цвет которой меняется (копия из последней карточки в чате).
//
// Поле <input type="color"> остаётся хранилищем значения: палитра пишет в
// него и шлёт обычное событие input — сохранение, применение темы и шаги
// «Отменить» работают как раньше (events.js).

import { settings } from './settings.js?v=23.19.1';

// Какая плашка показывает цвет: первый найденный селектор в карточке.
// zoom — для крупных частей (телефон, сцена), чтобы влезли в окно.
const ПЛАШКИ = {
  accentColor: { sel: ['.hud-tabs-header', '.hud-os-topbar'] },
  glowColor: { sel: ['.hud-scene-top', '.hud-tabs-header'] },
  cardBgStart: { sel: ['.hud-tab-content .hud-body > .hud-row'] },
  cardBgEnd: { sel: ['.hud-tab-content .hud-body > .hud-row'] },
  infoBlockBgStart: { sel: ['.hud-tab-content .hud-body > .hud-row'] },
  infoBlockBgEnd: { sel: ['.hud-tab-content .hud-body > .hud-row'] },
  textColor: { sel: ['.hud-tab-content .hud-body > .hud-row'] },
  textMutedColor: { sel: ['.hud-tab-content .hud-body > .hud-row'] },
  dramaColor: { sel: ['.hud-row.drama-alert', '.hud-tab-content .hud-body > .hud-row'] },
  nsfwColor: { sel: ['.hud-row.nsfw'] },
  memoryBgStart: { sel: ['.hud-memory-body .hud-row', '.hud-memory-body > *'] },
  memoryBgEnd: { sel: ['.hud-memory-body .hud-row', '.hud-memory-body > *'] },
  memoryAccent: { sel: ['.hud-memory-body .hud-row', '.hud-memory-body > *'] },
  phoneBgStart: { sel: ['.hud-phone-emulator'], zoom: .5 },
  phoneAccent: { sel: ['.hud-phone-emulator'], zoom: .5 },
  phoneFrameColor: { sel: ['.hud-phone-emulator'], zoom: .5 },
  msgInBg: { sel: ['.hud-phone-chat-area', '.hud-phone-emulator'], zoom: .7 },
  msgOutStart: { sel: ['.hud-phone-chat-area', '.hud-phone-emulator'], zoom: .7 },
  topBarBg: { sel: ['.hud-os-topbar'] },
  tabsBg: { sel: ['.hud-tabs-header'] },
  sceneOverlayColor: { sel: ['.hud-scene-widget'], zoom: .6 },
  sceneTextColor: { sel: ['.hud-scene-top'] },
  weatherBgColor: { sel: ['.hud-scene-top'] },
  clockColor: { sel: ['.hud-scene-time-group', '.hud-scene-top'] },
  interceptColor: { sel: ['.hud-intercept-header', '.hud-tabs-header'] },
  badgeColor: { sel: ['.hud-tabs-header'] },
  avatarFrameColor: { sel: ['.hud-tab-content.active .hud-header', '.hud-tab-content .hud-header'] },
};

const ОБРАЗЦЫ = ['#e0568f', '#c31f38', '#ff6b4a', '#f0a53c', '#e8c547', '#7cc46a', '#2fb39a', '#3aa8d8', '#5b7cf0', '#8c5ad2', '#b36bd6', '#9aa0ae', '#ffffff', '#1b1b22'];
const КЛЮЧИ_ТЕМЫ = ['accentColor', 'glowColor', 'textColor', 'nsfwColor', 'dramaColor', 'memoryAccent', 'phoneAccent', 'clockColor', 'cardBgStart', 'infoBlockBgStart'];

// --- Цвет: HEX ⇄ HSL ---------------------------------------------------------
function hexВhsl(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return { h: 0, s: 0, l: 50 };
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let тон = 0, нас = 0;
  if (max !== min) {
    const d = max - min;
    нас = l > .5 ? d / (2 - max - min) : d / (max + min);
    тон = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    тон *= 60;
  }
  return { h: Math.round(тон), s: Math.round(нас * 100), l: Math.round(l * 100) };
}
function hslВhex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// --- Предпросмотр: копия плашки в «оболочке» её предков --------------------
// Стили карточки завязаны на предков (.hud-os-card … .hud-body > .hud-row),
// поэтому копируем не только плашку, но и цепочку предков — пустыми
// оболочками с теми же классами. Вкладка в оболочке всегда открыта.
function копияПлашки(ключ) {
  // Сначала — образец в окне «Кастомизации», иначе последняя карточка в чате.
  const карточки = document.querySelectorAll('#chat .hud-os-card');
  const карта = document.querySelector('.hud-custom-preview-body .hud-os-card') || карточки[карточки.length - 1];
  const описание = ПЛАШКИ[ключ];
  if (!карта || !описание) return null;
  let цель = null;
  for (const s of описание.sel) { цель = карта.querySelector(s); if (цель) break; }
  if (!цель) return null;
  let узел = цель.cloneNode(true);
  узел.classList.remove('fx-tap');
  for (let e = цель.parentElement; e && e !== карта; e = e.parentElement) {
    const оболочка = document.createElement(e.tagName.toLowerCase() === 'details' ? 'div' : e.tagName.toLowerCase());
    оболочка.className = e.className;
    if (e.getAttribute('style')) оболочка.setAttribute('style', e.getAttribute('style'));
    if (оболочка.classList.contains('hud-tab-content')) оболочка.classList.add('active');
    оболочка.appendChild(узел);
    узел = оболочка;
  }
  const корпус = document.createElement('div');
  корпус.className = карта.className + ' hud-cp-card';
  корпус.innerHTML = '<input type="checkbox" class="hud-toggle-input" checked>';
  корпус.appendChild(узел);
  if (описание.zoom) корпус.style.zoom = String(описание.zoom);
  return корпус;
}

// --- Окно палитры ------------------------------------------------------------
let открыто = null;
function подпись(поле) {
  const ряд = поле.closest('.hud-theme-row, .hud-role');
  const t = ряд && (ряд.querySelector('label:not(.hud-role)') || ряд.querySelector('span'));
  return (t ? t.textContent : 'Цвет').replace(/[:\s]+$/, '').trim();
}
function закрыть(отменить) {
  if (!открыто) return;
  const { поле, исходное, окно } = открыто;
  if (отменить && поле.value !== исходное) { поле.value = исходное; поле.dispatchEvent(new Event('input', { bubbles: true })); }
  окно.remove();
  document.removeEventListener('keydown', открыто.клавиши, true);
  открыто = null;
}

export function открытьПалитру(поле) {
  закрыть(false);
  const ключ = поле.dataset.key;
  const исходное = поле.value;
  let { h, s, l } = hexВhsl(исходное);
  const окно = document.createElement('div');
  окно.className = 'hud-cp';
  окно.innerHTML = `<div class="hud-cp-panel" role="dialog" aria-label="Выбор цвета">
    <div class="hud-cp-head"><b>${подпись(поле).replace(/[<>&]/g, '')}</b><span class="hud-cp-was" title="Было — нажмите, чтобы вернуть"></span><span class="hud-cp-now"></span></div>
    <div class="hud-cp-preview"></div>
    <label class="hud-cp-strip is-h"><span>Тон</span><input type="range" min="0" max="360" step="1" data-cp="h"></label>
    <label class="hud-cp-strip is-s"><span>Насыщенность</span><input type="range" min="0" max="100" step="1" data-cp="s"></label>
    <label class="hud-cp-strip is-l"><span>Светлота</span><input type="range" min="0" max="100" step="1" data-cp="l"></label>
    <div class="hud-cp-row"><input type="text" class="hud-cp-hex" maxlength="7" spellcheck="false" aria-label="HEX"><div class="hud-cp-sw"></div></div>
    <div class="hud-cp-actions"><button type="button" class="hud-cp-cancel">Отмена</button><button type="button" class="hud-cp-ok">Готово</button></div>
  </div>`;
  document.body.appendChild(окно);
  const $ = (q) => окно.querySelector(q);

  // Предпросмотр
  const превью = $('.hud-cp-preview');
  const копия = копияПлашки(ключ);
  if (копия) превью.appendChild(копия);
  else превью.innerHTML = '<p class="hud-cp-empty">Предпросмотр появится, когда в чате будет карточка HUD.</p>';

  // Образцы: цвета текущей темы, затем общий набор.
  const свои = [...new Set(КЛЮЧИ_ТЕМЫ.map(k => String(settings[k] || '').toLowerCase()).filter(v => /^#[0-9a-f]{6}$/.test(v)))];
  $('.hud-cp-sw').innerHTML = [...свои.map(c => [c, 'из темы']), ...ОБРАЗЦЫ.filter(c => !свои.includes(c)).map(c => [c, ''])]
    .map(([c, т]) => `<button type="button" data-c="${c}" style="--c:${c}" title="${c}${т ? ' — ' + т : ''}"${т ? ' class="is-theme"' : ''}></button>`).join('');
  $('.hud-cp-was').style.background = исходное;

  const полосы = { h: $('[data-cp="h"]'), s: $('[data-cp="s"]'), l: $('[data-cp="l"]') };
  const hex = $('.hud-cp-hex');
  const показать = (писать = true) => {
    const цвет = hslВhex(h, s, l);
    полосы.h.value = h; полосы.s.value = s; полосы.l.value = l;
    окно.style.setProperty('--cp-h', h); окно.style.setProperty('--cp-s', s + '%'); окно.style.setProperty('--cp-l', l + '%');
    $('.hud-cp-now').style.background = цвет;
    if (document.activeElement !== hex) hex.value = цвет;
    if (писать && поле.value !== цвет) { поле.value = цвет; поле.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  for (const [к, п] of Object.entries(полосы)) п.addEventListener('input', () => { if (к === 'h') h = +п.value; else if (к === 's') s = +п.value; else l = +п.value; показать(); });
  hex.addEventListener('input', () => {
    const v = hex.value.trim().replace(/^([^#])/, '#$1');
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { ({ h, s, l } = hexВhsl(v)); показать(); }
  });
  $('.hud-cp-sw').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; ({ h, s, l } = hexВhsl(b.dataset.c)); показать(); });
  $('.hud-cp-was').addEventListener('click', () => { ({ h, s, l } = hexВhsl(исходное)); показать(); });
  $('.hud-cp-ok').addEventListener('click', () => закрыть(false));
  $('.hud-cp-cancel').addEventListener('click', () => закрыть(true));
  окно.addEventListener('click', (e) => { if (e.target === окно) закрыть(false); });
  const клавиши = (e) => { if (e.key === 'Escape') { e.stopPropagation(); закрыть(true); } else if (e.key === 'Enter' && e.target === hex) закрыть(false); };
  document.addEventListener('keydown', клавиши, true);
  открыто = { поле, исходное, окно, клавиши };
  показать(false);
  setTimeout(() => полосы.h.focus({ preventScroll: true }), 0);
}

// Клик по квадрату цвета в «Кастомизации» открывает эту палитру, а не
// системную. Зажатый Alt — системная, на всякий случай.
let подключено = false;
export function подключитьПалитру() {
  if (подключено) return;
  подключено = true;
  document.addEventListener('click', (e) => {
    const поле = e.target.closest && e.target.closest('input[type="color"].hud-theme-color-input');
    if (!поле || e.altKey) return;
    e.preventDefault();
    открытьПалитру(поле);
  }, true);
}
