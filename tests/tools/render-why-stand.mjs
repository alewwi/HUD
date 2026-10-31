// Стенд «почему N%» (render/intimacy.js, почемуРиск): блок риска зачатия с
// разбором — свёрнутым и раскрытым — в нескольких темах. Открывать через
// сервер Таверны:
//   node tests/tools/render-why-stand.mjs
//   http://127.0.0.1:8000/scripts/extensions/third-party/HUD/tests/tools/why-stand.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const В = '?v=' + JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + В);
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { createElement: () => ({ style: {} }), querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'Тристан' }) };

const I = await м('render/intimacy.js');
const { СВЕТЛЫЕ_ТЕМЫ, themeVars } = await м('themes.js');

// Как блокРиска в intimacy.js: шапка, полоса, строка и разбор.
const блок = (р, открыт) => {
  const проц = Math.round(р.шанс * 100);
  const уровень = проц >= 20 ? 'is-high' : проц >= 8 ? 'is-mid' : 'is-low';
  return `<div class="hud-conception ${уровень}"><div class="hud-conception-head"><span>Риск зачатия</span><b>${проц}%</b></div>`
    + `<i class="hud-conception-bar" aria-hidden="true"><i style="width:${Math.min(100, проц * 3)}%"></i></i>`
    + `<small>${р.защита ? `${р.защита.имя}: из ${Math.round(р.базовый * 100)}% остаётся ${проц}%` : `без защиты — ${Math.round(р.базовый * 100)}% в этот день цикла`}</small>`
    + I.почемуРиск(р).replace('<details class="hud-why hud-smooth">', `<details class="hud-why hud-smooth"${открыт ? ' open' : ''}>`) + `</div>`;
};
const примеры = [
  ['Свёрнуто', I.рискЗачатия(12, 28, '', { ov: 14, защита: 'condom: надели' }), false],
  ['Презерватив, за 2 дня до овуляции', I.рискЗачатия(12, 28, '', { ov: 14, защита: 'condom: надели' }), true],
  ['Без защиты, день овуляции, кормит грудью', I.рискЗачатия(14, 28, '', { ov: 14, плодовитость: { доля: .5, причины: [{ имя: 'Кормит грудью', доля: .5 }] } }), true],
  ['Вне окна зачатия', I.рискЗачатия(4, 28, '', { ov: 14 }), true],
];
const карточки = примеры.map(([з, р, о]) => `<h2>${з}</h2><div class="mes_text"><div class="hud-os-card no-swipe"><input type="checkbox" class="hud-toggle-input" checked><div class="hud-os-wrapper"><div class="hud-tabs-body"><div class="hud-tab-content active"><div class="hud-body" style="padding:10px">${блок(р, о)}</div></div></div></div></div></div>`).join('');
const темы = ['default', ...fs.readdirSync(path.join(КОРЕНЬ, 'css', 'themes')).map(f => f.replace(/\.css$/, '')).filter(т => т !== 'light')];
const пресеты = Object.fromEntries(темы.map(т => [т, themeVars(т)]));
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Почему N% — стенд</title>
<link rel="stylesheet" href="../../css/all.css${В}"><link rel="stylesheet" data-t="light" href="../../css/themes/light.css${В}"><link rel="stylesheet" data-t="theme" href="">
<style>body { margin: 0; padding: 12px; background: #2a2730; color: #ddd; font: 13px system-ui, sans-serif; } .wrap { max-width: var(--w, 420px); margin: 10px auto; display: grid; gap: 6px; } h2 { margin: 8px 0 0; font-size: 12px; color: #aaa; font-weight: 600; }
.mes_text .hud-tab-content { display: block; opacity: 1 !important; animation: none !important; transform: none !important; } .mes_text .hud-body { height: auto !important; max-height: none !important; }</style></head><body>
<div><select id="t">${темы.map(т => `<option>${т}</option>`).join('')}</select></div><div class="wrap">${карточки}</div>
<script>
const светлые = ${JSON.stringify(СВЕТЛЫЕ_ТЕМЫ)}; const пресеты = ${JSON.stringify(пресеты)}; const v = ${JSON.stringify(В)};
const rgba = (hex, a) => { const h = String(hex || '#000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + ((a ?? 100) / 100) + ')'; };
const выбрать = (id) => { const p = пресеты[id] || {}; const r = document.documentElement.style; r.cssText = '';
  document.documentElement.className = 'hud-theme-' + id + ' hud-glass-frosted' + (светлые.includes(id) ? ' hud-kinds-light' : '');
  if (p.textColor) r.setProperty('--hud-text', p.textColor); if (p.accentColor) r.setProperty('--hud-accent', p.accentColor);
  if (p.cardBgStart) r.setProperty('--hud-bg', 'linear-gradient(135deg, ' + rgba(p.cardBgStart, p.cardBgAlpha) + ', ' + rgba(p.cardBgEnd, p.cardBgAlpha) + ')');
  if (p.infoBlockBgStart) r.setProperty('--hud-card-inner-bg', 'linear-gradient(135deg, ' + rgba(p.infoBlockBgStart, p.infoBlockBgAlpha) + ', ' + rgba(p.infoBlockBgEnd, p.infoBlockBgAlpha) + ')');
  document.querySelector('link[data-t=light]').disabled = !светлые.includes(id);
  document.querySelector('link[data-t=theme]').href = id === 'default' ? '' : '../../css/themes/' + id + '.css' + v; };
const q = new URLSearchParams(location.search); document.getElementById('t').onchange = (e) => выбрать(e.target.value);
document.getElementById('t').value = q.get('t') || 'default'; выбрать(document.getElementById('t').value);
</script></body></html>`;
fs.writeFileSync(path.join(ТУТ, 'why-stand.html'), html);
console.log('→ http://127.0.0.1:8000/scripts/extensions/third-party/HUD/tests/tools/why-stand.html');
