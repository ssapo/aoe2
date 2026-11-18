"""Which units a recorded command moved, from the re-simulation engine's object lists.

A command in the recording names the selected objects by id only. The engine
(see engine_income.py) gives every object the same id as the real game for as long as its
checkpoints match the recording, so inside that span an id can be looked up in the engine's
object list. With GENIE_DUMP_MS=<ms,ms,...> and GENIE_DUMP_UNITS=1 the engine prints, at the
first update reaching each mark, one line per object of every player:

    UNIT mark_ms=5000 player=1 id=1234 master=83 pos=... action_kind=...

`master` is the object's type (aocref dataset 100 `objects`). A command at time t looks its ids
up in the last list at or before t, else in the first list after t (a unit made a moment
before the command). An id in neither (made and lost between two lists) stays unknown.

Only commands up to the verified time are labelled: the last checkpoint at which, for both
players, the engine's stockpile word and its object count and id sum words all equal the
recording's. Past it the engine's objects are no longer the real game's.

A villager's type changes with its task (Farmer, Builder, ...); all of them count as Villager.
Herd animals (sheep, pigs, turkeys, ...) count as Livestock. A type aocref does not name is
counted as unknown.
"""
import json
import re
from bisect import bisect_right
from pathlib import Path

STEP_MS = 5000
UNTIL_MS = 2_700_000      # marks up to 45 game minutes, past the engine's 44-minute run (engine_income.UPDATES)
WORDS = (1, 6, 10)        # checkpoint words: stockpile sum, object count, object id sum
VILLAGER_TASKS = {'Villager', 'Builder', 'Farmer', 'Fisherman', 'Fisherwoman', 'Forager', 'Hunter',
                  'Lumberjack', 'Stone Miner', 'Gold Miner', 'Repairer', 'Shepherd'}
# Herd animals (engine class 58) all count as Livestock. 2590 is not in aocref's dataset; the
# engine's GAINA lines give it class 58 (100 food, 7 hp: the sheep of newer maps).
LIVESTOCK_NAMES = {'Sheep', 'Goat', 'Goose', 'Pig', 'Turkey', 'Llama', 'Cow A', 'Cow B', 'Cow C', 'Cow D',
                   'Water Buffalo'}
LIVESTOCK_MASTERS = {2590}
_UNIT = re.compile(r'UNIT mark_ms=(\d+) player=(\d+) id=(-?\d+) master=(-?\d+)')
_CP = re.compile(r'CPWORDS syncs=\d+ world_ms=(\d+) player=(\d+) rec=\[(.*?)\] eng=\[(.*?)\]')


def dump_env():
    """The environment that makes the engine print its object lists."""
    return {'GENIE_DUMP_MS': ','.join(str(ms) for ms in range(STEP_MS, UNTIL_MS + 1, STEP_MS)),
            'GENIE_DUMP_UNITS': '1'}


_NAMES = None


def object_names():
    global _NAMES
    if _NAMES is None:
        import aocref
        data = json.loads((Path(aocref.__file__).parent / 'data/datasets/100.json').read_text(encoding='utf-8'))
        _NAMES = {int(k): v for k, v in data['objects'].items()}
    return _NAMES


def kind_name(master, names):
    if master in LIVESTOCK_MASTERS:
        return 'Livestock'
    name = names.get(master)
    if not name:
        return None
    return 'Villager' if name in VILLAGER_TASKS else 'Livestock' if name in LIVESTOCK_NAMES else name


def parse_lists(lines):
    """([mark_ms, ...], [{id: master}, ...]) in mark order, players 1 and up."""
    lists = {}
    for line in lines:
        if line.startswith('UNIT '):
            m = _UNIT.match(line)
            if m and int(m.group(2)) > 0:
                lists.setdefault(int(m.group(1)), {})[int(m.group(3))] = int(m.group(4))
    marks = sorted(lists)
    return marks, [lists[mark] for mark in marks]


def verified_ms(lines, players):
    """Last checkpoint ms at which every word in WORDS matches for all `players`; 0 if none."""
    first_bad, last_ok = {}, {}
    for line in lines:
        if not line.startswith('CPWORDS'):
            continue
        m = _CP.match(line)
        if not m:
            continue
        ms, player = int(m.group(1)), int(m.group(2))
        if player not in players or player in first_bad:
            continue
        rec, eng = [w.strip() for w in m.group(3).split(',')], [w.strip() for w in m.group(4).split(',')]
        if len(rec) <= max(WORDS) or len(eng) <= max(WORDS) or any(rec[w] != eng[w] for w in WORDS):
            first_bad[player] = ms
        else:
            last_ok[player] = ms
    if any(p not in last_ok for p in players):
        return 0
    return min(last_ok[p] for p in players)


def label(events, lines, own_number, opponent_number, offset=0.0, names=None):
    """Adds `units` ({kind: count}) and `units_unknown` to each command in `events` that is
    inside the verified span; returns the verified seconds, or None when nothing was labelled.

    `events` are command_activity rows that carry `ids` (removed here once used)."""
    names = object_names() if names is None else names
    until = verified_ms(lines, (own_number, opponent_number))
    marks, lists = parse_lists(lines)
    if not until or not marks:
        for e in events:
            e.pop('ids', None)
        return None
    done = False
    for e in events:
        ids = e.pop('ids', None)
        t = (e['seconds'] - offset) * 1000
        if not ids or t > until:
            continue
        at = bisect_right(marks, t)
        before, after = lists[at - 1] if at else {}, lists[at] if at < len(lists) else {}
        counts, unknown = {}, 0
        for i in ids:
            master = before.get(i, after.get(i))
            kind = kind_name(master, names) if master is not None else None
            if kind:
                counts[kind] = counts.get(kind, 0) + 1
            else:
                unknown += 1
        if counts:
            e['units'] = dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
        if unknown:
            e['units_unknown'] = unknown
        done = True
    return round(until / 1000 + offset, 1) if done else None
