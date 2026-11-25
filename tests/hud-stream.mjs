// hud-manager/tests/hud-stream.mjs
//
// HUD отдельным запросом — потоком (regen.js): куски разных источников, ответ
// не потоком, ошибка посреди потока, обрыв связи, обрыв по лимиту, молчание.
// Без сети и без модели: ответы — обычные Response из текста.
// node tests/hud-stream.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, appendChild() {} });
globalThis.document = { createElement: узел, createElementNS: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), getElementById: () => null, addEventListener() {} };
globalThis.SillyTavern = { getContext: () => ({ chat: [] }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const R = await import('file:///' + path.join(КОРЕНЬ, 'regen.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, подробно); } else console.log('✓', что); };

const HUD = '[HUD]\n```json\n{"sc":{"T":"10:00"},"cs":[{"N":"Мира"}]}\n```\n[/HUD]';
// Текст ответа — кусками по n байт: кириллица и события режутся где попало.
const ответ = (текст, { кусок = 7, тип = 'text/event-stream' } = {}) => {
  const байты = new TextEncoder().encode(текст);
  let i = 0;
  return new Response(new ReadableStream({ pull(c) { if (i >= байты.length) { c.close(); return; } c.enqueue(байты.slice(i, i + кусок)); i += кусок; } }), { headers: { 'content-type': тип } });
};
const sse = (...события) => события.map(с => 'data: ' + (typeof с === 'string' ? с : JSON.stringify(с)) + '\n\n').join('');
const части = (т, n = 9) => { const out = []; for (let i = 0; i < т.length; i += n) out.push(т.slice(i, i + n)); return out; };
const текст = (д) => R.текстОтвета(д);

{
  let живых = 0, последний = null;
  const д = await R.прочитатьПоток(ответ(': OPENROUTER PROCESSING\n\n' + sse({ choices: [{ delta: { role: 'assistant' } }] }, { choices: [{ delta: { reasoning_content: 'думаю' } }] }, ...части(HUD).map(т => ({ choices: [{ delta: { content: т } }] })), { choices: [{ delta: {}, finish_reason: 'stop' }] }, '[DONE]')), { живой: () => живых++, ход: (х) => { последний = х; } });
  проверить('поток OpenAI: текст целиком, причина, мысли отдельно', текст(д) === HUD && д.choices[0].finish_reason === 'stop' && последний.мысли === 5 && последний.текст === HUD.length, JSON.stringify(д).slice(0, 200));
  проверить('каждый кусок — модель жива', живых > 20);
}
{
  const д = await R.прочитатьПоток(ответ(sse(...части(HUD).map(т => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: т } })), { type: 'message_delta', delta: { stop_reason: 'max_tokens' } }, { type: 'message_stop' }).replace(/\n/g, '\r\n'), { кусок: 5 }));
  проверить('поток Claude (и переводы строк CRLF): текст, max_tokens — обрыв по лимиту', текст(д) === HUD && R.обрывПоЛимиту(д));
  const г = await R.прочитатьПоток(ответ(sse(...части(HUD).map(т => ({ candidates: [{ content: { parts: [{ text: 'мысль', thought: true }, { text: т }] } }] })), { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] })));
  проверить('поток Gemini: мысли не попадают в текст', текст(г) === HUD && г.choices[0].finish_reason === 'stop');
  const к = await R.прочитатьПоток(ответ(sse(...части(HUD).map(т => ({ type: 'content-delta', delta: { message: { content: { text: т } } } })), { type: 'message-end', delta: { finish_reason: 'COMPLETE' } })));
  проверить('поток Cohere', текст(к) === HUD);
  const м = await R.прочитатьПоток(ответ(sse({ choices: [{ delta: { content: [{ type: 'thinking', thinking: [{ type: 'text', text: 'хм' }] }] } }] }, ...части(HUD).map(т => ({ choices: [{ delta: { content: [{ type: 'text', text: т }] } }] })), '[DONE]')));
  проверить('поток Mistral: содержимое списком', текст(м) === HUD);
  const второй = await R.прочитатьПоток(ответ(sse({ choices: [{ index: 0, delta: { content: HUD } }] }, { choices: [{ index: 1, delta: { content: 'другой' } }] }, '[DONE]')));
  проверить('второй вариант ответа не подмешивается', текст(второй) === HUD);
}
{
  const д = await R.прочитатьПоток(ответ(JSON.stringify({ choices: [{ message: { content: HUD }, finish_reason: 'stop' }] }), { тип: 'application/json' }));
  проверить('провайдер ответил одним куском — как раньше', текст(д) === HUD);
  const о = await R.прочитатьПоток(ответ(JSON.stringify({ error: { message: 'Monthly limit' } }), { тип: 'application/json' }));
  let сообщение = ''; try { текст(о); } catch (e) { сообщение = e.message; }
  проверить('ошибка с кодом 200 — её текст', /Monthly limit/.test(сообщение));
  const п = await R.прочитатьПоток(ответ(sse({ choices: [{ delta: { content: '[HUD]' } }] }, { error: { message: 'upstream timeout' } })));
  сообщение = ''; try { текст(п); } catch (e) { сообщение = e.message; }
  проверить('ошибка посреди потока — её текст, а не обрывок HUD', /upstream timeout/.test(сообщение));
}
{
  let сообщение = '';
  try { await R.прочитатьПоток(ответ(sse({ choices: [{ delta: { content: '[HUD]\n```json\n{"sc":{"T":' } }] }))); } catch (e) { сообщение = e.message; }
  проверить('поток кончился без конца и HUD не дописан — обрыв связи', сообщение === R.ОБРЫВ_СВЯЗИ);
  const д = await R.прочитатьПоток(ответ(sse({ choices: [{ delta: { content: HUD } }] })));
  проверить('без слова о конце, но HUD целый — принимаем', текст(д) === HUD);
  const л = await R.прочитатьПоток(ответ(sse({ choices: [{ delta: { reasoning_content: 'долго думаю' } }] }, { choices: [{ delta: {}, finish_reason: 'length' }] }, '[DONE]')));
  проверить('весь лимит ушёл на рассуждения — повтор с большим лимитом', R.нуженЛимитБольше(л) && !R.пустойПоток(л));
  const п = await R.прочитатьПоток(ответ(sse({ choices: [{ delta: {} }] }, '[DONE]')));
  const ф = await R.прочитатьПоток(ответ(sse({ choices: [{ delta: {}, finish_reason: 'content_filter' }] }, '[DONE]')));
  проверить('пусто и без причины — спросить без потока; отфильтровано — нет', R.пустойПоток(п) && !R.пустойПоток(ф));
}
{
  // Профиль Connection Manager: генератор { text, state }.
  async function* ген(...xs) { for (const x of xs) yield x; }
  let живых = 0;
  const д = await R.собратьПоток(ген({ text: '[HUD]', state: { reasoning: 'а' } }, { text: HUD, state: { reasoning: 'аб' } }), { живой: () => живых++ });
  проверить('профиль: текст последнего куска, жив на каждом', текст(д) === HUD && живых === 2 && !R.обрывПоЛимиту(д));
  проверить('профиль: оборван на полуслове или одни рассуждения — лимит', R.обрывПоЛимиту(await R.собратьПоток(ген({ text: '[HUD]\n```json\n{"sc":{"T":"10' }))) && R.обрывПоЛимиту(await R.собратьПоток(ген({ text: '', state: { reasoning: 'ооо' } }))));
  проверить('профиль: ничего не пришло (ошибка в потоке) — без потока', R.пустойПоток(await R.собратьПоток(ген())) && R.пустойПоток(await R.собратьПоток(ген({ text: '', state: {} }))));
}
{
  const код = fs.readFileSync(path.join(КОРЕНЬ, 'regen.js'), 'utf8');
  проверить('код: запрос потоком, без потока — когда провайдер его не умеет', код.includes('hudRequestBody.stream = true;') && код.includes('ПРО_ПОТОК.test(') && код.includes('hudRequestBody.stream = false; continue;'));
  проверить('код: предел ожидания заводится заново на каждом куске и каждом запросе', /const живой = \(\) => \{\s*\n\s*if \(таймерОжидания\) clearTimeout\(таймерОжидания\);/.test(код) && код.includes('прочитатьПоток(res, { живой, ход })') && код.includes('собратьПоток(поток(), { живой, ход })'));
  проверить('код: таймер хода снимается', код.includes('clearInterval(таймерХода);'));
  проверить('рассуждения поменьше: слова — по источнику', R.меньшеРассуждений('openai') === 'low' && R.меньшеРассуждений('claude') === 'min' && R.меньшеРассуждений('makersuite') === 'min' && R.меньшеРассуждений('deepseek') === undefined);
  const S = await import('file:///' + path.join(КОРЕНЬ, 'settings.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
  const ui = fs.readFileSync(path.join(КОРЕНЬ, 'settings-ui.js'), 'utf8');
  проверить('рассуждения: по умолчанию как в Таверне, выбор в панели сохраняется', S.defaultSettings.hudRegenReasoning === 'same' && ui.includes('id="hud-regen-reasoning"') && /getElementById\('hud-regen-reasoning'\)\?\.addEventListener\('change'.*saveSettings\(\)/.test(ui));
}

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exit(провалов ? 1 : 0);
