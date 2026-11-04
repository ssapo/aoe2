//! Verify the explicit replay lobby IDs used when canonical install metadata is absent.
fn main()->Result<(),Box<dyn std::error::Error>> {
 let a:Vec<String>=std::env::args().collect();let b=std::fs::read(&a[1])?;let mut h=genie_rec::de::chapters(&b)?[0].header()?;
 h.resolve_civ_ids_from_lobby(63)?;
 for (id,s) in h.players().iter().enumerate(){println!("player={} civ={} name={:?}",id,s.world_player().base.civ_id,s.world_player().base.civ_data_name);}
 let table=genie_oracle::install::read(std::path::Path::new(&a[2]))?;
 let original=genie_rec::de::chapters(&b)?[0].header()?;
 let world=genie_oracle::slice_from_header(&original,Some(&table))?;
 println!("common-slice civs={:?}",world.players.iter().map(|p|p.civ.get()).collect::<Vec<_>>());
 // Invalid table bounds must not silently produce a civilization.
 let mut h=genie_rec::de::chapters(&b)?[0].header()?;assert!(h.resolve_civ_ids_from_lobby(1).is_err());
 Ok(())
}
