"""Parse shadowdark_monsters.md into monsters.json"""
import re, json, sys

MD_PATH = r"C:\Users\Ghost L9\OneDrive\Shadowdark Campains Obsidian\Shadowdark Campains\spells,monsters,magic items\shadowdark_monsters.md"
OUT_PATH = r"C:\Users\Ghost L9\OneDrive\RPGs\Shadowdark RPG\character-sheet-app\static\data\monsters.json"

# Monster type families from the design decisions
FAMILY_MAP = {
    "Angels": "Celestial", "Demons": "Fiend", "Devils": "Fiend",
    "Apes": "Beast", "Bats": "Beast", "Bears": "Beast", "Centipedes": "Beast",
    "Dinosaurs": "Beast", "Rats": "Beast", "Sharks": "Beast", "Snakes": "Beast",
    "Spiders": "Beast", "Wolves": "Beast",
    "Dragons": "Dragon",
    "Drow": "Fey", "Viperians": "Fey",
    "Elementals": "Elemental",
    "Giants": "Giant",
    "Goblins": "Humanoid", "Kobolds": "Humanoid", "Orcs": "Humanoid",
    "Golems": "Construct",
    "Hags": "Fey", "Nagas": "Fey",
    "Outsiders": "Outsider",
    "Trolls": "Giant",
    "Vampires": "Undead",
}

AL_MAP = {"L": "Lawful", "N": "Neutral", "C": "Chaotic"}

with open(MD_PATH, "r", encoding="utf-8") as f:
    text = f.read()

monsters = []
current_family = None
current_family_desc = None

lines = text.split("\n")
i = 0
while i < len(lines):
    line = lines[i].strip()

    # Detect family heading (## Name)
    m = re.match(r'^## (.+)$', line)
    if m:
        name = m.group(1).strip()
        if name not in ("Monster Stat Block Key", "Table of Contents"):
            current_family = name
            current_family_desc = None
            # Look for italic family description on next non-empty lines
            j = i + 1
            while j < len(lines) and lines[j].strip() in ("", "---"):
                j += 1
            if j < len(lines) and lines[j].strip().startswith("*"):
                desc_lines = []
                while j < len(lines) and lines[j].strip():
                    desc_lines.append(lines[j].strip())
                    j += 1
                raw = " ".join(desc_lines)
                current_family_desc = re.sub(r'^\*|\*$', '', raw).strip()
        i += 1
        continue

    # Detect monster heading (### Name)
    m = re.match(r'^### (.+)$', line)
    if m:
        name = m.group(1).strip()
        # Collect description (next non-empty line before stat block)
        j = i + 1
        desc_lines = []
        while j < len(lines):
            l = lines[j].strip()
            if l == "" or l == "---":
                j += 1
                continue
            if l.startswith("**AC**"):
                break
            desc_lines.append(l)
            j += 1

        description = " ".join(desc_lines)

        # Parse stat block
        stat_line = ""
        if j < len(lines):
            stat_line = lines[j].strip()

        monster = {"name": name, "description": description, "family": current_family or ""}

        # Parse: **AC** 18 (+3 plate mail) · **HP** 76 · **ATK** 3 flaming greatsword +10 (2d12) · **MV** double near (fly) · **S** +5 **D** +2 **C** +4 **I** +4 **W** +5 **Ch** +5 · **AL** L · **LV** 16
        ac_m = re.search(r'\*\*AC\*\*\s*(\d+)(?:\s*\(([^)]+)\))?', stat_line)
        if ac_m:
            monster["ac"] = int(ac_m.group(1))
            if ac_m.group(2):
                monster["ac_note"] = ac_m.group(2)

        hp_m = re.search(r'\*\*HP\*\*\s*(\d+)', stat_line)
        if hp_m:
            monster["hp"] = int(hp_m.group(1))

        atk_m = re.search(r'\*\*ATK\*\*\s*(.+?)(?:\s*·\s*\*\*MV\*\*)', stat_line)
        if atk_m:
            monster["atk"] = atk_m.group(1).strip()

        mv_m = re.search(r'\*\*MV\*\*\s*(.+?)(?:\s*·\s*\*\*S\*\*)', stat_line)
        if mv_m:
            monster["mv"] = mv_m.group(1).strip()

        # Stats
        for stat, key in [("S", "str"), ("D", "dex"), ("C", "con"), ("I", "int"), ("W", "wis"), ("Ch", "cha")]:
            pat = rf'\*\*{stat}\*\*\s*([+\-−]\d+)'
            sm = re.search(pat, stat_line)
            if sm:
                monster[key] = sm.group(1).replace("−", "-")

        al_m = re.search(r'\*\*AL\*\*\s*([LNC])', stat_line)
        if al_m:
            monster["alignment"] = AL_MAP.get(al_m.group(1), al_m.group(1))

        lv_m = re.search(r'\*\*LV\*\*\s*(\d+)', stat_line)
        if lv_m:
            monster["level"] = int(lv_m.group(1))

        # Abilities (lines starting with - **Name.**)
        abilities = []
        k = j + 1
        while k < len(lines):
            l = lines[k].strip()
            if l == "---" or l.startswith("##"):
                break
            ab_m = re.match(r'^-\s*\*\*(.+?)\.\*\*\s*(.+)$', l)
            if ab_m:
                abilities.append({"name": ab_m.group(1), "description": ab_m.group(2)})
            elif l and abilities:
                # continuation line
                abilities[-1]["description"] += " " + l.lstrip("- ")
            k += 1

        if abilities:
            monster["abilities"] = abilities

        # Assign type from family
        monster["type"] = FAMILY_MAP.get(current_family, "Monstrosity")

        monsters.append(monster)
        i = k
        continue

    i += 1

# Sort by level then name
monsters.sort(key=lambda m: (m.get("level", 0), m.get("name", "")))

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(monsters, f, indent=2, ensure_ascii=False)

print(f"Parsed {len(monsters)} monsters")
# Print type distribution
from collections import Counter
types = Counter(m["type"] for m in monsters)
for t, c in types.most_common():
    print(f"  {t}: {c}")
