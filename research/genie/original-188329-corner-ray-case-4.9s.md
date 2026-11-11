# P10: short-path mismatch at 4.940 s (replay 518470161, villager 9383, update 212)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (build 188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/pathing/` (PC source as of 2026-11-11, all 188329 switches on).
"asm" = `dz.py` disassembly read for this case; "dec" = `out/d3.c`. Numeric reproduction:
`out_p10/sp.py` (python port of the engine's short pather, 188329 branches, with a switch for the
corner ray's callback) and `out_p10/run10.py` (this query); logs `out_p10/log_clip.txt`,
`out_p10/log_token.txt`. Nothing was run on the PC; no Ghidra run was needed.

**Result.** The truth path `[(23.2,32.2), (25,28), (25,27), (26,25), (26.895834,24.3125)]` is the
short pather's output and is reproduced **bit for bit** (waypoint hex equal to `truth5.jsonl`) when
the type-3 (polygon corner) node's ray uses 188329's callback `0x107c590`; with the engine's
`Callback::Corner(token)` the same port gives the engine's `[(23.2,32.2), (26,28), (26,25), G]`
exactly. **One confirmed difference (D1):** in 188329 the corner ray's callback has no token: it
skips every shape whose shrunk box meets the ray's bounding box with zero area, maps result 3 to 2,
and sends axis-aligned rays to the axis sweep. This is S1 of case 88 s, now shown to matter. It
belongs under `GENIE_EXPERIMENT_SHORT_188329`.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Short pather | 0x107f7a0 (only caller 0x1077741) | `short_path/main_loop.rs:337` `Search::run` |
| Type-3 branch: t = 0x466666, callback `lea 0x107b1b0`, raycast | 0x107fe06..0x107fe66 (lea at 0x107fe1d) | `main_loop.rs:226-234` `corner_expand` |
| Type-3: result 2 -> touch handler; 1 -> side node; 0 -> terminal | 0x107fe6b, 0x107fe8f, 0x107fe99 | `main_loop.rs:237-287` |
| Corner ray callback thunk -> body | 0x107b1b0 -> 0x107c590 (only xref: 0x107fe20) | `short_path/raycast.rs:113-130` `Callback::Corner(token)` (**differs**) |
| Start ray callback thunk -> body (grown box for axis rays) | 0x107b270 -> 0x107cfb0 (lea at 0x1080e97) | `raycast.rs:96-105,131-167` `Callback::Box` (same) |
| Sight callback thunk -> body | 0x107b210 -> 0x107c8c0 (lea at 0x1082f85, in 0x1082e90) | `Callback::Sight` (body not read) |
| Raycast tile walk | 0x1084770 (callers 0x107fe66, 0x1080ee6, 0x1082fbf) | `raycast.rs:177` `raycast` |
| Ray vs shrunk rect / segment hit | 0x1084210 / 0x1084070 | `short_path/geometry.rs:206` `ray_rect` / `:127` `segment_hit` |
| Rect ctor / non-empty test `x0<x1 && y0<y1` (`jge` both) | 0x96ccb0 / 0x96cdf0 | `raycast.rs:154` |
| Axis sweep | 0x1082960 | `raycast.rs:301` `sweep` |
| Touch handler (back-off + two L) | 0x107cb80 | `main_loop.rs:503` `touch_from` |
| Outline tracer: contact skipped when `half <= d` | 0x1082ff0, `cmp [contact+0x18], esi; jle` at 0x10831d4..0x10831d9 | `short_path/outline.rs:287` `d >= c.half` (same) |

## 2. Question 1: which planner made the nw = 5 path

The short pather. Evidence: (a) the engine asks the short pather for exactly this query (S -> G,
8.71 tiles, radius 0.2, target size 0, range 0; `runs/q161s.err` line 244); (b) the python port
of that pather, with only the corner callback changed to 0x107c590, returns the truth's five
points bit for bit (section 4); a tile/region planner would give tile centres (x.5), not the
shapes' corners (25,28), (25,27), (26,25) and the exact goal. The request site in the walk
(0x1210f60 -> 0x121263a, near target: short pather first, tile planner only after a failure;
case 330 s table) was not re-read here. The path-state byte 0 change 0x20 -> 0x25 was not decoded
(flag bits; SUSPECTED to mark "short path linked", not needed).

## 3. The scene (shapes in the search box x 19.2..30.9, y 20.31..36.2)

r = 838860 (0.2), d = 0x200000 - r = 1258292; smoothing d' = 0x200000 - r/2 = 1677722.
Goats (master 1060, radius 0.3, standing; shape = `refreshed_rect`, rounded to even by the mesh):
9512 (24.5,26.5), 9514 (26.5,25.5), 9516 (25.5,27.5), 9518 (24.5,27.5), 9525 (26.5,22.5),
9526 (27.5,22.5); shrunk boxes are the unit tiles exactly, e.g. 9516 stored
(103599308, 111987916, 110310196, 118698804), shrunk (104857600, 113246208, 109051904, 117440512)
= [25,26]x[27,28]; 9518 shrunk [24,25]x[27,28]. Trees (from the replay header's object records,
unit 348, radius 0.5): 9400 (22.5,31.5) whose shrunk corner (97307852, 135056588) is 4 units
from S (this is the corner of the walker's previous path), 9393 (27.5,29.5), 9398 (32.5,32.5),
the row at y = 19.5. Town centre 9359 (27,34) and three standing villagers near (25,36) were
added; they are never touched. The walker 9383 and 9381 are moving (no shape; `ignore_shapes=[]`).

Adjacent goats touch exactly: 9516/9518 stored overlap 2516584 wide -> contact half 1258292 = d,
so the contact is skipped in both builds (0x10831d4 `jle` = `outline.rs:287` `d >= half`): each
goat is its own polygon and the line x = 25 between 9518 and 9516 is a zero-width crack.

## 4. Both searches, step by step (python port, `log_clip.txt` / `log_token.txt`)

Common part (identical in both):
1. Start S = (97307856, 135056592) is free (tree 9400's box ends 4 units short). Start ray
   (callback 0x107cfb0 = Box) toward G: 9516's HighY side is crossed at t = 2233417 in tile
   (25,28), then re-tested in the hit tile with `ua == t` -> touch, t = 2233417 - 0xa3d7 =
   2191474 (same mechanism as case 88 step 3e).
2. Touch handler 0x107cb80: back-off point W = S + (G-S)*(t - 0x66666) = (24.761446, 28.867624)
   (fraction 1772044), g = 3.680060; centre of 9516 (25.5,27.5); legs: side node on 9518 HighY (24.761446, 28),
   g = 4.547685; side node on 9516 HighY (25.5, 28), g = 5.286238.
3. Pop (24.761446,28): 9518's polygon [(24,28) LowX, (24,27) LowY, (25,27) HighX, (25,28) HighY];
   corner nodes (25,28) g = 4.786238 f = 8.932543 (sides HighX->HighY, token HighY) and
   (25,27) g = 5.786238.
4. **Pop (25,28) — first divergence.** Corner ray (25,28) -> G (t start 0x466666). Tile (25,28)
   holds 9516 and 9518 (in this order in the reproduction).
   - 188329, callback 0x107c590: ray box [25, 26.895834] x [24.3125, 28]. 9518's shrunk box
     [24,25]x[27,28] clipped to it is [25,25]x[27,28]: `0x96cdf0` false, **9518 skipped**. 9516's
     clip [25,26]x[27,28] is non-empty: `0x1084210` gives a touch at the start (result 3 -> 2,
     `cmp eax,3; cmove` at 0x107c842), side HighY, t = 0. Result 2 on **9516** -> touch handler
     toward 9516's centre: side nodes (25.5,28) on 9516 HighY and **(25,27.5) on 9516 LowX**
     (the crack side), g = 5.286238.
   - Engine, `Callback::Corner(HighY)`: 9516 touches at start on HighY = the token -> ignored,
     token := 9516's; 9518 touches at start on HighY (its top side ends at (25,28)) -> not the
     token -> Touch on **9518** -> legs toward 9518's centre: (24.5,28) on 9518 HighY and (25,27.5)
     on 9518 HighX. The crack side node lies on the polygon already walked: re-walk, nothing new.
5. 188329 continues: pop (25,27.5) on 9516 -> 9516's polygon, corner (25,27) (LowX->LowY)
   g = 5.786238. Its ray toward G: 9518, 9512, 9516 all clipped away (zero-width), 9514's LowX
   crossed at (26, 25.58) then re-tested -> touch t = 2170436 -> touch handler: back-off point
   (25.791458, 25.878042), side nodes (26, 25.878042) g = 7.367804 and (26, 25.5) on 9514 LowX.
   9514's polygon -> corner (26,25) g = 8.245847; its ray to G is clear -> terminal goal
   g = 9.375083. The engine's branch through (26,28) reaches the goal only at 10.459523.
6. Path back and smoothing (d' = 0.4): raw `G, (26,25), (26,25.878042), (25.791458,25.878042),
   (25,27), (25,27), (25,28), (24.761446,28), W, S`; smoothed `S, (25,28), (25,27), (26,25), G`.
   As waypoints (x, 0, y floats): `9A99B941 00000000 CDCC0042 | 0000C841 00000000 0000E041 | 0000C841
   00000000 0000D841 | 0000D041 00000000 0000C841 | AB2AD741 00000000 0080C241` = the truth's `wp` hex exactly.
7. Engine (token): after step 4 the cheapest route is via (26,28) -> 9514's top (26.485876, 26)
   -> (26,25) -> G, smoothed to `[S, (26,28), (26,25), G]` = `q161s.err` line 244 exactly.

Order check (200 random insertion orders of the shapes): clip callback -> the truth path in all
200; token callback -> the engine's path in 37 (9516 before 9518 in tile (25,28)), otherwise
`[S, (25,28), (25,26), G]` (the touch moves to 9516, then the (25,27) corner's token ray touches
9512 at start). The token callback never gives the truth.

## 5. Confirmed difference

**D1. The corner (type-3) ray's callback.**
- Original: 0x107fe1d `lea rcx, 0x107b1b0` -> 0x107c590 (asm, whole function):
  - `dx == 0` (0x107c614): sweep `0x1082960(mesh, ignore, d, a, b, dir = dy>0 ? 2 : 0, &shape,
    &side, &point)`; found -> `t = ((dy>0 ? hit.y-a.y : a.y-hit.y) << 22) / dy` (signed `idiv` by
    dy, 0x107c65f..0x107c67f: **negative for a ray toward -y**), return 1; else return 0.
    `dy == 0` (0x107c68c): the same along x, dir = dx>0 ? 1 : 3, divided by signed dx
    (0x107c6d6..0x107c6f4).
  - otherwise (0x107c705..0x107c895): box = ray's bounding box (no growth); per shape of the tile
    not ignored: clip = box ∩ (stored rect shrunk by d); only if `x0 < x1 && y0 < y1` (0x96cdf0):
    `k = 0x1084210(a, b, shrunk, &copy of t, &side)`; `k != 0`: `k == 3 -> 2`, side, t, shape
    written; return the last k. No token anywhere.
- Engine: `main_loop.rs:232-234` uses `Callback::Corner(emit.token)`; `raycast.rs:113-130`: no box
  test, a touch at start on the token's side or shape is ignored and replaces the token, others
  become `Touch`; axis rays go through `ray_rect`'s axis branches. No 188329 branch.
- Implementation (under `GENIE_EXPERIMENT_SHORT_188329`), `raycast.rs`:

```rust
/// 188329 `0x107c590` (thunk `0x107b1b0`), the corner node's ray: an axis ray is the axis sweep
/// (`0x1082960`), result 1 with `t = (|hit - a| << 22) / delta`, delta signed as the game divides;
/// any other ray is callback C (box not grown, zero-area clips skipped, 3 -> 2).
pub(super) fn corner_ray_188329(
    &self,
    a: FixedPoint,
    b: FixedPoint,
    t: &mut RayFraction,
) -> Result<Option<(Meet, Hit)>, GenieError> {
    let dx = b.x().wrapping_sub(a.x());
    let dy = b.y().wrapping_sub(a.y());
    if dx != 0 && dy != 0 {
        return self.raycast(a, b, t, Callback::Sight);
    }
    let (dir, delta) = if dx == 0 { (AxisDir::of_dy(dy), dy) } else { (AxisDir::of_dx(dx), dx) };
    let Some((shape, side, at)) = self.sweep(a, b, dir)?.counted()? else {
        return Ok(None);
    };
    if delta == 0 {
        return Err(GenieError::unsupported("a corner ray to its own point (division by zero)"));
    }
    let (h, s) = if dx == 0 { (at.y(), a.y()) } else { (at.x(), a.x()) };
    let num = if 0 < delta { h.wrapping_sub(s) } else { s.wrapping_sub(h) };
    *t = RayFraction::new(((i64::from(num) << 22) / i64::from(delta)) as i32);
    Ok(Some((Meet::Cross, Hit { shape, side })))
}
```
  and in `main_loop.rs` `corner_expand` replace lines 232-234 by
  `let mut found = if super::build_188329() { self.ctx.corner_ray_188329(p, t, &mut frac)? }
  else { self.ctx.raycast(p, t, &mut frac, Callback::Corner(emit.token))? };`.
  The rest of `corner_expand` stays (188329 touch -> `touch_from`, cross -> side node, none ->
  terminal). `Callback::Sight`'s diagonal branch (`raycast.rs:131-167`: box not grown, strict
  clip, `ray_rect`, TouchAtStart -> Touch, t and hit written only on a hit) is exactly
  0x107c590's diagonal branch. Calling the sweep once instead of per tile gives the same result:
  0x107c590's axis branch ignores the tile and the walk visits at least one tile. `emit.token`,
  `NUDGES` and `corner_axis` become unused in 188329 mode.

Which queries change: only those where a popped corner node's ray differs between the two
callbacks: (a) a shape whose shrunk box meets the ray's box with zero width or height (touching
or collinear neighbours at the corner: goats/sheep on adjacent tiles, a box ending exactly on the
corner's line), where the token code reports a touch or ignores a different shape; (b) a touch
within the tolerances (0x1062) on a shape lying outside the ray's box; (c) axis-aligned corner
rays (sweep instead of `ray_rect`'s axis branch; t negative toward -x/-y). Start rays (Box) and
smoothing (Sight) are unchanged. Crossings strictly inside the ray's box are the same.

Reference replay 518239882: the change cannot be proven harmless by reading. Case 88 s's corner
ray C -> T gives the same touch (t = 3372659, shape 4349) under both callbacks (case 88 S1), so
88.1 s stays. Elsewhere, its matching paths are mostly villagers around floating-point positions
(no exactly touching boxes, no axis rays), where (a)-(c) do not arise, but sheep herds on adjacent
tile centres can make case (a). **The 0..384 s path comparison of 518239882 must be re-run**
(`cmp_paths` / `cmp_pos`, and the 88.1 s and 330.1 s cases), and 518470161 re-run to 8.9 s.

## 6. Suspected / not needed

- S1: the axis branch's negative t for rays toward -x/-y (0x107c67c, 0x107c6f1 `idiv` by signed
  delta) looks like a bug in the game; read in asm, its effect downstream (the side node at
  `p + (T-p)*t >> 22` behind the corner, then `settle`) not traced. Reproduce it as written.
- S2: the order of 9516 / 9518 in the engine's tile (25,28) list is inferred from the engine's
  output (only that order reproduces it), not printed.
- S3: shapes not in the reproduction (terrain-blocked tiles, decorations 1358/1902, the TC's
  annex parts) were assumed absent or irrelevant; the truth and the engine output are both
  reproduced exactly with the scene of section 3.

## 7. Not read

0x107c8c0 (sight callback body), 0x1082960 (sweep; the engine port was assumed), the walk's
request site 0x1210f60 / 0x121263a for this request, the path-state byte 0x25.
