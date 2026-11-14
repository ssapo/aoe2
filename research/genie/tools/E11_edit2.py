# ENG-11 case 2: a saved task's class below -1 is kept as the .dat path keeps it. python3 runs/E11_edit2.py
f='genie/crates/engine/genie-import/src/save.rs'
s=open(f,'rb').read().decode('utf-8'); crlf='\r\n' in s; s=s.replace('\r\n','\n')
old='        object_group: ClassId::of_field(t.object_group)?,\n'
assert s.count(old)==1
s=s.replace(old,'        object_group: saved_group(t)?,\n')
anchor='pub fn core_task('
i=s.index(anchor); j=s.rindex('\n\n',0,i)+2
new='''/// A saved task's class (`+0x10`): -1 is any class. A value below -1 is kept as it is, as the
/// `.dat` reader keeps it (`dat_work.rs` `special_group`): build 188329 compares the short with
/// the target's class for equality and with -1 for "any" (`0x12c66c0`, the repair's task pick),
/// so such a task matches no class and is not an any-class task. `GENIE_TRACE_NEGCLASS=1` lists
/// them.
///
/// # Errors
///
/// None for a class below -1; [`ClassId::of_field`]'s otherwise.
fn saved_group(t: &WorldTask) -> Result<Option<ClassId>, GenieError> {
    if t.object_group < -1 {
        if std::env::var_os("GENIE_TRACE_NEGCLASS").is_some() {
            eprintln!(
                "NEGCLASS task={} action={} class={} object={}",
                t.id, t.action_kind, t.object_group, t.object_id
            );
        }
        return Ok(Some(ClassId::of_master(t.object_group)));
    }
    ClassId::of_field(t.object_group)
}

'''
s=s[:j]+new+s[j:]
if crlf: s=s.replace('\n','\r\n')
open(f,'wb').write(s.encode('utf-8'))
print('ok',crlf)
