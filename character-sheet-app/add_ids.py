"""Add a stable `id` field to every entry across all data files.

The id is a language-neutral slug derived from the entry's primary English name
(or, for files that exist only in Greek today, a deterministic index id). It is
the SAME between the English file and any `_<lang>.json` counterpart so logic
can match across languages.

Already-id'd files (glossary, gods) are skipped.
"""
import json, os, re, unicodedata

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'data')

# Primary "name" key per file
NAME_KEY = {
    'armor.json':            'Armor',
    'weapons.json':          'Weapon',
    'spells.json':           'Spell Name',
    'gear.json':              'Item',
    'magic_items.json':      'Name',
    'plants_poisons.json':   'Item',
    'traps.json':             'Item',
    'mounts.json':           'Name',
    'mount_gear.json':       'Name',
    'classes.json':          'class',
    'class_titles.json':     None,        # special-cased below if present
    'class_talents.json':    None,        # ditto
    'races.json':            'race',
    'backgrounds.json':      'background',
    'languages.json':        'name',
    'monsters.json':         'Name',
    # Greek-only files: index-based ids until English versions are added
    'gems.json':             ('__index__', 'gem'),
    'spell_catalysts.json':  ('__index__', 'catalyst'),
}

# Files that already carry an id field — don't touch
SKIP = {'glossary.json', 'gods.json', 'books.json'}

def slugify(s):
    if s is None: s = ''
    s = str(s)
    # Strip diacritics (Banded -> banded, Λαμελάρ -> lamelar) for ASCII slugs
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '_', s)
    s = s.strip('_')
    return s or 'item'

def add_ids(filename):
    path = os.path.join(DATA, filename)
    if not os.path.exists(path):
        print(f'  SKIP  {filename} (missing)')
        return
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, list) or not data:
        print(f'  SKIP  {filename} (not a non-empty list)')
        return
    # Already has ids? (idempotent — refresh missing ones only)
    name_key = NAME_KEY.get(filename)
    # Special case: classes have a numeric id-ish field? They don't, fall through
    used = set()
    changed = 0
    for i, entry in enumerate(data):
        if 'id' in entry and entry['id']:
            used.add(str(entry['id']))
            continue
        if isinstance(name_key, tuple) and name_key[0] == '__index__':
            # Greek-only file: index-based id
            base = name_key[1]
            new_id = f'{base}_{i+1:03d}'
        else:
            primary = entry.get(name_key, '') if name_key else ''
            new_id = slugify(primary) or f'entry_{i+1:03d}'
        # Disambiguate collisions (e.g., two "Dagger" rows)
        base = new_id
        n = 2
        while new_id in used:
            new_id = f'{base}_{n}'
            n += 1
        used.add(new_id)
        # Insert id at the front of the dict for readability
        new_entry = {'id': new_id}
        new_entry.update(entry)
        data[i] = new_entry
        changed += 1
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'  +id  {filename}: {changed}/{len(data)} new ids')

if __name__ == '__main__':
    print(f'Adding ids to data files in {DATA}\n')
    files = sorted(os.listdir(DATA))
    for f in files:
        if not f.endswith('.json'): continue
        if f in SKIP:
            print(f'  skip  {f} (already has ids)')
            continue
        if f.endswith('_el.json'):
            continue   # handled separately to mirror its English counterpart
        add_ids(f)
    print('\nDone.')
