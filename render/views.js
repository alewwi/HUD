// hud-manager/render/views.js
//
// Виды блоков карточки на выбор (Кастомизация → Вид блоков): доверие, страхи,
// готовность к оргазму, разоблачение, привязанность спутника, карта тела,
// маршрут, жизненные показатели, инвентарь, секреты, ружья Чехова, кинки и
// фетиши. Первый вид в каждом списке — прежний, «как сейчас»: его рисуют
// старые сборщики, а здесь только новые. Данные те же, что у прежних видов,
// — модель ничего нового не пишет. Оформление — css/views.css.

import { escapeHtml, applyTooltips, разбитьСписок, hudHashSeed } from '../utils.js?v=23.9.2';
import { силаСтраха, статусРужья } from '../codes.js?v=23.9.2';
import { settings } from '../settings.js?v=23.9.2';
import { зоныКарты, ПЯТНА, ЗОНЫ } from './intimacy.js?v=23.9.2';

export const ВИДЫ_БЛОКОВ = [
  { ключ: 'trustView', группа: 'Персонаж', поле: 'Доверие', виды: { bars: 'Полоски', hearts: 'Сердца', shield: 'Щит', ring: 'Кольца', traffic: 'Светофор', spectrum: 'Спектр' } },
  { ключ: 'fearsView', группа: 'Персонаж', поле: 'Страхи', виды: { list: 'Список', thermometer: 'Термометры', skulls: 'Черепа', storm: 'Тучи', radar: 'Радар' } },
  { ключ: 'exposureView', группа: 'Персонаж', поле: 'Разоблачение', виды: { text: 'Текст', bar: 'Шкала', mask: 'Маска', eye: 'Глаз' } },
  { ключ: 'inventoryView', группа: 'Персонаж', поле: 'Инвентарь', виды: { list: 'Список', grid: 'Слоты', cards: 'Карточки', groups: 'По группам', weight: 'По важности' } },
  { ключ: 'orgView', группа: 'Близость', поле: 'Готовность к оргазму', виды: { bar: 'Шкала', ring: 'Кольцо', flame: 'Пламя', wave: 'Волна', pulse: 'Пульс' } },
  { ключ: 'vitalsView', группа: 'Близость', поле: 'Жизненные показатели', виды: { list: 'Плитки', dashboard: 'Циферблаты', ecg: 'Монитор ЭКГ', rings: 'Кольца', pulse: 'Сердце' } },
  { ключ: 'bodyMapView', группа: 'Близость', поле: 'Карта тела', виды: { both: 'Спереди и сзади', front: 'Спереди', list: 'Список', dots: 'Точки', zones: 'Блоки', constellation: 'Созвездие' } },
  { ключ: 'kinkView', группа: 'Близость', поле: 'Кинки и фетиши', виды: { pills: 'Пилюли', bars: 'Шкалы', iceberg: 'Айсберг', groups: 'По типу', stars: 'Звёзды' } },
  { ключ: 'routeView', группа: 'Память', поле: 'Маршрут', виды: { list: 'Схема', timeline: 'Лента', map: 'Карта', footsteps: 'Следы' } },
  { ключ: 'secretsView', группа: 'Память', поле: 'Секреты', виды: { list: 'Список', iceberg: 'Айсберг', files: 'Папки', web: 'Сеть', bars: 'Шкалы' } },
  { ключ: 'gunsView', группа: 'Память', поле: 'Ружья Чехова', виды: { list: 'Список', board: 'Доска', timeline: 'Колонки', progress: 'Фитиль' } },
  { ключ: 'bondView', группа: 'Спутники', поле: 'Привязанность', виды: { bars: 'Полоска', hearts: 'Сердца', paw: 'Лапа' } },
];

// Выбранный вид блока; неизвестное значение — прежний вид. Карта тела
// помнит старую галку «Карта тела картинкой»: выключена — список.
export function видБлока(ключ) {
  const б = ВИДЫ_БЛОКОВ.find(x => x.ключ === ключ);
  if (!б) return '';
  const v = settings[ключ];
  if (б.виды[v]) return v;
  if (ключ === 'bodyMapView' && settings.enableHeatMap === false) return 'list';
  return Object.keys(б.виды)[0];
}
export const прежнийВид = (ключ) => видБлока(ключ) === Object.keys((ВИДЫ_БЛОКОВ.find(x => x.ключ === ключ) || { виды: { '': 1 } }).виды)[0];

const огр = (v, a, b) => Math.max(a, Math.min(b, v));
const пусто = (v) => !String(v ?? '').trim() || /^(empty|none|null|нет|пусто)$/i.test(String(v).trim());
const число = (s) => { const m = String(s ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
const инициалы = (имя) => String(имя || '?').trim().split(/\s+/).slice(0, 2).map(ч => ч.charAt(0).toUpperCase()).join('') || '?';
const первое = (имя) => String(имя || '').trim().split(/\s+/)[0];
// Id внутри SVG: карточек на странице много, у градиентов свои имена.
let счётId = 0;
const новыйId = (п) => `hud-v-${п}-${(++счётId).toString(36)}`;
// Тон человека — сдвиг от акцента темы, чтобы у каждого был свой, но родной цвет.
const тон = (имя) => `--тон:${hudHashSeed(имя) % 70 - 35}`;
// «Имя: значение» списком — общий разбор для доверия, страхов, инвентаря, кинков.
function пары(value) {
  return разбитьСписок(value).map(кусок => {
    const s = кусок.trim();
    if (!s || пусто(s)) return null;
    const m = s.match(/^([^:：]{1,80})[:：]\s*(.*)$/);
    return m ? { имя: m[1].trim(), текст: m[2].trim() } : { имя: s, текст: '' };
  }).filter(Boolean);
}
const подпись = (текст) => текст && !пусто(текст) ? `<p class="hud-v-note">${applyTooltips(текст)}</p>` : '';
const лицо = (имя) => `<i class="hud-v-face" style="${тон(имя)}" aria-hidden="true">${escapeHtml(инициалы(имя))}</i>`;

/* --- Доверие ---------------------------------------------------------------- */

function разобратьДоверие(value) {
  return пары(value).map(п => ({ кто: п.имя, v: Number.isFinite(число(п.текст)) ? огр(число(п.текст), 0, 100) : null, сырое: п.текст }));
}
const словоДоверия = (v) => v >= 80 ? 'открыт' : v >= 60 ? 'доверяет' : v >= 40 ? 'насторожен' : v >= 20 ? 'закрыт' : 'глухо закрыт';
const ступень = (v) => v >= 66 ? 'is-high' : v >= 33 ? 'is-mid' : 'is-low';

// Сердца: пустой контур и поверх — заливка, обрезанная по доле.
const СЕРДЦЕ = 'M12 21s-8.2-5-8.2-11.1A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.2 2.9C20.2 16 12 21 12 21Z';
function сердца(v, всего = 5) {
  const шаг = 100 / всего;
  return `<span class="hud-v-hearts" aria-hidden="true">${Array.from({ length: всего }, (_, i) => {
    const f = огр((v - i * шаг) / шаг, 0, 1);
    return `<svg viewBox="0 0 24 24" class="${f >= 1 ? 'is-full' : f > 0 ? 'is-part' : ''}"><path class="bg" d="${СЕРДЦЕ}"/><path class="fg" d="${СЕРДЦЕ}" style="clip-path:inset(0 ${((1 - f) * 100).toFixed(0)}% 0 0)"/></svg>`;
  }).join('')}</span>`;
}

export function видДоверия(value, вид) {
  const люди = разобратьДоверие(value);
  if (!люди.length) return '';
  const счёт = люди.filter(ч => ч.v !== null);
  const карточки = (класс, тело) => `<div class="hud-v hud-v-trust ${класс}">${люди.map(ч => ч.v === null
    ? `<div class="hud-v-card"><div class="hud-v-who-line">${лицо(ч.кто)}<b>${escapeHtml(ч.кто)}</b></div><small>${escapeHtml(ч.сырое)}</small></div>`
    : тело(ч)).join('')}</div>`;
  if (вид === 'hearts') {
    return карточки('is-hearts', ч => `<div class="hud-v-card ${ступень(ч.v)}" title="${escapeHtml(ч.кто)}: ${Math.round(ч.v)} из 100">`
      + `<div class="hud-v-who-line">${лицо(ч.кто)}<b>${escapeHtml(ч.кто)}</b><em class="hud-v-num">${Math.round(ч.v)}</em></div>${сердца(ч.v)}</div>`);
  }
  if (вид === 'shield') {
    // Щит тем плотнее, чем меньше доверия: «открыт» — пустой контур,
    // «глухо закрыт» — залит доверху.
    return карточки('is-shield', ч => {
      const id = новыйId('sh'), f = (100 - ч.v) / 100, верх = 4 + (1 - f) * 44;
      const щит = 'M24 3 41 9v14c0 12-7.6 20.4-17 24C14.6 43.4 7 35 7 23V9Z';
      return `<div class="hud-v-card hud-v-shield ${ступень(ч.v)}" title="${escapeHtml(ч.кто)}: доверие ${Math.round(ч.v)} — ${словоДоверия(ч.v)}">`
        + `<svg viewBox="0 0 48 50" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${щит}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>`
        + `<path class="back" d="${щит}"/><g clip-path="url(#${id}c)"><rect class="fill" x="0" y="${верх.toFixed(1)}" width="48" height="50" fill="url(#${id}g)"/><path class="sheen" d="M7 9 24 3v44C14.6 43.4 7 35 7 23Z"/></g>`
        + `<path class="rim" d="${щит}"/><path class="emblem" d="M24 16v14M17 23h14"/></svg>`
        + `<b>${escapeHtml(первое(ч.кто))}</b><span class="hud-v-tag">${словоДоверия(ч.v)}</span><em class="hud-v-num is-small">${Math.round(ч.v)}</em></div>`;
    });
  }
  if (вид === 'ring') {
    return карточки('is-ring', ч => `<div class="hud-v-card hud-v-ringcard ${ступень(ч.v)}" title="${escapeHtml(ч.кто)}: ${Math.round(ч.v)} из 100">`
      + `<i class="hud-v-ring" style="--p:${ч.v.toFixed(0)};${тон(ч.кто)}" aria-hidden="true"><span>${escapeHtml(инициалы(ч.кто))}</span></i>`
      + `<b>${escapeHtml(первое(ч.кто))}</b><em class="hud-v-num">${Math.round(ч.v)}</em></div>`);
  }
  if (вид === 'traffic') {
    const зона = (v) => v >= 66 ? 2 : v >= 33 ? 1 : 0;
    const слово = ['не доверяет', 'присматривается', 'доверяет'];
    return карточки('is-traffic', ч => `<div class="hud-v-card" title="${escapeHtml(ч.кто)}: ${Math.round(ч.v)} из 100">`
      + `<span class="hud-v-lights" aria-hidden="true">${[2, 1, 0].map(i => `<i class="l${i}${i === зона(ч.v) ? ' is-on' : ''}"></i>`).join('')}</span>`
      + `<div class="hud-v-traffic-text"><b>${escapeHtml(ч.кто)}</b><small class="z${зона(ч.v)}">${слово[зона(ч.v)]}</small></div><em class="hud-v-num">${Math.round(ч.v)}</em></div>`);
  }
  if (вид === 'spectrum' && счёт.length) {
    // Одна шкала на всех: люди — кружками с инициалами, подписи через одну
    // сверху и снизу, чтобы соседние имена не налезали друг на друга.
    const по = счёт.slice().sort((a, b) => a.v - b.v);
    return `<div class="hud-v hud-v-trust is-spectrum"><div class="hud-v-spectrum"><i class="hud-v-spectrum-track" aria-hidden="true">${[25, 50, 75].map(x => `<s style="left:${x}%"></s>`).join('')}</i>`
      + по.map((ч, i) => `<span class="hud-v-spot${i % 2 ? ' is-down' : ''}" style="--x:${ч.v.toFixed(1)}%" title="${escapeHtml(ч.кто)}: ${Math.round(ч.v)}">${лицо(ч.кто)}<b>${escapeHtml(первое(ч.кто))} · ${Math.round(ч.v)}</b></span>`).join('')
      + `</div><div class="hud-v-spectrum-scale" aria-hidden="true"><span>🔒 не доверяет</span><span>доверяет 🤝</span></div></div>`;
  }
  return '';
}

/* --- Страхи ----------------------------------------------------------------- */

const ЗНАЧКИ_СТРАХА = [
  [/смерт|умер|гибел|убь|death|die/i, '💀'], [/потер|уйд|брос|один|одинок|lose|abandon/i, '💔'],
  [/узна|раскро|разоблач|правд|ошибк|expose|truth/i, '🕵'], [/отец|мать|семь|родн|брат|сестр|father|mother|family/i, '🏚'],
  [/темн|ночь|dark/i, '🌑'], [/боль|пытк|удар|pain|hurt/i, '🩸'], [/высот|паден|height|fall/i, '🕳'],
  [/вод|утон|water|drown/i, '🌊'], [/огон|пожар|fire|burn/i, '🔥'], [/тюрьм|клетк|запер|cage|prison/i, '🔒'],
];
// Сила словом → 1…5: паника — пять, «редко» — один. Неизвестное слово — середина.
function силаЧислом(слово) {
  const s = String(слово || '');
  if (/пани[кч]|ужас|жутк|смертельн|невыносим|парализ|panic|terror/i.test(s)) return 5;
  if (/постоянн|очень\s+сильн|глубок|сильн|остро|high|strong/i.test(s)) return 4;
  if (/средн|заметн|иногда|порой|mid|medium/i.test(s)) return 3;
  if (/изредк|слаб|редк|немног|чуть|фонов|low|weak/i.test(s)) return 2;
  return 3;
}
function разобратьСтрахи(value) {
  return пары(value).map(п => {
    const слово = п.текст ? силаСтраха(п.текст) : '';
    const пара = ЗНАЧКИ_СТРАХА.find(([rx]) => rx.test(п.имя));
    return { что: п.имя, слово, сила: силаЧислом(слово || п.текст), значок: пара ? пара[1] : '😨' };
  });
}
const ТУЧА = 'M9 30h28a9 9 0 0 0 .8-18A13 13 0 0 0 13.3 14.6 8 8 0 0 0 9 30Z';

export function видСтрахов(value, вид) {
  const страхи = разобратьСтрахи(value);
  if (!страхи.length) return '';
  const титул = (с) => `${escapeHtml(с.что)}${с.слово ? ': ' + escapeHtml(с.слово) : ''}`;
  const бирка = (с) => с.слово ? `<span class="hud-v-tag s${с.сила}">${escapeHtml(с.слово)}</span>` : '';
  if (вид === 'thermometer') {
    return `<div class="hud-v hud-v-fears is-thermo">${страхи.map(с => `<div class="hud-v-card hud-v-thermo s${с.сила}" title="${титул(с)}">`
      + `<span class="hud-v-thermo-glass" aria-hidden="true"><i class="scale">${[1, 2, 3, 4].map(() => '<s></s>').join('')}</i><i class="mercury" style="--f:${с.сила / 5}"></i><i class="bulb"></i></span>`
      + `<span class="hud-v-thermo-text"><i class="hud-v-emoji" aria-hidden="true">${с.значок}</i><b>${escapeHtml(с.что)}</b>${бирка(с)}</span></div>`).join('')}</div>`;
  }
  if (вид === 'skulls') {
    return `<div class="hud-v hud-v-fears is-skulls">${страхи.map(с => `<div class="hud-v-card s${с.сила}" title="${титул(с)}">`
      + `<i class="hud-v-emoji" aria-hidden="true">${с.значок}</i><div class="hud-v-skull-text"><b>${escapeHtml(с.что)}</b>${бирка(с)}</div>`
      + `<span class="hud-v-skulls" aria-label="${с.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i${i <= с.сила ? ' class="is-on"' : ''}>💀</i>`).join('')}</span></div>`).join('')}</div>`;
  }
  if (вид === 'storm') {
    return `<div class="hud-v hud-v-fears is-storm">${страхи.map(с => {
      const id = новыйId('cl'), верх = 32 - с.сила * 4.6;
      const капли = с.сила >= 3 ? Array.from({ length: с.сила - 1 }, (_, i) => `<path class="drop" style="--d:${(i * .23).toFixed(2)}s" d="M${13 + i * 6.5} 34l-1.6 5"/>`).join('') : '';
      return `<div class="hud-v-card hud-v-storm s${с.сила}" title="${титул(с)}"><svg viewBox="0 0 46 44" aria-hidden="true">`
        + `<defs><clipPath id="${id}c"><path d="${ТУЧА}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>`
        + `<path class="bg" d="${ТУЧА}"/><rect class="fill" x="0" y="${верх.toFixed(1)}" width="46" height="40" fill="url(#${id}g)" clip-path="url(#${id}c)"/><path class="rim" d="${ТУЧА}"/>${капли}`
        + (с.сила >= 4 ? '<path class="bolt" d="m24 27-5 8h4.4l-2.2 7 7-9.4h-4.6Z"/>' : '')
        + `</svg><b>${escapeHtml(с.что)}</b>${бирка(с)}</div>`;
    }).join('')}</div>`;
  }
  if (вид === 'radar') {
    // Экран радара: страхи — отметки. Чем сильнее страх, тем ближе он к
    // центру: подступает. Работает с любым числом страхов.
    const C = 60, R = 52, id = новыйId('rd');
    const отметки = страхи.map((с, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / страхи.length + 0.35;
      const r = R * (1.02 - с.сила / 5 * 0.82);
      return { с, x: C + r * Math.cos(a), y: C + r * Math.sin(a), n: i + 1 };
    });
    return `<div class="hud-v hud-v-fears is-radar"><svg class="hud-v-radar" viewBox="0 0 120 120" role="img" aria-label="Страхи на радаре: ${escapeHtml(страхи.map(с => с.что + ' — ' + с.сила + ' из 5').join('; '))}">`
      + `<defs><radialGradient id="${id}s"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></radialGradient><linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="w0"/><stop offset="1" class="w1"/></linearGradient></defs>`
      + `<circle class="screen" cx="${C}" cy="${C}" r="${R}" fill="url(#${id}s)"/>`
      + [1, 2, 3].map(k => `<circle class="ring" cx="${C}" cy="${C}" r="${(R * k / 3).toFixed(1)}"/>`).join('')
      + `<path class="cross" d="M${C - R} ${C}H${C + R}M${C} ${C - R}V${C + R}"/>`
      + `<g class="sweep"><path d="M${C} ${C}L${C + R} ${C}A${R} ${R} 0 0 0 ${(C + R * Math.cos(-0.7)).toFixed(1)} ${(C + R * Math.sin(-0.7)).toFixed(1)}Z" fill="url(#${id}w)"/><line x1="${C}" y1="${C}" x2="${C + R}" y2="${C}"/></g>`
      + отметки.map(о => `<g class="blip s${о.с.сила}" style="--d:${(о.n * .37).toFixed(2)}s"><circle class="halo" cx="${о.x.toFixed(1)}" cy="${о.y.toFixed(1)}" r="${(2.5 + о.с.сила).toFixed(1)}"/><circle class="dot" cx="${о.x.toFixed(1)}" cy="${о.y.toFixed(1)}" r="2.6"/><text x="${(о.x + 5).toFixed(1)}" y="${(о.y - 4).toFixed(1)}">${о.n}</text><title>${титул(о.с)}</title></g>`).join('')
      + `<circle class="rim" cx="${C}" cy="${C}" r="${R}"/></svg>`
      + `<ol class="hud-v-radar-legend">${отметки.map(о => `<li class="s${о.с.сила}" title="${титул(о.с)}"><i class="n">${о.n}</i><i class="hud-v-emoji" aria-hidden="true">${о.с.значок}</i><span><b>${escapeHtml(о.с.что)}</b>${бирка(о.с)}</span><span class="hud-v-mini-bar" aria-hidden="true"><i style="width:${о.с.сила * 20}%"></i></span></li>`).join('')}</ol></div>`;
  }
  return '';
}

/* --- Готовность к оргазму --------------------------------------------------- */

export function видОргазма(value, вид) {
  const s = String(value || '').trim();
  const m = s.match(/^\s*(\d{1,3})\s*%?\s*[:：,—–-]?\s*([\s\S]*)$/);
  if (!m) return '';
  const v = огр(parseInt(m[1], 10), 0, 100);
  const текст = m[2].trim();
  const слово = v >= 95 ? 'на грани' : v >= 85 ? 'совсем близко' : v >= 50 ? 'нарастает' : 'далеко';
  const ст = v >= 85 ? 'is-edge' : v >= 50 ? 'is-high' : 'is-low';
  // У кольца число уже в центре — рядом только слово.
  const голова = вид === 'ring' ? `<div class="hud-v-big"><em class="is-solo">${слово}</em></div>` : `<div class="hud-v-big"><b>${v}<small>%</small></b><em>${слово}</em></div>`;
  const id = новыйId('org');
  let рисунок = '';
  if (вид === 'ring') {
    const r = 30, д = 2 * Math.PI * r;
    рисунок = `<svg class="hud-v-gauge-ring" viewBox="0 0 76 76" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>`
      + `<circle class="track" cx="38" cy="38" r="${r}"/>${[50, 85].map(п => { const a = -Math.PI / 2 + п / 100 * 2 * Math.PI; return `<circle class="tick" cx="${(38 + r * Math.cos(a)).toFixed(1)}" cy="${(38 + r * Math.sin(a)).toFixed(1)}" r="1.6"/>`; }).join('')}`
      + `<circle class="val" cx="38" cy="38" r="${r}" stroke="url(#${id})" stroke-dasharray="${(д * v / 100).toFixed(1)} ${д.toFixed(1)}" transform="rotate(-90 38 38)"/>`
      + `<text x="38" y="42">${v}%</text></svg>`;
  } else if (вид === 'flame') {
    // Пламя растёт от угольков: высота, яркость и число языков — от процента.
    const h = 0.4 + v / 100 * 0.6;
    рисунок = `<svg class="hud-v-flame" viewBox="0 0 48 64" style="--h:${h.toFixed(2)}" aria-hidden="true"><defs>`
      + `<radialGradient id="${id}o" cx=".5" cy=".85" r=".8"><stop offset="0" class="o0"/><stop offset=".55" class="o1"/><stop offset="1" class="o2"/></radialGradient>`
      + `<radialGradient id="${id}i" cx=".5" cy=".9" r=".7"><stop offset="0" class="i0"/><stop offset="1" class="i1"/></radialGradient></defs>`
      + `<ellipse class="glow" cx="24" cy="58" rx="${(10 + v / 8).toFixed(1)}" ry="4"/><g class="grow">`
      + `<path class="outer" fill="url(#${id}o)" d="M24 60c-10 0-17-7.4-17-17 0-10 8-15.6 10-25.6 1.4 5.4 4.4 8 5.8 10 1.2-8 5.6-14.6 12.4-21.4-1.2 10 7 15.6 7 32.8 0 13-8 21.2-18.2 21.2Z"/>`
      + `<path class="inner" fill="url(#${id}i)" d="M24 60c-5.6 0-9.6-4-9.6-9.4 0-5.6 4.4-8.4 5.6-13.4 1.6 3.4 3.4 4.4 4.4 5.6.6-4.6 3-7.8 6.2-10.6 0 5.6 2.8 9 2.8 18 0 6.2-4.2 9.8-9.4 9.8Z"/></g>`
      + (v >= 70 ? '<g class="sparks"><circle cx="15" cy="16" r="1"/><circle cx="33" cy="10" r=".8"/><circle cx="36" cy="22" r="1"/></g>' : '') + `</svg>`;
  } else if (вид === 'wave') {
    const A = 2 + v / 100 * 12, W = 240, H = 44, частота = 2 + v / 100 * 4;
    let d = `M0 ${H / 2}`;
    for (let x = 0; x <= W * 2; x += 3) d += ` L${x} ${(H / 2 - A * Math.sin(x / W * Math.PI * 2 * частота)).toFixed(1)}`;
    const заливка = d + ` L${W * 2} ${H} L0 ${H}Z`;
    рисунок = `<svg class="hud-v-wave" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>`
      + `<linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="l0"/><stop offset="1" class="l1"/></linearGradient>`
      + `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="f0"/><stop offset="1" class="f1"/></linearGradient></defs>`
      + `<g class="run"><path class="area" d="${заливка}" fill="url(#${id}f)"/><path class="line" d="${d}" stroke="url(#${id}l)"/></g></svg>`;
  } else if (вид === 'pulse') {
    // Чем ближе к пику, тем чаще бьётся точка: от 1,6 с до 0,35 с.
    const такт = (1.6 - v / 100 * 1.25).toFixed(2);
    рисунок = `<span class="hud-v-pulse" style="--t:${такт}s" aria-hidden="true"><i class="echo"></i><i class="echo e2"></i><i class="core"></i></span>`;
  } else return '';
  return `<div class="hud-v hud-v-org ${ст} is-${вид}" role="meter" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" title="Готовность к оргазму: ${v} из 100">`
    + `<div class="hud-v-art">${рисунок}</div><div class="hud-v-side">${голова}${вид === 'ring' ? '' : `<span class="hud-v-mini-bar" aria-hidden="true"><i style="width:${v}%"></i></span>`}${подпись(текст)}</div></div>`;
}

/* --- Разоблачение ----------------------------------------------------------- */

export function видРазоблачения(value, вид) {
  const s = String(value || '').trim();
  const m = s.match(/^\s*(\d{1,3})\s*%?\s*[:：,—–-]?\s*([\s\S]*)$/);
  if (!m) return '';
  const v = огр(parseInt(m[1], 10), 0, 100);
  const текст = m[2].trim();
  const слово = v >= 85 ? 'вот-вот раскроется' : v >= 60 ? 'трещит по швам' : v >= 30 ? 'есть догадки' : 'в тени';
  const id = новыйId('ex');
  const голова = `<div class="hud-v-big"><b>${v}<small>%</small></b><em>${слово}</em></div>`;
  if (вид === 'bar') {
    // Шкала из десяти делений: горят пройденные, последнее — пульсирует.
    const деления = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(v / 10) ? 'is-on' : ''}${i === Math.round(v / 10) - 1 ? ' is-last' : ''}"></i>`).join('');
    return `<div class="hud-v hud-v-expo is-bar${v >= 60 ? ' is-hot' : ''}" title="Разоблачение: ${v} из 100">${голова}<span class="hud-v-segments" aria-hidden="true">${деления}</span>`
      + `<span class="hud-v-seg-scale" aria-hidden="true"><span>в тени</span><span>догадки</span><span>трещит</span><span>раскрыто</span></span>${подпись(текст)}</div>`;
  }
  let рисунок = '';
  if (вид === 'mask') {
    // Маска трескается по мере роста: трещины проступают по порогам,
    // на пике откалывается кусок.
    const трещины = ['M26 9 L22 18 L27 24 L24 30', 'M34 13 L31 20 L36 26', 'M15 22 L20 27 L16 34', 'M28 34 L25 41 L30 46', 'M38 26 L42 31 L39 37'];
    рисунок = `<svg class="hud-v-mask" viewBox="0 0 52 56" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="m0"/><stop offset="1" class="m1"/></linearGradient></defs>`
      + `<path class="shadow" d="M8 11c7-4 29-4 36 0 1.2 16-3.6 34-18 40C11.6 45 6.8 27 8 11Z" transform="translate(1.5 2)"/>`
      + `<path class="face" fill="url(#${id})" d="M8 11c7-4 29-4 36 0 1.2 16-3.6 34-18 40C11.6 45 6.8 27 8 11Z"/>`
      + `<path class="brow" d="M13 19q5-3 10 0M29 19q5-3 10 0"/><path class="eye" d="M14 24c2.4-2.4 7-2.4 9.4 0-2.4 2.4-7 2.4-9.4 0Z"/><path class="eye" d="M28.6 24c2.4-2.4 7-2.4 9.4 0-2.4 2.4-7 2.4-9.4 0Z"/><path class="mouth" d="M19 38q7 4 14 0"/>`
      + трещины.map((d, i) => `<path class="crack" d="${d}" style="opacity:${v > i * 18 ? 1 : 0}"/>`).join('')
      + (v >= 90 ? '<path class="chip" d="M36 30 42 31 40 38 35 36Z"/>' : '') + `</svg>`;
  } else if (вид === 'eye') {
    // Глаз открывается: чем ближе правда, тем шире веко.
    const о = огр(v / 100, 0.08, 1);
    рисунок = `<svg class="hud-v-eye" viewBox="0 0 72 44" style="--o:${о.toFixed(2)}" aria-hidden="true"><defs><radialGradient id="${id}"><stop offset="0" class="i0"/><stop offset=".7" class="i1"/><stop offset="1" class="i2"/></radialGradient></defs>`
      + `<g class="open"><path class="white" d="M4 22C16 5 56 5 68 22 56 39 16 39 4 22Z"/>${v >= 60 ? '<path class="vein" d="M9 22q6-2 10 1M63 22q-6-3-10 0M12 27q5 0 8-2"/>' : ''}<circle class="iris" cx="36" cy="22" r="11" fill="url(#${id})"/><circle class="pupil" cx="36" cy="22" r="${(3 + v / 100 * 3).toFixed(1)}"/><circle class="glint" cx="39.5" cy="18.5" r="2"/></g>`
      + `<path class="lid" d="M4 22C16 5 56 5 68 22"/><path class="lid" d="M4 22C16 39 56 39 68 22"/><path class="lash" d="M14 13l-3-4M24 9l-1.4-4.4M36 7.6V3M48 9l1.4-4.4M58 13l3-4"/></svg>`;
  } else return '';
  return `<div class="hud-v hud-v-expo is-${вид}${v >= 60 ? ' is-hot' : ''}" title="Разоблачение: ${v} из 100"><div class="hud-v-art">${рисунок}</div>`
    + `<div class="hud-v-side">${голова}<span class="hud-v-mini-bar" aria-hidden="true"><i style="width:${v}%"></i></span>${подпись(текст)}</div></div>`;
}

/* --- Привязанность спутника ------------------------------------------------- */

export function видПривязанности(связь, вид) {
  if (связь === null || !Number.isFinite(связь)) return '';
  const v = огр(связь, 0, 100);
  if (вид === 'hearts') return `<div class="hud-pet-bond hud-v-bond is-hearts" title="Привязанность ${Math.round(v)} из 100"><span>привязанность</span>${сердца(v)}<em class="hud-v-num is-small">${Math.round(v)}</em></div>`;
  if (вид === 'paw') {
    const id = новыйId('paw'), верх = 24 - v / 100 * 22;
    const лапа = '<ellipse cx="12" cy="16.5" rx="5" ry="4.2"/><ellipse cx="5.6" cy="10.6" rx="2" ry="2.6"/><ellipse cx="9.4" cy="6.6" rx="2" ry="2.7"/><ellipse cx="14.6" cy="6.6" rx="2" ry="2.7"/><ellipse cx="18.4" cy="10.6" rx="2" ry="2.6"/>';
    return `<div class="hud-pet-bond hud-v-bond is-paw" title="Привязанность ${Math.round(v)} из 100"><span>привязанность</span>`
      + `<svg class="hud-v-paw" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="${id}"><rect x="0" y="${верх.toFixed(1)}" width="24" height="24"/></clipPath><linearGradient id="${id}g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>`
      + `<g class="bg">${лапа}</g><g class="fill" fill="url(#${id}g)" clip-path="url(#${id})">${лапа}</g></svg><em class="hud-v-num is-small">${Math.round(v)}</em></div>`;
  }
  return '';
}

/* --- Карта тела ------------------------------------------------------------- */

const ОБЛАСТИ_ТЕЛА = [
  ['Голова и шея', '🙂', ['head', 'lips', 'ears', 'neck', 'nape']],
  ['Корпус', '💠', ['shoulders', 'chest', 'back', 'belly', 'waist', 'lowback']],
  ['Бёдра и таз', '🍑', ['groin', 'buttocks', 'thighs']],
  ['Руки и ноги', '🦵', ['arms', 'hands', 'knees', 'backknee', 'calves', 'feet']],
];
// Центр зоны на фигуре 90×190: спереди, иначе сзади. Стопы у пятен не
// заведены — ставим под икрами.
function центрЗоны(id) {
  const п = ПЯТНА[id];
  if (id === 'feet') return [[38.5, 182], [51.5, 182]];
  if (!п) return null;
  return (п.f || п.b).map(([x, y]) => [x, y]);
}
const ФИГУРА = '<circle cx="45" cy="16" r="11"/><path d="M45 28v4"/><rect x="26" y="34" width="38" height="60" rx="16"/><path d="M26 44 16 96M64 44l10 52"/><path d="M36 92l-2 90M54 92l2 90"/>';
const СИЛУЭТ_МЯГКИЙ = '<ellipse cx="45" cy="16" rx="10" ry="12"/><rect x="40.5" y="26" width="9" height="10" rx="3"/><path d="M27 41q18-7 36 0 5 3 4 9-4 12-6 22-2 9 1 20-17 9-34 0 3-11 1-20-2-10-6-22-1-6 4-9Z"/><path d="M25 43q-8 2-9 14l-2.5 26q-.5 7 2 12h5.5q1-6 1.5-12l3-22Z"/><path d="M65 43q8 2 9 14l2.5 26q.5 7-2 12h-5.5q-1-6-1.5-12l-3-22Z"/><path d="M30 89q-1.5 22 1.5 43 1.5 8 1 16-1 17 2 32h8q.5-15 .7-32 .6-8 1-16l.8-32Z"/><path d="M60 89q1.5 22-1.5 43-1.5 8-1 16 1 17-2 32h-8q-.5-15-.7-32-.6-8-1-16l-.8-32Z"/>';

export function видКартыТела(value, вид) {
  const { зоны } = зоныКарты(value);
  const числовые = зоны.filter(з => з.v !== null);
  if (!числовые.length) return '';
  const жар = (v) => огр(v / 10, 0, 1).toFixed(2);
  const титул = (з) => `${escapeHtml(з.имя)}: ${з.v} из 10${з.трендТекст ? ' · ' + escapeHtml(з.трендТекст) : ''}${з.описание ? ' — ' + escapeHtml(з.описание) : ''}`;
  const список = `<ul class="hud-v-bm-legend">${числовые.slice().sort((a, b) => b.v - a.v).map(з => `<li style="--h:${жар(з.v)}" title="${титул(з)}"><i></i><span><b>${escapeHtml(з.имя)}</b>${з.трендТекст ? `<small>${escapeHtml(з.трендТекст)}</small>` : ''}</span><span class="hud-v-mini-bar"><i style="width:${з.v * 10}%"></i></span><em>${з.v}</em></li>`).join('')}</ul>`;
  if (вид === 'zones') {
    const свои = new Set();
    const плитка = (з) => `<span class="hud-v-bm-tile" style="--h:${жар(з.v)}" title="${титул(з)}"><b>${escapeHtml(з.имя)}</b><em>${з.v}</em><i class="heat" aria-hidden="true"><i style="width:${з.v * 10}%"></i></i>${з.трендТекст ? `<small>${escapeHtml(з.трендТекст)}</small>` : ''}</span>`;
    const блоки = ОБЛАСТИ_ТЕЛА.map(([имя, значок, ids]) => {
      const тут = числовые.filter(з => ids.includes(з.id)).sort((a, b) => b.v - a.v);
      тут.forEach(з => свои.add(з));
      const пик = тут.length ? Math.max(...тут.map(з => з.v)) : 0;
      return тут.length ? `<div class="hud-v-bm-area" style="--h:${жар(пик)}"><div class="hud-v-bm-area-head"><i aria-hidden="true">${значок}</i>${имя}</div>${тут.map(плитка).join('')}</div>` : '';
    }).join('');
    const прочее = числовые.filter(з => !свои.has(з));
    return `<div class="hud-v hud-v-bm is-zones">${блоки}${прочее.length ? `<div class="hud-v-bm-area"><div class="hud-v-bm-area-head"><i aria-hidden="true">✦</i>Другое</div>${прочее.map(плитка).join('')}</div>` : ''}</div>`;
  }
  const наФигуре = числовые.map(з => ({ з, точки: з.id ? центрЗоны(з.id) : null })).filter(x => x.точки);
  if (вид === 'dots') {
    const id = новыйId('bm');
    const точки = наФигуре.map(({ з, точки }) => точки.map(([x, y]) => `<g class="spot" style="--h:${жар(з.v)}"><circle class="halo" cx="${x}" cy="${y}" r="${(4 + з.v * 0.9).toFixed(1)}" fill="url(#${id}h)"/><circle class="dot" cx="${x}" cy="${y}" r="${(1.6 + з.v * 0.25).toFixed(1)}"/><title>${титул(з)}</title></g>`).join('')).join('');
    return `<div class="hud-v hud-v-bm is-dots"><svg class="hud-v-figure" viewBox="0 0 90 192" role="img" aria-label="Карта тела точками"><defs>`
      + `<radialGradient id="${id}h"><stop offset="0" class="h0"/><stop offset="1" class="h1"/></radialGradient><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="b0"/><stop offset="1" class="b1"/></linearGradient></defs>`
      + `<g class="body" fill="url(#${id}b)">${СИЛУЭТ_МЯГКИЙ}</g>${точки}</svg>${список}</div>`;
  }
  if (вид === 'constellation') {
    // Звёзды — зоны (обе у парных), линии — от каждой звезды к ближайшей
    // из тех, что выше: выходит фигура созвездия, а не одна вертикаль.
    const звёзды = наФигуре.flatMap(({ з, точки }) => точки.map(([x, y]) => ({ з, x, y }))).sort((a, b) => a.y - b.y || a.x - b.x);
    const линии = звёзды.slice(1).map((s, i) => {
      const выше = звёзды.slice(0, i + 1);
      const б = выше.reduce((л, t) => Math.hypot(t.x - s.x, t.y - s.y) < Math.hypot(л.x - s.x, л.y - s.y) ? t : л, выше[0]);
      return `<line x1="${б.x}" y1="${б.y}" x2="${s.x}" y2="${s.y}"/>`;
    }).join('');
    const фон = Array.from({ length: 34 }, (_, i) => { let h = Math.imul(i + 1, 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1597334677) >>> 0; return `<circle class="bgstar" style="--d:${(h % 40) / 10}s" cx="${h % 90}" cy="${(h >> 7) % 192}" r="${((h >> 3) % 3) * 0.22 + 0.25}"/>`; }).join('');
    const сияние = звёзды.map(({ з, x, y }) => {
      const r = 0.9 + з.v * 0.17;
      return `<g class="star" style="--h:${жар(з.v)}"><circle class="glow" cx="${x}" cy="${y}" r="${(r * 2.8).toFixed(1)}"/><path d="${[[0, -1.8], [.45, -.45], [1.8, 0], [.45, .45], [0, 1.8], [-.45, .45], [-1.8, 0], [-.45, -.45]].map(([a, b], i) => (i ? 'L' : 'M') + (x + a * r).toFixed(2) + ' ' + (y + b * r).toFixed(2)).join('')}Z"/><title>${титул(з)}</title></g>`;
    }).join('');
    return `<div class="hud-v hud-v-bm is-constellation"><svg class="hud-v-sky" viewBox="0 0 90 192" role="img" aria-label="Карта тела созвездием">${фон}<g class="ghost">${ФИГУРА}</g><g class="lines">${линии}</g>${сияние}</svg>${список}</div>`;
  }
  return '';
}

/* --- Маршрут ---------------------------------------------------------------- */

export function видМаршрута(точки, кто, вид) {
  if (!Array.isArray(точки) || !точки.length) return '';
  const время = (p) => String(p.time || '').replace(/[[\]]/g, '').trim();
  const голова = `<div class="hud-v-head"><b>${escapeHtml(кто)}</b><span>${точки.length} ${точки.length === 1 ? 'точка' : точки.length < 5 ? 'точки' : 'точек'}${время(точки[0]) && время(точки[точки.length - 1]) ? ` · ${escapeHtml(время(точки[0]))} — ${escapeHtml(время(точки[точки.length - 1]))}` : ''}</span></div>`;
  if (вид === 'timeline') {
    return `<div class="hud-v hud-v-route is-timeline">${голова}<ol>${точки.map((p, i) => `<li class="${i === точки.length - 1 ? 'is-now' : ''}"><span class="t">${escapeHtml(время(p))}</span><i class="dot" aria-hidden="true"></i><span class="hud-v-card"><b>${escapeHtml(p.place || 'Без названия')}</b>${p.action ? `<small>${escapeHtml(p.action)}</small>` : ''}${i === точки.length - 1 ? '<span class="hud-v-tag">сейчас здесь</span>' : ''}</span></li>`).join('')}</ol></div>`;
  }
  if (вид === 'map') {
    // Места на схеме — по хэшу названия: одно и то же место всегда в одной
    // точке. Настоящих координат нет, это набросок пути.
    const W = 320, H = 170, П = 24;
    // Русло — кривая Безье (как в рисунке ниже); y реки над точкой x.
    const РЕКА = [[-10, H * .72], [W * .25, H * .55], [W * .45, H * .95], [W + 10, H * .62]];
    const рекаY = (x) => {
      let лучше = РЕКА[0][1], ошибка = Infinity;
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        const bx = k.reduce((с, в, j) => с + в * РЕКА[j][0], 0), by = k.reduce((с, в, j) => с + в * РЕКА[j][1], 0);
        if (Math.abs(bx - x) < ошибка) { ошибка = Math.abs(bx - x); лучше = by; }
      }
      return лучше;
    };
    const места = [];
    const позиции = точки.map(p => {
      const имя = (p.place || '').trim().toLowerCase();
      const было = места.find(м => м.имя === имя);
      if (было) return было;
      const h = hudHashSeed(имя || String(места.length));
      const x = П + (h % 1000) / 1000 * (W - 2 * П);
      let y = П + 8 + ((h >> 10) % 1000) / 1000 * (H - 2 * П - 8);
      // На реку места не ставим: отодвигаем на берег — туда, где больше места.
      const р = рекаY(x);
      if (Math.abs(y - р) < 20) y = р - П - 8 > 20 + П ? р - 22 : р + 22;
      const м = { имя, x, y: огр(y, П + 8, H - 10), n: места.length + 1 };
      места.push(м);
      return м;
    });
    const r = (seed) => { let x = Math.imul(seed + 7, 2654435761) >>> 0; x ^= x >>> 15; return (x % 1000) / 1000; };
    const кварталы = Array.from({ length: 14 }, (_, i) => `<rect class="block" x="${(r(i) * (W - 40)).toFixed(0)}" y="${(r(i + 50) * (H - 30)).toFixed(0)}" width="${(22 + r(i + 90) * 36).toFixed(0)}" height="${(14 + r(i + 130) * 22).toFixed(0)}" rx="3"/>`).join('');
    const путь = позиции.map((м, i) => (i ? 'L' : 'M') + м.x.toFixed(1) + ' ' + м.y.toFixed(1)).join(' ');
    const пины = места.map(м => { const сейчас = м === позиции[позиции.length - 1]; return `<g class="pin${сейчас ? ' is-now' : ''}" transform="translate(${м.x.toFixed(1)} ${м.y.toFixed(1)})">${сейчас ? '<circle class="pulse" r="9"/>' : ''}<path class="drop" d="M0 0c-5.5-6-8-9.6-8-13a8 8 0 0 1 16 0c0 3.4-2.5 7-8 13Z"/><text y="-10.4">${м.n}</text></g>`; }).join('');
    return `<div class="hud-v hud-v-route is-map">${голова}<svg class="hud-v-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Маршрут на схеме">`
      + `<path class="river" d="M-10 ${H * .72} C ${W * .25} ${H * .55}, ${W * .45} ${H * .95}, ${W + 10} ${H * .62}"/>`
      + `<path class="road" d="M0 ${H * .35}H${W}M${W * .38} 0V${H}M${W * .72} 0 ${W * .66} ${H}"/>${кварталы}`
      + `<circle class="park" cx="${W * .15}" cy="${H * .22}" r="16"/>`
      + `<path class="trail-glow" d="${путь}"/><path class="trail" d="${путь}"/>${пины}</svg>`
      + `<ol class="hud-v-map-legend">${точки.map((p, i) => `<li class="${i === точки.length - 1 ? 'is-now' : ''}"><i>${позиции[i].n}</i><span class="t">${escapeHtml(время(p))}</span><b>${escapeHtml(p.place || '')}</b>${p.action ? `<small>${escapeHtml(p.action)}</small>` : ''}</li>`).join('')}</ol></div>`;
  }
  if (вид === 'footsteps') {
    const след = '<svg viewBox="0 0 20 28" aria-hidden="true"><ellipse cx="10" cy="17" rx="5.5" ry="8"/><circle cx="4.5" cy="5.5" r="1.6"/><circle cx="8.3" cy="3.4" r="1.7"/><circle cx="12.4" cy="3.6" r="1.6"/><circle cx="15.6" cy="6" r="1.4"/></svg>';
    const шаги = `<span class="hud-v-steps" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i % 2 ? 'r' : 'l'}" style="--i:${i}">${след}</i>`).join('')}</span>`;
    return `<div class="hud-v hud-v-route is-footsteps">${голова}<div class="hud-v-trail">${точки.map((p, i) => `${i ? шаги : ''}<span class="hud-v-stop${i === точки.length - 1 ? ' is-now' : ''}" title="${escapeHtml(p.action || '')}"><small>${escapeHtml(время(p))}</small><b>${escapeHtml(p.place || 'Без названия')}</b>${p.action ? `<em>${escapeHtml(p.action)}</em>` : ''}</span>`).join('')}</div></div>`;
  }
  return '';
}

/* --- Жизненные показатели --------------------------------------------------- */

function разобратьВитал(value) {
  const п = {};
  String(value || '').split(/[;\n]/).forEach(ч => {
    const m = ч.match(/^\s*([^:：]{1,20})[:：]\s*(.+)$/);
    if (!m) return;
    const к = m[1].trim().toLowerCase();
    if (/^(hr|пульс|pulse)$/.test(к)) п.пульс = m[2];
    else if (/^(br|дыхание|breath)$/.test(к)) п.дыхание = m[2];
    else if (/^(tmp|temp|температура)$/.test(к)) п.т = m[2];
  });
  return { пульс: число(п.пульс), дыхание: число(п.дыхание), т: число(п.т), описДыхания: String(п.дыхание || '').replace(/^\s*[\d.,]+\s*,?\s*/, '') };
}
const ПРИБОРЫ = [
  { к: 'пульс', имя: 'Пульс', ед: 'уд/мин', lo: 40, hi: 200, норма: 100, цел: true, значок: '♥' },
  { к: 'дыхание', имя: 'Дыхание', ед: 'в мин', lo: 6, hi: 40, норма: 20, цел: true, значок: '≋' },
  { к: 'т', имя: 'Темп.', ед: '°C', lo: 35, hi: 41, норма: 37.2, значок: '🌡' },
];
const показ = (v, пр) => пр.цел ? String(Math.round(v)) : v.toFixed(1).replace('.', ',');

export function видПоказателей(value, вид) {
  const в = разобратьВитал(value);
  const есть = ПРИБОРЫ.filter(пр => Number.isFinite(в[пр.к]));
  if (!есть.length) return '';
  const доля = (пр) => огр((в[пр.к] - пр.lo) / (пр.hi - пр.lo), 0, 1);
  const цифры = (класс = '') => `<div class="hud-v-vit-nums ${класс}">${есть.map((пр, i) => `<span class="r${i}${в[пр.к] > пр.норма ? ' is-up' : ''}"><i class="dot"></i><small>${пр.имя}</small><b>${показ(в[пр.к], пр)}</b><em>${пр.ед}</em></span>`).join('')}</div>`;
  const такт = Number.isFinite(в.пульс) ? (60 / огр(в.пульс, 30, 220)).toFixed(3) : '1';
  const id = новыйId('vit');
  if (вид === 'dashboard') {
    return `<div class="hud-v hud-v-vit is-dashboard">${есть.map((пр, i) => {
      const угол = -120 + доля(пр) * 240;
      const нормаД = огр((пр.норма - пр.lo) / (пр.hi - пр.lo), 0, 1);
      const дуга = (a0, a1) => { const p = (a) => [30 + 24 * Math.cos((a - 90) * Math.PI / 180), 32 + 24 * Math.sin((a - 90) * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A24 24 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
      const деления = Array.from({ length: 9 }, (_, k) => { const a = (-120 + k * 30 - 90) * Math.PI / 180; return `<line class="tk" x1="${(30 + 19 * Math.cos(a)).toFixed(1)}" y1="${(32 + 19 * Math.sin(a)).toFixed(1)}" x2="${(30 + 21.5 * Math.cos(a)).toFixed(1)}" y2="${(32 + 21.5 * Math.sin(a)).toFixed(1)}"/>`; }).join('');
      return `<div class="hud-v-card hud-v-dial r${i}${в[пр.к] > пр.норма ? ' is-up' : ''}" title="${пр.имя}: ${показ(в[пр.к], пр)} ${пр.ед}"><svg viewBox="0 0 60 50" aria-hidden="true">`
        + `<defs><linearGradient id="${id}${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>`
        + `<path class="arc" d="${дуга(-120, 120)}"/><path class="val" stroke="url(#${id}${i})" d="${дуга(-120, -120 + Math.max(1, доля(пр) * 240))}"/><path class="hot" d="${дуга(-120 + нормаД * 240, 120)}"/>${деления}`
        + `<g transform="rotate(${угол.toFixed(1)} 30 32)"><path class="needle" d="M30 11 31.6 32h-3.2Z"/></g><circle class="hub" cx="30" cy="32" r="3.2"/><circle class="hub-in" cx="30" cy="32" r="1.3"/></svg>`
        + `<b>${показ(в[пр.к], пр)}<small> ${пр.ед}</small></b><span>${пр.имя}</span></div>`;
    }).join('')}</div>`;
  }
  if (вид === 'ecg') {
    const удар = 'l5 0 2.5-9 4 20 3.5-15 2.5 4 7 0';
    const путь = 'M0 22' + ' h6 ' + Array.from({ length: 10 }, () => удар + ' h10').join(' ');
    return `<div class="hud-v hud-v-vit is-ecg" style="--beat:${такт}s"><div class="hud-v-monitor"><svg class="hud-v-ecg" viewBox="0 0 180 44" preserveAspectRatio="none" aria-hidden="true">`
      + `<defs><pattern id="${id}p" width="9" height="9" patternUnits="userSpaceOnUse"><path class="minor" d="M9 0V9H0"/></pattern><linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="f0"/><stop offset=".85" class="f1"/><stop offset="1" class="f2"/></linearGradient></defs>`
      + `<rect width="180" height="44" fill="url(#${id}p)"/><g class="run"><path class="line" stroke="url(#${id}f)" d="${путь}"/></g></svg>`
      + `<span class="hud-v-monitor-bpm"><i aria-hidden="true">♥</i>${Number.isFinite(в.пульс) ? Math.round(в.пульс) : '—'}</span></div>${цифры('is-row')}</div>`;
  }
  if (вид === 'rings') {
    const кольца = есть.map((пр, i) => { const r = 27 - i * 7.5; const д = 2 * Math.PI * r; return `<circle class="track" cx="34" cy="34" r="${r}"/><circle class="val r${i}" cx="34" cy="34" r="${r}" stroke-dasharray="${(д * доля(пр)).toFixed(1)} ${д.toFixed(1)}" transform="rotate(-90 34 34)"><title>${пр.имя}: ${показ(в[пр.к], пр)} ${пр.ед}</title></circle>`; }).join('');
    return `<div class="hud-v hud-v-vit is-rings"><svg class="hud-v-rings" viewBox="0 0 68 68" aria-hidden="true">${кольца}<text x="34" y="38">${Number.isFinite(в.пульс) ? Math.round(в.пульс) : ''}</text></svg>${цифры('is-legend')}</div>`;
  }
  if (вид === 'pulse') {
    return `<div class="hud-v hud-v-vit is-pulse" style="--beat:${такт}s"><span class="hud-v-heartbeat" aria-hidden="true"><i class="echo"></i><i class="echo e2"></i><svg viewBox="0 0 24 24"><path d="${СЕРДЦЕ}"/></svg></span>`
      + `<div class="hud-v-side">${цифры('is-row')}${в.описДыхания && !пусто(в.описДыхания) ? подпись(в.описДыхания) : ''}</div></div>`;
  }
  return '';
}

/* --- Инвентарь -------------------------------------------------------------- */

const ВЕЩИ = [
  ['Связь и техника', '📱', /телефон|смартфон|ноутбук|планшет|рация|наушник|часы|камер|фонар|заряд|phone|laptop/i],
  ['Документы и письма', '✉️', /письм|записк|документ|паспорт|договор|карт[аоу]|фото|билет|книг|блокнот|дневник|конверт|letter|note/i],
  ['Деньги и ценности', '💰', /деньг|кошел|бумажник|карт[аы] банк|монет|золот|купюр|чек|money|wallet/i],
  ['Украшения', '💍', /кольц|серьг|серёж|цепоч|кулон|браслет|ожерел|брош|украш|ring|necklace/i],
  ['Оружие', '🗡️', /нож|пистолет|револьвер|ружь|меч|кинжал|клинок|бит[аы]|кастет|патрон|оружи|gun|knife|sword/i],
  ['Ключи', '🔑', /ключ|брелок|key/i],
  ['Лекарства и еда', '💊', /таблет|лекарств|бинт|аптечк|шприц|пластыр|вод[аы]|еда|бутер|шоколад|вин[оа]|бутылк|кофе|чай|сигарет|зажигал|pill|food/i],
  ['Одежда и сумки', '👜', /сумк|рюкзак|пакет|зонт|шарф|перчат|очки|куртк|пальто|шляп|bag/i],
];
function вещь(п) {
  const г = ВЕЩИ.find(([, , rx]) => rx.test(п.имя)) || ВЕЩИ.find(([, , rx]) => rx.test(п.текст));
  const кол = (п.текст.match(/[×x]\s*(\d+)|(\d+)\s*шт/i) || [])[1];
  return { ...п, группа: г ? г[0] : 'Прочее', значок: г ? г[1] : '📦', кол };
}
const ВАЖНОЕ = /важн|главн|единствен|дорог|тайн|спрят|семейн|подар|памят|берег|не отдаст|никому|сокровищ|секрет/i;

export function видИнвентаря(value, вид) {
  const вещи = пары(value).map(вещь);
  if (!вещи.length) return '';
  const титул = (в) => `${escapeHtml(в.имя)}${в.текст ? ': ' + escapeHtml(в.текст) : ''}`;
  const вес = (в, i) => (ВАЖНОЕ.test(в.имя + ' ' + в.текст) ? 2 : 0) + (i === 0 ? 1 : i < 3 ? 0.5 : 0);
  const редкость = (в, i) => { const w = вес(в, i); return w >= 2 ? 'r3' : w >= 1 ? 'r2' : 'r1'; };
  if (вид === 'grid') {
    // Слоты как в RPG: рамка по важности, пустые ячейки добивают ряд.
    const пустых = (4 - вещи.length % 4) % 4;
    return `<div class="hud-v hud-v-inv is-grid">${вещи.map((в, i) => `<span class="hud-v-slot ${редкость(в, i)}" title="${титул(в)}"><i aria-hidden="true">${в.значок}</i><b>${escapeHtml(в.имя)}</b>${в.кол ? `<em>×${escapeHtml(в.кол)}</em>` : ''}</span>`).join('')}${'<span class="hud-v-slot is-empty" aria-hidden="true"></span>'.repeat(пустых)}</div>`;
  }
  if (вид === 'cards') {
    return `<div class="hud-v hud-v-inv is-cards">${вещи.map((в, i) => `<span class="hud-v-card hud-v-item ${редкость(в, i)}"><i class="badge" aria-hidden="true">${в.значок}</i><span><b>${escapeHtml(в.имя)}</b>${в.текст ? `<small>${applyTooltips(в.текст)}</small>` : ''}<span class="hud-v-tag">${escapeHtml(в.группа)}</span></span></span>`).join('')}</div>`;
  }
  if (вид === 'groups') {
    const порядок = [...ВЕЩИ.map(([г]) => г), 'Прочее'];
    const значки = Object.fromEntries([...ВЕЩИ.map(([г, з]) => [г, з]), ['Прочее', '📦']]);
    const группы = порядок.map(г => [г, вещи.filter(в => в.группа === г)]).filter(([, с]) => с.length);
    return `<div class="hud-v hud-v-inv is-groups">${группы.map(([г, с]) => `<div class="hud-v-card hud-v-group"><div class="hud-v-group-head"><i aria-hidden="true">${значки[г]}</i>${escapeHtml(г)}<em>${с.length}</em></div>${с.map(в => `<span class="hud-v-row-item" title="${титул(в)}"><b>${escapeHtml(в.имя)}</b>${в.текст ? `<small>${escapeHtml(в.текст)}</small>` : ''}</span>`).join('')}</div>`).join('')}</div>`;
  }
  if (вид === 'weight') {
    // Важность: слова о ценности и порядок в списке — первое модель пишет
    // самым заметным. Три размера, чтобы разница читалась.
    const по = вещи.map((в, i) => ({ в, w: вес(в, i) })).sort((a, b) => b.w - a.w);
    return `<div class="hud-v hud-v-inv is-weight">${по.map(({ в, w }) => `<span class="hud-v-chip ${w >= 2 ? 'w3' : w >= 1 ? 'w2' : 'w1'}" title="${титул(в)}"><i aria-hidden="true">${в.значок}</i>${escapeHtml(в.имя)}</span>`).join('')}</div>`;
  }
  return '';
}

/* --- Секреты ---------------------------------------------------------------- */

const имяЧеловека = (x) => String((x && typeof x === 'object' ? (x.name || x.who) : x) || '').trim();
const нетИмени = (n) => !n || /^(none|empty|null|нет|никто|-|—)$/i.test(n);
function разобратьСекрет(s) {
  const lv = String(s.level || '').toLowerCase();
  const уровень = /crit|особ/.test(lv) ? 3 : /high|строг/.test(lv) ? 2 : 1;
  const st = String(s.status || '').toLowerCase();
  const огласка = /unknown|неизвест/.test(st) ? 0 : /suspect|подозр/.test(st) ? 1 : /part|частич/.test(st) ? 2 : /known|извест/.test(st) ? 3 : 0;
  const списком = (v) => Array.isArray(v) ? v : (v ? [v] : []);
  const знают = списком(s.knows).map(имяЧеловека).filter(n => !нетИмени(n));
  const знаютНиз = знают.map(n => n.toLowerCase());
  const неЗнают = списком(s.unaware ?? s.hidden).map(имяЧеловека).filter(n => !нетИмени(n) && !знаютНиз.includes(n.toLowerCase()));
  return { факт: String(s.fact || '').trim(), уровень, огласка, знают, неЗнают };
}
const ГРИФ = ['', 'СЕКРЕТНО', 'СТРОГО СЕКРЕТНО', 'ОСОБОЙ ВАЖНОСТИ'];
const ОГЛАСКА = ['не раскрыт', 'подозревают', 'частично', 'известен'];
// Текст секрета спрятан, пока на него не навели или не нажали (как в списке).
const тайна = (т) => `<span class="hud-v-spoil" tabindex="0" title="Нажмите, чтобы прочитать">${applyTooltips(т)}</span>`;
const люди = (имена, знают) => имена.map(n => `<span class="hud-v-person${знают ? ' is-k' : ''}" title="${escapeHtml(n)}: ${знают ? 'знает' : 'не знает'}">${лицо(n)}${escapeHtml(первое(n))}</span>`).join('');

export function видСекретов(secrets, вид) {
  const все = (Array.isArray(secrets) ? secrets : []).map(разобратьСекрет).filter(с => с.факт);
  if (!все.length) return '';
  const кто = (с) => `<div class="hud-v-people">${люди(с.знают, true)}${люди(с.неЗнают, false)}</div>`;
  if (вид === 'iceberg') {
    // Над водой — то, что уже всплыло; под водой — глубже тем, чем строже гриф.
    const над = все.filter(с => с.огласка >= 2), под = все.filter(с => с.огласка < 2).sort((a, b) => a.уровень - b.уровень);
    const пункт = (с, глубь) => `<div class="hud-v-ice-item${глубь ? ' d' + с.уровень : ''}"><span class="hud-v-tag">${глубь ? ГРИФ[с.уровень].toLowerCase() + ' · ' : ''}${ОГЛАСКА[с.огласка]}</span><b>${тайна(с.факт)}</b>${кто(с)}</div>`;
    return `<div class="hud-v hud-v-iceberg"><svg class="hud-v-berg" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true"><path class="tip" d="M70 38 92 8l14 14 12-10 22 26Z"/><path class="under" d="M58 40h94l22 34-18 34-44 12-40-14-26-32Z"/></svg>`
      + `<div class="hud-v-ice-top">${над.map(с => пункт(с, false)).join('') || '<small class="hud-v-empty">на поверхности ничего</small>'}</div>`
      + `<div class="hud-v-waterline" aria-hidden="true"><i></i></div><div class="hud-v-ice-deep">${под.map(с => пункт(с, true)).join('') || '<small class="hud-v-empty">в глубине пусто</small>'}</div></div>`;
  }
  if (вид === 'files') {
    return `<div class="hud-v hud-v-files">${все.map((с, i) => `<div class="hud-v-file l${с.уровень}" style="--r:${((hudHashSeed(с.факт) % 5) - 2) * 0.5}deg"><span class="hud-v-file-tab">ДЕЛО №${String(i + 1).padStart(3, '0')}</span><i class="clip" aria-hidden="true"></i><span class="hud-v-stamp">${ГРИФ[с.уровень]}</span>`
      + `<b>${тайна(с.факт)}</b><span class="hud-v-file-status">статус: ${ОГЛАСКА[с.огласка]}</span><div class="hud-v-file-lines"><small>знают: ${с.знают.length ? escapeHtml(с.знают.join(', ')) : 'никто'}</small>${с.неЗнают.length ? `<small>не знают: ${escapeHtml(с.неЗнают.join(', '))}</small>` : ''}</div></div>`).join('')}</div>`;
  }
  if (вид === 'web') {
    return `<div class="hud-v hud-v-webs">${все.map(с => {
      const все2 = [...с.знают.map(n => [n, true]), ...с.неЗнают.map(n => [n, false])].slice(0, 8);
      const C = [70, 46], Rx = 52, Ry = 32;
      const узлы = все2.map(([n, знает], i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, все2.length); return { n, знает, x: C[0] + Rx * Math.cos(a), y: C[1] + Ry * Math.sin(a) }; });
      return `<div class="hud-v-card hud-v-web l${с.уровень}"><svg viewBox="0 0 140 92" role="img" aria-label="Кто знает секрет">`
        + узлы.map(у => `<path class="${у.знает ? 'k' : 'u'}" d="M${C[0]} ${C[1]}Q${((C[0] + у.x) / 2 + (у.y - C[1]) * .15).toFixed(1)} ${((C[1] + у.y) / 2 - (у.x - C[0]) * .15).toFixed(1)} ${у.x.toFixed(1)} ${у.y.toFixed(1)}"/>`).join('')
        + `<circle class="core-glow" cx="${C[0]}" cy="${C[1]}" r="14"/><circle class="core" cx="${C[0]}" cy="${C[1]}" r="9"/><text class="core-t" x="${C[0]}" y="${C[1] + 3.2}">🔒</text>`
        + узлы.map(у => `<g class="node ${у.знает ? 'k' : 'u'}" style="${тон(у.n)}"><circle cx="${у.x.toFixed(1)}" cy="${у.y.toFixed(1)}" r="8"/><text x="${у.x.toFixed(1)}" y="${(у.y + 2.6).toFixed(1)}">${escapeHtml(инициалы(у.n))}</text><title>${escapeHtml(у.n)}: ${у.знает ? 'знает' : 'не знает'}</title></g>`).join('')
        + `</svg><span class="hud-v-tag">${ГРИФ[с.уровень].toLowerCase()} · ${ОГЛАСКА[с.огласка]}</span><b>${тайна(с.факт)}</b>${кто(с)}</div>`;
    }).join('')}</div>`;
  }
  if (вид === 'bars') {
    return `<div class="hud-v hud-v-secbars">${все.map(с => {
      const всего = с.знают.length + с.неЗнают.length;
      const доля = всего ? Math.round(с.знают.length / всего * 100) : [0, 25, 60, 100][с.огласка];
      const сегменты = (n, из, класс) => `<span class="hud-v-segments ${класс}" aria-hidden="true">${Array.from({ length: из }, (_, i) => `<i${i < n ? ' class="is-on"' : ''}></i>`).join('')}</span>`;
      return `<div class="hud-v-card hud-v-secbar l${с.уровень}"><b>${тайна(с.факт)}</b>`
        + `<div class="hud-v-meter"><small>🔒 гриф</small>${сегменты(с.уровень, 3, 'is-lvl')}<em>${ГРИФ[с.уровень].toLowerCase()}</em></div>`
        + `<div class="hud-v-meter"><small>📢 огласка</small><span class="hud-v-mini-bar is-spread"><i style="width:${доля}%"></i></span><em>${ОГЛАСКА[с.огласка]}${всего ? ` · ${с.знают.length}/${всего}` : ''}</em></div></div>`;
    }).join('')}</div>`;
  }
  return '';
}

/* --- Ружья Чехова ----------------------------------------------------------- */

function разобратьРужья(guns) {
  return (Array.isArray(guns) ? guns : []).map(строка => {
    const [завязка = '', кто = '', статус = ''] = String(строка).split('|').map(s => s.trim());
    if (!завязка) return null;
    const с = статусРужья(статус);
    return { завязка, кто, ключ: с.ключ, текст: с.текст };
  }).filter(Boolean);
}
const ЭТАП = { open: 0, building: 1, fired: 2 };

export function видРужей(guns, вид) {
  const все = разобратьРужья(guns);
  if (!все.length) return '';
  if (вид === 'board') {
    return `<div class="hud-v hud-v-board">${все.map(р => `<div class="hud-v-note-card is-${р.ключ}" style="--r:${((hudHashSeed(р.завязка) % 7) - 3) * 0.9}deg"><i class="pin" aria-hidden="true"></i>`
      + `<p>${applyTooltips(р.завязка)}</p>${р.кто ? `<small>${escapeHtml(р.кто)}</small>` : ''}<em class="stamp">${escapeHtml(р.текст)}</em></div>`).join('')}</div>`;
  }
  if (вид === 'timeline') {
    const колонки = [['open', 'Висит', '🎯'], ['building', 'Назревает', '⏳'], ['fired', 'Выстрелило', '💥']];
    return `<div class="hud-v hud-v-gun-cols">${колонки.map(([к, имя, значок]) => {
      const тут = все.filter(р => р.ключ === к);
      return `<div class="hud-v-gun-col is-${к}"><div class="hud-v-gun-col-head"><i aria-hidden="true">${значок}</i>${имя}<em>${тут.length}</em></div>${тут.map(р => `<div class="hud-v-gun-card"><p>${applyTooltips(р.завязка)}</p>${р.кто ? `<small>${escapeHtml(р.кто)}</small>` : ''}</div>`).join('') || '<span class="hud-v-empty">пусто</span>'}</div>`;
    }).join('')}</div>`;
  }
  if (вид === 'progress') {
    // Фитиль: от «висит» до «выстрелило» он догорает, искра — там, где
    // сейчас нить; в конце — заряд.
    return `<div class="hud-v hud-v-fuses">${все.map(р => {
      const д = [14, 56, 100][ЭТАП[р.ключ] ?? 0];
      return `<div class="hud-v-card hud-v-fuse is-${р.ключ}" style="--p:${д}%"><p>${applyTooltips(р.завязка)}${р.кто ? ` <small>· ${escapeHtml(р.кто)}</small>` : ''}</p>`
        + `<div class="hud-v-fuse-line" aria-label="${escapeHtml(р.текст)}"><i class="rope"></i><i class="burnt"></i>${р.ключ === 'fired' ? '<i class="boom" aria-hidden="true">💥</i>' : '<i class="spark" aria-hidden="true"></i><i class="charge" aria-hidden="true">🧨</i>'}</div>`
        + `<div class="hud-v-fuse-scale" aria-hidden="true"><span${р.ключ === 'open' ? ' class="is-on"' : ''}>висит</span><span${р.ключ === 'building' ? ' class="is-on"' : ''}>назревает</span><span${р.ключ === 'fired' ? ' class="is-on"' : ''}>выстрелило</span></div></div>`;
    }).join('')}</div>`;
  }
  return '';
}

/* --- Кинки и фетиши --------------------------------------------------------- */

// Сила влечения по описанию: «обязательное условие» — пять, «с интересом,
// пока в мечтах» — три, «иногда» — два. Числа модель не пишет.
function сила(т) {
  const s = String(т || '');
  const n = число(s);
  if (Number.isFinite(n) && /\d\s*(?:\/\s*(?:5|10)|из)/.test(s)) return огр(Math.round(/10/.test(s) ? n / 2 : n), 1, 5);
  if (/обязательн|главн|без этого|сводит с ума|обожа|безумн|одержим|мгновенн/i.test(s)) return 5;
  if (/сильн|охотно|любит|очень|заводит|нравится/i.test(s)) return 4;
  if (/интерес|хочет попробовать|любопыт|в мечтах|мечта/i.test(s)) return 3;
  if (/иногда|может|допускает|спокойн|терпит|под настроение/i.test(s)) return 2;
  if (/редко|нехотя|почти нет|слаб/i.test(s)) return 1;
  return 3;
}
const ГЛУБЬ = /мечт|тайн|стыд|не признаётся|не признается|скрыва|пока только|в фантаз|никому|боится признаться|втайне/i;
const ТИПЫ_ВЛЕЧЕНИЙ = [
  ['Власть и контроль', '👑', /домин|подчин|контрол|приказ|власт|связ|верёв|верев|наручник|сверху|снизу|послуш|dom|sub|bdsm/i],
  ['Ощущения', '✨', /бол|шлеп|шлёп|укус|кус|щекот|лёд|лед|воск|царап|сжат|дыхан|удуш|жар|холод/i],
  ['Роли и игры', '🎭', /рол|игр|сценар|костюм|форм[аеу]|незнаком|учител|начальн/i],
  ['Эмоции', '💞', /предан|нежн|ревн|уязвим|эмоц|забот|ласк|шёпот|шепот|похвал|унижен/i],
  ['Тело и детали', '🌹', /ше[яиюе]|рук|ног|голос|запах|волос|губ|бёдр|бедр|груд|кож|чулк|бель/i],
];
const СЛОВО_СИЛЫ = ['', 'едва', 'слегка', 'интересно', 'сильно', 'непреодолимо'];

export function видВлечений(value, вид) {
  const все = пары(value).map(п => {
    const т = ТИПЫ_ВЛЕЧЕНИЙ.find(([, , rx]) => rx.test(п.имя + ' ' + п.текст));
    return { ...п, сила: сила(п.текст), глубина: ГЛУБЬ.test(п.текст), тип: т ? т[0] : 'Разное', значок: т ? т[1] : '❖' };
  });
  if (!все.length) return '';
  const строка = (п, правее = '', низ = '') => `<div class="hud-v-card hud-v-kink s${п.сила}"><div class="hud-v-kink-head"><b>${escapeHtml(п.имя)}</b>${правее}</div>${низ}${п.текст ? `<small>${applyTooltips(п.текст)}</small>` : ''}</div>`;
  if (вид === 'bars') return `<div class="hud-v hud-v-kinks is-bars">${все.map(п => строка(п, `<span class="hud-v-tag">${СЛОВО_СИЛЫ[п.сила]}</span>`, `<span class="hud-v-segments is-kink" aria-label="${п.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i${i <= п.сила ? ' class="is-on"' : ''}></i>`).join('')}</span>`)).join('')}</div>`;
  if (вид === 'stars') return `<div class="hud-v hud-v-kinks is-stars">${все.map(п => строка(п, `<span class="hud-v-stars" aria-label="${п.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i${i <= п.сила ? ' class="is-on"' : ''}>★</i>`).join('')}</span>`)).join('')}</div>`;
  if (вид === 'iceberg') {
    const над = все.filter(п => !п.глубина), под = все.filter(п => п.глубина);
    return `<div class="hud-v hud-v-iceberg is-kinks"><svg class="hud-v-berg" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true"><path class="tip" d="M70 38 92 8l14 14 12-10 22 26Z"/><path class="under" d="M58 40h94l22 34-18 34-44 12-40-14-26-32Z"/></svg>`
      + `<div class="hud-v-ice-top"><span class="hud-v-ice-label">на поверхности</span>${над.map(п => строка(п)).join('') || '<small class="hud-v-empty">всё спрятано</small>'}</div><div class="hud-v-waterline" aria-hidden="true"><i></i></div>`
      + `<div class="hud-v-ice-deep"><span class="hud-v-ice-label">в глубине</span>${под.map(п => строка(п)).join('') || '<small class="hud-v-empty">в глубине ничего</small>'}</div></div>`;
  }
  if (вид === 'groups') {
    const порядок = [...ТИПЫ_ВЛЕЧЕНИЙ.map(([т, з]) => [т, з]), ['Разное', '❖']];
    return `<div class="hud-v hud-v-kinks is-groups">${порядок.map(([т, з]) => [т, з, все.filter(п => п.тип === т)]).filter(([, , с]) => с.length).map(([т, з, с]) => `<div class="hud-v-group"><div class="hud-v-group-head"><i aria-hidden="true">${з}</i>${escapeHtml(т)}<em>${с.length}</em></div>${с.map(п => строка(п)).join('')}</div>`).join('')}</div>`;
  }
  return '';
}
