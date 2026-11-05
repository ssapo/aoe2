"""Resource totals read from recording checkpoints.

mgz interprets total_res as stockpiled resources; upstream documents the field
semantics as guesses. Object totals cannot identify living military units.
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
