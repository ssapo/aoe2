# P11: villager 3819 goes -x instead of +x at 90.945 s (replay 517426097, update 6775)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (build 188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/pathing/short_path/` (PC source as of 2026-11-11, all switches
of the task on). Reproduction: `out_p11/sp.py` (the P10 python port of the engine's short pather,
plus the switch `REWALK_GOAL` for the change below, plus a fix of the port's `range2`, which
was not shifted by 22 bits), `out_p11/run11.py` (the scene), `out_p11/check11.py` (the 3819 query, both
modes, bit compare with truth), logs `out_p11/log_engine.txt`, `out_p11/log_rewalk_goal.txt`. I
started no engine runs: `runs/q097t.err` (SHORTPATH lines) and `runs/q097a.err` were enough.

**Result.** Both builds send the same request: the Hunt action's short path to its target, goat
3206. The query is from (90.56213, 77.61) to the goat (89.1875, 75.979164), radius 0.2, target
half size 0.3, range 0, the walker's own shape ignored. The scene and the polygon are the same
in both builds. The two diverge in the **polygon re-walk**. In 188329, while a re-walk passes over
vertices that no corner node has reached yet (cost `UNSET` = 0xffc00000), it goal-tests each of
them (`0x107dcf0`). The engine passes over them without a test. The vertex (89.6875, 76.001633),
on the goal box, therefore becomes the goal at g = 2.918271 and then at g = 2.764303 before the
west corner (89.381042, 77.728645) is popped. That corner's reach is 2.858669, which no longer
beats the goal, so the west route is never expanded. The port with this one change gives the truth
path **bit for bit** (`wp` hex `D01FB542 00000000 52389B42 | F294B542 .. 52389B42 | D877B542 ..
EBD19842 | 0F30B442 .. D6009842 | 0060B342 .. D6009842`). Without the change it gives the engine's
path (`q097t.err`) exactly. The corner-ray switch (CORNER_188329) is **not involved**: both
callbacks give the same output with the change on and with it off.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Short pather main loop | 0x107f7a0 (pop at `param_1[3]`, types 0..3) | `main_loop.rs:340` `run`, `expand` |
| Pop test (best, in-range goal, prune `goal.g <= g`) | 0x107ce90 | `nodes.rs:350` `pop_test` (same) |
| Goal test (range2 < d2 or `goal.g <= g` -> maybe best; else goal) | 0x107dcf0 | `nodes.rs:249` `goal_test` (same) |
| Corner emission (flag + ±0x33333 nudge) | 0x107e060 | `nodes.rs:44` `corner_emits` (same conditions, read in asm) |
| New-polygon walk (goal test per vertex, foot tests) | 0x1081ab0 (call 0x1080c81) | `outline.rs` `walk_new` (same) |
| Edge holding / trace | 0x1081710 / 0x1082ff0 | `outline.rs` |
| Re-walk, first vertex of each direction: goal test only if cost != UNSET | 0x108041d `cmp [c+i*4], UNSET; je`, test 0x1080489 (index down), 0x1080781 (index up) | `main_loop.rs:131-171` `rewalk_corner` (same) |
| **Re-walk advance, index down** (engine Backward): `g += cheb`, `flag = g < c[vi]` (0x10805dd), `c[vi] != UNSET` -> back to 0x10803a6 (0x10805e8/0x1080604); else **goal test** `0x107dcf0(g, parent, 1, run(lo=vi, hi=[rbp-0x4c]))` at 0x1080670, fail -> loop 0x1080580, success -> 0x10803a6 with flag (false) | 0x1080580..0x10806a0 | `main_loop.rs:178-203` `rewalk_advance`: **no goal test (differs)** |
| **Re-walk advance, index up** (engine Forward): same, goal test `0x107dcf0(g, parent, 0, run(lo=e, hi=vi))` at 0x108096f, fail -> loop 0x10808a0 | 0x10808a0..0x10809b9 | same function (**differs**) |
| UNSET | `DAT_14408e970` = 0xffc00000 | `mod.rs:166` `UNSET = -0x400000` |
| Type-3 corner node: aim at goal box, `reach < goal.g` else skip, ray with 0x107b1b0 | 0x107fe06.. (decompile `cVar10 == 3`) | `main_loop.rs:209` `corner_expand` (same) |

The record the engine calls a Run is (poly, dir, lo, hi). Its fields in the index-up branch are
`lo = uStack_308` (the edge `e` that 0x1081710 returns) and `hi = vi`. In the index-down branch
they are `lo = vi` and `hi = uStack_2c4`. These are the same values as the branch's first-vertex
tests at 0x1080781 and 0x1080489, so they are the engine's `(Forward, e, fv)` and
`(Backward, bv, next0)`.

## 2. The scene and the request

- Request (`q097t.err`, the SHORTPATH line in update 6775, the one after the `"ms":90932` OBJECT
  block): Hunt (action 110, state 12), short path to the target. `from (379845120, 325519936)`,
  `to (374079488, 318679712)` = goat 3206, radius 0.2, target size 0.3, range 0,
  `ignore_shapes=[90]` (the walker). Truth `ps` at 90.945 s shows target 0xc86 = 3206 and range 0
  (range 0.1 appears only in the 91.712 s request). The goal box is the goat ± 0.5.
- Shapes (dat `empires2_x2_p1.dat`, unit records):
  - Villagers (592) have radius 0.2 and obstruction 5. Standing ones are 2964 (89.69386, 76.40163),
    2966 (89.78104, 77.32864), 3824 (90.33407, 76.81), 3826 (90.39091, 77.21) and 3819 itself
    (ignored).
  - 2972 is moving. Whether it has a shape changes nothing.
  - Goat 3206 (1060, radius 0.3) is standing. It is the target and keeps its shape.
  - The TC (109), 619 and 620 have obstruction type 0 and no shape. That is why villagers stand
    under the TC.
  - 618 (radius 1, at (90,74)) is out of reach.
  - Dead goat 3827 (1061, truth only) has collision 0 and obstruction 0.

  All other units, run with this scene in the port, give exactly the engine's (= truth's) paths
  of this tick: 2966, 3824, 3826. Shape insertion order does not matter (62 shuffles).
- S lies 8 fixed units above 3826's shrunk HighY (325519928).

## 3. The search, step by step (port, `log_rewalk_goal.txt`)

Common to both builds:
1. Start ray -> touch on 3826 at t = 0 -> touch handler -> side nodes #3 (S, HighY, g 2e-6) and
   #2 (90.390907, 77.61).
2. Pop #3: trace poly 0 (2966, 2972, 2964, goat, 3824, 3826). `walk_new` emits corners
   #9 (90.790909, 76.81) g 1.028774, **#13 (89.381042, 77.728645) g 1.299736 f 2.549215 (west)**,
   #15, #17, #20, #23 (90.093864, 76.001633) g 2.534184, #25. The foot/goal test gives goal #26 =
   the vertex (89.6875, 76.001633) on the goal box, g 2.940546.
3. Pop #2: re-walk, nothing. Pop #9: its ray crosses 3824 HighX, giving side node #28
   (90.73407, 76.780548), g 1.092791.
4. **Pop #28, first divergence.** The re-walk from edge 14 reaches the vertex (90.093864, 76.001633)
   with g 2.511909 < 2.534184, giving corner #30. It then advances to (89.6875, 76.001633), whose
   cost is UNSET because walk_new made it a goal, not a corner.
   - 188329 (0x10805e8 -> 0x1080670 or 0x1080910 -> 0x108096f): goal test with g = 2.918271,
     which is in range and below 2.940546. **That vertex becomes the goal** and the direction ends.
   - Engine (`rewalk_advance`): passes over it.
5. Pop #29 -> side #32 (90.093864, 76.231651) on 2964 HighX. Pop #15 -> #33. Pop #32: the re-walk
   gives corner (90.093864, 76.001633) g 2.357941. Its advance goal-tests (89.6875, 76.001633):
   **goal g = 2.764303** in 188329 only.
6. **Pop #13 (west).** Reach = 1.299736 + |p - aim| = 2.858669.
   - 188329: 2.858669 is not below 2.764303, so the node is skipped (0x107f7a0 type 3:
     `goal == -1 || reach < arena[goal].g`).
   - Engine: 2.858669 < 2.940546, so the ray crosses the goat's HighY at (89.242813, 76.479164).
     That side node, g 2.556845, becomes the goal: the engine's path.
7. 188329: every remaining node is skipped or pruned. Raw path from goal #35:
   (89.6875,76.001633) (90.093864,76.001633) (90.093864,76.231651) (90.73407,76.409996) ...
   (90.790909,77.61) S. Smoothing (d' = 0.4) gives `S, (90.790909,77.61), (90.73407,76.409996),
   (90.093864,76.001633), (89.6875,76.001633)`, the truth `wp` exactly.

## 4. Confirmed difference

**D1. The re-walk goal-tests the vertices it passes over (188329) and the engine does not.**
- Original: 0x1080580..0x10806a0 and 0x10808a0..0x10809b9 (asm read, section 1). After each step,
  `g += cheb(prev, v)` and `alive = g < c[v]`. If `c[v] != UNSET` the step stops there, as in the
  engine. Otherwise `0x107dcf0(g, parent, dir, run, v)` is called. False: next vertex. True: the
  step returns with `alive = g < UNSET = false`, so this direction ends (`jmp 0x1410803a6`).
- Engine: `main_loop.rs:178-203` `rewalk_advance` returns at the first vertex whose cost is set.
  Its doc comment (`main_loop.rs:84-86`) says "vertices no corner node reached are passed over".
  That describes 158041.
- Change, under a new switch `GENIE_EXPERIMENT_REWALK_188329` (it could also be folded into
  `SHORT_188329`):
  - `mod.rs`, next to `corner_ray_188329()`:
    ```rust
    /// The re-walk's goal test of the vertices it passes over (188329 `0x1080670`, `0x108096f`,
    /// case 90.9 s of replay 517426097), on top of [`build_188329`]: `GENIE_EXPERIMENT_REWALK_188329`.
    pub(super) fn rewalk_goal_188329() -> bool {
        static FLAG: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
        *FLAG.get_or_init(|| std::env::var_os("GENIE_EXPERIMENT_REWALK_188329").is_some())
    }
    ```
  - `main_loop.rs` `rewalk`: lines 119 and 123 call
    `self.rewalk_advance(&walk, &poly, (fv, gf), WalkDir::Forward, (e, next0))?` and
    `(..., (bv, gb), WalkDir::Backward, (e, next0))?`.
  - `rewalk_advance` becomes `&mut self` with the extra argument `(e, next0): (VertexIndex, VertexIndex)`.
    After the `if cost != UNSET { return ... }` add:
    ```rust
    // 188329 (0x1080580..0x1080683, 0x10808a0..0x108097b): a vertex no corner node reached is a
    // goal candidate (0x107dcf0); a goal ends this direction (its alive flag is g < UNSET)
    if super::build_188329() && super::rewalk_goal_188329() {
        let run = if dir == WalkDir::Forward {
            Run { poly: walk.poly, dir, lo: e, hi: vi }
        } else {
            Run { poly: walk.poly, dir, lo: vi, hi: next0 }
        };
        if self.goal_test(Corner { cost: g, parent: walk.parent, run, point: w })? {
            return Ok((vi, g, g < cost));
        }
    }
    ```
    `costs` must be re-read through `self.poly(walk.poly)?` inside the loop, since `goal_test`
    borrows `self` mutably. The goal and best nodes it adds are corner nodes with `emit: None`, as
    `walk_new`'s are. The python equivalent is `sp.py` `rewalk_advance` with `REWALK_GOAL`.

## 5. Suspected / side notes

- S1 (not this case): in the truth, when goat 3204 is used up (state 7 at 88.722 s, state 8 at
  88.735 s), a new gaia object 3827 appears at its place: master 1061 GOAT_D, state 5, held 59.987,
  decaying. The engine has no 3827. It has no shape (dat: collision 0, obstruction 0), so it plays
  no part here. It is an object-creation divergence that `cmp_pos` does not flag (objects present
  in both only).
- After the change the engine should walk the truth's path. The next truth events are an
  obstacle stop at about 91.699 s and the range 0.1 request at 91.712 s
  (4 points via (90.77328,77.35003), (88.98169,77.27682)). These were not checked.

## 6. Not read

The rest of the re-walk's entry (how the first two alive flags are set, compared only with the
decompile), 0x107e640 (node add for goal or best), 0x1081710 / 0x1082ff0 (taken as the engine
ports them; the polygon matches the truth's vertices), the walk request site in 0x1210f60.

## 7. Other situations the change affects

Any search whose re-walk (a side node landing on a polygon already traced) passes over a vertex
without a corner node:
- A vertex that walk_new or an earlier re-walk made a goal. This is typical when units cluster
  round a target whose goal box touches the cluster's outline: hunters or shepherds round a
  carcass, gatherers round a bush, villagers round a TC or drop site. Such goals can now get
  cheaper earlier, which prunes the other side of the cluster, as here.
- A vertex where the sides do not change, a shapeless (border) vertex, or a vertex where
  `corner_emits` declined.
- The goal test's other branch also adds **best** nodes (`d2 < best.h²`). Partial searches
  (unreachable target) can therefore end at a different best point.
- A goal found in the advance ends that direction, so corners past it are no longer emitted in
  that direction.

Searches that never re-walk, or whose re-walks only pass set vertices, are unchanged. Re-run the
path comparisons of 518239882 (0-384 s, `cmp_paths` / `cmp_pos`) and 518470161 with the switch,
and this replay past 90.9 s.
