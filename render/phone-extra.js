// hud-manager/render/phone-extra.js
//
// Приложения телефона, которым модель ничего нового не пишет:
//   «Погода»  — плашка сцены (sc.Wt, время, дата) и прогноз из «Мира»;
//   «Звонки»  — журнал из тегов [CALL: …] во всех переписках, и нынешних, и
//               прошлых ходов (их собирает render/carryover.js);
//   «Карты»   — сохранённые места на нарисованной схеме города.
// Всё строится из того, что уже есть в HUD, — в промт не уходит ни символа.

import { escapeHtml, defeatWI, hudHashSeed, getSafeUserName } from '../utils.js?v=23.4.6';
import { HUD_AVATAR_COLORS, overrideAvatarUrl, getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=23.4.6';
import { G_ICONS } from './icons.js?v=23.4.6';
import { parseCall } from './msg-parts.js?v=23.4.6';
import { parseMsgParties } from './phone-common.js?v=23.4.6';
import { дниСообщений, моментПоследнего, полеВремени } from './msg-feed.js?v=23.4.6';
import { W_ICONS, forecastLook, parseForecastRow, parseTempC } from './world.js?v=23.4.6';
import { namesLikelySame } from '../names.js?v=23.4.6';

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
  const пропущено = звонки.filter(з => з.outcome === 'missed').length;

  let день = null;
  const тело = строки.map(з => {
    const шапка = з.деньКлюч !== день ? `<div class="hud-calls-day">${escapeHtml(з.деньПодпись || 'Раньше')}</div>` : '';
    день = з.деньКлюч;
    const значок = з.outcome === 'missed' ? G_ICONS.callMiss : з.dir === 'out' ? G_ICONS.callOut : G_ICONS.callIn;
    const вид = з.dir === 'out' ? 'Исходящий' : 'Входящий';
    const исход = ИСХОД[з.outcome];
    const подпись = [исход ? `${вид}, ${исход}` : вид, з.outcome === 'answered' && з.dur ? з.dur : ''].filter(Boolean).join(' · ');
    return шапка + `<div class="hud-calls-row is-${з.outcome} dir-${з.dir}">
      ${лицо(з.кто, 'hud-calls-ava')}
      <span class="hud-calls-body">
        <b>${defeatWI(escapeHtml(з.кто))}${з.раз > 1 ? ` <em>(${з.раз})</em>` : ''}</b>
        <small><i class="hud-calls-ico">${значок}</i>${escapeHtml(подпись)}</small>
        ${з.заметка ? `<span class="hud-calls-note">${defeatWI(escapeHtml(з.заметка))}</span>` : ''}
      </span>
      <span class="hud-calls-time">${escapeHtml(з.часы)}</span>
    </div>`;
  }).join('');

  // Вкладки «Все» и «Пропущенные» — радиокнопками, без скриптов.
  const id = 'hud-calls-' + (uid || hudHashSeed(тело).toString(36));
  return `<div class="hud-calls">
    <input type="radio" name="${id}" id="${id}-all" class="hud-calls-tab-in is-all" checked>
    <input type="radio" name="${id}" id="${id}-miss" class="hud-calls-tab-in is-miss">
    <div class="hud-calls-tabs">
      <label for="${id}-all">Все</label>
      <label for="${id}-miss">Пропущенные${пропущено ? ` <i>${пропущено}</i>` : ''}</label>
    </div>
    <div class="hud-calls-list">${тело}</div>
  </div>`;
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
