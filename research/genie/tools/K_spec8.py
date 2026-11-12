EDITS=[
("""        let (chosen, result) =
            if second.unwrap_or(Found::OffMap) != first || levels.length < tiles.length {
                (&levels, first)
            } else {
                (&tiles, second.unwrap_or(first))
            };
""","""        let (chosen, result) = if std::env::var_os("GENIE_EXPERIMENT_PLANCHOICE_188329").is_some() {
            // 188329 0x1057ea9..0x1057fa7: the tile path when its search reached the goal too
            // and, with the levels path ending within `max(range^2, 1) + radii` (squared) of the
            // goal, it is no longer than the levels path; with the levels path ending farther,
            // when the tile path ends within it
            let goal = BVector::new(req.to.x(), 0.0, req.to.y());
            // 0x106f250: the last point, the zero point of a path under 2 points
            let end = |p: &Path| match p.points.last() {
                Some(&last) if 2 <= p.points.len() => last,
                _ => BVector::new(0.0, 0.0, 0.0),
            };
            let e = |v: BVector| {
                let d = v - goal;
                d.height() * d.height() + d.x() * d.x() + d.y() * d.y()
            };
            let r2 = req.range.get() * req.range.get();
            // MAXSS r2, 1.0: a NaN takes the 1
            let lim = (if r2 > 1.0 { r2 } else { 1.0 }) + req.radii.get();
            let take = if lim >= e(end(&levels)) {
                levels.length.get() >= tiles.length.get()
            } else {
                lim >= e(end(&tiles))
            };
            if second == Some(Found::Goal) && first == Found::Goal && take {
                (&tiles, Found::Goal)
            } else {
                (&levels, first)
            }
        } else if second.unwrap_or(Found::OffMap) != first || levels.length < tiles.length {
            (&levels, first)
        } else {
            (&tiles, second.unwrap_or(first))
        };
"""),
]
