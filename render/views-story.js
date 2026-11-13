// hud-manager/render/views-story.js
//
// Виды таймлайна, эмоций, отношений, графа отношений, боя и беременности
// (Кастомизация → Вид блоков). Первый вид каждого блока — прежний, его рисуют
// сами блоки (memory.js, character.js, relations-graph.js, combat.js,
// pregnancy.js); здесь только новые. Данные те же — модель ничего нового не
// пишет. Оформление — css/story-views.css.
//
//   Таймлайн:     Вахтенный журнал, Нотный стан, Раскадровка
//   Эмоции:       Витраж, Палитра, Выкраски
//   Отношения:    Медальоны, Записная книжка, Плющ
//   Граф:         Гербы, Рассадка, Гобелен, Матрица
//   Древо:        Крона, Родословная книга
//   Бой:          Файтинг, Тактический планшет, Шахматная партия
//   Беременность: Мобиль, Вязание, Росток
//
// Конечный вид рисуется сразу: анимации HUD держит на паузе, пока на вид не
// навели мышь или не нажали (css/views.css), — петли и на паузе законченны.

import { escapeHtml, applyTooltips, hudHashSeed, инициалыИмени, имяБезПриставки, getSafeUserName } from '../utils.js?v=23.89.20';
import { лицоЧеловека as лицо } from './views.js?v=23.89.20';
import { normalizeDiaryMood } from './diary.js?v=23.89.20';
import { relationVisualMeta, classifyRelationVisual, parseRelationList } from './relations-graph.js?v=23.89.20';
import { namesLikelySame } from '../names.js?v=23.89.20';

const э = (s) => escapeHtml(String(s ?? ''));
const ф = (n) => Number(n).toFixed(1);
const огр = (v, a, b) => Math.max(a, Math.min(b, v));
const сид = (s, i = 0) => { let h = hudHashSeed(String(s) + '#' + i) >>> 0; return () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h >>> 8) / 16777216; }; };
const имя = (s) => имяБезПриставки(String(s || '').trim());
const первое = (s) => имя(s).split(/\s+/)[0] || '';
// Слова модели и имена — мимо английского словаря (i18n.js).
const свои = (s) => `<span data-i18n-skip>${э(s)}</span>`;
const склон = (n, a, b, c) => { const k = Math.abs(n) % 100, d = k % 10; return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; };
const ВРЕМЯ = /^\[?(\d{1,2}\s*:\s*\d{2})\]?\s*[-—–:]?\s*(.*)$/;

/** «08:35 текст» → { время, текст }. Пустые и «empty» — мимо. */
export function разобратьСобытия(список) {
  return (Array.isArray(список) ? список : []).map(x => String(x ?? '').trim().replace(/\.$/, '')).filter(x => x && !/^(empty|none)$/i.test(x)).map(x => {
    const м = x.match(ВРЕМЯ);
    return м ? { время: м[1].replace(/\s+/g, ''), текст: м[2] } : { время: '', текст: x };
  });
}

// ============================================================================
// ТАЙМЛАЙН — события [{ время, текст }]
// ============================================================================

// Роза ветров: шестнадцать румбов, длинные — главные стороны.
function розаВетров() {
  const лучи = Array.from({ length: 16 }, (_, i) => {
    const a = i * 22.5, длин = i % 4 === 0 ? 44 : i % 2 === 0 ? 30 : 22, ш = i % 4 === 0 ? 7 : 4.5;
    return `<path class="${i % 2 ? 'r2' : 'r1'}${i % 4 === 0 ? ' main' : ''}" transform="rotate(${a} 50 50)" d="M50 ${50 - длин}L${50 + ш} 50 50 54 ${50 - ш} 50Z"/>`;
  }).join('');
  return `<svg class="rose" viewBox="0 0 100 100" aria-hidden="true"><circle class="ring" cx="50" cy="50" r="47"/><circle class="ring2" cx="50" cy="50" r="40"/>`
    + `<g class="ticks">${Array.from({ length: 32 }, (_, i) => `<path transform="rotate(${i * 11.25} 50 50)" d="M50 4v${i % 2 ? 3 : 6}"/>`).join('')}</g>${лучи}`
    + `<g class="needle"><path class="n" d="M50 14 54 50H46Z"/><path class="s" d="M50 86 54 50H46Z"/><circle class="hub" cx="50" cy="50" r="3.6"/></g>`
    + `<text x="50" y="13">N</text></svg>`;
}
// Склянки: вахта по четыре часа, склянка — каждые полчаса.
const склянки = (время) => { const м = String(время).match(/(\d{1,2}):(\d{2})/); if (!м) return 0; const мин = (+м[1] % 4) * 60 + +м[2]; return Math.max(1, Math.min(8, Math.floor(мин / 30) || 8)); };
/** Вахтенный журнал: обложка с латунной розой ветров и иглой компаса, страница
 *  в верёвочной раме, графы «склянки · время · запись»; каждая запись
 *  отмечена склянками своей вахты, текущая — якорем. */
function таймлайнЖурнал(с) {
  const строки = с.map((е, i) => {
    const б = склянки(е.время);
    const колокол = б ? `<span class="bells" aria-hidden="true">${Array.from({ length: б }, (_, k) => `<i class="${k % 2 ? 'b2' : ''}"></i>`).join('')}</span>` : '<span class="bells"></span>';
    return `<li class="${i === с.length - 1 ? 'is-now' : ''}">${колокол}<time data-i18n-skip>${э(е.время || '—')}</time><p data-i18n-skip>${applyTooltips(е.текст)}</p>`
      + (i === с.length - 1 ? `<svg class="anchor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="2.2"/><path d="M12 7v14M7 11h10M4 15c1 4 4 6 8 6s7-2 8-6"/></svg>` : '') + `</li>`;
  }).join('');
  return `<div class="hud-v hud-tl hud-tl-log"><div class="frame"><header class="cover">${розаВетров()}<div class="title"><small>вахтенный журнал</small><b>записей: ${с.length}</b></div></header>`
    + `<div class="cols" aria-hidden="true"><span>склянки</span><span>время</span><span>запись</span></div><ol class="page">${строки}</ol></div></div>`;
}

// Скрипичный ключ — упрощённым контуром.
const КЛЮЧ = 'M20 62c-5 1-9-2-8-6 1-4 7-5 9-1 2 3-1 6-4 5M18 56c8-2 12-8 10-15-2-6-10-7-12-1-3 8 6 9 7 3M19 70c-2-8 1-30 3-44 1-9-1-14-4-12-4 3-2 12 3 20 6 9 7 18 1 22';
const ТЕМП = (n) => n <= 3 ? 'Adagio' : n <= 6 ? 'Andante' : n <= 9 ? 'Moderato' : 'Allegro';
/** Нотный стан: страница партитуры — заголовок, темп, ключ и размер;
 *  события — ноты, чем позже час, тем выше; соседние ноты связаны ребром
 *  и лигой, последняя — под ферматой. Под станом — сноски-«слова». */
function таймлайнНоты(с) {
  const до = с.slice(-12), сдвиг = с.length - до.length;
  const W = 300, x0 = 58, шаг = (W - x0 - 12) / Math.max(1, до.length);
  const точки = до.map((е, i) => { const ч = parseInt(е.время, 10); return { x: x0 + шаг * (i + .5), y: Number.isFinite(ч) ? 60 - (огр(ч, 0, 23) / 23) * 48 : 36 }; });
  const ноты = точки.map(({ x, y }, i) => {
    const вверх = y > 36;
    const штиль = вверх ? `M${ф(x + 4.2)} ${ф(y)}V${ф(y - 24)}` : `M${ф(x - 4.2)} ${ф(y)}V${ф(y + 24)}`;
    const доп = (y < 18 ? [16, 8].filter(л => л >= y - 2) : y > 54 ? [60, 68].filter(л => л <= y + 2) : []).map(л => `<path class="ledger" d="M${ф(x - 7)} ${л}h14"/>`).join('');
    return `<g class="n" style="--i:${i}">${доп}<ellipse cx="${ф(x)}" cy="${ф(y)}" rx="4.8" ry="3.5" transform="rotate(-20 ${ф(x)} ${ф(y)})"/><path class="stem" d="${штиль}"/><text class="num" x="${ф(x)}" y="86">${сдвиг + i + 1}</text></g>`;
  }).join('');
  // Рёбра — у пар соседних нот с штилями в одну сторону; лиги — над парами.
  const рёбра = точки.slice(0, -1).map((p, i) => { const q = точки[i + 1]; if ((p.y > 36) !== (q.y > 36) || i % 2) return ''; const up = p.y > 36; const y1 = up ? p.y - 24 : p.y + 24, y2 = up ? q.y - 24 : q.y + 24; const dx = up ? 4.2 : -4.2; return `<path class="beam" d="M${ф(p.x + dx)} ${ф(y1)}L${ф(q.x + dx)} ${ф(y2)}"/>`; }).join('');
  const лиги = точки.slice(0, -1).map((p, i) => i % 3 === 1 ? `<path class="slur" d="M${ф(p.x)} ${ф(Math.min(p.y, точки[i + 1].y) - 9)}Q${ф((p.x + точки[i + 1].x) / 2)} ${ф(Math.min(p.y, точки[i + 1].y) - 17)} ${ф(точки[i + 1].x)} ${ф(Math.min(p.y, точки[i + 1].y) - 9)}"/>` : '').join('');
  const п = точки[точки.length - 1];
  const фермата = п ? `<path class="fermata" d="M${ф(п.x - 6)} ${ф(Math.min(п.y, 20) - 8)}a6 6 0 0 1 12 0"/><circle class="fermata-dot" cx="${ф(п.x)}" cy="${ф(Math.min(п.y, 20) - 9)}" r="1.1"/>` : '';
  const такты = до.map((_, i) => i && i % 4 === 0 ? `<path class="bar" d="M${ф(x0 + шаг * i)} 20V52"/>` : '').join('');
  return `<div class="hud-v hud-tl hud-tl-staff"><header class="opus"><b>Opus · <span>день</span></b><i>${ТЕМП(с.length)}</i></header><svg class="hud-tl-st-svg" viewBox="0 0 ${W} 92" aria-hidden="true">`
    + [20, 28, 36, 44, 52].map(y => `<path class="line" d="M6 ${y}H${W - 4}"/>`).join('') + `<path class="clef" d="${КЛЮЧ}"/><text class="meter" x="38" y="34">4</text><text class="meter" x="38" y="50">4</text>${такты}<path class="end" d="M${W - 7} 20V52M${W - 11} 20V52"/>`
    + `<rect class="play" x="${x0}" y="14" width="2" height="44"/>${рёбра}${лиги}${ноты}${фермата}</svg>`
    + `<ol class="hud-tl-st-list">` + с.map((е, i) => `<li class="${i < сдвиг ? 'is-early' : ''}"><sup class="no">${i + 1}</sup><time data-i18n-skip>${э(е.время)}</time><p data-i18n-skip>${applyTooltips(е.текст)}</p></li>`).join('') + `</ol></div>`;
}

const ЗВУКИ = ['БАМ!', 'ХЛОП!', 'ДЗЫНЬ!', 'ВЖУХ!', 'ТУК-ТУК', 'БУМ!'];
/** Раскадровка: страница комикса — заголовок главы, кадры с толстой рамкой
 *  и растровой заливкой своего цвета; время — в плашке рассказчика, текст —
 *  в облачке с хвостиком; в паре кадров — звук; последний кадр с линиями
 *  движения и пометкой «продолжение следует». */
function таймлайнКадры(с) {
  const r = сид(с.map(x => x.время).join(''));
  return `<div class="hud-v hud-tl hud-tl-board"><header class="chapter"><b>Глава: <span>этот день</span></b><small>кадров: ${с.length}</small></header><div class="strip">`
    + с.map((е, i) => { const звук = i % 3 === 1 ? `<i class="sfx" style="--r:${ф(-12 + r() * 24)}deg" aria-hidden="true">${ЗВУКИ[i % ЗВУКИ.length]}</i>` : '';
      return `<figure class="hud-tl-bd-panel s${i % 4} h${i % 5}${i === с.length - 1 ? ' is-now' : ''}"><span class="no">${i + 1}</span>${е.время ? `<span class="cap" data-i18n-skip>${э(е.время)}</span>` : ''}${звук}`
        + `<p class="bubble" data-i18n-skip>${applyTooltips(е.текст)}</p>${i === с.length - 1 ? '<small class="tbc">продолжение следует…</small>' : ''}</figure>`; }).join('') + `</div></div>`;
}

/** Линейка суток (минимализм): тонкая шкала 0–24 с засечками событий по
 *  времени, под ней строки «время — событие». Без времени — засечек нет. */
function таймлайнЛинейка(с) {
  const минуты = (вр) => { const м = /(\d{1,2}):(\d{2})/.exec(вр || ''); return м ? (+м[1] % 24) * 60 + +м[2] : null; };
  const засечки = с.map((е, i) => ({ м: минуты(е.время), i })).filter(з => з.м !== null)
    .map(з => `<i class="mk" style="left:${ф(з.м / 14.4)}%;--i:${з.i}"></i>`).join('');
  return `<div class="hud-v hud-tl hud-tl-ruler"><div class="scale" aria-hidden="true"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span>${засечки}</div>`
    + `<ol>${с.map((е, i) => `<li style="--i:${i}">${е.время ? `<time data-i18n-skip>${э(е.время)}</time>` : '<time>—</time>'}<p data-i18n-skip>${э(е.текст)}</p></li>`).join('')}</ol></div>`;
}

export function видТаймлайна(список, вид) {
  const с = разобратьСобытия(список);
  if (!с.length) return '';
  if (вид === 'log') return таймлайнЖурнал(с);
  if (вид === 'staff') return таймлайнНоты(с);
  if (вид === 'board') return таймлайнКадры(с);
  if (вид === 'ruler') return таймлайнЛинейка(с);
  return '';
}

// ============================================================================
// ЭМОЦИИ — люди [{ имя, сейчас, история: [строки «08:35 настроение»] }]
// Цвет настроения — тот же, что у темы листа дневника (--dm у .hud-diary-mood-*).
// ============================================================================

const настроение = (текст) => normalizeDiaryMood(String(текст || ''));
function человекЭмоций(ч) {
  const история = разобратьСобытия(ч.история).map(е => ({ ...е, ключ: настроение(е.текст) }));
  return { имя: ч.имя, сейчас: String(ч.сейчас || '').trim(), ключ: настроение(ч.сейчас || (история[история.length - 1] || {}).текст), история };
}
const строкиЭмоций = (история, класс) => `<ol class="${класс}">` + история.map(е => `<li class="hud-diary-mood-${е.ключ}"><i class="chip" aria-hidden="true"></i>`
  + (е.время ? `<time data-i18n-skip>${э(е.время)}</time>` : '') + `<p data-i18n-skip>${э(е.текст)}</p></li>`).join('') + `</ol>`;

/** Витраж: стрельчатое окно собора. Каменная арка со швами кладки, по бокам
 *  колонны с капителями, сверху навершие-крестоцвет; под сводом трилистник,
 *  в центре окно-роза — каждое настроение дня своим стеклом, нынешнее в
 *  середине; ниже два стрельчатых ланцета — два последних настроения. По
 *  стеклу — свинцовые переплёты и кракелюр, по розе ходит свет, на пол
 *  падают цветные лучи. Рядом — те же стёкла строками. */
function эмоцииВитраж(люди) {
  return `<div class="hud-v hud-em hud-em-glass">` + люди.map(ч => {
    const стёкла = ч.история.slice(-12);
    const n = Math.max(6, стёкла.length);
    const CX = 60, CY = 70;
    const клин = (i, r1, r2) => {
      const a1 = (i / n) * Math.PI * 2 - Math.PI / 2, a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const т = (r, a) => ф(CX + Math.cos(a) * r) + ' ' + ф(CY + Math.sin(a) * r);
      return `M${т(r1, a1)} L${т(r2, a1)} A${r2} ${r2} 0 0 1 ${т(r2, a2)} L${т(r1, a2)} A${r1} ${r1} 0 0 0 ${т(r1, a1)} Z`;
    };
    const м = (е) => е ? 'hud-diary-mood-' + е.ключ : 'is-clear';
    const кольцо = Array.from({ length: n }, (_, i) => `<path class="g ${м(стёкла[i])}" d="${клин(i, 18, 38)}"/>`).join('');
    const лепестки = Array.from({ length: n }, (_, i) => { const a = ((i + .5) / n) * Math.PI * 2 - Math.PI / 2; return `<circle class="g petal ${м(стёкла[i])}" cx="${ф(CX + Math.cos(a) * 43)}" cy="${ф(CY + Math.sin(a) * 43)}" r="4"/>`; }).join('');
    // Швы кладки по своду и колоннам.
    const швы = Array.from({ length: 9 }, (_, k) => { const a = Math.PI + (k + 1) / 10 * Math.PI; return `M${ф(CX + Math.cos(a) * 49)} ${ф(CY + 2 + Math.sin(a) * 53)}L${ф(CX + Math.cos(a) * 56)} ${ф(CY + 2 + Math.sin(a) * 62)}`; }).join('');
    const последние = стёкла.slice(-2), л1 = последние[0] || стёкла[0], л2 = последние[1] || л1;
    const ланцет = (x, е) => `<path class="g lancet ${м(е)}" d="M${x - 9} 154V132c0-7 4-12 9-15 5 3 9 8 9 15v22Z"/><path class="lead" d="M${x - 9} 140h18M${x} 117v37"/>`;
    const лучи = стёкла.slice(-5).map((е, i) => `<i class="hud-diary-mood-${е.ключ}" style="--i:${i}"></i>`).join('');
    return `<section class="hud-em-gl-win hud-diary-mood-${ч.ключ}"><div class="arch"><svg class="rose" viewBox="0 -10 120 170" aria-hidden="true">`
      + `<circle class="halo" cx="${CX}" cy="${CY}" r="58"/>`
      + `<path class="finial" d="M60-9v10M55-4h10M60 1c-3 0-5 3-5 5h10c0-2-2-5-5-5Z"/>`
      + `<path class="stone" d="M4 158V72C4 36 28 10 60 2c32 8 56 34 56 70v86Z"/>`
      + `<path class="joints" d="${швы}M4 96h8M4 120h8M4 144h8M108 96h8M108 120h8M108 144h8"/>`
      + `<path class="stone-in" d="M12 158V73C12 42 32 19 60 11c28 8 48 31 48 62v85Z"/>`
      + `<rect class="column" x="4" y="98" width="8" height="60"/><rect class="column" x="108" y="98" width="8" height="60"/><path class="capital" d="M2 98h12l-2-5H4ZM106 98h12l-2-5h-8Z"/>`
      + `<g class="trefoil"><circle class="g ${м(стёкла[стёкла.length - 1])}" cx="60" cy="22" r="4"/><circle class="g ${м(стёкла[стёкла.length - 2])}" cx="55" cy="28" r="4"/><circle class="g ${м(стёкла[стёкла.length - 3])}" cx="65" cy="28" r="4"/></g>`
      + `<circle class="lead-ring" cx="${CX}" cy="${CY}" r="48"/>${лепестки}${кольцо}<circle class="g hud-diary-mood-${ч.ключ} core" cx="${CX}" cy="${CY}" r="15"/>`
      + `<path class="star" d="M60 60l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L60 74.3l-5.9 3.7 1.7-6.7-5.3-4.4 6.9-.5Z"/>`
      + `<circle class="lead" cx="${CX}" cy="${CY}" r="15"/><circle class="lead" cx="${CX}" cy="${CY}" r="38"/>`
      + `<path class="crackle" d="M30 52l8 5 3 9M84 46l-6 8 2 7M40 92l9-3 5 6M78 90l-7-4-6 5M60 34v6M24 72h7M89 72h7"/>`
      + ланцет(40, л1) + ланцет(80, л2)
      + `<path class="sill" d="M14 154h92v6H14z"/>`
      + `<circle class="light" cx="${CX}" cy="${CY}" r="38"/></svg><div class="rays" aria-hidden="true">${лучи}</div></div>`
      + `<header class="hud-diary-mood-${ч.ключ}"><b data-i18n-skip>${э(первое(ч.имя))}</b>${ч.сейчас ? `<span data-i18n-skip>${э(ч.сейчас)}</span>` : ''}</header>`
      + строкиЭмоций(ч.история, 'hud-em-gl-list') + `</section>`;
  }).join('') + `</div>`;
}

/** Палитра: мастерская художника на холсте. Деревянная палитра с
 *  прожилками и тенью, отверстие под палец; краски дня — глянцевыми каплями
 *  с подтёком к середине, где они смешиваются; рядом банка с кистями (одна
 *  обмакнута в нынешнее настроение) и мастихин. Ниже — тюбики с цветной
 *  этикеткой: время и слова настроения лежат на мазке той же краски. */
function эмоцииПалитра(люди) {
  const МЕСТА = [[34, 40], [52, 26], [74, 22], [96, 26], [114, 38], [120, 58], [108, 76], [28, 62]];
  return `<div class="hud-v hud-em hud-em-palette">` + люди.map(ч => {
    const мазки = ч.история.slice(-8);
    const r = сид(ч.имя);
    const капли = мазки.map((е, i) => {
      const [x, y] = МЕСТА[i];
      const точки = Array.from({ length: 9 }, (_, k) => { const a = k / 9 * Math.PI * 2, d = 7 + r() * 3; return ф(x + Math.cos(a) * d) + ' ' + ф(y + Math.sin(a) * d * .82); });
      // Подтёк к середине палитры — там краски смешиваются.
      const mx = x + (74 - x) * .45, my = y + (52 - y) * .45;
      return `<path class="smear hud-diary-mood-${е.ключ}" d="M${x} ${y}Q${ф((x + mx) / 2 + 3)} ${ф((y + my) / 2 - 3)} ${ф(mx)} ${ф(my)}"/>`
        + `<path class="paint hud-diary-mood-${е.ключ}" d="M${точки.join(' L')}Z"/><ellipse class="gloss" cx="${x - 2.5}" cy="${y - 3}" rx="2.8" ry="1.6"/><circle class="gloss2" cx="${x + 3}" cy="${y + 2.5}" r=".9"/>`;
    }).join('');
    return `<section class="hud-em-pl-card hud-diary-mood-${ч.ключ}"><svg class="board" viewBox="0 0 172 110" aria-hidden="true">`
      + `<defs><linearGradient id="hud-em-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8955a"/><stop offset=".55" stop-color="#a87442"/><stop offset="1" stop-color="#7e5230"/></linearGradient></defs>`
      + `<ellipse class="shadow" cx="72" cy="98" rx="62" ry="7"/>`
      + `<path class="wood" d="M74 6C116 6 140 28 138 52c-2 22-22 22-30 32-8 10-24 12-40 10C34 92 8 78 8 52 8 24 34 6 74 6Z"/>`
      + `<path class="grain" d="M20 40c20-10 52-14 92-6M16 56c30 4 62 4 100-4M32 78c20 4 42 4 62 0M44 18c18-4 40-4 60 2"/>`
      + `<path class="edge" d="M74 9C113 9 135 29 134 51"/>`
      + `<ellipse class="hole" cx="42" cy="74" rx="9" ry="7"/><ellipse class="hole-rim" cx="42" cy="73" rx="9" ry="7"/>`
      + `<ellipse class="mix hud-diary-mood-${ч.ключ}" cx="74" cy="54" rx="11" ry="7"/>`
      + капли
      + `<g class="knife"><path class="blade" d="M58 92 92 70l3 2-30 26z"/><path class="handle" d="M50 98 60 91"/></g>`
      + `<g class="jar"><path class="jar-glass" d="M146 62h20v40c0 3-2 5-5 5h-10c-3 0-5-2-5-5Z"/><path class="water" d="M147 80h18v22c0 2-2 4-4 4h-10c-2 0-4-2-4-4Z"/>`
      + `<path class="stick" d="M150 64 145 18"/><path class="stick" d="M156 64 158 22"/><path class="stick" d="M162 64 168 30"/>`
      + `<path class="tip t1" d="M143.6 16c-1-5 0-9 1-10 1 1 3 5 2.4 9.6Z"/><path class="tip hud-diary-mood-${ч.ключ}" d="M156.8 20c0-5 .8-9 1.6-10 1 1 2.4 5 1.4 10Z"/><path class="tip t3" d="M167.2 28c0-4 1-7 2-8 .8 1 1.6 4 .4 8Z"/>`
      + `<path class="jar-shine" d="M149 66v32"/></g></svg>`
      + `<header class="hud-diary-mood-${ч.ключ}"><b data-i18n-skip>${э(первое(ч.имя))}</b>${ч.сейчас ? `<span data-i18n-skip>${э(ч.сейчас)}</span>` : ''}</header>`
      + `<ol class="hud-em-pl-list">` + ч.история.map(е => `<li class="hud-diary-mood-${е.ключ}"><svg class="tube" viewBox="0 0 44 16" aria-hidden="true"><path class="crimp" d="M1 3h6v10H1z"/><path class="crimp-lines" d="M2 5h4M2 8h4M2 11h4"/><path class="body" d="M7 2h24l6 3v6l-6 3H7z"/><path class="label" d="M12 2h13v12H12z"/><path class="shine" d="M8 4h22"/><path class="cap" d="M37 5h6v6h-6z"/></svg>`
        + (е.время ? `<time data-i18n-skip>${э(е.время)}</time>` : '<time></time>') + `<p class="stroke" data-i18n-skip>${э(е.текст)}</p></li>`).join('') + `</ol></section>`;
  }).join('') + `</div>`;
}

/** Выкраски: веер образцов на заклёпке — карточка-плашка краски, марка
 *  «TOS COLOR», код оттенка, время и слова; нынешнее — большой карточкой. */
function эмоцииВыкраски(люди) {
  const код = (s) => { const h = hudHashSeed(String(s)) >>> 0; return `${11 + h % 9}-${String(1000 + h % 9000)} ${['TCX', 'TPG', 'C'][h % 3]}`; };
  return `<div class="hud-v hud-em hud-em-swatch">` + люди.map(ч => `<section class="hud-em-sw-set"><header><i class="rivet" aria-hidden="true"></i><b data-i18n-skip>${э(первое(ч.имя))}</b><small>TOS color guide</small></header>`
    + (ч.сейчас ? `<div class="sw is-now hud-diary-mood-${ч.ключ}"><i class="col" aria-hidden="true"><small>сейчас</small></i><div class="lbl"><em>TOS COLOR</em><b data-i18n-skip>${код(ч.ключ + ч.имя)}</b><p data-i18n-skip>${э(ч.сейчас)}</p></div></div>` : '')
    + `<div class="fan">` + ч.история.slice().reverse().map((е, i) => `<div class="sw hud-diary-mood-${е.ключ}" style="--r:${ф((i % 2 ? 1 : -1) * (1 + (i % 3) * .5))}deg;--i:${i}"><i class="col" aria-hidden="true"></i><div class="lbl"><em>TOS COLOR</em><b data-i18n-skip>${код(е.текст)}</b>${е.время ? `<time data-i18n-skip>${э(е.время)}</time>` : ''}<p data-i18n-skip>${э(е.текст)}</p></div></div>`).join('')
    + `</div></section>`).join('') + `</div>`;
}

/** Градиент (минимализм): у каждого — одна тонкая полоса, перетекающая
 *  цветами настроений дня слева направо, и слово «сейчас»; под полосой —
 *  мелкие отметки времени с настроением. */
function эмоцииГрадиент(люди) {
  return `<div class="hud-v hud-em hud-em-grad">` + люди.map(ч => {
    const шаги = ч.история.length ? ч.история : [{ ключ: ч.ключ, текст: ч.сейчас, время: '' }];
    const n = шаги.length;
    // Цвет каждого шага — свой --dm с класса настроения (.hud-diary-mood-*).
    const точки = шаги.map((е, i) => `<i class="hud-diary-mood-${е.ключ}" style="left:${ф(n > 1 ? i / (n - 1) * 100 : 50)}%"></i>`).join('');
    return `<section><header><b data-i18n-skip>${э(первое(ч.имя))}</b>${ч.сейчас ? `<span class="now hud-diary-mood-${ч.ключ}" data-i18n-skip>${э(ч.сейчас)}</span>` : ''}</header>`
      + `<div class="band" aria-hidden="true">${точки}</div>`
      + `<ol>${шаги.filter(е => е.текст).map(е => `<li class="hud-diary-mood-${е.ключ}">${е.время ? `<time data-i18n-skip>${э(е.время)}</time>` : ''}<span data-i18n-skip>${э(е.текст)}</span></li>`).join('')}</ol></section>`;
  }).join('') + `</div>`;
}

export function видЭмоций(люди, вид) {
  const лю = (Array.isArray(люди) ? люди : []).filter(ч => ч && (ч.сейчас || (Array.isArray(ч.история) && ч.история.length))).map(человекЭмоций);
  if (!лю.length) return '';
  if (вид === 'glass') return эмоцииВитраж(лю);
  if (вид === 'palette') return эмоцииПалитра(лю);
  if (вид === 'swatch') return эмоцииВыкраски(лю);
  if (вид === 'grad') return эмоцииГрадиент(лю);
  return '';
}

// ============================================================================
// ОТНОШЕНИЯ — строка «Имя: как; Имя: как» (поле Rl)
// ============================================================================

// Тип связи (relations-graph.js) → семья цвета и формы.
const ГРУППА = {
  love: 'love', forbidden: 'love', jealous: 'love', family: 'family', parent: 'family', child: 'family', sibling: 'family',
  friend: 'friend', group: 'friend', accomplice: 'friend', mentor: 'mentor', student: 'mentor', hostile: 'hostile',
  fear: 'fear', suspicious: 'fear', boss: 'power', subordinate: 'power', debt: 'debt', neutral: 'plain', other: 'plain',
};
export const группаСвязи = (тип) => ГРУППА[тип] || 'plain';
function связиИз(значение) {
  return parseRelationList(значение).map(({ target, rel }) => { const тип = classifyRelationVisual(rel); return { кто: target.replace(/\s*\([^()]*\)\s*$/, '').trim() || target, что: rel, тип, группа: группаСвязи(тип), метка: relationVisualMeta(тип).label }; });
}

// Формы медальонов: сердце у любви, овал у семьи, круг у дружбы, шестигранник
// у наставничества, расколотый овал у вражды, щит у власти, монета у долга.
const ОВАЛ = 'M40 22c17 0 28 14 28 32S57 86 40 86 12 72 12 54s11-32 28-32Z';
const МЕДАЛЬОН = {
  love: 'M40 86C18 70 8 56 8 42a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 14-10 28-32 44Z', family: ОВАЛ, friend: 'M40 24a30 30 0 1 1 0 60 30 30 0 0 1 0-60Z',
  mentor: 'M40 22 68 38v32L40 86 12 70V38Z', hostile: ОВАЛ, fear: ОВАЛ, power: 'M40 22 66 30v24c0 16-12 26-26 32-14-6-26-16-26-32V30Z',
  debt: 'M40 24a30 30 0 1 1 0 60 30 30 0 0 1 0-60Z', plain: ОВАЛ,
};
/** Медальоны: шкатулка с бархатом, по верху — цепочка, на ней медальоны;
 *  металл и форма — по типу связи (розовое золото сердцем, серебро овалом,
 *  чернёное железо с трещиной…), по ободку — скань, внутри портрет, ниже —
 *  гравированная табличка: кто он для героя. */
function отношенияМедальоны(связи) {
  return `<div class="hud-v hud-rl hud-rl-locket"><i class="chain" aria-hidden="true"></i>` + связи.map((с, i) => `<figure class="hud-rl-lk g-${с.группа}" style="--d:${ф(i * .7)}s">`
    + `<div class="hang"><svg class="body" viewBox="0 0 80 92" aria-hidden="true"><circle class="loop" cx="40" cy="7" r="5"/><path class="bail" d="M36 12h8l-1 9h-6z"/>`
    + `<path class="shape" d="${МЕДАЛЬОН[с.группа]}"/><path class="filigree" d="${МЕДАЛЬОН[с.группа]}" transform="translate(40 54) scale(.86) translate(-40 -54)"/><path class="rim" d="${МЕДАЛЬОН[с.группа]}"/>`
    + (с.группа === 'hostile' ? '<path class="crack" d="M40 24l-4 14 6 8-5 12 4 10-3 14"/>' : '') + (с.группа === 'debt' ? '<circle class="mint" cx="40" cy="54" r="24"/>' : '')
    + `<path class="glint" d="M22 42c4-9 11-13 19-14"/></svg><span class="ph">${лицо(с.кто)}</span></div>`
    + `<figcaption><b data-i18n-skip title="${э(имя(с.кто))}">${э(первое(с.кто))}</b><small>${э(с.метка)}</small><p data-i18n-skip title="${э(с.что)}">${э(с.что)}</p></figcaption></figure>`).join('') + `</div>`;
}

/** Записная книжка: кожаная обложка с резинкой и скрепкой, разделы по
 *  буквам с вырезными цветными вкладками на краю; у каждой записи — штамп
 *  типа связи и пометка от руки. */
function отношенияКнижка(связи) {
  const буква = (s) => (имя(s).match(/\p{L}/u) || ['#'])[0].toUpperCase();
  const поБуквам = new Map();
  связи.slice().sort((а, б) => имя(а.кто).localeCompare(имя(б.кто), 'ru')).forEach(с => { const б = буква(с.кто); if (!поБуквам.has(б)) поБуквам.set(б, []); поБуквам.get(б).push(с); });
  return `<div class="hud-v hud-rl hud-rl-book"><i class="band" aria-hidden="true"></i><i class="clip" aria-hidden="true"></i><div class="pages">`
    + [...поБуквам].map(([б, список]) => `<section><h4><span>${э(б)}</span></h4>` + список.map(с => `<div class="entry g-${с.группа}"><b data-i18n-skip>${э(имя(с.кто))}</b><span class="tag">${э(с.метка)}</span><p data-i18n-skip>${э(с.что)}</p></div>`).join('') + `</section>`).join('')
    + `</div><nav class="tabs" aria-hidden="true">${[...поБуквам.keys()].map((б, i) => `<i style="--i:${i}">${э(б)}</i>`).join('')}</nav></div>`;
}

// Лист плюща: пятилопастный, у любви — сердцем, у вражды — с шипами.
const ЛИСТ = {
  love: 'M16 28C6 22 1 15 1 9a7 7 0 0 1 15-3 7 7 0 0 1 15 3c0 6-5 13-15 19Z',
  base: 'M16 29C12 24 2 22 2 14c4 1 6 0 7-3-3-3-3-7-1-9 3 2 6 2 8-1 2 3 5 3 8 1 2 2 2 6-1 9 1 3 3 4 7 3 0 8-10 10-14 15Z',
};
/** Плющ: по каменной кладке вьётся стебель с усиками, от него к каждому
 *  человеку — лист своего цвета с прожилками и каплей росы; у вражды —
 *  шипы, у любви — лист-сердце. Листья покачиваются. */
function отношенияПлющ(связи) {
  return `<div class="hud-v hud-rl hud-rl-ivy"><ol>` + связи.map((с, i) => `<li class="g-${с.группа}" style="--i:${i}"><svg class="leaf" viewBox="0 0 40 34" aria-hidden="true">`
    + `<path class="tendril" d="M0 17c4-1 6 1 6 4s-3 4-4 2"/><path class="twig" d="M0 17C5 16 8 16 10 17"/><g transform="translate(8 2)"><path class="blade" d="${с.группа === 'love' ? ЛИСТ.love : ЛИСТ.base}"/>`
    + `<path class="vein" d="M16 28V8M16 18 8 12M16 18l8-6M16 23l-6-1M16 23l6-1"/>${с.группа === 'hostile' ? '<path class="thorn" d="M4 10 1 6l5 2M28 10l3-4-5 2M16 2l0-3"/>' : ''}<circle class="dew" cx="22" cy="10" r="1.6"/></g></svg>`
    + `<div class="txt"><b data-i18n-skip>${э(первое(с.кто))}</b><small>${э(с.метка)}</small><p data-i18n-skip>${э(с.что)}</p></div></li>`).join('') + `</ol></div>`;
}

/** Оглавление (минимализм): «Имя ……… кто он» с отточием, как в содержании
 *  книги; цвет точки — тип связи, пояснение — мелко под строкой. */
function отношенияОглавление(связи) {
  return `<div class="hud-v hud-rl hud-rl-toc"><ol>` + связи.map(с => `<li class="g-${с.группа}"><span class="row"><b data-i18n-skip>${э(имя(с.кто))}</b><i class="dots" aria-hidden="true"></i><em>${э(с.метка)}</em></span>`
    + (с.что ? `<small data-i18n-skip>${э(с.что)}</small>` : '') + `</li>`).join('') + `</ol></div>`;
}

export function видОтношений(значение, вид) {
  const связи = связиИз(значение);
  if (!связи.length) return '';
  if (вид === 'locket') return отношенияМедальоны(связи);
  if (вид === 'book') return отношенияКнижка(связи);
  if (вид === 'ivy') return отношенияПлющ(связи);
  if (вид === 'toc') return отношенияОглавление(связи);
  return '';
}

// ============================================================================
// ГРАФ ОТНОШЕНИЙ — { nodes: [{ id, name, isUser, isPrimary }], edges: [{ from, to, label, тип }] }
// ============================================================================

const ГРУППЫ_ПОДПИСИ = { love: 'любовь', family: 'семья', friend: 'дружба', mentor: 'учёба', hostile: 'вражда', fear: 'страх и подозрение', power: 'власть', debt: 'долг', plain: 'прочее' };
function парыГрафа(edges) {
  const пары = new Map();
  for (const e of edges) {
    const к = [e.from, e.to].sort().join('|');
    if (!пары.has(к)) пары.set(к, { a: e.from, b: e.to, группа: группаСвязи(e.тип), подписи: [] });
    пары.get(к).подписи.push(e);
  }
  return [...пары.values()];
}
const порядокЛюдей = (nodes) => [...nodes.filter(x => x.isUser), ...nodes.filter(x => x.isPrimary && !x.isUser), ...nodes.filter(x => !x.isUser && !x.isPrimary)];
function раскладка(nodes, cx, cy, rx, ry) {
  const pos = {};
  порядокЛюдей(nodes).forEach((nd, i) => { const a = -Math.PI / 2 + (i / Math.max(1, nodes.length)) * Math.PI * 2; pos[nd.id] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, nd }; });
  return pos;
}
// Подсветка «кто с кем» (events.js): у человека data-gn, у связи data-ga и data-gb.
const человекАтр = (id) => ` data-gn="${э(id)}"`;
const связьАтр = (a, b) => ` data-ga="${э(a)}" data-gb="${э(b)}"`;
// Подпись связи на ленте: своя, если короткая; длинную заменяет род связи,
// а целиком она — по нажатию, в строках под рисунком, и во «Всех связях».
const ДЛИНА_ПОДПИСИ = 28;
// Большой состав: видно первые связи, остальные — кнопкой (events.js, .hud-gr-more);
// нажатие на человека и так оставляет только его связи.
const ВИДНО_СВЯЗЕЙ = 6;
const лишняя = (i, всего) => всего > ВИДНО_СВЯЗЕЙ + 2 && i >= ВИДНО_СВЯЗЕЙ ? ' is-extra' : '';
const кнопкаСвязей = (всего) => всего > ВИДНО_СВЯЗЕЙ + 2 ? `<button type="button" class="hud-more-btn hud-cap-more hud-gr-more" aria-expanded="false"><span class="to-more">Ещё <b>${всего - ВИДНО_СВЯЗЕЙ}</b> <small>из ${всего}</small></span><span class="to-less">Свернуть <b>${всего - ВИДНО_СВЯЗЕЙ}</b></span><svg class="hud-cap-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button>` : '';
function коротко(подписи) {
  const куски = [];
  for (const e of подписи) {
    const своя = String(e.label || '').trim();
    const кусок = своя && своя.length <= ДЛИНА_ПОДПИСИ ? `<span data-i18n-skip>${э(своя)}</span>` : `<span>${ГРУППЫ_ПОДПИСИ[группаСвязи(e.тип)]}</span>`;
    if (!куски.includes(кусок)) куски.push(кусок);
  }
  return куски.join(' · ');
}
function легенда(edges, пары, поИд) {
  const группы = [...new Set(пары.map(п => п.группа))];
  return `<div class="hud-gr-legend">${группы.map(г => `<span class="g-${г}" data-gg="${г}"><i aria-hidden="true"></i>${ГРУППЫ_ПОДПИСИ[г]}</span>`).join('')}</div>`
    + `<div class="hud-gr-say" hidden data-i18n-skip></div>`
    + `<details class="hud-gr-pairs"><summary>Все связи: ${edges.length}</summary><ul>${edges.map(e => `<li class="g-${группаСвязи(e.тип)}"${связьАтр(e.from, e.to)}><i aria-hidden="true"></i><b data-i18n-skip>${э(первое(поИд[e.from]?.name))} → ${э(первое(поИд[e.to]?.name))}</b><span data-i18n-skip>${э(e.label)}</span></li>`).join('')}</ul></details>`;
}

// Геральдические цвета (тинктуры) и щиты.
const ТИНКТУРЫ = ['gules', 'azure', 'vert', 'purpure', 'sable', 'or', 'argent', 'tenne'];
const ДЕЛЕНИЯ = ['', 'per-pale', 'per-fess', 'bend', 'chevron', 'cross'];
/** Гербы: у каждого человека свой щит — цвет поля, деление и вензель из
 *  инициалов; над игроком — корона, над главным героем — шлем; ниже —
 *  связи лентами-девизами: два малых щита и подпись на ленте цвета связи. */
function графГербы(nodes, edges) {
  const поИд = Object.fromEntries(nodes.map(n => [n.id, n])), пары = парыГрафа(edges);
  const щит = (nd, малый = false) => {
    const h = hudHashSeed(nd.id) >>> 0;
    const тинк = nd.isUser ? 'gules' : nd.isPrimary ? 'azure' : ТИНКТУРЫ[h % ТИНКТУРЫ.length];
    const дел = ДЕЛЕНИЯ[(h >>> 4) % ДЕЛЕНИЯ.length];
    const дел2 = { 'per-pale': '<path class="div" d="M30 4V66"/><path class="half" d="M30 4H54V36C54 50 44 60 30 66Z"/>', 'per-fess': '<path class="half" d="M6 34H54V36C54 50 44 60 30 66 16 60 6 50 6 36Z"/>', bend: '<path class="half" d="M6 4 54 52C49 58 40 63 30 66L6 40Z"/>', chevron: '<path class="half" d="M6 46 30 22 54 46V52L30 30 6 52Z"/>', cross: '<path class="half" d="M26 4h8v62h-8zM6 28h48v8H6z"/>' }[дел] || '';
    const верх = малый ? '' : nd.isUser ? '<path class="crown" d="M16 2 20 -8 25 0 30 -10 35 0 40 -8 44 2Z"/>' : nd.isPrimary ? '<path class="helm" d="M22 2C22-6 26-11 30-11S38-6 38 2ZM24-3h12"/>' : '';
    return `<svg class="shield t-${тинк}${малый ? ' is-small' : ''}" viewBox="0 -14 60 82" aria-hidden="true">${верх}<path class="field" d="M6 4H54V36C54 50 44 60 30 66 16 60 6 50 6 36Z"/>${дел2}<path class="edge" d="M6 4H54V36C54 50 44 60 30 66 16 60 6 50 6 36Z"/>`
      + `<text class="mono" data-i18n-skip x="30" y="40">${э(инициалыИмени(nd.name, 2) || '?')}</text></svg>`;
  };
  const галерея = порядокЛюдей(nodes).map(nd => `<figure class="arms${nd.isUser ? ' is-user' : nd.isPrimary ? ' is-primary' : ''}"${человекАтр(nd.id)}>${щит(nd)}<figcaption data-i18n-skip>${э(первое(nd.name))}</figcaption></figure>`).join('');
  const девизы = пары.map((п, i) => { const А = поИд[п.a], Б = поИд[п.b]; if (!А || !Б) return '';
    return `<li class="motto g-${п.группа}${лишняя(i, пары.length)}"${связьАтр(п.a, п.b)}>${щит(А, true)}<div class="ribbon"><i class="tail l" aria-hidden="true"></i><span><b data-i18n-skip>${э(первое(А.name))} · ${э(первое(Б.name))}</b><em>${коротко(п.подписи)}</em></span><i class="tail r" aria-hidden="true"></i></div>${щит(Б, true)}</li>`; }).join('');
  return `<div class="hud-v hud-gr hud-gr-arms"><header class="roll"><b>Гербовник</b><small>домов: ${nodes.length}</small></header><div class="gallery">${галерея}</div><ol class="mottos">${девизы}</ol>${кнопкаСвязей(пары.length)}${легенда(edges, пары, поИд).replace(/<div class="hud-gr-legend">[\s\S]*?<\/div>/, '')}</div>`;
}

/** Рассадка: званый ужин сверху. Ковёр с орнаментом, стол тёмного дерева,
 *  скатерть с кружевной каймой и мягким кругом света от свечей; в центре —
 *  подсвечник с тремя свечами в венке из цветов. У каждого места — стул со
 *  спинкой, тарелка с ободком, вилка и нож, салфетка, бокал на ножке и
 *  карточка с именем. Связи — шёлковые ленты через стол, на ленте — подпись
 *  (при большом застолье — у выбранного человека или связи). */
function графРассадка(nodes, edges) {
  const W = 300, H = 280, ЦX = 150, ЦY = 138, pos = раскладка(nodes, ЦX, ЦY, 116, 104), пары = парыГрафа(edges), поИд = Object.fromEntries(nodes.map(n => [n.id, n]));
  const подписи = [];
  const лента = (п) => {
    const А = pos[п.a], Б = pos[п.b]; if (!А || !Б) return '';
    const mx = (А.x + Б.x) / 2, my = (А.y + Б.y) / 2, cx = mx + (ЦX - mx) * .55, cy = my + (ЦY - my) * .55;
    const d = `M${ф(А.x)} ${ф(А.y)}Q${ф(cx)} ${ф(cy)} ${ф(Б.x)} ${ф(Б.y)}`, ат = связьАтр(п.a, п.b);
    // Середина кривой — сюда подпись (HTML поверх рисунка: читается при любом масштабе).
    const sx = .25 * А.x + .5 * cx + .25 * Б.x, sy = .25 * А.y + .5 * cy + .25 * Б.y;
    подписи.push(`<span class="rl g-${п.группа}"${ат} style="left:${ф(sx / W * 100)}%;top:${ф(sy / H * 100)}%">${коротко(п.подписи)}</span>`);
    return `<path class="ribbon-sh"${ат} d="${d}"/><path class="ribbon g-${п.группа}"${ат} d="${d}"/><path class="hit g-${п.группа}"${ат} d="${d}"/>`;
  };
  const место = (nd) => {
    const { x, y } = pos[nd.id], уг = Math.atan2(y - ЦY, x - ЦX), a = уг * 180 / Math.PI;
    const класс = nd.isUser ? ' is-user' : nd.isPrimary ? ' is-primary' : '';
    const ш = Math.max(52, Math.min(92, первое(nd.name).length * 6 + 12));
    const px = x + (ЦX - x) * .27, py = y + (ЦY - y) * .27;
    const tx = -Math.sin(уг), ty = Math.cos(уг), rx = Math.cos(уг), ry = Math.sin(уг);
    // Вилка слева, нож справа (по касательной к столу), прибор — вдоль радиуса.
    const прибор = (сдвиг, cls) => { const bx = px + tx * сдвиг, by = py + ty * сдвиг; return `<path class="${cls}" d="M${ф(bx + rx * 5)} ${ф(by + ry * 5)}L${ф(bx - rx * 5)} ${ф(by - ry * 5)}"/>`; };
    const gx = px - rx * 10 + tx * 9, gy = py - ry * 10 + ty * 9;
    const sx = px + tx * -15 + rx * 1, sy = py + ty * -15 + ry * 1;
    return `<g class="seat${класс}"${человекАтр(nd.id)}>`
      + `<g transform="rotate(${ф(a + 90)} ${ф(x)} ${ф(y)})"><path class="chair-back" d="M${ф(x - 15)} ${ф(y + 6)}c0 8 30 8 30 0"/><rect class="chair" x="${ф(x - 13)}" y="${ф(y - 9)}" width="26" height="17" rx="6"/></g>`
      + `<path class="napkin" d="M${ф(sx)} ${ф(sy)}l${ф(rx * -5 + tx * 3)} ${ф(ry * -5 + ty * 3)}l${ф(rx * 9)} ${ф(ry * 9)}z"/>`
      + прибор(-11.5, 'fork') + прибор(11.5, 'knife')
      + `<circle class="plate" cx="${ф(px)}" cy="${ф(py)}" r="8"/><circle class="plate-in" cx="${ф(px)}" cy="${ф(py)}" r="5.2"/>`
      + `<circle class="glass" cx="${ф(gx)}" cy="${ф(gy)}" r="3.2"/><circle class="wine" cx="${ф(gx)}" cy="${ф(gy)}" r="1.8"/>`
      + `<rect class="card" x="${ф(x - ш / 2)}" y="${ф(y + 8)}" width="${ф(ш)}" height="14" rx="2"/><rect class="card-gold" x="${ф(x - ш / 2 + 2)}" y="${ф(y + 10)}" width="${ф(ш - 4)}" height="10" rx="1"/><text class="nm" data-i18n-skip x="${ф(x)}" y="${ф(y + 18)}">${э(первое(nd.name))}</text></g>`;
  };
  // Венок у подсвечника: цветы по кругу, между ними листья.
  const венок = Array.from({ length: 10 }, (_, k) => { const у = k / 10 * Math.PI * 2, fx = ЦX + Math.cos(у) * 21, fy = ЦY + 2 + Math.sin(у) * 9;
    return k % 2 ? `<ellipse class="leaf" cx="${ф(fx)}" cy="${ф(fy)}" rx="3.6" ry="1.6" transform="rotate(${ф(у * 180 / Math.PI + 90)} ${ф(fx)} ${ф(fy)})"/>` : `<g class="bloom b${k % 3}"><circle cx="${ф(fx)}" cy="${ф(fy)}" r="3.2"/><circle class="mid" cx="${ф(fx)}" cy="${ф(fy)}" r="1.1"/></g>`; }).join('');
  const ряды = пары.map(лента).join('');
  return `<div class="hud-v hud-gr hud-gr-table${пары.length > 8 ? ' is-crowded' : ''}"><div class="room-wrap"><svg class="room" viewBox="0 0 ${W} ${H}" role="img" aria-label="Рассадка за столом">`
    + `<ellipse class="rug" cx="${ЦX}" cy="140" rx="146" ry="134"/><ellipse class="rug-in" cx="${ЦX}" cy="140" rx="136" ry="124"/><ellipse class="rug-orn" cx="${ЦX}" cy="140" rx="128" ry="116"/>`
    + `<ellipse class="tbl-sh" cx="${ЦX}" cy="146" rx="82" ry="66"/><ellipse class="tbl-edge" cx="${ЦX}" cy="142" rx="79" ry="65"/><ellipse class="grain" cx="${ЦX}" cy="142" rx="74" ry="60"/>`
    + `<ellipse class="lace" cx="${ЦX}" cy="${ЦY}" rx="77" ry="63"/><ellipse class="cloth" cx="${ЦX}" cy="${ЦY}" rx="75" ry="61"/><ellipse class="hem" cx="${ЦX}" cy="${ЦY}" rx="69" ry="55"/><ellipse class="glow" cx="${ЦX}" cy="${ЦY - 6}" rx="58" ry="44"/>`
    + ряды
    + `<g class="candles"><ellipse class="halo" cx="${ЦX}" cy="128" rx="34" ry="26"/>${венок}<ellipse class="base" cx="${ЦX}" cy="140" rx="16" ry="5"/><ellipse class="base-top" cx="${ЦX}" cy="138.6" rx="12" ry="3"/>${[-11, 0, 11].map((dx, k) => `<rect x="${147 + dx}" y="${124 - (k === 1 ? 7 : 0)}" width="6" height="${16 + (k === 1 ? 7 : 0)}" rx="1"/><path class="drip" d="M${148 + dx} ${126 - (k === 1 ? 7 : 0)}v4"/><path class="fl" style="--k:${k}" d="M${ЦX + dx} ${116 - (k === 1 ? 7 : 0)}c2.4 3.4 3.4 5.6 0 8-3.4-2.4-2.4-4.6 0-8z"/>`).join('')}</g>`
    + nodes.map(место).join('') + `</svg>${подписи.join('')}</div>${пары.length > 1 ? '<p class="gr-hint">Нажмите на гостя или ленту — появятся подписи связей</p>' : ''}${легенда(edges, пары, поИд)}</div>`;
}

/** Гобелен: люди — нити основы на ткацком станке (имя — на катушке сверху),
 *  каждая связь — тканая полоса своего цвета между двумя нитями, с узлами
 *  на концах и подписью по полосе; внизу бахрома. */
function графГобелен(nodes, edges) {
  const люди = порядокЛюдей(nodes), индекс = Object.fromEntries(люди.map((n, i) => [n.id, i])), поИд = Object.fromEntries(nodes.map(n => [n.id, n]));
  const пары = парыГрафа(edges).sort((a, b) => Math.abs(индекс[a.a] - индекс[a.b]) - Math.abs(индекс[b.a] - индекс[b.b]));
  const n = люди.length;
  const ряды = пары.map((п, i) => { const a = Math.min(индекс[п.a], индекс[п.b]), b = Math.max(индекс[п.a], индекс[п.b]);
    const центр = (a + b + 1) / 2 / n * 100;
    return `<div class="weft g-${п.группа}${лишняя(i, пары.length)}"${связьАтр(п.a, п.b)} title="${э(п.подписи.map(e => e.label).join(' · '))}" style="grid-column:${a + 1} / ${b + 2};grid-row:${i + 1};--s:${b - a + 1};--i:${i}"><i class="knot l" aria-hidden="true"></i><i class="knot r" aria-hidden="true"></i></div>`
      + `<span class="wl g-${п.группа}${лишняя(i, пары.length)}"${связьАтр(п.a, п.b)} style="grid-row:${i + 1};--x:${ф(центр)}%">${коротко(п.подписи)}</span>`; }).join('');
  return `<div class="hud-v hud-gr hud-gr-loom${n >= 7 ? ' is-many' : ''}" style="--n:${n}"><div class="beam" aria-hidden="true"></div>`
    + `<div class="spools">${люди.map(nd => `<span class="spool${nd.isUser ? ' is-user' : nd.isPrimary ? ' is-primary' : ''}"${человекАтр(nd.id)} title="${э(имя(nd.name))}"><i aria-hidden="true"></i><b data-i18n-skip><span class="full">${э(первое(nd.name))}</span><span class="ini">${э(инициалыИмени(имя(nd.name), 2))}</span></b></span>`).join('')}</div>`
    + `<div class="cloth">${ряды}</div><div class="fringe" aria-hidden="true"></div>${кнопкаСвязей(пары.length)}${легенда(edges, пары, поИд)}</div>`;
}

/** Матрица (минимализм): имена по краям таблицы, на пересечении — точка
 *  цвета связи; нажатие или наведение показывает подпись. Ниже — легенда и
 *  все связи списком, как у прежнего графа. */
function графМатрица(nodes, edges) {
  const люди = порядокЛюдей(nodes), поИд = Object.fromEntries(nodes.map(n => [n.id, n]));
  const пары = парыГрафа(edges), пара = (a, b) => пары.find(п => (п.a === a && п.b === b) || (п.a === b && п.b === a));
  const кор = (n) => инициалыИмени(имя(n.name), 2);
  const шапка = `<tr><th></th>${люди.map(n => `<th scope="col" class="${n.isUser ? 'is-user' : n.isPrimary ? 'is-primary' : ''}"${человекАтр(n.id)} title="${э(имя(n.name))}"><span data-i18n-skip>${э(кор(n))}</span></th>`).join('')}</tr>`;
  const строки = люди.map((r, i) => `<tr><th scope="row" class="${r.isUser ? 'is-user' : r.isPrimary ? 'is-primary' : ''}"${человекАтр(r.id)}><span data-i18n-skip>${э(первое(r.name))}</span></th>`
    + люди.map((c, j) => { if (i === j) return '<td class="self"></td>'; const п = пара(r.id, c.id); if (!п) return '<td></td>';
      const подпись = п.подписи.map(e => `${первое(поИд[e.from]?.name)} → ${первое(поИд[e.to]?.name)}: ${e.label || ''}`).join('; ');
      return `<td class="g-${п.группа}"${связьАтр(п.a, п.b)} title="${э(подпись)}"><i aria-label="${э(подпись)}"></i></td>`; }).join('') + `</tr>`).join('');
  const связиСписком = легенда(edges, пары, поИд);
  return `<div class="hud-v hud-gr hud-gr-matrix" style="--n:${люди.length}"><div class="grid"><table><colgroup><col class="c-name"></colgroup>${шапка}${строки}</table></div>${edges.length <= 10 ? связиСписком.replace('<details class="hud-gr-pairs">', '<details class="hud-gr-pairs" open>') : связиСписком}</div>`;
}

export function видГрафа(данные, вид) {
  const nodes = (данные && данные.nodes) || [], edges = (данные && данные.edges) || [];
  if (nodes.length < 2 || !edges.length) return '';
  const узлы = nodes.filter(n => edges.some(e => e.from === n.id || e.to === n.id));
  if (вид === 'heraldry') return графГербы(узлы, edges);
  if (вид === 'table') return графРассадка(узлы, edges);
  if (вид === 'loom') return графГобелен(узлы, edges);
  if (вид === 'matrix') return графМатрица(узлы, edges);
  return '';
}

// ============================================================================
// ГЕНЕАЛОГИЧЕСКОЕ ДЕРЕВО — данные из render/family-tree.js (buildFamilyTree →
// данные): люди с местом в прежнем дереве, браки, семьи (родители → дети),
// ветки (несвязанные семьи) и корни (супруги вместе, дети ниже). Рисуется во
// вкладке «Семья» графа отношений. Подсветка родни — та же, что у видов
// графа (events.js, фокусВидаГрафа): data-gn у человека, data-ga/gb у родства.
// ============================================================================

const РИМ = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** Общее для обоих видов: кто есть, кто с кем в браке, список родства. */
function разборДрева(д) {
  const поИд = new Map((д.люди || []).map(ч => [ч.id, ч]));
  const брак = new Map();
  for (const б of д.браки || []) { if (поИд.has(б.a) && поИд.has(б.b)) брак.set([б.a, б.b].sort().join('|'), б); }
  const имяЧ = (ч) => ч.неизвестно ? 'неизвестно' : первое(ч.имя);
  // Кем ребёнок приходится родителям: из «мать → дочь» — «дочь»; у братьев
  // без родителей — слово как есть («брат-близнец»).
  const кем = new Map();
  for (const с of д.семьи || []) for (const ребёнок of с.дети) {
    const п = String(ребёнок.подпись || '');
    const слово = (п.includes('→') ? п.split('→').pop() : п).trim();
    if (слово && !кем.has(ребёнок.id)) кем.set(ребёнок.id, слово);
  }
  // Родство списком — для строк под рисунком и подсветки по нажатию. У пары
  // «родитель → ребёнок» — только кем приходится ребёнок: подпись «мать →
  // дочь» одна на обоих родителей, и у отца читалась неверно.
  const строки = [];
  for (const с of д.семьи || []) {
    for (const р of с.родители) for (const ребёнок of с.дети) {
      if (!поИд.has(р) || !поИд.has(ребёнок.id)) continue;
      строки.push({ a: р, b: ребёнок.id, г: 'family', кто: `${имяЧ(поИд.get(р))} → ${имяЧ(поИд.get(ребёнок.id))}`, что: кем.get(ребёнок.id) || '' });
    }
    if (!с.родители.length) for (let i = 1; i < с.дети.length; i++) {
      const a = с.дети[0].id, b = с.дети[i].id;
      if (поИд.has(a) && поИд.has(b)) строки.push({ a, b, г: 'family', кто: `${имяЧ(поИд.get(a))} · ${имяЧ(поИд.get(b))}`, что: с.дети[i].подпись || '' });
    }
  }
  for (const б of брак.values()) строки.push({ a: б.a, b: б.b, г: 'love', кто: `${имяЧ(поИд.get(б.a))} ${б.бывший ? '✕' : '⚭'} ${имяЧ(поИд.get(б.b))}`, что: б.слова || '' });
  return { поИд, брак, строки, кем };
}
const ЛЕГЕНДА_ДРЕВА = { family: 'кровное родство', love: 'брак' };
function низДрева(р) {
  const есть = [...new Set(р.строки.map(с => с.г))];
  return `<div class="hud-gr-legend">${есть.map(г => `<span class="g-${г}" data-gg="${г}"><i aria-hidden="true"></i>${ЛЕГЕНДА_ДРЕВА[г]}</span>`).join('')}</div>`
    + `<div class="hud-gr-say" hidden data-i18n-skip></div>`
    + (р.строки.length ? `<details class="hud-gr-pairs"><summary>Всё родство: ${р.строки.length}</summary><ul>${р.строки.map(с => `<li class="g-${с.г}"${связьАтр(с.a, с.b)}><i aria-hidden="true"></i><b data-i18n-skip>${э(с.кто)}</b><span data-i18n-skip>${э(с.что)}</span></li>`).join('')}</ul></details>` : '');
}
// Портрет: фото, если есть, иначе инициалы на цвете человека (как в прежнем дереве).
const портрет = (ч, класс) => `<span class="${класс}" style="--pc:${э(ч.цвет || '#6b5a8a')}" aria-hidden="true">`
  + (ч.адрес ? `<img src="${э(ч.адрес)}" alt="" loading="lazy" decoding="async">` : `<b data-i18n-skip>${э(ч.инициалы || '?')}</b>`) + `</span>`;
const родЧеловека = (ч) => ч.вы ? ' is-user' : ч.герой ? ' is-primary' : ч.неизвестно ? ' is-unknown' : '';
const имяВДреве = (ч) => ч.неизвестно ? '<span>неизвестно</span>' : свои(имя(ч.имя));

/** Крона: живое дерево ночью — от корней с табличкой фамилии вверх: старшие
 *  у корней, младшие в кроне. От родителей к каждому ребёнку растёт своя
 *  ветвь (у старших толще), на ветви — бирка «сын», «дочь»; супругов держит
 *  золотая гирлянда с кольцами, братьев без родителей — лоза над головами.
 *  Люди — портреты-плоды в листве. Всё одним SVG: вписывается в любую
 *  ширину, в большом окне — масштаб. Листья колышутся, светлячки летают. */
let номерКроны = 0;
const кубика = (p0, p1, p2, p3, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };
const обрез = (s, n) => { const т = String(s || ''); return т.length > n ? т.slice(0, n - 1) + '…' : т; };
function древоКрона(д, р) {
  const деревья = (д.ветки || []).map((в, вi) => {
    const люди = в.люди.map(id => р.поИд.get(id)).filter(Boolean);
    if (!люди.length) return '';
    const id = 'hud-ftc-' + (++номерКроны);
    const случай = сид((в.подпись || '') + люди.length, вi);
    const ряды = [...new Set(люди.map(ч => Math.round(ч.y)))].sort((a, b) => a - b);
    const G = ряды.length;
    const xs = люди.map(ч => ч.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const слотов = Math.round((x1 - x0) / 165) + 1;
    const W = Math.max(300, слотов * 104 + 48), РЯД = 166, ВЕРХ = 70;
    const yG = (g) => ВЕРХ + (G - 1 - g) * РЯД + 30;
    const H = yG(0) + 64 + 86;
    const место = new Map(люди.map(ч => {
      const g = ряды.indexOf(Math.round(ч.y));
      return [ч.id, { x: x1 === x0 ? W / 2 : 70 + (ч.x - x0) / (x1 - x0) * (W - 140), y: yG(g), g, ч }];
    }));
    const тол = (g, база, шаг, мин) => Math.max(мин, база - g * шаг).toFixed(1);
    let ветви = '', листья = '', бирки = '', лозы = '', гирлянды = '', листва = '';
    // Листва — мягкие пятна за людьми и развилками.
    for (const м of место.values()) листва += `<circle class="fol" cx="${ф(м.x + (случай() - .5) * 20)}" cy="${ф(м.y - 6)}" r="${ф(52 + случай() * 16)}"/>`;
    const лист = (x, y, a, k) => `<g transform="translate(${ф(x)} ${ф(y)}) rotate(${a.toFixed(0)})"><path class="lf" style="--d:${(-k * .7).toFixed(2)}s" d="M0 0C3-5 10-6 15-2.5C10 1.5 4 2 0 0Z"/><path class="lv" d="M1 0H12"/></g>`;
    // Семьи: ветви от родителей к развилке и от развилки к каждому ребёнку.
    for (const с of д.семьи || []) {
      const дети = с.дети.map(x => место.get(x.id)).filter(Boolean);
      if (!дети.length) continue;
      const роды = с.родители.map(x => место.get(x)).filter(Boolean);
      if (!роды.length) {
        // Братья и сёстры без родителей: лоза над головами.
        const ряд = дети.slice().sort((a, b) => a.x - b.x);
        for (let i = 1; i < ряд.length; i++) {
          const a = ряд[i - 1], b = ряд[i], mx = (a.x + b.x) / 2, top = Math.min(a.y, b.y) - 66;
          лозы += `<path class="vine"${связьАтр(a.ч.id, b.ч.id)} d="M${ф(a.x)} ${ф(a.y - 30)}Q${ф(mx)} ${ф(top)} ${ф(b.x)} ${ф(b.y - 30)}"/>`;
          const слово = р.кем.get(b.ч.id);
          if (слово) бирки += бирка(mx, top + 16, слово, ` data-gn="${э(b.ч.id)}"`, 'is-vine');
        }
        continue;
      }
      const py = Math.min(...роды.map(м => м.y)), g = Math.min(...роды.map(м => м.g));
      const F = [роды.reduce((s, м) => s + м.x, 0) / роды.length, py - 52];
      for (const м of роды) ветви += `<path class="bough" style="stroke-width:${тол(g, 9, 1.6, 4)}"${человекАтр(м.ч.id)} d="M${ф(м.x)} ${ф(м.y - 26)}C${ф(м.x)} ${ф(м.y - 42)} ${ф(F[0])} ${ф(F[1] + 12)} ${ф(F[0])} ${ф(F[1])}"/>`;
      ветви += `<circle class="node" cx="${ф(F[0])}" cy="${ф(F[1])}" r="${тол(g, 5.5, .8, 3)}"/>`;
      дети.forEach((ребёнок, k) => {
        const p0 = F, p1 = [F[0], F[1] - 34], p2 = [ребёнок.x, ребёнок.y + 76], p3 = [ребёнок.x, ребёнок.y + 26];
        ветви += `<path class="bough twig" style="stroke-width:${тол(g, 6, 1.2, 2.4)}"${человекАтр(ребёнок.ч.id)} d="M${ф(p0[0])} ${ф(p0[1])}C${ф(p1[0])} ${ф(p1[1])} ${ф(p2[0])} ${ф(p2[1])} ${ф(p3[0])} ${ф(p3[1])}"/>`;
        for (const [t, сторона] of [[.28, 1], [.62, -1]]) {
          const [x, y] = кубика(p0, p1, p2, p3, t), [xa, ya] = кубика(p0, p1, p2, p3, t + .02);
          const угол = Math.atan2(ya - y, xa - x) * 180 / Math.PI + сторона * (50 + случай() * 20);
          листья += лист(x, y, угол, k * 2 + (t > .5 ? 1 : 0));
        }
        const слово = р.кем.get(ребёнок.ч.id);
        if (слово) { const [x, y] = кубика(p0, p1, p2, p3, .3); бирки += бирка(x, y, слово, ` data-gn="${э(ребёнок.ч.id)}"`, ''); }
      });
    }
    // Ствол: от корней к старшим (к паре — в середину).
    const основа = [W / 2, H - 50];
    const старшие = [...место.values()].filter(м => м.g === 0).sort((a, b) => a.x - b.x);
    const группы = [];
    for (const м of старшие) { const п = группы[группы.length - 1]; if (п && р.брак.has([п[п.length - 1].ч.id, м.ч.id].sort().join('|'))) п.push(м); else группы.push([м]); }
    let ствол = '';
    for (const гр of группы) {
      const gx = гр.reduce((s, м) => s + м.x, 0) / гр.length, gy = гр[0].y;
      const d = `M${ф(основа[0])} ${ф(основа[1])}C${ф(основа[0])} ${ф(основа[1] - 40)} ${ф(gx)} ${ф(gy + 86)} ${ф(gx)} ${ф(gy + 24)}`;
      ствол += `<path class="trunk" d="${d}"/><path class="trunk-hi" d="${d}"/>`;
    }
    const корни = [-1, 1].flatMap(с => [[34, 16], [70, 26], [112, 20]].map(([dx, dy]) => `<path class="root" d="M${ф(основа[0])} ${ф(основа[1] - 4)}C${ф(основа[0] + с * dx * .3)} ${ф(основа[1] + 6)} ${ф(основа[0] + с * dx * .7)} ${ф(основа[1] + dy * .6)} ${ф(основа[0] + с * dx)} ${ф(основа[1] + dy)}"/>`)).join('');
    // Супруги: гирлянда и кольца в её нижней точке.
    for (const б of р.брак.values()) {
      const a = место.get(б.a), b = место.get(б.b);
      if (!a || !b) continue;
      const [л, п] = a.x <= b.x ? [a, b] : [b, a];
      const mx = (л.x + п.x) / 2, my = Math.max(л.y, п.y) + 10;
      гирлянды += `<path class="vow${б.бывший ? ' is-ex' : ''}"${связьАтр(б.a, б.b)} d="M${ф(л.x + 25)} ${ф(л.y + 2)}Q${ф(mx)} ${ф(my + 14)} ${ф(п.x - 25)} ${ф(п.y + 2)}"/>`
        + `<g class="knot${б.бывший ? ' is-ex' : ''}"${связьАтр(б.a, б.b)} transform="translate(${ф(mx)} ${ф(my + 6)})"><title>${э(б.слова || (б.бывший ? 'бывшие супруги' : 'супруги'))}</title><circle class="kb" r="10"/><circle cx="-3" r="4.6"/><circle cx="3" r="4.6"/>${б.бывший ? '<path d="M-7 6 7-6"/>' : ''}</g>`;
    }
    // Плоды — сверху вниз: младшие первыми.
    const плоды = [...место.values()].sort((a, b) => a.y - b.y || a.x - b.x).map((м, i) => {
      const ч = м.ч, нм = ч.неизвестно ? 'неизвестно' : обрез(имя(ч.имя), 15), роль = обрез(ч.роль, 20);
      const ш = Math.max(нм.length * 6.6, роль.length * 5.2) + 18;
      const клип = `${id}-p${i}`;
      return `<g class="fruit${родЧеловека(ч)}"${человекАтр(ч.id)} transform="translate(${ф(м.x)} ${ф(м.y)})"><g class="sway" style="--sw:${(случай() * 2.4 + 3.4).toFixed(2)}s;--d:${(-случай() * 3).toFixed(2)}s">`
        + `<title${ч.неизвестно ? '' : ' data-i18n-skip'}>${э(ч.неизвестно ? 'неизвестно' : имя(ч.имя))}</title><circle class="halo" r="33"/>`
        + `<path class="crest" d="M-1-25C-6-33-15-33-18-28-12-24-6-23-1-25ZM1-25C6-34 15-34 19-29 13-24 6-23 1-25Z"/>`
        + `<circle class="rim" r="26"/><circle class="bg" r="22.5" style="fill:${э(ч.цвет || '#6b5a8a')}"/>`
        + (ч.адрес ? `<clipPath id="${клип}"><circle r="22.5"/></clipPath><image href="${э(ч.адрес)}" x="-22.5" y="-22.5" width="45" height="45" clip-path="url(#${клип})" preserveAspectRatio="xMidYMid slice"/>` : `<text class="ini" data-i18n-skip y="5">${э(ч.инициалы || '?')}</text>`)
        // Блик — только на кружке с инициалами: на фото он ложился пятном.
        + (ч.адрес ? '' : `<path class="gloss" d="M-14-9A16 16 0 0 1-3-17"/>`)
        + `<rect class="plate" x="${ф(-ш / 2)}" y="31" width="${ф(ш)}" height="${роль ? 32 : 20}" rx="7"/>`
        + `<text class="nm" y="45"${ч.неизвестно ? '' : ' data-i18n-skip'}>${э(нм)}</text>${роль ? `<text class="rl" data-i18n-skip y="57">${э(роль)}</text>` : ''}</g></g>`;
    }).join('');
    const звёзды = Array.from({ length: 14 }, (_, k) => `<circle class="star" style="--d:${(-случай() * 4).toFixed(2)}s" cx="${ф(случай() * W)}" cy="${ф(случай() * H * .45)}" r="${(случай() * 1 + .5).toFixed(2)}"/>`).join('');
    const светлячки = Array.from({ length: 7 }, (_, k) => `<circle class="fly" style="--d:${(-k * 1.3).toFixed(1)}s;--fx:${ф((случай() - .5) * 40)}px;--fy:${ф(-10 - случай() * 30)}px" cx="${ф(30 + случай() * (W - 60))}" cy="${ф(40 + случай() * (H - 140))}" r="1.8"/>`).join('');
    const табличка = в.подпись ? `<g class="plaque" transform="translate(${ф(W / 2)} ${ф(H - 20)})"><rect x="-${ф(в.подпись.length * 4.4 + 22)}" y="-13" width="${ф(в.подпись.length * 8.8 + 44)}" height="26" rx="5"/><path class="nail" d="M-${ф(в.подпись.length * 4.4 + 14)} 0h.1M${ф(в.подпись.length * 4.4 + 14)} 0h.1"/><text data-i18n-skip y="4.5">${э(в.подпись)}</text></g>` : '';
    return `<svg class="grove" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Семейное древо"><defs><radialGradient id="${id}-f"><stop offset="0" class="f0"/><stop offset=".65" class="f1"/><stop offset="1" class="f2"/></radialGradient><linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></linearGradient></defs>`
      + `<rect class="sky" width="${W}" height="${H}" rx="12" style="fill:url(#${id}-s)"/>${звёзды}<circle class="moon" cx="${ф(W - 40)}" cy="34" r="15"/><circle class="moon-cut" cx="${ф(W - 33)}" cy="30" r="13"/>`
      + `<g style="fill:url(#${id}-f)">${листва}</g><path class="ground" d="M0 ${ф(H - 44)}Q${ф(W * .25)} ${ф(H - 56)} ${ф(W / 2)} ${ф(H - 50)}T${W} ${ф(H - 46)}V${H}H0Z"/>`
      + `${корни}${ствол}${ветви}${лозы}${листья}${гирлянды}${бирки}${плоды}${светлячки}${табличка}</svg>`;
  }).join('');
  return `<div class="hud-v hud-gr hud-ft hud-ft-crown"><header class="roll"><b>Семейное древо</b><small>в древе: ${(д.люди || []).length}</small></header>${деревья}${низДрева(р)}</div>`;
}
// Бирка на ветви: кем ребёнок приходится родителям.
function бирка(x, y, слово, атр, класс) {
  const т = обрез(слово, 18), ш = т.length * 5.4 + 14;
  return `<g class="kin ${класс}"${атр} transform="translate(${ф(x)} ${ф(y)})"><rect x="${ф(-ш / 2)}" y="-8" width="${ф(ш)}" height="16" rx="8"/><text y="3.4">${э(т)}</text></g>`;
}

/** Родословная книга: фолиант в коже с золотым тиснением и закладкой —
 *  роспись рода, как в старых гербовниках. Род открывается буквицей, колено —
 *  восковая печать с римской цифрой на полях; супруги — одной строкой через
 *  ⚭, дети — под ними, к каждому от родителей ведёт золотая скоба, а над
 *  именем ребёнка красной рубрикой — кто он им: «сын», «дочь». */
function древоКнига(д, р) {
  const человек = (ч) => {
    const кем = р.кем.get(ч.id);
    return `<span class="who${родЧеловека(ч)}"${человекАтр(ч.id)}>${портрет(ч, 'dot')}<span class="nm">${кем ? `<i class="kin">${э(кем)}</i>` : ''}<b>${имяВДреве(ч)}</b>${ч.роль ? `<small data-i18n-skip>${э(ч.роль)}</small>` : ''}</span></span>`;
  };
  const строка = (ид, сватья) => {
    const члены = ид.map(id => р.поИд.get(id)).filter(Boolean);
    const люди = члены.map((ч, k) => {
      const б = k ? р.брак.get([члены[k - 1].id, ч.id].sort().join('|')) : null;
      return (k ? `<span class="ring${б && б.бывший ? ' is-ex' : ''}"${б ? связьАтр(б.a, б.b) : ''}${б && б.слова ? ` title="${э(б.слова)}" data-i18n-skip` : ''}>${б && б.бывший ? '✕' : '⚭'}</span>` : '') + человек(ч);
    }).join('');
    const сваты = (сватья || []).map(id => р.поИд.get(id)).filter(Boolean);
    return люди + (сваты.length ? `<span class="inlaws"><em>сваты</em>${сваты.map(человек).join('<span class="ring">⚭</span>')}</span>` : '');
  };
  const колено = (блоки, глубина) => блоки.map(б => {
    const тут = б.члены.length ? `<div class="entry"><span class="gen" aria-hidden="true">${РИМ[глубина] || глубина + 1}</span><div class="line">${строка(б.члены, б.сватья)}</div></div>` : '';
    const ниже = б.дети.length ? `<ol class="kids">${колено(б.дети, б.члены.length ? глубина + 1 : глубина)}</ol>` : '';
    return `<li${б.члены.length > 1 ? ' class="is-pair"' : ''}>${тут}${ниже}</li>`;
  }).join('');
  // Корни раскладываем по веткам: у каждой — буквица и фамилия.
  const веткаЧеловека = new Map();
  (д.ветки || []).forEach((в, i) => в.люди.forEach(id => веткаЧеловека.set(id, i)));
  const первыйВ = (б) => б.члены[0] || (б.дети[0] ? первыйВ(б.дети[0]) : '');
  const поВеткам = new Map();
  for (const б of д.корни || []) { const i = веткаЧеловека.has(первыйВ(б)) ? веткаЧеловека.get(первыйВ(б)) : -1; if (!поВеткам.has(i)) поВеткам.set(i, []); поВеткам.get(i).push(б); }
  const завиток = '<svg class="flourish" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6C20 6 26 1 36 1s12 10 24 10 14-10 24-10 16 5 34 5"/><circle cx="60" cy="6" r="2.2"/></svg>';
  const главы = [...поВеткам].sort((a, b) => a[0] - b[0]).map(([i, блоки]) => {
    const подпись = ((д.ветки || [])[i] || {}).подпись;
    const буква = подпись ? (имя(подпись).match(/\p{L}/u) || [''])[0].toUpperCase() : '';
    return `<section class="house">${подпись ? `<h4>${буква ? `<span class="ini" aria-hidden="true" data-i18n-skip>${э(буква)}</span>` : ''}<span class="ttl"><b>${свои(подпись)}</b>${завиток}</span></h4>` : ''}<ol class="kin">${колено(блоки, 0)}</ol></section>`;
  }).join('');
  return `<div class="hud-v hud-gr hud-ft hud-ft-book"><div class="folio"><i class="corner tl" aria-hidden="true"></i><i class="corner tr" aria-hidden="true"></i><i class="corner bl" aria-hidden="true"></i><i class="corner br" aria-hidden="true"></i><i class="ribbon" aria-hidden="true"></i>`
    + `<header class="roll"><svg class="quill" viewBox="0 0 24 24" aria-hidden="true"><path class="feather" d="M20 3C12 4 7 9 5 17l2 1c1-3 3-5 5-6-1 2-2 3-4 5l1 1c6-3 10-8 11-15Z"/><path class="vane" d="M19 4 7 16"/><path class="nib" d="M5 17 3 21"/></svg><b>Родословная книга</b><small>в древе: ${(д.люди || []).length}</small></header>${главы}</div>${низДрева(р)}</div>`;
}

/** Вид генеалогического дерева; '' — нечего рисовать (тогда прежнее дерево). */
export function видДрева(данные, вид) {
  if (!данные || !Array.isArray(данные.люди) || !данные.люди.length) return '';
  const р = разборДрева(данные);
  if (вид === 'crown') return древоКрона(данные, р);
  if (вид === 'book') return древоКнига(данные, р);
  return '';
}

// ============================================================================
// БОЙ — разбор из combat.js (разборБоя): этап, участники, очередь, раны,
// оружие, адреналин, выдержка, погоня, укрытия
// ============================================================================

const ЗДОРОВЬЕ = { ok: 100, hurt: 55, stun: 30, out: 0 };
const СТОРОНА = { ally: 'свой', enemy: 'враг', neutral: 'нейтрал' };
const ДИСТ = { close: 'вплотную', step: 'шаг', room: 'через комнату', far: 'далеко' };
const ВЫДЕРЖКА_СЛОВО = ['действует', 'дрожит', 'замер', 'паникует', 'бежит'];
function бойцы(б) {
  const тот = (a, c) => a && c && namesLikelySame(первое(a), первое(c));
  return б.участники.map(п => ({
    ...п, hp: ЗДОРОВЬЕ[п.состояние] ?? 100,
    ад: (б.адреналин.find(а => тот(а.имя, п.имя)) || {}).уровень ?? null,
    нерв: (б.выдержка.find(н => тот(н.имя, п.имя)) || {}).ступень ?? null,
    ран: б.раны.filter(р => тот(р.кто, п.имя)).length,
    ствол: (б.оружие.find(о => тот(о.кто, п.имя)) || {}).что || п.вРуках || '',
    ходит: !!б.очередь.length && тот(б.очередь[0], п.имя),
  }));
}
const подписьЭтапа = (б) => б.этап ? б.этап[2] : 'бой';
// Погоня: полоса «догнали — оторвались», если названа дистанция; куда, что мешает
// и что случилось — строкой и без дистанции (в «Кольцах» это свой раздел).
const погоняПолоса = (б, класс) => {
  const п = б.погоня; if (!п) return '';
  const текст = [п.куда ? `<span>Куда</span>: <span data-i18n-skip>${э(п.куда)}</span>` : '', п.мешает ? `мешает: <span data-i18n-skip>${э(п.мешает)}</span>` : '', п.событие ? `<span data-i18n-skip>${э(п.событие)}</span>` : ''].filter(Boolean).join(' · ');
  if (п.дистанция === null && !текст) return '';
  return `<div class="${класс}${п.дистанция === null ? ' is-text' : ''}">` + (п.дистанция !== null ? `<small>догнали</small><span><i style="left:${п.дистанция}%"></i></span><small>оторвались</small>` : '') + (текст ? `<p>${текст}</p>` : '') + `</div>`;
};

/** Файтинг: экран «VS» на арене — металлический баннер раунда, таймер,
 *  портреты в скошенных рамках; у каждого полоса здоровья (по состоянию) со
 *  следом урона, шкала «супер» (адреналин), выдержка, оружие, засечки ран;
 *  выбывший — «K.O.»; внизу очередь комбо и погоня. */
function бойФайтинг(б) {
  const бб = бойцы(б);
  const таймер = String(99 - (б.очередь.length * 7) % 60).padStart(2, '0');
  const боец = (п) => `<div class="ftr st-${п.состояние}${п.ходит ? ' is-turn' : ''}"><span class="frame">${лицо(п.имя)}${п.состояние === 'out' ? '<i class="ko" aria-hidden="true">K.O.</i>' : ''}</span><div class="info"><b data-i18n-skip>${э(первое(п.имя))}</b>`
    + `<span class="hp" aria-label="Здоровье"><i class="lag" style="--bv:${Math.min(100, п.hp + 18)}%"></i><i style="--bv:${п.hp}%"></i></span>`
    + (п.ад !== null ? `<span class="sp${п.ад >= 70 ? ' is-super' : ''}" aria-label="Адреналин"><i style="--bv:${п.ад}%"></i>${п.ад >= 70 ? '<em>SUPER</em>' : ''}</span>` : '')
    + `<small><span>${ДИСТ[п.дист]}</span>${п.ствол ? ` · <span data-i18n-skip>${э(п.ствол)}</span>` : ''}${п.нерв !== null ? ` · <span>${ВЫДЕРЖКА_СЛОВО[п.нерв]}</span>` : ''}</small>`
    + (п.ран ? `<em class="hits" aria-label="Ран: ${п.ран}">${'<i></i>'.repeat(Math.min(5, п.ран))}</em>` : '') + `<em class="st">${п.состояниеСлово}</em></div></div>`;
  const стор = (с) => бб.filter(п => п.сторона === с).map(боец).join('');
  return `<div class="hud-v hud-bt hud-bt-fight${б.этап ? ' is-' + б.этап[0] : ''}"><i class="floor" aria-hidden="true"></i><header class="top"><span class="round"><small>раунд</small><b>${подписьЭтапа(б)}</b></span><span class="timer" aria-hidden="true">${таймер}</span>`
    + (б.очередь.length ? `<span class="turn"><small>ход</small><b data-i18n-skip>${э(первое(б.очередь[0]))}</b></span>` : '<span></span>') + `</header>`
    + `<div class="arena"><div class="side ally">${стор('ally') || '<i class="none">—</i>'}</div><b class="vs" aria-hidden="true"><span>V</span><span>S</span></b><div class="side enemy">${стор('enemy') || '<i class="none">—</i>'}</div></div>`
    + (бб.some(п => п.сторона === 'neutral') ? `<div class="side neutral">${стор('neutral')}</div>` : '')
    + (б.очередь.length > 1 ? `<div class="combo"><small>комбо</small>${б.очередь.map((к, i) => `<span class="${i ? '' : 'is-now'}" data-i18n-skip>${э(первое(к))}</span>`).join('<i aria-hidden="true">▸</i>')}</div>` : '')
    + погоняПолоса(б, 'race') + (б.укрытия.length ? `<div class="props">${б.укрытия.map(у => `<span title="${э(у.как)}" data-i18n-skip>${э(у.что)}</span>`).join('')}</div>` : '') + `</div>`;
}

/** Тактический планшет: защищённый экран операции — поле в клетку с
 *  координатами, свои слева, враги справа (ближе к линии — ближе к бою),
 *  укрытия в штриховке, у ходящего — кольца досягаемости и метка; роза
 *  сторон света в углу. Под полем — сводка отряда. */
function бойПланшет(б) {
  const бб = бойцы(б), W = 300, H = 190;
  const X = { ally: { close: 128, step: 100, room: 66, far: 32 }, enemy: { close: 172, step: 200, room: 234, far: 268 } };
  const счёт = { ally: {}, enemy: {}, neutral: 0 };
  const жетоны = бб.map(п => {
    let x, y;
    if (п.сторона === 'neutral') { x = 150; y = H - 34 - (счёт.neutral++) * 34; }
    else { const к = счёт[п.сторона][п.дист] = (счёт[п.сторона][п.дист] || 0) + 1; x = X[п.сторона][п.дист]; y = 42 + ((к - 1) % 4) * 34 + (п.дист === 'step' || п.дист === 'far' ? 16 : 0); }
    const знак = п.сторона === 'ally' ? `<path class="mk" d="M${x - 4} ${y - 1}l4 4 5-7"/>` : п.сторона === 'enemy' ? `<path class="mk" d="M${x - 4} ${y - 4}l8 8m0-8l-8 8"/>` : '';
    return `<g class="tok s-${п.сторона} st-${п.состояние}${п.ходит ? ' is-turn' : ''}">${п.ходит ? `<circle class="range" cx="${x}" cy="${y}" r="34"/><circle class="range" cx="${x}" cy="${y}" r="22"/><circle class="ping" cx="${x}" cy="${y}" r="14"/>` : ''}`
      + `<circle class="disc" cx="${x}" cy="${y}" r="11"/>${знак}<text data-i18n-skip x="${x}" y="${y + 22}">${э(первое(п.имя).slice(0, 12))}</text>${п.ран ? `<circle class="wd" cx="${x + 8}" cy="${y - 8}" r="3.4"/>` : ''}${п.состояние === 'out' ? `<path class="ko" d="M${x - 9} ${y - 9}l18 18m0-18l-18 18"/>` : ''}</g>`;
  }).join('');
  const r = сид(б.укрытия.map(у => у.что).join('|'));
  const укрытия = б.укрытия.slice(0, 4).map((у, i) => `<g class="cover"><rect x="${ф(138 + (r() - .5) * 16)}" y="${24 + i * 40}" width="24" height="${ф(12 + r() * 12)}" rx="2"/><title>${э(у.что)}</title></g>`).join('');
  const клетки = `<path class="grid" d="${Array.from({ length: 16 }, (_, i) => `M${i * 20} 0V${H}`).join('')}${Array.from({ length: 10 }, (_, i) => `M0 ${i * 20}H${W}`).join('')}"/>`;
  const подписи = 'ABCDEFGHIJKLMNO'.split('').map((л, i) => `<text class="crd" x="${i * 20 + 10}" y="9">${л}</text>`).join('') + Array.from({ length: 9 }, (_, i) => `<text class="crd" x="4" y="${i * 20 + 24}">${i + 1}</text>`).join('');
  const сводка = бб.map(п => `<li class="s-${п.сторона} st-${п.состояние}"><b data-i18n-skip>${э(первое(п.имя))}</b><span><span>${СТОРОНА[п.сторона]}</span> · <span>${ДИСТ[п.дист]}</span></span>${п.ствол ? `<small data-i18n-skip>${э(п.ствол)}</small>` : ''}`
    + (п.ад !== null ? `<i class="ad" style="--bv:${п.ад}%" aria-label="Адреналин"></i>` : '') + `<em><span>${п.состояниеСлово}</span>${п.нерв !== null ? ` · <span>${ВЫДЕРЖКА_СЛОВО[п.нерв]}</span>` : ''}</em></li>`).join('');
  return `<div class="hud-v hud-bt hud-bt-tac${б.этап ? ' is-' + б.этап[0] : ''}"><div class="bar"><span><i class="led"></i>${подписьЭтапа(б)}</span><span class="op">// <span>операция</span></span>${б.очередь.length ? `<span><span>ход</span>: <b data-i18n-skip>${э(первое(б.очередь[0]))}</b></span>` : ''}</div>`
    + `<svg class="field" viewBox="0 0 ${W} ${H}" role="img" aria-label="Тактическая схема"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="currentColor" stroke-width="2"/></pattern></defs>`
    + `<rect class="bg" width="${W}" height="${H}" rx="8"/>${клетки}${подписи}<path class="mid" d="M150 12V${H - 6}"/>${укрытия}${жетоны}`
    + `<g class="compass" transform="translate(${W - 22} ${H - 22})"><circle r="12"/><path d="M0-10 3 0H-3Z" class="cn"/><path d="M0 10 3 0H-3Z"/><text y="-13">N</text></g>`
    + `<text class="lbl" x="22" y="${H - 8}">свои</text><text class="lbl r" x="${W - 40}" y="${H - 8}">враги</text></svg>`
    + погоняПолоса(б, 'chase') + (б.укрытия.length ? `<p class="covers"><b>укрытия</b>: ${б.укрытия.map(у => свои(у.что)).join(', ')}</p>` : '') + `<ul class="roster">${сводка}</ul></div>`;
}

// Фигуры: силуэты в клетке 20×20.
const ФИГУРЫ = {
  king: 'M9.2 2h1.6v1.6h1.6v1.6h-1.6V7H9.2V5.2H7.6V3.6h1.6ZM6.5 13.5C5 10 7 8 10 8s5 2 3.5 5.5ZM5.5 17h9v-2.6h-9Z',
  queen: 'M4.5 7.5 6.6 13h6.8l2.1-5.5-3 2.6L10 5l-2.5 5.1ZM5.5 17h9v-2.6h-9Z',
  rook: 'M5.5 4.5h2v2h1.5v-2h2v2h1.5v-2h2V8l-1.5 1.2v4.3h1.5V17h-9v-3.5h1.5V9.2L5.5 8Z',
  bishop: 'M10 2.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM7.2 13.5C6 10 8.3 7 10 6c1.7 1 4 4 2.8 7.5ZM5.5 17h9v-2.6h-9Z',
  knight: 'M6 17h8.5v-2.4C14.5 9 13 5.6 9.4 4L8 5.4 5.6 9l2.2.8-1 3.3Z',
  pawn: 'M10 4.2a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2ZM7.4 14.6l1-4h3.2l1 4ZM5.5 17h9v-2.4h-9Z',
};
const ЗАСТАВА = ['queen', 'rook', 'bishop', 'knight', 'pawn', 'pawn', 'pawn'];
/** Шахматная партия: доска в резной раме с инкрустацией, свои — светлые
 *  фигуры снизу, враги — тёмные сверху; ряд — дистанция. Игрок и вожак
 *  врагов — короли. Выбывшие лежат «взятыми» на бархате, раненые помечены,
 *  оглушённые накренились. Сбоку — шахматные часы, внизу — запись ходов. */
function бойШахматы(б) {
  const бб = бойцы(б);
  const игрок = (() => { try { return getSafeUserName(); } catch (_) { return ''; } })();
  const РЯД = { ally: { close: 4, step: 5, room: 6, far: 7 }, enemy: { close: 3, step: 2, room: 1, far: 0 } };
  const занято = new Set(), фигуры = [], взятые = [];
  const стор = { ally: 0, enemy: 0 };
  const естьИгрок = бб.some(x => x.сторона === 'ally' && namesLikelySame(первое(x.имя), первое(игрок)));
  бб.filter(п => п.сторона !== 'neutral').forEach(п => {
    const номер = стор[п.сторона]++;
    const король = п.сторона === 'ally' ? namesLikelySame(первое(п.имя), первое(игрок)) || (номер === 0 && !естьИгрок) : номер === 0;
    const вид = король ? 'king' : ЗАСТАВА[(номер - 1 + ЗАСТАВА.length) % ЗАСТАВА.length];
    if (п.состояние === 'out') { взятые.push({ п, вид }); return; }
    const ряд = РЯД[п.сторона][п.дист];
    let кол = 3 + (номер % 2 ? Math.ceil(номер / 2) : -Math.floor(номер / 2));
    while (занято.has(ряд + ':' + кол) && кол < 7) кол++;
    кол = огр(кол, 0, 7); занято.add(ряд + ':' + кол);
    фигуры.push({ п, вид, x: кол * 20, y: ряд * 20 });
  });
  const доска = Array.from({ length: 64 }, (_, i) => { const x = i % 8, y = Math.floor(i / 8); return `<rect class="${(x + y) % 2 ? 'dk' : 'lt'}" x="${x * 20}" y="${y * 20}" width="20" height="20"/>`; }).join('');
  const фиг = ({ п, вид, x, y }) => `<g class="pc s-${п.сторона} st-${п.состояние}${п.ходит ? ' is-turn' : ''}" transform="translate(${x} ${y})">${п.ходит ? '<rect class="sel" x="1" y="1" width="18" height="18" rx="2"/>' : ''}<ellipse class="shadow" cx="10.5" cy="17.4" rx="5" ry="1.4"/><path class="${п.состояние === 'stun' ? 'tilt' : ''}" d="${ФИГУРЫ[вид]}"/>${п.ран ? '<circle class="wd" cx="16" cy="4" r="2.2"/>' : ''}<title>${э(первое(п.имя))}</title></g>`;
  const надпись = !б.этап ? 'партия идёт' : { threat: 'шах', fight: 'партия идёт', pause: 'пауза', chase: 'бегство короля', over: 'партия окончена' }[б.этап[0]];
  const своих = бб.filter(п => п.сторона === 'ally' && п.состояние !== 'out').length, чужих = бб.filter(п => п.сторона === 'enemy' && п.состояние !== 'out').length;
  return `<div class="hud-v hud-bt hud-bt-chess${б.этап ? ' is-' + б.этап[0] : ''}"><header class="banner"><b>${надпись}</b>${б.очередь.length ? `<span><span>ход</span>: <span data-i18n-skip>${э(первое(б.очередь[0]))}</span></span>` : ''}</header>`
    + `<div class="game"><svg class="brd" viewBox="-14 -14 188 188" role="img" aria-label="Расстановка как на доске"><rect class="frame" x="-14" y="-14" width="188" height="188" rx="6"/><rect class="inlay" x="-6" y="-6" width="172" height="172" rx="2"/>${доска}`
    + 'abcdefgh'.split('').map((л, i) => `<text class="crd" x="${i * 20 + 10}" y="169">${л}</text>`).join('') + [8, 7, 6, 5, 4, 3, 2, 1].map((н, i) => `<text class="crd" x="-8" y="${i * 20 + 13}">${н}</text>`).join('')
    + фигуры.map(фиг).join('') + `</svg><div class="side">`
    + `<div class="clock" aria-label="Фигур на доске: ${своих} и ${чужих}"><span class="w"><b>${своих}</b></span><span class="b"><b>${чужих}</b></span></div>`
    + (взятые.length ? `<div class="taken"><small>взяты</small>${взятые.map(({ п, вид }) => `<svg viewBox="0 0 20 20" class="s-${п.сторона}" aria-label="${э(первое(п.имя))}"><path d="${ФИГУРЫ[вид]}" transform="rotate(90 10 10)"/></svg>`).join('')}</div>` : '') + `</div></div>`
    + `<ol class="legend">${фигуры.concat(взятые).map(({ п, вид }) => `<li class="s-${п.сторона} st-${п.состояние}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="${ФИГУРЫ[вид]}"/></svg><b data-i18n-skip>${э(первое(п.имя))}</b><small><span>${ДИСТ[п.дист]}</span> · <span>${п.состояниеСлово}</span>${п.ствол ? ' · ' + свои(п.ствол) : ''}</small></li>`).join('')}</ol>`
    + (б.очередь.length ? `<p class="moves">${б.очередь.map((к, i) => `<span><b>${i + 1}.</b> <span data-i18n-skip>${э(первое(к))}</span></span>`).join(' ')}</p>` : '')
    + погоняПолоса(б, 'chase') + `</div>`;
}

/** Сводка (минимализм): этап и чей ход строкой, ниже бойцы — сторона точкой,
 *  имя, тонкая полоса состояния, где и с чем; погоня — одна линия. Всё
 *  остальное прежнего вида — под «Подробнее» (combat.js). */
function бойСводка(б) {
  const бб = бойцы(б);
  const строка = (п) => `<li class="s-${п.сторона} st-${п.состояние}${п.ходит ? ' is-turn' : ''}"><i class="side" aria-hidden="true"></i><b data-i18n-skip>${э(первое(п.имя))}</b>`
    + `<span class="hp" aria-label="Состояние"><i style="--bv:${п.hp}%"></i></span><em>${п.состояниеСлово}</em>`
    + `<small><span>${СТОРОНА[п.сторона]}</span> · <span>${ДИСТ[п.дист]}</span>${п.ствол ? ` · <span data-i18n-skip>${э(п.ствол)}</span>` : ''}${п.ран ? ` · <span>ран</span>: ${п.ран}` : ''}</small></li>`;
  return `<div class="hud-v hud-bt hud-bt-sheet${б.этап ? ' is-' + б.этап[0] : ''}"><header><b>${подписьЭтапа(б)}</b>${б.очередь.length ? `<span><span>ход</span>: <span data-i18n-skip>${б.очередь.map(к => э(первое(к))).join(' → ')}</span></span>` : ''}</header>`
    + `<ul>${бб.map(строка).join('')}</ul>` + погоняПолоса(б, 'line') + `</div>`;
}

export function видБоя(разбор, вид) {
  if (!разбор || (!разбор.участники.length && !разбор.этап)) return '';
  if (вид === 'fight') return бойФайтинг(разбор);
  if (вид === 'tac') return бойПланшет(разбор);
  if (вид === 'chess') return бойШахматы(разбор);
  if (вид === 'sheet') return бойСводка(разбор);
  return '';
}

// ============================================================================
// БЕРЕМЕННОСТЬ — верх карточки: срок, малыш, отсчёт (pregnancy.js считает сам)
// б — { н, триместр, размер: [с чем, рост, вес], событие, следующий: [неделя, этап],
//       роды, отсчёт, скоро }
// ============================================================================

function низБеременности(б) {
  return (б.размер ? `<div class="hud-prg-size"><span>размером с</span><b>${э(б.размер[0])}</b><small>${б.размер[1]}${б.размер[2] ? ' · ' + б.размер[2] : ''}</small></div>` : '')
    + (б.событие ? `<p class="hud-prg-event">${э(б.событие)}</p>` : '')
    + (б.следующий ? `<p class="hud-prg-next">Дальше: <b>${б.следующий[1]}</b> — через ${б.следующий[0] - б.н} ${склон(б.следующий[0] - б.н, 'неделю', 'недели', 'недель')}</p>` : '')
    + (б.отсчёт ? `<div class="hud-prg-count${б.скоро ? ' is-soon' : ''}">${э(б.отсчёт)}</div>` : '');
}
const шапкаБеременности = (б) => `<header class="hd"><b>${б.н === null ? 'Срок не назван' : б.н + '-я неделя'}</b>${б.триместр ? `<em>${['', 'I', 'II', 'III'][б.триместр]} триместр</em>` : ''}${б.роды ? `<small>роды ${э(б.роды)}</small>` : ''}</header>`;
const полоса40 = (б) => `<div class="weeks" role="img" aria-label="${б.н === null ? 'Срок не назван' : б.н + '-я неделя из 40'}">${Array.from({ length: 40 }, (_, i) => `<i class="t${i < 13 ? 1 : i < 27 ? 2 : 3}${б.н !== null && i + 1 <= б.н ? ' on' : ''}${i + 1 === б.н ? ' now' : ''}"></i>`).join('')}</div>`;

// Игрушки мобиля — по месяцам: звезда, луна, облако, сердце, птичка, солнце,
// шарик, рыбка, цветок.
const ИГРУШКИ = [
  'M0-9 2.6-3 9-2.8 4-1 5.6 6 0 2.6-5.6 6-4-1-9-2.8-2.6-3Z', 'M3-9a9 9 0 1 0 6 15A7 7 0 1 1 3-9Z', 'M-9 3a4 4 0 0 1 2-7 5 5 0 0 1 9-2 4 4 0 0 1 7 4 4 4 0 0 1 0 8H-6a4 4 0 0 1-3-3Z',
  'M0 8C-6 4-9 0-9-4a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c0 4-3 8-9 12Z', 'M-9 1c3-5 9-6 13-3l5-3-2 5c1 4-3 8-9 8-4 0-7-3-7-7Z', 'M0-6a6 6 0 1 1 0 12A6 6 0 0 1 0-6ZM0-10v2M0 8v2M-10 0h2M8 0h2M-7-7l1.5 1.5M5.5 5.5 7 7M7-7 5.5-5.5M-5.5 5.5-7 7',
  'M0-9a7 8 0 0 1 0 16 7 8 0 0 1 0-16ZM0 7l-2 3h4Z', 'M-9 0c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2Z', 'M0-3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM0-9a3 3 0 0 1 0 6M0 3a3 3 0 0 1 0 6M-9 0a3 3 0 0 1 6 0M3 0a3 3 0 0 1 6 0',
];
/** Мобиль над кроваткой: деревянные перекладины, ниточки и девять фетровых
 *  игрушек — по одной на месяц. Прожитые месяцы — цветные со стёжкой,
 *  нынешний светится и крупнее, будущие — пунктирным контуром. Мобиль
 *  тихо кружится. Ниже — сорок недель тонкой лентой и всё про эту неделю. */
function беременностьМобиль(б) {
  const месяц = б.н === null ? 0 : Math.min(9, Math.ceil(б.н / (40 / 9)));
  const МЕСТА = [[22, 70], [46, 92], [70, 72], [94, 96], [118, 74], [142, 94], [166, 70], [190, 92], [214, 72]];
  const игрушки = ИГРУШКИ.map((d, i) => { const [x, y] = МЕСТА[i]; const м = i + 1; const сост = м < месяц ? 'done' : м === месяц ? 'now' : 'todo';
    const брусок = i < 3 ? 34 : i < 6 ? 40 : 34;
    return `<path class="str" d="M${x} ${брусок + (i % 2 ? 0 : 0)}V${y - 10}"/><g class="toy ${сост}" style="--i:${i}" transform="translate(${x} ${y})"><g class="sway"><path class="felt" d="${d}"/><path class="stitch" d="${d}"/><text class="m" y="16">${м}</text></g></g>`; }).join('');
  return `<div class="hud-v hud-pg hud-pg-mobile">${шапкаБеременности(б)}<div class="sky"><svg class="mob" viewBox="0 0 236 118" aria-hidden="true"><path class="hook" d="M118 0V14"/><circle class="knob" cx="118" cy="16" r="3"/>`
    + `<g class="spin"><path class="bar" d="M14 34Q118 22 222 34"/><path class="str" d="M118 18V27"/>${игрушки}</g></svg></div>`
    + `<p class="month">${месяц ? `<b>${месяц}</b> <span>месяц из 9</span>` : ''}</p>${полоса40(б)}<div class="today">${низБеременности(б)}</div></div>`;
}

/** Вязание: в корзинке полотно растёт ряд за рядом лицевой гладью — связано
 *  столько рядов, сколько недель; триместры — полосами своей пряжи; внизу
 *  спицы, сбоку клубок с ниткой, к полотну приколота бирка с неделей. */
function беременностьВязание(б) {
  const доля = б.н === null ? 0 : огр(б.н / 40, 0, 1.05);
  return `<div class="hud-v hud-pg hud-pg-knit">${шапкаБеременности(б)}<div class="work">`
    + `<div class="rack" aria-hidden="true"><div class="cloth" style="--p:${ф(доля)}"><i class="tag"><b>${б.н ?? '?'}</b><small>из 40</small></i><i class="pin"></i></div>`
    + `<svg class="needles" viewBox="0 0 120 30"><path class="nd" d="M6 22 114 8"/><path class="nd" d="M6 8l108 14"/><circle class="knob" cx="6" cy="22" r="3.4"/><circle class="knob" cx="6" cy="8" r="3.4"/></svg>`
    + `<svg class="ball" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15"/><path d="M8 14c8 2 16 8 20 18M10 26c6-6 14-10 24-10M14 7c4 8 6 18 4 28M24 6c-2 8-8 14-18 18"/></svg><svg class="strand" viewBox="0 0 60 40" preserveAspectRatio="none"><path d="M0 2C20 6 30 30 60 36"/></svg><i class="basket"></i></div>`
    + `<div class="side"><p class="rows"><span>связано</span> <b>${б.н ?? 0}</b> <span>${склон(б.н ?? 0, 'ряд из 40', 'ряда из 40', 'рядов из 40')}</span></p>${низБеременности(б)}</div></div></div>`;
}

/** Росток: на подоконнике в расписном горшке растёт растение — семечко,
 *  всход, листья, бутон, цветок; стадия — по неделе. Солнце из окна, рядом
 *  лейка и линейка недель с отметкой. */
function беременностьРосток(б) {
  const w = б.н ?? 0;
  const стадия = w < 7 ? 0 : w < 14 ? 1 : w < 21 ? 2 : w < 28 ? 3 : w < 37 ? 4 : 5;
  const стебель = [0, 22, 40, 58, 72, 82][стадия];
  // Лист от стебля вбок: две дуги до кончика и обратно, в абсолютных координатах.
  const лист = (y, сторона, k) => `<path class="lf" style="--k:${k}" d="M60 ${y}C${60 + сторона * 6} ${y - 10} ${60 + сторона * 18} ${y - 12} ${60 + сторона * 24} ${y - 6}C${60 + сторона * 18} ${y + 2} ${60 + сторона * 8} ${y + 2} 60 ${y}Z"/>`;
  const листья = [[108, 1], [96, -1], [84, 1], [72, -1], [62, 1]].slice(0, [0, 2, 4, 5, 5, 5][стадия]).map(([y, с], k) => лист(y, с, k)).join('');
  const бут = стадия === 4 ? 20 : 14, ш = стадия === 4 ? 9 : 6, вр = 120 - стебель;
  const цветок = стадия >= 3 ? (стадия === 5 ? `<g transform="translate(60 ${вр})"><g class="bloom">${[0, 60, 120, 180, 240, 300].map(a => `<ellipse rx="5" ry="10" transform="rotate(${a}) translate(0 -9)"/>`).join('')}<circle r="5"/></g></g>`
    : `<path class="bud" d="M60 ${вр - бут}C${60 + ш} ${вр - бут + 4} ${60 + ш} ${вр - 2} 60 ${вр}C${60 - ш} ${вр - 2} ${60 - ш} ${вр - бут + 4} 60 ${вр - бут}Z"/>`) : '';
  const СТАДИИ = ['семечко', 'всход', 'листья', 'бутон', 'бутон', 'цветок'];
  return `<div class="hud-v hud-pg hud-pg-sprout">${шапкаБеременности(б)}<div class="sill"><i class="sun" aria-hidden="true"></i><div class="pot-wrap"><svg class="plant" viewBox="0 0 120 150" aria-hidden="true">`
    + `<path class="soil" d="M30 120h60l-2 6H32z"/>${стадия === 0 ? '<ellipse class="seed" cx="60" cy="118" rx="4" ry="2.6"/><path class="sprig" d="M60 116c0-3 2-5 4-6"/>' : `<path class="stem" d="M60 120C${стадия > 2 ? 56 : 60} ${120 - стебель * .5} ${стадия > 2 ? 64 : 60} ${120 - стебель * .8} 60 ${120 - стебель}"/>`}`
    + листья + цветок + `<path class="pot" d="M28 122h64l-8 26H36z"/><path class="paint" d="M34 132c8 4 14-4 20 0s12-4 20 0 8-2 12 0"/><circle class="dot" cx="46" cy="140" r="1.6"/><circle class="dot" cx="60" cy="141" r="1.6"/><circle class="dot" cx="74" cy="140" r="1.6"/><path class="rim" d="M26 118h68v6H26z"/></svg>`
    + `<svg class="can" viewBox="0 0 40 30" aria-hidden="true"><path class="tank" d="M8 10h18v16H8z"/><path class="spout" d="M26 14l12-8v3L28 20"/><path class="handle" d="M8 13c-6 0-6 10 0 10"/></svg>`
    + `<div class="ruler" aria-hidden="true">${[40, 30, 20, 10, 0].map(к => `<small>${к}</small>`).join('')}<i style="--p:${ф(огр(w / 40, 0, 1))}"></i></div>`
    + `</div><div class="txt"><p class="stage">${СТАДИИ[стадия]}</p>${низБеременности(б)}</div></div></div>`;
}

/** Неделя (минимализм): крупное число недели в тонком кольце из сорока
 *  делений, рядом — триместр, роды и отсчёт; ниже — размер и что дальше. */
function беременностьНеделя(б) {
  const w = б.н ?? 0, R0 = 30, Д = 2 * Math.PI * R0;
  const деления = Array.from({ length: 40 }, (_, i) => { const a = -Math.PI / 2 + (i / 40) * Math.PI * 2, r1 = 35, r2 = i % 13 === 0 ? 39 : 37.5;
    return `<path class="t${i < 13 ? 1 : i < 27 ? 2 : 3}${i < w ? ' on' : ''}" d="M${ф(40 + Math.cos(a) * r1)} ${ф(40 + Math.sin(a) * r1)}L${ф(40 + Math.cos(a) * r2)} ${ф(40 + Math.sin(a) * r2)}"/>`; }).join('');
  return `<div class="hud-v hud-pg hud-pg-week"><div class="top"><svg class="ring" viewBox="0 0 80 80" role="img" aria-label="${б.н === null ? 'Срок не назван' : б.н + '-я неделя из 40'}">`
    + `<circle class="track" cx="40" cy="40" r="${R0}"/><circle class="fill" cx="40" cy="40" r="${R0}" stroke-dasharray="${ф(Д * огр(w / 40, 0, 1))} ${ф(Д)}" transform="rotate(-90 40 40)"/>${деления}`
    + `<text x="40" y="44">${б.н === null ? '—' : б.н}</text><text class="u" x="40" y="55">нед.</text></svg>`
    + `<div class="meta">${б.триместр ? `<em>${['', 'I', 'II', 'III'][б.триместр]} триместр</em>` : ''}${б.роды ? `<small>роды ${э(б.роды)}</small>` : ''}${б.отсчёт ? `<b class="${б.скоро ? 'is-soon' : ''}">${э(б.отсчёт)}</b>` : ''}</div></div>`
    + (б.размер ? `<p class="size">размером с <b>${э(б.размер[0])}</b> <small>${б.размер[1]}${б.размер[2] ? ' · ' + б.размер[2] : ''}</small></p>` : '')
    + (б.событие ? `<p class="ev">${э(б.событие)}</p>` : '')
    + (б.следующий ? `<p class="next">Дальше: <b>${б.следующий[1]}</b> — через ${б.следующий[0] - б.н} ${склон(б.следующий[0] - б.н, 'неделю', 'недели', 'недель')}</p>` : '') + `</div>`;
}

export function видБеременности(б, вид) {
  if (!б) return '';
  if (вид === 'mobile') return беременностьМобиль(б);
  if (вид === 'knit') return беременностьВязание(б);
  if (вид === 'sprout') return беременностьРосток(б);
  if (вид === 'week') return беременностьНеделя(б);
  return '';
}
