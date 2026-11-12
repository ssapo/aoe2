# Fly action, "keep away" branch (replay 516956894, build 188329) — helper F

Master 2592 = `SNAKE` (Gaia, type 70, class 10 predator animal, speed 0.59, radius 0.25, LOS 12, fly_mode 0).
Its default task 0 is Fly (action 10) with: work_value_1 (+0x28) = 1.0, work_value_2 (+0x2c) = 109.0,
work_range (+0x30) = 25.0, search_wait_time (+0x1c, the rest time) = 5.0, terrain (+0x16) = -1, no task sprites.
It is the ONLY master in the 188329 DAT (Gaia civ) whose Fly task has work_value_2 != -1 and work_range > 0;
every other Fly master (hawk, macaw, vulture, ...) has all three values 0 (NESSIE 1973: terrain 52, wait 300).
Two engine stops are driven by these attributes: `fly.rs:258` (work_value_2/work_range) and, right after it,
`fly.rs:263` (work_value_1 > 1e-7, "a flight's animation speed").

## 1. Address table (188329 RVAs)

| What | RVA | Note |
|---|---|---|
| Fly vtable | 0x3224b08 | slot 6 = update, slot 16 = set_state |
| Fly update | 0xb76030 (..0xb76b2f) | old 0x140a84b40 |
| Fly set_state | 0xb75f70 | old 0x140a84a50; rand15 at 0xb75fc1 (rand_sites: `set_state` line 108, generator 0x4354ac0 = Action stream) |
| Fly destructor | 0xb75b10 | writes bird+0x350 = speed() (0xb75b3e) |
| below(n) | 0x904d30 | call at 0xb761ce: (Action stream, 360, file, line 193) |
| rand15 | 0x905170 | call at 0xb76878 (rand_sites: `update` line 391), only for a task with sprites |
| cos / sin | 0xa83060 / 0xa83dd0 | argument angle(int) * DEGREE |
| squared gap object-to-point | 0xb75ce0 | max(|px-ox|-rx,0)^2 + max(|py-oy|-ry,0)^2, r = the OBJECT's master radii |
| squared gap object-to-object | 0x124daf0 | same with both objects' radii summed |
| world: player count / player i / object by id | 0x1602660 / 0x16026d0 / 0x1616cf0 | world = 0xd6c9e0([0x43552b8]) |
| tracker list by raw key | 0x111a690 | player+0x18; key passed unchanged (class list would be 0x111a6e0-style key+900 / +0x16314) |
| tracker key of a master | 0x1727070 | building: stack unit (master+0x426), annex rule (+0x458 head, +0x430 annex0); else unit line head |
| tracker add / complete | 0x1119530 / 0x11197a0 | pending building = key + 90000 until completion |
| MoveTo constructor | 0xb920a0 | (bird, x, y, z, range 0, sprite, 1) |
| unit speed getter | vtable 0x32a4698 slot 0x220 = 0x120d0d0 | |
| bird+0x350 | written 0xb767e6 | speed magnitude / animation speed (old +0x7b8); velocity setter 0x120dd30 also writes it; read by sprite Update 0x1141e10 and 0x1218a90 (>0) |

## 2. The original's logic (0xb76030), state 3 ("choosing") — CONFIRMED by decompile

Timer: `if 0 < timer { timer -= dt }` (top of update, all states).

1. `leash2 = (task+0x19 as u32)^2`; `key = (int)task+0x2c` (float to int, later used as `(short)`); map = world map.
2. `angle = below(360)` — Action stream, ONE draw, always (also when the flight then fails).
3. `factor = task+0x28`, 1.0 if `< 1e-7`. `distance = speed() * timer * factor`.
4. Try loop (tries counted from 0):
   - `if distance < 1e-7` -> set_state(2), done.
   - `c = cos(angle*DEG)`, `s = sin(angle*DEG)`; `dx = c*0 - s`, `dy = s*0 + c`; `px = dx*distance + x`, `py = dy*distance + y`.
   - `angle += 80; tries += 1`.
   - (a) inside: `0 < px <= w-1 && 0 < py <= h-1`, else next try.
   - (b) leash (only if `1e-7 < leash2`): unchanged from what the engine has (`near_home`), else next try.
   - (c) terrain (only if task+0x16 != -1): tile's terrain value in a table must be > 0, else next try. (Not needed for the snake.)
   - (d) keep-away (only if `(short)key != -1`): `r2 = (task+0x30)^2`.
     For player index i = 0 .. world player count-1 (Gaia first), stop at the first rejection:
     `list = tracker(player i).list(raw key (int)(short)key)` (empty list for a missing key);
     for each id in list order: `o = world.object(id)` (no null check);
     `dp = gap2_point(o, px, py)` (0xb75ce0);
     `if dp < r2 { db = gap2_objects(o, bird) (0x124daf0); if !(db < r2 && db <= dp) { reject } }`.
     Rejected -> next try. I.e. the point is refused when it lies within the range of such an object,
     unless the bird is already inside that range and the point is not nearer to the object than the bird.
   - "next try": `if tries > 11` -> set_state(2), done (so at most 12 points).
5. Accepted point: `if 1e-7 < task+0x28 { bird+0x350 = speed() * task+0x28 }` (0xb767c0-0xb767e6).
6. Sprite: task without moving/carrying/proceeding sprite -> master walking sprite, no draw; else one rand15 % 3 (unchanged).
7. MoveTo(bird, px, py, bird z, range 0, sprite, 1) added to the sub-list; set_state(4). Allocation failure -> set_state(2).

No RNG draw, no timer and no state write inside (d): the loop is pure, so list order does not change the result.
set_state(3) draws `rand15*10/0x7fff + 5` s (unchanged); set_state(2)/(3) drop the sub-actions; state 4: unchanged.
States 2 and 4 read as the engine has them (rest time = task+0x1c, 5 s for the snake).

What key 109 means: 0x111a690 looks the raw integer up in the player's object tracker (the same structure the engine
has in `players/tracker.rs`): master keys are plain ids, classes are +900, pending buildings +90000. So 109 is the
done list of key master 109 = Town Center (RTWC): finished objects of master 109, and of master 621 (RTWC1X, whose
stack unit is 109). Masters 71/141/142 (later-age Town Centers) have stack unit -1 and no unit line in
`unitlines.json`, so they key under their own ids and are NOT in list 109. It is NOT a class (class 109 does not exist;
a class would need key 1009). The snake keeps its flight points 25 tiles (edge gap) away from Town Centers 109.

## 3. Confirmed differences and implementation note

D1. Keep-away branch not implemented: engine `movement/fly.rs:258-262` returns an error after the try loop;
original 0xb76570-0xb76794 runs it inside the try loop as rejection (d).
D2. Animation speed write not implemented: engine `fly.rs:263-267` errors when `EPSILON < work_val1`;
original 0xb767c0-0xb767e6 sets bird+0x350 = speed*work_val1. The engine already holds this field as
`Mover.animated.speed` (`movement/mod.rs:204`, setter pattern `movement/move_to/mod.rs:251-256`).
D3. (order) The engine checks terrain/keep-away after the loop; in the original both are inside the loop and a
refused point goes to the next angle.

Switch: none needed. These are unimplemented branches (the engine stops there today) and only master 2592 reaches
them; no other replay behaviour changes. The 158041 binary was not read, so whether the old build used a class list
here (as the engine's doc comment words it) is unknown; if the maintainer wants to keep the 158041 doc reading apart,
gate only the key meaning under `GENIE_EXPERIMENT_FLYAWAY_188329` (on: raw tracker key as below).

File `genie/crates/engine/genie-core/src/movement/fly.rs`, `Fly::choose` (and its caller in `Fly::update`,
`FlyState::Choosing`): `choose` needs read access to the world's players/trackers/objects and the bird's id; pass a
closure or a small struct from `update` (the bird itself is out of the lists during its update, as `&mut Unit`).

```rust
// in the try loop, after the leash test passes, before `break [px, py]`:
let key = t.work_val2.get() as i32 as i16;              // (short)(int)float, as now
if key != -1 {                                          // NOTE: no `0 < work_range` condition in the original
    let r2 = t.work_range.get() * t.work_range.get();
    let mut refused = false;
    'players: for pl in world.players.iter() {          // index order, Gaia first
        for id in pl.tracker.list(ListKey::raw(i32::from(key))).iter().copied().flatten() {
            let o = world.objects().get(id);            // any player's object by id; original has no null check
            let (ox, oy) = (o.position().x(), o.position().y());
            let (rx, ry) = o.master_radius_xy();        // master radii (+..bde/+..bda): 2.0, 2.0 for RTWC
            let gap = |d: f32, r: f32| { let g = d.abs() - r; if 0.0 <= g { g } else { 0.0 } };
            let (gx, gy) = (gap(px - ox, rx), gap(py - oy, ry));
            let dp = gy * gy + gx * gx;                 // 0xb75ce0: y term + x term
            if dp < r2 {
                // 0x124daf0: radii summed, clamp is `<= 0 -> 0`
                let gap2 = |d: f32, r: f32| { let g = d.abs() - r; if g <= 0.0 { 0.0 } else { g } };
                let bx = gap2(bird_x - ox, bird_rx + rx);
                let by = gap2(bird_y - oy, bird_ry + ry);
                let db = bx * bx + by * by;             // x term + y term
                if !(db < r2 && db <= dp) { refused = true; break 'players; }
            }
        }
    }
    if refused {
        if TRIES - 1 < tries { return Ok(self.set_state(FlyState::Resting, action)); }
        continue;
    }
}
// after the loop, replacing fly.rs:258-267:
if EPSILON < t.work_val1.get() {
    anim_speed = Some(speed * t.work_val1.get());       // caller: mover.animated.speed = it (bird+0x350)
}
```
`ListKey::raw` = the game's integer unchanged (for 109 identical to `ListKey::master(MasterId 109)`; a value of
900..999 would address a class list, as in the game). The `0 < work_range` guard the engine has at line 258 is not in
the original (with range 0 nothing can be `< 0`, so it is equivalent). Float order of the sums as commented
(two-term sums commute, so only kept for form). The terrain branch (c) stays an error (not needed).

## 4. Suspected (not proven)

- Finished starting Town Centers are in done list 109 from creation: the building's setup (vtable 0x32b4fa8 slot 170,
  0x1297580) calls the tracker "complete" (0x11197a0 at 0x129d582); read only at call-site level. The engine's
  `players/tracker.rs` already models add/complete; whether its lists equal the game's at tick 1 was not compared.
- master+0x426 = stack unit, +0x430 = annex[0], +0x458 = head unit: inferred from the field-table order in 0x12f3070
  and it matches the engine's `tracker::key` (158041 reading). 
- 0x1727070 clears "pending" for classes 51, 54 AND 68 (mask 0x20009 from 51); the engine's doc says 51 and 54. Not checked further.
- Fly destructor (0xb75b10) sets bird+0x350 = speed(); whether the engine does this when a Fly is dropped was not read.
- Whether bird+0x350 feeds anything besides animation (0x1218a90 "speed > 0" readers) was not traced.
- No hand simulation / truth: there is no memory truth for this replay.

## 5. Not read

158041 binary; terrain branch internals (0x104f490, 0x16027a0); state 1 of the Fly; MoveTo internals; the snake's
unit AI (predator) and its other tasks (6, 7, 157, 159); tracker removal timing for dying buildings.

## 6. What the change affects

Only objects whose Fly task has work_value_2 != -1 or work_value_1 > 1e-7: in the 188329 DAT that is master 2592
(SNAKE) alone. Replays without snakes (the three research replays) are untouched. Snakes then run a predator unit AI
with tasks 157/159 that may hit further unmodelled parts.

Decompiles: cloud container `/home/claude/re-env/re/out_F/q1.c` (update, set_state), q2.c (distances), q3.c/q5.c (tracker), q4.c (key).
