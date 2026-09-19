// hud-manager/render/companions.js
//
// Вкладка «Спутники»: животные, фамильяры, дроны и прочие компаньоны. У
// каждого своё настроение, состояние, рацион и привязанность к хозяину.
// Вкладка появляется, только когда в HUD есть хоть один спутник.

import { escapeHtml, applyTooltips, hudHasMeaningfulValue } from '../utils.js?v=22.99.91';

// Значок по виду. Частное раньше общего: «ворон-фамильяр» — птица, а не дух.
const ВИДЫ = [
  [/дракон|виверн|dragon|wyvern/i, '🐉'],
  [/дрон|робот|андроид|drone|robot|android|mech/i, '🤖'],
  [/ворон|сова|филин|птиц|попуга|сокол|ястреб|raven|crow|owl|bird|parrot|falcon|hawk/i, '🐦'],
  [/кот|кош|cat|kitten/i, '🐈'],
  [/пёс|пес|собак|щен|волк|dog|puppy|hound|wolf/i, '🐕'],
  [/конь|лошад|пони|кобыл|жереб|horse|pony|mare|stallion/i, '🐎'],
  [/зме|гадюк|удав|snake|serpent|viper/i, '🐍'],
  [/крыс|мыш|хомяк|rat|mouse|hamster/i, '🐀'],
  [/паук|spider/i, '🕷'],
  [/лис|fox/i, '🦊'],
  [/рыб|fish/i, '🐟'],
  [/фамильяр|дух|призрак|элементал|familiar|spirit|ghost|elemental|wisp/i, '✨'],
];

function значокВида(вид, имя) {
  const s = String(вид || '') + ' ' + String(имя || '');
  const пара = ВИДЫ.find(([rx]) => rx.test(s));
  return пара ? пара[1] : '🐾';
}

const есть = (v) => hudHasMeaningfulValue(v);

export function hudHasMeaningfulCompanions(list) {
  return Array.isArray(list) && list.some(p => p && есть(p.name));
}

export function buildCompanionsHTML(list, uid, isChecked) {
  const спутники = (Array.isArray(list) ? list : []).filter(p => p && есть(p.name));
  const карточки = спутники.map(p => {
    const число = parseFloat(String(p.bond || '').replace(',', '.'));
    const связь = Number.isFinite(число) ? Math.max(0, Math.min(100, число)) : null;
    const строка = (значок, подпись, текст) => есть(текст)
      ? `<div class="hud-pet-row"><span>${значок} ${escapeHtml(подпись)}</span><p>${applyTooltips(String(текст))}</p></div>`
      : '';
    const умения = есть(p.skills)
      ? String(p.skills).split(/[;\n]/).map(s => s.trim()).filter(Boolean)
        .map(s => `<span class="hud-pet-skill">${escapeHtml(s)}</span>`).join('')
      : '';
    return `<div class="hud-pet">`
      + `<div class="hud-pet-head"><span class="hud-pet-ava" aria-hidden="true">${значокВида(p.species, p.name)}</span>`
      + `<div class="hud-pet-title"><b>${escapeHtml(p.name)}</b>${есть(p.species) ? `<small>${escapeHtml(p.species)}</small>` : ''}</div>`
      + (есть(p.mood) ? `<em class="hud-pet-mood">${escapeHtml(p.mood)}</em>` : '')
      + `</div>`
      + (есть(p.owner) ? `<div class="hud-pet-owner">хозяин: <b>${escapeHtml(p.owner)}</b></div>` : '')
      + (связь !== null
        ? `<div class="hud-pet-bond" title="Привязанность ${Math.round(связь)} из 100"><span>привязанность</span><i><i style="width:${связь}%"></i></i><em>${Math.round(связь)}</em></div>`
        : '')
      + строка('🩺', 'Состояние', p.condition)
      + строка('🍖', 'Рацион', p.diet)
      + строка('📝', 'Сейчас', p.note)
      + (умения ? `<div class="hud-pet-skills">${умения}</div>` : '')
      + `</div>`;
  }).join('');
  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">`
    + `<div class="hud-body hud-pets">${карточки || '<div class="hud-pet-empty">Спутников пока нет.</div>'}</div></div>`;
}
