// hud-manager/tavern-theme.js
//
// «Как в Таверне»: тема HUD из активной темы SillyTavern. Обычный пресет
// (themes.js, id 'tavern'): кнопка под рядом готовых тем, «Шаг назад»,
// «Шаг вперёд», «Вернуть тему», «Запомнить правки» и «Сброс» работают с ним
// так же, как с любой темой. Отличия два:
// — значения не записаны заранее, а сняты с Таверны: её переменные
//   (--SmartTheme…, размытие, масштаб шрифта) и настоящие элементы чата —
//   так в счёт идёт и свой CSS темы, который часто красит всё сам;
// — тема следит за Таверной: сменили тему в Таверне — HUD перекрашивается
//   (следитьЗаТаверной). Поля, поправленные руками после выбора, не трогаем.
//
// Чтение (замеритьТаверну) — в браузере; разбор (темаИзЗамера) — чистая
// функция без DOM, её гоняет tests/unit.mjs на темах из папки themes.
// Читаемость важнее точности: текст остаётся цветом Таверны, а фон карточки
// темнеет (на светлой теме — светлеет), пока контраст не дойдёт до 4,5:1.
// Светлого фона на тёмной теме не бывает: фон двигается от цвета текста.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { разобратьЦвет, вHex, наложить, яркость, контраст } from './contrast.js?v=23.90.10';

export const ID_ТАВЕРНЫ = 'tavern';

// --- Цвет: смесь, насыщенность, расстояние ----------------------------------
const смешать = (а, б, доля) => ({ r: а.r + (б.r - а.r) * доля, g: а.g + (б.g - а.g) * доля, b: а.b + (б.b - а.b) * доля, a: 1 });
const ПОДЧЁРКИВАНИЕ_ТАВЕРНЫ = { r: 188, g: 231, b: 207, a: 1 };
const ЧЁРНЫЙ = { r: 0, g: 0, b: 0, a: 1 }, БЕЛЫЙ = { r: 255, g: 255, b: 255, a: 1 };
function насыщенность({ r, g, b }) {
  const мах = Math.max(r, g, b) / 255, мин = Math.min(r, g, b) / 255, l = (мах + мин) / 2;
  if (мах === мин) return 0;
  return (мах - мин) / (1 - Math.abs(2 * l - 1));
}
const светлота = ({ r, g, b }) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
const далеко = (а, б) => Math.hypot(а.r - б.r, а.g - б.g, а.b - б.b);
const цвет = (v) => { const c = разобратьЦвет(v); return c && Number.isFinite(c.r) ? c : null; };
const зажать = (v, а, б) => Math.min(б, Math.max(а, v));
const hex = (c) => вHex(c);

/**
 * Разбор замера в значения настроек HUD. Замер — простой объект строк и
 * чисел (см. замеритьТаверну); всё, чего нет, берётся как у Таверны по
 * умолчанию. Возвращает { vars, светлая } — vars те же ключи, что у тем.
 */
export function темаИзЗамера(з = {}) {
  const текст = { ...(цвет(з.mesText) || цвет(з.body) || { r: 220, g: 220, b: 210 }) };
  текст.a = 1;
  const исходный = { ...текст, a: 1 };
  // Что лежит под карточкой, снизу вверх: настоящие фоны чата и сообщения
  // (з.слои), а без открытого чата — переменные темы.
  const слои = (Array.isArray(з.слои) ? з.слои : [з.chatTint, з.botMes]).map(цвет).filter(c => c && (c.a ?? 1) > 0.02);
  const плотность = 1 - слои.reduce((п, с) => п * (1 - (с.a ?? 1)), 1);
  // Обои просвечивают — цвет темы лучше всего говорят её панели (blurTint).
  const снизу = [плотность < 0.97 ? цвет(з.blurTint) : null, ...слои].filter(Boolean);
  const собрать = (подложка, с = снизу) => с.reduce((низ, верх) => наложить(верх, низ), подложка);
  // Схема — по фону против текста; сквозь обои фона не видно — по тексту.
  // Серый текст на тёмном фоне светлой темой не считается.
  const всегоПлотно = 1 - снизу.reduce((п, с) => п * (1 - (с.a ?? 1)), 1);
  const светлая = всегоПлотно >= 0.5 ? яркость(собрать({ r: 128, g: 128, b: 128, a: 1 })) > яркость(текст) : яркость(текст) < 0.18;
  let фон = собрать(светлая ? { r: 246, g: 244, b: 240, a: 1 } : { r: 16, g: 16, b: 20, a: 1 });
  // Тёмная тема: фон не светлее 18% яркости, светлая — не темнее 45%, и читаем с текстом.
  const к = светлая ? БЕЛЫЙ : ЧЁРНЫЙ;
  for (let i = 0; i < 40 && (контраст(текст, фон) < 4.5 || (светлая ? яркость(фон) < 0.45 : яркость(фон) > 0.18)); i++) фон = смешать(фон, к, 0.12);
  // Фон уже некуда двигать — двигаем сам текст.
  for (let i = 0; i < 20 && контраст(текст, фон) < 4.5; i++) Object.assign(текст, смешать(текст, светлая ? ЧЁРНЫЙ : БЕЛЫЙ, 0.15));
  let фонКонец = светлая ? смешать(фон, текст, 0.07) : смешать(фон, ЧЁРНЫЙ, 0.35);
  if (контраст(текст, фонКонец) < 4.5) фонКонец = фон;

  // Акцент: цвет цитат, если он цветной; иначе подчёркивание, рамка, курсив.
  // Совсем серая тема (Bujo) остаётся серой: акцент — цвет цитат как есть.
  const рамка = [цвет(з.mesBorder), цвет(з.border)].find(c => c && (c.a ?? 1) > 0.02) || null;
  // Подчёркивание заводского цвета Таверны автор темы просто не трогал — оно последнее.
  const подчёркивание = цвет(з.underline), заводское = подчёркивание && далеко(подчёркивание, ПОДЧЁРКИВАНИЕ_ТАВЕРНЫ) < 2;
  const кандидаты = [цвет(з.quote), заводское ? null : подчёркивание, цвет(з.border), цвет(з.mesBorder), цвет(з.em), подчёркивание]
    .filter(c => c && (c.a ?? 1) > 0.25).map(c => ({ ...c, a: 1 }));
  const цветной = (c) => насыщенность(c) >= 0.18 && светлота(c) > 0.15 && светлота(c) < 0.9 && контраст(c, фон) >= 1.6;
  let акцент = кандидаты.find(цветной) || кандидаты[0] || текст;
  if (контраст(акцент, фон) < 2) акцент = смешать(акцент, текст, 0.5);
  // Свечение — второй цветной цвет темы, заметно другой; нет — тот же акцент.
  // Своя рамка сообщений (её рисует CSS темы) главнее прочих: она и есть лицо темы.
  const рамкаСвоя = цвет(з.mesBorder) && (цвет(з.mesBorder).a ?? 1) > 0.25 ? { ...цвет(з.mesBorder), a: 1 } : null;
  const свечение = [рамкаСвоя, ...кандидаты].filter(Boolean).find(c => c !== акцент && цветной(c) && далеко(c, ПОДЧЁРКИВАНИЕ_ТАВЕРНЫ) >= 2 && далеко(c, акцент) > 60 && контраст(c, фон) >= 1.8) || акцент;
  // Плашки HUD тонированы акцентом, и текст на них ещё и приглушается: тусклый
  // текст Таверны чуть светлеет (на светлой теме — темнеет), пока читается и там.
  const плашка = смешать(фон, акцент, 0.22);
  for (let i = 0; i < 20 && контраст(текст, плашка) < 6; i++) Object.assign(текст, смешать(текст, светлая ? ЧЁРНЫЙ : БЕЛЫЙ, 0.1));
  // Приглушённый — курсив Таверны, если он читается и отличается от текста.
  let приглушённый = цвет(з.em);
  if (приглушённый) приглушённый = { ...приглушённый, a: 1 };
  // Ярче основного текста (белый курсив в Azure) — уже не приглушённый.
  if (!приглушённый || далеко(приглушённый, текст) < 18 || контраст(приглушённый, фон) > контраст(текст, фон)) приглушённый = смешать(текст, фон, 0.35);
  for (let i = 0; i < 20 && Math.min(контраст(приглушённый, фон), контраст(приглушённый, фонКонец), контраст(приглушённый, плашка) + 0.5) < 4.5; i++) приглушённый = смешать(приглушённый, текст, 0.25);

  // «Быстрый интерфейс» Таверны (body.no-blur) размытие выключает совсем.
  const размытие = з.noBlur ? 0 : зажать(Math.round(Number(з.blur) || 0), 0, 30);
  const тени = Number(з.shadowWidth) || 0;
  const шрифт = Number(з.fontPx) > 0 ? Number(з.fontPx) : 15;
  const скругление = Number.isFinite(Number(з.radius)) && з.radius !== null && з.radius !== '' ? зажать(Math.round(Number(з.radius)), 0, 24) : 12;
  let альфаКарточки = светлая ? Math.round(зажать(96 - 30 * плотность, 66, 94)) : Math.round(зажать(88 - 45 * плотность, 42, 84));
  // Худшие обои под полупрозрачным чатом — белые у тёмной темы, чёрные у
  // светлой: карточка плотнее, пока текст читается и на них.
  {
    const низ = собрать(светлая ? ЧЁРНЫЙ : БЕЛЫЙ, слои);
    const худший = () => Math.min(...[фон, фонКонец].map(ф => контраст(текст, наложить({ ...ф, a: альфаКарточки / 100 }, низ))));
    while (альфаКарточки < 96 && худший() < 4.5) альфаКарточки += 2;
  }
  // Рамка цвета самого фона не видна — тогда чуть темнее или светлее него.
  const рамкаНаФоне = рамка && наложить(рамка, фон);
  const кромка = hex(рамкаНаФоне && контраст(рамкаНаФоне, фон) >= 1.15 ? рамкаНаФоне : смешать(фон, текст, 0.15));

  // Исходящие в телефоне: текст там белый, на светлых темах — чернила
  // (light.css). Пузырь темнеет или светлеет, пока текст на нём читается.
  // CSS темы бывает красит и его — тогда там цвет её текста: годимся под оба.
  const чернила = светлая ? [текст] : [БЕЛЫЙ, текст, исходный];
  const подТекст = (c) => { for (let i = 0; i < 40 && Math.min(...чернила.map(ч => контраст(ч, c))) < 4.7; i++) c = смешать(c, светлая ? БЕЛЫЙ : ЧЁРНЫЙ, 0.08); return c; };
  const пузырь = подТекст(акцент), пузырьКонец = подТекст(смешать(акцент, светлая ? БЕЛЫЙ : фонКонец, 0.4));

  const a = hex(акцент), bg1 = hex(фон), bg2 = hex(фонКонец), txt = hex(текст);
  const vars = {
    glassType: размытие === 0 ? 'clear' : 'frosted',
    textColor: txt, textMutedColor: hex(приглушённый),
    accentColor: a, glowColor: hex(свечение), glowAlpha: з.noShadows ? 22 : зажать(24 + тени * 4, 24, 48),
    cardBgStart: bg1, cardBgEnd: bg2, cardBgAlpha: альфаКарточки,
    infoBlockBgStart: светлая ? hex(смешать(фон, БЕЛЫЙ, 0.55)) : hex(смешать(фон, текст, 0.06)),
    infoBlockBgEnd: светлая ? hex(смешать(фонКонец, БЕЛЫЙ, 0.35)) : hex(смешать(фонКонец, текст, 0.04)),
    infoBlockBgAlpha: светлая ? 62 : 28,
    memoryBgStart: bg1, memoryBgEnd: bg2, memoryBgAlpha: светлая ? 92 : Math.max(34, альфаКарточки - 8),
    memoryAccent: hex(свечение), memoryGlowAlpha: 24, memoryBlur: зажать(размытие, 0, 20),
    topBarBg: светлая ? hex(смешать(фон, текст, 0.05)) : hex(смешать(фон, ЧЁРНЫЙ, 0.2)), topBarAlpha: светлая ? 68 : 50,
    tabsBg: светлая ? hex(смешать(фон, БЕЛЫЙ, 0.4)) : hex(смешать(фонКонец, ЧЁРНЫЙ, 0.3)), tabsAlpha: светлая ? 55 : 38,
    phoneBgStart: bg1, phoneBgEnd: bg2, phoneBgAlpha: 94,
    phoneAccent: a, phoneFrameColor: hex(смешать(фонКонец, акцент, 0.3)), phoneScreenGlow: 24,
    msgInBg: светлая ? '#ffffff' : txt, msgInAlpha: светлая ? 72 : 12,
    msgOutStart: hex(пузырь), msgOutEnd: hex(пузырьКонец), msgOutAlpha: светлая ? 100 : 84,
    weatherBgColor: bg2, weatherBgAlpha: светлая ? 42 : 52, weatherBlur: зажать(Math.round(размытие * 0.6), 0, 20),
    sceneOverlayColor: hex(свечение), sceneOverlayAlpha: 10,
    badgeColor: a, interceptColor: a, interceptBgAlpha: 14,
    clockColor: txt, backdropBlur: размытие,
    // Шрифт — тот же, что у сообщений: «inherit» и есть шрифт Таверны,
    // со всеми правками её CSS, и меняется вместе с ней без пересчёта.
    fontMain: 'inherit', fontHeaders: 'inherit',
    fontSizeMain: зажать(Math.round(14 * шрифт / 15), 10, 22), fontSizeHeaders: зажать(Math.round(13 * шрифт / 15), 10, 22),
    cardBorderColor: кромка, cardRadius: скругление, phoneBubbleRadius: зажать(скругление + 3, 2, 24),
  };
  return { vars, светлая };
}

// --- Чтение темы в браузере -------------------------------------------------
const ПЕРЕМЕННЫЕ = {
  body: '--SmartThemeBodyColor', em: '--SmartThemeEmColor', underline: '--SmartThemeUnderlineColor',
  quote: '--SmartThemeQuoteColor', blurTint: '--SmartThemeBlurTintColor', chatTint: '--SmartThemeChatTintColor',
  userMes: '--SmartThemeUserMesBlurTintColor', botMes: '--SmartThemeBotMesBlurTintColor',
  shadow: '--SmartThemeShadowColor', border: '--SmartThemeBorderColor',
};
let холст = null;
// Любая запись цвета (имя, hsl, oklch, color-mix) — к rgba: рисуем точку и
// читаем её. Вычисленный стиль не годится: oklch он отдаёт как oklch.
function вRgb(v) {
  v = String(v || '').trim();
  if (!v || v === 'transparent') return v ? 'rgba(0, 0, 0, 0)' : '';
  if (разобратьЦвет(v)) return v;
  try {
    холст ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
    // Непонятную запись холст не принимает и оставляет прежний цвет.
    холст.fillStyle = '#010203'; холст.fillStyle = v;
    if (холст.fillStyle === '#010203') return '';
    холст.clearRect(0, 0, 1, 1); холст.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = холст.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
  } catch (_) { return ''; }
}
// Последнее сообщение персонажа — у него фон и цвет, какие тема даёт сообщениям.
function сообщениеЧата() {
  const все = [...document.querySelectorAll('#chat .mes:not([is_user="true"]):not([is_system="true"])')];
  // Под мышью и выделенное к удалению сообщение темы красят иначе.
  return все.filter(м => !м.matches(':hover, .selected')).pop() || все.pop() || null;
}
const пиксели = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

/** Замер активной темы Таверны: переменные и настоящие элементы. */
export function замеритьТаверну() {
  if (typeof document === 'undefined' || !document.documentElement || typeof getComputedStyle !== 'function') return null;
  try { return замер(); } catch (_) { return null; }
}
function замер() {
  const корень = getComputedStyle(document.documentElement);
  const з = {};
  for (const [к, имя] of Object.entries(ПЕРЕМЕННЫЕ)) з[к] = вRgb(корень.getPropertyValue(имя));
  з.переменные = Object.keys(ПЕРЕМЕННЫЕ).map(к => з[к]).join('|');
  з.blur = Number(корень.getPropertyValue('--blurStrength')) || 0;
  з.shadowWidth = Number(корень.getPropertyValue('--shadowWidth')) || 0;
  з.noBlur = !!(document.body && document.body.classList.contains('no-blur'));
  з.noShadows = !!(document.body && document.body.classList.contains('noShadows'));
  const тело = document.body ? getComputedStyle(document.body) : null;
  з.fontPx = тело ? пиксели(тело.fontSize) : null;
  const mes = сообщениеЧата();
  з.естьСообщение = !!mes;
  if (mes) {
    // Одни темы красят .mes, другие — .mes_block внутри: берём всю цепочку
    // настоящих фонов, от чата вверх до текста сообщения.
    const блок = mes.querySelector('.mes_block'), текст = mes.querySelector('.mes_text');
    const стили = [document.getElementById('sheld'), document.getElementById('chat'), mes, блок, текст].filter(Boolean).map(у => getComputedStyle(у));
    з.слои = стили.map(с => вRgb(с.backgroundColor));
    // Углы и рамка — у того, кто их рисует: блок внутри главнее.
    for (const у of [mes, блок].filter(Boolean).map(у => getComputedStyle(у))) {
      const видно = (цвет(вRgb(у.backgroundColor))?.a ?? 0) > 0.02 || пиксели(у.borderTopWidth) > 0;
      if (!видно) continue;
      const r = пиксели(у.borderTopLeftRadius);
      if (r != null) з.radius = r;
      if (пиксели(у.borderTopWidth) > 0) з.mesBorder = вRgb(у.borderTopColor);
    }
    // Цитаты и курсив — как они видны в тексте: CSS темы часто красит их сам, а
    // переменная остаётся серой. Карточка HUD лежит не в абзаце — её не заденем.
    for (const [к, что] of [['quote', 'q'], ['em', 'em']]) {
      const у = document.querySelector(`#chat .mes_text > p ${что}, #chat .mes_text > ${что}`);
      const c = у && вRgb(getComputedStyle(у).color);
      if (c && (цвет(c)?.a ?? 0) > 0.25) з[к] = c;
    }
    if (текст) { const st = getComputedStyle(текст); з.mesText = вRgb(st.color); з.fontPx = пиксели(st.fontSize) || з.fontPx; }
  }
  if (з.radius == null) {
    const форма = document.getElementById('send_form');
    if (форма) з.radius = пиксели(getComputedStyle(форма).borderTopLeftRadius);
  }
  return з;
}

// Подпись замера: по ней видно, поменялась ли тема (HUD пишет в style у
// <html> сам, и наблюдатель срабатывает и на свои правки).
export const подписьЗамера = (з) => (з ? JSON.stringify(з) : '');

let кэш = { подпись: null, тема: null };
/** Тема для реестра (themes.js): id, подпись, значения. Без DOM — null. */
export function темаТаверны(замер = замеритьТаверну()) {
  if (!замер) return null;
  const подпись = подписьЗамера(замер);
  if (кэш.подпись !== подпись) {
    const { vars, светлая } = темаИзЗамера(замер);
    кэш = {
      подпись,
      тема: {
        id: ID_ТАВЕРНЫ, label: 'Как в Таверне', icon: '◐', category: 'tavern', tavern: true, светлая,
        hint: 'Цвета, шрифт, размытие и скругления из темы SillyTavern. Сменили тему в Таверне — HUD перекрашивается следом.',
        vars,
      },
    };
  }
  return кэш.тема;
}

/** Последняя снятая тема — без нового замера (или null). */
export const последняяТемаТаверны = () => кэш.тема;

// --- Слежка за Таверной -----------------------------------------------------
// Таверна меняет тему, переписывая переменные в style у <html>, класс у
// <body> и текст <style id="custom-style">. Пачку правок ждём 300 мс.
let наблюдатель = null, таймер = 0, поздний = 0, последняя = '', прошлаяБаза = '', ждём = '', попыток = 0;
// Замер без чата: только переменные. Чата нет — нечего и красить заново.
const база = (з) => JSON.stringify([з.переменные, з.blur, з.noBlur]);
/**
 * применить(тема) зовётся, когда тема «Как в Таверне» выбрана и замер
 * поменялся. Возвращает функцию «проверить сейчас» — для старта и смены чата.
 */
export function следитьЗаТаверной(применить, выбрана) {
  const проверить = () => {
    таймер = 0;
    if (!выбрана()) { последняя = ждём = ''; return; }
    const замер = замеритьТаверну();
    const подпись = подписьЗамера(замер);
    if (!замер || подпись === последняя) { ждём = ''; попыток = 0; return; }
    const б = база(замер), базаТаЖе = !прошлаяБаза || прошлаяБаза === б;
    if (!замер.естьСообщение && базаТаЖе) { прошлаяБаза = б; return; }
    // Тема перекрашивает сообщения плавно (transition): берём цвета, только
    // когда два замера подряд сошлись, — иначе HUD запомнил бы полутон.
    if (подпись !== ждём && попыток < 12) { ждём = подпись; попыток++; clearTimeout(таймер); таймер = setTimeout(проверить, 250); return; }
    последняя = подпись; прошлаяБаза = б; ждём = ''; попыток = 0;
    try { применить(темаТаверны(замер)); } catch (e) { console.warn('[TavernOS HUD] тема Таверны', e); }
    // Файлы, которые CSS темы подключает сам (@import), доезжают позже.
    clearTimeout(поздний); поздний = setTimeout(проверить, 3000);
  };
  const позже = () => { if (выбрана()) { clearTimeout(таймер); таймер = setTimeout(проверить, 300); } };
  if (!наблюдатель && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    наблюдатель = new MutationObserver(позже);
    наблюдатель.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    if (document.body) наблюдатель.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    if (document.head) наблюдатель.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
  return () => { clearTimeout(таймер); проверить(); };
}
/** Забыть прошлый замер: следующая проверка применит тему, даже если Таверна та же. */
export function сброситьСлежку() { последняя = ''; }

/**
 * Перенос новых значений Таверны в настройки. Поле, которое человек поправил
 * руками после прошлого замера (значение ≠ прошлому замеру), остаётся его.
 * Возвращает список поменявшихся ключей.
 */
export function перенестиЗамер(настройки, новые, прошлые) {
  const было = прошлые && typeof прошлые === 'object' ? прошлые : null;
  const поменялись = [];
  for (const [к, v] of Object.entries(новые)) {
    const руками = было && к in было && String(настройки[к]) !== String(было[к]);
    if (руками || String(настройки[к]) === String(v)) continue;
    настройки[к] = v;
    поменялись.push(к);
  }
  return поменялись;
}

/** Кнопка под рядом тем: образцы цветов Таверны сейчас. */
export function кнопкаТаверныHTML(активная, тема = темаТаверны()) {
  const v = (тема && тема.vars) || {};
  const образцы = [v.accentColor, v.glowColor, v.cardBgStart, v.textColor].filter(Boolean)
    .map(c => `<i style="background:${String(c).replace(/[^#0-9a-f]/gi, '')}"></i>`).join('');
  return `<button type="button" class="hud-theme-preset hud-theme-tavern${активная ? ' active' : ''}" data-theme-preset="${ID_ТАВЕРНЫ}"`
    + ` title="Цвета, шрифт, размытие и скругления из темы SillyTavern. Сменили тему в Таверне — HUD перекрашивается следом. «↶ Шаг назад» вернёт прошлый вид.">`
    + `<span class="hud-palette-sw" aria-hidden="true">${образцы}</span><small>Как в Таверне</small><span class="hud-theme-tavern-note">следит за темой SillyTavern</span></button>`;
}
