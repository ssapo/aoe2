# P19: replay 518470161 (truth5), shepherd 9381's drop-off walk at update 16401 (215.397 s)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Engine runs (PC `runs\`, all 12 default switches incl.
`IGNORELIST_188329`, plus go.ps1's): `R1_1` (PATHS + STEER 16395-16410 + OBJECT 9381/9366/10413),
`R1_2` (OBJECT all, 16400-16401), `R1_3` (PATHS + STEER 1-16400, frequency count of the drop-off rule).
Scripts in this folder: `esc.py` (port of the start node's escape scan, `start.rs`), `run19.py`
(start test + full short path for this query, on `out_p11/sp.py`, copied here as `sp.py`).

**Result.** The first diverging step is in the start node's escape scan: the **contact candidates**.
188329 keeps a contact whose squared distance to the start equals the doubled radius squared
(`cmp rax,r15 ; jg` at 0x107f529, i.e. `d2 <= rr2`); the engine keeps it only for `d2 < rr2`
(`pathing/short_path/start.rs:291`). Here two contacts lie exactly on the circle, so the original's
drop-off start test finds 3 escape candidates (returns 1, not stuck), the drop-off rule does not fire,
9366 stays an obstacle and the path goes west: **bit-equal to the truth's 3 waypoints**. The engine finds
1 candidate (stuck), ignores 9366 and goes east.

## 0. Re-check with the current defaults (IGNORELIST on)

`R1_1`, update 16401: `IGNORE walker=ObjectId(9381) list=[9381, 9359, 9366] mgr=[Object(ObjectId(9389))]
own=[] top_created_now=true`; `SHORTPATH ... from (106913032, 152901760) to (113246208, 142606336)
r 0.2 target_size 2.0 range 0 ignore_shapes=[152, 174] -> [(25.490053, 36.45462), (25.884422, 36.45462),
(25.884422, 36.2)]`. Positions at 16400/16401 (9381 (25.4900532, 36.4546204), 10413 (25.4844227,
36.0546227), 9366 (25.8900528, 36.8234253)) unchanged from P16. The case looks the same.

## 1. Address table

| Role | 188329 | Engine |
|---|---|---|
| Drop-off rule: start test called ONCE before the hit loop (gate: hits > 0, own class 4/0x15, target, slot 0x2c8 == 8), result in r12b | 0x120f0c2..0x120f135 (call at 0x120f129), loop 0x120f13a..0x120f32e (`test r12b` at 0x120f26a) | `movement/new_path.rs:226-275` (called per qualifying hit, line 275) |
| Start test wrapper: ctx +0xc unit radius, +0x10/+0x14 target radii, +0x18 range (vtable 0x248), +0x1c terrain mask; no ignore list set | 0x107a390 (0x1077690, 0x1077750, 0x1077790, 0x1077670) | `short_path/call.rs:315` `start_blocked` |
| Prologue: terrain shapes, open/arena cleared, goal | 0x1083e60 | `call.rs:315-371` |
| Ignore flags set / cleared (global list 0x408ea00) | 0x107f700 (via thunk 0x10776b0, only from 0x1078690) / 0x107dfa0 (from ctx dtor 0x1077670) | `call.rs:287-308` |
| Start node: in range -> 3, free -> 0, open count <= 1 -> 2 (0x107f668 `cmp rax,1; jbe` -> `mov eax,2` 0x107f6ca), else keep cheapest -> 1 | 0x107e820, tail 0x107f664..0x107f6c8 | `start.rs:64-103` |
| Holder (strict, `jle/jge`) | 0x107e220 -> 0x96cd70 | `raycast.rs:47` `holder` / `strictly_inside` |
| Holder but one (inclusive, `jl/jg`) | 0x107bff0 -> 0x96cdb0 | `raycast.rs:60` `holder_but` / `inside` |
| Escape scan: rr = (r<<23)>>22, rr2 = (int)(rr*rr>>22) in r15 | 0x107e9e1..0x107ea00 | `start.rs:116-119` |
| Side circle points, foot, first corner (`d2 < rr2`: `cmp rax,r15; jge` 0x107f366) | 0x107e9d9..0x107f3bd | `start.rs:151-209` |
| **Contacts: half > d (0x107f424 `jle`), contact point 0x1082380, bounds, same-side nudge 0x96cd70, holder 0x107e220, `d2 <= rr2` (0x107f529 `cmp rax,r15; jg 0x107f58d`), cost +0x32 same side** | 0x107f3bd..0x107f5d2 | `start.rs:255-298` (`d2 < rr2` at :291; extra `ignored(c.other)` skip at :267) |

## 2. The original's logic for this query (steps)

1. 0x120ee10, 9381 at update 16401: list = [9381, 9359]; own list empty. Query 0x111c660 (mode
   `mgr+0x57 = 1`) gives hits incl. 10413 and 9366. Gate passes (class 4, target 9359, state 8), so
   0x107a390 runs once: from (106913032, 152901760), to (113246208, 142606336), r 838860, target radii
   2.0, no shape ignored (flags are only set inside 0x1078690 and cleared by its 0x1077670).
2. 0x1083e60: terrain shapes for the bounds (TC 9359 rows 32-35: shrunk top y = 36.2), open cleared,
   0x107e820.
3. 0x107e820: not in range; 0x107e220: the start is strictly inside 9381's own shape (and 10413's), so
   the escape scan runs over tile (25,36) (all four corners of start +- rr fall in it). rr = 1677720,
   rr2 = 671087. 9381's own shape (fixed rect `X - R - 0x200000`, even-rounded) has all four shrunk
   sides at exactly rr from the start: dist2 == rr2, h = 0.
   - circle points and feet on the own sides: LowY/LowX/HighX ones are held (10413, 9366); the HighY
     foot (25.490053, 36.854622) is free for the strict holder (9366's shrunk west side is x = 106913032,
     the start's x) -> candidate 1 (g 1677720).
   - contacts: own LowX side x 10413 HighY at (25.090054, 36.454620): d2 = 671087 = rr2 -> candidate 2
     (g 1677719); 9366 LowX side x own HighY at (25.490053, 36.854622): d2 = rr2 -> candidate 3.
4. Open count 3 > 1: keep the cheapest, return 1. 0x107a390 returns 0 (`== 2` false); r12b = 0, no hit
   is added; 9366 stays in the mesh for the search.
5. Short path (0x1078690 -> 0x107f7a0) ignoring [9381]: start held by 10413 (by 8 units), escaped to
   (106913032, 152901768), around 10413's west side, down to the TC's top edge.
   Result (port `run19.py`, fixed point): (106913032, 152901768), (105211696, 152901768),
   (105211696, 151833804) = floats `A1EBCB41 88D11142 / E6ACC841 88D11142 / E6ACC841 CDCC1042`
   = truth 215.579 s `wp` of 9381, all 3 points bit-equal.
   With 9366 ignored (engine) the same port gives the engine's traced path
   (25.884422, 36.45462), (25.884422, 36.2) exactly. The result does not depend on the mesh insertion
   order (20 shuffled orders tried).

## 3. Confirmed differences

**D1. Escape contacts on the circle (cause of this case).**
- Original: 0x107f504..0x107f52c: `rax = (dx*dx>>22) + (dy*dy>>22); cmp rax, r15; jg skip`, r15 =
  `movsxd (rr*rr>>22)` (0x107e9e1..0x107ea00). Inclusive. (The first-corner test just above is strict:
  0x107f366 `jge skip`, as the engine.)
- Engine: `pathing/short_path/start.rs:291` `if d2 < rr2 {` in `Search::escape_contacts`.
- Change (new switch `GENIE_EXPERIMENT_ESCAPE_188329`, on top of `build_188329()`):
  ```rust
  // pathing/short_path/mod.rs, next to rewalk_goal_188329
  /// The start's escape contacts on the doubled-radius circle count (188329 0x107f529 `jg`:
  /// d2 <= rr2), case 215.4 s of replay 518470161: `GENIE_EXPERIMENT_ESCAPE_188329`.
  pub(super) fn escape_188329() -> bool {
      static FLAG: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
      *FLAG.get_or_init(|| std::env::var_os("GENIE_EXPERIMENT_ESCAPE_188329").is_some())
  }
  // start.rs escape_contacts, replacing `if d2 < rr2 {`
  let within = if super::build_188329() && super::escape_188329() { d2 <= rr2 } else { d2 < rr2 };
  if within {
  ```
  Expected after the change, update 16401: `IGNORE walker=ObjectId(9381) list=[9381, 9359] ...` and
  `SHORTPATH ... points=[(25.490053, 36.45462), (25.084423, 36.45462), (25.084423, 36.2)]`; then 9381's
  drop-off spot and 9366's walk at 217.84 s should follow truth (P2 food at 218.53 s, P2 word 7 at 216.7 s).

**D2. Escape contacts with an ignored shape (no case).** The original's contact loop
(0x107f420..0x107f58d) reads no ignore flag for the contact's other shape (it reads only half, side, at,
start flag and the other's rect for the nudge test); the engine skips them (`start.rs:267`
`|| self.ctx.ignored(c.other)`). Only matters in a main search whose start is held; the start test has
nothing ignored. Suggest the same switch: `if d >= c.half || (!(build_188329() && escape_188329()) && self.ctx.ignored(c.other))`.
Not tested on a case; keep it a separate commit if a regression shows.

**D3. The drop-off rule's start test runs once.** 0x120f129 is before the hit loop (0x120f13a), runs
once when hits > 0 and the gate passes (even if no hit is a worker), result reused for every hit. The
engine calls it per qualifying hit (`movement/new_path.rs:273-275`). Same answer within one call; it
only changes how many times terrain shapes are added/removed (mesh free list, later shape ids). Not
needed for this case.

## 4. Suspected
- None for this case. The terrain shapes were rebuilt from the TC footprint (tiles 25-28 x 32-35); the
  engine-side port reproduces the engine's traced path bit for bit, so the scene is right where it matters.

## 5. Not read
- 0x1082380 (contact point) and 0x96cd70 nudge directions were read only as far as needed (nudge: side
  0 y+1, 1 x+1, 2 y-1, 3 x-1, same as engine).
- What 0x111c660 returns in mode 1 (hit list) was not re-read; 9366 is a hit in both builds.
- Effects downstream of 216.7 s not simulated.

## 6. What else the change affects
Every short-path search whose start is held by a shape (escape scan) and every drop-off start test
(class 4/0x15 worker in action state 8 with obstruction hits): a contact point of a side within 2r of the
start lying exactly on the circle now counts. This happens mainly in grid-aligned clusters (units 2r =
0.4 apart, e.g. shepherds/hunters around a carcass next to a TC): more starts are "escaped" instead of
"stuck", so the drop-off rule ignores fewer neighbours, and the escaped node can be such a contact
(cost g0 or g0+0x32). Run the default regression on truth4/5/6 after enabling.

Frequency: `R1_3` (STEER 1-16400) was too slow and was stopped by me at ~34.7 s of game time; up to there
748 IGNORE lines and 0 drop-off additions, so the drop-off rule firing is rare in this replay
(no count for the full game).
