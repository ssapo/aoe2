# P9: why 188329 finds no short path for villager 4367 at update 14553 (replay 518239882)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. "asm" = `dz.py` output kept in `out_p9/*.asm`
(`mesh.asm`, `speedctl.asm`, `setspeed.asm`, `vel.asm`, `setpos.asm`, `static_setpos.asm`,
`f1255c20.asm`, `pather.asm`); "dec" = `out/d3.c`. Engine traces: `runs/hD.err`, `runs/hB.err`.
Numeric check: `out_p9/h.py`. Nothing was run on the PC, no Ghidra run was needed (`proj_p9` not created).

**Result in one paragraph.** The mesh is NOT the cause. In both the original and the engine a unit's
shape is in the mesh while its velocity vector is 0 at the end of its own action update, and a newly
linked path only sets the acceleration; the velocity becomes non-zero in the velocity step of the next
update. So 3424's box is in the mesh during 4367's request at 14553 on BOTH sides (the engine's own
result proves it: with the box away the corridor along x = 21.078 is open and the result would be
Reached, as it is on its next request from the corner). The difference is inside the short pather: **in 188329 the start node's
estimate is the rectangle heuristic (0x107e350), in the engine (old build) it is the Euclidean distance
to the goal point.** The engine's Partial path `[start, (21.078066, 51.414696)]` exists only because the
single kept escape candidate (rect estimate 0.3697) is "nearer" than the start's Euclidean 0.7616 and
becomes the best node. With the start's rect estimate 0.2114 it does not; best stays the start node and
188329 returns result 3 with no points. Then: no path, tries left -> pause 0.1 + stop (D6, already under
`GENIE_EXPERIMENT_WALK_188329`), retry at 14557 when 3424 has left -> the truth. **No
`GENIE_EXPERIMENT_MESH_188329` switch should be added**; the change belongs under the existing
`GENIE_EXPERIMENT_SHORT_188329`.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Short pather | 0x107f7a0 | `pathing/short_path/main_loop.rs:337` `Search::run` |
| Start node (in range 3 / free 0 / escaped 1 / stuck 2) | 0x107e820 | `pathing/short_path/start.rs:64` `Search::start` |
| Estimate of a point (flag byte 0x3db29d5: 0 Euclidean, 1 rectangle) | 0x107e350 | `pathing/short_path/mod.rs` `Goal::heuristic` (`RECT_HEURISTIC`) |
| Start node's estimate = call of 0x107e350 | 0x107e8f8..0x107e90e | `start.rs:69-72` (inline Euclidean, no 188329 branch) |
| Popped-node test: best = strictly lower `f - g` | 0x107ce90 (0x107cec3 `cmp r9d,eax; jge`) | `nodes.rs` `pop_test` |
| Pather start result handling: 3 -> return 0; 2 -> return 4; `best = 0`, `goal = -1` | 0x107fb2f..0x107fb57 | `main_loop.rs:339-355` |
| Tail: no goal and best == 0 -> return 3, no points; else result 2, goal = best | 0x108122d..0x108124c | `main_loop.rs:362-365` |
| Shape refresh at the end of the action update (only caller 0x1139e49 in 0x11398c0) | 0x1226600 | `objects/unit/update.rs:330` `refresh_pathing` (called `unit_ai/unit.rs:61`) |
| Record flag + shape: `0x1120110(mgr, obj, flag != 0x10)`; record byte 3 high nibble = flag | 0x11203a0 | `pathing/mod.rs:366` `Pathing::refresh` |
| Shape add/replace (1) or release `[obj+0x194]`, = -1 (0) | 0x1120110 | `Pathing::refresh` / `removed` |
| "Is moving", unit slot 0x610: `[obj+0x400]` non-null and `sqrt(v0^2+v1^2+v2^2) > 0` | 0x1218980 | `movement/waypoint.rs:562` `Mover::is_moving` |
| Speed control of the walk (slot 0x680) | 0x1210b00 | `movement/walk.rs:279` `control_speed` |
| Set acceleration, unit slot 0x5f0 -> `[vel+0x14] = x` | 0x121ec30 -> 0x1075b50 | `v.acceleration.with_y` |
| Set speed, unit slot 0x5e0 -> `[vel+8] = x` | 0x121ecc0 -> 0x1075e00 | `walk.rs:250` `set_speed` |
| Velocity step: `[vel+8] = slot 0x628(accel*dt + speed)` | 0x1076000 (0x1076066..0x1076092) | `movement/step.rs:135` `step_velocity` |
| Stop, unit slot 0x618: slot 0x5e0 with 0, slot 0x5f0 with 0, `[obj+0x1b8] = 0` (0x1255e40) | 0x1224d50 | `movement/waypoint.rs:512` `Mover::stop` |
| Unit position setter, slot 0x60 -> static setter | 0x1224f60 -> 0x1245ac0 | `Mover::new_position` -> `objects/layers/mod.rs:63` `Static::new_position` |
| Other callers of 0x1120110: walk's temporary shape; leaving a container; slot 0x558 | 0x120ca10 (from 0x1214cfd); 0x1255c20; 0x1264680 | `add_temporary_shape`; `put_down`; not matched |

## 2. The original's logic, in execution order

### 2.1 When a unit's shape is in the mesh (CONFIRMED in asm)

1. End of every action update of a unit (0x11398c0 at 0x1139e49): `0x1226600(obj)`:
   `m = vt[0x610](obj)`; `m == 1` -> flag 0x10 else 0 (0x1226619..0x1226630);
   `0x11203a0(mgr, obj, flag)`: with a pathing record `[obj+0x1a0]`: `0x1120110(mgr, obj, flag != 0x10)`
   then `record[3] = (record[3] & 0xf) | flag`.
2. `0x1120110` with 0: shape `[obj+0x194]` released (0x10b9370), `[obj+0x194] = -1`; with 1: the box
   (master +0x78/+0x7c radii, or +0x128/+0x12c for obstruction type 0xb, times the constant at
   0x329cc70, around the decoded position) is added or replaced.
3. Slot 0x610 (0x1218980): `[obj+0x400] == 0` -> returns the pointer (0); else
   `sqrt(v[4]^2 + v[0]^2 + v[8]^2)`, `comiss; seta` -> 1 only when strictly above 0.
4. Who writes the forward speed `[vel+8]`: only slot 0x5e0 (0x1075e00; its only direct caller is
   0x121ecc0) and the velocity step (0x1076092). Slot 0x5e0 is called at 4 places in the binary
   (byte pattern `ff 9x e0 05 00 00`): 0x1210c5e (speed control, clipped turn, value 0 after
   slot 0x5f0 with -FLT_MAX), 0x1224d74 (stop, 0), 0xf44b05 and 0x10f05db (not in the walk; the group
   steering by the engine's reading, `groups/steer/slot_steps.rs:331`; bodies not read). The walk
   function 0x1210f60..0x1215ea1 has no call of slot 0x5e0 (`out_r4/walk.asm`).
5. The speed control 0x1210b00 otherwise only calls slot 0x5f0 (acceleration +FLT_MAX at line 0x1f1e
   / 0x1f80, -FLT_MAX at 0x1f38 / 0x1f67).
6. The position setters 0x1224f60 and 0x1245ac0 (read as a call list up to 0x1246800) never touch
   `[obj+0x194]` or `[obj+0x1a0]`.

Rule in updates, for a unit U that stops in its action update N and gets a new path in N+1:
- N: stop -> speed 0; end of U's action update N: not moving -> shape added at its place.
- N+1: path linked, walk -> acceleration only; end of U's update: still not moving -> shape stays.
- N+2: velocity step at the start of U's update: speed > 0, U moves; end of U's action update:
  moving -> shape released.
For 3424: in the mesh from the end of its update 14552 until its update 14554. 4367 (higher id) asks
in 14553 after 3424's update: the box [20.4079, 21.2079] x [51.8231, 52.6231] is present.

### 2.2 The short-path query of 4367 at 14553 (pather parts CONFIRMED; the geometry from the engine trace)

Query (`hD.err`): from (87743712, 215399520) = (20.919731, 51.355247) to (84759896, 214259024),
r = 838860 (0.2), half sizes 1258291 (0.3), rr = 2097151, range 0, own shape ignored.
1. 0x107e820: not in range (0x107e8e8 `cmp; jg`). Start node: g 0, **f = 0x107e350(p, goal)**
   (0x107e8f8 `mov rdx,r14; lea rcx,[rsp+0x68]; call 0x107e350`; result to node+4 at 0x107e90e),
   index = arena count, parent -1.
2. 0x107e350: `cmp byte [0x3db29d5], 0; jne` -> rectangle branch: `lx = |dx| - [goal+0x18]`,
   `ly = |dy| - [goal+0x20]`, negatives 0, `isqrt((ly*ly & ~0x3fffff) + (lx*lx & ~0x3fffff))`
   (0x96ce80). The byte is 1 in the image; its only references are three `cmp byte .., 0`
   (0x107dd02, 0x107e363, 0x108027a), no writer. Here: lx = 2983816 - 2097151 = 886665, ly < 0 ->
   **h(start) = 886663 (0.2114)**. (The Euclidean branch would give 3194352 = 0.7616.)
3. A shape holds the start (4354's and 4346's boxes): escape candidates; result 1 (escaped), only the
   cheapest stays open: (88407816, 215648864) = (21.078066, 51.414696) = (4346.x + 0.4, 4354.y + 0.4)
   (taken from the engine's path; the candidate scan was not re-read, P1 calls it already ported).
4. 0x107fb4f..0x107fb57: `best = 0` (the start node), `goal = -1`.
5. Candidate popped, 0x107ce90: `h = f - g = 1550768 (0.3697)`; `cmp h, best.f - best.g; jge` skip:
   1550768 < 886663 is false -> **best stays 0**. Not in range.
6. The search goes round the pocket [21.078, 21.189] x [51.415, 51.823] (walls: 4346 west, 4354 south,
   4342 east, 3424 north). Every point of it has x >= 21.078, i.e. rect estimate >= 0.3697 > 0.2114.
   No node becomes best, no goal.
7. Tail 0x108122d: `[rsp+0x50] = 1`; `cmp goal, -1; jne`; `test best, best; jne`; **`mov al, 3`**,
   return (0x108123f): result 3, no points.
8. Walk function (P7 section 2, step 8): no usable path at the top level and below it; tries left ->
   pause 0.1, stop line 0x192d. Retry at 14557: 3424's box is gone, the same candidate leads north
   along x = 21.078066 -> result 1 -> the polyline the truth walks 4 updates behind the engine.

## 3. Confirmed differences from the engine's default behaviour

**D1. The start node's estimate (decides this case). Not covered by any switch.**
- Original: 0x107e8f8..0x107e90e + 0x107e350 (section 2.2, steps 1-2): rectangle heuristic.
- Engine: `pathing/short_path/start.rs:69-72`: `f = cvttss2si(sqrt(fx*fx + fy*fy) * 2^22)` of the
  differences to the goal POINT (documented as the old build's `0x140fa4558`); no `build_188329()`
  branch in `start()`.
- Effect here (`out_p9/h.py`): engine best.h starts at 3194352; the popped candidate's 1550768 is lower
  (`nodes.rs` `pop_test`: `h < b.f - b.g`) -> best = candidate -> `main_loop.rs:364` Partial, path
  back `[candidate]`, start appended (`:421`) = the traced `[(20.919731, 51.355247), (21.078066,
  51.414696)]`. With 886663 the candidate is not best. That no other node beats 886663 follows from
  the engine trace itself: the engine's final best is the candidate (h 1550768), so no popped node and
  no vertex of `goal_test` had an estimate below 1550768; the start's estimate changes nothing else in
  an escaped search (the start node is never opened; `best` only selects the partial end).
- Implementation, in `Search::start` under `build_188329()` (`GENIE_EXPERIMENT_SHORT_188329`):
  `let f = if build_188329() { self.goal.heuristic(p).get() } else { <the Euclidean line> };`
  (`Goal::heuristic` already equals 0x107e350 including the masks and `isqrt`). Nothing else moves:
  the in-range test before it and the escape code after it stay.

**D2. No goal and best == start: result 3 with no points.**
- Original: 0x1081232..0x1081241 (`cmp [goal],-1; jne` / `test ecx,ecx; jne` / `mov al,3`).
- Engine: `main_loop.rs:362-365` returns `ShortFound::Partial` with `points = [start]` (`:397-399`
  free, `:421-423` escaped); no 188329 branch.
- Implementation, in `Search::run` under `build_188329()`, before the path back:
  `if self.goal_node.is_none() && self.best == NodeIndex::START { return Ok(ShortPath { result:
  ShortFound::Blocked, points: Vec::new() }); }`.
  For the walk this is the same outcome as today (`request_plans.rs:180` needs Reached; `:364-366`
  treats a path without length as blocked), so D1 alone moves the case; D2 makes the result code and
  the empty path exact for other callers.

**D3 (code only). A stuck start (0x107e820 returns 2) gives result 4.**
- Original: 0x107fb43..0x107fb4a `cmp eax,2; jne` / `mov al,4`. Engine: `main_loop.rs:346-350`
  `ShortFound::Blocked` (3). Both are `fails()`; no effect traced. Under `build_188329()`: `Invalid`.

**No difference in the mesh rule (the task's hypothesis is refuted).**
- Original: section 2.1. Engine: `refresh_pathing` after the actions every update
  (`unit_ai/unit.rs:61`, `objects/unit/update.rs:330-338`) with `MoveState::of_mover`
  (`movement/mod.rs:302-308`) = `Mover::is_moving` = velocity longer than 0 (`waypoint.rs:562-567`);
  `Mover::stop` zeroes speed and acceleration (`waypoint.rs:522-525`); a linked path / the walk only
  sets the acceleration (`walk.rs:279-316`; `set_speed` has one caller outside the walk,
  `groups/steer/slot_steps.rs:331`); the speed changes in `step_velocity` (`step.rs:144-154`) at the
  start of the next update (`movement/unit.rs:76`). So in the engine too 3424's shape 117 is in the
  mesh during 4367's request at 14553. Evidence in the trace: 3424's own request in 14553 lists
  `ignore_shapes=[ShapeId(117)]`, and 4367's result is Partial; with the box away it would be Reached
  through (21.078066, 52.0821), as its next request, from that corner, is (last 4367 line of `hB.err`).
- One timing detail differs without effect on other units: the engine releases a moving unit's shape
  already in the velocity step (`Static::new_position` -> `Pathing::moved`, `layers/mod.rs:74-76`,
  `pathing/mod.rs:331-335`), the original at the end of that unit's action update. Between the two
  only the unit's own actions run.

What D1 alters elsewhere: only which node is "best", i.e. the end of a result-2 path. With a goal that
has a size (rr > 0) the start's estimate drops by up to rr, so a partial path now needs an end whose
distance to the goal's grown box is below the start's; partial paths that end farther from that box
than the start (typically the lone escape candidate of a held start, or a detour corner in a closed
pocket) disappear and the unit pauses 0.1 s instead (with D6). For a point goal (half sizes 0, rr 0 in
188329) the rect estimate equals the Euclidean one up to integer rounding. Reached / in-range results
and the search order do not change (a free start is the only open node; an escaped start is never
opened). Why the positions before 330 s stay: every "backward" partial path the engine walked earlier
would have been a 4-update lead over the truth exactly like this one; the engine is bit-equal up to
330 s, so no such path was linked before (it can have been produced and discarded: the top level's
near-target request needs result 1 anyway). This is an argument, not a proof: see section 5's trace.

Expected engine flow at 14553 with D1 (not run): top level `near_target_path` fails as today ->
first tile plan -> Planned level as today -> `short_try` blocked -> `close_in` (straight line to the
waypoint passes 0.275 from 4354's centre, below 0.4) fails -> `Mover::no_path`, tries left, under
`GENIE_EXPERIMENT_WALK_188329` -> pause 0.1, stop (`new_path.rs:70-76`); 14554..14556 paused; request
again at 14557.

## 4. Suspected

- S1. The original's requests at 14553 go top level -> tile plan -> planned level -> short try, as in
  the engine. Not visible in the truth (no level blob for this unit); only the pause is.
- S2. The pocket is closed in the original exactly as in the engine (same boxes: all four units are
  bit-equal up to 14552). Taken from the engine's Partial result, not hand-simulated node by node.
- S3. The old build really used the Euclidean start estimate (engine doc comment only).
- S4. 0xf44b05 / 0x10f05db (slot 0x5e0 callers) are group steering; a grouped unit can get speed
  outside the velocity step. The four shepherds are not grouped (the engine reproduces 3424 bit for bit).

## 5. Not read / trace to confirm

- Not read: the escape-candidate scan of 0x107e820 after 0x107e9ca; the conditions of its return 2;
  0x1245ac0 beyond the call list (virtual calls 0xc8, 0xd0, 0x228, 0x4d0, 0x1f8 could reach the mesh);
  0x1264680 (slot 0x558); 0x1076000's slot 0x628; the tile plan and `close_in` for this request.
- No full node-by-node simulation was made: the proof uses the engine's traced result plus the one
  changed comparison (`h.py`).
- Trace to add (engine, diagnostics only): on the SHORTPATH line print `start_h_euclid`,
  `start_h_rect = goal.heuristic(start)` and `best_h` for results Partial. Count, up to update 14553,
  the Partial results with `best_h >= start_h_rect` that were linked (IGNORE/WALKWP of the same
  update). Expected: none before 4367 at 14553. After D1: OBJECT lines 14553..14558 must show 4367 on
  (20.919731, 51.355247) through 14557 and its first step in 14558.
