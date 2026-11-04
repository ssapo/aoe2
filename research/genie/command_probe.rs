//! Tallies a recording's command packets by their first byte (the command id): how many decode
//! with genie-command-codec and how many fail, with the first error of each failing id.
use std::collections::BTreeMap;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: command_probe <replay>")?;
    let bytes = std::fs::read(path)?;
    let chapter = genie_rec::de::chapters(&bytes)?[0];
    let mut tally: BTreeMap<u8, (usize, usize, Option<String>, Option<usize>)> = BTreeMap::new();
    for op in chapter.ops() {
        if let genie_rec::de::Op::Command { packet, .. } = op? {
            let id = packet.first().copied().unwrap_or(0xff);
            let e = tally.entry(id).or_default();
            match genie_command_codec::decode(packet) {
                Ok(_) => e.0 += 1,
                Err(err) => {
                    e.1 += 1;
                    if e.2.is_none() {
                        e.2 = Some(format!("{err:?}").chars().take(160).collect());
                        e.3 = Some(packet.len());
                    }
                }
            }
        }
    }
    for (id, (ok, bad, err, len)) in tally {
        println!("id={id:#04x} ok={ok} fail={bad} len={len:?} {}", err.unwrap_or_default());
    }
    Ok(())
}
