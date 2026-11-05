"""Per-player state the game itself wrote into the recording.

DE recordings carry a checkpoint about every 500 syncs (roughly 7-15 game seconds).
Each checkpoint holds, for every player, values the game computed from its own
state: the stockpile (food + wood + gold + stone, rounded down) and the number of
the player's objects. These are the original game's numbers, not a simulation.

Limits: the object count mixes units, buildings, owned livestock and short-lived
objects such as projectiles, so it is not an army size. Nothing here says why a
value changed.
"""
import io

FLOAT_LINE = 1000          # stockpile treated as floating
AFTER_SECONDS = 300        # floating is measured after the opening
SWING_WINDOW = 60          # seconds over which a change of the object gap is measured


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


def _largest_swing(points):
    """Window where (own objects - opponent objects) moved most within SWING_WINDOW."""
    best = None
    for i, (t0, _, own0, _, opp0) in enumerate(points):
        gap0 = own0 - opp0
        for t1, _, own1, _, opp1 in points[i + 1:]:
            if t1 - t0 > SWING_WINDOW:
                break
            change = (own1 - opp1) - gap0
            if best is None or abs(change) > abs(best['change']):
                best = {'from_seconds': round(t0), 'to_seconds': round(t1), 'change': change,
                        'own_from': own0, 'own_to': own1, 'opponent_from': opp0, 'opponent_to': opp1}
    return best


def state_curve(decoded, match, own):
    """Stockpile and object count of `own` and its 1v1 opponent over the game, or None."""
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
        points.append([round(ms / 1000 + offset, 1), mine[0], mine[1], theirs[0], theirs[1]])
    if len(points) < 2:
        return None
    own_mean, own_float = _float_stats(points, 0)
    opp_mean, opp_float = _float_stats(points, 2)
    return {
        'source': 'recording_checkpoints',
        'columns': ['seconds', 'own_resources', 'own_objects', 'opponent_resources', 'opponent_objects'],
        'points': points,
        'summary': {
            'float_line': FLOAT_LINE,
            'after_seconds': AFTER_SECONDS,
            'own_mean_resources': own_mean,
            'opponent_mean_resources': opp_mean,
            'own_floating_seconds': own_float,
            'opponent_floating_seconds': opp_float,
            'largest_swing': _largest_swing(points),
        },
    }
