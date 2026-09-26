// hud-manager/render/phone-extra.js
//
// Приложения телефона, которым модель ничего нового не пишет:
//   «Погода»  — плашка сцены (sc.Wt, время, дата) и прогноз из «Мира»;
//   «Звонки»  — журнал из тегов [CALL: …] во всех переписках, и нынешних, и
//               прошлых ходов (их собирает render/carryover.js);
//   «Здоровье» — сон, шаги и пульс из phn.hl, день и неделя из прошлых ходов,
//               «Тело сейчас» из Vit, карты тела и болезней владельца;
//   «Карты»   — сохранённые места на нарисованной схеме города.
// Кроме «Здоровья» всё строится из того, что уже есть в HUD.

import { escapeHtml, defeatWI, hudHashSeed, getSafeUserName } from '../utils.js?v=23.13.2';
import { HUD_AVATAR_COLORS, overrideAvatarUrl, getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=23.13.2';
import { G_ICONS } from './icons.js?v=23.13.2';
import { parseCall } from './msg-parts.js?v=23.13.2';
import { parseMsgParties } from './phone-common.js?v=23.13.2';
import { дниСообщений, моментПоследнего, полеВремени } from './msg-feed.js?v=23.13.2';
import { W_ICONS, forecastLook, parseForecastRow, parseTempC } from './world.js?v=23.13.2';
import { namesLikelySame } from '../names.js?v=23.13.2';
import { зоныКарты } from './intimacy.js?v=23.13.2';
import { сводкаБолезней } from './character.js?v=23.13.2';

const текст = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const пусто = (v) => !текст(v) || /^(empty|none|null|нет|пусто)$/i.test(текст(v));
const пустойЭкран = (icon, text) => `<div class="hud-phone-empty-app"><div class="hud-phone-empty-icon">${icon}</div><div class="hud-phone-empty-line">${escapeHtml(text)}</div></div>`;

// Лицо собеседника: ручная аватарка, аватарка персоны игрока, карточка
// персонажа в Таверне — что найдётся первым. Иначе кружок с буквой.
function лицо(имя, класс) {
  const игрок = getSafeUserName();
  let url = overrideAvatarUrl(имя);
  if (!url && игрок && namesLikelySame(имя, игрок)) url = getUserAvatarUrl();
  if (!url) { const a = getAvatarUrl(имя, false); url = a && a.url; }
  const буква = текст(имя).charAt(0).toUpperCase() || '?';
  const фон = `linear-gradient(150deg, ${HUD_AVATAR_COLORS[hudHashSeed(имя) % HUD_AVATAR_COLORS.length]}, rgba(0,0,0,.5))`;
  return `<span class="${класс}${url ? ' has-img' : ''}" data-ava-name="${escapeHtml(имя)}" data-ava-auto="1" data-ava-bg="${escapeHtml(фон)}" style="background-image:${url ? `url('${escapeHtml(url)}')` : фон}">${escapeHtml(буква)}</span>`;
}

// --- Погода ----------------------------------------------------------------

const ЛУНА = '<svg viewBox="0 0 24 24" class="hud-fc-ico"><path class="ic-moon" d="M19.4 14.6A7.6 7.6 0 0 1 9.4 4.6a7.6 7.6 0 1 0 10 10Z"/></svg>';

// «мелкий дождь, +9°C, ветер с реки» → температура, главное и подробности.
export function разобратьПогоду(строка) {
  const s = текст(строка);
  const t = s.match(/[+\-−]?\s?\d+(?:[.,]\d+)?\s*°\s*[CСF]?/i);
  const градусы = t ? parseTempC(t[0].replace('−', '-').replace(/\s/g, '')) : null;
  const части = s.replace(t ? t[0] : '', '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
  return { градусы, главное: части[0] || '', подробности: части.slice(1) };
}

const часСцены = (время) => { const m = текст(время).match(/\b(\d{1,2}):\d{2}\b/); return m ? +m[1] : null; };
const ночь = (час) => час !== null && (час >= 21 || час < 6);
const знак = (t) => (t > 0 ? '+' : '') + Math.round(t) + '°';

export function buildWeatherApp(scene, world, место) {
  const sc = scene && typeof scene === 'object' ? scene : {};
  const строка = пусто(sc['Погода']) ? '' : текст(sc['Погода']);
  const прогноз = (world && Array.isArray(world.forecast) ? world.forecast : []).filter(r => !пусто(r));
  if (!строка && !прогноз.length) return пустойЭкран(W_ICONS.cloudy, 'Погоды пока нет — она появится с плашкой сцены');

  const п = разобратьПогоду(строка);
  const вид = forecastLook(строка);
  const час = часСцены(sc['Время']);
  const значок = вид.icon === 'clear' && ночь(час) ? ЛУНА : W_ICONS[вид.icon];
  const где = пусто(место) ? '' : текст(место).split(',')[0];
  const время = (текст(sc['Время']).match(/\b\d{1,2}:\d{2}\b/) || [''])[0];
  const дата = пусто(sc['Дата']) ? '' : текст(sc['Дата']);
  const тепло = п.градусы === null ? '' : ` style="--t:${Math.max(0, Math.min(1, (п.градусы + 25) / 60)).toFixed(2)}"`;

  const сейчас = строка ? `<div class="hud-wx-now w-${вид.icon}${ночь(час) ? ' is-night' : ''}"${тепло}>
      ${где ? `<div class="hud-wx-place">${G_ICONS.pin}<span>${defeatWI(escapeHtml(где))}</span></div>` : ''}
      <div class="hud-wx-main">
        <span class="hud-wx-temp">${п.градусы === null ? '—' : escapeHtml(знак(п.градусы))}</span>
        <span class="hud-wx-ico">${значок}</span>
      </div>
      <div class="hud-wx-cond">${escapeHtml(п.главное || вид.label || строка)}</div>
      ${п.подробности.length ? `<div class="hud-wx-extra">${п.подробности.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</div>` : ''}
      ${время || дата ? `<div class="hud-wx-when">${escapeHtml([дата, время].filter(Boolean).join(' · '))}</div>` : ''}
    </div>` : '';

  const строки = прогноз.map(r => {
    const f = parseForecastRow(r);
    const look = forecastLook(f.weather + ' ' + f.note);
    const t = parseTempC(f.temp);
    const доля = t === null ? null : Math.max(0, Math.min(1, (t + 25) / 60));
    return `<div class="hud-wx-row"${доля === null ? '' : ` style="--t:${доля.toFixed(2)}"`}>
      <span class="hud-wx-period">${escapeHtml(f.period || '—')}</span>
      <span class="hud-wx-row-ico w-${look.icon}">${/ночь|night/i.test(f.period) && look.icon === 'clear' ? ЛУНА : W_ICONS[look.icon]}</span>
      <span class="hud-wx-row-desc">${escapeHtml(f.weather || look.label)}${f.note ? `<small>${escapeHtml(f.note)}</small>` : ''}</span>
      <span class="hud-wx-row-temp">${t === null ? escapeHtml(f.temp) : escapeHtml(знак(t))}</span>
    </div>`;
  }).join('');

  return `<div class="hud-wx">${сейчас}${строки ? `<div class="hud-wx-fc"><div class="hud-wx-fc-title">Прогноз на сегодня</div>${строки}</div>` : ''}</div>`;
}

// --- Звонки ------------------------------------------------------------------

const ОБЩИЙ_АДРЕСАТ = /^(all|все|группа|group|чат|chat)$/i;

// Строки со звонками из всех переписок: { чат, строка, группа }.
export function звонкиИзЧатов(chatsMap) {
  const out = [];
  for (const [имя, чат] of Object.entries(chatsMap || {})) {
    const msgs = Array.isArray(чат && чат.messages) ? чат.messages : [];
    for (const m of msgs) {
      if (/\[(?:CALL|ЗВОНОК)\b/i.test(String(m))) out.push({ чат: имя, строка: String(m), группа: !пусто(чат && чат.participants) });
    }
  }
  return out;
}

// Один звонок в понятном виде. Направление — из тега, иначе по отправителю:
// владелец позвонил сам — исходящий.
function разобратьЗвонок(запись, владелец, сцена) {
  const call = parseCall(запись.строка);
  if (!call) return null;
  const { sender, recipient } = parseMsgParties(запись.строка);
  const отВладельца = sender && владелец && namesLikelySame(sender, владелец);
  const dir = call.dir || (отВладельца ? 'out' : 'in');
  let кто = отВладельца ? recipient : sender;
  // Собеседник — «другая» сторона; если стороны перепутаны, берём ту, что не владелец.
  if (кто && владелец && namesLikelySame(кто, владелец)) кто = отВладельца ? sender : recipient;
  if (запись.группа || !кто || ОБЩИЙ_АДРЕСАТ.test(кто) || (владелец && namesLikelySame(кто, владелец))) кто = запись.чат;
  const день = дниСообщений([запись.строка], сцена)[0] || {};
  const часы = (полеВремени(запись.строка).match(/\d{1,2}:\d{2}/) || [''])[0];
  const заметка = String(запись.строка.split('|')[0]).replace(/^[^:]*:\s*/, '').replace(call.tag, '').trim();
  return {
    кто: текст(кто) || 'Неизвестный', dir, outcome: call.outcome, dur: call.dur, заметка, часы,
    деньКлюч: день.ключ || '', деньПодпись: день.подпись || '',
    момент: моментПоследнего([запись.строка], сцена),
  };
}

const ИСХОД = { answered: '', declined: 'отклонён', missed: 'пропущен' };

export function buildCallsApp(chatsMap, журнал, владелец, сцена, uid = '') {
  // Звонки текущих переписок плюс журнал прошлых ходов; повторы — одна запись.
  const все = [...(Array.isArray(журнал) ? журнал : []), ...звонкиИзЧатов(chatsMap)];
  const виден = new Set();
  const звонки = [];
  for (const запись of все) {
    const з = запись && запись.строка ? разобратьЗвонок(запись, владелец, сцена) : null;
    if (!з) continue;
    // День в ключ не входит: прошлый ход проставил звонку дату, а текущий
    // повторяет его голыми часами. Раньше в списке — журнал, он точнее.
    const k = [з.кто.toLowerCase(), з.dir, з.outcome, з.часы, з.заметка.toLowerCase()].join('|');
    if (виден.has(k)) continue;
    виден.add(k);
    звонки.push(з);
  }
  if (!звонки.length) return пустойЭкран(G_ICONS.callIn, 'Журнал звонков пуст');
  звонки.sort((a, b) => b.момент - a.момент);

  // Подряд идущие одинаковые звонки одного человека в один день — одна
  // строка с числом, как в настоящем журнале.
  const строки = [];
  for (const з of звонки) {
    const пред = строки[строки.length - 1];
    if (пред && пред.кто === з.кто && пред.dir === з.dir && пред.outcome === з.outcome && пред.деньКлюч === з.деньКлюч && з.outcome !== 'answered') { пред.раз++; continue; }
    строки.push({ ...з, раз: 1 });
  }
  // Три непересекающихся вида, как в журнале телефона: пропущенные — это
  // входящие без ответа; исходящие — все мои, дозвонилась или нет; входящие —
  // принятые и сброшенные.
  const видЗвонка = (з) => з.dir === 'out' ? 'out' : з.outcome === 'missed' ? 'miss' : 'in';
  const пропущено = звонки.filter(з => видЗвонка(з) === 'miss').length;

  // Строки по дням: у дня отмечено, какие виды в нём есть, — при фильтре
  // пустой день прячется вместе с заголовком.
  const дни = [];
  for (const з of строки) {
    const посл = дни[дни.length - 1];
    if (посл && посл.ключ === з.деньКлюч) посл.строки.push(з);
    else дни.push({ ключ: з.деньКлюч, подпись: з.деньПодпись || 'Раньше', строки: [з] });
  }
  const тело = дни.map(д => {
    const виды = new Set(д.строки.map(видЗвонка));
    return `<div class="hud-calls-daygrp${[...виды].map(в => ' has-' + в).join('')}"><div class="hud-calls-day">${escapeHtml(д.подпись)}</div>` + д.строки.map(з => {
      const значок = з.outcome === 'missed' ? G_ICONS.callMiss : з.dir === 'out' ? G_ICONS.callOut : G_ICONS.callIn;
      const вид = з.dir === 'out' ? 'Исходящий' : 'Входящий';
      const исход = ИСХОД[з.outcome];
      const подпись = [исход ? `${вид}, ${исход}` : вид, з.outcome === 'answered' && з.dur ? з.dur : ''].filter(Boolean).join(' · ');
      return `<div class="hud-calls-row is-${з.outcome} dir-${з.dir} kind-${видЗвонка(з)}">
      ${лицо(з.кто, 'hud-calls-ava')}
      <span class="hud-calls-body">
        <b>${defeatWI(escapeHtml(з.кто))}${з.раз > 1 ? ` <em>(${з.раз})</em>` : ''}</b>
        <small><i class="hud-calls-ico">${значок}</i>${escapeHtml(подпись)}</small>
        ${з.заметка ? `<span class="hud-calls-note">${defeatWI(escapeHtml(з.заметка))}</span>` : ''}
      </span>
      <span class="hud-calls-time">${escapeHtml(з.часы)}</span>
    </div>`;
    }).join('') + '</div>';
  }).join('');

  // Вкладки-фильтры — радиокнопками, без скриптов.
  const id = 'hud-calls-' + (uid || hudHashSeed(тело).toString(36));
  const вкладки = [['all', 'Все', 'Все звонки'], ['miss', 'Пропущ.', 'Пропущенные'], ['out', 'Исходящ.', 'Исходящие'], ['in', 'Входящ.', 'Входящие']];
  const есть = new Set(звонки.map(видЗвонка));
  const пустые = ['miss', 'out', 'in'].filter(в => !есть.has(в)).map(в => ' none-' + в).join('');
  return `<div class="hud-calls${пустые}">
    ${вкладки.map(([к], i) => `<input type="radio" name="${id}" id="${id}-${к}" class="hud-calls-tab-in is-${к}"${i ? '' : ' checked'}>`).join('')}
    <div class="hud-calls-tabs">
      ${вкладки.map(([к, коротко, полно]) => `<label for="${id}-${к}" class="t-${к}" title="${полно}">${коротко}${к === 'miss' && пропущено ? ` <i>${пропущено}</i>` : ''}</label>`).join('')}
    </div>
    <div class="hud-calls-list">${тело}<div class="hud-calls-none">Таких звонков нет</div></div>
  </div>`;
}

// --- Здоровье ----------------------------------------------------------------
// Как приложение часов: сон прошлой ночи, шаги и пульс за день. Модель пишет
// в phn.hl только «сейчас»; день складывается из прошлых ходов (журнал копит
// render/carryover.js). Во время сцены пульс берётся из Vit, а «Тело» внизу —
// из карты тела и болезней владельца: одни и те же числа, что в карточке.

const ЦЕЛЬ_ШАГОВ = 8000;
const числоИз = (v) => { const m = текст(v).replace(/[\s ]/g, '').match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
const минутыИз = (v) => { const m = текст(v).match(/\b(\d{1,2}):(\d{2})\b/); return m && +m[1] < 24 ? +m[1] * 60 + +m[2] : null; };
const ЧЧММ = (м) => String(Math.floor(м / 60) % 24).padStart(2, '0') + ':' + String(Math.round(м % 60)).padStart(2, '0');
const тысячи = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// «Четверг, 17.10.2024» → «17.10»: неделя уложится без года.
function деньИз(дата) {
  const m = текст(дата).match(/\b(\d{1,2})[./](\d{1,2})(?:[./]\d{2,4})?\b/);
  return m ? m[1].padStart(2, '0') + '.' + m[2].padStart(2, '0') : '';
}

function карточкаВладельца(characters, владелец) {
  const все = (Array.isArray(characters) ? characters : []).filter(c => c && typeof c === 'object');
  return все.find(c => владелец && c['Имя'] && namesLikelySame(c['Имя'], владелец)) || null;
}

const поле = (о, ключ) => (о && !пусто(о[ключ]) ? текст(Array.isArray(о[ключ]) ? о[ключ].join('; ') : о[ключ]) : '');
function витал(о) {
  const v = поле(о, 'Жизненные показатели');
  const взять = (rx) => { const m = v.match(rx); return m ? m[1].trim() : ''; };
  return {
    пульс: числоИз(взять(/(?:^|[;\n])\s*(?:hr|пульс)\s*[:：]\s*([^;\n]+)/i)),
    дыхание: взять(/(?:^|[;\n])\s*(?:br|дыхание)\s*[:：]\s*([^;\n]+)/i),
    t: числоИз(взять(/(?:^|[;\n])\s*(?:tmp|температура)\s*[:：]\s*([^;\n]+)/i)),
  };
}

// Одна запись журнала из хода: день, минута сцены, сон, шаги, пульс.
export function записьЗдоровья(ход) {
  if (!ход || typeof ход !== 'object') return null;
  const тел = ход.phone && typeof ход.phone === 'object' ? ход.phone : {};
  const зд = тел.health && typeof тел.health === 'object' ? тел.health : {};
  const сц = ход.scene && typeof ход.scene === 'object' ? ход.scene : {};
  const о = карточкаВладельца(ход.characters, тел.owner) || (Array.isArray(ход.characters) ? ход.characters[0] : null);
  const изСцены = витал(о).пульс;
  const пульс = изСцены ?? числоИз(зд.pulse);
  const шаги = числоИз(зд.steps);
  const сон = пусто(зд.sleep) ? '' : текст(зд.sleep);
  if (пульс === null && шаги === null && !сон) return null;
  return { день: деньИз(сц['Дата']), мин: минутыИз(сц['Время']), пульс, шаги, сон, сцена: изСцены !== null };
}

const таЖеЗапись = (a, b) => a.день === b.день && a.мин === b.мин && a.пульс === b.пульс && a.шаги === b.шаги && a.сон === b.сон;

// Журнал без повторов подряд: перегенерация одного хода не удваивает точки.
export function склеитьЗдоровье(журнал, запись, предел = 150) {
  const out = Array.isArray(журнал) ? [...журнал] : [];
  if (запись && !(out.length && таЖеЗапись(out[out.length - 1], запись))) out.push(запись);
  return out.slice(-предел);
}

// «00:40–07:10, прерывистый» → { мин: 390, с: '00:40', до: '07:10', заметка }.
function разобратьСон(s) {
  const t = текст(s);
  const m = t.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (m) {
    const a = минутыИз(m[1]), b = минутыИз(m[2]);
    return { мин: (b - a + 1440) % 1440 || null, с: m[1], до: m[2], заметка: t.replace(m[0], '').replace(/^[\s,;.—-]+|[\s,;.]+$/g, '') };
  }
  const ч = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|ч)/i), мм = t.match(/(\d+)\s*(?:m|мин|м)(?![\p{L}])/iu);
  const мин = (ч ? parseFloat(ч[1].replace(',', '.')) * 60 : 0) + (мм ? +мм[1] : 0);
  return { мин: мин || null, с: '', до: '', заметка: t.replace(ч ? ч[0] : '', '').replace(мм ? мм[0] : '', '').replace(/^[\s,;.—-]+|[\s,;.]+$/g, '') };
}
const длительность = (м) => Math.floor(м / 60) + ' ч' + (м % 60 ? ' ' + Math.round(м % 60) + ' мин' : '');

function графикПульса(точки) {
  const W = 300, H = 112, L = 26, R = 8, T = 10, B = 20;
  const знач = точки.map(т => т.пульс);
  const lo = Math.min(50, ...знач.map(v => v - 6)), hi = Math.max(120, ...знач.map(v => v + 6));
  const x = (м) => L + (м / 1440) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const сетка = [0, 360, 720, 1080, 1440].map(м => `<line class="hl-grid" x1="${x(м).toFixed(1)}" x2="${x(м).toFixed(1)}" y1="${T}" y2="${H - B}"/><text class="hl-tick" x="${x(м).toFixed(1)}" y="${H - 6}">${м === 1440 ? '24' : String(м / 60).padStart(2, '0')}</text>`).join('');
  const ось = [60, 100].filter(v => v > lo && v < hi).map(v => `<text class="hl-tick is-y" x="${L - 4}" y="${(y(v) + 3).toFixed(1)}">${v}</text>`).join('');
  // Полоса покоя 60–100: всё, что выше, — нагрузка, волнение или сцена.
  const покой = `<rect class="hl-rest" x="${L}" y="${y(Math.min(100, hi)).toFixed(1)}" width="${W - L - R}" height="${(y(Math.max(60, lo)) - y(Math.min(100, hi))).toFixed(1)}"/>`;
  const путь = точки.length > 1 ? `<path class="hl-line" d="${точки.map((т, i) => (i ? 'L' : 'M') + x(т.мин).toFixed(1) + ' ' + y(т.пульс).toFixed(1)).join(' ')}"/>` : '';
  const точкиSvg = точки.map((т, i) => `<g class="hl-pt${т.сцена ? ' is-scene' : ''}${i === точки.length - 1 ? ' is-now' : ''}"><circle class="hl-hit" cx="${x(т.мин).toFixed(1)}" cy="${y(т.пульс).toFixed(1)}" r="9"/><circle class="hl-dot" cx="${x(т.мин).toFixed(1)}" cy="${y(т.пульс).toFixed(1)}" r="4"/><title>${ЧЧММ(т.мин)} — ${Math.round(т.пульс)} уд/мин${т.сцена ? ' · во время сцены' : ''}</title></g>`).join('');
  const посл = точки[точки.length - 1];
  const подпись = `<text class="hl-now" x="${Math.min(W - R, Math.max(L, x(посл.мин))).toFixed(1)}" y="${(y(посл.пульс) - 8).toFixed(1)}">${Math.round(посл.пульс)}</text>`;
  return `<svg class="hud-hl-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Пульс за день">${покой}${сетка}${ось}${путь}${точкиSvg}${подпись}</svg>`;
}

function кольцоШагов(шаги) {
  const r = 30, длина = 2 * Math.PI * r, доля = Math.max(0, Math.min(1, шаги / ЦЕЛЬ_ШАГОВ));
  return `<svg class="hud-hl-ring" viewBox="0 0 76 76" aria-hidden="true"><circle class="hl-ring-bg" cx="38" cy="38" r="${r}"/>`
    + `<circle class="hl-ring" cx="38" cy="38" r="${r}" stroke-dasharray="${(длина * доля).toFixed(1)} ${длина.toFixed(1)}" transform="rotate(-90 38 38)"/></svg>`;
}

export function buildHealthApp(phone, scene, characters, владелец) {
  const тел = phone && typeof phone === 'object' ? phone : {};
  const о = карточкаВладельца(characters, владелец) || (Array.isArray(characters) ? characters[0] : null);
  const сейчас = записьЗдоровья({ phone: { ...тел, owner: владелец }, scene, characters });
  const журнал = склеитьЗдоровье(Array.isArray(тел.healthLog) ? тел.healthLog : [], сейчас);

  const в = витал(о);
  let болезни = [], зоны = [];
  try { болезни = о ? сводкаБолезней(о) : []; } catch (_) { болезни = []; }
  try { зоны = о ? зоныКарты(поле(о, 'Карта тела')).зоны.filter(з => з.v !== null && Number.isFinite(з.v)).sort((a, b) => b.v - a.v).slice(0, 5) : []; } catch (_) { зоны = []; }
  if (!журнал.length && !болезни.length && !зоны.length && в.пульс === null) return пустойЭкран(G_ICONS.health, 'Часы пока ничего не записали');

  const день = сейчас ? сейчас.день : (журнал[журнал.length - 1] || {}).день;
  const сегодня = журнал.filter(з => з.день === день);
  const последнее = (ключ) => { for (let i = сегодня.length - 1; i >= 0; i--) if (сегодня[i][ключ] !== null && сегодня[i][ключ] !== '') return сегодня[i][ключ]; return null; };
  const шаги = последнее('шаги'), сонТекст = последнее('сон');
  const пульсы = сегодня.filter(з => з.пульс !== null && з.мин !== null).sort((a, b) => a.мин - b.мин);
  const пульсСейчас = (сейчас && сейчас.пульс) ?? последнее('пульс');
  const плитки = [];

  if (шаги !== null) {
    плитки.push(`<div class="hud-hl-tile is-steps" title="Цель — ${тысячи(ЦЕЛЬ_ШАГОВ)} шагов">${кольцоШагов(шаги)}
      <span class="hud-hl-val"><b>${тысячи(шаги)}</b><small>шагов · ${Math.round(Math.min(1, шаги / ЦЕЛЬ_ШАГОВ) * 100)}% цели</small></span></div>`);
  }
  if (сонТекст) {
    const с = разобратьСон(сонТекст);
    const доля = с.мин ? Math.min(1, с.мин / 480) : 0;
    плитки.push(`<div class="hud-hl-tile is-sleep"><span class="hud-hl-kicker">Сон</span>
      <span class="hud-hl-val"><b>${с.мин ? escapeHtml(длительность(с.мин)) : escapeHtml(сонТекст)}</b>${с.с ? `<small>${escapeHtml(с.с)} – ${escapeHtml(с.до)}</small>` : ''}</span>
      ${с.мин ? `<span class="hud-hl-bar" title="${Math.round(доля * 100)}% от 8 часов"><i style="width:${(доля * 100).toFixed(0)}%"></i></span>` : ''}
      ${с.заметка ? `<small class="hud-hl-note">${escapeHtml(с.заметка)}</small>` : ''}</div>`);
  }
  if (пульсСейчас !== null) {
    const все = пульсы.map(з => з.пульс);
    const мин = все.length ? Math.min(...все) : пульсСейчас, макс = все.length ? Math.max(...все) : пульсСейчас;
    плитки.push(`<div class="hud-hl-tile is-pulse${пульсСейчас > 100 ? ' is-high' : ''}"><span class="hud-hl-kicker"><i class="hud-hl-beat" aria-hidden="true">♥</i>Пульс</span>
      <span class="hud-hl-val"><b>${Math.round(пульсСейчас)}</b><small>уд/мин${все.length > 1 ? ` · за день ${Math.round(мин)}–${Math.round(макс)}` : ''}</small></span></div>`);
  }

  const график = пульсы.length ? `<div class="hud-hl-card"><div class="hud-hl-title">Пульс сегодня${день ? ` · ${escapeHtml(день)}` : ''}</div>${графикПульса(пульсы)}
    ${пульсы.length < 2 ? '<small class="hud-hl-note">Точки прибавятся с ходами — часы меряют пульс каждый раз, когда о нём пишут.</small>' : ''}
    ${пульсы.some(т => т.сцена) ? '<small class="hud-hl-legend"><i class="is-scene"></i>во время сцены — из жизненных показателей</small>' : ''}</div>` : '';

  // Неделя: по дню — последние шаги и сон. Больше одного дня — иначе не с чем сравнить.
  const дни = [];
  for (const з of журнал) {
    if (!з.день) continue;
    let д = дни.find(x => x.день === з.день);
    if (!д) дни.push(д = { день: з.день, шаги: null, сон: null });
    if (з.шаги !== null) д.шаги = Math.max(д.шаги || 0, з.шаги);
    if (з.сон) д.сон = разобратьСон(з.сон).мин;
  }
  const неделя = дни.slice(-7);
  const максШаги = Math.max(ЦЕЛЬ_ШАГОВ, ...неделя.map(д => д.шаги || 0));
  const столбцы = неделя.length > 1 && неделя.some(д => д.шаги !== null) ? `<div class="hud-hl-card"><div class="hud-hl-title">Шаги по дням</div><div class="hud-hl-week">${неделя.map(д => `<span class="hud-hl-day${д.день === день ? ' is-today' : ''}" title="${escapeHtml(д.день)}: ${д.шаги === null ? 'нет данных' : тысячи(д.шаги) + ' шагов'}${д.сон ? ' · сон ' + длительность(д.сон) : ''}"><i style="height:${д.шаги === null ? 0 : Math.max(4, д.шаги / максШаги * 100).toFixed(0)}%"></i><small>${escapeHtml(д.день.slice(0, 5))}</small></span>`).join('')}</div></div>` : '';

  // «Тело сейчас»: жизненные показатели, карта тела и болезни — без описаний,
  // только имена и числа: телефон не пересказывает сцену.
  const тело = [];
  if (в.пульс !== null || в.дыхание || в.t !== null) {
    тело.push(`<div class="hud-hl-vitals">${[в.пульс !== null ? `<span><small>пульс</small><b>${Math.round(в.пульс)}</b></span>` : '',
      в.дыхание ? `<span><small>дыхание</small><b>${escapeHtml((в.дыхание.match(/\d+/) || [в.дыхание])[0])}</b></span>` : '',
      в.t !== null ? `<span><small>t°</small><b>${в.t.toFixed(1)}</b></span>` : ''].join('')}</div>`);
  }
  if (зоны.length) {
    тело.push(`<div class="hud-hl-zones">${зоны.map(з => `<span class="hud-hl-zone" title="${escapeHtml(з.имя)}: ${з.v} из 10"><em>${escapeHtml(з.имя)}</em><i><b style="width:${Math.max(0, Math.min(10, з.v)) * 10}%"></b></i><small>${з.v}</small></span>`).join('')}</div>`);
  }
  if (болезни.length) {
    тело.push(`<div class="hud-hl-ills">${болезни.map(б => `<span class="hud-hl-ill"><i aria-hidden="true">${б.значок}</i><em>${escapeHtml(б.что)}</em>${б.стадия ? `<small>${escapeHtml(б.стадия)}</small>` : ''}${б.выздоровление !== null ? `<b>${Math.round(б.выздоровление)}%</b>` : ''}</span>`).join('')}</div>`);
  }
  const блокТела = `<div class="hud-hl-card"><div class="hud-hl-title">Тело сейчас</div>${тело.length ? тело.join('') : '<small class="hud-hl-note">Жалоб нет</small>'}</div>`;

  return `<div class="hud-hl">${плитки.length ? `<div class="hud-hl-tiles">${плитки.join('')}</div>` : ''}${график}${столбцы}${блокТела}</div>`;
}

// --- Карты -------------------------------------------------------------------
// Схема города нарисована из названий мест: одно и то же место всегда на
// одной и той же точке. Реальных координат нет и быть не может — это
// набросок, а не навигатор.

function случай(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function buildMapsApp(maps, место) {
  const точки = (Array.isArray(maps) ? maps : []).filter(m => m && !пусто(m.place || m.title));
  const здесь = пусто(место) ? '' : текст(место);
  if (!точки.length && !здесь) return пустойЭкран(G_ICONS.map, 'Нет сохранённых мест');

  const W = 320, H = 190;
  const r = случай(hudHashSeed(точки.map(m => m.place || m.title).join('|') || здесь));
  // Кварталы: сетка улиц со сдвигами, река, парк.
  const улицы = [];
  for (let x = 20 + r() * 30; x < W; x += 46 + r() * 30) улицы.push(`M${x.toFixed(1)} 0 L${(x + (r() - .5) * 30).toFixed(1)} ${H}`);
  for (let y = 18 + r() * 20; y < H; y += 38 + r() * 22) улицы.push(`M0 ${y.toFixed(1)} L${W} ${(y + (r() - .5) * 26).toFixed(1)}`);
  const рекаY = 40 + r() * (H - 80);
  const река = `M-10 ${рекаY.toFixed(1)} C ${W * .3} ${(рекаY - 40 + r() * 80).toFixed(1)}, ${W * .6} ${(рекаY - 40 + r() * 80).toFixed(1)}, ${W + 10} ${(рекаY - 20 + r() * 40).toFixed(1)}`;
  const паркX = 30 + r() * (W - 110), паркY = 20 + r() * (H - 80);

  // Точки мест: по хэшу названия, с отступом от краёв и друг от друга.
  const занято = [];
  const поставить = (имя) => {
    const q = случай(hudHashSeed(имя));
    let x = 0, y = 0;
    for (let i = 0; i < 12; i++) {
      x = 28 + q() * (W - 56); y = 26 + q() * (H - 52);
      if (!занято.some(([a, b]) => Math.hypot(a - x, b - y) < 30)) break;
    }
    занято.push([x, y]);
    return [x, y];
  };
  const совпадает = (m) => здесь && (namesLikelySame(m.place || m.title, здесь) || здесь.toLowerCase().includes(текст(m.place || m.title).toLowerCase().split(/[«»",]/).filter(Boolean)[0] || '\u0000'));
  const места = точки.map((m, i) => ({ n: i + 1, имя: текст(m.place || m.title), заметка: текст(m.note), тут: совпадает(m), xy: поставить(текст(m.place || m.title)) }));
  const естьТут = места.some(м => м.тут);
  const я = здесь && !естьТут ? { xy: поставить('здесь:' + здесь) } : null;

  const маршрут = места.length > 1 ? `<path class="hud-map-route" d="M${места.map(м => м.xy.map(v => v.toFixed(1)).join(' ')).join(' L')}"/>` : '';
  const svg = `<svg class="hud-map-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect class="hud-map-land" width="${W}" height="${H}"/>
    <ellipse class="hud-map-park" cx="${паркX.toFixed(1)}" cy="${паркY.toFixed(1)}" rx="${(34 + r() * 20).toFixed(1)}" ry="${(18 + r() * 12).toFixed(1)}"/>
    <path class="hud-map-streets" d="${улицы.join(' ')}"/>
    <path class="hud-map-river" d="${река}"/>
    ${маршрут}
    ${места.map(м => `<g class="hud-map-pin${м.тут ? ' is-here' : ''}" data-pin="${м.n}" transform="translate(${м.xy[0].toFixed(1)} ${м.xy[1].toFixed(1)})">
      ${м.тут ? '<circle class="hud-map-pulse" r="11"/>' : ''}<path class="hud-map-drop" d="M0 0 C-7 -9 -7 -17 0 -17 C7 -17 7 -9 0 0 Z"/><text class="hud-map-num" y="-9.5">${м.n}</text></g>`).join('')}
    ${я ? `<g class="hud-map-me" transform="translate(${я.xy[0].toFixed(1)} ${я.xy[1].toFixed(1)})"><circle class="hud-map-pulse" r="11"/><circle class="hud-map-dot" r="4.6"/></g>` : ''}
  </svg>`;

  const список = [
    здесь ? `<div class="hud-map-row is-me"><span class="hud-map-badge">${G_ICONS.pin}</span><div><b>Вы здесь</b><small>${defeatWI(escapeHtml(здесь))}</small></div></div>` : '',
    ...места.map(м => `<div class="hud-map-row${м.тут ? ' is-here' : ''}" data-pin="${м.n}"><span class="hud-map-badge">${м.n}</span><div><b>${defeatWI(escapeHtml(м.имя))}</b>${м.заметка ? `<small>${defeatWI(escapeHtml(м.заметка))}</small>` : ''}</div></div>`),
  ].join('');
  return `<div class="hud-map"><div class="hud-map-canvas">${svg}</div><div class="hud-map-list">${список}</div></div>`;
}
