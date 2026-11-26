// hud-manager/render/pet-wounds.js
//
// Раны, болезни и поломки спутника — списком, как «Болезни и травмы» в
// карточке персонажа: что и где, стадия, насколько зажило, когда заживёт,
// чем лечить, останется ли шрам. Под списком — шрамы от прошлых ран.
// Раньше у спутника было одно слово «ранен» по полю состояния.
//
// Модель пишет pet.inj группами через «|» с метками (nm, zn, sg, rc, hl, trt,
// scr; в средневековье с ранами ещё dng, trn) и pet.scr — шрамы через «;».
// Прежняя средневековая запись inj без меток («рана — опасность — когда»)
// разбирается так же. Разметка одна на все виды спутника: карточку,
// тамагочи и прежний список, — вид ей задаёт CSS (css/extras.css, .hud-petw).
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml, перевестиМетку } from '../utils.js?v=23.90.3';
import { стадияБолезни } from '../codes.js?v=23.90.3';
import { раныВкл, тонРаны } from './medieval-life.js?v=23.90.3';

const э = (s) => escapeHtml(String(s ?? ''));
const пусто = (s) => { const т = String(s ?? '').trim(); return !т || /^(empty|none|null|нет|пусто|-|—)$/i.test(т); };

/** Поля спутника в инструкции: раны списком и шрамы. */
export function промптРанСпутника() {
  const опасность = раныВкл() ? '; dng: its danger with no antiseptics — festering, fever, gangrene or none yet; trn: when that danger will show or turn' : '';
  return `, "inj": "[ONLY if hurt or ill — one group per wound, illness or breakdown, separated by |: 'nm: what it is; zn: where on the body; sg: fresh, worsening, stable, healing or healed; rc: recovery 0-100%; hl: when it will heal, in story time; trt: how it is treated or should be; scr: the scar it will leave, if any${опасность}'. The SAME name every turn, updated with story time; drop it once healed]", "scr": "[OPTIONAL scars from old wounds, every turn once any exist: '<what>: <where> — <how it was got>', separated by ;]"`;
}

// Метки группы → поля. Русские подписи — на случай, если модель написала их сама.
const ПОЛЯ = {
  'что это': 'что', 'что': 'что', 'рана': 'что',
  'зона': 'зона', 'где': 'зона',
  'стадия': 'стадия',
  'выздоровление': 'доля', 'зажило': 'доля',
  'заживёт': 'заживёт', 'заживет': 'заживёт', 'срок': 'заживёт',
  'лечение': 'лечение', 'как лечить': 'лечение',
  'симптомы': 'симптомы',
  'шрам': 'шрам', 'останется шрам': 'шрам',
  'опасность': 'опасность', 'когда скажется': 'скажется', 'скажется': 'скажется',
};

function разобратьГруппу(группа) {
  const р = { что: '', зона: '', стадия: '', доля: '', заживёт: '', лечение: '', симптомы: '', шрам: '', опасность: '', скажется: '' };
  const куски = String(группа).split(/\s*[;\n]\s*/).filter(к => !пусто(к));
  let меток = 0;
  const лишнее = [];
  for (const кусок of куски) {
    const m = кусок.match(/^\s*([^:：]{1,30})[:：]\s*([\s\S]*)$/);
    const поле = m ? ПОЛЯ[перевестиМетку(m[1]).toLowerCase().trim()] : '';
    if (!поле) { лишнее.push(кусок.trim()); continue; }
    меток++;
    if (!пусто(m[2]) && !р[поле]) р[поле] = m[2].trim();
  }
  if (!меток && лишнее.length) {
    // Прежняя средневековая запись: «стёртая холка — может загноиться — через день».
    const части = лишнее.join('; ').split(/\s+—\s+/);
    р.что = части[0];
    if (части.length > 1 && раныВкл()) { р.опасность = части[1]; р.скажется = части.slice(2).join(' — '); }
    else р.симптомы = части.slice(1).join(' — ');
    return р;
  }
  if (!р.что) р.что = лишнее.shift() || '';
  if (лишнее.length) р.симптомы = [р.симптомы, ...лишнее].filter(Boolean).join('; ');
  return р;
}

/** Раны спутника из pet.inj: [{ что, зона, стадия: {ключ, текст}, доля, заживёт, лечение, симптомы, шрам, опасность, скажется }]. */
export function раныСпутника(p) {
  const текст = p && p.injuries;
  if (пусто(текст)) return [];
  return String(текст).split(/\s*\|\s*/).filter(г => !пусто(г)).map(г => {
    const р = разобратьГруппу(г);
    if (!р.что) return null;
    const число = parseFloat(String(р.доля).replace(',', '.'));
    return { ...р, стадия: стадияБолезни(р.стадия), доля: Number.isFinite(число) ? Math.max(0, Math.min(100, число)) : null };
  }).filter(Boolean);
}

/** Шрамы спутника из pet.scr: «что: где — откуда; …». */
export function шрамыСпутника(p) {
  const текст = p && p.scars;
  if (пусто(текст)) return [];
  return String(текст).split(/\s*[;\n|]\s*/).filter(с => !пусто(с)).map(с => {
    const m = с.match(/^\s*([^:：]{1,40})[:：]\s*([\s\S]*)$/);
    const что = (m ? m[1] : с.split(/\s+—\s+/)[0]).trim();
    const остаток = m ? m[2] : с.split(/\s+—\s+/).slice(1).join(' — ');
    const [где, ...откуда] = String(остаток).split(/\s+—\s+/);
    return { что, где: (где || '').trim(), откуда: откуда.join(' — ').trim() };
  }).filter(ш => ш.что);
}

// Значки — SVG, как у плиток спутника (render/extras.js), без эмодзи.
const ИК = {
  wound: 'M4.6 14.6 14.6 4.6a3 3 0 0 1 4.2 4.2L8.8 18.8a3 3 0 0 1-4.2-4.2Z M10.2 10.2h.01 M12.6 9.6h.01 M9.6 12.6h.01',
  bone: 'M8.6 15.4 15.4 8.6 M8.6 15.4a2 2 0 1 1-2.9 1.1 2 2 0 1 1 1.8-3.3 M15.4 8.6a2 2 0 1 1 2.9-1.1 2 2 0 1 1-1.8 3.3',
  burn: 'M12 3c1 3 5 5.2 5 10a5 5 0 0 1-10 0c0-2.6 1.4-4.2 2.6-5.2 0 2 .9 3.2 2 3.2 0-3-1-5.5.4-8Z',
  sick: 'M10 4.5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z M12 9.5v5.5',
  gear: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  scar: 'M4 12h16 M7 9v6 M10.5 9v6 M14 9v6 M17.5 9v6',
};
const ик = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ИК[k]}"/></svg>`;

const БОЛЕЗНЬ = /болез|болен|больн|хвор|лихорад|жар(?!\p{L})|отрав|простуд|инфекц|кашл|понос|рвот|глист|блох|клещ|чесот|лишай|чумк|бешенств|колик|мыт(?!\p{L})|sick|(?<!\p{L})ill(?!\p{L})|fever|poison|infect|cough|worms|fleas|ticks|mange|colic/iu;
function видРаны(р, механизм) {
  const s = р.что + ' ' + р.симптомы;
  if (механизм && /слом|поврежд|сбой|разбит|треснул|износ|ржав|замыка|перегр|broken|damag|glitch|crack|rust|short|overheat/i.test(s)) return 'gear';
  if (/перелом|трещин\p{L}* кост|fractur|broken (?:leg|paw|wing|bone)/iu.test(s)) return 'bone';
  if (/ож[оё]г|(?<!\p{L})burn/iu.test(s)) return 'burn';
  if (БОЛЕЗНЬ.test(р.что)) return 'sick';
  return механизм ? 'gear' : 'wound';
}

/** Есть ли у спутника рана или болезнь, что ещё не прошла: для значка «ранен» в карточке. */
export function состояниеПоРанам(p, механизм) {
  const раны = раныСпутника(p).filter(р => р.стадия.ключ !== 'healed');
  if (!раны.length) return null;
  const виды = раны.map(р => видРаны(р, механизм));
  const слово = механизм ? 'сбой' : виды.every(в => в === 'sick') ? 'болен' : 'ранен';
  return { слово, кто: раны.map(р => р.что).join(', ') };
}

const строка = (подпись, текст, класс = '') => пусто(текст) ? '' : `<div class="hud-petw-row${класс}"><span>${подпись}</span><p>${э(текст)}</p></div>`;

function карточкаРаны(р, механизм) {
  const вид = видРаны(р, механизм);
  // Опасность раны — только пока включены «Раны без антисептиков», как у людей.
  const опасна = !пусто(р.опасность) && раныВкл();
  const доля = р.доля;
  // Только span и b: em, i и small в сообщении ST красит своими цветами.
  return `<div class="hud-petw-it k-${вид}${р.стадия.ключ ? ' is-' + р.стадия.ключ : ''}">`
    + `<div class="hud-petw-top"><span class="hud-petw-ico">${ик(вид)}</span><div class="hud-petw-nm"><b>${э(р.что)}</b>${пусто(р.зона) ? '' : `<span>${э(р.зона)}</span>`}</div>`
    + (р.стадия.текст ? `<span class="hud-petw-st">${э(р.стадия.текст)}</span>` : '') + `</div>`
    + (доля !== null ? `<div class="hud-petw-m" title="Выздоровление ${Math.round(доля)}%"><span class="hud-petw-bar"><span style="width:${доля}%"></span></span><span>${Math.round(доля)}%</span></div>` : '')
    + строка('Заживёт', р.заживёт, ' is-heal')
    + строка('Лечение', р.лечение)
    + строка('Симптомы', р.симптомы)
    + (опасна ? строка('Опасность', р.опасность, ' is-danger is-' + тонРаны(р.опасность)) + строка('Скажется', р.скажется) : '')
    + строка('Шрам', р.шрам, ' is-scar')
    + `</div>`;
}

/**
 * Раны и шрамы спутника одним блоком — для любого вида (карточка, тамагочи,
 * прежний список). '' — если нет ни ран, ни шрамов.
 */
export function блокРанСпутника(p, механизм = false) {
  const раны = раныСпутника(p);
  const шрамы = шрамыСпутника(p);
  if (!раны.length && !шрамы.length) return '';
  const заголовок = механизм ? 'Поломки' : раны.length && раны.every(р => видРаны(р, false) === 'sick') ? 'Болезни' : 'Раны и болезни';
  const список = раны.length
    ? `<div class="hud-petw-h">${ик(механизм ? 'gear' : 'wound')}<span>${заголовок}</span>${раны.length > 1 ? `<b>${раны.length}</b>` : ''}</div>`
      + раны.map(р => карточкаРаны(р, механизм)).join('')
    : '';
  const следы = шрамы.length
    ? `<div class="hud-petw-scars"><span class="hud-petw-scl">${ик('scar')}<span>${механизм ? 'Следы ремонта' : 'Шрамы'}</span></span>`
      + шрамы.map(ш => `<span class="hud-petw-sc"><b>${э(ш.что)}</b>${ш.где ? `<span class="hud-petw-where">${э(ш.где)}</span>` : ''}${ш.откуда ? `<span class="hud-petw-from">${э(ш.откуда)}</span>` : ''}</span>`).join('')
      + `</div>`
    : '';
  return `<div class="hud-petw">${список}${следы}</div>`;
}
