// hud-manager/render/factions.js
//
// Фракции и репутация — слой мира (wd.rep): как банды, полиция, гильдии,
// однокурсники относятся к игроку и/или персонажу. Строка модели:
// «Гильдия | Лилиан | 80 | уважают | вытащила их человека со склада».
// Карточка: шкала от −100 до 100, отношение словом, за что — и сдвиги из
// прошлых ходов, как шрамы у доверия. Настройка factions: user, char или both
// (тогда — две вкладки).
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.48';
import { settings } from '../settings.js?v=23.89.48';
import { namesLikelySame } from '../names.js?v=23.89.48';
import { раскрывашка } from './fold.js?v=23.89.48';

/** «Гильдия | Лилиан | 80 | уважают | за что» → { кто, к, число, как, почему }. */
export function разобратьФракцию(строка) {
  const [кто = '', к = '', число = '', как = '', ...почему] = String(строка ?? '').split('|').map(x => x.trim());
  if (!кто) return null;
  const n = parseInt(String(число).replace('−', '-').replace('+', ''), 10);
  // «—» или «-» вместо причины — причины нет.
  const за = почему.join(' | ');
  return { кто, к, число: Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : null, как, почему: /^[—–-]?$/.test(за) ? '' : за };
}

const ключ = (ф) => String(ф.кто).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

// К кому строка: игрок, персонаж или (при одной цели) — та, что в настройке.
function цельСтроки(ф, игрок, персонаж, режим) {
  if (режим !== 'both') return режим === 'char' ? 'char' : 'user';
  const к = ф.к;
  if (к && персонаж && (namesLikelySame(к, персонаж) || namesLikelySame(персонаж, к))) return 'char';
  if (к && игрок && (namesLikelySame(к, игрок) || namesLikelySame(игрок, к))) return 'user';
  if (/\{\{char\}\}/i.test(к)) return 'char';
  return 'user';
}

/**
 * Сдвиги репутации из прошлых ходов. история — [{ строки: [...], дата }] от
 * старых к новым (последний — этот ход). → Map(ключ цели|фракции → [{ было, стало, почему, дата }]).
 */
export function сдвигиФракций(история, игрок, персонаж, режим) {
  const прежнее = new Map(), сдвиги = new Map();
  for (const ход of история) {
    for (const ф of (ход.строки || []).map(разобратьФракцию).filter(Boolean)) {
      if (ф.число === null) continue;
      const к = цельСтроки(ф, игрок, персонаж, режим) + '|' + ключ(ф);
      const было = прежнее.get(к);
      if (было !== undefined && было !== ф.число) {
        if (!сдвиги.has(к)) сдвиги.set(к, []);
        сдвиги.get(к).push({ было, стало: ф.число, почему: ф.почему, дата: ход.дата || '' });
      }
      прежнее.set(к, ф.число);
    }
  }
  return сдвиги;
}

const тон = (n) => (n === null ? 'is-none' : n >= 40 ? 'is-good' : n > 10 ? 'is-warm' : n >= -10 ? 'is-even' : n > -40 ? 'is-cold' : 'is-bad');
const ЩИТ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 4.5 5.6v5.6c0 4.8 3.2 8.7 7.5 10 4.3-1.3 7.5-5.2 7.5-10V5.6z"/><path d="M12 7v9M8.5 11.5h7"/></svg>';

// Карточка: щит, название, отношение, число и шкала видны сразу (и значок
// последнего сдвига); за что и как менялось — выезжает по нажатию (render/fold.js).
function карточка(ф, сдвиги) {
  const n = ф.число;
  // Шкала из середины: вправо — тепло, влево — вражда.
  const ширина = n === null ? 0 : Math.abs(n) / 2;
  const полоса = n === null ? '' : `<span class="bar" aria-hidden="true"><i class="mid"></i><i class="fill ${n < 0 ? 'neg' : 'pos'}" style="--w:${ширина}%"></i></span>`;
  const последние = (сдвиги || []).slice(-3).reverse();
  const шаг = последние.length ? последние[0].стало - последние[0].было : 0;
  const голова = `<i class="hud-rep-ico">${ЩИТ}</i><span class="name"><b class="who">${escapeHtml(ф.кто)}</b>`
    + `${ф.как ? `<em class="att">${escapeHtml(ф.как)}</em>` : ''}${шаг ? `<small class="step ${шаг > 0 ? 'up' : 'down'}">${шаг > 0 ? '▲ +' : '▼ '}${шаг}</small>` : ''}</span>`
    + `${n === null ? '' : `<span class="num">${n > 0 ? '+' : ''}${n}</span>`}${полоса}`;
  const подробно = (ф.почему ? `<p class="why"><small>За что</small><span>${escapeHtml(ф.почему)}</span></p>` : '')
    + (последние.length ? `<div class="hud-rep-shifts"><small>Как менялось</small><ul>${последние.map(с => { const d = с.стало - с.было; return `<li class="${d > 0 ? 'up' : 'down'}"><b>${d > 0 ? '▲ +' : '▼ '}${d}</b>${с.дата ? ` <small>${escapeHtml(с.дата)}</small>` : ''}${с.почему ? ` <span>${escapeHtml(с.почему)}</span>` : ''}</li>`; }).join('')}</ul></div>` : '');
  return раскрывашка(`hud-rep-card ${тон(n)}`, голова, подробно);
}

/* --- Вид «Зал совета» ------------------------------------------------------
   Полукруг, как места в парламенте: слева — враги (−100), справа — свои
   (+100), наверху — нейтралитет. Каждая фракция — пронумерованное место на
   дуге; близкие по числу встают рядом, в ряд ближе к центру. Прошлое место
   — пустой кружок, путь к нынешнему — дуга со стрелкой. Внизу — легенда с
   теми же номерами: отношение, число, последний сдвиг и за что. */
const ЗОНЫ = [[-100, -40, 'is-bad'], [-40, -10, 'is-cold'], [-10, 10, 'is-even'], [10, 40, 'is-warm'], [40, 100, 'is-good']];
const ф1 = (x) => Math.round(x * 10) / 10;
function точка(v, r, cx = 120, cy = 118) {
  const θ = Math.PI * (1 - (v + 100) / 200);
  return [ф1(cx + r * Math.cos(θ)), ф1(cy - r * Math.sin(θ))];
}
const дуга = (от, до, r) => { const [x1, y1] = точка(от, r), [x2, y2] = точка(до, r); return `M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}`; };
const шагСдвига = (с) => (с && с.length ? с[с.length - 1].стало - с[с.length - 1].было : 0);
const чипСдвига = (шаг) => (шаг ? `<small class="step ${шаг > 0 ? 'up' : 'down'}">${шаг > 0 ? '▲ +' : '▼ '}${шаг}</small>` : '');

function залСовета(список, uid, цель, имяЦели) {
  // Места: от врагов к своим; соседу ближе 13 единиц — ряд внутрь (до трёх).
  const РЯДЫ = [92, 70, 48];
  const места = список.map((п, i) => ({ ...п, номер: i + 1 })).filter(п => п.ф.число !== null).sort((а, б) => а.ф.число - б.ф.число);
  const последнееВРяду = [-999, -999, -999];
  for (const м of места) {
    let ряд = РЯДЫ.findIndex((_, i) => м.ф.число - последнееВРяду[i] >= 13);
    if (ряд < 0) ряд = РЯДЫ.length - 1;
    м.r = РЯДЫ[ряд]; последнееВРяду[ряд] = м.ф.число;
  }
  const полоса = ЗОНЫ.map(([а, б, кл]) => `<path class="zone ${кл}" d="${дуга(а, б, 104)}"/>`).join('');
  // Пустые кресла рядами — сам зал; гаснут к краю.
  const кресла = [86, 64, 42].map((r, ряд) => { const n = 13 - ряд * 3; return Array.from({ length: n + 1 }, (_, i) => { const v = -100 + i * 200 / n, [x, y] = точка(v, r); const кл = (ЗОНЫ.find(([а, б]) => v >= а && v <= б) || ЗОНЫ[2])[2]; return `<circle class="chair ${кл}" cx="${x}" cy="${y}" r="2.1"/>`; }).join(''); }).join('');
  const засечки = [-100, -50, 0, 50, 100].map(v => { const [x1, y1] = точка(v, 97), [x2, y2] = точка(v, 111); const [tx, ty] = точка(v, 121); return `<path class="tick" d="M${x1} ${y1}L${x2} ${y2}"/><text class="tick-l" x="${tx}" y="${ф1(ty + 3)}">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}</text>`; }).join('');
  const стрелка = `${uid}-${цель}-arw`;
  const пути = места.map(м => {
    const с = м.сдвиги || [];
    if (!с.length) return '';
    const было = с[с.length - 1].было, [x1, y1] = точка(было, м.r), [x2, y2] = точка(м.ф.число, м.r);
    return `<circle class="ghost" cx="${x1}" cy="${y1}" r="6.5"/><path class="trail" d="M${x1} ${y1}A${м.r} ${м.r} 0 0 ${м.ф.число > было ? 1 : 0} ${x2} ${y2}" marker-end="url(#${стрелка})"/>`;
  }).join('');
  const кружки = места.map(м => { const [x, y] = точка(м.ф.число, м.r); return `<g class="seat ${тон(м.ф.число)}"><title>${escapeHtml(м.ф.кто)}: ${м.ф.число > 0 ? '+' : ''}${м.ф.число}</title><circle cx="${x}" cy="${y}" r="8.5"/><text x="${x}" y="${ф1(y + 3.2)}">${м.номер}</text></g>`; }).join('');
  // Трибуна в центре: к кому относятся.
  const трибуна = `<path class="podium" d="M104 118h32l-4-14h-24Z"/><text class="podium-l" x="120" y="131">${escapeHtml(имяЦели)}</text>`;
  const svg = `<svg class="hud-rep-hemi" viewBox="-12 -10 264 148" role="img" aria-label="Зал совета"><defs><marker id="${стрелка}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" class="arw"/></marker></defs>`
    + `${полоса}${кресла}${засечки}<text class="side-l is-bad" x="8" y="135">враги</text><text class="side-l is-good" x="232" y="135">свои</text>${пути}${кружки}${трибуна}</svg>`;
  const легенда = список.map((п, i) => {
    const ф = п.ф, шаг = шагСдвига(п.сдвиги);
    return `<li class="${тон(ф.число)}"><i class="no">${i + 1}</i><span class="t"><b>${escapeHtml(ф.кто)}</b>${ф.как ? `<em>${escapeHtml(ф.как)}</em>` : ''}${чипСдвига(шаг)}</span>`
      + `${ф.число === null ? '' : `<span class="n">${ф.число > 0 ? '+' : ''}${ф.число}</span>`}${ф.почему ? `<small class="why">${escapeHtml(ф.почему)}</small>` : ''}</li>`;
  }).join('');
  return `<div class="hud-rep-council">${svg}<ol class="hud-rep-legend">${легенда}</ol></div>`;
}

/* --- Вид «Оранжерея» -------------------------------------------------------
   Каждая фракция — растение в горшке на полке теплицы, и растение — само
   отношение: свои — цветёт (чем выше число, тем выше стебель), тёплые —
   с бутоном, нейтральные — росток, холодные — вянет и роняет лист, враги —
   засохшая ветка с шипами в треснувшем горшке. Число — на табличке-колышке,
   сдвиг — бирка под горшком. За стеклом — ночь или день, по теме. */
const лист = (x, y, к, s = 1) => `<path class="leaf" d="M${x} ${y}q${-10 * к * s} ${-2 * s} ${-12 * к * s} ${-9 * s}q${9 * к * s} 0 ${12 * к * s} ${9 * s}Z"/><path class="vein" d="M${x} ${y}l${-10 * к * s} ${-7 * s}"/>`;
function растение(n, кл) {
  const v = n ?? 0;
  let тело = '';
  if (кл === 'is-good') {
    const h = 24 + Math.min(100, Math.max(40, v)) / 100 * 18, верх = 55 - h;
    const лепестки = Array.from({ length: 8 }, (_, i) => `<ellipse class="petal" cx="30" cy="${(верх - 5.6).toFixed(1)}" rx="3" ry="5.6" transform="rotate(${i * 45} 30 ${верх.toFixed(1)})"/>`).join('');
    тело = `<g class="sway"><path class="stem" d="M30 55C27 ${(55 - h * .4).toFixed(1)} 33 ${(55 - h * .7).toFixed(1)} 30 ${верх.toFixed(1)}"/>${лист(30, 55 - h * .28, 1)}${лист(30, 55 - h * .55, -1)}${лист(30, 55 - h * .78, 1, .75)}`
      + `<circle class="halo" cx="30" cy="${верх.toFixed(1)}" r="13"/>${лепестки}<circle class="heart" cx="30" cy="${верх.toFixed(1)}" r="3.4"/><circle class="pollen" cx="29" cy="${(верх - 1).toFixed(1)}" r="1"/></g>`;
  } else if (кл === 'is-warm') {
    const h = 22 + Math.min(39, Math.max(10, v)) / 40 * 8, верх = 55 - h;
    тело = `<g class="sway"><path class="stem" d="M30 55C29 ${(55 - h * .5).toFixed(1)} 31 ${(55 - h * .8).toFixed(1)} 30 ${верх.toFixed(1)}"/>${лист(30, 55 - h * .35, 1)}${лист(30, 55 - h * .62, -1)}`
      + `<path class="bud" d="M30 ${(верх + 1).toFixed(1)}c-4 -4 -2.5 -10 0 -12c2.5 2 4 8 0 12Z"/><path class="sepal" d="M30 ${(верх + 1).toFixed(1)}l-4 -3M30 ${(верх + 1).toFixed(1)}l4 -3"/></g>`;
  } else if (кл === 'is-cold') {
    тело = `<g class="sway"><path class="stem is-wilt" d="M30 55C30 42 35 35 43 38"/><path class="leaf is-dry" d="M31 47q-8 0-10 6q7 1 10-6Z"/><path class="leaf is-dry" d="M36 39q2-7 8-6q-1 6-8 6Z"/><path class="bud is-droop" d="M43 38c3 1 4 5 2 8c-3-1-4-5-2-8Z"/></g>`
      + `<path class="leaf is-fallen" d="M46 75q5-4 10-1q-5 4-10 1Z"/>`;
  } else if (кл === 'is-bad') {
    тело = `<path class="twig" d="M30 55L29 45L33 37L30 27M29 45L22 40M33 37L40 33M30 31L26 29"/>`
      + `<path class="thorn" d="M29.5 50l-3 -1.2 3 -.6ZM31 41l3 -.8 -2.6 -1.6ZM31.6 33l-3 -.4 2.4 -1.8ZM24.5 41.6l-.6 -2.8 1.8 1.6ZM37 35l1.2 -2.6 .2 2.2Z"/>`
      + `<path class="petal is-dead" d="M44 74q3-3 6-1q-3 3-6 1Z"/><path class="petal is-dead" d="M12 75q3-2 5 0q-3 2-5 0Z"/>`;
  } else {
    тело = `<g class="sway"><path class="stem" d="M30 55V47"/>${лист(30, 48.5, 1, .7)}${лист(30, 48.5, -1, .7)}</g>`;
  }
  const колышек = n === null ? '' : `<path class="stake" d="M17 56V40"/><rect class="rp-tag" x="5.5" y="31" width="23" height="10" rx="1.5"/><text class="rp-tag-n" x="17" y="38.4">${n > 0 ? '+' : ''}${n}</text>`;
  const трещина = кл === 'is-bad' ? '<path class="crack" d="M33 61l-2.5 4 2 3-3 6"/>' : '';
  return `<svg class="plant" viewBox="0 0 60 78" aria-hidden="true">${тело}<path class="rim" d="M12.5 54.5h35v6.5h-35Z"/><path class="pot" d="M14.5 61h31l-3.6 15h-23.8Z"/>`
    + `<path class="pot-hi" d="M17 62.5h5l-2.4 11.5h-1.6Z"/>${трещина}<ellipse class="soil" cx="30" cy="55.6" rx="15.6" ry="2.2"/>${колышек}</svg>`;
}
function оранжерея(список) {
  return `<div class="hud-rep-greenhouse"><ul class="hud-rep-garden">${список.map(п => {
    const ф = п.ф, кл = тон(ф.число), шаг = шагСдвига(п.сдвиги);
    return `<li class="hud-rep-plant ${кл}"><span class="spot">${растение(ф.число, кл)}</span>`
      + `<span class="t"><b>${escapeHtml(ф.кто)}</b>${ф.как ? `<em>${escapeHtml(ф.как)}</em>` : ''}${чипСдвига(шаг)}</span>`
      + `${ф.почему ? `<small class="why">${escapeHtml(ф.почему)}</small>` : ''}</li>`;
  }).join('')}</ul></div>`;
}

const ВИДЫ_ФРАКЦИЙ = ['classic', 'council', 'garden'];
// Содержимое одной вкладки в выбранном виде.
function видГруппы(список, вид, uid, цель, имяЦели) {
  if (!список.length) return '';
  if (вид === 'council') return залСовета(список, uid, цель, имяЦели);
  if (вид === 'garden') return оранжерея(список);
  return список.map(п => карточка(п.ф, п.сдвиги)).join('');
}

/**
 * Раздел «Фракции и репутация» для вкладки «Мир». строки — wd.rep этого хода;
 * история — см. сдвигиФракций; uid — для переключателя двух вкладок.
 */
export function блокФракций(строки, { игрок = '', персонаж = '', история = [], uid = 'rep' } = {}) {
  const режим = settings.factions || 'user';
  if (режим === 'off') return '';
  const фракции = (Array.isArray(строки) ? строки : []).map(разобратьФракцию).filter(Boolean);
  if (!фракции.length) return '';
  const сдвиги = сдвигиФракций(история, игрок, персонаж, режим);
  const вид = ВИДЫ_ФРАКЦИЙ.includes(settings.factionsView) ? settings.factionsView : 'classic';
  const группа = (цель) => видГруппы(фракции.filter(ф => цельСтроки(ф, игрок, персонаж, режим) === цель)
    .sort((а, б) => (б.число ?? -999) - (а.число ?? -999))
    .map(ф => ({ ф, сдвиги: сдвиги.get(цель + '|' + ключ(ф)) })), вид, uid, цель, цель === 'char' ? (персонаж || 'персонаж') : (игрок || 'игрок'));
  const заголовок = '<div class="hud-world-title">🛡 Фракции и репутация</div>';
  if (режим !== 'both') return `<div class="hud-world-section hud-rep is-${вид}">${заголовок}<div class="hud-rep-list">${группа(режим === 'char' ? 'char' : 'user')}</div></div>`;
  const кИгроку = группа('user'), кПерсонажу = группа('char');
  const имя = (s, запас) => escapeHtml(String(s || запас));
  return `<div class="hud-world-section hud-rep is-two is-${вид}">${заголовок}`
    + `<input type="radio" class="hud-rep-r u" name="${uid}-rep" id="${uid}-rep-u" checked hidden><input type="radio" class="hud-rep-r c" name="${uid}-rep" id="${uid}-rep-c" hidden>`
    + `<div class="hud-rep-tabs" role="tablist"><label for="${uid}-rep-u" role="tab">К игроку · ${имя(игрок, 'игрок')}</label><label for="${uid}-rep-c" role="tab">К персонажу · ${имя(персонаж, 'персонаж')}</label></div>`
    + `<div class="hud-rep-list pane-u">${кИгроку || '<p class="hud-rep-empty">Пока никто не определился.</p>'}</div>`
    + `<div class="hud-rep-list pane-c">${кПерсонажу || '<p class="hud-rep-empty">Пока никто не определился.</p>'}</div></div>`;
}
