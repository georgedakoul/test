"""Replace static bronze color literals across style.css and companion.css
with theme-aware color-mix() / var() so they react to the active palette.

Skipped intentionally:
  • :root variable DEFINITIONS (those are the fallback values theme blocks override).
  • The gold-coin radial gradient (intended to depict gold currency, not the
    UI accent — should not switch to charcoal/green/etc.).
"""
import re, os

CSS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'css')
FILES = ['style.css', 'companion.css']

# rgba(200,132,28,a) → color-mix bronze
RX_BRONZE = re.compile(r'rgba\(\s*200\s*,\s*132\s*,\s*28\s*,\s*(\d*\.?\d+)\s*\)')
# rgba(154,98,24,a) → color-mix bronze-mid
RX_BRONZE_MID = re.compile(r'rgba\(\s*154\s*,\s*98\s*,\s*24\s*,\s*(\d*\.?\d+)\s*\)')

def to_pct(alpha_str):
    a = float(alpha_str)
    # Render as int when whole, else 1-decimal
    pct = a * 100
    return str(int(pct)) if pct == int(pct) else f'{pct:.1f}'

def replace_alpha(m, var_name):
    return f'color-mix(in srgb, var(--{var_name}) {to_pct(m.group(1))}%, transparent)'

def in_root_or_coin(text, pos):
    """Return True if `pos` falls inside a :root { ... } block or inside a
    radial-gradient that contains #ffe87a (the gold coin)."""
    # Search backwards for the nearest `:root` or `}` to detect inside-root.
    before = text[:pos]
    last_root  = before.rfind(':root')
    last_close = before.rfind('}')
    if last_root != -1 and last_root > last_close:
        # In :root unless a closing brace appears between
        return True
    # Coin gradient detection: look back ~200 chars for '#ffe87a' on same gradient line
    window_start = max(0, pos - 200)
    if '#ffe87a' in text[window_start:pos + 200]:
        # Only treat as coin if it's a radial-gradient call
        if 'radial-gradient' in text[window_start:pos + 200] and '#ffe87a' in text[window_start:pos + 200]:
            return True
    return False

def substitute(text, pattern, var_name):
    out = []
    i = 0
    changed = 0
    for m in pattern.finditer(text):
        if in_root_or_coin(text, m.start()):
            continue
        out.append(text[i:m.start()])
        out.append(replace_alpha(m, var_name))
        i = m.end()
        changed += 1
    out.append(text[i:])
    return ''.join(out), changed

# Replace standalone bronze-dark hex (#6a4010) outside :root
RX_BRONZE_DARK_HEX = re.compile(r'#6a4010', re.IGNORECASE)
def replace_bronze_dark(text):
    out, i, changed = [], 0, 0
    for m in RX_BRONZE_DARK_HEX.finditer(text):
        if in_root_or_coin(text, m.start()):
            continue
        out.append(text[i:m.start()])
        out.append('var(--bronze-dark)')
        i = m.end()
        changed += 1
    out.append(text[i:])
    return ''.join(out), changed

for fn in FILES:
    path = os.path.join(CSS_DIR, fn)
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    text, c1 = substitute(text, RX_BRONZE, 'bronze')
    text, c2 = substitute(text, RX_BRONZE_MID, 'bronze-mid')
    text, c3 = replace_bronze_dark(text)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'{fn}:  bronze rgba→{c1}   bronze-mid rgba→{c2}   bronze-dark hex→{c3}')
print('\nDone. Theme variables now flow through every UI accent.')
