EDITS=[
("""        if sprites_change {
""","""        if std::env::var_os("GENIE_TRACE_MASTERHP").is_some() {
            eprintln!(
                "MASTERHP id={:?} master={:?}->{:?} hp={:?}->{:?} share={hp} whole={} change={sprites_change} entries={:?}",
                unit.id,
                old.id,
                next.id,
                old_hp,
                unit.life.hp,
                hp as i32 as i16,
                next.damage_graphics
            );
        }
        if sprites_change {
"""),
]
