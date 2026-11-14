# Player attribute 204: a flare at the other players' buildings of a kind (session E12, 2026-11-14)

Build 188329, RVAs (image base 0x140000000). Decompiles were made in the cloud container
(`re/out_E12/a.c`, `b.c`) and are not kept; what was read is below.

## 1. Addresses

| what | address | engine |
|---|---|---|
| World pass over the kinds the players' attribute 204 names | 0x15fec80 | `players/diplomacy.rs` `World::reveal_units` |
| Same test for one object at its creation (called from the object setup 0x1264680, unit vtable slot 171, and from 0x125cb40) | 0x1247920 | not modelled (see 4) |
| Builder's work on a building; calls the pass after `set_state(2)` (slot 0xa8) | 0x1284670 (call at 0x1284b3e) | `construction/build/world_side.rs` (after `set_state`) |
| Diplomacy change; calls the pass at its end | 0x170ca30 (call at 0x170cb1f) | `World::set_diplomacy` |
| World load (world vtable 0x32e8948 slot 7); calls the pass once | 0x160bfc0 (call at 0x160fd7a) | not modelled |
| Player slot 0x1c8: make an object of a master at a place (the same function makes the hit flare 112, call at 0x12bbd81) | 0x16fd190 | `World::remains` + `World::made_new_object` |
| Set relation byte (`player+0x180[other]`) and unit kind (`+0x198`) | 0x17486e0 | `World::set_stance` |
| Mark test / set (`object+0x2d8`, bit per player) | 0x12473d0 / 0x12476b0 | `World::reveal_marks` |
| Marks cleared (`+0x2d8` bit, `+0x2dc` bit and bit 31) | 0x1247170, 0x1247190 | same |
| Second mark (`+0x2dc`) and slot 0x1e8, for a negative value | 0x12478d0 | not modelled (stop) |
| abs / sort of the kind (below 900: 0, 900 to 999: 1, 1000 up: 2) | 0xa82800 / 0x10baf30 | inline |

Player layout used here: attribute count `+0x90`, attributes `+0x98` (8 bytes each, obfuscated
float; 204 at `+0x660`), object list `+0x30` (array `+8`, count `+0x10`), relation bytes `+0x180`,
own number `+0x648`. World: players `+0x770`..`+0x778` (16 bytes each). Master: type `+0x08`, id
`+0x18`, class `+0x38`, a cache of the creation test `+0x1d4`.

## 2. The DAT side

Only one effect writes attribute 204: effect 1386 "C-Bonus, Mapuche Vision" (set, 82 = the castle
master). Master 697 is FLARE4: type 10, no hit points, attribute 12 = 10 running down by 1 per
second.

## 3. The world pass (0x15fec80)

Not in the editor's mode (4). For each player a of the world's list (Gaia first) with more than 204
attributes: k = attribute 204 cut to an integer; n = |k|; n = 0 does nothing. Sort of n: below 900 a
master id, 900 to 999 the class n - 900, 1000 and up a master id. For each other player b in the
list's order:

1. If `a.relation[b] == 0` and `b.relation[a] == 0`: every object of b loses a's marks.
2. Else each object of b's list, in order, that (is of that master id (`+0x18`) or class (`+0x38`))
   and (is no building, or is a building with build points `+0x900` not 0 and state 2) and has not
   a's mark: with k below 1 the second mark is set (0x12478d0) and, if the object's slot 0x198
   gives 0, 0x12420b0(object, player a, 0) runs; with k above 0 player a's slot 0x1c8 makes master
   0x2b9 (697) at the object's x, y, z with flag 0. Then a's mark is set (0x12476b0).

## 4. The test at an object's creation (0x1247920)

Runs only while the object's master cache `+0x1d4` is not 1. For the first player (not the owner,
relation byte not 0 either way) whose k is not 0: with the cache 0, an object that is not of the
kind, or is a building with build points 0 or not in state 2, or is marked already, sets the cache
to 1 and ends; else the cache becomes 2. With the cache 2: k above 0 makes the flare and sets the
mark; else the second mark and slot 0x1e8. A building starts as a foundation, so its master's cache
becomes 1 at its first creation and the test never acts for it; the engine does not model this
function and stops when the kind names objects that are no buildings.

## 5. Engine change

`World::reveal_units` follows section 3 for k above 0 (marks in `World::reveal_marks`, a map by
object id). k below 0 and a kind of objects that are no buildings stop the run. The builder's work
calls it after the completion; `complete_building` no longer stops. A building that completes by
itself (`construction/building_update.rs`) still stops when some player's attribute 204 is not 0:
that path's original was not read.

## 6. Not read

The tail of 0x16fd190 (a master's flag `+0x121`: each player that sees the tile gets 0x1355030 on
its `+0x220`); 0x12420b0; slot 0x1e8; the callers 0x1664f80 and 0x181d490 (they clear and set the
marks themselves); who resets the master cache `+0x1d4`; whether the marks are saved.

## 7. Farm bonus near a master (read in part, not implemented)

0x127e5a0(farm, resource, master, amount): gives the amount (player slot 0xf8 with 1, 1) when
(master < 0, or the player has not that master (0x1728c10), or 0x128b590(farm, master) holds) and
0 <= resource <= the player's attribute count; returns whether it gave. Callers: the completion
part 0x127ea40 (at 0x127ee33) and 0x1283010 (attribute 237 / attribute 36 x an amount). 0x128b590
(0xb7e bytes) is a flood fill over tiles from the farm's tile, asking 0x127dd40(farm, x, y, master)
per tile; not read to its end.
