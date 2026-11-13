// hud-manager/render/scene-plus.js
//
// Дополнительные детали сезонных сцен виджета погоды — поверх того, что
// рисует render/scene.js. Каждая деталь — SVG со своими классами (цвета и
// места — css/season-plus.css), без id: карточек на странице много.
// Движение — как у всей сцены: стоит, пока виджет не раскрыт касанием
// (.fx-active), и первый кадр каждой анимации — спокойная картинка.

import { ельSvg, салазкиSvg } from './scene-art.js?v=23.89.18';

const лист = (x, y, r, s, цвет) => `<path class="sp-leaf ${цвет}" transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 -6 L1.6 -2.4 L5 -3.4 L3.6 0 L6 1.6 L2.2 2 L2.6 5.4 L0 3.4 L-2.6 5.4 L-2.2 2 L-6 1.6 L-3.6 0 L-5 -3.4 L-1.6 -2.4Z M0 3.4 V8"/>`;

// Ёж в профиль мордой вправо (viewBox 0 0 64 36, земля — y 35): лапки
// отдельно (шагают парами по диагонали, см. --hh-step в misc.css), торс —
// иглы зубчатым краем и рядами, голова отдельной группой (принюхивается).
let кэшЕжа = '';
function ёжТело() {
  if (кэшЕжа) return кэшЕжа;
  const ф = (n) => n.toFixed(1);
  const куб = (p, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); };
  const кас = (p, t) => { const u = 1 - t; const v = [0, 1].map((k) => 3 * u * u * (p[1][k] - p[0][k]) + 6 * u * t * (p[2][k] - p[1][k]) + 3 * t * t * (p[3][k] - p[2][k])); const d = Math.hypot(v[0], v[1]) || 1; return [v[0] / d, v[1] / d]; };
  const дуги = [[[5, 27], [3, 15], [14, 7.6], [27, 7.6]], [[27, 7.6], [40, 7.6], [49, 13], [50, 21]]];
  const точки = [];
  for (const д of дуги) for (let i = 0; i < 18; i++) { const t = i / 18; точки.push([куб(д, t), кас(д, t)]); }
  точки.push([[50, 21], кас(дуги[1], 1)]);
  // Зубчатый край: основание на дуге, кончик иглы наружу и назад.
  let край = 'M5 27';
  точки.forEach(([[x, y], [tx, ty]], i) => {
    const nx = ty, ny = -tx;
    if (i % 2) край += ' L' + ф(x + nx * 2.8 - tx * 1.8) + ' ' + ф(y + ny * 2.8 - ty * 1.8);
    else край += ' L' + ф(x) + ' ' + ф(y);
  });
  край += ' Q46 30 30 31 Q14 31 5 27Z';
  // Ряды игл внутри: короткие штрихи вверх-назад трёх тонов.
  const ряды = ['', '', ''];
  for (let r = 1; r <= 4; r++) {
    точки.forEach(([[x, y], [tx, ty]], i) => {
      const t = i / точки.length;
      if (t < .06 + r * .02 || t > .97 - r * .03 || (i + r) % 2) return;
      const nx = ty, ny = -tx, bx = x - nx * r * 2.5, by = y - ny * r * 2.5;
      ряды[(i + r) % 3] += 'M' + ф(bx) + ' ' + ф(by) + ' l' + ф(nx * 3.2 - tx * 2.2) + ' ' + ф(ny * 3.2 - ty * 2.2);
    });
  }
  const лапа = (x, к) => '<path class="hh-leg ' + к + '" d="M' + x + ' 29.5 V34.4 h1.6"/>';
  // Всё, что стыкуется, уходит под соседнее: лапки — под живот, морда — под
  // край игл, живот — под иглы. Швов поверх зверька нет, он читается целым.
  кэшЕжа = '<g class="hh-legs">' + лапа(17, 'far b') + лапа(39.5, 'far a') + '</g>'
    + '<g class="hh-legs near">' + лапа(21, 'a') + лапа(43.5, 'b') + '</g>'
    + '<g class="hh-torso"><path class="hh-belly" d="M7 27 C13 33 30 34.6 44 33.2 C50 32.6 54 31.4 56 29.8 L40 26Z"/>'
    + '<g class="hh-head"><path class="hh-face" d="M41 21.5 C45 17.5 52 18.5 57 22.5 C59.5 24.3 61.5 26 62 27.4 C58.5 30.2 52.5 31.6 46.5 31.2 C42 30.6 39.5 26.5 41 21.5Z"/>'
    + '<path class="hh-cheek" d="M44 29.6 C49 31 55 30.4 59.6 28.6 C56.4 30.6 51.6 31.6 46.5 31.2 C45.6 31 44.8 30.4 44 29.6Z"/>'
    + '<ellipse class="hh-ear" cx="44.6" cy="20.6" rx="1.7" ry="1.9"/><circle class="hh-eye" cx="50.8" cy="23.4" r="1.45"/><circle class="hh-glint" cx="51.3" cy="22.9" r=".45"/>'
    + '<ellipse class="hh-nose" cx="62" cy="27.3" rx="1.8" ry="1.5"/><path class="hh-whisk" d="M60 28.6 l2.6 1.4 M59.6 29.2 l2 2"/></g>'
    + '<path class="hh-spines" d="' + край + '"/><path class="hh-shade" d="' + край + '"/><path class="hh-q q1" d="' + ряды[0] + '"/><path class="hh-q q2" d="' + ряды[1] + '"/><path class="hh-q q3" d="' + ряды[2] + '"/></g>';
  return кэшЕжа;
}
export function ёжSvg(роль) {
  return '<svg class="hh hh-' + роль + '" viewBox="0 0 64 36" aria-hidden="true">' + ёжТело() + '</svg>';
}

// Нора под холмиком: земля с опавшими листьями, корень аркой над лазом,
// лаз темнеет вглубь тремя слоями, сухая трава и камешки по краям.
export function нораSvg() {
  const лист = (x, y, r, c) => '<path class="bl ' + c + '" transform="translate(' + x + ' ' + y + ') rotate(' + r + ')" d="M0 0 C1.6 -1.5 3.8 -1.3 4.6 0 C3.8 1.3 1.6 1.5 0 0Z"/>';
  return '<svg class="hud-burrow-art" viewBox="0 0 58 30" aria-hidden="true">'
    + '<ellipse class="b-shadow" cx="29" cy="29.4" rx="29" ry="1.6"/>'
    + '<path class="b-earth" d="M1 30 C3 22 9 15.5 18 13 C24 11.4 34 11.2 41 13 C50 15.6 55.5 22 57 30Z"/>'
    + '<path class="b-lit" d="M10 18 C16 13.6 26 12.2 34 12.6 C42 13 48 15.6 51 19 C44 16.4 36 15.4 28 15.6 C20 15.8 14 17 10 18Z"/>'
    + '<path class="b-dark" d="M1 30 C2 27 4 24.5 7 22.5 C8 26 10 28.6 14 30Z M57 30 C56 27 54 24.5 51 22.5 C50 26 48 28.6 44 30Z"/>'
    + '<path class="b-crumb" d="M8 25 h1.2 M12 21.4 h1 M47 23.6 h1.2 M50 26.4 h1 M34 15 h1"/>'
    + '<path class="b-rim" d="M15 30 C15 22.5 20.5 17.6 29 17.6 C37.5 17.6 43 22.5 43 30Z"/>'
    + '<path class="b-mid" d="M17 30 C17 23.6 22 19.6 29 19.6 C36 19.6 41 23.6 41 30Z"/>'
    + '<path class="b-deep" d="M20.5 30 C20.5 25.2 24.2 22.2 29 22.2 C33.8 22.2 37.5 25.2 37.5 30Z"/>'
    + '<path class="b-lip" d="M15.6 27 C16.4 21.6 21.6 18 29 18 C36.4 18 41.6 21.6 42.4 27"/>'
    + '<path class="b-root" d="M10 21.6 C14 15.4 23 13.4 30.4 14.2 C37 15 42.4 17.4 46.6 22"/><path class="b-rootlet" d="M18.4 16.2 l-1.2 -2.8 M38.6 15.8 l1.8 -2.6 M44.4 19.8 l2.8 -.4 M13.6 18.4 l-2.6 -.8"/>'
    + лист(5.5, 24.5, -30, 'c1') + лист(9, 19.6, 12, 'c2') + лист(14, 15.6, -12, 'c3') + лист(22, 12.4, 24, 'c4') + лист(26.5, 12.2, 168, 'c1')
    + лист(34.5, 12.2, -18, 'c2') + лист(41, 13.8, 38, 'c5') + лист(47, 17, 8, 'c3') + лист(51.5, 21.6, -36, 'c4') + лист(54.5, 26.2, 22, 'c1')
    + '<ellipse class="b-stone" cx="11" cy="28.7" rx="1.7" ry="1.05"/><ellipse class="b-stone s2" cx="46.6" cy="28.9" rx="1.3" ry=".8"/><ellipse class="b-stone" cx="44" cy="29.4" rx=".9" ry=".55"/>'
    + '<path class="b-soil" d="M13 30 C15.6 28.8 19.4 28.6 21.4 29.2 L21.6 30Z M36.6 29.2 C38.6 28.6 42.4 28.8 45 30 L36.4 30Z"/>'
    + '<path class="b-grass" d="M2 30 l-.6 -4 M3.2 30 l.8 -5 M4.6 30 l1.6 -3.6 M53 30 l-1.4 -3.8 M54.4 30 l.2 -5 M55.8 30 l1.2 -3.4"/><path class="b-grass g2" d="M2.6 30 l.2 -3 M54 30 l.8 -3.2 M24 13 l-.4 -2 M33 12.6 l.5 -2"/>'
    + '</svg>';
}

// Пальма у левого края: сужающийся изогнутый ствол с рубцами от старых листьев
// и тенью справа, перистые листья (стержень + свисающие листочки), гроздь
// кокосов и один сухой лист, повисший вдоль ствола. Считается один раз.
let кэшПальмы = '';
function пальмаSvg() {
  if (кэшПальмы) return кэшПальмы;
  const ф = (n) => n.toFixed(1);
  const куб = (p, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); };
  const кубК = (p, t) => { const u = 1 - t; return [0, 1].map((k) => 3 * u * u * (p[1][k] - p[0][k]) + 6 * u * t * (p[2][k] - p[1][k]) + 3 * t * t * (p[3][k] - p[2][k])); };
  const норм = ([x, y]) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
  // Ствол: ось от основания к кроне, ширина сужается, у земли — корневое утолщение.
  const ось = [[16, 130], [18, 100], [27, 62], [40, 35]];
  const ширина = (t) => 8.6 - 5 * t + (t < .06 ? (0.06 - t) * 40 : 0);
  const лев = [], прав = [], тень = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, [x, y] = куб(ось, t), [tx, ty] = норм(кубК(ось, t)), nx = -ty, ny = tx, w = ширина(t) / 2;
    лев.push([x - nx * w, y - ny * w]); прав.push([x + nx * w, y + ny * w]); тень.push([x + nx * w * .15, y + ny * w * .15]);
  }
  const контур = (A, B) => 'M' + A.map((p) => ф(p[0]) + ' ' + ф(p[1])).join(' L') + ' L' + B.slice().reverse().map((p) => ф(p[0]) + ' ' + ф(p[1])).join(' L') + 'Z';
  let рубцы = '';
  for (let i = 1; i < 17; i++) {
    const t = i / 17.5, [x, y] = куб(ось, t), [tx, ty] = норм(кубК(ось, t)), nx = -ty, ny = tx, w = ширина(t) / 2;
    const провис = 1.1 + w * .25;
    рубцы += 'M' + ф(x - nx * w) + ' ' + ф(y - ny * w) + ' Q' + ф(x - tx * провис) + ' ' + ф(y - ty * провис) + ' ' + ф(x + nx * w) + ' ' + ф(y + ny * w);
  }
  const ствол = '<path class="trunk" d="' + контур(лев, прав) + '"/><path class="trunk-shade" d="' + контур(тень, прав) + '"/><path class="ring" d="' + рубцы + '"/>';
  // Лист: стержень дугой из кроны, листочки по обе стороны свисают вниз.
  const К = [40, 33];
  const лист = (кончик, упор, длина, класс) => {
    const p = [К, упор, кончик];
    const точка = (t) => { const u = 1 - t; return [0, 1].map((k) => u * u * p[0][k] + 2 * u * t * p[1][k] + t * t * p[2][k]); };
    const кас = (t) => норм([0, 1].map((k) => 2 * (1 - t) * (p[1][k] - p[0][k]) + 2 * t * (p[2][k] - p[1][k])));
    let перья = '';
    for (let i = 1; i <= 15; i++) {
      const t = .06 + i * .058, [x, y] = точка(t), [tx, ty] = кас(t), L = длина * Math.pow(Math.sin(Math.PI * Math.min(t, .96)), .55) * (1 - .25 * t);
      for (const сторона of [-1, 1]) {
        const [dx, dy] = норм([tx * .5 - ty * сторона * .85, ty * .5 + tx * сторона * .85 + .7]);
        const ex = x + dx * L, ey = y + dy * L;
        перья += 'M' + ф(x) + ' ' + ф(y) + ' Q' + ф(x + dx * L * .55) + ' ' + ф(y + dy * L * .45 - L * .12) + ' ' + ф(ex) + ' ' + ф(ey);
      }
    }
    return '<g class="frond ' + класс + '"><path class="pinnae" d="' + перья + '"/><path class="rachis" d="M' + К.join(' ') + ' Q' + упор.join(' ') + ' ' + кончик.join(' ') + '"/></g>';
  };
  const задние = лист([10, 20], [20, 4], 8, 'back') + лист([76, 14], [60, 0], 8, 'back') + лист([47, 4], [43, 12], 6, 'back');
  const передние = лист([3, 48], [14, 14], 10, 'front') + лист([87, 46], [70, 12], 10, 'front') + лист([20, 70], [24, 34], 9, 'front') + лист([68, 72], [62, 34], 9, 'front') + лист([86, 26], [66, 4], 9, 'front');
  const сухой = '<path class="dead" d="M39 36 C37 46 35 54 33 62 M38 40 l-3 3 M37.4 44 l-3 3.2 M36.6 48 l-3 3 M35.8 52 l-2.8 3 M35 56 l-2.6 2.8 M38.6 40 l2.6 2.6 M37.8 44 l2.8 2.8 M37 48 l2.6 2.8 M36.2 52 l2.4 2.6"/>';
  const кокосы = '<g class="cocos"><circle class="coco" cx="36.6" cy="37.6" r="3.3"/><circle class="coco" cx="42.4" cy="38.4" r="3.1"/><circle class="coco" cx="39.4" cy="41.6" r="3"/>'
    + '<path class="coco-hi" d="M35 36.4 a1.6 1.6 0 0 1 2 -1 M41 37.2 a1.5 1.5 0 0 1 2 -1 M38 40.5 a1.4 1.4 0 0 1 1.8 -1"/></g>';
  кэшПальмы = '<div class="hud-sp-palm" aria-hidden="true"><svg viewBox="0 0 90 130">' + ствол + сухой
    + '<g class="fronds">' + задние + кокосы + передние + '</g></svg></div>';
  return кэшПальмы;
}

function лето() {
  // Маяк на дальнем мысу: ночью — вращающийся луч.
  const маяк = `<div class="hud-sp-lighthouse" aria-hidden="true"><svg viewBox="0 0 40 60">`
    + `<path class="rock" d="M2 60 C6 50 12 47 20 47 C28 47 34 50 38 60Z"/><path class="tower" d="M15 48 L17 14 L23 14 L25 48Z"/><path class="stripe" d="M15.6 40 L24.4 40 L24.2 36 L15.8 36Z M16.2 28 L23.8 28 L23.6 24 L16.4 24Z"/>`
    + `<rect class="gallery" x="15" y="12" width="10" height="2" rx=".6"/><rect class="lamp" x="16.5" y="7" width="7" height="5" rx="1"/><path class="roof" d="M15.5 7 L20 2.5 L24.5 7Z"/></svg></div>`;
  // Краб, ракушки и морская звезда на мокром песке.
  const краб = `<div class="hud-sp-crab" aria-hidden="true"><svg viewBox="0 0 34 20"><path class="leg" d="M9 12 L3 15 M10 14 L5 18 M24 12 L30 15 M23 14 L28 18 M11 15 L8 19 M22 15 L25 19"/>`
    + `<path class="claw" d="M8 9 C3 9 1 5 3 2 C4 4 6 4 7 3 C7 6 8 7 10 8Z M26 9 C31 9 33 5 31 2 C30 4 28 4 27 3 C27 6 26 7 24 8Z"/>`
    + `<ellipse class="shell" cx="17" cy="12" rx="8.5" ry="5.5"/><path class="eyestalk" d="M14 8 V4 M20 8 V4"/><circle class="eye" cx="14" cy="3.6" r="1.4"/><circle class="eye" cx="20" cy="3.6" r="1.4"/></svg></div>`;
  const ракушки = `<div class="hud-sp-shells" aria-hidden="true"><svg viewBox="0 0 60 14"><path class="star" d="M10 1 L11.8 5.4 L16.6 5.6 L12.8 8.6 L14.2 13.2 L10 10.6 L5.8 13.2 L7.2 8.6 L3.4 5.6 L8.2 5.4Z"/>`
    + `<path class="scallop" d="M30 13 C24 13 22 6 30 3 C38 6 36 13 30 13Z"/><path class="scallop-l" d="M30 13 L27 5 M30 13 L30 3.5 M30 13 L33 5"/><path class="conch" d="M48 12 C44 12 42 9 44 6 C46 3 52 4 53 8 C54 11 51 12 48 12Z M50 6 C49 7 48 8 47 8"/></svg></div>`;
  // Воздушный змей с бантиками на хвосте — только днём (ночью гаснет в CSS).
  const змей = `<div class="hud-sp-kite" aria-hidden="true"><svg viewBox="0 0 50 70"><path class="string" d="M24 26 C30 40 22 52 34 70"/><path class="tail" d="M24 26 C18 34 26 40 20 48 C16 54 22 58 18 64"/>`
    + `<path class="bow" d="M21 36 l-3 -2 l0 4Z M21 36 l3 -2 l0 4Z M20.5 48 l-3 -2 l0 4Z M20.5 48 l3 -2 l0 4Z M19 60 l-3 -2 l0 4Z M19 60 l3 -2 l0 4Z"/>`
    + `<path class="sail s1" d="M24 2 L36 14 L24 26Z"/><path class="sail s2" d="M24 2 L12 14 L24 26Z"/><path class="spar" d="M24 2 V26 M12 14 H36"/></svg></div>`;
  return облако('c1') + облако('c2') + пальмаSvg() + маяк + змей + ракушки + краб;
}

function осень() {
  // Пугало на краю поля: шляпа, мешковина со стежками, клетчатая рубаха, солома; на руке ворона.
  const пугало = `<div class="hud-sp-scarecrow" aria-hidden="true"><svg viewBox="0 0 60 80"><path class="pole" d="M29 30 V80 M8 34 H52"/>`
    + `<path class="shirt" d="M18 30 L42 30 L46 34 L52 33 L52 39 L42 39 L42 56 L18 56 L18 39 L8 39 L8 33 L14 34Z"/><path class="plaid" d="M18 38 H42 M18 46 H42 M24 30 V56 M36 30 V56 M8 36 H18 M42 36 H52"/>`
    + `<path class="straw" d="M8 36 l-4 -2 M8 38 l-5 1 M8 40 l-4 3 M52 36 l4 -2 M52 38 l5 1 M52 40 l4 3 M22 56 l-1 6 M26 56 l0 7 M34 56 l0 6 M38 56 l1 7"/>`
    + `<circle class="head" cx="30" cy="22" r="9"/><path class="stitch" d="M24 25 q6 4 12 0 M25 24 v2 M28 25.5 v2 M31 25.5 v2 M34 24 v2"/><path class="eyes" d="M25.5 19.5 l3 3 M28.5 19.5 l-3 3 M31.5 19.5 l3 3 M34.5 19.5 l-3 3"/>`
    + `<path class="hat" d="M16 15 H44 L40 13 C39 5 36 2 30 2 C24 2 21 5 20 13Z"/><path class="band" d="M20.5 12 H39.5"/>`
    + `<g class="crow"><path class="crow-b" d="M44 33 C44 29 47 27 50 27 C52 27 54 28 55 30 L58 30 L55 31.5 C55 34 52 35 49 35 L43 36Z"/><circle class="crow-e" cx="52.5" cy="29.5" r=".7"/></g></svg></div>`;
  // Порыв ветра: кленовые листья летят через сцену.
  const листья = [[12, 12, 20, 1, 'c1'], [40, 30, -30, .8, 'c2'], [70, 8, 60, .9, 'c3'], [100, 26, 10, 1.1, 'c1'], [130, 14, -50, .8, 'c4'], [160, 30, 30, 1, 'c2'], [188, 10, -15, .9, 'c3']]
    .map(([x, y, r, s, c], i) => `<g class="gust g${i + 1}">${лист(x, y, r, s, c)}</g>`).join('');
  const порыв = `<div class="hud-sp-gust" aria-hidden="true"><svg viewBox="0 0 200 44" preserveAspectRatio="none">${листья}</svg></div>`;
  // Туман над лугом и фонарь на столбе ограды.
  const туман = `<div class="hud-sp-mist" aria-hidden="true"><i class="m1"></i><i class="m2"></i></div>`;
  const фонарь = `<div class="hud-sp-lantern" aria-hidden="true"><svg viewBox="0 0 16 26"><path class="hook" d="M8 0 V4"/><path class="cap" d="M3.5 7 L8 3.5 L12.5 7Z"/>`
    + `<rect class="glass" x="4.5" y="7" width="7" height="11" rx="1.2"/><path class="frame" d="M4.5 7 H11.5 M4.5 18 H11.5 M8 7 V18"/><path class="flame" d="M8 10 C9.6 12 9.6 14 8 15.4 C6.4 14 6.4 12 8 10Z"/><path class="base" d="M4 18 H12 L11 20 H5Z"/></svg></div>`;
  const тыква = (x, s, к) => `<g class="pumpkin ${к}" transform="translate(${x} 10) scale(${s})"><ellipse class="pk-l" cx="-3.2" cy="0" rx="3.6" ry="4"/><ellipse class="pk-r" cx="3.2" cy="0" rx="3.6" ry="4"/><ellipse class="pk-c" cx="0" cy="0" rx="3.4" ry="4.3"/><path class="pk-stem" d="M0 -4 C0 -6 1 -7 2.4 -7.4"/><path class="pk-vine" d="M1 -5 c3 -1 4 1 6 0"/></g>`;
  const тыквы = `<div class="hud-sp-pumpkins" aria-hidden="true"><svg viewBox="0 0 40 16">${тыква(9, 1.15, 'p1')}${тыква(22, .85, 'p2')}${тыква(32, .7, 'p3')}</svg></div>`;
  return туман + пугало + тыквы + фонарь + порыв;
}

function зима(extra = {}) {
  // Заснеженные ели: ярусы с провисающими лапами, тень у ствола, светлые
  // кончики иголок и шапки снега с наплывами (render/scene-art.js).
  const ель = (класс) => `<div class="hud-sp-spruce ${класс}" aria-hidden="true">${ельSvg()}</div>`;
  const ели = ель('e1') + ель('e2') + ель('e3');
  // Фонарный столб: тёплый ореол, шапка снега; на шапке фонаря — снегирь.
  const фонарь = `<div class="hud-sp-lamp" aria-hidden="true"><svg viewBox="0 0 40 90"><path class="pole" d="M18 90 V18 C18 12 22 10 26 12"/>`
    + `<path class="base" d="M14 90 H22 L21 84 H15Z"/><path class="head" d="M21 14 H31 L29 26 H23Z"/><rect class="light" x="23.5" y="16" width="5" height="8" rx="1"/><path class="cap" d="M20 14 C22 9 30 9 32 14Z"/>`
    + `<g transform="translate(12.4 -7.6)"><g class="bullfinch"><path class="bf-feet" d="M12 18.2 v1.2 M14 18.2 v1.2"/><ellipse class="bf-belly" cx="13" cy="15" rx="4.2" ry="3.4"/><path class="bf-back" d="M8.6 14 C9 10.5 12 9.6 14.6 10.6 C16.4 11.4 17 13 16.8 14 C14 12.6 11 12.8 8.6 14Z"/><path class="bf-tail" d="M9 15 L5 17.5 L9.4 17Z"/><circle class="bf-eye" cx="15" cy="12.2" r=".6"/><path class="bf-beak" d="M16.8 12.6 L18.4 13.2 L16.8 13.8Z"/></g></g></svg></div>`;
  // Санки и цепочка следов к ним. Верёвка привязана к загнутому носу и
  // свободно лежит на снегу, а не висит дугой в воздухе.
  const следы = Array.from({ length: 7 }, (_, i) => `<ellipse class="step" cx="${(8 + i * 11).toFixed(1)}" cy="${(i % 2 ? 9 : 13).toFixed(1)}" rx="2.6" ry="1.4"/>`).join('');
  // В средневековье — деревянные салазки на гнутых полозьях, верёвка лубяная.
  const санки = extra.era === 'medieval' ? `<div class="hud-sp-sled is-era" aria-hidden="true">${салазкиSvg(следы)}</div>` : `<div class="hud-sp-sled" aria-hidden="true"><svg viewBox="0 0 140 24">${следы}<path class="rope" d="M125.6 16.6 C128.6 17.6 129.4 21 132 21.8 C134.6 22.6 137 21.4 139.4 22.2"/><path class="rope-knot" d="M124.8 16 L126.4 17.2"/>`
    + `<path class="runner" d="M98 20 H124 C128 20 128 15 124 15"/><path class="runner" d="M98 22 H120"/><path class="slat" d="M100 14 H124 V17 H100Z"/><path class="leg" d="M104 17 V21 M112 17 V21 M120 17 V21"/><path class="slat-snow" d="M100 14 C108 12 116 12 124 14Z"/></svg></div>`;
  return ели + санки + фонарь;
}

const облако = (класс) => `<div class="hud-sp-cloud ${класс}" aria-hidden="true"><svg viewBox="0 0 80 32"><path class="shade" d="M8 28 C2 28 2 20 8 19 C8 12 18 10 22 15 C24 6 38 4 42 12 C46 6 58 7 58 15 C66 13 74 19 70 26 C70 28 66 29 62 29Z"/>`
  + `<path class="puff" d="M8 26 C2 26 3 18 9 18 C9 11 19 9 23 14 C25 5 39 4 43 11 C47 5 59 7 58 14 C66 12 73 18 69 24 C68 26 64 27 61 27Z"/><path class="lit" d="M14 14 C16 11 20 11 22 13 M28 8 C32 6 37 7 39 10 M46 9 C49 8 53 9 54 11"/></svg></div>`;

function весна(extra) {
  // Тюльпаны у правого края — разных цветов, на листьях.
  const цвета = ['t1', 't2', 't3', 't4', 't1', 't3'];
  const тюльпаны = `<div class="hud-sp-tulips" aria-hidden="true"><svg viewBox="0 0 70 40">` + цвета.map((ц, i) => {
    const x = 6 + i * 11.5, h = 22 + (i % 3) * 5;
    return `<g class="tulip ${ц}" style="--i:${i}"><path class="stalk" d="M${x} 40 C${x} ${40 - h * .5} ${x + 1} ${40 - h * .8} ${x} ${40 - h}"/><path class="tleaf" d="M${x} 38 C${x - 7} 34 ${x - 7} 28 ${x - 5} 24 C${x - 3} 30 ${x - 1} 33 ${x} 36Z"/>`
      + `<path class="bloom" d="M${x - 4} ${40 - h} C${x - 4.5} ${36 - h} ${x - 3} ${33 - h} ${x - 2} ${33.5 - h} L${x} ${31 - h} L${x + 2} ${33.5 - h} C${x + 3} ${33 - h} ${x + 4.5} ${36 - h} ${x + 4} ${40 - h} C${x + 2} ${42 - h} ${x - 2} ${42 - h} ${x - 4} ${40 - h}Z"/><path class="petal-line" d="M${x} ${31.5 - h} V${40.5 - h}"/></g>`;
  }).join('') + `</svg></div>`;
  // Утка ведёт утят по траве: мама впереди (клюёт траву), утята топают
  // следом вперевалку; под лапами — тень и травинки, воды нет.
  const утёнок = (x, s, i) => '<g class="duckling d' + i + '" transform="translate(' + x + ' 16.4) scale(' + s + ')"><g class="dl-walk">'
    + '<path class="dl-leg lg1" d="M-.4 -.8 V1.1 H.9"/><path class="dl-leg lg2" d="M1.2 -.8 V1.1 H2.5"/>'
    + '<path class="dl-body" d="M-4.4 -2.6 C-4.6 -5 -2 -5.8 .6 -5.4 C2.8 -5 3.8 -3.4 3.2 -1.8 C2.4 -.4 -2.8 -.2 -4.4 -2.6Z"/><path class="dl-wing" d="M-2.4 -3.4 q1.6 -.9 3.2 0"/>'
    + '<circle class="dl-head" cx="2.4" cy="-6.6" r="2.1"/><path class="dl-beak" d="M4.2 -6.9 L6.1 -6.3 L4.2 -5.6Z"/><circle class="duck-eye" cx="3.1" cy="-7.1" r=".42"/></g></g>';
  const утки = '<div class="hud-sp-ducks" aria-hidden="true"><svg viewBox="0 0 64 19">'
    + '<ellipse class="shadow" cx="47" cy="17.4" rx="10" ry="1.1"/><ellipse class="shadow" cx="26" cy="17.6" rx="4" ry=".7"/><ellipse class="shadow" cx="16" cy="17.6" rx="3.6" ry=".7"/><ellipse class="shadow" cx="6.5" cy="17.6" rx="3.4" ry=".7"/>'
    + '<g class="mother"><path class="duck-leg lg1" d="M45 13.6 L44.4 17.2 H46.4"/><path class="duck-leg lg2" d="M48.4 13.4 L48.8 17.2 H50.8"/>'
    + '<path class="duck-body" d="M38.6 12.6 C36.6 11.6 35.6 10 35 8.8 C37.4 9.4 39 8.4 41.4 7.8 C45.4 6.9 50.4 7.3 52.4 9 C54.4 10.7 54.2 13.1 51.4 14.1 C47.8 15.3 41.4 14.9 38.6 12.6Z"/>'
    + '<path class="duck-wing" d="M41 9.8 C44 8.8 48.4 9 50.4 10.7 C47.4 12.2 43 12 41 9.8Z"/><path class="duck-spec" d="M44.4 11 L48.4 11.3"/><path class="duck-mottle" d="M38.4 10.6 l1 .3 M40 12 l1 .2 M51 12 l.9 -.3 M49 13.4 l1 -.2"/>'
    + '<g class="m-head"><path class="duck-neck" d="M50.2 9.8 C50.8 7.2 51.4 4.8 53.6 3.8 C55.8 3 57.6 4.2 57.4 5.8 C57.2 7 55.8 7.2 54.8 7.4 C53.8 7.8 53.4 9.2 53.6 10.6Z"/>'
    + '<path class="duck-beak" d="M57.1 4.9 L60.4 5.7 L57.1 6.6Z"/><path class="duck-brow" d="M53.6 4.9 L57 4.7"/><circle class="duck-eye" cx="55.6" cy="4.6" r=".55"/></g></g>'
    + утёнок(26, 1, 1) + утёнок(16, .92, 2) + утёнок(6.5, .86, 3)
    + '<path class="blades" d="M33 17.6 l-.6 -2.4 M34 17.6 l.5 -2 M11 17.8 l-.5 -1.8 M21 17.8 l.6 -1.9 M58 17.6 l.5 -2.2 M59.2 17.6 l-.3 -1.6 M1.5 17.8 l.4 -1.8"/></svg></div>';
  // Кучевые облака в весеннем небе (облако — общее с летом).
  const май = extra && extra.month === 5;
  return облако('c1') + облако('c2') + утки + тюльпаны + (май ? '' : '');
}

/** Детали поверх сцены сезона (render/scene.js). Пусто — у сезона деталей нет. */
export function деталиСезона(seasonClass, extra = {}) {
  if (seasonClass === 'season-summer') return лето();
  if (seasonClass === 'season-autumn') return осень();
  if (seasonClass === 'season-winter') return зима(extra);
  if (seasonClass === 'season-spring') return весна(extra);
  return '';
}

/**
 * Огни сцены — отдельный слой поверх ночного затемнения (.hud-fx-lights в
 * index.js): внутри сцены свет гас вместе с ней (фильтр яркости и слой
 * затемнения). Каждый огонь стоит в той же рамке, что и его предмет, и
 * загорается к вечеру и ночью (--scene-night-strength).
 */
export function огниСезона(seasonClass) {
  if (seasonClass === 'season-summer') return '<div class="hud-spl hud-spl-lighthouse" aria-hidden="true"><svg viewBox="0 0 40 60"><circle class="core" cx="20" cy="9.5" r="5"/><g class="beams"><path class="beam" d="M20 9 L-60 -2 L-60 20Z"/><path class="beam" d="M20 9 L100 -2 L100 20Z"/></g></svg></div>';
  if (seasonClass === 'season-autumn') return '<div class="hud-spl hud-spl-lantern" aria-hidden="true"><svg viewBox="0 0 16 26"><circle class="halo" cx="8" cy="13" r="16"/><circle class="core" cx="8" cy="13" r="3.6"/></svg></div>'
    + '<div class="hud-spl hud-spl-campfire" aria-hidden="true"><svg viewBox="0 0 30 40"><ellipse class="halo" cx="15" cy="30" rx="34" ry="22"/><ellipse class="core" cx="15" cy="30" rx="7" ry="6"/></svg></div>';
  if (seasonClass === 'season-winter') return '<div class="hud-spl hud-spl-lamp" aria-hidden="true"><svg viewBox="0 0 40 90"><path class="cone" d="M23 24 L29 24 L44 90 L8 90Z"/><circle class="halo" cx="26" cy="20" r="22"/><circle class="core" cx="26" cy="20" r="4.5"/><ellipse class="pool" cx="26" cy="88" rx="22" ry="4"/></svg></div>';
  return '';
}


// --- Перерисованные старые детали: вместо пятен CSS — рисунки SVG в тех же рамках ---

/** Снеговик: три кома с тенью и бликом, ветки-руки, вязаный шарф с бахромой, цилиндр с лентой и остролистом, метла. */
export function снеговикSvg() {
  return '<svg class="hud-old-svg" viewBox="0 0 60 90" aria-hidden="true">'
    + '<ellipse class="sm-shadow" cx="30" cy="87" rx="24" ry="3.5"/>'
    + '<g class="sm-broom"><path class="stick" d="M50 86 L44 34"/><path class="bristle" d="M47.5 86 L52.5 86 L55 76 L50.5 74 L46 76Z"/><path class="tie" d="M46.4 77 L53.8 76.2"/></g>'
    + '<path class="arm" d="M14 50 L3 42 M7 45 L4 40 M7 45 L2 46 M46 50 L56 41 M52 44.5 L54 39 M52 44.5 L58 45"/>'
    + '<circle class="ball" cx="30" cy="72" r="16"/><path class="ball-sh" d="M17 76 C20 85 40 88 45 76 C43 84 22 86 17 76Z"/><path class="ball-hi" d="M20 66 C22 61 26 59 30 59"/>'
    + '<circle class="ball" cx="30" cy="48" r="12"/><path class="ball-sh" d="M20 52 C23 59 37 61 41 52 C39 58 24 59 20 52Z"/><path class="ball-hi" d="M22 44 C24 40 27 39 30 39"/>'
    + '<circle class="coal" cx="30" cy="44" r="1.3"/><circle class="coal" cx="30" cy="49" r="1.3"/><circle class="coal" cx="30" cy="54" r="1.3"/>'
    + '<circle class="ball" cx="30" cy="27" r="9.5"/><path class="ball-hi" d="M23.5 24 C25 21 27 19.6 30 19.5"/>'
    + '<circle class="coal" cx="26.6" cy="25" r="1.3"/><circle class="coal" cx="33.4" cy="25" r="1.3"/><path class="carrot" d="M30 27.6 L39.5 29.6 L30 30.2Z"/><path class="carrot-l" d="M33 28.4 L33.3 29.8 M35.6 29 L35.8 29.9"/>'
    + '<path class="smile" d="M25.6 31.6 C27.6 33.6 32.4 33.6 34.4 31.6"/>'
    + '<path class="scarf" d="M20 35.5 C24 38.5 36 38.5 40 35.5 L40.5 39 C36 42 24 42 19.5 39Z"/><g class="sm-tail"><path class="scarf" d="M35 38.5 L38.5 50 L34 50.5 L32 39.5Z"/><path class="fringe" d="M34.4 50.6 V53 M35.8 50.4 V53 M37.2 50.2 V52.8"/></g><path class="scarf-st" d="M22 37.6 H38 M33.6 42 L36.6 41.6 M34.4 45 L37.4 44.6"/>'
    + '<path class="hat-brim" d="M18.5 19 C22 20.6 38 20.6 41.5 19 L41 21.5 C36 23 24 23 19 21.5Z"/><path class="hat" d="M22 19.5 L23.5 4.5 C27 3 33 3 36.5 4.5 L38 19.5 C33 21 27 21 22 19.5Z"/><path class="hat-band" d="M22.6 15 C27 16.4 33 16.4 37.4 15 L37.7 18 C33 19.4 27 19.4 22.3 18Z"/>'
    + '<path class="holly" d="M33 15.6 C35 13 38 13.4 39 15 C37 15.2 36 16 35 17.2Z M33 15.6 C33.6 12.6 31.6 10.6 30 11 C30.8 12.4 31 13.6 30.6 15Z"/><circle class="berry" cx="33" cy="16" r="1.1"/><circle class="berry" cx="34.6" cy="16.8" r="1"/>'
    + '</svg>';
}

/** Песочный замок: насыпь, три башни с зубцами, ворота, окна, флажок, ракушки в стенах, ведёрко и лопатка. */
export function замокSvg() {
  const зубцы = (x, y, w, n) => Array.from({ length: n }, (_, i) => '<rect class="merlon" x="' + (x + i * (w / n) + .6).toFixed(1) + '" y="' + (y - 3) + '" width="' + (w / n - 1.2).toFixed(1) + '" height="3.2" rx=".5"/>').join('');
  return '<svg class="hud-old-svg" viewBox="0 0 74 42" aria-hidden="true">'
    + '<ellipse class="sc-shadow" cx="36" cy="40.5" rx="34" ry="2.2"/>'
    + '<path class="mound" d="M2 41 C6 33 14 31 22 31 L52 31 C60 31 66 33 70 41Z"/><path class="moat" d="M6 40 C16 37 56 37 66 40"/>'
    + '<path class="wall" d="M14 31 L14 21 L58 21 L58 31Z"/>' + зубцы(14, 21, 44, 9)
    + '<path class="tower" d="M8 31 L9 13 L21 13 L22 31Z"/>' + зубцы(9, 13, 12, 3)
    + '<path class="tower" d="M50 31 L51 13 L63 13 L64 31Z"/>' + зубцы(51, 13, 12, 3)
    + '<path class="tower" d="M29 22 L30 6 L42 6 L43 22Z"/>' + зубцы(30, 6, 12, 3)
    + '<path class="gate" d="M32 31 L32 25 C32 22 40 22 40 25 L40 31Z"/><path class="win" d="M14 20 v-3 a1.2 1.2 0 0 1 2.4 0 v3Z M56 20 v-3 a1.2 1.2 0 0 1 2.4 0 v3Z M35 15 v-3 a1.2 1.2 0 0 1 2.4 0 v3Z"/>'
    + '<path class="flag-pole" d="M36 6 V-2"/><path class="flag" d="M36 -2 L42 -.5 L36 1Z"/>'
    + '<path class="shell" d="M22 27 c-1.6 0 -2.4 -2 0 -3 c2.4 1 1.6 3 0 3Z M47 26 c-1.6 0 -2.4 -2 0 -3 c2.4 1 1.6 3 0 3Z"/>'
    + '<path class="grain" d="M10 36 h.6 M18 34 h.6 M28 35 h.6 M44 35 h.6 M58 36 h.6 M62 34 h.6 M16 25 h.5 M27 27 h.5 M45 23 h.5 M54 27 h.5"/>'
    + '<g class="bucket"><path class="bk" d="M66 41 L67 33 L73 33 L74 41Z"/><path class="bk-rim" d="M66.6 33 H73.4"/><path class="bk-h" d="M67 33 C67 29 73 29 73 33"/></g>'
    + '<g class="spade"><path class="sp-h" d="M3 40 L9 30"/><path class="sp-b" d="M8 31.5 L12 26 L13.5 28.5 L10.5 33Z"/></g>'
    + '</svg>';
}

/** Костёр: кольцо камней, крест-накрест поленья, языки пламени в три слоя, искры и дым. */
export function кострSvg() {
  return '<svg class="hud-old-svg" viewBox="0 0 30 40" aria-hidden="true">'
    // Дым — мягкие клубы: поднимаются от огня, растут, светлеют и тают.
    + '<g class="smoke"><circle class="puff p1" cx="15" cy="14" r="2.4"/><circle class="puff p2" cx="15" cy="14" r="2.4"/><circle class="puff p3" cx="15" cy="14" r="2.4"/><circle class="puff p4" cx="15" cy="14" r="2.4"/></g>'
    + '<ellipse class="glow" cx="15" cy="34" rx="13" ry="4"/>'
    + '<path class="log" d="M4 36 L25 31 L26 33.6 L5 38.6Z"/><path class="log l2" d="M5 31 L26 36.4 L25 39 L4 33.6Z"/><circle class="log-end" cx="4.6" cy="37.3" r="1.4"/><circle class="log-end" cx="25.6" cy="37.7" r="1.4"/>'
    + '<g class="flames"><path class="fl-o" d="M15 33 C8 33 7 27 10 22 C10.5 25 12 26 12.5 25 C11.5 21 13 17 16 14 C15.5 18 18 20 19.5 18.5 C21.5 22 23 27 20 31 C19 32.6 17 33 15 33Z"/>'
    + '<path class="fl-m" d="M15 33 C11 33 10.5 29 12.5 26 C13 28 14 28.4 14.4 27.6 C14 25 15 22.4 17 20.6 C17 23 18.4 24.6 19.4 24 C20.4 27 20 31 15 33Z"/>'
    + '<path class="fl-i" d="M15 33 C13 33 12.6 31 13.6 29.4 C14.2 30.2 14.8 30 15 29.4 C15 28.2 15.6 27 16.6 26.2 C16.8 28 17.6 29 17.6 30.4 C17.6 32 16.6 33 15 33Z"/></g>'
    + '<circle class="spark k1" cx="11" cy="15" r=".7"/><circle class="spark k2" cx="19" cy="12" r=".6"/><circle class="spark k3" cx="14" cy="9" r=".5"/>'
    + '<path class="stone" d="M1 37 c0 -2 3 -3 4 -1 c1 2 -1 3 -2.4 3 c-1 0 -1.6 -.6 -1.6 -2Z M24.6 37.6 c.2 -2 3.4 -2.6 4.2 -.6 c.6 1.8 -1.4 2.8 -2.6 2.6 c-1 -.2 -1.6 -.8 -1.6 -2Z M9 39.2 c.4 -1.4 3 -1.6 3.6 -.2 c.3 1 -1 1.4 -2 1.4 c-1 0 -1.8 -.2 -1.6 -1.2Z M17.6 39.2 c.4 -1.4 3 -1.6 3.6 -.2 c.3 1 -1 1.4 -2 1.4 c-1 0 -1.8 -.2 -1.6 -1.2Z"/>'
    + '</svg>';
}

/** Цветы клумбы: ромашка, мак, василёк, лютик, колокольчик — у каждого свой рисунок. */
export function цветокSvg(i) {
  const стебель = '<path class="fl-stem" d="M9 44 C9 34 10 26 9 18"/><path class="fl-leaf" d="M9 36 C4 34 2 30 3 27 C6 29 8 31 9 34Z"/><path class="fl-leaf" d="M9 30 C14 28 16 24 15 21 C12 23 10 25 9 28Z"/>';
  const виды = [
    // ромашка
    '<g class="head daisy">' + Array.from({ length: 10 }, (_, k) => '<ellipse class="pt" cx="9" cy="11.2" rx="1.5" ry="4" transform="rotate(' + (k * 36) + ' 9 15)"/>').join('') + '<circle class="ctr" cx="9" cy="15" r="2.6"/><circle class="ctr-dot" cx="8.2" cy="14.2" r=".7"/></g>',
    // мак
    '<g class="head poppy"><path class="pt" d="M9 15 C3 15 2 9 6 8 C7 7 9 8 9 9 C9 8 11 7 12 8 C16 9 15 15 9 15Z"/><path class="pt2" d="M9 15 C5 16 4 19 6 20.5 C8 21.5 9 19 9 17.5 C9 19 10 21.5 12 20.5 C14 19 13 16 9 15Z"/><circle class="ctr" cx="9" cy="13.4" r="1.8"/><path class="stamen" d="M7 12 l-1 -1 M11 12 l1 -1 M9 11.4 v-1.4"/></g>',
    // василёк
    '<g class="head cornflower">' + Array.from({ length: 8 }, (_, k) => '<path class="pt" transform="rotate(' + (k * 45) + ' 9 15)" d="M9 15 L7.6 9 L8.4 9.8 L9 8.4 L9.6 9.8 L10.4 9 Z"/>').join('') + '<circle class="ctr" cx="9" cy="15" r="1.8"/></g>',
    // лютик
    '<g class="head buttercup">' + Array.from({ length: 5 }, (_, k) => '<circle class="pt" cx="9" cy="11.6" r="3.2" transform="rotate(' + (k * 72) + ' 9 15)"/>').join('') + '<circle class="ctr" cx="9" cy="15" r="2"/><path class="gloss" d="M6.8 11 C7.6 10 8.6 9.8 9.4 10.2"/></g>',
    // колокольчики на изогнутом стебле
    '<g class="head bluebell"><path class="arch" d="M9 18 C9 12 13 9 16 10"/><path class="bell" d="M14.6 10.4 C13 11 12.6 13.4 13 15 L16.6 14.2 C16.8 12.6 16.4 10.6 14.6 10.4Z"/><path class="bell" d="M11 13 C9.4 13.6 9 16 9.4 17.6 L13 16.8 C13.2 15.2 12.8 13.2 11 13Z"/><path class="bell" d="M15.4 6.6 C14 7.4 13.8 9.4 14.2 10.6 L17.2 9.8 C17.2 8.4 16.8 6.8 15.4 6.6Z"/></g>',
  ];
  return '<svg class="hud-old-svg" viewBox="0 0 18 44" aria-hidden="true">' + стебель + виды[(i - 1) % виды.length] + '</svg>';
}
