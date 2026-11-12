# P22 — town-bell record at the garrison command (replay 517426097, villager 3824)

Result in one line: the engine does write the record on this path; it is skipped at update 17773
because the villager's town-bell flag is still set from an earlier SEEK_SHELTER (update 17117).
In 188329 the MOVE command that followed in the same update cleared the flag (villager slot
0x148 = `0x12cbca0`); the engine's MOVE handler (`orders/moves.rs` `move_unit`) does not.

Correction to the case brief: the command is **SEEK_SHELTER (0x2c)**, not UNIT_ORDER action 5
(run `P22_1`, `GENIE_TRACE_COMMANDS=1`). Both end in the same `0x16f0680`.

## 1. Address table (188329, RVA)

| RVA | What | Read in |
|---|---|---|
| `0xf52720` | SEEK_SHELTER command: list A = class 4 type 70, master 1808, class 0x42 type 70; list B = class 0x15; calls `0x16e0510(player, A, 1)` then `0x16e0510(player, B, 0x40)` | out_p22/p4.c |
| `0x16e0510` | player's buildings (state 2, type 80, not `0x12461e0`, garrison type & arg via `0x1284e10`) with counts; `0x16f0680(player, units, buildings, {}, counts, 0, 0)` | out_p22/p2.c |
| `0x16f0680` | shelter assignment (pairs, sort, group splitter `0x2713`); per loose unit of type >= 70 (`0x16f138e`, not `0x1252480`): `param_7 == 0` or no unit AI -> unit slot `0x8a8`(unit, shelter, x, y, z, 0, **3**, 0) at `0x16f1674` (word `[rsp+0x30] = 3` at `0x16f164d`); else unit AI slot 0x30 with order 0x2cd (`0x16f156a`, no record) | out_p22/p1.c + disasm |
| `0x16ed4c7` | UNIT_ORDER action 5 call of `0x16f0680` (`param_7` = packet `+0x1d`) | out_k/k6.c |
| `0x170da20` | town bell ring; sets `+0x664 = 1` on the **buildings** (`0x170de31`), then `0x16f0680` (`0x170de90`); end bell clears a building's flag (`0x170e14b`) | disasm |
| `0x12df320` | villager work command (vtable `0x32b4fa8` slot 0x8a8): `0x12baa00(unit, target, filter)` at `0x12df845`, THEN base work command `0x1140670` | out_p22/p1.c |
| `0x12baa00` | for a target and class 4 / master 1808 / class 0x15 / class 0x42: record writer `0x12bacf0`; filter 3: `+0x664 = 1` (`0x12bac92`) if target type 80, state 2, allied (`0x1732ca0`), building master `+0x45c` bit 0 or bit 6; other filter: `+0x664 = 0` (`0x12bace5`) | out_k/k5.c |
| `0x12bacf0` | record writer; returns at once when `+0x664 != 0` (`0x12bacf8`) | out_k/k4.c |
| `0x12c77f0` | villager enter override (slot 0x1b8): after the entry `0x12baa00(unit, building, 3)` (`0x12c78e8`) | out_p22/p1.c |
| `0xf50d90` | MOVE command -> `0x16ebc20` | out_p22/p3.c |
| `0x16ebc20` | MOVE handler: not queued and (no unit AI or `0xd27720` false) -> unit slot `0x148` (`0x16ec596`, `0x16ec5b3` grid; `0x16eca14` plain) | out_p22/p3.c |
| `0x12cbca0` | villager slot 0x148 (move): first statement `if class == 4 { +0x664 = 0 }` (`0x12cbd3e`), before the `target != self` test | out_p22/p2.c |
| `0x12bc7e0` | back to work; `+0x664 = 0` at the end | out_k/k4.c |
| `0x12b6910` | record reader (side finding, section 3b) | out_k/k4.c + disasm `0x12b6a26..0x12b6a9e` |
| `0x12a1530` | unload all: `+0x664 = 0` per let-out unit (`0x12a1641`) | out_p22/p2.c |
| `0x16ee560` | UNLOAD command: `+0x664 = 0` (`0x16ee763`, `0x16eefe4`) | out_p22/p2.c |

Other writers of `+0x664` found by byte scan, not read: `0x12a5321`, `0x12a582f`, `0x12d42db`
(probably load/constructor), `0x12d8604` (inside `0x12d47e0`), `0x1344c1`.

## 2. Original logic, in steps (this case)

1. Update 17117 (225.39 s): SEEK_SHELTER on 3824. `0xf52720` -> `0x16e0510` -> `0x16f0680` ->
   slot 0x8a8 with filter 3 -> `0x12df320` -> `0x12baa00(unit, TC 2942, 3)`:
   record = {target -1, class -1, action 0x262, target2 -1, point = own position
   (84.93693, 88.53648)}; TC is type 80, state 2, own, takes villagers -> `+0x664 = 1`.
   Then `0x1140670` replaces the head action with the Enter.
2. Same update: MOVE to (85.458336, 84.458336). `0x16ebc20` -> slot 0x148 = `0x12cbca0`:
   class 4 -> **`+0x664 = 0`**; then the move.
3. Update 17773 (233.919 s): SEEK_SHELTER again. `0x12bacf0` runs (flag 0). Head action is
   the Move without target, the unit AI's own first order has no object -> target -1, point =
   own position; class -1 (head action kind is not 5 / 0x6e); action = unit AI `+0x44` = 0x262
   (the record is written before `0x1140670` installs the Enter, so it is still Move);
   target2 -1. It differs from the first record, action is not 0x25a -> second record cleared,
   first = {-1, -1, 0x262, -1, (85.6976318359375, 84.05607604980469)}. Flag set to 1 again.
4. 252.925 s back to work: `0x12bc7e0` -> `0x12b6910`: no object in either record, first
   point is not (-1,-1), first action is not -1 -> first record; `0x12a16e0` lets the unit out
   toward the point; target < 0 -> no unit AI search; `+0x664 = 0`.

Bit check: truth6 at 252925 ms, 3824 head action object `+0x38..+0x40` =
`3065ab42 b61ca842` = (85.6976318359375, 84.05607604980469). Engine position of 3824 at
update 17772/17773 (`K_s3_097.err`) = the same two floats. So with the flag clear at 17773 the
engine's `record_town_bell` gives exactly the truth point, and the rest of the engine path
(Move to the record point, no work object) is already what K_s2 shows with the old point.

## 3. Confirmed differences

### 3a. MOVE command does not clear a villager's town-bell flag (cause of this case)

- Original: `0x16ebc20` -> slot 0x148; villager override `0x12cbca0` clears `+0x664` for
  class 4 as its first statement (`0x12cbd3e`).
- Engine: `orders/moves.rs` `move_unit` (line 66), the "takes it itself" branch at lines
  154-158. The comment says "a villager's town-bell flag (not held)" and only empties the
  order queue. `move_point_order_with` (line 564, the other slot-0x138 path) does clear it
  (line 583).
- Engine evidence: run `P22_1` (`GENIE_TRACE_BELL=1;GENIE_TRACE_COMMANDS=1`, 17800 updates):
  `update 17117: SeekShelter [3824]` + `update 17117: Order Move [3824]` + one
  `BELL_RECORD flag=Free now={Move, (84.93693, 88.53648)}`; `update 17773: SeekShelter [3824]`
  prints no BELL_RECORD, because `record_town_bell` (town_bell.rs:646) returns on
  `flag.is_sheltered()` before `TownBell::record`. `K_b1_097` BELL_BACK shows `flag=Sheltered`
  with the old record.

Change (`orders/moves.rs`, `move_unit`):

```rust
// after line 93 (`let speed = ...`), while `master` is still borrowed:
let villager = self
    .model
    .roles
    .of_class(master.class)
    .contains(ClassRoles::VILLAGER);
...
// at line 154, before `if let Some(ai) = self.parts.unit_ai.get_mut(unit.id) { ai.orders.clear(); }`
// 188329 0x12cbca0 (villager slot 0x148): class 4 drops its town-bell flag first
if villager && std::env::var_os("GENIE_EXPERIMENT_GARRISON_RECORD_188329").is_some() {
    self.parts.set_town_bell_flag(unit.id, BellShelter::Free);
}
```

It must sit before the `order.target == Some(id)` return (the original clears before that
test). `BellShelter` is already imported in moves.rs; `ClassRoles` is used in the file.

### 3b. Record reader: second test for taking the second record

- Original `0x12b6910`, neither record's object found (disasm `0x12b6a26..0x12b6a9e`): take
  the second record if `first.x == -1.0 && first.y == -1.0` (`0x12b6a36..0x12b6a55`), OR
  `first.action(+0x63c) == -1 && first.class(+0x638) == -1 && second.action(+0x654) != -1 &&
  second.class(+0x650) != -1` (`0x12b6a64..0x12b6a89`). Raw fields are returned, not the
  copies `0x12abe00` edited.
- Engine `orders/town_bell.rs` `TownBell::back_to_work` lines 246-251: only the point test.

Change:

```rust
let none = Point::new(-1.0, -1.0);
let second = self.work.point == none
    || (std::env::var_os("GENIE_EXPERIMENT_GARRISON_RECORD_188329").is_some()
        && self.work.action.is_none()
        && self.work.target_class.is_none()
        && before.action.is_some()
        && before.target_class.is_some());
if second { Ok((None, before)) } else { Ok((None, self.work)) }
```

Not exercised by this case (first action is Move).

### 3c. No missing record call on the garrison paths

`garrison_order` (UNIT_ORDER 5), `seek_shelter` and `ring_town_bell` all go
`shelter` -> `shelter_in` (shelter.rs) -> `order_work` with `filter: Some(GARRISON)` ->
`work_on_held` (moves.rs:430) -> `town_bell_order` -> `record_town_bell`, then
`work_command`. Same order as `0x12df320` (record, flag, then action). The ring sets the flag
on buildings only, in both; no double record. The queued dispatch (unit AI slot 0x30) writes
no record in either. No change needed here.

## 4. Suspected (one side read, or no case)

- `0x12baa00` and `0xf52720` also accept class 0x15 (21) and class 0x42 (66); the engine's
  `town_bell_order` (town_bell.rs:597-610) and `seek_shelter` (shelter.rs:175-190) only
  villager class and master 1808. SEEK_SHELTER sends class 0x15 to buildings whose garrison
  type has bit 0x40 (second `0x16e0510` call); the engine has no such list.
- `0x12baa00` sets the flag for a building master with garrison-type bit 0 OR bit 6;
  engine tests `GarrisonKinds::VILLAGERS` only (town_bell.rs:626).
- `0x12c78e8`: after an entry the villager override calls `0x12baa00(unit, building, 3)`.
  The engine has no town-bell call in `garrison/enter.rs`. Matters for entries that did not
  come through slot 0x8a8 (queued garrison, unit-AI enter): record written at entry with the
  Enter as work, flag set.
- Engine callers of `record_town_bell` are only `town_bell_order` and
  `orders/unit_order.rs:387`; the original's Hunt (`0xbb6b4f`) and villager AI notify 0x21a
  (`0xd025f2`) callers were not looked for in the engine.

## 5. Not read

`0x1252480` (the "in a group" test in `0x16f0680`), `0x1140670` body, `0x12a16e0` beyond the
call shape, the unread `+0x664` writers listed in section 1, the old-build behaviour of
`FUN_1412035a0` for 3b, whether unit-AI-issued moves reach slot 0x148.

## 6. What the changes affect

- 3a: every direct (not queued) MOVE command on a villager whose flag is set, i.e. a villager
  sent to shelter (garrison order, seek shelter, town bell) and then moved before entering.
  After the change its next shelter order records its work again, and a later back-to-work
  outside a building (`0x12bc7e0` with no building needs the flag) does nothing for it.
- 3b: back-to-work of a unit whose first record has no action and no class while the second
  (pre-building) record has both.
