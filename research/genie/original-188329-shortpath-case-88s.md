# P1: short-path mismatch at 88.12 s (replay 518239882, villager 3420 -> sheep 3668)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (build 188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/pathing/short_path/`. "asm" = read in disassembly
(`out_p1/short.asm`, `cb3.asm`, `touch.asm`, `legs.asm`), "dec" = Ghidra decompile `out/d3.c`.
Numeric reproduction: `out_p1/sim.py`, `out_p1/sim2.py` (python, the pather's 2^22 fixed point).

**Result.** The truth path is reproduced bit for bit: `[start, (85.86577, 69.087074),
(86.09685, 69.86705)]`. Three things differ from the engine (with `GENIE_EXPERIMENT_SHORT_188329`):
(D1) a polygon-corner node whose ray *touches* has no nudges and no axis L in 188329; it runs the
same touch handler as the start node (back off a tenth of the ray, then two L legs toward the
touched shape's centre); (D2) the L legs' costs are real axis distances, not `|delta.x|`/`|delta.y|`;
(D3) the smoothing (already in the engine) removes the corner, which is why the final segment
crosses 3422's inflated box. D1 + D2 are needed for this query; no existing switch covers them.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Short pather | 0x107f7a0 | `main_loop.rs` `Search::run` / `expand` |
| Popped-node test | 0x107ce90 | `nodes.rs` `pop_test` |
| Type-3 (corner) branch | 0x107fc5d..0x1080140 (asm) | `main_loop.rs:209` `corner_expand` |
| Type-0 (start) branch, no shape | 0x1080ca0.. (raycast at 0x1080ee6, touch at 0x1080f17) | `main_loop.rs:435` |
| Goal box rect ctor / segment-vs-rect | 0x96ccb0 / 0x1084210 | `geometry.rs` `ray_rect` |
| Range point | 0x107d640 | `main_loop.rs:569` `range_point` |
| Raycast (tile walk) | 0x1084770 | `raycast.rs:177` `raycast` |
| Corner ray callback (thunk -> body) | 0x107b1b0 -> 0x107c590 | `raycast.rs:113` `Callback::Corner(token)` (differs, S1) |
| Start ray callback / sight callback thunks | 0x107b270 -> 0x107cfb0 / 0x107b210 -> 0x107c8c0 | `Callback::Box` / `Callback::Sight` (bodies not read) |
| Segment hit | 0x1084070 | `geometry.rs:127` `segment_hit` (188329 branch at :146) |
| Touch handler (back-off + two legs) | 0x107cb80 | `main_loop.rs:495` `touch_from` |
| One L (two legs) | 0x107c100 | `start.rs:328` `legs` |
| Axis sweep | 0x1082960 | `raycast.rs:301` `sweep` |
| Holder of a point (strict) | 0x107e220 (rect test 0x96cd70) | `raycast.rs:47` `holder` |
| Rect centre | 0x96cd10 | inline in `touch_from` |
| Rect non-empty (x0<x1 && y0<y1) | 0x96cdf0 | `raycast.rs:154` |
| Add waypoint / side node / corner node | 0x107e750 / 0x107e430 / 0x107e520 | `nodes.rs` `add`, `side_node` |
| Push open | 0x107d400 | `nodes.rs:226` `push` |
| Corner emits (token) | 0x107e060 (only called in the polygon walks 0x10804d5, 0x10807db) | `nodes.rs:44` `corner_emits` |
| Edge foot test | 0x1082180 | `nodes.rs:285` `foot_test` |
| Sight test of the smoothing | 0x1082e90 | `raycast.rs:373` `sight_blocked` |

## 2. The original's logic for this query, in execution order

Inputs (fixed point): start (360160384, 289772192), goal (365472416, 299062624), r = 838860
(0.2), d = 0x200000 - r = 1258292, half sizes 1258291, rr = r + half = 2097151, range = 5872025
(1.4). Shapes (stored box shrunk by d; the engine's `refreshed_rect` rounding reproduces the
printed floats, `shape_rect`'s does not):
3422 [360147144, 288084008, 363502584, 291439448], 4349 [360035080, 293043656, 363390520,
296399096], 3426 [358357352, 293066952, 361712792, 296422392].

1. Start node (0x107e820, already ported): the start is strictly inside 3422; of the escape
   candidates only the cheapest stays: the foot F = (360147144, 289772192) = (85.86577,
   69.087074) on 3422's low-x side, g = 13240.
2. F popped (type 2): 3422's cluster is 3422 alone (its overlaps with the others are narrower
   than d), polygon v0..v3 = (x0,y0), (x1,y0), (x1,y1), (x0,y1). The walk from F goes backward
   first (cost 1667256 to C = v3 against 1688184 to v0): corner node C = (360147144, 291439448)
   = (85.86577, 69.48458), g = 1680496. The top edge's crossing of the goal box (x = gx - rr,
   0x1082180, already ported) is in range and becomes the goal so far: G1 = (86.635414, 69.48458),
   g = 4908617. Then v2 becomes a corner node with g = 5035936 (not better than G1). (This step
   is the engine's existing code; I did not re-read 0x1081ab0 / 0x1082180 here.)
3. C popped (type 3, asm 0x107fc5d..):
   a. pop test 0x107ce90 (0x107fc68); not ended.
   b. goal box = goal -/+ rr (0x96ccb0), shrunk by d; `0x1084210(C, goal, box, t = 0x466666)`
      (0x107fd28); hit -> aim = C + (goal - C) * t >> 22 = (86.9957, 71.10209), t = 0.88996.
   c. T = range point (0x107d640, 0x107fd8f) = (361523677, 293409968) = (86.19396, 69.95439).
   d. reach test (0x107fde1..0x107fe00): `goal == -1 || (int)(sqrtf(..) * 2^22) + g < goal.g`
      (`cmp; jge` skips): 2403k + 1680k < 4908k, continue.
   e. raycast `0x1084770(mesh, ignore, C, T, &t = 0x466666, &shape, &side, d, 0x107b1b0)`
      (0x107fe66). Callback body 0x107c590 (asm, whole function): a ray with dx == 0 or dy == 0
      uses the axis sweep 0x1082960 and returns 1 with `t = |hit - a| << 22 / |d|`; otherwise for
      each shape of the tile not ignored: clip = ray's bounding box (not grown) intersected with
      the shrunk shape; only when `x0 < x1 && y0 < y1` (0x96cdf0): `k = 0x1084210(a, b, shrunk,
      &copy of t, &side)`; `k != 0`: `k == 3 -> 2`, return value = k, side / t / shape written.
      There is no token.
      Here: tile (85,69): 3422 is skipped (the clip is empty: the ray leaves its corner), 3426
      low-y side Cross t = 3464186, 4349 low-y side Cross t = 3414602 (0.814105; order of the two
      does not matter). The hit lies in tile (86,69), so the walk visits that tile and tests 4349
      **again**: now `ua == t`, so 0x1084070 gives no crossing (`cmp rcx, r9; jge`, 0x108414a) but
      a touch (`ua < t + 0xa3d7`, 0x108417a..0x1084184) and backs t off: t = 3414602 - 0xa3d7 =
      3372659 (0.804105), result 2, shape 4349. (All orders of the tile lists give this.)
   f. `cmp eax, 2; jne` (0x107fe6b): result 2 -> `0x107cb80(ctx, &node C, T, t, shape 4349)`
      (0x107fe8f), then `jmp` to the loop end (0x107fe94). **No nudged rays, no call of
      0x107e060, no axis L.** Result 1 (0x107fe99) -> side node at the crossing (skipped when the
      settled point equals the node's, 0x107ffed..0x107fff7); result 0 -> terminal goal
      candidate (0x1080114).
4. Touch handler 0x107cb80 (asm, whole function):
   a. `f = t - 0x66666` (0x107cbae) = 2953229 (0.704105). While `f > 0`: q = node.at +
      ((T - node.at) * f >> 22) per axis; `0x107e220(q) == -1` (no shape holds q strictly) ->
      waypoint W at q with g = node.g + (int)(sqrtf(fx*fx + fy*fy) * 2^22) of the two products,
      parent = the node; the local node copy becomes W; stop. Else `f -= 0x66666`.
      Here W = (361116367, 292826900) = (86.09685, 69.81538), g = 3372954.
   b. c = centre of the touched shape's stored rect (0x96cd10) clamped to the search box:
      (361712800, 294721376).
   c. `dir_x = (c.x - base.x > 0) ? 1 : 3`, `dir_y = (c.y - base.y > 0) ? 2 : 0`, where base is
      the local copy (W when a waypoint was made, else the node): `sub r8d, [rsp+0x50]`
      (0x107cd4c), `sub edx, [rsp+0x54]` (0x107cd6e). Here 1 and 2.
   d. `0x107c100(ctx, &base, c, dir_x, dir_y)` then `0x107c100(ctx, &base, c, dir_y, dir_x)`.
5. One L, 0x107c100(ctx, base, c, a, second) (asm, whole function): p = base.at;
   m = (c.x, p.y) when a is 1 or 3, else (p.x, c.y). Sweep p -> m in direction a.
   - found (`cmp al, 1`, 0x107c1b4): `g = base.g + |p.x - hit.x|` (a along x) or
     `base.g + |p.y - hit.y|`; parent = base.
   - not found: waypoint M at m with `g = base.g + |p.x - m.x|` (or `|p.y - m.y|`), parent =
     base; sweep m -> c in direction `second` (its result is not tested);
     `g = M.g + |m.y - hit.y|` (a along x) or `M.g + |m.x - hit.x|`; parent = M.
   - side node (0x107e430) at the hit point with the hit's shape and side, pushed (0x107d400).
   Here: L(x first): sweep +x from W meets nothing -> M = (361712800, 292826900), then +y meets
   4349's low-y side -> side node A = (86.23905, 69.86705), g = 3372954 + 596433 + 216756 =
   4186143. L(y first): sweep +y from W meets 4349's low-y side (293043656; 3426's at 293066952 is
   farther) -> side node **B = (361116367, 293043656) = (86.09685, 69.86705)**, g = 3372954 +
   216756 = 3589710.
6. Open list by f: B (f = 3589710 + 4525k), A, v2. B popped: within range (rect distance 1.079 <
   1.4) and cheaper than G1 (3589710 < 4908617) -> goal = B. A and v2 are not cheaper: pruned.
7. Path back (dec, tail of 0x107f7a0; consecutive equal points are not pushed twice): B, W, C, F.
   Smoothing with d' = 0x200000 - r/2 (0x1082e90): B sees C -> W removed; B sees F -> C removed
   (the shapes are tested 0.1 thinner per side: 3422's sight box starts at x = 85.96577 and the
   segment F-B is at x = 85.954 where it leaves that box's y span). Start appended (escaped
   start). Result `[start, (85.86577, 69.087074), (86.09685, 69.86705)]` = the truth path.

Answers to the two questions: (1) the end point is the hit of the **y-first L leg** of the
corner's touch handler: x from the backed-off point on the ray C -> T at fraction
`t_cross(4349) - 0xa3d7 - 0x66666`, y = 4349's low-y side; (2) the segment through 3422's box is
not a searched edge at all: it is produced by the smoothing, whose sight test uses half the
radius.

## 3. Confirmed differences from the engine

**D1. A corner node's touching ray: no nudges, no axis L; the start node's touch handler.**
Original: asm 0x107fe6b..0x107fe94 (step 3f). Engine: `main_loop.rs:235-260` runs the four
`NUDGES` rays (`corner_emits` per nudge) and on four touches `corner_axis` (`:285`); this is the
default (old) behaviour and is not switched by `build_188329()`. In this query the engine's third
nudge (T + (0, -0.3)) is clear and becomes the terminal candidate (86.19396, 69.65439).
Implementation: in `corner_expand`, when `build_188329()` and `touches(found)` after the first
raycast: `let Some((_, hit)) = found; self.touch_from(n, p, t, frac, hit)?; return Ok(());`
(frac = the raycast's fraction, hit.shape = the last shape written). Leave the old path for the
default build. `corner_axis` and `NUDGES` become unused in 188329 mode.

**D2. The L legs' costs.** Original: asm 0x107c1b8..0x107c2a5 (step 5). Engine `start.rs:343-362`:
`through_float(|delta.x|) + b.g` for the first leg (found or not) and
`through_float(|delta.y|) + mid.g` for the second, whatever the leg's axis; no 188329 branch.
With the engine's costs B would get g = 3372954 + 1565656 = 4938610 > G1's 4908617 and be pruned,
so D1 alone gives `[start, F, C, G1]`, not the truth.
Implementation: in `legs`, under `build_188329()`: first sweep found ->
`g = b.g + |p.x - at.x|` (a along x) or `b.g + |p.y - at.y|`, plain i32 (no float), parent b;
not found -> waypoint at m with `g = b.g + |p.x - m.x|` (or `|p.y - m.y|`), then
`g = mid.g + |m.y - at.y|` (a along x) or `mid.g + |m.x - at.x|`.

**D3. The legs' directions are taken from the base node.** Original: asm 0x107cd4c, 0x107cd6e
(step 4c): `c - base.at`, base = the back-off waypoint when one was made. Engine
`main_loop.rs:554-556`: `c - p` (the popped node's point). Same signs in this query; differs only
when the centre lies between the node and the waypoint on an axis.
Implementation: in `touch_from` under `build_188329()`: `delta = c - base.at`.

Which queries change: D1 only those in which a popped polygon-corner node's first ray returns a
touch (result 2); D2/D3 only those in which the touch handler runs (a start-node ray or, after D1,
a corner ray that touches). None of them depends on the start lying inside a shape: a query with
a free start whose start ray and corner rays never touch is computed exactly as before. I cannot
prove from reading that no earlier (already matching) query had a touching start ray with the
old leg costs deciding the order; D2 changes only node costs there, so the 0..88 s path
comparison must be re-run after the change.

## 4. Suspected / not needed for this case

- S1 (read in the original, engine side read, effect here none): the corner ray's callback
  0x107c590 has no token; it skips shapes whose shrunk box does not properly overlap the ray's
  bounding box, maps result 3 to 2 unconditionally, and sends axis-aligned rays to the sweep.
  That is the engine's `Callback::Sight` plus a sweep for axis rays, not `Callback::Corner(token)`
  (`raycast.rs:113-130`: no box test, token-ignored start touches). For C -> T both give touch,
  t = 3372659, shape 4349. Crossings are the same under both; only touches/grazes can differ.
  Port separately and re-verify.
- S2: the path back skips a point equal to the last one pushed (dec, `0x107d870` guarded by a
  compare); the engine's `run` pushes the corner twice for a run that starts at the corner. The
  smoothing normally removes the duplicate; not shown to matter.
- S3: the same tick has an earlier query of the same walker with range 0.1 (engine result
  `[start, F, C, (86.66577, 69.48458), (86.98324, 70.802086)]`, `runs/st.err:1540`). With D1 it
  also changes at C; no truth path for it was given, not simulated.

## 5. Not read

0x107cfb0 (start-ray callback body), 0x107c8c0 (sight callback body), 0x1082960 (sweep; the
engine's port was assumed), 0x1081ab0 / 0x1082180 / 0x107dcf0 (polygon walk and goal tests; the
engine's existing 188329 port was assumed for step 2), 0x1082ff0 (outline trace). Which truth
objects besides the five villagers had shapes (3664, 4345, 4351, the town centre parts) is not
known; the reproduction needed none of them. If the engine still differs after D1-D3, print in
`corner_expand` (walker, p, t, frac, hit) when `touches(found)`, and in `legs` (b.at, c, a, the
sweep's found/point, g): expected for this query W = (361116367, 292826900), B.g = 3589710,
A.g = 4186143, G1.g = 4908617.
