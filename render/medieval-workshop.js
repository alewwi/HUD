// hud-manager/render/medieval-workshop.js
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0.
//
// Оформление «мастерской» для видов старины (render/medieval-views.js): эмалевые
// миниатюры под заголовком, камин у пересудов и восковые печати на письмах.
// Перенесено со стенда tests/tools/medieval-views-stand.html («Обновлённое»).
// Id градиентов у каждой картинки свои: карточек и вкладок на странице много,
// а ссылка на градиент из скрытой вкладки рисует пустоту.

import { hudHashSeed } from '../utils.js?v=23.90.10';

let счёт = 0;
const новыйId = (п) => `hud-ws-${п}-${(++счёт).toString(36)}`;
// Градиенты миниатюр: плейсхолдер @@ меняется на id картинки.
const BR = 'url(#@@-brass)';
const VE = 'url(#@@-vellum)';
const EN = 'url(#@@-enamel)';

const tankard = `<path d="M-7-4h-4c-5 0-5 10 0 11h4" stroke="#614534" stroke-width="3.8"/>
  <path d="M-7-4h-4c-5 0-5 10 0 11h4" stroke="#ecc888" stroke-width="1.8"/>
  <path d="M-8-8h16L7 11q-7 3-14 0z" fill="${EN}"/>
  <path d="M-6-4h12M-6 7H6" stroke="#87afa1" stroke-width=".7"/>
  <path d="M-1-3q-5 2 1 7 6-5 1-7l-1 2z" fill="${BR}" stroke="none"/>
  <ellipse cy="-8" rx="8.4" ry="2.2" fill="${BR}"/><ellipse cy="-8" rx="6.4" ry="1.1" fill="#57392b" stroke="none"/>
  <path d="M-7 10q7 2 14 0v2q-7 2-14 0z" fill="${BR}"/>`;

const tower = `<path d="M-7 0h14l-1 18H-6z" fill="#76868a"/><path d="M-8-5h4v3h2v-3h4v3h2v-3h4v6H-8z" fill="${VE}"/>
  <path d="M-1 8V5a1 1 0 0 1 2 0v3z" fill="#283644" stroke="none"/><path d="M-4 12h4m1 3h3" stroke="#b4b2a1" stroke-width=".75"/>`;

const motifs = {
  comments: `<g transform="translate(25 25) rotate(8)">${tankard}</g>
    <g transform="translate(47 25) rotate(-8) scale(-1 1)">${tankard}</g>
    <path d="M24 13c-4-3 3-4 0-7m24 7c-4-3 3-4 0-7" stroke="#e5cba2" stroke-width="1"/>`,
  news: `<path d="M21 27v10l6-3 6 2V25" fill="#a25055"/>
    <path d="M13 24q19 1 38-13l5 17q-23-4-41 2z" fill="${BR}"/>
    <ellipse cx="53.5" cy="19.5" rx="4" ry="9.2" transform="rotate(-16 53.5 19.5)" fill="#6d4334"/>
    <path d="m13 23 2 8-4 1-2-8z" fill="${BR}"/><path d="M18 25q17-1 30-8" stroke="#fff1c5"/>
    <path d="M18 31q1 12 9 9m-2-12 2 3 2-4" stroke="#e1b76b"/>`,
  factions: `<path d="M15 11q11 3 21-4 10 7 21 4v10q-1 13-21 20-20-7-21-20z" fill="${BR}"/>
    <path d="M19 15q9 1 17-4 8 5 17 4v6q-1 10-17 17-16-7-17-17z" fill="#843e50" stroke="#603c37"/>
    <path d="M24 20l6 4 6-9 6 9 6-4-4 10H28z" fill="${BR}"/>
    <path d="M29 32h14" stroke="#eaca8e"/><circle cx="36" cy="23" r="1.6" fill="#277065" stroke="none"/>`,
  city: `<path d="M23 21h26v16H23z" fill="#64727d"/><path d="M31 37v-7q5-9 10 0v7" fill="#27303d"/>
    <g transform="translate(19 19)">${tower}</g><g transform="translate(53 19)">${tower}</g>
    <path d="M36 19V6m0 1q5-3 13 0l-4 2 3 2q-6-2-12 0" fill="#b45c60"/>
    <path d="M12 38h48" stroke="#dbbd86"/>`,
  events: `<path d="M16 24v13m40-13v13M13 38h46" stroke="#c99758" stroke-width="2"/>
    <path d="M12 22Q26 17 36 9q10 8 24 13v3H12z" fill="#a94e50"/>
    <path d="M23 22q9-7 13-13l-3 13zm17 0-4-13q5 8 14 13z" fill="${VE}" stroke="none"/>
    <path d="M12 22h48v3q-4 5-8 0-4 5-8 0-4 5-8 0-4 5-8 0-4 5-8 0-4 5-8 0z" fill="${BR}"/>
    <path d="M36 9V3l10 2-10 3" fill="#569184"/><path d="M20 28v7h8m24-7v7h-8" stroke="#889989"/>`,
  almanac: `<circle cx="36" cy="8" r="3" fill="none"/><circle cx="36" cy="25" r="15.5" fill="${BR}"/>
    <circle cx="36" cy="25" r="13" fill="#244b57"/><circle cx="36" cy="25" r="11.2" stroke-dasharray=".8 2.1"/>
    <g class="instrument"><circle cx="36" cy="25" r="8.5" stroke="#87a6a2"/>
    <path d="m26 32 8-10 12-4-8 10z" fill="${BR}"/><circle cx="36" cy="25" r="1.7" fill="#ab5555"/></g>`,
  notes: `<path d="M14 32q7-3 20-2l8 6q-14-1-24 2z" fill="${VE}"/>
    <path d="M23 34q3-2 7-1" stroke="#816041"/>
    <path d="M30 30C29 18 41 7 55 6c-1 7-3 12-7 17l-5 1-1 4-9 2z" fill="${EN}"/>
    <path d="M26 34 51 10m-14 15 1-8m4 4 6-1" stroke="#efcf8e"/>
    <path d="M47 33h8l2 4v3H45v-3z" fill="#45435c"/><path d="M47 32h8v2h-8z" fill="${BR}"/>`,
  letters: `<rect x="16" y="12" width="40" height="25" rx="2.5" fill="${VE}"/>
    <path d="m17 35 13-12m25 12L42 23" stroke="#ae8353"/>
    <path d="m17 14 16 12q3 2 6 0l16-12" stroke="#8a6240"/>
    <path d="m34 27-1 11 4-3 3 1-2-10" fill="#99505c"/>
    <circle cx="36" cy="26" r="5.3" fill="#9e4b52"/><circle cx="36" cy="26" r="3.5" stroke="#d68072"/>
    <path d="m34 26 2-2 2 2-2 2z" fill="#ebbd7e" stroke="none"/>`,
  docs: `<path d="M23 8h28q-4 4-4 9v18H18q4-3 4-9V13z" fill="${VE}"/>
    <path d="M22 8q-5 0-5 5h5m27-5q6 0 5 5h-6M18 34h29q1 4-3 4H20q-3 0-2-4z" fill="#b78f60"/>
    <path d="M27 15h14m-14 4h12m-13 4h9m-10 6q3-5 5-2t5-1" stroke="#805a40"/>
    <path d="m38 30-3 10 4-2 3 3 1-11" fill="#944951"/><circle cx="40" cy="31" r="4.5" fill="#a95151"/>
    <path d="m38 31 2-2 2 2-2 2z" fill="#f3ca8a" stroke="none"/>`,
  keeps: `<path d="M12 13q13-4 24 1 11-5 24-1v23q-13-3-24 2-11-5-24-2z" fill="${EN}"/>
    <path d="M15 10q13-2 21 3v21q-9-5-21-3zm42 0q-13-2-21 3v21q9-5 21-3z" fill="${VE}"/>
    <path d="M36 13v22m6-16q5-2 10-2m-10 6q5-2 10-2m-10 6 7-2" stroke="#99754e"/>
    <path d="M21 27q6-6 7-13m-4 9q-6 0-6-5 5 0 6 5zm2-4q1-6 6-6 0 5-6 6z" fill="#537b67" stroke="#496954"/>`,
};

const leaf = `<path d="M0 0Q-2-9-14-10-11-1 0 0Z" fill="${EN}"/>
  <path d="m-1-1-9-6" stroke="#c2b380" stroke-width=".65"/>`;
const scrollwork = `<path d="M5 24C22 24 18 11 31 11c11 0 11 13 1 13-5 0-6-5-3-7
  M8 24c22 0 29 12 49 9 21-3 24-18 43-18 16 0 19 11 39 9" stroke="#d1a76f" stroke-width="1.4"/>
  <g transform="translate(46 33) rotate(-16)">${leaf}</g><g transform="translate(60 32) scale(1 -1)">${leaf}</g>
  <g transform="translate(77 23) rotate(15)">${leaf}</g><g transform="translate(99 15) rotate(26)">${leaf}</g>
  <g transform="translate(116 20) scale(1 -1) rotate(-20)">${leaf}</g>
  <path d="m2 24 3-2 3 2-3 2zm133 0 4-3 4 3-4 3z" fill="${BR}"/>`;


export function миниатюра(block) {
  if (!motifs[block]) return '';
  const branch = `<svg class="sprig" viewBox="0 0 144 48" preserveAspectRatio="xMidYMid meet">${scrollwork}</svg>`;
  return (`<span class="workshop-miniature" aria-hidden="true">${branch}
    <svg class="workshop-brooch" viewBox="0 0 72 48">
      <defs>
        <linearGradient id="@@-brass" x2=".25" y2="1"><stop stop-color="#faf0c1"/><stop offset=".5" stop-color="#d4ae70"/><stop offset="1" stop-color="#9b7144"/></linearGradient>
        <linearGradient id="@@-vellum" x2=".3" y2="1"><stop stop-color="#ffedc7"/><stop offset="1" stop-color="#cba578"/></linearGradient>
        <linearGradient id="@@-enamel" x2=".8" y2="1"><stop stop-color="#87b6a0"/><stop offset=".48" stop-color="#54877c"/><stop offset="1" stop-color="#285656"/></linearGradient>
        <radialGradient id="@@-ground"><stop stop-color="#38404b"/><stop offset="1" stop-color="#21222e"/></radialGradient>
      </defs>
      <rect x="1" y="1" width="70" height="46" rx="21" fill="url(#@@-ground)" stroke="${BR}" stroke-width="1.4"/>
      <rect x="3.6" y="3.6" width="64.8" height="40.8" rx="18.5" stroke="#9e825c" stroke-width=".65" stroke-dasharray="1 2"/>
      ${motifs[block]}</svg>${branch}</span>`).replaceAll('@@', новыйId('m'));
}

export function каминМастерской() {
  const id = новыйId('h');
  const stone = ['#8b7060', '#ac9380', '#957864', '#ad9278'];
  const arch = Array.from({ length: 11 }, (_, i) =>
    `<path transform="rotate(${(i - 5) * 180 / 11} 90 89)" d="M81.4 28.5Q90 26.8 98.6 28.5L95.6 48.4Q90 47.5 84.4 48.4Z" fill="${i === 5 ? '#c5a383' : stone[i % 4]}"/>`).join('');
  return `<svg class="workshop-hearth" viewBox="0 0 180 146" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${id}-light" cx="50%" cy="90%" r="80%"><stop stop-color="#b65329"/><stop offset=".54" stop-color="#4a2927"/><stop offset="1" stop-color="#1d1921"/></radialGradient>
      <linearGradient id="${id}-flame" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#f29b44"/><stop offset="1" stop-color="#d74924"/></linearGradient>
    </defs>
    <path d="M29 126V89a61 61 0 0 1 122 0v37z" fill="#493a35"/>
    <path d="M48 124V89a42 42 0 0 1 84 0v35z" fill="url(#${id}-light)"/>
    <g stroke="#554237" stroke-width="1.1" stroke-linejoin="round">${arch}
      <path d="M30 89h18v17H29zM132 89h19v17h-19z" fill="#a28770"/>
      <path d="M28 107h21v18H28zM131 107h21v18h-21z" fill="#8f7566"/>
      <path d="M22 124h136l4 6H18z" fill="#c1a589"/><path d="M18 130h144v6H18z" fill="#745944"/>
    </g>
    <g class="hearth-blaze">
      <path d="M72 114c-13-14-1-22-2-32 8 6 9 13 11 15 0-17 14-19 12-37 16 18-1 30 10 37 4-7 9-9 10-16 9 19 2 34-12 37z" fill="url(#${id}-flame)"/>
      <path d="M80 115c-5-8-1-13 2-19 0 5 3 7 5 8 1-9 7-12 8-21 7 12-2 20 5 23l5-7c2 12-6 18-16 19z" fill="#ffcd69"/>
    </g>
    <g stroke="#3d2622" stroke-linejoin="round"><path d="m64 111 48 6-3 6-47-6z" fill="#87503a"/><path d="m71 119 40-12 4 5-42 12z" fill="#a06242"/></g>
    <path d="m68 114 18 3m-8 4 17-5m7-4 8-2" fill="none" stroke="#f19b58" stroke-linecap="round"/>
    <g class="hearth-embers" fill="#ffc477"><circle cx="84" cy="78" r="1.3"/><circle cx="100" cy="67" r="1"/><circle cx="78" cy="87" r=".9"/></g>
  </svg>`;
}

// --- Восковые печати писем ------------------------------------------------
// Обе половины разлома вырезаны из одной отливки вместе с гербом.
const casting = 'M22 39C21 32 26 26 29 22C31 17 37 18 42 15C48 12 52 16 57 14C64 12 67 18 70 21C76 24 73 31 78 36C81 42 76 47 75 52C74 59 70 62 64 63C59 64 56 69 51 67C47 65 44 70 39 66C36 63 31 65 28 61C26 57 22 56 22 51C23 46 19 45 22 39Z';
const crack = 'M53 9 49 23 52 29 46 36 50 40 44 48 47 53 40 60 42 72';
// Замкнутые контуры дают фаску, открытые линии — тонкую гравировку герба.
const devices = [
  { name: 'sun', face: 'M50 25l2.5 7 5.5-3-1 6 8 1-6 5 5 5-8-1 1 8-6-5-3 8-2-8-7 4 2-7-8-1 6-5-5-5 8 1-1-7 6 4z', engraving: 'M56 40a6 6 0 1 0-12 0 6 6 0 1 0 12 0z' },
  { name: 'stag', face: 'M45 39 39 34 35 33 38 39 44 43 45 49 49 53 52 52 55 46 56 42 62 37 63 33 58 35 54 39Q50 36 45 39Z', engraving: 'M45 39 42 33 38 30 37 25M42 33 43 28 41 24M54 39 58 31 62 28 63 24M58 31 56 27 57 23M46 43l2 1m6-1-2 1m-3 6h2' },
  { name: 'rose', face: 'M50 29c6-8 13 0 10 6 10 2 6 12-1 12-1 10-11 10-14 3-9 5-15-4-9-10-6-7 2-15 9-10z', engraving: 'M45 35q4-6 10-2 7 5 0 12-7 6-13-1-4-6 2-8 6-3 9 2 1 4-4 4l-2-3' },
  { name: 'key', face: 'M44 30a7 7 0 1 0 1 11l11 11 6-6-2-2-3 3-2-2 3-3-2-2-3 3-6-6q2-4-3-7z', engraving: 'M43 35a2.8 2.8 0 1 0-5.6 0 2.8 2.8 0 1 0 5.6 0z' },
  { name: 'raven', face: 'M34 49l7-9q1-6 8-7 2-9 10-6l5 4-6 1q3 13-11 16l-9 6 2-7z', engraving: 'M42 43q7-1 12-8m-6 13-1 5m5-6 1 5m4-22h1' },
  { name: 'moon', face: 'M54 27a14 14 0 1 0 8 22q-13 4-18-6-4-10 10-16z M58 29l1.4 4 4 1.3-4 1.4-1.4 4-1.4-4-4-1.4 4-1.3z', engraving: 'M40 40q0 7 6 11' },
  { name: 'tower', face: 'M39 28h5v5h4v-5h4v5h4v-5h5v10l-3 3 2 12H40l2-12-3-3z', engraving: 'M46 52v-6q4-7 8 0v6M41 38h18m-15 3h4m5 0h4' },
  { name: 'oak', face: 'M40 48q-8-5-1-9-6-6 2-7-1-8 6-5 2-6 6 0 11-4 7 4 8 1 3 7 4 6-5 6-1 8-9 5l-8 6-2-2 6-6z', engraving: 'M42 49l15-18m-8 10-5-4m7 2 6 1m-11 5-4-2' },
  { name: 'ship', face: 'M37 46q12 3 26-2l-6 8H43z M48 30l-9 13h9z M52 28q8 5 9 14l-9 1z', engraving: 'M50 26v20m0-19 7 1-7 2M37 54q4-3 8 0 4-3 8 0 4-3 8-1' },
];

function svgПечати(id, device) {
  return `<svg class="letter-wax" data-device="${device.name}" viewBox="0 0 100 84" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${id}-edge" x2=".45" y2="1"><stop stop-color="var(--wax-glint)"/><stop offset=".38" stop-color="var(--wax-mid)"/><stop offset=".76" stop-color="var(--cast)"/><stop offset="1" stop-color="var(--wax-deep)"/></linearGradient>
      <radialGradient id="${id}-face" cx=".34" cy=".24" r=".88"><stop stop-color="var(--wax-mid)"/><stop offset=".66" stop-color="var(--cast)"/><stop offset="1" stop-color="var(--wax-deep)"/></radialGradient>
      <filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="8"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <clipPath id="${id}-a"><path d="${crack}H8V9Z"/></clipPath>
      <clipPath id="${id}-b"><path d="${crack}H93V9Z"/></clipPath>
      <clipPath id="${id}-rim"><path d="${casting}"/></clipPath>
      <g id="${id}-stamp">
        <path d="${casting}" transform="translate(0 2)" fill="var(--wax-deep)"/>
        <path d="${casting}" fill="url(#${id}-edge)" stroke="var(--wax-deep)" stroke-width=".8"/>
        <path d="M25 39q1-8 6-13m5-5 7-3m16-1q6-1 9 5m4 34-5 5" fill="none" stroke="var(--wax-glint)" stroke-linecap="round" opacity=".64"/>
        <ellipse cx="50" cy="40.5" rx="21" ry="20.5" fill="url(#${id}-face)" stroke="url(#${id}-edge)" stroke-width="2.4"/>
        <ellipse cx="50" cy="41" rx="18.7" ry="18.3" fill="none" stroke="var(--wax-mid)" stroke-width="1.3" stroke-dasharray=".2 2.1" stroke-linecap="round"/>
        <g stroke-linecap="round" stroke-linejoin="round">
          <path d="${device.face}" transform="translate(.5 1)" stroke="var(--wax-glint)" fill="var(--wax-mid)" stroke-width="2"/>
          <path d="${device.face}" stroke="var(--wax-deep)" fill="var(--cast)" stroke-width="1.4"/>
          <path d="${device.engraving}" transform="translate(.3 .65)" fill="none" stroke="var(--wax-glint)" stroke-width="1.4"/>
          <path d="${device.engraving}" fill="none" stroke="var(--wax-deep)" stroke-width="1.25"/>
        </g>
        <path d="${casting}" filter="url(#${id}-grain)" opacity=".105"/>
      </g>
    </defs>
    <g class="wax-shadow">
      <use class="wax-whole" href="#${id}-stamp"/>
      ${['a', 'b'].map((half) => `<g class="wax-shard shard-${half}"><g clip-path="url(#${id}-${half})"><use href="#${id}-stamp"/>
        <path d="${crack}" clip-path="url(#${id}-rim)" fill="none" stroke="${half === 'b' ? 'var(--wax-mid)' : 'var(--wax-deep)'}" stroke-width="2.6"/>
      </g></g>`).join('')}
    </g>
  </svg>`;
}

// Какой герб у письма — только по самому письму (от кого, кому, текст, печать),
// как число реакций у комментария — по его тексту. У разных писем печати
// разные, а письмо, которое пришло снова (из снимка прошлого хода), — с той
// же печатью при любом порядке и новых письмах рядом. Второй аргумент оставлен
// для совместимости и не влияет.
export function гербПисьма(l) {
  const по = (v) => String(v ?? '');
  return hudHashSeed([по(l && l.from), по(l && l.to), по(l && l.text), по(l && l.seal)].join('|')) % devices.length;
}
/** Восковая печать-застёжка на письме: цвет воска и номер герба. */
export function печатьМастерской(цвет, герб) {
  return `<span class="wax-fastener" style="--cast:${цвет}" aria-hidden="true">${svgПечати(новыйId('w'), devices[герб % devices.length])}</span>`;
}
