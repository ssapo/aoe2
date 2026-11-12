EDITS=[
("""    fn call_for_help(&mut self, attacker: ObjectId) -> Result<(), GenieError> {
        /// The classes that never help: 1 to 3, 18 to 21, 27 and 39.
        const NO_HELP_CLASSES: ClassMask = ClassMask::new(0x0080_083c_000e, 0x28);

        let roles = &self.c.w.model.roles.clone();
""","""    fn plan_reaches(&mut self, target: ObjectId, range: Distance) -> Result<bool, GenieError> {
        // 0x1116d20: the target's radius (its master's +0x78) plus the unit's, both places
        // plain (slot 0x568), the planner of the unit's master
        let Some(t) = self.c.w.spatial.get_known(target)? else {
            return Ok(false);
        };
        let (to, target_radius) = (t.position.ground(), t.radius.x());
        let unit = &*self.unit;
        let own_radius = unit
            .master(self.c.w.master_tables(), self.player)?
            .radius
            .x();
        let mover = self
            .c
            .w
            .parts
            .mover_of(unit.id)
            .ok_or(GenieError::unsupported(
                "the reach of a helper that does not move (188329 0x1116d20)",
            ))?;
        let mut plan = Planning {
            pathing: &mut self.c.w.pathing,
            now: self.c.w.world_time,
            player_kind: self.player_kind,
            object: self.c.w.streams.get(Stream::Object),
            groups: &self.c.w.groups,
        };
        mover.plan_reaches(
            unit.position(),
            &self.c.w.spatial,
            &mut plan,
            to,
            (Distance::new(own_radius + target_radius), range),
            &self.c.w.model.tuning.tile_path,
        )
    }

    fn call_for_help(&mut self, attacker: ObjectId) -> Result<(), GenieError> {
        /// The classes that never help: 1 to 3, 18 to 21, 27 and 39.
        const NO_HELP_CLASSES: ClassMask = ClassMask::new(0x0080_083c_000e, 0x28);

        if helpcall_188329() {
            return self.call_for_help_188329(attacker);
        }
        let roles = &self.c.w.model.roles.clone();
"""),
("""impl UnitSide for UnitView<'_, '_> {
    fn table_drop_site(""","""/// 188329's `AskForHelp` (`0xd1d2e0`): every free helper answers as its own unit AI (its reach
/// `0x1116d20`, its `bestUnitToAttack` `0xd1ec40`, its `AttackObject` `0xd1dd70`), the walk goes
/// on over the search lists as they stand, and classes 66 and 67 never help:
/// `GENIE_EXPERIMENT_HELPCALL_188329`.
fn helpcall_188329() -> bool {
    static FLAG: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *FLAG.get_or_init(|| std::env::var_os("GENIE_EXPERIMENT_HELPCALL_188329").is_some())
}

impl UnitView<'_, '_> {
    /// 188329 `AskForHelp`'s walk (`0xd1d3d0`..`0xd1dc59`) over the search's lists of the unit's
    /// own and its friends' objects (the globals' lists 1 and 2, read again with their counts on
    /// every step): each record's object that passes the tests ([`UnitView::help_candidate`])
    /// answers as its own unit AI ([`UnitAi::answer_help`]), whose `bestUnitToAttack` searches
    /// again, so the walk goes on over the helper's lists at the next index.
    fn call_for_help_188329(&mut self, attacker: ObjectId) -> Result<(), GenieError> {
        if self.c.w.spatial.searched().is_none() {
            return Err(GenieError::unsupported(
                "a search that reads the registry's last answer (before any query)",
            ));
        }
        let me = self.unit.id;
        for relation in [UnitRelation::Own, UnitRelation::Ally] {
            let mut i = 0_usize;
            loop {
                let Some(id) = self
                    .c
                    .w
                    .spatial
                    .searched()
                    .and_then(|lists| lists[relation].get(i).map(|r| r.id))
                else {
                    break;
                };
                i += 1;
                if id == me {
                    continue;
                }
                let Some(owner) = self.help_candidate(id, attacker)? else {
                    continue;
                };
                self.c
                    .lend_at((&mut *self.unit, &mut *self.actions), |w, _, _| {
                        let at = w.live_index(owner, id).ok_or_else(|| {
                            GenieError::unreachable("a helper left its list").with("object", id)
                        })?;
                        w.run_unit_ai((owner, at), |ai, around, side, player_kind, _| {
                            ai.answer_help(attacker, around, player_kind, side)
                        })
                    })?;
            }
        }
        Ok(())
    }

    /// 188329 `AskForHelp`'s tests of the object `id` of a list record (`0xd1d3f0`..`0xd1da1b`):
    /// its owner when it answers. The world's object with a unit AI in a state below 3; never
    /// the classes 1 to 3, 18 to 21, 27, 39, 66 and 67 nor the siege tower; a villager (class
    /// 4) only against Gaia's; the unit's own player's or an ally's; within the squared
    /// footprint gap 9 of the unit; then [`UnitView::helper_free`]. Slot 0x2e8 with 1
    /// (`0x113c0b0`) follows from the idle test for a helper in no group; a patrolling group's
    /// member's (`0x10dd760`) is not modelled.
    fn help_candidate(
        &self,
        id: ObjectId,
        attacker: ObjectId,
    ) -> Result<Option<PlayerId>, GenieError> {
        /// The classes that never help: 1 to 3, 18 to 21, 27 and 39.
        const NO_HELP_CLASSES: ClassMask = ClassMask::new(0x0080_083c_000e, 0x28);

        let roles = &self.c.w.model.roles.clone();
        let others = owner_view(
            &self.c.w.players,
            &self.c.w.index,
            self.c.player,
            self.new_owner,
        )?;
        let find = |id: ObjectId| others.find(id);
        let gaia_attacker = find(attacker).is_some_and(|(owner, _)| owner == PlayerId::GAIA);
        let my_radius = self
            .unit
            .master(self.c.w.master_tables(), self.player)?
            .radius;
        let Some((owner, u)) = find(id) else {
            return Ok(None);
        };
        if !self.c.w.parts.unit_ai.contains(u.id) || ObjectState::Dying <= u.life.state {
            return Ok(None);
        }
        let m = u.master(self.c.w.master_tables(), owner)?;
        // 0xd1d4xx: `1 < (ushort)(class - 0x42)`
        if NO_HELP_CLASSES.contains(m.class)
            || m.class == ClassId::named(66)
            || m.class == ClassId::named(67)
            || roles.of_master(m.id).contains(MasterRoles::SIEGE_TOWER)
        {
            return Ok(None);
        }
        if !gaia_attacker && roles.of_class(m.class).contains(ClassRoles::VILLAGER) {
            return Ok(None);
        }
        if owner != self.player && !self.c.w.spatial.allied_with(owner, self.player) {
            return Ok(None);
        }
        let gap = footprint_gap_squared(self.unit.position(), my_radius, u.position(), m.radius);
        if DistanceSquared::new(self.c.w.model.tuning.unit_ai.help_reach) < gap {
            return Ok(None);
        }
        if !self.helper_free(
            owner,
            u,
            self.c.w.parts.actions_of(u.id),
            m,
            attacker,
            roles,
        )? {
            return Ok(None);
        }
        if u.group.id.and_then(|g| self.c.w.groups.get(g)).is_some() {
            return Err(GenieError::unsupported(
                "a patrolling group's member that answers a call for help (188329 slot 0x2e8, 0x10dd760)",
            ));
        }
        Ok(Some(owner))
    }
}

impl UnitSide for UnitView<'_, '_> {
    fn table_drop_site("""),
]
