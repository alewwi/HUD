// Стенд визуальной проверки x-ray: собирает HTML с панелью и сохраняет.
// Запуск: node tests/tools/render-stand.mjs
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

const ST = await import('file:///' + ROOT + 'settings.js?v=' + v);
ST.settings.tempoView = 'xray';
const ровно = { уровень: 2, слово: 'ритмично', вМинуту: 75, глубина: 'deep', рвано: false, сек: .8 };
const быстро = { уровень: 3, слово: 'быстро', вМинуту: 120, глубина: '', рвано: false, сек: .5 };
const рвано = { уровень: 4, слово: 'неистово', вМинуту: 165, глубина: 'deep', рвано: true, сек: .364 };
const медленно = { уровень: 1, слово: 'медленно', вМинуту: 40, глубина: 'shallow', рвано: false, сек: 1.5 };
const замер = { уровень: 0, слово: 'замерли', вМинуту: 0, глубина: 'deep', рвано: false, сек: 0 };
const п = (чем, куда) => ({ чем, куда, чемИмя: '', кудаИмя: '', даёт: false });
const ч = (t) => SB.членИзТекста(t);
const случаи = [
  ['член 18 см → лоно, ритмично до упора', ровно, [п('penis', 'vaginal')], 'f', ч('pn: каменная эрекция, около 18 см')],
  ['член 13 см, тонкий → лоно, медленно', медленно, [п('penis', 'vaginal')], 'f', ч('pn: тонкий, 13 см')],
  ['пальцы → лоно', быстро, [п('fingers', 'vaginal')], 'f', null],
  ['язык → лоно', медленно, [п('tongue', 'vaginal')], 'f', null],
  ['член огромный, толстый → сзади (м), рвано', рвано, [п('penis', 'anal')], 'm', ч('pn: огромный, толстый')],
  ['игрушка → сзади (ж), быстро', быстро, [п('toy', 'anal')], 'f', null],
  ['член 20 см → рот, до упора', ровно, [п('penis', 'oral')], 'f', ч('pn: 20 см')],
  ['кулак → лоно, медленно', медленно, [п('fist', 'vaginal')], 'f', null],
  ['лоно, течёт (lb: очень влажно)', быстро, [п('penis', 'vaginal')], 'f', ч('pn: 16 см'), null, SB.влагаИзТекста('lb: течёт так, что бёдра блестят')],
  ['пальцы, мокро', медленно, [п('fingers', 'vaginal')], 'f', null, null, SB.влагаИзТекста('lb: мокрая, скользко')],
  ['игрушка сзади со смазкой', быстро, [п('toy', 'anal')], 'f', null, null, SB.влагаИзТекста('tch: смазал попку лубрикантом')],
  ['кончил внутрь → лоно', замер, [п('penis', 'vaginal')], 'f', ч('pn: 17 см'), SB.семяИзТекста('он кончил в неё, глубоко')],
  ['кончил в рот', замер, [п('penis', 'oral')], 'f', null, SB.семяИзТекста('кончил ей в рот')],
];
const панели = случаи.map(([имя, т, сп, пол, член, семя, влага], i) => `<div class="case" id="s${i}"><h4>${i + 1}. ${имя}</h4><div>${SB.блокТемпа(т, { проникн: сп, пол, член, семя, влага }).replace('class="hud-tempo ', 'class="hud-tempo fx-on ')}</div></div>`).join('');
// Кнопки сцен: по нажатию — одна сцена крупно, «Все» — список. Без JS видны
// все сцены подряд, а кнопки работают как ссылки-якоря.
const кнопки = `<a href="#" class="nav is-on" data-i="all">Все</a>` + случаи.map(([имя], i) => `<a href="#s${i}" class="nav" data-i="${i}">${i + 1}. ${имя.split(',')[0]}</a>`).join('')
  + `<button type="button" class="nav is-play" id="play">⏸ Пауза (как в покое в ST)</button>`;
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>X-ray стенд</title><style>
:root { --hud-nsfw-color: #d9548a; }
body { background: #14111a; color: #cfc6dc; font: 14px/1.4 system-ui; margin: 0; padding: 0 16px 22px; }
h3 { color: #b9a8cf; margin: 14px 0 10px; }
h4 { margin: 0 0 8px; font-weight: 600; color: #9c8fb3; font-size: 13px; }
.bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0; background: #14111a; border-bottom: 1px solid #2e2740; margin-bottom: 14px; }
.nav { font: 600 12px/1 system-ui; color: #cfc6dc; text-decoration: none; padding: 6px 10px; border-radius: 999px; background: #221c2e; border: 1px solid #3a3150; cursor: pointer; }
.nav.is-on { background: #d9548a; border-color: #d9548a; color: #fff; }
.nav.is-play { margin-left: auto; }
.grid { display: flex; flex-wrap: wrap; gap: 18px; }
.case { width: min(480px, 100%); box-sizing: border-box; border: 1px solid #2e2740; border-radius: 12px; padding: 12px; background: #191524; }
body.solo .case { display: none; }
body.solo .case.is-on { display: block; width: min(960px, 100%); }
body.solo .xr-film, body.solo .xr-wave { max-width: none; }
${css}
body:not(.rest) .hud-tempo, body:not(.rest) .hud-tempo .xr-wave-run { animation-play-state: running !important; }
</style></head><body>
<h3>X-ray пенетрации — стенд (${случаи.length} сцен)</h3>
<div class="bar">${кнопки}</div>
<div class="grid">${панели}</div>
<script>
document.querySelectorAll('a.nav').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  const i = a.dataset.i;
  document.querySelectorAll('a.nav').forEach(x => x.classList.toggle('is-on', x === a));
  document.body.classList.toggle('solo', i !== 'all');
  document.querySelectorAll('.case').forEach(c => c.classList.toggle('is-on', c.id === 's' + i));
  window.scrollTo(0, 0);
}));
const play = document.getElementById('play');
play.addEventListener('click', () => {
  const покой = document.body.classList.toggle('rest');
  document.querySelectorAll('.hud-tempo').forEach(t => t.classList.toggle('fx-on', !покой));
  play.textContent = покой ? '▶ Играть' : '⏸ Пауза (как в покое в ST)';
});
</script>
</body></html>`;
fs.writeFileSync(ROOT + 'tests/tools/stand.html', page);
console.log('стенд:', ROOT + 'tests/tools/stand.html');
