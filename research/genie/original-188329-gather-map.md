# Villager-on-sheep code map, AoE2DE build 188329 vs genie (build 158041)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (image base 0x140000000).
Decompiles this is based on: `out_c/h1.c` (hunt update/set_state/start, find_drop_location),
`out_c/h2.c` (helpers, drop-site search), `out_c/h3.c` (MoveTo action, unit update, resource add),
`out_c/h4.c` (path request, Attack update/set_state). Disassembly of the hunt update: `out_c/upd.asm`.
"Confirmed" = read in decompile or disassembly of 188329. The 158041 side is only what the genie
doc comments say; I did not see the 158041 binary.

Sheep are handled by the **Hunt** action (type 110), not Gather (type 5). Flow for a human
player's villager sent to its own live sheep, as read in 188329:

start (slot 5) -> set_state(4): MoveTo sheep within 1.5 -> arrives: decay check, set_state(6)
-> live own livestock: nearest drop site of the sheep; if 9 < gap2(sheep, site) < 900 and not yet
moved: send sheep + herd to the site, set_state(10) (wait 1 s steps); otherwise set_state(12):
Attack sub-action -> target dead: decay check, set_state(4): MoveTo within task work range
-> set_state(6): if gap > range + 0.1 walk again, else face -> update state 6: target holds > 0
-> set_state(7) -> per-tick transfer -> full or empty: set_state(8): drop-site search, MoveTo
drop site -> deposit, set_state(4) back to the carcass.

## (a) Address table

Action objects: `+0x10` unit, `+0x18` state byte, `+0x20` target ptr (`+0x30` id), `+0x28`
second target = drop site (`+0x34` id), `+0x38/3c/40` point, `+0x44` timer, `+0x48` task ptr,
`+0x50` sub-action list, `+0x68` target class, `+0x6c` moved_sheep, `+0x70` drop site id for
herding, `+0x74` sheep_still_time, `+0x78/7c` sheep start x/y. Task: `+0x20` resource,
`+0x22` productivity attribute, `+0x24` resource-out, `+0x26` attribute_type4, `+0x28` work_val1,
`+0x30` work range, `+0x15` flags (bit 0 new, see D3), `+0x50` working sprite.
Action vtables have the same slot layout in every class: slot 5 (+0x28) start, slot 6 (+0x30)
update, slot 9 (+0x48) retarget/work, slot 13 (+0x68) set_target, slot 16 (+0x80) set_state.

| Role | 188329 RVA (size) | Engine (158041 address in its docs) |
| --- | --- | --- |
| Hunt vtable (type 0x6e) | 0x32274b8 | `gathering/hunt/mod.rs` (vtable 0x142ed70f8) |
| Hunt constructors | 0xbb1ab0, 0xbb1b40, 0xbb1d70 | `hunt/start.rs` (FUN_140ac2dd0) |
| Hunt start (slot 5) | 0xbb2fc0 (0x2be) | `hunt/start.rs` (0x140ac49b0) |
| Hunt update (slot 6) | 0xbb6230 (0x1d18) | `hunt/update.rs`, `gathering.rs`, `drop_off.rs`, `herding.rs`, `hunter*.rs` (0x140ac7a00) |
| Hunt set_state (slot 16) | 0xbb4a80 (0x1724) | `hunt/gathering.rs` set_walk/set_face/set_gather, `drop_off.rs` set_drop, `herding.rs` set_lead (0x140ac60e0) |
| Hunt retarget (slot 9) | 0xbb7f50 (0x64) | `hunt/start.rs` HuntRetarget |
| Hunt set_target (slot 13) | 0xbb61b0 (0x2b) | `drop_off.rs` set_target (FUN_140ac7980) |
| Hunt slot 4 | 0xbb3b40 (0xf31) | not analysed |
| Decay check | 0xbb2ae0 (0xbd) | `herding.rs` decay_check (FUN_140ac44b0) |
| Next-target search after a failed walk | 0xbb2c90 (0x322) | `hunt/next_tree.rs` (FUN_140ac4670) |
| Herd lead (recursive, 16 animals max, tiles +-3) | 0xbb3280 (0x1ad) | `hunt/hunter_strike.rs` lead_herd (FUN_140ac4c60) |
| Hunt walking sprite pick | 0xbb37b0, 0xbb37f0 (no .pdata) | `hunt/sprites.rs` (FUN_140ac51d0) |
| Sub-action list update (returns code 0..6) | 0xb8ae30 | `movement/move_to` update_sub_actions (FUN_140a992b0) |
| Sub-action list add / clear | 0xb89080 / 0xb89e60 | - |
| Set second target (drop site) | 0xb6b9b0 | FUN_140a7a190 |
| MoveTo vtable (type 1) | 0x3226048 | `movement/move_to/action.rs` |
| MoveTo ctor to object (unit, target, range, sprite, quiet, flag) | 0xb92150 (0x42d) | FUN_140aa0df0 |
| MoveTo ctor to point | 0xb920a0 (0xa8) | FUN_140aa0d30 |
| MoveTo start (slot 5) | 0xb92c50 (0x7c) | 0x140aa2100 |
| MoveTo update (slot 6) | 0xb93260 (.pdata 0x14a, body continues in chunks) | 0x140aa2a70 |
| MoveTo set_state | 0xb931b0 (0x65) | 0x140aa29e0 |
| Unit path request (fills obj+0x3f0, state byte +0x14 = 2) | 0x120e560 (0x490) | `movement/request.rs` (FUN_14114e410) |
| Unit per-tick walk (vtable 0x658) | 0x1210f60 (main session) | - |
| Attack vtable (type 9) | 0x32245e8 | `combat/attack` |
| Attack ctor used by hunt state 12 | 0xb6e010 (0x5f2) | - |
| Attack start / update / set_state | 0xb70570 / 0xb73f20 (0x13b1) / 0xb73530 (0x918) | FUN_140a992b0 path |
| Gather vtable (type 5) | 0x3224dc8: ctors 0xb79620/0xb796d0/0xb79ca0, start 0xb7c580, update 0xb800b0 (0x24c8), set_state 0xb7e500 (0x1b83, RNG lines 656/657) | `gathering/gather/` (vtable 0x142ed4f28). Not decompiled. |
| Build vtable (type 0x65) | 0x3226aa8 (update 0xba1b10, set_state 0xb9fae0) | - |
| Footprint gap squared (unit, object) | 0x124daf0 | FUN_14118f8c0 |
| Footprint gap (software sqrt of the above) | 0x124d8d0 | FUN_14118f680 |
| Face target (unit, target, 0, 0), returns 1 when facing | 0x1226330 | FUN_141162db0 |
| Drop-site search (list, masters vector, x, y, state flag, state, seeker, at_work, by_path, outside) | 0x1229bb0 (0x9b5) | `gathering/drop_sites.rs` (FUN_1411671e0) |
| Drop site takes the unit's load (site master id, unit) | 0x10ba220 | FUN_140fdd190 |
| Deposit to player (resource, unit id, amount, player) | 0xb69000 | `drop_off.rs` Dropped::Load |
| Set unit's carried kind/amount | 0x125bee0 (no .pdata) | FUN_14119d310 |
| Object "add resource" (vtable slot 0x110) | 0x113e4d0 -> 0x125bef0 | - |
| Unit work rate (vtable slot 0x270) | 0x11393d0 | master `+0x798` + powerup |
| Unit update with carcass decay (states 3/5) | 0x12488e0 (0x12f4, RNG "Update" line 3898) | `objects/lifecycle/mod.rs` dead() |
| Stop unit animation | 0x1224e60 (no .pdata) | FUN_141161850 |
| Is-computer-player test (0 = human) | 0x1728be0 | FUN_140fde4f0 |
| Unit AI queued-order count | 0xd31a10 | FUN_140c564a0 |
| "find_drop_location" | 0x1250da0 (0x3e0) | Not the resource drop-off, see (d) |

Constants read from .rdata: 0x369ff64 = 1.0, 0x3202890 = 0.1, 0x3201490 = 1.5, 0x321bc84 = 9.0,
0x31fd894 = 900.0, 0x3227540 = 2.25, 0x32063d4 = 0.01, 0x31faff0 = 0.2, 0x3203a78 = -0.5,
0x31b1420 = 0.5, 0x31fd87c = 10.0, 0x369ffb4 = 100.0, 0x322554c = -1e-7, 0x31b6520 = -1.0.
Timers written as immediates: -3.0 (0xc0400000), -1.0, -10.0 (0xc1200000).

## (b) What is the same (confirmed in 188329, matches the engine docs)

- Per-tick transfer, hunt state 7 (0xbb7291..0xbb7630): `work = work_rate * task.work_val1 * dt`
  (dt = float at world+0x164); `take = min(work, target.amount)`;
  `productivity = player attribute[task+0x22]` if the id is not -1 and the value > 0, else 1.0;
  `capacity = (float)(short)master[+0xbc]`; if `productivity*take <= capacity - held` is false
  -> set_state(8). Otherwise target += -take; if `target.amount < 0.1` then
  `gain += master[+0xb0]*c + target.amount` and target = 0 (no `0 <` test, as the engine's hunt);
  unit += gain; `over = |held - capacity|`; if `held < capacity && over < 0.1 && over <= target.amount`
  move `over` too; end: stay only if `0.1 <= over && 0 < target.amount`, else set_state(8).
  The multiplier `c` (0x31fe7cc) is 0.001, as in the engine.
- Carcass decay (0x12488e0 states 3 and 5): nothing held or amount <= 0 -> removal path; else if
  `master[+0xc0] > 0`: `amount -= dt * master[+0xc0]`, clamped at 0.
- Decay check 0xbb2ae0: task+0x26 == 0x124, player attribute 292 == 1.0, master decay > 0 ->
  own master if needed (0x1245ff0 / 0x1243cd0), flip sign bit. Called on walk arrival and on the
  Attack's end.
- set_state(4): range = task+0x30 for a dead target; 1.5 for live livestock of the same player.
- set_state(6) dead livestock: footprint gap > task range + 0.1 -> set_state(4) again.
- Herding thresholds: 9.0 < gap2 and gap2 < 900.0, moved flag, set_state(10), timer -1.0, 2.25
  re-face reach in state 10. Same structure as `set_face` / `update_lead`.
- Drop-off, state 8: site must take the load, footprint gap2 <= 1.0, otherwise timer -3.0 and
  animation stop. Sub-action codes 3/4 also give -3.0.
- MoveTo start: gap (0x124d8d0) > 0.01 -> state 3 (13 without speed), else state 1.
  MoveTo state 3: `gap2 <= range2` and unit AI order not 0x2c7/0x2dd -> state 1.
  MoveTo state 4: target more than 0.5 off on either axis -> `+0x61 == 1` asks again (state 3).
  Livestock (class 58) to master 109: no target, point = TC position - 0.2 on both axes.
- Drop-site search 0x1229bb0: same shape as the engine doc (state filter, zone test, at-work
  filter 0x7d/0x7c, farm case for class 4 on class 49, planner result < 2, short path within
  10.0 with 0.1, fishing ship class 0x15 within 100.0, else squared centre distance, strict `<`).

## (c) Confirmed differences from the engine's description

D1. Hunt state 4, sub-action codes 4/5 (target let go): a unit AI with queued orders ends the
    hunt instead of walking to the point.
    ```
    case 4: case 5:
      if ((*(longlong *)(param_1[2] + 0x1f0) == 0) || (iVar10 = func_0x000140d31a10(), iVar10 < 1)) {
        iVar10 = func_0x000140bb2c90(param_1);
        if (iVar10 == 0) goto code_r0x000140bb6750;      // set_target(0); set_state(0xb)
      } else {
        (**(code **)(*param_1 + 0x68))(param_1,0);
        (**(code **)(*param_1 + 0x80))(param_1,1);
      }
    ```
    Engine (`lost_on_the_way`): always set_target(None) and state 11.

D2. Hunt state 7 has a second decay test every tick, before the work: with task+0x26 == 0x124,
    player attribute 292 != 1.0, master decay < -1e-7 and the target having its own master
    (0x1245ff0), the decay sign is flipped back.
    ```
    if (((puStack_120._0_4_ != _DAT_14369ff64) && (... *pfVar2 <= _DAT_14322554c && _DAT_14322554c != *pfVar2)) &&
        (cVar6 = func_0x000141245ff0(param_1[4]), cVar6 != '\0')) { master[+0xc0] ^= 0x80000000; }
    ```
    The engine has the check only on arrival and after the Attack. No effect while attribute 292
    is 0 and decay is positive.

D3. Hunt state 7, new task flag `task[+0x15] & 1` (0xbb7630): the load goes to the player at
    once (player vtable 0xf8 with the resource task+0x24 or the unit's kind, then 0xb8), the
    unit's amount is cleared through slot 0x110 and `over` is recomputed. The engine's hunt has
    no such branch (its Gather has the farm-food sale by attribute 96 instead).

D4. Resource changes in state 7 go through object vtable slot 0x110 (0x113e4d0), not plain
    writes. Unit gain is called with (amount, add=1, 0, flag=1, target master id, target
    class + 900). 0x113e4d0 clears `obj+0x40c`, calls 0x125bef0, and with the flag set walks a
    per-unit table `obj+0x448..0x450` (16-byte entries: key at +4 matched against the master id,
    class+900 or -1; two floats at +8, +0xc) and accumulates `amount * a * b` into a map at
    `obj+0x460`.
    ```
    *(float *)(*plVar5 + 0x14) = param_2 * fVar1 * fVar2 + *(float *)(*plVar5 + 0x14);
    ```
    0x125bef0 itself is a plain add/set with an optional clamp to master[+0xbc].

D5. Unit work rate (slot 0x270, 0x11393d0) = master[+0x238] + slot 0x748, then every entry of a
    per-unit modifier list of kind 0xd is applied through 0x1414c2950. Engine: master work rate
    plus powerup only.

D6. Hunt state 8 deposit: after the main load (0xb69000) and clearing the carry (0x125bee0 with
    -1), a second loop deposits every node of a list returned by 0x1139090(unit):
    ```
    lVar11 = func_0x000141139090(param_1[2]);
    for (puVar4 = *puVar3; puVar4 != puVar3; puVar4 = *puVar4)
      func_0x000140b69000(*(undefined4 *)(puVar4 + 2), *(undefined4 *)(param_1[2] + 8));
    ```
    Then unit vtable 0x838. Not in the engine's `update_drop`.

D7. Hunt state 8, site that does not take the load (0x10ba220 returns 0): set_state(0xb) when
    the hunt's point is set (`+0x38`, `+0x3c` != -1), else set_state(2). Engine doc: set_state 2.

D8. Hunt state 8 after a deposit with no target left, human player: the next-target search is
    inline in the hunt update (0xbb7a..0xbb7e49): queued orders -> set_state(1); else unit AI
    slot 0x1b0 on its class; class 0x3a (livestock) uses 0xd22c20 twice with a distance test
    against max(slot 0x228, slot 0x2e0); masters 0x769/0x765 (pastures) go through 0x127f2d0;
    a found object is retargeted through slot 9 (`+0x48`) or notify 0x21d. Engine: "searches for
    a new one (the caller's)". Not compared line by line.

D9. MoveTo update 0xb93260 has no wait: state 2 goes straight to set_state(3), and a walk result
    of 1 goes straight to set_state(13). `MoveTo+0x6c` is now a constructor flag byte that picks
    the sprite (slots 0x888/0x890). The engine has a state-2 wait counted by dt and a
    "human villager waits once" rule (`Patience::WaitsOnce`, `+0x6c` 1 -> 2).
    ```
    if (cVar1 == '\x02') { (**(code **)(*param_1 + 0x80))(param_1,3); }
    ...
    cVar1 = (**(code **)(*(longlong *)param_1[2] + 0x658))();
    if (cVar1 == '\x01') (**(code **)(*param_1 + 0x80))(param_1,0xd);
    else if (cVar1 == '\x02') { (**(code **)(*param_1 + 0x80))(param_1,1); func_0x00014120d940(param_1[2]); }
    ```

D10. MoveTo state 4 with `+0x61 == 0` (follows): before notify 0x1fc it tries to patch the last
     waypoint through the path system (0x14111d8e0, 0x14111d0c0 with 0x40, 0x141075e10). Does
     not apply to hunt sub-actions, which set `+0x61 = 1` (0xbb4de8).

D11. Hunt state 12 has a computer-player-only block before the Attack's update (0xbb6880..):
     lure behaviour with a new sub-action 0xb76a10 or a MoveTo to a point near the object from
     0x1727d10(player). Skipped for humans (`0x1728be0 == 0`).

D12. Face in state 6: 0x1226330 returning 0 (unit with master turn time `+0x1f8` still turning)
     gives set_state(3). Confirmed at 0xbb6f05 -> 0xbb6f3b. The engine does not model turning
     hunters. Villagers with turn time 0 always get 1.

## (d) Suspected, not confirmed

S1. D4 + D6 look like one feature (secondary resource generated while gathering, paid at the
    drop-off). I did not confirm that the map at `obj+0x460` is what 0x1139090 returns.
S2. Drop-site search with point (-1, -1): the decompile shows `break` before a site is stored;
    the engine says the first matching site wins. Needs disassembly at 0x1229bb0.
S3. Drop-site list is now a vector (begin/end, searched by 0x142d6c290) at master+0x240; the
    caller still tests `**(short**)(master+0x240) == -1`. Order of iteration is the player's
    object list, which the main session found id-ordered: the "first of equals" may differ.
S4. set_state(6) for live own livestock, human player: the search call is
    `0x1229bb0(list, 0x1410bae70(), sheep x, sheep y, 1, 2, 0, -1, 0, 0)`: no seeker, so by
    squared centre distance. A computer player uses other master lists (0x868006d, then 0x26d).
S5. Unit update state 3 calls 0x12515c0 and then 0x12429c0 before the shared state-5 body; I
    did not identify them.
S6. MoveTo state 3 in-range test reads as `in range && unit AI != 0 && order not 0x2c7/0x2dd`;
    a unit without unit AI would then not end in range. May be a decompiler grouping artefact.
S7. Hunt start 0xbb2fc0 reads a game setting (0x1413d3f00) and the computer-player test when
    deciding whether to keep or clear a load of another kind; not compared with `hunt/start.rs`.
S8. set_state(6) calls 0x141116f60(unit, target) for target classes 8, 0x20 and 0xf. Not sheep.

## (e) Not found / not done

- `find_drop_location` (0x1250da0, lines 7731-7743, Object RNG 0x4354d90) is not the resource
  drop-off: it draws a side (rand*4/0x7fff) and a random point on that side of a box grown by
  the two radii + 0.01, up to 50 tries, with a placement test. Its callers were not traced.
- Where the villager stands next to the sheep is not decided in the Hunt or MoveTo code: they
  only pass (target id, target position, range) to 0x120e560, and arrival is the walk's result 2
  from vtable 0x658 (0x1210f60). The goal-box / range handling inside the pather and the walk was
  not compared here.
- Attack action (0xb73f20, 0xb73530, 0xb70570): addresses only. The approach to the live sheep
  in state 12 uses its own MoveTo (0xb92150 with range `attack+0x90`).
- Gather action type 5 (0x3224dc8): addresses only.
- The state-3 search (timer -10.0, notify 0x202 with
  the nearest drop site id) was not compared with the engine.
