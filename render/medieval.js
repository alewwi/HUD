// hud-manager/render/medieval.js
//
// Средневековая пара вместо телефона и перехватов (настройка «Эпоха»).
//
// Шкатулка персонажа — то, что человек без телефона держит при себе и в
// дорожном ларце: письма с печатями, святцы, кошель с монетами и приходная
// книга, записи пером, карта, грамоты и памятные вещи.
//
// Подслушанное — чужие разговоры, услышанные сквозь стену или пересказанные
// слугой, и чужие письма, вскрытые горячим ножом.
//
// Переключение разделов шкатулки — на радиокнопках и CSS, без скриптов:
// карточка HUD перерисовывается целиком, и состояние не нужно восстанавливать.

import { escapeHtml, defeatWI, hudHashSeed, hudHasMeaningfulValue } from '../utils.js?v=23.13.2';
import { settings } from '../settings.js?v=23.13.2';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=23.13.2';
import { namesLikelySame } from '../names.js?v=23.13.2';
import { buildCalendarApp, parseDayMonth } from './phone.js?v=23.13.2';

const т = (v) => defeatWI(escapeHtml(String(v ?? '')));

function пусто(значок, текст) {
  return `<div class="hud-cask-empty"><span>${значок}</span>${escapeHtml(текст)}</div>`;
}

// --- Письма ------------------------------------------------------------------

// Цвет сургуча: из описания печати, иначе — по отправителю.
const ВОСК = [
  [/красн|алый|багр|кровав|red|scarlet|crimson/i, '#8e1b1b'],
  [/чёрн|черн|black/i, '#231e1e'],
  [/зел[её]н|green/i, '#2f5a2c'],
  [/син|голуб|blue/i, '#23406e'],
  [/золот|ж[её]лт|gold|yellow/i, '#a8801f'],
  [/пурпур|фиолет|лилов|purple|violet/i, '#5a2466'],
  [/коричн|бур|brown/i, '#5a3a1f'],
];
const ВОСК_ЗАПАС = ['#8e1b1b', '#2f5a2c', '#23406e', '#5a2466', '#a8801f', '#5a3a1f'];
export function цветВоска(печать, кто) {
  const найдено = ВОСК.find(([re]) => re.test(String(печать || '')));
  return найдено ? найдено[1] : ВОСК_ЗАПАС[hudHashSeed(String(кто || печать || 'x')) % ВОСК_ЗАПАС.length];
}

const СТАТУС_ПИСЬМА = [
  [/seal|запеч|не вскр|unopen/i, 'sealed', 'Печать не сломана'],
  [/draft|черн/i, 'draft', 'Черновик'],
  [/transit|в пути|везёт|везет|courier|гонец/i, 'transit', 'В пути'],
  [/sent|отправ/i, 'sent', 'Отправлено'],
  [/burn|сожж|сжёг|сжег|пепел/i, 'burned', 'Сожжено'],
  [/hid|спрят|тайник/i, 'hidden', 'Спрятано'],
  [/read|прочит|вскрыт|open/i, 'read', 'Прочитано'],
];
export function статусПисьма(st) {
  const найдено = СТАТУС_ПИСЬМА.find(([re]) => re.test(String(st || '')));
  return найдено ? { ключ: найдено[1], текст: найдено[2] } : { ключ: 'read', текст: '' };
}

function печать(цвет, буква, класс = '') {
  return `<span class="hud-seal ${класс}" style="--wax:${цвет}" aria-hidden="true"><b>${escapeHtml(буква)}</b></span>`;
}
const первая = (имя) => (String(имя || '').replace(/[^\p{L}]/gu, '').charAt(0) || '✦').toUpperCase();

function buildLetters(letters, owner) {
  if (!letters || !letters.length) return пусто('✉️', 'Писем нет — никто не писал');
  return `<div class="hud-letters">` + letters.map(l => {
    const с = статусПисьма(l.status);
    const исходящее = owner && l.from && namesLikelySame(l.from, owner);
    const цвет = цветВоска(l.seal, l.from);
    const абзацы = String(l.text || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => `<p>${т(x)}</p>`).join('');
    const запечатано = с.ключ === 'sealed';
    // Адресат во входящем нужен, только если письмо не самому владельцу.
    const чужойАдресат = !исходящее && l.to && !(owner && namesLikelySame(l.to, owner)) ? l.to : '';
    return `<details class="hud-letter st-${с.ключ} ${исходящее ? 'is-out' : 'is-in'}"${запечатано ? '' : ' open'}>
      <summary class="hud-letter-head">
        ${печать(цвет, первая(l.from), запечатано ? 'is-whole' : 'is-broken')}
        <span class="hud-letter-who">
          <b>${исходящее ? 'Кому: ' + т(l.to || '—') : 'От: ' + т(l.from || 'неизвестного')}</b>
          ${l.seal ? `<small>${т(l.seal)}</small>` : ''}
        </span>
        <span class="hud-letter-side">
          ${с.текст ? `<i class="hud-letter-st">${escapeHtml(с.текст)}</i>` : ''}
          ${l.time ? `<small>${т(l.time)}</small>` : ''}
        </span>
      </summary>
      <div class="hud-letter-sheet">
        ${запечатано ? '<div class="hud-letter-opened">Печать сломана</div>' : ''}
        ${абзацы || '<p class="hud-letter-blank">Лист чист.</p>'}
        ${чужойАдресат || l.via ? `<footer>${чужойАдресат ? `Адресат: ${т(чужойАдресат)}` : ''}${l.via ? `${чужойАдресат ? ' · ' : ''}С кем: ${т(l.via)}` : ''}</footer>` : ''}
      </div>
    </details>`;
  }).join('') + `</div>`;
}

// --- Кошель ------------------------------------------------------------------

const МЕТАЛЛ = [
  [/зол|gold|дукат|флорин|гине|соверен|цехин|эскудо|луидор|ноб(?:ль|л)|безант/i, 'gold', 'зол'],
  [/сер|silver|шилл|талер|денар|денье|драхм|марк|крон|гривн|ливр|рубл/i, 'silver', 'сер'],
  [/мед|copper|пенн|пенс|медяк|полушк|фартинг|грош|пул|обол|бронз|дени?г/i, 'copper', 'мед'],
];
// «3 зол, 14 сер, 27 мед» → монеты по металлам. Одно число — металл по валюте.
export function разобратьМонеты(баланс, валюта) {
  const s = String(баланс || '');
  const out = [];
  const re = /(\d[\d\s]*)\s*([\p{L}.]+)?/gu;
  let m;
  while ((m = re.exec(s))) {
    const n = Number(m[1].replace(/\s/g, ''));
    if (!Number.isFinite(n)) continue;
    const слово = (m[2] || '') + ' ' + (m[2] ? '' : валюта || '');
    const мет = МЕТАЛЛ.find(([r]) => r.test(слово));
    out.push({ n, metal: мет ? мет[1] : 'silver', label: m[2] || валюта || '' });
  }
  return out;
}

function buildPurse(wallet) {
  const w = wallet || {};
  const tx = Array.isArray(w.transactions) ? w.transactions : [];
  if (!w.balance && !tx.length) return пусто('💰', 'Кошель пуст и приходная книга чиста');
  const монеты = разобратьМонеты(w.balance, w.currency);
  // Стопка растёт медленнее суммы: 3 монеты — три кружка, 300 — десять.
  const стопки = монеты.map(м => {
    const выс = Math.max(1, Math.min(10, Math.round(Math.log2(м.n + 1) * 1.6)));
    return `<span class="hud-coins m-${м.metal}" title="${escapeHtml(м.n + ' ' + м.label)}">
      <span class="hud-coins-stack">${'<i></i>'.repeat(выс)}</span>
      <b>${escapeHtml(String(м.n))}</b><small>${escapeHtml(м.label)}</small>
    </span>`;
  }).join('');
  const строки = tx.map(x => {
    const сумма = String(x.amount || '').trim();
    const расход = /^[-−–]/.test(сумма);
    return `<div class="hud-ledger-row ${расход ? 'is-out' : 'is-in'}">
      <span class="hud-ledger-what">${т(x.title || 'Запись')}${x.note ? `<small>${т(x.note)}</small>` : ''}</span>
      <span class="hud-ledger-sum">${escapeHtml(сумма)}</span>
      ${x.time ? `<span class="hud-ledger-when">${т(x.time)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="hud-purse">
    <div class="hud-purse-bag">
      <span class="hud-purse-sack" aria-hidden="true"></span>
      <div class="hud-purse-coins">${стопки || `<span class="hud-purse-raw">${т(w.balance)}</span>`}</div>
      ${w.currency ? `<small class="hud-purse-cur">${т(w.currency)}</small>` : ''}
    </div>
    <div class="hud-ledger">
      <div class="hud-ledger-title">Приходно-расходная книга</div>
      ${строки || '<div class="hud-ledger-row is-none">Ни одной монеты не ушло и не пришло</div>'}
    </div>
  </div>`;
}

// --- Святцы: календарь с фазой луны -------------------------------------------

const ФАЗЫ = ['Новолуние', 'Молодой месяц', 'Первая четверть', 'Растущая луна', 'Полнолуние', 'Убывающая луна', 'Последняя четверть', 'Старый месяц'];
export function фазаЛуны(d, mo, y) {
  const дата = Date.UTC(y, mo - 1, d, 12);
  const синод = 29.530588853;
  const дни = (дата - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  const возраст = ((дни % синод) + синод) % синод;
  return { возраст, имя: ФАЗЫ[Math.floor(((возраст / синод) * 8) + .5) % 8], доля: возраст / синод };
}

function buildAlmanac(events, characters, sceneDate) {
  const cal = buildCalendarApp(events, characters, sceneDate);
  const дм = parseDayMonth(sceneDate);
  let луна = '';
  if (дм) {
    const ф = фазаЛуны(дм.d, дм.mo, дм.y || new Date().getFullYear());
    // Тень на диске: освещённая доля от 0 до 1 и обратно, сторона — по фазе.
    const свет = (1 - Math.cos(ф.доля * 2 * Math.PI)) / 2;
    луна = `<div class="hud-almanac-moon"><span class="hud-moon-disc" style="--lit:${свет.toFixed(2)}; --side:${ф.доля < .5 ? 1 : -1}"></span>${escapeHtml(ф.имя)}</div>`;
  }
  return `<div class="hud-almanac">${луна}${cal}</div>`;
}

// --- Записи, карта, грамоты, памятки ------------------------------------------

function buildNotes(notes) {
  if (!notes || !notes.length) return пусто('🪶', 'Перо сухое — записей нет');
  return notes.map(n => {
    const текст = String(n.text || '').trim();
    // Буквица — только из буквы: эмодзи (два кода UTF-16) charAt разрезал
    // пополам, а кавычка или цифра в буквице смотрятся опечаткой.
    const буквица = /^\p{L}/u.test(текст) ? Array.from(текст)[0] : '';
    return `<article class="hud-quill-note">
      <header><b>${т(n.title || 'Без заглавия')}</b>${n.time ? `<small>${т(n.time)}</small>` : ''}</header>
      ${текст ? `<p>${буквица ? `<span class="hud-dropcap">${escapeHtml(буквица)}</span>` : ''}${т(текст.slice(буквица.length))}</p>` : ''}
      ${n.footer ? `<footer>${т(n.footer)}</footer>` : ''}
    </article>`;
  }).join('');
}

function buildMap(maps) {
  if (!maps || !maps.length) return пусто('🗺️', 'На карте ни одной отметки');
  const W = 320, H = 190, n = maps.length;
  // Точки по порядку дороги слева направо, высота — из имени места: одна и та
  // же карта из хода в ход.
  const точки = maps.map((m, i) => {
    const h = hudHashSeed(String(m.place || i));
    const x = n === 1 ? W / 2 : 34 + (i / (n - 1)) * (W - 68);
    const y = 38 + (h % 110);
    return { x, y, m, h };
  });
  let путь = `M${точки[0].x.toFixed(1)} ${точки[0].y.toFixed(1)}`;
  for (let i = 1; i < точки.length; i++) {
    const a = точки[i - 1], b = точки[i];
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + ((b.h % 2) ? -22 : 22);
    путь += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  // Горы и лес — украшение, тоже из имён мест.
  const сид = hudHashSeed(maps.map(m => m.place).join('|'));
  let горы = '', лес = '';
  for (let i = 0; i < 5; i++) {
    const x = 20 + ((сид >>> (i * 3)) % 280), y = 20 + ((сид >>> (i * 2 + 1)) % 150);
    if (точки.some(p => Math.abs(p.x - x) < 26 && Math.abs(p.y - y) < 22)) continue;
    if (i % 2) горы += `<path d="M${x - 9} ${y + 6} L${x} ${y - 7} L${x + 9} ${y + 6} M${x - 2} ${y - 3} L${x + 3} ${y + 1}"/>`;
    else лес += `<path d="M${x} ${y + 6} v-4 M${x - 5} ${y + 2} l5 -9 l5 9 z M${x + 8} ${y + 7} v-3 M${x + 4} ${y + 4} l4 -7 l4 7 z"/>`;
  }
  const метки = точки.map((p, i) => `<g class="hud-map-pt${i === n - 1 ? ' is-last' : ''}">
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === n - 1 ? 5 : 3.6}"/>
      <text x="${p.x.toFixed(1)}" y="${(p.y + (p.y > 150 ? -10 : 16)).toFixed(1)}" text-anchor="${p.x > W - 80 ? 'end' : p.x < 80 ? 'start' : 'middle'}" dx="${p.x > W - 80 ? 6 : p.x < 80 ? -6 : 0}">${escapeHtml(String(p.m.place || '').slice(0, 22))}</text>
    </g>`).join('');
  const роза = `<g class="hud-map-rose" transform="translate(${W - 24} 24)"><circle r="11"/><path d="M0 -15 L3 0 L0 15 L-3 0 Z"/><path d="M-15 0 L0 3 L15 0 L0 -3 Z" opacity=".55"/><text y="-17" text-anchor="middle">С</text></g>`;
  const список = maps.map((m, i) => `<div class="hud-map-row"><b>${i + 1}</b><span>${т(m.place || 'Место')}${m.note ? `<small>${т(m.note)}</small>` : ''}</span></div>`).join('');
  return `<div class="hud-parch-map">
    <svg viewBox="0 0 ${W} ${H}" class="hud-map-svg" role="img" aria-label="Карта">
      <g class="hud-map-deco">${горы}${лес}</g>
      <path class="hud-map-road" d="${путь}"/>
      ${метки}${роза}
    </svg>
    <div class="hud-map-list">${список}</div>
  </div>`;
}

const ВИД_ГРАМОТЫ = [
  [/charter|жалован|грамот/i, 'Жалованная грамота'], [/pass|пропуск|охран|conduct/i, 'Охранная грамота'],
  [/debt|долг|расписк/i, 'Долговая расписка'], [/writ|указ|приказ|приговор|warrant|ордер/i, 'Указ'],
  [/contract|договор|брачн|сговор/i, 'Договор'], [/will|завещ/i, 'Завещание'],
];
const СТАТУС_ГРАМОТЫ = [
  [/forg|подд|фальш/i, 'forged', 'Подделка'], [/expir|просроч|истёк|истек/i, 'expired', 'Истекла'],
  [/revok|отозв|отмен|аннул/i, 'revoked', 'Отозвана'], [/valid|действ|в силе/i, 'valid', 'В силе'],
];
function buildDocs(docs) {
  if (!docs || !docs.length) return пусто('📜', 'Ни одной бумаги с печатью');
  return `<div class="hud-docs">` + docs.map(d => {
    const вид = (ВИД_ГРАМОТЫ.find(([re]) => re.test(d.kind || '')) || [, d.kind || 'Бумага'])[1];
    const ст = СТАТУС_ГРАМОТЫ.find(([re]) => re.test(d.status || ''));
    return `<div class="hud-doc${ст ? ' st-' + ст[1] : ''}">
      <div class="hud-doc-kind">${т(вид)}</div>
      <b class="hud-doc-title">${т(d.title || 'Без заглавия')}</b>
      ${d.text ? `<p>${т(d.text)}</p>` : ''}
      <div class="hud-doc-foot">
        ${d.seal ? `<span class="hud-doc-seal">${печать(цветВоска(d.seal, d.title), первая(d.seal), 'is-hanging')}<small>${т(d.seal)}</small></span>` : '<span></span>'}
        ${ст ? `<i class="hud-doc-stamp">${escapeHtml(ст[2])}</i>` : ''}
      </div>
    </div>`;
  }).join('') + `</div>`;
}

const ЗНАК_ПАМЯТКИ = [
  [/кольц|перстен|ring/i, '💍'], [/цвет|роз|лилия|фиалк|засуш|flower|rose/i, '🥀'], [/локон|прядь|волос|hair/i, '➰'],
  [/лент|ribbon|платок|шарф|кружев/i, '🎀'], [/кинжал|нож|меч|клинок|dagger|sword/i, '🗡️'], [/монет|coin/i, '🪙'],
  [/медальон|кулон|locket|амулет|оберег|чётк|четк|крест/i, '📿'], [/письм|записк|letter/i, '✉️'], [/перо|feather/i, '🪶'],
  [/ключ|key/i, '🗝️'], [/мощ|реликв|relic/i, '✝️'], [/портрет|миниатюр/i, '🖼️'],
];
function buildKeeps(keeps) {
  if (!keeps || !keeps.length) return пусто('🎀', 'Памятных вещей нет');
  return `<div class="hud-keeps">` + keeps.map(k => {
    const знак = (ЗНАК_ПАМЯТКИ.find(([re]) => re.test((k.title || '') + ' ' + (k.desc || ''))) || [, '✦'])[1];
    return `<div class="hud-keep">
      <span class="hud-keep-icon">${знак}</span>
      <b>${т(k.title || 'Вещица')}</b>
      ${k.desc ? `<p>${т(k.desc)}</p>` : ''}
      ${k.from ? `<small>от ${т(k.from)}</small>` : ''}
    </div>`;
  }).join('') + `</div>`;
}

// --- Шкатулка целиком -----------------------------------------------------------

export function hudHasCasket(satchel, letters) {
  const s = satchel || {};
  return (Array.isArray(letters) && letters.length > 0)
    || ['notes', 'maps', 'documents', 'keepsakes', 'calendar'].some(k => Array.isArray(s[k]) && s[k].length)
    || Boolean(s.wallet && (s.wallet.balance || (s.wallet.transactions || []).length));
}

export function buildCasketHTML(satchel, letters, uid, isChecked, fallbackOwner, sceneDate, characters) {
  const s = satchel && typeof satchel === 'object' ? satchel : {};
  const owner = (s.owner && !/^(empty|none)$/i.test(s.owner) ? s.owner : '') || fallbackOwner || '';
  const on = (k) => settings[k] !== false;
  const нераспечатано = (letters || []).filter(l => статусПисьма(l.status).ключ === 'sealed').length;
  const разделы = [
    on('castAppLetters') && { id: 'letters', icon: '✉️', label: 'Письма', badge: нераспечатано, body: buildLetters(letters, owner) },
    on('castAppCalendar') && { id: 'almanac', icon: '📅', label: 'Святцы', body: buildAlmanac(s.calendar, characters, sceneDate) },
    on('castAppPurse') && { id: 'purse', icon: '💰', label: 'Кошель', body: buildPurse(s.wallet) },
    on('castAppNotes') && { id: 'notes', icon: '🪶', label: 'Записи', body: buildNotes(s.notes) },
    on('castAppMap') && { id: 'map', icon: '🗺️', label: 'Карта', body: buildMap(s.maps) },
    on('castAppDocs') && { id: 'docs', icon: '📜', label: 'Грамоты', body: buildDocs(s.documents) },
    on('castAppKeeps') && { id: 'keeps', icon: '🎀', label: 'Памятки', body: buildKeeps(s.keepsakes) },
  ].filter(Boolean);
  if (!разделы.length) return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">${пусто('🗝️', 'Все разделы шкатулки выключены в настройках')}</div>`;
  const имя = `cask-${uid}`;
  const радио = разделы.map((р, i) => `<input type="radio" class="hud-cask-radio" name="${имя}" id="${имя}-${р.id}"${i === 0 ? ' checked' : ''}>`).join('');
  const вкладки = разделы.map(р => `<label class="hud-cask-tab" for="${имя}-${р.id}"><span>${р.icon}</span>${escapeHtml(р.label)}${р.badge ? `<i class="hud-cask-badge">${р.badge}</i>` : ''}</label>`).join('');
  const виды = разделы.map(р => `<section class="hud-cask-view" data-cask-view="${р.id}">${р.body}</section>`).join('');
  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">
    <div class="hud-cask">
      ${радио}
      <div class="hud-cask-lid"><span class="hud-cask-lock" aria-hidden="true"></span><b>Шкатулка</b>${owner ? `<small>${т(owner)}</small>` : ''}</div>
      <nav class="hud-cask-tabs">${вкладки}</nav>
      <div class="hud-cask-views">${виды}</div>
    </div>
  </div>`;
}

// --- Подслушанное -----------------------------------------------------------------

// «[неразборчиво]», «[...]», «…» в квадратных скобках — провал в услышанном.
const ПРОВАЛ = /\[(?:неразборчиво|не расслышать|не слышно|inaudible|\.{2,}|…)[^\]]*\]/gi;
function реплика(строка) {
  const s = String(строка || '').split('|')[0].trim();
  const m = s.match(/^([^:]{1,40}):\s*([\s\S]*)$/);
  const кто = m ? m[1].trim() : '';
  const что = m ? m[2] : s;
  const куски = что.split(ПРОВАЛ);
  const провалы = что.match(ПРОВАЛ) || [];
  const html = куски.map((к, i) => т(к) + (i < провалы.length ? '<span class="hud-ov-muffle" title="Не расслышать">неразборчиво</span>' : '')).join('');
  return { кто, html };
}

export function hudHasMeaningfulOverheard(items) {
  return Array.isArray(items) && items.some(i => i && ((i.lines || []).some(hudHasMeaningfulValue) || hudHasMeaningfulValue(i.where)));
}

export function buildOverheardHTML(items, uid, isChecked) {
  const список = Array.isArray(items) ? items : [];
  const карточки = список.map(o => {
    const письмо = /letter|письм/i.test(o.kind || '') || (o.from && o.to && !/talk|разгов/i.test(o.kind || ''));
    const шапка = `<div class="hud-ov-head">
      <span class="hud-ov-kind">${письмо ? '✉️ Чужое письмо' : '👂 Подслушано'}</span>
      ${o.where ? `<b>${т(o.where)}</b>` : ''}
      ${o.time ? `<small>${т(o.time)}</small>` : ''}
      ${o.how ? `<em>${т(o.how)}</em>` : ''}
    </div>`;
    if (письмо) {
      return `<article class="hud-ov hud-ov-letter">${шапка}
        <div class="hud-ov-sheet">
          ${печать(цветВоска(o.seal, o.from), первая(o.from), 'is-broken is-lifted')}
          <div class="hud-ov-route">${o.from ? `От ${т(o.from)}` : ''}${o.to ? ` — к ${т(o.to)}` : ''}${o.seal ? `<small>${т(o.seal)}</small>` : ''}</div>
          ${(o.lines || []).map(л => `<p>${реплика(String(л ?? '').replace(/^[^:]{1,40}:\s*/, '')).html}</p>`).join('')}
        </div>
      </article>`;
    }
    const реплики = (o.lines || []).map(л => {
      const р = реплика(л);
      const цвет = HUD_AVATAR_COLORS[hudHashSeed(р.кто || '?') % HUD_AVATAR_COLORS.length];
      return `<div class="hud-ov-line" style="--who:${цвет}">${р.кто ? `<b>${т(р.кто)}</b>` : ''}<span>${р.html}</span></div>`;
    }).join('');
    return `<article class="hud-ov hud-ov-talk">${шапка}<div class="hud-ov-script">${реплики}</div></article>`;
  }).join('');
  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">
    <div class="hud-overheard">${карточки || пусто('👂', 'Никто ни о чём не шептался')}</div>
  </div>`;
}
