# P3: villager 4363 ends at y = 46.2 instead of 46.22 (replay 518239882, 155.4 s)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Sources: `out_c/h1.c` (Hunt update 0xbb6230, set_state
0xbb4a80), `out_r4/walk.asm` (walk 0x1210f60), `out_r4/a.c` (slide 0x12198f0), capstone (`dz.py`)
of 0x1116f60 and 0xbb5a40..0xbb5b60, truth `truth/truth4.jsonl`, engine trace `runs/pJ.err`.
No new Ghidra run was needed (`proj_p3` was not created).

**Result.** The premise "the original takes one more walk step" is wrong. The walk ends at
y = 46.21999 in the original exactly as in the engine (same update, same rule: the step's only hit
is the level's target). The MoveTo range rule is not involved and needs no change. What the engine
lacks is a **position snap in the Hunt's `set_state(6)`**: for a target of class 15 (tree), 8 or 32
(mines) the original calls `0x1116f60(unit, target)`, which puts a unit that stands in the tile
straight above/below/left/right of the target's tile exactly against the target's footprint. Here:
y = 45.5 - (0.2 + 0.5) * (-1) = 46.2 (bits `CDCC3842`, equal to the truth). This is R3's "N3" for
Gather type 5; the Hunt has the second (and only other) call site, which nobody had written up.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Hunt vtable; start / update / set_state (slots 0x28 / 0x30 / 0x80) | 0x32274b8; 0xbb2fc0 / 0xbb6230 / 0xbb4a80 | `gathering/hunt/` (`start.rs`, `update.rs`, `gathering.rs`) |
| Hunt update, state 4: list code 1 or 2 -> 0xbb2ae0, `set_state(6)` | `h1.c` (0xbb6230) case 4 | `hunt/update.rs:225-243` `walk_arrived` |
| Hunt set_state case 6, end: class test + snap + timer 0 + sprite | 0xbb5acd..0xbb5b54 (snap call 0xbb5b2f) | `hunt/gathering.rs:100` `set_face`, `:182` `begin_face` |
| **Snap to the resource** | **0x1116f60** (callers: 0xbb5b2f Hunt, 0xb7f78d Gather; no others in `calls_dst.npy`) | none |
| Unit position setter, unit slot 0x60 | 0x1224f60 | as used by `movement/waypoint.rs:163` `take_waypoint_place` (`set_position`, `grounded`, `moved_to`) |
| Walk: reach test result 1 -> AT_WAYPOINT + REACHED | 0x121463e..0x121466f | `movement/` walk (R4 step 32) |
| Walk: one hit and it is the target -> REACHED on, AT_WAYPOINT off, MET_TARGET on, restart | 0x1214d50..0x1214da4 | `movement/path_end.rs:591-597` (`at_target`) |
| Walk: REACHED with AT_WAYPOINT -> slot 0x60 to the waypoint | 0x12113c7..0x1211442 | `waypoint.rs:78-80` |
| Slide of the projected point (classes 3, 27, 39, 52, 67 with speed <= 0 only; writes only the projected point) | 0x12198f0 (`a.c`) | `path_end.rs:586-590` comment |
| Quiet MoveTo update (not the cause; R2 section 2.2 stands) | 0xb93260 | `movement/move_to/` |

## 2. What the original does, in order (with this case's numbers)

Data. Truth level blob of 4363 while walking (`ps`): type 0, link 1, state 3, **range +0x2c = 0.0**,
**target +0x30 = 0xd67 = 3431**, tries 10. Object 3431: Gaia, master 1349, state 3, at
(22.5, 45.5), a tree (class 15); its radius 0.5 follows from the truth end position (not read
from the DAT). Unit: radius 0.2, tile (22, 46); tree tile (22, 45). Waypoints
`[(22.6856, 47.4169), (22.4366, 47.1038), (22.1335, 46.6), (22.1335, 46.2)]`.

Truth rows of 4363:

| ms | y | velocity | level blob | held |
| --- | --- | --- | --- | --- |
| 155180 | 46.3799934 | 0.8 | walked level, wp 3 | 0 |
| **155380** | **46.21999** (`45E13842`) | **0** | **reset level (target -1, no path, tries 10)** | 0 |
| 155595 | 46.2 (`CDCC3842`) | 0 | reset | 0.06435 |

So at 155380 the original already stands at 46.21999 **with the path gone and speed 0**; it never
walks from there. (A walk on to the waypoint would show a live path at 46.21999 or 46.19999.)
held(155595) = 0.06435 = 0.39/s x 0.165 s = the six updates 155455..155595, i.e. work state 7
entered at 155430: the same timing as the engine (state 6 at 8327, 7 at 8328).

1. Update 8326 (155380), walk 0x1210f60 at y = 46.21999, waypoint (22.1335, 46.2), target 3431:
   reach test (slot 0x670): now = 0.019989, step = 0.8 x 0.025 = 0.02 > now, after = 1e-5 <= now
   -> result 1 -> flags AT_WAYPOINT and REACHED on (0x121463e..0x121466f). The projected point
   y = 46.19999 overlaps the tree's footprint by 1e-5, so the collision query returns the tree as
   the only hit; it is the level's target (`cmp [r14+8], eax; cmove r12d, edi`, 0x1214a17).
   `cmp [rbp+0x1e4], 1; jne` / `cmp r12d, 1; jne` (0x1214d50..0x1214d5d): flag 0 on, **flag 1
   (AT_WAYPOINT) off** (edx = edi, which is 1 on every path out of the loop), flag 2 on; restart.
   REACHED without AT_WAYPOINT: no position write; the levels end; reset, stop. The unit stays at
   46.21999. The engine does the same (`path_end.rs:591`), and the truth row 155380 shows it.
   The slide 0x12198f0 does not touch a tree (classes 3/27/39/52/67 only) and only edits the
   projected point.
2. The quiet MoveTo reports arrival; update 8327: Hunt state 4, list code 1 -> `0xbb2ae0`, then
   `set_state(6)` (`h1.c` case 4).
3. `set_state(6)` (0xbb4a80 case 6): sub-actions cleared, state stored; target not live livestock
   (class 58 with state <= 2 goes elsewhere); dead-livestock raw class 58: `range + 0.1 < gap` ->
   `set_state(4)`; class 49 of another player: ownership path. Then (0xbb5b11..0xbb5b2f):
   `cmp ax, 8; je` / `cmp ax, 0x20; je` / `cmp ax, 0xf; jne skip` -> `0x1116f60(unit [rsi+0x10],
   target [rsi+0x20])`. Then timer `+0x44 = 0`, sprite (0xbb37b0 -> unit slot 0x70).
4. `0x1116f60(unit, target)` (read in full, disassembly):
   - `dx = (int)tx - (int)ux`, `dy = (int)ty - (int)uy` (cvttss2si each, then sub; 0x1117063..0x111707b).
   - `dx != 0 && dy == 0` (0x111707d..0x1117088): `x = tx - (unit.rx + target.rx) * (float)dx`
     (movss unit +0x78; addss target +0x78; mulss; subss), `y = uy`.
   - `dx == 0 && dy != 0` (0x1117195): `y = ty - (unit.ry + target.ry) * (float)dy` (+0x7c radii,
     0x1117208..0x1117257), `x = ux`.
   - both zero or both non-zero: return, nothing written.
   - z = the unit's own z (obj+0x180 decoded); call unit slot 0x60 (rcx = unit, x, y, z) (0x11172a4).
   - `dx`, `dy` are not clamped to +-1.
   Here dx = 22 - 22 = 0, dy = 45 - 46 = -1: y = 45.5 - (0.2f + 0.5f) * (-1.0f) =
   45.5 + 0.69999999 = 46.2000008 = `CDCC3842`; x unchanged 22.1335011. Equal to the truth.
5. Update 8328: state 6 faces (0x1226330, no position write) -> `set_state(7)`; work from 8329.

## 3. Confirmed difference

**D1. Hunt `set_state(6)` snaps the unit against a tree / mine target.**
Original: 0xbb5b11..0xbb5b2f and 0x1116f60 (section 2, steps 3-4). Truth: 46.21999 with the path
already gone, then exactly `CDCC3842`.
Engine: `gathering/hunt/gathering.rs:100-179` `set_face` ends in `self.begin_face(c, unit, r)`;
`begin_face` (`:182-203`) sets state, timer and sprite only. No position write anywhere in
`gathering/hunt/` (grep: `new_position(`, `snap`: none). No existing switch covers it
(`GENIE_EXPERIMENT_HUNT_188329` is only the livestock search at `hunt/unit.rs:434`;
`GENIE_EXPERIMENT_MOVETO_188329` is only the MoveTo wait at `move_to/mod.rs:123`).

Implementation. No `GENIE_EXPERIMENT_MOVETO_RANGE_188329` is needed: nothing in the MoveTo or in
the walk's range test changes. Put it under the existing **`GENIE_EXPERIMENT_HUNT_188329`**
(it is a Hunt rule and that switch is on in this run). In `HuntAction::set_face`
(`gathering/hunt/gathering.rs`), on the path that reaches the final `self.begin_face(c, unit, r)`
(line ~178; not on the returns to walk / lead / attack / unsupported, and not in `begin_face`
itself, which `walk_arrived` also calls for a hunt without target), immediately before
`begin_face`:

```
if hunt_188329 && target class is 8, 32 or 15 {
    let (ux, uy, uz) = unit position;  let t = spatial.get_known(self.target);   // position, radius
    let dx = t.x as i32 - ux as i32;   let dy = t.y as i32 - uy as i32;           // truncation
    let to = if dx != 0 && dy == 0 { (t.x - (unit.rx + t.rx) * dx as f32, uy, uz) }
        else if dx == 0 && dy != 0 { (ux, t.y - (unit.ry + t.ry) * dy as f32, uz) }
        else { none };
    // unit radius first in the sum; sum, then multiply, then subtract (f32)
    position setter as slot 0x60: the same calls `Mover::take_waypoint_place` makes
    (`set_position`, `grounded`, `moved_to` with now), `movement/waypoint.rs:176-190`
}
```
then the existing timer 0 and sprite. The Gather type-5 twin (call site 0xb7f78d, R3's N3,
`gathering/gather/work.rs:33` `set_face`) is the same function and should share the helper.

What else it alters. Every Hunt-kind arrival at a tree or mine (and each later `set_state(6)`,
e.g. back from the drop site) where the unit's tile is orthogonally in line with the target's
tile. Unaffected: diagonal tiles, same tile, other target classes (animals, bushes, farms).
It reduces to the old result when the unit already stands at `t -/+ (r + R)` on that axis: then
the same float is written again. That is the case when the walk ends on its last waypoint with
AT_WAYPOINT (R4 step 5: the unit is put on the waypoint, which for a radius-0.5 target is the
touching coordinate, as here: waypoint y = 46.2 = snap y). It differs only when the walk ends by
the target-hit rule short of the waypoint, which needs the last step to land less than one step
(0.02) before the touching coordinate while the projected point overlaps: this case is the first
one in the replay (all earlier arrivals were bit-equal; I did not re-derive each of them).
Since `moved_to` stamps the unit's last move time when the place changes by more than 1e-7, the
snap can also change later collision ranking of neighbours; that is what slot 0x60 does in the
walk too.

## 4. Suspected

- The wood-cutter's action class in the original is the Hunt (vtable 0x32274b8): inferred from
  the engine's task kind 110, the matching state timing (6 then 7, work rate 0.39/s) and the
  fact that both callers of 0x1116f60 apply the same class-15 rule; the action factory for task
  type 110 was not read. If it were Gather type 5 the snap is the same function (0xb7f78d).
- Slot 0x60 (0x1224f60) is assumed to equal the engine's position setter path used for
  AT_WAYPOINT (map-edge clamp, ground height, last-move stamp); only its prologue was read.

## 5. Not read

- 0x1224f60 body; the collision query 0x111c660 (that the tree is the only hit at the projected
  point is inferred from the 1e-5 overlap and from the truth's reset path at 46.21999).
- Tree master 1349's radius in the DAT (0.5 inferred from `CDCC3842`).
- 0xbb2ae0 beyond the decompile (task-0x124 flag flip, no position write).
- Earlier arrivals were not individually re-checked against the snap formula. If one should
  change after implementing: trace, in `set_face`, unit id, position before, target id/position/
  radius, dx, dy, position after, for the update where the Hunt enters state 6.
