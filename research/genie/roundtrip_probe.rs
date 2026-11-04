//! Parses an inflated save header with genie-save, writes it back and compares the bytes.
use std::io::Cursor;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: roundtrip_probe <inflated header>")?;
    let original = std::fs::read(path)?;
    let header = genie_save::parse(&original)?;
    let mut out = Cursor::new(Vec::new());
    genie_save::write(&header, &mut out)?;
    let written = out.into_inner();
    let first_diff = original.iter().zip(&written).position(|(a, b)| a != b);
    println!(
        "players={} original={} written={} equal={} first_diff={:?}",
        header.players().len(), original.len(), written.len(), original == written,
        first_diff.map(|d| format!("{d:#x}"))
    );
    Ok(())
}
