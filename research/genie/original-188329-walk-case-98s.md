# P2: the micro-step at 98.244 s (replay 518239882, sheep 3670)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. "asm" = `out_r4/walk.asm` / `dz.py`, "dec" = Ghidra
(`out/mv.txt` walk, `out/d3.c` short pather, `out_p2/a.c` planner registry). Truth =
`truth/truth4.jsonl` (level blob `ps`, fields as in `out_r4/walk_function.md`).

**Result.** The short pather is not the cause and the walk of a 2-point path in the same update
is not the cause. The cause is the level the request is made from. In the original the sheep has
been on its **top level (type 2)** since 96.194 s, because a walked level linked with kind 2 that
reaches its end unwinds every level down to the top one (R4's D1, asm 0x1211c43..0x1211d37). A
type-2 request whose path is shorter than 0.01 runs the tile planner again (asm 0x1213401..) and
that discards the 0.0051 path -> no path -> pause 0.1 + stop (line 0x192d). In the engine the
kind-2 hand-over pops one level only (`movement/waypoint.rs:430-438`), so the sheep still stands
on its **planned level (type 1)**; `plan_solid` runs `tile_again` only for `WaypointLevel::Top`
(`movement/request_plans.rs:115-120`), the 0.0051 path is linked and walked. Fix: implement D1.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Walk function | 0x1210f60 | `movement/step.rs` `Mover::motion` |
| Arrived level, link kind 2: drop + unwind to type 2 | 0x1211c43..0x1211d37 (asm) | `movement/waypoint.rs:418` `Mover::arrived`, `MovesOn` arm `:430-438` |
| REACHED with AT_WAYPOINT: slot 0x60 set position to the waypoint | dec `mv.txt:105-118` | `Mover::arrived`/waypoint step (same) |
| Too-short gate after the short try (`count < 2 || length < 0.01`) | 0x121376b..0x1213790 | `movement/path_points.rs:119` `too_short` |
| Tile planner again (type 2 only) | 0x1213401..0x12136d8, 0x1213ee3..0x121403e | `movement/request_plans.rs:448` `tile_again`, gate `:115-120` |
| end_gap of the short path (xmm10) | 0x121309e..0x12130ce | `request_plans.rs:354-355` `np.end_gap` |
| No path: tries > 0 -> pause 0.1, stop 0x192d | 0x121445d..0x1214480 | `movement/new_path.rs:51` `no_path` |
| Short pather wrapper (old pather when radius > 0.5; include list only for the old pather) | 0x1078690 | `movement/long_walk.rs:395` `short_path_including` |
| Short pather, tail (goal / best, path back, smoothing) | 0x107f7a0 (dec `d3.c`, my extract lines 671-860) | `pathing/short_path/main_loop.rs:337` `Search::run` |
| Popped-node test (best = lowest h, strict) | 0x107ce90 | `nodes.rs:350` `pop_test` |
| Polygon vertex goal test (best by squared rect distance) | 0x107dcf0 | `nodes.rs:249` `goal_test` |
| Start-ray callback (clip box, 3 -> 2) | 0x107b270 -> 0x107cfb0 (ret value asm 0x107d1ae..0x107d1fa) | `raycast.rs:131` `Callback::Box` |
| Planner getter (unit) | 0x120d210 -> 0x1058020 / 0x1058250 | `movement/request.rs:379`, `pathing/mod.rs:293` `planner` |
| Planner lookup by Gaia's master's restriction values | 0x10581a0 -> 0x10543d0, 0x1058070 | `pathing/mod.rs:275` `planned_for` |
| Planner registration (masters 83; 83 + 535) | 0x1058a20, 0x1058cd0 -> 0x1058ac0 -> 0x1058ba0; 0x1058fc0 on attribute 0x140 | `world/setup.rs:99` `register_planners` |

## 2. The original's logic for this case, in execution order

Truth states of 3670 (level blob; `parent` = +8, `type` = +0x14, `tries` = +0x38, `pause` = +0x34):

| ms | current level | parent ptr | path |
| --- | --- | --- | --- |
| 78740..96169 | type 0 | 0x20dd1e12e60 | walked levels; 83129 jumps from q1 straight to the goal (step 9 of R4: only with a type-1 parent) |
| 96169 | type 0, link 2, flags 3 | 0x20dd1e12e60 | `[(19.8786, 48.8535), (19.8792, 48.8693)]`, length 0.0158 |
| 96194 | **type 2**, tries 9, pause 0.1 | 0 | top path |
| 96319.. | type 0, link 2 | **0x20dd1e12eb0** | 3-point short paths, each directly under the top level |
| 98219 | type 0, link 2 | 0x20dd1e12eb0 | `[(19.879166, 48.974342), (19.879166, 49.1875), (20.379166, 49.1875)]` |
| 98244 | type 2, tries 9, pause 0.1 | 0 | pos y = 48.9918442 |
| 98353 | type 2, tries 8, pause 0.1 | 0 | pos unchanged (3671 stands 0.0044 ahead) |

1. 96169 -> 96194: the 0.0158 level (kind 2, made under the type-1 level 0x..2e60, where no
   0.01 rule applies) ends: state 4 -> `cmp eax, 2` (0x1211c43): drop it, `parent.state = 2`
   (0x1211c7c). The parent's path does not loop (`test byte [path+0xc], 1`, 0x1211c93), the class
   is not 0x13 (`cmp r15w, 0x13; je`, 0x1211cb3), the level is not type 2 (`cmp byte [rax+0x14],
   2; je`, 0x1211cd2): loop 0x1211ce0..0x1211d35: parent null -> restart; else free the level,
   current = parent, `[parent+0x28] = 2`, until `byte [cur+0x14] == 2`. The sheep is on its top
   level from here on (truth: type 2, later children have parent 0x..2eb0, not 0x..2e60).
2. 98244, walk on the 3-point level: hit 3671 is kept (step 33/35 of R4) -> temporary shape for
   3671 at (20.0600243, 49.5969467), `parent.state = 2`, level dropped (single drop), restart.
3. Request on the type-2 level (step 16-24 of R4): try spent (10 -> 9); first tile plan; short
   try with the goal (20.479166, 49.1875), range 0. Short pather (same logic as the engine, see
   3-S below): start free (2 units left of 3663's low-x side 83379266), start ray touches 3663 at
   t = 0, L legs give a side node on 3663's low-x side, the cluster outline has the concave vertex
   V = (83379266, 205508090) = (19.879166, 48.99695) where 3663's low-x side meets 3671's low-y
   side; V is nearer the goal than the start (d2 0.3963 < 0.3983), no node is in range: result 2,
   path [start, V], length 0.0051. FOUND, PARTIAL, end_gap = |goal - V| = 0.6295 (0x12130ce).
4. `FOUND -> 0x121376b`: `count < 2` or `comiss 0.01, [path+4]; ja` -> 0x12133e4. Way 0.631 < 1
   -> not the long pather -> 0x1213401: `(FOUND == 0 || count < 2 || length < 0.01) && byte
   [level+0x14] == 2 && switch` -> planner = 0x120d210(unit, target) (exists: master 1245 has
   terrain restriction 7 like the villager, read from `data/empires2_x2_p1.dat`) -> tile planner
   0x1057a40 into a scratch path (0x12135db). e = ground |waypoint - scratch.last|:
   - `comiss e, way; jbe` (0x1213652): e > way -> the new path is emptied (0x121368d..0x121369d).
   - else `test r, 0xfa; jne` / `cmp r, 1` (0x1213ee3) and `comiss end_gap, e; jbe skip`
     (0x1213f24): r not in {0, 4, 5} and e < end_gap -> the scratch path replaces the new path,
     PLANNED = FOUND = 1, measured, created = now; `comiss 5.0, [path+4]; jbe keep` (0x121400d):
     shorter than 5.0 -> emptied, FOUND = 0.
   An empty scratch reads the zero point (e ~ 53 > way), a tile centre is farther than way or
   nearer than end_gap, the goal point gives e = 0: every outcome but a plan of 5 tiles or more
   empties the path. (Which of them it was is not visible in the truth and does not matter.)
5. No path (count < 2): `cmp [rbp-0x5c], 0; jg` (0x121445d): tries 9 > 0 -> slot 0x640 pause 0.1,
   stop line 0x192d, return. Truth: tries 9, pause 0.1, y = 48.9918442.
6. 98353: the same with 3671's real shape 0.0044 ahead: one try spent (9 -> 8), pause 0.1. A
   linked path would have reset the tries to 10 (step 30), so the path was rejected before the
   link. This is the proof that the rejection is in the request, not in the walk.

3-S. Short pather parts read for this case (188329): tail of 0x107f7a0: `goal == -1`: `best == 0`
(the start node) -> return with no points; else result 2 and goal = best; path back skips a point
equal to the last one pushed; start appended; smoothing with half the radius. 0x107ce90: best =
popped node with strictly smaller `f - g`. 0x107dcf0: a vertex beyond range or not cheaper than
the goal becomes best when its squared rect distance `< (best.f - best.g)^2 >> 22`. 0x107cfb0:
ray box (grown by 1 on a degenerate axis) intersected with the shrunk shape must be non-empty,
then 0x1084210, result 3 -> 2, last hit's shape and side. All equal to the engine's code.
There is no minimum length or improvement in the pather.

## 3. Confirmed difference

**D1 (= R4's D1, now proven by the truth log to matter here). Link kind 2 unwinds to the top
level.**
Original: asm 0x1211c43..0x1211d37 (section 2, step 1); truth 96169 -> 96194 (parent pointer
0x..2e60 before, type 2 / parent 0x..2eb0 after).
Engine: `movement/waypoint.rs:430-438`: `MovesOn` removes one level, sets the parent to
`WantsPath`, moves a looping parent on. No unwinding. No existing switch covers it (grep: no
`188329` in `waypoint.rs`, `step.rs`, `request*.rs`).
Consequence here: the engine's requests at 96.2..98.3 s are made by the planned level;
`request_plans.rs:105` (first plan) and `:115-120` (`tile_again`) need `WaypointLevel::Top`, so
the 0.0051 path survives; `tile_again` itself (`:448-494`) equals the original (every branch
would empty a 0.0051 path), which is why the engine cannot have run it.

Implementation, under a new switch `GENIE_EXPERIMENT_WALK_188329`, in `Mover::arrived`, arm
`LinkedPathKind::MovesOn`, in the original's order:
```
remove(0); parent.state = WantsPath;
if parent.has_path && parent.path_flags.contains(LOOPS) {
    parent.waypoint = parent.looping_next(parent.waypoint);          // no unwinding
} else if walk_188329() && walker's class != 19 (trade cart, 0x13) {
    while self.paths.walked()?.level != WaypointLevel::Top && self.paths.len() > 1 {
        remove(0); self.paths.walked_mut()?.state = PathState::WantsPath;
    }
}
return Next::Again
```
(The original tests the current level's type before each drop and stops when there is no
parent.) Kind 1 and kind 3 stay as they are. The class is the walker's master class
(`[master+0x38]` decoded, 0x121109a..0x12110d1); `arrived` needs it passed in.

What else it alters: every non-trade-cart walker whose kind-2 level (a partial short path, or a
path linked as "not found") reaches its end while a planned (type 1) level lies between it and
the top level. Afterwards that walker asks from the top level: first tile plan, `tile_again`, the
top level's tries and its 0.01 rule, instead of a short path to the planned level's waypoint.
Walkers whose kind-2 level is dropped by a kept hit (single drop, step 35) are not changed.
Expected at 98244 with the change: request by Top, short path [S, V] found, `too_short` ->
`tile_again` empties it -> `no_path` -> `pause_time = 0.1`, stop; y stays 48.991844.

## 4. Suspected / to check after the change

- S1. The engine's level stack at update 6234 was not traced. It is inferred: truth has a type-1
  parent from 78.7 s, positions agreed, and the engine code cannot keep a 0.0051 path on a Top
  request. Trace line to confirm, in `Mover::request` (`movement/request.rs:59`) for walker 3670:
  `eprintln!("REQ id={:?} levels={:?} wp={:?} tries={:?}", me.id, self.paths.iter().map(|l|
  l.level).collect::<Vec<_>>(), level.waypoint, level.continue_counter)`. Expected now:
  `[Planned, Top]`; after D1: `[Top]`.
- S2. After D1 the top-level requests at 96.2..98.2 s use the first tile plan. Truth: level flags
  stay 0 (never NEAREST) and every child is a type-0 level with link 2, so the original's tile
  plan there is not "result 2 and not farther" and has fewer than 3 points. If the engine's
  planner returns something else the paths change earlier; trace line in `tile_again` and
  `first_tile_plan`: `(r, other.points, end, w.distance, np.end_gap)`.
- S3. With requests on Top, R4's D2 (try always spent) and D6 (pause before the last-waypoint
  test) become reachable for this sheep; truth tries go 9, 8, 7, 6 with one failed request per
  0.125 s, the engine's `spend_try` should give the same for a non-looping walk.
- S4. Planner registry (read, not needed here): planners live in a hash multimap keyed by player
  id (FNV-1a), registered for Gaia and for players with attribute 0x140 > 0; 0x1058020 looks up
  under Gaia with the restriction of **Gaia's** master of the unit's id (`short [master+0xa6]`
  into the table `world+0x790`), 0x1058250 under the unit's own player (attack-move special).
  The engine keys by restriction values only. Same result for restriction 7 units.

## 5. Not read / not done

- The query was not simulated bit for bit through the outline trace (0x1082ff0, 0x1081ab0); the
  result [S, V] is the engine's, the original's pather logic around it was read as equal, and
  the truth shows the same kind of 2-point path (96169) being produced by the original.
- 0x1057a40 (tile planner) was not read; its result at 98244 is not needed for the conclusion.
- Step 32 (reach test result 2 -> REACHED + AT_WAYPOINT -> restart) was taken from R4; only the
  REACHED block (`mv.txt:105-118`) was re-read: the original can also snap and ask again in the
  same update, as the engine does.
- Slot 0x60 (0x1224f60, set position) body not read.
- The engine was not run; `runs/sh.err` lines 4733-4736 are the engine evidence.
