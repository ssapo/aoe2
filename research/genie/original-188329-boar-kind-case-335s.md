# Case P6 (replay 518239882, 335.1 s): the hunter's next target after its drop-off

Read-only. Nothing built, run or edited. Original = `AoE2DE_s_unpacked.exe` (188329), disassembly with
`dz.py` unless a decompile file is named. Engine = `genie-core/src`, read on the PC.
New disassembly: `out_p6/d1bfa0.asm`. No new Ghidra run was needed (`proj_p6` not created).

## 0. Result in one paragraph

The villager's target before the drop-off was the dead boar 4018 (master 48, class 10), not 4397: 4018 lay
at (84.2767, 70.3254) with 3.9 food at 328.2 s, ran out at about 332.9 s (the villager's load jumps
11.80 -> 12.30) and was replaced by 4397 (master 356, class 11, a decay object). After the deposit the
Hunt has no target; its class (`[ai+0x4c]`, else hunt `+0x68`) is 10. In 188329 the villager AI's slot
0x1b0 maps class 10 to kind 5, so the Hunt calls the search by kind (slot 0x80 = 0xd23bf0) with kind 5,
and that search's per-tile test has a special rule for kind 5: an object of **class 10 in state > 2 with
amount > 0** (a dead boar with food). The only such object in reach is 4017 (master 48, state 5, 229 food)
at (86.04355, 69.90919): it becomes the target (Hunt slot 0x48, `set_state(4)`). The engine has no kind
for class 10 and "a hunt of class 10 searches nothing" -> state 11 -> walk to the old point -> done.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Hunt update, state 8 after the deposit, human, no target | 0xbb7971..0xbb7e77 | `gathering/hunt/unit.rs` `hunt_after_drop` (231-254), `hunt_next_search` (405-486) |
| AI target class getter (`[ai+0x4c]`) | 0xd25d50 | `ai.target_class` |
| Villager AI vtable | 0x3245908 | - |
| Villager AI slot 0x1b0: class -> kind | 0xcf9c60 (byte table 0xcf9cb8, jump table 0xcf9c9c) | `unit_ai/cared.rs` `civilian_kind` (73-96) |
| Villager AI slot 0x80: search by kind (wrapper) | 0xd23bf0 | `gathering/closest_resource.rs` `closest_resource_of` (67), `Unit::resource_search` (303) |
| Search core (tile flood) | 0xd19f60 | `gathering/gather_search.rs` `closest_resource_at` (432-529) |
| Per-tile candidate test | 0xd1bfa0 | `gathering/gather_search/passes.rs` `first_resource` (176-193) |
| "targetable" byte getter (`[obj+0x1c9]`) | 0x1245f60 | `Candidate::untargetable` |
| Hunt slot 0x48 (retarget; R2 section 2.3) | via `[hunt vtable+0x48]` at 0xbb7d58 | `gathering/hunt/unit/found.rs` `hunt_take_found` (34) |
| Villager AI notify 0x202 handler (also calls slot 0x1b0 / 0x80) | 0xd004a0 (`out_r2/r2.c` 146-272) | `unit_ai/update.rs` `hunter_search` (396-), second user at 510 |

Masters (class read from `data/empires2_x2_p1.dat`, "VER 8.9", class = int16 at offset 11 of the unit
record after type byte and id): 48 = type 70, **class 10**; 2340 = type 70, class 9; 356 = type 30,
class 11; 1611 = type 30, class 11 (65 = class 9, 122 = class 4 as cross-checks).

## 2. The original's logic, in execution order

State 8 of the Hunt update, after the load was deposited and the hunt has no target.

1. 0xbb7971: `0x1728be0(player) != 0` (computer) -> other branch (0xbb671d). Human continues.
2. 0xbb798d: `ai = [unit+0x1f0]`; null -> step 9. `xmm6 = -1.0` (constant at 0x31b6520 read: -1.0).
3. 0xbb79a8 `0xd38c00(ai)` (prune queued orders); 0xbb79b0 `0xd31a10(ai)`; `> 0` (`test eax,eax; jle`)
   -> `0xd40990(ai,-1,1)`, `0xd40980(ai,-1)`, `set_state(1)`, return 1.
4. 0xbb79ee: `class = 0xd25d50(ai)` = `[ai+0x4c]`; `== -1` -> `class = [hunt+0x68]` (0xbb79fa).
5. 0xbb7a05: `k = ai.slot0x1b0(class)` = 0xcf9c60: `class-5 > 0x3a` -> 0xff; else table: 5, 31, 33 -> 2;
   7 -> 1; 8 -> 3; **10 -> 5** (byte table index 5 = 3 -> 0xcf9c95 `mov al,5`); 15 -> 0; 32, 63 -> 4;
   all others -> 0xff.
6. 0xbb7a0d `cmp al,0xff; je 0xbb7a55`. So for `k != 0xff` (0xbb7a11..0xbb7a4d):
   `found = ai.slot0x80(k, -1, (k == 0 ? 2 : -1), out = null, 2, -1.0, -1.0)`
   (`r8d = -1`; `r9d = -1`, `cmove r9d, 2` on `test al,al`; `[rsp+0x20] = 0`; `[rsp+0x28] = 2`;
   `[rsp+0x30] = [rsp+0x38] = -1.0`). Slot 0x80 of vtable 0x3245908 = 0x140d23bf0.
   **The test `[hunt+0x68] == 10` (0xbb7a55, "class 10 finds nothing") is only on the `k == 0xff`
   path**, so with class 10 -> kind 5 it is never reached for class 10.
7. 0xd23bf0 with no site and point (-1, -1) (R3 report 2.5 and its verify, both from disassembly; not
   re-read here): unit state < 2 -> -1; the worker argument is unused; origin = the unit's tile; one
   core call 0xd19f60 with seed = origin tile, `n = (int)unit.slot0x228() + 5`, 30 tests, FIFO flood,
   each neighbour tile `t` of a popped passable cell: inside the box, distance `d <= n`, explored, then
   `obj = 0xd1bfa0(unit, k, t)`.
8. 0xd1bfa0 (read whole, `out_p6/d1bfa0.asm`): for `i in 0 .. tile[+0x1b]` over `tile[+0x28][i]`,
   first object that passes all of:
   a. not null; `[obj+0x2d0] != -1` (in a pasture) or `[obj+0x1c9] != 0` (0xd1c011..0xd1c024);
   b. if the unit has a pasture (`[unit+0x2d4] != -1`) and the pasture limit holds, the object must be
      in that pasture (0xd1c02a..0xd1c0f2; not relevant here, the villager has none);
   c. kind 5 only (0xd1c0f8 `cmp r15b,5`): master class (`low16([master+0x38] ^ 0x1eda00de77dd3b77 ^
      0xe603cb00f5512cb7)`) `== 10` and `[obj+0x188] > 2` (`cmp byte,2; jbe` fails) and
      `[obj+0x168] > 0.0` (`comiss; ja`) -> **found**;
   d. otherwise (any kind, also kind 5 when c fails): `[master+0x121] == 1` and
      `[master+0x123] == k` and `[obj+0x168] > 0.0` -> found.
   Nothing passes -> returns 0 (0xd1c20a `xor eax,eax`).
   The core then scores it (R3 2.5 step 3e: `score = (id == [ai+0x48]) - [obj+0x18c] + free slots`;
   `score > 0` and reached -> answer; else fallback by `steps - score` when reachable).
9. Back in the Hunt, 0xbb7cf4: `found == -1` -> 0xbb7e49: point x == -1.0 or point y == -1.0 ->
   `set_state(2)`, else `set_state(11)` (0xbb66c1); return 0.
10. Found: object by id (null -> return 0); 0xbb7d55: Hunt slot 0x48 (retarget) with
    `(obj, obj.x, obj.y, obj.z)` -> set_target and `set_state(4)` (R2 section 2.3); return 0.

Check against the facts (truth rows 334952 and 335176): unit at (84.719, 70.342) = tile (84, 70).
3827 (master 2340, class 9, tile (83,71)): fails 8c (class) -> not a candidate. 4397 (master 356,
class 11, tile (84,70)): fails 8c. 4389 / 4391 (master 1611, class 11): fail 8c. 4017 (master 48,
class 10, state 5, amount 229.4 > 0, tile (86,69)): passes 8c; tile distance from (84,70) is
`(int)(1*1.4+0.61) - 1 + 2 = 3 <= n`. It is the only kind-5 candidate, so whichever way it is taken
(direct or fallback) it is the answer. The truth then walks to (86.062, 69.111), 0.80 north of
(86.04355, 69.90919), and gathers. The rule picks 4017 and neither 3827 nor 4397.
Timing: the engine's deposit update is 14718 (335120 ms) and its first step is in update 14720; the
truth's first sample after (335176 ms = update 14720) has moved exactly one step (0.0224), so the
found-path costs the same number of updates as the engine's state-11 start; only the goal differs.

## 3. Confirmed differences from the engine's default behaviour

### P6-1. Class 10 has a kind (5) in the villager's slot 0x1b0 (R2's N1, now with its effect)
- Original: step 5 (0xcf9c60, table read byte by byte).
- Engine: `unit_ai/cared.rs:73-96` `civilian_kind`: wood, forage, fish, stone, gold; `None` for class 10.
  `GatherGroup` (`genie-model/src/objects/masters/gather_group.rs:20-33`) has constants 0..4 only.
- Switch coverage: none (`GENIE_EXPERIMENT_HUNT_188329` covers only the class-58 passes at
  `hunt/unit.rs:434` and the snap at `hunt/gathering.rs:181`).

### P6-2. After the deposit a class-10 hunt searches by kind 5 instead of finding nothing
- Original: step 6; the `+0x68 == 10` exit is only behind `k == 0xff` (0xbb7a0d, 0xbb7a55).
- Engine: `hunt/unit.rs:426-432`: `kind == None` and the hunt's class has `ClassRoles::PREDATOR` ->
  `None` (found nothing) -> `hunt_found_nothing` -> `search_walk` (state 11); the trace shows state 11
  at update 14718 and state 2 at 14740.
- Switch coverage: none.

### P6-3. The per-tile test has a kind-5 rule: dead class-10 object with food
- Original: step 8c (0xd1c0f8..0xd1c180), tried before the general rule 8d.
- Engine: `gather_search/passes.rs:176-193` `first_resource`: only
  `open && auto_gather && gather_group == kind && amount > 0`; no class / state rule.
- Switch coverage: none.

### Implementation note (all three under `GENIE_EXPERIMENT_HUNT_188329`, in the original's order)
1. `GatherGroup`: add a constant for 5 (e.g. `DEAD_PREDATOR = Self(5)`); check every table indexed by
   group (`orders/start_work.rs:51 GROUPS`, the "place in a table by group") so 5 is not used as an index.
2. `civilian_kind`: with the switch, a class with `ClassRoles::PREDATOR` (class 10) -> `Some(5)`, tested
   like the others (the classes are disjoint, order is irrelevant).
3. `hunt_next_search`: nothing else to change: with `kind == Some(5)` the existing `Some(group)` arm runs
   `resource_search(group, cap)` with `cap = NO_CAP` (original passes -1 for `k != 0`; unused anyway),
   no site, no point, min state 2. The `None if PREDATOR` arm stays for the old build.
4. `first_resource(on_tile, kind)`: with kind 5 a candidate matches when
   `(pasture.is_some() || !untargetable) && ((class == 10 && state > 2 && amount > 0) ||
   (auto_gather && gather_group == 5 && amount > 0))`; `state > 2` is the raw state byte (dead-with-food
   is 5; a live boar, state 2, never matches). Take the FIRST match in tile-list order, and return
   `None` when nothing matches (0xd1bfa0 returns 0; the old build's "last object stays in hand" and the
   "order of objects decides" error do not exist in 188329). All fields are already in `Candidate`
   (`gather_search.rs:47-74`).
5. Found: unchanged (`hunt_take_found` = slot 0x48 retarget, `set_state(4)`, result "keeps").
   Not found: unchanged (`hunt_found_nothing`: point set -> state 11, else state 2).

What else this alters:
- `civilian_kind` is shared: `gathering/drop_off.rs:124` (Gather's after-drop search; original 0xb81f60
  uses the same slot 0x1b0, R3 2.6), `unit_ai/order_kinds.rs:448` (`resource_kind`, also the building
  AI: the building AI's slot was NOT read in 188329, keep it unchanged), `unit_ai/update.rs:412`
  (`hunter_search`, notify 0x202 with action 0x265) and `:510`. In 188329 the 0x202 handler does call
  slot 0x1b0 and, for `k != -1`, slot 0x80 with `(k, notify drop site, -1)` (`out_r2/r2.c` 169, 272), so a
  class-10 hunt entering state 3 also searches dead boars, from the drop site. That only happens once
  R2's N2 is implemented (engine `hunt/unit.rs:78-104` ends a class-10 hunt in `hunt_search_state`
  without the notify); until then the change is confined to the after-deposit search.
- Every boar hunt whose carcass runs out while another dead boar with food lies within
  `(int)LOS + 5` tiles of the villager now continues there instead of idling at the old spot.
- A live boar is never found by this search (state 2 fails `> 2`).

## 4. Suspected (not proven)

- Which path took 4017: direct (`score > 0`) or fallback. About eight villagers work on it, so
  `score = -workers + slots` is probably <= 0 and it comes back as the fallback via 0xd19ea0. With one
  candidate the answer is the same. The engine's `closest_resource_at` is still the old-build model
  (R3's N1 rewrite is not in the engine); with several dead boars in reach the choice can differ.
- `[4017+0x1c9] != 0` (targetable) and the reach test succeeding: implied by the truth, not read.
- `[ai+0x4c]` at the deposit: 10 or -1 (then hunt `+0x68` = 10). Both give class 10; which one was not
  determined. If the engine's `ai.target_class` held another class here the fix would not fire; the
  truth says the original's does not.
- 4391 (master 1611, class 11) lies on the same tile as 4017: it could only match through rule 8d
  (`[master+0x121] == 1` and `[master+0x123] == 5`), which I did not read from the dat. The truth cannot
  tell the two apart by position; 4017's food falling 229 -> 203 in 7 s fits 4017 being gathered.
- The route (north around the carcass to (86.062, 69.111)) is MoveTo / pathing with the other villagers
  as obstacles; not examined.

## 5. Not read

- 0xd23bf0 and 0xd19f60 were not re-read (taken from `out_r3/gather_open_items.md` 2.5 and
  `out_r3/verify.md`, both disassembly readings); 0xd19ea0, unit slot 0x408, 0xd1c390.
- Hunt slot 0x48 (retarget) body: taken from R2 section 2.3.
- The building AI's and other AI classes' slot 0x1b0 in 188329.
- Masters' `+0x121` / `+0x123` values in the dat for 48, 356, 1611, 2340.
- The 0x202 handler beyond the lines cited; N2's `set_state(3)` path.
- The engine was not run; whether `reach` succeeds for 4017 in the engine at update 14718 is untested.
