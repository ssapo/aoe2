EDITS=[
("""    pub(crate) const fn seeker_with(&self, target_master_kind: Option<MasterKind>) -> Seeker {""",
"""    pub(crate) fn seeker_with(&self, target_master_kind: Option<MasterKind>) -> Seeker {"""),
("""            patrol_path: self.patrol_path.is_some(),
            target_master_kind,""","""            patrol_path: self.patrol_path.is_some(),
            // 188329's Defend arm reads the saved patrol's points (`0xcf7e8e`)
            saved_patrol: if crate::unit_ai::attack_rules::patrolrange_188329()
                && self.stance == UnitStance::Defensive
            {
                self.patrol_path
                    .as_ref()
                    .map(|p| crate::unit_ai::attack_pick::SavedPatrol::of(&p.path.points))
            } else {
                None
            },
            target_master_kind,"""),
]
