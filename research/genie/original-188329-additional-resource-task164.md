# Danes "extra food" bonus (replay 519686090, P1) = task type 164 "AdditionalResource" + per-unit secondary-resource map

Build 188329. RVAs in `AoE2DE_s_unpacked.exe`. Engine paths relative to `genie/crates/engine/genie-core/src/`.
Data: `aoe2-data/188329/empires2_x2_p1.dat` (parsed with genieutils-py in the cloud container, not copied anywhere else),
game scripts `resources/_common/xs/Effects.xs` + `Constants.xs` of the installed game (file date = data date, read only).

## 0. Result in one paragraph

Danes = civilization 62 (tech tree effect 1460, team bonus effect 1457). The only Danes effect that changes resources
before 400 s is tech 1494 "C-Bonus, Villagers & Fishing Ships +10% food" (civ 62, no requirement, no location: applied at
start) -> effect 1494 = two commands: `type 1 (player attribute), attribute 299, mode 1 (add), 5.01` and
`type 1, attribute 33, mode 0 (set), 35`. Attribute 33 > 0 runs the script `EffectFunction35` (Effects.xs), which adds a
task of **type 164 (cTaskTypeAdditionalResource)** with work_val1 = 0.01, productivity attribute = 299
(cAttributeExtraFoodProductivity), resource out = 0 (food), no class / no unit (key -1 = any target) to the masters
214, 259 (farmers), 56, 57 (fishermen), 120, 354 (foragers), 122, 216 (hunters), 590, 592 (shepherds), 1891, 1892 (herders), 13 (fishing ship).
The original keeps, per unit, a table built from those tasks and a map "extra resource -> amount": every gain of the
carried load adds `(gain * 0.01) * 5.01` to the map entry "food"; the drop-off deposits the load and then every map
entry, then clears the map. So a 10.0 load gives 10.0 + 0.501 food. The engine has neither the table nor the map and
skips type 164 silently. Attribute 299 itself is never read by native code by number (no constant 299 / 0x958 use in
`.text`); it is reached only through the task's field `+0x22`.

## 1. Address table

| Role | RVA | Engine |
|---|---|---|
| Table entry from a type-164 task (unit, task) | 0x12b71f0 | none |
| Unit setup that walks the master's tasks (`task+0xe`: 3, 6, 155, 158, **164** -> 0x12b71f0) | 0x12bafe0 (call at 0x12bb115) | none for 164 |
| Unit refresh: clear table (slot 0x830) + refill from master tasks of type 164 | 0x12ddd00 (clear 0x12ddd71, loop 0x12dde13..0x12dde41) | none |
| Table push / clear (unit slots 0x828 / 0x830; vector at obj+0x448..0x450, 16-byte entries) | 0x1138e00 / 0x1138eb0 | none |
| Unit gain (slot 0x110): plain add 0x125bef0, then table walk when flag = 1 | 0x113e4d0 (walk 0x113e523..0x113e589) | `gathering/hunt/gathering.rs:283` `gather` (`*held += gain`, `*held += over`); Gather: `gathering/gather/work.rs` `gather()` |
| Map find-or-insert (unordered map at obj+0x460, key = resource id, value float at node+0x14) | 0x1136a10 | none |
| Hunt (type 110, shepherds/hunters) per-tick gain calls: amount xmm7, flag 1, keys = target master id, class+900 | 0xbb75a1; top-up call after 0xbb7607 | same two adds |
| Hunt drop-off: deposit load, then every map node, then clear (slot 0x838) | 0xbb78eb, 0xbb7933, 0xbb7947 | `gathering/hunt/hunter.rs:287` `c.give_load(kind, amount)` only |
| Gather (type 5) drop-off, same shape | 0xb81e77, 0xb81ec3, 0xb81edc | `gathering/gather/unit.rs:303` only |
| Deposit (resource, unit id, amount, player) -> player slot 0xf8 with (1,1) | 0xb69000 | `gather/unit.rs:497` `give_load` |
| Map clear when the carried kind changes (set_state) | Gather 0xb7f905 (fn 0xb7e500), Hunt 0xbb5d03 (fn 0xbb4a80) | none |
| Other drop-offs with the same deposit + node loop + clear (action not identified) | 0xb77b56/0xb77ba3/0xb77bb7, 0xb9f47c/0xb9f4c3/0xb9f4d7, 0xba2eb2/0xba2ef3/0xba2f07 | not compared |
| Player attribute set: 0x21 (33) above 0 calls the script | engine doc `technology/effect/resources.rs:105` | `resources.rs:130` returns unsupported (never reached here: the bonus is applied before the recording's start state) |

## 2. Original logic (CONFIRMED unless marked)

1. Start: tech 1494 -> attribute 299 += 5.01; attribute 33 = 35 -> `EffectFunction35(player)` (Effects.xs l.903):
   it sets the task amounts work value 1 = 0.01, productivity resource = 299, resource out = 0 and adds a task of type 164
   (no target unit) to the 13 masters above. (Script text read on the PC, not copied; the script engine itself not read.)
2. 0x12b71f0 (unit, task), for each master task with `task+0xe == 164`, pushes a 16-byte entry:
   `+0 = (int) task+0x24` (resource out), `+4 = key`: `task+0x10` (class) + 900, or `task+0x12` (unit id) when the class is -1
   (so -1 when both are -1), `+8 = task+0x28` (work_val1, float), `+0xc = player attribute[task+0x22]` **as it is at that moment** (float).
   Called from the unit setup 0x12bafe0 and from the refresh 0x12ddd00 (which first clears the table).
3. Every gain of the load goes through unit slot 0x110 = 0x113e4d0(unit, amount, flag, key1, key2):
   plain add (0x125bef0); then if flag != 0, for each table entry whose key == key1 (target master id) or == key2 (target class + 900) or == -1:
   `node(entry.resource).amount = ((amount * entry.a) * entry.b) + node.amount` (mulss, mulss, addss, all float32; 0x113e554..0x113e57d).
   Hunt calls it at 0xbb75a1 with the tick's gain and again for the small top-up; both with flag 1.
4. Drop-off (Hunt 0xbb78eb.., Gather 0xb81e77..): `deposit(kind, unit id, unit.held, player)`; held = 0 (0x125bee0);
   `for node in map: deposit(node.resource, unit id, node.amount, player)`; then slot 0x838 clears the map.
   The deposit is the usual one (player slot 0xf8 with 1,1: resource + its "gathered" counter).
5. The map is also cleared when the unit's carried kind is replaced (Gather set_state 0xb7f905, Hunt set_state 0xbb5d03) - the extra is lost with the load.
6. Hunt's "deposit at once" branch (task flag bit 0) gives only the load, not the map (h1.c l.321-336).

## 3. Confirmed difference + implementation note

D1. Engine has no table and no map: `grep` for 164 / 0xa4 / AdditionalResource in genie-core, genie-import, genie-model finds nothing
(only attribute 164 "units value"); `combat/abilities/mod.rs:165` acts on task types 151, 152, 159, 161 only; drop-offs call
`give_load(kind, amount)` once (`hunt/hunter.rs:287`, `gather/unit.rs:303`). Original: steps 2-5 above.

Implementation (data driven, a no-op for masters without a type-164 task, so no switch is needed; if an A/B switch is wanted use `GENIE_EXPERIMENT_CIVRES_188329`):
- `Unit` (or its life part): `extra: Vec<(AttributeId, Amount)>` (the map; keep insertion order, one slot per resource).
- New `fn add_extra(unit, master_tasks, player_attrs, gain: Amount, target_master: MasterId, target_class: ClassId)`:
  ```
  for t in master.tasks where t.kind == ActionKind::named(0xa4) {
      let key = if t.class != -1 { t.class + 900 } else { t.unit };          // i32
      if key == target_master || key == target_class + 900 || key == -1 {
          let b = player.attributes[t.attribute_type2 /* +0x22 */];           // f32
          slot(t.attribute_type3 /* +0x24 */) = (gain * t.work_val1) * b + slot;   // f32, this order
      }
  }
  ```
  Call it right after each `*held += ...` in `gathering/hunt/gathering.rs` `Hunt::gather` (both adds: `gain`, `over`) and after the
  per-tick add in `gathering/gather/work.rs` `gather()` (the engine's counterpart of slot 0x110 with flag 1).
- Drop-off: after `c.give_load(kind, amount)?` in `hunt/hunter.rs:287` and `gather/unit.rs:303`:
  `for (k, v) in unit.extra.drain(..) { c.give_load(k, v)?; }`.
- Clear `unit.extra` where the engine resets the load because the kind changes (Gather set_state / Hunt set_state counterparts of 0xb7f905 / 0xbb5d03).
- Precondition to check once (not verified by me): the recording's saved masters must carry the type-164 task
  (`genie-import/src/save.rs:269` takes the saved task list; `combat/abilities/mod.rs` doc says the save holds the tasks the bonuses add).
  Print the tasks of P1 master 592 in 519686090: expect kind 164, class -1, unit -1, attribute_type2 299, attribute_type3 0, work_val1 0.01.
  If the save does not hold it, add it at import from the table in section 6.

## 4. Check against the recording (`verify.py`, engine trace `N_t2_090.err`)

Extra food = sum over engine food deposits of f32((d * 0.01) * 5.01); predicted word 1 = trunc(food + extra) + trunc(wood) + trunc(stone) + trunc(gold):

| checkpoint | drops | extra | recording | engine | predicted |
|---|---|---|---|---|---|
| 99.853 s | 5 | 2.5050 | 502 | 500 | 502 |
| 106.353 s | 6 | 3.0060 | 513 | 510 | 513 |
| 112.853, 119.353 s | 6 | 3.0060 | 513 | 510 | 513 |
| 125.853 s | 7 | 3.5070 | 523 | 520 | 523 |
| 132.353 s | 14 (one of 6.39) | 6.8329 | 593 | 586 | 593 |

All 6 checkpoints after the first drop-off match (the 0.01 in 5.01 is what makes 6 drops reach 3). The check adds per load; the
original adds per gain call, which differs only in the last float bits.

## 5. Suspected / not read

- SUSPECTED: `b` is frozen in the table at setup/refresh; when 0x12ddd00 runs (after a master change by a tech?) was not traced.
  Reading the attribute at gain time is identical for Danes (299 is set once, before any unit exists); it may differ for a civ whose
  attribute changes mid-game (Malians 276, Shu/Athenians 502, Burgundian/Vietnamese techs) until the refresh.
- Not read: the XS runtime (`xsTask`, how leftover `xsTaskAmount` values carry over: EffectFunction35 does not reset first, EffectFunction34 does not reset last);
  the three other drop-off sites (0xb77ab4, 0xb9f439, 0xba1b10); whether trade / fishing-ship actions gain through slot 0x110 with flag 1;
  158041 itself.
- Danes effects that do NOT matter before 400 s: 1485 (attribute 291 = 250 and attribute 33 = 36: razing bounty, task type 161 on buildings),
  1486 (speed x1.1 of units 2703, 2704, 250, 533), 1492 (gold cost of 11 upgrades), team bonus 1457 (attributes 1 and 23 +2 for siege classes),
  tech tree 1460 (disables, 8 enables). Hamask (tech 1484, EffectFunction30, task type 160) is researched in the Castle Age.

## 6. All civilizations: what the engine skips silently (ranked by how early it matters)

A. Task type 164 "AdditionalResource" added by a start bonus (same mechanism, same fix; value = 0.01 x attribute, per gain):

| civ | tech / effect | script fn | masters | attribute -> resource | first effect |
|---|---|---|---|---|---|
| Danes (62) | 1494 | 35 | all food gatherers + fishing ship | 299 (5.01) -> food | first food drop (~95 s) |
| Varangians (61) | 1475 | 34 | hunters, shepherds, fishermen 0.01; fishing boat class 0.005 | 298 (10.01) -> gold | first sheep drop (~95 s) |
| Shu (49), Athenians (47) | 1071, 1116 | 16 | lumberjacks 123, 218 | 502 (7 / 15) -> food | first wood drop (~1-2 min) |
| Portuguese (24) | 453 | 12 | foragers 120, 354 | 267 (33.33) -> wood | first berry drop (~2-3 min) |
| Mapuche (58) | 1381 | 29 | foragers | 215 -> food | first berry drop |
| Malians (26) | 594 | 11 | gold miners 579, 581, oysterers | 276 (10) -> gold | first gold drop (~5-8 min) |
| Poles (38) | 805 | 13 | stone miners 124, 220 | 241 -> gold | first stone drop |

B. Other script-added or data tasks with no ActionKind in the engine (SUSPECTED ignored; only the absence of the constant was checked):
155 Aura (1603 tasks in the data file itself; scripts 7, 8, 28, 31, 1002, 1004: work-rate and healing auras, e.g. Thracian tower work rate at start, mule cart),
157 Stinger (scripts 3, 25, 32), 156 ExtraSpawn, 158 HPTransform, 164. Engine constants exist for 151, 152, 153, 154, 159, 160, 161.

C. Start bonuses that run a script and are baked into the start state (not re-run by the engine): fn 1 (Inca llama), 2 (Dark Age), 9 (Georgians church),
26 (Mapuche cavalry gold, type 154), 27 (Tupi refund, 161), 28 (Muisca settlement), 36 (Danes pillage, 161), 38/39 (Saxons castle/TC), 50 (Khmer farmers),
1004 (Thracians). Correct only as far as the saved masters hold the tasks and the engine implements the task type.

D. Researched techs that set attribute 33 stop the engine loudly (`resources.rs:130`), not silently: 3, 4, 6, 7, 8, 10, 14, 15, 25, 30, 31, 51-56, 1000, 1003.

## 7. Other situations the change affects

Any civ in table A (their word 1 goes wrong at the first matching drop-off today); units that change master (villager retask keeps the map only
while the carried kind is the same); no effect on civs without type-164 tasks (all 3 research replays: unchanged).

## 8. Implementer's check and what went in (session M3, 2026-11-13; finding 51)

- Re-read in disassembly: 0x113e4d0 (plain add 0x125bef0, then for each 16-byte entry at `+0x448..+0x450` whose key is arg 4, arg 5 or -1:
  `mulss [entry+8]`, `mulss [entry+0xc]`, find-or-insert 0x1136a10, `addss [node+0x14]`, store); 0x12b71f0 (key = class + 0x384, or the
  unit id when the class is -1; resource `+0x24`; `work_val1` `+0x28`; the player's attribute `+0x22` read through the masked table);
  Hunt gain calls 0xbb75a1 and 0xbb762a (both flag 1, keys = target master, target class + 900; the target's own loss at 0xbb7607 has flag 0);
  Gather gain calls 0xb81877 and 0xb8190b (same shape, 0xb818e3 is the target's loss); Hunt drop-off 0xbb78eb / 0xbb7933 / 0xbb7947;
  Gather drop-off 0xb81e77 / 0xb81ec3 / 0xb81edc; the clear at 0xbb5d03 and 0xb7f905 runs only when the kind differs **and** the two kinds are not both food
  (the same branch that zeroes the load).
- The recording's saved masters **do** carry the tasks: 519686090 P1 (civ 62) has one type-164 task (class none, unit none, `+0x22` = 299,
  `+0x24` = 0, work_val1 0.01) on each of the 13 masters 13, 56, 57, 120, 122, 214, 216, 259, 354, 590, 592, 1891, 1892
  (engine trace `GENIE_TRACE_TASK164=1`, run `M3_t1_090`). So nothing is added at import and no table of civilizations is needed.
- Two of the "other drop-offs" identified and wired too: 0xb77b56 / 0xb77ba3 / 0xb77bb7 (fn 0xb779e0) is the **Enter** action's drop into a
  building (kinds 15 to 17 -> food, 0 to 3 and 56 their own; engine `garrison/unit.rs` `enter_building`), 0xb9f47c / 0xb9f4c3 / 0xb9f4d7
  (fn 0xb9f410, next to the destructor that lowers the builder count `+0x670`) is the **Build** action's drop (engine
  `construction/build/states.rs` `drop_load`). 0xba2eb2 (fn 0xba1b10, same vtable as 0xb9f3b0) was not read.
  The Enter case is what 519686090 needs at 245.5 s (eight shepherds sent into the Town Center with 1 to 2.4 food each).
- Engine: `gathering/extra.rs` (`ExtraRules::of`, `ExtraRules::gain`), `Unit::extra`, `HuntReads::extras`, `GatherReads::extras`; the factor
  `b` is read from the player's attributes when the update starts, not frozen at the unit's setup (section 5, first item: still open).
