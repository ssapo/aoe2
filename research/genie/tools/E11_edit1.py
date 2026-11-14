# ENG-11 case 1: REPAIR (0x6e) command. Run from genie-replays: python3 runs/E11_edit1.py
import io,os
E='genie/crates/engine/'
def rd(p): return open(E+p,'rb').read().decode('utf-8')
def wr(p,s):
    s=s.replace('\r\n','\n').replace('\n','\r\n')
    open(E+p,'wb').write(s.encode('utf-8'))
def sub(p,old,new,count=1):
    s=rd(p).replace('\r\n','\n')
    assert s.count(old)>=1,(p,old)
    s=s.replace(old,new,count); wr(p,s)

wr('genie-core/src/commands/repair.rs','''//! REPAIR (0x6e): a player's units told to repair an object.

use crate::GenieError;
use crate::commands::UnitList;
use crate::objects::ObjectId;
use crate::players::PlayerId;
use crate::world::World;

/// REPAIR (0x6e; build 188329: `do_command`'s case `0xf60e04`, handler `0xf653d0`): the units
/// of the packet repair the object `target` ([`World::repair_units`]).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RepairCommand {
    /// The player.
    pub player: PlayerId,
    /// The object to repair (`+0x8`), none for the packet's -1.
    pub target: Option<ObjectId>,
    /// The units told to repair it (the count at `+0x4`, the ids from `+0x10`).
    pub units: UnitList,
    /// `+0xe`: queued (a unit with a unit AI takes it as an order at the end of its queue).
    pub queued: bool,
    /// `+0xf`: direct (a unit takes it at once even while its unit AI holds an order not ready;
    /// an order it queues is ready).
    pub direct: bool,
    /// The packet's bytes `+0x6..+0x8` and `+0xc..+0xe`, which nothing reads; kept so that the
    /// command writes back as it was recorded.
    pub gaps: [[u8; 2]; 2],
}

impl RepairCommand {
    /// `do_command`'s case (`0xf60e04`) checks the units as BUILD's does (a count past the
    /// packet's ids refuses it, [`World::read_units`]; another player's become -1 and a human's
    /// command left without one is refused, [`World::command_check`]); then the handler
    /// ([`World::repair_units`]).
    pub(crate) fn run(&self, w: &mut World) -> Result<(), GenieError> {
        let Some(listed) = w.read_units(self.player, &self.units) else {
            return Ok(());
        };
        let Some(units) = w.command_check(self.player, listed)? else {
            return Ok(());
        };
        let Some(target) = self.target else {
            return Ok(());
        };
        w.repair_units(&units, target, (self.queued, self.direct))
    }
}
''')

wr('genie-core/src/orders/repair_command.rs','''//! REPAIR's units (build 188329's handler `0xf653d0`): the queue path and the direct repair
//! (`0x12c66c0`).

use crate::GenieError;
use crate::construction::repair::REPAIR;
use crate::map::Distance;
use crate::map::Position;
use crate::math::fmath::below_or_unordered;
use crate::math::rng::Stream;
use crate::movement::Speed;
use crate::objects::ListIndex;
use crate::objects::ObjectId;
use crate::objects::masters::ClassId;
use crate::objects::masters::MasterKind;
use crate::objects::masters::TaskGroup;
use crate::orders::Dispatch;
use crate::orders::{ReadyOrders, readiness};
use crate::players::PlayerId;
use crate::unit_ai::Notifies;
use crate::unit_ai::OrderKind;
use crate::unit_ai::QueueEnd;
use crate::unit_ai::{Issuer, OrderPriority, OrderTargetKind, QueuedOrder};
use crate::world::World;
use crate::world::index::Place;
use crate::world::slots::PlayerSlots;

/// The class whose units keep their master for the direct repair (`0x12c66c0`: the master's
/// class field reads `0x1782`, the class `0x42` under the field's key `0x17c0`).
const KEEPS_MASTER: ClassId = ClassId::named(0x42);

impl World {
    /// REPAIR's handler (build 188329, `0xf653d0`) on `target` with the packet's units after the
    /// check. Nothing for a target the world does not hold, or when it holds none of the units.
    /// The order splitter (`0x10b6e50`) takes the units; a group it forms (which the handler
    /// commands with the group command `0x10d8230`, order `0x6a`) is not modelled. The command
    /// is counted (`0x14435f084`). Then each loose unit, in the splitter's order: it leaves its
    /// group (`0x10f64b0` with no target); one of a master of type 30 and up that moves (its
    /// slot 0xe8), or any of a queued command, takes the order: without a unit AI, or of a
    /// command not queued that is direct or whose unit AI holds no order not ready
    /// (`0xd27720`), the direct repair ([`World::repair_directly`]); any other unit AI queues
    /// the repair order `0x2ce` on the target at the target's place (slot 0x30: issued by the
    /// unit's own player, priority 100, ready when direct), and after a command neither queued
    /// nor direct the readiness pass with 1 (`0xd1d140`) and the unit's stop.
    pub(crate) fn repair_units(
        &mut self,
        units: &[Option<ObjectId>],
        target: ObjectId,
        (queued, direct): (bool, bool),
    ) -> Result<(), GenieError> {
        let Some((tp, t)) = self.object(target) else {
            return Ok(());
        };
        let (at, target_master) = (t.position(), t.life.master_id);
        if !units.iter().flatten().any(|&id| self.place(id).is_some()) {
            return Ok(());
        }
        let loose = self.loose_units(units);
        self.groups.count_command();
        for id in loose? {
            self.leave_group_of(id, None)?;
            let Some((q, unit)) = self.object(id) else {
                continue;
            };
            let m = unit.master(self.master_tables(), q)?;
            let speed = m.move_stats.map_or(Speed::ZERO, |s| s.speed);
            let moves = MasterKind::MOVING <= m.kind && below_or_unordered(0.0, speed.get());
            if !moves && !queued {
                continue;
            }
            let Some(Place::Live(q, idx)) = self.place(id) else {
                continue;
            };
            let takes_it = self
                .parts
                .unit_ai
                .get(id)
                .is_none_or(|ai| !queued && (direct || !ai.has_unready_order()));
            if takes_it {
                self.repair_directly(q, idx, target)?;
                continue;
            }
            let state = self.players.live(q, idx)?.life.state;
            let order = QueuedOrder {
                issuer: Some(Issuer::Player(q)),
                order: OrderKind::Repair,
                priority: OrderPriority::COMMAND,
                target: Some(target),
                target_owner: Some(tp),
                point: Position::new(at.x(), at.y(), 0.0),
                range: Distance::ZERO,
                shown: at.ground(),
                ready: direct,
                target_kind: Some(OrderTargetKind::of_master(target_master)),
            };
            let ai = self
                .parts
                .unit_ai
                .get_mut(id)
                .ok_or(GenieError::unreachable("unreachable: no unit AI"))?;
            let _ = ai.queue_order(state, order, Dispatch::Queued, QueueEnd::Back)?;
            if !queued && !direct {
                readiness(&mut ai.orders, ReadyOrders::Drop);
                // the pass's tail: the unit's stop
                self.object_stop(q, idx)?;
            }
        }
        Ok(())
    }

    /// The direct repair of the unit at `idx` of player `q` on `target` (build 188329,
    /// `0x12c66c0`). Nothing for the unit itself or a target the world does not hold. A unit
    /// that is neither of class `0x42` nor a repairer (masters 156 and 222) becomes its
    /// player's repairer (slot 0x98 with 0): 156 when its master's byte reads 1 (taken here as
    /// the task swap group, the male villagers'), else 222; nothing when the player lacks that
    /// master. Of its master's tasks of action type `0x6a`, in list order, the first for the
    /// target's master or class, else the last one for any target seen. When the top action
    /// runs that task it takes the target (its slot 0x48); else the task's new Repair replaces
    /// the unit's actions (the factory, slot 0x8c8). The unit AI is told the repair order
    /// `0x2ce` and action `0x26a` (none of both without a task), the target with its class and
    /// place, and its notifies are cleared (`0xd40dc0`: always below type 70, else by the
    /// unit's `+0x69c`, which stands at 1 outside the work command).
    pub(crate) fn repair_directly(
        &mut self,
        q: PlayerId,
        idx: ListIndex,
        target: ObjectId,
    ) -> Result<(), GenieError> {
        let unit = self.players.live(q, idx)?;
        let id = unit.id;
        if id == target {
            return Ok(());
        }
        let Some((tp, t)) = self.object(target) else {
            return Ok(());
        };
        let tm = t.master(self.master_tables(), tp)?;
        let (t_class, t_master, at) = (tm.class, tm.id, t.position());
        let own = unit.master(self.master_tables(), q)?;
        let repairers = self.model.slots.master;
        let (male, female) = (
            repairers.villager_repairer_male,
            repairers.villager_repairer_female,
        );
        if own.class != KEEPS_MASTER && own.id != male && own.id != female {
            let with = if own.action_part().task_by_group == TaskGroup::MALE_VILLAGERS {
                male
            } else {
                female
            };
            if self.model.masters.of(q).and_then(|m| m.get(with)).is_none() {
                return Ok(());
            }
            self.change_master(q, idx, with)?;
        }
        let master = self
            .players
            .live(q, idx)?
            .master(self.master_tables(), q)?;
        let mut any = None;
        let mut found = None;
        for task in &master.action_part().tasks {
            if task.action_kind != REPAIR {
                continue;
            }
            if task.object_group.is_none() && task.object_id.is_none() {
                any = Some(task);
            }
            if task.object_id == Some(t_master) || task.object_group == t_class.or_none() {
                found = Some(task);
                break;
            }
        }
        let task = found.or(any).cloned();
        let notifies = Notifies::Cleared;
        let actions = self.parts.actions_of(id);
        let running = (actions.top_action_kind() == Some(REPAIR))
            .then(|| actions.list.repair().map(|r| r.task.id))
            .flatten();
        match task {
            Some(task) if running == Some(task.id) => {
                self.retake_repair(q, idx, target, at, notifies)
            }
            Some(task) => self.start_repair(q, idx, target, &task, at, notifies),
            None => {
                if let Some(ai) = self.parts.unit_ai.get_mut(id) {
                    ai.notify_work(
                        None,
                        None,
                        Some((target, t_class)),
                        at,
                        notifies,
                        self.streams.get(Stream::Ai),
                    )?;
                }
                Ok(())
            }
        }
    }
}
''')

sub('genie-core/src/orders/mod.rs','mod points;\n','mod points;\nmod repair_command;\n')
p='genie-core/src/commands/mod.rs'
sub(p,'pub mod queue;\n','pub mod queue;\npub mod repair;\n')
sub(p,'pub use self::queue::QueueCommand;\n','pub use self::queue::QueueCommand;\npub use self::repair::RepairCommand;\n')
sub(p,'    /// GATE (0x72).\n    Gate(GateCommand),\n','    /// GATE (0x72).\n    Gate(GateCommand),\n    /// REPAIR (0x6e).\n    Repair(RepairCommand),\n')
sub(p,'            Command::Gate($c) => $any,\n','            Command::Gate($c) => $any,\n            Command::Repair($c) => $any,\n')
p='genie-command-codec/src/decode.rs'
sub(p,'    OrderCommand, PatrolCommand, QueueCommand,','    OrderCommand, PatrolCommand, QueueCommand, RepairCommand,')
sub(p,'''        Packet::Stop(c) => Command::Stop(StopCommand {''','''        Packet::Repair(c) => Command::Repair(RepairCommand {
            player: PlayerId::from(c.commp_id),
            target: ObjectId::of_field(c.tid),
            units: listed(c.num, &c.ids),
            queued: c.field_0x0e != 0,
            direct: c.field_0x0f != 0,
            gaps: [c.gap_0x06, c.gap_0x0c],
        }),
        Packet::Stop(c) => Command::Stop(StopCommand {''')
p='genie-command-codec/src/encode.rs'
sub(p,'        | Command::Unload(_)\n','        | Command::Unload(_)\n        | Command::Repair(_)\n')
sub(p,'''        Command::Stop(c) => Packet::Stop(packets::Stop {''','''        Command::Repair(c) => Packet::Repair(packets::Repair {
            commp_id: c.player.get(),
            num: c.units.count,
            gap_0x06: c.gaps[0],
            tid: ObjectId::field(c.target),
            gap_0x0c: c.gaps[1],
            field_0x0e: u8::from(c.queued),
            field_0x0f: u8::from(c.direct),
            ids: ids(&c.units.ids, packets::Repair::FIXED)?,
        }),
        Command::Stop(c) => Packet::Stop(packets::Stop {''')
print('ok')
