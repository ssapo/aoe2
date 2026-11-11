# P15: replay 517426097 (truth6), first checkpoint mismatch P1 word 7 at 230.4 s

All addresses are RVAs in `AoE2DE_s_unpacked.exe` (build 188329). Engine paths are relative to
`genie/crates/engine/genie-core/src/` (PC source as of 2026-11-11, all 12 switches on).
Engine runs (PC `runs\`): `e1_a` (all objects, updates 16999-17510), `e1_b` (2976 only,
17280-17399, STEER/WALKWP/SHORTPATH), `e1_c` (`GENIE_TRACE_COMMANDS`), `e1_d`
(`GENIE_DUMP_MS` + `GENIE_DUMP_UNITS` + `GENIE_DUMP_ALL` at 88.7 / 88.74 / 88.8 / 148.7 / 150 s),
`e1_e` (all objects, 18499-19005, for P2). Checks: `runs/cmp_pos.py`, `runs/cmp_held.py`, and a
new presence check (truth ids missing in the engine and the reverse, PC `~/e1w/presence.py`;
truth id index `~/e1w/ids.py`). Hand simulation: `out_p15/sim_forming.py` (other rules for
comparison: `out_p15/sim_alt_rules.py`). Decompiles: `out_p15/steer.c` (0x1109d70),
`out_p15/steer2.c` (0x10d6960, 0x10ef890), disassembly `out_p15/upd.asm`, `out_p15/steer_fn.asm`,
`out_p15/grp_all.asm` (every function from 0x10a0000 to 0x1130000).

## 0. Results

1. **GOAT_D 3827 is not a difference.** The engine makes it at the same tick, place and amount
   (`e1_d`: id 3827, master 1061, (90.21875, 76.927086), held 59.974 at 88.748 s; truth 59.987
   at 88.735 s, one tick earlier; at 148.704 s the engine has 0.016627 and the truth has 0.107627 at
   148.613 s, the same 1.0/s decay). The P11 note came from the trace: `census.rs` line 233
   (`if p == 0 && turns.parts.unit_ai.get(u.id).is_none() { continue; }`) leaves out gaia objects
   without a unit AI, so blood (1611) and GOAT_D (1061) never appear in OBJECT lines. Its held amount
   is a decay timer (60 to 0 in 60 s, 1.0 per second), not food, and nobody gathers it. The engine's
   path: `objects/unit/life_step.rs` `state_set_off` (state 3/4 to 7 with `death_spawn`) to
   `death_spawn_comes` (line 232) to `World::remains` (`production/spawn/objects.rs` 172). Object
   ids stay the same in both builds: in 223.9-230.5 s every player object (and every gaia object
   with a unit AI) has the same id, owner, master and state in both, and the first `CORRECT_ID` in
   `g1_097` is at 380.6 s.
2. **Earliest differing object (overall and player-owned): P1 scout cavalry 2976 (master 448),
   at 228.485 s (update 17355).** Truth (66.65552, 96.9563751), engine (66.65235, 96.96262).
   Positions, held amounts, states and presence agree for all compared objects from 223.857 s up to
   228.251 s. No other object differs before 230.5 s. This is the P1 word 7 mismatch at 230.357 s.
   P2 (249.9 s) is separate, see section 4.
3. **Cause:** update 17351 holds `Move { point (70.885414, 88.635414), control: Held }` for the
   last order's unit list (only 2976). With Ctrl held, the splitter makes the unit a group of its
   own. The group moves it to its formation slot without an action (truth: unit AI order -1, no
   path; engine: `action=None`). In 188329 the group update gives each member a speed of its own
   (new code, read below). While the group is "forming" or catching up, it moves at 0.8333 (and at
   0.5 when no member is within 0.25 of its slot) of its slowest member. The engine (158041 logic)
   moves the member at its full speed 1.2002. The truth moves it at 1.0696 falling to 1.0372 tiles/s.
   The 188329 rules as read reproduce the truth's three positions to 2e-5 tiles (section 2.4).

## 1. Address table

| RVA | What |
|---|---|
| 0x1109d70 (size 0x2105) | group update (`BUnitGroup::update`, group.cpp lines 0x18c1, 0x1944, 0x37cc) |
| 0x110a528..0x110a544 | the forming flag `+0x5cc` goes back to 0 when the angle test (0x96e910 on `+0x14`) is > pi/4 (0.7853982 at 0x3203a64) and flag 0x4000 is set |
| 0x110ac1c | `flags(+0x140) &= ~0x200` (CATCHING_UP cleared before the members' pass) |
| 0x110b15c..0x110b3db | **new**: the members' speeds into the global array 0x144365130 (8 bytes per member: speed, extra) with the budget `+0x178` and the reference `+0x174` |
| 0x110b3dd..0x110b855 | the members' pass: 0x10ef890(group, id, index, slot, **speed** at [rsp+0x20]) at 0x110b824 |
| 0x110b7db..0x110b7f1 | a member with its own move (`+0xf8`[i] state 1): speed = 0x10d6960(gap, 1.2) |
| 0x110b85b..0x110b870 | `if !(flags & 0x200) && +0x5cc == 0: +0x5cc = 1` (forming becomes formed) |
| 0x10d6960 (0xc0) | **new**: a member's speed for gap `g` and factor `k` |
| 0x10ef890 (0x21ce) | a member steers to its slot (old FUN_141025fb0); speed argument at `rbp+0x7d0` |
| 0x10efae4..0x10efb12 | gap = sqrt(dx^2 + dy^2), slot `+0x14/+0x18` minus slot 0x568's x / y (`xmm7`) |
| 0x10f0554..0x10f0617 | after the pass test 0x110fac0: state 2 stops (slot 0x618, line 0x2f23); else slot 0x5e0(speed) (line 0x2f2c), `gap > 0.25` sets flags 0x200, `gap > 5.0` and slot 0x6b0 != 0 skips slot 0x6b8 |
| 0x121ecc0 | unit slot 0x5e0: the speed goes into an object at unit `+0x400` (`+8`, 0x1075e00); made when missing and the speed is not 0 |
| 0x120d0d0 | unit slot 0x220: the top speed (master speed, times sprite `+0xc` when > 0, plus `+0x3a4` part, then attribute 5 modifiers 0x1241910) |
| 0x10d53b0, 0x10d5840, 0x10d586e, 0x10d5a8a (one routine split in .pdata) | group statistics |
| 0x10d56a8..0x10d5721 | count of members with `+0xf8`[i] == 0 whose gap to their slot is < 0.25 (`[rsp+0x78]`) |
| 0x10d5872..0x10d588a | slowest slot 0x220 (`xmm9`, `sil` = any) |
| 0x10d5a8e | `+0x174` = slowest (0 without members) |
| 0x10d5ad8..0x10d5b21 | top speed: slowest; with no near member x0.5 (0x31b1420); else with flags 0x200 or `+0x5cc == 0` x0.8333333 (0x3f555555 at 0x32a024c); written to `+0xbc` by 0x11145b0 |
| 0x10be99e | group constructor (0x10be760): `+0x5cc = 0` |
| 0x10effe4 | steer: putting a member on its slot (state 2/3 branch) sets `+0x5cc = 1` (not on this case's path) |

Constants: 0.1 (0x3202890), 2.0 (0x31b6518), 1.9 (0x32a0250), 1.0 (0x369ff64, factor `xmm12`),
1.2 (0x3226b34, factor `xmm10`), 0.25 (0x320532c), 5.0 (0x369ff98), 0.5 (0x31b1420).

## 2. The original's logic

### 2.1 Statistics (each update, before the motion)
1. Over the members: `slowest` = least slot 0x220. `near` = number of members with `+0xf8`[i]
   (own-move state) == 0 whose ground gap to their slot is `0.25 > gap`.
2. `+0x174 = slowest` (0 without members).
3. `top = slowest`. If `near == 0`: `top *= 0.5`. Else if `flags & 0x200` (CATCHING_UP) or
   `+0x5cc == 0` (forming): `top *= 0.8333333` (a multiplication by f32 0x3f555555).
   `+0xbc = top`, which is the motion's top speed.

### 2.2 Member speed `S(g, k)` (0x10d6960)
`v = unit.slot0x220() * k`. If `0.1 > g` (ordered): `S = top`. Else if `2.0 > g`:
`t = min(max(g - 0.1, 0) / 1.9, 1.0)`, `S = (v - top) * sqrt(sqrt(t)) + top`. Else `S = v`.
(A NaN gap takes the last branch, `S = v`.)

### 2.3 The group update's speed pass (0x110b15c..0x110b3db), after CATCHING_UP is cleared (0x110ac1c)
`B = +0x178`, `E = 0`. For each member i whose `+0xf8`[i] state != 1 and which has a slot
(id match in `+0x128` slots, 0x3c bytes each), with `gap` measured as in 0x10efae4:
- forming (`+0x5cc == 0`): `lo = S(gap, 1.0)`, `hi = S(gap, 1.2)`, `spd[i] = lo`,
  `ext[i] = hi - lo`. If `hi - +0x174 > 0`: `E += hi - +0x174`. Else `B -= lo - +0x174`.
- formed: `spd[i] = S(gap, 1.2)` (no extra, no budget).

Forming only, after the loop: if `E > B`, every `ext[i] > 0` becomes `ext[i] * (B / E)` and `B = 0`;
else `B -= E`. Then `+0x178 = B` and `spd[i] += ext[i]`.
Then each member steers (0x10ef890) with `spd[i]`. A member with its own move uses
`S(gap, 1.2)` (0x110b7e8). At the end: `if !(flags & 0x200) && +0x5cc == 0 { +0x5cc = 1 }`.

### 2.4 The steer's speed part (0x10f05ca..0x10f0617), when the pass test is not state 2
`unit.slot0x5e0(spd)`. If `!(0.25 >= gap)`: `flags |= 0x200`. If additionally `gap > 5.0` and slot
0x6b0 returns non-zero, nothing more; otherwise slot 0x6b8 (the sprite slots; their names are not
read). The 158041 radius branches (radius, 5 radii, 3 tiles, x1.2 run) are gone.

### 2.5 This case, by hand (`out_p15/sim_forming.py`)
1-D along the move (unit at 0 after update 17350; the slot leads by `a`):
- The slot is about 0.8 tiles ahead, so `near = 0`, `top = 0.5 x 1.2002 = 0.6001`, and
  `gap > 0.25` sets CATCHING_UP every tick. The group stays forming.
- `lo = S(gap,1.0)` is about 1.07, `hi = S(gap,1.2)` is about 1.38 > `+0x174` = 1.2002. So
  `E > B = 0`, the extra goes to 0 and `spd = lo`.
- The member closes on the slot, so the speed falls: 1.06962 (17351) ... 1.03721 (17381).

With one free value (`a` = 0.804 to 0.812) this gives 0.06939 / 0.30279 / 0.42468 tiles at 17355 /
17372 / 17381. Truth: 0.069425 / 0.302805 / 0.424675. The third truth point is the first waypoint
of the MoveTo made by the `Up` order at 17382, the unit's place after 17381. Other rules fit
worse (best-fit errors in tiles^2 summed): the 158041 rule (1.2) cannot fit at all; `spd = hi`
gives 2.9e-5; a free slot speed with the hi rule gives 1.3e-6; the rules above give 1.3e-9.
The initial lead `a` is fitted, not derived (group place and slot transform not read).

## 3. Confirmed differences (both sides read)

| # | 188329 | engine |
|---|---|---|
| D1 | top speed x0.5 with no member within 0.25 of its slot; x0.8333 with CATCHING_UP **or forming** (0x10d5ad8..0x10d5b04) | `groups/stats.rs` 138-141: `/ slow_group_factor` (1.2) with CATCHING_UP only; no near count, no forming state |
| D2 | `+0x174` = slowest, `+0x178` budget, `+0x5cc` forming flag (constructor 0, formed at 0x110b870, reset at 0x110a544) | no such fields in `UnitGroup` (`groups/mod.rs` 382) |
| D3 | speed pass 2.3 with `S(g,k)` (0x10d6960) | none: `groups/steer/to_slots.rs` `members_to_slots` (line ~60-131) calls `steer_to_slot` without a speed |
| D4 | steer sets `spd`; CATCHING_UP when `gap > 0.25`; sprite by `gap > 5` | `groups/steer/slot_steps.rs` `steer_member` 187-239: radius / `slot_reach` / catch-up branches (`within` gives `maximum_velocity_forward`, `near` gives the unit's speed) |

Engine evidence for this case: `e1_b` shows SHORTPATH for 2976 at update 17351 to
(68.765625, 92.828125) and per-tick steps of (0.0070724, -0.0139084), i.e. 1.2002 tiles/s, in every
update but 17353 until the `Up` order at 17382.

### Implementation note (switch `GENIE_EXPERIMENT_FORMING_188329`)
1. `UnitGroup`: add `slowest_speed: f32` (+0x174), `speed_budget: f32` (+0x178, 0 at creation:
   constructor not read for it, see 5), `formed: bool` (+0x5cc, false at creation, 0x10be99e).
2. `groups/stats.rs` `statistics_only`: in the member loop count `near` = members with
   `specific_move.active == 0` and slot gap (`moved_place` to the slot's `transform_position`,
   ground only) `< 0.25`. After the loop (only when `held > 0`): `g.slowest_speed = slowest`. Then
   under the switch replace lines 138-141 with
   `if near == 0 { slowest *= 0.5 } else if g.flags.contains(CATCHING_UP) || !g.formed { slowest *= f32::from_bits(0x3f555555) }`
   (a multiplication, not `/ 1.2`). `maximum_velocity_forward = slowest` as now.
3. `groups/steer/to_slots.rs` `members_to_slots`: before the loop (after `slots_step` cleared
   CATCHING_UP), run pass 2.3 over the members that have a slot and `specific_move.active != 1`, in
   member order, into a `Vec<f32>` by member index. `S` uses the mover's top speed (`stats.speed`,
   slot 0x220) and `maximum_velocity_forward` (+0xbc). Keep f32 order:
   `(v*k - top) * sqrt(sqrt(t)) + top`, `t = minss(maxss((g - 0.1), 0) / 1.9, 1.0)`. Pass `spd[i]`
   to `steer_to_slot` / `steer_member`. A member with an active own move gets `S(gap, 1.2)` when it
   reaches `steer_to_slot`.
4. `groups/steer/slot_steps.rs` `steer_member`, under the switch, when `state != Stopping`:
   `set_member_speed(id, Speed::new(spd))`. Then `if !(gap <= 0.25) { flags |= CATCHING_UP }`.
   Then `show_running` when `gap > 5.0` and it returns true (match 0x6b0), else `show_walking`.
   Drop `within` / `near` / `catch_up_to_slot`.
5. After `members_to_slots` in `slots_step`:
   `if !g.flags.contains(CATCHING_UP) && !g.formed { g.formed = true }`.
6. Forming reset (0x110a544): `formed = false` when the motion's angle test exceeds pi/4 and group
   flag 0x4000 is set. Only partly read; leave it out at first and note it.

Test: rerun `g1_097` with the switch, then `cmp_pos` on updates 17340-17400. The engine should give
(66.65552, 96.9563751) at 228.485 s and the MoveTo waypoint (0x4285A20C, 0x42C14785) at 17382,
or show the slot lead `a` (place / transform) as the next gap.

## 4. Suspected / side notes
- The per-member speed goes through unit `+0x400` (0x121ecc0); how the walk reads it was not
  read. Taken as the speed of the next motion step (the fit supports it).
- Engine stall at update 17353 (no step). It is probably a Stopping state from the engine's
  `passes_waypoint` with its faster slot. Not checked.
- P2 (first word 7 mismatch 249.9 s, food -3.06 at 280.5 s) is separate from the scout.
  `e1_e` (updates 18499-19005): apart from 2976, the first differences are the P2 hunters 2974 and
  3820 (master 216) at 247.647 s (update 18829), then 3825, 2970, 3823, 2968, and the boar 3507's
  held amount at 248.557 s. At update 18827 both builds have 2974 at (37.488911, 22.132040) with
  the same stall in 18828. This is the moment the hunted goat 3219 is used up: the truth makes
  blood 3853 and GOAT_D 3854 at 247.647 s. Next:
  - truth: a new walk from (37.4889, 22.1320) to (37.3255, 22.8724) (waypoints in the v5 record),
    unit AI words `C9020000 64000000 65020000 B30D0000 0A000000`;
  - engine: Hunt state 11, moving (+0.00664, +0.00801) per tick, and the AI target is None from
    update 18831.

  So the P2 lead is the hunter's next step after its carcass is used up (the order and target the
  unit AI takes then). Not read. This is where the goat-to-GOAT_D event matters: not the object
  itself, but what the hunters do when it happens.
- 0x10ef6d0..0x10ef738 (just before the steer) reads `+0x5cc == 1` and a `minss`: one more
  formed/forming use, not read.

## 5. Not read
The group's initial place and the single-unit slot transform (where the 0.8-tile lead comes from).
The forming reset's angle test (0x96e910 on `+0x14`) and flag 0x4000. `+0x178`'s initial value
(the constructor zeroes nearby fields; with `E > B` every tick here it does not matter). The
own-move branch of the members' pass beyond the speed. The sprite slots 0x6b0 / 0x6b8 names. The
0x10effe4 path (put on the slot sets formed).

## 6. Other situations the change affects
Every unit group: Ctrl moves (each unit its own group) and every multi-unit formation move or
attack-move, since all members now get the forming / budget speeds. Forming groups move at 0.8333
of the slowest member, and at 0.5 while no member is within 0.25 of its slot. Members catch up at
up to 1.2 of their speed only while the budget allows. Single-unit orders without Ctrl and
villagers' work orders (no group) are not affected. In replay 517426097 this is the first Ctrl move
(the only one before 230 s), so nothing earlier changes.
