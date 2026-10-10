// hud-manager/render/fetus.js
//
// Блок «Малыши в животе»: сколько их и какого пола. Число решает кубик при
// зачатии, пол — кубик по кнопке «Узнать пол», если в сюжете ещё не было УЗИ.
// «✦ Изменить судьбу» открывает выбор: один малыш, близнецы, двойняшки,
// тройня — и сочетания пола под каждый тип. «↺ Откатить» возвращает кубик.
// Клики ловит index.js (data-hud-fetus). Оформление — css/family.css.

import { escapeHtml } from '../utils.js?v=23.48.1';
import { плодыОт, ТИПЫ_ПЛОДОВ, СОЧЕТАНИЯ, словоПолов } from './conception.js?v=23.48.1';
import { наследование } from './fertility.js?v=23.48.1';
import { видСемьи, видПлодов } from './family-views.js?v=23.48.1';

// Малыш в плодном пузыре: свернувшийся эмбрион (голова, спинка дугой,
// ручка у лица, ножки), пуповина, объём от градиента и блик.
const ГОЛОВА = 'M28.4 9.6a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2Z';
const ТЕЛО = 'M22.6 21.4c-5.6 2.2-8.6 8.4-6.6 14 1.8 5 7.6 7.8 12.8 6.2 4.4-1.4 6.8-5.6 5.6-9.4-.8-2.6-3.2-4-5.6-3.6';
const НОЖКА = 'M31.6 32.6c-3 .4-5.6 2.2-6.4 4.8';
const РУЧКА = 'M24.2 24.2c.8 2.2 2.6 3.4 4.4 3.2';
const ПУПОВИНА = 'M24.6 34.4c-2.4 1-3.4-1.6-5.8-.6s-2.2 3.8-4.8 3.6c-2-.2-3-1.6-4.6-1';
let счётчик = 0;

function значокМалыша(пол, i) {
  const класс = пол === 'f' ? 'is-girl' : пол === 'm' ? 'is-boy' : 'is-unknown';
  const id = 'fz' + (++счётчик);
  return `<svg class="hud-fetus-baby ${класс}" style="--i:${i}" viewBox="0 0 48 48" aria-hidden="true"><defs>`
    + `<radialGradient id="${id}s" cx=".4" cy=".34" r=".7"><stop offset="0" class="s0"/><stop offset=".7" class="s1"/><stop offset="1" class="s2"/></radialGradient>`
    + `<radialGradient id="${id}b" cx=".42" cy=".3" r=".75"><stop offset="0" class="b0"/><stop offset="1" class="b1"/></radialGradient></defs>`
    + `<circle class="halo" cx="24" cy="24" r="23"/><circle class="sac" cx="24" cy="24" r="21" fill="url(#${id}s)"/>`
    + `<path class="cord" d="${ПУПОВИНА}"/>`
    + `<g class="baby"><path class="body" d="${ТЕЛО}" fill="url(#${id}b)"/><path class="limb" d="${НОЖКА}"/><path class="limb" d="${РУЧКА}"/><path class="head" d="${ГОЛОВА}" fill="url(#${id}b)"/><circle class="eye" cx="25.6" cy="17.6" r=".9"/></g>`
    + `<ellipse class="gloss" cx="15" cy="12.6" rx="7" ry="3.4" transform="rotate(-36 15 12.6)"/><circle class="rim" cx="24" cy="24" r="21"/></svg>`;
}
// Образец цвета для прогноза глаз и волос.
const ОБРАЗЦЫ = { карие: '#7a4a2a', зелёные: '#5f9a5a', серые: '#8e9aa6', голубые: '#6fa8dc', чёрные: '#1e1a1a', тёмные: '#4a3020', русые: '#a8865e', рыжие: '#c8602e', светлые: '#ecd28c' };

/**
 * кто — «user» или «char:Имя»; вСюжете — беременность уже есть в Prg;
 * полИзСюжета — пол, который модель уже написала (УЗИ было), тогда кубика нет.
 * мама/папа — тексты внешности, чтобы прикинуть глаза и волосы.
 */
export function блокПлодов(кто, { вСюжете = false, полИзСюжета = '', мама = '', папа = '', неделя = null, текстСюжета = '' } = {}) {
  const п = плодыОт(кто, { вСюжете, изСюжета: текстСюжета + ' ' + полИзСюжета });
  if (!п) return '';
  const данные = `data-kto="${escapeHtml(п.кто)}"`;
  const полы = п.полы || Array(п.число).fill('');
  const полСюжета = String(полИзСюжета || '').trim();
  const подписьПола = полСюжета
    ? `<span class="sex is-story">по УЗИ: <b>${escapeHtml(полСюжета)}</b></span>`
    : п.полы
      ? `<span class="sex"><b>${escapeHtml(п.словоПолов)}</b>${п.судьбаПола ? '<i class="fate-mark" title="Изменено судьбой">✦︎</i>' : ''}</span>`
      : `<button type="button" class="hud-fetus-btn is-roll" data-hud-fetus="roll" ${данные} title="Бросить кубик на пол — увидишь только ты и HUD">🎲 Узнать пол</button>`;
  // Глаза и волосы — по одному прогнозу на малыша.
  const похож = [].concat(мама, папа).some(Boolean) ? полы.map((_, i) => наследование(мама, папа, п.кто + '|' + i)).filter(Boolean) : [];
  const черта = (ч, что, вид) => ч ? `<span class="trait is-${вид}"><i style="--sw:${ОБРАЗЦЫ[ч.имя] || '#999'}"></i>${ч.имя} ${что}<small>${ч.шанс}%</small></span>` : '';
  const строкаПохож = похож.length ? `<div class="looks"><small class="looks-head">на кого похож${п.число > 1 ? 'и' : ''}</small>${похож.map((н, i) => `<span class="looks-row">${п.число > 1 ? `<b>${i + 1}</b>` : ''}${черта(н.глаза, 'глаза', 'eye')}${черта(н.волосы, 'волосы', 'hair')}</span>`).join('')}</div>` : '';
  // Выбор судьбы: тип и сочетания пола под него.
  const кнопкаТипа = (т) => `<button type="button" class="hud-fetus-btn${т === п.тип ? ' is-on' : ''}" data-hud-fetus="type" data-val="${т}" ${данные}>${ТИПЫ_ПЛОДОВ[т].имя}</button>`;
  const кнопкаПола = (сочетание) => { const код = сочетание.join(''); const вкл = п.полы && п.полы.join('') === код;
    return `<button type="button" class="hud-fetus-btn${вкл ? ' is-on' : ''}" data-hud-fetus="sex" data-val="${код}" ${данные}>${escapeHtml(словоПолов(сочетание))}</button>`; };
  const судьба = `<details class="hud-fetus-fate"><summary>✦︎ Изменить судьбу</summary><div class="opts"><small>сколько</small><div class="row">${Object.keys(ТИПЫ_ПЛОДОВ).map(кнопкаТипа).join('')}</div>`
    + (полСюжета ? '' : `<small>пол</small><div class="row">${СОЧЕТАНИЯ[п.тип].map(кнопкаПола).join('')}</div>`) + `</div></details>`;
  const откат = (п.судьбаТипа || п.судьбаПола) ? `<button type="button" class="hud-fetus-btn is-undo" data-hud-fetus="undo" ${данные} title="Вернуть то, что выпало на кубике">↺ Откатить</button>` : '';
  // Другие виды (Кастомизация → Блоки: Семья) — render/family-views.js.
  const вид = видСемьи('fetusView');
  if (вид !== 'classic') return видПлодов(вид, { п, полы, кто: п.кто, неделя, подписьПола, строкаПохож, acts: судьба + откат });
  return `<div class="hud-fetus${п.число > 1 ? ' is-multi' : ''}"><div class="womb-row"><div class="wombs">${полы.map(значокМалыша).join('')}</div>`
    + `<svg class="beat" viewBox="0 0 64 14" preserveAspectRatio="none" aria-hidden="true"><path pathLength="100" d="M0 7h16l2.4-4 3.6 9 3-11 2.6 9 1.8-3H64"/></svg></div>`
    + `<div class="txt"><b class="kind">${п.имяТипа}${п.судьбаТипа ? '<i class="fate-mark" title="Изменено судьбой">✦︎</i>' : ''}</b>${п.пояснение ? `<small>${п.пояснение}</small>` : ''}${подписьПола}${строкаПохож}`
    + `<div class="acts">${судьба}${откат}</div></div></div>`;
}
