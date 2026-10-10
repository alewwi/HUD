// Аудит чата: каждый ход и каждый свайп — через разбор и отрисовку HUD, как
// в карточке. Ищет исключения, мусор в разметке (undefined, NaN, [object
// Object]) и собирает сводку x-ray и новых блоков по ходам. Без Таверны и без
// генераций: читает .jsonl чата.
//   node tests/tools/audit-chat.mjs "<путь к .jsonl>" [--from N] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const В = '?v=' + JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + В);

const аргументы = process.argv.slice(2);
const файл = аргументы.find(a => !a.startsWith('--'));
const с = Number((аргументы[аргументы.indexOf('--from') + 1]) || 0) || 0;
// --dump 284,286:1 — видимый текст новых блоков этих сообщений (N — выбранный свайп, N:s — свайп s с нуля).
const выгрузка = аргументы.includes('--dump') ? аргументы[аргументы.indexOf('--dump') + 1].split(',') : [];
const вJson = аргументы.includes('--json') ? аргументы[аргументы.indexOf('--json') + 1] : '';
if (!файл) { console.error('укажите путь к .jsonl'); process.exit(2); }

globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
const узел = () => { let t = ''; return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, set textContent(x) { t = String(x); }, get innerHTML() { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, querySelector: () => null, querySelectorAll: () => [] }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), body: узел() };
for (const k of ['info', 'debug', 'warn', 'log']) if (k !== 'log') console[k] = () => {};

const строки = fs.readFileSync(файл, 'utf8').split(/\r?\n/).filter(Boolean).map(s => JSON.parse(s));
const шапка = строки[0] && строки[0].chat_metadata ? строки.shift() : null;
const чат = строки;
globalThis.SillyTavern = { getContext: () => ({ chat: чат, name1: (шапка && шапка.user_name) || 'Софи', name2: (шапка && шапка.character_name) || '' }) };

const { extractHudBlock } = await м('hud-block.js');
const { parseHUDComplex } = await м('hud-parser.js');
const { normalizeJSONData } = await м('schema.js');
const Ch = await м('render/character.js');
const M = await м('render/memory.js');
const LF = await м('render/life.js');
const CB = await м('render/combat.js');
const { привязатьИсторию } = await м('render/intimacy.js');

const МУСОР = /(?<![\p{L}-])(?:undefined|NaN|\[object Object\]|null)(?![\p{L}-])/u;
// Видимый текст без тегов — мусор в атрибутах (классы) нас не беспокоит.
const текстHtml = (h) => String(h).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');

const ошибки = [], мусор = [], темп = [], новые = { быт: 0, дуэль: 0, бой: 0, бельё: 0, часы: 0, секреты: 0 };
const полеИз = (о, имя) => { if (!о) return ''; const к = Object.keys(о).find(k => k.toLowerCase() === имя.toLowerCase()); const v = к ? о[к] : ''; return typeof v === 'string' ? v : v ? JSON.stringify(v) : ''; };

for (let i = с; i < чат.length; i++) {
  const m = чат[i];
  if (!m || m.is_user || m.is_system) continue;
  const свайпы = Array.isArray(m.swipes) && m.swipes.length ? m.swipes : [m.mes];
  for (let s = 0; s < свайпы.length; s++) {
    const текст = String(свайпы[s] || '');
    const блок = extractHudBlock(текст);
    if (!блок) continue;
    const где = `#${i}${свайпы.length > 1 ? ` свайп ${s + 1}/${свайпы.length}` : ''}${s === (m.swipe_id ?? 0) ? '' : ' (не выбран)'}`;
    // Отрисовываем как выбранный: история берётся из чата, где у этого
    // сообщения — нынешний свайп; для невыбранных подменяем mes на время.
    const былоMes = m.mes, былоId = m.swipe_id;
    m.mes = текст; m.swipe_id = s;
    try {
      let d;
      try { d = normalizeJSONData(parseHUDComplex(блок)); } catch (e) { ошибки.push(`${где}: разбор — ${e.message}`); continue; }
      привязатьИсторию(d, i);
      const куски = [];
      (Array.isArray(d.characters) ? d.characters : []).forEach((c, k) => {
        try { куски.push(['персонаж ' + (c['Имя'] || k), Ch.buildCharacterHTML(c, `a${i}_${s}_${k}`, true, k === 0)]); }
        catch (e) { ошибки.push(`${где}: персонаж ${c && c['Имя']} — ${e.message}\n    ${String(e.stack).split('\n').slice(1, 3).join('\n    ')}`); }
      });
      if (d.memory) { try { куски.push(['память', M.buildMemoryHTML(d.memory, `m${i}_${s}`, true, d)]); } catch (e) { ошибки.push(`${где}: память — ${e.message}\n    ${String(e.stack).split('\n').slice(1, 3).join('\n    ')}`); } }
      try { const ж = LF.журналБыта(чат, i + 1); if (ж && LF.естьБыт(ж)) { куски.push(['быт', LF.buildLifeHTML(ж, `l${i}_${s}`, true)]); новые.быт++; } } catch (e) { ошибки.push(`${где}: быт — ${e.message}\n    ${String(e.stack).split('\n').slice(1, 3).join('\n    ')}`); }
      if (d.combat && CB.hudHasCombat(d.combat)) { try { куски.push(['бой', CB.buildCombatHTML(d.combat, d, `c${i}_${s}`, true, {})]); новые.бой++; } catch (e) { ошибки.push(`${где}: бой — ${e.message}`); } }
      if (выгрузка.includes(`${i}:${s}`) || (выгрузка.includes(String(i)) && s === (m.swipe_id ?? 0))) for (const [что, h] of куски) {
        const РОДЫ = /<div class="(hud-duel hud-v[^"]*|hud-sclock[^"]*|hud-v hud-v-card hud-un-card[^"]*|hud-sgrid-wrap[^"]*|hud-body hud-life[^"]*|hud-body hud-cb[^"]*|hud-tempo [^"]*)"/g;
        for (const б of h.matchAll(РОДЫ)) console.log(`\n[${где} · ${что} · ${б[1].split(' ').slice(0, 3).join(' ')}]\n` + текстHtml(h.slice(б.index, б.index + 9000)).replace(/\s+/g, ' ').slice(0, 1600));
      }
      for (const [что, h] of куски) {
        const т = текстHtml(h);
        const мм = т.match(new RegExp('.{0,40}' + МУСОР.source + '.{0,40}', 'u'));
        if (мм) мусор.push(`${где}: ${что}: «${мм[0].replace(/\s+/g, ' ').trim()}»`);
        if (/hud-duel /.test(h)) новые.дуэль++;
        if (/hud-un-veil/.test(h)) новые.бельё++;
        if (/hud-sclock/.test(h)) новые.часы++;
        if (/hud-sgrid-wrap/.test(h)) новые.секреты++;
      }
      // Сводка темпа и x-ray по персонажам в близости.
      (Array.isArray(d.characters) ? d.characters : []).forEach((c, k) => {
        const фаза = полеИз(c, 'Фаза близости');
        if (!/^\s*[23]/.test(фаза)) return;
        const h = (куски.find(([что]) => что === 'персонаж ' + (c['Имя'] || k)) || [, ''])[1];
        const т = h.match(/<div class="hud-tempo ([^"]*)"/);
        const слово = (h.match(/hud-tempo-head"><b>Темп<\/b>(?:<span class="bpm"><strong>(\d+)<\/strong>)?/) || []);
        const заголовок = (h.match(/class="hud-xray-head[^"]*"[^>]*>([\s\S]{0,160}?)<\/(?:div|header)>/) || [])[1];
        темп.push({ где, кто: c['Имя'], фаза: фаза.slice(0, 40), класс: т ? т[1] : '(нет блока)', вМинуту: слово[1] || '', шапка: заголовок ? текстHtml(заголовок).replace(/\s+/g, ' ').trim() : '',
          поза: полеИз(c, 'Поза').slice(0, 120), nsfw: (полеИз(c, 'NSFW') || '').slice(0, 220), оргазм: полеИз(c, 'Готовность к оргазму').slice(0, 120) });
      });
    } finally { m.mes = былоMes; m.swipe_id = былоId; }
  }
}

console.log(`сообщений: ${чат.length}, ошибок: ${ошибки.length}, мусора: ${мусор.length}, ходов с близостью: ${темп.length}`);
console.log('новые блоки (сколько раз отрисованы):', JSON.stringify(новые));
if (ошибки.length) console.log('\n— ОШИБКИ\n' + ошибки.slice(0, 40).join('\n'));
if (мусор.length) console.log('\n— МУСОР В ТЕКСТЕ\n' + мусор.slice(0, 40).join('\n'));
if (вJson) fs.writeFileSync(вJson, JSON.stringify({ ошибки, мусор, темп, новые }, null, 1));
