# Session B: upstream c050b687 (work-command arguments) and aefb2c22 (obstruction ignore list) against 188329

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (build 188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/` and refer to the PC tree as staged on 2026-11-11 (container
snapshot `/home/claude/B-src`, commit `4dc144b1` = 91d81be4 + the PC's working tree). Nothing on the
PC was changed or run; no census or trace was started. Decompiles: `out_B/g1.c` (group/AI/let-out
callers), `out_B/g2.c` (walk queries 0x120cb90 etc.); older: `out_u1/m3.c` (0x1140670, 0x12df320),
`out_p16/ign.c` (0x120ee10), `out_p5/a.c` (0x12bc7e0), `out/mv.txt` (walk 0x1210f60).

Result in one paragraph. (1) **Upstream's reading is right for 188329**: slot 0x128 of 158041 is
slot 0x138 in 188329, its 6th argument is the order source (`+0x69c`, old `+0xa14`) and its 7th is
the work byte (carried-resource test / retargeting off). The engine took the constant 1 most callers
pass in the 6th place for the byte. Confirmed per caller below; patch `taskargs_188329*.patch`.
It does **not** directly explain the stops "a horde's command" (raised in `group_command` before
any work) or "a helper that answers a call for help" (no work command on that path); the second
can be reached more often in the engine because group soldiers wrongly get retargeting off and go
idle (suspected only). (2) **aefb2c22's behaviour matches 188329**: the walk's query 0x120cb90 sets
the manager's ignore list first and never clears it, so the straight and close-in checks leave
[unit, target + annexes] for later queries. Patch `ignorelist_188329*.patch`. A second, 188329-only
consequence is also confirmed: the short-path ignore builder's drop-off query (0x120ee10) reads
that left-over list; the engine passes only [unit, target]. The 518470161 215.4 s shepherd case is
very probably **not** this rule (9366 stands gathering, nothing names it in the list); the
518239882 383.4 s woodcutter case is open (trace patch provided).

## 1. Address table

| Role | 188329 | 158041 (engine docs) | Engine |
|---|---|---|---|
| Work command (base, action object, vtable 0x32a4698 slot 0x8a8) | 0x1140670 | FUN_14106ff70 | `orders/work.rs` `work_command` |
| Work command (combat 0x32b4fa8 / building 0x32b71c0 slot 0x8a8) | 0x12df320 -> 0x1140670 | slot 0x7e8 FUN_141227190 | `World::order_work` |
| Work byte use: other-resource load wiped, attack task (7/9) of class != 4 -> `ai+0x1de` | 0x1140864.., setter call 0x1141150 (0xd19f50) | `+0x1d6`, FUN_140c40ef0 | `carried_resource_test` (`work.rs:159`) |
| Work's 6th argument: only logged (debug flag 0x4356c7b) | 0x1140670 dec lines 273/295 | — | — |
| Slot 0x128 (action object), hands on: (6th ignored, 7th -> work arg 8, 8th -> work arg 7 filter), `+0x428`++ | 0x113b510 (vtable slot 0x138) | FUN_14106c590 | `give_work` / `order_work` |
| Slot 0x128 (combat/building): `+0x69c` = arg 6; arg 6 != 0 and AI -> queue clear 0xd38dc0; then 0x113b510; `+0x69c` = 1 | 0x12c6590 (slot 0x138) | FUN_141211b80 | `interact.rs:234` `give_work` |
| Slot 0x140 (work with nothing else): 0x8a8 with (1, 0xffff, 0), no `+0x69c` write | 0x11414d0 (slot 0x150) | FUN_141070c90 | `mule_cart.rs` `cart_work` |
| Notify clear by source: type < 0x46 or `+0x69c` != 0 -> 0xd38990(ai,0) | 0xd40dc0 (getter 0x12b3df0) | FUN_140c64e50 | `OrderSource::notifies` |
| Move start reads `+0x69c` (queue clear) | 0x12cbca0 at 0x12cbd51 | FUN_141216f10 | `work_move` source |
| Group release (FUN_14103d460): slot 0x138 (1, group `+0x3e4`, group `+0x3e6`) | 0x11099a0 / chunk 0x11099fe, call 0x1109ca3 (args 0x1109b78..0x1109bc9) | `+0x3dc`, `+0x3de` | `groups/update/release.rs` `release_unit` |
| Group send in reach (FUN_14102bbd0): slot 0x138 (1, param-3 byte, param-4 word) | 0x10f5f60 / chunk 0x10f5fd1, call 0x10f62c5 | | `groups/update/send.rs` `send_in_reach` |
| Villager drop elsewhere (0x21c): slot 0x138 (1, 0, 0xffff) | 0xd004a0, call 0xd02ba9 (args 0xd02b80..0xd02b8c) | | `orders/drop_site.rs` `drop_elsewhere` |
| Villager made object (0x25a/0x265 case): 0x8a8 (1, 0xffff, 0) | 0xd004a0, call 0xd02e54 (args 0xd02e28..0xd02e34) | | `unit_ai/kind_notifies.rs` `work_on_made` -> `AiCommand::WorkOn` |
| AI order on target: present -> slot 0x138 (0, 0, 0xffff); gone -> slot 0x1b0 kind, 0x88 closest -> 0x8a8 (1, 0xffff, 0) | chunk 0xd3728e (parent 0xd37140): 0xd37d50..0xd37e39; 0xd37f96..0xd3807f | FUN_140c5c170 case 0x2db | `orders/interact.rs` `order_on_target`; `unit_ai/order_kinds.rs` `order_on_target` |
| Same, gone target whose class has no resource kind (0x1b0 == 0xff): target search 0xd22c20 then 0x8a8 (1, 0xffff, 0) | 0xd37eed..0xd37f31 | | **not modelled** (`order_kinds.rs` returns NotTaken) |
| Town bell way back: `+0x69c` = 0; outside unit 0x8a8 (1, 0xffff, 0); inside -> let-out 0x12a16e0 (slot 0x138 (0, 0, 0xffff)); `+0x69c` = 1 | 0x12bc7e0 (0x8a8 at 0x12bc8b5); let-out call 0x12a1856 | FUN_1412081e0 | `orders/town_bell.rs` `back_outside`; `garrison/let_out.rs` `came_out` |
| INTERACT: slot 0x138 (1, order byte `cl`, filter) | 0xf51484 calls 0xf51c94 / 0xf51f38 | | `orders/interact.rs` (already right) |
| Other direct 0x8a8 callers, all byte 0: 0xb800b0, 0xb82580, 0xba1b10, 0xbbab40, 0xcfcbd0, 0x110cbd0, 0x12c19f0, 0x16ecf20, 0x16f0680 | | | |
| Obstruction manager (global) | `[0x4357fe0]` | | `Spatial` |
| Manager set ignore list: `+0x2c` = (flag && list && n>0), `+0x38` = list **pointer**, `+0x30` = n | 0x1121360 | FUN_1410562e0 | `Spatial::set_manager_ignore` (`map/spatial/grid.rs:242`) |
| Query's cell test skips a record whose id is in the list | 0x111cb80 at 0x111cd99..0x111cdc1 (also 0x111ced0 at 0x111d006) | FUN_141051e00 | `obstruction_candidates`, `walk_hits`, `object_holds` |
| Query mode (grow) set/clear | 0x1121350 | | — |
| Walk's query: sets ignore list (param list, else static [unit]), tile records if p7, query flags 0x90 + 0x100*p10, clears mode, never clears the list | 0x120cb90 (set at 0x120cc1b) | FUN_14114cc60 | `straight`, `close_in`, `walk_hits` |
| Straight / close-in check: global list 0x43a17e0 (count 0x43a17d0) reset, 0x120e9f0(unit), 0x120e9f0(target); p8 = 0.5 (straight, p10 = 1) / 1.0 (close-in) | 0x1207520, call 0x12076f9 | FUN_141142750 | `movement/waypoint.rs` `straight`, `close_in` |
| Append id + building annexes (`+0x870`, 4) to the global list | 0x120e9f0 | FUN_14114e8a0 | `ObjectsRef::query_ignore` |
| Walk's step query: global reset, [unit], scale 1.0 | 0x1210f60 call 0x121473a | | `movement/step.rs:607` walk_hits [me] |
| Walk's long-path stretch query: global list as it stands, scale 0.6 | 0x1210f60 call 0x1213b58 | | `movement/request.rs` `walled_off` |
| Waypoint drop (flags 0x20 point query, no set) | 0x1210f60 (mv.txt 229-262) | FUN_141051900 | `waypoint.rs` `drop_held_waypoint` |
| Short-path ignore builder, drop-off query 0x111c660 at 0x120f04f, no set | 0x120ee10 | FUN_14114ece0 | `movement/new_path.rs` `ignore_list` |

## 2. The original's logic

### 2.1 Work arguments

1. `0x1140670(this, target, x, y, z, a6, a7 filter, a8 byte)` (= old FUN_14106ff70). `a6` is read only
   for the debug log. `a8 != 0` and a task found: gather/hunt (5/0x6e) of another resource than
   `this+0x160`'s held kind (food kinds 0, 15..17 as one) -> `0x125bee0(this, kind, 0)` and slot
   0x838; attack task (7/9) of a unit whose master class != 4 and with a unit AI -> `0xd19f50(ai, a8)`
   (`ai+0x1de`, the old `+0x1d6`).
2. `0x12df320` (combat/building slot 0x8a8) passes `a6, a7, a8` through unchanged to 0x1140670.
3. Slot 0x138 (old slot 0x128): `0x12c6590(this, target, x, y, z, s6, s7, s8)`:
   `this+0x69c = s6`; `s6 != 0` and a unit AI -> `0xd38dc0` (queue clear); then
   `0x113b510(this, target, x, y, z, s6, s7, s8)` which (target != this) calls slot 0x8a8 with
   `(…, a6 = 0, a7 = s8, a8 = s7)` and `+0x428`++; finally `this+0x69c = 1`. So **s6 = order source,
   s7 = work byte, s8 = filter**.
4. `0xd40dc0` (the new action's notify): clears the AI's notifies when the unit's type < 0x46 or
   `+0x69c != 0`. `+0x69c` is 1 except inside 0x12c6590 with s6 = 0 and inside 0x12bc7e0.
5. Callers (args read in asm at the addresses in section 1):
   - INTERACT: slot 0x138 (1, order byte, filter).
   - Group release 0x11099fe: slot 0x138 (1, group `+0x3e4`, group `+0x3e6`); then retarget timer 0x1109d21.
   - Group send 0x10f5fd1: slot 0x138 (1, its 3rd parameter byte, its 4th parameter word); retarget timer 0x10f635a.
   - Villager drop elsewhere: slot 0x138 (1, 0, 0xffff).
   - Villager made object (pasture/farm): 0x8a8 (1, 0xffff, 0).
   - AI order on a present target: slot 0x138 (0, 0, 0xffff). On a gone target: resource kind
     (AI slot 0x1b0) -> closest (slot 0x88) -> 0x8a8 (1, 0xffff, 0); kind 0xff -> target search 0xd22c20
     -> 0x8a8 (1, 0xffff, 0).
   - Town bell way back 0x12bc7e0: `+0x69c = 0`; outside: 0x8a8 (1, 0xffff, 0); inside: let-out
     slot 0x138 (0, 0, 0xffff); end `+0x69c = 1`.
   - Slot 0x150 (old 0x140, the cart): 0x8a8 (1, 0xffff, 0).
   - Every other direct 0x8a8 caller found passes byte 0. **The byte is non-zero only from INTERACT
     and from a group's byte.**

### 2.2 Manager ignore list

1. `0x1121360(mgr, flag, list, n)` stores the flag, the pointer and the count; queries read
   `list[0..n]` at query time (0x111cb80: skip a record whose `+0x18` id is in it).
2. `0x1207520` (straight / close-in; last byte = straight): resets the global list (count = 0),
   appends unit and target with annexes (0x120e9f0), calls `0x120cb90(.., list = 0x43a17e0,
   n = count, tiles = 1, scale 0.5 or 1.0, flags 0x190 or 0x90)`.
3. `0x120cb90`: **first** `0x1121360(mgr, 1, list, n)` (the static [unit] when no list), then mode,
   tile records, query 0x111c660, mode cleared (0x1121350(0,0)), tile records removed (0x1121280).
   The ignore list is **not** cleared: it stays until the next 0x1121360.
4. Readers that do not set it: the waypoint drop (flags 0x20 query in the walk), and 0x120ee10's
   drop-off query (0x111c660 at 0x120f04f), which also skips self and target by hand.

## 3. Confirmed differences and patches

Patches (all compile-checked with `cargo check --ignore-rust-version -p genie-core` on the
container copy of the PC tree; only the 8 old warnings remain). `*_pc.patch` has the PC's line
endings (7 of the touched files are CRLF on the PC) and was checked with `git apply --check` against
PC-byte copies; the plain `*.patch` is LF (for the container/fork). Apply on the PC from
`genie/` with `git apply --check <file>_pc.patch` then `git apply`.

### T. `GENIE_EXPERIMENT_TASKARGS_188329` (`out_B/taskargs_188329_pc.patch`)

Engine side read: `objects/unit/stop.rs:269-276` (WorkOn: `carry_test: true`, `Queued`),
`groups/update/release.rs:89-100` (`carry_test: true`, source = group byte),
`groups/update/send.rs:76-88` (same with the order byte), `orders/drop_site.rs:307-314`
(`carry_test: true`, `Queued`, `order_work`), `orders/town_bell.rs:551-557` (`carry_test: true`),
`orders/work.rs:251` (`if carry_test { carried_resource_test }`), `:213` (notifies by source),
`orders/interact.rs:234` (`give_work`: queue clear on Direct).

| Site (engine fn) | Engine now | 188329 | Switch on |
|---|---|---|---|
| `stop.rs` `ai_command` WorkOn (AI order on gone target; villager's made farm/pasture) | byte 1, Queued | 0x8a8 (1, any, 0); `+0x69c` = 1 | byte 0, Direct (notifies cleared) |
| `release.rs` `release_unit` | byte 1, source = group byte | slot 0x138 (1, group byte, filter) | byte = group byte, Direct |
| `send.rs` `send_in_reach` | byte 1, source = order byte | slot 0x138 (1, order byte, filter) | byte = order byte, Direct |
| `drop_site.rs` `drop_elsewhere` | byte 1, Queued, `order_work` | slot 0x138 (1, 0, any) | `give_work` (queue cleared first), byte 0, Direct |
| `town_bell.rs` `back_outside` | byte 1, Queued | 0x8a8 (1, any, 0), `+0x69c` = 0 | byte 0 (Queued kept) |

Helper `orders::taskargs_188329()` added to `orders/mod.rs` after `impl OrderSource` (OnceLock).
Unchanged on purpose: INTERACT, the cart (already byte 0 on the PC), let-out, the AI's order on a
present target, the drop-off work at `drop_site.rs:93` (all already match).

### I. `GENIE_EXPERIMENT_IGNORELIST_188329` (`out_B/ignorelist_188329_pc.patch`)

Engine side read: `movement/waypoint.rs:324-364` (`straight`: query with explicit `&ignore`, no
set), `:376-411` (`close_in`: no set before `tiles_block`'s early return; `walk_hits` sets it only
afterwards, `map/spatial/grid.rs:288-299`), `movement/new_path.rs:226-236` (drop-off query
`obstruction_candidates(rect, grow, &[me, target])`, `map/spatial/footprint.rs:382-398`: no manager
list).

- I1 (= aefb2c22, CONFIRMED): `straight` and `close_in` call `world.set_manager_ignore(&ignore)`
  right after `query_ignore(&[me, target])`, before the tile test (0x120cb90 sets at 0x120cc1b first).
  The query itself is unchanged (same list). Readers after it now see [unit, target + annexes]:
  `drop_held_waypoint` and MoveTo `target_left`'s `segment_blocked(.., &manager_ignore())`.
- I2 (188329, CONFIRMED both sides; not in upstream): `ignore_list`'s drop-off query skips
  `world.manager_ignore()` too.
- Helper `Spatial::ignorelist_188329()` in `map/spatial/grid.rs` (associated fn, no module change).
- No signature change (upstream's `segment_blocked` without the `ignore` argument is not needed and
  would touch tests).

Optional diagnostic `out_B/ignorelist_trace_pc.patch`: adds `mgr=` (the manager's list) to the
existing `IGNORE` trace line in `movement/request_plans.rs` `short_path_to` (STEER trace only).

## 4. Suspected / open

- S1 "a helper that answers a call for help" (`unit_ai/world_view/side.rs:192`): not raised by any
  work command. With the engine's byte 1 every group attack of a soldier turns its retargeting off
  (`work.rs:186`), so after its target dies it does not retarget (`retarget.rs:88`) and can sit idle
  (no action, no target) next to an attacked ally, which is exactly what `helper_free` asks. In 188329
  only a group with its byte set does that. So TASKARGS may move or remove the stop at update
  36,452/36,479 (518239882), but it cannot be shown without a run.
- S2 "a horde's command" (`groups/order.rs:76-79`): raised in `group_command` before any work or
  slot 0x138; **not explained** by either change.
- S3 518470161 215.4 s shepherd 9381 (case_p16 S1): engine trace `f1_e` shows 9366 standing in Hunt
  state 7 at updates 16395-16402. I2 can only remove a standing worker from the drop-off hits if the
  list left in the manager names it, and every 188329 setter found names the walker, its target and
  annexes, or a group's members. So this is very probably **not** the cause; the start-node escape
  scan (0x107e9d9..0x107f66e) stays the suspect.
- S4 518239882 383.4 s woodcutters 4371/4363: possible through I1 (the waypoint drop near the
  lumber camp now sees [unit, camp + annexes]) or I2 (if a neighbour that stopped this update set the
  list). Test: run 518239882 with IGNORELIST (+ trace patch, `GENIE_TRACE_STEER_RANGE` around the
  383.4 s update) and compare the 4371 path with truth4.
- S5 Pointer, not copy: 188329 stores a pointer to the global list 0x43a17e0; a later rebuild of that
  list (count reset + 0x120e9f0) without a new 0x1121360 changes what the manager reads (with the old
  count). The walk does this at mv.txt 1303-1305 before 0x1213b58. The engine copies. Not modelled.
- S6 Other 188329 setters of the manager list not mapped to engine code: 0x1217630 (from group code
  0x10ef890, 0x1109d70, 0x1114a30, 0x1203903), vtable slots 0x1218d50/0x1218f70, 0x10597aa,
  0x10d2490, 0x11079e0 (the only one that also clears), 0x1061296, 0x1287fe0 (3 entries), 0xb7b41b,
  0xcf3350. If the engine misses one, the list I1/I2 read can still differ.
- D-x (CONFIRMED, not patched): AI order on a gone target whose class has no resource kind:
  188329 runs the target search 0xd22c20 and works on its result (0xd37eed..0xd37f31, then
  0xd37f96); the engine returns NotTaken (`unit_ai/order_kinds.rs` `order_on_target`,
  `let Some(kind) = self.resource_kind(..) else { return Ok(OrderOutcome::NotTaken) }`).
  This is an AI-started attack path the engine lacks entirely.

## 5. Not read

- Which 188329 function is MoveTo's `target_left` straight test (engine says FUN_141052b90 +
  FUN_141052350 reading the manager list); assumed unchanged from 158041.
- Whether WorkOn can ever run inside a 0x12c6590 frame with s6 = 0 (then `+0x69c` = 0 and the engine's
  old Queued would be right); the two 188329 callers run from the AI's order processing and the
  villager notify, not from a work command.
- The command count `+0x428` (old `+0x888`) the slot increments: not held by the engine (as before).
- `/home/claude/re-env/sessionA.md` did not exist when this was written; overlap was judged from the
  file list in the task.

## 6. What each change affects (and which verified results it may disturb)

TASKARGS:
- Villager who builds a farm/pasture while carrying another resource, then works it (WorkOn on the
  made object): today the engine sets held to food 0 at once; with the switch the load stays until
  the gather action changes it. Touches held/food numbers around every first farm. Check: a farm
  builder carrying wood in truth5/truth6 (held field right after the farm completes).
- AI queued order on a gone resource (shift-queued work): no load wipe, notifies cleared.
- Villager "other load" drop elsewhere (0x21c): its AI order queue is emptied before the work, then the
  back order is queued (before: old queue kept, back order appended behind it); notifies cleared.
- Town bell way back for a unit outside: no load wipe when the old task is another resource.
- Group attacks (release/send): retargeting off only with the group's byte; the AI queue is always
  emptied; notifies always cleared. Affects any group combat (517426097 228.5 s group case is
  formation movement, not a work; probably unaffected), the "invalidated attack with retargeting off"
  path (fewer hits), and S1.
- No effect on: INTERACT orders, hunting/gathering started by INTERACT, let-out, carts.

IGNORELIST:
- Every walking unit: after a look-ahead straight check or a close-in check, the manager list is
  [unit, target + annexes] until the next setter. Readers: waypoint drop (a held next-but-one
  waypoint near the target or own annexes is no longer dropped), MoveTo follow check, drop-off
  ignore rule (I2). Can move positions anywhere walking is verified (all three replays, including
  the bit-exact walk cases 4.9 s, 10 s, 60.7 s, 90.9 s, 166.9 s). Run the three replays with the
  current switch set plus `GENIE_EXPERIMENT_IGNORELIST_188329=1` and compare first mismatches with the
  current baseline before keeping it.

## 7. Files

- `out_B/taskargs_188329_pc.patch` (PC line endings) / `taskargs_188329.patch` (LF): `orders/mod.rs`
  (new fn after `impl OrderSource`), `objects/unit/stop.rs` `ai_command`, `groups/update/release.rs`
  `release_unit`, `groups/update/send.rs` `send_in_reach`, `orders/drop_site.rs` `drop_elsewhere`,
  `orders/town_bell.rs` `back_outside` (one 2-line hunk at line 555; session A edits this file:
  apply after it, re-check context).
- `out_B/ignorelist_188329_pc.patch` / `ignorelist_188329.patch`: `map/spatial/grid.rs` (new
  associated fn after `manager_ignore`), `movement/waypoint.rs` `straight` and `close_in`,
  `movement/new_path.rs` `ignore_list`.
- `out_B/ignorelist_trace_pc.patch` / `ignorelist_trace.patch`: `movement/request_plans.rs`
  `short_path_to` (diagnostic line only).
- Container work tree with all three as commits: `/home/claude/B-src` (worktree of
  `/home/claude/genie-upstream`, local commits only, nothing pushed).
- Decompiles: `out_B/g1.c`, `out_B/g2.c` (Ghidra copy `re/proj_B`).
