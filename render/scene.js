// hud-manager/render/scene.js
//
// Домен «Сцена»: SVG молнии и сезонные декорации (снег, дождь, роса, листья).
// Чистые генераторы разметки — модуль ни от чего не зависит.

export function buildLightningSvg() {
  return `<svg viewBox="0 0 140 140" preserveAspectRatio="none" class="hud-bolt-svg">
    <path class="hud-bolt-path hud-bolt-main" d="M 78 4 L 62 46 L 76 50 L 48 96 L 58 60 L 44 56 Z"></path>
    <path class="hud-bolt-path hud-bolt-branch" d="M 68 40 L 84 50 L 74 56"></path>
  </svg>`;
}

/* Талый ручей с перспективой: у горизонта — тонкая нитка, к зрителю
   расширяется и петляет. Плоская полоса одной ширины, пересекавшая луг
   поперёк, наезжала на стволы и убивала глубину. Форма строится по
   средней линии: каждой точке — своя ширина, берег чуть шире воды. */
function ручейСПерспективой() {
  const точки = 26, левый = [], правый = [], берегЛ = [], берегП = [], середина = [];
  for (let i = 0; i <= точки; i++) {
    const t = i / точки;                                   // 0 — даль, 1 — у зрителя
    const y = t * 40;
    const x = 50 + Math.sin(t * Math.PI * 2.3 + 0.5) * (6 + 16 * t);
    const w = 0.7 + 8.5 * Math.pow(t, 1.5);               // половина ширины воды
    const б = w + 0.6 + 1.6 * t;                           // половина ширины русла
    левый.push(`${(x - w).toFixed(2)} ${y.toFixed(2)}`); правый.unshift(`${(x + w).toFixed(2)} ${y.toFixed(2)}`);
    берегЛ.push(`${(x - б).toFixed(2)} ${y.toFixed(2)}`); берегП.unshift(`${(x + б).toFixed(2)} ${y.toFixed(2)}`);
    середина.push(`${(x - w * 0.25).toFixed(2)} ${y.toFixed(2)}`);
  }
  const полоса = (a, b) => 'M' + a.join(' L') + ' L' + b.join(' L') + ' Z';
  return '<svg class="hud-thaw-stream" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">'
    + `<path class="bed" d="${полоса(берегЛ, берегП)}"/>`
    + `<path class="water" d="${полоса(левый, правый)}"/>`
    + `<path class="glint" d="M${середина.slice(6).join(' L')}"/></svg>`;
}

// Сцена сезона и поверх неё — праздничное убранство: праздник от сезона не
// зависит (снег может выпасть и на Хэллоуин).
export function buildSeasonSceneHtml(seasonClass, extra) {
  extra = extra || {};
  return сценаСезона(seasonClass, extra) + праздничное(extra);
}

// Тыквы, крашеные яйца, фейерверк. Какие праздники сегодня — решает
// render/holidays.js по дате сцены.
function праздничное(extra) {
  let html = '';
  if (extra.halloween) {
    // Три тыквы-фонаря у ограды: у каждой своя резная рожица.
    html += '<div class="hud-pumpkins" aria-hidden="true">'
      + [1, 2, 3].map(i => `<span class="hud-pumpkin pk${i}"><i class="hud-pumpkin-stem"></i><i class="hud-pumpkin-face"></i></span>`).join('')
      + '</div>';
  }
  if (extra.easter) {
    const яйца = [1, 2, 3, 4, 5].map(i => `<span class="hud-easter-egg eg${i}"></span>`).join('');
    html += `<div class="hud-easter" aria-hidden="true">${яйца}<span class="hud-easter-basket"><i class="hud-easter-egg in1"></i><i class="hud-easter-egg in2"></i><i class="hud-easter-egg in3"></i></span></div>`;
  }
  if (extra.fireworks) {
    // Каждый залп — точка с кольцом искр из box-shadow: восемнадцать искр по
    // кругу, у каждого залпа свой цвет и своё место в небе.
    const ЦВЕТА = ['#ff5f7e', '#ffd166', '#7ae7ff', '#c79bff'];
    const залпы = ЦВЕТА.map((цвет, i) => {
      const искры = Array.from({ length: 18 }, (_, k) => {
        const угол = (k / 18) * Math.PI * 2, r = 26 + (k % 3) * 4;
        return `${Math.round(Math.cos(угол) * r)}px ${Math.round(Math.sin(угол) * r)}px 1.5px .8px ${k % 2 ? цвет : "#fff6d8"}`;
      }).join(',');
      return `<span class="hud-firework fw${i + 1}" style="--fw:${цвет}"><i class="hud-firework-trail"></i><i class="hud-firework-burst" style="box-shadow:${искры}"></i></span>`;
    }).join('');
    html += `<div class="hud-fireworks" aria-hidden="true">${залпы}</div>`;
  }
  return html;
}

// Отражение деревьев в воде: та же разметка деревьев, перевёрнутая вокруг
// кромки воды и выровненная по координатам сцены (CSS считает сдвиг из
// положения водоёма). Вода обрезает копию по своему контуру, поэтому
// отражаются ровно те деревья, что стоят над ней.
function отражение(деревья, вид) {
  return `<div class="hud-reflect hud-reflect-${вид}" aria-hidden="true"><div class="hud-reflect-world"><div class="hud-bg-trees">${деревья}</div></div></div>`;
}

function сценаСезона(seasonClass, extra) {
  if (seasonClass === 'season-autumn') {
    let birds = '';
    for (let i = 1; i <= 7; i++) birds += `<span class="hud-bird b${i}"></span>`;
    // Autumn background: one apple tree (bt2), two leaf-fall trees (bt1/bt4),
    // one plain tree (bt3). This keeps the scene varied without animating every tree.
    let backTrees = '';
    for (let i = 1; i <= 4; i++) {
      const apples = i === 2
        ? `<span class="hud-tree-apples"><span class="hud-tree-apple a1"></span><span class="hud-tree-apple a2"></span><span class="hud-tree-apple a3"></span></span>`
        : '';
      const fallingLeaves = (i === 1 || i === 4)
        ? `<span class="hud-tree-leaves"><span class="hud-tree-leaf lf1"></span><span class="hud-tree-leaf lf2"></span><span class="hud-tree-leaf lf3"></span></span>`
        : '';
      // Sparse autumn foliage: one lightweight CSS foliage layer per tree, not many DOM leaves.
      // The apple tree gets slightly denser foliage; leaf-fall trees remain visibly sparse.
      // Яблоки висят внутри самой кроны, а не в габарите дерева: габарит
      // шире и выше листвы, и на узком экране верхнее яблоко оказывалось
      // в воздухе над кроной.
      const foliage = `<span class="hud-bg-tree-autumn-foliage foliage-${i}" aria-hidden="true">${apples}</span>`;
      // Паутина живёт в развилке первого дерева — как ребёнок, чтобы держаться
      // за ветки, а не за проценты виджета.
      const cobweb = i === 1 ? '<span class="hud-cobweb"></span>' : '';
      backTrees += `<span class="hud-bg-tree hud-bg-tree-autumn bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span>${foliage}${cobweb}${fallingLeaves}</span>`;
    }
    const fallenApples = `<div class="hud-fallen-apples"><span class="hud-fallen-apple fa1"></span><span class="hud-fallen-apple fa2"></span><span class="hud-fallen-apple fa3"></span><span class="hud-fallen-apple fa4"></span><span class="hud-fallen-apple fa5"></span></div>`;
    // Дальний лес и мелочь под ногами: осенняя сцена была голой в сравнении
    // с зимней, где горизонт занимает лес, деревня и пруд.
    const mushrooms = '<span class="hud-mushroom m1"></span><span class="hud-mushroom m2"></span><span class="hud-mushroom m3"></span>';
    const groundLeaves = Array.from({ length: 7 }, (_, i) => `<span class="hud-ground-leaf gl${i + 1}"></span>`).join('');
    const dryTufts = Array.from({ length: 5 }, (_, i) => `<span class="hud-dry-tuft dt${i + 1}"></span>`).join('');
    return `<div class="hud-far-hills"></div><div class="hud-far-treeline"></div><div class="hud-ground hud-ground-autumn"></div><div class="hud-fallen-log"></div><div class="hud-stump"><span class="hud-stump-side"></span><span class="hud-stump-top"></span><span class="hud-stump-moss"></span></div><div class="hud-fence"><span class="hud-fence-rail r1"></span><span class="hud-fence-rail r2"></span><span class="hud-fence-post p1"></span><span class="hud-fence-post p2"></span><span class="hud-fence-post p3"></span></div><div class="hud-autumn-litter">${groundLeaves}${mushrooms}${dryTufts}<span class="hud-acorn ac1"></span><span class="hud-acorn ac2"></span><span class="hud-acorn ac3"></span><span class="hud-crow"></span></div><div class="hud-bg-trees">${backTrees}</div><div class="hud-bird-flock">${birds}</div>${fallenApples}<div class="hud-hedgehog"><span class="hud-hedgehog-apple ha1"></span><span class="hud-hedgehog-apple ha2"></span><span class="hud-hedgehog-body"></span><span class="hud-hedgehog-spikes"></span><span class="hud-hedgehog-face"></span></div><div class="hud-burrow"><span class="hud-burrow-mound"></span><span class="hud-burrow-hole"></span><span class="hud-burrow-animal"><span class="hud-burrow-animal-body"></span><span class="hud-burrow-animal-spines"></span><span class="hud-burrow-animal-face"></span></span></div><div class="hud-campfire"><span class="hud-campfire-log"></span><span class="hud-campfire-flame f1"></span><span class="hud-campfire-flame f2"></span><span class="hud-campfire-smoke s1"></span><span class="hud-campfire-smoke s2"></span><span class="hud-campfire-smoke s3"></span></div>`;
  }
  if (seasonClass === 'season-spring') {
    let flowers = '';
    for (let i = 1; i <= 5; i++) {
      flowers += `<span class="hud-flower f${i}"><span class="hud-flower-stem"></span><span class="hud-flower-head"><span class="hud-petal p1"></span><span class="hud-petal p2"></span><span class="hud-petal p3"></span><span class="hud-petal p4"></span><span class="hud-flower-center"></span></span></span>`;
    }
    let pollen = '';
    for (let i = 1; i <= 4; i++) pollen += `<span class="hud-pollen d${i}"></span>`;
    let dew = extra.dew ? `<span class="hud-dew dw1"></span><span class="hud-dew dw2"></span><span class="hud-dew dw3"></span><span class="hud-dew dw4"></span>` : '';
    // Весна по месяцам. Без даты — середина весны, как апрель.
    const месяц = extra.month || 4;
    const март = месяц === 3, апрель = месяц === 4, май = месяц === 5;
    const конецМая = май && (extra.day || 0) >= 20;
    // Скворечник живёт на стволе третьего дерева, а не в воздухе рядом с ним:
    // в ветер дерево качается — и скворечник вместе с ним, как гнездо.
    // Скворец носит в него веточки, пока строится гнездо (март-апрель).
    const скворец = (март || апрель) ? `<span class="hud-starling"><i class="hud-starling-twig"></i></span>` : '';
    const скворечник = `<span class="hud-birdhouse"><span class="hud-birdhouse-body"></span><span class="hud-birdhouse-roof"></span><span class="hud-birdhouse-hole"><span class="hud-birdhouse-bird"></span></span><span class="hud-birdhouse-perch"></span>${скворец}</span>`;
    // Дятел стучит по стволу крайнего правого дерева.
    const дятел = `<span class="hud-woodpecker"><i class="hud-woodpecker-head"></i><i class="hud-woodpecker-tail"></i></span>`;
    let backTrees = '';
    for (let i = 1; i <= 4; i++) {
      // Вместо гнезда, висевшего в кроне (в марте, без листвы, — просто в
      // воздухе), — дупло в стволе. В апреле-мае из него выглядывают птенцы.
      const nest = i === 2
        ? `<span class="hud-tree-hollow">${март ? '' : '<i class="hud-hollow-chick c1"></i><i class="hud-hollow-chick c2"></i>'}</span>`
        : '';
      backTrees += `<span class="hud-bg-tree hud-bg-tree-spring bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span><span class="hud-bg-tree-canopy"></span>${nest}${i === 3 ? скворечник : ''}${i === 4 ? дятел : ''}</span>`;
    }
    // То же для весны: горизонт и трава, иначе луг читается пустым холмом.
    const tufts = Array.from({ length: 6 }, (_, i) => `<span class="hud-grass-tuft gt${i + 1}"></span>`).join('');
    const puffs = Array.from({ length: 4 }, (_, i) => `<span class="hud-dandelion dn${i + 1}"></span>`).join('');
    // Март: снег в тени, талый ручей, подснежники.
    const мартовское = март
      ? '<div class="hud-spring-snow s1"></div><div class="hud-spring-snow s2"></div><div class="hud-spring-snow s3"></div>'
        + ручейСПерспективой()
        + [1, 2, 3, 4].map(i => `<span class="hud-snowdrop sn${i}"></span>`).join('')
      : '';
    // Возвращаются перелётные птицы — клином, в сторону, обратную осенней стае.
    const клин = (март || апрель)
      ? `<div class="hud-spring-flock">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i class="hud-vbird v${i}"></i>`).join('')}</div>` : '';
    // Лепестки с цветущих деревьев — в апреле и в начале мая, по ветру.
    const лепестки = (апрель || (май && !конецМая))
      ? `<div class="hud-petal-fall-layer">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<i class="hud-petal-fall pf${i}"></i>`).join('')}</div>` : '';
    // Май: сирень; в конце мая одуванчики отцветают и летит пух.
    const майское = май ? '<div class="hud-lilac"><span class="hud-lilac-bush"></span><span class="hud-lilac-cluster c1"></span><span class="hud-lilac-cluster c2"></span><span class="hud-lilac-cluster c3"></span><span class="hud-lilac-cluster c4"></span></div>' : '';
    const пух = конецМая ? `<div class="hud-fluff-layer">${[1, 2, 3, 4, 5, 6].map(i => `<i class="hud-fluff fl${i}"></i>`).join('')}</div>` : '';
    // Лейка у клумбы: сад поливают, когда уже есть что поливать.
    const лейка = март ? '' : '<div class="hud-watering-can"><i class="hud-can-body"></i><i class="hud-can-spout"></i><i class="hud-can-handle"></i></div>';
    return `<div class="hud-far-hills"></div><div class="hud-far-treeline"></div><div class="hud-meadow"></div><div class="hud-spring-puddle">${отражение(backTrees, 'puddle')}</div>${мартовское}<div class="hud-frog"><span class="hud-frog-sac"></span><span class="hud-frog-body"></span><span class="hud-frog-eye e1"></span><span class="hud-frog-eye e2"></span><span class="hud-frog-leg"></span><i class="hud-frog-call c1"></i><i class="hud-frog-call c2"></i></div><div class="hud-blossom-shrub"><span class="hud-shrub-body"></span><span class="hud-shrub-bloom b1"></span><span class="hud-shrub-bloom b2"></span><span class="hud-shrub-bloom b3"></span></div>${майское}<div class="hud-grass">${tufts}${puffs}<span class="hud-snail"></span><span class="hud-sprout sp1"></span><span class="hud-sprout sp2"></span></div><div class="hud-bg-trees">${backTrees}</div>${клин}<div class="hud-flowerbed">${flowers}</div>${лейка}${pollen}${dew}${лепестки}${пух}<div class="hud-butterfly"><span class="hud-butterfly-wing w-left"></span><span class="hud-butterfly-wing w-right"></span></div><div class="hud-bee bee1"><span class="hud-bee-wing"></span></div><div class="hud-bee bee2"><span class="hud-bee-wing"></span></div>`;
  }
  if (seasonClass === 'season-summer') {
    // Стрекоза — вид сверху, как её узнают: две пары прозрачных крыльев в
    // стороны, длинное брюшко с сегментами, грудь и голова с большими глазами.
    // Прежняя была собрана из полосок и скошенных прямоугольников и читалась
    // как сломанный значок. Цвета заданы в CSS по классам, без SVG-градиентов:
    // их id на странице с десятками карточек повторялись бы.
    const dragonfly = `<div class="hud-summer-dragonfly"><svg class="hud-df" viewBox="0 0 60 28" aria-hidden="true">`
      + `<g class="hud-df-wings hud-df-hind">`
      + `<path d="M36 13.2C33 7.5 26 4.5 20 5 17 5.3 17 7.5 19.5 9 24 11.5 31 12.8 36 13.2Z"/>`
      + `<path d="M36 14.8C33 20.5 26 23.5 20 23 17 22.7 17 20.5 19.5 19 24 16.5 31 15.2 36 14.8Z"/>`
      + `<path class="hud-df-vein" d="M36 13.1 21 6.8M36 14.9 21 21.2"/>`
      + `<ellipse class="hud-df-spot" cx="21.3" cy="6.4" rx="1.3" ry=".6" transform="rotate(12 21.3 6.4)"/>`
      + `<ellipse class="hud-df-spot" cx="21.3" cy="21.6" rx="1.3" ry=".6" transform="rotate(-12 21.3 21.6)"/>`
      + `</g><g class="hud-df-wings hud-df-fore">`
      + `<path d="M39 13C37 6 33 1.5 27 1 24 1 23.5 3 26 5.5 30 9 35 11.8 39 13Z"/>`
      + `<path d="M39 15C37 22 33 26.5 27 27 24 27 23.5 25 26 22.5 30 19 35 16.2 39 15Z"/>`
      + `<path class="hud-df-vein" d="M39 12.9 26.5 2.6M39 15.1 26.5 25.4"/>`
      + `<ellipse class="hud-df-spot" cx="26.6" cy="2.4" rx="1.3" ry=".6" transform="rotate(38 26.6 2.4)"/>`
      + `<ellipse class="hud-df-spot" cx="26.6" cy="25.6" rx="1.3" ry=".6" transform="rotate(-38 26.6 25.6)"/>`
      + `</g>`
      + `<path class="hud-df-abdomen" d="M36 13 6 13.45Q3.4 14 6 14.55L36 15Z"/>`
      + `<path class="hud-df-rings" d="M31 13.1V14.9M27 13.15V14.85M23 13.2V14.8M19 13.25V14.75M15 13.3V14.7M11 13.35V14.65"/>`
      + `<ellipse class="hud-df-thorax" cx="38.6" cy="14" rx="3.7" ry="2.4"/>`
      + `<circle class="hud-df-head" cx="43.2" cy="14" r="2.1"/>`
      + `<ellipse class="hud-df-eye" cx="43.9" cy="12.7" rx="1.45" ry="1.2"/>`
      + `<ellipse class="hud-df-eye" cx="43.9" cy="15.3" rx="1.45" ry="1.2"/>`
      + `</svg></div>`;
    let teeth = '';
    for (let i = 1; i <= 6; i++) teeth += `<span class="hud-umbrella-tooth"></span>`;
    return `<div class="hud-summer-horizon"></div><div class="hud-summer-distant-island"></div><div class="hud-sand"><span class="hud-swash w1"></span><span class="hud-swash w2"></span><span class="hud-swash w3"></span><span class="hud-swash w4"></span></div><div class="hud-sailboat"><span class="hud-sailboat-wake"></span><span class="hud-sailboat-hull"></span><span class="hud-sailboat-sail"></span><span class="hud-sailboat-jib"></span><span class="hud-sailboat-mast"></span><span class="hud-sailboat-lantern"></span></div><div class="hud-gull g1"></div><div class="hud-gull g2"></div><div class="hud-sea"><span class="hud-wave w1"></span><span class="hud-wave w2"></span><span class="hud-sea-night"></span><span class="hud-sea-moonpath"></span><span class="hud-sea-sparkle"></span></div><div class="hud-summer-heat-haze"></div><div class="hud-sandcastle"><span class="hud-sandcastle-base"></span><span class="hud-sandcastle-tower t1"></span><span class="hud-sandcastle-tower t2"></span><span class="hud-sandcastle-tower t3"></span><span class="hud-sandcastle-turret tr1"></span><span class="hud-sandcastle-turret tr2"></span><span class="hud-sandcastle-turret tr3"></span><span class="hud-sandcastle-flag"></span><span class="hud-sandcastle-shovel"></span></div><div class="hud-volleyball-net"><span class="hud-net-post post-left"></span><span class="hud-net-post post-right"></span><span class="hud-net-band"></span><span class="hud-net-mesh"></span></div><div class="hud-volleyball"><span class="hud-volleyball-seam s1"></span><span class="hud-volleyball-seam s2"></span></div>${dragonfly}<div class="hud-summer-cicada-sound c1"></div><div class="hud-summer-cicada-sound c2"></div><div class="hud-towel-shadow"></div><div class="hud-towel"></div><div class="hud-umbrella"><span class="hud-umbrella-canopy"></span><span class="hud-umbrella-valance">${teeth}</span><span class="hud-umbrella-pole"></span></div><div class="hud-surfboard"><span class="hud-surfboard-shadow"></span><span class="hud-surfboard-deck"></span><span class="hud-surfboard-stripe"></span><span class="hud-surfboard-fin"></span></div><div class="hud-rowboat"><span class="hud-rowboat-shadow"></span><span class="hud-rowboat-hull"></span><span class="hud-rowboat-keel"></span><span class="hud-rowboat-oar"></span></div><div class="hud-fishnet"><span class="hud-fishnet-stake k1"></span><span class="hud-fishnet-stake k2"></span><span class="hud-fishnet-stake k3"></span><span class="hud-fishnet-mesh m1"></span><span class="hud-fishnet-mesh m2"></span><span class="hud-fishnet-float"></span></div><div class="hud-gull-glide"><span class="hud-gull-body"></span><span class="hud-gull-wing gw-left"></span><span class="hud-gull-wing gw-right"></span><span class="hud-gull-beak"></span></div>`;
  }
  if (seasonClass === 'season-winter') {
    let icicles = '';
    for (let i = 1; i <= 8; i++) icicles += `<span class="hud-icicle ic${i}"></span>`;
    let sparkle = extra.deepFreeze ? (() => { let s=''; for (let i=1;i<=6;i++) s += `<span class="hud-sparkle sp${i}"></span>`; return s; })() : '';
    // Деревня: три одинаковых домика, разведённые по плану классами h1..h3.
    // Размер, высота на склоне и дымка задаются в CSS — здесь только разметка.
    let village = '';
    for (let i = 1; i <= 3; i++) {
      village += `<div class="hud-winter-house h${i}"><span class="hud-winter-house-body"></span><span class="hud-winter-house-roof"></span><span class="hud-winter-house-door"></span><span class="hud-winter-warm-window"><span class="hud-window-pane p1"></span><span class="hud-window-pane p2"></span></span><span class="hud-winter-chimney"><span class="hud-winter-smoke sm1"></span><span class="hud-winter-smoke sm2"></span><span class="hud-winter-smoke sm3"></span></span></div>`;
    }
    // Сугробы: дальние (за домами), средние (наметённые к стенам) и передний
    // вал, в который утопают снеговик и крыльцо.
    // sd-snowman — отдельный маленький сугроб точно под снеговиком (не
    // проценты, а px, как и сам снеговик): широкий передний вал заканчивает
    // сходить на нет как раз у левого края, и на этой ширине снеговик мог
    // оказаться на голой земле, а сам вал — заметным отдельным куском левее
    // него. Свой сугроб гарантированно хоронит ему ноги независимо от
    // ширины карточки.
    let drifts = '';
    ['back1','back2','mid1','mid2','mid3','front1','front2','front3','front4','snowman']
      .forEach(k => { drifts += `<span class="hud-snowdrift sd-${k}"></span>`; });
    drifts = `<div class="hud-snowdrifts">${drifts}</div>`;

    // Новогодняя ёлка во дворе: только с 28 декабря по 13 января (флаг
    // приходит из index.js, там же разбирается число месяца). Ярусы — три
    // треугольника со снежными макушками, на них гирлянда, шары и звезда.
    let xmas = '';
    if (extra.newYear) {
      let baubles = '';
      for (let i = 1; i <= 9; i++) baubles += `<span class="hud-xmas-bauble b${i}"></span>`;
      let lights = '';
      for (let i = 1; i <= 14; i++) lights += `<span class="hud-xmas-light l${i}"></span>`;
      xmas = `<div class="hud-xmas-tree"><span class="hud-xmas-shadow"></span><span class="hud-xmas-trunk"></span><span class="hud-xmas-tier t3"></span><span class="hud-xmas-tier t2"></span><span class="hud-xmas-tier t1"></span><span class="hud-xmas-garland g1"></span><span class="hud-xmas-garland g2"></span>${lights}${baubles}<span class="hud-xmas-star"></span></div>`;
    }

    let backTrees = '';
    for (let i = 1; i <= 4; i++) {
      backTrees += `<span class="hud-bg-tree hud-bg-tree-winter bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span></span>`;
    }
    return `<div class="hud-winter-distant-forest"></div><div class="hud-winter-aurora"></div>${village}<div class="hud-icicle-row">${icicles}</div><div class="hud-ground hud-ground-snow"></div><div class="hud-winter-frozen-pond">${отражение(backTrees, 'ice')}</div><div class="hud-bg-trees">${backTrees}</div>${drifts}${xmas}${sparkle}<div class="hud-snowman"><span class="hud-snowman-shadow"></span><span class="hud-snowman-arm arm-left"></span><span class="hud-snowman-arm arm-right"></span><span class="hud-snowman-ball ball-bottom"></span><span class="hud-snowman-ball ball-mid"></span><span class="hud-snowman-button btn1"></span><span class="hud-snowman-button btn2"></span><span class="hud-snowman-button btn3"></span><span class="hud-snowman-ball ball-head"></span><span class="hud-snowman-eye eye-left"></span><span class="hud-snowman-eye eye-right"></span><span class="hud-snowman-carrot"></span><span class="hud-snowman-mouth"><span class="hud-snowman-pebble p1"></span><span class="hud-snowman-pebble p2"></span><span class="hud-snowman-pebble p3"></span><span class="hud-snowman-pebble p4"></span><span class="hud-snowman-pebble p5"></span></span><span class="hud-snowman-hat-brim"></span><span class="hud-snowman-hat-top"></span></div>`;
  }
  return '';
}
