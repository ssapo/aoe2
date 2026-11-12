"""Objects that appeared between two recording checkpoints, counted from the checkpoint words.

Every checkpoint holds, per player, the number of objects in the player's list (word 6) and
the sum of their ids (word 10); see README, "체크포인트 단어의 뜻". Ids are handed out in
rising order to everything in the game, so between two checkpoints of one player:

- an object made now (a trained unit, a foundation) has an id just above the highest id seen;
- a herd animal taken over keeps the id it has in the recording's header;
- an object that leaves the list (an eaten herd animal) takes its known id away;
- a hunter's projectile sits in the list for a moment with a small negative id.

`solve` lists every way the two changes can be explained and gives the number of new objects
only when all ways agree. New objects minus the foundations the player ordered in the interval
(BUILD, WALL) are the units that came out of buildings. An interval that cannot be explained,
or only in several ways, is left as None: the caller keeps its own estimate there.

Checked 2026-11-13 against the object lists read from the running game's memory (three
recordings, six players, up to the Feudal click): see README, "봉건 전 인구 막힘".
"""
from bisect import bisect_left, bisect_right
from itertools import combinations

WINDOW = 64        # a new id lies at most this far above the highest id seen
TEMP = 400         # projectiles: ids from -1 down to -TEMP
MAX_NEW = 8
MAX_TAKEN = 6      # herd animals taken over in one interval
MAX_GONE = 3
# Gate foundations. 796 (palisade gate) was seen in a recording: when it is finished, new objects
# take its place. The other ids are the gates' other directions and the stone gates, not checked.
GATES = {64, 78, 81, 88, 91, 95, 487, 490, 659, 663, 667, 671, 792, 796, 800, 804}
START_ONLY = 890   # an object of the starting Town Center that is in the header and may be gone at once


def solve(dn, dids, top, takeable, removable, window=WINDOW):
    """Ways to explain a change of `dn` objects and `dids` in the id sum.

    Returns {new objects: [(taken ids, gone ids, id sum of the new ones), at most two]} of the
    simplest kind that fits: first without projectiles, then with one, then with two coming
    or going."""
    takeable, removable = sorted(takeable), sorted(removable)
    sums = {}

    def taken_sets(size):
        if size not in sums:
            rows = sorted((sum(c), c) for c in combinations(takeable, size))
            sums[size] = ([r[0] for r in rows], rows)
        return sums[size]

    gone_sets = [(size, sum(c), c) for size in range(MAX_GONE + 1) for c in combinations(removable, size)]
    for temps in (0, 1, 2):
        found = {}
        for came in range(temps + 1):
            left = temps - came
            low_t, high_t = -TEMP * came + left, -came + TEMP * left
            for n_gone, sum_gone, gone in gone_sets:
                for n_taken in range(min(MAX_TAKEN, len(takeable)) + 1):
                    new = dn - n_taken + n_gone - came + left
                    if new < 0:
                        break
                    if new > MAX_NEW or len(found.get(new, ())) > 1:
                        continue
                    low = new * top + new * (new + 1) // 2 + low_t          # new ids plus projectiles
                    high = new * (top + window) - new * (new - 1) // 2 + high_t
                    keys, rows = taken_sets(n_taken)
                    first = bisect_left(keys, dids + sum_gone - high)
                    last = bisect_right(keys, dids + sum_gone - low)
                    for sum_taken, taken in rows[first:last]:
                        if set(taken) & set(gone):
                            continue
                        found.setdefault(new, []).append(
                            (taken, gone, dids - sum_taken + sum_gone if temps == 0 else None))
                        if len(found[new]) > 1:
                            break
        if found:
            return found
    return {}


class Counter:
    """Follows both players' lists from the header through the checkpoints."""

    def __init__(self, top, players, herd):
        """`top`: highest id in the header; `players` {number: (object count, id sum, ids of
        its herd animals, ids that may be gone by the first checkpoint)}; `herd`: ids of all
        herd animals."""
        self.top = top
        self.herd = set(herd)
        self.state = {n: {'n': count, 'ids': ids, 'own': set(own), 'extra': set(extra), 'sure': True}
                      for n, (count, ids, own, extra) in players.items()}
        self.stale = 0

    def step(self, words):
        """`words` {number: (object count, id sum)} of the next checkpoint.

        Returns {number: new objects or None}."""
        out, tops = {}, [self.top]
        window = WINDOW + 16 * min(self.stale, 8)
        solved = True
        for number, (count, ids) in words.items():
            s = self.state.get(number)
            if s is None:
                continue
            dn, dids = count - s['n'], ids - s['ids']
            s['n'], s['ids'] = count, ids
            if dn == 0 and dids == 0:
                s['extra'] = set()
                out[number] = 0
                continue
            ways = solve(dn, dids, self.top, self.herd - s['own'] if s['sure'] else self.herd,
                         (s['own'] if s['sure'] else self.herd) | s['extra'], window)
            if len(ways) != 1:
                s['extra'] = set()
                out[number] = None
                s['sure'] = False
                solved = False
                continue
            s['extra'] = set()           # only the start's own objects leave, and only at once
            (new, ways), = ways.items()
            out[number] = new
            if len(ways) == 1:
                s['own'] |= set(ways[0][0])
                s['own'] -= set(ways[0][1])
            else:
                s['sure'] = False        # which animal came or went is open: any may from now on
            if new and all(w[2] is not None for w in ways):
                # the highest of `new` different ids is at least their mean plus (new - 1) / 2
                # (solve keeps two ways at most; others differ by which herd animals they name)
                spread = max(self.herd) - min(self.herd) if len(ways) > 1 and self.herd else 0
                tops.append(min(-(-w[2] // new) + (new - 1) // 2 for w in ways) - spread)
            elif new:
                solved = False
        self.top = max(tops)
        self.stale = 0 if solved else self.stale + 1
        return out


def foundations(kind, payload):
    """(fewest, most) foundations an order lays: BUILD one, WALL one per tile of its line."""
    if kind == 'BUILD':
        return 1, 1
    if kind == 'WALL':
        try:
            tiles = max(abs(payload['x_end'] - payload['x']), abs(payload['y_end'] - payload['y'])) + 1
        except (KeyError, TypeError):
            return 0, MAX_NEW
        return 1, max(1, tiles)
    return 0, 0


def read_words(decoded):
    """[(game_ms, {player: (stockpile sum, object count, id sum)})] in recording order."""
    import io
    import struct
    from mgz import fast
    from mgz.fast.header import parse
    handle = io.BytesIO(decoded)
    parse(handle)
    fast.meta(handle)
    rows = []
    while True:
        start = handle.tell()
        try:
            kind, value = fast.operation(handle)
        except EOFError:
            break
        if kind is not fast.Operation.SYNC or not value[2]:
            continue
        end = handle.tell()
        handle.seek(start + 12)                 # operation type, time increment, zero marker
        words = struct.unpack('<88I', handle.read(352))
        handle.seek(end)
        players = {words[i + 8]: (words[i + 1], words[i + 6], words[i + 10])
                   for i in range(0, 88, 11) if words[i + 1]}
        if players:
            rows.append((value[2].get('current_time', 0), players))
    return rows


def counted(match, words, orders, offset, herd_names, until=None):
    """{player number: [(from_seconds, to_seconds, fewest, most) or (from, to, None, None)]}:
    units that appeared in each checkpoint interval.

    `words` [(game_ms, {player: (object count, id sum)})]; `orders` as housing.read_orders
    gives them (the foundation orders BUILD, WALL and GATE are read from it). Checkpoints after
    `until` seconds are not looked at."""
    everything = list(match.gaia) + [o for p in match.players for o in p.objects]
    if not everything or not words:
        return {}
    herd = {o.instance_id for o in everything if o.name in herd_names}
    players = {}
    for p in match.players:
        listed = [o for o in p.objects if o.class_id in (70, 80)]     # not the flare, not terrain overlays
        players[p.number] = (len(listed), sum(o.instance_id for o in listed),
                             {o.instance_id for o in listed} & herd,
                             {o.instance_id for o in listed if getattr(o, 'object_id', None) == START_ONLY})
    counter = Counter(max(o.instance_id for o in everything), players, herd)
    laid = {n: [] for n in players}
    gate = {}
    for at, number, kind, payload, _ in orders:
        if number not in laid:
            continue
        if kind == 'GATE' or (kind == 'BUILD' and payload.get('building_id') in GATES):
            gate.setdefault(number, at)      # a finished gate is replaced by new objects: not counted after
        elif kind in ('BUILD', 'WALL'):
            laid[number].append((at,) + foundations(kind, payload))
    out = {n: [] for n in players}
    before = offset
    for ms, row in words:
        now = ms / 1000 + offset
        if until is not None and before >= until:
            break
        new = counter.step(row)
        for n in players:
            if n not in new:
                continue
            fewest = sum(a for at, a, _ in laid[n] if before <= at < now)
            most = sum(b for at, _, b in laid[n] if before <= at < now)
            if new[n] is None or new[n] < fewest or (n in gate and gate[n] < now):
                out[n].append((before, now, None, None))
            else:
                out[n].append((before, now, max(0, new[n] - most), new[n] - fewest))
        before = now
    return out
