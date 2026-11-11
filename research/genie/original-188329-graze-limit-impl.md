# g1 – GENIE_EXPERIMENT_GRAZE_188329 (hunted animal's graze limit, 0xcfcbd0)

Source: out_p12/case_early_gaia.md (D1). Engine edits (uncommitted, in place; CRLF kept):

| file | change |
|---|---|
| genie-core/src/unit_ai/idle_animals.rs | `graze_188329()` OnceLock flag; `GRAZE_REACH = 0.1`; `graze_lets(side, to, leash)`; `hunted_wander`: before the leash move, the home move and the wander |
| genie-core/src/unit_ai/side.rs | `UnitSide::graze_limit()` (default 0.0) and `UnitSide::reach_length(to, range)` (default None) |
| genie-core/src/unit_ai/world_view/side.rs | `graze_limit`: master's last task with action kind 6, its `wait_time` (+0x1c), else 0; `reach_length` -> `Mover::reach_length` |
| genie-core/src/movement/path_end.rs | `Mover::reach_length`: copy of `reach_test` for a point, start = unit place `at` (wrapper 0x120fec0 passes +0x3bc, not +0x824), returns the length |
| genie-core/src/pathing/long_path/{mod.rs,cost.rs} | `Searched::Ran.cost`; `long_path::reach_length`; `LongCost::get` |

Behaviour (switch on, `0 < v`, v = graze limit):
- wander / home: `reach_length(point, 0.1)` None or `len > v` -> `IdleOutcome::Idle` (= original's return 5, 0xcfce3e), draws already used.
- leash: None or `!(v >= len)` (0xcfcf76 `comiss v,len; jb`) -> `hunted.origin := at.position` (0xcfd003..0xcfd0b3; local copy too), fall through to the search.

## The length (read in 188329)
- Short pather branch (0x107ac6c..0x107ac85): `FUN_14106eca0(path)` then `*len = path+4`.
  0x106eca0: `path+4 = 0`; for consecutive points p[i-1], p[i] of the path vector (+0x438..+0x440, 12-byte x,h,y),
  `d = p[i] - p[i-1]` (0x96e820), `sum += sqrt(d.h² + d.x² + d.y²)` — = engine `Path::measure` (x²+h²+y², bitwise equal since the
  first add is commutative). The path is the one the short pather wrote (cleared by it; first point = start). E.g. a (2,1) step
  gives 2.1368754 = |(2,1)| − 0.1 (range).
- Long pather branch (0x1078d60, arg 9 = len ptr, no path object): InRange-for-point (0x1079196) writes 0 and returns 1;
  reached: `*len = (float)cost[tile]` (cvtdq2ps of the int at +0x38420), tile = the heap top popped this iteration
  (0x107a144 when that tile is the goal / within reach; 0x107a0a3 when a step onto the goal tile ends the search: still the
  popped tile's cost, not the goal's 0). Not reached: writes something but returns 0 (fails anyway).
  Cost units are quarter tiles squared + walked, so a long-pather success is almost always > 4 -> refused.

## Verification
- build OK (Finished, same 8 warnings).
- g1_t (518470161, 590-1000, all switches): 10075 at tick 604: `ANIMAL_GRAZE to=(79.5,21.5) limit=4 len=None` -> no move;
  10075 matches until 15.119 s. New earliest diffs: 18 objects at 15119 ms (the 15.067 s burst, S1 of out_p12):
  9656, 9657, 10074, 10075, 10089, 10090, 10091, 10092, 10094, 10095, 10096, 10098, 10099, 10101, 10102, 10104, 10105, 10106.
- Full runs: see final report tables (g1_239/161/097 with GRAZE, g1_*r without).

## Unconfirmed
- InRange of a target (not used here) writing 0; whether +0x810 is reset when a master has no Graze task (slot 0x968
  callers not read; engine reads the current master each time).

## Full runs (before = REWALK on, GRAZE off: g1_*r; after = both on: g1_*)
Word 7 first mismatch (s) P1 / P2, first resource diff > 0.01 (s) P1 / P2:

| replay | before w7 | after w7 | before res | after res | other |
|---|---|---|---|---|---|
| 518239882 | 384.8 / 426.8 | same | 411.182 / 450.931 | same | RES + CPWORDS byte-identical |
| 518470161 | 60.7 / 60.7 | same | 320.255 / 180.908 | same | all first-mismatch times same; RES differs from 494.5 s, CPWORDS values from 112.7 s (word 9 value only); stop updates 92074/92819/91128 -> 95944/96041/95123 |
| 517426097 | 230.4 / 249.9 | same | 323.996 / 280.524 | same | RES identical |
