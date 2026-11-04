//! Prints a DAT unit (civ, unit id) with every field, to compare with a save's master.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut a = std::env::args().skip(1);
    let path = a.next().ok_or("usage: unit_probe <dat> <civ> <unit>")?;
    let civ: usize = a.next().ok_or("civ")?.parse()?;
    let unit: usize = a.next().ok_or("unit")?.parse()?;
    let bytes = std::fs::read(path)?;
    let d = genie_dat::de::DatFile::read_from(&bytes[..])?;
    let mut u = d.civs[civ].units[unit].clone().ok_or("no unit")?;
    if let Some(b) = u.bird.as_mut() { b.tasks.clear(); }
    println!("{u:#?}");
    Ok(())
}
