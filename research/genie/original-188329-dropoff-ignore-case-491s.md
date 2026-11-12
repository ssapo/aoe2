# P29: replay 518470161 (truth5), P2 wood -10 at 493.779 s: lumberjack 9383's drop-off walk at update 37653 (491.673 s)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Engine runs (PC `runs\`, default switches, both left by the
earlier attempt and reused): `P29_1` (OBJECT, all objects, updates 37100-37840), `P29_2` (STEER +
PATHS + OBJECT for 9383/10428, 37600-37700). Truth slice `~/p29/t.jsonl` (440-497 s) on the PC VM.
Scripts on the PC VM in `~/p29`: `cmp.py` (3-sample compare), `tu.py`/`tx.py`/`lv.py`/`pid.py`
(truth decode: waypoints, level blob, path ids), `sim29*.py` (this scene on `out_p19/sp.py` +
`esc.py` + `run19.py`). Decompiles here: `q1.c` (0x120cb90, 0x111c660, 0x111cb80, 0x1121280,
0x111ced0), `q2.c` (0x111c050, 0x111c390), `q3.c` (0x107a390, 0x1083e60, 0x1077790, 0x10776c0);
existing `out/d11.c` (0x120ee10, 0x1207520), `out/mv.txt` (walk 0x1210f60). Ghidra copy `projP29`.

**Result.** Not a resource choice. The first differing P2 object is **villager 9383 (master 123,
carrying 10 wood to lumber camp 10446)**, first differing truth sample 491.712 s, cause at update
37653. 9383 and lumberjack 10428 meet head-on and both stop (update 37645, both builds bit-equal).
After the 0.1 s pause the original's 9383 gets a path at once (37653) and walks on; the engine's
short path is `Partial` again, it pauses a second 0.1 s and only leaves at 37661/37662, by another
route. It arrives later, so its 10 wood are dropped later. The original's three paths of 37653,
37654 and 37655 are reproduced to the last digit by the short-pather port **only if the short path
of 37653 ignores the four villagers around 9383 (10428, 10452, 10445 and 10417)**. That is the
drop-off ignore rule of 0x120ee10. The engine's rule adds nobody in that call
(`IGNORE walker=9383 list=[9383, 10446]`). One difference in the rule is confirmed on both sides
(query reach 0.9 vs 0.3, needed for 10417); why the engine's rule does not fire at all is
suspected, not confirmed (section 4), so the fix is not complete yet.

## 0. Symptom, with numbers

`cmp.py P29_1.err t.jsonl` (3 consecutive differing samples): 9383 pos from 491.712 s; 10428 pos
from 491.712 s; 10452 pos 492.648; 10417 pos 493.090; 10428 held 493.324; 10417 held 493.779.
Nothing earlier in 484.5-491.7 s.

Scene at update 37652 (OBJECT, bit-equal to truth 491.478 s where sampled): 9383 (14.8781376,
48.0761642) standing since 37645, action state 8; 10428 (15.1258469, 47.8979378) standing since
37645; 10452 (15.1400347, 48.3993034, carrying, state 8) standing; 10445 (14.5089340, 47.8596077)
standing; 10417 (15.2, 48.7107468) chopping; camp 10446 at (17, 49), half 1.0. 10428, 10452 and
10445 take their first step in 37653 (after 9383's turn in that update).

Engine (`P29_2`): 37645 two `SHORTPATH ... Partial [(14.878138, 48.076164)]`; 37652 10428 and
10452 replan; **37653 `IGNORE walker=9383 list=[9383, 10446] ... levels=[(Planned, wp 1, 2 pts),
(Top, wp 1, 2 pts)]`, `SHORTPATH ... to (71303168, 205520896) ignore_shapes=[39] result=Partial`**;
stands until 37661: `Reached [(14.878138, 48.076164), (15.8, 48.40921)]`; first step 37662.

Truth: 9383 at 491.712 s (= update 37656): position (14.9055691, 48.09091), path id `ps+0` 0x122F,
wp `[(14.89652157, 48.08578110), (15.24448395, 48.28306580), (15.8, 48.40921021)]`; parent level
pointer changed (0x..4d36ac80 -> 0x..4d37e0f0), tries 10, pause 0. 10428 at 491.712 s: (15.1113033,
47.8830681) = two steps on its new path (same path as the engine's, id 0x122B), then pause 0.074
(0.1 set in 37654), paused again until about 37693. Path ids between: 0x122B 10428, 0x122C 10452,
0x122D-0x122F all 9383's (nobody else holds them), i.e. one new path in each of 37653, 37654, 37655.

Hand reconstruction of 9383's two steps (speed 0.0104001 per update):
- step 1 from (14.8781376, 48.0761642) toward (17, 49) (23.528 deg) -> (14.8876731, 48.0803158);
- step 2 toward the circle point on the top edge of 10428's box with 10428 at its 37653 position
  (15.1185751, 47.8905029): edge y 48.2905029, point (15.227998, 48.290503) -> (14.8965216,
  48.0857807). Truth wp0: (14.89652157, 48.08578110): equal to 4e-7.
The engine's straight path of 37661 points 19.86 deg (to (15.8, 48.40921)); that direction is
excluded (it misses wp0 by 6e-4).

Port runs (`sim29d.py`, `sim29b.py`; start fixed (62403432, 201646048), goal (71303168, 205520896),
r 838860, half 1.0, shapes of the units above + camp + trees 3943/3976/4009/4040/4070):
| ignored | result |
|---|---|
| none (10428, 10452, 10445 standing) | Partial (the engine's 37653 answer) |
| 10428, 10452, 10445 | Reached `[(14.878138, 48.076164), (15.8, 48.409210)]` (19.86 deg, not truth) |
| 10428, 10452, 10445, **10417** | Reached `[(14.878138, 48.076164), (15.8, 48.477531)]` = on the line to (17, 49): **truth step 1** |
| 37655: start (62480540, 201686384), 10428 standing at (15.1113033, 47.8830681) | `[(15.244484, 48.283066), (15.8, 48.409210)]` = **truth wp1, wp2 bit for bit** |
Units with no shape (moving) instead of ignored give the second row, so the three neighbours were
standing obstacles that the list removed, and 10417 was on the list too.

## 1. Address table

| Role | 188329 | Engine |
|---|---|---|
| Walk function; tail short try; goal = target place when every level is on its last waypoint | 0x1210f60 (`mv.txt` 962-1045) | `movement/request_plans.rs:320-360` `short_try` |
| Ignore list builder, called with (unit, target, start x, start y, level waypoint x, y, list) | 0x120ee10, call 0x1212dcf (`movss xmm2,[rbp+0x80]; xmm3,[rbp+0x88]`; stack = `0x1076260(path, level+0x24)`) | `movement/new_path.rs:198` `ignore_list`, `line` from `request_plans.rs:243` |
| Rule skipped for a moving walker (slot 0x610 != 0) | 0x120ee10 (`d11.c`: `iVar10 = (*+0x610)(); if != 0 goto end`) | `new_path.rs:226` `!self.is_moving()` |
| Rule query: buffer `radius * 4.0 + 0.1` (0x31fd878 = 4.0, 0x3202890 = 0.1), point query flags 0x20 at the unit's place, factor 1.0, up to 0x80 hits | 0x120ee10 -> 0x1121350, 0x111c660 (flag 0x20 -> 0x111ced0) | `new_path.rs:230` `grow = radius + range_floor` (0.3) |
| Gate: hits > 0, own class 4 / 0x15, target, slot 0x2c8 == 8, then start test once | 0x120ee10 (`d11.c`) | `new_path.rs:224-229`, start test per hit `:275` |
| Per hit: object, not moving (0x610), not target/self, current level's path not made now (0x570 -> +0x18 -> +8), class 4/0x15 or slot 0x528 == 1, start test true, allied (0x1732ca0), gap^2 to target (0x124daf0) > radius^2 | 0x120ee10 loop | `new_path.rs:243-281` |
| Start test: ctx = unit radius, **target's radii (always)**, range (slot 0x248), mask; from = start, to = level waypoint; true when start node returns 2 | 0x107a390 -> 0x1077790 -> 0x1083e60 -> 0x107e820 | `new_path.rs:295` `start_blocked`, `pathing/short_path/call.rs:315`, `start.rs:64` |
| Close-in / straight check: `0x120cb90` with buffer scale 1.0 (flag 0) or 0.5 and unit records skipped (flag 1, `mgr+0x88`) | 0x1207520 (`d11.c`), 0x120cb90, 0x111cb80 (`q1.c`) | `movement/waypoint.rs:376` `close_in` |
| No path, tries left: pause 0.1 (slot 0x640), stop line 0x192d | `mv.txt` 1532-1536 | `new_path.rs:68-76` |
| Unit stop (slot 0x618): speed 0, clear ignore list 0x1255e40; levels stay | 0x1224d50 | `Mover::stop` |

## 2. The original's logic for this case (execution order)

1. 37645: 9383's walk meets moving 10428; two path objects (ids 0x1227, 0x1228) and no path:
   pause 0.1, stop. 10428 likewise stops on (15.1258469, 47.8979378). (Engine identical.)
2. 37652: 10428 and 10452 replan (ids 0x122B, 0x122C; same paths as the engine). No velocity yet,
   so they are still standing obstacles when 9383 is updated in 37653.
3. 37653, 9383 (pause over, level asks again): 0x120ee10: list = [9383, 10446]; walker not moving,
   class 4, action state 8, target set; query 0.9 around (14.878, 48.076) hits 10428, 10452, 10445,
   10417; start test says blocked; every hit is a standing allied villager whose path was not made
   in this update -> list = [9383, 10446, 10428, 10452, 10445, 10417] (order by the grid).
   Short path with goal (17, 49): start ray free -> path id 0x122D
   `[(14.878138, 48.076164), (15.8, 48.477531)]`.
   (Inferred from the truth by reproduction, table in section 0; the branch itself is not visible.)
4. 37654: step 1 walked. The walk's query meets 10428 (moving since 37653, at (15.1185751,
   47.8905029)); it is kept, gets a temporary shape, new path 0x122E over the top edge of that box.
   10428's own step in 37654 is blocked by 9383: pause 0.1.
5. 37655: step 2 walked to (14.89652157, 48.08578110). 10428 now stands at (15.1113033,
   47.8830681) with a shape: new path 0x122F = the truth's 3 waypoints. 9383 walks it to the camp.

## 3. Confirmed difference

**D1. Reach of the drop-off rule's query.** Original: buffer = `radius * 4.0 + 0.1` = 0.9 for a
villager (0x120ee10, `d11.c`: `0x1121350(mgr, 1, [master radius] * DAT_1431fd878 + DAT_143202890)`,
constants read: 4.0, 0.1). Engine: `movement/new_path.rs:230`
`let grow = self.stats.radius.x() + movement_tuning.range_floor;` = 0.3. Here 10417's box is 0.4346
from 9383's centre: inside 0.9, outside 0.3; with 10417 not ignored the path is the 19.86 deg one,
not the truth's (table rows 2 and 3). Also seen in the same trace: 10452 at 37652 gets
`list=[10452, 10446, 9383, 10417]`; 10428 (box gap 0.3014) is missed by 0.0014 (there it would be
passed anyway: its path was made in that update).
Implementation (new switch `GENIE_EXPERIMENT_DROPOFF_REACH_188329`), `ignore_list`:
```rust
// 188329 0x120ee10: the query's buffer is radius * 4.0 + 0.1 (0x31fd878, 0x3202890)
let grow = if std::env::var_os("GENIE_EXPERIMENT_DROPOFF_REACH_188329").is_some() {
    self.stats.radius.x() * 4.0 + 0.1
} else {
    self.stats.radius.x() + movement_tuning.range_floor
};
```
D1 alone does not move this case: at 37653 the engine's rule adds nobody at all (D2 below).
Side differences read in the same function (no effect here): the original gates on the walker's own
class 4 / 0x15 and runs the start test once before the hit loop (both already noted by P16/P19).

## 4. Suspected

**S1 (the missing half): why the engine's rule adds no one at 37653.** In that call 10428, 10452
and 10445 are within 0.3, standing (their shapes are still in the mesh: the engine's own answer is
`Partial`, which the port only gives with those three shapes present; `MoveState::of_mover` and
`Gait::moving` use the same velocity test, `movement/mod.rs:302`, `objects/unit/top.rs:121`),
allied villagers, paths not made in 37653. The only test left is `start_blocked`
(`new_path.rs:275`). The port of the start node (`sim29e.py`, own shape in the mesh as in P19) gives
**Stuck, 0 candidates** for goal (17, 49), so with that goal the rule would fire. The start test's
goal is not the short path's goal: it is the walked level's waypoint (`line`,
`request_plans.rs:243`; original the same, call 0x1212dcf), and the request of 37653 comes from the
**Planned** level (`levels=[(Planned, ..), (Top, ..)]`), while 10452's request at 37652, where the
rule did fire, came from the Top level (waypoint (17, 49)). If the engine's Planned waypoint lies
within the camp's half + radius (1.2) of 9383 in x and y (a tile centre such as (15.5, 48.5)), the
start node answers "in range" (`start.rs:66`), not "stuck". For the original to fire, its start
test's waypoint must be out of that range, so either the original's planned path ends elsewhere
(the tile planner's known unported result rules: R16-D1, R4-D9, R16-D3) or its request at 37653 is
made from another level. Neither side was read or traced: the engine trace does not print the
Planned level's points, and the truth has no blob of the parent level.
Next step (one engine diagnostic, update 37645-37653, unit 9383): in `ignore_list` print
`w.waypoint`, the candidates with `moving` / `path_made`, and `start_blocked`'s `Started` value; in
`first_tile_plan` print the tile plan's result and points. Then: waypoint near and `InRange` ->
compare the planned path with 0x1057a40's for this query; `Stuck` -> the loss is in the candidate
filter. Expected after both fixes: 37653 `SHORTPATH ... Reached [(14.878138, 48.076164),
(15.8, 48.477531)]`, 37655 `[(14.896522, 48.085781), (15.244484, 48.283066), (15.8, 48.40921)]`,
9383 at 491.712 s on (14.9055691, 48.09091).

S2. Step 3's branch (rule fired, list of four) is inferred from the path, not read from the truth.
The alternatives were excluded by number: close-in (0x1207520 flag 0, buffer 0.2: the line to
(17, 49) crosses 10417's grown box at (15.4168, 48.3107) and 10428's bare box by 0.001), unit shapes
absent, three ignored without 10417.

## 5. Not read

- 0x111ced0 (the point-mode cell test of the rule's query); taken as "box grown by the buffer holds
  the point", like the engine's `obstruction_candidates`.
- 0x107e820's escape scan was not re-read (P19 did); the port was used.
- The tile planner 0x1057a40 for this query; trees outside the five in the truth list (the scene's
  west side) are missing from the port's mesh; they do not lie between 9383 and the camp.
- Which of 0x1227/0x1228 is the planned path in the original.

## 6. What D1 changes elsewhere

Every drop-off walk (action state 8, class 4/0x15) that starts from standing while its start is
blocked: villagers standing up to 0.9 (was 0.3) from the walker's box are ignored by its short
path. P19 counted 0 additions in 748 IGNORE lines before 215 s, so it is rare; it shows where
several lumberjacks/shepherds stand packed at a camp or town centre. Walks whose start test is not
"stuck" are unchanged.
