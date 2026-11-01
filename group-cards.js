// hud-manager/group-cards.js
//
// Групповой чат: Таверна по умолчанию (режим «по очереди», generation_mode 0)
// кладёт в запрос карточку только того, кто сейчас говорит. HUD же пишет
// всех персонажей сцены — облик, возраст, характер остальных модель додумывала,
// и у третьего персонажа поля расходились с его карточкой. Здесь — карточки
// участников группы для инструкции HUD: в обычном ответе — всех, кроме
// говорящего (его карточка уже в запросе), при перегенерации HUD — всех.
// Режимы «склеить карточки» (1, 2) Таверна кладёт сама — тогда ничего не надо.

const ПРЕДЕЛ_ОПИСАНИЯ = 2000;
const ПРЕДЕЛ_ХАРАКТЕРА = 600;

const обрезать = (s, n) => {
  const т = String(s || '').trim();
  if (т.length <= n) return т;
  const кусок = т.slice(0, n);
  const конец = Math.max(кусок.lastIndexOf('\n'), кусок.lastIndexOf('. '));
  return (конец > n * 0.6 ? кусок.slice(0, конец + 1) : кусок).trim() + ' …';
};

/** Группа открытого чата или null. */
export function текущаяГруппа(ctx) {
  if (!ctx || !ctx.groupId || !Array.isArray(ctx.groups)) return null;
  return ctx.groups.find(г => г && String(г.id) === String(ctx.groupId)) || null;
}

/**
 * Участники группы: [{ имя, описание, характер, id }]. Выключенные участники
 * не говорят и в сцене обычно не нужны — их нет, кроме режима 2, где Таверна
 * сама зовёт и их.
 */
export function участникиГруппы(ctx) {
  const г = текущаяГруппа(ctx);
  if (!г || !Array.isArray(г.members)) return [];
  const выкл = new Set(Array.isArray(г.disabled_members) ? г.disabled_members : []);
  const персонажи = Array.isArray(ctx.characters) ? ctx.characters : [];
  return г.members
    .filter(аватар => !выкл.has(аватар))
    .map(аватар => {
      const id = персонажи.findIndex(ч => ч && ч.avatar === аватар);
      const ч = id >= 0 ? персонажи[id] : null;
      if (!ч) return null;
      const д = ч.data || {};
      return { id, имя: String(ч.name || д.name || '').trim(), описание: д.description || ч.description || '', характер: д.personality || ч.personality || '' };
    })
    .filter(у => у && у.имя && (String(у.описание).trim() || String(у.характер).trim()));
}

/**
 * Раздел инструкции с карточками участников. всех — при перегенерации HUD
 * (отдельный запрос без карточек Таверны); иначе — без говорящего и только
 * в режиме «по очереди». Пусто, если не группа или добавлять нечего.
 */
export function карточкиГруппы(ctx, { всех = false } = {}) {
  const г = текущаяГруппа(ctx);
  if (!г) return '';
  if (!всех && Number(г.generation_mode || 0) !== 0) return '';
  const говорит = Number.isInteger(Number(ctx.characterId)) ? Number(ctx.characterId) : -1;
  const кого = участникиГруппы(ctx).filter(у => всех || у.id !== говорит);
  if (!кого.length) return '';
  const карточки = кого.map(у => `### ${у.имя}\n${обрезать(у.описание, ПРЕДЕЛ_ОПИСАНИЯ)}${String(у.характер).trim() ? `\nPersonality: ${обрезать(у.характер, ПРЕДЕЛ_ХАРАКТЕРА)}` : ''}`.trim()).join('\n\n');
  return `GROUP CHAT — CARDS OF ${всех ? 'THE GROUP MEMBERS' : 'THE OTHER GROUP MEMBERS'}. Their HUD entries — name, age, appearance, body, personality, relationships — stay true to these cards; never invent a different look or past for them.\n\n${карточки}`;
}
