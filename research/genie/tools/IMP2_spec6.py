EDITS=[
("""        unit_ai_can_attack(self.attacker, &seeker, &target, roles, unit_ai_tuning)""",
"""        // 188329's soldier reads the unit's own path in Defend (slots 0x690, 0x4a8)
        let route = crate::unit_ai::attack_pick::PatrolRoute::of(self.parts.mover_of(self.me));
        crate::unit_ai::attack_pick::can_attack_on(
            self.attacker,
            &seeker,
            &target,
            roles,
            unit_ai_tuning,
            Some(route),
        )"""),
]
