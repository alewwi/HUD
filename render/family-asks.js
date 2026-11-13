// hud-manager/render/family-asks.js
//
// Ответы игрока для генеалогического дерева: модель зовёт человека «дядей»
// или «тётей», а чьи они брат или сестра, в HUD не сказано. Игрок отвечает
// один раз — ответ живёт в метаданных чата: «брат Софи» вписывает его в
// дерево навсегда, «не родня» — и дальше не спрашиваем, и не рисуем.

const КЛЮЧ = 'tavernosHudFamily';

function контекстST() {
  try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; }
}
function хранилище() {
  const ctx = контекстST();
  const мета = ctx && (ctx.chatMetadata || ctx.chat_metadata);
  if (!мета) return null;
  if (!мета[КЛЮЧ] || typeof мета[КЛЮЧ] !== 'object') мета[КЛЮЧ] = {};
  if (!мета[КЛЮЧ].дяди || typeof мета[КЛЮЧ].дяди !== 'object') мета[КЛЮЧ].дяди = {};
  return мета[КЛЮЧ];
}
function сохранить() {
  const ctx = контекстST();
  try { (ctx?.saveMetadataDebounced || ctx?.saveMetadata)?.call(ctx); } catch (_) {}
}
const ключИмени = (имя) => String(имя || '').trim().toLowerCase();

/** Все ответы этого чата: [{ имя, родня }] или [{ имя, нет: true }]. */
export function ответыПроДядей() {
  const х = хранилище();
  return х ? Object.values(х.дяди).filter(о => о && о.имя) : [];
}

/** родня — имя того, чей он брат или сестра; пусто — «не родня». */
export function ответитьПроДядю(имя, родня) {
  const х = хранилище(), к = ключИмени(имя);
  if (!х || !к) return false;
  х.дяди[к] = родня ? { имя: String(имя).trim(), родня: String(родня).trim() } : { имя: String(имя).trim(), нет: true };
  сохранить();
  return true;
}

/** Забыть ответ — HUD снова спросит. */
export function забытьПроДядю(имя) {
  const х = хранилище(), к = ключИмени(имя);
  if (!х || !х.дяди[к]) return false;
  delete х.дяди[к];
  сохранить();
  return true;
}
