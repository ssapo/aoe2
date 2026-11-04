//! Inspect livestock combat fields and their byte offsets without changing semantics.
use binrw::BinWrite;
fn main()->Result<(),Box<dyn std::error::Error>> {
let b=std::fs::read(std::env::args().nth(1).unwrap())?;let h=genie_rec::de::chapters(&b)?[0].header()?;
for (p,s) in h.players().iter().enumerate(){for o in s.live_objects(){if let Some(st)=o.static_part(){if st.master_obj==1245 || st.master_obj==448 {if let Some(c)=o.combat(){println!("tribe_extra={:?}",c.extra_v68_9);let c=&c.rge_combat_object;let mut out=std::io::Cursor::new(Vec::new());c.write_le_args(&mut out,())?;let mut a=std::io::Cursor::new(Vec::new());c.rge_action_object.write_le_args(&mut a,())?;let offset=a.position() as usize;println!("player={p} id={} master={} action_end={} capture={} tail={:02x?}",st.id,st.master_obj,offset,c.capture_flag,&out.get_ref()[offset.saturating_sub(32)..]);}}}}}Ok(())}
