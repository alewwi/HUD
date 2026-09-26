// hud-manager/render/views.js
//
// Виды блоков карточки на выбор (Кастомизация → Вид блоков): доверие, страхи,
// готовность к оргазму, разоблачение, привязанность спутника, карта тела,
// маршрут, жизненные показатели, инвентарь, секреты, ружья Чехова, кинки и
// фетиши. Первый вид в каждом списке — прежний, «как сейчас»: его рисуют
// старые сборщики, а здесь только новые. Данные те же, что у прежних видов,
// — модель ничего нового не пишет. Оформление — css/views.css.

import { escapeHtml, applyTooltips, разбитьСписок, hudHashSeed, getSafeUserName } from '../utils.js?v=23.13.2';
import { overrideAvatarUrl, getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=23.13.2';
import { namesLikelySame } from '../names.js?v=23.13.2';
import { силаСтраха, статусРужья } from '../codes.js?v=23.13.2';
import { settings } from '../settings.js?v=23.13.2';
import { зоныКарты, ПЯТНА, ЗОНЫ } from './intimacy.js?v=23.13.2';
import { ико, медаль, ИКОНКИ } from './view-icons.js?v=23.13.2';

// Порядок — как строки идут в карточке (character.js → FIELD_ORDER, вкладка
// «Память» — сверху вниз), чтобы в «Кастомизации» блоки шли так же.
export const ВИДЫ_БЛОКОВ = [
  { ключ: 'inventoryView', группа: 'Персонаж', поле: 'Инвентарь', виды: { list: 'Список', grid: 'Слоты', cards: 'Карточки', groups: 'По группам', weight: 'По важности', receipt: 'Опись' } },
  { ключ: 'trustView', группа: 'Персонаж', поле: 'Доверие', виды: { bars: 'Полоски', hearts: 'Сердца', shield: 'Щит', ring: 'Кольца', traffic: 'Светофор', spectrum: 'Спектр', orbit: 'Орбиты' } },
  { ключ: 'fearsView', группа: 'Персонаж', поле: 'Страхи', виды: { list: 'Список', thermometer: 'Термометры', skulls: 'Черепа', storm: 'Тучи', radar: 'Радар', dark: 'Во тьме' } },
  { ключ: 'memoriesView', группа: 'Персонаж', поле: 'Общие воспоминания', виды: { list: 'Список', polaroid: 'Полароиды', film: 'Плёнка', beads: 'Бусины' } },
  { ключ: 'exposureView', группа: 'Персонаж', поле: 'Разоблачение', виды: { text: 'Текст', bar: 'Шкала', mask: 'Маска', eye: 'Глаз', hourglass: 'Песочные часы' } },
  { ключ: 'jealousyView', группа: 'Персонаж', поле: 'Ревность', виды: { text: 'Текст', triangle: 'Треугольник', thorns: 'Шипы', thought: 'Мысли' } },
  { ключ: 'orgView', группа: 'Близость', поле: 'Готовность к оргазму', виды: { bar: 'Шкала', ring: 'Кольцо', flame: 'Пламя', wave: 'Волна', pulse: 'Пульс', glass: 'Бокал' } },
  { ключ: 'vitalsView', группа: 'Близость', поле: 'Жизненные показатели', виды: { list: 'Плитки', dashboard: 'Циферблаты', ecg: 'Монитор ЭКГ', rings: 'Кольца', pulse: 'Сердце', anatomy: 'Анатомия' } },
  { ключ: 'bodyMapView', группа: 'Близость', поле: 'Карта тела', виды: { both: 'Спереди и сзади', front: 'Спереди', list: 'Список', dots: 'Точки', zones: 'Блоки', constellation: 'Созвездие', words: 'Облако слов' } },
  { ключ: 'kinkView', группа: 'Близость', поле: 'Кинки и фетиши', виды: { pills: 'Пилюли', bars: 'Шкалы', tarot: 'Карты таро', groups: 'По типу', stars: 'Звёзды', menu: 'Меню' } },
  { ключ: 'routeView', группа: 'Память', поле: 'Маршрут', виды: { list: 'Схема', timeline: 'Лента', map: 'Карта', footsteps: 'Следы', tickets: 'Билеты' } },
  { ключ: 'importantView', группа: 'Память', поле: 'Важное', виды: { list: 'Список', scroll: 'Свиток', notebook: 'Блокнот', bookmarks: 'Закладки' } },
  { ключ: 'gunsView', группа: 'Память', поле: 'Ружья Чехова', виды: { list: 'Список', board: 'Доска', timeline: 'Колонки', progress: 'Фитиль', cylinder: 'Барабан' } },
  { ключ: 'secretsView', группа: 'Память', поле: 'Секреты', виды: { list: 'Список', vault: 'Сейфы', files: 'Папки', web: 'Сеть', bars: 'Шкалы', envelopes: 'Конверты' } },
  { ключ: 'bondView', группа: 'Спутники', поле: 'Привязанность', виды: { bars: 'Полоска', hearts: 'Сердца', paw: 'Лапа', tag: 'Жетон' } },
];

// Выбранный вид блока; неизвестное значение — прежний вид. Карта тела
// помнит старую галку «Карта тела картинкой»: выключена — список.
export function видБлока(ключ) {
  const б = ВИДЫ_БЛОКОВ.find(x => x.ключ === ключ);
  if (!б) return '';
  const v = settings[ключ];
  if (б.виды[v]) return v;
  // Айсберг заменён: у кинков — карты таро, у секретов — сейфы.
  if (v === 'iceberg') return ключ === 'kinkView' ? 'tarot' : 'vault';
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
// Аватарка по имени: ручная, персона игрока, карточка или сообщение в
// Таверне — что найдётся. Нет — кружок с инициалами в тоне акцента.
function аватарка(имя) {
  try {
    let url = overrideAvatarUrl(имя);
    const игрок = getSafeUserName();
    if (!url && игрок && namesLikelySame(имя, игрок)) url = getUserAvatarUrl();
    if (!url) { const a = getAvatarUrl(имя, false); url = a && a.url; }
    return url || '';
  } catch (_) { return ''; }
}
// Кружок-лицо. data-ava-* — чтобы refreshAvatarFaces менял картинку без
// перерисовки; data-ava-bg пуст: без картинки заливку даёт CSS.
function лицо(имя, класс = 'hud-v-face', текст = инициалы(имя)) {
  const url = аватарка(имя);
  return `<i class="${класс}${url ? ' has-img' : ''}" data-ava-name="${escapeHtml(имя)}" data-ava-auto="1" data-ava-bg="" style="${тон(имя)}${url ? `;background-image:url('${escapeHtml(url)}')` : ''}" aria-hidden="true">${escapeHtml(текст)}</i>`;
}
// То же лицо внутри SVG: кружок с инициалами, поверх — картинка по кругу.
function лицоSvg(имя, x, y, r, класс = '') {
  const url = аватарка(имя), id = новыйId('fc');
  return `<g class="hud-v-sface${класс ? ' ' + класс : ''}${url ? ' has-img' : ''}" style="${тон(имя)}"><circle class="disc" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/><text x="${x.toFixed(1)}" y="${(y + r * .34).toFixed(1)}" style="font-size:${(r * .9).toFixed(1)}px">${escapeHtml(инициалы(имя))}</text>`
    + (url ? `<clipPath id="${id}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r - .6).toFixed(1)}"/></clipPath><image href="${escapeHtml(url)}" x="${(x - r).toFixed(1)}" y="${(y - r).toFixed(1)}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>` : '')
    + `<circle class="ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r - .3).toFixed(1)}"/><title>${escapeHtml(имя)}</title></g>`;
}

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
    return `<svg viewBox="0 0 24 24" style="--i:${i}" class="${f >= 1 ? 'is-full' : f > 0 ? 'is-part' : ''}"><path class="bg" d="${СЕРДЦЕ}"/><path class="fg" d="${СЕРДЦЕ}" style="clip-path:inset(0 ${((1 - f) * 100).toFixed(0)}% 0 0)"/></svg>`;
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
      + `<i class="hud-v-ring" style="--p:${ч.v.toFixed(0)};${тон(ч.кто)}" aria-hidden="true">${лицо(ч.кто, 'hud-v-ring-face')}</i>`
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
      + `</div><div class="hud-v-spectrum-scale" aria-hidden="true"><span>${ико('lock')} не доверяет</span><span>доверяет ${ико('unlock')}</span></div></div>`;
  }
  if (вид === 'orbit' && счёт.length) {
    // Орбиты вокруг сердца: чем больше доверия, тем ближе к центру. Три
    // эллипса — «свои», «настороже», «чужие»; люди — лицами на орбитах.
    const W = 320, H = 186, cx = 160, cy = 88;
    const rOf = (v) => 20 + (100 - v) / 100 * 62;
    const по = счёт.slice().sort((a, b) => b.v - a.v);
    const орбиты = [[88, 'свои'], [50, 'настороже'], [12, 'чужие']].map(([v, имя]) => { const r = rOf(v); return `<ellipse class="orbit" cx="${cx}" cy="${cy}" rx="${(r * 1.7).toFixed(1)}" ry="${(r * .82).toFixed(1)}"/><text class="orbit-t" x="${cx}" y="${(cy - r * .82 - 2.5).toFixed(1)}">${имя}</text>`; }).join('');
    const лица = по.map((ч, i) => {
      const r = rOf(ч.v), a = Math.PI * .22 + i * 2 * Math.PI / по.length + (i % 2) * .35;
      const x = cx + r * 1.7 * Math.cos(a), y = cy + r * .82 * Math.sin(a);
      return `<g class="who ${ступень(ч.v)}">${лицоSvg(ч.кто, x, y, 11)}<text class="who-t" x="${x.toFixed(1)}" y="${(y + 20).toFixed(1)}">${escapeHtml(первое(ч.кто))} · ${Math.round(ч.v)}</text></g>`;
    }).join('');
    const id = новыйId('ob');
    return `<div class="hud-v hud-v-trust is-orbit"><svg class="hud-v-orbits" viewBox="0 0 ${W} ${H}" role="img" aria-label="Доверие: ${escapeHtml(по.map(ч => ч.кто + ' — ' + Math.round(ч.v)).join('; '))}">`
      + `<defs><radialGradient id="${id}"><stop offset="0" class="c0"/><stop offset=".45" class="c1"/><stop offset="1" class="c2"/></radialGradient></defs>`
      + `<circle class="sun-glow" cx="${cx}" cy="${cy}" r="26" fill="url(#${id})"/>${орбиты}`
      + `<g class="sun"><circle cx="${cx}" cy="${cy}" r="9"/><path transform="translate(${cx - 6} ${cy - 6.4}) scale(.5)" d="${СЕРДЦЕ}"/></g>${лица}</svg></div>`;
  }
  return '';
}

/* --- Страхи ----------------------------------------------------------------- */

const ЗНАЧКИ_СТРАХА = [
  [/смерт|умер|гибел|убь|death|die/i, 'skull'], [/потер|уйд|брос|один|одинок|lose|abandon/i, 'heartbreak'],
  [/узна|раскро|разоблач|правд|ошибк|expose|truth/i, 'eye'], [/отец|мать|семь|родн|брат|сестр|father|mother|family/i, 'house'],
  [/темн|ночь|dark/i, 'moon'], [/боль|пытк|удар|pain|hurt/i, 'drop'], [/высот|паден|height|fall/i, 'fall'],
  [/вод|утон|water|drown/i, 'wave'], [/огон|пожар|fire|burn/i, 'flame'], [/тюрьм|клетк|запер|cage|prison/i, 'cage'],
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
    return { что: п.имя, слово, сила: силаЧислом(слово || п.текст), значок: пара ? пара[1] : 'ghost' };
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
      + `<span class="hud-v-thermo-text">${медаль(с.значок)}<b>${escapeHtml(с.что)}</b>${бирка(с)}</span></div>`).join('')}</div>`;
  }
  if (вид === 'skulls') {
    return `<div class="hud-v hud-v-fears is-skulls">${страхи.map(с => `<div class="hud-v-card s${с.сила}" title="${титул(с)}">`
      + `${медаль(с.значок, 'is-lg')}<div class="hud-v-skull-text"><b>${escapeHtml(с.что)}</b>${бирка(с)}</div>`
      + `<span class="hud-v-skulls" aria-label="${с.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i style="--i:${i}"${i <= с.сила ? ' class="is-on"' : ''}>${ико('skull')}</i>`).join('')}</span></div>`).join('')}</div>`;
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
  if (вид === 'dark') {
    // Во тьме: у каждого страха — силуэт в тумане с горящими глазами.
    // Сильнее страх — силуэт крупнее, ближе (ниже), глаза злее и ярче,
    // брови сведены. Слабый — едва различим в глубине.
    return `<div class="hud-v hud-v-fears is-dark"><div class="hud-v-dark"><i class="fog f1" aria-hidden="true"></i><i class="fog f2" aria-hidden="true"></i>${страхи.map((с, i) => {
      const id = новыйId('dk'), k = .72 + с.сила * .09, злость = с.сила >= 4 ? 3.2 : с.сила >= 3 ? 1.6 : 0;
      const глаз = (x) => `<g transform="translate(${x} 34)"><circle class="halo" r="8" fill="url(#${id}h)"/><path class="eyeball" fill="url(#${id}e)" d="M-5.4 0C-3.2-3.4 3.2-3.4 5.4 0 3.2 2.8-3.2 2.8-5.4 0Z"/><ellipse class="slit" rx=".95" ry="2.3"/>`
        + (злость ? `<path class="brow" d="M${x < 50 ? -6 : 6} ${-4.6 - злость * .3}L${x < 50 ? 4.4 : -4.4} ${-3.4 + злость * .5}"/>` : '') + `</g>`;
      return `<div class="hud-v-dark-one s${с.сила}" style="--k:${k.toFixed(2)};--y:${((5 - с.сила) * 6).toFixed(0)}px;--d:${(i * .6).toFixed(1)}s" title="${титул(с)}">`
        + `<svg class="hud-v-shade" viewBox="0 0 100 78" aria-hidden="true"><defs>`
        + `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset=".75" class="s1"/><stop offset="1" class="s2"/></linearGradient>`
        + `<radialGradient id="${id}h"><stop offset="0" class="h0"/><stop offset="1" class="h1"/></radialGradient>`
        + `<radialGradient id="${id}e" cx=".5" cy=".45" r=".6"><stop offset="0" class="e0"/><stop offset=".6" class="e1"/><stop offset="1" class="e2"/></radialGradient></defs>`
        + `<path class="body" fill="url(#${id}s)" d="M50 16c-9.5 0-15.5 7.4-15.5 16.6 0 5 2 9.2 5.2 12.2C29 48 21 55 19 78h62c-2-23-10-30-20.7-33.2 3.2-3 5.2-7.2 5.2-12.2C65.5 23.4 59.5 16 50 16Z"/>`
        + `<path class="rim" d="M36 26c2-6 7-9.6 14-9.6M64.6 28c1 3 1 6-.4 9"/>`
        + `<g class="eyes">${глаз(43)}${глаз(57)}</g></svg>`
        + `<b>${escapeHtml(с.что)}</b>${с.слово ? `<small>${escapeHtml(с.слово)}</small>` : ''}</div>`;
    }).join('')}</div></div>`;
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
      + `<ol class="hud-v-radar-legend">${отметки.map(о => `<li class="s${о.с.сила}" title="${титул(о.с)}"><i class="n">${о.n}</i>${медаль(о.с.значок)}<span><b>${escapeHtml(о.с.что)}</b>${бирка(о.с)}</span><span class="hud-v-mini-bar" aria-hidden="true"><i style="width:${о.с.сила * 20}%"></i></span></li>`).join('')}</ol></div>`;
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
  } else if (вид === 'glass') {
    // Бокал наполняется вином: уровень — процент, у края — пузырьки.
    const уровень = 33 - v / 100 * 25;
    рисунок = `<svg class="hud-v-glass" viewBox="0 0 48 76" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="w0"/><stop offset="1" class="w1"/></linearGradient>`
      + `<clipPath id="${id}c"><path d="M9 6h30c1 15-3 26-15 28C12 32 8 21 9 6Z"/></clipPath></defs>`
      + `<g clip-path="url(#${id}c)"><rect class="wine" x="0" y="${уровень.toFixed(1)}" width="48" height="40" fill="url(#${id})"/><ellipse class="surface" cx="24" cy="${уровень.toFixed(1)}" rx="16" ry="1.6"/>`
      + (v >= 30 ? [[18, 3], [27, 1.6], [22, .8]].map(([x, d], i) => `<circle class="bubble" style="--d:${d}s" cx="${x}" cy="${(уровень + 12 + i * 4).toFixed(1)}" r="${1 - i * .2}"/>`).join('') : '') + `</g>`
      + `<path class="bowl" d="M9 6h30c1 15-3 26-15 28C12 32 8 21 9 6Z"/><path class="shine" d="M13 9c-.5 9 1 15 4 19"/><path class="stem" d="M24 34v28M14 70c2-5 18-5 20 0Z"/></svg>`;
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
    // Фарфоровая маска с объёмом: блик слева, тень справа, румянец, глубокие
    // прорези глаз, золотая кайма и ленты. Трещины идут от края внутрь и
    // ветвятся (щель + светлая кромка), на пике откалывается кусок.
    const ЛИЦО = 'M10 12C16 6 44 6 50 12 53 26 48 44 30 56 12 44 7 26 10 12Z';
    const трещины = ['M34 7.8L32.6 11.2L34.2 13.6L32.4 17.2M34.2 13.6L36.6 15', 'M49.6 28L46.2 29.4L44.8 33L41.6 34.2M44.8 33L45.6 36.4', 'M9.8 30L13.2 31.2L14.4 34.6L17.6 35.4M13.2 31.2L13.8 28.6', 'M26.6 53.4L27.8 50L26.2 47.6M27.8 50L30.2 49.2'];
    const глаз = (зерк) => `<path class="hole" fill="url(#${id}h)" d="${зерк ? 'M32.5 25C35 21.5 41 21.5 44 25 41 27.8 35 27.8 32.5 25Z' : 'M16 25C19 21.5 25 21.5 27.5 25 25 27.8 19 27.8 16 25Z'}"/>`;
    рисунок = `<svg class="hud-v-mask" viewBox="0 0 60 64" aria-hidden="true"><defs>`
      + `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="m0"/><stop offset=".55" class="m1"/><stop offset="1" class="m2"/></linearGradient>`
      + `<radialGradient id="${id}g" cx=".32" cy=".26" r=".55"><stop offset="0" class="g0"/><stop offset="1" class="g1"/></radialGradient>`
      + `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset=".5" class="s0"/><stop offset="1" class="s1"/></linearGradient>`
      + `<linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="h0"/><stop offset="1" class="h1"/></linearGradient>`
      + `<radialGradient id="${id}b"><stop offset="0" class="b0"/><stop offset="1" class="b1"/></radialGradient></defs>`
      + `<path class="ribbon" d="M10.4 16C6 18.5 5 26 2.6 34M10.2 17.5C7.6 22 7.8 30 6.6 38"/><path class="ribbon" d="M49.6 16C54 18.5 55 26 57.4 34M49.8 17.5C52.4 22 52.2 30 53.4 38"/><circle class="knot" cx="10.2" cy="16.6" r="1.6"/><circle class="knot" cx="49.8" cy="16.6" r="1.6"/>`
      + `<path class="shadow" d="${ЛИЦО}" transform="translate(1.6 2.2)"/><path class="face" fill="url(#${id})" d="${ЛИЦО}"/>`
      + `<ellipse class="blush" cx="19" cy="34" rx="6" ry="3.4" fill="url(#${id}b)"/><ellipse class="blush" cx="41" cy="34" rx="6" ry="3.4" fill="url(#${id}b)"/>`
      + `<path class="side" fill="url(#${id}s)" d="${ЛИЦО}"/><path class="gloss" fill="url(#${id}g)" d="${ЛИЦО}"/>`
      + `<path class="brow" d="M15 20.5C19 17.8 24 17.8 27 19.5M33 19.5C36 17.8 41 17.8 45 20.5"/>${глаз(false)}${глаз(true)}`
      + `<path class="hole-lip" d="M16.6 25.6C19.4 27.6 24.6 27.6 27 25.6M33 25.6C35.4 27.6 40.6 27.6 43.4 25.6"/>`
      + `<path class="nose" d="M30 26.5C29.3 31 28.5 34 27.5 36.4 28.9 37.3 31.1 37.3 32.5 36.4"/>`
      + `<path class="lips" d="M24.5 43C27 41.6 29 42.2 30 42.8 31 42.2 33 41.6 35.5 43 33 45.8 27 45.8 24.5 43Z"/><path class="lips-line" d="M24.8 43.1C27.5 43.8 32.5 43.8 35.2 43.1"/>`
      + `<path class="trim" d="${ЛИЦО}"/><path class="trim-in" d="M12.6 13.4C18 8.6 42 8.6 47.4 13.4"/>`
      + трещины.filter((_, i) => v > 15 + i * 20).map(d => `<path class="crack-lip" d="${d}" transform="translate(.5 .4)"/><path class="crack" d="${d}"/>`).join('')
      + (v >= 90 ? '<path class="chip" d="M49.6 28L46.2 29.4L44.8 33L47.6 35.2L49 31.6Z"/><path class="shard" d="M50.5 41l2.6.8-.9 2.6-2.3-.9Z"/>' : '') + `</svg>`;
  } else if (вид === 'eye') {
    // Живой глаз: белок с тенью от века, радужка с волокнами и тёмным
    // ободком, два блика. Чем ближе правда, тем шире раскрыты веки.
    const о = огр(v / 100, 0.12, 1), верх = 24 - 17 * о, низ = 24 + 11 * о;
    const щель = `M6 24Q40 ${(верх * 2 - 24).toFixed(1)} 74 24Q40 ${(низ * 2 - 24).toFixed(1)} 6 24Z`;
    const волокна = Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2, r1 = 4.2 + (i % 3) * .4, r2 = 10.4 - (i % 2) * 1.2; return `M${(40 + r1 * Math.cos(a)).toFixed(2)} ${(24 + r1 * Math.sin(a)).toFixed(2)}L${(40 + r2 * Math.cos(a)).toFixed(2)} ${(24 + r2 * Math.sin(a)).toFixed(2)}`; }).join('');
    const ресницы = Array.from({ length: 9 }, (_, i) => { const t = .12 + i * .095, x = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 40 + t * t * 74, y = (1 - t) * (1 - t) * 24 + 2 * (1 - t) * t * (верх * 2 - 24) + t * t * 24, dx = (t - .5) * 7; return `M${x.toFixed(1)} ${y.toFixed(1)}q${(dx * .4).toFixed(1)} -4 ${dx.toFixed(1)} -${(5 + (1 - Math.abs(t - .5) * 2) * 2).toFixed(1)}`; }).join('');
    рисунок = `<svg class="hud-v-eye" viewBox="0 0 80 48" aria-hidden="true"><defs>`
      + `<clipPath id="${id}c"><path d="${щель}"/></clipPath>`
      + `<radialGradient id="${id}w" cx=".5" cy=".55" r=".6"><stop offset="0" class="w0"/><stop offset=".75" class="w1"/><stop offset="1" class="w2"/></radialGradient>`
      + `<radialGradient id="${id}"><stop offset="0" class="i0"/><stop offset=".55" class="i1"/><stop offset=".92" class="i2"/><stop offset="1" class="i3"/></radialGradient>`
      + `<linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="l0"/><stop offset="1" class="l1"/></linearGradient>`
      + `<radialGradient id="${id}k" cx=".5" cy=".4" r=".7"><stop offset="0" class="k0"/><stop offset="1" class="k1"/></radialGradient></defs>`
      + `<ellipse class="socket" cx="40" cy="24" rx="38" ry="${(12 + 10 * о).toFixed(1)}" fill="url(#${id}k)"/>`
      + `<g class="lidset"><g clip-path="url(#${id}c)"><rect x="0" y="0" width="80" height="48" fill="url(#${id}w)"/>`
      + (v >= 60 ? '<path class="vein" d="M9 24q6-2 10 1M71 24q-6-3-10 0M12 28q5 0 8-2M68 20q-5 0-8 2"/>' : '')
      + `<g class="look"><circle class="iris" cx="40" cy="24" r="10.6" fill="url(#${id})"/><path class="fibers" d="${волокна}"/><circle class="limbal" cx="40" cy="24" r="10.4"/>`
      + `<circle class="pupil" cx="40" cy="24" r="${(3 + v / 100 * 2.6).toFixed(1)}"/><ellipse class="glint" cx="44" cy="19.6" rx="2.6" ry="2"/><circle class="glint2" cx="36.4" cy="28" r="1"/></g>`
      + `<rect class="lidshade" x="0" y="${(верх - 3).toFixed(1)}" width="80" height="9" fill="url(#${id}l)"/></g>`
      + `<path class="lashline" d="M6 24Q40 ${(верх * 2 - 24).toFixed(1)} 74 24"/><path class="lowline" d="M8 24.6Q40 ${(низ * 2 - 23).toFixed(1)} 72 24.6"/>`
      + `<path class="crease" d="M10 21Q40 ${(2 * (верх - 5.5) - 21).toFixed(1)} 70 21"/><path class="lashes" d="${ресницы}"/></g></svg>`;
  } else if (вид === 'hourglass') {
    // Песочные часы: наверху — то, что ещё скрыто, внизу — что уже вышло
    // наружу. Струйка бежит, пока тайна не раскрыта целиком.
    const верх = 6 + v / 100 * 26, низ = 64 - v / 100 * 24;
    рисунок = `<svg class="hud-v-hourglass" viewBox="0 0 48 72" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient>`
      + `<clipPath id="${id}t"><path d="M12 6h24c0 12-9 15-10.6 30h-2.8C21 21 12 18 12 6Z"/></clipPath><clipPath id="${id}b"><path d="M22.6 36h2.8C27 51 36 54 36 66H12c0-12 9-15 10.6-30Z"/></clipPath></defs>`
      + `<path class="glass" d="M12 6h24c0 12-9 15-10.6 30C27 51 36 54 36 66H12c0-12 9-15 10.6-30C21 21 12 18 12 6Z"/>`
      + `<rect class="sand" x="0" y="${верх.toFixed(1)}" width="48" height="40" fill="url(#${id})" clip-path="url(#${id}t)"/>`
      + `<path class="sand" fill="url(#${id})" clip-path="url(#${id}b)" d="M8 66 L8 ${(низ + 6).toFixed(1)} Q24 ${(низ - 6).toFixed(1)} 40 ${(низ + 6).toFixed(1)} L40 66Z"/>`
      + (v > 0 && v < 100 ? `<path class="stream" d="M24 34V${(низ + 1).toFixed(1)}"/>` : '')
      + `<path class="shine" d="M15 9c1 8 5 12 7.5 17"/><rect class="cap" x="7" y="2" width="34" height="5" rx="2"/><rect class="cap" x="7" y="65" width="34" height="5" rx="2"/>`
      + `<path class="post" d="M9 7v58M39 7v58"/></svg>`;
  } else return '';
  return `<div class="hud-v hud-v-expo is-${вид}${v >= 60 ? ' is-hot' : ''}" title="Разоблачение: ${v} из 100"><div class="hud-v-art">${рисунок}</div>`
    + `<div class="hud-v-side">${голова}<span class="hud-v-mini-bar" aria-hidden="true"><i style="width:${v}%"></i></span>${подпись(текст)}</div></div>`;
}

/* --- Привязанность спутника ------------------------------------------------- */

export function видПривязанности(связь, вид) {
  if (связь === null || !Number.isFinite(связь)) return '';
  const v = огр(связь, 0, 100);
  if (вид === 'hearts') return `<div class="hud-pet-bond hud-v-bond is-hearts" title="Привязанность ${Math.round(v)} из 100"><span>привязанность</span>${сердца(v)}<em class="hud-v-num is-small">${Math.round(v)}</em></div>`;
  if (вид === 'tag') {
    // Жетон на кольце: металл по привязанности — бронза, серебро, золото;
    // на жетоне выбита лапа и число, рядом — слово.
    const id = новыйId('tg'), металл = v >= 75 ? 'gold' : v >= 40 ? 'silver' : 'bronze';
    const слово = v >= 90 ? 'душа в душу' : v >= 70 ? 'предан' : v >= 45 ? 'доверяет' : v >= 20 ? 'привыкает' : 'сторонится';
    const лапа = '<ellipse cx="12" cy="16.5" rx="5" ry="4.2"/><ellipse cx="5.6" cy="10.6" rx="2" ry="2.6"/><ellipse cx="9.4" cy="6.6" rx="2" ry="2.7"/><ellipse cx="14.6" cy="6.6" rx="2" ry="2.7"/><ellipse cx="18.4" cy="10.6" rx="2" ry="2.6"/>';
    return `<div class="hud-pet-bond hud-v-bond is-tag is-${металл}" title="Привязанность ${Math.round(v)} из 100 — ${слово}"><span>привязанность</span>`
      + `<svg class="hud-v-tagsvg" viewBox="0 0 40 50" aria-hidden="true"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" class="t0"/><stop offset=".6" class="t1"/><stop offset="1" class="t2"/></radialGradient></defs>`
      + `<g class="swing"><circle class="loop" cx="20" cy="6" r="4.2"/><circle class="disc" cx="20" cy="28" r="17" fill="url(#${id})"/><circle class="edge" cx="20" cy="28" r="14"/>`
      + `<g class="paw" transform="translate(13 15) scale(.58)">${лапа}</g><text x="20" y="40">${Math.round(v)}</text></g></svg><b class="hud-v-tag-word">${слово}</b></div>`;
  }
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
  ['Голова и шея', 'head', ['head', 'lips', 'ears', 'neck', 'nape']],
  ['Корпус', 'torso', ['shoulders', 'chest', 'back', 'belly', 'waist', 'lowback']],
  ['Бёдра и таз', 'hips', ['groin', 'buttocks', 'thighs']],
  ['Руки и ноги', 'leg', ['arms', 'hands', 'knees', 'backknee', 'calves', 'feet']],
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
      return тут.length ? `<div class="hud-v-bm-area" style="--h:${жар(пик)}"><div class="hud-v-bm-area-head">${ико(значок)}${имя}</div>${тут.map(плитка).join('')}</div>` : '';
    }).join('');
    const прочее = числовые.filter(з => !свои.has(з));
    return `<div class="hud-v hud-v-bm is-zones">${блоки}${прочее.length ? `<div class="hud-v-bm-area"><div class="hud-v-bm-area-head">${ико('star')}Другое</div>${прочее.map(плитка).join('')}</div>` : ''}</div>`;
  }
  if (вид === 'words') {
    // Облако слов: чем горячее зона, тем крупнее, ярче и плотнее слово.
    // Самые горячие — в середине, остальные расходятся к краям.
    const по = числовые.slice().sort((a, b) => b.v - a.v);
    const ряд = [];
    по.forEach((з, i) => (i % 2 ? ряд.push(з) : ряд.unshift(з)));
    return `<div class="hud-v hud-v-bm is-words"><div class="hud-v-cloud">${ряд.map(з => `<span class="hud-v-word" style="--h:${жар(з.v)};--r:${((hudHashSeed(з.имя) % 7) - 3)}deg" title="${титул(з)}">${escapeHtml(з.имя)}<sup>${з.v}</sup>${з.трендТекст ? `<small>${escapeHtml(з.трендТекст)}</small>` : ''}</span>`).join('')}</div></div>`;
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
  if (вид === 'tickets') {
    // Билеты: каждый переход — корешок со временем и билет «откуда → куда»,
    // по линии отрыва — перфорация. Последний — «сейчас здесь».
    const переходы = точки.length > 1 ? точки.slice(1).map((p, i) => [точки[i], p]) : [[null, точки[0]]];
    return `<div class="hud-v hud-v-route is-tickets">${голова}<div class="hud-v-tickets">${переходы.map(([от, к], i) => `<div class="hud-v-ticket${i === переходы.length - 1 ? ' is-now' : ''}" style="--r:${((hudHashSeed((к.place || '') + i) % 5) - 2) * .5}deg">`
      + `<div class="stub"><small>${от ? escapeHtml(время(от)) : 'старт'}</small>${ико('target')}<b>${escapeHtml(время(к)) || '—'}</b></div>`
      + `<div class="main"><span class="no">${ико('star')} № ${String(i + 1).padStart(2, '0')}</span><div class="way">${от ? `<span>${escapeHtml(от.place || '—')}</span><i class="arrow" aria-hidden="true"></i>` : ''}<b>${escapeHtml(к.place || 'Без названия')}</b></div>`
      + `${к.action ? `<small>${escapeHtml(к.action)}</small>` : ''}${i === переходы.length - 1 ? '<em class="punch">сейчас здесь</em>' : ''}</div></div>`).join('')}</div></div>`;
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
  { к: 'т', имя: 'Темп.', ед: '°C', lo: 35, hi: 41, норма: 37.2, значок: '°' },
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
  if (вид === 'anatomy') {
    // Анатомия: лёгкие дышат в такт дыханию, сердце бьётся в такт пульсу,
    // цвет — от температуры. Цифры — рядом.
    const жар = Number.isFinite(в.т) ? огр((в.т - 36.4) / 2.2, 0, 1) : .3;
    const вдох = Number.isFinite(в.дыхание) ? (60 / огр(в.дыхание, 6, 60)).toFixed(2) : '4';
    return `<div class="hud-v hud-v-vit is-anatomy" style="--beat:${такт}s;--breath:${вдох}s;--heat:${жар.toFixed(2)}"><svg class="hud-v-anatomy" viewBox="0 0 120 104" aria-hidden="true"><defs>`
      + `<radialGradient id="${id}l" cx=".5" cy=".4" r=".7"><stop offset="0" class="l0"/><stop offset="1" class="l1"/></radialGradient><radialGradient id="${id}h" cx=".4" cy=".35" r=".7"><stop offset="0" class="h0"/><stop offset="1" class="h1"/></radialGradient></defs>`
      + `<path class="trachea" d="M60 4v18M60 22l-11 8M60 22l11 8"/>`
      + `<g class="lung is-l"><path fill="url(#${id}l)" d="M50 24c-12 2-26 16-28 42-1 12 3 20 11 20 10 0 17-6 19-14l1-40c0-5-1-8-3-8Z"/><path class="vein" d="M49 34c-5 4-9 10-12 18M48 46c-4 5-6 11-7 18"/></g>`
      + `<g class="lung is-r"><path fill="url(#${id}l)" d="M70 24c12 2 26 16 28 42 1 12-3 20-11 20-10 0-17-6-19-14l-1-40c0-5 1-8 3-8Z"/><path class="vein" d="M71 34c5 4 9 10 12 18M72 46c4 5 6 11 7 18"/></g>`
      + `<g class="heart"><path fill="url(#${id}h)" transform="translate(47 52) scale(1.1)" d="${СЕРДЦЕ}"/></g></svg>${цифры('is-legend')}</div>`;
  }
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

// Группы вещей: порядок важен — первая подходящая побеждает, поэтому
// узкие (интимное, оружие, деньги) раньше широких (документы, одежда).
// \b в JS не видит кириллицу, поэтому конец слова — (?![а-яё]).
const ВЕЩИ = [
  ['Интимное', 'heart', /презерватив|кондом|смазк|лубрикант|вибратор|секс-игрушк|condom|lube/i],
  ['Оружие', 'dagger', /пистолет|револьвер|ружь|меч(?![а-яё])|кинжал|клинок|нож(?!ниц)|бит[аы](?![а-яё])|кастет|патрон|обойм|электрошок|перцов|оружи|gun|knife|sword/i],
  ['Связь и техника', 'phone', /телефон|смартфон|ноутбук|планшет|рация|наушник|часы|камер|заряд|пауэрбанк|флешк|плеер|гаджет|phone|laptop/i],
  ['Деньги и ценности', 'coins', /деньг|кошел|бумажник|банковск|кредитк|карт[аы]? банк|монет|золот|купюр|наличн|чек(?![а-яё])|money|wallet|cash/i],
  ['Документы и письма', 'letter', /письм|записк|документ|паспорт|договор|удостовер|пропуск|справк|карт[аоу]|фото|снимок|билет|конверт|letter|note|ticket/i],
  ['Книги и записи', 'book', /книг|блокнот|дневник|тетрад|журнал|ручк|карандаш|book/i],
  ['Украшения', 'gem', /кольц|серьг|серёж|цепоч|кулон|браслет|ожерел|брош|украш|запонк|ring|necklace/i],
  ['Ключи и доступ', 'key', /ключ|брелок|отмычк|key/i],
  ['Лекарства', 'pill', /таблет|лекарств|бинт|аптечк|шприц|пластыр|антисептик|ингалятор|обезбол|витамин|pill|meds/i],
  ['Еда и напитки', 'cup', /вод[аыу](?![а-яё])|еда|бутер|сэндвич|шоколад|конфет|печень|яблок|вин[оа](?![а-яё])|бутылк|фляг|кофе|чай|термос|жвачк|перекус|food|drink/i],
  ['Курение', 'smoke', /сигарет|сигар|зажигал|спичк|трубк|вейп|табак|smoke|lighter/i],
  ['Косметика и уход', 'lipstick', /помад|духи|парфюм|пудр|зеркальц|расчёск|расческ|крем(?![а-яё])|тушь|косметич|заколк|makeup/i],
  ['Одежда', 'shirt', /шарф|перчат|очки|куртк|пальто|шляп|платок|галстук|плащ|кофт|пиджак|бель|чулк|свитер|толстовк|зонт|coat|scarf/i],
  ['Сумки', 'bag', /сумк|рюкзак|пакет|портфел|чемодан|клатч|bag/i],
  ['Инструменты', 'tool', /инструмент|отвёртк|отвертк|фонар|верёвк|веревк|скотч|изолент|молот|плоскогуб|мультитул|tool|flashlight/i],
  ['Памятное', 'star', /амулет|талисман|оберег|медальон|игрушк|сувенир|памят|подарок|плюшев|открытк|засушен|реликви|keepsake/i],
];
function вещь(п) {
  const г = ВЕЩИ.find(([, , rx]) => rx.test(п.имя)) || ВЕЩИ.find(([, , rx]) => rx.test(п.текст));
  const кол = (п.текст.match(/[×x]\s*(\d+)|(\d+)\s*шт/i) || [])[1];
  return { ...п, группа: г ? г[0] : 'Прочее', значок: г ? г[1] : 'box', кол };
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
    return `<div class="hud-v hud-v-inv is-grid">${вещи.map((в, i) => `<span class="hud-v-slot ${редкость(в, i)}" title="${титул(в)}"><i aria-hidden="true">${ико(в.значок)}</i><b>${escapeHtml(в.имя)}</b>${в.кол ? `<em>×${escapeHtml(в.кол)}</em>` : ''}</span>`).join('')}${'<span class="hud-v-slot is-empty" aria-hidden="true"></span>'.repeat(пустых)}</div>`;
  }
  if (вид === 'cards') {
    return `<div class="hud-v hud-v-inv is-cards">${вещи.map((в, i) => `<span class="hud-v-card hud-v-item ${редкость(в, i)}"><i class="badge" aria-hidden="true">${ико(в.значок)}</i><span><b>${escapeHtml(в.имя)}</b>${в.текст ? `<small>${applyTooltips(в.текст)}</small>` : ''}<span class="hud-v-tag">${escapeHtml(в.группа)}</span></span></span>`).join('')}</div>`;
  }
  if (вид === 'groups') {
    const порядок = [...ВЕЩИ.map(([г]) => г), 'Прочее'];
    const значки = Object.fromEntries([...ВЕЩИ.map(([г, з]) => [г, з]), ['Прочее', 'box']]);
    const группы = порядок.map(г => [г, вещи.filter(в => в.группа === г)]).filter(([, с]) => с.length);
    return `<div class="hud-v hud-v-inv is-groups">${группы.map(([г, с]) => `<div class="hud-v-card hud-v-group"><div class="hud-v-group-head">${ико(значки[г])}${escapeHtml(г)}<em>${с.length}</em></div>${с.map(в => `<span class="hud-v-row-item" title="${титул(в)}"><b>${escapeHtml(в.имя)}</b>${в.текст ? `<small>${escapeHtml(в.текст)}</small>` : ''}</span>`).join('')}</div>`).join('')}</div>`;
  }
  if (вид === 'weight') {
    // Важность: слова о ценности и порядок в списке — первое модель пишет
    // самым заметным. Три размера, чтобы разница читалась.
    const по = вещи.map((в, i) => ({ в, w: вес(в, i) })).sort((a, b) => b.w - a.w);
    return `<div class="hud-v hud-v-inv is-weight">${по.map(({ в, w }) => `<span class="hud-v-chip ${w >= 2 ? 'w3' : w >= 1 ? 'w2' : 'w1'}" title="${титул(в)}"><i aria-hidden="true">${ико(в.значок)}</i>${escapeHtml(в.имя)}</span>`).join('')}</div>`;
  }
  if (вид === 'receipt') {
    // Опись: чековая лента — номер, вещь, точки до количества, код группы,
    // внизу итог и штрихкод. Ценное помечено звёздочкой.
    const код = (г) => г.replace(/[^А-ЯЁа-яё]/g, '').slice(0, 3).toUpperCase();
    const штрих = Array.from({ length: 36 }, (_, i) => `<i style="flex:${hudHashSeed(value + i) % 3 + 1}"></i>`).join('');
    return `<div class="hud-v hud-v-inv is-receipt"><div class="hud-v-receipt"><div class="hud-v-rc-head"><b>Опись имущества</b><small>№ ${hudHashSeed(value) % 9000 + 1000} · позиций: ${вещи.length}</small></div>`
      + `<ol>${вещи.map((в, i) => `<li class="${редкость(в, i)}" title="${титул(в)}"><span class="n">${String(i + 1).padStart(2, '0')}</span>${ико(в.значок)}<b>${escapeHtml(в.имя)}${редкость(в, i) === 'r3' ? ' ★' : ''}</b><i class="lead"></i><em>×${escapeHtml(в.кол || '1')}</em>`
        + `${в.текст ? `<small>${escapeHtml(в.текст)}</small>` : ''}<span class="code">${код(в.группа)}</span></li>`).join('')}</ol>`
      + `<div class="hud-v-rc-foot"><span>Итого</span><i class="lead"></i><b>${вещи.length}</b></div><div class="hud-v-barcode" aria-hidden="true">${штрих}</div></div></div>`;
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
// Дверца сейфа — круг, сжатый к петле слева: так он «поворачивается».
function сейф(с) {
  const id = новыйId('vl'), C = 34;
  const болты = Array.from({ length: с.уровень * 4 }, (_, i) => { const a = i * 2 * Math.PI / (с.уровень * 4) + Math.PI / 4; return `<circle class="bolt" cx="${(C + 20.5 * Math.cos(a)).toFixed(1)}" cy="${(C + 20.5 * Math.sin(a)).toFixed(1)}" r="1.5"/>`; }).join('');
  const риски = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${(C + 7.4 * Math.cos(a)).toFixed(1)}" y1="${(C + 7.4 * Math.sin(a)).toFixed(1)}" x2="${(C + 9 * Math.cos(a)).toFixed(1)}" y2="${(C + 9 * Math.sin(a)).toFixed(1)}"/>`; }).join('');
  const раскрыт = [1, 1, .66, .34][с.огласка];
  return `<svg class="hud-v-safe" viewBox="0 0 68 68" aria-hidden="true"><defs>`
    + `<radialGradient id="${id}d" cx=".38" cy=".32" r=".8"><stop offset="0" class="d0"/><stop offset=".6" class="d1"/><stop offset="1" class="d2"/></radialGradient>`
    + `<radialGradient id="${id}l" cx=".35" cy=".5" r=".7"><stop offset="0" class="l0"/><stop offset="1" class="l1"/></radialGradient>`
    + `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="f0"/><stop offset="1" class="f1"/></linearGradient></defs>`
    + `<rect class="frame" x="2" y="2" width="64" height="64" rx="10" fill="url(#${id}f)"/><circle class="well" cx="${C}" cy="${C}" r="26"/>`
    + (с.огласка >= 2 ? `<circle class="light" cx="${C}" cy="${C}" r="25" fill="url(#${id}l)"/>` : '')
    + `<g class="door" transform="translate(9 0) scale(${раскрыт} 1) translate(-9 0)"><circle class="plate" cx="${C}" cy="${C}" r="24" fill="url(#${id}d)"/><circle class="lip" cx="${C}" cy="${C}" r="18"/>${болты}`
    + `<g class="dial"><circle class="knob" cx="${C}" cy="${C}" r="9.5"/><g class="ticks">${риски}</g><path class="spokes" d="M${C} ${C - 15}V${C + 15}M${C - 13} ${C - 7.5}L${C + 13} ${C + 7.5}M${C - 13} ${C + 7.5}L${C + 13} ${C - 7.5}"/><circle class="hub" cx="${C}" cy="${C}" r="3"/></g></g>`
    + `<rect class="hinge" x="5" y="18" width="5" height="8" rx="1.5"/><rect class="hinge" x="5" y="42" width="5" height="8" rx="1.5"/></svg>`;
}
const люди = (имена, знают) => имена.map(n => `<span class="hud-v-person${знают ? ' is-k' : ''}" title="${escapeHtml(n)}: ${знают ? 'знает' : 'не знает'}">${лицо(n)}${escapeHtml(первое(n))}</span>`).join('');

// Сургучная печать: неровный восковой край (капля с наплывами), внутри —
// ободок и выдавленный замок. Подозревают — тонкая трещина от края к
// центру (тёмная щель и светлая кромка), частично — печать расколота
// ломаной линией на две половинки, чуть разошедшиеся в стороны.
function печатьСургуча(огласка, id) {
  const cx = 52, cy = 35;
  const край = Array.from({ length: 36 }, (_, i) => {
    const a = i / 36 * Math.PI * 2, r = 10.2 + .75 * Math.sin(a * 7 + .6) + .35 * Math.sin(a * 13);
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join('') + 'Z';
  const лицо = `<path class="wax" d="${край}"/><circle class="rim" cx="${cx}" cy="${cy}" r="6.8"/><path class="emboss" transform="translate(${cx - 5.4} ${cy - 5.6}) scale(.45)" d="M6 11h12v9H6Z M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>`;
  if (!огласка) return `<g class="seal">${лицо}</g>`;
  if (огласка === 1) {
    const щель = `M${cx + 5.5} ${cy - 7.5}L${cx + 4.4} ${cy - 5.6}L${cx + 5.1} ${cy - 3.9}L${cx + 2.6} ${cy - 1.2}L${cx + 3.1} ${cy + .9}M${cx + 4.4} ${cy - 5.6}L${cx + 2.1} ${cy - 6.3}`;
    return `<g class="seal">${лицо}<path class="crack-lip" d="${щель}" transform="translate(.45 .35)"/><path class="crack" d="${щель}"/></g>`;
  }
  // Ломаная через всю печать; левая половина — слева от неё, правая — справа.
  const излом = [[cx + .6, cy - 12], [cx - .8, cy - 6.5], [cx + 1.2, cy - 2.4], [cx - .9, cy + 1.6], [cx + .8, cy + 5.8], [cx - .4, cy + 12]];
  const линия = излом.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
  const лево = `M${cx - 14} ${cy - 12}L${линия}L${cx - 14} ${cy + 12}Z`, право = `M${cx + 14} ${cy - 12}L${линия}L${cx + 14} ${cy + 12}Z`;
  return `<defs><clipPath id="${id}l"><path d="${лево}"/></clipPath><clipPath id="${id}r"><path d="${право}"/></clipPath></defs>`
    + `<g class="seal is-broken"><g transform="translate(-2.2 .6) rotate(-7 ${cx} ${cy})"><g clip-path="url(#${id}l)">${лицо}</g></g>`
    + `<g transform="translate(2.2 1.2) rotate(8 ${cx} ${cy})"><g clip-path="url(#${id}r)">${лицо}</g></g></g>`;
}
export function видСекретов(secrets, вид) {
  const все = (Array.isArray(secrets) ? secrets : []).map(разобратьСекрет).filter(с => с.факт);
  if (!все.length) return '';
  const кто = (с) => `<div class="hud-v-people">${люди(с.знают, true)}${люди(с.неЗнают, false)}</div>`;
  if (вид === 'vault') {
    // Сейф: болтов по ободу — по грифу (4, 8, 12), дверца приоткрыта тем
    // шире, чем больше огласка, из щели светит. Лампа — огласка словом.
    return `<div class="hud-v hud-v-vaults">${все.map(с => `<div class="hud-v-vault l${с.уровень} o${с.огласка}">${сейф(с)}`
      + `<div class="hud-v-vault-body"><span class="hud-v-vault-top"><span class="hud-v-vault-grade">${'◆'.repeat(с.уровень)} ${ГРИФ[с.уровень].toLowerCase()}</span><span class="hud-v-lamp o${с.огласка}"><i aria-hidden="true"></i>${ОГЛАСКА[с.огласка]}</span></span>`
      + `<b>${тайна(с.факт)}</b>${кто(с)}</div></div>`).join('')}</div>`;
  }
  if (вид === 'envelopes') {
    // Конверты под сургучом: печать цела — не раскрыт, трещина —
    // подозревают, расколота — частично, конверт вскрыт и письмо торчит —
    // известен. Гриф — лентой через конверт и числом полос.
    return `<div class="hud-v hud-v-envs">${все.map(с => {
      const id = новыйId('en');
      const печать = с.огласка === 3 ? '' : печатьСургуча(с.огласка, id);
      return `<div class="hud-v-env l${с.уровень} o${с.огласка}"><svg class="hud-v-envelope" viewBox="0 -10 104 74" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="p0"/><stop offset="1" class="p1"/></linearGradient></defs>`
        + (с.огласка === 3 ? `<path class="letter" d="M14 22V4h76v18"/><path class="letter-lines" d="M22 10h52M22 15h40"/>` : '')
        + `<rect class="body" x="4" y="14" width="96" height="48" rx="4" fill="url(#${id})"/><path class="fold" d="M4 62 44 34M100 62 60 34"/>`
        + (с.огласка === 3 ? `<path class="flap is-open" d="M4 14 52 -8 100 14"/>` : `<path class="flap" d="M4 14 52 40 100 14Z"/>`)
        + Array.from({ length: с.уровень }, (_, k) => `<rect class="band" x="${14 + k * 5}" y="14" width="2.4" height="48"/>`).join('')
        + (с.огласка === 3 ? '' : печать) + `</svg>`
        + `<div class="hud-v-env-body"><span class="hud-v-env-grade">${ГРИФ[с.уровень].toLowerCase()} · ${ОГЛАСКА[с.огласка]}</span><b>${тайна(с.факт)}</b>${кто(с)}</div></div>`;
    }).join('')}</div>`;
  }
  if (вид === 'files') {
    return `<div class="hud-v hud-v-files">${все.map((с, i) => `<div class="hud-v-file l${с.уровень}" style="--r:${((hudHashSeed(с.факт) % 5) - 2) * 0.5}deg"><span class="hud-v-file-tab">ДЕЛО №${String(i + 1).padStart(3, '0')}</span><i class="clip" aria-hidden="true"></i><span class="hud-v-stamp">${ГРИФ[с.уровень]}</span>`
      + `<b>${тайна(с.факт)}</b><span class="hud-v-file-status">статус: ${ОГЛАСКА[с.огласка]}</span><div class="hud-v-file-lines"><small>знают: ${с.знают.length ? escapeHtml(с.знают.join(', ')) : 'никто'}</small>${с.неЗнают.length ? `<small>не знают: ${escapeHtml(с.неЗнают.join(', '))}</small>` : ''}</div></div>`).join('')}</div>`;
  }
  if (вид === 'web') {
    return `<div class="hud-v hud-v-webs">${все.map(с => {
      const все2 = [...с.знают.map(n => [n, true]), ...с.неЗнают.map(n => [n, false])].slice(0, 8);
      const C = [70, 46], Rx = 52, Ry = 32, id = новыйId('wb');
      const узлы = все2.map(([n, знает], i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, все2.length); return { n, знает, x: C[0] + Rx * Math.cos(a), y: C[1] + Ry * Math.sin(a) }; });
      return `<div class="hud-v-card hud-v-web l${с.уровень}"><svg viewBox="0 0 140 92" role="img" aria-label="Кто знает секрет">`
        + узлы.map(у => `<path class="${у.знает ? 'k' : 'u'}" d="M${C[0]} ${C[1]}Q${((C[0] + у.x) / 2 + (у.y - C[1]) * .15).toFixed(1)} ${((C[1] + у.y) / 2 - (у.x - C[0]) * .15).toFixed(1)} ${у.x.toFixed(1)} ${у.y.toFixed(1)}"/>`).join('')
        + `<circle class="core-glow" cx="${C[0]}" cy="${C[1]}" r="14"/><circle class="core" cx="${C[0]}" cy="${C[1]}" r="9"/><path class="core-t" transform="translate(${C[0] - 5.4} ${C[1] - 5.6}) scale(.45)" d="M6 11h12v9H6Z M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>`
        + узлы.map((у, k) => { const url = аватарка(у.n), cid = `${id}n${k}`; return `<g class="node ${у.знает ? 'k' : 'u'}${url ? ' has-img' : ''}" style="${тон(у.n)}"><circle cx="${у.x.toFixed(1)}" cy="${у.y.toFixed(1)}" r="8"/><text x="${у.x.toFixed(1)}" y="${(у.y + 2.6).toFixed(1)}">${escapeHtml(инициалы(у.n))}</text>`
          + (url ? `<clipPath id="${cid}"><circle cx="${у.x.toFixed(1)}" cy="${у.y.toFixed(1)}" r="7.4"/></clipPath><image href="${escapeHtml(url)}" x="${(у.x - 8).toFixed(1)}" y="${(у.y - 8).toFixed(1)}" width="16" height="16" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/><circle class="ring" cx="${у.x.toFixed(1)}" cy="${у.y.toFixed(1)}" r="7.6"/>` : '')
          + `<title>${escapeHtml(у.n)}: ${у.знает ? 'знает' : 'не знает'}</title></g>`; }).join('')
        + `</svg><span class="hud-v-tag">${ГРИФ[с.уровень].toLowerCase()} · ${ОГЛАСКА[с.огласка]}</span><b>${тайна(с.факт)}</b>${кто(с)}</div>`;
    }).join('')}</div>`;
  }
  if (вид === 'bars') {
    return `<div class="hud-v hud-v-secbars">${все.map(с => {
      const всего = с.знают.length + с.неЗнают.length;
      const доля = всего ? Math.round(с.знают.length / всего * 100) : [0, 25, 60, 100][с.огласка];
      const сегменты = (n, из, класс) => `<span class="hud-v-segments ${класс}" aria-hidden="true">${Array.from({ length: из }, (_, i) => `<i${i < n ? ' class="is-on"' : ''}></i>`).join('')}</span>`;
      return `<div class="hud-v-card hud-v-secbar l${с.уровень}"><b>${тайна(с.факт)}</b>`
        + `<div class="hud-v-meter"><small>${ико('lock')} гриф</small>${сегменты(с.уровень, 3, 'is-lvl')}<em>${ГРИФ[с.уровень].toLowerCase()}</em></div>`
        + `<div class="hud-v-meter"><small>${ико('megaphone')} огласка</small><span class="hud-v-mini-bar is-spread"><i style="width:${доля}%"></i></span><em>${ОГЛАСКА[с.огласка]}${всего ? ` · ${с.знают.length}/${всего}` : ''}</em></div></div>`;
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
    const колонки = [['open', 'Висит', 'target'], ['building', 'Назревает', 'hourglass'], ['fired', 'Выстрелило', 'burst']];
    return `<div class="hud-v hud-v-gun-cols">${колонки.map(([к, имя, значок]) => {
      const тут = все.filter(р => р.ключ === к);
      return `<div class="hud-v-gun-col is-${к}"><div class="hud-v-gun-col-head"><i aria-hidden="true">${ико(значок)}</i>${имя}<em>${тут.length}</em></div>${тут.map(р => `<div class="hud-v-gun-card"><p>${applyTooltips(р.завязка)}</p>${р.кто ? `<small>${escapeHtml(р.кто)}</small>` : ''}</div>`).join('') || '<span class="hud-v-empty">пусто</span>'}</div>`;
    }).join('')}</div>`;
  }
  if (вид === 'cylinder') {
    // Барабан револьвера: каждое ружьё — гнездо. Висит — патрон на месте,
    // назревает — капсюль тлеет, выстрелило — пустое гнездо с дымком.
    const n = Math.max(6, Math.min(9, все.length)), C = 50, R = 28, id = новыйId('cy');
    const гнёзда = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, x = C + R * Math.cos(a), y = C + R * Math.sin(a), р = все[i];
      const тело = !р ? '<circle class="hole is-empty" r="9"/>'
        : р.ключ === 'fired' ? '<circle class="hole" r="9"/><path class="smoke" d="M-2 -4c-3-4 3-6 0-10s3-6 0-9"/>'
          : `<circle class="hole" r="9"/><circle class="case" r="7.4" fill="url(#${id})"/><circle class="primer${р.ключ === 'building' ? ' is-hot' : ''}" r="2.8"/>`;
      return `<g class="ch is-${р ? р.ключ : 'none'}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${тело}${р ? `<text class="n" y="${y < C ? -12 : 17}">${i + 1}</text><title>${escapeHtml(р.завязка)} — ${escapeHtml(р.текст)}</title>` : ''}</g>`;
    }).join('');
    return `<div class="hud-v hud-v-cylinder"><svg class="hud-v-drum" viewBox="0 0 100 100" role="img" aria-label="Ружья Чехова барабаном"><defs><radialGradient id="${id}" cx=".4" cy=".35" r=".7"><stop offset="0" class="b0"/><stop offset="1" class="b1"/></radialGradient>`
      + `<radialGradient id="${id}m" cx=".35" cy=".3" r=".8"><stop offset="0" class="m0"/><stop offset="1" class="m1"/></radialGradient></defs>`
      + `<circle class="drum" cx="${C}" cy="${C}" r="46" fill="url(#${id}m)"/>${Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i + .5) * 2 * Math.PI / n; return `<path class="flute" d="M${(C + 40 * Math.cos(a)).toFixed(1)} ${(C + 40 * Math.sin(a)).toFixed(1)}L${(C + 46 * Math.cos(a)).toFixed(1)} ${(C + 46 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}`
      + `<g class="spin">${гнёзда}</g><circle class="axle" cx="${C}" cy="${C}" r="7"/><circle class="axle-in" cx="${C}" cy="${C}" r="2.5"/></svg>`
      + `<ol class="hud-v-drum-legend">${все.slice(0, n).map((р, i) => `<li class="is-${р.ключ}"><i class="n">${i + 1}</i><span><p>${applyTooltips(р.завязка)}</p>${р.кто ? `<small>${escapeHtml(р.кто)}</small>` : ''}</span><em>${escapeHtml(р.текст)}</em></li>`).join('')}</ol></div>`;
  }
  if (вид === 'progress') {
    // Фитиль: от «висит» до «выстрелило» он догорает, искра — там, где
    // сейчас нить; в конце — заряд.
    return `<div class="hud-v hud-v-fuses">${все.map(р => {
      const д = [14, 56, 100][ЭТАП[р.ключ] ?? 0];
      return `<div class="hud-v-card hud-v-fuse is-${р.ключ}" style="--p:${д}%"><p>${applyTooltips(р.завязка)}${р.кто ? ` <small>· ${escapeHtml(р.кто)}</small>` : ''}</p>`
        + `<div class="hud-v-fuse-line" aria-label="${escapeHtml(р.текст)}"><i class="rope"></i><i class="burnt"></i>${р.ключ === 'fired' ? `<i class="boom" aria-hidden="true">${ико('burst')}</i>` : `<i class="spark" aria-hidden="true"></i><i class="charge" aria-hidden="true">${ико('bomb')}</i>`}</div>`
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
// «Никогда не сделает» и «Не возбуждает»: сила — насколько твёрдо «нет».
// «Панический страх», «отвращение» — пять, «смешит», «скучно» — два.
function силаОтказа(т) {
  const s = String(т || '');
  if (/пани[кч]|ужас|отвращ|омерз|травм|категорич|ни за что|ни при как|никогда в жизни|жёстк|жестк|табу|hard/i.test(s)) return 5;
  if (/противн|неприятн|не выносит|бесит|злит|пугает|страх|запрет|против/i.test(s)) return 4;
  if (/смеш|скучн|равнодуш|всё равно|все равно|не впечатл|нейтральн|не трогает/i.test(s)) return 2;
  if (/чуть|слегка|скорее нет|пока нет|не сейчас/i.test(s)) return 1;
  return 3;
}
const ГЛУБЬ = /мечт|тайн|стыд|не признаётся|не признается|скрыва|пока только|в фантаз|никому|боится признаться|втайне/i;
const ТИПЫ_ВЛЕЧЕНИЙ = [
  ['Связывание', 'rope', /связ|верёв|верев|наручник|фиксац|шибари|bondage|повязк|привяз/i],
  ['Власть и контроль', 'crown', /домин|подчин|контрол|приказ|власт|сверху|снизу|послуш|покорн|на колени|ошейник|поводок|dom|sub|bdsm/i],
  ['Ревность и «моё»', 'chain', /ревн|собствен|метк|засос|пометит|принадлеж|моя|мой|только е[её]/i],
  ['Боль и ощущения', 'bolt', /бол|шлеп|шлёп|порк|плеть|плётк|ремень|укус|кус|щекот|лёд|лед|воск|царап|сжат|жар|холод/i],
  ['На грани', 'flame', /удуш|дыхан|асфикс|кров|нож|опасн|страх|грань|на грани|choke/i],
  ['Голос и слова', 'speech', /шёпот|шепот|голос|похвал|унижен|грязн|пошл|слова|стон|ругат|дразн|по имени|dirty/i],
  ['Роли и игры', 'mask', /рол|игр|сценар|незнаком|учител|начальн|медсестр|врач|пленн/i],
  ['Одежда и образ', 'heel', /чулк|бель|каблук|латекс|кожан|корсет|костюм|форм[аеуы]|платье|рубашк|галстук|очк|помад|духи/i],
  ['Публичность и риск', 'eye', /публичн|на людях|застать|застукат|риск|подглядыв|вуайер|эксгибиц|камер|зеркал|снимат|втро[её]м|делит/i],
  ['Нежность и эмоции', 'hearts', /предан|нежн|уязвим|эмоц|забот|ласк|объят|поцел|медленн|aftercare|глаза в глаза/i],
  ['Тело и детали', 'rose', /ше[яиюе]|рук|ног|пальц|запах|волос|губ|бёдр|бедр|груд|кож|спин|ягодиц|шрам|веснушк/i],
  ['Темп и обстановка', 'hourglass', /спешк|быстр|темп|долг|утр|ночь|свеч|душ|ванн|кухн|машин|спонтан|внезап/i],
];
const СЛОВО_СИЛЫ = ['', 'едва', 'слегка', 'интересно', 'сильно', 'непреодолимо'];
const СЛОВО_НИКОГДА = ['', 'скорее нет', 'не станет', 'нет', 'против', 'никогда'];
const СЛОВО_МИМО = ['', 'почти всё равно', 'не трогает', 'не заводит', 'отталкивает', 'отвращает'];
const РИМСКИЕ = ['', 'I', 'II', 'III', 'IV', 'V'];

// отказ: '' — кинки и фетиши, 'never' — «Никогда не сделает»,
// 'noturn' — «Не возбуждает». У отказов сила — твёрдость «нет», вид тот
// же, но перечёркнутый: карты перевёрнуты, в меню — «нет в меню».
export function видВлечений(value, вид, отказ = '') {
  const все = пары(value).map(п => {
    const т = ТИПЫ_ВЛЕЧЕНИЙ.find(([, , rx]) => rx.test(п.имя + ' ' + п.текст));
    return { ...п, сила: отказ ? силаОтказа(п.текст) : сила(п.текст), глубина: !отказ && ГЛУБЬ.test(п.текст), тип: т ? т[0] : 'Разное', значок: т ? т[1] : 'diamond' };
  });
  if (!все.length) return '';
  const СЛОВА = отказ === 'never' ? СЛОВО_НИКОГДА : отказ === 'noturn' ? СЛОВО_МИМО : СЛОВО_СИЛЫ;
  const корень = (класс, тело) => `<div class="hud-v hud-v-kinks ${класс}${отказ ? ' is-no is-' + отказ : ''}">${тело}</div>`;
  const строка = (п, правее = '', низ = '') => `<div class="hud-v-card hud-v-kink s${п.сила}"><div class="hud-v-kink-head">${отказ ? ико('diamond', 'is-no-mark') : ''}<b>${escapeHtml(п.имя)}</b>${правее}</div>${низ}${п.текст ? `<small>${applyTooltips(п.текст)}</small>` : ''}</div>`;
  if (вид === 'bars') return корень('is-bars', все.map(п => строка(п, `<span class="hud-v-tag">${СЛОВА[п.сила]}</span>`, `<span class="hud-v-segments is-kink" aria-label="${п.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i${i <= п.сила ? ' class="is-on"' : ''}></i>`).join('')}</span>`)).join(''));
  if (вид === 'stars') return корень('is-stars', все.map(п => строка(п, `<span class="hud-v-stars" aria-label="${СЛОВА[п.сила]}, ${п.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i style="--i:${i}"${i <= п.сила ? ' class="is-on"' : ''}>${отказ ? '✕' : '★'}</i>`).join('')}</span>`)).join(''));
  if (вид === 'tarot') {
    // Колода: у каждого влечения своя карта, масть — тип, число — сила.
    // Тайные (мечты, стыд, «никому») лежат рубашкой вверх и переворачиваются
    // наведением или нажатием. У отказов карта перевёрнута — как в гадании,
    // «против» — и поперёк лента со словом.
    return корень('is-tarot', все.map(п => {
      const тит = `${escapeHtml(п.имя)}${п.текст ? ': ' + escapeHtml(п.текст) : ''} — ${СЛОВА[п.сила]}${п.глубина ? ' (тайное)' : ''}`;
      const лицоКарты = `<span class="face"><span class="corner">${РИМСКИЕ[п.сила]}</span><span class="corner is-b">${РИМСКИЕ[п.сила]}</span>`
        + `<i class="sigil" aria-hidden="true">${ико(п.значок)}</i><b>${escapeHtml(п.имя)}</b>`
        + `<span class="pips" aria-label="${п.сила} из 5">${[1, 2, 3, 4, 5].map(i => `<i${i <= п.сила ? ' class="is-on"' : ''}>◆</i>`).join('')}</span>`
        + `${п.текст ? `<small>${applyTooltips(п.текст)}</small>` : ''}<em class="suit">${escapeHtml(п.тип)}</em>`
        + `${отказ ? `<em class="sash">${escapeHtml(СЛОВА[п.сила])}</em>` : ''}</span>`;
      const рубашка = п.глубина ? '<span class="back" aria-hidden="true"><i class="moon">☽</i><i class="rays"></i><em>тайное</em></span>' : '';
      return `<div class="hud-v-tarot s${п.сила}${п.глубина ? ' is-hidden' : ''}${отказ ? ' is-reversed' : ''}" style="--r:${((hudHashSeed(п.имя) % 5) - 2) * 0.8}deg"${п.глубина ? ' tabindex="0"' : ''} title="${тит}"><span class="inner">${лицоКарты}${рубашка}</span></div>`;
    }).join(''));
  }
  const порядок = [...ТИПЫ_ВЛЕЧЕНИЙ.map(([т, з]) => [т, з]), ['Разное', 'diamond']];
  const поТипам = порядок.map(([т, з]) => [т, з, все.filter(п => п.тип === т)]).filter(([, , с]) => с.length);
  if (вид === 'groups') {
    return корень('is-groups', поТипам.map(([т, з, с]) => `<div class="hud-v-group"><div class="hud-v-group-head">${ико(з)}${escapeHtml(т)}<em>${с.length}</em></div>${с.map(п => строка(п)).join('')}</div>`).join(''));
  }
  if (вид === 'menu') {
    // Меню на грифельной доске: разделы — типы, блюда — влечения, острота —
    // перчинками по силе. Отказы — «нет в меню»: зачёркнуто, с причиной.
    const заголовок = отказ === 'never' ? 'Не подаётся' : отказ === 'noturn' ? 'Не по вкусу' : 'Меню вечера';
    return корень('is-menu', `<div class="hud-v-menu"><div class="hud-v-menu-title"><i aria-hidden="true"></i><b>${заголовок}</b><i aria-hidden="true"></i></div>`
      + поТипам.map(([т, з, с]) => `<section><h5>${ико(з)}${escapeHtml(т)}</h5>${с.map(п => `<div class="dish s${п.сила}${п.глубина ? ' is-secret' : ''}" title="${escapeHtml(п.имя)}: ${escapeHtml(СЛОВА[п.сила])}">`
        + `<div class="dish-line"><b>${escapeHtml(п.имя)}</b><i class="lead"></i><span class="heat" aria-label="${escapeHtml(СЛОВА[п.сила])}">${отказ ? `<em>${escapeHtml(СЛОВА[п.сила])}</em>` : Array.from({ length: 5 }, (_, i) => ико('flame', i < п.сила ? 'is-on' : '')).join('')}</span></div>`
        + `${п.текст ? `<small>${applyTooltips(п.текст)}</small>` : ''}${п.глубина ? '<em class="chef">секрет шефа</em>' : ''}</div>`).join('')}</section>`).join('')
      + `</div>`);
  }
  return '';
}

/* --- Важное, общие воспоминания -------------------------------------------- */

// Пункты приходят готовыми: { текст, кнопка } — кнопку «Запомнить в
// Lorebook» собирает вызывающий (lore.js тянет за собой полпроекта).
const пунктыСписка = (пункты) => (Array.isArray(пункты) ? пункты : []).map(п => typeof п === 'string' ? { текст: п, кнопка: '' } : п).filter(п => п && String(п.текст || '').trim());

export function видВажного(пункты, вид) {
  const все = пунктыСписка(пункты);
  if (!все.length) return '';
  const текст = (п) => `<span class="hud-lore-text">${applyTooltips(String(п.текст))}</span>`;
  if (вид === 'scroll') {
    // Свиток: пергамент между двумя валиками, пункты — параграфами.
    return `<div class="hud-v hud-v-imp is-scroll"><div class="hud-v-scroll"><i class="roll" aria-hidden="true"></i><ol>${все.map((п, i) => `<li class="hud-lore-item"><span class="mark">§ ${i + 1}</span>${текст(п)}${п.кнопка}</li>`).join('')}</ol><i class="roll is-b" aria-hidden="true"></i></div></div>`;
  }
  if (вид === 'notebook') {
    // Блокнот: разлинованный лист с полем, каждый пункт выделен маркером.
    return `<div class="hud-v hud-v-imp is-notebook"><div class="hud-v-notebook"><i class="rings" aria-hidden="true"></i>${все.map((п, i) => `<div class="line hud-lore-item" style="--r:${((hudHashSeed(String(п.текст)) % 5) - 2) * .4}deg"><span class="num">${i + 1}.</span><mark>${текст(п)}</mark>${п.кнопка}</div>`).join('')}</div></div>`;
  }
  if (вид === 'bookmarks') {
    // Закладки: у каждой записи сверху свисает ленточка с номером.
    return `<div class="hud-v hud-v-imp is-bookmarks">${все.map((п, i) => `<div class="hud-v-card hud-v-bookmark hud-lore-item" style="--тон:${(hudHashSeed(String(п.текст)) % 50) - 25}"><i class="ribbon" aria-hidden="true">${i + 1}</i>${текст(п)}${п.кнопка}</div>`).join('')}</div>`;
  }
  return '';
}

// Значок сцены для фото-воспоминания — по словам в тексте.
const СЦЕНЫ = [[/дожд|снег|гроз|ливень|мокр/i, 'wave'], [/ноч|луна|звёзд|звезд|темн/i, 'moon'], [/кофе|чай|кафе|ужин|завтрак|вино|бокал|ресторан/i, 'cup'],
  [/поцел|обня|любл|сердц|нежн/i, 'heart'], [/дом|квартир|кухн|спальн|комнат/i, 'house'], [/книг|письм|записк|библиот/i, 'book'],
  [/огон|свеч|камин|костр/i, 'flame'], [/тайн|секрет|ключ/i, 'key'], [/смех|шутк|улыб/i, 'star']];

// Снимок для полароида: маленький пейзаж в тоне темы — небо, холмы,
// солнце или луна со звёздами, дождь, если о нём речь; в углу — значок сцены.
function снимок(текст) {
  const h = hudHashSeed(текст), id = новыйId('ph');
  const ночь = /ноч|луна|звёзд|звезд|темн|вечер|полноч/i.test(текст), дождь = /дожд|ливень|гроз|мокр|снег|туман/i.test(текст);
  const значок = (СЦЕНЫ.find(([rx]) => rx.test(текст)) || [0, 'star'])[1];
  const холм = (y, амп, фаза, шаг) => { let d = `M0 90V${y}`; for (let x = 0; x <= 120; x += шаг) d += `L${x} ${(y - амп * Math.sin((x + фаза) / 17) - амп * .4 * Math.sin((x + фаза) / 7)).toFixed(1)}`; return d + 'L120 90Z'; };
  const звёзды = ночь ? Array.from({ length: 14 }, (_, i) => { let r = Math.imul(h + i * 97, 2654435761) >>> 0; return `<circle class="st" cx="${r % 120}" cy="${(r >> 8) % 40}" r="${((r >> 4) % 3) * .25 + .35}"/>`; }).join('') : '';
  const капли = дождь ? Array.from({ length: 16 }, (_, i) => { const x = (i * 8 + (h % 8)) % 124 - 2, y = (i * 23 + (h >> 3)) % 60; return `<path class="rain" d="M${x} ${y}l-2 7"/>`; }).join('') : '';
  const светило = ночь
    ? `<circle class="glow" cx="${86 + h % 14}" cy="20" r="16"/><path class="moon" d="M${92 + h % 14} 13a8 8 0 1 0 5 13 6.4 6.4 0 1 1-5-13Z"/>`
    : `<circle class="glow" cx="${30 + h % 50}" cy="${28 + (h >> 6) % 10}" r="20"/><circle class="sun" cx="${30 + h % 50}" cy="${28 + (h >> 6) % 10}" r="7"/>`;
  return `<svg class="photo${ночь ? ' is-night' : ''}" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="k0"/><stop offset=".6" class="k1"/><stop offset="1" class="k2"/></linearGradient>`
    + `<radialGradient id="${id}v" cx=".5" cy=".45" r=".75"><stop offset=".6" class="v0"/><stop offset="1" class="v1"/></radialGradient></defs>`
    + `<rect width="120" height="90" fill="url(#${id})"/>${звёзды}${светило}${дождь ? '<path class="cloud" d="M14 26h34a8 8 0 0 0-2-15.8A11 11 0 0 0 25 12a7 7 0 0 0-11 14Z"/>' : ''}${капли}`
    + `<path class="hill h1" d="${холм(56, 7, h % 60, 8)}"/><path class="hill h2" d="${холм(68, 5, (h >> 4) % 70, 6)}"/><path class="hill h3" d="${холм(80, 3, (h >> 8) % 80, 5)}"/>`
    + `<rect width="120" height="90" fill="url(#${id}v)"/><g class="badge" transform="translate(96 66)"><circle r="10"/><path transform="translate(-6.6 -6.6) scale(.55)" d="${ИКОНКИ[значок]}"/></g></svg>`;
}
export function видВоспоминаний(пункты, вид) {
  const все = пунктыСписка(пункты);
  if (!все.length) return '';
  const текст = (п) => `<span class="hud-lore-text">${applyTooltips(String(п.текст))}</span>`;
  if (вид === 'polaroid') {
    // Полароиды: «снимок» — мягкий градиент в тоне акцента со значком сцены,
    // подпись — само воспоминание.
    return `<div class="hud-v hud-v-mem is-polaroid">${все.map(п => {
      const h = hudHashSeed(String(п.текст));
      return `<div class="hud-v-polaroid hud-lore-item" style="--r:${(h % 7) - 3}deg;--тон:${(h % 80) - 40};--тон2:${((h >> 5) % 80) - 40}"><i class="tape" aria-hidden="true"></i>${снимок(String(п.текст))}${текст(п)}${п.кнопка}</div>`;
    }).join('')}</div>`;
  }
  if (вид === 'film') {
    // Киноплёнка: кадры в ряд с перфорацией, у кадра — номер, как на плёнке.
    return `<div class="hud-v hud-v-mem is-film"><div class="hud-v-film">${все.map((п, i) => `<div class="frame hud-lore-item"><span class="no">▸ ${String(i + 1).padStart(2, '0')}A</span><i class="grain" aria-hidden="true"></i>${текст(п)}${п.кнопка}</div>`).join('')}</div></div>`;
  }
  if (вид === 'beads') {
    // Бусины на нити: каждое воспоминание — стеклянная бусина своего оттенка.
    return `<div class="hud-v hud-v-mem is-beads"><ol class="hud-v-beads">${все.map(п => `<li class="hud-lore-item" style="--тон:${(hudHashSeed(String(п.текст)) % 70) - 35}"><i class="bead" aria-hidden="true"></i><span class="hud-v-card">${текст(п)}${п.кнопка}</span></li>`).join('')}</ol></div>`;
  }
  return '';
}

/* --- Ревность --------------------------------------------------------------- */

// «Ревнует Софи к коллеге Мире — та слишком часто пишет…» → кого, к кому,
// как проявляется. Не разобралось — весь текст идёт в «как».
export function разобратьРевность(value) {
  const t = String(value || '').trim();
  const m = t.match(/ревну\S*\s+(.+?)\s+к\s+(.+?)(?=\s*[—–:;,.(]|\s+-\s|$)/i);
  const деталь = m ? t.slice(t.indexOf(m[0]) + m[0].length).replace(/^[\s—–:;,.-]+/, '') : t;
  const s = t.toLowerCase();
  const сила = /бешен|ярост|безумн|сходит с ума|до дрожи|невыносим|не контролир/.test(s) ? 5 : /сильн|очень|жгуч|остро|каждое|каждый|постоянно/.test(s) ? 4 : /слегка|чуть|немного|тихо|скрыва|почти не/.test(s) ? 2 : 3;
  return { кого: m ? m[1].trim() : '', кКому: m ? m[2].trim() : '', деталь, сила };
}
const СЛОВО_РЕВНОСТИ = ['', 'лёгкий укол', 'тлеет', 'царапает', 'жжёт', 'сжигает'];
// Имя из «коллеге Мире»: последнее слово с заглавной, иначе всё целиком.
const имяИз = (фраза) => { const м = String(фраза || '').match(/[A-ZА-ЯЁ][\p{L}-]+/gu); return м ? м[м.length - 1] : String(фраза || '').trim(); };

export function видРевности(value, вид, владелец = '') {
  if (пусто(value)) return '';
  const р = разобратьРевность(value);
  const заголовок = р.кого ? `<span class="who">${лицо(р.кого)}<b>${escapeHtml(р.кого)}</b></span><i class="to" aria-hidden="true">${ико('eye')}</i><span class="who is-rival">${лицо(имяИз(р.кКому))}<b>${escapeHtml(р.кКому)}</b></span>` : '';
  const уровень = `<span class="hud-v-tag s${р.сила}">${СЛОВО_РЕВНОСТИ[р.сила]}</span>`;
  if (вид === 'triangle' && р.кого) {
    // Треугольник: владелец наверху, объект и соперник внизу. К объекту —
    // тёплая линия с сердцем, к сопернику — колючая, между ними — пунктир.
    const W = 300, H = 150, A = [150, 26], B = [58, 112], C = [242, 112];
    // Колючая линия: прямой стебель к сопернику, шипы — треугольниками по
    // обе стороны, через один.
    const дл = Math.hypot(C[0] - A[0], C[1] - A[1]), ux = (C[0] - A[0]) / дл, uy = (C[1] - A[1]) / дл;
    const колючки = Array.from({ length: 7 }, (_, i) => { const t = .2 + i * .1, px = A[0] + (C[0] - A[0]) * t, py = A[1] + (C[1] - A[1]) * t, s = i % 2 ? 1 : -1, nx = -uy * s, ny = ux * s;
      return `M${(px - ux * 2).toFixed(1)} ${(py - uy * 2).toFixed(1)}L${(px + nx * 5 + ux * 1.5).toFixed(1)} ${(py + ny * 5 + uy * 1.5).toFixed(1)}L${(px + ux * 2).toFixed(1)} ${(py + uy * 2).toFixed(1)}Z`; }).join('');
    return `<div class="hud-v hud-v-jeal is-triangle s${р.сила}"><svg class="hud-v-tri" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(value)}">`
      + `<path class="warm" d="M${A}L${B}"/><path class="thorn" d="M${A}L${C}"/><path class="spikes" d="${колючки}"/><path class="between" d="M${B}L${C}"/>`
      + `<g class="mid" transform="translate(${(A[0] + B[0]) / 2 - 7} ${(A[1] + B[1]) / 2 - 7}) scale(.6)"><path d="${СЕРДЦЕ}"/></g>`
      + лицоSvg(владелец || '?', A[0], A[1], 15, 'is-owner') + лицоSvg(р.кого, B[0], B[1], 14) + лицоSvg(имяИз(р.кКому), C[0], C[1], 14, 'is-rival')
      + `<text class="lbl" x="${A[0] + 22}" y="${A[1] + 4}">${escapeHtml(первое(владелец || ''))}</text><text class="lbl" x="${B[0]}" y="${B[1] + 28}">${escapeHtml(р.кого)}</text><text class="lbl is-rival" x="${C[0]}" y="${C[1] + 28}">${escapeHtml(р.кКому)}</text></svg>`
      + `<div class="hud-v-jeal-text">${уровень}${р.деталь ? `<p>${applyTooltips(р.деталь)}</p>` : ''}</div></div>`;
  }
  if (вид === 'thorns') {
    // Стебель с шипами: чем сильнее ревность, тем больше шипов и капель.
    const шипы = Array.from({ length: 2 + р.сила * 2 }, (_, i) => { const y = 22 + i * (96 / (2 + р.сила * 2)), л = i % 2; return `<path class="spike" d="M${л ? 19 : 21} ${y.toFixed(1)}l${л ? -8 : 8} -3 ${л ? 7 : -7} 6Z"/>`; }).join('');
    const капли = Array.from({ length: Math.max(0, р.сила - 2) }, (_, i) => `<path class="drop" d="M${i % 2 ? 12 : 28} ${50 + i * 22}c-2 3-3 4.5-3 6a3 3 0 0 0 6 0c0-1.5-1-3-3-6Z"/>`).join('');
    return `<div class="hud-v hud-v-jeal is-thorns s${р.сила}"><svg class="hud-v-stem" viewBox="0 0 40 130" aria-hidden="true"><path class="stalk" d="M20 128C16 100 24 70 19 40 17 28 21 20 20 16"/>${шипы}${капли}`
      + `<g class="rose" transform="translate(8 0) scale(1)"><path class="petal" d="M12 16c-6 0-9-4-8-9 3 2 5 1 8-3 3 4 5 5 8 3 1 5-2 9-8 9Z"/><path class="petal is-in" d="M12 13c-3 0-4-2-4-4 2 1 3 0 4-2 1 2 2 3 4 2 0 2-1 4-4 4Z"/></g></svg>`
      + `<div class="hud-v-jeal-body">${заголовок ? `<div class="hud-v-jeal-head">${заголовок}</div>` : ''}${уровень}${р.деталь ? `<p>${applyTooltips(р.деталь)}</p>` : ''}</div></div>`;
  }
  if (вид === 'thought') {
    // Мысли: облачко над головой владельца — ревность изнутри.
    return `<div class="hud-v hud-v-jeal is-thought s${р.сила}"><div class="hud-v-cloud-bubble">${заголовок ? `<div class="hud-v-jeal-head">${заголовок}</div>` : ''}<p>${applyTooltips(р.деталь || String(value))}</p>${уровень}</div>`
      + `<div class="hud-v-thinker"><i class="puff p1" aria-hidden="true"></i><i class="puff p2" aria-hidden="true"></i>${владелец ? лицо(владелец) : ''}</div></div>`;
  }
  return '';
}
