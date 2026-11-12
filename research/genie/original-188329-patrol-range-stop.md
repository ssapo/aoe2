# Case S2: engine STOP "a defending soldier's patrol range (slot 0x470, FUN_140f95e10)" — replay 518239882, update 36702

Runs (all `go_base.ps1`, K_envs switches): `S2_1` (objects 36600-36710, all objects), `S2_2` (commands + objects 36400-36710 of ids 4544,4545,4489,4548), `S2_3` (GENIE_TRACE_AIUPD, to 36703).
Decompiles: `out_s2/s1.c` (0xcf7740 and neighbours), `out_s2/s2.c` (0x96eaa0, 0x106efd0, 0x1210e30, 0x1218ce0, 0xcf3350, 0xb75ce0).

## 0. Situation at the stop (engine side only)

- **No truth exists for this moment**: `truth/truth4.jsonl` ends at 900 s; the stop is at world ms 950557 (update 36702). The engine has already diverged from the recording before this (checkpoints differ from sync 23499/26999 on), so the situation below is the engine's own state, not the original's.
- Unit: **P2 engine id 4548** (recorded id 4552, `CORRECT_ID world_ms=927851 recorded=4552 sim=4548`), master 93 (spearman), Soldier unit AI, `action=Some(Move) target=None`, action_kind 1 state 4, at (64.9437, 60.5245), walking SW.
  - Order: replay command `update 36397: AttackMove { units [4552], waypoints 1: (60.5, 56.041668) }` (S2_2.err) -> `current_order = AttackMove (0x2dd)`. No stance command ever names 4552, so its stance is whatever the engine gave it at creation; the stop message is raised only in the `UnitStance::Defensive` arm, so the engine holds it as Defensive (stance is not in the OBJECT trace: not directly observed).
  - `S2_3`: the last `AIUPD ... player=PlayerId(2)` line before the stop is `id=4548` (it is also the highest P2 id, so this alone is weak; with the order it is consistent). The only other P2 soldiers that are busy (4544, 4545 attacking P1 4489) have no patrol/attack-move command; the 5 scouts given Patrol at 36295 are StandGround (command at 35218) and idle.
  - What it tests: not traceable with the existing trace variables (no line names the candidate). P1 objects near it at 36702: villagers 4525 (57.73,59.31; d 7.32), 4504 (d 7.26), 4499 (m293, d 7.71), scout 4532 (64.09,52.80; d 7.77). SUSPECTED: one of these, reached through its look-around search (its `look` timer steps at 36702).

## 1. Address table (188329, RVA)

| What | Address | Note |
|---|---|---|
| Soldier unit AI vtable | 0x3246500 (76 slots) | slot 0xa0 = 0xcf7740, slot 0xa8 = 0xcf8610, slot 0x100 = 0xd42a00 |
| Soldier `CanAttack` (old FUN_140c19a20) | 0xcf7740..0xcf8001 | debug string "SOLDIER UNIT AI: CanAttack:  MyState=%d, Unit #%d:" (0x3249010) |
| Defend arm | 0xcf7d3b..0xcf7f65 | strings 0x3249178 "I'm in Defend.", 0x3249190 "We're currently on patrol.", 0x3249218 "We have saved patrol information.", 0x32492a0 "...just doing simple distance check." |
| Unit slot **0x4a8** (old "slot 0x470") | 0x1210e30 | same in vtables 0x32a4698, 0x32b71c0, 0x32b4fa8; distance of a point to the unit's top path |
| Unit slot **0x690** | 0x1218ce0 | "is on a looping (patrol) path" |
| Unit slot 0x568 | 0x113c480 | copies obj+0x3bc (x, z, y; 12 bytes) |
| Path distance (old FUN_140f95e10) | 0x106efd0..0x106f0b9 | path points `+0x438..+0x440`, 12 bytes each |
| Point-to-line distance (old FUN_14087e7c0) | 0x96eaa0 | |
| Top ancestor's path pointer / id | 0x106f390 / 0x106f2a0 | path data `+8` parent, `+0x18` path, `+0x20` id (-1 without parent) |
| World path table | [0x4354cb8]->+0x5c0 (0xd6c9e0), lookup 0x1616f20 | `+0x10` array, `+0x20` count |
| "has saved patrol" | 0xd27780 | `ai+0x1c8 != 0` (old `+0x1c0`) |
| Weapon range against target (unit slot 0x250) | 0x115ce70 (combat), 0x1140660 (base) | slot 0x248 = plain range |
| Squared footprint gap to a point (old FUN_140a847c0) | 0xb75ce0 | |
| Constants | 0x31b1420 = 0.5, 0x369ff98 = 5.0, 0x369ffdc = FLT_MAX (0x7f7fffff) | |
| NOT it: unit slots 0x470 / 0x478 in 188329 | 0x113b590 / 0x1226650 | top action's kind / an indexed 12-byte array entry |
| Unit AI fields (188329) | stance `+0x1b1`, state position `+0x1b4/+0x1b8`, order `+0x3c`, saved patrol `+0x1c8` | all old offsets +8 |

## 2. The original's logic (CONFIRMED, read in 0xcf7740 disassembly 0xcf7c93..0xcf7f65)

`d2` = FUN_140b75ce0(target, ai+0x1b4, ai+0x1b8) (squared footprint gap of the target to the AI's state position), computed at 0xcf7c1e.

1. `reach = MAXSS(unit->slot0x250(target), 0.5)` (0xcf7c9d, `maxss xmm6,[0x31b1420]` at 0xcf7ca6). Note: a **max**, not a sum.
2. Stance 2 (StandGround, 0xcf7cb8): pass if order == 0x2bd, or `d2 <= reach*reach` (`comiss xmm7,xmm1; jbe`), else FALSE.
3. Stance 1 (Defend, 0xcf7d3b): `reach += 5.0` (0xcf7d69). Then:
   - **A. on patrol** (0xcf7d71..0xcf7d92): `(order == 0x2c7 && unit->slot0x690() == 1) || order == 0x2dd`.
     `d = unit->slot0x4a8(&p)` with `p = target->slot0x568()` = the target's plain position (obj+0x3bc: x, z, y). `comiss d, reach; jbe pass` (0xcf7df4): FALSE only when `d > reach` (unordered passes). Message "He's %f away from my current patrol path but %f plus my range is only %f".
   - **B. else if saved patrol** (`ai+0x1c8 != 0`, 0xcf7e5e): `d = FUN_14106efd0(ai+0x1c8 path, &p)`; FALSE only when `d > reach` (0xcf7ec0).
   - **C. else**: FALSE when `d2 > reach*reach` (0xcf7efb..0xcf7f05).
4. Any other stance passes this part.

Slot 0x4a8 (0x1210e30): `ps = unit+0x3f0` (path data); null -> return 0.0. `path` = top ancestor's path pointer (0x106f390: follow `+8` to the last parent, its `+0x18`; without parent the level's own `+0x18`); if null, the world's path table entry of the top ancestor's id (0x106f2a0: -1 without parent -> none); still null -> 0.0. Else `FUN_14106efd0(path, &p)`.

Slot 0x690 (0x1218ce0): false if `ps` null or the walked level's own path pointer `ps+0x18` is 0; `path` found as above (null -> false); returns `path[+0xc] & 1` (the path flag LOOPS).

FUN_14106efd0 (0x106efd0): `n = (end-begin)/12 - 1`; `n == 0` -> FLT_MAX; else for i in 0..n: `d = FUN_14096eaa0(p, pt[i], pt[i+1], &flag)`; `least = MINSS(d, least)` (`minss xmm0,xmm6` at 0x106f05c: d if d < least, else least; **a NaN d leaves least unchanged**); start FLT_MAX. The flag is not read. FUN_14096eaa0: `sqrtf(((pz*dx-px*dz)^2 + (py*dz-pz*dy)^2 + (px*dy-py*dx)^2) / (dy*dy + dx*dx + dz*dz))`, identical operation order to the engine's `line_distance` (attack_rules.rs:325). It is the distance to the infinite line through each pair, not to the segment.

## 3. Confirmed differences and the implementation

### D1 (the stop). Engine: `unit_ai/attack_pick.rs:559-562` (`stance_reaches`) and `unit_ai/attack_rules.rs:450-453` (`siege_in_reach`) call `defend_patrol_range()` (attack_rules.rs:290) = `GenieError::unsupported` whenever stance is Defensive and (order Patrol | AttackMove or a saved patrol path).
Original: section 2, step 3 A/B/C.

Engine data that holds what is needed (nothing is missing from the master data; no .dat value is read, the "range" is `slot 0x250` = the already modelled `Attacker::range_against()`):
- top path = `crate::groups::formation::top_path(&mover.paths)` (desired_positions.rs:45, the old FUN_141046500; same "top ancestor else own, by pointer or id" rule as 0x1210e30) -> `PathData::points`, `PathData::path_flags` (movement/mod.rs:154).
- walked level's own path present = `mover.paths.first().is_some_and(|l| l.has_path)` (has_path stands for pointer or id; the original tests the pointer only: SUSPECTED equal).
- saved patrol = `UnitAi::patrol_path` (`saved.path.points`, unit_ai/mod.rs:462).
- target plain position = `Target::position` (as x, height, y `BVector`).
- distance = existing `patrol_distance` (attack_rules.rs:343), with the NaN fix D2.

`Seeker` (attack_pick.rs:270) is `Copy` and holds only `patrol_path: bool`; the points must be handed in. Suggested shape (new struct next to `Seeker`, built only when `stance == Defensive`, at the three places that call `can_attack`: `world_view/world_picker.rs:537`, `world_view/unit_view.rs:79` and `:202`, which have `parts.mover_of(me)`; the saved points come from the `UnitAi` that builds the seeker in `idle.rs:648 seeker_with`):

```rust
/// 188329 `FUN_140cf7740`'s Defend arm: what it reads of the unit's patrol.
pub struct PatrolLines {
    /// Slot 0x690 (`0x141218ce0`): the walked level holds a path and the top path's LOOPS flag.
    pub route_loops: bool,
    /// Slot 0x4a8 (`0x141210e30`): the top path's points; None without path data or top path.
    pub route: Option<Vec<BVector>>,
    /// `ai+0x1c8`: the saved patrol's points.
    pub saved: Option<Vec<BVector>>,
}

// attack_pick.rs, stance_reaches, replacing lines 559-566
UnitStance::Defensive => {
    let reach = reach + Distance::new(unit_ai_tuning.defend_growth);
    let patrols = matches!(s.order, Some(OrderKind::Patrol | OrderKind::AttackMove)) || s.patrol_path;
    if patrols && !patrolrange_188329() {
        defend_patrol_range()?;
    }
    if patrolrange_188329() {
        let p = BVector::new(t.position.x(), t.position.height(), t.position.y());
        let on_patrol = (s.order == Some(OrderKind::Patrol) && lines.route_loops)
            || s.order == Some(OrderKind::AttackMove);
        if on_patrol {
            // slot 0x4a8: 0 without a path; COMISS d, reach; JBE passes (unordered too)
            let d = match lines.route.as_deref() {
                Some(points) => patrol_distance_188329(points, p)?.get(),
                None => 0.0,
            };
            return Ok(at_most_or_unordered(d, reach.get()));
        }
        if let Some(points) = lines.saved.as_deref() {
            return Ok(at_most_or_unordered(patrol_distance_188329(points, p)?.get(), reach.get()));
        }
    }
    if reach.squared() < d2 {
        return Ok(false);
    }
}
```
`patrolrange_188329()` = `std::env::var_os("GENIE_EXPERIMENT_PATROLRANGE_188329").is_some()` in the style of `taskargs_188329()` (orders/mod.rs:194). With the switch off the stop stays. Note the order of the tests: a Patrol order whose path does not loop falls to B (saved) then C (simple), exactly as the `jne 0x140cf7e5b` at 0xcf7d92.

### D2. `patrol_distance` NaN rule. Engine attack_rules.rs:349: `least = if least <= d { least } else { d }` (a NaN d replaces least). 188329 0x106f05c `minss d, least`: a NaN d (zero-length segment: 0/0) leaves `least`. Under the switch use `least = if d < least { d } else { least }` (`patrol_distance_188329`); this function is also used by `retarget.rs:152` (leash), same original routine.

### D3 (same function, side finding). Engine attack_pick.rs:552 `reach = range_against + stance_range_growth (0.5)`; 188329 0xcf7ca6 `reach = MAXSS(range_against, 0.5)`. Equal for range 0 (spearman here: 0.5, +5 = 5.5); differs for a Soldier-AI unit with range > 0 in StandGround/Defend. Could go under the same switch: `Distance::new(maxss(me.range_against()?.get(), 0.5))`.

## 4. Suspected
- Which object 4548 tests at 36702 and the result. If its top path is the 2-point line (69.25,64.87)->(60.5,56.04) (assumed, not dumped), villager 4525 lies ~4.3 and scout 4532 ~4.8 from the line, both <= 5.5 -> the check would pass (TRUE).
- The engine's Defensive stance of 4548 (not in the trace).
- `has_path` of the walked level == original's pointer test `ps+0x18 != 0` in slot 0x690.

## 5. Not read
- The siege AI's attack check in 188329 (the engine's `siege_in_reach`, attack_rules.rs:450, raises the same stop): its vtable/function was not identified (0xcf8010 has no stance test; 0xcf6ec0 is a candidate, unread). Keep the stop there.
- 0xcf7740's earlier parts: the computer-player block (0xcf79xx, slot 0x220/0x248 comparisons) and a test the engine's doc does not mention: `FUN_140cf3350(unit, target)` == 0 -> FALSE, "I'm overlapping with an allied unit returning FALSE." (0xcf7ba3, string 0x3249098), before any stance test. Unread beyond its first lines; may be a further difference.
- The old-build routine itself (the engine's doc "slot 0x470" could not be compared).
- `update.rs:372` "the patrol range of a unit AI's target" (computer players only) is a different stop.

## 6. What else the change affects
Every Soldier-AI attack check (search, retarget, attacked handler, `may_attack` on orders) of a Defensive unit on a Patrol/AttackMove order or holding a saved patrol; with D2 also the patrol leash in `retarget.rs:152`; with D3 all StandGround/Defensive soldier checks with weapon range > 0. Units in other stances and all non-Soldier AIs are untouched.
