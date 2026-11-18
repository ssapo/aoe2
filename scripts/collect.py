"""Public match collector. Never publishes replays, chats, or credentials."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import io
import struct
import json
import os
from pathlib import Path
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MAX_DOWNLOAD = 64 * 1024 * 1024
MAX_REPLAY = 256 * 1024 * 1024
AGE_IDS = {101: '봉건', 102: '성주', 103: '왕정'}
ANALYSIS_REVISION = 32


def now():
    return datetime.now(timezone.utc).isoformat()


def profile_id(value):
    text = str(value).strip()
    if text.isdecimal() and 0 < int(text) < 2**63:
        return int(text)
    raise ValueError('게임 서버의 숫자 프로필 ID가 필요합니다. AoE2 Insights 사용자 ID와 다를 수 있습니다.')


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return default


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as h:
        json.dump(data, h, ensure_ascii=False, indent=2, allow_nan=False)
        h.write('\n')
        temporary = h.name
    os.replace(temporary, path)


def write_report(path, data):
    from review import enrich_report
    enrich_report(data)
    write_json(path, data)
    write_json(path.with_name('status.json'), {
        'schema_version': 1,
        'last_checked_at': data.get('last_checked_at'),
        'updated_at': data.get('updated_at'),
        'sync_error': data.get('sync_error'),
    })


def fetch(url, limit=MAX_DOWNLOAD):
    req = urllib.request.Request(url, headers={'User-Agent': 'ssapo-aoe2/1.0 (personal post-game analysis)'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                if response.headers.get('Content-Length') and int(response.headers['Content-Length']) > limit:
                    raise ValueError('응답 크기 제한 초과')
                body = response.read(limit + 1)
                if len(body) > limit:
                    raise ValueError('응답 크기 제한 초과')
                return body
        except (OSError, TimeoutError) as exc:
            if isinstance(exc, urllib.error.HTTPError) and exc.code not in {429, 500, 502, 503, 504}:
                raise
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def decode_replay(data):
    if data.startswith(b'\x1f\x8b'):
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as h:
            data = h.read(MAX_REPLAY + 1)
    elif data.startswith(b'PK\x03\x04'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = [m for m in archive.infolist() if m.filename.lower().endswith(('.aoe2record', '.mgz'))]
            if not entries or entries[0].file_size > MAX_REPLAY:
                raise ValueError('리플 압축파일 형식 또는 크기를 확인할 수 없습니다.')
            with archive.open(entries[0]) as h:
                data = h.read(MAX_REPLAY + 1)
    if len(data) > MAX_REPLAY or len(data) < 20 or data.lstrip().startswith((b'<', b'{')):
        raise ValueError('유효한 리플 파일이 아닙니다.')
    return data


def replay_urls(match, own_id):
    urls = sorted(match.get('matchurls', []), key=lambda u: u.get('profile_id') != own_id)
    candidates = [f'https://aoe.ms/replay/?gameId={int(match["id"])}&profileId={own_id}']
    for entry in urls:
        url = entry.get('url', '')
        parsed = urllib.parse.urlparse(url)
        host = parsed.hostname or ''
        if parsed.scheme == 'https' and host.endswith('.blob.core.windows.net'):
            candidates.append(url)
    return candidates[:3]


def seconds(value):
    return round(value.total_seconds(), 2)


def command_metrics(match, target):
    """Commands are orders, never claimed as completed units or buildings."""
    events, ages, build_first, research_first = [], {}, {}, {}
    counts = Counter()
    for action in match.actions:
        if action.player is None or action.player.number != target.number:
            continue
        at = seconds(action.timestamp) + (seconds(match.restored_at) if getattr(match, 'restored_at', None) else 0)
        kind = action.type.name
        payload = action.payload
        label = None
        if kind == 'RESEARCH':
            label = payload.get('technology') or f'Technology {payload.get("technology_id", "?")}'
            research_first.setdefault(str(label), at)
            age = AGE_IDS.get(payload.get('technology_id'))
            if age:
                ages.setdefault(age, at)
        elif kind == 'BUILD':
            label = payload.get('building') or f'Building {payload.get("building_id", "?")}'
            build_first.setdefault(str(label), at)
        elif kind in {'QUEUE', 'DE_QUEUE', 'MULTIQUEUE'}:
            label = payload.get('unit')
        if label:
            counts[str(label)] += 1
            events.append({'seconds': at, 'kind': kind, 'label': str(label)})
    return {
        'age_commands': ages,
        'first_build_commands': build_first,
        'first_research_commands': research_first,
        'command_counts': dict(counts.most_common(24)),
        'timeline': events[:100],
        'eapm': target.eapm,
    }


def coaching(own, opponents, players_count):
    cards = []
    # A timing difference is an observation, not proof of a mistake.
    if players_count == 2 and len(opponents) == 1:
        other = opponents[0]['metrics']
        for age in ('봉건', '성주', '왕정'):
            mine = own['age_commands'].get(age)
            theirs = other['age_commands'].get(age)
            if mine is None or theirs is None:
                continue
            delta = round(mine - theirs)
            if abs(delta) >= 20:
                later = delta > 0
                cards.append({
                    'kind': 'review' if later else 'strength',
                    'title': f'{age} 전환 명령이 상대보다 {abs(delta)}초 {"늦음" if later else "빠름"}',
                    'evidence': f'내 명령 {mine:.0f}초 · 상대 명령 {theirs:.0f}초. 실제 시대 도달 시간은 아님.',
                    'action': '직전 병력·업그레이드 투자를 확인하고 같은 빌드의 전환 명령 시점과 비교.' if later else '전환 직후 병력 생산·공격 명령 시점 확인.',
                    'confidence': '명령 기록 확인 · 전략 평가는 참고',
                })
    if not cards:
        cards.append({'kind': 'review', 'title': '시대 전환 비교 데이터 없음',
                      'evidence': '건설·생산·연구 명령 기록 제공.',
                      'action': '동일 문명·맵·빌드의 첫 군사 건물 및 시대 전환 명령 시점과 비교.',
                      'confidence': '명령 기록 기반'})
    return cards[:3]


FOOD_NAMES = {
    'livestock': {'Sheep', 'Goat', 'Turkey', 'Llama', 'Cow', 'Water Buffalo', 'Pig', 'Goose', 'Yak'},
    'hunt': {'Wild Boar', 'Boar', 'Javelina', 'Deer', 'Gazelle', 'Zebra', 'Ostrich', 'Ibex', 'Elephant', 'Rhinoceros', 'Wild Bactrian Camel'},
    'berries': {'Forage Bush', 'Fruit Bush', 'Berry Bush'},
}


def food_order_evidence(raw, match):
    """Explicit livestock-control and starting-villager target commands only.

    Do not use model.actions object_ids: upstream Inputs caches missing selections
    across players. Do not infer actors from an omitted/reused selection, count
    scout attacks, rally points, or claim kills/food collected.
    """
    from mgz import fast
    from mgz.fast.header import parse
    objects = {o.instance_id: o for o in match.gaia}
    for player in match.players:
        objects.update({o.instance_id: o for o in player.objects})
    workers = {p.number: {o.instance_id for o in p.objects if o.name == 'Villager'} for p in match.players}
    result = {p.number: {group: {'observed_targets': 0, 'first_seconds': None, 'species': [], 'evidence': 'explicit_starting_villager_order'} for group in FOOD_NAMES} for p in match.players}
    targets = {p.number: {group: {} for group in FOOD_NAMES} for p in match.players}
    controls = {p.number: {} for p in match.players}
    for p in match.players:
        result[p.number]['livestock_control'] = {'observed_targets': 0, 'first_seconds': None, 'species': [], 'evidence': 'explicit_livestock_control_order'}
    handle = io.BytesIO(raw)
    parse(handle)
    fast.meta(handle)
    timestamp = 0
    while True:
        try:
            kind, value = fast.operation(handle)
        except EOFError:
            break
        if kind is fast.Operation.SYNC:
            timestamp += value[0]
        elif kind is fast.Operation.ACTION:
            action, payload = value
            player_id = payload.get('player_id')
            if player_id not in workers:
                continue
            if action in (fast.Action.MOVE, fast.Action.ORDER, fast.Action.ADD_WAYPOINT):
                for iid in set(payload.get('object_ids') or []):
                    obj = objects.get(iid)
                    if obj and obj.name in FOOD_NAMES['livestock']:
                        controls[player_id].setdefault(iid, obj.name)
                        row = result[player_id]['livestock_control']
                        if row['first_seconds'] is None:
                            row['first_seconds'] = round(timestamp / 1000 + match.restored_at.total_seconds(), 2)
            if action is not fast.Action.ORDER:
                continue
            # Explicit source IDs only; no guess about compressed selections.
            if not workers[player_id].intersection(payload.get('object_ids') or []):
                continue
            obj = objects.get(payload.get('target_id'))
            if obj is None:
                continue
            for group, names in FOOD_NAMES.items():
                if obj.name not in names:
                    continue
                row = result[player_id][group]
                targets[player_id][group].setdefault(obj.instance_id, obj.name)
                if row['first_seconds'] is None:
                    row['first_seconds'] = round(timestamp / 1000 + match.restored_at.total_seconds(), 2)
                break
    for player_id, groups in targets.items():
        for group, seen in groups.items():
            result[player_id][group]['observed_targets'] = len(seen)
            result[player_id][group]['species'] = sorted(set(seen.values()))
    for player_id, seen in controls.items():
        result[player_id]['livestock_control']['observed_targets'] = len(seen)
        result[player_id]['livestock_control']['species'] = sorted(set(seen.values()))
    return result


def random_civ_flags(decoded):
    """Map profile_id -> True/False: was this player's civilization drawn at random.

    Read from the DE header's player entry: the four bytes right before civ_id (mgz reads
    them as the end of `dat_crc` and the `mp_game_version` byte and skips them):
    0 = picked a civilization, 1 = Random. Checked on 2026-11-16 against the user's own
    games: 520848973 (Arena, Chinese drawn at random with mutual random on) is 1, and his
    games with a picked civilization are 0, while `prefer_random` (the lobby setting) is
    on in some of those. Other values (2, 3 were seen) are not known and are left out,
    as is anything unreadable. The match-history API does not carry this."""
    try:
        from mgz.fast.header import decompress
        blob = decompress(io.BytesIO(decoded)).read()
    except Exception:
        return {}
    flags, at = {}, 0
    while len(flags) < 8:
        string = blob.find(b'\x60\x0a', at)       # the entry's ai_type string
        if string < 0:
            break
        at = string + 2
        for count in range(0, 81):                 # civ_id, custom civ count, that many civ ids
            civ_at = string - 4 * count - 8
            if civ_at < 13:
                break
            civ, listed = struct.unpack_from('<II', blob, civ_at)
            if listed != count or not 0 < civ < 100:
                continue
            p = string + 4 + struct.unpack_from('<H', blob, string + 2)[0] + 1
            names = 0
            while blob[p:p + 2] == b'\x60\x0a' and names < 3:   # ai_name, (censored name), name
                p += 4 + struct.unpack_from('<H', blob, p + 2)[0]
                names += 1
            if names < 2 or p + 8 > len(blob):
                break
            kind, profile = struct.unpack_from('<Ii', blob, p)
            choice = struct.unpack_from('<I', blob, civ_at - 4)[0]   # the four bytes right before civ_id
            if kind == 2 and profile > 0 and choice in (0, 1):
                flags[profile] = choice == 1
            break
    return flags


def analyze_replay(raw, own_id):
    from mgz.model import parse_match
    decoded = decode_replay(raw)
    match = parse_match(io.BytesIO(decoded))
    food = food_order_evidence(decoded, match)
    from berry import estimate_berry_switches
    berry = estimate_berry_switches(decoded, match)
    own = next((p for p in match.players if p.profile_id == own_id), None)
    if own is None:
        raise ValueError('리플에서 본인 프로필을 확인할 수 없습니다.')
    from mapview import building_map
    map_view = building_map(match, own)
    if map_view is not None:
        from movement import command_activity
        map_view['command_activity'] = command_activity(decoded, match, own, keep_ids=True)
    own_metrics = command_metrics(match, own)
    from details import detailed_metrics
    own_metrics.update(detailed_metrics(match, own))
    own_metrics['food_evidence'] = food.get(own.number)
    own_metrics['berry_switches'] = berry.get(own.number)
    randoms = random_civ_flags(decoded)
    try:
        from state_curve import state_curve
        curve = state_curve(decoded, match, own)
    except Exception:
        curve = None
    try:
        from housing import housing
        housed = housing(decoded, match, own)
    except Exception:
        housed = None
    try:
        from engine_income import engine_lines
        lines = engine_lines(decoded, match, own)
    except Exception:
        lines = None
    try:
        from engine_income import engine_income
        earned = engine_income(decoded, match, own, lines=lines) if lines else None
    except Exception:
        earned = None
    if map_view is not None:
        # Which units each command moved: engine object ids, inside the verified span only.
        try:
            from unit_kinds import label
            opponent = next(p for p in match.players if p.number != own.number)
            until = label(map_view['command_activity'], lines or [], own.number, opponent.number)
        except Exception:
            until = None
        for e in map_view['command_activity']:
            e.pop('ids', None)
        if until is not None:
            map_view['command_units_until'] = until
    opponents = [{'name': p.name, 'civilization': p.civilization, 'random_civ': randoms.get(p.profile_id), 'metrics': dict(command_metrics(match, p), **detailed_metrics(match, p), food_evidence=food.get(p.number), berry_switches=berry.get(p.number))}
                 for p in match.players if p.number != own.number and p not in (own.team or [])]
    return {
        'parser': 'mgz', 'analysis_revision': ANALYSIS_REVISION, 'duration_game_seconds': seconds(match.duration + match.restored_at),
        'civilization': own.civilization, 'random_civ': randoms.get(own.profile_id), 'map': match.map.name, 'map_view': map_view,
        'metrics': own_metrics, 'opponents': opponents, 'state_curve': curve, 'housing': housed, 'engine_income': earned, 'game_build': getattr(match, 'build_version', None),
        'insights': coaching(own_metrics, opponents, len(match.players)),
        'limitations': ['생산 지시량은 양수 amount의 합. 생산 완료·생존 수가 아니며 취소·자원 부족·인구 제한을 반영하지 않습니다. 건설·연구 명령도 실제 완료와 다를 수 있습니다.',
                        '시대 도달 시각은 시스템 알림이 있는 경우에만 표시합니다. 생산 지시량으로 실제 주민 수를 추정하지 않습니다.',
                        'TC 유휴시간, 교전 손실, 승패의 인과관계는 이 버전에서 계산하지 않습니다. 쌓아둔 자원 합과 오브젝트 수는 게임이 리플에 남긴 값(약 7~15초 간격)이며 유닛 종류별로 나뉘지 않습니다.',
                        '봉건 전 인구 막힘은 생산·건설 명령을 다시 돌린 추정입니다. 일꾼 위치, 주민 사망, 식량 부족으로 거절된 생산 요청을 정확히 알 수 없어 시작 시각이 주민 1명분(약 25초) 달라질 수 있습니다.'],
    }


# 경기 기록 API의 문명 번호(`getAvailableLeaderboards`의 `races`, 2026-11-13 확인). 리플·게임 데이터의
# 번호(aocref 데이터셋 100)와 다른 표다: 0~44는 영어 이름순, 그 뒤는 추가된 순서이고 53·54는 비어 있다.
# 이름은 리플 파서가 쓰는 표기에 맞춘다(API의 Indians → Hindustanis, Mayans → Maya).
API_CIVILIZATIONS = dict(enumerate(
    'Armenians Aztecs Bengalis Berbers Bohemians Britons Bulgarians Burgundians Burmese Byzantines Celts Chinese '
    'Cumans Dravidians Ethiopians Franks Georgians Goths Gurjaras Huns Incas Hindustanis Italians Japanese Khmer '
    'Koreans Lithuanians Magyars Malay Malians Maya Mongols Persians Poles Portuguese Romans Saracens Sicilians '
    'Slavs Spanish Tatars Teutons Turks Vietnamese Vikings Achaemenids Athenians Spartans Shu Wu Wei Jurchens '
    'Khitans'.split()))
API_CIVILIZATIONS.update({55: 'Macedonians', 56: 'Thracians', 57: 'Puru', 58: 'Muisca', 59: 'Mapuche', 60: 'Tupi',
                          61: 'Saxons', 62: 'Varangians', 63: 'Danes'})


def civilization_name(value):
    """Name for a match-history API civilization number. Not for replay civilization ids."""
    try:return API_CIVILIZATIONS.get(int(value), f'문명 ID {value}')
    except (TypeError,ValueError):return '문명 확인 전'


def api_civilizations(match):
    """profile_id -> API civilization number of one match-history entry.

    `matchhistorymember` wins: `matchhistoryreportresults` sometimes carries 0 for a player
    whose member entry has the real number (520386901, 519693265)."""
    found = {}
    for key in ('matchhistoryreportresults', 'matchhistorymember'):
        for p in match.get(key) or []:
            if p.get('civilization_id') is not None:
                found[int(p['profile_id'])] = p['civilization_id']
    return found


def replay_civilizations(row):
    """The parsed replay decides the civilizations of an analysed 1v1 row."""
    analysis, players = row.get('analysis'), row.get('players') or []
    if not analysis or not analysis.get('civilization'):
        return
    row['civilization'] = analysis['civilization']
    opponents = analysis.get('opponents') or []
    if len(players) != 2 or len(opponents) != 1 or sum(bool(p.get('is_self')) for p in players) != 1:
        return
    for p in players:
        name = analysis['civilization'] if p.get('is_self') else opponents[0].get('civilization')
        if name:
            p['civilization'] = name


def civ_choices(rows, own_id, budget):
    """Fill `civ_choice` ({profile id: drawn at random}) on stored rows, newest first.

    An analysis of revision 30 or later already holds the answer for a 1v1; any other row
    (an older analysis, or a featured player's match that is only listed) reads it from the
    replay header alone, which is cheap next to a full analysis. A replay that cannot be
    fetched or read is tried twice in all, then left without the field."""
    for row in sorted(rows, key=lambda m: m.get('started_at') or 0, reverse=True):
        if 'civ_choice' in row or row.get('civ_choice_tries', 0) >= 2:
            continue
        analysis = row.get('analysis') or {}
        players = row.get('players') or []
        own = next((p for p in players if p.get('is_self')), None)
        others = [p for p in players if not p.get('is_self')]
        opponents = analysis.get('opponents') or []
        if analysis.get('analysis_revision', 0) >= 30 and own and len(others) == 1 and len(opponents) == 1:
            pairs = [(own['profile_id'], analysis.get('random_civ')), (others[0]['profile_id'], opponents[0].get('random_civ'))]
            row['civ_choice'] = {str(int(pid)): flag for pid, flag in pairs if isinstance(flag, bool)}
            continue
        if not budget:
            continue
        budget -= 1
        try:
            flags = random_civ_flags(decode_replay(fetch(replay_urls({'id': row['id']}, own_id)[0])))
        except Exception:
            flags = None
        if flags:
            row['civ_choice'] = {str(pid): flag for pid, flag in flags.items()}
            row.pop('civ_choice_tries', None)
        else:
            row['civ_choice_tries'] = row.get('civ_choice_tries', 0) + 1


def metadata(match, own_id, aliases):
    results = match.get('matchhistoryreportresults', [])
    own = next((p for p in results if int(p['profile_id']) == own_id), None)
    if own is None:
        return None
    members = match.get('matchhistorymember', [])
    rating = next((p for p in members if int(p['profile_id']) == own_id), {})
    result = {1: 'win', 0: 'loss'}.get(own.get('resulttype'), 'unknown')
    civs = api_civilizations(match)
    start = {int(p['profile_id']): p['oldrating'] for p in members
             if isinstance(p.get('oldrating'), (int, float)) and not isinstance(p['oldrating'], bool) and p['oldrating'] > 0}
    return {
        'id': int(match['id']), 'started_at': match.get('startgametime'),
        'finished_at': match.get('completiontime'),
        'map': str(match.get('mapname', 'Unknown')).removesuffix('.rms'),
        'civilization': civilization_name(civs.get(own_id)),
        'result': result, 'rating_before': rating.get('oldrating'), 'rating_after': rating.get('newrating'),
        'match_type_id': match.get('matchtype_id'), 'players_count': len(results),
        'players': [{'profile_id': p['profile_id'], 'name': aliases.get(p['profile_id'], str(p['profile_id'])),
                     'is_self': int(p['profile_id']) == own_id, 'civilization': civilization_name(civs.get(int(p['profile_id'])))}
                    # Rating going into this match (API `oldrating`), only when the API gave one.
                    | ({'rating_before': start[int(p['profile_id'])]} if int(p['profile_id']) in start else {}) for p in results],
        'analysis_status': 'pending', 'analysis': None, 'attempts': 0,
        'source_url': f'https://www.aoe2insights.com/match/{int(match["id"])}/',
    }


def has_time():
    """False once the run's analysis deadline (AOE2_ANALYSIS_DEADLINE, unix seconds) has passed: the
    matches left are analysed or brought up to date in a later run, so the workflow stays inside its time limit."""
    deadline = os.environ.get('AOE2_ANALYSIS_DEADLINE')
    try:
        return not deadline or time.time() < float(deadline)
    except ValueError:
        return True


def upgrade_analysis(row, existing, match, own_id):
    """Retry an outdated successful analysis without discarding it on failure."""
    state = existing.get('analysis_upgrade', {})
    attempts = state.get('attempts', 0) if state.get('revision') == ANALYSIS_REVISION else 0
    if attempts >= 3:
        return False
    row['analysis_upgrade'] = {'revision': ANALYSIS_REVISION, 'attempts': attempts + 1}
    for url in replay_urls(match, own_id):
        try:
            analysis = analyze_replay(fetch(url), own_id)
        except Exception:
            continue
        row['analysis'] = analysis
        row.pop('analysis_upgrade', None)
        break
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile-id', default='')
    parser.add_argument('--limit', type=int, default=5)
    parser.add_argument('--header-limit', type=int, default=4,
                        help='stored matches per run whose replay header is read for the civ choice (0-60)')
    parser.add_argument('--replay', help='개발·검증용 로컬 리플 경로')
    parser.add_argument('--output', type=Path, default=ROOT / 'site/data/report.json')
    args = parser.parse_args()
    previous = read_json(args.output, {})
    config = read_json(ROOT / 'config.json', {})
    selected = args.profile_id or config.get('profile_id')
    if not selected:
        print('프로필 미설정: config.json 또는 AOE2_PROFILE_ID를 설정하세요. 네트워크 요청 없음.')
        return
    own_id = profile_id(selected)
    if args.replay:
        write_json(args.output, analyze_replay(Path(args.replay).read_bytes(), own_id))
        return
    checked_at = now()
    endpoint = 'https://aoe-api.worldsedgelink.com/community/leaderboard/getRecentMatchHistory?'
    endpoint += urllib.parse.urlencode({'title': 'age2', 'profile_ids': json.dumps([own_id])})
    try:
        payload = json.loads(fetch(endpoint, 10 * 1024 * 1024))
        if payload.get('result', {}).get('code') != 0 or not isinstance(payload.get('matchHistoryStats'), list):
            raise ValueError('경기 기록 API 응답을 확인할 수 없습니다.')
    except Exception:
        # Preserve successful data and its timestamp on any remote error.
        previous['last_checked_at'] = checked_at
        previous['sync_error'] = '경기 기록을 가져오지 못했습니다. 기존 분석 결과를 유지했습니다.'
        write_report(args.output, previous)
        raise
    aliases = {p['profile_id']: p.get('alias', str(p['profile_id'])) for p in payload.get('profiles', [])}
    same_profile = (previous.get('profile') or {}).get('id') == own_id
    old = {m['id']: m for m in previous.get('matches', [])} if same_profile else {}
    pending = sorted(payload['matchHistoryStats'], key=lambda m: m.get('startgametime', 0), reverse=True)
    budget = max(0, min(args.limit, 10))
    listed = set()
    for match in pending:
        if config.get('only_1v1') and len(match.get('matchhistoryreportresults', [])) != 2:
            continue
        if not match.get('completiontime'):
            continue
        row = metadata(match, own_id, aliases)
        if row is None:
            continue
        existing = old.get(row['id'], {})
        for key in ('civ_choice', 'civ_choice_tries'):
            if key in existing:
                row[key] = existing[key]
        if existing.get('analysis_status') == 'complete':
            # Keep analysis, but refresh finalized outcome and rating.
            row.update({k: existing[k] for k in ('analysis', 'analysis_status', 'attempts', 'analysis_upgrade') if k in existing})
            if budget and has_time() and (existing.get('analysis') or {}).get('analysis_revision', 0) < ANALYSIS_REVISION:
                if upgrade_analysis(row, existing, match, own_id):
                    budget -= 1
        elif budget and has_time() and existing.get('attempts', 0) < 3:
            budget -= 1
            row['attempts'] = existing.get('attempts', 0) + 1
            row['analysis_status'] = 'unavailable'
            for url in replay_urls(match, own_id):
                try:
                    raw = fetch(url)
                except Exception:
                    continue
                try:
                    row['analysis'] = analyze_replay(raw, own_id)
                    row['analysis_status'] = 'complete'
                    break
                except Exception:
                    row['analysis_status'] = 'parser_error'
            row['analysis_note'] = {'complete': '명령 기록 분석 완료', 'unavailable': '공개 리플을 확보하지 못했습니다.',
                                    'parser_error': '리플 형식이 현재 파서와 호환되지 않거나 분석에 실패했습니다.'}[row['analysis_status']]
        else:
            row.update({k: existing[k] for k in ('analysis_status', 'attempts', 'analysis_note') if k in existing})
        if row.get('analysis'):
            row['map'] = row['analysis']['map']
        old[row['id']] = row
        listed.add(row['id'])
    # Kept rows the API no longer lists: their replay is asked for by match id alone, so an
    # outdated analysis is brought up to date with what is left of this run's budget, newest first.
    for row in sorted(old.values(), key=lambda m: m.get('started_at') or 0, reverse=True):
        if not budget or not has_time():
            break
        if row['id'] in listed or row.get('analysis_status') != 'complete':
            continue
        if (row.get('analysis') or {}).get('analysis_revision', 0) >= ANALYSIS_REVISION:
            continue
        if upgrade_analysis(row, row, {'id': row['id']}, own_id):
            budget -= 1
            if row.get('analysis'):
                row['map'] = row['analysis'].get('map', row.get('map'))
    civ_choices(old.values(), own_id, max(0, min(args.header_limit, 60)))
    for row in old.values():
        # Also repairs kept rows that the API no longer lists.
        replay_civilizations(row)
    output = {
        'schema_version': 1, 'updated_at': now(), 'last_checked_at': checked_at, 'sync_error': None,
        'profile': {'id': own_id, 'insights_user_id': config.get('insights_user_id') if own_id == config.get('profile_id') else None, 'name': aliases.get(own_id, str(own_id))},
        'matches': sorted([m for m in old.values() if not config.get('only_1v1') or m.get('players_count') == 2], key=lambda m: m.get('started_at') or 0, reverse=True)[:200],
    }
    write_report(args.output, output)
    print(f'수집 완료: {len(output["matches"])}경기 / 분석 완료 {sum(m["analysis_status"] == "complete" for m in output["matches"])}경기')


if __name__ == '__main__':
    main()
