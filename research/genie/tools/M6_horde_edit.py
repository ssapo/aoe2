# Finding 55: commandHorde (188329 0x10d86e0), switch GENIE_EXPERIMENT_HORDE_188329. Run once from genie-replays.
import io,os,re
S='genie/crates/engine/genie-core/src/'
def rd(p): return io.open(p,newline='').read()
def wr(p,s): io.open(p,'w',newline='').write(s)
def rep(p,a,b,n=1):
    s=rd(p); nl='\r\n' if '\r\n' in s else '\n'
    a=a.replace('\n',nl); b=b.replace('\n',nl)
    assert s.count(a)==n,(p,a[:60],s.count(a))
    wr(p,s.replace(a,b))
# 1 switch + module
rep(S+'groups/mod.rs','''/// 188329's end of a group move (`0x110d3a0`''','''/// 188329's `commandHorde` (`0x10d86e0`; finding 55): `GENIE_EXPERIMENT_HORDE_188329`.
pub(crate) fn horde_188329() -> bool {
    static FLAG: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *FLAG.get_or_init(|| std::env::var_os("GENIE_EXPERIMENT_HORDE_188329").is_some())
}

/// 188329's end of a group move (`0x110d3a0`''')
rep(S+'groups/mod.rs','mod create;\n','mod create;\nmod horde;\n')
# 2 the two stops
rep(S+'groups/order.rs','''        if self.all_horde_units(group)? {
            return Err(''','''        if self.all_horde_units(group)? {
            if crate::groups::horde_188329() {
                // 188329 0x10d77a8 / 0x10d7804: the horde's command, then the routine returns
                // (no +0x13d write, no stopAllUnits, JOINED stays)
                let (command, range) = match task {
                    Some(t) => (
                        GroupCommandKind::of_action(t.command),
                        t.range.unwrap_or(Distance::ZERO),
                    ),
                    None => (MOVE_COMMAND, Distance::ZERO),
                };
                return self.command_horde(group, command, target, point, range);
            }
            return Err(''')
rep(S+'groups/command.rs','''        if self.all_horde_units(group)? {
            return Err(''','''        if self.all_horde_units(group)? {
            if crate::groups::horde_188329() {
                // 188329 0x10d9060..0x10d9090
                return self.command_horde(group, MOVE_COMMAND, target, point, how.range);
            }
            return Err(''')
# 3 Mover.future
rep(S+'movement/mod.rs','''    #[diff(unsaved)]
    pub sprite_facets: Option<SpriteFacets>,
}
''','''    #[diff(unsaved)]
    pub sprite_facets: Option<SpriteFacets>,
    /// 188329 `+0x3f8`, the future path data a horde's command gives (slot 0x590, `0x120e340`):
    /// the points the next `MoveTo` path request walks instead of its own
    /// ([`Mover::request_path_asked`], `0x120e560`). Not saved.
    #[diff(unsaved)]
    pub future: Option<FuturePath>,
}

/// 188329's future path data ([`Mover::future`]) as a horde gives it: level 2, state 2.
#[derive(Clone, Debug, PartialEq)]
pub struct FuturePath {
    /// The path's points (x, height, y), more than one.
    pub points: Vec<BVector>,
}
''')
for f in ['crates/engine/genie-core/src/combat/attack/tests.rs','crates/engine/genie-core/src/combat/volley/launch.rs','crates/engine/genie-core/src/garrison/tests.rs','crates/engine/genie-core/src/gathering/hunt/tests.rs','crates/engine/genie-core/src/movement/tests.rs','crates/engine/genie-core/src/testing/scene.rs','crates/tools/genie-oracle/src/movers.rs']:
    p='genie/'+f; s=rd(p)
    s2,n=re.subn(r'(\n([ \t]+)sprite_facets: (None|facets),)',r'\1\n\2future: None,',s); assert n==1,(f,n); wr(p,s2)
# 4 path request
rep(S+'movement/path_end.rs','''        let repath_time = self.paths.first().map_or(Seconds::ZERO, |l| l.repath_time);
        self.paths = vec![PathData {
            level: if planned {''','''        self.future = None;
        let repath_time = self.paths.first().map_or(Seconds::ZERO, |l| l.repath_time);
        self.paths = vec![PathData {
            level: if planned {''')
rep(S+'movement/path_end.rs','''        let start = from.vector();
        let mut path = Path::default();
        if ask.resume == WaypointIndex::NONE {
            let _ = path.insert(0, start);
        }
        for &w in &self.user_waypoints {
            let _ = path.push(w);
        }
        self.clear_user_waypoints();
        if ask.resume == WaypointIndex::NONE {''','''        let start = from.vector();
        let mut path = Path::default();
        // 188329 0x120e560 with future path data (+0x3f8, state 2): the unit's place unless it
        // is the future path's first point, then the future points; no own waypoints (they go),
        // no goal, the saved patrol's waypoint is not read
        let future = self.future.take();
        let ask = if future.is_some() {
            PathAsk {
                resume: WaypointIndex::NONE,
                ..ask
            }
        } else {
            ask
        };
        if let Some(f) = &future {
            let first = f.points.first().copied().unwrap_or(start);
            let d = start - first;
            if EPSILON < sqrt(d.x() * d.x() + 0.0 + d.y() * d.y()) {
                let _ = path.insert(0, start);
            }
            for &w in &f.points {
                let _ = path.push(w);
            }
            self.clear_user_waypoints();
        }
        if future.is_none() && ask.resume == WaypointIndex::NONE {
            let _ = path.insert(0, start);
        }
        for &w in &self.user_waypoints {
            let _ = path.push(w);
        }
        self.clear_user_waypoints();
        if future.is_none() && ask.resume == WaypointIndex::NONE {''')
# 5 horde.rs
wr(S+'groups/horde.rs','''//! 188329's `commandHorde` (`0x10d86e0`..`0x10d8e60`; finding 55), behind
//! `GENIE_EXPERIMENT_HORDE_188329`: a group without a formation unit does not move as a
//! formation; each member gets the ordinary work command and a copy of one path planned from
//! the lead, and the group goes on its next awake update.

use crate::GenieError;
use crate::groups::GroupCommandKind;
use crate::groups::GroupFlags;
use crate::groups::GroupId;
use crate::groups::GroupMove;
use crate::groups::GroupTarget;
use crate::map::Distance;
use crate::map::Point;
use crate::math::fmath::BVector;
use crate::movement::FuturePath;
use crate::objects::ObjectId;
use crate::orders::OrderSource;
use crate::orders::Work;
use crate::pathing::tile_path::{Path, Request};
use crate::world::Seconds;
use crate::world::World;

impl World {
    /// 188329 `commandHorde` (`0x10d86e0`) of group `group`: the target data resets, every
    /// member's seconds since attacking are the largest float, and the lead is the member
    /// nearest (0, 0, 0) (`0x10dc850` after the reset); without one the group only gets flag
    /// 0x40 (not begun). Else the target data is set (a target's range is `range` + 2.0), one
    /// path is planned from the lead to `point` (`0x1057a40`: radii = the target's radius + the
    /// lead master's, range `range`, the full search unless the lead's player is a computer),
    /// and every member the world holds takes its points as future path data (slot 0x590: from
    /// point 0 for the lead, from point 1 for the others, only with more than one point) and the
    /// ordinary work command (slot 0x138 at height 1.0, direct). The group's current command is
    /// `command` and flag 0x40 is set: begun.
    ///
    /// # Errors
    ///
    /// A lead without a tile planner (`0x1078d60`, not read), and what the work command does
    /// not model.
    pub(super) fn command_horde(
        &mut self,
        group: GroupId,
        command: GroupCommandKind,
        target: Option<ObjectId>,
        point: Point,
        range: Distance,
    ) -> Result<GroupMove, GenieError> {
        let target = target.filter(|&t| self.object(t).is_some());
        let g = self.groups.held_mut(group)?;
        g.forget_target_data();
        g.current_target.range = Distance::ZERO;
        g.current_target.certain_action = None;
        for m in &mut g.members {
            m.seconds_since_attacking = Seconds::MAX;
        }
        let lead = self.nearest_to_target(group);
        self.groups.held_mut(group)?.motion.lead = lead;
        let g = self.groups.held(group)?;
        let held = self.lead_object(&g.motion).is_some();
        let Some((lead, (lp, lu))) = lead
            .filter(|_| held)
            .and_then(|id| self.object(id).map(|o| (id, o)))
        else {
            self.groups.held_mut(group)?.flags |= GroupFlags::NO_PATH_UNIT;
            return Ok(GroupMove::NotBegun);
        };
        let from = lu.position().ground();
        let master = lu.master(self.master_tables(), lp)?;
        let (lead_radius, restriction) = (master.radius.x(), master.terrain_restriction);
        let full = !self.players.player(lp)?.kind.is_computer();
        match target {
            None => {
                let t = &mut self.groups.held_mut(group)?.current_target;
                t.target = GroupTarget::None;
                t.original_position = BVector::new(point.x(), 0.0, point.y());
                t.range = range;
                t.target_radius = Distance::ZERO;
                t.disable_retargeting = 0;
                t.certain_action = None;
            }
            Some(o) => {
                self.raise_attack_ranges(group, o)?;
                let at = self.moved_place_of(o)?;
                let radius = self.target_radius(o)?;
                let t = &mut self.groups.held_mut(group)?.current_target;
                t.target = GroupTarget::Object(o);
                t.original_position = at;
                t.range = Distance::new(range.get() + 2.0);
                t.target_radius = radius;
                t.disable_retargeting = 0;
                t.certain_action = None;
            }
        }
        let target_radius = self.groups.held(group)?.current_target.target_radius;
        let req = Request {
            from,
            to: point,
            radii: Distance::new(target_radius.get() + lead_radius),
            range,
            closed: Vec::new(),
            full,
        };
        let mut path = Path::default();
        let tiles = self.spatial.tiles();
        let Some(planner) = self.pathing.planner(restriction, tiles) else {
            return Err(GenieError::unsupported(
                "a horde's path without a tile planner (188329 0x1078d60)",
            ));
        };
        let _ = planner.plan::<GenieError>(&req, false, &mut path, None, &self.model.tuning.tile_path)?;
        let ids: Vec<ObjectId> = self
            .groups
            .held(group)?
            .members
            .iter()
            .map(|m| m.id)
            .collect();
        for id in ids {
            if self.world_object(id).is_none() {
                continue;
            }
            let skip = usize::from(id != lead);
            let points: Vec<BVector> = path.points.get(skip..).unwrap_or(&[]).to_vec();
            if 1 < points.len()
                && let Some(m) = self.parts.mover_mut(id)
            {
                m.future = Some(FuturePath { points });
            }
            self.give_work(
                id,
                &Work {
                    target,
                    point: point.with_height(1.0),
                    carry_test: false,
                    filter: None,
                    source: OrderSource::Direct,
                },
            )?;
        }
        let g = self.groups.held_mut(group)?;
        g.current_command = command;
        g.flags |= GroupFlags::NO_PATH_UNIT;
        Ok(GroupMove::Begun)
    }
}
''')
print('ok')
