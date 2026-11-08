"""Population blocks ("housed") before the Feudal Age, rebuilt from the recorded orders.

The recording has no population value, so this replays each player's dark-age production:

- a building trains its queue in order; DE_QUEUE adds units, RESEARCH adds Loom or the
  Feudal Age (each once per player);
- a unit starts only while population + units in training + 1 stays within the cap (the game
  makes the unit's make action only then, otherwise the building waits: housed), and appears
  after its training time;
- the cap is 5 per Town Center plus 5 per finished house; a house finishes once its builders
  have walked to it and built for 3 x 25 / (builders + 2) seconds. Builders follow the orders'
  queued and direct flags: a plain order waits behind a queued one, a right click on a
  foundation (an ORDER whose point is the foundation's) puts a villager on it.

Values come from the DE data file (train and research times, civilization bonuses that touch
them). Not known from the recording: where a builder stands (estimated from its last ordered
point at 0.8 tiles/s), villagers dying, the food at a queue order (estimated from the
checkpoints' stockpile sums, split by what the villagers were sent to gather). Each block is
therefore an estimate, and short ones are not reported.
"""
import io
import math
import struct

VILLAGER_SPEED = 0.8       # tiles per second
REACH = 1.5                # a builder stops this far from the foundation's centre
MIN_BLOCK = 10.0           # seconds; shorter blocks are within the estimate's error
HOUSE_BUILD = 25.0
HOUSE_POP = 5
TC_POP = 5
TC_BUILD = 150.0
TC_IDS = {109, 71, 141, 142}
TC_FOUNDATIONS = {109, 621}
HOUSE_IDS = {70}
LOOM, FEUDAL = 22, 101
TRAIN = {83: 25.0, 293: 25.0, 74: 21.0, 13: 40.0, 545: 45.0}  # dark-age units
RESEARCH = {LOOM: 25.0, FEUDAL: 130.0}
LIVESTOCK = {'Sheep', 'Pig', 'Goose', 'Turkey', 'Goat', 'Llama', 'Cow A', 'Cow B', 'Cow C', 'Cow D',
             'Water Buffalo', 'Ostrich', 'Yak', 'Dromedary'}
# Civilization bonuses from the data file (techs whose civ is the civilization).
NO_HOUSES = {'Huns'}                                  # tech 289 removes houses
TC_POP_BONUS = {'Chinese': 15}                        # tech 425
HOUSE_POP_BONUS = {'Incas': 10}                       # tech 495
TC_WORK = {'Persians': 1.05}                          # tech 409, dark age
RESEARCH_SCALE = {'Malay': {FEUDAL: 0.60241}}         # tech 634
INSTANT = {'Goths': {LOOM}}                           # tech 343
COMMANDS = ('MOVE', 'ORDER', 'BUILD', 'STOP', 'PATROL')


def _flag_offsets():
    """Body offsets of (queued, direct): BUILD +0x1e/-, ORDER and MOVE +0x13/+0x14.

    The body mgz reads starts one byte into the command (after its type), the parsed data three
    bytes later (player, length)."""
    from mgz import fast
    return {fast.Action.BUILD.value: (0x1e - 1, None),
            fast.Action.ORDER.value: (0x13 - 1, 0x14 - 1),
            fast.Action.MOVE.value: (0x13 - 1, 0x14 - 1)}


def read_orders(decoded, restored):
    """[(seconds, player, action_name, payload, flags)]; flags holds 'q' (queued), 'd' (direct)."""
    from mgz import fast
    from mgz.fast.header import parse
    handle = io.BytesIO(decoded)
    parse(handle)
    fast.meta(handle)
    offsets = _flag_offsets()
    wanted = {fast.Action.DE_QUEUE, fast.Action.RESEARCH, fast.Action.BUILD, fast.Action.MOVE,
              fast.Action.ORDER, fast.Action.STOP, fast.Action.PATROL, fast.Action.GATHER_POINT}
    clock, rows = 0, []
    while True:
        start = handle.tell()
        head = handle.read(9)
        flags = ''
        if len(head) == 9 and struct.unpack_from('<I', head)[0] == fast.Operation.ACTION.value \
                and head[8] in offsets:
            body = handle.read(struct.unpack_from('<I', head, 4)[0] - 1)
            q, d = offsets[head[8]]
            if len(body) > q and body[q]:
                flags += 'q'
            if d is not None and len(body) > d and body[d]:
                flags += 'd'
        handle.seek(start)
        try:
            kind, value = fast.operation(handle)
        except EOFError:
            break
        if kind is fast.Operation.SYNC:
            clock += value[0]
        elif kind is fast.Operation.ACTION:
            action, payload = value
            if action in wanted:
                rows.append((clock / 1000 + restored, payload.get('player_id'), action.name, payload, flags))
    return rows


def _point(payload):
    x, y = payload.get('x'), payload.get('y')
    if isinstance(x, (int, float)) and isinstance(y, (int, float)) and 0 <= x < 1e4 and 0 <= y < 1e4:
        return (float(x), float(y))
    return None


class Builders:
    """Houses (and Town Centers) under construction, advanced in time with the orders."""

    def __init__(self, where, home):
        self.where, self.home, self.rally = where, home, None
        self.sites = []                       # {point, build, pop, progress, done, crew{b: arrive}}
        self.on, self.queue, self.pending = {}, {}, set()
        self.now = 0.0

    def _walk(self, b, point):
        # a villager not seen before was born since and went to the Town Center's gather point
        start = self.where.get(b, self.rally or self.home)
        return max(0.0, math.dist(start, point) - REACH) / VILLAGER_SPEED

    def _join(self, b, k, at):
        self._leave(b)
        site = self.sites[k]
        if site['done'] is not None:
            return
        site['crew'][b] = at + self._walk(b, site['point'])
        self.on[b] = k
        self.where[b] = site['point']

    def _leave(self, b):
        k = self.on.pop(b, None)
        if k is not None:
            self.sites[k]['crew'].pop(b, None)

    def advance(self, t):
        while True:
            best = None
            for k, s in enumerate(self.sites):
                if s['done'] is not None or not s['crew']:
                    continue
                here = [a for a in s['crew'].values() if a <= self.now]
                if here:
                    rate = (len(here) + 2) / (3 * s['build'])
                    finish = self.now + (1 - s['progress']) / rate
                    if best is None or finish < best[0]:
                        best = (finish, 'done', k)
                later = [a for a in s['crew'].values() if a > self.now]
                if later and (best is None or min(later) < best[0]):
                    best = (min(later), 'arrive', k)
            step = t if best is None or best[0] > t else best[0]
            for s in self.sites:
                if s['done'] is None and s['crew']:
                    n = sum(1 for a in s['crew'].values() if a <= self.now)
                    if n:
                        s['progress'] += (n + 2) / (3 * s['build']) * (step - self.now)
            self.now = step
            if best is None or best[0] > t:
                return
            if best[1] == 'done':
                s = self.sites[best[2]]
                s['done'], s['progress'] = self.now, 1.0
                for b in list(s['crew']):
                    self._leave(b)
                    nxt = self.queue.pop(b, [])
                    if nxt:
                        self._join(b, nxt[0], self.now)
                        if nxt[1:]:
                            self.queue[b] = nxt[1:]
                    else:
                        self.pending.discard(b)

    def order(self, at, kind, ids, payload, flags):
        self.advance(at)
        point = _point(payload)
        building = payload.get('building_id')
        queued, direct = 'q' in flags, 'd' in flags
        k = None
        if kind == 'BUILD' and point is not None and (building in HOUSE_IDS or building in TC_FOUNDATIONS):
            tc = building in TC_FOUNDATIONS
            self.sites.append({'point': point, 'build': TC_BUILD if tc else HOUSE_BUILD, 'tc': tc,
                               'progress': 0.0, 'done': None, 'crew': {}})
            k = len(self.sites) - 1
        elif kind == 'ORDER' and point is not None:
            k = next((i for i, s in enumerate(self.sites) if math.dist(s['point'], point) < 0.01), None)
        for b in ids:
            # A plain order waits behind a queued one the unit still holds (genie's moves.rs).
            waits = queued or (b in self.pending and not direct)
            if k is not None:
                if waits and b in self.on:
                    self.queue.setdefault(b, []).append(k)
                    self.pending.add(b)
                else:
                    self.queue.pop(b, None)
                    self.pending.discard(b)
                    self._join(b, k, at)
                continue
            if waits:
                self.pending.add(b)
                continue
            self._leave(b)
            self.queue.pop(b, None)
            self.pending.discard(b)
            if point is not None:
                self.where[b] = point

    def caps(self, tc_pop, house_pop):
        return [(s['done'], tc_pop if s['tc'] else house_pop) for s in self.sites if s['done'] is not None]


FOOD_NAMES = {'Forage Bush', 'Fruit Bush', 'Berry Bush', 'Deer', 'Wild Boar', 'Iron Boar', 'Javelina',
              'Rhinoceros', 'Zebra', 'Ostrich', 'Wild Bactrian Camel', 'Wild Camel', 'Wild Horse', 'Elephant',
              'Ibex', 'Shore Fish', 'Box Turtles', 'Farm'} | LIVESTOCK
CAMPS = {562: 'wood', 50: 'food', 68: 'food'}       # lumber camp, farm, mill
MINING_CAMP = 584
START = {'food': 200.0, 'wood': 200.0, 'gold': 100.0, 'stone': 200.0}
START_CHANGE = {'Chinese': {'food': -200.0, 'wood': -50.0}}
UNIT_COST = {83: {'food': 50}, 293: {'food': 50}, 74: {'food': 60, 'gold': 20}, 13: {'wood': 75}, 545: {'wood': 125}}
UNIT_COST_SCALE = {'Hindustanis': {83: 0.92, 293: 0.92}}   # tech 496, dark age
BUILD_COST = {70: {'wood': 25}, 50: {'wood': 60}, 68: {'wood': 100}, 562: {'wood': 100}, 584: {'wood': 100},
              12: {'wood': 175}, 45: {'wood': 150}, 109: {'wood': 275, 'stone': 100}, 621: {'wood': 275, 'stone': 100}}
TECH_COST = {LOOM: {'gold': 50}, FEUDAL: {'food': 500}}
KINDS = ('food', 'wood', 'gold', 'stone')


def resource_kind(name):
    name = name or ''
    if name.startswith('Tree'):
        return 'wood'
    if name == 'Gold Mine':
        return 'gold'
    if name == 'Stone Mine':
        return 'stone'
    if name in FOOD_NAMES or name.startswith('Cow'):
        return 'food'
    return None


def _master_names():
    try:
        import json
        import aocref
        from pathlib import Path
        data = json.loads((Path(aocref.__file__).parent / 'data/datasets/100.json').read_text())
        return {int(k): v for k, v in data['objects'].items()}
    except Exception:
        return {}


class Economy:
    """Resources of one player between the recording's checkpoints.

    A checkpoint gives the exact stockpile sum. What was gathered between two checkpoints is
    the sum's change plus what was spent (every spending order counted as paid), spread evenly
    over the interval and split over food, wood, gold and stone by what the villagers were last
    told to work on. At each checkpoint the estimate is set to the checkpoint's sum."""

    def __init__(self, civ, checkpoints, objects, home):
        self.stock = {k: START[k] + START_CHANGE.get(civ, {}).get(k, 0.0) for k in KINDS}
        self.checkpoints = [c for c in checkpoints if c[0] > 0]
        self.next_cp = 0
        self.cp_t, self.cp_total = 0.0, sum(self.stock.values())
        self.rate, self.spent_since, self.gained_since = 0.0, 0.0, 0.0
        self.tasks = {}            # villager id -> resource kind or None
        self.others = set()        # ids of units that do not gather
        self.newborn = []          # tasks of born villagers not yet named by an order
        self.gather_kind = None
        self.objects = objects     # id -> (name, x, y)
        self.points = [(x, y, resource_kind(n)) for n, x, y in objects.values() if resource_kind(n)]
        self.farms = []
        self.home = home
        self.masters = _master_names()
        self.planned = []          # (time, cost) of every order that spends, as if all were paid

    def shares(self):
        counts = {k: 0 for k in KINDS}
        for kind in list(self.tasks.values()) + self.newborn:
            if kind in counts:
                counts[kind] += 1
        n = sum(counts.values())
        if n == 0:
            return {'food': 1.0, 'wood': 0.0, 'gold': 0.0, 'stone': 0.0}
        return {k: v / n for k, v in counts.items()}

    def _gain(self, amount):
        for k, share in self.shares().items():
            self.stock[k] += amount * share

    def advance(self, t):
        while self.next_cp < len(self.checkpoints) and self.checkpoints[self.next_cp][0] <= t:
            ct, total = self.checkpoints[self.next_cp]
            self.next_cp += 1
            gathered = total - self.cp_total + self.spent_since
            self._gain(gathered - self.gained_since)
            self.rate = max(0.0, gathered) / (ct - self.cp_t) if ct > self.cp_t else 0.0
            self._settle(total)
            self.cp_t, self.cp_total, self.spent_since, self.gained_since = ct, total, 0.0, 0.0
        due = self.rate * (t - self.cp_t) - self.gained_since
        if self.next_cp < len(self.checkpoints):
            # the next checkpoint is known: what it says was gathered, spread evenly
            ct, total = self.checkpoints[self.next_cp]
            planned = sum(c for when, c in self.planned if self.cp_t < when <= ct)
            gathered = max(0.0, total - self.cp_total + planned)
            due = gathered * (t - self.cp_t) / (ct - self.cp_t) - self.gained_since
        if due > 0:
            self._gain(due)
            self.gained_since += due

    def _settle(self, total):
        """Make the estimate's sum the checkpoint's: no resource below zero."""
        for k in KINDS:
            self.stock[k] = max(0.0, self.stock[k])
        held = sum(self.stock.values())
        if held <= 0:
            return
        diff = total - held
        if diff >= 0:
            self._gain(diff)
            return
        # too much estimated: take it from food and wood by their shares of the two
        fw = self.stock['food'] + self.stock['wood']
        if fw <= 0:
            return
        for k in ('food', 'wood'):
            self.stock[k] = max(0.0, self.stock[k] + diff * self.stock[k] / fw)

    def pay(self, cost, count=1):
        """How many of `count` the stock pays (each costing `cost`), paying them."""
        paid = 0
        for _ in range(count):
            if any(self.stock[k] + 1e-6 < v for k, v in cost.items()):
                break
            for k, v in cost.items():
                self.stock[k] -= v
                self.spent_since += v
            paid += 1
        return paid

    def kind_at(self, target, point):
        if target is not None and target in self.objects:
            return resource_kind(self.objects[target][0])
        if point is None:
            return None
        if any(math.dist(point, f) < 2.5 for f in self.farms):
            return 'food'
        near = [(math.dist(point, (x, y)), k) for x, y, k in self.points if abs(x - point[0]) < 2 and abs(y - point[1]) < 2]
        return min(near)[1] if near else None

    def command(self, kind, ids, payload, flags):
        point = _point(payload)
        task = 'keep'
        if kind == 'ORDER':
            found = self.kind_at(payload.get('target_id'), point)
            task = found if found is not None else 'keep'
        elif kind == 'BUILD':
            building = payload.get('building_id')
            if building == 50 and point is not None:
                self.farms.append(point)
            if building in CAMPS:
                task = CAMPS[building]
            elif building == MINING_CAMP and point is not None:
                near = [(math.dist(point, (x, y)), k) for x, y, k in self.points if k in ('gold', 'stone')]
                task = min(near)[1] if near else 'gold'
        elif kind in ('MOVE', 'STOP', 'PATROL') and 'q' not in flags:
            task = None
        for b in ids:
            if b in self.others or (b in self.objects and b not in self.tasks):
                continue          # the scout, livestock and other objects the map started with
            if b not in self.tasks:
                # an id first named now: a villager born since (its gather point task)
                self.tasks[b] = self.newborn.pop(0) if self.newborn else self.gather_kind
            if task != 'keep':
                self.tasks[b] = task

    def gather_point(self, payload):
        target, kind_id = payload.get('target_id'), payload.get('target_type')
        if isinstance(kind_id, int) and kind_id >= 0 and kind_id in self.masters:
            self.gather_kind = resource_kind(self.masters[kind_id])
        else:
            self.gather_kind = self.kind_at(target if isinstance(target, int) and target >= 0 else None, _point(payload))

    def born(self):
        self.newborn.append(self.gather_kind)


class Production:
    """Building queues trained in order, a unit waiting while the population is at the cap."""

    def __init__(self, pop, caps):
        self.pop, self.caps = pop, caps
        self.cap_times = sorted({w for w, _ in caps if w > 0})
        self.state, self.t, self.in_training = {}, 0.0, 0
        self.timeline, self.blocks, self.on_birth = [(0.0, pop, self.cap_at(0.0))], [], None

    def cap_at(self, t):
        return sum(c for when, c in self.caps if when <= t)

    def add(self, building, item):
        self.state.setdefault(building, {'q': [], 'busy_until': None, 'unit': None, 'wait_from': None})['q'].append(item)

    def drop_units(self, building, count):
        q = self.state.get(building, {}).get('q', [])
        for _ in range(count):
            units = [i for i, item in enumerate(q) if item[0] == 'unit']
            if units:
                del q[units[-1]]

    def _start(self):
        progressed = True
        while progressed:
            progressed = False
            for s in self.state.values():
                if s['busy_until'] is not None or not s['q']:
                    continue
                kind, seconds, unit = s['q'][0]
                if kind == 'unit' and self.pop + self.in_training + 1 > self.cap_at(self.t):
                    if s['wait_from'] is None:
                        s['wait_from'] = self.t
                    continue
                if s['wait_from'] is not None:
                    self.blocks.append((s['wait_from'], self.t))
                    s['wait_from'] = None
                s['q'].pop(0)
                s['busy_until'] = self.t + seconds
                s['unit'] = unit if kind == 'unit' else None
                self.in_training += kind == 'unit'
                progressed = True

    def advance(self, t):
        self._start()
        while True:
            nexts = [s['busy_until'] for s in self.state.values() if s['busy_until'] is not None]
            nexts += [w for w in self.cap_times if w > self.t]
            nexts = [n for n in nexts if n <= t]
            if not nexts:
                break
            self.t = min(nexts)
            for s in self.state.values():
                if s['busy_until'] is not None and s['busy_until'] <= self.t:
                    if s['unit'] is not None:
                        self.in_training -= 1
                        self.pop += 1
                        if self.on_birth:
                            self.on_birth(s['unit'])
                    s['busy_until'], s['unit'] = None, None
            self._start()
            self.timeline.append((round(self.t, 1), self.pop, self.cap_at(self.t)))
        self.t = max(self.t, t)
        self._start()

    def finish(self, until):
        self.advance(until)
        for s in self.state.values():
            if s['wait_from'] is not None:
                self.blocks.append((s['wait_from'], until))


def player_housing(orders, player, civ, until, checkpoints=(), objects=None):
    """Housed intervals of one player before `until` (Feudal click), plus the pop timeline.

    `checkpoints` [(seconds, stockpile sum)] let the queue orders be checked against the food
    they need; `objects` {id: (name, x, y)} name what a villager was sent to."""
    if civ in NO_HOUSES:
        return None
    own = [o for o in orders if o[1] == player.number]
    tc_pop = TC_POP_BONUS.get(civ, TC_POP)
    house_pop = HOUSE_POP_BONUS.get(civ, HOUSE_POP)
    tcs = [o for o in player.objects if getattr(o, 'object_id', None) in TC_IDS]
    home = (tcs[0].position.x, tcs[0].position.y) if tcs else (player.position.x, player.position.y)
    pop = sum(1 for o in player.objects if o.class_id == 70 and o.name and o.name not in LIVESTOCK)
    where = {o.instance_id: (o.position.x, o.position.y) for o in player.objects if o.class_id == 70}
    builders, last = Builders(where, home), []
    tc_ids = {o.instance_id for o in tcs}
    for at, _, kind, payload, flags in own:
        if at >= until:
            break
        if kind == 'GATHER_POINT' and set(payload.get('object_ids') or []) & tc_ids:
            builders.rally = _point(payload)
        if kind not in COMMANDS:
            continue
        ids = payload.get('object_ids') or last     # a repeated selection is sent as "the last commanded"
        last = ids
        builders.order(at, kind, ids, payload, flags)
    builders.advance(until)
    caps = sorted([(0.0, tc_pop * len(tcs))] + builders.caps(tc_pop, house_pop))

    production, refused = _replay(own, player, civ, until, caps, tcs, home, checkpoints, objects, pop)
    merged = []
    for a, b in sorted(production.blocks):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    timeline = production.timeline
    tenth = lambda v: math.floor(v * 10) / 10      # never past the Feudal click it stops at
    shown = [{'from_seconds': tenth(a), 'to_seconds': tenth(b), 'seconds': round(b - a, 1),
              'population': _pop_at(timeline, a)} for a, b in merged if b - a >= MIN_BLOCK]
    return {'until_seconds': round(until, 1), 'blocks': shown, 'refused_queue': refused,
            'blocked_seconds': round(sum(x['seconds'] for x in shown), 1), 'timeline': timeline}


def _replay(own, player, civ, until, caps, tcs, home, checkpoints, objects, pop):
    """The production replay: queue orders paid from the estimated stock, units trained in turn."""
    economy = None
    if checkpoints:
        economy = Economy(civ, checkpoints, objects or {}, home)
        for o in player.objects:
            if o.name == 'Villager':
                economy.tasks[o.instance_id] = None
            elif o.class_id == 70 or getattr(o, 'object_id', None) in TC_IDS:
                economy.others.add(o.instance_id)
    if economy:
        for at, _, kind, payload, _ in own:
            if at >= until:
                break
            cost = {}
            if kind == 'DE_QUEUE' and (payload.get('amount') or 0) > 0:
                cost = {k: v * payload['amount'] for k, v in UNIT_COST.get(payload.get('unit_id'), {}).items()}
            elif kind == 'BUILD':
                cost = BUILD_COST.get(payload.get('building_id'), {})
            elif kind == 'RESEARCH':
                cost = TECH_COST.get(payload.get('technology_id'), {})
            if cost:
                economy.planned.append((at, sum(cost.values())))
    production = Production(pop, caps)
    if economy:
        production.on_birth = lambda unit: economy.born() if unit in (83, 293) else None
    work = TC_WORK.get(civ, 1.0)
    scale = RESEARCH_SCALE.get(civ, {})
    instant = INSTANT.get(civ, set())
    cost_scale = UNIT_COST_SCALE.get(civ, {})
    researched, tc_ids, refused, last = set(), {o.instance_id for o in tcs}, 0, []
    for at, _, kind, payload, flags in own:
        if at >= until:
            break
        production.advance(at)
        if economy:
            economy.advance(at)
        ids = payload.get('object_ids') or []
        if kind in COMMANDS:
            ids = ids or last
            last = ids
            if economy:
                economy.command(kind, ids, payload, flags)
                if kind == 'BUILD':
                    economy.pay(BUILD_COST.get(payload.get('building_id'), {}))
            continue
        if kind == 'GATHER_POINT':
            if economy and set(ids) & tc_ids:
                economy.gather_point(payload)
            continue
        if not ids:
            continue
        building = ids[0]
        rate = work if building in tc_ids else 1.0
        if kind == 'DE_QUEUE':
            unit, amount = payload.get('unit_id'), payload.get('amount') or 0
            if unit not in TRAIN:
                continue
            if amount > 0:
                if economy:
                    cost = {k: v * cost_scale.get(unit, 1.0) for k, v in UNIT_COST.get(unit, {}).items()}
                    got = economy.pay(cost, amount)
                    refused += amount - got
                    amount = got
                for _ in range(amount):
                    production.add(building, ('unit', TRAIN[unit] / rate, unit))
            elif amount < 0:
                production.drop_units(building, -amount)
        elif kind == 'RESEARCH':
            tech = payload.get('technology_id')
            if tech not in RESEARCH or tech in researched:
                continue
            researched.add(tech)
            if economy:
                economy.pay(TECH_COST.get(tech, {}))
            seconds = 0.0 if tech in instant else RESEARCH[tech] * scale.get(tech, 1.0) / rate
            production.add(building, ('tech', seconds, None))
    production.finish(until)
    return production, refused


def _pop_at(timeline, t):
    last = timeline[0]
    for row in timeline:
        if row[0] > t:
            break
        last = row
    return f'{last[1]}/{last[2]}'


def feudal_click(orders, number):
    for at, player, kind, payload, _ in orders:
        if player == number and kind == 'RESEARCH' and payload.get('technology_id') == FEUDAL:
            return at
    return None


def housing(decoded, match, own):
    """Pre-Feudal population blocks of `own` and its 1v1 opponent, or None."""
    opponents = [p for p in match.players if p.number != own.number]
    if len(opponents) != 1:
        return None
    offset = match.restored_at.total_seconds()
    orders = read_orders(decoded, offset)
    end = (match.duration + match.restored_at).total_seconds()
    from state_curve import read_checkpoints
    checkpoints = read_checkpoints(decoded)
    objects = {o.instance_id: (o.name, o.position.x, o.position.y)
               for o in list(match.gaia) + [o for p in match.players for o in p.objects]}
    result = {'source': 'replayed_orders', 'min_block_seconds': MIN_BLOCK}
    for key, p in (('own', own), ('opponent', opponents[0])):
        click = feudal_click(orders, p.number)
        cps = [(ms / 1000 + offset, row[p.number][0]) for ms, row in checkpoints if p.number in row]
        row = player_housing(orders, p, p.civilization, click if click is not None else end, cps, objects)
        if row is not None:
            row.pop('timeline')
            row['feudal_clicked'] = click is not None
        result[key] = row
    return result
