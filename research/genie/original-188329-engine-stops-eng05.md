# ENG-05 - the four engine stops of the newest replays (original build 188329 vs genie default)

Session E5, 2026-11-13. Binary `AoE2DE_s_unpacked.exe`, all addresses RVA. Engine paths relative to
`genie/crates/engine/genie-core/src/`. "asm" = read in capstone disassembly (`dz.py`); "dec" = Ghidra
decompile. Evidence on the PC: `re-kit\re\out_E5\` (`w1.c` wall command, `w2.c` placement test; lists
`l1.txt`..`l3.txt`), older `re\out_c\h1.c` (Hunt update), `re\out_u1\h2.c` (unit AI notify handler).
Runs: `runs\E5_*` (traces), `runs\E5c_*` (the eleven replays with the three changes), base `runs\M6f_*`.

Three of the four stops replace an error by behaviour the old build's doc comments already describe and
188329 has unchanged; none needs an environment switch. The fourth (520592057) is not a missing branch.

## 1. Address table (new in this session)

| Role | 188329 RVA | Engine |
|---|---|---|
| High-id command dispatch (`cmd[0]` 0x64..0xc4; byte table 0xf63090, jump table 0xf62ff0) | 0xf601e0 | `commands/mod.rs` |
| id 0x66 BUILD: case 0xf60360, handler | 0xf63100 | `commands/build.rs` |
| id 0x69 BUILD_WALL: case 0xf60488 (builders' owner check), handler | 0xf63360 | `commands/wall.rs` `BuildWallCommand::run` |
| Player's wall line (old `FUN_140e7b2e0`) | 0x16e9600 | `World::build_wall` |
| its pre-check: master `+0x90` (available) set -> go on; else only two master ids pass a count test, any other ends the command | 0x16dccb0 | not held ("the population test of a master without `+0x5f0`") |
| its capable builders (at most 60, 500 for a computer; `0x131f8e0(master, builder id)`) | 0x16d9240 | `World::builds` |
| Segment walk (old `FUN_140e7f670`): snap (master slot 0x60), placement test (slot 0x50), payment test 0x16ffc90, foundation (slot 0x110) | 0x1700270 | `World::wall_foundations` |
| builders shared out (old last loop) | 0x16d72f0 | `share`, `wall_builder_takes` |
| Building master vtable | 0x32b8f60 | |
| its slot 0x50, the placement test (old `FUN_14123aee0`) | 0x12f5200 | `production/spawn/placement_test.rs` `build_placement` |
| its slot 0x60 (snap with 1) / slot 0x110 (new foundation -> 0x126d730) | 0x12f51f0 / 0x12f74e0 | `wall::snap` / `World::found` |
| Combat master's slot 0x50 (old `FUN_141264db0`), static test (old `FUN_141123f80`) | 0x1321db0, 0x11e2c80 | `build_static_test`, `static_scans_find` |
| Master snap (old `FUN_141123ac0`), shared by the master vtables 0x32a8aa8.. | 0x11e29a0 | `wall::snap` |
| The walk (moving update); its hit loop posts notify 0x215 at 0x1214f35..0x121503a | 0x1210f60 | `movement/walk.rs` `Mover::go_round` |
| master id of an object's master (compared for 0x215) | 0x1218170 | |
| Enable command (old `FUN_1416665b0`) | 0x1735840 | `technology/effect/completion.rs` `enable_master` |
| options sub-mode flags getter (`[rcx+0x7c]`), setter (mask, clear) | 0x13f6370, 0x13f6380 | `Settings::sub_game_mode_flag` |
| Hunt vtable 0x32274b8: slot 0x30 update (its `set_state` is slot 0x80, address not looked up) | 0xbb6230 | `gathering/hunt/` |
| "the site's master takes this unit's load" | 0x10ba220 | `drops_at` |

## 2. 520596921 P2, update 17,092 (420.8 s): "a walk's unit in the way (notify 0x215) the action does not pass on"

Facts (trace `E5_f1`): P2 scout 9481 (master 448) gets `Follow(9912)` at update 17,017; 9912 is a Gaia
animal of master 2597 standing at (54.036, 5.382). The scout's own MoveTo to the object walks from
(55.802, 1.052); at update 17,092, at (55.029, 3.291), its walk meets 9913, another Gaia animal of master
2597 that is moving at (55.267, 3.870). P2 has no checkpoint mismatch before the stop (34 hold).

Original (asm 0x1214f35..0x121503a, inside the walk 0x1210f60; `rsi` walker, `r14` the hit):
1. `0x1732ca0(hit.owner, walker.owner, 1)` or `0x1732ca0(walker.owner, hit.owner, 1)` true: skip.
2. `walker[+0x1f0]` (its unit AI) null: skip.
3. The walked level's target (`[[walker+0x3f0]+0x30]`, looked up by 0x1616cf0) null: skip.
4. `0x1218170(hit's master) != 0x1218170(target's master)`: skip.
5. Else `unitAI.vt[0x38](unitAI, walker.id, walker.id, 0x215, hit.id, -1, -1)`.

So the walk posts the notify to the walker's unit AI itself, whatever action owns the walk. The handler's
case 0x215 (dec `out_u1/h2.c`, the block after case 0x20b): a master 0x10bb6b0 does not hold for, the hit
found in the world, `ai+0x1de == 0` (retargeting on), `ai+0x1b1 == 0` (stance), and (`ai+0x3c == -1`, no
order, **or** the hit's `+0x210 != -1`) -> `ai.vt[0xb8](ai, hit.id, 1, 0)` (attack). The scout has the
Follow order and a Gaia animal has no group, so nothing happens here.

Engine: `movement/unit.rs` `Unit::move_to_part` (the unit's own MoveTo) now calls
`Unit::post_in_the_way` right after its step (`own_move_step`, which runs the walk), before the notifies
the update posts after it. The other walking actions already did (`gathering/hunt/walks.rs`,
`gathering/gather/update.rs`, `combat/attack/walks.rs`, `garrison/transport/action.rs`,
`ownership/artifact.rs`). First try, wrong: posting before `own_move_held` did nothing, because the list
is filled inside `own_move_step` (run `E5a_*` = byte-for-byte the old stops).

Not put in: the handler's second way to attack (the hit has a group, `+0x210 != -1`) - the engine's
`unit_ai/attacked.rs` `in_the_way` only knows "no order". The group member's own step
(`groups/update/moves.rs:568`) still stops with the same message.

## 3. 520386901 P1, update 64,083 (834 s): "the enabling of master 0x26d (the game's mode)"

Original (asm 0x1735840, the whole function): the master of that id null or its id not the argument's:
return. With `enable == 1` and id 0x26d: the options' `+0x34 == 0xb` (game mode 11), or
`0x13f6370(options + 0x18) & 2`, i.e. bit 1 of the dword at options `+0x94`: return without enabling.
Otherwise it goes on exactly as for any master (one building: 0x127e890 / 0x127e8e0; else the master's
slot 0x58, then for an enabled, available master of a player other than Gaia 0x11df460).
The three bits 1, 2, 4 of that dword are set together from three option bytes (0xe7a6b3..0xe7a6fc).

Engine: the flag was already held - `Settings::sudden_death()` is "game mode 11 or sub-mode bit 1"
(`genie-model/src/world/settings.rs`, loaded from the save's `sub_game_mode_flag` in
`genie-oracle/src/setup.rs`). `enable_master` now returns early under `sudden_death()` and otherwise
enables the master; the error is gone. Test `the_enable_command_sets_available_unless_disabled` extended
but not run: the crate's test target has not compiled since before this session (`groups/layout.rs`
tests, `FormationLine` without `spacing_half`; the only two errors).

Not looked at: which technology enables master 0x26d at 834 s (an age-up, suspected).

## 4. 520397411 P2, update 37,997 (496 s): "a drop site that does not take the load (set_state 2)"

Facts (trace `E5_d1`): P2 unit 10265, master 293, Hunt action in state 8 (the drop-off walk) with 10.0
held, at (64.70, 41.17). P2 differs from the recording since 119.4 s, so the situation itself may not
exist in the original game.

Original (dec `out_c/h1.c`, Hunt update 0xbb6230, state 8, timer not below 0, the MoveTo's update
returned 1 or 2): drop site (`+0x28`) null -> another label (not read). `0x10ba220(site's master id,
unit) == 0` -> **`set_state(2)`** (`vt[0x80](action, 2)`), nothing else. Non-zero: distance
(0x124daf0) above 1.0 -> timer -3.0 and the animation stops; else the load goes to the player.

Engine: `gathering/hunt/drop_off.rs` `HuntAction::update_drop` returns `Dropped::Idle` for a site that
does not take the load; `gathering/hunt/hunter.rs` `Unit::hunt_drop_walk` does `set_state(2)` as the walk
to a point's end does (`HuntAction::set_done`, `hunt_stand`, `hunt_release` of the target and the drop
site). The unit keeps its load.

Not read: what `set_state(2)` (the Hunt's slot 0x80, case 2) does beyond what the engine's `set_done` holds, in this
build; the label for a drop site gone in state 8.

## 5. 520592057 P2, update 51,417 (665 s): "a builder with no task for its foundation" - not a missing branch

Not fixed. The stop is the end of a chain that starts 85 s earlier.

1. Update 51,417: `Build` P2, house (70) at (80, 77), builders [4815, 4820]. Later commands use the same
   two as villagers (houses, a blacksmith, a market).
2. Object ids are shifted by one from 645.7 s on. Checkpoint words 2 (masters), 6 (count), 10 (ids),
   deltas between checkpoints 48,999 and 49,499: recording P1 +1 object, id sum +4818, masters +71;
   engine +2 objects, id sum +9636 (= 4817 + 4819), masters +143. Afterwards every new object is one
   higher in the engine (P1 4821 / 4822; P2 4819 + 4820 / 4820 + 4821, masters 311 = 93 + 218; ...).
   So the recording's 4820 is a villager (218) and the engine's 4820 is the unit born just before it (93).
3. The extra object is a palisade wall (master 72). P1 commands (trace `E5_w1`): 49,151 `BuildWall`
   tile (17, 52), builder 4774; 49,245 `Move` to (16.40, 52.56); 49,292 `BuildWall` tile (16, 52), same
   builder. Engine: both walls are founded (4817 at (17.5, 52.5), 4819 at (16.5, 52.5); id 4818 goes to
   an object the trace does not list). Recording: only the second one exists - P1's `Interact` at
   update 49,745 names target 4818 at (16.5, 52.5).
4. The first wall command did nothing in the recording: P2's `Interact` on 4774 at update 49,230 carries
   the point (17.011375, 52.580853) (an Interact's point is the target's place: P2's later Interact on
   4734 carries the engine's place of 4734 to six digits). That point lies on 4774's Move line of
   update 49,073 (to (15.906, 52.615); the line through the engine's (18.1133, 52.5473) and
   (17.5935, 52.5631) gives y = 52.5808 at x = 17.0114). In the engine 4774 turned back east at 49,151
   to build the first wall, and is at (18.3, 52.51) then.
5. Why the original refuses tile (17, 52) at 49,151: read, not found. The wall command's chain
   (0xf63360 -> 0x16e9600 -> 0x1700270) and the building master's placement test (0x12f5200) are the
   engine's: the wall's test call differs from BUILD's only in `p10` (1 here), which the test passes on
   as 0 for a class that is not 51 or 54; a moving-kind, alive unit with speed above 0 of the player, of
   Gaia or of a mutual ally passes; any other alive unit whose box overlaps the clearance box refuses
   (code 6). Own villagers 4734 (standing, building the house at (17, 51)) and 4774 are on the tile in
   the engine and pass. **Suspected, not shown:** one of P2's three militia (4796, 4803, 4804, masters
   74), which chase 4774, stood within 0.7 of the tile's centre in the recording. In the engine they are
   at x = 20.8 then (3.3 tiles east). P2's word 7 (positions) is off since 580.7 s, by +703 at 639.2 s
   and +373 at 645.7 s (engine minus recording; a wall at (17.5, 52.5) adds 7,000 to P1's word 7, so the
   unit is about 1/100 tile of x + y) - the sign fits militia that are farther west in the recording.
6. P2's first mismatch (580.7 s, checkpoint 44,499, word 7 only, +132): the only P2 event in that
   checkpoint interval (trace `E5_w2`, updates 43,990..44,499) is at update 44,474: sheep 4092 runs out
   under six shepherds (3850, 3854, 4722, 4724, 4740, 4753) that hold a queued `Interact` on tree 2079 at
   (97.5, 89.5) since update 42,980. Engine: at 44,476 four of them (3850, 4724, 4740, 4753; held 8.75
   to 8.85) become lumberjacks with held 0 and start walking, two (3854, 4722; held 7.52, 6.86) stay
   shepherds in state 8 and walk toward the town centre (89, 76). Words 2, 4, 9 match the recording at
   44,499, so the master changes and the lost loads are the recording's too; only the places differ.

Site effect: the "verified" span of this game (10:39) ends at P1's word 1 at 645.7 s, which is the 3
wood of the extra wall. Removing the stop would not move it.

Next first action: a truth capture of replay 520592057 around 575..590 s (CONTINUE 8 / 12.6), or reading
what a Hunt whose target ran out does with a queued order (the unit AI's next order after notify from
state 8 / set_state), then comparing the six shepherds' first 25 updates.
