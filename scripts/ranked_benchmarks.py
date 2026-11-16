"""Small, auditable RM 1v1 benchmark observations from already saved reports."""
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from opening import classify

ROOT = Path(__file__).resolve().parents[1]
TIMES = (300, 600, 900, 1200, 1500, 1800)
MIN_RATING = 2000
AGES = ('봉건', '성주', '왕정')


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def stage_at(metrics, at):
    stage = '암흑'
    previous = 0
    for age in AGES:
        row = metrics.get('age_checkpoints', {}).get(age, {})
        reached = row.get('reached_seconds')
        command = row.get('command_seconds', metrics.get('age_commands', {}).get(age))
        if finite(reached):
            if reached < previous:
                return None
            previous = reached
            if reached <= at:
                stage = age
        elif finite(command) and command <= at:
            return None
    return stage


def tc_band(metrics, at):
    timeline = metrics.get('full_timeline')
    if not isinstance(timeline, list):
        return None
    count = sum(e.get('kind') == 'BUILD' and e.get('label') == 'Town Center'
                and finite(e.get('seconds')) and e['seconds'] <= at for e in timeline)
    return 'expansion' if count else 'single'


def resource_mean(curve, side, start, end):
    points = (curve or {}).get('points', [])
    if len(points) < 2:
        return None
    normalized = []
    for p in points:
        if not isinstance(p, list) or len(p) not in (3, 5):
            return None
        col = (1 if side == 0 else 3) if len(p) == 5 else side+1
        if not all(finite(p[i]) for i in (0, col)) or normalized and p[0] <= normalized[-1][0]:
            return None
        normalized.append((p[0], p[col]))
    weighted = covered = 0
    for a, b in zip(normalized, normalized[1:]):
        if b[0]-a[0] > 30:
            continue
        seconds = max(0, min(end, b[0])-max(start, a[0]))
        covered += seconds
        weighted += seconds*a[1]
    return int(weighted/covered+0.5) if covered >= (end-start)*0.9 else None


FOOD_MINUTES = range(60, 601, 60)  # food is compared up to 10:00, inside the span the engine replay was verified


def food_sources(engine, side):
    """Engine food by source for one side at whole minutes within the verified span.

    `at`: {"300": [sheep, hunt (boar+deer), berries, farm, rest (fish+other)]} cumulative food brought in.
    `left`: food left on animals this side finished alone by that minute (only when the engine gave `full`)."""
    if not isinstance(engine, dict) or not finite(engine.get('verified_until_seconds')):
        return None
    until = engine['verified_until_seconds']
    points = (engine.get('by_source') or {}).get('points')
    if not isinstance(points, list):
        return None
    start = 1 if side == 0 else 10
    rows = {}
    for p in points:
        if isinstance(p, list) and len(p) == 19 and all(finite(v) for v in p):
            rows[round(p[0], 1)] = p
    at = {}
    for minute in FOOD_MINUTES:
        p = rows.get(float(minute))
        if minute > until or p is None:
            continue
        f = p[start:start+7]
        at[str(minute)] = [round(v) for v in (f[0], f[1]+f[2], f[3], f[4], f[5]+f[6])]
    if not at:
        return None
    result = {'until': round(until, 1), 'at': at}
    animals = engine.get('animals')
    if isinstance(animals, dict) and finite(animals.get('until_seconds')):
        everyone = [a for k in ('own', 'opponent') for a in (animals.get(k) or []) if isinstance(a, dict)]
        mine = [a for a in (animals.get('own' if side == 0 else 'opponent') or []) if isinstance(a, dict)]
        if any('full' in a for a in everyone):
            left = {}
            for minute in FOOD_MINUTES:
                if minute > min(until, animals['until_seconds']):
                    continue
                left[str(minute)] = round(sum(a['full']-a['eaten'] for a in mine
                                              if finite(a.get('full')) and finite(a.get('eaten')) and a['full'] >= a['eaten']
                                              and finite(a.get('last_seconds')) and a['last_seconds'] <= minute))
            if left:
                result['left'] = left
    return result


def observation(match, analysis, side, player, rating):
    metrics = analysis['metrics'] if side == 0 else analysis['opponents'][0]['metrics']
    summary = analysis.get('review', {}).get('own' if side == 0 else 'opponent', {})
    if metrics.get('recording_restored') or not summary.get('available'):
        return None
    ages = {age: row['reached_seconds'] for age, row in metrics.get('age_checkpoints', {}).items()
            if age in AGES and finite(row.get('reached_seconds')) and row['reached_seconds'] <= analysis.get('duration_game_seconds', 0)}
    checkpoints = {}
    requests = {p['seconds']: p.get('villager_requests') for p in summary.get('checkpoints', [])}
    for at in TIMES:
        if at > analysis.get('duration_game_seconds', 0):
            continue
        band, stage = tc_band(metrics, at), stage_at(metrics, at)
        row = {}
        if stage and band and finite(requests.get(at)):
            row['villagers'] = {'value': requests[at], 'stage': stage, 'tc': band}
        resource_stage = stage_at(metrics, at-300)
        mean = resource_mean(analysis.get('state_curve'), side, at-300, at) if at >= 600 else None
        if resource_stage and band and mean is not None:
            row['resources'] = {'value': mean, 'stage': resource_stage, 'tc': band}
        if row:
            checkpoints[str(at)] = row
    if not ages and not checkpoints:
        return None
    food = food_sources(analysis.get('engine_income'), side)
    return {'match_id': match['id'], 'profile_id': player['profile_id'], 'name': player['name'],
            'rating': rating, 'started_at': match['started_at'], 'map': match['map'],
            'civilization': analysis.get('civilization') if side == 0 else analysis['opponents'][0].get('civilization'),
            **classify(metrics, analysis.get('duration_game_seconds', 0)),
            'ages': ages, 'checkpoints': checkpoints, **({'food': food} if food else {})}


def rating_for(match, player, current):
    """Rating going into the match, and where it came from: 'match' (the API's `oldrating` kept on the
    row: `rating_before` for the recording player, `players[].rating_before` for anyone) or, when the
    row holds none, 'current' (the ranking file's rating when it was built). Never mixed within a value."""
    before = match.get('rating_before') if player.get('is_self') else player.get('rating_before')
    if finite(before) and before > 0:
        return before, 'match'
    now = current.get(player['profile_id'])
    return (now, 'current') if finite(now) else (None, None)


def build(reports, index, now=None, existing=None):
    now = now or datetime.now(timezone.utc)
    cutoff = now-timedelta(days=30)
    current = {p['id']: p['rating'] for p in index.get('players', []) if finite(p.get('rating'))}
    samples = {}
    # Keep compact observations when a source report rolls out of its history.
    # Recheck eligibility and age on every build; newly parsed rows replace old ones.
    if (existing or {}).get('method_revision') in (1, 2, 3, 4):
        for row in existing.get('samples', []):
            try:
                started = datetime.fromisoformat(row['started_at'])
                # A rating taken from the match itself stays as stored; older rows only know the
                # ranking file's rating of the day they were built, so they follow the current one.
                matched = row.get('rating_basis') == 'match'
                rating = row['rating'] if matched else current.get(row['profile_id'])
                if finite(rating) and rating >= MIN_RATING and cutoff <= started <= now:
                    # v1 resource/age calculations are unchanged; only discard the old first-unit classification.
                    # v2 rows simply lack `food` (engine food by source, added in v3).
                    kept = {**row, 'rating': rating, 'rating_basis': 'match' if matched else 'current'}
                    if existing.get('method_revision') == 1:
                        kept.update(opening=None, opening_label=None)
                    samples[(row['match_id'], row['profile_id'])] = kept
            except (ValueError, TypeError, KeyError):
                continue
    for report in reports:
        for match in report.get('matches', []):
            analysis = match.get('analysis') or {}
            if match.get('match_type_id') != 6 or match.get('players_count') != 2 or len(match.get('players', [])) != 2 or len(analysis.get('opponents', [])) != 1:
                continue
            try:
                stamp = match['started_at']
                started = datetime.fromtimestamp(stamp, timezone.utc) if finite(stamp) else datetime.fromisoformat(stamp.replace('Z', '+00:00'))
                if not cutoff <= started <= now:
                    continue
            except (ValueError, TypeError, KeyError):
                continue
            own = [p for p in match['players'] if p.get('is_self') and p.get('profile_id') == report.get('profile', {}).get('id')]
            other = [p for p in match['players'] if not p.get('is_self')]
            if len(own) != 1 or len(other) != 1 or 'metrics' not in analysis:
                continue
            for side, player in enumerate((own[0], other[0])):
                pid = player['profile_id']
                rating, basis = rating_for(match, player, current)
                if rating is None or rating < MIN_RATING:
                    continue
                row = observation(match, analysis, side, player, rating)
                if row:
                    row['rating_basis'] = basis
                    row['started_at'] = started.isoformat()
                    row['recording_profile_id'] = report['profile']['id']
                    samples[(match['id'], pid)] = row
    return {'schema_version': 1, 'method_revision': 4, 'generated_at': now.isoformat(), 'ranking_updated_at': index.get('updated_at'),
            'min_rating': MIN_RATING, 'days': 30,
            'samples': sorted(samples.values(), key=lambda r: (r['started_at'], r['match_id'], r['profile_id']), reverse=True)}


def main():
    data = ROOT/'site/data'
    reports = [json.loads(p.read_text(encoding='utf-8')) for p in [data/'report.json', *sorted((data/'profiles').glob('*/report.json'))] if p.exists()]
    index = json.loads((data/'players.json').read_text(encoding='utf-8'))
    target = data/'ranked-benchmarks.json'
    existing = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
    result = build(reports, index, existing=existing)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    temporary.replace(target)
    print(f"Benchmark observations: {len(result['samples'])} / players: {len({s['profile_id'] for s in result['samples']})}")


if __name__ == '__main__':
    main()
