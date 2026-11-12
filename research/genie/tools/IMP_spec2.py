OLD1 = r'''    let blocked = mask.blocked() | BLOCKED;
    closest_resource_at(
        &seeker,
        site.as_ref(),
        kind,
        cap,
        ResourceWorld {
            map: c.spatial.map,'''
NEW1 = r'''    let blocked = mask.blocked() | BLOCKED;
    // EXPERIMENT (`GENIE_EXPERIMENT_RESSEARCH_188329`), 188329 0x107af40 for the unit AI's
    // current target: the unit's walked level holds a path whose rest, from the unit's place
    // over the waypoints from its index on (0x106f160), is longer than 2.5 times the gap of the
    // two footprints (0x124d8d0) plus 3.5
    let detour = gather_search::ressearch_188329()
        && current
            .and_then(|id| others.find(id))
            .is_some_and(|(owner, t)| {
                let Ok(tm) = t.master(every, owner) else {
                    return false;
                };
                let Some(level) = mover.paths.first().filter(|l| l.has_path) else {
                    return false;
                };
                let gap = crate::movement::footprint_gap(me_at, master.radius, t.position(), tm.radius);
                let mut rest = 0.0_f32;
                let (mut px, mut py) = (me_at.x(), me_at.y());
                let from = usize::try_from(level.waypoint.get()).unwrap_or(usize::MAX);
                for w in level.points.iter().skip(from) {
                    let (dx, dy) = (w.x() - px, w.y() - py);
                    rest += crate::math::fmath::sqrt(dy * dy + dx * dx);
                    px = w.x();
                    py = w.y();
                }
                gap.get() * 2.5 + 3.5 < rest
            });
    let reads =
        ResourceWorld {
            map: c.spatial.map,'''
OLD2 = r'''                    plan,
                    id,
                    Distance::ZERO,
                    master_id,
                )
            },
        },
        gather_search_tuning,
    )
}'''
NEW2 = r'''                    plan,
                    id,
                    gather_search::reach_range(),
                    master_id,
                )
            },
        };
    if gather_search::ressearch_188329() && ObjectState::Alive <= min_state {
        return gather_search::closest_resource_at_188329(
            &seeker,
            site.as_ref(),
            kind,
            reads,
            gather_search_tuning,
            detour,
        );
    }
    closest_resource_at(
        &seeker,
        site.as_ref(),
        kind,
        cap,
        reads,
        gather_search_tuning,
    )
}'''
EDITS = [(OLD1, NEW1), (OLD2, NEW2)]
