# Case P24: replay 518470161, P1 wood +9.359 at 410.982 s — the 188329 resource search has no "2 workers per tree" cap

Symptom in one sentence: **after dropping wood at the town centre at 407.173 s (update 31153) lumberjack
10444 picks tree 9396 (97.5, 60.5) in the engine and tree 9397 (97.5, 50.5) in the original**, because
the engine's `ClosestResourceObject` refuses a tree that already has 2 workers while 188329 ignores
the `maxWorkers` argument and computes a per-tree capacity from the free sides of the tree's tile.
Everything later (10426 not being blocked next to the TC, its drop of 9.359 wood one sample early at
410.982 s, checkpoint words 7 and 9 at 411.7 s) follows from 10444 walking away.

Runs made: `P24_1` (OBJECT trace, updates 30900-31520, all objects). Files: `out_p24/p1.c` (0xd23bf0),
`p2.c` (0xd19f60), `p3.c` (helpers), `crs.py` (python port + this case).

## 0. Evidence from truth and trace

Update <-> ms here: tick 30900 = 403884 ms, 13 ms per update (tick 31153 = 407173 ms).

`cmp_pos.py runs/P24_1.err` (403.9-411.9 s), first position difference per object:

| object | first differing truth sample | note |
| --- | --- | --- |
| 10444 (lumberjack) | 407316 ms | the cause |
| 10415 | 407771 | consequence (crowding at 9397) |
| 10426, 10463 | 408200 | consequence |
| 10421 | 408655 | consequence |
| 10430 | 410982 | consequence |

`cmp_held.py`: no held/state difference of 3 samples in the range. No difference before 407316 ms.

Situation: six P1 lumberjacks (10415, 10421, 10426, 10430, 10444, 10463) work tree 9392 at
(100.5, 50.5) and drop at the town centre 9352 (100, 55). 9392 runs out at about 406.8 s. The only
other trees (master 348) within reach are 9397 (97.5, 50.5; live, 100 wood) and 9396 (97.5, 60.5;
felled, 100 wood, 0 workers, on the far side of the TC).

Truth, worker count of 9397 (dword obj+0x18c, from the raw bytes in truth5): 2 at 406874 ms (10415
and 10421, which lost 9392 on their walk back), **3 at 407316 (10444)**, 4 at 409331 (10430), 5 at
411216 (10426), 6 at 414375 (10463). 9396 keeps 0 workers.

10444 side by side:

| | truth | engine (P24_1) |
| --- | --- | --- |
| 407095/407160 ms | (99.9462051, 52.7465) walking to TC, held 10, action state 8 | same bits; arrives (99.94621, 52.8) at tick 31152 |
| after the drop | 407316: held 0, **state 12** (Attack on a live tree), point (97.5, 50.5), path target 9397, waypoints (99.9462, 52.8) (99.2299, 51.5015) (98.2, 50.99), position (99.896, 52.7089) | tick 31153 (407173): held 0, **state 4** (walk to a felled tree), then moves west along y = 52.8 to x = 99.8 and from tick 31169 with step (-0.00298, +0.00996) = the unit vector towards (97.5, 60.5) = tree 9396; at 411944 ms it is at (98.75157, 56.30996) |
| later | 413257: 9397 felled; 10444 gathers it | walks round the TC to 9396 |

Wood: truth 364.021 until 410.982, 373.380 at 411.216 (10426's 9.359). Engine has 373.381 already at
410.982. In truth 10426 stands still next to the TC from 407.55 to 408.6 s (path state shows the
walk's wait) because 10444/10415/10421 cross in front of it on their way to 9397; in the engine
10444 is not there.

## 1. Address table (188329, RVA)

| Role | RVA | Engine |
| --- | --- | --- |
| Hunt update, state 8 after the deposit, no target: `ai->vt[0x80](ai, kind, -1, kind==0 ? 2 : -1, 0, 2, -1.0, -1.0)` | 0xbb6230 (0xbb7a05 slot 0x1b0, 0xbb7a11..0xbb7a4d the call: r9d = 2 when the kind is 0 else -1, r8d = -1, stack 0, 2, -1.0, -1.0; `out_c/h1.c` line 487) | `gathering/hunt/unit.rs:478-486` (`hunt_next_search`, cap 2 for wood) |
| Villager unit AI vtable | 0x3245908 (slot 0x1b0 = 0xcf9c60, slot 0x80 = 0xd23bf0) | |
| `ClosestResourceObject(resourceType, dropsiteID, maxWorkers, out, minState, x, y)` (log string 0x3248d40 "Entering ClosestResourceObject: resourceType=%d, dropsiteID=%d, maxWorkers=%d.") | 0xd23bf0..0xd243b9 | `gathering/closest_resource.rs:67` `closest_resource_of` |
| Tile search (unit, kind, current target id, point, seed lo, seed hi, box lo, box hi, range, per-side byte, max tests) | 0xd19f60..0xd1b0d0 | `gathering/gather_search.rs:432` `closest_resource_at` |
| First resource object of the kind on a tile | 0xd1bfa0 | `gather_search/passes.rs:176` `first_resource` (already 188329) |
| Free-side counter of an impassable resource tile | 0xd1c390 | none |
| Reach test for a low-priority candidate (slot 0x408 with range, -1, -1, 1) | 0xd19ea0 | `closest_resource.rs:190-199` `reach` |
| "Current target still good" test | 0x107af40 | none |
| Tile passable for the unit (terrain word & (mask^0xff) == 0 and & 0x4000 == 0) | 0x12426a0 | `closest_resource.rs:188` `passable` |
| Tile explored by the unit's player | 0x17324e0 | `closest_resource.rs:187` |
| Queue push (index, steps u16, flag u8) | 0xd0ac80 (seeds), 0xd0ab20 (neighbours) | |
| Seed sort (insertion sort up to 32, else stable merge) by squared tile distance from the unit's tile | 0xd0b0c0 / 0xd0b210 | |
| Unit slot 0x528 / 0x280 (base unit vtable 0x32a4698) | 0x113c090 (returns 0) / 0x11390b0 (returns 0.0) | |
| Statics: seeds 0x42c47a0, visited bitset 0x42c47c0, per-tile (count, side mask) bytes 0x42c47e8, queue 0x42c4808 with head 0x42c4820, direction order 0x42c482c | | |
| Direction table (0,-1) (-1,0) (0,1) (1,0) | 0x324a1c0 | |
| Constants 1.4, 0.61, 0.1 | 0x324efe4, 0x324efe0, 0x3202890 | `GatherSearchTuning::diagonal`, `ROUNDING` |
| Log strings "Found a target: %d", "Found a potential low priority target: %d", "Found a low priority target: %d" | 0x324bab8, 0x324bad0, 0x324bb00 | |

## 2. The original's logic

### 2.1 0xd23bf0 (wrapper)

1. Unit state below `minState` (param 6): return -1.
2. `maxWorkers` (r9d) is stored only for the log call (0xd23c69, inside `if (1 < byte[0x4356c83])`).
   It is never read again and is **not passed** to 0xd19f60 (calls at 0xd24221 and 0xd24363).
3. No site (id -1 or not found): point = (x, y) arguments, or the unit's place when both are -1.0;
   P = truncated point. `r = (int)unit.vt[0x228]() + 5` (line of sight + 5), `half = r*3/2`.
   Call `0xd19f60(unit, kind, ai+0x48, P, P, P, P-half, P+half, r, 2, 30)` (0xd242f0..0xd24363).
4. Site found: `zone(site tile)` (0x12538d0) against the unit's zone (0x124d000); different and the
   site's master is not 45 / 2172: as step 3 with P = the site's tile (range from the unit's sight).
   Else footprint search: `r = (int)site.vt[0x228]() + 10`, `half = r*3/2`, seeds box
   x from `max((int)(sx - rx) - 1, 0)` to `min((int)(sx + rx), w-1)`, y alike, box = site tile ± half,
   per-side byte = `unit.vt[0x528]() ? 0xff : 2`; found: return it (out argument = its distance).
   Not found: step 3 from the unit's own tile.

### 2.2 0xd19f60 (tile search)

Entry: `corners = (byte[0x42bde58] == 0)`; that byte has no other reference in .text and no pointer
to it in the image, so it stays 0 and `corners` is true.

1. Clamp the box to the map; area <= 1: return -1. Clear the statics; visited and the (count, mask)
   table are sized to the box.
2. Seeds: every tile of the seed box (y outer, x inner) inside the box with `passable == 1`:
   visited, appended. Sorted (stable) by squared tile distance from the unit's own truncated position.
   Each is queued with steps 0 and `flag = |P.y - y| < |P.x - x|`.
3. `best = -1, best_score = 1000000, tested = 0`. While the queue has entries and `tested < 30`: pop
   the head (tile T, steps, flag). Direction order: flag 0 -> (-1,0) (1,0) (0,-1) (0,1); flag 1 ->
   (0,-1) (0,1) (-1,0) (1,0) (0x42c482c = 0x2000301 / 0x3010200). For each direction d (stop when
   `tested >= 30`), N = T + d:
   - N outside the box: next.
   - `dist` = the 1.4-per-diagonal measure from P to N (`(int)(short*1.4 + 0.61) - short + long`);
     `dist > range`: next (not marked).
   - N not explored: next (not marked).
   - `obj = 0xd1bfa0(unit, kind, tile N)`, `pass = passable(N)`.
   - obj present:
     - `pass == 0` (tree, mine): `sides = 0xd1c390(unit, index N, N, d, box, table, per_side, corners)`:
       `b = (d - 2) & 3` (the side of N that faces T); `mask[N] |= 1 << b`; `count[N] += per_side`;
       with `corners`, for `b2 = b+1` and `b2 = b-1` (mod 4): corner tile `C = N + dir[b] + dir[b2]`;
       C not passable: `count[N] -= 1` when C is outside the box or `count[C] != 0`; C passable and
       `mask[N]` has bit b2: `count[N] += 1`. Returns `count[N]` (a byte).
     - `pass != 0`: `sides` = per_side for every neighbour of **T** (in the direction order) inside
       the box that holds no resource of the kind and is passable (0xd1ac40..0xd1acdf).
     - `cap = (current == obj.id) - obj.workers(+0x18c) + sides` (0xd1ad39..0xd1ad4c).
     - `cap > 0`: `tested += 1`; reach test `unit.vt[0x408](unit, id, range0, &out, -1, -1, 1)` with
       `range0 = unit.vt[0x528]() ? unit.vt[0x280]() : (0x15fe460(world) ? 0.1 : 0.0)`.
       Not reached: go to "mark". Reached and (`current != id` or `0x107af40(unit, obj)` false):
       **return id** (high dword = dist; log "Found a target"). Reached, current, 0x107af40 true:
       continue as a low-priority candidate without another reach test.
     - low priority (cap <= 0, or the current-target case): `score = steps(T) - cap`;
       `score >= best_score`: mark. Else (unless already reached) `tested += 1` and
       `0xd19ea0(unit, obj, 0)`; fails: mark. Else `best = id, best_score = score, best_dist = dist`.
   - mark: N not visited: set it and, when `pass != 0`, queue (N, steps + 1, flag = N.x != T.x).
4. Queue empty or 30 tests: return `best` (or -1).

So a resource on an impassable tile is looked at once from each free neighbouring tile the flood
pops, and each look adds 2 (+-1 for corners) to its capacity. An isolated tree seen from two sides
takes 5 workers at once and all later ones as "low priority" when nothing else has room.

## 3. Confirmed difference and the fix

**D1 (confirmed on both sides): no worker cap; capacity from free sides.**

- 188329: sections 2.1 step 2 and 2.2 (0xd23c69 the only use of r9d; 0xd1ad39 `cap`).
- Engine: `gather_search.rs:474-477` turns `max_workers` into `cap`, line 510 `if o.workers < cap`
  takes the object, else it is only a fallback (fewest steps); line 507 skips the unit AI's current
  target; lines 493-500 test the popped tile itself and re-sort the queue by distance; line 519
  stops after more than 30 resource tiles seen. Callers pass 2 for wood: `hunt/unit.rs:481-486`,
  `hunt/next_tree.rs:64-69`.
- Reproduction: `python3 out_p24/crs.py` (port of 0xd19f60/0xd1c390 on the tiles of this case:
  TC 98..101 x 53..56, trees at (97,50) and (97,60), all tiles explored, reach always true):

```
unit 10444 ms 407173 workers(9397) before 2 -> 188329 port: (9397, 3) | engine rule (cap 2): 9396 | truth: 9397 (workers -> 3)
     tile (97, 50) from (97, 51) steps 3 id 9397 sides 2 cap 0
     tile (97, 50) from (98, 50) steps 3 id 9397 sides 5 cap 3
unit 10430 ms 409331 before 3 -> 9397 (engine rule: 9397, 9396 out of range) | truth 9397 (-> 4)
unit 10426 ms 411216 before 4 -> 9397 (engine rule: 9396) | truth 9397 (-> 5)
unit 10463 ms 414375 before 5 -> 9397 after a third side (sides 8, cap 3) (engine rule: 9396) | truth 9397 (-> 6)
```

  The engine's own choice (9396) is confirmed by the P24_1 trace (heading of 10444 from tick 31169).
  This is a reproduction of the choices, not of bits: the tile map of the port is hand-built from
  the truth objects.

**Engine change** (new switch `GENIE_EXPERIMENT_RESSEARCH_188329`; file
`gathering/gather_search.rs`, function `closest_resource_at`; at its top, after the `min_state` and
pasture checks, `if std::env::var_os("GENIE_EXPERIMENT_RESSEARCH_188329").is_some() { return
closest_resource_at_188329(...) }`). New function, same reads (`explored`, `passable`, `objects` +
`first_resource`, `reach`), `max_workers` unused:

```rust
const DIRS: [(i32, i32); 4] = [(0, -1), (-1, 0), (0, 1), (1, 0)];
// one call of 0xd19f60
fn pass_188329(point: Tile, unit_tile: Tile, seeds_box: (Tile, Tile), half: i32, range: i32,
               per_side: u8, current: Option<ObjectId>, ...) -> Result<Option<(ObjectId, i32)>, GenieError> {
    let (x0, y0) = (clamp(point.x() - half, 0, w - 1), clamp(point.y() - half, 0, h - 1));
    let (x1, y1) = (clamp(point.x() + half, 0, w - 1), clamp(point.y() + half, 0, h - 1));
    let bw = x1 - x0 + 1;
    if (y1 - y0 + 1) * bw <= 1 { return Ok(None); }
    let inbox = |t: Tile| x0 <= t.x() && t.x() <= x1 && y0 <= t.y() && t.y() <= y1;
    let at = |t: Tile| ((t.y() - y0) * bw + t.x() - x0) as usize;
    let mut seen = vec![false; area]; let mut count = vec![0u8; area]; let mut mask = vec![0u8; area];
    let mut seeds = vec![];                                   // y outer, x inner
    for y in seeds_box.0.y()..=seeds_box.1.y() { for x in seeds_box.0.x()..=seeds_box.1.x() {
        let t = Tile::new(x, y);
        if inbox(t) && passable(world, t) { seen[at(t)] = true; seeds.push(t); } } }
    seeds.sort_by_key(|t| (t.x() - unit_tile.x()).pow(2) + (t.y() - unit_tile.y()).pow(2)); // stable
    let mut queue: Vec<(Tile, u16, bool)> = seeds.iter()
        .map(|&t| (t, 0, (point.y() - t.y()).abs() < (point.x() - t.x()).abs())).collect();
    let (mut best, mut best_score, mut tested, mut head) = (None, 1_000_000i32, 0, 0);
    while head < queue.len() && tested < 30 {
        let (t, steps, flag) = queue[head]; head += 1;
        let order: [usize; 4] = if flag { [0, 2, 1, 3] } else { [1, 3, 0, 2] };
        for &d in &order {
            if tested >= 30 { break; }
            let n = Tile::new(t.x() + DIRS[d].0, t.y() + DIRS[d].1);
            if !inbox(n) { continue; }
            let dist = pass_distance(point, n, tuning);
            if dist > range || !explored(world, n)? { continue; }
            let pass = passable(world, n);
            if let Some(o) = first_resource(&objects(world, n)?, kind)? {
                let sides: i32 = if !pass {
                    let b = (d + 2) & 3;
                    mask[at(n)] |= 1 << b;
                    count[at(n)] = count[at(n)].wrapping_add(per_side);
                    for b2 in [(b + 1) & 3, (b + 3) & 3] {
                        let c = Tile::new(n.x() + DIRS[b].0 + DIRS[b2].0, n.y() + DIRS[b].1 + DIRS[b2].1);
                        if !passable(world, c) {
                            if !inbox(c) || count[at(c)] != 0 { count[at(n)] = count[at(n)].wrapping_sub(1); }
                        } else if mask[at(n)] & (1 << b2) != 0 { count[at(n)] = count[at(n)].wrapping_add(1); }
                    }
                    i32::from(count[at(n)])
                } else {
                    let mut s = 0;
                    for &b in &order {
                        let a = Tile::new(t.x() + DIRS[b].0, t.y() + DIRS[b].1);
                        if inbox(a) && first_resource(&objects(world, a)?, kind)?.is_none() && passable(world, a) {
                            s += i32::from(per_side);
                        }
                    }
                    s
                };
                let is_current = Some(o.id) == current;
                let cap = i32::from(is_current) - o.workers.get() + sides;
                let (mut reached, mut skip) = (false, false);
                if cap > 0 {
                    tested += 1;
                    if reach(world, o.id)? {
                        if is_current && current_still_good /* 0x107af40, see section 5 */ { reached = true; }
                        else { return Ok(Some((o.id, dist))); }
                    } else { skip = true; }
                }
                if !skip {
                    let score = i32::from(steps) - cap;
                    if score < best_score {
                        let ok = reached || { tested += 1; reach(world, o.id)? };
                        if ok { best = Some((o.id, dist)); best_score = score; }
                    }
                }
            }
            if !seen[at(n)] { seen[at(n)] = true; if pass { queue.push((n, steps + 1, n.x() != t.x())); } }
        }
    }
    Ok(best)
}
```

and the wrapper (0xd23bf0), `u` = unit's truncated place, `los` = unit's sight truncated:

- no site: `pass_188329(point = search-origin tile, unit_tile = u, seeds (P, P), half = (los+5)*3/2,
  range = los+5, per_side = 2)`.
- site with `footprint` (same zone or dock): `pass_188329(point = site tile, unit_tile = u, seeds =
  the footprint box of `footprint_seeds` (x0..x1, y0..y1), half = (site_los+10)*3/2, range =
  site_los+10, per_side = 2)`; none found: the no-site call from `u`.
- site without `footprint`: the no-site call with point = the site's tile.

`tested` starts at 0 in every call. The out argument is the returned `dist`.

## 4. Suspected (not confirmed)

- Reach range: 188329 passes 0.1 when `0x15fe460(world)` is true (a global at 0x4357fe0 with two
  non-null pointers), else 0; the engine passes `Distance::ZERO` (`closest_resource.rs:197`). The
  runtime value was not determined.
- `per_side` 0xff for units whose slot 0x528 returns true (footprint pass only); the base unit's
  returns 0. Which classes override it was not checked.
- Box half-size: engine `(los+10)*3/2`, 188329 `(los+5)*3/2` (no site). Only matters for the corner
  rule "outside the box" and for clipping.

## 5. Not read

- 0x107af40 beyond its shape (current target: compares a gap times a constant with a value from
  the unit's path data); only reached when the unit AI's current target is found with room. In this
  case `ai+0x48` is -1.
- 0x17324e0 (taken as "explored", as the engine does), 0x120ff70 (slot 0x408), 0xd0b210 (taken as
  the stable merge sort used above 32 seeds).
- The Gather action's and the Build action's callers in 188329 (they call the same slot 0x80).
- 158041 itself: the engine's current rule is only what its doc comments say.

## 6. What else the change affects

Every caller of `closest_resource_at`: Hunt after the drop (`hunt/unit.rs:486`, trees and boar
kind 5), Hunt's next tree on a lost/failed walk (`hunt/next_tree.rs:64`), Gather after the drop
(`gathering/drop_off.rs:127`), the builder's next work (`construction/build/more_work.rs:162`), the
unit AI's searches (`unit_ai/update.rs:492, 620`, `unit_ai/order_kinds.rs:404`,
`orders/start_work.rs:230`) and the mule cart (`gathering/mule_cart.rs:171`). Expected visible
effects: more than 2 lumberjacks per tree, different tie-breaks between equally near resources
(direction order instead of distance sort), the unit AI's current target allowed again, gold/stone/
bush choices by free sides. It needs a full three-replay run before going default.

Next step: implement the switch, rerun 518470161 with `GENIE_TRACE_OBJECTS_RANGE=31100-31520` and
check with `cmp_pos.py` that 10444 matches the truth samples 407316..411216 (state 12, waypoints
(99.9462, 52.8) (99.2299, 51.5015) (98.2, 50.99)).
