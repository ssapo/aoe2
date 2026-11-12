EDITS=[
("""    fn call_for_help(&mut self, _attacker: ObjectId) -> Result<(), GenieError> {
        Err(GenieError::unsupported("a call for help without the world"))
    }
""","""    fn call_for_help(&mut self, _attacker: ObjectId) -> Result<(), GenieError> {
        Err(GenieError::unsupported("a call for help without the world"))
    }

    /// 188329 `AskForHelp`'s reach of a helper (`0x1116d20`): whether the tile planner of the
    /// unit's restriction finds its way from the unit to object `target` within `range` (the
    /// radii the unit's and the target's, no tile search).
    ///
    /// # Errors
    ///
    /// What the reach test does not model.
    fn plan_reaches(&mut self, _target: ObjectId, _range: Distance) -> Result<bool, GenieError> {
        Err(GenieError::unsupported(
            "a helper's reach test without the world",
        ))
    }
"""),
]
