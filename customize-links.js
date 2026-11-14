// hud-manager/customize-links.js
//
// Кастомизация: нажатие на кусочек примера ведёт к настройке, которая за него
// отвечает. Поле подсвечивается, разделы с ним раскрываются, панель листается.
// Тут же — список картинок темы, чтобы убирать их по одной.
//
// Карта: от самого внутреннего элемента наружу, в пределах одного элемента —
// первая подошедшая строка. Нажатие не перехватывается: вкладки и экраны
// телефона в примере работают как обычно. Что каждая настройка есть в карте,
// проверяет tests/unit.mjs.

import { settings } from './settings.js?v=23.89.25';
import { слои, адресСлоя, файлИз, сПоказаннымиЧастями, запомнитьРазмер, прямоугольникСлоя } from './scene-pieces.js?v=23.89.25';
import { т } from './i18n.js?v=23.89.25';

const ВИДЫ_ПОД_КЛАСС = {
  age: 'ageView', clothes: 'clothesView', looks: 'looksView', role: 'roleView', body: 'bodyStateView', phys: 'physView', health: 'healthView',
  marks: 'marksView', cycle: 'cycleView', preg: 'pregnancyView', x2: 'postpartumView', where: 'placeView', lines: 'linesView', 'key-view': 'keyView', exp: 'expView',
  thoughts: 'thoughtsView', subtext: 'subtextView', fears: 'fearsView', exposure: 'exposureView', inventory: 'inventoryView', goals: 'goalsView', schedule: 'scheduleView', flags: 'flagsView',
  trust: 'trustView', memories: 'memoriesView', status: 'statusView', conflict: 'conflictView', jealousy: 'jealousyView',
};
const ДОБАВКИ_К_ВИДУ = { thoughts: ['dropCap', 'thoughtBrackets', 'inkWash', 'fontMain'], subtext: ['subtextVeil'],  health: ['healthPlaster'], trust: ['trustHearts'], lines: ['lineWave', 'lineNotes', 'crtLines', 'thoughtBrackets'], cycle: [], preg: ['fetusView'] };
// Подписи рядов без своего класса: сравнение с началом подписи.
const ВИДЫ_ПО_ПОДПИСИ = [
  ['бельё', 'underwearView'], ['готовность к оргазму', 'orgView'], ['пульс', 'vitalsView'], ['жизненные показатели', 'vitalsView'], ['карта тела', 'bodyMapView', 'silhouetteStyle', 'silhouetteOutlines', 'silhouetteLook'],
  ['отношения', 'relationsView'], ['кинк', 'kinkView'], ['фетиш', 'kinkView'], ['никогда не сделает', 'kinkView'], ['не возбуждает', 'kinkView'], ['словесная дуэль', 'duelView'], ['вехи и уход', 'kidCareView'],
  ['таймлайн', 'timelineView'], ['мини-карта маршрута', 'routeView'], ['эмоции', 'moodView'], ['приглашения', 'invitesView'], ['обещания', 'promisesView'], ['важное', 'importantView'], ['ружья', 'gunsView'], ['кто что знает', 'secretsGridView'], ['не знает', 'knowsNotView', 'knowledgeLine'], ['зашифрованные', 'secretsView'], ['скрытый подтекст', 'subtextVeil'],
  ['мысли', 'dropCap', 'thoughtBrackets', 'fontMain'],
];
const ТЕКСТ = ['fontMain', 'fontSizeMain', 'textColor', 'textMutedColor'];
const БЛОК = ['infoBlockBgStart', 'infoBlockBgAlpha', 'infoBlockBgEnd', 'sectionSkin', 'cornerShape'];
const ПОГОДА = ['weatherBgColor', 'weatherBgAlpha', 'weatherBlur', 'sceneTextColor'];
const СЦЕНА = ['sceneOverlayColor', 'sceneOverlayAlpha', 'sceneDarkness', 'lightFollowsTime'];
const ТЕЛЕФОН_ТЕМА = ['phoneBgStart', 'phoneBgEnd', 'phoneBgAlpha', 'phoneAccent', 'phoneBlur', 'phoneScreenGlow', 'phoneGlow'];
const ПЛАШКИ_ПИЛЮЛЬ = '.hud-key-item, .hud-detail-pill, .hud-inventory-pill, .hud-conflict-pill, .hud-kink-pill, .hud-fetish-pill, .hud-nogo-pill, .hud-noturn-pill, .hud-nsfw-pill';
const МИР = { horo: 'horoscopeView', news: 'newsView', rumors: 'rumorsView', eco: 'economyView', city: 'cityView', fc: 'forecastView', afisha: 'eventsView', ads: 'adsView', cmt: 'commentsView' };

export const КАРТА = [
  // Новые блоки с выбором вида (render/views-plus.js).
  ['.hud-vp-kin, .hud-vp-seams, .hud-trust-scars', ['trustScarsView', 'enableScars']],
  ['.hud-vp-engr, .hud-vp-engr-list, .hud-vp-seal, .hud-vp-seal-list, .hud-vp-plane-list, .hud-invite', ['invitesView']],
  ['.hud-vp-redact, .hud-vp-blind', ['knowsNotView', 'knowledgeLine']],
  ['.hud-body-stats', ['weightView']],
  ['.hud-vp-sprig, .hud-vp-herb, .hud-vp-path, .hud-vp-moon, .hud-state-plaque.is-loss', ['lossView']],
  ['.hud-vp-quipu, .hud-vp-pairs, .hud-vp-chain, .hud-promises', ['promisesView']],
  ['.hud-mw', ['meanwhileView']],
  // Виды из render/views-story.js и прежние блоки тех же полей.
  ['.hud-tl, .hud-timeline-container', ['timelineView']],
  ['.hud-em, .hud-mood-group', ['moodView']],
  // Древо — во вкладке «Семья» графа: раньше графа, у вида древа тоже класс .hud-gr.
  ['.hud-ft, .hud-family-stage', ['familyTreeView']],
  ['.hud-gr, .hud-memory-relgraph-slot, .hud-rel-graph', ['relGraphView']],
  ['.hud-rl', ['relationsView']],
  ['.hud-bt, .hud-cb', ['combatView']],
  ['.hud-pg, .hud-prg', ['pregnancyView']],
  // Часы и сцена.
  ['.hud-time-display', ['fontClock', 'fontSizeClock', 'clockColor']],
  ['.hud-date-display', ['fontMain', 'sceneTextColor']],
  ['.hud-moonchip', ['moonPhase']],
  ['.hud-weather-item, .hud-mood-item, .hud-scene-weather-group', ПОГОДА],
  ['.hud-scene-atm', ['sceneCredits', ...ПОГОДА]],
  ['.hud-scene-top', ПОГОДА],
  ['.hud-scene-widget, [class*="hud-fx-"]', СЦЕНА],
  // Полоса и вкладки.
  ['.hud-budget-chip', ['tokenBudget']],
  ['.hud-os-logo, .hud-os-subtitle', ['genIndicator', 'themedControls', 'themedScroll', 'autoAccentText', 'containerQueries', 'startingStyle', 'themeSwitchFade', 'customDetailMode']],
  ['.hud-os-topbar', ['topBarBg', 'topBarAlpha', 'sceneBar', 'peekCat']],
  ['.hud-unread-badge, .hud-tab-badge, .hud-mem-badge', ['badgeColor']],
  ['.hud-tab', ['tabsBg', 'tabsAlpha', 'tabBow', 'accentColor']],
  ['.hud-tabs-header', ['tabsBg', 'tabsAlpha']],
  // Шапка персонажа.
  ['.hud-banner-vert', ['verticalName']],
  ['.hud-banner', ['headerStyle', 'bannerCharImg', 'bannerCharOffsetX', 'bannerCharOffsetY', 'bannerUserImg', 'bannerUserOffsetX', 'bannerUserOffsetY']],
  ['.hud-ava-wrap', ['avatarShape', 'avatarDeco', 'avatarFrameColor', 'avatarScale', 'avatarOffsetX', 'avatarOffsetY', 'eclipseRing']],
  ['.hud-head-orn', ['headerOrnament']],
  ['.hud-head-wax', ['waxSeal']],
  ['.hud-pendant', ['hangPendant']],
  ['.hud-label-badge, .hud-dossier', ['dossierTag']],
  ['.hud-ghost-letter, .hud-hanko', ['nameHanko']],
  ['.hud-epigraph', ['epigraph']],
  ['.hud-day', ['dayCount']],
  ['.hud-prof-stats', ['headerProfile']],
  ['.hud-title, .hud-prof-namebar', ['nameStyle', 'fontHeaders', 'fontSizeHeaders', 'sceneName']],
  ['.hud-header', ['headerStyle', 'headerProfile']],
  // Значки и заголовки.
  ['.hud-key-ico', ['iconStyle']],
  ['.hud-section-title', ['lightHeadings', 'fontHeaders', 'fontSizeHeaders']],
  ['.hud-group-div', ['groupDividers']],
  ['.hud-sign', ['cardSignature']],
  // Конфликт красится цветом драмы: у плашки две группы настроек — выбор в меню.
  ['.hud-conflict-pill', ['dramaColor', 'dramaBgAlpha', 'pillStyle', 'pillColors', 'pillIcons']],
  [ПЛАШКИ_ПИЛЮЛЬ, ['pillStyle', 'pillColors', 'pillIcons']],
  // Близость и драма.
  ['.hud-sclock', ['sceneClockView']],
  ['.hud-tempo', ['tempoView']],
  ['.hud-duel', ['duelView']],
  // Влечение под циклом — часть блока цикла (что показывать — в основных настройках).
  ['.hud-libido', ['cycleView']],
  ['.hud-row.drama-alert', ['dramaColor', 'dramaBgAlpha']],
  ['.hud-user-look', ['silhouetteLook', 'silhouetteStyle', 'silhouetteOutlines']],
  // Память.
  ['.hud-v-route', ['routeView']],
  ['.hud-v-imp', ['importantView']],
  ['.hud-v-fuses', ['gunsView']],
  ['.hud-v-secbars, .hud-v-lore', ['secretsView']],
  ['.hud-memory-body', ['memoryBgStart', 'memoryBgAlpha', 'memoryBgEnd', 'memoryAccent', 'memoryGlowAlpha', 'memoryBlur']],
  // Быт, дети, спутники, сны, дневник, перехваты.
  ['.hud-life-gauges, .hud-life-hero', ['lifeGaugeView']],
  ['.hud-life-day, .hud-life-dial', ['lifeDayView']],
  ['.hud-life-wardrobe, .hud-life-hanger, .hud-life-rail, .hud-life-wlist', ['wardrobeView']],
  ['.hud-kid-care-body', ['kidCareView']],
  ['.hud-kid-tracker', ['kidTrackerView']],
  ['.hud-fetus', ['fetusView']],
  ['.hud-pp', ['postpartumView']],
  ['.hud-v-bond', ['bondView']],
  ['.hud-pet2, .hud-pets', ['petView']],
  ['.hud-dream-container, .hud-dv', ['dreamsView']],
  ['.hud-jv-silk, .hud-jv-kiss, .hud-jv-therm', ['bodyDiaryView', 'fontDiary']],
  ['.hud-jv-book, .hud-jv-blog, .hud-jv-type', ['diaryView', 'fontDiary', 'fontSizeDiary']],
  ['.hud-iv, .hud-intercepts-alt', ['interceptsView']],
  // Запись дневника тела носит и класс записи дневника: дневник тела — раньше.
  ['.hud-body-diary, .hud-diary-body-hand, .hud-body-entry', ['bodyDiaryView', 'bodyDiaryHand', 'fontDiary']],
  ['.hud-diary-wax', ['waxSeal']],
  ['.hud-diary-about-label, .hud-diary-about-user', ['diaryVeil']],
  ['.hud-diary-entry, .hud-diary-container', ['diaryView', 'fontDiary', 'fontSizeDiary', 'diaryMoodHand']],
  ['.hud-phone-mockup.intercept-mode, .hud-intercept-header', ['interceptsView', 'interceptColor', 'interceptBgAlpha']],
  // Телефон.
  ['.hud-phone-lock-time, .hud-phone-lock-analog', ['phoneLockClock']],
  ['.hud-phone-notif, .hud-phone-lock-notice, .hud-phone-notif-stack, .hud-phone-home-notice', ['phoneNotifStyle', 'phoneNotifMax', 'phoneNotifAlpha']],
  ['.hud-msg-wrapper.outgoing .hud-msg-bubble', ['msgOutStart', 'msgOutEnd', 'msgOutAlpha', 'phoneBubbleRadius']],
  ['.hud-msg-wrapper.incoming .hud-msg-bubble', ['msgInBg', 'msgInAlpha', 'phoneBubbleRadius']],
  ['.hud-phone-app', ['phoneIconRadius', 'phoneIconsView']],
  ['.hud-phone-keys, .hud-phone-btn-side', ['phoneDevice', 'phoneFrameColor']],
  ['.hud-phone-cracks', ['phoneCracks']],
  ['.hud-phone-bottom-bar, .hud-phone-top-status', ['phoneDevice']],
  ['.hud-phone-app-view, .hud-phone-chat-area', ['phoneFont', 'phoneFontSize', ...ТЕЛЕФОН_ТЕМА]],
  ['.hud-phone-emulator', [...ТЕЛЕФОН_ТЕМА, 'phoneCracks', 'phoneDevice']],
  ['.hud-phone-shell', ['phoneFrameColor', 'phoneDevice']],
  // Ряд с полем: вид, NSFW, общий блок.
  ['.hud-row.nsfw', ['nsfwColor', 'nsfwBgAlpha']],
  ['.hud-row', [...БЛОК, ...ТЕКСТ]],
  ['.hud-world-section-horo', ['horoscopeView']],
  ['.hud-world-section', ТЕКСТ],
  // Края: тело вкладки и вся карточка.
  ['.hud-body, .hud-tab-content', ['cardBgStart', 'cardBgAlpha', 'cardBgEnd', 'backdropBlur', 'paperAged', 'paperTorn', 'paperFolds', 'bgDragon', 'inkWash', 'peekCat', 'sceneCorner', 'bgImage', 'bgOpacity', 'bgScale', 'bgOffsetY']],
  ['.hud-os-wrapper, .hud-os-card', ['glowColor', 'glowAlpha', 'glowSize', 'glowBreath', 'glowMobile', 'accentColor', 'glassType', 'subtextVeil', 'sceneCard', 'themeScene', 'noImages']],
];
// Настройки всей карточки: у них нет своего места на примере, живут у текста.
export const ОБЩИЕ_ТЕКСТ = ТЕКСТ;

const нормально = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s«»-]/gu, '').replace(/\s+/g, ' ').trim();
const подпись = (ряд) => { const к = ряд.querySelector(':scope > .hud-key'); return к ? нормально(к.textContent) : ''; };

/** Ключи настройки для ряда: по классу поля, иначе по подписи. */
export function ключиРяда(ряд) {
  if (!ряд || !ряд.classList) return null;
  for (const кл of ряд.classList) {
    const м = /^f-(.+)$/.exec(кл);
    if (м && м[1] in ВИДЫ_ПОД_КЛАСС) return [ВИДЫ_ПОД_КЛАСС[м[1]], ...(ДОБАВКИ_К_ВИДУ[м[1]] || [])].filter(Boolean);
  }
  const текст = подпись(ряд);
  if (!текст) return null;
  for (const [начало, ...ключи] of ВИДЫ_ПО_ПОДПИСИ) if (текст.startsWith(нормально(начало)) || текст.startsWith(нормально(т(начало)))) return ключи;
  return null;
}

/** Куда ведёт нажатие: список ключей или null. */
export function ключиНажатия(цель, граница) {
  for (let узел = цель; узел && узел !== граница; узел = узел.parentElement) {
    if (узел.dataset && узел.dataset.wvBlock && МИР[узел.dataset.wvBlock]) return [МИР[узел.dataset.wvBlock]];
    if (узел.classList && узел.matches('.hud-row, .hud-key-block')) { const к = ключиРяда(узел); if (к) return к; }
    if (узел.classList && узел.matches) for (const [сел, ключи] of КАРТА) if (узел.matches(сел)) return ключи;
  }
  return null;
}

// --- Переход к настройке ------------------------------------------------------
function пульс(узел) {
  узел.classList.remove('hud-link-pulse');
  void узел.offsetWidth;
  узел.classList.add('hud-link-pulse');
  setTimeout(() => узел.classList.remove('hud-link-pulse'), 2400);
}
function раскрыть(панель, узел, открытьПодробно) {
  if (узел.closest('#hud-custom-detail') && открытьПодробно) открытьПодробно();
  for (let d = узел.closest('details'); d && панель.contains(d); d = d.parentElement && d.parentElement.closest('details')) d.open = true;
}
const рядПоля = (поле) => поле.closest('.hud-theme-row, .hud-pset-row, .hud-custom-minimal') || поле;

// Подпись ряда и где он лежит: «Шрифт часов» · «Шрифты & Размеры».
const текстУзла = (у) => String((у && у.textContent) || '').replace(/\s+/g, ' ').replace(/[:：]\s*$/, '').trim();
function подписьРядa(ряд, поле) {
  // Поле в своей метке («Поверхность» у роли цвета) — подпись рядом с ним.
  const своя = поле.closest('label');
  const метка = своя && ряд.contains(своя) ? своя : ряд.querySelector('label');
  return текстУзла(метка) || поле.closest('[title]')?.getAttribute('title')?.split(/[.:—]/)[0] || '';
}
function разделРяда(ряд) {
  const части = [];
  for (let d = ряд.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) {
    const заголовок = d.querySelector(':scope > summary');
    if (заголовок) части.unshift(текстУзла(заголовок).replace(/^[^\p{L}]+/u, ''));
  }
  return части.join(' › ');
}
/** Ряды настроек по ключам, без повторов, в порядке ключей. */
function рядыКлючей(панель, ключи) {
  const итог = [];
  for (const к of ключи) {
    // Одна настройка бывает в двух местах панели (цвет фона — и в «Системе
    // цветов», и в «Фонах»): берём поле с подписью, а не голый ключ.
    const варианты = [...панель.querySelectorAll(`[data-key="${к}"]`)].map(поле => { const ряд = рядПоля(поле); return { поле, ряд, подпись: подписьРядa(ряд, поле) }; });
    const лучший = варианты.find(в => в.подпись && в.ряд.matches('.hud-theme-row, .hud-pset-row')) || варианты.find(в => в.подпись) || варианты[0];
    if (!лучший) continue;
    const { поле, ряд } = лучший;
    if (!итог.some(и => и.ряд === ряд)) итог.push({ ключ: к, поле, ряд, подпись: лучший.подпись || т('Настройка'), раздел: разделРяда(ряд) });
  }
  return итог;
}
function открытьРяды(окно, ряды, открытьПодробно) {
  const панель = окно.querySelector('.hud-custom-settings');
  ряды.forEach(р => раскрыть(панель, р.поле || р.ряд, открытьПодробно));
  ряды[0].ряд.scrollIntoView({ block: 'center', behavior: 'smooth' });
  ряды.forEach(р => пульс(р.ряд));
}

export function закрытьМеню(окно) { окно.querySelectorAll('.hud-link-menu').forEach(м => м.remove()); }
// Меню у места нажатия: каждая настройка этой плашки — строкой со своим разделом.
function показатьМеню(окно, e, ряды, открытьПодробно) {
  закрытьМеню(окно);
  const сцена = окно.querySelector('.hud-custom-preview');
  if (!сцена) return;
  const меню = document.createElement('div');
  меню.className = 'hud-link-menu';
  меню.setAttribute('role', 'menu');
  const группы = new Map();
  ряды.forEach((р, i) => { if (!группы.has(р.раздел)) группы.set(р.раздел, []); группы.get(р.раздел).push(i); });
  // Короткое меню: в разделе до трёх настроек — каждая строкой; больше —
  // одной строкой «раздел (N)», она открывает их все сразу с подсветкой.
  const чисто = (s) => String(s).replace(/[&<>"]/g, '');
  меню.innerHTML = `<div class="hud-link-menu-head"><b>${т('Настройки этого места')}</b>${ряды.length > 1 ? `<button type="button" data-link-all>${т('Показать все')}</button>` : ''}</div>`
    + [...группы].map(([раздел, номера]) => {
      const имя = раздел ? чисто(раздел.split(' › ').pop()) : '';
      if (номера.length > 3) return `<div class="hud-link-menu-sec"><button type="button" role="menuitem" class="is-sec" data-link-sec="${номера.join(',')}"><b>${имя || т('Настройки')}</b><span>${номера.length}</span></button><small>${номера.slice(0, 3).map(i => чисто(ряды[i].подпись)).join(', ')}…</small></div>`;
      return `<div class="hud-link-menu-sec">${имя ? `<small class="is-head">${имя}</small>` : ''}${номера.map(i => `<button type="button" role="menuitem" data-link-i="${i}">${чисто(ряды[i].подпись)}</button>`).join('')}</div>`;
    }).join('');
  сцена.appendChild(меню);
  const рам = сцена.getBoundingClientRect();
  const ш = меню.offsetWidth, в = меню.offsetHeight;
  меню.style.left = Math.max(6, Math.min(e.clientX - рам.left + сцена.scrollLeft, сцена.clientWidth - ш - 6 + сцена.scrollLeft)) + 'px';
  меню.style.top = Math.max(6 + сцена.scrollTop, Math.min(e.clientY - рам.top + сцена.scrollTop + 8, сцена.scrollTop + сцена.clientHeight - в - 6)) + 'px';
  меню.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const пункт = ev.target.closest('[data-link-i]');
    if (пункт) { открытьРяды(окно, [ряды[+пункт.dataset.linkI]], открытьПодробно); закрытьМеню(окно); return; }
    const раздел = ev.target.closest('[data-link-sec]');
    if (раздел) { открытьРяды(окно, раздел.dataset.linkSec.split(',').map(i => ряды[+i]), открытьПодробно); закрытьМеню(окно); return; }
    if (ev.target.closest('[data-link-all]')) { открытьРяды(окно, ряды, открытьПодробно); закрытьМеню(окно); }
  });
}

/**
 * Перейти к настройкам. Одна строка (или все в одном разделе рядом) — сразу к
 * ней; разные разделы — меню на месте нажатия, чтобы выбрать нужную.
 */
export function перейтиКНастройке(окно, ключи, открытьПодробно, e = null) {
  const панель = окно.querySelector('.hud-custom-settings');
  if (!панель) return false;
  const ряды = рядыКлючей(панель, ключи);
  if (!ряды.length) return false;
  const разделов = new Set(ряды.map(р => р.раздел)).size;
  if (e && ряды.length > 1 && (разделов > 1 || ряды.length > 4)) { показатьМеню(окно, e, ряды, открытьПодробно); return true; }
  открытьРяды(окно, ряды, открытьПодробно);
  return true;
}

// --- Картинки темы по одной ---------------------------------------------------
export const МЕСТА_КАРТИНОК = { t: 'Полоса и вкладки', h: 'Шапка', n: 'У имени', a: 'Портрет', b: 'Угол вкладки', c: 'Вся карточка' };
export const ЧАСТИ_КАРТИНКИ = ['self', 'before', 'after'];
export const КЛЮЧ_МЕСТА = { t: 'sceneBar', n: 'sceneName', b: 'sceneCorner', c: 'sceneCard', h: 'headerOrnament', a: 'avatarDeco' };
const псевдо = (часть) => (часть === 'self' ? undefined : '::' + часть);
const адрес = (значение) => { const м = /url\(["']?([^"')]+)["']?\)/.exec(String(значение || '')); return м ? м[1] : ''; };
export const ключКартинки = (тема, место, часть) => `${тема}:${место}:${часть}`;
const темаМеста = (место) => {
  const м = new RegExp(`(?:^|\\s)hud-s${место}-(?!img|on)([a-z0-9]+)(?:\\s|$)`).exec(document.documentElement.className);
  return м ? м[1] : '';
};
const узелМеста = (карточка, место) => карточка.querySelector(`.hud-tab-content.active .hud-scene-${место}`) || карточка.querySelector(`.hud-scene-${место}`);

/** Какие картинки сейчас есть в карточке, включая спрятанные. Слой с
    несколькими картинками («Вампир»: клыки, медальон, канделябр в одном слое)
    даёт по картинке на каждую — с номером слоя, чтобы найти её по нажатию. */
export function картинкиТемы(карточка) {
  const корень = document.documentElement;
  const скрытые = [...корень.classList].filter(к => /^hud-hide-[thnabc]-/.test(к));
  скрытые.forEach(к => корень.classList.remove(к));
  const итог = [];
  try {
    сПоказаннымиЧастями(() => {
      for (const место of Object.keys(МЕСТА_КАРТИНОК)) {
        const узел = узелМеста(карточка, место), тема = темаМеста(место);
        if (!узел || !тема) continue;
        for (const часть of ЧАСТИ_КАРТИНКИ) {
          const с = getComputedStyle(узел, псевдо(часть));
          if (часть !== 'self' && (с.content === 'none' || с.content === 'normal')) continue;
          const фоны = слои(с.backgroundImage).map(адресСлоя);
          if (фоны.filter(Boolean).length > 1) {
            фоны.forEach((url, слой) => {
              if (!url) return;
              запомнитьРазмер(url);
              итог.push({ место, часть, тема, url, слой, ключ: ключКартинки(тема, место, часть) + ':' + файлИз(url), маска: false });
            });
            continue;
          }
          const url = адрес(с.backgroundImage) || адрес(с.webkitMaskImage || с.maskImage);
          if (url) итог.push({ место, часть, тема, url, ключ: ключКартинки(тема, место, часть), маска: !адрес(с.backgroundImage) });
        }
      }
    });
  } finally { скрытые.forEach(к => корень.classList.add(к)); }
  return итог;
}

export function заполнитьКартинки(окно) {
  const место = окно.querySelector('.hud-scene-pieces');
  const карточка = окно.querySelector('.hud-custom-preview-body .hud-os-card:not(.hud-swap-old)');
  if (!место || !карточка) return;
  const список = картинкиТемы(карточка);
  const скрыто = new Set(Array.isArray(settings.sceneHidden) ? settings.sceneHidden : []);
  место.innerHTML = список.length ? список.map(к => {
    const вид = к.маска ? `-webkit-mask:url('${к.url}') center/contain no-repeat;mask:url('${к.url}') center/contain no-repeat;background:currentColor` : `background:url('${к.url}') center/contain no-repeat`;
    return `<button type="button" class="hud-scene-piece${скрыто.has(к.ключ) ? ' is-off' : ''}" data-piece="${к.ключ}" aria-pressed="${!скрыто.has(к.ключ)}" title="${т('Нажмите, чтобы убрать или вернуть эту картинку')}"><i style="${вид}"></i><small>${т(МЕСТА_КАРТИНОК[к.место])}</small></button>`;
  }).join('') : `<small>${т('В этой теме сейчас нет картинок')}</small>`;
}

/** Нажатие в списке картинок: убрать или вернуть одну. */
export function переключитьКартинку(кнопка, применить) {
  const ключ = кнопка.dataset.piece;
  const список = new Set(Array.isArray(settings.sceneHidden) ? settings.sceneHidden : []);
  if (список.has(ключ)) список.delete(ключ); else список.add(ключ);
  settings.sceneHidden = [...список];
  кнопка.classList.toggle('is-off', список.has(ключ));
  кнопка.setAttribute('aria-pressed', String(!список.has(ключ)));
  применить();
}

/** Где на экране картинка темы: { left, top, width, height } или null. */
export function рамкаКартинки(карточка, к) {
  const узел = узелМеста(карточка, к.место);
  if (!узел) return null;
  const рам = узел.getBoundingClientRect();
  const с = getComputedStyle(узел, псевдо(к.часть));
  if (к.часть === 'self') return к.слой === undefined ? { left: рам.left, top: рам.top, width: рам.width, height: рам.height } : прямоугольникСлоя(рам, с, к.слой, к.url);
  const л = parseFloat(с.left) || 0, в0 = parseFloat(с.top) || 0;
  // Слой на всю вкладку (inset: 0) бывает с шириной auto: тогда от краёв.
  const ш = parseFloat(с.width) || Math.max(0, рам.width - л - (parseFloat(с.right) || 0));
  const в = parseFloat(с.height) || Math.max(0, рам.height - в0 - (parseFloat(с.bottom) || 0));
  const рамка = { left: рам.left + л, top: рам.top + в0, width: ш, height: в };
  // Картинка из общего слоя: её место внутри слоя — по размеру и позиции слоя.
  return к.слой === undefined ? рамка : прямоугольникСлоя(рамка, с, к.слой, к.url);
}

/** Попало ли нажатие в картинку темы. Рисунки живут в псевдоэлементах, поэтому считаем по прямоугольникам.
    Картинки угла вкладки и всей карточки лежат под плашками: нажатие по
    плашке над ними находит картинку с пометкой подБлоком — тогда меню
    предложит и её, и саму плашку. */
export function картинкаПодНажатием(карточка, e, цель) {
  const внизу = !цель.closest('.hud-body, .hud-tab-content') || цель.matches('.hud-body, .hud-tab-content');
  const карта = карточка.getBoundingClientRect(), подошли = [];
  for (const к of картинкиТемы(карточка)) {
    const подБлоком = !внизу && (к.место === 'b' || к.место === 'c');
    const п = рамкаКартинки(карточка, к);
    if (!п) continue;
    const { left: слева, top: сверху, width: ш, height: в } = п;
    if (!ш || !в || ш * в > карта.width * карта.height * .6) continue;
    if (e.clientX >= слева && e.clientX <= слева + ш && e.clientY >= сверху && e.clientY <= сверху + в) подошли.push({ к: подБлоком ? { ...к, подБлоком } : к, площадь: ш * в });
  }
  подошли.sort((a, b) => a.площадь - b.площадь);
  return подошли.length ? подошли[0].к : null;
}

export function перейтиККартинке(окно, картинка, открытьПодробно, e = null, ещё = []) {
  const панель = окно.querySelector('.hud-custom-settings');
  const кнопка = панель && панель.querySelector(`[data-piece="${картинка.ключ}"]`);
  if (!кнопка) return false;
  const ряды = [{ ключ: картинка.ключ, поле: кнопка, ряд: кнопка, подпись: т('Только эта картинка') + ' · ' + т(МЕСТА_КАРТИНОК[картинка.место]), раздел: разделРяда(кнопка) },
    ...рядыКлючей(панель, [КЛЮЧ_МЕСТА[картинка.место], 'themeScene', 'noImages'])];
  // Картинка под плашкой: в том же меню — и настройки самой плашки.
  const свои = new Set(ряды.map(р => р.ключ));
  for (const р of рядыКлючей(панель, ещё)) if (!свои.has(р.ключ)) ряды.push(р);
  if (e) показатьМеню(окно, e, ряды, открытьПодробно); else открытьРяды(окно, ряды.slice(0, 1), открытьПодробно);
  return true;
}

// Слои без нажатий (pointer-events: none): дракон, подвеска, печать, ярлык.
const СЛОИ = [
  ['.hud-dragon', ['bgDragon']], ['.hud-pendant', ['hangPendant']], ['.hud-head-wax', ['waxSeal']], ['.hud-head-orn', ['headerOrnament']],
  ['.hud-label-badge', ['dossierTag']], ['.hud-ghost-letter', ['nameHanko']], ['.hud-diary-wax', ['waxSeal']], ['.hud-sign', ['cardSignature']],
];
function слойПодНажатием(карточка, e) {
  const карта = карточка.getBoundingClientRect();
  let лучший = null, площадь = Infinity;
  for (const [сел, ключи] of СЛОИ) for (const узел of карточка.querySelectorAll(сел)) {
    if (узел.closest('.hud-tab-content:not(.active)')) continue;
    const р = узел.getBoundingClientRect(), п = р.width * р.height;
    if (!п || п > карта.width * карта.height * .35 || getComputedStyle(узел).display === 'none' || getComputedStyle(узел).visibility === 'hidden') continue;
    if (e.clientX >= р.left && e.clientX <= р.right && e.clientY >= р.top && e.clientY <= р.bottom && п < площадь) { лучший = ключи; площадь = п; }
  }
  return лучший;
}

// Часы, дата, луна и погода в виджете сцены не ловят нажатия (pointer-events:
// none — на виджет вешается своё): нажатие достаётся виджету, и вело к
// оттенку сцены. Ищем под точкой самый маленький узел из карты внутри цели.
const ВСЕ_СЕЛЕКТОРЫ = КАРТА.map(([с]) => с).join(', ');
function глубжеПодНажатием(цель, e) {
  if (!цель.querySelectorAll || !Number.isFinite(e.clientX)) return цель;
  let лучший = цель, площадь = Infinity;
  for (const у of цель.querySelectorAll(ВСЕ_СЕЛЕКТОРЫ)) {
    const р = у.getBoundingClientRect(), п = р.width * р.height;
    if (!п || п >= площадь) continue;
    if (e.clientX >= р.left && e.clientX <= р.right && e.clientY >= р.top && e.clientY <= р.bottom) { лучший = у; площадь = п; }
  }
  return лучший;
}

/** Обработчик нажатия по примеру. */
export function нажатиеВПримере(окно, e, открытьПодробно) {
  if (!e.target || !e.target.closest) return false;
  if (!e.target.closest('.hud-link-menu')) закрытьМеню(окно);
  if (settings.customClickNav === false) return false;
  const тело = окно.querySelector('.hud-custom-preview-body');
  const карточка = тело && e.target.closest('.hud-os-card:not(.hud-swap-old)');
  if (!карточка || !тело.contains(карточка)) return false;
  заполнитьКартинки(окно);
  const картинка = картинкаПодНажатием(карточка, e, e.target);
  if (картинка && !картинка.подБлоком && перейтиККартинке(окно, картинка, открытьПодробно, e)) return true;
  const слой = слойПодНажатием(карточка, e);
  // Внутри вкладки цель — обычно сама плашка; глубже ищем только в контейнерах сцены и шапки.
  const откуда = e.target.matches('.hud-scene-widget, .hud-scene-top, .hud-scene-atm, .hud-header, .hud-os-topbar') ? глубжеПодНажатием(e.target, e) : e.target;
  const ключи = слой || ключиНажатия(откуда, тело.parentElement);
  // Картинка под плашкой (канделябр за «Здоровьем»): меню с ней и с плашкой.
  if (картинка && перейтиККартинке(окно, картинка, открытьПодробно, e, ключи || [])) return true;
  return ключи ? перейтиКНастройке(окно, ключи, открытьПодробно, e) : false;
}
