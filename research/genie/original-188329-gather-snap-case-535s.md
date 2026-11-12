# Case 517426097 P2 535.9 s (word 7): gold miner 3880 is not pulled against its mine in Gather `set_state(6)`

Runs: `runs/P_1` (objects 40500-41030), `runs/P_2` (objects 42490-43010, steer 40745-40772), default 24 switches
(`runs/K_envs.txt`). Truth `truth/truth6.jsonl`. RVAs are of `AoE2DE_s_unpacked.exe` (188329). Engine paths relative to
`genie/crates/engine/genie-core/src/`.

## 0. First difference (step 1 and 2)

`cmp_pos.py runs/P_1.err`: 2361 object samples compared in 529.37-536.26 s, **one** object differs: **3880** (P2, master 581 =
female gold miner), first at truth sample **532906 ms (update 40772)**: truth x = 30.2 (`41f1999a`), engine x = 30.2517853
(`41f203a8`); y equal (`417d97e8` = 15.8495865). `cmp_held.py`: no difference in the window (held of 3880 is 0.00494 on both
sides at 532906). Previous truth sample 532685 (update 40755): position bit-equal (`41f250b6`,`417b57c6`), path equal.
The checkpoint difference +5 at 535.857 s is this one unit (it then stays there mining; in `P_2` it is still the only P2 position
difference at 555.7 s).

Situation: villager 3880 walks to gold mine **3066** (Gaia, at (29.5, 15.5), from the truth head-action blob `ao`+0x38; radius 0.5
inferred) on the path `(34.79,10.60) (33.2,12.2) (30.8,13.8) (30.2,16.043)`. Both sides stop walking on the last leg at
(30.2517853, 15.8495865), short of the last waypoint, at update 40769 (engine: Gather state 4 -> 6 at 40770 -> 7 at 40771, first
gold at 40772; the truth held agrees to the bit, so the timing is equal). In the truth the unit then stands at x = 30.2 exactly =
mine x + mine radius + unit radius; the engine stays at 30.2518. Unit tile (30, 15), mine tile (29, 15): in line on one axis.

## 1. Address table

| Role | 188329 RVA | Engine |
| --- | --- | --- |
| Gather vtable; `set_state` (slot 0x80) | 0x3224dc8; 0xb7e500 (..0xb80083) | `gathering/gather/` |
| `set_state` case 6 (decompile `$RE/out_c2/g1.c`, `show.sh ... 0xb7e500`, `case 6:`) | 0xb7e500 body | `gathering/gather/work.rs:33` `set_face` |
| case 6: class test 8 / 0x20 / 0xf, then snap call | 0xb7f76f..0xb7f78d | none |
| case 6 end: timer `+0x44 = 0`, sprite 0xb7c860 -> unit slot 0x70 | 0xb7f792..0xb7f7ab | `work.rs:68-69` |
| Snap to the resource | 0x1116f60 (..0x11172ae) | Hunt only: `gathering/hunt/gathering.rs:178-213` |
| case 6: diagonal re-target for mines (classes 8, 0x20) | inside case 6 before 0xb7f76f (0xb7b960, 0x124daf0, 0xd40b90) | none |

## 2. The original, in steps (Gather `set_state(6)`, 0xb7e500 case 6, target `this[4]`, unit `this[2]`)

1. Target class 0x31 of another player: take-over path (0x1242370 / 0x1242910).
2. Target master 0x165 or 0x4a4 -> 0xb7c340, done. Target state < 2 -> unit slot 0x3b0 (build), done. Master 0x769 / 0x765 with
   target slot 0x818 == 0 -> own path, done.
3. `cls` = target class (read once, kept in a local; 0xb7f76f reads it back).
4. If `cls` is 8 or 0x20 and unit-AI 0xd28770 returns 0: if the truncated tile differences target - unit are non-zero on BOTH
   axes, the two orthogonal neighbour tiles are searched for a resource with squared gap < `[0x31fe7cc]` and the most workers
   (`+0x18c`); if found and different, the action's target, point (`+0x38/+0x3c/+0x40`), unit-AI target (0xd40b90) and class
   (`+0x68`) are replaced.
5. If `cls` is 8, 0x20 or 0xf (0xb7f773 `cmp ax,8; je` / 0xb7f779 `cmp ax,0x20; je` / 0xb7f77f `cmp ax,0xf; jne 0xb7f792`):
   `0x1116f60(unit [rsi+0x10], target [rsi+0x20])` (0xb7f785..0xb7f78d) - the target is the current one (after step 4).
6. `+0x44 = 0` (timer), sprite via 0xb7c860 and unit slot 0x70.

`0x1116f60` (re-checked in disassembly): `dx = (int)tx - (int)ux`, `dy = (int)ty - (int)uy` (cvttss2si, 0x1117063..0x1117075);
`dx != 0 && dy == 0` (0x111707d..0x1117088): `x = tx - (unit[+0x78] + target[+0x78]) * (float)dx` (0x11170fa addss, 0x1117129
mulss, 0x1117149 subss); `dx == 0 && dy != 0` (0x1117195): `y = ty - (unit[+0x7c] + target[+0x7c]) * (float)dy`
(0x1117208..0x1117257); otherwise nothing; then unit slot 0x60 (position setter, 0x11172a4).

Hand check for this case: dx = (int)29.5 - (int)30.2517853 = -1, dy = 15 - 15 = 0 ->
x = 29.5f - (0.2f + 0.5f) * (-1.0f) = 30.2000008 = **`41f1999a`** (numpy float32), y unchanged `417d97e8`. Equal to the truth
bits from 532906 on.

## 3. Confirmed difference

**D1. Gather `set_state(6)` does not snap the unit against a class 8 / 32 / 15 target.**
Original: 0xb7f76f..0xb7f78d + 0x1116f60 (above). Engine: `gathering/gather/work.rs:33-71` `set_face` goes from the master
tests straight to `self.timer = Seconds::ZERO; Self::show(...)`; no position write. The Hunt twin exists
(`gathering/hunt/gathering.rs:178-213`, finding 15, under `GENIE_EXPERIMENT_HUNT_188329`), whose note already named this call
site as missing. Truth: 30.2517853 while walking, `41f1999a` from the first sample after work begins.

Implementation (new switch **`GENIE_EXPERIMENT_GATHER_SNAP_188329`**; it is a Gather rule, and HUNT is about the other action):
in `GatherAction::set_face` (`gathering/gather/work.rs`), after the pasture-master test and immediately before
`self.timer = Seconds::ZERO;` (line ~68), i.e. only on the path that ends in timer 0 + sprite (not on the farm / 357 / 1188 /
`Next::Build` / pasture returns):

```
if std::env::var_os("GENIE_EXPERIMENT_GATHER_SNAP_188329").is_some()
    && matches!(target.class.get(), 8 | 32 | 15)
{
    // identical to hunt/gathering.rs:184-211 with `Some(target.id)` (the gather's target) in place of self.target:
    // (tp, tr) = c.w.spatial.get_known(target)  -> position, radius
    // here = unit.place.position(); dx = tp.x() as i32 - here.x() as i32; dy = tp.y() as i32 - here.y() as i32
    // dx != 0 && dy == 0: at = (tp.x() - (mr.x() + tr.x()) * dx as f32, here.y(), here.z())
    // dx == 0 && dy != 0: at = (here.x(), tp.y() - (mr.y() + tr.y()) * dy as f32, here.z())
    // else nothing.  mr = mover.stats.radius (unit radius first in the sum; add, multiply, subtract in f32)
    // then mover.set_position / grounded / mark_move(at, world_time) / new_position(...) exactly as the Hunt does
}
```
Best: move the Hunt block into one shared helper and call it from both. Both callers of `set_face` (`gather/update.rs:337`
walk arrived, `gather/point_walks.rs:258`) go through it, as in the original (any `set_state(6)`).
Expected: 3880 at 532880 (update 40770, when the engine enters state 6) x = `41f1999a`; P2 word 7 at 535.857 s = 214300.

## 4. Suspected / read but not exercised here

- Step 4 (diagonal re-target for mines) is CONFIRMED in the original and absent from the engine (`work.rs` `set_face`;
  already listed as D6 in `$RE/out_c2/gather5_map.md`), but this case has dy = 0, so it is not tested by it. Not part of the
  proposed switch; 0xd28770, 0xb7b960, `[0x31fe7cc]` value and the group slot 0x1b0 were not read.
- Why the walk ends at (30.2518, 15.8496) and not on the waypoint (30.2, 16.043): not examined (both sides agree in place and
  update, so it is not the difference).

## 5. Not read

0x1224f60 (slot 0x60 body), 0xb7c860 (sprite choice), the mine's radius in the DAT (0.5 inferred from `41f1999a`), unit AI
0xd28770.

## 6. What else the change affects

Every Gather-kind (action kind 5) arrival / re-entry into state 6 at a stone mine (class 8), gold mine (class 32) or tree
(class 15) when the unit's tile is orthogonally in line with the target's tile and the unit is not already at the touching
coordinate (walk ended short of the last waypoint). Same float is rewritten when it already touches. Diagonal or same tile,
farms, bushes, animals: unaffected. `mark_move` stamps the last-move time, which can alter neighbours' collision ranking
(as slot 0x60 does in the original).

## 7. Lead: 517426097 P1 561.9 s (word 7) - first step only, nothing read

`cmp_pos.py runs/P_2.err` (objects 42490-43010): first P1 difference is **farmer 3824** (master 259) on **farm 3927**
(at (86.5, 78.5)), truth sample 559686 ms. `cmp_held.py`: 3824 and 3927 differ from the same sample.
Engine: at **update 42822 (559556 ms)** Gather state 7 -> 4: the farmer leaves its first farm stop (86.5, 77.5) for the next
one after 4.7 s there (held 2.494), and the farm's held value starts rising. Truth: the farmer stays at (86.5, 77.5) until
~569.1 s (held 6.66, 14.1 s at the stop; the farm's value runs down to ~0.03 by then), walks to (87.5, 77.5) by 570.55 s, works
there until full (9.904) at ~577.2 s. State just before is identical (truth samples 555669..559283 equal in position and held
for both objects; 3824 became a farmer at 552.5 s and reached the stop at 554.99 s on both sides).
So: **time at a farm stop is ~3x longer in the original** (14.1 s vs 4.7 s = capacity 10 / 0.53 per s / 4 stops). Engine rule:
`gather/update.rs:299-313` `update_work` (`time_per_stop <= time_at_stop && current_stop.before_last`), `time_per_stop` from
`gather/start.rs:96` and `update.rs:117`. In the truth the walk-on coincides with the farm object's held value (`o[3]` of 3927)
reaching ~0, which suggests the original's stop change is driven by that farm value rather than by capacity / rate / stops -
SUSPECTED, original not read (Gather update 0x3224dc8 slot 0x30, state 7; see `$RE/out_c2/gather5_map.md` D4).
