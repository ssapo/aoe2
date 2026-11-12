EDITS=[
("""    /// The length of the tile planner's path (`FUN_140f7c530` with the radii `radii`, range 0, no
    /// closed tiles, the tile search for a human player, no smoothing) from the unit to `to`, and""",
"""    /// 188329 `AskForHelp`'s reach of a helper (`0x1116d20`): the tile planner of the unit's
    /// restriction (`0x1058020`; none: not reached) from the unit to `to` (`0x1057a40` with the
    /// radii `radii`, the range `range`, no closed tiles, no tile search, no smoothing unit);
    /// reached when its result is below 2 (`0x1116f0a`).
    pub fn plan_reaches(
        &self,
        at: Position,
        world: &Spatial,
        plan: &mut Planning<'_>,
        to: Point,
        (radii, range): (Distance, Distance),
        tile_path_tuning: &TilePathTuning,
    ) -> Result<bool, GenieError> {
        let Some(planner) = plan.pathing.planner(self.stats.restriction, world.tiles()) else {
            return Ok(false);
        };
        let req = Request {
            from: at.ground(),
            to,
            radii,
            range,
            closed: Vec::new(),
            full: false,
        };
        let mut path = Path::default();
        let found = planner.plan::<GenieError>(&req, false, &mut path, None, tile_path_tuning)?;
        Ok(found.reaches())
    }

    /// The length of the tile planner's path (`FUN_140f7c530` with the radii `radii`, range 0, no
    /// closed tiles, the tile search for a human player, no smoothing) from the unit to `to`, and"""),
]
