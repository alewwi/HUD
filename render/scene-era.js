// hud-manager/render/scene-era.js
//
// Облик сцены погоды по эпохе мира (era.js): технологии и магия.
// Доиндустриальную основу рисует сама сцена (render/scene.js, era-medieval),
// её старинные рисунки оформляются в css/scene-era.css.
// Модуль добавляет слой поверх сцены сезона (обликСцены) и светящиеся
// двойники в слой огней над ночным затемнением (огниОблика), а
// css/scene-era.css прячет то, чего в таком мире быть не может, — как
// средневековье прячет пляжный зонтик и сёрф.
//
//   технологии: primitive  — шатры из шкур, навес, хижины, долблёнка, вешала, менгиры;
//               industrial — кирпичные дома, фабрика, газовый фонарь, пароход,
//                            купальная кабинка, паровоз, дирижабль;
//               future     — купола, башни, световой столб, ховерборд, дроны,
//                            солнечный навес, ветряки, теплица-купол, робот-пугало;
//   магия:      high       — чары: башня мага, магический круг, дракон, кристаллы,
//                            метла, круг светящихся грибов, парящий остров, феи;
//               grounded   — дары и духи: каменный фонарь, лиса-дух, водяная дуга,
//                            бумажные фонарики на воде, вихрь листьев, олень-дух,
//                            парящие камни, придорожный алтарь;
//               hidden     — магия скрыта: намёк, днём едва заметный.
//
// Чистый генератор разметки: ни настроек, ни DOM.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

let счёт = 0;
const id = (п) => `hud-se-${п}-${(++счёт).toString(36)}`;
const р = (n) => (+n).toFixed(1).replace(/\.0$/, '');

/** Классы на виджете сцены: что прятать и как перекрашивать. */
export function классыОблика({ tech = 'modern', magic = 'none' } = {}) {
  const к = [];
  // Обычное средневековье без магии остаётся как его рисует сама сцена.
  if (tech && tech !== 'modern' && !(tech === 'preindustrial' && (!magic || magic === 'none'))) к.push('tech-' + tech);
  // Первобытным мирам тоже нечего делать с зонтиком и сёрфом.
  if (tech === 'primitive') к.push('era-medieval');
  if (magic && magic !== 'none') к.push('magic-' + magic);
  return к.join(' ');
}
/** Сцене сезона нужна разметка средневековья (избы, старый снеговик) — и первобытным тоже. */
export const сценаСтарины = ({ tech } = {}) => tech === 'preindustrial' || tech === 'primitive';

/* ─────────────────────────────── сборка ─────────────────────────────── */

let огни = null;
// Рисунок в сцене и, если есть, его светящийся двойник в слое огней.
function кусок(класс, [тело, свет = '']) {
  if (свет && огни) огни.push(`<div class="hud-se-p ${класс}">${свет}</div>`);
  return тело ? `<div class="hud-se-p ${класс}">${тело}</div>` : '';
}
const svg = (vb, тело) => `<svg viewBox="${vb}" overflow="visible">${тело}</svg>`;
// Сугроб у подножия: волной поперёк нижнего края рисунка — постройка стоит
// в снегу, а не висит над землёй.
function наСнегу([тело, свет = '']) {
  const [, , w, h] = ((тело.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 100 50').split(/\s+/).map(Number);
  const x = (k) => р(w * k), y = (k) => р(h - h * k), низ = р(h + 1);
  const сугроб = `<path d="M${x(-.08)} ${низ}Q${x(.12)} ${y(.16)} ${x(.3)} ${y(.1)}T${x(.62)} ${y(.12)}T${x(1.08)} ${низ}Z" fill="#edf2f9"/><path d="M${x(.02)} ${y(.06)}Q${x(.3)} ${y(.12)} ${x(.6)} ${y(.08)}" stroke="#c9d6e6" stroke-width=".8" fill="none"/>`;
  return [тело.replace(/<\/svg>$/, сугроб + '</svg>'), свет];
}

// Свет и тень внутри рисунков. Свои ID нужны, когда на стенде несколько сцен.
function заливка(g, верх, низ, средний = '') {
  return `<linearGradient id="${g}" x2=".38" y2="1"><stop stop-color="${верх}"/>${средний ? `<stop offset=".48" stop-color="${средний}"/>` : ''}<stop offset="1" stop-color="${низ}"/></linearGradient>`;
}

// Огоньки магии: в сцене — искры (видны днём), в огнях — свечение (ночью).
function огоньки(n, вид) {
  const точки = (кл) => `<div class="hud-se-motes is-${вид} ${кл}">${Array.from({ length: n }, (_, i) => `<i class="m${i + 1}"></i>`).join('')}</div>`;
  if (огни) огни.push(точки('is-glow'));
  return точки('is-day');
}

/* ──────────────────────────── чары (high) ──────────────────────────── */

function башняМага(снег) {
  const g = id('tw'), c = id('cr');
  const кристалл = 'M22 0l5.8 7.4L22 16l-5.8-8.6Z';
  const окна = 'M19.4 48a2.6 2.6 0 0 1 5.2 0v6h-5.2Zm-.6 19a3 3 0 0 1 6 0v7h-6Zm6.6 16a1.6 1.6 0 0 1 3.2 0v3h-3.2Z';
  const тело = `<defs><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" stop-color="#a4a0b8"/><stop offset=".55" stop-color="#7c7894"/><stop offset="1" stop-color="#55516e"/></linearGradient>`
    + `<linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fdff"/><stop offset=".5" stop-color="#7fe3ff"/><stop offset="1" stop-color="#6a5cff"/></linearGradient></defs>`
    + `<path d="M7 94q5-3 10-2h12l8 2-3 2H8Z" fill="#d4e1ef"/><path d="M10 94l3-5 3-49h12l3 49 4 5Z" fill="url(#${g})"/><path d="M25 40h3l3 52-5 1Z" fill="#4b4b68" opacity=".6"/><path d="M16 44l-3 46" stroke="#c8c9d9" opacity=".62"/>`
    + `<path d="M16 50h12M15.4 62h13.2M14.8 74h14.4M14.2 86h15.6M19 44v6M25 56v6M18 68v6M24 80v6" stroke="#3a3850" stroke-opacity=".45" stroke-width=".6"/>`
    + `<path d="M10 40.4h24l-2.4-3.4H12.4z" fill="#4a4760"/><path d="M11.4 40.4v2.4h2v-2.4M17 40.4v2.4h2v-2.4M25 40.4v2.4h2v-2.4M30.6 40.4v2.4h2v-2.4" fill="#4a4760"/>`
    + `<path d="M9 37Q17 29 22 17q6 13 13 20Z" fill="#62577e"/><path d="M22 17q6 13 13 20h-7z" fill="#3d365a"/><path d="M12 33.6h20M15 30h14M18 26.5h8" stroke="#d6bd99" stroke-opacity=".68" stroke-width=".7"/>`
    + (снег ? `<path d="M13.2 32.2L22 19.2l8.8 13c-2.4 1-4-.4-5.4-.8-1.8 1.2-3.8 1.6-6 .6-1.8 1-3.6 1.2-6.2 .2z" fill="#f4f8ff"/><path d="M10.6 40.2h22.8c-1 1.8-3.2 2-4.8 1.4-2 1-4.6 1-6.6.2-2 .8-4.8.8-6.8-.2-1.4.6-3.4.4-4.6-1.4z" fill="#f4f8ff"/>` : '')
    + `<path class="w" d="${окна}"/><path d="M22 47v7m0 12v8" stroke="#54617c" stroke-width=".8"/><path d="M18 94v-5a4 4 0 0 1 8 0v5Z" fill="#383148"/><path d="M16 94h12m-13 1h14" stroke="#a6a9b8" stroke-width=".8"/>`
    + `<g class="se-lift"><path d="${кристалл}" fill="url(#${c})"/><path d="M22 0v16m-5.8-8.6 5.8 1.1 5.8-1.1" stroke="#fff" stroke-opacity=".7" stroke-width=".65"/></g><ellipse cx="22" cy="27" rx="17" ry="3.6" class="ring"/>`;
  const свет = `<g class="se-lift"><circle cx="22" cy="8" r="15" class="gl-cyan"/><path d="${кристалл}" class="hot-cyan" opacity=".65"/></g>`
    + `<path d="${окна}" class="hot-cyan" opacity=".68"/>`
    + `<circle cx="22" cy="48" r="7" class="gl-cyan s"/><circle cx="22" cy="67" r="8" class="gl-cyan s"/><ellipse cx="22" cy="27" rx="17" ry="3.6" class="ring-gl"/>`;
  return [svg('0 0 44 96', тело), svg('0 0 44 96', свет)];
}

function магКруг(тихо) {
  const знаки = ['M-1.5 1.4 0-1.4l1.5 2.8M-.8 .3H.8', 'M0 1.3v-2.6l1.4 1L0 .2', 'M-1.5-1.2 0 .2l1.5-1.4M0 .2v1.2'];
  const руны = Array.from({ length: 16 }, (_, i) => {
    const угол = i * Math.PI / 8;
    return `<path d="${знаки[i % знаки.length]}" transform="translate(${р(60 + Math.cos(угол) * 49)} ${р(12 + Math.sin(угол) * 8.5)}) scale(1 .65)"/>`;
  }).join('');
  const контур = '<ellipse cx="60" cy="12" rx="55" ry="9.8"/><ellipse cx="60" cy="12" rx="43" ry="7.2"/>';
  const печать = '<path d="M60 5 72 10 101 12 72 14 60 19 48 14 19 12 48 10ZM60 8l10 4-10 4-10-4Z"/>';
  return [svg('0 0 120 24', `<g class="${тихо ? 'lines faint' : 'lines'}">${контур}${печать}${руны}</g>`),
    svg('0 0 120 24', `<ellipse cx="60" cy="12" rx="56" ry="9" class="gl-violet se-breathe"/><g class="lines-gl">${контур}${печать}${руны}<ellipse class="se-circle-flow" cx="60" cy="12" rx="43" ry="7.2" pathLength="100"/></g>`)];
}

function дракон() {
  const g = id('dw');
  return [svg('0 0 80 36', `<defs>${заливка(g, '#8a779f', '#322a48', '#615277')}</defs>`
    + `<path fill="#504561" d="M41 20C51 9 60 6 72 5c-7 4-9 7-10 10-6-1-12 1-17 7Z"/>`
    + `<path fill="url(#${g})" d="M2 29c12 3 17-9 29-10 7-1 14 5 21 1 5-2 5-8 12-8l4-4-1 5 7 2 3 3-6 2-7-1c-4 8-11 11-22 9l-10-1c-12-4-18 9-30 2Z"/>`
    + `<g class="se-wing"><path fill="url(#${g})" d="M41 23C34 20 20 12 12 1c12 4 22 0 31 2-3 3-2 6 3 9 4-2 8-2 14 0-8 2-12 5-19 11Z"/><path d="M15 3Q33 10 41 23M41 4q-3 7 0 19" fill="none" stroke="#cfb7dc" stroke-width=".65" opacity=".55"/></g>`
    + `<path d="M4 29c11 3 18-9 27-8m21 3q7-1 10-7m-12 8-4 5-3-1m-8-2-4 3-3-1" fill="none" stroke="#cfb7dc" stroke-width=".8" opacity=".55"/><path d="M53 20l-2-4-2 5m9-4v-4l-2 5m7-6 2-3v4" fill="#8b739b"/><circle cx="70" cy="16.5" r="1" class="d-eye"/>`)];
}

function кристаллы() {
  const g = id('kr');
  return [svg('0 0 34 28', `<defs>${заливка(g, '#e6fbff', '#5455a4', '#84b9d9')}</defs><path d="M2 25l5-4 7 1 5-3 9 2 4 4-6 2H7Z" fill="#70647a"/>`
      + `<path fill="url(#${g})" d="M4 23 3 13l4-3 5 5 1 10Zm9 1L11 8l4-7 7 4 1 16-4 5Zm8 1 3-14 5-3 2 7-4 11Z"/>`
      + `<path d="m15 1 2.5 8 2 17 3.5-5-1-16Zm14 7-3 7-2 11 3 .1 4-11ZM7 10l1 8 2 7h3l-1-10Z" fill="#5c66ae" fill-opacity=".55"/><path d="M11 8l6.5 1L22 5M3 13l5 5 4-3m12-4 2 4 5-.1" fill="none" stroke="#e9f7ff" stroke-width=".65"/><path d="m5 26 4-1m13 1 4-1m-11 .7 2-2" stroke="#ba9aab" stroke-width=".7"/>`),
    // Свечение — мягкое, по силуэту кристаллов, и две искры на верхушках:
    // прежние штрихи по граням светились ночью жёсткими белыми полосами.
    svg('0 0 34 28', `<ellipse cx="17" cy="18" rx="16" ry="11" class="gl-cyan"/><path class="gl-core" d="M4 23 3 13l4-3 5 5 1 10Zm9 1L11 8l4-7 7 4 1 16-4 5Zm8 1 3-14 5-3 2 7-4 11Z"/><path class="gl-tw" d="M15 -.8v3.6M13.2 1h3.6M29 6.2v2.8M27.6 7.6h2.8"/>`)];
}

function метла() {
  const g = id('cloak'), d = id('dress');
  const искры = '<path d="M5 31h4m-2-2v4m8 2h5m-2.5-2.5v5m7-9h4m-2-2v4"/>';
  return [svg('0 0 96 40', `<defs>${заливка(g, '#5d4683', '#241a36', '#3d2d5a')}${заливка(d, '#6a4f95', '#33264d')}</defs>`
      + `<path class="b-trail" d="M2 31q12-6 24-1M7 36q9-4 18-2"/><g class="b-spark">${искры}</g>`
      // древко чуть вверх по ходу полёта, метёлка сзади, перевязь
      + '<path d="M22 30.5 88 21.5" stroke="#5a3d26" stroke-width="2.6" stroke-linecap="round"/><path d="M24 29.6 86 21" stroke="#9a7348" stroke-width=".7"/>'
      + '<path d="M24 30.6Q15 26 6 29l5 1.6L4 33l7 .4L5 37q11-1 19-5.4Z" fill="#c99a52"/><path d="M8 30.6q8-.6 15 .2M7 34q8-1.4 16-2.6" stroke="#8e6a34" stroke-width=".6" fill="none"/><path d="m22.6 28.4 1.4 4.4" stroke="#6b4a2b" stroke-width="1.6"/>'
      // плащ развевается назад
      + `<path class="se-cloak" fill="url(#${g})" d="M55 13q-7 1-12 6-5 3-11 3 5 3 11 2-3 3-7 4 9 1 17-5l5-7Z"/>`
      // юбка: сидит на древке, ткань свисает по обе стороны
      + `<path fill="url(#${d})" d="M53 14h8l3 9 2 5-6 2.4-9 .6-3-1.4 2-6Z"/><path d="M50 28.6q6 1.4 15-.8" stroke="#8d74b8" stroke-width=".7" fill="none"/>`
      // ноги: дальняя чуть позади, ближняя вперёд, сапоги носком по ходу
      + '<path d="M56 29.4 57 35" stroke="#2c2233" stroke-width="2.2" stroke-linecap="round"/><path d="M55.6 34.6h3.6l1.8 1.6-.4 .8h-5Z" fill="#1f1820"/>'
      + '<path d="M61.5 28.6 65 34" stroke="#3a2d40" stroke-width="2.4" stroke-linecap="round"/><path d="M63.4 33.4l3.4-.6 2.6 1.6-.2 .9-5.2.4Z" fill="#2a1f2a"/>'
      // рука к древку
      + '<path d="M59 16.4q4 3 9.6 4.4" stroke="#4a3566" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="69" cy="21.4" r="1.3" fill="#e8c3a0"/>'
      // голова: волосы назад, лицо в профиль, нос
      + '<path d="M55.6 9q-4 1-6 6 3-1 5-1Z" fill="#3a2a2a"/><circle cx="58.6" cy="10.2" r="3.1" fill="#e8c3a0"/><path d="M61.5 10.2l1.4.8-1.4.4" fill="#e1b48e"/><circle cx="60" cy="9.6" r=".45" fill="#2a1f2a"/>'
      // шляпа: поля и колпак с заломом назад
      + '<path d="M51.4 8.2q7.6-2.4 14.6-.6-7 1.8-14.6.6Z" fill="#2a2036"/><path d="M54.4 7.4q.6-5 2-8 2-3.6-3.4-5.6 6 .2 7 4.6 1 3.6 1.2 8.4Z" fill="#30243f"/><path d="M54.6 6.2q3.4-.8 6.4-.2" stroke="#b48cff" stroke-width="1.1" fill="none"/>'),
    svg('0 0 96 40', `<path class="trail-gl" d="M2 31q12-6 24-1"/><g class="b-spark">${искры}</g>`)];
}

function грибнойКруг(тихо, весна = false) {
  const места = Array.from({ length: 9 }, (_, i) => {
    const a = i / 9 * Math.PI * 2 + .3, глубина = Math.sin(a);
    return [40 + Math.cos(a) * (весна ? 31 : 34), 13 + глубина * (весна ? 5 : 6.8), (весна ? .72 : .9) + глубина * .2 + (i % 3) * .08];
  }).sort((a, b) => a[1] - b[1]);
  const грибы = места.map(([x, y, s], i) => `<g transform="translate(${р(x)} ${р(y)}) scale(${р(s)}) rotate(${i % 3 * 5 - 5})"><ellipse cy=".25" rx="3.8" ry=".9" fill="#503d48" opacity=".45"/><path class="f-stem" d="M-1.3 0q1-3 .5-4.4h2Q.7-1 1.4 0Z"/><path class="f-cap" d="M-4.6-3.8q1-4.2 4.5-4.2 3.7 0 4.6 3.8-4 1.5-9.1.4Z"/><path d="M-3.6-3.6q3.8 .9 7.4-.3" stroke="#e2bfcf" opacity=".7" stroke-width=".6" fill="none"/><circle class="f-dot" cx="-1.4" cy="-5.4" r=".6"/><circle class="f-dot" cx="1.6" cy="-4.8" r=".5"/></g>`).join('');
  const свет = места.map(([x, y, s]) => `<circle cx="${р(x)}" cy="${р(y - 4 * s)}" r="${р(5 * s)}" class="${тихо ? 'gl-violet faint' : 'gl-violet'}"/>`).join('');
  return [svg('0 0 80 24', `<g class="${тихо ? 'fring faint' : 'fring'}">${грибы}</g>`), svg('0 0 80 24', свет)];
}

function парящийОстров() {
  const g = id('is'), w = id('wf');
  return [svg('0 0 80 66', `<defs>${заливка(g, '#989587', '#534e62', '#716c65')}`
      + `<linearGradient id="${w}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4f6ff"/><stop offset="1" stop-color="#d4f6ff" stop-opacity="0"/></linearGradient></defs>`
      + `<path d="M8 24q17-4 64 0l-6 8-8 10-8 12-6 6-6-7-8-6-9-11-7-4Z" fill="url(#${g})"/><path d="m14 29 11 3 11 1 10-3 13 1 7-3m-43 10 13 4 11-2 10 1m-26 6 11 3 11-2" stroke="#bcad95" opacity=".53" stroke-width="1" fill="none"/>`
      + `<path d="M9 24l19 2 8 4-4 14-9-7Zm39 2 24-2-14 18-8 12 2-19Z" fill="#3d384b" opacity=".26"/><path d="M20 30l4 8M36 30l2 14M52 30l-3 10M44 44l-2 8" stroke="#cec1a5" stroke-opacity=".45" stroke-width=".85"/>`
      + `<path class="i-grass" d="M6 24c4-5 12-7 20-7 6-3 14-4 22-2 8-1 16 2 26 9-20 3-48 3-68 0z"/>`
      + `<path d="M55 21l1-11m-1 8-3-6m4 5 3-4" stroke="#5a4232" stroke-width="1.4" fill="none"/><path class="i-leaf" d="M48 11q-3-4 1-6 0-4 5-4 4-2 6 2 4 0 4 4 3 3-1 6-4 1-9 0-4 2-6-2Z"/><path class="i-leaf l2" d="M49 10q7 3 14-2l1 3-4 2-7-.3Z"/><path d="M29 22q6-2 18-1m-24 3q10-1 23 0" fill="none" stroke="#d4be93" stroke-opacity=".7" stroke-width="1"/>`
      + `<path d="M21 19.6h9v-5.6l-4.5-3.4-4.5 3.4z" fill="#ece3d2"/><path d="M20 14.6l5.5-4.4 5.5 4.4" fill="none" stroke="#5a3f7a" stroke-width="1.6" stroke-linejoin="round"/><rect x="24.4" y="15.4" width="2.4" height="4.2" class="w"/>`
      + `<path d="M67 24q1 14-2 31l4 11q2-25 2-41Z" fill="url(#${w})"/><path class="se-waterflow" d="M69 25q-1 14 0 27" pathLength="100" stroke="#e1f6ff" stroke-opacity=".75" stroke-width="1" stroke-dasharray="11 14" fill="none"/><ellipse cx="68" cy="54" rx="5" ry="1.5" fill="#d6eef3" opacity=".35"/>`
      + `<path class="i-rock" d="M14 40l4 1-1 3-3-1zM60 48l3 .4-.6 2.6-2.6-.6zM28 56l2.4.4-.4 2-2-.4z"/>`),
    svg('0 0 80 66', `<rect x="24.4" y="15.4" width="2.4" height="4.2" class="hot"/><circle cx="25.6" cy="17" r="5" class="gl-amber"/>`)];
}

function феи() {
  const ф = (i) => `<i class="hud-se-fairy f${i}"><svg viewBox="0 0 18 14" overflow="visible"><g class="fw"><path d="M9 8Q2 8 1 2q5-1 8 6Zm0 0q7 0 8-6-5-1-8 6ZM9 8q-1 5-5 4-2-2 5-4Zm0 0q1 5 5 4 2-2-5-4Z"/><path class="fairy-veins" d="M3 3q4 1 6 5m6-5q-4 1-6 5m-4 3 4-3 4 3"/></g><path class="fb" d="M9 5q2 2 0 5-2-3 0-5Z"/><circle cx="9" cy="5" r=".9" fill="#fff9dc"/></svg></i>`;
  const тела = [1, 2, 3, 4].map(ф).join('');
  if (огни) огни.push(`<div class="hud-se-fairies is-glow">${[1, 2, 3, 4].map(i => `<i class="hud-se-fairy f${i}"><svg viewBox="0 0 18 14" overflow="visible"><circle cx="9" cy="7.4" r="7" class="gl-amber"/></svg></i>`).join('')}</div>`);
  return `<div class="hud-se-fairies">${тела}</div>`;
}

/* ──────────────────────── дары и духи (grounded) ────────────────────── */

function каменныйФонарь(снег) {
  const g = id('lantern');
  return [svg('0 0 26 44', `<defs>${заливка(g, '#b2ab9b', '#555958', '#838177')}</defs><path d="M5 44h16l-2-4H7zM10 40V28h6v12ZM6 28h14l-2-3H8Z" fill="url(#${g})"/><path d="M8 41h9m-5-12v10m-5-12h12" stroke="#d0c7ae" stroke-width=".7" opacity=".63"/>`
      + `<path d="M6 25V15h12l3 2v8l-3 1Z" fill="url(#${g})"/><path d="M18 15l3 2v8l-3 1Z" fill="#535c58"/><path class="w" d="M9 23v-5l1-1h5l1 1v5Z"/><path d="M12.5 17v6m-3.5-2.5h7" stroke="#655d54" stroke-width=".8"/>`
      + `<path d="M2 15l11-7 11 7-4 2-14-.3Z" fill="#606761"/><path d="m2 15 11-7 6 8" stroke="#a8a592" stroke-width=".8" fill="none"/><path d="M13 8V4" stroke="#5f5b57" stroke-width="2" stroke-linecap="round"/><circle cx="13" cy="3.4" r="1.8" fill="#77796e"/>`
      + `<path d="M4 20h-1M23 20h-1" stroke="#7d7872"/>`
      + (снег ? `<path d="M2.6 14.6L13 8.2l10.4 6.4c-2 .6-3.4-.2-4.4-.6-1.6.8-3.4 1-5.2.2-1.8.8-3.6.8-5.2 0-1.2.6-2.4.8-6-.4z" fill="#f4f8ff"/><path d="M5.6 28h14.8c-.8 1-2.4 1.2-3.6.6-1.4.8-3.4.8-4.8 0-1.4.8-3.4.8-6.4-.6z" fill="#f4f8ff"/>` : '')),
    svg('0 0 26 44', `<circle cx="13" cy="20" r="14" class="gl-amber"/><path class="hot" d="M9.6 23v-6h6.8v6z"/>`)];
}

function лисаДух() {
  const g = id('fox');
  const хвост = 'M29 29q-8 8-19 4Q2 30 3 22q2 4 8 4-2-4-1-7 4 6 11 7l6-2Z';
  return [svg('0 0 48 36', `<defs>${заливка(g, '#eef8f3', '#47717e', '#a1c9c5')}</defs><ellipse cx="26" cy="34" rx="19" ry="1.7" fill="#557783" opacity=".26"/>`
      + `<path d="M17 30q-2-9 7-13l7-3 2-11 4 6 5-6-1 8 5 4 1 3-8 1-3 4-2 10h-3v-8l-4 7h-9Z" fill="url(#${g})" stroke="#567f86" stroke-width=".7"/><g class="se-tail"><path d="${хвост}" fill="url(#${g})" stroke="#668d93" stroke-width=".65"/><path d="M3 22q2 4 8 4l-1 6q-6-2-7-10Z" fill="#ecfbf2"/><path d="M7 28q6 5 13 2" fill="none" stroke="#7fb5b6" stroke-width="1.1"/></g>`
      + `<path d="M31 15q3 2 9 1l7 2-9 2-4 5-4-2Z" fill="#ecfbf2" opacity=".9"/><path d="m34 5 1 5 2-1m4-3-2 4 2 1m-16 10-3 3m6-2-3 4" stroke="#79b8b1" stroke-width="1" fill="none"/><path d="m40 14 2-.6" stroke="#304c55" stroke-width="1.2" stroke-linecap="round"/>`),
    svg('0 0 48 36', `<ellipse cx="24" cy="21" rx="21" ry="12" class="gl-teal se-breathe"/><path class="se-tail" d="${хвост}" fill="#b8fff0" opacity=".27"/><path d="M33 3l4 6 5-6m-2 11 2-.6" fill="none" stroke="#dafff4" stroke-width=".9" opacity=".65"/>`)];
}

function водянаяДуга() {
  const g = id('wa');
  const дуга = 'M6 46C20 10 54 2 74 14s30 26 40 32';
  return [svg('0 0 120 50', `<defs><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" stop-color="#bff3ff" stop-opacity="0"/><stop offset=".25" stop-color="#bff3ff" stop-opacity=".9"/><stop offset=".75" stop-color="#7fd8ff" stop-opacity=".9"/><stop offset="1" stop-color="#7fd8ff" stop-opacity="0"/></linearGradient></defs>`
      + `<path d="M5 45Q25 3 59 10q32 2 56 36l-4 1Q85 19 63 16 30 9 9 47Z" fill="url(#${g})" opacity=".56"/><path d="${дуга}" fill="none" stroke="url(#${g})" stroke-width="2.9" stroke-linecap="round"/><ellipse class="se-splash" cx="8" cy="47" rx="6" ry="1.25" fill="none" stroke="#ecfaff" stroke-opacity=".8"/><ellipse class="se-splash" cx="112" cy="47" rx="6" ry="1.25" fill="none" stroke="#ecfaff" stroke-opacity=".8"/>`
      + `<path d="M10 44C24 14 54 7 72 17" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1" stroke-linecap="round"/>`
      + `<path class="se-waterflow" d="${дуга}" pathLength="100" fill="none" stroke="#edfbff" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 8 1 12 3 24"/><path d="M2 48q8-2 15 0m86 0q7-2 15 0" fill="none" stroke="#d7f7fb" opacity=".58"/><g class="a-drops"><circle cx="40" cy="12" r="1.3"/><circle cx="58" cy="9" r="1"/><circle cx="86" cy="22" r="1.2"/><circle cx="100" cy="34" r=".9"/><circle cx="24" cy="26" r="1"/></g>`),
    svg('0 0 120 50', `<path d="${дуга}" class="arc-gl"/>`)];
}

function фонарикиНаВоде() {
  const места = [[10, 10, .63], [32, 6, .5], [58, 13, .72], [82, 5, .44], [108, 10, .53]];
  const g = id('paper');
  const бумага = 'M-4-4q4-2 8 0 3 3 .9 7-4.9 1.8-9.8 0Q-7-1-4-4Z';
  const фонарь = `<path d="${бумага}" fill="url(#${g})"/><path d="M-4-4q4 1.2 8 0M-5 2q5 1.2 10 0M-.7-4q-1.3 3 0 7m3-7q1.3 3 0 7" fill="none" stroke="#ffd5a1" stroke-width=".65" opacity=".8"/><path class="p-cap" d="M-3.5-5.6h7v1.2h-7ZM-6 3q6 2 12 0l-1.6 2h-8.8Z"/>`;
  const разложить = содержимое => места.map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})">${содержимое}</g>`).join('');
  return [svg('0 0 120 18', `<defs>${заливка(g, '#f9bc7b', '#8d4f50', '#de8257')}</defs>${разложить(фонарь + '<path class="p-refl" d="M-8 6q8 1.4 16 0m-13 2h9" fill="none" stroke="#db9278" stroke-width="1.15"/>')}`),
    svg('0 0 120 18', разложить(`<ellipse cx="0" cy="0" rx="8" ry="7" class="gl-amber"/><path class="hot-amber se-breathe" d="${бумага}" opacity=".65"/><ellipse cx="0" cy="7.5" rx="4.5" ry="1" class="hot-amber" opacity=".52"/>`))];
}

function вихрьЛистьев() {
  const листья = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12, a = t * Math.PI * 4.2, r = 6 + t * 15;
    const x = 24 + Math.cos(a) * r, y = 72 - t * 66 + Math.sin(a) * r * .28;
    const цвет = ['#d9904e', '#dcb06c', '#a65d49', '#bf8450'][i % 4];
    return `<g transform="translate(${р(x)} ${р(y)}) rotate(${i * 47 % 360}) scale(${р(1 - t * .3)})"><path d="M0-3.4q4 2 0 6.8-3.6-1.8 0-6.8Z" fill="${цвет}"/><path d="M0-2.6Q1 0-1 3" stroke="#f6d498" stroke-width=".5" fill="none"/></g>`;
  }).join('');
  return [svg('0 0 48 78', `<path class="v-gust se-waterflow" pathLength="100" d="M24 76c-12-2-14-8-4-10s14-6 2-10-12-10 0-12 8-8-2-12-4-10 6-12"/><g class="se-leaves">${листья}</g>`)];
}

function оленьДух() {
  const g = id('deer');
  const контур = 'M6 23q4-6 13-4l9 1q4-1 6-9l5-2 4 2 4 5-4 1-5-2-1 9-5 4-2 12h-2l1-13q-6 3-13 0l-3 4-4 9H7l3-12q-3-1-4-5l-4-2Z';
  const рога = '<path class="o-horn" d="M39 11q-2-4-1-10m0 5-4-3m5 3 4-3m-5 6-6-2m10 2 3-5"/>';
  return [svg('0 0 48 42', `<defs>${заливка(g, '#f4fff0', '#6da8a0', '#a1d8c9')}</defs><ellipse cx="20" cy="39" rx="16" ry="2" fill="#3e6f68" opacity=".23"/>`
      + `<path d="M13 24l3 7-1 8m15-15 4 6v8" fill="none" stroke="#83b8ad" stroke-width="1.8"/><path d="${контур}" fill="url(#${g})"/>${рога}<path d="M10 23q6-4 15-1t10-6m-2 10q3-4 4-8" fill="none" stroke="#eefcf3" stroke-opacity=".72" stroke-width=".9"/><path d="M34 14q-5 0-5-3 4 0 5 3Z" fill="#b8dccc"/><circle cx="42" cy="13" r=".8" fill="#496d70"/><path d="M7 39h3m16 0h3m11-23h2" stroke="#638f87" stroke-width=".85"/>`),
    svg('0 0 48 42', `<ellipse cx="24" cy="21" rx="23" ry="17" class="gl-teal"/><path d="${контур}" class="hot-teal" fill-opacity=".24" stroke-opacity=".28"/>${рога}`)];
}

function парящиеКамни() {
  // Три валуна висят над землёй: светлая верхняя грань, тёмное днище,
  // крошки земли осыпаются вниз, на траве — их тени.
  const камни = [
    ['M8 22L12 15l8-2 6 4-1 8-7 5-7-2z', 'M8 22L12 15l8-2-2 5-7 3z', 'M11 28l7 2 7-5-3-1-7 2z', [[15, 34], [19, 39], [14, 44]]],
    ['M32 12l5-7 10-2 7 6-2 9-9 5-8-3z', 'M32 12l5-7 10-2-3 6-9 4z', 'M35 20l8 3 9-5-5-1-7 2z', [[42, 28], [46, 33], [40, 37], [44, 42]]],
    ['M58 19l4-5 7-1 4 4-2 6-7 3-5-2z', 'M58 19l4-5 7-1-2 4-6 3z', 'M59 24l5 2 7-3-3-1-5 1z', [[64, 30], [67, 36], [63, 41]]],
  ];
  const граница = id('rock');
  const жилы = ['M11 23l5-1 3 2 4-1', 'M34 14l7-2 4 2 5-1', 'M60 21l5-1 4 1'];
  const тело = камни.map(([все, верх, низ, крошки], i) => `<g class="se-lift" style="--se-delay:${-i * 1.4}s"><path d="${все}" fill="url(#${граница})"/><path d="${верх}" fill="#b9af92"/><path d="${низ}" fill="#645a54"/><path d="${жилы[i]}" stroke="#acd3bd" stroke-opacity=".7" stroke-width=".8" fill="none"/>`
    + крошки.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k ? .7 : 1}" fill="#948975" opacity="${1 - k * .2}"/>`).join('') + '</g>').join('');
  const тени = '<ellipse cx="17" cy="47" rx="8" ry="1.6"/><ellipse cx="43" cy="47.4" rx="10" ry="1.8"/><ellipse cx="65" cy="47" rx="7" ry="1.4"/>';
  return [svg('0 0 80 50', `<defs>${заливка(граница, '#a69c8b', '#5d5958', '#8b8577')}</defs><g fill="rgba(40,50,30,.28)">${тени}</g>${тело}`)];
}

function алтарьДухов() {
  return [svg('0 0 30 40', `<path d="M12 39V24h4v15z" fill="#795c47"/><path d="M16 38V24h2v14z" fill="#55463a"/><path d="M5 24v-9l17-1 4 3v6l-5 2Z" fill="#977250"/><path d="M22 14l4 3v6l-5 2Z" fill="#624936"/><path d="M2 16 12 7l8 2 8 8-7 1Z" fill="#4b4646"/><path d="m3 15 9-8 9 10m-6-8 11 7" fill="none" stroke="#bea27a" stroke-width=".75"/><path d="M8 22h13v-5H8z" fill="#3b2f28"/>`
      + `<path d="M10 22q5 1 10 0l-1 2h-8Z" fill="#b08c69"/><path class="w" d="M14 21q-1-1 .2-3l1.2-2 1.2 2q1.2 3-2.6 3Z"/><path d="M5 14.2c3 1.6 7 2 10 2s7-.4 10-2" fill="none" stroke="#e8d9b0" stroke-width="1.1"/>`
      + `<path class="se-cloth" d="M8 15.6l-1 4 2-1.4M14 16.4l-1 4 2-1.4M20 15.8l-1 4 2-1.4" fill="none" stroke="#f4efe2" stroke-width=".8"/><path d="M9 39h11l3-2" stroke="#695949" stroke-width="2" fill="none"/>`),
    svg('0 0 30 40', `<circle cx="15" cy="19.4" r="9" class="gl-amber"/><circle cx="15" cy="19.4" r="1.8" class="hot"/>`)];
}

/* ─────────────────────────── технологии ─────────────────────────── */

function шатёр(вариант) {
  const g = id('tent');
  const шкуры = [['#e0b47b', '#71503d', '#b68d64'], ['#c5ab89', '#675044', '#a0846b'], ['#c4aa92', '#69544f', '#9b8679']];
  return [svg('0 0 50 44', `<defs>${заливка(g, ...шкуры[вариант])}</defs><path d="M25 0l-3 6M25 0l3 6M25 0l-6 3M25 0l6 3" stroke="#5a3e24" stroke-width="1.2" stroke-linecap="round"/>`
      + `<path d="M25 4Q16 26 3 43q22 3 44 0Q34 26 25 4Z" fill="url(#${g})"/><path d="M25 4Q34 26 47 43l-15 1Z" fill="#654432" opacity=".42"/><path d="M24 8 9 40m17-28 7 28m-24 1q18 2 34 0" stroke="#eaca94" stroke-width=".6" fill="none" opacity=".65"/>`
      + `<path d="M12 28l4 2M34 26l4 2M18 38l5 1M29 18l3 2M14 34c4-1 7 0 9 2" stroke="#5f4328" stroke-width=".9" stroke-linecap="round" fill="none"/>`
      + `<path d="M25 44l-5-14h10z" fill="#382920"/><path class="w" d="M25 44l-3-9h6z"/><path d="M25 9 2 41m23-30 22 30M2 39v4m45-4v4" stroke="#69584b" stroke-width=".65" fill="none"/>`
      + `<path d="M25 4L14 24c3 1 5-1 6-3 2 1 4 0 5-2 2 2 4 2 6 1 1 2 3 3 5 3z" fill="#f4f8ff"/><path d="M6 42q8 2 16 1m7 0q9 1 15-1" stroke="#d4e2ef" stroke-width="1.25" fill="none"/>`),
    svg('0 0 50 44', `<path class="hot-fire" d="M25 44l-3-9h6z"/><ellipse cx="25" cy="42" rx="12" ry="7" class="gl-fire"/>`)];
}
function осеннийНавес() {
  const g = id('hide');
  return [svg('0 0 72 53', `<defs>${заливка(g, '#d7ad70', '#755041', '#ae8055')}</defs>`
      + `<ellipse cx="36" cy="49" rx="33" ry="3.5" fill="#58412e" opacity=".33"/><path d="M15 25 7 47l34 5 22-10-5-23Z" fill="#77553e"/><path d="M41 52V25l17-6 5 23Z" fill="#5b4236"/>`
      + `<path d="M1 30 21 7l28-5 22 26-31 11Z" fill="url(#${g})"/><path d="M21 7 40 39l31-11L49 2Z" fill="#554034" opacity=".34"/><path d="m4 29 17-21 27-5m-22 11 27-6m-22 13 28-7m-22 15 28-8" stroke="#f2c688" stroke-width=".8" opacity=".55" fill="none"/>`
      + `<path d="M10 32 8 47m31-8 2 12m14-18 1 11" fill="none" stroke="#50392b" stroke-width="2.2" stroke-linecap="round"/><path d="M17 46V34q7-6 15 4v10Z" fill="#3c2e29"/><path d="M19 46v-9q5-3 10 2v8Z" class="w"/>`
      + `<path d="M21 8 7 46M49 3l16 40" stroke="#625043" fill="none" stroke-width=".7"/><path d="m9 42 29 5m6-2 15-5" stroke="#ae8055" stroke-width=".75"/><path d="m7 29 28 8m5 1 28-10m-8-11 3 3m-11-1 2 2" stroke="#dec097" fill="none" stroke-width="1" stroke-dasharray="1.2 1.7"/><path d="M18 35q2-3 5-2l-.8 11-3.7 .3Z" fill="#b3875b"/>`),
    svg('0 0 72 53', '<ellipse cx="25" cy="46" rx="13" ry="6" class="gl-fire"/><path class="hot-fire se-breathe" d="M19 46v-9q5-3 10 2v8Z"/>')];
}
function хижина() {
  const g = id('thatch');
  return [svg('0 0 46 34', `<defs>${заливка(g, '#d8c18a', '#786043', '#b49a63')}</defs><path d="M4 34V20h38v14z" fill="#8a6a46"/><path d="M4 22h38M4 26h38M4 30h38" stroke="#6a4e30" stroke-width=".7"/>`
      + `<path d="M0 21C6 6 40 6 46 21c-6 3-40 3-46 0z" fill="url(#${g})"/><path d="M9 14 5 21m10-9-3 10m8-11-1 11m6-11 1 12m4-12 3 11m2-9 5 8" stroke="#f4d6a0" stroke-opacity=".6" stroke-width=".8" fill="none"/>`
      + `<path d="M19 34v-9a4 4 0 0 1 8 0v9z" fill="#3a2a20"/><path d="M4 32q19 3 37 0M5 23q17 4 36 0M7 17q15 3 31 0" stroke="#dfb680" stroke-opacity=".62" fill="none" stroke-width=".85"/><path d="M24 13l12 7m-13-5 5 5m-6-7-4 6m-1-6-6 6" stroke="#785b42" stroke-width=".65"/>`),
    svg('0 0 46 34', `<ellipse cx="23" cy="32" rx="10" ry="4" class="gl-fire"/><path class="hot-fire" d="M20.4 34v-8.4a2.6 2.6 0 0 1 5.2 0V34z"/>`)];
}
function долблёнка() {
  const g = id('dugout');
  return [svg('0 0 90 20', `<defs>${заливка(g, '#a88556', '#594135')}</defs><ellipse cx="46" cy="18" rx="44" ry="2.6" fill="#49322259"/>`
    + `<path d="M2 8Q34 3 88 8c-2 6-10 10-43 10S4 14 2 8Z" fill="url(#${g})"/><path d="M4 8q35-5 82 0-32 7-82 0Z" fill="#51382c" stroke="#bd9462" stroke-width=".75"/><path d="M27 7v3l3 .4V7m21-1v5h4V6" stroke="#b78958" stroke-width="1.1"/>`
    + `<path d="M14 14c10 2 50 2 62 0m-55 1.5q16 1.9 34 .6m9-.6 7-.9" stroke="#c29c69" stroke-opacity=".56" stroke-width=".8" fill="none"/><path d="M58 4L80 16" stroke="#7a5634" stroke-width="1.6" stroke-linecap="round"/><path d="M78 13l6 5-7-1z" fill="#6b4a2b"/><path d="M2 8q4-3 8-1m77 1-6-1" stroke="#d4aa77" stroke-width=".8" fill="none"/>`)];
}
function вешала() {
  const рыба = (x, y) => `<g class="se-cloth"><path d="M${x} 9v${y - 7}" stroke="#b8a17d" stroke-width=".55"/><path d="M${x} ${y}c2.2 2 2.2 6.4 0 9.4-2.2-3-2.2-7.4 0-9.4Z" fill="#b8b3a2" stroke="#7d786a" stroke-width=".4"/><path d="m${x - 1.6} ${y + 11.4} 1.6-3 1.6 3Z" fill="#969382"/></g>`;
  return [svg('0 0 70 44', `<path d="M6 44L14 6M26 44L14 6M44 44L56 6M66 44L56 6" stroke="#6b4a2b" stroke-width="2" stroke-linecap="round"/>`
    + `<path d="M10 9h50" stroke="#7a5634" stroke-width="2" stroke-linecap="round"/><path d="M8 40 15 7m30 33L55 7m-44 1 6 4m37-4 5 3" stroke="#c7a274" stroke-width=".9"/>${[18, 24, 30, 36, 42, 48].map((x, i) => рыба(x, 10 + (i % 2))).join('')}`)];
}
function менгиры() {
  const g = id('menhir');
  return [svg('0 0 60 30', `<defs>${заливка(g, '#b0a99a', '#6c6563')}</defs><path d="M6 28 5 13l3-5 5 2v17Zm13 2V7l4-4 6 3-1 24Zm17-1 1-20 4-3 4 4-1 19Zm14 0-1-12 3-4 4 2v14Z" fill="url(#${g})"/>`
    + `<path d="M24 7l5-1-1 24h-4Zm16 4 5-1-1 19h-4Z" fill="#645e5e" opacity=".56"/><path d="m17 5 3-4 10-1 3 4-3 2-12 .6Z" fill="#969084"/><path d="m6 23 4-2m10-7 4-1m13 11 5-2m9 2 3-3" stroke="#849174" stroke-width=".9"/><path d="m7 14 3-3m11 7 2 2-3 4m19-10 2-3m9 8 2-3" fill="none" stroke="#d0c2ab" stroke-width=".75"/>`)];
}

function кирпичныйРяд(снег) {
  const g = id('brick');
  const окна = [6, 18, 30, 46, 58].flatMap(x => [16, 28].map(y => ({ x, y, контур: `M${x} ${y + 7}v-4.5a2.5 2.5 0 0 1 5 0v4.5Z` })));
  const ок = окна.map(({ контур }) => `<path d="${контур}"/>`).join('');
  const рамы = окна.map(({ x, y }) => `M${x + 2.5} ${y + 1}v6m-2.5-3h5`).join('');
  return [svg('0 0 70 46', `<defs>${заливка(g, '#bc8c79', '#503541', '#946355')}</defs><path d="M0 46V12h70v34z" fill="url(#${g})"/><path d="M0 12h70" stroke="#5a2e22" stroke-width="2"/>`
      + `<path d="M0 18h70M0 24h70M0 30h70M0 36h70M0 42h70M13 12v34m13-34v34m14-34v34m14-34v34" stroke="#432e38" stroke-opacity=".53" stroke-width=".55"/><path d="M0 26h70m-70 11h70" stroke="#ecc1a1" stroke-opacity=".5" stroke-width=".75"/>`
      + `<path d="M70 46V12l6-2v32Z" fill="#624b51"/><path d="M-2 12 8 2h54l10 10Z" fill="#4d4653"/><path d="M62 2l6-2 9 10-5 2Z" fill="#6b5f68"/><path d="M5 8h62M8 5h55" stroke="#8c828b" stroke-width=".65"/><rect x="12" y="-4" width="5" height="9" fill="#7a3e2c"/><rect x="34" y="-6" width="5" height="11" fill="#7a3e2c"/><rect x="54" y="-3" width="5" height="8" fill="#7a3e2c"/>`
      + (снег ? `<path d="M-1 11.6L8 3h54l9 8.6c-3 .8-5-.8-7-.4-3 1-6 1-9 0-3 1-7 1-10 0-3 1-7 1-10 0-3 1-6 1-9 0-3 1-6 .8-17-.6z" fill="#f4f8ff"/>` : '')
      + `<g class="w">${ок}</g><path d="${рамы}" stroke="#67505a" stroke-width=".65"/><path d="M6 23.6h5M18 23.6h5M30 23.6h5M46 23.6h5M58 23.6h5" stroke="#5a2e22" stroke-width=".8"/><path d="M38 46v-9h6v9zM23 46v-9h6v9z" fill="#3c3135"/><path d="M21 45h10m5 0h10M15 14v28M34 14v28M53 14v28" stroke="#e2ad94" stroke-opacity=".58" stroke-width=".8"/>`),
    svg('0 0 70 46', `<g class="hot">${окна.filter((_, i) => i % 3 !== 1).map(({ контур }) => `<path d="${контур}" opacity=".72"/>`).join('')}</g>`)];
}
function фабрика(сезон) {
  const g = id('factory'), дым = id('steam');
  const ок = [[6, 44], [18, 44], [30, 44], [42, 44], [52, 44], ...[70, 80, 90, 100].flatMap(x => [[x, 32], [x, 46]])];
  return [svg('0 0 110 60', `<defs>${заливка(g, '#877384', '#3f394d')}${заливка(дым, '#b4a5ad', '#6c677c')}</defs><path d="M0 60V34l14-8v8l14-8v8l14-8v8l14-8v34z" fill="url(#${g})"/><path d="M0 36l14-8m0 8 14-8m0 8 14-8m0 8 14-8m-56 14h56" stroke="#b29aa3" stroke-opacity=".56" stroke-width=".9"/>`
      + `<path d="M60 60V22l37-5 11 6v37Z" fill="url(#${g})"/><path d="M97 17l11 6v37H97Z" fill="#3d3948" opacity=".65"/><path d="M60 23l37-6 12 6M64 28l32-4m-33 30h44" fill="none" stroke="#c2a8a3" stroke-width=".8" opacity=".52"/><path d="M72 21 73 2h7l1 19m9-2 1-25h7l1 25Z" fill="#85665f"/><path d="M77 2v18m18-25v23" stroke="#56464b" stroke-width="2"/>`
      + `<path d="M70 2h10M89-6h10" stroke="#3a2e2c" stroke-width="2"/><g class="w">${ок.map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="6"/>`).join('')}</g><path d="M0 57h56m6-18 35-3m-35 16 35-2m-30-25v33m29-36v38" stroke="#d4afa2" stroke-opacity=".35" stroke-width=".9"/><path d="M11 60V54h9v6Zm23 0v-7h9v7Z" fill="#473d48"/>`
      + (сезон === 'season-winter' ? `<path d="M0 34l14-8m0 8 14-8m0 8 14-8m0 8 14-8m4-4 37-5 11 6" stroke="#dce6ee" fill="none" stroke-width="1.6"/>` : '')
      + `<path fill="url(#${дым})" class="se-steam" d="M74 1q-5-6 2-11 3-2 3-6 2-5 13-6 10-1 13-8 6-5 17-3-9 4-10 9-2 6-16 9-12 1-14 7-2 5-8 9Z"/>`),
    svg('0 0 110 60', `<g class="hot">${ок.map(([x, y]) => `<rect x="${x}" y="${y}" width="5" height="6"/>`).join('')}</g>`)];
}
function газовыйФонарь() {
  const стекло = 'M8 12h14l-2 14H10z';
  return [svg('0 0 30 90', `<path d="M15 88V26" stroke="#41424a" stroke-width="2.8"/><path d="M14.2 80V34" stroke="#949099" stroke-width=".65"/><path d="M10 88h10l-2-6h-6zM9 29h12l-6 6Z" fill="#41424a"/>`
    + `<path d="${стекло}" class="w"/><path d="M8 12h14l-2 14H10Zm7 0v14" fill="none" stroke="#41424a" stroke-width="1.25"/>`
    + `<path d="M6 12l9-7 9 7z" fill="#41424a"/><path d="m8 11 7-5m-4 72h8m-7-41h6" stroke="#b1a3a1" stroke-width="1"/><path d="M14 41q-6 0-6-5m7 7q6 0 6-6" fill="none" stroke="#4e4750" stroke-width="1.1"/><circle cx="15" cy="4" r="1.6" fill="#41424a"/>`),
    svg('0 0 30 90', `<circle cx="15" cy="19" r="13" class="gl-amber"/><path d="M12 15h6l-1 8h-4z" class="hot"/>`)];
}
function пароход() {
  const g = id('hull');
  return [svg('0 0 60 30', `<defs>${заливка(g, '#788d98', '#38434f', '#535f6f')}</defs><path d="M2 20q20 2 56 0l-6 8H8z" fill="url(#${g})"/><path d="M2 20q20 2 56 0M7 25q22 2 48-1" fill="none" stroke="#b17f70" stroke-width="1.25"/><path class="se-wake se-breathe" d="M-9 28q8 2 30 1m-27 3q19 1 32-1m18-3q12 1 18-1"/>`
      + `<path d="M12 20v-4l5-4h23l5 4v4Z" fill="#d9d4c8"/><path d="M14 13h29m2 5 11 1m-5 0V8l5 3-5 2" stroke="#686573" stroke-width="1" fill="none"/><g class="w">${[17, 22, 27, 32, 37].map(x => `<circle cx="${x}" cy="16.4" r="1"/>`).join('')}</g>`
      + `<rect x="24" y="3" width="5" height="10" fill="#1e1e22"/><rect x="24" y="3" width="5" height="2.4" fill="#b03a2e"/><rect x="33" y="5" width="4" height="8" fill="#1e1e22"/>`
      + `<path class="se-steam" d="M27 3q-1-8-7-9-8 1-16-4 0 7 11 9 7 0 10 4Z" fill="#918891"/>`),
    svg('0 0 60 30', `<g class="hot">${[17, 22, 27, 32, 37].map(x => `<circle cx="${x}" cy="16.4" r="1.2"/>`).join('')}</g><circle cx="56" cy="18" r="1.4" class="hot"/>`)];
}
function купальнаяКабинка() {
  return [svg('0 0 40 50', `<path d="M4 40V12h25v28Z" fill="#eee4d3"/><path d="M29 40V12l8-2v27Z" fill="#aaabb0"/><path d="M8 12v28M15 12v28M23 12v28M33 12v26" stroke="#557485" stroke-width="2.6"/>`
    + `<path d="M1 14 15 3l14-2 10 10-9 3Z" fill="#536c80"/><path d="m2 14 13-11 15 11" opacity=".65" stroke="#c7ccd0" fill="none" stroke-width=".85"/><path d="M12 40V24h10v16Z" fill="#665146"/><path d="M12 34h10m-8 0v6" stroke="#b59875" stroke-width=".85"/>`
    + `<circle cx="10" cy="43" r="4.8" fill="#726053" stroke="#493e3a" stroke-width="1.4"/><circle cx="28" cy="43" r="4.8" fill="#726053" stroke="#493e3a" stroke-width="1.4"/><path d="M7 40l6 6m-6 0 6-6m12 0 6 6m-6 0 6-6M35 36l5 2" stroke="#bb9a76" stroke-width="1"/><path d="M9 22h17v3H9Zm0 15h18v2H9Z" fill="#efe4cf" opacity=".48"/><path d="M12 40h10l2 2H10Z" fill="#98836e"/>`)];
}
function паровоз() {
  const g = id('train'), c = id('coach');
  const вагоны = [45, 65, 85];
  const окна = вагоны.flatMap(x => [x + 4, x + 10]).map(x => `<rect x="${x}" y="12.2" width="4" height="3.4" rx=".6"/>`).join('');
  const колёса = [[10, 2.1], [18, 3.4], [26, 3.4], [34, 2.4], ...вагоны.flatMap(x => [[x + 4, 2], [x + 14, 2]])];
  const фонарь = '<circle cx="8" cy="12.8" r="1.55"/>';
  // Состав и свет проходят один участок пути. По краям их закрывает дымка.
  const проезд = (рисунок) => {
    const градиент = id('rail-fade'), маска = id('rail-mask');
    return `<defs><linearGradient id="${градиент}"><stop stop-color="white" stop-opacity="0"/><stop offset=".12" stop-color="white"/><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="${маска}" maskUnits="userSpaceOnUse" x="-10" y="-24" width="132" height="54"><rect x="-10" y="-24" width="132" height="54" fill="url(#${градиент})"/></mask></defs><g mask="url(#${маска})"><g class="se-train-cars">${рисунок}</g></g>`;
  };
  const состав = `<path d="m4 25 5-8h28l3 6-6 2Z" fill="#54454a"/><path d="M9 13q0-2 4-2h17v8H9Z" fill="url(#${g})"/><path d="M12 11 11 4h6l-1 7m11 8V8h11v12Z" fill="url(#${g})"/><path d="M10 4h8m8 3h14" stroke="#45363d" stroke-width="2"/><path d="M10 16h18m1-6h8" stroke="#c9ad8c" stroke-width=".8"/><path d="M31 11h4v4h-4Z" class="w"/><g class="w">${фонарь}</g>`
      + `${вагоны.map(x => `<g transform="translate(${x})"><path d="M-1 24h20M-4 20H0" stroke="#493b40" stroke-width="1.5"/><path d="M1 20V11l3-2h12l3 2v9Z" fill="url(#${c})"/><path d="M0 11 4 8.5h12l4 2.5ZM2 18h16" fill="#5f4b54" stroke="#d4a184" stroke-width=".5"/></g>`).join('')}<g class="w">${окна}</g>`
      + колёса.map(([x, радиус]) => `<g transform="translate(${x} ${р(25 - радиус)})"><g class="se-train-wheel" style="--se-wheel-period:${р(радиус * .47)}s"><circle r="${радиус}" fill="#39333c" stroke="#8a736c" stroke-width=".7"/><path d="M${р(-радиус * .65)} 0h${р(радиус * 1.3)}M0 ${р(-радиус * .65)}v${р(радиус * 1.3)}" stroke="#a99288" stroke-width=".6"/><circle r=".7" fill="#bd9a83"/></g></g>`).join('')
      + '<path class="se-steam" d="M13 4q-3-6 6-9 9-1 13-7 6-5 18-3-7 2-9 7-5 5-17 6-8 1-9 6Z" fill="#a1989d"/>';
  const путь = '<path d="M-12 24h133l6 5-9 1q-62-1-124 1l-9-2.5Z" fill="#8b7768"/><path d="M-8 26h126" stroke="#ae9580" stroke-width="2.8" stroke-dasharray="1.8 3.6"/><path d="M-9 25h130M-7 27h126" stroke="#5b5049" stroke-width=".95"/><path d="M-5 29h46m6 0h28m7 0h32" stroke="#bda38e" stroke-width=".8"/>';
  return [svg('0 0 110 30', `<defs>${заливка(g, '#78737a', '#373239', '#4e4b56')}${заливка(c, '#b2846a', '#654345', '#935b50')}</defs>${путь}${проезд(состав)}`),
    svg('0 0 110 30', проезд(`<g class="hot">${окна}${фонарь}</g><path d="M7 12.8-12 9v9Z" class="beam se-breathe"/>`))];
}
function дирижабль() {
  const g = id('ds');
  return [svg('0 0 80 30', `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2ddd0"/><stop offset="1" stop-color="#8a8478"/></linearGradient></defs>`
      + `<path d="M6 12q3-9 30-11 28 0 38 10-7 10-35 11Q11 22 6 12Z" fill="url(#${g})"/><path d="M8 11q21 6 64 0M12 6c13 4 44 3 55-.5M11 17c18 3 43 3 56-1M34 2q-7 10 2 20m18-19q7 8-1 17" stroke="#8d7d74" stroke-width=".75" fill="none"/>`
      + `<path d="M69 11l9-6v14l-9-6Z" fill="#948880"/><path d="M28 19l7 7m15-7-4 7m-14-3 2 4h14l3-4Z" fill="none" stroke="#6d5a50" stroke-width="1.2"/><path d="M34 24h15l-3 4h-9Z" fill="#705a4d"/><path d="M37 25h9" stroke-width="1.2" class="w-line"/>`),
    svg('0 0 80 30', `<path d="M37 25h9" class="hot-line"/><circle cx="7" cy="12" r="1.3" class="hot se-breathe"/>`)];
}

function купол(снег) {
  const g = id('dm');
  return [svg('0 0 60 34', `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe8f2"/><stop offset="1" stop-color="#8fa2b8"/></linearGradient></defs>`
      + `<path d="M2 34C2 14 14 4 30 4s28 10 28 30z" fill="url(#${g})" stroke="#6f8298" stroke-width=".8"/><path d="M31 5q15 8 16 29h11C58 20 49 7 31 5Z" fill="#70879c" opacity=".58"/><path d="M30 4v30M14 9c-2 8-2 18 0 25M46 9c2 8 2 18 0 25M6 18c14 3 34 3 48 0" stroke="#778b9f" stroke-width=".8" fill="none"/><path d="M6 29q4-15 15-18" stroke="#e6f2f8" stroke-width="1.45" fill="none"/>`
      + `<path d="M3 33q27 4 54 0l2 2q-29 4-58 0Z" fill="#73899d"/><path d="M8 25c10 3 34 3 44 0" class="ring-l"/><path d="M24 34v-8a6 6 0 0 1 12 0v8z" fill="#435b70"/><path d="M27 34v-6a3 3 0 0 1 6 0v6m-8-6h10" stroke="#94bccd" fill="none" stroke-width=".85"/>`
      + (снег ? `<path d="M9 13c6-7 13-9 21-9s15 2 21 9c-3 1-6 0-8-1-3 1-6 1-9 0-3 1-6 1-9 0-3 1-6 1-8 0-2 1-5 2-8 1z" fill="#fbfdff"/>` : '')),
    svg('0 0 60 34', `<path d="M8 25c10 3 34 3 44 0" class="hot-line-cyan"/><path d="M27 34v-6a3 3 0 0 1 6 0v6Z" class="hot-cyan"/><ellipse cx="30" cy="30" rx="10" ry="6" class="gl-cyan se-breathe"/>`)];
}
function башниБудущего(берег = false) {
  const g = id('skyline');
  const ог = [[16, 34], [16, 46], [38, 14], [38, 30], [38, 46], [38, 58], [61, 40], [61, 52], [81, 24], [81, 40], [81, 56], [102, 44], [102, 56]];
  return [svg('0 0 120 70', `<defs>${заливка(g, '#9aacbc', '#3d4c65', '#657f98')}</defs><path fill="#688097" opacity=".5" d="M0 70V51h12V40h18v16h17V43h9v11h17V34h12v22h14v-9h16v23Z"/><g fill="url(#${g})"><path d="M10 70V26l6-6 6 6v44z"/><path d="M30 70V8l8-8 8 8v62z"/><path d="M54 70V30c0-6 14-6 14 0v40z"/><path d="M76 70V16l5-4 5 4v54z"/><path d="M94 70V36h16v34z"/></g><path d="M13 28v35m20-54v52m24-30v32m22-46v46m18-24v27" stroke="#d7eef1" stroke-opacity=".58" stroke-width="1"/>`
      + `<path d="M16 20l6 6v44h-4V29ZM38 0l8 8v62h-5V10Zm23 25q7 0 7 5v40h-5V32ZM81 12l5 4v54h-4V18Zm22 24h7v34h-4Z" fill="#3c556a" opacity=".56"/><path d="M9 66h14m6-3h18m5-1h17m7 2h11m7-1h17" stroke="#a8bcc5" stroke-width="1"/><g class="w">${ог.map(([x, y]) => `<rect x="${x - 2}" y="${y}" width="4" height="1.4"/>`).join('')}</g><path d="M38 0v-4" stroke="#8fa0b4"/>`
      + `<path class="se-reflected-light" d="M35 28v12m21-6v12m25-11v13" stroke="#dbfaff" stroke-width="1.4"/>`
      + (берег ? `<path d="M0 72q11-4 27-4l23 1 20-2 27 2 17 1 6 4-17 2-83 .5Z" fill="#658d91"/><path d="M2 73q17 1 31-1m28 .6q26-2 57 1.4" stroke="#bee0df" fill="none" stroke-width="1.3"/><path d="M18 79q39-2 83 0" stroke="#a5d4dc" stroke-width="1.2" opacity=".45"/>` : '')),
    svg('0 0 120 70', `<g class="hot-cyan">${ог.map(([x, y]) => `<rect x="${x - 2}" y="${y}" width="4" height="1.4"/>`).join('')}</g><circle cx="38" cy="-5" r="1.6" class="hot-red"/>`)];
}
function световойСтолб() {
  return [svg('0 0 20 90', `<path d="M7.5 90 8.5 23h3l1 67Z" fill="#94abbc"/><path d="M6 90h8l1-4H5z" fill="#778ea4"/><path d="M7 21V9a3 3 0 0 1 6 0v12l-2 4H9Z" fill="#dff8ff" stroke="#66879d" stroke-width="1"/><path d="M8.6 29v50m1-69v10" stroke="#aef4ff" stroke-width=".9"/><path d="M7 22 6 11 7 7m6 15 1-11-1-4M7 31h6m-6 39h6" fill="none" stroke="#5d7b90" stroke-width="1"/>`),
    svg('0 0 20 90', `<circle cx="10" cy="15" r="14" class="gl-cyan"/><rect x="7" y="6" width="6" height="18" rx="3" class="hot-cyan"/><path d="M10 24L-8 90h36z" class="beam-cyan"/>`)];
}
function ховерборд() {
  return [svg('0 0 70 20', `<path d="M5 8q4-5 12-5h44q9 2 3 6l-8 4H17Q8 13 5 8Z" fill="#a1b1bc"/><path d="M5 8q4-5 12-5h44q9 2 3 6H10Z" fill="#dfe9ed"/><path d="M17 5h10m14 0h13" stroke="#7c929e" stroke-width="1.5" stroke-linecap="round"/>`
      + `<path d="M10 9h50" stroke="#57beda" stroke-width="1.4" stroke-linecap="round"/><path d="M18 11h9l-2 3h-6Zm24 0h9l-2 3h-6Z" fill="#5d7989"/><ellipse cx="22" cy="14" rx="4.5" ry="1.3" fill="#7fe3ff"/><ellipse cx="46" cy="14" rx="4.5" ry="1.3" fill="#7fe3ff"/>`),
    svg('0 0 70 20', `<ellipse cx="22" cy="14" rx="7" ry="2.7" class="gl-cyan"/><ellipse cx="46" cy="14" rx="7" ry="2.7" class="gl-cyan"/><path d="M10 9h50" class="hot-line-cyan"/>`)];
}
function дрон() {
  return [svg('0 0 36 18', `<path d="m6 5 8 3m8 0 8-3" stroke="#596676" stroke-width="1.9"/><path d="M3 6q3 2 6 0V4H3Zm24 0q3 2 6 0V4h-6Z" fill="#7992a2"/><g class="se-rotors"><ellipse cx="6" cy="3.2" rx="5" ry="1" fill="#d6e0e5a0"/><ellipse cx="30" cy="3.2" rx="5" ry="1" fill="#d6e0e5a0"/></g>`
      + `<path d="m11 7 3-3h8l3 3-3 5h-8Z" fill="#a6bac6"/><path d="m11 7 3-3h8l3 3Z" fill="#e5edea"/><circle cx="18" cy="9" r="1.7" fill="#50657a"/><circle cx="18" cy="9" r="1" fill="#78d8e8"/><path d="M16 11v3m4-3v3" stroke="#596370" stroke-width=".8"/><path d="M15 14h6v4h-6Z" fill="#b58d67"/><path d="M18 14v4" stroke="#debf92" stroke-width=".7"/>`),
    svg('0 0 36 18', `<circle cx="18" cy="9" r="1.6" class="hot-cyan"/><circle cx="6" cy="6" r="1" class="hot-red"/><circle cx="30" cy="6" r="1" class="hot-red"/>`)];
}
function солнечныйНавес() {
  const g = id('solar');
  return [svg('0 0 50 60', `<defs>${заливка(g, '#63869b', '#30465e', '#456b89')}</defs><path d="M19 59V17m13 41V16" stroke="#aabcc2" stroke-width="2"/><path d="M2 17 27 7l21 8-25 10Z" fill="#426278"/><path d="M2 15 27 5l21 8-25 10Z" fill="url(#${g})" stroke="#cfdae0" stroke-width=".8"/>`
    + `<path d="m10 12 21 8m-14-11 21 8m-14-11 21 8M9 18 35 8M16 21l26-10" stroke="#a4c7d5" stroke-opacity=".62" stroke-width=".6"/><path d="m6 15 21-9 4 2-21 9Zm13 8 4 2 24-10v1l-24 10Z" fill="#b8d2d9" opacity=".57"/><path d="M17 47h16v3H17Z" fill="#9eafb4"/><path d="M19 50v7m12-7v6" stroke="#5f7785" stroke-width="1.1"/><ellipse cx="25" cy="59" rx="14" ry="1.6" fill="#503c2852"/>`)];
}
function ветряк() {
  return [svg('0 0 40 90', `<path d="M16 88h8l1 2H15Z" fill="#7c8f9a"/><path d="M17.8 90l1.6-62 1.8-.2 1.5 62Z" fill="#bfcdd8"/><path d="M20 87l.7-57 1.5 57Z" fill="#90a9bb"/><g class="se-blades"><path d="M20 26q-3-12-1.4-24h2.8l-.7 24ZM20 26q12 3 21 12l-1.4 2.4-20-13ZM20 26Q11 35-1 38l1.4 2.4 20-13Z" fill="#edf4f6"/><path d="M20 25V4m1 23 17 11m-20-10L2 38" stroke="#aac5d0" stroke-width=".8"/></g><circle cx="20" cy="26" r="2.4" fill="#8ca1b4"/><path d="M18.8 29l-.8 57" stroke="#f7faf6" stroke-width=".8"/>`),
    svg('0 0 40 90', `<circle cx="20" cy="26" r="1.4" class="hot-red"/>`)];
}
function теплицаКупол() {
  const стекло = id('glass');
  return [svg('0 0 70 36', `<defs>${заливка(стекло, '#e5fbff96', '#5d8ea890', '#a6d5cc55')}</defs><path d="M2 36C2 16 18 4 35 4s33 12 33 32Z" fill="url(#${стекло})" stroke="#c0dadd" stroke-width="1"/>`
      + `<path d="M7 34q25-6 56 0v2H7Z" fill="#6e7a62"/><path d="M16 34q-7-2-5-7 7 0 5 7m0 0q1-8 8-8 1 4-8 8m12 0q-8-5-2-10 6 2 2 10m1 0q4-7 10-5-2 5-10 5m14 0q-4-8 1-11 5 4-1 11m2 0q3-7 11-6-1 6-11 6" fill="#6d9770"/>`
      + `<path d="M35 4v32M18 8c-4 8-6 18-6 28M52 8c4 8 6 18 6 28M4 26c20 4 42 4 62 0M10 16c16 3 34 3 50 0" stroke="#cfe6f2" stroke-width=".65" fill="none"/><path class="se-reflected-light" d="M9 23q4-10 15-14" stroke="#f3fcfa" fill="none"/><path d="M30 36v-7a5 5 0 0 1 10 0v7" stroke="#bdd1ce" fill="#638c8b" stroke-width=".85"/><path d="M5 35q28 2 60 0" stroke="#849fa3" stroke-width="1.6"/>`),
    svg('0 0 70 36', `<path d="M4 34C6 18 20 8 35 8s29 10 31 26z" class="gl-violet"/>`)];
}
function роботПугало() {
  const g = id('robot');
  return [svg('0 0 40 60', `<defs>${заливка(g, '#d4e3e3', '#708898', '#a7bac7')}</defs><path d="M18 60V30h3v30zm-3 0h9l-1-2h-7Z" fill="#8198a7"/><path d="m2 29 8-2 5 2m10 0 5-2 8 2" stroke="#8198a7" fill="none" stroke-width="2.4" stroke-linecap="round"/><path d="M10 27 14 23h14l3 4-2 12-15 1-3-3Z" fill="url(#${g})"/>`
      + `<path d="M12 11 15 8h11l4 3-1 8-3 3H15l-3-3Z" fill="url(#${g})"/><rect x="14" y="12" width="14" height="5" rx="2.5" fill="#476678"/><path d="M16 14.5h3m3 0h4" stroke="#a8edf3" stroke-width="1.4"/><path d="M20 8V3" stroke="#8fa0b4" stroke-width="1.2"/><circle cx="20" cy="2.4" r="1.4" fill="#d77a66"/>`
      + `<path d="M15 30h10M15 34h10" stroke="#708b9f" stroke-width="1.1"/><circle cx="37.5" cy="29" r="1.6" fill="#92a6ae"/><circle cx="2" cy="29" r="1.6" fill="#92a6ae"/>`),
    svg('0 0 40 60', `<path d="M16 14.5h3m3 0h4" class="hot-line-cyan se-breathe"/><circle cx="20" cy="2.4" r="1.6" class="hot-red"/>`)];
}

function знакНаВоде() {
  const знак = 'M5 6l6-1 3-2 6 1 6-1 3 2 6 1-6 1-3 2-6-1-6 1-3-2Z M16 6l4-2 4 2-4 2Z';
  return [svg('0 0 40 12', `<path d="${знак}M2 9q9 1 15-.5m6 0q6 1 15-.5" class="sigil"/>`),
    svg('0 0 40 12', `<ellipse cx="20" cy="6" rx="16" ry="3" class="gl-violet faint"/><path d="${знак}" class="sigil-gl se-breathe"/>`)];
}

/* ─────────────────────────── сборка слоя ─────────────────────────── */

function собрать(сезон, { tech = 'modern', magic = 'none' } = {}) {
  огни = [];
  let h = '';
  const зима = сезон === 'season-winter', лето = сезон === 'season-summer', осень = сезон === 'season-autumn', весна = сезон === 'season-spring';
  // ── технологии ──
  if (tech === 'primitive') {
    if (зима) h += кусок('se-tent t1', шатёр(0)) + кусок('se-tent t2', шатёр(1)) + кусок('se-tent t3', шатёр(2)) + кусок('se-stones', наСнегу(менгиры()));
    if (лето) h += кусок('se-dugout', долблёнка()) + кусок('se-rack', вешала());
    if (осень) h += кусок('se-shelter', осеннийНавес()) + кусок('se-rack r2', вешала());
    if (весна) h += кусок('se-hut u1', хижина()) + кусок('se-hut u2', хижина()) + кусок('se-stones s2', менгиры());
  }
  if (tech === 'industrial') {
    if (зима) h += кусок('se-row w1', кирпичныйРяд(true)) + кусок('se-row w2', кирпичныйРяд(true)) + кусок('se-factory', наСнегу(фабрика(сезон))) + кусок('se-gaslamp', газовыйФонарь());
    if (лето) h += кусок('se-steamer', пароход()) + кусок('se-bathing', купальнаяКабинка());
    if (осень) h += кусок('se-train', паровоз()) + кусок('se-factory f2', фабрика(сезон)) + кусок('se-gaslamp g2', газовыйФонарь());
    if (весна) h += кусок('se-airship', дирижабль()) + кусок('se-factory f3', фабрика(сезон));
  }
  if (tech === 'future') {
    if (зима) h += кусок('se-dome d1', купол(true)) + кусок('se-dome d2', купол(true)) + кусок('se-dome d3', купол(true)) + кусок('se-towers', наСнегу(башниБудущего())) + кусок('se-pylon', световойСтолб());
    if (лето) h += кусок('se-hover', ховерборд()) + кусок('se-drone', дрон()) + кусок('se-towers t2', башниБудущего(true)) + кусок('se-canopy', солнечныйНавес());
    if (осень) h += кусок('se-robo', роботПугало()) + кусок('se-pylon p2', световойСтолб()) + кусок('se-towers t3', башниБудущего());
    if (весна) h += кусок('se-turbine u1', ветряк()) + кусок('se-turbine u2', ветряк()) + кусок('se-greenhouse', теплицаКупол()) + кусок('se-drone d2', дрон());
  }
  // ── магия ──
  if (magic === 'high') {
    if (зима) h += кусок('se-tower', башняМага(true)) + кусок('se-circle', магКруг());
    if (лето) h += кусок('se-dragon', дракон()) + кусок('se-crystals', кристаллы());
    if (осень) h += кусок('se-broom', метла()) + кусок('se-fring', грибнойКруг());
    if (весна) h += кусок('se-island', парящийОстров()) + феи();
    h += огоньки(6, 'arcane');
  }
  if (magic === 'grounded') {
    if (зима) h += кусок('se-lantern', каменныйФонарь(true)) + кусок('se-fox', лисаДух());
    if (лето) h += кусок('se-waterarc', водянаяДуга()) + кусок('se-floats', фонарикиНаВоде());
    if (осень) h += кусок('se-whirl', вихрьЛистьев()) + кусок('se-lantern l2', каменныйФонарь(false)) + кусок('se-deer', оленьДух());
    if (весна) h += кусок('se-rocks', парящиеКамни()) + кусок('se-shrine', алтарьДухов());
    h += огоньки(4, 'spirit');
  }
  if (magic === 'hidden') {
    // Намёк, не больше: днём почти незаметно, ночью проступает.
    if (зима) h += кусок('se-circle is-faint', магКруг(true));
    if (лето) h += кусок('se-glint', знакНаВоде());
    if (осень) h += кусок('se-fring is-faint', грибнойКруг(true));
    if (весна) h += кусок('se-fring is-faint f2', грибнойКруг(true, true));
    h += огоньки(1, 'hint');
  }
  const свет = огни.join('');
  огни = null;
  const вид = сезон.replace('season-', '');
  return {
    сцена: h ? `<div class="hud-se is-${вид}" aria-hidden="true">${h}</div>` : '',
    огни: свет ? `<div class="hud-se hud-se-l is-${вид}" aria-hidden="true">${свет}</div>` : '',
  };
}

/** Слой облика в сцене сезона (внутрь .hud-fx-season-scene). */
export const обликСцены = (сезон, облик) => собрать(сезон, облик).сцена;
/** Светящиеся двойники — в слой огней над ночным затемнением (.hud-fx-lights). */
export const огниОблика = (сезон, облик) => собрать(сезон, облик).огни;
