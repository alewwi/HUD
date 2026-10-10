// Проверка вёрстки карточек HUD на узком экране — в живой Таверне, без
// генераций. Подключение из консоли:
//   await import('/scripts/extensions/third-party/HUD/tests/tools/mobile-audit.js?t=' + Date.now())
// Затем: __auditTabs(карточка) обходит вкладки (клик по вкладке ничего не
// сохраняет) и возвращает, что вылезло за край, обрезано многоточием или
// наложилось. Свёрнутые старые карточки сначала разворачивает __unfold().

const ШУМ = /^(вылез \.hud-key|вылез \.hud-regen-btn|вылез \.hud-mark-ico|вылез \.hud-phone-back|за краем \.hud-breaking-marquee|обрезано \.hud-phone-inputfield|обрезано \.hud-phone-chat-preview|обрезано small)/;

function внутриПрокрутки(el, card) {
  for (let p = el.parentElement; p && p !== card; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/auto|scroll/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
    if (/marquee|ticker|tape/i.test(p.className)) return true;
  }
  return false;
}
const имя = (el) => (el.className && typeof el.className === 'string'
  ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase());

export function auditCard(card) {
  const issues = [];
  const cr = card.getBoundingClientRect();
  const all = [...card.querySelectorAll('*')];
  for (const el of all) {
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.position === 'absolute' || s.position === 'fixed') continue;
    if (внутриПрокрутки(el, card)) continue;
    const txt = (el.textContent || '').trim().slice(0, 40);
    if ((r.right > cr.right + 1.5 || r.left < cr.left - 1.5) && txt) issues.push(['за краем', имя(el), Math.round(Math.max(r.right - cr.right, cr.left - r.left)), txt]);
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (hasText && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      if (s.textOverflow === 'ellipsis' && s.overflowX !== 'visible') issues.push(['обрезано', имя(el), el.scrollWidth - el.clientWidth, txt]);
      else if (s.overflowX === 'visible' && s.display !== 'inline') issues.push(['вылез', имя(el), el.scrollWidth - el.clientWidth, txt]);
    }
  }
  for (const par of all) {
    const kids = [...par.children].filter(k => {
      const s = getComputedStyle(k);
      return s.display !== 'inline' && s.position !== 'absolute' && s.position !== 'fixed' && (k.textContent || '').trim() && k.getBoundingClientRect().width;
    });
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 3 && oy > 3 && !внутриПрокрутки(kids[i], card)) issues.push(['наложение', имя(kids[i]) + ' × ' + имя(kids[j]), Math.round(Math.min(ox, oy)), (kids[i].textContent || '').trim().slice(0, 20) + ' | ' + (kids[j].textContent || '').trim().slice(0, 20)]);
    }
  }
  return issues.filter(i => !ШУМ.test(i[0] + ' ' + i[1]));
}

export function auditTabs(card) {
  const out = {};
  const вкладки = [...card.querySelectorAll('.hud-tabs-header .hud-tab')];
  if (!вкладки.length) { const iss = auditCard(card); if (iss.length) out['—'] = iss.map(i => i.join(' · ')); return out; }
  for (const tab of вкладки) {
    tab.click();
    const iss = auditCard(card);
    if (iss.length) out[tab.textContent.trim().slice(0, 16)] = [...new Set(iss.map(i => i.join(' · ')))].slice(0, 12);
  }
  вкладки[0].click();
  return out;
}

// Свёрнутые старые карточки (events.js → облегчитьКарточку) держат тело вне
// DOM. Возвращаем его на место и раскрываем — только в DOM, без событий.
export function unfold(root = document) {
  let n = 0;
  root.querySelectorAll('.hud-os-card').forEach(card => {
    const части = card.__hudLight;
    if (части) {
      delete card.__hudLight;
      for (const { метка, узел } of части) { if (метка.parentNode) метка.replaceWith(узел); else card.appendChild(узел); }
      n++;
    }
    const t = card.querySelector(':scope > .hud-toggle-input'); if (t) t.checked = true;
    const mes = card.closest('.mes'); if (mes) mes.style.contentVisibility = 'visible';
  });
  return n;
}

Object.assign(window, { __auditCard: auditCard, __auditTabs: auditTabs, __unfold: unfold });
