"""Convert Shadowdark xlsx files to JSON for the web app."""
import pandas as pd
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
XLSX_DIR = r"C:\Users\Ghost L9\OneDrive\RPGs\Shadowdark RPG\more\shadowdark exel sheets"
OUT_DIR = os.path.join(BASE_DIR, 'static', 'data')

def to_record(row, cols):
    rec = {}
    for c in cols:
        v = row[c]
        try:
            rec[c] = None if pd.isna(v) else v
        except Exception:
            rec[c] = v
    return rec

os.makedirs(OUT_DIR, exist_ok=True)

MAPPINGS = [
    ('Weapons Table Shadowdark.xlsx',    'Sheet1', 'weapons'),
    ('Armor and Shield Shadowdark.xlsx', 'Sheet1', 'armor'),
    ('Spells Shadowdark.xlsx',           'Sheet1', 'spells'),
    ('Adventuring gear Shadowdark.xlsx', 'Sheet1', 'gear'),
    ('Magic Items Shadowdark.xlsx',      'Sheet1', 'magic_items'),
    ('Gems Shadowdark.xlsx',             'Sheet1', 'gems'),
    ('Plants and Poisons Shadowdark.xlsx','Sheet1','plants_poisons'),
    ('Traps Shadowdark.xlsx',            'Sheet1', 'traps'),
    ('Mounts Shadowdark.xlsx',           'Sheet1', 'mounts'),
    ('Mount Gear Shadowdark.xlsx',       'Sheet1', 'mount_gear'),
    ('Spell Catalysts Shadowdark.xlsx',  'Sheet1', 'spell_catalysts'),
]

for filename, sheet, name in MAPPINGS:
    path = os.path.join(XLSX_DIR, filename)
    if not os.path.exists(path):
        print(f'  MISSING: {filename}')
        continue
    df = pd.read_excel(path, sheet_name=sheet)
    df.columns = [str(c).strip() for c in df.columns]
    records = [to_record(row, df.columns) for _, row in df.iterrows()]
    out = os.path.join(OUT_DIR, f'{name}.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2, default=str)
    print(f'  OK  {name}.json  ({len(records)} rows)')

print('Done.')
