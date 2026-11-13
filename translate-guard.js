// hud-manager/translate-guard.js
//
// Перевод чата Таверны (расширение Chat Translation: Google, Yandex, Bing,
// DeepL…) показывает ответ на выбранном языке, а в сообщении и в промпте
// остаётся оригинал. Раньше он переводил ответ целиком, вместе с блоком HUD:
// «[HUD]» становилось «[ХУД]», ключи и коды переводились, кавычки менялись на
// ёлочки, и над карточкой висела переведённая каша. А блок — большая часть
// ответа: перевод шёл в разы дольше.
//
// Здесь три вещи (настройка «Защита HUD при переводе чата», settings.chatTranslation):
// 1. Защита: запросы к /api/translate/* идут через нас. Кусок текста, который
//    лежит внутри блока HUD сообщения, не переводится, остальное — как было.
// 2. Починка: если перевод уже испорчен (старые сообщения, сбой защиты), блок
//    в переведённом тексте заменяется оригиналом.
// 3. Карточка на языке перевода: видимые строки карточки переводятся тем же
//    сервисом на тот же язык, только для показа. Логика HUD читает
//    оригинал, как и модель.

import { hudБлоки } from './hud-block.js?v=23.89.21';

const ПУТЬ = /\/api\/translate\/(google|bing|lingva|deeplx|libre|deepl|onering|yandex)(?:[/?#]|$)/;
let сырой = null;
let включено = () => true;
/** fetch без защиты: свои запросы перевода карточки не должны в неё попадать. */
const сыройFetch = (...a) => (сырой || window.fetch)(...a);

/**
 * Кусок текста, отправленный на перевод, по частям: что внутри блока HUD
 * (hud: true), что снаружи. Таверна режет длинный текст на куски — каждый
 * кусок есть дословно в тексте сообщения (после подстановки макросов), и
 * идут они по порядку. тексты — [{ текст, блоки: [[начало, конец]] }],
 * первым — сообщение, которое сейчас переводится, если оно известно.
 * с — откуда искать в первом тексте (конец прошлого куска того же сообщения).
 * { части: [{ текст, hud }] | null, где, конец, владелец } или null, если
 * кусок не нашёлся ни в одном сообщении с HUD.
 */
export function найтиКусок(кусок, тексты, с = 0) {
  if (typeof кусок !== 'string' || !кусок.trim() || !Array.isArray(тексты)) return null;
  for (let k = 0; k < тексты.length; k++) {
    const { текст, блоки } = тексты[k] || {};
    if (typeof текст !== 'string' || !блоки || !блоки.length) continue;
    // Первое сообщение — от конца прошлого куска: кусок прозы «Yes.» может
    // встретиться и внутри блока раньше по тексту.
    let где = k === 0 && с > 0 ? текст.indexOf(кусок, с) : -1;
    if (где < 0) где = текст.indexOf(кусок);
    if (где < 0) continue;
    const конец = где + кусок.length;
    const задеты = блоки.filter(([a, b]) => a < конец && b > где);
    if (!задеты.length) return { части: null, где, конец, владелец: тексты[k] };
    const части = [];
    let i = где;
    for (const [a, b] of задеты) {
      const от = Math.max(a, где), до = Math.min(b, конец);
      if (от > i) части.push({ текст: текст.slice(i, от), hud: false });
      части.push({ текст: текст.slice(от, до), hud: true });
      i = до;
    }
    if (i < конец) части.push({ текст: текст.slice(i, конец), hud: false });
    return { части, где, конец, владелец: тексты[k] };
  }
  return null;
}
/** Только части куска (для проверок): null — блока HUD в куске нет. */
export function сегментыПеревода(кусок, тексты) {
  const н = найтиКусок(кусок, тексты);
  return н ? н.части : null;
}

/** Где в переведённом тексте начинается переведённый блок HUD: метка вида
    «[ХУД]» над ограждением кода или ограждение, за которым идёт JSON
    («"ключ": …» хотя бы в двух строках). -1 — не нашли. */
export function началоПереведённогоБлока(текст) {
  const s = String(текст ?? '');
  // Метка бывает и в конце строки прозы: Google склеивает «…ни слова.[ХУД]».
  const метка = /\[[^\]\n]{1,24}\][ \t]*\r?\n(?:[ \t]*\r?\n)?[ \t]*`{2,}/.exec(s);
  if (метка) return метка.index;
  const ограда = /^[ \t]*`{2,}[^\n]*\r?\n[ \t]*[{[][^\n]*\r?\n(?:[^\n]*\r?\n){0,3}?[ \t]*["«“]?[^"\n«»“”:]{1,12}["»”]?\s*:[^\n]*\r?\n[ \t]*["«“]?[^"\n«»“”:]{1,12}["»”]?\s*:/m.exec(s);
  return ограда ? ограда.index : -1;
}

/** Убрать метку в скобках сразу перед блоком, если в оригинале её нет:
    это переведённое «[HUD]», оставшееся после починки. */
export function безПереведённыхМеток(показ, блоки, исходный) {
  let s = показ;
  for (const б of блоки) {
    const i = s.indexOf(б.full);
    if (i <= 0) continue;
    const до = s.slice(0, i);
    const м = /\[[^\]\n]{1,24}\]\s*$/.exec(до);
    // В оригинале перед блоком тоже скобки («[смеётся]») — это их перевод, не трогаем.
    if (!м || /\[[^\]\n]{1,24}\]\s*$/.test(String(исходный).slice(0, б.index))) continue;
    const проза = до.slice(0, м.index).replace(/\s+$/, '');
    s = (проза ? проза + '\n\n' : '') + s.slice(i);
  }
  return s;
}

/**
 * Переведённый текст, в котором блоки HUD — дословно оригинал.
 * исходные — тексты сообщения (после подстановки макросов, как его переводит
 * Таверна, и как есть). null — чинить нечего или не получилось.
 */
export function починитьПереведённое(показ, исходные) {
  if (typeof показ !== 'string' || !показ || !Array.isArray(исходные)) return null;
  const сБлоками = исходные.filter(t => typeof t === 'string').map(t => ({ t, блоки: hudБлоки(t) })).filter(x => x.блоки.length);
  if (!сБлоками.length) return null;
  const целый = сБлоками.find(({ блоки }) => блоки.every(б => показ.includes(б.full)));
  if (целый) {
    // Блок уже оригинал, но над ним могла остаться переведённая метка
    // («[平视显示器]»): так чинила 23.89.8, когда метка прилипла к прозе.
    const чище = безПереведённыхМеток(показ, целый.блоки, целый.t);
    return чище === показ ? null : чище;
  }
  const { t: исходный, блоки } = сБлоками[0];
  // Блок дошёл почти целым (куски перевода склеились без переводов строк,
  // переводчик тронул середину): от первой строки блока до последней — оригинал.
  let новый = показ, всеНашлись = true;
  for (const б of блоки) {
    if (новый.includes(б.full)) continue;
    // Первая и последняя строки блока — «[HUD]» и «[/HUD]» или ограждение: их
    // переводчик обычно не трогает, даже если середину перевёл.
    const строки = б.full.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const голова = строки[0] || '', хвост = строки[строки.length - 1] || '';
    const от = голова.length >= 3 ? новый.indexOf(голова) : -1, до = от >= 0 && хвост ? новый.lastIndexOf(хвост) : -1;
    if (от >= 0 && до >= от) новый = новый.slice(0, от) + б.full + новый.slice(до + хвост.length);
    else { всеНашлись = false; break; }
  }
  if (всеНашлись) return новый === показ ? null : новый;
  // Блок переведён: от его начала — оригинал с первого блока до конца.
  const от = началоПереведённогоБлока(показ);
  if (от < 0) return null;
  return показ.slice(0, от).replace(/\s+$/, '') + '\n\n' + исходный.slice(блоки[0].index);
}

// --- 1. Защита -------------------------------------------------------------

const разобранные = new WeakMap();
let подсказка = null;          // номер сообщения, которое Таверна сейчас переводит
let прошлый = { m: null, конец: 0 };   // где кончился прошлый кусок этого сообщения
/** Таверна начала переводить это сообщение (её события до перевода). */
export function подсказатьСообщение(id) { подсказка = Number.isInteger(Number(id)) ? Number(id) : null; прошлый = { m: null, конец: 0 }; }

function подставить(ctx, m) {
  try { if (typeof ctx.substituteParams === 'function') return ctx.substituteParams(m.mes, { name2Override: m.name }); } catch (_) { /* как есть */ }
  return m.mes;
}
function разобрать(ctx, m) {
  if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('[')) return null;
  let р = разобранные.get(m);
  if (!р || р.mes !== m.mes || р.name !== m.name) {
    const текст = подставить(ctx, m);
    р = { m, mes: m.mes, name: m.name, текст, блоки: hudБлоки(текст).map(б => [б.index, б.index + б.length]) };
    разобранные.set(m, р);
  }
  return р.блоки.length ? р : null;
}
function текстыЧата(ctx) {
  const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const out = [];
  // Первым — то, что переводится сейчас, или то, чей кусок был последним.
  const первые = [Number.isInteger(подсказка) ? чат[подсказка] : null, прошлый.m].filter(Boolean);
  for (const m of первые) { const р = разобрать(ctx, m); if (р && !out.includes(р)) out.push(р); }
  for (let i = чат.length - 1; i >= 0; i--) { const р = разобрать(ctx, чат[i]); if (р && !out.includes(р)) out.push(р); }
  return out;
}

async function защитить(адрес, опции, дайКонтекст) {
  let тело;
  try { тело = JSON.parse(опции.body); } catch (_) { return null; }
  const пачкой = Array.isArray(тело && тело.chunks);
  const куски = пачкой ? тело.chunks : (тело && typeof тело.text === 'string' ? [тело.text] : null);
  if (!куски || !куски.length) return null;
  const тексты = текстыЧата(дайКонтекст());
  if (!тексты.length) return null;
  const язык = тело.lang || тело.to_lang || '';
  const разборы = куски.map(к => {
    const с = тексты[0].m === прошлый.m ? прошлый.конец : 0;
    const н = найтиКусок(к, тексты, с);
    if (н) {
      прошлый = { m: н.владелец.m, конец: н.конец };
      // Сообщение переведено: карточку тоже показываем на этом языке.
      if (язык && н.владелец.m) { if (typeof н.владелец.m.extra !== 'object' || !н.владелец.m.extra) н.владелец.m.extra = {}; н.владелец.m.extra.hud_tr = язык; }
    }
    return н;
  });
  if (!разборы.some(Boolean)) return null;
  const перевести = async (s) => {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m[2]) return s;
    const новое = пачкой ? { ...тело, chunks: [m[2]] } : { ...тело, text: m[2] };
    const r = await сырой(адрес, { ...опции, body: JSON.stringify(новое) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return m[1] + await r.text() + m[3];
  };
  const итог = [];
  for (let i = 0; i < куски.length; i++) {
    const н = разборы[i];
    if (!н) { итог.push(await перевести(куски[i])); continue; }
    let s = '';
    for (const ч of н.части || [{ текст: куски[i], hud: false }]) s += ч.hud ? ч.текст : await перевести(ч.текст);
    // Таверна режет текст по пустым строкам и склеивает куски без них: проза
    // прилипала к блоку («ветер.[HUD]»). Возвращаем пробелы после куска, если
    // текст дальше продолжается.
    const дальше = н.владелец.текст.slice(н.конец);
    const пробел = /^\s{1,6}/.exec(дальше);
    if (пробел && дальше.trim()) s += пробел[0];
    итог.push(s);
  }
  return new Response(итог.join(''), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** Включить защиту: блок HUD не уходит на перевод. вкл() — настройка. */
export function включитьЗащитуПеревода(дайКонтекст, вкл) {
  if (typeof вкл === 'function') включено = вкл;
  if (сырой || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  сырой = window.fetch.bind(window);
  window.fetch = async function (вход, опции) {
    try {
      const адрес = typeof вход === 'string' ? вход : (вход && вход.url) || '';
      if (ПУТЬ.test(адрес) && опции && typeof опции.body === 'string' && включено()) {
        const ответ = await защитить(адрес, опции, дайКонтекст);
        if (ответ) return ответ;
      }
    } catch (e) { console.warn('[TavernOS HUD] перевод без блока HUD не вышел, переводим как есть', e); }
    return сырой(вход, опции);
  };
}

// --- 3. Карточка на языке перевода ------------------------------------------

const ЛИМИТ = { bing: 900, deeplx: 1400 };
// Название HUD в шапке — не перевод («ТавернОС»). Поля ввода и то, что
// просили не трогать, — тоже.
const НЕ_ТРОГАТЬ = 'script, style, textarea, input, select, option, [contenteditable="true"], [data-i18n-skip], .hud-tr-skip, .hud-os-logo';
const КЭШ_КЛЮЧ = 'hud_view_translations';
const КЭШ_МАКС = 6000;
const ПАУЗА_ПОСЛЕ_СБОЯ = 60000;
let кэш = null;
let сбойДо = 0;
const исходники = new WeakMap();   // узел → [исходный текст, перевод]
const переведённые = new Set();    // узлы с нашим переводом (чтобы вернуть)
function прочитатьКэш() {
  if (кэш) return кэш;
  кэш = new Map();
  try { for (const [к, v] of Object.entries(JSON.parse(localStorage.getItem(КЭШ_КЛЮЧ) || '{}'))) кэш.set(к, v); } catch (_) { /* пусто */ }
  return кэш;
}
let таймерКэша = 0;
function сохранитьКэш() {
  clearTimeout(таймерКэша);
  таймерКэша = setTimeout(() => {
    try {
      const все = [...прочитатьКэш()];
      localStorage.setItem(КЭШ_КЛЮЧ, JSON.stringify(Object.fromEntries(все.slice(-КЭШ_МАКС))));
    } catch (_) { /* место кончилось — живём памятью */ }
  }, 800);
}

// Языки на кириллице: на них не переводим то, что уже кириллицей.
const КИРИЛЛИЦА_ЯЗЫКИ = /^(ru|uk|be|bg|sr|mk|kk|ky|tg|mn|ba|tt|cv|ce|os|sah)\b/i;
/**
 * Строку стоит переводить на язык lang? В ней есть буквы, и не все — того
 * же письма, что язык перевода: на русский не переводим кириллицу, на
 * английский — латиницу. Число, время, одна буква — не переводим.
 */
export function нужноПеревести(s, lang = 'ru') {
  if (typeof s !== 'string' || s.length > 1500) return false;
  const буквы = s.match(/\p{L}/gu);
  if (!буквы || буквы.length < 2) return false;
  if (/^\s*[\w.-]+@[\w.-]+\s*$/.test(s)) return false;
  const латиница = /[A-Za-z]{2}/.test(s), кириллица = /[А-Яа-яЁёІіЇїЄєЎў]{2}/.test(s);
  if (КИРИЛЛИЦА_ЯЗЫКИ.test(lang)) return латиница;
  if (/^en\b/i.test(lang)) return /[^\p{Script=Latin}\P{L}]/u.test(s);
  return латиница || кириллица || /[^\p{Script=Latin}\P{L}]/u.test(s);
}

function тело(провайдер, текст, ts) {
  const язык = ts.target_language;
  if (провайдер === 'yandex') return { chunks: [текст], lang: язык };
  if (провайдер === 'onering') return { text: текст, from_lang: ts.internal_language || 'en', to_lang: язык };
  if (провайдер === 'deepl') return { text: текст, lang: язык, endpoint: ts.deepl_endpoint || 'free' };
  return { text: текст, lang: язык };
}
async function запрос(ctx, ts, текст) {
  const r = await сыройFetch('/api/translate/' + ts.provider, {
    method: 'POST',
    headers: typeof ctx.getRequestHeaders === 'function' ? ctx.getRequestHeaders() : { 'Content-Type': 'application/json' },
    body: JSON.stringify(тело(ts.provider, текст, ts)),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
/**
 * Строки пачками построчно. Если строк в ответе столько же — перевод по
 * строкам; разошлось (переводчик склеил две строки) — пачка делится пополам,
 * а не дробится на сотню отдельных запросов.
 */
export async function перевестиСтроки(перевестиТекст, строки, лимит = 4000) {
  const итог = new Map();
  const пачки = [[]];
  let длина = 0;
  for (const s of строки) {
    if (длина + s.length + 1 > лимит && пачки[пачки.length - 1].length) { пачки.push([]); длина = 0; }
    пачки[пачки.length - 1].push(s); длина += s.length + 1;
  }
  const одна = async (пачка) => {
    const ответ = (await перевестиТекст(пачка.join('\n'))).replace(/\r/g, '').replace(/\n+$/, '').split('\n');
    if (ответ.length === пачка.length) { пачка.forEach((s, i) => { const p = ответ[i].trim(); if (p) итог.set(s, p); }); return; }
    if (пачка.length === 1) { const p = ответ.join(' ').trim(); if (p) итог.set(пачка[0], p); return; }
    const половина = Math.ceil(пачка.length / 2);
    await одна(пачка.slice(0, половина));
    await одна(пачка.slice(половина));
  };
  for (const пачка of пачки) await одна(пачка);
  return итог;
}

function видимый(эл) {
  return !!эл && (эл.offsetWidth > 0 || эл.offsetHeight > 0 || (эл.getClientRects && эл.getClientRects().length > 0));
}
function поставить(узел, исходный, перевод) {
  const m = /^(\s*)[\s\S]*?(\s*)$/.exec(исходный);
  const новый = m[1] + перевод + m[2];
  исходники.set(узел, [исходный, новый]);
  переведённые.add(узел);
  if (узел.nodeValue !== новый) узел.nodeValue = новый;
}
/** Вернуть карточкам оригинал (настройку выключили). */
export function вернутьОригиналКарточек() {
  for (const n of переведённые) { const было = исходники.get(n); if (было && n.isConnected && n.nodeValue === было[1]) n.nodeValue = было[0]; исходники.delete(n); }
  переведённые.clear();
}
// Сообщение показано переводом Таверны: этот ответ переведён на язык ts.
function переведено(m, ts) {
  if (!m || m.is_user || !m.extra || typeof m.extra.display_text !== 'string' || !m.extra.display_text) return false;
  return m.extra.hud_tr === ts.target_language || ts.auto_mode === 'responses' || ts.auto_mode === 'both';
}

let идёт = false, ещё = false;
async function пройти(дайКонтекст) {
  if (идёт) { ещё = true; return; }
  идёт = true;
  try {
    if (!включено()) { if (переведённые.size) вернутьОригиналКарточек(); return; }
    const ctx = дайКонтекст();
    const ts = ctx && ctx.extensionSettings && ctx.extensionSettings.translate;
    if (!ts || !ts.provider || !ts.target_language || !Array.isArray(ctx.chat)) return;
    const ключЯзыка = ts.provider + '|' + ts.target_language + '|';
    const к = прочитатьКэш();
    const ждут = new Map();   // строка → [[узел, исходный]]
    for (const карточка of document.querySelectorAll('#chat .mes .hud-os-card')) {
      const mes = карточка.closest('.mes');
      const m = ctx.chat[Number(mes && mes.getAttribute('mesid'))];
      if (!переведено(m, ts)) continue;
      const обход = document.createTreeWalker(карточка, NodeFilter.SHOW_TEXT);
      for (let n = обход.nextNode(); n; n = обход.nextNode()) {
        const род = n.parentElement;
        if (!род || род.closest(НЕ_ТРОГАТЬ) || !видимый(род)) continue;
        const было = исходники.get(n);
        if (было && было[1] === n.nodeValue) continue;   // уже наш перевод
        const исходный = n.nodeValue;
        const s = исходный.trim().replace(/\s+/g, ' ');
        if (!нужноПеревести(s, ts.target_language)) continue;
        const готово = к.get(ключЯзыка + s);
        if (готово !== undefined) { поставить(n, исходный, готово); continue; }
        if (!ждут.has(s)) ждут.set(s, []);
        ждут.get(s).push([n, исходный]);
      }
    }
    if (!ждут.size || Date.now() < сбойДо) return;
    let переводы;
    try {
      переводы = await перевестиСтроки((t) => запрос(ctx, ts, t), [...ждут.keys()], ЛИМИТ[ts.provider] || 4000);
    } catch (e) {
      // Сервис упёрся в лимит или недоступен: минуту не дёргаем, карточка пока в оригинале.
      сбойДо = Date.now() + ПАУЗА_ПОСЛЕ_СБОЯ;
      console.warn('[TavernOS HUD] перевод карточки: сервис не ответил, повтор через минуту', e);
      return;
    }
    for (const [s, p] of переводы) {
      к.set(ключЯзыка + s, p);
      for (const [n, исходный] of ждут.get(s) || []) if (n.isConnected && n.nodeValue === исходный) поставить(n, исходный, p);
    }
    if (переводы.size) сохранитьКэш();
  } catch (e) {
    console.warn('[TavernOS HUD] перевод карточки', e);
  } finally {
    идёт = false;
    if (ещё) { ещё = false; запланировать(дайКонтекст); }
  }
}
let таймер = 0, наблюдатель = null, дайКонтекстКарточек = null;
function запланировать(дайКонтекст, мс = 350) { clearTimeout(таймер); таймер = setTimeout(() => пройти(дайКонтекст), мс); }
/** Настройку переключили: пройти карточки заново (перевести или вернуть). */
export function обновитьПереводКарточек() { if (дайКонтекстКарточек) запланировать(дайКонтекстКарточек, 50); }

/** Карточки переведённых ответов показываются на языке перевода. */
export function включитьПереводКарточек(дайКонтекст, вкл) {
  if (typeof вкл === 'function') включено = вкл;
  дайКонтекстКарточек = дайКонтекст;
  if (наблюдатель || typeof MutationObserver !== 'function' || typeof document === 'undefined') return;
  const чат = document.getElementById('chat');
  if (!чат) return;
  наблюдатель = new MutationObserver(() => запланировать(дайКонтекст));
  наблюдатель.observe(чат, { childList: true, subtree: true });
  // Вкладки и раскрытие карточки меняют видимость, а не разметку.
  чат.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('.hud-os-card')) запланировать(дайКонтекст, 200); }, true);
  запланировать(дайКонтекст, 1000);
}

// --- 4. ExtBlocks -----------------------------------------------------------
// Расширение ExtBlocks держит свои блоки в том же extra.display_text, что и
// перевод, и при каждом обновлении (правка сообщения, новый ответ, открытие
// чата) пишет туда «оригинал + свои блоки» или удаляет поле — перевод
// пропадал. Мы оборачиваем именно эти его функции: после них возвращаем
// перевод, а его блоки приклеиваем к переводу. Его код не меняем.

/**
 * Перевод, который ExtBlocks выкинул из display_text.
 * сохранённый — display_text до него; mes — оригинал сообщения; после — что
 * он туда положил (undefined — удалил); хвост — его блоки, которые мы прошлый
 * раз приклеили к переводу (они в сохранённом, их не дублируем).
 * { текст, хвост } или null — возвращать нечего.
 */
export function вернутьПеревод(сохранённый, mes, после, хвост = '') {
  if (typeof сохранённый !== 'string' || !сохранённый || typeof mes !== 'string') return null;
  // Его собственный текст всегда начинается с оригинала — это не перевод.
  if (сохранённый.startsWith(mes)) return null;
  const перевод = хвост && сохранённый.endsWith(хвост) ? сохранённый.slice(0, -хвост.length) : сохранённый;
  if (после === undefined || после === null || после === '') return { текст: перевод, хвост: '' };
  if (typeof после !== 'string' || !после.startsWith(mes)) return null;
  const новыйХвост = после.slice(mes.length);
  return { текст: перевод + новыйХвост, хвост: новыйХвост };
}

function вернутьПослеExtBlocks(ctx, id, m, было) {
  if (!m || !m.extra || было === null || m.extra.display_text === было) return false;
  const в = вернутьПеревод(было, String(m.mes ?? ''), m.extra.display_text, m.extra.hud_eb_tail || '');
  if (!в) return false;
  m.extra.display_text = в.текст;
  if (в.хвост) m.extra.hud_eb_tail = в.хвост; else delete m.extra.hud_eb_tail;
  if (typeof ctx.updateMessageBlock === 'function') try { ctx.updateMessageBlock(Number(id), m); } catch (_) { /* перерисуется позже */ }
  return true;
}
const показСообщения = (m) => (m && m.extra && typeof m.extra.display_text === 'string' ? m.extra.display_text : null);

let связьEB = null;
/** Найти ExtBlocks и обернуть его запись display_text. true — обёрнуто. */
export function подружитьСExtBlocks(дайКонтекст) {
  if (связьEB) return связьEB;
  if (typeof document === 'undefined') return Promise.resolve(false);
  const адреса = [...document.querySelectorAll('script[src*="/third-party/"]')].map(s => s.src)
    .filter(s => /\/third-party\/[^/]*extblocks[^/]*\/index\.js(?:[?#]|$)/i.test(s));
  if (!адреса.length) return Promise.resolve(false);   // ещё не загружен или не стоит
  связьEB = (async () => {
    for (const адрес of адреса) {
      let модуль;
      try { модуль = await import(new URL('src/services/BlockService.js', адрес).href); } catch (_) { continue; }
      const BS = модуль && модуль.BlockService;
      if (!BS || typeof BS.updateBlocksDisplay !== 'function') continue;
      if (BS.__hudTr) return true;
      BS.__hudTr = true;
      const обновить = BS.updateBlocksDisplay;
      BS.updateBlocksDisplay = async function (messageId, ...остальное) {
        const ctx = дайКонтекст();
        const m = ctx && Array.isArray(ctx.chat) ? ctx.chat[messageId] : null;
        const было = показСообщения(m);
        const итог = await обновить.call(this, messageId, ...остальное);
        try { if (включено()) вернутьПослеExtBlocks(ctx, messageId, m, было); } catch (e) { console.warn('[TavernOS HUD] перевод после ExtBlocks', e); }
        return итог;
      };
      if (typeof BS.purgeAllBlocksDisplayText === 'function') {
        const стереть = BS.purgeAllBlocksDisplayText;
        BS.purgeAllBlocksDisplayText = async function (...а) {
          const ctx = дайКонтекст();
          const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
          const было = чат.map(показСообщения);
          const итог = await стереть.apply(this, а);
          try {
            if (включено()) {
              let вернули = 0;
              чат.forEach((m, i) => { if (вернутьПослеExtBlocks(ctx, i, m, было[i])) вернули++; });
              if (вернули && typeof ctx.saveChat === 'function') await ctx.saveChat();
            }
          } catch (e) { console.warn('[TavernOS HUD] перевод после ExtBlocks', e); }
          return итог;
        };
      }
      return true;
    }
    связьEB = null;
    return false;
  })();
  return связьEB;
}
