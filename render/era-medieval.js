// hud-manager/render/era-medieval.js
//
// Эпоха «Средневековье»: выбранный вид блока остаётся тем же видом, но в
// обличье эпохи. Батарейки становятся свечами, удостоверение — записью о
// рождении, линия метро — дорожным указателем, светофор — фонарями, билеты —
// часословом и т. д. Данные те же: модель ничего нового не пишет.
//
// Как устроено: обычные сборщики видов рисуют свою разметку, а здесь она
// пересобирается по месту — из того, что уже на экране. Наблюдатель ловит
// каждую вставку (карточка, ленивая вкладка, окно кастомизации), поэтому
// сборщики видов про эпоху не знают. Вид — css/era-medieval.css; цвета
// выводятся из темы, своя тема получает свой пергамент.
//
// Текст модели в новую разметку идёт только через escapeHtml.

import { escapeHtml } from '../utils.js?v=23.89.8';
import { settings } from '../settings.js?v=23.89.8';
import { английский } from '../i18n.js?v=23.89.8';

const включено = () => settings.era === 'medieval';
let счёт = 0;
const id = (п) => `hud-era-${п}-${(++счёт).toString(36)}`;
const текст = (e) => (e?.textContent || '').replace(/​/g, '').replace(/\s+/g, ' ').trim();
const э = (s) => escapeHtml(текст({ textContent: s }));
const блок = (класс, html) => Object.assign(document.createElement('div'), { className: класс, innerHTML: html });
const урл = (u) => String(u || '').replace(/["'()\\\s]/g, (c) => encodeURIComponent(c));

// Карточка, к которой относится узел: фото и буква владельца вкладки.
function владелец(узел) {
  const вкладка = узел.closest('.hud-tab-content') || узел.closest('.hud-os-card');
  const фото = вкладка?.querySelector('img.hud-avatar')?.getAttribute('src') || '';
  const имя = текст(вкладка?.querySelector('.hud-title'));
  return { фото, буква: (имя.match(/\p{L}/u) || ['✠'])[0].toUpperCase() };
}

// Часы службы вместо циферблата: «к заутрене», «к повечерию».
const кЧасу = (ч) => ч < 3 ? 'к полунощнице' : ч < 6 ? 'к заутрене' : ч < 9 ? 'к первому часу' : ч < 12 ? 'к третьему часу' : ч < 15 ? 'к шестому часу' : ч < 18 ? 'к девятому часу' : ч < 21 ? 'к вечерне' : 'к повечерию';
const часСлужбы = (ч) => ч < 3 ? 'полунощница' : ч < 6 ? 'заутреня' : ч < 9 ? 'первый час' : ч < 12 ? 'третий час' : ч < 15 ? 'шестой час' : ч < 18 ? 'девятый час' : ч < 21 ? 'вечерня' : 'повечерие';
const РИМ = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/* ------------------------------ рисунки --------------------------------- */

// Восковая печать: неровный край, вдавленное кольцо, знак с тиснением, блик.
function печать(знак) {
  const g = id('wax'), pts = [];
  for (let a = 0; a < 360; a += 8) { const r = 27 + 1.5 * Math.sin(a * Math.PI / 36) + .9 * Math.sin(a * Math.PI / 13 + 1); pts.push(`${(r * Math.cos(a * Math.PI / 180)).toFixed(1)},${(r * Math.sin(a * Math.PI / 180)).toFixed(1)}`); }
  const з = escapeHtml(знак);
  return `<svg viewBox="-32 -32 64 64" aria-hidden="true"><defs><radialGradient id="${g}" cx="38%" cy="32%" r="75%"><stop offset="0" style="stop-color:var(--e-wax-hi)"/><stop offset=".5" style="stop-color:var(--e-wax)"/><stop offset="1" style="stop-color:var(--e-wax-lo)"/></radialGradient></defs>`
    + `<polygon points="${pts.join(' ')}" fill="url(#${g})"/><circle r="19.5" fill="none" style="stroke:var(--e-wax-lo)" stroke-width="2.6"/><circle r="17.6" fill="none" style="stroke:var(--e-wax-hi)" stroke-width=".8" opacity=".55"/>`
    + `<circle r="21.4" fill="none" style="stroke:var(--e-wax-hi)" stroke-width=".6" opacity=".35" stroke-dasharray="1.2 2"/>`
    + `<text y="6.8" text-anchor="middle" font-size="19" style="font-family:var(--fh);fill:var(--e-wax-hi)" opacity=".5" transform="translate(.6 .7)">${з}</text><text y="6.8" text-anchor="middle" font-size="19" style="font-family:var(--fh);fill:var(--e-wax-lo)">${з}</text>`
    + `<ellipse cx="-10" cy="-13" rx="9" ry="4.5" fill="#fff" opacity=".22" transform="rotate(-32 -10 -13)"/></svg>`;
}
const ТРЕЩИНА = '<svg class="crack" viewBox="-32 -32 64 64" aria-hidden="true"><path d="M-6-27l3 9-5 7 6 6-4 9 5 8-2 15" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.6" stroke-linejoin="round"/><path d="M-5-27l3 9-5 7 6 6-4 9 5 8-2 15" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".7"/></svg>';
// Разделитель с ромбом и завитками.
const ЧЕРТА = '<svg class="rule" viewBox="0 0 220 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 5H92M128 5H218" stroke="currentColor" stroke-width=".8"/><path d="M92 5c4-5 8-5 10 0-2 5-6 5-10 0zM128 5c-4-5-8-5-10 0 2 5 6 5 10 0z" fill="none" stroke="currentColor" stroke-width=".8"/><path d="M110 1l4 4-4 4-4-4z" fill="currentColor"/></svg>';
const ЛУНА = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M18 3a11 11 0 1 0 7 17A9 9 0 0 1 18 3z" fill="#f6e7b6"/><circle cx="13" cy="14" r="1.6" fill="#d9c58d"/><circle cx="17" cy="20" r="1" fill="#d9c58d"/></svg>';
const РОСПИСЬ = '<svg viewBox="0 0 92 22" aria-hidden="true"><path d="M2 16c6-10 9-12 10-8s-4 9-2 9 6-12 9-11-2 9 0 9 4-6 6-6 1 5 3 5 5-8 8-8-1 7 1 7 8-3 14-4 22-2 33-3" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".75"/></svg>';
// Фигура для листа лекаря — строго симметричная (правая половина зеркалится).
const ФИГУРА = 'M55 22C56.3 22.6 55.3 24.5 57 25.5C58.7 26.5 62.3 27 65 28C67.7 29 69.7 29.3 73 31.5C76.3 33.8 83.3 39.3 85 41.5C86.8 43.8 85.7 45.6 83.5 45C81.3 44.4 75.2 39.5 72 38C68.8 36.5 66 34.5 64.5 36C63 37.5 63.5 43.3 63 47C62.5 50.7 61.3 54.2 61.5 58C61.7 61.8 63.7 65.7 64 70C64.3 74.3 64 78.3 63.5 84C63 89.7 61.7 98.5 61.2 104C60.7 109.5 60 114.1 60.6 117C61.2 119.9 65.4 120.8 64.6 121.5C63.8 122.3 57.2 124.4 55.6 121.5C54 118.6 55.4 110.3 55.2 104C55 97.8 54.7 88.5 54.2 84C53.7 79.5 52.7 77 52 77C51.3 77 50.3 79.5 49.8 84C49.3 88.5 49 97.8 48.8 104C48.6 110.3 50 118.6 48.4 121.5C46.8 124.4 40.2 122.3 39.4 121.5C38.6 120.8 42.8 119.9 43.4 117C44 114.1 43.3 109.5 42.8 104C42.3 98.5 41 89.7 40.5 84C40 78.3 39.7 74.3 40 70C40.3 65.7 42.3 61.8 42.5 58C42.7 54.2 41.5 50.7 41 47C40.5 43.3 41 37.5 39.5 36C38 34.5 35.2 36.5 32 38C28.8 39.5 22.7 44.4 20.5 45C18.3 45.6 17.3 43.8 19 41.5C20.8 39.3 27.7 33.8 31 31.5C34.3 29.3 36.3 29 39 28C41.7 27 45.3 26.5 47 25.5C48.7 24.5 47.7 22.6 49 22C50.3 21.4 53.7 21.4 55 22Z M52 4.5a8.6 9 0 1 0 .01 0z';

// Свеча: высота воска — уровень, пламя слабеет на исходе, над слабой — дымок.
function свеча(v, имя, сост, красная) {
  const gb = id('cw'), gf = id('cf'), gh = id('ch'), gd = id('cd');
  v = Math.max(0, Math.min(100, v));
  const h = 10 + v * .5, y = 79 - h, s = v <= 30 ? .78 : 1;
  const стиль = красная ? '--e-wax:var(--ink-red)' : '--e-wax:color-mix(in oklab, var(--parch) 30%, #f3e7c9)';
  return `<figure class="${красная ? 'is-red' : ''}" style="${стиль}"><svg viewBox="0 0 48 96" aria-hidden="true"><defs>`
    + `<linearGradient id="${gb}" x1="0" x2="1"><stop offset="0" style="stop-color:color-mix(in oklab, var(--e-wax) 70%, #000)"/><stop offset=".32" style="stop-color:color-mix(in oklab, var(--e-wax) 75%, #fff)"/><stop offset=".72" style="stop-color:var(--e-wax)"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--e-wax) 62%, #000)"/></linearGradient>`
    + `<linearGradient id="${gf}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a12"/><stop offset=".45" stop-color="#ffc443"/><stop offset="1" stop-color="#fff7dc"/></linearGradient>`
    + `<radialGradient id="${gh}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="${gd}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--e-gold-lo)"/><stop offset=".4" style="stop-color:var(--e-gold-hi)"/><stop offset="1" style="stop-color:var(--e-gold-lo)"/></linearGradient></defs>`
    + `<circle class="halo" cx="24" cy="${y - 10}" r="${15 * s}" fill="url(#${gh})"/>${v <= 30 ? `<path class="smoke" d="M24 ${y - 18}c-2-3 2-5 0-8s2-5 0-8"/>` : ''}`
    + `<ellipse cx="24" cy="89" rx="19" ry="4.6" fill="url(#${gd})"/><ellipse cx="24" cy="88" rx="19" ry="3.8" fill="none" style="stroke:var(--e-gold-hi)" stroke-width=".6" opacity=".7"/>`
    + `<rect x="20.5" y="80" width="7" height="8" fill="url(#${gd})"/><ellipse cx="24" cy="80.5" rx="11" ry="2.8" fill="url(#${gd})"/>`
    + `<path d="M33.5 84q4.5-1 5.5 2.4" fill="none" style="stroke:var(--e-gold-lo)" stroke-width="1.6" stroke-linecap="round"/>`
    + `<rect x="16" y="${y}" width="16" height="${h}" fill="url(#${gb})"/><ellipse cx="24" cy="${y}" rx="8" ry="2.2" style="fill:color-mix(in oklab, var(--e-wax) 70%, #fff)"/>`
    + `<path d="M17 ${y + .5}q-1.6 6 .2 ${7 + v * .05}q1.4-.2 1.2-3q-.3-2 .2-4z" fill="url(#${gb})"/><path d="M29.5 ${y + 1}q1.4 3-.2 ${4 + v * .04}q-1 .2-.8-2z" fill="url(#${gb})"/>`
    + `<path d="M24 ${y - .2}q.8-2 -.4-3.6" fill="none" stroke="#2a1a10" stroke-width="1.1" stroke-linecap="round"/>`
    + `<g transform="translate(24 ${y - 3.2}) scale(${s})"><g class="flame"><path d="M0 0c-5-2.6-5.2-8.6 0-15.5c5.2 6.9 5 12.9 0 15.5z" fill="url(#${gf})"/><ellipse cx="0" cy="-2.2" rx="1.6" ry="2.4" fill="#8fc4ff" opacity=".8"/></g></g>`
    + `</svg><b>${v}</b><span class="nm">${escapeHtml(имя)}</span><span class="st">${escapeHtml(сост)}</span></figure>`;
}

// Кованый фонарь: чем больше доверия, тем ярче огонь.
function фонарь(имя, лаб, v) {
  const gg = id('lg'), gf = id('lf'), gi = id('li');
  v = Math.max(0, Math.min(100, v));
  const k = v / 100;
  return `<div class="p sheet" style="--v:${v}"><svg viewBox="0 0 40 64" aria-hidden="true"><defs>`
    + `<radialGradient id="${gg}" cx="50%" cy="58%" r="60%"><stop offset="0" stop-color="#fff2c2" stop-opacity="${(.35 + k * .65).toFixed(2)}"/><stop offset=".55" stop-color="#ffb84a" stop-opacity="${(.2 + k * .6).toFixed(2)}"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--parch-2) 60%, #000)" stop-opacity=".9"/></radialGradient>`
    + `<linearGradient id="${gf}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a12"/><stop offset=".5" stop-color="#ffc443"/><stop offset="1" stop-color="#fff7dc"/></linearGradient>`
    + `<linearGradient id="${gi}" x1="0" x2="1"><stop offset="0" style="stop-color:color-mix(in oklab, var(--e-iron) 60%, #000)"/><stop offset=".45" style="stop-color:color-mix(in oklab, var(--e-iron) 70%, #fff)"/><stop offset="1" style="stop-color:color-mix(in oklab, var(--e-iron) 55%, #000)"/></linearGradient></defs>`
    + `<circle cx="20" cy="4.5" r="3.4" fill="none" style="stroke:var(--e-iron)" stroke-width="1.6"/>`
    + `<path d="M20 8v3M9 18l11-7 11 7z" fill="url(#${gi})" style="stroke:color-mix(in oklab, var(--e-iron) 60%, #000)" stroke-width=".8" stroke-linejoin="round"/>`
    + `<rect x="9.5" y="18" width="21" height="31" rx="1.5" fill="url(#${gg})"/>`
    + `<g transform="translate(20 ${41 - k * 2})" opacity="${(.45 + k * .55).toFixed(2)}"><g class="fl"><path d="M0 0c-3.4-1.8-3.5-6 0-10.5c3.5 4.5 3.4 8.7 0 10.5z" fill="url(#${gf})" transform="scale(${(.75 + k * .35).toFixed(2)})"/></g></g>`
    + `<rect x="18.6" y="42" width="2.8" height="5" style="fill:color-mix(in oklab, var(--parch) 70%, #fff)"/>`
    + `<path d="M9.5 18h21v31h-21zM16.5 18v31M23.5 18v31M9.5 33.5h21" fill="none" style="stroke:var(--e-iron)" stroke-width="1.3"/>`
    + `<path d="M7 49h26l-3 5H10z" fill="url(#${gi})"/><path d="M12 54v3M28 54v3" style="stroke:var(--e-iron)" stroke-width="1.8" stroke-linecap="round"/>`
    + `</svg><div><span class="who">${escapeHtml(имя)}</span><span class="lab">${escapeHtml(лаб)}</span></div><b class="num">${v}<span>из ста</span></b></div>`;
}

function колокол() {
  const g = id('bl');
  return `<svg viewBox="0 0 26 30" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--e-gold-lo)"/><stop offset=".38" style="stop-color:var(--e-gold-hi)"/><stop offset="1" style="stop-color:var(--e-gold-lo)"/></linearGradient></defs>`
    + `<path d="M13 1.5v3" style="stroke:var(--e-iron)" stroke-width="1.6" stroke-linecap="round"/><path d="M13 4.5c-5 0-7 3.8-7 8.5v5.5L3 23h20l-3-4.5V13c0-4.7-2-8.5-7-8.5z" fill="url(#${g})"/><path d="M3 23h20" style="stroke:var(--e-gold-lo)" stroke-width="1.4"/><circle cx="13" cy="26" r="2.3" style="fill:var(--e-gold-lo)"/><path d="M9 8.5c-1 1.5-1.4 3.4-1.4 5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linecap="round"/></svg>`;
}
function капля() {
  const g = id('dr');
  return `<svg viewBox="0 0 7 10" aria-hidden="true"><defs><radialGradient id="${g}" cx="35%" cy="55%"><stop offset="0" style="stop-color:color-mix(in oklab, var(--e-rubric) 50%, #fff)"/><stop offset="1" style="stop-color:var(--e-rubric)"/></radialGradient></defs><path d="M3.5 0C2 3 0 5 0 6.6A3.5 3.4 0 0 0 7 6.6C7 5 5 3 3.5 0z" fill="url(#${g})"/></svg>`;
}

/* ------------------------------ виды ------------------------------------ */

// Тело: свечи вместо батареек.
// В английском «Тревога» уже занята словарём под «Alert» — своё слово.
const ИМЕНА_СВЕЧ = { 'Энергия': 'Силы', 'Стресс': 'Тревога' };
const ИМЕНА_СВЕЧ_EN = { 'Энергия': 'Strength', 'Energy': 'Strength', 'Стресс': 'Unease', 'Stress': 'Unease' };
function тело(bs) {
  const свечи = [...bs.querySelectorAll('.hud-bs-cell')].map((c) => {
    const имя = текст(c.querySelector('small'));
    return свеча(parseInt(текст(c.querySelector('b')), 10) || 0, (английский() ? ИМЕНА_СВЕЧ_EN : ИМЕНА_СВЕЧ)[имя] || имя, текст(c.querySelector('em')), /стресс|тревог|каприз|stress|fuss/i.test(имя));
  }).join('');
  const сон = bs.querySelector('.hud-bs-sleep');
  let ночь = '';
  if (сон) {
    const [голова, ...хвост] = текст(сон.querySelector('b')).split(/,\s*/);
    const легла = хвост.join(', ').replace(/(легл[аи]|лёг|лег)\s+в\s+(\d{1,2}):(\d{2})/, (_, г, ч, м) => `${г} ${кЧасу(+ч)}, в ${ч}:${м}`);
    ночь = `<div class="night">${ЛУНА}<div><b>${э(голова)}</b><span>${э(легла || текст(сон.querySelector('small')))}</span></div></div>`;
  }
  const работа = текст(bs.querySelector('.hud-bs-work'));
  return блок('era era-cand sheet orn', `<div class="row4">${свечи}</div>${ночь || работа ? `<div class="side">${ночь}${работа ? `<div class="duty sheet"><span>Долг</span>${э(работа)}</div>` : ''}</div>` : ''}`);
}

// Возраст: запись о рождении вместо удостоверения.
const ЗНАКИ = ['Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева', 'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы'];
const ЗНАКИ_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// Подписи удостоверения — русские или уже переведённые (переводчик успевает
// раньше); новые подписи по-русски, их переведёт тот же переводчик.
const ПОДПИСИ_ВОЗРАСТА = { 'возраст': 'от роду', 'дата рождения': 'день рождения', 'знак': 'под знаком', 'примечание': 'примечание', 'age': 'от роду', 'date of birth': 'день рождения', 'sign': 'под знаком', 'note': 'примечание' };
function возраст(idc) {
  const { фото, буква } = владелец(idc);
  const строки = [...idc.querySelectorAll('dl > div')].map((d) => {
    const кл = текст(d.querySelector('dt')).toLowerCase(), зн = текст(d.querySelector('dd'));
    const з = Math.max(ЗНАКИ.indexOf(зн), ЗНАКИ_EN.indexOf(зн));
    return `<div><dt>${escapeHtml(ПОДПИСИ_ВОЗРАСТА[кл] || кл)}</dt><dd>${escapeHtml(зн)}${з >= 0 ? `<span class="zod">&#${9800 + з};&#65038;</span>` : ''}</dd></div>`;
  }).join('');
  return блок('era era-birth sheet orn', `<div class="top"><b>Запись о рождении</b>${ЧЕРТА}</div><span class="oval"${фото ? ` style="background-image:url(${урл(фото)})"` : ''}>${фото ? '' : escapeHtml(буква)}</span>`
    + `<dl>${строки}</dl><div class="sign"><span>писано рукою писаря${РОСПИСЬ}</span><span class="seal">${печать('✠')}</span></div>`);
}

// Место: дорожный указатель — откуда (доска назад), где сейчас (вперёд).
function место(pl) {
  const точки = [...pl.querySelectorAll('li')].map((li) => { const k = (li.querySelector('span') || li).cloneNode(true); k.querySelector('small')?.remove(); return { т: текст(k), здесь: li.classList.contains('is-here') }; });
  return блок('era era-post', `<i class="pole" aria-hidden="true"></i>${точки.map(т => т.здесь ? `<div class="board here">${э(т.т)}<span>вы здесь</span></div>` : `<div class="board back">${э(т.т)}</div>`).join('')}`);
}

// Реплики: речевые ленты, как в рукописях.
function реплики(ln) {
  const { фото } = владелец(ln);
  const строки = [...ln.querySelectorAll('.vm')].map((vm) => {
    const bub = vm.querySelector('.bub')?.cloneNode(true); bub?.querySelector('.row')?.remove();
    const м = фото ? `<span class="medal" style="background-image:url(${урл(фото)})"></span>` : `<span class="medal">${э(текст(vm.querySelector('.ava')))}</span>`;
    return `<div class="r">${м}<div class="scroll sheet"><i class="tail" aria-hidden="true"></i>${э(текст(bub))}</div></div>`;
  }).join('');
  return блок('era era-band', строки);
}

// Доверие: фонари вместо светофора.
function доверие(tr) {
  return блок('era era-lamp', [...tr.querySelectorAll('.hud-v-card')].map(c => фонарь(текст(c.querySelector('.hud-v-traffic-text b')), текст(c.querySelector('.hud-v-traffic-text small')), parseInt(текст(c.querySelector('.hud-v-num')), 10) || 0)).join(''));
}

// Статус: лента с восковой печатью вместо неоновых трубок.
function статус(st) {
  const главное = st.querySelector('.tube.main')?.cloneNode(true); главное?.querySelectorAll('.clip').forEach(e => e.remove());
  const под = [...st.querySelectorAll('.tube:not(.main)')].map(текст).filter(Boolean);
  return блок('era era-seal', `${печать(владелец(st).буква)}<div class="band sheet"><span class="t">${э(текст(главное))}</span>${под.map(п => `<span class="s">${escapeHtml(п)}</span>`).join('')}</div>`);
}

// Расписание: часослов — номер в буквице, час службы рубрикой, колокол.
function расписание(sc) {
  const html = [...sc.querySelectorAll('.tk')].map((tk, i) => {
    const поле = (...n) => { const f = [...tk.querySelectorAll('.fields > span')].find(x => n.includes(текст(x.querySelector('small')).toLowerCase())); if (!f) return ''; const k = f.cloneNode(true); k.querySelector('small')?.remove(); return текст(k); };
    const время = поле('время', 'time'), день = поле('день', 'day');
    const м = время.match(/(\d{1,2}):\d{2}/);
    return `<div class="h"><span class="ini">${РИМ[i] || i + 1}</span><div class="what">${э(текст(tk.querySelector('.ev')))}<span>${м ? `<b>${часСлужбы(+м[1])}</b> · ${escapeHtml(время)}` : ''}${день && день !== '—' ? ' · ' + escapeHtml(день) : ''}</span></div>${колокол()}</div>`;
  }).join('');
  return html ? блок('era era-hours sheet orn', `<div class="head"><span class="cap">Часослов</span>${ЧЕРТА}</div>${html}`) : null;
}

// Физиология: лист лекаря. Что где чувствуется — пятно на теле и номер.
const ЗОНЫ = [
  [/голов|мигрен|виск|лоб|head|dizz|migraine|temple/i, [52, 11, 7, 5.5], [18, 6], [47, 9]],
  [/горл|(?<!\p{L})рот|во рту|губ|жажд|пересох|глота|throat|mouth|lips|thirst|dry/iu, [52, 17.5, 3.4, 2.2], [17, 25], [48, 18.5]],
  [/груд|сердц|дыха|сосок|жар|потеет|(?<!\p{L})пот(?!\p{L})|озноб|хмел|вин|chest|heart|breath|hot|fever|sweat|chill|tipsy|wine|drunk/iu, [52, 44, 10, 9], [89, 60], [58, 46]],
  [/живот|(?<!\p{L})низ|возбужд|паху|лоно|влаж|тошн|голод|сыт|belly|stomach|arous|groin|wet|nause|hungr/iu, [52, 74, 7.5, 6], [88, 88], [57, 75]],
  [/ног|колен|бедр|ступн|leg|knee|thigh|feet|foot/i, [52, 104, 8, 10], [18, 108], [47, 104]],
];
function физиология(ph) {
  const чтения = [...ph.querySelectorAll('.reads li')].map((li) => ({ т: текст(li.querySelector('span')), сила: Math.max(1, Math.min(3, (текст(li.querySelector('b')).match(/\+/g) || []).length || +(li.className.match(/s(\d)/) || [])[1] || 1)) }));
  if (!чтения.length) return null;
  const hatch = id('ht'), blur = id('bl'), занято = new Set();
  let пятна = '', метки = '';
  чтения.forEach((ч, i) => {
    const з = ЗОНЫ.findIndex(([re]) => re.test(ч.т));
    if (з < 0 || занято.has(з)) return;
    занято.add(з);
    const [, [cx, cy, rx, ry], [mx, my], [lx, ly]] = ЗОНЫ[з];
    пятна += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" opacity="${(.25 + ч.сила * .17).toFixed(2)}"/>`;
    метки += `<path d="M${lx} ${ly}L${mx} ${my}" stroke="currentColor" stroke-opacity=".45" stroke-width=".6"/><g><circle cx="${mx}" cy="${my}" r="5.2" style="fill:var(--parch);stroke:var(--e-rubric)" stroke-width=".9"/><text x="${mx}" y="${my + 2.4}" text-anchor="middle" font-size="6.4" style="font-family:var(--fh);fill:var(--e-rubric)">${РИМ[i] || i + 1}</text></g>`;
  });
  return блок('era era-leech sheet orn', `<div class="top"><span class="cap">Лист лекаря</span>${ЧЕРТА}</div>`
    + `<svg viewBox="0 0 104 128" aria-hidden="true"><defs><pattern id="${hatch}" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="3.2" stroke="currentColor" stroke-opacity=".3" stroke-width=".9"/></pattern><filter id="${blur}"><feGaussianBlur stdDeviation="3.2"/></filter></defs>`
    + `<circle cx="52" cy="66" r="47" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width=".7"/><rect x="12" y="26" width="80" height="80" fill="none" stroke="currentColor" stroke-opacity=".13" stroke-width=".6"/>`
    + `<g filter="url(#${blur})" style="fill:var(--e-rubric)">${пятна}</g>`
    + `<path d="${ФИГУРА}" fill="url(#${hatch})" stroke="currentColor" stroke-opacity=".8" stroke-width="1" stroke-linejoin="round"/>${метки}</svg>`
    + `<ol>${чтения.map((ч, i) => `<li><i>${РИМ[i] || i + 1}</i><span>${escapeHtml(ч.т)}</span><span class="drops" title="${'+'.repeat(ч.сила)}">${Array.from({ length: ч.сила }, капля).join('')}</span></li>`).join('')}</ol>`);
}

// Печати писем: воск цвета из описания («синий воск», «чёрный воск»).
const ВОСК = [[/син|blue/i, '#2d4f8f'], [/ч[её]рн|black/i, '#26232a'], [/красн|алый|багр|red|scarlet/i, '#8e1f1f'], [/зел[её]н|green/i, '#2f5d3a'], [/золот|ж[её]лт|gold|yellow/i, '#b48a2c'], [/лилов|фиолет|пурпур|purple|violet/i, '#5b2d73']];
function печатьПисьма(сл) {
  const опис = текст(сл.closest('.hud-letter, .hud-ov-sheet')?.querySelector('.hud-letter-who small, .hud-ov-route small'));
  const цв = (ВОСК.find(([re]) => re.test(опис)) || [])[1];
  const знак = текст(сл) || '✠';
  сл.classList.add('era-wax');
  сл.innerHTML = печать(знак) + (сл.classList.contains('is-broken') ? ТРЕЩИНА : '');
  if (цв) сл.style.setProperty('--e-wax', цв);
}

// Подписи HUD, которые выдают современность (только в русском интерфейсе;
// текст модели — письма, подслушанное, новости — не трогаем).
const ПОДПИСИ_ЭПОХИ = {
  'Таймлайн:': 'Летопись:', 'Мини-карта маршрутов:': 'Путевые заметки:', 'Ружья Чехова:': 'Завязки:',
  'висит': 'ждёт', 'назревает': 'зреет', 'выстрелило': 'свершилось', 'Душ': 'Омовение', 'Деньги': 'Кошель', 'На счету': 'В кошеле',
  'Траты за 7 дней': 'Траты за седмицу', 'Подгузники': 'Пелёнки', 'Пробки': 'Заторы', 'Коммунальные службы': 'Ратушные службы', 'Транспорт': 'Извоз',
  'сон прошлой ночью': 'сон минувшей ночью', 'Удостоверение личности': 'Запись о рождении',
};
const ЗАМЕНЫ = [[/подгузник(?:и|ов)?/g, 'пелёнки'], [/(\d)\s*°C/g, '$1°']];
const НЕ_ПОДПИСИ = '.hud-letter-sheet, .hud-ov-script, .hud-ov-sheet, .article-text, .hud-v-note, script, style, textarea, input, [contenteditable="true"]';
function подписи(корень) {
  if (английский()) return;
  const обход = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
  for (let н; (н = обход.nextNode());) {
    const эл = н.parentElement;
    if (!эл || !эл.closest('.hud-os-card') || эл.closest(НЕ_ПОДПИСИ)) continue;
    const чистый = н.nodeValue.replace(/​/g, '').trim();
    if (ПОДПИСИ_ЭПОХИ[чистый]) { н.nodeValue = н.nodeValue.replace(/\S[\s\S]*\S|\S/, ПОДПИСИ_ЭПОХИ[чистый]); continue; }
    let т = н.nodeValue; for (const [re, на] of ЗАМЕНЫ) т = т.replace(re, на);
    if (т !== н.nodeValue) н.nodeValue = т;
  }
}

/* ------------------------------ проход ---------------------------------- */

// [селектор исходного вида, пересборка]. Новый узел — не исходный вид,
// поэтому повторный проход его не трогает.
const ЗАМЕНЫ_ВИДОВ = [
  ['.hud-bs-bat', тело],
  ['.hud-f-age.is-id', возраст],
  ['.hud-f-place.is-crumbs', место],
  ['.hud-f-lines.is-script', реплики],
  ['.hud-v-trust.is-traffic', доверие],
  ['.hud-f-status.is-toggles', статус],
  ['.hud-f-sched.is-tickets', расписание],
  ['.hud-f-phys.is-readout', физиология],
];
const КЛАССЫ = [
  ['.hud-v-mem.is-polaroid:not(.era-mini)', ['era', 'era-mini']],
  ['.hud-cask:not(.era-skin), .hud-overheard:not(.era-skin), .hud-world-container:not(.era-skin), .hud-life-wallet:not(.era-skin), .hud-timeline-container:not(.era-skin), .hud-route-map:not(.era-skin)', ['era', 'era-skin']],
];
const ПЕЧАТИ = '.hud-seal:not(.era-wax)';
const ВСЁ = [...ЗАМЕНЫ_ВИДОВ.map(([с]) => с), ...КЛАССЫ.map(([с]) => с), ПЕЧАТИ].join(', ');
const найти = (корень, с) => [...(корень.matches?.(с) ? [корень] : []), ...корень.querySelectorAll(с)];

/** Пересобрать виды в поддереве. Повторный вызов безопасен. */
export function преобразитьЭпохой(корень) {
  if (!включено() || !корень || корень.nodeType !== 1) return;
  if (!корень.closest('.hud-os-card') && !корень.querySelector('.hud-os-card')) return;
  for (const [с, пересобрать] of ЗАМЕНЫ_ВИДОВ) {
    for (const старый of найти(корень, с)) {
      try { const новый = пересобрать(старый); if (новый) старый.replaceWith(новый); } catch (e) { console.warn('[TavernOS HUD] эпоха', с, e); }
    }
  }
  for (const [с, классы] of КЛАССЫ) найти(корень, с).forEach(e => e.classList.add(...классы));
  найти(корень, ПЕЧАТИ).forEach(сл => { try { печатьПисьма(сл); } catch (e) { console.warn('[TavernOS HUD] печать', e); } });
  подписи(корень);
}

let наблюдатель = null;
/** Следить за вставками: карточки, ленивые вкладки, окно кастомизации. */
export function включитьЭпоху() {
  if (typeof document === 'undefined' || наблюдатель) return;
  преобразитьЭпохой(document.body);
  наблюдатель = new MutationObserver((записи) => {
    if (!включено()) return;
    for (const з of записи) for (const n of з.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches(ВСЁ) || n.querySelector(ВСЁ) || (n.closest('.hud-os-card') && !английский())) преобразитьЭпохой(n);
    }
  });
  наблюдатель.observe(document.body, { childList: true, subtree: true });
}
