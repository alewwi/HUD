// hud-manager/render/era-fantasy.js
//
// Эпохи фэнтези (era.js): виды блоков в обличье магии. Как и средневековье
// (render/era-medieval.js), берёт уже нарисованную разметку вида и
// пересобирает её по месту — сборщики видов про эпоху не знают. Для
// современного фэнтези основа — современная разметка, для средневекового —
// средневековая (свечи, печати…), её сначала строит era-medieval.js.
//
// Два уровня магии:
//   явная       — кристаллы маны, зелья, свидетельство мага, лей-линия, сферы
//                 оракула, аура; колдовские свечи, звёздная грамота, лист
//                 целителя, часы светил, огоньки, печати с рунным кольцом;
//   приземлённая — без рун и кругов: благовония, аптекарские склянки, бумажные
//                 фонари, часы двенадцати зверей, горы тушью на телефоне.
// Каждый блок можно вернуть к современному виду (era.js, ОБЛИЧЬЯ).
//
// Вид — css/era-fantasy.css (кошель — css/era-medieval.css). Прототип и стенд —
// tests/tools/fantasy-stand. Текст из карточки идёт в разметку только через esc().
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { эпоха, явнаяМагия, приземлённое, эпохаОблика, магияОблика, блокПодМагию } from '../era.js?v=23.89.49';

  let счёт = 0;
  const id = (п) => `fx-${п}-${(++счёт).toString(36)}`;
  const текст = (e) => (e?.textContent || '').replace(/​/g, '').replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const блок = (класс, html) => Object.assign(document.createElement('div'), { className: класс, innerHTML: html });
  const найти = (корень, с) => [...(корень.matches?.(с) ? [корень] : []), ...корень.querySelectorAll(с)];
  const хеш = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const огр = (v, a, b) => Math.max(a, Math.min(b, v));
  const р = (n) => (+n).toFixed(1).replace(/\.0$/, '');

  /* ─────────────────────────── общие рисунки ─────────────────────────── */

  // Четырёхлучевая искра.
  const искра = (x, y, r, кл = 'spark') => `<path class="${кл}" d="M${р(x)} ${р(y - r)}C${р(x + r * .12)} ${р(y - r * .12)} ${р(x + r * .12)} ${р(y - r * .12)} ${р(x + r)} ${р(y)}C${р(x + r * .12)} ${р(y + r * .12)} ${р(x + r * .12)} ${р(y + r * .12)} ${р(x)} ${р(y + r)}C${р(x - r * .12)} ${р(y + r * .12)} ${р(x - r * .12)} ${р(y + r * .12)} ${р(x - r)} ${р(y)}C${р(x - r * .12)} ${р(y - r * .12)} ${р(x - r * .12)} ${р(y - r * .12)} ${р(x)} ${р(y - r)}Z"/>`;

  // Руны — свой алфавит из штрихов (не настоящие футарк, чтобы не читались
  // словом). Каждая руна — путь в клетке 6×10.
  const РУНЫ = ['M0 0V10M0 2L5 0M0 5L5 3', 'M5 0L0 5L5 10', 'M5 0L0 4L5 6L0 10', 'M2.5 0L5 3L0 8M2.5 0L0 3L5 8', 'M0 10V0L4 2L0 4L5 10', 'M2.5 0V10M0 2L2.5 4L5 2',
    'M0 10V0L5 5', 'M0 0V10M5 0V10M0 3L5 7', 'M2.5 0V10M0 7L2.5 4L5 7', 'M0 0L5 10M5 0L0 10', 'M0 0V10M0 0L5 3L0 6', 'M2.5 0V10M0 3H5M0 7H5', 'M0 5L2.5 0L5 5L2.5 10Z', 'M0 0H5L0 10H5'];
  const руна = (n, x, y, s = 1, кл = 'rune') => `<path class="${кл}" transform="translate(${р(x)} ${р(y)}) scale(${s})" d="${РУНЫ[((n % РУНЫ.length) + РУНЫ.length) % РУНЫ.length]}"/>`;
  const строкаРун = (seed, n, x, y, шаг, s) => Array.from({ length: n }, (_, i) => руна((seed >> (i % 24)) + i * 7, x + i * шаг, y, s)).join('');

  // Руны по окружности радиуса r (центр 0,0), буквами наружу.
  const кольцоРун = (r, seed, n, s) => Array.from({ length: n }, (_, i) => `<g transform="rotate(${р(i / n * 360)}) translate(0 ${р(-r)})">${руна((seed >> (i % 20)) + i * 5, -2.5 * s, -5 * s, s)}</g>`).join('');
  // Магический круг: кольца, засечки, руны по кругу, звезда внутри.
  function круг(r, seed, { лучей = 6, рун = 16, засечек = 48 } = {}) {
    const засечки = Array.from({ length: засечек }, (_, i) => { const a = i / засечек * Math.PI * 2, d = i % 4 ? r * .955 : r * .925; return `M${р(Math.cos(a) * r)} ${р(Math.sin(a) * r)}L${р(Math.cos(a) * d)} ${р(Math.sin(a) * d)}`; }).join('');
    const руныКруга = Array.from({ length: рун }, (_, i) => { const a = i / рун * 360; return `<g transform="rotate(${р(a)}) translate(0 ${р(-r * .8)})">${руна((seed >> (i % 20)) + i * 5, -2.5 * r / 60, -5 * r / 60, r / 60)}</g>`; }).join('');
    const звезда = Array.from({ length: лучей }, (_, i) => { const a = i / лучей * Math.PI * 2 - Math.PI / 2; return `${р(Math.cos(a) * r * .62)},${р(Math.sin(a) * r * .62)}`; });
    const шаг = лучей % 2 ? 2 : (лучей === 6 ? 2 : 3);
    let путь = ''; for (let i = 0; i < лучей; i++) путь += `M${звезда[i]}L${звезда[(i + шаг) % лучей]}`;
    return `<circle r="${р(r)}"/><circle r="${р(r * .9)}" class="thin"/><path d="${засечки}" class="thin"/>${руныКруга}<circle r="${р(r * .68)}"/><circle r="${р(r * .62)}" class="thin"/><path d="${путь}"/><circle r="${р(r * .3)}" class="thin"/>`;
  }

  /* ═══════════════════════ СОВРЕМЕННОЕ ФЭНТЕЗИ ═══════════════════════ */

  // Тело: кристаллы маны в серебряной оправе вместо батареек. Уровень —
  // светящаяся сердцевина; на исходе кристалл треснул и тускнеет, полный —
  // искрит. Каждая шкала — свой цвет (как у батареек).
  function кристалл(v, имя, слово, c, i) {
    const g = id('cr'), gl = id('crl'), gh = id('crh'), cp = id('crc');
    v = огр(v, 0, 100);
    const верх = 4, низ = 62, y = низ - (низ - верх - 2) * v / 100;
    const контур = 'M22 4L34 17L33 50L22 62L11 50L10 17Z';
    const грани = [
      ['M22 4L10 17L22 19Z', .30], ['M22 4L34 17L22 19Z', .05], ['M10 17L22 19L22 56L11 50Z', .22],
      ['M34 17L22 19L22 56L33 50Z', -.06], ['M11 50L22 56L22 62Z', .38], ['M33 50L22 56L22 62Z', .16],
    ].map(([d, т]) => `<path d="${d}" fill="${т > 0 ? '#000' : '#fff'}" fill-opacity="${Math.abs(т)}"/>`).join('');
    const трещина = v <= 25 ? `<path class="crack" d="M15 21l3 6-2 5 4 4-1 6"/><path class="crack thin" d="M18 27l3-1M16 32l-3 2"/>` : '';
    const искры = v >= 70 ? искра(36, 8, 4.5) + искра(7, 26, 3) + (v >= 90 ? искра(38, 40, 2.6) : '') : '';
    return `<figure class="fx-cr${v <= 25 ? ' is-low' : ''}${v >= 70 ? ' is-full' : ''}" style="--c:${c}"><svg viewBox="0 0 44 80" aria-hidden="true"><defs>`
      + `<radialGradient id="${gh}" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity="${р(.18 + v / 260)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".12" stop-color="${c}"/><stop offset="1" style="stop-color:color-mix(in oklab, ${c} 60%, #000)"/></linearGradient>`
      + `<linearGradient id="${gl}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--fx-metal-lo)"/><stop offset=".45" style="stop-color:var(--fx-metal-hi)"/><stop offset="1" style="stop-color:var(--fx-metal-lo)"/></linearGradient>`
      + `<clipPath id="${cp}"><path d="${контур}"/></clipPath></defs>`
      + `<ellipse class="halo" cx="22" cy="36" rx="22" ry="30" fill="url(#${gh})"/>`
      // Пустой кристалл — дымчатое стекло своего цвета.
      + `<path d="${контур}" style="fill:color-mix(in oklab, ${c} 16%, rgba(10,8,20,.55))"/>`
      + `<g clip-path="url(#${cp})"><rect class="core" x="0" y="${р(y)}" width="44" height="${р(низ - y + 2)}" fill="url(#${g})"/>`
      + `<path d="M8 ${р(y)}Q22 ${р(y - 2.2)} 36 ${р(y)}" class="surface" style="stroke:color-mix(in oklab, ${c} 40%, #fff)"/>`
      + `<path d="M19 ${р(Math.max(y + 3, 20))}V58" class="beam"/>${грани}${трещина}</g>`
      + `<path d="${контур}" class="edge" style="stroke:color-mix(in oklab, ${c} 45%, #fff)"/><path d="M22 4V62M10 17L22 19L34 17" class="facet"/>`
      // Оправа: чаша с завитками и три лапки, держащие кристалл.
      + `<path d="M9 55Q22 61 35 55L37 63Q22 71 7 63Z" fill="url(#${gl})" class="metal"/>`
      + `<path d="M11 50L9 56M33 50L35 56M22 62V66" class="claw"/><path d="M7 63Q4 66 7 69M37 63Q40 66 37 69" class="claw thin"/>`
      + `<path d="M12 69Q22 74 32 69L30 76H14Z" fill="url(#${gl})" class="metal"/><circle cx="22" cy="65.5" r="1.8" class="gem" style="fill:${c}"/>`
      + `${руна(хеш(имя) + i, 13.2, 70.3, .48, 'etch')}${руна(хеш(имя) + i + 3, 27.8, 70.3, .48, 'etch')}${искры}</svg>`
      + `<b>${esc(v)}</b><small>${esc(имя)}</small>${слово ? `<em>${esc(слово)}</em>` : ''}</figure>`;
  }

  // Сон и дела — сбоку: ночь со звёздами и «чары на день» с печатью.
  const ЛУНА = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" class="moon-halo"/><path d="M21 5a11 11 0 1 0 6 16A9 9 0 0 1 21 5z" class="moon"/><circle cx="14" cy="15" r="1.6" class="crater"/><circle cx="17" cy="22" r="1" class="crater"/></svg>';
  const КИСТЬ = '<svg viewBox="0 0 24 24" aria-hidden="true" class="brush"><path d="M19 3c-3 2-8 7-10 10l2 2c3-2 8-7 10-10z"/><path d="M9 13c-2 0-4 1-4 4 0 2-1 3-2 4 3 0 7-1 8-4z" class="tip"/></svg>';
  function бокТела(bs, земля) {
    const сон = bs.querySelector('.hud-bs-sleep'), дела = bs.querySelector('.hud-bs-work');
    if (!сон && !дела) return '';
    return `<div class="fx-bs-side">${сон ? `<div class="fx-night">${ЛУНА}<div><b>${esc(текст(сон.querySelector('b')))}</b><small>${esc(текст(сон.querySelector('small')))}</small></div><i class="stars" aria-hidden="true"></i></div>` : ''}`
      + `${дела ? `<div class="fx-chore">${земля ? КИСТЬ : `<svg viewBox="-12 -12 24 24" aria-hidden="true" class="sig">${круг(11, хеш(текст(дела)), { лучей: 5, рун: 8, засечек: 24 })}</svg>`}<span>${esc(текст(дела))}</span></div>` : ''}</div>`;
  }
  function тело(bs) {
    const ячейки = [...bs.querySelectorAll('.hud-bs-cell')].map((c, i) => кристалл(parseInt(текст(c.querySelector('b')), 10) || 0, текст(c.querySelector('small')), текст(c.querySelector('em')), c.style.getPropertyValue('--c') || '#9fd4ff', i)).join('');
    return блок('fx fx-mana', `<div class="row">${ячейки}</div>${бокТела(bs)}`);
  }

  // Колбы → зелья: у каждой шкалы своя склянка, пробка с сургучом и бечёвкой,
  // бирка с руной. Жидкость светится своим цветом, у полной — пузырьки.
  const СКЛЯНКИ = [
    // круглая колба
    { тело: 'M19 16h10v9c8 3 13 10 13 18 0 11-8 19-18 19S6 54 6 43c0-8 5-15 13-18Z', горло: [19, 29, 16], низ: 62, верх: 26, блик: 'M11 40c0-5 2-9 7-11' },
    // высокий фиал
    { тело: 'M18 14h12v4l-2 2v36c0 4-2 6-4 6s-4-2-4-6V20l-2-2Z', горло: [18, 30, 14], низ: 61, верх: 21, блик: 'M22 24v28' },
    // сердце
    { тело: 'M20 16h8v8c3-3 9-4 13 0 5 5 3 12-2 18L24 60 9 42c-5-6-7-13-2-18 4-4 10-3 13 0Z', горло: [20, 28, 16], низ: 60, верх: 24, блик: 'M10 30c1-3 4-4 6-3' },
    // гранёный флакон
    { тело: 'M19 16h10v6l9 6v26l-6 7H16l-6-7V28l9-6Z', горло: [19, 29, 16], низ: 61, верх: 23, блик: 'M13 31v20' },
  ];
  function зелье(v, имя, слово, c, i, простое) {
    const ф = СКЛЯНКИ[i % СКЛЯНКИ.length], cp = id('pc'), g = id('pg'), gh = id('ph');
    v = огр(v, 0, 100);
    const y = ф.низ - (ф.низ - ф.верх) * v / 100;
    const [x1, x2, гy] = ф.горло, ш = x2 - x1;
    const пузыри = v > 20 ? `<circle class="bub" cx="${р(19 + i % 3 * 3)}" cy="${р(y + 9)}" r="1.5"/><circle class="bub" cx="${р(27 - i % 2 * 3)}" cy="${р(y + 15)}" r="1"/><circle class="bub" cx="22" cy="${р(Math.min(ф.низ - 3, y + 22))}" r=".8"/>` : '';
    return `<figure class="fx-po${v <= 25 ? ' is-low' : ''}" style="--c:${c}"><svg viewBox="0 0 48 72" aria-hidden="true"><defs>`
      + `<clipPath id="${cp}"><path d="${ф.тело}"/></clipPath>`
      + `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in oklab, ${c} 70%, #fff)"/><stop offset=".35" stop-color="${c}"/><stop offset="1" style="stop-color:color-mix(in oklab, ${c} 55%, #000)"/></linearGradient>`
      + `<radialGradient id="${gh}" cx="50%" cy="62%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity="${р(.12 + v / 300)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>`
      + `<ellipse cx="24" cy="44" rx="24" ry="26" fill="url(#${gh})"/>`
      + `<path d="${ф.тело}" class="glass-in"/>`
      + `<g clip-path="url(#${cp})"><rect x="0" y="${р(y)}" width="48" height="72" fill="url(#${g})"/><path d="M0 ${р(y)}Q12 ${р(y - 1.6)} 24 ${р(y)}T48 ${р(y)}" class="meniscus"/>`
      + `<path d="M8 ${р(y + 8)}c6 4 12-3 18 1s10 2 14-1" class="swirl"/>${пузыри}${простое ? `<path class="herb" d="M24 ${р(ф.низ - 2)}c-1-8 1-14 4-20M26 ${р(ф.низ - 10)}c3-2 5-2 6 0-2 2-4 2-6 0zM25 ${р(ф.низ - 16)}c-3-2-5-1-6 1 2 1 4 1 6-1z"/>` : ""}</g>`
      + `<path d="${ф.тело}" class="glass"/><path d="${ф.блик}" class="shine"/>`
      // Пробка, сургуч с подтёками, бечёвка и бирка.
      + `<path d="M${x1 + 1} ${гy - 9}h${ш - 2}l-1 9h-${ш - 4}Z" class="cork"/><path d="M${x1 + 2.5} ${гy - 6}h${ш - 5}M${x1 + 2} ${гy - 3}h${ш - 4}" class="cork-grain"/>`
      + `<path d="M${x1 - .5} ${гy - 9.5}q${ш / 2 + .5}-3.5 ${ш + 1} 0l-.4 2.6q-.8 2.6-1.6.2-.6 3.4-1.8.3-1.2 2.6-2.2-.2-1 2-2-.4-.6 1.6-1.6-.4Z" class="wax"/>`
      + `<path d="M${x1 - .5} ${гy + 1.5}h${ш + 1}" class="twine"/><path d="M${x2 + .5} ${гy + 1.5}q5 2 6 8" class="twine thin"/>`
      + `<g transform="translate(${x2 + 3} ${гy + 8}) rotate(14)"><path d="M0 0h9l2 3.5-2 3.5H0Z" class="tag"/><circle cx="8.6" cy="3.5" r=".9" class="tag-hole"/>${простое ? '<path class="tag-leaf" d="M1.6 5.6c1-3 4-4.4 6-4.2-.4 2.4-2.6 4.6-6 4.2zM1.6 5.6l3.4-2.6"/>' : руна(хеш(имя) + i, 2, 1.2, .46, 'tag-rune')}</g>`
      + `</svg><b>${esc(v)}</b><small>${esc(имя)}</small>${слово ? `<em>${esc(слово)}</em>` : ''}</figure>`;
  }
  function зелья(bs) {
    const ячейки = [...bs.querySelectorAll('.hud-bs-cell')].map((c, i) => зелье(parseInt(текст(c.querySelector('b')), 10) || 0, текст(c.querySelector('small')), текст(c.querySelector('em')), c.style.getPropertyValue('--c') || '#9fd4ff', i)).join('');
    return блок('fx fx-potions', `<div class="row">${ячейки}</div>${бокТела(bs)}`);
  }

  // Карточка, к которой относится узел: фото и буква владельца вкладки.
  function владелец(узел) {
    const вкладка = узел.closest('.hud-tab-content') || узел.closest('.hud-os-card');
    const фото = вкладка?.querySelector('img.hud-avatar')?.getAttribute('src') || '';
    const имя = текст(вкладка?.querySelector('.hud-title'));
    return { фото, имя, буква: (имя.match(/\p{L}/u) || ['✦'])[0].toUpperCase() };
  }
  const svgКруг = (r, seed, кл, opts) => `<svg class="${кл}" viewBox="${-r - 1} ${-r - 1} ${2 * r + 2} ${2 * r + 2}" aria-hidden="true">${круг(r, seed, opts)}</svg>`;

  // Удостоверение → свидетельство мага: реестр одарённых, портрет в
  // стрельчатой раме с рунами, голографическая печать-круг, рунная строка
  // вместо машиночитаемой зоны.
  function лицензия(idc) {
    const { фото, буква, имя } = владелец(idc);
    const seed = хеш(имя + текст(idc));
    const поля = [...idc.querySelectorAll('dl > div')].map(d => `<div><dt>${esc(текст(d.querySelector('dt')))}</dt><dd>${esc(текст(d.querySelector('dd')))}</dd></div>`).join('');
    const cp = id('lc');
    const арка = 'M4 60V22Q4 4 22 2Q40 4 40 22V60Z';
    const портрет = `<svg class="arch" viewBox="0 0 44 62" aria-hidden="true"><defs><clipPath id="${cp}"><path d="${арка}"/></clipPath></defs>`
      + (фото ? `<image href="${esc(фото)}" x="0" y="0" width="44" height="62" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cp})"/>` : `<path d="${арка}" class="bg"/><text x="22" y="40" text-anchor="middle" class="ini">${esc(буква)}</text>`)
      + `<path d="${арка}" class="frame"/><path d="M1.5 61.5V22Q1.5 1.5 22 -.5Q42.5 1.5 42.5 22V61.5" class="frame thin"/>${искра(22, -.5, 3.2)}</svg>`;
    const мрз = (k) => `<svg class="mrz" viewBox="0 0 150 9" preserveAspectRatio="xMinYMid meet" aria-hidden="true">${строкаРун(seed + k * 977, 22, 1, -.5, 6.8, .9)}</svg>`;
    return блок('fx fx-lic', `<i class="foil" aria-hidden="true"></i>`
      + `<div class="head">${svgКруг(20, seed, 'crest', { лучей: 7, рун: 10, засечек: 28 })}<div><small>Реестр одарённых</small><b>Свидетельство мага</b></div><span class="no">№ ${String(seed % 100000).padStart(5, '0')}</span></div>`
      + `<div class="body">${портрет}<dl>${поля}</dl>${svgКруг(26, seed >> 3, 'holo', { лучей: 6, рун: 12, засечек: 36 })}</div>`
      + `<div class="mrzs">${мрз(1)}${мрз(2)}</div>`);
  }

  // Линия метро → лей-линия: места — узлы силы на светящейся жиле, где
  // вы сейчас — большой вращающийся круг.
  function лейЛиния(pl) {
    const точки = [...pl.querySelectorAll('li')];
    const html = точки.map((li, i) => {
      const k = (li.querySelector('span') || li).cloneNode(true); const мелко = текст(k.querySelector('small')); k.querySelector('small')?.remove();
      const здесь = li.classList.contains('is-here');
      return `<li class="${здесь ? 'is-here' : ''}">${здесь ? svgКруг(14, хеш(текст(k)), 'node', { лучей: 5, рун: 8, засечек: 24 }) : `<svg class="node" viewBox="-6 -6 12 12" aria-hidden="true"><circle r="4.6"/><path d="M0-3L3 0L0 3L-3 0Z"/></svg>`}<span>${esc(текст(k))}${здесь ? `<small>${esc(мелко || 'вы здесь')}</small>` : ''}</span></li>`;
    }).join('');
    return блок('fx fx-ley', `<ol>${html}</ol>`);
  }

  // Светофор → сферы оракула: в хрустальном шаре клубится туман цвета
  // доверия, чем больше доверия, тем ярче шар.
  function сферы(tr) {
    const html = [...tr.querySelectorAll('.hud-v-card')].map((c) => {
      const v = огр(parseInt(текст(c.querySelector('.hud-v-num')), 10) || 0, 0, 100), k = v / 100;
      const зона = v >= 66 ? 2 : v >= 33 ? 1 : 0, цв = ['#ff6b8a', '#ffc65c', '#6ff0d0'][зона];
      const g = id('ob'), gn = id('on'), gm = id('om');
      return `<div class="orb" style="--c:${цв};--k:${р(k)}"><svg viewBox="0 0 44 54" aria-hidden="true"><defs>`
        + `<radialGradient id="${g}" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" style="stop-color:color-mix(in oklab, ${цв} 60%, #fff)" stop-opacity="${р(.35 + k * .5)}"/><stop offset=".7" stop-color="${цв}" stop-opacity="${р(.18 + k * .5)}"/><stop offset="1" style="stop-color:var(--fx-arc-lo)" stop-opacity=".9"/></radialGradient>`
        + `<radialGradient id="${gn}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${цв}" stop-opacity="${р(.25 + k * .45)}"/><stop offset="1" stop-color="${цв}" stop-opacity="0"/></radialGradient>`
        + `<linearGradient id="${gm}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--fx-metal-lo)"/><stop offset=".45" style="stop-color:var(--fx-metal-hi)"/><stop offset="1" style="stop-color:var(--fx-metal-lo)"/></linearGradient></defs>`
        + `<circle cx="22" cy="21" r="22" fill="url(#${gn})" class="glow"/>`
        + `<circle cx="22" cy="21" r="16" fill="url(#${g})"/><path class="mist" d="M10 25c4-5 9 2 13-2s7-6 11-1M12 18c3-3 6 0 9-2" style="stroke:color-mix(in oklab, ${цв} 50%, #fff)"/>`
        + `<circle cx="22" cy="21" r="16" class="rim"/><ellipse cx="16" cy="14" rx="5" ry="3" fill="#fff" opacity=".35" transform="rotate(-30 16 14)"/>`
        + `<path d="M8 36Q22 42 36 36L33 44Q22 48 11 44Z" fill="url(#${gm})"/><path d="M9 33L11 38M35 33L33 38M22 37V40" class="claw"/><path d="M12 47h20l2 4H10Z" fill="url(#${gm})"/></svg>`
        + `<div class="tx"><b>${esc(текст(c.querySelector('.hud-v-traffic-text b')))}</b><small>${esc(текст(c.querySelector('.hud-v-traffic-text small')))}</small></div><em>${v}</em></div>`;
    }).join('');
    return блок('fx fx-orbs', html);
  }

  // Тепловизор → аура: фигура в сиянии, ощущения — сгустки чар; вместо
  // прицела — малый круг, вместо «IR» — руна.
  function аура(ph) {
    const svg = ph.querySelector('svg.therm');
    if (!svg) return null;
    const контур = svg.querySelector('.outline')?.getAttribute('d') || '';
    const bl = id('ab');
    svg.insertAdjacentHTML('afterbegin', `<defs><filter id="${bl}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs><g class="aura" filter="url(#${bl})"><path d="${контур}" class="a1"/><path d="${контур}" class="a2"/></g>`);
    svg.querySelectorAll('.cross').forEach(e => e.remove());
    svg.insertAdjacentHTML('beforeend', `<g transform="translate(50 46)" class="sig">${круг(7, хеш(текст(ph)), { лучей: 5, рун: 0, засечек: 16 })}</g>`);
    const rec = ph.querySelector('.rec'); if (rec) rec.innerHTML = `<svg viewBox="0 0 8 10" aria-hidden="true">${руна(хеш(текст(ph)), 1.5, 0, 1)}</svg> ${esc(текст(rec).replace(/^IR\s*·\s*/, ''))}`;
    ph.querySelectorAll('.scale s').forEach((s, i) => { s.textContent = i ? 'тихо' : 'сильно'; });
    ph.classList.add('fx-aura');
    return null;
  }

  // Неоновая вывеска → рунная вывеска: по бокам главной трубки — круги,
  // провод — цепочка рун.
  function вывеска(st) {
    const seed = хеш(текст(st));
    const main = st.querySelector('.tube.main');
    if (main) {
      const ряд = Object.assign(document.createElement('div'), { className: 'fx-mainrow' });
      main.replaceWith(ряд);
      ряд.insertAdjacentHTML('afterbegin', svgКруг(12, seed, 'fx-side l', { лучей: 5, рун: 6, засечек: 20 }));
      ряд.append(main);
      ряд.insertAdjacentHTML('beforeend', svgКруг(12, seed >> 2, 'fx-side r', { лучей: 5, рун: 6, засечек: 20 }));
    }
    st.querySelector('.wire')?.insertAdjacentHTML('afterend', `<svg class="fx-chain" viewBox="0 0 200 8" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${строкаРун(seed, 26, 2, -1, 7.6, .9)}</svg>`);
    st.classList.add('fx-sign');
    return null;
  }

  // Билеты → пропуска через портал: голограмма — малый круг, штрихкод —
  // руны, шапка — «Пропуск».
  function пропуска(sc) {
    sc.querySelectorAll('.tk').forEach((tk, i) => {
      const seed = хеш(текст(tk)) + i;
      const head = tk.querySelector('.head'); if (head && head.firstChild) head.firstChild.nodeValue = 'Пропуск через портал';
      tk.querySelector('.holo')?.replaceWith(Object.assign(document.createElement('span'), { className: 'fx-holo', innerHTML: svgКруг(10, seed, 'h', { лучей: 6, рун: 6, засечек: 16 }) }));
      const code = tk.querySelector('.code'); if (code) code.outerHTML = `<svg class="fx-code" viewBox="0 0 10 60" aria-hidden="true">${Array.from({ length: 6 }, (_, k) => руна((seed >> k) + k * 3, 2.5, 1 + k * 9.6, .9)).join('')}</svg>`;
    });
    sc.classList.add('fx-portal');
    return null;
  }

  const СОВРЕМЕННОЕ = [
    ['body', '.hud-bs-bat', тело],
    ['flasks', '.hud-bs-flasks', зелья],
    ['age', '.hud-f-age.is-id', лицензия],
    ['place', '.hud-f-place.is-crumbs', лейЛиния],
    ['trust', '.hud-v-trust.is-traffic', сферы],
    ['phys', '.hud-f-phys.is-readout:not(.fx-aura)', аура],
    ['status', '.hud-f-status.is-toggles:not(.fx-sign)', вывеска],
    ['sched', '.hud-f-sched.is-tickets:not(.fx-portal)', пропуска],
  ];

  // Телефон: магический круг блокировки рисуется здесь же (тот же круг, что
  // в видах), двумя слоями — внешнее кольцо и звезда, крутятся навстречу.
  function кругиТелефона(корень) {
    const doc = корень.ownerDocument, r = doc.documentElement;
    const svg = (inner) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-101 -101 202 202' fill='none' stroke='#000' stroke-linecap='round' stroke-linejoin='round'>${inner}</svg>`)}")`;
    const полный = круг(100, 0x5eed1234, { лучей: 7, рун: 21, засечек: 84 });
    const внешнее = `<g stroke-width='1.6'>${полный.split('<circle r="68"')[0].replace(/class="thin"/g, "stroke-width='.7'").replace(/class="rune"/g, "stroke-width='1.3'")}</g>`;
    const внутр = `<g stroke-width='1.4'>${'<circle r="68"' + полный.split('<circle r="68"')[1]}</g>`.replace(/class="thin"/g, "stroke-width='.7'");
    r.style.setProperty('--fx-ring-out', svg(внешнее));
    r.style.setProperty('--fx-ring-in', svg(внутр));
  }

  /* ═══════════════════════ СРЕДНЕВЕКОВОЕ ФЭНТЕЗИ ═══════════════════════ */

  // Свечи → колдовские свечи: тёмный воск с вырезанной руной, которая
  // светится тем ярче, чем выше уровень; серебряный подсвечник-полумесяц;
  // пламя — колдовское (лиловое у основания, голубое, белое ядро), над
  // ним — искры. На исходе пламя мельчает, вьётся лиловый дымок.
  function свеча(v, имя, сост, красная, i) {
    const gw = id('cw'), gf = id('cf'), gh = id('ch'), gm = id('cm');
    v = огр(v, 0, 100);
    const h = 12 + v * .46, y = 78 - h, s = v <= 30 ? .72 : 1;
    const воск = красная ? 'color-mix(in oklab, var(--e-rubric) 60%, #2a0612)' : 'color-mix(in oklab, var(--fx-arc-lo) 70%, #120a20)';
    const руны = h > 22 ? `<g class="carve" style="opacity:${р(.35 + v / 160)}">${руна(хеш(имя) + i, 22.2, y + 6, .72)}${h > 34 ? руна(хеш(имя) + i + 5, 22.2, y + 15, .72) : ''}</g>` : '';
    const искры = v > 30 ? `<circle class="mote" cx="${р(18 + i % 2 * 9)}" cy="${р(y - 20)}" r=".9"/><circle class="mote" cx="${р(29 - i % 3 * 4)}" cy="${р(y - 26)}" r=".7"/>${v >= 70 ? искра(31, y - 16, 2.4, 'spark') : ''}` : '';
    return `<figure class="fx-cand${красная ? ' is-red' : ''}${v <= 30 ? ' is-low' : ''}" style="--wax:${воск}"><svg viewBox="0 0 48 96" aria-hidden="true"><defs>`
      + `<linearGradient id="${gw}" x1="0" x2="1"><stop offset="0" style="stop-color:color-mix(in oklab, var(--wax) 70%, #000)"/><stop offset=".35" style="stop-color:color-mix(in oklab, var(--wax) 78%, #fff)"/><stop offset=".7" style="stop-color:var(--wax)"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--wax) 60%, #000)"/></linearGradient>`
      + `<linearGradient id="${gf}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:color-mix(in oklab, var(--fx-arc) 40%, #7a2cff)"/><stop offset=".45" style="stop-color:var(--fx-arc)"/><stop offset=".8" style="stop-color:var(--fx-arc-hi)"/><stop offset="1" stop-color="#fff"/></linearGradient>`
      + `<radialGradient id="${gh}"><stop offset="0" style="stop-color:var(--fx-arc-hi)" stop-opacity=".7"/><stop offset="1" style="stop-color:var(--fx-arc)" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="${gm}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--fx-metal-lo)"/><stop offset=".42" style="stop-color:var(--fx-metal-hi)"/><stop offset="1" style="stop-color:var(--fx-metal-lo)"/></linearGradient></defs>`
      + `<circle class="halo" cx="24" cy="${р(y - 10)}" r="${р(17 * s)}" fill="url(#${gh})"/>`
      + (v <= 30 ? `<path class="wisp" d="M24 ${р(y - 17)}c-3-3 3-5 0-8s3-5 0-9"/>` : '') + искры
      // Подсвечник: полумесяц на ножке, чаша.
      // Подсвечник: лежащий месяц рогами вверх держит свечу, ножка, круглое основание.
      + `<path d="M11 87q13 8 26 0l-1.6 3.4q-11.4 5-22.8 0z" fill="url(#${gm})"/><ellipse cx="24" cy="87" rx="13" ry="2.4" fill="url(#${gm})"/>`
      + `<path d="M22 80h4l1 7h-6z" fill="url(#${gm})"/><circle cx="24" cy="81.5" r="1.8" fill="url(#${gm})"/>`
      // Воск, подтёки, руна, фитиль.
      + `<rect x="16" y="${р(y)}" width="16" height="${р(h)}" fill="url(#${gw})"/><ellipse cx="24" cy="${р(y)}" rx="8" ry="2.2" style="fill:color-mix(in oklab, var(--wax) 65%, #fff)"/>`
      + `<path d="M17 ${р(y + .5)}q-1.6 6 .2 ${р(7 + v * .05)}q1.4-.2 1.2-3q-.3-2 .2-4z" fill="url(#${gw})"/><path d="M30 ${р(y + 1)}q1.4 3-.2 ${р(4 + v * .04)}q-1 .2-.8-2z" fill="url(#${gw})"/>${руны}`
      + `<path d="M24 ${р(y - .2)}q.8-2-.4-3.6" fill="none" stroke="#1a1020" stroke-width="1.1" stroke-linecap="round"/>`
      // Месяц — поверх низа свечи: она стоит в нём, как в чаше.
      + `<path d="M5 69q19 24 38 0q-19 15.5-38 0z" fill="url(#${gm})" class="crescent"/>${искра(5, 68.4, 1.6, 'tip')}${искра(43, 68.4, 1.6, 'tip')}`
      + `<g transform="translate(24 ${р(y - 3.2)}) scale(${s})"><g class="flame"><path d="M0 0c-5.4-2.8-5.6-9.4 0-17c5.6 7.6 5.4 14.2 0 17z" fill="url(#${gf})"/><path d="M0-1c-2.4-1.4-2.5-4.6 0-8.4c2.5 3.8 2.4 7 0 8.4z" fill="#fff" opacity=".85"/></g></g>`
      + `</svg><b>${esc(v)}</b><span class="nm">${esc(имя)}</span><span class="st">${esc(сост)}</span></figure>`;
  }
  function свечи(ec) {
    ec.querySelectorAll('.row4 > figure').forEach((f, i) => {
      const n = document.createElement('div');
      n.innerHTML = свеча(parseInt(текст(f.querySelector('b')), 10) || 0, текст(f.querySelector('.nm')), текст(f.querySelector('.st')), f.classList.contains('is-red'), i);
      f.replaceWith(n.firstChild);
    });
    // Луна сна — с ореолом и звёздами.
    ec.querySelector('.night')?.classList.add('fx-night-m');
    ec.classList.add('fx-arcane');
    return null;
  }

  // Запись о рождении → звёздная грамота: натальный круг с двенадцатью
  // знаками, знак рождения подсвечен, в середине — портрет.
  const ЗНАКИ = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
  const ЗНАКИ_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  function натал(знак, фото, буква, seed) {
    const cp = id('nc'), r1 = 46, r2 = 36, r3 = 24;
    const сектора = ЗНАКИ.map((_, i) => {
      const a0 = (i * 30 - 105) * Math.PI / 180, a1 = ((i + 1) * 30 - 105) * Math.PI / 180, am = (a0 + a1) / 2;
      const p = (r, a) => `${р(50 + Math.cos(a) * r)} ${р(50 + Math.sin(a) * r)}`;
      const вот = i === знак;
      return `<path class="sec${вот ? ' is-on' : ''}" d="M${p(r2, a0)}L${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r2, a1)}A${r2} ${r2} 0 0 0 ${p(r2, a0)}Z"/>`
        + `<text class="zg${вот ? ' is-on' : ''}" x="${р(50 + Math.cos(am) * 41)}" y="${р(50 + Math.sin(am) * 41 + 2.6)}" text-anchor="middle">&#${9800 + i};&#65038;</text>`;
    }).join('');
    // Светила внутри круга: семь точек по семени имени, линии аспектов.
    const точки = Array.from({ length: 6 }, (_, k) => { const a = ((seed >> (k * 4)) % 360) * Math.PI / 180, r = 27 + (k % 3) * 3; return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]; });
    const аспекты = точки.map((т, k) => (k % 2 ? '' : `<path class="asp" d="M${р(т[0])} ${р(т[1])}L${р(точки[(k + 3) % 6][0])} ${р(точки[(k + 3) % 6][1])}"/>`)).join('');
    return `<svg class="natal" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${cp}"><circle cx="50" cy="50" r="${r3 - 1.5}"/></clipPath></defs>`
      + `<circle cx="50" cy="50" r="${r1 + 2.5}" class="ring-o"/><circle cx="50" cy="50" r="${r1}" class="ring"/>${сектора}<circle cx="50" cy="50" r="${r2}" class="ring"/>`
      + аспекты + точки.map(([x, y]) => `<circle class="pl" cx="${р(x)}" cy="${р(y)}" r="1.3"/>`).join('')
      + `<circle cx="50" cy="50" r="${r3}" class="ring"/>`
      + (фото ? `<image href="${esc(фото)}" x="${50 - r3}" y="${50 - r3}" width="${r3 * 2}" height="${r3 * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cp})"/>` : `<text class="ini" x="50" y="57" text-anchor="middle">${esc(буква)}</text>`)
      + `<circle cx="50" cy="50" r="${r3 - 1.5}" class="ring thin"/></svg>`;
  }
  function грамота(eb) {
    const знакТекст = [...eb.querySelectorAll('dl > div')].map(d => текст(d.querySelector('dd'))).map(т => т.replace(/[♈-♓]︎?/g, '').trim()).find(т => ЗНАКИ.includes(т) || ЗНАКИ_EN.includes(т)) || '';
    const знак = Math.max(ЗНАКИ.indexOf(знакТекст), ЗНАКИ_EN.indexOf(знакТекст));
    const овал = eb.querySelector('.oval');
    const фото = (овал?.style.backgroundImage || '').replace(/^url\(["']?|["']?\)$/g, '');
    const буква = текст(овал) || '✦';
    if (овал) овал.outerHTML = натал(знак, фото, буква, хеш(текст(eb)));
    const top = eb.querySelector('.top b'); if (top) top.textContent = 'Звёздная грамота';
    const sign = eb.querySelector('.sign > span:first-child'); if (sign && sign.firstChild) sign.firstChild.nodeValue = 'сочтено звездочётом';
    eb.classList.add('fx-arcane', 'fx-natal');
    return null;
  }

  // Лист лекаря → лист целителя: «зодиакальный человек» — фигура в кольце
  // двенадцати знаков, как в старых травниках.
  // Части тела под знаками (homo signorum): Овен — голова, Телец — шея,
  // Близнецы — руки, Рак — грудь, Лев — сердце, Дева — живот, Весы — бёдра,
  // Скорпион — лоно, Стрелец — ляжки, Козерог — колени, Водолей — голени,
  // Рыбы — стопы. Точки — в координатах фигуры листа лекаря (104×128).
  const ЧАСТИ_ТЕЛА = [[52, 10], [52, 20], [30, 38], [52, 34], [56, 44], [52, 60], [52, 70], [52, 78], [46, 90], [46, 102], [46, 112], [44, 121]];
  // Четыре стихии старой алхимии: огонь, воздух, вода, земля.
  const СТИХИИ = [[-6, 9, 'M0-5L5 4H-5Z', ''], [110, 9, 'M0-5L5 4H-5Z', 'M-3.6 1.4H3.6'], [-6, 123, 'M0 5L5-4H-5Z', ''], [110, 123, 'M0 5L5-4H-5Z', 'M-3.6-1.4H3.6']];
  function целитель(el) {
    const svg = el.querySelector('svg:not(.rule)');
    if (!svg) return null;
    const NS = 'http://www.w3.org/2000/svg', k = .76, C = [52, 66];
    // Фигура со всем, что на ней, — меньше и в середине: кольцо её не задевает.
    // Лист лекаря рисует фигуру своей группой (.leech-fig);
    // его нишу, соки и номера на полях заменяет зодиакальное кольцо.
    svg.querySelectorAll('.leech-deco, .leech-marks, :scope > circle, :scope > rect').forEach(e => e.remove());
    let фигура = svg.querySelector('.leech-fig');
    // Лист лекаря рисует фигуру крупнее — под кольцо знаков она ужимается.
    if (фигура) фигура.setAttribute('transform', `translate(${C[0]} ${C[1]}) scale(${k}) translate(${-C[0]} ${-C[1]})`);
    if (!фигура) {
      фигура = document.createElementNS(NS, 'g');
      фигура.setAttribute('transform', `translate(${C[0]} ${C[1]}) scale(${k}) translate(${-C[0]} ${-C[1]})`);
      [...svg.childNodes].filter(n => n.nodeName !== 'defs').forEach(n => фигура.appendChild(n));
      svg.appendChild(фигура);
    }
    const пятна = [...фигура.querySelectorAll('ellipse')].map(e => [+e.getAttribute('cx'), +e.getAttribute('cy')]);
    const вТело = ([x, y]) => [C[0] + (x - C[0]) * k, C[1] + (y - C[1]) * k];
    const R = { внутр: 50, знак: 56.5, внеш: 63 };
    const точка = (r, a) => [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
    let деления = '', знаки = '', нити = '';
    for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, [x1, y1] = точка(R.внутр, a), [x2, y2] = точка(i % 6 ? R.внутр + 1.6 : R.внеш, a); деления += `M${р(x1)} ${р(y1)}L${р(x2)} ${р(y2)}`; }
    ЗНАКИ.forEach((_, i) => {
      const a = (i * 30 + 15 - 90) * Math.PI / 180, [gx, gy] = точка(R.знак, a), [nx, ny] = точка(R.внутр - .5, a);
      const цель = ЧАСТИ_ТЕЛА[i], [tx, ty] = вТело(цель);
      const горит = пятна.some(([sx, sy]) => Math.hypot(sx - цель[0], sy - цель[1]) < 13);
      знаки += `<text class="fx-zg${горит ? ' is-on' : ''}" x="${р(gx)}" y="${р(gy + 2.3)}" text-anchor="middle">&#${9800 + i};&#65038;</text>`;
      нити += `<path class="fx-thread${горит ? ' is-on' : ''}" d="M${р(nx)} ${р(ny)}L${р(tx)} ${р(ty)}"/><circle class="fx-knot${горит ? ' is-on' : ''}" cx="${р(tx)}" cy="${р(ty)}" r="${горит ? 1.4 : .8}"/>`;
    });
    const стихии = СТИХИИ.map(([x, y, d, черта]) => `<g class="fx-elem" transform="translate(${x} ${y})"><circle r="8"/><path d="${d}${черта ? ' ' + черта : ''}"/></g>`).join('');
    const звёзды = [[8, 40], [96, 38], [4, 92], [100, 94], [24, 2], [80, 2], [24, 130], [80, 130]].map(([x, y], n) => искра(x, y, n % 2 ? 1.6 : 2.2, 'fx-star')).join('');
    svg.setAttribute('viewBox', '-16 -1 136 134');
    svg.insertAdjacentHTML('afterbegin', `<g class="fx-zodiac"><circle cx="52" cy="66" r="${R.внеш}" class="o"/><circle cx="52" cy="66" r="${R.внеш + 2}" class="o thin"/><circle cx="52" cy="66" r="${R.внутр}" class="o"/>`
      + `<path d="${деления}" class="tick"/>${знаки}${стихии}${звёзды}</g><g class="fx-threads">${нити}</g>`);
    svg.classList.add('fx-healer-chart');
    const cap = el.querySelector('.top .cap'); if (cap) cap.textContent = 'Лист целителя';
    el.classList.add('fx-arcane', 'fx-healer');
    return null;
  }

  // Часослов → часы светил: у каждого часа своё светило (халдейский ряд),
  // вместо колокола — медальон с его знаком.
  const СВЕТИЛА = [['Сатурна', '♄'], ['Юпитера', '♃'], ['Марса', '♂'], ['Солнца', '☉'], ['Венеры', '♀'], ['Меркурия', '☿'], ['Луны', '☽']];
  function медальон(знак) {
    const g = id('md');
    return `<svg class="fx-medal" viewBox="0 0 28 28" aria-hidden="true"><defs><radialGradient id="${g}" cx="40%" cy="35%"><stop offset="0" style="stop-color:var(--fx-arc-hi)"/><stop offset="1" style="stop-color:var(--fx-arc-lo)"/></radialGradient></defs>`
      + `<circle cx="14" cy="14" r="12.5" fill="url(#${g})"/><circle cx="14" cy="14" r="12.5" class="rim"/><circle cx="14" cy="14" r="10" class="rim thin"/>`
      + `<text x="14" y="18.6" text-anchor="middle" class="gl">${знак}&#65038;</text></svg>`;
  }
  function светила(eh) {
    eh.querySelectorAll('.h').forEach((h) => {
      const b = h.querySelector('.what b');
      const м = текст(h.querySelector('.what span')).match(/(\d{1,2}):\d{2}/);
      const с = СВЕТИЛА[(м ? +м[1] : 0) % 7];
      if (b) b.textContent = 'час ' + с[0];
      h.querySelector(':scope > svg')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: медальон(с[1]) }).firstChild);
    });
    const cap = eh.querySelector('.head .cap'); if (cap) cap.textContent = 'Часы светил';
    eh.classList.add('fx-arcane', 'fx-hours');
    return null;
  }

  // Фонари → фонари с блуждающим огоньком: внутри не пламя, а живой
  // огонёк с хвостом; чем больше доверия, тем он ярче и крупнее.
  function огонёк(el) {
    el.querySelectorAll('.p').forEach((p) => {
      const v = огр(parseInt(текст(p.querySelector('.num')), 10) || 0, 0, 100), k = v / 100;
      const svg = p.querySelector('svg');
      if (!svg) return;
      const gw = id('ww');
      // Стекло — колдовским светом, пламя → огонёк.
      svg.querySelectorAll('radialGradient stop').forEach((st, n) => { if (n === 0) st.setAttribute('stop-color', '#e8fbff'); if (n === 1) { st.removeAttribute('stop-color'); st.setAttribute('style', 'stop-color:var(--fx-arc)'); } });
      const пламя = svg.querySelector('.fl')?.closest('g[transform]');
      const r = 3 + k * 2.6;
      пламя?.remove();
      svg.insertAdjacentHTML('beforeend', `<defs><radialGradient id="${gw}"><stop offset="0" stop-color="#fff"/><stop offset=".45" style="stop-color:var(--fx-arc-hi)"/><stop offset="1" style="stop-color:var(--fx-arc)" stop-opacity="0"/></radialGradient></defs>`
        + `<g class="fx-wisp" style="opacity:${р(.45 + k * .55)}"><path d="M20 ${р(34 - r)}c-${р(r)} 0-${р(r * 1.1)} ${р(r * 1.6)}-${р(r * .4)} ${р(r * 2.4)}c-1.6 2-.6 5.4-3.6 7.6c3.6-.4 5.6-2.6 6.4-5c${р(r * .9)}-.6 ${р(r * 1.1)}-2.6 ${р(r * 1.1)}-${р(r * 1.6)}c0-${р(r * 1.6)}-1-${р(r * 1.4)}-${р(r * .9)}-${р(r * 1.6)}z" fill="url(#${gw})"/>`
        + `<circle cx="20" cy="34" r="${р(r * .55)}" fill="#fff"/></g>`);
    });
    el.classList.add('fx-arcane', 'fx-lamps');
    return null;
  }

  // Печати: воск колдовского цвета и кольцо рун вокруг, светится.
  function печать(сл) {
    if (сл.querySelector('.fx-seal-ring')) return null;
    const svg = сл.querySelector('svg');
    if (!svg) return null;
    svg.insertAdjacentHTML('afterbegin', `<g class="fx-seal-ring"><circle r="34.5"/><circle r="29.5" class="thin"/>${кольцоРун(32, хеш(текст(сл) || 'x'), 16, .42)}</g>`);
    svg.setAttribute('viewBox', '-36 -36 72 72');
    сл.classList.add('fx-arcane-seal');
    return null;
  }

  // Указатель: на досках — вырезанные руны.
  function указатель(ep) {
    ep.querySelectorAll('.board').forEach((b, i) => b.insertAdjacentHTML('beforeend', `<svg class="fx-board-runes" viewBox="0 0 60 8" aria-hidden="true">${строкаРун(хеш(текст(b)) + i, 8, 2, -1, 7.4, .9)}</svg>`));
    ep.insertAdjacentHTML('beforeend', '<i class="fx-post-wisp" aria-hidden="true"></i>');
    ep.classList.add('fx-arcane');
    return null;
  }

  // Кошель: бархатный мешочек со стяжкой и кистями, на боку — вышитый знак
  // (в явной магии светится), у подножия рассыпаны монеты. Стопки — монеты в
  // перспективе с чеканкой на верхней, книга — с метками прихода и расхода.
  const МЕТАЛЛЫ = { gold: ['#f6dc8a', '#d9a93a', '#8a6414'], silver: ['#f4f6fa', '#b9c0cc', '#6c7484'], copper: ['#f2b48a', '#c8784a', '#7a3e1e'] };
  function монета(cx, cy, rx, metal, лицо) {
    const [hi, mid, lo] = МЕТАЛЛЫ[metal] || МЕТАЛЛЫ.gold, ry = rx * .34;
    return `<path d="M${р(cx - rx)} ${р(cy)}v2.6a${rx} ${р(ry)} 0 0 0 ${2 * rx} 0V${р(cy)}" fill="${lo}"/>`
      + `<ellipse cx="${р(cx)}" cy="${р(cy)}" rx="${rx}" ry="${р(ry)}" fill="${mid}" stroke="${lo}" stroke-width=".5"/>`
      + `<ellipse cx="${р(cx)}" cy="${р(cy)}" rx="${р(rx * .78)}" ry="${р(ry * .74)}" fill="none" stroke="${hi}" stroke-width=".6" opacity=".9"/>`
      // Чеканка верхней монеты — звезда, сплющенная в перспективу.
      + (лицо ? `<g transform="translate(${р(cx)} ${р(cy)}) scale(1 .34)" fill="${lo}" opacity=".75">${искра(0, 0, rx * .52, 'face')}</g>` : '');
  }
  function стопка(metal, сколько) {
    const h = 8 + сколько * 3.4;
    let s = '';
    for (let i = 0; i < сколько; i++) s += монета(20, h - 4 - i * 3.4 + (i % 2 ? .3 : -.3), 13, metal, i === сколько - 1);
    return `<svg viewBox="0 0 40 ${р(h + 2)}" style="height:${р((h + 2) * 1.1)}px" aria-hidden="true"><ellipse cx="20" cy="${р(h - 1)}" rx="15" ry="3" fill="#000" opacity=".25"/>${s}</svg>`;
  }
  function мешочек(чары) {
    const g = id('pb'), gn = id('pn');
    const знак = чары
      // Месяц по центру медальона, звезда — в его выемке.
      ? `<g class="emb arc"><circle cx="60" cy="70" r="13"/><circle cx="60" cy="70" r="10.5" class="thin"/><circle cx="58.4" cy="70" r="7.4" class="moon"/><circle cx="61.6" cy="68.4" r="6.2" class="moon-cut"/>${искра(63.2, 69.2, 3.4, 'st')}</g>`
      : `<g class="emb"><circle cx="60" cy="70" r="13"/><circle cx="60" cy="70" r="10.5" class="thin"/><path class="lily" d="M60 59c-2 3-3 6-1 10-3-3-7-2-8 1 2-1 5-1 6 2l-2 1h4v4h2v-4h4l-2-1c1-3 4-3 6-2-1-3-5-4-8-1 2-4 1-7-1-10z"/></g>`;
    return `<svg class="fx-pouch" viewBox="0 0 120 108" aria-hidden="true"><defs>`
      + `<radialGradient id="${g}" cx="38%" cy="40%" r="75%"><stop offset="0" style="stop-color:color-mix(in oklab, var(--fx-purse) 55%, #fff)"/><stop offset=".55" style="stop-color:var(--fx-purse)"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--fx-purse) 45%, #000)"/></radialGradient>`
      + `<linearGradient id="${gn}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in oklab, var(--fx-purse) 70%, #fff)"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--fx-purse) 70%, #000)"/></linearGradient></defs>`
      + `<ellipse cx="60" cy="101" rx="44" ry="5" fill="#000" opacity=".3"/>`
      + `<path d="M40 34C20 44 11 64 15 80c4 16 24 21 45 21s41-5 45-21c4-16-5-36-25-46Z" fill="url(#${g})"/>`
      + `<path d="M44 40c-6 10-8 24-6 40M76 40c6 10 8 24 6 40M60 38v14" class="fold"/>`
      + `<path d="M19 84c8 10 25 13 41 13s33-3 41-13" class="seam"/>`
      + `<path d="M40 34q6-8 1-17 10 5 19-1 9 6 19 1-5 9 1 17Z" fill="url(#${gn})"/><path d="M45 22q4 5 3 11M60 18v14M75 22q-4 5-3 11" class="fold"/>`
      + `<path d="M38 34q22 7 44 0" class="cord"/><path d="M80 34q6 10 2 22M82 34q10 8 9 18" class="cord thin"/>`
      + `<path d="M79 55l-2 7h7l-2-7Z" class="tassel"/><path d="M88 51l-1 7h6l-2-7Z" class="tassel"/>`
      + знак
      + монета(92, 98, 7, 'gold', true) + монета(101, 101, 6, 'silver', false) + монета(83, 102, 5.5, 'copper', false)
      + (чары ? искра(104, 88, 3, 'spark') + искра(14, 50, 2.2, 'spark') : '') + `</svg>`;
  }
  function кошель(p) {
    const чары = !!p.closest('.hud-cask.is-arcane') || (эпоха() === 'fantasy-medieval' && явнаяМагия());
    const стопки = [...p.querySelectorAll('.hud-coins')].map((c) => {
      const metal = (c.className.match(/m-(gold|silver|copper)/) || [])[1] || 'gold';
      return `<div class="fx-stack m-${metal}">${стопка(metal, огр(c.querySelectorAll('.hud-coins-stack i').length, 1, 10))}<b>${esc(текст(c.querySelector('b')))}</b><small>${esc(текст(c.querySelector('small')))}</small></div>`;
    }).join('');
    const сырое = текст(p.querySelector('.hud-purse-raw'));
    const валюта = текст(p.querySelector('.hud-purse-cur'));
    const строки = [...p.querySelectorAll('.hud-ledger-row')].map((r) => {
      if (r.classList.contains('is-none')) return `<div class="fx-led-row is-none">${esc(текст(r))}</div>`;
      const что = r.querySelector('.hud-ledger-what')?.cloneNode(true); const пометка = текст(что?.querySelector('small')); что?.querySelector('small')?.remove();
      const расход = r.classList.contains('is-out');
      return `<div class="fx-led-row ${расход ? 'is-out' : 'is-in'}"><i class="mark" aria-hidden="true"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.2"/><path d="${расход ? 'M6 3.2v5.2M3.6 6.2 6 8.6l2.4-2.4' : 'M6 8.8V3.6M3.6 5.8 6 3.4l2.4 2.4'}"/></svg></i>`
        + `<span class="what">${esc(текст(что))}${пометка ? `<small>${esc(пометка)}</small>` : ''}</span><i class="lead" aria-hidden="true"></i><b class="sum">${esc(текст(r.querySelector('.hud-ledger-sum')))}</b>`
        + `${текст(r.querySelector('.hud-ledger-when')) ? `<span class="when">${esc(текст(r.querySelector('.hud-ledger-when')))}</span>` : ''}</div>`;
    }).join('');
    const заглавие = текст(p.querySelector('.hud-ledger-title')) || 'Приходно-расходная книга';
    return блок(`hud-purse fx-purse${чары ? ' is-arcane' : ''}`, `<div class="fx-purse-top">${мешочек(чары)}<div class="fx-coins">${стопки || `<span class="raw">${esc(сырое)}</span>`}</div></div>`
      + (валюта ? `<div class="fx-cur"><span>${esc(валюта)}</span></div>` : '')
      + `<div class="fx-ledger"><div class="fx-led-title"><span>${esc(заглавие)}</span>${ЧЕРТА_ПРОТО}</div>${строки}</div>`);
  }
  const ЧЕРТА_ПРОТО = '<svg class="rule" viewBox="0 0 220 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 5H92M128 5H218" stroke="currentColor" stroke-width=".8"/><path d="M92 5c4-5 8-5 10 0-2 5-6 5-10 0zM128 5c-4-5-8-5-10 0 2 5 6 5 10 0z" fill="none" stroke="currentColor" stroke-width=".8"/><path d="M110 1l4 4-4 4-4-4z" fill="currentColor"/></svg>';

  const СРЕДНЕВЕКОВОЕ = [
    ['body', '.era-cand:not(.fx-arcane)', свечи],
    ['age', '.era-birth:not(.fx-natal)', грамота],
    ['phys', '.era-leech:not(.fx-healer)', целитель],
    ['sched', '.era-hours:not(.fx-hours)', светила],
    ['trust', '.era-lamp:not(.fx-lamps)', огонёк],
    ['place', '.era-post:not(.fx-arcane)', указатель],
    ['seals', '.hud-seal.era-wax:not(.fx-arcane-seal)', печать],
    ['status', '.era-seal:not(.fx-arcane-seal) > svg:first-child', (el) => печать(el.parentElement)],
  ];


  /* ═══════════════════════ ПРИЗЕМЛЁННОЕ ФЭНТЕЗИ ═══════════════════════ */
  // Магия есть, но врождённая: стихии, духи, ремесло. Ни рун, ни кругов, ни
  // зачарованных вещей — природа, бумага, тушь, бронза, благовония.

  // Тело: палочки благовоний в чаше с пеплом. Длина палочки — уровень,
  // на конце тлеет уголёк, вверх вьётся дымок; на исходе — огарок.
  function благовоние(v, имя, слово, c, i) {
    v = огр(v, 0, 100);
    const g = id('ig'), gb = id('ib');
    const низ = 74, верх = низ - (6 + v * .56);
    const дым = v > 8 ? `<path class="smoke" style="opacity:${р(.25 + v / 220)}" d="M20 ${р(верх - 2)}c-4-5 4-8 0-13s4-8 0-13${v > 50 ? 's4-7 0-11' : ''}"/>` : '';
    return `<figure class="gr-inc${v <= 25 ? ' is-low' : ''}" style="--c:${c}"><svg viewBox="0 0 40 92" aria-hidden="true"><defs>`
      + `<radialGradient id="${g}"><stop offset="0" stop-color="#fff2c0"/><stop offset=".4" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ff5a1a" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="${gb}" x1="0" x2="1"><stop offset="0" style="stop-color:color-mix(in oklab, var(--gr-glaze) 55%, #000)"/><stop offset=".4" style="stop-color:color-mix(in oklab, var(--gr-glaze) 75%, #fff)"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--gr-glaze) 50%, #000)"/></linearGradient></defs>`
      + дым
      // палочка: бамбуковая основа, ароматная часть цвета шкалы, бумажный поясок
      + `<path d="M20 ${р(верх)}V${низ + 4}" class="stick-core"/><path d="M20 ${р(верх)}V${р(Math.min(низ - 4, верх + (низ - верх) * .7))}" class="stick" style="stroke:color-mix(in oklab, ${c} 55%, #5a2a1a)"/>`
      + `<rect x="18.4" y="${низ - 6}" width="3.2" height="3" rx=".6" style="fill:${c}"/>`
      + `<circle cx="20" cy="${р(верх)}" r="${v > 8 ? 5 : 3}" fill="url(#${g})" class="ember-glow"/><circle cx="20" cy="${р(верх)}" r="1.3" class="ember"/>`
      // чаша с пеплом
      + `<ellipse cx="20" cy="${низ + 1}" rx="13" ry="3" class="ash"/><path d="M6 ${низ + 1}q2 12 14 13q12-1 14-13z" fill="url(#${gb})"/>`
      + `<ellipse cx="20" cy="${низ + 1}" rx="14" ry="3.2" class="rim"/><path d="M14 ${низ + 14}h12l-1.5 2.6h-9z" fill="url(#${gb})"/>`
      + `<path d="M11 ${низ + 7}q9 3 18 0" class="glaze-line"/></svg>`
      + `<b>${esc(v)}</b><small>${esc(имя)}</small>${слово ? `<em>${esc(слово)}</em>` : ''}</figure>`;
  }
  function телоПриземлённое(bs) {
    const ячейки = [...bs.querySelectorAll('.hud-bs-cell')].map((c, i) => благовоние(parseInt(текст(c.querySelector('b')), 10) || 0, текст(c.querySelector('small')), текст(c.querySelector('em')), c.style.getPropertyValue('--c') || '#d9a066', i)).join('');
    return блок('fx gr gr-incense', `<div class="row">${ячейки}</div>${бокТела(bs, true)}`);
  }
  // Свечи средневековья → те же благовония (в приземлённом мире у тела свой обряд).
  function свечиПриземлённые(ec) {
    const ячейки = [...ec.querySelectorAll('.row4 > figure')].map((f, i) => благовоние(parseInt(текст(f.querySelector('b')), 10) || 0, текст(f.querySelector('.nm')), текст(f.querySelector('.st')), ['#e3b23c', '#7fb0d8', '#d98a52', '#c95a5a', '#7fd6cf'][i % 5], i)).join('');
    ec.querySelector('.row4').outerHTML = `<div class="row4 gr-row">${ячейки}</div>`;
    ec.classList.add('gr-incense-m');
    return null;
  }

  // Колбы → аптекарские склянки с травой внутри и бумажной этикеткой.
  function склянки(bs) {
    const ячейки = [...bs.querySelectorAll('.hud-bs-cell')].map((c, i) => зелье(parseInt(текст(c.querySelector('b')), 10) || 0, текст(c.querySelector('small')), текст(c.querySelector('em')), c.style.getPropertyValue('--c') || '#9fd4ff', i, true)).join('');
    return блок('fx gr fx-potions is-plain', `<div class="row">${ячейки}</div>${бокТела(bs, true)}`);
  }

  // Светофор → бумажные фонари: чем больше доверия, тем теплее и ярче свет.
  function фонарики(tr) {
    const html = [...tr.querySelectorAll('.hud-v-card')].map((c) => {
      const v = огр(parseInt(текст(c.querySelector('.hud-v-num')), 10) || 0, 0, 100), k = v / 100;
      const g = id('pl');
      return `<div class="gr-lan" style="--k:${р(k)}"><svg viewBox="0 0 40 60" aria-hidden="true"><defs><radialGradient id="${g}" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff4d0" stop-opacity="${р(.3 + k * .7)}"/><stop offset=".6" style="stop-color:var(--gr-paper)" stop-opacity="${р(.55 + k * .4)}"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--gr-paper) 55%, #000)"/></radialGradient></defs>`
        + `<circle cx="20" cy="27" r="${р(14 + k * 8)}" class="glow" style="opacity:${р(.15 + k * .55)}"/>`
        + `<path d="M20 2v5" class="cord"/><rect x="13" y="7" width="14" height="3.4" rx="1" class="cap"/>`
        + `<path d="M13 10.4C4 14 4 38 13 42h14c9-4 9-28 0-31.6Z" fill="url(#${g})"/>`
        + `<path d="M17 10.6c-4 5-4 26 0 31.2M23 10.6c4 5 4 26 0 31.2M9 18h22M7.4 26h25.2M9 34h22" class="rib"/>`
        + `<rect x="13" y="42" width="14" height="3.4" rx="1" class="cap"/><path d="M20 45.4v4M18 49.4h4l-.6 8h-2.8z" class="tassel"/></svg>`
        + `<div class="tx"><b>${esc(текст(c.querySelector('.hud-v-traffic-text b')))}</b><small>${esc(текст(c.querySelector('.hud-v-traffic-text small')))}</small></div><em>${v}</em></div>`;
    }).join('');
    return блок('fx gr gr-lanterns', html);
  }

  // Телефон: обычный, но на блокировке — горы тушью и туман.
  function горыТелефона(корень) {
    const r = корень.ownerDocument.documentElement;
    const горы = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'><path d='M0 200V120l30-28 22 18 40-52 30 30 26-22 44 44 30-26 40 40 38-34V200Z' fill='#000' opacity='.45'/><path d='M0 200v-46l46-30 34 22 52-40 40 34 30-18 50 34 48-26V200Z' fill='#000' opacity='.75'/><path d='M0 200v-22l60-18 50 12 60-20 70 18 60-14V200Z' fill='#000'/><path d='M206 30c6-4 10-4 14 1 3-3 7-4 12-2-6 0-9 2-11 6-2-3-7-5-15-5z' fill='#000' opacity='.9'/><path d='M96 52c3-2 5-2 7 .5 1.5-1.5 3.5-2 6-1-3 0-4.5 1-5.5 3-1-1.5-3.5-2.5-7.5-2.5z' fill='#000' opacity='.6'/></svg>`;
    r.style.setProperty('--gr-hills', `url("data:image/svg+xml,${encodeURIComponent(горы)}")`);
  }

  // Часослов → часы двенадцати зверей: сутки делятся на двойные часы.
  const ЗВЕРИ = ['Крысы', 'Быка', 'Тигра', 'Кролика', 'Дракона', 'Змеи', 'Лошади', 'Козы', 'Обезьяны', 'Петуха', 'Собаки', 'Свиньи'];
  function часыЗверей(eh) {
    eh.querySelectorAll('.h').forEach((h) => {
      const b = h.querySelector('.what b');
      const м = текст(h.querySelector('.what span')).match(/(\d{1,2}):\d{2}/);
      if (b && м) b.textContent = 'час ' + ЗВЕРИ[Math.floor(((+м[1] + 1) % 24) / 2)];
    });
    const cap = eh.querySelector('.head .cap'); if (cap) cap.textContent = 'Часы двенадцати зверей';
    eh.classList.add('gr-hours');
    return null;
  }

  // [ключ обличья (era.js, ОБЛИЧЬЯ), селектор вида, пересборка]. Пересборка
  // по месту помечает узел своим классом — селектор с :not() его больше не берёт.
  const СОВРЕМЕННОЕ_ПРИЗЕМЛЁННОЕ = [
    ['body', '.hud-bs-bat', телоПриземлённое],
    ['flasks', '.hud-bs-flasks', склянки],
    ['trust', '.hud-v-trust.is-traffic', фонарики],
  ];
  // Физиология: лист лекаря → висячий свиток лекаря. Фигура тушью на бумаге
  // в шёлковой оправе, по телу — каналы с точками, где болит — размыв
  // киноварью, на полях — красные печати с номером строки списка.
  // Фигура — точки правой половины, сглаженные (Катмулл — Ром); левая — зеркало.
  const ПОЛОВИНА_ТЕЛА = [[53.4, 24], [53.8, 29.5], [54.6, 33], [60, 35], [66, 36.8], [69.6, 39.6], [70.7, 44.3], [71.8, 53.8], [73, 64.1], [74.6, 76.1], [76.3, 88.2], [77.3, 95],
    [79, 98.5], [79.8, 104.5], [78.8, 109.7], [76.8, 111], [74.9, 109], [74.4, 102.8], [74.5, 97.6], [72.8, 89.9], [70.9, 77.8], [68.9, 65.8], [67.4, 55.5], [66, 49],
    [64.6, 58], [62.4, 66], [61, 74], [62.4, 84], [63.6, 94], [63, 106], [61.6, 120], [60.2, 133], [60, 140], [61, 150], [60, 162], [58.4, 172],
    [60.6, 175.5], [61.4, 179], [58, 180.6], [53.8, 180], [53, 176], [53.4, 168], [54, 156], [53.6, 146], [53.2, 138], [53.6, 128], [53, 114], [51.6, 104.5], [50, 102]];
  const ГОЛОВА = [[50, 8], [55.4, 10], [57.3, 15.6], [56.7, 21.6], [53.8, 26.2], [50, 27.6], [46.2, 26.2], [43.3, 21.6], [42.7, 15.6], [44.6, 10]];
  const сгладить = (т) => {
    const n = т.length, P = (i) => т[(i + n) % n];
    let d = `M${р(т[0][0])} ${р(т[0][1])}`;
    for (let i = 0; i < n; i++) {
      const a = P(i - 1), b = P(i), c = P(i + 1), e = P(i + 2);
      d += `C${р(b[0] + (c[0] - a[0]) / 6)} ${р(b[1] + (c[1] - a[1]) / 6)} ${р(c[0] - (e[0] - b[0]) / 6)} ${р(c[1] - (e[1] - b[1]) / 6)} ${р(c[0])} ${р(c[1])}`;
    }
    return d + 'Z';
  };
  let ТЕЛО_СВИТКА = '', ГОЛОВА_СВИТКА = '';
  const телоСвитка = () => {
    if (!ТЕЛО_СВИТКА) {
      ТЕЛО_СВИТКА = сгладить([...ПОЛОВИНА_ТЕЛА, ...ПОЛОВИНА_ТЕЛА.slice(0, -1).reverse().map(([x, y]) => [100 - x, y])]);
      ГОЛОВА_СВИТКА = сгладить(ГОЛОВА);
    }
    return [ТЕЛО_СВИТКА, ГОЛОВА_СВИТКА];
  };
  // Где отметить: группа (одна отметка на группу), пятна в координатах фигуры
  // (cx, cy, rx, ry), поле для печати (-1 слева, 1 справа). Фигура смотрит на
  // нас, поэтому правая рука — слева.
  const ЗОНЫ_СВИТКА = [
    ['head', /голов|мигрен|виск|(?<!\p{L})лоб|затыл|хмел|пьян|вин[оау](?!\p{L})|\b(?:head|dizz\w*|migraine|temples?|tipsy|drunk|wine)\b/iu, [[50, 16, 7, 8]], -1],
    ['mouth', /горл|(?<!\p{L})рот|во рту|губ|жажд|пересох|глота|(?<!\p{L})ком(?!\p{L})|\b(?:throat|mouth|lips?|thirst\w*|dry|swallow\w*)\b/iu, [[50, 27.5, 4.2, 3.4]], 1],
    ['chest', /груд|сердц|дыха|сос[ок]к|жар|вспоте|поте[ею]т|(?<!\p{L})пот(?!\p{L})|озноб|\b(?:chest|heart|breath\w*|hot|fever\w*|sweat\w*|chills?|nipples?)\b/iu, [[50, 50, 11, 9]], 1],
    ['hand', /прав\S* (?:рук|ладон|кист)|\bright (?:hand|arm)/iu, [[23.6, 101.9, 4, 6]], -1],
    ['hand', /лев\S* (?:рук|ладон|кист)|\bleft (?:hand|arm)/iu, [[76.4, 101.9, 4, 6]], 1],
    ['hand', /рук|ладон|пальц|кист|запяст|локт|костяш|\b(?:arms?|hands?|fingers?|wrists?|elbows?|knuckles?)\b/iu, [[23.6, 101.9, 4, 6], [76.4, 101.9, 4, 6]], -1],
    ['shoulder', /плеч|\bshoulders?\b/iu, [[31.5, 40, 5, 4], [68.5, 40, 5, 4]], 1],
    ['stomach', /желуд|под р[её]бр|тошн|голод|сыт|спазм|\b(?:stomach|nause\w*|hungr\w*|cramps?)\b/iu, [[50, 65, 8, 6.5]], -1],
    ['belly', /(?<!\p{L})низ|живот|возбужд|паху|пах(?!\p{L})|лоно|влаж|\b(?:arous\w*|groin|wet|belly)\b/iu, [[50, 91, 8.5, 7]], 1],
    ['legs', /ног|колен|бедр|ступн|икр|\b(?:legs?|knees?|thighs?|feet|foot|calf|calves)\b/iu, [[43.4, 140, 4.6, 13], [56.6, 140, 4.6, 13]], -1],
    ['back', /спин|поясниц|позвон|\b(?:back|spine)\b/iu, [[50, 76, 10, 5]], 1],
  ];
  // Каналы и точки на них — как на старых таблицах иглоукалывания.
  const КАНАЛЫ = 'M50 31V100M44.6 106C44 130 44.4 150 44.6 174M55.4 106C56 130 55.6 150 55.4 174M33.5 49.5C31.3 65.8 28.6 83 25.7 96.8M66.5 49.5C68.7 65.8 71.4 83 74.3 96.8';
  const ТОЧКИ_КАНАЛОВ = [[50, 36], [50, 46], [50, 56], [50, 66], [50, 76], [50, 86], [50, 96], ...[112, 124, 138, 152, 166].flatMap(y => [[44.4, y], [55.6, y]]),
    ...[[32.4, 58.9], [30.4, 72.7], [28.1, 86.4]].flatMap(([x, y]) => [[x, y], [100 - x, y]])];
  // Фигура на листе: масштаб .9 вокруг (50, 94) → (50, 106).
  const вСвиток = (x, y) => [50 + (x - 50) * .9, 106 + (y - 94) * .9];
  function свитокЛекаря(el) {
    const чтения = [...el.querySelectorAll('ol > li')].map((li) => {
      const т = текст([...li.children].find(c => c.matches('span:not(.drops)')));
      return { т, сила: огр((li.querySelector('.drops')?.getAttribute('title') || '').length || 1, 1, 3) };
    });
    if (!чтения.length) return null;
    const [тело, голова] = телоСвитка();
    const clip = id('scb'), wash = id('scw'), rough = id('scr'), shade = id('scs'), hatch = id('sch'), paper = id('scp'), wood = id('scd'), knob = id('sck'), silk = id('scl'), drop = id('sco'), blur = id('scf'), soft = id('scv'), grain = id('scg');
    const взято = new Set(), отметки = [];
    чтения.forEach((ч, i) => {
      for (const [гр, re, пятна, сторона] of ЗОНЫ_СВИТКА) {
        if (взято.has(гр) || !re.test(ч.т)) continue;
        взято.add(гр);
        отметки.push({ i, пятна, сторона, сила: ч.сила });
      }
    });
    // Размывы киноварью: в середине гуще, край рваный, как тушь на сырой бумаге.
    const размывы = отметки.map(({ пятна, сила }) => пятна.map(([cx, cy, rx, ry]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${р(rx + 1.5)}" ry="${р(ry + 1.5)}" fill="url(#${drop})" opacity="${р(.45 + сила * .17)}"/><ellipse cx="${cx}" cy="${cy}" rx="${р(rx * .92)}" ry="${р(ry * .92)}" class="bloom-edge" opacity="${р(.25 + сила * .12)}"/>`
      + `<circle cx="${cx}" cy="${cy}" r="1.2" class="pt-on"/><circle cx="${cx}" cy="${cy}" r="2.6" class="pt-ring"/>`).join('')).join('');
    const горит = (x, y) => отметки.some(({ пятна }) => пятна.some(([cx, cy, rx, ry]) => ((x - cx) / (rx + 3)) ** 2 + ((y - cy) / (ry + 3)) ** 2 < 1));
    const точки = ТОЧКИ_КАНАЛОВ.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${горит(x, y) ? 1.15 : .8}" class="${горит(x, y) ? 'pt hot' : 'pt'}"/>`).join('');
    // Печати на полях: по высоте своей отметки, друг на друга не налезают.
    const поля = { '-1': [], '1': [] };
    for (const о of отметки) {
      const п = о.пятна.reduce((а, б) => (о.сторона < 0 ? (б[0] < а[0] ? б : а) : (б[0] > а[0] ? б : а)));
      const [x, y] = вСвиток(п[0] + о.сторона * п[2] * .8, п[1]);
      поля[о.сторона].push({ i: о.i, x, y, ц: y });
    }
    let выноски = '', печати = '';
    for (const [сторона, список] of Object.entries(поля)) {
      список.sort((а, б) => а.y - б.y);
      список.forEach((м, k) => { м.ц = Math.max(м.y, k ? список[k - 1].ц + 11.5 : 20); });
      for (let k = список.length - 1; k >= 0; k--) список[k].ц = Math.min(список[k].ц, k < список.length - 1 ? список[k + 1].ц - 11.5 : 188);
      const sx = +сторона < 0 ? 13 : 87;
      for (const м of список) {
        const кр = sx + (+сторона < 0 ? 5.4 : -5.4);
        выноски += `<path d="M${р(м.x)} ${р(м.y)}C${р((м.x + кр) / 2)} ${р(м.y)} ${р((м.x + кр) / 2)} ${р(м.ц)} ${р(кр)} ${р(м.ц)}" class="lead"/><circle cx="${р(м.x)}" cy="${р(м.y)}" r=".8" class="lead-dot"/>`;
        печати += `<g class="seal" transform="translate(${sx} ${р(м.ц)}) rotate(${(хеш(м.i + ':' + м.ц) % 9) - 4})"><rect x="-5" y="-5" width="10" height="10" rx="1" filter="url(#${rough})"/>`
          + `<rect x="-4" y="-4" width="8" height="8" rx=".5" class="in"/><text y="1.9" text-anchor="middle">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][м.i] || м.i + 1}</text></g>`;
      }
    }
    const анатомия = 'M47 34.2C44 36 40 36 36.2 37.6M53 34.2C56 36 60 36 63.8 37.6M40.4 49C43 54 47 54.4 49.4 51.4M59.6 49C57 54 53 54.4 50.6 51.4'
      + 'M40.6 91C44 96 47 99 49.2 101.4M59.4 91C56 96 53 99 50.8 101.4M41.2 139.4q2.3 1.8 4.6 0M54.2 139.4q2.3 1.8 4.6 0M43.6 60.5q1.6 1.2 3 .6M56.4 60.5q-1.6 1.2-3 .6';
    const svg = `<svg class="gr-chart" viewBox="-9 -15 118 232" aria-hidden="true"><defs>`
      + `<linearGradient id="${paper}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" class="pp0"/><stop offset=".55" class="pp1"/><stop offset="1" class="pp2"/></linearGradient>`
      + `<linearGradient id="${wood}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--e-wood-hi)"/><stop offset=".45" style="stop-color:var(--e-wood)"/><stop offset="1" style="stop-color:var(--e-wood-lo)"/></linearGradient>`
      + `<linearGradient id="${knob}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--e-gold-hi)"/><stop offset=".5" style="stop-color:var(--e-gold)"/><stop offset="1" style="stop-color:var(--e-gold-lo)"/></linearGradient>`
      + `<pattern id="${silk}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M3 .6L5.4 3 3 5.4.6 3Z" class="brocade"/></pattern>`
      + `<pattern id="${hatch}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="2.4" class="hatch"/></pattern>`
      + `<linearGradient id="${shade}" x1="0" x2="1"><stop offset=".45" stop-opacity="0" style="stop-color:var(--ink)"/><stop offset="1" stop-opacity=".2" style="stop-color:var(--ink)"/></linearGradient>`
      + `<radialGradient id="${drop}"><stop offset="0" style="stop-color:var(--e-rubric)" stop-opacity=".95"/><stop offset=".6" style="stop-color:var(--e-rubric)" stop-opacity=".55"/><stop offset="1" style="stop-color:var(--e-rubric)" stop-opacity="0"/></radialGradient>`
      + `<clipPath id="${clip}"><path d="${тело}"/><path d="${голова}"/></clipPath>`
      + `<filter id="${wash}" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".2" numOctaves="2" seed="${хеш(el.textContent) % 97}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".7"/></filter>`
      + `<filter id="${rough}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale=".9" xChannelSelector="R" yChannelSelector="G"/></filter>`
      + `<filter id="${blur}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>`
      + `<filter id="${soft}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>`
      + `<filter id="${grain}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.3 .35" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05"/></filter></defs>`
      // Свиток: шнур на гвоздике, тень, шёлковая оправа с узором, бумага, две ленты сверху, валики.
      + `<path d="M5 -1.5L50 -12.4L95 -1.5" class="cord"/><circle cx="50" cy="-12.6" r="1.5" class="nail"/>`
      + `<rect x="1.5" y="4" width="100" height="207" rx="1" class="shadow" filter="url(#${blur})"/>`
      + `<rect x="0" y="0" width="100" height="208" class="mount"/><rect x="0" y="0" width="100" height="208" fill="url(#${silk})"/>`
      + `<rect x="5" y="13" width="90" height="184" fill="url(#${paper})" class="paper"/><rect x="5" y="13" width="90" height="184" filter="url(#${grain})" class="grain"/><rect x="5" y="13" width="90" height="184" class="paper-edge"/>`
      + `<rect x="34.5" y="0" width="3" height="27" class="band"/><rect x="62.5" y="0" width="3" height="27" class="band"/><path d="M34.5 27h3M62.5 27h3" class="band-end"/>`
      + `<rect x="-3.6" y="-4.2" width="107.2" height="5.4" rx="2.7" fill="url(#${wood})"/><rect x="-3.6" y="206.4" width="107.2" height="6" rx="3" fill="url(#${wood})"/>`
      + `<rect x="-8" y="-4.6" width="5" height="6.2" rx="1.6" fill="url(#${knob})"/><rect x="103" y="-4.6" width="5" height="6.2" rx="1.6" fill="url(#${knob})"/>`
      + `<rect x="-8" y="206" width="5" height="6.8" rx="1.6" fill="url(#${knob})"/><rect x="103" y="206" width="5" height="6.8" rx="1.6" fill="url(#${knob})"/>`
      // Фигура: тело и голова, тень штриховкой справа, линии анатомии, каналы.
      + `<g class="fig" transform="translate(50 106) scale(.9) translate(-50 -94)">`
      + `<path d="M43.2 14.6C43.4 9.4 46.6 7.2 50 7.2S56.6 9.4 56.8 14.6C54 12.2 46 12.2 43.2 14.6Z" class="hair"/><ellipse cx="50" cy="5.6" rx="3.2" ry="2.4" class="hair"/>`
      + `<path d="M56.9 15.4c1.6-.5 2.1 1.1 1.6 3.2s-1.2 2.6-1.8 2.4M43.1 15.4c-1.6-.5-2.1 1.1-1.6 3.2s1.2 2.6 1.8 2.4" class="ear"/>`
      + `<path d="${тело}" class="skin"/><path d="${голова}" class="skin"/>`
      + `<g clip-path="url(#${clip})"><rect x="0" y="0" width="100" height="190" fill="url(#${shade})"/><rect x="58" y="0" width="42" height="190" fill="url(#${hatch})"/><g filter="url(#${soft})"><path d="${тело}" class="rim"/><path d="${голова}" class="rim"/></g>`
      + `<path d="M43.2 14.6C43.4 9.4 46.6 7.2 50 7.2S56.6 9.4 56.8 14.6C54 12.2 46 12.2 43.2 14.6Z" class="hair"/></g>`
      + `<path d="${анатомия}" class="anat"/><path d="${КАНАЛЫ}" class="chan"/>${точки}`
      + `<g filter="url(#${wash})">${размывы}</g>`
      + `<path d="${тело}" class="outline"/><path d="${голова}" class="outline"/><ellipse cx="50" cy="5.6" rx="3.2" ry="2.4" class="outline thin"/></g>`
      + `<g class="marks">${выноски}${печати}</g>`
      // Печать самого лекаря в углу листа: веточка травы.
      + `<g class="seal own" transform="translate(86 188) rotate(-3)"><rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx=".6" filter="url(#${rough})"/><path d="M0 2.6V-2.6M0-.4L-1.8-1.9M0 1.1L1.8-.5M0 2.4L-1.5 1.2" class="herb"/></g>`
      + `</svg>`;
    el.querySelector(':scope > svg:not(.rule)')?.remove();
    el.querySelector('.top')?.insertAdjacentHTML('afterend', svg);
    const ol = el.querySelector('ol');
    if (ol) ol.innerHTML = чтения.map((ч, i) => `<li><i class="seal-n">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i] || i + 1}</i><span>${esc(ч.т)}</span>`
      + `<span class="pulse" title="${'+'.repeat(ч.сила)}">${[1, 2, 3].map(n => `<b${n <= ч.сила ? ' class="on"' : ''}></b>`).join('')}</span></li>`).join('');
    el.classList.add('gr-scroll');
    return null;
  }

  const СРЕДНЕВЕКОВОЕ_ПРИЗЕМЛЁННОЕ = [
    ['body', '.era-cand:not(.gr-incense-m)', свечиПриземлённые],
    ['sched', '.era-hours:not(.gr-hours)', часыЗверей],
    ['phys', '.era-leech:not(.gr-scroll)', свитокЛекаря],
  ];

  /* ─────────────────────────────── проход ─────────────────────────────── */

  const список = () => {
    // Эпоха облика: при скрытой магии — фэнтези-вариант базы для выбранных блоков.
    const э = эпохаОблика(), земля = магияОблика() === 'grounded';
    if (э === 'fantasy-modern') return земля ? СОВРЕМЕННОЕ_ПРИЗЕМЛЁННОЕ : СОВРЕМЕННОЕ;
    if (э === 'fantasy-medieval') return земля ? СРЕДНЕВЕКОВОЕ_ПРИЗЕМЛЁННОЕ : СРЕДНЕВЕКОВОЕ;
    return [];
  };
  /** Все селекторы фэнтези — для наблюдателя вставок (era-medieval.js). */
  export const СЕЛЕКТОРЫ_ФЭНТЕЗИ = [...new Set([СОВРЕМЕННОЕ, СРЕДНЕВЕКОВОЕ, СОВРЕМЕННОЕ_ПРИЗЕМЛЁННОЕ, СРЕДНЕВЕКОВОЕ_ПРИЗЕМЛЁННОЕ].flat().map(([, с]) => с))].join(', ');

  // Рисунки телефона (круги или горы) — переменными на корне страницы, один раз на магию.
  let телефонДля = '';
  /** Пересобрать виды фэнтези в поддереве. Повторный вызов безопасен. */
  export function преобразитьФэнтези(корень) {
    if (!корень || корень.nodeType !== 1) return;
    const э = эпоха();
    // Телефон переодевается только при общедоступной магии: с ним меняется и промт.
    if (э === 'fantasy-modern' && телефонДля !== (приземлённое() ? 'g' : 'h')) {
      телефонДля = приземлённое() ? 'g' : 'h';
      try { (приземлённое() ? горыТелефона : кругиТелефона)(корень); } catch (e) { console.warn('[TavernOS HUD] телефон фэнтези', e); }
    }
    for (const [ключ, с, пересобрать] of список()) {
      if (!блокПодМагию(ключ)) continue;
      for (const старый of найти(корень, с)) {
        try { const новый = пересобрать(старый); if (новый) старый.replaceWith(новый); } catch (e) { console.warn('[TavernOS HUD] фэнтези', с, e); }
      }
    }
  }
  export { кошель };
