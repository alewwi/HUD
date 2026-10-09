# Стенд галочек по темам: tests/tools/checkbox-stand.html (самодостаточный —
# стили тем вшиты, каждая тема в своём iframe через srcdoc).
import html, os
base = os.path.dirname(os.path.abspath(__file__))
root = os.path.normpath(os.path.join(base, '..', '..'))
def кусок(f, от, до):
    t = open(os.path.join(root, 'css', f), encoding='utf-8').read()
    i = t.index(от); return t[i:t.index(до, i)]
# Только правила галочек — иначе стенд весит мегабайты.
css = кусок('extras.css', '/* --- Галочки настроек под тему', '/* ====') + '/* ' + кусок('deco.css', 'ГАЛОЧКИ И ПОЛЗУНКИ ПО ТЕМЕ', '/* Ползунки:')
ст = """input[type='checkbox'] { -webkit-appearance: none; appearance: none; position: relative; width: 14px; height: 14px; overflow: hidden; border-radius: 3px;
 border: 1px solid #888; background-color: #ddd; cursor: pointer; display: grid; place-content: center; }
input[type="checkbox"]::before { content: ""; width: .65em; height: .65em; transform: scale(0); box-shadow: inset 1em 1em #222;
 clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%); }
input[type="checkbox"]:checked::before { transform: scale(1); }
body { margin: 0; background: #17131c; color: #eee; font: 13px system-ui; --hud-accent: #d96a8a; }
.row { display: flex; align-items: center; gap: 16px; padding: 6px 10px; }
label { display: inline-flex; align-items: center; gap: 4px; } b { width: 90px; opacity: .7; font-weight: 500; }"""
темы = ['vamp', 'cottage', 'ice', 'ocean', 'kawaii', 'academia', 'cyberpunk', 'noir', 'medieval', 'fantasy', 'mafia', 'steampunk', 'dieselpunk',
        'solarpunk', 'biopunk', 'spaceopera', 'japan', 'egypt', 'western', 'pirate', 'witch', 'voodoo', 'spacehorror', 'web1']
# Значки и рамки галочек (--cb-on, --cb-frame…) живут в файле темы:
# css/themes/<тема>.css, грузится только выбранный.
def знаки(т):
    p = os.path.join(root, 'css', 'themes', т + '.css')
    return '\n'.join(l for l in open(p, encoding='utf-8').read().splitlines() if '--cb-' in l) if os.path.exists(p) else ''
кадры = []
for т in темы:
    doc = (f'<!doctype html><html class="hud-themed-controls hud-theme-{т}"><head><meta charset="utf-8"><style>{ст}\n{css}\n{знаки(т)}</style></head>'
           f'<body><div id="hud-settings-wrapper"><div class="row"><b>{т}</b><label><input type="checkbox"> выкл</label>'
           f'<label><input type="checkbox" checked> вкл</label><label><input type="checkbox"> выкл</label><label><input type="checkbox" checked> вкл</label></div></div></body></html>')
    кадры.append(f'<iframe srcdoc="{html.escape(doc, quote=True)}" style="width:420px;height:34px;border:0;display:block"></iframe>')
out = f'<!doctype html><html><head><meta charset="utf-8"><title>Галочки по темам</title></head><body style="margin:0;background:#17131c;padding:10px">{"".join(кадры)}</body></html>'
open(os.path.join(base, 'checkbox-stand.html'), 'w', encoding='utf-8').write(out)
print('стенд галочек:', os.path.join(base, 'checkbox-stand.html'))
