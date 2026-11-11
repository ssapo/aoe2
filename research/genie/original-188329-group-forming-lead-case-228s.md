# P20: replay 517426097 (truth6), scout 2976, group forming without fitted values

Follows `out_p15/case_517426097.md` (findings 31). RVAs are in `AoE2DE_s_unpacked.exe` (188329).
Engine paths are relative to `genie/crates/engine/genie-core/src/` (PC source, 2026-11-12).
Decompiles: `out_p20/d1.c`..`d9.c` (list files `l1.txt`..`l9.txt`). Disassembly: `out_p20/ccl.asm`
(createColumnLine), `out_p20/mptf.asm` (movePositionToFront). Simulation: `out_p20/sim_p20.py`
(`python3 sim_p20.py [trace]`). No engine trace was run (the old ones from P15 sufficed: `e1_a`, `e1_b`, `e1_c`).

## 0. Results

1. **(a) The slot's initial lead is 0.8125 tiles, and it is read, not fitted.** 188329's
   movePositionToFront (0x10eed10) is new. After it picks the front member (as 158041 does), it puts
   the group **lead** tiles ahead of the members along a pather path from the goal W to the centroid,
   with `lead = 0.5 + line0.halfSpacing + distanceBack(line of the member's category)`. For 2976:
   collision x 0.25, spacing modifier (creatable `+0x8b8`, the dat's "flank attack modifier") 1.25.
   So the radius is 0.3125, the spacing 0.625, the half spacing 0.3125, and the lead is 0.5 + 0.3125 + 0 = **0.8125**.
   Both motion updates of the first group update only plan, so the group does not step in 17351.
   The slot (one unit, offset 0, createColumnLine 0x10da470) is the group's place: P0 + 0.8125·u.
2. **(b) Forming reset (0x110a52f..0x110a544):** in the TURN block, `if |angle(newFwd, oldFwd)| > π/4
   (0x3203a64) && flags & 0x4000 { +0x5cc = 0 }`. Then the relayout runs as in 158041. A turn of π/4 or less relays out
   only with motion NEW or 0x4000, and then it does not reset the flag. **New in 188329:** every non-queued `commandMoveTo` that is
   not HOLD or LEG, with its new last argument set (BUnitGroup::command passes 1), sets flags `0xc000` (0x10d8ec1..0x10d8edf).
3. **(c) The `+0x178` budget starts at 0.** The constructor writes it at 0x10be829 (`mov [rdi+0x178], ebp`, ebp=0), after the memset of 0x5d0
   bytes at 0x1601b10. The only float writer in group code is 0x110b3a3. `+0x174` = 0 (memset), then the slowest speed.
4. **(d) The walk and `+0x400`:** `+0x400` is the unit's velocity data (0x18 bytes: velocity
   xyz, acceleration xyz). The group steer's slot 0x5e0 (0x121ecc0) writes velocity.y (`+8`, 0x1075e00).
   The unit update (0x120dd30) calls 0x1076000(vel, unit, dt): `speed = slot0x628(vel.y, acc.y, dt)`
   (0x120f490). For a group member with no own-move reason (-1) this is `wanted = acc.y*dt + vel.y`,
   kept when `0 <= wanted < 10.0` (0x31fd87c). An own-move member walking gets `S(3.0, 1.2)` = 1.2× its speed. Aside (2) gets 0. A
   non-member is capped at slot 0x220. The result is stored to `+8`, then slot 0x5f8 moves the unit `dt*speed` along its forward.
   The plain position read by every group gap (slot 0x568, 0x113c480) is `+0x3bc`.
5. **(e) The engine's stall at 17353** comes from 158041 logic. The engine group starts on P0 and steps 1.2·dt per update (no
   0.5 rule), so the slot leads the unit by about one step. `steer_member` (`groups/steer/slot_steps.rs` 187)
   gives "within radius → group top 1.2". `passes_waypoint(slot, at, projected)` lands on the slot within rounding, and
   at 17353 the rounding makes it "pass". The result is `SlotState::Stopping`, `stop_at_slot`, and no step. After that the slot leads by 2
   steps, so the stall does not repeat. (Engine code read; the rounding moment was not traced.) In 188329 the slot leads by 0.64..0.83, so the
   pass test (0x110fac0 at 0x10f0554) never fires here.
6. **Reproduction:** the read rules alone give 17355, 17372 and 17381 within 2-3 ulp (constant +2.8e-5 tiles
   along the move, so the gap opens in the first ticks). With one more first-tick condition the three truth
   points match **bit for bit** (0x42854fa0/0x42c1e9aa, 0x428585c5/0x42c17f25, and wp0 0x4285a20c/0x42c14785): the
   **first speed pass (17351) measures the gap from the unit's place one step back** (its place after 17349, gap
   +0.01505). Any extra in [0.0133, 0.0158] gives the same bits. Then the `Up` order's MoveTo (stall at 17382, 12
   steps at 1.2) gives truth 17394 (66.90155, 96.47288) bit for bit. The first-tick condition is not read (section 4).

## 1. Address table (188329)

| RVA | What |
|---|---|
| 0xf510c0 | MOVE handler: splitter 0x10b6e50, new group 0x1601b10, AddUnit 0x10d3c50, stats 0x10d52f0(g,0), SetInitialPosition 0x1107370, command 0x10d7600 |
| 0x1601b10 | new group: alloc 0x5d0, memset 0, ctor 0x10be760 |
| 0x10be829 / 0x10be99e | ctor: `+0x178 = 0` / `+0x5cc = 0` |
| 0x10d7600 | BUnitGroup::command; no task → 0x10d8e60 with arg12 = 1 (0x10d785d / 0x10d790f) |
| 0x10d8e60 | commandMoveTo; 0x10d8e9b clears only bit 12; 0x10d8ec1..0x10d8edf `!queued && arg12 && !hold && !leg → flags |= 0xc000`; layout 0x110c670(g, 1 column / 2 line) only without motion NEW; ends with `flags |= 0x100` |
| 0x1109d70 | group update; STATISTICS stats early; 0x110a3xx PLACE_AGAIN → 0x1107370; motion 0x1114830 |
| 0x110a516..0x110a6ac | TURN block: angle 0x96e910(+0x14, saved fwd); `> π/4`: reset `+0x5cc` if 0x4000; relayout: clear stored positions 0x10f5e70, movePositionToFront 0x10eed10 (or centroid when walked level id -1), UpdateDesiredPositions(-1) 0x110c670, populate 0x110d690 + 0x10d4a50, clear 0x4000; then 0x11123c0, motion 0x1114830(g,1), FormationTransform 0x11079e0, clear 0x100 |
| 0x1114830 | BMotion update: path step 0x1114a30, `v += dt*acc`, pos += dt*v along fwd/right/up |
| 0x10eed10 (0xb80) | movePositionToFront. 0x10ef2d5: xmm12 = 0.5 (0x31b1420); 0x10ef2fc: `+= lines[0].+0x18`; 0x10ef346: byte 0x408ec78 (=1 in image, its only access is this read) selects 0x10ef390..0x10ef474: `+= line.+0x14` of the first line holding a slot of the chosen member's category (0x10d9790); else column `count*s+d-s` / other `d+s`. 0x10ef4d4 pather 0x1058020(world+0x140, master); W = last point of the walked path (0x106f250) when the walked level byte `+0x14` != 0, else the parent's waypoint at least 10.0 ahead; 0x10ef69f FUN_1410532b0(pather, path, W.x, W.y, centroid +0x144/+0x14c, range `+0x3e0 + master[0x78]`, 0, target, unit); 4/5 → stand on the member's place; 0x10ef6b7/0x10ef704 d = min over chosen + members of 0x10d1b10(path, p); 0x10ef71e formed → lead = min(0.1, lead); 0x10ef738 `d = max(d - lead, 0)`; patrol (0x110ffd0) or 0x800 → `max(d, 0.5)`; 0x10ef7bb point = 0x106e0b0(path, d) (fewer than 2 points → (0,0,0)); → +0x38, +8 |
| 0x10d1b10 | distance along a path of a point's projection (t clamped to [0,1], segment sums plus the 3-D distance to the projection) |
| 0x106e0b0 | point at distance d along a path (`p[i-1] + ((d-acc)/len)*(p[i]-p[i-1])`, ground length) |
| 0x10da470 | createColumnLine: single = (0,0,-spacing); line start = (n/2)·single (+ base 0), even count −½ single; `line.+0x14` = distance back, `line.+0x18 = spacing * 0.5` (0x10daf62) |
| 0x11079e0 / 0x11097e0 | FormationTransform / slot transform: slot `+0x14/+0x18` = point + rot(offset); line 0's point = FindPointFromFront (0x10dc970) or pos − fwd·back |
| 0x10d52f0 | statistics (near count 0x10d56a8, slowest 0x10d5872, `+0x174` 0x10d5a8e, top 0x10d5ad8..0x10d5b21) |
| 0x110b15c..0x110b3db | speed pass (gap = `sqrt(dy²+dx²)` slot `+0x14/+0x18` − slot 0x568) |
| 0x10d6960 | S(g, k) |
| 0x110b85b..0x110b870 | formed flag |
| 0x113c480 | unit slot 0x568: `+0x3bc` (x, z, y) |
| 0x121ecc0 / 0x1075e00 | slot 0x5e0: create `+0x400` (0x18) if missing and speed != 0; `+8 = speed` |
| 0x120dd30 → 0x1076000 | unit update → velocity step: 0x628 (0x120f490), store `+8`, 0x5f8 move `dt*speed` |
| 0x120f490 | next speed (group cases above) |
| 0x120d0d0 | slot 0x220: master speed × sprite `+0xc` (if > 0) + master speed × `+0x3a4` (if `+0x3a0` != -1), attr 5 |

Dat (empires2_x2_p1.dat, unit 448 SCOUT): collision (0.25, 0.25, 2.0), speed 1.2, creatable rear 0.0,
flank/spacing 1.25, formation category 1; walking graphics SCOUT_W0/W1 factor 1.0.

## 2. The original's logic for this case (steps)

Update 17351, command phase: a group of one; creation stats (no formation, so near = 0): `+0xbc = 0.5*1.2 = 0.6`,
`+0x174 = 1.2`, centroid = P0. commandMoveTo: path [place, W]; flags |= 0xc000 (fresh move); motion NEW → no layout; flags |= 0x100.
Group update 17351: stats; PLACE_AGAIN → spiral spot; motion #1 plans; TURN: angle about 15° (≤ π/4), and 0x4000 is set → relayout:
movePositionToFront → G = W + ((L−0.8125)/L)(P0−W); layout (one slot, offset 0); motion #2 plans;
transform → slot = G. CATCHING_UP cleared; speed pass (forming): `lo = S(gap,1.0)`, `hi = S(gap,1.2) > 1.2` → E > B = 0
→ spd = lo; steer: velocity.y = lo, gap > 0.25 → CATCHING_UP → stays forming. Unit update: step dt·lo toward the slot.
Updates n > 17351: motion G += dt·top(n−1)·dir; stats: near from the last transform's slot and +0x3bc (always 0
here) → top = 0.6; transform; pass; steer; unit step. The speed falls from 1.0696 (17351) to 1.0386 (17381).
17382: the `Up` order takes the unit out of the group and gives it a MoveTo from wp0 = its 17381 place (bit-exact above).

## 3. Confirmed differences and the engine change (switch `GENIE_EXPERIMENT_FORMING_188329`)

Each item: 188329 read (address) / engine read (file:line) / change. Switch helper as in
`unit_ai/idle_animals.rs` 34-37 (`static OnceLock<bool>`, `std::env::var_os(..).is_some()`), e.g. `groups::forming_188329()`.

**F1. UnitGroup fields** (`groups/mod.rs` 382, struct `UnitGroup`): add `pub slowest_speed: f32` (+0x174),
`pub speed_budget: f32` (+0x178), `pub formed: bool` (+0x5cc). All are 0/false in `UnitGroup::new` (ctor 0x10be829/0x10be99e).
They are not saved by the 158041 save: keep them out of the save mapping, or give them defaults on load. A scratch `member_speeds: Vec<(f32, f32)>` can be local.

**F2. commandMoveTo flags** (0x10d8e9b..0x10d8edf / `groups/command.rs` 274 `command_move_to`, 360-369
`set_move_level`): under the switch, at the start of `command_move_to`, clear only `FOLLOWED` (158041 also clears
`MEMBERS_SENT`; keep that unless shown otherwise). Then, when `!queued && fresh && !HOLD && !LEG`, set
`RELAYOUT_AT_TURN | PLACE_AGAIN`. `fresh` is a new `MoveTo` field, true for the call from `BUnitGroup::command`
(groups/order.rs move path) and for the queue run (0x110c0e9/0x110c568 pass 1). Most callers pass 1; 0x10d706e passes 0.
The other callers (0x10640f5, 0x10d38c6, 0x10d8184) pass a register: not read.

**F3. Statistics** (0x10d52f0, 0x10d56a8..0x10d5b21 / `groups/stats.rs` 110 `statistics_only`, 536 `member_totals`,
138-141): in the member loop, when the group has a current formation, find the member's first slot (by `unit_id`). If
`m.specific_move.active == 0` and `sqrt(dy*dy + dx*dx) < 0.25`, count it as near. Here dx = slot.transform_position.x − p.x,
dy = .y − p.y, and p is the unit's **current position** (slot 0x568 = `+0x3bc`, not `moved_vector`). After the loop, when
held > 0: `g.slowest_speed = slowest`. Replace 138-141 with:
`top = slowest; if near == 0 { top = top * 0.5 } else if flags.contains(CATCHING_UP) || !formed { top = top * f32::from_bits(0x3f555555) }`.
Then `maximum_velocity_forward = top`. When held == 0, `slowest_speed = 0` (0x10d5a8e writes 0 without members).

**F4. movePositionToFront tail** (0x10ef2ca..0x10ef7e6 / `groups/place.rs` 284 `move_position_to_front`, 397-401):
keep the member choice. Under the switch, replace "stand on `at`" with:
1. Clear the stored positions (as now).
2. `lead = 0.5 + lines[0].spacing_half` (`+0x18`, = sub-formation spacing × 0.5; only when the formation has lines, slots and
   a lines array). Then, since byte 0x408ec78 is 1: find the chosen member's sub-formation category; if the group's unit-kind list holds it,
   take the first line (in order) that has a slot whose `desired_category` equals it, and add that line's `distance_back`.
   The layout must keep `spacing_half` per line (createColumnLine 0x10daf62; the engine's `column_line.rs` lines carry
   `distance_back` only: add `spacing_half = cat.spacing * 0.5`).
3. If `formed`: `lead = min(0.1, lead)`.
4. W = the walked path's last point when the walked level's byte `+0x14` != 0 (the move's level 2). Else the parent level's
   waypoint at least 10.0 (ground, summed) beyond its current waypoint. No path → keep `at`.
5. The path: the lead unit master's long pather from W to the centroid (`g.centroid`, `+0x144`/`+0x14c`), range =
   the group target's range (`+0x3e0`) + master `+0x78`. On open ground this is `[W, centroid]`. The general pather
   (FUN_1410533b0, limit 1000) was not read: start with the straight 2-point path when the line W→centroid is clear, and
   return `Unsupported` otherwise. A result of 4/5 → stand on `at` (old behaviour).
6. `d = min(pathDist(at), pathDist(member p) for each member)` (0x10d1b10: project onto each segment with
   t clamped to [0, 1], take the nearest; the sum of the earlier segment lengths plus the 3-D distance to the projection).
   `d = max(d - lead, 0)`; patrol or PATROL flag → `d = max(d, 0.5)`.
7. `G = pointAt(path, d)` (0x106e0b0: ground segment lengths, `p[i-1] + ((d−acc)/len)·(p[i]−p[i-1])`; fewer than 2 points → (0,0,0)).
   `position[0] = new_position[0] = G`.
For one unit: G = W + ((L−lead)/L)(C−W). The group no longer starts on its front member.

**F5. Forming reset** (0x110a52f..0x110a544 / `groups/update/awake.rs` 296 `turn_formation`, 337 `turns_formation`):
under the switch, before the relayout, when the turn angle is `> TURN_LIMIT` and `RELAYOUT_AT_TURN` is set: `formed = false`.

**F6. Speed pass** (0x110b15c..0x110b3db / `groups/steer/to_slots.rs` 59 `members_to_slots`): before the member loop
(CATCHING_UP was already cleared in `slots_step`, `awake.rs` 251), set `B = speed_budget`, `E = 0`, `spd = [0; n]`, `ext = [0; n]`.
For each member i held by the world with `specific_move.active != 1` and a slot (first by `unit_id`):
`gap = sqrt(dy*dy + dx*dx)` (slot transform position − current position). If `!formed`:
`lo = S(gap,1.0)`, `hi = S(gap,1.2)`, `spd[i] = lo`, `ext[i] = hi − lo`, `x = hi − slowest_speed`;
`if x > 0 { E += x } else { B -= lo − slowest_speed }`. If formed: `spd[i] = S(gap,1.2)`.
After the loop, if `!formed`: `if E > B { ext[i] *= B/E for ext[i] > 0; B = 0 } else { B -= E }`; then `speed_budget = B` and `spd[i] += ext[i]`.
`S(g,k)` (0x10d6960): `v = mover.stats.speed * k` (slot 0x220); `if !(0.1 <= g) {top}` else if `g < 2.0`
`{ t = max(g-0.1, 0)/1.9; t = if 1.0 <= t {1.0} else {t}; (v-top)*sqrt(sqrt(t)) + top }` else `v`.
`top` = `maximum_velocity_forward` at the pass. Keep the f32 order. Pass `spd[i]` to `steer_to_slot` → `steer_member`.
A member with an active own move steers with `S(gap, 1.2)` (0x110b7e8).

**F7. Steer speed** (0x10f0554..0x10f0617 / `groups/steer/slot_steps.rs` 187 `steer_member`, 225-239, 264
`catch_up_to_slot`): under the switch, keep the turn, yaw and pass state. If the state is Stopping → `stop_at_slot` (as now).
Else `set_member_speed(id, spd)`; `if !(gap <= 0.25) { flags |= CATCHING_UP }`; then `if gap > 5.0 && show_running(id)? != NoSprite {}`
`else { show_walking(id)? }`. Drop the `within`/`near`/`catch_up_to_slot` branches.

**F8. Formed** (0x110b85b..0x110b870 / `awake.rs` 251 `slots_step` end): under the switch, after `members_to_slots`:
`if !flags.contains(CATCHING_UP) && !formed { formed = true }`.

**F9. Member walk speed** (0x120f490 / `movement/step.rs` 101 `next_speed`): `GroupSpeed::OwnMove` walking → `S(3.0,1.2)` =
1.2 × slot 0x220 (engine's OwnMove value not read: check it). Free members: `acc*dt + vel` when `0 <= wanted < 10`, as the engine does.

**F10. First motion updates** (0x1114830 twice in update 1): the bit match needs the group not to step in its first
update (both motion updates only plan). The engine logs two SHORTPATH calls in 17351 (`e1_b`), which fits, but it was not checked
that the engine group does not step: assert it in the trace.

Test: run `R2_1` with all switches and FORMING on 517426097 up to 17400 (`GENIE_TRACE_OBJECTS_RANGE=17349-17400`,
`GENIE_TRACE_OBJECT_IDS=2976`). Expect 2976 within 2-3 ulp at 17355/17372/17381 (bit-exact only with item 4.1), and
wp0 of the 17382 MoveTo.

## 4. Suspected / open

1. **First speed pass gap +0.0133..0.0158** (most natural: measured from the place after 17349, P−1). The
   centroid and the movePositionToFront geometry need P0: a P−1 centroid puts the slot off the line and
   misses by 1e-3. The only movsd writer of `+0x3bc` (0x121eea0) writes it together with the obfuscated position. Other writers
   (0x1205d00 constructor, 0x12061c0, 0x1218650, 0x1225fd8) and the stop path (slot 0x618, 0x5a8 → 0x1224d00 → 0x598 =
   reset `+0x3f8` path) were not followed. The velocity data's acceleration was also not read: `acc*dt` adds to every
   step for a member (F9), so a non-zero acc left by the stop would act like this if something clears it after one tick. Next:
   read slot 0x618 (stop) and who writes `+0x400`'s `+0x14`. Until then, implement without this and expect 2-3 ulp.
2. 188329's first part of movePositionToFront (member choice, 0x10eed10..0x10ef280) was assumed equal to 158041's (not re-read).
3. The pather direction (W → centroid) is shown by the reproduction, not by reading FUN_1410533b0.
4. bit 5 (MEMBERS_SENT) is not cleared at the start of commandMoveTo in 188329 (0x10d8e9b `btr eax, 0xc` only).

## 5. Not read

FUN_1410533b0 (the pather of step F4.5) and 0x10581a0; 0x10d9790 (category of a unit); 0x110ffd0; the
other callers' arg12 (F2); slot 0x618/0x5a8 effects on `+0x400`; slots 0x6b0/0x6b8 names; the own-move branch past the speed.

## 6. Other situations this changes

Every unit group: Ctrl moves (one-unit groups) and **every multi-unit formation move or attack move**.
(1) Each fresh move sets RELAYOUT_AT_TURN | PLACE_AGAIN (F2): next update re-places (spiral) and relays out.
(2) Each relayout moves the group `lead` ahead along the path (F4): 0.5 + ½ spacing of the first line +
distance back of the chosen member's line while forming, min(0.1, lead) once formed. Before, it stood on the front member.
(3) Forming/catching-up speeds: 0.5× slowest while no member is within 0.25 of its slot, 0.8333× while forming or
catching up (F3). Members get gap-shaped speeds and the shared catch-up budget (F6). A turn > π/4 on a fresh
move re-forms the group (F5). Villagers and single units without Ctrl (no group) are unchanged.
Check: in 517426097 this is the only Held/soldier group before 230 s (`e1_c`: the 2-unit list at update 211 is
villagers). Next is any later soldier list ≥ 2. In 518239882 (truth4, older v4 format, positions only), list group moves with
`GENIE_TRACE_COMMANDS` (Move/Interact with soldier lists ≥ 2 or `control: Held`). Run the default and FORMING runs and
compare the first mismatch per member with `cmp_pos.py` (TRUTH=truth/truth4.jsonl) around each such update. Expect earlier or equal
first mismatches to move later for the members; any member that gets worse points at F4's pather (multi-segment paths) or at
the line `spacing_half` for multi-line layouts. Also rerun 518470161 (truth5) for regressions.
