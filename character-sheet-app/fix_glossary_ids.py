"""
Fix misassigned details in glossary.json.
Move details from wrong IDs to correct IDs, and add missing content.
"""
import json

with open('static/data/glossary.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

by_id = {d['id']: d for d in data}

# Step 1: Extract all currently misplaced details
# Store them keyed by what content they actually are
saved = {}

# These entries have WRONG content - extract then remove
wrong_assignments = {
    38: 'light_sources',      # Crawling Rounds has Light Sources content
    40: 'distances',          # Vision has Distances content
    46: 'spellcasting_check', # Swimming has Spellcasting Check content
    60: 'rest',               # Critical Success (Spells) has Rest content
    63: 'check_when',         # Priest Penance has Check (when to roll) content
    64: 'dc_table',           # Scrolls has Difficulty Class content
    65: 'luck_token',         # Wands has Luck Token content
    68: 'advantage',          # Divine Penance 1-3 has Advantage content
    69: 'disadvantage',       # Divine Penance 4-5 has Disadvantage content
    70: 'adv_disadv_cancel',  # Nature's Penance has Adv/Disadv Cancel content
    26: 'damage',             # Critical Hit has Damage content
    27: 'critical_hit',       # Natural 1 (Fumble) has Critical Hit content
}

for eid, key in wrong_assignments.items():
    if eid in by_id and 'details' in by_id[eid]:
        saved[key] = by_id[eid]['details']
        del by_id[eid]['details']

# Step 2: Assign saved content to CORRECT IDs
correct_assignments = {
    41: 'light_sources',      # Light Sources
    43: 'distances',          # Distances
    54: 'spellcasting_check', # Spellcasting Check
    71: 'rest',               # Rest
    95: 'check_when',         # Check
    96: 'dc_table',           # Difficulty Class (DC)
    97: 'luck_token',         # Luck Token
    86: 'advantage',          # Advantage
    87: 'disadvantage',       # Disadvantage
    88: 'adv_disadv_cancel',  # Advantage/Disadvantage Cancel
    25: 'damage',             # Damage
    27: 'critical_hit',       # Critical Hit (ID 27 is Natural 1 Fumble - WAIT)
}

# Actually let me re-check: ID 26 = Critical Hit, ID 27 = Natural 1 (Fumble)
# ID 26 currently has Damage content -> should go to ID 25 (Damage)
# ID 27 currently has Critical Hit content -> should stay on ID 26 (Critical Hit)
# So: move 26's content to 25, move 27's content to 26, leave 27 empty

# Fix the critical hit / damage / fumble chain:
# saved['damage'] was on ID 26 (Critical Hit) -> belongs on ID 25 (Damage)
# saved['critical_hit'] was on ID 27 (Natural 1 Fumble) -> belongs on ID 26 (Critical Hit)
correct_assignments = {
    41: 'light_sources',
    43: 'distances',
    54: 'spellcasting_check',
    71: 'rest',
    95: 'check_when',
    96: 'dc_table',
    97: 'luck_token',
    86: 'advantage',
    87: 'disadvantage',
    88: 'adv_disadv_cancel',
    25: 'damage',
    26: 'critical_hit',
}

for eid, key in correct_assignments.items():
    if key in saved and eid in by_id:
        by_id[eid]['details'] = saved[key]

# Step 3: Now add NEW details for entries that should have had content
# but were skipped or need proper content

# Penance entries need proper rollable tables content
by_id[67]['details'] = """<p>When a priest critically fails a spellcasting check, their deity revokes that spell. The priest must complete <strong>ritualistic penance</strong> and a successful rest to regain it.</p>
<p>The GM determines the exact nature of the penance based on deity and alignment. Penance requires one of:</p>
<ul>
<li><strong>Holy Quest:</strong> A task aligned with the deity's values</li>
<li><strong>Ritualistic Atonement:</strong> Prayer, fasting, or ceremony</li>
<li><strong>Material Sacrifice:</strong> Donate or destroy valuables (see table below)</li>
</ul>
<table class="gloss-table">
<thead><tr><th>Spell Tier</th><th>Sacrifice Value</th></tr></thead>
<tbody>
<tr><td>Tier 1</td><td>5 gp</td></tr>
<tr><td>Tier 2</td><td>20 gp</td></tr>
<tr><td>Tier 3</td><td>40 gp</td></tr>
<tr><td>Tier 4</td><td>90 gp</td></tr>
<tr><td>Tier 5</td><td>150 gp</td></tr>
</tbody>
</table>
<p><strong>Warning:</strong> Inadequate or subversive penance (such as donating your sacrifice to a party member) only displeases your deity further and makes the spell loss <strong>permanent</strong>.</p>"""

by_id[68]['details'] = """<p>For Tier 1-3 priest spells lost through critical failure, penance options:</p>
<ul>
<li><strong>Sacrifice:</strong> Destroy or donate valuables worth the spell tier's value (Tier 1: 5 gp, Tier 2: 20 gp, Tier 3: 40 gp)</li>
<li><strong>Quest:</strong> Perform a task that furthers your deity's goals</li>
<li><strong>Atonement:</strong> Ritual prayer or fasting appropriate to your faith</li>
</ul>
<p>After completing penance, you must also <strong>successfully complete a rest</strong> to regain the spell.</p>
<table class="gloss-table">
<thead><tr><th>Spell Tier</th><th>Sacrifice Value</th></tr></thead>
<tbody>
<tr><td>Tier 1</td><td>5 gp</td></tr>
<tr><td>Tier 2</td><td>20 gp</td></tr>
<tr><td>Tier 3</td><td>40 gp</td></tr>
</tbody>
</table>"""

by_id[69]['details'] = """<p>For Tier 4-5 priest spells lost through critical failure, penance is more demanding:</p>
<ul>
<li><strong>Sacrifice:</strong> Destroy or donate valuables worth the spell tier's value (Tier 4: 90 gp, Tier 5: 150 gp)</li>
<li><strong>Major Quest:</strong> A significant holy mission befitting the power of the lost spell</li>
<li><strong>Grand Atonement:</strong> Extended ritual or pilgrimage</li>
</ul>
<p>After completing penance, you must also <strong>successfully complete a rest</strong> to regain the spell.</p>
<table class="gloss-table">
<thead><tr><th>Spell Tier</th><th>Sacrifice Value</th></tr></thead>
<tbody>
<tr><td>Tier 4</td><td>90 gp</td></tr>
<tr><td>Tier 5</td><td>150 gp</td></tr>
</tbody>
</table>
<p>The GM has final say on whether penance is adequate. Subversive penance makes the loss <strong>permanent</strong>.</p>"""

by_id[70]['details'] = """<p>Rangers, druids, and nature-aligned priests who critically fail may face <strong>Nature's Penance</strong> instead of standard divine penance.</p>
<p>Nature's penance typically involves:</p>
<ul>
<li><strong>Restore Balance:</strong> Heal a corrupted grove, free a trapped beast, or cleanse a tainted water source</li>
<li><strong>Nature's Sacrifice:</strong> Return valuables to the earth (bury, cast into water, burn on a natural pyre)</li>
<li><strong>Communion:</strong> Spend time in deep wilderness meditation</li>
</ul>
<p>The sacrifice values are the same as standard divine penance. After completing penance, a successful rest is required.</p>"""

# Crawling Rounds needs its OWN content (not the light sources)
by_id[38]['details'] = """<p>Characters are in <strong>crawling rounds</strong> while not in combat. They are exploring, talking, and engaging with the environment.</p>
<p>During crawling rounds, characters can take actions such as:</p>
<ul>
<li>Prying a gem from a statue</li>
<li>Sneaking up on a slumbering manticore</li>
<li>Tapping on a suspicious wall for hidden doors</li>
<li>Scanning a room for signs of hidden enemies</li>
<li>Giving a rousing speech to fearful townsfolk</li>
</ul>
<p>The GM can allow players to <strong>regroup</strong> during crawling rounds. PCs within reasonable reach can come together into a marching order and move as a group.</p>
<p><strong>Random Encounters:</strong> The GM checks for random encounters during crawling rounds based on the environment's danger level.</p>"""

# Vision needs its OWN content
by_id[40]['details'] = """<p>All characters need <strong>light to see</strong>, but darkness-adapted creatures of the Shadowdark do not.</p>
<p>Any area outside of a light source's illumination is in <strong>total darkness</strong>.</p>
<p><strong>Total Darkness Effects:</strong></p>
<ul>
<li>Creatures not adapted to darkness have <strong>disadvantage on all tasks requiring sight</strong></li>
<li>The environment becomes deadly &mdash; the GM checks for a random encounter <strong>every crawling round</strong></li>
</ul>
<p>Darkvision or similar abilities let certain creatures (and some ancestries/classes with special talents) see in darkness without penalty.</p>"""

# Swimming needs its OWN content
by_id[46]['details'] = """<p>Characters swim at <strong>half speed</strong>. In rough water, a <strong>STR check</strong> is required.</p>
<p><strong>Holding Breath:</strong> You can hold your breath for a number of rounds equal to your <strong>CON modifier</strong> (minimum 1).</p>
<p>After that, you must make a <strong>CON check each round</strong> or take <strong>1d6 damage per round</strong> until you exit the hazard.</p>
<p><strong>Armor Penalties:</strong></p>
<ul>
<li><strong>Chainmail:</strong> Disadvantage on swimming</li>
<li><strong>Plate mail:</strong> Cannot swim at all</li>
<li><strong>Mithral:</strong> Removes swimming penalty from metal armor</li>
</ul>"""

# Critical Success (Spells) needs its OWN content
by_id[60]['details'] = """<p>If you roll a <strong>natural 20</strong> on your spellcasting check, you may <strong>double one of the spell's numerical effects</strong>.</p>
<p>Examples:</p>
<ul>
<li>A healing spell that restores 1d8 HP could restore 2d8 HP</li>
<li>A spell that deals 2d6 damage could deal 4d6 damage</li>
<li>A spell that lasts 5 rounds could last 10 rounds</li>
</ul>
<p>On a <strong>focus spell</strong>, the doubled effect remains in place until your next focus check.</p>"""

# Priest Penance (Spellcasting section) needs its OWN content
by_id[63]['details'] = """<p>When a priest rolls a <strong>natural 1</strong> on a spellcasting check, their deity is greatly displeased and <strong>revokes that spell</strong>.</p>
<p>To regain the spell, the priest must:</p>
<ol>
<li><strong>Complete penance</strong> appropriate to their deity and alignment</li>
<li><strong>Successfully complete a rest</strong></li>
</ol>
<p>Penance requires a holy quest, ritualistic atonement, or a material sacrifice that you donate or destroy:</p>
<table class="gloss-table">
<thead><tr><th>Spell Tier</th><th>Sacrifice Value</th></tr></thead>
<tbody>
<tr><td>Tier 1</td><td>5 gp</td></tr>
<tr><td>Tier 2</td><td>20 gp</td></tr>
<tr><td>Tier 3</td><td>40 gp</td></tr>
<tr><td>Tier 4</td><td>90 gp</td></tr>
<tr><td>Tier 5</td><td>150 gp</td></tr>
</tbody>
</table>
<p><strong>Warning:</strong> Inadequate or subversive penance (donating to a party member, etc.) makes the spell loss <strong>permanent</strong>.</p>"""

# Scrolls needs its OWN content
by_id[64]['details'] = """<p>Scrolls contain magic spells. Spellcasters can use them to cast spells on their spell list, <strong>even if they don't know the spell</strong>.</p>
<p><strong>To cast from a scroll:</strong> Succeed on a spellcasting check with DC = <strong>10 + spell tier</strong>.</p>
<ul>
<li><strong>Success or Failure:</strong> The magical writing disappears and the scroll ceases to work (one use only)</li>
<li><strong>Critical Failure:</strong> The scroll is consumed AND casters with mishap tables must roll a mishap</li>
</ul>
<p>Failing to cast a spell from a scroll does <strong>not</strong> impact the ability to cast your known spells.</p>"""

# Wands needs its OWN content
by_id[65]['details'] = """<p>Wands contain magic spells. Spellcasters can use them to cast spells on their spell list, <strong>even if they don't know the spell</strong>.</p>
<p><strong>To cast from a wand:</strong> Succeed on a spellcasting check with DC = <strong>10 + spell tier</strong>.</p>
<ul>
<li><strong>Failure:</strong> The wand stops working until you complete a rest</li>
<li><strong>Critical Failure:</strong> The wand <strong>permanently breaks</strong>, and casters with mishap tables must roll a mishap</li>
</ul>
<p>Failing to cast a spell from a wand does <strong>not</strong> impact the ability to cast your known spells.</p>"""

# Step 4: Check for duplicate definitions
print("\n=== Checking for duplicate definitions ===")
seen_defs = {}
for d in data:
    short = d['definition'][:60].lower().strip()
    if short in seen_defs:
        print(f"  POSSIBLE DUP: ID {d['id']} '{d['term']}' vs ID {seen_defs[short]} (def starts: '{short[:50]}...')")
    else:
        seen_defs[short] = d['id']

# Check for duplicate terms
seen_terms = {}
for d in data:
    t = d['term'].lower().strip()
    if t in seen_terms:
        print(f"  DUP TERM: ID {d['id']} '{d['term']}' vs ID {seen_terms[t]}")
    else:
        seen_terms[t] = d['id']

# Step 5: Save
with open('static/data/glossary.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# Final report
detail_count = sum(1 for d in data if 'details' in d)
print(f"\nTotal entries with details: {detail_count}")
print("Done! All details reassigned to correct IDs.")
