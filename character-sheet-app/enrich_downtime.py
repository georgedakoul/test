import json

with open('static/data/glossary.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

by_id = {d['id']: d for d in data}

# Downtime entries: 104-110

by_id[104]['details'] = """<p>Between adventures, you can choose to undertake <strong>one downtime activity</strong>. Downtime can last several days of in-game time, so the GM uses the Time Passes rule as needed.</p>
<p>Available downtime activities:</p>
<ul>
<li><strong>Carousing</strong> &mdash; Convert coin into XP, allies, and wild stories</li>
<li><strong>Learning</strong> &mdash; Study a new skill with an instructor</li>
<li><strong>Acts of Devotion</strong> &mdash; Serve your deity for blessings</li>
<li><strong>Combat Training</strong> &mdash; Pit fighting for treasure and fame <em>(Cursed Scroll 2)</em></li>
</ul>
<p>The GM determines how much in-game time passes during a downtime activity.</p>"""

by_id[105]['details'] = """<p>When you return from the Shadowdark, you can carouse to celebrate your heroic exploits.</p>
<p><strong>How it works:</strong> Each participant pitches in for the cost of the event. Then each participant rolls <strong>1d8 + the event's bonus</strong> to determine their own outcome.</p>
<table class="gloss-table">
<thead><tr><th>Cost</th><th>Event</th><th>Bonus</th></tr></thead>
<tbody>
<tr><td>30 gp</td><td>A worthy night of drinking and festivity</td><td>+0</td></tr>
<tr><td>100 gp</td><td>A full day and night of revelry and gambling</td><td>+1</td></tr>
<tr><td>300 gp</td><td>Two days of crawling dozens of taverns</td><td>+2</td></tr>
<tr><td>600 gp</td><td>A three-day voyage into the finest food and drink</td><td>+3</td></tr>
<tr><td>900 gp</td><td>A hazy, weeklong bender</td><td>+4</td></tr>
<tr><td>1,200 gp</td><td>A ten-day fete that takes over a town</td><td>+5</td></tr>
<tr><td>1,800 gp</td><td>Two legendary weeks that take over a city</td><td>+6</td></tr>
</tbody>
</table>
<p>Each character gains XP and other effects from their individual outcome roll. If the group plays out the results, the entire carousing group is usually present.</p>"""

by_id[106]['details'] = """<p>Roll <strong>1d8 + event bonus</strong> to determine your carousing outcome:</p>
<table class="gloss-table">
<thead><tr><th>Roll</th><th>Outcome</th><th>Benefit</th></tr></thead>
<tbody>
<tr><td>1</td><td>You wake up blearily in your bed</td><td>2 XP</td></tr>
<tr><td>2</td><td>Locked in stocks 1d4 days, fined 20% of wealth for arson</td><td>2 XP</td></tr>
<tr><td>3</td><td>Wake up in a gutter, 15% of wealth spent</td><td>3 XP</td></tr>
<tr><td>4</td><td>Donated 10% of wealth to a glib priest</td><td>3 XP + priest ally</td></tr>
<tr><td>5</td><td>Fined 10% of wealth for starting a tavern brawl</td><td>3 XP + barred from tavern</td></tr>
<tr><td>6</td><td>Thieves' Guild bilked you for 5% of wealth</td><td>4 XP</td></tr>
<tr><td>7</td><td>Led a tavern in an insulting song about a noble</td><td>4 XP + bard ally</td></tr>
<tr><td>8</td><td>Survived a blindfolded knife-throwing demo</td><td>4 XP + luck token</td></tr>
<tr><td>9</td><td>Beat a rival crawler in a test of skill</td><td>5 XP + NPC ally or enemy</td></tr>
<tr><td>10</td><td>Reflected a wizard's spell off your cup</td><td>5 XP + luck token</td></tr>
<tr><td>11</td><td>Pranked a despised corrupt merchant</td><td>5 XP + City Watch ally</td></tr>
<tr><td>12</td><td>Defeated a noble in a drinking contest</td><td>5 XP + noble's debt</td></tr>
<tr><td>13</td><td>Pulled off an ill-advised heist in a sorcerer's tower</td><td>6 XP + treasure (80-100)</td></tr>
<tr><td>14+</td><td>Wake up in the local ruler's stronghold holding a priceless heirloom. Footsteps approach...</td><td>6 XP + treasure (90-100) if you escape</td></tr>
</tbody>
</table>
<p>Wealth percentages are based on your <strong>total wealth</strong> at the time of carousing.</p>"""

by_id[107]['details'] = """<p>Your character may wish to learn a new skill during downtime. You must find a <strong>capable instructor</strong> who is willing to teach you.</p>
<p><strong>What you can learn:</strong></p>
<ul>
<li>A new language</li>
<li>Auxiliary skills (riding a sandworm, sailing, etc.)</li>
<li>New actions or advantage on certain checks</li>
</ul>
<p><strong>What you typically can't learn:</strong> Another class's or ancestry's unique talents.</p>
<p><strong>Procedure:</strong></p>
<ol>
<li>Work with the GM to determine what you can try to learn</li>
<li>Make an <strong>Extreme (DC 18) Intelligence check</strong></li>
<li><strong>Success:</strong> You learn the new skill</li>
<li><strong>Failure:</strong> You can try again as your next downtime activity, this time lowering the DC by one step (to Hard DC 15, then Normal DC 12, etc.)</li>
</ol>
<p>Learning enables you to do new actions or gives you advantage on certain checks related to the skill.</p>"""

by_id[108]['details'] = """<p>Priests and devout characters can spend downtime performing acts of devotion to their deity. This strengthens their divine connection and may earn blessings.</p>
<p><strong>Types of devotion:</strong></p>
<ul>
<li><strong>Temple Service:</strong> Assist at a temple, perform rites, counsel the faithful</li>
<li><strong>Pilgrimage:</strong> Travel to a holy site relevant to your deity</li>
<li><strong>Charitable Works:</strong> Aid the poor, heal the sick, protect the weak (for lawful deities)</li>
<li><strong>Sacrifice:</strong> Destroy or donate valuables in your deity's name</li>
<li><strong>Proselytizing:</strong> Spread your deity's teachings to new followers</li>
</ul>
<p>The GM determines the outcome and any blessings earned. Devotion can also serve as penance to regain lost spells (see Penance rules).</p>"""

by_id[109]['details'] = """<p>When performing acts of devotion, the GM may use devotional events to add flavor and consequences:</p>
<ul>
<li>A divine vision or omen related to upcoming adventures</li>
<li>A test of faith that challenges the character's beliefs</li>
<li>An encounter with a rival or enemy of the deity</li>
<li>A blessing that grants a temporary boon (luck token, advantage on next check, etc.)</li>
<li>A request from the temple or faith community that leads to a side quest</li>
</ul>
<p>Devotional events are entirely at the GM's discretion and should tie into the deity's themes and the campaign's narrative.</p>"""

by_id[110]['details'] = """<p>Characters can spend downtime engaging in combat training, including <strong>pit fighting</strong> for treasure, XP, and fame.</p>
<p><strong>Pit Fighting</strong> <em>(Cursed Scroll 2: Red Sands)</em></p>
<p>PCs participate in organized bouts during downtime. The GM rolls for venue and stakes:</p>
<table class="gloss-table">
<thead><tr><th>Danger Level</th><th>Description</th><th>Lethality</th></tr></thead>
<tbody>
<tr><td><strong>Low</strong></td><td>Low stakes or safe venue</td><td>Fight to half HP or knockout</td></tr>
<tr><td><strong>Mid</strong></td><td>Mid stakes or risky venue</td><td>Knockout, rare death</td></tr>
<tr><td><strong>High</strong></td><td>High stakes or extreme venue</td><td>Fight to the death is common</td></tr>
</tbody>
</table>
<p><strong>Stakes (APL + 1d6):</strong></p>
<table class="gloss-table">
<thead><tr><th>Roll</th><th>Stakes</th><th>Example Rewards</th></tr></thead>
<tbody>
<tr><td>2-5</td><td>Low</td><td>20 gp, small NPC favor, +2 carouse bonus</td></tr>
<tr><td>6-10</td><td>Mid</td><td>50 gp, big NPC favor, +3 carouse bonus</td></tr>
<tr><td>11-13</td><td>High</td><td>100 gp, royal favor, +4 carouse bonus</td></tr>
<tr><td>14+</td><td>Epic</td><td>Giant diamond, djinni wish, +5 carouse bonus</td></tr>
</tbody>
</table>
<p><strong>Venues (2d6):</strong> Shady back alley (2-4), cage fight (5-7), open-air arena (8-10), noble's private arena (11), glorious coliseum (12).</p>
<p><strong>Twists (2d6):</strong> Additional danger like traps or banned equipment (2-5), none (6-9), donor increases stakes (10-11), attendee throws a boon (12).</p>
<p>Winners get the stakes and resulting XP. Killing humanoids is forbidden in most public venues.</p>"""

with open('static/data/glossary.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

detail_count = sum(1 for d in data if 'details' in d)
print(f"Downtime entries enriched. Total entries with details: {detail_count}")
