# "AutomaticMoveUnitsToDesiredPositions' path to a slot" (helper S, 2026-11-13)

Build 188329, RVAs (image base 0x140000000). Engine paths under `genie/crates/engine/genie-core/src/`.
Run made: `S_1` (516956894 to update 64,100 with `go_base.ps1`, `M2_envs.txt`, objects 63,930-64,093,
commands, `GENIE_TRACE_FORMING`). Decompiles in the cloud container: `/home/claude/re-env/re/out_S/s1.c`
(0x110cbd0, 0x10d53b0, 0x10eec20), `s2.c` (0x10ef890); the awake update is `re/out/d15.c`.

**Headline: 188329's move update contains no AutomaticMoveUnitsToDesiredPositions at all.** The branch the
engine stops in (old `FUN_14100aaa0`, reached from old `FUN_141041420`) has no counterpart to port. The
188329 move update (0x110d3a0) keeps the group alive with command 1 until every slot is in place (or its member
failed 3 times) and lets the ordinary per-update steering bring the members to their slots.

## 0. The case (engine side)

- Stop site: `groups/update/moves.rs:322` in `World::move_to_desired_positions` (:292), reached from
  `move_members_on` (:268) or :204, both in `World::move_update` (:145, old `FUN_141041420`).
  Condition: the group stands (`!motion.moving()`), does not follow, has no wait delays / path wait, and its
  formation has a slot whose unit the world holds, that is free (`member_idle`, `checks.rs:439`) and whose
  slot state is not `InPlace` (3). (An in-place slot on an attack with a held target is the other stop, :316.)
- 516956894, update 64,092 (ms 835,562), `S_1.err`: at 64,013 P1 gives `AttackMove` to units 3851, 4864, 4869
  (three scouts, master 448) to (70.0729, 88.6146) = engine group 9 (lead 4864). At 64,091 the group's place is
  (70.0738, 88.6136): it has arrived and its path is done. Members then: 4864 at (71.08, 88.45) and 4869 at
  (71.92, 88.06) both in an Attack on 4837 (not free); **3851 at (69.875, 85.07), no action, 3.5 tiles from the
  goal** (it had been attacking 3853 until ~64,012 and trailed behind). The group's last speed pass shows the
  members 0.76 and 1.90 behind their slots. So: the group stops at its goal, one free member is not in its
  slot -> old code wants to give that straggler its own path to the slot. No obstacle is needed for this.
- Trust: the stop is 287 s after P1's first checkpoint mismatch (548 s), so details (who attacks 4837, where
  3851 is) are not trustworthy. But unlike commandHorde this is **not an id artefact**: the ids are the
  player's own scouts and the branch is the ordinary end of any group move with a straggler; it will be hit
  with a correct state too. 519686090 (update 64,950, P1 first mismatch 99.9 s) was not traced; same stop site.

## 1. Address table (188329)

| RVA | what | engine counterpart |
|---|---|---|
| 0x1109d70 | group awake update; command dispatch at 0x110a9xx (`d15.c:474-506`): command 1 -> 0x110d3a0, 2 -> 0x10d36a0, 9 -> 0x110be80, other -> 0x110cbd0 | `awake.rs`, `moves.rs:53` `command_update` |
| **0x110d3a0 (..0x110d5d9, three .pdata chunks)** | **move update** (old `FUN_141041420`) | `moves.rs:145` `move_update` |
| 0x110ff90 | group moves: sqrt of velocity `+0x68..+0x70` squared > 0 | `Motion::moving` |
| 0x1110070 | walked level (`+0xb0`) state `+0x28` is 1 or 2 | `Motion::waits_to_move` |
| 0x110ffd0 | top path's flag byte `+0xc` & 1 | `top_path(..).path_flags.contains(LOOPS)` |
| 0x110fe90 | top path | `top_path` |
| 0x106f250 | path's last point (static 0x435be88 for fewer than 2) | as `moving_step` |
| 0x110ff60 | lead object | `lead_object` |
| unit slot 0x228 = 0x1245c70 | master `+0x70` with the attribute-1 modifiers (line of sight) | `master.line_of_sight` |
| float 0x31b1420 | 0.5 | `tuning.group.front_share` (same value the follow uses) |
| 0x10d19a0 | any member the world holds has a unit AI (`+0x1f0`) whose `+0x3c` (0xd25d20) is not -1 | `ai.current_order.is_some()` (`unit_ai/mod.rs:403`) |
| 0x10ef890 | one member's way round to its slot (planner, short/long pather, 1.01 = 0x3203a68, stops, slot 0x588, 0x1107710) - called per member from the awake update's steering at 0x110b824 | `steer/detour.rs` `way_round` (exists) |
| 0x1107710 | set a member's own move | `slot_steps.rs:435` `set_specific_move` |
| 0x10d53b0 | group statistics (not the wanted routine) | `stats.rs` |
| 0x110cbd0 | "other commands" update (garrison etc.; not the wanted routine) | `OTHER_COMMANDS` |

Group fields: `+0xb8` motion flags (2 = NEW), `+0xc0` wait delays, `+0xb0` walked level (`+0x18` path),
`+0x128` formation (`+4` slot count, `+0x10` slots of 0x3c: `+0` unit id, `+0x20` state), `+0x140` flags
(0x800 PATROL, 0x1000 FOLLOWED), `+0xe4/+0xf0` members, `+0xf8` member records of 0x30 (`+0x1c` failures),
`+0x3b0` command, `+0x3c8` target id.

## 2. The original's logic: move update 0x110d3a0 (group, &relayout) - read completely in disassembly

1. `+0xb8 & 2` (NEW): relayout = 1, return 0. (0x110d3aa)
2. moving = 0x110ff90; follows = flags & 0x1000.
3. Moving (0x110d3ef..0x110d4ae):
   - not following: relayout = 1, return 0;
   - target object (`+0x3c8`) not held: return 0;
   - r = lead's slot 0x228 x 0.5; no top path: relayout = 1, return 0;
   - d = top path's last point - target's slot 0x568 place; `d.x^2 + d.h^2 + d.y^2 > r^2` (`COMISS`, `JA`:
     a NaN is not): command = 2, return 0; else relayout = 1, return 0.
4. Standing (0x110d4d0..): following: command = 2, return 0.
5. `+0xc0 != 0`: return 0. 0x1110070: return 0. 0x110ffd0 (top path loops): return 0.
   flags & 0x800 and the walked level holds a path (`+0xb0 -> +0x18` non-null): return 0.
6. Slots (formation `+0x128` read without a null test; skipped when the array is null or the count <= 0):
   for each slot whose state is not 3: find the slot's unit id among the member ids; not found: return 0;
   found and that member's failures (`+0xf8[i*0x30 + 0x1c]`) < 3: return 0.
7. 0x10d19a0 true (a member's unit AI has a current order): return 0.
8. command = -1, return 1.

Caller (`d15.c:476-485`): result 1 -> no queued command (`+0x460 < 1`): the update returns (group goes, as
the engine's `GroupFate::Deleted`); else `+0x13c` = 1.

No RNG, no timers, no pather, no unit call other than slot 0x228/0x568 in this function. It never removes a
unit, never locks the formation, never touches flags 4 (LINE) / 0x20 (MEMBERS_SENT), and calls nothing that
plans a path. Slot 0x590 (future path data) has exactly one caller in the whole image: commandHorde.

## 3. Confirmed differences and the implementation note

D1 CONFIRMED (0x110d51b-0x110d5d4 vs `moves.rs:171-218`, `:262-271`, `:292-327`): standing group. Engine: slots
in place leave the group (`remove_unit`), `lock_formation`, LINE cleared / MEMBERS_SENT set,
`move_to_desired_positions` (the stop), finished when no path is walked. Original: steps 5-8 above only.
D2 CONFIRMED (0x110d423-0x110d4ac vs `moves.rs:226-249`): following group that moves: threshold is
(0.5 x lead's slot 0x228)^2 with `>`; the engine uses `tuning.group.close` with `>=`. (That slot 0x228 is the
line of sight: read as master `+0x70` plus attribute-1 modifiers; the name is SUSPECTED.)
D3 CONFIRMED (0x110d4f5, 0x110d501 vs `moves.rs:170-173`): a patrol (top path loops, or PATROL with a walked
path) just goes on; no `move_members_on`.

Switch: new `GENIE_EXPERIMENT_MOVEEND_188329` (`moveend_188329()` next to `forming_188329()`,
`groups/mod.rs:496`), so its effect on the three truth replays can be judged alone.

`groups/update/moves.rs`, `World::move_update`, directly after the `MotionFlags::NEW` block (:150-153):
```rust
if crate::groups::moveend_188329() {
    return self.move_update_188329(group, relayout);
}
```
```rust
/// 188329 0x110d3a0.
fn move_update_188329(&mut self, group: GroupId, relayout: &mut bool) -> Result<Progress, GenieError> {
    let g = self.groups.held(group)?;
    let follows = g.flags.contains(GroupFlags::FOLLOWED);
    if g.motion.moving() {
        if !follows { *relayout = true; return Ok(Progress::Going); }
        let Some(target) = self.world_object(g.current_target.target) else { return Ok(Progress::Going) };
        let leader = self.lead_object(&g.motion).ok_or_else(|| member_gone(g.motion.lead))?; // no null test in the original
        let r = self.master(leader.player(), leader.master_id(self.model.slots))?.line_of_sight.get() * 0.5;
        let Some(top) = top_path(&g.motion.paths) else { *relayout = true; return Ok(Progress::Going) };
        let end = match top.points.as_slice() { [.., _, last] => *last, _ => BVector::ZERO };
        let d = end - target.moved_vector();                    // slot 0x568, as moving_step
        let squared = d.x() * d.x() + d.height() * d.height() + d.y() * d.y();
        if squared > r * r {                                    // JA: false for a NaN
            self.groups.held_mut(group)?.current_command = FOLLOW;
        } else { *relayout = true; }
        return Ok(Progress::Going);
    }
    if follows { self.groups.held_mut(group)?.current_command = FOLLOW; return Ok(Progress::Going); }
    if g.motion.number_wait_delays != DelayCount::ZERO || g.motion.waits_to_move() { return Ok(Progress::Going); }
    if top_path(&g.motion.paths).is_some_and(|p| p.path_flags.contains(PathFlags::LOOPS)) { return Ok(Progress::Going); }
    if g.flags.contains(GroupFlags::PATROL) && g.motion.paths.first().is_some_and(|l| l.has_path) {
        return Ok(Progress::Going);
    }
    if let Some(f) = g.current_formation.as_ref() {
        for s in &f.slots {
            if s.state == SlotState::InPlace { continue; }
            let Some(m) = s.unit_id.and_then(|u| g.members.iter().find(|m| m.id == u)) else {
                return Ok(Progress::Going);                     // also a slot without a unit
            };
            if m.specific_move.consecutive_move_failures < 3 { return Ok(Progress::Going); }
        }
    }
    for m in &g.members {                                       // 0x10d19a0
        if let Some(WorldObject::Unit(_, u, _)) = self.world_object(m.id)
            && self.parts.unit_ai.get(u.id).is_some_and(|ai| ai.current_order.is_some())
        { return Ok(Progress::Going); }
    }
    self.groups.held_mut(group)?.current_command = NO_COMMAND;
    Ok(Progress::Finished)
}
```
All lines CONFIRMED against the disassembly except: `line_of_sight` for slot 0x228 (SUSPECTED name);
`has_path` for "walked level's path pointer non-null" and `PathFlags::LOOPS` for path byte `+0xc` bit 0
(taken from the engine's own notes for the old build); a missing formation (the original would fault) is
treated as no slots. `move_to_desired_positions`, `move_members_on` and the old tail stay for the switch off.

## 4. Suspected

- With the switch on, the straggler reaches its slot through the steering the engine already has
  (`members_to_slots` -> `steer_to_slot` -> `way_round`, 188329 0x110b824 -> 0x10ef890); whether that code
  (old-build reading plus FORMING) matches 188329 for a *standing* group was not checked. Slot state 3 and the
  failures counter are written there; 188329 ends the move at 3 failures while the engine's `MOST_FAILURES` is 10
  (`steer/mod.rs:27`, its own use in `to_slots.rs:426` not compared).
- The group now lives longer (members stay grouped until all are in place); orders, group ids and the
  kept-apart list (`awake.rs` `kept_apart_leave`, 188329 `d15.c:196-207`) see that.

## 5. Not read

- Whether an AutomaticMoveUnitsToDesiredPositions still exists in 188329 for other callers (attack update
  0x110be80, follow 0x10d36a0): no function in 0x10c0000-0x1120000 other than commandHorde, commandMoveTo,
  0x10ef890 and the motion update 0x1114a30 takes a path from the world's table (0x1601a10), so a routine
  like the old one (path record + pather + slots 0x548/0x128) was not found; the attack-side stop (:316) was
  not looked at.
- 0x10ef890 in detail (decompile in `out_S/s2.c`), 0x10dd340, 0x110be80, 0x10d36a0.
- 519686090 not traced. No truth log exists for either replay, so nothing was reproduced bit for bit.

## 6. Other situations the change affects

Every group move's end (all three truth replays): no individual leaving of in-place members, no formation
lock, no LINE / MEMBERS_SENT change, the group is deleted only when every slot is in place or failed 3 times
and no member has a current order; patrols; the follow distance. Check it against the truth replays' first
mismatches (e.g. the 228 s group of 517426097) before making it default.
