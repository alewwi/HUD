// hud-manager/tabs-order.js
//
// Порядок, скрытие и закрепление вкладок карточки (настройки tabOrder,
// tabHidden, tabPinned). Карточка собирает вкладки одним addTab в renderHUD
// (index.js), а здесь — только правило, в каком порядке их показать.
//
// Скрыть ≠ выключить. Выключить (enableX) — модель этот блок не пишет, и он
// ничего не стоит. Скрыть — модель пишет и HUD копит (данные нужны модели и
// соседним блокам), но ярлыка в карточке нет.

// Стабильные id вкладок. У всех персонажей один id: переставляется группа,
// а не люди — людей в ходе то трое, то пятеро. enable — флаг, который
// выключает сам блок (для подписи «скрыто — всё равно платите, выключить?»).
export const ВКЛАДКИ = [
  { id: 'character', имя: 'Персонажи', значок: '👤' },
  { id: 'user', имя: 'Игрок', значок: '👤', enable: 'enableUserBlock' },
  { id: 'combat', имя: 'Бой', значок: '⚔️', enable: 'enableCombat' },
  { id: 'babies', имя: 'Детская', значок: '🍼', enable: 'enableBabies' },
  { id: 'casket', имя: 'Шкатулка', значок: '🗝️', enable: 'enableCasket' },
  { id: 'phone', имя: 'Телефон', значок: '📱', enable: 'enablePhone' },
  { id: 'memory', имя: 'Память', значок: '🧠', enable: 'enableMemory' },
  { id: 'life', имя: 'Быт', значок: '🧺', enable: 'enableLife' },
  { id: 'overheard', имя: 'Подслушанное', значок: '👂', enable: 'enableOverheard' },
  { id: 'intercepts', имя: 'Перехваты', значок: '📡', enable: 'enableIntercepts' },
  { id: 'diary', имя: 'Дневник', значок: '📖', enable: 'enableDiary' },
  { id: 'bodydiary', имя: 'Дневник тела', значок: '🕯', enable: 'enableDiary' },
  { id: 'dreams', имя: 'Сны', значок: '🌙', enable: 'enableDreams' },
  { id: 'pets', имя: 'Спутники', значок: '🐾', enable: 'enableCompanions' },
  { id: 'world', имя: 'Мир', значок: '🌍', enable: 'enableWorld' },
];

const массив = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];

/**
 * Вкладки в порядке показа. вкладки — [{ id, … }] в том порядке, в каком их
 * собрал renderHUD. Закреплённые — первыми (в порядке закрепления), затем по
 * tabOrder; вкладки, которых в tabOrder нет (новая вкладка у старого
 * пользователя), — в конец, сохраняя исходный порядок между собой. Скрытые
 * не показываются; если скрыто всё — показываем всё, а не пустую карточку.
 */
export function упорядочитьВкладки(вкладки, s = {}) {
  const список = Array.isArray(вкладки) ? вкладки : [];
  const порядок = массив(s.tabOrder), закреп = массив(s.tabPinned);
  const скрыто = new Set(массив(s.tabHidden));
  const исх = new Map(список.map((т, i) => [т, i]));
  const вес = (т) => {
    const з = закреп.indexOf(т.id);
    if (з !== -1) return з;
    const i = порядок.indexOf(т.id);
    return 1e6 + (i === -1 ? 1e5 + исх.get(т) : i);
  };
  const видимые = список.filter(т => !скрыто.has(т.id));
  return (видимые.length ? видимые : список).slice().sort((a, b) => (вес(a) - вес(b)) || (исх.get(a) - исх.get(b)));
}

/**
 * Полный порядок id для настроек: сначала то, что уже в tabOrder (незнакомые
 * id не выбрасываем — вкладка, которой сегодня нет, не теряет место), затем
 * остальные из ВКЛАДКИ. Нужен «Кастомизации», где список показан целиком.
 */
export function полныйПорядок(s = {}) {
  const порядок = массив(s.tabOrder);
  const все = ВКЛАДКИ.map(в => в.id);
  return [...порядок, ...все.filter(id => !порядок.includes(id))];
}

// Переставить id на шаг вверх/вниз в полном порядке. Возвращает новый массив.
export function сдвинуть(порядок, id, шаг) {
  const p = порядок.slice(), i = p.indexOf(id), j = i + шаг;
  if (i === -1 || j < 0 || j >= p.length) return p;
  [p[i], p[j]] = [p[j], p[i]];
  return p;
}
