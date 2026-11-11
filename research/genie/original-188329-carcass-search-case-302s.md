# P21: 518470161 P1 307.7 s (A) and 517426097 P1 282.4 s (B)

RVAs in `AoE2DE_s_unpacked.exe` (188329). Engine paths relative to `genie/crates/engine/genie-core/src/`
(PC source 2026-11-12, default switches). Runs (PC `runs\`): `R3_a1` (518470161, OBJECT 22950-23520, all
objects), `R3_a2` (518470161 to 23100, `GENIE_LOG_HUNT_SEARCH=1`, ids 10406/9513/9522/10451),
`R3_b1` (517426097, OBJECT 20990-21500, all objects), `R3_b2` (517426097, OBJECT 17300-21000, ids 2976/3824/3505).
Update <-> ms: 518470161 u = 22999 + (ms-301171)/13; 517426097 u = 20999 + (ms-275857)/13.

## 0. Result

**(A) independent, cause found and confirmed.** P1 shepherd 10406 (master 592) finishes its state-11 walk at
its hunt point (101.020836, 56.775) = the place of the dead sheep 9522 (gaia, state 5, ~79.4 food), Hunt
`set_state(3)` -> notify 0x202 (0x265, class 58, drop site) -> villager AI. 188329 runs the **three-pass
livestock search** in the notify handler (R2-D8b, never implemented) and picks the carcass 9522 (truth
ai+0x48 = 0x2532 from 302.497 s, held rises 0.0386, 0.1158, ...). The engine (`hunter_search`) does one
`ClosestObject` over any state and picks the **live sheep 9513** (`R3_a2`: `HUNTER_SEARCH origin=(101.020836,
56.775) class=58 found=9513`, update 23090, 302.354 s), kills it (9513 player 0 state 4 from 303.264 s), gathers
from 303.94 s. Hence P1 unit count 26 -> 25 (word 6), word 2 -1060 (= master 1060 of the sheep), word 3/4/10,
positions (10451 at 304.967 s, then 9513), and the later food -10 at 320.255 s. All P1 positions matched until
302.35 s; the only earlier differences (`R3_a1` cmp_pos) are P2 units and gaia boar 9721 around x 26-30
(P2's 216.7 s shepherd chain), 70+ tiles away and not an input of this search: 9522 / 9513 / 10406 are
identical on both sides at 302.34 s. Only dead livestock in reach: 9522 (the other carcass 9518 is at (27.5, 36.7)).

**(B) independent of the scout 2976, not solved.** `R3_b2`: scout 2976 differs from 228.485 s by <= 3e-4
tiles; `R3_b1`: from 275.9 s on the scout matches again and the only differing objects (all players, gaia) are
P1 villager 3824 (master 122) and later 3848. 3824 first differs at 258.424 s (update ~20044) at (88.33, 80.78),
>20 tiles from the scout (67.7, 63.4). Truth: move order to (85.6976, 84.0561); the short path
[(87.4476,79.9432),(88.3482,79.9469),(88.3482,80.7469),(87.5,80.7442)] is replaced at 257.462 s by
[(88.3482,79.9469),(88.3482,80.7469),(85.6976,84.0561)] (nw 4 -> 3) and after (88.3482, 80.7469) the unit heads
straight for the goal (step (-0.1365,+0.1705)/273 ms). Engine heads elsewhere (step (-0.0876,+0.2001)), i.e. a
different next waypoint after the short path's end. A walk / short-path-tail case for a separate helper
(start: STEER trace updates 19960-20060, ids 3824).

## 1. Address table

| RVA | What |
|---|---|
| 0xd004a0 | villager AI notify handler (decompile `out_p18/vn.c`) |
| 0xd0118x.. | case 0x1fb/0x1fc/0x202 block; `[ai+0x44] != 600`; `[ai+0x44] == 0x265` hunter branch (0xd011a5) |
| 0xd0122c | slot 0x1b0 (0xcf9c60) on the class: 58 -> 0xff (no kind) |
| **0xd0139f / 0xd013ae** | **`notify p0 ([r12+0xc]) == 0x265` and `notify p1 ([r12+0x10]) == 0x3a` -> three passes** |
| 0xd013ca..0xd013f3 | objects of notify sender (p[0], the unit) and notify p2 (drop site) via 0x141616cf0 |
| 0xd0142c | pass a: 0xd22c20(ai, class, -1, **5**, -1, -1, &d, 1, -1, base = drop site) |
| 0xd0144c | gap = 0x124d8d0(unit, found) |
| 0xd0145a / 0xd01469 / 0xd0146f | R = maxss(unit slot 0x228, unit slot 0x2e0) |
| 0xd01473..0xd0148c | pass b only if found == -1, or (gap >= R and (float)(2*d) >= R) |
| 0xd014bb | pass b: 0xd22c20(..., **5**, ..., out none, base none = from the unit) |
| 0xd014d7..0xd014e4 | gap again; pass c only if found == -1 or gap >= R |
| 0xd01514 | pass c: 0xd22c20(..., **-1** (any state), ..., base = drop site) |
| 0xd01523.. | result -> slot 200 (HuntObject) as for the one-pass branch |
| 0xbb7aa8..0xbb7c39 | the same three passes in the Hunt after-drop (R2-D8, already in engine) - identical argument shapes |
| 0xd239eb..0xd23a43 | inside 0xd22c20: second-key point = head action's point (0xb89f30 -> 0xb6dc60/0xb6dc70) for unit type >= 0x28, else ai+0x50/+0x54 |

## 2. Original logic (notify 0x202 on a villager hunting livestock)

1. Hunt `set_state(3)` posts 0x202 with (0x265, hunt class, drop site id | 0 | -1).
2. Handler: AI action 0x265; class = p1, else ai+0x4c, else ai+0x70; slot 0x1b0(class) == 0xff.
3. If p0 == 0x265 and p1 == 58: a = ClosestObject(state 5, measured from the drop site, d = truncated best
   distance); R = max(los slot, search-radius slot); g = gap(unit, a).
   If a none or (g >= R and 2d >= R): a = ClosestObject(state 5, from the unit).
   g = gap(unit, a); if a none or g >= R: a = ClosestObject(any state, from the drop site).
4. Else one ClosestObject(any state) (what the engine does for every class).
5. a -> HuntObject (slot 200) and the processing breaks.

Case: pass a finds 9522 (only state-5 livestock in range; inside the TC's reach, so d = 0 and the second key is
the distance from the hunt point (= 9522's place) = 0); gap(10406, 9522) = 0 < R -> 9522. Truth: ai+0x48
0x2532 = 9522 between 302.263 and 302.497 s, gathering from 302.4 s, position (101.020836, 56.775) unchanged.

## 3. Confirmed difference

| | 188329 | engine |
|---|---|---|
| D8b | 0xd0139f..0xd01519 three passes for notify (0x265, 58) | `unit_ai/update.rs` 415-437 `hunter_search` `kind == None`: one `side.closest` with `state: None`, no base object (`R3_a2` HUNTER_SEARCH line) |

Implementation (under existing `GENIE_EXPERIMENT_HUNT_188329`):

1. `unit_ai/side.rs` trait `UnitSide`, two methods with defaults (test sides untouched):
```rust
/// 188329 0xd22c20 with its base object (`from`'s place and radii) and the second key's point.
fn closest_from(&mut self, search: &Search<'_>, from: Option<ObjectId>) -> Result<Found, GenieError> {
    let _ = from; self.closest(search)
}
/// 0x124d8d0: the gap between the unit's box and `id`'s; NaN for none.
fn gap_to(&self, id: Option<ObjectId>) -> f32 { let _ = id; f32::NAN }
```
2. `unit_ai/world_view/side.rs` (world impl):
```rust
fn closest_from(&mut self, search: &Search<'_>, from: Option<ObjectId>) -> Result<Found, GenieError> {
    use crate::map::spatial::{CLOSEST_FROM, ClosestFrom};
    let site = from.and_then(|id| self.c.w.spatial.get(id)).map(|q| (q.position, q.radius));
    // 0xd239eb: the head action's point (the Hunt in state 3 here)
    let point = self.actions.list.hunt().map_or((-1.0, -1.0), |h| (h.point.x(), h.point.y()));
    CLOSEST_FROM.with(|k| k.set(Some(ClosestFrom { site, point })));
    let out = self.closest(search);
    CLOSEST_FROM.with(|k| k.set(None));
    out
}
fn gap_to(&self, id: Option<ObjectId>) -> f32 {
    // same formula as gathering/hunt/unit.rs hunt_next_search `gap`
    let (at, r) = (self.unit.position(), /* unit master radius */);
    id.and_then(|id| self.c.w.spatial.get(id)).map_or(f32::NAN, |q| {
        let gx = ((q.position.x() - at.x()).abs() - (q.radius.x() + r.x())).max(0.0);
        let gy = ((q.position.y() - at.y()).abs() - (q.radius.y() + r.y())).max(0.0);
        crate::math::fmath::sqrt(gx * gx + gy * gy)
    })
}
```
3. `unit_ai/update.rs` `hunter_search`, `None =>` arm: build the `Search` with a `state` argument
(`search_of(state)`), then
```rust
let found = if std::env::var_os("GENIE_EXPERIMENT_HUNT_188329").is_some()
    && n.p[0] == AiAction::Hunt.value() && n.p[1] == 58
{
    // 188329 0xd0139f..0xd01519 (R2-D8b)
    let site = ObjectId::of_field(n.p[2]);
    let (los, sr) = (at.los.get(), at.search_radius.get());
    let r = if los >= sr { los } else { sr };
    let mut a = side.closest_from(&search_of(Some(ObjectState::Dead)), site)?;
    self.alert(a, at.dt_seconds);
    let (g, d) = (side.gap_to(a.id), a.distance.get());
    if a.id.is_none() || !(g < r || ((2 * d) as f32) < r) {
        a = side.closest_from(&search_of(Some(ObjectState::Dead)), None)?;
        self.alert(a, at.dt_seconds);
    }
    if a.id.is_none() || !(side.gap_to(a.id) < r) {
        a = side.closest_from(&search_of(None), site)?;
        self.alert(a, at.dt_seconds);
    }
    a
} else { let f = side.closest(&search_of(None))?; self.alert(f, at.dt_seconds); f };
```
(`a.distance` is the truncated distance the keyed search returns, as `hunt_closest_object_in` uses it.)

Expected check: run 518470161 to ~23100 with `GENIE_LOG_HUNT_SEARCH=1`: 10406 must take 9522 at update 23090
and held 0.0386 at 302.497 s; 9513 must stay alive; full run: P1 word mismatch 307.7 s and food 320.255 s move.

## 4. Suspected

- Why the engine's one pass prefers 9513 over 9522 at gap 0: probably a tie on the truncated stored distance
  (0 and 0) won by the lower id (`map/spatial/search.rs` `nearer` 724-734). Not traced.
- The 2d test and `(2*d) as f32` follow the after-drop port (findings 14); `cvtdq2ps` of `d+d` read at 0xd01480.
- Unit slots 0x228 / 0x2e0 = line of sight / search radius (as in the after-drop port; not re-read).

## 5. Not read

- 0x141616cf0 with p2 = 0 (no drop site) - assumed null object (= measured from the unit).
- 0xd22c20 point fallback ai+0x50/+0x54 when the head action is not the Hunt (not this case).
- (B): engine waypoint handling after the short path end for 3824 at 257.46-258.42 s (no original reading done).

## 6. Other situations affected

Every villager whose Hunt on livestock (class 58) reaches `set_state(3)` (target emptied at face, or the
state-11 search walk ending): shepherds on sheep/goats/llamas/turkeys etc. in all three replays (P2 shepherds
of 518470161 around 215-220 s, 518239882 sheep phase 100-250 s). Classes other than 58 and gather notifies
(0x261) unchanged. Needs full runs of the three replays to confirm no regression.
