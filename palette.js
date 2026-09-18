// hud-manager/palette.js
//
// Палитра смысловых групп карточки из цветов темы: SillyTavern (SmartTheme)
// + HUD. Раньше у групп были жёсткие цвета, и на любой теме карточка
// выглядела одинаково — часто чужеродно. Теперь каждая группа берёт тон из
// темы, а светлоту и насыщенность подгоняем под подложку, чтобы подпись
// читалась и на тёмной, и на бумажной теме.
//
// Результат пишется переменными --hud-kind-<группа> на <html>; CSS берёт их
// с запасным жёстким цветом (misc.css, «Карточка: группы строк»).

// Смысловой тон группы — «якорь», к которому палитра тянется, если тема
// монохромная. Тревога остаётся красной, тело — зелёным: цвет несёт смысл.
const ГРУППЫ = {
  // Смысловые — первыми, тревога самой первой: её тон важнее всех.
  alarm:    { якорь: null,        тон: 0 },
  vitals:   { якорь: null,        тон: 140 },
  plans:    { якорь: null,        тон: 52 },
  tension:  { якорь: null,        тон: 24 },
  bonds:    { якорь: 'accent',    тон: 330 },
  mind:     { якорь: 'em',        тон: 265 },
  dream:    { якорь: 'em',        тон: 235, сдвиг: -30 },
  place:    { якорь: 'quote',     тон: 178 },
  standing: { якорь: 'underline', тон: 212 },
  look:     { нейтральный: true,  тон: 32 },
  items:    { нейтральный: true,  тон: 215 },
};

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
const яркость = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;
// Кратчайший путь по кругу тонов: смешать 350° и 10° — это 0°, а не 180°.
const смешатьТон = (a, b, доля) => { const d = ((b - a + 540) % 360) - 180; return a + d * доля; };

function читатьТему() {
  const стиль = getComputedStyle(document.documentElement);
  const взять = (...имена) => { for (const и of имена) { const c = разобрать(стиль.getPropertyValue(и)); if (c && c[3] > 0) return c; } return null; };
  return {
    accent: взять('--hud-accent'),
    em: взять('--SmartThemeEmColor'),
    quote: взять('--SmartThemeQuoteColor'),
    underline: взять('--SmartThemeUnderlineColor'),
    text: взять('--hud-text', '--SmartThemeBodyColor'),
  };
}

// Строит палитру. Тёмная или светлая подложка решается по цвету текста:
// светлый текст — значит фон тёмный.
export function собратьПалитру(тема) {
  const текст = тема.text || [220, 220, 230, 1];
  const светлаяТема = яркость(текст) < .45;
  const L = светлаяТема ? 38 : 72;
  const акцент = тема.accent ? вHsl(тема.accent) : [330, 60, 70];
  // Насыщенность темы задаёт характер: приглушённая тема — приглушённые группы.
  const Sтемы = Math.max(38, Math.min(82, акцент[1] || 60));
  const занято = [];
  const палитра = {};
  // Смысловые группы (тревога, тело, планы, напряжение) ставим первыми:
  // при разведении совпавших тонов уступать должны якорные, иначе «тело»
  // уезжало из зелёного в фиолетовый и теряло смысл.
  const порядок = Object.entries(ГРУППЫ).sort(([, a], [, b]) => (a.нейтральный ? 2 : a.якорь ? 1 : 0) - (b.нейтральный ? 2 : b.якорь ? 1 : 0));
  for (const [группа, о] of порядок) {
    if (о.нейтральный) {
      // Нейтральные — почти серые, но с оттенком акцента, чтобы вписаться.
      палитра[группа] = hsl(смешатьТон(о.тон, акцент[0], .35), 16, светлаяТема ? 40 : 74);
      continue;
    }
    const источник = о.якорь && тема[о.якорь] ? вHsl(тема[о.якорь]) : null;
    // Цвет темы берём, только если он хроматический: серый «якорь» ничего
    // не говорит о тоне.
    let тон = источник && источник[1] > 18 ? источник[0] + (о.сдвиг || 0) : о.тон;
    // Смысловые группы (тревога, тело, планы, напряжение) лишь подтягиваются
    // к акценту — чтобы гармонировать, но не терять смысла.
    if (!о.якорь) тон = смешатьТон(о.тон, акцент[0], .07);
    // Разводим совпавшие тона: две группы одного цвета неотличимы.
    // Сдвигаем попеременно в обе стороны, всё дальше: так тон уходит от
    // занятого к ближайшему свободному, а не обходит круг.
    const исходный = тон;
    for (let шаг = 1; шаг < 16 && занято.some(т => Math.abs(((тон - т + 540) % 360) - 180) < 20); шаг++) тон = исходный + (шаг % 2 ? 1 : -1) * Math.ceil(шаг / 2) * 14;
    занято.push(тон);
    const S = о.якорь ? Sтемы : Math.max(Sтемы, 55);
    палитра[группа] = hsl(тон, S, L);
  }
  return { палитра, светлаяТема };
}

let последний = '';
export function обновитьПалитруГрупп() {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    const тема = читатьТему();
    const подпись = JSON.stringify(тема);
    if (подпись === последний) return;
    последний = подпись;
    const { палитра, светлаяТема } = собратьПалитру(тема);
    const root = document.documentElement;
    for (const [группа, цвет] of Object.entries(палитра)) root.style.setProperty('--hud-kind-' + группа, цвет);
    root.classList.toggle('hud-kinds-light', светлаяТема);
  } catch (e) { console.warn('[TavernOS HUD] палитра групп', e); }
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
