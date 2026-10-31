// hud-manager/custom-stats.js
//
// Свои статы (Настройки → Свои статы): пользователь называет стат, пишет в
// окошке, что он значит, выбирает вид и вкладку. Модель пишет его каждый ход:
//   — у персонажей и игрока — в объекте "Cst" их записи: {"Голод": "70 — …"};
//   — для всей истории — в корневом "cst".
// Промт — общий для всех статов (ШАБЛОН_СВОИХ), его можно переписать целиком
// в настройках (settings.customStatsPrompt); {{stats}} — место для списка.
// На карточке стат — блок с его именем; место в вкладке пользователь меняет
// перетаскиванием (events.js), оно хранится в стате как after:
//   '^'  — в начале вкладки, ''  — в конце, иначе — после поля с этим ключом
//   (data-k строки в карточке персонажа или игрока).
//
// Вид — общий язык новых блоков (css/views.css, render/view-icons.js):
// медаль со знаком стата, кольцо, полосы и метки цветом акцента темы. Цвет
// можно сменить (ст.color): цвет группы полей (kind-*, его подбирает палитра
// темы) или свой #rrggbb. Без выбора блок перекрашивается вместе с темой.

import { escapeHtml } from './utils.js?v=23.88.8';
import { ико, медаль } from './render/view-icons.js?v=23.88.8';

// макс — верх шкалы для уровня (низкий, средний, высокий); у числа его нет.
export const ВИДЫ_СТАТОВ = [
  { id: 'num', имя: 'Число', знак: 'target', формат: 'a number, then « — » and a few words on why' },
  { id: 'pct', имя: 'Проценты', знак: 'chart', макс: 100, формат: 'a number 0-100 (percent), then « — » and a few words on why' },
  { id: 'scale', имя: 'Шкала 0–10', знак: 'bolt', макс: 10, формат: 'a number 0-10, then « — » and a few words on why' },
  { id: 'stars', имя: 'Звёзды 0–5', знак: 'star', макс: 5, формат: 'a number 0-5, then « — » and a few words on why' },
  { id: 'text', имя: 'Описание', знак: 'book', формат: 'one or two full sentences' },
  { id: 'tags', имя: 'Список меток', знак: 'sparkle', формат: 'short items separated by ; — never commas' },
];
const ВИД = Object.fromEntries(ВИДЫ_СТАТОВ.map(в => [в.id, в]));

// Знак стата на медали — линейные значки блоков HUD (не эмодзи).
export const ЗНАКИ_СТАТОВ = [
  ['', 'По виду'], ['star', 'Звезда'], ['heart', 'Сердце'], ['flame', 'Пламя'], ['bolt', 'Молния'], ['drop', 'Капля'],
  ['moon', 'Луна'], ['sun', 'Солнце'], ['shield', 'Щит'], ['swords', 'Мечи'], ['dagger', 'Кинжал'], ['coins', 'Монеты'],
  ['key', 'Ключ'], ['eye', 'Глаз'], ['mask', 'Маска'], ['crown', 'Корона'], ['target', 'Мишень'], ['hourglass', 'Песочные часы'],
  ['leaf', 'Лист'], ['skull', 'Череп'], ['gem', 'Камень'], ['book', 'Книга'], ['chart', 'График'], ['fork', 'Еда'],
  ['bed', 'Сон'], ['music', 'Музыка'], ['lock', 'Замок'], ['ghost', 'Призрак'], ['rose', 'Роза'], ['pill', 'Таблетка'],
];
// Цвет блока: '' — акцент темы, группа полей (как у строк карточки, misc.css
// .kind-*) или свой цвет ('custom' — только в редакторе, в стате лежит #rrggbb).
export const ЦВЕТА_СТАТОВ = [
  ['', 'Акцент темы'], ['look', 'Внешность'], ['vitals', 'Тело'], ['place', 'Место'],
  ['standing', 'Положение'], ['mind', 'Мысли'], ['dream', 'Сны'], ['plans', 'Планы'],
  ['items', 'Вещи'], ['bonds', 'Связи'], ['tension', 'Напряжение'], ['alarm', 'Тревога'],
  ['custom', 'Свой цвет'],
];
const ГРУППА_ЦВЕТА = new Set(ЦВЕТА_СТАТОВ.map(([к]) => к).filter(к => к && к !== 'custom'));
export const СВОЙ_ЦВЕТ = /^#[0-9a-f]{6}$/i;

/** Класс и стиль цвета блока: группа — kind-*, свой — --kind в style. */
export function цветСтата(ст) {
  const ц = String(ст && ст.color || '');
  if (ГРУППА_ЦВЕТА.has(ц)) return { класс: ' kind-' + ц, стиль: '' };
  if (СВОЙ_ЦВЕТ.test(ц)) return { класс: ' is-own-color', стиль: ` style="--kind:${ц}"` };
  return { класс: '', стиль: '' };
}

const ЗНАК = new Set(ЗНАКИ_СТАТОВ.map(([к]) => к).filter(Boolean));

// Кому принадлежит стат и где он виден.
export const ЧЬИ_СТАТЫ = [
  { id: 'chars', имя: 'Каждому персонажу', вкладка: 'character' },
  { id: 'user', имя: 'Игроку', вкладка: 'user' },
  { id: 'story', имя: 'Всей истории (одно значение)', вкладка: '' },
];
// Вкладки, куда можно поставить стат всей истории.
export const ВКЛАДКИ_ИСТОРИИ = [
  { id: 'character', имя: 'Персонажи (у первого)' },
  { id: 'user', имя: 'Игрок' },
  { id: 'memory', имя: 'Память' },
  { id: 'life', имя: 'Быт' },
  { id: 'world', имя: 'Мир' },
];

export const ШАБЛОН_СВОИХ = `## 🧩 CUSTOM STATS
The user added stats of their own. Write every one of them every turn, under the name EXACTLY as given — never rename, translate, merge or drop one — and keep each value true to the story: it changes only when the story gives a reason.
{{stats}}`;

const МЕСТО_В_ОТВЕТЕ = {
  chars: 'in EVERY character object in "cs", inside its "Cst" object',
  user: 'in "us", inside its "Cst" object',
  story: 'in the top-level "cst" object — one value for the whole story',
};

/** Статы из настроек — только с именем, без дублей имени у одного владельца. */
export function своиСтаты(s) {
  // Общий выключатель: статы не просятся у модели и не рисуются, список цел.
  if (s && s.customStatsOn === false) return [];
  const сырые = s && Array.isArray(s.customStats) ? s.customStats : [];
  const было = new Set();
  return сырые.filter(ст => {
    if (!ст || typeof ст !== 'object') return false;
    const имя = String(ст.name || '').trim();
    const кто = ['chars', 'user', 'story'].includes(ст.who) ? ст.who : 'chars';
    const ключ = кто + '|' + имя.toLowerCase();
    if (!имя || было.has(ключ)) return false;
    было.add(ключ);
    return true;
  }).map(ст => ({ ...ст, name: String(ст.name).trim(), who: ['chars', 'user', 'story'].includes(ст.who) ? ст.who : 'chars', view: ВИД[ст.view] ? ст.view : 'num' }));
}

/** Вкладка, в которой стат показан. */
export function вкладкаСтата(ст) {
  if (ст.who === 'chars') return 'character';
  if (ст.who === 'user') return 'user';
  return ВКЛАДКИ_ИСТОРИИ.some(в => в.id === ст.tab) ? ст.tab : 'memory';
}

const кавычки = (s) => String(s).replace(/"/g, '«').replace(/[\r\n]+/g, ' ').trim();

/** Раздел промта со своими статами; пусто, если статов нет. */
export function промптСвоихСтатов(s, { игрок = true } = {}) {
  const статы = своиСтаты(s).filter(ст => ст.who !== 'user' || игрок);
  if (!статы.length) return '';
  const строки = статы.map(ст => {
    const что = ст.hint && String(ст.hint).trim() ? ` What it tracks: ${кавычки(ст.hint)}.` : '';
    return `- "${кавычки(ст.name)}" — ${МЕСТО_В_ОТВЕТЕ[ст.who]}.${что} Value: ${ВИД[ст.view].формат}.`;
  }).join('\n');
  const свой = s && typeof s.customStatsPrompt === 'string' && s.customStatsPrompt.trim() ? s.customStatsPrompt.trim() : ШАБЛОН_СВОИХ;
  const текст = свой.includes('{{stats}}') ? свой.replace('{{stats}}', строки) : свой + '\n' + строки;
  return '\n\n' + текст;
}

// --- Значение ------------------------------------------------------------------

const ЗАГЛУШКА = /^(?:empty|none|null|n\/a|нет|пусто|-|—)?$/i;

/** Значение стата из записи: объект Cst / cst, имя без учёта регистра. */
export function значениеСтата(записи, имя) {
  if (!записи || typeof записи !== 'object' || Array.isArray(записи)) return '';
  const н = String(имя).trim().toLowerCase();
  const ключ = Object.keys(записи).find(к => к.trim().toLowerCase() === н);
  if (ключ === undefined) return '';
  const v = записи[ключ];
  const s = Array.isArray(v) ? v.join('; ') : (v && typeof v === 'object' ? Object.values(v).join('; ') : String(v ?? ''));
  return ЗАГЛУШКА.test(s.trim()) ? '' : s.trim();
}

// Число в начале и пояснение после него: «70 — сыт», «7/10: устал», «4★».
export function числоИПояснение(значение) {
  const s = String(значение).trim();
  const м = s.match(/^[^\d-]{0,3}(-?\d+(?:[.,]\d+)?)\s*(?:%|\/\s*\d+|★+)?\s*(?:[—–:;,.-]\s*)?([\s\S]*)$/);
  if (!м) return { число: null, пояснение: s };
  return { число: parseFloat(м[1].replace(',', '.')), пояснение: м[2].trim() };
}

const ограничить = (x, мин, макс) => Math.max(мин, Math.min(макс, x));

// Уровень для оттенка блока: доля шкалы → lv-1 (низко), lv-2, lv-3 (высоко).
// Не новый цвет, а сила акцента темы: низкое тише, высокое ярче.
const уровень = (доля) => (доля >= 0.67 ? 3 : доля >= 0.34 ? 2 : 1);

function телоСтата(вид, значение, знак) {
  const { число, пояснение } = числоИПояснение(значение);
  const почему = (текст) => (текст ? `<span class="hud-v-why hud-cst-why">${escapeHtml(текст)}</span>` : '');
  if (вид === 'text' || (вид !== 'tags' && число === null)) return { html: `<p class="hud-cst-text">${escapeHtml(значение)}</p>`, ур: 0 };
  if (вид === 'tags') {
    const метки = String(значение).split(/\s*;\s*/).filter(Boolean);
    return { html: `<div class="hud-cst-tags">${метки.map(м => `<em class="hud-v-tag">${escapeHtml(м)}</em>`).join('')}</div>`, ур: 0 };
  }
  if (вид === 'pct') {
    const п = Math.round(ограничить(число, 0, 100));
    // Кольцо — то же, что у доверия и оргазма (views.css, .hud-v-ring).
    return { html: `<div class="hud-cst-meter"><i class="hud-v-ring hud-cst-ring" style="--p:${п}"><b class="hud-v-ring-face">${п}<small>%</small></b></i><div class="hud-cst-side"><span class="hud-v-mini-bar hud-cst-bar"><i style="width:${п}%"></i></span>${почему(пояснение)}</div></div>`, ур: уровень(п / 100) };
  }
  if (вид === 'scale') {
    const н = Math.round(ограничить(число, 0, 10));
    // Столбики растут слева направо — как индикатор громкости.
    return { html: `<div class="hud-cst-meter"><b class="hud-cst-score">${н}<small>/10</small></b><span class="hud-cst-eq" role="img" aria-label="${н}/10">${Array.from({ length: 10 }, (_, i) => `<i${i < н ? ' class="is-on"' : ''}></i>`).join('')}</span></div>${почему(пояснение)}`, ур: уровень(н / 10) };
  }
  if (вид === 'stars') {
    const н = Math.round(ограничить(число, 0, 5));
    return { html: `<div class="hud-cst-meter"><span class="hud-cst-stars" role="img" aria-label="${н}/5">${Array.from({ length: 5 }, (_, i) => `<i${i < н ? ' class="is-on"' : ''}>${ико('star')}</i>`).join('')}</span>${почему(пояснение)}</div>`, ур: уровень(н / 5) };
  }
  const показ = Number.isInteger(число) ? String(число) : String(число).replace('.', ',');
  return { html: `<div class="hud-cst-meter is-num"><b class="hud-cst-score is-big">${escapeHtml(показ)}</b>${почему(пояснение)}</div>`, ур: 0 };
}

/** Блок стата на карточке. Пустое значение — пустая строка. */
export function блокСтата(ст, значение) {
  if (!значение) return '';
  const знак = ЗНАК.has(ст.icon) ? ст.icon : (ВИД[ст.view] || ВИД.num).знак;
  const { html, ур } = телоСтата(ст.view, значение, знак);
  const цв = цветСтата(ст);
  return `<div class="hud-v hud-cst hud-cst-v-${ст.view}${ур ? ' lv-' + ур : ''}${цв.класс} full-width" data-cst="${escapeHtml(ст.id || '')}"${цв.стиль}>`
    + `<div class="hud-v-card">${ико(знак, 'hud-cst-mark')}<div class="hud-cst-head">${медаль(знак, 'hud-cst-medal')}<b class="hud-cst-name">${escapeHtml(ст.name)}</b>`
    + `<i class="hud-cst-grip" aria-hidden="true" title="Зажмите и тяните, чтобы переставить"></i></div>`
    + html + `</div></div>`;
}

// --- Карточка персонажа и игрока: строки полей с ключом ---------------------
// Каждая строка поля получает data-k — ключ поля (русское имя в нижнем
// регистре, как его видит сборщик карточки). По нему стат ставится «после
// поля», и по нему же перетаскивание узнаёт новое место.

/** Первой строке поля в куске разметки — data-k. */
export function пометитьСтроку(кусок, ключ) {
  if (!ключ || !кусок) return кусок;
  return кусок.replace(/<div class="(?:hud-row|hud-key-block)[^"]*"/, (всё) => `${всё} data-k="${escapeHtml(ключ)}"`);
}

/**
 * Раскладка блоков статов по полям одной карточки. блоки — [{ after, html }].
 * после(ключ) — разметка блоков, стоящих после этого поля (или '^' — в начале);
 * остаток() — всё, что не нашло своего поля, и стоящее в конце.
 */
export function раскладкаСтатов(блоки) {
  const ждут = (Array.isArray(блоки) ? блоки : []).filter(б => б && б.html);
  const отдано = new Set();
  const после = (ключ) => ждут.filter(б => !отдано.has(б) && б.after === ключ).map(б => { отдано.add(б); return б.html; }).join('');
  const остаток = () => ждут.filter(б => !отдано.has(б)).map(б => { отдано.add(б); return б.html; }).join('');
  return { после, остаток, есть: ждут.length > 0 };
}

/**
 * Блоки статов во вкладку без строк полей (память, быт, мир): '^' — сразу
 * после открывающего тега вкладки, остальное — перед закрывающим.
 */
export function вставитьВВкладку(разметка, блоки) {
  const р = раскладкаСтатов(блоки);
  if (!р.есть || !разметка) return разметка;
  let html = String(разметка);
  const начало = р.после('^'), конец = р.остаток();
  const м = html.match(/<div class="hud-tab-content[^"]*"[^>]*>/);
  if (начало && м) html = html.slice(0, м.index + м[0].length) + начало + html.slice(м.index + м[0].length);
  else if (начало) html = начало + html;
  const з = html.lastIndexOf('</div>');
  if (конец) html = з >= 0 ? html.slice(0, з) + конец + html.slice(з) : html + конец;
  return html;
}
