# P7: shepherd 4367 at 330 s (replay 518239882): from the attack on its sheep to the walk to the carcass

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. "asm" = `dz.py` or `out_r4/walk.asm`; "dec" = Ghidra
(`out_c/h1.c` Hunt, `out_c/h4.c` Attack, `out_r9/hunt_upd.txt`). Truth = `truth/truth4.jsonl`,
engine = `runs/pV.err`. Nothing was run; no new decompile was needed (`proj_p7` was copied but not used).

**Result in one paragraph.** The Hunt / Attack reaction to the sheep's death is the same in the
original and in the engine, and it happens in the same update (14552) for all shepherds. The proof is
the sibling shepherd 3424: it attacks the same sheep, turns to state 4 in the same update, and stays
bit-equal to the truth afterwards. The delay is specific to 4367 and is **exactly 4 updates
(4 x 28 ms), not 3**: in the truth 4367 stands on (20.9197311, 51.3552475) from update 14552 to 14557
and takes its first step in 14558; in the engine it stands 14552..14553 and steps in 14554; after that
the truth repeats the engine's positions bit for bit with a constant lag of 4 updates up to its arrival
at (19.878067, 51.68288). Four updates is the walk function's own pause: `level+0x34 = 0.1` with
`stop(line 0x192d)`, counted down by dt = 0.028 per update (0.072, 0.044, 0.016, then <= 0). So the
original's first path request of the new MoveTo (update 14553) ended in "no path, tries left -> pause
0.1 + stop", and the request repeated in 14557 found the path; the engine's request in 14553 produced a
path at once. No change under `GENIE_EXPERIMENT_HUNT_188329` is needed or justified. The candidate
change is R4's D6 (confirmed in asm, not implemented under any switch); whether D6 is the branch taken
here cannot be decided by reading, a trace is named in section 4.

## 0. Facts from the logs

Sheep: **3671** (master 1245) at (20.208334, 51.083332), player 1, state 2 up to the truth sample
329.957 s; at 330.181 s it is listed under player 0 with state 4, at 331.525 s state 5.
Engine: listed under player 0 from update 14551 (330.069 s), its action gone at 14552.
Shepherds of the same sheep (all player 1, Hunt-style action):

| unit | engine | truth |
| --- | --- | --- |
| 4346 | stands at (20.678, 51.682) from 14524, state 12 until past 14575 | same place; first food 331.077 s. The killer by inference: its Attack stays (state 2 "killed", waits for the swing sprite) |
| 4354 | stops at (20.7983, 51.0147) at 14547; state 4 at 14552, 6 at 14554, 7 at 14555 | same place; first food 330.405 s |
| 3424 | state 12 west along y = 52.2231; state 4 at 14552 at (20.80787, 52.2231); stands 14553; walks from 14554 | **bit-equal**: (20.764576, 52.21158) at 330.181, (20.5914059, 52.16549) at 330.405, ... |
| 4367 | see below | 4 updates late from 14554 on |

4367, engine (update: position, action state):
14547 (329.957): (20.814878, 51.315876) 12, last step west. 14548..14551: steps (+0.02097, +0.00787)
**east, still state 12** (new short path of the Attack's MoveTo after 4354 stopped in its way; truth
agrees, see next line). 14552: (20.919731, 51.355247) state 4. 14553: same place. 14554: first step,
same direction. 14561: (21.078066, 51.414696) = corner (4346.x + 0.4, 4354.y + 0.4). Then north along
x = 21.078066 to y = 52.0821 (= 4346.y + 0.4), west, south, arrival (19.878067, 51.68288) at 14659.
4367, truth: 329.957: (20.8148785, 51.315876). 330.181 (= update 14555): (20.9197311, 51.3552475) =
engine 14552/14553. 330.405 (14563): (21.0455551, 51.40248) = engine 14559. 330.629 (14571):
(21.0780659, 51.5490952) = engine 14567. 331.525: x 20.8988667 = engine at 331.413. Arrival place equal.
So: the truth also turned east before the death, stopped on the same point in the same update, stood
4 updates longer, then walked the same polyline.

Geometry at 14553 (obstacle boxes = centre +- 0.4 for standing villagers): 4354 [20.398, 21.198] x
[50.615, 51.415]; 4346 [20.278, 21.078] x [51.282, 52.082]; 4342 at (21.5887, 51.7847): [21.189, 21.989]
x [51.385, 52.185]; 3424, **standing since 14552** at (20.8079, 52.2231): [20.408, 21.208] x
[51.823, 52.623]. 4367 stands inside the boxes of 4354 and 4346; the free pocket next to it,
[21.078, 21.189] x [51.415, 51.823], is closed in the north by 3424's box. 3424 gets velocity in the
moving step of 14554, so its shape leaves the mesh at the end of its update 14554 (section 2, step 9).
At 14557 the corridor along x = 21.078 is open: that is the path the truth then takes.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Hunt update, state 12 (list code switch) | 0xbb6230; 0xbb6d96 call 0xb8ae30, 0xbb6da1..0xbb6dbd, 0xbb6dc3..0xbb6ea6 | `gathering/hunt/update.rs:93-160` `update_attack` |
| Hunt set_state(4) | 0xbb4a80 case 4 (dec `h1.c`) | `gathering/hunt/gathering.rs:42-88` `set_walk` |
| Attack update: target gone at the update's start | 0xb73f20; 0xb748f0..0xb74afd | `combat/attack/update.rs:172-193`, `target_died` 237-275 |
| Attack set_state (slot 16) clears its sub-actions | 0xb73530 | `combat/attack/states.rs:272-333` `finish` / `finish_in` |
| MoveTo destructor: unit stop (slot 0x618, line 0xe0), path cleared | 0xb92a70 (R2) | `HuntAction::tear_down` `gathering/hunt/drop_off.rs:193-203` -> `Mover::stop` |
| MoveTo start / update (state 3: path request, set_state(4) walks in the same call) | 0xb92c50 / 0xb93260 (R2) | `movement/move_to/sub_action.rs` |
| Walk function | 0x1210f60 | `movement/step.rs` `Mover::motion` |
| Walk entry: pause countdown, `stop` line 0x1272 | 0x1211049..0x1211064, 0x121112f..0x121114a | `movement/walk.rs:268` `paused`, step entry |
| Walk: no path, tries left -> pause 0.1 (slot 0x640), `stop` line 0x192d | 0x12143e7..0x1214480, 0x121590a..0x121592d | `movement/new_path.rs:51-95` `no_path` |
| Pause setter, slot 0x640 (`[unit+0x3f0]+0x34 = xmm1`) | 0x12191b0 | `level.pause_time` |
| Top level, near target: short pather, result 1 only; then tile planner | 0x121263a, 0x1212682..0x121270a, 0x12127e5 | `movement/request_plans.rs:125-180` `first_plan`, `near_target_path` |
| "Is moving", unit slot 0x610: velocity vector `[unit+0x400]` longer than 0 | 0x1218980 | `movement/waypoint.rs:562` `is_moving` |
| Shape refresh after the action list | 0x1226600 (called at 0x1139e46) -> 0x11203a0 -> 0x1120110 | `objects/unit/update.rs` `refresh_pathing` -> `pathing/mod.rs:366` `refresh` |
| "Can move" of a target (master type >= 30 and master slot 0xe8 > 0) | 0x10ba120 | `Placed::moves` |

## 2. The original's logic for this case, in execution order

1. Update K (engine 14551): the killing hit. The sheep's hit points reach 0 inside the killer's hit
   (R9 2.2 step 7e; not re-read). The sheep is still in state 2 for the units updated later in K.
2. Update K+1 (14552), the sheep's own update comes first (player 0): it leaves state 2 (R13).
3. Same update, every other shepherd, unit update 0x114c0f0 -> action list 0x11398c0 -> Hunt update
   0xbb6230, state 12: `code = 0xb8ae30(sub-action list)` (0xbb6d96) = Attack update 0xb73f20.
4. Attack update, before any walk (dec `h4.c`, asm 0xb748f0..0xb74afd): target id set, attack state
   != 2 and `target[+0x188] > 2` with a class other than 15 -> "gone". The unit AI forgets the target
   only if the target's player is not 0 or the attacker's class is not 4 (0xb74908 `cmp ax,4; je`,
   0xb74919 call 0xd38f90). Slot 0x68 with 0 (0xb74926), point = -1. Human, not Gaia (0xb74946,
   0xb74953): no AI, or AI order != -1 (0xb74970/0xb74975) with no queued order (0xb74989/0xb74990):
   stance byte 0, speed > 0 and class != 4 -> set_state(5); a villager (class 4, 0xb74a0b) or any
   other case -> quiet: no notify, `mov dl,1; call [vt+0x80]` = set_state(1), **`mov al,5`**
   (0xb74a5a..0xb74a99; the other branch 0xb74aa0..0xb74afb also ends in set_state(1), al = 5).
   set_state clears the Attack's sub-action list: the MoveTo's destructor stops the unit (velocity 0).
5. Hunt, code 5 (0xbb6dba `cmp ecx,1; jne` after the tests for 1, 2, 3, 4; codes 1, 2, 5 join at
   0xbb6dc3): hunt target null -> set_state(3); world setting `0xfa46c0(world+0x98) == 1` and target
   class 10 and queued orders > 0 -> set_state(1); else `0xbb2ae0` (decay check) and
   `mov dl,4; call [vt+0x80]` (0xbb6e93..0xbb6ea0) = **set_state(4) in the same update**. Return 0.
6. Hunt set_state(4) (dec `h1.c` case 4): timer 0, point = target position; `2 < target.state` ->
   MoveTo to the target, range = task+0x30, `+0x61 = 1`, quiet, list add -> MoveTo start(1):
   `0.01 < gap` and speed != 0 -> MoveTo state 3 (R2 2.2).
7. End of the action update (0x1139e46): 0x1226600: velocity is 0 -> the unit's shape is put (back)
   into the mesh at its place (0x1120110 with 1). This is how 3424's box appears at 14552.
8. Update K+2 (14553): MoveTo state 3: path request 0x120e560, set_state(4), walk 0x1210f60 in the same
   call (R2 2.2 step 7). Walk function, request on the new top level (type 2), R4 steps 14-30:
   a. target and way <= 10: short pather to the waypoint (0x121263a); only `result == 1` with length
      > 1e-7 counts (0x1212682 `cmp bl,1; jne`, 0x121268d `comiss`); else SHORT_FAILED (`[rbp-0x80] = 1`),
      path emptied. Re-read here: after a failure the code **falls through to the tile planner**
      (0x1212707 `test r15b,r15b; jne 0x121295f`, else 0x1212710.. call 0x1057a40 at 0x12127e5); this
      equals the engine (`request_plans.rs:139-142`).
   b. ... (R4 steps 22-28, not re-read).
   c. No path (R4 step 29, re-read): 0x12143e7 `cmp edi,1; jne 0x121445d` / `comiss range, to_end; jb`;
      then 0x121445d **`cmp dword [rbp-0x5c],0; jg 0x121590a`**: tries left -> `xmm1 = xmm14`
      (0x1211112: xmm14 = [0x3202890] = 0.1), slot 0x640 (0x1215914), slot 0x618 with line 0x192d
      (0x121591d..0x121592d), return. This test comes **before** `cmp [level+0x24], count-1; jge`
      (0x1214476..0x121447b), i.e. it applies at every waypoint of every level.
9. Updates K+3..K+5 (14554..14556): walk entry (0x121104b..0x1211064): `pause = pause - dt`;
   `> 0` -> `stop` line 0x1272, return 0 (0x121112f..0x121114a); else pause = 0 and go on.
   0.1 - 0.028 = 0.072, 0.044, 0.016: three paused updates. Meanwhile 3424 has velocity from the moving
   step of 14554 (slot 0x610 = `sqrt(v.v) > 0`, 0x1218980), so 0x1226600 removes its shape at the end
   of its update 14554 (0x1120110 with 0: `[unit+0x194]` shape released, set to -1).
10. Update K+6 (14557): pause -0.012 -> 0; the request runs again and finds the path; the walk sets
    the acceleration; the moving step of 14558 moves the unit. Truth: first new position in 14558.

Steps 3-7 are CONFIRMED by reading. Steps 8c-10 as code are CONFIRMED; that step 8 ends in 8c for
4367 at 14553 is INFERRED from the numbers (exactly 4 updates, same stop point, same later polyline,
3424 not delayed), not seen in the truth (no path-state blob for this unit after 180 s).

## 3. Confirmed differences from the engine's default behaviour

**None in the Hunt / Attack part.** Both sides, read:
- Attack: original section 2 step 4; engine `combat/attack/update.rs:185-193` (gone test with the same
  tree exception) and `target_died` 237-275: quiet -> target and point cleared, `finish` (set_state 1),
  `UpdateCode::Code5`. Same update, same code. (The engine returns "unsupported" where the original
  goes on: a quiet Attack of a non-villager, and a villager's target that is still player-owned when
  it dies, `update.rs:256-265`; in the original the first is set_state(5) or (1) with code 5, the
  second calls 0xd38f90 and goes on. Not reached here: the sheep is Gaia's from the killing hit.)
- Hunt: original steps 5-6; engine `gathering/hunt/update.rs:113-151`: codes 1 | 2 | 5 -> no target:
  search; else decay check and `set_walk` in the same update; `gathering.rs:42-88`: range = task range
  for a target past state 2, MoveTo added. Same.
- Stop and shape: MoveTo teardown -> `Mover::stop` (`drop_off.rs:193-203`, `waypoint.rs:512-530`);
  `refresh_pathing` every update after the actions (`unit_ai/unit.rs:61`, `pathing/mod.rs:366-390`,
  moving = velocity longer than 0, `waypoint.rs:562-567`). Same rule as 0x1226600 / 0x1120110.
- Timing: detection in 14552 on both sides (3424 bit-equal; 4367 stops on the same point).

**D6 (R4), re-read here, a confirmed code difference in the walk, not covered by any switch**
(`GENIE_EXPERIMENT_WALK_188329` is read only at `movement/waypoint.rs:437` and
`movement/request_plans.rs:339`):
- Original: section 2 step 8c (asm 0x121445d..0x1214480, 0x121590a..0x121592d).
- Engine: `movement/new_path.rs:66-94` `no_path`: inside `!FOUND || level.range < to_end` it tests
  `level.waypoint.at_or_past_last(..)` first; only there `continue_counter.left()` pauses
  (`stuck_pause`) and stops; at any earlier waypoint it sets `LevelFlags::REACHED` and returns
  `AfterRequest::Again`, so the request goes on with the next waypoint in the same update.
- Implementation (under `GENIE_EXPERIMENT_WALK_188329`, in `Mover::no_path`, original's order):
  ```
  if !flags.contains(PlanFlags::FOUND) || level.range < to_end {
      if walk_188329 && level.continue_counter.left() {          // 0x121445d, before the last test
          level.pause_time = Seconds::new(movement_tuning.stuck_pause);   // 0.1
          self.stop()?;                                                   // line 0x192d
          return Ok(AfterRequest::Paused);
      }
      if level.waypoint.at_or_past_last(level.points.len()) { ...unchanged... }
  } else if ...unchanged
  level.flags |= LevelFlags::REACHED; Ok(AfterRequest::Again)
  ```
  The MET_TARGET clearing above it stays first (0x12143c0..0x12143e2).
- What else it alters: every walker whose request finds no path at a waypoint that is not the last of
  its level (planned levels with several waypoints: long walks, group moves) while tries are left now
  stands 4 updates and spends one try per attempt instead of skipping the waypoint at once. With R4's
  D2 (try always spent, also not implemented) "skip the waypoint" remains only for a level out of tries.

## 4. Suspected, and the trace that decides it

S1 (the cause of this case). In the original the request of 14553 ended in step 8c. In the engine it
produced a path whose first leg points east to (21.078066, 51.414696), away from the sheep (WSW). A
partial short path must end nearer its goal than the start (P2 section 3-S), so the engine's goal for
that short path was not the sheep: the engine stood on a planned level (type 1, from the tile plan
after the failed near-target short path) with a waypoint east or north. Two readings remain:
- (i) D6: the short try for an earlier waypoint of that planned level found nothing; the engine
  skipped it (REACHED, Again) and found a path for the next one; the original paused. Then the change
  of section 3 is the whole fix.
- (ii) the original never got that planned level: its first tile plan (0x1057a40) was rejected or
  different (R16-D1 final choice rule, R4-D9 result sets, R16-D3 code 4; all unimplemented), the top
  level ended in `tile_again` -> no path -> pause at its last waypoint, which the engine's `no_path`
  already models. Then the fix is in the planner, and D6 alone will not move this case.
Trace to add (engine, unit 4367, updates 14552..14558), one line per call:
- `Mover::plan_solid` entry (`movement/request_plans.rs:88`): `REQ id tick levels=[l.level]
  wp=level.waypoint/points.len() tries state` .
- `near_target_path` (`:168`): `r`, `np.path.points`; `first_tile_plan` (`:211-216`): `r`, points,
  `farther`; `short_try` (`:349`): `goal`, `r`, points; `tile_again`: `r`, points, end, `np.end_gap`.
- `no_path` (`new_path.rs:51`): `flags`, `level.level`, `waypoint`, `points.len()`,
  `continue_counter`, branch taken.
Expected for (i): at 14553 `levels=[Planned, Top]`, a `no_path` with `waypoint` not last and tries
left, followed in the same update by a found short path. For (ii): no `no_path` at all at 14553.
The original's side of (ii) can be decided with one more truth capture that keeps the level blob
(`ps`) for player 1 units after 180 s: type, tries, pause of 4367's level at 330.181 s
(type 1 with pause 0.1 = (i); type 2 with pause 0.1 = (ii)).

S2. Killer = 4346 is inferred from the engine trace (its action stays in state 12 after the death)
and the truth's later first food; the truth has no attacker field. It does not change the result.

S3. The task's premise "the engine turned around right after 329.957 s" is not the death reaction:
the east turn at 14548 happens in state 12 on both sides (the truth stops on the engine's point).

## 5. Not read

- Inside the short pather and the tile planner for this geometry (start inside two boxes, closed
  pocket): not simulated; which request branch each side took at 14553 is not proven (S1).
- R4 steps 22-28 between the tile plan and the no-path block were taken from R4, not re-read.
- 0x120ee10 (ignore list) against `new_path.rs:189`: not compared; the engine's extra rule needs
  action state 8, not the case here. The unit's own ignore list is emptied by `stop` in the engine
  (`waypoint.rs:527`); whether 0x1224d50 empties `unit+0x1b0` in 188329 was not read.
- The hit that killed the sheep and the sheep's state change (R9, R13) were not re-read.
- Hunt `0xbb2ae0` (decay check) body; the computer-only block of Hunt state 12.
- The engine was not run; engine statements come from `runs/pV.err` and the source.
