"""Resource totals read from recording checkpoints.

total_res is the player's stockpile: food, wood, stone and gold, each cut to a
whole number, then added. Checked 2026-11-12 against the original game (build
188329): it equals the sum read from the running game's memory at the same game
time in 852 of 872 checkpoints of three replays; the other 20 lie within one
memory sample (about 0.2 s) of a change. A re-simulation that rebuilds every
checkpoint word from game state reproduces it too (README, "체크포인트 단어의 뜻").
The time is the game clock after the tick that wrote the checkpoint.

It is one sum: no split by resource, no income, no spending. Object totals
(obj_count: everything in the player's object list) cannot identify living
military units.
"""
import io

FLOAT_LINE = 1000          # stockpile treated as floating
AFTER_SECONDS = 300        # floating is measured after the opening


def read_checkpoints(decoded):
    """[(game_ms, {player_number: (total_res, obj_count)})] in recording order."""
    from mgz import fast
    from mgz.fast.header import parse
    handle = io.BytesIO(decoded)
    parse(handle)
    fast.meta(handle)
    rows = []
    while True:
        try:
            kind, value = fast.operation(handle)
        except EOFError:
            break
        if kind is not fast.Operation.SYNC or not value[2]:
            continue
        payload = value[2]
        players = {k: (v['total_res'], v['obj_count']) for k, v in payload.items() if isinstance(k, int)}
        if players:
            rows.append((payload.get('current_time', 0), players))
    return rows


def _float_stats(points, index):
    after = [(t, p[index]) for t, *p in points if t >= AFTER_SECONDS]
    if len(after) < 2:
        return None, 0
    mean = round(sum(v for _, v in after) / len(after))
    floating = 0
    for (t0, v0), (t1, _) in zip(after, after[1:]):
        if v0 >= FLOAT_LINE:
            floating += t1 - t0
    return mean, round(floating)


def state_curve(decoded, match, own):
    """Resource totals of `own` and its 1v1 opponent, or None."""
    opponents = [p for p in match.players if p.number != own.number]
    if len(opponents) != 1:
        return None
    opponent = opponents[0]
    offset = match.restored_at.total_seconds()
    points = []
    for ms, players in read_checkpoints(decoded):
        mine, theirs = players.get(own.number), players.get(opponent.number)
        if mine is None or theirs is None:
            continue
        points.append([round(ms / 1000 + offset, 1), mine[0], theirs[0]])
    if len(points) < 2:
        return None
    own_mean, own_float = _float_stats(points, 0)
    opp_mean, opp_float = _float_stats(points, 1)
    return {
        'source': 'recording_checkpoints',
        'columns': ['seconds', 'own_resources', 'opponent_resources'],
        'points': points,
        'summary': {
            'float_line': FLOAT_LINE,
            'after_seconds': AFTER_SECONDS,
            'own_mean_resources': own_mean,
            'opponent_mean_resources': opp_mean,
            'own_floating_seconds': own_float,
            'opponent_floating_seconds': opp_float,
        },
    }
