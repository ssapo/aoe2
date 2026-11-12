# Step 3: GENIE_TRACE_GAIN (diagnostic output only). Run once from genie-replays.
import io
S='genie/crates/engine/genie-core/src/'
def rd(p): return io.open(p,newline='').read()
def wr(p,s): io.open(p,'w',newline='').write(s)
def rep(p,a,b,n=1):
    s=rd(p); nl='\r\n' if '\r\n' in s else '\n'
    a=a.replace('\n',nl); b=b.replace('\n',nl)
    assert s.count(a)==n,(p,a[:60],s.count(a)); wr(p,s.replace(a,b))
wr(S+'gain_trace.rs','''//! DIAGNOSTIC (`GENIE_TRACE_GAIN`): what each player's units gave their player at drop-offs,
//! split by where the load came from, for the census tool's `GAIN` lines. The simulation never
//! reads it: the hooks only write here, and only when the switch is set.
//!
//! A unit's load is a list of (source, amount) pieces, added whenever its held amount grows
//! (the Gather's and the Hunt's work, by the target's class and master). A drop-off splits the
//! amount given by those pieces; a civilization's additional resources of the load count under
//! the load's largest source.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// The sources, in the order of a total's columns: herdable (class 58), predator animal (class
/// 10: boar), prey animal (class 9: deer), berry bush (class 7), farm (class 49), fish (classes
/// 5 and 33, and the fish trap, master 199), tree (class 15), mine (classes 32 and 8), other.
pub const SOURCES: usize = 9;

/// A player's totals: `[resource][source]`, the resources food, wood, stone, gold (the
/// attributes 0 to 3).
pub type Totals = [[f64; SOURCES]; 4];

#[derive(Default)]
struct State {
    loads: HashMap<i32, Vec<(usize, f32)>>,
    last: HashMap<i32, usize>,
    totals: Vec<Totals>,
}

fn enabled() -> bool {
    static FLAG: OnceLock<bool> = OnceLock::new();
    *FLAG.get_or_init(|| std::env::var_os("GENIE_TRACE_GAIN").is_some())
}

fn state() -> &'static Mutex<State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(State::default()))
}

const fn source(class: i16, master: i16) -> usize {
    match class {
        58 => 0,
        10 => 1,
        9 => 2,
        7 => 3,
        49 => {
            if master == 199 {
                5
            } else {
                4
            }
        }
        5 | 33 => 5,
        15 => 6,
        32 | 8 => 7,
        _ => 8,
    }
}

/// Unit `unit`'s load grew by `gain` from a target of `master` and `class`; `held` is its load
/// after it (a load that is all this gain starts anew).
pub fn grew(unit: i32, master: i16, class: i16, gain: f32, held: f32) {
    if !enabled() {
        return;
    }
    let Ok(mut s) = state().lock() else { return };
    let from = source(class, master);
    let _ = s.last.insert(unit, from);
    let load = s.loads.entry(unit).or_default();
    if held <= gain + 1e-4 {
        load.clear();
    }
    match load.iter_mut().find(|p| p.0 == from) {
        Some(p) => p.1 += gain,
        None => load.push((from, gain)),
    }
}

/// Unit `unit` of player `player` gave its player `amount` of attribute `kind`; `extra`: an
/// additional resource of the load just given.
pub fn dropped(player: usize, unit: i32, kind: i16, amount: f32, extra: bool) {
    if !enabled() || !(0..4).contains(&kind) {
        return;
    }
    let Ok(mut s) = state().lock() else { return };
    let resource = kind as usize;
    if s.totals.len() <= player {
        s.totals.resize(player + 1, [[0.0; SOURCES]; 4]);
    }
    if extra {
        let from = s.last.get(&unit).copied().unwrap_or(SOURCES - 1);
        s.totals[player][resource][from] += f64::from(amount);
        return;
    }
    let load = s.loads.remove(&unit).unwrap_or_default();
    let whole: f32 = load.iter().map(|p| p.1).sum();
    if whole <= 0.0 {
        let from = s.last.get(&unit).copied().unwrap_or(SOURCES - 1);
        s.totals[player][resource][from] += f64::from(amount);
        return;
    }
    let mut most = (SOURCES - 1, 0.0f32);
    for &(from, part) in &load {
        s.totals[player][resource][from] += f64::from(amount) * f64::from(part) / f64::from(whole);
        if most.1 < part {
            most = (from, part);
        }
    }
    let _ = s.last.insert(unit, most.0);
}

/// Every player's totals so far (index = player number; players that gave nothing may be
/// missing).
#[must_use]
pub fn totals() -> Vec<Totals> {
    state().lock().map(|s| s.totals.clone()).unwrap_or_default()
}
''')
rep(S+'lib.rs','pub mod garrison;\n','pub mod gain_trace;\npub mod garrison;\n')
rep(S+'gathering/gather/work.rs','''        (r.extras).gain(&mut unit.extra, gain, target.master_id, target.class);
''','''        (r.extras).gain(&mut unit.extra, gain, target.master_id, target.class);
        crate::gain_trace::grew(unit.id.get(), i16::from(target.master_id), target.class.get(), gain.get(), held.get());
''')
rep(S+'gathering/gather/work.rs','''            (r.extras).gain(&mut unit.extra, over, target.master_id, target.class);
''','''            (r.extras).gain(&mut unit.extra, over, target.master_id, target.class);
            crate::gain_trace::grew(unit.id.get(), i16::from(target.master_id), target.class.get(), over.get(), held.get());
''')
rep(S+'gathering/gather/work.rs','''            c.give_load(c.w.model.slots.attribute.food, sold)?;
''','''            c.give_load(c.w.model.slots.attribute.food, sold)?;
            crate::gain_trace::dropped(c.player.index(), unit.id.get(), i16::from(c.w.model.slots.attribute.food), sold.get(), false);
''')
rep(S+'gathering/hunt/gathering.rs','''        (r.extras).gain(&mut unit.extra, gain, victim.master_id, victim.class);
''','''        (r.extras).gain(&mut unit.extra, gain, victim.master_id, victim.class);
        crate::gain_trace::grew(unit.id.get(), i16::from(victim.master_id), victim.class.get(), gain.get(), held.get());
''')
rep(S+'gathering/hunt/gathering.rs','''            (r.extras).gain(&mut unit.extra, over, victim.master_id, victim.class);
''','''            (r.extras).gain(&mut unit.extra, over, victim.master_id, victim.class);
            crate::gain_trace::grew(unit.id.get(), i16::from(victim.master_id), victim.class.get(), over.get(), held.get());
''')
for f,tag in (('gathering/gather/unit.rs','gather'),('gathering/hunt/hunter.rs','hunt')):
    s=rd(S+f); nl='\r\n' if '\r\n' in s else '\n'
    a='c.give_load(kind, amount)?;'+nl; assert s.count(a)==1,(f,s.count(a))
    i=s.index(a); ind=s[s.rfind('\n',0,i)+1:i]
    s=s.replace(a,a+ind+'crate::gain_trace::dropped(c.player.index(), self.id.get(), i16::from(kind), amount.get(), false);'+nl)
    a='c.give_load(extra, more)?;'+nl; assert s.count(a)==1,(f,s.count(a))
    i=s.index(a); ind=s[s.rfind('\n',0,i)+1:i]
    s=s.replace(a,a+ind+'crate::gain_trace::dropped(c.player.index(), self.id.get(), i16::from(extra), more.get(), true);'+nl)
    wr(S+f,s)
C='genie/crates/tools/genie-oracle/src/census.rs'
rep(C,'''    let mut dump_prev = u64::from(turns.world_time.millis());
''','''    let mut dump_prev = u64::from(turns.world_time.millis());
    let mut gain_prev = u64::from(turns.world_time.millis());
''')
rep(C,'''        // DIAGNOSTIC: GENIE_DUMP_MS=15000,30000 prints''','''        // DIAGNOSTIC: GENIE_TRACE_GAIN=1 prints, each time the world time passes a multiple of 10 s, each
        // human player's cumulative amounts given at drop-offs by source (genie_core::gain_trace).
        if std::env::var_os("GENIE_TRACE_GAIN").is_some() {
            let ms = u64::from(turns.world_time.millis());
            if ms / 10_000 != gain_prev / 10_000 {
                let totals = genie_core::gain_trace::totals();
                for p in 1..turns.players.len() {
                    let t = totals.get(p).copied().unwrap_or([[0.0; genie_core::gain_trace::SOURCES]; 4]);
                    let (food, gold) = (t[0], t[3]);
                    let food_other: f64 = food[6] + food[7] + food[8];
                    let gold_other: f64 = gold.iter().sum::<f64>() - gold[7];
                    eprintln!("GAIN {{\\"ms\\":{ms},\\"p\\":{p},\\"food\\":{{\\"sheep\\":{:.2},\\"boar\\":{:.2},\\"deer\\":{:.2},\\"berries\\":{:.2},\\"farm\\":{:.2},\\"fish\\":{:.2},\\"other\\":{:.2}}},\\"wood\\":{:.2},\\"gold\\":{{\\"mine\\":{:.2},\\"other\\":{:.2}}},\\"stone\\":{:.2}}}",
                        food[0], food[1], food[2], food[3], food[4], food[5], food_other,
                        t[1].iter().sum::<f64>(), gold[7], gold_other, t[2].iter().sum::<f64>());
                }
            }
            gain_prev = ms;
        }
        // DIAGNOSTIC: GENIE_DUMP_MS=15000,30000 prints''')
print('ok')
