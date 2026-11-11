# P18: replay 517426097, P2 hunters 2974 / 3820 at 247.647 s (update 18829)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (build 188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/` (PC source, 2026-11-11, all switches of `go.ps1` on).
Engine runs (PC `runs\`): `k1_1` (OBJECT 18822-18834 for 2974, 3820, 2970, 3823, 3825, 2968, 3219,
`GENIE_LOG_HUNT_SEARCH=1`), `k1_2` (same ids 18825-18832 + `GENIE_TRACE_AIUPD=1`), `k1_3`
(`GENIE_TRACE_COMMANDS=1` to 18834). Truth reader: PC `~/k1w/tr.py lo hi ids [full]` (binary-search
seek into `truth6.jsonl`). Decompile: `out_p18/vn.c` (villager notify handler 0xd004a0).

## 0. Result

The goat 3219 was ordered directly (update 18617, 244.9 s, all 9 P2 villagers, flags
`DIRECT|HUMAN`) and **the boar carcass 3507 was then shift-queued** for the same 9 units (update
18695, `Interact{target 3507, flags QUEUED|DIRECT|HUMAN}`). When the goat is used up (amount 0 at
18826, state 7 at 18827), the two hunters that were still **walking** to it (Hunt state 4) get
MoveTo code 5. In 188329 the Hunt's state-4 handler first asks the unit AI for queued orders
(0xbb66f9): with any, the hunt ends (`set_target(0)`, `set_state(1)`), the next tick it is deleted
and the queued hunt on 3507 runs. The engine has no queue test there (`hunt/update.rs`
`lost_on_the_way`): it walks to the hunt point (state 11) and later drops the AI target. This is
item D1 of `original-188329-hunt-verify.md` ("REAL, narrow"), never implemented; this case is its
first observed effect. The gatherers of the goat (2970, 3823, 3825, state 7) already match: both
builds send them to 3507 at 18828.

## 1. Address table

| RVA | What |
|---|---|
| 0xbb6230 | Hunt update (vtable 0x32274b8 slot 0x30); jump table 0xbb7ef4 (state-1 index) |
| 0xbb62b0..0xbb6351 | pre-checks: target ptr/id gone or target state >= 7 -> slot 0x68(0); same for 2nd target |
| 0xbb668d | state 4 (walk): sub-list update 0xb8ae30, codes 1,2 / 3 / 4,5 / 6 |
| **0xbb66f9..0xbb672b** | **codes 4,5: `ai = unit+0x1f0; if ai && 0xd31a10(ai) > 0 { slot 0x68(0); set_state(1); return 0 }`** |
| 0xbb6730..0xbb6769 | else `0xbb2c90(hunt, 8.0, -1.0)`; 0 -> slot 0x68(0), `set_state(0xb)` |
| 0xd31a10 | `return [ai+0x18]` = queued-order count |
| 0xbb7e99..0xbb7eba | state 1: `if 0x1728be0(player)==0 (human) set_state(2)`; `return 1` (list deletes it) |
| 0xbb4a80 case 1 | set_state(1): `+0x44 = 0`; unit slot 0x70(stand sprite 0xbb37f0) |
| 0xbb4a80 case 2 | set_state(2): sprite, slot 0x68(0), 0xb6b9b0(0), point -1, timer 0 |
| 0xbb61b0 | Hunt slot 0x68: base set_target 0xb6ba50 (no notify) + lead fields cleared |
| 0xb93260 / 0xb932ec..0xb93370 | MoveTo update: target state >= 7 or gone -> slot 0x68(0); quiet (`+0x60`==1) -> code 5, else notify 0x1fb + code 4 |
| 0xbb2c90 | Hunt "next target" helper: searches only when civilian slot 0x1b0(class) == 0 (trees); returns 1 after slot 0x48 retarget |
| 0xcf9c60 | civilian slot 0x1b0: 5->2, 7->1, 8->3, 10->5, 15->0, 31->2, 32->4, 33->2, 63->4, else 0xff (58 livestock -> 0xff) |
| 0xd25d50 | `return [ai+0x4c]` (AI target class) |
| 0xd004a0 | villager notify handler (case 0x202 hunter branch at 0xd01189..; livestock 3-pass search when p0==0x265 && p1==0x3a) |

## 2. The original's logic (Hunt state 4, MoveTo ended with code 4/5 = target lost)

1. Hunt update pre-check: target state >= 7 -> slot 0x68(0) (target cleared).
2. Sub-action MoveTo (quiet for hunts) finds its target gone/state >= 7 -> code 5.
3. 0xbb66f9: if the unit has a unit AI **and its queue count `[ai+0x18]` > 0**:
   slot 0x68(0), `set_state(1)` (stand sprite), update returns 0.
4. Else 0xbb2c90 (8.0, -1.0): only for a class whose slot 0x1b0 kind is 0 (trees) it looks for the
   next target; otherwise (livestock: 0xff) returns 0 -> slot 0x68(0), `set_state(11)` (walk to the
   point, then search). This is what the engine does for every case.
5. Next update, state 1: human player -> `set_state(2)` (sprite, target and drop site released,
   point -1); return 1 -> the action list deletes the hunt. The AI's queued order (hunt 3507)
   then runs (AI order 0x2c9, priority 100, target 3507, class 10).

## 3. Tick-by-tick (truth samples vs engine `k1_1`/`k1_2`)

| update | truth 2974 | engine 2974 |
|---|---|---|
| 18807 (247.361) | (37.38348, 22.31137), Hunt st 4 tgt 3219, ai `C9020000 FFFFFFFF 65020000 930C0000 3A000000`, nw 6 | same position, st 4, AI tgt 3219 |
| 18826 | (sample gap) | goat held 0; 2974 st 4 |
| 18827 | (sample gap) | goat st 7; 2974 st **11** at (37.48891, 22.13204) |
| 18828 | (sample gap) | no step (both builds) |
| 18829 (247.647) | (37.48667, 22.14219), master **216**, Hunt st 4 tgt **3507**, point (37.21325, 23.57238), class 10, ai `C9020000 64000000 65020000 B30D0000 0A000000`, nw 2 wp (37.48891,22.13204)->(37.32549,22.87238) | (37.49555, 22.14005), master 590, st 11, AI tgt 3219 |
| 18831 | | AI target None |
| 248.557 | gathers 3507 (held 1.18 rising) at (37.34539, 22.78196) | still walking NE |

3820: same pattern (truth wp from its 18827 place (39.26786, 23.03164) towards 3507; engine st 11).
(37.3255, 22.8724) is the south approach point of boar carcass 3507 at (37.2132, 23.5724); goat
gatherer 3825's path (truth and engine) ends at the same point. Truth step at 18829 =
(-0.00224, +0.01015) = one 0.8 t/s step along the new path, so the new hunt existed by 18828, as
for the gatherers (engine and truth both retarget 2970/3823/3825 at 18828).

## 4. Confirmed difference

| | 188329 | engine |
|---|---|---|
| D1 | 0xbb66f9..0xbb672b: codes 4/5 with `[ai+0x18] > 0` -> slot 0x68(0), set_state(1), return 0; state 1 next tick -> (human) set_state(2), return 1 (0xbb7e99) | `gathering/hunt/update.rs` 199-201 `update_walk` codes `4 \| 5` -> `lost_on_the_way` (280-297): no queue test, always `set_point_walk(WalkSearch)` (state 11). `HuntState::Done` is never handled in `hunter.rs` `hunt_part` (139-182) and falls to `update` `_ => Err(..)` (update.rs 87-89) |

### Implementation note (extend switch `GENIE_EXPERIMENT_HUNT_188329`)
1. `gathering/hunt/update.rs` `update_walk`, arm `4 | 5`, before `lost_on_the_way`:
   ```rust
   4 | 5 if std::env::var_os("GENIE_EXPERIMENT_HUNT_188329").is_some()
       && r.has_ai
       && !r.attack.flags.contains(AttackerFlags::QUEUE_EMPTY) => {
       // 188329 0xbb66f9: queued orders end the hunt (slot 0x68 with none, set_state(1))
       let target = self.let_go();
       unit.hunt_release(c, [target])?;      // slot 0x68 releases (as update_attack's `_` arm)
       self.tear_down(c.w.parts.mover_mut(unit.id))?; // set_state drops the sub-actions
       self.state = HuntState::Done;
       self.timer = Seconds::ZERO;
       // set_state(1): stand sprite (unit slot 0x70 with 0xbb37f0 = engine `hunt_stand`), done by the caller
       Ok(HuntNext::Stay)
   }
   ```
   (`QUEUE_EMPTY` is `ai.orders.is_empty()`, `combat/attack/mod.rs` 385-388 = `[ai+0x18] == 0`.)
   Then call `unit.hunt_stand(c, &task)` for the stand sprite (a `HuntNext::Done`-like variant or
   inline, as `hunt_search_state` does).
2. `gathering/hunt/hunter.rs` `hunt_part`, new first arm:
   ```rust
   Some(HuntState::Done) => {
       // 0xbb7e99: a human player's hunt set_state(2), then the update returns 1
       if !c.w.players.player(c.player)?.kind.is_computer() {
           let task = actions.list.hunt().ok_or(NO_HUNT)?.task;
           let released = actions.list.hunt_mut().ok_or(NO_HUNT)?.set_done();
           self.hunt_stand(c, &task)?;
           self.hunt_release(c, released)?;
       }
       return Ok(HeadCode::Deletes);
   }
   ```
   No AI order/action clearing here (0xbb66f9 does not call 0xd40990/0xd40980, unlike state 8).
   The queued order then runs from the per-tick check (`unit_ai/actions.rs` `off_turn`: a top
   action in state 1 is interruptible, `objects/unit/top.rs` 164; with no action left
   `interruptible` is true; priority 100 does not wait).
3. Test: `go.ps1 -Name k1_4 -Updates 18900` with the switch, OBJECT 18825-18900 for 2974,3820:
   expect st 1 at 18827, the queued hunt on 3507 at 18828 (master 216), and
   (37.4866676, 22.1421947) at 18829, waypoints (37.48891,22.13204)->(37.32549,22.87238); then
   `cmp_pos` from 18829.

## 5. Suspected
- The new hunt in truth sits at the same address as the old (allocator reuse; `an`/`ao` show the
  same node, new task +0x48 and sub-list +0x50). Consistent with delete + new hunt, not proven.
- Whether the queued order runs before or after the state-1 deletion inside 18828 (per-tick check
  0xd443f0 vs action update order) was not read; the gatherers' identical timing in both builds
  suggests the engine order already gives the step at 18829.

## 6. Not read
0x1728be0 (taken as player type, 0 = human, from its uses at 0xbb7ea1 and in state 8); the exact
engine path that retargets the gatherers at 18828 (an AI full update `AIUPD` ran for all six at
18828; `GENIE_LOG_HUNT_SEARCH` printed nothing, so not the kind-None hunter search); code 3
(MoveTo failed) has no queue test (0xbb676e), unchanged.

## 7. Other situations affected
Every villager with shift-queued orders whose hunt/shepherd target vanishes (eaten, decayed,
killed by others) while it walks to it (Hunt state 4, quiet MoveTo code 5): it now drops the hunt
at once and runs the next queued order instead of walking to the old point and searching. Common
with queued food orders (sheep, boar, deer). Villagers without queued orders are unchanged (still
state 11). Food income: in this case both hunters reach 3507 ~1 s after the goat and gather it
(truth 2974 gathers from 248.5 s); the engine's walk NE delays them and changes 3507's held amount
from 248.557 s (the next P2 difference in P15).
