"""Small, auditable RM 1v1 benchmark observations from already saved reports."""
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

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


def observation(match, analysis, side, player, rating):
    metrics = analysis['metrics'] if side == 0 else analysis['opponents'][0]['metrics']
    summary = analysis.get('review', {}).get('own' if side == 0 else 'opponent', {})
    if metrics.get('recording_restored') or not summary.get('available') or not summary.get('opening'):
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
    return {'match_id': match['id'], 'profile_id': player['profile_id'], 'name': player['name'],
            'rating': rating, 'started_at': match['started_at'], 'map': match['map'],
            'civilization': analysis.get('civilization') if side == 0 else analysis['opponents'][0].get('civilization'),
            'opening': summary['opening'], 'opening_label': summary['opening_label'],
            'ages': ages, 'checkpoints': checkpoints}


def build(reports, index, now=None, existing=None):
    now = now or datetime.now(timezone.utc)
    cutoff = now-timedelta(days=30)
    ranked = {p['id']: p for p in index.get('players', []) if finite(p.get('rating')) and p['rating'] >= MIN_RATING}
    samples = {}
    # Keep compact observations when a source report rolls out of its history.
    # Recheck eligibility and age on every build; newly parsed rows replace old ones.
    if (existing or {}).get('method_revision') == 1:
        for row in existing.get('samples', []):
            try:
                started = datetime.fromisoformat(row['started_at'])
                if row['profile_id'] in ranked and cutoff <= started <= now:
                    samples[(row['match_id'], row['profile_id'])] = {**row, 'rating': ranked[row['profile_id']]['rating']}
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
                if pid not in ranked:
                    continue
                row = observation(match, analysis, side, player, ranked[pid]['rating'])
                if row:
                    row['started_at'] = started.isoformat()
                    row['recording_profile_id'] = report['profile']['id']
                    samples[(match['id'], pid)] = row
    return {'schema_version': 1, 'method_revision': 1, 'generated_at': now.isoformat(), 'ranking_updated_at': index.get('updated_at'),
            'min_rating': MIN_RATING, 'days': 30,
            'samples': sorted(samples.values(), key=lambda r: (r['started_at'], r['match_id'], r['profile_id']), reverse=True)}


def main():
    data = ROOT/'site/data'
    reports = [json.loads(p.read_text()) for p in [data/'report.json', *sorted((data/'profiles').glob('*/report.json'))] if p.exists()]
    index = json.loads((data/'players.json').read_text())
    target = data/'ranked-benchmarks.json'
    existing = json.loads(target.read_text()) if target.exists() else None
    result = build(reports, index, existing=existing)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n')
    temporary.replace(target)
    print(f"Benchmark observations: {len(result['samples'])} / players: {len({s['profile_id'] for s in result['samples']})}")


if __name__ == '__main__':
    main()
