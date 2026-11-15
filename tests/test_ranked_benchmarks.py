import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from ranked_benchmarks import build, food_sources, resource_mean, stage_at, tc_band
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


class FoodSampleTests(unittest.TestCase):
    @staticmethod
    def engine(until, own, opp, animals=None):
        points = [[float(t), *own, *opp] for t in range(10, int(until)+1, 10)]
        return {'verified_until_seconds': until, 'by_source': {'points': points}, **({'animals': animals} if animals else {})}

    def test_food_by_source_minutes_side_and_food_left(self):
        animals = {'until_seconds': 300, 'own': [{'kind': 'sheep', 'eaten': 80, 'full': 100, 'last_seconds': 200},
                                                {'kind': 'boar', 'eaten': 300, 'full': 400, 'last_seconds': 290},
                                                {'kind': 'deer', 'eaten': 100, 'last_seconds': 250}],
                   'opponent': [{'kind': 'sheep', 'eaten': 70, 'full': 100, 'last_seconds': 100}]}
        e = self.engine(305, [100, 50, 40, 30, 20, 2, 3, 0, 0], [10, 0, 0, 0, 0, 0, 0, 0, 0], animals)
        own, other = food_sources(e, 0), food_sources(e, 1)
        self.assertEqual(sorted(own['at'], key=int), ['60', '120', '180', '240', '300'])
        self.assertEqual(own['at']['300'], [100, 90, 30, 20, 5])
        self.assertEqual(own['left'], {'60': 0, '120': 0, '180': 0, '240': 20, '300': 120})
        self.assertEqual(other['at']['60'], [10, 0, 0, 0, 0])
        self.assertEqual(other['left']['120'], 30)
        self.assertEqual(own['until'], 305)
        # no `full` anywhere (older engine output): shares only
        self.assertNotIn('left', food_sources(self.engine(305, [1]*9, [0]*9, {'until_seconds': 300, 'own': [{'eaten': 5, 'last_seconds': 10}], 'opponent': []}), 0))
        self.assertIsNone(food_sources(None, 0))
        self.assertIsNone(food_sources(self.engine(50, [1]*9, [0]*9), 0))  # no whole minute inside the verified span
        self.assertIsNone(food_sources({'verified_until_seconds': 300, 'by_source': {'points': [[60.0, 1, 2]]}}, 0))
        # stops at 10:00
        self.assertEqual(max(map(int, food_sources(self.engine(900, [1]*9, [0]*9), 0)['at'])), 600)

    def test_samples_carry_food_and_revision_3_keeps_rows(self):
        now = datetime(2026, 11, 7, tzinfo=timezone.utc)
        metrics = {'full_timeline': [], 'age_checkpoints': {'봉건': {'reached_seconds': 500}}}
        summary = {'available': True, 'opening': 'scouts', 'opening_label': '스카웃', 'checkpoints': []}
        match = {'id': 1, 'started_at': now.timestamp(), 'match_type_id': 6, 'players_count': 2, 'map': 'Arabia',
                 'players': [{'profile_id': 1, 'name': 'A', 'is_self': True}, {'profile_id': 2, 'name': 'B', 'is_self': False}],
                 'analysis': {'metrics': metrics, 'civilization': 'Franks', 'opponents': [{'metrics': metrics, 'civilization': 'Celts'}],
                              'review': {'own': summary, 'opponent': summary}, 'duration_game_seconds': 900,
                              'engine_income': self.engine(130, [5, 0, 0, 0, 0, 0, 0, 0, 0], [7, 0, 0, 0, 0, 0, 0, 0, 0])}}
        index = {'players': [{'id': 1, 'rating': 2500}, {'id': 2, 'rating': 2400}]}
        result = build([{'profile': {'id': 1}, 'matches': [match]}], index, now)
        self.assertEqual(result['method_revision'], 3)
        rows = {r['profile_id']: r for r in result['samples']}
        self.assertEqual(rows[1]['food']['at']['120'], [5, 0, 0, 0, 0])
        self.assertEqual(rows[2]['food']['at']['120'], [7, 0, 0, 0, 0])
        kept = build([], index, now, existing=result)['samples']
        self.assertEqual(len(kept), 2)
        self.assertIn('food', kept[0])
        older = {**result, 'method_revision': 2, 'samples': [{k: v for k, v in r.items() if k != 'food'} for r in result['samples']]}
        self.assertEqual(len(build([], index, now, existing=older)['samples']), 2)
        no_engine = copy.deepcopy(match); no_engine['analysis'].pop('engine_income')
        self.assertTrue(all('food' not in r for r in build([{'profile': {'id': 1}, 'matches': [no_engine]}], index, now)['samples']))
