EDITS=[
("""use crate::unit_ai::{
    AiMove, BREAK, DEAD, Effect, GO_ON, Memory, Notify, Pick, RUN_DRAW_SCALE, RUN_EPSILON, RUN_ONE,
""","""use crate::unit_ai::{AttackAsk, AttackChecks, SurroundingFlags};
use crate::unit_ai::{
    AiMove, BREAK, DEAD, Effect, GO_ON, Memory, Notify, Pick, RUN_DRAW_SCALE, RUN_EPSILON, RUN_ONE,
"""),
("""    /// What a search of the unit AI covers (`FUN_140c63e20`): the classes its constructor gave
""","""    /// 188329 `AskForHelp`'s helper that passed the tests (`0xd1da20`..`0xd1dc59`), run as the
    /// helper's own AI (`GENIE_EXPERIMENT_HELPCALL_188329`): its reach to the `attacker`
    /// (`0x1116d20` with its range, slot 0x248; not reached: nothing); its `bestUnitToAttack`
    /// from its place (`0xd1ec40` with distance 0, no idle check, no path checks, no extra
    /// object, not any class, no work state; its own search first); the target is the attacker
    /// unless the best is another object the world holds whose squared footprint gap to the
    /// helper is at most 0.9 of the attacker's (`0xd1daca`..`0xd1daf1`); then its `AttackObject`
    /// (slot 0xb8) on the target, forced, by its own rules (any 0; the group flag's part never
    /// runs).
    ///
    /// # Errors
    ///
    /// What the reach test, the search and the attack command do not model.
    pub(super) fn answer_help(
        &mut self,
        attacker: ObjectId,
        at: &Surroundings,
        player_kind: PlayerKind,
        side: &mut dyn UnitSide,
    ) -> Result<(), GenieError> {
        if !side.plan_reaches(attacker, at.weapon_range)? {
            return Ok(());
        }
        let (classes, radius) = self.search_area(at, player_kind);
        let found = side.closest(&Search {
            at: at.position.ground(),
            radius,
            classes,
            size: at.size,
            pick: Pick::Attack {
                lowest: if at.flags.contains(SurroundingFlags::SCENARIO)
                    && !player_kind.is_computer()
                {
                    2
                } else {
                    0
                },
                seeker: self.seeker(at),
                ask: AttackAsk {
                    distance: Distance::ZERO,
                    checks: AttackChecks::empty(),
                    extra: None,
                },
            },
            memory: self.memory(),
        })?;
        self.add_retries(&found);
        self.attack_search_alert(found, player_kind, &at.unit_ai_tuning)?;
        let mut target = attacker;
        if let Some(best) = found.id.filter(|&b| b != attacker)
            && let Some(b) = side.seen_unit(best)?
        {
            let t = side.seen_unit(attacker)?.ok_or(GenieError::unreachable(
                "a call for help whose attacker left the world",
            ))?;
            // 0xd1dae8: COMISS gap(best), gap(attacker) * 0.9; JBE keeps the best
            let scaled = t.gap_squared.get() * f32::from_bits(0x3f66_6666);
            if at_most_or_unordered(b.gap_squared.get(), scaled) {
                target = best;
            }
        }
        let _ = self.attack_object(target, OrderForce::Forced, TargetRules::Own, at, side)?;
        Ok(())
    }

    /// What a search of the unit AI covers (`FUN_140c63e20`): the classes its constructor gave
"""),
]
