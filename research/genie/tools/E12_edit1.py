# ENG-12 case 1: player attribute 204 (188329 0x15fec80) - the flare a player makes at the other players'
# objects of the kind its attribute names. usage: python3 runs/E12_edit1.py   (from genie-replays)
import io
B='genie/crates/engine/genie-core/src/'
def edit(path, pairs):
    b=open(B+path,'rb').read(); crlf=b'\r\n' in b
    t=b.decode('utf-8').replace('\r\n','\n')
    for old,new in pairs:
        assert t.count(old)==1, (path, old[:60], t.count(old))
        t=t.replace(old,new)
    if crlf: t=t.replace('\n','\r\n')
    open(B+path,'wb').write(t.encode('utf-8'))
edit('world/mod.rs', [("""    pub instant_work: i32,
}
""","""    pub instant_work: i32,
    /// 188329: each object's marks of the players that made their flare at it (`+0x2d8`, a bit
    /// per player, `0x15fec80`; [`World::reveal_units`]). An object without marks has no entry.
    pub reveal_marks: std::collections::BTreeMap<ObjectId, u32>,
}
""")])
edit('world/setup.rs', [("""            instant_work: 0,
""","""            instant_work: 0,
            reveal_marks: std::collections::BTreeMap::new(),
""")])
edit('construction/build/completion.rs', [("""        if self.attribute_204() {
            return Err(REVEAL_UNITS);
        }
        let (p, u) = self.object(id).ok_or(NOT_HELD)?;""","""        let (p, u) = self.object(id).ok_or(NOT_HELD)?;"""),
("""use crate::players::diplomacy::REVEAL_UNITS;
""","")])
edit('construction/build/world_side.rs', [("""        self.set_state(q, at, ObjectState::Alive)?;
        Ok(BuildProgress::Ended)""","""        self.set_state(q, at, ObjectState::Alive)?;
        // 188329 0x1284670's end: after the set_state(2) the world's pass over the kinds the
        // players' attribute 204 names (0x15fec80)
        self.reveal_units()?;
        Ok(BuildProgress::Ended)""")])
edit('construction/building_update.rs', [("""        c.lend((&mut *self, &mut *actions), |w| {
            w.set_state(p, id, ObjectState::Alive)
        })""","""        c.lend((&mut *self, &mut *actions), |w| {
            // 188329: this completion's pass over the revealed kinds (0x15fec80) was not read
            if w.attribute_204() {
                return Err(crate::players::diplomacy::REVEAL_UNITS);
            }
            w.set_state(p, id, ObjectState::Alive)
        })""")])
edit('players/diplomacy.rs', [("""    pub(crate) fn reveal_units(&self) -> Result<(), GenieError> {
        let reveals = self.players.iter().any(|q| {
            q.attributes
                .get(REVEAL_UNIT)
                .is_some_and(|&v| cvttss2si(v.get()) != 0)
        });
        if reveals {
            return Err(REVEAL_UNITS);
        }
        Ok(())
    }""","""    ///
    /// 188329 (`0x15fec80`, read in ENG-12; the world's load, a diplomacy change and a builder's
    /// completed building `0x1284670` call it): for each player `a` (Gaia too) whose attribute
    /// 204 truncates to a kind `k` not 0, with `n = |k|` (`0xa82800`) and its sort
    /// (`0x10baf30`: below 900 a master's id, 900 to 999 the class `n − 900`, 1000 and up a
    /// master's id again), each other player `b` in the players' order: when both relation
    /// bytes (`+0x180`) are 0 the marks of `b`'s objects for `a` go (`0x1247170`, `0x1247190`);
    /// else each object of `b`'s list (`+0x30`) of that master id (`+0x18`) or class (`+0x38`)
    /// which is no building or a building in state 2 with build points (`+0x900`) not 0, and
    /// without `a`'s mark (`+0x2d8`, `0x12473d0`): with `k` above 0 player `a` makes an object
    /// of master 697 at its place (slot 0x1c8 `0x16fd190`, as a hit's flare:
    /// [`World::remains`], [`World::made_new_object`]); then the mark is set (`0x12476b0`).
    /// Not modelled: `k` below 0 (the object's `+0x2dc` mark and its slot 0x1e8, and
    /// `0x12420b0`), and a kind that names objects that are no buildings (the pass an object's
    /// creation runs, `0x1247920`, which for a building starts as a foundation and so does
    /// nothing).
    pub(crate) fn reveal_units(&mut self) -> Result<(), GenieError> {
        for a in 0..self.players.len() {
            let k = self.players[a]
                .attributes
                .get(REVEAL_UNIT)
                .map_or(0, |&v| cvttss2si(v.get()));
            if k == 0 {
                continue;
            }
            if k < 0 {
                return Err(REVEAL_UNITS);
            }
            let n = k;
            let (by_class, wanted) = if (900..1000).contains(&n) {
                (true, n - 900)
            } else {
                (false, n)
            };
            let Ok(a_id) = u8::try_from(a) else {
                return Err(REVEAL_UNITS);
            };
            let a_id = PlayerId::new(a_id);
            let bit = 1u32 << (a & 31);
            for b in 0..self.players.len() {
                if a == b {
                    continue;
                }
                let Ok(b_id) = u8::try_from(b) else {
                    return Err(REVEAL_UNITS);
                };
                let b_id = PlayerId::new(b_id);
                let ab = self.players[a].relations.get(b_id).map_or(0, |r| r.get());
                let ba = self.players[b].relations.get(a_id).map_or(0, |r| r.get());
                if ab == 0 && ba == 0 {
                    let ids: Vec<ObjectId> = self.players[b].objects.iter().map(|u| u.id).collect();
                    for id in ids {
                        if let Some(m) = self.reveal_marks.get_mut(&id) {
                            *m &= !bit;
                            if *m == 0 {
                                let _ = self.reveal_marks.remove(&id);
                            }
                        }
                    }
                    continue;
                }
                let mut found = Vec::new();
                for u in self.players[b].objects.iter() {
                    let m = u.master(self.master_tables(), b_id)?;
                    let named = if by_class {
                        i32::from(m.class.get()) == wanted
                    } else {
                        m.id.index() == usize::try_from(wanted).unwrap_or(usize::MAX)
                    };
                    if !named {
                        continue;
                    }
                    if m.kind != MasterKind::BUILDING {
                        return Err(GenieError::unsupported(
                            "a player's attribute 204 naming objects that are no buildings (0x1247920)",
                        ));
                    }
                    let built = self
                        .parts
                        .building_of(u.id)
                        .construction
                        .as_ref()
                        .is_none_or(|c| c.progress.get() != 0.0);
                    if !built || u.life.state != ObjectState::Alive {
                        continue;
                    }
                    if self.reveal_marks.get(&u.id).is_some_and(|m| m & bit != 0) {
                        continue;
                    }
                    found.push(u.id);
                }
                for id in found {
                    let at = self
                        .spatial
                        .get(id)
                        .map(|p| p.position)
                        .ok_or(GenieError::unsupported(
                            "a revealed object without a place (attribute 204)",
                        ))?;
                    self.remains(a_id, REVEAL_FLARE, at, None)?;
                    self.made_new_object(a_id)?;
                    *self.reveal_marks.entry(id).or_insert(0) |= bit;
                }
            }
        }
        Ok(())
    }"""),
("""use crate::objects::masters::MasterKind;
""","""use crate::objects::ObjectState;
use crate::objects::masters::MasterKind;
"""),
("""const REVEAL_UNIT: usize = 204;
""","""const REVEAL_UNIT: usize = 204;

/// 188329: the master of the flare a player makes at a revealed object (697, `0x15fec80`).
const REVEAL_FLARE: crate::objects::masters::MasterId =
    crate::objects::masters::MasterId::named(697);
""")])
print('ok')
