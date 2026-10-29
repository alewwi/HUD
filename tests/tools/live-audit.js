// Живой аудит вёрстки HUD — строже mobile-audit.js: вылезшее за край,
// срезанное предком без многоточия, сжатый в столбик текст, пилюли-овалы,
// наложения. Невидимое (opacity 0, закрытые <details>, бегущая строка) не считает.
//   const A = await import('/scripts/extensions/third-party/HUD/tests/tools/live-audit.js?t=' + Date.now())
//   await A.auditDeep(карточка)  — по всем вкладкам и подвкладкам; A.auditCard(карточка) — что видно сейчас.

const имя = (el) => (el.className && typeof el.className === 'string'
  ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase());

function видим(el, стоп) {
  for (let p = el; p && p !== стоп; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false;
    if (p.tagName === 'DETAILS' && !p.open && el !== p && !el.closest('summary')) return false;
    if (/marquee|ticker|tape|breaking-track/i.test(p.className)) return false;
    const r = p.getBoundingClientRect(); if (r.height < 2 || r.width < 2) return false;
  }
  return true;
}
function внутриПрокрутки(el, card) {
  for (let p = el.parentElement; p && p !== card; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/auto|scroll/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
  }
  return false;
}
const свойТекст = (el) => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();

export function auditCard(card) {
  const out = [];
  const cr = card.getBoundingClientRect();
  const all = [...card.querySelectorAll('*')].filter(el => !(el.closest('svg') && el.tagName !== 'svg'));
  const vis = new Map();
  const V = (el) => { if (!vis.has(el)) vis.set(el, видим(el, card)); return vis.get(el); };
  for (const el of all) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    if (s.position === 'fixed') continue;
    const свой = свойТекст(el);
    const txt = (el.textContent || '').trim().slice(0, 34);
    if (!txt && el.tagName !== 'IMG') continue;
    if (!V(el)) continue;
    const скролл = внутриПрокрутки(el, card);
    if (!скролл && s.position !== 'absolute' && (r.right > cr.right + 1.5 || r.left < cr.left - 1.5)) out.push(['за краем', имя(el), Math.round(Math.max(r.right - cr.right, cr.left - r.left)), txt]);
    if (свой && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !скролл) {
      if (s.textOverflow === 'ellipsis' && s.overflowX !== 'visible') out.push(['многоточие', имя(el), el.scrollWidth - el.clientWidth, txt]);
      else if (s.overflowX === 'visible' && s.display !== 'inline') out.push(['вылез', имя(el), el.scrollWidth - el.clientWidth, txt]);
    }
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.25;
    if (свой.length >= 6 && r.width < 34 && r.height > lh * 3.5) out.push(['столбик', имя(el), Math.round(r.width), свой.slice(0, 30)]);
    // Слово не влезает по ширине — значит, переносится посреди слова без дефиса.
    if (свой.length >= 4 && r.height > lh * 1.5) {
      const rg = document.createRange();
      for (const n of el.childNodes) {
        if (n.nodeType !== 3) continue;
        for (const m of n.textContent.matchAll(/[^\s \-–—/]{2,}[:,.!?»)]*/g)) {
          rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
          const rs = [...rg.getClientRects()].filter(x => x.width > 0.5);
          if (rs.length > 1 && Math.abs(rs[0].top - rs.at(-1).top) > 3) { out.push(['разрыв слова', имя(el), rs.length, m[0].slice(0, 30)]); break; }
        }
      }
    }
    // Длинная фраза заглавными — капс задуман для ярлыков, не для предложений.
    if (s.textTransform === 'uppercase' && свой.length > 45) out.push(['капс', имя(el), свой.length, свой.slice(0, 30)]);
    const рад = parseFloat(s.borderTopLeftRadius);
    if (свой && рад >= 30 && r.height > lh * 2.2 && r.height > 40 && Math.abs(r.width - r.height) > 8) out.push(['овал', имя(el), Math.round(r.height), свой.slice(0, 30)]);
    if (свой && s.position !== 'absolute' && !скролл) {
      for (let p = el.parentElement; p && p !== card.parentElement; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/auto|scroll/.test(ps.overflowX + ps.overflowY)) break;
        if (!/hidden|clip/.test(ps.overflowX + ps.overflowY)) continue;
        const pr = p.getBoundingClientRect();
        const вниз = r.bottom - pr.bottom, вбок = Math.max(r.right - pr.right, pr.left - r.left);
        if (вбок > 2 && /hidden|clip/.test(ps.overflowX) && s.textOverflow !== 'ellipsis') out.push(['срезано сбоку', имя(el) + ' в ' + имя(p), Math.round(вбок), свой.slice(0, 30)]);
        else if (вниз > 2 && /hidden|clip/.test(ps.overflowY) && !/clamp|veil|fade|collapsed|preview|wrapper/i.test(p.className) && !+s.webkitLineClamp && !+getComputedStyle(p).webkitLineClamp) out.push(['срезано снизу', имя(el) + ' в ' + имя(p), Math.round(вниз), свой.slice(0, 30)]);
        break;
      }
    }
  }
  for (const par of all) {
    if (!V(par)) continue;
    const kids = [...par.children].filter(k => {
      const s = getComputedStyle(k);
      return s.display !== 'inline' && s.position !== 'absolute' && s.position !== 'fixed' && (k.textContent || '').trim() && k.getBoundingClientRect().width && V(k);
    });
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 3 && oy > 3 && !внутриПрокрутки(kids[i], card)) out.push(['наложение', имя(kids[i]) + ' × ' + имя(kids[j]), Math.round(Math.min(ox, oy)), (kids[i].textContent || '').trim().slice(0, 20) + ' | ' + (kids[j].textContent || '').trim().slice(0, 20)]);
    }
  }
  // .hud-key: подпись с вопросиком помощи вылезает на 6px нарочно (знак висит справа).
  return [...new Set(out.map(i => i.join(' · ')))].filter(x => !/^вылез · .hud-key · /.test(x));
}

const пауза = (мс) => new Promise(r => setTimeout(r, мс));
const ПОДВКЛАДКИ = '[role="tab"]:not(.hud-tab), .hud-subtab, .hud-mem-tab';

export async function auditDeep(card, { sub = true, wait = 150, only = null } = {}) {
  const out = {};
  const add = (k, list) => { if (list.length) out[k] = list.slice(0, 80); };
  for (const tab of [...card.querySelectorAll('.hud-tabs-header .hud-tab')]) {
    const ключ = (tab.dataset.tabId || tab.textContent.trim()).slice(0, 18);
    if (only && !only.includes(ключ)) continue;
    tab.click(); await пауза(wait);
    add(ключ, auditCard(card));
    if (!sub) continue;
    const панель = card.querySelector('#' + CSS.escape(tab.dataset.target || '')) || card;
    const подв = [...панель.querySelectorAll(ПОДВКЛАДКИ)].filter(п => видим(п, card));
    for (const п of подв.slice(0, 24)) {
      п.click(); await пауза(wait);
      const iss = auditCard(card).filter(x => !(out[ключ] || []).includes(x));
      add(ключ + '/' + (п.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16), iss);
    }
  }
  return out;
}

// Развернуть карточку (клик по верхней полосе, как человек).
export async function unfold(card) {
  const t = card.querySelector('.hud-toggle-input');
  if (t && !t.checked) { card.querySelector('.hud-os-topbar').click(); await пауза(900); }
  return card;
}
