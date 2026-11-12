# P28: replay 517426097 (truth6), P1 word 7 at 282.4 s — the Explore action's wait for a point (scout 2976)

RVAs are in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/` (PC source as of 2026-11-12; runs use the frozen `census_base.exe`).
Disassembly: `out_p28/explore.asm` (0xb79060..0xb795b0). Simulation: `out_p28/sim_p28.py`.
Engine runs (PC, `runs/`): `P28_1` (all objects, updates 21300-21560), `P28_2` (2976, updates 20150-20270, STEER + PATHS).
Truth window used: `$HOME/p28/tw.jsonl` on the PC VM (truth6 lines 255-292 s).

## 0. Result

**Symptom.** In the current default engine the only object that differs from truth in updates 21300-21560
(279.8-283.2 s) is P1 scout 2976 (master 448, auto scout). It reaches its explore point (89, 55) at update 21487
in both. The engine starts the next leg (to (109, 55), first waypoint (93.75, 53.75)) with its first step in
update **21490**; the original takes its first step in update **21493**. From then on the engine is exactly
3 updates ahead: truth at 282461/282682/282916/283137 ms equals the engine's position 3 updates earlier
**bit for bit** (`42b273d8/425bc303`, `42b2f723/425b7de6`, `42b38225/425b34b4`, `42b4056e/425aef93`).
Lumberjack 3848 no longer differs (cmp_pos: 1105 compared objects, 1 with a difference; cmp_held: none).

**Cause (confirmed).** 188329 changed when the Explore action (type 4) asks its unit AI for a new point.
158041 (the engine) posts notify 0x202 inside `set_state(3)`, in the update in which the walk's MoveTo ends.
188329's `set_state(3)` only shows the standing sprite; the notify is posted by the **next** action update
(state 3 branch of the update), which then sets `+0x44 = 1.0` and goes to state 2. State 2 counts `+0x44`
down by 0.1 per update and asks again when it is used up. So the question reaches the unit AI one update later.
The unit AI answers notifies only in its full update (every 3rd update here, after the action update of the same
update). When the MoveTo ends in an update that is the AI's turn, the engine is answered at once and the
original 3 updates later. That is this case (MoveTo done in 21488 = AI turn).

**Proof by numbers.** The truth's `ao +0x44` records the countdown: 1.0 on the leg to (69, 55), `0x3f666666`
(0.9) on the leg to (89, 55), `0x3f4ccccc` (0.8) on the leg to (109, 55), and the one truth sample taken while
waiting (282227 ms, update 21489) shows state 2, point (-1, -1, -1), `+0x44 = 1.0`, path state cleared.
`sim_p28.py` reproduces 0.9 / first step 20206 for the earlier leg (where engine and original agree) and
0.8 / first step 21493 for this leg from the engine's own MoveTo-done updates (20202, 21488) and AI turns.

## 1. Address table (188329)

| RVA | What |
|---|---|
| 0x3224d38 | Explore action vtable (truth `ao` qword 0 = `...F2614D38`); 17 slots |
| 0xb79060 | constructor: base 0xb66cf0, type word `+8 = 4`, `+0x48` task, point `+0x38/+0x3c/+0x40` |
| 0xb79140 | slot 0x28 (first): `point.x == -1.0` (0x31b6520) → `set_state(3)`, else `set_state(11)` |
| 0xb79170 | slot 0x80 `set_state`: sub-actions go (0xb89e60), `+0x18 = state`, jump table 0xb7938c |
| 0xb79331 | set_state 1, 3, 13, 14: unit slot 0x70 with master `+0x40` (standing sprite) **only** |
| 0xb791ad | set_state 2: the same sprite call, action slot 0x68(0) (0xb6ba50, target none), 0xb6b9b0(0), point = (-1, -1, -1) |
| 0xb79230 | set_state 11: new 0x70-byte MoveTo (0xb920a0, point, range 0, flag 1), quiet (0xb6b990), added (0xb89080); no memory → `set_state(13)` |
| 0xb793d0 | slot 0x30 update (chunks to 0xb79554) |
| 0xb79470 | update state 11: sub-actions update 0xb8ae30; codes 1, 2, 3, 5 → `set_state(3)`; 4 → slot 0x68(0), `set_state(11)`; returns 0 |
| 0xb794d0 | update state 3: unit slot 0x358(id, id, **0x202**, **0x25d**, 0, 0); `+0x44 = 1.0` (0xb79506); `set_state(2)`; returns 0 |
| 0xb7951b | update state 2: `if !(0.0 < +0x44) set_state(3)`; then always `+0x44 -= [0x3202890]` (0.1, `0x3dcccccd`); returns 0 |
| 0xb79406 | update state 13: unit slot 0x358(id, id, 0x1f9, 0xd25d10(unit AI), 0, 0); `set_state(2)`; returns 3 |
| 0xb7954c | update state 1: returns 1 |
| 0xb79560 | slot 0x48 (the point): x >= 0 and y >= 0 → store point, `set_state(11)`; else `set_state(3)` |

## 2. The original's logic for this case (steps)

1. Update D: the Explore (state 11) updates its MoveTo, which returns done (1) → `set_state(3)`: sub-actions
   dropped, standing sprite. No notify. (0xb79499, 0xb79331)
2. Update D+1: state 3 → notify 0x202 (value 605) to the unit's own AI, `+0x44 = 1.0`, `set_state(2)`
   (point = -1). (0xb794d0)
3. Updates D+2, D+3, ...: state 2 → `+0x44 -= 0.1` (f32). When `+0x44 <= 0` at the start of an update (after 10
   decrements: 1.0 − 10×0.1f = −7.45e-8, i.e. in the 11th state-2 update) → `set_state(3)`, and the next update
   posts the notify again. So an unanswered Explore asks every 12 updates. (0xb7951b)
4. The unit AI's full update handles the queued 0x202 (search, then slot 0x48 with the point) → `set_state(11)`
   → MoveTo. `+0x44` keeps the value it had (not reset), which is what the truth shows while walking.
5. Order inside one update, shown by the truth values: action update first, then the AI's full update
   (leg to (89, 55): notify in 20203, one decrement in 20204, answer in 20204 → 0.9).

This case: MoveTo done D = 21488 (place reached in 21487). Notify in 21489 (truth sample: state 2, 1.0).
AI turns are 21488, 21491, 21494 (the unit AI's look timer steps by 39 ms in these updates, truth `t178` 3666 at
21489 and 3900 at 21507 agree with the engine). Decrements in 21490 (0.9) and 21491 (0.8); the AI answers in 21491;
MoveTo plans in 21492; first step in 21493. Engine: notify in 21488, answered in 21488, first step 21490.

## 3. Confirmed difference and the engine change

**E1. The Explore's wait (new switch `GENIE_EXPERIMENT_EXPLORE_WAIT_188329`).**

188329 read: 0xb79331 (set_state 3 has no notify), 0xb794d0..0xb79513 (state 3 update posts it, timer, state 2),
0xb7951b..0xb7953f (state 2 countdown and re-ask), 0xb791ad..0xb7921e (set_state 2).

Engine read: `movement/explore.rs:151` `set_state`: line 167 `ExploreState::Wait => Owner::WantsPoint`;
`explore_owner` (643) line 656 posts `NotifyKind::REQUIRES_SEARCH` with `[AiAction::Explore.value(), 0, 0]` at once;
line 163-166 `Stopped` → point −1 and `Owner::Stopped`, which `explore_owner` (651) rejects as unsupported;
`update` (240) lines 249-258: only `Walk` does anything, `_ => Ok(())` (state 3 waits, no state 2 logic);
`after_walk` (212) line 218 codes 1|2|3|5 → `set_state(Wait)`; `take_point` (192) and `new` (125) likewise.
Engine trace `P28_2`: action_state 3 in updates 20202-20203, back to 11 in 20204; `P28_1`: no state 3 visible at
21488 (posted and answered in the same update).

Change (all in `movement/explore.rs` unless noted; switch helper as in `unit_ai/idle_animals.rs:34-37`,
e.g. `fn explore_wait_188329() -> bool`):

1. `ExploreAction` (81): add `pub wait: f32` (`+0x44`), 0.0 in `new` and in every other constructor of the struct
   (`tools/genie-oracle/src/top_actions.rs:517` import: 0.0, or the saved `+0x44` if the source has it).
2. `set_state` (151), under the switch:
   - `ExploreState::Wait => Owner::Standing` (sprite only, no notify);
   - `ExploreState::Stopped => { self.point = Position::from([-1.0; 3]); Owner::Standing }` (the action has no
     target objects; the two "target none" calls do nothing here).
3. `update` (240), under the switch, two new arms before `_ => Ok(())`:
   ```rust
   ExploreState::Wait => {
       explorer.post_own(&mut c.w.parts.unit_ai, NotifyKind::REQUIRES_SEARCH,
                         [AiAction::Explore.value(), 0, 0])?;
       self.wait = 1.0;
       let owner = self.set_state(ExploreState::Stopped, None, &c.w.model.tuning.move_to)?;
       explorer.explore_owner(owner, c)
   }
   ExploreState::Stopped => {
       let mut r = Ok(());
       if !(0.0 < self.wait) {
           let owner = self.set_state(ExploreState::Wait, None, &c.w.model.tuning.move_to)?;
           r = explorer.explore_owner(owner, c);
       }
       self.wait -= f32::from_bits(0x3dcc_cccd);
       r
   }
   ```
   (Without the switch `Stopped` stays as it is.) `explore_to` (577) → `take_point` → `set_state(Walk)` works
   from `Stopped` unchanged; `wait` is not reset there.
4. `tools/genie-oracle/src/top_actions.rs:512`: accept `ExploreState::Stopped` under the switch.
5. Nothing else reads the difference: slot 0x2d0 (`objects/unit/top.rs:164-165`) already treats states 2 and 3 of a
   non-Attack as interruptible.

Expected after the change: 2976 matches through 283.2 s (bit-exact by the 3-update shift above); P1 word 7 at the
checkpoint after 21499 syncs (world 282357 ms; record 412875, engine 412879 in `IMP_r1_097` and `P28_1`) should then
agree; not run (no build allowed).

## 4. Suspected / open

1. The standing-sprite call runs once more in 188329 (set_state 3 at D, set_state 2 at D+1, same sprite). The engine's
   `explore_owner` calls `new_sprite` with the `Stream::Sprite` stream; that this stream is not read by anything
   compared against truth was not checked. If it matters, the call count per wait is 2 in 188329 (3 with a re-ask).
2. Unit slot 0x70 with master `+0x40` was taken as the standing-sprite call (158041: slot 0x68 with master `+0x470`)
   from its position in the code, not read.
3. "The AI answers 0x202 only in its full update, after the action update" is shown by the truth numbers and the
   engine's matching behaviour, not read in 188329 (0xd42a00 was not re-read for this).
4. `+0x44`'s start value (constructor does not write it; base 0xb66cf0 zeroes `+0x38` as a qword only) matters only
   for state 2 reached from state 13 (failed Explore), which the engine does not model.

## 5. Not read

0xb8ae30 (sub-action list update, taken as 158041's), 0xb920a0 (MoveTo constructor), 0xb89e60/0xb89080, the
unit AI's 0x202 handler in 188329 (the search itself; the point chosen equals the engine's here), the Explore
vtable's slots 2, 4 (save/load: whether `+0x44` is saved).

## 6. Other situations this changes

Every Explore action (type 4): auto scout (0x2bd), explore (605), explore-and-destroy, scout orders, and computer
players' explorers.
- Each wait for a point starts one update later; the visible delay is 3 updates only when the MoveTo ends in the
  unit AI's turn update, else 0 (two of three arrivals unchanged, as legs to (69, 55) and (89, 55) here).
- A newly made Explore without a point (`new` with x = −1, `take_point` with a negative point) asks in its first
  update, not when made.
- **An Explore that gets no point asks again every 12 updates** (158041: once). Each ask runs the unit AI's search
  again, which draws from the AI stream (`closest_undiscovered` slack draw, `beyond_sight` shuffle) and can make the
  scout map; so auto scouts with nothing left to explore change the AI stream's draw count over time. Worth
  checking against `airng` in truth when a scout stands idle with the auto-scout order.
- OBJECT traces show action_state 2 while an Explore waits (was 3).
