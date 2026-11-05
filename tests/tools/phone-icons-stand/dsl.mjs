// Короткая запись рисунков стенда. Поле 120×120, предмет — примерно в рамке
// 24…96 по x и 22…96 по y, центр (60, 58).
//
// Классы заливки:  m — главный цвет, ml/md — светлее/темнее, s — второй цвет,
//                  sd — он же темнее, d — кожа/тёмный материал, k — чернила,
//                  g — золото темы, p — бумага, t — небо.
// Классы контура:  lm, ll, ls, ld, lk, lg, lp, lw — те же цвета линией.
// Семейства (build.mjs) переодевают классы: неон — в контур, тушь — в кисть.

export const ф = (n) => Math.round(n * 10) / 10;
const ш = (w) => (w ? ` stroke-width="${w}"` : '');

// Линия нулевой толщины — выключенный штрих: не рисуем.
export const P = (c, d, w) => (w === 0 && /^l/.test(c) ? '' : `<path class="${c}" d="${d}"${ш(w)}/>`);
export const C = (c, x, y, r, w) => `<circle class="${c}" cx="${x}" cy="${y}" r="${r}"${ш(w)}/>`;
export const E = (c, x, y, rx, ry, наклон = 0, w) => { const rot = Math.abs(наклон) <= 15 ? 0 : наклон; return `<ellipse class="${c}" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}${ш(w)}/>`; };
export const R = (c, x, y, ww, h, r = 0, наклон = 0, w) => { const rot = Math.abs(наклон) <= 15 ? 0 : наклон; return `<rect class="${c}" x="${x}" y="${y}" width="${ww}" height="${h}"${r ? ` rx="${r}"` : ''}${rot ? ` transform="rotate(${rot} ${x + ww / 2} ${y + h / 2})"` : ''}${ш(w)}/>`; };
export const T = (c, текст, x, y, размер) => `<text class="${c}" x="${x}" y="${y}" text-anchor="middle" font-size="${размер}">${текст}</text>`;
export const G = (преобразование, ...части) => `<g transform="${преобразование}">${части.join('')}</g>`;
export const В = (точки) => 'M' + точки.map(([x, y]) => `${ф(x)} ${ф(y)}`).join('L') + 'Z';
export const Л = (точки) => 'M' + точки.map(([x, y]) => `${ф(x)} ${ф(y)}`).join('L');

// Круговой ряд: f(x, y, угол°, i).
export const кругом = (n, cx, cy, r, f, начало = -90) => Array.from({ length: n }, (_, i) => {
  const а = начало + i * 360 / n, рад = а * Math.PI / 180;
  return f(ф(cx + Math.cos(рад) * r), ф(cy + Math.sin(рад) * r), а, i);
}).join('');
export const ряд = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

// Частые формы: отдают d для P().
export const звезда = (x, y, r, n = 5, вн = .42, поворот = -90) => В(Array.from({ length: n * 2 }, (_, i) => {
  const а = (поворот + i * 180 / n) * Math.PI / 180, q = i % 2 ? r * вн : r;
  return [x + Math.cos(а) * q, y + Math.sin(а) * q];
}));
export const шестерня = (x, y, r, зубьев = 10, глубина = .2) => В(Array.from({ length: зубьев * 4 }, (_, i) => {
  const а = (i / (зубьев * 4)) * Math.PI * 2 - Math.PI / (зубьев * 4), q = i % 4 < 2 ? r : r * (1 - глубина);
  return [x + Math.cos(а) * q, y + Math.sin(а) * q];
}));
export const сердце = (x, y, s) => `M${ф(x)} ${ф(y + s)}C${ф(x - s * 1.5)} ${ф(y + s * .05)} ${ф(x - s * 1.1)} ${ф(y - s)} ${ф(x)} ${ф(y - s * .34)}C${ф(x + s * 1.1)} ${ф(y - s)} ${ф(x + s * 1.5)} ${ф(y + s * .05)} ${ф(x)} ${ф(y + s)}Z`;
export const капля = (x, y, s) => `M${ф(x)} ${ф(y - s * 1.3)}C${ф(x + s * .35)} ${ф(y - s * .4)} ${ф(x + s)} ${ф(y)} ${ф(x + s)} ${ф(y + s * .4)}A${ф(s)} ${ф(s)} 0 0 1 ${ф(x - s)} ${ф(y + s * .4)}C${ф(x - s)} ${ф(y)} ${ф(x - s * .35)} ${ф(y - s * .4)} ${ф(x)} ${ф(y - s * 1.3)}Z`;
// Лист: от основания (x, y) в сторону угла, длина L.
export const лист = (x, y, L, угол = -90, ширина = .32) => {
  const а = угол * Math.PI / 180, ex = x + Math.cos(а) * L, ey = y + Math.sin(а) * L;
  const nx = -Math.sin(а) * L * ширина, ny = Math.cos(а) * L * ширина, mx = (x + ex) / 2, my = (y + ey) / 2;
  return `M${ф(x)} ${ф(y)}Q${ф(mx + nx)} ${ф(my + ny)} ${ф(ex)} ${ф(ey)}Q${ф(mx - nx)} ${ф(my - ny)} ${ф(x)} ${ф(y)}Z`;
};
export const месяц = (x, y, r, сдвиг = .45) => `M${ф(x)} ${ф(y - r)}A${ф(r)} ${ф(r)} 0 1 0 ${ф(x)} ${ф(y + r)}A${ф(r * (1 + сдвиг))} ${ф(r * (1 + сдвиг))} 0 1 1 ${ф(x)} ${ф(y - r)}Z`;
export const облако = (x, y, s) => `M${ф(x - s * 1.5)} ${ф(y + s * .6)}a${ф(s * .6)} ${ф(s * .6)} 0 0 1 ${ф(s * .1)} ${ф(-s * 1.15)}a${ф(s * .8)} ${ф(s * .8)} 0 0 1 ${ф(s * 1.45)} ${ф(-s * .35)}a${ф(s * .65)} ${ф(s * .65)} 0 0 1 ${ф(s * 1.15)} ${ф(s * .45)}a${ф(s * .55)} ${ф(s * .55)} 0 0 1 ${ф(s * .2)} ${ф(s * 1.05)}Z`;
// Нота: головка в (x, y), штиль вверх.
export const нота = (c, x, y, s = 1) => E(c, x, y, 6 * s, 4.6 * s, -20) + P(c.replace(/^./, 'l' + c[0]), `M${ф(x + 5.4 * s)} ${ф(y - 1)}V${ф(y - 26 * s)}c0 6 8 7 9 13`, 3);
// Лицо каваи: глаза, улыбка и румянец вокруг (x, y).
export const лицо = (x, y, r = 8) => C('k', x - r, y, r * .28) + C('k', x + r, y, r * .28) + C('kg', x - r + 1, y - 1, r * .1) + C('kg', x + r + 1, y - 1, r * .1)
  + P('lk', `M${ф(x - r * .35)} ${ф(y + r * .3)}q${ф(r * .35)} ${ф(r * .45)} ${ф(r * .7)} 0`, 1.8)
  + E('blush', x - r * 1.55, y + r * .5, r * .42, r * .26) + E('blush', x + r * 1.55, y + r * .5, r * .42, r * .26);

// Формы плитки: контур в поле 120×120, всё симметрично по обеим осям.
const зигзаг = (f, n) => 'M' + Array.from({ length: n }, (_, i) => { const а = i / n * Math.PI * 2 - Math.PI / 2, [x, y] = f(а, i); return `${ф(60 + x)} ${ф(60 + y)}`; }).join('L') + 'Z';
// Суперэллипс — «сквиркл», как у иконок iOS.
const сквиркл = зигзаг((а) => { const c = Math.cos(а), s = Math.sin(а), e = 2 / 5; return [58 * Math.sign(c) * Math.abs(c) ** e, 58 * Math.sign(s) * Math.abs(s) ** e]; }, 96);
// Цветок: восемь равных лепестков.
const цветок = зигзаг((а) => { const r = 54.5 + 3.5 * Math.cos(а * 8); return [r * Math.cos(а), r * Math.sin(а)]; }, 160);
// Край из равных дуг: зубец наружу (почтовая марка — внутрь).
function край(n, r, наружу) {
  const ш = 104 / n, d = [];
  const дуга = (dx, dy) => `a${r} ${r} 0 0 ${наружу ? 1 : 0} ${dx} ${dy}`;
  d.push('M8 8');
  for (let i = 0; i < n; i++) d.push(дуга(ш, 0));
  for (let i = 0; i < n; i++) d.push(дуга(0, ш));
  for (let i = 0; i < n; i++) d.push(дуга(-ш, 0));
  for (let i = 0; i < n; i++) d.push(дуга(0, -ш));
  return d.join('') + 'Z';
}
export const ФОРМЫ = {
  round: 'M30 2h60a28 28 0 0 1 28 28v60a28 28 0 0 1-28 28H30A28 28 0 0 1 2 90V30A28 28 0 0 1 30 2Z',
  soft: 'M22 2h76a20 20 0 0 1 20 20v76a20 20 0 0 1-20 20H22A20 20 0 0 1 2 98V22A20 20 0 0 1 22 2Z',
  square: 'M8 2h104a6 6 0 0 1 6 6v104a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z',
  circle: 'M60 2a58 58 0 1 1 0 116A58 58 0 0 1 60 2Z',
  hex: 'M60 2l50.2 29v58L60 118 9.8 89V31Z',
  octagon: 'M36 2h48l34 34v48l-34 34H36L2 84V36Z',
  shield: 'M12 4h96a6 6 0 0 1 6 6v48c0 30-24 46-54 60C30 104 6 88 6 58V10a6 6 0 0 1 6-6Z',
  arch: 'M60 2c31 0 54 24 54 54v56a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V56C6 26 29 2 60 2Z',
  ticket: 'M14 4h92a10 10 0 0 0 10 10v92a10 10 0 0 0-10 10H14a10 10 0 0 0-10-10V14A10 10 0 0 0 14 4Z',
  stamp: край(8, 6.6, false),
  scallop: край(8, 6.6, true),
  cartouche: 'M60 2c28 0 44 12 44 30v56c0 18-16 30-44 30S16 106 16 88V32C16 14 32 2 60 2Z',
  squircle: сквиркл,
  flower: цветок,
};

// Поле под предмет в каждой форме: центр и размер. Шире не надо — предмет
// должен сидеть в плитке с ровными полями, а не упираться в край.
export const ПОЛЕ = {
  round: [60, 60, 78], soft: [60, 60, 78], square: [60, 60, 80], circle: [60, 60, 74], hex: [60, 60, 68], octagon: [60, 60, 74],
  shield: [60, 53, 62], arch: [60, 67, 72], ticket: [60, 60, 76], stamp: [60, 60, 72], scallop: [60, 60, 72], cartouche: [60, 60, 62],
  squircle: [60, 60, 78], flower: [60, 60, 70],
};
