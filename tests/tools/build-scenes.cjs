// Рисунки тем и мелких украшений (css/scenes.css) → img/scene/*.svg.
// Запуск: node tests/tools/build-scenes.cjs — перезаписывает файлы.
// Всё нарисовано заново (стенд идей, tests/tools/ideas-stand.html). Цвета
// в файлах — фиксированные: SVG-картинка не видит переменных темы; где
// нужен цвет темы, CSS кладёт рисунок маской на заливку акцентом.
const fs = require('fs');
const path = require('path');
const ПАПКА = path.join(__dirname, '..', '..', 'img', 'scene');
const f = (n) => (+n).toFixed(1);
const кр = (cx, cy, r) => `M${f(cx + r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0`;
const файлы = {};
const svg = (имя, viewBox, тело, defs = '', атр = '') => { файлы[имя] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${атр}>${defs ? `<defs>${defs}</defs>` : ''}${тело}</svg>`; };

// ---------- Тушь: маски линий (белое — видно) ----------
// Тянутся на всю рамку маски (preserveAspectRatio="none"), толщина линий — постоянная.
svg('ink-top.svg', '0 0 200 10', '<path d="M0 2H200M0 7.5H200" stroke="url(#и)" stroke-width="1.6" fill="none" vector-effect="non-scaling-stroke"/>',
  '<linearGradient id="и" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff"/></linearGradient>', ' preserveAspectRatio="none"');
svg('ink-corner.svg', '0 0 200 120', '<path d="M1.5 0V117H200M5 0V111H200" stroke="#fff" stroke-width="2" fill="none" vector-effect="non-scaling-stroke" mask="url(#м)"/>',
  '<radialGradient id="р" cx="0" cy="1" r="1"><stop offset="0" stop-color="#fff"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="м"><rect width="200" height="120" fill="url(#р)"/></mask>', ' preserveAspectRatio="none"');

// ---------- Кот на краю ----------
svg('cat.svg', '0 0 120 64', `<g fill="#241a33"><path d="M22 40L18 6L44 24Q60 18 76 24L102 6L98 40Q98 62 60 62Q22 62 22 40Z"/><ellipse cx="34" cy="62" rx="13" ry="7"/><ellipse cx="86" cy="62" rx="13" ry="7"/></g><path d="M24 12L40 25M96 12L80 25" stroke="#3a2b4a" stroke-width="3"/><g fill="#e9c46a"><ellipse cx="46" cy="40" rx="7" ry="8"/><ellipse cx="74" cy="40" rx="7" ry="8"/></g><g fill="#120d18"><ellipse cx="46" cy="40" rx="2.2" ry="6"/><ellipse cx="74" cy="40" rx="2.2" ry="6"/></g><path d="M57 50L63 50L60 53Z" fill="#d98fa7"/><g stroke="#c8b6dc" stroke-width="1.2" opacity=".7"><path d="M40 52L22 50M40 55L23 57M80 52L98 50M80 55L97 57"/></g><g stroke="#3a2b4a" stroke-width="1.6"><path d="M28 62v4M34 63v4M40 62v4M80 62v4M86 63v4M92 62v4"/></g>`);

// ---------- Тема «Чаепитие» (css/themes/teaparty.css) ----------
{
  const Р = { rose: '#d16171', roseDeep: '#b44c5f', cream: '#ffe7cb', paper: '#fff8ee', white: '#fffdf9', plum: '#8f6980', plumDeep: '#6e4f63', pink: '#eb9bb6', pinkSoft: '#fbd9e3', gold: '#efc983', goldDeep: '#c99a55', ink: '#5e3a4a' };
  const М = {
    heart: 'M8 14.2C3.2 10.8 1 8.3 1 5.6 1 3.4 2.7 1.8 4.7 1.8c1.5 0 2.7.8 3.3 2.1.6-1.3 1.8-2.1 3.3-2.1 2 0 3.7 1.6 3.7 3.8 0 2.7-2.2 5.2-7 8.6Z',
    diamond: 'M8 1C9.6 3.8 11.6 6.1 14 8c-2.4 1.9-4.4 4.2-6 7-1.6-2.8-3.6-5.1-6-7 2.4-1.9 4.4-4.2 6-7Z',
    club: 'M8 1.2a3.1 3.1 0 0 1 2.4 5.1 3.1 3.1 0 1 1-1.5 5.1L9.8 15H6.2l.9-3.6a3.1 3.1 0 1 1-1.5-5.1A3.1 3.1 0 0 1 8 1.2Z',
    spade: 'M8 1c1.8 2.6 6.4 4.8 6.4 8.2 0 2-1.5 3.4-3.3 3.4-1 0-1.9-.4-2.5-1.1L9.6 15H6.4l1-3.5c-.6.7-1.5 1.1-2.5 1.1-1.8 0-3.3-1.4-3.3-3.4C1.6 5.8 6.2 3.6 8 1Z',
  };
  for (const [м, цвет] of [['heart', Р.rose], ['spade', Р.plum], ['diamond', Р.rose], ['club', Р.plum]]) svg(`teaparty/suit-${м}.svg`, '0 0 16 16', `<path d="${М[м]}" fill="${цвет}"/>`);
  svg('teaparty/suit-heart-white.svg', '0 0 16 16', `<path d="${М.heart}" fill="${Р.white}"/>`);
  svg('teaparty/wall.svg', '0 0 96 96', `<rect width="48" height="96" fill="${Р.pinkSoft}" opacity=".35"/><g opacity=".12"><path transform="translate(16 14)" d="${М.heart}" fill="${Р.rose}"/><path transform="translate(64 62)" d="${М.club}" fill="${Р.plum}"/><path transform="translate(64 14)" d="${М.diamond}" fill="${Р.rose}"/><path transform="translate(16 62)" d="${М.spade}" fill="${Р.plum}"/></g>`);
  svg('teaparty/lace.svg', '0 0 20 10', `<path d="M0 0H20V2.6Q15 11 10 2.6Q5 11 0 2.6Z" fill="${Р.white}"/><circle cx="5" cy="4" r="1.1" fill="${Р.pink}"/><circle cx="15" cy="4" r="1.1" fill="${Р.pink}"/><path d="M0 2.6Q5 11 10 2.6Q15 11 20 2.6" fill="none" stroke="${Р.pink}" stroke-width=".6"/>`);
  svg('teaparty/bunting.svg', '0 0 120 30', `<path d="M0 3Q60 16 120 3" fill="none" stroke="${Р.goldDeep}" stroke-width="1.1"/>` + [[10, Р.rose], [30, Р.paper], [50, Р.plum], [70, Р.gold], [90, Р.pink], [110, Р.paper]].map(([x, c], i) => { const y = 3 + 13 * (1 - Math.pow((x - 60) / 60, 2)) * .98; return `<path d="M${x - 7} ${f(y)}L${x + 7} ${f(y + .3)}L${x} ${f(y + 15)}Z" fill="${c}" stroke="${Р.roseDeep}" stroke-width=".6" stroke-linejoin="round"/>` + (i % 3 === 1 ? `<path transform="translate(${x - 3} ${f(y + 2.5)}) scale(.38)" d="${М.heart}" fill="${Р.rose}"/>` : ''); }).join(''));
  svg('teaparty/flourish.svg', '0 0 160 16', `<path d="M4 9C30 3 52 13 78 8c10-2 14-6 9-7-4-1-7 4-2 6 12 4 40-6 70 0" fill="none" stroke="${Р.goldDeep}" stroke-width="1.3" stroke-linecap="round"/><path transform="translate(74 4) scale(.45)" d="${М.heart}" fill="${Р.rose}"/>`);
  svg('teaparty/crown.svg', '0 0 40 26', `<path d="M4 21 6.5 7l7 7L20 3l6.5 11 7-7L36 21Z" fill="${Р.gold}" stroke="${Р.goldDeep}" stroke-width="1.3" stroke-linejoin="round"/><rect x="4" y="20" width="32" height="4.5" rx="1.5" fill="${Р.goldDeep}"/><circle cx="20" cy="3.4" r="2.4" fill="${Р.rose}"/><circle cx="6.5" cy="7" r="1.7" fill="${Р.white}"/><circle cx="33.5" cy="7" r="1.7" fill="${Р.white}"/><path transform="translate(16.5 15.5) scale(.44)" d="${М.heart}" fill="${Р.rose}"/>`);
  svg('teaparty/watch.svg', '0 0 40 70', `<path d="M20 0V22" stroke="${Р.goldDeep}" stroke-width="2" stroke-dasharray="2.6 1.6"/><circle cx="20" cy="24" r="3" fill="none" stroke="${Р.goldDeep}" stroke-width="1.6"/><circle cx="20" cy="46" r="17" fill="${Р.gold}" stroke="${Р.goldDeep}" stroke-width="1.6"/><circle cx="20" cy="46" r="13" fill="${Р.white}" stroke="${Р.goldDeep}" stroke-width=".8"/>` + Array.from({ length: 12 }, (_, i) => { const у = i * Math.PI / 6; return `<path d="M${f(20 + 11 * Math.sin(у))} ${f(46 - 11 * Math.cos(у))}L${f(20 + 12.4 * Math.sin(у))} ${f(46 - 12.4 * Math.cos(у))}" stroke="${Р.ink}" stroke-width="${i % 3 ? .8 : 1.4}"/>`; }).join('') + `<path d="M20 46V37" stroke="${Р.ink}" stroke-width="1.6" stroke-linecap="round"/><path d="M20 46l6 3.4" stroke="${Р.rose}" stroke-width="1.3" stroke-linecap="round"/><circle cx="20" cy="46" r="1.4" fill="${Р.ink}"/>`);
  const пип = (поворот) => `<g${поворот ? ' transform="rotate(180 10 16)"' : ''}><text x="10" y="13" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="14" fill="${Р.roseDeep}">Q</text><path transform="translate(3.5 16) scale(.8)" d="${М.heart}" fill="${Р.rose}"/></g>`;
  svg('teaparty/pip-tl.svg', '0 0 20 32', пип(false));
  svg('teaparty/pip-br.svg', '0 0 20 32', пип(true));
  svg('teaparty/cup.svg', '0 0 24 24', `<g fill="none" stroke="${Р.roseDeep}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6c-1-1.2.9-2 0-3.3M13.5 6c-1-1.2.9-2 0-3.3" opacity=".7"/><path d="M4 9h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6Z"/><path d="M17 10.5h1.6a2.3 2.3 0 0 1 0 4.6H16.6"/><path d="M3 21h16"/></g>`);
  svg('teaparty/teapot.svg', '0 0 24 24', `<g fill="none" stroke="${Р.roseDeep}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9h10c1.6 2 1.6 7-1 9H8c-2.6-2-2.6-7-1-9Z"/><path d="M10 9V7.6h4V9M12 7.6V6"/><path d="M17.4 11.4l3-2.4M5.8 11c-2-.6-3 1.6-1.6 3l2 1.6"/></g>`);
}

// ---------- Тема «Буллет-джорнал» (css/themes/bujo.css) ----------
{
  const край = 'M2 1 4 3 1 6 3 9 1 12 4 15 2 18 4 21 2 23 98 23 96 21 99 18 97 15 99 12 96 9 99 6 97 3 99 1Z';
  const скотч = (имя, a, b, угол) => svg(`bujo/${имя}.svg`, '0 0 110 36', `<g transform="rotate(${угол} 55 18)"><clipPath id="к"><path transform="translate(5 6)" d="${край}"/></clipPath><g clip-path="url(#к)" opacity=".86"><rect x="0" y="0" width="110" height="36" fill="${a}"/>${Array.from({ length: 18 }, (_, i) => `<path d="M${i * 12 - 30} 40L${i * 12 + 10} 0" stroke="${b}" stroke-width="6"/>`).join('')}</g></g>`);
  скотч('tape-a', '#94b4c1', '#b9d0d9', -6);
  скотч('tape-b', '#c9a77c', '#e2c9a3', 5);
  svg('bujo/fibers.svg', '0 0 220 220', `<filter id="ф"><feTurbulence type="fractalNoise" baseFrequency=".65 .04" numOctaves="3" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .12 0"/></filter><rect width="220" height="220" filter="url(#ф)"/>`);
  svg('bujo/pen.svg', '0 0 24 24', `<g fill="none" stroke="#9fb7c4" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5L9 20H4v-5Z"/><path d="M13 6l5 5"/></g>`);
  svg('bujo/bookmark.svg', '0 0 24 24', `<g fill="none" stroke="#9fb7c4" stroke-width="1.2" stroke-linejoin="round"><path d="M7 3h10v18l-5-4-5 4Z"/></g>`);
}

module.exports = { svg, f, кр, файлы };
if (require.main === module) {
  // Сцены тем — отдельным модулем, чтобы этот файл оставался обозримым.
  try { require('./build-scenes-themes.cjs')({ svg, f, кр }); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  fs.mkdirSync(ПАПКА, { recursive: true });
  for (const [имя, текст] of Object.entries(файлы)) {
    const куда = path.join(ПАПКА, имя);
    fs.mkdirSync(path.dirname(куда), { recursive: true });
    fs.writeFileSync(куда, текст + '\n');
  }
  console.log('img/scene: ' + Object.keys(файлы).length + ' файлов');
}
