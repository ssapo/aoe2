//! Diagnose task values without changing game semantics.
fn main() -> Result<(), Box<dyn std::error::Error>> {
 let bytes=std::fs::read(std::env::args().nth(1).unwrap())?;
 let d=genie_dat::de::DatFile::read_from(&bytes[..])?;
 println!("civs={} techs={}",d.civs.len(),d.techs.len());
 let encoded=d.to_bytes()?;
 let mut decoded=Vec::new();
 std::io::Read::read_to_end(&mut flate2::read::DeflateDecoder::new(&bytes[..]), &mut decoded)?;
 println!("roundtrip_equal={} original={} encoded={}",decoded==encoded,decoded.len(),encoded.len());
 let mut n=0;
 for (ci,c) in d.civs.iter().enumerate() { for (ui,u) in c.units.iter().enumerate() { if let Some(u)=u {if let Some(b)=&u.bird {for t in &b.tasks {if t.class_id < -1 {n+=1;if n<8 {println!("civ={ci} unit={ui} task={t:?}");}}}}}}}
 println!("invalid_class_tasks={n}");Ok(())
}
