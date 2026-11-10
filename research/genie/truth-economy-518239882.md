# Replay 518239882 - economy summary from truth4.jsonl (0-900 s)

Players: player 1 = **ssapo**, player 2 = **Maerlin_the_Mighty325** (from the inflated replay header: name string followed by type=2, profile id, player_number 1 / 2). Scripts: s1_extract.py (one pass over the log -> cache_events.csv, cache_res.csv), common.py, s6_analyse.py, s7_res.py, s8_report.py; exploration: s0_probe.py, s2_explore.py, s3_explore2.py, s4_diag.py, s5_names.py.

## Method
- **Measured**: stockpiles (`res`), every object's held amount/state/position/owner at each log line (10,004 lines, none invalid).
- **Cumulative gathered (resources_10s.csv, *_cum)**: sum of positive stockpile changes between consecutive log lines. Includes refunds; a deposit and a spend inside one log interval net out.
- **Deposit-based gathered (resources_10s_deposits.csv)**: sum of decreases of villager carried amounts happening within 4.5 tiles of an own drop-off building (masters 109 TC, 68, 562, 584), resource type by villager master (590/592/122/216/120/354/214/259 food, 123/218 wood, 579/581 gold; meanings inferred from which objects they stand next to and which stockpile rises). Free of refunds and netting.
- **Animals**: kill = first line with state != 2. Eaten = carry increases of shepherds (590/592) for sheep and hunters (122/216) for boar/deer, attributed to the nearest dead animal of that kind within 1.5 tiles (all but ~1 food were within 1.25 tiles). Decayed = food at kill - eaten. Attribution between two carcasses of the same kind lying next to each other is an estimate.

## Things in the data that differ from the brief
- Animal states: 2 alive -> 4 (dying, ~1.1-1.4 s, almost no food change) -> 5 (carcass, food falls) -> sometimes 7/8 for one line -> row disappears. There is no state 3 for animals; state 3 is the normal state of Gaia trees/bushes/mines. Sheep 3661: owned by P1 from the first line, moved to Gaia's list at 28.327 s (state 2), state 4 at 28.340, state 5 at 29.744 (99.8 food), 0 food and gone at 87.8 s.
- A killed sheep moves back to **Gaia's list**; ownership at death must be taken from the previous list.
- Deer = master 2340 (140 food). Masters 1246, 1611, 356, 2341 (and 228, 449 for player 1) are not animals: they appear at the carcass position when it goes, start at 60 or 300 and count down 1 per second (decay timers of remains), so they were excluded.
- Carcass food falls continuously while it is being eaten too (sheep about 0.25/s, boar about 0.4/s, deer about 0.25/s observed), so "decayed" is not only unattended time.
- Hunters carry up to 35, other gatherers 10.
- Sheep 3662 (P2's) was in P1's list 575.4-584.8 s, then back to P2 and eaten by P2.

## Animals per player

- P1 (ssapo): 8 sheep, 2 boar, 0 deer; food on them 1480, eaten 1225.5 (82.8%), decayed 254.5. Sheep eaten 679.5/800, boar 545.9/680, deer 0.0/0.
- P2 (Maerlin_the_Mighty325): 8 sheep, 2 boar, 2 deer; food on them 1760, eaten 1487.9 (84.5%), decayed 272.1. Sheep eaten 670.8/800, boar 593.4/680, deer 223.7/280.
- Not killed by 900 s: 8 deer (2340) still alive at 140 food. No boar left alive (4 of 4 killed).

## Cross-check

- P1 (ssapo): eaten from animals (attributed) 1225.5; shepherd+hunter deposits 1228.0 (difference -2.6). Food deposits by source: herd 647.2, hunt 580.8, forage 750.5, farm 400.0 = 2378.5. Cumulative positive food stock change 2626.1; difference 247.6. Before the first forage/farm deposit (327.3 s): animal deposits 512.9 vs cumulative positive food change 614.0.
- P2 (Maerlin_the_Mighty325): eaten from animals (attributed) 1487.9; shepherd+hunter deposits 1488.0 (difference -0.1). Food deposits by source: herd 670.9, hunt 817.1, forage 363.8, farm 519.7 = 2371.5. Cumulative positive food stock change 2430.7; difference 59.2. Before the first forage/farm deposit (382.3 s): animal deposits 686.5 vs cumulative positive food change 697.2.
- The food difference is explained by the jumps listed below (+50 refunds) plus a few small items.

## Positive stock jumps not matched by a villager deposit in the same log interval (>0.5)

|time_s|player|resource|stock change|deposit seen|unexplained|comment|
|---|---|---|---|---|---|---|
|193.8|1|food|29.18|28.61|0.57|stock rose slightly more than the carry drop|
|228.3|1|food|0.00|2.10|-2.10|deposit seen but stock did not rise by it (villager master/resource mismatch or spend in same interval)|
|228.3|1|wood|2.10|0.00|2.10|no gatherer-type carry drop seen (probably carried by a villager whose master was not a gatherer type)|
|291.9|1|food|50.00|0.00|50.00|= villager cost: probable cancelled villager (refund)|
|293.4|1|food|50.00|0.00|50.00|= villager cost: probable cancelled villager (refund)|
|318.8|1|food|40.00|39.46|0.54|stock rose slightly more than the carry drop|
|329.1|1|food|13.87|13.31|0.57|stock rose slightly more than the carry drop|
|368.0|2|food|6.52|0.00|6.52|no gatherer-type carry drop seen (probably carried by a villager whose master was not a gatherer type)|
|391.5|2|food|153.43|150.51|2.92|stock rose slightly more than the carry drop|
|401.6|1|food|34.34|33.74|0.61|stock rose slightly more than the carry drop|
|408.9|1|food|50.00|0.00|50.00|= villager cost: probable cancelled villager (refund)|
|461.0|1|food|18.54|17.85|0.69|stock rose slightly more than the carry drop|
|470.7|1|food|50.00|0.00|50.00|= villager cost: probable cancelled villager (refund)|
|491.9|1|food|55.54|54.84|0.70|stock rose slightly more than the carry drop|
|554.5|1|food|26.58|25.72|0.86|stock rose slightly more than the carry drop|
|576.7|1|food|50.00|0.00|50.00|= villager cost: probable cancelled villager (refund)|
|613.9|2|food|50.00|0.00|50.00|= villager cost: probable cancelled villager (refund)|
|644.6|2|wood|5.72|0.00|5.72|no gatherer-type carry drop seen (probably carried by a villager whose master was not a gatherer type)|
|658.6|2|wood|8.96|0.00|8.96|no gatherer-type carry drop seen (probably carried by a villager whose master was not a gatherer type)|
|692.7|2|wood|6.20|0.00|6.20|no gatherer-type carry drop seen (probably carried by a villager whose master was not a gatherer type)|
|820.0|2|wood|4.89|0.00|4.89|no gatherer-type carry drop seen (probably carried by a villager whose master was not a gatherer type)|
|869.4|1|wood|25.00|0.00|25.00|= house cost 25 wood: probable cancelled building (refund)|

Probable refunds: P1 275, P2 50. These are counted in the *_cum columns.

## Totals at 900 s

|player|measure|food|wood|stone|gold|total|
|---|---|---|---|---|---|---|
|P1 (ssapo)|cum positive stock change|2626|1758|0|30|4414|
|P1 (ssapo)|deposit-based|2378|1760|0|29|4168|
|P1 (ssapo)|spent (negative stock change)|2740|1751|0|50|4541|
|P2 (Maerlin_the_Mighty325)|cum positive stock change|2431|1732|0|0|4163|
|P2 (Maerlin_the_Mighty325)|deposit-based|2371|1722|0|0|4093|
|P2 (Maerlin_the_Mighty325)|spent (negative stock change)|2560|1735|0|50|4345|

Start stock both 200/200/200/100. Final stock P1 [86, 207, 200, 80], P2 [71, 197, 200, 50].

## Gap P1 - P2, cumulative positive stock change (includes refunds), 10 s samples

- **total**: lead changes (dead band +-10): 130s:P2 ahead, 160s:P1 ahead, 170s:P2 ahead, 200s:P1 ahead, 210s:P2 ahead, 240s:P1 ahead, 250s:P2 ahead, 270s:P1 ahead, 350s:P2 ahead, 370s:P1 ahead, 400s:P2 ahead, 450s:P1 ahead, 530s:P2 ahead, 540s:P1 ahead. Largest P1 lead +313 at 740s; largest P2 lead +152 at 400s; at 900 s +251.
- **food**: lead changes (dead band +-10): 130s:P2 ahead, 290s:P1 ahead, 350s:P2 ahead, 370s:P1 ahead, 400s:P2 ahead, 450s:P1 ahead. Largest P1 lead +388 at 740s; largest P2 lead +148 at 400s; at 900 s +195.
- **wood**: lead changes (dead band +-10): 160s:P1 ahead, 380s:P2 ahead, 900s:P1 ahead. Largest P1 lead +60 at 260s; largest P2 lead +191 at 540s; at 900 s +25.
- **stone**: lead changes (dead band +-10): none. Largest P1 lead +0 at 0s; largest P2 lead -0 at 0s; at 900 s +0.
- **gold**: lead changes (dead band +-10): 860s:P1 ahead. Largest P1 lead +30 at 880s; largest P2 lead -0 at 0s; at 900 s +30.

## Gap P1 - P2, deposit-based (no refunds), 10 s samples

- **total**: lead changes (dead band +-10): 130s:P2 ahead, 160s:P1 ahead, 170s:P2 ahead, 200s:P1 ahead, 210s:P2 ahead, 240s:P1 ahead, 330s:P2 ahead, 380s:P1 ahead, 390s:P2 ahead, 610s:P1 ahead. Largest P1 lead +167 at 740s; largest P2 lead +243 at 400s; at 900 s +74.
- **food**: lead changes (dead band +-10): 130s:P2 ahead, 290s:P1 ahead, 310s:P2 ahead, 380s:P1 ahead, 390s:P2 ahead, 500s:P1 ahead, 530s:P2 ahead, 540s:P1 ahead. Largest P1 lead +200 at 740s; largest P2 lead +237 at 400s; at 900 s +7.
- **wood**: lead changes (dead band +-10): 160s:P1 ahead, 380s:P2 ahead, 890s:P1 ahead. Largest P1 lead +58 at 260s; largest P2 lead +192 at 540s; at 900 s +38.
- **stone**: lead changes (dead band +-10): none. Largest P1 lead +0 at 0s; largest P2 lead -0 at 0s; at 900 s +0.
- **gold**: lead changes (dead band +-10): 860s:P1 ahead. Largest P1 lead +29 at 880s; largest P2 lead -0 at 0s; at 900 s +29.

Total gap every 60 s (cum / deposit-based): 60s +0/+0, 120s +7/+7, 180s -43/-42, 240s +30/+31, 300s +165/+66, 360s -7/-106, 420s -38/-179, 480s +45/-146, 540s +25/-166, 600s +223/-17, 660s +291/+127, 720s +273/+126, 780s +295/+139, 840s +166/+13, 900s +251/+74

# Animals killed 0-900 s (replay 518239882, from truth4.jsonl)

owner_player: for sheep = last human owner before death; for boar/deer (never owned) = the player whose villagers ate it. captured_s 0.5 = owned at the first log line. eaten_* = sum of carry increases of that player's shepherds (sheep) / hunters (boar, deer) standing within 1.5 tiles (ESTIMATE by attribution; the carry increases themselves are measured). decayed = food_at_kill - eaten (residual).

|id|type|owner_player|captured_s|killed_s|food_at_kill|eaten_by_p1|eaten_by_p2|decayed|carcass_gone_s|carcass_s|carcass_unattended_s|kill_x|kill_y|note|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|3661|sheep(1245)|1|0.5|28.3|100.0|85.8|0.0|14.2|87.8|58.0|0.0|22.7|51.4||
|3664|sheep(1245)|2|12.6|29.2|100.0|0.0|86.1|13.9|88.1|57.6|0.0|85.8|69.7||
|3668|sheep(1245)|2|12.6|89.7|100.0|0.0|89.1|10.9|131.9|40.9|0.3|87.1|71.3||
|3665|sheep(1245)|1|13.6|90.2|100.0|86.6|0.0|13.4|144.3|52.6|0.2|21.6|49.7||
|3666|sheep(1245)|2|12.6|132.8|100.0|0.0|89.1|10.9|173.6|39.4|0.2|86.0|70.5||
|3672|sheep(1245)|1|32.4|145.2|100.0|87.7|0.0|12.3|194.0|47.2|0.2|22.6|50.9||
|3673|sheep(1245)|2|13.6|174.5|100.0|0.0|78.9|21.1|256.1|80.3|44.5|85.8|69.7||
|3663|sheep(1245)|1|13.6|195.3|100.0|83.6|0.0|16.4|260.9|64.0|4.5|23.4|52.1||
|4018|boar(48)|2||217.8|340.0|0.0|302.3|37.7|333.1|114.0|0.0|84.3|70.3||
|4016|boar(48)|1||224.5|340.0|268.5|0.0|71.5|401.6|175.9|0.9|22.1|52.6||
|3669|sheep(1245)|1|70.0|264.7|100.0|83.2|0.0|16.8|329.1|63.0|0.7|20.9|51.2||
|3827|deer(2340)|2||293.9|140.0|0.0|107.8|32.2|441.9|146.6|51.5|83.3|71.1||
|4017|boar(48)|2||302.9|340.0|0.0|291.1|48.9|391.5|87.5|0.2|86.0|69.9||
|3671|sheep(1245)|1|32.4|330.2|100.0|83.1|0.0|16.9|395.1|63.3|0.0|20.2|51.1||
|3670|sheep(1245)|1|71.6|396.2|100.0|83.5|0.0|16.5|461.2|63.5|0.4|19.9|50.4||
|3675|sheep(1245)|2|112.2|396.4|100.0|0.0|82.8|17.2|461.5|63.5|0.0|87.1|72.0||
|4015|boar(48)|1||398.4|340.0|277.4|0.0|62.6|554.5|155.0|0.0|23.2|46.9||
|3828|deer(2340)|2||433.4|140.0|0.0|115.9|24.1|531.5|96.7|0.9|85.9|73.0||
|3667|sheep(1245)|1|13.6|437.6|100.0|86.0|0.0|14.0|491.9|52.9|0.4|20.2|49.0||
|3676|sheep(1245)|2|112.2|462.6|100.0|0.0|79.9|20.1|539.6|75.7|0.2|86.1|71.0||
|3674|sheep(1245)|2|13.6|541.8|100.0|0.0|85.4|14.6|599.7|56.5|10.7|85.7|69.2||
|3662|sheep(1245)|2|0.5|600.4|100.0|0.0|79.5|20.5|678.6|76.7|0.4|85.0|69.0|ownership flips: 575.4s P2->P1; 584.8s P1->P2|

## Per player

|player|sheep|boar|deer|food on killed animals|eaten|decayed|eaten %|
|---|---|---|---|---|---|---|---|
|P1 (ssapo)|8|2|0|1480|1225.5|254.5|82.8%|
|P2 (Maerlin_the_Mighty325)|8|2|2|1760|1487.9|272.1|84.5%|

Observed mean decay rate (decayed / seconds as carcass): sheep 0.261 food/s, boar 0.415 food/s, deer 0.231 food/s
