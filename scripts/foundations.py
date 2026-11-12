"""Buildings finished between two recording checkpoints, read from the checkpoint words.

Every checkpoint holds, per player, the number of objects in the player's list (word 6) and
the sum of their state values (word 3); see README, "체크포인트 단어의 뜻". A living unit or a
finished building has state 2, a foundation that is not finished yet has state 0. So

    unfinished foundations = (2 x objects - sum of states) / 2

at every checkpoint, whatever else was born, taken over or eaten in between. Other states are
rare and short: a projectile that has hit (5, 7, 8), a dying unit (3 and up). They make the
value odd or too low; such a checkpoint is skipped, or thrown out again once a later
checkpoint shows more foundations than the orders since can explain.

Between two good checkpoints, foundations before + foundations ordered (BUILD, WALL) -
foundations after = buildings finished. Which building it was is not in the words: `assign`
gives each finish to the ordered building whose estimated finish lies nearest.

Checked 2026-11-13 against the object lists read from the running game's memory (three
recordings, six players): see README, "봉건 전 인구 막힘", 개정 18.
"""
import math

LOST = 30.0        # cost of a finish no ordered building takes (seconds of estimate error)
UNKNOWN = 20.0     # cost of giving a finish to a building the estimate never finishes
PROXY = 30.0       # where such a building stands in the order of estimates: this long after its order


def pending(count, states):
    """Unfinished foundations in a list of `count` objects whose states add up to `states`;
    None when other states hide it."""
    twice = 2 * count - states
    if twice < 0 or twice % 2:
        return None
    return twice // 2


def finished(rows, laid, start=0.0):
    """`rows` [(seconds, object count, state sum)] of one player's checkpoints, `laid`
    [(seconds, fewest, most)] the foundations its orders laid.

    Returns ([(after, by)], seconds): one span per building finished, in time order, and the
    time up to which they are known. No foundations at `start`."""
    marks = [(start, 0, [])]              # good checkpoints: time, foundations, finishes found at it
    for t, count, states in rows:
        now = pending(count, states)
        if now is None:
            continue
        while True:
            at, before, _ = marks[-1]
            fewest = sum(a for when, a, _ in laid if at <= when < t)
            most = sum(b for when, _, b in laid if at <= when < t)
            if before + most >= now:
                break
            if len(marks) == 1:           # a foundation no order explains: nothing known from here
                return [span for _, _, spans in marks for span in spans], at
            marks.pop()                   # that checkpoint read too low
        done = before + max(fewest, now - before) - now
        marks.append((t, now, [(at, t)] * done))
    return [span for _, _, spans in marks for span in spans], marks[-1][0]


def assign(sites, found, known_until):
    """`sites` [(order seconds, estimated finish or None)] in order of their orders, `found`
    and `known_until` as `finished` gives them.

    Returns {site index: (after, by)}: the span the building's finish lies in. A building
    ordered before `known_until` that no finish is given to is not finished by then:
    (known_until, inf). The finishes go to the buildings in the order of their estimates,
    with the smallest sum of distances between estimate and span."""
    place = lambda i: sites[i][1] if sites[i][1] is not None else sites[i][0] + PROXY
    order = sorted(range(len(sites)), key=lambda i: (place(i), i))
    found = sorted(found)

    def skip(i):
        estimate = sites[i][1]
        return 0.0 if estimate is None or estimate >= known_until else known_until - estimate

    def fit(i, span):
        at, estimate = sites[i]
        if at >= span[1]:
            return math.inf
        if estimate is None:
            return UNKNOWN
        return max(0.0, span[0] - estimate, estimate - span[1])

    n, m = len(order), len(found)
    best = [[math.inf] * (m + 1) for _ in range(n + 1)]
    step = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            here = best[i][j]
            if here == math.inf:
                continue
            if i < n and here + skip(order[i]) < best[i + 1][j]:
                best[i + 1][j], step[i + 1][j] = here + skip(order[i]), 'site'
            if j < m and here + LOST < best[i][j + 1]:
                best[i][j + 1], step[i][j + 1] = here + LOST, 'span'
            if i < n and j < m and here + fit(order[i], found[j]) < best[i + 1][j + 1]:
                best[i + 1][j + 1], step[i + 1][j + 1] = here + fit(order[i], found[j]), 'both'
    out, i, j = {}, n, m
    while i or j:
        move = step[i][j]
        if move == 'both':
            i, j = i - 1, j - 1
            out[order[i]] = found[j]
        elif move == 'site':
            i -= 1
            if sites[order[i]][0] < known_until:
                out[order[i]] = (known_until, math.inf)
        else:
            j -= 1
    return out


def narrow(spans, sites, houses, deadlines):
    """Cuts the houses' spans by the births the checkpoints show.

    `deadlines[k]`: the time by which the k-th house to finish must stand, because a unit that
    needed its room was born a training time later. `houses`: the site indexes that are
    houses. A house whose span starts after its deadline changes spans with a building of
    another kind that was given an earlier finish; if there is none, the span is left."""
    spans = dict(spans)
    for k, deadline in enumerate(deadlines):
        line = sorted((i for i in houses if i in spans), key=lambda i: (spans[i], i))
        if k >= len(line):
            break
        house = line[k]
        if spans[house][0] >= deadline:
            others = [i for i in spans if i not in houses and spans[i][0] < deadline
                      and spans[i][1] < math.inf and sites[house][0] < spans[i][1]
                      and sites[i][0] < spans[house][1]]
            if not others:
                continue
            other = max(others, key=lambda i: spans[i])
            spans[house], spans[other] = spans[other], spans[house]
        after, by = spans[house]
        spans[house] = (after, min(by, deadline))
    return spans
