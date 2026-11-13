// hud-manager/render/views-plus.js
//
// Дополнительные виды новых блоков (Кастомизация → Вид блоков): шрамы
// доверия, приглашения, «Не знает», вес и рост, конец беременности,
// обещания, «Тем временем», «Кто что знает». Первый вид каждого блока —
// прежний, его рисуют сами блоки; здесь только новые. Данные те же —
// модель ничего нового не пишет. Оформление — css/views-plus.css.

import { escapeHtml, applyTooltips, hudHashSeed, инициалыИмени } from '../utils.js?v=23.89.14';
import { лицоЧеловека as лицо } from './views.js?v=23.89.14';
import { ико } from './view-icons.js?v=23.89.14';

const э = (s) => escapeHtml(String(s ?? ''));
const огр = (v, a, b) => Math.max(a, Math.min(b, v));
const ф = (n) => Number(n).toFixed(1);
const первое = (имя) => String(имя || '').trim().split(/\s+/)[0];
// Псевдослучайное, но одинаковое каждый ход: трещины, швы, наклон.
const сид = (s, i = 0) => { let h = hudHashSeed(String(s) + '#' + i) >>> 0; return () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h >>> 8) / 16777216; }; };

// --- Шрамы доверия ----------------------------------------------------------
// шрамы — [{ id, кому, почему, было, стало }]; кнопка(з) — «убрать шрам».

/** Кинцуги: глазурованная чаша на ножке, трещины залиты золотом, с ветками и золотой пылью. */
function шрамыКинцуги(шрамы, кнопка) {
  const id = 'k' + (hudHashSeed(шрамы.map(з => з.id).join()) >>> 0).toString(36);
  // Ширина чаши на высоте y: по ней трещина не выходит за край.
  const полуширина = (y) => 58 * Math.sqrt(Math.max(0, 1 - ((y - 24) / 50) ** 2));
  const трещины = шрамы.map((з, i) => {
    const r = сид(з.id || з.почему, i);
    const глубина = огр(((з.было ?? 80) - (з.стало ?? 60)) / 40, .25, 1);
    // Трещины расходятся по всей чаше, а не толпятся в середине; клонятся к своему краю.
    const доля = (i + .5) / шрамы.length - .5;
    const наклон = Math.sign(доля || (r() - .5));
    let x = 70 + доля * 88 + (r() - .5) * 8, y = 26;
    const точки = [[x, y]];
    const шагов = 4 + Math.round(глубина * 3);
    for (let k = 0; k < шагов; k++) { y += (44 * (.45 + глубина * .55) / шагов) * (.75 + r() * .5); const w = полуширина(y) * .82; x = огр(x + (r() - .5) * 8 + наклон * 1.6, 70 - w, 70 + w); точки.push([x, y]); }
    // Плавная линия через середины отрезков: золотой шов, а не молния.
    const путь = 'M' + ф(точки[0][0]) + ' ' + ф(точки[0][1]) + точки.slice(1, -1).map(([a, b], k) => { const [c, d] = точки[k + 2]; return ' Q' + ф(a) + ' ' + ф(b) + ' ' + ф((a + c) / 2) + ' ' + ф((b + d) / 2); }).join('')
      + ' L' + ф(точки[точки.length - 1][0]) + ' ' + ф(точки[точки.length - 1][1]);
    // Ветки: короткие плавные отростки от середины главной трещины.
    const ветки = [1, 3].filter(k => k < точки.length - 1).map(k => { const [a, b] = точки[k], сторона = r() > .5 ? 1 : -1; return 'M' + ф(a) + ' ' + ф(b) + ' Q' + ф(a + сторона * (4 + r() * 4)) + ' ' + ф(b + 2 + r() * 3) + ' ' + ф(a + сторона * (8 + r() * 5)) + ' ' + ф(b + 7 + r() * 4); }).join(' ');
    const пыль = точки.slice(1).filter((_, k) => k % 2 === 0).map(([a, b], k) => '<circle class="dust" cx="' + ф(a + (r() - .5) * 7) + '" cy="' + ф(b + (r() - .5) * 5) + '" r="' + ф(.5 + r() * .7) + '" style="--d:' + ф(k * .4 + i * .2) + 's"/>').join('');
    const ширина = ф(1.1 + глубина * 1.5);
    return '<path class="seam" d="' + путь + '" style="stroke-width:' + ширина + '"/><path class="branch" d="' + ветки + '"/>'
      + '<path class="sheen" d="' + путь + '" style="stroke-width:' + ширина + ';--d:' + ф(i * .6) + 's"/>' + пыль;
  }).join('');
  const чаша = '<svg class="hud-vp-kin-bowl" viewBox="0 0 140 92" aria-hidden="true"><defs>'
    + '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--kin-glaze-hi)"/><stop offset=".55" stop-color="var(--kin-glaze)"/><stop offset="1" stop-color="var(--kin-glaze-lo)"/></linearGradient>'
    + '<radialGradient id="' + id + 'i" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>'
    + '<linearGradient id="' + id + 'au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#e9b949"/><stop offset="1" stop-color="#a8741c"/></linearGradient></defs>'
    + '<ellipse class="shadow" cx="70" cy="86" rx="40" ry="4"/>'
    + '<path class="foot" d="M52 74 L55 83 Q70 86 85 83 L88 74 Z" fill="url(#' + id + 'g)"/>'
    + '<path class="body" d="M12 24 C12 52 36 76 70 76 C104 76 128 52 128 24 Z" fill="url(#' + id + 'g)"/>'
    + '<path class="band" d="M15 34 C26 42 46 47 70 47 C94 47 114 42 125 34"/>'
    + '<path class="gloss" d="M24 32 C26 48 36 60 48 66"/>'
    + '<ellipse class="rim" cx="70" cy="24" rx="58" ry="8"/><ellipse class="inside" cx="70" cy="24" rx="53" ry="5.6" fill="url(#' + id + 'i)"/>'
    + '<g class="cracks" style="--au:url(#' + id + 'au)">' + трещины + '</g></svg>';
  const список = шрамы.map(з => '<li class="hud-vp-kin-item"><i class="hud-vp-kin-dot" aria-hidden="true"></i><div><b>' + э(з.кому) + '</b>'
    + '<span>' + (з.почему ? applyTooltips(з.почему) : 'шрам') + '</span></div><em title="Доверие упало с ' + э(з.было) + ' до ' + э(з.стало) + '">' + э(з.было) + '<i aria-hidden="true">→</i>' + э(з.стало) + '</em>' + кнопка(з) + '</li>').join('');
  return '<div class="hud-v hud-vp-kin hud-v-card">' + чаша + '<div class="hud-vp-kin-side"><span class="hud-vp-cap">склеено золотом</span><ul>' + список + '</ul></div></div>';
}

/** Швы: зашитый разрез под каждой обидой — чем глубже падение, тем длиннее шов. */
function шрамыШвы(шрамы, кнопка) {
  return `<div class="hud-v hud-vp-seams">` + шрамы.map((з, i) => {
    const падение = Math.max(0, (з.было ?? 0) - (з.стало ?? 0));
    const стежков = огр(Math.round(падение / 4), 3, 14);
    const r = сид(з.id || з.почему, i);
    // Зашитый разрез: чуть волнистый рубец и косые стежки поперёк него, с
    // проколами на концах — нитка, а не деления линейки. Ширина рисунка
    // тянется под длину шва; линии и проколы от этого не толстеют.
    const Ш = стежков * 22 + 20;
    const волна = Array.from({ length: стежков + 1 }, (_, k) => [10 + k * 22, 12 + (r() - .5) * 2.4]);
    const рубец = 'M4 12 ' + волна.map(([x, y]) => 'L' + x + ' ' + ф(y)).join(' ') + ' L' + (Ш - 4) + ' 12';
    const стежки = Array.from({ length: стежков }, (_, k) => {
      const x = 21 + k * 22 + (r() - .5) * 3, н = 3 + r() * 1.6;
      return `<path class="thread" d="M${ф(x - н)} 4.5 L${ф(x + н)} 19.5"/><path class="hole" d="M${ф(x - н)} 4.5 h.01 M${ф(x + н)} 19.5 h.01"/>`;
    }).join('');
    const шов = `<svg class="hud-vp-seam-svg" viewBox="0 0 ${Ш} 24" preserveAspectRatio="none" aria-hidden="true"><path class="welt" d="${рубец}"/><path class="cut" d="${рубец}"/><path class="hi" d="${рубец}"/>${стежки}</svg>`;
    return `<div class="hud-vp-seam"><div class="hud-vp-seam-head"><b>${э(з.кому)}</b><em>−${падение}</em>${кнопка(з)}</div>`
      + `<div class="hud-vp-seam-cut" style="--w:${огр(падение * 2.2, 34, 100)}%" title="Доверие упало с ${э(з.было)} до ${э(з.стало)}">${шов}</div>`
      + (з.почему ? `<p>${applyTooltips(з.почему)}</p>` : '') + `</div>`;
  }).join('') + `</div>`;
}

/** Заплатки: сердце, на котором каждая обида — нашитая заплатка; чем глубже, тем больше и краснее. */
function шрамыЗаплатки(шрамы, кнопка) {
  const места = [[34, 30, -14], [64, 34, 12], [48, 52, -6], [30, 50, 18], [68, 56, -16], [50, 28, 8]];
  const заплатки = шрамы.slice(0, места.length).map((з, i) => {
    const [x, y, а] = места[i];
    const глубина = огр(((з.было ?? 80) - (з.стало ?? 60)) / 40, .25, 1);
    const w = ф(12 + глубина * 10), h = ф(9 + глубина * 7);
    return '<g class="patch" style="--t:' + ф(глубина) + '" transform="translate(' + x + ' ' + y + ') rotate(' + а + ')"><rect x="' + ф(-w / 2) + '" y="' + ф(-h / 2) + '" width="' + w + '" height="' + h + '" rx="2"/>'
      + '<rect class="stitch" x="' + ф(-w / 2 + 1.6) + '" y="' + ф(-h / 2 + 1.6) + '" width="' + ф(w - 3.2) + '" height="' + ф(h - 3.2) + '" rx="1.2"/><text y="2.4">' + (i + 1) + '</text></g>';
  }).join('');
  const сердце = '<svg class="hud-vp-heart" viewBox="0 0 100 90" aria-hidden="true"><g class="beat"><path class="shape" d="M50 84 C20 64 6 48 6 30 C6 16 17 6 30 6 C39 6 46 11 50 18 C54 11 61 6 70 6 C83 6 94 16 94 30 C94 48 80 64 50 84Z"/>'
    + '<path class="gloss" d="M20 24 C22 16 28 12 34 12"/>' + заплатки + '</g></svg>';
  const список = шрамы.map((з, i) => '<li><b class="hud-vp-heart-n">' + (i + 1) + '</b><div><b>' + э(з.кому) + '</b><span>' + (з.почему ? applyTooltips(з.почему) : 'шрам') + '</span></div>'
    + '<em title="Доверие упало с ' + э(з.было) + ' до ' + э(з.стало) + '">−' + Math.max(0, (з.было ?? 0) - (з.стало ?? 0)) + '</em>' + кнопка(з) + '</li>').join('');
  return '<div class="hud-v hud-vp-patches hud-v-card">' + сердце + '<div class="hud-vp-patches-side"><span class="hud-vp-cap">заштопано</span><ul>' + список + '</ul></div></div>';
}

export function видШрамов(шрамы, вид, кнопка = () => '') {
  if (!Array.isArray(шрамы) || !шрамы.length) return '';
  if (вид === 'kintsugi') return шрамыКинцуги(шрамы, кнопка);
  if (вид === 'seams') return шрамыШвы(шрамы, кнопка);
  if (вид === 'patches') return шрамыЗаплатки(шрамы, кнопка);
  return '';
}

// --- Приглашения --------------------------------------------------------------
// все — [{ id, кто, что, когда }]; кнопки — data-hud-invite + data-val.

const кнопкиОтвета = (п, да = 'Принять', нет = 'Отклонить') => `<button type="button" class="hud-vp-rsvp is-yes" data-hud-invite="${э(п.id)}" data-val="yes">${да}</button>`
  + `<button type="button" class="hud-vp-rsvp is-no" data-hud-invite="${э(п.id)}" data-val="no">${нет}</button>`;

/** Пригласительная: плотная карточка с тиснением, рамкой и RSVP. */
function приглашенияГравюра(все) {
  return `<div class="hud-v hud-vp-engr-list">` + все.map(п => `<div class="hud-vp-engr"><span class="hud-vp-engr-orn" aria-hidden="true">❦</span>`
    + `<small class="hud-vp-engr-eye">приглашение</small><span class="hud-vp-inv-face">${лицо(п.кто || '?')}</span><b class="hud-vp-engr-who">${э(п.кто)}</b><span class="hud-vp-engr-ask">просит вас быть</span>`
    + `<p class="hud-vp-engr-what">${applyTooltips(п.что)}</p>${п.когда ? `<span class="hud-vp-engr-when">${э(п.когда)}</span>` : ''}`
    + `<div class="hud-vp-engr-rsvp"><small>R.S.V.P.</small>${кнопкиОтвета(п, 'Приду', 'Не смогу')}</div></div>`).join('') + `</div>`;
}

/** Сургуч: конверт с клапаном и бечёвкой, печать с монограммой и потёками воска, письмо выглядывает снизу. */
function приглашенияСургуч(все) {
  return '<div class="hud-v hud-vp-seal-list">' + все.map(п => {
    const буква = (инициалыИмени(п.кто || '?') || '?').slice(0, 1);
    const r = сид(п.id || п.кто);
    // Край печати: неровный круг с тремя потёками.
    const край = Array.from({ length: 18 }, (_, k) => { const а = k / 18 * 2 * Math.PI, р = 15 + (r() - .5) * 2.4 + (k % 6 === 2 ? 3.2 : 0); return ф(20 + р * Math.cos(а)) + ' ' + ф(20 + р * Math.sin(а)); });
    const печать = '<svg class="hud-vp-seal-wax" viewBox="0 0 40 40" aria-hidden="true"><path class="wax" d="M' + край.join(' L') + 'Z"/>'
      + '<circle class="ring" cx="20" cy="20" r="10.5"/><circle class="ring2" cx="20" cy="20" r="12.5"/><text x="20" y="24.6">' + э(буква) + '</text><path class="shine" d="M12 13 Q16 9 22 9"/></svg>';
    return '<div class="hud-vp-seal"><div class="hud-vp-seal-env" aria-hidden="true"><svg viewBox="0 0 200 96" preserveAspectRatio="none">'
      + '<path class="back" d="M0 0 H200 V96 H0 Z"/><path class="side" d="M0 96 L84 46 M200 96 L116 46"/><path class="bottom" d="M0 96 L100 40 L200 96 Z"/><path class="flap" d="M0 0 H200 L100 60 Z"/><path class="flap-edge" d="M0 0 L100 60 L200 0"/></svg>'
      + '<i class="hud-vp-seal-twine"></i>' + печать + '</div>'
      + '<div class="hud-vp-seal-letter"><small class="hud-vp-inv-from"><span class="hud-vp-inv-face">' + лицо(п.кто || '?') + '</span>от <b>' + э(п.кто) + '</b></small><p>' + applyTooltips(п.что) + '</p>' + (п.когда ? '<span class="hud-vp-seal-when">' + ико('hourglass') + э(п.когда) + '</span>' : '')
      + '<div class="hud-vp-seal-acts">' + кнопкиОтвета(п, 'Принять', 'Отказаться') + '</div></div></div>';
  }).join('') + '</div>';
}

/** Самолётик: бумажный самолётик прилетел по пунктиру и развернулся в записку со сгибами. */
function приглашенияСамолётик(все) {
  return '<div class="hud-v hud-vp-plane-list">' + все.map(п => '<div class="hud-vp-plane"><svg class="hud-vp-plane-sky" viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true">'
    + '<path class="trail" d="M4 40 C40 40 52 10 92 18 S150 34 170 16"/></svg>'
    + '<svg class="hud-vp-plane-jet" viewBox="0 0 40 30" aria-hidden="true"><path class="wing" d="M2 14 L38 2 L18 28 L15 18 Z"/><path class="fold" d="M38 2 L15 18 L13 24 Z"/><path class="crease" d="M2 14 L15 18 M38 2 L15 18"/></svg>'
    + '<div class="hud-vp-plane-note"><small class="hud-vp-inv-from"><span class="hud-vp-inv-face">' + лицо(п.кто || '?') + '</span>от <b>' + э(п.кто) + '</b></small><p>' + applyTooltips(п.что) + '</p>' + (п.когда ? '<span class="hud-vp-plane-when">' + ико('hourglass') + э(п.когда) + '</span>' : '')
    + '<div class="hud-vp-plane-acts">' + кнопкиОтвета(п, 'Лечу', 'Не в этот раз') + '</div></div></div>').join('') + '</div>';
}

export function видПриглашений(все, вид) {
  if (!Array.isArray(все) || !все.length) return '';
  if (вид === 'engraved') return приглашенияГравюра(все);
  if (вид === 'seal') return приглашенияСургуч(все);
  if (вид === 'plane') return приглашенияСамолётик(все);
  return '';
}

// --- Не знает -----------------------------------------------------------------

const фактыСписком = (value) => String(value ?? '').split(/\s*;\s*/).map(s => s.trim()).filter(s => s && !/^(empty|none|нет|—|-)$/i.test(s));

/** Под грифом: папка дела со скрепкой и штампом, фото человека, строки закрашены — нажатие открывает. */
function неЗнаетГриф(факты, имя) {
  const номер = String((hudHashSeed(имя || '') >>> 0) % 900 + 100);
  return '<div class="hud-v hud-vp-redact"><span class="hud-vp-redact-tab"><span>дело №</span> ' + номер + '</span><i class="hud-vp-redact-clip" aria-hidden="true"></i>'
    + '<span class="hud-vp-redact-photo">' + лицо(имя || '?') + '</span><span class="hud-vp-redact-stamp" aria-hidden="true">секретно</span>'
    + '<div class="hud-vp-redact-head"><span>' + ико('lock') + '<b>' + э(первое(имя) || 'Он') + '</b> не знает</span><em>' + факты.length + '</em></div><small class="hud-vp-redact-hint">нажмите на строку, чтобы прочитать</small>'
    + '<ol>' + факты.map((ф, i) => '<li><small>' + String(i + 1).padStart(2, '0') + '</small><span class="hud-vp-redact-bar" tabindex="0" title="Нажмите, чтобы прочитать">' + applyTooltips(ф) + '</span></li>').join('') + '</ol>'
    + '<i class="hud-vp-redact-scan" aria-hidden="true"></i></div>';
}

/** Слепое пятно: глаз, у которого закрыто столько долей, сколько он не видит. */
function неЗнаетПятно(факты, имя) {
  const n = факты.length, доли = Math.max(n, 6);
  const сектор = (i) => {
    const а1 = (i / доли) * 2 * Math.PI - Math.PI / 2, а2 = ((i + 1) / доли) * 2 * Math.PI - Math.PI / 2;
    const p = (а, r) => `${ф(24 + r * Math.cos(а))} ${ф(24 + r * Math.sin(а))}`;
    return `<path class="${i < n ? 'is-blind' : 'is-seen'}" d="M${p(а1, 5)} L${p(а1, 11)} A11 11 0 0 1 ${p(а2, 11)} L${p(а2, 5)} A5 5 0 0 0 ${p(а1, 5)} Z"/>`;
  };
  const глаз = `<svg class="hud-vp-blind-eye" viewBox="0 0 48 48" aria-hidden="true"><path class="lid" d="M2 24 C12 8 36 8 46 24 C36 40 12 40 2 24 Z"/>`
    + Array.from({ length: доли }, (_, i) => сектор(i)).join('') + `<circle class="pupil" cx="24" cy="24" r="4"/></svg>`;
  return `<div class="hud-v hud-vp-blind hud-v-card">${глаз}<div class="hud-vp-blind-side"><span class="hud-vp-cap"><b>${э(первое(имя) || 'Он')}</b> не видит</span>`
    + `<ul>${факты.map(ф => `<li>${ико('mask')}<span>${applyTooltips(ф)}</span></li>`).join('')}</ul></div></div>`;
}

/** Пазл: картина человека с выпавшими кусочками — каждый пропуск то, чего он не знает. */
function неЗнаетПазл(факты, имя) {
  const кол = 4, n = факты.length, всего = Math.max(8, Math.ceil((n + 4) / кол) * кол), ряд = всего / кол, s = 24;
  const r = сид(имя + факты.join('|'));
  // Выступы: правый край куска и нижний — общие с соседом, поэтому направление одно на двоих.
  const вправо = Array.from({ length: ряд }, () => Array.from({ length: кол }, () => (r() > .5 ? 1 : -1)));
  const вниз = Array.from({ length: ряд }, () => Array.from({ length: кол }, () => (r() > .5 ? 1 : -1)));
  const край = (x0, y0, x1, y1, d) => {
    if (!d) return 'L' + ф(x1) + ' ' + ф(y1);
    const dx = x1 - x0, dy = y1 - y0, nx = -dy / s, ny = dx / s, т = (k) => [x0 + dx * k, y0 + dy * k];
    const [a1, b1] = т(.36), [a2, b2] = т(.64), h = s * .28 * d;
    return 'L' + ф(a1) + ' ' + ф(b1) + ' C' + ф(a1 + nx * h - dx * .08) + ' ' + ф(b1 + ny * h - dy * .08) + ' ' + ф(a2 + nx * h + dx * .08) + ' ' + ф(b2 + ny * h + dy * .08) + ' ' + ф(a2) + ' ' + ф(b2) + ' L' + ф(x1) + ' ' + ф(y1);
  };
  const кусок = (i, j) => {
    const x = 4 + j * s, y = 4 + i * s;
    const верх = i ? -вниз[i - 1][j] : 0, право = j < кол - 1 ? вправо[i][j] : 0, низ = i < ряд - 1 ? вниз[i][j] : 0, лево = j ? -вправо[i][j - 1] : 0;
    return 'M' + x + ' ' + y + край(x, y, x + s, y, -верх) + край(x + s, y, x + s, y + s, -право) + край(x + s, y + s, x, y + s, -низ) + край(x, y + s, x, y, -лево) + 'Z';
  };
  // Пропуски — разбросаны, но одинаково каждый ход.
  const все = Array.from({ length: всего }, (_, k) => k);
  for (let k = все.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [все[k], все[m]] = [все[m], все[k]]; }
  const пусто = new Map(все.slice(0, n).map((k, i) => [k, i + 1]));
  const куски = Array.from({ length: всего }, (_, k) => { const i = Math.floor(k / кол), j = k % кол, d = кусок(i, j);
    return пусто.has(k) ? '<g class="hole"><path d="' + d + '"/><text x="' + (4 + j * s + s / 2) + '" y="' + (4 + i * s + s / 2 + 3.5) + '">' + пусто.get(k) + '</text></g>' : '<path class="piece" style="--k:' + (k % 5) + '" d="' + d + '"/>'; }).join('');
  const лицоНаПазле = '<div class="hud-vp-puzzle-face">' + лицо(имя || '?') + '</div>';
  return '<div class="hud-v hud-vp-puzzle hud-v-card"><div class="hud-vp-puzzle-art">' + лицоНаПазле + '<svg viewBox="0 0 ' + (8 + кол * s) + ' ' + (8 + ряд * s) + '" aria-hidden="true">' + куски + '</svg></div>'
    + '<div class="hud-vp-puzzle-side"><span class="hud-vp-cap"><b>' + э(первое(имя) || 'Он') + '</b> не знает</span><ol>' + факты.map((ф, i) => '<li><b>' + (i + 1) + '</b><span>' + applyTooltips(ф) + '</span></li>').join('') + '</ol></div></div>';
}

export function видНеЗнает(value, имя, вид) {
  const факты = фактыСписком(value);
  if (!факты.length) return '';
  if (вид === 'redacted') return неЗнаетГриф(факты, имя);
  if (вид === 'blindspot') return неЗнаетПятно(факты, имя);
  if (вид === 'puzzle') return неЗнаетПазл(факты, имя);
  return '';
}

// --- Вес и рост ---------------------------------------------------------------
// з — запись веса (turn-notes.js), сдвиг — кг с прошлого дня, срок — « за N дн.»,
// история — [{ вес, дата }] по дням.

const ЗОНЫ_ИМТ = [[0, 18.5, 'дефицит', 'is-low'], [18.5, 25, 'норма', 'is-ok'], [25, 30, 'избыток', 'is-high'], [30, 99, 'ожирение', 'is-over']];
const зонаИМТ = (имт) => ЗОНЫ_ИМТ.find(([a, b]) => имт >= a && имт < b) || ЗОНЫ_ИМТ[1];
const чипСдвига = (сдвиг, срок) => сдвиг ? `<em class="hud-vp-shift ${сдвиг > 0 ? 'up' : 'down'}">${сдвиг > 0 ? '+' : ''}${сдвиг} кг${э(срок)}</em>` : '';

/** Напольные весы: хромированный обод, стекло с бликом, стрелка на шкале и зелёное табло, резиновая площадка. */
function весВесы(з, имт, сдвиг, срок) {
  const макс = Math.max(150, Math.ceil(з.вес / 50) * 50);
  const угол = (кг) => Math.PI + огр(кг / макс, 0, 1) * Math.PI;
  const p = (кг, r) => ф(60 + r * Math.cos(угол(кг))) + ' ' + ф(46 + r * Math.sin(угол(кг)));
  const засечки = Array.from({ length: макс / 5 + 1 }, (_, i) => { const кг = i * 5, большая = кг % 50 === 0, средняя = кг % 10 === 0; return '<path class="tick' + (большая ? ' is-big' : средняя ? '' : ' is-small') + '" d="M' + p(кг, 36) + ' L' + p(кг, большая ? 28 : средняя ? 31.5 : 33.5) + '"/>'; }).join('');
  const цифры = Array.from({ length: макс / 25 + 1 }, (_, i) => i * 25).map(кг => { const [x, y] = p(кг, 22.5).split(' '); return '<text x="' + x + '" y="' + ф(+y + 1.8) + '">' + кг + '</text>'; }).join('');
  const [, , слово, класс] = имт ? зонаИМТ(имт) : [0, 0, '', ''];
  const точки = Array.from({ length: 24 }, (_, i) => '<i style="--x:' + (i % 8) + ';--y:' + Math.floor(i / 8) + '"></i>').join('');
  return '<div class="hud-v hud-vp-scale"><div class="hud-vp-scale-plate"><div class="hud-vp-scale-bezel"><svg class="hud-vp-scale-dial" viewBox="0 0 120 52" aria-hidden="true">'
    + '<path class="zone" d="M' + p(0, 37) + ' A37 37 0 0 1 ' + p(макс, 37) + '"/>' + засечки + цифры + '<g class="needle-g"><path class="needle" d="M60 46 L' + p(з.вес, 33) + '"/><path class="tail" d="M60 46 L' + p(з.вес + макс / 2, 6) + '"/></g><circle class="hub" cx="60" cy="46" r="3.2"/><circle class="hub-cap" cx="60" cy="46" r="1.2"/></svg>'
    + '<i class="hud-vp-scale-glare" aria-hidden="true"></i></div>'
    + '<span class="hud-vp-scale-read"><b>' + э(з.вес) + '</b><small>кг</small></span><span class="hud-vp-scale-grip" aria-hidden="true">' + точки + '</span></div>'
    + '<div class="hud-vp-scale-facts">' + (з.рост ? '<span>' + ико('target') + э(з.рост) + ' см</span>' : '') + (имт ? '<span class="' + класс + '"><span>ИМТ ' + имт + '</span> · <span>' + слово + '</span></span>' : '') + чипСдвига(сдвиг, срок) + '</div></div>';
}

/** Силуэт: фигура в рост на линейке и шкала ИМТ с отметкой. */
function весСилуэт(з, имт, сдвиг, срок) {
  const рост = огр(Number(з.рост) || 170, 120, 210);
  const h = огр((рост - 100) / 110 * 56, 20, 56), ширина = огр((имт || 22) / 22, .7, 1.6);
  const y0 = 62 - h;
  const фигура = `<g class="fig" transform="translate(30 ${ф(y0)}) scale(${ф(ширина)} 1) translate(-30 0)">`
    + `<circle cx="30" cy="${ф(h * .1)}" r="${ф(h * .09)}"/><path d="M${ф(30 - h * .13)} ${ф(h * .22)} Q30 ${ф(h * .17)} ${ф(30 + h * .13)} ${ф(h * .22)} L${ф(30 + h * .15)} ${ф(h * .56)} L${ф(30 + h * .07)} ${ф(h * .56)} L${ф(30 + h * .07)} ${ф(h)} L${ф(30 - h * .07)} ${ф(h)} L${ф(30 - h * .07)} ${ф(h * .56)} L${ф(30 - h * .15)} ${ф(h * .56)} Z"/></g>`;
  const деления = [140, 160, 180, 200].map(с => { const y = 62 - (с - 100) / 110 * 56; return `<path class="mark" d="M4 ${ф(y)} H12"/><text x="14" y="${ф(y + 1.6)}">${с}</text>`; }).join('');
  const доля = (v) => огр((v - 15) / 20 * 100, 0, 100);
  const полоса = `<div class="hud-vp-bmi"><div class="hud-vp-bmi-band">${ЗОНЫ_ИМТ.map(([a, b, слово, к]) => `<i class="${к}" style="flex:${ф(доля(Math.min(b, 35)) - доля(Math.max(a, 15)))}" title="${слово}"></i>`).join('')}`
    + (имт ? `<b class="hud-vp-bmi-pin" style="left:${ф(доля(имт))}%"><span>${имт}</span></b>` : '') + `</div><div class="hud-vp-bmi-scale"><span>15</span><span>18,5</span><span>25</span><span>30</span><span>35</span></div></div>`;
  const [, , слово] = имт ? зонаИМТ(имт) : [0, 0, ''];
  return `<div class="hud-v hud-vp-sil hud-v-card"><svg class="hud-vp-sil-fig" viewBox="0 0 60 64" aria-hidden="true"><path class="floor" d="M2 62.5 H58"/>${деления}${фигура}</svg>`
    + `<div class="hud-vp-sil-side"><div class="hud-vp-sil-nums"><b>${э(з.вес)}<small> кг</small></b>${з.рост ? `<b>${э(з.рост)}<small> см</small></b>` : ''}</div>`
    + (имт ? `<span class="hud-vp-cap"><span>ИМТ</span> — <span>${слово}</span></span>${полоса}` : '') + чипСдвига(сдвиг, срок) + `</div></div>`;
}

/** Сантиметр: жёлтая портновская лента прокручена к росту, красная метка; вес — на бирке. */
function весСантиметр(з, имт, сдвиг, срок) {
  const рост = Math.round(Number(з.рост) || 0);
  const центр = рост || 170, от = центр - 15, до = центр + 15;
  const x = (см) => ф((см - от) / (до - от) * 100);
  const деления = Array.from({ length: до - от + 1 }, (_, k) => от + k).map(см => '<i class="' + (см % 10 === 0 ? 'is-big' : см % 5 === 0 ? 'is-mid' : '') + '" style="left:' + x(см) + '%"></i>' + (см % 5 === 0 && !(рост && Math.abs(см - рост) <= 3) ? '<b style="left:' + x(см) + '%">' + см + '</b>' : '')).join('');
  const [, , слово, класс] = имт ? зонаИМТ(имт) : [0, 0, '', ''];
  return '<div class="hud-v hud-vp-tape"><div class="hud-vp-tape-row"><svg class="hud-vp-tape-case" viewBox="0 0 40 40" aria-hidden="true"><circle class="body" cx="20" cy="20" r="18"/><circle class="ring" cx="20" cy="20" r="12"/><circle class="hub" cx="20" cy="20" r="3.4"/><path class="slot" d="M36 14 V26"/></svg>'
    + '<div class="hud-vp-tape-band">' + деления + (рост ? '<span class="hud-vp-tape-mark"><em>' + рост + ' см</em></span>' : '') + '</div></div>'
    + '<div class="hud-vp-tape-tag"><i class="hole" aria-hidden="true"></i><b>' + э(з.вес) + '<small> кг</small></b>' + (имт ? '<span class="' + класс + '"><span>ИМТ ' + имт + '</span> · <span>' + слово + '</span></span>' : '') + чипСдвига(сдвиг, срок) + '</div></div>';
}

export function видВеса(з, вид, { сдвиг = 0, срок = '', история = [] } = {}) {
  if (!з || !Number.isFinite(Number(з.вес))) return '';
  const имт = з.рост ? Math.round(з.вес / (з.рост / 100) ** 2 * 10) / 10 : null;
  if (вид === 'scale') return весВесы(з, имт, сдвиг, срок);
  if (вид === 'silhouette') return весСилуэт(з, имт, сдвиг, срок);
  if (вид === 'tape') return весСантиметр(з, имт, сдвиг, срок);
  return '';
}

// --- Конец беременности -------------------------------------------------------
// д — то, что уже посчитал блокПотери (render/pregnancy-loss.js): имя вида,
// неделя, дата, дней назад, вехи восстановления, подсказка и кнопки.

// «11-я неделя · 09.10 · 8 дн. назад» — каждый кусок своим узлом, чтобы переводчик узнал его.
const срокПотери = (д, сДнями) => [Number.isFinite(д.неделя) ? `${д.неделя}-я неделя` : '', д.датаТекст, сДнями && д.днейНазад !== null ? (д.днейНазад ? `${д.днейНазад} дн. назад` : 'сегодня') : '']
  .filter(Boolean).map(ч => `<span>${ч}</span>`).join('<span> · </span>');

/** Гербарий: лист бумаги с засушенной веткой под полосками ленты, подписанная этикетка, тихие строки. */
function потеряВеточка(д) {
  const лист = (x, y, вправо, к) => { const s = вправо ? 1 : -1; return '<path class="leaf" d="M' + x + ' ' + y + ' C' + (x + s * 6 * к) + ' ' + (y - 8 * к) + ' ' + (x + s * 17 * к) + ' ' + (y - 7 * к) + ' ' + (x + s * 21 * к) + ' ' + (y - 13 * к) + ' C' + (x + s * 16 * к) + ' ' + (y - 1 * к) + ' ' + (x + s * 7 * к) + ' ' + (y + 2 * к) + ' ' + x + ' ' + y + 'Z"/><path class="vein" d="M' + x + ' ' + y + ' Q' + (x + s * 10 * к) + ' ' + (y - 6 * к) + ' ' + (x + s * 20 * к) + ' ' + (y - 12.5 * к) + '"/>'; };
  const листья = [[40.4, 104, 0, 1.15], [40, 94, 1, 1.1], [40.6, 84, 0, 1], [41, 74, 1, .95], [41.4, 65, 0, .85], [41.2, 56, 1, .75], [41, 48, 0, .62], [40.8, 41, 1, .5]].map(([x, y, п, к]) => лист(x, y, !!п, к)).join('');
  const ветка = '<svg class="hud-vp-herb-art" viewBox="0 0 80 132" aria-hidden="true"><g class="sway">'
    + '<path class="stem" d="M40 126 C38 104 43 70 41 30"/><path class="twig" d="M40.5 88 C47 82 52 80 57 76"/><circle class="berry" cx="57.5" cy="75.5" r="2.2"/><circle class="berry" cx="54" cy="79" r="1.6"/>' + листья
    + '<path class="sepal" d="M41 31 c-5 -1 -7 -5 -7 -8 c2 2 5 3 7 3 c2 0 5 -1 7 -3 c0 3 -2 7 -7 8Z"/><path class="bud" d="M41 26 c-6 -4 -6 -14 0 -20 c6 6 6 16 0 20Z"/><path class="bud-line" d="M41 25 C38.5 19 39 11 41 6"/></g>'
    + '<path class="petal" d="M58 122 c4 -3 9 -2 10 1 c-3 3 -8 3 -10 -1Z"/></svg>';
  const вехи = д.вехи.map(в => '<li><span>' + в.подпись + '</span><b>' + в.текст + '</b></li>').join('');
  return '<div class="hud-v hud-vp-herb is-' + д.вид + '"><div class="hud-vp-herb-sheet"><i class="hud-vp-herb-tape t1" aria-hidden="true"></i><i class="hud-vp-herb-tape t2" aria-hidden="true"></i>' + ветка
    + '<div class="hud-vp-herb-label"><span class="hud-note-eye hud-section-title">Конец беременности</span><b>' + д.имя + '</b><small>' + срокПотери(д, true) + '</small></div></div>'
    + (вехи ? '<ul class="hud-vp-herb-facts">' + вехи + '</ul>' : '') + д.подсказка + д.кнопки + '</div>';
}

/** Тропинка: путь от дня потери до возвращения цикла, вехи и «сегодня». */
function потеряТропинка(д) {
  const точки = д.точки.filter(т => Number.isFinite(т.день) && т.день > 0);
  const конец = Math.max(1, ...точки.map(т => т.день), д.днейНазад || 0);
  const x = (день) => огр(день / конец * 100, 0, 100);
  const прошла = (т) => д.днейНазад !== null && д.днейНазад >= т.день;
  const вехи = точки.map((т, i) => `<span class="hud-vp-path-pin${прошла(т) ? ' is-past' : ''}" style="left:${ф(x(т.день))}%" title="${т.подпись} · ${т.дата}"><i aria-hidden="true">${i + 1}</i></span>`).join('');
  const сегодня = д.днейНазад !== null ? `<span class="hud-vp-path-now" style="left:${ф(x(Math.min(д.днейНазад, конец)))}%"><i aria-hidden="true"></i><small>сегодня</small></span>` : '';
  const легенда = `<ol class="hud-vp-path-legend"><li class="is-past"><i aria-hidden="true">0</i><b>потеря</b><small>${д.датаТекст}</small></li>`
    + точки.map((т, i) => `<li class="${прошла(т) ? 'is-past' : ''}"><i aria-hidden="true">${i + 1}</i><b>${т.подпись}</b><small>${т.дата}</small></li>`).join('') + `</ol>`;
  return `<div class="hud-v hud-vp-path is-${д.вид}"><div class="hud-vp-path-head"><span class="hud-note-eye hud-section-title">Конец беременности</span><b>${д.имя}</b>`
    + `<small>${срокПотери(д, false)}</small></div>`
    + `<div class="hud-vp-path-track"><span class="hud-vp-path-done" style="width:${ф(x(Math.min(д.днейНазад || 0, конец)))}%"></span>`
    + `<span class="hud-vp-path-pin is-start is-past" style="left:0"><i aria-hidden="true">0</i></span>${вехи}${сегодня}</div>${легенда}`
    + д.подсказка + д.кнопки + `</div>`;
}

/** Луна: ночное небо, по дуге — фазы луны от дня потери до возвращения цикла; сегодняшняя крупнее и светится. */
function потеряЛуна(д) {
  const точки = д.точки.filter(т => Number.isFinite(т.день) && т.день > 0);
  const конец = Math.max(28, ...точки.map(т => т.день), д.днейНазад || 0);
  const лун = 9;
  const r = сид(д.датаТекст);
  const звёзды = Array.from({ length: 22 }, (_, k) => '<circle class="star" cx="' + ф(r() * 200) + '" cy="' + ф(r() * 70) + '" r="' + ф(.4 + r() * .8) + '" style="--d:' + ф(r() * -3) + 's"/>').join('');
  const луны = Array.from({ length: лун }, (_, k) => {
    const t = k / (лун - 1), день = Math.round(t * конец);
    const x = 14 + t * 172, y = 60 - Math.sin(t * Math.PI) * 38;
    const фаза = (день % 29.5) / 29.5; // 0 — новолуние, .5 — полнолуние
    const сейчас = д.днейНазад !== null && Math.abs(день - д.днейНазад) <= конец / (лун - 1) / 2;
    const R = сейчас ? 8 : 5.5, тень = Math.cos(фаза * 2 * Math.PI) * R, правая = фаза < .5;
    const серп = 'M' + ф(x) + ' ' + ф(y - R) + ' A' + R + ' ' + R + ' 0 0 ' + (правая ? 1 : 0) + ' ' + ф(x) + ' ' + ф(y + R) + ' A' + ф(Math.abs(тень)) + ' ' + R + ' 0 0 ' + ((тень > 0) === правая ? 0 : 1) + ' ' + ф(x) + ' ' + ф(y - R) + 'Z';
    const прошло = д.днейНазад !== null && день <= д.днейНазад;
    return '<g class="moon' + (сейчас ? ' is-now' : '') + (прошло ? ' is-past' : '') + '"><circle class="disc" cx="' + ф(x) + '" cy="' + ф(y) + '" r="' + R + '"/><path class="lit" d="' + серп + '"/>' + (сейчас ? '<circle class="halo" cx="' + ф(x) + '" cy="' + ф(y) + '" r="' + (R + 5) + '"/>' : '') + '</g>';
  }).join('');
  const вехи = точки.map(т => '<li class="' + (д.днейНазад !== null && д.днейНазад >= т.день ? 'is-past' : '') + '"><b>' + т.подпись + '</b><small>' + т.дата + '</small></li>').join('');
  return '<div class="hud-v hud-vp-moon is-' + д.вид + '"><svg class="hud-vp-moon-sky" viewBox="0 0 200 76" aria-hidden="true">' + звёзды + '<path class="arc" d="M14 60 Q100 -16 186 60"/>' + луны + '</svg>'
    + '<div class="hud-vp-moon-text"><span class="hud-note-eye hud-section-title">Конец беременности</span><b>' + д.имя + '</b><small>' + срокПотери(д, true) + '</small></div>'
    + (вехи ? '<ul class="hud-vp-moon-marks"><li class="is-past"><b>потеря</b><small>' + д.датаТекст + '</small></li>' + вехи + '</ul>' : '') + д.подсказка + д.кнопки + '</div>';
}

export function видПотери(д, вид) {
  if (!д) return '';
  if (вид === 'sprig') return потеряВеточка(д);
  if (вид === 'path') return потеряТропинка(д);
  if (вид === 'moon') return потеряЛуна(д);
  return '';
}

// --- Обещания -----------------------------------------------------------------
// о — [{ от, кому, что, срок, безСрока, вид: kept|broken|overdue|open, слово }].

/** Узелки: витая верёвка с настоящими узлами, на каждом — бумажная бирка с обещанием. */
function обещанияУзелки(о) {
  const узел = (вид) => ({
    kept: '<path class="rope-o" d="M16 4 C6 10 6 22 16 28 C26 22 26 10 16 4Z M9 16 H23"/><path class="rope-i" d="M16 4 C6 10 6 22 16 28 C26 22 26 10 16 4Z M9 16 H23"/>',
    open: '<path class="rope-o" d="M16 3 C7 7 7 15 16 15 C25 15 25 24 16 29"/><path class="rope-i" d="M16 3 C7 7 7 15 16 15 C25 15 25 24 16 29"/>',
    overdue: '<path class="rope-o" d="M16 4 C6 10 6 22 16 28 C26 22 26 10 16 4Z"/><path class="rope-i" d="M16 4 C6 10 6 22 16 28 C26 22 26 10 16 4Z"/><path class="fray" d="M11 25 l-4 4 M21 25 l4 4 M16 28 v4 M13 27 l-2 4 M19 27 l2 4"/>',
    broken: '<path class="rope-o" d="M16 2 V12 M16 20 V30"/><path class="rope-i" d="M16 2 V12 M16 20 V30"/><path class="fray" d="M16 12 l-4 3 M16 12 l4 3 M16 12 l-1.5 4 M16 12 l1.5 4 M16 20 l-4 -3 M16 20 l4 -3 M16 20 l-1.5 -4 M16 20 l1.5 -4"/>',
  }[вид] || '');
  return '<div class="hud-v hud-vp-quipu"><i class="hud-vp-quipu-cord" aria-hidden="true"></i>' + о.map((п, i) => '<div class="hud-vp-quipu-row is-' + п.вид + '" style="--i:' + i + '">'
    + '<svg class="hud-vp-quipu-knot" viewBox="0 0 32 32" aria-hidden="true">' + узел(п.вид) + '</svg><i class="hud-vp-quipu-string" aria-hidden="true"></i>'
    + '<div class="hud-vp-quipu-tag"><i class="hole" aria-hidden="true"></i><p>' + applyTooltips(п.что || п.от) + '</p>'
    + '<small>' + э(п.от) + (п.кому ? ' <i aria-hidden="true">→</i> ' + э(п.кому) : '') + (п.безСрока ? '' : ' · ' + э(п.срок)) + '</small><em>' + п.слово + '</em></div></div>').join('') + '</div>';
}

/** Кто кому: пары лиц, между ними — обещания на стрелке. */
function обещанияПары(о) {
  const пары = [];
  for (const п of о) {
    const ключ = (п.от + '→' + п.кому).toLowerCase();
    let пара = пары.find(x => x.ключ === ключ);
    if (!пара) пары.push(пара = { ключ, от: п.от, кому: п.кому, список: [] });
    пара.список.push(п);
  }
  return `<div class="hud-v hud-vp-pairs">` + пары.map(пара => `<div class="hud-vp-pair">`
    + `<div class="hud-vp-pair-end">${лицо(пара.от || '?')}<small>${э(первое(пара.от))}</small></div>`
    + `<div class="hud-vp-pair-lane"><i class="hud-vp-pair-arrow" aria-hidden="true"></i>${пара.список.map(п => `<span class="hud-vp-pair-pill is-${п.вид}" title="${э(п.слово)}${п.безСрока ? '' : ' · ' + э(п.срок)}">${applyTooltips(п.что || '…')}<small><span>${п.слово}</span>${п.безСрока ? '' : `<span> · </span><span>${э(п.срок)}</span>`}</small></span>`).join('')}</div>`
    + `<div class="hud-vp-pair-end">${пара.кому ? лицо(пара.кому) + `<small>${э(первое(пара.кому))}</small>` : `<i class="hud-v-face hud-vp-pair-all" aria-hidden="true">${ико('hearts')}</i><small>всем</small>`}</div></div>`).join('') + `</div>`;
}

/** Цепь: каждое обещание — звено. Сдержано — золотое, в силе — стальное, просрочено — ржавое, нарушено — разорвано. */
function обещанияЦепь(о) {
  const звенья = о.map((п, i) => {
    const x = 18 + i * 25, верт = i % 2 === 1;
    const звено = верт ? '<rect class="link-o" x="' + (x - 6) + '" y="6" width="12" height="28" rx="6"/><rect class="link-i" x="' + (x - 6) + '" y="6" width="12" height="28" rx="6"/>'
      : '<rect class="link-o" x="' + (x - 15) + '" y="13" width="30" height="14" rx="7"/><rect class="link-i" x="' + (x - 15) + '" y="13" width="30" height="14" rx="7"/>';
    return '<g class="link is-' + п.вид + '" style="--i:' + i + '">' + звено + (п.вид === 'broken' ? '<path class="gap" d="M' + (x + (верт ? -8 : 4)) + ' ' + (верт ? 16 : 10) + ' l' + (верт ? 16 : 6) + ' ' + (верт ? 4 : 20) + '"/>' : '') + '<text x="' + x + '" y="' + (верт ? 23.5 : 23.5) + '">' + (i + 1) + '</text></g>';
  }).join('');
  const ширина = 36 + (о.length - 1) * 25;
  return '<div class="hud-v hud-vp-chain"><div class="hud-vp-chain-art"><svg viewBox="0 0 ' + ширина + ' 40" aria-hidden="true"><path class="anchor" d="M2 20 H6 M' + (ширина - 6) + ' 20 H' + ширина + '"/>' + звенья + '</svg></div>'
    + '<ol>' + о.map((п, i) => '<li class="is-' + п.вид + '"><b class="n">' + (i + 1) + '</b><div><p>' + applyTooltips(п.что || п.от) + '</p><small>' + э(п.от) + (п.кому ? ' <i aria-hidden="true">→</i> ' + э(п.кому) : '') + (п.безСрока ? '' : ' · ' + э(п.срок)) + '</small></div><em>' + п.слово + '</em></li>').join('') + '</ol></div>';
}

export function видОбещаний(о, вид) {
  if (!Array.isArray(о) || !о.length) return '';
  if (вид === 'knots') return обещанияУзелки(о);
  if (вид === 'pairs') return обещанияПары(о);
  if (вид === 'chain') return обещанияЦепь(о);
  return '';
}

// --- Тем временем ---------------------------------------------------------------
// тем — [{ имя, где, текст, знает, неЗнает, догадки }].

const пустоМ = (x) => !x || /^(empty|none|нет|—|-)$/i.test(String(x).trim());
const времяИМесто = (где) => {
  const [первое, ...прочее] = String(где || '').split(/\s*·\s*/);
  const время = /^\d{1,2}:\d{2}$/.test(первое) ? первое : '';
  return { время, место: время ? прочее.join(' · ') : String(где || '') };
};

/** Камеры: экраны наблюдения — запись, время, место, подпись кадра. */
function темКамеры(тем) {
  const знание = (т) => [['is-yes', 'eye', 'знает', т.знает], ['is-no', 'lock', 'не знает', т.неЗнает], ['is-guess', 'star', 'догадывается', т.догадки]]
    .filter(([, , , v]) => !пустоМ(v)).map(([к, и, подпись, v]) => `<li class="${к}">${ико(и)}<span><b>${подпись}</b> ${applyTooltips(v)}</span></li>`).join('');
  return `<div class="hud-v hud-vp-cams">` + тем.map((т, i) => {
    const { время, место } = времяИМесто(т.где);
    return `<div class="hud-vp-cam"><div class="hud-vp-cam-screen"><span class="hud-vp-cam-tl">CAM ${i + 1}${место ? ` · ${э(место)}` : ''}</span>`
      + `<span class="hud-vp-cam-tr"><i aria-hidden="true"></i>REC${время ? ` ${э(время)}` : ''}</span>${лицо(т.имя, 'hud-v-face hud-vp-cam-face')}`
      + `<span class="hud-vp-cam-name">${э(т.имя)}</span><p class="hud-vp-cam-sub">${applyTooltips(т.текст)}</p></div>`
      + (знание(т) ? `<ul class="hud-vp-cam-know">${знание(т)}</ul>` : '') + `</div>`;
  }).join('') + `</div>`;
}

/** Глава романа: страница книги с орнаментом, золочёной буквицей, пометками красными чернилами на полях и номером страницы. */
function темРоман(тем) {
  const стр = (hudHashSeed(тем.map(т => т.имя).join()) >>> 0) % 300 + 12;
  const орнамент = '<svg class="hud-vp-novel-orn" viewBox="0 0 120 12" aria-hidden="true"><path d="M2 6 H44 M76 6 H118"/><path d="M44 6 C50 0 56 0 60 6 C64 12 70 12 76 6 C70 0 64 0 60 6 C56 12 50 12 44 6Z"/><circle cx="60" cy="6" r="1.6"/></svg>';
  return '<div class="hud-v hud-vp-novel"><div class="hud-vp-novel-head">' + орнамент + '<span>Тем временем</span></div>'
    + тем.map(т => {
      const { время, место } = времяИМесто(т.где);
      const где = [место, время].filter(Boolean).join(', ');
      const поля = [['знает', т.знает], ['не знает', т.неЗнает], ['догадывается', т.догадки]].filter(([, v]) => !пустоМ(v))
        .map(([подпись, v]) => '<span><b>' + подпись + ':</b> ' + applyTooltips(v) + '</span>').join('');
      const имя = String(т.имя || '').trim();
      return '<div class="hud-vp-novel-par"><p><span class="hud-vp-novel-cap" aria-hidden="true"><i>' + э(имя.slice(0, 1)) + '</i></span><b>' + э(имя) + '</b>' + (где ? '<i>, ' + э(где) + '.</i>' : '.') + ' ' + applyTooltips(т.текст) + '</p>'
        + (поля ? '<div class="hud-vp-novel-margin">' + поля + '</div>' : '') + '</div>';
    }).join('<div class="hud-vp-novel-break" aria-hidden="true">⁂</div>') + '<div class="hud-vp-novel-folio">— ' + стр + ' —</div></div>';
}

/** Город ночью: силуэт домов под звёздами; у каждого человека вне кадра — своё горящее окно с номером. */
function темГород(тем) {
  const r = сид(тем.map(т => т.имя).join('|'));
  let x = 0; const дома = [], окна = [];
  while (x < 400) {
    const w = 14 + Math.round(r() * 16), h = 22 + Math.round(r() * 40);
    дома.push('<rect class="house" x="' + x + '" y="' + (80 - h) + '" width="' + w + '" height="' + h + '"/>' + (r() > .7 ? '<rect class="house" x="' + (x + w / 2 - 1.5) + '" y="' + (80 - h - 6) + '" width="3" height="6"/>' : ''));
    for (let yy = 80 - h + 5; yy < 74; yy += 7) for (let xx = x + 3; xx < x + w - 4; xx += 6) if (r() > .55) окна.push([xx, yy]);
    x += w + 1;
  }
  const свет = окна.map(([a, b], k) => '<rect class="win" style="--d:' + ф(r() * -6) + 's" x="' + a + '" y="' + b + '" width="3" height="4"/>').join('');
  // Окна людей: равномерно по ширине, на средней высоте.
  const свои = тем.map((т, i) => { const cx = ф(140 + (i + .5) / тем.length * 120 - 4), cy = 40 + (i % 2) * 12;
    return '<g class="person"><rect class="pwin" x="' + cx + '" y="' + cy + '" width="9" height="11" rx="1"/><circle class="pglow" cx="' + ф(+cx + 4.5) + '" cy="' + (cy + 5.5) + '" r="10"/><text x="' + ф(+cx + 4.5) + '" y="' + (cy + 8.6) + '">' + (i + 1) + '</text></g>'; }).join('');
  const звёзды = Array.from({ length: 18 }, () => '<circle class="star" style="--d:' + ф(r() * -3) + 's" cx="' + ф(r() * 400) + '" cy="' + ф(r() * 30) + '" r="' + ф(.4 + r() * .7) + '"/>').join('');
  const знание = (т) => [['is-yes', 'знает', т.знает], ['is-no', 'не знает', т.неЗнает], ['is-guess', 'догадывается', т.догадки]].filter(([, , v]) => !пустоМ(v))
    .map(([к, подпись, v]) => '<span class="' + к + '"><b>' + подпись + '</b> ' + applyTooltips(v) + '</span>').join('');
  return '<div class="hud-v hud-vp-city"><svg class="hud-vp-city-sky" viewBox="0 0 400 80" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><circle class="moonc" cx="262" cy="15" r="7"/>' + звёзды + дома.join('') + свет + свои + '</svg>'
    + '<div class="hud-vp-city-list">' + тем.map((т, i) => { const { время, место } = времяИМесто(т.где);
      return '<div class="hud-vp-city-item"><b class="n">' + (i + 1) + '</b>' + лицо(т.имя) + '<div class="body"><b>' + э(т.имя) + '</b><small>' + э([место, время].filter(Boolean).join(' · ')) + '</small><p>' + applyTooltips(т.текст) + '</p>' + (знание(т) ? '<div class="know">' + знание(т) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>';
}

export function видТемВременем(тем, вид) {
  if (!Array.isArray(тем) || !тем.length) return '';
  if (вид === 'cctv') return темКамеры(тем);
  if (вид === 'novel') return темРоман(тем);
  if (вид === 'city') return темГород(тем);
  return '';
}

// --- Кто что знает --------------------------------------------------------------
// с — секреты, люди — [{ имя, игрок }], клетка[i][j] — { вид, текст },
// лицоСетки(имя, игрок, доля) и заголовок(факт) — из secrets-grid.js.

const СЛОВО = { knows: 'знает', suspects: 'подозревает', not: 'не знает', wrong: 'ошибается' };

/** Двери: деревянная дверь на каждый секрет. Кто знает — внутри, в тёплом свете приоткрытой двери; кто нет — на коврике у порога. */
function сеткаДвери(с, люди, клетка, лицоСетки, заголовок, уровень) {
  return '<div class="hud-vp-doors">' + с.map((сек, i) => {
    const внутри = [], снаружи = [];
    люди.forEach((п, j) => { const к = клетка[i][j]; (к.вид === 'not' ? снаружи : внутри).push({ п, к }); });
    const лицоК = ({ п, к }) => '<span class="hud-vp-door-face is-' + к.вид + '" title="' + э(п.имя) + ' — ' + э(к.текст) + '">' + лицоСетки(п.имя, п.игрок) + (к.вид === 'wrong' ? '<i class="hud-vp-door-badge">' + ико('mask') + '</i>' : к.вид === 'suspects' ? '<i class="hud-vp-door-badge">?</i>' : '') + '</span>';
    const открыта = внутри.length > 0;
    return '<div class="hud-vp-door lvl-' + уровень(сек) + (открыта ? ' is-open' : '') + '" title="' + э(сек.fact) + '"><div class="hud-vp-door-frame"><span class="hud-vp-door-lintel">' + ико('lock') + '</span>'
      + '<div class="hud-vp-door-in"><i class="hud-vp-door-light" aria-hidden="true"></i>' + (открыта ? внутри.map(лицоК).join('') : '<small>никто</small>') + '</div>'
      + '<i class="hud-vp-door-leaf" aria-hidden="true"><i class="hinge h1"></i><i class="hinge h2"></i><i class="knob"></i></i></div>'
      + '<b class="hud-vp-door-fact">' + э(заголовок(сек.fact)) + '</b><div class="hud-vp-door-mat">' + снаружи.map(лицоК).join('') + '</div></div>';
  }).join('') + '</div>';
}

/** Допуск: пропуск на каждого — уровень по доле секретов, которые он знает. */
function сеткаДопуск(с, люди, клетка, лицоСетки, заголовок) {
  const строки = люди.map((п, j) => {
    const знает = с.filter((_, i) => клетка[i][j].вид === 'knows').length;
    const доля = Math.round(знает / с.length * 100);
    return { п, j, знает, доля };
  }).sort((a, b) => b.доля - a.доля);
  const уровеньДопуска = (доля) => доля >= 75 ? ['A', 'полный'] : доля >= 50 ? ['B', 'высокий'] : доля >= 25 ? ['C', 'частичный'] : доля > 0 ? ['D', 'низкий'] : ['—', 'нет допуска'];
  return `<div class="hud-vp-badges">` + строки.map(({ п, j, знает, доля }) => {
    const [буква, слово] = уровеньДопуска(доля);
    const полоса = с.map((сек, i) => `<i class="is-${клетка[i][j].вид}" title="${э(заголовок(сек.fact))} — ${СЛОВО[клетка[i][j].вид]}"></i>`).join('');
    const список = с.map((сек, i) => ({ сек, к: клетка[i][j] })).filter(x => x.к.вид !== 'not')
      .map(({ сек, к }) => `<li class="is-${к.вид}"><b>${СЛОВО[к.вид]}</b>${э(заголовок(сек.fact))}</li>`).join('');
    return `<details class="hud-vp-badge lvl-${буква === '—' ? 'none' : буква.toLowerCase()}"><summary><i class="hud-vp-badge-strap" aria-hidden="true"></i><i class="hud-vp-badge-clip" aria-hidden="true"></i>`
      + `<span class="hud-vp-badge-org">допуск</span><span class="hud-vp-badge-photo">${лицоСетки(п.имя, п.игрок)}</span><b class="hud-vp-badge-name">${э(первое(п.имя))}</b>`
      + `<small class="hud-vp-badge-count">знает ${знает} из ${с.length}</small><span class="hud-vp-badge-strip">${полоса}</span>`
      + `<span class="hud-vp-badge-lvl" title="${слово}"><b>${буква}</b><small>${слово}</small></span></summary>`
      + (список ? `<ul>${список}</ul>` : '<p>ни одного секрета</p>') + `</details>`;
  }).join('') + `</div>`;
}

/** Пузыри: каждый секрет — мыльный пузырь, внутри те, кто знает; чем больше знающих, тем он больше. Не знающие — под ним. */
function сеткаПузыри(с, люди, клетка, лицоСетки, заголовок, уровень) {
  return '<div class="hud-vp-bubbles">' + с.map((сек, i) => {
    const внутри = [], снаружи = [];
    люди.forEach((п, j) => { const к = клетка[i][j]; (к.вид === 'not' ? снаружи : внутри).push({ п, к }); });
    const лицоК = ({ п, к }) => '<span class="hud-vp-door-face is-' + к.вид + '" title="' + э(п.имя) + ' — ' + э(к.текст) + '">' + лицоСетки(п.имя, п.игрок) + (к.вид === 'wrong' ? '<i class="hud-vp-door-badge">' + ико('mask') + '</i>' : к.вид === 'suspects' ? '<i class="hud-vp-door-badge">?</i>' : '') + '</span>';
    const размер = 64 + Math.min(4, внутри.length) * 10;
    return '<div class="hud-vp-bubble lvl-' + уровень(сек) + '" style="--b:' + размер + 'px;--i:' + i + '" title="' + э(сек.fact) + '"><div class="ball"><i class="shine" aria-hidden="true"></i>'
      + (внутри.length ? внутри.map(лицоК).join('') : '<small>никто</small>') + '</div><b>' + э(заголовок(сек.fact)) + '</b>' + (снаружи.length ? '<div class="out">' + снаружи.map(лицоК).join('') + '</div>' : '') + '</div>';
  }).join('') + '</div>';
}

export function видСеткиСекретов(вид, данные) {
  const { секреты, люди, клетка, лицоСетки, заголовок, уровень } = данные || {};
  if (!Array.isArray(секреты) || !секреты.length || !Array.isArray(люди)) return '';
  if (вид === 'doors') return сеткаДвери(секреты, люди, клетка, лицоСетки, заголовок, уровень);
  if (вид === 'clearance') return сеткаДопуск(секреты, люди, клетка, лицоСетки, заголовок);
  if (вид === 'bubbles') return сеткаПузыри(секреты, люди, клетка, лицоСетки, заголовок, уровень);
  return '';
}

