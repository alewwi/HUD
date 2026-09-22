// hud-manager/render/assistant.js
//
// «Спросить про сюжет»: помощник к истории и HUD прямо из карточки.
// «Почему Софи злится?», «Что может пойти не так?» — модель отвечает по HUD,
// последним сообщениям и тому контексту, что выбран в настройках: заметки
// автора, карточка персонажа, персона игрока, лорбуки. Ответ видит только
// игрок: в чат ничего не пишется, основной диалог не трогается.
//
// Запрос уходит либо через выбранный профиль подключения (Connection
// Manager), либо через generateRaw текущей модели. На время запроса ставится
// флаг window.__tavernOSHudSkipInject: без него перехват запросов в index.js
// вшил бы в вопрос HUD-инструкцию, и модель ответила бы HUD-блоком.

import { escapeHtml, guardTouchSwipe } from '../utils.js?v=23.0.2';
import { settings } from '../settings.js?v=23.0.2';
import { parseHUDComplex } from '../hud-parser.js?v=23.0.2';
import { extractHudBlock, заменитьHudБлоки } from '../hud-block.js?v=23.0.2';

const ЖДЁМ_МС = 180000;

export const ПРОМПТ_АССИСТЕНТА = `<role>
You are the story assistant built into the HUD of a SillyTavern roleplay: an out-of-character analyst who helps the player understand and steer the story.
- The player: the human asking you questions. Talk to them directly.
- {{user}}: the player's character inside the story.
- {{char}} and everyone else: people inside the story.
You are NOT {{char}}. You never speak, think or act for anyone in the story.
</role>

<what_you_are_given>
- The HUD: a structured snapshot of the story state that the storytelling model writes after every turn — thoughts, hidden subtext, goals, relationships, trust, fears, secrets, memory, Chekhov's guns (setups not yet paid off), phone, world. Field names are Russian. Treat it as ground truth for the moment it was written.
- Recent messages, numbered: what actually happened, including anything after the HUD.
- Optionally: the character card, the player's persona, the author's note and lorebook entries — background facts about the world and the people.
</what_you_are_given>

<how_to_answer>
1. Answer in the language of the question.
2. Ground every claim in the material and point to it briefly: (HUD: Скрытый подтекст), (сообщение #214), (лорбук: Особняк).
3. Read between the lines the way the HUD invites: hidden subtext, trust against stated feelings, fears, unspoken goals, open flags and guns.
4. When the material is silent, say so, then give the most plausible reading clearly marked as a guess.
5. For "what next" questions, offer a few distinct options rather than one path, and name the hanging setups that could fire.
6. Be concise: a few short paragraphs or a short list. Markdown is fine.
7. Never continue the story, never write dialogue or actions for the characters, never output a [HUD] block. Mature fictional content is expected and is discussed plainly.
</how_to_answer>`;

// Проза сообщения для запроса: без HUD, без разметки и чужих служебных вставок.
function проза(текст) {
  return заменитьHudБлоки(String(текст || ''), ' ')
    .replace(/<(think|thinking|plan|comics|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const обрезать = (s, n) => { const t = String(s || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
const атрибут = (s) => String(s || '').replace(/[<>"&]/g, ' ').trim();

// Контекст вопроса: HUD ближайшего к карточке сообщения и реплики до него.
// Скрытые сообщения не берём — их не видит и сама история.
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
  const начало = Math.max(0, i + 1 - n);
  const messages = список.slice(начало, i + 1)
    .map((m, k) => ({ m, index: начало + k }))
    .filter(({ m }) => m && !m.is_system)
    .map(({ m, index }) => ({ index, role: m.is_user ? 'user' : 'assistant', name: String(m.name || (m.is_user ? 'User' : '?')), text: проза(m.mes).slice(0, 1500) }))
    .filter(m => m.text);
  return { hud, hudAt, messages };
}

// Карточка персонажа: описание, характер, сценарий — с развёрнутыми макросами.
export function карточкаПерсонажа(ctx) {
  const id = ctx ? ctx.characterId : undefined;
  const c = id !== undefined && id !== null && id !== '' && ctx.characters ? ctx.characters[id] : null;
  if (!c) return null;
  const d = c.data || c;
  const развернуть = (s) => { try { return typeof ctx.substituteParams === 'function' ? ctx.substituteParams(String(s)) : String(s); } catch (_) { return String(s); } };
  const поля = [['Description', d.description ?? c.description], ['Personality', d.personality ?? c.personality], ['Scenario', d.scenario ?? c.scenario]]
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `${k}:\n${развернуть(v).trim()}`);
  return поля.length ? { name: c.name || d.name || ctx.name2 || '', text: поля.join('\n\n') } : null;
}

// Персона игрока. Сначала через макрос {{persona}} — он знает, какая персона
// выбрана сейчас, в любой версии SillyTavern; потом по настройкам напрямую.
export function персонаИгрока(ctx) {
  try {
    const s = ctx && typeof ctx.substituteParams === 'function' ? ctx.substituteParams('{{persona}}') : '';
    if (s && s !== '{{persona}}') return String(s).trim();
  } catch (_) { /* дальше */ }
  try {
    const pu = window.power_user || (ctx && ctx.powerUserSettings) || {};
    const id = window.user_avatar || (ctx && (ctx.user_avatar || ctx.userAvatar));
    const pd = id && pu.persona_descriptions ? pu.persona_descriptions[id] : null;
    if (typeof pd === 'string' && pd.trim()) return pd.trim();
    if (pd && typeof pd.description === 'string' && pd.description.trim()) return pd.description.trim();
    if (typeof pu.persona_description === 'string' && pu.persona_description.trim()) return pu.persona_description.trim();
  } catch (_) { /* нет */ }
  return '';
}

// Заметки автора этого чата (Author's Note).
export function заметкиАвтора(ctx) {
  const мета = (ctx && (ctx.chatMetadata || ctx.chat_metadata)) || window.chat_metadata || {};
  return String(мета.note_prompt || (ctx && (ctx.authorsNote || ctx.authors_note)) || '').trim();
}

function сжатьHud(v) {
  if (Array.isArray(v)) { const a = v.map(сжатьHud).filter(x => x !== undefined); return a.length ? a : undefined; }
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { const y = сжатьHud(x); if (y !== undefined) o[k] = y; }
    return Object.keys(o).length ? o : undefined;
  }
  const s = String(v ?? '').trim();
  return !s || /^(empty|none|null|undefined|нет)$/i.test(s) ? undefined : s;
}

const ПРЕДЕЛ_ЛОРБУКОВ = 16000;

export function buildAssistantPrompt({ question, hud, hudAt, messages, history, userName, charName, card, persona, note, lore }) {
  const блоки = [];
  блоки.push(`<story_roles>\nThe player's character ({{user}}): ${userName || 'the user'}. The main character ({{char}}): ${charName || 'the character'}.\n</story_roles>`);
  if (hud) {
    блоки.push(`<hud_state${hudAt !== null && hudAt !== undefined ? ` at_message="${hudAt}"` : ''}>\n`
      + 'JSON with Russian field names: Мысли — thoughts, Скрытый подтекст — hidden subtext, Отношения — relationships, Доверие — trust, Страхи — fears, Цели — goals, secrets — secrets, guns — Chekhov\'s guns.\n'
      + JSON.stringify(сжатьHud(hud) || {}).slice(0, 14000) + '\n</hud_state>');
  }
  if (card && card.text) блоки.push(`<character_card name="${атрибут(card.name)}">\n${обрезать(card.text, 8000)}\n</character_card>`);
  if (persona) блоки.push(`<user_persona name="${атрибут(userName)}">\n${обрезать(persona, 3000)}\n</user_persona>`);
  if (note) блоки.push(`<authors_note>\n${обрезать(note, 2000)}\n</authors_note>`);
  let запас = ПРЕДЕЛ_ЛОРБУКОВ;
  (Array.isArray(lore) ? lore : []).forEach(книга => {
    if (!книга || !Array.isArray(книга.entries) || запас <= 0) return;
    const записи = [];
    книга.entries.forEach((e, i) => {
      if (запас <= 0) return;
      const текст = обрезать(e, Math.min(3000, запас));
      запас -= текст.length;
      записи.push(`Entry ${i + 1}:\n${текст}`);
    });
    if (записи.length) блоки.push(`<lorebook name="${атрибут(книга.name)}">\n${записи.join('\n\n')}\n</lorebook>`);
  });
  блоки.push(messages && messages.length
    ? `<recent_story>\n${messages.map(m => `<msg index="${m.index ?? '?'}" role="${m.role || 'assistant'}" name="${атрибут(m.name)}">\n${m.text}\n</msg>`).join('\n')}\n</recent_story>`
    : '<recent_story>not available</recent_story>');
  const прошлое = (history || []).slice(-4).map(h => `Q: ${h.q}\nA: ${h.a}`).join('\n\n');
  if (прошлое) блоки.push(`<earlier_questions>\n${прошлое}\n</earlier_questions>`);
  блоки.push(`<question>\n${String(question || '').trim()}\n</question>`);
  блоки.push('Answer as the story assistant: ground it in the material above, cite fields and message numbers briefly, mark guesses as guesses. Do not continue the story, do not write a [HUD] block.');
  return блоки.join('\n\n');
}

export function parseAssistantAnswer(raw) {
  let текст = '';
  if (typeof raw === 'string') текст = raw;
  else if (raw && typeof raw === 'object') {
    текст = raw.text || (typeof raw.content === 'string' ? raw.content : '')
      || (Array.isArray(raw.content) ? raw.content.map(c => c && c.text || '').join('') : '')
      || (raw.choices && raw.choices[0] && (raw.choices[0].message?.content || raw.choices[0].text)) || '';
  }
  return заменитьHudБлоки(String(текст), '')
    .replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '')
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

// Ответ с простой разметкой: абзацы, списки, жирный и курсив. Текст сначала
// экранируется целиком — разметка ставится только поверх безопасной строки.
const строчная = (s) => s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
export function разметкаОтвета(текст) {
  let html = '', список = false;
  for (const строка of escapeHtml(String(текст || '')).split('\n')) {
    const пункт = строка.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (пункт) { if (!список) { html += '<ul>'; список = true; } html += `<li>${строчная(пункт[1])}</li>`; continue; }
    if (список) { html += '</ul>'; список = false; }
    if (строка.trim()) html += `<p>${строчная(строка)}</p>`;
  }
  return html + (список ? '</ul>' : '');
}

const вАбзацы = (s) => escapeHtml(s).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');

// Запрос: выбранный профиль подключения или текущая модель чата.
async function отправить(ctx, systemPrompt, prompt, профили) {
  const профиль = String(settings.assistantProfileId || '');
  const токены = Math.max(256, Math.min(16000, parseInt(settings.assistantMaxTokens, 10) || 1500));
  const служба = ctx.ConnectionManagerRequestService;
  if (профиль && служба && typeof служба.sendRequest === 'function') {
    const есть = (typeof профили === 'function' ? профили() : []).some(p => String(p.id) === профиль);
    if (!есть) throw new Error('профиль подключения из настроек ассистента не найден — выберите другой');
    return служба.sendRequest(профиль, [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], токены,
      { stream: false, extractData: true, includePreset: false, includeInstruct: false });
  }
  if (typeof ctx.generateRaw !== 'function') throw new Error('SillyTavern не отдал функцию генерации');
  return ctx.generateRaw({ prompt, systemPrompt, responseLength: токены });
}

let окноОткрыто = false;

export function openAssistantDialog({ mesId = null, лорбуки = null, сохранить = null, профили = null } = {}) {
  if (окноОткрыто) return;
  окноОткрыто = true;

  let ctx = null;
  try { ctx = window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null; } catch (_) { ctx = null; }
  const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const стартовый = собратьКонтекст(chat, mesId, 0);
  const запомнить = () => { if (typeof сохранить === 'function') { try { сохранить(); } catch (_) { /* не критично */ } } };

  const переключатели = [
    ['assistantIncludeHud', '📊 HUD', 'Снимок состояния истории из этого сообщения'],
    ['assistantIncludeNote', '📝 Заметки автора', 'Author’s Note этого чата'],
    ['assistantIncludeCard', '🎭 Карточка', 'Описание, характер и сценарий персонажа'],
    ['assistantIncludePersona', '👤 Персона', 'Описание вашей персоны'],
  ];
  const книги = Array.isArray(settings.assistantLorebooks) ? settings.assistantLorebooks : [];
  const профильИмя = (() => {
    const id = String(settings.assistantProfileId || '');
    if (!id) return 'модель чата';
    const p = (typeof профили === 'function' ? профили() : []).find(x => String(x.id) === id);
    return p ? (p.name || p.id) : 'профиль не найден';
  })();

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-ask-modal" role="dialog" aria-modal="true" aria-label="Спросить про сюжет">
      <div class="hud-modal-head"><span class="hud-ask-orb" aria-hidden="true"></span><span class="hud-ask-title">Спросить про сюжет<small>ответ видите только вы — в чат ничего не пишется</small></span></div>
      <div class="hud-modal-body">
        <div class="hud-ask-ctx" role="group" aria-label="Что увидит ассистент">
          <label class="hud-ask-num" title="Сколько последних сообщений чата прочитает ассистент">💬 <input type="number" min="0" max="60" value="${Math.max(0, Math.min(60, Number(settings.assistantContextMessages ?? 12)))}"> сообщ.</label>
          ${переключатели.map(([ключ, подпись, пояснение]) => `<button type="button" class="hud-ask-toggle" data-key="${ключ}" aria-pressed="${settings[ключ] !== false}" title="${escapeHtml(пояснение)}">${подпись}</button>`).join('')}
          <span class="hud-ask-info" title="${escapeHtml(книги.length ? 'Лорбуки: ' + книги.join(', ') : 'Лорбуки выбираются в настройках расширения, группа «Ассистент»')}">📚 ${книги.length || 'нет'}</span>
          <span class="hud-ask-info" title="Профиль подключения выбирается в настройках расширения">🧠 ${escapeHtml(профильИмя)}</span>
        </div>
        <div class="hud-ask-log" aria-live="polite"></div>
        <div class="hud-ask-chips">${suggestedQuestions(стартовый.hud).map(q => `<button type="button" class="hud-ask-chip">${escapeHtml(q)}</button>`).join('')}</div>
        <textarea class="hud-modal-text hud-ask-input" rows="3" placeholder="Например: почему Софи злится?"></textarea>
        <div class="hud-modal-note">Ctrl+Enter — отправить. <span class="hud-ask-size"></span></div>
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
  const размер = $('.hud-ask-size');
  const история = [];
  let занято = false;

  const закрыть = () => { окноОткрыто = false; overlay.remove(); document.removeEventListener('keydown', поКлавише); };
  const поКлавише = (e) => { if (e.key === 'Escape') закрыть(); };
  document.addEventListener('keydown', поКлавише);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  $('.cancel').addEventListener('click', закрыть);
  overlay.querySelectorAll('.hud-ask-chip').forEach(b => b.addEventListener('click', () => { поле.value = b.textContent; поле.focus(); }));
  overlay.querySelectorAll('.hud-ask-toggle').forEach(b => b.addEventListener('click', () => {
    const ключ = b.dataset.key;
    settings[ключ] = settings[ключ] === false;
    b.setAttribute('aria-pressed', String(settings[ключ] !== false));
    запомнить();
  }));
  $('.hud-ask-num input').addEventListener('change', (e) => {
    let v = parseInt(e.target.value, 10);
    if (!Number.isFinite(v) || v < 0) v = 0; if (v > 60) v = 60;
    e.target.value = v; settings.assistantContextMessages = v; запомнить();
  });

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
    if (!ctx) { реплика('hud-ask-a is-error', 'SillyTavern недоступен — спросить не получится.'); return; }
    занято = true; кнопка.disabled = true; поле.value = '';
    реплика('hud-ask-q', вАбзацы(вопрос));
    const ожидание = реплика('hud-ask-a is-wait', '<span class="hud-ask-typing" aria-hidden="true"><i></i><i></i><i></i></span><span class="hud-ask-wait-text">Думаю…</span>');
    let секунд = 0;
    const тик = setInterval(() => {
      секунд++;
      const подпись = ожидание.querySelector('.hud-ask-wait-text');
      if (подпись) подпись.textContent = 'Думаю… ' + секунд + ' с';
    }, 1000);
    let безHud = false;
    try {
      const контекст = собратьКонтекст(ctx.chat, mesId, settings.assistantContextMessages ?? 12);
      const имяИгрока = ctx.name1 || window.name1 || '';
      // Ключи лорбуков ищем там же, где их ищет таверна: в вопросе и в сцене.
      const поискКлючей = [вопрос, ...контекст.messages.map(m => m.text)].join('\n');
      let записи = [];
      if (книги.length && typeof лорбуки === 'function') {
        try { записи = await лорбуки(книги, поискКлючей, settings.assistantLoreAll === true); }
        catch (e) { console.warn('[TavernOS HUD] Лорбуки для ассистента не загрузились:', e); }
      }
      const prompt = buildAssistantPrompt({
        question: вопрос, history: история, userName: имяИгрока, charName: ctx.name2 || window.name2 || '',
        hud: settings.assistantIncludeHud !== false ? контекст.hud : null, hudAt: контекст.hudAt, messages: контекст.messages,
        card: settings.assistantIncludeCard !== false ? карточкаПерсонажа(ctx) : null,
        persona: settings.assistantIncludePersona !== false ? персонаИгрока(ctx) : '',
        note: settings.assistantIncludeNote !== false ? заметкиАвтора(ctx) : '',
        lore: записи,
      });
      const systemPrompt = String(settings.assistantSystemPrompt || '').trim() || ПРОМПТ_АССИСТЕНТА;
      размер.textContent = `Запрос: ≈${Math.round((prompt.length + systemPrompt.length) / 100) / 10} тыс. символов${записи.length ? ', записей лорбука: ' + записи.reduce((a, к) => a + к.entries.length, 0) : ''}.`;
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      const raw = await Promise.race([
        отправить(ctx, systemPrompt, prompt, профили),
        new Promise((_, reject) => setTimeout(() => reject(new Error('модель молчит дольше ' + (ЖДЁМ_МС / 1000) + ' с')), ЖДЁМ_МС)),
      ]);
      const ответ = parseAssistantAnswer(raw);
      if (!ответ) throw new Error('модель вернула пустой ответ');
      ожидание.className = 'hud-ask-a';
      ожидание.innerHTML = разметкаОтвета(ответ);
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
