# Translating TavernOS HUD

The HUD interface is written in Russian and fully translated into English. Every other language goes **through English**: you translate the English strings, and the HUD shows your language in place of English. You don't need to know Russian or read any code.

A string you leave empty stays in English, so a partial translation already works. You can send what you have and add more later.

## What to do

1. **Download [`template.csv`](template.csv)** (open it, then use the "Download raw file" button).
2. **Rename it** to your language code: `zh.csv` (Chinese), `es.csv` (Spanish), `pt-BR.csv` (Brazilian Portuguese), `ja.csv`, `de.csv`… Use a two- or three-letter [language code](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes), optionally with a region.
3. **Open it in a spreadsheet:**
   - **Google Sheets:** use File → Import → Upload, and untick "Convert text to numbers, dates, and formulas".
   - **LibreOffice Calc:** open the file, choose UTF-8 and comma as the separator.
   - **Excel:** use Data → From Text/CSV with UTF-8 encoding, and save as **"CSV UTF-8"**. Plain "CSV" breaks non-Latin letters. If you double-click the file and everything lands in column A, your Windows expects `;` as the separator. Open the file through Data → From Text/CSV instead, which splits it by commas. A file Excel saves with `;` loads fine.
4. **Fill in the `translation` column.** Leave every other column as it is.
   - The first row, `@language`, is the name of your language as it should appear in the HUD language menu, for example `中文` or `Español`.
5. **Check it in your own SillyTavern** (see below) as often as you like.
6. **Send the file back.** Either open a pull request that adds `translations/<code>.csv`, or attach the file to a [GitHub issue](https://github.com/alewwi/HUD/issues). The maintainer builds it and your language appears in the HUD settings (🌐 Language) for everyone.

## Check your translation

You don't need Node, git or any change to the extension files.

1. Save the table as CSV. In Google Sheets, use File → Download → Comma-separated values. In Excel, use "CSV UTF-8".
2. In SillyTavern, open the HUD settings and press **📄 Load a translation (.csv)** under 🌐 Language. Pick your file.
3. The HUD switches to your language at once and tells you how many strings were taken. Rows with an error, such as a missing `{1}` or a different tag, are listed in the browser console (F12 → Console) with the reason.
4. After you edit the table, load the file again: it replaces the previous one. **✕ Remove the translation file** returns the HUD to English.

The loaded file is kept only in this browser. It appears in the language menu as "📄 <your language name> — file". Updating the extension doesn't touch it, but it doesn't follow you to another browser or phone.

What to look at while testing: the settings panel, the tabs and cards of a chat with a HUD, the phone, the customization window, and the notifications. Long words that don't fit on a phone-width card are worth shortening.

## Columns

| column | what it is |
|---|---|
| `english` | The string to translate. It is also the row's key, so don't edit it. |
| `translation` | Your translation. Empty means "show the English". |
| `context` | Help for you: the Russian original, or the place in the code that writes this string. |
| `kind` | `text` is a plain string. `pattern` is a string with numbers or names inserted at `{1}`, `{2}`. `name` is the language-name row. `unused` is an old row; see below. |
| `notes` | Free space for your own notes. It is kept when the file is updated. |

## Rules

- **Keep the placeholders `{1}`, `{2}`, …** They are numbers, names or other inserted pieces. You can move them and change their order, for example `{1} yr {2} mo` → `{1}年{2}个月`. A row with a placeholder missing or added is skipped, and the English is shown instead.
- **Keep HTML tags exactly** as in the English, such as `<time>` or `<b>…</b>`. Don't add new ones. A row with different tags, or with a new `<` right before a letter, is skipped.
- **Don't translate** `{{user}}`, `{{char}}`, `HUD`, `SillyTavern`, emoji, or short codes in capital letters (`SS`, `W`, `pn`…). The model writes these codes, and the HUD reads them.
- **Spaces at the start and end** of a string are copied from the English automatically. You don't need to watch them.
- **Straight double quotes** `"…"` become typographic `“…”` when the English has none. Your own quote marks, such as `「」` or `«»`, are kept as they are.
- Rows with `\A` in them are CSS labels: `\A` is a line break, so keep it.
- Keep it short where the English is short. Many strings are button labels or chips on a phone-width card.
- If a cell starts with `=`, `+`, `-` or `@`, a spreadsheet may turn it into a formula. Type an apostrophe first (`'-5 kg`) or format the column as text.

## What gets translated, and what doesn't

- **Translated:** everything the HUD itself shows: settings, tabs, labels, buttons, hints and notifications.
- **Not translated:** what the model writes inside the HUD, such as thoughts, descriptions and events. With a language other than Russian selected, the model is asked to write HUD values in English, because the HUD's reading of story values understands only Russian and English.
- The model instruction stays in English for every language except Russian.

## When the HUD updates

Once your file is in the repository, the maintainer runs the build after each update, and your file there is updated automatically:

- **New strings** appear as rows with an empty `translation`.
- **Strings whose English changed** move to the end of the file with `kind` = `unused`, together with your old translation, so you can reuse it. They no longer affect the HUD.

To see what's missing, filter the `translation` column for empty cells.

An older copy of your file still loads after an update: rows are matched by their English text, so only new or changed strings show in English. To get the new rows, take your refreshed `<code>.csv` from the repository, or copy your translations over to the new `template.csv`.

## For the maintainer

```bash
node translations/build.mjs           # refresh template.csv and every <code>.csv, build <code>.js and languages.js
node translations/build.mjs --check   # nothing is written; exit code 1 if anything is stale (tests/i18n.mjs runs this)
```

- `template.csv` is generated from `i18n-en.js` (`СЛОВАРЬ_EN`, `ШАБЛОНЫ_EN`, `ЗОДИАК_EN`, `КОД_EN`) and from the English branches in the code (`английский() ? 'EN' : 'RU'`, `L('ru', 'en')`), plus the CSS labels in `css/lang-en.css`. Strings sent to the model are left out.
- Only rows that come from the code are matched against English text on the page. Dictionary rows translate only through their Russian original, so a character named Leo never turns into a zodiac sign.
- Text for the model goes through `тМодели()` (`i18n.js`): it is English for every language except Russian.
- `<code>.js`, `languages.js` and `meta.js` are generated too. Never edit them by hand. `meta.js` lists every string, which ones come from the code, and the CSS rules, so the HUD can build a language from a CSV loaded in the settings.
- `table.js` holds the parsing and checking of a table. Both `build.mjs` and the in-HUD loader use it, so a file loaded in the settings behaves exactly like a built one.
- Strings that the code assembles from pieces in English go into `КОД_EN` in `i18n-en.js`. An English literal that needs translating right where it is built uses `англ('…')` from `i18n.js`.
