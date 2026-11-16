"""Recorded command destinations, not reconstructed unit positions."""
import io
from types import SimpleNamespace

from mapview import point


def command_activity(raw, match, own, keep_ids=False):
    """Command destinations; with keep_ids each row with a selection also gets `ids` (the
    selected object ids) for unit_kinds.label, which removes them before storing."""
    from mgz import fast
    from mgz.fast.header import parse

    # Read raw actions: mgz.model.Inputs can reuse another player's selection.
    sides = {p.number: 'mine' if p.number == own.number else 'theirs'
             for p in match.players if p.number == own.number or p not in (own.team or [])}
    kinds = {'MOVE', 'ORDER', 'PATROL', 'DE_ATTACK_MOVE', 'ATTACK_GROUND', 'AI_ORDER'}
    # The game's "last commanded units" (count 0xffff): set by these orders only (engine
    # genie-core commands/order.rs, World::last_commanded).
    sets_last = {'ORDER', 'WORK', 'MOVE', 'DE_RETREAT'}
    groups, events, last = {}, [], {}
    handle = io.BytesIO(raw)
    parse(handle)
    fast.meta(handle)
    clock = 0
    offset = match.restored_at.total_seconds()
    while True:
        try:
            operation, value = fast.operation(handle)
        except EOFError:
            break
        if operation is fast.Operation.SYNC:
            clock += value[0]
        elif operation is fast.Operation.ACTION:
            action, payload = value
            pid = payload.get('player_id')
            if pid not in sides:
                continue
            ids = tuple(sorted({i for i in (payload.get('object_ids') or [])
                                if isinstance(i, int) and not isinstance(i, bool) and i > 0}))
            repeated = None
            if action.name in sets_last:
                repeated = last.get(pid) if not ids else None
                if ids:
                    last[pid] = ids
                elif 'object_ids' not in payload:
                    last.pop(pid, None)     # a list mgz does not read (WORK, RETREAT): not known
            if action.name not in kinds:
                continue
            pos = point(SimpleNamespace(x=payload.get('x'), y=payload.get('y')), match.map.dimension)
            if not pos:
                continue
            row = dict(pos, seconds=round(clock / 1000 + offset, 2),
                       side=sides[pid], kind=action.name, selected_count=len(ids) if ids else None)
            if ids:
                key = (pid, ids)
                row['group'] = groups.setdefault(key, len(groups) + 1)
            if keep_ids and (ids or repeated):
                row['ids'] = ids or repeated
            events.append(row)
    return events
