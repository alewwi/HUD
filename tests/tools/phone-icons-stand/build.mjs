// Стенд иконок телефона: у каждой темы свой набор из двенадцати предметов.
// Собственные рисунки в SVG. Vamp — рисунки ИКОНКИ ниже (кровь, брызги, потёки);
// остальные темы — наборы в sets-*.mjs: свои предметы по смыслу темы, своя форма
// плитки и своя подача (витраж, аквариум, венок, пиксели, белая линия…).
//   node tests/tools/phone-icons-stand/build.mjs  →  index.html рядом
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ФОРМЫ, ПОЛЕ } from './dsl.mjs';
import { НАБОРЫ_А } from './sets-a.mjs';
import { НАБОРЫ_Б } from './sets-b.mjs';
import { НАБОРЫ_В } from './sets-c.mjs';
import { НАБОРЫ_Г } from './sets-d.mjs';
import { ПРАВКИ } from './sets-fix.mjs';
import { ЛИЦА, ЛИЦО_VAMP } from './sets-faces.mjs';
import { ЕЩЁ } from './sets-more.mjs';
import { ПОЛИРОВКА } from './sets-polish.mjs';

const НАБОРЫ = { ...НАБОРЫ_А, ...НАБОРЫ_Б, ...НАБОРЫ_В, ...НАБОРЫ_Г };
for (const [тема, иконки] of Object.entries(ПРАВКИ)) Object.assign(НАБОРЫ[тема].иконки, иконки);
for (const [тема, лицо] of Object.entries(ЛИЦА)) if (лицо) НАБОРЫ[тема].иконки.contacts = лицо;
for (const [тема, иконки] of Object.entries(ЕЩЁ)) Object.assign(НАБОРЫ[тема].иконки, иконки);
for (const [тема, иконки] of Object.entries(ПОЛИРОВКА)) Object.assign(НАБОРЫ[тема].иконки, иконки);
const ЗДЕСЬ = path.dirname(fileURLToPath(import.meta.url));
// Рамки рисунков из браузера (measure.mjs). HUD_RAW — сборка для самого обмера.
const БЕЗ_ОБМЕРА = !!process.env.HUD_RAW;
const файлРамок = path.join(ЗДЕСЬ, 'bbox.json');
const РАМКИ = !БЕЗ_ОБМЕРА && fs.existsSync(файлРамок) ? JSON.parse(fs.readFileSync(файлРамок, 'utf8')) : {};
// Предмет по центру поля, в единый размер. Вытянутый (кисть, труба) можно
// крупнее по длинной стороне: иначе он выглядит мельче квадратного соседа.
function посадка(ключ, набор) {
  const р = РАМКИ[ключ];
  if (!р) return '';
  const [cx, cy, размер] = набор.поле || ПОЛЕ[набор.форма] || ПОЛЕ.round;
  const w = р[2] - р[0], h = р[3] - р[1], длинная = Math.max(w, h), короткая = Math.min(w, h);
  const цель = размер * (1 + .12 * (1 - короткая / длинная));
  const k = цель / длинная;
  const tx = cx - (р[0] + р[2]) / 2 * k, ty = cy - (р[1] + р[3]) / 2 * k;
  return ` transform="translate(${ф(tx)} ${ф(ty)}) scale(${Math.round(k * 1000) / 1000})"`;
}
const ф = (n) => Math.round(n * 10) / 10;

// --- Общие детали ----------------------------------------------------------

// Потёк: капля тянется вниз от края (x, y), длина L, ширина w.
function потёк(x, y, L, w = 3) {
  const h = w * 1.08;
  return `M${ф(x - w)} ${ф(y)}C${ф(x - w)} ${ф(y + L * .55)} ${ф(x - h)} ${ф(y + L)} ${ф(x)} ${ф(y + L + h)}C${ф(x + h)} ${ф(y + L)} ${ф(x + w)} ${ф(y + L * .55)} ${ф(x + w)} ${ф(y)}Z`;
}
const потёки = (список, класс = 'b-fill') => `<g class="drips"><path class="${класс}" d="${список.map(([x, y, L, w]) => потёк(x, y, L, w)).join('')}"/>`
  // Блик на каждой капле — живая, мокрая кровь.
  + `<g class="drip-hi">${список.map(([x, y, L, w = 3]) => `<ellipse cx="${ф(x - w * .32)}" cy="${ф(y + L + w * .35)}" rx="${ф(w * .28)}" ry="${ф(w * .45)}"/>`).join('')}</g></g>`;

// Брызги за предметом: клякса с лучами и отлетевшие капли. Повороты разные —
// у каждой иконки своя.
function брызги(cx, cy, r, поворот = 0, семя = 1) {
  let s = семя * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const лучей = 15;
  let d = '';
  for (let i = 0; i <= лучей; i++) {
    const a = (i / лучей) * Math.PI * 2;
    const rr = r * (i % 2 ? .62 + rnd() * .18 : .9 + rnd() * .38);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) d += `M${ф(x)} ${ф(y)}`;
    else {
      const ap = ((i - .5) / лучей) * Math.PI * 2, rp = r * (.55 + rnd() * .25);
      d += `Q${ф(cx + Math.cos(ap) * rp)} ${ф(cy + Math.sin(ap) * rp)} ${ф(x)} ${ф(y)}`;
    }
  }
  d += 'Z';
  const капли = Array.from({ length: 9 }, (_, i) => {
    const a = rnd() * Math.PI * 2, rr = r * (1.25 + rnd() * .55), rk = 1 + rnd() * 2.6;
    return `<circle cx="${ф(cx + Math.cos(a) * rr)}" cy="${ф(cy + Math.sin(a) * rr)}" r="${ф(rk)}"/>`;
  }).join('');
  return `<g class="splat" transform="rotate(${поворот} ${cx} ${cy})"><path d="${d}"/>${капли}</g>`;
}

// Летучая мышь: размах w, центр (x, y).
const мышь = (x, y, w, класс = 'bat') => {
  const k = w / 30;
  return `<path class="${класс}" transform="translate(${x} ${y}) scale(${ф(k)})" d="M0 0C-3-4-8-6-15-5c3 2 4 4 3 7-3-2-6-2-8-1 2 1 3 3 3 5 3-2 7-3 11-2 2 1 4 3 6 5 2-2 4-4 6-5 4-1 8 0 11 2 0-2 1-4 3-5-2-1-5-1-8 1-1-3 0-5 3-7C8-6 3-4 0 0Zm-2-2 2-3 2 3Z"/>`;
};

// --- Рисунки ---------------------------------------------------------------
// Поле 120×120; плитка — снаружи. Каждая функция отдаёт содержимое плитки.

const ИКОНКИ = {
  calls: {
    рамка: [18, 25, 102, 106],
    имя: 'Звонки',
    тело: () => `
      <path class="b-fill" d="M33 27c9-6 19-4 23 4l6 12c3 6 1 11-4 14l-6 4c4 10 11 18 21 23l4-6c3-5 9-7 14-4l12 7c7 4 8 13 2 19-6 7-14 11-24 9C55 106 24 78 18 48c-2-8 3-15 15-21Z"/>
      <path class="b-shade" d="M47 62c6 13 16 23 29 29l-3 5C58 89 47 78 40 64Z"/>
      <path class="b-rim" d="M33 27c9-6 19-4 23 4l6 12c3 6 1 11-4 14l-6 4c4 10 11 18 21 23l4-6c3-5 9-7 14-4l12 7c7 4 8 13 2 19-6 7-14 11-24 9C55 106 24 78 18 48c-2-8 3-15 15-21Z"/>
      <path class="hi" d="M26 40c3-6 9-9 15-8M93 92c4 1 7 4 7 8"/>
      <g class="holes"><circle cx="34" cy="38" r="1.6"/><circle cx="39" cy="35" r="1.6"/><circle cx="37" cy="42" r="1.6"/><circle cx="90" cy="96" r="1.6"/><circle cx="95" cy="99" r="1.6"/></g>
      ${потёки([[52, 96, 9, 2.6], [64, 102, 12, 3], [78, 107, 7, 2.4]])}`,
  },
  weather: {
    рамка: [22, 16, 102, 96],
    имя: 'Погода',
    тело: () => `
      <circle class="moon-glow" cx="64" cy="50" r="34"/>
      <circle class="moon" cx="64" cy="50" r="25"/>
      <g class="crater"><circle cx="56" cy="42" r="5"/><circle cx="72" cy="56" r="7"/><circle cx="70" cy="38" r="3"/><circle cx="55" cy="60" r="3.4"/></g>
      <path class="moon-hi" d="M46 38a22 22 0 0 1 16-11"/>
      ${мышь(36, 30, 20)}${мышь(92, 24, 14)}${мышь(84, 40, 10)}
      <path class="cloud" d="M22 84c0-8 7-13 14-11 3-8 12-12 20-8 4-6 13-7 19-2 7-2 15 3 15 11 7 1 11 6 10 12H24c-3-1-3-1-2-2Z"/>
      <path class="cloud-hi" d="M37 73c3-5 9-7 14-5M76 70c4 0 8 2 10 5"/>
      <g class="rain">${[[34, 98], [48, 102], [62, 98], [76, 103], [90, 98]].map(([x, y]) => `<path d="${потёк(x, y, 5, 1.8)}"/>`).join('')}</g>`,
  },
  health: {
    рамка: [30, 18, 96, 102],
    имя: 'Здоровье',
    тело: () => `
      <path class="b-dark" d="M49 40V24c0-4 7-4 7 0v14M62 36V20c0-4 8-4 8 0v18M74 40l7-9c3-3 8 1 5 4l-8 10"/>
      <path class="tube-hi" d="M51 26v12M64 22v13"/>
      <path class="b-fill" d="M60 102C40 92 28 76 30 59c2-15 14-23 26-19 4 1 6 3 8 5 4-6 11-9 19-7 13 4 17 19 10 33-6 13-18 24-33 31Z"/>
      <path class="b-shade" d="M60 102C48 96 40 88 35 78c8 8 18 13 30 13 10 0 19-4 26-12-6 10-17 18-31 23Z"/>
      <path class="vein" d="M58 46c-6 10-4 22 4 30M72 50c3 8 1 16-6 22M46 58c-4 6-3 14 2 20M80 64c3 6 2 12-2 17"/>
      <path class="b-rim" d="M60 102C40 92 28 76 30 59c2-15 14-23 26-19 4 1 6 3 8 5 4-6 11-9 19-7 13 4 17 19 10 33-6 13-18 24-33 31Z"/>
      <path class="hi" d="M37 58c1-7 6-12 12-13"/><ellipse class="hi-dot" cx="41" cy="66" rx="2" ry="3.4"/>
      ${потёки([[56, 101, 8, 2.6], [64, 100, 13, 3]])}`,
  },
  messages: {
    рамка: [20, 22, 100, 94],
    имя: 'Сообщения',
    тело: () => `
      <path class="b-fill" d="M60 22c23 0 40 14 40 32S83 86 60 86c-5 0-10-1-14-2L28 94l5-15c-8-6-13-15-13-25 0-18 17-32 40-32Z"/>
      <path class="b-shade" d="M30 70c8 10 20 16 32 16 14 0 27-6 34-16-5 13-19 22-36 22-6 0-11-1-15-3l-12 5 3-9c-3-4-5-9-6-15Z"/>
      <path class="b-rim" d="M60 22c23 0 40 14 40 32S83 86 60 86c-5 0-10-1-14-2L28 94l5-15c-8-6-13-15-13-25 0-18 17-32 40-32Z"/>
      <g class="dots"><circle cx="44" cy="54" r="5"/><circle cx="60" cy="54" r="5"/><circle cx="76" cy="54" r="5"/></g>
      <g class="bite"><ellipse cx="74" cy="31" rx="2.6" ry="3.4"/><ellipse cx="86" cy="36" rx="2.6" ry="3.4"/></g>
      <path class="hi" d="M30 44c4-9 14-15 26-16"/>
      ${потёки([[52, 86, 9, 2.6], [66, 86, 14, 3.2], [80, 82, 8, 2.4], [74, 37, 5, 1.4], [86, 42, 4, 1.3]])}`,
  },
  contacts: {
    рамка: [18, 15, 102, 105],
    имя: 'Контакты',
    тело: () => `${ЛИЦО_VAMP}
      ${потёки([[52, 90, 10, 2.6], [70, 89, 7, 2.2]])}`,
  },
  wallet: {
    рамка: [19, 22, 96, 100],
    имя: 'Кошелёк',
    тело: () => `
      <rect class="card" x="40" y="26" width="46" height="30" rx="5" transform="rotate(-12 63 41)"/>
      <rect class="chip" x="47" y="35" width="10" height="8" rx="1.6" transform="rotate(-12 63 41)"/>
      <path class="card-line" d="M47 49l30-6" />
      <rect class="leather" x="24" y="44" width="72" height="50" rx="9"/>
      <path class="stitch" d="M29 49h62v40H29z"/>
      <path class="flap" d="M64 56h32v20H64a10 10 0 0 1 0-20Z"/>
      <circle class="clasp" cx="68" cy="66" r="4.4"/>
      <path class="leather-hi" d="M28 48c10-3 24-3 34 0"/>
      <g class="coins"><ellipse class="coin" cx="30" cy="96" rx="11" ry="4"/><ellipse class="coin" cx="30" cy="91" rx="11" ry="4"/><ellipse class="coin top" cx="30" cy="86" rx="11" ry="4"/></g>
      ${потёки([[86, 94, 10, 2.8], [74, 94, 6, 2.2], [96, 76, 8, 2]], 'b-fill')}`,
  },
  calendar: {
    рамка: [24, 20, 96, 98],
    имя: 'Календарь',
    тело: () => `
      <rect class="page" x="24" y="28" width="72" height="70" rx="10"/>
      <path class="b-fill" d="M24 38c0-6 4-10 10-10h52c6 0 10 4 10 10v10H24Z"/>
      ${потёки([[34, 48, 6, 2.4], [48, 48, 12, 3], [70, 48, 8, 2.6], [86, 48, 14, 3]])}
      <g class="rings"><rect x="38" y="20" width="6" height="16" rx="3"/><rect x="76" y="20" width="6" height="16" rx="3"/></g>
      <text class="day" x="60" y="88" text-anchor="middle">13</text>
      <path class="page-hi" d="M28 56v30"/>
      <path class="claw" d="M80 62l10 22M84 60l9 20M88 59l7 16"/>`,
  },
  gallery: {
    рамка: [18, 22, 102, 94],
    имя: 'Галерея',
    тело: () => `
      <rect class="frame" x="22" y="26" width="76" height="64" rx="6"/>
      <rect class="frame-in" x="29" y="33" width="62" height="50" rx="2"/>
      <clipPath id="g-pic"><rect x="29" y="33" width="62" height="50" rx="2"/></clipPath>
      <g clip-path="url(#g-pic)">
        <rect class="sky" x="29" y="33" width="62" height="50"/>
        <circle class="moon" cx="74" cy="48" r="8"/>
        <path class="hill" d="M29 72l14-14 10 9 12-15 26 22v9H29Z"/>
        <path class="castle" d="M40 72V60h3v-3h3v3h3v-6l3-4 3 4v18Z"/>
        ${мышь(52, 44, 9, 'bat')}
      </g>
      <g class="frame-orn"><circle cx="22" cy="26" r="4"/><circle cx="98" cy="26" r="4"/><circle cx="22" cy="90" r="4"/><circle cx="98" cy="90" r="4"/></g>
      ${потёки([[40, 90, 9, 2.6], [62, 90, 13, 3], [84, 90, 7, 2.4]])}`,
  },
  notes: {
    рамка: [30, 16, 98, 100],
    имя: 'Заметки',
    тело: () => `
      <path class="ink-glass" d="M30 82c0-6 4-10 10-10h4v-6h22v6h4c6 0 10 4 10 10v12c0 4-3 6-7 6H37c-4 0-7-2-7-6Z"/>
      <path class="b-fill" d="M33 86h44v8c0 2-1 3-3 3H36c-2 0-3-1-3-3Z"/>
      <path class="glass-hi" d="M35 80c1-3 3-4 6-4"/>
      <path class="quill" d="M58 74C62 54 74 30 98 16c-6 14-12 26-22 38-4 5-10 11-18 20Z"/>
      <path class="vane" d="M62 66c6-6 12-10 18-12M66 58c6-6 12-9 18-10M70 50c5-5 11-8 16-9M74 42c4-4 9-7 14-8M60 70c4-2 8-3 12-3"/>
      <path class="shaft" d="M58 76C66 58 78 38 96 18"/>
      <path class="nib" d="M58 74l-3 9 6-6Z"/>
      ${потёки([[56, 84, 9, 1.8], [46, 97, 7, 2.4], [64, 97, 10, 2.6]])}`,
  },
  maps: {
    рамка: [20, 24, 100, 96],
    имя: 'Карты',
    тело: () => `
      <path class="parch a" d="M20 34l26-8v62l-26 8Z"/><path class="parch b" d="M46 26l28 8v62l-28-8Z"/><path class="parch a" d="M74 34l26-8v62l-26 8Z"/>
      <path class="route" d="M28 84c8-6 10-16 20-18s14 6 22 0 10-18 20-20"/>
      <path class="cross" d="M84 38l10 10M94 38L84 48"/>
      <path class="dagger-blade" d="M62 58l-6 26-2-26 4-14Z"/>
      <path class="dagger-guard" d="M48 44h20"/><path class="dagger-grip" d="M58 44V30"/><circle class="dagger-pom" cx="58" cy="28" r="3"/>
      <circle class="wound" cx="56" cy="84" r="3.6"/>
      ${потёки([[56, 86, 10, 2.4], [44, 88, 6, 2]])}`,
  },
  search: {
    рамка: [22, 24, 97, 106],
    имя: 'Поиск',
    тело: () => `
      <path class="handle" d="M72 74l22 22c3 3 3 7 0 10s-7 3-10 0L62 84Z"/>
      <path class="handle-hi" d="M78 82l14 14"/>
      <circle class="ring" cx="50" cy="52" r="28"/>
      <circle class="lens" cx="50" cy="52" r="21"/>
      <path class="eye-white" d="M30 52c6-9 13-13 20-13s14 4 20 13c-6 9-13 13-20 13s-14-4-20-13Z"/>
      <path class="eye-vein" d="M33 52c4-2 6-1 8 1M66 50c-3 0-5 1-6 3M38 46c2 1 3 3 3 5M62 59c-2-1-3-2-3-4"/>
      <circle class="iris" cx="50" cy="52" r="9"/><circle class="pupil" cx="50" cy="52" r="3.8"/><circle class="glint" cx="53" cy="49" r="1.8"/>
      <path class="lens-hi" d="M34 40a20 20 0 0 1 12-8"/>
      ${потёки([[42, 79, 8, 2.4], [56, 80, 12, 2.8]])}`,
  },
  music: {
    рамка: [19, 22, 104, 99],
    имя: 'Музыка',
    тело: () => `
      <circle class="vinyl-rim" cx="56" cy="62" r="37"/>
      <circle class="vinyl" cx="56" cy="62" r="35"/>
      <g class="groove">${[32, 29, 26, 23, 20].map(r => `<circle cx="56" cy="62" r="${r}"/>`).join('')}</g>
      <path class="vinyl-shine" d="M56 62L30 36a37 37 0 0 1 16-9ZM56 62l26 26a37 37 0 0 1-16 9Z"/>
      <path class="vinyl-hi" d="M27 50a32 32 0 0 1 19-19M85 74a32 32 0 0 1-13 15"/>
      <circle class="b-fill" cx="56" cy="62" r="14"/><circle class="label-ring" cx="56" cy="62" r="10"/><circle class="label-hole" cx="56" cy="62" r="2.4"/>
      <path class="label-hi" d="M48 56a10 10 0 0 1 6-5"/>
      <path class="arm" d="M98 22v30l-14 14"/><circle class="arm-base" cx="98" cy="22" r="6"/><rect class="arm-head" x="78" y="62" width="10" height="7" rx="2" transform="rotate(45 83 65)"/>
      <path class="note" d="M24 30v20a5 5 0 1 1-3-4.6V26l14-4v18a5 5 0 1 1-3-4.6V27Z"/>
      ${потёки([[50, 75, 12, 2.6], [60, 76, 20, 2.4], [66, 72, 8, 2]])}`,
  },
};

// --- Стенд: все темы ------------------------------------------------------
// Рисунки (ИКОНКИ выше) общие; у каждой темы — палитра, у семейства тем —
// плитка, украшение за предметом и правила материала (кровь, неон, латунь…).

// Цвет: смешать два hex, t — доля второго.
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const смесь = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const светлее = (a, t) => смесь(a, '#ffffff', t);
const темнее = (a, t) => смесь(a, '#000000', t);

// Темы: акцент и фон телефона — из themes.js; семейство — по духу темы.
const ТЕМЫ = [
  ['vamp', 'Vamp', 'blood', '#c31f38', '#17070c', '#0a0407'],
  ['voodoo', 'Вуду', 'blood', '#c2543a', '#152018', '#0a110c'],
  ['spacehorror', 'Космохоррор', 'blood', '#e03a3a', '#0d1113', '#040708'],
  ['cyberpunk', 'Киберпанк', 'neon', '#b06bff', '#0b0a1c', '#05040f', { neon2: '#3ff0ff' }],
  ['spaceopera', 'Космоопера', 'neon', '#7db8ff', '#0e1030', '#06071a', { neon2: '#ffd27d' }],
  ['biopunk', 'Биопанк', 'neon', '#8fe36a', '#13210e', '#0a1207', { neon2: '#e6ff6a' }],
  ['steampunk', 'Стимпанк', 'brass', '#d69b4a', '#241b12', '#140e08'],
  ['dieselpunk', 'Дизельпанк', 'brass', '#e0b83a', '#1c1f22', '#0e1012', { steel: true }],
  ['western', 'Вестерн', 'brass', '#b06a2c', '#f0e2cc', '#dfc9a6', { light: true }],
  ['pirate', 'Пираты', 'brass', '#8a5a2a', '#eee0c6', '#dcc59e', { light: true }],
  ['academia', 'Dark Academia', 'parchment', '#c9a227', '#16110c', '#0b0907'],
  ['medieval', 'Средневековье', 'parchment', '#8a6a1f', '#efe3c6', '#dcc79c', { light: true }],
  ['egypt', 'Древний Египет', 'parchment', '#c9a227', '#f4e9cc', '#e4d3a8', { light: true, second: '#2f5bb7' }],
  ['bujo', 'Буллет-джорнал', 'parchment', '#94b4c1', '#22364b', '#142233'],
  ['witch', 'Ведьмовство', 'mystic', '#c8a86a', '#1d1726', '#0f0b15', { main: '#8e5bd6' }],
  ['fantasy', 'Фэнтези', 'mystic', '#7fe0c0', '#0b1a18', '#060e12', { main: '#2fae8c', warm: '#f0c96a' }],
  ['kawaii', 'Каваи', 'pastel', '#e0568f', '#ffe6f2', '#ffcfe5'],
  ['teaparty', 'Чаепитие', 'pastel', '#c4505f', '#fff8ee', '#fbd9e3'],
  ['cottage', 'Коттеджкор', 'pastel', '#6f8452', '#f5efe0', '#e4d8bd'],
  ['solarpunk', 'Солярпанк', 'pastel', '#2e9e6b', '#eafaef', '#d6f0de'],
  ['ice', 'Лёд', 'frost', '#7fd4e8', '#0f1c24', '#07111a'],
  ['ocean', 'Глубина', 'frost', '#4fd8c8', '#06202f', '#03121c', { water: true }],
  ['noir', 'Нуар', 'mono', '#d8d8d8', '#151515', '#080808'],
  ['mafia', 'Криминал', 'mono', '#d92b2b', '#101010', '#040404'],
  ['darkroom', 'Фотолаборатория', 'mono', '#d4473d', '#1c1519', '#0c070b', { safelight: true }],
  ['japan', 'Феодальная Япония', 'ink', '#b3403f', '#f7f0e2', '#e9dcc6'],
  ['web1', 'Web 1.0', 'retro', '#000080', '#c0c0c0', '#d4d0c8'],
];

const СЕМЕЙСТВА = {
  blood: 'Кровь — брызги и потёки',
  neon: 'Неон — светящийся контур',
  brass: 'Латунь — металл, заклёпки, шестерня',
  parchment: 'Пергамент — чернила, золото, лавр',
  mystic: 'Звёзды — золотой кант и искры',
  pastel: 'Пастель — наклейки с белой обводкой',
  frost: 'Иней и вода — стекло, сосульки, пузыри',
  mono: 'Монохром — свет прожектора',
  ink: 'Тушь — кисть и красная печать',
  retro: 'Windows 95 — фаска и пиксельная обводка',
};

// Палитра темы: градиенты (id с приставкой темы) и плоские цвета (CSS-переменные).
function палитра([id, , сем, A, bg1, bg2, доп = {}]) {
  const light = !!доп.light || ['pastel', 'ink', 'retro'].includes(сем);
  const main = доп.main || A;
  const p = {
    main: [светлее(main, .38), main, темнее(main, .58)],
    dark: [темнее(main, .3), темнее(main, .78)],
    second: ['#f6ead8', '#cdb79c', '#8c7660'],
    leather: [смесь(main, '#1a0c10', .78), '#0e0608'],
    tile: [светлее(bg1, .06), bg1, bg2],
    glowC: main, glowA: .5,
    ink: '#0d0306', paper: '#f4e9ea', gold: '#d8b25a', rim: светлее(main, .4),
    sky: [темнее(main, .25), темнее(main, .82)],
    wall: [bg1, bg2], label: light ? '#3a2a24' : '#f3e2e5',
    shade: темнее(main, .7),
  };
  if (сем === 'neon') Object.assign(p, { second: [светлее(доп.neon2, .3), доп.neon2, темнее(доп.neon2, .5)], gold: доп.neon2, glowA: .7 });
  if (сем === 'brass') Object.assign(p, {
    main: [светлее(A, .45), A, темнее(A, .55)],
    second: доп.steel ? ['#e8edf0', '#9aa6ad', '#4c5459'] : ['#f6ead0', '#d6b679', '#7a5a2a'],
    leather: доп.light ? [темнее(A, .35), темнее(A, .65)] : [смесь(A, '#2a1a10', .7), '#120a05'],
    tile: доп.light ? ['#f6ead6', bg1, bg2] : [светлее(bg1, .1), bg1, bg2],
    ink: доп.light ? '#2a1a10' : '#120a05', glowA: доп.light ? .25 : .4, gold: '#e8c372',
  });
  if (сем === 'parchment') Object.assign(p, light
    ? { main: [светлее(A, .2), A, темнее(A, .55)], tile: ['#fbf3df', bg1, bg2], ink: '#2b1d0e', glowA: .2, second: доп.second ? [светлее(доп.second, .35), доп.second, темнее(доп.second, .5)] : ['#fffaf0', '#efe2c4', '#b8a37c'] }
    : { second: ['#fbf3e3', '#e6d6b8', '#a8916c'], ink: '#0e0a06', glowA: .35 });
  if (сем === 'mystic') { const W = доп.warm || A; Object.assign(p, { gold: W, rim: W, glowC: main, glowA: .6, second: [светлее(W, .45), W, темнее(W, .5)] }); }
  if (сем === 'pastel') Object.assign(p, {
    main: [светлее(A, .5), светлее(A, .15), темнее(A, .2)],
    dark: [A, темнее(A, .35)], second: [светлее(A, .82), светлее(A, .62), светлее(A, .25)],
    leather: [светлее(A, .35), A], tile: ['#ffffff', bg1, bg2], ink: темнее(A, .55),
    glowC: '#ffffff', glowA: .7, shade: темнее(A, .25), sky: [светлее(A, .25), A], paper: '#fff',
  });
  if (сем === 'frost') Object.assign(p, {
    main: [светлее(A, .65), A, темнее(A, .55)], second: ['#ffffff', '#d8f2fa', '#8cb8c8'],
    leather: [смесь(A, '#0a2030', .6), '#06121c'], ink: '#03101a', gold: '#e6fbff', glowA: .55,
  });
  if (сем === 'mono') {
    const m = доп.safelight ? A : '#d0d0d0';
    Object.assign(p, {
      main: доп.safelight ? [светлее(A, .3), A, темнее(A, .6)] : ['#f4f4f4', '#9a9a9a', '#2e2e2e'],
      second: доп.safelight ? [светлее(A, .55), светлее(A, .2), темнее(A, .35)] : ['#ffffff', '#cfcfcf', '#7a7a7a'],
      leather: ['#2a2a2a', '#0a0a0a'], ink: '#050505', gold: A === '#d8d8d8' ? '#ffffff' : A,
      glowC: доп.safelight ? A : '#ffffff', glowA: .28, rim: светлее(m, .3), shade: '#111', sky: [доп.safelight ? темнее(A, .4) : '#444', '#0a0a0a'],
    });
    if (A === '#d92b2b') p.accentBits = A;
  }
  if (сем === 'ink') Object.assign(p, {
    main: ['#4a4a4a', '#1c1c1c', '#050505'], dark: ['#2a2a2a', '#000'], second: ['#fffaf0', '#f3e8d2', '#c9b896'],
    leather: ['#2a2a2a', '#0a0a0a'], tile: ['#fffaf0', bg1, bg2], ink: '#0a0a0a', gold: A, glowC: A, glowA: .12,
    rim: '#000', shade: '#000', sky: [светлее(A, .2), темнее(A, .3)],
  });
  if (сем === 'retro') Object.assign(p, {
    main: ['#0000a8', '#0000a8', '#0000a8'], dark: ['#000080', '#000080'], second: ['#ffffff', '#ffffff', '#ffffff'],
    leather: ['#808080', '#808080'], tile: ['#c0c0c0', '#c0c0c0', '#c0c0c0'], ink: '#000000', gold: '#ffff00',
    glowA: 0, rim: '#000', shade: '#000040', sky: ['#008080', '#008080'], label: '#000',
  });
  return { ...p, light, сем, id };
}

function defs(p) {
  const g = (имя, стопы, x2 = 0, y2 = 1) => `<linearGradient id="${p.id}-${имя}" x1="0" y1="0" x2="${x2}" y2="${y2}">${стопы.map((c, i) => `<stop offset="${ф(i / Math.max(1, стопы.length - 1))}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const r = (имя, стопы, cx = .4, cy = .35, rr = .75) => `<radialGradient id="${p.id}-${имя}" cx="${cx}" cy="${cy}" r="${rr}">${стопы.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
  return g('main', p.main, .3) + g('dark', p.dark) + g('second', p.second) + g('leather', p.leather) + g('tile', p.tile) + g('sky', p.sky)
    + r('glow', [[0, p.glowC, p.glowA], [.6, p.glowC, p.glowA * .3], [1, p.glowC, 0]], .5, .42, .62)
    + r('moon', [[0, p.main[0]], [.45, p.main[1]], [1, p.main[2]]])
    + r('moonglow', [[.55, p.main[1], .45], [1, p.main[1], 0]], .5, .5, .5)
    + r('lens', [[0, смесь(p.tile[1], '#ffffff', .12)], [1, p.tile[2]]])
    + r('iris', [[0, p.main[0]], [.6, p.main[1]], [1, p.main[2]]], .45, .4, .6)
    + g('glass', [смесь(p.leather[0], '#ffffff', .15), p.leather[1]], 1, 1)
    + (НАБОРЫ[p.id] ? `<clipPath id="${p.id}-form"><path d="${ФОРМЫ[НАБОРЫ[p.id].форма] || ФОРМЫ.round}"/></clipPath>` : '');
}

// Переменные темы: ссылки на её градиенты и плоские цвета.
const varsТемы = (p) => [
  ['--g-main', `url(#${p.id}-main)`], ['--g-dark', `url(#${p.id}-dark)`], ['--g-second', `url(#${p.id}-second)`],
  ['--g-leather', `url(#${p.id}-leather)`], ['--g-tile', `url(#${p.id}-tile)`], ['--g-sky', `url(#${p.id}-sky)`],
  ['--g-glow', `url(#${p.id}-glow)`], ['--g-moon', `url(#${p.id}-moon)`], ['--g-moonglow', `url(#${p.id}-moonglow)`],
  ['--g-lens', `url(#${p.id}-lens)`], ['--g-iris', `url(#${p.id}-iris)`], ['--g-glass', `url(#${p.id}-glass)`],
  ['--c-main', p.main[1]], ['--c-main-l', p.main[0]], ['--c-main-d', p.main[2]], ['--c-second', p.second[1]], ['--c-second-d', p.second[2]],
  ['--ink', p.ink], ['--paper', p.paper], ['--gold', p.gold], ['--rim', p.rim], ['--shade', p.shade], ['--label', p.label],
  ['--edge', p.light ? смесь(p.ink, '#ffffff', .25) : 'rgba(255,255,255,.22)'], ['--wall1', p.wall[0]], ['--wall2', p.wall[1]], ['--tile-hi', p.light ? '#ffffff' : светлее(p.tile[1], .3)],
].map(([k, v]) => `${k}:${v}`).join(';');

// Украшение за предметом — по семейству. Центр (60, 58).
function фон(сем, i, p) {
  const C = [60, 58];
  if (сем === 'blood') return брызги(60, 58, 38, i * 37, i + 3);
  if (сем === 'neon') return `<g class="bk-neon"><circle cx="60" cy="58" r="38"/><circle cx="60" cy="58" r="30" stroke-dasharray="4 5"/><path d="M60 14v8M60 94v8M16 58h8M96 58h8"/></g>`;
  if (сем === 'brass') {
    const зуб = 12; let d = '';
    for (let k = 0; k < зуб * 2; k++) { const a = k / (зуб * 2) * Math.PI * 2, r = k % 2 ? 31 : 38, a2 = (k + 1) / (зуб * 2) * Math.PI * 2; d += `${k ? 'L' : 'M'}${ф(60 + Math.cos(a) * r)} ${ф(58 + Math.sin(a) * r)}L${ф(60 + Math.cos(a2 - .05) * r)} ${ф(58 + Math.sin(a2 - .05) * r)}`; }
    return `<g class="bk-gear" transform="rotate(${i * 9} 60 58)"><path d="${d}Z M60 44a14 14 0 1 0 .01 0Z" fill-rule="evenodd"/></g>`;
  }
  if (сем === 'parchment') {
    const листья = (сторона) => Array.from({ length: 6 }, (_, k) => { const a = (sторонаУгол(сторона, k)); return `<ellipse cx="${ф(60 + Math.cos(a) * 36)}" cy="${ф(62 + Math.sin(a) * 36)}" rx="5.4" ry="2.2" transform="rotate(${ф(a * 180 / Math.PI + (сторона ? 60 : -60))} ${ф(60 + Math.cos(a) * 36)} ${ф(62 + Math.sin(a) * 36)})"/>`; }).join('');
    return `<g class="bk-laurel"><path d="M34 92a36 36 0 0 1-8-46M86 92a36 36 0 0 0 8-46"/>${листья(0)}${листья(1)}</g>`;
  }
  if (сем === 'mystic') {
    const искра = (x, y, r) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z"/>`;
    return `<g class="bk-mystic"><path class="bk-moon" d="M74 22a38 38 0 1 0 22 48 30 30 0 1 1-22-48Z"/>${искра(24, 26, 6)}${искра(98, 92, 5)}${искра(20, 88, 3.6)}${искра(100, 28, 3)}</g>`;
  }
  if (сем === 'pastel') return `<g class="bk-pastel"><circle cx="60" cy="58" r="36"/>${[[22, 24, 3], [100, 30, 2.4], [96, 96, 3.2], [24, 96, 2.2]].map(([x, y, r]) => `<circle class="dot" cx="${x}" cy="${y}" r="${r}"/>`).join('')}<path class="heart" d="M100 76c-2-3-6-1-5 2 1 2 5 5 5 5s4-3 5-5c1-3-3-5-5-2Z"/></g>`;
  if (сем === 'frost') return p.water
    ? `<g class="bk-bubbles">${[[24, 90, 6], [32, 76, 3.4], [96, 34, 5], [88, 22, 2.6], [100, 82, 3.4], [20, 34, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
    : `<g class="bk-flake" transform="rotate(${i * 15} 60 58)">${[0, 60, 120].map(a => `<path transform="rotate(${a} 60 58)" d="M60 18v80M60 26l-6-6M60 26l6-6M60 90l-6 6M60 90l6 6M60 40l-8-6M60 40l8-6M60 76l-8 6M60 76l8 6"/>`).join('')}</g>`;
  if (сем === 'mono') return `<circle class="bk-spot" cx="60" cy="54" r="40"/>`;
  if (сем === 'ink') return `<path class="bk-enso" d="M86 34a34 34 0 1 1-44-8" />`;
  return '';
}
function sторонаУгол(сторона, k) { return сторона ? (-0.15 - k * 0.32) * Math.PI / 1 * 0.5 + Math.PI * 0.05 : Math.PI + (0.15 + k * 0.32) * Math.PI * 0.5 - Math.PI * 0.05; }

// Плитка: подложка, свечение, детали семейства, рисунок, блик, кант.
function плиткаСем(сем, p) {
  if (сем === 'brass') return [6, 6, 114, 114].length && `<g class="rivets">${[[14, 14], [106, 14], [14, 106], [106, 106]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</g>`;
  if (сем === 'retro') return `<path class="bevel-l" d="M5 115V5h110"/><path class="bevel-d" d="M115 5v110H5"/>`;
  if (сем === 'parchment' || сем === 'mystic') return `<rect class="inner-frame" x="9" y="9" width="102" height="102" rx="${сем === 'mystic' ? 22 : 14}"/>`;
  if (сем === 'neon') return `<rect class="neon-frame" x="7" y="7" width="106" height="106" rx="24"/>`;
  if (сем === 'pastel') return `<rect class="pastel-frame" x="6" y="6" width="108" height="108" rx="26"/>`;
  if (сем === 'frost' && !p.water) return `<g class="frost">${[[18, 20], [30, 12], [100, 18], [108, 30], [14, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('')}</g>`;
  return '';
}
const РАДИУС = { retro: 6, parchment: 20, brass: 22, ink: 24 };

function иконка(id, i, p) {
  const и = ИКОНКИ[id];
  const набор = НАБОРЫ[p.id];
  if (набор) {
    const d = ФОРМЫ[набор.форма] || ФОРМЫ.round;
    return `<svg class="ico i-${id}" viewBox="0 0 120 120" role="img" aria-label="${и.имя}">
    <path class="tile" d="${d}"/><path class="tile-tex" d="${d}"/><path class="tile-glow" d="${d}"/>
    <g class="pi-body"><g class="back" clip-path="url(#${p.id}-form)">${набор.фон || ''}</g>
    <g class="art" data-k="${p.id}/${id}"${посадка(p.id + '/' + id, набор)}>${набор.иконки[id]}</g>
    <g class="front">${набор.перед || ''}</g></g>
    <path class="tile-vig" d="${d}"/><path class="tile-sheen" d="${d}"/>
    <path class="tile-rim" d="${d}"/>
  </svg>`;
  }
  const [x0, y0, x1, y1] = и.рамка;
  const k = Math.min(72 / (x1 - x0), 72 / (y1 - y0), 1.2);
  const tx = 60 - (x0 + x1) / 2 * k, ty = 58 - (y0 + y1) / 2 * k;
  const r = РАДИУС[p.сем] ?? 28;
  return `<svg class="ico i-${id}" viewBox="0 0 120 120" role="img" aria-label="${и.имя}">
    <rect class="tile" x="2" y="2" width="116" height="116" rx="${r}"/>
    <rect class="tile-tex" x="2" y="2" width="116" height="116" rx="${r}"/>
    <rect class="tile-glow" x="2" y="2" width="116" height="116" rx="${r}"/>
    <g class="pi-body">${плиткаСем(p.сем, p)}
    <g class="back">${фон(p.сем, i, p)}</g>
    <g class="art" transform="translate(${ф(tx)} ${ф(ty)}) scale(${ф(k * 1000) / 1000})">${и.тело()}</g></g>
    <rect class="tile-vig" x="2" y="2" width="116" height="116" rx="${r}"/><rect class="tile-sheen" x="2" y="2" width="116" height="116" rx="${r}"/>
    <rect class="tile-rim" x="2.5" y="2.5" width="115" height="115" rx="${r - .5}"/>
  </svg>`;
}

// Объём: свет слева сверху по краям формы, блик и тень предмета на плитке.
const объём = (id, { блик = .55, степень = 22, высота = 3.2, тень = .55, зерно = 0 } = {}) => `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="a"/>
  <feDiffuseLighting in="a" surfaceScale="${высота}" diffuseConstant="1.15" lighting-color="#fff" result="d"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
  <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="s0"/>
  <feComposite in="s0" in2="SourceAlpha" operator="in" result="s1"/>
  <feSpecularLighting in="a" surfaceScale="${высота}" specularConstant="${блик}" specularExponent="${степень}" lighting-color="#fff" result="p"><feDistantLight azimuth="235" elevation="30"/></feSpecularLighting>
  <feComposite in="p" in2="SourceAlpha" operator="in" result="p1"/>
  <feComposite in="s1" in2="p1" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="s2"/>${зерно ? `
  <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${зерно} 0" result="n1"/>
  <feComposite in="n1" in2="SourceAlpha" operator="in" result="n2"/>
  <feMerge result="s3"><feMergeNode in="s2"/><feMergeNode in="n2"/></feMerge>` : '<feMerge result="s3"><feMergeNode in="s2"/></feMerge>'}
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/><feOffset in="b" dy="3" result="o"/>
  <feFlood flood-color="#000" flood-opacity="${тень}"/><feComposite in2="o" operator="in" result="t"/>
  <feMerge><feMergeNode in="t"/><feMergeNode in="s3"/></feMerge>
</filter>`;

const FILTERS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  ${объём('vol')}${объём('volMetal', { блик: .95, степень: 20, высота: 4 })}${объём('volPaper', { блик: .3, степень: 30, высота: 2.2, тень: .35, зерно: .16 })}${объём('volSoft', { блик: .4, степень: 26, высота: 2.4, тень: .22 })}
  <filter id="texStone" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="4" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.6 0 0 0 -.62"/><feComposite in2="SourceAlpha" operator="in"/></filter>
  <filter id="texCloth" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9 .28" numOctaves="3" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -.6"/><feComposite in2="SourceAlpha" operator="in"/></filter>
  <filter id="texBrush" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .75" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.8 0 0 0 -.72"/><feComposite in2="SourceAlpha" operator="in"/></filter>
  <filter id="texPaper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="5" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .15  1.9 0 0 0 -.82"/><feComposite in2="SourceAlpha" operator="in"/></filter>
  <radialGradient id="vig" cx=".5" cy=".46" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="galaxy" cx=".35" cy=".3" r=".95"><stop offset="0" stop-color="#6a5ac8"/><stop offset=".45" stop-color="#2a2a78"/><stop offset="1" stop-color="#0a0a2c"/></radialGradient>
  <linearGradient id="ocean-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd8e8"/><stop offset=".55" stop-color="#1c86b8"/><stop offset="1" stop-color="#0c4a7c"/></linearGradient>
  <filter id="bloom" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="neonGlow" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="sticker" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="3" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feGaussianBlur in="d" stdDeviation="2.4" result="s"/><feOffset in="s" dy="2.4" result="so"/><feFlood flood-color="#000" flood-opacity=".18"/><feComposite in2="so" operator="in" result="sh"/><feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="inkBrush" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>
</defs></svg>`;

// Материалы, которые у неона и Windows 95 рисуются контуром.
const ТЕЛА = '.b-fill,.bone,.card,.page,.frame,.leather,.cameo,.flap,.ring,.quill,.parch,.vinyl,.ink-glass,.cloud,.moon,.handle,.eye-white,.coin,.note,.wound,.dagger-blade';

const CSS_НАБОРА = `
.tile { fill: var(--g-tile); } .tile-glow { fill: var(--g-glow); }
.tile-gloss { fill: #fff; opacity: .06; } .tile-rim { fill: none; stroke: var(--rim); stroke-opacity: .28; stroke-width: 1.2; }
.splat { fill: var(--g-dark); opacity: .55; }
.b-fill { fill: var(--g-main); }
.b-dark { fill: none; stroke: var(--g-dark); stroke-width: 7; stroke-linecap: round; }
.b-shade { fill: var(--shade); opacity: .4; }
.b-rim { fill: none; stroke: var(--rim); stroke-opacity: .4; stroke-width: 1.2; }
.hi { fill: none; stroke: #fff; stroke-opacity: .55; stroke-width: 2.6; stroke-linecap: round; }
.hi-dot { fill: #fff; opacity: .5; }
.drips path { fill: var(--g-main); } .drip-hi ellipse { fill: #fff; opacity: .55; }
.holes circle, .bite ellipse { fill: var(--ink); opacity: .85; }
.moon { fill: var(--g-moon); filter: url(#bloom); } .moon-glow { fill: var(--g-moonglow); }
.crater circle { fill: var(--c-main-d); opacity: .45; }
.moon-hi { fill: none; stroke: #fff; stroke-opacity: .6; stroke-width: 2.4; stroke-linecap: round; }
.bat { fill: var(--ink); }
.cloud { fill: var(--g-leather); stroke: var(--rim); stroke-opacity: .25; stroke-width: 1.2; }
.cloud-hi { fill: none; stroke: #fff; stroke-opacity: .18; stroke-width: 2; stroke-linecap: round; }
.rain path { fill: var(--g-main); }
.tube-hi { fill: none; stroke: #fff; stroke-opacity: .45; stroke-width: 1.6; stroke-linecap: round; }
.vein { fill: none; stroke: var(--c-main-d); stroke-width: 2.2; stroke-linecap: round; opacity: .75; }
.dots circle { fill: var(--paper); }
.bone, .card, .page, .frame, .quill, .coin, .clasp, .arm-head { fill: var(--g-second); }
.card, .frame, .quill, .coin { stroke: var(--c-second-d); stroke-width: .8; }
.coin.top { fill: var(--c-second); }
.beads circle, .frame-orn circle { fill: var(--c-second); stroke: var(--c-second-d); stroke-width: .6; }
.cameo { fill: var(--g-main); }
.sil, .bow, .hill, .castle, .pupil, .nib { fill: var(--ink); }
.sil-hi { fill: none; stroke: var(--c-main-d); stroke-width: 1.4; stroke-linecap: round; }
.sil-neck { fill: none; stroke: var(--c-main); stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 1.6 2.4; }
.cameo-hi { fill: none; stroke: #fff; stroke-opacity: .45; stroke-width: 2; stroke-linecap: round; }
.chip, .dagger-pom { fill: var(--gold); }
.card-line { fill: none; stroke: var(--c-main); stroke-width: 2; stroke-linecap: round; }
.leather, .handle { fill: var(--g-leather); stroke: var(--rim); stroke-opacity: .3; stroke-width: 1.1; }
.stitch { fill: none; stroke: var(--c-main-l); stroke-width: 1.1; stroke-dasharray: 3 2.6; opacity: .7; }
.flap, .wound, .note { fill: var(--g-main); }
.clasp { stroke: var(--ink); stroke-width: 1; }
.leather-hi, .handle-hi { fill: none; stroke: #fff; stroke-opacity: .14; stroke-width: 2; stroke-linecap: round; }
.rings rect { fill: var(--ink); stroke: var(--rim); stroke-opacity: .4; stroke-width: 1; }
.day { font: 700 34px Georgia, 'Times New Roman', serif; fill: var(--ink); }
.page-hi { fill: none; stroke: #fff; stroke-opacity: .35; stroke-width: 2.4; stroke-linecap: round; }
.claw { fill: none; stroke: var(--c-main-d); stroke-width: 2.4; stroke-linecap: round; opacity: .85; }
.frame-in { fill: var(--ink); } .sky { fill: var(--g-sky); } .i-gallery .moon { filter: none; }
.ink-glass { fill: var(--g-glass); stroke: var(--rim); stroke-opacity: .35; stroke-width: 1.2; }
.glass-hi { fill: none; stroke: #fff; stroke-opacity: .4; stroke-width: 2; stroke-linecap: round; }
.vane { fill: none; stroke: var(--c-second-d); stroke-width: .9; stroke-linecap: round; opacity: .8; }
.shaft { fill: none; stroke: #fff; stroke-opacity: .8; stroke-width: 1.6; stroke-linecap: round; }
.parch { stroke: var(--c-second-d); stroke-width: .9; } .parch.a { fill: var(--c-second); } .parch.b { fill: var(--g-second); }
.route { fill: none; stroke: var(--c-main); stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 4 3.4; }
.cross { fill: none; stroke: var(--c-main); stroke-width: 3.4; stroke-linecap: round; }
.dagger-blade { fill: #e9e3e0; stroke: #6a6466; stroke-width: .8; }
.dagger-guard, .dagger-grip { fill: none; stroke: var(--ink); stroke-width: 4.2; stroke-linecap: round; }
.ring { fill: none; stroke: var(--g-second); stroke-width: 7; }
.lens { fill: var(--g-lens); } .eye-white { fill: #f3e7e2; }
.eye-vein { fill: none; stroke: var(--c-main); stroke-width: 1; stroke-linecap: round; }
.iris { fill: var(--g-iris); } .glint { fill: #fff; }
.lens-hi { fill: none; stroke: #fff; stroke-opacity: .45; stroke-width: 2.4; stroke-linecap: round; }
.vinyl-rim { fill: var(--g-leather); }
.vinyl { fill: var(--ink); stroke: var(--rim); stroke-opacity: .3; stroke-width: 1; }
.groove circle { fill: none; stroke: var(--rim); stroke-opacity: .22; stroke-width: 1; }
.vinyl-shine { fill: var(--c-main-l); opacity: .14; }
.vinyl-hi { fill: none; stroke: #fff; stroke-opacity: .16; stroke-width: 3; stroke-linecap: round; }
.label-hole { fill: var(--ink); }
.label-ring { fill: none; stroke: #fff; stroke-opacity: .35; stroke-width: 1; }
.label-hi { fill: none; stroke: #fff; stroke-opacity: .55; stroke-width: 1.6; stroke-linecap: round; }
.arm { fill: none; stroke: var(--g-second); stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
.arm-base { fill: var(--ink); stroke: var(--g-second); stroke-width: 2; }

/* --- Наборы тем (dsl.mjs) --- */
.art .m { fill: var(--g-main); } .art .ml { fill: var(--c-main-l); } .art .md { fill: var(--c-main-d); }
.art .s { fill: var(--g-second); } .art .sd { fill: var(--c-second-d); } .art .d { fill: var(--g-leather); }
.art .k { fill: var(--ink); } .art .k2 { fill: var(--g-dark); } .art .kg { fill: #fff; } .art .g { fill: var(--gold); } .art .p { fill: var(--paper); } .art .t { fill: var(--g-sky); }
.art :is(.m,.s,.d,.t,.k2) { stroke: var(--edge); stroke-width: 1.1; stroke-linejoin: round; }
.art :is(.lm,.ll,.ls,.ld,.lk,.lg,.lp,.lw) { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.art :is(.lm,.ll,.ls,.ld,.lk,.lg,.lp,.lw,.la):not([stroke-width]) { stroke-width: 3; }
.art .lm { stroke: var(--c-main); } .art .ll { stroke: var(--c-main-l); } .art .ls { stroke: var(--c-second); } .art .ld { stroke: var(--c-second-d); }
.art .lk { stroke: var(--ink); } .art .lg { stroke: var(--gold); } .art .lp { stroke: var(--paper); } .art .lw { stroke: #fff; stroke-opacity: .85; }
.art text { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; }
.art .tk { fill: var(--ink); } .art .tm { fill: var(--c-main-l); } .art .tg { fill: var(--gold); } .art .tp { fill: var(--paper); } .art .tw { fill: #fff; } .art .tb { fill: #000; }
.art .blush { fill: #ff7da8; opacity: .55; } .art .blush2 { fill: #efc4c4; }
.art .a:not(.parch) { fill: var(--acc, var(--c-main)); stroke: var(--edge); stroke-width: 1.1; stroke-linejoin: round; } .art .w { fill: #fff; }
.art .la { fill: none; stroke: var(--acc, var(--c-main)); stroke-linecap: round; stroke-linejoin: round; } .art .ta { fill: var(--acc); }
.tile-vig { fill: url(#vig); pointer-events: none; } .tile-sheen { fill: url(#sheen); pointer-events: none; }
.is-light .tile-vig { opacity: .28; } .is-light .tile-sheen { opacity: .9; }
.back .bk { fill: var(--c-main); opacity: .2; } .back .bkg { fill: var(--gold); opacity: .55; } .back .bkl { fill: none; stroke: var(--c-main); stroke-opacity: .28; }
.back .bkr { fill: var(--gold); opacity: .85; }

/* Подача тем */
.th-medieval .art .glass { stroke: none; opacity: .94; } .th-medieval .art .glass.m { fill: #a8263a; } .th-medieval .art .glass.s { fill: #e8c870; } .th-medieval .art .glass.g { fill: #2f5fa8; } .th-medieval .art .glass.t { fill: #2f7a5a; }
.th-medieval .art .vit { fill: none; stroke: #1c120a; stroke-linejoin: round; stroke-linecap: round; }
.th-medieval .tile { fill: #2a2018; } .th-medieval .tile-glow { fill: #f4d890; opacity: .28; }
.th-egypt .art .lg { stroke: #a87a10; } .th-egypt .art .g { fill: #c9962a; }
.th-spaceopera .art, .th-biopunk .art { filter: drop-shadow(0 0 3px var(--c-main)); }
.th-spaceopera .tile { fill: url(#galaxy); }
.th-academia .front .crest { fill: none; stroke: var(--gold); stroke-opacity: .85; } .th-academia .front .laurelL { display: none; }
.th-egypt .front .crest { fill: none; stroke: var(--gold); }
.th-steampunk .front .rivet { fill: var(--g-second); stroke: var(--ink); stroke-width: .6; }
.th-cottage .front .wreath { fill: #6f8452; } .th-cottage .front .wreath2 { fill: #93a873; } .th-cottage .front .bloom { fill: #fff; } .th-cottage .front .bloomc { fill: #e4b84a; }
.th-teaparty .front .gframe { fill: none; stroke: #c9a24a; } .th-teaparty .front .gframe2 { fill: none; stroke: #8a6a22; }
.th-teaparty .front .rose { fill: #c4505f; stroke: #fff; stroke-width: .6; } .th-teaparty .front .rosel { fill: none; stroke: #7a2230; }
.th-kawaii .front .stitch2 { fill: none; stroke: var(--c-main); stroke-opacity: .6; stroke-dasharray: 5 4; }
.th-ice .front .jelly { fill: none; stroke: #fff; stroke-opacity: .7; stroke-linecap: round; } .th-ice .front .jelly2 { fill: #fff; opacity: .4; } .th-ice .front .bub { fill: #fff; opacity: .55; }
.th-ocean .tile { fill: url(#ocean-sea); } .th-ocean .back .coral { fill: none; stroke: #ff7a7a; stroke-linecap: round; } .th-ocean .back .coral2 { fill: none; stroke: #ffb44a; stroke-linecap: round; } .th-ocean .back .weed { fill: none; stroke: #4fc98a; stroke-linecap: round; }
.th-ocean .back .bub { fill: #fff; opacity: .6; } .th-ocean .back .fish1 { fill: #ffb44a; } .th-ocean .back .fish2 { fill: #ff7a7a; } .th-ocean .back .k { fill: #03121c; } .th-ocean .back .bkc { display: none; }
.th-ocean .front .aq { fill: none; stroke: #bff3ff; stroke-opacity: .85; } .th-ocean .front .aq2 { fill: none; stroke: #fff; stroke-opacity: .9; stroke-linecap: round; }
.th-noir .back .blind { fill: none; stroke: #fff; stroke-opacity: .05; } .th-noir .art .w { fill: #fff; } .th-noir .art .blind2 { fill: #fff; opacity: .2; }
.th-noir .tile-glow { opacity: .4; }
.th-mafia .tile { fill: #efe6d4; } .th-mafia .tile-glow { display: none; } .th-mafia .tile-rim { stroke: #000; stroke-opacity: .5; }
.th-mafia .art .s { fill: #2a2a2a; } .th-mafia .art .d { fill: #141414; } .th-mafia .art .m { fill: #c81e1e; } .th-mafia .art .md { fill: #7c1010; } .th-mafia .art .p { fill: #f6efe0; } .th-mafia .art .k { fill: #0a0a0a; } .th-mafia .art .g { fill: #c9a24a; }
.th-mafia .art .ls { stroke: #2a2a2a; } .th-mafia .art .ld { stroke: #6a6a6a; } .th-mafia .art .lm { stroke: #c81e1e; } .th-mafia .art .tm { fill: #c81e1e; } .th-mafia .art .tp { fill: #f6efe0; }
.th-mafia .art .rosem, .th-mafia .front .rosem { fill: #c81e1e; } .th-mafia .art .rosed, .th-mafia .front .rosed { fill: none; stroke: #5c0c0c; } .th-mafia .front .rosel2 { fill: #2f4a2a; }
.th-japan .art .lk { stroke: #000; } .th-japan .front .seal2 { fill: none; stroke: #b3403f; stroke-opacity: .55; }
.th-bujo .tile-glow { opacity: .3; }
.th-web1 .tile-rim { stroke: #000; stroke-opacity: 1; stroke-width: 1.4; }
.th-web1 .tile { fill: #c0c0c0; } .th-web1 .tile-glow { display: none; }
.th-web1 .art .ico-frame { fill: none; }
.th-ocean .tile-glow { opacity: .5; }

/* --- Семейства --- */
.fam-neon .drips, .fam-brass .drips, .fam-parchment .drips, .fam-mystic .drips, .fam-pastel .drips, .fam-mono .drips, .fam-ink .drips, .fam-retro .drips { display: none; }

.fam-neon .art { filter: url(#neonGlow); }
.fam-neon .art :is(${ТЕЛА}) { fill: var(--c-main); fill-opacity: .16; stroke: var(--c-main-l); stroke-opacity: 1; stroke-width: 2.6; stroke-linejoin: round; }
.fam-neon .art :is(.bone,.card,.page,.frame,.quill,.coin,.ring,.parch,.eye-white) { stroke: var(--c-second); fill: var(--c-second); fill-opacity: .12; }
.fam-neon .art :is(.b-shade,.hi,.hi-dot,.drip-hi,.vein,.tube-hi,.page-hi,.cameo-hi,.vinyl-shine,.glass-hi,.leather-hi,.handle-hi) { display: none; }
.fam-neon .day { fill: var(--c-second); }
.th-cyberpunk .art :is(.m,.ml,.md,.d,.t,.k2) { fill: var(--c-main); fill-opacity: .14; stroke: var(--c-main-l); stroke-width: 2.4; stroke-linejoin: round; }
.th-cyberpunk .art :is(.s,.sd) { fill: var(--c-second); fill-opacity: .16; stroke: var(--c-second); stroke-width: 2.4; stroke-linejoin: round; }
.th-cyberpunk .art .k { fill: var(--c-main-l); } .th-cyberpunk .art .tk { fill: var(--c-second); } .th-cyberpunk .art .lk { stroke: var(--c-second); } .th-cyberpunk .art .ld { stroke: var(--c-second); }
.fam-neon .bk-neon { fill: none; stroke: var(--c-main); stroke-opacity: .35; stroke-width: 1.4; }
.fam-neon .neon-frame { fill: none; stroke: var(--c-main); stroke-opacity: .45; stroke-width: 1.6; filter: url(#neonGlow); }

.fam-brass .bk-gear { fill: var(--g-dark); opacity: .38; }
.fam-brass.is-light .bk-gear { opacity: .16; }
.fam-brass .rivets circle { fill: var(--g-second); stroke: var(--ink); stroke-width: .6; }
.fam-brass .b-rim { stroke: var(--gold); stroke-opacity: .7; }

.fam-parchment .bk-laurel { fill: var(--c-main); stroke: var(--c-main); opacity: .35; stroke-width: 1.6; }
.fam-parchment .bk-laurel path { fill: none; }
.fam-parchment .inner-frame { fill: none; stroke: var(--c-main); stroke-opacity: .5; stroke-width: 1; }
.fam-parchment .b-rim { stroke: var(--gold); stroke-opacity: .8; }

.fam-mystic .bk-mystic { fill: var(--gold); opacity: .55; } .fam-mystic .bk-moon { opacity: .35; }
.fam-mystic .inner-frame { fill: none; stroke: var(--gold); stroke-opacity: .55; stroke-width: 1; }
.fam-mystic .b-rim { stroke: var(--gold); stroke-opacity: .95; stroke-width: 1.6; }

.fam-pastel .art { filter: url(#sticker); }
.fam-pastel .bk-pastel circle { fill: #fff; opacity: .55; } .fam-pastel .bk-pastel .dot, .fam-pastel .bk-pastel .heart { fill: var(--c-main); opacity: .6; }
.fam-pastel .pastel-frame { fill: none; stroke: #fff; stroke-width: 2.4; opacity: .9; }
.fam-pastel .tile-rim { stroke: var(--c-main); stroke-opacity: .35; }

.fam-frost .drips path { fill: var(--g-second); } .fam-frost .drip-hi ellipse { opacity: .8; }
.fam-frost .bk-flake { fill: none; stroke: var(--gold); stroke-opacity: .3; stroke-width: 1.6; stroke-linecap: round; }
.fam-frost .bk-bubbles circle { fill: none; stroke: var(--gold); stroke-opacity: .45; stroke-width: 1.4; }
.fam-frost .frost circle { fill: #fff; opacity: .5; }

.fam-mono .bk-spot { fill: var(--g-glow); }

.fam-ink .art { filter: url(#inkBrush); }
.fam-ink .bk-enso { fill: none; stroke: var(--gold); stroke-width: 7; stroke-linecap: round; opacity: .8; filter: url(#inkBrush); }
.fam-ink .b-rim, .fam-ink .hi, .fam-ink .hi-dot { display: none; }

.fam-retro .art :is(${ТЕЛА}) { stroke: #000; stroke-opacity: 1; stroke-width: 2.4; stroke-linejoin: miter; }
.fam-retro .art { shape-rendering: crispEdges; }
.fam-retro .art :is(.b-shade,.hi,.hi-dot,.drip-hi,.b-rim,.tube-hi,.cameo-hi,.vinyl-shine,.glass-hi,.leather-hi,.handle-hi,.lens-hi) { display: none; }
.fam-retro .tile-gloss { display: none; }
.fam-retro .bevel-l { fill: none; stroke: #fff; stroke-width: 4; } .fam-retro .bevel-d { fill: none; stroke: #404040; stroke-width: 4; }
.fam-retro .tile-rim { stroke: #000; stroke-opacity: 1; stroke-width: 1.4; }

/* --- Акцент темы: контраст внутри иконки --- */
.th-voodoo { --acc: #e8a33d; } .th-spacehorror { --acc: #7dff6a; } .th-steampunk { --acc: #2fb7a4; } .th-academia { --acc: #8f2430; }
.th-western { --acc: #2a9d8f; } .th-pirate { --acc: #b3312c; } .th-fantasy { --acc: #e8604c; } .th-witch { --acc: #f2cf7a; }
.th-biopunk { --acc: #ff5fa8; } .th-spaceopera { --acc: #ff9d4a; } .th-egypt { --acc: #2f5bb7; } .th-japan { --acc: #c23a3a; }
.th-cyberpunk { --acc: #3ff0ff; } .th-ocean { --acc: #ff7a5a; } .th-cottage { --acc: #b3503a; } .th-darkroom { --acc: #ff9d4a; } .th-mafia { --acc: #c81e1e; } .th-teaparty { --acc: #c9a24a; }

/* --- Живая подача: объём, свет, материал --- */
:is(.th-voodoo,.th-spacehorror,.th-witch,.th-fantasy,.th-ice,.th-ocean,.th-darkroom,.th-solarpunk) .art { filter: url(#vol); }
:is(.th-steampunk,.th-dieselpunk,.th-academia,.th-egypt) .art { filter: url(#volMetal); }
:is(.th-western,.th-pirate,.th-cottage,.th-mafia) .art { filter: url(#volPaper); }
.th-teaparty .art, .th-kawaii .art { filter: url(#volSoft) url(#sticker); }
.th-japan .art { filter: url(#volSoft); }
.th-japan .art .a:not(.parch) { fill: #e58a98; }
.th-spaceopera .art, .th-biopunk .art { filter: url(#vol) drop-shadow(0 0 3px var(--c-main)); }
.th-noir .art { filter: drop-shadow(0 0 3px rgba(255,255,255,.45)); }
.th-medieval .art { filter: url(#vol) drop-shadow(0 0 4px rgba(255,220,150,.55)); }
.th-medieval .art .glass.p { fill: #f4efe0; }
.th-medieval .tile { fill: #1f2d52; } .th-medieval .tile-glow { fill: #6f8ed8; opacity: .45; }
.th-web1 .tile-vig, .th-web1 .tile-sheen, .th-bujo .tile-sheen { display: none; }
.th-mafia .tile-vig { opacity: .18; }

/* --- Фактура плитки --- */
.tile-tex { fill: #fff; opacity: .055; filter: url(#texStone); }
:is(.th-steampunk,.th-dieselpunk,.th-academia) .tile-tex { filter: url(#texBrush); opacity: .09; }
:is(.th-kawaii,.th-teaparty,.th-cottage) .tile-tex { filter: url(#texCloth); opacity: .22; }
:is(.th-western,.th-pirate,.th-egypt,.th-japan,.th-mafia) .tile-tex { filter: url(#texPaper); opacity: .3; }
:is(.th-ice,.th-ocean,.th-bujo,.th-spaceopera) .tile-tex { opacity: .07; }
.th-web1 .tile-tex { display: none; }

/* --- Vamp --- */
.th-vamp .art { filter: url(#vol); }
.th-vamp .splat { fill: #560914; opacity: 1; filter: url(#vol); }
.th-vamp .tile-gloss { display: none; }
.th-vamp .tile-rim { stroke-opacity: .4; }
`;

const ПОРЯДОК = ['calls', 'weather', 'health', 'messages', 'contacts', 'wallet', 'calendar', 'gallery', 'notes', 'maps', 'search', 'music'];

const CSS_СТЕНДА = `
:root { color-scheme: dark; }
body { margin: 0; background: #0d0a0c; color: #eadfe2; font: 15px/1.45 Georgia, 'Times New Roman', serif; }
main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 60px; }
h1 { font-weight: normal; letter-spacing: .14em; text-transform: uppercase; font-size: 22px; margin: 0 0 6px; }
h2 { font-weight: normal; letter-spacing: .12em; text-transform: uppercase; font-size: 13px; color: #bfa8ae; margin: 34px 0 12px; border-bottom: 1px solid #3a2a30; padding-bottom: 6px; }
p.lead { margin: 0; color: #b59ea4; max-width: 820px; }
nav { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
nav a { color: #e2c9cf; text-decoration: none; border: 1px solid #3a2a30; border-radius: 999px; padding: 2px 10px; font-size: 13px; }
.themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); gap: 18px; }
.theme { border-radius: 22px; padding: 16px 16px 12px; background: radial-gradient(80% 70% at 75% 0%, color-mix(in srgb, var(--c-main) 40%, transparent), transparent 70%), linear-gradient(var(--wall1), var(--wall2)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 18px 30px -18px #000; }
.theme header { display: flex; justify-content: space-between; align-items: baseline; color: var(--label); margin-bottom: 12px; }
.theme header b { font-weight: normal; letter-spacing: .08em; text-transform: uppercase; font-size: 14px; }
.theme header small { opacity: .7; font-size: 12px; }
.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px 6px; }
.app { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.app .ico { width: 56px; height: 56px; filter: drop-shadow(0 5px 7px rgba(0,0,0,.45)); }
.app small { font: 11px system-ui, sans-serif; color: var(--label); }
details { margin-top: 10px; color: var(--label); }
details summary { cursor: pointer; font-size: 12px; opacity: .8; }
.big { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 10px; }
.big .ico { width: 100%; height: auto; filter: drop-shadow(0 8px 12px rgba(0,0,0,.5)); }
@media (max-width: 600px) {
  main { padding: 18px 16px 40px; }
  .themes { grid-template-columns: 1fr; }
  .grid, .big { grid-template-columns: repeat(4, 1fr); }
  .app .ico { width: 50px; height: 50px; }
}
`;

const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Иконки телефона — все темы</title><style>${CSS_СТЕНДА}${CSS_НАБОРА}</style></head><body>${FILTERS}<main>
<h1>Иконки телефона · все темы</h1>
<p class="lead">У каждой темы свои двенадцать предметов по смыслу: у пиратов звонки — рупор, кошелёк — сундук, у Египта здоровье — анх, у фотолаборатории контакты — контактный лист. И своя плитка и подача: витраж, аквариум, венок, золотая рама, пиксели. «Крупно» под темой показывает иконки в размер.</p>
<nav>${Object.keys(СЕМЕЙСТВА).map(с => `<a href="#f-${с}">${СЕМЕЙСТВА[с].split(' — ')[0]}</a>`).join('')}</nav>
${Object.entries(СЕМЕЙСТВА).map(([сем, имя]) => `<h2 id="f-${сем}">${имя}</h2><div class="themes">${ТЕМЫ.filter(т => т[2] === сем).map(т => {
  const p = палитра(т);
  return `<section class="theme fam-${сем} th-${т[0]}${p.light ? ' is-light' : ''}" style="${varsТемы(p)}">
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs(p)}</defs></svg>
    <header><b>${т[1]}</b><small>${т[0]}</small></header>
    <div class="grid">${ПОРЯДОК.map((id, i) => `<div class="app">${иконка(id, i, p)}<small>${ИКОНКИ[id].имя}</small></div>`).join('')}</div>
    <details><summary>Крупно</summary><div class="big"></div></details>
  </section>`;
}).join('')}</div>`).join('')}
</main>
<script>
// «Крупно» — копии тех же иконок, собираются при первом раскрытии.
document.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
  const big = d.querySelector('.big');
  if (!d.open || big.childElementCount) return;
  d.closest('.theme').querySelectorAll('.grid .ico').forEach(s => big.appendChild(s.cloneNode(true)));
}));
</script></body></html>`;

fs.writeFileSync(path.join(ЗДЕСЬ, 'index.html'), html);
console.log('index.html', html.length, 'символов,', ТЕМЫ.length, 'тем');

// --- Наборы для самого HUD: render/phone-icons/ -----------------------------
// Стили — под .hud-pi, имена вырезок и фильтров — с приставкой: страница общая.
function подКласс(css) {
  const чисто = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const правила = [];
  for (const м of чисто.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const части = []; let глубина = 0, кусок = '';
    for (const ч of м[1]) {
      if (ч === '(') глубина++; if (ч === ')') глубина--;
      if (ч === ',' && !глубина) { части.push(кусок); кусок = ''; } else кусок += ч;
    }
    части.push(кусок);
    const селекторы = части.map(ч => ч.trim()).filter(Boolean).map(ч => (/^(\.fam-|\.th-|\.is-light|\.i-|:is\(\.th)/.test(ч) ? '.hud-pi' + ч : '.hud-pi ' + ч));
    правила.push(селекторы.join(',') + '{' + м[2].trim().replace(/\s+/g, ' ') + '}');
  }
  return правила.join('\n');
}
const сПриставкой = (т) => т.replace(/url\(#/g, 'url(#hp-').replace(/\bid="/g, 'id="hp-');
const вСтроку = (т) => JSON.stringify(т);
if (!БЕЗ_ОБМЕРА) {
  const ПАПКА = path.resolve(ЗДЕСЬ, '../../../render/phone-icons');
  fs.mkdirSync(ПАПКА, { recursive: true });
  const фильтры = FILTERS.replace(/^<svg[^>]*><defs>/, '').replace(/<\/defs><\/svg>$/, '');
  fs.writeFileSync(path.join(ПАПКА, '_style.js'), '// Собрано tests/tools/phone-icons-stand/build.mjs — руками не править.\n'
    + 'export const СТИЛЬ = ' + вСтроку(сПриставкой(подКласс(CSS_НАБОРА))) + ';\n'
    + 'export const ФИЛЬТРЫ = ' + вСтроку(сПриставкой(фильтры)) + ';\n');
  for (const т of ТЕМЫ) {
    const p = палитра(т);
    const вырезки = [];
    const иконки = {};
    ПОРЯДОК.forEach((id, i) => {
      // Вырезки — в общие defs: в скрытой карточке они перестают работать.
      const внутри = иконка(id, i, p).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
        .replace(/ data-k="[^"]*"/g, '').replace(/<clipPath[\s\S]*?<\/clipPath>/g, (в) => { if (!вырезки.includes(в)) вырезки.push(в); return ''; }).replace(/>\s+</g, '><').trim();
      иконки[id] = сПриставкой(внутри);
    });
    fs.writeFileSync(path.join(ПАПКА, т[0] + '.js'), '// Собрано tests/tools/phone-icons-stand/build.mjs — руками не править.\n'
      + 'export default ' + JSON.stringify({ сем: т[2], свет: p.light || т[0] === 'mafia', опора: т[3], главный: { medieval: '#2f5fa8' }[т[0]] || (т[6] && т[6].main) || т[3], defs: сПриставкой(defs(p) + вырезки.join('')), vars: сПриставкой(varsТемы(p)), иконки }) + ';\n');
  }
  console.log('наборы HUD:', ТЕМЫ.length);
}
