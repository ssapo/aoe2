//! Lists the DAT tasks whose class is below -1: (action kind, class, unit_id) with counts and a few
//! unit ids, to study what a negative class means.
use std::collections::BTreeMap;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: task_probe <dat>")?;
    let bytes = std::fs::read(path)?;
    let d = genie_dat::de::DatFile::read_from(&bytes[..])?;
    let mut seen: BTreeMap<(i16, i16, i16, i16), (usize, Vec<usize>)> = BTreeMap::new();
    for c in &d.civs {
        for (ui, u) in c.units.iter().enumerate() {
            let Some(u) = u else { continue };
            let Some(b) = &u.bird else { continue };
            for t in &b.tasks {
                if t.class_id < -1 {
                    let e = seen.entry((t.action_kind, t.class_id, t.unit_id, t.task_kind)).or_default();
                    e.0 += 1;
                    if !e.1.contains(&ui) && e.1.len() < 8 { e.1.push(ui); }
                }
            }
        }
    }
    for ((a, cl, uid, tk), (n, units)) in seen {
        println!("action={a} class={cl} unit_id={uid} task_kind={tk} count={n} units={units:?}");
    }
    Ok(())
}
