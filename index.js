// hud-manager/index.js (v21.5.5)

import { hexToRgba, settings, defaultSettings } from './settings.js?v=22.51.0';
import { escapeHtml, getSafeUserName } from './utils.js?v=22.51.0';
import { parseHUDComplex, repairGeneratedHudBlock, scoreHudJsonCandidate, setHudRepairDiagnostic } from './hud-parser.js?v=22.51.0';
import { initGlobalEvents, initObserver, initTavernOSEvents } from './events.js?v=22.51.0';
import { buildUserHTML, buildCharacterHTML } from './render/character.js?v=22.51.0';
import { buildDiaryHTML, hudHasMeaningfulDiary } from './render/diary.js?v=22.51.0';
import { buildDreamHTML, hudHasMeaningfulDreams } from './render/dreams.js?v=22.51.0';
import { buildInterceptsHTML, hudHasMeaningfulIntercepts } from './render/intercepts.js?v=22.51.0';
import { buildMemoryHTML } from './render/memory.js?v=22.51.0';
import { buildPhoneTabsHTML } from './render/phone.js?v=22.51.0';
import { hudHasRelations } from './render/relations-graph.js?v=22.51.0';
import { buildLightningSvg, buildSeasonSceneHtml } from './render/scene.js?v=22.51.0';
import { buildWorldHTML, hudHasMeaningfulWorld } from './render/world.js?v=22.51.0';
import { applyThemeClass, presetRowHTML } from './themes.js?v=22.51.0';
import { invalidateAvatarCache, refreshAvatarFaces } from './avatars.js?v=22.51.0';

(function() {
  window.HUD = window.HUD || {};
  window.HUD.bootstrap = true;
  'use strict';


  let lastSceneWeather = '';
  // Сообщение, для которого сейчас собирается HUD. Нужно, чтобы дотянуться
  // до предыдущего и узнать, какая там была погода.
  let renderTargetMes = null;

  // Погода ближайшего сообщения выше по чату, у которого она записана.
  function previousMessageWeather() {
    let el = renderTargetMes && renderTargetMes.previousElementSibling;
    while (el) {
      if (el.classList && el.classList.contains('mes') && el.dataset.hudWeather) return el.dataset.hudWeather;
      el = el.previousElementSibling;
    }
    // Мы внутри сообщения, а выше по чату дождя никто не записал — значит его
    // и не было. Глобальный lastSceneWeather здесь брать нельзя: он хранит
    // погоду последней отрисовки в любом месте чата, и от него лужа
    // «прилипала» к сухим ходам навсегда.
    return renderTargetMes ? '' : lastSceneWeather;
  }
  let cachedChatContainer = null;

  // Типы генераций SillyTavern, для которых HUD-инструкции инжектить НЕЛЬЗЯ:
  // 'quiet'       — фоновая "тихая" генерация (саммари, автоперевод, генерация промпта для
  //                 картинки, и т.д. — то, что не идёт в чат и не должно видеть пользователь);
  // 'impersonate' — генерация СООБЩЕНИЯ ЗА ПОЛЬЗОВАТЕЛЯ ("Impersonate" кнопка). Если сюда
  //                 просочится наш системный промпт "generate a [HUD] JSON block", модель начнёт
  //                 примешивать HUD-инструкции в текст, который должен звучать от лица юзера.
  // Всё остальное (обычная генерация, regenerate, swipe, continue, групповые чаты) — это
  // нормальный ответ персонажа в чат, туда HUD инжектить можно и нужно.
  const HUD_BLOCKED_GEN_TYPES = ['quiet', 'impersonate'];

  // Официальный SillyTavern Prompt Interceptor: вызывается ПЕРЕД каждым реальным запросом на
  // генерацию (не при dry run) и сообщает точный тип генерации через параметр `type`.
  // См. manifest.json -> "generate_interceptor". Это единственный официальный (не эвристический)
  // способ узнать "это обычное сообщение в чат или фоновая/чужая генерация" ДО того, как уйдёт
  // сетевой запрос — поэтому используем его как источник истины для window.fetch-патча ниже,
  // а не парсинг URL/тела запроса (который легко спутать с саммари/другими расширениями).
  let lastGenType = null;
  const pendingGenTypes = [];
  window.tavernOSGenerateInterceptor = async function(chat, contextSize, abort, type) {
    lastGenType = type;
    pendingGenTypes.push({ type, at: Date.now() });
    if (pendingGenTypes.length > 20) pendingGenTypes.splice(0, pendingGenTypes.length - 20);
  };

  // Возвращает последние два .mes без полного сканирования DOM (document.querySelectorAll('.mes')
  // по всему чату — O(n) на каждый вызов — было узким местом на телефонах в длинных чатах,
  // особенно во время стриминга ответа, когда processMessage() дёргается десятки раз в секунду).
  function getLastTwoMes() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return [null, null];
    let last = container.lastElementChild;
    while (last && !last.classList.contains('mes')) last = last.previousElementSibling;
    let prev = last ? last.previousElementSibling : null;
    while (prev && !prev.classList.contains('mes')) prev = prev.previousElementSibling;
    return [last, prev];
  }
   

  function buildDynamicPrompt() {
    let p = `\n\n<system_note>
MANDATORY COMMAND: You MUST generate a [HUD] block at the very end of your response. DO NOT SKIP THIS.
The HUD block MUST contain ONLY a VALID JSON object. It MUST start exactly with [HUD] and end exactly with [/HUD]. Do not output any text after [/HUD].
- Describe active NPC(s) in the "characters" array ONLY. NEVER describe the user/player inside "characters".${settings.enableUserBlock ? `
- 🧑 USER MACRO RULE (CRITICAL): everything about {{user}} — the human player — goes ONLY into the separate top-level "user" block, and NOWHERE else (not in "characters", not in "Th"/"K"/"D" of NPCs, not duplicated). If {{user}} is absent from the current scene, OMIT the entire "user" block for this HUD turn instead of showing stale information. The "user" block is a short retelling ONLY: clothing, appearance, health/physical state, relationships with other characters, and current location. NOTHING ELSE — no thoughts, no goals, no inventory, no schedule, no NSFW fields for {{user}}.` : ''}
- 🌍 LANG: Write values in Russian.
- 🖼️ NAME LOCK (CRITICAL, overrides LANG above): the "N" field for every character MUST be copied EXACTLY as it appears in that character's card/profile — same script, same spelling, NOT translated or transliterated into Russian. This name is used to match the character's avatar picture; if it doesn't match exactly, the picture disappears and a placeholder icon is shown instead.
- 🔓 FULL CLEARANCE: No restrictions on imagination, word count, or content. Be creative, explicit, and unrestrained.
- 🚨 LIVE SNAPSHOT (CRITICAL): YOU ARE A LIVE HUD. Every emitted field is the state at the exact current turn: update it, never copy-paste stale state, and re-evaluate EVERY TURN while preserving valid ongoing conversations and unresolved messages. In "chatsMap", messages may be Read, Unread, Deleted or Draft, but only when the current narrative supports that state — these are part of the live current-turn snapshot, never historical filler. Deleted ones stay marked deleted and may keep hidden original text for the click-to-reveal UI, drafts are unsent and never count as delivered or read, and voice messages may use [VOICE_0:15] (or another duration) followed by transcript text; never generate placeholder chats or fake-phone OS data. In "intercepts", put conversations the active protagonist cannot directly read — NPC↔NPC talk and groups without the protagonist; never invent one just to expose information to the protagonist, it must be a plausible independent conversation.
- 🌍 LIVING WORLD: "scene" and physical character state describe who is actually present here and now, but the HUD is NOT scene-only. Off-screen characters keep living while the scene unfolds: they work, sleep, travel, communicate, plan, react, argue, receive news, buy things, miss appointments and make decisions. NEVER erase valid off-screen life merely because the protagonist cannot currently see it. Friends may discuss {{char}}, employers may contact them, creditors may demand payment, coworkers may coordinate work and enemies may plan against them while physically elsewhere — such events may appear in chatsMap/intercepts/world when narratively justified. Communication is just as independent: incoming messages may concern work, friends, family, romance, debt, logistics, bureaucracy, enemies, rivals or routine life, and a character may receive them without answering — busy, asleep, working, traveling, offline, ignoring, emotionally overwhelmed or simply not checking the phone are all valid reasons for silence.
- 📦 SCHEMA IS FIXED, CONTENT IS VARIABLE (CRITICAL): Every enabled top-level section and every field its schema defines MUST be emitted every turn. Arrays may hold 0..N items; never invent filler content. Use [] for empty arrays, {} for empty objects and "empty" for empty required scalar/string fields. Omitting a required key is NOT a way to say "nothing changed" or "nothing to report" — keep the key and give it its empty value. The ONLY intentional exception is conditional NSFW content: those fields may hold "empty" when inactive, and the renderer may hide them.
- 📱 ONE PHONE, ONE OWNER (CRITICAL): "chatsMap" and "phone" are ONE device — the personal phone of the person named in "phone.owner". The OWNER is whoever that phone belongs to; keep the name identical in every chat and every turn. EVERY chat in "chatsMap" MUST be a conversation the owner personally takes part in, as one of the two sides — the ordinary phone shows the owner's OWN correspondence and nothing else. A conversation between two OTHER people is NOT the owner's chat and goes to "intercepts", even if the owner knows about it, is discussed in it, was told about it, or could read it: participation decides, not access. Example: owner is Брэндон, a chat between Ричард and his lawyer has no Брэндон in it → "intercepts". Contacts, gallery, notes, maps and search are the owner's own. If unsure whether the owner personally takes part, it goes to "intercepts".
- 👥 PARTICIPANTS RULE: Emit "participants" ONLY for a genuine GROUP conversation — THREE OR MORE people including the owner. For any one-to-one chat OMIT the field entirely; never write "Нет", "none", "empty" or a single name. The parser silently drops any list shorter than three names, so a one- or two-name list is wasted output. In a group chat list all actual participants known at the current turn, separated by ;.
- 🧠 MEMORY SCOPE: memory.mood and memory.route track ONLY {{user}} and {{char}} as the main protagonists. If a protagonist is absent from the physical scene, do not invent a present-scene mood or route event for them; this does NOT erase their broader world state from messaging, schedules, relationships or other world-level structures. Mood history: MAX 12 recent points per protagonist. Route history: MAX 20 recent points per protagonist. Timeline: MAX 5 recent events of TODAY.
- 🕸️ RELATION WEB (drives the Memory infographic): JS draws an SVG spiderweb from "Rel" fields. EVERY character in "characters" AND the "user" block MUST emit a complete Rel covering EVERY other named person who currently matters ({{user}}, {{char}}, scene NPCs, mentioned NPCs). Format EXACTLY "Name: how THIS person feels toward Name", separated by ;. Relationships MUST be bidirectional: if Аня has "Максим: ревнует", Максим MUST exist in "characters" with Rel containing "Аня: ...". Any NPC mentioned in anyone's Rel MUST also appear in "characters" with their own Rel. Never omit Rel and never write "empty" while other named people exist this turn.
- 🧠 KNOWLEDGE BOUNDARIES: Every character knows only what they could plausibly know. Never leak another character's private thoughts, private conversations, intercepted messages or hidden plans into a different character's internal state without a believable information path.
- 🛑 NSFW LIFECYCLE: Fields "W", "NSFW_Det", "SexRev", and user's "UW" MUST ONLY be active during intimacy, sex, or high arousal. Once the scene cools down, clear them by writing "empty". Do NOT leave old NSFW details active. EXCEPTION — "Kink", "Fet", "NoGo" and "NoTurn" are STABLE character traits, not scene state: once known they stay filled every turn and are NEVER cleared when the scene cools down.
- 🔗 KINK vs FETISH (never mix them): a KINK is a broad practice, scenario or dynamic — roleplay ("teacher and student", "doctor and patient"), BDSM (dominance/submission, bondage), toys, sensory play (temperature, tickling), power exchange. A FETISH is narrower: a specific object, material, body part or setting that is not erotic in itself but is required for arousal or strongly amplifies it — stockings, shoes, latex, leather, silk, feet, hair, neck, medical procedures. Rule of thumb: an ACTIVITY goes to "Kink", a THING (object, material, body part, setting) goes to "Fet". Consent and safety are assumed for everything listed in "Kink" and "Fet"; anything the character refuses belongs to "NoGo", anything that simply leaves them cold belongs to "NoTurn".
- 🌦️ FORECAST & HOROSCOPE: "world.forecast" is a plain daily weather forecast for the settlement the scene is in, four rows — morning, day, evening, night — each formatted "Период | Погода | Температура | Короткая заметка". The weather field MUST contain one plain weather word so the interface can pick its icon: ясно, солнечно, облачно, пасмурно, дождь, ливень, морось, гроза, снег, метель, туман, ветрено. Keep it consistent with "scene.Погода" for the current part of the day, and let it drift naturally across the rest. "world.horoscope" is a full daily horoscope: ONE row for EVERY ONE of the 12 zodiac signs, formatted "Знак | что ждёт этот знак сегодня | тон", where тон is удача, неудача or ровно. Say plainly who gets lucky today, who runs into trouble and who had better stay home. "world.prediction" is one or two lines of general fortune closing the block. This whole block is light entertainment in the spirit of a newspaper back page — playful, superstitious, occasionally absurd. It is NEVER a directive: it MUST NOT command {{user}} or {{char}}, MUST NOT decide plot events, and nothing in the story is obliged to come true because the horoscope said so.
- 👁️ HIDDEN SUBTEXT ("D"): NOT a second thoughts field and NOT a summary of feelings. It is a concrete ACTION the character performs RIGHT NOW, alongside whatever the scene openly shows, that gives away something they are not saying. It does NOT have to contradict them — it only has to be unspoken. It may be deliberate and hidden from the people present, an involuntary tell the character does not control, an ordinary gesture whose real reason they would deny even to themselves, or behaviour that quietly undercuts what they just claimed — any of these, whichever the moment actually supports. Draw it from THIS scene: the act must fit where the character is, what is within reach and what they are doing this turn. Write the visible act and what it gives away in one line, so the reading follows from the behaviour and not from a named emotion. Do NOT manufacture a hidden layer where there is none: if the character is doing exactly what they appear to be doing, use "empty".
- 📖 DIARY: The diary is PRIVATE IN-WORLD WRITING, not a scene summary or an AI report. Every entry MUST name its "author" — ALWAYS a character or NPC, NEVER {{user}} — and be written by that author in first person, containing only what they personally experienced, know, believe, remember, suspect or misunderstand. "text" is the author's own diary: their day, condition, emotions, inner conflict, decisions, memories, regrets, hopes, plans and self-talk — not a report about {{user}}. Every entry MUST also carry "aboutUser": a separate private first-person subsection where the SAME author says what they personally think and feel about {{user}} — attraction, anger, tenderness, resentment, fear, curiosity, observations, memories, wishes, doubts, unresolved questions. It is not omniscient analysis and not a second narrator; keep it apart from the general self-reflection and use "empty" if there is nothing meaningful this turn. Every entry SHOULD also carry a short "mood" (or "emotion") naming the writer's dominant tone — sadness, tears, anger, stress, panic, rush, relief, guilt, joy, calm, longing. It drives visual styling only, so keep it to one word or a short phrase.
- ⚠️ FORMATTING: Use EXACTLY these short English keys. ESCAPE inner quotes like this: "He said \\"Hello\\".". ALWAYS use semicolons (;) for lists, NEVER slashes (/).
- 🏷️ LABELED SUB-FIELDS (for "SexLast", "W", "Kink", "Fet", "NoGo", "NoTurn" and "NSFW_Det"): every item inside these fields MUST be written as "Label: value", NOT as a bare value, and items MUST be separated by a semicolon — NOT by a comma. A comma-separated list renders as one long unreadable pill instead of separate ones. Never output just the answer alone — always prefix it with its label and a colon. Example for "W": "Penis state: hard, throbbing; Volume: loud, breathy moans and sharp slapping sounds; Smell: sweat and arousal; Traces: precum on the sheets; Arousal level: 9/10; Partner: Anna; Protection: none".
- 🔊 "Volume" DEFINITION: the "Volume" sub-field inside "W" describes SPECIFICALLY the loudness/intensity of the sounds being made during the act — moans, screams, whimpers, skin-slapping/spanking sounds, bed creaking, wet sounds, etc. It is NOT about music, TV, or ambient environment volume. Always phrase it as "Volume: <how loud/intense the sexual sounds are, and which sounds>".
- 📦 CODE FENCE (CRITICAL): wrap the ENTIRE JSON object in a fenced code block using triple backticks with the "json" language tag, exactly as shown below. This is MANDATORY — it stops the chat's markdown renderer from corrupting underscores/asterisks/quotes inside the JSON. The opening \`\`\`json line goes immediately after [HUD], the closing \`\`\` line goes immediately before [/HUD]. Never omit the fence.

[HUD]
\`\`\`json
{
 "scene": {
  "T": "[Time HH:MM | Day phase. UPDATE REAL-TIME!]",
  "Wth": "[Weather and Temp. UPDATE REAL-TIME!]",
  "Dt": "[Day of Week, Date with Year. UPDATE REAL-TIME!]",
  "Atm": "[Atmosphere - one short sensory phrase. UPDATE REAL-TIME!]",
  "Md": "[Overall mood. UPDATE REAL-TIME!]"
 },
 "characters": [
  {
   "N": "[Original name]",
   "A": "[Age, DD.MM.YYYY]",
   "C": "[Current attire. UPDATE REAL-TIME!]",
   "R": "[Role/job]",
   "B": "[Physical/mental state. UPDATE REAL-TIME!]",
   "Ph": "[Physiology/arousal. UPDATE REAL-TIME!]",
   "L": "[Exact location. UPDATE REAL-TIME!]",
   "Th": "[Immediate thought. UPDATE REAL-TIME!]",
   "K": "[Brief contextual thoughts. Use ANY fitting emojis. MINIMUM 3-5 ENTRIES. Separate by ; UPDATE REAL-TIME!]",
   "Exp": "[Expectation vs Reality: What NPC expects to happen next vs what will actually happen. UPDATE REAL-TIME!]",
   "D": "[A concealed, unconscious or unspoken action the character performs right now, and what it gives away. UPDATE REAL-TIME!]",
   "I": "[Inventory items. Format EXACTLY as 'Item: condition'. Separate by ;]",
   "G": "[Goals in 3 strict categories: 1. Right now, 2. Near future, 3. Long-term. Format exactly as: 'Сейчас: [goal]; Скоро: [goal]; Будущее: [goal]'. UPDATE REAL-TIME!]",
   "S": "[Upcoming schedule. MUST include time (exact like '14:30' or approx like 'Вечер') for EACH item! Format: 'Time - Event'; Separate by ; UPDATE REAL-TIME!]",
   "Rel": "[THIS character's feelings toward ALL other relevant named people ({{user}}, {{char}}, scene NPCs, mentioned NPCs). Format EXACTLY 'Name: how THIS person feels about Name'. Separate by ;. MUST be bidirectional: if A lists B, B's Rel MUST list A. Mentioned NPCs MUST also be in this characters array with their own Rel.]",
   "Mem": "[Shared memories with User or NPCs; Separate by ;]",
   "Flag": "[Plot flags/upcoming consequences; Separate by ;]",
   "St": "[Social/romantic status]",
   "Exo": "[Social Exposure: 0-100% and minor oddities. UPDATE REAL-TIME!]",
   "X": "[Conflict depth. MUST use format 'Причина: ...; Дней: ...; Стадия: ...'. Separate by ;]",
   "SexLast": "[Last sex. MUST use format 'Date: ...; Partner: ...; Acts: ...; Ending: ...'. Separate by ;]",
   "SexCount": "[Lifetime number of sexual partners]",
   "SexReg": "[Sexual regularity/libido level]",
   "W": "[DURING INTIMACY, EACH item as 'Label: value': 'Penis state: ...; Volume: ...; Smell: ...; Traces: ...; Arousal level: ...; Partner: ...; Protection: ...'. 'Volume' = intensity/loudness of sexual sounds (moans, slapping, etc), see rule above. Separate by ; ALWAYS update dynamically!]",
   "Kink": "[STABLE TRAIT, keep filled across turns. Practices and scenarios this character enjoys or is drawn to — roleplay, BDSM, bondage, toys, sensory play, power exchange. EACH item as 'Label: value' where value says how willingly and how far they go: 'Ролевые игры: охотно, любит сценарий врач-пациент; Связывание: только сама сверху'. MINIMUM 2-4 items when known. Separate by ;]",
   "Fet": "[STABLE TRAIT, keep filled across turns. NARROWER than a kink: specific objects, materials, body parts or settings that are not erotic in themselves but are required for arousal or strongly amplify it — stockings, latex, leather, silk, feet, hair, neck, medical settings. EACH item as 'Label: value': 'Чулки: обязательное условие; Шея: сильный триггер'. Separate by ;]",
   "NoGo": "[STABLE TRAIT. Hard limits — what this character will NEVER do sexually under any circumstances. EACH item as 'Label: value' where value is the reason: 'Боль: панический страх; Втроём: не делится'. Separate by ;]",
   "NoTurn": "[STABLE TRAIT. Turn-offs — not forbidden, simply kills arousal or leaves them cold. EACH item as 'Label: value': 'Спешка: сразу теряет настрой; Грубые слова: гасит'. Separate by ;]",
   "NSFW_Det": "[AFTERMATH ONLY, EACH item as 'Label: value': 'Sensitivity: 1-10; Readiness for round 2: ...; Physical aftermath: ...; Emotional aftermath: ...'. Separate items by ; — NOT by a comma, or everything collapses into one pill!]",
   "SexRev": "[AFTERMATH ONLY: Full written review of the sex, like an Amazon review. End with a 5-star rating (e.g. Оценка: ★★★★☆). Write in full sentences. UPDATE REAL-TIME!]"
  }
 ]`;

    if (settings.enableUserBlock) {
      p += `,
 "user": {
  "A": "[{{user}}'s Age and Date of Birth (DD.MM.YYYY)]",
  "C": "[{{user}}'s CURRENT clothing/attire ONLY. UPDATE REAL-TIME!]",
  "Ap": "[{{user}}'s physical appearance ONLY. UPDATE REAL-TIME!]",
  "H": "[{{user}}'s health/physical state ONLY. UPDATE REAL-TIME!]",
  "Rel": "[{{user}}'s feelings toward EVERY other relevant named person. Format EXACTLY 'Name: how {{user}} feels about Name'; Separate by ;. MUST be bidirectional with those characters' Rel fields.]",
  "L": "[{{user}}'s exact current location ONLY. UPDATE REAL-TIME!]",
  "UW": "[DURING INTIMACY ONLY. EACH item as 'Label: value': 'Уровень возбуждения: ...; Уровень желания: ...; Готовность: ...; Лобок/Волосы: ...; Анатомия (вагина/клитор, чувствительность, заполненность и т.д.): ...; Смазка: ...; Грудь/Соски: ...; Громкость: ...; Следы: ...; Готовность ко 2 раунду: ...'. CLEAR TO 'empty' WHEN SCENE ENDS! Separate by ;]"
 }`;
    }

    if (settings.enableMemory) {
      p += `,
 "memory": {
  "timeline": ["[HH:MM] - [Event]", "MAX 5 RECENT EVENTS OF TODAY; KEEP CHRONOLOGICAL"],
  "mood": {
   "user": {"current": "[Current mood of {{user}} in the scene]", "history": ["[HH:MM] - [mood]"]},
   "char": {"current": "[Current mood of {{char}} in the scene]", "history": ["[HH:MM] - [mood]"]}
  },
  "route": {
   "user": ["[HH:MM] - [place] - [arrived/left/stayed/moved]"],
   "char": ["[HH:MM] - [place] - [arrived/left/stayed/moved]"]
  },
  "important": ["[Important fact / recently learned fact]"],
  "secrets": [
   {
    "fact": "[Secret fact]",
    "level": "low | medium | high | critical",
    "status": "unknown | suspected | partial | known",
    "knows": [{"name": "[Who knows]", "source": "[How/why they know]"}],
    "hidden": ["[Who does NOT know]"]
   }
  ]
  - SECRET LIFECYCLE: If a secret becomes revealed/known to everyone in the story, DELETE that secret object from future HUDs instead of marking it as active.
  - SECRET DISPLAY: Each knower MUST have a source explaining how they learned it. Use the level and dynamic status truthfully. Do not invent knowledge.
  - MAIN PROTAGONIST NAMES: The rendered Memory labels must use the real names of {{user}} and {{char}}, never "Вы", "User", "главный персонаж", "Char", or "главный персонаж".
  - ACTIVE SCENE MEMORY: If either protagonist is absent from the current scene, emit an empty object/array for that protagonist's mood and route; do not invent off-screen tracking.
 }`;
    }

    if (settings.enablePhone) {
      p += `,
  "chatsMap": {
   "[Contact Name OR Group Name]": {
    "owner": "[ALWAYS {{char}} — this device belongs to {{char}} and to nobody else]",
    "participants": "[OPTIONAL — include ONLY if this is a group chat; omit the field entirely for one-to-one chats]",
    "messages": [
     "[Sender] -> [Recipient]: [Message] | [Time] | [Read/Unread/Deleted/Draft]",
     "VOICE NOTE: prefix the message text with [VOICE_M:SS] to send it as an audio message instead of text, e.g. 'Аня -> {{user}}: [VOICE_0:42] Перезвони мне, это срочно | 21:40 | Unread'. Use it when a character would realistically record audio rather than type — walking, driving, crying, in a hurry, or being deliberately intimate."
    ]
   }
  },
  "phone": {
   "owner": "[ALWAYS {{char}}. This is {{char}}'s personal device — contacts, gallery, notes, maps and search below are {{char}}'s own. Never put another person's name here.]",
   "contacts": [
    {"name": "[Contact name as saved on the device]", "note": "[OPTIONAL: how they are saved / short tag, e.g. 'Не брать трубку', 'Универ']"}
   ],
   "gallery": [
    {"title": "[Photo title]", "time": "[When it was taken]", "desc": "[What is on the photo, 1-2 sentences]", "meta": "[OPTIONAL: who took it / album / hidden meaning]"}
   ],
   "notes": [
    {"title": "[Note title]", "time": "[Created/edited]", "text": "[Note body — lists, drafts, thoughts the character typed]", "footer": "[OPTIONAL: short trailing line]"}
   ],
   "maps": [
    {"place": "[Saved place or recent route]", "note": "[OPTIONAL: why it matters — 'Дом Грея', 'Смотрели вчера в 23:40']"}
   ],
   "search": [
    "[A search query the character actually typed, verbatim — these reveal what they are secretly worried about]"
   ]
  }`;
    }

    if (settings.enableIntercepts) {
      p += `,
 "intercepts": [
  {
   "target": "[NPC owner whose phone is intercepted]",
   "chatName": "[NPC-to-NPC or group chat name]",
   "participants": "[OPTIONAL — include ONLY for a group chat; omit the field entirely for one-to-one/private chats]",
   "messages": [
    "[REAL-TIME SECRET CONVERSATION] [Sender] -> [Recipient]: [Msg] | [Time] | [Read/Unread/Deleted/Draft]",
    "VOICE NOTE: the same [VOICE_M:SS] prefix works here — intercepted audio is often more revealing than text."
   ]
  }
 ]`;
    }

    if (settings.enableDiary) {
      p += `,
 "diary": [
  {
   "author": "[Character/NPC name — NEVER {{user}}]",
   "time": "[Date/Time]",
   "text": "[FIRST-PERSON PRIVATE DIARY ENTRY about the author's own day, physical state, emotions, thoughts, doubts, decisions and self-reflection. MINIMUM 4-7 SENTENCES. The author may talk to themselves and process the situation in their own voice. Never write as an omniscient narrator.]",
   "aboutUser": "[PRIVATE FIRST-PERSON SUB-ENTRY ABOUT {{user}} ONLY: what the author feels, thinks, wants, fears, notices, remembers or wonders about {{user}}. Write from the author's perspective, never as an external analysis. If the author has nothing meaningful to say about {{user}} this turn, use 'empty'.]",
   "mood": "[Short dominant mood tag for the diary entry: e.g. sadness, stress, anger, panic, calm, relief, guilt, longing, joy. Keep it brief and use one strong descriptor.]",
   "emotion": "[Optional alternate emotion word if the writer's feeling is more specific. If mood is used, emotion may be empty.]"
  }
 ]`;
    }

    if (settings.enableDreams) {
      p += `,
 "dreams": [
  {
   "text": "[Vivid recent dream or nightmare - ONLY IF SLEEPING or UNCONSCIOUS. UPDATE REAL-TIME!]",
   "meaning": "[AI interpretation of the dream's hidden meaning]"
  }
 ]`;
    }

    if (settings.enableWorld) {
      p += `,
 "world": {
  "headlines": ["[Headline 1] | [Article text. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"],
  "rumors": ["[Rumor 1. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"],
  "forecast": ["[Утро | weather word | +7°C | short note]", "[День | ... ]", "[Вечер | ... ]", "[Ночь | ... ]"],
  "horoscope": ["[Овен | one-line prediction for today | удача]", "[GENERATE ALL 12 SIGNS!]"],
  "prediction": ["[One or two lines of general fortune for the day]"],
  "ads": ["[Ad 1. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"]`;
      if (settings.showComments) {
        p += `,
  "comments": ["[User1: comment. UPDATE REAL-TIME!]", "[GENERATE N AMOUNT!]"]`;
      }
      p += `\n }`;
    }
     
    p += `\n}\n\`\`\`\n[/HUD]\n</system_note>`;

    if (settings.useCards && typeof window.characters !== 'undefined' && window.this_chid !== undefined) {
      const char = window.characters[window.this_chid];
      if (char && char.personality) p += `\n\nPlaying as ${char.name}.`;
    }
    return p;
  }


  if (!window.__tavernOSFetchPatched) {
      window.__tavernOSFetchPatched = true;

      const originalFetch = window.fetch;
      window.fetch = async function(resource, options) {
    if (settings.autoInject && options && options.method === 'POST' && options.body && typeof options.body === 'string') {
      const urlStr = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
      const isImageRequest = /image|sdapi|draw|vision|dall-e/i.test(urlStr);
      if (window.__tavernOSHudRegenRequest === true) return originalFetch.apply(window, arguments);

      // Достоверная проверка типа генерации: если interceptor успел сообщить нам, что это
      // 'quiet' (саммари/автоперевод/фоновая генерация) или 'impersonate' (генерация ЗА юзера),
      // не трогаем запрос вообще — пусть уходит как есть, без наших HUD-инструкций.
      // lastGenType === null означает "interceptor ещё не отработал в этой сессии" (например,
      // очень старый клиент SillyTavern без поддержки generate_interceptor) — в этом случае
      // не блокируем, чтобы не сломать инъекцию на старых версиях (fail-open).
      const isHudGenerationEndpoint = !isImageRequest && urlStr.includes('/api/') && (urlStr.includes('generate') || urlStr.includes('completions') || urlStr.includes('chat'));
      // Correlate the official generate_interceptor entry only with an actual text-generation
      // request. Other POSTs (settings, lorebooks, avatars, etc.) must never consume a queued
      // generation type, otherwise a quiet/impersonate classification can leak into the next chat.
      let effectiveGenType = null;
      if (isHudGenerationEndpoint) {
        const now = Date.now();
        while (pendingGenTypes.length && now - pendingGenTypes[0].at > 10000) pendingGenTypes.shift();
        const queued = pendingGenTypes.length ? pendingGenTypes.shift() : null;
        effectiveGenType = queued ? queued.type : lastGenType;
        lastGenType = pendingGenTypes.length ? pendingGenTypes[pendingGenTypes.length - 1].type : null;
      }
      const isBlockedGenType = effectiveGenType !== null && HUD_BLOCKED_GEN_TYPES.includes(effectiveGenType);

      if (isHudGenerationEndpoint && !isBlockedGenType) {
        try {
          let parsedBody = JSON.parse(options.body);
          let modified = false;

          const hasImageParams = parsedBody.negative_prompt !== undefined || parsedBody.width !== undefined || parsedBody.height !== undefined || parsedBody.size !== undefined || parsedBody.steps !== undefined || parsedBody.sampler_name !== undefined;
          const hasTextParams = parsedBody.messages !== undefined || parsedBody.max_tokens !== undefined || parsedBody.max_new_tokens !== undefined || parsedBody.temperature !== undefined;

          // ВОЗВРАЩАЕМ ЗАЩИТУ ОТ ИНЖЕКТА В КАРТИНКИ
          if (hasImageParams || !hasTextParams) return originalFetch.apply(window, arguments);

          let hudsToKeep = parseInt(settings.hudsToKeep, 10);
          if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = 2;

          // Единая функция для сборки текста саммари (добавлен Возраст)
          const buildSummaryText = (hudText) => {
              let parsedObj = parseHUDComplex(hudText);
              let summaryStr = `[HUD_SUMMARY] `;
              
              if (parsedObj.scene && parsedObj.scene['Дата']) summaryStr += `Дата: ${parsedObj.scene['Дата']}. `;
              if (parsedObj.scene && parsedObj.scene['Время']) summaryStr += `Время: ${parsedObj.scene['Время']}. `;
              if (parsedObj.scene && parsedObj.scene['Погода']) summaryStr += `Погода: ${parsedObj.scene['Погода']}. `;
              
              let cSums = [];
              if (parsedObj.characters) {
                  parsedObj.characters.forEach(c => {
                      if (c['Имя']) {
                          let details = [];
                          if (c['Возраст'] && String(c['Возраст']).toLowerCase() !== 'empty' && String(c['Возраст']).toLowerCase() !== 'none') details.push(`Возраст: ${c['Возраст']}`);
                          if (c['Место'] && String(c['Место']).toLowerCase() !== 'empty' && String(c['Место']).toLowerCase() !== 'none') details.push(`Место: ${c['Место']}`);
                          cSums.push(details.length > 0 ? `${c['Имя']} (${details.join(', ')})` : c['Имя']);
                      }
                  });
              }
              if (parsedObj.user) {
                  let uDetails = [];
                  if (parsedObj.user['Возраст'] && String(parsedObj.user['Возраст']).toLowerCase() !== 'empty' && String(parsedObj.user['Возраст']).toLowerCase() !== 'none') uDetails.push(`Возраст: ${parsedObj.user['Возраст']}`);
                  if (parsedObj.user['Место'] && String(parsedObj.user['Место']).toLowerCase() !== 'empty' && String(parsedObj.user['Место']).toLowerCase() !== 'none') uDetails.push(`Место: ${parsedObj.user['Место']}`);
                  if (uDetails.length > 0) cSums.push(`User (${uDetails.join(', ')})`);
                  else if (Object.keys(parsedObj.user).length > 0) cSums.push(`User`);
              }
              if (cSums.length > 0) summaryStr += cSums.join('; ') + ` `;
              
              return summaryStr + `[/HUD_SUMMARY]`;
          };

          // 1. Формат Chat Completions (учитываем массив messages)
          if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
            let allMatches = [];
            parsedBody.messages.forEach((msg, mIdx) => {
              if (typeof msg.content === 'string') {
                // ВАЖНО: Регулярка объявляется ВНУТРИ цикла, чтобы ее lastIndex сбрасывался для каждого сообщения
                const regexLocal = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
                let match;
                while ((match = regexLocal.exec(msg.content)) !== null) {
                  allMatches.push({ mIdx, index: match.index, length: match[0].length });
                }
              }
            });

            if (allMatches.length > hudsToKeep) {
              let toSummarize = allMatches.slice(0, allMatches.length - hudsToKeep);
              toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));
              
              toSummarize.forEach(rm => {
                let content = parsedBody.messages[rm.mIdx].content;
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                
                parsedBody.messages[rm.mIdx].content = content.slice(0, rm.index) + '\n' + buildSummaryText(hudBlockText) + '\n' + content.slice(rm.index + rm.length);
                modified = true;
              });
            }
          } 
          // 2. Формат Text Completions (учитываем единую строку prompt)
          else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            let allMatches = [];
            const regexLocal = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
            let match;
            while ((match = regexLocal.exec(parsedBody.prompt)) !== null) {
              allMatches.push({ index: match.index, length: match[0].length });
            }
            if (allMatches.length > hudsToKeep) {
              let toSummarize = allMatches.slice(0, allMatches.length - hudsToKeep);
              toSummarize.sort((a, b) => b.index - a.index);
              
              toSummarize.forEach(rm => {
                let content = parsedBody.prompt;
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                
                parsedBody.prompt = content.slice(0, rm.index) + '\n' + buildSummaryText(hudBlockText) + '\n' + content.slice(rm.index + rm.length);
                modified = true;
              });
            }
          }

          // Добавляем HUD-инструкцию, НЕ переписывая существующее assistant/model-сообщение.
          // Это особенно важно для Swipe/Regen: у DeepSeek и некоторых OpenAI-compatible
          // backend последний message может быть assistant/model. Раньше мы дописывали
          // dynamicPrompt прямо туда, из-за чего штатный swipe-запрос превращался в
          // provider-invalid payload. Для assistant/model создаём отдельное user-сообщение.
          let dynamicPrompt = buildDynamicPrompt();
          if (parsedBody.messages && Array.isArray(parsedBody.messages) && parsedBody.messages.length > 0) {
            const lastMsgIndex = parsedBody.messages.length - 1;
            const lastMsg = parsedBody.messages[lastMsgIndex];
            const lastRole = String(lastMsg?.role || '').toLowerCase();
            if (lastRole === 'assistant' || lastRole === 'model') {
              parsedBody.messages.push({ role: lastRole === 'model' ? 'user' : 'user', content: dynamicPrompt });
            } else if (typeof lastMsg.content === 'string') {
              lastMsg.content += dynamicPrompt;
            } else {
              parsedBody.messages.push({ role: 'user', content: dynamicPrompt });
            }
            modified = true;
          } else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            parsedBody.prompt += dynamicPrompt;
            modified = true;
          }
          
          if (modified) {
            options.body = JSON.stringify(parsedBody);
          }

          // Для «Создать HUD» нужен шаблон последнего запроса даже если
          // TavernOS не менял исходный запрос.
          if (hasTextParams) {
            let headersCopy = {};
            if (options.headers) {
              if (typeof options.headers.forEach === 'function') {
                options.headers.forEach((v, k) => { headersCopy[k] = v; });
              } else { headersCopy = JSON.parse(JSON.stringify(options.headers)); }
            }
            window.lastTavernRequest = { url: urlStr, headers: headersCopy, body: JSON.parse(JSON.stringify(parsedBody)) };
            persistLastTavernRequest(window.lastTavernRequest);
          }
        } catch (e) { console.error("HUD API Error", e); }
      }
    }
    return originalFetch.apply(window, arguments);
  };
  } // <--- ВОТ ЭТА СКОБКА СПАСЕТ НАМ ЖИЗНЬ (закрывает if)

 function applyThemeColors() {
    const root = document.documentElement;
    // Цвет текста: пустое значение снимает переопределение, и HUD снова
    // наследует цвет темы SillyTavern.
    if (settings.textColor) root.style.setProperty('--hud-text', settings.textColor);
    else root.style.removeProperty('--hud-text');
    if (settings.textMutedColor) root.style.setProperty('--hud-text-muted', settings.textMutedColor);
    else root.style.removeProperty('--hud-text-muted');

    // Тип стекла живёт классом на <html>, как и тема.
    ['frosted','clear','tinted','liquid','iridescent'].forEach(g => root.classList.remove('hud-glass-' + g));
    root.classList.add('hud-glass-' + (settings.glassType || 'frosted'));

    // Класс темы — источник украшений и цвета текста для светлых тем.
    // Ставим его первым: остальные переменные пишутся инлайново в style
    // элемента <html> и всё равно окажутся сильнее.
    applyThemeClass(settings.themePreset);
    if (settings.accentColor) root.style.setProperty('--hud-accent', settings.accentColor);
    if (settings.glowColor) root.style.setProperty('--hud-purple-glow', hexToRgba(settings.glowColor, settings.glowAlpha !== undefined ? settings.glowAlpha : 40)); 
    
    if (settings.cardBgStart && settings.cardBgEnd) root.style.setProperty('--hud-bg', `linear-gradient(135deg, ${hexToRgba(settings.cardBgStart, settings.cardBgAlpha)}, ${hexToRgba(settings.cardBgEnd, settings.cardBgAlpha)})`);
    if (settings.infoBlockBgStart && settings.infoBlockBgEnd) root.style.setProperty('--hud-card-inner-bg', `linear-gradient(135deg, ${hexToRgba(settings.infoBlockBgStart, settings.infoBlockBgAlpha)}, ${hexToRgba(settings.infoBlockBgEnd, settings.infoBlockBgAlpha)})`);
    if (settings.topBarBg) root.style.setProperty('--hud-header-bg', hexToRgba(settings.topBarBg, settings.topBarAlpha));
    if (settings.tabsBg) root.style.setProperty('--hud-tab-bg', hexToRgba(settings.tabsBg, settings.tabsAlpha));

    // ТЕЛЕФОН. Панель настроек существовала, значения сохранялись — но их
    // никто не применял, поэтому ни одна телефонная настройка не работала.
    // Пишем в *-user переменные: сами --hud-phone-* объявлены на эмуляторе и
    // подхватывают их как переопределение (см. style.css).
    if (settings.phoneBgStart && settings.phoneBgEnd) root.style.setProperty('--hud-phone-bg-user',
      `linear-gradient(160deg, ${hexToRgba(settings.phoneBgStart, settings.phoneBgAlpha)}, ${hexToRgba(settings.phoneBgEnd, settings.phoneBgAlpha)})`);
    if (settings.phoneAccent) root.style.setProperty('--hud-phone-accent-user', settings.phoneAccent);
    if (settings.phoneBlur !== undefined) root.style.setProperty('--hud-phone-blur-user', settings.phoneBlur + 'px');
    if (settings.phoneBubbleRadius !== undefined) root.style.setProperty('--hud-phone-radius-user', settings.phoneBubbleRadius + 'px');
    if (settings.phoneFont) root.style.setProperty('--hud-phone-font-user', settings.phoneFont);
    if (settings.phoneFontSize !== undefined) root.style.setProperty('--hud-phone-font-size-user', settings.phoneFontSize + 'px');
    if (settings.phoneNotifAlpha !== undefined) root.style.setProperty('--hud-phone-notif-alpha-user', (settings.phoneNotifAlpha / 100).toFixed(2));
    if (settings.phoneIconRadius !== undefined) root.style.setProperty('--hud-phone-icon-radius-user', settings.phoneIconRadius + 'px');
    if (settings.phoneFrameColor) root.style.setProperty('--hud-phone-frame-user', settings.phoneFrameColor);
    if (settings.phoneScreenGlow !== undefined) root.style.setProperty('--hud-phone-screen-glow-user', (settings.phoneScreenGlow / 100).toFixed(2));
    
    if (settings.sceneOverlayColor) root.style.setProperty('--hud-scene-overlay', hexToRgba(settings.sceneOverlayColor, settings.sceneOverlayAlpha));
    if (settings.sceneTextColor) root.style.setProperty('--hud-scene-text', settings.sceneTextColor);
    
    // Новые настройки погоды
    if (settings.weatherBgColor) root.style.setProperty('--hud-weather-bg', hexToRgba(settings.weatherBgColor, settings.weatherBgAlpha !== undefined ? settings.weatherBgAlpha : 40));
    if (settings.weatherBlur !== undefined) root.style.setProperty('--hud-weather-blur', settings.weatherBlur + 'px');
    // Множитель для всех слоёв ночного затемнения сцены.
    if (settings.sceneDarkness !== undefined) {
      root.style.setProperty('--scene-dark-k', (Number(settings.sceneDarkness) / 100).toFixed(2));
    }

    if (settings.nsfwColor) {
        root.style.setProperty('--hud-nsfw-border', settings.nsfwColor);
        root.style.setProperty('--hud-nsfw-bg', hexToRgba(settings.nsfwColor, settings.nsfwBgAlpha !== undefined ? settings.nsfwBgAlpha : 20));
    }
    if (settings.dramaColor) {
        root.style.setProperty('--hud-drama-border', settings.dramaColor);
        root.style.setProperty('--hud-drama-bg', hexToRgba(settings.dramaColor, settings.dramaBgAlpha !== undefined ? settings.dramaBgAlpha : 15));
    }
    if (settings.interceptColor) {
        root.style.setProperty('--hud-intercept-color', settings.interceptColor);
        root.style.setProperty('--hud-intercept-bg', hexToRgba(settings.interceptColor, settings.interceptBgAlpha !== undefined ? settings.interceptBgAlpha : 15));
    }
    if (settings.memoryBgStart && settings.memoryBgEnd) root.style.setProperty('--hud-memory-bg', `linear-gradient(135deg, ${hexToRgba(settings.memoryBgStart, settings.memoryBgAlpha)}, ${hexToRgba(settings.memoryBgEnd, settings.memoryBgAlpha)})`);
    if (settings.memoryAccent) root.style.setProperty('--hud-memory-accent', settings.memoryAccent);
    if (settings.memoryGlowAlpha !== undefined) root.style.setProperty('--hud-memory-glow', hexToRgba(settings.memoryAccent || '#8c5ad2', settings.memoryGlowAlpha));
    if (settings.memoryBlur !== undefined) root.style.setProperty('--hud-memory-blur', settings.memoryBlur + 'px');
    if (settings.memoryMaxHeight !== undefined) root.style.setProperty('--hud-memory-max-height', Math.max(200, Number(settings.memoryMaxHeight) || 300) + 'px');
    if (settings.msgInBg) root.style.setProperty('--hud-msg-in', hexToRgba(settings.msgInBg, settings.msgInAlpha !== undefined ? settings.msgInAlpha : 15));
    if (settings.msgOutStart && settings.msgOutEnd) {
        root.style.setProperty('--hud-msg-out-start', settings.msgOutStart);
        root.style.setProperty('--hud-msg-out-end', hexToRgba(settings.msgOutEnd, settings.msgOutAlpha !== undefined ? settings.msgOutAlpha : 80));
    }

    // --- ТЕЛЕФОН ---------------------------------------------------------
    // При phoneThemeAuto телефон берёт цвета и шрифт у HUD, поэтому выглядит
    // частью общей темы. Как только пользователь трогает любую телефонную
    // настройку, флаг снимается (см. обработчик в events.js) и дальше
    // используются его собственные значения — правку не затирает.
    const pAuto = settings.phoneThemeAuto !== false;
    const pBgStart = pAuto ? (settings.cardBgStart || '#0a0a0f') : (settings.phoneBgStart || '#0a0a0f');
    const pBgEnd   = pAuto ? (settings.cardBgEnd   || '#12121a') : (settings.phoneBgEnd   || '#12121a');
    const pBgAlpha = pAuto ? 92 : (settings.phoneBgAlpha !== undefined ? settings.phoneBgAlpha : 92);
    const pAccent  = pAuto ? (settings.accentColor || '#de859f') : (settings.phoneAccent || '#de859f');
    const pBlur    = pAuto ? (settings.backdropBlur !== undefined ? Number(settings.backdropBlur) + 6 : 14)
                           : (settings.phoneBlur !== undefined ? settings.phoneBlur : 14);
    const pFont    = pAuto ? (settings.fontMain || 'inherit') : (settings.phoneFont || 'inherit');
    const pFontSz  = pAuto ? (settings.fontSizeMain !== undefined ? Number(settings.fontSizeMain) - 1 : 13)
                           : (settings.phoneFontSize !== undefined ? settings.phoneFontSize : 13);

    root.style.setProperty('--hud-phone-bg', `linear-gradient(160deg, ${hexToRgba(pBgStart, pBgAlpha)}, ${hexToRgba(pBgEnd, pBgAlpha)})`);
    root.style.setProperty('--hud-phone-accent', pAccent);
    root.style.setProperty('--hud-phone-blur', pBlur + 'px');
    root.style.setProperty('--hud-phone-font', pFont);
    root.style.setProperty('--hud-phone-font-size', pFontSz + 'px');
    root.style.setProperty('--hud-phone-radius', (settings.phoneBubbleRadius !== undefined ? settings.phoneBubbleRadius : 15) + 'px');
    root.style.setProperty('--hud-phone-notif-alpha', String((settings.phoneNotifAlpha !== undefined ? settings.phoneNotifAlpha : 94) / 100));
    if (settings.badgeColor) root.style.setProperty('--hud-badge-bg', settings.badgeColor);
    if (settings.clockColor) root.style.setProperty('--hud-clock-color', settings.clockColor);
    
    if (settings.fontSizeMain) root.style.setProperty('--hud-font-size-main', settings.fontSizeMain + 'px');
    if (settings.fontSizeHeaders) root.style.setProperty('--hud-font-size-headers', settings.fontSizeHeaders + 'px');
    if (settings.fontSizeClock) root.style.setProperty('--hud-font-size-clock', settings.fontSizeClock + 'px');
    if (settings.fontSizeDiary !== undefined) root.style.setProperty('--hud-font-size-diary', settings.fontSizeDiary + 'px'); // Размер дневника
    
    if (settings.fontMain) root.style.setProperty('--hud-font-main', settings.fontMain);
    if (settings.fontHeaders) root.style.setProperty('--hud-font-headers', settings.fontHeaders);
    if (settings.fontClock) root.style.setProperty('--hud-font-clock', settings.fontClock);
    if (settings.fontDiary) root.style.setProperty('--hud-font-diary', settings.fontDiary);

    if (settings.backdropBlur !== undefined) root.style.setProperty('--hud-blur-intensity', settings.backdropBlur + 'px');
    if (settings.bgImage && settings.bgImage.trim() !== '') {
        root.style.setProperty('--hud-custom-bg', `url("${settings.bgImage.trim()}")`);
    } else {
        root.style.setProperty('--hud-custom-bg', 'none');
    }
    if (settings.bgScale !== undefined) root.style.setProperty('--hud-bg-scale', settings.bgScale + '%');
    if (settings.bgOffsetY !== undefined) root.style.setProperty('--hud-bg-y', settings.bgOffsetY + '%');
    if (settings.bgOpacity !== undefined) root.style.setProperty('--hud-bg-opacity', settings.bgOpacity / 100);
  }

  function loadSettings() { 
    const saved = localStorage.getItem('hud_settings'); 
    if (saved) { try { Object.assign(settings, JSON.parse(saved)); } catch (e) {} } 
    applyThemeColors(); 
  }
  // Версию берём из ?v= собственного скрипта: раньше она была вписана в
  // заголовок настроек руками и отставала на десяток выпусков.
  function hudVersionLabel() {
    try {
      const tag = document.querySelector('script[src*="HUD/index.js"]');
      const m = tag && tag.src.match(/[?&]v=([\d.]+)/);
      if (m) return m[1];
    } catch (e) {}
    return '22+';
  }

  function saveSettings() {
    try {
      localStorage.setItem('hud_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('HUD: не удалось сохранить настройки', e);
      showHudToast('error', 'Настройки не сохранены', 'localStorage недоступен (приватный режим / нет места): ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD EXTERNAL CONTEXT: selected Lorebooks + character card + Persona.
  // Used ONLY by the explicit HUD create/regenerate path. The normal network
  // injection/buildDynamicPrompt path is intentionally untouched.
  // ---------------------------------------------------------------------------
  function getStContextSafe() {
    try {
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') return window.SillyTavern.getContext();
      if (typeof getContext === 'function') return getContext();
      if (typeof window.getContext === 'function') return window.getContext();
    } catch (_) {}
    return null;
  }

  function getMainProtagonistNames(stContext = null) {
    let ctx = stContext;
    if (!ctx) { try { ctx = getStContextSafe(); } catch (_) {} }
    const userName = String(ctx?.name1 || window.name1 || ctx?.userName || '').trim();
    const charName = String(ctx?.name2 || window.name2 || ctx?.charName || '').trim();
    return {
      user: userName && !/^\{\{user\}\}$/i.test(userName) ? userName : 'Player',
      char: charName && !/^\{\{char\}\}$/i.test(charName) ? charName : 'Character'
    };
  }

  function getStRequestHeadersSafe() {
    try {
      const stContext = getStContextSafe();
      if (stContext && typeof stContext.getRequestHeaders === 'function') {
        const headers = stContext.getRequestHeaders();
        if (headers && typeof headers === 'object') return headers;
      }
    } catch (_) {}
    try { if (typeof getRequestHeaders === 'function') return getRequestHeaders(); } catch (_) {}
    return { 'Content-Type': 'application/json' };
  }

  async function getAvailableHudLorebooks() {
    try {
      const stContext = getStContextSafe();
      if (stContext && typeof stContext.getWorldInfoNames === 'function') {
        const names = await stContext.getWorldInfoNames();
        if (Array.isArray(names)) return names.filter(Boolean);
      }
    } catch (e) { console.debug('[TavernOS HUD] getWorldInfoNames() недоступен:', e); }
    try { if (Array.isArray(window.world_names)) return window.world_names.filter(Boolean); } catch (_) {}
    for (const url of ['/api/worldinfo/list', '/api/settings/get', '/getsettings']) {
      try {
        const response = await fetch(url, { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({}), cache:'no-cache' });
        if (!response.ok) continue;
        const data = await response.json();
        const names = Array.isArray(data.world_names) ? data.world_names
          : Array.isArray(data.worlds) ? data.worlds
          : Array.isArray(data) ? data : [];
        if (Array.isArray(names)) return names.map(x => typeof x === 'string' ? x : (x?.name || x?.filename)).filter(Boolean);
      } catch (_) {}
    }
    console.warn('[TavernOS HUD] Не удалось получить список Lorebooks.');
    return [];
  }

  async function loadHudLorebook(name) {
    if (!name) return null;
    try {
      const response = await fetch('/api/worldinfo/get', { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({name}), cache:'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      try {
        const legacy = await fetch('/getworldinfo', { method:'POST', headers:getStRequestHeadersSafe(), body:JSON.stringify({name}), cache:'no-cache' });
        if (legacy.ok) return await legacy.json();
      } catch (_) {}
      console.warn(`[TavernOS HUD] Не удалось загрузить Lorebook "${name}":`, e);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // HUD Lorebook activation: mirror SillyTavern World Info's key mechanics for
  // the explicitly selected books. Constant entries are always included;
  // keyed entries are activated against the same conversation context.
  // ---------------------------------------------------------------------------
  function substituteHudLoreMacros(value, stContext) {
    const text = String(value ?? '');
    const protagonistNames = getMainProtagonistNames(stContext);
    const userName = protagonistNames.user;
    const charName = protagonistNames.char;
    return text
      .replace(/\{\{\s*user\s*\}\}/gi, userName)
      .replace(/\{\{\s*char\s*\}\}/gi, charName);
  }

  function hudLoreKeyMatches(text, key, entry, stContext) {
    const substituted = substituteHudLoreMacros(key, stContext).trim();
    if (!substituted) return false;

    const caseSensitive = entry?.extensions?.case_sensitive ?? entry?.caseSensitive;
    const wholeWords = entry?.extensions?.match_whole_words ?? entry?.matchWholeWords;
    const flags = caseSensitive ? 'g' : 'gi';

    // ST treats WI keys as regular expressions. Keep that behavior, with a
    // safe fallback to literal matching if a malformed regex is encountered.
    try {
      let pattern = substituted;
      if (wholeWords) pattern = `(?<!\\w)(?:${pattern})(?!\\w)`;
      return new RegExp(pattern, flags).test(text);
    } catch (_) {
      const hay = caseSensitive ? text : text.toLowerCase();
      const needle = caseSensitive ? substituted : substituted.toLowerCase();
      return wholeWords
        ? new RegExp(`(?<!\\w)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, caseSensitive ? '' : 'i').test(text)
        : hay.includes(needle);
    }
  }

  function hudLoreEntryActivates(entry, scanText, stContext) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.disable === true || entry.disabled === true || entry.enabled === false) return false;

    const isConstant = entry.constant === true || entry.alwaysActive === true;
    if (isConstant) return true;

    const primary = Array.isArray(entry.key) ? entry.key.filter(Boolean) :
      Array.isArray(entry.keys) ? entry.keys.filter(Boolean) :
      typeof entry.key === 'string' ? entry.key.split(',').map(x => x.trim()).filter(Boolean) :
      typeof entry.keys === 'string' ? entry.keys.split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!primary.length) return false;

    const primaryMatch = primary.some(key => hudLoreKeyMatches(scanText, key, entry, stContext));
    if (!primaryMatch) return false;

    const secondary = Array.isArray(entry.keysecondary) ? entry.keysecondary.filter(Boolean) :
      Array.isArray(entry.secondary_keys) ? entry.secondary_keys.filter(Boolean) :
      typeof entry.keysecondary === 'string' ? entry.keysecondary.split(',').map(x => x.trim()).filter(Boolean) :
      typeof entry.secondary_keys === 'string' ? entry.secondary_keys.split(',').map(x => x.trim()).filter(Boolean) : [];

    let logicActivated = true;
    // Modern ST entries are selective by default. If there are no secondary
    // keys, a primary-key hit is sufficient.
    if (secondary.length && (entry.selective !== false)) {
      const matches = secondary.map(key => hudLoreKeyMatches(scanText, key, entry, stContext));
      const any = matches.some(Boolean);
      const all = matches.every(Boolean);
      const logic = Number(entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? 0);
      // ST world_info_logic: AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3.
      if (logic === 1) logicActivated = !all;
      else if (logic === 2) logicActivated = !any;
      else if (logic === 3) logicActivated = all;
      else logicActivated = any;
    }
    if (!logicActivated) return false;

    // Respect the same probability gate used by World Info entries.
    const useProbability = entry.useProbability ?? entry.extensions?.useProbability ?? true;
    const probability = Number(entry.probability ?? entry.extensions?.probability ?? 100);
    if (useProbability && Number.isFinite(probability) && probability < 100) {
      if (Math.random() * 100 >= Math.max(0, probability)) return false;
    }
    return true;
  }

  function normalizeHudLoreEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (entry.disable === true || entry.disabled === true || entry.enabled === false) return null;
    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    return content || null;
  }

  async function buildHudLoreContext(scanText = '') {
    const selected = Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks.filter(Boolean) : [];
    const stContext = getStContextSafe();
    const sections = [];
    try {
      const characterId = stContext?.characterId;
      const character = characterId !== undefined && characterId !== null && characterId >= 0 ? stContext?.characters?.[characterId] : null;
      const charData = character?.data || character || {};
      const charName = character?.name || charData?.name || window.name2 || '{{char}}';
      const description = charData?.description || character?.description || '';
      const personality = charData?.personality || character?.personality || '';
      const scenario = charData?.scenario || character?.scenario || '';
      if (String(description).trim() || String(personality).trim() || String(scenario).trim()) {
        sections.push(`CHARACTER CARD — ${charName}\nDescription:\n${String(description).trim()}${String(personality).trim() ? `\nPersonality:\n${String(personality).trim()}` : ''}${String(scenario).trim() ? `\nScenario:\n${String(scenario).trim()}` : ''}`);
      }
    } catch (e) { console.debug('[TavernOS HUD] Не удалось прочитать карточку персонажа:', e); }
    try {
      let personaDescription = '';
      if (typeof window.power_user !== 'undefined') personaDescription = window.power_user?.persona_description || '';
      if (!personaDescription) personaDescription = document.querySelector('#persona_description')?.value || '';
      if (!personaDescription && stContext?.persona?.description) personaDescription = stContext.persona.description;
      if (String(personaDescription).trim()) sections.push(`USER PERSONA — ${window.name1 || '{{user}}'}\n${String(personaDescription).trim()}`);
    } catch (e) { console.debug('[TavernOS HUD] Не удалось прочитать Persona:', e); }

    const effectiveScanText = [String(scanText || ''), ...sections].filter(Boolean).join('\n\n');
    for (const name of selected) {
      const data = await loadHudLorebook(name);
      const entries = data && Array.isArray(data.entries) ? data.entries
        : (data && data.entries && typeof data.entries === 'object' ? Object.values(data.entries) : []);
      const activated = entries
        .filter(entry => hudLoreEntryActivates(entry, effectiveScanText, stContext))
        .map(normalizeHudLoreEntry)
        .filter(Boolean);
      if (activated.length) {
        sections.push(`LOREBOOK — ${name}\n${activated.map((x, i) => `Entry ${i + 1}:\n${x}`).join('\n\n')}`);
      }
    }
    if (!sections.length) return '';
    return `\n\n<HUD_EXTERNAL_CONTEXT>\nThe following material is reference context for generating/updating the HUD. Use it to keep names, facts, relationships, locations, and world details consistent. Do not reproduce this section outside the HUD JSON.\n\n${sections.join('\n\n====================\n\n')}\n</HUD_EXTERNAL_CONTEXT>`;
  }

  // window.lastTavernRequest живёт только в памяти вкладки и теряется при перезагрузке страницы
  // или выгрузке вкладки из памяти (частая ситуация на телефоне). Дублируем последний запрос
  // в sessionStorage, чтобы 🔄/➕ работали сразу после открытия чата, до первой обычной генерации.
  const LAST_REQUEST_CACHE_KEY = 'hud_last_tavern_request';
  function persistLastTavernRequest(reqData) {
    try { sessionStorage.setItem(LAST_REQUEST_CACHE_KEY, JSON.stringify(reqData)); } catch (e) {}
  }
  function restoreLastTavernRequest() {
    if (window.lastTavernRequest) return;
    try {
      const cached = sessionStorage.getItem(LAST_REQUEST_CACHE_KEY);
      if (cached) window.lastTavernRequest = JSON.parse(cached);
    } catch (e) {}
  }

  function showHudToast(type, title, message) {
    let container = document.getElementById('hud-toast-container');
    if (!container) {
      container = document.createElement('div'); container.id = 'hud-toast-container'; container.className = 'hud-toast-container'; document.body.appendChild(container);
    }
    const toast = document.createElement('div'); toast.className = `hud-toast ${type}`;
    let iconSvg = type === 'loading' ? `<svg class="hud-toast-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>` : (type === 'success' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`);
    toast.innerHTML = `<div class="hud-toast-icon">${iconSvg}</div><div class="hud-toast-content"><div class="hud-toast-title">${title}</div><div class="hud-toast-msg">${message}</div></div>`;
    container.appendChild(toast);
    if (type !== 'loading') { setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 400); }, 4000); }
    return toast;
  }


  // Вспомогательная функция для генерации опций шрифтов (все поддерживают кириллицу)
  function makeFontOptions(selectedVal) {
    const groups = {
      "Базовые (System)": [
        {v:"inherit", n:"Тема Tavern"}, {v:"system-ui, sans-serif", n:"Системный (Apple/UI)"}, {v:"'Times New Roman', serif", n:"Times New Roman"}, {v:"'Courier New', monospace", n:"Courier New"}, {v:"Arial, sans-serif", n:"Arial"}
      ],
      "Современные & UI (Clean)": [
        {v:"'Roboto', sans-serif", n:"Roboto"}, {v:"'Montserrat', sans-serif", n:"Montserrat"}, {v:"'Open Sans', sans-serif", n:"Open Sans"}, {v:"'Nunito', sans-serif", n:"Nunito"}, {v:"'Comfortaa', cursive", n:"Comfortaa"}, {v:"'Oswald', sans-serif", n:"Oswald"}
      ],
      "Киберпанк & Sci-Fi": [
        {v:"'Jura', sans-serif", n:"Jura (Технический)"}, {v:"'Unbounded', sans-serif", n:"Unbounded (Неоновый)"}, {v:"'Russo One', sans-serif", n:"Russo One (Тяжелый)"}, {v:"'Exo 2', sans-serif", n:"Exo 2 (Космос)"}, {v:"'Rubik Mono One', sans-serif", n:"Rubik Mono (Блок)"}, {v:"'Press Start 2P', cursive", n:"Press Start 2P (Пиксель)"}
      ],
      "Фэнтези & Готика": [
        {v:"'Playfair Display', serif", n:"Playfair (Элегантный)"}, {v:"'Cormorant Garamond', serif", n:"Cormorant (Древний)"}, {v:"'Philosopher', sans-serif", n:"Philosopher (Эльфийский)"}, {v:"'Alice', serif", n:"Alice (Винтаж)"}, {v:"'Lora', serif", n:"Lora (Магический)"}, {v:"'Kurale', serif", n:"Kurale (Сказка)"}, {v:"'Eczar', serif", n:"Eczar (Алхимия)"}, {v:"'Kelly Slab', cursive", n:"Kelly Slab (Дизельпанк)"}
      ],
      "Рукописные & Дневник": [
        {v:"'Caveat', cursive", n:"Caveat (Быстрый)"}, {v:"'Pacifico', cursive", n:"Pacifico (Маркер)"}, {v:"'Marck Script', cursive", n:"Marck Script (Каллиграфия)"}, {v:"'Bad Script', cursive", n:"Bad Script (Почерк)"}, {v:"'Neucha', cursive", n:"Neucha (Карандаш)"}, {v:"'Pangolin', cursive", n:"Pangolin (Мягкий)"}, {v:"'Amatic SC', cursive", n:"Amatic SC (Тонкий)"}
      ]
    };
    let html = '';
    for (const [group, fonts] of Object.entries(groups)) {
      html += `<optgroup label="${group}">`;
      for (const f of fonts) {
        html += `<option value="${f.v}" ${selectedVal === f.v ? 'selected' : ''}>${f.n}</option>`;
      }
      html += `</optgroup>`;
    }
    return html;
  }

  function renderHUD(data) {
    if (!data || Object.keys(data).length === 0) return '';
    const hasMemory = Boolean(data.memory && (
      (Array.isArray(data.memory.timeline) && data.memory.timeline.length) ||
      (Array.isArray(data.memory.important) && data.memory.important.length) ||
      (Array.isArray(data.memory.secrets) && data.memory.secrets.length) ||
      (data.memory.mood && ((data.memory.mood.user?.current || data.memory.mood.user?.history?.length) || (data.memory.mood.char?.current || data.memory.mood.char?.history?.length))) ||
      (data.memory.route && ((data.memory.route.user?.length || 0) + (data.memory.route.char?.length || 0) > 0))
    )) || hudHasRelations(data);
    // Телефон показывается, если есть переписки ИЛИ любое содержимое ОС
    // (контакты, галерея, заметки, карты, история поиска).
    const phoneOsFilled = Boolean(data.phone && ['contacts','gallery','notes','maps','search']
      .some(k => Array.isArray(data.phone[k]) && data.phone[k].length > 0));
    const hasPhone = Boolean(settings.enablePhone && ((data.chatsMap && Object.keys(data.chatsMap).length > 0) || phoneOsFilled));
    if (data.characters.length === 0 && (!data.intercepts || data.intercepts.length === 0) && data.diary.length === 0 && data.dreams.length === 0 && Object.values(data.world || {}).every(v => !v || !v.length) && Object.keys(data.scene).length === 0 && Object.keys(data.user || {}).length === 0 && !hasMemory && !hasPhone) return '';

    const baseId = Date.now() + '-' + Math.random().toString(36).slice(2);
    let osSubtitleHtml = '', mainCharName = '';
    if (data.characters.length > 0) mainCharName = data.characters[0]['Имя'] || '';

    let tRaw = data.scene['Время'] || '', wRaw = data.scene['Погода'] || '', dRaw = data.scene['Дата'] || '';
    let phaseClass = 'phase-night'; 
    let phaseLow = (tRaw || '').toLowerCase();
    
    let hourMatch = tRaw.match(/(\d{1,2}):\d{2}/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1], 10);
      const minute = parseInt(hourMatch[2], 10) || 0;
      const totalMinutes = hour * 60 + minute;

      if (totalMinutes < 120) phaseClass = 'phase-deep-night';
      else if (totalMinutes < 300) phaseClass = 'phase-night';
      else if (totalMinutes < 360) phaseClass = 'phase-predawn';
      else if (totalMinutes < 600) phaseClass = 'phase-morning';
      else if (totalMinutes < 1020) phaseClass = 'phase-day';
      else if (totalMinutes < 1110) phaseClass = 'phase-golden';
      else if (totalMinutes < 1200) phaseClass = 'phase-sunset';
      else if (totalMinutes < 1320) phaseClass = 'phase-evening';
      else phaseClass = 'phase-night';
    } else if (/\bпредрассвет|\bpredawn|\bdawn\b/.test(phaseLow)) phaseClass = 'phase-predawn';
    else if (/\bутр\w*|\bmorn\w*/.test(phaseLow)) phaseClass = 'phase-morning';
    else if (/\bдень\b|\bдн[ёе]м\b|\bday\b/.test(phaseLow)) phaseClass = 'phase-day';
    else if (/\bзолот\w*|\bgolden\b/.test(phaseLow)) phaseClass = 'phase-golden';
    else if (/\bзакат|\bsunset|\bсолнц\w*\s*за/.test(phaseLow)) phaseClass = 'phase-sunset';
    else if (/\bвечер\w*|\beven\w*|\bnightfall\b/.test(phaseLow)) phaseClass = 'phase-evening';
    else if (/\bглубок\w*\s*ноч\w*|\bdeep\s*night\b/.test(phaseLow)) phaseClass = 'phase-deep-night';
    else if (/\bноч\w*|\bnight\b/.test(phaseLow)) phaseClass = 'phase-night';

    let wClass = 'weather-clear', wLow = wRaw.toLowerCase(), wIntensity = '';
    // СИЛА явления — отдельная ось, общая для всей погоды: «сильный»
    // одинаково повышает и снегопад, и дождь, и ветер. Какое именно
    // явление идёт, решают списки ниже; сила только сдвигает уровень
    // внутри него. Раньше усилители были вписаны прямо в списки явлений,
    // и «сильная метель» подменялась метелью вместо того, чтобы стать
    // на ступень выше.
    const wStrong = /сильн|мощн|свиреп|яростн|беш|лют|дик|жутк|страшн|густ|плотн|валит|стеной|обильн|интенсивн|непрогляд|heavy|strong|intense|fierce/;
    const wWeak   = /слаб|лёгк|легк|небольш|редк|порош|мелк|изредка|чуть|перв|light|flurr/;

    // Описание погоды — перечисление: «Сильный снегопад, −7°C, лёгкий ветер».
    // Модификатор относится к СВОЕЙ части, а не ко всей строке. Пока мы
    // искали усилители по всей фразе, «лёгкий ветер» делал лёгким снегопад,
    // а «сильный ветер» — усиливал его. Поэтому режем на части и каждую
    // смотрим отдельно.
    const wParts = wLow.split(/[,;.|]+|\s+[—–-]\s+/).map(s => s.trim()).filter(Boolean);
    const partsWith = re => wParts.filter(p => re.test(p));
    const anyOf = (parts, re) => parts.some(p => re.test(p));

    // ВЕТЕР — ещё одна независимая ось. Он не меняет само явление (снегопад
    // остаётся снегопадом), но подгоняет снег: тот же наклон и та же
    // плотность, только быстрее. Слабый ветер не подгоняет ничего, поэтому
    // «лёгкий ветер», «ветер утих», штиль и прямо указанная скорость до
    // 3 м/с сюда не попадают.
    const windRe   = /ветер|ветр|шквал|порыв|сквозняк|дует|wind|gust|squall|breeze/;
    const windCalm = /слаб|лёгк|легк|тих|утих|стих|ул[её]гся|безветр|штил|едва|слегка|чуть|light|calm/;
    const windHard = /сильн|шквал|штормов|порыв|ураган|бешен|рв[ёе]т|завыва|воет|гуд|strong|gust|squall|gale/;
    const windParts = partsWith(windRe);
    let windSpeed = null;
    for (const part of windParts) {
      const m = part.match(/(\d+(?:[.,]\d+)?)\s*м\/?\s*с|(\d+(?:[.,]\d+)?)\s*m\/s/);
      if (m) { windSpeed = parseFloat((m[1] || m[2]).replace(',', '.')); break; }
    }
    let windClass = '';
    if (windParts.length && !anyOf(windParts, windCalm) && !(windSpeed !== null && windSpeed <= 3)) {
      windClass = (anyOf(windParts, windHard) || (windSpeed !== null && windSpeed >= 10))
        ? 'weather-windy-strong' : 'weather-windy';
    }
    
    if (wLow.match(/гроз|молни|шторм|thunder|storm/)) {
      wClass = 'weather-storm';
    } else if (wLow.match(/град|hail/)) {
      wClass = 'weather-hail';
    } else if (wLow.match(/снег|снеж|snow|метел|вьюг|blizzard|буран|пург|мет[её]т|позёмк|поземк|порош|flurr/)) {
      wClass = 'weather-snow';
      // «Метель» и «снежная буря» — разные по ощущению вещи, не синонимы:
      // метель — это ветер несёт снег, буря/буран — уже совсем плохая
      // видимость. Раньше оба слова ловились одним и тем же «бур», и
      // выглядели визуально одинаково.
      // Здесь две независимые вещи, и раньше они были свалены в одну.
      // ЯВЛЕНИЕ — что происходит: снегопад (снег валит сверху вниз) или
      // метель/буря (снег несёт ветром). СИЛА — насколько густо.
      // Слово «сильный» задаёт силу, а не явление, но стояло в одном ряду
      // с «метелью», из-за чего «сильный снегопад» и «сильная метель»
      // получали один и тот же класс и выглядели одинаково.
      // Теперь ветровые явления проверяются первыми и «сильн» их не
      // трогает, а густой снегопад получил собственный уровень: крупные
      // хлопья валят почти отвесно, без ветровой позёмки.
      // Силу снегопада берём только из тех частей, где вообще говорится о
      // снеге: иначе «лёгкий ветер» из соседней части опускает снегопад
      // до слабого.
      const snowRe = /снег|снеж|метел|вьюг|буран|пург|позёмк|поземк|порош|snow|blizzard|flurr/;
      const snowParts = partsWith(snowRe);
      const sp = snowParts.length ? snowParts : wParts;
      const snowStrong = anyOf(sp, wStrong), snowWeak = anyOf(sp, wWeak);
      if (wLow.match(/буря|буран|пург|snowstorm|whiteout|белая мгла/)) {
        wIntensity = 'weather-intensity-extreme';
      } else if (wLow.match(/метел|вьюг|мет[её]т|позёмк|поземк|заряд|blizzard/)) {
        // Ветровой снег. Усилитель поднимает метель на одну ступень — до
        // сильной метели, но НЕ до бури: буря это отдельное явление со
        // своей подписью (горизонтальные штрихи и белая мгла), и если
        // отдавать её сильной метели, обе снова выглядят одинаково.
        wIntensity = snowStrong ? 'weather-intensity-gale' : 'weather-intensity-high';
      } else if (snowWeak) {
        wIntensity = 'weather-intensity-low';
      } else if (snowStrong) {
        // Снег валит сверху вниз, ветра нет — густой снегопад, не метель.
        wIntensity = 'weather-intensity-heavy';
      }
    } else if (wLow.match(/дожд|лив|rain|морос|drizzle/)) {
      wClass = 'weather-rain';
      if (wLow.match(/лив|проливн/) || wStrong.test(wLow)) wIntensity = 'weather-intensity-high';
      else if (wLow.match(/морос|drizzle/) || wWeak.test(wLow)) wIntensity = 'weather-intensity-low';
    } else if (wLow.match(/облач|пасмур|cloud|overcast/)) {
      wClass = 'weather-cloudy';
    } else if (wLow.match(/ветер|ветр|шквал|wind|squall|ураган|бур/)) {
      wClass = 'weather-wind';
      // «Шквалистый» и «шквал» раньше не ловились ни здесь, ни в силе:
      // фраза попадала в ветер только из-за слова «ветер» и оставалась
      // обычной, поэтому шквалистый ветер выглядел как штиль.
      if (wLow.match(/штормов|шквал|порыв|ураган|бур|gust|squall/) || wStrong.test(wLow)) wIntensity = 'weather-intensity-high';
    } else if (wLow.match(/туман|fog|дымк/)) {
      wClass = 'weather-fog';
    } else if (wLow.match(/ясн|солнеч|clear|sunny/)) {
      wClass = 'weather-clear';
    }

    let tempClass = '', freezeClass = '', tempMatch = wRaw.match(/([-+\u2212]?\d+)/);
    if (tempMatch) {
      let tempStr = tempMatch[1].replace('\u2212', '-');
      let tempVal = parseInt(tempStr, 10);
      if (tempVal <= 0) tempClass = 'temp-cold';
      if (tempVal <= -10) freezeClass = 'temp-freezing'; 
      if (tempVal >= 20) tempClass = 'temp-hot temp-drops'; 
    }

    let seasonClass = '';
    let dLow = (dRaw + ' ' + wRaw + ' ' + tRaw).toLowerCase(); 
    if (dLow.match(/зим|декабр|январ|феврал|dec|jan|feb|\.12\.|\.01\.|\.02\.|снег|снеж|метел|вьюг|мороз|буран/)) seasonClass = 'season-winter';
    else if (dLow.match(/весн|март|апрел|май|mar|apr|may|\.03\.|\.04\.|\.05\./)) seasonClass = 'season-spring';
    else if (dLow.match(/лет|июн|июл|август|jun|jul|aug|\.06\.|\.07\.|\.08\./)) seasonClass = 'season-summer';
    else if (dLow.match(/осен|сентябр|октябр|ноябр|sep|oct|nov|\.09\.|\.10\.|\.11\./)) seasonClass = 'season-autumn';

    let dustyClass = (tempClass === 'temp-hot' && seasonClass === 'season-summer' && (wClass === 'weather-clear' || wClass === 'weather-wind')) ? 'weather-dusty' : '';
    const prevWeather = previousMessageWeather();
    let rainbowClass = (wClass === 'weather-clear' && (prevWeather === 'weather-rain' || prevWeather === 'weather-storm')) ? 'weather-rainbow' : '';
    // Мокрая земля: дождь идёт сейчас либо шёл в прошлом сообщении. Лужа
    // держится ровно один ход и высыхает — отсюда и «после дождя».
    const isWet = (w) => w === 'weather-rain' || w === 'weather-storm';
    const wetClass = (isWet(wClass) || isWet(prevWeather)) ? 'scene-wet' : '';
    if (wRaw) {
      lastSceneWeather = wClass;
      if (renderTargetMes) renderTargetMes.dataset.hudWeather = wClass;
    }

    let dewActive = phaseClass === 'phase-morning' && (wClass === 'weather-clear' || wClass === 'weather-cloudy') && (seasonClass === 'season-spring' || seasonClass === 'season-summer');

    let celestialStyle = '', sunVarsStyle = '', sceneStyle = '';
    if (hourMatch) {
      let hh = parseInt(hourMatch[1], 10), mmMatch = tRaw.match(/\d{1,2}:(\d{2})/), mm = mmMatch ? parseInt(mmMatch[1], 10) : 0, minutesOfDay = hh * 60 + mm;
      const DAY_START = 6 * 60, DAY_END = 20 * 60; let p, cx, cy;
      if (minutesOfDay >= DAY_START && minutesOfDay <= DAY_END) p = (minutesOfDay - DAY_START) / (DAY_END - DAY_START);
      else p = (minutesOfDay > DAY_END ? (minutesOfDay - DAY_END) : (minutesOfDay + (1440 - DAY_END))) / (1440 - (DAY_END - DAY_START));
      cx = 6 + p * 84; cy = 76 - Math.sin(p * Math.PI) * 60;
      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
      const smoothStep = (value, edge0, edge1) => {
        if (value <= edge0) return 0;
        if (value >= edge1) return 1;
        return (value - edge0) / (edge1 - edge0);
      };
      const nightStrength = clamp(1 - smoothStep(minutesOfDay, 300, 660) + smoothStep(minutesOfDay, 1200, 1440), 0, 1);
      const goldenStrength = clamp(1 - Math.abs(minutesOfDay - 17 * 60) / 90, 0, 1);
      const sunsetStrength = clamp(1 - Math.abs(minutesOfDay - 18 * 60) / 90, 0, 1);
      const starStrength = clamp(1 - smoothStep(minutesOfDay, 330, 720) + smoothStep(minutesOfDay, 1200, 1440), 0, 1);

      // Светило всегда ЗА пейзажем, на любой высоте. Небесное тело физически
      // дальше любого дерева, поэтому пересечение должно его скрывать, а не
      // наоборот. Раньше слой переключался только у горизонта (cy > 62), и
      // днём солнце рисовалось поверх крон.
      celestialStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;--cel-layer:1;--scene-layer:2;"`;
      sunVarsStyle = ` style="--sun-h:${p.toFixed(3)};--sun-alt:${Math.max(0, Math.sin(p * Math.PI)).toFixed(3)};"`;
      // --cel-x/--cel-y дублируем на виджет: лунная дорожка и солнечные блики
      // на воде — потомки .hud-fx-season-scene, а не светила, и до его
      // собственных переменных не дотягиваются.
      sceneStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;--scene-day-progress:${p.toFixed(3)};--scene-night-strength:${nightStrength.toFixed(3)};--scene-golden-strength:${goldenStrength.toFixed(3)};--scene-sunset-strength:${sunsetStrength.toFixed(3)};--scene-star-strength:${starStrength.toFixed(3)};"`;
    }

    if (Object.keys(data.scene).length > 0) {
      let subTags = [];
      if (tRaw) subTags.push(`<span class="hud-preview-tag">🕒 ${escapeHtml(tRaw.split('|')[0].trim())}</span>`);
      if (wRaw) subTags.push(`<span class="hud-preview-tag">🌤️ ${escapeHtml(wRaw)}</span>`);
      if (dRaw) subTags.push(`<span class="hud-preview-tag">📅 ${escapeHtml(dRaw)}</span>`);
      osSubtitleHtml = `<div class="hud-os-subtitle">${subTags.join('')}</div>`;
    }

    // МЕГА-ПАНЕЛЬ НАСТРОЕК С НОВЫМИ ШРИФТАМИ И ВЕРТИКАЛЬНОЙ СЕТКОЙ
    let html = `<div class="hud-os-card no-swipe">
      <input type="checkbox" class="hud-toggle-input" id="os-toggle-${baseId}">
      <label class="hud-os-topbar" for="os-toggle-${baseId}">
        <div class="hud-os-topbar-left"><span class="hud-os-logo">TavernOS</span>${osSubtitleHtml}</div>
        <div class="hud-os-topbar-right">
            <span class="hud-theme-btn" title="Настроить цвета темы">🎨</span>
            <span class="hud-regen-btn" title="Перегенерировать только HUD">🔄</span>
            <span class="hud-toggle-indicator">▼</span>
        </div>
      </label>
      <div class="hud-theme-panel" id="theme-panel-${baseId}">
        <div class="hud-theme-presets">
          <div class="hud-theme-presets-title">Готовые темы</div>
          <div class="hud-theme-presets-row">${presetRowHTML(settings.themePreset)}</div>
          <div class="hud-theme-presets-note">Тема просто выставляет ползунки ниже — после неё всё можно править руками.</div>
          <div class="hud-theme-acts">
            <button type="button" class="hud-theme-act" data-theme-act="save" title="Запомнить текущие ползунки для выбранной темы">💾 Запомнить правки</button>
            <button type="button" class="hud-theme-act" data-theme-act="revert" title="Вернуть теме её исходные значения">↺ Вернуть тему</button>
            <button type="button" class="hud-theme-act own" data-theme-act="mine" title="Сохранить текущие настройки отдельной темой «Своя»">★ Сохранить свою тему</button>
            ${settings.customTheme ? '<button type="button" class="hud-theme-act danger" data-theme-act="forget" title="Удалить сохранённую свою тему">✕ Удалить свою</button>' : ''}
          </div>
        </div>
        <div class="hud-theme-system">
          <div class="hud-theme-presets-title">Система цветов</div>
          <div class="hud-theme-roles">
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="accentColor" value="${settings.accentColor}"><span>Основной</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="cardBgStart" value="${settings.cardBgStart}"><span>Поверхность</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="infoBlockBgStart" value="${settings.infoBlockBgStart}"><span>Стекло</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="textColor" value="${settings.textColor || '#e6e6ee'}"><span>Текст</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="textMutedColor" value="${settings.textMutedColor || '#9aa0ae'}"><span>Приглушённый</span></label>
            <button type="button" class="hud-role hud-role-clear" data-theme-act="cleartext" title="Вернуть цвет текста из темы SillyTavern"><span class="hud-role-x">⌫</span><span>Цвет текста<br>по умолчанию</span></button>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="dramaColor" value="${settings.dramaColor}"><span>Тревога</span></label>
            <label class="hud-role"><input type="color" class="hud-theme-color-input" data-key="memoryAccent" value="${settings.memoryAccent}"><span>Память</span></label>
          </div>
          <div class="hud-theme-row hud-glass-row">
            <label>Стекло:</label>
            <select class="hud-theme-select-input" data-key="glassType">
              <option value="frosted"${settings.glassType === 'frosted' ? ' selected' : ''}>Матовое</option>
              <option value="clear"${settings.glassType === 'clear' ? ' selected' : ''}>Прозрачное</option>
              <option value="tinted"${settings.glassType === 'tinted' ? ' selected' : ''}>Тонированное</option>
              <option value="liquid"${settings.glassType === 'liquid' ? ' selected' : ''}>Жидкое</option>
              <option value="iridescent"${settings.glassType === 'iridescent' ? ' selected' : ''}>Перламутр</option>
            </select>
          </div>
          <div class="hud-theme-presets-title" style="margin-top:10px">Живой просмотр</div>
          <div class="hud-theme-preview">
            <div class="hud-os-card">
              <div class="hud-os-topbar"><div class="hud-os-topbar-left"><span class="hud-os-logo">TavernOS</span></div></div>
              <div class="hud-os-wrapper">
                <div class="hud-tab-content active">
                  <div class="hud-key-block">
                    <div class="hud-key-label">Настроение</div>
                    <div class="hud-key-list">
                      <div class="hud-key-item">Спокойна, но настороже</div>
                      <div class="hud-key-item">Ждёт ответа</div>
                    </div>
                  </div>
                  <div class="hud-row"><div class="hud-key">Локация</div><div>Старый мост</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="hud-theme-presets-note">Просмотр живой: он собран из тех же блоков, что и настоящий HUD, и меняется вместе с ползунками.</div>
        </div>
        <details><summary>🎨 Общие цвета & Фоны</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="accentColor" value="${settings.accentColor}"></div>
            <div class="hud-theme-row"><label>Свечение:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="glowColor" value="${settings.glowColor}"><input type="range" class="hud-theme-range-input" data-key="glowAlpha" min="0" max="100" value="${settings.glowAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="cardBgStart" value="${settings.cardBgStart}"><input type="range" class="hud-theme-range-input" data-key="cardBgAlpha" min="0" max="100" value="${settings.cardBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="cardBgEnd" value="${settings.cardBgEnd}"></div>

            <!-- БЛОК БЛЮРА И ВСТРОЕННОГО "РЕДАКТОРА" ФОНА -->
            <div class="hud-theme-row"><label>Сила Блюра:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="backdropBlur" min="0" max="30" value="${settings.backdropBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.backdropBlur}px</span></div></div>
            <div class="hud-theme-row"><label>Прозрачность фона:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgOpacity" min="0" max="100" value="${settings.bgOpacity}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgOpacity}%</span></div></div>
            <div class="hud-theme-row"><label>Масштаб картинки:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgScale" min="50" max="200" value="${settings.bgScale}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgScale}%</span></div></div>
            <div class="hud-theme-row"><label>Сдвиг (Вверх-Вниз):</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="bgOffsetY" min="0" max="100" value="${settings.bgOffsetY}"> <span style="font-size:0.8em;opacity:0.7">${settings.bgOffsetY}%</span></div></div>
            
            <div class="hud-theme-row"><label>Фон (Картинка):</label> 
              <div class="hud-theme-flex">
                <input type="text" class="hud-theme-text-input" data-key="bgImage" value="${settings.bgImage}" placeholder="URL..." style="width: 80px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 4px; font-size: 0.9em;">
                <button type="button" class="hud-bg-upload-btn" title="Выбрать картинку из папки">📁</button>
                <input type="file" class="hud-bg-upload-file" accept="image/*" style="display:none;">
                <button type="button" class="hud-bg-clear-btn" title="Убрать фоновую картинку">✕</button>
              </div>
            </div>
            <!-- КОНЕЦ НОВОГО БЛОКА -->
            
            <div class="hud-theme-row"><label>Инфоблок (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="infoBlockBgStart" value="${settings.infoBlockBgStart}"><input type="range" class="hud-theme-range-input" data-key="infoBlockBgAlpha" min="0" max="100" value="${settings.infoBlockBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Инфоблок (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="infoBlockBgEnd" value="${settings.infoBlockBgEnd}"></div>
          </div>
        </details>
        <details><summary>🧠 Память</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Фон (Старт):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="memoryBgStart" value="${settings.memoryBgStart}"><input type="range" class="hud-theme-range-input" data-key="memoryBgAlpha" min="0" max="100" value="${settings.memoryBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон (Конец):</label> <input type="color" class="hud-theme-color-input" data-key="memoryBgEnd" value="${settings.memoryBgEnd}"></div>
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="memoryAccent" value="${settings.memoryAccent}"></div>
            <div class="hud-theme-row"><label>Свечение:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="memoryGlowAlpha" min="0" max="100" value="${settings.memoryGlowAlpha}"></div></div>
            <div class="hud-theme-row"><label>Блюр:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="memoryBlur" min="0" max="30" value="${settings.memoryBlur}"><span style="font-size:0.8em;opacity:0.7">${settings.memoryBlur}px</span></div></div>
          </div>
        </details>
        <details><summary>📱 Телефон — настройки темы</summary>
          <div class="hud-theme-grid">
            <label class="hud-theme-row hud-phone-auto-row" style="grid-column:1/-1; display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" class="hud-phone-theme-auto" ${settings.phoneThemeAuto !== false ? "checked" : ""}>
              <span>Наследовать тему HUD</span>
            </label>
            <div style="font-size:10.5px;opacity:.55;grid-column:1/-1;margin:-4px 0 4px;">Пока включено, телефон берёт акцент, фон, блюр и шрифт у HUD. Любая правка ниже выключит наследование, чтобы её не затирало.</div>
            <div class="hud-theme-row"><label>Фон экрана:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="phoneBgStart" value="${settings.phoneBgStart}"><input type="color" class="hud-theme-color-input" data-key="phoneBgEnd" value="${settings.phoneBgEnd}"><input type="range" class="hud-theme-range-input" data-key="phoneBgAlpha" min="0" max="100" value="${settings.phoneBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Акцент:</label> <input type="color" class="hud-theme-color-input" data-key="phoneAccent" value="${settings.phoneAccent}"></div>
            <div class="hud-theme-row"><label>Блюр стекла:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneBlur" min="0" max="30" value="${settings.phoneBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneBlur}px</span></div></div>
            <div class="hud-theme-row"><label>Входящие сообщения:</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="msgInBg" value="${settings.msgInBg}"><input type="range" class="hud-theme-range-input" data-key="msgInAlpha" min="0" max="100" value="${settings.msgInAlpha}"></div></div>
            <div class="hud-theme-row"><label>Исходящие сообщения:</label><div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="msgOutStart" value="${settings.msgOutStart}"><input type="color" class="hud-theme-color-input" data-key="msgOutEnd" value="${settings.msgOutEnd}"><input type="range" class="hud-theme-range-input" data-key="msgOutAlpha" min="0" max="100" value="${settings.msgOutAlpha}"></div></div>
            <div class="hud-theme-row"><label>Скругление пузырей:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneBubbleRadius" min="2" max="24" value="${settings.phoneBubbleRadius}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneBubbleRadius}px</span></div></div>
            <div class="hud-theme-row"><label>Шрифт телефона:</label> <select class="hud-theme-select-input" data-key="phoneFont">${makeFontOptions(settings.phoneFont)}</select></div>
            <div class="hud-theme-row"><label>Размер шрифта:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneFontSize" min="10" max="20" value="${settings.phoneFontSize}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneFontSize}px</span></div></div>
            <div class="hud-theme-row"><label>Плотность уведомлений:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneNotifAlpha" min="40" max="100" value="${settings.phoneNotifAlpha}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneNotifAlpha}%</span></div></div>
            <div class="hud-theme-row"><label>Скругление иконок:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneIconRadius" min="6" max="26" value="${settings.phoneIconRadius}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneIconRadius}px</span></div></div>
            <div class="hud-theme-row"><label>Цвет корпуса:</label> <input type="color" class="hud-theme-color-input" data-key="phoneFrameColor" value="${settings.phoneFrameColor}"></div>
            <div class="hud-theme-row"><label>Свечение экрана:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneScreenGlow" min="0" max="100" value="${settings.phoneScreenGlow}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneScreenGlow}%</span></div></div>
            <div class="hud-theme-row"><label>Карточек уведомлений:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="phoneNotifMax" min="1" max="5" value="${settings.phoneNotifMax}"> <span style="font-size:0.8em;opacity:0.7">${settings.phoneNotifMax}</span></div></div>
          </div>
        </details>
        <details><summary>🗂️ Верхние плашки & Табы</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Верхняя панель:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="topBarBg" value="${settings.topBarBg}"><input type="range" class="hud-theme-range-input" data-key="topBarAlpha" min="0" max="100" value="${settings.topBarAlpha}"></div></div>
            <div class="hud-theme-row"><label>Фон вкладок (Табы):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="tabsBg" value="${settings.tabsBg}"><input type="range" class="hud-theme-range-input" data-key="tabsAlpha" min="0" max="100" value="${settings.tabsAlpha}"></div></div>
          </div>
        </details>
        <details><summary>🌤️ Виджет погоды</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Оверлей (Оттенок):</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="sceneOverlayColor" value="${settings.sceneOverlayColor}"><input type="range" class="hud-theme-range-input" data-key="sceneOverlayAlpha" min="0" max="100" value="${settings.sceneOverlayAlpha}"></div></div>
            <div class="hud-theme-row"><label>Цвет текста:</label> <input type="color" class="hud-theme-color-input" data-key="sceneTextColor" value="${settings.sceneTextColor}"></div>
            <div class="hud-theme-row"><label>Фон плашек:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="weatherBgColor" value="${settings.weatherBgColor}"><input type="range" class="hud-theme-range-input" data-key="weatherBgAlpha" min="0" max="100" value="${settings.weatherBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Блюр плашек:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="weatherBlur" min="0" max="30" value="${settings.weatherBlur}"> <span style="font-size:0.8em;opacity:0.7">${settings.weatherBlur}px</span></div></div>
            <div class="hud-theme-row" title="Насколько сильно вечер и ночь притемняют виджет погоды — и в покое, и после касания. 0 — не притемнять вовсе, 100 — исходная сила."><label>Затемнение сцены:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="sceneDarkness" min="0" max="150" value="${settings.sceneDarkness}"> <span style="font-size:0.8em;opacity:0.7">${settings.sceneDarkness}%</span></div></div>
          </div>
        </details>
        <details><summary>📡 Перехваты</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет Перехвата:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="interceptColor" value="${settings.interceptColor}"><input type="range" class="hud-theme-range-input" data-key="interceptBgAlpha" min="0" max="100" value="${settings.interceptBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Бейдж уведомл.:</label> <input type="color" class="hud-theme-color-input" data-key="badgeColor" value="${settings.badgeColor}"></div>
          </div>
        </details>
        <details><summary>⚠️ Драма & NSFW</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет Драмы:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="dramaColor" value="${settings.dramaColor}"><input type="range" class="hud-theme-range-input" data-key="dramaBgAlpha" min="0" max="100" value="${settings.dramaBgAlpha}"></div></div>
            <div class="hud-theme-row"><label>Цвет NSFW:</label> <div class="hud-theme-flex"><input type="color" class="hud-theme-color-input" data-key="nsfwColor" value="${settings.nsfwColor}"><input type="range" class="hud-theme-range-input" data-key="nsfwBgAlpha" min="0" max="100" value="${settings.nsfwBgAlpha}"></div></div>
          </div>
        </details>
        <details><summary>✍️ Шрифты & Размеры</summary>
          <div class="hud-theme-grid">
            <div class="hud-theme-row"><label>Цвет часов:</label> <input type="color" class="hud-theme-color-input" data-key="clockColor" value="${settings.clockColor}"></div>
            <div class="hud-theme-row"><label>Шрифт часов:</label>
              <select class="hud-theme-select-input" data-key="fontClock">${makeFontOptions(settings.fontClock)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер часов:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeClock" min="20" max="60" value="${settings.fontSizeClock}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeClock}px</span></div></div>
            
            <div class="hud-theme-row"><label>Основной шрифт:</label>
              <select class="hud-theme-select-input" data-key="fontMain">${makeFontOptions(settings.fontMain)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер текста:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeMain" min="10" max="22" value="${settings.fontSizeMain}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeMain}px</span></div></div>
            
            <div class="hud-theme-row"><label>Шрифт заголовков:</label>
              <select class="hud-theme-select-input" data-key="fontHeaders">${makeFontOptions(settings.fontHeaders)}</select>
            </div>
            <div class="hud-theme-row"><label>Размер заголовков:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeHeaders" min="10" max="20" value="${settings.fontSizeHeaders}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeHeaders}px</span></div></div>
            
            <div class="hud-theme-row"><label>Шрифт Дневника:</label>
              <select class="hud-theme-select-input" data-key="fontDiary">${makeFontOptions(settings.fontDiary)}</select>
            </div>
          </div>
		  <div class="hud-theme-row"><label>Размер Дневника:</label> <div class="hud-theme-flex"><input type="range" class="hud-theme-range-input" data-key="fontSizeDiary" min="12" max="30" value="${settings.fontSizeDiary}"> <span style="font-size:0.8em;opacity:0.7">${settings.fontSizeDiary}px</span></div></div>
        </details>
      </div>
      <div class="hud-os-wrapper">`;

    if (Object.keys(data.scene).length > 0) {
      let tParts = tRaw.split('|').map(s => s.trim());
      let timeHHMM = tParts[0] || '--:--';
      let timePhase = tParts.length > 1 ? tParts[1].toUpperCase() : '';
      let timeDisplay = escapeHtml(timeHHMM).replace(':', '<span class="hud-time-colon">:</span>');
       
      let dateStr = escapeHtml(dRaw);
      if (dateStr && timePhase) dateStr += ` • ${timePhase}`;
      else if (!dateStr && timePhase) dateStr = timePhase;

      let atmStr = data.scene['Атмосфера'] ? `«${escapeHtml(data.scene['Атмосфера'])}»` : '';

      let stars = '';
      const starDot = (cls, l, t, sz, dur, delay) => `<span class="hud-star2 dot ${cls}" style="left:${l}%;top:${t}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
      const starDiamond = (cls, l, t, sz, dur, delay) => `<span class="hud-star2 diamond ${cls}" style="left:${l}%;top:${t}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
      stars += starDot('', 12, 22, 2, 2.2, 0);
      stars += starDiamond('', 24, 12, 3, 2.6, 0.4);
      stars += starDot('', 38, 30, 2, 1.9, 0.9);
      stars += starDot('', 50, 10, 2.4, 2.4, 0.2);
      stars += starDiamond('', 62, 26, 3, 3, 1.2);
      stars += starDot('', 74, 14, 2, 2.1, 0.6);
      stars += starDot('', 84, 32, 2.6, 2.8, 1.5);
      stars += starDiamond('', 92, 20, 2.5, 2.3, 0.3);
      stars += starDot('', 6, 38, 1.8, 2, 1.8);

      let fireflies = '';
      for (let i = 1; i <= 6; i++) fireflies += `<span class="hud-firefly ff${i}"></span>`;

      html += `
      <div class="hud-scene-widget ${phaseClass} ${wClass} ${wIntensity} ${windClass} ${tempClass} ${freezeClass} ${seasonClass} ${dustyClass} ${rainbowClass} ${wetClass}"${sceneStyle} title="Нажмите для анимации">
        <div class="hud-fx-bg"></div>
        <div class="hud-fx-stars">${stars}</div>
        <div class="hud-fx-fireflies">${fireflies}</div>
        <div class="hud-fx-storm-flash"></div>
        <div class="hud-fx-lightning">${buildLightningSvg()}</div>
        <div class="hud-fx-rainbow"></div>
        <div class="hud-fx-celestial"${celestialStyle}></div>
        <div class="hud-fx-cloud-cover"></div>
        <div class="hud-fx-season-scene"${sunVarsStyle}>${buildSeasonSceneHtml(seasonClass, { dew: dewActive, deepFreeze: !!freezeClass })}</div>
        <div class="hud-fx-weather"><span class="hud-rain-cloud rc-back"></span><span class="hud-rain-cloud rc-front"></span><span class="hud-snow-layer snow-far"></span><span class="hud-snow-layer snow-mid"></span><span class="hud-snow-layer snow-near"></span></div>
        <div class="hud-fx-frost"></div>
        <div class="hud-fx-temp"></div>
        <div class="hud-fx-overlay"></div>
        <div class="hud-scene-top">
          <div class="hud-scene-time-group">
            <div class="hud-time-display">${timeDisplay}</div>
            ${dateStr ? `<div class="hud-date-display">${dateStr}</div>` : ''}
          </div>
          <div class="hud-scene-weather-group">
            ${data.scene['Погода'] ? `<div class="hud-weather-item">${escapeHtml(data.scene['Погода'])}</div>` : ''}
            ${data.scene['Настроение'] ? `<div class="hud-mood-item">${escapeHtml(data.scene['Настроение'])}</div>` : ''}
          </div>
        </div>
        ${atmStr ? `<div class="hud-scene-atm">${atmStr}</div>` : ''}
      </div>`;
    }
     
    html += `<div class="hud-tabs-header">`;

    let tabsHtml = '', contentHtml = '', isFirst = true;

    data.characters.forEach((char, index) => {
      const uid = `char-${index}-${baseId}`;
      const name = char['Имя'] || `NPC ${index+1}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👤 ${escapeHtml(name.split(' ')[0])}</div>`;
      contentHtml += buildCharacterHTML(char, uid, isFirst, index === 0);
      isFirst = false;
    });

    if (settings.enableUserBlock && data.user && Object.keys(data.user).length > 0) {
      const uid = `user-${baseId}`;
      const userTabHtml = buildUserHTML(data.user, uid, isFirst);
      if (userTabHtml) {
        const personaName = getSafeUserName();
        tabsHtml += `<div class="hud-tab hud-user-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👤 ${escapeHtml(personaName.split(' ')[0])}</div>`;
        contentHtml += userTabHtml;
        isFirst = false;
      }
    }

    if (hasPhone) {
      const uid = `phone-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📱 Телефон</div>`;
      contentHtml += buildPhoneTabsHTML(data.chatsMap, uid, isFirst, getSafeUserName(), data.phone, data.scene && data.scene['Дата'], tRaw);
      isFirst = false;
    }

    // === ВСТАВЛЯЕМ ВКЛАДКУ ПАМЯТИ СЮДА ===
    if (settings.enableMemory && hasMemory) {
      const uid = `memory-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🧠 Память</div>`;
      try {
        contentHtml += buildMemoryHTML(data.memory || {}, uid, isFirst, data);
      } catch (e) {
        console.error('[TavernOS HUD] Memory renderer failed; keeping later tabs available:', e);
        contentHtml += `<div class="hud-tab-content ${isFirst ? 'active' : ''}" id="content-${uid}"><div class="hud-memory-error">🧠 Не удалось отобразить один из блоков памяти. Остальные вкладки HUD доступны.</div></div>`;
      }
      isFirst = false;
    }


    // Preserve the original visibility contract: a top-level tab appears only
    // when its section actually contains renderable data. Values such as
    // "empty", "none" and "пусто" must not create an otherwise blank tab.
    if (hudHasMeaningfulIntercepts(data.intercepts) && settings.enableIntercepts) {
      const uid = `intercept-${baseId}`;
      tabsHtml += `<div class="hud-tab intercept-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📡 Перехваты</div>`;
      contentHtml += buildInterceptsHTML(data.intercepts, uid, isFirst);
      isFirst = false;
    }

    if (hudHasMeaningfulDiary(data.diary) && settings.enableDiary) {
      const uid = `diary-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📖 Дневник</div>`;
      contentHtml += buildDiaryHTML(data.diary, uid, isFirst);
      isFirst = false;
    }

    if (hudHasMeaningfulDreams(data.dreams) && settings.enableDreams) {
      const uid = `dream-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🌙 Сны</div>`;
      contentHtml += buildDreamHTML(data.dreams, uid, isFirst);
      isFirst = false;
    }

    if (hudHasMeaningfulWorld(data.world) && settings.enableWorld) {
      const uid = `world-${baseId}`;
      tabsHtml += `<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🌍 Мир</div>`;
      contentHtml += buildWorldHTML(data.world, uid, isFirst, settings.showComments);
      isFirst = false;
    }

    html += tabsHtml + `</div><div class="hud-tabs-body">` + contentHtml + `</div></div></div>`;
    return html;
  }

  function freezeOldHUDs() {
    const scope = cachedChatContainer || document;
    const allCards = scope.querySelectorAll('.hud-os-card');
    if (allCards.length > 0) {
      for (let i = 0; i < allCards.length - 1; i++) {
        if (allCards[i].dataset.userExpanded === 'true') continue; // пользователь сам раскрыл — не трогаем
        if (!allCards[i].classList.contains('hud-historical')) {
          allCards[i].classList.add('hud-historical');
          const checkbox = allCards[i].querySelector('.hud-toggle-input');
          if (checkbox) checkbox.checked = false; 
        }
      }
      allCards[allCards.length - 1].classList.remove('hud-historical');
    }
  }

  function maybeInjectMissingHudButton(messageElement, textElement) {
    if (messageElement.getAttribute('is_user') === 'true') return;
    if (messageElement.getAttribute('is_system') === 'true') return;

    if (textElement.querySelector('.hud-missing-placeholder')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'hud-missing-placeholder';
    wrapper.innerHTML = `<span class="hud-regen-btn hud-create-btn" title="В этом сообщении нет HUD-блока — сгенерировать и вшить с нуля">➕ Создать HUD</span>`;
    textElement.appendChild(wrapper);
    bindHudRegenButton(wrapper.querySelector('.hud-create-btn'));
  }

  function getHudChatContextSafe() {
    try {
      if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
        return window.SillyTavern.getContext();
      }
      if (typeof getContext === 'function') return getContext();
      if (typeof window.getContext === 'function') return window.getContext();
    } catch (e) {
      console.debug('[TavernOS HUD] chat context unavailable during HUD recovery:', e);
    }
    return null;
  }

  function findChatMessageForElement(messageElement) {
    const id = messageElement?.getAttribute?.('mesid');
    if (id == null) return null;
    const ctx = getHudChatContextSafe();
    const chatData = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
    if (!chatData) return null;
    const numericId = parseInt(id, 10);
    const byMeta = chatData.find(m => String(m?._id) === String(id) || String(m?.mesId) === String(id));
    if (byMeta) return byMeta;
    return Number.isInteger(numericId) && numericId >= 0 && numericId < chatData.length ? chatData[numericId] : null;
  }

  function recoverHudFromActiveSwipe(messageElement, textElement) {
    if (!messageElement || !textElement) return false;
    const message = findChatMessageForElement(messageElement);
    if (!message || !Array.isArray(message.swipes) || message.swipe_id === undefined) return false;
    const activeIndex = Number(message.swipe_id);
    if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= message.swipes.length) return false;
    const activeSwipe = message.swipes[activeIndex];
    if (typeof activeSwipe !== 'string') return false;
    const hudBlock = extractHudBlock(activeSwipe);
    if (!hudBlock || !/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(hudBlock)) return false;

    // ST иногда после saveReply держит HUD в swipes[current] раньше, чем он
    // попадает в message.mes/DOM. Восстанавливаем только отображаемый текст:
    // саму механику вставки/обновления HUD не меняем.
    const currentHtml = textElement.innerHTML || '';
    if (/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(currentHtml)) return false;

    const node = document.createTextNode('\n\n' + hudBlock);
    textElement.appendChild(node);
    console.debug('[TavernOS HUD] Recovered HUD from active swipe', {
      swipeId: activeIndex,
      messageId: messageElement.getAttribute('mesid')
    });
    return true;
  }

  async function processMessage(messageElement) {
    const _mesid = messageElement.getAttribute('mesid');
    const textElement = messageElement.querySelector('.mes_text');
    if (!textElement) { return; }

    const stalePlaceholder = textElement.querySelector('.hud-missing-placeholder');
    if (stalePlaceholder) stalePlaceholder.remove();

    let innerHtml = textElement.innerHTML;

    // Если карточка уже есть и исходного [HUD] в DOM больше нет — всё уже обработано.
    // Если ST снова дорисовал исходный [HUD] рядом с карточкой, НЕ выходим:
    // нормализатор ниже должен удалить сырой блок и оставить одну карточку.
    const hasRenderedCard = innerHtml.includes('hud-os-card');
    const hasRawHudSource = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(innerHtml);
    if (hasRenderedCard && !hasRawHudSource) return;

    // Recovery path for ST swipe/save timing:
    if (!/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i.test(innerHtml)) {
      if (recoverHudFromActiveSwipe(messageElement, textElement)) {
        innerHtml = textElement.innerHTML;
      }
    }

    const openTagRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i;
    const closeTagRegex = /(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i;

    if (!openTagRegex.test(innerHtml)) {
      maybeInjectMissingHudButton(messageElement, textElement);
      return;
    }

    const [lastMes, secondLastMes] = getLastTwoMes();
    const isLastMes = messageElement === lastMes || messageElement === secondLastMes;
    const hasCloseTag = closeTagRegex.test(innerHtml);

    const extractRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
    const hudBlocks = [];
    let hudMatch;
    while ((hudMatch = extractRegex.exec(innerHtml)) !== null) {
      hudBlocks.push({
        full: hudMatch[0],
        content: hudMatch[1] || '',
        index: hudMatch.index,
      });
      if (hudMatch[0] === '') extractRegex.lastIndex++;
    }

    const parsedHudBlocks = [];
    for (let index = 0; index < hudBlocks.length; index++) {
      const block = hudBlocks[index];
      try {
        const data = parseHUDComplex(block.content);
        parsedHudBlocks.push({
          index,
          data,
          score: scoreHudJsonCandidate(data),
        });
      } catch (e) {
        console.debug('[TavernOS HUD] HUD block candidate failed', {
          blockIndex: index,
          error: e?.message || String(e),
        });
      }
    }

    let hasChanges = false;
    let newHtml = innerHtml;
    let rendered = '';
    if (parsedHudBlocks.length) {
      parsedHudBlocks.sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = parsedHudBlocks[0];
      renderTargetMes = messageElement;
      rendered = renderHUD(selected.data);
      renderTargetMes = null;

      if (rendered) {
        for (let i = hudBlocks.length - 1; i >= 0; i--) {
          const block = hudBlocks[i];
          const replacement = i === selected.index ? rendered : '';
          newHtml = newHtml.slice(0, block.index) + replacement + newHtml.slice(block.index + block.full.length);
        }
        hasChanges = newHtml !== innerHtml;

        setHudRepairDiagnostic({
          ...(window.__tavernOSHudRepairDiagnostic || {}),
          multiHudBlocks: hudBlocks.length,
          parsedHudBlocks: parsedHudBlocks.length,
          selectedHudBlock: selected.index,
          selectedHudScore: selected.score,
        });
      }
    }

    if (hasChanges) {
      const normalized = normalizeHudDisplayDom(messageElement, textElement, rendered);
      if (!normalized) textElement.innerHTML = newHtml;
      textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);
      freezeOldHUDs();

      if (hasCloseTag || !isLastMes || hudBlocks.length > 1) {
        messageElement.dataset.hudProcessed = 'true';
      }

      setHudRepairDiagnostic({
        ...(window.__tavernOSHudRepairDiagnostic || {}),
        displayNormalized: normalized,
        displayHudCards: textElement.querySelectorAll('.hud-os-card').length,
      });
    }

    textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);

    textElement.querySelectorAll('.hud-os-card').forEach(card => {
        if (!card.dataset.touchFixed) {
            card.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});
            card.addEventListener('touchmove', e => e.stopPropagation(), {passive: true});
            card.addEventListener('touchend', e => e.stopPropagation(), {passive: true});
            card.dataset.touchFixed = 'true';
        }

        // Tab bars need their own guard so horizontal swipes scroll the HUD tabs
        // instead of being interpreted by SillyTavern as a message swipe.
        card.querySelectorAll('.hud-tabs-header, .hud-phone-subtabs').forEach(bar => {
            if (bar.dataset.swipeGuardBound === 'true') return;
            ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(type => {
                bar.addEventListener(type, e => e.stopPropagation(), { passive: true });
            });
            bar.dataset.swipeGuardBound = 'true';
        });
    });
  }

  // Remove duplicate HUD cards/raw HUD markup from the *displayed DOM only*.
  // The saved message/swipe data is intentionally untouched. This is a safety
  // net for ST re-renders where the same active swipe can briefly be painted
  // twice (or once as a rendered card and once as the original fenced JSON).
  function normalizeHudDisplayDom(messageElement, textElement, renderedHtml) {
    if (!messageElement || !textElement) return false;

    // A previous pass may already have produced a card while ST subsequently
    // restored the source HUD text. Remove cards from this message first, then
    // paint exactly one fresh card at the source HUD position. Other messages
    // are untouched.
    textElement.querySelectorAll('.hud-os-card').forEach(card => card.remove());

    let html = textElement.innerHTML || '';
    const hudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
    const matches = [];
    let m;
    while ((m = hudRegex.exec(html)) !== null) {
      matches.push({ index: m.index, length: m[0].length });
      if (m[0] === '') hudRegex.lastIndex++;
    }

    // If the HTML-level regex sees raw HUD blocks, replace ALL of them with
    // exactly one rendered card. This is deliberately independent of parsing
    // and therefore also cleans up a malformed/duplicate second block.
    if (matches.length) {
      let out = html;
      for (let i = matches.length - 1; i >= 0; i--) {
        const r = matches[i];
        out = out.slice(0, r.index) + (i === 0 ? renderedHtml : '') + out.slice(r.index + r.length);
      }
      if (out !== html) {
        textElement.innerHTML = out;
        return true;
      }
    }

    // If the raw HUD survived because a markdown/highlight renderer split the
    // markers across DOM text nodes, use a DOM Range fallback. It removes the
    // entire marker-to-marker region without touching surrounding prose.
    const walker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    const flat = [];
    for (const n of nodes) {
      const value = n.nodeValue || '';
      flat.push({ node: n, start: flat.length ? flat[flat.length - 1].end : 0, end: (flat.length ? flat[flat.length - 1].end : 0) + value.length });
    }
    const fullText = flat.map(x => x.node.nodeValue || '').join('');
    const open = /(?:\[|<)\s*HUD\s*(?:\]|>)/i;
    const close = /(?:\[|<)\s*\/\s*HUD\s*(?:\]|>)/i;
    const openMatch = fullText.match(open);
    if (openMatch) {
      const closeMatch = fullText.match(close);
      if (closeMatch && closeMatch.index >= openMatch.index) {
        const startPos = openMatch.index;
        const endPos = closeMatch.index + closeMatch[0].length;
        const locate = (pos) => flat.find(x => pos >= x.start && pos <= x.end) || flat[flat.length - 1];
        const a = locate(startPos);
        const b = locate(endPos);
        if (a && b) {
          const range = document.createRange();
          range.setStart(a.node, Math.max(0, startPos - a.start));
          range.setEnd(b.node, Math.max(0, endPos - b.start));
          range.deleteContents();
          const holder = document.createElement('div');
          holder.innerHTML = renderedHtml;
          const frag = document.createDocumentFragment();
          while (holder.firstChild) frag.appendChild(holder.firstChild);
          range.insertNode(frag);
          return true;
        }
      }
    }

    return false;
  }

  // SillyTavern uses .edit_textarea while a message is being edited.
  // TavernOS must not touch the message DOM during editing, otherwise its
  // normal HUD re-render can overwrite the editor contents.
  function isMessageBeingEdited(messageElement) {
    if (!messageElement) return false;
    return !!messageElement.querySelector(
      '.edit_textarea, textarea#curEditTextarea, .mes_edit_textarea'
    );
  }

  const PERFORMANCE_MESSAGE_THRESHOLD = 200;
  const PERFORMANCE_ACTIVE_WINDOW = 80;
  let performanceIntersectionObserver = null;
  let performanceScrollRaf = 0;

  function isPerformanceModeActive(container = cachedChatContainer) {
    if (!settings.performanceMode || !container) return false;
    return container.querySelectorAll('.mes').length >= PERFORMANCE_MESSAGE_THRESHOLD;
  }

  function updatePerformanceMode() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return false;
    const active = isPerformanceModeActive(container);
    container.classList.toggle('hud-performance-mode', active);
    if (!active) {
      container.querySelectorAll('.mes.hud-perf-older, .mes.hud-perf-visible').forEach(el => {
        el.classList.remove('hud-perf-older', 'hud-perf-visible');
      });
    }
    return active;
  }

  function refreshPerformanceMessageClasses() {
    const container = cachedChatContainer;
    if (!container || !isPerformanceModeActive(container)) return;
    const messages = Array.from(container.querySelectorAll('.mes'));
    const start = Math.max(0, messages.length - PERFORMANCE_ACTIVE_WINDOW);
    messages.forEach((mes, index) => {
      if (index < start && !mes.classList.contains('hud-perf-visible')) mes.classList.add('hud-perf-older');
      else mes.classList.remove('hud-perf-older');
    });
  }

  function setupPerformanceObserver() {
    const container = cachedChatContainer;
    if (!container) return;
    if (performanceIntersectionObserver) performanceIntersectionObserver.disconnect();
    performanceIntersectionObserver = null;
    if (!isPerformanceModeActive(container) || typeof IntersectionObserver === 'undefined') return;

    performanceIntersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const mes = entry.target;
        if (!mes.isConnected) continue;
        if (entry.isIntersecting) {
          mes.classList.add('hud-perf-visible');
          mes.classList.remove('hud-perf-older');
          safeProcessMessage(mes);
        } else {
          mes.classList.remove('hud-perf-visible');
          if (isPerformanceModeActive(container)) mes.classList.add('hud-perf-older');
        }
      }
    }, { root: null, rootMargin: '900px 0px', threshold: 0.01 });

    container.querySelectorAll('.mes').forEach(mes => performanceIntersectionObserver.observe(mes));
    refreshPerformanceMessageClasses();
  }

  function schedulePerformanceRefresh() {
    if (performanceScrollRaf) return;
    performanceScrollRaf = requestAnimationFrame(() => {
      performanceScrollRaf = 0;
      const wasActive = cachedChatContainer?.classList.contains('hud-performance-mode');
      const active = updatePerformanceMode();
      if (active && !wasActive) setupPerformanceObserver();
      if (!active && wasActive && performanceIntersectionObserver) {
        performanceIntersectionObserver.disconnect();
        performanceIntersectionObserver = null;
      }
    });
  }

  function processAllMessages() {
    const container = cachedChatContainer || document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!container) return;
    const messages = Array.from(container.querySelectorAll('.mes'));
    const performanceActive = isPerformanceModeActive(container);
    if (performanceActive) {
      // На старте длинного чата рендерим только последние сообщения. Старые HUD
      // будут обработаны автоматически, когда попадут в область видимости.
      messages.slice(-PERFORMANCE_ACTIVE_WINDOW).forEach(el => safeProcessMessage(el));
      refreshPerformanceMessageClasses();
      setupPerformanceObserver();
    } else {
      messages.forEach(el => safeProcessMessage(el));
    }
  }

  const processingMessages = new WeakSet();
  function safeProcessMessage(messageElement) {
    if (!messageElement || isMessageBeingEdited(messageElement) || processingMessages.has(messageElement)) return;
    processingMessages.add(messageElement);
    Promise.resolve(processMessage(messageElement))
      .catch(error => console.error('HUD Manager: processMessage failed', error))
      .finally(() => processingMessages.delete(messageElement));
  }

  function replaceHudBlockInText(source, newHudText) {
    if (typeof source !== 'string') return source;
    const hudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/i;
    if (hudRegex.test(source)) return source.replace(hudRegex, newHudText);
    return source.trimEnd() + '\n\n' + newHudText;
  }

  function updateMessageDataForCurrentSwipe(message, newText) {
    message.mes = newText;
    if (Array.isArray(message.swipes) && message.swipe_id !== undefined) {
      message.swipes[message.swipe_id] = newText;
    }

    // SillyTavern/другие расширения могут рендерить extra.display_text вместо message.mes.
    // Если display_text уже содержит HUD — заменяем только его.
    // Если HUD создаётся впервые, добавляем его к сохранённому display_text,
    // чтобы updateMessageBlock() не вернул старую версию без HUD.
    if (message.extra && typeof message.extra.display_text === 'string') {
      const displayText = message.extra.display_text;
      const hudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)/i;
      const newHud = extractHudBlock(newText);

      if (hudRegex.test(displayText)) {
        message.extra.display_text = replaceHudBlockInText(displayText, newHud);
      } else if (newHud && hudRegex.test(newHud)) {
        message.extra.display_text = displayText.trimEnd() + '\n\n' + newHud;
      }
    }
  }

  function extractHudBlock(text) {
    if (typeof text !== 'string') return '';
    const match = text.match(/(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/i);
    return match ? match[0] : text;
  }

  function getMessageUpdateFunction(stContext) {
    if (stContext && typeof stContext.updateMessageBlock === 'function') {
      return stContext.updateMessageBlock.bind(stContext);
    }
    if (typeof updateMessageBlock === 'function') return updateMessageBlock;
    if (typeof window.updateMessageBlock === 'function') return window.updateMessageBlock;
    return null;
  }

  async function readHudApiError(response) {
    let payload = null;
    let raw = '';
    try { raw = await response.text(); } catch (_) {}
    if (raw) {
      try { payload = JSON.parse(raw); } catch (_) { payload = null; }
    }
    const message = payload?.error?.message || payload?.message || payload?.error || (typeof payload === 'string' ? payload : '') || raw;
    const clean = String(message || '').replace(/\s+/g, ' ').trim();
    const safe = clean.length > 500 ? clean.slice(0, 500) + '…' : clean;
    const info = { status: response.status, statusText: response.statusText || '', message: safe || `HTTP ${response.status}` };
    window.__tavernOSLastHudApiError = { ...info, timestamp: Date.now() };
    return info;
  }

  async function handleHudRegenButton(regenBtn) {
    if (!regenBtn) return;
    if (regenBtn.classList.contains('hud-spinning')) return;

        const isCreateBtn = regenBtn.classList.contains('hud-create-btn');
        const originalBtnContent = regenBtn.innerHTML;
        
        regenBtn.innerHTML = isCreateBtn 
            ? `<div style="display:flex; align-items:center; gap:6px;"><div class="hud-stars"><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div> Создаю...</div>`
            : `<div class="hud-stars"><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><svg class="hud-star" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>`;
        regenBtn.classList.add('hud-spinning');

        let loadingToast = showHudToast('loading', 'Загрузка', 'HUD генерируется. Подождите.');
        let mesEl = regenBtn.closest('.mes');

        try {
            const mesId = mesEl.getAttribute('mesid');
            const textElement = mesEl.querySelector('.mes_text');
            const extractRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
            
            let stContext = null;
            if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
                stContext = window.SillyTavern.getContext();
            } else if (typeof getContext === 'function') {
                stContext = getContext();
            } else if (typeof window.getContext === 'function') {
                stContext = window.getContext();
            }

            let chatData = null;
            if (stContext && Array.isArray(stContext.chat)) {
                chatData = stContext.chat;
            } else if (typeof chat !== 'undefined' && Array.isArray(chat)) {
                chatData = chat;
            } else if (typeof window.chat !== 'undefined' && Array.isArray(window.chat)) {
                chatData = window.chat;
            }

            let targetMessage = null;
            let mesIdNum = parseInt(mesId, 10);
            
            if (chatData) {
                let foundIndex = chatData.findIndex(m => String(m._id) === String(mesId) || String(m.mesId) === String(mesId));
                if (foundIndex !== -1) {
                    mesIdNum = foundIndex;
                    targetMessage = chatData[foundIndex];
                } else if (!isNaN(mesIdNum) && mesIdNum >= 0 && mesIdNum < chatData.length) {
                    targetMessage = chatData[mesIdNum];
                }
            }

            if (!targetMessage) throw new Error('Не найдено сообщение в chat[].');

            let oldText = '';
            if (targetMessage) {
                if (targetMessage.swipes && targetMessage.swipe_id !== undefined && targetMessage.swipes[targetMessage.swipe_id]) {
                    oldText = targetMessage.swipes[targetMessage.swipe_id];
                } else {
                    oldText = targetMessage.mes || '';
                }
            }
            oldText = oldText.replace(extractRegex, '').trim();

            // Для старых сообщений в текущей вкладке может не существовать lastTavernRequest.
            // В таком случае берём живые настройки Chat Completion из ST вместо обращения
            // к несуществующим переменным currentModel/currentSource/etc.
            const liveOpenAISettings =
                (typeof window !== 'undefined' && window.oai_settings && typeof window.oai_settings === 'object')
                    ? window.oai_settings
                    : {};
            const liveChatCompletionSettings =
                (stContext && stContext.chatCompletionSettings && typeof stContext.chatCompletionSettings === 'object')
                    ? stContext.chatCompletionSettings
                    : {};
            const liveExtensionOpenAI =
                (stContext?.extensionSettings?.openai && typeof stContext.extensionSettings.openai === 'object')
                    ? stContext.extensionSettings.openai
                    : {};

            // HUD regeneration must use the current SillyTavern Chat Completions
            // backend, not the legacy /api/chat/completions route captured from an
            // older request. The latter is not the generation endpoint in current ST
            // and can return 403. The captured request is still useful as a source of
            // provider/model/token settings, but its URL is deliberately NOT reused.
            const sourceBody = window.lastTavernRequest?.body;
            const reqBody = sourceBody && typeof sourceBody === 'object' ? sourceBody : {};
            const requestUrl = '/api/backends/chat-completions/generate';
            const requestHeaders =
                (typeof window.getRequestHeaders === 'function' ? window.getRequestHeaders() : null) ||
                { 'Content-Type': 'application/json' };

            // SillyTavern stores provider/model selections in source-specific fields.
            // See the default Chat Completion preset: chat_completion_source plus
            // openai_model / google_model / vertexai_model / custom_model, etc.
            const currentSource = String(
                reqBody.chat_completion_source ||
                liveChatCompletionSettings.chat_completion_source ||
                liveExtensionOpenAI.chat_completion_source ||
                liveOpenAISettings.chat_completion_source ||
                ''
            );
            const currentModel = String(
                reqBody.model ||
                liveChatCompletionSettings.model ||
                liveChatCompletionSettings.openai_model ||
                liveChatCompletionSettings.google_model ||
                liveChatCompletionSettings.vertexai_model ||
                liveChatCompletionSettings.openrouter_model ||
                liveChatCompletionSettings.custom_model ||
                liveExtensionOpenAI.model ||
                liveExtensionOpenAI.openai_model ||
                liveExtensionOpenAI.google_model ||
                liveExtensionOpenAI.vertexai_model ||
                liveExtensionOpenAI.openrouter_model ||
                liveExtensionOpenAI.custom_model ||
                liveOpenAISettings.model ||
                liveOpenAISettings.openai_model ||
                liveOpenAISettings.google_model ||
                liveOpenAISettings.vertexai_model ||
                liveOpenAISettings.openrouter_model ||
                liveOpenAISettings.custom_model ||
                ''
            );
            const currentChatSettings = liveChatCompletionSettings;
            const currentOpenAISettings = liveExtensionOpenAI;
            const globalOpenAISettings = liveOpenAISettings;

            let freshMessages = [];
            // Only real chat-history messages are eligible for HUD summarization.
            // Injected HUD instructions contain a literal [HUD] schema example, which
            // must NEVER be mistaken for an actual historical HUD block.
            const hudSummaryEligibleMessages = new Set();

            // Сколько сообщений истории уходит в регенерацию. Раньше при 0 или
            // нечитаемом значении startIndex обнулялся и в запрос улетал ВЕСЬ чат.
            const parsedKeep = parseInt(settings.regenContextMessages, 10);
            const keepN = Number.isFinite(parsedKeep) && parsedKeep > 0
                ? Math.min(parsedKeep, 50)
                : (defaultSettings.regenContextMessages || 6);
            const startIndex = Math.max(0, mesIdNum - keepN + 1);

            function getHudConnectionProfile(profileId) {
                try {
                    const cm = stContext?.extensionSettings?.connectionManager;
                    const profiles = Array.isArray(cm?.profiles) ? cm.profiles : [];
                    return profileId ? (profiles.find(p => String(p.id) === String(profileId)) || null) : null;
                } catch (_) { return null; }
            }

            function metadataLooksLikeGemini(value, depth = 0) {
                if (!value || typeof value !== 'object' || depth > 2) return false;
                const keys = ['api_type', 'api-type', 'apiType', 'type', 'source', 'provider', 'api', 'name', 'model'];
                for (const key of keys) {
                    const field = value[key];
                    if (typeof field === 'string') {
                        const lower = field.toLowerCase();
                        if (lower.includes('gemini') || lower.includes('makersuite') || lower.includes('google')) return true;
                    } else if (field && typeof field === 'object' && metadataLooksLikeGemini(field, depth + 1)) {
                        return true;
                    }
                }
                return false;
            }

            const selectedProfile = getHudConnectionProfile(settings.regenProfileId);
            const backendMetadata = [
                selectedProfile,
                reqBody,
                stContext?.chatCompletionSettings,
                stContext?.extensionSettings?.connectionManager,
                stContext?.extensionSettings?.openai,
                stContext?.extensionSettings?.gemini,
                currentChatSettings,
                currentOpenAISettings,
                globalOpenAISettings,
            ];
            const requestModel = String(reqBody?.model || selectedProfile?.model || currentModel || '');
            const modelName = requestModel.toLowerCase();
            const requestUrlLower = String(requestUrl || '').toLowerCase();
            const isGeminiBackend = backendMetadata.some(metadataLooksLikeGemini)
                || modelName.includes('gemini')
                || requestUrlLower.includes('generativelanguage.googleapis.com')
                || requestUrlLower.includes('/gemini');
            const regenRoleForBackend = (role) => {
                if (role === 'system') return isGeminiBackend ? 'user' : 'system';
                if (role === 'assistant') return isGeminiBackend ? 'model' : 'assistant';
                return 'user';
            };
            // НЕ подмешиваем системное сообщение из захваченного запроса ST.
            // Раньше сюда уезжал весь пресет SillyTavern вместе с его World Info,
            // и он заглушал наш HUD-контракт и лорбук, выбранный в настройках.
            // Регенерации нужен только strictBasePrompt + hudExternalContext ниже.
            // IMPORTANT: HUD Regen must receive the FULL HUD contract, not only a short
            // command. The previous version sent only strictBasePrompt, which left the
            // model without the complete schema/field definitions and caused it to return
            // an all-empty HUD. Reuse the exact same dynamic HUD prompt as normal chat
            // generation, then add the Regen-specific instruction.
            const strictBasePrompt = buildDynamicPrompt() + "\n\n<system_note>REGEN OVERRIDE (CRITICAL): Read the recent conversation below and produce a fresh, fully updated [HUD] block for the current state. Recalculate all fields from the available narrative and persistent context. Preserve continuity instead of replacing known facts with empty values. Output ONLY the HUD block and nothing else.</system_note>";

            for (let i = startIndex; i <= mesIdNum; i++) {
            let msg = chatData[i];
            if (!msg) continue;
            let role = regenRoleForBackend(msg.is_user ? 'user' : 'assistant');
            let content = msg.swipes && msg.swipes[msg.swipe_id] !== undefined ? msg.swipes[msg.swipe_id] : msg.mes;
            
            if (i === mesIdNum) {
                // У текущего сообщения вырезаем старый HUD полностью, так как будем генерировать новый
                content = content.replace(extractRegex, '').trim();
                if (content.length > 0) {
                    const message = { role: regenRoleForBackend('assistant'), content: content };
                    freshMessages.push(message);
                    hudSummaryEligibleMessages.add(message);
                }
                // strictPrompt ещё не существует на этой стадии: Lorebook-контекст
                // рассчитывается после сборки истории. Ставим базовый маркер, а ниже
                // он будет заменён на полный strictPrompt + HUD lore context.
                freshMessages.push({ role: regenRoleForBackend('user'), content: strictBasePrompt });
            } else {
                // В старых сообщениях оставляем текст как есть, чтобы скрипт ниже смог найти и сжать HUD
                if (content.trim().length > 0) {
                    const message = { role: role, content: content.trim() };
                    freshMessages.push(message);
                    hudSummaryEligibleMessages.add(message);
                }
            }
        }

        const loreScanText = freshMessages.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
        const hudExternalContext = await buildHudLoreContext(loreScanText);
        const strictPrompt = strictBasePrompt + hudExternalContext;
        let strictPromptMessage = null;
        for (let i = freshMessages.length - 1; i >= 0; i--) {
            const candidate = freshMessages[i];
            if (candidate && candidate.role === regenRoleForBackend('user') && candidate.content === strictBasePrompt) {
                strictPromptMessage = candidate;
                break;
            }
        }
        if (strictPromptMessage) strictPromptMessage.content = strictPrompt;
        else freshMessages.push({ role: regenRoleForBackend('user'), content: strictPrompt });

        // --- ЛОГИКА САММАРИ ДЛЯ РЕГЕНЕРАЦИИ ---
        const buildSummaryTextRegen = (hudText) => {
            let parsedObj = parseHUDComplex(hudText);
            let summaryStr = `[HUD_SUMMARY] `;
            
            if (parsedObj.scene && parsedObj.scene['Время']) summaryStr += `Время: ${parsedObj.scene['Время']}. `;
            if (parsedObj.scene && parsedObj.scene['Погода']) summaryStr += `Погода: ${parsedObj.scene['Погода']}. `;
            
            let cSums = [];
            if (parsedObj.characters) {
                parsedObj.characters.forEach(c => {
                    if (c['Имя']) {
                        let details = [];
                        if (c['Возраст'] && String(c['Возраст']).toLowerCase() !== 'empty' && String(c['Возраст']).toLowerCase() !== 'none') details.push(`Возраст: ${c['Возраст']}`);
                        if (c['Место'] && String(c['Место']).toLowerCase() !== 'empty' && String(c['Место']).toLowerCase() !== 'none') details.push(`Место: ${c['Место']}`);
                        cSums.push(details.length > 0 ? `${c['Имя']} (${details.join(', ')})` : c['Имя']);
                    }
                });
            }
            if (parsedObj.user) {
                let uDetails = [];
                if (parsedObj.user['Возраст'] && String(parsedObj.user['Возраст']).toLowerCase() !== 'empty' && String(parsedObj.user['Возраст']).toLowerCase() !== 'none') uDetails.push(`Возраст: ${parsedObj.user['Возраст']}`);
                if (parsedObj.user['Место'] && String(parsedObj.user['Место']).toLowerCase() !== 'empty' && String(parsedObj.user['Место']).toLowerCase() !== 'none') uDetails.push(`Место: ${parsedObj.user['Место']}`);
                if (uDetails.length > 0) cSums.push(`User (${uDetails.join(', ')})`);
                else if (Object.keys(parsedObj.user).length > 0) cSums.push(`User`);
            }
            if (cSums.length > 0) summaryStr += cSums.join('; ') + ` `;
            
            return summaryStr + `[/HUD_SUMMARY]`;
        };

        let allMatchesRegen = [];
        freshMessages.forEach((msg, mIdx) => {
            // Do not scan injected system/HUD instructions. buildDynamicPrompt()
            // intentionally contains a literal [HUD] schema example. Scanning it here
            // makes the regen code try to parse its own instructions as an old HUD,
            // which can fail BEFORE the API request is even sent.
            if (!hudSummaryEligibleMessages.has(msg)) return;
            if (typeof msg.content === 'string') {
                const regexLocal = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)([\s\S]*?)(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/ig;
                let match;
                while ((match = regexLocal.exec(msg.content)) !== null) {
                    allMatchesRegen.push({ mIdx, index: match.index, length: match[0].length });
                }
            }
        });

        let hudsToKeep = parseInt(settings.hudsToKeep, 10);
        if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = 2;
        
        if (allMatchesRegen.length > hudsToKeep) {
            let toSummarize = allMatchesRegen.slice(0, allMatchesRegen.length - hudsToKeep);
            // Сортируем с конца в начало, чтобы не сбить индексы при замене текста
            toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));
            
            toSummarize.forEach(rm => {
                let content = freshMessages[rm.mIdx].content;
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                
                freshMessages[rm.mIdx].content = content.slice(0, rm.index) + '\n' + buildSummaryTextRegen(hudBlockText) + '\n' + content.slice(rm.index + rm.length);
            });
        }

        let aiText = '';
        const hudMaxTokens = Math.max(256, Math.min(32768, parseInt(settings.hudMaxTokens, 10) || 8192));

        // Тело переиспользуем от последнего рабочего запроса ST: провайдер-специфичные
        // поля (ключи, прокси, семплеры) нужны, иначе часть бэкендов отвергает запрос.
        // НО из клона вычищаем всё, что несёт ТЕКСТ промпта: иначе вместе с настройками
        // соединения уезжает весь пресет SillyTavern, его World Info и карточка,
        // и наш HUD-контракт с выбранным лорбуком тонет в этом объёме.
        const HUD_PROMPT_FIELDS = [
            'prompt', 'prompts', 'prompt_order', 'system_prompt', 'main_prompt',
            'nsfw_prompt', 'jailbreak_prompt', 'impersonation_prompt', 'new_chat_prompt',
            'new_group_chat_prompt', 'new_example_chat_prompt', 'continue_nudge_prompt',
            'group_nudge_prompt', 'negative_prompt', 'assistant_prefill',
            'assistant_impersonation', 'human_sysprompt_message',
            'char_name', 'user_name', 'char_description', 'char_personality',
            'scenario', 'persona_description', 'world_info', 'worldInfoBefore',
            'worldInfoAfter', 'wi_format', 'scenario_format', 'personality_format',
            'bias_preset_selected', 'extensions',
        ];
        const capturedBody = (window.lastTavernRequest?.body && typeof window.lastTavernRequest.body === 'object')
            ? window.lastTavernRequest.body : null;
        const hudRequestBody = capturedBody ? JSON.parse(JSON.stringify(capturedBody)) : {};
        HUD_PROMPT_FIELDS.forEach(k => { delete hudRequestBody[k]; });
        hudRequestBody.messages = freshMessages;
        hudRequestBody.stream = false;
        if (requestModel) hudRequestBody.model = requestModel;
        const hudSource = String(reqBody?.chat_completion_source || currentSource || '');
        if (hudSource) hudRequestBody.chat_completion_source = hudSource;
        if (Object.prototype.hasOwnProperty.call(hudRequestBody, 'max_new_tokens')) hudRequestBody.max_new_tokens = hudMaxTokens;
        else hudRequestBody.max_tokens = hudMaxTokens;

        // Страховка от НЕИЗВЕСТНЫХ текстовых полей. Список HUD_PROMPT_FIELDS
        // перечисляет то, что мы знаем сегодня; завтра ST или провайдер могут
        // добавить своё поле с текстом промпта, и оно снова уедет в регенерацию.
        // Настройки соединения — это имена моделей, URL, числа и флаги; длинных
        // строк среди них не бывает. Поэтому всё, что длиннее порога и не входит
        // в белый список, из клона вычищаем.
        const HUD_ALLOWED_LONG_FIELDS = new Set(['messages', 'reverse_proxy', 'proxy_password', 'custom_url']);
        const HUD_LONG_FIELD_LIMIT = 400;
        Object.keys(hudRequestBody).forEach(key => {
            if (HUD_ALLOWED_LONG_FIELDS.has(key)) return;
            const value = hudRequestBody[key];
            if (typeof value === 'string' && value.length > HUD_LONG_FIELD_LIMIT) delete hudRequestBody[key];
        });

        // Размер запроса — единственный честный ответ на вопрос «а не уехал ли
        // туда пресет?». Считаем то, что реально уходит на провайдер.
        const hudPromptChars = freshMessages.reduce(
            (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
        const hudPayloadStats = {
            сообщений: freshMessages.length,
            символов: hudPromptChars,
            'полей в теле': Object.keys(hudRequestBody).join(', '),
        };
        console.info('[TavernOS HUD] Регенерация: что уходит на провайдер', hudPayloadStats);

        if (settings.regenProfileId && stContext && stContext.ConnectionManagerRequestService && typeof stContext.ConnectionManagerRequestService.sendRequest === 'function') {
            // ConnectionManagerRequestService accepts a ChatMessage[] as its prompt.
            // Disable preset/instruct injection so the selected profile supplies only
            // the connection details; our HUD messages remain the actual prompt.
            const profileResult = await stContext.ConnectionManagerRequestService.sendRequest(
                settings.regenProfileId,
                freshMessages,
                hudMaxTokens,
                { stream: false, includePreset: false, includeInstruct: false }
            );
            if (typeof profileResult === 'string') aiText = profileResult;
            else if (profileResult && profileResult.choices && profileResult.choices[0]) aiText = profileResult.choices[0].message ? profileResult.choices[0].message.content : profileResult.choices[0].text;
            else if (profileResult && Array.isArray(profileResult.content)) aiText = profileResult.content.map(c => c.text).join('');
            else if (profileResult && typeof profileResult.content === 'string') aiText = profileResult.content;
            else if (profileResult && profileResult.text) aiText = profileResult.text;
            else aiText = JSON.stringify(profileResult);
        } else {
            let res;
            window.__tavernOSHudRegenRequest = true;
            try {
                res = await fetch(requestUrl, { method: 'POST', headers: requestHeaders, cache: 'no-cache', body: JSON.stringify(hudRequestBody) });
            } finally {
                window.__tavernOSHudRegenRequest = false;
            }
            if (!res.ok) {
                const apiError = await readHudApiError(res);
                throw new Error(`API Error ${apiError.status}: ${apiError.message}`);
            }
            const data = await res.json();
            if (data.choices && data.choices[0]) aiText = data.choices[0].message ? data.choices[0].message.content : data.choices[0].text;
            else if (data.content && Array.isArray(data.content)) aiText = data.content.map(c => c.text).join('');
            else if (data.text) aiText = data.text;
            else if (data.candidates && data.candidates[0] && data.candidates[0].content) aiText = data.candidates[0].content.parts.map(p => p.text).join('');
            else aiText = JSON.stringify(data);
        }

            let newHudText = repairGeneratedHudBlock(aiText);

            let updatedFullText = replaceHudBlockInText(oldText, newHudText);

            updateMessageDataForCurrentSwipe(targetMessage, updatedFullText);

            const saveFn =
                (stContext && typeof stContext.saveChatConditional === 'function') ? stContext.saveChatConditional.bind(stContext) :
                (stContext && typeof stContext.saveChat === 'function') ? stContext.saveChat.bind(stContext) :
                (typeof saveChatConditional === 'function') ? saveChatConditional :
                (typeof window.saveChatConditional === 'function') ? window.saveChatConditional :
                (typeof window.saveChat === 'function') ? window.saveChat : null;

            const updateFn = getMessageUpdateFunction(stContext);

            if (updateFn) {
                await Promise.resolve(updateFn(mesIdNum, targetMessage, { rerenderMessage: true }));
            } else {
                textElement.innerHTML = updatedFullText;
            }

            // После штатного обновления ST повторно обрабатываем только HUD.
            // Сам message DOM SillyTavern не пересоздаём.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const freshMesEl = document.querySelector(`.mes[mesid="${mesId}"]`) || mesEl;
                    if (freshMesEl && freshMesEl.isConnected) {
                        freshMesEl.removeAttribute('data-hud-processed');
                        safeProcessMessage(freshMesEl);
                    }
                });
            });

            if (loadingToast) {
                loadingToast.classList.add('hide');
                setTimeout(() => loadingToast.remove(), 400);
            }

            showHudToast('success', 'Успех',
                `HUD вшит в сообщение. В запрос ушло ${freshMessages.length} сообщ., ${Math.round(hudPromptChars / 1000)} тыс. символов — пресет SillyTavern не отправляется.`);

            if (saveFn) {
                saveFn().catch(saveErr => showHudToast('error', 'Не сохранено', 'HUD показан, но не записан: ' + saveErr.message));
            } else {
                showHudToast('error', 'Не сохранено', 'Функция сохранения чата не найдена.');
            }

        } catch (err) {
            if (loadingToast) {
                loadingToast.classList.add('hide');
                setTimeout(() => loadingToast.remove(), 400);
            }
            showHudToast('error', 'Ошибка', 'Не удалось обновить HUD: ' + err.message);
        } finally {
            if (regenBtn.isConnected) {
                regenBtn.innerHTML = originalBtnContent;
                regenBtn.classList.remove('hud-spinning');
            } else {
                const strandedBtn = mesEl && mesEl.querySelector('.hud-regen-btn.hud-spinning');
                if (strandedBtn) strandedBtn.classList.remove('hud-spinning');
            }
        }
        return;
  }

  function bindHudRegenButton(regenBtn) {
    if (!regenBtn || regenBtn.dataset.hudClickBound === 'true') return;
    regenBtn.dataset.hudClickBound = 'true';

    const invoke = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      void handleHudRegenButton(regenBtn);
    };

    // Direct listener remains useful when ST does not intercept the event.
    regenBtn.addEventListener('click', invoke, true);
    regenBtn.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      invoke(e);
    }, true);
  }


  function addSettingsUI() {
    if (document.getElementById('hud-settings-wrapper')) return;
    const container = document.getElementById('extensions_settings') || document.getElementById('rm_extensions_block') || document.body;
    if (!container) return;
    const wrapper = document.createElement('details');
    wrapper.id = 'hud-settings-wrapper';
    wrapper.className = 'hud-settings-block';
    wrapper.innerHTML = `
      <summary style="font-weight:bold; cursor:pointer; color:var(--hud-accent); outline: none;">📊 TavernOS v${hudVersionLabel()}</summary>
      <div style="padding-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">

      <details class="hud-set-group"><summary>🧩 Блоки HUD</summary><div class="hud-set-body">
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-auto-inject" ${settings.autoInject ? 'checked' : ''}> Сетевой перехват (Инжект промпта)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-phone" ${settings.enablePhone ? 'checked' : ''}> 📱 Личный телефон</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-intercepts" ${settings.enableIntercepts ? 'checked' : ''}> 📡 Перехваты (Чужие телефоны)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-diary" ${settings.enableDiary ? 'checked' : ''}> 📖 Дневник</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-dreams" ${settings.enableDreams ? 'checked' : ''}> 🌙 Сновидения</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" id="hud-enable-world" ${settings.enableWorld ? 'checked' : ''}> 🌍 Мир (Новости, слухи)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Отдельный блок {{user}}: одежда, внешность, здоровье, отношения, локация."><input type="checkbox" id="hud-enable-user" ${settings.enableUserBlock ? 'checked' : ''}> {{user}} — блок игрока</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Таймлайн, настроение двух главных персонажей, маршруты и секреты"><input type="checkbox" id="hud-enable-memory" ${settings.enableMemory ? 'checked' : ''}> 🧠 Память (события, настроение, маршрут, секреты)</label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="При 200+ сообщениях отключает тяжёлую повторную обработку старых сообщений, замораживает их анимации/эффекты и обрабатывает HUD по мере прокрутки."><input type="checkbox" id="hud-performance-mode" ${settings.performanceMode ? 'checked' : ''}> ⚡ Performance Mode (200+ сообщений)</label>
        <div style="font-size:11px;opacity:.68;">Автоматически включается только в чатах от 200 сообщений. Старые блоки остаются функциональными и догружаются при прокрутке.</div>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">📏 Максимальная высота Памяти: <input type="number" id="hud-memory-max-height" min="200" max="600" value="${settings.memoryMaxHeight}" style="width:70px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:2px 4px; border-radius:4px;"> px</label>
      </div></details>

      <details class="hud-set-group"><summary>🖼️ Аватарки персонажей</summary><div class="hud-set-body">
        <div style="font-size:12px; opacity:.78;">Одна картинка — на любое число имён: впишите их через запятую, вместе с английским написанием. Аватарка встанет всюду, где сейчас кружок с инициалами: блок персонажей, чаты телефона, перехваты.</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="hud-ava-add" style="cursor:pointer;">➕ Добавить изображение</button>
          <span id="hud-ava-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <div id="hud-ava-list" class="hud-ava-list"></div>
        <div style="font-size:12px; opacity:.78; margin-top:2px;">Закреплённые аватарки — страховка на случай, когда картинка из чата достаётся не тому: если у {{char}} указаны имена, никто, кроме них, его фото уже не получит.</div>
        <div id="hud-ava-pinned" class="hud-ava-list"></div>
        <input type="file" id="hud-ava-file" accept="image/*" style="display:none">
      </div></details>

      <details class="hud-set-group"><summary>📚 Лорбуки и генерация</summary><div class="hud-set-body">
        <div style="font-size:12px; opacity:.78;">Выбери один или несколько. Их записи + описание карточки чара + Persona добавляются только в отдельный запрос создания/регенерации HUD. Обычный HUD-инжект не меняется.</div>
        <select id="hud-lorebooks" multiple size="6" style="width:100%; min-height:110px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:4px; border-radius:5px;"></select>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" id="hud-lorebooks-refresh" style="cursor:pointer;">🔄 Обновить список</button>
          <button type="button" id="hud-lorebooks-clear" style="cursor:pointer;">Очистить выбор</button>
          <span id="hud-lorebooks-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Отдельный лимит токенов только для запроса создания/регенерации HUD.">
          🧠 Лимит токенов HUD: <input type="number" id="hud-max-tokens" min="256" max="32768" value="${settings.hudMaxTokens}" style="width:70px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:2px 4px; border-radius:4px;">
        </label>
        <div style="border-top: 1px solid var(--hud-border); margin: 6px 0;"></div>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Оставляет сводку [HUD_SUMMARY] вместо старых блоков. Если ставишь 2 — то 2 последних будут полными HUD, а все что старше превратятся в сводку памяти. 0 = даже самый свежий HUD будет сжат в сводку (модель не увидит полный JSON последнего состояния — не рекомендуется).">
          💾 Сколько развернутых HUD оставлять: <input type="number" id="hud-keep-count" min="0" max="10" value="${settings.hudsToKeep}" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
        </label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Сколько последних сообщений отправлять модели при нажатии на 🔄 (регенерация HUD). 0 = отправлять всю историю чата до этого сообщения.">
          ⚡ При регене HUD слать последние <input type="number" id="hud-regen-context" min="0" max="50" value="${settings.regenContextMessages}" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;"> сообщ.
        </label>
        <label style="display:flex; align-items:center; gap:10px; cursor:pointer;" title="Позволяет перегенерировать HUD (🔄) через ДРУГОЙ сохранённый профиль подключения">
          🧠 Профиль для регена HUD:
          <select id="hud-regen-profile" style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="">Основной (текущий активный)</option>
          </select>
          <span id="hud-regen-profile-refresh" title="Обновить список профилей" style="cursor:pointer;">🔄</span>
        </label>
      </div></details>

      </div>`;
    container.appendChild(wrapper);

    // --- Ручные аватарки ---------------------------------------------------
    // Картинку ужимаем до квадрата 128px и кладём как JPEG data-URL. Настройки
    // SillyTavern хранятся одним JSON-файлом, поэтому оригинал на несколько
    // мегабайт туда класть нельзя — а для кружка аватарки 128px хватает с
    // запасом (выходит около 6-10 КБ на картинку).
    function hudShrinkImage(file, max = 128) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error('Это не изображение'));
        if (file.size > 8 * 1024 * 1024) return reject(new Error('Файл больше 8 МБ'));
        const fr = new FileReader();
        fr.onerror = () => reject(new Error('Не удалось прочитать файл'));
        fr.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Не удалось открыть картинку'));
          img.onload = () => {
            try {
              const side = Math.min(img.width, img.height);
              const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
              const c = document.createElement('canvas');
              c.width = c.height = max;
              c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, max, max);
              resolve(c.toDataURL('image/jpeg', 0.82));
            } catch (err) { reject(new Error('Не удалось обработать картинку')); }
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    }

    // Аватарки участвуют в уже отрисованных HUD, поэтому после правки
    // сбрасываем кэш и просим перерисовать блоки заново.
    function refreshHudAvatars() {
      invalidateAvatarCache();
      refreshAvatarFaces();
    }

    function avaRow(entry, role) {
      const img = role === 'char' ? settings.avatarCharImg : role === 'user' ? settings.avatarUserImg : entry.img;
      const names = role === 'char' ? settings.avatarCharNames
        : role === 'user' ? settings.avatarUserNames
        : role === 'npc' ? entry.names : '';
      const label = role === 'char' ? '{{char}}' : role === 'user' ? '{{user}}' : '';
      const thumb = img
        ? `<span class="hud-ava-thumb" style="background-image:url('${img}')"></span>`
        : '<span class="hud-ava-thumb is-empty">?</span>';
      const placeholder = role === 'char' ? 'Имена {{char}} через запятую'
        : role === 'user' ? 'Имена {{user}} через запятую'
        : 'Арес Бомонт, Ares Beaumont';
      const nameField = `<input type="text" class="hud-ava-names" value="${escapeHtml(names || '')}" placeholder="${placeholder}">`;
      return `<div class="hud-ava-row" data-ava-role="${role}" data-ava-id="${entry && entry.id ? escapeHtml(entry.id) : ''}">
        ${label ? `<span class="hud-ava-tag">${label}</span>` : ''}
        ${thumb}${nameField}
        <button type="button" class="hud-ava-btn hud-ava-replace" title="Заменить картинку">🔄</button>
        <button type="button" class="hud-ava-btn hud-ava-del" title="${role === 'npc' ? 'Удалить запись' : 'Убрать картинку'}">🗑️</button>
      </div>`;
    }

    function renderAvatarRows() {
      const list = document.getElementById('hud-ava-list');
      const pinned = document.getElementById('hud-ava-pinned');
      if (!list || !pinned) return;
      const rows = Array.isArray(settings.avatarOverrides) ? settings.avatarOverrides : [];
      list.innerHTML = rows.length
        ? rows.map(e => avaRow(e, 'npc')).join('')
        : '<div class="hud-ava-empty">Пока ни одной. Нажмите «Добавить изображение».</div>';
      pinned.innerHTML = avaRow(null, 'char') + avaRow(null, 'user');
    }

    // Какую запись сейчас правим: null — создаём новую.
    let avaTarget = null;
    const avaFile = document.getElementById('hud-ava-file');
    const avaStatus = document.getElementById('hud-ava-status');
    const avaSay = (msg) => { if (avaStatus) avaStatus.textContent = msg || ''; };

    if (avaFile) {
      document.getElementById('hud-ava-add').addEventListener('click', () => {
        avaTarget = { mode: 'new' };
        avaFile.value = ''; avaFile.click();
      });

      avaFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !avaTarget) return;
        avaSay('Обрабатываю…');
        try {
          const dataUrl = await hudShrinkImage(file);
          if (avaTarget.mode === 'new') {
            if (!Array.isArray(settings.avatarOverrides)) settings.avatarOverrides = [];
            settings.avatarOverrides.push({ id: 'ava' + Date.now().toString(36), img: dataUrl, names: '' });
          } else if (avaTarget.role === 'char') settings.avatarCharImg = dataUrl;
          else if (avaTarget.role === 'user') settings.avatarUserImg = dataUrl;
          else {
            const row = (settings.avatarOverrides || []).find(r => r.id === avaTarget.id);
            if (row) row.img = dataUrl;
          }
          saveSettings(); renderAvatarRows(); refreshHudAvatars();
          avaSay('Готово, ' + Math.round(dataUrl.length / 1024) + ' КБ');
        } catch (err) {
          avaSay('');
          showHudToast('error', 'Картинка не подошла', err.message || 'Не удалось обработать файл.');
        }
        avaTarget = null;
      });
    }

    const avaHost = document.getElementById('hud-settings-wrapper');
    if (avaHost) {
      avaHost.addEventListener('click', (e) => {
        const row = e.target.closest('.hud-ava-row');
        if (!row) return;
        const role = row.dataset.avaRole, id = row.dataset.avaId;
        if (e.target.closest('.hud-ava-replace')) {
          avaTarget = { mode: 'edit', role, id };
          avaFile.value = ''; avaFile.click();
          return;
        }
        if (e.target.closest('.hud-ava-del')) {
          if (role === 'char') { settings.avatarCharImg = ''; settings.avatarCharNames = ''; }
          else if (role === 'user') { settings.avatarUserImg = ''; settings.avatarUserNames = ''; }
          else settings.avatarOverrides = (settings.avatarOverrides || []).filter(r => r.id !== id);
          saveSettings(); renderAvatarRows(); refreshHudAvatars();
          avaSay('');
        }
      });
      avaHost.addEventListener('input', (e) => {
        const field = e.target.closest('.hud-ava-names');
        if (!field) return;
        const row = field.closest('.hud-ava-row');
        if (row.dataset.avaRole === 'char') settings.avatarCharNames = field.value;
        else if (row.dataset.avaRole === 'user') settings.avatarUserNames = field.value;
        else {
          const entry = (settings.avatarOverrides || []).find(r => r.id === row.dataset.avaId);
          if (entry) entry.names = field.value;
        }
        saveSettings(); refreshHudAvatars();
      });
    }
    renderAvatarRows();

    const bgUrlInput = document.getElementById('hud-bg-url-input');
    const bgUploadBtn = document.getElementById('hud-bg-upload-btn');
    const bgUploadFile = document.getElementById('hud-bg-upload-file');
	

    if (bgUrlInput && bgUploadBtn && bgUploadFile) {
        // 1. Загрузка через URL
        bgUrlInput.addEventListener('change', (e) => {
            const url = e.target.value.trim();
            if (!url) {
                settings.bgImage = ''; saveSettings(); applyThemeColors(); return;
            }
            showHudToast('loading', 'Проверка...', 'Пытаемся загрузить картинку...');
            const img = new Image();
            img.onload = () => {
                settings.bgImage = url; saveSettings(); applyThemeColors();
                showHudToast('success', 'Фон загружен', 'Картинка по ссылке успешно установлена.');
            };
            img.onerror = () => {
                showHudToast('error', 'Ошибка ссылки', 'Не удалось загрузить! Сайт заблокировал доступ (CORS) или ссылка битая.');
                e.target.value = settings.bgImage; // Откатываем текст обратно
            };
            img.src = url;
        });

        // 2. Загрузка из локальной галереи
        bgUploadBtn.addEventListener('click', () => bgUploadFile.click());
        bgUploadFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Защита от переполнения памяти браузера (~3 МБ)
            if (file.size > 3 * 1024 * 1024) {
                showHudToast('error', 'Слишком большой файл', 'Выберите картинку до 3 МБ, иначе настройки сломаются.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target.result;
                settings.bgImage = base64;
                bgUrlInput.value = '(Локальный файл)';
                saveSettings();
                applyThemeColors();
                showHudToast('success', 'Фон загружен', 'Ваша картинка успешно установлена.');
            };
            reader.readAsDataURL(file);
        });
    }
    // === КОНЕЦ ЛОГИКИ ФОНА ===

    document.getElementById('hud-auto-inject').addEventListener('change', (e) => { settings.autoInject = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-phone').addEventListener('change', (e) => { settings.enablePhone = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-intercepts').addEventListener('change', (e) => { settings.enableIntercepts = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-diary').addEventListener('change', (e) => { settings.enableDiary = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-dreams').addEventListener('change', (e) => { settings.enableDreams = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-world').addEventListener('change', (e) => { settings.enableWorld = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-user').addEventListener('change', (e) => { settings.enableUserBlock = e.target.checked; saveSettings(); });
    
    // === ВОТ СЮДА ВСТАВЛЯЕМ НАШУ НОВУЮ ГАЛОЧКУ ===
    document.getElementById('hud-enable-memory').addEventListener('change', (e) => { settings.enableMemory = e.target.checked; saveSettings(); });
    document.getElementById('hud-performance-mode').addEventListener('change', (e) => {
      settings.performanceMode = e.target.checked;
      saveSettings();
      updatePerformanceMode();
      setupPerformanceObserver();
      processAllMessages();
    });
    document.getElementById('hud-memory-max-height').addEventListener('change', (e) => { let v=parseInt(e.target.value,10); if(isNaN(v)) v=300; v=Math.max(200,Math.min(600,v)); settings.memoryMaxHeight=v; e.target.value=v; saveSettings(); applyThemeColors(); });
    

    populateHudLorebookSelect();
    document.getElementById('hud-lorebooks-refresh').addEventListener('click', populateHudLorebookSelect);
    document.getElementById('hud-lorebooks-clear').addEventListener('click', () => {
      const select = document.getElementById('hud-lorebooks');
      if (select) Array.from(select.options).forEach(o => { o.selected = false; });
      settings.hudLorebooks = []; saveSettings(); updateHudLorebookStatus();
    });
    document.getElementById('hud-lorebooks').addEventListener('change', (e) => {
      settings.hudLorebooks = Array.from(e.target.selectedOptions).map(o => o.value);
      saveSettings(); updateHudLorebookStatus();
    });
    document.getElementById('hud-max-tokens').addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 256) val = 256; if (val > 32768) val = 32768;
      settings.hudMaxTokens = val; e.target.value = val; saveSettings();
    });

    document.getElementById('hud-keep-count').addEventListener('change', (e) => { 
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0; if (val > 10) val = 10;
      settings.hudsToKeep = val; e.target.value = val; saveSettings(); 
    });
    document.getElementById('hud-regen-context').addEventListener('change', (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val) || val < 0) val = 0; if (val > 50) val = 50;
      settings.regenContextMessages = val; e.target.value = val; saveSettings();
    });

    populateRegenProfileSelect();
    document.getElementById('hud-regen-profile-refresh').addEventListener('click', populateRegenProfileSelect);
    document.getElementById('hud-regen-profile').addEventListener('change', (e) => {
      settings.regenProfileId = e.target.value || '';
      saveSettings();
    });
  }


  async function populateHudLorebookSelect() {
    const select = document.getElementById('hud-lorebooks');
    const status = document.getElementById('hud-lorebooks-status');
    if (!select) return;
    const previous = new Set(Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks : []);
    if (status) status.textContent = 'Загрузка...';
    const names = await getAvailableHudLorebooks();
    select.innerHTML = '';
    names.forEach(name => {
      const option = document.createElement('option');
      option.value = name; option.textContent = name; option.selected = previous.has(name);
      select.appendChild(option);
    });
    settings.hudLorebooks = names.filter(name => previous.has(name));
    saveSettings(); updateHudLorebookStatus();
  }

  function updateHudLorebookStatus() {
    const status = document.getElementById('hud-lorebooks-status');
    if (!status) return;
    const count = Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks.length : 0;
    status.textContent = count ? `Выбрано: ${count}` : 'Ничего не выбрано';
  }

  function populateRegenProfileSelect() {
    const select = document.getElementById('hud-regen-profile');
    if (!select) return;
    let stContext = null;
    if (typeof window.SillyTavern !== 'undefined' && typeof window.SillyTavern.getContext === 'function') {
      stContext = window.SillyTavern.getContext();
    } else if (typeof getContext === 'function') {
      stContext = getContext();
    } else if (typeof window.getContext === 'function') {
      stContext = window.getContext();
    }
    const profiles = stContext && stContext.extensionSettings && stContext.extensionSettings.connectionManager
      ? (stContext.extensionSettings.connectionManager.profiles || [])
      : [];

    const prevValue = settings.regenProfileId || '';
    select.innerHTML = `<option value="">Основной (текущий активный)</option>`;
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      select.appendChild(opt);
    });
    select.value = profiles.some(p => p.id === prevValue) ? prevValue : '';
    if (select.value !== prevValue) { settings.regenProfileId = select.value; saveSettings(); }

    if (!profiles.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.disabled = true;
      opt.textContent = '(Connection Manager не найден или профилей нет)';
      select.appendChild(opt); // раньше опция создавалась, но не добавлялась в select — была мёртвым кодом
    }
  }
  
    function initWandButton() {
    function attachWandButton() {
        const wandMenu = document.getElementById('extensionsMenu');
        if (!wandMenu) return false;
        
        if (document.getElementById('hud-fix-wand-btn')) return true;

        const btn = document.createElement('div');
        btn.id = 'hud-fix-wand-btn';
        btn.className = 'list-group-item flex-container flexGapSm justifyCenter interactable';
        btn.innerHTML = `<span style="font-size:1.1em; opacity:0.8;">✂️</span><span>Fix HUD (Cut & Regen)</span>`;
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', async () => {
            // Кнопка находится внутри уже открытого extensionsMenu.
            // Не переключаем extensions_button здесь: это могло закрыть меню
            // прямо в момент запуска операции.
            let stContext = typeof SillyTavern !== 'undefined' && SillyTavern.getContext ? SillyTavern.getContext() : (typeof window.getContext === 'function' ? window.getContext() : null);
            let chatData = stContext && stContext.chat ? stContext.chat : window.chat;
            if (!chatData || chatData.length === 0) return;
            
            let lastMesIndex = chatData.length - 1;
            let targetMessage = chatData[lastMesIndex];
            if (targetMessage.is_user || targetMessage.is_system) {
                 showHudToast('error', 'Ошибка', 'Последнее сообщение не от персонажа.');
                 return;
            }

            let oldText = targetMessage.swipes && targetMessage.swipe_id !== undefined ? targetMessage.swipes[targetMessage.swipe_id] : targetMessage.mes;
            
            const brokenHudRegex = /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*$/i;
            
            if (!brokenHudRegex.test(oldText)) {
                 showHudToast('error', 'Ошибка', 'Тег [HUD] не найден в последнем сообщении.');
                 return;
            }

            let newText = oldText.replace(brokenHudRegex, '').trim();
            updateMessageDataForCurrentSwipe(targetMessage, newText);
                try {
                    const postUpdateHud = extractHudBlock(newText);
                    console.info('[TavernOS HUD] HUD update:', {
                        generated: true,
                        wrapped: /^\[HUD\]\s*```json/i.test(newText),
                        parse: !!postUpdateHud,
                        repaired: false,
                    });
                } catch (diagError) {
                    console.debug('[TavernOS HUD] HUD post-update diagnostic failed:', diagError);
                }

            const updateFn = getMessageUpdateFunction(stContext);
            if (updateFn) {
                await Promise.resolve(updateFn(lastMesIndex, targetMessage, { rerenderMessage: true }));
            }

            const saveFn = (stContext && typeof stContext.saveChatConditional === 'function') ? stContext.saveChatConditional.bind(stContext) : window.saveChatConditional;
            if (saveFn) await saveFn();

            showHudToast('success', 'Обрезано', 'Сломанный код удален. Запускаем регенерацию...');

            // HUD только что удалён, поэтому кнопки 🔄 Regen больше нет.
            // После штатного updateMessageBlock() заново обрабатываем сообщение
            // и запускаем именно ➕ Создать HUD.
            const startCreate = () => {
                try {
                    const freshMesEl =
                        document.querySelector(`.mes[mesid="${lastMesIndex}"]`) ||
                        document.querySelector('.mes:last-child');

                    if (!freshMesEl) {
                        showHudToast('error', 'Ошибка', 'Сообщение не найдено после очистки HUD.');
                        return;
                    }

                    freshMesEl.removeAttribute('data-hud-processed');
                    safeProcessMessage(freshMesEl);

                    const createBtn = freshMesEl.querySelector('.hud-create-btn');
                    if (createBtn) createBtn.click();
                    else showHudToast('error', 'Ошибка', 'Кнопка «Создать HUD» не найдена.');
                } catch (createErr) {
                    showHudToast('error', 'Ошибка', 'Не удалось запустить создание HUD: ' + createErr.message);
                }
            };

            requestAnimationFrame(() => requestAnimationFrame(startCreate));
        });

        // ВАЖНО: кнопку нужно добавить в меню сразу после создания.
        // Ранее appendChild оказался внутри click-handler, поэтому кнопка
        // физически никогда не появлялась в меню.
        wandMenu.appendChild(btn);
        return true;
    }

    if (!attachWandButton()) {
        let tries = 0;
        const iv = setInterval(() => { 
            if (attachWandButton() || ++tries > 40) clearInterval(iv); 
        }, 250);
    }
  }
  

  // Шов между index.js и events.js. Изменяемое состояние передаётся геттерами:
  // cachedChatContainer переприсваивается здесь же, в initApp, а
  // performanceIntersectionObserver создаётся и сбрасывается при смене
  // performance-режима. settings и функции — стабильные ссылки.
  const eventsCtx = {
    getChatContainer: () => cachedChatContainer,
    getPerformanceObserver: () => performanceIntersectionObserver,
    saveSettings,
    applyThemeColors,
    showHudToast,
    safeProcessMessage,
    isPerformanceModeActive,
    refreshPerformanceMessageClasses,
    schedulePerformanceRefresh,
  };

  let initRetries = 0;
  function initApp() {
    const chatContainer = document.querySelector('#chat') || document.querySelector('#chat-container');
    if (!chatContainer) {
      if (initRetries < 40) { initRetries++; setTimeout(initApp, 500); }
      return;
    }
    cachedChatContainer = chatContainer;
    loadSettings(); 
    restoreLastTavernRequest();
    initGlobalEvents(eventsCtx);
    initTavernOSEvents(eventsCtx);	
    initWandButton(); // Наша новая кнопка!
    updatePerformanceMode();
    processAllMessages(); 
    initObserver(eventsCtx, chatContainer);
    if (isPerformanceModeActive(chatContainer)) setupPerformanceObserver();
    chatContainer.addEventListener('scroll', schedulePerformanceRefresh, { passive: true });
    addSettingsUI();
  }
  setTimeout(initApp, 500);
})();
