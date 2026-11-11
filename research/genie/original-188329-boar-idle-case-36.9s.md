# Case P17: gaia boar 9719, replay 518470161 (truth5): "wanders 12.3 s early"

Run prefix `h1_`. Engine runs on the PC (`runs\`), both with the current `go.ps1`
(`GENIE_EXPERIMENT_SEARCH_CLEAR=unit`, findings 30) plus the 9 switches in `$a`:
- `h1_a`: updates 1-2720, OBJECT for 9719 on 2600-2720, `GENIE_TRACE_ANIMAL=1`.
- `h1_b`: updates 1-7000, OBJECT for 9719 on 1-7000 (93.184 s).
Truth slice: all 10 575 truth5 samples of 9719 (made on the PC VM, `$HOME/t9719.jsonl`, not kept).
New disassembly: `out_p17/cfc290_boar_idle.asm` (boar idle check). No Ghidra run (`proj_p17` not needed).

## 0. Result

**The case is already fixed by findings 30 (`SEARCH_CLEAR=unit`). No engine change is needed.**

- With the current `go.ps1`, `TRUTH=truth/truth5.jsonl python3 runs/cmp_pos.py runs/h1_b.err`:
  `compared 6297 objects with any diff 0`. Boar 9719 matches bit for bit through update 7000 (93.184 s).
- Its legs in `h1_b` now start at the original's times, with the same first steps and end points:

  | Leg | Engine `h1_b` (tick, ms) | Truth5 | Old engine (`d1_e`/`d1_f`, `SEARCH_CLEAR=tick`) |
  |---|---|---|---|
  | 1 start, first step (95.51034546, 44.50106049) | 3618, 49 218 | 49 218 | 2673, 36 933 |
  | 1 end (93.47425842, 45.85316849) | 3878, 52 598 | 52 598 | - |
  | 2 start | 4593, 61 893 | 61 893 | ~3648, ~49.6 s |
  | 2 end (94.52944946, 45.14840317) | 4715, 63 479 | 63 492 sample (first after) | - |
  | 3 start / end (92.50494385, 46.49847794) | 6483, 86 463 / 6717, 89 505 | 86 463 / 89 505 | - |

- Why: the boar's idle check (timing and logic) is the same in both builds. Its idle period is
  2427 ms in the engine too. Only the AI random draw that decides "wander or not" (`rand15 % 7`)
  was different. The old engine's AI random stream was shifted at the 15.067 s gaia burst (the
  search-cache reuse of findings 30: deer 9656 took the wander branch and one draw too many). Every
  later gaia draw moved by one, so the boar's check at tick 2671-2673 (36.9 s) came out 0 mod 7 in the
  old engine. With the cache cleared per unit-AI full update, the stream matches the original again.
- Independent evidence that the random stream now matches: the look-around limit (`ai+0x17c`, one AI
  draw each time it runs out, 0xd42a00 `+0x17c = 4500 + r % 1000` for gaia) gives exactly the truth
  `t17c` sequence in `h1_b`: 4569, 4754, 5410, 5184, 4802, 5115, 4896, 5131, 4514, 4802, 5250, 5426,
  with the same reset times (10 387, 15 808, 20 995, ... 55 666 ms). In the old `d1_f` it splits at
  20 995 ms (5112 instead of 4802), i.e. right after the 15.067 s burst.

## 1. Address table (188329)

| Role | 188329 | Engine |
|---|---|---|
| Boar unit-AI vtable (factory type 4) | 0x3244f88 (constructor 0xcf0120; slot 0x240 = 0xcfc290, slot 0x1a8 = base 0xd1c290) | `unit_ai/life.rs` `constructed`, `UnitAiKind::Boar` arm (~120-127) |
| Boar idle check (slot 0x240) | 0xcfc290..0xcfc7d3 | `unit_ai/idle_animals.rs` `boar_idle` (69-88), `boar_wander` (91-150) |
| Hunted idle (for comparison, not the boar's) | 0xcfcbd0 (vtable 0x3244ac8, constructor 0xcf0300, slot 0x1a8 = 0xcf4ed0) | `hunted_wander` |
| Base unit-AI constructor: timers | 0xd0b310: `+0x168` idle timer 0, `+0x170` base 3000 (0xd0b41e), `+0x174` 750, `+0x178` 0, `+0x17c` 1000 (0xd0b428/0xd0b433); `+0x16c` drawn (0xd0b7d4..0xd0b806); `+0x1d4` = 750 + r % 500 (0xd0b843) | `life.rs` `base_constructed` (`IDLE_TIMEOUT` 3000, `ids.rs:83`) |
| Adjusted idle timeout (base) | 0xd1c290: `+0x16c = r % (base >> 1) + (3 * base) >> 2` | `cared.rs` `adjusted_idle_timeout` (~241) |
| Unit-AI update: idle timer `+0x168` += dt (decompile `out/d10.c` 310-312), idle check when `+0x16c < +0x168` and no action, then slot 0x240 | 0xd42a00 (d10.c 548-632) | `unit_ai/idle_part.rs`, `update.rs:294` |
| Look-around timer `+0x178` / limit `+0x17c` (truth `t178`/`t17c`) | 0xd42a00, d10.c 636-660: on run-out `+0x178 = 0`, `+0x17c = (computer ? 3500 : 5000) - 500 + r % 1000` | OBJECT `look` / `limit` |
| Search cache flag cleared at each unit-AI update | 0xd42a49 (findings 30) | `unit_ai/unit.rs` 514-528 (`forget_search`, default branch) |

Truth field mapping (from `truth/truthlog5.ps1` line 49): `timer` = ai+0x1d4 (retarget timer),
`t174` = ai+0x174, `t178` = ai+0x178, `t17c` = ai+0x17c. **The truth does not record the idle timer
(`+0x168`) or its limit (`+0x16c`)**; `t178`/`t17c` are the look-around timer, not the idle timer.
That is why the move at 49.218 s happens with `t178` = 3627 < `t17c` = 4802.

## 2. Original's logic (0xcfc290, read whole)

1. 0xcfc2a4 `0xd1c2e0` (cap on a human order; engine `cap_human_order`).
2. 0xcfc2a9 `[ai+0x204]` (furious) != 0 -> return 5. 0xcfc2c4 `0xfa46c0(...+0x680) == 1` (mode 1) -> 5.
3. `d2 = (x - [+0x1f8])^2 + (y - [+0x1fc])^2` (decoded object x/y).
4. 0xcfc3d3 `leash = 0x904800(81)` (one draw, 0..80) + 144.0 ([0x3249c08]).
5. 0xcfc3d8 `[+0x205]` (go home) set -> moveTo(origin, z) range 0.5 ([0x31b1420]), args 1, 1; clear
   `+0x205`; return 6.
6. 0xcfc4b4 `comiss d2, leash; jbe` -> inside: step 8. Outside: target point `[+0x50]` == origin x or
   `[+0x54]` == origin y -> return 6; else moveTo(origin) and return 6.
7. (outside path ends.)
8. 0xcfc5b2 `r = rand15`; `r % 7 != 0` -> return 5 (0xcfc5d5).
9. 0xcfc5db `d2 > 4.0` ([0x31fd878]) -> moveTo(origin) (0xcfc4e5), return 6.
10. 0xcfc604 / 0xcfc67d two draws: `sx = r1 % 6 - 3`, `sy = r2 % 6 - 3`; moveTo(x + sx, y + sy, z),
    range 0.5, args 1, 1 (slot 0x130); return 6.

The idle check runs when the idle timer `+0x168` passes `+0x16c` (2250..3749 for a boar: base 3000,
never changed by the boar constructor 0xcf0120, which only stores the origin and clears `+0x204`).

## 3. Confirmed differences

None for this case. Engine `boar_wander` (`idle_animals.rs` 91-150, constants `ids.rs` 94-99:
`BOAR_LEASH_DRAW` 81, `BOAR_LEASH` 144.0, `BOAR_HOME` 4.0, `BOAR_WANDER` 7, `BOAR_STEP` 6,
`BOAR_OFFSET` 3) matches steps 1-10 one for one, including the draw order (leash draw before the
go-home test, `% 7`, then x then y step). The boar's adjusted idle timeout (engine 2427) is drawn the
same way (base 3000, 0xd1c290). The 12.3 s offset came only from the shifted AI random stream, and that
was removed by findings 30 (`GENIE_EXPERIMENT_SEARCH_CLEAR=unit` in `go.ps1`; `unit.rs` 514-528 default
branch = 188329's clear at 0xd42a49).

**Engine change: none.** Keep `SEARCH_CLEAR=unit` (the default branch); do not run with `tick`.
If anything, make the default branch the only branch (drop the `tick` diagnostic) when the switches are
folded into one "188329" setting.

## 4. Suspected

- The boar does not use a Graze limit: 0xcfc290 never calls unit slot 0x870 (only 0xcfcbd0 does,
  findings 29), so `GENIE_EXPERIMENT_GRAZE_188329` correctly leaves `boar_wander` alone.
- Not checked: the exact AI draw counter (`airng` word) against the engine's draw count after
  15.067 s; the look-limit sequence is used as the proxy (12 draws matched, the old run broke at the
  first one after 15.067 s).

## 5. Not read

- 0xd1c2e0 (cap on a human order), 0xfa46c0 (mode 1 test), 0x904800 body (taken as `below(n)`, the
  engine's `ai.below`), moveTo 0xd30b80 (slot 0x130): known from earlier cases, not re-read.
- The boar's own idle-timer values (`+0x168`/`+0x16c`) are not in the truth; the engine's 2427 is
  confirmed only indirectly (all three legs start on the same tick).

## 6. Other situations affected

No change proposed. Situations that depended on this boar now match: P1 scout 9389's short path round
the boar at 60.385 s (P14 row 2) and P1 goats 9519/9520 bumping into the boar (P14 rows 3-4) should no
longer come from the boar (P14's S1, the partial short path to a goal inside a unit's box, can now be
re-checked in a real run). `h1_b.out`: 14 checkpoints hold to update 7000.
