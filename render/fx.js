// hud-manager/render/fx.js
//
// Маркеры эффектов data-fx вместо мегаселекторов. Подъём при наведении и
// мягкое свечение NSFW-плашек в misc.css были записаны списками на сто
// классов (самый длинный селектор — 1615 символов). Теперь элемент несёт
// data-fx="lift" / "glow", и правило пишется по атрибуту.
//
// Фаза 1 (сейчас): атрибут ставится ПАРАЛЛЕЛЬНО, старые селекторы живут.
// Новые правила в misc.css дублируют старые, поэтому вид не меняется ни на
// пиксель. Тест равенства множеств (tests/wave3.mjs и стенды) проверяет, что
// [data-fx~=lift] выбирает ровно то же, что старый список. Когда равенство
// подтвердится на живых чатах, отдельным релизом старые списки удаляются.
//
// Списки ниже — копия CSS; тест сверяет их с misc.css слово в слово.

// Подъём: всё, что приподнимается при наведении и касании.
export const FX_LIFT = [
  '.hud-row:not(:has(.hud-key-item, .hud-detail-pill, .hud-inventory-pill, .hud-conflict-pill, .hud-kink-pill, .hud-fetish-pill, .hud-nogo-pill, .hud-noturn-pill, .hud-nsfw-pill, .hud-schedule-event, .hud-exp-reality, .hud-phase-step, .hud-fear, .hud-ill, .hud-prg, .hud-zone, .hud-perc, .hud-scene-chip, .hud-prot, .hud-org, .hud-vit, .hud-sound, .hud-heat-row, .hud-mark, .hud-cycle-badge, .hud-eco-row, .hud-afisha-card, .hud-city-row, .hud-news-article, .hud-world-list li, .hud-comment, .hud-horo-card, .hud-timeline-content, .hud-mood-chip, .hud-gun, .hud-pet, .hud-line-quote, .hud-phone-contact, .hud-phone-photo-card, .hud-phone-lock-notice, .hud-phone-note, .hud-phone-chat-row, .hud-phone-search-row, .hud-phone-map-row, .hud-vitals, .hud-sounds, .hud-heat, .hud-marks, .hud-cycle, .hud-scene-strip, .hud-fears, .hud-perc-list, .hud-lines, .hud-route-map, .hud-mood-group, .hud-guns))',
  '.hud-key-item',
  '.hud-detail-pill',
  '.hud-inventory-pill',
  '.hud-conflict-pill',
  '.hud-kink-pill',
  '.hud-fetish-pill',
  '.hud-nogo-pill',
  '.hud-noturn-pill',
  '.hud-nsfw-pill',
  '.hud-schedule-event',
  '.hud-exp-reality',
  '.hud-phase-step',
  '.hud-fear',
  '.hud-ill',
  '.hud-prg',
  '.hud-zone',
  '.hud-perc',
  '.hud-scene-chip',
  '.hud-prot',
  '.hud-org',
  '.hud-vit',
  '.hud-sound',
  '.hud-heat-row',
  '.hud-mark',
  '.hud-cycle-badge',
  '.hud-eco-row',
  '.hud-afisha-card',
  '.hud-city-row',
  '.hud-news-article',
  '.hud-world-list li',
  '.hud-comment',
  '.hud-horo-card',
  '.hud-timeline-content',
  '.hud-mood-chip',
  '.hud-gun',
  '.hud-pet',
  '.hud-line-quote',
  '.hud-phone-contact',
  '.hud-phone-photo-card',
  '.hud-phone-lock-notice',
  '.hud-phone-note',
  '.hud-phone-chat-row',
  '.hud-phone-search-row',
  '.hud-phone-map-row',
];

// Свечение: NSFW-плашки и шкалы, у которых при наведении «дышит» отсвет.
export const FX_GLOW = [
  '.hud-nsfw-pill',
  '.hud-kink-pill',
  '.hud-fetish-pill',
  '.hud-nogo-pill',
  '.hud-noturn-pill',
  '.hud-scene-chip',
  '.hud-phase-step',
  '.hud-prot',
  '.hud-org',
  '.hud-vit',
  '.hud-sound',
  '.hud-heat-row',
  '.hud-row.nsfw:not(:has(.hud-key-item, .hud-detail-pill, .hud-inventory-pill, .hud-conflict-pill, .hud-kink-pill, .hud-fetish-pill, .hud-nogo-pill, .hud-noturn-pill, .hud-nsfw-pill, .hud-schedule-event, .hud-exp-reality, .hud-phase-step, .hud-fear, .hud-ill, .hud-prg, .hud-zone, .hud-perc, .hud-scene-chip, .hud-prot, .hud-org, .hud-vit, .hud-sound, .hud-heat-row, .hud-mark, .hud-cycle-badge, .hud-eco-row, .hud-afisha-card, .hud-city-row, .hud-news-article, .hud-world-list li, .hud-comment, .hud-horo-card, .hud-timeline-content, .hud-mood-chip, .hud-gun, .hud-pet, .hud-line-quote, .hud-phone-contact, .hud-phone-photo-card, .hud-phone-lock-notice, .hud-phone-note, .hud-phone-chat-row, .hud-phone-search-row, .hud-phone-map-row, .hud-vitals, .hud-sounds, .hud-heat, .hud-marks, .hud-cycle, .hud-scene-strip, .hud-fears, .hud-perc-list, .hud-lines, .hud-route-map, .hud-mood-group, .hud-guns))',
];

export const СЕЛЕКТОР_LIFT = FX_LIFT.join(', ');
export const СЕЛЕКТОР_GLOW = FX_GLOW.join(', ');

const добавить = (узел, метка) => {
  const есть = (узел.getAttribute('data-fx') || '').split(/\s+/).filter(Boolean);
  if (!есть.includes(метка)) узел.setAttribute('data-fx', [...есть, метка].join(' '));
};

/** Пометить эффекты внутри корня (карточка, вкладка, просмотр). Возвращает число меток. */
export function пометитьЭффекты(корень) {
  if (!корень || !корень.querySelectorAll) return 0;
  let n = 0;
  try {
    for (const [селектор, метка] of [[СЕЛЕКТОР_LIFT, 'lift'], [СЕЛЕКТОР_GLOW, 'glow']]) {
      if (корень.matches && корень.matches(селектор)) { добавить(корень, метка); n++; }
      корень.querySelectorAll(селектор).forEach(у => { добавить(у, метка); n++; });
    }
  } catch (e) { /* браузер без :has() — старые селекторы и так не работают */ }
  return n;
}
