"""Build rules glossary JSON from all Shadowdark RPG sources."""
import json, os

DATA_DIR = os.path.join(os.path.dirname(__file__), 'static', 'data')

glossary = []
_id = 0

def add(term, definition, category, source="Shadowdark RPG Core", page=None):
    global _id
    _id += 1
    glossary.append({
        "id": _id,
        "term": term,
        "definition": definition,
        "category": category,
        "source": source,
        "page": page
    })

# ═══════════════════════════════════════════════════════════════════════
# CHARACTER CREATION
# ═══════════════════════════════════════════════════════════════════════
C = "Character Creation"

add("Ability Scores (Stats)", "Six characteristics that define a character: Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma. Each ranges from 3-18 with a modifier from -4 to +4.", C, page=15)
add("Strength (STR)", "Physical power. Used for melee attacks, smashing doors, bending bars, and lifting heavy objects.", C, page=15)
add("Dexterity (DEX)", "Agility and reflexes. Used for ranged attacks, dodging traps, climbing, stealth, and initiative.", C, page=15)
add("Constitution (CON)", "Endurance and resistance to injury. Used for holding breath, resisting poison, and death timer calculations.", C, page=15)
add("Intelligence (INT)", "Logical ability. Used for wizard spellcasting, knowledge checks, navigation, and magical research.", C, page=15)
add("Wisdom (WIS)", "Instinct and willpower. Used for priest spellcasting, perception, tracking, and sensing danger.", C, page=15)
add("Charisma (CHA)", "Appeal and presence. Used for social influence, NPC reactions, and certain class abilities.", C, page=15)
add("Stat Modifier", "The bonus or penalty derived from a stat score: 3 = -4, 4-5 = -3, 6-7 = -2, 8-9 = -1, 10-11 = 0, 12-13 = +1, 14-15 = +2, 16-17 = +3, 18+ = +4.", C, page=15)
add("Ancestry", "Your character's species/race (Dwarf, Elf, Goblin, Half-Orc, Halfling, Human). Each ancestry grants unique abilities.", C, page=16)
add("Class", "Your character's profession and adventuring role. Core classes: Fighter, Priest, Thief, Wizard. Each determines hit points, weapons, armor, and special abilities.", C, page=18)
add("Background", "Your character's former occupation before adventuring. Grants a free talent related to that profession and helps define your character's history.", C, page=26)
add("Alignment", "A character's moral compass: Lawful (order, justice), Neutral (balance, pragmatism), or Chaotic (freedom, destruction). Affects deity choice and NPC interactions.", C, page=27)
add("Hit Points (HP)", "A measure of how much damage a character can sustain. Reduced by damage, restored by resting. At 0 HP, the death timer begins.", C, page=18)
add("Armor Class (AC)", "How hard a character is to hit. Calculated from armor worn plus DEX modifier (unless wearing plate). Attacks must meet or exceed AC to hit.", C, page=33)
add("Gear Slots", "The carrying capacity system. A character has a number of gear slots equal to their Strength score. Each item occupies one or more slots.", C, page=34)
add("Level Advancement", "Characters advance by earning XP from treasure, not from killing monsters. Each level requires meeting an XP target and passing a talent check.", C, page=43)
add("Titles", "As characters gain levels, they earn titles reflecting their growing fame. Titles differ by class and alignment.", C, page=30)
add("Languages", "Characters know Common plus languages from their ancestry and class. Rare languages (Celestial, Diabolic, Draconic, Primordial) require special training or class features.", C, page=32)
add("Starting Gear", "New characters roll for starting gear or use a crawling kit. Gear is tracked in gear slots and includes weapons, armor, and adventuring supplies.", C, page=33)

# ═══════════════════════════════════════════════════════════════════════
# COMBAT
# ═══════════════════════════════════════════════════════════════════════
C = "Combat"

add("Initiative", "At the start of combat, everyone rolls d20 + DEX modifier. The GM uses the highest DEX mod among monsters. Highest result goes first, then clockwise.", C, page=83)
add("Combat Round", "One full cycle where every participant takes one turn. Each turn allows one action plus movement up to near distance.", C, page=88)
add("Combat Turn", "On your turn: move up to near (30 ft), take one action (attack, cast spell, use item, etc.). You can split movement before and after your action. Move near again if you skip your action.", C, page=88)
add("Melee Attack", "Roll d20 + STR modifier + bonuses vs target's AC. Uses melee weapons at close range (5 ft).", C, page=88)
add("Ranged Attack", "Roll d20 + DEX modifier + bonuses vs target's AC. Uses ranged weapons (bows, crossbows) or thrown weapons.", C, page=88)
add("Damage", "When you hit, roll your weapon's damage dice + relevant bonuses. The GM subtracts that from the target's HP.", C, page=89)
add("Critical Hit", "A natural 20 on an attack roll. For weapons: double the damage dice. For spells: double one numerical effect.", C, page=89)
add("Natural 1 (Fumble)", "A natural 1 on an attack roll is always a miss, regardless of bonuses. On spellcasting, it triggers a critical failure.", C, page=78)
add("Terrain / Cover", "Attacking a creature behind half cover has disadvantage. Full cover blocks targeting entirely. Difficult terrain halves movement.", C, page=89)
add("Knockout", "When reducing a creature to 0 HP, you can choose to knock it unconscious instead of killing it.", C, page=89)
add("Morale", "When a monster group is reduced to half, the GM rolls a Wisdom check (DC 15) for the monsters. On failure, they flee or surrender.", C, page=88)
add("Dual Wielding", "If wielding two one-handed weapons, you can attack with both on your turn. The second attack has disadvantage.", C, page=88)
add("Actions in Combat", "On your turn you can: attack, cast a spell, use an item, dash (move near again), hide, help an ally, shove, grapple, or attempt any creative action.", C, page=88)

# ═══════════════════════════════════════════════════════════════════════
# DEATH & DYING
# ═══════════════════════════════════════════════════════════════════════
C = "Death & Dying"

add("Death Timer", "When a PC drops to 0 HP, roll 1d4 + CON modifier (minimum 1). This is how many rounds before the PC dies.", C, page=88)
add("Death Timer (Secret Variant)", "The DM rolls the death timer in secret instead of the player, adding dramatic tension.", C, "Death Timer Issue 1", page=4)
add("Player Recovery", "On each turn while dying, the PC rolls a d20. On a natural 20, the PC rises with 1 HP.", C, page=88)
add("Stabilize by PC", "A PC at close range to a downed character can make a DC 15 INT check. On success, the target stops dying but remains unconscious.", C, "Death Timer Issue 1", page=4)
add("Character Death", "When the death timer expires, the character dies. Dead characters can sometimes be raised by powerful magic.", C, page=88)

# ═══════════════════════════════════════════════════════════════════════
# EXPLORATION
# ═══════════════════════════════════════════════════════════════════════
C = "Exploration"

add("Crawling Rounds", "The default mode of play when not in combat. Characters explore, talk, and interact with the environment in turn order.", C, page=84)
add("The Shadowdark", "Any place where darkness, danger, and myth reign supreme — crumbling ruins, ancient strongholds, mysterious towers, gloomy forests, haunted caves.", C, page=84)
add("Vision", "All characters need light to see. Any area outside a light source's illumination is in total darkness. Darkness-adapted creatures (monsters) can see without light.", C, page=84)
add("Light Sources", "Torches last 1 hour of real time and illuminate near distance. Lanterns last 1 hour per oil flask. If real time can't be tracked, 1 hour = 10 rounds.", C, page=84)
add("Real Time Tracking", "Time passes in the game world at the same pace as real time. One real minute = one game minute. Critical for tracking torch duration.", C, page=82)
add("Distances", "Close = 5 feet. Near = up to 30 feet. Far = within sight during an encounter or scene.", C, page=85)
add("Climbing", "STR or DEX check to climb at half speed. Falling if you fail by 5+ points.", C, page=85)
add("Falling Damage", "1d6 damage per 10 feet fallen.", C, page=85)
add("Swimming", "Swim at half speed (STR check in rough water). Hold breath for rounds equal to CON mod (min 1). Then CON check each round or take 1d6 damage.", C, page=85)
add("Regroup", "During crawling rounds, the GM can allow players to regroup into marching order and move as a group.", C, page=85)
add("Random Encounters", "Roll 1d6 periodically. On a 1, a random encounter occurs. Frequency: Unsafe = every 3 rounds, Risky = every 2, Deadly = every round.", C, page=116)
add("Encounter Distance", "When an encounter starts, roll d6: 1 = Close, 2-4 = Near, 5-6 = Far.", C, page=116)
add("Encounter Activity", "Roll 2d6 for what encountered creatures are doing: 2-4 Hunting, 5-6 Eating, 7-8 Building/nesting, 9-10 Socializing, 11 Guarding, 12 Sleeping.", C, page=116)
add("Reaction Roll", "Roll 2d6 + CHA mod to determine NPC attitude: 0-6 Hostile, 7-8 Suspicious, 9 Neutral, 10-11 Curious, 12+ Friendly.", C, page=116)
add("Surprise", "The GM determines if creatures are unaware of each other. A surprising creature takes one free turn before new initiative is rolled.", C, page=88)
add("Hiding and Sneaking", "DEX checks to go undetected. Can't hide while visible. Looking in the right place auto-reveals. Otherwise, searcher makes a check.", C, page=87)

# ═══════════════════════════════════════════════════════════════════════
# SPELLCASTING
# ═══════════════════════════════════════════════════════════════════════
C = "Spellcasting"

add("Spellcasting Check", "Roll d20 + INT mod (wizards) or d20 + WIS mod (priests) vs the spell's DC (10 + spell tier). Meet or beat to cast successfully.", C, page=44)
add("Spell Tiers", "Spells are classified in tiers 1-5, with higher tiers being more powerful. The DC to cast = 10 + tier.", C, page=50)
add("Spell Range", "Close (5 ft), Near (30 ft), Far (within sight), or Self. Determines how far the spell can reach.", C, page=50)
add("Spell Duration", "How long spell effects last: Instant, rounds, focus, or longer durations.", C, page=50)
add("Focus Spells", "Last as long as you concentrate. Can't cast other focus spells while focusing. Each round, make a DC 9 + spell tier spellcasting check to maintain. Ends on failure or natural 1.", C, page=50)
add("Overlapping Effects", "Same spell on same target doesn't stack. The most powerful effect (e.g., longer duration) takes precedence.", C, page=50)
add("Critical Success (Spells)", "Natural 20 on spellcasting check: double one numerical effect of the spell. On focus spells, this lasts until your next focus check.", C, page=45)
add("Critical Failure (Spells)", "Natural 1: spell fails. Wizard spells can't be cast again until rest + roll on Wizard Mishap table. Priest spells can't be cast again until penance is completed.", C, page=45)
add("Wizard Mishap", "When a wizard rolls natural 1, they lose the spell until rest and roll on the mishap table for their spell tier. Effects range from self-damage to permanent spell loss.", C, page=46)
add("Priest Penance", "When a priest rolls natural 1, their deity revokes the spell. They must undertake penance (determined by the GM) before they can cast it again.", C, page=45)
add("Scrolls", "Contain a spell. Any spellcaster can attempt to cast if the spell is on their list. DC = 10 + tier. Writing disappears after use, whether successful or not.", C, page=49)
add("Wands", "Contain a spell. Spellcasters can attempt to cast if the spell is on their list. DC = 10 + tier. Failed = wand stops working until rest. Natural 1 = wand breaks permanently.", C, page=49)
add("Spells Known", "The number of spells a caster knows depends on their class and level, as shown in their class's Spells Known table.", C, page=20)

# ═══════════════════════════════════════════════════════════════════════
# PENANCE (Death Timer supplement)
# ═══════════════════════════════════════════════════════════════════════
C = "Penance"

add("Divine Penance", "An expanded penance system for priests. When spellcasting critically fails, roll on the Divine Penance table (d12) matching the spell's tier.", C, "Death Timer Issue 1", page=8)
add("Divine Penance (Tier 1-3)", "d12 effects include: Atonement (roll twice), Blasphemy (radiance damage), Humility (target self), Envy (target ally), Retribution (spell locked 1 week), Tithe (lose all coins), and more.", C, "Death Timer Issue 1", page=8)
add("Divine Penance (Tier 4-5)", "Harsher d12 effects include: Damnation (roll twice), Fury (AoE damage), Vow of Poverty (lose random gear), Vanity (lose CHA permanently), and worse.", C, "Death Timer Issue 1", page=9)
add("Nature's Penance", "Penance system for nature-based casters (Druids, Shamans). Roll on Nature's Penance table when spellcasting critically fails.", C, "Death Timer Issue 1", page=10)

# ═══════════════════════════════════════════════════════════════════════
# RESTING
# ═══════════════════════════════════════════════════════════════════════
C = "Resting"

add("Rest", "Sleep 8 hours and consume a ration. Restores all lost HP, recovers stat damage, and restores spent spell slots and abilities.", C, page=86)
add("Rest Interruption", "Each stressful interruption (including combat) requires a DC 12 CON check. Failure = ration consumed but no rest benefit.", C, page=86)
add("Danger Level (Rest)", "Resting in dangerous areas risks interruption. Safe havens like towns allow uninterrupted rest. The GM determines danger level.", C, page=86)

# ═══════════════════════════════════════════════════════════════════════
# TREASURE & XP
# ═══════════════════════════════════════════════════════════════════════
C = "Treasure & XP"

add("XP from Treasure", "Characters earn XP from treasure quality, not from killing monsters. This encourages creative problem-solving over combat.", C, page=121)
add("Treasure Quality", "Poor = 0 XP (mundane items). Normal = 1 XP (bag of gold, gem, magic scroll). Fabulous = 3 XP (magic sword, giant diamond). Legendary = 10 XP (Staff of Ord, dragon hoard).", C, page=121)
add("Treasure Quality (Expanded)", "Death Timer expands categories: Poor (below 100 gp), Normal (100+ gp or consumable magic), Fabulous (permanent magic item or 1000+ gp), Legendary (artifact-level).", C, "Death Timer Issue 1", page=6)
add("XP Target", "The amount of XP needed to level up. Increases with each level.", C, page=43)
add("Talent Check", "When leveling up, roll a d20 on your class talent table to gain a new ability.", C, page=43)

# ═══════════════════════════════════════════════════════════════════════
# EQUIPMENT & ITEMS
# ═══════════════════════════════════════════════════════════════════════
C = "Equipment & Items"

add("Gear Slots System", "Items take up gear slots. A character's total slots = STR score. Going over means encumbered (half speed, disadvantage on physical checks).", C, page=34)
add("Weapon Properties", "F = Finesse (use DEX instead of STR), Th = Thrown, V = Versatile (1-hand or 2-hand damage), 2H = Two-Handed, L = Loading.", C, page=37)
add("Armor Types", "Leather (AC 11+DEX), Chainmail (AC 13+DEX, stealth/swim disadvantage), Plate (AC 15, no swim, stealth disadvantage), Shield (+2 AC, one hand).", C, page=37)
add("Mithral", "Magical metal armor variant. Costs 4x normal. Reduces gear slots by 1. Removes stealth and swim penalties.", C, page=37)
add("Crawling Kit", "A pre-built gear loadout for new characters: rope, torches, rations, and basic supplies.", C, page=36)
add("Identifying Magic Items", "A spellcaster using detect magic, after two rounds of focus, learns the item's name and general effects. DC 15 INT reveals all benefits.", C, "Death Timer Issue 1", page=5)
add("Magic Item Curses", "Some magic items carry curses that aren't revealed until the item is used or identified. Curses persist until removed by specific means.", C, page=286)

# ═══════════════════════════════════════════════════════════════════════
# CONDITIONS & EFFECTS
# ═══════════════════════════════════════════════════════════════════════
C = "Conditions & Effects"

add("Advantage", "Roll the die twice and use the better result. Gained from favorable positioning, class abilities, or magical effects.", C, page=78)
add("Disadvantage", "Roll the die twice and use the worse result. Caused by unfavorable conditions, injuries, or environmental hazards.", C, page=78)
add("Advantage/Disadvantage Cancel", "If you have both advantage and disadvantage on the same roll, they cancel out and you roll normally.", C, page=78)
add("Natural 20", "An automatic success on any d20 roll, regardless of modifiers or DC.", C, page=78)
add("Natural 1", "An automatic failure on any d20 roll, regardless of modifiers or DC.", C, page=78)
add("Blindness", "Cannot see. Attacks have disadvantage. Enemies have advantage on attacks against you.", C, page=59)
add("Paralysis", "Cannot move or take actions. Attacks against you automatically hit.", C, page=66)
add("Invisibility", "Cannot be seen. Attacks against you have disadvantage. Your attacks have advantage.", C, page=67)
add("Petrification", "Turned to stone. Effectively dead until cured by magic.", C, page=47)

# ═══════════════════════════════════════════════════════════════════════
# ROLLING THE DICE
# ═══════════════════════════════════════════════════════════════════════
C = "Rolling the Dice"

add("Check", "Roll d20 + modifier vs a Difficulty Class (DC). Meet or beat the DC to succeed.", C, page=81)
add("Difficulty Class (DC)", "Easy = 9, Normal = 12, Hard = 15, Extreme = 18. The GM sets the DC based on the task's difficulty.", C, page=81)
add("Luck Token", "Awarded by the GM for exceptional roleplaying or heroism. Cash in to reroll any roll you just made. Must use new result. Max 1 per player.", C, page=79)
add("When to Roll", "Only roll when: the action has a negative consequence for failure, requires skill, and there is time pressure. Trained characters auto-succeed at routine tasks.", C, page=81)
add("Opposed Check", "When two creatures contest each other, both roll. The higher result wins.", C, page=81)

# ═══════════════════════════════════════════════════════════════════════
# OVERLAND TRAVEL
# ═══════════════════════════════════════════════════════════════════════
C = "Overland Travel"

add("Overland Travel", "When traveling long distances, use initiative order. Check for random encounters based on area danger level.", C, page=90)
add("Navigation", "In unfamiliar territory, the navigator makes an INT check when exiting a hex. Failure = lost, entering a random adjacent hex.", C, page=90)
add("Overland Encounter Frequency", "Unsafe: check every 3 hours. Risky: check every 2 hours. Deadly: check every hour.", C, page=90)
add("Overland Light", "Roll 1d6 x 10 minutes for remaining light. Rarely total darkness outside, even at night.", C, page=90)

# ═══════════════════════════════════════════════════════════════════════
# DOWNTIME
# ═══════════════════════════════════════════════════════════════════════
C = "Downtime"

add("Downtime", "Between adventures, choose one downtime activity: Carousing, Learning, or other activities.", C, page=91)
add("Carousing", "Convert treasure into XP by celebrating. Pay a cost, roll d8 + event bonus. Outcomes range from jail to legendary allies. Lasts several in-game days.", C, page=92)
add("Carousing Costs", "30 gp (+0), 100 gp (+1), 300 gp (+2), 600 gp (+3), 900 gp (+4), 1200 gp (+5), 1800 gp (+6). Higher investment = better outcomes.", C, page=92)
add("Learning", "Spend downtime learning a new skill. Requires a teacher, time, and gold. The GM determines specifics.", C, page=91)
add("Acts of Devotion", "Devout PCs can use treasure to demonstrate faith instead of carousing. Invest 30-1800 gp in devotional events for XP and spiritual benefits.", C, "GM Companion", page=32)
add("Devotional Events", "Scale from personal reflection (30 gp, +0) to a grand temple with permanent festival plaza (1800 gp, +6). Roll d8 + bonus for outcome.", C, "GM Companion", page=32)
add("Combat Training", "Combat-focused PCs can use treasure to train instead of carousing. Invest 30-1800 gp for XP and martial benefits.", C, "GM Companion", page=34)

# ═══════════════════════════════════════════════════════════════════════
# GAME MASTERING
# ═══════════════════════════════════════════════════════════════════════
C = "Game Mastering"

add("Game Master (GM)", "The referee who describes the world, controls NPCs and monsters, adjudicates rules, and drives the story. Also called the referee.", C, page=106)
add("Core Ethos", "Shadowdark RPG emphasizes: player agency, emergent storytelling, real-time tension, resource management, and thinking outside the character sheet.", C, page=108)
add("Modes of Play", "Crawling (dungeon exploration), Overland (hex travel), Combat, Downtime, and Roleplay. Each has slightly different rules emphasis.", C, page=115)
add("Traps", "Hidden hazards in the environment. Thieves can detect traps if searching the right area. Common types: pit, dart, poison needle, collapsing ceiling.", C, page=118)
add("Hazards", "Environmental dangers: flooding, cave-ins, extreme temperatures, toxic gases. Usually require checks to avoid or survive.", C, page=119)
add("The Gauntlet", "A timed challenge where the party must overcome obstacles in sequence. Creates urgency and dramatic tension.", C, page=120)
add("Awarding XP", "XP comes from treasure quality, not monster kills. This encourages stealth, negotiation, and creative problem-solving.", C, page=121)
add("Something Happens! Table", "When players seem stuck or things slow down, roll on this table to inject an unexpected event into the scene.", C, page=122)
add("Rumors", "Information hooks for adventures. Can be true, false, or partially true. Players gather rumors through NPC interactions.", C, page=124)
add("NPC Reactions", "Roll 2d6 + CHA mod: 0-6 Hostile, 7-8 Suspicious, 9 Neutral, 10-11 Curious, 12+ Friendly. Determines initial NPC attitude.", C, page=128)
add("Rival Crawlers", "NPC adventuring parties that compete with the players. Can be allies, rivals, or enemies depending on circumstances.", C, page=130)
add("Monster Design", "Create monsters by assigning: Level, HP, AC, ATK bonus, damage, movement, alignment, and special abilities. Use the Monster Generator tables for quick creation.", C, page=194)
add("Random Encounter Tables", "Pre-built d100 tables for 20 different environments (Arctic, Cave, Desert, Forest, etc.). Each entry includes creatures, events, or situations.", C, page=146)
add("Wizards and Thieves (Game)", "An in-world dice gambling game using 3d6. Players bet coins on rolls of wizards (6s) and thieves (1s). Used for in-character gambling scenes.", C, page=94)

# ═══════════════════════════════════════════════════════════════════════
# MAGIC ITEMS (rules, not specific items)
# ═══════════════════════════════════════════════════════════════════════
C = "Equipment & Items"

add("Magic Item Attributes", "Magic items have: Benefit (what it does), Bonus (numerical enhancement), Personality (sentient items), and sometimes Curse.", C, page=286)
add("Item Personality", "Some magic items are sentient with their own personality, goals, and alignment. They may resist wielders of opposing alignment.", C, page=298)
add("Boons", "Non-item rewards: titles, land grants, NPC allies, divine favor, or special abilities. Awarded for exceptional deeds.", C, page=284)

# Write it
os.makedirs(DATA_DIR, exist_ok=True)
out = os.path.join(DATA_DIR, 'glossary.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump(glossary, f, indent=2, ensure_ascii=False)

# Summary
from collections import Counter
cats = Counter(g['category'] for g in glossary)
print(f"Wrote {len(glossary)} glossary entries to {out}")
print("\nBy category:")
for cat, count in cats.most_common():
    print(f"  {cat}: {count}")
print(f"\nSources: {sorted(set(g['source'] for g in glossary))}")
