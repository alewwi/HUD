// hud-manager/scroll-chain.js
//
// Прокрутка пальцем насквозь. Внутри тела вкладки лежат свои списки, а тело
// лежит в чате. Браузер держит весь свайп на той области, с которой тот начался:
// дойдя до конца списка, палец просто стоял, и ход приходилось листать, целясь
// мимо плашек. Здесь остаток свайпа передаётся следующей области наружу, до чата.
//
// Обработчики пассивные: нативную прокрутку и нажатия они не трогают. Колесу мыши
// это не нужно, оно уходит наружу само.

const ПОРОГ = 4;

const запасВниз = (э) => э.scrollHeight - э.clientHeight - э.scrollTop;

/** Есть ли у области куда ехать: dy — сдвиг пальца, вверх — отрицательный. */
export function естьКуда(э, dy) {
  return dy < 0 ? запасВниз(э) > 1 : э.scrollTop > 1;
}

/** Области, через которые идёт свайп: от пальца наружу. */
export function цепьОт(цель, стиль = getComputedStyle) {
  const цепь = [];
  for (let э = цель; э && э.nodeType === 1; э = э.parentElement) {
    const с = стиль(э);
    // Перетаскивание и рисование: жест не про прокрутку.
    if (с.touchAction === 'none') return [];
    if (/auto|scroll/.test(с.overflowY) && э.scrollHeight > э.clientHeight + 1) цепь.push(э);
    if (э.id === 'chat' || с.overscrollBehaviorY === 'contain') break;
  }
  return цепь;
}

/**
 * Шаг свайпа. держит — номер области, на которой браузер держит жест: её двигает
 * он сам. Когда ей ехать некуда, сдвиг получает первая область снаружи.
 */
export function шагЦепочки(цепь, держит, dy) {
  if (держит < 0 || естьКуда(цепь[держит], dy)) return null;
  const э = цепь.slice(держит + 1).find(х => естьКуда(х, dy));
  if (!э) return null;
  э.scrollTop -= dy;
  return э;
}

export function подключитьЦепочкуПрокрутки(корень = document) {
  let ход = null;
  const точка = (e) => e.touches && e.touches[0];
  корень.addEventListener('touchstart', (e) => {
    const т = точка(e), цель = e.target;
    ход = null;
    if (!т || e.touches.length !== 1 || !цель || !цель.closest || !цель.closest('.hud-os-card')) return;
    ход = { x: т.clientX, y: т.clientY, цель, цепь: null, держит: -1 };
  }, { capture: true, passive: true });
  корень.addEventListener('touchmove', (e) => {
    const т = точка(e);
    if (!ход || !т) return;
    const dy = т.clientY - ход.y, dx = т.clientX - ход.x;
    if (!ход.цепь) {
      if (Math.abs(dy) < ПОРОГ && Math.abs(dx) < ПОРОГ) return;
      if (Math.abs(dx) > Math.abs(dy)) { ход = null; return; }
      ход.цепь = цепьОт(ход.цель);
      // Браузер берёт первую область, которой есть куда ехать в начале жеста.
      ход.держит = ход.цепь.findIndex(э => естьКуда(э, dy));
      if (ход.держит < 0) { ход = null; return; }
    } else шагЦепочки(ход.цепь, ход.держит, dy);
    ход.x = т.clientX; ход.y = т.clientY;
  }, { capture: true, passive: true });
  const конец = () => { ход = null; };
  корень.addEventListener('touchend', конец, { capture: true, passive: true });
  корень.addEventListener('touchcancel', конец, { capture: true, passive: true });
}
