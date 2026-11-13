"""Opening development inferred from early investments, separately from first unit.

Labels describe order sequences, not attack/defence intent or units alive.
Keep site/opening.js in parity; tests share the same scenario fixtures.
"""
import math

FAMILIES = {
    'Scout Cavalry': 'scouts', 'Camel Scout': 'scouts', 'Archer': 'archers',
    'Militia': 'militia', 'Man-at-Arms': 'militia',
    'Eagle Scout': 'eagles', 'Eagle Warrior': 'eagles',
    'Spearman': 'spears', 'Skirmisher': 'skirmishers',
    'Knight': 'knights', 'Camel Rider': 'camels', 'Cavalry Archer': 'cavalry_archers',
}
LABELS = {'scouts': '스카웃', 'archers': '궁사', 'militia': '시민군', 'eagles': '독수리 전사',
          'spears': '창병', 'skirmishers': '척후병', 'knights': '기사', 'camels': '낙타', 'cavalry_archers': '궁기병'}
BUILDINGS = {'scouts': 'Stable', 'archers': 'Archery Range', 'eagles': 'Barracks', 'militia': 'Barracks'}


def finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0


def classify(metrics, duration):
    empty = {'opening': None, 'opening_label': None, 'opening_revision': 2,
             'opening_basis': 'early_production_sequence_buildings_research'}
    timeline = metrics.get('full_timeline')
    if not isinstance(timeline, list) or metrics.get('recording_restored'):
        return empty
    timeline = sorted((e for e in timeline if finite(e.get('seconds')) and e['seconds'] <= duration), key=lambda e: e['seconds'])
    def reached(age):
        return (metrics.get('age_checkpoints', {}).get(age) or {}).get('reached_seconds')
    feudal, castle = reached('봉건'), reached('성주')
    feudal_anchor = feudal if finite(feudal) else metrics.get('age_commands', {}).get('봉건', 600)
    if not finite(feudal_anchor):
        feudal_anchor = 600
    end = min(duration, feudal_anchor+300, castle if finite(castle) else duration)
    orders = [e for e in timeline if e.get('kind') in {'QUEUE', 'DE_QUEUE', 'MULTIQUEUE'}
              and isinstance(e.get('amount'), int) and not isinstance(e['amount'], bool) and e['amount'] > 0 and e.get('label') in FAMILIES]
    def group(family, start=0, stop=end):
        events = [e for e in orders if FAMILIES[e['label']] == family and start <= e['seconds'] < stop]
        return events, sum(e['amount'] for e in events)
    def commitment(family):
        events, count = group(family)
        if count < 2:
            return None
        # A single early request is not a plan; require a second unit in the same 2-minute investment window.
        for i, event in enumerate(events):
            if sum(e['amount'] for e in events[i:] if e['seconds'] <= event['seconds']+120) >= 2:
                return event['seconds']
        return None
    mains = [(at, family) for family in ('scouts', 'archers', 'militia', 'eagles') if (at := commitment(family)) is not None]
    mains.sort()
    sequence = []
    def add(key, label=None):
        sequence.append((key, label or LABELS[key]))
    if mains:
        at, family = mains[0]
        # Several counter units BEFORE the main investment are a distinct development.
        # Later defensive additions never reclassify an established scout/archer opening.
        for support in ('spears', 'skirmishers'):
            events, count = group(support, stop=at)
            building_at = next((e['seconds'] for e in timeline if e.get('kind') == 'BUILD' and e.get('label') == BUILDINGS.get(family)), at)
            if count >= 3 and at-events[0]['seconds'] >= (60 if building_at >= events[0]['seconds'] else 90):
                add(support)
                break
        for at, family in mains[:2]:
            name = LABELS[family]
            if family == 'militia':
                maa = any(e.get('kind') == 'RESEARCH' and e.get('label') == 'Man-at-Arms' and e['seconds'] <= end for e in timeline)
                name = '무장 병사' if maa else '드러시' if finite(feudal) and at < feudal else '시민군'
                family = 'maa' if maa else 'drush' if name == '드러시' else family
            add(family, name)
    elif finite(castle) and castle <= duration:
        # No established Feudal army: show the Castle transition without calling it "fast".
        late = []
        for family in ('knights', 'camels', 'cavalry_archers', 'archers', 'eagles'):
            events, count = group(family, start=castle, stop=min(duration+1, castle+240))
            if count >= 2:
                late.append((events[0]['seconds'], family))
        if late:
            add('castle', '성주')
            add(min(late)[1])
    if not sequence:
        for support in ('spears', 'skirmishers'):
            _, count = group(support)
            if count >= 3:
                add(support, LABELS[support]+' 중심')
                break
    return {**empty, 'opening': '_then_'.join(k for k, _ in sequence) or None,
            'opening_label': ' → '.join(v for _, v in sequence) or None}
