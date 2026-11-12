# Farm stop change: 517426097 P1 561.9 s (farmer 3824 on farm 3927)

Result: the original does NOT stay 3x longer at a farm stop. Its stop counter (`+0x6d`) advances on the same schedule as
the engine's (every 363 work updates = 4.717 s). At each advance it draws ONE random tile of the farm; here the draw was the
tile the farmer already stands on, twice (stop 0->1 and 1->2), so it "walked" 0 distance and kept working. The engine
re-draws while the tile equals the last one (never stays). Farm D1 of `original-188329-reading-round2.md` (R6) = this case.

## 1. Addresses (188329, RVA)

| What | Address |
|---|---|
| Gather update, state 7 (case 7): `+0x74 += dt` | 0xb814ca..0xb814cf (in 0xb800b0) |
| condition to change stop: `stops>=2 && !setting(0xd6cc70) && time_at_stop >= time_per_stop(+0x70) && current+1 < stops` | g1.c l.3029-3034 (0xb814a0..0xb814f0) |
| `if (task[+0x15]&1)==0: current_stop(+0x6d)++`, then `set_state(4)` (slot 0x80) | 0xb814f0..0xb814fa |
| `+0x74 = 0` after `set_state(7)` (state 6 -> 7) | 0xb8146c |
| set_state(4) spot loop: draw x (line 0x290), draw y (line 0x291), generator 0x144354ac0, `rand % (2*radius) + (int)(farm - radius)`, `+0.5` | 0xb7edb0..0xb7ee2b |
| `ok(x, y)` | 0xb7ee19 -> 0xb7aa90 (dist^2 to unit > 256.0 `[0x322501c]`, or 0x120fec0(unit, point, 16.0 `[0x3218e74]`, ...) != 0) |
| accept first ok candidate (only test `x >= 0`), store `+0x78/+0x7c`, build MoveTo | 0xb7ee2f..0xb7ee3b -> 0xb7efa8 |
| fallbacks after 10 failures: last stop (if inside farm and ok) -> farm centre -> unit place | 0xb7ee41.. |

## 2. Original logic (steps)

1. State 7, every update: `time_at_stop += dt`; while `< time_per_stop` or on the last stop -> gather (unchanged).
2. Else: `current_stop++` (unless task flag), `set_state(4)`: no gather this update.
3. set_state(4) with several stops: up to 10 times { x = draw, y = draw, `ok(x,y)` -> take it and stop }. There is NO
   comparison with the last stop (`+0x78/+0x7c`) in the loop (disassembly 0xb7edb0..0xb7ee3b read in full).
   The chosen point may be the tile the farmer stands on.
4. MoveTo to that point; when it ends -> set_state(6) -> set_state(7) (`+0x74 = 0`) -> gathering resumes.

## 3. Confirmed difference

Engine `gathering/gather/start.rs:141-167` `stop_point`: `while x == last.x() && y == last.y() && draws < STOP_DRAWS`
draws again when the candidate equals the last stop (and makes its first pass only because x,y start as `last`).
Original: no such test; the first candidate is used (when `ok`). Stop timing (`update.rs:299-313`, `start.rs:96`,
`update.rs:279` reset) is the same on both sides (363 increments of 0.013 reach 4.7169814).

Evidence, truth side (`truth6`, `ao` bytes +0x6c stops, +0x6d current stop; tables from `tab.py`, `t6_farm.jsonl`):

| farmer | stop | spot | first seen ms | last seen ms | held | next spot |
|---|---|---|---|---|---|---|
| 3824 | 0 | (86.5,77.5) | 554993 | 559283 | 2.35639 | (86.5,77.5) same |
| 3824 | 1 | (86.5,77.5) | 559686 | 564106 | 4.66381 | (86.5,77.5) same |
| 3824 | 2 | (86.5,77.5) | 564392 | 568734 | 6.52998 | (87.5,77.5), walk starts ~569.07 s, held 6.65997934 |
| 2966 | 0 | (89.5,78.5) | 547674 | 552198 | 2.41840 | (89.5,79.5) |
| 2966 | 1 | (89.5,79.5) | 553797 | 558282 | 4.95391 | (89.5,77.5) |
| 2966 | 2 | (89.5,77.5) | 560934 | 565302 | 7.32401 | (90.5,78.5) |
| 2966 | 0,1,2 (trip at 601.8 s) | (89.5,77.5) x3 | 601845 | 615755 | 7.39291 | (90.5,77.5) |
| 3830 | 0 | (84.5,66.5) | 559686 | 563820 | 2.38395 | (83.5,66.5) |
| 3830 | 2 | (85.5,68.5) | 574051 | 578081 | 7.35157 | (85.5,68.5) same |

Counts of stop changes (all farmers, masters 259/214): truth6 161 same tile / 969 other (14.2 %); truth5 (518470161)
100 / 706 (12.4 %); a uniform draw over 9 tiles gives 11.1 %. The engine can never produce "same".
**3824 at 559.5 s is the earliest same-tile change in truth6** (2966, farming since 544.7 s, changed tile every time
before it) - that is why farming matched until 560 s. Earliest in truth5: 607.36 s (farmer 10437, P2) = the open
518470161 P2 613.2 s case, very likely the same cause (SUSPECTED, not traced).

Hand simulation (float32, `sim` in this note's session; constants calibrated on `P_2.err`: work 0.53*0.013 per update,
farm +0.0052 per update after the farmer, last-bit rule of `work.rs` with storage 15*0.001 = 0.015): start engine
update 42821 (H = 2.4941926 `daa01f40`, farm 0.33463007); stop change at 42822 (same as engine); 4 updates without
gathering (42822..42825), 362 gathering updates, change at 43188, 4 without, 362 gathering, change at 43554
(= 569072 ms). Every truth sample is reproduced: 559686 -> 2.542423 / farm 0.34360006; 559920 -> 2.666444 / 0.31318006;
563365 -> 4.367419; 564392 -> 4.793212; 568435 -> 6.4103837; 568734 -> 6.5299816; **leave held 6.6599793 = `8d1ed540`
= truth 6.65997934**, truth sample 569124 (update 43558 = change + 4) at x 86.5312 = the engine's position 4 updates
after its own change (42826: 86.5312). With 3 or 5 idle updates the numbers do not match (6.6495786 / 6.6703796).
The RNG values themselves were not reproduced (no trace of the Action stream state); the next spot (87.5, 77.5) is
what the engine also drew at 42822 after its re-draw(s).

### Implementation note: `GENIE_EXPERIMENT_FARMSPOT_188329`

`gathering/gather/start.rs` `stop_point`: under the switch replace the loop by a single pair of draws:

```rust
if std::env::var_os("GENIE_EXPERIMENT_FARMSPOT_188329").is_some() {
    // 188329 0xb7edb0..0xb7ee3b: first candidate, no "same as the last stop" test (ok() 0xb7aa90 taken as true)
    let x = ((rng.rand15() as i32) % ix + left) as f32 + gather_tuning.stop_centre;
    let y = ((rng.rand15() as i32) % iy + bottom) as f32 + gather_tuning.stop_centre;
    return Point::new(x, y);
}
```

Nothing else changes: `set_walk` still tears down, sets state 4 and starts a MoveTo to the (possibly current) point.
Acceptance numbers: farmer 3824 must show state 4 at 42822, no held change on 42822..42825, first gain at 42826
(2.5010827), state 4 again at 43188 and 43554, held 6.6599793 at 43554, at (87.5, 77.5) by ~43667 (570554 ms sample).

## 4. Suspected

- That the engine's MoveTo to the unit's own position ends so that gathering resumes exactly 4 updates after the change
  (state 4 at T and T+1, 6 at T+2, 7 at T+3, gain at T+4; the engine's walking case gives 6 / 7 / gain on consecutive
  updates after arrival and does not move on T+1). Not run (no engine build allowed). If it resumes after 3, look at the
  MoveTo's first update (original MoveTo update 0xb93260).
- `ok()` failing sometimes (same-tile share 12-14 % > 11.1 %): then more draws and, after 10, the last stop.
- 518470161 P2 613.2 s is the same difference.

## 5. Not read

0x120fec0 (path test inside `ok`, 169 bytes), the fallbacks' exact order beyond the decompile at g1.c l.2153-2176,
MoveTo behaviour for a zero-length walk in the original, sprite draws (0xb7c860) during the in-place state 4/6/7.

## 6. What else the change affects

Every farm stop change and every first walk onto a farm (set_state(4) with 4 stops, masters 50/1187): one pair of Action
stream draws instead of 1+ pairs, so the Action stream shifts for everything after the first formerly re-drawn case
(1 in 9 stop changes). Also the first spot when `last_stop` happens to equal the draw.

Files: `scan.py` (truth extract), `tab.py`, `tab2.py`, `t6_farm.jsonl`, `t5_farm.jsonl`.
