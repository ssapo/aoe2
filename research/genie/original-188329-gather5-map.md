# Gather action (type 5), drop-off and stockpile write: AoE2DE 188329 vs genie (158041)

All addresses are RVAs in `AoE2DE_s_unpacked.exe`. Source file named in the binary next to the
vtable: `...\Aoc\Source\Game\ai\Actions\ActionGather.cpp`.
Decompiles: `out_c2/g1.c` (every function 0xb79620..0xb82df4 except slot 4), `out_c2/g2.c`
(player add-attribute, helpers), `out_c2/g3.c` (base add-attribute, slot 0x2d8, secondary map).
Disassembly: `out_c2/gupd.asm` (Gather update), `out_c2/dropsearch.asm` (0x1229bb0).
Engine paths are relative to `genie/crates/engine/genie-core/src/`.
"Confirmed" = read in 188329 decompile/disassembly AND in the engine source/doc.

Action fields (same as Hunt): `+0x10` unit, `+0x18` state, `+0x20` target (`+0x30` id), `+0x28`
drop site (`+0x34` id), `+0x38/3c/40` point, `+0x44` timer, `+0x48` task, `+0x50` sub-actions,
`+0x68` target class, `+0x6c` stops, `+0x6d` current stop, `+0x70` time per stop, `+0x74` time at
stop (reused as a "next re-target check" time in state 4, see D5), `+0x78/7c` last stop,
`+0x80` worked, `+0x84/88` farm x/y, `+0x8c/90` gather x/y.
Task: `+0x15` flags (bit 0 = deposit at once), `+0x20` resource, `+0x22` productivity attribute,
`+0x24` resource out, `+0x28` work_val1, `+0x30` range.

## (a) Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Gather vtable | 0x3224dc8 | `gathering/gather/mod.rs` |
| Constructors | 0xb79620, 0xb796d0, 0xb79ca0 | `gather/start.rs` (FUN_140a88310) |
| Slot 4 (not read) | 0xb7cb00 (0x19f4) | - |
| Start (slot 5) | 0xb7c580 | `gather/start.rs` start (0x140a8b3a0) |
| Update (slot 6) | 0xb800b0 (0x24c8) | `gather/update.rs`, `gather/work.rs`, `gather/unit.rs`, `gather/point_walks.rs` (0x140a8e1d0) |
| Slot 7 stop -> set_state(2) | 0xb80090 | `start.rs` halt (FUN_140a8e1b0) |
| Slot 8 (move, 0x40) | 0xb7c940 | `start.rs` MoveTarget (0x140a8b740) |
| Retarget (slot 9, 0x48) | 0xb82580 (0x874) | `start.rs` retarget (0x140a903a0), not compared line by line |
| set_target (slot 13) | 0xb6ba50 (base) | - |
| set_state (slot 16) | 0xb7e500 (0x1b83) | `start.rs` set_walk/set_drop/set_idle, `work.rs` set_face/set_work, `point_walks.rs` (0x140a8cd40) |
| Per-tick transfer (state 7) | 0xb81553..0xb81a86 inside update | `gather/work.rs` `gather()` |
| Farm stop timing (pre-switch + state 7 head) | 0xb800b0 head, case 7 head | `update.rs` l.296-312, `start.rs` StopRate |
| Walking sprite / standing sprite | 0xb7c860 / 0xb7c8b0 | FUN_140a8b660 / FUN_140a8b6b0 |
| Farm stop point test | 0xb7aa90 | `start.rs` stop_point |
| "Path end occupied?" test used in state 4 | 0xb7b5c0 (helpers 0xb7b300, 0x107af40) | none (D5) |
| Resource object on a tile for a gather group | 0xb7b960 | none (D6) |
| Reseed after walk (state 0xf2) | 0xb7bca0 (0x69c) | `World::reseed_after_walk` (FUN_140a8aa60), not compared |
| Dead farm (masters 357/1188) in set_state(6) | 0xb7c340 | engine: unsupported |
| Drop-site search | 0x1229bb0 | `gathering/drop_sites.rs` drop_site_search (FUN_1411671e0) |
| "Uses the path search for drop sites" (unit slot 0x2d8, combat object) | 0x12de7d0 | none (D3) |
| Master's drop-site list contains id | 0x1169960 (vector at master+0x240/+0x248, 16-bit ids) | `drop_sites.contains` |
| Site takes the load | 0x10ba220 | `drops_at` (FUN_140fdd190) |
| Deposit (resource, unit id, amount, player) | 0xb69000 | `gather/unit.rs` give_load |
| Player slot 0xf8, WorldPlayer override | 0x16e1e90 | give_load (FUN_141616820) |
| Player base add-attribute | 0x172bea0 | `adds.push((kind, amount))` |
| Player slot 0xb8 (AI module notify, player+0x718) | 0x170e7f0 | not held |
| "Shares resources" flag getter (player+0x13ae) | 0x16f60c0 | `sharing` (+0x1426) |
| Unit slot 0x110 add/set resource | 0x113e4d0 -> 0x125bef0 | plain writes |
| Secondary-resource table push / clear | 0x1138e00 (slot 0x828) / 0x1138eb0 (slot 0x830) | none |
| Secondary-resource map getter / clear | 0x1139090 (obj+0x460) / 0x1138ed0 (slot 0x838) -> 0x113b1d0 | none |
| Work rate (slot 0x270) | 0x11393d0; powerup slot 0x748 = 0x12b6700 (obj+0x6b8); modifier apply 0x14c2950 | `gather/unit.rs` l.172 |
| "Gathered when empty" (unit slot 0x2d0) | 0x12cb080: master 50, 1187 or 45 | `MasterRoles::REGATHERED` |
| Depletion task 0xa1 of the target | 0xb69210 -> 0x12c00e0 | not found in engine (S3) |
| Unit AI: next resource after drop (slot 0x1b0 group, slot 0x80 ClosestResourceObject) | called at 0xb81f.. | `gathering/drop_off.rs` gather_after_drop, `gather_search.rs` |
| Unit AI helper used by D5 | 0xd09980 -> 0xcfa740 (slot 0x1b0 then slot 0x80, or 0xd22c20) | none |
| Game setting world+0xc1c ("gather everything at once") | 0xd6cc70 | engine: `+0xc14` held 0 |
| Is computer player (player+0x10 == 3) | 0x1728be0 | PlayerKind::is_computer |

Constants: 0x3202890 = 0.1 (REMAINDER), 0x31fe7cc = 0.001 (LAST_BIT), 0x369ff64 = 1.0 (drop reach,
squared gap), 0x31b1420 = 0.5 (random wait shift), 0x31fe5c8 = 3.0, 0x3218e74 = 16.0,
0x320532c = 0.25, 0x3205ee8 = 8.0, 0x3225018 = 25.0, 0x31fd87c = 10.0, 0x369ffb4 = 100.0,
0x369ffdc = FLT_MAX. Timers: -10.0 (state 3), -1.0 (state 0xf3). RNG lines in ActionGather:
set_state 656/657 (farm stop point), update 0x68a (failed walk), 0x7d3 (drop walk failed),
0x7ef (drop site out of reach).

## (b) Same as the engine (confirmed on both sides)

1. Transfer formula and float order (disassembly 0xb81571..0xb81918 vs `work.rs` `gather()`):
   ```
   call [rax+0x270]; mulss xmm0,[task+0x28]; mulss xmm0,[world+0x164]     ; (rate*work_val1)*dt
   movss xmm8,[target+0x168]; minss xmm8,xmm0                              ; take
   comiss 0,prod; jb use prod else 1.0                                     ; productivity > 0 else 1
   movaps xmm7,xmm9; mulss xmm7,xmm8                                       ; gain = prod*take
   movaps xmm0,xmm7; addss xmm0,[unit+0x168]; comiss xmm0,xmm11; jbe ...   ; gain+held > capacity -> set_state(8)
   target.slot0x110(-take, add)
   if (0.1 > t && t > 0): xmm0=[master+0xb0]*0.001; addss xmm0,[target+0x168]; addss xmm7,xmm0; target=0
   unit.slot0x110(gain, add, flag 1, target master id, class+900)
   over = |held - capacity|; if (capacity > held && 0.1 > over && target >= over) move over too
   ```
   Engine: `work = (r.work_rate * work_value) * dt`, `capacity < gain + *held -> Drop`,
   `gain += target.storage * LAST_BIT + target.amount`, same top-up. Capacity is
   `(float)(short)master[+0xbc]`. No clamp at the add (0x125bef0 is called with clamp = 0).
2. End of a tick without the task flag: `over < 0.1` -> set_state(8); else target `<= 0` and not
   regathered (slot 0x2d0) -> set_state(8). Engine: `over < REMAINDER || empty`.
3. Farm stops: per-stop time `((capacity*prod)/(rate*work_val1))/stops` recomputed every update
   for masters 50 and 1187; state 7 leaves for the next stop when `per_stop <= time_at_stop` and
   `current+1 < stops`.
4. Drop-off (state 8): sub-action codes 1/2 -> site must take the load (else set_state(2)),
   squared footprint gap `> 1.0` -> timer = rand - 0.5 and animation stop; codes 3/4/5 the same
   random wait. Engine `update_drop` the same (drop_reach 0x3f800000, wait_shift 0.5).
5. Drop-site search core: state filter (state 2), zone test, at-work filter 0x7d/0x7c,
   outside filter, villager on a farm measures from the farm by distance, planner result < 2,
   short path within 10.0 using 0.1, squared distance `(py-oy)^2 + (px-ox)^2`, strict
   `d < best` (`comiss xmm10,xmm6; jbe skip`): the first in the player's list wins ties.
   Point (-1,-1) returns the first matching object (`122a503: mov rax, rdi`) - this settles S2
   of gather_map.md.
6. Start (0xb7c580): both-food keeps the amount under the task's kind; other load dropped under
   the game-setting test or for a computer player carrying nothing; loaded gatherer sent to an
   own drop site -> second target + set_state(8); farm with 2+ workers -> set_state(0xb).
7. set_state(3)/(0xf3): notify 0x202 with (0x261, target class, drop site id | 0 | -1); the search
   there uses the unit as seeker, outside = 0. Timer -10.0 / -1.0.
8. After the deposit without a target: queued orders -> set_state(1); else slot 0x1b0 group and
   ClosestResourceObject(group, -1, -1, 0, 2, -1.0, -1.0); nothing found: no point -> 2, farmers
   (masters 259, 214, 1891, 1892) -> 0xf3, else 0xb.
9. Stockpile add (0x172bea0): `attr[i] = decode(attr[i]) + amount` (one float add, no
   rounding, no multiplier). WorldPlayer's 0xf8 (0x16e1e90) first adds the same amount to the
   gathered totals: 166/167/168 for food/wood/stone, 49 and 169 for gold. Engine `give_load`
   pushes the same pairs. Encoding of the array: `((x ^ 0xa9834b738a7dd167) + 0x42ac42976fccef5) ^
   0xa8cf267a3f737c66` on write, the inverse on read, value in the low 32 bits.
   There is no civ/tech/handicap multiplier at deposit time; the only multiplier is the
   productivity attribute (task+0x22) applied at gather time.

## (c) Confirmed differences

D1. Secondary resources (settles S1 of gather_map.md). Every unit gain goes through slot 0x110
    with flag 1, the target's master id and class+900; 0x113e4d0 walks the per-unit table
    `obj+0x448..0x450` (16-byte entries, key at +4 = master id, class+900 or -1) and adds
    `amount * a * b` to a map at `obj+0x460`:
    ```
    *(float *)(*plVar5 + 0x14) = param_2 * fVar1 * fVar2 + *(float *)(*plVar5 + 0x14);
    ```
    At the drop-off the Gather deposits every map node after the main load, then clears the map:
    ```
    func_0x000140b69000((int)sVar10, unit id, unit[+0x168], player);
    func_0x00014125bee0(param_1[2],0xffffffff,0);
    lVar15 = func_0x000141139090(param_1[2]);            // lea rax,[rcx+0x460]
    for (node...) func_0x000140b69000(node[+0x10], unit id, node[+0x14], player);
    (**(code **)(*unit + 0x838))();                      // 0x1138ed0 -> clears obj+0x460
    ```
    Engine `update_drop`/`gather_load_dropped`: only `Dropped::Load(kind, amount)` ->
    `c.give_load(kind, amount)`. No table, no map (grep finds nothing). Who fills the table
    (slot 0x828 = 0x1138e00) was not traced.

D2. Which resource is credited. 188329 uses the task's resource-out field, else the unit's kind,
    with no mapping function:
    ```
    sVar10 = *(short *)(param_1[9] + 0x24);
    if (sVar10 < 0) sVar10 = *(short *)(param_1[2] + 0x160);
    func_0x000140b69000((int)sVar10, ...);
    ```
    Engine: `resource_kind(unit.life.attribute_kind, attributes, slots)` (FUN_140fdd4f0: load
    kind -> resource, food for none). `HuntTask` has no `+0x24` field. Same result only while
    the data's resource-out equals the mapped kind.

D3. set_state(8) drop-site search order (0xb7e500 case 8 vs `drop_off.rs` `drop_site`):
    ```
    cVar6 = (**(code **)(*unit + 0x2d8))();
    if (cVar6 == 1) { site = 0x1229bb0(list, sites, x, y, 1, 2, seeker=unit, 0x7d, by_path=human, outside=1); }
    if (param_1[5] != 0) goto walk;
    seeker = (master id == 13) ? unit : 0;
    site = 0x1229bb0(list, sites, x, y, 1, 2, seeker, 0x7d, human, 1);
    ```
    Slot 0x2d8 (0x12de7d0) is 0 for class 0x15 (fishing ship), class 2, or a master whose drop
    sites contain master 45 or 2172; else 1. Engine: the seeker search always runs first
    (`drop_site_from(.., SitePlace::Outside)`), and the fallback always has no seeker.
    Villagers with land drop sites behave the same; fishing ships and dock-dropping units differ
    (master 13 keeps the seeker in the only search; other such units go by distance only).

D4. Deposit-at-once branch. 188329 tests the task flag, engine tests player attribute 96 plus
    farm class plus farm-food kind:
    ```
    b81918: mov rbx,[rsi+0x48]; test byte ptr [rbx+0x15],1; je normal
            resource = task[+0x24] (<0: unit kind); player.slot0xf8(resource, unit[+0x168], 1, 1);
            player.slot0xb8(unit id, resource, (int)amount); unit.slot0x110(0, set)
    ```
    and at the stop change: `if ((task[+0x15] & 1) == 0) current_stop++`.
    Engine `work.rs`: `if Amount::ZERO < r.food_sold && FARM class && FARM_FOOD kind { give_load(food, sold) }`
    and `update.rs` l.304 `if r.food_sold <= Amount::ZERO { current_stop.next() }`.
    Also: 188329 credits task resource-out, the engine always food.

D5. Re-target while walking (state 4), absent from the engine's state-4 update
    (`update.rs` doc l.318-323 lists only the sub-action codes):
    ```
    if (target class != 0x31 && unitAI[+0x3c] == -1) {
      t = world_ms / 1000.0;
      if (action[+0x74] <= t && FUN_140b7b5c0(unit)) {         // path's end within 25.0 and occupied
        action[+0x74] = t + 0.25;
        site = 0x1229bb0(list, sites, x, y, 1, 2, unit, 0x7d, human, 0);
        id = 0x140d09980(unitAI, target class, site id);        // ClosestResourceObject near the site
        if (id != -1 && id == unitAI.0xd28790()) action[+0x74] = t + 8.0;
        if (id != -1 && object(id)) retarget(slot 9, object, its position);
      }
    }
    ```
    Changes which tree/mine/bush a villager ends on, hence when it fills up.

D6. set_state(6) on a stone (class 8) or gold (class 0x20) mine, absent from `work.rs` `set_face`:
    when the target's tile differs from the unit's on both axes, the two orthogonal neighbour
    tiles are searched (0xb7b960 with the slot-0x1b0 group); a resource there with squared
    footprint gap < 0.001 and the highest worker count (`+0x18c`) replaces the target
    (set_target, point, unit AI target 0xd40b90, target class). Then 0x1116f60(unit, target) for
    classes 8, 0x20, 0xf.

D7. Unit work rate: `powerup(obj+0x6b8) + master[+0x238]`, then every entry of the unit's
    modifier list of kind 0xd is applied (0x14c2950: 1 add, 2 multiply, 3 min, 4 max). Engine:
    `work_rate_powerup + master.work_rate` only. (Same as D5 of gather_map.md.)

D8. Sharing on deposit: the base add (0x172bea0) with its last argument 1 and the player's
    `+0x13ae` set repeats the add for every allied player (resources 0..3). Engine `give_load`
    returns `unsupported("a load given to a player with allies (+0x1426)")`. Same intent; the
    engine stops instead of sharing.

D9. Fishing-ship branch of the drop-site search: `122a32a: cmp al,4; jb` - a by-path search counts
    the "not reached but near (gap2 <= 100)" case only for planner result >= 4; the engine doc says
    `3 <= result` (`Found::Nothing`). Fishing ships only; the planner's result numbering in
    188329 was not checked.

## (d) Suspected, not confirmed

S1. Tie-breaking between equally near drop sites depends only on the player's object list order
    (`player+0x30`: array `+8`, count `+0x10`). Engine iterates `others.own_iter()`; whether that
    matches 188329's ascending-id order depends on the research build's switch. Not tested.
S2. Game setting world+0xc1c (0xd6cc70) non-zero: take = whole target, overflow is trimmed
    (`take -= over/prod`) instead of set_state(8), farm stops ignored. Engine holds its `+0xc14`
    counterpart at 0. Probably a cheat/scenario mode.
S3. Target emptied (not farm 50/1187/1188, 357, 1893/1894/1897/1898): 0xb69210 runs the target's
    task 0xa1 (range field < 1e-7) through 0x12c00e0, which ends in the target owner's slot 0xf8.
    For gaia resources the credit goes to gaia. Engine side not searched.
S4. After-drop search result with `master[+0x8e] == 1` goes through unit slot 0x8a8 instead of
    the Gather's retarget; engine `after_drop_retarget` not compared.
S5. Retarget (0xb82580), slot 8 move (0xb7c940), constructors and reseed (0xb7bca0) were
    decompiled (g1.c) but not compared with the engine.
S6. Planner call inside the drop search passes an extra "human player" byte
    (`uStack_698 = iVar9 == 0`); not compared with `Mover::plan_length`.

## (e) Not found / not done

- Who fills the secondary-resource table `obj+0x448` (callers of vtable slot 0x828).
- Gather slot 4 (0xb7cb00, 0x19f4 bytes) was not decompiled.
- Farm reseed/build (0xb7bca0, 0xb7c340, unit slot 0x3b0 build command) only located.
- ClosestResourceObject (unit AI slot 0x80) search order for trees/bushes/mines was not read in
  188329; only its call sites and arguments (b.8, D5) were.
- 158041 itself was not seen; the engine side is its source and doc comments only.
