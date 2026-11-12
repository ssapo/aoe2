EDITS=[
("""use crate::movement::Speed;
""","""use crate::groups::formation::top_path;
use crate::math::fmath::{BVector, at_most_or_unordered};
use crate::movement::Mover;
use crate::movement::PathData;
use crate::movement::PathFlags;
use crate::movement::Speed;
use crate::unit_ai::attack_rules::{patrol_distance, patrolrange_188329};
"""),
("""    /// `+0x1c0` holds a patrol path.
    pub patrol_path: bool,
""","""    /// `+0x1c0` holds a patrol path.
    pub patrol_path: bool,
    /// 188329 (`ai+0x1c8`): the saved patrol's points, held only for a defending unit under
    /// `GENIE_EXPERIMENT_PATROLRANGE_188329`.
    pub saved_patrol: Option<SavedPatrol>,
"""),
("""impl Seeker {
    /// `canMoveToAttack` with no target""","""/// The most points of a saved patrol [`SavedPatrol`] holds.
pub const SAVED_PATROL_MAX: usize = 16;

/// A saved patrol's points (`ai+0x1c8` in 188329, the path's `+0x438`..`+0x440`) as the soldier's
/// attack check reads them (`0xcf7e8e`, `0x106efd0`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SavedPatrol {
    /// The first [`SAVED_PATROL_MAX`] points.
    pub points: [BVector; SAVED_PATROL_MAX],
    /// How many points the path holds.
    pub len: usize,
}

impl SavedPatrol {
    /// The saved patrol of `points`.
    #[must_use]
    pub fn of(points: &[BVector]) -> Self {
        let mut held = [BVector::ZERO; SAVED_PATROL_MAX];
        for (to, from) in held.iter_mut().zip(points) {
            *to = *from;
        }
        Self {
            points: held,
            len: points.len(),
        }
    }

    /// Its points.
    ///
    /// # Errors
    ///
    /// A path of more points than it holds.
    pub fn get(&self) -> Result<&[BVector], GenieError> {
        self.points.get(..self.len).ok_or(GenieError::unsupported(
            "a saved patrol of more than 16 points (188329's patrol range)",
        ))
    }
}

/// What 188329's soldier attack check reads of the unit's own path in Defend: slot 0x690
/// (`0x1218ce0`) and slot 0x4a8 (`0x1210e30`).
#[derive(Clone, Copy, Debug)]
pub struct PatrolRoute<'a> {
    /// Slot 0x690: the walked level holds a path and the top path's flag LOOPS is set.
    pub loops: bool,
    /// Slot 0x4a8: the top path's points (the top ancestor's, else the walked level's own);
    /// none without path data or without that path (the slot answers 0).
    pub points: Option<&'a [BVector]>,
}

impl<'a> PatrolRoute<'a> {
    /// The route of a unit's movement state.
    #[must_use]
    pub(crate) fn of(mover: Option<&'a Mover>) -> Self {
        let paths: &[PathData] = mover.map_or(&[], |m| m.paths.as_slice());
        let top = top_path(paths);
        Self {
            loops: paths.first().is_some_and(|l| l.has_path)
                && top.is_some_and(|t| t.path_flags.contains(PathFlags::LOOPS)),
            points: top.map(|t| t.points.as_slice()),
        }
    }
}

impl Seeker {
    /// `canMoveToAttack` with no target"""),
("""pub fn can_attack(
    me: &Attacker,
    seeker: &Seeker,
    t: &Target,
    roles: &Roles,
    unit_ai_tuning: &UnitAiTuning,
) -> Result<bool, GenieError> {
    match me.ai_kind {""","""pub fn can_attack(
    me: &Attacker,
    seeker: &Seeker,
    t: &Target,
    roles: &Roles,
    unit_ai_tuning: &UnitAiTuning,
) -> Result<bool, GenieError> {
    can_attack_on(me, seeker, t, roles, unit_ai_tuning, None)
}

/// [`can_attack`] with the unit's own path `route`, which 188329's soldier reads in Defend
/// ([`PatrolRoute`]).
///
/// # Errors
///
/// As [`can_attack`].
pub fn can_attack_on(
    me: &Attacker,
    seeker: &Seeker,
    t: &Target,
    roles: &Roles,
    unit_ai_tuning: &UnitAiTuning,
    route: Option<PatrolRoute<'_>>,
) -> Result<bool, GenieError> {
    match me.ai_kind {"""),
("""        UnitAiKind::Soldier => soldier_can_attack(me, seeker, t, roles, unit_ai_tuning),""",
"""        UnitAiKind::Soldier => {
            soldier_can_attack_on(me, seeker, t, roles, unit_ai_tuning, route)
        }"""),
("""pub fn soldier_can_attack(
    me: &Attacker,
    s: &Seeker,
    t: &Target,
    roles: &Roles,
    unit_ai_tuning: &UnitAiTuning,
) -> Result<bool, GenieError> {
""","""pub fn soldier_can_attack(
    me: &Attacker,
    s: &Seeker,
    t: &Target,
    roles: &Roles,
    unit_ai_tuning: &UnitAiTuning,
) -> Result<bool, GenieError> {
    soldier_can_attack_on(me, s, t, roles, unit_ai_tuning, None)
}

/// [`soldier_can_attack`] with the unit's own path `route` ([`PatrolRoute`]).
///
/// # Errors
///
/// As [`soldier_can_attack`].
pub fn soldier_can_attack_on(
    me: &Attacker,
    s: &Seeker,
    t: &Target,
    roles: &Roles,
    unit_ai_tuning: &UnitAiTuning,
    route: Option<PatrolRoute<'_>>,
) -> Result<bool, GenieError> {
"""),
("""    if !stance_reaches(me, s, t, unit_ai_tuning)? {""","""    if !stance_reaches_on(me, s, t, unit_ai_tuning, route)? {"""),
("""pub(super) fn stance_reaches(
    me: &Attacker,
    s: &Seeker,
    t: &Target,
    unit_ai_tuning: &UnitAiTuning,
) -> Result<bool, GenieError> {
    let d2 = point_gap_squared(s.state_position, t.position, t.radius);
""","""pub(super) fn stance_reaches(
    me: &Attacker,
    s: &Seeker,
    t: &Target,
    unit_ai_tuning: &UnitAiTuning,
) -> Result<bool, GenieError> {
    stance_reaches_on(me, s, t, unit_ai_tuning, None)
}

/// [`stance_reaches`] with the unit's own path `route`. Under
/// `GENIE_EXPERIMENT_PATROLRANGE_188329` it is 188329's (`0xcf7c93`..`0xcf7f65`): the reach is
/// `MAXSS(range against the target, 0.5)`; in Defend 5 more, and then, on the patrol order
/// (711) with a looping path (slot 0x690) or on the attack move's (733), the target's place
/// (slot 0x568) must lie within the reach of the unit's top path (slot 0x4a8, 0 without one);
/// else with a saved patrol within the reach of that; else the squared gap test.
///
/// # Errors
///
/// As [`stance_reaches`]; under the switch a patrol test without `route`.
pub(super) fn stance_reaches_on(
    me: &Attacker,
    s: &Seeker,
    t: &Target,
    unit_ai_tuning: &UnitAiTuning,
    route: Option<PatrolRoute<'_>>,
) -> Result<bool, GenieError> {
    let d2 = point_gap_squared(s.state_position, t.position, t.radius);
    if patrolrange_188329() {
        // 0xcf7c9d, 0xcf7ca6: MAXSS(slot 0x250, 0.5)
        let reach = Distance::new(maxss(
            me.range_against()?.get(),
            unit_ai_tuning.stance_range_growth,
        ));
        match s.stance {
            // 0xcf7cb8
            UnitStance::StandGround
                if !matches!(s.order, Some(OrderKind::Defend)) && reach.squared() < d2 =>
            {
                return Ok(false);
            }
            // 0xcf7d3b
            UnitStance::Defensive => {
                let reach = reach + Distance::new(unit_ai_tuning.defend_growth);
                let no_route = || {
                    GenieError::unsupported(
                        "a defending soldier's patrol range outside an attack test that holds its path",
                    )
                };
                // 0xcf7d71..0xcf7d92
                let on_patrol = match s.order {
                    Some(OrderKind::Patrol) => route.ok_or_else(no_route)?.loops,
                    Some(OrderKind::AttackMove) => true,
                    _ => false,
                };
                // the target's slot 0x568: its place as x, height, y
                let p = t.position.vector();
                if on_patrol {
                    // 0xcf7dbe..0xcf7df7: slot 0x4a8, 0 without a path; JBE passes
                    let d = match route.ok_or_else(no_route)?.points {
                        Some(points) => patrol_distance(points, p)?.get(),
                        None => 0.0,
                    };
                    return Ok(at_most_or_unordered(d, reach.get()));
                }
                // 0xcf7e5b..0xcf7ec3: the saved patrol
                if s.patrol_path {
                    let saved = s.saved_patrol.ok_or(GenieError::unreachable(
                        "a defending seeker's saved patrol without its points",
                    ))?;
                    let d = patrol_distance(saved.get()?, p)?.get();
                    return Ok(at_most_or_unordered(d, reach.get()));
                }
                // 0xcf7efb
                if reach.squared() < d2 {
                    return Ok(false);
                }
            }
            _ => {}
        }
        return Ok(true);
    }
"""),
]
