import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from engine_income import income, parse_output, run_engine  # noqa: E402


def res(ms, player, values):
    return 'RES {"ms":%d,"player":%d,"res":%s}' % (ms, player, list(values))


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
