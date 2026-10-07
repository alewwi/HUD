// Крупный стенд одного случая — для разглядывания деталей.
// Запуск: node tests/render-zoom.mjs [чем] [куда]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { createElement: () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {} }, set textContent(x) {}, get innerHTML() { return ''; } }), querySelector: () => null, querySelectorAll: () => [] };
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const SB = await import('file:///' + ROOT + 'render/scene-body.js?v=' + v);
const css = fs.readFileSync(ROOT + 'css/scene-body.css', 'utf8') + '\n' + fs.readFileSync(ROOT + 'css/xray.css', 'utf8');

const чем = process.argv[2] || 'penis';
const куда = process.argv[3] || 'vaginal';
const т = { уровень: 2, слово: 'ритмично', вМинуту: 75, глубина: 'deep', рвано: false, сек: .8 };
const панель = SB.xrayПенетрации([{ чем, чемИмя: чем, куда, кудаИмя: куда, даёт: false }], т, 'zoom', { пол: process.env.XR_POL || 'f' });
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
:root { --hud-nsfw-color: #d9548a; }
body { background: #0d0b12; color: #cfc6dc; font: 14px/1.4 system-ui; margin: 0; padding: 18px; }
${css}
.xr-film { width: 760px !important; }
.hud-xray-side { font-size: 15px; }
</style></head><body>
<div class="fx-on">${панель}</div>
<script>if(location.search.includes('crop')){const s=document.querySelector('.xr-film');const p=new URLSearchParams(location.search).get('crop');if(s&&p)s.setAttribute('viewBox',p);}</script>
</body></html>`;
fs.writeFileSync(ROOT + 'tests/tools/zoom.html', page);
console.log('зум:', ROOT + 'tests/tools/zoom.html', чем, '→', куда);
