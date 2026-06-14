import json, os

BASE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE, 'classes.json'), 'r', encoding='utf-8') as f:
    classes = json.load(f)
with open(os.path.join(BASE, 'class_talents.json'), 'r', encoding='utf-8') as f:
    talents = json.load(f)
with open(os.path.join(BASE, 'class_titles.json'), 'r', encoding='utf-8') as f:
    titles = json.load(f)

existing_classes = {c['class'] for c in classes}

# ── Helper ──────────────────────────────────────────────────────────────
def spells_table(rows):
    """rows = list of (t1,t2,t3,t4,t5) per level 1-10"""
    return [{"level": i+1, "tier1": r[0], "tier2": r[1], "tier3": r[2], "tier4": r[3], "tier5": r[4]}
            for i, r in enumerate(rows)]

def title_entry(cls, source, rows):
    """rows = list of (lawful, chaotic, neutral) per 2-level band"""
    bands = [(1,2),(3,4),(5,6),(7,8),(9,10)]
    return {"class": cls, "source": source, "titles": [
        {"level_min": b[0], "level_max": b[1], "lawful": r[0], "chaotic": r[1], "neutral": r[2]}
        for b, r in zip(bands, rows)
    ]}

def talent_entry(cls, source, die, table, note=None):
    e = {"class": cls, "source": source, "die": die, "table": table}
    if note: e["note"] = note
    return e

# ═══════════════════════════════════════════════════════════════════════
#  NEW CLASSES
# ═══════════════════════════════════════════════════════════════════════
new_classes = []
new_talents = []
new_titles  = []

# ── CS3: Sea Wolf ────────────────────────────────────────────────────
if "Sea Wolf" not in existing_classes:
    new_classes.append({
        "class": "Sea Wolf", "source": "Cursed Scroll 3",
        "description": "Raiders of the seas who sail dragonships in search of plunder. When the war trumpet sounds, they become fierce berserkers who seek to honor their gods with a worthy death.",
        "weapons": "Dagger, longbow, longsword, spear, hatchet, greataxe",
        "armor": "Leather armor, chainmail, shields",
        "hit_points": "1d8 per level",
        "spellcasting": None, "spellcasting_ability": None, "spells_known_table": None,
        "features": [
            {"name": "Sailor", "description": "You have advantage on checks related to navigation and crewing vessels."},
            {"name": "Ancient Gods", "description": "Each day after a rest, align with one Ancient God: Odin (lawful) — regain 1d4 HP each time you kill an enemy; Freya (neutral) — once per day gain a luck token if you have none, add 1d6 when you spend it; Loki (chaotic) — advantage on checks to lie, sneak, and hide."},
            {"name": "Shield Wall", "description": "If wielding a shield, use your action to take a defensive stance. Your AC becomes 20 until you leave this stance."}
        ]
    })
    new_talents.append(talent_entry("Sea Wolf","Cursed Scroll 3","2d6",[
        {"roll":"2",     "effect":"1/day, enter a rage: immune to damage for 3 rounds (reroll if duplicate)"},
        {"roll":"3-6",   "effect":"Your attacks deal +1 damage"},
        {"roll":"7-9",   "effect":"+2 to STR or CON, or +1 to attack rolls"},
        {"roll":"10-11", "effect":"Duality — choose 2 different Ancient God effects each day"},
        {"roll":"12",    "effect":"Choose a talent or +2 points to distribute to stats"}
    ]))
    new_titles.append(title_entry("Sea Wolf","Cursed Scroll 3",[
        ("Free Folk",  "Scum",        "Wanderer"),
        ("Esquire",    "Raider",      "Explorer"),
        ("Thane",      "Plunderer",   "Adventurer"),
        ("Jarl",       "Conqueror",   "Renowned"),
        ("King/Queen", "Usurper",     "Legendary"),
    ]))

# ── CS3: Seer ────────────────────────────────────────────────────────
if "Seer" not in existing_classes:
    new_classes.append({
        "class": "Seer", "source": "Cursed Scroll 3",
        "description": "Sinister oracles who unravel the whispers of the gods by reading runes, bones, and stars. Their knowledge of fate allows them to shape it.",
        "weapons": "Dagger, staff, spear",
        "armor": "Leather armor",
        "hit_points": "1d6 per level",
        "spellcasting": "seer",
        "spellcasting_ability": "wis",
        "spells_known_table": spells_table([
            (1,0,0,0,0),(2,0,0,0,0),(2,1,0,0,0),(2,2,0,0,0),(2,2,1,0,0),
            (2,2,2,0,0),(2,2,2,1,0),(2,2,2,2,0),(2,2,2,2,1),(2,2,2,2,2)
        ]),
        "features": [
            {"name": "Fated", "description": "Whenever you spend a luck token, add 1d6 to the roll."},
            {"name": "Omen", "description": "3/day, make a DC 9 WIS check. On a success, gain a luck token (max one at a time)."},
            {"name": "Conjuration", "description": "You can cast seer spells you know. You know one tier 1 seer spell. You use Wisdom (DC = 10 + spell tier). On a natural 1, you cannot cast that spell again until you complete a Seer's Penance."}
        ]
    })
    new_talents.append(talent_entry("Seer","Cursed Scroll 3","2d6",[
        {"roll":"2",     "effect":"Learn +1 seer spell of any tier you can cast"},
        {"roll":"3-6",   "effect":"Gain an additional use of Omen per day"},
        {"roll":"7-9",   "effect":"+2 to WIS or CHA stat, or +1 to spellcasting checks"},
        {"roll":"10-11", "effect":"Increase the Fated bonus die by one step (e.g. d6 → d8)"},
        {"roll":"12",    "effect":"Choose a talent or +2 points to distribute to stats"}
    ]))
    new_titles.append(title_entry("Seer","Cursed Scroll 3",[
        ("Guide",        "Hedge Witch",  "Diviner"),
        ("Enchanter",    "Whisperer",    "Chanter"),
        ("Rune Reader",  "Bone Reader",  "Star Reader"),
        ("The Wise",     "The Feared",   "The Blessed"),
        ("Seer of Odin", "Seer of Loki", "Seer of Freya"),
    ]))

# ── Codex Officium II ────────────────────────────────────────────────
co2_classes = [
    ("Assassin (CO2)", "Dark rogues who focus on slaying creatures for profit, masters of poison and stealth.",
     "All weapons", "Leather armor, mithral chainmail", "1d6 per level", None, None, None,
     [{"name":"Execute","description":"If you attack a surprised creature or one that has not yet acted in initiative, deal an additional 1d6 damage plus d6s equal to half your level."},
      {"name":"Poisoner","description":"When you defeat a monster with a poison attack, harvest one dose (requires empty phial). Add your INT modifier to your poison's DC. Custom poisons can also be crafted (coordinate with GM)."},
      {"name":"Skills","description":"Advantage on checks related to Climbing, Listening, Lockpicking, Poisons, and Stealth."}]),
    ("Crusader", "Warrior-priests devoted to their deity and cause, wielding both martial might and divine magic.",
     "All weapons", "All armor and shields", "1d8 per level", "priest", "wis",
     spells_table([(1,0,0,0,0),(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),
                   (3,3,0,0,0),(3,3,1,0,0),(3,3,2,0,0),(3,3,3,0,0),(3,3,3,1,0)]),
     [{"name":"Deity","description":"Choose a god matching your alignment. You have a holy symbol (no gear slots)."},
      {"name":"Faith Militant","description":"You have a +2 bonus to all saving throws."},
      {"name":"Spellcasting","description":"You can cast priest spells you know. At 1st level you know the light spell. Choose new spells per the Crusader Spells Known table."}]),
    ("Knight", "Members of the fighting nobility, sworn to fight for their liege in whatever cause they deem worthy.",
     "All melee weapons", "All armor and shields", "1d8 per level", None, None, None,
     [{"name":"Oath","description":"You must swear allegiance to a liege lord or lady. Your alignment matches that of your liege."},
      {"name":"First Strike","description":"Advantage on the first melee attack you make in combat, and it deals extra damage equal to your STR modifier on a hit."},
      {"name":"Horsemanship","description":"Advantage on all checks related to horses or mounts."},
      {"name":"Hospitality","description":"You receive basic courtesies in any civilized settlement; services of 1 gp or less are free."}]),
    ("Thaumaturge", "Scholars of divine and arcane forces who bend reality in the name of their deity and academics.",
     "Dagger, sling, staff", "None", "1d4 per level", "priest/wizard", "wis",
     spells_table([(2,0,0,0,0),(3,0,0,0,0),(4,1,0,0,0),(4,2,0,0,0),(4,2,1,0,0),
                   (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
     [{"name":"Faith","description":"Select a deity to serve who grants you priestly spells."},
      {"name":"Spellcasting","description":"You can cast priest or wizard spells you know per the Thaumaturge Spells Known table. Unlike a wizard, you cannot copy spells from scrolls into a spellbook."}]),
    ("Troubadour", "Traveling entertainers, duelists, magic-dabblers, and vagabonds.",
     "All ranged and one-handed melee weapons", "Leather armor, mithral chainmail", "1d6 per level",
     "wizard", "int",
     spells_table([(1,0,0,0,0),(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),
                   (3,3,0,0,0),(3,3,1,0,0),(3,3,2,0,0),(3,3,3,0,0),(3,3,3,1,0)]),
     [{"name":"Inspiration","description":"Each day gain 1d4 luck tokens. Allies who can see or hear you may use them. You can hold more than one luck token at a time."},
      {"name":"Skills","description":"You have a musical instrument (no gear slots). Advantage on Lore, Performance, and Sleight of Hand checks."},
      {"name":"Spellcasting","description":"You can cast wizard spells you know per the Troubadour Spells Known table."}]),
    ("Revenant", "Wrongfully murdered, risen from the grave to seek justice. When your time is done, you will return to dust.",
     "All weapons", "All armor and shields", "1d8 per level", None, None, None,
     [{"name":"Undead","description":"You do not need to breathe, eat, or sleep. Immune to charm and fear. Vulnerable to effects that affect undead. Suffer a -2 penalty on reaction checks."},
      {"name":"Unnatural Might","description":"Your melee attacks deal +2 damage and your unarmed attacks deal 1d6 bludgeoning damage."}]),
]

co2_talent_tables = {
    "Assassin (CO2)": [
        {"roll":"2",     "effect":"Advantage on initiative checks (reroll if duplicate)"},
        {"roll":"3-6",   "effect":"+1 to melee or ranged attacks"},
        {"roll":"7-9",   "effect":"+2 to STR, DEX, or INT stat"},
        {"roll":"10-11", "effect":"+1 to melee or ranged damage"},
        {"roll":"12",    "effect":"Choose a talent or +2 stat points"}
    ],
    "Crusader": [
        {"roll":"2",     "effect":"+1 to spellcasting checks"},
        {"roll":"3-6",   "effect":"+1 to melee and ranged attacks"},
        {"roll":"7-9",   "effect":"+2 to STR, CON, or WIS stat"},
        {"roll":"10-11", "effect":"+1 to melee and ranged damage"},
        {"roll":"12",    "effect":"Choose a talent or +2 stat points"}
    ],
    "Knight": [
        {"roll":"2",     "effect":"+1 to all saving throws"},
        {"roll":"3-7",   "effect":"+1 to melee attacks and damage"},
        {"roll":"8-11",  "effect":"+2 to STR, CON, or CHA stat"},
        {"roll":"12",    "effect":"Choose a talent or +2 stat points"}
    ],
    "Thaumaturge": [
        {"roll":"2",     "effect":"+1 to spellcasting checks"},
        {"roll":"3-7",   "effect":"+2 to INT or WIS stat"},
        {"roll":"8-9",   "effect":"Gain advantage on casting one spell you know"},
        {"roll":"10-11", "effect":"Learn one additional priest or wizard spell of a tier you can cast"},
        {"roll":"12",    "effect":"Choose a talent or +2 stat points"}
    ],
    "Troubadour": [
        {"roll":"2",     "effect":"+1 to spellcasting checks"},
        {"roll":"3-6",   "effect":"+1 to melee and ranged attacks"},
        {"roll":"7-9",   "effect":"+2 to STR, DEX, or INT stat"},
        {"roll":"10-11", "effect":"+1 to melee and ranged damage"},
        {"roll":"12",    "effect":"Choose a talent or +2 stat points"}
    ],
    "Revenant": [
        {"roll":"2",     "effect":"If reduced to 0 HP by physical damage, make a CON DC 15 save to go to 1 HP instead (reroll duplicate)"},
        {"roll":"3-6",   "effect":"+1 to melee and ranged attacks"},
        {"roll":"7-9",   "effect":"+2 to STR or CON stat"},
        {"roll":"10-11", "effect":"+1 to melee and ranged damage"},
        {"roll":"12",    "effect":"Choose a talent or +2 stat points"}
    ],
}

for (cn, desc, wpn, arm, hp, sc, sca, skt, feats) in co2_classes:
    if cn not in existing_classes:
        new_classes.append({
            "class": cn, "source": "Codex Officium II",
            "description": desc, "weapons": wpn, "armor": arm, "hit_points": hp,
            "spellcasting": sc, "spellcasting_ability": sca, "spells_known_table": skt,
            "features": feats
        })
        base_name = cn.replace(" (CO2)","")
        tbl = co2_talent_tables.get(cn) or co2_talent_tables.get(base_name)
        if tbl:
            new_talents.append(talent_entry(cn, "Codex Officium II", "2d6", tbl))

# ── Cursed Classes ───────────────────────────────────────────────────
cursed_classes = [
    ("Lycan", "Moonlit howlers, mysterious and untamed. Lycans embody primal forces of nature.",
     "None (natural weapons only)", "None", "1d10 per level", None, None, None,
     [{"name":"Corruption","description":"Gain +1 when you commit an evil deed, spend a round in complete darkness, or roll Nat 1. At 10 Corruption you become a DM-controlled monster. Good deeds or a rest remove Corruption."},
      {"name":"Steel Skinned","description":"Your AC is 8 + DEX modifier + CON modifier."},
      {"name":"Beastly Claws","description":"As an action, make 2 unarmed attacks with your claws, each dealing 1d6 damage."},
      {"name":"Super Senses","description":"As an action, gain 1 Corruption to gain advantage on any WIS or STR check."},
      {"name":"Thick Skinned","description":"As an action, gain 1 Corruption to halve all damage from non-magical sources for 1d6 rounds."},
      {"name":"Shifter","description":"Gain 1 Corruption to gain the effects of the Alter Self spell."}]),
    ("Vampire", "Graceful in death. Vampires tap into the powers of undeath, reinvigorating themselves whilst punishing their enemies.",
     "All weapons", "All armor and shields", "1d6 per level", "wizard", "cha",
     spells_table([(1,0,0,0,0),(2,0,0,0,0),(2,1,0,0,0),(2,2,0,0,0),(3,2,0,0,0),
                   (3,2,1,0,0),(3,3,1,0,0),(3,3,2,0,0),(3,3,2,1,0),(3,3,3,1,0)]),
     [{"name":"Corruption","description":"Gain +1 when you commit an evil deed, spend a round in complete darkness, or roll Nat 1. At 10 Corruption you become a DM-controlled monster. Good deeds or a rest remove Corruption."},
      {"name":"Shadow-Born","description":"Take half damage when in darkness, but double damage when exposed to sunlight."},
      {"name":"Blood Sucker","description":"Make a melee attack. On success, deal 1d4 damage and regain HP equal to damage dealt. Gain 1 Corruption."},
      {"name":"Spellcasting","description":"You can cast wizard spells you know. You know one tier 1 spell. Primary spellcasting stat is Charisma. Gain 1 Corruption to cast a spell with advantage."}]),
    ("Fae", "Adorable, beautiful, and uncanny tricksters. The Fae personify nature's unpredictability and ruthlessness.",
     "All non-two-handed or versatile weapons", "Leather armor, mithral chainmail", "1d6 per level",
     "wizard/priest", "cha", None,
     [{"name":"Corruption","description":"Gain +1 when you commit an evil deed, spend a round in complete darkness, or roll Nat 1. At 10 Corruption you become a DM-controlled monster. Good deeds or a rest remove Corruption."},
      {"name":"Eyes Wide Open","description":"Immune to all charm and sleep spells. Advantage whenever detecting traps, secrets, or ambushes."},
      {"name":"Oathbound","description":"Make a time-limited oath with any creature. If the creature breaks or fails it, they take 1d4 damage. Making an impossible-to-fulfill oath gives you 2 Corruption."},
      {"name":"Spellcasting","description":"You know two tier 1 spells from the wizard or priest spell list. You can cast with Charisma or Wisdom."},
      {"name":"Primal Magic","description":"You can cast any spell you have witnessed of a tier equal to half your level by gaining 3 Corruption."}]),
    ("Medium", "Veiled in ethereal allure, Mediums bridge the realms of the living and dead, communing with spirits.",
     "Club, crossbow, dagger, shortsword", "Leather armor", "1d4 per level", None, "int", None,
     [{"name":"Corruption","description":"Gain +1 when you commit an evil deed, spend a round in complete darkness, or roll Nat 1. At 10 Corruption you become a DM-controlled monster. Good deeds or a rest remove Corruption."},
      {"name":"True Sight","description":"As an action, see invisible creatures and objects."},
      {"name":"Manifested Will","description":"Make an INT spellcasting check to create your Manifested Will — an invisible creature with HP equal to your level + INT modifier. On failure, gain 1 Corruption. When the Will is killed or focus is lost, gain 2 Corruption."},
      {"name":"Mind Crush","description":"Make an INT spellcasting check (DC 10) to deal 1d4 damage to a target you can see. On failure, gain 1 Corruption."}]),
]

cursed_talent_tables = {
    "Lycan": [
        {"roll":"2",     "effect":"+1 to attacks with Beastly Claws (reroll if duplicate)"},
        {"roll":"3-6",   "effect":"+1 to melee attacks"},
        {"roll":"7-9",   "effect":"+2 to STR, WIS, or CON stat"},
        {"roll":"10-11", "effect":"Increase max Corruption by +2"},
        {"roll":"12",    "effect":"Choose a talent or +2 points to distribute to stats"}
    ],
    "Vampire": [
        {"roll":"2",     "effect":"Blood Sucker deals +1 dice of damage"},
        {"roll":"3-5",   "effect":"Learn a level 1 wizard spell"},
        {"roll":"6-9",   "effect":"+2 to DEX, CON, or CHA stat"},
        {"roll":"10-11", "effect":"Gain Weapon Mastery with one weapon type"},
        {"roll":"12",    "effect":"Choose a talent or +2 points to distribute to stats"}
    ],
    "Fae": [
        {"roll":"2",     "effect":"Oathbound deals +2 dice of damage"},
        {"roll":"3-5",   "effect":"Learn a spell of a tier lower than half your level"},
        {"roll":"6-9",   "effect":"+2 to INT, DEX, or CHA stat"},
        {"roll":"10-11", "effect":"Roll on the talent table for a class of your choice"},
        {"roll":"12",    "effect":"Any class talent or +2 points to distribute to stats"}
    ],
    "Medium": [
        {"roll":"2",     "effect":"Gain advantage on focus checks (reroll if duplicate)"},
        {"roll":"3-5",   "effect":"Learn a wizard spell of a tier lower than half your level"},
        {"roll":"6-9",   "effect":"+2 to INT, DEX, or CON stat"},
        {"roll":"10-11", "effect":"Mind Crush gets +1 die of damage"},
        {"roll":"12",    "effect":"Choose a talent or +2 points to distribute to stats"}
    ],
}

for (cn, desc, wpn, arm, hp, sc, sca, skt, feats) in cursed_classes:
    if cn not in existing_classes:
        new_classes.append({
            "class": cn, "source": "Cursed Classes",
            "description": desc, "weapons": wpn, "armor": arm, "hit_points": hp,
            "spellcasting": sc, "spellcasting_ability": sca, "spells_known_table": skt,
            "features": feats
        })
        tbl = cursed_talent_tables.get(cn)
        if tbl:
            new_talents.append(talent_entry(cn, "Cursed Classes", "2d6", tbl))

# ── Player's Companion (PC) classes ─────────────────────────────────
# Map: (name_in_file, final_name)  — rename duplicates
PC_CLASSES = [
  ("Archer","Archer","Club, dagger, longbow, shortbow, staff","Leather armor, chainmail","1d8",
   None,None,None,
   [{"name":"Called Shot","description":"Aim at a specific body part on a humanoid (−2 penalty). Below waist: prevents movement 2 rounds. Arm: target drops what it carries. Head: +2 damage."},
    {"name":"Draw","description":"+1 to attack and damage with a longbow or shortbow."},
    {"name":"Quiver","description":"Your first two bundles of arrows don't consume gear slots."},
    {"name":"Taking Cover","description":"You impose disadvantage on ranged attacks or spellcasting checks targeting you with only 25% cover."}]),
  ("Assassin","Assassin (PC)","Club, crossbow, dagger, shortsword, spear","Leather armor, chainmail","1d6",
   None,None,None,
   [{"name":"Backstab","description":"A target unaware of your presence takes an extra damage die. Add an extra die every two levels (2nd, 4th, 6th, 8th, 10th)."},
    {"name":"Shadowed","description":"Advantage on stealth checks; +2 if motionless. You can move silently at half speed."},
    {"name":"Venom","description":"You carry poison (free gear slot). Spend 3 rounds applying it to a weapon. Your next attack deals +1d4 poison damage."}]),
  ("Beastmaster","Beastmaster","Club, dagger, greataxe, javelin, mace, spear, staff","Leather armor, chainmail, shields","1d8",
   None,None,None,
   [{"name":"Animal Kinship","description":"CHA check vs DC 12 to calm a wild animal of your level or less. CHA check vs DC 15 + 1 ration to tame it. On failure, it flees."},
    {"name":"Feed Bag","description":"You can carry up to 5 rations per gear slot instead of 3."},
    {"name":"Snares","description":"Carry string (free gear slot). Spend 3 rounds setting a tripwire trap (1d4 damage, DEX DC 12 to avoid)."}]),
  ("Berserker","Berserker","Bastard sword, club, greataxe, greatsword, javelin, spear","Shields and all armors","1d8",
   None,None,None,
   [{"name":"Blooded","description":"If you deal 1+ melee damage to an opponent, gain +2 AC and double movement for 3 rounds. Recharges on rest."},
    {"name":"Subjugation","description":"Opposed CHA check against a disarmed captured enemy to force them into your service as a shieldbearer (1 gp/day or they flee)."},
    {"name":"Wildling","description":"Advantage on all checks to find food or shelter in the wilderness."}]),
  ("Brigand","Brigand","Club, crossbow, dagger, javelin, mace, shortsword, spear","Leather armor, chainmail, shields","1d6",
   None,None,None,
   [{"name":"Knockout","description":"Carry a sap (free gear slot). DEX check vs opponent's CON check — success renders target unconscious for 5 rounds."},
    {"name":"Shadowed","description":"Advantage on stealth checks; +2 if motionless. Move silently at half speed."},
    {"name":"Thievery","description":"Advantage on DEX checks to disguise, shadow, find/disable traps, pickpocket, or pick locks."}]),
  ("Buccaneer","Buccaneer","Club, crossbow, dagger, mace, shortsword","Leather armor, shields","1d6",
   None,None,None,
   [{"name":"Sailing","description":"Pilot a small vessel without a check. Make all larger vessel piloting/captain checks with advantage."},
    {"name":"Stunts","description":"Leap, swing, or perform combat stunts. DEX check vs difficulty — success deals +1 to +4 bonus damage based on DC. Ignore first 1d6 of falling damage."},
    {"name":"Thievery","description":"Advantage on DEX checks to disguise, shadow, find/disable traps, pickpocket, or pick locks."}]),
  ("Burglar","Burglar","Club, crossbow, dagger, mace, shortsword","Leather armor","1d4",
   None,None,None,
   [{"name":"Palm","description":"Secretly grab an object from close distance (DEX check). Onlookers make opposed WIS check to detect it."},
    {"name":"Shadowed","description":"Advantage on stealth checks; +2 if motionless. Move silently at half speed."},
    {"name":"Thievery","description":"Advantage on DEX checks to disguise, shadow, find/disable traps, pickpocket, or pick locks."}]),
  ("Charlatan","Charlatan","Club, crossbow, dagger, mace, shortsword","Leather armor","1d4",
   None,None,None,
   [{"name":"Charming","description":"CHA check vs DC 12 (non-hostile) or DC 18 (hostile) to fast-talk a creature into compliance. Not a compulsion — they won't act against obvious self-interest."},
    {"name":"Thievery","description":"Advantage on DEX checks to disguise, shadow, find/disable traps, pickpocket, or pick locks."}]),
  ("Conjurer","Conjurer","Dagger, staff","None","1d4",
   "wizard","int",
   spells_table([(3,0,0,0,0),(4,0,0,0,0),(4,1,0,0,0),(4,2,0,0,0),(4,2,1,0,0),
                 (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
   [{"name":"Imps","description":"Create small magical imps (1 per level) to serve you. They fly at walking speed, speak one language, have 1 HP and AC 10, flee combat. You take 1 damage if an imp is slain."},
    {"name":"Scroll Study","description":"Study a scroll for 1 day (INT DC 15) to learn it permanently. The scroll is consumed. Doesn't count toward your spell limit."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Conjurer Spells Known table."}]),
  ("Druid","Druid (PC)","Club, dagger, javelin, shortbow, spear, staff","Leather armor, shields","1d6",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Nature Affinity","description":"Identify plants, animals, and clean water. Pass through overgrown areas leaving no trail. You know Sylvan and Merran. Immune to magic cast by fae creatures."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required) per the Druid Spells Known table."},
    {"name":"Shapeshift","description":"If you roll the Shapeshift talent, you can shapeshift once per rest into a small creature (bird, rat, etc.) or large creature (+2 AC, 2d6 damage) for 3 rounds."}]),
  ("Elementalist","Elementalist","Club, dagger, shortsword, staff","None","1d4",
   "wizard","int",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
   [{"name":"Elemental Focus","description":"Choose one elemental energy to master: Earth, Wind, Fire, Ice, Lightning, Plant, Water, or Shadow."},
    {"name":"Blast","description":"As a combat action, blast an enemy for 1 damage at near range (spellcasting check). A failed or critical failed check has no consequence — it simply fizzles."},
    {"name":"Elemental","description":"When at full HP, use resting downtime to create an animated elemental ally (AC 10, +1 attack, 1d4 damage, 1d4 HP). You can control one per level."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Elementalist Spells Known table."}]),
  ("Enchanter","Enchanter","Dagger, staff","None","1d4",
   "wizard","int",
   spells_table([(3,0,0,0,0),(4,0,0,0,0),(4,1,0,0,0),(4,2,0,0,0),(4,2,1,0,0),
                 (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
   [{"name":"Mesmerizing Gaze","description":"Against an isolated humanoid in conversation with no distractions, make an opposed CHA check to mesmerize them. While mesmerized they reveal information freely (WIS DC 15 to keep a secret, ending the effect)."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Enchanter Spells Known table."}]),
  ("Explorer","Explorer","Club, crossbow, dagger, mace, shortbow, shortsword","Leather armor","1d6",
   None,None,None,
   [{"name":"Alertness","description":"+2 bonus to initiative. Not surprised unless actively engaged in a task."},
    {"name":"Lucky","description":"+2 bonus when rolling a death timer or using a luck token. Can hold up to 2 luck tokens. Stabilization rolls vs DC 9."},
    {"name":"Pathfinding","description":"Advantage on INT checks to determine location or find the path to a known objective."}]),
  ("Gladiator","Gladiator","All weapons","Shields and any armor","1d8",
   None,None,None,
   [{"name":"Dirty Tricks","description":"Use the environment unexpectedly (e.g. kick sand). DEX check vs opponent's AC — success stuns the opponent for 2 rounds."},
    {"name":"Shield Mastery","description":"+1 AC when using a shield. You can bash with your shield (attack roll: 1d4 damage, push opponent to double close distance)."}]),
  ("Mage","Mage (PC)","Dagger, staff","None","1d4",
   "wizard","int",
   spells_table([(4,0,0,0,0),(5,0,0,0,0),(5,1,0,0,0),(5,2,0,0,0),(5,2,1,0,0),
                 (5,3,2,0,0),(5,3,2,1,0),(5,4,2,2,0),(5,4,3,2,1),(5,4,4,2,2)]),
   [{"name":"Signature Spell","description":"Choose one spell per character level as a signature spell. You cannot critically fail when casting it. It manifests in a unique personalized way others can identify."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Mage Spells Known table."}]),
  ("Mariner","Mariner","Club, crossbow, dagger, javelin, mace, shortbow, shortsword","Leather armor","1d6",
   None,None,None,
   [{"name":"Climber","description":"Automatically succeed on easy or normal climbing checks. Hard and extreme climbing checks made with advantage."},
    {"name":"Dead Reckoning","description":"Advantage on INT checks to determine your location at sea or sail to a known objective. With an astrolabe, automatically succeed."},
    {"name":"Sailing","description":"Pilot small vessels without a check. All larger vessel piloting/captain checks made with advantage."}]),
  ("Monk","Monk (PC)","Club, mace, staff","Leather armor, chainmail, shields","1d6",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Holy Symbol","description":"You carry a holy symbol (free gear slot). Hold it in a free hand for +2 AC vs undead. Touch undead with it (normal attack) to deal 1d6 damage and cause them to flee for 5 rounds (as if turned)."},
    {"name":"Turn Undead","description":"You know the Turn Undead spell (does not count toward your known spell limit)."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required) per the Monk Spells Known table."}]),
  ("Mystic","Mystic","Club, mace, staff","Leather armor, chainmail","1d4",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Meditation","description":"When at full HP, commune with your deity during a rest. Gain +1 to spellcasting checks until your next rest."},
    {"name":"Turn Undead","description":"You know the Turn Undead spell (does not count toward your known spell limit)."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required) per the Mystic Spells Known table."}]),
  ("Necromancer","Necromancer","Dagger, mace, staff","None","1d4",
   "wizard","int",
   spells_table([(3,0,0,0,0),(4,0,0,0,0),(4,1,0,0,0),(4,2,0,0,0),(4,2,1,0,0),
                 (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
   [{"name":"Command Undead","description":"CHA check vs DC 10 + undead level to subjugate undead for 3 rounds (as charmed)."},
    {"name":"Scroll Study","description":"Study a scroll for 1 day (INT DC 15) to learn it permanently. Consumed. Doesn't count toward spell limit."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Necromancer Spells Known table."}]),
  ("Noble","Noble","All weapons","Shields and any armor","1d6",
   None,None,None,
   [{"name":"Languages","description":"You know two additional languages beyond those granted by Intelligence."},
    {"name":"Leadership","description":"NPC allies and aligned creatures make morale checks with advantage. Designate one ally per round to gain +1 on attack rolls and +1 initiative."},
    {"name":"Nobility","description":"Mind-affecting spells and abilities (e.g. charm) are made against you at disadvantage."},
    {"name":"Wealth","description":"Roll double the normal number of dice to determine your starting wealth."}]),
  ("Oracle","Oracle","Club, dagger, mace, spear, staff","Leather armor, chainmail","1d4",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Possession","description":"Call upon an avatar of your deity to possess your form. You glow as a torch and gain +2 attack and +4 AC for 2d6 rounds. Recharges on rest."},
    {"name":"Turn Undead","description":"You know the Turn Undead spell (does not count toward your known spell limit)."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required) per the Oracle Spells Known table."}]),
  ("Pugilist","Pugilist","Club, dagger","Leather armor","1d8",
   None,None,None,
   [{"name":"Blooded","description":"If you deal 1+ melee damage, gain +2 AC and double movement for 3 rounds. Recharges on rest."},
    {"name":"Brawl","description":"+1 to attack with bare fists (1d4 damage). +2 AC when wearing clothes or leather armor."},
    {"name":"Dirty Tricks","description":"DEX check vs opponent's AC — success stuns the opponent for 2 rounds."}]),
  ("Ranger","Ranger (PC)","All weapons","Leather armor, chainmail","1d8",
   "priest","wis",
   spells_table([(0,0,0,0,0),(0,0,0,0,0),(1,0,0,0,0),(2,0,0,0,0),(2,1,0,0,0),
                 (2,2,0,0,0),(3,2,1,0,0),(3,2,2,0,0),(3,2,2,1,0),(3,3,2,2,0)]),
   [{"name":"Priest Spells","description":"You can cast priest spells. Starting at 3rd level, gain known spells per the Ranger Spells Known table. You can also gain spells via talent rolls."},
    {"name":"Snares","description":"Carry string (free gear slot). Spend 3 rounds setting a tripwire trap (1d4 damage, DEX DC 12 to avoid)."},
    {"name":"Tracking","description":"Automatically succeed on easy or normal tracking checks. Hard and extreme tracking checks made with advantage."}]),
  ("Rogue","Rogue","Club, crossbow, dagger, shortbow, shortsword, spear","Leather armor, chainmail","1d4",
   None,None,None,
   [{"name":"Backstab","description":"Target unaware of your presence takes an extra damage die. Add an extra die every two levels."},
    {"name":"Shadowed","description":"Advantage on stealth checks; +2 if motionless. Move silently at half speed."},
    {"name":"Taking Cover","description":"Impose disadvantage on ranged attacks/spellcasting checks targeting you with only 25% cover."},
    {"name":"Thievery","description":"Advantage on DEX checks to disguise, shadow, find/disable traps, pickpocket, or pick locks."}]),
  ("Savage","Savage","Club, dagger, greataxe, greatsword, javelin, mace, shortbow, spear, staff","Leather armor, shields","1d8",
   None,None,None,
   [{"name":"Brawl","description":"+1 to attack with bare fists (1d4 damage). +2 AC when wearing clothes or leather armor."},
    {"name":"Tracking","description":"Automatically succeed on easy or normal tracking checks. Hard and extreme with advantage."},
    {"name":"Wildling","description":"Advantage on all checks to find food or shelter in the wilderness."}]),
  ("Scholar","Scholar","Staff","None","1d4",
   "wizard","int",
   spells_table([(4,0,0,0,0),(5,0,0,0,0),(5,1,0,0,0),(5,2,0,0,0),(5,3,1,0,0),
                 (5,4,2,0,0),(5,4,2,1,0),(5,4,2,2,0),(5,5,3,2,1),(5,5,4,2,2)]),
   [{"name":"Leadership","description":"NPC allies and aligned creatures make morale checks with advantage. Designate one ally per round to gain +1 on attack rolls and +1 initiative."},
    {"name":"Scroll Study","description":"Study a scroll for 1 day (INT DC 15) to learn it permanently. Consumed. Doesn't count toward spell limit."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Scholar Spells Known table."}]),
  ("Scout","Scout","All weapons","Leather armor","1d6",
   None,None,None,
   [{"name":"Alertness","description":"+2 to initiative. Not surprised unless actively engaged in a task."},
    {"name":"Pathfinding","description":"Advantage on INT checks to determine location or find a path to a known objective."},
    {"name":"Shadowed","description":"Advantage on stealth; +2 if motionless. Move silently at half speed."},
    {"name":"Tracking","description":"Automatically succeed on easy or normal tracking checks. Hard and extreme with advantage."}]),
  ("Shaman","Shaman (PC)","Club, dagger, javelin, shortbow, spear, staff","Leather armor, shields","1d6",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Spirit Walk","description":"You can enter a trance to walk the spirit world. While in this trance your body is comatose. You can communicate with spirits and gather information. You can end the trance at will."},
    {"name":"Turn Undead","description":"You know the Turn Undead spell (does not count toward your known spell limit)."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required) per the Shaman Spells Known table."}]),
  ("Soldier","Soldier","All weapons","Shields and any armor","1d8",
   None,None,None,
   [{"name":"Formation Fighting","description":"If you have two allies within close distance, you gain advantage on all combat actions."},
    {"name":"Full Kit","description":"Wearing a backpack, you gain an extra 5 gear slots."},
    {"name":"Weapon Focus","description":"Choose a weapon type. +1 to attack and damage. +1 more every two levels (2nd, 4th, 6th, 8th, 10th)."}]),
  ("Sorcerer","Sorcerer (PC)","Dagger, staff","None","1d4",
   "wizard","int",
   spells_table([(3,0,0,0,0),(4,0,0,0,0),(4,1,0,0,0),(4,2,0,0,0),(4,2,1,0,0),
                 (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
   [{"name":"Quick Recovery","description":"If you fail a spellcasting check, you recover the ability to cast that spell again after 10 rounds."},
    {"name":"Scroll Study","description":"Study a scroll for 1 day (INT DC 15) to learn it permanently. Consumed. Doesn't count toward spell limit."},
    {"name":"Wizard Spells","description":"You can cast wizard spells you know per the Sorcerer Spells Known table."}]),
  ("Spy","Spy","Crossbow, dagger, longsword, mace, shortsword","Leather armor","1d6",
   None,None,None,
   [{"name":"Charming","description":"CHA check vs DC 12 (non-hostile) or DC 18 (hostile) to fast-talk a creature. Not a compulsion — they won't act against obvious self-interest."},
    {"name":"Earshot","description":"Hear effectively out to far distance if your immediate surroundings are quiet. Listen in on conversations without detection."},
    {"name":"Shadowed","description":"Advantage on stealth; +2 if motionless. Move silently at half speed."}]),
  ("Squire","Squire","All weapons","Shields and any armor","1d8",
   None,None,None,
   [{"name":"Full Kit","description":"Wearing a backpack, you gain an extra 5 gear slots."},
    {"name":"Shield Mastery","description":"+1 AC when using a shield. Shield bash (attack roll): 1d4 damage, push opponent to double close distance."},
    {"name":"Torchbearer","description":"Once lit, a torch takes no gear slot. Start a campfire with only two torches."},
    {"name":"Tutelage","description":"Roll two extra dice for starting wealth."}]),
  ("Thug","Thug","All weapons","Shields and any armor","1d8",
   None,None,None,
   [{"name":"Intimidation","description":"In addition to your normal attack, make an opposed CHA check against one opponent of equal or lesser level. On success they are terrified into inaction and forfeit their turn."},
    {"name":"Shadowed","description":"Advantage on stealth; +2 if motionless. Move silently at half speed."},
    {"name":"Unstoppable","description":"Opposed STR check (you roll with advantage) to charge through an opponent's location, knocking them prone. Standing up uses their move action."}]),
  ("Urchin","Urchin","Club, dagger, spear","Leather armor, shields","1d6",
   None,None,None,
   [{"name":"Dirty Tricks","description":"DEX check vs opponent's AC — success stuns them for 2 rounds."},
    {"name":"Innocuous","description":"During a surprise round with any cover within near distance, you can hide and become effectively invisible. Moving to another nearby cover keeps you hidden. Effect ends if you attack."},
    {"name":"Thievery","description":"Advantage on DEX checks to disguise, shadow, find/disable traps, pickpocket, or pick locks."}]),
  ("Valkyrie","Valkyrie","All weapons","Shields and any armor","1d8",
   "priest","wis",
   spells_table([(0,0,0,0,0),(0,0,0,0,0),(1,0,0,0,0),(2,0,0,0,0),(2,1,0,0,0),
                 (2,2,0,0,0),(3,2,1,0,0),(3,2,2,0,0),(3,2,2,1,0),(3,3,2,2,0)]),
   [{"name":"Favored","description":"If you use a luck token to deliver a killing blow to an enemy, you get it back immediately."},
    {"name":"Raven","description":"You attract a number of raven familiars equal to your level. They communicate telepathically and carry small messages. 1 HP, +1 attack (1d4), AC 10. Lose 1 HP when a raven dies."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required). Starting at 3rd level, gain known spells per the Valkyrie Spells Known table. Spells can also be gained via talent rolls."}]),
  ("Witch","Witch (PC)","Club, crossbow, dagger, shortsword, staff","Leather armor, chainmail","1d4",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Brew","description":"When at full HP with an empty flask, use resting downtime to brew over a campfire. Create a healing potion (restores 1d4 HP) or poison (1d8 damage if ingested, +1d2 applied to weapon). Brews lose potency after a day."},
    {"name":"Hex","description":"Designate a target in combat. They suffer disadvantage on all checks. Requires focus — you cannot take any other actions."},
    {"name":"Priest Spells","description":"You can cast priest spells (deity required) per the Witch Spells Known table."}]),
]

PC_TALENT_TABLES = {
  "Archer":   [{"roll":"2","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"3-6","effect":"+2 to DEX or WIS stat"},{"roll":"7-9","effect":"+1 to attack and damage with a longbow or shortbow"},{"roll":"10-11","effect":"Gain 3 hit points"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Assassin (PC)":[{"roll":"2","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Your venom deals an extra point of damage"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Beastmaster":[{"roll":"2","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"3-6","effect":"+2 to STR or CHA stat"},{"roll":"7-9","effect":"+1 to Animal Kinship checks"},{"roll":"10-11","effect":"Your snares deal an extra point of damage"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Berserker":[{"roll":"2","effect":"+1 to Subjugation checks"},{"roll":"3-6","effect":"+2 to CHA or CON stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Use Blooded one additional time before resting"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Brigand":[{"roll":"2","effect":"+1 to stealth checks (in addition to Shadowed)"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to Thievery checks"},{"roll":"10-11","effect":"+1 to Knockout checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Buccaneer":[{"roll":"2","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"3-6","effect":"+2 to DEX or WIS stat"},{"roll":"7-9","effect":"+1 to Stunt checks"},{"roll":"10-11","effect":"+1 to Thievery checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Burglar":[{"roll":"2","effect":"+1 to stealth checks (in addition to Shadowed)"},{"roll":"3-6","effect":"+2 to DEX or INT stat"},{"roll":"7-9","effect":"+1 to Thievery checks"},{"roll":"10-11","effect":"+1 to Palm checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Charlatan":[{"roll":"2","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"3-6","effect":"+2 to DEX or CHA stat"},{"roll":"7-9","effect":"+1 to Charming checks"},{"roll":"10-11","effect":"+1 to Thievery checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Conjurer":[{"roll":"2","effect":"+1 to Scroll Study checks"},{"roll":"3-6","effect":"+2 to INT or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Druid (PC)":[{"roll":"2","effect":"Shapeshift into a small creature (bird, rat, cat) for 3 rounds"},{"roll":"3-6","effect":"+2 to WIS or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Shapeshift into a large creature (+2 AC, 2d6 damage) for 3 rounds"}],
  "Elementalist":[{"roll":"2","effect":"+1 to Blast spellcasting checks or +1 damage to your blast"},{"roll":"3-6","effect":"+2 to INT or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Enchanter":[{"roll":"2","effect":"+1 to Mesmerizing Gaze checks"},{"roll":"3-6","effect":"+2 to INT or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Explorer":[{"roll":"2","effect":"+1 to initiative checks (in addition to Alertness)"},{"roll":"3-6","effect":"+2 to DEX or INT stat"},{"roll":"7-9","effect":"+1 to Pathfinding checks"},{"roll":"10-11","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Gladiator":[{"roll":"2","effect":"+1 to AC when using a shield"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to Dirty Tricks checks"},{"roll":"10-11","effect":"+1 to shield bash checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Mage (PC)":[{"roll":"2","effect":"Gain 2 hit points"},{"roll":"3-6","effect":"+2 to INT or WIS stat"},{"roll":"7-9","effect":"+2 to spellcasting checks for one of your Signature Spells"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Mariner":[{"roll":"2","effect":"Automatically succeed at climbing at one higher difficulty level"},{"roll":"3-6","effect":"+2 to DEX or INT stat"},{"roll":"7-9","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"10-11","effect":"Permanently gain 2 HP or +1 AC"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Monk (PC)":[{"roll":"2","effect":"+1 damage to undead touched by your holy symbol"},{"roll":"3-6","effect":"+2 to STR or WIS stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Mystic":[{"roll":"2","effect":"Increase your Meditation spellcasting bonus by 1"},{"roll":"3-6","effect":"+2 to WIS or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Necromancer":[{"roll":"2","effect":"+1 bonus on Command Undead checks"},{"roll":"3-6","effect":"+2 to INT or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Noble":[{"roll":"2","effect":"Inherit 200 gp multiplied by your level"},{"roll":"3-6","effect":"+2 to STR or CHA stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Permanently gain 2 HP or +1 AC"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Oracle":[{"roll":"2","effect":"Your Possession ability lasts an extra round"},{"roll":"3-6","effect":"+2 to STR or WIS stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Permanently gain +2 HP or +1 AC"}],
  "Pugilist":[{"roll":"2","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"3-6","effect":"+2 to DEX or WIS stat"},{"roll":"7-9","effect":"+1 to your Brawl attack and damage"},{"roll":"10-11","effect":"Gain 3 hit points"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Ranger (PC)":[{"roll":"2","effect":"Automatically succeed at tracking at one higher difficulty level"},{"roll":"3-6","effect":"+2 to DEX or WIS stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Gain a known priest spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Rogue":[{"roll":"2","effect":"+1 to Thievery checks"},{"roll":"3-6","effect":"+2 to DEX or CHA stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"+1 to Shadowed checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Savage":[{"roll":"2","effect":"Permanently gain 2 HP or +1 AC"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Scholar":[{"roll":"2","effect":"Your Leadership grants an extra +1 attack or +1 initiative"},{"roll":"3-6","effect":"+2 to INT or WIS stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain a known wizard spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Scout":[{"roll":"2","effect":"+1 to initiative checks (in addition to Alertness)"},{"roll":"3-6","effect":"+2 to DEX or INT stat"},{"roll":"7-9","effect":"+1 to Shadowed checks"},{"roll":"10-11","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Shaman (PC)":[{"roll":"2","effect":"+1 to Spirit Walk checks or extend duration"},{"roll":"3-6","effect":"+2 to WIS or CHA stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Soldier":[{"roll":"2","effect":"Gain Weapon Focus in an additional weapon"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"12","effect":"Permanently gain 2 HP or +1 AC"}],
  "Sorcerer (PC)":[{"roll":"2","effect":"Reduce your Quick Recovery wait time by 1 round"},{"roll":"3-6","effect":"+2 to INT or WIS stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain a known wizard spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Spy":[{"roll":"2","effect":"+1 to Charming checks"},{"roll":"3-6","effect":"+2 to DEX or CHA stat"},{"roll":"7-9","effect":"+1 to Shadowed checks"},{"roll":"10-11","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Squire":[{"roll":"2","effect":"Permanently gain 2 HP or +1 AC"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Carry one more torch (free gear slot)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Thug":[{"roll":"2","effect":"+1 to Unstoppable checks"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to Intimidation checks"},{"roll":"10-11","effect":"+1 to Shadowed checks"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Urchin":[{"roll":"2","effect":"Permanently gain 2 HP or +1 AC"},{"roll":"3-6","effect":"+2 to DEX or CHA stat"},{"roll":"7-9","effect":"+1 to Thievery checks"},{"roll":"10-11","effect":"Learn to wear another type of armor or use a new weapon"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Valkyrie":[{"roll":"2","effect":"Your ravens gain 1 HP, +1 to attacks, and +1 AC"},{"roll":"3-6","effect":"+2 to STR or DEX stat"},{"roll":"7-9","effect":"+1 to attack and damage with a weapon of your choice"},{"roll":"10-11","effect":"Gain a known priest spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
  "Witch (PC)":[{"roll":"2","effect":"Your potions restore +1 HP or inflict +1 damage"},{"roll":"3-6","effect":"+2 to WIS or CON stat"},{"roll":"7-9","effect":"Permanently cast a spell of your choice with advantage"},{"roll":"10-11","effect":"Gain an additional known spell (doesn't count toward limit)"},{"roll":"12","effect":"Pick a talent or improve a stat by 2 points"}],
}

existing_classes_now = {c['class'] for c in classes} | {c['class'] for c in new_classes}
for (orig_name, final_name, wpn, arm, hp, sc, sca, skt, feats) in PC_CLASSES:
    if final_name not in existing_classes_now:
        new_classes.append({
            "class": final_name, "source": "Player's Companion",
            "description": f"A {orig_name.lower()} adventurer from the Player's Companion.",
            "weapons": wpn, "armor": arm, "hit_points": f"{hp} per level",
            "spellcasting": sc, "spellcasting_ability": sca, "spells_known_table": skt,
            "features": feats
        })
        existing_classes_now.add(final_name)
        tbl = PC_TALENT_TABLES.get(final_name)
        if tbl:
            new_talents.append(talent_entry(final_name, "Player's Companion", "2d6", tbl))

# Add descriptions from actual PDF text
PC_DESCRIPTIONS = {
  "Archer": "Archers have trained from a young age to repeatedly make a heavy bow pull and hit targets at a distance. They tend to avoid close combat, where they are vulnerable.",
  "Assassin (PC)": "Trained to stalk and kill unsuspecting victims for pay. Practiced hunters of the most dangerous game who hit hard in combat and disappear without a trace.",
  "Beastmaster": "Adventurous wild animal tamers, adept at calming and training animals to fight alongside them. Formidable front-line combatants.",
  "Berserker": "Body-painted barbarians that seem to go wild in combat. They seek to conquer new lands and subjugate their enemies.",
  "Brigand": "Criminals that live in the dark and dangerous shadows beyond the reach of the law. They do what they must to survive.",
  "Buccaneer": "Pirates that have given up life at sea to pursue their own goals.",
  "Burglar": "The infamous thief in the night who robs the innocent. Masters of sneaking past monsters to claim their treasures.",
  "Charlatan": "Con men who prey upon the weak minded and use their trusting nature against them.",
  "Conjurer": "Magic users that have focused on summoning and creation magic.",
  "Druid (PC)": "Divine spellcasters with a powerful connection to the natural world, adept wilderness travelers who can shapeshift if favored.",
  "Elementalist": "Magic users adept at channeling elemental magic energy. Choose a form to master: Earth, Wind, Fire, Ice, Lightning, Plant, Water, or Shadow.",
  "Enchanter": "Socially powerful and attractive magic users who use magic to overwhelm the minds of others.",
  "Explorer": "Experienced scouts comfortable in the wilderness, often paid to lead parties through rough or unknown terrain.",
  "Gladiator": "Warriors that fight for fame and fortune in the arena, beloved by fans and practiced at doing whatever it takes to win.",
  "Mage (PC)": "Powerful wizards that focus on mastering a small set of favored spells.",
  "Mariner": "Practiced seafarers trained in all aspects of sailing, comfortable high in the rigging and adept at navigation.",
  "Monk (PC)": "Devoted followers of a deity who have given up their normal duties to travel the world and spread the gospel.",
  "Mystic": "Divine spellcasters that can enter a meditative trance to speak directly to their deity, claiming this reveals hidden truths.",
  "Necromancer": "Wizards that have specialized in mastery of the undead, generally seen as pariahs but whose unique abilities prove useful.",
  "Noble": "Minor landed gentry, typically third-born or worse with little opportunity to inherit, setting off to make their fortune as adventurers.",
  "Oracle": "Divine spellcasters with a deep spiritual bond with the avatars of their deity, able to give up partial control to gain extraordinary bonuses.",
  "Pugilist": "Prize fighters that travel from town to town looking to win a purse in a pit fight or earn coins as bar brawlers.",
  "Ranger (PC)": "Divine spellcasters that have learned to survive in the woods and fight effectively.",
  "Rogue": "Classic thieves that make their way in the world through violence.",
  "Savage": "Barbarian tribesfolk that have left their homeland in search of fame and fortune, hoping to one day return and elevate their people.",
  "Scholar": "Powerful spellcasters that develop a vast flexible repertoire of spells through focus and hard study.",
  "Scout": "Military-trained experts at finding the enemy.",
  "Shaman (PC)": "Divine spellcasters with a bond with the spirit world, drawing upon its energy.",
  "Soldier": "Trained military veterans that have left the service, seeking work as sellswords or fame and fortune.",
  "Sorcerer (PC)": "Magic users adept at recovering their spellcasting ability without taking time to rest.",
  "Spy": "Secretive agents that gather information clandestinely.",
  "Squire": "Young warriors pledged to the service of a noble, given combat training and older but valuable equipment.",
  "Thug": "Street criminals that have learned to get what they want through threats or violence.",
  "Urchin": "Street children that have grown into criminals due to desperation.",
  "Valkyrie": "Divine spellcasters blessed by the gods of war, traditionally female, who fight with divine fervor.",
  "Witch (PC)": "Divine spellcasters that have learned to draw out and channel the dark energies of the fey world.",
}
for c in new_classes:
    if c['class'] in PC_DESCRIPTIONS and c.get('description','').endswith("Player's Companion."):
        c['description'] = PC_DESCRIPTIONS[c['class']]

# ── Player's Expansion 1 ─────────────────────────────────────────────
PE1_CLASSES = [
  ("Barbarian","Barbarian","All melee weapons","Leather armor, shields","1d10",None,None,None,
   [{"name":"Durable","description":"You can use Dexterity or Constitution when calculating your Armor Class."},
    {"name":"Danger Sense","description":"You have advantage on Wisdom checks."},
    {"name":"Rage","description":"While raging: +1 to damage with melee weapons; immune to fear effects; advantage on STR checks to lift, jump, shove, and grapple."}]),
  ("Bard (PE1)","Bard (PE1)","Club, crossbow, dagger, longsword, mace, shortbow, shortsword, spear, staff","Leather armor","1d6",None,None,None,
   [{"name":"Languages","description":"You know additional common languages equal to your CHA modifier and one rare language."},
    {"name":"Bardic Expertise","description":"Trained in speaking, art, dancing, drama, music, and negotiation. Advantage on related CHA checks."},
    {"name":"Magical Expert","description":"Advantage when activating spell scrolls and wands using CHA as your spellcasting statistic."},
    {"name":"Mojo","description":"DC 12 CHA check to use as an action: Bardic Inspiration (one ally gains advantage on one d20 roll); Sonic Blast (enemies in near range take 1 HP damage); Healer (restore 1 HP to creature in close range); Cure (remove disease or poison from one ally in close range). Fail = can't use again until rest."},
    {"name":"Knowledgeable","description":"Expert in one academic study: Current Affairs, Folklore, History, Linguistics, Music, Magic, Nature, Religion, Science, Monsters, or Animals. Advantage on related INT checks."}]),
  ("Commander","Commander","All weapons except greataxe, greatsword, and longbow","All armor and shields","1d8",None,None,None,
   [{"name":"Commander Leader","description":"When you make a melee attack, grant one ally you can see advantage on an attack roll within near range for one round."},
    {"name":"Marshal Presence","description":"You can use CHA or STR checks to persuade, inspire, negotiate, and intimidate others."},
    {"name":"Battle Cry","description":"Enemies within near range have disadvantage on Morale checks."}]),
  ("Druid (PE1)","Druid (PE1)","Club, dagger, shortbow, spear, staff","Leather armor, wooden shields","1d6",None,None,None,
   [{"name":"Languages","description":"You can speak telepathically with animals and plants."},
    {"name":"Animal Companion","description":"Select a magical animal spirit (ape, badger, bat, bear, bird, boar, cat, crocodile, fish, frog, rabbit, insect, octopus, rat, snake, spider, or wolf). It cannot attack or die unless you die. Use it to scout, track, stabilize dying creatures, or find food."},
    {"name":"Brewing","description":"Attempt to make level + 2 potions (max). Spend 10 min + WIS check (DC 10 + potion tier). Fail = can't make that potion until rest. Potions expire at next sunrise. Potions only affect the drinker."}]),
  ("Monk (PE1)","Monk (PE1)","All weapons except greataxe and greatsword","None","1d10",None,None,None,
   [{"name":"Unarmoured","description":"Use DEX, CON, or WIS when calculating your AC."},
    {"name":"Martial Arts","description":"Make unarmed melee strikes (hands, feet, elbows, knees, head). Attack with STR or DEX modifier. Unarmed strikes deal 1d6 damage."},
    {"name":"Martial Arts Style","description":"Select one mastered fighting style: Tiger Claw (+1 damage); Crane (knock prone); Snake (blind 1 round); Praying Mantis (grapple); Dragon (+1 to attack); Monkey (enemies have disadvantage for 1 round); Drunken Master (reduce damage taken by 1)."}]),
  ("Paladin","Paladin","All weapons","All armor and shields","1d6",None,None,None,
   [{"name":"Smite","description":"You have advantage on melee weapon damage rolls against enemies."},
    {"name":"Healing Touch","description":"Once per day, restore 1 HP to a creature within close range."},
    {"name":"Divine Aura","description":"All friendly healing spells and effects restore 1 extra HP within near range. Use an action to remove one disease or poison effect within near range."},
    {"name":"Oath","description":"Choose a deity matching your alignment. You have a holy symbol (no gear slots). Lawful: sense chaotic creatures within near range. Neutral: sense unnatural creatures. Chaotic: sense lawful creatures."}]),
  ("Ranger (PE1)","Ranger (PE1)","All weapons except greataxe and greatsword","Leather armor, chainmail, shields","1d8",None,None,None,
   [{"name":"Wilderness Explorer","description":"Trained in two skills of your choice (advantage on checks): foraging, hunting, navigation, scouting, traps, wilderness survival, stealth, plants, or beasts. Gain an extra skill at each even level."},
    {"name":"Herbal Potions","description":"Attempt to make level potions per day. DC checks: 11 Antidote (end poison); 12 Vaccine (cure disease); 13 Heroism (advantage on attacks for one combat); 14 Elixir (un-petrify creature); 15 Healing Balm (restore 1 HP or stat). Unused potions expire after one day."}]),
  ("Shaman (PE1)","Shaman (PE1)","Club, dagger, longbow, shortbow, spear, staff","Leather armor, wooden shields","1d6",
   "priest","wis",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Languages","description":"You can speak telepathically with spirits, ghosts, and animals."},
    {"name":"Shapechange","description":"Transform your body, clothes, armor, and equipment into an animal. Stats stay the same; you can cast spells in animal form. At 0 HP, you revert to ancestry form. Animals: ape, badger, bat, bear, bird, boar, cat, crocodile, fish, frog, insect, octopus, rat, snake, spider, wolf."},
    {"name":"Spellcasting","description":"You can cast priest spells you know in animal or ancestry form. You know two tier 1 spells. Each level, choose new spells per the Shaman Spells Known table."}]),
  ("Sorcerer (PE1)","Sorcerer (PE1)","Club, dagger, staff","None","1d4",
   "wizard","cha",
   spells_table([(3,0,0,0,0),(4,0,0,0,0),(4,1,0,0,0),(4,2,0,0,0),(4,2,1,0,0),
                 (4,3,2,0,0),(4,3,2,1,0),(4,4,2,2,0),(4,4,3,2,1),(4,4,4,2,2)]),
   [{"name":"Wild Magic","description":"When you roll a 1 or 2 on a spellcasting check, the spell fails and you roll on the wizard mishap table."},
    {"name":"Metamagic","description":"When you successfully cast a spell, choose one: Careful (exclude allies from effect); Distant (increase range one increment); Extend (increase duration by one round, unless instant)."},
    {"name":"Spellcasting","description":"You can cast wizard spells you know. You know three tier 1 spells. Use CHA modifier for spellcasting checks per the Sorcerer Spells Known table."}]),
  ("Warlock (PE1)","Warlock (PE1)","Club, crossbow, dagger, mace, longsword, shortsword, spear, staff","Leather armor, shields","1d6",None,None,None,
   [{"name":"Languages","description":"You know one extra language."},
    {"name":"Patron Boon","description":"Choose a patron or create one with GM approval. Gain a new Patron Boon at each even character level. Boons: body transforms into a level 2 monster; read all written languages; speak with spirits/undead; transform into small animal for 1 hour; read surface thoughts within near; extra language; advantage on CHA checks; know a 1st tier wizard spell; detect magic within near; swim at near speed and breathe water; transform into a Celestial/Diabolic/Fey/Primordial."},
    {"name":"Eldritch Blast","description":"Make a spellcasting check (CHA, DC 11) to fire a beam of energy (1d4 damage, far range). On failure, no rest required to retry."}]),
]

PE1_TALENT_TABLES = {
  "Barbarian":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee attacks and damage"},{"roll":"7-9","effect":"+1 to AC while wearing no armor"},{"roll":"10-11","effect":"You can use a STR check to intimidate a creature"},{"roll":"12","effect":"Choose a talent"}],
  "Bard (PE1)":[{"roll":"2","effect":"+1 to Sonic Blast damage"},{"roll":"3-6","effect":"+1 to melee or ranged attacks"},{"roll":"7-9","effect":"Gain one additional academic study from Knowledgeable"},{"roll":"10-11","effect":"+2 points to distribute to stats"},{"roll":"12","effect":"Choose a talent"}],
  "Commander":[{"roll":"2","effect":"+2 points to distribute to stats (reroll 10-11 if repeated)"},{"roll":"3-6","effect":"+1 to melee or ranged attacks"},{"roll":"7-9","effect":"Choose one armor type — gain +1 AC from that armor"},{"roll":"10-11","effect":"Gain advantage on stat checks with Marshal Presence"},{"roll":"12","effect":"Choose a talent"}],
  "Druid (PE1)":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee or ranged attacks"},{"roll":"7-9","effect":"+1 to druid potion brewing checks"},{"roll":"10-11","effect":"Gain advantage on brewing one potion you have access to"},{"roll":"12","effect":"Choose a talent"}],
  "Monk (PE1)":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to unarmed strike attack rolls"},{"roll":"7-9","effect":"Select an extra Martial Arts style"},{"roll":"10-11","effect":"Advantage on STR, DEX, CON, or WIS checks"},{"roll":"12","effect":"Choose a talent"}],
  "Paladin":[{"roll":"2","effect":"Learn a level 1 Priest Spell, use CHA or WIS to cast it"},{"roll":"3-6","effect":"+1 to melee damage"},{"roll":"7-9","effect":"+1 to melee attack rolls"},{"roll":"10-11","effect":"+2 points to distribute to stats"},{"roll":"12","effect":"Choose a talent"}],
  "Ranger (PE1)":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee or ranged attacks"},{"roll":"7-9","effect":"+1 to melee or ranged damage rolls"},{"roll":"10-11","effect":"Gain advantage on one Herbal Potion check you choose"},{"roll":"12","effect":"Choose a talent"}],
  "Shaman (PE1)":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee or ranged attacks"},{"roll":"7-9","effect":"+1 to shaman spellcasting checks"},{"roll":"10-11","effect":"Gain advantage on casting one spell you know"},{"roll":"12","effect":"Choose a talent"}],
  "Sorcerer (PE1)":[{"roll":"2","effect":"Learn one additional wizard spell of tier 1"},{"roll":"3-6","effect":"+1 to sorcerer spellcasting checks"},{"roll":"7-9","effect":"Gain advantage on casting one spell you know"},{"roll":"10-11","effect":"+2 points to distribute to stats"},{"roll":"12","effect":"Choose a talent"}],
  "Warlock (PE1)":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to Eldritch Blast spellcasting checks"},{"roll":"7-9","effect":"+1 to melee or ranged attacks"},{"roll":"10-11","effect":"Advantage on one stat check of your choice"},{"roll":"12","effect":"Choose a talent"}],
}

PE1_TITLES = {
  "Barbarian": [("Nomad","Savage","Brute"),("Trekker","Raider","Ironhide"),("Vanquisher","Plunderer","Berserker"),("Conqueror","Marauder","Hellion"),("Chieftain","Battlelord","Destroyer")],
  "Bard (PE1)": [("Poet","Hustler","Rhymer"),("Lyrist","Rhymester","Sonneteer"),("Minstrel","Warbler","Troubadour"),("Muse","Chanter","Jongleur"),("Balladeer","Diva","Skald")],
  "Commander": [("Lieutenant","Militant","Private"),("Captain","Leader","Corporal"),("Major","Boss","Sergeant"),("Colonel","Baron","Marshal"),("General","Warlord","Specialist")],
  "Druid (PE1)": [("Herbalist","Drugger","Hippy"),("Soothsayer","Pusher","Mystic"),("Spiritualist","Peddler","Healer"),("Botanist","Chemist","Pharmacist"),("Apothecary","Alchemist","Seer")],
  "Monk (PE1)": [("Initiate","Slugger","Bruiser"),("Disciple","Scrapper","Fighter"),("Boxer","Combatant","Duelist"),("Apostle","Ninja","Mercenary"),("Master","Shinobi","Martial Artist")],
  "Paladin": [("Partisan","Blaggard","Knave"),("Devotee","Heretic","Votary"),("Protector","Enforcer","Haruspex"),("Hero","Sycophant","Inquisitor"),("Saviour","Myrmidon","Paragon")],
  "Ranger (PE1)": [("Rover","Drifter","Wanderer"),("Scout","Runner","Tracker"),("Guide","Rebel","Wayfinder"),("Strider","Outsider","Guardian"),("Pathfinder","Renegade","Lord")],
  "Shaman (PE1)": [("Spiritualist","Incantor","Medium"),("Healer","Conjurer","Diviner"),("Enchanter","Occultist","Doctor"),("Seer","Voodooist","Exorcist"),("Oracle","Jinx","Mystic")],
  "Sorcerer (PE1)": [("Magician","Charmer","Spellwright"),("Illusionist","Enchanter","Invoker"),("Mage","Spellbinder","Magus"),("Thaumaturgist","Shadowmancer","Elementalist"),("Eldermancer","Diabolist","Dreamweaver")],
  "Warlock (PE1)": [("Medium","Profaner","Accursed"),("Pactbinder","Hexer","Nightshroud"),("Spiritcaller","Despoiler","Voidspeaker"),("Riftlock","Doomseer","Veilwalker"),("Nethermancer","Grimspeaker","Voidwalker")],
}

PE1_DESCRIPTIONS = {
  "Barbarian": "Fierce warriors driven by primal rage, exceptional resilience, and a deep connection to the untamed wilderness.",
  "Bard (PE1)": "Nomads who inspire through speech, song, music, and current affairs. Experts who share knowledge through art or literature.",
  "Commander": "Inspiring leaders who are experts in tactics, close combat, and warfare.",
  "Druid (PE1)": "Mystics attuned to nature and animal spirits who concoct magical potions from plants.",
  "Monk (PE1)": "Disciplined combatants who channel physical and spiritual mastery into precise strikes and exceptional agility.",
  "Paladin": "Holy warriors bound by an oath to uphold justice, protect the innocent, and wield martial and divine power in service of their faith.",
  "Ranger (PE1)": "Specialized wilderness scouts trained in the techniques of guerrilla warfare.",
  "Shaman (PE1)": "Spiritual practitioners with a deep understanding of nature, body transformation, medicinal herbs, and healing practices.",
  "Sorcerer (PE1)": "Infernos of raw magic coursing through their blood, threatening to be wildly unpredictable.",
  "Warlock (PE1)": "Spellcasters who gain magical power through a pact with a mysterious and often otherworldly patron.",
}

for (orig_name, final_name, wpn, arm, hp, sc, sca, skt, feats) in PE1_CLASSES:
    if final_name not in existing_classes_now:
        new_classes.append({
            "class": final_name, "source": "Player's Expansion 1",
            "description": PE1_DESCRIPTIONS.get(final_name, f"A {orig_name.lower()} from Player's Expansion 1."),
            "weapons": wpn, "armor": arm, "hit_points": f"{hp} per level",
            "spellcasting": sc, "spellcasting_ability": sca, "spells_known_table": skt,
            "features": feats
        })
        existing_classes_now.add(final_name)
        tbl = PE1_TALENT_TABLES.get(final_name)
        if tbl:
            new_talents.append(talent_entry(final_name, "Player's Expansion 1", "2d6", tbl))
        title_rows = PE1_TITLES.get(final_name)
        if title_rows:
            new_titles.append(title_entry(final_name, "Player's Expansion 1", title_rows))

# ── Player's Expansion 2 ─────────────────────────────────────────────
PE2_CLASSES = [
  ("Cursedblade","A cursing spellcaster who gains mystical energy from a powerful being and wields it through a weapon.",
   "Bastard sword, dagger, greataxe, greatsword, longsword, shortsword, spear","Leather armor, chainmail, shields","1d6",None,None,None,
   [{"name":"Magic Weapon","description":"Use your action to imbue a weapon (CHA spellcasting check, DC 11) with +1 to attack and damage for 3 rounds. Failed check doesn't require rest to retry."},
    {"name":"Eldritch Blast","description":"Fire a beam of energy (CHA spellcasting check, DC 11, 1d4 damage, far range). Failed check doesn't require rest to retry."},
    {"name":"Patron Boon","description":"Choose a patron or create one. Gain a new Patron Boon at each even level."}]),
  ("Elemental Warrior","Martial artists who have mastered controlling their internal energy to release it as devastating elemental blows and blasts.",
   "Crossbow, dagger, longsword, mace, shortsword, shortbow, staff","None","1d10",None,None,None,
   [{"name":"Elemental Expert","description":"Advantage on knowledge checks related to fire, electricity, water, earth, air, and spirits."},
    {"name":"Unarmoured","description":"Use DEX or CON when calculating your AC."},
    {"name":"Elemental Blow","description":"Make unarmed melee strikes (1d6 damage). Declare elemental damage type (normal, fire, electric, cold, or acid) when attacking."},
    {"name":"Elemental Blast","description":"CHA spellcasting check (DC 11) to fire elemental blast (1d4 damage at levels 1-5, 1d6 at levels 6-10, far range)."}]),
  ("Monster Slayer","Seekers of vampires, dragons, fiends, fey, and evil monsters of the dark.",
   "Bastard sword, club, crossbow, dagger, longbow, longsword, mace, shortbow, shortsword, spear, staff","Leather armor, chainmail, shields","1d6",
   "priest","wis",None,
   [{"name":"Monster Expert","description":"You know if and what immunities a chaotic-aligned monster within near range has. Advantage on checks related to monster knowledge."},
    {"name":"Stalker","description":"Expert in detecting monsters and stealth. Advantage on checks related to sensing creatures, sneaking, and hiding."},
    {"name":"Spellcasting","description":"Cast known Monster Slayer spells using WIS. Spells by level: 1-10 Protection from Evil (DC 11); 3-10 Zone of Truth (DC 12); 5-10 Magic Circle (DC 13); 7-10 Flame Strike (DC 14); 9-10 Hold Monster (DC 15)."}]),
  ("Mystical Archer","Expert warriors in channeling magic into arrows fired from a bow, skilled in mystical knowledge and identification.",
   "Bows, dagger, shortsword, longsword","Leather armor, chainmail","1d4",None,None,None,
   [{"name":"Detecting Magic","description":"You can cast Detect Magic (DC 11) using INT, WIS, or CHA."},
    {"name":"Mystical Knowledge","description":"Advantage on checks related to magic knowledge."},
    {"name":"Magical Shot","description":"Once per round, imbue an arrow with one of: Sharp Arrow (+1 damage); Accurate Arrow (+1 to hit); Seeker Arrow (no disadvantage for cover); Elemental Arrow (change damage type); Returning Arrow (returns after shot); Paralysing Arrow (target paralyzed 1 round)."}]),
  ("Psychic Infiltrator","Spies who strike the psyche, infiltrating the mind and body with psionic power.",
   "Crossbow, dagger, longbow, shortbow, shortsword","Leather armor","1d4",
   "priest","wis",None,
   [{"name":"Psychic Blade","description":"Action: DC 12 CON or WIS check to create an invisible psychic blade for 1 minute (+1 to attack and damage). Fail requires rest to regain blade."},
    {"name":"Shadow Veil","description":"Advantage on checks related to hiding and sneaking."},
    {"name":"Spellcasting","description":"Cast known Psychic Infiltrator spells using CON or WIS. Spells: 1-10 Charm Person (DC 11); 3-10 Detect Thoughts (DC 12); 5-10 Alter Self (DC 12); 7-10 Arcane Eye (DC 14); 9-10 Teleport (DC 15)."}]),
  ("Samurai","Military soldiers trained in swordsmanship, archery, and other martial arts, with a special code of conduct.",
   "All swords, dagger, longbow, shortbow, spear, staff, warhammer","All armor and shields","1d8",None,None,None,
   [{"name":"Bushido Code","description":"Immune to fear effects."},
    {"name":"Aesthetic","description":"Advantage on checks related to literature and art. Can write official documents with advanced calligraphy."},
    {"name":"Samurai Style","description":"Select one mastered style at level 1, a new one at every even level: Kenjutsu (+1 attack/damage with swords, +half level); Jujutsu (grapple/throw on unarmed strike); Sojutsu (+1 attack/damage with spear, knock prone); Kyujutsu (+1 attack/damage with bow, ignore cover penalty); Aikiken (+1 AC while wielding sword to parry); Bojutsu (+1 attack/damage with staff, push/trip); Iaijutsu (+1 initiative)."}]),
  ("Shadow Stalker","Experienced hunters who use the darkness, detecting and hunting creatures.",
   "Bastard sword, crossbow, dagger, longbow, longsword, mace, shortbow, shortsword, spear","Leather armor, shields","1d6",
   "wizard","wis",None,
   [{"name":"Ambusher","description":"Advantage on Initiative rolls. Expert in sneaking and hiding — advantage on related checks."},
    {"name":"Iron Mind","description":"Advantage on checks that affect your mind."},
    {"name":"Spellcasting","description":"Cast known Shadow Stalker spells using WIS. Spells: 1-10 Light (DC 11); 3-10 Invisibility (DC 12); 5-10 Alter Self (DC 12); 7-10 Arcane Eye (DC 14); 9-10 Wrath (DC 14)."}]),
  ("Spellsword","Mages that incorporate swordplay and magical dance with music.",
   "Dagger, longsword, shortsword","Leather armor","1d4",
   "wizard","int",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Bless","description":"You know the bless spell. It doesn't count toward your known spells."},
    {"name":"Performance","description":"Advantage on checks related to performance, dancing, and singing."},
    {"name":"Blade Magic","description":"You can cast wizard spells you know through the blade you hold. You know two tier 1 spells per the Spellsword Spells Known table."}]),
  ("Swashbuckler","Lightly armoured acrobatic fencers who are experts in the blade, acrobatics, and charm.",
   "Club, crossbow, dagger, longsword, mace, rapier, shortbow, shortsword, staff","Leather armor, shields","1d6",None,None,None,
   [{"name":"Dual-Wielder","description":"Make two attacks on your turn while holding a rapier and dagger, or two daggers."},
    {"name":"Rapier","description":"The rapier is a finesse melee weapon (1d6 damage, cost 8 gp)."},
    {"name":"Gentile","description":"Expert in acrobatics, stealth, guile, and romance. Advantage on all DEX and CHA related checks."}]),
  ("War Mage","Magic-users trained for war on the battlefield who wear armor.",
   "Crossbow, dagger, shortsword, staff","Special (Arcane Armor)","1d4",
   "wizard","int",
   spells_table([(2,0,0,0,0),(3,0,0,0,0),(3,1,0,0,0),(3,2,0,0,0),(3,2,1,0,0),
                 (3,2,2,0,0),(3,3,2,1,0),(3,3,2,2,0),(3,3,2,2,1),(3,3,3,2,2)]),
   [{"name":"Arcane Armor","description":"Transform leather armor into magical armor granting AC 11 + DEX modifier (only you can wear it). You can cast spells while wearing this armor."},
    {"name":"Detect Magic","description":"You know the detect magic spell. Doesn't count toward your known spells."},
    {"name":"Spellcasting","description":"You can cast wizard spells you know per the War Mage Spells Known table. You know two tier 1 spells."}]),
  ("War Master","Masters of weapons who can utilize multiple combat techniques during battle.",
   "All weapons","All armor and shields","1d8",None,None,None,
   [{"name":"Blacksmith","description":"You can make and repair armor, weapons, and metal items. You have access to a forge, smithing tools, and materials."},
    {"name":"Art of War","description":"Advantage on checks related to war, historic battles, military organizations, and combat tactics."},
    {"name":"Maneuvers","description":"Declare one technique per attack: Disarm (take or knock away target's weapon); Parry (+1 AC for one round); Evade (enemy has disadvantage on attacks for one round); Precision (+1 to hit for one round); Power (+1 damage for one round); Trip (knock target prone); Push (push target to near range with shield)."}]),
]

PE2_TALENT_TABLES = {
  "Cursedblade":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to spellcasting checks"},{"roll":"7-9","effect":"+1 to melee attacks with weapons"},{"roll":"10-11","effect":"+1 to melee damage rolls with weapons"},{"roll":"12","effect":"Choose a talent"}],
  "Elemental Warrior":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to unarmed strike attack rolls"},{"roll":"7-9","effect":"+1 to unarmed strike damage rolls"},{"roll":"10-11","effect":"Gain advantage on spellcasting checks (reroll if duplicated)"},{"roll":"12","effect":"Choose a talent"}],
  "Monster Slayer":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to spellcasting checks"},{"roll":"7-9","effect":"+1 to melee and ranged attack rolls"},{"roll":"10-11","effect":"+1 to melee and ranged damage rolls"},{"roll":"12","effect":"Choose a talent"}],
  "Mystical Archer":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to ranged attack rolls"},{"roll":"7-9","effect":"+1 to ranged damage rolls"},{"roll":"10-11","effect":"+1 to initiative rolls"},{"roll":"12","effect":"Choose a talent"}],
  "Psychic Infiltrator":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to spellcasting checks"},{"roll":"7-9","effect":"+1 to melee and ranged attack rolls"},{"roll":"10-11","effect":"+1 to melee and ranged damage rolls"},{"roll":"12","effect":"Choose a talent"}],
  "Samurai":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee attack rolls"},{"roll":"7-9","effect":"+1 to ranged attack rolls"},{"roll":"10-11","effect":"+1 to melee damage rolls"},{"roll":"12","effect":"Choose a talent"}],
  "Shadow Stalker":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to spellcasting checks"},{"roll":"7-9","effect":"+1 to melee and ranged attack rolls"},{"roll":"10-11","effect":"+1 to melee and ranged damage rolls"},{"roll":"12","effect":"Choose a talent"}],
  "Spellsword":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee or ranged attack rolls"},{"roll":"7-9","effect":"+1 to Spellsword spellcasting checks"},{"roll":"10-11","effect":"Gain advantage on casting one spell you know"},{"roll":"12","effect":"Choose a talent"}],
  "Swashbuckler":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee and ranged attack rolls"},{"roll":"7-9","effect":"+1 to melee and ranged damage rolls"},{"roll":"10-11","effect":"+1 to AC (reroll if duplicated)"},{"roll":"12","effect":"Choose a talent"}],
  "War Mage":[{"roll":"2","effect":"+2 points to distribute to stats"},{"roll":"3-6","effect":"+1 to melee or ranged attack rolls"},{"roll":"7-9","effect":"+1 to War Mage spellcasting checks"},{"roll":"10-11","effect":"Gain advantage on casting one spell you know"},{"roll":"12","effect":"Choose a talent"}],
  "War Master":[{"roll":"2","effect":"+1 AC from the armor you wear"},{"roll":"3-6","effect":"+1 to melee and ranged attack rolls"},{"roll":"7-9","effect":"+1 to melee and ranged damage rolls"},{"roll":"10-11","effect":"+2 points to distribute to stats"},{"roll":"12","effect":"Choose a talent"}],
}

PE2_TITLES = {
  "Cursedblade": [("Angel","Baron/Baroness","Fallen"),("Archangel","Count/Countess","Messenger"),("Throne","Duke/Duchess","Watcher"),("Cherubim","Prince/Princess","Nephilim"),("Seraphim","King/Queen","Archon")],
  "Elemental Warrior": [("Gaia","Tellus","Terran"),("Aquan","Tainted","Balancer"),("Aura","Tempest","Drafter"),("Smelter","Inferno","Blazer"),("Celestial","Primordial","Cosmic")],
  "Monster Slayer": [("Seeker","Butcher","Tracker"),("Tracer","Slaughterer","Stalker"),("Hunter/Huntress","Executioner","Sleuth"),("Nimrod","Terminator","Skinner"),("Slayer","Predator","Orion")],
  "Mystical Archer": [("Toxotes","Archer","Ivar"),("Lucznik","Piercer","Bersagliere"),("Arqueiro","Sharpshooter","Kyudo"),("Bogenschutz","Sniper","Sheshou"),("Sagittarii","Deadeye","Iuchnik")],
  "Psychic Infiltrator": [("Spy","Prowler","Monitor"),("Agent","Deceiver","Investigator"),("Operative","Manipulator","Spook"),("Infiltrator","Subversive","Sleeper"),("Spymaster","Shadow","Neutralizer")],
  "Samurai": [("Ashigaru","Shatei","Ronin"),("Goshi","Kyodai","Ronin"),("Gokenin","Shateigashira","Ronin"),("Hatamoto","Wakagashira","Ronin"),("Daimyo","Oyabun","Ronin")],
  "Shadow Stalker": [("Stalker","Lurker","Shadow"),("Umbra","Prowler","Murker"),("Spook","Darkling","Skulker"),("Ghost","Shade","Mystery"),("Phantom","Grim","Wraith")],
  "Spellsword": [("Spellblade","Arcaneblade","Spellknife"),("Spellsword","Arcanesword","Mysticblade"),("Mageblade","Voodooblade","Songcutter"),("Songblade","Doomsword","Mysticsword"),("Mysticmaestro","Deathdancer","Songsword")],
  "Swashbuckler": [("Flamboyant","Daredevil","Scoundrel"),("Exhibitionist","Desperado","Vigilante"),("Picaroon","Raider","Freebooter"),("Buccaneer","Privateer","Duelist"),("Swashbuckler","Pirate","Corsair")],
  "War Mage": [("Spellweaver","Ritualist","Magician"),("Battlemage","Spellblaster","Spellcaster"),("Gish","Doomcaster","Spellbinder"),("Magewright","Warmancer","Tactician"),("Warcaster","Necromancer","Battleblaster")],
  "War Master": [("Combatmaster","Warmaster","Weaponmaster"),("Champion","Dominator","Legionnaire"),("Paragon","Despoiler","Vanquisher"),("Lionheart","Oppressor","Tactician"),("Commander","Tyrant","Overlord")],
}

for (cn, desc, wpn, arm, hp, sc, sca, skt, feats) in PE2_CLASSES:
    if cn not in existing_classes_now:
        new_classes.append({
            "class": cn, "source": "Player's Expansion 2",
            "description": desc, "weapons": wpn, "armor": arm, "hit_points": f"{hp} per level",
            "spellcasting": sc, "spellcasting_ability": sca, "spells_known_table": skt,
            "features": feats
        })
        existing_classes_now.add(cn)
        tbl = PE2_TALENT_TABLES.get(cn)
        if tbl:
            new_talents.append(talent_entry(cn, "Player's Expansion 2", "2d6", tbl))
        title_rows = PE2_TITLES.get(cn)
        if title_rows:
            new_titles.append(title_entry(cn, "Player's Expansion 2", title_rows))

# ── Write files ──────────────────────────────────────────────────────
classes.extend(new_classes)
talents.extend(new_talents)
titles.extend(new_titles)

with open(os.path.join(BASE,'classes.json'),'w',encoding='utf-8') as f:
    json.dump(classes, f, ensure_ascii=False, indent=2)
with open(os.path.join(BASE,'class_talents.json'),'w',encoding='utf-8') as f:
    json.dump(talents, f, ensure_ascii=False, indent=2)
with open(os.path.join(BASE,'class_titles.json'),'w',encoding='utf-8') as f:
    json.dump(titles, f, ensure_ascii=False, indent=2)

print(f"classes.json:       {len(classes)} entries ({len(new_classes)} added)")
print(f"class_talents.json: {len(talents)} entries ({len(new_talents)} added)")
print(f"class_titles.json:  {len(titles)} entries ({len(new_titles)} added)")
