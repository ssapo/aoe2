# K1: master change at 560.755 s (replay 518470161, P1 palisade gate 10486, master 793 -> 794)

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/`. Decompile: PC `re-kit/re-focused-cases-k.tar.gz` (`out_k/k1.c`..`k3.c`).

**Result.** The engine stop "a master change that changes the damage sprites (FUN_1411859a0)" was not a
visual-only case. 188329 keeps the hit points a float when the master changes; the engine made them whole
(`hp as i32 as i16`), which moved the damage share 48 -> 49 and tripped the stop. The damage sprite check itself
(0x12429c0, `CheckDamageSprites`) uses game RNG and writes game state, so it cannot be skipped as a whole; when the
selected entry stays the same it does nothing but write the share byte.

## 1. Address table

| Role | 188329 RVA | Engine |
|---|---|---|
| Master change, unit vtable 0x32a4698 slot 0x98 (action layer: empties the action list `+0x420`) | 0x1140570 (tail jump to 0x1226150) | `orders/actions.rs` `change_master` |
| Master change, moving layer (facet `+0xe`) | 0x1226150 (calls 0x1266b90 first) | - |
| Master change, static layer: storage, hit points, sight, place, sprite | **0x1266b90** | `orders/actions.rs` `switch_master` |
| hp read / write (`+0x130`) | 0x1266bd7 / 0x1266d3d (the only ones in 0x1266b90, 0x1226150, 0x1140570, 0x115beb0, 0x12ddd00, 0x12ba8c0) | `unit.life.hp` |
| share and clamp | 0x1266ccc..0x1266cf6: `divss`, `mulss`, `comiss 1.0`, `comiss new max`; no `cvttss2si` | `switch_master` |
| Combat layer / building layer master change | 0x115beb0 (calls 0x1140570), 0x12ddd00 (calls 0x115beb0) | - |
| CheckDamageSprites | **0x12429c0** (chunks to 0x124349b) | `technology/upgrade/damage.rs` `damage_sprites` |
| its callers | 0x1266e97, 0x1266f19 (master change, state 2); 0x1248b56 (object update 0x12488e0, state 2, every update); 0x124906f (state 3, storage-share objects); 0x12438e3, 0x1243be2 (0x1243520, not read) | only `technology/upgrade.rs` `damage_sprites_at` |
| Object-stream draws | 0x1242fa8 and the next call of 0x905170 with state 0x144354d90, name string 0x32b3a58 "CheckDamageSprites", lines 0x10b0 / 0x10b4 | `object.rand15()` twice |

## 2. The original's logic

0x1266b90(obj, new master, flag), state <= 2 only:
1. 0x1265770(obj, 1) (old storage leaves the player's attributes).
2. `share = hp / old max * new max` (old max = master `+0x68` decoded, as float of a short);
   `hp = share > new max ? new max : (1.0 <= share ? share : 1.0)`; stored as float.
3. sight change (0x111a800 with the two line-of-sight values), leave the map lists (slot 0x1f0), new master
   pointer `+0x10`, **0x12429c0 in state 2**, enter the lists (slot 0x1e8), slot 0x70 with the new master's standing
   sprite (unless flag and slot 0x468 == 1), **0x12429c0 in state 2 again**, new storage comes in.

0x12429c0(obj):
1. No damage entries (`master +0x..b7e == +0x..b76`): return.
2. Share: storage-share objects (0x12515c0 != 0): `100 - amount * 100 / storage` of the entry of the held kind.
   Else master hp < 1: return; clamp hp to [0, master hp] (written back); slot 0x1a8 == 0:
   `100 - min(slot 0xc8, slot 0xd0) / slot 0xd0 * 100`, truncated to a byte.
3. If share != `+0xd`: if share < 100 and there are entries: `now` = last entry with percent < share, `was` = last
   entry with percent < `+0xd`. If they differ: 0x1248400 (drop attachments); new entry with a sprite: mode 0
   places it (0x12482b0, else 0x1480580), **mode 1 draws twice from the Object stream** and places it at a random spot
   of the footprint (0x1042000, 0x1480580), mode 2 slot 0x70 (sprite); old entry with a sprite: mode 0/1 0x1482d20,
   mode 2 back to the standing sprite (slots 0x850, 0x70) unless the new one is mode 2 too. Mode 0/1 need the
   sprite list `+0x28`. Then `+0xd = share`.

## 3. Confirmed difference and the change

- 188329 0x1266ccc..0x1266d3d stores the float; engine `orders/actions.rs` `switch_master` stored
  `f32::from(hp as i32 as i16)`. Case: gate 10486, hp 204.99872 (under construction), 793 -> 794: old share
  `100 - 204.99872*100/max` vs new share with hp 204 differ by one, the engine stopped.
- Change (`GENIE_EXPERIMENT_MASTERHP_188329`): keep the float; stop only when the new master has damage entries,
  the share changes, is below 100 and selects another entry (not modelled: attachments, the two Object draws,
  slot 0x70). Run `K_m_161`: `MASTERHP id=10486 master=793->794 hp=204.99872->204.99872 share=204.99872 whole=204
  change=false entries=[25, 50, 75 all mode 0]`.

## 4. Not implemented / not read

- The per-update call 0x1248b56 (engine: none). A building whose hit points cross an entry's percent in combat
  with a mode-1 entry draws twice from the Object stream in the original; the engine does not.
- 0x1243520 (two more callers), 0x1248400, 0x12482b0, 0x1480580, 0x1482d20, 0x1042000 were not read.
- Whether 158041 made the hit points whole cannot be checked here (no 158041 binary).

## 5. Other situations affected

Every master change of a unit with fractional hit points: a wounded villager changing job (16 cases in the three
replays, e.g. 518239882 villager 4399 35.499977 -> the engine used to make it 35), gates opening and closing while
damaged or under construction, packing/unpacking units.
