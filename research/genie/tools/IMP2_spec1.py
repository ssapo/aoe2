EDITS=[
("""/// A point of −1 is no point (`DAT_14330ec20`).
""","""/// 188329's Explore wait (`0xb79170` set_state, `0xb793d0` update; case 282.4 s of replay
/// 517426097): `GENIE_EXPERIMENT_EXPLORE_WAIT_188329`. `Set_state` 3 only shows the standing
/// sprite; the update of state 3 posts notify 0x202, sets `+0x44` to 1.0 and goes to state 2,
/// whose update counts `+0x44` down by 0.1 and goes back to state 3 once it is used up.
fn explore_wait_188329() -> bool {
    static FLAG: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *FLAG.get_or_init(|| std::env::var_os("GENIE_EXPERIMENT_EXPLORE_WAIT_188329").is_some())
}

/// A point of −1 is no point (`DAT_14330ec20`).
"""),
("""    /// The point it walks to (`+0x38`..`+0x40`), x −1 for none.
    pub point: Position,
}
""","""    /// The point it walks to (`+0x38`..`+0x40`), x −1 for none.
    pub point: Position,
    /// 188329's `+0x44`: the countdown of state 2 until it asks its unit AI again
    /// (`0xb79506`, `0xb7951b`); unused without `GENIE_EXPERIMENT_EXPLORE_WAIT_188329`.
    pub wait: f32,
}
"""),
("""            state: ExploreState::New,
            point,
        };
""","""            state: ExploreState::New,
            point,
            wait: 0.0,
        };
"""),
("""            ExploreState::Stopped => {
                self.point = Position::from([-1.0; 3]);
                Owner::Stopped
            }
            ExploreState::Wait => Owner::WantsPoint,
""","""            // 188329 `0xb791ad`: the standing sprite, the action's target none (it has none),
            // the point gone
            ExploreState::Stopped if explore_wait_188329() => {
                self.point = Position::from([-1.0; 3]);
                Owner::Standing
            }
            ExploreState::Stopped => {
                self.point = Position::from([-1.0; 3]);
                Owner::Stopped
            }
            // 188329 `0xb79331`: the standing sprite only
            ExploreState::Wait if explore_wait_188329() => Owner::Standing,
            ExploreState::Wait => Owner::WantsPoint,
"""),
("""            ExploreState::Walk { .. } => self.walk(c, explorer, me, roles),
            _ => Ok(()),
""","""            ExploreState::Walk { .. } => self.walk(c, explorer, me, roles),
            // 188329 `0xb794d0`: notify 0x202 with 605, `+0x44` = 1.0, set_state 2
            ExploreState::Wait if explore_wait_188329() => {
                explorer.post_own(
                    &mut c.w.parts.unit_ai,
                    NotifyKind::REQUIRES_SEARCH,
                    [AiAction::Explore.value(), 0, 0],
                )?;
                self.wait = 1.0;
                let owner =
                    self.set_state(ExploreState::Stopped, None, &c.w.model.tuning.move_to)?;
                explorer.explore_owner(owner, c)
            }
            // 188329 `0xb7951b`: set_state 3 unless 0 < `+0x44`, then `+0x44` -= 0.1
            ExploreState::Stopped if explore_wait_188329() => {
                let mut r = Ok(());
                if !(0.0 < self.wait) {
                    let owner =
                        self.set_state(ExploreState::Wait, None, &c.w.model.tuning.move_to)?;
                    r = explorer.explore_owner(owner, c);
                }
                self.wait -= f32::from_bits(0x3dcc_cccd);
                r
            }
            _ => Ok(()),
"""),
]
