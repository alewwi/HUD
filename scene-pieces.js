// hud-manager/scene-pieces.js
//
// Картинки темы по одной («Кастомизация» → «Рисунки темы»). Обычно в слое
// рисунка одна картинка, и убирается она классом hud-hide-<место>-<часть>
// (index.js). Но бывает, что в одном слое их несколько: у «Вампира» клыки,
// медальон и канделябр лежат в одном .hud-scene-b::before. Такие убираются по
// одной — правилом поверх стиля темы, где слой этой картинки заменён на none.
// Ключ такой картинки — тема:место:часть:файл (у одиночной — без файла).
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

/** Слои значения через запятую верхнего уровня: запятые внутри скобок не режут. */
export function слои(значение) {
  const s = String(значение ?? '').trim();
  if (!s || s === 'none') return [];
  const out = [];
  let глубина = 0, от = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') глубина++;
    else if (ch === ')') глубина = Math.max(0, глубина - 1);
    else if (ch === ',' && !глубина) { out.push(s.slice(от, i).trim()); от = i + 1; }
  }
  out.push(s.slice(от).trim());
  return out;
}
/** Адрес картинки слоя или ''. */
export const адресСлоя = (слой) => { const м = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(String(слой || '')); return м ? м[1] : ''; };
/** Имя файла без пути и параметров: по нему узнаём картинку в любом адресе. */
export const файлИз = (url) => String(url || '').split(/[?#]/)[0].split('/').pop();

/** Картинка слоя из краткой записи background: «url(…) …» или «…-gradient(…) …» → только картинка. */
export function картинкаСлоя(слой) {
  const s = String(слой || '');
  const у = /url\(\s*["']?[^"')]+["']?\s*\)/.exec(s);
  if (у) return у[0];
  const г = /[a-z-]*gradient\(/i.exec(s);
  if (!г) return 'none';
  let глубина = 0;
  for (let i = г.index + г[0].length - 1; i < s.length; i++) {
    if (s[i] === '(') глубина++;
    else if (s[i] === ')' && !--глубина) return s.slice(г.index, i + 1);
  }
  return 'none';
}
/**
 * Слои значения, где картинки этих файлов заменены на none; null — менять нечего.
 * Адреса — от листа стилей темы (база): правило встаёт в <style> страницы, и
 * «../img/…» оттуда вело бы не туда.
 */
export function безФайлов(значение, файлы, база = '') {
  const список = слои(значение);
  let было = false;
  const новый = список.map(л => {
    const ф = файлИз(адресСлоя(л));
    if (ф && файлы.has(ф)) { было = true; return 'none'; }
    return база ? л.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (_, а) => { try { return `url("${new URL(а, база).href}")`; } catch (_) { return `url("${а}")`; } }) : л;
  });
  return было ? новый.join(', ') : null;
}

function правилаСтраницы() {
  const out = [];
  const обойти = (правила) => {
    for (const r of правила || []) {
      if (r.selectorText && r.style) out.push(r);
      else if (r.cssRules) обойти(r.cssRules);
    }
  };
  for (const лист of document.styleSheets) {
    if (лист.ownerNode && лист.ownerNode.id === 'hud-scene-pieces') continue;
    try { обойти(лист.cssRules); } catch (_) { /* чужой лист */ }
  }
  return out;
}

let стиль = null, прошлое = '';
/**
 * Правило поверх темы для картинок, убранных по одной из общего слоя.
 * скрытые — settings.sceneHidden; темаМеста(место) — id темы в этом месте сейчас.
 */
export function применитьЧастиКартинок(скрытые, темаМеста) {
  if (typeof document === 'undefined') return;
  const нужные = (Array.isArray(скрытые) ? скрытые : []).map(к => String(к).split(':')).filter(ч => ч.length === 4 && темаМеста(ч[1]) === ч[0]);
  let css = '';
  if (нужные.length) {
    // Правило темы → какие файлы в нём спрятать.
    const поПравилам = new Map();
    const правила = правилаСтраницы();
    for (const [тема, место, часть, файл] of нужные) {
      const тема_ = new RegExp(`hud-s${место}-${тема}(?![\\w-])`);
      const хвост = `.hud-scene-${место}` + (часть === 'self' ? '' : '::' + часть);
      for (const r of правила) {
        const sel = r.selectorText;
        if (!тема_.test(sel) || !sel.includes(хвост)) continue;
        if (!поПравилам.has(r)) поПравилам.set(r, new Set());
        поПравилам.get(r).add(файл);
      }
    }
    for (const [r, файлы] of поПравилам) {
      const свойства = [];
      const база = (r.parentStyleSheet && r.parentStyleSheet.href) || (typeof location !== 'undefined' ? location.href : '');
      // Фон темы записан кратко (background: …, …): картинки слоёв — из неё.
      const фон = r.style.getPropertyValue('background-image') || слои(r.style.getPropertyValue('background')).map(картинкаСлоя).join(', ');
      for (const [имя, значение] of [['background-image', фон], ['mask-image', r.style.getPropertyValue('mask-image')], ['-webkit-mask-image', r.style.getPropertyValue('-webkit-mask-image')]]) {
        const новое = безФайлов(значение, файлы, база);
        if (новое) свойства.push(`${имя}: ${новое} !important;`);
      }
      if (свойства.length) css += `${r.selectorText} { ${свойства.join(' ')} }\n`;
    }
  }
  if (css === прошлое) return;
  прошлое = css;
  if (!стиль) {
    стиль = document.getElementById('hud-scene-pieces') || document.createElement('style');
    стиль.id = 'hud-scene-pieces';
    if (!стиль.isConnected) document.head.appendChild(стиль);
  }
  стиль.textContent = css;
}
/** Выполнить fn с показанными картинками: список должен видеть и убранные. */
export function сПоказаннымиЧастями(fn) {
  const был = стиль && !стиль.disabled;
  if (был) стиль.disabled = true;
  try { return fn(); } finally { if (был) стиль.disabled = false; }
}

// Размеры картинок — чтобы найти, куда в общем слое попало нажатие.
const натурально = new Map();
export function запомнитьРазмер(url) {
  if (!url || натурально.has(url) || typeof Image === 'undefined') return;
  натурально.set(url, null);
  const и = new Image();
  и.onload = () => натурально.set(url, { w: и.naturalWidth, h: и.naturalHeight });
  и.src = url;
}
/**
 * Где в слое (рамка рам — { left, top, width, height }) лежит картинка слоя i:
 * по background-size и background-position слоя. null — размер ещё не известен.
 */
export function прямоугольникСлоя(рам, с, i, url) {
  const n = натурально.get(url);
  if (!n || !n.w || !n.h) return null;
  const взять = (значение) => { const л = слои(значение); return л.length ? л[i % л.length] : ''; };
  const W = рам.width, H = рам.height;
  const [sw = 'auto', sh = 'auto'] = взять(с.backgroundSize).split(/\s+/);
  let w, h;
  if (sw === 'contain' || sw === 'cover') {
    const k = sw === 'contain' ? Math.min(W / n.w, H / n.h) : Math.max(W / n.w, H / n.h);
    w = n.w * k; h = n.h * k;
  } else {
    const длина = (v, база) => (v === 'auto' ? null : /%$/.test(v) ? база * parseFloat(v) / 100 : parseFloat(v));
    w = длина(sw, W); h = длина(sh, H);
    if (w == null && h == null) { w = n.w; h = n.h; } else if (w == null) w = h * n.w / n.h; else if (h == null) h = w * n.h / n.w;
  }
  const место = (v, свободно) => {
    v = String(v || '0%').trim();
    if (/^-?[\d.]+%$/.test(v)) return свободно * parseFloat(v) / 100;
    if (/^-?[\d.]+px$/.test(v)) return parseFloat(v);
    const м = /calc\(\s*(-?[\d.]+)%\s*([+-])\s*(-?[\d.]+)px\s*\)/.exec(v);
    if (м) return свободно * parseFloat(м[1]) / 100 + (м[2] === '-' ? -1 : 1) * parseFloat(м[3]);
    return 0;
  };
  return { left: рам.left + место(взять(с.backgroundPositionX), W - w), top: рам.top + место(взять(с.backgroundPositionY), H - h), width: w, height: h };
}
