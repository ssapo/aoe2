import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from ranked_benchmarks import build, resource_mean, stage_at, tc_band
from collect_profiles import benchmark_target


class RankedBenchmarkTests(unittest.TestCase):
    def test_ranked_1v1_identity_age_and_duplicate_filters(self):
        now = datetime(2026, 11, 7, tzinfo=timezone.utc)
        metrics = {'full_timeline': [], 'age_checkpoints': {'봉건': {'reached_seconds': 500}}}
        summary = {'available': True, 'opening': 'scouts', 'opening_label': '정찰 기병', 'checkpoints': [{'seconds': 600, 'villager_requests': 25}]}
        match = {'id': 1, 'started_at': now.timestamp(), 'match_type_id': 6, 'players_count': 2, 'map': 'Arabia',
                 'players': [{'profile_id': 1, 'name': 'A', 'is_self': True}, {'profile_id': 2, 'name': 'B', 'is_self': False}],
                 'analysis': {'metrics': metrics, 'civilization': 'Franks', 'opponents': [{'metrics': metrics, 'civilization': 'Franks'}],
                              'review': {'own': summary, 'opponent': summary}, 'duration_game_seconds': 900}}
        report = {'profile': {'id': 1}, 'matches': [match]}
        index = {'players': [{'id': 1, 'rating': 2500}, {'id': 2, 'rating': 1999}]}
        result = build([report, copy.deepcopy(report)], index, now)
        self.assertEqual(len(result['samples']), 1)
        self.assertEqual(result['samples'][0]['profile_id'], 1)
        self.assertEqual(len(build([], index, now, existing=result)['samples']), 1)
        self.assertEqual(build([], {'players': []}, now, existing=result)['samples'], [])
        self.assertEqual(result['samples'][0]['checkpoints']['600']['villagers']['value'], 25)
        for changes in ({'match_type_id': 7}, {'players_count': 4}, {'started_at': '2026-09-01T00:00:00Z'}):
            changed = copy.deepcopy(report); changed['matches'][0].update(changes)
            self.assertEqual(build([changed], index, now)['samples'], [])
        changed = copy.deepcopy(report)
        changed['matches'][0]['analysis']['metrics']['recording_restored'] = True
        self.assertEqual(build([changed], index, now)['samples'], [])

    def test_resource_windows_require_coverage_and_correct_player_column(self):
        points = [[t, 500, 999, 1000, 888] for t in range(300, 601, 10)]
        self.assertEqual(resource_mean({'points': points}, 1, 300, 600), 1000)
        self.assertEqual(resource_mean({'points': points}, 0, 300, 600), 500)
        self.assertIsNone(resource_mean({'points': points[:10]+points[20:]}, 0, 300, 600))
        self.assertIsNone(resource_mean({'points': [[300, 2, 3], [300, 4, 5]]}, 0, 300, 600))

    def test_age_requires_notices_expansion_uses_commands_and_rotation_stays_small(self):
        m = {'age_commands': {'봉건': 400}, 'age_checkpoints': {}, 'full_timeline': [{'seconds': 700, 'kind': 'BUILD', 'label': 'Town Center'}]}
        self.assertIsNone(stage_at(m, 600))
        m['age_checkpoints']['봉건'] = {'reached_seconds': 530}
        self.assertEqual(stage_at(m, 600), '봉건')
        self.assertEqual(tc_band(m, 600), 'single')
        self.assertEqual(tc_band(m, 900), 'expansion')
        jobs = [benchmark_target(datetime.fromtimestamp(t, timezone.utc)) for t in (0, 1800, 3600)]
        self.assertEqual(len({j[0] for j in jobs}), 3)
        self.assertTrue(all(j[2] == 1 for j in jobs))
