# KoboldCpp cache compatibility — 23.88.6

Enable **Generation → KoboldCpp cache compatibility** and keep **HUD in every reply** enabled. Reload SillyTavern after updating. The setting is opt-in and affects text completion connections, including KoboldCpp. Chat completion prompt placement stays unchanged.

## What was wrong (all text completion users, report by Maxim, 30.10.2026)

- SillyTavern's text completion request carries `negative_prompt` (CFG). HUD took it for an image request and sent the reply **without** the HUD instruction. The completeness check then generated the HUD with a second, entirely different request every turn, which replaced KoboldCpp's single cache. The next turn reprocessed almost the whole prompt. Fixed: a request with text fields is never treated as an image request.
- In text completion the instruction was appended after the reply prefix (`Seraphina:`), that is, inside the character's turn. Fixed: it goes before the prefix (plain or Instruct output sequence).

## What the mode does

- The HUD schema is an ST extension prompt (`setExtensionPrompt`, `IN_PROMPT`). SillyTavern places it right after the character description on every turn and **counts it in the context budget**. Older messages make room for it, so KoboldCpp does not truncate the beginning. Earlier the prefix was added after ST had counted the budget, and the prompt overflowed the window.
- The schema is scene-independent: intimacy follows the NSFW setting, combat is always included, there are no names other than `{{user}}`/`{{char}}` and no snapshot. HUD blocks in the history stay untouched. There are no summaries, snapshot, adaptive reminders or hidden facts.
- Automatic HUD repair becomes a warning. Manual repair still works but invalidates the cache.
- Quiet generations (Summarize and the like), impersonate and chat completion get no prefix.

## Measured (live SillyTavern + KoboldCpp 1.123.1 tokenizer, Tiefighter 13B, fake replies, 30.10.2026)

| Per turn | Default before fix | Default after fix | Cache mode |
|---|---|---|---|
| Requests to the backend | 2 (reply + HUD repair) | reply (+ repair if the model skips fields) | 1 |
| Tokens reused from the previous request | ~1 of 27k | up to the newest message; the ~12k-token instruction after it is reprocessed | 31 175 of 31 189 |

When the window is full, SillyTavern drops the oldest message right after the fixed prefix. That is the case KoboldCpp ContextShift handles.

## Still invalidates the cache

- SillyTavern's built-in **Summarize** on the main connection: it is a different prompt, and the summary sits early in the story string.
- Other extensions that generate through the same backend.
- Changing presets, lorebooks, names, HUD settings or older messages.

Offline: `node tests/cache-stable.mjs` and the KoboldCpp block in `tests/wave3.mjs`. A full real-generation timing test on this PC was not run: the model processes ~22 tokens/s here, about 25 minutes for a 30k-token prompt.
