EDITS=[
("""        if self.work.point == none {
            Ok((None, before))""","""        // 188329 0x12b6a26..0x12b6a9e: the second record also when the first has neither an
        // action nor a target class and the second has both
        let second_188329 = std::env::var_os("GENIE_EXPERIMENT_GARRISON_RECORD_188329").is_some()
            && self.work.action.is_none()
            && self.work.target_class.is_none()
            && before.action.is_some()
            && before.target_class.is_some();
        if self.work.point == none || second_188329 {
            Ok((None, before))"""),
]
