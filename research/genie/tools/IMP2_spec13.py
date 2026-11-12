EDITS=[
("""        if u.group.id.and_then(|g| self.c.w.groups.get(g)).is_some() {
            return Err(GenieError::unsupported(
                "a patrolling group's member that answers a call for help (188329 slot 0x2e8, 0x10dd760)",
            ));
        }
        Ok(Some(owner))""","""        // slot 0x2e8 with 1 of a group's member (`0x113c0d8`): not `0x10dd760(group, id)`, which
        // for a patrolling group (its path loops, `0x110ffd0`, or bit 11 of `+0x140`) is false
        // only while the group is idle (`0x10dd870`) on no command or a move (`+0x3b0` -1 or 1)
        if let Some(g) = u.group.id.and_then(|g| self.c.w.groups.get(g)) {
            let free = g.is_idle()
                && (g.current_command == crate::groups::GroupCommandKind::NONE
                    || g.current_command == crate::groups::GroupCommandKind::MOVE);
            if !free {
                return Ok(None);
            }
        }
        Ok(Some(owner))"""),
("""    /// footprint gap 9 of the unit; then [`UnitView::helper_free`]. Slot 0x2e8 with 1
    /// (`0x113c0b0`) follows from the idle test for a helper in no group; a patrolling group's
    /// member's (`0x10dd760`) is not modelled.""","""    /// footprint gap 9 of the unit; then [`UnitView::helper_free`]. Slot 0x2e8 with 1
    /// (`0x113c0b0`) follows from the idle test for a helper in no group; a patrolling group's
    /// member passes it while the group is idle on no command or a move (`0x10dd760`)."""),
]
