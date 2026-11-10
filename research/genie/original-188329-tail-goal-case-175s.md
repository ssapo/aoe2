# P4: last path point at 170.7 s / 175.3 s (replay 518239882, villager 4364 -> tree 1191)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. "asm" = `out_r4/walk.asm` (line numbers of that file) or
`dz.py`; "dec" = Ghidra `out/d2.c`. Truth = `truth/truth4.jsonl` (level blob `ps`, waypoints `wp`).
Numeric reproduction: `out_p4/sim.py` (the pather's 2^22 fixed point).

**Result.** The cause is R4-D4, nothing in the tile planner. In the original, the tail short-path
try of the walk function asks the short pather for the **target object's current position**
(107.5, 0, 59.5) instead of the level's waypoint when a target exists and every level of the stack
that holds a path is on its last waypoint (asm 0x1212df3..0x1212ef5). Because the goal then equals
the target's position, the dispatcher 0x1078690 leaves the target's own shape in the mesh and
passes its half sizes; the ray from the corner node (106.2, 61.2) toward the tree's centre crosses
the tree's own shape (tree box grown by the unit's radius, high-y side y = 60.2) at x = 106.96470:
that crossing is a side node in range 0 of the goal box and ends the path. Truth bits
`0x42D5EDEE, 0x4270CCCD` are reproduced. The engine asks the waypoint (106.5, 60.5) (the tile
planner's end, a tile centre), with the tree's shape ignored, so its path ends on that point.
`GENIE_EXPERIMENT_WALK_188329` today only covers R4-D1 (`movement/waypoint.rs:437`); D4 is not
implemented under any switch.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Walk function | 0x1210f60 | `movement/step.rs` `Mover::motion`; request in `movement/request.rs:59-124` |
| Tail short try: "all levels on last waypoint" loop | 0x1212df3..0x1212e29 (walk.asm 1708-1723) | none |
| Tail short try: goal = target position, else point(wp) | 0x1212e2c..0x1212efd (walk.asm 1724-1765) | `movement/request_plans.rs:258-264` (`goal: w.waypoint`) |
| Tail short try: call of the dispatcher (rdx = &goal at rbp+0x158) | 0x1212fde..0x1212fec | `request_plans.rs:265` `short_path` |
| Ignore list builder (still from point(wp)) | 0x120ee10, call 0x1212dcf | `movement/new_path.rs:189` `ignore_list` |
| Short pather dispatcher | 0x1078690 (dec `out/d2.c`) | `movement/long_walk.rs:395` `short_path_including`, `pathing/short_path/call.rs:150` `Call::entry` |
| Short pather | 0x107f7a0 | `pathing/short_path/main_loop.rs` `Search::run` / `corner_expand:209` |
| Point count of a path / point at | 0x1072970 / 0x1076260 | `points.len()` / `level.point()` |
| Tile planner (not the cause here) | 0x1057a40 | `pathing/tile_path/planning.rs:108` |

## 2. The original's logic for this case, in execution order

Truth states of 4364 (level blob at unit+0x3f0; all have type 0, link kind 1, target 1191,
range 0, tries 10, **parent pointer 0x20dd1e11f60 in every row**):

| first seen ms | path id | waypoints | wp |
| --- | --- | --- | --- |
| 152358 | 0x21 | (89.21, 67.79) (92.5325, 66.2175) (95.855, 64.645) | 1, then 2 |
| 161643 | 0x33 | (95.855, 64.645) (99.1775, 63.0725) (102.5, 61.5) | 1, then 2 |
| 170701 | 0x3d | (102.5, 61.5) (106.2, 61.2) (106.96471, 60.2) = hex `0000CD42 00007642 / 6666D442 CDCC7442 / EEEDD542 CDCC7042` | 1, then 2 (175405) |
| 176973 | -1 | level reset (parent 0): arrived | |

So the path was **created at world time 170701 ms** (sample 170477 still shows path 0x33 with the
unit at (102.336, 61.578); at 170701 the unit stands exactly on (102.5, 61.5) with the new path).
Before it the unit walked two 3-point walked paths, each a straight planner stretch split at its
midpoint (stretch > 5): the parent level (type 1) holds the smoothed plan
`(89.21, 67.79) (95.855, 64.645) (102.5, 61.5) X`, X = its last point. The unchanged parent
pointer proves the third walked level hangs under the same type-1 level (not directly under the
top level, so this is not the first-plan short path of a type-2 request).

1. 170701, walk function, REACHED on the type-1 level: wp -> index of X; state 2 (request).
2. Request (R4 steps 14-24): way = |(102.5,61.5) - X| <= 16, so the tail short try runs.
3. Ignore list: `0x120ee10(unit, target, start.x, start.h, point(wp)...)` (call 0x1212dcf): built
   from point(wp), unchanged.
4. Range: near_goal (r12b) ? `maxss(level.range - 0.1, 0)` : 0 (0x1212dd4..0x1212dee). Here 0.
5. **All-last flag** (0x1212df3..0x1212e29): `lvl = unit+0x3f0`; for each level up the parent
   chain (`+8`): if `lvl+0x18` (path) != NULL: `count = 0x1072970(path)`;
   `cmp [lvl+0x24], count-1; jl` -> flag = 0 (0x1212ed4 `xor dil,dil`). No such level: flag = 1
   (`mov dil,1`). Signed compare; levels without a path object count as "on last".
6. **Goal** (0x1212e2c..0x1212efd): `target (r15) != NULL && flag` -> goal = (decoded
   `target+0x170`, 0.0 (`unpcklps xmm0, xmm13`), decoded `target+0x178`); else goal =
   `*0x1076260(path, level.wp)` (the waypoint). Stored at rbp+0x158/0x160.
   Here: top level path [start, tree] wp 1 of 2, type-1 level on X (last), so goal =
   (107.5, 0, 59.5).
7. `0x1078690(&start, &goal, master[+0x78], range, level.target id, list, n, ...)` (0x1212fec).
8. Dispatcher (dec `out/d2.c` 0x1078690): target found and `0x124dd10(target, start) - radius <=
   range` -> empty path, 0 (not here). Ends on the map. Fixed point = `(int)(longlong)(f * 2^22)`.
   `at_target = (int)goal.x_fixed == (int)(target.x * 2^22) && same for y` -> **true** here.
   Listed objects are passed as ignored shapes only when they have a shape (`+0x194 != -1`) and
   `(!at_target || id != target id)`: the tree's shape **stays in the mesh**. With `at_target` the
   target master's half sizes (`master+0x78/+0x7c`) are passed (else 0).
   The engine's `Call::entry` (`call.rs:150-208`) does exactly this already.
9. Short pather 0x107f7a0 (already ported; `GENIE_EXPERIMENT_SHORT_188329`), numbers in fixed
   point: r = 838860 (0.2), d = 0x200000 - r = 1258292, start (429916160, 257949696), goal
   (450887680, 249561088), half 2097152, rr = 2936012. Shapes (stored = box grown half a tile):
   lumber camp 4360 (player 2, master 562, at (105, 60), state 0) [103.5, 58.5, 106.5, 61.5];
   tree 1191 [106.5, 58.5, 108.5, 60.5].
   a. Start ray toward the goal meets 4360's low-x side (x = 103.8, y ~ 60.98) -> side node; the
      outline walk gives the corner nodes (103.8, 61.2) and **C = (445435084, 256691404) =
      (106.2, 61.2)** (floats `0x42D46666, 0x4274CCCD` = truth).
   b. C popped (type 3): aim = cut of C->goal at the goal box (goal +- (rr - d) = +-0.4):
      t = (449604717, 251238807) = (107.194, 59.9); range 0 -> the ray target is the aim.
      Raycast C -> t: the tree's own shape (not ignored), high-y side y = 60.5*2^22 - d =
      252497100: proper crossing, ua = 3226386 (0.7692) ->
      **h = (448642492, 252497100) = (106.964705, 60.2)** -> floats **`0x42D5EDEE, 0x4270CCCD`**
      = the truth's last point, bit for bit (`sim.py`; the same bits come out with the ray aimed
      at the goal itself, ua = 2467237).
   c. Side node h popped: rect distance to the goal box (goal +- rr) = `|252497100 - 249561088|
      - 2936012 = 0` -> `0 <= range^2 = 0` -> goal. (2^22 - d = 2^21 + r = rr for a half size of
      0.5, so this is exact.)
   d. Path back h, C, (103.8, 61.2), side node, start; smoothing removes the two points before C
      (start sees C: at x = 103.8 the segment is at y = 61.39 > 61.2).
      Result 1 with `[start, (106.2, 61.2), (106.964705, 60.2)]`.
10. Back in the walk function: r == 1 and length > 1e-7 -> FOUND, not PARTIAL; `end_gap =
    |point(wp) - last|` (still the waypoint, 0x1213064..); not PLANNED -> walked level type 0,
    link kind 1 (truth: link 1), stretches <= 5 so no split (3 points, truth nw = 3).

Step 9a/9d were not re-read in the binary for this case (they are the engine's existing, verified
code; the result's first two points equal the engine's own path); 9b/9c are computed in `sim.py`.

## 3. Confirmed difference from the engine's default behaviour

**D4 (= R4-D4, now tied to a truth case): goal of the tail short try.**
- Original: asm 0x1212df3..0x1212efd (section 2 steps 5-6), dispatcher dec `out/d2.c` 0x1078690
  (`bVar3`, the `+0x194` loop, `fStack_278 = master+0x7c`).
- Engine: `movement/request_plans.rs:249-271` `short_path_to` builds `ShortAsk { goal: w.waypoint,
  .. }`; `Way.waypoint` is always `level.point(level.waypoint)` (`movement/request.rs:97-98`).
  `short_try` (`request_plans.rs:326-357`) calls it unchanged. With goal = waypoint (106.5, 60.5)
  `Call::entry` (`call.rs:186-194`) finds `to != target position`, ignores the tree's shape and
  passes half sizes 0: the path ends on the waypoint (WALKWP trace: `[(102.5,61.5), (106.2,61.2),
  (106.5,60.5)]`).
- Switch coverage: none. `GENIE_EXPERIMENT_WALK_188329` is read only at `waypoint.rs:437` (D1).

Implementation (under `GENIE_EXPERIMENT_WALK_188329`; needs `GENIE_EXPERIMENT_SHORT_188329` for
the pather side, which is unchanged):

1. `request_plans.rs` `short_path_to`: add a parameter `goal: BVector` and use it for
   `ShortAsk.goal` only. Keep `let line = ground_line(self.moved_at, w.waypoint)` for
   `ignore_list` (original builds the list from point(wp)).
2. `near_target_path` (first plan of a top level): pass `w.waypoint` (unchanged behaviour; R4
   step 21a asks point(wp)).
3. `short_try`: before the call,
   ```rust
   let all_last = self.paths.iter()
       .all(|l| !l.has_path || l.waypoint.at_or_past_last(l.points.len()));   // wp >= count-1, signed
   let goal = match w.goal.target {
       Some((_, t)) if walk_188329 && all_last => {
           let p = t.position.ground();            // the same value short_path_including reads
           BVector::new(p.x(), 0.0, p.y())         // height 0
       }
       _ => w.waypoint,
   };
   let r = self.short_path_to(me, (world, by_id), plan, w, near, goal, np)?;
   ```
   `self.paths` must be the whole stack (walked level first up to the top), including the walked
   level itself. `w.goal.target` is the level's target object when it still exists (original r15).
4. Leave `np.end_gap = ground(w.waypoint, last)` as it is (line 354-355).
5. Keep `all_last` for R4-D5 (result 3 -> AI notify 0x21e uses the same flag, without the target
   condition).

Which other paths it alters: every tail short try with a live target whose stack is on its last
waypoints, i.e. the last leg of any walk to an object under a planned level (gather, drop-off,
build, attack, hunt): the path then ends where the search first reaches the target's own
box (side node or range point) instead of on the planner's end point / waypoint, and the target's
shape is an obstacle instead of ignored; the result code can change with it (1 / 2 / 3 / 0), hence
the link kind (1 vs 2) and the no-path exits. For a walked level directly under the top level the
waypoint already is the target's position at order time, so only moving targets change (current
position instead of the stale one). Walks without a target and legs short of the last waypoint
are untouched.

## 4. Suspected

- S1. X (the type-1 level's last waypoint in the original) is taken to be the tile centre
  (106.5, 60.5) as in the engine; the truth log does not dereference the parent level. It does not
  matter for the result as long as X is the last point and within 16 (shown by the outcome: a
  path ending on the target's shape is only produced with goal = target position, and D4 needs
  "last"). R16-D1 (planner final choice) is therefore **not shown** to act here; both planner
  results end on a tile centre because the tree's tile has no edges.
- S2. Tree master 1349 half sizes = 0.5 (not read from data). Supported by the truth link kind 1
  (result 1 needs rect distance 0 <= range 0, which needs rr >= 0.7) and by y = 60.2.
- S3. The engine's short pather, given goal = target, is expected to return exactly the truth
  path (its 188329 cut, raycast, side node and `pop_test` `<=` were read: `main_loop.rs:209-276`,
  `nodes.rs:350-362`), but it was not run.

## 5. Not read / to trace

- The engine was not run; the old binary was not opened; 0x107f7a0 was not re-read (P1/R12 cover it).
- The engine's level stack at update 8800..8810 (creation of this path) was not traced: add in
  `short_try` one line `SHORTTRY id, now, level, per level (kind, waypoint, points.len(),
  has_path), w.waypoint, goal, result r, np.path.points` to confirm `all_last` holds there and
  the new result.
- Truth side, if wanted: in the logger follow `ps+8` (parent) and dump its `+0x14, +0x24` and
  path points to see X directly.
