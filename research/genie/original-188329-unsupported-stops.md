# U1 - three "unsupported" stops late in replay 518239882 (original build 188329 vs genie default)

Binary `AoE2DE_s_unpacked.exe`, all addresses RVA. Engine paths relative to
`genie/crates/engine/genie-core/src/`. Read-only work: nothing was run on the PC, no engine file
was touched. "asm" = read in capstone disassembly (`dz.py`); "dec" = Ghidra decompile only.
Evidence files in `$RE/out_u1/`: `d33c40.asm` (base notify handler), `h2.c` (the 16 derived
notify handlers), `m1.c` (INTERACT handler 0xf510c0), `m3.c` (work 0x1140670, 0x12df320, AI slots
0x28 / 0x130), `m4.c` (MOVE handler 0xf50d90, player move 0x16ebc20), `m5.c` (unit slots 0x370 /
0x148, 0xd44860), `16ec871.asm` (MOVE point loop), `1140864.asm` (work tail).

None of the three needs an environment switch: each replaces an error by behaviour that the old
build's doc comments already describe and that 188329 has unchanged (only field offsets moved by 8).

## 1. Address table

| Role | 188329 RVA | Engine |
|---|---|---|
| Base notify handler (AI slot 0x238), case 0x1fb at 0xd3578a | 0xd33c40 | `unit_ai/actions.rs` `UnitAi::action_invalidated` |
| "retargeting off" byte (old `+0x1d6`) | `ai+0x1de` | `UnitAi::retarget_disabled` |
| setter `ai+0x1de = dl` (old `FUN_140c40ef0`) | 0xd19f50 | `orders/work.rs:186`, `unit_ai/idle.rs:196` |
| getter `ai+0x1de == 0` (old `FUN_140c4ee90`) | 0xd28650 | reads of `retarget_disabled` |
| setter caller 1: work function tail (attack task 7/9, class != 4) | 0x1141150 in 0x1140670 | `orders/work.rs` `carried_resource_test` |
| setter caller 2: siege idle, clears | 0xcfe59d in 0xcfe2d0 | `unit_ai/idle.rs` `siege_idle` |
| other readers: retarget check, a second idle | 0xd32e54 (in 0xd31d50), 0xcfec75 / 0xcfee48 (in 0xcfea00) | `unit_ai/retarget.rs:88`, `idle.rs:391,468` |
| AI slot 0x240 idle (base) | 0xd31a30 | `UnitAi::process_idle` |
| remove target (old `FUN_140c5e1e0`) | 0xd38f90 | `UnitAi::remove_target` |
| player is computer (`player+0x10 == 3`) | 0x1728be0 | `PlayerKind::is_computer` |
| AI slot 0xb0 stop current action (one function for all 17 AI vtables) | 0xd40e40..0xd41143 | `unit_ai/actions.rs` `UnitAi::stop_with` |
| AI slot 0x1a8 UpdateAdjustedIdleTimeout (base; vtable 0x3244ac8 has 0xcf4ed0 = 5/4) | 0xd1c290 | `unit_ai/life.rs` `update_adjusted_idle_timeout`, `cared.rs` `adjusted_idle_timeout` |
| unit-AI RNG object | 0x4354d00 (source line 6775 at 0xd1c2b7) | `Stream::Ai` |
| adjusted idle timeout / idle timeout base / secondary timer | `ai+0x16c` / `ai+0x170` / `ai+0x174` | `adjusted_idle_timeout` / `idle_timeout` / `secondary_timer` |
| Low-id command dispatch (`cmd[0]` 0..0x2e, table 0xf4f310) | 0xf4e380 | `commands/order.rs` |
| id 0 INTERACT: check 0xf41800, handler | 0xf510c0 | `orders/split.rs`, `orders/interact.rs` |
| id 3 MOVE: check 0xf41990, handler | 0xf50d90 | `commands/order.rs:83` |
| Player move (old `FUN_140e67800`) | 0x16ebc20..0x16ecd0c (grid loop 0x16ec2f4.., point loop 0x16ec871..) | `orders/interact.rs` `move_order`, `orders/moves.rs` `move_unit` |
| ignore list clear (`obj+0x1b8 = 0`), append | 0x1255e40, 0x124a900 | `mover.ignore_units` |
| object slot 0x2b8 (`obj+0x391 = dl`) | 0x121f0b0 | `mover.waiting` |
| AI "has an unready order" (entry byte `+0x2c == 0`) | 0xd27720 | `UnitAi::has_unready_order` |
| AI slot 0x30 / 0x28 queue an order (0x30 = 0x28 with shown point = point) | 0xd31940 / 0xd31210 | `UnitAi::queue_order` |
| object slot 0x148 move (unit / combat) | 0x113c2a0 / 0x12cbca0 | `World::move_to_point` |
| AI slot 0x130 move (run of order 0x2c6) -> unit slot 0x370 | 0xd30b80 -> 0x12cb9e0 -> 0x11549d0 | `process_order` Move |

## 2. The original's logic

### 2.1 Case 0x1fb of the base handler (asm 0xd3578a..0xd35a98; dec `out_r1/d33c40.txt` 777-894)

Registers: `rsi` = AI, `r14` = notify (`+0xc` = p0, the action value; `+0x14` = p2), `edi` = 1.
Every exit below returns 2 (0xd36fe1 `mov eax,2`) unless said otherwise.

1. `order = [ai+0x3c]`. If `(order == 700 || notify.p2 == 0x202) && notify.p0 == 600` (0xd357d2..0xd357f3):
   1. `cmp byte [ai+0x1de],0; je` step 3 (0xd3584d).
   2. `0x1616cf0(world, [ai+0x48])` (the current target id). Non-null: log "We're not allowed to
      retarget and our current target is still here." and **return 3** (0xd3589d / 0xd36798
      `mov eax,3; jmp 0xd36fe6`). Nothing else is written: target, order, action and the byte stay.
      Null: `byte [ai+0x1de] = 0` (0xd358a7) and go on.
   3. `r = ai.vt[0x240](ai, 0)` (processIdle). `r != 5`: return 2.
   4. `r == 5`, human player (`0x1728be0(player) == 0`): `0xd38f90(ai)`; `ai.vt[0xb0](ai, 1)`; return 2.
   5. `r == 5`, computer player: if `[ai+0x50] > 0 && [ai+0x54] > 0` (target point x, y; `comiss`/`jbe`,
      so NaN skips) then `ai.vt[0x130](ai, [ai+0x50], [ai+0x54], [ai+0x58], [ai+0x5c] + 2.0, 1, 0)`;
      result 0: `0xd38f90`, `vt[0xb0](ai,1)`, return 2. Otherwise (point not set, or the move was
      taken): 0xd355c1: on order 0x2c7 / 0x2dd, `[ai+0x16c] == 0x2ee` -> `vt[0x1a8]`, then
      `[ai+0x174] > 0x2ee` (signed) -> `= 0x2ee`; `[ai+0x64] = order`; `qword [ai+0x3c] = -1`
      (order and its priority); return 2. The action is not stopped.
2. Else (0xd35992): `action = [ai+0x44]`.
   - `order == -1`: `action == p0` -> `0xd38f90`, `vt[0xb0](ai,1)`, `vt[0x48](ai, notify)`.
   - `order != -1 && action + 100 == order`: the same three calls.
   - else order 0x2d4 with p0 0x262: `0xd38f90`, `vt[0xb0](ai,0)`, `vt[0x48](ai, notify)`.
   - else order 0x2bd with p0 0x262: `[ai+0x68] = action; [ai+0x44] = -1`.
   - else p0 == 600: `0xd38f90`, `vt[0xb0](ai,1)` (no slot 0x48).

Who can have the byte set (asm 0x114102c..0x1141150, same as the engine's `orders/work.rs`
`carried_resource_test`): the work function's tail, when its carry-test argument is non-zero, the
task found has action type 7 or 9, the unit's master class is not 4 (villager) and it has a unit
AI: `0xd19f50(ai, the argument)`. So any non-villager unit a player sends to attack. The only
other writers are the constructor (0xd0b53b), the siege idle (0xcfe59d, back to 0) and step 1.2.
The stances do not write it.

Derived handlers (`h2.c`): 13 of the 16 hand 0x1fb to the base unchanged. Three have their own
case: 0xd004a0 (villager, vtable 0x3245908: only when the current action is not 600), 0xd047b0
(vtable 0x3245b70: 0x1f9/0x1fb/0x202 with current action 0x25c), 0xcff850 (vtable 0x3246768: order
== -1 or the order's own action, then remove target / stop(1) / slot 0x48, never the base). None
touches `+0x1de`.

### 2.2 AI slot 0xb0, stop current action 0xd40e40 (asm, whole function)

`rbx` = AI, `edi` = argument (0 ends the order, 1 keeps it). Returns 1.

1. `[ai+0x68] = [ai+0x44]` (last action).
2. The order ends when `arg == 0 || [ai+0x44] + 100 == [ai+0x3c] || [ai+0x3c] == 0x2c7 || [ai+0x3c] == 0x2dd`
   (0xd40f0e..0xd40f2a); otherwise skip to step 6 ("Leaving the order alone.").
3. If the order is 0x2c7 or 0x2dd (0xd40f89..0xd40fc1):
   `cmp dword [ai+0x16c],0x2ee; jne` -> else `ai.vt[0x1a8](ai)`; then
   `cmp dword [ai+0x174],0x2ee; jle` (signed) -> else `[ai+0x174] = 0x2ee`.
4. `[ai+0x64] = order` (last order); `qword [ai+0x3c] = -1` (order and priority).
5. Master class (`master+0x38`) `!= 0x12`: `[ai+0x1b4] = unit x`, `[ai+0x1b8] = unit y`.
6. `unit.vt[0x3f8](unit)` (stopAction); `[ai+0x44] = -1`; `byte [ai+0x1b0] = 0`.

Slot 0x1a8 base 0xd1c290 (asm): `t = [ai+0x170]`; `r = rand(0x4354d00, file, 6775)`;
`[ai+0x16c] = r % (t >> 1) + ((t + 2t) >> 2)`, unsigned. One draw of the unit-AI stream, taken
before the unit's stopAction. Vtable 0x3244ac8: 0xcf4ed0, `[ai+0x16c] = (5t) >> 2`, no draw.

### 2.3 MOVE (command id 3)

Handler 0xf50d90 (dec `m4.c` 1-118): player from `cmd+1`; ids checked by 0xf53250; target object
by 0xf53770. The list handed on holds only ids that are not -1 **and** resolve to an object
(0xf50fdd): a missing object is dropped with no effect. Then
`0x16ebc20(player, list, target, x = cmd+8, y = cmd+0xc, queued = cmd+0x13 != 0,
ctrl = cmd+0x15 == 1, direct = cmd+0x14 != 0, flag = cmd+0x12 != 0)`.

Player move 0x16ebc20:

1. Each listed object with a unit AI (asm 0x16ebc71..0x16ebcc2): `0xd44860(ai)` (drops `ai+0x1c8`);
   `[ai+0x16c] >= 0x2ee` (unsigned `jb`) -> `vt[0x1a8]`; `[ai+0x174] > 0x2ee` (unsigned) -> `= 0x2ee`.
   Same as the engine (`unit_ai/life.rs:294`).
2. Ctrl: `obj+0x198 = 0xd6ca70(game)` for each with an AI. Splitter 0x10b6b40, groups (dec only).
3. Grid test: not a type-4 lobby player (0xe510a0) and more than one loose unit. The box loop
   (dec `m4.c`, 0x16ebf49..): leaves its group; an object with master type `< 0x1e` or speed
   (master slot 0xe8) `<= 0` is left out of the box **unless queued**.
4. Per loose object, grid loop (0x16ec2f4..) and point loop (asm 0x16ec8e0..0x16ecca2), same head:
   1. object gone -> next. (Point loop: in a group -> `0x10f64b0(group, id, target id or -1, 0)`.)
   2. `cmp byte [master+8],0x1e; jb` non-mover; `speed = master.vt[0xe8]()`;
      `comiss 0.0, speed; jb` mover (so `0 < speed`, a NaN speed counts as a mover).
      **Non-mover: `queued == 0` -> next object, nothing done; `queued != 0` -> goes on exactly
      like a mover** (0x16ec95c..0x16ec971, 0x16ec3a2..0x16ec3b7).
   3. `0x1255e40(obj)`, `obj.vt[0x2b8](obj, 1)`, `0x124a900(obj, other)` for every other loose id.
      All three write base-object fields (`+0x1b8`, `+0x391`, the list), so they exist on any object.
   4. Takes it itself: point loop `queued == 0 && (ai == null || !0xd27720(ai))` (asm
      0x16ec9e0..0x16ec9f8, **no test of `direct`**); grid loop
      `queued == 0 && (direct || ai == null || !0xd27720(ai))` (dec). Then `obj.vt[0x148](obj, target, x, y, 0)`.
   5. With an AI and not taking it (always so when queued): `ai.vt[0x30](ai, owner id, 0x2c6,
      target id | -1, target master | -1, target owner | -1, x, y, 0.0, 0.0, 0, 0, 100, direct)`
      (asm 0x16eca3d..0x16ecb1e; grid: slot 0x28 with the cell and the command point as shown
      point); then only when `!queued && !direct`: `0xd1d140(ai, 1)`. Next object.
   6. With an AI and taking it: not taken by the head action -> `0xd40990(ai,0x2c6,1)`,
      `0xd40980(ai,0x262)`, `0xd27410(ai)`; then `0xd40a10(ai, target.., x, y, 0)`.
   7. Without an AI, or after step 6: `obj.vt[0x308](obj, x, y, x, y)` (walk/show targets).

So a queued move of an object that cannot move is **queued anyway**: order 0x2c6, priority 100,
at the back of its unit AI's queue, ready = direct; an object without a unit AI gets only step 3
and the slot 0x308 call. Its ignore list and waiting byte are written like a mover's.

## 3. Confirmed differences from the engine default (the three errors)

### U1-1. Invalidated attack with retargeting off
- Original: 2.1 step 1.1-1.2 (asm 0xd3584d..0xd358a7).
- Engine: `unit_ai/actions.rs:139-143` returns `unsupported("an invalidated attack with retargeting off (+0x1d6)")`.
- Port, in `UnitAi::action_invalidated`, replacing the error block, before `process_idle`:
  ```
  if self.retarget_disabled != 0 {
      if at.target.is_some() { return Ok(BREAK); }   // 3, nothing else changes
      self.retarget_disabled = 0;
  }
  ```
  `at.target` is the same lookup (`Surroundings::target`, "None when it does not exist",
  `surroundings.rs:230-232`; the siege idle uses it for the same test, `idle.rs:189`). `BREAK` is
  `unit_ai/mod.rs:195` and already returned by other handlers; the notify loop leaves its pass on
  3 without clearing (`out_r1/verify.md`, 2.6). The rest of the function (processIdle, 5 ->
  `remove_target` + `stop_current(StopOrder::Keep)`, else `GO_ON`) already matches steps 3-4.

### U1-2. Stop on a patrol order
- Original: 2.2 step 3 (asm 0xd40f89..0xd40fc1) and slot 0x1a8 (asm 0xd1c290).
- Engine: `unit_ai/actions.rs:289-291` returns `unsupported("a stop on a patrol order")` when
  `patrol_redraws()` (order 711/733 and adjusted idle timeout == 750).
- Port, in `UnitAi::stop_with`: delete the `patrol_redraws()` error; inside the "order ends"
  branch replace `self.cap_patrol_secondary();` by `self.leave_patrol_timers(rng);`
  (`actions.rs:426-438`: redraw when exactly 750, then the signed cap at 750; the same order as the
  original, and it must stay before `last_order` / `current_order = None` because it reads the
  current order). `rng` is the AI stream (`unit_ai/side.rs:73-74`; all callers pass the unit-AI
  stream), and the draw comes before `side.effect_now(Effect::Stop, ..)`, as in the original.
  A patrol order always ends in this function, so the branch is always reached for it.
  `update_adjusted_idle_timeout` already has both variants (base draw, Hunted 5/4).

### U1-3. Queued move of an object that does not move
- Original: 2.3 step 4.2-4.5 and 4.7 (asm 0x16ec929..0x16ec971, 0x16ec9e0..0x16ecb40).
- Engine: `orders/moves.rs:93-100` returns the error for `QUEUED`, `Ok(())` otherwise.
- Port, in `World::move_unit`: for a non-mover keep `return Ok(())` when not queued; when queued
  fall through to the existing code. Two adjustments below it:
  1. `self.parts.mover_mut(unit.id).ok_or(..)` must not fail for an object without movement
     state: do the three writes (`ignore_units.clear()`, `waiting = 1`, `ignore_unit` per other)
     only if the object has a mover, else skip them (the original writes base-object fields that
     nothing reads for an object that never moves).
  2. The existing `!takes_it` block is then right as it stands: `queue_order(.., OrderKind::Move,
     COMMAND, point, range 0, shown, ready = DIRECT, Dispatch::Queued, QueueEnd::Back)`; no
     readiness drop and no stop, because the order is queued; an object without a unit AI returns.
- Ids that are -1 or whose object is gone: dropped by the handler, no effect (engine
  `move_order` already skips `None`; `move_unit` returns on `place(id) == None`).

## 4. Other differences seen while reading

- D-a (CONFIRMED both sides, small): MOVE's point loop takes the move itself only when
  `!queued && (no AI || no unready order)`; `direct` is not tested there (asm 0x16ec9e0..0x16ec9f8).
  Engine `orders/moves.rs:117-120` applies `DIRECT ||` to both the point and the grid path. In
  188329 a direct, not queued move to the point with an unready queued order is queued (ready).
- D-b (SUSPECTED, engine side not read): INTERACT's grid loop (0xf510c0, `m1.c`) exempts master
  class 0x36 from the speed test and gives a non-mover `slot 0x138(obj, target, x, y, 0, 1, 0, 0xffff)`
  before the queued test; INTERACT's point loop has no mover test at all. MOVE has neither.
- D-c (SUSPECTED): computer player in 2.1 step 5 (the engine errors there with
  "a computer player's invalidated attack (slot 0x130)"); the original's sequence is given above.

## 5. Not read

- What the queued order 0x2c6 does when a non-mover's AI later runs it: AI slot 0x130 (0xd30b80,
  read) calls unit slot 0x370 (0x12cb9e0 -> 0x11549d0, **not read**); the engine's
  `process_order` Move path for an object without movement state was not read either, so a later
  stop there is possible.
- Which object the replay's failing command names (the id may be wrong after earlier divergence;
  no run was made).
- Splitter 0x10b6b40, checks 0xf41990 / 0xf53250, 0xd1d140's tail, 0xd40990 / 0xd40980 / 0xd27410 / 0xd40a10.
- The bodies of the three derived 0x1fb cases beyond what 2.1 says; which AI kind owns vtables
  0x3245b70 and 0x3246768 is inferred (priest-like, building), not proven.
- Slot 0x240 overrides; the engine's notify loop handling of `BREAK` was taken from the R1 notes.
- The old build (158041) binary: "unchanged from the old build" rests on the engine's doc comments.
