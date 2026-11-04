#!/usr/bin/env python3
"""Summarize OBJECT JSON emitted by the optional census object trace.

This reconstructs the simulator's checksums only. Recorded per-object values
are unavailable; agreement with these sums does not establish correct replay.
"""
import argparse
import collections
import json


def checksum(rows):
    """Reconstruct count, action/timer sum and ID sum from traced live objects."""
    return {
        'word6_objects': len(rows),
        'word9_actions': sum((r['action_kind'] if r['action_kind'] is not None else -1) + r['action_state'] for r in rows) % 2**32,
        'word9_timers': sum(r['retarget_ms'] for r in rows) % 2**32,
        'word9_total': sum((r['action_kind'] if r['action_kind'] is not None else -1) + r['action_state'] + r['retarget_ms'] for r in rows) % 2**32,
        'word10_ids': sum(r['id'] for r in rows) % 2**32,
    }


def summarize(lines):
    groups = collections.defaultdict(list)
    for line in lines:
        if line.startswith('OBJECT '):
            row = json.loads(line[len('OBJECT '):])
            groups[row['tick'], row['player']].append(row)
    result = []
    previous = {}
    for (tick, player), rows in sorted(groups.items()):
        prior = previous.get(player, {})
        current = {r['id']: r for r in rows}
        result.append({
            'tick': tick, 'player': player, **checksum(rows),
            'added_ids': sorted(current.keys() - prior.keys()) if prior else [],
            'removed_ids': sorted(prior.keys() - current.keys()),
            'timer_changes': [{'id': r['id'], 'master': r['master'], 'before': prior[r['id']]['retarget_ms'], 'after': r['retarget_ms']}
                              for r in rows if r['id'] in prior and r['retarget_ms'] != prior[r['id']]['retarget_ms']],
        })
        previous[player] = current
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('trace')
    args = parser.parse_args()
    with open(args.trace) as f:
        print(json.dumps(summarize(f), indent=2))
