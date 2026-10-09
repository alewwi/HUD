// Стенд вкладки «Бой» на примере (render/sample-hud.js, ПРИМЕР_БОЯ):
// node tests/tools/render-combat-stand.mjs → tests/tools/combat-stand.html
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { createElement: () => ({ style: {}, set textContent(x) { this.t = String(x); }, get innerHTML() { return String(this.t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); } }), querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {}, remove() {}, contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'Марк' }) };
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const CB = await import('file:///' + ROOT + 'render/combat.js?v=' + v);
const SH = await import('file:///' + ROOT + 'render/sample-hud.js?v=' + v);
const ход = { combat: { ...SH.ПРИМЕР_БОЯ, ch: 'dst: 35; to: к набережной; obs: толпа у метро; evt: перемахнул через ограду' },
  characters: [{ 'Имя': 'Марк Грей', 'Болезни и травмы': SH.ПРИМЕР_БОЯ_РАНЫ + ' | nm: ушиб рёбер; sg: stable; rc: 60%; sy: больно дышать; zn: правый бок', 'Инвентарь': 'пистолет: 4/8 патронов, под курткой; бита: треснула у рукояти' }] };
const погоня = CB.buildCombatHTML({ ...ход.combat, st: 'погоня' }, ход, 'b', true, { событияПогони: [{ д: 20, текст: 'подвернул ногу' }, { д: 50, текст: 'потерял из вида' }] });
const бой = CB.buildCombatHTML(ход.combat, ход, 'a', true, {});
const откат = CB.buildCombatHTML({ st: 'кончено', ad: 'Марк Грей: 80' }, ход, 'c', true, { конченоМинут: 25 });
const css = fs.readFileSync(ROOT + 'css/views.css', 'utf8') + fs.readFileSync(ROOT + 'css/combat.css', 'utf8');
const стиль = 'body{margin:0;padding:16px;background:#17131c;color:#e6e6ee;font:13px system-ui;--hud-accent:#d96a8a;--hud-text:#e6e6ee;--hud-text-muted:#a8a5ad;--hud-bg:#221c2a}.card{background:#221c2a;border-radius:12px;padding:12px;margin-bottom:16px}.hud-tab-content{display:block}';
const карточка = (з, ш, h) => `<h4>${з}</h4><div class="card" style="width:${ш}px">${h}</div>`;
fs.writeFileSync(ROOT + 'tests/tools/combat-stand.html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Бой — стенд</title><style>${стиль}${css}</style>`
  + карточка('Схватка, широкая карточка', 640, бой) + карточка('Погоня, телефон', 380, погоня) + карточка('Кончено, 25 минут спустя', 380, откат));
console.log('стенд боя:', ROOT + 'tests/tools/combat-stand.html');
