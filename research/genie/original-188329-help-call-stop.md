# S1: the helper that answers a call for help (replay 517426097, update 61100)

Runs: `S1_1` (go_base, 20 default switches, to 61101, GENIE_TRACE_OBJECTS_RANGE=61000-61100).
Decompiles: `out_s1/s1.c` (AskForHelp, AttackObject), `s2.c` (reach, slot 0x2e8, slot 0x200, set target),
`s3.c` / `best.txt` (bestUnitToAttack, 0x10dd760).

## 0. The situation

Engine (`S1_1.err`, tick 61100, 797170 ms): P1 scouts (master 448) 3997, 4007 and sim-id 4023
(recorded id 4022: `CORRECT_ID world_ms=793738 recorded=4022 sim=4023`) stand close together at about
(72.5..73.3, 55.7..57.1), all `Soldier action=None target=None`, action_kind None (their places still
change about 0.02 a tick). P2 scouts 3999 and 4014 are in Attack state 7 on 4023 (3999 since tick 61050,
4014 since 61058). The stop is raised when 4023 is hit and asks for help: 3997 and 4007 are within 3
tiles and pass `helper_free`.

Truth (`truth6.jsonl`, ai = +0x38,+0x3c order,+0x40,+0x44 action,+0x48 target,+0x4c target class):

| ms | 3997 / 4007 / 4022 (P1) | 3999 / 4014 (P2) |
|---|---|---|
| 795480 | (0,700,-1,600,4014 or 3999,47) | idle |
| 796000..797690 | (0,-1,-1,-1,-1,-1), no head action, places still change | (0,-1,-1,600,**3997**,47) |
| 798145..799341 | (0,-1,-1,**600,4014,47**) all three, new head Attack actions | same until 798483, then idle |
| 800147 | (0,700,-1,600,2978,47) (a player command: order 700) | idle |

So in the original the three P1 scouts get AttackObject on 4014 between 797690 and 798145 ms with
order -1 (no command): the attacked unit (3997 in the truth) by its own notify, the other two as
helpers. Note the engine has already diverged here (its P2 scouts attack sim-4023 from 796.5 s, the
truth's attack 3997 from 796.0 s), so the stop time 797170 is not the truth's time.

## 1. Address table (188329, RVA)

| RVA | what |
|---|---|
| 0xd1d2e0..0xd1dd67 | `AskForHelp(ai, attackerId)` (strings "AskForHelp: uTA=%d.", "BEING TOLD TO ATTACK BY UNIT #%d's askForHelp.") |
| callers | 0xd001fb, 0xd00a20 (villager notify 0xd004a0), 0xd03c3a, 0xd05df8, 0xd079f5, 0xd07dc9, 0xd3413d and 0xd34cba (base notify 0xd33c40) |
| 0xd1dd70..0xd1e0da | base `AttackObject(ai, id, force, any, group)` = AI slot 0xb8 of every AI vtable whose slot 0xa0 is 0xd22780 (and 5 more); overrides 0xcf5080 (villager, vt 0x3245908), 0xcf51a0, 0xcf5300, 0xcf5260 |
| 0xd1ec40..0xd2215b | `bestUnitToAttack(ai, pos*, float dist, char idle, char paths, int* extra, int n, char anyClass, char workState)` |
| 0xd3fdd0 | AI slot 0x50, the search (x, y, mode) — not read |
| 0x1116d20 | reach test (helper, attacker, range) -> 0x1058020 (planner of the master's restriction) + 0x1057a40 (tile planner) |
| 0x124daf0 | squared footprint gap of two objects (per axis |d| - (r1+r2), clamped at 0) |
| 0x113c0b0 | unit slot 0x2e8 (b): "may be interrupted"; grouped: `!0x10dd760(group, id)` |
| 0x1154630 / 0x115ce20 | unit slots 0x200 (target within range: min^2 <= gap^2 <= range^2) / 0x248 (range, leaf, not fully read) |
| 0x16027d0 | group by id (obj+0x210); 0x10dd8e0 (group+0x140 bit 11), 0x110ffd0: the two patrol tests |
| 0x1252f80 | master id == 0x451 (siege tower); 0x1732ca0 allied |
| 0xd40b90 | set target (id, x, y, z; class into +0x4c; old into +0x6c/+0x70) |
| 0x1443caf30/38, counts 0x1443caf54/58 | the global search lists 1 and 2 (own, allies), 0x1c bytes a record |
| constants | 0x14321bc84 = 9.0, 0x1431d0a28 = 0.9 |

## 2. The original's logic (all CONFIRMED in s1.c / disassembly unless marked)

AskForHelp(ai A of unit U, attacker id T):
1. T must be an object of the world (0x1616cf0), else return.
2. A.slot0x50(U.x, U.y, 1): the search from U's place.
3. For list k = 1, 2 (own, allies), for i = 0 .. count-1 — **the list pointer and the count are read
   again from the globals on every step** (0xd1d3xx loop; `*piStack_208`, `*plVar13`):
   a. id != U.id; object H exists with a unit AI (H+0x1f0) and an owner; else next.
   b. H.state (+0x188) < 3.
   c. H.slot0x2e8(1) != 0.
   d. class: not (class <= 39 and bit in 0x80083c000e: 1,2,3,18..21,27,39) and **not 66 or 67**
      (`1 < (ushort)(class - 0x42)`); master id != 0x451.
   e. H.ai.slot0xa0(attacker object, 0) != 0.
   f. attacker's player index (+0x648) == 0, or H's class != 4.
   g. H's player == U's player, or allied (0x1732ca0).
   h. gap2(U, H) (0x124daf0) : skip when `9.0 < gap2`.
   i. group = 0x16027d0(world, H+0x210). None: skip when ai+0x44 != -1, or H.slot0x468() == 1 (has an
      action), or ai+0x3c != -1, or ai+0x18 > 0, or ai+0x48 != -1. A group: patrolling when
      0x10dd8e0 or 0x110ffd0, else skip.
   j. t = H.slot0x1a0() (top action's target). Skip when t exists and H.slot0x200(t) != 0, unless
      (patrolling and t is a building (type 80) whose master's attack count < 1).
   k. reach: `0x1116d20(H, attackerObj, H.slot0x248())` must be true: H's type byte >= 0x1e; planner
      = 0x1058020(world+0x140, H's master) not null; `0x1057a40(planner, path, H.x, H.y, T.x, T.y,
      radii = H.radius(+0x78) + T.radius(+0x78), range, 0, 0, byte 0, 0, 0)`; true when the result
      byte < 2 (0xd1da35, 0x1116efc..0x1116f5a). The byte argument 0 = no tile search (evasiveMoveFrom
      0xd2669d passes 1).
   l. best = `bestUnitToAttack(H.ai, &H.position(+0x3bc), 0.0, 0, 0, NULL, 0, 0, 0)` (0xd1da59..91).
      It **calls H.ai.slot0x50(x, y, 1) itself first** (best.txt line 49), so the global lists now hold
      H's search; the walk of step 3 goes on over them at index i+1.
   m. target = T. If best != T and the world holds best: `if !(gap2(T,H) * 0.9 < gap2(best,H))`
      target = best (0xd1daca..0xd1daf1: `comiss gap2(best), gap2(T)*0.9; jbe keep best`). best
      == -1 or gone: T.
   n. `H.ai.slot0xb8(target, force = 1, any = 0, group = 1)` (0xd1dc39..53). **No return: the walk
      continues with the next record** (jmp 0xd1d79b), so every free helper answers.
AttackObject (0xd1dd70): +0x1dd = 0; (force == 0 and action != -1) -> fail; object must exist;
slot 0xa0(obj, any) != 0; unit slot 0x368(id, force) == 1 -> +0x68 = old action, action (+0x44) = 600,
set target (0xd40b90: id, place, class). Then the group part only when byte 0x14434f295 != 0 and
group arg != 0.
RNG: no RNG call site inside 0xd1d2e0, 0xd1dd70, 0xd1ec40, 0xd3fdd0 (rand_sites.pkl); with paths = 0
bestUnitToAttack makes no path checks. Draws inside the unit's attack command (slot 0x368: 0x114fc40 or
0x12c19f0) were not read (the engine's `side.attack` models that command).

## 3. Confirmed differences and the change

D1. Engine `unit_ai/world_view/side.rs:132-193` (`call_for_help`) returns `helper_answers()` at the
first free helper; the original runs steps k-n and goes on. Engine read: side.rs:176-193,
ids.rs:445-453.
D2. Engine NO_HELP_CLASSES `ClassMask::new(0x0080_083c_000e, 0x28)` (side.rs:134; `new(bits, below)`)
has no classes 66, 67; 188329 skips them (step d).
D3. Engine has no step c (slot 0x2e8 with 1). For an ungrouped helper it follows from step i; for a
grouped one it adds `!0x10dd760(group, id)`.
D4. The engine's doc (ids.rs:446) names the reach as "within its weapon range" of the old pather;
188329 is the tile planner call of step k (engine equivalent: `Mover::plan_path`,
movement/new_path.rs, but with `full: false`, `range` = weapon range, radii = both x radii).

Change (switch `GENIE_EXPERIMENT_HELPCALL_188329`; off: unchanged, the stop stays):

`unit_ai/world_view/side.rs`, `call_for_help`: walk by index, reading the registry again each step,
and answer instead of stopping:
```rust
let on = experiment("GENIE_EXPERIMENT_HELPCALL_188329");
for rel in [UnitRelation::Own, UnitRelation::Ally] {
    let mut i = 0;
    loop {
        // the game reads the global list and its count again on every step
        let Some(r) = self.c.w.spatial.searched().and_then(|l| l[rel].get(i).copied()) else { break };
        i += 1;
        // ... the tests as now (owned copies, no borrow of the lists kept); with `on` also:
        //     class 66 and 67 never help
        if !self.helper_free(owner, u, actions, m, attacker, roles)? { continue; }
        if !on { return helper_answers(); }
        let helper = r.id;
        self.c.lend_at((&mut *self.unit, &mut *self.actions), |w, _, _| {
            let hi = w.live_index(owner, helper)
                .ok_or(GenieError::unreachable("a helper left its list"))?;
            w.run_unit_ai((owner, hi), |ai, at, side, kind, _| ai.answer_help(attacker, at, kind, side))
        })?;
    }
}
```
`unit_ai/flight.rs`, new next to `ask_for_help`:
```rust
/// 188329 AskForHelp's helper (0xd1da20..0xd1dc59), run as the helper's.
pub(super) fn answer_help(&mut self, attacker: ObjectId, at: &Surroundings,
    player_kind: PlayerKind, side: &mut dyn UnitSide) -> Result<(), GenieError> {
    let Some(t) = side.seen_unit(attacker)? else { return Ok(()) };
    // 0x1116d20: tile planner, radii = own x radius + target's, range = weapon range, no tile search
    if !side.plan_reaches(attacker, at.weapon_range)? { return Ok(()); }
    let (classes, radius) = self.search_area(at, player_kind);
    let found = side.closest(&Search { at: at.position.ground(), radius, classes, size: at.size,
        pick: Pick::Attack { lowest: /* as attacked.rs:196 */, seeker: self.seeker(at),
            ask: AttackAsk { distance: Distance::ZERO, checks: AttackChecks::empty(), extra: None } },
        memory: /* as attacked.rs:195 */ })?;
    self.attack_search_alert(found, player_kind, &at.unit_ai_tuning)?;
    let mut target = attacker;
    if let Some(best) = found.target().filter(|&b| b != attacker)
        && let Some(b) = side.seen_unit(best)? {
        let d_att = footprint_gap_squared(t.position, t.radius, at.position, at.radius);
        let d_best = footprint_gap_squared(b.position, b.radius, at.position, at.radius);
        if !(d_att * 0.9 < d_best) { target = best; }
    }
    let _ = self.attack_object(target, OrderForce::Forced, TargetRules::Own, at, side)?;
    Ok(())
}
```
`plan_reaches` is a new `UnitSide` method beside `reaches` (world_view/side.rs:363): like the body
at side.rs:305 (`mover.plan_path`) but `Request { from, to: target place, radii: own radius.x +
target radius.x, range, closed: vec![], full: false }` and the answer `found.reaches()` (code < 2);
false for a unit without a mover or planner. Existing helpers used: `Step::lend_at`,
`World::run_unit_ai` (world/object_step.rs:145), `UnitAi::search_area`, `seeker`, `attack_object`
(attack_orders.rs:121), `attack_search_alert`, `footprint_gap_squared`, `Found::reaches`.
Points for the implementer: (1) `with_side` (unit_ai/unit.rs:318) rejects a nested draw from the AI
stream; if the helper's attack command draws, the stream must be handed through. (2) while lent, the
asker carries a stand-in AI (step.rs `lend`): the helper's picker must not read the asker's AI.

Verify: the engine no longer stops P1 at 61100; the two idle scouts beside the attacked one get
action 600 with the attacker (or a nearer enemy scout) as target in the same update, order none. Truth:
3997, 4007, 4022 show ai (0,-1,-1,600,4014,47) from the sample at 798145 ms (still idle at 797690).

## 4. Suspected
- Byte 0x14434f295 (bss) is never written (only compares found by rip-relative scan; 0xfae400 writes
  0x434f290..294), so AttackObject's group part never runs, as in the engine's doc.
- The P1 scouts are moved as a formation between 796000 and 797690 (no AI action, no head action,
  places change); whether they pass step i as ungrouped or as a patrolling group was not determined.
- Argument mapping idle/paths/anyClass/workState of bestUnitToAttack (param_4, 5, 8, 9) from their
  uses in best.txt (lines 177, 850, 862, 442) against the engine's `Ask`.
- The earlier stop of 518239882 at 36452 is the same branch (not traced).

## 5. Not read
Search 0xd3fdd0 (its hold of a second search in one update, its `lowest` bound), bestUnitToAttack
body against the engine's `best_unit_to_attack`, slot 0xa0 (0xd22780), the attack command (slot
0x368), 0x115ce20 beyond its first lines, 0x10dd760's callees, the soldier's AI vtable identity.

## 6. Other situations affected
Every damage notify that calls for help with an idle soldier (or a patrolling group's member) of the
same or an allied player within 3 tiles: scout fights, units next to an attacked building or villager
(villagers help only against Gaia). With the switch on, several helpers answer in one update, and
the list walk continues over the last helper's search lists.
