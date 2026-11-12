EDITS=[
("""/// The classes the siege unit never attacks as neutral objects (`FUN_140c1ae10`'s mask
""","""/// 188329's soldier `CanAttack` Defend arm (`0xcf7d3b`..`0xcf7f65`: unit slots 0x690
/// `0x1218ce0` and 0x4a8 `0x1210e30`, the path distance `0x106efd0`) in place of the stop
/// [`defend_patrol_range`], the reach `MAXSS(range, 0.5)` (`0xcf7ca6`) and the path distance's
/// `MINSS` (`0x106f05c`): `GENIE_EXPERIMENT_PATROLRANGE_188329`.
pub(crate) fn patrolrange_188329() -> bool {
    static FLAG: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *FLAG.get_or_init(|| std::env::var_os("GENIE_EXPERIMENT_PATROLRANGE_188329").is_some())
}

/// The classes the siege unit never attacks as neutral objects (`FUN_140c1ae10`'s mask
"""),
("""        least = if least <= d.get() { least } else { d.get() };
""","""        least = if patrolrange_188329() {
            // 188329 `0x106f05c`, `MINSS d, least`: a NaN distance leaves the least
            if d.get() < least { d.get() } else { least }
        } else if least <= d.get() {
            least
        } else {
            d.get()
        };
"""),
]
