// hud-manager/palette.js
//
// Палитра секций карточки из цветов темы HUD (Таверна — запасной источник).
//
// У каждой секции (возраст, одежда, цели, ревность…) свой цвет, но все они
// родня теме: берём тона темы — акцент HUD, свечение, акцент памяти, цвет
// часов, исходящих сообщений (цвета Таверны — только если у HUD их нет) —
// и раскладываем секции вокруг них, в пределах 32–44° по кругу тонов, с разной
// светлотой и насыщенностью. На «Вампире» выходят вино, багрянец, пурпур,
// коралл и кирпич; на холодной теме — лёд, бирюза, индиго.
//
// Различимость не угадываем, а считаем: цвета сравниваются в OKLab (так, как
// их видит глаз), соседние строки карточки обязаны отличаться сильнее, чем
// дальние.
//
// Результат пишется переменными --hud-f-<секция> (и --hud-kind-<группа> для
// старых правил) на <html>; CSS берёт их с запасным жёстким цветом
// (misc.css, «Карточка: группы строк» и «Цвет секции из темы»).

// Секции в порядке карточки: соседние по списку — соседние на экране.
export const СЕКЦИИ = [
  'age', 'clothes', 'looks', 'body', 'phys', 'health', 'illness', 'marks', 'preg', 'cycle',
  'where', 'role', 'status', 'thoughts', 'subtext', 'key', 'exp', 'dream',
  'goals', 'schedule', 'inventory', 'relations', 'trust', 'memories', 'lines',
  'jealousy', 'clash', 'conflict', 'fears', 'flags', 'exposure', 'perception',
  // Запасные — для полей, которых нет в таблицах (render/character.js).
  'x1', 'x2', 'x3', 'x4', 'x5', 'x6',
];
// Группа секции — для совместимости с --hud-kind-* (берём цвет первой секции).
const ГРУППА_СЕКЦИИ = {
  look: 'looks', vitals: 'phys', place: 'where', standing: 'role', mind: 'thoughts', dream: 'dream',
  plans: 'goals', items: 'inventory', bonds: 'relations', tension: 'jealousy', alarm: 'flags', misc: 'x1',
};
// Тревожным секциям чуть тянемся к тёплому (красному): смысл «опасно» не
// должен теряться совсем, но цвет всё равно остаётся из семьи темы.
const ТРЕВОЖНЫЕ = new Set(['fears', 'flags', 'exposure', 'clash', 'conflict']);

// Любой CSS-цвет → [r, g, b, a]: браузер сам разбирает hex, rgb, hsl, имена.
function разобрать(значение) {
  const v = String(значение || '').trim();
  if (!v || /gradient|url\(/i.test(v)) return null;
  const пробник = document.createElement('span');
  пробник.style.display = 'none';
  пробник.style.color = v;
  if (!пробник.style.color) return null;
  document.body.appendChild(пробник);
  const итог = getComputedStyle(пробник).color;
  пробник.remove();
  const m = итог.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
  return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
}

function вHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
function изHsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
// sRGB → OKLab: расстояние в нём близко к тому, насколько цвета разные на глаз.
function вOklab([r, g, b]) {
  const лин = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const R = лин(r), G = лин(g), B = лин(b);
  const l = Math.cbrt(.4122214708 * R + .5363325363 * G + .0514459929 * B);
  const m = Math.cbrt(.2119034982 * R + .6806995451 * G + .1073969566 * B);
  const s = Math.cbrt(.0883024619 * R + .2817188376 * G + .6299787005 * B);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
const разница = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
const яркость = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;
const дуга = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

function читатьТему() {
  const стиль = getComputedStyle(document.documentElement);
  const взять = (...имена) => { for (const и of имена) { const c = разобрать(стиль.getPropertyValue(и)); if (c && c[3] > 0) return c; } return null; };
  return {
    accent: взять('--hud-accent'),
    glow: взять('--hud-purple-glow'),
    memory: взять('--hud-memory-accent'),
    clock: взять('--hud-clock-color'),
    out: взять('--hud-msg-out-start'),
    em: взять('--SmartThemeEmColor'),
    quote: взять('--SmartThemeQuoteColor'),
    underline: взять('--SmartThemeUnderlineColor'),
    text: взять('--hud-text', '--SmartThemeBodyColor'),
  };
}

// Тона темы: хроматические цвета, близкие (ближе 16°) склеиваем. Акцент HUD
// первым и с наибольшим весом — это лицо темы.
// Цвета Таверны (курсив, цитаты, подчёркивание) — только запасной источник:
// на «Вампире» с зелёным курсивом Таверны мысли и место выходили зелёными,
// а карточка должна целиком говорить цветами выбранной темы HUD.
function тонаТемы(тема) {
  const изHud = собратьТона(тема, { accent: 3, glow: 1.5, memory: 1.5, out: 1.2, clock: .8 });
  return изHud.length ? изHud : собратьТона(тема, { em: 1.2, quote: 1, underline: 1 });
}
function собратьТона(тема, вес) {
  const тона = [];
  for (const [имя, в] of Object.entries(вес)) {
    const c = тема[имя];
    if (!c) continue;
    const [h, s, l] = вHsl(c);
    if (s < 18 || l < 8 || l > 94) continue;
    const рядом = тона.find(т => дуга(т.h, h) < 16);
    if (рядом) { рядом.в += в; continue; }
    тона.push({ h, s, в });
  }
  return тона.sort((a, b) => b.в - a.в).slice(0, 5);
}

// Строит палитру. Тёмная или светлая подложка решается по цвету текста:
// светлый текст — значит фон тёмный.
export function собратьПалитру(тема) {
  const текст = тема.text || [220, 220, 230, 1];
  const светлаяТема = яркость(текст) < .45;
  let тона = тонаТемы(тема);
  const серая = !тона.length;
  // Совсем бесцветная тема: секции всё равно различаем, но едва тонированными.
  if (серая) тона = [{ h: 220, s: 20, в: 1 }];
  // Одна семья тонов — даём ей больше простора по кругу, иначе 31 секции
  // тесно; несколько — держимся ближе к каждому.
  const размах = тона.length === 1 ? 44 : тона.length === 2 ? 38 : 32;
  const Sтемы = серая ? 14 : Math.max(40, Math.min(80, тона[0].s));
  const Lбаза = светлаяТема ? 38 : 70;

  // Кандидаты: сдвиг от каждого тона темы × светлота × насыщенность.
  const кандидаты = [];
  for (const т of тона) {
    for (let d = -размах; d <= размах; d += 7) {
      for (const dl of (светлаяТема ? [-12, -5, 2, 9] : [-17, -8, 1, 10, 17])) {
        for (const ks of [1.08, .8, .58]) {
          const h = т.h + d, s = Math.max(серая ? 8 : 30, Math.min(90, Sтемы * ks)), l = Lбаза + dl;
          кандидаты.push({ h, s, l, lab: вOklab(изHsl(h, s, l)), штраф: Math.abs(d) / размах * (3 / т.в) * 4 + Math.abs(dl) * .12 + (ks < 1 ? (1 - ks) * 5 : 0) });
        }
      }
    }
  }

  // Жадно по порядку карточки: каждой секции — кандидат, самый далёкий от уже
  // выданных (соседи по карточке считаются с запасом), с лёгким штрафом за
  // уход от тонов темы. Детерминировано: одна тема — одна палитра.
  const выдано = [];
  const палитра = {};
  const lab = {};
  СЕКЦИИ.forEach((секция, i) => {
    let лучший = null, лучшийСчёт = -Infinity;
    for (const к of кандидаты) {
      if (выдано.some(в => в.к === к)) continue;
      let мин = Infinity;
      выдано.forEach((в, j) => {
        const соседство = i - j <= 2 ? 1.6 : 1;
        мин = Math.min(мин, разница(к.lab, в.к.lab) / соседство);
      });
      if (!выдано.length) мин = 40;
      // Тревожным — бонус за тёплый тон (к красному).
      const тепло = ТРЕВОЖНЫЕ.has(секция) && !серая ? (1 - дуга(к.h, 8) / 180) * 4 : 0;
      const счёт = Math.min(мин, 17) - к.штраф + тепло;
      if (счёт > лучшийСчёт) { лучшийСчёт = счёт; лучший = к; }
    }
    выдано.push({ к: лучший, секция });
    палитра[секция] = hsl(лучший.h, лучший.s, лучший.l);
    lab[секция] = лучший.lab;
  });
  const группы = {};
  for (const [г, с] of Object.entries(ГРУППА_СЕКЦИИ)) группы[г] = палитра[с];
  return { палитра, группы, светлаяТема, тона: тона.map(т => Math.round(т.h)), lab };
}

let последний = '';
export function обновитьПалитруГрупп() {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    const тема = читатьТему();
    const подпись = JSON.stringify(тема);
    if (подпись === последний) return;
    последний = подпись;
    const { палитра, группы, светлаяТема, тона } = собратьПалитру(тема);
    const тонаГлавный = тона[0] ?? 330;
    const root = document.documentElement;
    for (const [секция, цвет] of Object.entries(палитра)) root.style.setProperty('--hud-f-' + секция, цвет);
    for (const [группа, цвет] of Object.entries(группы)) root.style.setProperty('--hud-kind-' + группа, цвет);
    // Главный тон темы — от него считаются тона людей (кружки в «Отношениях»).
    root.style.setProperty('--hud-tone-base', String(тонаГлавный));
    root.classList.toggle('hud-kinds-light', светлаяТема);
  } catch (e) { console.warn('[TavernOS HUD] палитра секций', e); }
}

// SillyTavern меняет тему, переписывая переменные в style у <html> и класс
// у <body>. Следим за этим и пересобираем палитру (с задержкой: смена темы —
// это пачка правок подряд). Сами мы тоже пишем в style у <html>, но
// повторного пересчёта не будет: входные цвета те же — подпись совпадает.
let наблюдатель = null;
export function следитьЗаТемой() {
  if (наблюдатель || typeof MutationObserver === 'undefined') return;
  let таймер = null;
  наблюдатель = new MutationObserver(() => { clearTimeout(таймер); таймер = setTimeout(обновитьПалитруГрупп, 250); });
  наблюдатель.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
  if (document.body) наблюдатель.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
}
