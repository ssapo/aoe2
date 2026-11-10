# P5: villager 4375 after GO_BACK_TO_WORK at 232.137 s (replay 518239882)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. "asm" = capstone (`dz.py`, `out_p5/unload.asm`), "dec" = Ghidra
(`out_p5/a.c`, `b.c`, `c.c`). Nothing was run on the PC; engine files and traces were only read.

**Result.** The let-out code (`0x12a16e0`) is the same as the engine's `let_out`/`came_out`. The
difference is one step earlier, in the **town-bell (back-to-work) record written when the new
villager is taken into its own building at creation**. The original writes the record from the
unit's *top action / own queued order*; a new unit has neither, so the record is
`target = -1, point = the unit's own position`, and that position is already the building's
(22, 50) because the record is written after the entry. The engine writes `target = the building`.
At GO_BACK_TO_WORK the original therefore finds **no object to work on** and calls the let-out with
the point (22, 50) and no work object: a plain point move to (22, 50). The engine finds the town
centre as the "work object" and issues a work command on the town centre (`came_out`'s `work_on`
branch, `garrison/let_out.rs:306-316`), which does nothing for an empty-handed villager; it
returns before `let_out_aim`, which is why the hypothesis switch had no effect.

## 1. Address table

| Role | 188329 RVA | Engine |
|---|---|---|
| Villager / building class vtable (TRIBE combat object; buildings inherit) | `0x32b71c0` / `0x32b4fa8` | - |
| Base unit vtable (given in the brief; NOT the villager's for slots 0x138, 0x1b8, 0x8a8...) | `0x32a4698` | - |
| Enter, villager override (slot 0x1b8): base enter, then town-bell order with 3 | `0x12c77f0` (call of `0x12baa00` at `0x12c78e8`) | `garrison/unit.rs` `Unit::go_inside` |
| Enter, middle layer / base (slot 0x1b8 of `0x32a4698`) | `0x1152ed0` -> `0x1250240` | `go_inside` |
| Container "add unit" base: list push, `unit+0x148 = container`, unit x,y = container x,y | `0x124aa20` (building slot 0x1d8 `0x1283ba0` -> `0x12c0340`) | `Place::go_inside`, `join_building` |
| Town-bell order (unit, target, filter): record, then flag `+0x664` | `0x12baa00` | `orders/town_bell.rs:573` `town_bell_order`; `garrison/unit.rs:557` `enter_town_bell` |
| Write the back-to-work record (`+0x634..+0x648`, second `+0x64c..+0x660`) | `0x12bacf0` | `orders/town_bell.rs:629` `record_town_bell`, `TownBell::record` |
| Top action's target object (slot 0x1a0) | `0x113bfd0` -> `0xb89f30`, `0xb69550` | `Action::top_target` |
| AI: target of the first own queued order (0x34-byte entries, issuer == own id, target >= 0) | `0xd271c0` | `own_order_target` |
| Read the record, return the object found | `0x12b6910`; object test `0x12abe00` | `TownBell::back_to_work`, `record_object` |
| Back to work (unit, building or null) | `0x12bc7e0` | `garrison/unload.rs:420` `World::back_to_work` |
| Building lets its villagers back to work (GO_BACK_TO_WORK 0x80 / 0x86, ALL 0x8c `0x16e27d0`) | `0x16f4ba0` | `garrison/unload.rs` `go_back_to_work` |
| Unload / place beside the building, then the order | `0x12a16e0` | `garrison/let_out.rs` `let_out`, `came_out`, `let_out_aim` |
| Spawn point search (5th arg `use_xy`) | `0x1288c20` | `production/spawn/search.rs` |
| Work command wrapper of the villager (slot 0x138) -> base -> slot 0x8a8 | `0x12c6590` -> `0x113b510` -> `0x12df320` | `gather_move` / `order_work` |
| Make action: gather work for the new unit | `0xbbab40` | `production/spawn/gather_walk.rs:219` `World::gather` |

The command at 232.137 s: body offset 0x45c0b of the replay, `80 01 04 00 42 0d 00 00` =
GO_BACK_TO_WORK (0x80), player 1, building 3394 (sum of the sync increments before it = 232137 ms).

## 2. The original's logic, in execution order

### 2.1 Creation (227.07 s)

1. `0xbbab40` step 4 (dec `out_r5/p1.c`): gather target == the building and garrison count < 10 (or
   < capacity) -> `unit.vtable[0x1b8](unit, building, 1, 0)`; return 0. For a villager the slot is
   `0x12c77f0` (vtable `0x32b71c0`), not `0x1250240`.
2. `0x12c77f0` (dec `c.c`, asm 0x12c77f0..0x12c781e): if `unit+0x148 != building`:
   a. `0x1152ed0` -> `0x1250240(unit, building, force=1)`: with `force != 0` no room test; leaves a
      previous container, leaves the map (slot 0x1f0), releases references, then
      `building.vtable[0x1d8](building, unit)` -> `0x124aa20`: push into the building's list
      (`+0x150`), `unit+0x148 = building`, `unit+0x170/+0x178 = building+0x170/+0x178`
      (**the unit's position becomes the building's, (22, 50)**).
   b. building garrison counters, sight (slot 0x1e8 with 5).
   c. **`0x12baa00(unit, building, 3)`** (after the entry).
3. `0x12baa00` (asm 0x12baa00..0x12babd8, dec): target non-null and the unit's master is class 4,
   master 0x710, class 0x15 or class 0x42 -> `0x12bacf0(unit)`; then with filter 3: building type 80
   in state 2, `0x1732ca0(unit player, building player, 1)` true, garrison-kind byte `+0x45c` bit 0 or
   bit 6 -> `unit+0x664 = 1`; any other filter: `unit+0x664 = 0`.
4. `0x12bacf0` (asm 0x12bacf0..0x12bafd6): nothing when `unit+0x664 != 0`. Else
   a. `T = unit.vtable[0x1a0]()` = target object of the head action of `unit+0x420`
      (`0x113bfd0`); if T has `+0x2d0 != -1` (pasture) T = that object when the world holds it.
   b. no T (no action, no target, pasture gone): `id = 0xd271c0(ai)`; T = object of that id.
   c. T found: `target = T.id`, point = T's x, y. **No T: `target = -1`, point = the unit's own
      x, y** (asm 0x12badc4..0x12bae6a: `ebp = -1`, `[rdi+0x170]`, `[rdi+0x178]`).
   d. class = head action's `+0x68` when its type is 5 or 0x6e, else -1; action = `0xd25d10(ai)`;
      target2 = head action's second target id or -1.
   e. unchanged record: return. New action 0x25a (or -1 with `0xd28780(ai) == 0x25a`): the old
      record moves to the second unless its action is -1 or 0x25a; any other new action clears the
      second. Then record 1 = (target, class, action, target2, x, y).
   For 4375: no action, no queued order -> record 1 = (-1, -1, action, -1, **(22, 50)**), flag 1.

### 2.2 GO_BACK_TO_WORK (232.137 s)

5. `0x16f4ba0` -> for each unit inside, last first: `0x12bc7e0(unit, building)`.
6. `0x12bc7e0` (asm): record buffer = (-1.., x = -1.0, y = -1.0); `found = 0x12b6910(unit, &rec)`.
   `0x12b6910`: record 1 through `0x12abe00` (target id >= 0 -> object; else target2 >= 0 -> object;
   a built non-farm building ends a record whose action is 0x25a, 0x261 or 0x265); else record 2
   alike (found: it becomes record 1, record 2 cleared); neither: record 1, or record 2 when record
   1's point is (-1, -1) (dec only: also when record 1 has class -1 and action -1 and record 2 has
   both set). For 4375: `found = 0`, rec = record 1, point (22, 50).
7. With a building (asm 0x12bc8c0..0x12bc8e1):
   `0x12a16e0(building, unit, rec.x, rec.y, found, sound = 1, use_xy = 1)`; 0 -> return 0.
8. `0x12a16e0` (asm `out_p5/unload.asm`):
   a. `0x1288c20(building, unit master, &x, &y, use_xy)`; false -> return 0. With `use_xy = 1` and
      x, y >= 0 the search's goal is (22, 50) (R5 step 6a): spot (21.8094, 47.79) (truth and engine).
   b. sound; `0x1248780(building, unit, spot.x, spot.y, building z)`.
   c. `found != 0`: `unit.vtable[0x138](unit, found, x, y, 0.0, 0, 0, 0xffff)`; return 1.
   d. `x == -1.0 && building+0x8e0 == 1 && building+0x8f0 != building id`: gather point branch.
   e. else `building+0x8e0 == 0xff`: x, y = gather x, y.
   f. `x == -1.0 || y == -1.0`: AI `vtable[0xb0](1)`, forget target `0xd38f90`, stance
      `vtable[0x1c0](ai+0x1b1)`; return 1. (This is where a gather point on the building itself with
      no point ends: the unit just stops.)
   g. else (**4375: x = 22, y = 50, found = 0**, asm 0x12a1acf..0x12a1b14 -> 0x12a1a1c): AI forget
      target; `unit.vtable[0x2b8](unit, 1)`;
      **`unit.vtable[0x138](unit, 0, 22.0, 50.0, 0.0, 0, 0, 0xffff)`** = `0x12c6590`: `+0x69c = 0`,
      base `0x113b510` -> slot 0x8a8 (`0x12df320`) with no target: a move to the point, range 0.
9. Back in `0x12bc7e0` (asm 0x12bc8fe..0x12bc992): `found == 0`: only when rec.class > -1 and
   rec.action > -1: AI `0xd27410`, `0xd40980(action)`, notify 0x202 (action, class, target). Then
   `unit+0x664 = 0`, `unit+0x69c = 1`, return 1.

### 2.3 The walk (truth)

Steps of 0.1792 per 224 ms (speed 0.8). Leg 1 from (21.8094, 47.79): dx/dy = -0.4358 =
(21.5 - 21.8094)/(48.5 - 47.79): toward the tile centre **(21.5, 48.5)**. Leg 2 from there:
dx/dy = 0.2000 exactly, through (21.52196, 48.6098), ending at **(21.8, 50.0)**: slope
(21.8 - 21.5)/(50 - 48.5). Truth objects there: town centre 3394 (109) at (22, 50) and its annexes
3395 (618) at (23, 49), 3397 (1650) at (22.25, 49.75), 3396 (619) at (21.5, 50.5), 3398 (620) at
(21, 51); sheep and villagers stand inside the 4x4 footprint, so the footprint is not solid as a
whole. (21.8, 50.0) is the point closest to the goal (22, 50) at one unit radius (0.2) from a
shape side at x = 22 (low-x side of 618 and/or 1650): the foot of the goal on the line x = 21.8.

## 3. Confirmed differences from the engine's default behaviour

**D1. The town-bell record of an entry without an Enter action.**
Original: 2.1 steps 2c-4: the record's target is the head action's target, else the first own
queued order's target, else none with the unit's own position, read after the entry (asm
0x12bacf0..0x12bae6a; `0x124aa20` copies the position). A new unit taken in by `0xbbab40` step 4
has no action and no order: target -1, point = building position.
Engine: `garrison/unit.rs:467-470` (`go_inside`) calls
`enter_town_bell((&mut bell, ai), Some(target), at, ...)`, and `enter_town_bell`
(`garrison/unit.rs:557-595`) always records `target: Some(building)`, `target_class: None`,
`target2: None`, `point: building position`. `World::gather` -> `enter_forced`
(`production/spawn/gather_walk.rs:233-242`, `garrison/enter.rs:605-628`) reaches it with no Enter
action. Then `World::back_to_work` (`garrison/unload.rs:432-467`): `bell.back_to_work` finds the
town centre, `let_out(.., record.point, (Some(3394), true))`, `came_out`
(`garrison/let_out.rs:306-316`) issues `order_work` on the town centre and returns: no move.
Engine trace agrees: `runs/sR.err` line 961 `gather: Some(Point([22.0, 50.0]))` at the let-out
(so `point` was (22, 50), not -1), `runs/pT.err` `action_kind: null` from update 11080.
No existing switch covers it. The hypothesis arm in `let_out_aim` (`let_out.rs:445-452`) is wrong
against the original (2.2 step 8f: with x == -1 the unit stops) and is never reached here.

Implementation (switch `GENIE_EXPERIMENT_UNLOAD_188329`):
- File `garrison/unit.rs`, `Unit::go_inside`, at the `enter_town_bell` call (line ~469), i.e.
  after `self.place.go_inside(..)` / `join_building`, as in the original's order.
- Build the record the way `World::record_town_bell` (`orders/town_bell.rs:629-700`) does, instead
  of from the container: `T` = `actions.top_target()` when its id is not negative and the world
  holds it; if T is in a pasture the world holds, the pasture; if none,
  `own_order_target(ai, id)` when the world holds it. `target = T.id`, `point = T position`; **no
  T: `target = None`, `point = at.ground()`** (the unit's position after the entry = the
  building's). `target_class` = the head Hunt's / Gather's target class, else None;
  `action = ai.current_action`; `target2 = actions.top_second_target()` when held. Keep the rest
  (`bell.flag` test before, `TownBell::record`, the flag set after).
- Minimal equivalent for this case: pass `Some(target)` only when
  `actions.top_target() == Some(target.id())`, else `None` (point stays `at`).
- Nothing to change in `let_out`: with `found = None` and `record.point = (22, 50)`,
  `toward = Some((22, 50))` (same spot), `came_out` -> `let_out_aim` -> `LetOutAim::Point((22, 50))`
  -> `gather_move(up, ui, (22, 50, 0), OrderSource::Queued)` = step 8g. Delete the hypothesis arm.

What else it alters: every villager (class 4, master 1808; the original also takes classes 0x15
and 0x42) that entered a building without an Enter action as head action (new units with the
gather point on their own building; units an effect takes in) and is later released by
GO_BACK_TO_WORK (0x80, 0x86), ALL_BACK_TO_WORK (0x8c) or the bell's end: it now walks to the
recorded point instead of getting a work command on the building. UNLOAD (0x6f) does not use the
record (point -1: stop, unchanged). An ordinary Enter order is unchanged (head action = the Enter on
the building).

## 4. Suspected differences

S1. **Where the point move ends.** After D1 the engine has a `MoveTo` to (22, 50), range 0, no
target. The truth path is start -> (21.5, 48.5) -> (21.8, 50.0): a tile-centre waypoint and an end
at the closest point of a shape side grown by the unit radius (2.3). Whether the engine's planner
and short pather give this for a goal on/inside the annex shapes was NOT read or run; the end
rule (best node / foot of the goal on the side) was not located in the short pather.
S2. `0x12b6910` (dec only): record 2 is also returned when record 1 has class -1 and action -1
while record 2 has both set; engine `TownBell::back_to_work` (`orders/town_bell.rs:236-241`) tests
only record 1's point.
S3. Order in back-to-work: the original sets the AI action and posts notify 0x202 **after** the
let-out, only when it returned non-zero and no object was found (asm 0x12bc8e6..0x12bc96c); the
engine does it before `let_out` (`garrison/unload.rs:449-462`). Outside a building
(`0x12bc830..`) not compared.
S4. `0x12baa00`'s unit test includes classes 0x15 and 0x42; engine tests the villager class and
master 1808 (`MULE_CART`) only (`garrison/unit.rs:566-570`, `orders/town_bell.rs:582-592`).
S5. `0x12c77f0` calls the town-bell order even when the base entry did not take the unit in; the
engine records only on a completed `go_inside`.

## 5. Not read

- The path of the move (tile planner, walk function, short pather) for this goal; the annex
  masters' radii and which of them are solid (taken from the truth positions only).
- `0x12df320` (work command) beyond its head; `0x12c0340`; `0xd25d10`, `0xd28780`, `0xd27410`,
  `0xd40980` bodies; `0x16f4ba0` (only its callers and the decompiled chunk `0x16f4c25`).
- The engine's `order_work` on the town centre (why it leaves no action) and the engine's Enter
  action order relative to `go_inside` (assumed head action = Enter).
- Old build (158041) binary: "engine default" is from the engine source only.
