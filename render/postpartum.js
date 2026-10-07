// hud-manager/render/postpartum.js
//
// «После родов» (поле Pp): модель пишет только как кормит, когда кормила
// последний раз и как себя чувствует. HUD сам считает по дате родов:
// этап восстановления, заживление, выделения, вернулся ли цикл, насколько
// упал шанс зачатия, — и молоко: стадия (молозиво, переходное, зрелое),
// сколько нужно в сутки, наполненность груди по времени с кормления.
// Оформление — css/family.css.

import { escapeHtml, applyTooltips, перевестиМетку, разбитьСписок } from '../utils.js?v=23.44.2';
import { parseSceneDate } from '../history-analyzer.js?v=23.44.2';
import { родыЧьи, словоПолов, деньРодов } from './conception.js?v=23.44.2';
import { послеродовое, видКормления, часовМежду } from './fertility.js?v=23.44.2';
import { видСемьи, видПослеродового } from './family-views.js?v=23.44.2';

function метки(value) {
  const о = {};
  for (const к of разбитьСписок(value)) {
    const m = String(к).match(/^\s*([^:：]{1,40})[:：]\s*(.+)$/);
    if (m) о[перевестиМетку(m[1].trim()).toLowerCase()] = m[2].trim();
  }
  return о;
}
let счётчик = 0;
const скл = (n, а, б, в) => { const x = Math.abs(n) % 100, y = x % 10; return x > 10 && x < 20 ? в : y === 1 ? а : y >= 2 && y <= 4 ? б : в; };

export function buildPostpartum(value, { кто = '', сцена = '', время = '' } = {}) {
  const п = метки(value);
  const р = кто ? родыЧьи(кто) : null;
  const сценаMs = parseSceneDate(сцена);
  const дата = р ? деньРодов(р, сценаMs) : null;
  const дней = дата !== null && дата !== undefined && сценаMs !== null && сценаMs >= дата ? Math.round((сценаMs - дата) / 864e5) : null;
  const кормление = видКормления(п['кормление'] || value);
  // «Кормление планируется» — ещё не кормила: «lfd: 00:00» тогда не время, а заглушка.
  const ещёНеКормила = /планир|ещё не|еще не|не кормил|not yet|planned/i.test(п['кормление'] || '');
  const часы = ещёНеКормила ? NaN : часовМежду(п['последнее кормление'], время);
  const с = дней !== null ? послеродовое(дней, { кормление, часыСКормления: часы, детей: (р && р.число) || 1 }) : null;
  const строка = (подпись, текст, класс = '') => текст ? `<div class="hud-pp-row${класс}"><span>${escapeHtml(подпись)}</span><p>${applyTooltips(текст)}</p></div>` : '';
  // Грудь объёмом: каплевидная форма, свет сверху-слева и тень снизу, ареола
  // с переходом, блик. Молоко видно внутри — волнистый уровень.
  const грудь = (полнота, левая) => {
    const id = 'pp' + (++счётчик);
    const у = (54 - 36 * полнота / 100).toFixed(1);
    // Капля: верх уходит к середине груди, низ полный, сосок смотрит наружу.
    const форма = 'M24 7c-3 0-5 2.6-7 6.4C13.4 20 8 26 8 35c0 11 8 19 20 19 13 0 25-8 25-20 0-9-7-14.6-14-18.6C33.6 12.4 29 7 24 7Z';
    return `<svg class="hud-pp-breast${левая ? ' is-left' : ''}" viewBox="0 0 60 60" aria-hidden="true"><defs>`
      + `<radialGradient id="${id}s" cx=".36" cy=".3" r=".8"><stop offset="0" class="sk0"/><stop offset=".55" class="sk1"/><stop offset="1" class="sk2"/></radialGradient>`
      + `<radialGradient id="${id}a" cx=".45" cy=".4" r=".6"><stop offset="0" class="ar0"/><stop offset="1" class="ar1"/></radialGradient>`
      + `<linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mk0"/><stop offset="1" class="mk1"/></linearGradient>`
      + `<clipPath id="${id}c"><path d="${форма}"/></clipPath></defs>`
      + `<ellipse class="shade" cx="30" cy="55" rx="17" ry="2.6"/>`
      + `<path class="skin" d="${форма}" fill="url(#${id}s)"/>`
      + `<g clip-path="url(#${id}c)"><path class="milk" d="M0 ${у}q7.5 -3 15 0t15 0 15 0 15 0V60H0Z" fill="url(#${id}m)"/><path class="surf" d="M0 ${у}q7.5 -3 15 0t15 0 15 0 15 0"/></g>`
      + `<path class="rim" d="${форма}"/>`
      + `<ellipse class="areola" cx="36" cy="37" rx="6.4" ry="6" fill="url(#${id}a)"/><circle class="tip" cx="36.6" cy="37" r="2.5"/><circle class="tip-hi" cx="35.8" cy="36.2" r=".85"/>`
      + `<path class="under" d="M12 44c4 6 10 9 17 9 9 0 17-4 21-11"/>`
      + `<ellipse class="gloss" cx="17" cy="29" rx="5.4" ry="3" transform="rotate(-58 17 29)"/></svg>`;
  };
  const молоко = с && с.молоко;
  const вид = { breast: 'грудью', formula: 'смесью', mixed: 'грудь и смесь' }[кормление];
  // Другие виды (Кастомизация → Блоки: Семья) — render/family-views.js.
  const видБлока = видСемьи('postpartumView');
  if (видБлока !== 'classic') {
    const прошло = Number.isFinite(часы) ? (часы < 1 ? Math.round(часы * 60) + ' мин' : Math.floor(часы) + ' ч ' + Math.round((часы % 1) * 60) + ' мин') + ' с кормления' : '';
    return видПослеродового(видБлока, { дней, с, молоко, кормление, видСлово: вид, прошло, грудь: п['грудь'], самочувствие: п['симптомы'], словоПолов: р && р.полы ? словоПолов(р.полы) : '' });
  }

  return `<div class="hud-pp">`
    + `<div class="hud-pp-head"><span class="ico" aria-hidden="true">🤱</span><b>${дней === null ? 'После родов' : дней === 0 ? 'Роды сегодня' : `${дней} ${скл(дней, 'день', 'дня', 'дней')} после родов`}</b>`
    + (с ? `<em>${escapeHtml(с.этап)}</em>` : '') + (р && р.полы ? `<small>${escapeHtml(словоПолов(р.полы))}</small>` : '') + `</div>`
    + (с ? `<div class="hud-pp-track"><i style="width:${Math.min(100, дней / 42 * 100).toFixed(1)}%"></i><s style="left:${(10 / 42 * 100).toFixed(1)}%"></s><s style="left:${(25 / 42 * 100).toFixed(1)}%"></s><span>6 недель восстановления</span><b class="now" style="left:${Math.min(100, дней / 42 * 100).toFixed(1)}%" aria-hidden="true"></b></div>`
      + `<div class="hud-pp-weeks" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map(н => `<span class="${дней >= н * 7 ? 'is-done' : дней >= (н - 1) * 7 ? 'is-now' : ''}">${н} нед</span>`).join('')}</div>` : '')
    + (с ? строка('Заживление', с.заживление) + строка('Выделения', с.выделения) : '')
    + (молоко ? (() => {
      const пл = молоко.полнота ?? 40, пп = Math.max(0, пл - 8);
      const тон = пл >= 80 ? ' is-hot' : пл >= 55 ? ' is-soon' : '';
      const прошло = Number.isFinite(часы) ? (часы < 1 ? Math.round(часы * 60) + ' мин' : Math.floor(часы) + ' ч ' + Math.round((часы % 1) * 60) + ' мин') + ' с кормления' : '';
      return `<div class="hud-pp-milk${тон}"><div class="breasts">`
        + `<figure>${грудь(пл, true)}<figcaption>Л · ${пл}%</figcaption></figure><figure>${грудь(пп, false)}<figcaption>П · ${пп}%</figcaption></figure>`
        + `<i class="drop d0" aria-hidden="true"></i><i class="drop d1" aria-hidden="true"></i><i class="drop d2" aria-hidden="true"></i></div>`
        + `<div class="info"><b><i class="ico" aria-hidden="true"></i>${escapeHtml(молоко.стадия)}</b>`
        + `<span class="chips"><span>🤱 ${вид || 'кормит'}</span><span>🍼 ≈ ${молоко.вСутки} мл в сутки</span></span>`
        + (молоко.слово ? `<span class="fill-meter"><span class="lbl"><b>${escapeHtml(молоко.слово)}</b>${прошло ? `<small>${прошло}</small>` : ''}</span><i style="--v:${пл}%"></i></span>` : '')
        + `</div></div>`;
    })() : строка('Кормление', вид))
    + строка('Грудь', п['грудь'])
    + строка('Самочувствие', п['симптомы'])
    + (с ? `<div class="hud-pp-cycle${с.циклВернулся ? ' is-back' : ''}"><i aria-hidden="true">${с.циклВернулся ? '🌕' : '🌑'}</i>${с.циклВернулся ? 'цикл вернулся — снова можно забеременеть' : `цикл ещё не вернулся — шанс зачатия ×${String(с.плодовитость).replace('.', ',')}${кормление === 'breast' ? ' (кормление грудью — не гарантия!)' : ''}`}</div>` : '')
    + `</div>`;
}
