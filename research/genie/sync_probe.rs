//! Tallies a recording's sync and checkpoint ops by their dt (ms), with the total, to compare
//! the recorded game time with the duration.
use std::collections::BTreeMap;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: sync_probe <replay>")?;
    let bytes = std::fs::read(path)?;
    let chapter = genie_rec::de::chapters(&bytes)?[0];
    let (mut syncs, mut total, mut dts) = (0u64, 0u64, BTreeMap::<u32, u64>::new());
    let mut first: Vec<String> = Vec::new();
    for op in chapter.ops() {
        let op = op?;
        let dt = match &op {
            genie_rec::de::Op::Sync { dt } | genie_rec::de::Op::Checkpoint { dt, .. } => *dt,
            _ => {
                if first.len() < 12 { first.push(format!("{op:?}").chars().take(80).collect()); }
                continue;
            }
        };
        if first.len() < 12 { first.push(format!("dt={dt}")); }
        syncs += 1;
        total += u64::from(dt);
        *dts.entry(dt).or_default() += 1;
    }
    println!("syncs={syncs} total_ms={total} first_ops={first:?}");
    for (dt, n) in dts.iter().rev().take(12) { println!("dt={dt} n={n}"); }
    Ok(())
}
