// hud-manager/render/world-views.js
//
// Виды блоков вкладки «Мир» (Кастомизация → Блоки: Мир). У каждого блока —
// прежний вид («как было», его рисуют world.js и world-city.js) и три своих:
// газетная полоса, эфир, приёмник; шёпот, граффити, сарафанное радио… Здесь
// только разметка и отклик на нажатия: строки уже разобраны в world.js и
// world-city.js, модель ничего нового не пишет. Оформление — css/world-views.css.
//
// Без эмодзи: значки — линии из view-icons.js, знаки зодиака — текстовые
// глифы. Числа «для живости» (частоты, просмотры, лайки) — от хэша текста:
// при перерисовке те же.
//
// Нажатия (действиеМира, events.js): у каждого вида своё — настроить волну,
// пустить эфир, оторвать листок, поставить галочку, лайкнуть. Отметки живут
// в памяти страницы (как голоса в новостях) и переживают перерисовку карточки.

import { escapeHtml, hudHashSeed } from '../utils.js?v=23.79.3';
import { ико, ИКОНКИ } from './view-icons.js?v=23.79.3';
import { знакЗодиака } from '../i18n.js?v=23.79.3';

const т = (s) => escapeHtml(String(s ?? ''));
const хэш = (s) => hudHashSeed(String(s ?? ''));
// «Говорят, …» в кавычках-ёлочках: в шёпоте и на стене кавычки лишние.
const безКавычек = (s) => String(s ?? '').trim().replace(/^[«"“„']+\s*/, '').replace(/\s*[»"”']+$/, '').trim();
const корень = (блок, вид, тело) => `<div class="hud-v hud-wv hud-wv-${блок} is-${вид}">${тело}</div>`;
const секция = (блок, заголовок, тело) => `<div class="hud-world-section hud-wv-section" data-wv-block="${блок}"><div class="hud-world-title">${заголовок}</div>${тело}</div>`;
const тыс = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',').replace(/,0$/, '') + ' тыс.' : String(n);

// --- Отметки и кнопки ----------------------------------------------------------
// ключ отметки → true (переключатель) или число (счётчик пересказов).
const отметки = new Map();
const отмечено = (к) => отметки.get(к) === true;
const ключ = (действие, текст, доп = '') => `${действие}|${хэш(текст)}${доп}`;
// Атрибуты кликабельного элемента: роль кнопки, фокус с клавиатуры, нажатость.
function кнопка(действие, к = '', нажата) {
  return ` data-wv="${действие}"${к ? ` data-k="${т(к)}"` : ''} role="button" tabindex="0"${нажата === undefined ? '' : ` aria-pressed="${нажата}"`}`;
}
// Переключатель с памятью: класс is-set и aria-pressed по отметке.
const флажок = (действие, текст, доп = '') => { const к = ключ(действие, текст, доп); return { к, on: отмечено(к), attr: кнопка(действие, к, отмечено(к)), cls: отмечено(к) ? ' is-set' : '' }; };

/* --- Главные новости --------------------------------------------------------
   статьи: [{ title, body, votes: { up, comments } }] */
export function видНовостей(статьи, вид, заголовок) {
  if (!Array.isArray(статьи) || !статьи.length) return '';
  const [первая, ...прочие] = статьи;
  if (вид === 'front') {
    // Первая полоса: шапка газеты, главная статья с буквицей, остальные — колонками;
    // заметка в колонке свёрнута до четырёх строк, нажатие раскрывает.
    const номер = 100 + хэш(статьи.map(с => с.title).join('|')) % 900;
    const статья = (с) => `<article class="story"${с.body ? кнопка('open') + ' aria-expanded="false"' : ''}><h4>${т(безКавычек(с.title))}</h4>${с.body ? `<p>${т(с.body)}</p><span class="more" aria-hidden="true">читать дальше</span>` : ''}</article>`;
    return секция('news', заголовок, корень('news', вид,
      `<header class="mast"><small>Городской выпуск · №${номер}</small><b>Вечерний вестник</b><span class="rule" aria-hidden="true"><i>Цена 5 коп.</i><i>Срочно в номер</i></span></header>`
      + `<article class="lead"><h4>${т(безКавычек(первая.title))}</h4>${первая.body ? `<p>${т(первая.body)}</p>` : ''}</article>`
      + (прочие.length ? `<div class="cols">${прочие.map(статья).join('')}</div>` : '')));
  }
  if (вид === 'tv') {
    // Эфир: экран со студией и плашкой титра; нажатие на сюжет пускает его в эфир.
    return секция('news', заголовок, корень('news', вид,
      `<div class="screen"><span class="live"><i></i>В эфире</span><span class="bug">${ико('antenna')}</span>`
      + `<span class="beams" aria-hidden="true"></span><span class="skyline" aria-hidden="true"></span><span class="scan" aria-hidden="true"></span>`
      + `<div class="lower"><span class="tag">Сюжет 01</span><b>${т(безКавычек(первая.title))}</b></div></div>`
      + `<ol class="rundown">${статьи.map((с, i) => `<li class="${i ? '' : 'is-now'}"${кнопка('air')} data-n="${String(i + 1).padStart(2, '0')}" data-title="${т(безКавычек(с.title))}"><em>${String(i + 1).padStart(2, '0')}</em><div><b>${т(безКавычек(с.title))}</b>${с.body ? `<p>${т(с.body)}</p>` : ''}</div><i class="onair" aria-hidden="true">в эфире</i></li>`).join('')}</ol>`));
  }
  if (вид === 'radio') {
    // Приёмник: шкала частот; нажатие на станцию крутит ручку и переводит стрелку.
    const частота = (с) => 88 + (хэш(с.title) % 200) / 10;
    const где = (мгц) => ((мгц - 87.5) / 21 * 100).toFixed(1);
    const станции = статьи.map(с => ({ ...с, мгц: частота(с) }));
    return секция('news', заголовок, корень('news', вид,
      `<div class="set" style="--knob:${(где(станции[0].мгц) * 3 - 150).toFixed(0)}deg"><div class="dial"><span class="scale" aria-hidden="true">${[88, 92, 96, 100, 104, 108].map(ч => `<s style="--x:${где(ч)}%">${ч}</s>`).join('')}</span>`
      + станции.map((с, i) => `<i class="mark${i ? '' : ' is-on'}" style="--x:${где(с.мгц)}%" aria-hidden="true"></i>`).join('')
      + `<i class="needle" style="--x:${где(станции[0].мгц)}%" aria-hidden="true"></i><span class="glow" aria-hidden="true"></span></div>`
      + `<div class="panel"><span class="grille" aria-hidden="true"></span><span class="lamp" aria-hidden="true"></span><span class="knob" aria-hidden="true"></span><span class="knob is-vol" aria-hidden="true"></span></div></div>`
      + `<ul class="waves">${станции.map((с, i) => `<li class="${i ? '' : 'is-on'}"${кнопка('tune')} data-i="${i}" data-x="${где(с.мгц)}"><span class="mhz">${с.мгц.toFixed(1).replace('.', ',')}<small>FM</small></span><div><b>${т(безКавычек(с.title))}</b>${с.body ? `<p>${т(с.body)}</p>` : ''}</div></li>`).join('')}</ul>`));
  }
  return '';
}

/* --- Слухи ------------------------------------------------------------------
   слухи: строки */
export function видСлухов(слухи, вид, заголовок) {
  const список = (Array.isArray(слухи) ? слухи : []).map(безКавычек).filter(Boolean);
  if (!список.length) return '';
  if (вид === 'whisper') {
    // Шёпот: облачка вполголоса; нажатие — «прислушаться»: слова чётче, круги от шёпота.
    return секция('rumors', заголовок, корень('rumors', вид,
      `<div class="hush">${ико('ear')}<span>говорят, что…</span><small>нажмите, чтобы прислушаться</small></div>`
      + список.map((с, i) => { const ф = флажок('hear', с); return `<p class="w${i % 2 ? ' is-right' : ''}${ф.cls}" style="--d:${(i * .35).toFixed(2)}s"${ф.attr}>${т(с)}</p>`; }).join('')));
  }
  if (вид === 'graffiti') {
    // Граффити: кирпичная стена под фонарём, под свежими надписями — выцветшие
    // старые, обрывок наклеенного плаката, стикер. У каждого слуха свой почерк
    // (объёмные буквы, трафарет, маркер, баллончик) и рисунок рядом; внизу —
    // тротуар с баллончиком. Нажатие — перекрасить надпись.
    const ПОЧЕРК = ['bubble', 'stencil', 'marker', 'spray'];
    const РИСУНОК = {
      crown: 'M3 17l2-9 5 5 2-8 2 8 5-5 2 9Z', arrow: 'M3 15c4-8 10-9 15-6 M14 5l4 4-5 2',
      star: ИКОНКИ.star, heart: ИКОНКИ.heart, eye: ИКОНКИ.eye,
    };
    const рисунки = Object.keys(РИСУНОК);
    return секция('rumors', заголовок, корень('rumors', вид,
      `<span class="lamp" aria-hidden="true"></span><span class="ghost" aria-hidden="true"><i>ЗДЕСЬ БЫЛ</i><i>REGENTS</i><i>2019</i></span>`
      + `<span class="paste" aria-hidden="true"><b>ВСЁ ВРАНЬЁ</b><s></s><s></s></span><span class="slap" aria-hidden="true">слухи</span>`
      + список.map((с) => { const х = хэш(с), р = рисунки[(х >> 3) % рисунки.length]; return `<p class="tag c${х % 5} st-${ПОЧЕРК[(х >> 2) % 4]}" style="--r:${((х % 7) - 3) * .6}deg"${кнопка('spray')}>${т(с)}<svg class="doodle" viewBox="0 0 24 24" aria-hidden="true"><path d="${РИСУНОК[р]}"/></svg><i class="drip" aria-hidden="true"></i></p>`; }).join('')
      + `<span class="walk" aria-hidden="true"><span class="can"></span><span class="cap"></span></span>`));
  }
  if (вид === 'chain') {
    // Сарафанное радио: цепочка ртов и ушей; нажатие — «передать дальше», счёт растёт.
    return секция('rumors', заголовок, корень('rumors', вид,
      `<ol>${список.map((с, i) => { const к = ключ('pass', с), база = 3 + хэш(с) % 40; return `<li${кнопка('pass', к)} data-base="${база}"><span class="node">${ико(i % 2 ? 'ear' : 'lips')}</span><div><small>пересказали <b class="cnt">${база + (отметки.get(к) || 0)}</b> раз</small><p>${т(с)}</p><span class="hint" aria-hidden="true">передать дальше</span></div></li>`; }).join('')}</ol>`));
  }
  return '';
}

/* --- Экономика --------------------------------------------------------------
   строки: [{ имя, значение, изменение, куда }] или { заметка } */
const тренд = (куда) => куда === 'up' ? 'M2 26 L14 20 L22 23 L34 12 L46 15 L58 5' : куда === 'down' ? 'M2 6 L14 12 L22 9 L34 19 L46 16 L58 26' : 'M2 16 L14 14 L22 18 L34 15 L46 17 L58 15';
const ЗНАК = { up: '▲', down: '▼', flat: '•' };
// Значок статьи по названию — линией, без эмодзи; тикер — латинское слово
// названия или первые буквы слов.
const АКТИВЫ = [[/биткоин|btc|крипт|₿/i, 'gem'], [/золот|gold/i, 'crown'], [/нефт|brent|oil|бензин|топлив|дизел|fuel|gas/i, 'barrel'],
  [/хлеб|bread|молок|продукт|еда|яйц|мясо|булоч|выпечк|оленин/i, 'bread'], [/аренд|квартир|жиль|ипотек|rent|дом/i, 'house'], [/зарплат|оклад|доход|wage|salary/i, 'bag'],
  [/акци|индекс|бирж|stock|shares/i, 'chart'], [/налог|tax|штраф/i, 'receipt']];
const значокАктива = (имя) => (АКТИВЫ.find(([rx]) => rx.test(имя)) || [, 'coins'])[1];
function тикер(имя) {
  const слова = String(имя).replace(/[«»"]/g, '').split(/[\s-]+/).filter(w => /^[\p{L}\p{N}]/u.test(w));
  const лат = слова.find(w => /^[A-Z][A-Za-z]{2,}$/.test(w));
  const код = лат ? лат.slice(0, 4) : слова.length < 2 ? (слова[0] || '').slice(0, 3) : слова.slice(0, 4).map(w => w[0]).join('');
  return код.toUpperCase();
}
let счётId = 0;
const СЛОВО_КУРСА = { up: 'растёт', down: 'падает', flat: 'без изменений' };
export function видЭкономики(строки, вид, заголовок) {
  const все = Array.isArray(строки) ? строки : [];
  const цены = все.filter(п => п.заметка === undefined);
  const заметки = все.filter(п => п.заметка !== undefined).map(п => `<p class="note">${т(п.заметка)}</p>`).join('');
  if (!все.length) return '';
  if (вид === 'board') {
    // Табло биржи: точечные цифры на чёрном; нажатие — взять котировку на заметку (звезда).
    return секция('eco', заголовок, корень('eco', вид,
      `<div class="led"><div class="hd"><span>Котировка</span><span>Цена</span><span>Изм.</span></div>`
      + цены.map(п => { const ф = флажок('pin', п.имя); return `<div class="tk is-${п.куда}${ф.cls}"${ф.attr}><span class="nm"><i class="star" aria-hidden="true"></i>${т(п.имя)}</span><b>${т(п.значение)}</b><em>${п.изменение ? `${ЗНАК[п.куда]} ${т(п.изменение)}` : '—'}</em></div>`; }).join('')
      + `<div class="tape" aria-hidden="true"><span>${цены.map(п => `${т(п.имя)} ${т(п.значение)} ${ЗНАК[п.куда]}`).join(' · ')} · </span></div></div>${заметки}`));
  }
  if (вид === 'tiles') {
    // Котировки плитками: значок актива, тикер, крупная цена, столбики объёма
    // и линия тренда с огоньком на конце. Нажатие переворачивает плитку.
    return секция('eco', заголовок, корень('eco', вид,
      `<div class="grid">${цены.map(п => { const х = хэш(п.имя), id = `wvsp${++счётId}`, конецY = { up: 5, down: 26, flat: 15 }[п.куда]; return `<div class="tile is-${п.куда}"${кнопка('flip')} aria-expanded="false"><div class="face front">`
        + `<div class="top">${ико(значокАктива(п.имя), 'asset')}<span class="tkr">${т(тикер(п.имя))}</span><i class="live" aria-hidden="true"></i></div>`
        + `<span class="nm">${т(п.имя)}</span><b>${т(п.значение)}</b>`
        + (п.изменение ? `<em>${ЗНАК[п.куда]} ${т(п.изменение)}</em>` : '')
        + `<span class="vol" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--h:${25 + ((х >> (i % 16)) % 7) * 11}%"></i>`).join('')}</span>`
        + `<svg class="spark" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g0"/><stop offset="1" class="g1"/></linearGradient></defs><path class="area" fill="url(#${id})" d="${тренд(п.куда)} L58 30 L2 30Z"/><path class="ln" d="${тренд(п.куда)}"/></svg>`
        + `<i class="tip" style="--y:${(конецY / 30).toFixed(2)}" aria-hidden="true"></i></div>`
        + `<div class="face back">${ико(значокАктива(п.имя), 'asset')}<small>${т(п.имя)}</small><strong>${ЗНАК[п.куда]} ${СЛОВО_КУРСА[п.куда]}</strong>${п.изменение ? `<p>${т(п.изменение)}</p>` : ''}<span>${т(п.значение)}</span></div></div>`; }).join('')}</div>${заметки}`));
  }
  if (вид === 'coins') {
    // Монетница: у каждой статьи своя монета — значок отчеканен, стрелка курса
    // на ободке, под ней стопка: растёт — выше, падает — тоньше. Нажатие
    // переворачивает монету: на реверсе — изменение.
    const СТОПКА = { up: 5, flat: 3, down: 1 };
    return секция('eco', заголовок, корень('eco', вид,
      `<div class="purse">${цены.map(п => `<div class="coin is-${п.куда} m${хэш(п.имя) % 3}"${кнопка('flip')} aria-expanded="false">`
        + `<div class="disc"><span class="side obv">${ико(значокАктива(п.имя))}<i class="dir">${ЗНАК[п.куда]}</i></span><span class="side rev"><small>курс</small><em>${т(п.изменение || СЛОВО_КУРСА[п.куда])}</em></span></div>`
        + `<span class="stack" aria-hidden="true">${'<i></i>'.repeat(СТОПКА[п.куда])}</span><b>${т(п.значение)}</b><span class="nm">${т(п.имя)}</span>${п.изменение ? `<em class="chg">${ЗНАК[п.куда]} ${т(п.изменение)}</em>` : ''}</div>`).join('')}</div>${заметки}`));
  }
  return '';
}

/* --- Городские службы -------------------------------------------------------
   строки: [{ ключ, подпись, текст, баллы }] */
const ЗНАЧОК_ГОРОДА = { emergency: 'alert', traffic: 'car', weather: 'cloud', roads: 'road', transport: 'bus', repairs: 'cone', utilities: 'bolt', police: 'shield', health: 'cross', protest: 'megaphone', other: 'house' };
// Форма дорожного знака по смыслу: предупреждение, запрет и порядок, информация, временное.
// ЧП — восьмиугольный «стоп», запрет и порядок — красный круг, транспорт —
// синий круг, службы — синий прямоугольник, ремонт — жёлтый ромб.
const ФОРМА_ЗНАКА = { emergency: 'stop', weather: 'warn', roads: 'warn', traffic: 'warn', police: 'round', protest: 'round', transport: 'blue', utilities: 'info', health: 'info', other: 'info', repairs: 'temp' };
const СТЕПЕНЬ = { emergency: 'hi', traffic: 'mid', weather: 'mid', roads: 'mid', repairs: 'mid', protest: 'mid', police: 'mid' };
const баллыШкалой = (баллы) => баллы ? `<span class="pips" title="${т(баллы)} из 10 баллов" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Number(баллы) ? 'on' : ''}${i >= 7 ? ' hi' : i >= 4 ? ' mid' : ''}"></i>`).join('')}</span>` : '';
export function видГорода(строки, вид, заголовок) {
  const все = Array.isArray(строки) ? строки : [];
  if (!все.length) return '';
  if (вид === 'dispatch') {
    // Диспетчерская: журнал вызовов; нажатие — «принято», лампа гаснет в зелёный.
    return секция('city', заголовок, корень('city', вид,
      `<div class="console"><div class="hd"><span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>Эфир открыт<span class="cnt">${все.length} вызов.</span></div>`
      + все.map((с, i) => { const ф = флажок('ack', с.текст); return `<div class="call is-${СТЕПЕНЬ[с.ключ] || 'lo'}${ф.cls}"${ф.attr}><i class="led" aria-hidden="true"></i><span class="ch">К-${1 + хэш(с.подпись + i) % 9}</span><b>${т(с.подпись)}<em class="ok">принято</em></b><p>${т(с.текст)}${баллыШкалой(с.баллы)}</p></div>`; }).join('')
      + `</div>`));
  }
  if (вид === 'signs') {
    // Дорожные знаки: полосатая стойка, знак со светоотражающей каймой и
    // болтами, под ним — табличка с видом службы; внизу асфальт с разметкой.
    // Нажатие качает знак, как от ветра.
    return секция('city', заголовок, корень('city', вид,
      все.map(с => `<div class="sg"${кнопка('swing')}><span class="post" aria-hidden="true"><span class="plate s-${ФОРМА_ЗНАКА[с.ключ] || 'info'}">${ико(ЗНАЧОК_ГОРОДА[с.ключ] || 'house')}<i class="bolt"></i></span><span class="sub">${т(с.подпись)}</span><span class="pole"></span></span>`
        + `<div class="txt"><b>${т(с.подпись)}</b><p>${т(с.текст)}</p>${баллыШкалой(с.баллы)}</div></div>`).join('')
      + `<span class="asphalt" aria-hidden="true"></span>`));
  }
  if (вид === 'alert') {
    // Оповещение: шапка системы с мигалкой и счётом по уровням; у каждого
    // сообщения — сигнальная штриховка, кольцо со значком, код и шкала
    // опасности. Нажатие — «прочитано», полоса сворачивается.
    const УРОВЕНЬ = { hi: ['III', 'высокий'], mid: ['II', 'средний'], lo: ['I', 'справка'] };
    const счёт = (ст) => все.filter(с => (СТЕПЕНЬ[с.ключ] || 'lo') === ст).length;
    return секция('city', заголовок, корень('city', вид,
      `<div class="sys"><span class="siren" aria-hidden="true"><i></i></span><b>Система оповещения</b><span class="cnt">${['hi', 'mid', 'lo'].filter(счёт).map(ст => `<i class="c-${ст}">${счёт(ст)}</i>`).join('')}</span></div>`
      + все.map((с, i) => { const ст = СТЕПЕНЬ[с.ключ] || 'lo', ф = флажок('read', с.текст), [рим, слово] = УРОВЕНЬ[ст];
        return `<div class="al is-${ст}${ф.cls}"${ф.attr}><span class="hazard" aria-hidden="true"></span><span class="ring" aria-hidden="true">${ико(ЗНАЧОК_ГОРОДА[с.ключ] || 'house')}</span>`
          + `<div class="body"><span class="kd">${т(с.подпись)}${ст === 'hi' ? '<b>Экстренно</b>' : ''}<em class="seen">прочитано</em><code>ГО-${рим}${String(10 + (хэш(с.текст + i) % 89))}</code></span><p>${т(с.текст)}</p>${баллыШкалой(с.баллы)}`
          + `<span class="lvl" aria-hidden="true"><i class="on"></i><i class="${ст !== 'lo' ? 'on' : ''}"></i><i class="${ст === 'hi' ? 'on' : ''}"></i><small>уровень ${рим} · ${слово}</small></span></div><i class="beacon" aria-hidden="true"></i></div>`; }).join('')));
  }
  return '';
}

/* --- Прогноз погоды ---------------------------------------------------------
   ячейки: [{ period, weather, temp, note, icon, label, t, warmth }], значки — W_ICONS */
// Цвет неба по времени суток: слово периода, иначе — по порядку.
const НЕБО = [[/утр|morn|рассвет/i, 'dawn'], [/ден|день|полд|day|noon/i, 'noon'], [/вечер|even|закат/i, 'dusk'], [/ноч|night/i, 'night']];
const небоПериода = (period, i, n) => (НЕБО.find(([rx]) => rx.test(period)) || [, ['dawn', 'noon', 'dusk', 'night'][Math.min(3, Math.floor(i * 4 / Math.max(1, n)))]])[1];
export function видПрогноза(ячейки, вид, заголовок, значки) {
  const все = Array.isArray(ячейки) ? ячейки : [];
  if (!все.length) return '';
  const значок = (я) => значки[я.icon] || значки.cloudy;
  if (вид === 'sky') {
    // Небо суток: полосы неба от рассвета к ночи, линия температуры поверх;
    // нажатие на время суток выделяет его и строку под небом.
    const числа = все.map(я => Number.isFinite(я.t) ? я.t : null);
    const есть = числа.filter(ч => ч !== null);
    const мин = Math.min(...есть), макс = Math.max(...есть), n = все.length;
    const y = (ч) => макс === мин ? 50 : 72 - (ч - мин) / (макс - мин) * 44;
    const x = (i) => (i + .5) / n * 100;
    const точки = числа.map((ч, i) => ч === null ? null : `${x(i).toFixed(1)},${y(ч).toFixed(1)}`).filter(Boolean);
    return секция('fc', заголовок, корень('fc', вид,
      `<div class="sky" style="--n:${n}">${все.map((я, i) => `<div class="band b-${небоПериода(я.period, i, n)} w-${я.icon}"${кнопка('pick')} data-i="${i}"><span class="pd">${т(я.period)}</span><span class="ic">${значок(я)}</span><span class="tp">${т(я.temp)}</span></div>`).join('')}`
      + (точки.length > 1 ? `<svg class="curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${точки.join(' ')}"/></svg>` : '')
      + `</div><ul class="notes">${все.map((я, i) => `<li data-i="${i}"><b>${т(я.period || я.label)}</b> ${т(я.weather || я.label)}${я.note ? ` — ${т(я.note)}` : ''}</li>`).join('')}</ul>`));
  }
  if (вид === 'window') {
    // Окна: за стеклом — своя погода, по бокам шторы с подхватами; в мороз —
    // иней по углам, в дождь — капли, днём — блик, ночью — месяц и звёзды.
    // На подоконнике свой предмет: утром чашка, днём цветок, вечером свеча,
    // ночью кошка. Нажатие поднимает раму, и погода оживает.
    const ДОЖДЬ = new Set(['rain', 'drizzle', 'shower', 'storm']);
    const ПОДОКОННИК = {
      dawn: ИКОНКИ.cup, noon: 'M8 21h8l1-6H7Z M12 15V9 M12 11c-3 0-4-2-4-4 2 0 4 1 4 4 M12 10c2.5 0 4-1.5 4-3.5-2 0-4 1-4 3.5',
      dusk: 'M10 21h4V11h-4Z M12 11V9 M12 9c-1.2-1-1.2-3 0-5 1.2 2 1.2 4 0 5Z', night: 'M6 21c0-5 2.4-8 6-8s6 3 6 8Z M8.2 14 7 9.5l3 2.2 M15.8 14 17 9.5l-3 2.2 M18 20c2 0 3-1.5 2.5-3',
    };
    return секция('fc', заголовок, корень('fc', вид,
      `<div class="panes">${все.map((я, i) => { const небо = небоПериода(я.period, i, все.length); return `<figure class="pane p-${небо}"${кнопка('open')} aria-expanded="false"><div class="glass b-${небо} w-${я.icon}">`
        + `<span class="fx" aria-hidden="true"></span>${небо === 'night' ? '<span class="moon" aria-hidden="true"></span>' : я.icon === 'clear' ? '<span class="glare" aria-hidden="true"></span>' : ''}`
        + `<span class="ic">${значок(я)}</span>${Number.isFinite(я.t) && я.t < 0 ? '<span class="frost" aria-hidden="true"></span>' : ''}${ДОЖДЬ.has(я.icon) ? '<span class="drops" aria-hidden="true"></span>' : ''}`
        + `<span class="sash" aria-hidden="true"></span><span class="curtain l" aria-hidden="true"></span><span class="curtain r" aria-hidden="true"></span>${я.temp ? `<span class="sticker">${т(я.temp)}</span>` : ''}</div>`
        + `<svg class="sill i-${небо}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ПОДОКОННИК[небо]}"/></svg>`
        + `<figcaption><b>${т(я.period)}</b><span>${т(я.weather || я.label)}</span>${я.note ? `<small>${т(я.note)}</small>` : ''}</figcaption></figure>`; }).join('')}</div>`));
  }
  if (вид === 'house') {
    // Погодный домик: в хорошую погоду из левой двери выезжает фигурка с
    // солнцем, в плохую — из правой, с зонтом; снег — снеговик, туман — фонарь,
    // ветер — воздушный змей. На стене — градусник, из трубы в холод — дым.
    // Нажатие крутит поворотный круг: фигурки меняются местами.
    const ФИГУРА = { clear: 'sun', partly: 'sun', cloudy: 'cloud', overcast: 'cloud', rain: 'umbrella', drizzle: 'umbrella', shower: 'umbrella', storm: 'bolt', snow: 'snowman', fog: 'lantern', wind: 'kite' };
    const ХОРОШО = new Set(['clear', 'partly']);
    return секция('fc', заголовок, корень('fc', вид,
      `<div class="houses">${все.map((я, i) => { const небо = небоПериода(я.period, i, все.length), тепло = я.warmth === null ? .5 : я.warmth;
        return `<figure class="house out-${ХОРОШО.has(я.icon) ? 'l' : 'r'}"${кнопка('swap')}><div class="hs b-${небо} w-${я.icon}">`
          + `${Number.isFinite(я.t) && я.t < 10 ? '<span class="smoke" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}<span class="chimney" aria-hidden="true"></span>`
          + `<span class="roof" aria-hidden="true"></span><span class="plaque">${т(я.period)}</span>`
          + `<span class="wall" aria-hidden="true"><span class="door l"></span><span class="door r"></span><span class="win"></span><span class="thermo" style="--w:${тепло.toFixed(2)}"><i></i></span></span>`
          + `<span class="rail" aria-hidden="true"></span><span class="fig" aria-hidden="true">${ико(ФИГУРА[я.icon] || 'cloud')}</span><span class="grass" aria-hidden="true"></span></div>`
          + `<figcaption><strong>${т(я.temp)}</strong><span>${т(я.weather || я.label)}</span>${я.note ? `<small>${т(я.note)}</small>` : ''}</figcaption></figure>`; }).join('')}</div>`));
  }
  return '';
}

/* --- Гороскоп ---------------------------------------------------------------
   знаки: [{ sign, glyph, text, tone, toneLabel, index }], предсказания: строки */
const ЗНАКИ_РУ = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
// Даты знаков — для кольца круга и строк списка.
const ДАТЫ = ['21.03–19.04', '20.04–20.05', '21.05–20.06', '21.06–22.07', '23.07–22.08', '23.08–22.09', '23.09–22.10', '23.10–21.11', '22.11–21.12', '22.12–19.01', '20.01–18.02', '19.02–20.03'];
const ГЛИФЫ = ['♈︎', '♉︎', '♊︎', '♋︎', '♌︎', '♍︎', '♎︎', '♏︎', '♐︎', '♑︎', '♒︎', '♓︎'];
// Стихия знака по кругу: огонь, земля, воздух, вода.
const СТИХИИ = [['fire', 'Огонь', 'flame'], ['earth', 'Земля', 'leaf'], ['air', 'Воздух', 'wind'], ['water', 'Вода', 'drop']];
const стихия = (з) => з.index >= 0 ? СТИХИИ[з.index % 4] : null;
const имяЗнака = (з) => з.index >= 0 ? знакЗодиака(ЗНАКИ_РУ[з.index]) : з.sign;
const предсказание = (п) => п.length ? `<blockquote class="fate"><i class="orb" aria-hidden="true"></i><small>Предсказание дня</small>${п.map(с => `<p>${т(с)}</p>`).join('')}</blockquote>` : '';
export function видГороскопа(знаки, предсказания, вид, заголовок) {
  const все = Array.isArray(знаки) ? знаки : [];
  const пр = (Array.isArray(предсказания) ? предсказания : []).filter(Boolean);
  if (!все.length && !пр.length) return '';
  const подвал = `<p class="disclaimer">Развлечения ради. Звёзды ни за что не отвечают.</p>`;
  // Номер для связи круга и списка: знак по кругу, незнакомый — по порядку.
  const номер = (з, n) => з.index >= 0 ? String(з.index) : 'x' + n;
  if (вид === 'wheel') {
    // Зодиакальный круг: снаружи — кольцо с датами знаков и делениями, затем
    // двенадцать секторов (цвет — тон дня), под ними — кольцо стихий, в
    // центре — месяц. Нажатие на сектор или строку списка выдвигает знак, его
    // глиф встаёт в центр круга.
    const поИндексу = new Map(все.filter(з => з.index >= 0).map(з => [з.index, з]));
    const точка = (a, рад) => `${(60 + рад * Math.cos(a)).toFixed(2)} ${(60 + рад * Math.sin(a)).toFixed(2)}`;
    const дуга = (a0, a1, R, r) => `M${точка(a0, r)} L${точка(a0, R)} A${R} ${R} 0 0 1 ${точка(a1, R)} L${точка(a1, r)} A${r} ${r} 0 0 0 ${точка(a0, r)}Z`;
    const сектор = (i) => {
      const a0 = (i * 30 - 105) * Math.PI / 180, a1 = ((i + 1) * 30 - 105) * Math.PI / 180, am = (a0 + a1) / 2, з = поИндексу.get(i), тон = з ? з.tone : 'none';
      // Дата по дуге: поворот по касательной, снизу круга — головой к центру.
      const гр = am * 180 / Math.PI + 90, низ = гр > 90 && гр < 270;
      return `<path class="ring-date" d="${дуга(a0, a1, 57, 50)}"/><text class="dt" transform="translate(${точка(am, 53.6)}) rotate(${(низ ? гр + 180 : гр).toFixed(1)})">${ДАТЫ[i]}</text>`
        + `<g class="sg t-${тон}"${з ? кнопка('sign') + ` data-i="${i}" data-g="${ГЛИФЫ[i]}"` : ''} style="--ox:${(Math.cos(am) * 2.6).toFixed(2)}px;--oy:${(Math.sin(am) * 2.6).toFixed(2)}px">`
        + `<path class="sec t-${тон}" d="${дуга(a0, a1, 49.5, 30)}"/>`
        + `<text x="${(60 + 40 * Math.cos(am)).toFixed(2)}" y="${(60 + 40 * Math.sin(am) + 2.8).toFixed(2)}" class="gl t-${тон}">${ГЛИФЫ[i]}</text>${з ? `<title>${т(имяЗнака(з))}: ${т(з.toneLabel)}</title>` : ''}</g>`
        + `<path class="el el-${СТИХИИ[i % 4][0]}" d="${дуга(a0 + .03, a1 - .03, 29.2, 25.6)}"/>`;
    };
    return секция('horo', заголовок, корень('horo', вид,
      `<div class="wheel"><span class="sky" aria-hidden="true"></span><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="rim" cx="60" cy="60" r="58.5"/>${Array.from({ length: 12 }, (_, i) => сектор(i)).join('')}`
      + `<circle class="ticks" cx="60" cy="60" r="49.8"/><circle class="core" cx="60" cy="60" r="25"/>`
      + `<g class="moon"><path class="sunmoon" d="M62 47A13 13 0 1 0 62 73A16 16 0 0 1 62 47Z"/><circle class="st" cx="68" cy="52" r="1"/><circle class="st" cx="71" cy="62" r=".7"/><circle class="st" cx="66" cy="68" r=".8"/></g><text class="ctr" x="60" y="66"></text></svg>`
      + `<div class="legend"><span class="t-luck">повезёт</span><span class="t-flat">ровно</span><span class="t-bad">поберегитесь</span>${СТИХИИ.map(с => `<span class="e-${с[0]}">${с[1].toLowerCase()}</span>`).join('')}</div></div>`
      + `<ul class="list">${все.map((з, n) => `<li class="t-${з.tone}"${кнопка('sign')} data-i="${номер(з, n)}" data-g="${з.glyph}"><i>${з.glyph}</i><b>${т(имяЗнака(з))}${з.index >= 0 ? `<small>${ДАТЫ[з.index]}</small>` : ''}</b><p>${т(з.text)}</p></li>`).join('')}</ul>`
      + предсказание(пр) + подвал));
  }
  if (вид === 'gems') {
    // Талисманы: камень своей стихии и своей огранки — огонь — рубин-треугольник,
    // земля — изумруд ступенями, воздух — круглый цитрин, вода — сапфир-капля.
    // Камень на подвесе с цепочкой, фоном — знак стихии; под именем — камень и
    // счастливое число. Удача искрит, беда — трещина. Нажатие поворачивает камень.
    const ОГРАНКА = {
      fire: ['M20 3 37 33H3Z', 'M20 12 28.5 28H11.5Z', 'M20 3v9 M3 33l8.5-5 M37 33l-8.5-5'],
      earth: ['M13 4h14l7 7v18l-7 7H13l-7-7V11Z', 'M15.5 10h9l4 4v12l-4 4h-9l-4-4V14Z', 'M13 4l2.5 6 M27 4l-2.5 6 M34 11l-5.5 3 M34 29l-5.5-3 M27 36l-2.5-6 M13 36l2.5-6 M6 29l5.5-3 M6 11l5.5 3'],
      air: ['M20 4a16 16 0 1 0 .01 0Z', 'M14 13h12l4 7-4 7H14l-4-7Z', 'M20 4v9 M20 27v9 M4 20h6 M30 20h6 M8.7 8.7 14 13 M31.3 8.7 26 13 M8.7 31.3 14 27 M31.3 31.3 26 27'],
      water: ['M20 3C27 13 34 19 34 26a14 14 0 0 1-28 0C6 19 13 13 20 3Z', 'M20 15l7 11-7 8-7-8Z', 'M20 3v12 M6 26h7 M27 26h7 M20 34v4'],
      none: ['M20 2 35 11v18L20 38 5 29V11Z', 'M20 2 35 11 20 16 5 11Z', 'M5 11l15 5 15-5 M20 16v22'],
    };
    // Глиф — в центре площадки огранки: у треугольника и капли он ниже середины.
    const ЦЕНТР_ГРАНИ = { fire: 22.8, earth: 20, air: 20, water: 24.6, none: 20.5 };
    const КАМЕНЬ = { fire: 'рубин', earth: 'изумруд', air: 'цитрин', water: 'сапфир', none: 'горный хрусталь' };
    const камень = (з, ст) => { const [контур, площадка, грани] = ОГРАНКА[ст]; return `<svg class="gem" viewBox="0 0 40 40" aria-hidden="true"><path class="g0" d="${контур}"/><path class="g2" d="${контур}"/><path class="g1" d="${площадка}"/><path class="edge" d="${контур} ${грани}"/>${з.tone === 'bad' ? '<path class="crack" d="M26 8l-3 7 3 3-4 8"/>' : ''}<text x="20" y="${ЦЕНТР_ГРАНИ[ст]}">${з.glyph}</text></svg>`; };
    return секция('horo', заголовок, корень('horo', вид,
      `<div class="grid">${все.map(з => { const ст = (стихия(з) || ['none'])[0]; return `<div class="charm el-${ст} t-${з.tone}"${кнопка('spin')}>${ико((стихия(з) || [, , 'star'])[2], 'mark')}<span class="halo" aria-hidden="true"></span>`
        + `<span class="pendant" aria-hidden="true"><i class="chain"></i><i class="bail"></i>${камень(з, ст)}</span>${з.tone === 'luck' ? '<i class="glint" aria-hidden="true"></i><i class="glint g2" aria-hidden="true"></i>' : ''}`
        + `<div><b>${т(имяЗнака(з))}</b><small>${т(з.toneLabel)}</small><p>${т(з.text)}</p><span class="meta">${КАМЕНЬ[ст]} · счастливое число ${1 + хэш(з.sign + з.text) % 9}</span></div></div>`; }).join('')}</div>`
      + предсказание(пр) + подвал));
  }
  if (вид === 'elements') {
    // Стихии: четыре раздела — огонь, земля, воздух, вода; заголовок раздела
    // сворачивает и разворачивает его.
    const группы = СТИХИИ.map(с => ({ с, знаки: все.filter(з => стихия(з) === с) })).filter(г => г.знаки.length);
    const прочие = все.filter(з => !стихия(з));
    const строка = (з) => `<li class="t-${з.tone}"><i>${з.glyph}</i><div><b>${т(имяЗнака(з))}<span class="dot" title="${т(з.toneLabel)}"></span></b><p>${т(з.text)}</p></div></li>`;
    return секция('horo', заголовок, корень('horo', вид,
      группы.map(г => `<section class="el-${г.с[0]}"><h5${кнопка('fold')} aria-expanded="true">${ико(г.с[2])}${г.с[1]}<small>${г.знаки.length}</small><i class="chev" aria-hidden="true"></i></h5><ul>${г.знаки.map(строка).join('')}</ul></section>`).join('')
      + (прочие.length ? `<section class="el-none"><ul>${прочие.map(строка).join('')}</ul></section>` : '')
      + предсказание(пр) + подвал));
  }
  return '';
}

/* --- Афиша -----------------------------------------------------------------
   события: [{ ключ, подпись, название, где }] */
const ЗНАЧОК_АФИШИ = { cinema: 'film', theatre: 'mask', concert: 'music', exhibition: 'frame', festival: 'tent', sport: 'ball', club: 'sparkle', street: 'trumpet', lecture: 'mic', other: 'calendar' };
export function видАфиши(события, вид, заголовок) {
  const все = Array.isArray(события) ? события : [];
  if (!все.length) return '';
  if (вид === 'column') {
    // Афишная тумба: купол с рёбрами и шпилем, кольцо-вывеска, под свежими
    // плакатами — обрывки старых. У плаката своё оформление по виду события:
    // кино — плёнка по краям, театр — занавес, концерт — ноты, выставка — рама,
    // праздник — флажки, спорт — полосы, клуб — неон. Внизу постамент.
    // Нажатие приподнимает плакат.
    return секция('afisha', заголовок, корень('afisha', вид,
      `<div class="tumba"><span class="finial" aria-hidden="true"></span><span class="cap" aria-hidden="true"></span><span class="crown" aria-hidden="true"><i>Афиша</i></span>`
      + `<div class="drum"><span class="scraps" aria-hidden="true"><i></i><i></i><i></i></span>${все.map(с => { const х = хэш(с.название); return `<div class="poster k-${с.ключ} p${х % 4}" style="--r:${((х % 5) - 2) * .7}deg"${кнопка('lift')}><i class="paste" aria-hidden="true"></i><i class="deco" aria-hidden="true"></i><span class="kind">${ико(ЗНАЧОК_АФИШИ[с.ключ] || 'calendar')}${т(с.подпись)}</span><b>${т(с.название)}</b>${с.где ? `<span class="foot">${т(с.где)}</span>` : ''}</div>`; }).join('')}</div>`
      + `<span class="plinth" aria-hidden="true"></span></div>`));
  }
  if (вид === 'marquee') {
    // Вывеска: рама с лампочками; нажатие на строку зажигает её, лампы бегут.
    return секция('afisha', заголовок, корень('afisha', вид,
      `<div class="sign"><span class="bulbs" aria-hidden="true"></span><div class="board"><span class="now">Сегодня</span>${все.map(с => `<div class="ln"${кнопка('pick')}><span class="k">${т(с.подпись)}</span><b>${т(с.название)}</b>${с.где ? `<small>${т(с.где)}</small>` : ''}</div>`).join('')}</div></div>`));
  }
  if (вид === 'vinyl') {
    // Пластинки: у события свой конверт — цвет и узор по виду, из конверта
    // выглядывает винил с цветной наклейкой. Нажатие ставит пластинку играть:
    // она выезжает и крутится, рядом прыгает эквалайзер.
    return секция('afisha', заголовок, корень('afisha', вид,
      `<div class="crate">${все.map((с, i) => { const х = хэш(с.название), значок = ЗНАЧОК_АФИШИ[с.ключ] || 'calendar'; return `<div class="rec k-${с.ключ} h${х % 6}"${кнопка('play')} aria-pressed="false">`
        + `<div class="art" aria-hidden="true"><span class="disc"><i class="label">${ико(значок)}</i></span><span class="sleeve"><i class="pat"></i><span class="side">${String(i + 1).padStart(2, '0')}</span>${ико(значок, 'big')}</span></div>`
        + `<div class="txt"><span class="k">${т(с.подпись)}</span><b>${т(с.название)}</b>${с.где ? `<small>${т(с.где)}</small>` : ''}<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div></div>`; }).join('')}</div>`));
  }
  return '';
}

/* --- Доска объявлений ---------------------------------------------------------
   объявления: строки */
const РУБРИКИ = [[/продаю|продам|продаётся|продается|продаются|распродаж|\bsell|for sale|\bsale\b/i, 'Продаю'], [/куплю|покупаю|\bbuy(?:ing)?\b/i, 'Куплю'], [/отдам|даром|бесплатно|в добрые руки|giving away|\bfree\b|good homes?/i, 'Даром'],
  [/сдам|сдаётся|сдается|сниму|аренд|квартир|комнат|\brent|apartment|\broom\b|\bflat\b/i, 'Жильё'], [/ищу|требуется|требуются|нужен|нужна|ваканс|looking for|wanted|hiring|\bneeded\b|vacanc/i, 'Ищу'], [/потерял|пропал|пропала|найден|нашёл|нашел|\blost\b|missing|\bfound\b/i, 'Потери'],
  [/приглаш|приходите|ждём|ждем|открыт|запись|приём|прием|invit|\bcome\b|welcome|\bopen|sign up/i, 'Приглашаем'], [/ремонт|репетитор|реставрац|услуг|мастер|уборк|стрижк|repair|tutor|restor|service|cleaning|haircut/i, 'Услуги']];
const рубрика = (с) => (РУБРИКИ.find(([rx]) => rx.test(с)) || [, 'Объявление'])[1];
// Номер для отрывных листков: телефон, «ящик 14», «тел. …».
const контакт = (с) => {
  const тел = String(с).match(/(?:\+?\d[\d\s()\-–]{4,}\d)/);
  if (тел) return тел[0].replace(/\s+/g, ' ').trim();
  const ящик = String(с).match(/(?:ящик|box)\s*(?:№|#|no\.?)?\s*\d+/i);
  return ящик ? ящик[0] : '';
};
export function видОбъявлений(объявления, вид, заголовок) {
  const все = (Array.isArray(объявления) ? объявления : []).map(безКавычек).filter(Boolean);
  if (!все.length) return '';
  if (вид === 'tearoff') {
    // Отрывные листки: внизу бахрома с номером; полоску можно оторвать нажатием.
    return секция('ads', заголовок, корень('ads', вид,
      `<div class="post">${все.map(с => { const х = хэш(с), к = контакт(с) || рубрика(с); return `<div class="note" style="--r:${((х % 5) - 2) * .8}deg"><b>${т(рубрика(с))}</b><p>${т(с)}</p><div class="fringe">${Array.from({ length: 6 }, (_, i) => { const кл = ключ('tear', с, '|' + i); const нет = (х >> i) % 5 === 0 || отмечено(кл); return `<span class="${нет ? 'gone' : ''}"${нет ? ' aria-hidden="true"' : кнопка('tear', кл) + ` aria-label="Оторвать: ${т(к)}"`}>${т(к)}</span>`; }).join('')}</div></div>`; }).join('')}</div>`));
  }
  if (вид === 'classified') {
    // Газетные объявления: рубрики на чёрной плашке; нажатие обводит объявление красной ручкой.
    const поРубрикам = new Map();
    все.forEach(с => { const р = рубрика(с); поРубрикам.set(р, [...(поРубрикам.get(р) || []), с]); });
    return секция('ads', заголовок, корень('ads', вид,
      `<div class="paper"><header>Частные объявления</header><div class="cols">${[...поРубрикам].map(([р, список]) => `<section><h5>${т(р)}</h5>${список.map(с => { const слова = с.split(/\s+/), ф = флажок('circle', с); return `<p class="${ф.cls.trim()}"${ф.attr}><b>${т(слова.slice(0, 2).join(' '))}</b> ${т(слова.slice(2).join(' '))}</p>`; }).join('')}</section>`).join('')}</div></div>`));
  }
  if (вид === 'pager') {
    // Пейджер: на зелёном экране — одно сообщение с номером и рубрикой, телефон
    // отдельной строкой; кнопки листают, лампочка мигает, пока не прочитано.
    const n = все.length;
    return секция('ads', заголовок, корень('ads', вид,
      `<div class="pgr"><span class="clip" aria-hidden="true"></span><div class="top"><span class="brand">Пейджер</span><span class="sig" aria-hidden="true"><i></i><i></i><i></i></span><i class="led" aria-hidden="true"></i></div>`
      + `<div class="lcd">${все.map((с, i) => `<div class="msg${i ? '' : ' is-cur'}"><span class="hd"><b>${i + 1}/${n}</b>${т(рубрика(с))}</span><p>${т(с)}</p>${контакт(с) ? `<span class="tel">тел. ${т(контакт(с))}</span>` : ''}</div>`).join('')}</div>`
      + `<div class="keys"><button type="button" class="key" data-wv="page" data-dir="-1" aria-label="Предыдущее сообщение"><i class="tri is-l"></i></button><span class="grip" aria-hidden="true"></span><button type="button" class="key" data-wv="page" data-dir="1" aria-label="Следующее сообщение"><i class="tri"></i></button></div></div>`));
  }
  return '';
}

/* --- Комментарии Сети -------------------------------------------------------
   комментарии: [{ name, text, color, initials }] */
const ЗВАНИЯ = ['Новичок', 'Завсегдатай', 'Знаток', 'Старожил', 'Легенда форума'];
// Счётчик с отметкой: база от хэша, своя отметка прибавляет единицу.
const счётчик = (действие, текст, база, значок) => { const ф = флажок(действие, текст); return `<button type="button" class="act a-${действие}${ф.cls}"${ф.attr.replace(' role="button" tabindex="0"', '')} data-base="${база}">${ико(значок)}<span class="n">${тыс(база + (ф.on ? 1 : 0))}</span></button>`; };
export function видКомментариев(комментарии, вид, заголовок) {
  const все = Array.isArray(комментарии) ? комментарии : [];
  if (!все.length) return '';
  if (вид === 'stream') {
    // Стрим-чат: цветные ники, счётчик зрителей; нажатие закрепляет сообщение.
    const зрители = 300 + хэш(все.map(к => к.name).join('|')) % 4800;
    return секция('cmt', заголовок, корень('cmt', вид,
      `<div class="chat"><div class="hd"><span class="live"><i></i>В эфире</span><span>${ико('eye')}${тыс(зрители)}</span></div>`
      + все.map(к => { const ф = флажок('hl', к.name + к.text); return `<p class="${ф.cls.trim()}"${ф.attr}><span class="pinned" aria-hidden="true">${ико('pin')}закреплено</span><span class="nick" style="--c:${к.color}">${хэш(к.name) % 3 === 0 ? ико('star', 'badge') : ''}${т(к.name)}</span><span class="msg">${т(к.text)}</span></p>`; }).join('')
      + `<div class="typing" aria-hidden="true"><i></i><i></i><i></i><span>кто-то печатает</span></div></div>`));
  }
  if (вид === 'forum') {
    // Форум: карточка участника и пост; нажатие на «+» прибавляет репутацию.
    return секция('cmt', заголовок, корень('cmt', вид,
      все.map((к, i) => { const х = хэш(к.name); return `<article class="post"><aside><span class="ava" style="--c:${к.color}">${т(к.initials)}</span><b>${т(к.name)}</b><small>${ЗВАНИЯ[х % ЗВАНИЯ.length]}</small><span class="stars" aria-hidden="true">${ико('star').repeat(1 + х % 5)}</span><small>сообщений: ${12 + х % 3000}</small></aside><div class="body"><span class="no">#${i + 1}</span><p>${т(к.text)}</p><div class="foot">${счётчик('rep', к.name + к.text, х % 60, 'heart')}<span class="quote">${ико('reply')}цитировать</span></div></div></article>`; }).join('')));
  }
  if (вид === 'threads') {
    // Ветка: аватары на нити, @ник, текст; лайк и репост нажимаются.
    return секция('cmt', заголовок, корень('cmt', вид,
      все.map(к => { const х = хэш(к.text); return `<article class="th"><span class="ava" style="--c:${к.color}">${т(к.initials)}</span><div><b>@${т(к.name.replace(/\s+/g, '_'))}</b><p>${т(к.text)}</p><div class="acts"><span class="act">${ико('reply')}${1 + х % 40}</span>${счётчик('repost', к.text, х % 90, 'repost')}${счётчик('like', к.text, 5 + х % 2400, 'heart')}</div></div></article>`; }).join('')));
  }
  return '';
}

/* --- Нажатия ----------------------------------------------------------------
   Один обработчик на все виды (events.js: click и Enter/пробел). true —
   нажатие наше, дальше его не передавать (иначе вид ещё и «оживёт»). */
export function действиеМира(e) {
  const цель = e && e.target && e.target.closest && e.target.closest('.hud-wv [data-wv]');
  if (!цель) return false;
  if (e.type === 'keydown') {
    // У настоящей кнопки Enter и пробел сами дают click — второй раз не переключаем.
    if ((e.key !== 'Enter' && e.key !== ' ') || цель.tagName === 'BUTTON') return false;
    e.preventDefault();
  }
  const корень = цель.closest('.hud-wv');
  const к = цель.dataset.k || '';
  // Перезапуск анимации: снять класс, дать браузеру заметить, вернуть.
  const перезапуск = (узел, класс) => { if (!узел) return; узел.classList.remove(класс); void узел.offsetWidth; узел.classList.add(класс); };
  const переключить = () => {
    const on = !отмечено(к);
    if (on) отметки.set(к, true); else отметки.delete(к);
    цель.classList.toggle('is-set', on);
    цель.setAttribute('aria-pressed', String(on));
    return on;
  };
  // Один выбранный на весь вид; повторное нажатие снимает выбор.
  const один = (класс = 'is-pick') => {
    const было = цель.classList.contains(класс);
    корень.querySelectorAll('.' + класс).forEach(x => x.classList.remove(класс));
    if (!было) цель.classList.add(класс);
    корень.classList.toggle('has-pick', !было);
    return !было;
  };
  const раскрыть = () => { const on = цель.classList.toggle('is-open'); цель.setAttribute('aria-expanded', String(on)); return on; };
  switch (цель.dataset.wv) {
    case 'open': раскрыть(); перезапуск(цель, 'is-pop'); break;
    case 'air': {
      корень.querySelectorAll('.rundown li').forEach(li => li.classList.toggle('is-now', li === цель));
      const титр = корень.querySelector('.lower b'), метка = корень.querySelector('.lower .tag');
      if (титр) титр.textContent = цель.dataset.title || '';
      if (метка) метка.textContent = 'Сюжет ' + (цель.dataset.n || '');
      перезапуск(корень.querySelector('.screen'), 'is-cut');
      break;
    }
    case 'tune': {
      const i = цель.dataset.i, x = Number(цель.dataset.x) || 0;
      корень.querySelector('.needle')?.style.setProperty('--x', x + '%');
      корень.querySelector('.set')?.style.setProperty('--knob', (x * 3 - 150).toFixed(0) + 'deg');
      корень.querySelectorAll('.dial .mark').forEach((m, n) => m.classList.toggle('is-on', String(n) === i));
      корень.querySelectorAll('.waves li').forEach(li => li.classList.toggle('is-on', li === цель));
      перезапуск(корень.querySelector('.dial'), 'is-tuning');
      break;
    }
    case 'hear': переключить(); перезапуск(цель, 'is-ripple'); break;
    case 'spray': перезапуск(цель, 'is-spray'); break;
    case 'pass': {
      const n = (отметки.get(к) || 0) + 1;
      отметки.set(к, n);
      const счёт = цель.querySelector('.cnt');
      if (счёт) счёт.textContent = String(Number(цель.dataset.base || 0) + n);
      перезапуск(цель, 'is-pass');
      break;
    }
    case 'flip': { const on = цель.classList.toggle('is-flipped'); цель.setAttribute('aria-expanded', String(on)); break; }
    case 'page': {
      const сообщения = [...корень.querySelectorAll('.lcd .msg')];
      const было = Math.max(0, сообщения.findIndex(m => m.classList.contains('is-cur')));
      const стало = (было + Number(цель.dataset.dir || 1) + сообщения.length) % сообщения.length;
      сообщения.forEach((m, n) => m.classList.toggle('is-cur', n === стало));
      корень.classList.add('is-read');
      перезапуск(корень.querySelector('.lcd'), 'is-scroll');
      break;
    }
    case 'play': {
      const on = один('is-playing');
      корень.querySelectorAll('[data-wv="play"]').forEach(x => x.setAttribute('aria-pressed', String(x === цель && on)));
      break;
    }
    case 'swap': цель.classList.toggle('is-other'); перезапуск(цель, 'is-swap'); break;
    case 'swing': case 'spin': перезапуск(цель, 'is-' + цель.dataset.wv); break;
    case 'pick': {
      const on = один();
      if (корень.classList.contains('is-sky')) корень.querySelectorAll('.notes li').forEach(li => li.classList.toggle('is-pick', on && li.dataset.i === цель.dataset.i));
      break;
    }
    case 'sign': {
      const i = корень.dataset.pick === цель.dataset.i ? '' : цель.dataset.i;
      корень.dataset.pick = i;
      корень.querySelectorAll('[data-wv="sign"]').forEach(x => x.classList.toggle('is-pick', !!i && x.dataset.i === i));
      корень.classList.toggle('has-pick', !!i);
      const центр = корень.querySelector('.ctr');
      if (центр) центр.textContent = i ? (цель.dataset.g || '') : '';
      break;
    }
    case 'fold': {
      const раздел = цель.closest('section');
      const свёрнут = раздел ? раздел.classList.toggle('is-folded') : false;
      цель.setAttribute('aria-expanded', String(!свёрнут));
      break;
    }
    case 'lift': один('is-lifted'); break;
    case 'tear':
      отметки.set(к, true);
      цель.classList.add('is-torn');
      цель.removeAttribute('tabindex');
      break;
    case 'rep': case 'like': case 'repost': {
      const on = переключить();
      const n = цель.querySelector('.n');
      if (n) n.textContent = тыс(Number(цель.dataset.base || 0) + (on ? 1 : 0));
      перезапуск(цель, 'is-pop');
      break;
    }
    // pin, tick, ack, read, go, circle, mark, hl — переключатели с памятью.
    default: переключить(); перезапуск(цель, 'is-pop');
  }
  return true;
}

// Только для тестов: сбросить отметки между проверками.
export function сброситьОтметкиМира() { отметки.clear(); }
