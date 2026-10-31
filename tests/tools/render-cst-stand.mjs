// Стенд своих статов (custom-stats.js) во всех темах: шесть видов блока среди
// обычных строк карточки персонажа. Открывать через сервер Таверны:
//   node tests/tools/render-cst-stand.mjs
//   http://127.0.0.1:8000/scripts/extensions/third-party/HUD/tests/tools/cst-stand.html?t=kawaii&w=360px
// ?a=#3fb6a8 — свой акцент поверх темы: так собирают свою тему в «Кастомизации».
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

const К = await м('custom-stats.js');
const { СВЕТЛЫЕ_ТЕМЫ, themeVars } = await м('themes.js');

const статы = [
  [{ id: 's1', name: 'Голод', view: 'pct', icon: 'fork', color: 'alarm' }, '72 — с утра ничего не ела'],
  [{ id: 's2', name: 'Мана', view: 'scale', icon: 'drop', color: 'dream' }, '8 — полна сил после ритуала'],
  [{ id: 's3', name: 'Репутация при дворе', view: 'stars', icon: 'crown' }, '2 — после скандала на балу'],
  [{ id: 's4', name: 'Розыск', view: 'num', color: '#e0a030' }, '12 — листовки на двух площадях'],
  [{ id: 's5', name: 'Тайна', view: 'text', icon: 'mask' }, 'Скрывает, что видела его во сне задолго до встречи.'],
  [{ id: 's6', name: 'Слухи о нас', view: 'tags' }, 'ведьма из леса; рыжий наёмник; пропавший обоз'],
  [{ id: 's7', name: 'Усталость', view: 'pct', icon: 'bed' }, '18 — выспалась'],
];
const строка = (ключ, тело) => `<div class="hud-row kind-look"><span class="hud-key">${ключ}:</span> <span class="hud-value">${тело}</span></div>`;
const тело = строка('Возраст', '24') + строка('Роль', 'реставратор книг') + статы.map(([с, з]) => К.блокСтата(с, з)).join('') + строка('Место', 'её гостиная');
const карточка = `<div class="mes_text"><div class="hud-os-card no-swipe"><input type="checkbox" class="hud-toggle-input" checked><div class="hud-os-wrapper"><div class="hud-tabs-body"><div class="hud-tab-content active"><div class="hud-body">${тело}</div></div></div></div></div></div>`;

const темы = ['default', ...fs.readdirSync(path.join(КОРЕНЬ, 'css', 'themes')).map(f => f.replace(/\.css$/, '')).filter(т => т !== 'light')];
const пресеты = Object.fromEntries(темы.map(т => [т, themeVars(т)]));
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Свои статы — стенд</title>
<link rel="stylesheet" href="../../css/all.css${В}"><link rel="stylesheet" data-t="light" href="../../css/themes/light.css${В}"><link rel="stylesheet" data-t="theme" href="">
<style>body { margin: 0; padding: 12px; background: #2a2730; color: #ddd; font: 13px system-ui, sans-serif; }
.bar { display: flex; gap: 8px; padding: 8px; background: #111; border-radius: 8px; }
.wrap { max-width: var(--w, 640px); margin: 12px auto; }
.mes_text .hud-tab-content { display: block; opacity: 1 !important; animation: none !important; transform: none !important; } .mes_text .hud-body { height: auto !important; max-height: none !important; }</style></head><body>
<div class="bar"><select id="t">${темы.map(т => `<option>${т}</option>`).join('')}</select><span id="name"></span></div>
<div class="wrap">${карточка}</div>
<script>
const светлые = ${JSON.stringify(СВЕТЛЫЕ_ТЕМЫ)};
const пресеты = ${JSON.stringify(пресеты)};
const rgba = (hex, a) => { const h = String(hex || '#000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + ((a ?? 100) / 100) + ')'; };
const краски = (p) => { const r = document.documentElement.style; r.cssText = '';
  if (p.textColor) r.setProperty('--hud-text', p.textColor); if (p.textMutedColor) r.setProperty('--hud-text-muted', p.textMutedColor);
  if (p.accentColor) r.setProperty('--hud-accent', p.accentColor);
  if (p.glowColor) { r.setProperty('--hud-glow', rgba(p.glowColor, p.glowAlpha ?? 40)); r.setProperty('--hud-purple-glow', rgba(p.glowColor, p.glowAlpha ?? 40)); }
  if (p.cardBgStart) r.setProperty('--hud-bg', 'linear-gradient(135deg, ' + rgba(p.cardBgStart, p.cardBgAlpha) + ', ' + rgba(p.cardBgEnd, p.cardBgAlpha) + ')');
  if (p.infoBlockBgStart) r.setProperty('--hud-card-inner-bg', 'linear-gradient(135deg, ' + rgba(p.infoBlockBgStart, p.infoBlockBgAlpha) + ', ' + rgba(p.infoBlockBgEnd, p.infoBlockBgAlpha) + ')'); };
const v = ${JSON.stringify(В)};
const q = new URLSearchParams(location.search);
const выбрать = (id) => {
  document.documentElement.className = 'hud-theme-' + id + ' hud-glass-frosted' + (светлые.includes(id) ? ' hud-kinds-light' : '');
  краски(пресеты[id] || {});
  if (q.get('a')) document.documentElement.style.setProperty('--hud-accent', q.get('a'));
  document.querySelector('link[data-t=light]').disabled = !светлые.includes(id);
  document.querySelector('link[data-t=theme]').href = id === 'default' ? '' : '../../css/themes/' + id + '.css' + v;
  document.getElementById('name').textContent = id + (q.get('a') ? ' + ' + q.get('a') : '');
};
document.getElementById('t').onchange = (e) => выбрать(e.target.value);
document.getElementById('t').value = q.get('t') || 'default'; выбрать(document.getElementById('t').value);
if (q.get('w')) document.querySelector('.wrap').style.setProperty('--w', q.get('w'));
</script></body></html>`;
fs.writeFileSync(path.join(ТУТ, 'cst-stand.html'), html);
console.log('→ http://127.0.0.1:8000/scripts/extensions/third-party/HUD/tests/tools/cst-stand.html?t=kawaii');
