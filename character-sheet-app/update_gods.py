"""Merge core book gods, Cursed Scroll 1 patrons, and cross-references into gods.json"""
import json

with open('static/data/gods.json', 'r', encoding='utf-8') as f:
    gods = json.load(f)

idx = {g['id']: g for g in gods}

# === CORE BOOK GODS (Shadowdark RPG p28-29) ===
core_gods = [
    {
        "id": "saint_terragnis", "name": "Saint Terragnis",
        "title": "Patron of Lawful Humans", "alignment": "Lawful", "type": "Deity",
        "domain": "Order",
        "description": "A legendary knight who is the patron of most lawful humans. She ascended to godhood long ago and is the embodiment of righteousness and justice.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 28, "image": ""
    },
    {
        "id": "gede", "name": "Gede",
        "title": "God of Feasts and the Wilds", "alignment": "Neutral", "type": "Deity",
        "domain": "Nature",
        "description": "The god of feasts, mirth, and the wilds. Gede is usually peaceful, but primal storms rage when her anger rises. Many elves and halflings worship her.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 28, "image": ""
    },
    {
        "id": "madeera", "name": "Madeera the Covenant",
        "title": "First Manifestation of Law", "alignment": "Lawful", "type": "Deity",
        "domain": "Order",
        "description": "Madeera was the first manifestation of Law. She carries every law of reality, a dictate called the Covenant, written on her skin in precise symbols.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 28, "image": ""
    },
    {
        "id": "ord", "name": "Ord",
        "title": "The Unbending, The Wise, The Secret-Keeper", "alignment": "Neutral", "type": "Deity",
        "domain": "Knowledge, Magic",
        "description": "Ord the Unbending, the Wise, the Secret-Keeper. He is the god of magic, knowledge, secrets, and equilibrium.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 28, "image": ""
    },
    {
        "id": "memnon_core", "name": "Memnon",
        "title": "First Manifestation of Chaos", "alignment": "Chaotic", "type": "Deity",
        "domain": "Trickery",
        "description": "Memnon was the first manifestation of Chaos. He is Madeera's twin, a red-maned, leonine being whose ultimate ambition is to rend the cosmic laws of the Covenant from his sister's skin.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 29, "image": ""
    },
    {
        "id": "ramlaat", "name": "Ramlaat",
        "title": "The Pillager, The Barbaric, The Horde", "alignment": "Chaotic", "type": "Deity",
        "domain": "War",
        "description": "Ramlaat is the Pillager, the Barbaric, the Horde. Many orcs worship him and live by the Blood Rite, a prophecy that says only the strongest will survive a coming doom.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 29, "image": ""
    },
    {
        "id": "shune", "name": "Shune the Vile",
        "title": "The Mother Witch", "alignment": "Chaotic", "type": "Deity, Patron",
        "domain": "Magic",
        "description": "Shune whispers arcane secrets to sorcerers and witches who call to her in the dark hours. She schemes to displace Ord so she can control the vast flow of magic herself. She communicates with her offspring through the flickering of candle flames and the clinking of dried herbs. Shune seeks hidden secrets and lost legends.",
        "aka": ["Shune the Malevolent"],
        "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 29, "image": "",
        "patron_gifts": [
            {"roll": "2", "effect": "1/day, teleport up to Far (visible location) with your movement."},
            {"roll": "3-7", "effect": "+1 to melee or ranged attacks."},
            {"roll": "8-9", "effect": "+2 to the Strength or Dexterity attribute."},
            {"roll": "10-11", "effect": "1/day, force an Adjacent being to test the moral, even if it is immune."},
            {"roll": "12", "effect": "Choose one option, or 2 points to distribute among the attributes."}
        ]
    },
    {
        "id": "the_lost", "name": "The Lost",
        "title": "The Forbidden, The Forgotten", "alignment": "Unknown", "type": "Deity",
        "domain": "",
        "description": "Two of The Nine are lost to the ages, their names expunged from history and memory. Yet their whispered legend lives on in ancient texts and forgotten places.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Shadowdark RPG Core", "page": 29, "image": ""
    },
    {
        "id": "kytheros", "name": "Kytheros",
        "title": "God of Time", "alignment": "Chaotic", "type": "Patron",
        "domain": "Knowledge",
        "description": "The Lord of Time, the one who perceives all possible futures. Kytheros aims for the fulfillment of all destinies as they should be.",
        "aka": [], "pantheons": ["Shadowdark"], "servants": [], "followers": [],
        "source": "Cursed Scroll 1", "page": 17, "image": "",
        "patron_gifts": [
            {"roll": "2", "effect": "Once per day, force the DM to redo a single roll."},
            {"roll": "3-7", "effect": "Gain +1 to your AC from a supernatural foresight."},
            {"roll": "8-9", "effect": "+2 to the Strength, Dexterity, or Wisdom attribute."},
            {"roll": "10-11", "effect": "Three times per day, add your Wisdom bonus to a roll (roll again if repeated)."},
            {"roll": "12", "effect": "Choose one option, or 2 points to distribute among the attributes."}
        ]
    },
]

# Add Cursed Scroll 1 exclusive patrons
cs1_patrons = [
    {
        "id": "almazzat", "name": "Almazzat",
        "title": "The Wolf-Headed Archdemon", "alignment": "Chaotic", "type": "Patron",
        "domain": "",
        "description": "An archdemon with a wolf's head, six eyes, and six horns. Almazzat seeks to take the Sands of Eras from his father, Kytheros.",
        "aka": [], "pantheons": [], "servants": [], "followers": [],
        "source": "Cursed Scroll 1", "page": 17, "image": "",
        "patron_gifts": [
            {"roll": "2", "effect": "1/day, gain Advantage on melee attacks for 3 rounds."},
            {"roll": "3-7", "effect": "Learn to use 1 melee weapon or +1 on melee attacks."},
            {"roll": "8-9", "effect": "+2 to Strength or Constitution, or +1 to melee damage."},
            {"roll": "10-11", "effect": "Gain Advantage on initiative rolls (roll again if repeated)."},
            {"roll": "12", "effect": "Choose one option, or 2 points to distribute among the attributes."}
        ]
    },
    {
        "id": "the_willow_man", "name": "The Willow-Man",
        "title": "The Ghostly Watcher", "alignment": "Chaotic", "type": "Patron",
        "domain": "",
        "description": "An elongated and ghostly being that wanders through the misty forests and watches everything from the threshold of nightmares. The Willow-Man seeks fear.",
        "aka": [], "pantheons": [], "servants": [], "followers": [],
        "source": "Cursed Scroll 1", "page": 17, "image": "",
        "patron_gifts": [
            {"roll": "2", "effect": "1/day, hypnotize a creature of CR 5 or lower for 3 rounds."},
            {"roll": "3-7", "effect": "Learn to use a longbow or +1 in ranged attacks."},
            {"roll": "8-9", "effect": "+2 to the Dexterity or Charisma attribute."},
            {"roll": "10-11", "effect": "Hostile spells that target you are always Difficult to cast."},
            {"roll": "12", "effect": "Choose one option, or 2 points to distribute among the attributes."}
        ]
    },
]

# Add core gods
for g in core_gods:
    if g['id'] not in idx:
        gods.append(g)
        idx[g['id']] = g
        print(f"  Added: {g['name']} ({g['source']})")

# Add CS1 patrons
for g in cs1_patrons:
    if g['id'] not in idx:
        gods.append(g)
        idx[g['id']] = g
        print(f"  Added patron: {g['name']} ({g['source']})")

# === CROSS-REFERENCES ===
# Oghma is Ord in Shadowdark setting
if 'oghma' in idx:
    if 'Ord' not in idx['oghma']['aka']:
        idx['oghma']['aka'].append('Ord')
    if 'Shadowdark' not in idx['oghma']['pantheons']:
        idx['oghma']['pantheons'].append('Shadowdark')

# Silvanus is Gede in Shadowdark
if 'silvanus' in idx:
    if 'Gede' not in idx['silvanus']['aka']:
        idx['silvanus']['aka'].append('Gede')
    if 'Shadowdark' not in idx['silvanus']['pantheons']:
        idx['silvanus']['pantheons'].append('Shadowdark')

# Gruumsh aka Ramlaat
if 'gruumsh' in idx:
    if 'Ramlaat' not in idx['gruumsh']['aka']:
        idx['gruumsh']['aka'].append('Ramlaat')

# Asmodeus aka Kytheros
if 'asmodeus' in idx:
    if 'Kytheros' not in idx['asmodeus']['aka']:
        idx['asmodeus']['aka'].append('Kytheros')

# Jubilex aka Mugdulblub - add patron gifts
if 'jubilex' in idx:
    if 'Mugdulblub' not in idx['jubilex']['aka']:
        idx['jubilex']['aka'].append('Mugdulblub')
    idx['jubilex']['patron_gifts'] = [
        {"roll": "2", "effect": "Once per day, transform into a crawling puddle of slime for 3 rounds."},
        {"roll": "3-7", "effect": "Maximize 2 rolls of life dice (previous or future)."},
        {"roll": "8-9", "effect": "+2 to the Dexterity or Constitution attribute."},
        {"roll": "10-11", "effect": "Become immune to acid, cold, or poison (roll again upon acquiring all)."},
        {"roll": "12", "effect": "Choose one option, or 2 points to distribute among the attributes."}
    ]

# Titania patron gifts
if 'titania' in idx:
    idx['titania']['patron_gifts'] = [
        {"roll": "2", "effect": "1/day, read the mind of a creature you touch for 3 rounds."},
        {"roll": "3-7", "effect": "Learn 1 wizard spell, level = 1/2 of your level. Cast it with INT."},
        {"roll": "8-9", "effect": "+2 to the Dexterity or Intelligence attribute."},
        {"roll": "10-11", "effect": "+1 XP whenever you learn a valuable or significant secret."},
        {"roll": "12", "effect": "Choose one option, or 2 points to distribute among the attributes."}
    ]

# Belphegor — also Almazzat's alternate identity per Death Timer
if 'belphegor' in idx:
    if 'Almazzat' not in idx['belphegor']['aka']:
        idx['belphegor']['aka'].append('Almazzat')

# Lolth — add Shadowdark pantheon
if 'lolth' in idx:
    if 'Shadowdark' not in idx['lolth']['pantheons']:
        idx['lolth']['pantheons'].append('Shadowdark')

# Sort: Shadowdark setting gods first, then by alignment, then name
align_order = {'Lawful': 0, 'Neutral': 1, 'Chaotic': 2, 'Unknown': 3}
gods.sort(key=lambda g: (
    0 if 'Shadowdark' in (g.get('pantheons') or []) else 1,
    align_order.get(g.get('alignment', ''), 3),
    g.get('name', '').lower()
))

with open('static/data/gods.json', 'w', encoding='utf-8') as f:
    json.dump(gods, f, indent=2, ensure_ascii=False)

print(f"\nTotal: {len(gods)} gods/patrons")
print(f"With patron gifts: {sum(1 for g in gods if g.get('patron_gifts'))}")
print(f"Sources: {sorted(set(g['source'] for g in gods))}")
