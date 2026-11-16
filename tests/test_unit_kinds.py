from pathlib import Path
from unittest import TestCase
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from unit_kinds import dump_env, kind_name, label, parse_lists, verified_ms  # noqa: E402

NAMES = {83: 'Villager', 259: 'Farmer', 118: 'Builder', 38: 'Knight', 448: 'Scout Cavalry', 1245: 'Pig'}


def cp(ms, player, same=True, word=1):
    rec = [0, 600, 6085, 20, 100, 0, 12, 91239, 1, 12605, 43005]
    eng = list(rec)
    if not same:
        eng[word] += 1
    return f'CPWORDS syncs=1 world_ms={ms} player={player} rec={rec} eng={eng}'


def unit(mark, player, id_, master):
    return f'UNIT mark_ms={mark} player={player} id={id_} master={master} pos=[1.0, 2.0, 0.0] action_kind=None'


class UnitKindsTests(TestCase):
    def test_dump_env_asks_for_every_object_list(self):
        env = dump_env()
        self.assertEqual(env['GENIE_DUMP_UNITS'], '1')
        marks = [int(m) for m in env['GENIE_DUMP_MS'].split(',')]
        self.assertEqual(marks[:2], [5000, 10000])
        self.assertGreaterEqual(marks[-1], 900000)

    def test_villager_tasks_are_villagers(self):
        self.assertEqual(kind_name(259, NAMES), 'Villager')
        self.assertEqual(kind_name(118, NAMES), 'Villager')
        self.assertEqual(kind_name(38, NAMES), 'Knight')
        self.assertEqual(kind_name(1245, NAMES), 'Livestock')
        self.assertEqual(kind_name(2590, NAMES), 'Livestock')
        self.assertIsNone(kind_name(9999, NAMES))

    def test_lists_skip_gaia(self):
        marks, lists = parse_lists([unit(5000, 0, 1, 594), unit(5000, 1, 10, 83), unit(10000, 2, 11, 38)])
        self.assertEqual(marks, [5000, 10000])
        self.assertEqual(lists, [{10: 83}, {11: 38}])

    def test_verified_needs_stockpile_count_and_id_sum_for_both(self):
        lines = [cp(9000, 1), cp(9000, 2), cp(18000, 1), cp(18000, 2, same=False, word=10),
                 cp(27000, 1), cp(27000, 2)]
        self.assertEqual(verified_ms(lines, (1, 2)), 9000)    # a later match does not count again
        lines = [cp(9000, 1), cp(9000, 2), cp(18000, 1, same=False, word=6), cp(18000, 2)]
        self.assertEqual(verified_ms(lines, (1, 2)), 9000)
        lines = [cp(9000, 1), cp(9000, 2, same=False, word=7)]   # a word not looked at
        self.assertEqual(verified_ms(lines, (1, 2)), 9000)
        self.assertEqual(verified_ms([cp(9000, 1)], (1, 2)), 0)

    def test_commands_inside_the_verified_span_get_their_units(self):
        lines = [cp(9000, 1), cp(9000, 2), cp(30000, 1), cp(30000, 2), cp(40000, 1, same=False),
                 unit(5000, 1, 10, 83), unit(5000, 1, 11, 259), unit(5000, 2, 20, 448),
                 unit(10000, 1, 10, 83), unit(10000, 1, 11, 118), unit(10000, 1, 12, 38),
                 unit(10000, 2, 20, 448)]
        events = [
            {'seconds': 6.0, 'ids': (10, 11)},           # both villagers in the 5 s list
            {'seconds': 7.0, 'ids': (10, 12, 99)},       # 12 is in the next list, 99 in none
            {'seconds': 8.0, 'ids': (20,)},
            {'seconds': 9.0},                            # no selection known
            {'seconds': 35.0, 'ids': (10,)},             # past the verified 30 s
        ]
        until = label(events, lines, 1, 2, names=NAMES)
        self.assertEqual(until, 30.0)
        self.assertEqual(events[0]['units'], {'Villager': 2})
        self.assertEqual(events[1]['units'], {'Knight': 1, 'Villager': 1})
        self.assertEqual(events[1]['units_unknown'], 1)
        self.assertEqual(events[2]['units'], {'Scout Cavalry': 1})
        self.assertNotIn('units', events[3])
        self.assertNotIn('units', events[4])
        self.assertFalse(any('ids' in e for e in events))

    def test_nothing_without_engine_lists(self):
        events = [{'seconds': 1.0, 'ids': (10,)}]
        self.assertIsNone(label(events, [cp(9000, 1), cp(9000, 2)], 1, 2, names=NAMES))
        self.assertEqual(events, [{'seconds': 1.0}])
        events = [{'seconds': 1.0, 'ids': (10,)}]
        self.assertIsNone(label(events, [], 1, 2, names=NAMES))
        self.assertEqual(events, [{'seconds': 1.0}])
