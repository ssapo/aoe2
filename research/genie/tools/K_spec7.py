EDITS=[
("""        let kind = civilian_kind(class, roles);
        let found = match kind {
            None => {
                let origin = at.position.ground();""","""        let mut kind = civilian_kind(class, roles);
        // 188329 (0xcf9c60 -> 0xcf9c95): slot 0x1b0 gives kind 5 for class 10, so the notify of a
        // boar hunt searches by kind (slot 0x80), not ClosestObject over live boars
        if kind.is_none()
            && std::env::var_os("GENIE_EXPERIMENT_HUNT_188329").is_some()
            && class.get() == 10
        {
            kind = Some(GatherGroup::from(5_u8));
        }
        let found = match kind {
            None => {
                let origin = at.position.ground();"""),
]
