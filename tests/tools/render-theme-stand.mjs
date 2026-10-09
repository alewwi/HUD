// Стенд новых блоков в темах: быт, сетка секретов, дуэль, часы сцены, бой и
// бельё — в разметке настоящей карточки (.mes_text > .hud-os-card …), с
// style.css расширения и файлами тем, как их подключает themes.js. Открывать
// через сервер Таверны, иначе стили не подтянутся:
//   node tests/tools/render-theme-stand.mjs
//   http://127.0.0.1:8000/scripts/extensions/third-party/HUD/tests/tools/theme-stand.html
// Сверху — выбор темы (девять светлых и пара тёмных) и ширины карточки.
// Без генераций: ходы собраны руками.
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
globalThis.document = { createElement: () => ({ style: {}, set textContent(x) { this.t = String(x); }, get innerHTML() { return String(this.t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); } }), querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'Тристан' }) };

const { settings } = await м('settings.js');
const LF = await м('render/life.js');
const G = await м('render/secrets-grid.js');
const DU = await м('render/duel.js');
const SC = await м('render/scene-clock.js');
const CHR = await м('render/character.js');
const CB = await м('render/combat.js');
const UW = await м('render/underwear.js');
const SH = await м('render/sample-hud.js');
const { СВЕТЛЫЕ_ТЕМЫ, themeVars } = await м('themes.js');

// Быт: плотные сутки.
const hud = (о) => '[HUD]\n```json\n' + JSON.stringify(о) + '\n```\n[/HUD]';
const ход = (T, extra = {}) => ({ is_user: false, mes: hud({ sc: { Dt: '15.06.2028', T, Wt: '+24°C' }, cs: [{ N: 'Софи Ховард', Bs: 'eng: 55; sat: 35; slp: 5 ч, легла в 02:10', C: 'графитовый льняной сарафан, шёлковые трусики', L: 'Бостон, Кингсли-Тауэр, спальня', Fl: 'должна Кире 3 000 $ до субботы' }], ...extra }) });
const чат = [
  ход('08:00', { me: { hk: 'eat: завтрак, овсянка; wash: душ' } }),
  ход('13:10', { me: { hk: 'eat: обед, салат' }, phn: { wl: { bl: '18400', cu: '$', trx: [{ ti: 'Обед в кафе', am: '-120', tm: '13:00' }] } } }),
  ход('20:30', { me: { hk: 'buy: вино 90' }, dr: [{ tx: 'Снилось море у Ньюпорта' }] }),
  ход('22:10', { me: { lg: ['21:30 - пробежка по набережной'] }, phn: { wl: { bl: '18190', cu: '$', trx: [{ ti: 'Доставка цветов', am: '-60', tm: '22:00' }] } } }),
];
const ж = LF.журналБыта(чат, чат.length);

// Секреты — как в тестах, с группой.
const сек = [
  { fact: 'Близнецы — дети Тристана', level: 'critical', status: 'partial', knows: [{ name: 'Софи', source: 'сама мать' }, { name: 'Пять Регентов', source: 'очевидцы' }], hidden: ['Тристан'], wrong: 'Лена: думает, что отец — Брэндон' },
  { fact: 'Коэн сливает отчёты совету директоров', level: 'low', status: 'unknown', knows: [{ name: 'Коэн', source: 'сам' }] },
  { fact: 'Шрамы на спине от Сент-Магдален', level: 'high', status: 'known', knows: [{ name: 'Тристан', source: 'увидел' }, { name: 'Софи', source: 'своё тело' }] },
  { fact: 'Лактация спустя три года', level: 'medium', status: 'partial', knows: [{ name: 'Софи', source: 'тело' }] },
];
const сетка = G.сеткаСекретов(сек, { characters: [{ 'Имя': 'Тристан' }, { 'Имя': 'Лена' }, { 'Имя': 'Софи' }] });

// Дуэль: четыре хода спора.
const тристан = { 'Имя': 'Тристан', 'Глубина конфликта': 'wy: свадьба с Викторией; dys: 2; sg: open' };
Object.defineProperty(тристан, '__hudИстория', { value: () => [
  { назад: 1, данные: { 'Словесная дуэль': 'ini: Тристан, 55; gv: Софи признала, что знала о помолвке; tn: укол' } },
  { назад: 2, данные: { 'Словесная дуэль': 'ini: Тристан, 75; tn: спор' } },
] });
Object.defineProperty(тристан, '__hudХод', { value: () => ({ memory: { timeline: ['12.06 21:00 - объявили помолвку с Викторией на свадьбе Ченнингов'] } }) });
const дуэль = (вид) => { settings.duelView = вид; const h = DU.buildDuel('ini: Софи, 70; gv: Тристан уступил в деньгах; tn: ссора', тристан); delete settings.duelView; return h; };

// Часы сцены.
const день = Date.UTC(2028, 5, 15), М = (ч, мин) => день + (ч * 60 + мин) * 60000;
const т = { 'Имя': 'Тристан', 'Фаза близости': '2 — act', 'Длительность': '95', 'Расписание': '20:05 - продолжение' };
const ходНачала = { characters: [{ 'Имя': 'Тристан', 'Расписание': '18:30 - ужин с Софи; 19:00 - ужин с родителями; 20:30 - селектор с Лондоном' }, { 'Имя': 'Лена', 'Расписание': '19:45 - встреча с Тристаном в баре' }] };
Object.defineProperty(т, '__hudМомент', { value: () => М(20, 10) });
Object.defineProperty(т, '__hudХод', { value: () => ({ characters: [т] }) });
Object.defineProperty(т, '__hudИстория', { value: () => [
  { назад: 1, момент: М(19, 20), данные: { 'Имя': 'Тристан', 'Фаза близости': '2 — act' }, ход: { characters: [] } },
  { назад: 2, момент: М(18, 30), данные: { 'Имя': 'Тристан', 'Фаза близости': '2 — foreplay' }, ход: ходНачала },
  { назад: 3, момент: М(17, 0), данные: { 'Имя': 'Тристан', 'Фаза близости': '1 — empty' }, ход: { characters: [] } }] });
const часы = (вид) => { settings.sceneClockView = вид; const h = SC.часыСцены(т, CHR.состояниеСцены); delete settings.sceneClockView; return h; };

// Бой.
const ходБоя = { combat: { ...SH.ПРИМЕР_БОЯ }, characters: [{ 'Имя': 'Марк Грей', 'Болезни и травмы': SH.ПРИМЕР_БОЯ_РАНЫ, 'Инвентарь': 'пистолет: 4/8 патронов, под курткой; бита: треснула у рукояти' }] };
const бой = CB.buildCombatHTML(ходБоя.combat, ходБоя, 'cb', true, {});

// Бельё — открытым.
const бельё = UW.buildUnderwear('set: чёрное кружево, комплект; for: для Тристана; st: сдвинуто').replace('<details class="hud-un-veil">', '<details class="hud-un-veil" open>');

const строка = (ключ, тело) => `<div class="hud-row full-width"><span class="hud-key">${ключ}:</span> ${тело}</div>`;
const карточка = (заголовок, тело) => `<h2>${заголовок}</h2><div class="mes_text"><div class="hud-os-card no-swipe"><input type="checkbox" class="hud-toggle-input" checked><label class="hud-os-topbar"><div class="hud-os-topbar-left"><span class="hud-os-logo">TavernOS</span></div></label><div class="hud-os-wrapper"><div class="hud-tabs-body">${тело}</div></div></div></div>`;
const персонаж = `<div class="hud-tab-content active"><div class="hud-body">${строка('Словесная дуэль', дуэль('tug'))}${строка('Словесная дуэль (весы)', дуэль('scales'))}${строка('Фаза близости', часы('dial'))}${строка('Бельё', бельё)}</div></div>`;
const память = `<div class="hud-tab-content active"><div class="hud-memory-body">${сетка}</div></div>`;

const темы = [...СВЕТЛЫЕ_ТЕМЫ, 'vamp', 'spacehorror'];
const html = `<!doctype html><html class="hud-theme-${темы[0]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Темы — стенд</title>
<link rel="stylesheet" href="../../style.css${В}"><link rel="stylesheet" data-t="light" href="../../css/themes/light.css${В}"><link rel="stylesheet" data-t="theme" href="../../css/themes/${темы[0]}.css${В}">
<style>body { margin: 0; padding: 12px; background: #2a2730; color: #ddd; font: 13px system-ui, sans-serif; }
.bar { position: sticky; top: 0; z-index: 9; display: flex; gap: 8px; flex-wrap: wrap; padding: 8px; background: #111; border-radius: 8px; }
.wrap { display: grid; gap: 14px; max-width: var(--w, 640px); margin: 12px auto; } h2 { margin: 6px 0 0; font-size: 12px; color: #aaa; }
.mes_text .hud-tab-content { display: block; opacity: 1 !important; animation: none !important; transform: none !important; } .mes_text :is(.hud-body, .hud-memory-body) { height: auto !important; max-height: none !important; overflow: visible !important; }</style></head><body>
<div class="bar"><select id="t">${темы.map(т => `<option>${т}</option>`).join('')}</select><select id="w"><option value="640px">640</option><option value="360px">телефон 360</option><option value="215px">карточка 215</option></select></div>
<div class="wrap">${карточка('Быт', LF.buildLifeHTML(ж, 'life', true))}${карточка('Память — секреты', память)}${карточка('Персонаж — дуэль, часы, бельё', персонаж)}${карточка('Бой', бой)}</div>
<script>
const светлые = ${JSON.stringify(СВЕТЛЫЕ_ТЕМЫ)};
const пресеты = ${JSON.stringify(Object.fromEntries(темы.map(т => [т, themeVars(т)])))};
// Как applyThemeColors в index.js: цвета пресета — переменными на <html>.
const rgba = (hex, a) => { const h = String(hex || '#000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + ((a ?? 100) / 100) + ')'; };
const краски = (p) => { const r = document.documentElement.style; r.cssText = '';
  if (p.textColor) r.setProperty('--hud-text', p.textColor); if (p.textMutedColor) r.setProperty('--hud-text-muted', p.textMutedColor);
  if (p.accentColor) r.setProperty('--hud-accent', p.accentColor);
  if (p.glowColor) { r.setProperty('--hud-purple-glow', rgba(p.glowColor, p.glowAlpha ?? 40)); r.setProperty('--hud-glow', rgba(p.glowColor, p.glowAlpha ?? 40)); r.setProperty('--hud-glow-soft', rgba(p.glowColor, (p.glowAlpha ?? 40) * .55)); r.setProperty('--hud-glow-strong', rgba(p.glowColor, Math.min(100, (p.glowAlpha ?? 40) * 1.6))); r.setProperty('--hud-glow-solid', p.glowColor); r.setProperty('--hud-glow-r', '1'); r.setProperty('--hud-glow-i', '1'); }
  if (p.cardBgStart) r.setProperty('--hud-bg', 'linear-gradient(135deg, ' + rgba(p.cardBgStart, p.cardBgAlpha) + ', ' + rgba(p.cardBgEnd, p.cardBgAlpha) + ')');
  if (p.infoBlockBgStart) r.setProperty('--hud-card-inner-bg', 'linear-gradient(135deg, ' + rgba(p.infoBlockBgStart, p.infoBlockBgAlpha) + ', ' + rgba(p.infoBlockBgEnd, p.infoBlockBgAlpha) + ')');
  if (p.topBarBg) r.setProperty('--hud-header-bg', rgba(p.topBarBg, p.topBarAlpha)); if (p.tabsBg) r.setProperty('--hud-tab-bg', rgba(p.tabsBg, p.tabsAlpha)); };
const v = ${JSON.stringify(В)};
const выбрать = (id) => {
  document.documentElement.className = 'hud-theme-' + id + ' hud-glass-frosted' + (светлые.includes(id) ? ' hud-kinds-light' : '');
  краски(пресеты[id] || {});
  document.querySelector('link[data-t=light]').disabled = !светлые.includes(id);
  document.querySelector('link[data-t=theme]').href = '../../css/themes/' + id + '.css' + v;
};
document.getElementById('t').onchange = (e) => выбрать(e.target.value);
document.getElementById('w').onchange = (e) => document.querySelector('.wrap').style.setProperty('--w', e.target.value);
const q = new URLSearchParams(location.search);
document.getElementById('t').value = q.get('t') || ${JSON.stringify(темы[0])}; выбрать(document.getElementById('t').value);
if (q.get('w')) { document.getElementById('w').value = q.get('w'); document.querySelector('.wrap').style.setProperty('--w', q.get('w')); }
</script></body></html>`;
fs.writeFileSync(path.join(ТУТ, 'theme-stand.html'), html);
console.log('→ http://127.0.0.1:8000/scripts/extensions/third-party/HUD/tests/tools/theme-stand.html?t=kawaii');
