# Case P23: replay 518239882, player 2, checkpoint word 9 at 398.8 s (engine 34575, record 34580)

Runs made: `P23_1` (updates 16490-17010, all objects). Engine not changed, nothing built.
All 188329 addresses are RVAs in `AoE2DE_s_unpacked.exe`.

## Symptom (one sentence)

Five player-2 villagers (3426, 4349, 4368, 4376 from updates 16803-16810 = 393.3-393.5 s, and 4343
from update 16937 = 397.0 s) whose boar carcass 4017 ran out stand with a Hunt action (type 110) in
**state 2** in the engine, while 188329 leaves such a hunt in **state 3** (search, re-notify every
10 s): 5 units x (+1) = the +5 of word 9 at the checkpoint after 16999 syncs (398 778 ms).

What word 9 is: `genie-core/src/world/checkpoint.rs:103-112` `action_checksum` = top action type
(-1 without) + action state byte + unit-AI retarget timer, summed over the player's live objects
(a building uses its production action's state, `genie-oracle/src/header_runs.rs:167-180`).
Record minus engine = +5 (the note "(9, 34575, 34580)" is (word, engine, record)).

## Numbers

- Last matching P2 checkpoint: syncs 16499, 384 778 ms. First differing: syncs 16999, 398 778 ms
  (rec 34580, eng 34575; every other word equal). Next one (17499, 412 778 ms) matches again.
- `P23_1` vs truth4 over 384 526-399 086 ms (66 common samples, all players, all listed objects):
  master, state, held (bits), x, y (bits), `ai+0x1d4` (retarget), `ai+0x178` (look), `ai+0x17c`
  (limit): **no difference at all** (the only non-zero `ai+0x174` is P1 4403, not in the engine line).
  So the +5 is in a field truth4 does not hold: action type or action state.
- Engine word 9 recomputed from the OBJECT lines at tick 16999: 32 objects, sum 34575 (formula checked).
- Engine at tick 16999, P2: 3426, 4349, 4368, 4376, 4343 = Hunt (110) state 2, target none, held 0,
  standing at (85.79,69.87) (85.82,69.47) (86.00,70.14) (86.19,69.74) (86.40,70.14). All other P2
  objects are in steady states (Hunt 7, Gather 7, sheep 107 state 10, buildings none) whose timing is
  pinned by held/position in the truth.
- History of the five (engine, positions and held equal to the truth throughout): gather 4017 (state 7)
  -> 16735/16736 state 8, load dropped at the town centre next to them -> state 11 (walk to the hunt's
  point, target none) -> state 2 at 16803 (3426), 16806 (4376), 16807 (4349), 16810 (4368), 16937 (4343).
- Truth: the five do not move from 391.5 s until they enter the town centre at about 407.9 s
  (sample 408 046: position (87,70)) and come out as master 123/218 (409.4 s). After that they have new
  actions, which is why word 9 matches again at 412.8 s.

## (1) Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Hunt update (slot 6) | 0xbb6230..0xbb7f48 (`out_c/h1.c`) | `gathering/hunt/hunter.rs` `hunt_part` |
| Hunt update, states 11/15, sub-action list code 1/2/5 | 0xbb65b0: `cmp byte [rdi+0x18],0xb ; je 0xbb7e86` | `hunter.rs` `hunt_point_walk` (`PointWalk::Search`) |
| `set_state(3)` call | 0xbb7e86: `mov dl,3 ; call [rax+0x80]` | `hunt/unit.rs:78` `hunt_search_state` |
| Hunt set_state (slot 16) | 0xbb4a80..0xbb61a4, jump table 0xbb6168 | - |
| set_state case 3 | 0xbb4aec (table entry 3) .. timer write `0xc1200000` (-10.0) | `hunt/unit.rs:78-104` |
| set_state case 2 | 0xbb4d17 | `hunt/start.rs:558` `set_done` |
| Hunt update state 2 | 0xbb7e7c: `cmp dword [rdi+0x68],0xf ; jne out ; set_state(3)` | `hunter.rs` `Action::hunt_idle` |
| Hunt update state 3 (timer += dt; at 0: timer = -10, notify 0x202) | `h1.c` 98-150 | `hunter.rs` `hunt_search_wait` |
| After-drop exit for class 10 | 0xbb7e49: point (+0x38,+0x3c) != -1 -> 0xbb66c1 `set_state(11)`, else 0xbb7e69 `set_state(2)` | `hunt/unit.rs` `hunt_found_nothing` |
| Villager AI notify handler, cases 0x1fb/0x1fc/0x202 | 0xd004a0..0xd030bb (`out_k/k7.c` 146-650) | `unit_ai/flight.rs:370` `villager_search`, `unit_ai/update.rs:397` `hunter_search` |
| Villager AI slot 0x1b0 (class -> kind) | 0xcf9c60, byte table 0xcf9cb8, targets 0xcf9c9c: class 10 -> 0xcf9c95 `mov al,5` | `unit_ai/cared.rs:77` `civilian_kind` (None for class 10) |
| Handler end for a human that found nothing | 0xd01b1f: `cmp dword [r12+8],0x202 ; je out` | `update.rs:506-512` |

## (2) The original's logic (188329)

1. State 8 (drop-off) with no target left, human player, no queued orders: class from the AI
   (`0xd25d50`) else the hunt's `+0x68`; kind = slot 0x1b0 (5 for class 10); slot 0x80 search by kind;
   nothing found -> 0xbb7e49: the hunt's point is set -> `set_state(11)` (walk to the point).
2. State 11, sub-action list (0xb8ae30) answers 1, 2 or 5: 0xbb65b0 tests only the state byte and jumps
   to 0xbb7e86 = `set_state(3)`. No class test.
3. `set_state(3)` (0xbb4aec): clears the sub-actions (0xb89e60, common head), writes the state byte,
   sends notify 0x202 to the unit (slot 0x358) with (0x265, hunt `+0x68`, drop site id: the second
   target's, else the closest site from 0x1229bb0, 0 and class := -1 when none, -1 for a master
   without drop sites), sets the standing sprite (unit slot 0x70 with 0xbb37f0), timer = -10.0.
   There is no class-10 branch and no `set_state(2)` in this case.
4. The villager AI gets 0x202 with its action 0x265 (0xd004a0 case 0x202): class = notify p[1], else
   `ai+0x4c`, else `ai+0x70`; kind = slot 0x1b0 = 5; `slot 0x80(ai, 5, notify drop site, -1; 0, 2,
   -1.0, -1.0)`. Found -> slot 200 (hunt it). Not found and the player is human -> 0xd01b1f, which for
   0x202 does nothing: the hunt stays, in state 3.
5. State 3 update: the timer runs up by dt; at 0 it is set to -10.0 again and the notify is sent
   again. So every 10 s the villager searches again (first at entry: ~393.3 s, then ~403.3 s here).

## (3) Confirmed difference

**D1. A class-10 (boar) hunt that reaches `set_state(3)` goes to state 2 in the engine, stays in
state 3 with a notify in 188329.**

- 188329: steps 2-3 above (0xbb65b0, 0xbb7e86, jump table 0xbb6168 entry 3 = 0xbb4aec; the case body
  read in `out_c/setstate.txt` 27-81 and in disassembly from 0xbb4aec: it starts with the second-target
  test `mov r8,[rsi+0x28]`, no read of `+0x68` against 10).
- Engine: `gathering/hunt/unit.rs:86-100` (`hunt_search_state`): for a hunt whose target class has
  `ClassRoles::PREDATOR`, a human player's hunt does `set_done()` (state 2, target and drop site let
  go, no notify) and returns. Not behind any switch. The trace `P23_1` shows exactly this: state 11 ->
  state 2 for 3426/4376/4349/4368/4343.
- Second half (needed once D1 is in): `unit_ai/update.rs:414` `hunter_search` takes
  `civilian_kind(class, roles)`, which is None for class 10, and would then run `ClosestObject` for
  class 10 (a live boar) and hunt it. 188329 uses kind 5 (0xcf9c95) and slot 0x80 from the notify's
  drop site. The same substitution already exists for the after-drop search at
  `gathering/hunt/unit.rs:427-433`.

This is item "N2: set_state(3) has no class-10 exception (timer -10.0)" of
`original-188329-reading-round2.md` line 30 and the "only happens once N2 is implemented" note in
`original-188329-boar-kind-case-335s.md`; this replay is its first case.

### Exact engine change (existing switch `GENIE_EXPERIMENT_HUNT_188329`)

1. `gathering/hunt/unit.rs`, `hunt_search_state` (line 86): take the PREDATOR branch only without the
   switch.
   ```rust
   let n2 = std::env::var_os("GENIE_EXPERIMENT_HUNT_188329").is_some();
   if !n2
       && roles.of_some_class(hunt.target_class).contains(ClassRoles::PREDATOR)
   { /* old build: set_done / computer error, unchanged */ }
   hunt.timer = SEARCH_AGAIN;            // -10 s
   self.hunt_search_notify(actions, c)?; // 0x202 (0x265, class, drop site)
   self.hunt_stand(c, &task)
   ```
   The state must be `HuntState::Search` (3) on return; the callers set it (`hunt_point_walk` via
   `PointWalk::Search`: `hunt/start.rs:546-548` stores `HuntState::Search` before returning;
   `hunt_part`'s Lead arm sets it itself). State 3's update `hunt_search_wait` then runs the -10 s timer.
2. `unit_ai/update.rs`, `hunter_search` (line 414):
   ```rust
   let mut kind = civilian_kind(class, roles);
   if kind.is_none()
       && std::env::var_os("GENIE_EXPERIMENT_HUNT_188329").is_some()
       && class.get() == 10
   { kind = Some(GatherGroup::from(5_u8)); }   // 0xcf9c60 -> 0xcf9c95
   ```
   The existing `Some(kind)` arm (slot 0x80 from the notify's drop site `n.p[2]`, no worker cap for
   kind != 0) and the existing "human found nothing -> GO_ON" (`update.rs:506-512`) are then what
   188329 does.

Expected result: P2 word 9 at 16999 becomes 34580; positions unchanged up to there (the search finds
nothing in the original: the five stand still until 407.9 s).

## (4) Suspected (not proven)

- That the +5 is these five units x 1 and not one unit x 5. Truth4 has no action fields, so the
  original's state byte was not observed. Support: all truth-visible fields of all objects match
  over the whole window; the five are the only P2 units in a state the original's code cannot produce
  on this path; they are re-tasked before the next checkpoint, which matches again.
- That the engine's kind-5 search from the drop site finds nothing at 393.3 s and 403.3 s (as the
  original evidently did). The after-drop search (no site) found nothing in the engine; the search
  with the town centre as origin was not run.
- Possible link to P2's later differences (resources 466.4 s, word 7 469.1 s): any boar hunter left
  idle would, in 188329, pick up a dead class-10 carcass with food every 10 s; the engine's state 2
  never searches. Not examined.

## (5) Not read

- 0xd22c20 / slot 0x80 internals for this call (argument meaning of `0, 2, -1.0, -1.0`).
- Slot 200 (hunt object) in the found case; the computer-player branch (0xd303e0 ...).
- The old build (158041): the engine doc says its `set_state(3)` had the class-10 exit; not checked.
- `hunt_set_search` (`hunt/unit.rs:51-72`, target kept for class 10) against 188329 state 6/10 callers.
- Engine not run with the change (no build allowed).

## (6) Other situations the change affects

- Every human boar hunt (class 10) that ends its walk to the point (state 11), a lead without target
  (state 10 -> 3) or a face that fails (state 6 -> 3): word 9 is +1 per such idle villager from then on,
  and each one sends 0x202 at entry and every 10 s, running a kind-5 resource search from its drop
  site; a dead boar with food in reach is then taken (villager walks) where the engine idled.
- `hunter_search` change only fires for notify class 10 with the AI action Hunt.
- State 2 is still reached by 0xbb7e69 (after-drop, no point), by state 15's end and by state 1 of a
  human player.
