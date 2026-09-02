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

export function buildSeasonSceneHtml(seasonClass, extra) {
  extra = extra || {};
  if (seasonClass === 'season-autumn') {
    let birds = '';
    for (let i = 1; i <= 5; i++) birds += `<span class="hud-bird b${i}"></span>`;
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
      const foliage = `<span class="hud-bg-tree-autumn-foliage foliage-${i}" aria-hidden="true"></span>`;
      backTrees += `<span class="hud-bg-tree hud-bg-tree-autumn bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span>${foliage}${apples}${fallingLeaves}</span>`;
    }
    const fallenApples = `<div class="hud-fallen-apples"><span class="hud-fallen-apple fa1"></span><span class="hud-fallen-apple fa2"></span><span class="hud-fallen-apple fa3"></span><span class="hud-fallen-apple fa4"></span><span class="hud-fallen-apple fa5"></span></div>`;
    return `<div class="hud-ground hud-ground-autumn"></div><div class="hud-bg-trees">${backTrees}</div><div class="hud-bird-flock">${birds}</div>${fallenApples}<div class="hud-hedgehog"><span class="hud-hedgehog-apple ha1"></span><span class="hud-hedgehog-apple ha2"></span><span class="hud-hedgehog-body"></span><span class="hud-hedgehog-spikes"></span><span class="hud-hedgehog-face"></span></div><div class="hud-burrow"><span class="hud-burrow-mound"></span><span class="hud-burrow-hole"></span><span class="hud-burrow-animal"><span class="hud-burrow-animal-body"></span><span class="hud-burrow-animal-spines"></span><span class="hud-burrow-animal-face"></span></span></div><div class="hud-campfire"><span class="hud-campfire-log"></span><span class="hud-campfire-flame f1"></span><span class="hud-campfire-flame f2"></span><span class="hud-campfire-smoke s1"></span><span class="hud-campfire-smoke s2"></span><span class="hud-campfire-smoke s3"></span></div>`;
  }
  if (seasonClass === 'season-spring') {
    let flowers = '';
    for (let i = 1; i <= 5; i++) {
      flowers += `<span class="hud-flower f${i}"><span class="hud-flower-stem"></span><span class="hud-flower-head"><span class="hud-petal p1"></span><span class="hud-petal p2"></span><span class="hud-petal p3"></span><span class="hud-petal p4"></span><span class="hud-flower-center"></span></span></span>`;
    }
    let pollen = '';
    for (let i = 1; i <= 4; i++) pollen += `<span class="hud-pollen d${i}"></span>`;
    let dew = extra.dew ? `<span class="hud-dew dw1"></span><span class="hud-dew dw2"></span><span class="hud-dew dw3"></span><span class="hud-dew dw4"></span>` : '';
    let backTrees = '';
    for (let i = 1; i <= 4; i++) {
      const nest = i === 2
        ? `<span class="hud-bg-nest"><span class="hud-bg-chick c1"></span><span class="hud-bg-chick c2"></span></span>`
        : '';
      backTrees += `<span class="hud-bg-tree hud-bg-tree-spring bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span><span class="hud-bg-tree-canopy"></span>${nest}</span>`;
    }
    return `<div class="hud-meadow"></div><div class="hud-bg-trees">${backTrees}</div><div class="hud-flowerbed">${flowers}</div>${pollen}${dew}<div class="hud-butterfly"><span class="hud-butterfly-wing w-left"></span><span class="hud-butterfly-wing w-right"></span></div><div class="hud-bee bee1"><span class="hud-bee-wing"></span></div><div class="hud-bee bee2"><span class="hud-bee-wing"></span></div>`;
  }
  if (seasonClass === 'season-summer') {
    let teeth = '';
    for (let i = 1; i <= 6; i++) teeth += `<span class="hud-umbrella-tooth"></span>`;
    return `<div class="hud-summer-horizon"></div><div class="hud-summer-distant-island"></div><div class="hud-sand"></div><div class="hud-sailboat"><span class="hud-sailboat-wake"></span><span class="hud-sailboat-hull"></span><span class="hud-sailboat-sail"></span><span class="hud-sailboat-jib"></span><span class="hud-sailboat-mast"></span><span class="hud-sailboat-lantern"></span></div><div class="hud-gull g1"></div><div class="hud-gull g2"></div><div class="hud-sea"><span class="hud-wave w1"></span><span class="hud-wave w2"></span><span class="hud-sea-night"></span><span class="hud-sea-moonpath"></span><span class="hud-sea-sparkle"></span></div><div class="hud-summer-heat-haze"></div><div class="hud-sandcastle"><span class="hud-sandcastle-base"></span><span class="hud-sandcastle-tower t1"></span><span class="hud-sandcastle-tower t2"></span><span class="hud-sandcastle-tower t3"></span><span class="hud-sandcastle-turret tr1"></span><span class="hud-sandcastle-turret tr2"></span><span class="hud-sandcastle-turret tr3"></span><span class="hud-sandcastle-flag"></span><span class="hud-sandcastle-shovel"></span></div><div class="hud-volleyball-net"><span class="hud-net-post post-left"></span><span class="hud-net-post post-right"></span><span class="hud-net-band"></span><span class="hud-net-mesh"></span></div><div class="hud-volleyball"><span class="hud-volleyball-seam s1"></span><span class="hud-volleyball-seam s2"></span></div><div class="hud-summer-dragonfly"><span class="hud-dragonfly-head"></span><span class="hud-dragonfly-body"><i></i><i></i><i></i></span><span class="hud-dragonfly-wing wing1"></span><span class="hud-dragonfly-wing wing2"></span><span class="hud-dragonfly-wing wing3"></span><span class="hud-dragonfly-wing wing4"></span></div><div class="hud-summer-cicada-sound c1"></div><div class="hud-summer-cicada-sound c2"></div><div class="hud-towel-shadow"></div><div class="hud-towel"></div><div class="hud-umbrella"><span class="hud-umbrella-canopy"></span><span class="hud-umbrella-valance">${teeth}</span><span class="hud-umbrella-pole"></span></div><div class="hud-surfboard"><span class="hud-surfboard-shadow"></span><span class="hud-surfboard-deck"></span><span class="hud-surfboard-stripe"></span><span class="hud-surfboard-fin"></span></div><div class="hud-gull-glide"><span class="hud-gull-body"></span><span class="hud-gull-wing gw-left"></span><span class="hud-gull-wing gw-right"></span><span class="hud-gull-beak"></span></div>`;
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

    let backTrees = '';
    for (let i = 1; i <= 4; i++) {
      backTrees += `<span class="hud-bg-tree hud-bg-tree-winter bt${i}"><span class="hud-bg-tree-trunk"></span><span class="hud-bg-tree-branch br1"></span><span class="hud-bg-tree-branch br2"></span><span class="hud-bg-tree-branch br3"></span></span>`;
    }
    return `<div class="hud-winter-distant-forest"></div><div class="hud-winter-aurora"></div>${village}<div class="hud-winter-animal-trail"><span class="hud-animal-print ap1"></span><span class="hud-animal-print ap2"></span><span class="hud-animal-print ap3"></span><span class="hud-animal-print ap4"></span></div><div class="hud-icicle-row">${icicles}</div><div class="hud-ground hud-ground-snow"></div><div class="hud-winter-frozen-pond"><span class="hud-ice-crack cr1"></span><span class="hud-ice-crack cr2"></span><span class="hud-ice-crack cr3"></span><span class="hud-ice-crack cr4"></span></div><div class="hud-bg-trees">${backTrees}</div>${drifts}${sparkle}<div class="hud-snowman"><span class="hud-snowman-shadow"></span><span class="hud-snowman-arm arm-left"></span><span class="hud-snowman-arm arm-right"></span><span class="hud-snowman-ball ball-bottom"></span><span class="hud-snowman-ball ball-mid"></span><span class="hud-snowman-button btn1"></span><span class="hud-snowman-button btn2"></span><span class="hud-snowman-button btn3"></span><span class="hud-snowman-ball ball-head"></span><span class="hud-snowman-eye eye-left"></span><span class="hud-snowman-eye eye-right"></span><span class="hud-snowman-carrot"></span><span class="hud-snowman-mouth"><span class="hud-snowman-pebble p1"></span><span class="hud-snowman-pebble p2"></span><span class="hud-snowman-pebble p3"></span><span class="hud-snowman-pebble p4"></span><span class="hud-snowman-pebble p5"></span></span><span class="hud-snowman-hat-brim"></span><span class="hud-snowman-hat-top"></span></div>`;
  }
  return '';
}
