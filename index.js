// hud-manager/index.js (v21.5.5)

import { hexToRgba, settings, defaultSettings } from './settings.js?v=22.99.91';
import { escapeHtml, getSafeUserName, guardTouchSwipe, hudHasMeaningfulValue } from './utils.js?v=22.99.91';
import { parseHUDComplex, repairGeneratedHudBlock, scoreHudJsonCandidate } from './hud-parser.js?v=22.99.91';
import { initGlobalEvents, initObserver, initTavernOSEvents, refreshReactions, clearReactions, облегчитьКарточку, вернутьКарточку } from './events.js?v=22.99.91';
import { buildUserHTML, buildCharacterHTML, buildPerceptionHTML } from './render/character.js?v=22.99.91';
import { buildCompanionsHTML, hudHasMeaningfulCompanions } from './render/companions.js?v=22.99.91';
import { openAssistantDialog, ПРОМПТ_АССИСТЕНТА } from './render/assistant.js?v=22.99.91';
import { mergeCarryOver, вернутьЧерты } from './render/carryover.js?v=22.99.91';
import { привязатьИсторию } from './render/intimacy.js?v=22.99.91';
import { buildDiaryHTML, hudHasMeaningfulDiary, buildBodyDiaryHTML, hudHasMeaningfulBodyDiary } from './render/diary.js?v=22.99.91';
import { buildDreamHTML, hudHasMeaningfulDreams } from './render/dreams.js?v=22.99.91';
import { buildInterceptsHTML, hudHasMeaningfulIntercepts } from './render/intercepts.js?v=22.99.91';
import { buildMemoryHTML } from './render/memory.js?v=22.99.91';
import { buildLoreEntry, loreAlreadyHas, buildLoreGenPrompt, parseLoreGenResponse, stripHudBlock } from './lore.js?v=22.99.91';
import { buildPhoneTabsHTML } from './render/phone.js?v=22.99.91';
import { buildCasketHTML, hudHasCasket, buildOverheardHTML, hudHasMeaningfulOverheard } from './render/medieval.js?v=22.99.91';
import { hudHasRelations } from './render/relations-graph.js?v=22.99.91';
import { buildLightningSvg, buildSeasonSceneHtml } from './render/scene.js?v=22.99.91';
import { buildWorldHTML, hudHasMeaningfulWorld } from './render/world.js?v=22.99.91';
import { applyThemeClass, presetRowHTML, THEME_CATEGORIES } from './themes.js?v=22.99.91';
import { TAB_HELP, findTermHelp, buildHintHTML, attachHelpMarks, removeHelpMarks, centerFieldIcons } from './help.js?v=22.99.91';
import { invalidateAvatarCache, refreshAvatarFaces } from './avatars.js?v=22.99.91';
import { clearCache, cacheUsage } from './history-analyzer.js?v=22.99.91';
import { extractHudBlock, hudBlockRe, hudOpenRe, hudCloseRe, началоПоследнегоHud } from './hud-block.js?v=22.99.91';
import { собратьСнимок, строкаСнимка, решитьNSFW, последниеТекстыЧата, HUDвКодах, легендаСнимка } from './hud-snapshot.js?v=22.99.91';
import { создатьПроверкуПолноты } from './hud-check.js?v=22.99.91';
import { обновитьПалитруГрупп, следитьЗаТемой } from './palette.js?v=22.99.91';

(function() {
  window.HUD = window.HUD || {};
  window.HUD.bootstrap = true;
  'use strict';


  let lastSceneWeather = '';
  // renderHUD отдаёт разметку строкой, повесить на неё замыкания нельзя.
  // Кладём их сюда, а processMessage сразу после вставки переносит на элемент
  // карточки. Между этими двумя шагами ничего не происходит.
  let lastLazyThunks = null;
  // baseId последней собранной карточки: нужен, чтобы подпись разметки не
  // зависела от случайных идентификаторов.
  let lastRenderBaseId = null;
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



  /* Инструкция HUD. Отдельное сообщение в конце запроса — после всего, что
     собрал SillyTavern (пресет, карточка, лорбуки, история): задача, общие
     правила, схема и в самом конце снимок последнего HUD через макрос
     {{hudLast}}.
     Правило, которое касается одного поля, живёт в описании этого поля, а не
     в общем списке. Поэтому часть про близость целиком сидит в своих полях и
     вне сцены уходит из промта без следа: в общих правилах нет ни слова о ней,
     и модели не из чего решить, что писать её нужно всегда.
     nsfw  — нужна ли часть про близость (решает hud-snapshot.js);
     режим — 'reply': обычный ответ с HUD в конце; 'regen': только HUD. */
  function buildDynamicPrompt({ nsfw = true, режим = 'reply' } = {}) {
    // Что включено. Правила и поля собираются только из включённых разделов:
    // модель не должна читать про телефон, которого у неё не просят.
    const болезни = settings.enableIllness !== false;
    const беременность = settings.enablePregnancy !== false;
    const цикл = settings.enableMenstruation !== false;
    // Интимная часть целиком — только когда сцена идёт или начинается.
    const интим = nsfw !== false;
    // Следы на теле — часть здоровья: они нужны и вне сцены.
    const следы = settings.enableIntimacyExtras !== false;
    // Поза, раунд, длительность, защита, оргазм, пульс, звуки — только в сцене.
    const близость = интим && следы;
    const экономика = !!settings.enableWorld && settings.enableEconomy !== false;
    const афиша = !!settings.enableWorld && settings.enableEvents !== false;
    const город = !!settings.enableWorld && settings.enableCity !== false;
    const гороскоп = !!settings.enableWorld && settings.enableHoroscope !== false;
    const ружья = !!settings.enableMemory && settings.enableGuns !== false;
    const спутники = settings.enableCompanions !== false;
    // Эпоха: в средневековье телефона и перехватов нет — вместо них шкатулка
    // (письма, святцы, кошель, записи, карта, грамоты, памятки) и подслушанное.
    const средневековье = settings.era === 'medieval';
    const телефон = !средневековье && !!settings.enablePhone;
    const переписки = телефон && settings.phoneAppMessages !== false;
    const кошелёк = телефон && settings.phoneAppWallet !== false;
    const перехваты = !средневековье && !!settings.enableIntercepts;
    const шкатулка = средневековье && settings.enableCasket !== false;
    const письма = шкатулка && settings.castAppLetters !== false;
    const подслушка = средневековье && settings.enableOverheard !== false;
    const игрок = !!settings.enableUserBlock;

    const задача = режим === 'regen'
      ? 'Output ONLY one [HUD] block for the latest message of the story above — no prose before or after it. Rebuild every field from the story; keep known facts instead of replacing them with empty values.'
      : 'Write your next reply exactly as the story and every instruction above require. Then, as the very last part of that same reply, append ONE [HUD] block — the state of the world AFTER the events of your reply. Nothing may follow [/HUD].';
    const чего = режим === 'regen' ? 'the latest message' : 'your reply';
    // Правила сообщений — общие для переписок и перехватов.
    const правилаСообщений = 'Keep ongoing conversations and unanswered messages alive turn to turn; incoming messages may go unanswered — busy, asleep, offline, ignoring. Unread, Deleted or Draft only when the story supports it: deleted ones keep their hidden text, drafts are unsent. Never invent placeholder chats or fake phone data.';
    const тегиСообщений = [
      '"VOICE: prefix the text with [VOICE_M:SS], e.g. \'[Sender] -> [Recipient]: [VOICE_0:42] Перезвони мне | 21:40 | Unread\'. Use it when someone would record audio rather than type — walking, crying, in a hurry."',
      '"PHOTO: prefix with [PHOTO: what is in the shot], e.g. \'[Sender] -> [Recipient]: [PHOTO: селфи в примерочной, новое платье] Ну как? | 18:20\'. Text after the tag is the caption."',
      '"VIDEO: same idea for a clip — [VIDEO_M:SS: what happens on screen], e.g. \'[Sender] -> [Recipient]: [VIDEO_0:23: снимает на бегу, кричит и смеётся] Смотри! | 18:22\'. Duration is optional. Use it when the moment only makes sense in motion."',
      '"CALL: a call is an EVENT, not a line — \'[Sender] -> [Recipient]: [CALL: incoming, missed]\' or \'[CALL: outgoing, answered, 4:12]\'. Direction incoming/outgoing as seen from the owner; outcome answered/declined/missed; duration only when answered. Text after the tag becomes a short note."',
      '"REPLY: quoting an earlier line — [REPLY: Who :: what they said], e.g. \'[Sender] -> [Recipient]: [REPLY: Лена :: Ты придёшь?] Да, буду к восьми | 20:01\'. The name before :: is optional. Separator is ::, never |, because | already splits the line into text, time and status."',
      '"FORWARD: a message passed on from someone else — [FWD: who it came from], e.g. \'[Sender] -> [Recipient]: [FWD: Отдел кадров] Совещание переносится | 20:03\'."',
      '"POLL: a poll inside the chat — [POLL: Question ;; Option = Voter, Voter ;; Option with no votes], e.g. \'[Sender] -> [Recipient]: [POLL: Куда идём в пятницу? ;; Кафе = Лена, Петя ;; Кино = Мира ;; Никуда] | 20:05\'. List the voters by name; percentages are calculated for you, so never write them yourself. Separator is ;;, never |."',
    ];

    let p = `<hud_instructions>
## 🎯 TASK
${задача}
The block holds ONLY valid JSON, starts exactly with [HUD] and ends exactly with [/HUD]. Wrap the JSON in a fenced block tagged "json" — the opening fence right after [HUD], the closing one right before [/HUD]; it keeps markdown from corrupting the JSON. {{if hudLast}}The LAST HUD — the state before ${чего} — is at the very end of these instructions: update it instead of starting from scratch.{{/if}}

## 📐 RULES
- 🔤 CODES: keys and fixed labels — the part BEFORE ":" — are short codes of 1-3 letters, each with exactly one meaning. Write them EXACTLY as given: same letters, same case, never translated or spelled out; the HUD expands them into Russian itself. Everything AFTER ":" is written in full words: values in Russian, and where a field asks for one of the listed English words (weather, sign, status, outcome…), that whole word. The text in [brackets] only explains what goes there — never copy it. Words in <angle brackets> are placeholders: put real content in their place and never write the placeholder word itself — 'Потерять Софи: high', never 'fear: Потерять Софи — strength: high'. Free labels (names, body zones, activities, items, fears) are ordinary Russian words.
- 👤 WHO GOES WHERE: characters go ONLY in "cs" — never put {{user}} there.${игрок ? ` Everything about {{user}} goes ONLY into the top-level "us" block and only into the fields it lists — never into "cs" or a character's Th, K or D. If {{user}} is absent from the scene, omit "us".` : ''}
- 🌍 LANG: write values in Russian; character names follow "N".
- 🔓 No restrictions on imagination, length or content.
- 🚨 LIVE SNAPSHOT: every field is the state at THIS turn. Update it, never copy stale text.
- 🌍 LIVING WORLD: off-screen characters keep living — they work, sleep, travel, message, plan, argue, buy, miss appointments. Never erase that life just because the protagonist cannot see it.
- 🧠 KNOWLEDGE BOUNDARIES: each character knows only what they plausibly could. Never leak another's private thoughts, messages or plans without a believable path.
- 📦 SCHEMA FIXED: emit every section and every field of the schema below, every turn. Empty means [] / {} / "empty" — never drop a key to say "nothing changed". The only exceptions are fields marked OPTIONAL or "ONLY … otherwise omit".
- 📏 HOW MANY ITEMS: list fields have NO upper limit unless their description gives a size. Give as many items as the story actually supports — one item where four are obvious is a loss of information, including when a fuller description quietly folds several real things into one instead of splitting them by ;. More detail is never a reason for fewer items: it lengthens each item, it doesn't merge neighbours into it. A single-item list is almost always a sign you stopped too early. Aim for 3+ wherever the material allows.
- 🏷️ LABELED ITEMS: wherever a field's description shows its items as "<label>: <value>" or "code: value", write every item that way, separated by SEMICOLONS, never commas — a comma-separated list collapses into one unreadable pill. Never output a bare value without its label.
- ⚠️ FORMATTING: use exactly these codes as keys. Quote speech and phrases inside a value with «ёлочки», never with straight double quotes — a raw " ends the JSON string and cuts the text off; if one is unavoidable, escape it as \\". Separate list items with ; — never with slashes — and never put ; inside a single item.

## 🧾 SCHEMA

[HUD]
\`\`\`json
{
 "sc": {
  "T": "[time: the current in-story time as HH:MM, then the part of the day, e.g. '21:40 | поздний вечер']",
  "Wt": "[weather: conditions and temperature right now, e.g. 'мелкий дождь, +6°C, ветер с реки']",
  "Dt": "[date: day of the week and the full date with year, in the setting's own calendar]",
  "At": "[atmosphere: one short sensory phrase — a smell, sound or light that sets the scene]",
  "Md": "[mood: the overall emotional tone of the scene in a few words]"
 },
 "cs": [
  {
   "N": "[name: the character's original name, copied EXACTLY as on their card — same script, same spelling, never translated. The avatar is matched by this string; a mismatch loses the picture]",
   "A": "[age: years and date of birth as DD.MM.YYYY, e.g. '24, 03.11.2000']",
   "C": "[clothing: what they are wearing right now, head to toe, including its state — wet, torn, half-unbuttoned]",
   "Ap": "[appearance: build, height, hair, eyes, skin, distinguishing marks. The lasting description, repeated turn to turn; it changes only from injury, exhaustion or time.]",
   "R": "[role: occupation and position in the story — who they are to the others]",
   "B": "[body and mind: current physical and mental state in a phrase or two — tired, tense, tipsy, calm, shaken]",
   "H": "[health: ${болезни ? 'overall physical state in a phrase — pain, stamina, how they hold up; specific illnesses and injuries go to Ill, never its codes here' : 'wounds, pain, illness, stamina'}. 'empty' when all is well.]",${болезни ? `
   "Ill": "[illnesses, injuries and traumas, ONLY if any — otherwise omit. One group per condition, separated by |, each 'nm: diagnosis, wound or trauma; sg: fresh, worsening, stable, healing, chronic or healed; rc: recovery 0-100%; sy: symptoms now; trt: treatment'. Track each condition until it heals, updating stage, recovery and symptoms as in-story time passes; a scratch gone by tomorrow can stay in H. Keep each condition under the SAME name every turn and in ONE field only${следы ? (интим ? ' — marks left by intimacy (hickeys, bites, scratches, soreness) go to Mrk unless they become a real injury, and nothing is in both Ill and Mrk' : ' — marks that simply fade (bruises, grazes, redness) go to Mrk, and nothing is in both Ill and Mrk') : ''}]",` : ''}${беременность ? `
   "Prg": "[pregnancy, ONLY once a pregnancy exists in the story, known or not — never invent one; otherwise omit. 'wk: week of pregnancy as a number; due: expected due date; fa: the father, if known; sy: symptoms and how the body is changing; knw: who knows about it; cnd: how the pregnancy is going'. It advances with in-story time]",` : ''}${цикл ? `
   "Mns": "[menstrual cycle, ONLY for someone with a uterus — otherwise omit. 'cyd: cycle day, a number; cyl: cycle length in days; phs: menstrual, follicular, ovulation, luteal or late; nxt: next period date; pms: PMS window as dates; dly: days late, 0 if none; rsn: likely reason for delay — stress, illness, contraception, pregnancy; empty if none'. It moves forward with in-story days: the day grows, the phase follows, the period comes on time unless stress, illness, contraception or pregnancy delays it]",` : ''}
   "Ph": "[physiology: bodily sensations right now — hunger, thirst, cold, pain, drowsiness${интим ? ', arousal' : ''}. Not the phone]",
   "L": "[location: the exact place right now — city, building, room, spot in the room]",
   "Th": "[thought: the one thought running through their head this very moment, in their own voice]",
   "K": "[key thoughts: what occupies their mind in context, each with a fitting emoji. At least 3; separate by ;]",
   "Ex": "[expectation vs reality for THIS turn only, not a future prediction: what this character counted on walking into the scene vs what actually came of it. Format 'xp: what they expected; gt: what they got'. The gap is the point — e.g. sure she'd say yes; she'd already refused. If they match, say so plainly.]",
   "D": "[hidden subtext: not a second thoughts field — one concrete ACTION performed right now, alongside what the scene openly shows, that gives away something unsaid: a concealed act, an involuntary tell, or behaviour undercutting what they just claimed. Drawn from THIS scene; the act and what it reveals, in one line. 'empty' if nothing is hidden]",
   "I": "[inventory: everything they carry or wear that matters, each as '<item>: <its condition>'; separate by ;]",
   "G": "[goals, exactly 3 parts: 'nw: what they want right now; sn: what they intend to do soon; lt: their long-term aim']",
   "S": "[schedule: plans and appointments ahead, each as '<time> - <event>' ('14:30 - встреча с юристом', or a part of the day instead of the time); separate by ;]",
   "Rl": "[relationships: how this character feels about EVERY other named person who matters now, each '<name>: <attitude>', people separated by ; — never by commas, which glue everyone into one relation. For family start with the kinship as seen from THIS character, then a comma: 'Ричард: муж, любит, но боится' (отец, мать, сын, дочь, брат, сестра, дед, бабушка, дядя, тётя, отчим, мачеха and other kinship words work the same way). Bidirectional: if A lists B, B must be in cs with A in their Rl; anyone named in any Rl must also be in cs. Never 'empty' while other named people exist]",
   "Mm": "[memories: moments this character shares with the player or NPCs, each a short episode; separate by ;]",
   "Fl": "[flags: open plot threads, promises, debts, threats and consequences waiting to land; separate by ;]",
   "Jl": "[jealousy: ONLY when this character is genuinely jealous right now. Who they are jealous of, over whom, and how it shows. Omit the field or write 'empty' whenever there is no jealousy — a permanently filled field turns the drama highlight into wallpaper nobody reads.]",
   "St": "[status: social and romantic status — single, married, engaged, in a secret affair, widowed — plus social standing if it matters]",
   "Eo": "[exposure: how much of the mask has slipped in front of those present — a bouncing leg, a cracking voice, eyes darting to the door. Say what leaked and who noticed. 0-100% may lead the line: 0 = nobody suspects, 100 = everyone sees through. 'empty' when there is nothing to hide.]",
   "X": "[conflict depth as 'wy: what the conflict is about; dys: how many days it has been going on; sg: its stage — brewing, open, cold war, reconciliation']",
${интим ? `   "SxL": "[last sex: 'dt: when — date, time, place; pr: with whom and who they are to this character; ak: what exactly happened, step by step, in 2-3 sentences; en: how it ended — who came and how, what happened right after']",
   "SxC": "[sex count: lifetime number of sexual partners — a number or an honest estimate]",
   "SxR": "[sex regularity: how often they have sex these days and with whom, how they satisfy themselves in between, how strong their libido is and what feeds or kills it — a sentence or two]",
` : ''}   "Ln": "[lines: this character's most characteristic lines from the recent story, quoted verbatim in «», separated by ;. At least 3, more if they exist. Pick lines that show HOW they speak — rhythm, slang, cruelty, tenderness — not what happened. Skip if they haven't spoken yet.]",
   "SS": "${интим ? `[scene state — the intimacy phase right now. Every turn is in exactly ONE phase, and it decides which intimate fields below are filled. PHASE 1, nothing sexual is happening or has just ended: 'empty', and so are ${близость ? 'Pos, Rnd, Dur, Prt, Org, Vit, Snd, ' : ''}BM, W, ND, AC, SxV${игрок ? " and the user's UW" : ''}; SxL, SxC, SxR, Kn, Ft, NG, NT stay filled. PHASE 2, during the act — foreplay, act or climax: fill W, BM${близость ? ', Pos, Rnd, Dur, Prt, Org, Vit, Snd' : ''}${игрок ? ' and UW' : ''}; ND, AC, SxV stay 'empty'. PHASE 3, from after the last climax until they move on — aftercare or afterglow: fill ND, AC, SxV and update SxL to this encounter; W${близость ? ', Pos, Org, Snd' : ''}${игрок ? ', UW' : ''} become 'empty', BM keeps only still-sensitive zones${близость ? ', Vit may stay while the body calms down, Rnd, Dur and Prt keep their final values' : ''}. A new round is phase 2 again${близость ? ': Rnd grows by one, Dur keeps counting' : ''}. Write SS as the phase number AND its stage word, never the number alone: '2 — foreplay', '2 — act', '2 — climax', '3 — aftercare', '3 — afterglow'. Never fill W and ND in the same turn. Every intimate field is a full, vivid, explicit description, never a single word — values like 'ухоженный', 'стандартно', 'влажно', 'да' are failures: say WHAT exactly, WHERE, how it looks, feels, sounds, smells and tastes, and how it is changing right now, in one to three frank, anatomical sentences, no euphemisms, no fading to black. Bad 'lb: влажно' → good 'lb: течёт так, что внутренняя сторона бёдер блестит, бельё промокло ещё в прелюдии, каждое движение отдаётся влажным звуком'. Bad 'pb: ухоженный' → good 'pb: гладко выбрита, узкая полоска светлых волос над клитором, кожа нежная после бритья'. Where a field asks for a number, the number comes first, then the description]` : `[scene state: 'empty' — nothing intimate is happening; only if intimacy begins in this reply, its phase: foreplay, act or climax]`}",${близость ? `
   "Pos": "[position (phase 2): the current position in full — who is where, how bodies are arranged, hands/legs/weight, angle and rhythm, e.g. 'на боку, он сзади, рука на её горле, двигается медленно и глубоко']",
   "Rnd": "[round (phase 2, kept in phase 3): the number of the current round in this scene, 1 for the first]",
   "Dur": "[duration (phase 2, final value kept in phase 3): in-story minutes the intimate scene has lasted so far, as a number]",
   "Prt": "[protection (phase 2, kept in phase 3), as '<type>: <what happens with it — who handled it, whether it holds, how they feel about the risk>'. Type: condom, pill, iud, withdrawal, none — e.g. 'condom: порвался на втором заходе, заметили не сразу', 'none: оба знают и идут на риск']",
   "Org": "[orgasm readiness (phase 2), any sex: how close to climax, 0-100, then a colon and how it shows — breath, voice, muscles, words, what pushes closer or holds back, e.g. '85: сбивается дыхание, бёдра дрожат, шепчет «не останавливайся»']",
   "Vit": "[vitals (phase 2, and while calming down in phase 3). 'hr: pulse, bpm; br: breaths per minute, then how the breathing sounds; tmp: body temperature in °C']",
   "Snd": "[soundscape (phase 2): every sound of the act this character makes or hears, each '<sound>: <loudness 0-10> — <what it sounds like, when it comes>': 'Стоны: 8 — низкие, срываются на всхлип при толчке; Скрип кровати: 5 — ритмичный'; separate by ;]",` : ''}${интим ? `
   "BM": "[body map (phase 2; in phase 3 only zones still sensitive): sensitivity of each zone of THIS character's body, '<zone>: <0-10>${близость ? ' <trend>' : ''} — <what is happening to it, how it feels>'${близость ? `. Trend: rising, peak, fading, lingering (+hours, e.g. 'lingering 3h'). 'Шея: 9 peak — губы и зубы, кожа горит; Бёдра: 6 rising — дрожат под его ладонью'` : `: 'Шея: 9 — горит от его губ; Бёдра: 7 — дрожат под ладонью'`}. Zones are ordinary Russian body-part words; as many as the story touched or named. Separate by ;]",
   "W": "[intimacy (phase 2 ONLY) — 'empty' before it starts and once over. Each 'code: value', every value a full vivid description: 'ar: arousal and how it shows; tch: where/how touch happens now — hands, mouth, pressure, rhythm; rct: how the body reacts — flush, trembling, arching, clenching, goosebumps, sweat; fac: face, eyes, lips — expression, gaze, what they bite or whisper; pn: penis — erection, size, shape, colour, sensitivity, what's being done to it; lb: vagina — wetness, swelling, openness, what it feels inside; ch: breasts and nipples, women only — never for a man — shape, hardness, how they react; flu: wetness, sweat, saliva, semen — where and how much; vl: how loud the sounds of the act are and what they are — moans, whimpers, skin slapping, bed creaking, never music or ambient noise; sm: smells in the air and on skin; ${близость ? '' : 'mk: marks on skin and sheets; '}pr: partner and what they are to each other now${близость ? '' : '; pt: protection used or not'}'. Skip a code only when it does not apply to this body. Separate by ;]",
   "Kn": "[kinks, STABLE TRAIT — once known, keep filled every turn. ACTIVITIES: practice, scenario, dynamic (roleplay, BDSM, bondage, toys, power exchange); a thing needed for arousal goes to Ft. Each '<activity>: <how willingly>, <how far>' — the whole thing stays one item: 'Ролевые игры: охотно, сценарий врач-пациент; Связывание: только сама сверху'. 2+ when known; separate by ;]",
   "Ft": "[fetishes, STABLE TRAIT: THINGS — objects, materials, body parts or settings needed for arousal (stockings, latex, feet, hair, medical settings), each '<thing>: <its role>': 'Чулки: обязательное условие; Шея: сильный триггер'. 2+ when known; separate by ;]",
   "NG": "[no-go, STABLE TRAIT: refusals — hard limits never crossed, each '<limit>: <reason>': 'Боль: панический страх; Втроём: не делится'; separate by ;]",
   "NT": "[not a turn-on, STABLE TRAIT: what leaves them cold — kills arousal without being forbidden, each '<thing>: <effect>': 'Спешка: сразу теряет настрой'; separate by ;]",
   "ND": "[after intimacy (phase 3 only) — 'empty' while the act is still going. 'se: how sensitive the body is now — what flinches, what still craves touch; bo: how the body feels after — weakness, trembling, heaviness, warmth, wetness, soreness${близость ? ' (lasting marks go to Mrk)' : ''}; r2: readiness for another round — how soon, what it would take; fe: feelings and thoughts after, 2-3 sentences${близость ? ' — emotions only' : ''}'. Separate by ;]",
   "AC": "[aftercare (phase 3 only): what this character needs now it's over — touch, water, silence, words, or nothing. 2-3 sentences: what exactly, from whom, why it matters now, what would hurt instead, e.g. 'Молча обнять и не говорить ни слова — любые слова разрушат ощущение сейчас']",
   "SxV": "[sex review (phase 3 only), once it has ended: 4-6 sentences in this character's own voice — what worked, what didn't, the best and most awkward moment, how body and heart felt, what to repeat or never again — ending with a rating like ★★★★☆]",` : ''}${следы ? `
   "Mrk": "[visible body marks and physical aftermath — ${интим ? 'hickeys, bites, scratches, bruises, redness, soreness, heaviness' : 'bruises, scratches, grazes, redness, soreness'} — written every turn from the moment they appear until they fade in story time${интим ? ', whatever the intimacy phase' : ''}. Each '<what>: <where on the body> — <how it looks/feels now> | <fade time from appearance, in hours or days: 12h, 3d>': ${интим ? `'Засос: шея слева — наливается фиолетовым, ноет | 5d; Следы ногтей: спина — красные полосы | 2d'` : `'Синяк: левое предплечье — желтеет по краям, ноет при нажатии | 5d; Ссадины: костяшки правой руки — подсохли корочкой | 2d'`}. The fade time is set once at appearance and counted from sc.Dt and sc.T — keep both accurate; the look and feel change as it heals. Body only, no feelings. 'empty' when none; separate by ;]",` : ''}
   "Tr": "[trust: how much this character trusts each other named character, 0-100, '<name>: <0-100>': 'Софи: 82; Ричард: 9'. One entry per person they know. Not the same as Rl — one can love and not trust. Separate by ;]",
   "Fr": "[fears: what this character is afraid of RIGHT NOW, each '<what they fear>: <low | moderate | high | panic>': 'Потерять Софи: high; Отец узнает: moderate'. Live fears in this scene, not lifelong phobias unless surfaced. Separate by ;]"
  }
 ]`;

    if (игрок) {
      p += `,
 "us": {
  "A": "[age: years and date of birth as DD.MM.YYYY]",
  "C": "[clothing: what {{user}} is wearing right now and its state]",
  "Ap": "[appearance: physical appearance only — build, height, hair, eyes, marks]",
  "H": "[health: ${болезни ? 'overall physical state in a phrase; illnesses and injuries go to Ill, never repeated here' : 'physical state only — wounds, pain, illness, stamina'}]",${болезни ? `
  "Ill": "[illnesses and injuries of {{user}}, ONLY if any — otherwise omit. Same format and rules as for characters: groups separated by |, each 'nm: what it is; sg: fresh, worsening, stable, healing, chronic or healed; rc: recovery 0-100%; sy: symptoms; trt: treatment'. Keep each condition under the SAME name every turn and in ONE field only${следы ? (интим ? ' — marks left by intimacy (hickeys, bites, scratches, soreness) go to Mrk unless they become a real injury, and nothing is in both Ill and Mrk' : ' — marks that simply fade (bruises, grazes, redness) go to Mrk, and nothing is in both Ill and Mrk') : ''}]",` : ''}${беременность ? `
  "Prg": "[pregnancy of {{user}}, ONLY if pregnant — otherwise omit. 'wk: week as a number; due: expected due date; fa: the father, if known; sy: symptoms; knw: who knows; cnd: how it is going']",` : ''}${цикл ? `
  "Mns": "[menstrual cycle of {{user}}, ONLY with a uterus — otherwise omit. Same format and rules as for characters: 'cyd: day; cyl: length; phs: menstrual, follicular, ovulation, luteal or late; nxt: next period; pms: PMS window; dly: days late; rsn: reason for delay']",` : ''}
  "Rl": "[relationships: how {{user}} feels about EVERY other named person who matters now — same format and rules as for characters; bidirectional with their Rl; separate by ;]",
${следы ? `  "Mrk": "[visible body marks on {{user}} — same format and rules as for characters: '<what>: <where> — <how it looks and feels now> | <fade time: 12h, 3d>'; the same mark keeps the same name every turn and is never also in Ill; 'empty' when there are none]",
` : ''}${интим ? `  "UW": "[user intimacy (phase 2 ONLY) — same phases and the same full, vivid descriptions as for characters. Each 'code: value': 'ar: arousal and how it shows; ds: strength of desire and for what; rdy: how ready the body is, what's still missing; tch: where/how {{user}} touches and is touched now; rct: how the body reacts — flush, trembling, arching, clenching, goosebumps, sweat; fac: face, eyes, lips; pb: pubic hair — grooming, shape, feel; an: anatomy — shape, size, colour, how it changes with arousal; lb: wetness — where, how much, sound and feel; ch: breasts and nipples, only if {{user}} is a woman — shape, size, hardness, sensitivity; flu: wetness, sweat, saliva, semen — where and how much; vl: how loud the sounds of the act are and what they are${близость ? '' : '; mk: marks on skin; r2: readiness for the next round'}'. Skip a code only when it does not apply to this body. 'empty' when the scene ends; separate by ;]",
` : ''}  "L": "[location: the exact place {{user}} is right now]"
 }`;
    }

    if (settings.enableMemory) {
      p += `,
 "me": {
  "lg": ["[HH:MM] - [an event of today]", "log: one line per event, up to 5, today only, chronological; people by their real names, never 'Вы', 'User' or 'главный персонаж'"],
  "md": {
   "us": {"nw": "[current mood of {{user}} in a word or two — mood and route track ONLY {{user}} and {{char}}; 'empty' for whoever is absent from the scene]", "hs": ["[HH:MM] - [mood at that time]", "history: a new line every time the mood shifts, up to 12"]},
   "chr": {"nw": "[current mood of {{char}} in a word or two]", "hs": ["[HH:MM] - [mood at that time]", "history: a new line every time the mood shifts, up to 12"]}
  },
  "rt": {
   "us": ["[HH:MM] - [place] - [arrived | left | stayed | moving]", "route: one line per movement, up to 20; [] when absent from the scene"],
   "chr": ["[HH:MM] - [place] - [arrived | left | stayed | moving]", "route: one line per movement, up to 20; [] when absent from the scene"]
  },
  "fct": ["[fact: an important or newly learned fact, stated plainly, people by their real names]", "facts: as many lines as matter"],${ружья ? `
  "gun": ["[a setup the story planted and has not paid off — a promise, threat, hint, unexplained object, open mystery, debt or foreshadowing] | [who or what it is tied to] | [open | building | fired]", "chekhov's guns: one line per unresolved thread, drawn from the Fl flags and from what the story left hanging — never invent new plot to fill the list. Keep each one until it pays off; on that turn mark it fired, then drop it next turn"],` : ''}
  "sec": [
   {
    "f": "[fact: the secret itself, stated plainly]",
    "lv": "[level: low | medium | high | critical — how damaging it would be if it came out]",
    "stt": "[status: unknown | suspected | partial | known — how far it has already spread]",
    "knw": [{"n": "[name of someone who knows]", "src": "[source: how they learned it — required for every knower]"}],
    "hd": ["[name of someone who does NOT know]"]
   }
  ]
  - One object per secret, as many as the story holds; knw and hd take as many names as apply. Once a secret becomes known to everyone, DELETE the object instead of keeping it.
 }`;
    }

    if (телефон) {
      // Каждый экран телефона просится отдельно: выключенный не должен
      // занимать место в промте.
      const ph = [];
      if (settings.phoneAppContacts !== false) ph.push(`
   "ct": [
    {"n": "[name as saved on the device, nicknames included; one object per contact, as many as the phone holds]", "nte": "[OPTIONAL note: short tag, e.g. 'Не брать трубку', 'Универ']"}
   ]`);
      if (settings.phoneAppGallery !== false) ph.push(`
   "gl": [
    {"ti": "[title of the photo; one object per photo, as many as there are]", "tm": "[time when it was taken]", "dsc": "[description: what is in the shot, 1-2 sentences]", "mt": "[OPTIONAL meta: who took it, which album, hidden meaning]"}
   ]`);
      if (settings.phoneAppNotes !== false) ph.push(`
   "nb": [
    {"ti": "[title of the note; one object per note, as many as there are]", "tm": "[time it was created or last edited]", "tx": "[text: lists, drafts, thoughts the character typed — as many lines as the note needs]", "ftr": "[OPTIONAL footer: short trailing line]"}
   ]`);
      if (settings.phoneAppMaps !== false) ph.push(`
   "mp": [
    {"pl": "[place: a saved place or recent route; one object per place, as many as there are]", "nte": "[OPTIONAL note: why it matters — 'Дом [имя]', 'Смотрели вчера в 23:40']"}
   ]`);
      if (settings.phoneAppSearch !== false) ph.push(`
   "sq": [
    "[a search query the character actually typed, verbatim — these reveal what they secretly worry about]",
    "search: one line per query, as many as they typed"
   ]`);
      if (кошелёк) ph.push(`
   "wl": {
    "bl": "[balance: a plain number, no currency sign, e.g. '18400'. The account belongs to the phone owner. Invent the starting balance once, fitting the setting and the owner's station; after that it changes ONLY through trx: new balance = previous balance + every amount listed this turn. No money moved → same balance, empty trx. Never reset or round it]",
    "cu": "[currency: whatever the setting uses — ₽, \$, €, кредиты, эдди, крышки. Same one every turn.]",
    "trx": [
     {"ti": "[title: what it was for, as a bank would print it — 'Кофейня на углу', 'Перевод от [имя]', 'Аренда', 'Взятка портье'; one object per transaction that actually happened — never invent spending]", "am": "[amount: a signed number, no currency sign — '-450', '+12000']", "tm": "[time: 'Сегодня, 14:30', 'Вчера', '12.10']", "nte": "[OPTIONAL note: one short line]"}
    ]
   }`);
      if (settings.phoneAppCalendar !== false) ph.push(`
   "cl": [
    {"dt": "[date: '16.01' or '16.01.2025', the same date system as sc.Dt; one object per entry, as many as there are]", "ti": "[title: e.g. 'День рождения [имя]', 'Совет директоров', 'Фестиваль огней']", "kd": "[kind: birthday | holiday | event]", "tm": "[OPTIONAL time: HH:MM]"}
   ]`);
      // Сообщения — такой же модуль, как остальные: выключены, значит и
      // переписок у модели не просим.
      if (переписки) p += `,
 "cm": {
  "[contact or group name — one key per chat, as many chats as the phone has]": {
   "ow": "[owner: ALWAYS {{char}} — the same name as phn.ow; this device belongs to {{char}}, and EVERY chat has the owner as one of its sides. ${перехваты ? 'A conversation between two OTHER people is not a chat here — it goes to tp even if the owner knows of it or could read it: participation decides, not access' : 'A conversation between two OTHER people does not belong here at all'}]",
   "pp": "[participants: ONLY for a real group — THREE or more people including the owner, separated by ;. Omit entirely for one-to-one; a shorter list is dropped]",
   "ms": [
    "[Sender] -> [Recipient]: [Message] | [Time] | [Read / Unread / Deleted / Draft]",
    "${правилаСообщений}",
    ${тегиСообщений.join(',\n    ')},
    "One line per message, as many lines as the conversation has — no limit on chats or on messages inside a chat."
   ]
  }
 }`;
      // Сам аппарат просим только если от него хоть что-то осталось.
      if (ph.length) p += `,
 "phn": {
  "ow": "[owner: ALWAYS {{char}}, the same name every turn — everything below is {{char}}'s own]",` + ph.join(',') + `
 }`;
    }

    if (перехваты) {
      p += `,
 "tp": [
  {
   "tg": "[target: the NPC whose phone is intercepted — a conversation between people other than ${телефон ? 'the phone owner' : '{{char}}'}; one object per intercepted chat. Never invent an intercept just to hand the protagonist information — it must be a conversation those people would plausibly have on their own]",
   "cn": "[chat name: the NPC-to-NPC or group chat title]",
   "pp": "[participants: ONLY for a group of 3+, separated by ;; omit for private chats]",
   "ms": [
    "[Sender] -> [Recipient]: [Msg] | [Time] | [Read / Unread / Deleted / Draft]",
    "${правилаСообщений} The [VOICE_M:SS], [PHOTO: ...], [VIDEO: ...], [CALL: ...], [REPLY: ... :: ...], [FWD: ...] and [POLL: ... ;; ...] tags ${переписки ? 'described for cm ' : ''}work here too. One line per message, as many as the conversation has."
   ]
  }
 ]`;
    }

    if (шкатулка) {
      // Шкатулка средневекового персонажа. Телефонов, сообщений, карт и
      // переводов тут нет: письма с печатями, записи пером, монеты.
      const sm = [];
      if (settings.castAppCalendar !== false) sm.push(`
   "cl": [
    {"dt": "[date: '16.01' or '16.01.1347', the same date system as sc.Dt; one object per entry]", "ti": "[title: a feast, fair, tourney, saint's day, court day, wedding, execution, market day]", "kd": "[kind: birthday | holiday | event]", "tm": "[OPTIONAL time as people of the age tell it: 'к вечерне', 'на рассвете', 'в полдень']"}
   ]`);
      if (settings.castAppPurse !== false) sm.push(`
   "wl": {
    "bl": "[balance: the coins in the purse by denomination, e.g. '3 зол, 14 сер, 27 мед' (gold, silver, copper) or the setting's own coins. Invent it once to fit the owner's station; after that it changes ONLY through trx. Never reset it]",
    "cu": "[currency: the realm's coinage — 'кроны', 'флорины', 'денье'. Same every turn]",
    "trx": [
     {"ti": "[what the coins went on or came from, as a steward would write in a ledger — 'Постой в «Хромом гусе»', 'Жалованье от лорда', 'Подкуп стражника'; only coins that really changed hands]", "am": "[amount, signed, with denomination — '-2 сер', '+1 зол']", "tm": "[when: 'Сегодня, к обедне', 'Вчера']", "nte": "[OPTIONAL note]"}
    ]
   }`);
      if (settings.castAppNotes !== false) sm.push(`
   "nb": [
    {"ti": "[title of a written note — on parchment, a wax tablet, the margin of a psalter]", "tm": "[when written]", "tx": "[what the owner wrote in their own hand: lists, drafts, reckonings, prayers, suspicions]", "ftr": "[OPTIONAL last line]"}
   ]`);
      if (settings.castAppMap !== false) sm.push(`
   "mp": [
    {"pl": "[place the owner knows the way to or marked on their map — a town, a ford, an inn, a castle; one object per place, in the order of the road]", "nte": "[OPTIONAL: why it matters, days of travel, danger]"}
   ]`);
      if (settings.castAppDocs !== false) sm.push(`
   "doc": [
    {"ti": "[title of a document the owner carries — a charter, safe-conduct, writ, deed, marriage contract, debt note, warrant]", "kd": "[kind: charter | pass | debt | writ | contract | will | other]", "sl": "[whose seal is on it]", "tx": "[its substance in one or two sentences]", "st": "[status: valid | expired | forged | revoked]"}
   ]`);
      if (settings.castAppKeeps !== false) sm.push(`
   "kp": [
    {"ti": "[a keepsake the owner keeps close: a ring, a lock of hair, a pressed flower, a token from a tourney, a relic]", "dsc": "[what it looks like and what it means to them]", "frm": "[OPTIONAL: from whom]"}
   ]`);
      if (письма) p += `,
 "lt": [
  {
   "fr": "[from: the sender]", "to": "[to: the recipient — {{char}} is one side of EVERY letter here]",
   "tm": "[when written or received, in the setting's own terms]",
   "st": "[status: sealed (received, not yet opened) | read | draft (unfinished, unsent) | sent | transit (a courier is carrying it now) | burned | hidden]",
   "sl": "[the seal: whose, wax colour and sign — 'красный воск, вепрь дома Эштон']", "via": "[OPTIONAL: how it travels — courier, pigeon, a servant, left under a stone]",
   "tx": "[the letter's text in the voice and manners of the age; a sealed one is still written in full]"
  }
  - One object per letter, as many as there are. There are no phones, texts or calls in this world — people write letters or send word.
 ]`;
      if (sm.length) p += `,
 "sm": {
  "ow": "[owner: ALWAYS {{char}} — this casket and everything in it belongs to {{char}}]",` + sm.join(',') + `
 }`;
    }

    if (подслушка) {
      p += `,
 "ov": [
  {
   "kd": "[kind: talk (a conversation someone overheard) | letter (someone else's letter that was opened, read or stolen)]",
   "wh": "[where: 'в конюшне за перегородкой', 'под окном трапезной']", "how": "[how it was heard or taken: through a wall crack, a servant's report, a seal lifted with a hot knife]",
   "tm": "[when]", "fr": "[letter only: sender]", "to": "[letter only: recipient]", "sl": "[letter only: its seal]",
   "ms": [
    "[talk: 'Speaker: words' one line per utterance; mark words that were not heard as [неразборчиво]. letter: its lines of text]"
   ]
  }
  - Other people's talk and letters that {{char}} is NOT part of — plots, bargains, confessions. Never invent one just to hand the protagonist information; it must be something those people would plausibly say or write on their own.
 ]`;
    }

    if (settings.enableDiary) {
      p += `,
 "dy": [
  {
   "au": "[author: a character's name — NEVER {{user}}; one object per entry, as many characters as write today]",
   "tm": "[time: date and time of the entry]",
   "tx": "[text: private in-world writing, not a scene summary — a first-person entry about the author's own day, state, emotions, doubts, decisions. 4-7 sentences minimum, longer when the day was heavy. Never an omniscient narrator.]",
   "ab": "[about {{user}}: a separate private first-person subsection about {{user}} only — what the author feels, wants, fears, notices, remembers. 'empty' if nothing meaningful this turn.]",
   "md": "[mood: one English word for the dominant mood, which drives the page's visual style — sadness, stress, anger, panic, calm, relief, guilt, longing, joy, or another that fits better]"
  }
 ]${интим ? `,
 "bd": [
  {
   "au": "[author: a character's name — NEVER {{user}}; one object per entry]",
   "tm": "[time: date and time of the entry]",
   "tx": "[body diary, written EVERY turn of intimacy phases 2 and 3, and in phase 1 only while the body still clearly carries the encounter (soreness, marks, the memory of touch next morning); otherwise leave this array empty. A first-person entry about the body at THIS moment of the scene: during — what it wants, what it gets, where it burns; after — what aches, what lingers, which marks it finds, what surprised it, what it is ashamed of. Frank, physical, no euphemisms. 3-6 sentences.]",
   "md": "[mood: one word — desire, shame, tenderness, emptiness, triumph or anxiety]"
  }
 ]` : ''}`;
    }

    if (settings.enableDreams) {
      p += `,
 "dr": [
  {
   "tx": "[text: a vivid dream or nightmare — ONLY if sleeping or unconscious; one object per dream, as many as they had]",
   "mn": "[meaning: an interpretation of what the dream hides — fears, wishes, memories it stirs up]"
  }
 ]`;
    }

    if (спутники) {
      p += `,
 "pet": [
  {"n": "[name of a companion that exists in the story — an animal, familiar, drone, robot or other; one object per companion, [] when there are none]", "sp": "[species or kind, e.g. 'рыжий кот', 'ворон-фамильяр', 'боевой дрон']", "ow": "[owner, or whom it is bound to]", "md": "[mood right now in a word or two]", "cnd": "[condition: health, injuries, tiredness, charge level]", "fd": "[diet: what it eats or runs on, and when it was last fed or charged — companions have their own needs and routine: they eat, sleep, get hurt and react to the scene]", "bnd": "[bond with the owner, 0-100]", "skl": "[OPTIONAL skills, tricks and quirks, separated by ;]", "nte": "[OPTIONAL what it is doing right now]"}
 ]`;
    }

    if (settings.enableWorld) {
      const фон = 'matching the setting\'s era and place — a medieval town has bread prices and a travelling troupe, not the dollar and cinemas; background colour and a source of scene hooks, never something the story must follow';
      p += `,
 "wd": {
  "nws": ["[headline] | [article text, 2-3 sentences]", "news: one line per article, as many as the world gives"],
  "rm": ["[rumor: what people whisper about, true or not]", "rumors: one line per rumor"],
  "fc": ["[morning | clear | +7°C | short note — exactly 4 rows as 'period | weather | temperature | short note'. Period is one of: morning, day, evening, night. Weather is one of: clear, sunny, cloudy, overcast, rain, downpour, drizzle, storm, snow, blizzard, fog, windy. Consistent with sc.Wt for the current part of the day]", "[day | ... ]", "[evening | ... ]", "[night | ... ]"],${гороскоп ? `
  "zd": ["[aries | what today holds for the sign | lucky]", "horoscope: ALL 12 SIGNS, one row each. Sign is one of: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces. Tone is one of: lucky, unlucky, even. Newspaper-back-page entertainment: playful, superstitious, never a directive — nothing in the story comes true because of it"],
  "fate": ["[a line or two of general fortune for the day, closing the horoscope]"],` : ''}${экономика ? `
  "eco": ["[item | value | change since yesterday, e.g. 'Доллар | 92,4 ₽ | +0,3' or 'Хлеб | 64 ₽ | подорожал' or 'Средняя зарплата | 78 000 ₽ | без изменений']", "economy: 3-6 rows of currency rates, prices and wages, ${фон}"],` : ''}${афиша ? `
  "afs": ["[kind | title | where and when]", "events: 2-6 rows of what is on today, ${экономика ? 'fitting the era and place' : фон}; kind is one of: cinema, theatre, concert, exhibition, festival, sport, club, street, lecture"],` : ''}${город ? `
  "cty": ["[kind | what is happening]", "city services: 2-5 rows, ${экономика || афиша ? 'fitting the era and place' : фон}; kind is one of: traffic, roads, weather, transport, repairs, emergency, utilities, police, health, protest"],` : ''}
  "ad": ["[classified ad: short, in the voice of whoever posted it]", "ads: one line per ad"]`;
      if (settings.showComments) {
        p += `,
  "com": ["[name: comment]", "comments: one line per comment, as many as the thread gets"]`;
      }
      p += `\n }`;
    }

    p += `\n}\n\`\`\`\n[/HUD]`;
    // Снимок — макросом {{hudLast}}: блок исчезает целиком, когда прошлого HUD
    // нет. Переносы строк снаружи {{if}}: движок ST срезает края содержимого.
    // Канон — только для ответа: при перегенерации прозы нет, есть только HUD.
    const канон = режим === 'regen' ? '' : `
It is also canon for the prose of your reply: do not contradict it — what people wear, their injuries and health, who is where, relationships, who knows which secret (people in hd do NOT know it and must not act on it), open threads in gun.`;
    p += `\n\n{{if hudLast}}## 📸 LAST HUD — the state before ${чего}
To save space, empty fields are left out, and the texts written fresh every turn (Th, Ex, D, diary, dreams, horoscope, comments) are cut down to "<new this turn>". That mark means the opposite of optional: the field is REQUIRED in your HUD, written anew and in full in the schema's format. The schema above, not this copy, decides which fields you write.
Codes: {{hudLastKeys}}
\`\`\`json
{{hudLast}}
\`\`\`${канон}
Update it to match ${чего}: keep what is still true, change what ${чего} changes, remove what has ended or faded, add what is new. Never copy it back unchanged when the story has moved on. Replace every "<new this turn>" with real content — never skip a field because it is short or missing above; however long the chat, the HUD is written in full every turn.{{/if}}`;
    p += `\n</hud_instructions>`;
    return p;
  }

  /* Сводка старого HUD для истории в запросе: [HUD_SUMMARY] … [/HUD_SUMMARY].
     Регулярка находит у старых сообщений весь блок HUD и ставит на его место
     эту строку — модель помнит, когда, где и что было, не читая полный JSON.
     Одна функция и для ответа, и для перегенерации HUD. Игрок — по имени персоны.
     Что внутри:
       дата · время · погода (температура и первая фраза, без поэзии);
       кто где — одинаковые места вместе;
       Событие — последняя строка лога, если за ход она новая;
       Новое — что сдвинулось с прошлого HUD: секрет сменил огласку, ружьё
       выстрелило, появился факт. Не больше двух пунктов, каждый обрезан.
     Возраст не пишем: он не меняется, а повторялся в каждой сводке.
     прошлыйHud — текст предыдущего блока истории; без него «Нового» нет. */
  const разборыСводки = new Map();
  function разборДляСводки(текст) {
    if (разборыСводки.has(текст)) return разборыСводки.get(текст);
    let итог;
    try { итог = { данные: parseHUDComplex(текст) }; } catch (ошибка) { итог = { ошибка }; }
    if (разборыСводки.size > 60) разборыСводки.clear();
    разборыСводки.set(текст, итог);
    return итог;
  }

  function сводкаHUD(hudText, прошлыйHud = '') {
    const разбор = разборДляСводки(hudText);
    if (разбор.ошибка) throw разбор.ошибка;
    const d = разбор.данные || {};
    const прошлый = прошлыйHud ? (разборДляСводки(прошлыйHud).данные || null) : null;
    const есть = (v) => v !== undefined && v !== null && String(v).trim() !== '' && !/^(empty|none|нет|—|-)$/i.test(String(v).trim());
    const обрезать = (s, n) => {
      const t = String(s).replace(/\s+/g, ' ').trim();
      if (t.length <= n) return t;
      const срез = t.slice(0, n);
      const пробел = срез.lastIndexOf(' ');
      return (пробел > n * 0.6 ? срез.slice(0, пробел) : срез).replace(/[\s,.;:—-]+$/, '') + '…';
    };
    const список = (v) => (Array.isArray(v) ? v : []).map(x => String(x ?? '')).filter(есть);
    const имяИгрока = getSafeUserName() || 'User';

    const части = [];
    const сцена = d.scene || {};
    const погода = есть(сцена['Погода'])
      ? обрезать(String(сцена['Погода']).split(/[,;.]/).map(s => s.trim()).filter(Boolean).slice(0, 2).join(', '), 48)
      : '';
    const шапка = [сцена['Дата'], сцена['Время']].filter(есть).map(String).concat(погода ? [погода] : []).join(' · ');
    if (шапка) части.push(шапка);

    // Кто где. Места модель пишет от города вглубь: «Кембридж, усадьба Кейнов,
    // спальня 3B у двери». Общее начало выносим один раз, у людей остаётся
    // только своя точка: «Кембридж, усадьба Кейнов: Брэндон (коридор), Софи (ванная)».
    const люди = [];
    const безМеста = [];
    const добавить = (имя, место) => {
      if (!есть(имя)) return;
      if (!есть(место)) { безМеста.push(String(имя)); return; }
      const куски = String(место).split(/,\s*/).map(s => s.trim()).filter(Boolean);
      const общее = куски.length > 2 ? куски.slice(0, 2).join(', ') : (куски.length === 2 ? куски[0] : '');
      const своё = куски.slice(общее ? общее.split(', ').length : 0).join(', ');
      люди.push({ имя: String(имя), общее, своё, целиком: куски.join(', ') });
    };
    (Array.isArray(d.characters) ? d.characters : []).forEach(c => { if (c) добавить(c['Имя'], c['Место']); });
    if (d.user && Object.values(d.user).some(есть)) добавить(имяИгрока, d.user['Место']);
    const группы = new Map();
    люди.forEach(ч => { const k = ч.общее || ч.целиком; группы.set(k, [...(группы.get(k) || []), ч]); });
    const кто = [...группы].map(([общее, состав]) => {
      if (состав.length === 1) return `${состав[0].имя} — ${обрезать(состав[0].целиком, 60)}`;
      const одинаково = состав.every(ч => ч.своё === состав[0].своё);
      if (одинаково) return `${состав.map(ч => ч.имя).join(', ')} — ${обрезать(состав[0].целиком, 60)}`;
      return `${обрезать(общее, 40)}: ${состав.map(ч => ч.своё ? `${ч.имя} (${обрезать(ч.своё, 30)})` : ч.имя).join(', ')}`;
    }).concat(безМеста);
    if (кто.length) части.push(кто.join('; '));

    // Событие хода: последняя строка лога, если её не было в прошлом HUD.
    const лог = список(d.memory?.timeline);
    const прошлыйЛог = new Set(список(прошлый?.memory?.timeline));
    const событие = лог.length ? лог[лог.length - 1] : '';
    if (событие && !прошлыйЛог.has(событие)) части.push(`Событие: ${обрезать(событие, 140)}`);

    // Новое с прошлого HUD. Без прошлого не с чем сравнивать — пропускаем,
    // иначе первая сводка перечислила бы все факты истории разом.
    if (прошлый) {
      const новое = [];
      const статусы = new Map((Array.isArray(прошлый.memory?.secrets) ? прошлый.memory.secrets : [])
        .filter(с => с && есть(с.fact)).map(с => [String(с.fact).trim(), String(с.status ?? '').trim()]));
      (Array.isArray(d.memory?.secrets) ? d.memory.secrets : []).forEach(с => {
        if (!с || !есть(с.fact) || !есть(с.status)) return;
        const было = статусы.get(String(с.fact).trim());
        if (было !== undefined && было !== String(с.status).trim()) новое.push(`секрет «${обрезать(с.fact, 60)}» → ${String(с.status).trim()}`);
      });
      const выстрелил = (g) => /fired|сработал|выстрел/i.test(String(g).split('|')[2] || '');
      const прошлыеВыстрелы = new Set(список(прошлый.memory?.guns).filter(выстрелил).map(g => g.split('|')[0].trim()));
      список(d.memory?.guns).filter(выстрелил).map(g => g.split('|')[0].trim())
        .filter(g => g && !прошлыеВыстрелы.has(g))
        .forEach(g => новое.push(`сработало: ${обрезать(g, 70)}`));
      // Факты сюда не берём: модель переписывает их каждый ход, и в сводку
      // попадали мелочи вроде «манжета в чернилах».
      if (новое.length) части.push(`Новое: ${новое.slice(0, 2).join('; ')}`);
    }

    return `[HUD_SUMMARY] ${части.join(' | ')} [/HUD_SUMMARY]`;
  }

  /* Макрос {{hudLast}} — снимок последнего HUD.
     Во время нашей инструкции значение подставляет перехват запроса: он знает,
     какой HUD последний именно в этом запросе (при свайпе заменяемый ответ в
     запрос не попадает). В пресете или в своём промте макрос берёт последний
     HUD чата — и при свайпе или перегенерации пропускает заменяемый ответ. */
  let значениеМакросаHUD = null;
  function значениеHudLast() {
    if (значениеМакросаHUD !== null) return значениеМакросаHUD;
    try {
      const ctx = window.SillyTavern?.getContext?.();
      const чат = Array.isArray(ctx?.chat) ? ctx.chat : [];
      let конец = чат.length;
      if (['swipe', 'regenerate'].includes(lastGenType) && конец && !чат[конец - 1]?.is_user) конец--;
      for (let j = конец - 1; j >= 0; j--) {
        const m = чат[j];
        if (!m || m.is_user || m.is_system) continue;
        const текстХода = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
        const блок = extractHudBlock(String(текстХода || ''));
        if (!блок) continue;
        const объект = собратьСнимок(блок);
        if (объект) return строкаСнимка(объект, решитьNSFW(объект, последниеТекстыЧата(чат, конец)));
      }
    } catch (_) {}
    return '';
  }

  let макросHUDЗарегистрирован = false;
  function зарегистрироватьМакросHUD() {
    if (макросHUDЗарегистрирован) return;
    const ctx = window.SillyTavern?.getContext?.();
    if (!ctx) return;
    const описание = 'TavernOS HUD: the last HUD of the chat as compact JSON with short codes — empty and switched-off fields left out, fresh-every-turn texts (Th, Ex, D, diary, dreams…) marked "<new this turn>".';
    try {
      // Новый движок макросов (SillyTavern 1.13+) — с поддержкой {{if hudLast}}.
      if (ctx.macros?.register && !ctx.macros.registry?.hasMacro?.('hudLast')) {
        ctx.macros.register('hudLast', { category: ctx.macros.category?.CHAT, description: описание, handler: () => значениеHudLast() });
        макросHUDЗарегистрирован = true;
      }
    } catch (e) { console.warn('[TavernOS HUD] Макрос hudLast: новый движок', e); }
    try {
      // Старый движок — на случай, если новый выключен в настройках ST.
      if (typeof ctx.registerMacro === 'function' && !ctx.powerUserSettings?.experimental_macro_engine) {
        ctx.registerMacro('hudLast', () => значениеHudLast(), описание);
        макросHUDЗарегистрирован = true;
      }
    } catch (e) { console.warn('[TavernOS HUD] Макрос hudLast: старый движок', e); }
  }

  /* Раскрывает макросы инструкции: {{if hudLast}}…{{/if}}, {{hudLast}},
     {{user}}, {{char}}. Сначала движком SillyTavern — так в тексте появляются
     настоящие имена, — а если его нет или он вернул нераскрытое, своим
     разбором по тем же правилам. */
  function раскрытьИнструкцию(шаблон, снимок) {
    const значение = снимок || '';
    // Легенду кодов подставляем сами, до движка ST: она зависит от снимка
    // именно этого запроса и вне нашей инструкции не нужна.
    шаблон = шаблон.replace(/\{\{hudLastKeys\}\}/g, () => (значение ? легендаСнимка(значение) : ''));
    try {
      зарегистрироватьМакросHUD();
      const ctx = window.SillyTavern?.getContext?.();
      if (макросHUDЗарегистрирован && typeof ctx?.substituteParams === 'function') {
        значениеМакросаHUD = значение;
        const готово = ctx.substituteParams(шаблон);
        if (typeof готово === 'string' && готово.includes('<hud_instructions>') && !/\{\{\s*(?:\/?if\b|hudLast\s*\}\})/.test(готово.replace(значение, ''))) return готово;
      }
    } catch (e) {
      console.warn('[TavernOS HUD] Движок макросов не раскрыл инструкцию — свой разбор', e);
    } finally {
      значениеМакросаHUD = null;
    }
    return шаблон
      .replace(/\{\{if hudLast\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, тело) => (значение ? тело.trim() : ''))
      .replace(/\{\{hudLast\}\}/g, () => значение);
  }

  if (!window.__tavernOSFetchPatched) {
      window.__tavernOSFetchPatched = true;

      const originalFetch = window.fetch;
      window.fetch = async function(resource, options) {
    // Сводки старых HUD делаем и без «Сетевого перехвата»: полные HUD в истории
    // стоят тысячи токенов, даже когда модель новых уже не пишет. Сама
    // инструкция и снимок — только при включённом перехвате.
    if (options && options.method === 'POST' && options.body && typeof options.body === 'string') {
      const urlStr = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
      const isImageRequest = /image|sdapi|draw|vision|dall-e/i.test(urlStr);
      // Инструкция HUD в запросе уже есть — это наш собственный запрос
      // (перегенерация HUD, прямым fetch или через профиль Connection Manager)
      // или запрос, прошедший перехват дважды. Отпускаем как есть: вторая
      // инструкция дублировала бы всю схему, а её пример [HUD]…[/HUD] сканировался
      // бы как блок истории. Проверка стоит ДО очереди типов генерации: чужой
      // тип, записанный интерцептором для запроса SillyTavern, забирать нельзя.
      // Раньше перегенерация ставила глобальный флаг на всё время ожидания
      // ответа — и любая генерация ST в эти секунды уходила без инструкции.
      // В JSON-теле угловые скобки не экранируются, так что ищем прямо в строке.
      if (options.body.includes('<hud_instructions>')) return originalFetch.apply(window, arguments);
      // Свои служебные запросы (вопрос про сюжет, запись лорбука) HUD-инструкцию
      // не получают: иначе модель ответит HUD-блоком вместо ответа.
      if (window.__tavernOSHudSkipInject > 0) return originalFetch.apply(window, arguments);

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
          if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = defaultSettings.hudsToKeep ?? 1;
          // Снимок последнего HUD уходит в конец инструкции и считается одним
          // из развёрнутых: полными в истории остаётся на один меньше, а сам
          // последний блок из истории вырезается — он переезжает в снимок и не
          // повторяется. Более старые блоки сжимаются в [HUD_SUMMARY], как раньше.
          const инжект = !!settings.autoInject;
          const снимокВключён = инжект && settings.hudSnapshot !== false && hudsToKeep > 0;
          let объектСнимка = null;


          // Какие блоки сжать в сводку. Без снимка — всё, кроме последних
          // hudsToKeep, как раньше. Со снимком последний блок тоже сжимается
          // (он уходит в снимок), а полными остаются hudsToKeep − 1 перед ним.
          const выбратьДляСводки = (найденные) => {
            const естьСнимок = !!объектСнимка;
            const конец = естьСнимок ? найденные.length - 1 : найденные.length;
            const полных = естьСнимок ? hudsToKeep - 1 : hudsToKeep;
            const начало = Math.max(0, конец - полных);
            return найденные.filter((_, i) => i < начало || i >= конец);
          };
          // Сводка не должна ронять весь запрос: блок, который не разобрался,
          // остаётся в истории как есть.
          const вСводку = (hudText, прошлый = '') => { try { return '\n' + сводкаHUD(hudText, прошлый) + '\n'; } catch (_) { return null; } };
          // Последний HUD уходит в снимок целиком — в истории на его месте не
          // остаётся ничего, даже сводки: он не дублируется, а переезжает.
          // Сообщение, от которого без HUD ничего бы не осталось, получает
          // сводку: пустое сообщение часть бэкендов отвергает.
          // Между текстом до и после остаётся тот же разделитель, что стоял
          // после блока: в Text Completions перевод строки — часть шаблона.
          const вырезать = (content, index, length) => {
            const хвостДо = content.slice(0, index).match(/\s*$/)[0];
            const головаПосле = content.slice(index + length).match(/^\s*/)[0];
            const до = content.slice(0, index - хвостДо.length);
            const после = content.slice(index + length + головаПосле.length);
            const итог = до && после ? до + (головаПосле || хвостДо) + после : (до || после);
            return итог.trim() ? итог : null;
          };

          // 1. Формат Chat Completions (учитываем массив messages)
          if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
            let allMatches = [];
            parsedBody.messages.forEach((msg, mIdx) => {
              if (typeof msg.content === 'string') {
                // ВАЖНО: Регулярка объявляется ВНУТРИ цикла, чтобы ее lastIndex сбрасывался для каждого сообщения
                const regexLocal = hudBlockRe('ig', true);
                let match;
                while ((match = regexLocal.exec(msg.content)) !== null) {
                  allMatches.push({ mIdx, index: match.index, length: match[0].length });
                }
              }
            });

            if (снимокВключён && allMatches.length) {
              const посл = allMatches[allMatches.length - 1];
              объектСнимка = собратьСнимок(parsedBody.messages[посл.mIdx].content.substring(посл.index, посл.index + посл.length));
            }
            const toSummarize = выбратьДляСводки(allMatches);
            toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));
            // Прошлый блок читаем до замены: обходим с конца, и всё, что раньше
            // текущего, ещё на месте.
            const текстБлока = (m) => (m ? parsedBody.messages[m.mIdx].content.substring(m.index, m.index + m.length) : '');
            const вСнимке = объектСнимка ? allMatches[allMatches.length - 1] : null;
            toSummarize.forEach(rm => {
              let content = parsedBody.messages[rm.mIdx].content;
              if (rm === вСнимке) {
                const без = вырезать(content, rm.index, rm.length);
                if (без !== null) { parsedBody.messages[rm.mIdx].content = без; modified = true; return; }
              }
              const сводка = вСводку(content.substring(rm.index, rm.index + rm.length), текстБлока(allMatches[allMatches.indexOf(rm) - 1]));
              if (сводка === null) return;
              parsedBody.messages[rm.mIdx].content = content.slice(0, rm.index) + сводка + content.slice(rm.index + rm.length);
              modified = true;
            });
          }
          // 2. Формат Text Completions (учитываем единую строку prompt)
          else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            let allMatches = [];
            const regexLocal = hudBlockRe('ig', true);
            let match;
            while ((match = regexLocal.exec(parsedBody.prompt)) !== null) {
              allMatches.push({ index: match.index, length: match[0].length });
            }
            if (снимокВключён && allMatches.length) {
              const посл = allMatches[allMatches.length - 1];
              объектСнимка = собратьСнимок(parsedBody.prompt.substring(посл.index, посл.index + посл.length));
            }
            const toSummarize = выбратьДляСводки(allMatches);
            toSummarize.sort((a, b) => b.index - a.index);
            const вСнимке = объектСнимка ? allMatches[allMatches.length - 1] : null;
            toSummarize.forEach(rm => {
              let content = parsedBody.prompt;
              if (rm === вСнимке) {
                const без = вырезать(content, rm.index, rm.length);
                if (без !== null) { parsedBody.prompt = без; modified = true; return; }
              }
              const прошлый = allMatches[allMatches.indexOf(rm) - 1];
              const сводка = вСводку(content.substring(rm.index, rm.index + rm.length), прошлый ? content.substring(прошлый.index, прошлый.index + прошлый.length) : '');
              if (сводка === null) return;
              parsedBody.prompt = content.slice(0, rm.index) + сводка + content.slice(rm.index + rm.length);
              modified = true;
            });
          }

          // Нужна ли часть про близость: идёт ли сцена по последнему HUD или
          // начинается по словам последних сообщений чата. Тексты — из самого
          // чата, а не из запроса: там же лежат вставки пресета.
          if (инжект) {
          let чатДляРешения = [];
          try { const ctx = window.SillyTavern?.getContext?.(); чатДляРешения = Array.isArray(ctx?.chat) ? ctx.chat : []; } catch (_) { чатДляРешения = []; }
          const nsfw = решитьNSFW(объектСнимка, последниеТекстыЧата(чатДляРешения));
          const снимок = объектСнимка ? строкаСнимка(объектСнимка, nsfw) : '';
          let dynamicPrompt = раскрытьИнструкцию(buildDynamicPrompt({ nsfw }), снимок);
          window.__tavernOSHudPrompt = { nsfw, снимок: снимок.length, символов: dynamicPrompt.length, отдельно: settings.hudPromptSeparate !== false };
          console.info('[TavernOS HUD] Инструкция HUD', window.__tavernOSHudPrompt);

          if (parsedBody.messages && Array.isArray(parsedBody.messages) && parsedBody.messages.length > 0) {
            const lastMsgIndex = parsedBody.messages.length - 1;
            const lastMsg = parsedBody.messages[lastMsgIndex];
            const lastRole = String(lastMsg?.role || '').toLowerCase();
            const ответПоследним = lastRole === 'assistant' || lastRole === 'model';
            if (settings.hudPromptSeparate !== false) {
              // Отдельное сообщение после всего, что собрал SillyTavern. Если
              // последним стоит ответ ассистента (продолжение, префилл), он
              // должен остаться последним — инструкция встаёт перед ним.
              // Системная роль посреди диалога безопасна: сервер ST сам
              // переводит её в пользовательскую для Claude, Gemini и других.
              const инструкция = { role: 'system', content: dynamicPrompt };
              if (ответПоследним) parsedBody.messages.splice(lastMsgIndex, 0, инструкция);
              else parsedBody.messages.push(инструкция);
            } else if (ответПоследним) {
              // Прежний способ — дописать к последнему сообщению игрока. Ответ
              // ассистента не трогаем: у DeepSeek и части OpenAI-совместимых
              // бэкендов такой запрос становился недопустимым.
              parsedBody.messages.push({ role: 'user', content: dynamicPrompt });
            } else if (typeof lastMsg.content === 'string') {
              lastMsg.content += '\n\n' + dynamicPrompt;
            } else {
              parsedBody.messages.push({ role: 'user', content: dynamicPrompt });
            }
            modified = true;
          } else if (parsedBody.prompt && typeof parsedBody.prompt === 'string') {
            parsedBody.prompt += '\n\n' + dynamicPrompt;
            modified = true;
          }
          } // инжект

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
    // Старые карточки сверх лимита можно прятать совсем — без полоски «HUD свёрнут».
    root.classList.toggle('hud-hide-old-cards', settings.hideOldCards === true);

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
        // Тот же цвет, но пригодный для смешивания: стили закрытой части
        // строят из него и кромку, и свечение, и подпись.
        root.style.setProperty('--hud-nsfw-color', settings.nsfwColor);
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
    // Разовый переход: прежнее значение по умолчанию 2 → 1 (снимок заменяет
    // полный HUD в истории). Своё значение, отличное от 2, не трогаем.
    if (settings.hudsToKeepMigration !== 1) {
      if (saved && Number(settings.hudsToKeep) === 2) settings.hudsToKeep = 1;
      settings.hudsToKeepMigration = 1;
      if (saved) { try { localStorage.setItem('hud_settings', JSON.stringify(settings)); } catch (_) {} }
    }
    applyThemeColors(); обновитьПалитруГрупп(); следитьЗаТемой(); 
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
    toast.innerHTML = `<div class="hud-toast-icon">${iconSvg}</div><div class="hud-toast-content"><div class="hud-toast-title">${escapeHtml(title)}</div><div class="hud-toast-msg">${escapeHtml(message)}</div></div>`;
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

  // Словарь справки и вся её разметка живут в help.js.

  // Значок справки внутри вкладки. Отдельная кнопка, а не подсказка
  // браузера: подсказки браузера не открываются пальцем.
  function значокСправки(вид) {
    if (settings.showHints === false || !TAB_HELP[вид]) return '';
    return `<span class="hud-help-mark" data-tab-help="${вид}" role="button" tabindex="0"`
      + ` aria-label="Что это за вкладка" title="Что это за вкладка"></span>`;
  }


  function renderHUD(data) {
    if (!data || Object.keys(data).length === 0) return '';
    const hasMemory = Boolean(data.memory && (
      (Array.isArray(data.memory.timeline) && data.memory.timeline.length) ||
      (Array.isArray(data.memory.important) && data.memory.important.length) ||
      (Array.isArray(data.memory.secrets) && data.memory.secrets.length) ||
      (Array.isArray(data.memory.guns) && data.memory.guns.length) ||
      (data.memory.mood && ((data.memory.mood.user?.current || data.memory.mood.user?.history?.length) || (data.memory.mood.char?.current || data.memory.mood.char?.history?.length))) ||
      (data.memory.route && ((data.memory.route.user?.length || 0) + (data.memory.route.char?.length || 0) > 0))
    )) || hudHasRelations(data);
    // Телефон показывается, если есть переписки ИЛИ любое содержимое ОС
    // (контакты, галерея, заметки, карты, история поиска).
    const phoneOsFilled = Boolean(data.phone && ['contacts','gallery','notes','maps','search']
      .some(k => Array.isArray(data.phone[k]) && data.phone[k].length > 0));
    const средневековье = settings.era === 'medieval';
    const hasPhone = Boolean(!средневековье && settings.enablePhone && ((data.chatsMap && Object.keys(data.chatsMap).length > 0) || phoneOsFilled));
    if (data.characters.length === 0 && (!data.intercepts || data.intercepts.length === 0) && data.diary.length === 0 && data.dreams.length === 0 && Object.values(data.world || {}).every(v => !v || !v.length) && Object.keys(data.scene).length === 0 && Object.keys(data.user || {}).length === 0 && !hasMemory && !hasPhone && !hudHasCasket(data.satchel, data.letters) && !hudHasMeaningfulOverheard(data.overheard)) return '';

    const baseId = Date.now() + '-' + Math.random().toString(36).slice(2);
    // Идентификаторы у каждой сборки свои. Чтобы можно было сравнить две
    // разметки по существу, запоминаем, каким был baseId в этот раз.
    lastRenderBaseId = baseId;
    let osSubtitleHtml = '', mainCharName = '';
    if (data.characters.length > 0) mainCharName = data.characters[0]['Имя'] || '';

    let tRaw = data.scene['Время'] || '', wRaw = data.scene['Погода'] || '', dRaw = data.scene['Дата'] || '';
    let phaseClass = 'phase-night';
    let phaseLow = (tRaw || '').toLowerCase();

    // Месяц сцены — прежде всего по дате. Нужен и сезону (ниже), и солнцу:
    // восход и закат зависят от месяца.
    const месяцИзДаты = (() => {
      const d = String(dRaw || '').toLowerCase();
      let m = d.match(/(?<!\d)(\d{1,2})[./](\d{1,2})[./]\d{2,4}(?!\d)/);
      if (m && +m[2] >= 1 && +m[2] <= 12) return +m[2];
      m = d.match(/(?<!\d)\d{4}-(\d{1,2})-\d{1,2}(?!\d)/);
      if (m && +m[1] >= 1 && +m[1] <= 12) return +m[1];
      const имена = [/январ|(?<![\p{L}])jan/u, /феврал|(?<![\p{L}])feb/u, /(?<![\p{L}])март|(?<![\p{L}])mar(?:ch)?(?![\p{L}])/u, /апрел|(?<![\p{L}])apr/u,
        /(?<![\p{L}])ма[йя](?![\p{L}])|(?<![\p{L}])may(?![\p{L}])/u, /июн|(?<![\p{L}])jun/u, /июл|(?<![\p{L}])jul/u, /август|(?<![\p{L}])aug/u,
        /сентябр|(?<![\p{L}])sep/u, /октябр|(?<![\p{L}])oct/u, /ноябр|(?<![\p{L}])nov/u, /декабр|(?<![\p{L}])dec/u];
      const i = имена.findIndex(rx => rx.test(d));
      return i >= 0 ? i + 1 : null;
    })();
    // Восход и закат по месяцу — средние широты (~50° с. ш.), в минутах от
    // полуночи. Раньше солнце всегда вставало в 6:00 и садилось в 20:00:
    // 15 января в 18:40 оно ещё висело над горизонтом. Без месяца — прежние
    // 6:00–20:00. Фазы суток считаются в долях светового дня, поэтому при
    // 6:00–20:00 границы совпадают с прежними: утро до 10:00, день до 17:00,
    // золотой час до 18:30, закат до 20:00, вечер до 22:00.
    const ВОСХОД = [480, 450, 400, 345, 300, 280, 290, 330, 375, 420, 460, 485];
    const ЗАКАТ  = [990, 1040, 1090, 1145, 1190, 1215, 1210, 1165, 1105, 1045, 990, 970];
    // Число месяца — нужно только для праздников: с 28 декабря по 13 января
    // во дворе стоит наряженная ёлка.
    const числоИзДаты = (() => {
      const d = String(dRaw || '').toLowerCase();
      let m = d.match(/(?<!\d)(\d{1,2})[./](\d{1,2})[./]\d{2,4}(?!\d)/);
      if (m && +m[1] >= 1 && +m[1] <= 31) return +m[1];
      m = d.match(/(?<!\d)\d{4}-\d{1,2}-(\d{1,2})(?!\d)/);
      if (m && +m[1] >= 1 && +m[1] <= 31) return +m[1];
      m = d.match(/(?<!\d)(\d{1,2})\s*(?:-?го)?\s+[\p{L}]{3,}/u);
      if (m && +m[1] >= 1 && +m[1] <= 31) return +m[1];
      return null;
    })();
    const новогодниеДни = !!месяцИзДаты && !!числоИзДаты
      && ((месяцИзДаты === 12 && числоИзДаты >= 28) || (месяцИзДаты === 1 && числоИзДаты <= 13));

    const DAY_START = месяцИзДаты ? ВОСХОД[месяцИзДаты - 1] : 360;
    const DAY_END = месяцИзДаты ? ЗАКАТ[месяцИзДаты - 1] : 1200;
    const DAY_LEN = DAY_END - DAY_START;

    let hourMatch = tRaw.match(/(\d{1,2}):(\d{2})/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1], 10);
      const minute = parseInt(hourMatch[2], 10) || 0;
      const totalMinutes = hour * 60 + minute;

      if (totalMinutes < 120) phaseClass = 'phase-deep-night';
      else if (totalMinutes < DAY_START - 60) phaseClass = 'phase-night';
      else if (totalMinutes < DAY_START) phaseClass = 'phase-predawn';
      else if (totalMinutes < DAY_START + DAY_LEN * 0.286) phaseClass = 'phase-morning';
      else if (totalMinutes < DAY_START + DAY_LEN * 0.786) phaseClass = 'phase-day';
      else if (totalMinutes < DAY_START + DAY_LEN * 0.893) phaseClass = 'phase-golden';
      else if (totalMinutes < DAY_END) phaseClass = 'phase-sunset';
      else if (totalMinutes < DAY_END + 120) phaseClass = 'phase-evening';
      else phaseClass = 'phase-night';
    } else if (/(?<![\p{L}])предрассвет|\bpredawn|\bdawn\b/u.test(phaseLow)) phaseClass = 'phase-predawn';
    // Русские слова ищем с начала слова через (?<![\p{L}]): \b в JS знает только
    // латиницу, и «утро», «вечер», «ночь» без часов не распознавались.
    else if (/(?<![\p{L}])утр|\bmorn/u.test(phaseLow)) phaseClass = 'phase-morning';
    else if (/(?<![\p{L}])(?:день|дн[ёе]м|полдень|полдн)(?![\p{L}])|\bday\b|\bnoon\b/u.test(phaseLow)) phaseClass = 'phase-day';
    else if (/(?<![\p{L}])золот|\bgolden\b/u.test(phaseLow)) phaseClass = 'phase-golden';
    else if (/(?<![\p{L}])(?:закат|солнц\p{L}*\s*за)|\bsunset/u.test(phaseLow)) phaseClass = 'phase-sunset';
    else if (/(?<![\p{L}])вечер|\beven|\bnightfall\b/u.test(phaseLow)) phaseClass = 'phase-evening';
    else if (/(?<![\p{L}])глубок\p{L}*\s*ноч|\bdeep\s*night\b/u.test(phaseLow)) phaseClass = 'phase-deep-night';
    else if (/(?<![\p{L}])ноч|\bnight\b/u.test(phaseLow)) phaseClass = 'phase-night';

    let wClass = 'weather-clear', wLow = wRaw.toLowerCase(), wIntensity = '';
    // СИЛА явления — отдельная ось, общая для всей погоды: «сильный»
    // одинаково повышает и снегопад, и дождь, и ветер. Какое именно
    // явление идёт, решают списки ниже; сила только сдвигает уровень
    // внутри него. Раньше усилители были вписаны прямо в списки явлений,
    // и «сильная метель» подменялась метелью вместо того, чтобы стать
    // на ступень выше.
    // Слова ищем с начала слова: иначе «дик» ловился в «медике», «густ» —
    // в «августовском», «лют» — в «абсолютном», «лив» — в «заливе».
    const сНачала = (s) => new RegExp('(?<![\\p{L}])(?:' + s + ')', 'u');
    const wStrong = сНачала('сильн|мощн|свиреп|яростн|беш|лют|дик|жутк|страшн|густ|плотн|валит|стеной|обильн|интенсивн|непрогляд|heavy|strong|intense|fierce');
    const wWeak   = сНачала('слаб|лёгк|легк|небольш|редк|порош|мелк|изредка|чуть|перв|light|flurr');

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
    const windRe   = сНачала('ветер|ветр|шквал|порыв|сквозняк|дует|wind|gust|squall|breeze');
    const windCalm = сНачала('слаб|лёгк|легк|тих|утих|стих|ул[её]гся|безветр|штил|едва|слегка|чуть|light|calm');
    const windHard = сНачала('сильн|шквал|штормов|порыв|ураган|бешен|рв[ёе]т|завыва|воет|гуд|strong|gust|squall|gale');
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
    
    // «штормовой ветер» — ветер, «snowstorm» — снег; грозой они не считаются.
    if (сНачала('гроз|молни|шторм(?!ов)|thunder|storm').test(wLow)) {
      wClass = 'weather-storm';
    } else if (сНачала('град(?!ус)|hail').test(wLow)) {
      wClass = 'weather-hail';
    } else if (сНачала('снег|снеж|snow|метел|вьюг|blizzard|буран|пург|мет[её]т|позёмк|поземк|порош|flurr').test(wLow)) {
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
    } else if (сНачала('дожд|лив|проливн|rain|shower|морос|drizzle').test(wLow.replace(/после\s+дожд\p{L}*|дожд\p{L}*\s+(?:прош|законч|стих|кончил|перестал)\p{L}*|after\s+(?:the\s+)?rain/giu, ' '))) {
      wClass = 'weather-rain';
      // Сила дождя — только из частей про дождь, как у снега: «сильный ветер,
      // мелкий дождь» раньше давал ливень из-за чужого «сильный».
      const rainParts = partsWith(сНачала('дожд|лив|проливн|rain|shower|морос|drizzle'));
      const rp = rainParts.length ? rainParts : wParts;
      if (anyOf(rp, сНачала('лив|проливн')) || anyOf(rp, wStrong)) wIntensity = 'weather-intensity-high';
      else if (anyOf(rp, сНачала('морос|drizzle')) || anyOf(rp, wWeak)) wIntensity = 'weather-intensity-low';
    } else if (wLow.match(/облач|пасмур|cloud|overcast/)) {
      wClass = 'weather-cloudy';
    } else if (сНачала('ветер|ветр|шквал|wind|squall|ураган|бур').test(wLow)) {
      wClass = 'weather-wind';
      // «Шквалистый» и «шквал» раньше не ловились ни здесь, ни в силе:
      // фраза попадала в ветер только из-за слова «ветер» и оставалась
      // обычной, поэтому шквалистый ветер выглядел как штиль.
      const wp = windParts.length ? windParts : wParts;
      if (anyOf(wp, сНачала('штормов|шквал|порыв|ураган|бур|gust|squall')) || anyOf(wp, wStrong)) wIntensity = 'weather-intensity-high';
    } else if (сНачала('туман|fog|дымк').test(wLow)) {
      wClass = 'weather-fog';
    } else if (сНачала('ясн|солнеч|clear|sunny').test(wLow)) {
      wClass = 'weather-clear';
    }

    // Температура — число при «°» или «градус»; первое число строки могло
    // оказаться скоростью ветра («ветер 5 м/с, +20°C»).
    let tempClass = '', freezeClass = '', tempMatch = wRaw.match(/([-+\u2212]?\d+)(?:[.,]\d+)?\s*(?:°|℃|градус)/i) || wRaw.match(/([-+\u2212]?\d+)/);
    if (tempMatch) {
      let tempStr = tempMatch[1].replace('\u2212', '-');
      let tempVal = parseInt(tempStr, 10);
      if (tempVal <= 0) tempClass = 'temp-cold';
      if (tempVal <= -10) freezeClass = 'temp-freezing'; 
      if (tempVal >= 20) tempClass = 'temp-hot temp-drops'; 
    }

    let seasonClass = '';
    // Сезон — прежде всего по месяцу в дате. Слова погоды («шум майского
    // ливня» при дате 01.06) раньше перебивали месяц, и летняя сцена
    // рисовалась весенней. По словам решаем, только если месяца в дате нет.
    // Месяц (месяцИзДаты) определён выше — вместе с восходом и закатом.
    if (месяцИзДаты) seasonClass = ['season-winter', 'season-winter', 'season-spring', 'season-spring', 'season-spring', 'season-summer',
      'season-summer', 'season-summer', 'season-autumn', 'season-autumn', 'season-autumn', 'season-winter'][месяцИзДаты - 1];
    let dLow = (dRaw + ' ' + wRaw + ' ' + tRaw).toLowerCase(); 
    if (seasonClass) { /* сезон уже взят из даты */ }
    else if (dLow.match(/зим|декабр|январ|феврал|dec|jan|feb|\.12\.|\.01\.|\.02\.|снег|снеж|метел|вьюг|мороз|буран/)) seasonClass = 'season-winter';
    // «мая» — родительный падеж, в датах он почти всегда: «3 мая». Раньше
    // искали только «май», и весь май оставался без пейзажа.
    else if (dLow.match(/весн|март|апрел|ма[йя]|mar|apr|may|\.03\.|\.04\.|\.05\./)) seasonClass = 'season-spring';
    // «Лето» — отдельным словом: голое «лет» ловило «20 лет», «полетели».
    else if (dLow.match(/(?:^|[^а-яё])лет(?:о|а|ом|е|н)|июн|июл|август|jun|jul|aug|\.06\.|\.07\.|\.08\./)) seasonClass = 'season-summer';
    else if (dLow.match(/осен|сентябр|октябр|ноябр|sep|oct|nov|\.09\.|\.10\.|\.11\./)) seasonClass = 'season-autumn';

    let dustyClass = (tempClass.split(' ').includes('temp-hot') && seasonClass === 'season-summer' && (wClass === 'weather-clear' || wClass === 'weather-wind')) ? 'weather-dusty' : '';
    const prevWeather = previousMessageWeather();
    // Радуга: дождь закончился — по прошлому ходу или прямо по словам погоды
    // («после дождя», «дождь прошёл», «слепой дождь», «проясняется»).
    const послеДождя = /после\s+дожд|дожд\p{L}*\s+(?:прош|законч|стих|кончил)|слеп\p{L}*\s+дожд|проясня|радуг|after\s+(?:the\s+)?rain|rainbow/iu.test(String(wRaw || ''));
    let rainbowClass = ((wClass === 'weather-clear' || wClass === 'weather-cloudy') && (prevWeather === 'weather-rain' || prevWeather === 'weather-storm' || послеДождя)
      || (послеДождя && wClass !== 'weather-storm')) ? 'weather-rainbow' : '';
    // Месяц — для весны: март, апрель и май выглядят по-разному (проталины,
    // цветение, сирень и пух). Конец месяца — с 20-го числа.
    const monthClass = месяцИзДаты ? `month-${месяцИзДаты}${числоИзДаты && числоИзДаты >= 20 ? ' month-late' : ''}` : '';
    // Мокрая земля: дождь идёт сейчас либо шёл в прошлом сообщении. Лужа
    // держится ровно один ход и высыхает — отсюда и «после дождя».
    const isWet = (w) => w === 'weather-rain' || w === 'weather-storm';
    const wetClass = (isWet(wClass) || isWet(prevWeather) || послеДождя) ? 'scene-wet' : '';
    if (wRaw) {
      lastSceneWeather = wClass;
      if (renderTargetMes) renderTargetMes.dataset.hudWeather = wClass;
    }

    let dewActive = phaseClass === 'phase-morning' && (wClass === 'weather-clear' || wClass === 'weather-cloudy') && (seasonClass === 'season-spring' || seasonClass === 'season-summer');

    let celestialStyle = '', sunVarsStyle = '', sceneStyle = '';
    if (hourMatch) {
      let hh = parseInt(hourMatch[1], 10), mmMatch = tRaw.match(/\d{1,2}:(\d{2})/), mm = mmMatch ? parseInt(mmMatch[1], 10) : 0, minutesOfDay = hh * 60 + mm;
      // DAY_START и DAY_END — восход и закат этого месяца (см. выше).
      let p, cx, cy;
      if (minutesOfDay >= DAY_START && minutesOfDay <= DAY_END) p = (minutesOfDay - DAY_START) / (DAY_END - DAY_START);
      else p = (minutesOfDay > DAY_END ? (minutesOfDay - DAY_END) : (minutesOfDay + (1440 - DAY_END))) / (1440 - (DAY_END - DAY_START));
      cx = 6 + p * 84; cy = 76 - Math.sin(p * Math.PI) * 60;
      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
      const smoothStep = (value, edge0, edge1) => {
        if (value <= edge0) return 0;
        if (value >= edge1) return 1;
        return (value - edge0) / (edge1 - edge0);
      };
      // Ночь уходит к 08:00 и приходит с 19:30 до 22:00. Раньше вечерняя
      // граница шла до полуночи: в 21:00 (фаза «вечер», тёмное небо) сила
      // ночи была 0.25, и море с песком оставались дневными. А утром в 07:00
      // она была 0.67 — вода темнела под светлым утренним небом.
      // Все границы — от восхода и заката месяца; при 6:00–20:00 они те же,
      // что были в часах: ночь 5:00–8:00 и 19:30–22:00, золото в 17:00,
      // закат в 18:00, звёзды гаснут к 12:00 и зажигаются с 20:00.
      const nightStrength = clamp(1 - smoothStep(minutesOfDay, DAY_START - 60, DAY_START + 120) + smoothStep(minutesOfDay, DAY_END - 30, DAY_END + 120), 0, 1);
      const goldenStrength = clamp(1 - Math.abs(minutesOfDay - (DAY_END - 180)) / 90, 0, 1);
      const sunsetStrength = clamp(1 - Math.abs(minutesOfDay - (DAY_END - 120)) / 90, 0, 1);
      const starStrength = clamp(1 - smoothStep(minutesOfDay, DAY_START - 30, DAY_START + 360) + smoothStep(minutesOfDay, DAY_END, DAY_END + 240), 0, 1);

      // Светило всегда ЗА пейзажем, на любой высоте. Небесное тело физически
      // дальше любого дерева, поэтому пересечение должно его скрывать, а не
      // наоборот. Раньше слой переключался только у горизонта (cy > 62), и
      // днём солнце рисовалось поверх крон.
      // На телефоне плашки стоят столбиком по центру, и светило посреди неба
      // всегда пряталось за часами. Там оно идёт по боковым полосам: до
      // полудня слева (8–16%), после — справа (84–92%). Шире нельзя: у края
      // полосы светило уходит за рамку сцены, у середины — под часы.
      const cxm = cx < 50 ? 8 + (cx - 6) / 44 * 8 : 84 + (cx - 50) / 40 * 8;
      celestialStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-xm:${cxm.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;--cel-layer:1;--scene-layer:2;"`;
      sunVarsStyle = ` style="--sun-h:${p.toFixed(3)};--sun-alt:${Math.max(0, Math.sin(p * Math.PI)).toFixed(3)};"`;
      // --cel-x/--cel-y дублируем на виджет: лунная дорожка и солнечные блики
      // на воде — потомки .hud-fx-season-scene, а не светила, и до его
      // собственных переменных не дотягиваются.
      // --cel-xm (положение светила на телефоне) тоже здесь: по нему на
      // телефоне идут лунная дорожка и блики на воде.
      sceneStyle = ` style="--cel-x:${cx.toFixed(1)}%;--cel-xm:${cxm.toFixed(1)}%;--cel-y:${cy.toFixed(1)}%;--scene-day-progress:${p.toFixed(3)};--scene-night-strength:${nightStrength.toFixed(3)};--scene-golden-strength:${goldenStrength.toFixed(3)};--scene-sunset-strength:${sunsetStrength.toFixed(3)};--scene-star-strength:${starStrength.toFixed(3)};"`;
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
            ${settings.enableAssistant !== false ? '<span class="hud-ask-btn" role="button" tabindex="0" title="Спросить про сюжет: модель ответит по HUD и последним сообщениям, в чат ничего не попадёт">❓</span>' : ''}
            <span class="hud-regen-btn" title="Перегенерировать только HUD">🔄</span>
            <span class="hud-toggle-indicator">▼</span>
        </div>
      </label>
      <div class="hud-theme-panel" id="theme-panel-${baseId}">
        <div class="hud-theme-presets">
          <div class="hud-theme-presets-title">Готовые темы</div>
          <div class="hud-theme-presets-row">${presetRowHTML(settings.themePreset)}</div>
          <div class="hud-theme-presets-note">Тема просто выставляет ползунки ниже — после неё всё можно править руками.</div>
          <div class="hud-theme-packs">
            ${THEME_CATEGORIES.map(c => `<label title="Показывать темы набора «${c.label}»"><input type="checkbox" data-theme-pack="${c.id}" ${(settings.themePacks && settings.themePacks[c.id] === false) ? '' : 'checked'}> ${c.label}</label>`).join('')}
          </div>
          <div class="hud-theme-acts">
            <button type="button" class="hud-theme-act" data-theme-act="save" title="Запомнить текущие ползунки для выбранной темы">💾 Запомнить правки</button>
            <button type="button" class="hud-theme-act" data-theme-act="revert" title="Вернуть теме её исходные значения">↺ Вернуть тему</button>
            <button type="button" class="hud-theme-act own" data-theme-act="mine" title="Сохранить текущие настройки отдельной темой «Своя»">★ Сохранить свою тему</button>
            ${settings.customTheme ? '<button type="button" class="hud-theme-act danger" data-theme-act="forget" title="Удалить сохранённую свою тему">✕ Удалить свою</button>' : ''}
            <button type="button" class="hud-theme-act" data-theme-act="export" title="Сохранить текущую тему в файл — его можно переслать">⭳ Файл темы</button>
            <button type="button" class="hud-theme-act" data-theme-act="import" title="Загрузить тему из файла">⭱ Из файла</button>
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

      // Схема подставляет 'empty' всему, чего модель не прислала: такое
      // значение — не текст, плашку с ним не показываем.
      let atmStr = hudHasMeaningfulValue(data.scene['Атмосфера']) ? `«${escapeHtml(data.scene['Атмосфера'])}»` : '';

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

      // Погоду можно свернуть в строку «время · дата · погода». Выбор помнится
      // на устройстве и действует на все карточки, поэтому читаем его при сборке.
      let сценаСвёрнута = false;
      try { сценаСвёрнута = localStorage.getItem('hud-scene-compact') === '1'; } catch (e) { /* хранилище недоступно */ }
      html += `
      <div class="hud-scene-widget ${phaseClass} ${wClass} ${wIntensity} ${windClass} ${tempClass} ${freezeClass} ${seasonClass} ${dustyClass} ${rainbowClass} ${wetClass} ${monthClass}${settings.era === 'medieval' ? ' era-medieval' : ''}${сценаСвёрнута ? ' is-compact' : ''}"${sceneStyle} title="Нажмите для анимации">
        <div class="hud-fx-bg"></div>
        <div class="hud-fx-stars">${stars}</div>
        <div class="hud-fx-fireflies">${fireflies}</div>
        <div class="hud-fx-storm-flash"></div>
        <div class="hud-fx-lightning">${buildLightningSvg()}</div>
        <div class="hud-fx-rainbow"></div>
        <div class="hud-fx-celestial"${celestialStyle}></div>
        <div class="hud-fx-cloud-cover"></div>
        <div class="hud-fx-season-scene"${sunVarsStyle}>${buildSeasonSceneHtml(seasonClass, { dew: dewActive, deepFreeze: !!freezeClass, newYear: новогодниеДни, month: месяцИзДаты, day: числоИзДаты })}</div>
        <div class="hud-fx-weather"><span class="hud-snow-layer snow-far"></span><span class="hud-snow-layer snow-mid"></span><span class="hud-snow-layer snow-near"></span></div>
        <div class="hud-fx-frost"></div>
        <div class="hud-fx-temp"></div>
        <div class="hud-fx-daylight"></div>
        <div class="hud-fx-overlay"></div>
        <div class="hud-scene-top">
          <div class="hud-scene-time-group">
            <div class="hud-time-display">${timeDisplay}</div>
            ${dateStr ? `<div class="hud-date-display">${dateStr}</div>` : ''}
          </div>
          <div class="hud-scene-weather-group">
            ${hudHasMeaningfulValue(data.scene['Погода']) ? `<div class="hud-weather-item">${escapeHtml(data.scene['Погода'])}</div>` : ''}
            ${hudHasMeaningfulValue(data.scene['Настроение']) ? `<div class="hud-mood-item">${escapeHtml(data.scene['Настроение'])}</div>` : ''}
          </div>
        </div>
        ${atmStr ? `<div class="hud-scene-atm">${atmStr}</div>` : ''}
        <div class="hud-fx-clouds" aria-hidden="true"><span class="hud-rain-cloud rc-back"></span><span class="hud-rain-cloud rc-front"></span></div>
        <button type="button" class="hud-scene-fold" title="${сценаСвёрнута ? 'Развернуть погоду' : 'Свернуть погоду'}" aria-label="${сценаСвёрнута ? 'Развернуть погоду' : 'Свернуть погоду'}" aria-expanded="${сценаСвёрнута ? 'false' : 'true'}"><i aria-hidden="true"></i></button>
      </div>`;
    }
     
    html += `<div class="hud-tabs-header">`;

    let tabsHtml = '', contentHtml = '', isFirst = true;

    // Складываем сюда способ собрать каждую отложенную вкладку. Объект уедет
    // на элемент карточки сразу после вставки разметки в сообщение.
    const lazyThunks = Object.create(null);
    const lazyOn = settings.lazyTabs !== false;

    // Единая точка добавления вкладки. build(active) отдаёт готовый блок
    // .hud-tab-content с нужным id; открытую вкладку строим сразу, остальные
    // откладываем и ставим пустышку с тем же id.
    const addTab = (tabHtml, uid, build) => {
      tabsHtml += tabHtml;
      if (isFirst || !lazyOn) {
        contentHtml += build(isFirst);
      } else {
        lazyThunks['content-' + uid] = () => build(false);
        contentHtml += `<div class="hud-tab-content hud-tab-lazy" id="content-${uid}"></div>`;
      }
      isFirst = false;
    };

    data.characters.forEach((char, index) => {
      const uid = `char-${index}-${baseId}`;
      const name = char['Имя'] || `NPC ${index+1}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👤 ${escapeHtml(name.split(' ')[0])}${значокСправки('character')}</div>`,
        uid, (active) => buildCharacterHTML(char, uid, active, index === 0));
    });

    // Сводка «что о тебе думают» идёт во вкладку игрока, а без неё — в память.
    let сводкаУИгрока = false;
    if (settings.enableUserBlock && data.user && Object.keys(data.user).length > 0) {
      const uid = `user-${baseId}`;
      // Блок игрока может оказаться пустым — узнаём это только собрав его,
      // поэтому строим сразу и откладываем уже готовую строку.
      const userTabHtml = buildUserHTML(data.user, uid, isFirst, data.characters);
      if (userTabHtml) {
        сводкаУИгрока = true;
        const personaName = getSafeUserName();
        addTab(`<div class="hud-tab hud-user-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👤 ${escapeHtml(personaName.split(' ')[0])}${значокСправки('user')}</div>`,
          uid, (active) => active ? userTabHtml : buildUserHTML(data.user, uid, false, data.characters));
      }
    }

    // Средневековье: шкатулка на месте телефона.
    if (средневековье && settings.enableCasket !== false && hudHasCasket(data.satchel, data.letters)) {
      const uid = `casket-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🗝️ Шкатулка${значокСправки('casket')}</div>`,
        uid, (active) => buildCasketHTML(data.satchel, data.letters, uid, active, (Array.isArray(data.characters) && data.characters[0] && data.characters[0]['Имя']) || getMainProtagonistNames().char, data.scene && data.scene['Дата'], data.characters));
    }

    if (hasPhone) {
      const uid = `phone-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📱 Телефон${значокСправки('phone')}</div>`,
        // Последний запасной владелец телефона — персонаж, а не персона игрока:
        // телефон по схеме всегда принадлежит персонажу.
        uid, (active) => buildPhoneTabsHTML(data.chatsMap, uid, active, (Array.isArray(data.characters) && data.characters[0] && data.characters[0]['Имя']) || getMainProtagonistNames().char, data.phone, data.scene && data.scene['Дата'], tRaw, data.characters));
    }

    // === ВСТАВЛЯЕМ ВКЛАДКУ ПАМЯТИ СЮДА ===
    if (settings.enableMemory && hasMemory) {
      const uid = `memory-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🧠 Память${значокСправки('memory')}</div>`, uid, (active) => {
        try {
          const сводка = !сводкаУИгрока && settings.enablePerception !== false ? buildPerceptionHTML(data.characters) : '';
          return buildMemoryHTML(data.memory || {}, uid, active, data, { perception: сводка });
        } catch (e) {
          console.error('[TavernOS HUD] Memory renderer failed; keeping later tabs available:', e);
          return `<div class="hud-tab-content ${active ? 'active' : ''}" id="content-${uid}"><div class="hud-memory-error">🧠 Не удалось отобразить один из блоков памяти. Остальные вкладки HUD доступны.</div></div>`;
        }
      });
    }


    // Preserve the original visibility contract: a top-level tab appears only
    // when its section actually contains renderable data. Values such as
    // "empty", "none" and "пусто" must not create an otherwise blank tab.
    if (средневековье && settings.enableOverheard !== false && hudHasMeaningfulOverheard(data.overheard)) {
      const uid = `overheard-${baseId}`;
      addTab(`<div class="hud-tab intercept-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">👂 Подслушанное${значокСправки('overheard')}</div>`,
        uid, (active) => buildOverheardHTML(data.overheard, uid, active));
    }

    if (!средневековье && hudHasMeaningfulIntercepts(data.intercepts) && settings.enableIntercepts) {
      const uid = `intercept-${baseId}`;
      addTab(`<div class="hud-tab intercept-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📡 Перехваты${значокСправки('intercepts')}</div>`,
        uid, (active) => buildInterceptsHTML(data.intercepts, uid, active));
    }

    if (hudHasMeaningfulDiary(data.diary) && settings.enableDiary) {
      const uid = `diary-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">📖 Дневник${значокСправки('diary')}</div>`,
        uid, (active) => buildDiaryHTML(data.diary, uid, active));
    }

    // Дневник тела появляется сам, когда в нём есть записи: модель пишет их
    // только во время близости и сразу после, вне сцены вкладки просто нет.
    if (hudHasMeaningfulBodyDiary(data.bodyDiary) && settings.enableDiary) {
      const uid = `bodydiary-${baseId}`;
      addTab(`<div class="hud-tab hud-body-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🕯 Дневник тела${значокСправки('bodyDiary')}</div>`,
        uid, (active) => buildBodyDiaryHTML(data.bodyDiary, uid, active));
    }

    if (hudHasMeaningfulDreams(data.dreams) && settings.enableDreams) {
      const uid = `dream-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🌙 Сны${значокСправки('dreams')}</div>`,
        uid, (active) => buildDreamHTML(data.dreams, uid, active));
    }

    if (settings.enableCompanions !== false && hudHasMeaningfulCompanions(data.companions)) {
      const uid = `pets-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🐾 Спутники</div>`,
        uid, (active) => buildCompanionsHTML(data.companions, uid, active));
    }

    if (hudHasMeaningfulWorld(data.world) && settings.enableWorld) {
      const uid = `world-${baseId}`;
      addTab(`<div class="hud-tab ${isFirst ? 'active' : ''}" data-target="content-${uid}">🌍 Мир${значокСправки('world')}</div>`,
        uid, (active) => buildWorldHTML(data.world, uid, active, settings.showComments));
    }

    html += tabsHtml + `</div><div class="hud-tab-hint" hidden></div><div class="hud-tabs-body">` + contentHtml + `</div></div></div>`;
    // Заберёт processMessage сразу после вставки разметки: см. lastLazyThunks.
    lastLazyThunks = Object.keys(lazyThunks).length ? lazyThunks : null;
    return html;
  }

  function freezeOldHUDs() {
    const scope = cachedChatContainer || document;
    // Живой просмотр в панели тем — такая же карточка по разметке, но не
    // сообщение. Если считать и её, настоящая карточка перестаёт быть
    // последней и каждый раз сворачивается как «старая».
    const allCards = Array.from(scope.querySelectorAll('.hud-os-card'))
      .filter(card => !card.closest('.hud-theme-preview'));
    if (allCards.length > 0) {
      for (let i = 0; i < allCards.length - 1; i++) {
        if (allCards[i].dataset.userExpanded === 'true') continue; // пользователь сам раскрыл — не трогаем
        if (!allCards[i].classList.contains('hud-historical')) {
          allCards[i].classList.add('hud-historical');
          const checkbox = allCards[i].querySelector('.hud-toggle-input');
          if (checkbox) checkbox.checked = false; 
        }
      }
      const текущая = allCards[allCards.length - 1];
      текущая.classList.remove('hud-historical');
      // Карточка снова стала последней (например, удалили ответ) — ей нужно
      // всё содержимое.
      вернутьКарточку(текущая);
    }
    запланироватьОблегчение();
  }

  // Облегчаем не сразу: сразу после сборки на карточку ещё возвращают
  // открытую вкладку и навешивают пояснения — им нужно содержимое на месте.
  // Одна отложенная пачка на все карточки, в свободную минуту браузера.
  let облегчениеТаймер = 0;
  function запланироватьОблегчение() {
    if (settings.lightenOldCards === false) return;
    clearTimeout(облегчениеТаймер);
    облегчениеТаймер = setTimeout(() => {
      const пачка = () => {
        const scope = cachedChatContainer || document;
        scope.querySelectorAll('.hud-os-card.hud-historical').forEach(облегчитьКарточку);
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(пачка, { timeout: 2000 });
      else пачка();
    }, 1500);
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
    if (!hudBlock || !hudOpenRe('i').test(hudBlock)) return false;

    // ST иногда после saveReply держит HUD в swipes[current] раньше, чем он
    // попадает в message.mes/DOM. Восстанавливаем только отображаемый текст:
    // саму механику вставки/обновления HUD не меняем.
    const currentHtml = textElement.innerHTML || '';
    if (hudOpenRe('i').test(currentHtml)) return false;

    const node = document.createTextNode('\n\n' + hudBlock);
    textElement.appendChild(node);
    console.debug('[TavernOS HUD] Recovered HUD from active swipe', {
      swipeId: activeIndex,
      messageId: messageElement.getAttribute('mesid')
    });
    return true;
  }

  /* Границы блоков [HUD]…[/HUD] в строке.
     Каждую закрывающую метку соединяем с БЛИЖАЙШЕЙ открывающей перед ней,
     а не с первой в тексте. Иначе упоминание [HUD] в <thinking> или <plan>
     утаскивает в блок всю прозу до настоящего блока — карточка выходит
     правильной, а текст ответа исчезает.
     Незакрытую метку считаем блоком только когда закрытых нет вовсе: это
     значит, что модель ещё печатает и закрывающая просто не дошла. */
  const HUD_ОТКР = hudOpenRe('ig');
  const HUD_ЗАКР = hudCloseRe('ig');

  function найтиБлокиHud(текст, разрешитьНезакрытый = true) {
    const s = String(текст || '');
    const откр = [], закр = [];
    HUD_ОТКР.lastIndex = 0; HUD_ЗАКР.lastIndex = 0;
    for (let m; (m = HUD_ОТКР.exec(s)) !== null; ) откр.push({ от: m.index, до: m.index + m[0].length });
    for (let m; (m = HUD_ЗАКР.exec(s)) !== null; ) закр.push({ от: m.index, до: m.index + m[0].length });

    const блоки = [];
    let занятоДо = -1;
    for (const з of закр) {
      let о = null;
      for (const k of откр) {
        if (k.до > з.от) break;
        if (k.от > занятоДо) о = k;
      }
      if (!о) continue;
      блоки.push({ from: о.от, to: з.до, contentFrom: о.до, contentTo: з.от, closed: true });
      занятоДо = з.до;
    }
    if (!блоки.length && разрешитьНезакрытый && откр.length) {
      const о = откр[откр.length - 1];
      блоки.push({ from: о.от, to: s.length, contentFrom: о.до, contentTo: s.length, closed: false });
    }
    return блоки;
  }

  async function processMessage(messageElement) {
    const textElement = messageElement.querySelector('.mes_text');
    if (!textElement) { return; }

    // Кнопку «Создать HUD» убираем, только когда HUD в сообщении правда
    // появился. Раньше она снималась на каждом проходе и тут же вставлялась
    // обратно ниже: обе правки будили наблюдатель, тот снова звал разбор, и
    // каждое сообщение без HUD крутилось по кругу несколько раз в секунду.
    // В длинном чате это десятки разборов больших сообщений в секунду
    // в полном покое — на телефоне лента вставала колом.
    const убратьКнопкуСоздания = () => {
      const кнопка = textElement.querySelector('.hud-missing-placeholder');
      if (кнопка) кнопка.remove();
    };
    if (textElement.querySelector('.hud-os-card') || /(?:\[|<)\s*HUD\s*(?:\]|>)/i.test(textElement.textContent || '')) {
      убратьКнопкуСоздания();
    }

    // Пометка о свёрнутой карточке стоит на сообщении, а заглушка лежит
    // внутри текста. Другое расширение перерисовывает текст целиком —
    // заглушка пропадает, пометка остаётся, и возврат карточки потом
    // затирает весь текст снимком, снятым до чужой дописки.
    if (messageElement.dataset.hudEvicted && !textElement.querySelector('.hud-evicted')) {
      delete messageElement.dataset.hudEvicted;
    }
    // Обратный случай: карточку уже собрали заново, а заглушка осталась
    // рядом — в сообщении висят и «HUD свёрнут», и живая карточка.
    убратьЛишниеЗаглушки(messageElement, textElement);
    // Карточка свёрнута в заглушку — разбирать нечего. Без этого разбор не
    // находил [HUD] в разметке, доставал блок из свайпа и собирал карточку
    // обратно, а спрятанная старая карточка возвращалась на экран. Вернуть
    // карточку — дело заглушки и наблюдателя прокрутки: они снимают пометку.
    if (messageElement.dataset.hudEvicted && textElement.querySelector('.hud-evicted')) return;

    // Сторож идёт до всех ранних выходов: сломанная карточка живёт как раз
    // в состоянии «карточка есть, сырого блока нет», из которого разбор
    // выходит сразу.
    if (проверитьКарточку(messageElement, textElement)) return;

    let innerHtml = textElement.innerHTML;

    // Если карточка уже есть и исходного [HUD] в DOM больше нет — всё уже обработано.
    // Если ST снова дорисовал исходный [HUD] рядом с карточкой, НЕ выходим:
    // нормализатор ниже должен удалить сырой блок и оставить одну карточку.
    const hasRenderedCard = innerHtml.includes('hud-os-card');
    const hasRawHudSource = hudOpenRe('i').test(innerHtml);
    if (hasRenderedCard && !hasRawHudSource) return;

    // Recovery path for ST swipe/save timing:
    if (!hudOpenRe('i').test(innerHtml)) {
      if (recoverHudFromActiveSwipe(messageElement, textElement)) {
        убратьКнопкуСоздания();
        innerHtml = textElement.innerHTML;
      }
    }

    const openTagRegex = hudOpenRe('i');
    const closeTagRegex = hudCloseRe('i');

    if (!openTagRegex.test(innerHtml)) {
      maybeInjectMissingHudButton(messageElement, textElement);
      return;
    }

    const hasCloseTag = closeTagRegex.test(innerHtml);

    // Метки ищем по отдельности и соединяем в пары сами. Регулярка «от
    // открывающей до ближайшей закрывающей» берёт открывающую первую по
    // тексту, а она вполне может оказаться упоминанием внутри <thinking>
    // или <plan> — и тогда в блок попадает вся проза между упоминанием и
    // настоящим блоком. Ближайшая пара такого не допускает.
    const hudBlocks = найтиБлокиHud(innerHtml).map(б => ({
      full: innerHtml.slice(б.from, б.to),
      content: innerHtml.slice(б.contentFrom, б.contentTo),
      index: б.from,
      closed: б.closed,
    }));
    const естьЗакрытый = hudBlocks.some(б => б.closed);
    if (!hudBlocks.length) {
      maybeInjectMissingHudButton(messageElement, textElement);
      return;
    }

    // Карточка уже собрана, а в тексте нашёлся только незакрытый обрывок —
    // значит это упоминание метки в чужой дописке, а не блок. Настоящий
    // блок давно заменён карточкой, и закрывающей метки в тексте уже нет.
    // Пересобирать по такому обрывку нельзя: карточка выйдет пустой.
    const живаяКарточка = Array.from(textElement.querySelectorAll('.hud-os-card'))
      .filter(c => !c.closest('.hud-theme-preview'))[0];
    if (живаяКарточка && !естьЗакрытый) {
      lastLazyThunks = null;
      return;
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
    // Возврат состояния ждёт, пока на карточку лягут заготовки вкладок.
    let возвращатьПослеСборки = false;
    // Какой из блоков пошёл в карточку: его же вернём после сворачивания.
    let selectedIndexForRestore = -1;
    let newHtml = innerHtml;
    let rendered = '';
    // Подпись нужна и ниже, за пределами разбора блоков, — объявляем здесь.
    let подпись = '';
    if (parsedHudBlocks.length) {
      parsedHudBlocks.sort((a, b) => b.score - a.score || a.index - b.index);
      const selected = parsedHudBlocks[0];
      renderTargetMes = messageElement;
      // Списки из прошлых ходов возвращаем на экран перед отрисовкой:
      // модель роняет их каждый ход, а пользователю нужна цельная картина.
      // В сохранённый текст и в запрос к модели это не попадает.
      // Вне сцены модель не пишет кинки и историю секса — черты берём из прошлых ходов.
      const данныеХода = вернутьЧерты(mergeCarryOver(selected.data, messageElement), messageElement);
      // Таймеры следов и графики пульса смотрят в прошлые ходы — лениво,
      // только когда вкладка с ними действительно собирается.
      привязатьИсторию(данныеХода, Number(messageElement.getAttribute('mesid')));
      rendered = renderHUD(данныеХода);
      renderTargetMes = null;

      // Если карточка на месте и разметка вышла ровно та же, пересобирать
      // нечего: убираем сырой блок, который ST вернул в текст, и оставляем
      // живую карточку со всем её состоянием.
      const прежняяКарточка = textElement.querySelector('.hud-os-card');
      selectedIndexForRestore = selected.index;
      подпись = hudRenderSignature(rendered, lastRenderBaseId);
      const разметкаТаЖе = !!прежняяКарточка && hasCloseTag
        && !!messageElement.__hudRenderSig
        && messageElement.__hudRenderSig === подпись;

      if (rendered && разметкаТаЖе) {
        // Заготовки отложенных вкладок принадлежат новой разметке, а она не
        // понадобилась: у живой карточки свои, снятые при её сборке.
        lastLazyThunks = null;
        stripRawHudKeepCard(textElement);
        messageElement.__hudSource = innerHtml;
      } else if (rendered) {
        for (let i = hudBlocks.length - 1; i >= 0; i--) {
          const block = hudBlocks[i];
          const replacement = i === selected.index ? rendered : '';
          newHtml = newHtml.slice(0, block.index) + replacement + newHtml.slice(block.index + block.full.length);
        }
        hasChanges = newHtml !== innerHtml;

      }
    }

    if (hasChanges) {
      // Исходный текст с блоком [HUD] нужен, чтобы карточку можно было
      // выбросить из DOM и собрать заново, когда до неё снова долистают.
      // Исходник сообщения нужен виртуализации: свёрнутую карточку она
      // собирает заново именно из него. Раньше он записывался один раз и
      // после смены варианта ответа (свайпа) оставался от прежнего варианта —
      // прокрутил ленту туда-обратно и получил чужой HUD. Обновляем каждый
      // раз: сюда попадают только проходы, где в тексте есть сырой [HUD].
      messageElement.__hudSource = innerHtml;
      // Сам блок, из которого собрана карточка. Нужен, чтобы вернуть её
      // на место после сворачивания, не трогая остальной текст.
      messageElement.__hudBlock = (hudBlocks[selectedIndexForRestore] || {}).full || '';
      // Подпись разметки: по ней следующий проход поймёт, что пересобирать
      // нечего и карточку можно оставить в покое.
      messageElement.__hudRenderSig = подпись;
      const normalized = normalizeHudDisplayDom(messageElement, textElement, rendered, естьЗакрытый);
      if (!normalized) textElement.innerHTML = newHtml;
      // Карточка новая, а открыта в ней должна остаться та же вкладка, что
      // и до пересборки. Но не прямо сейчас: возврат открывает вкладку
      // кликом, а отложенные вкладки собираются из заготовок, которые лягут
      // на карточку несколькими строками ниже.
      возвращатьПослеСборки = true;
      textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);
      freezeOldHUDs();

    }

    textElement.querySelectorAll('.hud-regen-btn').forEach(bindHudRegenButton);

    // Способы собрать отложенные вкладки живут на самой карточке: исчезнет
    // она — исчезнут и они, без всякой уборки.
    if (lastLazyThunks) {
      const fresh = textElement.querySelector('.hud-os-card');
      if (fresh) fresh.__hudLazy = lastLazyThunks;
      lastLazyThunks = null;
    }

    // Теперь заготовки на месте — можно открывать ту вкладку, что была
    // открыта до пересборки: её содержимое соберётся как надо.
    if (возвращатьПослеСборки) applyCardUiState(messageElement);

    // Пометки-реакции живут отдельно от текста сообщения и в разметке не
    // сохраняются: возвращаем их на пузыри после каждой сборки.
    if (hasChanges) refreshReactions(textElement);

    // Вопросики у полей навешиваем по готовому дереву: так словарь можно
    // пополнять, не трогая полтора десятка сборщиков разметки.
    if (hasChanges) {
      if (settings.showHints === false) removeHelpMarks(textElement);
      else attachHelpMarks(textElement);
      // Эмодзи в медальонах центрируем по чернилам — независимо от пояснений.
      centerFieldIcons(textElement);
    }

    // Защита от свайпа стоит только на самой карточке. Раньше она
    // закрывала сообщение целиком, и смена варианта ответа переставала
    // работать на обычной прозе, где мешать было нечему. Карточке защита
    // нужна — по ней листают вкладки и переписки, — а тексту нет.

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

  /* Сторож пустой карточки.
     Карточка на месте, а внутри ни вкладок, ни строк — либо вкладки есть,
     а заготовок к ним не осталось, и при переключении они откроются
     пустыми. Раньше это лечил только свайп. Собираем заново из блока,
     который запомнили при первой сборке. Две неудачные попытки подряд —
     и отступаем: значит, дело не в пересборке, и крутиться по кругу
     незачем. Удачная сборка счётчик обнуляет. */
  const ПОТОЛОК_ПОЧИНОК = 2;
  function проверитьКарточку(messageElement, textElement) {
    const card = Array.from(textElement.querySelectorAll('.hud-os-card'))
      .filter(c => !c.closest('.hud-theme-preview'))[0];
    if (!card) return false;
    // Облегчённая карточка пуста нарочно: её содержимое лежит на ней самой.
    if (card.__hudLight) return false;
    const пусто = !card.querySelector('.hud-tab, .hud-row, .hud-scene-widget');
    const вкладкиБезЗаготовок = !!card.querySelector('.hud-tab-lazy') && !card.__hudLazy;
    // Карточка целая — забываем прошлые починки: следующая поломка
    // должна лечиться с чистого листа.
    if (!пусто && !вкладкиБезЗаготовок) { messageElement.__hudRepaired = 0; return false; }
    if ((messageElement.__hudRepaired || 0) >= ПОТОЛОК_ПОЧИНОК) return false;
    const блок = messageElement.__hudBlock;
    if (!блок) return false;
    console.warn('[TavernOS HUD] карточка вышла пустой — собираю заново', {
      messageId: messageElement.getAttribute('mesid'),
      пусто, вкладкиБезЗаготовок,
    });
    messageElement.__hudRepaired = (messageElement.__hudRepaired || 0) + 1;
    card.outerHTML = блок;
    delete messageElement.__hudRenderSig;
    safeProcessMessage(messageElement);
    return true;
  }

  /* ---------------------------------------------------------------------
     СОСТОЯНИЕ КАРТОЧКИ ПЕРЕЖИВАЕТ ПЕРЕСБОРКУ
     ---------------------------------------------------------------------
     Читаем и возвращаем по видимым признакам, а не по внутренним
     идентификаторам: те при пересборке выдаются заново и никуда не ведут.
     Вкладку узнаём по подписи, секрет — по заголовку, экран телефона — по
     имени приложения. */

  const надписьУзла = (el) => (el ? (el.textContent || '').trim().replace(/\s+/g, ' ') : '');

  // Пока возвращаем состояние, собственные клики в запись попадать не
  // должны: иначе восстановление перезапишет то, что восстанавливает.
  let возвращаемСостояние = false;

  // Подпись разметки: та же карточка, собранная дважды, отличается только
  // идентификаторами. Вычёркиваем их — остаётся содержимое.
  function hudRenderSignature(html, baseId) {
    if (typeof html !== 'string') return '';
    return baseId ? html.split(baseId).join('#') : html;
  }

  function readCardUiState(mes) {
    const card = mes && mes.querySelector('.hud-os-card');
    if (!card) return null;
    вернутьКарточку(card);
    const активная = card.querySelector('.hud-tab.active');
    const свёртка = card.querySelector('.hud-toggle-input');
    const экран = card.querySelector('.hud-phone-app-view.active');
    const подвкладка = card.querySelector('.hud-phone-subtab.active');
    return {
      вкладка: активная ? надписьУзла(активная) : null,
      свёрнута: свёртка ? !!свёртка.checked : null,
      раскрыты: Array.from(card.querySelectorAll('details[open]'))
        .map(d => надписьУзла(d.querySelector('summary'))).filter(Boolean),
      секреты: Array.from(card.querySelectorAll('.hud-memory-secret.is-open'))
        .map(sec => надписьУзла(sec.querySelector('[data-secret-toggle]'))).filter(Boolean),
      экран: экран ? экран.getAttribute('data-phone-view') : null,
      подвкладка: подвкладка ? надписьУзла(подвкладка) : null,
    };
  }

  function applyCardUiState(mes) {
    const состояние = mes && mes.__hudUiState;
    const card = mes && mes.querySelector('.hud-os-card');
    if (!состояние || !card) return;
    вернутьКарточку(card);
    возвращаемСостояние = true;
    try {
      if (состояние.свёрнута !== null) {
        const свёртка = card.querySelector('.hud-toggle-input');
        if (свёртка) свёртка.checked = состояние.свёрнута;
      }
      // Вкладку возвращаем кликом: отложенные вкладки собираются именно при
      // открытии, руками класс ставить нельзя — содержимое останется пустым.
      if (состояние.вкладка) {
        const цель = Array.from(card.querySelectorAll('.hud-tab'))
          .find(t => надписьУзла(t) === состояние.вкладка);
        if (цель && !цель.classList.contains('active')) цель.click();
      }
      if (состояние.раскрыты.length) {
        card.querySelectorAll('details').forEach(d => {
          if (состояние.раскрыты.includes(надписьУзла(d.querySelector('summary')))) d.open = true;
        });
      }
      if (состояние.секреты.length) {
        card.querySelectorAll('[data-secret-toggle]').forEach(btn => {
          if (!состояние.секреты.includes(надписьУзла(btn))) return;
          const тело = document.getElementById(btn.getAttribute('data-secret-toggle'));
          if (тело && тело.hidden) btn.click();
        });
      }
      // Телефон лежит внутри своей вкладки, поэтому только после неё.
      if (состояние.экран) {
        const иконка = card.querySelector('.hud-phone-app[data-phone-app="' + cssEscapeValue(состояние.экран) + '"]');
        if (иконка) иконка.click();
      }
      if (состояние.подвкладка) {
        const п = Array.from(card.querySelectorAll('.hud-phone-subtab'))
          .find(t => надписьУзла(t) === состояние.подвкладка);
        if (п && !п.classList.contains('active')) п.click();
      }
    } catch (err) {
      console.debug('[TavernOS HUD] состояние карточки вернуть не удалось:', err);
    } finally {
      возвращаемСостояние = false;
    }
  }

  function cssEscapeValue(v) {
    if (window.CSS && CSS.escape) return CSS.escape(v);
    // Запасная ветка на случай очень старого браузера: экранируем то, что
    // ломает селектор по атрибуту.
    return String(v).replace(/['"\]\\]/g, (знак) => '\\' + знак);
  }

  // Одна запись на все действия внутри карточки: снимаем состояние после
  // того, как отработали обработчики вкладок, секретов и телефона.
  document.addEventListener('click', (e) => {
    if (возвращаемСостояние) return;
    const card = e.target && e.target.closest && e.target.closest('.hud-os-card');
    if (!card) return;
    const mes = card.closest('.mes');
    if (!mes) return;
    setTimeout(() => { if (mes.isConnected) mes.__hudUiState = readCardUiState(mes); }, 0);
  });
  // Раскрытие <details> бывает и с клавиатуры — клика там может не быть.
  document.addEventListener('toggle', (e) => {
    if (возвращаемСостояние) return;
    const card = e.target && e.target.closest && e.target.closest('.hud-os-card');
    if (!card) return;
    const mes = card.closest('.mes');
    if (mes) mes.__hudUiState = readCardUiState(mes);
  }, true);

  // Убирает сырой блок [HUD] из текста, не трогая уже собранную карточку.
  // Только при наличии закрывающего тега: без него регулярка ест всё до
  // конца строки и унесла бы карточку вместе с блоком.
  function stripRawHudKeepCard(textElement) {
    let убрано = false;
    // Блоков может оказаться несколько; потолок — чтобы неудачная разметка
    // не увела в бесконечный круг.
    for (let попытка = 0; попытка < 4; попытка++) {
      if (!вырезатьОдинСыройБлок(textElement)) break;
      убрано = true;
    }
    return убрано;
  }

  // Ищет [HUD]…[/HUD] среди текста ВНЕ карточки и удаляет ровно этот кусок.
  // Внутрь карточки не заглядываем: там разметка, а не исходник, и любые
  // совпадения были бы ложными.
  function вырезатьОдинСыройБлок(textElement) {
    const обход = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement && node.parentElement.closest
        && node.parentElement.closest('.hud-os-card'))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const куски = [];
    let позиция = 0;
    let узел;
    while ((узел = обход.nextNode())) {
      const значение = узел.nodeValue || '';
      куски.push({ узел, начало: позиция, конец: позиция + значение.length });
      позиция += значение.length;
    }
    if (!куски.length) return false;

    const текст = куски.map(k => k.узел.nodeValue || '').join('');
    const открыт = текст.match(/(?:\[|<)\s*HUD\s*(?:\]|>)/i);
    if (!открыт) return false;
    const закрыт = текст.slice(открыт.index).match(/(?:\[|<)\s*\/\s*HUD\s*(?:\]|>)/i);
    if (!закрыт) return false;
    const от = открыт.index;
    const до = открыт.index + закрыт.index + закрыт[0].length;

    const найти = (поз) => куски.find(k => поз >= k.начало && поз <= k.конец) || куски[куски.length - 1];
    const а = найти(от);
    const б = найти(до);
    if (!а || !б) return false;

    const отрезок = document.createRange();
    отрезок.setStart(а.узел, Math.max(0, от - а.начало));
    отрезок.setEnd(б.узел, Math.max(0, до - б.начало));

    // Ради этого всё и затевалось: карточка не должна попасть под нож.
    const карточки = textElement.querySelectorAll('.hud-os-card');
    for (const карточка of карточки) {
      if (отрезок.intersectsNode(карточка)) { отрезок.detach && отрезок.detach(); return false; }
    }

    отрезок.deleteContents();
    return true;
  }

  // Remove duplicate HUD cards/raw HUD markup from the *displayed DOM only*.
  // The saved message/swipe data is intentionally untouched. This is a safety
  // net for ST re-renders where the same active swipe can briefly be painted
  // twice (or once as a rendered card and once as the original fenced JSON).
  function normalizeHudDisplayDom(messageElement, textElement, renderedHtml, толькоЗакрытые) {
    if (!messageElement || !textElement) return false;

    // A previous pass may already have produced a card while ST subsequently
    // restored the source HUD text. Remove cards from this message first, then
    // paint exactly one fresh card at the source HUD position. Other messages
    // are untouched.
    textElement.querySelectorAll('.hud-os-card').forEach(card => card.remove());

    let html = textElement.innerHTML || '';
    // Тот же поиск пар, что и при разборе: первая открывающая в тексте
    // вполне может оказаться упоминанием внутри <plan>, и замена «от неё до
    // ближайшей закрывающей» унесла бы всю прозу между ними.
    const matches = найтиБлокиHud(html, !толькоЗакрытые)
      .map(б => ({ index: б.from, length: б.to - б.from }));

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
    // И здесь пара должна быть ближайшей: закрывающую берём первую, а
    // открывающую — последнюю перед ней.
    const close = /(?:\[|<)\s*\/\s*HUD\s*(?:\]|>)/i;
    const closeMatch = fullText.match(close);
    const openAll = /(?:\[|<)\s*HUD\s*(?:\]|>)/ig;
    let openMatch = null;
    if (closeMatch) {
      for (let m2; (m2 = openAll.exec(fullText)) !== null; ) {
        if (m2.index + m2[0].length > closeMatch.index) break;
        openMatch = m2;
      }
    }
    if (openMatch) {
      {
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
  let застрявшиеТаймер = 0;

  function isPerformanceModeActive(container = cachedChatContainer) {
    if (!settings.performanceMode || !container) return false;
    // Живая коллекция: браузер держит её сам, а querySelectorAll на каждый
    // кадр прокрутки и на каждую запись наблюдателя собирал сотни узлов заново.
    return container.getElementsByClassName('mes').length >= PERFORMANCE_MESSAGE_THRESHOLD;
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
          restoreEvictedCard(mes);
          safeProcessMessage(mes);
          // Пока карточка на экране, её высота настоящая — запоминаем на
          // будущее, для заглушки. Меряем в следующем кадре: сразу после
          // разбора вёрстка ещё не устоялась.
          // Двойной кадр: первый отдаёт вёрстку браузеру, и только после
          // отрисовки content-visibility перестаёт отдавать заявленную высоту
          // вместо настоящей.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const text = mes.querySelector('.mes_text');
            const card = mes.querySelector('.hud-os-card');
            if (!text || !card) return;
            // У карточки, отрисовку которой браузер пропустил по
            // content-visibility, высота не настоящая, а заявленная в
            // contain-intrinsic-size. Такую запоминать нельзя: заглушка выходит
            // втрое выше карточки и раздувает прокрутку. Отличаем по самой
            // высоте — она совпадает с заявленной с точностью до рамки.
            // checkVisibility здесь бесполезен: он отвечает про «нужна ли
            // пользователю», а не про «пересчитана ли вёрстка», и говорит «да»
            // ещё до пересчёта.
            const карточка = card.getBoundingClientRect();
            // Только когда карточка по-настоящему в окне: наблюдатель зовёт
            // нас за полтора экрана до края, а там высота ещё заявленная.
            if (карточка.bottom <= 0 || карточка.top >= (window.innerHeight || 0)) return;
            const заявлено = parseFloat((getComputedStyle(card).containIntrinsicSize || '').split(/\s+/).pop()) || 0;
            if (заявлено && Math.abs(карточка.height - заявлено) <= 3) return;
            const h = Math.round(text.getBoundingClientRect().height);
            if (h > 40) {
              mes.__hudCardHeight = h;
              typicalCardHeight = h;
              // Типовую высоту знают и заглушки без своего замера, и ещё не
              // отрисованные карточки — через переменную на контейнере чата.
              // Зашитое число не годится: карточки в разных чатах разной
              // высоты, и промах в триста пикселей на две сотни свёрнутых
              // сообщений раздувал ленту и рвал прокрутку.
              const box = mes.closest('#chat') || cachedChatContainer;
              // Переменная стоит на всём чате: каждая её смена пересчитывает
              // стили всей ленты. На телефоне это было по пересчёту на каждую
              // карточку, въехавшую в кадр, — меняем только при заметной разнице.
              if (box && Math.abs(h - заявленнаяВысота) > 60) {
                заявленнаяВысота = h;
                box.style.setProperty('--hud-card-h', h + 'px');
              }
            }
          }));
        } else {
          mes.classList.remove('hud-perf-visible');
          if (isPerformanceModeActive(container)) {
            mes.classList.add('hud-perf-older');
            // Виртуализация: карточка уехала дальше полутора экранов (столько
            // даёт rootMargin) — разбираем её обратно в исходный текст. В DOM
            // остаётся заглушка той же высоты, и при возврате карточка
            // собирается заново из mes.__hudSource.
            if (settings.virtualizeCards !== false) collapseCard(mes, true);
          }
        }
      }
    }, {
      root: null,
      // Полтора экрана вперёд и назад вместо жёстких 900px: на телефоне это
      // перестало быть тремя экранами лишней работы, на большом мониторе —
      // меньше одного экрана запаса.
      rootMargin: Math.round((window.innerHeight || 800) * 1.5) + 'px 0px',
      // Ноль в списке — сообщение считается видимым, едва коснувшись края.
      threshold: [0, 0.01],
    });

    container.querySelectorAll('.mes').forEach(mes => performanceIntersectionObserver.observe(mes));
    refreshPerformanceMessageClasses();
  }

  // Оставляем в DOM только N последних карточек. Лишние — самые старые, то
  // есть первые сверху — сворачиваем до тонкой полоски. Текст сообщения при
  // этом не теряется: он лежит на элементе и вернётся при следующем показе.
  // Типовая высота карточки в этом чате. Заглушка без собственного замера
  // берёт её, иначе свёртка двух сотен карточек укорачивает ленту на десятки
  // тысяч пикселей и прокрутка прыгает. Стартовое значение — то же, что
  // объявлено в contain-intrinsic-size: столько браузер и так отводит
  // неотрисованной карточке, поэтому свёртка выходит нейтральной по высоте.
  let typicalCardHeight = 480;
  // Последнее значение, записанное в --hud-card-h.
  let заявленнаяВысота = 480;

  function живаяКарточка(textElement) {
    return Array.from(textElement.querySelectorAll('.hud-os-card'))
      .find(c => !c.closest('.hud-theme-preview')) || null;
  }

  // Заглушка рядом с живой карточкой лишняя: убираем её и снимаем пометку.
  function убратьЛишниеЗаглушки(mes, textElement) {
    const заглушки = textElement.querySelectorAll('.hud-evicted');
    if (!заглушки.length || !живаяКарточка(textElement)) return false;
    заглушки.forEach(з => з.remove());
    delete mes.dataset.hudEvicted;
    return true;
  }

  // Элемент касается окна (с запасом в пикселях сверху и снизу).
  function наЭкране(el, запас = 0) {
    const r = el.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    return r.height > 0 && r.bottom > -запас && r.top < h + запас;
  }

  // Самолечение: сообщение на экране, а карточка в нём свёрнута. Сотни
  // сообщений на каждой прокрутке не меряем — берём те, что лежат под
  // несколькими точками по высоте окна.
  function вернутьЗастрявшие() {
    const box = cachedChatContainer;
    if (!box || !box.querySelector('.mes[data-hud-evicted]')) return;
    const r = box.getBoundingClientRect();
    const h = window.innerHeight || 0;
    const верх = Math.max(r.top, 0), низ = Math.min(r.bottom, h);
    if (низ <= верх) return;
    const x = Math.round(r.left + r.width / 2);
    const найдены = new Set();
    for (let i = 1; i <= 7; i++) {
      const точка = document.elementFromPoint(x, Math.round(верх + (низ - верх) * i / 8));
      const mes = точка && точка.closest ? точка.closest('.mes') : null;
      if (mes && box.contains(mes)) найдены.add(mes);
    }
    найдены.forEach(mes => {
      if (!mes.dataset.hudEvicted) return;
      mes.classList.add('hud-perf-visible');
      mes.classList.remove('hud-perf-older');
      restoreEvictedCard(mes);
      safeProcessMessage(mes);
    });
  }

  // Свернуть карточку в заглушку. Высоту заглушки задаём по фактической
  // высоте карточки: при прокрутке вверх без этого лента схлопывается под
  // курсором и уезжает на сотни пикселей.
  function collapseCard(mes, keepHeight, спрятать = false) {
    if (!mes || mes.dataset.hudEvicted) return false;
    if (isMessageBeingEdited(mes)) return false;
    // Видимую карточку не сворачиваем никогда: обратно она бы не собралась,
    // потому что сообщение не покидает экран и наблюдателю не о чем сообщать.
    // Спрятанная карточка обратно не собирается, поэтому видимость ей не помеха.
    if (!спрятать && наЭкране(mes)) return false;
    const textElement = mes.querySelector('.mes_text');
    if (!textElement || !mes.__hudSource || !mes.querySelector('.hud-os-card')) return false;
    // Высоту берём запомненную — ту, что была у карточки, пока она была на
    // экране. Мерить прямо сейчас нельзя: сворачиваем мы именно ушедшую за
    // край карточку, а у неё из-за content-visibility работает не настоящая
    // высота, а заявленная contain-intrinsic-size. Заглушка тогда выходила
    // втрое выше самой карточки и раздувала прокрутку.
    // Без своего замера высоту заглушке даёт переменная --hud-card-h из CSS:
    // так уже расставленные заглушки поправятся, как только чат сообщит
    // настоящую высоту карточки.
    const height = keepHeight ? Number(mes.__hudCardHeight || 0) : 0;
    // Сворачиваем саму карточку, а не весь текст сообщения. Раньше заглушка
    // занимала место всего .mes_text, и проза вокруг карточки исчезала
    // вместе с ней — в старых сообщениях от ответа оставалась одна строчка
    // «HUD свёрнут».
    const карточка = Array.from(textElement.querySelectorAll('.hud-os-card'))
      .filter(c => !c.closest('.hud-theme-preview'))[0];
    if (!карточка) return false;
    const заглушка = document.createElement('div');
    заглушка.className = 'hud-evicted';
    заглушка.title = 'Карточка свёрнута ради скорости. Нажмите — соберётся заново.';
    заглушка.textContent = 'HUD свёрнут';
    заглушка.setAttribute('role', 'button');
    заглушка.tabIndex = 0;
    const развернуть = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      restoreEvictedCard(mes);
      safeProcessMessage(mes);
    };
    заглушка.addEventListener('click', развернуть);
    заглушка.addEventListener('keydown', развернуть);
    if (height > 40) заглушка.style.minHeight = height + 'px';
    карточка.replaceWith(заглушка);
    mes.dataset.hudEvicted = спрятать ? 'hidden' : '1';
    return true;
  }

  function enforceCardLimit() {
    const limit = Number(settings.hudCardLimit) || 0;
    if (limit <= 0) return;
    const container = cachedChatContainer;
    if (!container) return;
    const live = Array.from(container.querySelectorAll('.mes')).filter(
      mes => !mes.dataset.hudEvicted && mes.querySelector('.hud-os-card'));
    const extra = live.length - limit;
    if (extra <= 0) return;
    // Лимит срезает самые старые карточки — они далеко вверху, и держать их
    // высоту незачем: прокрутку это только удлинит.
    // Кандидаты — только вдали от экрана: листая вверх, читают как раз самые
    // старые карточки, и свернуть их на глазах нельзя.
    const запас = Math.round((window.innerHeight || 800) * 1.5);
    // «Прятать совсем»: старые карточки убираем сразу, даже на экране, —
    // они не возвращаются, и заглушки не видно. Живыми остаются последние N.
    const спрятать = settings.hideOldCards === true;
    const кандидаты = спрятать ? live : live.filter(mes => !наЭкране(mes, запас));
    for (let i = 0; i < extra && i < кандидаты.length; i++) collapseCard(кандидаты[i], false, спрятать);
  }

  // Обратная операция: вернуть исходник и собрать карточку заново.
  function restoreEvictedCard(mes) {
    if (!mes || !mes.dataset.hudEvicted) return false;
    // Спрятанную старую карточку не возвращаем, пока включено «прятать совсем».
    if (mes.dataset.hudEvicted === 'hidden' && settings.hideOldCards === true) return false;
    const textElement = mes.querySelector('.mes_text');
    if (!textElement) { delete mes.dataset.hudEvicted; return false; }
    if (убратьЛишниеЗаглушки(mes, textElement)) return false;
    const заглушка = textElement.querySelector('.hud-evicted');
    // Обычный путь: на месте заглушки возвращаем сам блок, а весь текст
    // вокруг остаётся нетронутым — вместе со всем, что дописали другие
    // расширения после нашей отрисовки.
    if (заглушка && mes.__hudBlock) {
      заглушка.outerHTML = mes.__hudBlock;
      delete mes.dataset.hudEvicted;
      return true;
    }
    // Запасной путь для сообщений, свёрнутых прошлыми версиями: у них
    // отдельного блока не запомнено, только исходник целиком.
    if (!mes.__hudSource) {
      // Вернуть нечего — хотя бы не оставляем вечную надпись «HUD свёрнут»:
      // разбор попробует достать блок из текущего свайпа.
      if (заглушка) заглушка.remove();
      delete mes.dataset.hudEvicted;
      return false;
    }
    textElement.innerHTML = mes.__hudSource;
    delete mes.dataset.hudEvicted;
    return true;
  }

  function schedulePerformanceRefresh() {
    if (performanceScrollRaf) return;
    performanceScrollRaf = requestAnimationFrame(() => {
      performanceScrollRaf = 0;
      enforceCardLimit();
      // Семь проб elementFromPoint на каждый кадр прокрутки заставляли
      // телефон пересчитывать вёрстку посреди инерции. Застрявшая карточка
      // никуда не денется — проверяем, когда палец отпустил ленту.
      clearTimeout(застрявшиеТаймер);
      застрявшиеТаймер = setTimeout(вернутьЗастрявшие, 200);
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
    if (!messageElement || isMessageBeingEdited(messageElement)) return;
    // Пока сообщение разбирается, повторный вызов раньше просто пропадал. Это
    // и ломало возврат свёрнутой карточки: IntersectionObserver возвращал
    // исходник и просил собрать карточку, а разбор в этот момент ещё шёл с
    // прошлого раза — просьба терялась, и сообщение оставалось голым текстом.
    // Запоминаем её и повторяем один раз, когда текущий разбор закончится.
    if (processingMessages.has(messageElement)) {
      messageElement.__hudReprocess = true;
      return;
    }
    processingMessages.add(messageElement);
    Promise.resolve(processMessage(messageElement))
      .catch(error => console.error('HUD Manager: processMessage failed', error))
      .finally(() => {
        processingMessages.delete(messageElement);
        if (messageElement.__hudReprocess) {
          delete messageElement.__hudReprocess;
          if (messageElement.isConnected) safeProcessMessage(messageElement);
        }
      });
  }

  function replaceHudBlockInText(source, newHudText) {
    if (typeof source !== 'string') return source;
    const hudRegex = hudBlockRe('i');
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
      const hudRegex = hudOpenRe('i');
      const newHud = extractHudBlock(newText);

      if (hudRegex.test(displayText)) {
        message.extra.display_text = replaceHudBlockInText(displayText, newHud);
      } else if (newHud && hudRegex.test(newHud)) {
        message.extra.display_text = displayText.trimEnd() + '\n\n' + newHud;
      }
    }
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
            const extractRegex = hudBlockRe('ig', true);
            
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
            // Снимок — последний HUD до перегенерируемого сообщения; решение о
            // близости — по нему и по самому сообщению, для которого пишем HUD.
            let объектСнимкаРеген = null;
            // Число развёрнутых читаем так же, как перехват запроса: нечитаемое
            // значение — это значение по умолчанию, а не 0. Раньше здесь пустое поле
            // выключало снимок, а в обычном ответе снимок был.
            const развёрнутыхРеген = (() => { const n = parseInt(settings.hudsToKeep, 10); return isNaN(n) || n < 0 ? (defaultSettings.hudsToKeep ?? 1) : n; })();
            if (settings.hudSnapshot !== false && развёрнутыхРеген > 0) {
                for (let j = mesIdNum - 1; j >= 0 && !объектСнимкаРеген; j--) {
                    const m = chatData[j];
                    if (!m || m.is_user || m.is_system) continue;
                    const текстХода = m.swipes && m.swipes[m.swipe_id] !== undefined ? m.swipes[m.swipe_id] : m.mes;
                    const блок = extractHudBlock(String(текстХода || ''));
                    if (блок) объектСнимкаРеген = собратьСнимок(блок);
                }
            }
            const nsfwРеген = решитьNSFW(объектСнимкаРеген, последниеТекстыЧата(chatData, mesIdNum + 1));
            const strictBasePrompt = раскрытьИнструкцию(buildDynamicPrompt({ nsfw: nsfwРеген, режим: 'regen' }), объектСнимкаРеген ? строкаСнимка(объектСнимкаРеген, nsfwРеген) : '');

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


        let allMatchesRegen = [];
        freshMessages.forEach((msg, mIdx) => {
            // Do not scan injected system/HUD instructions. buildDynamicPrompt()
            // intentionally contains a literal [HUD] schema example. Scanning it here
            // makes the regen code try to parse its own instructions as an old HUD,
            // which can fail BEFORE the API request is even sent.
            if (!hudSummaryEligibleMessages.has(msg)) return;
            if (typeof msg.content === 'string') {
                const regexLocal = hudBlockRe('ig', true);
                let match;
                while ((match = regexLocal.exec(msg.content)) !== null) {
                    allMatchesRegen.push({ mIdx, index: match.index, length: match[0].length });
                }
            }
        });

        let hudsToKeep = parseInt(settings.hudsToKeep, 10);
        if (isNaN(hudsToKeep) || hudsToKeep < 0) hudsToKeep = defaultSettings.hudsToKeep ?? 1;
        
        {
            // Со снимком последний блок истории вырезается (он уже в снимке),
            // полными остаются hudsToKeep − 1 перед ним, старше — сводки. Без
            // снимка — полными последние hudsToKeep, как раньше.
            const естьСнимок = !!объектСнимкаРеген && allMatchesRegen.length > 0;
            const конец = естьСнимок ? allMatchesRegen.length - 1 : allMatchesRegen.length;
            const начало = Math.max(0, конец - (естьСнимок ? hudsToKeep - 1 : hudsToKeep));
            const toSummarize = allMatchesRegen.filter((_, i) => i < начало || i >= конец);
            // Сортируем с конца в начало, чтобы не сбить индексы при замене текста
            toSummarize.sort((a, b) => (a.mIdx !== b.mIdx ? b.mIdx - a.mIdx : b.index - a.index));

            // Последний блок истории уходит в снимок — из истории вырезаем целиком.
            const вСнимке = естьСнимок ? allMatchesRegen[allMatchesRegen.length - 1] : null;
            toSummarize.forEach(rm => {
                let content = freshMessages[rm.mIdx].content;
                if (rm === вСнимке) {
                    const хвостДо = content.slice(0, rm.index).match(/\s*$/)[0];
                    const головаПосле = content.slice(rm.index + rm.length).match(/^\s*/)[0];
                    const до = content.slice(0, rm.index - хвостДо.length);
                    const после = content.slice(rm.index + rm.length + головаПосле.length);
                    const без = до && после ? до + (головаПосле || хвостДо) + после : (до || после);
                    if (без.trim()) { freshMessages[rm.mIdx].content = без; return; }
                }
                let hudBlockText = content.substring(rm.index, rm.index + rm.length);
                const прошлый = allMatchesRegen[allMatchesRegen.indexOf(rm) - 1];
                const прошлыйТекст = прошлый ? freshMessages[прошлый.mIdx].content.substring(прошлый.index, прошлый.index + прошлый.length) : '';
                let сводка;
                try { сводка = сводкаHUD(hudBlockText, прошлыйТекст); } catch (_) { return; }
                freshMessages[rm.mIdx].content = content.slice(0, rm.index) + '\n' + сводка + '\n' + content.slice(rm.index + rm.length);
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
            // Перехват узнаёт этот запрос по <hud_instructions> в теле и
            // пропускает — глобальный флаг здесь больше не нужен.
            const res = await fetch(requestUrl, { method: 'POST', headers: requestHeaders, cache: 'no-cache', body: JSON.stringify(hudRequestBody) });
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
            // Сохраняем HUD в кодах — тем же форматом, каким его пишет модель.
            // Развёрнутые русские ключи в истории противоречили правилу «только
            // коды» и учили модель обратному. Страховка: если разбор кодовой
            // версии хоть в чём-то расходится с исправленной, оставляем её.
            try {
              const внутри = (String(aiText).match(hudBlockRe('i', true)) || [])[1];
              const вКодах = внутри ? HUDвКодах(внутри) : null;
              if (вКодах && Object.keys(вКодах).length) {
                const кодами = '[HUD]\n```json\n' + JSON.stringify(вКодах, null, 2) + '\n```\n[/HUD]';
                if (JSON.stringify(parseHUDComplex(кодами)) === JSON.stringify(parseHUDComplex(newHudText))) newHudText = кодами;
              }
            } catch (_) { /* остаётся исправленный блок */ }

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

  // Кнопка «❓»: окно вопросов о сюжете. Ответ модели в чат не пишется.
  // Лорбуки для ассистента: записи, сработавшие по ключам на вопросе и
  // последних сообщениях, либо книги целиком — как выбрано в настройках.
  async function лорбукиДляАссистента(names, scanText, все) {
    const stContext = getStContextSafe();
    const out = [];
    for (const name of (Array.isArray(names) ? names : []).filter(Boolean)) {
      const data = await loadHudLorebook(name);
      const entries = data && Array.isArray(data.entries) ? data.entries
        : (data && data.entries && typeof data.entries === 'object' ? Object.values(data.entries) : []);
      const тексты = entries
        .filter(entry => все ? true : hudLoreEntryActivates(entry, scanText, stContext))
        .map(normalizeHudLoreEntry)
        .filter(Boolean);
      if (тексты.length) out.push({ name, entries: тексты });
    }
    return out;
  }

  // Профили подключения: сначала те, что Connection Manager умеет
  // использовать, иначе весь сохранённый список.
  function списокПрофилей() {
    const ctx = getStContextSafe();
    const служба = ctx && ctx.ConnectionManagerRequestService;
    try {
      if (служба && typeof служба.getSupportedProfiles === 'function') {
        const p = служба.getSupportedProfiles();
        if (Array.isArray(p) && p.length) return p;
      }
    } catch (_) { /* ниже запасной путь */ }
    const cm = ctx && ctx.extensionSettings && ctx.extensionSettings.connectionManager;
    return cm && Array.isArray(cm.profiles) ? cm.profiles : [];
  }

  function bindHudAskButton(btn) {
    if (!btn || btn.dataset.hudClickBound === 'true') return;
    btn.dataset.hudClickBound = 'true';
    const открыть = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const mes = btn.closest('.mes');
      const id = mes ? Number(mes.getAttribute('mesid')) : NaN;
      openAssistantDialog({ mesId: Number.isInteger(id) ? id : null, лорбуки: лорбукиДляАссистента, сохранить: saveSettings, профили: списокПрофилей });
    };
    btn.addEventListener('click', открыть, true);
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') открыть(e); });
  }

  function bindHudRegenButton(regenBtn) {
    if (!regenBtn || regenBtn.dataset.hudClickBound === 'true') return;
    regenBtn.dataset.hudClickBound = 'true';
    // Соседняя кнопка «❓» живёт в той же панели и собирается вместе с ней.
    const спросить = regenBtn.parentElement && regenBtn.parentElement.querySelector('.hud-ask-btn');
    if (спросить) bindHudAskButton(спросить);

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
    // Разметка строится из мелких кирпичиков: одна строка на галочку и одна
    // на числовое поле. Идентификаторы прежние — обработчики ниже их и ищут.
    const галка = (id, включено, текст, пояснение = '') =>
      '<label class="hud-set-check"' + (пояснение ? ' title="' + пояснение + '"' : '') + '><input type="checkbox" id="' + id + '" ' + (включено ? 'checked' : '') + '><span>' + текст + '</span></label>';
    const число = (id, мин, макс, значение, ширина = 52, шаг = '') =>
      '<input type="number" id="' + id + '" min="' + мин + '" max="' + макс + '"' + (шаг ? ' step="' + шаг + '"' : '') + ' value="' + значение + '" class="hud-set-num" style="width:' + ширина + 'px">';
    const группа = (заголовок, тело) => '<details class="hud-set-group"><summary>' + заголовок + '</summary><div class="hud-set-body">' + тело + '</div></details>';
    const подгруппа = (заголовок, тело) => '<details class="hud-set-group hud-set-sub"><summary>' + заголовок + '</summary><div class="hud-set-body">' + тело + '</div></details>';
    const заметка = (текст) => '<div class="hud-set-note">' + текст + '</div>';

    wrapper.innerHTML = `
      <summary style="font-weight:bold; cursor:pointer; color:var(--hud-accent); outline: none;">📊 TavernOS v${hudVersionLabel()}</summary>
      <div style="padding-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">

      <div class="hud-set-tools">
        <button type="button" id="hud-open-archive" class="hud-set-tool-btn">🗄 Архив HUD</button>
        <span class="hud-set-tool-note">Сводка по всей истории чата: как менялись секреты и отношения, сколько прошло дней, где что происходило.</span>
      </div>

      ${группа('🧩 Блоки HUD', `
        ${галка('hud-auto-inject', settings.autoInject, '🔌 Сетевой перехват (инжект промпта)', 'Схема HUD добавляется в каждый запрос к модели. Без этого модель HUD не пишет.')}
        ${галка('hud-enable-user', settings.enableUserBlock, '👤 {{user}} — блок игрока', 'Отдельный блок {{user}}: одежда, внешность, здоровье, отношения, локация.')}

        ${подгруппа('🕰 Эпоха: телефон или шкатулка', `
          <label class="hud-set-check">Эпоха сеттинга:
            <select id="hud-era" class="hud-theme-select-input">
              <option value="modern" ${settings.era !== 'medieval' ? 'selected' : ''}>📱 Современность — телефон и перехваты</option>
              <option value="medieval" ${settings.era === 'medieval' ? 'selected' : ''}>🗝️ Средневековье — шкатулка и подслушанное</option>
            </select>
          </label>
          ${заметка('Работает только одна пара. В средневековье (любой век до телефонов) вместо телефона — шкатулка с письмами, святцами, кошелём, записями, картой, грамотами и памятками, а вместо перехватов — подслушанные разговоры и вскрытые чужие письма.')}
          <div class="hud-era-block" data-era="medieval" ${settings.era === 'medieval' ? '' : 'hidden'}>
          ${галка('hud-enable-casket', settings.enableCasket !== false, '🗝️ Шкатулка персонажа')}
          <div class="hud-set-apps">
            ${[['castAppLetters','✉️ Письма'],['castAppCalendar','📅 Святцы'],['castAppPurse','💰 Кошель'],
               ['castAppNotes','🪶 Записи'],['castAppMap','🗺️ Карта'],['castAppDocs','📜 Грамоты'],['castAppKeeps','🎀 Памятки']]
              .map(([k, label]) => `<label><input type="checkbox" data-phone-app-key="${k}" ${settings[k] !== false ? 'checked' : ''}> ${label}</label>`).join('')}
          </div>
          ${галка('hud-enable-overheard', settings.enableOverheard !== false, '👂 Подслушанное (чужие разговоры и письма)')}
          </div>
          <div class="hud-era-block" data-era="modern" ${settings.era === 'medieval' ? 'hidden' : ''}>
          ${галка('hud-enable-phone', settings.enablePhone, '📱 Личный телефон')}
          ${заметка('Экраны телефона можно включать по одному. Выключенный не просится у модели и не занимает места в запросе — весь телефон целиком стоит около 800 токенов на каждый ход, и половина из них уходит на экраны, которыми вы, возможно, не пользуетесь.')}
          <div class="hud-set-apps">
            ${[['phoneAppMessages','💬 Сообщения'],['phoneAppContacts','👤 Контакты'],['phoneAppWallet','💳 Кошелёк'],
               ['phoneAppCalendar','📅 Календарь'],['phoneAppGallery','🖼️ Галерея'],['phoneAppNotes','📝 Заметки'],
               ['phoneAppMaps','🗺️ Карты'],['phoneAppSearch','🔍 Поиск']]
              .map(([k, label]) => `<label><input type="checkbox" data-phone-app-key="${k}" ${settings[k] !== false ? 'checked' : ''}> ${label}</label>`).join('')}
          </div>
          ${галка('hud-enable-intercepts', settings.enableIntercepts, '📡 Перехваты (чужие телефоны)')}
          </div>
        `)}

        ${подгруппа('🧠 Память', `
          ${галка('hud-enable-memory', settings.enableMemory, '🧠 Память (события, настроение, маршрут, секреты)', 'Таймлайн, настроение двух главных персонажей, маршруты и секреты')}
          ${галка('hud-enable-guns', settings.enableGuns !== false, '🔫 Ружья Чехова', 'Незакрытые сюжетные нити во вкладке памяти: обещания, угрозы, намёки, загадки. Просится у модели.')}
          <label class="hud-set-check">📏 Максимальная высота Памяти: ${число('hud-memory-max-height', 200, 600, settings.memoryMaxHeight, 70)} px</label>
        `)}

        ${подгруппа('👤 Персонажи', `
          ${галка('hud-enable-illness', settings.enableIllness !== false, '🩹 Болезни и травмы', 'Болезни и травмы со стадией, симптомами, лечением и шкалой выздоровления — у персонажей и у игрока. Просится у модели, пишется только когда есть.')}
          ${галка('hud-enable-pregnancy', settings.enablePregnancy !== false, '🤰 Беременность', 'Срок, триместр, симптомы и дата родов у того, кто беременен. Просится у модели, пишется только когда есть.')}
          ${галка('hud-enable-menstruation', settings.enableMenstruation !== false, '🌸 Менструальный цикл', 'День цикла, фаза, ожидаемые месячные, окно ПМС и задержка — кольцом, с советами по фазе. Только у тех, у кого есть матка, в том числе у игрока.')}
          ${галка('hud-enable-perception', settings.enablePerception !== false, '👁 Что о тебе думают', 'Как к вам относится каждый персонаж и насколько доверяет. Считается из карточек, модель ничего не дописывает.')}
          ${галка('hud-enable-familytree', settings.enableFamilyTree !== false, '🌳 Генеалогическое дерево', 'Вторым видом в графе отношений: родители, дети, супруги, братья и сёстры по родству из «Отношений». Появляется, только когда родство есть.')}
          ${галка('hud-enable-companions', settings.enableCompanions !== false, '🐾 Спутники', 'Животные, фамильяры, дроны: настроение, состояние, рацион, привязанность. Своя вкладка, появляется, только когда спутники есть.')}
        `)}

        ${подгруппа('🔞 Близость', `
          ${галка('hud-enable-intimacy-extras', settings.enableIntimacyExtras !== false, '🔞 Подробности сцены', 'Поза, раунд, длительность, защита, готовность к оргазму, пульс, дыхание и температура, звуки, следы на теле с таймером. Просится у модели только во время близости.')}
          ${галка('hud-enable-heatmap', settings.enableHeatMap !== false, '🫦 Карта тела картинкой', 'Чувствительность зон — заливкой на силуэте спереди и сзади, со следами на теле. Выключено — прежний список зон со шкалами.')}
        `)}

        ${подгруппа('📖 Дневник, сны и мир', `
          ${галка('hud-enable-diary', settings.enableDiary, '📖 Дневник')}
          ${галка('hud-enable-dreams', settings.enableDreams, '🌙 Сновидения')}
          ${галка('hud-enable-world', settings.enableWorld, '🌍 Мир (новости, слухи)')}
          ${галка('hud-enable-economy', settings.enableEconomy !== false, '💹 Экономика', 'Курсы валют, цены и зарплаты мира — по строке на каждое.')}
          ${галка('hud-enable-events', settings.enableEvents !== false, '🎭 Афиша', 'Что идёт в кино, театре, на концертах и на улице — готовые зацепки для сцены.')}
          ${галка('hud-enable-city', settings.enableCity !== false, '🏛 Городские службы', 'Пробки, дороги, транспорт, коммунальные службы и ЧП.')}
          ${галка('hud-enable-horoscope', settings.enableHoroscope !== false, '🔮 Гороскоп', 'Знаки зодиака на день и общая удача. Чистое развлечение — прогноз погоды остаётся и без него.')}
        `)}
      `)}

      ${группа('✨ Отображение', `
        ${галка('hud-show-hints', settings.showHints !== false, '❔ Показывать пояснения', 'Рядом с названием вкладки и рядом со знакомыми полями появляется маленький вопросик. По нажатию разворачивается объяснение: за что отвечает, почему показалось и как читать.')}


        ${подгруппа('🧷 Списки из прошлых ходов', `
          ${галка('hud-carry-over', settings.carryOver !== false, '🧷 Держать списки из прошлых ходов', 'Переписки, секреты, важное, заметки, календарь и новости из прошлых ходов остаются на экране, даже если модель перестала их повторять. Работает только на отрисовке: в запрос к модели не уходит ни одного лишнего символа.')}
          <div class="hud-set-apps">
            <label title="Сколько предыдущих ходов просматривать. Больше — дольше собирается карточка.">Ходов назад: ${число('hud-carry-turns', 0, 200, settings.carryTurns)}</label>
            <label title="Предел длины каждого списка: секретов, заметок, событий календаря и прочего.">Записей в списке: ${число('hud-carry-items', 1, 200, settings.carryMaxItems)}</label>
            <label title="Предел длины одной переписки в телефоне и в перехватах.">Сообщений в чате: ${число('hud-carry-msgs', 1, 500, settings.carryMaxMessages)}</label>
          </div>
        `)}
      `)}

      ${группа('⚡ Производительность', `
        ${галка('hud-lighten-old', settings.lightenOldCards !== false, '🪶 Облегчать старые свёрнутые карточки', 'У старой свёрнутой карточки в странице остаётся только заголовок. Панель темы и содержимое откладываются и возвращаются при первом касании карточки. Заметно легче в длинных чатах, особенно на телефоне.')}
        ${галка('hud-lazy-tabs', settings.lazyTabs !== false, '🗂️ Ленивая загрузка вкладок', 'Собирается только открытая вкладка. Остальные (Телефон, Память, Мир и так далее) строятся в тот момент, когда вы на них переключаетесь, и дальше остаются готовыми. Заметно легче на карточках с большим HUD.')}

        ${подгруппа('📜 Длинные чаты (200+ сообщений)', `
          ${галка('hud-performance-mode', settings.performanceMode, '⚡ Performance Mode', 'При 200+ сообщениях отключает тяжёлую повторную обработку старых сообщений, замораживает их анимации/эффекты и обрабатывает HUD по мере прокрутки.')}
          ${галка('hud-virtualize', settings.virtualizeCards !== false, '🪟 Держать в DOM только карточки рядом с экраном', 'Внутри Performance Mode: карточка, уехавшая дальше полутора экранов от края, разбирается обратно в текст, а на её месте остаётся заглушка той же высоты. При возвращении карточка собирается заново.')}
          ${заметка('Включается само только в чатах от 200 сообщений на странице. Старые блоки остаются рабочими и догружаются при прокрутке.')}
        `)}

        ${подгруппа('🧹 Лимит карточек', `
          ${заметка('Каждая собранная карточка HUD — это сотни элементов страницы. Если вписать число, в памяти останутся только последние N карточек, а <b>самые старые</b> свернутся до тонкой полоски. Текст сообщения никуда не денется: долистаете до него — карточка соберётся заново.<br>0 — ограничение выключено.')}
          <label class="hud-set-check">🧹 Держать в памяти карточек: ${число('hud-card-limit', 0, 2000, settings.hudCardLimit || 0, 80, 10)} шт.</label>
          ${галка('hud-hide-old-cards', settings.hideOldCards === true, '🙈 Прятать старые карточки совсем', 'Карточки сверх лимита пропадают без следа: без полоски «HUD свёрнут», и при прокрутке они не собираются. Прячется только HUD — текст сообщения на месте, а сам блок [HUD] в сообщении не трогается, модель его по-прежнему видит. Работает, когда лимит больше нуля.')}
          ${заметка('🙈 Со включённой галкой старые карточки сверх лимита исчезают целиком — остаётся только текст сообщения. Сам HUD в сообщении не удаляется: модель его видит, а выключив галку, карточки можно вернуть.')}
        `)}
      `)}

      ${группа('🖼️ Аватарки персонажей', `
        <div style="font-size:12px; opacity:.78;">Одна картинка — на любое число имён: впишите их через запятую, вместе с английским написанием. Аватарка встанет всюду, где сейчас кружок с инициалами: блок персонажей, чаты телефона, перехваты.</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="hud-ava-add" style="cursor:pointer;">➕ Добавить изображение</button>
          <span id="hud-ava-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <div id="hud-ava-list" class="hud-ava-list"></div>
        <div style="font-size:12px; opacity:.78; margin-top:2px;">Закреплённые аватарки — страховка на случай, когда картинка из чата достаётся не тому: если у {{char}} указаны имена, никто, кроме них, его фото уже не получит.</div>
        <div id="hud-ava-pinned" class="hud-ava-list"></div>
        <input type="file" id="hud-ava-file" accept="image/*" style="display:none">
      `)}

      ${группа('📚 Лорбуки', `
        <div style="font-size:12px; opacity:.78;">Выбери один или несколько. Их записи + описание карточки чара + Persona добавляются только в отдельный запрос создания/регенерации HUD. Обычный HUD-инжект не меняется.</div>
        <select id="hud-lorebooks" multiple size="6" style="width:100%; min-height:110px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:4px; border-radius:5px;"></select>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="hud-lorebooks-refresh" style="cursor:pointer;">🔄 Обновить список</button>
          <button type="button" id="hud-lorebooks-clear" style="cursor:pointer;">Очистить выбор</button>
          <span id="hud-lorebooks-status" style="font-size:11px; opacity:.75;"></span>
        </div>
        <label class="hud-set-check" title="Сколько последних сообщений чата уходит модели, когда она пишет запись лорбука по кнопке «Написать моделью» в окне «Запомнить». Больше сообщений — точнее контекст, но дороже запрос. 0 = без контекста сцены, только сам факт.">📚 В запись лорбука слать последние ${число('hud-lore-context', 0, 50, settings.loreContextMessages, 40)} сообщ.</label>
      `)}

      ${группа('🤖 Генерация', `
        <label class="hud-set-check" title="Отдельный лимит токенов только для запроса создания/регенерации HUD.">🧠 Лимит токенов HUD: ${число('hud-max-tokens', 256, 32768, settings.hudMaxTokens, 70)}</label>
        ${галка('hud-prompt-separate', settings.hudPromptSeparate !== false, '🧩 Инструкция HUD отдельным сообщением', 'Задача, правила, схема и снимок уходят последним сообщением — после пресета, карточки, лорбуков и истории. Выключите, если бэкенд не принимает системное сообщение в конце: тогда инструкция дописывается к последнему сообщению, как раньше.')}
        ${галка('hud-snapshot', settings.hudSnapshot !== false, '📸 Снимок последнего HUD в конце инструкции', 'Последний HUD в коротких кодах, без пустых полей: модель обновляет его под новый ответ, а не собирает мир заново. Последний HUD не дублируется: из истории он вырезается и переезжает в снимок. Снимок считается одним из развёрнутых HUD.')}
        <label class="hud-set-check" title="После ответа HUD проверяется на поля, которые схема требует каждый ход: мысли и «ожидание и реальность» каждого персонажа, дневник и гороскоп, если они включены. Условные поля (сны, дневник тела, подтекст, комментарии) не проверяются. Одна попытка на ответ; если вы сами остановили генерацию, проверки нет.">🩺 Неполный HUD:
          <select id="hud-complete-check" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="regen"${(settings.hudCompleteCheck || 'regen') === 'regen' ? ' selected' : ''}>Досоздавать перегенерацией</option>
            <option value="warn"${settings.hudCompleteCheck === 'warn' ? ' selected' : ''}>Только предупреждать</option>
            <option value="off"${settings.hudCompleteCheck === 'off' ? ' selected' : ''}>Не проверять</option>
          </select>
        </label>
        <label class="hud-set-check" title="Правила и поля близости — самая тяжёлая часть промта. «Авто»: только когда сцена идёт по последнему HUD или начинается по словам последних сообщений. Кинки, фетиши и история секса на экране не пропадают — HUD берёт их из прошлых ходов.">🔞 Часть про близость:
          <select id="hud-nsfw-prompt" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="auto"${(settings.nsfwPrompt || 'auto') === 'auto' ? ' selected' : ''}>Авто — когда сцена идёт</option>
            <option value="always"${settings.nsfwPrompt === 'always' ? ' selected' : ''}>Всегда</option>
            <option value="never"${settings.nsfwPrompt === 'never' ? ' selected' : ''}>Никогда</option>
          </select>
        </label>
        <label class="hud-set-check" title="Сколько последних HUD модель видит полностью, остальные сжимаются в сводку [HUD_SUMMARY]. Снимок в конце инструкции считается одним из них: при 1 (рекомендуется) — только снимок, при 2 — снимок и один полный HUD в истории (+тысячи токенов). 0 = все HUD сжаты в сводку, снимка нет. Сводки работают и при выключенном сетевом перехвате.">💾 Сколько развернутых HUD оставлять: ${число('hud-keep-count', 0, 10, settings.hudsToKeep, 40)}</label>
        <label class="hud-set-check" title="Сколько последних сообщений отправлять модели при нажатии на 🔄 (регенерация HUD). 0 = отправлять всю историю чата до этого сообщения.">⚡ При регене HUD слать последние ${число('hud-regen-context', 0, 50, settings.regenContextMessages, 40)} сообщ.</label>
        <label class="hud-set-check" title="Позволяет перегенерировать HUD (🔄) через ДРУГОЙ сохранённый профиль подключения">
          🧠 Профиль для регена HUD:
          <select id="hud-regen-profile" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;">
            <option value="">Основной (текущий активный)</option>
          </select>
          <span id="hud-regen-profile-refresh" title="Обновить список профилей" style="cursor:pointer;">🔄</span>
        </label>
      `)}

      ${группа('❓ Ассистент', `
        ${галка('hud-enable-assistant', settings.enableAssistant !== false, '❓ Кнопка «Спросить про сюжет»', 'Кнопка ❓ на карточке открывает окно вопросов о сюжете. Каждый вопрос — отдельный запрос к модели; в чат ничего не пишется.')}
        ${заметка('Помощник к истории и HUD: объясняет, почему персонажи ведут себя так, что скрывают и что может случиться дальше. Отвечает по тому, что вы ему дадите ниже: больше контекста — точнее ответ, но дороже запрос.')}

        ${подгруппа('📥 Что видит ассистент', `
          <label class="hud-set-check">💬 Последних сообщений: ${число('hud-ask-messages', 0, 60, settings.assistantContextMessages ?? 12, 52)}</label>
          ${галка('hud-ask-hud', settings.assistantIncludeHud !== false, '📊 HUD сообщения', 'Снимок состояния истории: мысли, скрытый подтекст, отношения, доверие, страхи, секреты, ружья Чехова.')}
          ${галка('hud-ask-note', settings.assistantIncludeNote !== false, '📝 Заметки автора', 'То, что вписано в Author’s Note этого чата.')}
          ${галка('hud-ask-card', settings.assistantIncludeCard !== false, '🎭 Карточка персонажа', 'Описание, характер и сценарий из карточки.')}
          ${галка('hud-ask-persona', settings.assistantIncludePersona !== false, '👤 Персона игрока', 'Описание вашей персоны.')}
          ${заметка('Лорбуки ассистента — отдельно от лорбуков перегенерации HUD. Можно выбрать несколько.')}
          <select id="hud-ask-lorebooks" multiple size="5" style="width:100%; min-height:96px; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:4px; border-radius:5px;"></select>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button type="button" id="hud-ask-refresh" style="cursor:pointer;">🔄 Обновить списки</button>
            <span id="hud-ask-lorebooks-status" style="font-size:11px; opacity:.75;"></span>
          </div>
          ${галка('hud-ask-lore-all', settings.assistantLoreAll === true, '📚 Все записи выбранных лорбуков', 'Выключено — только записи, чьи ключи встречаются в вопросе и в последних сообщениях, как в самой таверне.')}
        `)}

        ${подгруппа('🧠 Модель и промпт', `
          <label class="hud-set-check" title="Через какой профиль подключения задавать вопросы. Можно взять модель подешевле, чем для самой истории.">🧠 Профиль:
            <select id="hud-ask-profile" style="flex:1; min-width:0; background: rgba(0,0,0,0.3); border: 1px solid var(--hud-border); color: #fff; padding: 2px 4px; border-radius: 4px;"><option value="">Модель чата (текущее подключение)</option></select>
          </label>
          <label class="hud-set-check">📏 Лимит ответа: ${число('hud-ask-tokens', 256, 16000, settings.assistantMaxTokens ?? 1500, 70)} токенов</label>
          ${заметка('Системный промпт ассистента. Правьте под себя; кнопка ниже возвращает встроенный.')}
          <textarea id="hud-ask-system" rows="8" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,.3); border:1px solid var(--hud-border); color:#fff; padding:6px; border-radius:5px; font-size:12px; resize:vertical;">${escapeHtml(settings.assistantSystemPrompt || ПРОМПТ_АССИСТЕНТА)}</textarea>
          <button type="button" id="hud-ask-system-reset" class="hud-theme-act" style="align-self:flex-start;">↺ Вернуть встроенный</button>
        `)}
      `)}

      ${группа('🧹 Обслуживание', `
        <div style="font-size:12px; opacity:.78;">Отчёты «Архива HUD» лежат в браузере и разбираются заново только после изменения чата. Если их накопилось много или они начали мешать — уберите.</div>
        <div class="hud-set-apps" style="align-items:center;">
          <span id="hud-cache-usage" style="font-size:12px; opacity:.78;">считаю…</span>
          <button type="button" id="hud-clear-cache" class="hud-theme-act danger" title="Убрать отчёты архива и пометки-реакции. Настройки, темы и аватарки останутся.">🧹 Почистить кэш</button>
        </div>
      `)}

      </div>`;
    container.appendChild(wrapper);

    // --- Обслуживание -------------------------------------------------------
    // Размер считаем лениво: лезть в IndexedDB на каждой отрисовке настроек
    // незачем, а пока считается — показываем «считаю…».
    const показатьОбъём = () => {
      const метка = document.getElementById('hud-cache-usage');
      if (!метка) return;
      cacheUsage().then(({ записей, байт }) => {
        if (!метка.isConnected) return;
        метка.textContent = записей
          ? `отчётов: ${записей} · примерно ${(байт / 1048576).toFixed(байт > 1048576 ? 1 : 2)} МБ`
          : 'кэш пуст';
      }).catch(() => { метка.textContent = 'размер посчитать не удалось'; });
    };
    показатьОбъём();
    document.getElementById('hud-clear-cache').addEventListener('click', async (e) => {
      const кнопка = e.currentTarget;
      кнопка.disabled = true;
      try {
        const убрано = await clearCache();
        clearReactions();
        showHudToast('success', 'Кэш очищен', убрано ? `Убрано отчётов: ${убрано}. Пометки-реакции тоже сняты.` : 'Отчётов не было. Пометки-реакции сняты.');
      } catch (err) {
        console.error('[TavernOS HUD] очистка кэша не удалась:', err);
        showHudToast('error', 'Очистить не вышло', 'Подробности в консоли.');
      } finally {
        кнопка.disabled = false;
        показатьОбъём();
      }
    });

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
              // WebP при том же качестве весит примерно на треть меньше
              // JPEG, а настройки SillyTavern — один общий JSON-файл, и
              // каждая аватарка лежит в нём как data-URL. Если браузер WebP
              // не умеет, toDataURL молча отдаёт PNG — это видно по началу
              // строки, и тогда откатываемся на JPEG.
              const webp = c.toDataURL('image/webp', 0.82);
              resolve(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82));
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

    document.getElementById('hud-auto-inject').addEventListener('change', (e) => { settings.autoInject = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-phone').addEventListener('change', (e) => { settings.enablePhone = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-intercepts').addEventListener('change', (e) => { settings.enableIntercepts = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-casket').addEventListener('change', (e) => { settings.enableCasket = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-overheard').addEventListener('change', (e) => { settings.enableOverheard = e.target.checked; saveSettings(); });
    // Эпоха: показываем переключатели только своей пары.
    document.getElementById('hud-era').addEventListener('change', (e) => {
      settings.era = e.target.value === 'medieval' ? 'medieval' : 'modern';
      document.querySelectorAll('.hud-era-block').forEach(b => { b.hidden = b.dataset.era !== settings.era; });
      saveSettings();
    });
    document.getElementById('hud-enable-diary').addEventListener('change', (e) => { settings.enableDiary = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-dreams').addEventListener('change', (e) => { settings.enableDreams = e.target.checked; saveSettings(); });
    document.getElementById('hud-enable-world').addEventListener('change', (e) => { settings.enableWorld = e.target.checked; saveSettings(); });
    [['hud-enable-guns', 'enableGuns'], ['hud-enable-illness', 'enableIllness'], ['hud-enable-pregnancy', 'enablePregnancy'],
     ['hud-enable-companions', 'enableCompanions'], ['hud-enable-perception', 'enablePerception'], ['hud-enable-familytree', 'enableFamilyTree'], ['hud-enable-assistant', 'enableAssistant'],
     ['hud-enable-menstruation', 'enableMenstruation'], ['hud-enable-intimacy-extras', 'enableIntimacyExtras'], ['hud-enable-heatmap', 'enableHeatMap'],
     ['hud-enable-economy', 'enableEconomy'], ['hud-enable-events', 'enableEvents'], ['hud-enable-city', 'enableCity'], ['hud-enable-horoscope', 'enableHoroscope'],
     ['hud-prompt-separate', 'hudPromptSeparate'], ['hud-snapshot', 'hudSnapshot']].forEach(([id, ключ]) => {
      const поле = document.getElementById(id);
      if (поле) поле.addEventListener('change', (e) => { settings[ключ] = e.target.checked; saveSettings(); });
    });
    document.getElementById('hud-nsfw-prompt')?.addEventListener('change', (e) => {
      settings.nsfwPrompt = ['auto', 'always', 'never'].includes(e.target.value) ? e.target.value : 'auto';
      saveSettings();
    });
    document.getElementById('hud-complete-check')?.addEventListener('change', (e) => {
      settings.hudCompleteCheck = ['regen', 'warn', 'off'].includes(e.target.value) ? e.target.value : 'regen';
      saveSettings();
    });
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
    document.getElementById('hud-open-archive').addEventListener('click', async () => {
      // Модуль архива грузим по требованию: он нужен раз в сессию, а тянет
      // за собой окно и вёрстку отчёта. Версию пишем литералом — её
      // подменяет bump-version.cjs, как и во всех остальных импортах.
      try {
        const mod = await import('./render/archive.js?v=22.99.91');
        mod.openArchiveDialog();
      } catch (e) {
        console.error('[TavernOS HUD] Архив не открылся:', e);
        alert('Не удалось открыть архив: ' + (e && e.message ? e.message : e));
      }
    });
    document.querySelectorAll('[data-phone-app-key]').forEach(box => {
      box.addEventListener('change', (e) => {
        settings[e.target.dataset.phoneAppKey] = e.target.checked;
        saveSettings();
      });
    });
    document.getElementById('hud-lazy-tabs').addEventListener('change', (e) => { settings.lazyTabs = e.target.checked; saveSettings(); });
    // Выключили облегчение — возвращаем содержимое всем карточкам сразу,
    // включили — облегчаем старые, как после обычной отрисовки.
    document.getElementById('hud-lighten-old').addEventListener('change', (e) => {
      settings.lightenOldCards = e.target.checked;
      saveSettings();
      const scope = cachedChatContainer || document;
      if (e.target.checked) запланироватьОблегчение();
      else scope.querySelectorAll('.hud-os-card').forEach(card => вернутьКарточку(card));
    });
    document.getElementById('hud-card-limit').addEventListener('change', (e) => {
      let v = parseInt(e.target.value, 10); if (isNaN(v) || v < 0) v = 0;
      v = Math.min(2000, v);
      // Слишком маленький лимит свернул бы карточку прямо под курсором.
      if (v > 0 && v < 5) v = 5;
      settings.hudCardLimit = v; e.target.value = v; saveSettings(); enforceCardLimit();
    });
    document.getElementById('hud-hide-old-cards').addEventListener('change', (e) => {
      settings.hideOldCards = e.target.checked;
      saveSettings();
      document.documentElement.classList.toggle('hud-hide-old-cards', settings.hideOldCards);
      if (settings.hideOldCards) { enforceCardLimit(); return; }
      // Выключили — спрятанные карточки снова обычные свёрнутые: полоска
      // видна, при прокрутке собираются, а те, что на экране, — сразу.
      if (!cachedChatContainer) return;
      cachedChatContainer.querySelectorAll('.mes[data-hud-evicted="hidden"]').forEach(mes => {
        mes.dataset.hudEvicted = '1';
        if (наЭкране(mes) && restoreEvictedCard(mes)) safeProcessMessage(mes);
      });
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

    // Пояснения включаются и выключаются на лету: перерисовывать карточки
    // ради галочки незачем, вопросики навешиваются и снимаются по месту.
    document.getElementById('hud-show-hints').addEventListener('change', (e) => {
      settings.showHints = e.target.checked;
      saveSettings();
      const чат = cachedChatContainer || document.getElementById('chat') || document;
      if (settings.showHints) {
        чат.querySelectorAll('.mes_text').forEach(t => attachHelpMarks(t));
        // Вопросики вкладок живут в разметке, поэтому их вернёт только
        // пересборка. Просим разобрать заново.
        чат.querySelectorAll('.mes').forEach(m => { if (m.__hudSource && !m.querySelector('.hud-help-mark[data-tab-help]')) {
          const t = m.querySelector('.mes_text');
          if (t) { t.innerHTML = m.__hudSource; safeProcessMessage(m); }
        } });
      } else {
        чат.querySelectorAll('.mes_text').forEach(t => removeHelpMarks(t));
        чат.querySelectorAll('.hud-help-mark[data-tab-help]').forEach(з => з.remove());
        чат.querySelectorAll('.hud-tab-hint').forEach(п => { п.hidden = true; п.classList.remove('is-open'); });
      }
    });
    document.getElementById('hud-carry-over').addEventListener('change', (e) => {
      settings.carryOver = e.target.checked;
      saveSettings();
      processAllMessages();
    });
    const числоваяНастройка = (id, ключ, мин, макс) => {
      document.getElementById(id).addEventListener('change', (e) => {
        let v = parseInt(e.target.value, 10);
        if (isNaN(v) || v < мин) v = мин; if (v > макс) v = макс;
        settings[ключ] = v; e.target.value = v; saveSettings();
        processAllMessages();
      });
    };
    числоваяНастройка('hud-carry-turns', 'carryTurns', 0, 200);
    числоваяНастройка('hud-carry-items', 'carryMaxItems', 1, 200);
    числоваяНастройка('hud-carry-msgs', 'carryMaxMessages', 1, 500);
    document.getElementById('hud-virtualize').addEventListener('change', (e) => {
      settings.virtualizeCards = e.target.checked;
      saveSettings();
      // Выключили — возвращаем всё свёрнутое обратно, иначе заглушки останутся
      // висеть до перезагрузки страницы.
      if (!e.target.checked && cachedChatContainer) {
        cachedChatContainer.querySelectorAll('.mes[data-hud-evicted]').forEach(mes => {
          if (restoreEvictedCard(mes)) safeProcessMessage(mes);
        });
      }
    });
    document.getElementById('hud-lore-context').addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 0) val = 0; if (val > 50) val = 50;
      settings.loreContextMessages = val; e.target.value = val; saveSettings();
    });

    populateRegenProfileSelect();
    document.getElementById('hud-regen-profile-refresh').addEventListener('click', populateRegenProfileSelect);
    document.getElementById('hud-regen-profile').addEventListener('change', (e) => {
      settings.regenProfileId = e.target.value || '';
      saveSettings();
    });

    // --- Ассистент ---------------------------------------------------------
    populateAssistantSelects();
    document.getElementById('hud-ask-refresh').addEventListener('click', populateAssistantSelects);
    [['hud-ask-hud', 'assistantIncludeHud'], ['hud-ask-note', 'assistantIncludeNote'], ['hud-ask-card', 'assistantIncludeCard'],
     ['hud-ask-persona', 'assistantIncludePersona'], ['hud-ask-lore-all', 'assistantLoreAll']].forEach(([id, ключ]) => {
      document.getElementById(id).addEventListener('change', (e) => { settings[ключ] = e.target.checked; saveSettings(); });
    });
    [['hud-ask-messages', 'assistantContextMessages', 0, 60], ['hud-ask-tokens', 'assistantMaxTokens', 256, 16000]].forEach(([id, ключ, мин, макс]) => {
      document.getElementById(id).addEventListener('change', (e) => {
        let v = parseInt(e.target.value, 10);
        if (!Number.isFinite(v) || v < мин) v = мин; if (v > макс) v = макс;
        settings[ключ] = v; e.target.value = v; saveSettings();
      });
    });
    document.getElementById('hud-ask-lorebooks').addEventListener('change', (e) => {
      settings.assistantLorebooks = Array.from(e.target.selectedOptions).map(o => o.value);
      saveSettings(); статусЛорбуковАссистента();
    });
    document.getElementById('hud-ask-profile').addEventListener('change', (e) => { settings.assistantProfileId = e.target.value || ''; saveSettings(); });
    const системныйПромпт = document.getElementById('hud-ask-system');
    // Совпадает со встроенным — храним пустым: обновление расширения тогда
    // подтянет новый встроенный промпт, а не застрянет на старой копии.
    системныйПромпт.addEventListener('change', () => {
      settings.assistantSystemPrompt = системныйПромпт.value.trim() === ПРОМПТ_АССИСТЕНТА.trim() ? '' : системныйПромпт.value;
      saveSettings();
    });
    document.getElementById('hud-ask-system-reset').addEventListener('click', () => {
      системныйПромпт.value = ПРОМПТ_АССИСТЕНТА; settings.assistantSystemPrompt = ''; saveSettings();
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

  // Выпадающие списки ассистента: свой профиль подключения и свои лорбуки.
  async function populateAssistantSelects() {
    const профиль = document.getElementById('hud-ask-profile');
    if (профиль) {
      const профили = списокПрофилей();
      const было = settings.assistantProfileId || '';
      профиль.innerHTML = '<option value="">Модель чата (текущее подключение)</option>';
      профили.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name || p.id; профиль.appendChild(o); });
      профиль.value = профили.some(p => p.id === было) ? было : '';
      if (профиль.value !== было) { settings.assistantProfileId = профиль.value; saveSettings(); }
    }
    const книги = document.getElementById('hud-ask-lorebooks');
    if (книги) {
      const было = new Set(Array.isArray(settings.assistantLorebooks) ? settings.assistantLorebooks : []);
      const имена = await getAvailableHudLorebooks();
      книги.innerHTML = '';
      имена.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; o.selected = было.has(n); книги.appendChild(o); });
      settings.assistantLorebooks = имена.filter(n => было.has(n));
      saveSettings();
      статусЛорбуковАссистента();
    }
  }

  function статусЛорбуковАссистента() {
    const метка = document.getElementById('hud-ask-lorebooks-status');
    if (!метка) return;
    const n = Array.isArray(settings.assistantLorebooks) ? settings.assistantLorebooks.length : 0;
    метка.textContent = n ? `Выбрано: ${n}` : 'Не выбрано';
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
            
            // Режем от ПОСЛЕДНЕГО настоящего [HUD], а не от первой метки: первой
            // бывает упоминание в <plan>, и тогда уходил весь текст ответа.
            const началоHud = началоПоследнегоHud(oldText);
            if (началоHud < 0) {
                 showHudToast('error', 'Ошибка', 'Тег [HUD] не найден в последнем сообщении.');
                 return;
            }

            let newText = String(oldText).slice(0, началоHud).trim();
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
  // --- «Запомнить»: запись HUD → постоянная запись Lorebook ----------------
  // Окно показывает ровно то, что будет записано, и в какую книгу. Ключи
  // активации можно поправить руками: без них запись в World Info никогда не
  // сработает, а угадать их автоматически получается не всегда.
  let loreDialogOpen = false;
  // Модуль World Info самого SillyTavern. Раньше мы писали файл книги напрямую
  // через /api/worldinfo/edit, и это была тихая потеря данных: у ST есть свой
  // кэш книг (worldInfoCache), наша запись в него не попадала, редактор
  // показывал старое содержимое, а следующее сохранение со стороны ST
  // возвращало файл к своей копии — вместе с исчезновением наших записей.
  let worldInfoModulePromise = null;
  function getWorldInfoModule() {
    if (!worldInfoModulePromise) {
      // Без ?v=: это модуль SillyTavern, и любой хвост в пути даёт вторую его
      // копию — с собственным кэшем книг, мимо которого мы и писали.
      worldInfoModulePromise = import('../../../world-info.js').catch((e) => {
        console.debug('[TavernOS HUD] Модуль World Info недоступен, работаем через HTTP:', e);
        return null;
      });
    }
    return worldInfoModulePromise;
  }

  // Чтение книги: через ST, если получится, иначе прямым запросом.
  async function readLorebookForWrite(name) {
    const wi = await getWorldInfoModule();
    if (wi && typeof wi.loadWorldInfo === 'function') {
      try {
        const data = await wi.loadWorldInfo(name);
        if (data && typeof data === 'object' && data.entries) return data;
      } catch (e) { console.debug('[TavernOS HUD] loadWorldInfo не сработал:', e); }
    }
    return await loadHudLorebook(name);
  }

  // Запись книги. saveWorldInfo обновляет и файл, и кэш ST, а reloadEditor
  // перерисовывает открытую панель World Info — иначе новая запись появлялась
  // только после перезагрузки страницы.
  async function writeLorebook(name, book) {
    const wi = await getWorldInfoModule();
    if (wi && typeof wi.saveWorldInfo === 'function') {
      await wi.saveWorldInfo(name, book, true);
      try { if (typeof wi.reloadEditor === 'function') wi.reloadEditor(name); } catch (_) {}
      return 'st';
    }
    const res = await fetch('/api/worldinfo/edit', {
      method: 'POST', headers: getStRequestHeadersSafe(),
      body: JSON.stringify({ name, data: book }), cache: 'no-cache',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return 'http';
  }

  async function openLoreDialog(text, keys) {
    if (loreDialogOpen) return;
    loreDialogOpen = true;

    const overlay = document.createElement('div');
    overlay.className = 'hud-modal-overlay';
    overlay.innerHTML = `
      <div class="hud-modal hud-lore-modal" role="dialog" aria-modal="true" aria-label="Запомнить в Lorebook">
        <div class="hud-modal-head">✚ Запомнить навсегда</div>
        <div class="hud-modal-body">
          <label class="hud-modal-label">Заголовок <i>под ним запись видно в списке World Info</i></label>
          <input type="text" class="hud-modal-title">
          <label class="hud-modal-label">Что записываем</label>
          <textarea class="hud-modal-text" rows="5"></textarea>
          <label class="hud-modal-label">Ключи активации <i>через запятую — по ним запись всплывёт в контексте</i></label>
          <input type="text" class="hud-modal-keys">
          <label class="hud-modal-label">В какую книгу</label>
          <select class="hud-modal-book"><option value="">Загружаю список…</option></select>
          <div class="hud-modal-note">Сейчас в полях — сухая выжимка из HUD. Можно записать как есть, а можно попросить модель дописать связный текст с контекстом сцены, заголовок и ключи — она прочитает последние сообщения чата.</div>
          <div class="hud-modal-note hud-lore-genstate" hidden></div>
        </div>
        <div class="hud-modal-foot">
          <button type="button" class="hud-modal-btn gen">✎ Написать моделью</button>
          <button type="button" class="hud-modal-btn cancel">Отмена</button>
          <button type="button" class="hud-modal-btn save" disabled>Записать</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    guardTouchSwipe(overlay);

    const $ = (s) => overlay.querySelector(s);
    const close = () => { loreDialogOpen = false; overlay.remove(); document.removeEventListener('keydown', поКлавише); };
    const поКлавише = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', поКлавише);

    $('.hud-modal-text').value = String(text || '');
    $('.hud-modal-keys').value = String(keys || '');
    // Заголовок по умолчанию — первый ключ: это почти всегда имя, о ком запись.
    $('.hud-modal-title').value = String(keys || '').split(',')[0].trim();

    const select = $('.hud-modal-book');
    const saveBtn = $('.hud-modal-btn.save');
    const genBtn = $('.hud-modal-btn.gen');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    $('.hud-modal-btn.cancel').addEventListener('click', close);

    // --- Написать моделью ---
    genBtn.addEventListener('click', async () => {
      const факт = $('.hud-modal-text').value.trim();
      if (!факт) { showHudToast('error', 'Нечего описывать', 'Сначала впишите факт.'); return; }
      const ctx = getStContextSafe();
      if (!ctx || typeof ctx.generateRaw !== 'function') {
        showHudToast('error', 'Модель недоступна', 'SillyTavern не отдал функцию генерации.');
        return;
      }
      const состояние = $('.hud-lore-genstate');
      genBtn.disabled = true; saveBtn.disabled = true;
      const прежде = genBtn.textContent;
      genBtn.textContent = 'Пишу…';
      состояние.hidden = false;
      // Счётчик секунд — не украшение: запрос уходит на чужой сервер и может
      // висеть минутами, а окно без признаков жизни выглядит зависшим.
      let секунд = 0;
      состояние.textContent = 'Запрос ушёл модели. Ответ подставится в поля — его можно править перед записью.';
      const тик = setInterval(() => {
        секунд++;
        состояние.textContent = 'Модель пишет… ' + секунд + ' с. Ответ подставится в поля — его можно будет править.';
      }, 1000);
      let безHud = false;
      try {
        const сколько = Math.max(0, Math.min(50, Number(settings.loreContextMessages ?? 10)));
        const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
        const хвост = сколько ? chat.slice(-сколько) : [];
        const сообщения = хвост.map(m => ({
          name: String(m && m.name || ''),
          text: stripHudBlock(String(m && m.mes || '')),
        })).filter(m => m.text);
        const имена = getMainProtagonistNames(ctx);
        const prompt = buildLoreGenPrompt({
          fact: факт,
          keys: $('.hud-modal-keys').value.split(',').map(k => k.trim()).filter(Boolean),
          messages: сообщения,
          userName: имена.user, charName: имена.char,
        });
        // ST не даёт отменить свой запрос, но ждать его вечно тоже нельзя:
        // без ограничения окно навсегда остаётся с заблокированными кнопками.
        const ЖДЁМ_МС = 180000;
        // Без флага перехват вшил бы в этот запрос HUD-инструкцию.
        window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
        безHud = true;
        const raw = await Promise.race([
          ctx.generateRaw({
            prompt,
            systemPrompt: 'You are a precise assistant maintaining a lorebook for an ongoing story. Mature fictional content is expected. Answer only in the requested format.',
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('модель молчит дольше ' + (ЖДЁМ_МС / 1000) + ' с')), ЖДЁМ_МС)),
        ]);
        const ответ = parseLoreGenResponse(raw, {
          fact: факт,
          names: [имена.user, имена.char],
          keys: $('.hud-modal-keys').value.split(',').map(k => k.trim()).filter(Boolean),
        });
        if (!ответ) throw new Error('модель ответила не JSON-ом');
        const поле = $('.hud-modal-text');
        поле.value = ответ.content;
        // Ответ модели длиннее исходной выжимки: растягиваем поле под него,
        // но не выше половины окна — иначе кнопки уезжают за край экрана.
        поле.style.height = 'auto';
        поле.style.height = Math.min(поле.scrollHeight, Math.round(window.innerHeight * 0.5)) + 'px';
        if (ответ.title) $('.hud-modal-title').value = ответ.title;
        if (ответ.keys.length) $('.hud-modal-keys').value = ответ.keys.join(', ');
        // Показываем начало записи: после генерации взгляд должен падать
        // на текст, а не на строку состояния под ним.
        поле.scrollTop = 0;
        поле.scrollIntoView({ block: 'nearest' });
        состояние.textContent = 'Готово. Проверьте текст и ключи — записывается то, что в полях.';
      } catch (e) {
        console.error('[TavernOS HUD] Генерация записи не удалась:', e);
        состояние.textContent = 'Модель не ответила как надо: ' + (e && e.message ? e.message : e) + '. Поля не тронуты — можно записать как есть.';
        showHudToast('error', 'Не сгенерировалось', 'Поля остались прежними.');
      } finally {
        if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
        clearInterval(тик);
        genBtn.disabled = false; genBtn.textContent = прежде;
        saveBtn.disabled = !select.value;
      }
    });

    let books = [];
    try { books = await getAvailableHudLorebooks(); } catch (_) {}
    if (!books.length) {
      select.innerHTML = '<option value="">Ни одной книги не найдено</option>';
      $('.hud-modal-note').textContent = 'SillyTavern не отдал список Lorebook. Создайте книгу в World Info и откройте окно заново.';
      return;
    }
    select.innerHTML = books.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    saveBtn.disabled = false;

    saveBtn.addEventListener('click', async () => {
      const bookName = select.value;
      const content = $('.hud-modal-text').value.trim();
      const title = $('.hud-modal-title').value.trim();
      const keyList = $('.hud-modal-keys').value.split(',').map(k => k.trim()).filter(Boolean);
      if (!bookName || !content) { showHudToast('error', 'Нечего записывать', 'Заполните текст и выберите книгу.'); return; }
      if (!keyList.length) { showHudToast('error', 'Нет ключей активации', 'Без ключей запись никогда не сработает.'); return; }

      saveBtn.disabled = true; genBtn.disabled = true; saveBtn.textContent = 'Записываю…';
      try {
        // 1. Читаем книгу целиком. Не прочитали — не пишем.
        const book = await readLorebookForWrite(bookName);
        if (!book || typeof book !== 'object' || !book.entries || typeof book.entries !== 'object') {
          throw new Error('книга не прочиталась');
        }
        if (loreAlreadyHas(book, content)) {
          showHudToast('info', 'Уже записано', 'Такая запись в этой книге уже есть.');
          close(); return;
        }
        // 2. Дописываем запись, ничего не трогая вокруг. uid ищем не только
        // среди значений, но и среди ключей: у книг, правленных руками, они
        // расходятся, а совпавший uid затирает чужую запись.
        const числа = [];
        for (const [k, e] of Object.entries(book.entries)) {
          const a = Number(k), b = Number(e && e.uid);
          if (Number.isFinite(a)) числа.push(a);
          if (Number.isFinite(b)) числа.push(b);
        }
        const uid = числа.length ? Math.max(...числа) + 1 : 0;
        const idxs = Object.values(book.entries).map(e => Number(e && e.displayIndex)).filter(v => Number.isFinite(v));
        const displayIndex = idxs.length ? Math.max(...idxs) + 1 : 0;
        book.entries[String(uid)] = buildLoreEntry(uid, displayIndex, keyList, content, title || ('HUD: ' + keyList[0]));

        // 3. Сохраняем через ST, чтобы книга и её кэш остались в согласии.
        const как = await writeLorebook(bookName, book);
        showHudToast('success', 'Записано в Lorebook', `«${bookName}» — ключи: ${keyList.join(', ')}`
          + (как === 'http' ? ' (обновите страницу, чтобы увидеть в World Info)' : ''));
        close();
      } catch (e) {
        console.error('[TavernOS HUD] Запись в Lorebook не удалась:', e);
        showHudToast('error', 'Не записалось', 'Книга осталась нетронутой. Подробности в консоли.');
        saveBtn.disabled = false; genBtn.disabled = false; saveBtn.textContent = 'Записать';
      }
    });
  }

  // Собирает отложенную вкладку при первом переключении на неё. Пустышка
  // заменяется настоящим блоком с тем же id, поэтому переключение вкладок
  // дальше работает как обычно и повторно ничего не считает.
  function renderLazyTab(placeholder) {
    if (!placeholder || !placeholder.classList.contains('hud-tab-lazy')) return placeholder;
    const card = placeholder.closest('.hud-os-card');
    // Заготовки кладутся на карточку сразу после вставки разметки. Если их
    // ещё нет вовсе, значит нас позвали слишком рано: признак отложенности
    // не снимаем, иначе вкладка останется пустой навсегда.
    if (!card || !card.__hudLazy) return placeholder;
    const thunk = card.__hudLazy[placeholder.id];
    if (!thunk) { placeholder.classList.remove('hud-tab-lazy'); return placeholder; }
    try {
      const box = document.createElement('div');
      box.innerHTML = thunk();
      const built = box.firstElementChild;
      if (!built) { placeholder.classList.remove('hud-tab-lazy'); return placeholder; }
      placeholder.replaceWith(built);
      delete card.__hudLazy[placeholder.id];
      return built;
    } catch (e) {
      console.error('[TavernOS HUD] Ленивая вкладка не собралась:', e);
      placeholder.classList.remove('hud-tab-lazy');
      placeholder.innerHTML = '<div class="hud-memory-error">Не удалось собрать вкладку.</div>';
      return placeholder;
    }
  }

  // Точка входа в окно «Запомнить» снаружи карточки: удобно дёрнуть из
  // консоли и проверить окно, не дожидаясь подходящего сообщения в чате.
  window.HUD.openLoreDialog = (text, keys) => openLoreDialog(text, keys);

  const eventsCtx = {
    openLoreDialog,
    renderLazyTab,
    enforceCardLimit,
    restoreEvictedCard,
    getChatContainer: () => cachedChatContainer,
    getPerformanceObserver: () => performanceIntersectionObserver,
    saveSettings,
    applyThemeColors,
    showHudToast,
    safeProcessMessage,
    // Мини-гайд: словари и сборка разметки лежат в help.js.
    tabHelp: TAB_HELP,
    findTermHelp,
    buildHintHTML,
    attachHelpMarks: (корень) => { if (settings.showHints !== false) attachHelpMarks(корень); centerFieldIcons(корень); },
    isPerformanceModeActive,
    refreshPerformanceMessageClasses,
    schedulePerformanceRefresh,
  };

  /* Проверка полноты HUD после ответа (hud-check.js). Досоздание идёт через
     ту же кнопку 🔄 / ➕, что и вручную: ждём, пока ST дорисует сообщение и
     HUD соберёт кнопку, и нажимаем её обработчик. */
  async function перегенерироватьHUDСообщения(id) {
    for (let i = 0; i < 30; i++) {
      const mes = document.querySelector(`.mes[mesid="${id}"]`);
      if (mes) {
        if (!mes.querySelector('.hud-regen-btn')) safeProcessMessage(mes);
        const кнопка = mes.querySelector('.hud-regen-btn');
        if (кнопка && !кнопка.classList.contains('hud-spinning')) {
          await handleHudRegenButton(кнопка);
          return true;
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  let проверкаПолноты = null;
  function подключитьПроверкуПолноты() {
    if (проверкаПолноты) return;
    const ctx = window.SillyTavern?.getContext?.();
    const es = ctx?.eventSource, et = ctx?.event_types;
    if (!es || !et?.MESSAGE_RECEIVED) return;
    проверкаПолноты = создатьПроверкуПолноты({
      чат: () => window.SillyTavern?.getContext?.()?.chat || [],
      ключЧата: () => { const c = window.SillyTavern?.getContext?.(); return String(c?.getCurrentChatId?.() ?? c?.chatId ?? ''); },
      перегенерировать: перегенерироватьHUDСообщения,
      сообщить: showHudToast,
    });
    if (et.GENERATION_STOPPED) es.on(et.GENERATION_STOPPED, () => проверкаПолноты.остановлено());
    // Не ждём внутри обработчика: ST ждёт своих слушателей, прежде чем сохранить чат.
    es.on(et.MESSAGE_RECEIVED, (messageId, type) => {
      setTimeout(() => { проверкаПолноты.послеОтвета(messageId, type).catch(e => console.warn('[TavernOS HUD] Проверка полноты', e)); }, 800);
    });
  }

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
    // Макрос {{hudLast}} — и для нашей инструкции, и для пресетов.
    зарегистрироватьМакросHUD();
    подключитьПроверкуПолноты();
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
