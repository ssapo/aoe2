# TASK C1: verification of the "confirmed differences" in out_c/gather_map.md (Hunt type 110, MoveTo)

Binary: AoE2DE_s_unpacked.exe build 188329, all addresses RVA. Engine: genie-core/src on the PC
(`$HOME/mnt/genie-replays/genie/crates/engine/genie-core/src`), read only.
188329 evidence: `out_c/h1.c..h4.c` (re-read), `out_c/upd.asm` (hunt update disassembly), fresh
disassembly with dz.py, and new decompiles in this directory: `s1.c` (pathing-shape helpers, object
removal), `s2.c` (base set_state 0x125c2d0, destructor, ownership change), `s3.c`, `s4.c`
(shape add 0x11214d0), `s5.c` / `setstate_combat.txt` (combat object set_state 0x12d29c0).
gather_map.md lists twelve items (D1..D12); all twelve are covered.

"Relevant" = can change a human player's villager on sheep/boar/deer in a 2-human game without
pastures.

## Table

| Item | Verdict | Relevant | 188329 evidence | Engine evidence |
| --- | --- | --- | --- | --- |
| D1 hunt state 4, codes 4/5, queued orders end the hunt | REAL | Only when the villager has queued (shift) orders and its target vanishes during the walk | upd.asm 0xbb66f9..0xbb6769, jump table 0xbb7f30 | hunt/update.rs 276-297 `lost_on_the_way` |
| D2 state 7 flips the decay sign back | REAL | Rare: needs attribute 292 != 1 and a target whose decay was stopped earlier (negative) | h1.c state 7 head (0xbb7291 area), consts 0x369ff64, 0x322554c | hunt/herding.rs `decay_check`/`stops_decay_of`, hunt/gathering.rs 248-304 |
| D3 task flag bit 0: load paid at once | REAL in code, data-dependent | CANNOT TELL (needs the .dat: any Hunt task with `combat_level_flag` bit 0) | h1.c state 7 tail, `(*(byte*)(task+0x15) & 1)` | hunt/gathering.rs 248-304 (no such branch); genie-model task.rs `combat_level_flag` |
| D4 gain through slot 0x110 with a per-unit table | REAL in code | CANNOT TELL (needs unit+0x448 table non-empty) | 0x113e4d0 (h3.c), 0xbb7630 area | hunt/gathering.rs 279-283 plain adds |
| D5 work rate with per-unit modifier list kind 0xd | REAL in code | CANNOT TELL (needs a modifier of kind 13 on the unit) | 0x11393d0 (h3.c) | hunt/hunter_strike.rs 135-136 |
| D6 state 8 deposits a second list | REAL in code, same feature as D4 | CANNOT TELL (list empty unless D4 filled it) | upd.asm 0xbb7901..0xbb7947 | hunt/drop_off.rs 154-159 |
| D7 site that does not take the load -> set_state(0xb) | NOT a difference (claim wrong) | No | upd.asm 0xbb7881..0xbb7888 `je 0xbb7e69` -> set_state(2) | hunt/drop_off.rs 144-148 (doc: set_state 2, errors as unmodelled) |
| D8 next target after the drop, livestock | REAL (three-stage search) | YES: which sheep the villager takes next after a drop-off with no target left | upd.asm 0xbb7aa8..0xbb7c39, 0xd22c20 (h2.c) | hunt/unit.rs 399-545 `hunt_next_search` / `hunt_closest_object` |
| D9 MoveTo has no wait state | REAL | YES when a villager's walk gives up (blocked): timing | 0xb939be..0xb939dd, 0xb933da..0xb93e52, ctor 0xb92150, alloc 0x70 | movement/move_to/mod.rs 96-131, action.rs 410-419; hunt/update.rs 183-192; hunt/drop_off.rs 122-129 |
| D10 MoveTo state 4 with +0x61 == 0 patches the last waypoint | NOT a new difference in kind (engine has `Follow::PathEnd`); details CANNOT TELL | No (hunt sub-MoveTos have +0x61 = 1, 0xbb4df1) | h3.c 0xb93260 state 4 | movement/move_to/mod.rs 505-568 `target_left` |
| D11 computer-only lure block in state 12 | REAL, computer only | No | h1.c case 0xc: `0x1728be0(player) != 0` | hunt/update.rs 53-57 errors for a computer player |
| D12 face returning 0 -> set_state(3) | NOT a silent difference (engine errors) | No (turn time 0 always returns 1) | h1.c case 6; 0x1226330 (h2.c) | hunt/herding.rs `face_animal` |

Extra 1 (the wait): not in MoveTo any more, see D9 notes. Extra 2 (dead animal's obstruction):
removed at death, same as the engine, see the last section.

## Notes per item

### D1 (REAL, narrow)

188329, hunt update state 4, sub-action list code from 0xb8ae30, jump table at 0xbb7f30
(1,2 -> 0xbb67a3; 3 -> 0xbb676e; 4,5 -> 0xbb66f9; 6 -> 0xbb67be):

```
bb66f9: mov rax, [rdi+0x10] ; mov rcx, [rax+0x1f0] ; test rcx, rcx ; je bb6730
bb6709: call 0x140d31a10        ; returns dword [ai+0x18]
bb670e: test eax, eax ; jle bb6730
bb6712: ... call [rax+0x68] (rdx=0)        ; set_target(0)
bb671d: ... mov dl,1 ; call [rax+0x80]     ; set_state(1)
bb6730: xmm2=[0x31b6520], xmm1=[...] ; call 0x140bb2c90 ; test eax,eax ; jne out
bb6750: call [rax+0x68] (0) ; mov dl,0xb ; call [rax+0x80]   ; set_target(0), set_state(11)
```

Engine `hunt/update.rs` 276-297 (`lost_on_the_way`): doc "then the target goes (slot 0x68 with
none) and the hunt walks to its point (`set_state` 11)"; code: `no_tree_search`, `set_target(None)`,
`set_point_walk(WalkSearch)`. No test of the unit AI's queued orders.

Observable: a villager with queued orders whose carcass/animal disappears while it walks to it:
188329 ends the hunt at once (state 1, the unit AI then takes its next order); the engine walks to
the hunt's point and searches. Position and timing.

Change description: in `HuntAction::update_walk` codes 4|5, before `lost_on_the_way`: if the unit
has a unit AI and its queued-order count (the same count `hunt_drop_orders` reads, ai+0x18) is
above 0: `set_target(None)` then `set_state(1)` (hunt done, update returns 0 this tick); else the
present path. Order: the queue test comes before the tree search 0xbb2c90. (What state 1 returns
on the next update for a human, case 1 at the top of 0xbb6230, was not resolved here.)

### D2 (REAL, rare)

188329 state 7, before the work (h1.c):

```
sVar15 = *(short *)(task + 0x26);
if (sVar15 == 0x124) {
  attr = player attribute[0x124];
  if ((attr != _DAT_14369ff64 /*1.0*/) &&
      (*pfVar2 /*target master+0xc0*/ <= _DAT_14322554c && _DAT_14322554c != *pfVar2) /* < -1e-7 */ &&
      (cVar6 = func_0x000141245ff0(target), cVar6 != 0))        /* 0x1245ff0: [obj+0x200] != 0, own master */
    master[+0xc0] ^= _DAT_1431d27e0;                             /* sign bit */
}
```

Engine: `stops_decay_of` (hunt/herding.rs) only flips positive decay when the rule is `Stops`;
it is called on walk arrival and on the Attack's end (hunt/update.rs 137, 242). `gather`
(hunt/gathering.rs 248-304) has no test.

Relevance: the decay is negative only after some hunter with attribute 292 == 1 stopped it. A
player with attribute 292 != 1 gathering that same carcass restarts the decay. In a game where both
players have the same value this never fires. Carried amount / carcass amount would change.

Change description: at the start of each state-7 update (before the work): if task.kind4 is 0x124,
the player's attribute 292 != 1.0, the target's master decay < -1e-7 and the target has a master of
its own: negate that decay.

### D3 (REAL in code; data decides)

188329 state 7 after the unit's gain and the rounding move:

```
if ((*(byte *)(task + 0x15) & 1) != 0) {
  sVar15 = *(short *)(task + 0x24); if (sVar15 < 0) sVar15 = *(short *)(unit + 0x160);
  player->vt[0xf8](player, sVar15, ..., 1);  player->vt[0xb8](player, unit id, sVar15, (int)unit.held);
  ... unit->vt[0x110](...)                   /* the unit's amount is cleared */
  over = |unit.held - capacity|;
}
if ((0.1 <= over) && (0 < target.amount)) break;   /* stays */
set_state(8)
```

Engine: task+0x15 is `combat_level_flag` (`TaskFlags`, genie-model task_flags.rs: only bits 1 and 2
named); `HuntAction::gather` never reads it.
Relevance cannot be decided from the binary: check whether any Hunt task (action 110) of the
villager masters in the replay's data has `combat_level_flag & 1`. If none, no effect.

Change description (only if the data has it): after the gain, pay `unit.held` of resource
task.resource_out (else the unit's carried kind) to the player at once, set the unit's amount to 0,
recompute `over = |0 - capacity|`, then the usual end test.

### D4 + D6 (REAL in code, one feature; needs runtime data)

0x113e4d0 (unit slot 0x110, combat vtable 0x32b71c0 too):

```
*(undefined4 *)(param_1 + 0x40c) = 0;
func_0x00014125bef0();                                   /* plain add/set */
if (param_5 != 0)
  for (e = [obj+0x448]; e != [obj+0x450]; e += 0x10)
    if (e[+4] == param_6 /*target master id*/ || e[+4] == param_7 /*class+900*/ || e[+4] == -1)
      node = func_0x000141136a10(obj + 0x460, ..., e);  node[+0x14] += param_2 * e[+8] * e[+0xc];
```

Deposit, upd.asm:

```
bb7905: call 0x141139090          ; lea rax,[rcx+0x460]
bb790a: mov rsi,[rax+8] ; mov rbx,[rsi]
bb7920: r9 = unit player ; xmm2 = [rbx+0x14] ; edx = unit id ; ecx = [rbx+0x10] ; call 0x140b69000
bb7947: call [unit vt + 0x838]    ; 0x1138ed0, clears the map
```

So the map at unit+0x460 that D4 fills is exactly the list D6 pays out (S1 of gather_map.md is
confirmed). Engine: `update_drop` returns one `Dropped::Load(kind, amount)`; secondary resources
are modelled only through the timed GENERATE task 151 (combat/abilities/mod.rs).
Who fills unit+0x448 was not found (slot 0x830 = 0x1138eb0 clears it; 0x1137260 is a candidate
inserter). Relevance: only for civilisations/technologies that give the villager entries in that
table. The main session can decide by reading unit+0x448/+0x450 of a villager in memory: equal
pointers = no effect. Observable if non-empty: stockpile of a second resource at each drop-off.

### D5 (REAL in code; needs runtime data)

0x11393d0: `rate = master[+0x238] + vt[0x748]()` then, if the per-unit map (unit+0x300..0x328)
has key 0xd, every 12-byte entry is applied by 0x1414c2950. Engine: `work_rate_powerup +
master.work_rate` (hunt/hunter_strike.rs 135). Relevance only if the unit carries such modifiers
(aura-like effects). Observable: carried amount per tick.

### D7 (NOT a difference; the earlier claim was wrong)

```
bb7881: call 0x1410ba220 ; test al,al ; je 0x140bb7e69
bb7e69: mov dl,2 ; call [rax+0x80]                     ; set_state(2)
```

The `set_state(0xb) when the point is set` test (0xbb7e49) is the "nothing found after the drop"
exit, reached from 0xbb799f, 0xbb7a59 and 0xbb7cfb, not from the site test. Engine doc
(drop_off.rs 96, 144-148) says set_state 2 and stops with an error; same thing.

Also confirmed equal: codes 3, 4 and 5 in state 8 all give the -3.0 s wait (0xbb77ef..0xbb7804 ->
0xbb678e), gap2 > 1.0 gives it too (0xbb789f `comiss xmm0,[1.0]; ja bb6792`).

### D8 (REAL and relevant for sheep)

188329, hunt state 8 after the load went, no target, human player (upd.asm 0xbb799c..0xbb7d01).
Common part equals the engine: 0xd38c00 drops orders on gone targets; count > 0 -> 0xd40990,
0xd40980, set_state(1); class = ai target class (0xd25d50) else hunt+0x68; ai slot 0x1b0; hunt
class 10 searches nothing; pasture id unit+0x2d4.
New for class 0x3a (livestock), `cmp ebx,0x3a` at 0xbb7aa8:

```
bb7ab1: [rbp-0x10] = -1
bb7ab8: [rsp+0x48] = hunt+0x28 (drop site object) ; [rsp+0x40] = -1 ; [rsp+0x38] = 1
        [rsp+0x30] = &[rbp-0x10] ; [rsp+0x28] = -1 ; [rsp+0x20] = -1
bb7ae7: edx = 0x3a ; r9d = 5 ; r8d = -1 ; call 0x140d22c20          ; search 1
bb7afd: r14 = id ; xmm8 = 0x124d8d0(unit, object(id))
bb7b29: xmm7 = max(unit vt[0x228](), unit vt[0x2e0]())               ; 0x1245c70 line of sight, master+0x234
bb7b43: id == -1 -> search 2
bb7b49: comiss xmm8,xmm7 ; jb bb7ba3        ; gap < R: keep
bb7b4f: eax = 2*[rbp-0x10] ; comiss (float)eax, xmm7 ; jb bb7ba3    ; 2*d < R: keep
bb7b60: same call with [rsp+0x48] = 0, [rsp+0x30] = 0, r9d = 5      ; search 2
bb7ba3: xmm0 = 0x124d8d0(unit, object(r14)) ; id == -1 -> search 3 ; comiss xmm0,xmm7 ; jb bb7c3c
bb7bcd: [rsp+0x48] = hunt+0x28, [rsp+0x30] = 0, [rsp+0x28] = -1, r9d = -1, r8d = -1, [rsp+0x20] = -1 ; call  ; search 3
```

0x140d22c20(ai, class, relation, state, master, workers, int* best_out, reach, skip_list, from_obj)
(h2.c): `state != -1` keeps only objects whose state byte equals it; with `from_obj` the candidate's
distance is `0x124d8d0(from_obj, candidate)` instead of the stored one, and for a distance of 0 a
second key (a software sqrt, arguments not recovered) breaks ties; equal keys take the lower id;
`*best_out = (int)best distance`.
For other classes one call: workers 1 for class 0x31, else -1, state -1, no from_obj (0xbb7bf7).

Engine `hunt/unit.rs` `hunt_next_search` -> `hunt_closest_object`: one search,
`Pick::Closest { group: class, relation: None, state: None, master: None, workers: .., reach: true }`
with `at: self.position()`. Doc: "any other class `ClosestObject`". No livestock case, no state 5
pass, no measuring from the drop site.

Observable: which animal the villager walks to after the drop-off that follows an exhausted
sheep (positions, then everything after).

Change description, `Unit::hunt_next_search`, class of no kind and equal to livestock (58), no
pasture, hunt class not 10. With `R = max(line of sight as slot 0x228 gives it, master search
radius +0x234)` and `site` = the hunt's second target (still set at this point):
1. `(a, d) = closest(class 58, any relation, state == 5, any master, no worker cap, reach test,
   measured from site)`, `d` = best distance truncated to int (-1 when none).
2. If `a` is none, or neither `gap(unit, a) < R` nor `(float)(2*d) < R`:
   `a = closest(class 58, any relation, state == 5, reach test, measured from the unit)`.
3. If `a` is none, or not `gap(unit, a) < R` (gap = 0x124d8d0 footprint gap, recomputed):
   `a = closest(class 58, any relation, any state, reach test, measured from site)`.
4. Then as before (master 0x769/0x765 pasture hook, none -> set_state 11 with a point, else 2).
"Measured from site" replaces the candidate's distance by the footprint gap between the drop
site and the candidate; candidates touching the site (gap 0) are ordered by a second distance
(not recovered: read 0xd239xx before coding), ties by lower id.

### D9 (REAL) and extra question 1

188329 MoveTo update 0xb93260:

```
b933da: sub ecx,1 ; je 0x140b93e4a          ; state 2
b93e4a: mov dl,3 ; call [rax+0x80]           ; set_state(3) at once, returns 0
b939c5: call [rax+0x658]                     ; the unit's walk
b939cb: cmp al,1 ; jne b939e4
b939cf: mov dl,0xd ; call [rax+0x80]         ; set_state(13), returns 0 (b939dd xor al,al)
b939e4: cmp al,2 ; jne out ; set_state(1) ; call 0x14120d940
b933fe: state 13: notify 0x1f9 unless quiet ; b9342f: mov al,3
```

The object is allocated with 0x70 bytes (`func_0x000142d6dc48(0x70)` before every 0xb92150 /
0xb920a0 call in 0xbb4a80), so the old timer fields +0x70/+0x74 do not exist. Constructor 0xb92150:
`*(undefined1 *)(param_1 + 0x6c) = param_7;` and the update uses it only to pick the sprite
(`vt[0x890]` unless `+0x6c != 0`, then `vt[0x888]`). No function sets MoveTo state 2 in the code
read. set_state 0xb931b0 for 13 with a quiet MoveTo only stamps unit+0x40c with the world time
when it is 0 (slot 0x638 = 0x113b580 reads it; 0x113e4d0 clears it): an "idle since" stamp, not a
wait.

Engine: `Patience::WaitsOnce` (movement/move_to/mod.rs 96-131: wait 1 s, 2 s for stance >= 2,
`+0x6c` 0 -> 1 -> 2), `MoveTo::Waiting` (action.rs 413-419), used by hunt/update.rs 183-192 and
hunt/drop_off.rs 122-129 for a human player's villager.

Where the wait is in 188329: nowhere at MoveTo level. What remains is the owner's reaction to
code 3, which the engine already has: hunt state 4 -> 0xbb2c90 then timer -3.0 and animation stop
(0xbb678e), after it set_state(0xb); hunt state 8 -> timer -3.0, after it 0xb6b9b0(0) and
set_state(8). SUSPECTED (not read): the human/computer flag that the walk 0x1210f60 passes to
0x141057a40 at three sites (`iVar10 == 0` as a byte argument) may carry a human-only retry inside
the walk; that is the main session's area.

Observable: when the walk gives up, the engine waits 1 s and asks for a path again before failing;
188329 fails on the same update and the hunt waits 3 s. Timing in ticks, then positions.

Change description for build 188329: `MoveWait::give_up` always returns `MoveTo::Failed`
(`Patience` unused); a MoveTo in state 2 (should it exist in a save) turns to state 3 on its next
update without a timer; `+0x6c` is a constructor byte (1 for the hunt's MoveTos to objects), not a
wait state. Nothing else in the hunt changes: code 3 handling stays.

### D10 (not a new difference)

188329 state 4, target more than 0.5 off on an axis, `+0x61 == 0`: when the path's last waypoint is
the walk's goal it calls 0x14111f580, 0x14111d8e0, 0x14111d0c0 (flag 0x40) and 0x141121280; a clear
line moves the last waypoint to the target (0x141075e10) and the point follows, else notify 0x1fc
and set_state(3). Engine `target_left` (move_to/mod.rs 505-568) has the same structure
(`walks_to_path_end`, `segment_blocked`, `Follow::PathEnd`, else `Follow::Blocked`). The line-test
flag (0x100 in the engine's doc, 0x40 here) and the extra waypoint writes (0x141075b80 twice) were
not compared: CANNOT TELL at that level. Hunt and drop-off MoveTos set `+0x61 = 1`
(`bb4df1: mov byte ptr [r14+0x61], 1`), so this never runs for them.

### D11, D12

D11: `if (unit != 0 && 0x1728be0(player) != 0 && target != 0) { ... }` computer only; the engine
refuses a computer player's hunt. D12: 0x1226330 returns 0 only when master turn time
(`master+0x1f8`) is non-zero and the turn is not finished; the engine returns an "unsupported"
error in that case (`face_animal`), so a run would stop, not diverge silently.

## Extra question 2: obstruction of a dying animal / carcass

The task's hint function 0x141120a10(DAT_144357fe0, id) is only the removal of a temporary entry
by id from the box tree; it is called 19 times in the walk 0x1210f60 and by 0x12065f0 (clears the
ids the walk added through 0x120ca10). It is not the death path.

Death path: combat object set_state **0x12d29c0** (vtable 0x32b71c0 slot 0xa8; it ends in
0x1142a10 -> base 0x125c2d0). `setstate_combat.txt` lines 208-237:

```
/* new state > 2 and old state < 3 */
if (*(char *)(obj + 0x1c6) == '\0') {
  if ((*(byte *)(obj + 0xf) < 0x50) || (func_0x00014127c8c0(obj) != 0))
    FUN_141120bf0(_DAT_144357fe0, obj);          /* asm 12d3533..12d353a */
  if (0x45 < *(byte *)(obj + 0xf)) {
    FUN_141243cd0(obj);                           /* master of its own */
    *(undefined4 *)(master + 0x80) = 0;           /* -0x4ef290fb1bb31bd6 */
  }
  ...
  *(undefined1 *)(obj + 0x1c6) = 1;
}
```

0x1120bf0 (s1.c) removes the object's box-tree entry (`obj+0x194`, 0x10b9370) and its shape
(`obj+0x1a0`, set to 0). The add wrapper 0x1249f90 refuses `state >= 7`, `obj+0x1c6 == 1` and
`master+0x80 <= 0`, so nothing puts the shape back; the remove wrapper 0x1246bc0 is called from
the map unlink 0x1266947, the destroy 0x1255560 and the destructor 0x122e570.
Condition in one line: on the first set_state to 3 or more from below 3, with `obj+0x1c6 == 0`,
every non-building combat object loses its obstruction for good. A dying animal and a carcass have
no obstruction shape. This matches the engine (`objects/lifecycle/death_parts.rs` `combat_dies`:
`pathing.removed`, `spatial.drop_record`, `set_tall(false)`, `ROO_CALLED`). No change needed.
