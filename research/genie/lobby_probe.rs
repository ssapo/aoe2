//! Reads only the save's file header (lobby) of an inflated header and prints where it ends.
use std::io::{Cursor, Read};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: lobby_probe <inflated header>")?;
    let mut bytes = Vec::new();
    let _ = std::fs::File::open(path)?.read_to_end(&mut bytes)?;
    let raw = u32::from_le_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]);
    let mut c = Cursor::new(&bytes[..]);
    let h = <genie_save::generated::world::SaveGameFileHeader as binrw::BinRead>::read_le_args(&mut c, (raw,))?;
    println!("lobby_end={:#x}", c.position());
    println!("{h:#?}");
    Ok(())
}
