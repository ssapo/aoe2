# P30: player 1 position mismatch at 580.8 s (replay 518239882) = forager 3416, tile planner's final choice (R16-D1)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Truth = `truth/truth4.jsonl` (v4: id, master, state, held,
x, y, timers; no waypoints). Engine runs (frozen default exe, 20 default switches):
`runs/P30_1` (OBJECT, all objects, updates 22800-23500 = 561.9-580.9 s) and `runs/P30_2` (OBJECT of
3416 + STEER/PATHS, updates 22700-24100 = 559.4-598.5 s). Hand simulation: `out_p30/plan.py`
(+ `grid.py`; copies `runs/P30_plan.py`, `runs/P30_grid.py`; output `out_p30/plan_out.txt`).

**Result.** The first P1 object that differs is villager 3416 (master 354, forager) at
**571007 ms** (update 23148): truth (21.626709, 47.373290), engine (21.551498, 47.328369); at
570783 ms both stand exactly on (21.5, 47.5). No other P1 object differs in position, held,
master or state between 561.9 s and 580.9 s (6980 object samples). The cause is the already
documented but never implemented difference **R16-D1**: the tile planner 0x1057a40 chooses between
its two paths (search over the levels / search on the tiles) by a different rule than the engine.
For the walk of 3416 from the town centre to fruit bush 3443 (25.5, 36.5), planned at ~568.7 s,
the engine takes the tile-search path (west of mill 4379), the original takes the levels path
(east of the mill). Both planner paths were reproduced with a Python port of the engine's planner
on the truth's objects: the tile-search path equals the engine's plan point for point, the levels
path equals the waypoints seen in the truth.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Tile planner entry | 0x1057a40 | `pathing/tile_path/planning.rs:108` `Planner::plan` |
| Search over the levels (path1 at rbp-0x60, result r12b) | call 0x1057bcf -> 0x10527c0 | `planning.rs:23` `search_over_levels`, called `:122` |
| "Tile search not run" = 5 (r14b) | 0x1057bd8 | `second = None`, `planning.rs:123` |
| Search on the tiles (path2 at rbp+0x4f0, result r14b) | 0x10533b0 | `planning.rs:273` `search_on_tiles`, called `:141` |
| **Final choice** | **0x1057ea9..0x1057fa7** (`out_p30/choice.asm`) | **`planning.rs:157-162`** |
| Measure / last point / a - b / append | 0x106eca0 / 0x106f250 / 0x96e820 / 0x106ee40 | `Path::measure`, last point, -, `Path::append` |
| Caller: first tile plan of a top level | walk function 0x1210f60 | `movement/request_plans.rs:196-216` `first_tile_plan` (radii = target radius + unit radius), `movement/long_walk.rs:225-262` `tile_plan_for` |

## 2. The original's logic for this case, in execution order

Situation (truth sample 568627 ms): 3416 at (21.635, 49.205) drops food at the town centre; bush
3449 (24.5, 37.5) was used up at 566.8 s (state 8 at 566822, gone at 567047; stump 4437, master
415 `STUMP`, radius 0, no obstruction). Blocking objects near the way: TC annex 618 [22,24]x[48,50],
tree 3436 at tile (17,47), mill 4379 (master 68, radius 1) [25,27]x[39,41], bushes 3447/3443/3445 at
tiles (24..26, 36) and 3441 at (25,37). Request (engine trace `P30_2.err` line 6411-6412, update
~23063): from (21.619368, 49.004356) to the target (25.5, 36.5), radii = 0.2 + 0.5 = 0.7, range 0,
full (human player), target = box (bush 1059: obstruction type 2 in the dat; the engine's box kinds are 2/10/11/13).

1. 0x10527c0, search over the levels (path1). Port result (`plan_out.txt`): start cell = level-3
   cell (2,6); node chain (3,(2,6)) -> N (3,(2,5)) -> E (3,(3,5)) -> N (1,(13,19)) -> N (1,(13,18))
   = goal-marked 2x2 cell [26,27]x[36,37]; code 1. Points:
   `(21.619, 49.004) (21.5, 47.5) (24.5, 44.5) (27.5, 39.5) (26.5, 37.5)`, length 13.819.
2. Gate of the tile search (0x1057bdb..0x1057caa, R16): range 0, full, first == 1, start tile has
   edges, goal tile has none but the target is a box with a passable neighbour, 35 > 13.8 -> run.
3. 0x10533b0, search on the tiles (path2): goal tiles (24,35) (25,35) (26,35) (24,37) (26,37);
   reaches (24,37) down column x = 24 west of the mill; code 1; 16 raw points, length 14.518.
4. Smoothing 0x1059760 on both: path1 unchanged; path2 becomes
   `(21.619, 49.004) (21.5, 47.5) (23.0, 42.5) (24.5, 37.5)` (one straightened stretch of 10.44
   with one inserted point), length 11.949.
5. **Final choice, asm 0x1057ea9..0x1057fa7** (read here again, `choice.asm`): both measured
   (0x106eca0 x2); `rbx = last(path2)`, `rax = last(path1)` (0x106f250); goal = (dx, 0, dy) at
   rsp+0x70; `xmm7 = range*range; maxss 1.0 [0x369ff64]; addss radii(xmm12)` -> lim = 1 + 0.7 = 1.7;
   `e1 = |last(path1) - goal|^2` (0x96e820, then `[4]^2 + [0]^2 + [8]^2`); `comiss lim, e1; jae` ->
   F = `len1 [rbp-0x5c] >= len2 [rbp+0x4f4]`; else `e2 = |last(path2) - goal|^2`,
   F = `lim >= e2` (0x1057f35..0x1057f68); `cmp r14b(second), r12b(first); cmovbe` -> path2 is
   taken iff `second <= first && F` (0x1057f81..0x1057f97), else path1 (0x1057f9e) and the return
   value is `first` (0x1057fa7).
   Here: last(path1) = (26.5, 37.5): e1 = 1 + 1 = 2.0 > 1.7; last(path2) = (24.5, 37.5): e2 = 2.0 >
   1.7 -> F = false -> **path1 (levels)**.
6. Walk with the levels plan `[start, (21.5,47.5), (24.5,44.5), (27.5,39.5), (26.5,37.5)]`
   (all three legs seen in the truth, 20-28 samples each):
   - 568.9-570.78 s: to (21.5, 47.5) (direction (-0.0791, -0.9969)); at 570783 exactly on it.
   - 571.0-575.9 s: direction exactly (0.7071, -0.7071) to (24.5, 44.5) (4.24 tiles).
   - 576.1-581.2 s: direction (0.6332, -0.7740) = toward (27.2, 41.2), the mill's corner (27, 41)
     grown by the radius 0.2; then direction (0.1738, -0.9848) = (0.3, -1.7) to (27.5, 39.5)
     (583.5 s): the short path `[(24.5,44.5), (27.2,41.2), (27.5,39.5)]` to the third plan point.
   - 583.7-586.9 s: direction (-0.4921, -0.8706) = (-1.3, -2.3) to (26.2, 37.2), the bush's
     corner; gathering from 587163 (held 0.0898).

## 3. Confirmed difference

**D1 (= R16-D1 / R12-D3): the final choice between the levels path and the tile path.**

- Original: asm 0x1057ea9..0x1057fa7 (section 2 step 5): take path2 iff
  `second <= first && (lim >= e1 ? len1 >= len2 : lim >= e2)`, `lim = max(range^2, 1) + radii`.
- Engine: `pathing/tile_path/planning.rs:157-162`: path1 iff
  `second.unwrap_or(OffMap) != first || levels.length < tiles.length`, i.e. path2 iff
  `second == first && len1 >= len2`. No switch exists under `pathing/tile_path/`
  (`grep 188329|EXPERIMENT` there: nothing).
- This case: first = second = 1, len1 13.819 >= len2 11.949 -> the engine takes the tile path.
  Engine trace: the planned level has 4 points (`IGNORE ... levels=[(Planned, WaypointIndex(1), 4,
  true), (Top, ..)]`, `P30_2.err` 6411), the second SHORTPATH query goes from (21.5, 47.5) to
  **(23.0, 42.5)** (line 9342; walked level `[(21.5,47.5), (22.25,45.0), (23.0,42.5)]`), and at
  (22.25, 45.0) the look-ahead jumps to the last point (24.5, 37.5) and the tail path goes to the
  bush (line 10702: `(22.25,45.0) (24.697,38.6) (26.436,38.6) (26.436,37.8) (26.2,37.2)`). These
  are exactly the port's smoothed tile path `(21.5,47.5) (23.0,42.5) (24.5,37.5)`.
  The engine arrives at (26.2, 37.2) earlier: held 0.1697 against the truth's 0.0898 at 587163 ms
  (+0.0798 food), kept until at least 598.5 s.
- One-sentence symptom: from 571007 ms 3416 leaves (21.5, 47.5) in direction (0.2874, -0.9578)
  toward (23.0, 42.5) in the engine but in direction (0.7071, -0.7071) toward (24.5, 44.5) in the
  original; the two are 3.1 tiles apart at 580.5 s ((24.097, 40.168) against (26.755, 41.743)).

**Implementation** (new switch `GENIE_EXPERIMENT_PLANCHOICE_188329`; `planning.rs`,
`Planner::plan`, replace lines 157-162 only; both paths are already measured at 154-155):

```rust
let (chosen, result) = if plan_choice_188329() {
    // 188329 0x1057ea9..0x1057fa7
    let goal = BVector::new(req.to.x(), 0.0, req.to.y());
    // 0x106f250: the last point, or the zero point for a path under 2 points
    let end = |p: &Path| if p.points.len() >= 2 { p.points[p.points.len() - 1] } else { BVector::ZERO };
    let e = |v: BVector| { let d = v - goal; d.height() * d.height() + d.x() * d.x() + d.y() * d.y() };
    let r2 = req.range.get() * req.range.get();
    let lim = (if r2 > 1.0 { r2 } else { 1.0 }) + req.radii.get();      // maxss, addss
    let f = if lim >= e(end(&levels)) { levels.length >= tiles.length } else { lim >= e(end(&tiles)) };
    // `second <= first` on the codes 1, 2, 4, 5: only second == Goal && first == Goal can hold
    if second == Some(Found::Goal) && first == Found::Goal && f {
        (&tiles, Found::Goal)
    } else {
        (&levels, first)
    }
} else { /* lines 157-162 as they are */ };
```
with `fn plan_choice_188329() -> bool` as a `OnceLock` flag like `short_path/mod.rs:183-186`.
(`second <= first` unsigned: second is 5 when not run, else 1/2/4 and the tile search only runs
when first == 1, so the condition is `second == 1`.)

Expected with the switch (not run: no build allowed): plan
`[start, (21.5,47.5), (24.5,44.5), (27.5,39.5), (26.5,37.5)]`; the look-ahead
(`movement/waypoint.rs:282-314`) keeps the plan points because the straight lines
(21.5,47.5)->(27.5,39.5), (24.5,44.5)->(27.5,39.5) and (24.5,44.5)->(26.5,37.5) cross the mill's
box; short path to (27.5, 39.5) round (27.2, 41.2); tail to the bush from (27.5, 39.5) (all levels
on their last waypoint -> goal = target, the existing `GENIE_EXPERIMENT_WALK_188329` tail).

## 4. Suspected

- S1. The later P1 mismatches (resources +10 food at 616.6 s, word 4 at 653.3 s, word 9 at 696.6 s)
  probably follow from 3416 arriving earlier (0.08 food ahead) and walking through the foragers
  west of the mill instead of east of it; not traced.
- S2. The port's grid is built from the truth's objects, not dumped from the engine: objects with
  obstruction type 2/10/11/13 and class != 0 block the tiles of their box; terrain taken as
  passable; smoothing test = segment against the boxes grown by 0.2. That it returns the engine's
  plan point for point (incl. the inserted (23.0, 42.5)) and the truth's waypoints supports it.
- S3. The original's plan is inferred from positions (truth4 has no waypoints): its last point
  (26.5, 37.5) is not seen directly, only that the last leg starts at (27.5, 39.5) and ends on
  the bush's corner.
- S4. `box`: the original reads `*(byte*)target[+0x1a0] == 3`; the engine derives it from the
  obstruction kind (`long_walk.rs:237-245`). Same result here (tile search ran in the engine).

## 5. Not read / not done

- The engine was not run with the change. The 188329 searches 0x10527c0 / 0x10533b0 / 0x1059760
  were not re-read here (R16 `out_r16/tile_planner.md` found them equal to the engine's; the port
  is of the engine's code). 0x111d8e0 / 0x111d0c0 (smoothing's segment test) unread.
- No trace line exists for the planner's two paths; a diagnostic line in `Planner::plan`
  (`first`, `second`, both point lists, lengths, e1, e2, choice) would confirm on the engine side.

## 6. What else the change affects

Only plans where the tile search ran (range 0, human player, levels search reached the goal, path
under 35, goal tile without edges and a box target with a passable neighbour, or a goal tile with
edges) and reached the goal:
- goal tile with edges: path1 ends on the goal point, e1 = 0, rule = `len1 >= len2` on both sides:
  no change;
- box target on a tile without edges (resources, trees, buildings): where the levels path ends on a
  tile centre with e1 > 1 + radii (e.g. diagonal to a 1x1 resource: 2.0 > 1.7), the original takes
  the tile path only if that one ends within 1 + radii (a 4-neighbour tile, e = 1.0), whatever the
  lengths; the engine takes the shorter. So every villager walk to a tree / bush / mine / building
  planned from more than a few tiles away can change route when both ends are diagonal tiles (then
  always the levels path) or when only the tile path ends on a 4-neighbour (then always the tile
  path, even if longer).
- Deer flight and reach tests (target NULL or not full) are unaffected (R16).
