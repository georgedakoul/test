import json

with open('static/data/glossary.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Batch 1: ~20 high-value entries with full expanded details
# Using HTML for formatting within the details field

details_map = {

1: """<p><strong>Roll 3d6 in order</strong> for each of the six stats: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma. Note the total and modifier for each.</p>
<p>If none of your stats are <strong>14 or higher</strong>, you may optionally roll a completely new set of six numbers.</p>
<table class="gloss-table">
<thead><tr><th>Stat</th><th>Modifier</th></tr></thead>
<tbody>
<tr><td>1-3</td><td>-4</td></tr>
<tr><td>4-5</td><td>-3</td></tr>
<tr><td>6-7</td><td>-2</td></tr>
<tr><td>8-9</td><td>-1</td></tr>
<tr><td>10-11</td><td>0</td></tr>
<tr><td>12-13</td><td>+1</td></tr>
<tr><td>14-15</td><td>+2</td></tr>
<tr><td>16-17</td><td>+3</td></tr>
<tr><td>18+</td><td>+4</td></tr>
</tbody>
</table>""",

8: """<p>Your stat modifier is derived from your stat score and applies to all checks, attacks, and damage rolls using that stat.</p>
<table class="gloss-table">
<thead><tr><th>Stat Score</th><th>Modifier</th></tr></thead>
<tbody>
<tr><td>1-3</td><td>-4</td></tr>
<tr><td>4-5</td><td>-3</td></tr>
<tr><td>6-7</td><td>-2</td></tr>
<tr><td>8-9</td><td>-1</td></tr>
<tr><td>10-11</td><td>0</td></tr>
<tr><td>12-13</td><td>+1</td></tr>
<tr><td>14-15</td><td>+2</td></tr>
<tr><td>16-17</td><td>+3</td></tr>
<tr><td>18+</td><td>+4</td></tr>
</tbody>
</table>""",

12: """<p>Alignment defines your role in the clash between good and evil. All creatures are connected to the eternal conflict waged by Law, Chaos, and Neutrality.</p>
<ul>
<li><strong>Lawful:</strong> Benevolence, fairness, order, and virtue. Lawful characters operate from a "good of the whole" mentality.</li>
<li><strong>Chaotic:</strong> Destruction, ambition, and wickedness. Chaotic characters adopt a "survival of the fittest" mentality.</li>
<li><strong>Neutral:</strong> Balance between Law and Chaos. Neutral characters align with the cycle of growth and decline, adopting a "nature must take its course" mentality.</li>
</ul>
<p>Your alignment affects your deity choice and your class title progression.</p>""",

14: """<p>Your armor class (AC) is <strong>10 + your Dexterity modifier</strong>. Wearing armor changes your AC.</p>
<table class="gloss-table">
<thead><tr><th>Armor</th><th>Cost</th><th>Slots</th><th>AC</th><th>Properties</th></tr></thead>
<tbody>
<tr><td>Leather armor</td><td>10 gp</td><td>1</td><td>11 + DEX mod</td><td>&mdash;</td></tr>
<tr><td>Chainmail</td><td>60 gp</td><td>2</td><td>13 + DEX mod</td><td>Disadv. on stealth, swim</td></tr>
<tr><td>Plate mail</td><td>130 gp</td><td>3</td><td>15</td><td>No swim, disadv. stealth</td></tr>
<tr><td>Shield</td><td>10 gp</td><td>1</td><td>+2</td><td>Occupies one hand</td></tr>
<tr><td>Mithral (metal only)</td><td>&times;4</td><td>-1</td><td>&mdash;</td><td>No stealth/swim penalty</td></tr>
</tbody>
</table>
<p>You can wear the types of armor listed for your class. 0-level PCs can wear all armor until 1st level. Attacks must meet or exceed your AC to hit.</p>""",

15: """<p>You can carry a number of items equal to your <strong>Strength stat or 10</strong>, whichever is higher. Unless noted, all gear besides typical clothing fills one gear slot.</p>
<table class="gloss-table">
<thead><tr><th>Item</th><th>Qty per Slot</th></tr></thead>
<tbody>
<tr><td>Arrows / Crossbow bolts</td><td>1-20</td></tr>
<tr><td>Backpack</td><td>1 (first one free)</td></tr>
<tr><td>Coins</td><td>100 (first 100 free)</td></tr>
<tr><td>Gems</td><td>1-10</td></tr>
<tr><td>Iron spikes</td><td>1-10</td></tr>
<tr><td>Rations</td><td>1-3</td></tr>
<tr><td>All other gear</td><td>1 per slot</td></tr>
</tbody>
</table>
<p>Gear that is hard to transport might fill more than one slot. Two-handed weapons and heavy armor typically take 2-3 slots.</p>""",

16: """<p>Characters advance by earning XP from treasure and boons, <strong>not from killing monsters</strong>.</p>
<p>To gain a level, you need to earn <strong>current level x 10 XP</strong>. Once you reach a new level, your total XP resets to zero.</p>
<table class="gloss-table">
<thead><tr><th>Level</th><th>Talent Roll</th><th>Level Up At...</th></tr></thead>
<tbody>
<tr><td>1</td><td>+1</td><td>10 XP</td></tr>
<tr><td>2</td><td>&mdash;</td><td>20 XP</td></tr>
<tr><td>3</td><td>+1</td><td>30 XP</td></tr>
<tr><td>4</td><td>&mdash;</td><td>40 XP</td></tr>
<tr><td>5</td><td>+1</td><td>50 XP</td></tr>
<tr><td>6</td><td>&mdash;</td><td>60 XP</td></tr>
<tr><td>7</td><td>+1</td><td>70 XP</td></tr>
<tr><td>8</td><td>&mdash;</td><td>80 XP</td></tr>
<tr><td>9</td><td>+1</td><td>90 XP</td></tr>
<tr><td>10</td><td>&mdash;</td><td>100 XP</td></tr>
</tbody>
</table>
<p>On leveling up: gain a new title, roll your class's HP die and add to max HP. At talent roll levels, roll once on your class talent table (duplicates stack unless noted).</p>""",

20: """<p>At the beginning of the game (or when combat starts), everyone rolls a <strong>d20 + DEX modifier</strong>. The GM uses the highest DEX modifier of any monsters.</p>
<p>The person with the <strong>highest result</strong> takes the first turn. Turns go <strong>clockwise</strong> from that person.</p>
<p><strong>Surprise:</strong> The GM determines if any creatures are unaware of each other. A creature who surprises another takes one full turn before a new initiative order is rolled.</p>
<p><strong>Freeform Mode:</strong> Some GMs keep a loose round-robin, letting players decide their turn order and actions before circling back to the GM's turn.</p>""",

21: """<p>A combat round completes when each person has taken one turn. During combat:</p>
<ul>
<li>Characters act in initiative order (clockwise from highest)</li>
<li>The GM takes actions for monsters and environmental effects</li>
<li>Timers count down at the start of each character's turn</li>
</ul>
<p><strong>Player Turn:</strong></p>
<ol>
<li>Count down any personal timers (spells, effects)</li>
<li>Take one action and move up to near (can split movement). Move near again if skipping your action.</li>
<li>GM describes results</li>
</ol>
<p><strong>GM Turn:</strong></p>
<ol>
<li>Count down any timers not tracked by players</li>
<li>Check for random encounters if needed</li>
<li>Take actions/movements for creatures and environmental effects</li>
<li>Describe what characters notice</li>
</ol>""",

26: """<p>When you hit a target with an attack or spell, roll your weapon or spell's <strong>damage dice + relevant bonuses</strong>. The GM subtracts that from the target's HP.</p>
<table class="gloss-table">
<thead><tr><th>Weapon</th><th>Damage</th><th>Properties</th></tr></thead>
<tbody>
<tr><td>Club / Dagger / Shortbow</td><td>1d4</td><td>&mdash;</td></tr>
<tr><td>Mace / Crossbow / Javelin</td><td>1d6</td><td>&mdash;</td></tr>
<tr><td>Longsword / Longbow</td><td>1d8</td><td>&mdash;</td></tr>
<tr><td>Bastard sword / Greataxe</td><td>1d8/1d10</td><td>Versatile</td></tr>
<tr><td>Greatsword</td><td>1d12</td><td>Two-handed</td></tr>
</tbody>
</table>""",

27: """<p>You deal a critical hit if you roll a <strong>natural 20</strong> on an attack roll or spellcasting check.</p>
<ul>
<li><strong>Weapon critical:</strong> Double the weapon's damage dice on the attack (then add modifiers normally).</li>
<li><strong>Spell critical:</strong> You may double one of the spell's numerical effects. On a focus spell, this remains in effect until your next focus check.</li>
</ul>""",

32: """<p>Actions you can take on your turn in combat:</p>
<ul>
<li><strong>Melee Attack:</strong> Roll 1d20 + STR mod + bonuses. Hit if total >= target's AC.</li>
<li><strong>Ranged Attack:</strong> Roll 1d20 + DEX mod + bonuses. Hit if total >= target's AC.</li>
<li><strong>Cast a Spell:</strong> Takes one action (see Spellcasting).</li>
<li><strong>Improvise:</strong> Any creative action &mdash; swinging on a vine, kicking over a table. GM may require a stat check.</li>
<li><strong>Multitask:</strong> Small parallel tasks (standing up, speaking, drinking a potion, activating a magic item) don't typically use your action.</li>
</ul>
<p><strong>Movement:</strong> Move up to <strong>near</strong> (30 ft) on your turn, split however you want. Move near again if you skip your action.</p>
<p><strong>Cover/Terrain:</strong> Attacking a creature behind half-cover has disadvantage. Full cover blocks targeting. Difficult terrain costs double movement.</p>""",

33: """<p>A character who goes to <strong>0 HP</strong> falls unconscious and is dying.</p>
<p><strong>Death Timer:</strong> On their turn, a dying character rolls <strong>1d4 + CON modifier</strong> (minimum 1 total). They die in that many rounds unless healed or stabilized.</p>
<p>On each subsequent turn, the dying player rolls a <strong>d20</strong>:</p>
<ul>
<li><strong>Natural 20:</strong> The character rises with 1 HP</li>
<li><strong>Any other result:</strong> Nothing happens, the timer continues to tick down</li>
</ul>
<p><strong>Stabilize:</strong> An intelligent being can give first aid at close range. On a successful <strong>DC 15 INT check</strong>, the target stops dying but remains unconscious. They need rest to recover.</p>
<p><strong>Healing:</strong> A character who goes above 0 HP wakes up and is no longer dying.</p>""",

38: """<p>Most light sources last for up to <strong>one hour of real time</strong> and illuminate a limited area. If you can't track real time, assume 1 hour = 10 rounds.</p>
<table class="gloss-table">
<thead><tr><th>Source</th><th>Range</th><th>Duration</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Torch</td><td>Near (30 ft)</td><td>1 hour real time</td><td>5 sp, 1 slot</td></tr>
<tr><td>Lantern</td><td>Double near (60 ft)</td><td>1 hour per oil flask</td><td>5 gp, has shutter</td></tr>
<tr><td>Campfire (3 torches)</td><td>Near (30 ft)</td><td>Up to 8 hours</td><td>Can't be moved; needs 1 PC near</td></tr>
</tbody>
</table>
<p><strong>Multiple light sources:</strong> When lighting a new source, either (1) the new source "rides along" on the current timer, or (2) extinguish all old sources and start a new timer.</p>
<p><strong>Total Darkness:</strong> Creatures not adapted to darkness have <strong>disadvantage on all tasks requiring sight</strong>. The GM checks for a random encounter <strong>every crawling round</strong>.</p>""",

40: """<p>Distances are abstracted into three ranges:</p>
<table class="gloss-table">
<thead><tr><th>Range</th><th>Distance</th><th>Examples</th></tr></thead>
<tbody>
<tr><td><strong>Close</strong></td><td>5 feet</td><td>Melee range, first aid, picking a lock</td></tr>
<tr><td><strong>Near</strong></td><td>Up to 30 feet</td><td>Standard move per turn, torch light range</td></tr>
<tr><td><strong>Far</strong></td><td>Within sight</td><td>Longbow range, far spells</td></tr>
</tbody>
</table>
<p>Characters can move <strong>near</strong> on their turn (can split movement before and after action). Move near again if skipping action. Difficult terrain costs double movement.</p>""",

46: """<p>To cast a spell, make a <strong>spellcasting check</strong>: roll 1d20 + your spellcasting stat modifier (INT for wizards, WIS for priests).</p>
<p>The DC equals <strong>10 + the spell's tier</strong>.</p>
<table class="gloss-table">
<thead><tr><th>Spell Tier</th><th>DC</th></tr></thead>
<tbody>
<tr><td>Tier 1</td><td>11</td></tr>
<tr><td>Tier 2</td><td>12</td></tr>
<tr><td>Tier 3</td><td>13</td></tr>
<tr><td>Tier 4</td><td>14</td></tr>
<tr><td>Tier 5</td><td>15</td></tr>
</tbody>
</table>
<p><strong>Success:</strong> The spell takes effect.</p>
<p><strong>Failure:</strong> The spell does not take effect. You can try again on a future turn.</p>
<p><strong>Natural 20 (Critical):</strong> Double one of the spell's numerical effects.</p>
<p><strong>Natural 1 (Critical Failure):</strong> The spell fails. <em>Wizard:</em> Lose that spell until you rest + roll on the Wizard Mishap table. <em>Priest:</em> Lose that spell until you complete penance + rest.</p>""",

60: """<p>To rest, a character must <strong>sleep for 8 hours</strong> and consume (or be fed) <strong>a ration</strong>. Sleep can be broken up for light tasks like taking watch.</p>
<p><strong>Success:</strong> Regain <strong>all lost HP</strong> and recover any stat damage. Some talents, spells, or items also regain their uses.</p>
<p><strong>Interruption:</strong> Each stressful interruption (including combat) requires a <strong>DC 12 CON check</strong>. On failure, you consume the ration but gain no benefit.</p>
<p><strong>Resting in Danger:</strong> The GM checks for random encounters while resting in perilous environments:</p>
<ul>
<li><strong>Unsafe:</strong> Check every 3 hours</li>
<li><strong>Risky:</strong> Check every 2 hours</li>
<li><strong>Deadly:</strong> Check every hour</li>
</ul>
<p><strong>Campfire:</strong> Combine 3 torches into a campfire (can't be moved). Lasts up to 8 hours while at least one character stays near. Casts light to near distance.</p>""",

63: """<p>The GM asks for a check when all three of the following are true:</p>
<ul>
<li>The action has a <strong>negative consequence for failure</strong></li>
<li>The action <strong>requires skill</strong></li>
<li>There is <strong>time pressure</strong></li>
</ul>
<p>Roll <strong>1d20 + relevant stat modifier</strong> against the Difficulty Class (DC).</p>
<p>Usually, you succeed at what you're trained to do <strong>without rolling</strong>. A wizard always reads magical runes; a thief always finds a trap if searching in the right area. If you take time to carefully examine something, you simply succeed.</p>
<p>Social encounters usually rely on <strong>what you say</strong> rather than Charisma checks.</p>""",

64: """<p>The four standard DCs represent how difficult an action is:</p>
<table class="gloss-table">
<thead><tr><th>Difficulty</th><th>DC</th><th>Examples</th></tr></thead>
<tbody>
<tr><td><strong>Easy</strong></td><td>9</td><td>Leaping a narrow chasm, sneaking up on an inattentive guard</td></tr>
<tr><td><strong>Normal</strong></td><td>12</td><td>Kicking open a stuck door, picking a poor lock</td></tr>
<tr><td><strong>Hard</strong></td><td>15</td><td>Swimming against a strong current, giving first aid to stop dying</td></tr>
<tr><td><strong>Extreme</strong></td><td>18</td><td>Climbing a slippery cliff one-handed, restraining a frenzied lion</td></tr>
</tbody>
</table>
<p><strong>Contested Checks:</strong> When creatures work against each other, each rolls a relevant stat check simultaneously. Highest result wins (reroll ties).</p>""",

65: """<p>The GM awards luck tokens for exceptional roleplaying, heroism, or daring maneuvers &mdash; whether or not the action was successful.</p>
<ul>
<li>Each player can hold <strong>only one luck token</strong> at a time</li>
<li>Cash in a luck token to <strong>reroll any roll you just made</strong> &mdash; you must use the new result</li>
<li>You can <strong>give your luck token</strong> to a companion</li>
</ul>
<p><strong>How many per session?</strong></p>
<ul>
<li><strong>Pulpy/heroic:</strong> 2-3 new tokens per player per session</li>
<li><strong>Grim/dark:</strong> The GM might not give out any</li>
</ul>""",

68: """<p>When you have advantage, roll the <strong>same die twice and use the better result</strong>.</p>
<p>Examples: attacking from high ground, retrying a task you just failed (you now have insight), being a Dwarf rolling HP (Stout ancestry).</p>""",

69: """<p>When you have disadvantage, roll the <strong>same die twice and use the worse result</strong>.</p>
<p>Examples: attacking while blinded, navigating while confused by poison, attacking a creature behind half-cover, being in chainmail while trying to swim or sneak.</p>""",

70: """<p>If you have <strong>both advantage and disadvantage</strong> on a roll, they cancel each other out. You roll normally (once).</p>
<p>This applies regardless of how many sources of advantage or disadvantage you have &mdash; one of each cancels.</p>""",

}

# Apply details to matching entries
count = 0
for entry in data:
    if entry['id'] in details_map:
        entry['details'] = details_map[entry['id']]
        count += 1

with open('static/data/glossary.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Enriched {count} entries with expanded details")
