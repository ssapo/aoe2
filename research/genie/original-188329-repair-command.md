# REPAIR command (0x6e) and a saved task's class below -1 (session E11, 2026-11-14)

Build 188329, RVAs (image base 0x140000000). Decompiles were made in the cloud container
(`re/out_E11/a.c` handler, `b.c` direct repair) and are not kept; what was read is below.

## 1. Addresses

| what | address | engine |
|---|---|---|
| High-id command dispatch, case 0x6e (byte table 0xf63090 index 10 -> jump table 0xf62ff0) | 0xf60e04 | `commands/repair.rs` `RepairCommand::run` |
| REPAIR handler | 0xf653d0 | `orders/repair_command.rs` `World::repair_units` |
| Direct repair of one unit | 0x12c66c0 | same file, `World::repair_directly` |
| Order splitter | 0x10b6e50 | `orders/split.rs` `World::loose_units` |
| Group command (order 0x6a) | 0x10d8230 | not modelled here (stop "a unit group the order splitter forms") |
| Unit leaves its group | 0x10f64b0 | `World::leave_group_of` |
| Unit AI: "holds an order not ready" | 0xd27720 | `UnitAi::has_unready_order` |
| Unit AI: readiness pass (argument 1) | 0xd1d140 | `orders::readiness(.., ReadyOrders::Drop)` + `object_stop` |
| Unit AI: set order (keeps the last) / set action / set target / clear notifies | 0xd40990 / 0xd40980 / 0xd40a10 / 0xd40dc0 | `UnitAi::notify_work` |
| Unit's "direct order" byte (`+0x69c`) read | 0x12b3df0 | `Notifies::Cleared` |

## 2. The dispatch case (0xf60e04..0xf60f27)

Packet: `+1` player, `+4` count (u16), `+8` target id, `+0xe` queued, `+0xf` direct, ids from
`+0x10`. A packet shorter than 0x10 or than `0x10 + 4 * count` is refused. Each id whose object the
world does not hold, or that belongs to another player while players may not order each other's
units (0x13d1690), becomes -1. If every id went and the player is not a computer (0x1728be0) the
command does nothing. Else the handler runs. Same shape as BUILD's builders' check.

## 3. The handler (0xf653d0)

1. Target = world object of `+8`; none -> return. Count 0 -> return. No unit of the list in the
   world -> return (0x1251e40 is a stub that returns 0).
2. The splitter 0x10b6e50 takes (ids, count, target, target x, y, 1, -1, 0). For each group it
   made: find or create the unit group, add the members, command it with order 0x6a on the target
   (0x10d8230, with the two packet flags). Then the command counter 0x14435f084 goes up by one.
3. For each loose unit (the splitter's order): if it is in a group (`+0x210`), it leaves it
   (0x10f64b0 with target -1). If (its master's type is 30 or more and its speed, slot 0xe8, is
   above 0) or the command is queued:
   - no unit AI, or (not queued and (direct or the unit AI holds no order that is not ready)):
     the direct repair 0x12c66c0(unit, target);
   - else the unit AI's slot 0x30 queues: issuer = the unit's own player, order 0x2ce, target id,
     target master id, target owner, target x, y, 0, range 0, priority 100, ready = direct. If the
     command is neither queued nor direct: 0xd1d140(ai, 1).

The two flags are INTERACT's QUEUED and DIRECT (`orders/interact.rs` `interact_unit` has the same
three-way choice).

## 4. The direct repair (0x12c66c0)

1. Target is the unit itself or null -> return.
2. If the unit's master class is not 0x42 (field value 0x1782 under the class key 0x17c0) and its
   master id is neither 156 nor 222: take the player's master 156 when the master's byte
   (`-0x4ef290fb1bb319fe` from the encoded master pointer) is 1, else master 222; none -> return;
   change master (unit slot 0x98, argument 0). If the id is then still neither 156 nor 222 -> return.
3. Walk the master's task list: of the tasks with action type 0x6a, remember the last one with
   class -1 and unit -1; stop at the first whose unit id (`+0x12`) equals the target's master id or
   whose class (`+0x10`) equals the target's class. The pick is that task, else the remembered one.
4. If the top action runs the picked task: the action takes the target (its slot 0x48). If that
   answers 0, or the task differs: the action list's factory (slot 0x10) makes the task's action on
   the target at the target's place and the unit installs it (slot 0x8c8).
5. With a unit AI: order 0x2ce and action 0x26a when the action's type is 0x6a (else -1 both), the
   target with its class and place (x, y, z), then the notifies are cleared when the unit's type is
   below 70 or its `+0x69c` byte is set.

Not in this path (unlike the work command, slot 0x138): no carried-resource test, no town-bell
record, the unit AI's order queue is not emptied, the ignore list is not emptied, the task's
enablement is not tested.

## 5. Engine

`commands/repair.rs` (new), `orders/repair_command.rs` (new), `commands/mod.rs` (`Command::Repair`),
`genie-command-codec` `decode.rs` / `encode.rs`. The Repair action itself, its start and its retake
were already there (`orders/tasks.rs` `start_repair`, `retake_repair`: the unit AI's own repair
command, slot 0x378, uses them).

## 6. Suspected / not read

- The master byte of step 2 is taken as the task swap group (1 = male villagers). Old build's
  doc: "a unit of task swap group 1 or 2 becomes its player's repairer". In 188329 every other
  value gives 222. Not checked against the `.dat` field offset.
- Class 0x42: which units have it was not looked up.
- `+0x69c` is not held by the engine; it is taken as 1 (the engine's existing note: it stands at 1
  outside the work command). So the notifies are always cleared here.
- Groups (step 2) are not modelled: the engine stops with "a unit group the order splitter forms".
  The splitter's arguments (1, -1, 0) were not compared with INTERACT's call.
- The action's slot 0x48 answering 0 (then a new action is made) is not modelled: the engine's
  retake always keeps the action.
- No value check: none of the four games has memory truth, and all four are past their first
  mismatch at the first REPAIR.

## 7. A saved task's class below -1 (replay 520219269)

Stop at update 0, all players: "a negative class, which no master has". Site:
`genie-import/src/save.rs` `core_task` read a saved master's task class with `ClassId::of_field`,
which refuses a value below -1. The recording's saved masters hold 251 tasks of action type 154
with class -1288 (250 with task id 2 and unit 0, one with task id 8 and unit -1;
`GENIE_TRACE_NEGCLASS=1`). The `.dat` reader already keeps such values for types 154, 155 and 157
(`dat_work.rs` `special_group`); the saved reader now keeps any class below -1 the same way
(`save.rs` `saved_group`). No object's class is negative, so such a task matches no class and is
not an any-class task. Build 188329's own reading of a type-154 task's class was NOT read.
