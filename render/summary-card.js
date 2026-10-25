// hud-manager/render/summary-card.js
//
// Сводка [HUD_SUMMARY] … [/HUD_SUMMARY] в тексте сообщения — карточкой.
//
// Сводку HUD сам пишет только в запрос модели, но в старых и вычищенных чатах
// она лежит прямо в ответах: «Понедельник, 25.10.2024 · 16:35 | вечер ·
// туман | Брэндон — коридор; Лейла — комната 308 | Событие: …». Строкой кода
// её трудно читать. Здесь она становится карточкой: дата, время и погода
// значками, люди по местам, событие и новое — отдельными строками.
//
// Только вид: текст сообщения не меняется (сводки — игрока, их не трогаем).
// Исходная строка хранится в карточке (data-raw) и возвращается, если показ
// выключить (настройка summaryCards). Если в том же сообщении есть полная
// карточка HUD, нажатие на сводку раскрывает её.

import { escapeHtml } from '../utils.js?v=23.79.2';
import { значокЧасов, значокПогоды, значокДаты } from './topbar-icons.js?v=23.79.2';
import { settings } from '../settings.js?v=23.79.2';

const ОТКРЫТЬ = '[HUD_SUMMARY]', ЗАКРЫТЬ = '[/HUD_SUMMARY]';
// Граница слова — через \p{L}: \b в JS кириллицу словом не считает.
const ЧАСТЬ_СУТОК = /^(утро|утром|день|днём|днем|вечер|вечером|ночь|ночью|полдень|полночь|рассвет|закат|сумерки|morning|day|afternoon|evening|night|dawn|dusk)(?![\p{L}])/iu;

// --- Разбор -------------------------------------------------------------------
/**
 * Строка сводки → { дата, время, сутки, погода, люди: [{ место, кто: [{ имя, точка }] }],
 * событие, новое, одежда: [{ имя, что }], прочее: [] }.
 */
export function разобратьСводку(текст) {
  let s = String(текст || '').trim();
  if (s.startsWith(ОТКРЫТЬ)) s = s.slice(ОТКРЫТЬ.length);
  if (s.endsWith(ЗАКРЫТЬ)) s = s.slice(0, -ЗАКРЫТЬ.length);
  const о = { дата: '', время: '', сутки: '', погода: '', люди: [], событие: '', новое: '', одежда: [], прочее: [] };
  // Старый формат, с метками: «Дата: Четверг, 07.11.2024. Время: 17:40 |
  // Вечер. Погода: 0°C, снег. Tristan (Возраст: 24, …, Место: спальня); User (…)».
  // Тот же формат по-английски: «Date: … Time: … | Evening. Weather: … Tristan (Age: 24, …, Location: bedroom)».
  if (/(?<![\p{L}])(?:Дата|Date):/u.test(s)) {
    const м = (re) => { const x = s.match(re); return x ? x[1].trim() : ''; };
    о.дата = м(/(?:Дата|Date):\s*(.+?)\.\s*(?=Время:|Time:|\||$)/);
    о.время = м(/(?:Время|Time):\s*(\d{1,2}:\d{2})/);
    о.сутки = м(/\|\s*([\p{L}]+)\.\s*(?=Погода:|Weather:)/u);
    о.погода = м(/(?:Погода|Weather):\s*(.+?)\.\s+(?=[^.;()]+\((?:[^()]*?)(?:Возраст|Место|Age|Location|Place)\s*:)/) || м(/(?:Погода|Weather):\s*([^.]+)/);
    const игрок = (() => { try { return window.SillyTavern?.getContext?.()?.name1 || ''; } catch (_) { return ''; } })();
    for (const x of s.matchAll(/(?:^|;\s*|\.\s+)([^.;()]+?)\s*\(([^()]*)\)/g)) {
      const внутри = x[2];
      const место = (внутри.match(/(?:Место|Location|Place):\s*(.+)$/) || [])[1];
      if (!место && !/(?:Возраст|Age):/.test(внутри)) continue;
      const имя = x[1].trim() === 'User' && игрок ? игрок : x[1].trim();
      о.люди.push({ место: (место || '').trim(), кто: [{ имя, точка: '' }] });
    }
    return о;
  }
  const части = s.split(/\s+\|\s+/).map(x => x.trim()).filter(Boolean);
  части.forEach((ч, i) => {
    let m;
    if ((m = ч.match(/^(?:Событие|Event):\s*(.+)$/i))) { о.событие = m[1]; return; }
    if ((m = ч.match(/^(?:Новое|New):\s*(.+)$/i))) { о.новое = m[1]; return; }
    if ((m = ч.match(/^(?:Одежда|Clothes|Clothing|Outfits?):\s*(.+)$/i))) { о.одежда = m[1].split(/;\s*/).map(x => { const k = x.indexOf(':'); return k > 0 ? { имя: x.slice(0, k).trim(), что: x.slice(k + 1).trim() } : { имя: '', что: x.trim() }; }).filter(x => x.что); return; }
    // Шапка: «дата · время · погода» — первая часть с датой или временем.
    if (i === 0 && /\d{1,2}[.:/]\d{2}|\d{1,2}\s+[а-яё]{3,}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(ч)) {
      const куски = ч.split(/\s+·\s+/);
      for (const к of куски) {
        if (!о.время && /^\d{1,2}:\d{2}/.test(к)) о.время = к;
        else if (!о.дата && /\d{1,2}[./]\d{1,2}|\d{1,2}\s+[а-яё]{3,}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(к)) о.дата = к;
        else о.погода = о.погода ? о.погода + ', ' + к : к;
      }
      return;
    }
    // «вечер · туман» — время суток из поля времени («16:35 | вечер»), за ним погода.
    if (ЧАСТЬ_СУТОК.test(ч) && !о.сутки && !/\s—\s/.test(ч)) {
      const [сутки, ...погода] = ч.split(/\s+·\s+/);
      о.сутки = сутки.trim();
      if (погода.length) о.погода = о.погода ? о.погода + ', ' + погода.join(', ') : погода.join(', ');
      return;
    }
    // Люди: «Имя — место; Имя, Имя — место; Общее место: Имя (точка), Имя».
    if (/\s—\s|:\s*\S/.test(ч)) {
      const группы = ч.split(/;\s*/).map(г => г.trim()).filter(Boolean);
      const люди = [];
      for (const г of группы) {
        let mm;
        if ((mm = г.match(/^(.+?)\s—\s(.+)$/))) люди.push({ место: mm[2].trim(), кто: mm[1].split(/,\s*/).map(имя => ({ имя: имя.trim(), точка: '' })) });
        else if ((mm = г.match(/^([^:]{2,80}):\s*(.+)$/))) люди.push({ место: mm[1].trim(), кто: mm[2].split(/,\s*(?![^()]*\))/).map(x => { const t = x.match(/^(.+?)\s*\((.+)\)\s*$/); return t ? { имя: t[1].trim(), точка: t[2].trim() } : { имя: x.trim(), точка: '' }; }) });
        else люди.push({ место: '', кто: [{ имя: г, точка: '' }] });
      }
      if (люди.length) { о.люди.push(...люди); return; }
    }
    о.прочее.push(ч);
  });
  return о;
}

// Погода по словам — тем же видам, что у шапки карточки (weather-*).
export function видПогоды(текст) {
  const t = String(текст || '').toLowerCase();
  if (/гроз|молни|storm|thunder/.test(t)) return 'weather-storm';
  if (/град|hail/.test(t)) return 'weather-hail';
  if (/снег|метел|вьюг|snow|blizzard/.test(t)) return 'weather-snow';
  if (/дожд|ливн|ливен|морос|rain|drizzle|shower/.test(t)) return 'weather-rain';
  if (/туман|дымк|мгл|fog|mist|haze/.test(t)) return 'weather-fog';
  if (/ветер|ветр|бриз|шторм|wind|breeze|gust/.test(t)) return 'weather-wind';
  if (/облач|пасмур|туч|хмур|cloud|overcast/.test(t)) return 'weather-cloudy';
  return 'weather-clear';
}
function фазаСуток(время, сутки) {
  const с = String(сутки || '').toLowerCase();
  if (/ноч|полноч|night/.test(с)) return 'phase-night';
  const m = String(время || '').match(/(\d{1,2}):/);
  if (m) { const h = +m[1]; return h < 5 || h >= 22 ? 'phase-night' : h < 11 ? 'phase-morning' : h < 18 ? 'phase-day' : 'phase-evening'; }
  return /вечер|evening|закат|сумерк/.test(с) ? 'phase-evening' : 'phase-day';
}

// --- Событие хода ---------------------------------------------------------------
// «25.10, 16:32 - Брэндон видит шрамы» → когда отдельно, что — отдельно.
export function разобратьСобытие(текст) {
  const s = String(текст || '').trim();
  const m = s.match(/^((?:\d{1,2}\.\d{1,2}(?:\.\d{2,4})?,?\s*)?\d{1,2}:\d{2})\s*[-—–]\s*(.+)$/);
  if (!m) return { когда: '', что: s };
  const [, когда, что] = m;
  const t = когда.match(/(\d{1,2}:\d{2})/)[1], д = (когда.match(/^(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)/) || [])[1] || '';
  return { когда: д ? `${t} · ${д}` : t, время: t, что: что.trim() };
}
// Событие — отдельным блоком: значок-искра, время над текстом, сам текст
// крупнее и курсивом, как запись в хронике.
const ИСКРА = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/><circle cx="12" cy="12" r="1.6"/></svg>';
function событиеХода(текст) {
  if (!текст) return '';
  const с = разобратьСобытие(текст);
  return `<div class="hud-sum-event"><span class="hud-sum-event-ico">${ИСКРА}</span><div class="hud-sum-event-body"><span class="hud-sum-event-when">Событие${с.когда ? ` · ${escapeHtml(с.когда)}` : ''}</span><p>${escapeHtml(с.что)}</p></div></div>`;
}

// --- Карточка -------------------------------------------------------------------
/** Разметка карточки сводки. можноОткрыть — в сообщении есть полная карточка HUD. */
export function карточкаСводки(текст, можноОткрыть = false) {
  const о = разобратьСводку(текст);
  const чип = (значок, т) => `<span class="hud-sum-chip">${значок}<span>${escapeHtml(т)}</span></span>`;
  const погодаТекст = [о.сутки, о.погода].filter(Boolean).join(' · ');
  const шапка = [
    о.дата ? чип(значокДаты(), о.дата) : '',
    о.время ? чип(значокЧасов(о.время), о.время) : '',
    погодаТекст ? чип(значокПогоды(видПогоды(погодаТекст), фазаСуток(о.время, о.сутки)), погодаТекст) : '',
  ].join('');
  // Один человек — имя, под ним место. Несколько в одном месте — место
  // заголовком, под ним люди со своей точкой.
  const люди = о.люди.map(г => г.кто.length === 1
    ? `<li class="hud-sum-place is-one"><b>${escapeHtml(г.кто[0].имя)}</b>${г.место || г.кто[0].точка ? `<span class="hud-sum-where">${escapeHtml([г.место, г.кто[0].точка].filter(Boolean).join(', '))}</span>` : ''}</li>`
    : `<li class="hud-sum-place">${г.место ? `<span class="hud-sum-where is-head">${escapeHtml(г.место)}</span>` : ''}${г.кто.map(ч => `<span class="hud-sum-who"><b>${escapeHtml(ч.имя)}</b>${ч.точка ? `<small>${escapeHtml(ч.точка)}</small>` : ''}</span>`).join('')}</li>`).join('');
  const строка = (метка, т, класс) => т ? `<p class="hud-sum-line ${класс}"><i>${метка}</i><span>${escapeHtml(т)}</span></p>` : '';
  const одежда = о.одежда.length ? `<p class="hud-sum-line is-wear"><i>Одежда</i><span>${о.одежда.map(x => (x.имя ? `<b>${escapeHtml(x.имя)}</b> ` : '') + escapeHtml(x.что)).join('<br>')}</span></p>` : '';
  const прочее = о.прочее.map(т => `<p class="hud-sum-line is-other"><span>${escapeHtml(т)}</span></p>`).join('');
  const открыть = можноОткрыть ? '<span class="hud-sum-open">открыть полный HUD<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>' : '';
  return `<div class="hud-sum${можноОткрыть ? ' can-open' : ''}" data-raw="${escapeHtml(String(текст || '').trim())}"${можноОткрыть ? ' role="button" tabindex="0" title="Сводка хода — нажмите, чтобы открыть полный HUD этого сообщения"' : ' title="Сводка хода (полного HUD в этом сообщении нет)"'}>`
    + `<div class="hud-sum-head"><span class="hud-sum-label">Сводка хода</span>${шапка}</div>`
    + (люди ? `<ul class="hud-sum-people">${люди}</ul>` : '')
    + событиеХода(о.событие) + строка('Новое', о.новое, 'is-new') + одежда + прочее + открыть
    + `</div>`;
}

// --- В сообщении --------------------------------------------------------------
const вКарточке = (узел) => !!(узел && узел.closest && узел.closest('.hud-os-card, .hud-sum'));

/**
 * Сводки в тексте сообщения — карточками. Сводка должна лежать в одном
 * абзаце (так её пишут); разорванную по абзацам оставляем как есть.
 * Повторный вызов ничего не делает: исходного текста сводки в DOM уже нет.
 */
export function оформитьСводки(messageElement) {
  const текст = messageElement && messageElement.querySelector && messageElement.querySelector('.mes_text');
  if (!текст || settings.summaryCards === false) return 0;
  if (!(текст.textContent || '').includes(ОТКРЫТЬ)) return 0;
  const можноОткрыть = !!текст.querySelector('.hud-os-card');
  let сделано = 0;
  for (let попытка = 0; попытка < 20; попытка++) {
    const ход = document.createTreeWalker(текст, NodeFilter.SHOW_TEXT);
    let узел = null;
    while ((узел = ход.nextNode()) && !(узел.textContent.includes(ОТКРЫТЬ) && !вКарточке(узел.parentElement))) {}
    if (!узел) break;
    const абзац = узел.parentElement.closest('p, li, blockquote, div') || узел.parentElement;
    if (!текст.contains(абзац) || абзац === текст) break;
    const весь = абзац.textContent;
    const a = весь.indexOf(ОТКРЫТЬ), b = весь.indexOf(ЗАКРЫТЬ, a);
    if (b < 0) break;
    const сводка = весь.slice(a, b + ЗАКРЫТЬ.length);
    const до = весь.slice(0, a).trim(), после = весь.slice(b + ЗАКРЫТЬ.length).trim();
    const обёртка = document.createElement('div');
    обёртка.innerHTML = карточкаСводки(сводка, можноОткрыть);
    const карточка = обёртка.firstElementChild;
    // Текст вокруг сводки в том же абзаце остаётся на месте (без
    // оформления внутри абзаца — сводка обычно стоит одна).
    if (до) { const п = document.createElement(абзац.tagName === 'LI' ? 'p' : абзац.tagName); п.textContent = до; абзац.before(п); }
    if (после) { const п = document.createElement(абзац.tagName === 'LI' ? 'p' : абзац.tagName); п.textContent = после; абзац.after(п); }
    абзац.replaceWith(карточка);
    сделано++;
  }
  return сделано;
}

/** Показ сводок выключили — вернуть исходные строки. */
export function вернутьСводкиТекстом(корень = document) {
  корень.querySelectorAll('.hud-sum[data-raw]').forEach(к => { const п = document.createElement('p'); п.textContent = к.dataset.raw; к.replaceWith(п); });
}

/** Нажатие на сводку: раскрыть полную карточку HUD того же сообщения. */
export function открытьПолныйHUD(сводка) {
  const mes = сводка && сводка.closest('.mes');
  const карточка = mes && mes.querySelector('.hud-os-card');
  if (!карточка) return false;
  const галка = карточка.querySelector('.hud-toggle-input');
  if (галка && !галка.checked) галка.click();
  карточка.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
