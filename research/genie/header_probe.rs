fn main() -> Result<(), Box<dyn std::error::Error>> {
 let bytes=std::fs::read(std::env::args().nth(1).unwrap())?;
 let chapters=genie_rec::de::chapters(&bytes)?;
 println!("chapters: {}",chapters.len());
 println!("save version: {:?}",chapters[0].save_version()?);
 let header=chapters[0].header()?;
 println!("players: {}",header.players().len());
 Ok(())
}
