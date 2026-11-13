import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from engine_income import by_source, income, parse_gains, parse_output, run_engine  # noqa: E402


def res(ms, player, values):
    return 'RES {"ms":%d,"player":%d,"res":%s}' % (ms, player, list(values))


def gain(ms, player, food, gold=(0, 0)):
    names = ('sheep', 'boar', 'deer', 'berries', 'farm', 'fish', 'other')
    return 'GAIN ' + __import__('json').dumps({
        'ms': ms, 'p': player, 'food': dict(zip(names, food)), 'wood': 0.0,
        'gold': {'mine': gold[0], 'other': gold[1]}, 'stone': 0.0})


def cp(ms, player, rec, eng):
    words = lambda v: ', '.join(str(x) for x in [0, v, 0, 0, 0, 0, 0, 0, player, 0, 0])
    return f'CPWORDS syncs=1 world_ms={ms} player={player} rec=[{words(rec)}] eng=[{words(eng)}]'


class EngineIncomeTest(unittest.TestCase):
    def lines(self, last_ok=True):
        out = []
        for ms in range(0, 400001, 1000):
            out.append(res(ms, 1, [200 + ms / 1000, 200, 200, 100]))          # food rises 1 per second
            spent = 50 if ms >= 100000 else 0                                   # one spending is not income
            out.append(res(ms, 2, [200 - spent, 200 + 2 * ms / 1000, 200, 100]))
        for ms in (100000, 200000, 300000, 400000):
            out.append(cp(ms, 1, 700, 700))
            out.append(cp(ms, 2, 700, 700 if (last_ok or ms < 400000) else 701))
        return out

    def test_income_is_the_sum_of_increases_up_to_the_last_matching_checkpoint(self):
        r = income(self.lines(), 1, 2)
        self.assertEqual(r['verified_until_seconds'], 400.0)
        self.assertEqual(r['own_total'], [400, 0, 0, 0])
        self.assertEqual(r['opponent_total'], [0, 800, 0, 0])
        self.assertEqual(r['points'][10], [100.0, 100, 0, 0, 0, 0, 200, 0, 0])

    def test_a_mismatching_checkpoint_ends_the_verified_span(self):
        r = income(self.lines(last_ok=False), 1, 2)
        self.assertEqual(r['verified_until_seconds'], 300.0)
        self.assertEqual(r['points'][-1][0], 300.0)

    def test_too_short_a_span_or_a_missing_player_gives_nothing(self):
        short = [l for l in self.lines() if 'CPWORDS' not in l] + [cp(100000, 1, 1, 1), cp(100000, 2, 1, 1)]
        self.assertIsNone(income(short, 1, 2))
        self.assertIsNone(income(self.lines(), 1, 3))
        self.assertEqual(parse_output(['noise', 'RES {bad'])[0], {})

    def gain_lines(self):
        out = []
        for ms in range(10010, 400011, 10000):                                  # printed just after each 10-s mark
            s = ms / 1000
            out.append(gain(ms, 1, [s, 0, 0, 2 * s, 0, 0, 0.4], (3, 0)))
            out.append(gain(ms, 2, [0, s, s, 0, 0, 0, 0], (0, 7.6)))
        return out

    def test_by_source_follows_the_marks_and_stops_at_the_verified_time(self):
        r = income(self.lines(last_ok=False) + self.gain_lines(), 1, 2)
        part = r['by_source']
        self.assertEqual(len(part['columns']), 19)
        self.assertEqual(part['columns'][1], 'own_sheep')
        self.assertEqual(part['columns'][18], 'opponent_gold_other')
        self.assertEqual(part['points'][0], [10.0, 10, 0, 0, 20, 0, 0, 0, 3, 0, 0, 10, 10, 0, 0, 0, 0, 0, 8])
        self.assertEqual(part['points'][-1][0], 290.0)                          # the line of mark 300 comes 10 ms past the cut
        self.assertEqual(part['points'][-1][1:5], [290, 0, 0, 580])
        self.assertEqual(r['points'][-1][0], 300.0)                             # the old fields are as before

    def test_without_gain_lines_the_by_source_part_is_absent(self):
        r = income(self.lines(), 1, 2)
        self.assertNotIn('by_source', r)
        self.assertEqual(sorted(r), ['columns', 'opponent_total', 'own_total', 'points', 'source', 'verified_until_seconds'])
        self.assertIsNone(by_source(self.gain_lines()[::2], 1, 2, 400000))      # one player only
        self.assertEqual(parse_gains(['GAIN {bad', 'GAIN {"ms":1,"p":1,"food":{}}', 'noise']), {})

    def test_by_source_applies_the_offset(self):
        part = by_source(self.gain_lines(), 1, 2, 25000, offset=1.5)
        self.assertEqual([p[0] for p in part['points']], [11.5, 21.5])

    def test_another_game_build_is_not_run(self):
        from types import SimpleNamespace as N
        from datetime import timedelta
        import engine_income as e
        own=N(number=1);match=N(players=[own,N(number=2)],restored_at=timedelta(0),build_version=185872)
        called=[];old=e.run_engine;e.run_engine=lambda r:called.append(1) or []
        try:
            self.assertIsNone(e.engine_income(b'',match,own));self.assertEqual(called,[])
            match.build_version=e.ENGINE_BUILD;e.engine_income(b'',match,own);self.assertEqual(called,[1])
        finally:e.run_engine=old

    def test_without_the_engine_nothing_runs(self):
        import os
        old = {k: os.environ.pop(k, None) for k in ('AOE2_ENGINE_BIN', 'AOE2_ENGINE_DATA')}
        try:
            self.assertIsNone(run_engine(b'x' * 32))
        finally:
            for k, v in old.items():
                if v is not None:
                    os.environ[k] = v


if __name__ == '__main__':
    unittest.main()
