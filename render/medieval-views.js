// hud-manager/render/medieval-views.js
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0.
//
// Виды блоков для старины (Кастомизация → Блоки: Шкатулка, Блоки: Мир).
// Средневековые — в обоих средневековьях; чародейские (ларец чародея и
// «Эфирный маяк», «Круг созвездий»…) — только при явной магии, когда
// шкатулка уже стала ларцом. Данные те же, что у прежних видов: модель
// ничего нового не пишет. Оформление — css/medieval-views.css, цвета —
// от акцента темы (--hud-accent).
//
// Вид рисуется целиком в обёртке .hud-mv: стили не выходят за неё.
// Время суток в «Тем временем» — то же, что у плашки погоды (частьДня).

import { escapeHtml, defeatWI, hudHashSeed } from '../utils.js?v=23.89.84';
import { старина, явнаяМагия } from '../era.js?v=23.89.84';
import { английский } from '../i18n.js?v=23.89.84';
import { миниатюра, каминМастерской, гербПисьма, печатьМастерской } from './medieval-workshop.js?v=23.89.84';
// Краткая запись Мира: главное сразу, подробности раскрываются плавно по нажатию (render/world-life-views.js).
import { подробно, пункт } from './world-life-views.js?v=23.89.84';

// Шкатулка, как и прежние её виды, — с невидимым знаком против лорбука (defeatWI).
// Мир — без него, как прежние виды Мира: звёздочка «Ввести в сюжет» и правка
// блока ищут запись по тексту, и лишний знак после первой буквы её прячет.
let безЗнака = false;
const т = (v) => безЗнака ? escapeHtml(String(v ?? '')) : defeatWI(escapeHtml(String(v ?? '')));
const подп = (текст) => `<span>${текст}</span>`;
const есть = (v) => v !== undefined && v !== null && String(v).trim() !== '' && !/^(empty|none|null|нет|—|-)$/i.test(String(v).trim());
const тег = (имя, v, класс = '') => есть(v) ? `<${имя}${класс ? ` class="${класс}"` : ''}>${т(v)}</${имя}>` : '';
const знак = (символ, класс = '') => `<span class="${класс}" aria-hidden="true">${символ}</span>`;
// Пилюля статуса: тон по смыслу (leaf — хорошо, gold — в пути, wax — беда,
// ash — угасло, без тона — акцент темы). Ярлыки — пилюля и дата одной строкой.
// Статус — слово интерфейса, а не текст лора: без невидимого знака defeatWI после
// первой буквы (по нему узкая пилюля переносила «Ч|ерновик»).
const пилюля = (текст, тон = '', имя = 'small') => есть(текст) ? `<${имя} class="m-pill${тон ? ' is-' + тон : ''}">${escapeHtml(String(текст))}</${имя}>` : '';
const ярлыки = (...части) => части.join('').trim() ? `<span class="m-tags">${части.join('')}</span>` : '';
const ТОН_ПИСЬМА = { sealed: 'wax', draft: 'ash', transit: 'gold', sent: 'gold', burned: 'ash', hidden: 'ash', read: 'leaf' };
const ТОН_ГРАМОТЫ = { valid: 'leaf', expired: 'ash', revoked: 'wax', forged: 'wax', void: 'wax' };
const тонРепутации = (ч) => typeof ч !== 'number' ? '' : ч >= 40 ? 'leaf' : ч > 0 ? 'gold' : ч < 0 ? 'wax' : 'ash';
let счёт = 0;
const новыйId = (п) => `hud-mv-${п}-${(++счёт).toString(36)}`;
// Первая буква — буквицей; эмодзи и кавычку в буквицу не ставим.
const сБуквицей = (текст, класс = 'm-drop') => есть(текст) ? `<p class="${/^\p{L}/u.test(String(текст).trim()) ? класс : ''}">${т(String(текст).trim())}</p>` : '';

// --- Время суток как у плашки погоды ----------------------------------------------
// Восход и закат по месяцу (~50° с. ш.), фазы в долях светового дня — те же
// границы, что у виджета погоды (index.js): рассвет — последний час до
// восхода, утро — до 2/7 дня, день — до 11/14, закат — до конца дня,
// вечер и ночь — ночь. Без часов — по слову.
const ВОСХОД = [480, 450, 400, 345, 300, 280, 290, 330, 375, 420, 460, 485];
const ЗАКАТ = [990, 1040, 1090, 1145, 1190, 1215, 1210, 1165, 1105, 1045, 990, 970];
export function частьДня(время, дата = '') {
  const s = String(время || '').toLowerCase();
  const d = String(дата || '');
  const м = d.match(/(?<!\d)\d{1,2}[./](\d{1,2})[./]\d{2,4}(?!\d)/) || d.match(/(?<!\d)\d{4}-(\d{1,2})-\d{1,2}(?!\d)/);
  const месяц = м && +м[1] >= 1 && +м[1] <= 12 ? +м[1] : 0;
  const начало = месяц ? ВОСХОД[месяц - 1] : 360, конец = месяц ? ЗАКАТ[месяц - 1] : 1200, длина = конец - начало;
  const ч = s.match(/(\d{1,2})[:.](\d{2})/);
  if (ч) {
    const мин = (+ч[1] % 24) * 60 + (+ч[2] || 0);
    if (мин < начало - 60) return 'night';
    if (мин < начало) return 'dawn';
    if (мин < начало + длина * .286) return 'morning';
    if (мин < начало + длина * .786) return 'day';
    if (мин < конец) return 'sunset';
    return 'night';
  }
  if (/(?<![\p{L}])предрассвет|рассвет|\bdawn\b|\bpredawn/u.test(s)) return 'dawn';
  if (/(?<![\p{L}])утр|\bmorn/u.test(s)) return 'morning';
  if (/(?<![\p{L}])(?:закат|золот)|\bsunset|\bgolden/u.test(s)) return 'sunset';
  if (/(?<![\p{L}])(?:вечер|ноч|полноч)|\beven|\bnight/u.test(s)) return 'night';
  if (/(?<![\p{L}])(?:день|дн[её]м|полд)|\bday\b|\bnoon/u.test(s)) return 'day';
  return 'day';
}

// --- Долина с замком: окно «Тем временем» -------------------------------------------
function домик(x, y, масштаб, усадьба = false) {
  return `<g transform="translate(${x} ${y}) scale(${масштаб})">
    <path fill="#ae9071" d="M0 0v-15l11-11 11 11V0z"/><path fill="#847466" d="M22 0v-15h19V0z"/>
    <path fill="var(--roof)" d="m-3-15 14-15 16 15h-6L11-24 3-15zm14-15h20l14 15H26z"/>
    <path fill="#786653" d="M28-25v-9h4v13z"/>
    <path fill="none" stroke="#68564d" stroke-width="1.4" d="M2-13h18M4-13l13 12M17-13 4-1M11-23v9M24-13v12m13-12v12"/>
    <path class="valley-lamp" fill="var(--lamp)" d="M5-11h4v5H5zm10 0h3v5h-3zm12 0h5v5h-5z"/>
    ${усадьба ? '<path fill="#958776" d="M-7 0v-30h10V0z"/><path fill="var(--slate)" d="m-10-29 8-15 8 15z"/><path class="valley-lamp" fill="var(--lamp)" d="M-4-24h3v6h-3z"/>' : ''}
    <path class="valley-smoke" fill="none" stroke="#e8dccb" stroke-width="2" stroke-linecap="round" d="M30-36q-3-5 1-9t0-9"/></g>`;
}
function башня(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path fill="#948c89" d="M-8 0v-38H8V0z"/><path fill="#b5a59a" d="M-8 0v-38h8V0z"/>
  <path fill="var(--slate)" d="m-11-37 11-23 11 23z"/><path fill="#718097" d="m-11-37 11-23-3 23z"/>
  <path class="valley-lamp" fill="var(--lamp)" d="M-4-27q2-6 4 0v5h-4z"/><path stroke="#baa06f" d="M0-57v-13"/>
  <path class="valley-flag" fill="var(--rubric)" d="M1-70q5-3 12 0l-4 2 4 2q-7-2-12 0z"/></g>`;
}
const ель = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="m0 0 5-10H2l5-10H5l5-13 5 13h-2l5 10h-3l5 10z"/>`;
// Светило идёт по небу: утром слева, днём выше, к закату справа и ниже.
const СВЕТИЛО = { dawn: [70, 64], morning: [118, 34], day: [240, 20], sunset: [392, 50], night: [365, 28] };
export function долина(фаза) {
  const id = новыйId('sky');
  const [cx, cy] = СВЕТИЛО[фаза] || СВЕТИЛО.day;
  const звёзды = [21, 62, 91, 138, 177, 285, 320, 364, 405, 454].map((x, i) => `<circle cx="${x}" cy="${7 + i * 13 % 31}" r="${i % 2 + .6}"/>`).join('');
  return `<div class="castle-valley" data-phase="${фаза}" aria-hidden="true"><svg viewBox="0 0 480 155" focusable="false" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="${id}" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="var(--zenith)"/><stop offset="1" stop-color="var(--horizon)"/></linearGradient>
    <radialGradient id="${id}h" cx=".5" cy=".5" r=".5"><stop stop-color="var(--orb)" stop-opacity=".55"/><stop offset="1" stop-color="var(--orb)" stop-opacity="0"/></radialGradient></defs>
    <path fill="url(#${id})" d="M0 0h480v155H0z"/>
    <g class="valley-stars" fill="#fff1d4">${звёзды}</g>
    <circle class="valley-halo" cx="${cx}" cy="${cy}" r="34" fill="url(#${id}h)"/>
    <circle class="valley-orb" cx="${cx}" cy="${cy}" r="12" fill="var(--orb)"/>
    ${фаза === 'night' ? `<circle cx="${cx + 5}" cy="${cy - 3}" r="10" fill="var(--zenith)" opacity=".85"/>` : ''}
    <g fill="#fff2dd" class="valley-cloud"><path d="M20 32q12-7 24-4 11-10 27-3 14-2 24 5zM302 43q17-10 28-5 12-7 29 3z"/></g>
    <g class="valley-birds" fill="none" stroke="var(--bird)" stroke-width="1.2" stroke-linecap="round"><path d="M150 40q4-4 8 0 4-4 8 0M176 30q3-3 6 0 3-3 6 0"/></g>
    <path fill="var(--ridge)" d="M0 62Q44 37 89 63t84-2q42-27 79-3t83-2q38-25 81-5t64-4v99H0z"/>
    <path fill="var(--wood)" d="M0 77q67-28 126 6t99-10q56-37 120 0t135-13v90H0z"/>
    <g>${башня(220, 93, .81)}${башня(255, 94, .92)}
    <path fill="#b4a093" d="M226 88V53h23v35z"/><path fill="var(--slate)" d="m222 54 15-21 16 21z"/>
    <path class="valley-lamp" fill="var(--lamp)" d="M231 59h3v6h-3zm9 0h3v6h-3z"/>
    <path fill="#8e8383" d="M198 95V76h5v4h6v-4h5v4h7v-4h5v4h7v-4h5v4h7v-4h5v4h7v-4h6v4h7v-4h7v19z"/>
    <path fill="#3c3942" d="M232 95V86q4-9 8 0v9z"/>${башня(199, 97, .57)}${башня(275, 96, .62)}</g>
    <path fill="var(--hill)" d="M0 92q50-9 100 9t92-8q44-14 96 0t90 3q61-17 102-7v66H0z"/>
    <path fill="var(--road)" d="M237 92q-30 13-2 16t-6 15q-30 11-11 32h23q-33-22-4-32 38-15 4-18-27-4-4-13z"/>
    ${домик(44, 102, .55, true)}${домик(111, 106, .38)}${домик(331, 99, .48, true)}${домик(380, 98, .39)}
    <path fill="var(--meadow)" d="M0 111q63-16 112 7t97 11l-5 26H0zm259 24q58-24 107-19t114-15v54H252z"/>
    ${домик(20, 132, .78)}${домик(61, 125, .58)}${домик(98, 138, .72)}${домик(346, 128, .62)}${домик(399, 135, .78, true)}
    <g fill="var(--forest)">${[[0, 146, 1.2], [10, 147, .8], [140, 141, .65], [154, 143, .8], [304, 139, .7], [316, 141, .9], [453, 145, 1.2], [469, 144, 1.1]].map(a => ель(...a)).join('')}</g>
    <path fill="var(--forest)" d="M0 143q49-6 99 2t105 10H0zm274 12q60-14 107-11t99-5v16z"/>
    <path class="valley-mist" fill="#fff" d="M0 118q80-10 170 2t170-4 140 6v14H0z"/>
  </svg></div>`;
}

// --- Гравюры чародейских видов -------------------------------------------------------
const чернила = 'var(--sig-ink,#253244)', золото = 'var(--sig-gold,#d4ae70)', блик = '#ffe9ad', камень = 'var(--sig-stone,#719dad)';
const п = (d, fill = 'none') => `<path d="${d}" fill="${fill}"/>`;
const круг = (x, y, r, fill = 'none') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const звезда = (x, y, r) => п(`M${x} ${y - r}q0 ${r} ${r} ${r}q-${r} 0 -${r} ${r}q0 -${r} -${r} -${r}q${r} 0 ${r} -${r}z`, блик);
const кольцо = (rx, ry, угол) => `<ellipse cx="20" cy="19" rx="${rx}" ry="${ry}" transform="rotate(${угол} 20 19)" fill="none"/>`;
const ГРАВЮРЫ = {
  orbits: круг(20, 18, 12, чернила) + кольцо(15, 5, -26) + п('M17 7q-6 13 9 15-13 7-16-4-1-7 7-11z', блик) + п('m20 31-4 4h9l-4-4M11 36h18'),
  tide: п('M10 19q10 6 15-9 2 11-6 14-6 2-9-5z', блик) + п('M3 29q5-3 10 0t10 0t13-1M8 33q5-2 10 0t12-1M5 26q2-9-2-14m2 12 4-9') + звезда(31, 9, 2),
  roots: п('M18 19q-9-8-11-12 10 1 13 10Q20 8 29 4q0 9-8 14 7-4 13-3-4 6-11 7', камень) + п('M16 19q-4 5 1 9l-4 8 7-6 3 6 1-8q6-5 0-10z', '#917451') + п('m17 23 2 1m3-1 2-1m-4 5 2-1'),
  spectral: п('m6 11 18-5 9 21-18 6z', камень) + п('m3 15 18-4 8 22-19 4z', чернила) + п('m9 19 10-3m-9 7 12-3m-10 7 8-2') + звезда(31, 9, 4),
  feather: п('M6 32q7-8 9-16l8-5q1-7 7-6 5 0 5 5l3 2-5 2q-3 13-17 14z', камень) + п('m10 29 14-12-4 8m-7 6-3 4m7-6-2 5') + круг(31, 9, .9, чернила) + п('m6 22 10 3-5 6-10-3z', блик),
  mirror: п('m18 26-4 9q0 3 3 2l5-11', золото) + п('M9 17Q9 5 20 3q12 1 12 13t-12 13Q10 28 9 17z', золото) + п('M12 16q0-9 8-10 9 1 9 10t-9 10q-8-1-8-10z', камень) + п('m15 19 9-10m-5 13 6-7'),
  basalt: п('m9 4 20 2 4 6-3 23-22 1-3-8z', '#465266') + п('m12 8 14 1 3 4-2 18-15 1-3-5z') + п('M19 12v15m0-15 5 6-5 4-4-4z', камень) + п('m8 27 5-3-2-4'),
  ribbon: п('M7 8q6-5 13 0l8-2q6-1 7 4-1 4-7 3l-2 15q-1 6-8 4l-10 2q-7 0-6-5l6-1z', '#8d586c') + п('M8 28q6-3 13 0l5-1M11 13l12-1m-12 5 10-1m-11 6 7-1') + круг(25, 24, 4, золото),
  amber: п('m11 10 12-6 9 10-1 13-12 9-12-10z', '#9b592e') + п('m12 12 10-5 6 8-2 11-8 6-8-8z', '#dba052') + п('m15 25 8-12m-5 7-3-5m5 3 4 1') + п('m11 13 0 6', блик),
  chain: круг(20, 7, 4) + круг(20, 12, 3) + п('m20 14 11 10-11 13-11-13z', золото) + п('m20 17 7 7-7 9-7-9z', камень) + звезда(20, 24, 3),
  constellation: п('m4 21 9-12 9 8 11-10-4 21-12 5-13-12z') + п('m13 9 4 24 5-16 7 11') + [[4, 21], [13, 9], [22, 17], [33, 7], [29, 28], [17, 33]].map(([x, y]) => круг(x, y, 2, блик)).join(''),
  ward: п('m20 3 13 5-1 15q-3 8-12 14-10-6-13-14L7 8z', камень) + п('m20 7 9 4-1 11q-2 5-8 10-7-5-8-10l-1-11z', чернила) + п('m20 10 3 6-3 11-3-11z', блик) + п('M14 20h12'),
};
export const гравюра = (вид) => `<svg class="arc-emblem" viewBox="0 0 40 40" fill="none" stroke="${золото}" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${ГРАВЮРЫ[вид] || ''}</svg>`;

function лунныйПейзаж(озеро) {
  const звёзды = Array.from({ length: 24 }, (_, i) => `<circle cx="${8 + (i * 71) % 302}" cy="${5 + (i * 13) % 46}" r="${i % 4 === 0 ? 1 : .55}" fill="#f6e3b8"/>`).join('');
  const сосна = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="m0 0 5-9H2l5-9H5l6-16 6 16h-2l5 9h-3l5 9z"/>`;
  const диск = (x, y, r) => `<g transform="translate(${x} ${y})"><circle class="arc-moonglow" r="${r + 6}" fill="#f6e3ac" opacity=".12"/><circle r="${r}" fill="#f3dfae"/><g fill="#cbbda4" opacity=".6"><circle cx="-4" cy="-3" r="3"/><circle cx="4" cy="4" r="2"/><circle cx="5" cy="-6" r="1.4"/></g></g>`;
  const сфера = `<g transform="translate(160 49)" fill="none" stroke="#d9b67b"><circle r="38"/><circle r="34" stroke-dasharray="1 4"/><ellipse rx="71" ry="15" transform="rotate(-16)"/><ellipse rx="41" ry="21" transform="rotate(49)"/><g class="arc-dial">${Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${30 * i})" d="M0-38v4"/>`).join('')}${круг(0, -38, 2.5, блик)}</g></g>${диск(160, 49, 14)}<path fill="none" stroke="#ab916c" d="M68 70q17 12 41-3m102 0q23 16 41 3M42 73h24m188 0h24"/>`;
  const заводь = `${диск(189, 26, 12)}<path fill="#57527b" d="m0 51 35-13 42 10 33-18 33 18 20-8 43 12 40-19 34 14 40-14v37H0z"/><path fill="#234d58" d="M0 49q46 20 88 7t92 5q54-11 84-4t56-10v18H0z"/><path fill="#28485f" d="M0 63h320v37H0z"/><g class="arc-reflection" stroke="#dbc898" stroke-linecap="round">${[15, 9, 20, 13, 25, 17].map((w, i) => `<path d="M${189 - w / 2 + i % 2 * 2} ${65 + i * 3.6}h${w}"/>`).join('')}</g><g fill="#172e3a">${[[0, 77, 1.5], [19, 73, .9], [35, 72, .65], [53, 67, .35], [267, 69, .45], [283, 75, .85], [299, 79, 1.45]].map(v => сосна(...v)).join('')}</g><path fill="#132c35" d="M0 76q38-8 77 1l-39 5-38 6zm320-4q-37-3-67 6l41 3 26 6z"/>`;
  return `<div class="arc-lunarscape ${озеро ? 'lake' : 'observatory'}" aria-hidden="true"><svg viewBox="0 0 320 100" focusable="false">${звёзды}${озеро ? заводь : сфера}</svg></div>`;
}

const серебро = 'var(--silver)', самоцвет = 'var(--gem)';
const пс = (d, fill, stroke = 'none') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width=".9"/>`;
const точки = (n, h) => Array.from({ length: n }, (_, i) => `<circle cx="${6 + (i * 97) % 348}" cy="${4 + (i * 37) % h}" r="${i % 4 === 0 ? 1.25 : .65}" fill="${i % 2 ? серебро : самоцвет}"/>`).join('');
const кирпич = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.4" fill="${(x + y) % 3 ? '#515061' : '#696575'}" stroke="#272938" stroke-width=".8"/>`;
const фонарик = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0v10" stroke="${серебро}"/><g class="court-lamp"><circle cy="21" r="15" fill="#fbc67e" opacity=".08"/><path d="m-6 16 6-6 6 6-2 10-4 4-4-4z" fill="#ffd489" stroke="#aa845e"/><path d="M0 13v15m-5-11h10" fill="none" stroke="#836655"/></g></g>`;
const рябь = (y) => Array.from({ length: 10 }, (_, i) => пс(`M${9 + i * 33} ${y + i % 3 * 4}q8-2 20 0`, 'none', '#739ba7')).join('');
const лист = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})">${пс('M0 0Q-15-1-19-12-3-13 0 0', '#437267', '#85ab89')}${пс('M-1-1l-13-8', 'none', '#aabe91')}</g>`;
function сцена(вид) {
  switch (вид) {
    case 'beacon': return пс('M0 57q46-11 94-1t93-2 94-1 79-4v37H0z', '#344d61') + рябь(67)
      + пс('m112 86 30-17 19 1 10-8 34 2 28 11 35 11z', '#353546')
      + пс('m168 69 6-37h15l8 38z', '#918485', '#d3b699') + пс('m172 48 19-6 1 5-21 6zm-2 12 23-6 1 4-24 7z', '#575c77')
      + пс('M171 32V18l11-8 11 8v14z', '#303b50', серебро) + пс('M175 21h14v9h-14z', '#ffd492')
      + пс('M181 18v13m-12 2h26', 'none', серебро) + `<g class="beacon-ray">${пс('m181 24 145-18-2 24z', '#fff5c455')}</g>`
      + `<g class="arc-boat">${пс('m47 58 12-15v15z', '#c9b6a0') + пс('m39 60 27-1-6 5H46z', '#273244')}</g>`;
    case 'constellation': return Array.from({ length: 3 }, (_, i) => `<g class="arc-banner" style="--i:${i}" transform="translate(${78 + i * 99} 2)"><path d="M-19 5h38v46L0 65l-19-14z" fill="${['#4b647c', '#75465f', '#32695e'][i]}" stroke="${серебро}"/><path d="M-15 9h30v40L0 60l-15-11z" fill="none" stroke="${серебро}" opacity=".5"/><g transform="translate(-14 16) scale(.7)">${гравюра(['constellation', 'ward', 'chain'][i]).replace('<svg ', '<svg width="40" height="40" ')}</g></g>`).join('') + пс('M23 8Q180-2 337 8', 'none', серебро);
    case 'ward': return пс('M0 83V34h60v14h31v-8h14v8h29v-8h14v8h67v-8h14v8h29v-8h14v8h31V34h57v52z', '#475160')
      + Array.from({ length: 7 }, (_, i) => кирпич(7 + i * 50, 63, 46, 10)).join('')
      + пс('M139 84V48Q140 28 180 12q40 16 41 36v36z', '#90909b', серебро) + пс('M149 84V49q2-15 31-29 28 14 31 29v35z', '#202c40')
      + `<g class="ward-glow">${пс('M155 83V50q0-12 25-25 24 13 25 25v33z', 'none', самоцвет)}</g>`
      + пс('M163 83V53q0-10 17-20 17 10 17 20v30', 'none', серебро) + фонарик(131, 28, .85) + фонарик(229, 28, .85);
    case 'well': return пс('M0 63q50-15 93-6t86 7 92-10 89 1v31H0z', '#253f49')
      + пс('M117 52q63-19 126 0l-9 28q-54 14-108 0z', '#58586c', '#98959d')
      + `<ellipse cx="180" cy="53" rx="63" ry="13" fill="#879294"/><ellipse cx="180" cy="52" rx="55" ry="9" fill="#193b50"/><g class="well-light"><ellipse cx="180" cy="53" rx="34" ry="4" fill="none" stroke="${самоцвет}"/></g>`
      + пс('M129 66q51 13 103 0m-90-7 3 11m24-8 1 12m24-12-1 12m24-16-2 12', 'none', '#343644')
      + Array.from({ length: 6 }, (_, i) => лист(128 + i * 4, 53 + i * 5, 25 + i * 35)).join('')
      + `<g class="spirit-trail">${пс('M172 50c-21-16 25-18 7-33 29 15-9 23 6 33z', '#b8e1da77')}${пс('M194 48q-8-7 4-16-3 9 2 14z', '#d6edcb80')}</g>`;
    case 'lanterns': return пс('M0 15Q85 57 176 17t184 5M0 4q78 24 159 0', 'none', '#b8a28d')
      + [[21, 23, .68], [55, 33, .87], [91, 35, 1.15], [126, 32, .8], [158, 24, .62], [212, 6, .85], [252, 0, 1.08], [293, 3, .74], [337, 13, .94]].map(a => фонарик(...a)).join('')
      + пс('M0 86V6l15 15 20 1-16 6 29 5-26 2-14-5 8 56zm360 0V1l-11 16-24 7 17-1-23 15 29-12-5 60z', '#25363c')
      + Array.from({ length: 10 }, (_, i) => лист(i % 2 ? 351 - i : 7 + i, 10 + i * 5, i % 2 ? 105 : -35)).join('')
      + `<g class="court-flies">${точки(14, 72)}</g>`;
    default: return '';
  }
}
const панорама = (вид) => `<div class="arc-panorama scenery-${вид}" aria-hidden="true"><svg viewBox="0 0 360 86" focusable="false" preserveAspectRatio="xMidYMid slice">${точки(25, 42)}${сцена(вид)}</svg></div>`;

// --- Реестр: что и в какой эпохе выбирается ------------------------------------------
// 'старина' — средневековье и средневековое фэнтези; 'чары' — то же, но с
// явной магией (шкатулка — ларец чародея).
export const ЭПОХА_ВИДА = {
  menologion: 'старина', 'parish-calendar': 'старина', 'lunar-wheel': 'старина', orbits: 'чары', tide: 'чары',
  'psalter-margins': 'старина', 'stitched-notebook': 'старина', 'candle-note': 'старина', roots: 'чары', spectral: 'чары',
  'folded-letters': 'старина', 'courier-book': 'старина', 'mail-chest': 'старина', feather: 'чары', mirror: 'чары',
  'sealed-charter': 'старина', 'town-register': 'старина', 'roller-scroll': 'старина', basalt: 'чары', ribbon: 'чары',
  herbarium: 'старина', 'tied-tags': 'старина', 'memory-locket': 'старина', amber: 'чары', chain: 'чары',
  medieval: 'старина', enchanted: 'чары', tavern: 'старина',
};
export const условиеЭпохи = (метка) => метка === 'чары' ? старина() && явнаяМагия() : метка === 'старина' ? старина() : true;

// Золочёные уголки листа и эмалевая миниатюра под шапкой (render/medieval-workshop.js).
const рамка = '<span class="workshop-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
function сМиниатюрой(тело, блок) {
  const м = блок ? миниатюра(блок) : '';
  if (!м) return тело;
  const s = String(тело).trimStart();
  const хвост = s.startsWith('<h3') ? '</h3>' : s.startsWith('<header') ? '</header>' : '';
  const i = хвост ? s.indexOf(хвост) : -1;
  return i < 0 ? м + s : s.slice(0, i + хвост.length) + м + s.slice(i + хвост.length);
}
const обёртка = (класс, тело, блок = '') => `<div class="hud-mv"><section class="m-sheet ${класс}">${рамка}${сМиниатюрой(тело, блок)}</section></div>`;

// --- Восковые печати писем ---------------------------------------------------------
// Печать стоит на каждом отправленном письме (черновик и сожжённое — без неё),
// герб — по самому письму, цвет — по описанию воска или по отправителю.
// Прочитанное приходит со сломанной печатью; открыли письмо — печать ломается
// и остаётся сломанной при перерисовке, пока страница открыта.
const вскрыто = new Set();
// Без времени: «Сегодня» в следующем ходу станет «Вчера», а письмо то же.
const ключПисьма = (l) => hudHashSeed([l.from, l.to, l.text, l.seal].map(v => String(v ?? '')).join('|')).toString(36);
/** { класс, атр, html, герб } для письма; прошлый — герб письма выше. */
export function восковаяПечать(l, ключ, цвет, прошлый = -1) {
  if (!l || ключ === 'draft' || ключ === 'burned') return { класс: '', атр: '', html: '', герб: прошлый };
  const к = ключПисьма(l), герб = гербПисьма(l, прошлый);
  return { класс: ' wax-letter' + (ключ === 'read' || вскрыто.has(к) ? ' wax-broken' : ''), атр: ` data-wax="${к}"`, html: печатьМастерской(цвет, герб), герб };
}
/** Письмо уже вскрывали на этой странице: подпись «Печать сломана». */
export const вскрытоПисьмо = (l) => Boolean(l) && вскрыто.has(ключПисьма(l));
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('toggle', (e) => {
    const письмо = e.target;
    if (!письмо || !письмо.classList || !письмо.classList.contains('wax-letter') || !письмо.open) return;
    письмо.classList.add('wax-broken');
    if (письмо.dataset.wax) вскрыто.add(письмо.dataset.wax);
    if (!письмо.matches('.is-sealed, .st-sealed')) return;
    const пилюля = письмо.querySelector(':scope > summary :is(.m-pill, .hud-letter-st)');
    if (пилюля) пилюля.textContent = английский() ? 'The seal is broken' : 'Печать сломана';
  }, true);
}

// --- Шкатулка ------------------------------------------------------------------------
/**
 * Раздел шкатулки в выбранном виде. д: { notes, letters, documents, keepsakes,
 * календарь (готовая разметка календаря), луна ({ имя, свет, сторона }),
 * заголовок, письмо (статус → { ключ, текст }), грамота (doc → { вид, статус }) }.
 * Пустой раздел или прежний вид — ''.
 */
export function видРазделаШкатулки(раздел, вид, д) {
  if (!вид || вид === 'classic' || !условиеЭпохи(ЭПОХА_ВИДА[вид])) return '';
  const з = т(д.заголовок || '');
  const h3 = `<h3>${з}</h3>`;
  const лист = (класс, тело) => обёртка(класс, тело, раздел);
  const печати = [];
  (д.letters || []).reduce((прошлый, l) => { const п = восковаяПечать(l, д.письмо(l.status).ключ, д.воск ? д.воск(l) : 'var(--hud-accent)', прошлый); печати.push(п); return п.герб; }, -1);
  const луна = `<i class="m-moon" style="--lit:${д.луна?.свет ?? .5};--side:${д.луна?.сторона ?? 1}" aria-hidden="true"></i>`;
  const имяЛуны = т(д.луна?.имя || '');
  const календарь = д.календарь || '';
  const сноска = (n) => есть(n.footer) ? `<footer>${т(n.footer)}</footer>` : '';
  const записи = (рисунок) => (д.notes || []).map(рисунок).join('');
  const статус = (l) => { const с = д.письмо(l.status); return с.ключ === 'sealed' && вскрытоПисьмо(l) ? { ...с, текст: 'Печать сломана' } : с; };
  const мета = (l) => ярлыки(пилюля(статус(l).текст, ТОН_ПИСЬМА[статус(l).ключ]), тег('small', l.time, 'm-when'));
  const тело = (l) => `<div class="c-letter-body">${String(l.text || '').split(/\n+/).filter(есть).map(x => `<p>${т(x)}</p>`).join('')}
    ${есть(l.seal) ? `<small class="m-from">${подп('Печать')} · ${т(l.seal)}</small>` : ''}${есть(l.via) ? `<small class="m-from">${подп('Доставка')} · ${т(l.via)}</small>` : ''}</div>`;
  const запечатано = (l) => д.письмо(l.status).ключ === 'sealed';
  const почта = (лицо) => (д.letters || []).map((l, i) => `<details class="c-letter${запечатано(l) ? ' is-sealed' : ''}${печати[i].класс}"${печати[i].атр}><summary>${лицо(l)}${печати[i].html}</summary>${тело(l)}</details>`).join('');
  const бумаги = (рисунок) => (д.documents || []).map(doc => рисунок(doc, д.грамота(doc))).join('');
  const вещи = (рисунок) => (д.keepsakes || []).map(рисунок).join('');
  const от = (k) => есть(k.from) ? `<small class="m-from">${подп('От кого')} · ${т(k.from)}</small>` : '';
  // Роза в гербарии и медальоне: лепестки и стебель.
  const роза = '<span class="m-botanical" aria-hidden="true"><svg viewBox="0 0 40 60" focusable="false"><path class="stem" d="M20 58C19 46 22 38 20 24"/><path class="leaf" d="M20 44q-11-2-13-10 9 0 13 8zM21 36q10-3 12-11-9 1-12 9z"/><g class="bloom"><path d="M20 26q-9-1-9-9 0-6 9-8 9 2 9 8 0 8-9 9z"/><path class="petal" d="M20 12q-6 2-5 7 2 3 5 2 3 1 5-2 1-5-5-7z"/><path class="petal" d="M12 16q1 7 8 8M28 16q-1 7-8 8"/><path class="core" d="M18 16q2-3 4 0-2 2-4 0z"/></g></svg></span>';
  const пусто = (текст) => `<p class="m-empty">${текст}</p>`;

  switch (вид) {
    // Святцы
    case 'menologion': return лист('c-menologion', `<header class="c-month-mast">${знак('✦')}${h3}${знак('✦')}</header>
      <div class="c-month-layout"><div class="c-lunette">${луна}<small>${имяЛуны}</small></div></div>${календарь}`);
    case 'parish-calendar': return лист('c-parish-calendar', `<header class="c-parish-mast"><div class="c-bell" aria-hidden="true"><i></i></div><div>${h3}</div></header>
      ${календарь}${имяЛуны ? `<footer>${знак('☾')} ${имяЛуны}</footer>` : ''}`);
    case 'lunar-wheel': return лист('c-lunar-wheel', `${h3}<div class="c-orrery"><span class="c-orbit" aria-hidden="true"></span>${луна}<b>${имяЛуны}</b></div>${календарь}`);
    case 'orbits': case 'tide': return лист(`arc-sheet arc-${вид}`, `<header class="arc-mast"><i aria-hidden="true"></i>${h3}<i aria-hidden="true"></i></header>${лунныйПейзаж(вид === 'tide')}${имяЛуны ? `<small class="arc-moon-name">${имяЛуны}</small>` : ''}${календарь}`);
    // Записи
    case 'psalter-margins': return лист('c-psalter-margins', h3 + (записи(n => `<article class="c-marginalia">
      <aside class="psalter-vine" aria-hidden="true"><b>✥</b><em>❦</em><b>✥</b></aside><div>${тег('h4', n.title || 'Без заглавия')}${тег('small', n.time, 'm-when')}
      ${сБуквицей(n.text)}${сноска(n)}</div></article>`) || пусто('Перо сухое — записей нет')));
    case 'stitched-notebook': return лист('c-stitched-notebook', `<header>${h3}<span class="c-quill" aria-hidden="true"></span></header>` + (записи(n => `<article class="c-notebook-page">
      <div>${тег('h4', n.title || 'Без заглавия')}${тег('small', n.time, 'm-when')}</div>${тег('p', n.text)}${сноска(n)}</article>`) || пусто('Перо сухое — записей нет')));
    case 'candle-note': return лист('c-candle-note', `<header><div class="c-candle" aria-hidden="true"><i></i></div>${h3}</header>` + (записи(n => `<article class="c-loose-note">${тег('small', n.time, 'm-when')}${тег('h4', n.title || 'Без заглавия')}${тег('p', n.text)}${сноска(n)}</article>`) || пусто('Перо сухое — записей нет')));
    case 'roots': case 'spectral': return лист(`arc-sheet arc-${вид}`, `<header class="arc-mast"><i aria-hidden="true"></i>${h3}<i aria-hidden="true"></i></header>` + (записи(n => `<article><div class="arc-illustration art-${вид}" aria-hidden="true">${гравюра(вид)}</div><header>${тег('small', n.time, 'm-when')}${тег('h4', n.title || 'Без заглавия')}</header>${тег('p', n.text)}${тег('footer', n.footer)}</article>`) || пусто('Страницы пусты')));
    // Письма
    case 'folded-letters': return лист('c-folded-letters', `<header class="silk-head">${h3}</header><div class="silk-ribbon">
      ${(д.letters || []).map((l, i) => `<details class="silk-packet${запечатано(l) ? ' is-sealed' : ''}${печати[i].класс}"${печати[i].атр}><summary><span class="silk-knot" aria-hidden="true"></span><span>
        ${мета(l)}${тег('b', l.to || '—')}${есть(l.from) ? `<small class="m-from">${подп('От')} ${т(l.from)}</small>` : ''}</span>${печати[i].html}</summary>${тело(l)}</details>`).join('') || пусто('Писем нет — никто не писал')}</div>`);
    case 'courier-book': return лист('c-courier-book', `<header>${знак('⚑')}${h3}</header><div class="c-courier-track" aria-hidden="true"><i></i></div>` + (почта(l => `
      <span class="c-route">${тег('b', l.from || 'Неизвестный')}<span aria-hidden="true">→</span>${тег('b', l.to || '—')}</span>${мета(l)}`) || пусто('Писем нет — никто не писал')));
    case 'mail-chest': return лист('c-mail-chest', `<header><span class="c-mail-lock" aria-hidden="true"></span>${h3}</header>` + (почта(l => `
      <span class="c-letter-slot">${знак(запечатано(l) ? '✦' : '✉︎')}<span>${тег('b', l.from || 'Неизвестный')}${есть(l.to) ? `<small class="m-from">${подп('Для')} ${т(l.to)}</small>` : ''}${мета(l)}</span></span>`) || пусто('Писем нет — никто не писал')));
    case 'feather': case 'mirror': return лист(`arc-sheet arc-${вид}`, `<header class="arc-mast"><i aria-hidden="true"></i>${h3}<i aria-hidden="true"></i></header>` + ((д.letters || []).map((l, i) => `<details class="${запечатано(l) ? 'is-sealed' : ''}${печати[i].класс}"${печати[i].атр}><summary><div class="arc-illustration art-${вид}" aria-hidden="true">${гравюра(вид)}</div><span>${мета(l)}${тег('h4', l.to || '—')}${тег('small', l.from, 'm-from')}</span>${печати[i].html}</summary><section>${String(l.text || '').split(/\n+/).filter(есть).map(x => `<p>${т(x)}</p>`).join('')}${тег('small', l.seal)}${есть(l.via) ? `<small>${подп('Доставка')} · ${т(l.via)}</small>` : ''}</section></details>`).join('') || пусто('Посланий нет')));
    // Грамоты
    case 'sealed-charter': return лист('c-sealed-charter', h3 + (бумаги((doc, г) => `<article class="c-hanging${г.ключ ? ' st-' + г.ключ : ''}">
      <header>${тег('small', г.вид, 'm-kind')}${тег('h4', doc.title || 'Без заглавия')}</header>${сБуквицей(doc.text)}
      <footer>${тег('span', doc.seal, 'm-from')}${пилюля(г.статус, ТОН_ГРАМОТЫ[г.ключ])}</footer>${знак('⚜︎', 'm-mark m-seal')}</article>`) || пусто('Ни одной бумаги с печатью')));
    case 'town-register': return лист('c-town-register', `<header class="tube-head">${h3}</header>` + (бумаги((doc, г) => `<article class="archive-tube${г.ключ ? ' st-' + г.ключ : ''}"><header>${тег('small', г.вид, 'm-kind')}${тег('h4', doc.title || 'Без заглавия')}</header>
      <div class="tube-insert">${тег('p', doc.text)}<footer>${тег('small', doc.seal, 'm-from')}${пилюля(г.статус, ТОН_ГРАМОТЫ[г.ключ], 'b')}</footer></div></article>`) || пусто('Ни одной бумаги с печатью')));
    case 'roller-scroll': return лист('c-roller-scroll', h3 + (бумаги((doc, г) => `<article class="c-rolled-doc${г.ключ ? ' st-' + г.ключ : ''}"><span class="c-rod" aria-hidden="true"></span>
      <header>${тег('small', г.вид, 'm-kind')}${тег('h4', doc.title || 'Без заглавия')}</header>${тег('p', doc.text)}
      <footer>${знак('✦', 'm-mark m-seal')}<span>${т(doc.seal || '')}${пилюля(г.статус, ТОН_ГРАМОТЫ[г.ключ])}</span></footer><span class="c-rod is-bottom" aria-hidden="true"></span></article>`) || пусто('Ни одной бумаги с печатью')));
    case 'basalt': case 'ribbon': return лист(`arc-sheet arc-${вид}`, `<header class="arc-mast"><i aria-hidden="true"></i>${h3}<i aria-hidden="true"></i></header>` + (бумаги((doc, г) => `<article><div class="arc-illustration art-${вид}" aria-hidden="true">${гравюра(вид)}</div>${тег('small', г.вид, 'm-kind')}${тег('h4', doc.title || 'Без заглавия')}${тег('p', doc.text)}<footer>${тег('small', doc.seal, 'm-from')}${пилюля(г.статус, ТОН_ГРАМОТЫ[г.ключ], 'b')}</footer></article>`) || пусто('Свитков нет')));
    // Памятки
    case 'herbarium': return лист('c-herbarium', h3 + (вещи(k => `<figure class="c-herbarium"><div>${роза}</div><figcaption>${тег('h4', k.title || 'Вещица')}${тег('p', k.desc)}${от(k)}</figcaption></figure>`) || пусто('Памятных вещей нет')));
    case 'tied-tags': return лист('c-tied-tags', h3 + (вещи(k => `<article class="c-tied-tag"><span class="c-string" aria-hidden="true"></span>${тег('h4', k.title || 'Вещица')}${от(k)}${тег('p', k.desc)}</article>`) || пусто('Памятных вещей нет')));
    case 'memory-locket': return лист('c-memory-locket', h3 + (вещи(k => `<figure class="c-locket"><div class="c-locket-lid">${роза}</div><figcaption>${тег('h4', k.title || 'Вещица')}${тег('p', k.desc)}${от(k)}</figcaption></figure>`) || пусто('Памятных вещей нет')));
    case 'amber': case 'chain': return лист(`arc-sheet arc-${вид}`, `<header class="arc-mast"><i aria-hidden="true"></i>${h3}<i aria-hidden="true"></i></header>` + (вещи(k => `<figure><div class="arc-illustration art-${вид}" aria-hidden="true">${гравюра(вид)}</div><figcaption>${тег('h4', k.title || 'Вещица')}${тег('p', k.desc)}${тег('small', k.from, 'm-from')}</figcaption></figure>`) || пусто('Оберегов нет')));
    default: return '';
  }
}

// --- Мир ------------------------------------------------------------------------------
const ткацкий = `<div class="chronicle-loom" aria-hidden="true"><i></i><span>❖</span><i></i></div>`;
const навес = `<div class="fair-canopy" aria-hidden="true"><i></i><b>✵</b><i></i></div>`;
const доска = `<div class="w-tableau w-notice-board" aria-hidden="true"><i class="w-lantern"></i><i class="w-lantern"></i><i class="w-board-bell"></i></div>`;
const ТОН_ЗНАНИЯ = { 'Знает': 'leaf', 'Не знает': 'wax', 'Догадывается': 'gold' };
const строкаЗнания = (подпись, v) => есть(v) ? `<div><dt class="m-pill is-${ТОН_ЗНАНИЯ[подпись]}">${подпись}</dt><dd>${т(v)}</dd></div>` : '';
const ЧАРЫ_МИРА = {
  news: ['beacon', 'Вести астральной почты'], factions: ['constellation', 'Ордены и союзы'], meanwhile: ['portal', 'Тем временем'],
  city: ['ward', 'Чародейская стража'], comments: ['well', 'Шёпот духов'], events: ['lanterns', 'Праздники волшебного двора'],
};

/**
 * Блок вкладки «Мир» в средневековом (medieval) или чародейском (enchanted) виде.
 * блок: news | factions | meanwhile | city | comments | events; данные — уже
 * разобранные строки (как у world-views.js); заголовок — текст без значка;
 * сцена: { время, дата } — для времени суток «Тем временем».
 */
export function видМираСтарины(блок, вид, данные, заголовок, сцена = {}) {
  безЗнака = true;
  try { return видМира(блок, вид, данные, заголовок, сцена); } finally { безЗнака = false; }
}
function видМира(блок, вид, данные, заголовок, сцена) {
  if (!['medieval', 'enchanted', 'tavern'].includes(вид) || !условиеЭпохи(ЭПОХА_ВИДА[вид])) return '';
  const список = Array.isArray(данные) ? данные.filter(Boolean) : [];
  if (!список.length) return '';
  const з = т(заголовок);
  const секция = (тело) => `<div class="hud-world-section hud-mv-section" data-mv-block="${блок}">${тело}</div>`;
  if (вид === 'tavern') return блок === 'ads' ? секция(доскаТрактира(з, список)) : '';
  if (вид === 'enchanted') {
    const [сюжет, имя] = ЧАРЫ_МИРА[блок];
    const украшение = блок === 'meanwhile' ? `<div class="arc-window">${долина(частьДня(сцена.время, сцена.дата))}</div>` : панорама(сюжет);
    return секция(обёртка(`arc-sheet arc-${сюжет}`, `<header class="arc-mast"><i aria-hidden="true"></i><h3>${т(имя)}</h3><i aria-hidden="true"></i></header>${украшение}${телоЧар(блок, список)}`));
  }
  const шапки = {
    news: `<header class="w-merlon"><span aria-hidden="true"></span><h3>${з}</h3></header>`,
    factions: `<header class="w-herald"><span aria-hidden="true">⚜︎</span><h3>${з}</h3></header>`,
    meanwhile: `<header class="w-triptych valley-head">${долина(частьДня(сцена.время, сцена.дата))}<h3>${з}</h3></header>`,
    city: `<header class="w-city-head"><h3 class="w-plaque">${з}</h3>${доска}</header>`,
    comments: `<header class="w-hearth"><h3>${з}</h3>${каминМастерской()}</header>`,
    events: `<header class="w-fair"><h3>${з}</h3>${навес}</header>`,
  };
  return секция(обёртка(`m-${блок}`, `${шапки[блок]}<div class="m-content">${телоСтарины(блок, список)}</div>`, блок));
}

// Доска трактира: листки на кожаной доске, у каждого сургучный знак; нажатие
// раскрывает листок. о: { рубрика, заголовок, текст, контакт }.
const ЗНАКИ_ЛИСТКА = ['✥', '⚜︎', '❦', '✠', '❧'];
function доскаТрактира(з, список) {
  return `<div class="hud-mv"><section class="m-sheet tavern-board">
  <header class="tavern-board-head"><span aria-hidden="true">❧</span><h3>${з}</h3><span aria-hidden="true">❧</span></header>
  <div class="tavern-notices">${список.map((о) => { const тело = есть(о.текст) || есть(о.контакт); return `<details class="tavern-notice${тело ? '' : ' is-plain'}">
    <summary><span class="tavern-seal" aria-hidden="true">${ЗНАКИ_ЛИСТКА[hudHashSeed(String(о.заголовок || '') + String(о.текст || '')) % ЗНАКИ_ЛИСТКА.length]}</span><span>${тег('small', о.рубрика)}
      ${тег('strong', о.заголовок || о.текст)}</span></summary>
    ${тело ? `<div class="tavern-notice-body">${тег('p', о.текст)}${тег('footer', о.контакт)}</div>` : ''}
  </details>`; }).join('')}</div></section></div>`;
}

// Длинный комментарий — сначала две строки, по нажатию весь (css: blockquote[data-clamp]).
const ДЛИННЫЙ = 90;
const длинный = (текст) => String(текст || '').trim().length > ДЛИННЫЙ ? ' wl-item" data-wl-item data-clamp role="button" tabindex="0" aria-expanded="false' : '';
const стрелка = (текст) => String(текст || '').trim().length > ДЛИННЫЙ ? '<span class="wl-chev" aria-hidden="true"></span>' : '';

function телоСтарины(блок, список) {
  switch (блок) {
    // Вести с задержкой (render/medieval-life.js): с.весть — откуда и какой давности, с.bare — текст без приписки.
    case 'news': return список.map((с, i) => { const тело = с.весть ? с.bare : с.body; const абзац = есть(тело) ? `<p class="${i === 0 && /^\p{L}/u.test(тело.trim()) ? 'm-drop' : ''}">${т(тело)}</p>` : ''; return `<article class="m-proclamation${пункт(абзац)}">${тег('h4', с.title)}${с.весть || ''}${подробно(абзац)}</article>`; }).join('');
    case 'factions': return `<div class="m-banners">${список.map((ф, i) => `<article class="m-banner${пункт(есть(ф.почему))}">
      <div class="w-armorial" aria-hidden="true"><i></i>${знак(['⚜︎', '✿', '◆'][i % 3], 'm-mark m-shield')}</div>
      <div class="w-faction-copy">${тег('h4', ф.кто)}${пилюля(ф.как, тонРепутации(ф.число))}
      ${ф.число === null || ф.число === undefined ? '' : `<div class="w-reputation${ф.число < 0 ? ' is-negative' : ''}">
        <div class="w-balance" aria-hidden="true"><i style="--score-size:${Math.min(100, Math.abs(ф.число)) / 2}%"></i></div>
        <strong class="m-score" aria-label="Репутация ${ф.число}">${ф.число > 0 ? '+' : ''}${ф.число}</strong></div>`}${подробно(тег('p', ф.почему))}</div></article>`).join('')}</div>`;
    case 'meanwhile': return список.map(е => { const знания = строкаЗнания('Знает', е.знает) + строкаЗнания('Не знает', е.неЗнает) + строкаЗнания('Догадывается', е.догадки); const тело = сБуквицей(е.текст) + (знания ? `<dl>${знания}</dl>` : ''); return `<article class="m-scene${пункт(тело)}">${ткацкий}
      <div>${тег('h4', е.имя)}${тег('small', е.где, 'm-where')}${подробно(тело)}</div></article>`; }).join('');
    case 'city': return список.map(е => `<article class="m-decree${пункт(есть(е.текст))}"><i class="w-pin" aria-hidden="true"></i><div>${тег('h4', е.подпись)}${подробно(тег('p', е.текст))}</div></article>`).join('');
    case 'comments': return список.map(к => `<blockquote class="m-voice${длинный(к.text)}">${тег('p', к.text)}${тег('cite', к.name)}${стрелка(к.text)}</blockquote>`).join('');
    case 'events': return список.map((е, i) => `<article class="m-pennant${пункт(есть(е.где))}">${знак(['⚑', '♪', '❦'][i % 3], 'm-mark')}<div>${тег('h4', е.название)}${подробно(тег('small', е.где, 'm-where'))}</div></article>`).join('');
    default: return '';
  }
}

function телоЧар(блок, список) {
  switch (блок) {
    case 'news': return список.map(с => { const тело = тег('p', с.весть ? с.bare : с.body); return `<article class="${пункт(тело).trim()}">${тег('h4', с.title)}${с.весть || ''}${подробно(тело)}</article>`; }).join('');
    case 'factions': return список.map(ф => `<article class="${пункт(есть(ф.почему)).trim()}">${ф.число === null || ф.число === undefined ? '' : `<strong class="${ф.число < 0 ? 'is-negative' : ''}">${ф.число}</strong>`}${тег('h4', ф.кто)}${пилюля(ф.как, тонРепутации(ф.число))}${подробно(тег('p', ф.почему))}</article>`).join('');
    case 'meanwhile': return список.map(е => { const тело = тег('p', е.текст) + [['Знает', е.знает], ['Не знает', е.неЗнает], ['Догадывается', е.догадки]].filter(([, v]) => есть(v)).map(([к, v]) => `<p class="m-know">${пилюля(к, ТОН_ЗНАНИЯ[к], 'b')} ${т(v)}</p>`).join(''); return `<article class="${пункт(тело).trim()}">${тег('h4', е.имя)}${тег('small', е.где, 'm-where')}${подробно(тело)}</article>`; }).join('');
    case 'city': return список.map(е => `<article class="${пункт(есть(е.текст)).trim()}">${тег('h4', е.подпись)}${подробно(тег('p', е.текст))}</article>`).join('');
    case 'comments': return список.map(к => `<blockquote class="${длинный(к.text).trim()}">${тег('p', к.text)}${тег('cite', к.name)}${стрелка(к.text)}</blockquote>`).join('');
    case 'events': return список.map(е => `<article class="${пункт(есть(е.где)).trim()}">${тег('h4', е.название)}${подробно(тег('small', е.где, 'm-where'))}</article>`).join('');
    default: return '';
  }
}
