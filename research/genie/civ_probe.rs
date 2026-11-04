//! Prints each DAT civilization's index, internal name, icon set and resource count.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: civ_probe <empires2_x2_p1.dat>")?;
    let bytes = std::fs::read(path)?;
    let d = genie_dat::de::DatFile::read_from(&bytes[..])?;
    for (i, c) in d.civs.iter().enumerate() {
        println!("{i}\t{:?}\ticon_set={}\tresources={}", c.name, c.icon_set, c.resource_count);
    }
    Ok(())
}
