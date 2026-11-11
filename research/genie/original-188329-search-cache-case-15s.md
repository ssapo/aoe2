# P13 – the 15.067 s burst (replay 518470161, update 991): 7 extra AI draws

Run prefix c1_. Engine traces (all 12 switches, $G/runs/):
- c1_a: as given (SEARCH_CLEAR=tick from go.ps1) + AIUPD + ANIMAL + OBJECTS 985-993 + `RUST_LOG=genie_core::draws=trace` (every RNG step), -Updates 993.
- c1_b: same + PATHS, STEER 989-991 (no reach test is run for 9656's search).
- c1_c: **`GENIE_EXPERIMENT_SEARCH_CLEAR=unit`** (any value but tick/never = the engine's default arm) + AIUPD + ANIMAL + OBJECTS 985-1100, -Updates 1100.
- c1_d: SEARCH_CLEAR=unit, OBJECTS 1-1700 (next-earliest mismatch; see section 7).
Helper scripts (PC VM, ~/w13, copies here in w/): `well.py` (engine WELL512 step, its inverse, setSeed), `ext.py` (AI-stream draws + AIUPD/ANIMAL lines per seed_all block).

## 0. Result

The 7 extra draws are not extra draws in an idle check: **truth 9656 runs the evade branch (no draw)
instead of the random branch (1 draw)**, because its search finds player 1's scout 9389 (1.72 tiles away).
The engine's search does not find it because it **reuses 9655's search lists** (search cache, 9655
searched 2 tiles away just before): go.ps1's `GENIE_EXPERIMENT_SEARCH_CLEAR=tick` clears the cache only at
the first full unit-AI update of an update. 188329 clears it at the entry of **every** unit-AI update
(0xd42a00, unit AI vtable slot 0x20). One draw less at 9656 shifts every later idle draw of the tick by
one, which changes which animals wander (truth: 10 wanders of 3 draws, engine 7) — the remaining +6.

With SEARCH_CLEAR=unit (c1_c): 9656 evades to (112.534355, 54.289486) = truth target bit for bit
((112.53435516357422, 54.289485931396484)), the tick's AI draws are 65 = truth's, and
`cmp_pos.py runs/c1_c.err` = **no position difference for any object from update 985 to 1100 (16.484 s)**.
Draw counts before update 991 are unchanged (9655 draws_before 4549 in c1_a and c1_c).

## 1. How the truth's draws were assigned (exact, from the RNG)

- The AI stream is reseeded twice per update (WorldStep::Reseed; 2 seed_all blocks, k = 2u-1, 2u). From
  c1_a's draw trace, the World stream's seed_all draw at k=1981 (update 991) is the AI seed 1634719017;
  `set_seed` + the engine step (well.py) reproduce the engine's draws 4549.. exactly, and give the
  values beyond the engine's last draw of the tick (seq1981.txt, idx i = draw 4549+i).
- The truth snapshot cannot be inverted into update 991 (the second seed_all of the update overwrites
  the state), so the truth's draws were assigned from the truth's outcomes:
  - retarget timer `o[6]` = 750 + rand15 % 500 (retarget.rs:95): truth 9658 862 -> 1011 = idx **3**
    (unique in idx 0..80); truth 10096 1165 -> 1174 = idx 43. Engine: 9658 idx 4 (956), 10096 idx 44 (779).
  - wander targets (r%7 == 0, steps (n%6 -> 1..3 / -3..-1)): truth 10075 (3,-1) = idx 14-16, 10090 (2,3) 29-31,
    10091 (2,2) 32-34, 10092 (-2,-3) 35-37, 10095 (-2,3) 40-42, 10096 (-1,1) 44-46, 10098 (3,-2) 48-50,
    10101 (-2,-1) 53-55, 10104 (1,-3) 58-60, 10106 (-2,3) 62-64. Every other hunted animal draws one
    non-multiple of 7 at the index left for it.
  - So truth: idx0 seed, 9655 idx1, **9656 none**, 9657 idx2 (r%7=5, stays), 9658 idx3, 10062.. one each.
    Engine: 9655 1, 9656 2 (r%7=5), 9657 3 (r%7=0, far -> home), 9658 4, ... (shift +1 from 9656 on).
- truth 9656's target (112.53435516357422, 54.289485931396484) is not its origin (it has stood on
  (112.5,56.5) since 3.1 s): it is the evade point away from scout 9389 (player 1, master 448), which
  stood at (112.473282, 58.21902) at 15054 (gaia updates before player 1). The engine's evade with
  that scout position gives the same point bit for bit (c1_c `ANIMAL_EVADE`).
- Count: truth 65 draws in the update's first block (idx 0..64) vs engine 60; the counter in `airng`
  (+0x18) moves by +7 (303-304 -> 310-311), within its +-3 sampling jitter of +5 (the truth samples
  are taken at varying points in the update: offsets 296..306 over 590-990).

## 2. Address table (188329)

| address | what |
|---|---|
| 0x3244ac8 slot 0x20 = 0xd42a00 | unit AI update (158041 0x140c66b10) |
| 0xd42a3f / **0xd42a49** | at entry, unconditional: `mov [0x1442bddc0],0`; **`mov [0x1442bddc4],0` (search cache holds := 0)** |
| 0xd43de8, 0xd43e37 | inside 0xd42a00: `call [vt+0x240]` (idle check; hunted = 0xcfcbd0) |
| 0x3244ac8 slot 0x50 = 0xd3fdd0 | unit AI search query (158041 FUN_140c63e20) |
| 0xd3fec0..0xd3feeb | d² from the last place ([0x143db0228],[0x143db022c]) > 25.0 ([0x143225018]) -> query |
| 0xd3feed..0xd3fef4 | else if holds ([0x1442bddc4]) != 1 -> query; else skip (reads the last lists) |
| 0xd3ff35..0xd3ff48 | query: holds := 1, place := (x, y) |
| 0xd39390 (no pdata) | other writer: holds := 0 with 0x42bddc0/c8 (a reset; not read further) |
| 0xd22c20 | target search: slot 0x50 at the unit's place, then ClosestObject over the 5 lists, reach test unit slot 0x408 (0.1) when arg 8 = 1 |
| 0xcfcbd0 | hunted idle: search found -> 0xd26200 evade, **no draw**; else rand15 (0x12a) ... (out_p12/a1.c) |

Only writers of 0x1442bddc4 (xr.py over .text): 0xd42a49 (0), 0xd3ff35 (1), 0xd39390 (0).

## 3. Original's logic

1. Each unit-AI update (vtable slot 0x20, 0xd42a00) starts by letting the search cache go
   (0x1442bddc4 := 0), whatever the unit and whatever it then does.
2. A search (slot 0x50) queries when the cache does not hold or the place is more than 5 tiles from
   the last query's place; a query holds the cache and sets the place; otherwise it reads the last lists.
3. So within one unit-AI update, consecutive searches reuse (e.g. a lion's two searches); across units,
   the cache survives only between searches made outside unit-AI updates (action updates) of units
   whose unit-AI update does not run in between.
4. Hunted idle (0xcfcbd0): 9656's search queries fresh at (112.5,56.5) radius 3, finds scout 9389, evades
   (no draw); 9655's search (2 tiles south) did not include it.

## 4. Confirmed differences

D1 (CONFIRMED both sides). Engine `genie-core/src/unit_ai/unit.rs` lines 513-528 (`Unit` AI step, the
`GENIE_EXPERIMENT_SEARCH_CLEAR` match): with `tick` (set by runs/go.ps1 and CONTINUE's default env) the
cache is cleared only at the first full update per world time; 188329 clears it at every unit-AI update
entry (0xd42a49). The engine's default arm (`_ => c.w.spatial.forget_search()`) already is the 188329
rule. Evidence: c1_a ANIMAL_SEARCH for 9656 found=None with no SHORTPATH/reach call (c1_b), i.e. the
cached lists from 9655's query (rect y <= 57.9) lacked the scout at y 58.22.

Implementation note (no source change needed):
- Run 188329 cases without `GENIE_EXPERIMENT_SEARCH_CLEAR=tick` (drop it from runs/go.ps1 and from the
  default env in CONTINUE.md 104 / local-windows-handoff.md 47), or pass any other value
  (`GENIE_EXPERIMENT_SEARCH_CLEAR=unit`) in -Envs (go.ps1 applies -Envs after its defaults).
- If a named switch is preferred: in unit.rs's match add
  `_ if std::env::var_os("GENIE_EXPERIMENT_SEARCH_188329").is_some() => c.w.spatial.forget_search(),`
  as the first arm (before `Ok("never")`), i.e. the 188329 rule wins over `tick`.
- Nothing in `unit_ai/idle_animals.rs` changes; the GRAZE_188329 code is not touched.

## 5. Suspected
- S1: the engine's clear sits before its alive/inside checks (`turn.is_some() && unit_ai.contains &&
  after.is_none()`); 0xd42a00's is at its entry. Equivalent only if the engine's full-update gate is
  exactly the set of units whose slot 0x20 runs (AI_ORDER_188329 models that; dead units not checked).
- S2: the 518239882 shepherd case (original-vs-engine-518239882.md, "탐색 캐시 원인") that motivated `tick`
  predates AI_ORDER_188329; with all 12 switches `unit` and `tick` give byte-identical RES and the same
  checkpoint results there (section 7), so `tick` is no longer needed for it (presumably AI_ORDER_188329
  now decides which units run their unit-AI update).

## 6. Not read
0xd39390's caller; 0xd26200 internals beyond its result (the engine's EVADE_188329 point matches);
the unit's per-update order between action update and unit-AI update (0x114c0f0).

## 7. Other situations the change affects
Every search through slot 0x50 (hunted/lion/boar idle searches, retarget/attack searches, action-side
ClosestObject such as gather/hunt re-search) in an update where several units search within 5 tiles:
with `tick` the second and later units read the first one's lists (wrong place, wrong radius); with the
188329 rule each unit-AI update queries anew. Searches made from action updates still reuse the last
lists until the next unit-AI update starts.

Measured (all 12 switches + GENIE_TRACE_RES; "tick" = g1_* runs, "unit" = c1_* runs):
- 518470161 narrow: c1_d (OBJECTS 1-1700) `cmp_pos` = **no position difference for any object up to
  24.284 s** (before: 18 objects at 15.119 s, 10086/10103 at 20.124 s).
- First checkpoint-word mismatch (s), P1 / P2, tick -> unit:

| replay | word 7 | word 2 (masters) | word 9 | word 10 (ids) | checkpoints hold | other |
|---|---|---|---|---|---|---|
| 518470161 | 60.7 / 60.7 -> **307.7 / 171.2** | 307.7 / 125.7 -> 307.7 / **411.7** | 112.7 / 125.7 -> **307.7 / 216.7** | 307.7 / 125.7 -> 307.7 / **242.7** | 8 / 8 -> **46 / 25** | P2 word 1 223.2 -> 288.2, word 6 125.7 -> 606.7; RES identical to 180.7 s; stops 95944/96041/95123 -> 88579/88946/87665 |
| 518239882 | 384.8 / 426.8 (same) | all first-mismatch times identical | | | 32 / 33 (same) | RES identical over the whole run; only word 9 values after 766.5 s differ |
| 517426097 | 230.4 / 249.9 (same) | all first-mismatch times identical | | | 34 / 37 (same) | RES identical over the whole run (242296 lines); same stop updates |
