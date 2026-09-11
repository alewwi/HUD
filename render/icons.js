// hud-manager/render/icons.js
//
// Значки телефона: строчные SVG без единого внешнего запроса. Лежат
// отдельным модулем, потому что нужны и мессенджеру, и разбору сообщений, и
// самим приложениям — держать их в одном из трёх было бы произволом.

// Иконки поиска — svg, а не эмодзи. Эмодзи рисуются шрифтом системы, у
// каждой ОС по-своему, и экран сразу читается как самоделка; тонкие
// штриховые значки выглядят как настоящий интерфейс браузера.
export const G_ICONS = {
  glass: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8 21 21"/></svg>',
  clock: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3.2 2"/></svg>',
  arrow: '<svg class="hud-g-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 16.5 8 8"/><path d="M8 14.5V8h6.5"/></svg>',
  mic:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9.4" y="3.4" width="5.2" height="10" rx="2.6"/><path d="M6.2 11.4a5.8 5.8 0 0 0 11.6 0"/><path d="M12 17.2V20.6"/></svg>',
  lens:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5.6A1.6 1.6 0 0 1 5.6 4H9"/><path d="M15 4h3.4A1.6 1.6 0 0 1 20 5.6V9"/><path d="M20 15v3.4a1.6 1.6 0 0 1-1.6 1.6H15"/><path d="M9 20H5.6A1.6 1.6 0 0 1 4 18.4V15"/><circle cx="12" cy="12" r="2.6"/></svg>',
  chat:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 20.8l1.7-3.9A6.9 6.9 0 0 1 3.5 12.4C3.5 8.4 7.3 5.2 12 5.2s8.5 3.2 8.5 7.2Z"/></svg>',
  person:'<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.4" r="3.7"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/></svg>',
  people:'<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.6" r="3.2"/><path d="M3 19.6a6 6 0 0 1 12 0"/><path d="M16.2 6.1a3.2 3.2 0 0 1 0 6"/><path d="M17.6 14.2a6 6 0 0 1 3.4 5.4"/></svg>',
  image: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.4" y="5" width="17.2" height="14" rx="2.4"/><circle cx="9" cy="10" r="1.7"/><path d="m4.6 17.4 4.6-4.3 3.3 3 2.7-2.3 4.2 3.6"/></svg>',
  note:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.6h8.4L19 8.2v12.2H6z"/><path d="M14.2 3.7v4.6h4.6"/><path d="M9 12.6h6M9 16h4.4"/></svg>',
  map:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m3.6 6.4 5.4-2.2 6 2.2 5.4-2.2v13.4l-5.4 2.2-6-2.2-5.4 2.2z"/><path d="M9 4.2v13.4M15 6.4v13.4"/></svg>',
  callOut: '<svg class="hud-call-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="hud-call-hs" d="M6.4 3.6c.7-.6 1.8-.4 2.3.4l1.5 2.2c.4.6.3 1.4-.2 1.9l-.8.8c-.2.2-.3.5-.1.8.8 1.4 2 2.6 3.4 3.4.3.2.6.1.8-.1l.8-.8c.5-.5 1.3-.6 1.9-.2l2.2 1.5c.8.5 1 1.6.4 2.3l-1 1.1c-.7.8-1.9 1.1-2.9.7-4.6-1.7-8.2-5.3-9.9-9.9-.4-1-.1-2.2.7-2.9z"/><path class="hud-call-ar" d="M15.6 8.4 20.4 3.6"/><path class="hud-call-ar" d="M16.8 3.6h3.6v3.6"/></svg>',
  callIn:  '<svg class="hud-call-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="hud-call-hs" d="M6.4 3.6c.7-.6 1.8-.4 2.3.4l1.5 2.2c.4.6.3 1.4-.2 1.9l-.8.8c-.2.2-.3.5-.1.8.8 1.4 2 2.6 3.4 3.4.3.2.6.1.8-.1l.8-.8c.5-.5 1.3-.6 1.9-.2l2.2 1.5c.8.5 1 1.6.4 2.3l-1 1.1c-.7.8-1.9 1.1-2.9.7-4.6-1.7-8.2-5.3-9.9-9.9-.4-1-.1-2.2.7-2.9z"/><path class="hud-call-ar" d="M20.4 3.6 15.6 8.4"/><path class="hud-call-ar" d="M19.2 8.4h-3.6V4.8"/></svg>',
  callMiss:'<svg class="hud-call-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="hud-call-hs" d="M6.4 3.6c.7-.6 1.8-.4 2.3.4l1.5 2.2c.4.6.3 1.4-.2 1.9l-.8.8c-.2.2-.3.5-.1.8.8 1.4 2 2.6 3.4 3.4.3.2.6.1.8-.1l.8-.8c.5-.5 1.3-.6 1.9-.2l2.2 1.5c.8.5 1 1.6.4 2.3l-1 1.1c-.7.8-1.9 1.1-2.9.7-4.6-1.7-8.2-5.3-9.9-9.9-.4-1-.1-2.2.7-2.9z"/><path class="hud-call-ar" d="M15.6 3.6 20.4 8.4"/><path class="hud-call-ar" d="M20.4 3.6 15.6 8.4"/></svg>',
  card:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.4"/><path d="M2.6 10h18.8"/><path d="M6 14.6h3.4"/></svg>',
  cal:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2"/><path d="M3.4 10h17.2"/><path d="M8 3.4v3.6M16 3.4v3.6"/></svg>',
  pin:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6.4-6 6.4-11a6.4 6.4 0 1 0-12.8 0c0 5 6.4 11 6.4 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  phone: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.4" y="2.8" width="11.2" height="18.4" rx="2.6"/><path d="M10.6 18.4h2.8"/></svg>',
  // Видеокамера: корпус и объектив-клин сбоку — тот же силуэт, что у значка
  // видео в мессенджерах, поэтому читается сразу и без подписи.
  video: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="6.4" width="12.8" height="11.2" rx="2.4"/><path d="m15.6 12 5.6-3.4v6.8z"/></svg>',
  // Пересылка: стрелка, уходящая вправо через сгиб — привычный силуэт.
  forward: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 5.4 20.4 11l-6.8 5.6v-3.2c-4.6 0-7.4 1.4-9.2 4.4.6-5.4 3.6-8.4 9.2-8.8z"/></svg>'
};
