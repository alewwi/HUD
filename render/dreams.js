// hud-manager/render/dreams.js
//
// Домен «Сны»: пузыри, треснувшее стекло и записи сновидений — и виды блока
// на выбор (Кастомизация → Блоки: Сны → dreamsView). Модель пишет только
// текст сна и толкование (dr: tx, mn); всё остальное — кому снится, кошмар это
// или воспоминание, какие образы в нём — HUD выводит из текста сам.
// Оформление новых видов — css/dream-views.css.

import { escapeHtml, hudHasMeaningfulValue, hudHashSeed, имяБезПриставки, инициалыИмени } from '../utils.js?v=23.88.6';
import { гдеУпомянут } from '../names.js?v=23.88.6';
import { видБлока } from './views.js?v=23.88.6';
import { ико } from './view-icons.js?v=23.88.6';

function buildDreamBubblesHtml() {
  let bubbles = '';
  for (let i = 1; i <= 5; i++) bubbles += `<span class="hud-dream-bubble b${i}"></span>`;
  return `<div class="hud-dream-haze"></div><div class="hud-dream-bubbles">${bubbles}</div>`;
}

function buildDreamGlassHtml() {
  return `<div class="hud-dream-glass" aria-hidden="true">
    <div class="hud-dream-pane"></div>
    <svg class="hud-dream-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g class="crack-set c1">
        <path d="M52 0 L48 22 L44 48"/>
        <path d="M48 22 L76 30"/>
        <path d="M48 22 L18 38"/>
      </g>
      <g class="crack-set c2">
        <path d="M44 48 L38 100"/>
        <path d="M44 48 L72 74 L94 100"/>
        <path d="M18 38 L0 54"/>
        <path d="M76 30 L100 24"/>
        <path d="M76 30 L90 62"/>
        <path d="M48 22 L62 8"/>
      </g>
      <g class="crack-set c3">
        <path d="M38 100 L14 82 L0 100"/>
        <path d="M72 74 L54 96"/>
        <path d="M18 38 L8 14 L0 10"/>
        <path d="M90 62 L100 86"/>
        <path d="M44 48 L28 62"/>
        <path d="M76 30 L68 12"/>
      </g>
    </svg>
    <span class="hud-dream-shard sh1"></span><span class="hud-dream-shard sh2"></span><span class="hud-dream-shard sh3"></span>
    <span class="hud-dream-shard sh4"></span><span class="hud-dream-shard sh5"></span><span class="hud-dream-shard sh6"></span>
    <span class="hud-dream-shard sh7"></span><span class="hud-dream-shard sh8"></span>
  </div>`;
}

// --- Разбор сна по тексту ---------------------------------------------------------

// Тип сна. Порядок значим: кошмар сильнее всего — «кошмар о детстве» всё равно кошмар.
const ТИПЫ = [
  { ключ: 'nightmare', имя: 'кошмар', значок: 'ghost', rx: /кошмар|ужас|страх|крич|крик|кров|смерт|умир|мертв|погон|преслед|гонит|тонет|тонул|задыха|разбива|горит|пожар|не может пошевел|паралич|(?<![\p{L}])пул(?:я|и|ей|ями)(?![\p{L}])|выстрел|перестрел|застрел|(?<![\p{L}])ран(?:а|ы|у|ой|ам|ами)(?![\p{L}])|убий|убива|труп|отвалива|разлага|гниёт|гниет|чудовищ|nightmare|horror|blood|death|drown|chase|bullet|wound|corpse/iu },
  { ключ: 'memory', имя: 'воспоминание', значок: 'film', rx: /вспомина|детств|как тогда|как в тот|прошл|памят|юност|школьн|remember|childhood|memory/i },
  { ключ: 'wish', имя: 'мечта', значок: 'moonstar', rx: /мечта|мечтает|желани|свадьб|родил|счаст|вместе|обнима|целу|играет|смеёт|смеет|летит|летал|полёт|полет|свобод|dream of|wish/i },
];
const ПРОСТО_СОН = { ключ: 'dream', имя: 'сон', значок: 'moon' };

// Образы сна — как статьи сонника. Не больше трёх, в порядке появления в тексте.
const ОБРАЗЫ = [
  { имя: 'вода', значок: 'wave', rx: /(?<![\p{L}])(?:вод[аеуыо]|мор[еяю]|океан|рек[аеиу]|озер|тону|тонет|волн|дожд|water|sea|ocean|river|rain)/iu },
  { имя: 'падение', значок: 'fall', rx: /пада|упал|обрыв|пропаст|бездн|(?<![\p{L}])fall/iu },
  { имя: 'погоня', значок: 'run', rx: /погон|преслед|бежит|бежал|убега|гонит|(?<![\p{L}])(?:chase|running)/iu },
  { имя: 'дом', значок: 'house', rx: /(?<![\p{L}])(?:дом(?:а|е|у|ой)?(?![\p{L}])|квартир|комнат|спальн|кухн|house|home|room)/iu },
  { имя: 'огонь', значок: 'flame', rx: /(?<![\p{L}])(?:огон|огн[яеи]|пожар|горит|плам|fire|flame)/iu },
  { имя: 'смерть', значок: 'skull', rx: /смерт|умер|умира|мертв|могил|похорон|(?<![\p{L}])кров[ьи]|(?<![\p{L}])(?:death|dead|blood|grave)/iu },
  { имя: 'полёт', значок: 'kite', rx: /(?<![\p{L}])(?:лет(?:ит|ал|ать|ят)|полёт|полет|крыль|небо|облак|fly|flying|flight|sky)/iu },
  { имя: 'музыка', значок: 'music', rx: /музык|рояль|рояле|пиани|песн|колыбел|мелоди|скрипк|(?<![\p{L}])(?:music|song|piano)/iu },
  { имя: 'ребёнок', значок: 'ball', rx: /ребён|ребен|малыш|(?<![\p{L}])доч|(?<![\p{L}])сын|младен|родилас|родился|(?<![\p{L}])(?:baby|child)/iu },
  { имя: 'зеркало', значок: 'eye', rx: /зеркал|отражени|двойник|(?<![\p{L}])(?:mirror|reflection)/iu },
  { имя: 'ключ и дверь', значок: 'key', rx: /(?<![\p{L}])(?:ключ|замо[кч]|запер|двер|key|lock|door)/iu },
  { имя: 'лес', значок: 'leaf', rx: /(?<![\p{L}])(?:лес[ау]?|дерев|сад[уа]?|цвет[ыо]|трав|forest|tree|garden)/iu },
  { имя: 'холод', значок: 'snow', rx: /(?<![\p{L}])(?:снег|холод|мороз|лёд|лед[яо]|ледян|snow|cold|ice)/iu },
  { имя: 'ночь', значок: 'moonstar', rx: /(?<![\p{L}])(?:лун[аеуы]|звёзд|звезд|ночь|ночн|темнот|moon|star|night)/iu },
  { имя: 'письмо', значок: 'letter', rx: /(?<![\p{L}])(?:письм|записк|конверт|letter)/iu },
  { имя: 'лабиринт', значок: 'cage', rx: /клетк|решётк|решетк|тюрьм|лабиринт|стеллаж|библиотек|коридор|лестниц|выше и выше|бесконечн|(?<![\p{L}])(?:cage|prison|maze|library|corridor)/iu },
];

/** Что HUD видит в сне: кому снится, тип, образы. Экспорт — для тестов и стенда. */
export function разобратьСон(сон, люди = []) {
  const текст = пробелы(сон && сон.text || '');
  // «Сон без привычных кошмаров» — не кошмар: отрицание перед словом не считаем.
  const безОтрицаний = текст.replace(/(?<![\p{L}])(?:без|нет|ни)\s+(?:\p{L}+\s+)?(?:кошмар|страх|ужас)\p{L}*|(?<![\p{L}])(?:no|without|not a|free of)\s+(?:\p{L}+\s+)?(?:nightmares?|fear|terror|horror)/giu, '');
  const тип = ТИПЫ.find(т => т.rx.test(безОтрицаний)) || ПРОСТО_СОН;
  const образы = ОБРАЗЫ.map(о => { const m = текст.match(о.rx); return m ? { ...о, где: m.index } : null; })
    .filter(Boolean).sort((a, b) => a.где - b.где).slice(0, 3);
  // Кому снится: первый из людей сцены, кто назван в тексте («Марку снится…»).
  const кто = (Array.isArray(люди) ? люди : []).map(и => ({ и, где: позицияИмени(текст, и) })).filter(x => x.где >= 0).sort((a, b) => a.где - b.где)[0];
  return { текст, смысл: значимо(сон && сон.meaning) ? пробелы(сон.meaning) : '', тип, образы, кто: кто ? имяБезПриставки(кто.и) : '' };
}
function позицияИмени(текст, имя) {
  // Позицию даёт само сравнение имён: «Тристан» в тексте и Tristan Kingsley в
  // списке — один человек; раньше транслит считался названным «в конце».
  return гдеУпомянут(текст, имя);
}
const значимо = (v) => { const s = String(v ?? '').trim().toLowerCase(); return !!s && s !== 'none' && s !== 'empty' && /\p{L}/u.test(s); };
// U+2800 (пустой символ Брайля) и широкий пробел модели ставят вместо пробелов:
// строки переносятся, но промежутки между словами шире обычных.
const пробелы = (v) => String(v ?? '').replace(/[\u2800\u3000]/g, ' ');

const лицо = (кто) => кто ? `<i class="hud-dv-face" style="--тон:${hudHashSeed(кто) % 70 - 35}" aria-hidden="true">${escapeHtml(инициалыИмени(кто))}</i>` : '';
const ярлыкТипа = (т) => `<span class="hud-dv-type t-${т.ключ}">${ико(т.значок)}${т.имя}</span>`;
const образыHTML = (о, класс = 'hud-dv-motifs') => о.length ? `<span class="${класс}">${о.map(x => `<span>${ико(x.значок)}${x.имя}</span>`).join('')}</span>` : '';

// --- Виды -------------------------------------------------------------------------

// Облака: сон — облако мысли над спящим, снизу точки «пузыря», смысл — записка.
function видОблака(сны) {
  return `<div class="hud-dv hud-dv-clouds">${сны.map((с, i) => `<div class="hud-dv-cloud t-${с.тип.ключ}" style="--i:${i}">`
    + `<div class="hud-dv-head">${лицо(с.кто)}<b>${с.кто ? escapeHtml(с.кто) : 'Сон'}</b>${ярлыкТипа(с.тип)}</div>`
    + `<div class="hud-dv-puff"><i class="hud-dv-fx" aria-hidden="true"></i><p>${escapeHtml(с.текст)}</p>${образыHTML(с.образы)}</div>`
    + `<span class="hud-dv-dots" aria-hidden="true"><i></i><i></i><i></i></span>`
    + (с.смысл ? `<div class="hud-dv-note">${ико('sparkle')}<span><small>смысл</small>${escapeHtml(с.смысл)}</span></div>` : '')
    + `</div>`).join('')}</div>`;
}

// Сонник: статья словаря — заглавный образ, «см. также», текст и толкование.
// На полях — пометка читателя: у кошмара клякса, у воспоминания засушенный
// лист, у мечты звезда, у сна — месяц. Закладка-ленточка цвета типа.
const ПОМЕТКИ = { nightmare: 'drop', memory: 'leaf', wish: 'star', dream: 'moon' };
function видСонник(сны) {
  return `<div class="hud-dv hud-dv-book">${сны.map(с => {
    const [главный, ...ещё] = с.образы;
    const слово = главный ? главный.имя : с.тип.имя;
    return `<article class="hud-dv-entry t-${с.тип.ключ}"><i class="hud-dv-ribbon" aria-hidden="true"></i><span class="hud-dv-mark" aria-hidden="true">${ико(ПОМЕТКИ[с.тип.ключ] || 'moon')}</span>`
      + `<header><span class="hud-dv-word">${ико(главный ? главный.значок : с.тип.значок)}${escapeHtml(слово)}</span>`
      + `<span class="hud-dv-meta">${с.кто ? escapeHtml(с.кто) + ' · ' : ''}${с.тип.имя}</span></header>`
      + (ещё.length ? `<div class="hud-dv-see">см. также: ${ещё.map(x => `<span>${x.имя}</span>`).join(', ')}</div>` : '')
      + `<p class="hud-dv-tale">${escapeHtml(с.текст)}</p>`
      + (с.смысл ? `<p class="hud-dv-gloss"><b>Толкование.</b> <span class="hud-dv-hl">${escapeHtml(с.смысл)}</span></p>` : '')
      + `</article>`;
  }).join('')}</div>`;
}

// Ночное небо: звёзды, луна цвета типа сна; смысл в тумане — нажми, чтобы рассеять.
function видНочь(сны) {
  return `<div class="hud-dv hud-dv-night">${сны.map((с, i) => `<div class="hud-dv-sky t-${с.тип.ключ}" role="button" tabindex="0" aria-label="Рассеять туман над смыслом" style="--seed:${hudHashSeed(с.текст) % 100}">`
    + `<span class="hud-dv-stars" aria-hidden="true"></span><span class="hud-dv-moon" aria-hidden="true"></span><span class="hud-dv-fx" aria-hidden="true"></span>`
    + `<div class="hud-dv-head">${лицо(с.кто)}<b>${с.кто ? escapeHtml(с.кто) : 'Сон'}</b>${ярлыкТипа(с.тип)}</div>`
    + `<p class="hud-dv-tale">${escapeHtml(с.текст)}</p>${образыHTML(с.образы)}`
    + (с.смысл ? `<div class="hud-dv-fog"><small>${ико('sparkle')}смысл</small><p>${escapeHtml(с.смысл)}</p><span class="hud-dv-fog-veil">нажми, чтобы рассеять туман</span></div>` : '')
    + `</div>`).join('')}</div>`;
}

// Ловец снов: обруч с паутиной, на нитях — перья с образами сна. По поверью
// дурной сон запутывается в сети и сгорает с рассветом, добрый проходит
// сквозь центр и стекает по перьям к спящему. Так и рисуем: у кошмара в сети
// тёмный узел, у остальных сна светится бусина в середине.
function паутина(seed) {
  const N = 8, ц = 40, R = [33, 24, 15.5, 8];
  const точка = (j, k) => { const a = (seed % 45) * Math.PI / 180 + (k + j / 2) * 2 * Math.PI / N; return (ц + R[j] * Math.cos(a)).toFixed(1) + ' ' + (ц + R[j] * Math.sin(a)).toFixed(1); };
  // Петли: от каждой точки внешнего круга к средней точке внутреннего и дальше.
  let d = '';
  for (let j = 0; j < R.length - 1; j++) d += 'M' + Array.from({ length: N + 1 }, (_, k) => точка(j, k % N) + ' L' + точка(j + 1, k % N)).join(' L') + ' ';
  return d;
}
function обруч(с) {
  const seed = hudHashSeed(с.текст);
  const кошмар = с.тип.ключ === 'nightmare';
  const перья = (с.образы.length ? с.образы : [null, null, null]).map((о, i) => `<span class="hud-dv-feather f${i + 1}"${о ? ` title="${о.имя}"` : ''}>`
    + (о ? ико(о.значок, 'hud-dv-bead') : '<i class="hud-dv-bead"></i>')
    + `<svg class="hud-dv-quill" viewBox="0 0 12 34" aria-hidden="true"><path d="M6 1C11 8 11.5 21 6 33C.5 21 1 8 6 1Z"/><path d="M6 4V33M6 12l3-2M6 17l-3-2M6 22l3-2M6 27l-3-2"/></svg></span>`).join('');
  return `<div class="hud-dv-hoop" aria-hidden="true"><svg viewBox="0 0 80 80">`
    + `<circle class="ring" cx="40" cy="40" r="35"/><circle class="wrap" cx="40" cy="40" r="35"/>`
    + `<path class="web" pathLength="100" d="${паутина(seed)}"/>`
    + (кошмар
      ? `<g class="knot" transform="translate(${40 + (seed % 9) - 4} ${40 + (seed % 7) - 3})"><circle r="7.5"/><path d="M-6-2C-2-7 4-6 6-1S1 7-4 4-5-4 1-3s3 4-1 4"/></g>`
      : `<circle class="bead" cx="40" cy="40" r="4.2"/>`)
    + `</svg><span class="hud-dv-hang">${перья}</span></div>`;
}
function видЛовец(сны) {
  return `<div class="hud-dv hud-dv-catcher">${сны.map((с, i) => `<div class="hud-dv-catch t-${с.тип.ключ}" style="--i:${i}">`
    + обруч(с)
    + `<div class="hud-dv-head">${лицо(с.кто)}<b>${с.кто ? escapeHtml(с.кто) : 'Сон'}</b>${ярлыкТипа(с.тип)}</div>`
    + `<p class="hud-dv-tale">${escapeHtml(с.текст)}</p>`
    + `<p class="hud-dv-verdict">${с.тип.ключ === 'nightmare' ? 'Запутался в сети — сгорит с рассветом' : 'Прошёл сквозь центр и стёк по перьям к спящему'}</p>`
    + образыHTML(с.образы)
    + (с.смысл ? `<div class="hud-dv-note">${ико('sparkle')}<span><small>смысл</small>${escapeHtml(с.смысл)}</span></div>` : '')
    + `</div>`).join('')}</div>`;
}

const ВИДЫ = { clouds: видОблака, book: видСонник, night: видНочь, catcher: видЛовец };

export function buildDreamHTML(dreamsData, uid, isChecked, люди = []) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-dream-container"><div class="hud-dream-moon">🌙 Z z z . . .</div>`;
  // Пустые сны («—» при «не спит») отбрасываем сразу: если других нет — как без снов.
  dreamsData = (Array.isArray(dreamsData) ? dreamsData : []).filter(d => значимо(typeof d === 'string' ? d : d && d.text));
  if (dreamsData.length === 0) {
    return html + `<div class="hud-dream-bubble"><div class="hud-dream-text">Снов пока нет</div><div class="hud-dream-meaning">Раздел активен, но в текущем HUD нет записей.</div></div></div></div>`;
  }
  const вид = ВИДЫ[видБлока('dreamsView')];
  if (вид) {
    const сны = dreamsData.map(d => разобратьСон(typeof d === 'string' ? { text: d } : d, люди)).filter(с => значимо(с.текст));
    return html + вид(сны) + `</div></div>`;
  }
  dreamsData.filter(dream => значимо(typeof dream === 'string' ? dream : dream && dream.text)).forEach(dream => {
    html += `<div class="hud-dream-entry" data-crack="0">${buildDreamBubblesHtml()}${buildDreamGlassHtml()}<div class="hud-dream-text">✨ ${escapeHtml(dream.text)}</div>`;
    if (dream.meaning && dream.meaning.toLowerCase() !== 'none' && dream.meaning.toLowerCase() !== 'empty') html += `<div class="hud-dream-meaning"><span class="hud-dream-meaning-label">🔮 Смысл:</span> ${escapeHtml(dream.meaning)}</div>`;
    html += `</div>`;
  });
  return html + `</div></div>`;
}

export function hudHasMeaningfulDreams(items) {
  return Array.isArray(items) && items.some(i => {
    if (typeof i === 'string') return hudHasMeaningfulValue(i) && значимо(i);
    if (!i || typeof i !== 'object') return false;
    return hudHasMeaningfulValue(i.text) && значимо(i.text);
  });
}
