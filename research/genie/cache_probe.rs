//! Verify special task-group persistence and direct/cached game-data imports.
use genie_model::objects::masters::{Task,ClassId,ActionKind};
fn main()->Result<(),Box<dyn std::error::Error>> {
 for raw in [-1288i16,-1256,-1448] {
  let mut t=Task::default();t.action_kind=ActionKind::try_from(154)?;t.object_group=Some(ClassId::of_master(raw));
  let json=serde_json::to_string(&t)?;let recovered:Task=serde_json::from_str(&json)?;
  assert_eq!(recovered,t);assert!(serde_json::from_str::<ClassId>(&raw.to_string()).is_err());
 }
 println!("special groups JSON preserved; ordinary ClassId still rejects negatives");
 let a:Vec<String>=std::env::args().collect();let path=std::path::Path::new(&a[1]);let dir=std::path::Path::new(&a[2]);
 let direct=genie_oracle::install::read(path)?;
 let first=genie_oracle::install::load(path,dir)?;let second=genie_oracle::install::load(path,dir)?;
 assert_eq!(direct,first);assert_eq!(first,second);
 println!("DAT direct/cold-cache/warm-cache equal; civ tables={} canonical names={}",direct.civilization_count,direct.civilization_names.len());Ok(())
}
