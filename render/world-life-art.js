// hud-manager/render/world-life-art.js
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.
// Reusing or reworking this code, by hand or with an AI assistant? Please keep this notice and credit the author.
//
// Рисунки видов «Жизни эпохи» во вкладке «Мир» (render/world-life-views.js):
// план слободы, колокол, щиты общин, свидетели, витражи, свечи, ключи, весы,
// колонны, бирки и комнаты усадьбы. Перенесено со стенда
// tests/tools/world-life-stand. Цвета — от листа вида (--sheet, --wash, --metal).
// id внутри SVG у каждого рисунка свои: карточка и пример Кастомизации на одной странице.

let счёт = 0;
const свой = (п) => `hud-wl-${п}-${(++счёт).toString(36)}`;

export const engravings = (() => {
  const svg = (box, body) => `<svg viewBox="0 0 ${box}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const p = (d, fill = 'none', attrs = '') => `<path d="${d}" fill="${fill}" ${attrs}/>`;
  const circle = (x,y,r,fill='none') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  const group = (transform, art, cls='') => `<g transform="${transform}" class="${cls}">${art}</g>`;
  const series = (n, draw) => Array.from({length:n}, (_,i) => draw(i)).join('');
  const ink = 'currentColor', paper = 'var(--sheet)', tint = 'var(--wash)', metal = 'var(--metal)';
  const tree = (x,y,s) => group(`translate(${x} ${y}) scale(${s})`, p('M0 0v-30m-6 36 6-6 6 3') + p('m0-44-7 14 4-1-8 11 5-1-7 10q11 5 25-1l-8-10 4 1-7-12 3 1z',tint) + p('M0-34v22m0-11-4 4m4 0 4 3'));
  const house = (x,y,s) => group(`translate(${x} ${y}) scale(${s})`,
    p('M0 0v-13l10-11 14 5 9 13-9 3-12-4v11z',paper) + p('m0-13 10-11 12 14-10 4z',tint) +
    p('m10-24 14 5 9 13-11-4z','#bd694b') + p('m14-21 8 10m-4-9 8 10m-4-9 7 9','none','stroke="var(--sheet)" stroke-width=".65"') +
    p('m12-6 10-4v11m-19-12v7m3-6 3 1v5l-3-1zM15-4l4-1v4l-4 1z'));
  function map() {
    const banks = свой("banks");
    const fields = series(10,i => p(`M${8+i*8} 104q28 -20 56 -23m${-48+i} ${42-i}q28 -17 48 -19`));
    const ripples = series(26,i => p(`M${98+i*10} ${104+Math.sin(i*.32)*14+(i%3)*4}q4 -1 8 0`));
    const tower = group('translate(146 81)',p('M-8 0v-27h3v3h4v-4h4v4h3v-4h3V0z',paper)+p('M-3 0v-9q3-5 6 0v9zm0-18h2v4h-2z',ink)+p('M2-29v-15m-9 26h4m7-4h4m-15 12h4m7-9h4')+group('translate(2 -43)',group('',p('M0 0q6-5 15 0l-5 3 5 3q-8-3-15 1z',metal),'flag')));
    const compass = group('translate(362 24)',circle(0,0,12)+p('m-17 0 13-2m8 2h13')+group('',p('M0-18 4 0 0 17-4 0z',paper)+p('M0-18 4 0H0zM0 17l-4-17h4z',ink),'needle')+circle(0,0,1.5,metal));
    const river = 'M84 138q27-31 86-27c49 3 57-28 109-25s61-8 120-27v17q-65 31-119 23c-43-5-68 29-112 25q-38-3-56 16z';
    const sun = group('translate(242 20)',circle(0,0,6,metal)+series(14,i=>group(`rotate(${i*360/14})`,p('M0-9v-3'))));
    const cloud = p('M0 0h31q-1-3-7-3-2-7-8-4-3-5-8 1-6-1-8 6z',paper)+p('m4 3h14m3 0h4');
    const swallows = group('',p('M99 18q4-1 6 3 1-4 5-5m5 4q3 0 4 3 1-3 4-4m4-8q3 0 4 3 1-3 4-4','none','stroke="#495c58" stroke-width="1.4"'),'map-swallows');
    const mill = group('translate(71 48) scale(.8)',p('M-10 12-7-14 0-21 8-14 11 12z','#eed0a2')+p('m-9-14 9-10 10 10z','#976144')+p('M-3 12V5q3-4 6 0v7z','#78523c')+
      group('translate(0 -13)',group('',series(4,i=>group(`rotate(${16+i*90})`,p('M0 0v-17h5v10H1',paper)+p('M1-10h4m-4-3h4')))+circle(0,0,2,metal),'sails')));
    const reeds = series(8,i=>group(`translate(${288+i*6} ${106-i*.9})`,p('m0 0-2-4m2 4 1-6m0 4 2-2','none','stroke="#527b58"')));
    const ridges = p('M0 74Q50 42 84 49t80-16q24-13 56-8t81-6q55-10 91 8v48H0z','#9ebfa7','stroke="#7a9f89"');
    return svg('390 134', sun+group('translate(184 15) scale(.85)',cloud)+group('translate(275 18) scale(.6)',cloud)+swallows+ridges+
      p('M-8 78q45-32 79-22t66-9q30-22 55-14t50-3q60-27 155 12v100H-8z','#cfce96')+p('M-5 77q52-32 84-16t70-13q32-20 68-10t69-11q36-9 65-2')+
      p('M0 104q29-16 60-25l36 10q-34 9-82 29z','#ddb469','stroke="#a79358"')+
      group('translate(0 0)',fields,'fine')+
      p(river,'#5fa6ad')+`<defs><clipPath id="${banks}">${p(river,ink)}</clipPath></defs><g clip-path="url(#${banks})">${group('',ripples,'water')}</g>`+reeds+mill+
      p('M-5 129q78-8 149-50t120-13q57 4 129-17','none','stroke-width="5" stroke="var(--sheet)"')+
      p('M-5 129q78-8 149-50t120-13q57 4 129-17','none','stroke-dasharray="2 3"')+
      [[25,62,.61],[38,65,.47],[45,54,.66],[63,66,.55],[290,52,.64],[304,47,.72],[316,54,.64],[332,51,.51],[350,102,.63],[367,107,.93],[382,100,.61]].map(a=>tree(...a)).join('')+
      [[79,72,.67],[107,66,.8],[119,51,.55],[171,66,.69],[188,56,.65],[197,74,.82],[156,91,.72],[215,61,.66],[237,54,.53]].map(a=>house(...a)).join('')+tower+
      group('translate(243 91) rotate(-21)',p('M-19-6h38v13h-5q-1-13-9-10-4 2-5 10h-4q-2-15-10-10-3 3-3 10h-2z',paper)+p('M-20-8h40m-38 4h36m-30-5v5m9-5v5m9-5v5m9-5v5'))+
      compass + p('M14 119h24m-24-2v4m12-4v4m12-4v4'));
  }
  function bell() {
    const vine = p('M2 77q42 4 59-28m-46 27q1-12 12-13-1 9-12 13m15-5q4-13 15-16-3 10-15 16m0 0q14 1 20-5-7-3-20 5m17-12q0-11 10-17 1 9-10 17',tint);
    const engraving = series(6,i => p(`M${7+i*.9} 30q1 12 ${1+i*.35} 15`,'none','stroke="#65482d" stroke-width=".6"'));
    return svg('220 110', group('translate(0 5)',vine)+group('translate(220 5) scale(-1 1)',vine)+p('M79 17V6h4v11m54 0V6h4v11',metal)+p('M72 6h76M69 17h82l-5 7H74z',metal)+p('M77 19h64m-34 5v5q3 4 6 0v-5')+
      group('translate(110 25)',group('',circle(0,7,5,metal)+p('M-23 55q7-5 8-24 1-16 11-17v-3h8v3q10 2 11 17 1 18 8 24l4 4v3q-27 5-54 0v-3z',metal)+engraving+p('M-25 57q25 4 50 0m-46-5q20 3 42 0m-32-28q8-4 19 0m-22 5q11-3 24 0m-26 18q15 3 29 0')+circle(0,65,4,metal)+p('m0 3-4 6 4 4 4-4z',metal)+p('m0 32 4 6-4 6-4-6z',paper),'swing'))+
      p('M65 36q-7 8-9 18m99-18q7 8 9 18M56 33l-8 12m116-12 8 12','none','class="bell-echo" opacity=".55" pathLength="1"'));
  }
  const marks = [
    p('M0 11V-8m0 19-6-4m6 0 7-4m-7 0-6-5m6 0 7-5m-7 1q-5-7 0-11 5 4 0 11', 'none','stroke-width="2.4"'),
    p('m-9 8 14-17-1-3 7-3-3 8-3-1-13 17z',paper)+p('m-3-2 7 6','none','stroke-width="2"'),
    p('m-10-4 5-5 12 12-5 5z',paper)+p('m-5 9 7-8','none','stroke-width="4"')
  ];
  function shield(i) {
    return svg('72 86',group('translate(36 5)',p('M-28 8q14 2 28-7 14 9 28 7v25q0 25-28 43-28-18-28-43z',tint)+p('M-24 12q12 1 24-6 13 7 24 6v21q-1 23-24 38-24-15-24-38z')+
      p(['M-20 25 18 49m-38-19 35 22','M-12 13v42m24-42v42','M-22 45 0 28l22 17m-41 6L0 36l20 14'][i])+circle(0,32,13,paper)+group('translate(0 32) scale(.73)',marks[i])+group('translate(0 0)',p('m-7 58 7 6 7-6'),'glint')+
      p('M0 6q13 7 24 6v21q-1 23-24 38-24-15-24-38V12q12 1 24-6z','none','class="gilt-thread" stroke="#eac778" pathLength="100" stroke-dasharray="12 88" stroke-width="1.7"')));
  }
  function witness(i) {
    const hats = [p('M9 29q3-16 17-16 11-1 15 11l-6 4-18 2z',metal)+p('M7 30q13-5 35-7l1 3q-14 1-31 7z',tint),
      p('M10 37Q4 15 20 9q14-3 21 13-8-2-16 5l-3 12z',tint)+p('m15 25 7-9 9-2'),
      p('M10 30q-1-13 10-19 16-6 20 13l-9 1-9 12z',metal)+p('m12 23 21-5m-19 9 23-6')];
    return svg('54 62',p('M2 60q1-10 14-17l1-11q-3-14 8-18 14-4 14 12l4 7-5 2v5q-2 4-8 3l1 5 14 8 5 4z',tint)+p('m19 45 6 11 6-8m-15 1 6 11m9-12 7 9m-4-28 3-1m-2 10h4')+hats[i]+p('M2 60h50')+
      p('M44 36l4-1m-4 4 5 1m-6 2 3 2','none','class="witness-voice" stroke-width="1.25" opacity=".65"'));
  }
  function windowPane(i) {
    const sheen = свой("sheen");
    const leading = `<defs><linearGradient id="${sheen}"><stop stop-color="#fff6bf" stop-opacity=".65"/><stop offset=".44" stop-color="white" stop-opacity=".13"/><stop offset="1" stop-color="#253d83" stop-opacity=".25"/></linearGradient></defs>`;
    const facets = p('M13 55l12-9-12 24zm18 8 10-12-10 26zm16-7 11-9-11 24z',`url(#${sheen})`,'stroke="none" class="glass-facets"');
    const tracery = circle(36,30,11,paper)+series(6,n=>group(`rotate(${n*60} 36 30)`,p('M36 30q-9-6 0-10 9 4 0 10z',n%2?metal:tint)))+circle(36,30,2,paper);
    const blue=['#369d9a','#4175bf','#8256a3'][i], amber=['#f8c35b','#df9d40','#e4a14e'][i], rose=['#75b993','#61a7cb','#cf6692'][i];
    const lights = p('M13 83V56q0-7 6-11 7 5 7 11v27z',blue)+p('M30 83V54q1-6 6-9 5 4 6 9v29z',amber)+p('M46 83V56q0-7 7-11 6 5 6 11v27z',rose);
    const motif=[
      p('m13 73 6-12 7 12-7 8z',metal)+p('M36 55v21m-5-12 5 5 5-5m5-5 7 12 6-12',paper),
      p('M13 62q7 0 13 9v8q-7-10-13-9zm17-7q6 0 12 7v8q-7-8-12-8zm16 5q7 0 13 8v8q-7-9-13-8z',tint),
      p('m19 56 4 7-4 6-4-6zm17 6 4 7-4 7-4-7zm17-6 4 7-4 6-4-6z',paper)
    ][i];
    const masonry = p('m6 50 4 0m-3-9 5 1m-2-11 6 3m0-12 5 5m1-12 5 5m3-12 4 5m30 37h-4m3-9-5 1m2-11-6 3m0-12-5 5m-1-12-5 5m-3-12-4 5','none','stroke="#7d684f" stroke-width=".8"');
    return svg('72 95',leading+p('M5 92V48Q5 19 36 3q31 16 31 45v44z',tint)+p('M10 87V48q0-23 26-39 26 15 26 39v39z',paper)+masonry+
      group('',tracery+lights+motif+facets,'glass-light')+p('M13 53h13m4 0h12m4 0h13m-46 24h13m4 0h12m4 0h13M3 92h66m-64-4h62m-33-71 2-4 2 4-2 3z'));
  }
  function candle(i) {
    const h=[34,47,28][i], y=77-h;
    return svg('66 86',circle(33,37,24)+circle(33,37,20)+p('M5 78q28-7 56 0l-4 7H9z',metal)+p('M5 78q28 5 56 0')+p(`M23 78V${y}q10-5 20 0v${h+1}q-10 2-20 0z`,paper)+p(`M23 ${y}q2 7 5 1 3-3 3 6t3 0v-4q4 3 9-2M29 70V${y+13}`)+
      group(`translate(33 ${y-1})`,group('',p('M0 0q-12-5-6-16 5-7 5-13 13 21 1 29z',metal)+p('M0-2q-4-6 0-11 4 6 0 11z',paper),'flame'))+p(`M33 ${y}v-5`)+
      p(`M32 ${y+5}q1 2 0 5`,'none','class="wax-bead" stroke="var(--metal)" stroke-width="1.8"'));
  }
  function key(i) {
    // (0,0) is the pin inside the top of each bow. The shaft meets the bow
    // at y=21 in all three designs, including on animation extremes.
    const bows = [
      circle(0,9,12,metal)+circle(0,9,8,paper),
      p('M0-3 11 9 0 21-11 9z',metal)+p('M0 .5 7.5 9 0 17.5-7.5 9z',paper),
      p('M0-3q6-1 7 5 8-1 8 6 1 7-7 8l-8 5-8-5q-8-1-7-8 0-7 8-6 1-6 7-5z',metal)+p('M0 1q4 0 4 5 7-2 7 3 0 4-5 4l-6 4-6-4q-5 0-5-4 0-5 7-3 0-5 4-5z',paper),
    ];
    const teeth = ['h11v9H10v-4H7v5H2','h10v4H8v3h4v4H2','h12v10h-3v-6H8v6H5v-3H2'];
    const shaft=p('M-2 20h4v26'+teeth[i]+'v5l-2 2-2-2z',metal);
    const keyBody=shaft+bows[i]+p('M-4 21h8v3h-8z',metal)+p('M0 27v16','none','stroke="var(--sheet)" stroke-width=".9"')+
      p('M-1 27v16','none','class="polished-key" stroke="#fff0c5" stroke-width="1.25" stroke-dasharray="4 16"');
    return svg('38 76',circle(19,7,4,metal)+group('translate(19 7)',group('',keyBody,'key-sway'))+
      p('M19 7v4q0 3 3 2','none','stroke-width="2"'));
  }
  function scales() {
    const pan = x=>group(`translate(${x} 8)`,group('',p('M0 0-15 33h30z')+p('M-17 33h34q-4 13-17 13T-17 33z',metal)+
      p('M-13 35q13 3 26 0','none','class="balance-rim" stroke="#fff1bd" stroke-width="1.65" pathLength="20" stroke-dasharray="5 15"'),'pan')+circle(0,0,2,tint));
    return svg('170 85',p('M64 78h42l-7-4H71zm10-5h22l-7-8V16h-8v49z',metal)+p('M85 3l4 5-4 7-4-7z',paper)+
      group('translate(85 14)',group('',p('M-53 8q9-13 30-6 16 6 23-2 7 8 23 2 21-7 30 6-18-6-33 1-13 3-20-3-8 6-20 3-14-7-33-1z',metal)+pan(-50)+pan(50),'balance'))+circle(85,17,3,paper)+p('M59 81h52'));
  }
  function column() {
    const flutes = series(5,i=>p(`M${6+i*3.3} 21l.8 48`,'none','stroke="#8a775c" stroke-width="1.1"'));
    return svg('28 82',p('M1 2h26v4H1zM2 7h24v4H2zM4 14h20l-2 59H6z','#cdb984')+flutes+
      p('M4 13q-4 0-2-4 3-2 5 2h14q2-4 5-2 2 4-2 4m-19 4h18M4 72h20v3H4zm-2 4h24v4H2z','#e8d49c')+
      circle(6,11,2,'#968259')+circle(22,11,2,'#968259'));
  }
  function tally() {
    const notches=series(9,n=>p(`m${15+n*8} 11 -2 6m4-6 -2 6`,'none',`class="tally-notch" style="--notch:${n}"`));
    return svg('116 46',group('rotate(-7 58 22)',p('M4 11h95l13 6-13 3H4z',metal)+notches+group('',p('M6 25h92l14-3-12 10H6z',tint)+series(9,n=>p(`m${13+n*8} 25 -2 5`)),'tally-half')+circle(100,16,1.6,paper)));
  }
  const icons = ['M3 6l6-2 6 3 6-2v14l-6 2-6-3-6 2zM9 4v14m6-11v14','M4 5q4 1 8-3 4 4 8 3v6q0 6-8 11-8-5-8-11zM8 12l3 3 5-6','M4 21V11q0-5 8-10 8 5 8 10v10zM8 21v-7l4-4 4 4v7M12 5v2','m2 11 10-8 10 8M5 10v11h14V10M9 21v-6h6v6','M12 2v18m-6 1h12M3 6l9-2 9 2M5 7l-4 8h8zM19 7l-4 8h8z'];
  return {map,bell,shield,witness,windowPane,candle,key,scales,column,tally,icon:i=>svg('24 24',p(icons[i],'none','stroke-width="1.5"'))};
})();

// Комнаты усадьбы для «Разреза усадьбы»: сцену выбирает только должность.
export const householdRooms = (() => {
  const rooms = [
    ['keys','Кладовая','#c3cd98','ключница|ключник|ключничка|housekeeper|keeper of the keys'],
    ['groom','Конюшня','#a5c3bf','конюх|конюший|конюшая|конюшенная|конюшиха|groom|stablehand|stable hand|stable boy|stable girl|stablemaster'],
    ['cook','Кухня','#dfaf88','повар|повариха|кухарка|кухарь|кухонный мастер|cook|chef'],
    ['servant','Большой зал','#c9bd90','слуга|слуги|слугач|лакей|камердинер|прислуга|servant|footman|valet|manservant'],
    ['squire','Оружейная','#a7bbcb','оруженосец|оруженоска|оруженосица|щитоносец|squire|shield bearer|armour bearer|armor bearer'],
    ['maid','Бельевая','#d7b9c0','горничная|служанка|камеристка|покоївка|maid|housemaid|chambermaid|maidservant|lady in waiting'],
    ['steward','Счётная палата','#cec09c','управляющий|управляющая|управитель|управительница|распорядитель|распорядительница|дворецкий|эконом|экономка|мажордом|сенешаль|steward|stewardess|estate manager|butler|seneschal'],
  ];
  const fallback = ['resident','Общая горница','#bdc0c7'];
  const words = value => String(value ?? '').toLowerCase().replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const aliases = new Map(rooms.flatMap(room=>room[3].split('|').map(alias=>[words(alias),room])));
  function find(role) {
    const normalized = words(role);
    if (aliases.has(normalized)) return aliases.get(normalized);
    const phrase = ' ' + normalized + ' ';
    for (const [alias, room] of aliases) if (phrase.includes(' ' + alias + ' ')) return room;
    return fallback;
  }

  const line = (d,fill='none',extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
  const dot = (x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  const group = (transform,body,attr='')=>`<g transform="${transform}" ${attr}>${body}</g>`;
  const gold='#dfac59', cream='#fff0cd', wood='#a37048', dark='#49392e';
  const skin='#e9c09c', shadow='#bb8b69', hairInk='#42352d';
  const stroke = (d,colour,width=1)=>line(d,'none',`stroke="${colour}" stroke-width="${width}"`);
  const fill = (d,colour)=>line(d,colour,'stroke="none"');

  // All headwear uses the same temples (-9,-6) and (9,-6). The band covers
  // the top edge of the hair, with the neck extending into the collar.
  const hair = {
    keys: ['#726156','M-10-5C-11-14-6-17 0-17s11 4 10 12l-1 10q4 4 1 8l-5 1-2-5h-6l-3 5-5-1q-1-5 2-9z'],
    groom: ['#574234','M-10-5q-1-12 10-12t10 12l-1 7 2 5-5-1-2 3-4-3-5 3-1-3-5 1 2-5z'],
    cook: ['#705043','M-10-6q0-11 10-11t10 11v8q1 6-4 7l-5-2-5 2q-6-2-6-8z'],
    servant: ['#503830','M-10-6q-1-12 10-12t10 12v6q0 5-4 6H-5q-5 0-5-6z'],
    squire: ['#955e40','M-10-5q-2-12 9-13t12 11l-1 8 2 8-4-2-2 4-4-4-5 3-2-3-5 2 1-7z'],
    maid: ['#614438','M-10-5q0-12 10-12t10 12v6q0 6-5 7l2 6-5 4-5-5 2-5q-9 1-9-7z'],
    steward: ['#8c8072','M-10-5q-1-12 10-12t10 12l1 10-4 3-3-3-8 1-4 2-3-4z'],
    resident: ['#687780','M-14 9q1-12 2-19 2-8 12-12 11 4 13 16l2 17-7 5-9-3-7 3z'],
  };
  const hats = {
    keys: line('M-11-5q-2-12 7-14 10-3 15 8l1 6q-12-5-23 0z','#d5c5a5')+
      stroke('M-10-7Q0-12 10-7','#9d8867')+stroke('M-5-16q5-2 8 0','#eadcbc'),
    groom: line('M-11-9q1-8 10-8l9 2 4 5-3 3-19 1z','#68806d')+
      line('M-10-8Q0-11 11-9l4 2q-6 0-10 2l-14 1z','#465f52'),
    cook: line('M-10-8l-2-5q-3-4 0-7 3-2 7 0 4-5 10-2 6-2 9 2 2 4-3 8l-1 4z','#fae7bf')+
      line('M-10-11q10-3 20 0l-1 5q-9-3-18 0z','#e7cc9e')+stroke('M-5-19q2 3 1 6m8-7-2 6','#bf9e73',.8),
    maid: line('M-11 0q-3-13 5-18 9-6 16 4l2 7-3 4-2-7q-5-3-11 0l-4 11z','#eedcba')+
      stroke('M-9-4q0-8 6-11 5-2 9 2','#c7ac85',.9),
    steward: line('M-10-9l1-7q8-5 18 0l2 7q-10-4-21 0z','#784e58')+
      line('M-11-9q11-4 22 0v4q-11-4-22 0z','#583e49'),
  };
  function avatar(id,x,y) {
    const [colour,back]=hair[id];
    const neck=fill('M-3.5 5h7v7l3 2q-6.5 4-13 0l3-2z',shadow);
    const face=line('M0-13c5.8 0 9 3.5 9 9 0 7-3.8 13-9 13S-9 3-9-4c0-5.5 3.2-9 9-9z',skin,'stroke="none" class="manor-face"');
    const fringe=id==='squire' ? 'M-9-9q5-10 14-5 5 3 5 8l-4-3-2 4-2-3-5 3 1-3-7 3z'
      : 'M-9-8q2-9 10-9 9 0 9 10l-5-3q-5 3-9 1l-5 4z';
    const beard=id==='steward' ? fill('M-9 0q1 6 5 7 4 1 8 0 4-1 5-7 1 11-9 14Q-10 11-9 0z',colour) : '';
    const hood=id==='resident' ? stroke('M-9-10q3-6 9-9 7 4 10 12m-21 16 8 3m8 0 7-3','#a3aaac',1) : '';
    return group(`translate(${x} ${y})`,line(back,colour)+neck+face+fill(fringe,colour)+beard+(hats[id]||'')+hood);
  }

  // A sleeve ends at the wrist, the hand encloses the grip, and the held
  // object shares that grip's local origin. Mirroring affects the hand only.
  function arm(shoulder,elbow,grip,cloth,pose='grip',held='') {
    const [x,y]=grip, dx=x-elbow[0], dy=y-elbow[1], length=Math.hypot(dx,dy);
    const wrist=[x-3*dx/length,y-3*dy/length];
    const ux=elbow[0]-shoulder[0], uy=elbow[1]-shoulder[1], upper=Math.hypot(ux,uy);
    // Normals offset the two edges of each sleeve. The forearm narrows
    // into the cuff, while a rounded outer elbow keeps bent arms continuous.
    const offset=([px,py],nx,ny,r)=>[px+nx*r,py+ny*r];
    const upperEdge=(point,r)=>offset(point,-uy/upper,ux/upper,r);
    const foreEdge=(point,r)=>offset(point,-dy/length,dx/length,r);
    const joinScale=3.4/(1+(ux*dx+uy*dy)/(upper*length));
    const corner=side=>offset(elbow,-uy/upper-dy/length,ux/upper+dx/length,side*joinScale);
    const before=side=>offset(corner(side),-ux/upper,-uy/upper,2.2);
    const after=side=>offset(corner(side),dx/length,dy/length,2.2);
    const sleeve=`M${upperEdge(shoulder,4.1)} L${before(1)} Q${corner(1)} ${after(1)}
      L${foreEdge(wrist,2.5)} L${foreEdge(wrist,-2.5)} L${after(-1)}
      Q${corner(-1)} ${before(-1)} L${upperEdge(shoulder,-4.1)}
      Q${offset(shoulder,-ux/upper,-uy/upper,5.6)} ${upperEdge(shoulder,4.1)}z`;
    const angle=Math.atan2(dy,Math.abs(dx))*180/Math.PI;
    const orient=`scale(${dx<0?-1:1} 1) rotate(${angle})`;
    const palm=pose==='support' ? 'M-4-1.6q2-.9 3.8-.2L4-2.2q2 0 1.6 1.6L2 1.4q-2 1.7-5 1z'
      : 'M-4-1.8q1.5-1.2 3.4-1L1.1-3.6q1.8-.4 2.1 1l-.1 1q1.6.1 1.3 1.7-.5 1.8-3.1 2.4l-4.5-.5z';
    return line(sleeve,cloth,`stroke="${hairInk}" stroke-width="1.1"`)+
      group(`translate(${x} ${y})`,group(orient,stroke('M-3-2.5v5','#dac5a4',1.3))+held+
        group(orient,line(palm,skin,'stroke-width=".9"')+(pose==='grip'?stroke('M.3-1.3q1 .5 1.6 1.3',shadow,.65):'')));
  }
  function robe(x,colour,trim) {
    return group(`translate(${x} 44)`,line('M-5-1q-5 0-8 4l3 12-1 11-6 14q15 3 34 0l-5-15-2-10 3-12q-4-4-8-4z',colour)+
      stroke('M-12 37q11 2 24 0',trim,1.3)+stroke('M-7 25l-3 10m14-10 2 10','#463a33',.8)+
      line('M-6-1q6 4 12 0l-2 4-4 2-4-2z',trim,'stroke-width=".85"'));
  }

  const windowLight = (x,y) => group(`translate(${x} ${y})`,line('M0 32V12Q0 4 11 0q11 4 11 12v20z','#79abc0')+line('M2 22q6-8 10-5l9-5v18H2z','#a9ba89')+line('M11 2v29M1 16h20M-2 33h26','none','stroke-width="2"'));
  const jug = (x,y,s=1) => group(`translate(${x} ${y}) scale(${s})`,line('M-4-12h8v4q8 5 5 13-1 5-9 5t-8-5q-2-7 5-13z','#b66d4b')+line('M5-6q11-4 8 4-1 4-5 4m-13-6q-3 5-2 8'));
  function barrel(x,y,s) {
    return group(`translate(${x} ${y}) scale(${s})`,line('M-10-16q-5 16 0 30 10 5 20 0 5-15 0-30-10-4-20 0z',wood)+line('M-11-12q11 4 22 0m-23 20q12 5 24 0','none','stroke="#59646a" stroke-width="3"')+line('M-4-14q-3 14 0 27m6-27q2 13 0 27'));
  }
  const key = (x,y,s) => group(`translate(${x} ${y}) scale(${s})`,dot(0,0,3.3,gold)+dot(0,0,1,dark)+line('M-1 3h2v8h4v3H1v2h-2z',gold));
  const beam = line('M0 7h160V2H0zM4 7h4v74H4zm148 0h4v74h-4z','#896345');
  const floor = line('M0 80h160v13H0z','#ac8764')+line('M0 84h160m-136 0-3 8m53-12-2 4m45 0 3 8','none','stroke="#84694d"');
  function shoes(x) {
    return group(`translate(${x} 81)`,line('M-10 0h6v8h-11q-1-2 2-3l3-1zm14 0h6v4l3 1q3 1 2 3H4z','#584238'));
  }
  function person(id,x,colour,trim) {
    return shoes(x)+robe(x,colour,trim)+avatar(id,x,31);
  }
  function keysScene() {
    const shelf=line('M9 29h55v3H9zm4 3v5l6-5m33 0 6 5v-5',wood)+jug(23,22.7,.63)+jug(40,23.3,.57)+line('M49 19h11v10H49z','#ccac75');
    const rail=line('M121 19h26v5h-26z',wood)+dot(124,21.5,.8,gold)+dot(144,21.5,.8,gold)+stroke('M129 22v5m11-5v5',dark,1.8);
    // Ring top sits at the grip (0,0); both key bows intersect its lower arc.
    const bunch=group('','<circle cy="4" r="4" fill="none" stroke="#5c4930" stroke-width="2.3"/><circle cy="4" r="4" fill="none" stroke="#e7be72" stroke-width="1.1"/>'+
      group('rotate(13 -2 7)',key(-2.4,7,.68))+group('rotate(-13 3 7)',key(2.8,7,.63))+
      stroke('M-2.3 1.2Q-4 2.7-3.4 4.4','#fff3bf',1),'class="handheld-keys"');
    return shelf+barrel(20,69,.92)+barrel(43,74,.68)+
      line('M10 58q10 3.6 20 0m5.5 7.9q7.5 2.7 15 0','none','class="hoop-light" stroke="#c4c6a6" stroke-width="1.1" stroke-dasharray="4 18"')+rail+key(129,27,.74)+key(140,27,.59)+
      person('keys',91,'#527c6e','#dbd8b6')+
      line('M81 61q10 2 20 0l1 3q-11 2-21 0z','#775c42')+line('M92 64h9l1 8q-4 4-11 0z','#977650')+
      arm([100,49],[104,59],[98,64],'#638c7b')+
      arm([81,49],[71,59],[76,62],'#638c7b','grip',bunch);
  }
  function groomScene() {
    const chest=line('M120 22C137 19 147 36 152 49q3 7 8 11v21h-48q6-13 6-23l-4-15z','#a35f40')+
      fill('M126 27q17 6 23 27 3 11 11 14v12h-15q-1-18-10-28-7-9-15-12z','#b97449')+
      stroke('M128 48q-5 10-6 16m13-11q9 8 10 15','#845039',1.2);
    const mane=line('M120 21q12-4 22 8 7 7 9 18l-4-3q3 10 8 13-5 2-9-3 2 7 5 11-8-3-12-15-3-11-10-17l-11-6z','#513831')+
      stroke('M127 24q12 4 17 18m-12-13q9 8 12 20m-2-6q3 10 7 13','#886048',1.05);
    const ears=line('M114 23q-4-5-3-13 5 2 8 12z','#a76949')+
      group('',line('M119 23q-1-9 6-14 2 7-1 14z','#c78559')+
        fill('M121 21q0-5 3-8 0 4-2 8z','#754841'),'class="horse-ear"');
    const head=line('M119 20q-8-2-12 7c-4 7-9 13-16 18-3 2-3 6-1 9 1 3 5 4 9 3l5-3q5-1 9-5c8 1 15-4 15-12q0-12-9-17z','#bc7950','class="horse-head"')+
      fill('M120 22q7 4 7 13 0 11-13 13l-8 4-7 3q6-6 9-11 4 2 8 0 8-4 4-13z','#9b593f')+
      fill('M111 26q-1 6-5 11l-10 11-3-1q8-8 12-16l3-5 1 2z','#f0d2a0')+
      line('M93 44q4 0 7 4l3 5q-3 4-8 5-5 0-7-4-2-6 5-10z','#c59477','stroke-width=".95"')+
      line('M89.5 52q1.9 1.6 4.1.8m.7 2.7q3.5.6 6.6-2.1','none','stroke="#765246" stroke-width=".85"')+
      line('M90 49q1.2-2.4 3.4-1.8 1.1 1.9-1.3 2.9-2.2.7-2.1-1.1z','#553c35','stroke="none" class="horse-nostril"')+
      group('',line('M108.3 32.9q2.4-3.2 6-.7-2.6 3-6 .7z','#422e29','stroke-width=".65"')+'<circle cx="112.1" cy="32" r=".55" fill="#fff2cd" stroke="none"/>','class="horse-eye"')+
      stroke('M108 30.7q3-2.3 6-.6m2.6 11.7q4.7-1.4 5.1-5.8','#8c533b',.9);
    const forelock=line('M121 21q-5-4-10-1-5 2-7 9l5-3-1 4q4-2 6-5l-1 3q5-2 8-7z','#50382f','stroke-width=".9"')+
      stroke('M109 25q3-4 7-4','#9a7351',.8);
    const tack=stroke('M121 21q2 5 2 9l-22 23m-8-12q7 2 10 9','#584237',2.5)+
      stroke('M121 21q2 5 2 9l-22 23m-8-12q7 2 10 9','#cd9b67',.85)+
      group('translate(117 36) rotate(43)',line('M-1.6-2h3.2v4h-3.2z','none','stroke="#f2c16e" stroke-width="1.1"'))+
      '<circle class="bit-ring" cx="101" cy="53" r="2.3" stroke="#5e4536" stroke-width="2.4"/><circle cx="101" cy="53" r="2.3" stroke="#edc278" stroke-width="1.15"/>';
    const brush=group('rotate(-44)',line('M-4 0h11v4l-2 .6-1-.6-1 .8-1-.8-1 .8-1-.8-1 .8-1-.8-2 .4z','#d9ba81','class="brush-bristles" stroke-width=".65"')+
      stroke('M-2 1v2m3-2v2m3-2v2m2-2v2','#967448',.55)+
      line('M-5 0q0-2.5 2-2.5h9q2 0 2 2l-1 1.4H-4z','#8b583b','stroke-width=".8"'));
    const rail=line('M110 73h50v18h-50z','#997049')+stroke('M120 75v16m13-16v16m13-16v16','#6d533e',.85)+
      line('M6 70h154v6H6z',wood)+stroke('M8 71.5h150','#c49667',1)+dot(112,73,1,'#65513d')+dot(154,73,1,'#65513d')+
      line('M128 78q-2 8 3.5 8t3.5-8l-1.8.5q1.2 5.6-1.7 5.6t-1.7-5.6z','#9c9d87','stroke-width=".7"')+
      stroke('M114 81q2-3 3-3m23 8v3m11-11q-1 4 0 6','#ad8155',.85);
    return windowLight(16,13)+chest+mane+ears+head+forelock+tack+rail+
      person('groom',63,'#5b7d89','#bf915d')+line('M53 61q9 3 19 0v3q-11 3-20 0z','#765c46')+
      line('M58 69C71 82 85 74 94 62Q98 57 100 55','none','class="horse-rein" stroke="#634532" stroke-width="1.65"')+
      arm([53,49],[47,61],[58,69],'#6b8d97')+
      group('',arm([73,49],[83,56],[96,46],'#6b8d97','grip',brush),'class="groom-stroke"');
  }
  function cookScene() {
    const hearth=line('M9 80V35l12-13h28l10 13v45z','#ae8265')+line('M16 77V48q16-22 36 0v29z','#4d4037')+
      line('M23 72q-3-8 4-16 0 7 5 7 5-8 5-16 11 17 7 25z','#ed9a48','class="manor-flame"')+stroke('M12 37h44m-34-8h24m-32 15h6m27 1h8','#825e47');
    const hooks=line('M104 13h44v4h-44z',wood)+dot(107,15,1,gold)+dot(145,15,1,gold)+
      line('M137 16v13q5 1 4 5t-6 0q-1-3 2-5m-15-13v10m-5 0h10q-2 8-6 6t-4-6z',gold);
    const spoon=group('rotate(24)',line('M-1.1-6q1-1 2.2 0v19q3 2 1.4 5-1.8 3-4.4 0-1.7-3 .8-5z','#e2b576','stroke-width=".85"')+stroke('M-.5-3H.5','#fff0c4',.8));
    return hearth+hooks+person('cook',83,'#985e49','#e6ceaa')+
      line('M75 47l3 10h11l3-10 2 1-3 15 6 20H69l6-20-2-15z','#e7d4ae')+stroke('M76 71q6 3 13 0','#b49c7b')+
      arm([93,49],[100,62],[92,68],'#ab7156')+arm([73,49],[64,56],[54,55],'#ab7156','grip',spoon)+
      line('M9 81h143v6H9zm5 6h5v5h-5zm127 0h5v5h-5z',wood)+
      line('M27 66h40q-2 15-20 15T27 66z','#6e8780')+stroke('M24 66h46m-44 2q-6-2-6 2t8 1m39-3q7-2 7 1t-8 3',dark,1.6)+
      line('M39 63q-5-4-1-8t-1-6m10 14q4-4 0-8','none','class="pot-steam" stroke="#ffedce" stroke-width="1.4" opacity=".7"')+
      line('M34 65q1.8-4 4 0m17 0q2-6 5 0','none','class="pot-bubbles" stroke="#e3b778" stroke-width="1.25"')+jug(127,72.4,.86);
  }
  function servantScene() {
    const tapestry=stroke('M14 7v5m32-5v5m-35 0h39',dark,2)+line('M14 12h32v35l-16 8-16-8z','#a46459')+stroke('M17 13v32l13 6 13-6V13','#e8c582',1.4);
    const tray=line('M-12-4h36q-2 3-6 3H-7q-4 0-5-3z',gold)+jug(12,-10,.6)+line('M-8-9h8l-1.5 5h-5z',cream);
    const fringe=group('',stroke('M19 50l-1 4m6-2-1 4m7-2v5m6-7 1 4m5-7 1 4','#b88853',1.6),'class="tapestry-fringe"');
    return windowLight(130,9)+tapestry+fringe+person('servant',76,'#527d81','#e9d4ac')+
      line('M66 60q10 3 20 0v3q-10 4-20 0z',wood)+dot(77,62,1.6,gold)+
      arm([66,49],[57,60],[68,65],'#6a9494')+arm([86,49],[96,64],[109,58],'#6a9494','support',tray);
  }
  function squireScene() {
    const rack=line('M14 19h39v5H14z',wood)+line('M22 13h3v6h4v2H18v-2h4zm0 8h3v13l-1.5 4-1.5-4zm15-10h4v8h4v2H33v-2h4zm0 10h4v14l-2 4-2-4z','#a1acad');
    const shield=line('M18 43q12 1 22-5 11 6 22 5v16q-1 14-22 25Q20 72 18 59z','#486f89')+line('m20 48 37 17-4 5-33-16z','#daae61')+stroke('M22 45q9 1 18-4 9 5 18 5','#a3b6b6',.9);
    const stand=line('M101 66h48v5h-48zm4 5v16h4V71m32 0v16h4V71',wood)+line('M117 54h9v8l6 2v2h-22v-2l7-2z',wood);
    const helm=line('M107 57v-7q1-13 14-15 14 1 16 17l-5 8-10-6-10 5z','#b7c1c2')+stroke('M111 48l22 1m-16 3h10m-6-17 1 10','#66757c',1.4);
    const steel=line('M110 46q3-8 11-9','none','class="helm-light" stroke="#eff1d8" stroke-width="1.5" stroke-dasharray="4 13"');
    return rack+shield+stand+helm+steel+person('squire',82,'#965c61','#dec085')+
      line('m88 45 5 2-18 33-4-2z','#c2a06a')+
      arm([72,49],[64,58],[58,45],'#a86c6b')+arm([92,49],[100,58],[109,52],'#a86c6b','support');
  }
  const linen=(x,y,colour)=>group(`translate(${x} ${y})`,line('M1 0q10-1 27-1l4 2-3 4H1q-3-2 0-5z',colour)+stroke('M3 3h24','#998d78',.65));
  function maidScene() {
    const cupboard=line('M9 11h42v44H9z','#94755c')+dot(11,13,.85,gold)+dot(49,13,.85,gold)+line('M13 15h34v16H13zm0 20h34v14H13z','#61544b')+linen(14,21,cream)+linen(14,26,'#b8c9bf')+linen(14,44,'#dfb6a6');
    const table=line('M12 74h58v5H12zm5 5v9h4v-9m39 0v9h4v-9',wood)+linen(19,69,'#b7c7c6')+linen(22,64,cream);
    return cupboard+person('maid',84,'#806d88','#e8d3b1')+
      line('M74 51q9 7 19 0l-2 12 7 20H70l7-20z','#e7d7ba')+table+
      line('M59 63q8 2 22-1l4 8q-9 6-19 2l-11 6-7-2z','#f1e3c9','class="linen-fold"')+stroke('m60 66-7 8m15-5 9-4','#c6b89e',.8)+
      arm([74,49],[66,57],[60,63],'#987e98')+arm([94,49],[98,59],[82,63],'#987e98');
  }
  function stewardScene() {
    const shelf=line('M115 21h31v3h-31zm2 3v4l4-4m17 0 4 4v-4',wood)+line('M118 21V10h4v11zm6 0V9h5v12zm8 0-2-10 4-1 3 11z','#78806b');
    const table=line('M28 68l8-9h109l6 9z',wood)+line('M28 68h123v6H28zm5 6v14h5V74m101 0v14h5V74',wood);
    const book=line('M74 69l15-9q10-2 19 2 14-5 25-2l-14 11q-10-2-22 1-10-5-23-3z',cream)+stroke('m108 62-11 10m15-8 11-2m-13 5 10-2m-29-2 10 1m-13 0 8 2','#9b8765',.8);
    const pen=group('',line('M0 0 4-13q2-7 12-12-1 11-11 17z','#f1d6a0')+stroke('M-2 6 10-18',dark,1.1),'class="quill"');
    return windowLight(16,13)+shelf+person('steward',66,'#617351','#be9c65')+
      table+book+line('M89 64q1-1 2 0t3 .5','none','class="ledger-ink" stroke="#71533c" pathLength="1" stroke-width=".95"')+arm([56,49],[47,60],[61,65],'#74856a','support')+
      arm([76,49],[84,60],[96,59],'#74856a','grip',pen);
  }
  function residentScene() {
    const bench=line('M107 65h40v5h-40zm4 5v15h4V70m23 0v15h4V70',wood);
    return windowLight(22,14)+group('',fill('M26 36q2-3 4 0 1-4 4-4-3 1-4 5z','#566957'),'class="window-bird"')+bench+person('resident',78,'#75838b','#bcc0ad')+
      line('M66 47q10 4 12 9l13-10 5 4-18 12-16-12z','#98a09d')+dot(78,57,1.8,gold)+
      arm([67,50],[61,64],[76,70],'#889397','support')+arm([89,50],[94,63],[80,69],'#889397');
  }
  const scenes = {keys:keysScene, groom:groomScene, cook:cookScene, servant:servantScene,
    squire:squireScene, maid:maidScene, steward:stewardScene, resident:residentScene};

  function picture(room) {
    const [id,,wall]=room;
    return `<svg viewBox="0 0 160 92" aria-hidden="true" focusable="false" fill="none" stroke="#493b33" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
      <rect width="160" height="92" fill="${wall}" stroke="none"/>
      ${line('M13 8h23L9 79H0V56zm28 0h7L20 79h-8z','#fff2bf','class="manor-daylight" opacity=".32" stroke="none"')}
      ${beam}${floor}${scenes[id]()}</svg>`;
  }
  return {find,picture};
})();
