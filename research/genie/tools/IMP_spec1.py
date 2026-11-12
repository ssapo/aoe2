OLD1 = r'''    const NO_STEPS: i32 = 1_000_000;
    const TILE_CENTRE: f32 = GATHER_SEARCH_TILE_CENTRE;
    let ResourceWorld {'''
NEW1 = r'''    const NO_STEPS: i32 = 1_000_000;
    const TILE_CENTRE: f32 = GATHER_SEARCH_TILE_CENTRE;
    // EXPERIMENT (`GENIE_EXPERIMENT_RESSEARCH_188329`): build 188329's search (0xd23bf0)
    if ressearch_188329() && ObjectState::Alive <= seeker.min_state {
        return closest_resource_at_188329(seeker, site, kind, reads, gather_search_tuning, false);
    }
    let ResourceWorld {'''
OLD2 = r'''/// `FUN_140fdd470` then `FUN_140fdd5f0`: the gather group of a resource held, and the most workers'''
NEW2 = r'''/// EXPERIMENT: whether `GENIE_EXPERIMENT_RESSEARCH_188329` is set (build 188329's
/// `ClosestResourceObject`, 0xd23bf0 over 0xd19f60).
#[must_use]
pub fn ressearch_188329() -> bool {
    std::env::var_os("GENIE_EXPERIMENT_RESSEARCH_188329").is_some()
}

/// The range the search's reach test passes (slot 0x408): 0 as the old build's; with
/// `GENIE_EXPERIMENT_RESSEARCH_188329` 188329's 0.1 (0xd1adaa..0xd1adb9 and 0xd19ea0: 0x15fe460
/// holds, the map's `+0` and `+8` both set by 0x111f5b0 since 0x15fec60 holds), unless the
/// diagnostic `GENIE_EXPERIMENT_RESSEARCH_RANGE0` is set.
#[must_use]
pub fn reach_range() -> Distance {
    if ressearch_188329() && std::env::var_os("GENIE_EXPERIMENT_RESSEARCH_RANGE0").is_none() {
        Distance::new(0.1)
    } else {
        Distance::ZERO
    }
}

/// One call of 188329's tile search (0xd19f60): its arguments past the unit, the kind and the
/// unit AI's current target.
struct Pass188329 {
    /// `param_4`: the search's point, truncated.
    point: Tile,
    /// The unit's own tile, which the seeds sort by (0xd1a7f0..0xd1a92a).
    unit: Tile,
    /// `param_5`, `param_6`: the seeds' box.
    seed_lo: Tile,
    seed_hi: Tile,
    /// The box (`param_7`, `param_8`) is the point less and plus this.
    half: i32,
    /// `param_9`: the farthest distance of a tile from the point.
    range: i32,
    /// `param_10`: what each free side adds to a resource's room.
    per_side: u8,
}

/// The four directions of 0x324a1c0.
const DIRS_188329: [(i32, i32); 4] = [(0, -1), (-1, 0), (0, 1), (1, 0)];

/// 188329's tile search (0xd19f60) with its side counter (0xd1c390): a flood over the passable
/// tiles of the box from the seeds (sorted, stable, by the squared tile distance from the unit's
/// tile), a popped tile's four neighbours looked at in the order its flag gives. A resource on a
/// neighbour has room for its free sides (2 each, a corner more or less) less its workers, plus 1
/// for the unit AI's current target: with room and reached it is the answer (the current target
/// only unless `current_detour`, 0x107af40); else it is the low-priority answer when its steps
/// less its room are the least and it is reached. 30 reach tests end the search.
#[allow(clippy::too_many_arguments)]
fn pass_188329<W>(
    p: &Pass188329,
    kind: GatherGroup,
    (current, current_detour): (Option<ObjectId>, bool),
    map: GridSize,
    world: &mut W,
    (explored, passable, objects): (&Explored<'_, W>, &Passable<'_, W>, &ObjectsOn<'_, W>),
    reach: &mut Reaches<'_, W>,
    tuning: &GatherSearchTuning,
) -> Result<Option<(ObjectId, i32)>, GenieError> {
    let clamp = |v: i32, hi: i32| {
        if hi < v {
            hi
        } else if v < 0 {
            0
        } else {
            v
        }
    };
    let (w1, h1) = (map.width() - 1, map.height() - 1);
    let x0 = clamp(p.point.x().wrapping_sub(p.half), w1);
    let y0 = clamp(p.point.y().wrapping_sub(p.half), h1);
    let x1 = clamp(p.point.x().wrapping_add(p.half), w1);
    let y1 = clamp(p.point.y().wrapping_add(p.half), h1);
    let bw = x1 - x0 + 1;
    let area = (y1 - y0 + 1) * bw;
    if area <= 1 {
        return Ok(None);
    }
    let inbox = |x: i32, y: i32| x0 <= x && x <= x1 && y0 <= y && y <= y1;
    let at = |x: i32, y: i32| ((y - y0) * bw + (x - x0)) as usize;
    let mut seen = vec![false; area as usize];
    let mut count = vec![0u8; area as usize];
    let mut mask = vec![0u8; area as usize];
    // the seeds: rows outer, columns inner
    let mut seeds: Vec<(i32, i32)> = Vec::new();
    for y in p.seed_lo.y()..=p.seed_hi.y() {
        for x in p.seed_lo.x()..=p.seed_hi.x() {
            if inbox(x, y) && passable(world, Tile::new(x, y)) {
                *seen.checked_mut(at(x, y))? = true;
                seeds.push((x, y));
            }
        }
    }
    let (ux, uy) = (p.unit.x(), p.unit.y());
    // 0xd0b0c0 (insertion, up to 32) and 0xd0b210 (merge): both stable
    seeds.sort_by_key(|&(x, y)| {
        let (dx, dy) = (x.wrapping_sub(ux), y.wrapping_sub(uy));
        dx.wrapping_mul(dx).wrapping_add(dy.wrapping_mul(dy))
    });
    // (x, y, steps, flag)
    let mut queue: Vec<(i32, i32, u16, bool)> = seeds
        .iter()
        .map(|&(x, y)| {
            let flag = (p.point.y() - y).abs() < (p.point.x() - x).abs();
            (x, y, 0, flag)
        })
        .collect();
    let mut best: Option<(ObjectId, i32)> = None;
    let mut best_score = 1_000_000_i32;
    let mut tested = 0_i32;
    let mut head = 0_usize;
    while tested < TESTED {
        let Some(&(tx, ty, steps, flag)) = queue.get(head) else {
            break;
        };
        head += 1;
        // 0x42c482c: 0x3010200 with the flag, else 0x2000301
        let order: [usize; 4] = if flag { [0, 2, 1, 3] } else { [1, 3, 0, 2] };
        for d in order {
            if TESTED <= tested {
                break;
            }
            let (ddx, ddy) = *DIRS_188329.checked(d)?;
            let (nx, ny) = (tx + ddx, ty + ddy);
            if !inbox(nx, ny) {
                continue;
            }
            let n = Tile::new(nx, ny);
            let dist = pass_distance(p.point, n, tuning);
            if p.range < dist {
                continue;
            }
            if !explored(world, n)? {
                continue;
            }
            let on_tile = objects(world, n)?;
            let found = first_resource(&on_tile, kind)?;
            let pass = passable(world, n);
            if let Some(o) = found {
                let sides: i32 = if pass {
                    // 0xd1ac40..0xd1acdf: the popped tile's free neighbours
                    let mut s = 0_i32;
                    for b in order {
                        let (bx, by) = *DIRS_188329.checked(b)?;
                        let (ax, ay) = (tx + bx, ty + by);
                        if inbox(ax, ay) {
                            let a = Tile::new(ax, ay);
                            let there = objects(world, a)?;
                            if first_resource(&there, kind)?.is_none() && passable(world, a) {
                                s += i32::from(p.per_side);
                            }
                        }
                    }
                    s
                } else {
                    // 0xd1c390: the side of the resource's tile that faces the popped tile
                    let b = (d + 2) & 3;
                    let i = at(nx, ny);
                    *mask.checked_mut(i)? |= 1_u8 << b;
                    let c = count.checked_mut(i)?;
                    *c = c.wrapping_add(p.per_side);
                    for b2 in [(b + 1) & 3, (b + 3) & 3] {
                        let (bx, by) = *DIRS_188329.checked(b)?;
                        let (b2x, b2y) = *DIRS_188329.checked(b2)?;
                        let (cx, cy) = (nx + bx + b2x, ny + by + b2y);
                        if passable(world, Tile::new(cx, cy)) {
                            if *mask.checked(i)? & (1_u8 << b2) != 0 {
                                let c = count.checked_mut(i)?;
                                *c = c.wrapping_add(1);
                            }
                        } else if !inbox(cx, cy) || *count.checked(at(cx, cy))? != 0 {
                            let c = count.checked_mut(i)?;
                            *c = c.wrapping_sub(1);
                        }
                    }
                    i32::from(*count.checked(i)?)
                };
                let is_current = current == Some(o.id);
                // 0xd1ad39..0xd1ad4c
                let room = i32::from(is_current)
                    .wrapping_sub(o.workers.get())
                    .wrapping_add(sides);
                let (mut reached, mut skip) = (false, false);
                if 0 < room {
                    tested += 1;
                    if reach(world, o.id)? {
                        if is_current && current_detour {
                            reached = true;
                        } else {
                            return Ok(Some((o.id, dist)));
                        }
                    } else {
                        skip = true;
                    }
                }
                if !skip {
                    let score = i32::from(steps).wrapping_sub(room);
                    if score < best_score {
                        let ok = if reached {
                            true
                        } else {
                            tested += 1;
                            reach(world, o.id)?
                        };
                        if ok {
                            best = Some((o.id, dist));
                            best_score = score;
                        }
                    }
                }
            }
            let s = seen.checked_mut(at(nx, ny))?;
            if !*s {
                *s = true;
                if pass {
                    queue.push((nx, ny, steps.wrapping_add(1), nx != tx));
                }
            }
        }
    }
    Ok(best)
}

/// EXPERIMENT (`GENIE_EXPERIMENT_RESSEARCH_188329`): [`closest_resource_at`] as build 188329 has
/// it (0xd23bf0): the worker cap is not read. Without a site, or with one outside the unit's
/// zone that is no dock, one search ([`pass_188329`]) from the point's tile (the site's tile for
/// such a site) within the unit's line of sight plus 5, its box that and a half around the tile.
/// From a site's footprint first one from the footprint's tiles within the site's line of sight
/// plus 10 around the site's tile, then when it finds nothing the one from the unit's tile.
/// `current_detour` is 0x107af40 for the unit AI's current target: the unit walks a path whose
/// rest is longer than 2.5 times its gap to that target plus 3.5.
///
/// # Errors
///
/// As [`closest_resource`].
pub fn closest_resource_at_188329<W>(
    seeker: &Seeker,
    site: Option<&SearchSite>,
    kind: GatherGroup,
    reads: ResourceWorld<'_, W>,
    gather_search_tuning: &GatherSearchTuning,
    current_detour: bool,
) -> Result<(Option<ObjectId>, Option<i32>), GenieError> {
    let ResourceWorld {
        map,
        world,
        explored,
        passable,
        objects,
        reach,
    } = reads;
    if seeker.state < seeker.min_state {
        return Ok((None, None));
    }
    if seeker.my_pasture.is_some() {
        return Err(GenieError::unsupported(
            "a resource search by a unit with a pasture of its own",
        ));
    }
    let unit_tile = Tile::new(seeker.position.x() as i32, seeker.position.y() as i32);
    let los = SightTiles::of(seeker.line_of_sight).get();
    let single = |at: Tile| {
        let r = los.wrapping_add(5);
        Pass188329 {
            point: at,
            unit: unit_tile,
            seed_lo: at,
            seed_hi: at,
            half: r.wrapping_mul(3) / 2,
            range: r,
            per_side: 2,
        }
    };
    let current = (seeker.current_target, current_detour);
    let last = match site {
        Some(s) if s.footprint => {
            let (sx, sy) = (s.position.x(), s.position.y());
            let (rx, ry) = (s.radius.x(), s.radius.y());
            let r = SightTiles::of(s.line_of_sight).get().wrapping_add(10);
            let first = Pass188329 {
                point: Tile::new(sx as i32, sy as i32),
                unit: unit_tile,
                seed_lo: Tile::new(
                    ((sx - rx) as i32).wrapping_sub(1).max(0),
                    ((sy - ry) as i32).wrapping_sub(1).max(0),
                ),
                seed_hi: Tile::new(
                    ((sx + rx) as i32).min(map.width() - 1),
                    ((sy + ry) as i32).min(map.height() - 1),
                ),
                half: r.wrapping_mul(3) / 2,
                range: r,
                // the unit's slot 0x528 (0x113c090 for all but the class of vtable 0x32b4fa8) is 0
                per_side: 2,
            };
            if let Some((id, d)) = pass_188329(
                &first,
                kind,
                current,
                map,
                world,
                (explored, passable, objects),
                reach,
                gather_search_tuning,
            )? {
                return Ok((Some(id), Some(d)));
            }
            single(unit_tile)
        }
        Some(s) => single(Tile::new(s.position.x() as i32, s.position.y() as i32)),
        None => single(unit_tile),
    };
    Ok(pass_188329(
        &last,
        kind,
        current,
        map,
        world,
        (explored, passable, objects),
        reach,
        gather_search_tuning,
    )?
    .map_or((None, None), |(id, d)| (Some(id), Some(d))))
}

/// `FUN_140fdd470` then `FUN_140fdd5f0`: the gather group of a resource held, and the most workers'''
EDITS = [(OLD1, NEW1), (OLD2, NEW2)]
