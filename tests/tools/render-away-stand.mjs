// Стенд «кто вне сцены» (hud-snapshot.js, внеСцены; render/carryover.js,
// вернутьЧерты): node tests/tools/render-away-stand.mjs [чат.jsonl] [номер хода]
// → tests/tools/away-stand.html. Настоящий ход чата, где персонаж не в сцене:
// его полная запись, короткая — как её пишет модель, — и короткая, которую
// карточка дополнила прошлыми ходами. Широко и узко, как на телефоне.
// Открывать через сервер Таверны (…/third-party/HUD/tests/tools/away-stand.html).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get innerHTML() { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, set innerHTML(x) { t = String(x); }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null, appendChild() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), body: узел(), getElementById: () => null, addEventListener() {} };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const модуль = (имя) => import('file:///' + path.join(КОРЕНЬ, имя).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

const ФАЙЛ = process.argv[2] || path.resolve(КОРЕНЬ, '..', '..', 'chats', 'THE REGENTS  Tristan Kingsley', 'THE_REGENTS_Tristan_Kingsley_2026_09_27@19h28m46s177ms_imported.jsonl');
const ГЛАВНЫЙ = 'THE REGENTS  Tristan Kingsley';
const строки = fs.readFileSync(ФАЙЛ, 'utf8').trim().split('\n').map(s => JSON.parse(s));
const чат = строки[0] && строки[0].chat_metadata && !('mes' in строки[0]) ? строки.slice(1) : строки;
globalThis.SillyTavern = { getContext: () => ({ chat: чат, name1: 'Софи', name2: ГЛАВНЫЙ, characters: [], chatMetadata: {} }) };

const S = await модуль('hud-snapshot.js');
const B = await модуль('hud-block.js');
const P = await модуль('hud-parser.js');
const Co = await модуль('render/carryover.js');
const Ch = await модуль('render/character.js');
const { escapeHtml } = await модуль('utils.js');

// Ходы: заданные через запятую или два последних, где кто-то вне сцены.
const тексты = (i) => { const и = чат.slice(i + 1).find(x => x && x.is_user); return [и ? и.mes : '', String(чат[i].mes || '').replace(/\[HUD\][\s\S]*?\[\/HUD\]/g, '')]; };
const вне = (i) => { const б = B.extractHudBlock(String(чат[i] && чат[i].mes || '')); const сн = б && S.собратьСнимок(б); return сн ? S.внеСцены(сн, { тексты: тексты(i), главный: ГЛАВНЫЙ }) : []; };
let ходы = process.argv[3] ? process.argv[3].split(',').map(Number) : [];
if (!ходы.length) for (let i = чат.length - 1; i >= 0 && ходы.length < 2; i--) if (чат[i] && !чат[i].is_user && вне(i).length) ходы.push(i);
if (!ходы.length) { console.log('в чате нет хода, где кто-то вне сцены'); process.exit(1); }
ходы.sort((a, b) => a - b);
const имя = (c) => String(c && c['Имя'] || '');
const найти = (d, н) => (d.characters || []).find(c => имя(c) && (имя(c) === н || имя(c).includes(н.split(' ').pop())));
// Разбор ставит в пустые поля заглушки — их не считаем.
const пусто = (v) => v == null || (Array.isArray(v) ? !v.length : typeof v === 'object' ? !Object.keys(v).length : /^(?:|empty|none|null|нет|пусто|—|-)$/i.test(String(v).trim()));
const поля = (c) => Object.keys(c || {}).filter(k => !пусто(c[k])).length;
const итогХодов = [];
const секцииХода = (ход) => {
  const блок = B.extractHudBlock(чат[ход].mes);
  const снимок = S.собратьСнимок(блок);
  const кто = S.внеСцены(снимок, { тексты: тексты(ход), главный: ГЛАВНЫЙ });
  
  // Короткая запись — ровно то, что снимок оставляет модели, и в том же виде
  // она его пишет: весь HUD хода, у тех, кто вне сцены, — без кадра.
  const коды = S.HUDвКодах(блок);
  for (const c of коды.cs || []) if (кто.includes(String(c.N))) {
    const когда = String(c.SxL || '').split(';').map(s => s.trim()).filter(s => /^(dt|pr|en)\s*[:：]/i.test(s)).join('; ');
    for (const k of [...S.ВНЕ_СЦЕНЫ_БЕЗ, ...S.NSFW_ПЕРСОНАЖА]) delete c[k];
    if (когда) c.SxL = когда;
  }
  const полный = P.parseHUDComplex(блок);
  const короткий = P.parseHUDComplex('[HUD]\n```json\n' + JSON.stringify(коды) + '\n```\n[/HUD]');
  const эл = { getAttribute: () => String(ход) };
  // Как в карточке (index.js): перенос из прошлых ходов, потом устойчивые черты.
  const дополнен = Co.вернутьЧерты(Co.mergeCarryOver(короткий, эл), эл);
  
  const легенда = S.легендаСнимка(S.строкаСнимка(снимок, false, { тексты: тексты(ход), главный: ГЛАВНЫЙ }));
  const строкаВне = легенда.split('\n').slice(1).join('\n');
  
  const секции = кто.map((н, k) => {
    const п = найти(полный, н), к = найти(короткий, н), д = найти(дополнен, н);
    const карта = (c, id) => c ? Ch.buildCharacterHTML(c, `${id}-${k}`, true, false) : '<p class="miss">нет записи</p>';
    const вернулось = д ? Object.keys(д).filter(f => к && пусто(к[f]) && !пусто(д[f])) : [];
    const колонка = (заголовок, пояснение, c, id) => `<section><h3>${заголовок}</h3><p class="note">${пояснение}</p><div class="pair"><div class="wide">${карта(c, id + 'w')}</div><div class="narrow">${карта(c, id + 'n')}</div></div></section>`;
    return `<h2>${escapeHtml(н)} <small>· ${escapeHtml(String(п && п['Место'] || ''))}</small></h2>
  <div class="cols">
  ${колонка('1. Полная запись', `как сейчас, в кадре: полей — ${поля(п)}`, п, 'full')}
  ${колонка('2. Как модель пишет вне сцены', `только живое: полей — ${поля(к)}. Внешности, одежды, вещей, реплик, страхов, отметин нет`, к, 'short')}
  ${колонка('3. Что покажет карточка', вернулось.length ? `короткая запись + прежнее из прошлых ходов: ${escapeHtml(вернулось.join(', '))}` : 'короткая запись: вернуть было нечего', д, 'back')}
  </div>`;
  }).join('\n');
  итогХодов.push(`#${ход}: ${кто.join(', ')}`);
  return `<h1>Ход #${ход}</h1><p class="lead">{{user}}: ${escapeHtml(String(полный.user && полный.user['Место'] || '—'))}</p><p class="lead">Что модель читает в инструкции про них:</p><pre>${escapeHtml(строкаВне)}</pre>${секции}`;
};
const все = ходы.map(секцииХода).join('<hr>');

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Вне сцены — стенд</title>
<link rel="stylesheet" href="../../css/all.css?v=${ВЕРСИЯ}">
<style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
h1 { font-size: 15px; margin: 0 0 6px; } hr { border: 0; border-top: 1px solid #2c2535; margin: 28px 0; } h2 { font-size: 14px; margin: 22px 0 8px; } h2 small { opacity: .6; font-weight: 400; } h3 { font-size: 12px; margin: 0 0 2px; color: #d9d4e2; }
.lead, .note { color: #a8a5ad; margin: 0 0 8px; font-size: 12px; overflow-wrap: anywhere; } .note { min-height: 2.6em; }
pre { white-space: pre-wrap; background: #1e1826; border-radius: 10px; padding: 10px; font-size: 11px; color: #c9c3d3; max-width: 1100px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 18px; align-items: start; }
.pair { display: flex; flex-direction: column; gap: 10px; } .wide { max-width: 520px; } .narrow { width: 215px; }
.hud-tab-content { display: block !important; } .miss { opacity: .6; }
@media (max-width: 600px) { body { padding: 16px; } .cols { grid-template-columns: 1fr; } }
</style>
<p class="lead">${escapeHtml(path.basename(ФАЙЛ))}</p>
${все}`;
fs.writeFileSync(path.join(КОРЕНЬ, 'tests', 'tools', 'away-stand.html'), html);
console.log('→ tests/tools/away-stand.html · ' + итогХодов.join(' · '));
