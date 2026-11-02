"""Replay observations for review; never treats requests as living units."""
from collections import Counter
from datetime import timedelta

AGE_TECHS = {101: '봉건', 102: '성주', 103: '왕정'}
AGE_NOTICES = {'FEUDAL_AGE': '봉건', 'CASTLE_AGE': '성주', 'IMPERIAL_AGE': '왕정'}
QUEUE_TYPES = {'QUEUE', 'DE_QUEUE', 'MULTIQUEUE'}


def detailed_metrics(match, player):
    units, buildings, research, ages = {}, {}, {}, {}
    requested = Counter()
    queue_events, timeline = [], []
    unknown_units = set()
    market_events = []
    offset = getattr(match, 'restored_at', timedelta()).total_seconds()
    arrivals = {}
    for notice in getattr(match, 'uptimes', []):
        age = AGE_NOTICES.get(notice.age.name)
        if age and notice.player and notice.player.number == player.number:
            arrivals.setdefault(age, round(notice.timestamp.total_seconds(), 2))

    for action in match.actions:
        if action.player is None or action.player.number != player.number:
            continue
        at = round(action.timestamp.total_seconds() + offset, 2)
        kind, payload = action.type.name, action.payload
        label, row = None, None
        if kind in QUEUE_TYPES:
            label = str(payload.get('unit') or f'Unit {payload.get("unit_id", "?")}')
            amount = payload.get('amount')
            row = units.setdefault(label, {'first_seconds': at, 'last_seconds': at,
                                          'commands': 0, 'requested_amount': 0,
                                          'negative_amount': 0, 'unknown_amount_commands': 0})
            if isinstance(amount, int) and not isinstance(amount, bool):
                if amount > 0:
                    row['requested_amount'] += amount
                    requested[label] += amount
                    queue_events.append({'seconds': at, 'unit': label, 'amount': amount})
                elif amount < 0:
                    row['negative_amount'] += -amount
            else:
                row['unknown_amount_commands'] += 1
                unknown_units.add(label)
            timeline.append({'seconds': at, 'kind': 'QUEUE', 'label': label, 'amount': amount})
        elif kind in {'BUY', 'SELL'}:
            resource = {0: '식량', 1: '목재', 2: '돌'}.get(payload.get('resource_id'))
            amount = payload.get('amount')
            if resource and isinstance(amount, int) and not isinstance(amount, bool) and amount > 0:
                # mgz already normalizes trade lots to resource units; do not multiply by 100.
                event = {'seconds': at, 'kind': kind, 'label': resource, 'amount': amount}
                market_events.append(event)
                timeline.append(event.copy())
        elif kind in {'BUILD', 'RESEARCH'}:
            key, fallback = ('building', 'Building') if kind == 'BUILD' else ('technology', 'Technology')
            label = str(payload.get(key) or f'{fallback} {payload.get(key + "_id", "?")}')
            table = buildings if kind == 'BUILD' else research
            row = table.setdefault(label, {'first_seconds': at, 'last_seconds': at, 'commands': 0})
            event={'seconds': at, 'kind': kind, 'label': label}
            if kind=='BUILD':
                from mapview import point
                pos=point(getattr(action,'position',None),getattr(getattr(match,'map',None),'dimension',0))
                if pos:event.update(pos)
            timeline.append(event)
            age = AGE_TECHS.get(payload.get('technology_id')) if kind == 'RESEARCH' else None
            if age and age not in ages:
                recent = Counter()
                for event in queue_events:
                    if event['seconds'] >= at - 120:
                        recent[event['unit']] += event['amount']
                ages[age] = {'command_seconds': at,
                             'unit_requests_before_click': dict(requested),
                             'unit_requests_previous_120s': dict(recent),
                             'research_commands_before_click': {
                                 k: v['first_seconds'] for k, v in research.items()
                                 if k != label and k not in {'Feudal Age', 'Castle Age', 'Imperial Age'}},
                             'market_previous_120s': [e.copy() for e in market_events if at-120 <= e['seconds'] <= at],
                             'villagers_alive': None,
                             'unknown_unit_request_amounts': sorted(unknown_units)}
        if row is not None:
            row['commands'] += 1
            row['last_seconds'] = at

    for age, at in arrivals.items():
        ages.setdefault(age, {'villagers_alive': None})['reached_seconds'] = at
    return {'market': {'events': market_events, 'basis': 'recorded_requests_resource_units'}, 'age_checkpoints': ages, 'unit_orders': units, 'building_orders': buildings,
            'research_orders': research, 'full_timeline': timeline,
            'recording_restored': bool(getattr(match, 'restored', False)),
            'villager_count_source': 'unavailable_without_game_state',
            'quantity_basis': 'sum_positive_command_amount_not_completed_or_alive'}
