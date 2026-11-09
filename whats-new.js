// hud-manager/whats-new.js
//
// Окно «Что нового»: после обновления HUD показывает изменения прямо в Таверне.
// Источник один — CHANGELOG.md и CHANGELOG.en.md: отдельный список пришлось бы
// вести руками и он бы отставал. Настройка whatsNewAuto выключает показ сам по
// себе, кнопка в настройках открывает окно в любой момент.

import { settings } from './settings.js?v=23.89.1';
import { английский, т } from './i18n.js?v=23.89.1';
import { escapeHtml } from './utils.js?v=23.89.1';

const ПОЛНЫХ_ВЕРСИЙ = 6;     // столько новых версий раскрыто сразу, если пропущено много
const ВЕРСИЙ_В_ОКНЕ = 40;    // остальная история — свёрнутыми строками
let сохранить = () => {};
let открыто = false;

/** Разбор CHANGELOG: [{ версия, дата, блоки: [{ заголовок, пункты: [{ текст, вложенные: [] }] }] }]. */
export function разобратьЧейнджлог(текст) {
  const версии = [];
  let версия = null, блок = null, пункт = null;
  const нужныйБлок = () => {
    if (!блок) { блок = { заголовок: '', пункты: [] }; версия.блоки.push(блок); }
    return блок;
  };
  for (const строка of String(текст || '').split(/\r?\n/)) {
    const в = строка.match(/^##\s+v?(\d+(?:\.\d+)+)\s*(?:[—–-]\s*(.+?))?\s*$/);
    if (в) { версия = { версия: в[1], дата: в[2] || '', блоки: [] }; версии.push(версия); блок = null; пункт = null; continue; }
    if (!версия) continue;
    const з = строка.match(/^###\s+(.+?)\s*$/);
    if (з) { блок = { заголовок: з[1], пункты: [] }; версия.блоки.push(блок); пункт = null; continue; }
    const п = строка.match(/^(\s*)[-*]\s+(.+?)\s*$/);
    if (п) {
      if (п[1].length >= 2 && пункт) пункт.вложенные.push(п[2]);
      else { пункт = { текст: п[2], вложенные: [] }; нужныйБлок().пункты.push(пункт); }
      continue;
    }
    // Продолжение пункта на следующей строке.
    if (строка.trim() && пункт) пункт.текст += ' ' + строка.trim();
  }
  return версии;
}

/** a новее b? Пустая версия старше любой. */
export function новееВерсия(a, b) {
  const ч = (s) => String(s || '').split('.').map(x => parseInt(x, 10) || 0);
  const А = ч(a), Б = ч(b);
  for (let i = 0; i < Math.max(А.length, Б.length); i++) {
    if ((А[i] || 0) !== (Б[i] || 0)) return (А[i] || 0) > (Б[i] || 0);
  }
  return false;
}

/** Какие версии раскрыть: всё новее виденной, а первый раз — только свежую. */
export function новыеВерсии(версии, виденная) {
  if (!виденная) return версии.slice(0, 1);
  const новые = версии.filter(в => новееВерсия(в.версия, виденная));
  return (новые.length ? новые : версии.slice(0, 1)).slice(0, ПОЛНЫХ_ВЕРСИЙ);
}

/** **жирный** и `код`; всё остальное экранируется. */
export function строкаВHTML(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function версияHTML(в) {
  const блоки = в.блоки.map(б => `${б.заголовок ? `<h4>${escapeHtml(б.заголовок)}</h4>` : ''}<ul>${б.пункты.map(п =>
    `<li>${строкаВHTML(п.текст)}${п.вложенные.length ? `<ul>${п.вложенные.map(x => `<li>${строкаВHTML(x)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`).join('');
  return блоки;
}
const подписьВерсии = (в) => `v${escapeHtml(в.версия)}${в.дата ? ` <small>${escapeHtml(в.дата)}</small>` : ''}`;

async function загрузить() {
  const файл = английский() ? 'CHANGELOG.en.md' : 'CHANGELOG.md';
  // Версия в адресе: после обновления браузер не отдаст старый файл из кэша.
  const адрес = new URL(файл, import.meta.url);
  адрес.searchParams.set('v', document.querySelector('script[src*="HUD/index.js"]')?.src.match(/[?&]v=([\d.]+)/)?.[1] || String(Date.now()));
  const ответ = await fetch(адрес.href);
  if (!ответ.ok) throw new Error('HTTP ' + ответ.status);
  return разобратьЧейнджлог(await ответ.text());
}

function нарисовать(версии, новые) {
  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay hud-whatsnew-overlay';
  const прошлые = версии.filter(в => !новые.includes(в)).slice(0, ВЕРСИЙ_В_ОКНЕ);
  overlay.innerHTML = `<div class="hud-modal hud-whatsnew" role="dialog" aria-modal="true" aria-label="${escapeHtml(т('Что нового'))}">
    <div class="hud-modal-head">${escapeHtml(т('Что нового в TavernOS HUD'))}</div>
    <div class="hud-modal-body" data-i18n-skip>
      ${новые.map(в => `<section class="hud-wn-version"><div class="hud-wn-badge">${подписьВерсии(в)}</div>${версияHTML(в)}</section>`).join('')}
      ${прошлые.length ? `<div class="hud-wn-past"><div class="hud-wn-past-title">${escapeHtml(т('Прошлые версии'))}</div>${прошлые.map(в => `<details><summary>${подписьВерсии(в)}</summary>${версияHTML(в)}</details>`).join('')}</div>` : ''}
    </div>
    <div class="hud-wn-foot">
      <label class="hud-wn-auto"><input type="checkbox" ${settings.whatsNewAuto !== false ? 'checked' : ''}><span>${escapeHtml(т('Показывать после обновлений'))}</span></label>
      <button type="button" class="hud-wn-close">${escapeHtml(т('Понятно'))}</button>
    </div>
  </div>`;
  const закрыть = () => { открыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише, true); };
  const поКлавише = (e) => { if (e.key === 'Escape') { e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поКлавише, true);
  // Закрываем, только если и нажали, и отпустили на затемнении: выделение текста не закрывает окно.
  let нажатоНаФоне = false;
  overlay.addEventListener('mousedown', (e) => { нажатоНаФоне = e.target === overlay; });
  overlay.addEventListener('click', (e) => { if (e.target === overlay && нажатоНаФоне) закрыть(); });
  overlay.querySelector('.hud-wn-close').addEventListener('click', закрыть);
  overlay.querySelector('.hud-wn-auto input').addEventListener('change', (e) => {
    settings.whatsNewAuto = e.target.checked;
    сохранить();
    const галка = document.getElementById('hud-whats-new-auto');
    if (галка) галка.checked = e.target.checked;
  });
  document.body.appendChild(overlay);
  overlay.querySelector('.hud-wn-close').focus({ preventScroll: true });
}

/** Открыть окно. виденная — версия, с которой считать новое; пусто — только свежая. */
export async function показатьЧтоНового(виденная = '') {
  if (открыто) return false;
  открыто = true;
  try {
    const версии = await загрузить();
    if (!версии.length) { открыто = false; return false; }
    нарисовать(версии, новыеВерсии(версии, виденная));
    return true;
  } catch (e) {
    открыто = false;
    console.warn('[TavernOS HUD] Что нового', e);
    return false;
  }
}

/** При запуске: версия сменилась — показать один раз. Не загрузилось — покажем в следующий запуск. */
export async function проверитьЧтоНового(версия, сохранитьНастройки) {
  if (typeof сохранитьНастройки === 'function') сохранить = сохранитьНастройки;
  if (!/^\d+(?:\.\d+)+$/.test(String(версия || '')) || settings.lastSeenVersion === версия) return;
  const виденная = settings.lastSeenVersion || '';
  if (settings.whatsNewAuto !== false && !(await показатьЧтоНового(виденная))) return;
  settings.lastSeenVersion = версия;
  сохранить();
}
