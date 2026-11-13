// hud-manager/render/views-diary.js
//
// Виды дневника, дневника тела и перехватов (Кастомизация → Вид блоков).
// Первый вид каждого блока — прежний, его рисуют сами вкладки (diary.js,
// intercepts.js); здесь только новые. Данные те же — модель ничего нового
// не пишет. Оформление — css/diary-views.css.
//
//   Дневник:       Разворот (книга с лентой-закладкой), Закрытый блог, Пишущая машинка
//   Дневник тела:  Шёлк (атлас с бликом и кружевом), Поцелуй, Термограмма
//   Перехваты:     Терминал (консоль расшифровки), Стенограмма, Катушки
//
// Как и у прежнего листа, настроение записи меняет её облик: темы листа
// (diary.js, ТЕМЫ_ДНЕВНИКА) сведены в восемь «погод», и у каждого вида на
// каждую погоду свои приметы. Дневник тела живёт накалом записи.
// Перехваты, как и прежний телефон, — вкладками по перепискам.
//
// Конечный вид рисуется сразу, без анимации появления: HUD держит анимации
// на паузе, пока на вид не навели мышь или не нажали (css/views.css).

import { escapeHtml, hudHashSeed, инициалыИмени, имяБезПриставки } from '../utils.js?v=23.89.19';
import { лицоЧеловека as лицо } from './views.js?v=23.89.19';
import { ико } from './view-icons.js?v=23.89.19';

const э = (s) => escapeHtml(String(s ?? ''));
const огр = (v, a, b) => Math.max(a, Math.min(b, v));
const ф = (n) => Number(n).toFixed(1);
const сид = (s, i = 0) => { let h = hudHashSeed(String(s) + '#' + i) >>> 0; return () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h >>> 8) / 16777216; }; };
const имя = (s) => имяБезПриставки(String(s || '').trim());
const первое = (s) => имя(s).split(/\s+/)[0] || '';
// Слова модели и имена — мимо английского словаря (i18n.js): data-i18n-skip.
const свои = (s) => `<span data-i18n-skip>${э(s)}</span>`;

// Оттенок записи по теме настроения: лента закладки, полоса поста, лента машинки.
const ОТТЕНОК = {
  love: 345, tenderness: 340, devotion: 330, cozy: 28, lust: 352, longing: 318, jealousy: 355, codependency: 300, obsession: 290,
  joy: 44, triumph: 40, relief: 150, respect: 48, realization: 52, peace: 175, neutral: 200,
  sad: 214, apathy: 225, bored: 230, disappointment: 236, collapse: 250, cold: 200,
  angry: 4, irritation: 14, panic: 10, madness: 280, stress: 22, nervous: 30,
  shame: 300, guilt: 270, embarrassment: 335, disgust: 95, contempt: 265,
  control: 262, calc: 205, resolve: 18, thrill: 8, irony: 320, curiosity: 185, protection: 160,
};
export const оттенокНастроения = (ключ) => ОТТЕНОК[ключ] ?? 210;

// Восемь «погод» настроения. Тема листа → погода.
const СЕМЬЯ = {};
for (const [семья, ключи] of Object.entries({
  love: 'love tenderness devotion cozy longing lust codependency protection',
  joy: 'joy triumph relief respect realization curiosity',
  calm: 'neutral peace cold calc bored',
  sad: 'sad apathy disappointment collapse',
  anger: 'angry irritation thrill resolve stress',
  fear: 'panic nervous madness',
  shame: 'shame guilt embarrassment disgust',
  dark: 'jealousy obsession control contempt irony',
})) for (const к of ключи.split(' ')) СЕМЬЯ[к] = семья;
export const семьяНастроения = (ключ) => СЕМЬЯ[ключ] || 'calm';

// ============================================================================
// ДНЕВНИК
// записи — [{ автор, время, текст (готовый HTML), оНей (HTML), ключ, слово, значок }]
// ============================================================================

const СЕРДЦЕ = 'M0 4.6C-3.4 2.2-5.6-.2-5.6-2.6a2.8 2.8 0 0 1 5.6-1 2.8 2.8 0 0 1 5.6 1C5.6-.2 3.4 2.2 0 4.6Z';
const ИСКРА = 'M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4Z';
/** Приметы погоды на странице книги: рисунки на полях, пятна, надрывы. */
function приметыСтраницы(семья, r) {
  const svg = (класс, тело, vb = '0 0 60 60') => `<svg class="deco ${класс}" viewBox="${vb}" aria-hidden="true">${тело}</svg>`;
  if (семья === 'love') return svg('love', [[22, 40, 1.5, -12], [40, 26, 1.1, 14], [44, 46, .8, 4]].map(([x, y, s, a]) => `<path transform="translate(${x} ${y}) rotate(${a}) scale(${s})" d="${СЕРДЦЕ}"/>`).join('') + '<path class="arrow" d="M8 52 52 14M46 14h6v6"/>');
  if (семья === 'joy') return svg('joy', `<circle cx="30" cy="30" r="9"/>${Array.from({ length: 10 }, (_, k) => { const a = k * 36 * Math.PI / 180; return `<path class="ray" d="M${ф(30 + Math.cos(a) * 13)} ${ф(30 + Math.sin(a) * 13)}L${ф(30 + Math.cos(a) * (k % 2 ? 18 : 21))} ${ф(30 + Math.sin(a) * (k % 2 ? 18 : 21))}"/>`; }).join('')}`
    + [[8, 10, .7], [52, 50, .9], [50, 8, .55]].map(([x, y, s]) => `<path class="spark" transform="translate(${x} ${y}) scale(${s})" d="${ИСКРА}"/>`).join(''));
  if (семья === 'calm') return svg('calm', '<path class="moon" d="M38 12a16 16 0 1 0 8 26 13 13 0 1 1-8-26Z"/><path class="dots" d="M4 54h52"/>');
  if (семья === 'sad') return [0, 1, 2].map(k => `<i class="stain" style="--x:${Math.round(14 + r() * 66)}%;--y:${Math.round(22 + r() * 56)}%;--s:${Math.round(26 + r() * 22)}px" aria-hidden="true"></i>`).join('');
  if (семья === 'anger') return svg('anger', '<path d="M6 10l10 6-8 5 12 5-9 6 13 4-10 6 14 3"/><path d="M34 8l16 22M50 8 34 30"/>');
  if (семья === 'fear') {
    const точки = Array.from({ length: 12 }, (_, k) => { const a = k / 12 * Math.PI * 2, d = 12 + r() * 9; return [30 + Math.cos(a) * d, 30 + Math.sin(a) * d]; });
    return svg('fear', `<path d="M${точки.map(([x, y]) => ф(x) + ' ' + ф(y)).join(' L')}Z"/>` + Array.from({ length: 6 }, () => `<circle cx="${ф(4 + r() * 52)}" cy="${ф(4 + r() * 52)}" r="${ф(1 + r() * 2.4)}"/>`).join(''));
  }
  if (семья === 'shame') return svg('shame', '<path d="M60 0 22 30M60 0 30 52M60 0 8 12M60 0 44 60M22 30l10 8M30 52l-6-8"/>', '0 0 60 60') + '<i class="smudge" aria-hidden="true"></i>';
  if (семья === 'dark') return svg('dark', '<path class="vine" d="M10 2c8 10-6 18 2 28s-4 18 4 28"/>' + [[12, 12, 1], [8, 24, -1], [14, 36, 1], [9, 48, -1]].map(([x, y, s]) => `<path class="thorn" d="M${x} ${y}l${s * 6} -2 ${-s * 3} 5Z"/>`).join(''), '0 0 30 60');
  return '';
}

/** Разворот: страница книги в переплёте — корешок со швом, золотой обрез,
 *  лента-закладка цвета настроения, буквица, загнутый уголок «о ней».
 *  Погода записи — на самой странице: сердечки на полях, солнце с искрами,
 *  луна, разводы от слёз, рваный край и злые росчерки, клякса страха,
 *  смятый угол, терновник. */
function дневникРазворот(записи) {
  return `<div class="hud-v hud-jv hud-jv-book">` + записи.map((з, i) => {
    const семья = семьяНастроения(з.ключ);
    const r = сид(з.время + з.автор + з.ключ, i);
    const моно = инициалыИмени(з.автор || '?', 2) || '·';
    const уголок = з.оНей ? `<div class="hud-jv-bk-fold hud-sv is-closed" role="button" tabindex="0" aria-expanded="false"><i class="corner" aria-hidden="true"></i>`
      + `<small class="lbl">${ико('book')}<span>о ней</span></small><div class="txt hud-jv-mtext" data-i18n-skip>${з.оНей}</div><span class="hint">загнутый уголок — отогни</span></div>` : '';
    return `<article class="hud-jv-bk-page hud-diary-mood-${з.ключ} is-m-${семья}" style="--jv-h:${оттенокНастроения(з.ключ)}">`
      + `<i class="hud-jv-bk-spine" aria-hidden="true"></i><i class="hud-jv-bk-edge" aria-hidden="true"></i>`
      + `<span class="hud-jv-bk-wm" aria-hidden="true">${ико(з.значок || 'heart')}</span>${приметыСтраницы(семья, r)}`
      + `<i class="hud-jv-bk-ribbon" aria-hidden="true"></i>`
      + `<header class="hud-jv-bk-head"><span class="mono" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="r1" cx="20" cy="20" r="18"/><circle class="r2" cx="20" cy="20" r="14.5"/>`
      + `<path class="laurel" d="M8 26c2 4 6 7 10 8M32 26c-2 4-6 7-10 8M7 21c1 2 2 3 4 4M33 21c-1 2-2 3-4 4"/></svg><b>${э(моно)}</b></span>`
      + `<div class="who">${з.автор ? `<b data-i18n-skip>${э(имя(з.автор))}</b>` : ''}<time data-i18n-skip>${э(з.время)}</time></div>`
      + (з.слово ? `<span class="mood">${ико(з.значок || 'heart')}${свои(з.слово)}</span>` : '') + `</header>`
      + `<div class="hud-jv-bk-text hud-jv-mtext" data-i18n-skip>${з.текст}</div>${уголок}`
      + `<footer class="hud-jv-bk-foot" aria-hidden="true"><i></i>${записи.length - i}<i></i></footer></article>`;
  }).join('') + `</div>`;
}

/** Закрытый блог: личный пост «только для себя» — замок, кто видит,
 *  настроение строкой, комментарии закрыты; «о ней» — скрытый пост под
 *  размытием. Погода — в шапке поста: сердечки всплывают, конфетти, мягкие
 *  огни, дождь, тревожная полоса, помехи, румянец, дым. */
function дневникБлог(записи) {
  return `<div class="hud-v hud-jv hud-jv-blog">` + записи.map((з) => {
    const семья = семьяНастроения(з.ключ);
    const скрытый = з.оНей ? `<div class="hud-jv-bl-hidden hud-sv is-closed" role="button" tabindex="0" aria-expanded="false"><div class="bar">${ико('lock')}<b>скрытая запись</b><small>о ней</small></div>`
      + `<div class="txt" data-i18n-skip>${з.оНей}</div><span class="hint">нажми, чтобы показать</span></div>` : '';
    return `<article class="hud-jv-bl-post hud-diary-mood-${з.ключ} is-m-${семья}" style="--jv-h:${оттенокНастроения(з.ключ)}">`
      + `<i class="hud-jv-bl-fx" aria-hidden="true">${Array.from({ length: 7 }, (_, k) => `<b style="--k:${k}"></b>`).join('')}</i>`
      + `<header class="hud-jv-bl-head"><span class="hud-jv-bl-ava">${з.автор ? лицо(з.автор) : `<i class="hud-v-face" aria-hidden="true">?</i>`}<span class="badge" aria-hidden="true">${ико(з.значок || 'heart')}</span></span>`
      + `<div class="who">${з.автор ? `<b data-i18n-skip>${э(имя(з.автор))}</b>` : '<b>Без имени</b>'}<small><time data-i18n-skip>${э(з.время)}</time></small></div>`
      + `<span class="priv">${ико('lock')}<span>только я</span></span></header>`
      + `<div class="hud-jv-bl-text" data-i18n-skip>${з.текст}</div>${скрытый}`
      + `<dl class="hud-jv-bl-meta">${з.слово ? `<div><dt>настроение</dt><dd>${ико(з.значок || 'heart')}${свои(з.слово)}</dd></div>` : ''}`
      + `<div><dt>доступ</dt><dd>${ико('eye')}<span>никто, кроме автора</span></dd></div></dl>`
      + `<footer class="hud-jv-bl-foot"><span>${ико('heart')}0</span><span>${ико('speech')}<span>комментарии закрыты</span></span><i class="saved" aria-hidden="true"></i><small>черновик сохранён</small></footer></article>`;
  }).join('') + `</div>`;
}

/** Пишущая машинка: лист в каретке — валик с ручками, шапка заглавными,
 *  настроение красной половиной ленты, мигающая каретка; «о ней» забито
 *  иксами, пока не нажмёшь. Погода — в самой печати: лента другого цвета,
 *  выцветшая лента, удары до дыр, двоящиеся буквы, замазка корректора. */
function дневникМашинка(записи) {
  return `<div class="hud-v hud-jv hud-jv-type">` + записи.map((з, i) => {
    const семья = семьяНастроения(з.ключ);
    const r = сид(з.время + з.автор, i);
    const иксы = з.оНей ? `<div class="hud-jv-tp-xx hud-sv is-closed" role="button" tabindex="0" aria-expanded="false"><span class="lbl">P.S. о ней:</span>`
      + `<span class="txt" data-i18n-skip>${з.оНей}</span><span class="hint">забито иксами — нажми</span></div>` : '';
    // Замазка корректора — на полях внизу листа, слов не закрывает.
    const приметы = семья === 'shame' ? [0, 1].map(k => `<i class="wo" style="--x:${Math.round(k ? 66 + r() * 12 : 8 + r() * 14)}%;--w:${Math.round(22 + r() * 18)}px" aria-hidden="true"></i>`).join('')
      : семья === 'anger' ? `<i class="holes" aria-hidden="true"></i>` : '';
    return `<article class="hud-jv-tp-sheet hud-diary-mood-${з.ключ} is-m-${семья}" style="--tilt:${ф((r() - .5) * (семья === 'fear' ? 2.6 : 1.4))}deg;--jv-h:${оттенокНастроения(з.ключ)}">`
      + `<div class="hud-jv-tp-platen" aria-hidden="true"><i class="knob"></i><i class="roll"></i><i class="knob"></i><i class="bail"></i></div>`
      + `<div class="hud-jv-tp-paper">${приметы}<span class="hud-jv-tp-stamp" style="--sr:${ф(-18 + r() * 14)}deg" aria-hidden="true">${ико(з.значок || 'heart')}</span><p class="head" data-i18n-skip>${э(з.время)}${з.автор ? ` — ${э(имя(з.автор)).toUpperCase()}` : ''}</p>`
      + (з.слово ? `<p class="red">[<span>настроение</span>: ${свои(з.слово)}]</p>` : '')
      + `<div class="hud-jv-tp-text" data-i18n-skip>${з.текст}<i class="caret" aria-hidden="true"></i></div>${иксы}</div></article>`;
  }).join('') + `</div>`;
}

export function видДневника(записи, вид) {
  if (!Array.isArray(записи) || !записи.length) return '';
  if (вид === 'book') return дневникРазворот(записи);
  if (вид === 'blog') return дневникБлог(записи);
  if (вид === 'type') return дневникМашинка(записи);
  return '';
}

// ============================================================================
// ДНЕВНИК ТЕЛА
// записи — [{ автор, время, текст (HTML), настроение, накал: calm|warm|peak|after }]
// ============================================================================

const НАКАЛ = { calm: 1, warm: 2, peak: 4, after: 3 };

/** Шёлк: атласная карточка с бегущим бликом, кружевной кромкой, бантом
 *  и нитью жемчуга — сколько жемчужин светится, такой накал. */
function телоШёлк(записи) {
  return `<div class="hud-v hud-jv hud-jv-silk">` + записи.map((з) => {
    const н = НАКАЛ[з.накал] || 1;
    const жемчуг = [1, 2, 3, 4].map(k => `<i class="${k <= н ? 'on' : ''}"></i>`).join('');
    return `<article class="hud-jv-sk-card is-${з.накал || 'calm'}">`
      + `<i class="hud-jv-sk-lace top" aria-hidden="true"></i><i class="hud-jv-sk-sheen" aria-hidden="true"></i>`
      + `<svg class="hud-jv-sk-bow" viewBox="0 0 64 40" aria-hidden="true"><path class="loop" d="M32 20C24 6 6 4 6 16s16 10 26 4Z"/><path class="loop" d="M32 20C40 6 58 4 58 16s-16 10-26 4Z"/>`
      + `<path class="tail" d="M31 21 22 38l6-2 3 3 1-18Z"/><path class="tail" d="M33 21l9 17-6-2-3 3-1-18Z"/><ellipse class="knot" cx="32" cy="20" rx="4.5" ry="5"/>`
      + `<path class="fold" d="M12 13c5-2 11 0 16 5M52 13c-5-2-11 0-16 5"/></svg>`
      + `<span class="hud-jv-sk-pearls" aria-hidden="true">${жемчуг}</span>`
      + `<header class="hud-jv-sk-head">${з.автор ? `<b data-i18n-skip>${э(имя(з.автор))}</b>` : ''}${з.время ? `<time data-i18n-skip>${э(з.время)}</time>` : ''}</header>`
      + `<div class="hud-jv-sk-text" data-i18n-skip>${з.текст}</div>`
      + (з.настроение ? `<p class="hud-jv-sk-tag"><span data-i18n-skip>${э(з.настроение)}</span></p>` : '')
      + `<i class="hud-jv-sk-lace bottom" aria-hidden="true"></i></article>`;
  }).join('') + `</div>`;
}

// Отпечаток губ: верхняя губа «лук Купидона», нижняя полнее, бороздки — дугами.
const ГУБЫ = '<path class="up" d="M6 22C12 12 20 9 26 13c2 1 4 1 6 0 6-4 14-1 20 9-8-1-14-3-20-2-6-1-12 1-26 2Z"/>'
  + '<path class="lo" d="M6 23c10 1 18 1 26 0 8 1 14 0 20-1-4 10-14 16-23 16S10 32 6 23Z"/>'
  + '<path class="crease" d="M14 18c4-2 8-2 12 0M34 18c4-2 8-2 12 0M12 28c5 3 10 4 17 4M33 31c5 0 9-2 13-5M22 33c2 2 5 2 8 2"/>';

/** Поцелуй: записка со следом помады в углу — чем горячее, тем ярче, на
 *  пике и после — второй, смазанный; настроение выведено помадой от руки. */
function телоПоцелуй(записи) {
  return `<div class="hud-v hud-jv hud-jv-kiss">` + записи.map((з, i) => {
    const r = сид(з.текст, i);
    const след = (класс, наклон) => `<svg class="hud-jv-ks-lips ${класс}" viewBox="0 0 58 42" style="--r:${наклон}deg" aria-hidden="true">${ГУБЫ}</svg>`;
    const второй = з.накал === 'peak' || з.накал === 'after' ? след('is-smudge', ф(-30 + r() * 20)) : '';
    return `<article class="hud-jv-ks-note is-${з.накал || 'calm'}">${след('is-main', ф(10 + r() * 16))}${второй}`
      + `<header class="hud-jv-ks-head">${з.автор ? `<b data-i18n-skip>${э(имя(з.автор))}</b>` : ''}${з.время ? `<time data-i18n-skip>${э(з.время)}</time>` : ''}</header>`
      + `<div class="hud-jv-ks-text" data-i18n-skip>${з.текст}</div>`
      + (з.настроение ? `<p class="hud-jv-ks-scrawl" data-i18n-skip>${э(з.настроение)}</p>` : '') + `</article>`;
  }).join('') + `</div>`;
}

// Градусы тепловизора по накалу.
const ГРАДУСЫ = { calm: 36.6, warm: 37.4, peak: 38.3, after: 37.0 };

/** Термограмма: кадр тепловизора — пятна тепла палитрой «железо»,
 *  прицел с замером, шкала справа с меткой, бегущая строка развёртки. */
function телоТермограмма(записи) {
  return `<div class="hud-v hud-jv hud-jv-therm">` + записи.map((з, i) => {
    const r = сид(з.текст + з.время, i);
    const н = НАКАЛ[з.накал] || 1;
    const t = ГРАДУСЫ[з.накал] || 36.6;
    const пятна = Array.from({ length: 3 + Math.min(2, н - 1) }, (_, k) => `<i style="--x:${Math.round(10 + r() * 80)}%;--y:${Math.round(10 + r() * 70)}%;--s:${Math.round(42 + r() * 40 + н * 10)}%;--d:${ф(k * 1.7)}s"></i>`).join('');
    const метка = огр(((t - 35.5) / 3.5) * 100, 4, 96);
    return `<article class="hud-jv-th-frame lvl-${н}">`
      + `<div class="hud-jv-th-heat" aria-hidden="true">${пятна}</div><i class="hud-jv-th-scan" aria-hidden="true"></i>`
      + `<i class="hud-jv-th-cross" aria-hidden="true"></i>`
      + `<header class="hud-jv-th-head"><span class="rec" aria-hidden="true"></span>${з.автор ? `<b data-i18n-skip>${э(имя(з.автор))}</b>` : '<b>объект</b>'}${з.время ? `<time data-i18n-skip>${э(з.время)}</time>` : ''}`
      + `<span class="temp">${t.toFixed(1)}°</span></header>`
      + `<div class="hud-jv-th-scale" aria-hidden="true"><i style="--m:${ф(метка)}%"></i><small>39°</small><small>35°</small></div>`
      + `<div class="hud-jv-th-text" data-i18n-skip>${з.текст}</div>`
      + (з.настроение ? `<p class="hud-jv-th-mood">${ико('thermo')}${свои(з.настроение)}</p>` : '') + `</article>`;
  }).join('') + `</div>`;
}

export function видДневникаТела(записи, вид) {
  if (!Array.isArray(записи) || !записи.length) return '';
  if (вид === 'silk') return телоШёлк(записи);
  if (вид === 'kiss') return телоПоцелуй(записи);
  if (вид === 'therm') return телоТермограмма(записи);
  return '';
}

// ============================================================================
// ПЕРЕХВАТЫ
// переписки — [{ цель, чат, состав, строки: [{ кто, кому, текст, время, статус,
//   удалено, черновик, вложение, исходящее }] }]
// ============================================================================

// Теги сообщения ([PHOTO: …], [VOICE_0:34], [CALL: …]) — коротким словом:
// в этих видах нет пузырей с картинками, есть строка протокола.
const ТЕГИ = [
  [/^(?:PHOTO|ФОТО|IMG|IMAGE|СНИМОК)$/i, 'снимок'], [/^(?:VIDEO|ВИДЕО)$/i, 'видео'], [/^(?:VOICE|ГОЛОСОВОЕ|АУДИО|AUDIO)$/i, 'голосовое'],
  [/^(?:CALL|ЗВОНОК)$/i, 'звонок'], [/^(?:POLL|ОПРОС)$/i, 'опрос'], [/^(?:FWD|FORWARD|ПЕРЕСЛАНО)$/i, 'переслано'],
  [/^(?:REPLY|ОТВЕТ|RE)$/i, 'в ответ'], [/^(?:STICKER|СТИКЕР)$/i, 'стикер'], [/^(?:FILE|ФАЙЛ|DOC)$/i, 'файл'],
  [/^(?:LOCATION|ГЕО|GEO|МЕСТО)$/i, 'геометка'], [/^(?:BY)$/i, 'писал(а)'],
];
export function строкаПротокола(текст) {
  let вложение = '';
  const s = String(текст || '').replace(/\[([A-Za-zА-Яа-яЁё]+)(?:_(\d{1,2}:\d{2}))?\s*(?::\s*([^\]]*))?\]/g, (всё, тег, длина, суть) => {
    const т = ТЕГИ.find(([re]) => re.test(тег));
    if (!т) return всё;
    if (!вложение && !/^(?:в ответ|писал\(а\))$/.test(т[1])) вложение = т[1];
    const тело = String(суть || '').split('::').map(x => x.trim()).filter(Boolean);
    // Опрос: «вопрос ;; вариант = кто» — только вопрос.
    const кратко = т[1] === 'опрос' ? (тело[0] || '').split(';;')[0].trim() : т[1] === 'в ответ' ? (тело[1] || тело[0] || '') : тело.join(' — ');
    return `⟨${т[1]}${длина ? ' ' + длина : ''}${кратко ? ': ' + кратко : ''}⟩`;
  }).replace(/\s+/g, ' ').trim();
  return { текст: s, вложение };
}
const тон = (кто) => (hudHashSeed(String(кто || '').toLowerCase()) >>> 0) % 4;
// Разметка строки: ⟨снимок: …⟩ — отдельной меткой. Слово метки идёт через
// словарь, суть вложения и текст сообщения — мимо него (слова модели).
const метки = (s, класс) => String(s || '').split(/(⟨[^⟩]*⟩)/).filter(Boolean).map(кусок => {
  const м = кусок.match(/^⟨([^:\d⟩]+?)(?: (\d{1,2}:\d{2}))?(?:: ([^⟩]*))?⟩$/);
  if (!м) return свои(кусок);
  const суть = м[3] ? (м[1] === 'звонок' ? ': ' + м[3].split(/,\s*/).map(w => `<span>${э(w)}</span>`).join(', ') : ': ' + свои(м[3])) : '';
  return `<span class="${класс}"><span>${э(м[1])}</span>${м[2] ? ' ' + э(м[2]) : ''}${суть}</span>`;
}).join('');
const непрочитано = (с) => /unread|не прочитан/i.test(с.статус) && !с.удалено && !с.черновик;

// Вкладки переписок — тот же механизм, что у прежнего телефона (events.js,
// .hud-phone-subtab → .hud-phone-subbody): выбранная вкладка переживает
// перерисовку карточки. Подпись — чей телефон; у двух переписок одного
// человека — с собеседником: «Тео ↔ Корд».
function вкладки(переписки, uid, класс, кнопка) {
  const целей = new Map();
  переписки.forEach(п => целей.set(п.цель.toLowerCase(), (целей.get(п.цель.toLowerCase()) || 0) + 1));
  return `<nav class="hud-iv-tabs ${класс}" role="tablist">` + переписки.map((п, k) => {
    const подпись = целей.get(п.цель.toLowerCase()) > 1 ? первое(п.цель) + ' ↔ ' + первое(п.чат) : имя(п.цель);
    const новых = п.строки.filter(непрочитано).length;
    return `<button type="button" role="tab" class="hud-phone-subtab hud-iv-tab${k ? '' : ' active'}" data-subtarget="iv-${uid}-${k}">${кнопка(п, k, подпись, новых)}</button>`;
  }).join('') + `</nav>`;
}
const панель = (uid, k, класс, тело) => `<section class="hud-phone-subbody hud-iv-pane ${класс}${k ? '' : ' active'}" id="iv-${uid}-${k}" role="tabpanel">${тело}</section>`;

/** Терминал: консоль расшифровки — окно с заголовком, вкладки-терминалы
 *  tty1…ttyN, команды подключения, прогресс расшифровки, лог сообщений
 *  цветом отправителя, восстановленное удалённое, мигающий курсор;
 *  развёртка, свечение, сбой заголовка. */
function перехватыТерминал(переписки, uid) {
  const табы = вкладки(переписки, uid, 'hud-iv-tm-tabs', (п, k, подпись, новых) => `<i>tty${k + 1}</i><span data-i18n-skip>${э(подпись)}</span>${новых ? `<b class="n">${новых}</b>` : ''}`);
  return `<div class="hud-v hud-iv hud-iv-term"><div class="hud-iv-tm-win">`
    + `<div class="hud-iv-tm-bar"><i></i><i></i><i></i><b data-glitch="intercept@tavern" data-i18n-skip>intercept@tavern</b><small>каналов: ${переписки.length}</small></div>${табы}`
    + переписки.map((п, k) => {
      const ключ = ((hudHashSeed(п.цель + п.чат) >>> 0) % 65536).toString(16).padStart(4, '0').toUpperCase();
      const строки = п.строки.map(с => {
        const кто = имя(с.кто).toUpperCase();
        const кому = с.кому ? ' → ' + имя(с.кому).toUpperCase() : '';
        const пометка = с.удалено ? '<em class="del">восстановлено из удалённых</em>' : с.черновик ? '<em class="draft">черновик · не отправлено</em>' : непрочитано(с) ? '<em class="unread">не прочитано</em>' : '';
        return `<p class="ln t${тон(с.кто)}${с.удалено ? ' is-del' : ''}${с.черновик ? ' is-draft' : ''}"><span class="ts" data-i18n-skip>[${э(с.время || '--:--')}]</span> <b data-i18n-skip>${э(кто)}${э(кому)}:</b> <span class="msg">${метки(с.текст, 'att')}</span>${пометка}</p>`;
      }).join('');
      return панель(uid, k, 'hud-iv-tm-body', `<p class="cmd" data-i18n-skip><span class="pr">$</span> tap --target "${э(имя(п.цель))}" --chat "${э(имя(п.чат))}"</p>`
        + `<p class="sys">handshake… <span>ключ</span> <span data-i18n-skip>0x${ключ}</span> <span class="ok">OK</span></p>`
        + `<p class="sys prog"><span>расшифровка</span> <span class="bar"><i></i></span> 100%</p>`
        + (п.состав ? `<p class="sys"><span>участники</span>: ${свои(п.состав)}</p>` : '') + строки
        + `<p class="cmd last"><span class="pr">$</span> <i class="cur" aria-hidden="true"></i></p>`);
    }).join('') + `</div></div>`;
}

/** Стенограмма: протокол прослушки на листе — вкладки-корешки дел сверху,
 *  шапка с номером, объектом и каналом, нумерация строк на полях, говорящий
 *  заглавными, удалённое под плашкой, заметки на полях, подпись расшифровщика. */
function перехватыСтенограмма(переписки, uid) {
  const номер = (п) => ((hudHashSeed(п.цель + '|' + п.чат) >>> 0) % 9000) + 1000;
  const табы = вкладки(переписки, uid, 'hud-iv-st-tabs', (п, k, подпись, новых) => `<small>№ ${номер(п)}</small><span data-i18n-skip>${э(подпись)}</span>${новых ? `<b class="n">${новых}</b>` : ''}`);
  return `<div class="hud-v hud-iv hud-iv-sten">${табы}` + переписки.map((п, k) => {
    const ряды = п.строки.map((с, i) => {
      const поле = с.удалено ? 'удалено отправителем' : с.черновик ? 'не отправлено' : непрочитано(с) ? 'не прочитано' : с.вложение ? с.вложение : '';
      const текст = с.удалено ? `<span class="redact" data-i18n-skip>${э(с.текст)}</span>` : метки(с.текст, 'att');
      return `<li class="${с.удалено ? 'is-del' : ''}${с.черновик ? ' is-draft' : ''}"><span class="no">${i + 1}</span><span class="tm" data-i18n-skip>${э(с.время)}</span>`
        + `<p><b data-i18n-skip>${э(имя(с.кто)).toUpperCase()}${с.кому ? ` <small>→ ${э(имя(с.кому))}</small>` : ''}.</b> ${текст}</p>${поле ? `<span class="margin">${э(поле)}</span>` : ''}</li>`;
    }).join('');
    return панель(uid, k, 'hud-iv-st-sheet', `<header class="hud-iv-st-head"><small>протокол прослушивания</small><b>№ ${номер(п)}</b>`
      + `<dl><div><dt>объект</dt><dd>${свои(имя(п.цель))}</dd></div><div><dt>канал</dt><dd>${свои(имя(п.чат))}</dd></div>`
      + (п.состав ? `<div><dt>участники</dt><dd>${свои(п.состав)}</dd></div>` : '') + `</dl></header>`
      + `<ol class="hud-iv-st-lines">${ряды}</ol>`
      + `<footer class="hud-iv-st-foot"><span>расшифровал</span><i class="sign" aria-hidden="true"><svg viewBox="0 0 90 22"><path d="M2 16c6-10 10-12 12-6s-2 9 2 6 6-12 10-9-1 10 4 8 8-9 12-7 0 7 5 6 10-6 15-5 8 3 16 1"/></svg></i><span class="cnt">строк: ${п.строки.length}</span></footer>`);
  }).join('') + `</div>`;
}

/** Катушки: катушечный магнитофон прослушки — две бобины с лентой через
 *  головку, ряд клавиш-каналов (нажатая утоплена, горит лампа), ярлык
 *  объекта со счётчиком; сообщения — дорожками с таймкодом и формой волны.
 *  Удалённое — стёртый участок ленты. */
function перехватыКатушки(переписки, uid) {
  const бобина = (класс) => `<svg class="reel ${класс}" viewBox="0 0 60 60" aria-hidden="true"><circle class="tape" cx="30" cy="30" r="27"/><circle class="flange" cx="30" cy="30" r="22"/>`
    + `<g class="spokes">${[0, 120, 240].map(a => `<path transform="rotate(${a} 30 30)" d="M30 30 L24 12 A19 19 0 0 1 36 12 Z"/>`).join('')}</g><circle class="hub" cx="30" cy="30" r="5"/></svg>`;
  const табы = вкладки(переписки, uid, 'hud-iv-rl-keys', (п, k, подпись, новых) => `<i class="lamp" aria-hidden="true"></i><small>${k + 1}</small><span data-i18n-skip>${э(подпись)}</span>${новых ? `<b class="n">${новых}</b>` : ''}`);
  return `<div class="hud-v hud-iv hud-iv-reel"><div class="hud-iv-rl-deck">`
    + `<div class="hud-iv-rl-top">${бобина('l')}<svg class="path" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 26 L36 14 L50 18 L64 14 L100 26"/><rect class="head" x="44" y="14" width="12" height="9" rx="2"/></svg>${бобина('r')}`
    + `<span class="rec"><i aria-hidden="true"></i>запись</span></div>${табы}`
    + переписки.map((п, k) => {
      const всего = п.строки.reduce((a, с) => a + с.текст.length, 0);
      const счёт = String((hudHashSeed(п.чат) >>> 0) % 9000 + всего % 1000).padStart(4, '0').slice(-4);
      const дорожки = п.строки.map((с, i) => {
        const r = сид(с.текст, i);
        const волна = с.удалено ? '<i class="erased"></i>' : Array.from({ length: 18 }, () => `<i style="--h:${Math.round(18 + r() * 82)}%"></i>`).join('');
        return `<li class="t${тон(с.кто)}${с.удалено ? ' is-del' : ''}${с.черновик ? ' is-draft' : ''}"><span class="code">${э(с.время || '--:--')}</span>`
          + `<span class="wave" aria-hidden="true">${волна}</span><b data-i18n-skip>${э(имя(с.кто))}</b>`
          + `<p>${с.удалено ? `<em>стёрто</em> ` : с.черновик ? `<em>не ушло</em> ` : ''}${метки(с.текст, 'att')}</p></li>`;
      }).join('');
      return панель(uid, k, 'hud-iv-rl-pane', `<div class="hud-iv-rl-label"><div><small>объект</small><b data-i18n-skip>${э(имя(п.цель))}</b><small>канал</small><b data-i18n-skip>${э(имя(п.чат))}</b></div>`
        + `<div class="counter" aria-hidden="true">${счёт.split('').map(ц => `<i>${ц}</i>`).join('')}</div></div><ol class="hud-iv-rl-tracks">${дорожки}</ol>`);
    }).join('') + `</div></div>`;
}

export function видПерехватов(переписки, вид, uid = 'iv') {
  if (!Array.isArray(переписки) || !переписки.length) return '';
  if (вид === 'term') return перехватыТерминал(переписки, uid);
  if (вид === 'sten') return перехватыСтенограмма(переписки, uid);
  if (вид === 'reel') return перехватыКатушки(переписки, uid);
  return '';
}
