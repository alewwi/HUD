// hud-manager/render/assistant.js
//
// «Спросить про сюжет»: окно вопросов к модели прямо из карточки HUD.
// «Почему Софи злится?» — модель отвечает по HUD этого сообщения и последним
// репликам. Ответ видит только игрок: в чат ничего не пишется, основной
// диалог не трогается.
//
// Запрос уходит через generateRaw SillyTavern. На время запроса ставится
// флаг window.__tavernOSHudSkipInject: без него перехват запросов в index.js
// вшил бы в вопрос HUD-инструкцию, и модель ответила бы HUD-блоком.

import { escapeHtml, guardTouchSwipe } from '../utils.js?v=22.99.22';
import { settings } from '../settings.js?v=22.99.22';
import { parseHUDComplex } from '../hud-parser.js?v=22.99.22';
import { extractHudBlock } from '../history-analyzer.js?v=22.99.22';

const HUD_БЛОК = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/gi;
const ЖДЁМ_МС = 180000;

// Проза сообщения для запроса: без HUD, без разметки и чужих служебных вставок.
function проза(текст) {
  return String(текст || '')
    .replace(HUD_БЛОК, ' ')
    .replace(/<(think|thinking|plan|comics|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Контекст вопроса: HUD ближайшего к карточке сообщения и реплики до него.
export function собратьКонтекст(chat, индекс, сколько) {
  const список = Array.isArray(chat) ? chat : [];
  if (!список.length) return { hud: null, hudAt: null, messages: [] };
  const i = Number.isInteger(индекс) && индекс >= 0 && индекс < список.length ? индекс : список.length - 1;
  let hud = null, hudAt = null;
  for (let j = i; j >= 0 && j >= i - 30; j--) {
    const блок = extractHudBlock(String(список[j] && список[j].mes || ''));
    if (!блок) continue;
    try { hud = parseHUDComplex(блок); hudAt = j; break; } catch (_) { /* битый — ищем выше */ }
  }
  const n = Math.max(0, Math.min(60, Number(сколько) || 0));
  const messages = список.slice(Math.max(0, i + 1 - n), i + 1)
    .filter(m => m && !m.is_system)
    .map(m => ({ name: String(m.name || (m.is_user ? 'User' : '?')), text: проза(m.mes).slice(0, 1500) }))
    .filter(m => m.text);
  return { hud, hudAt, messages };
}

export function buildAssistantPrompt({ question, hud, hudAt, messages, history, userName, charName }) {
  // Пустое убираем: модели не нужны десятки «empty».
  const сжать = (v) => {
    if (Array.isArray(v)) { const a = v.map(сжать).filter(x => x !== undefined); return a.length ? a : undefined; }
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) { const y = сжать(x); if (y !== undefined) o[k] = y; }
      return Object.keys(o).length ? o : undefined;
    }
    const s = String(v ?? '').trim();
    return !s || /^(empty|none|null|undefined|нет)$/i.test(s) ? undefined : s;
  };
  const состояние = hud ? JSON.stringify(сжать(hud) || {}).slice(0, 14000) : '';
  const сцена = (messages || []).map(m => `${m.name}: ${m.text}`).join('\n\n');
  const прошлое = (history || []).slice(-4).map(h => `Q: ${h.q}\nA: ${h.a}`).join('\n\n');
  return [
    состояние ? `STORY STATE — the HUD snapshot${hudAt !== null && hudAt !== undefined ? ` at message #${hudAt}` : ''}, JSON with Russian field names (Мысли = thoughts, Скрытый подтекст = hidden subtext, Отношения = relationships, Доверие = trust, Страхи = fears, Цели = goals, secrets = секреты):\n${состояние}` : 'STORY STATE: no HUD snapshot is available.',
    сцена ? `RECENT STORY, oldest first:\n${сцена}` : 'RECENT STORY: not available.',
    прошлое ? `EARLIER QUESTIONS IN THIS SESSION:\n${прошлое}` : '',
    `The player is ${userName || 'the user'}; the main character is ${charName || 'the character'}.`,
    `QUESTION:\n${String(question || '').trim()}`,
    'Answer in the language of the question. 2-6 sentences. Explain the likely reasons with concrete details from the HUD (thoughts, hidden subtext, relationships, trust, fears, goals, secrets) and from the recent messages, and name the source briefly in brackets, e.g. "(HUD: скрытый подтекст)". If the material does not say, admit it and give the most plausible reading, clearly marked as a guess. Do not role-play, do not continue the story, do not write a [HUD] block.',
  ].filter(Boolean).join('\n\n');
}

export function parseAssistantAnswer(raw) {
  const текст = typeof raw === 'string' ? raw
    : (raw && (raw.text || raw.content || (raw.choices && raw.choices[0] && (raw.choices[0].message?.content || raw.choices[0].text)))) || '';
  return String(текст)
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(HUD_БЛОК, '')
    .trim();
}

// Готовые вопросы по именам из HUD — чтобы не начинать с пустого поля.
export function suggestedQuestions(hud) {
  const имена = (hud && Array.isArray(hud.characters) ? hud.characters : [])
    .map(c => String(c && c['Имя'] || '').trim().split(/\s+/)[0]).filter(Boolean).slice(0, 2);
  const out = [];
  if (имена[0]) out.push(`Почему ${имена[0]} так себя ведёт?`, `Что ${имена[0]} скрывает?`);
  if (имена[1]) out.push(`Как ${имена[1]} относится ко мне на самом деле?`);
  out.push('Кто здесь кому не доверяет?', 'Что может пойти не так дальше?');
  return out.slice(0, 5);
}

const вАбзацы = (s) => escapeHtml(s).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');

let окноОткрыто = false;

export function openAssistantDialog({ mesId = null } = {}) {
  if (окноОткрыто) return;
  окноОткрыто = true;

  let ctx = null;
  try { ctx = window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null; } catch (_) { ctx = null; }
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const стартовый = собратьКонтекст(chat, mesId, 0);

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-ask-modal" role="dialog" aria-modal="true" aria-label="Спросить про сюжет">
      <div class="hud-modal-head">❓ Спросить про сюжет <small>ответ видите только вы — в чат ничего не пишется</small></div>
      <div class="hud-modal-body">
        <div class="hud-ask-log" aria-live="polite"></div>
        <div class="hud-ask-chips">${suggestedQuestions(стартовый.hud).map(q => `<button type="button" class="hud-ask-chip">${escapeHtml(q)}</button>`).join('')}</div>
        <textarea class="hud-modal-text hud-ask-input" rows="3" placeholder="Например: почему Софи злится?"></textarea>
        <div class="hud-modal-note">Модель прочитает HUD этого сообщения и ${Number(settings.assistantContextMessages ?? 12)} последних реплик. Ctrl+Enter — отправить.</div>
      </div>
      <div class="hud-modal-foot">
        <button type="button" class="hud-modal-btn cancel">Закрыть</button>
        <button type="button" class="hud-modal-btn save hud-ask-send">Спросить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  guardTouchSwipe(overlay);

  const $ = (s) => overlay.querySelector(s);
  const журнал = $('.hud-ask-log');
  const поле = $('.hud-ask-input');
  const кнопка = $('.hud-ask-send');
  const история = [];
  let занято = false;

  const закрыть = () => { окноОткрыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише); };
  const поКлавише = (e) => { if (e.key === 'Escape') закрыть(); };
  document.addEventListener('keydown', поКлавише);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  $('.cancel').addEventListener('click', закрыть);
  overlay.querySelectorAll('.hud-ask-chip').forEach(b => b.addEventListener('click', () => { поле.value = b.textContent; поле.focus(); }));

  const реплика = (класс, html) => {
    const el = document.createElement('div');
    el.className = класс;
    el.innerHTML = html;
    журнал.appendChild(el);
    журнал.scrollTop = журнал.scrollHeight;
    return el;
  };

  const спросить = async () => {
    const вопрос = поле.value.trim();
    if (!вопрос || занято) return;
    if (!ctx || typeof ctx.generateRaw !== 'function') {
      реплика('hud-ask-a is-error', 'SillyTavern не отдал функцию генерации — спросить не получится.');
      return;
    }
    занято = true; кнопка.disabled = true; поле.value = '';
    реплика('hud-ask-q', вАбзацы(вопрос));
    const ожидание = реплика('hud-ask-a is-wait', 'Думаю…');
    let секунд = 0;
    const тик = setInterval(() => { секунд++; ожидание.textContent = 'Думаю… ' + секунд + ' с'; }, 1000);
    let безHud = false;
    try {
      const контекст = собратьКонтекст(ctx.chat, mesId, settings.assistantContextMessages ?? 12);
      const prompt = buildAssistantPrompt({
        question: вопрос, hud: контекст.hud, hudAt: контекст.hudAt, messages: контекст.messages, history: история,
        userName: ctx.name1 || window.name1 || '', charName: ctx.name2 || window.name2 || '',
      });
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      const raw = await Promise.race([
        ctx.generateRaw({
          prompt,
          systemPrompt: 'You answer questions about an ongoing roleplay story using only the provided HUD state and story excerpt. You are an analyst, not a character: you never continue the story. Mature fictional content is expected.',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('модель молчит дольше ' + (ЖДЁМ_МС / 1000) + ' с')), ЖДЁМ_МС)),
      ]);
      const ответ = parseAssistantAnswer(raw);
      if (!ответ) throw new Error('модель вернула пустой ответ');
      ожидание.className = 'hud-ask-a';
      ожидание.innerHTML = вАбзацы(ответ);
      история.push({ q: вопрос, a: ответ });
    } catch (e) {
      console.error('[TavernOS HUD] Вопрос про сюжет не удался:', e);
      ожидание.className = 'hud-ask-a is-error';
      ожидание.textContent = 'Не получилось: ' + (e && e.message ? e.message : e);
    } finally {
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      clearInterval(тик);
      занято = false; кнопка.disabled = false;
      журнал.scrollTop = журнал.scrollHeight;
    }
  };
  кнопка.addEventListener('click', спросить);
  поле.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); спросить(); } });
  setTimeout(() => поле.focus(), 30);
}
