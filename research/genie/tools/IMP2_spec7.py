EDITS=[
("""        Ok(can_attack(
            &self.attacker,
            seeker,
            &t,
            roles,
            &self.c.w.model.tuning.unit_ai,
        )?""","""        Ok(crate::unit_ai::attack_pick::can_attack_on(
            &self.attacker,
            seeker,
            &t,
            roles,
            &self.c.w.model.tuning.unit_ai,
            Some(crate::unit_ai::attack_pick::PatrolRoute::of(
                self.c.w.parts.mover_of(self.unit.id),
            )),
        )?"""),
("""        can_attack(
            &me,
            &ai.seeker_with(target_master_kind),
            &target,
            roles,
            &self.c.w.model.tuning.unit_ai,
        )""","""        crate::unit_ai::attack_pick::can_attack_on(
            &me,
            &ai.seeker_with(target_master_kind),
            &target,
            roles,
            &self.c.w.model.tuning.unit_ai,
            Some(crate::unit_ai::attack_pick::PatrolRoute::of(
                self.c.w.parts.mover_of(u.id),
            )),
        )"""),
("""use crate::unit_ai::{Seeker, can_attack};""","""use crate::unit_ai::Seeker;"""),
]
