// Offline integration checks for cache-compatible text completion requests
// («Совместимость с кэшем KoboldCpp», settings.hudCacheStable).
// The instruction is an ST extension prompt (setExtensionPrompt, IN_PROMPT):
// SillyTavern places it right after the character description on every turn and
// counts it in the context budget. The fetch interceptor leaves the prompt as is.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), addEventListener() {}, head: узел() };
const чат = [];
// A minimal SillyTavern: event bus and extension prompts.
const слушатели = {};
const eventSource = { on(e, f) { (слушатели[e] ||= []).push(f); }, async emit(e, ...a) { for (const f of слушатели[e] || []) await f(...a); } };
const eventTypes = { GENERATION_STARTED: 'generation_started', GENERATE_AFTER_DATA: 'generate_after_data', GENERATION_ENDED: 'generation_ended', GENERATION_STOPPED: 'generation_stopped' };
const вставки = {};
const ctx = { chat: чат, chatMetadata: {}, name1: 'Софи', name2: 'Тристан', mainApi: 'textgenerationwebui', eventSource, eventTypes, event_types: eventTypes, setExtensionPrompt(key, value, position, depth) { вставки[key] = { value: String(value), position, depth }; } };
globalThis.SillyTavern = { getContext: () => ctx };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const sent = [];
globalThis.fetch = async (url, options) => { sent.push(JSON.parse(options.body)); return { ok: true }; };
await import('file:///' + ROOT + 'index.js?v=' + v + '&t=' + Date.now());
const S = await import('file:///' + ROOT + 'settings.js?v=' + v);
Object.assign(S.settings, { enableMemory: true, enablePhone: true, enableIntercepts: true, enableDiary: true, enableDreams: true, enableWorld: true, enableUserBlock: true });
let проб = 0, провалов = 0;
const check = (name, ok) => { проб++; if (!ok) { провалов++; console.log('✗', name); } };
const settings = S.settings;
Object.assign(settings, { hudCacheStable: true, autoInject: true });
const префикс = () => (Object.values(вставки)[0] || { value: '' });
// One real generation: GENERATION_STARTED (prefix), interceptor, data ready, request.
const send = async (body, type = 'normal', url = '/api/backends/text-completions/generate') => {
  await eventSource.emit(eventTypes.GENERATION_STARTED, type, {}, false);
  await window.tavernOSGenerateInterceptor([], 8192, () => {}, type);
  await eventSource.emit(eventTypes.GENERATE_AFTER_DATA, {}, false);
  await fetch(url, { method: 'POST', body: JSON.stringify({ max_tokens: 200, ...body }) });
  return sent.at(-1);
};
const hud = '[HUD]{"sc":{"Dt":"01.01.2026","Tm":"12:00"},"cs":[]}[/HUD]';
const history = 'System: Story\nUser: Hello\nAssistant: Hello!\n' + hud + '\nUser: Continue\nAssistant:';

const first = await send({ prompt: history, negative_prompt: '' });
check('request prompt is left byte-for-byte intact (instruction comes from SillyTavern)', first.prompt === history);
check('instruction is an IN_PROMPT extension prompt', префикс().position === 0 && префикс().value.startsWith('<hud_instructions>'));
check('no unresolved macros in the prefix', !префикс().value.includes('{{'));
check('names resolved in the prefix', префикс().value.includes('Софи') || префикс().value.includes('Тристан'));
const текст1 = префикс().value;
for (const type of ['swipe', 'regenerate', 'continue', 'normal']) {
  await send({ prompt: history }, type);
  check(type + ' keeps the same prefix text', префикс().value === текст1);
}
await send({ prompt: history }, 'quiet');
check('quiet generations get no prefix', префикс().value === '');
await send({ prompt: history }, 'impersonate');
check('impersonate gets no prefix', префикс().value === '');
settings.autoInject = false;
const выкл = await send({ prompt: history });
check('injection off: no prefix, full HUD history intact', префикс().value === '' && выкл.prompt === history);
settings.autoInject = true;
ctx.mainApi = 'openai';
const messages = [{ role: 'user', content: 'Hello' }];
const chatOut = await send({ messages }, 'normal', '/api/backends/chat-completions/generate');
check('chat completion: no prefix, normal end injection', префикс().value === '' && chatOut.messages[0].content === 'Hello' && chatOut.messages.at(-1).content.includes('<hud_instructions>'));
ctx.mainApi = 'textgenerationwebui';
const P = await import('file:///' + ROOT + 'prompt.js?v=' + v);
P.подключить({ сверитьРоды() { throw new Error('must not read scene'); }, последнийСнимокОбъект() { throw new Error('must not read snapshot'); } });
check('stable schema does not access changing scene state', P.buildDynamicPrompt({ cacheStable: true }).includes('<hud_instructions>'));
settings.nsfwPrompt = 'never';
await send({ prompt: history });
check('never setting excludes intimate schema', !префикс().value.includes('"Pos":'));
const { создатьПроверкуПолноты } = await import('file:///' + ROOT + 'hud-check.js?v=' + v);
let repairs = 0, warnings = 0;
const checker = создатьПроверкуПолноты({ чат: () => [{ mes: 'An incomplete reply' }], перегенерировать: async () => { repairs++; }, сообщить: () => { warnings++; } });
settings.hudCompleteCheck = 'regen';
await checker.послеОтвета(0, 'normal');
check('automatic repair does not replace cache', repairs === 0 && warnings === 1);
settings.hudCompleteCheck = 'off';
check('disabled checking stays disabled', await checker.послеОтвета(0, 'normal') === 'выключено');
console.log(`проверок: ${проб}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
