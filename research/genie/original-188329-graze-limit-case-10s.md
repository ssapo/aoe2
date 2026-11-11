# P12 – earliest divergence in replay 518470161 (10.036 s, gaia 10075)

Run prefix b1_. Engine traces: $G/runs/b1_a (AIUPD+ANIMAL+OBJECT 598-608), b1_b (STEER/PATHS 604-606),
b1_c (AIUPD+ANIMAL+OBJECT 985-1000), b1_d (STEER/PATHS+AIUPD 990-993). Truth: truth5.jsonl.
Decompiles: out_p12/a1.c (0xcfcbd0), a2.c (0x120fec0, 0x107a5e0, 0x106e0b0), a3.c (0x1058020, 0x1057a40, 0x1252060, 0x120e560).
Helper scripts (ran on the PC VM, copies here): out_p12/tasks.py (DAT task reader), out_p12/wand.py (truth MoveTo targets).

## 0. Result of step (1): earliest differing objects

`cmp_pos.py runs/q161c.err` (updates 500-1500, 8.68-21.68 s):

| # | id | first diff (truth ms) | player | master | note |
|---|----|------|---|---|---|
| 1 | **10075** | **10062** (engine moves from tick 605/606; decision at tick 604 = 10.036 s) | 0 (gaia) | 2098 (class 9, graze animal) | the only diff until 15.1 s |
| 2 | 9656 | 15119 | 0 | 65 (deer) | 17 objects start together at the 15.067 s idle burst |
| 3 | 9657 | 15119 | 0 | 65 | " |
| 4 | 10074 | 15119 | 0 | 2098 | " |
| 5 | 10089 | 15119 | 0 | 2098 | " (+10090, 10091, 10092, 10094-6, 10098, 10099, 10101, 10102, 10104-6) |
| – | 10086, 10103 | 20124 | 0 | 2098 / 65 | |

The earliest is 10075 (consequence-free gaia animal, but it is the first). The 15.067 s group is a
second, separate event (section 4).

## 1. Tick-by-tick, 10075 (tick 604 = 10036 ms)

All gaia animals' idle timers (5000 ms) expire together at tick 604; the engine runs the hunted
idle check for every hunted animal in that tick (b1_a: AIUPD draws_before 2837 -> 2899).

| ms (tick) | truth 10075 | engine 10075 |
|---|---|---|
| 10023 (603) | (42a10000,41a40000) = (80.5,20.5), no action, ai+0x44 = FFFFFFFF | same, idle 4992/5000 |
| 10036 (604) | unchanged, no `an`/`ao`, ai+0x44 = FFFFFFFF | idle check: draw #2858 % 7 == 0, steps #2859/#2860 = (-1,+1); MoveTo (kind 1) state 3 to (79.5,21.5) |
| 10049 (605) | (no sample) | MoveTo state 4; SHORTPATH from (80.5,20.5) to (79.5,21.5), r 0.2: **Partial**, end (79.5,21.1) |
| 10062 (606) | (80.5,20.5) | (42a0fe93,41a4036d); fwd turned to (bf5b84a5,3f03b602) |
| ... 15054 | (80.5,20.5) never moves until 15.067 s | ends at (79.915,20.851) |

Other wanderers of the same tick (9657, 9658, 10066, 10097, 10105) match bit for bit in both, and the
truth shows them with MoveTo state 3 and ai+0x44 = 0x262 (order set by unit-AI moveTo 0xd30b80) at
10036. Truth draw counter (airng word at +0x18) vs engine `draws`: offset 303±3 before and after
(10062: 3211 vs 2906) — no draw-count difference. So the original consumed the same 3 draws for
10075 (wander chosen, same target (79.5,21.5)) but **did not call moveTo**. The target is the exact
centre of the neighbouring animal 10078 (79.5,21.5, master 2098, radius 0.2).

Kind of divergence: idle wander of a gaia animal — a pre-move path/length check that the engine
does not have (not RNG, not order, not path shape).

## 2. Address table (188329)

| address | what |
|---|---|
| 0xcfcbd0 (vtable 0x3244ac8 slot 0x240) | TribeHuntedAnimal idle check (old FUN_140c1eea0) |
| 0xcfcf0b / 0xcfcf69 | leash branch: unit slot 0x870, then FUN_14120fec0(origin) |
| 0xcfd039..0xcfd0b3 | leash branch failure: origin (+0x1f8/+0x1fc/+0x200) := unit x,y,z, fall to search |
| 0xcfd1f6, 0xcfd6fc, 0xcfd71a | rand15 draws (r%7; steps %6 twice) |
| 0xcfd80e | wander/home move: `call [unit vt+0x870]` |
| 0xcfd81c | `comiss xmm8,0; jbe 0xcfd87c` (value <= 0: no check) |
| 0xcfd860 | FUN_14120fec0(unit, (x,y), 0.1 [0x3202890], -1, &len, -1, -1, 0) |
| 0xcfd865/0xcfd867 | `test eax,eax; je 0xcfce3e` (return 5) |
| 0xcfd872/0xcfd876 | `comiss len, value; ja 0xcfce3e` (len > value: return 5) |
| 0xcfd89d / 0xcfd8a3 | unit-AI slot 0x130 (moveTo 0xd30b80), return 6 |
| 0x32b71c0 | type-70 (TRIBE_Combat) object vtable (level 6; building 0x32b4fa8 derives from it) |
| 0x12b5f20 (slot 0x870) | `movss xmm0,[rcx+0x810]; ret` |
| 0x12bafe0 (slot 0x968, called with master+0x228 = task list) | per task: action (+0xe) 6 (Graze) -> 0x12bbaf2: obj+0x80c = task+0x30 (work range), obj+0x810 = task+0x1c (search_wait_time) |
| 0x11390e0 | slot 0x870 of base vtables 0x32a4698/0x32a6020: `xorps xmm0,xmm0` (0) |
| 0x120fec0 | wrapper -> FUN_14107a5e0(unit, target -1, unit +0x3bc, (x,0,y), 0.1, &len, ..., 1, ...) |
| 0x107a5e0 | point reach test (=158041 FUN_140fa0370, engine `Mover::reach_test`) that also writes the length |
| 0x1057a40 (+0x1058020 lookup) | tile planner pre-check (result > 1 -> return 0) |
| 0x1078690 | short pather (<= 10 tiles, unit with 3 positive radii 0x1252060); result < 2 -> len = path length, return 1 (0x107ac6c..0x107acd0) |
| 0x107ae13 | no target: footprint gap² < 1.0 (0x369ff64) -> return 0 |
| 0x1078d60 on 0x143db3330 | long pather, returns its result byte (0x107ac51..0x107ac65) |

DAT (empires2_x2_p1.dat, civ 0): master 2098 and 2099: task 0 action 6 (Graze) range 2.5,
search_wait_time 4.0; master 65 (deer) and 2095 (horse, finding 26): Graze range 0, wait 0;
radii 2098 = (0.2,0.2,2.0).

## 3. Original's logic (0xcfcbd0, non-king, mode 0)

1. Leash: if leash² (+0x204) > 0 and gap(origin) > leash²: v = slot 0x870; if v > 0 and
   (reach_len(origin) fails or len > v) -> origin := current position, go on to step 2;
   else moveTo(origin) and return.
2. Search (0xd22c20); found -> evade 0xd26200.
3. r = rand15; if r%7==0 and home distance² > 4.0 -> point = origin; if r%7==0 and within -> two
   draws, point = position + steps (±1..±3).
4. If a point was chosen: v = slot 0x870 = unit+0x810 (Graze task's search_wait_time, 0 when the
   master has no Graze task); if v > 0: FUN_14120fec0 reach test to the point with range 0.1; result
   0 or written length > v -> **return 5, no move** (draws already consumed). Else moveTo(point), 6.

10075: v = 4.0; point (79.5,21.5) is inside 10078's footprint: tile planner OK (tiles only), short
pather Partial (2), gap² = 0.8²+0.8² = 1.28 >= 1 -> long pather to tile (79,21), which holds the
standing unit 10078 -> not reached -> 0 -> no move. (Last step SUSPECTED: long pather's result
not reproduced; the other steps are read.)

Statistical confirmation of the 4.0 threshold from truth (0..125 s, wand.py): 61 MoveTo starts of
2098/2099 animals, max length 3.652, **zero (±3,±3) steps (4.243)** (expected ≈ 6.8 if no limit);
lengths 3.606 (> 2.5) occur 11 times, so the limit is wait_time 4.0, not range 2.5. Deer (65, value 0)
do show a 4.243 wander (85.579 s, 9655).

## 4. Confirmed differences

D1 (CONFIRMED both sides). Engine `genie-core/src/unit_ai/idle_animals.rs` `hunted_wander`
(lines 220-314): the leash move (237-245), the home move (288-292) and the wander (294-311) call
`move_to` with no check. Original 0xcfcf0b..0xcfd0b3 and 0xcfd80e..0xcfd876 (above).

Implementation note (switch `GENIE_EXPERIMENT_GRAZE_188329`):
- Graze value: master's tasks (`genie-model .../masters/action_part.rs:28` `tasks`), the last task
  with `action_kind == 6`: `wait_time` (task.rs:58, `+0x1c`); none -> 0. Put it in `Surroundings`
  (e.g. `at.graze_limit: f32`).
- New side call `fn reach_length(&mut self, to: Point, range: Distance) -> Result<Option<Distance>, GenieError>`
  (default `Ok(None)` in unit_ai/side.rs; world_view/side.rs calls a new `Mover::reach_length`):
  a copy of `Mover::reach_test` (movement/path_end.rs:71) without target, range 0.1, that returns
  `Some(short path length)` when the short pather `reaches()` (line 149-154), `None` where reach_test
  returns false, and `Some(long path length)` when the long pather reaches (if `long_path::reaches`
  cannot give a length, use its found path's length; SUSPECTED detail, irrelevant for 10075).
- In `hunted_wander`, before each of the three `move_to` calls, when the switch is set and
  `0.0 < at.graze_limit`:
  ```rust
  let ok = matches!(side.reach_length(Point::new(px, py), Distance::new(0.1))?,
                    Some(len) if len.get() <= at.graze_limit);
  ```
  wander/home (lines 289, 304): `if !ok { return Ok(IdleOutcome::Idle); }` (after the draws);
  leash (line 240): `if !ok { origin := (x, y, z) of the unit (self.hunted.origin); fall through to the
  MODE_1 check and the search }` instead of moving.
- Expected: 10075 stays at (80.5,20.5) at 10.036 s; 10075 no longer differs before 15.067 s.

## 5. Suspected / open

- S1: the 15.067 s burst (tick 991) has 7 more AI draws in truth than in the engine (airng offset
  303 -> 310, persistent) and the wander steps are assigned to other animals: truth 10075 gets the
  engine 10074 steps (3,-1), 10090 <- 10089 (2,3), 10091 <- 10090 (2,2), 10092 <- 10091 (-2,-3),
  10095 <- 10094 (-2,3), 10098 <- 10099 (3,-2), 10101 <- 10102 (-2,-1); truth 9656 goes home, 9657
  does not. 10075's engine walk (D1) changes its own state only; the extra draws come before 9656 in
  the gaia block. Not explained here; with D1 fixed re-run cmp on 990-1000 with AIUPD to see if it
  remains (candidate: refused graze moves and the leash origin reset changing later counts; or the
  gaia update order).
- S2: the long-pather step (0x1078d60) failing for a goal tile with a standing unit (needed for the
  10075 result once the short pather is Partial).

## 6. Not read
FUN_141057a40 internals; FUN_141078d60 (long pather) internals; whether slot 0x968 runs before or
after master changes reset +0x810 (callers 0x114a984, 0x115b58c, 0x12b7e1e seen, not read).

## 7. Other situations the change affects
Only 0xcfcbd0 calls slot 0x870 (byte scan: 0xcfcf0b, 0xcfd80e). Affects hunted animals (type 2 AI)
whose master has a Graze task with wait_time > 0 (here 2098, 2099): wanders/home moves longer than
4.0 tiles or to unreachable points are dropped (draws unchanged), and leash returns that fail reset
the origin. Deer (65), horse 2095, sheep: value 0 -> unchanged. Finding 26 (horse 4285, master 2095,
value 0) is NOT this mechanism.
