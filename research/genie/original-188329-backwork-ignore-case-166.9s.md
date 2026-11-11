# P16: replay 518470161 (truth5), P2 position mismatch at 171.2 s and P2 food -10 at 218.5 s

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Engine runs (PC `runs\`, all 12 switches + go.ps1's
`SEARCH_CLEAR=unit`): `f1_a` (OBJECT, updates 12400-13010, all objects), `f1_b` (OBJECT for 10417,
9720, 9365 + STEER/PATHS/COMMANDS/SPAWN, 12640-12700), `f1_c` (OBJECT for 8 goats/shepherds,
1-12500), `f1_d` (OBJECT for 18 P2/gaia ids, 12990-16700), `f1_e` (OBJECT all + STEER 16399-16403).
Truth slices: `t5_160.jsonl` (150-172 s), `t5_200.jsonl` (172-222 s) in the PC VM's `~/w/`;
compare script `~/w/cmpp.py` (P14's cmpp.py + `ALLP=1` for gaia). Ghidra copy `proj_p16`;
decompiles in this folder: `ign.c` (0x120ee10, 0x1078690), `gbw.c` (0x16f4ba0), `sb.c`
(0x107a390, 0x1121350), `st.c` (0x1083e60), `start.c` (0x107e820, 0x107e9d9.., 0x107bff0).

**Result.**
1. The earliest differing P2 object is **villager 10417 (master 122) at update 12668 (166.868 s)**,
   first truth sample 166.933 s. It is NOT a gaia consequence. At GO_BACK_TO_WORK on town centre
   9359 (update 12667) hunters 9383 and 10417 come out at (28.809898, 31.79) and (29.21, 31.79)
   (both builds, bit-equal) and both hunt boar 9720. The original, in 0x16f4ba0, puts every other
   released unit into each released unit's own ignore list (`obj+0x1b0/+0x1b8`) before letting it out;
   0x120ee10 then adds that list to the short path's ignore list because the path is made this update.
   So 10417 ignores 9383 (0.4001 to its west) and walks straight west. The engine never fills the list
   (`own=[]` in the IGNORE trace), so 10417 detours south round 9383. Confirmed on both sides; the change is below.
2. The 218.5 s food difference (9366 drops 10 food at 218.803 s in the engine, by 218.530 s in truth)
   has a **different, later cause that does not depend on 10417**: shepherd 9381's drop-off walk at
   update 16401 (215.397 s). Its start lies exactly on the edge of shepherd 9366's box (fixed point
   x = 106913032 on both). The engine's drop-off ignore rule fires (its start test says "stuck"),
   adds 9366 to the ignore list and goes east. The truth path goes west, which only works with 9366
   kept as an obstacle. 9381 then drops at a different spot, and 9366's walk at 217.84 s differs
   (late drop). I traced the cause to the start test (0x107e820 family) but did NOT confirm it (section 4).

## 1. Address table

| Role | 188329 | Engine |
|---|---|---|
| Building lets its villagers back to work (GO_BACK_TO_WORK via 0x164d410 at 0x164ead8; ALL_BACK_TO_WORK 0x16e27d0 at 0x16e286c; also 0xf601e0) | 0x16f4ba0 (body 0x16f4c25..0x16f50df) | `garrison/unload.rs:356` `go_back_to_work`; `orders/town_bell.rs` `workers_out` |
| Collect units inside, last first: type > 0x45, class 4 / 0x15 / 0x42 (encoded `^0x17c0`) or master test | 0x16f4ba0 (dec `gbw.c` loop over `+0x150`) | same loops (class 4 / master 1808 only) |
| Per collected unit: clear own ignore list | call 0x1255e40 at 0x16f5066 (`[obj+0x1b8] = 0`) | `Mover::ignore_units.clear()` |
| Per collected unit: append every other collected unit's id | loop 0x16f5080..0x16f509a, `cmp [rdi+8],edx; je` then `call 0x124a900` (rcx = unit, edx = other id) | none (the change) |
| Then back to work | call 0x12bc7e0 at 0x16f50a2 | `World::back_to_work` |
| Append to `obj+0x1b0` (count `+0x1b8`, capacity `+0x1bc`) | 0x124a900 | `ignore_unit` (`orders/mod.rs:610`) |
| Short-path ignore list builder | 0x120ee10 (callers 0x12124ed, 0x1212dcf in the walk 0x1210f60; 0x107aaad) | `movement/new_path.rs:198` `ignore_list` |
| Own list added when path state `+0x3f0` set, 1 <= `+0x1b8` <= 0x3c, top path (0x106f390) `+8` == world time (0x1602960) | 0x120eea3..0x120ef41 | `new_path.rs:217-222` (`top.has_path && top.created == now`) |
| Drop-off rule: query mode `mgr+0x57 = 1`, `mgr+0x58 = r*4.0 + 0.1` (0x31fd878, 0x3202890) | 0x120efad..0x120efc9 -> 0x1121350; query 0x111c660 at 0x120f04f | `new_path.rs:226-283` (grow = radius + range_floor) |
| Drop-off rule gate: own class 4/0x15, hits > 0, target, slot 0x2c8 == 8, start test | 0x120f0c2..0x120f135 | `new_path.rs:226-229` (no own-class test) |
| Start test: returns `0x107e820(..) == 2` | 0x107a390 -> 0x1077790 -> 0x1083e60 (`cmp eax,2; sete al` at 0x1084039) | `pathing/short_path/call.rs:315` `start_blocked` |
| Start node | 0x107e820 | `pathing/short_path/start.rs:64` `Search::start` |
| Shape holding a point but one, edges included | 0x107bff0 -> 0x96cdb0 (`jl`/`jg`: inclusive) | `raycast.rs:60` `holder_but` -> `inside` |
| Shape add at a let-out (slot 0x60 then `0x1120110(mgr,obj,1)`) | 0x1255c20 (0x1255d76) | `objects/layers/mod.rs:91` `put_down` |

## 2. The original's logic (case 1, in execution order)

1. Update 12667, command GO_BACK_TO_WORK on 9359 -> 0x16f4ba0(_, building):
   a. type `== 'P'` (80) and `+0x150` (inside list) non-empty.
   b. Collect into a static vector, from the last entry to the first, every unit with type > 0x45 and
      class 4, 0x15, 0x42 (encoded `0x17c4`, `0x17d5`, `0x1782` = class `^ 0x17c0`) or the master test
      (`0x460c`). Here: [9383 (entered at update 12151), 10417 (entered at update 11167)].
   c. For each collected unit U, in that order (asm 0x16f5060..0x16f50ae):
      `0x1255e40(U)` (list count 0); for each collected V with `V.id != U.id`: `0x124a900(U, V.id)`;
      then `0x12bc7e0(U, building)` (town-bell record -> let-out 0x12a16e0 -> spot -> work command
      on 9720).
   Result: 9383.list = [10417], 10417.list = [9383].
2. The let-out puts each unit on the map with its shape (0x1255c20 -> `0x1120110(..,1)`), so 9383's box
   is in the mesh when 10417 plans (as in the engine; see P9's mesh rule).
3. Same update, each unit's walk asks for a short path (truth path ids `ps+0`: 9383 0x6BA, then
   10417 0x6BB). In 0x120ee10: list = [self, target 9720]; then, because the walked level's top path
   was made this update (0x106f390 `+8` == 0x1602960), the own list is appended without self:
   10417 -> [10417, 9720, 9383]. Unit not moving (slot 0x610 == 0), but the drop-off part adds
   nothing (action state is not 8).
4. The short path ignores 9383's shape: straight west.
   Truth 166.933 s, 10417: `nw 3`, wp = (29.21, 31.79), (26.8, 31.8), (26.8, 32.509914)
   (hex `14AEE941 EC51FE41 / 6666D641 6666FE41 / 6666D641 270A0242`); position (29.1475945,
   31.7902641) = 6 steps of 0.0104 toward (26.8, 31.8). 9383's truth path is the same shape from
   28.809898 (the engine's 9383 path is bit-equal to it).

## 3. Confirmed differences

**D1. GO_BACK_TO_WORK / ALL_BACK_TO_WORK do not fill the released units' ignore lists.**
- Original: 0x16f4ba0, asm 0x16f5060..0x16f50a2 (decompile `gbw.c`), append 0x124a900
  (asm 0x124a91a..: `[rcx+0x1b8]` count, `[rcx+0x1b0]` array, `edx` id), consumed by 0x120ee10
  (0x120eea3..0x120ef41).
- Engine: `garrison/unload.rs:378-401` (`go_back_to_work`) and `orders/town_bell.rs` `workers_out`
  call `back_to_work` per unit with no ignore-list write; `ignore_list` (`movement/new_path.rs:217-222`)
  already reads `ignore_units` under the same "top path made now" rule. Trace `f1_b`:
  `IGNORE walker=ObjectId(10417) list=[ObjectId(10417), ObjectId(9720)] own=[] top_created_now=true`,
  then `SHORTPATH ... points=[(29.21, 31.79), (29.209898, 31.390001), (28.409899, 31.390001),
  (26.8, 31.8), (26.8, 32.509914)]`: the detour round 9383's box
  ([28.4099, 29.2099] x [31.39, 32.19] with the walker's radius). Truth: no detour (section 2.4).
- Implementation (new switch `GENIE_EXPERIMENT_BACKWORK_IGNORE_188329`, or folded into
  `GENIE_EXPERIMENT_UNLOAD_188329`), in both `World::go_back_to_work` (per building) and
  `World::workers_out`:
  ```rust
  // 188329 0x16f4ba0: collect first (last in first, same filter as now), then per unit:
  // clear its ignore list, add every OTHER collected id, then back to work
  let mut out: Vec<ObjectId> = Vec::new();
  let mut i = self.players.live(p, idx)?.garrison.len();
  while 0 < i { i -= 1; /* existing filter on garrison[i] */ out.push(inside); }
  for &id in &out {
      if std::env::var_os("GENIE_EXPERIMENT_BACKWORK_IGNORE_188329").is_some()
          && let Some(m) = self.parts.mover_mut(id)
      {
          m.ignore_units.clear();
          for &o in &out { if o != id { m.ignore_units.push(o); } }
      }
      let _ = self.back_to_work(Some((p, idx)), id)?;
  }
  ```
  (Collecting first is the same order as the current loop: each let-out removes the last entry, and an
  entry that stays keeps its index.) Expected after the change, update 12667: `IGNORE walker=10417 ...
  own=[ObjectId(9383)]`, path `[(29.21, 31.79), (26.8, 31.8), (26.8, 32.509914)]` = truth wp bits.
  Check that `own` really shows 9383. If it is empty, something in the engine's back_to_work -> let_out
  -> order_work/hunt chain calls `Mover::stop` (which clears the list, `movement/waypoint.rs:527`)
  after the fill. The truth shows the original keeps the list.
- Side difference read in the same code (no case): the original collects classes 0x15 and 0x42 too;
  the engine takes only class 4 and master 1808 (`unload.rs:386-397`).

## 4. Suspected

**S1 (cause of the 218.5 s food difference). Drop-off ignore rule for shepherd 9381, update 16401.**
- At 215.384 s 9381's carcass runs out (held 9.794055, both). At 16401 it walks to the TC, Hunt
  state 8. Positions (bit-equal in both): 9381 (25.4900532, 36.45462), 10413 (25.4844227,
  36.0546227), 9366 (25.8900528, 36.8234253).
- Engine (`f1_e`): `IGNORE walker=ObjectId(9381) list=[9381, 9359, 9366]`. The drop-off rule fired,
  `start_blocked` = Stuck. Path `[(25.490053, 36.45462), (25.884422, 36.45462), (25.884422, 36.2)]`:
  east round 10413, through 9366's box (it is ignored).
- Truth (215.579 s): wp `[(25.49005, 36.45462), (25.08442, 36.45462), (25.08442, 36.2)]`: west round
  10413. East is shorter (9381 is 0.0056 east of 10413), but the east corner (25.884, 36.455) lies inside
  9366's box (|dy| 0.368 < 0.4). So in the original 9366 was **not** ignored, and the drop-off rule did not add it.
- Knife edge: 9366's shrunk box west side = fixed(25.8900528) - 838860 - 0x200000 + (0x200000 -
  838860) = 106913032 = the start's x exactly. The start test's result decides the rule. 0x107a390
  returns `0x107e820(..) == 2` like the engine, and 0x107bff0 / 0x96cdb0 are edge-inclusive like
  `holder_but`/`inside`. The difference must be elsewhere in the escape scan (0x107e9d9..0x107f66e,
  `start.c`), in the query mode 0x1121350 (r*4+0.1 instead of r+range_floor gives MORE hits, so it is not the cause), or
  in the rule's gate. Not hand-simulated. Next step: run `out_p10/sp.py`'s start node on this query
  (`from (106913032, 152901760)`, to (113246208, 142606336), r 0.2, target half 2.0) with the shapes
  of 9381, 10413, 9366 and the TC annexes, and compare it line by line with `start.c`.
- 10417 is not involved: it is 4 tiles away and its position differs only by 0.004. Every input of the
  9381 decision is bit-equal at 215.345 s.

**S2.** The goat carcass "held" mismatches (9516, 9519, 9523, 9524, 9526: truth one gather/decay
step of 0.00429 or 0.01287 higher, at isolated samples, e.g. 9516 at 18.863 s and 19.032 s with the
next sample equal) are truth-reader lag, not simulation differences.

## 5. Not read

- Whether the original's work command (0x12bc7e0 -> 0x12a16e0 -> slot 0x138 -> 0x12df320 -> Hunt
  set-up) ever calls stop (slot 0x618 -> 0x1255e40); the truth implies it does not before the plan.
- 0xf601e0 (third caller of 0x16f4ba0; likely the town bell's end) and 0x16e27d0's direct
  0x12bc7e0 call for units outside (no list fill there).
- The master test value `0x460c` (taken as master 1808 from the unload case).
- S1's start-node escape scan (above).

## 6. What else the change affects

Every GO_BACK_TO_WORK (0x80/0x86), ALL_BACK_TO_WORK (0x8c) and other 0x16f4ba0 caller that releases
two or more units from one building: in the update they come out, each unit's short path ignores the
others while its top path was made that update (0x120ee10 own-list rule). Units released alone are
unchanged. The lists persist until the next clear (stop, new order), so later short paths in the same
update made by a fresh plan also ignore them. Nothing changes for UNLOAD (0x6f, `unload_order` already
clears) or for ungrouped orders.
