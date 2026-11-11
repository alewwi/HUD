// hud-manager/render/archive.js
//
// Окно «Архив HUD»: выбор диапазона сообщений, запуск анализа и показ отчёта.
//
// Считает не этот модуль, а history-analyzer.js — здесь только интерфейс.
// Отчёт приходит готовым объектом, поэтому окно одинаково рисует и свежий
// расчёт, и поднятый из кэша.

import { escapeHtml, guardTouchSwipe, имяБезПриставки } from '../utils.js?v=23.89.8';
import { английский } from '../i18n.js?v=23.89.8';
import { выбраннаяЛетопись, выбранныйЧат, свойФайлЛетописи, списокЛетописей, совпаденийСЧатом, выбратьЛетопись, чатыПерсонажа, летописьИзЧата } from '../chronicle-store.js?v=23.89.8';
import { analyzeChat, getChatMessages, readCache, writeCache, parseSceneDate } from '../history-analyzer.js?v=23.89.8';
import { ссылкиТрека } from './music.js?v=23.89.8';
import { историяБеременностей, ВИДЫ_ПОТЕРИ, дм, журналБеременностей, осложненияБеременности } from './conception.js?v=23.89.8';
import { сдвигиЧата, чистаяПричина } from '../turn-notes.js?v=23.89.8';
import { ико } from './view-icons.js?v=23.89.8';
import { namesLikelySame } from '../names.js?v=23.89.8';

let окноОткрыто = false;
// Дата и время ходов открытого отчёта (history-analyzer.js → moments).
let моменты = {};

// «14.10.2024, 22:18» — дата и время хода по HUD. Год пишем, только если
// модель его указала; время — часы и минуты, иначе часть суток («вечер»).
function момент(at, часть = 'all') {
  const м = моменты && (моменты[String(at)] || null);
  if (!м) return '';
  let день = '';
  if (часть !== 'time' && м.date) {
    const ms = parseSceneDate(м.date);
    if (ms !== null) {
      const d = new Date(ms), z = (n) => String(n).padStart(2, '0');
      const год = d.getUTCFullYear();
      день = `${z(d.getUTCDate())}.${z(d.getUTCMonth() + 1)}` + (год !== 2000 || /2000/.test(м.date) ? '.' + год : '');
    } else день = м.date.length > 22 ? м.date.slice(0, 21) + '…' : м.date;
  }
  const t = String(м.time || '').match(/(\d{1,2})[:.](\d{2})/);
  const время = t ? `${t[1].padStart(2, '0')}:${t[2]}` : String(м.time || '').split('|')[0].trim().slice(0, 16);
  return [день, время].filter(Boolean).join(', ');
}

// Ссылка на сообщение: по клику чат прокручивается к нему и оно мигает.
// Номер — это индекс в чате, тот же, что показывает ST. Рядом — дата и время
// хода (часть: 'all' — то и другое, 'time' — только время, 'none' — номер).
// Дробный номер — ход летописи, которого в чате нет (history-analyzer.js):
// стоит между сообщениями, перейти к нему некуда.
const ссылка = (at, часть = 'all') => {
  const когда = часть === 'none' ? '' : момент(at, часть);
  const время = когда ? `<time>${escapeHtml(когда)}</time>` : '';
  return Number.isInteger(at)
    ? `<button type="button" class="hud-arc-ref" data-mes="${at}" title="Перейти к сообщению"><b>#${at}</b>${время}</button>`
    : `<span class="hud-arc-ref is-chron" title="Ход из летописи — в этом чате такого сообщения нет"><b>летопись${at > 0 ? ', после #' + Math.floor(at) : ''}</b>${время}</span>`;
};
const значок = (имя) => ико(имя, 'hud-arc-ico');
const пусто = (поиск, пустой) => `<div class="hud-arc-empty">${поиск ? 'По запросу ничего не нашлось' : пустой}</div>`;
// «THE LANTERNS  Damian Hartley, Нолан» → «Damian Hartley, Нолан».
const безПриставок = (s) => String(s || '').split(/\s*,\s*/).map(x => имяБезПриставки(x)).join(', ');

const ЯРЛЫКИ_СТАТУСА = {
  unknown: 'никто не знает', suspected: 'подозревают', partial: 'знают частично',
  known: 'знают', revealed: 'раскрыт', rumor: 'слухи', hidden: 'скрыт',
};
const статус = (s) => ЯРЛЫКИ_СТАТУСА[String(s || '').toLowerCase()] || String(s || '');

const ЯРЛЫКИ_УРОВНЯ = { low: 'низкий', medium: 'средний', high: 'высокий', critical: 'критический' };

// --- Вкладки отчёта ----------------------------------------------------------

// История записи: шаги по ходам, раскрываются под карточкой.
const историяHTML = (заголовок, число, шаги) => `<details class="hud-arc-more"><summary>${значок('clock')}<span>${заголовок}</span>${число ? `<i class="hud-arc-count">${число}</i>` : ''}</summary>`
  + `<ol class="hud-arc-steps">${шаги.map(ш => `<li class="is-${ш.вид}"><span class="hud-arc-step-at">${ссылка(ш.at)}</span><span class="hud-arc-step-what">${ш.html}</span></li>`).join('')}</ol></details>`;

export function вкладкаСекретов(отчёт, поиск) {
  моменты = (отчёт && отчёт.moments) || {};
  const список = отчёт.secrets.filter(s => !поиск || [s.fact, s.firstFact, ...s.knows.flatMap(k => [k.name, k.source]), ...s.unaware]
    .some(x => String(x || '').toLowerCase().includes(поиск)));
  if (!список.length) return пусто(поиск, 'В этом отрезке секретов не было');
  const известны = список.filter(s => s.knows.length).length;
  const шапка = `<div class="hud-arc-note">Секретов: <b>${список.length}</b>, хоть кому-то известны: ${известны}. Сверху — секрет на последний момент, ниже — кто и когда о нём узнал.</div>`;

  return шапка + список.map(s => {
    const последний = s.statusHistory[s.statusHistory.length - 1] || { status: 'unknown', at: s.firstSeen };
    const знают = s.knows.length
      ? s.knows.map(k => `<span class="hud-arc-who">${escapeHtml(k.name)}</span>`).join('')
      : '<span class="hud-arc-who is-none">никто</span>';
    const неЗнают = s.unaware.map(n => `<span class="hud-arc-who is-out">${escapeHtml(n)}</span>`).join('');
    const уровень = s.level ? (ЯРЛЫКИ_УРОВНЯ[s.level] || s.level) : '';
    // Шаги: появился, смены статуса, кто узнал и как — по порядку ходов.
    const шаги = [
      { at: s.firstSeen, вид: 'start', порядок: 0, html: `<b>Секрет появился</b>${s.firstFact && s.firstFact !== s.fact ? `<em>${escapeHtml(s.firstFact)}</em>` : ''}` },
      ...s.statusHistory.slice(1).map(h => ({ at: h.at, вид: 'status', порядок: 1, html: `<b>${escapeHtml(статус(h.status))}</b>` })),
      ...s.knows.map(k => ({ at: k.since, вид: 'learn', порядок: 2,
        html: `<b>${escapeHtml(k.name)}</b>${k.since === s.firstSeen ? '<small>в курсе с самого начала</small>' : ''}<em>${k.source ? escapeHtml(k.source) : 'как узнал(а) — не записано'}</em>` })),
    ].sort((a, b) => a.at - b.at || a.порядок - b.порядок);
    return `<article class="hud-arc-card hud-arc-secret lvl-${escapeHtml(s.level || 'none')}">
      <div class="hud-arc-card-head"><i class="hud-arc-medal">${значок('lock')}</i><b>${escapeHtml(s.fact)}</b>${уровень ? `<span class="hud-arc-tag">${escapeHtml(уровень)}</span>` : ''}</div>
      <div class="hud-arc-state"><span class="hud-arc-badge is-${escapeHtml(последний.status)}">${escapeHtml(статус(последний.status))}</span><span class="hud-arc-since">${ссылка(последний.at)}</span></div>
      <div class="hud-arc-row"><label>Знают</label><div>${знают}</div></div>
      ${неЗнают ? `<div class="hud-arc-row"><label>Не знают</label><div>${неЗнают}</div></div>` : ''}
      ${историяHTML('Кто и когда узнал', s.knows.length, шаги)}
      <div class="hud-arc-foot">появился ${ссылка(s.firstSeen)} · последнее упоминание ${ссылка(s.lastSeen)}</div>
    </article>`;
  }).join('');
}

const ЯРЛЫКИ_РУЖЬЯ = { open: 'висит', building: 'назревает', fired: 'выстрелило' };

function вкладкаРужей(отчёт, поиск) {
  моменты = (отчёт && отчёт.moments) || {};
  if (!Array.isArray(отчёт.guns)) return '<div class="hud-arc-empty">Этот отчёт посчитан до появления ружей — нажмите «пересчитать».</div>';
  const список = отчёт.guns.filter(g => !поиск || [g.setup, g.firstSetup, g.tiedTo].some(x => String(x || '').toLowerCase().includes(поиск)));
  if (!список.length) return пусто(поиск, 'В этом отрезке ружей не было');
  const открытых = список.filter(g => (g.statusHistory[g.statusHistory.length - 1] || {}).status !== 'fired').length;
  const шапка = `<div class="hud-arc-note">Незакрытых нитей: <b>${открытых}</b> из ${список.length}. Выстрелившие остаются здесь вместе с моментом, когда это случилось.</div>`;
  return шапка + список.map(g => {
    const последний = g.statusHistory[g.statusHistory.length - 1] || { status: 'open', at: g.firstSeen };
    const шаги = [
      { at: g.firstSeen, вид: 'start', html: `<b>Нить появилась</b>${g.firstSetup && g.firstSetup !== g.setup ? `<em>${escapeHtml(g.firstSetup)}</em>` : ''}` },
      ...g.statusHistory.slice(1).map(h => ({ at: h.at, вид: 'status', html: `<b>${escapeHtml(ЯРЛЫКИ_РУЖЬЯ[h.status] || h.status)}</b>` })),
    ];
    return `<article class="hud-arc-card hud-arc-gun is-${escapeHtml(последний.status)}">
      <div class="hud-arc-card-head"><i class="hud-arc-medal">${значок(последний.status === 'fired' ? 'burst' : 'target')}</i><b>${escapeHtml(g.setup)}</b></div>
      <div class="hud-arc-state"><span class="hud-arc-badge is-${escapeHtml(последний.status)}">${escapeHtml(ЯРЛЫКИ_РУЖЬЯ[последний.status] || последний.status)}</span><span class="hud-arc-since">${ссылка(последний.at)}</span></div>
      ${g.tiedTo ? `<div class="hud-arc-row"><label>Связано с</label><div>${g.tiedTo.split(/\s*,\s*/).map(x => `<span class="hud-arc-who">${escapeHtml(x)}</span>`).join('')}</div></div>` : ''}
      ${шаги.length > 1 || шаги[0].html.includes('<em>') ? историяHTML('История нити', 0, шаги) : ''}
      <div class="hud-arc-foot">появилась ${ссылка(g.firstSeen)} · последнее упоминание ${ссылка(g.lastSeen)}</div>
    </article>`;
  }).join('');
}

// Доверие пары: график сдвигов и за что. Копится в чате (turn-notes.js).
function графикДоверия(записи) {
  const точки = [записи[0].было, ...записи.map(з => з.стало)];
  const x = (i) => (i / Math.max(1, точки.length - 1) * 200).toFixed(1), y = (v) => (40 - Math.max(0, Math.min(100, v)) * .38).toFixed(1);
  return `<svg class="hud-arc-trust" viewBox="0 0 200 42" preserveAspectRatio="none" aria-hidden="true"><path d="M${точки.map((v, i) => `${x(i)} ${y(v)}`).join('L')}"/></svg>`;
}
function поворотыДоверия(поиск) {
  const пары = new Map();
  for (const з of сдвигиЧата()) {
    const имя = `${имяБезПриставки(з.кто)} → ${имяБезПриставки(з.кому)}`;
    if (поиск && !(имя + ' ' + з.почему).toLowerCase().includes(поиск)) continue;
    if (!пары.has(имя)) пары.set(имя, []);
    пары.get(имя).push(з);
  }
  return [...пары].map(([имя, записи]) => `<div class="hud-arc-card"><div class="hud-arc-card-head"><i class="hud-arc-medal">${значок('heart')}</i><b>${escapeHtml(имя)}</b><span class="hud-arc-tag">доверие</span></div>${графикДоверия(записи)}`
    + записи.filter(з => з.почему || з.шрам || Math.abs(з.d) >= 15).slice(-8).map(з => `<div class="hud-arc-row"><label class="${з.d > 0 ? 'is-up' : 'is-down'}">${з.d > 0 ? '+' : ''}${з.d}${з.шрам ? ' 🩹' : ''}</label><div class="hud-arc-path">${escapeHtml(чистаяПричина(з.почему) || 'без причины')} ${ссылка(з.индекс)}</div></div>`).join('')
    + `</div>`).join('');
}
function вкладкаОтношений(отчёт, поиск) {
  моменты = (отчёт && отчёт.moments) || {};
  const имена = Object.keys(отчёт.relations);
  const повороты = поворотыДоверия(поиск);
  if (!имена.length) return повороты || '<div class="hud-arc-empty">В этом отрезке отношения не менялись</div>';
  const куски = повороты ? [повороты] : [];
  for (const субъект of имена) {
    const цели = отчёт.relations[субъект];
    const строки = Object.keys(цели).filter(цель => !поиск ||
      субъект.toLowerCase().includes(поиск) || цель.toLowerCase().includes(поиск) ||
      цели[цель].some(c => c.rel.toLowerCase().includes(поиск)));
    if (!строки.length) continue;
    куски.push(`<div class="hud-arc-card">
      <div class="hud-arc-card-head"><i class="hud-arc-medal">${значок('head')}</i><b>${escapeHtml(имяБезПриставки(субъект))}</b></div>
      ${строки.map(цель => {
        const путь = цели[цель].map(c => `<span class="hud-arc-status">${escapeHtml(c.rel)} ${ссылка(c.at)}</span>`).join('<i>→</i>');
        const менялось = цели[цель].length > 1 ? `<span class="hud-arc-tag">${цели[цель].length - 1} смен${цели[цель].length - 1 === 1 ? 'а' : ''}</span>` : '';
        return `<div class="hud-arc-row"><label>→ ${escapeHtml(имяБезПриставки(цель))}</label><div class="hud-arc-path">${путь}${менялось}</div></div>`;
      }).join('')}
    </div>`);
  }
  return куски.length ? куски.join('') : '<div class="hud-arc-empty">По запросу ничего не нашлось</div>';
}

// Прошлые беременности: роды, выкидыши, аборты. Считает не отчёт, а записи
// чата (render/conception.js), поэтому показываются за весь чат.
const имяМатери = (кто) => кто === 'user' ? (window.SillyTavern?.getContext?.()?.name1 || 'Игрок') : имяБезПриставки(String(кто).replace(/^char:/, ''));
const названиеИсхода = (з) => з.вид === 'birth' ? (з.было > 1 ? 'Роды, ' + з.было : 'Роды')
  : (ВИДЫ_ПОТЕРИ[з.вид] || ВИДЫ_ПОТЕРИ.miscarriage).имя + (з.часть ? ` одного из ${з.было}` : '');
// Все беременности: из HUD по ходам (отчёт.pregnancies) и записи исходов
// (роды и потери из render/conception.js). Исход из записей точнее — он
// отмечен кнопкой или меткой модели, поэтому стоит поверх того, что в HUD.
const ЭТО_ИГРОК = (з, имя) => з.кто === 'user' ? (э) => э.player || namesLikelySame(э.name, имя) : (э) => namesLikelySame(э.name, имя);
function беременностиОтчёта(отчёт) {
  const эпизоды = (Array.isArray(отчёт && отчёт.pregnancies) ? отчёт.pregnancies : []).map(э => ({ ...э, запись: null }));
  const свободные = [];
  for (const з of историяБеременностей()) {
    const имя = имяМатери(з.кто), чья = ЭТО_ИГРОК(з, имя);
    // Та беременность, в чьих ходах (или вскоре после) записан исход.
    const к = Number.isInteger(з.сообщение) ? з.сообщение : null;
    const э = эпизоды.filter(x => !x.запись && чья(x)).find(x => к !== null ? к >= x.from - 2 && к <= x.to + 30 : !!x.outcome);
    if (э) э.запись = з; else свободные.push(з);
  }
  return { эпизоды, свободные };
}
const срокТекстом = (с, по) => с !== null && по !== null && с !== по ? `с ${с}-й по ${по}-ю неделю` : (по ?? с) !== null ? `${по ?? с}-я неделя` : '';
// Осмотры, угроза и осложнение — из записей беременности (render/conception.js).
// Неоткрытое игроком не раскрываем: «не открыт», как в карточке.
const ИСХОДЫ_УГРОЗЫ = { keep: 'беременность сохранится', one: 'один малыш не выживет', all: 'беременность не сохранить' };
const метка = (вид, текст) => `<span class="hud-arc-badge is-${вид}">${escapeHtml(текст)}</span>`;
// Неделя и итог — отдельными словами: так каждое переводится само.
const меткаОсмотра = (вид, неделя, итог) => `<span class="hud-arc-badge is-${вид}"><span>${неделя}-я неделя:</span> <span>${escapeHtml(итог)}</span></span>`;
function осложненияHTML(кто, з) {
  let список = [];
  try { список = осложненияБеременности(кто, з && з.был ? з.был : null); } catch (_) { список = []; }
  const осмотры = список.filter(о => о.вид === 'exam').sort((a, b) => a.порог - b.порог).map(о => о.закрыт ? меткаОсмотра('unknown', о.порог, 'не открыт')
    : о.что.length ? о.что.map(т => меткаОсмотра('known', о.порог, т)).join('') : меткаОсмотра('birth', о.порог, 'в норме')).join('');
  const у = список.find(о => о.вид === 'threat');
  const угроза = у ? (у.закрыт ? метка('unknown', 'исход не открыт') : метка(у.итог === 'keep' ? 'birth' : 'known', ИСХОДЫ_УГРОЗЫ[у.итог] || у.итог)) : '';
  return (осмотры ? '<dt>Осмотры</dt><dd class="hud-arc-tags">' + осмотры + '</dd>' : '')
    + (угроза ? '<dt>Угроза прерывания</dt><dd class="hud-arc-tags">' + угроза + '</dd>' : '')
    + (з && з.осложнение ? '<dt>Осложнение</dt><dd class="hud-arc-tags">' + метка('known', 'операция, травма или инфекция') + '</dd>' : '');
}
// «08.12.2026, 18:35 — самопроизвольный выкидыш…» → то, что после даты.
const чтоСлучилось = (з, э) => {
  const т = (з && з.текст ? з.текст.replace(/^[^—]*\d[^—]*—\s*/, '') : (э && э.outcome ? э.outcome.text : '')).trim();
  return т && !/^\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?(?:,?\s*\d{1,2}:\d{2})?$/.test(т) ? т : '';
};
export function вкладкаБеременностей(отчёт, поиск) {
  моменты = (отчёт && отчёт.moments) || {};
  const { эпизоды, свободные } = беременностиОтчёта(отчёт);
  const есть = (...части) => !поиск || части.join(' ').toLowerCase().includes(поиск);
  const карточки = [];
  for (const э of эпизоды) {
    const з = э.запись;
    const исход = з ? названиеИсхода(з) : э.outcome ? (э.outcome.kind === 'birth' ? 'Роды' : 'Потеря') : '';
    // Без исхода и давно без вестей — не «идёт»: модель могла просто забыть.
    const молчит = !исход && отчёт.range && э.to < отчёт.range.to - 40;
    const вид = з ? з.вид : э.outcome ? э.outcome.kind : молчит ? 'quiet' : 'going';
    const ярлык = исход || (молчит ? 'нет вестей' : 'идёт');
    if (!есть(э.name, ярлык, э.father, э.knows, э.state, э.due, э.symptoms, чтоСлучилось(з, э))) continue;
    const когдаИсход = з && Number.isFinite(з.дата) ? дм(з.дата) : э.outcome ? э.outcome.date : '';
    const период = э.dateFrom && э.dateTo && э.dateFrom !== э.dateTo ? `${э.dateFrom} — ${э.dateTo}` : (э.dateTo || э.dateFrom);
    карточки.push(`<article class="hud-arc-card hud-arc-preg is-${escapeHtml(вид)}">`
      + `<div class="hud-arc-card-head"><i class="hud-arc-medal">${значок(вид === 'going' ? 'hearts' : вид === 'birth' ? 'star' : 'heartbreak')}</i><b>${escapeHtml(э.name)}</b><span class="hud-arc-badge is-${escapeHtml(вид)}">${escapeHtml(ярлык)}</span></div>`
      + `<dl>`
      + (срокТекстом(э.weekFrom, з && Number.isFinite(з.неделя) ? з.неделя : э.weekTo) ? `<dt>Срок</dt><dd>${escapeHtml(срокТекстом(э.weekFrom, з && Number.isFinite(з.неделя) ? з.неделя : э.weekTo))}</dd>` : '')
      + (период ? `<dt>В сюжете</dt><dd>${escapeHtml(период)}</dd>` : '')
      + (когдаИсход ? `<dt>${escapeHtml(исход || 'Исход')}</dt><dd>${escapeHtml(когдаИсход)}</dd>` : '')
      + (э.due && вид === 'going' ? `<dt>Роды ожидаются</dt><dd>${escapeHtml(э.due)}</dd>` : '')
      + ((з && з.отец) || э.father ? `<dt>Отец</dt><dd>${escapeHtml(имяБезПриставки((з && з.отец) || э.father))}</dd>` : '')
      + `<dt>Кто знает</dt><dd>${escapeHtml(безПриставок((з && з.знают) || э.knows) || 'не записано')}</dd>`
      + (э.state ? `<dt>${вид === 'going' ? 'Как проходит' : 'Как проходила'}</dt><dd>${escapeHtml(э.state)}</dd>` : '')
      + (э.symptoms ? `<dt>Симптомы</dt><dd>${escapeHtml(э.symptoms)}</dd>` : '')
      + (э.visit && вид === 'going' ? `<dt>Визит к врачу</dt><dd>${escapeHtml(э.visit)}</dd>` : '')
      + осложненияHTML(з ? з.кто : (э.player ? 'user' : э.name), з)
      + (чтоСлучилось(з, э) ? `<dt>Что случилось</dt><dd>${escapeHtml(чтоСлучилось(з, э))}</dd>` : '')
      + `</dl>${Array.isArray(э.course) && э.course.length > 1 ? историяHTML(вид === 'going' ? 'Как проходит' : 'Как проходила', э.course.length, э.course.map((c, i) => ({ at: c.at, вид: i ? 'status' : 'start', html: `<b>${escapeHtml(c.text)}</b>` }))) : ''}<div class="hud-arc-foot">ходы ${ссылка(э.from)} — ${ссылка(э.to)}${з && Number.isInteger(з.сообщение) && з.сообщение !== э.to ? ` · исход ${ссылка(з.сообщение)}` : ''}</div></article>`);
  }
  // Исходы, у которых в отрезке нет ходов с беременностью (HUD вычищен или
  // отрезок короче): как раньше, только запись.
  for (const з of свободные) {
    if (!есть(имяМатери(з.кто), названиеИсхода(з), з.отец, з.знают)) continue;
    карточки.push(`<article class="hud-arc-card hud-arc-preg is-${з.вид}"><div class="hud-arc-card-head"><i class="hud-arc-medal">${значок(з.вид === 'birth' ? 'star' : 'heartbreak')}</i><b>${escapeHtml(имяМатери(з.кто))}</b><span class="hud-arc-badge is-${з.вид}">${escapeHtml(названиеИсхода(з))}</span></div>`
      + `<dl>${Number.isFinite(з.дата) ? `<dt>Когда</dt><dd>${дм(з.дата)}</dd>` : ''}`
      + (Number.isFinite(з.неделя) ? `<dt>Срок</dt><dd>${з.неделя}-я неделя</dd>` : '')
      + (з.отец ? `<dt>Отец</dt><dd>${escapeHtml(имяБезПриставки(з.отец))}</dd>` : '')
      + `<dt>Кто знает</dt><dd>${з.знают ? escapeHtml(безПриставок(з.знают)) : 'не записано'}</dd>`
      + осложненияHTML(з.кто, з)
      + (чтоСлучилось(з, null) ? `<dt>Что случилось</dt><dd>${escapeHtml(чтоСлучилось(з, null))}</dd>` : '') + `</dl>`
      + (Number.isInteger(з.сообщение) ? `<div class="hud-arc-foot">исход ${ссылка(з.сообщение)}</div>` : '') + `</article>`);
  }
  if (!карточки.length) return пусто(поиск, 'Беременностей в этом отрезке не было');
  const идут = эпизоды.filter(э => !э.запись && !э.outcome).length;
  const шапка = `<div class="hud-arc-note">Беременностей: <b>${карточки.length}</b>${идут ? `, идут сейчас: ${идут}` : ''}. Срок и даты — по HUD ходов, исход — по отметке родов или потери.</div>`;
  return шапка + карточки.join('') + журналБеременностейHTML();
}
function журналБеременностейHTML() {
  const журнал = журналБеременностей();
  if (!журнал.length) return '';
  return `<details class="hud-arc-card hud-arc-preglog"><summary>Журнал событий</summary><ul>${журнал.slice(-40).reverse().map(з => `<li>${Number.isFinite(з.дата) ? `<time>${дм(з.дата)}</time> ` : ''}<b>${escapeHtml(имяМатери(з.кто))}</b> ${escapeHtml(з.что)}</li>`).join('')}</ul>`
    + `<button type="button" class="hud-arc-again" data-arc-preglog="1">Скачать журнал</button></details>`;
}

function вкладкаХронологии(отчёт, поиск) {
  моменты = (отчёт && отчёт.moments) || {};
  // Даты и локации — один поток событий: так видно, что переезд случился
  // в тот же вечер, а не «когда-то между». Потери — там же, у своего хода.
  const события = [
    ...отчёт.dates.map(d => ({ at: d.at, kind: 'date', text: d.date + (d.time ? `, ${String(d.time).split(/\s*\|\s*/).filter(Boolean).join(' · ')}` : '') })),
    ...отчёт.locations.map(l => ({ at: l.at, kind: 'place', text: l.place })),
    ...историяБеременностей().filter(з => Number.isInteger(з.сообщение)).map(з => ({ at: з.сообщение, kind: 'life', text: `${названиеИсхода(з)} · ${имяМатери(з.кто)}` })),
  ].filter(e => !поиск || e.text.toLowerCase().includes(поиск))
   .sort((a, b) => a.at - b.at || (a.kind === 'date' ? -1 : 1));

  if (!события.length) return пусто(поиск, 'В этом отрезке сцена не менялась');

  const дней = отчёт.stats.storyDays;
  const шапка = `<div class="hud-arc-note">${дней === null
    ? 'Длительность сюжета посчитать не вышло: даты в HUD записаны в свободной форме.'
    : `В сюжете прошло <b>${дней}</b> ${склон(дней, 'день', 'дня', 'дней')} — по датам из HUD.`}</div>`;

  // Дата сцены — заголовок дня; места и исходы — под ней, со временем хода.
  const ИКОНКИ_СОБЫТИЙ = { date: 'calendar', place: 'pin', life: 'heartbreak' };
  return шапка + '<div class="hud-arc-timeline">' + события.map(e => e.kind === 'date'
    ? `<div class="hud-arc-event is-date"><span class="hud-arc-dot"></span><span class="hud-arc-when">${значок('calendar')}<b>${escapeHtml(e.text)}</b></span>${ссылка(e.at, 'none')}</div>`
    : `<div class="hud-arc-event is-${e.kind}"><span class="hud-arc-dot"></span><span class="hud-arc-when">${значок(ИКОНКИ_СОБЫТИЙ[e.kind])}${escapeHtml(e.text)}</span>${ссылка(e.at, 'time')}</div>`).join('') + '</div>';
}

// Саундтрек: главы по дням сюжета. Глава — подряд идущие ходы с одной
// подборкой; у каждой метка сцены, место, ходы и треки со ссылками.
const НОТА = '<svg class="hud-arc-st-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M20 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0"/></svg>';
function трекиГлавы(треки) {
  return '<ol class="hud-arc-st-list">' + треки.map(т => `<li class="${т.ok === false ? 'is-unfound' : ''}">`
    + (т.art ? `<img src="${escapeHtml(т.art)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<i class="hud-arc-st-blank" aria-hidden="true"></i>')
    + `<span class="hud-arc-st-tt"><b>${escapeHtml(т.t)}</b><em>${escapeHtml(т.a)}</em></span><span class="hud-arc-st-go">${ссылкиТрека(т)}</span></li>`).join('') + '</ol>';
}
export function вкладкаСаундтрека(отчёт, поиск) {
  моменты = (отчёт && отчёт.moments) || {};
  if (!Array.isArray(отчёт.soundtrack)) return '<div class="hud-arc-empty">Отчёт посчитан до появления саундтрека — нажмите «пересчитать».</div>';
  const есть = (г) => !поиск || [г.label, г.place, г.date, ...(г.soundtrack || []).flatMap(т => [т.a, т.t]), ...((г.scene && г.scene.tracks) || []).flatMap(т => [т.a, т.t])]
    .some(x => String(x || '').toLowerCase().includes(поиск));
  const главы = отчёт.soundtrack.map((г, n) => ({ ...г, n })).filter(есть);
  if (!главы.length) return `<div class="hud-arc-empty">${поиск ? 'По запросу ничего не нашлось' : 'В этом отрезке музыку не подбирали — включите «Музыку сцены» в настройках'}</div>`;
  const дни = [];
  for (const г of главы) {
    const день = г.date || (дни.length ? дни[дни.length - 1].день : '');
    if (!дни.length || дни[дни.length - 1].день !== день) дни.push({ день, главы: [] });
    дни[дни.length - 1].главы.push(г);
  }
  const треков = отчёт.stats && отчёт.stats.soundtrackTracks;
  const шапка = `<div class="hud-arc-note">${главы.length} ${главы.length === 1 ? 'глава' : главы.length < 5 ? 'главы' : 'глав'} саундтрека${треков ? ', треков — ' + треков : ''}. Глава — ходы, пока играла одна подборка.</div>`;
  return шапка + дни.map(д => `<div class="hud-arc-st-day"><div class="hud-arc-st-date">${escapeHtml(д.день || 'Дата не указана')}</div>`
    + д.главы.map(г => {
      const ходы = г.from === г.to ? ссылка(г.from) : ссылка(г.from) + '<i>–</i>' + ссылка(г.to);
      const телефон = г.phone && г.phone.tracks && г.phone.tracks.length
        ? `<div class="hud-arc-st-phone">В телефоне у ${escapeHtml(имяБезПриставки(г.phone.owner || ''))}: ${г.phone.tracks.slice(0, 4).map(т => escapeHtml(т.a + ' — ' + т.t)).join('; ')}</div>` : '';
      return `<div class="hud-arc-card hud-arc-st">
        <div class="hud-arc-card-head">${НОТА}<b>${escapeHtml(г.label || 'Подборка')}</b>${г.why ? `<span class="hud-arc-tag">${escapeHtml(г.why)}</span>` : ''}</div>
        <div class="hud-arc-st-meta">${г.place ? escapeHtml(г.place) + ' · ' : ''}ходы ${ходы}<button type="button" class="hud-arc-st-mt" data-arc-mt="${г.n}" title="Отдать саундтрек главы в очередь MoodTube">в очередь MoodTube</button></div>
        ${(г.soundtrack || []).length ? трекиГлавы(г.soundtrack) : ''}
        ${г.scene && г.scene.tracks && г.scene.tracks.length ? `<div class="hud-arc-st-sub">В сцене${г.scene.src ? ': ' + escapeHtml(г.scene.src) : ''}</div>${трекиГлавы(г.scene.tracks)}` : ''}
        ${телефон}
      </div>`;
    }).join('') + '</div>').join('');
}

function вкладкаСтатистики(отчёт) {
  моменты = (отчёт && отчёт.moments) || {};
  const s = отчёт.stats;
  const плитка = (значение, подпись, пояснение) => `<div class="hud-arc-tile">
    <b>${escapeHtml(String(значение))}</b><span>${escapeHtml(подпись)}</span>
    ${пояснение ? `<small>${escapeHtml(пояснение)}</small>` : ''}</div>`;

  const доля = s.totalMessages ? Math.round(s.withHud / s.totalMessages * 100) : 0;
  const плитки = [
    плитка(s.totalMessages, 'сообщений в отрезке'),
    // Из летописи — HUD, вычищенные из сообщений (chronicle.js).
    плитка(s.withHud, 'из них с HUD', доля + '% отрезка' + (s.fromChronicle ? ', ' + s.fromChronicle + ' — из летописи' : '') + (s.chronicleOnly ? ', ещё ' + s.chronicleOnly + ' — из летописи, которых в чате нет' : '')),
    плитка(s.brokenHud, 'битых блоков', s.brokenHud ? 'разобрать не удалось' : 'все разобрались'),
    плитка(s.uniqueCharacters, 'персонажей'),
    плитка(s.storyDays === null ? '—' : s.storyDays, 'дней в сюжете', s.storyDays === null ? 'даты не разобрались' : (s.datesFromTags ? 'часть дат — из тега <time>' : '')),
    плитка(s.uniqueLocations, 'локаций', s.locationChanges + ' переходов'),
    плитка(s.moodChanges, 'смен настроения'),
    плитка(s.secretsTotal, 'секретов', s.secretsRevealedToSomeone + ' хоть кому-то известны'),
    плитка(s.relationPairs, 'пар в отношениях'),
    плитка(s.gunsTotal ?? '—', 'ружей Чехова', s.gunsTotal ? `${s.gunsFired} выстрелило` : ''),
  ].join('');

  const погода = s.weather.length
    ? `<div class="hud-arc-card"><div class="hud-arc-card-head"><i class="hud-arc-medal">${значок('cloud')}</i><b>Погода</b></div>
        <div class="hud-arc-row"><div>${s.weather.map(w => `<span class="hud-arc-who">${escapeHtml(w.kind)} <small>×${w.times}</small></span>`).join('')}</div></div></div>`
    : '';

  const люди = s.characters.length
    ? `<div class="hud-arc-card"><div class="hud-arc-card-head"><i class="hud-arc-medal">${значок('mask')}</i><b>Кто встречался</b></div>
        <div class="hud-arc-row"><div>${s.characters.map(n => `<span class="hud-arc-who">${escapeHtml(n)}</span>`).join('')}</div></div></div>`
    : '';

  const настроения = отчёт.moods.length
    ? `<div class="hud-arc-card"><div class="hud-arc-card-head"><i class="hud-arc-medal">${значок('wave')}</i><b>Настроение по персонажам</b></div>
        ${отчёт.moods.slice(0, 8).map(m => `<div class="hud-arc-row"><label>${escapeHtml(m.name)}</label>
          <div class="hud-arc-path">${m.changes.slice(-6).map(c => `<span class="hud-arc-status">${escapeHtml(c.mood)} ${ссылка(c.at)}</span>`).join('<i>→</i>')}
          ${m.changes.length > 6 ? `<span class="hud-arc-tag">всего ${m.changes.length}</span>` : ''}</div></div>`).join('')}
      </div>`
    : '';

  return `<div class="hud-arc-tiles">${плитки}</div>${люди}${настроения}${погода}`;
}

// --- Дашборд ------------------------------------------------------------------
// Виджеты выбираются галочками; выбор живёт в localStorage и одинаков для всех
// чатов. Цвета — по одному на смысл: серия одна — цвет один.

const ВИДЖЕТЫ = [
  ['health', '🩺', 'Здоровье чата'],
  ['speakers', '🗣', 'Кто чаще говорит'],
  ['heatmap', '🕰', 'Активность по времени сцены'],
  ['words', '🔤', 'Топ-10 слов и фраз'],
  ['length', '📏', 'Длина ответов модели'],
  ['engagement', '🔁', 'Вовлечённость'],
  ['boring', '🥱', 'Скучные зоны'],
  ['scenes', '🎬', 'Ритм сцен'],
  ['dialogue', '💬', 'Диалог и описание'],
  ['nsfw', '🔞', 'Частота NSFW-сцен'],
  ['mentions', '🕸', 'Кто кого упоминает'],
];
const КЛЮЧ_ВИДЖЕТОВ = 'hud_archive_widgets';
function выборВиджетов() {
  try {
    const v = JSON.parse(localStorage.getItem(КЛЮЧ_ВИДЖЕТОВ) || 'null');
    if (v && typeof v === 'object') return v;
  } catch (_) {}
  return {};
}
function запомнитьВиджет(id, включён) {
  const v = выборВиджетов();
  v[id] = !!включён;
  try { localStorage.setItem(КЛЮЧ_ВИДЖЕТОВ, JSON.stringify(v)); } catch (_) {}
}

const число = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString(английский() ? 'en-US' : 'ru-RU'));
const плитка = (значение, подпись, пояснение) => `<div class="hud-arc-tile"><b>${escapeHtml(String(значение))}</b><span>${escapeHtml(подпись)}</span>${пояснение ? `<small>${escapeHtml(пояснение)}</small>` : ''}</div>`;
const полоса = (подпись, доля, значение, пояснение) => `<div class="hud-dash-bar"${пояснение ? ` title="${escapeHtml(пояснение)}"` : ''}>`
  + `<span class="hud-dash-bar-label">${подпись}</span>`
  + `<span class="hud-dash-bar-track"><i style="width:${Math.max(0, Math.min(100, доля)).toFixed(1)}%"></i></span>`
  + `<span class="hud-dash-bar-val">${escapeHtml(значение)}</span></div>`;
const склон = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

// Последовательная шкала синего: слабое уходит в фон, сильное светлеет.
const ШКАЛА = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#86b6ef'];

const РИСУНКИ = {
  health(д) {
    const h = д.health;
    return `<div class="hud-arc-tiles">`
      + плитка(число(h.messages), 'сообщений', `вы ${число(h.user)} · модель ${число(h.ai)}`)
      + плитка(число(h.avgChars), 'знаков в среднем', `≈ ${число(h.avgWords)} слов`)
      + плитка(h.perDay === null ? '—' : число(h.perDay), 'сообщений в день', h.days ? `за ${число(h.days)} ${склон(h.days, 'день', 'дня', 'дней')}` : 'нет дат отправки')
      + плитка(h.medianGapMin === null ? '—' : число(h.medianGapMin) + ' мин', 'обычная пауза', 'медиана между сообщениями')
      + плитка(число(h.sessions), склон(h.sessions, 'сессия', 'сессии', 'сессий'), 'перерыв больше двух часов — новая')
      + `</div>`;
  },
  speakers(д) {
    if (!д.speakers.length) return '';
    const максимум = Math.max(...д.speakers.map(s => s.share)) || 1;
    return `<div class="hud-dash-bars">` + д.speakers.map(s => полоса(
      escapeHtml(имяБезПриставки(s.name)) + (s.isUser ? ' <em>вы</em>' : ''), s.share / максимум * 100,
      `${число(s.share)}% · ${число(s.count)}`, `${s.name}: ${s.count} сообщений, ${s.share}%`)).join('') + `</div>`;
  },
  heatmap(д) {
    const { hours, total } = д.heatmap;
    if (!total) return '<div class="hud-arc-note">В HUD этого отрезка не записано время сцены.</div>';
    const максимум = Math.max(...hours) || 1;
    const клетки = hours.map((n, h) => {
      const цвет = n ? ШКАЛА[Math.min(ШКАЛА.length - 1, Math.floor(n / максимум * (ШКАЛА.length - 1) + 0.0001))] : '';
      const подсказка = `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59 — ${n} ${склон(n, 'ход', 'хода', 'ходов')}`;
      return `<span class="hud-dash-cell${n ? '' : ' is-zero'}" style="${цвет ? `background:${цвет}` : ''}" title="${подсказка}" aria-label="${подсказка}"></span>`;
    }).join('');
    const пик = hours.indexOf(максимум);
    return `<div class="hud-dash-heat">${клетки}</div>`
      + `<div class="hud-dash-heat-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>`
      + `<div class="hud-dash-foot">Чаще всего действие идёт с ${String(пик).padStart(2, '0')}:00 — ${максимум} ${склон(максимум, 'ход', 'хода', 'ходов')}. <span class="hud-dash-ramp">${ШКАЛА.map(c => `<i style="background:${c}"></i>`).join('')}</span> меньше → больше</div>`;
  },
  words(д) {
    if (!д.words.length) return '';
    const максС = д.words[0].count || 1;
    const слова = д.words.map(w => полоса(escapeHtml(w.word), w.count / максС * 100, число(w.count))).join('');
    const максФ = д.phrases.length ? д.phrases[0].count : 1;
    const фразы = д.phrases.length ? д.phrases.map(p => полоса(escapeHtml(p.phrase), p.count / максФ * 100, число(p.count))).join('') : '<div class="hud-arc-empty">Повторяющихся фраз нет</div>';
    return `<div class="hud-dash-cols"><div><div class="hud-dash-sub">Слова</div><div class="hud-dash-bars">${слова}</div></div><div><div class="hud-dash-sub">Фразы</div><div class="hud-dash-bars">${фразы}</div></div></div>`;
  },
  length(д) {
    const { points, firstAvg, lastAvg, changePct } = д.length;
    if (points.length < 2) return '<div class="hud-arc-note">Ответов модели слишком мало для графика.</div>';
    const W = 320, H = 120, Л = 36, П = 10, В = 10, Н = 20;
    const максимум = Math.max(...points.map(p => p.len)) || 1;
    const x = (i) => Л + (W - Л - П) * i / (points.length - 1);
    const y = (v) => В + (H - В - Н) * (1 - v / максимум);
    const линия = points.map((p, i) => `${x(i).toFixed(1)},${y(p.len).toFixed(1)}`).join(' ');
    const сетка = [0, 0.5, 1].map(k => `<line class="hud-dash-grid" x1="${Л}" x2="${W - П}" y1="${y(максимум * k).toFixed(1)}" y2="${y(максимум * k).toFixed(1)}"/><text class="hud-dash-tick" x="${Л - 5}" y="${(y(максимум * k) + 3).toFixed(1)}" text-anchor="end">${Math.round(максимум * k)}</text>`).join('');
    const точки = points.map((p, i) => `<circle class="hud-dash-hit" cx="${x(i).toFixed(1)}" cy="${y(p.len).toFixed(1)}" r="9"><title>#${p.at}: ${p.len} знаков</title></circle>`).join('');
    const последняя = points[points.length - 1];
    const вывод = changePct === null ? 'Для сравнения нужно больше ответов.'
      : Math.abs(changePct) < 10 ? `Длина держится: ${число(firstAvg)} → ${число(lastAvg)} знаков в среднем.`
      : changePct < 0 ? `Модель стала писать короче на ${Math.abs(changePct)}%: ${число(firstAvg)} → ${число(lastAvg)} знаков в среднем.`
      : `Модель стала писать длиннее на ${changePct}%: ${число(firstAvg)} → ${число(lastAvg)} знаков в среднем.`;
    return `<svg class="hud-dash-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="Длина ответов модели по ходу чата">${сетка}`
      + `<polyline class="hud-dash-series" points="${линия}"/>`
      + `<circle class="hud-dash-end" cx="${x(points.length - 1).toFixed(1)}" cy="${y(последняя.len).toFixed(1)}" r="4"/>`
      + `<text class="hud-dash-endlabel" x="${(x(points.length - 1) - 6).toFixed(1)}" y="${(y(последняя.len) - 8).toFixed(1)}" text-anchor="end">${последняя.len}</text>`
      + `<text class="hud-dash-tick" x="${Л}" y="${H - 5}">#${points[0].at}</text><text class="hud-dash-tick" x="${W - П}" y="${H - 5}" text-anchor="end">#${последняя.at}</text>`
      + `${точки}</svg><div class="hud-dash-foot">${escapeHtml(вывод)}</div>`;
  },
  engagement(д) {
    const e = д.engagement;
    const доля = e.aiMessages ? Math.round(e.swiped / e.aiMessages * 100) : 0;
    const список = e.top.length
      ? `<div class="hud-arc-row"><label>Чаще свайпали</label><div>${e.top.map(t => `<span class="hud-arc-who">${ссылка(t.at)} <small>×${t.swipes}</small></span>`).join('')}</div></div>` : '';
    return `<div class="hud-arc-tiles">`
      + плитка(число(e.swiped), 'ответов со свайпами', `${доля}% из ${число(e.aiMessages)}`)
      + плитка(число(e.extraSwipes), 'лишних вариантов', e.aiMessages ? `≈ ${число(Math.round(e.extraSwipes / e.aiMessages * 10) / 10)} на ответ` : '')
      + `</div>${список}<div class="hud-dash-foot">Правки текста SillyTavern не запоминает — считаются только свайпы.</div>`;
  },
  boring(д) {
    const b = д.boring;
    if (b.avgSimilarity === null) return '<div class="hud-arc-note">Ответов модели слишком мало для сравнения.</div>';
    const зоны = b.zones.length
      ? `<div class="hud-dash-bars">${b.zones.map(z => полоса(`${ссылка(z.prev)} → ${ссылка(z.at)}${z.phrase ? ` <em>«${escapeHtml(z.phrase)}…»</em>` : ''}`, z.similarity, z.similarity + '%', `Совпадает ${z.similarity}% троек слов с прошлым ответом`)).join('')}</div>`
      : '<div class="hud-arc-empty">Заметных повторов нет</div>';
    return `<div class="hud-arc-tiles">${плитка(b.avgSimilarity + '%', 'среднее совпадение', 'соседних ответов модели')}</div>${зоны}`
      + `<div class="hud-dash-foot">Считаются общие тройки слов у соседних ответов модели. От 12% — зона повтора.</div>`;
  },
  scenes(д) {
    const s = д.scenes;
    if (!s.count) return '<div class="hud-arc-note">В HUD этого отрезка нет мест — сцены не разделить.</div>';
    const максимум = Math.max(...s.list.map(x => x.turns)) || 1;
    const длиннее = s.longest;
    return `<div class="hud-arc-tiles">`
      + плитка(число(s.count), склон(s.count, 'сцена', 'сцены', 'сцен'))
      + плитка(число(s.avgTurns), 'ходов на сцену')
      + (длиннее ? плитка(число(длиннее.turns), 'ходов в самой долгой', длиннее.place) : '')
      + `</div><div class="hud-dash-bars">${s.list.map(x => полоса(`${escapeHtml(x.place.length > 30 ? x.place.slice(0, 29) + '…' : x.place)} ${ссылка(x.from)}`, x.turns / максимум * 100,
        `${x.turns} ${склон(x.turns, 'ход', 'хода', 'ходов')}${x.minutes !== null ? ' · ' + x.minutes + ' мин' : ''}`)).join('')}</div>`;
  },
  dialogue(д) {
    const { share, dialogueChars, descriptionChars } = д.dialogue;
    if (share === null) return '';
    return `<div class="hud-dash-split" role="img" aria-label="Диалог ${share}%, описание ${100 - share}%">`
      + `<i class="is-dialogue" style="flex:${Math.max(share, 0.5)}" title="Диалог: ${share}%"></i>`
      + `<i class="is-description" style="flex:${Math.max(100 - share, 0.5)}" title="Описание: ${100 - share}%"></i></div>`
      + `<div class="hud-dash-legend"><span><i class="is-dialogue"></i>Диалог ${share}% · ${число(dialogueChars)} знаков</span>`
      + `<span><i class="is-description"></i>Описание ${100 - share}% · ${число(descriptionChars)} знаков</span></div>`
      + `<div class="hud-dash-foot">Диалог — текст в кавычках и реплики через тире в ответах модели.</div>`;
  },
  nsfw(д) {
    const n = д.nsfw;
    if (!n.nsfwTurns) return '';
    return `<div class="hud-arc-tiles">`
      + плитка(n.share + '%', 'ходов с близостью', `${число(n.nsfwTurns)} из ${число(n.hudTurns)} с HUD`)
      + плитка(число(n.scenes), склон(n.scenes, 'сцена', 'сцены', 'сцен'), 'подряд идущие ходы — одна')
      + `</div>`;
  },
  mentions(д) {
    if (!д.mentions.length) return '';
    const максимум = д.mentions[0].count || 1;
    return `<div class="hud-dash-bars">${д.mentions.map(m => полоса(`${escapeHtml(имяБезПриставки(m.from))} <em>→</em> ${escapeHtml(имяБезПриставки(m.to))}`, m.count / максимум * 100,
      `${число(m.count)} ${склон(m.count, 'сообщение', 'сообщения', 'сообщений')}`)).join('')}</div>`
      + `<div class="hud-dash-foot">Сколько сообщений одного говорящего называют другого по имени.</div>`;
  },
};

export function buildDashboardHTML(отчёт) {
  const д = отчёт && отчёт.dashboard;
  if (!д) return '<div class="hud-arc-empty">Этот отчёт посчитан до появления дашборда — нажмите «пересчитать».</div>';
  const выбор = выборВиджетов();
  const включён = (id) => выбор[id] !== false;
  const галочки = `<div class="hud-dash-pick" role="group" aria-label="Какие виджеты показывать">${ВИДЖЕТЫ.map(([id, значок, имя]) =>
    `<label class="hud-dash-chip${включён(id) ? ' is-on' : ''}"><input type="checkbox" data-widget="${id}"${включён(id) ? ' checked' : ''}> ${значок} ${escapeHtml(имя)}</label>`).join('')}</div>`;
  const карточки = ВИДЖЕТЫ.filter(([id]) => включён(id)).map(([id, значок, имя]) => {
    let тело = '';
    try { тело = РИСУНКИ[id](д); } catch (e) { console.warn('[TavernOS HUD] Дашборд: виджет не собрался', id, e); тело = ''; }
    return тело ? `<section class="hud-arc-card hud-dash-card" data-widget="${id}"><div class="hud-arc-card-head">${значок} <b>${escapeHtml(имя)}</b></div>${тело}</section>` : '';
  }).join('');
  return галочки + `<div class="hud-dash-grid">${карточки || '<div class="hud-arc-empty">Нечего показать: отметьте виджеты выше.</div>'}</div>`;
}

// --- Окно --------------------------------------------------------------------

export function openArchiveDialog() {
  if (окноОткрыто) return;
  const chat = getChatMessages();
  if (!chat.length) {
    alert('Чат пуст — анализировать нечего.');
    return;
  }
  окноОткрыто = true;

  const последний = chat.length - 1;
  const начало = Math.max(0, последний - 199); // по умолчанию — последние 200 ходов

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay hud-arc-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-arc-modal" role="dialog" aria-modal="true" aria-label="Архив HUD">
      <div class="hud-modal-head hud-arc-head"><i class="hud-arc-medal">${значок('book')}</i><span>Архив HUD <small>сводка по сохранённым HUD-блокам</small></span><button type="button" class="hud-arc-x" aria-label="Закрыть" title="Закрыть">✕</button></div>
      <div class="hud-arc-controls">
        <div class="hud-arc-range">
          <label>${английский() ? 'from' : 'с'} <input type="number" class="hud-arc-from" min="0" max="${последний}" value="${начало}"></label>
          <label>по <input type="number" class="hud-arc-to" min="0" max="${последний}" value="${последний}"></label>
          <span class="hud-arc-total">всего ${chat.length} сообщ.</span>
        </div>
        <div class="hud-arc-sliders">
          <input type="range" class="hud-arc-slide-from" min="0" max="${последний}" value="${начало}">
          <input type="range" class="hud-arc-slide-to" min="0" max="${последний}" value="${последний}">
        </div>
        <div class="hud-arc-quick">
          <button type="button" data-quick="all">весь чат</button>
          <button type="button" data-quick="50">последние 50</button>
          <button type="button" data-quick="200">последние 200</button>
          <button type="button" class="hud-arc-run">Анализировать</button>
        </div>
        <div class="hud-arc-progress" hidden><div class="hud-arc-bar"></div><span></span></div>
        <div class="hud-arc-chron" title="Летопись — выжимки HUD, которые архив берёт, когда HUD вычищен из сообщений. Своя ведётся по копии чата всегда. Если HUD узнал чат не так или старые HUD остались в другом чате — выберите тот чат (или его летопись): HUD прочитает его файл, его ходы закроют пропуски своей, а ходы, которых здесь нет, архив добавит без дублей. Сам выбранный чат не меняется.">
          <label>Летопись: своя + <select class="hud-arc-chron-sel" disabled><option value="">ищу чаты…</option></select></label>
          <small class="hud-arc-chron-info" aria-live="polite"><i class="hud-arc-spin" aria-hidden="true"></i>ищу другие чаты персонажа и летописи…</small>
        </div>
      </div>
      <div class="hud-arc-tabs" hidden>
        <button type="button" class="active" data-tab="secrets">${значок('lock')}<span>Секреты</span></button>
        <button type="button" data-tab="guns">${значок('target')}<span>Ружья</span></button>
        <button type="button" data-tab="relations">${значок('heart')}<span>Отношения</span></button>
        <button type="button" data-tab="timeline">${значок('calendar')}<span>Хронология</span></button>
        <button type="button" data-tab="pregnancies">${значок('hearts')}<span>Беременности</span></button>
        <button type="button" data-tab="soundtrack">${значок('music')}<span>Саундтрек</span></button>
        <button type="button" data-tab="stats">${значок('chart')}<span>Статистика</span></button>
        <button type="button" data-tab="dash">${значок('frame')}<span>Дашборд</span></button>
        <input type="search" class="hud-arc-search" placeholder="Поиск по отчёту…">
      </div>
      <div class="hud-modal-body hud-arc-body"><div class="hud-arc-empty">Выберите диапазон и нажмите «Анализировать».</div></div>
      <div class="hud-modal-foot">
        <span class="hud-arc-meta"></span>
        <button type="button" class="hud-modal-btn hud-arc-export" disabled>Экспорт JSON</button>
        <button type="button" class="hud-modal-btn cancel">Закрыть</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  guardTouchSwipe(overlay);

  const $ = (s) => overlay.querySelector(s);
  const тело = $('.hud-arc-body');
  const вкладки = $('.hud-arc-tabs');
  const прогресс = $('.hud-arc-progress');

  let отчёт = null;
  let активная = 'secrets';
  let идётАнализ = false;
  let отменено = false;

  const закрыть = () => { отменено = true; окноОткрыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише); };
  const поКлавише = (e) => { if (e.key === 'Escape') закрыть(); };
  document.addEventListener('keydown', поКлавише);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  $('.cancel').addEventListener('click', закрыть);
  // Крестик в шапке: нижняя «Закрыть» на телефоне уходила за край экрана.
  $('.hud-arc-x').addEventListener('click', закрыть);

  // --- Диапазон ---
  const поля = { from: $('.hud-arc-from'), to: $('.hud-arc-to'), sFrom: $('.hud-arc-slide-from'), sTo: $('.hud-arc-slide-to') };
  // Пустое поле заменяем краем чата, но ноль — это выбор пользователя, а не
  // пустота: через `|| последний` конец диапазона нельзя было поставить на
  // самое первое сообщение.
  const число = (поле, поумолчанию) => {
    const v = parseInt(поле.value, 10);
    return Number.isNaN(v) ? поумолчанию : Math.max(0, Math.min(последний, v));
  };
  const диапазон = () => {
    let a = число(поля.from, 0);
    let b = число(поля.to, последний);
    if (b < a) [a, b] = [b, a];
    return [a, b];
  };
  const синхронизировать = (изПолзунка) => {
    if (изПолзунка) { поля.from.value = поля.sFrom.value; поля.to.value = поля.sTo.value; }
    const [a, b] = диапазон();
    поля.from.value = a; поля.to.value = b; поля.sFrom.value = a; поля.sTo.value = b;
    $('.hud-arc-total').textContent = `выбрано ${b - a + 1} из ${chat.length}`;
  };
  ['input', 'change'].forEach(ev => {
    поля.from.addEventListener(ev, () => синхронизировать(false));
    поля.to.addEventListener(ev, () => синхронизировать(false));
    поля.sFrom.addEventListener(ev, () => синхронизировать(true));
    поля.sTo.addEventListener(ev, () => синхронизировать(true));
  });
  overlay.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.quick;
    поля.to.value = последний;
    поля.from.value = q === 'all' ? 0 : Math.max(0, последний - (parseInt(q, 10) - 1));
    синхронизировать(false);
  }));
  синхронизировать(false);

  // --- Показ отчёта ---
  const показать = () => {
    if (!отчёт) return;
    моменты = отчёт.moments || {};
    const поиск = ($('.hud-arc-search').value || '').trim().toLowerCase();
    вкладки.hidden = false;
    // Число записей на вкладках: видно, где что есть, не открывая.
    const числа = { secrets: отчёт.secrets.length, guns: (отчёт.guns || []).length, pregnancies: беременностиОтчёта(отчёт).эпизоды.length + беременностиОтчёта(отчёт).свободные.length };
    вкладки.querySelectorAll('[data-tab]').forEach(b => {
      let n = b.querySelector('.hud-arc-count');
      if (!(b.dataset.tab in числа)) return;
      if (!n) { n = document.createElement('i'); n.className = 'hud-arc-count'; b.append(n); }
      n.textContent = числа[b.dataset.tab];
      n.hidden = !числа[b.dataset.tab];
    });
    тело.innerHTML =
      активная === 'secrets' ? вкладкаСекретов(отчёт, поиск)
      : активная === 'guns' ? вкладкаРужей(отчёт, поиск)
      : активная === 'relations' ? вкладкаОтношений(отчёт, поиск)
      : активная === 'timeline' ? вкладкаХронологии(отчёт, поиск)
      : активная === 'pregnancies' ? вкладкаБеременностей(отчёт, поиск)
      : активная === 'soundtrack' ? вкладкаСаундтрека(отчёт, поиск)
      : активная === 'dash' ? buildDashboardHTML(отчёт)
      : вкладкаСтатистики(отчёт);
    тело.scrollTop = 0;
  };
  вкладки.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    вкладки.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    активная = b.dataset.tab;
    показать();
  }));
  $('.hud-arc-search').addEventListener('input', показать);
  тело.addEventListener('change', (e) => {
    const галочка = e.target.closest('.hud-dash-pick input[data-widget]');
    if (!галочка) return;
    const прокрутка = тело.scrollTop;
    запомнитьВиджет(галочка.dataset.widget, галочка.checked);
    показать();
    тело.scrollTop = прокрутка;
  });

  // Саундтрек главы — в очередь MoodTube (кнопка видна, только когда он стоит).
  тело.addEventListener('click', (e) => {
    const мт = e.target.closest('[data-arc-mt]');
    if (!мт || !отчёт || !Array.isArray(отчёт.soundtrack)) return;
    const г = отчёт.soundtrack[Number(мт.dataset.arcMt)];
    const api = window.MoodTubeAPI;
    if (!г || !api || typeof api.enqueueMany !== 'function') return;
    const треки = (г.soundtrack || []).filter(т => т.ok !== false).map(т => т.a + ' - ' + т.t);
    try { api.enqueueMany(треки); мт.textContent = 'в очереди: ' + треки.length; } catch (_) { мт.textContent = 'MoodTube не принял'; }
  });

  // Журнал беременностей — файлом, для разбора странностей.
  тело.addEventListener('click', (e) => {
    if (!e.target.closest('[data-arc-preglog]')) return;
    const ссылкаНаФайл = document.createElement('a');
    ссылкаНаФайл.href = URL.createObjectURL(new Blob([JSON.stringify(журналБеременностей(), null, 2)], { type: 'application/json' }));
    ссылкаНаФайл.download = 'hud-pregnancy-log.json';
    ссылкаНаФайл.click();
    setTimeout(() => URL.revokeObjectURL(ссылкаНаФайл.href), 5000);
  });

  // Клик по номеру сообщения — прокрутка к нему в чате.
  тело.addEventListener('click', (e) => {
    const btn = e.target.closest('.hud-arc-ref[data-mes]');
    if (!btn) return;
    const el = document.querySelector(`#chat .mes[mesid="${btn.dataset.mes}"]`);
    if (!el) { btn.classList.add('is-missing'); setTimeout(() => btn.classList.remove('is-missing'), 900); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('hud-arc-flash');
    setTimeout(() => el.classList.remove('hud-arc-flash'), 1600);
  });

  // --- Запуск ---
  const мета = $('.hud-arc-meta');
  const запустить = async (изКэша) => {
    if (идётАнализ) return;
    const [a, b] = диапазон();

    // Добавленный чат вырос с прошлого раза: сначала перечитываем его, и
    // старый отчёт из кэша уже не годится.
    let освежён = false;
    try { освежён = await освежитьЧат(); } catch (e) { console.warn('[TavernOS HUD] добавленный чат не перечитался', e); }
    if (изКэша !== false && !освежён) {
      const кэш = await readCache(a, b);
      if (кэш && !кэш.stale) {
        отчёт = кэш.report;
        мета.innerHTML = `из кэша от ${new Date(кэш.savedAt).toLocaleString()} · <button type="button" class="hud-arc-again">пересчитать</button>`;
        мета.querySelector('.hud-arc-again').addEventListener('click', () => запустить(false));
        $('.hud-arc-export').disabled = false;
        показать();
        return;
      }
    }

    идётАнализ = true;
    прогресс.hidden = false;
    $('.hud-arc-run').disabled = true;
    тело.innerHTML = '<div class="hud-arc-empty">Разбираю сообщения…</div>';
    const полоса = прогресс.querySelector('.hud-arc-bar');
    const подпись = прогресс.querySelector('span');

    try {
      отчёт = await analyzeChat(a, b, {
        shouldStop: () => отменено,
        onProgress: (готово, всего) => {
          const pct = Math.round(готово / всего * 100);
          полоса.style.width = pct + '%';
          подпись.textContent = `${готово} из ${всего}`;
        },
      });
    } catch (e) {
      console.error('[TavernOS HUD] Архив: анализ не удался', e);
      тело.innerHTML = `<div class="hud-arc-empty">Не получилось разобрать чат: ${escapeHtml(String(e && e.message || e))}</div>`;
      идётАнализ = false; прогресс.hidden = true; $('.hud-arc-run').disabled = false;
      return;
    }
    идётАнализ = false;
    прогресс.hidden = true;
    $('.hud-arc-run').disabled = false;
    if (!отчёт) return; // окно закрыли во время разбора

    const сохранён = await writeCache(a, b, отчёт);
    мета.textContent = `сообщений с HUD: ${отчёт.stats.withHud} из ${отчёт.stats.totalMessages}`
      + (отчёт.stats.brokenHud ? ` · битых: ${отчёт.stats.brokenHud}` : '')
      + (отчёт.stats.fromChronicle ? ` · из летописи: ${отчёт.stats.fromChronicle}` : '')
      + (отчёт.stats.chronicleOnly ? ` · вне чата: ${отчёт.stats.chronicleOnly}` : '')
      + (сохранён ? '' : ' · кэш не поместился');
    $('.hud-arc-export').disabled = false;
    показать();
  };
  $('.hud-arc-run').addEventListener('click', () => запустить(true));

  // --- Летопись: своя и добавленная к ней вручную (chronicle-store.js) ---
  const выборЛетописи = $('.hud-arc-chron-sel');
  const инфоЛетописи = $('.hud-arc-chron-info');
  const ctxЛ = () => window.SillyTavern?.getContext?.();
  const диапазонДат = (л) => л.с ? ' · ' + л.с + (л.по && л.по !== л.с ? ' – ' + л.по : '') : '';
  const показатьСовпадения = async () => {
    const c = ctxЛ(), доп = выбраннаяЛетопись(c);
    if (!доп) {
      const { совпало } = await совпаденийСЧатом(свойФайлЛетописи(c));
      инфоЛетописи.textContent = совпало ? `своя совпадает с сообщениями чата: ${совпало}` : 'в своей пока нет ходов этого чата';
      return;
    }
    const { совпало, новых, вне } = await совпаденийСЧатом(доп);
    инфоЛетописи.textContent = `совпадает с сообщениями чата: ${совпало}, из них нет в своей: ${новых}`
      + (вне ? `; ходов, которых в чате нет: ${вне} — архив добавит их без дублей` : '');
  };
  // В списке — чаты персонажа (их файл HUD прочитает сам) и летописи из
  // указателя, у которых здесь нет чата. Значение: «chat:<id>» или «chron:<файл>».
  // Пока ищем, список закрыт и подписан «ищу чаты…»: чаты персонажа Таверна
  // читает с диска целиком, на длинных чатах это секунды, и пустой список
  // «ничего» выглядел так, будто HUD чатов не видит. Список — только после
  // полной загрузки.
  const ищу = (текст) => {
    выборЛетописи.disabled = true;
    выборЛетописи.innerHTML = '<option value="">ищу чаты…</option>';
    инфоЛетописи.innerHTML = `<i class="hud-arc-spin" aria-hidden="true"></i>${escapeHtml(текст)}`;
  };
  // Чаты персонажа читаются с диска целиком: на 18 чатах это минуты, поэтому
  // после выбора список собирается из уже найденного, а не ищется заново.
  let найденныеЧаты = null;
  const заполнитьСписок = async () => {
    if (!найденныеЧаты) ищу('ищу другие чаты персонажа и летописи…');
    const c = ctxЛ();
    const своя = свойФайлЛетописи(c), текущая = выбраннаяЛетопись(c), чатВыбран = выбранныйЧат(c);
    const идЧата = String((typeof c?.getCurrentChatId === 'function' && c.getCurrentChatId()) || '');
    let чатыНеПрочитались = false;
    const [список, чаты] = await Promise.all([списокЛетописей(), найденныеЧаты || чатыПерсонажа().catch(() => { чатыНеПрочитались = true; return []; })]);
    if (!чатыНеПрочитались) найденныеЧаты = чаты;
    const поФайлу = new Map(список.map(л => [л.файл, л]));
    const моя = поФайлу.get(своя);
    // «N ход.» словарь по-английски видел как «N turn.» — число ходов собираем сразу на языке.
    const ходовЛетописи = (n) => (английский() ? `${n || 0} turns` : `${n || 0} ход.`);
    const летописьЧата = (л) => л ? ` · летопись: ${ходовЛетописи(л.ходов)}${диапазонДат(л)}` : '';
    const другиеЧаты = чаты.filter(ч => ч.id !== идЧата);
    const опцииЧатов = другиеЧаты.map(ч => `<option value="chat:${escapeHtml(ч.id)}">${escapeHtml(ч.id)} · ${ч.сообщений} сообщ.${ч.летопись === своя ? ' · копия этого чата' : escapeHtml(летописьЧата(поФайлу.get(ч.летопись)))}</option>`).join('');
    const уЧатов = new Set(чаты.map(ч => ч.летопись));
    const чужие = список.filter(л => л.файл !== своя && !уЧатов.has(л.файл));
    if (текущая && !уЧатов.has(текущая) && !чужие.some(л => л.файл === текущая)) чужие.unshift({ файл: текущая });
    const опцииЛетописей = чужие.map(л => `<option value="chron:${escapeHtml(л.файл)}">${escapeHtml(`${л.чат || л.файл}${л.персонаж ? ' — ' + имяБезПриставки(л.персонаж) : ''} · ${ходовЛетописи(л.ходов)}${диапазонДат(л)}`)}</option>`).join('');
    выборЛетописи.innerHTML = `<option value="">только своя${моя ? ` (${ходовЛетописи(моя.ходов)}${диапазонДат(моя)})` : ''}</option>`
      + (опцииЧатов ? `<optgroup label="Чаты персонажа">${опцииЧатов}</optgroup>` : '')
      + (опцииЛетописей ? `<optgroup label="Другие летописи">${опцииЛетописей}</optgroup>` : '');
    // Сначала тот чат, что выбрали сами: копия этого чата делит с ним летопись,
    // и по одной летописи её было бы не найти.
    const этотЧат = (чатВыбран && другиеЧаты.find(ч => ч.id === чатВыбран.id)) || (текущая && другиеЧаты.find(ч => ч.летопись === текущая));
    выборЛетописи.value = этотЧат ? 'chat:' + этотЧат.id : (текущая ? 'chron:' + текущая : '');
    await показатьСовпадения();
    // Что нашлось — первой строкой подсказки, чтобы пустой список не казался поломкой.
    const найдено = чатыНеПрочитались ? 'чаты персонажа не прочитались' : `найдено других чатов: ${другиеЧаты.length}${чужие.length ? `, летописей: ${чужие.length}` : ''}`;
    инфоЛетописи.textContent = найдено + ' · ' + инфоЛетописи.textContent;
    выборЛетописи.disabled = false;
  };
  // Собрать летопись из чата персонажа и запомнить выбор.
  const добавитьЧат = async (id) => {
    const итог = await летописьИзЧата(id, (i, n) => { инфоЛетописи.innerHTML = `<i class="hud-arc-spin" aria-hidden="true"></i>читаю чат: ${i} из ${n} сообщений`; });
    const ч = (найденныеЧаты || []).find(x => x.id === id);
    await выбратьЛетопись(итог.файл, { id, сообщений: ч ? ч.сообщений : 0 });
    return итог;
  };
  // Перед анализом: если в выбранном чате с тех пор прибавились сообщения.
  const освежитьЧат = async () => {
    const в = выбранныйЧат(ctxЛ());
    const ч = в && найденныеЧаты && найденныеЧаты.find(x => x.id === в.id);
    // Открытый чат пишет свою летопись сам: перечитывать его файл незачем.
    const открыт = String((typeof ctxЛ()?.getCurrentChatId === 'function' && ctxЛ().getCurrentChatId()) || '');
    if (!ч || ч.id === открыт || ч.сообщений === в.сообщений) return false;
    выборЛетописи.disabled = true;
    try {
      const итог = await добавитьЧат(в.id);
      await заполнитьСписок();
      инфоЛетописи.textContent = `чат добавлен, ходов: ${итог.ходов}` + ' · ' + инфоЛетописи.textContent;
    } finally { выборЛетописи.disabled = false; }
    return true;
  };
  заполнитьСписок().catch(e => { выборЛетописи.disabled = false; инфоЛетописи.textContent = 'список летописей не загрузился'; console.warn('[TavernOS HUD] летописи', e); });
  выборЛетописи.addEventListener('change', async () => {
    const v = выборЛетописи.value;
    выборЛетописи.disabled = true;
    let итогЧата = '';
    try {
      if (v.startsWith('chat:')) {
        // Список не трогаем: выбранный чат остаётся на виду, пока он читается.
        инфоЛетописи.innerHTML = '<i class="hud-arc-spin" aria-hidden="true"></i>читаю выбранный чат…';
        const итог = await добавитьЧат(v.slice(5));
        // Копия или ветка открытого чата: летопись у них одна, отдельного выбора нет.
        if (итог.файл === свойФайлЛетописи(ctxЛ())) итогЧата = `это ветка открытого чата: её ходы вошли в свою летопись, новых: ${итог.новых}`;
        else итогЧата = `чат добавлен, ходов: ${итог.ходов}`;
      } else await выбратьЛетопись(v.startsWith('chron:') ? v.slice(6) : null);
      await заполнитьСписок();
      if (итогЧата) инфоЛетописи.textContent = итогЧата + ' · ' + инфоЛетописи.textContent;
    } catch (e) {
      // Список возвращаем: иначе выбрать другой чат было бы не из чего.
      try { await заполнитьСписок(); } catch (_) { /* покажем саму ошибку */ }
      инфоЛетописи.textContent = 'не получилось: ' + (e && e.message || e);
      console.warn('[TavernOS HUD] летопись из чата', e);
    } finally { выборЛетописи.disabled = false; }
    if (отчёт) запустить(false);
  });

  // --- Экспорт ---
  $('.hud-arc-export').addEventListener('click', () => {
    if (!отчёт) return;
    const blob = new Blob([JSON.stringify(отчёт, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hud-архив-${отчёт.range.from}-${отчёт.range.to}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
