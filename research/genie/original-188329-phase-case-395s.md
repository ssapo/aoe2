# P8: the one-update lag of shepherds 3424 / 4346 at 394.8 s (replay 518239882)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Sources: `out_c/h1.c` (Hunt update decompile), `out_c/upd.asm`
(its disassembly), truth `truth/truth4.jsonl`, engine traces `runs/pY.err` (OBJECT, updates 16700+),
`runs/pW.err` (OBJECT, updates 14500..17200), `runs/fY.err` (RES after every update). Nothing was run,
no new decompile was needed (`proj_p8` was not created).

**Result in one paragraph.** No step of the drop-off / search / attack chain takes one update more in
the original. The lag comes from *which gatherer empties the sheep*. Four shepherds work on carcass
3671 (3424, 4346, 4354, 4367, updated in id order). In the truth the sheep falls below 0.1 during the
transfer of the THIRD one (4354) in update 16857: 4354 and 4367 leave state 7 in 16857, while 3424 and
4346 (already updated, sheep still > 0.1 after their transfers) only notice in 16858 (target in state 7
-> target cleared -> state 7 without target -> `set_state(8)`), one update later. In the engine the
sheep holds 3 transfers (3 x 0.00924 = 0.02772) less at that moment, so it already falls below 0.1 in
the transfer of the FIRST gatherer (3424) and all four leave in 16857. The engine's sheep is lower
because the engine's 4367 has been gathering **3 updates ahead of the truth ever since 333.3 s**: that is
the P7 case (truth 4367 pauses 4 updates on its walk at 330.1 s, the engine does not), which the runs
pW / fY / pY do not reproduce. Position comparison cannot see it (the unit stands), but the held amounts
and one RES sample do. The 188329 state-7 code and the engine's `gather` are the same rule; with 4367's
phase right the engine produces the truth's sequence by its existing code. **No change under
`GENIE_EXPERIMENT_HUNT_188329` or `GENIE_EXPERIMENT_MOVETO_188329` is needed or justified; the fix is the
P7 walk pause.**

## 0. Facts from the logs

Truth, 28 ms updates, sample every 8 updates (tick = engine update number with the same ms):

| tick / ms | sheep 3671 | 3424 held | 4346 held | 4354 held | 4367 held | food | 3670 workers (`+0x18c`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16802 / 393262 | 2.5598 | 0.54516 | 0.69300 | 0.93324 | 9.831777 | 216.149 | 0 |
| 16810 / 393486 | 2.1139 | 0.61908 | 0.76692 | 1.00716 | **10 (not dropped yet)** | **216.149** | 0 |
| 16818 / 393710 | 1.7991 | 0.69300 | 0.84084 | 1.08108 | 0.03696 (4 transfers) | 226.149 | 0 |
| 16850 / 394606 | 0.392428 | 0.988679 | 1.136519 | 1.376760 | 0.332640 (36 transfers) | 226.149 | 0 |
| 16858 / 394830 | 0, state 7 | **1.053359** | **1.201199** | 0 | 0 | 228.2727 (+2.1235) | **2** |
| 16866 / 395054 | gone | 0 | 0 | 0 | 0 | 230.5273 (+2.2546) | 4 |

At 16866 the truth's 4354 (20.7011318, 50.9589233) and 4367 (19.8810139, 51.57092) are **bit-equal to
the engine**; only 3424 and 4346 are one update behind. So the two units updated LAST are on time and
the two updated FIRST are late: the signature of "emptied by the third gatherer".

Per update the truth's sheep loses 4 x 0.00924 + 0.007 (decay 0.25/s) = 0.04396 (three sample intervals
of 0.35168). Sheep at the start of 16857 = 0.392428 - 6 x 0.04396 = 0.128668; after its decay 0.121668;
after 3424: 0.112428; after 4346: 0.103188; after 4354: 0.093948 < 0.1 -> emptied by 4354.
Check: 4354 drops 1.376760 + 6 x 0.00924 + 0.00924 + 0.093948 + 0.1 = 1.635388, 4367 drops
0.332640 + 6 x 0.00924 + 0.1 = 0.488080, sum 2.123468 = the truth's +2.1235. 3424 and 4346 hold exactly
7 transfers more than at 16850 (16851..16857) and nothing from 16858: sum 2.254558 = the truth's +2.2546.

Engine (`pY.err`, same in `pW.err`): all four go 7 -> 8 in 16857, 8 -> 4 in 16858 (food +4.578033 in
one step at 394830, `fY.err`), 12 in 16860, first step 16862. 4.578033 - (2.1235 + 2.2546) = 0.2000 =
two more "last bit" bonuses of 0.1 (storage 100 x 0.001): in the engine all four gathered from the
emptied sheep in 16857. Required for that: sheep before 3424's transfer < 0.10924, i.e. at least 0.0125
below the truth's 0.121668.

Where the engine's sheep lost it: 4367's phase.

| event of 4367 | engine (`pW.err`; `pY.err` equal from 16700) | truth (from held) |
| --- | --- | --- |
| arrives at (19.878067, 51.68288), state 7 | update 14659 (333.258 s), first transfer 14660 (333.291 s) | held 0 at 333.357 s, 0.07623 = 7 transfers of 0.01089 (33 ms updates) at 333.588 s -> first transfer 333.390 s = **3 updates later** |
| full, state 8 / deposit | 15734 / 15735 (363.301 s, RES +10) | 9.844642 at 363.189 s -> reaches 9.9 at 363.357 s, deposit 363.385 s: **3 later** |
| full, state 8 / deposit | 16807 / 16808 (393.430 s, RES +10) | 9.831777 at 16802 -> 9.9057 at 16810 (held 10, food still 216.149 in the sample of 393.486 s) -> deposit 16811: **3 later** |
| first transfer of the last load | 16812 | 16815 (36 transfers by 16850) |

The other three are in phase to the update (engine state 8 at 16739 / 16723, state 7 at 16701; truth
transfers counted back from 16850: 107, 123, 149 -> first transfers 16744, 16728, 16702 = engine state 7
+ 1). So by 16857 the engine's 4367 has taken 3 x 0.00924 = 0.02772 more of this sheep (both delivered
full loads of 10 before): engine sheep before 3424's transfer in 16857 = 0.121668 - 0.02772 = 0.093948
-> 3424 leaves 0.084708 < 0.1 -> emptied by the first gatherer; in 16856 the fourth transfer left
0.100948 (not below 0.1): exactly the engine trace. Total engine food = truth + 0.2: also matches.

The same in-place cycle (unit inside the town centre's footprint, no walk) is on record for 3424
(16739..16744) and 4346 (16723..16728) and equals the truth to the update: state 8 at T, deposit and
`set_state(4)` at T+1, MoveTo "in range" T+2, `set_state(6)` T+3, `set_state(7)` T+4, first transfer T+5.
That rules out candidates (a)-(d) of the task as base-cycle differences.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Hunt update | 0xbb6230 | `gathering/hunt/hunter.rs` `hunt_targets`, `hunt_part`; `hunter_strike.rs` `hunt_strike`; `update.rs` `HuntAction::update` |
| Prelude: target state >= 7 -> set_target(0) | 0xbb6321 `cmp byte [target+0x188],7; jb` skip, 0xbb6332 slot 0x68 with 0 | `hunter.rs:57-75` (`ObjectState::Undead < s` -> release, `set_target(None)`) |
| State 7 without target or task | 0xbb7125 / 0xbb7132 `je 0xbb775c`; 0xbb7778 `comiss held,0.0; jbe` -> state 3, else `mov dl,8` | `update.rs:72-78` (`ends_without_target` -> `HuntNext::Drop` / `Search`) |
| State 7 transfer | 0xbb7291..0xbb7757 | `gathering/hunt/gathering.rs:283-339` `gather`; write-back `update.rs:371-382` |
| take = min(target amount, rate x work value x dt) | 0xbb72b9 slot 0x270, 0xbb72c3, 0xbb72d0, 0xbb72e6..0xbb72ee `minss` | `gathering.rs:292-297` |
| gain > room -> `set_state(8)` | 0xbb73b6 `comiss gain,room; jbe` go on; 0xbb73c9 `je 0xbb7749` | `gathering.rs:301-307` |
| target loses the take | 0xbb741c target slot 0x110 | `gathering.rs:308` |
| last bit: `0.1 > target amount` -> gain += master[+0xb0] x 0.001 + amount; target emptied | 0xbb7426 (0x3202890 = 0.1) `comiss; jbe` skip, 0xbb7465..0xbb747d (0x31fe7cc = 0.001), 0xbb74a2 | `gathering.rs:310-313` (`REMAINDER`, `LAST_BIT`) |
| stay only if `0.1 <= abs(held - capacity)` and `0 < target amount`, else `set_state(8)` | 0xbb7731 `comiss 0.1,over; ja 0xbb7749`; 0xbb773b `comiss 0.0,[target+0x168]; jb` return; 0xbb7749 `mov dl,8; call [vt+0x80]` | `gathering.rs:334-338` |
| Dead object with nothing held -> state 7 | not read in 188329 (truth: state 7 in the sample of 16858) | `objects/lifecycle/mod.rs:249-266` `dead` (own update: `amount <= 0` -> `Removed`) |
| Walk: no path, tries left -> pause 0.1 (P7 / R4 D6) | 0x121445d, 0x121590a..0x121592d | `movement/new_path.rs:66-78` (under `GENIE_EXPERIMENT_WALK_188329`) |

## 2. The original's logic for this case, in execution order (CONFIRMED in decompile + asm above)

1. Update 16857, Gaia first: the carcass decays (0.007).
2. 3424 (state 7): take = min(amount, 0.00924); gain <= room; target -= take (0.112428); `0.1 > amount`
   false; over = |held - capacity| >= 0.1 and amount > 0 -> stays in state 7, returns 0.
3. 4346: the same (0.103188), stays.
4. 4354: target -= take (0.093948); `0.1 > 0.093948` -> gain += 100 x 0.001 + 0.093948, target emptied;
   `0 < amount` false -> `set_state(8)`: MoveTo to the town centre, start in range -> MoveTo state 1.
5. 4367: take = min(0, ...) = 0; `0.1 > 0` -> gain += 0.1 + 0; `set_state(8)`.
6. Update 16858: the carcass is in state 7 (truth sample). 3424, 4346: prelude `target state >= 7` ->
   set_target(0); state 7 without target, `0 < held` -> `set_state(8)` (no transfer, no bonus). 4354,
   4367: MoveTo returns 1 -> deposit (+2.1235), prelude cleared the target -> D8 search -> 3670
   (workers 2), `set_state(4)`.
7. Update 16859: 3424, 4346 deposit (+2.2546) and take 3670 (workers 4). Everything after is the
   engine's present chain shifted by one update (truth first step 16863 against the engine's 16862).

## 3. Confirmed differences from the engine's default behaviour

**None in this chain.** Each step of section 2 has the same rule in the engine (table in section 1,
both sides read). The engine reaches a different branch only because its sheep amount differs:
- emptied by the first instead of the third gatherer in 16857 (section 0 arithmetic, reproduces the
  engine's trace and its +0.2 food);
- cause: 4367's transfers start 3 updates early since 333.29 s (engine 14660, truth 333.390 s).

**Carried over from P7 (confirmed there, decides this case): the truth's 4367 stands 4 updates longer
at 330.1 s** (first step 14558 against 14554). `pW.err` shows the engine stepping in 14554, and the later
phase (state 8 at 15734 and 16807) is identical in `pW.err`, `pY.err` and the RES steps of `fY.err`
(363.301 s, 393.430 s). So the runs that carry `GENIE_EXPERIMENT_WALK_188329` (D6 pause at any waypoint,
`new_path.rs:66-78`) still do not pause 4367 at 14553: P7's reading (ii) (the original never got the
planned level; the difference is in the tile planner / first plan, R16-D1, R4-D9, R16-D3) is now the
likely one. That is INFERRED from the unchanged phase; no OBJECT trace of the current switches covers
14550..14560.

Implementation note: nothing in `gathering/hunt/` or `movement/move_to/`. When 4367's pause of P7 is
reproduced, its first transfer moves to 14663, its deposits to 363.385 s and 393.514 s, and updates
16857..16866 follow the truth by the existing code (`hunter.rs:57-75`, `update.rs:72-78`,
`lifecycle/mod.rs:254-259`). The 88 s cycle is untouched (no code change).

## 4. Suspected

- S1. The 3-update figure at 333 s (walk lag 4 updates of 28 ms, gather lag 3 updates of 33 ms) is
  derived from held amounts and the dt change during the walk, not from a truth state field.
- S2. Other units may carry the same kind of invisible phase offset from earlier transients; positions
  cannot show it. The first visible symptoms here were: truth sample 393.486 s (4367 held 10, food
  216.149) against engine food 226.149 at 393.430 s; before that only held amounts differ.

## 5. Traces to add (engine, read-only diagnostics)

- Add `"held": u.life.amount` (and the object state) to the OBJECT line
  (`crates/tools/genie-oracle/src/census.rs:240`) and compare with the truth's column 3: any gatherer
  whose held differs by a whole number of transfers is out of phase. For 4367 expect +0.0327 from
  333.3 s (3 x 0.01089), i.e. engine 0.1089 at 333.588 s against the truth's 0.07623.
- `GENIE_TRACE_OBJECTS_RANGE=14550-14562` with the current switches: 4367 must stand on
  (20.919731, 51.355247) through 14557 and step in 14558. If it steps in 14554, P7 is open; then P7's
  REQ / `no_path` trace (out_p7/case_330s.md section 4) decides between its readings (i) and (ii).

## 6. Not read

- 188329: where a dead object with amount 0 goes to state 7 (own update or inside slot 0x110); the D8
  search, retarget, Attack start and MoveTo start for this case (not needed: 4354 / 4367 already match
  the engine bit for bit through them); the walk / planner code behind P7.
- Engine: no run was made; the engine's held amounts are derived from its state trace and RES, not
  printed. Which switches fY / pY / pW ran with is taken from the task text, not from a log.
