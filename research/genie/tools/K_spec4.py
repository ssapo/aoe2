EDITS=[
("""        let speed = master.move_stats.as_ref().map_or(Speed::ZERO, |m| m.speed);
        // 188329 0x16ebc20""","""        let speed = master.move_stats.as_ref().map_or(Speed::ZERO, |m| m.speed);
        // 188329 0x12cbca0 (the villager's slot 0x148; 0x12cbd38: class 4): the move clears the
        // town-bell flag (`+0x664`), so a later garrison order records its work again
        let bell_free_188329 = std::env::var_os("GENIE_EXPERIMENT_GARRISON_RECORD_188329").is_some()
            && self
                .model
                .roles
                .of_class(master.class)
                .contains(ClassRoles::VILLAGER);
        // 188329 0x16ebc20"""),
("""        if let Some(ai) = self.parts.unit_ai.get_mut(unit.id) {
            ai.orders.clear();
        }
        if order.target == Some(id) {""","""        if bell_free_188329 {
            self.parts.set_town_bell_flag(unit.id, BellShelter::Free);
        }
        if let Some(ai) = self.parts.unit_ai.get_mut(unit.id) {
            ai.orders.clear();
        }
        if order.target == Some(id) {"""),
]
