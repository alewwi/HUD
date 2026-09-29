// emoji-fallback.js — замена эмодзи, которые Windows 10 рисует квадратиком.
//
// Шрифт Segoe UI Emoji в Windows 10 знает эмодзи до версии 12: 🪞, 🫖, 🫦
// и им подобные выходят пустыми квадратами. Меняем их только на ПК с
// Windows и только если квадрат действительно получается (Windows 11 их
// рисует) — на телефонах всё остаётся как написано.

const ЗАМЕНЫ = {
  '🪞': '💄', '🩼': '🩹', '🪜': '📶', '🫖': '🩸', '🫦': '💋', '🪶': '✒️', '🫂': '🤗', '🫁': '💨',
  '🫥': '😶', '🪫': '🔋', '🪢': '⛓️', '🪙': '💰', '🪩': '🎉', '🫧': '💧', '🪟': '🖼️', '❤️‍🩹': '💗', '❤‍🩹': '💗',
};

// Ширина на холсте: пустой квадрат уже настоящего значка, а склейка через
// ZWJ, которую шрифт не знает, распадается на два значка — вдвое шире.
function нерисуемые() {
  try {
    const x = document.createElement('canvas').getContext('2d');
    if (!x) return [];
    x.font = '28px "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
    const w = (s) => x.measureText(s).width;
    const квадрат = w('\u{1FAFF}'), сердце = w('❤️');
    const нет = (e) => [...e].includes('‍') ? w(e) > сердце * 1.5 : w(e) <= квадрат + 2;
    return Object.keys(ЗАМЕНЫ).filter(e => нет(e) && !нет(ЗАМЕНЫ[e]));
  } catch (_) { return []; }
}

const В_HUD = '.hud-os-card, #hud-settings-wrapper, .hud-custom-dialog, .hud-cp, [class*="hud-"]';
let образец = null;
let карта = null;

function заменитьВ(корень) {
  if (!корень) return;
  if (корень.nodeType === 3) {
    if (образец.test(корень.nodeValue)) корень.nodeValue = корень.nodeValue.replace(образец, (м) => карта[м] || м);
    образец.lastIndex = 0;
    return;
  }
  if (корень.nodeType !== 1 && корень.nodeType !== 9) return;
  const текст = корень.textContent || '';
  образец.lastIndex = 0;
  if (!образец.test(текст)) { образец.lastIndex = 0; return; }
  образец.lastIndex = 0;
  const обход = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
  for (let n = обход.nextNode(); n; n = обход.nextNode()) {
    if (образец.test(n.nodeValue)) { образец.lastIndex = 0; n.nodeValue = n.nodeValue.replace(образец, (м) => карта[м] || м); }
    образец.lastIndex = 0;
  }
}

let подключено = false;
export function подключитьЗаменуЭмодзи() {
  if (подключено) return;
  подключено = true;
  if (!/Windows/i.test(navigator.userAgent || '')) return;
  const список = нерисуемые();
  if (!список.length) return;
  карта = Object.fromEntries(список.map(e => [e, ЗАМЕНЫ[e]]));
  // Склейки (ZWJ) — первыми, иначе их части заменились бы по отдельности.
  образец = new RegExp(список.sort((a, b) => b.length - a.length).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
  заменитьВ(document.body);
  new MutationObserver((записи) => {
    for (const з of записи) {
      if (з.type === 'characterData') {
        const р = з.target.parentElement;
        if (р && р.closest(В_HUD)) заменитьВ(з.target);
        continue;
      }
      for (const n of з.addedNodes) {
        const эл = n.nodeType === 1 ? n : n.parentElement;
        if (!эл) continue;
        if (эл.closest(В_HUD) || (n.nodeType === 1 && n.querySelector && n.querySelector('[class*="hud-"]'))) заменитьВ(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
