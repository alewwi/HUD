# Changelog

[Русская версия](CHANGELOG.md)

All notable changes to TavernOS HUD, newest first, starting from version 23.88.7.

## 23.88.59 — 2026-11-05

### Fixed
- **Phone icons are fully built from the theme.** The drawing used to only shift its hue, so stray colors showed up on palettes and other themes: a purple harp in an orange theme, a green cat in a lilac one. Now every color of a set is worked out from the theme: the drawing, outline, inserts and glass take the accent and the hues next to it. Skin on portraits stays natural.
- **The icon background always matches the theme background.** A tile is no longer light on a dark theme or dark on a light one. Parts of the drawing that would merge with that background flip to the other side in lightness. An accent too close to the background also gets easier to see.

## 23.88.58 — 2026-11-05

### Added
- **Phone icons by theme.** Each of the 27 themes has its own set of twelve icons: objects that fit the theme, its own tile shape and its own look. Pirates get a speaking trumpet for Calls and a chest for Wallet, Egypt gets an ankh for Health, Medieval looks like stained glass, Web 1.0 is pixel art. Contacts are told apart by headwear and silhouette, with no drawn faces.
- **Icon choice in Customize.** Blocks: Phone now has an App icons list: Auto by theme, Regular (the old icons), or any set.
- **Icons follow the theme.** A set from another theme shifts its hue toward the theme accent: Biopunk turns red in Vamp. The tile takes the theme background color. If the drawing would get lost on that background, the tile is made from the theme accent instead, dark or light.

### Changed
- An icon set loads only when it is needed. The regular icons may show for the first second.

## 23.88.53 — 2026-11-05

### Added
- **Miscarriage and abortion.** The model marks the end of a pregnancy with `lost`, or you press **Miscarriage or abortion** in the card and pick the kind and date. HUD closes the pregnancy for that character only, tells the model on the next turn and keeps the history. **Cancel** restores everything.
- **Twins and triplets.** Only some of the babies can be lost: the pregnancy goes on with those who remain.
- **Threat dice.** When the pregnancy field mentions a threatened miscarriage, HUD rolls for the outcome. The chance depends on the term and severity. You reveal the result and can change fate, and the model gets it only after that.
- **Recovery by term.** Bleeding, the return of the cycle and milk depend on the week of the loss. Milk appears only late in a pregnancy.
- **Chance of conception after a loss.** Almost none before the first ovulation, a bit lower until the first period, then normal. It stays slightly lower for about three months after surgery, trauma or infection.
- **Pregnancies tab in the archive:** all births and losses of the chat and who knows about them. Losses also show in the archive Timeline, and a miscarriage shows in the calendar as a memorial date.
- **Remove pregnancy:** erases a pregnancy from the HUD of the whole chat, as if it never happened.
- **Delete from HUD per pill** in Important, Chekhov's guns and Secrets, with a list of similar wordings to choose from.
- **Undo deleted items** through ↶ in the card header. An item returns to edited blocks and to the latest HUD too.
- **Stale copy warning.** After a deletion or restore on another device, HUD offers to update the chat and asks before saving over it.
- **Remove service files** in the settings: puts offloaded HUDs back and clears offload files and the chronicle before you uninstall.

### Changed
- Long lists keep three plates, then scroll right on PC and down on phones.
- The body and physiology fields split only on `;`. Commas inside a phrase no longer cut it into pills; a short list like "hunger, thirst, chills" still splits.

### Fixed
- Several English gaps: "no change for N turns", the protection chance line, the fight total, trimester names.

## 23.88.19 — 2026-11-02
- Unload the chat: old HUDs go to SillyTavern files, summaries stay in place.

## 23.88.18 — 2026-11-02
- X-ray: no fork-shaped fingers, slimmer long shaft, still frame mid-stroke.

## 23.88.17 — 2026-11-02
- X-ray of a second round: no false tongue row, thumb on clit as rub, no past climax.

## 23.88.16 — 2026-11-01
- No black plate under field views on picture themes.

## 23.88.15 — 2026-11-01
- X-ray: a long shaft gets thicker with its length.

## 23.88.14 — 2026-11-01
- X-ray size from words and the card, conception chance per act, phrase pills.

## 23.88.13 — 2026-11-01
- Theme-tinted backings for dark views; pill lists show two or three.

## 23.88.12 — 2026-11-01
- English gaps in built strings, casket tabs on phones.

## 23.88.11 — 2026-11-01
- Player custom stats named in the template; group chats get members' cards.

## 23.88.10 — 2026-11-01
- Medieval era: chosen block views restyled for the period.

## 23.88.9 — 2026-11-01
- Player: custom stats, all character fields, in-card field edit; English gaps.

## 23.88.8 — 2026-10-31
- Custom stats, deep field tuning, conception-chance breakdown, theme fixes.

## 23.88.7 — 2026-10-31
- Remove HUD from a chat, settings shared across devices, English lookup fix.
