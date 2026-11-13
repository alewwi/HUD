// hud-manager/tests/family-uncle.mjs
//
// «Дядя» в генеалогическом дереве: брат одного из родителей. Родства в HUD нет —
// спрашиваем игрока, чей он брат, и помним ответ. Друг семьи, которого дети зовут
// дядей, не становится братом матери и не утаскивает её в чужую ветку.
// node tests/family-uncle.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, set textContent(x) { t = String(x); }, get innerHTML() { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, querySelector: () => null, querySelectorAll: () => [] }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), getElementById: () => null };
globalThis.SillyTavern = { getContext: () => ({ chat: [] }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const { buildFamilyTree } = await import('file:///' + path.join(КОРЕНЬ, 'render/family-tree.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

let всего = 0, провалов = 0;
const проверить = (что, ок) => { всего++; if (!ок) { провалов++; console.log('✗', что); } else console.log('✓', что); };
const ветки = (д) => [...д.svg.matchAll(/class="hud-fam-branch"[^>]*>([^<]*)</g)].map(m => m[1]);
const ряд = (д, id) => д.positions[id] && д.positions[id].y;
// Под общей шиной братьев и сестёр: вертикаль шины опускается к середине карточки.
const подШиной = (д, a, b) => {
  const w = Number((д.svg.match(/class="hud-fam-card"[^>]*width="(\d+)"/) || [])[1]);
  const ц = (id) => 'M' + (д.positions[id].x + w / 2).toFixed(1) + ' ';
  return [...д.svg.matchAll(/class="hud-fam-link is-siblings" d="([^"]*)"/g)].some(m => m[1].includes(ц(a)) && m[1].includes(ц(b)));
};

// Мать и отец не женаты, дети записаны на мать. Близнецы — деловые партнёры
// отца; дети зовут одного «дядей», другой зовёт дочь «племянницей».
const люди = [
  { id: 'мать', name: 'Нора Вейл', isUser: true },
  { id: 'отец', name: 'SAGA  Джулиан Крейн', isPrimary: true },
  { id: 'сын', name: 'Тео Вейл' }, { id: 'дочь', name: 'Ида Вейл' },
  { id: 'б1', name: 'Марк Олдридж' }, { id: 'б2', name: 'Лукас Олдридж' },
  { id: 'жена1', name: 'Селия Олдридж' },
];
const связи = [
  { from: 'мать', to: 'дочь', label: 'горячо любимая дочь' },
  { from: 'отец', to: 'сын', label: 'родной сын' },
  { from: 'сын', to: 'мать', label: 'мама' },
  { from: 'дочь', to: 'отец', label: 'неизвестный ей отец' },
  { from: 'сын', to: 'дочь', label: 'сестра-близнец' },
  { from: 'б1', to: 'б2', label: 'брат-близнец' }, { from: 'б2', to: 'б1', label: 'брат-близнец' },
  { from: 'б1', to: 'жена1', label: 'жена' },
  { from: 'мать', to: 'б2', label: 'младший близнец' },
  { from: 'отец', to: 'б1', label: 'старший близнец и деловой партнёр' },
  { from: 'дочь', to: 'б1', label: 'строгий дядя' },
  { from: 'б2', to: 'дочь', label: 'ледяная маленькая племянница' },
];
const д = buildFamilyTree(люди, связи, 'т');
const вет = ветки(д);
проверить('друг семьи — отдельной веткой, а не братом матери', вет.length === 2);
проверить('ветка семьи названа фамилией главного персонажа первой', вет[0] === 'Крейн · Вейл');
проверить('близнецы — в своей ветке', вет[1] === 'Олдридж');
проверить('мать — над детьми, близнецы — не в её ряду', ряд(д, 'мать') < ряд(д, 'сын') && ряд(д, 'б1') > ряд(д, 'сын'));
проверить('про близнецов — один вопрос, а не два', д.вопросы.length === 1);
const в = д.вопросы[0] || {};
проверить('вопрос: кто кого как назвал', в.говорит === 'Ида Вейл' && в.оКом === 'Марк Олдридж' && в.подпись === 'строгий дядя');
проверить('вопрос: на выбор — родители ребёнка', в.родители && в.родители.length === 2 && в.родители.includes('Нора Вейл') && в.родители.includes('SAGA  Джулиан Крейн'));
проверить('вопрос: оба родителя знают его не братом — совет «не родня»', в.совет === '' && в.пол === 'м');

// Мать знает только второго близнеца — первый ей всё равно не брат.
const д1б = buildFamilyTree(люди, связи.filter(e => !(e.from === 'мать' && e.to === 'б2')).concat([{ from: 'мать', to: 'б2', label: 'партнёр Джулиана' }]), 'т1б');
проверить('близнецы — пара: не брат одному, не брат и другому', ветки(д1б).length === 2 && д1б.вопросы[0].совет === '');

// Ответ «не родня» — вопроса больше нет, и про второго близнеца тоже.
const нет = buildFamilyTree(люди, связи, 'т', { дяди: [{ имя: 'Марк Олдридж', нет: true }] });
проверить('«не родня»: вопрос не задаётся, близнецы — своей веткой', !нет.вопросы.length && ветки(нет).length === 2);

// Ответ «брат отца» — близнецы в семье, вопроса нет, даже без слова «дядя».
const брат = buildFamilyTree(люди, связи, 'т', { дяди: [{ имя: 'Марк', родня: 'Джулиан Крейн' }] });
проверить('«брат отца»: одно дерево, вопроса нет', !брат.вопросы.length && ветки(брат).length === 1);
проверить('«брат отца»: под одной шиной с отцом и со своим близнецом', подШиной(брат, 'б1', 'отец') && подШиной(брат, 'б2', 'отец') && !подШиной(брат, 'б1', 'мать'));
const безСлова = buildFamilyTree(люди, связи.filter(e => !/дядя|племянн/.test(e.label)), 'т', { дяди: [{ имя: 'Марк Олдридж', родня: 'Джулиан Крейн' }] });
проверить('ответ помнится, даже когда модель больше не пишет «дядя»', ветки(безСлова).length === 1 && подШиной(безСлова, 'б1', 'отец'));

// Отец о дяде молчит, мать зовёт другом — спрашиваем, совет — отец.
const д2 = buildFamilyTree([
  { id: 'мать', name: 'Нора Вейл', isUser: true }, { id: 'отец', name: 'Джулиан Крейн', isPrimary: true },
  { id: 'сын', name: 'Тео Крейн' }, { id: 'дядя', name: 'Адам Крейн' },
], [
  { from: 'мать', to: 'отец', label: 'муж' },
  { from: 'мать', to: 'сын', label: 'сын' },
  { from: 'отец', to: 'сын', label: 'сын' },
  { from: 'мать', to: 'дядя', label: 'старый друг' },
  { from: 'сын', to: 'дядя', label: 'дядя' },
], 'т2');
проверить('без ответа дядя в дерево не вписан', !подШиной(д2, 'дядя', 'отец') && д2.вопросы.length === 1);
проверить('совет — тот родитель, кто не знает его иначе', д2.вопросы[0].совет === 'Джулиан Крейн');

// Оба молчат — совет по фамилии.
const д3 = buildFamilyTree([
  { id: 'мать', name: 'Нора Вейл' }, { id: 'отец', name: 'Джулиан Крейн' },
  { id: 'дочь', name: 'Ида' }, { id: 'тётя', name: 'Пола Вейл' },
], [
  { from: 'дочь', to: 'отец', label: 'отец' }, { from: 'дочь', to: 'мать', label: 'мать' },
  { from: 'мать', to: 'отец', label: 'муж' },
  { from: 'дочь', to: 'тётя', label: 'тётя' },
], 'т3');
проверить('совет по фамилии, тётя — «она»', д3.вопросы[0] && д3.вопросы[0].совет === 'Нора Вейл' && д3.вопросы[0].пол === 'ж');

// Родство в HUD есть — не спрашиваем.
const д5 = buildFamilyTree([
  { id: 'мать', name: 'Нора Вейл' }, { id: 'дочь', name: 'Ида' }, { id: 'дядя', name: 'Пол Вейл' },
], [
  { from: 'дочь', to: 'мать', label: 'мать' }, { from: 'мать', to: 'дядя', label: 'брат' }, { from: 'дочь', to: 'дядя', label: 'дядя' },
], 'т5');
проверить('брат матери записан — вопроса нет', !д5.вопросы.length && подШиной(д5, 'дядя', 'мать'));

// Родителей не знаем — звено «?», как раньше, без вопроса.
const д4 = buildFamilyTree([{ id: 'а', name: 'Ида' }, { id: 'б', name: 'Пол' }], [{ from: 'а', to: 'б', label: 'дядя' }], 'т4');
проверить('родители неизвестны — неизвестное звено, без вопроса', /is-unknown/.test(д4.svg) && !д4.вопросы.length);

// Хранилище ответов — в метаданных чата.
const мета = {};
let сохранений = 0;
globalThis.SillyTavern = { getContext: () => ({ chatMetadata: мета, saveMetadataDebounced: () => { сохранений++; } }) };
const А = await import('file:///' + path.join(КОРЕНЬ, 'render/family-asks.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
А.ответитьПроДядю('Марк Олдридж', 'Джулиан Крейн');
А.ответитьПроДядю('Адам', '');
const все = А.ответыПроДядей();
проверить('ответы сохраняются в чате', все.length === 2 && все.some(о => о.родня === 'Джулиан Крейн') && все.some(о => о.имя === 'Адам' && о.нет) && сохранений === 2);
проверить('ответ можно забыть', А.забытьПроДядю('марк олдридж') && А.ответыПроДядей().length === 1);

// Плашка вопроса над деревом.
const RG = await import('file:///' + path.join(КОРЕНЬ, 'render/relations-graph.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
const код = fs.readFileSync(path.join(КОРЕНЬ, 'render/relations-graph.js'), 'utf8');
проверить('граф передаёт ответы чата в дерево', /buildFamilyTree\(родня\.nodes, родня\.edges, markerBase, \{ дяди: ответыПроДядей\(\) \}\)/.test(код));
проверить('плашка с кнопками родителей и «Не родня»', /data-fam-kin=/.test(код) && /'Не родня'/.test(код) && typeof RG.buildRelGraphHTML === 'function');
const главный = fs.readFileSync(path.join(КОРЕНЬ, 'index.js'), 'utf8');
проверить('ответ по кнопке пишется и дерево открывается снова', /ответитьПроДядю\(имя, родня\)/.test(главный) && /data-rel-mode="family"/.test(главный));

// Английский: прилагательные перед родством — без примет, но это всё ещё родство.
const { родствоИз } = await import('file:///' + path.join(КОРЕНЬ, 'render/family-tree.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
for (const [s, тип] of [['strict uncle who kicked the guards out', 'uncle'], ['icy little niece', 'nephew'], ['protective older brother', 'sibling'], ['dead brother', 'sibling'], ['beloved aunt', 'uncle']])
  проверить(`по-английски «${s}» — родство`, (родствоИз(s) || {}).тип === тип);
for (const s of ['called uncle by the kids', 'like an uncle to her', "best friend's uncle", 'hates her father', 'sleeping with her sister', 'honorary aunt', 'family friend'])
  проверить(`по-английски «${s}» — не родство`, родствоИз(s) === null);

// Английские записи и «Детская»: «дядя» из записей малышей тоже спрашивается.
const англ = buildFamilyTree([
  { id: 'nora', name: 'Nora Vale', isUser: true }, { id: 'julian', name: 'Julian Crane', isPrimary: true },
  { id: 'ida', name: 'Ida' }, { id: 'mark', name: 'Mark Aldridge' }, { id: 'lucas', name: 'Lucas Aldridge' },
], [
  { from: 'nora', to: 'ida', label: 'daughter' }, { from: 'ida', to: 'julian', label: 'dad' },
  { from: 'mark', to: 'lucas', label: 'twin brother' }, { from: 'lucas', to: 'mark', label: 'twin brother' },
  { from: 'julian', to: 'mark', label: 'older twin and business partner' },
  { from: 'ida', to: 'mark', label: 'strict uncle' }, { from: 'lucas', to: 'ida', label: 'icy little niece' },
], 'en');
проверить('по-английски: один вопрос про близнецов, родители на выбор', англ.вопросы.length === 1 && англ.вопросы[0].родители.length === 2 && англ.вопросы[0].пол === 'м');
проверить('по-английски: без ответа близнецы — своей веткой', ветки(англ).length === 2);

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
