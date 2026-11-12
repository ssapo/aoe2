import math
from unittest import TestCase
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import foundations as F
import housing as H
sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_housing import player, queue, build

# Made-up lists (no game data). A living unit or finished building has state 2, a foundation 0,
# a projectile that has hit 8, a dying unit 4.
ALIVE = 5                                   # objects of state 2 in the list


def row(t, foundations=0, others=()):
    return (t, ALIVE + foundations + len(others), 2 * ALIVE + sum(others))


class PendingTests(TestCase):
    def test_foundations_are_the_objects_without_state(self):
        self.assertEqual(F.pending(5, 10), 0)
        self.assertEqual(F.pending(7, 10), 2)
        self.assertEqual(F.pending(8, 16), 0)        # three units born since: no foundation

    def test_other_states_hide_the_count(self):
        self.assertIsNone(F.pending(6, 15))          # a projectile of state 5: odd
        self.assertIsNone(F.pending(6, 18))          # one of state 8: below zero


class FinishedTests(TestCase):
    def test_finish_lies_between_the_checkpoints_that_show_it(self):
        rows = [row(6.5), row(13, 1), row(19.5, 1), row(26, 0), row(32.5, 0)]
        self.assertEqual(F.finished(rows, [(8.0, 1, 1)]), ([(19.5, 26)], 32.5))

    def test_two_foundations_two_finishes(self):
        rows = [row(6.5, 2), row(13, 1), row(19.5, 1), row(26, 0)]
        found, until = F.finished(rows, [(3.0, 1, 1), (4.0, 1, 1)])
        self.assertEqual(found, [(6.5, 13), (19.5, 26)])
        self.assertEqual(until, 26)

    def test_finished_and_ordered_in_one_interval(self):
        rows = [row(6.5, 1), row(13, 1)]             # the first is done, the second laid
        self.assertEqual(F.finished(rows, [(3.0, 1, 1), (9.0, 1, 1)])[0], [(6.5, 13)])

    def test_hidden_checkpoint_widens_the_span(self):
        rows = [row(6.5, 1), row(13, 1, (5,)), row(19.5, 0)]
        self.assertEqual(F.finished(rows, [(3.0, 1, 1)])[0], [(6.5, 19.5)])

    def test_checkpoint_that_read_too_low_is_thrown_out(self):
        # two foundations and a dying unit (state 4) read as one foundation; when it is gone
        # there are two again and nothing was ordered: the reading at 13 was wrong
        rows = [row(6.5, 2), row(13, 2, (4,)), row(19.5, 2), row(26, 1)]
        self.assertEqual(F.pending(*rows[1][1:]), 1)
        self.assertEqual(F.finished(rows, [(3.0, 1, 1), (4.0, 1, 1)])[0], [(19.5, 26)])

    def test_wall_line_lays_as_many_as_show(self):
        rows = [row(6.5, 3), row(13, 2)]
        self.assertEqual(F.finished(rows, [(3.0, 1, 5)])[0], [(6.5, 13)])

    def test_foundation_without_an_order_ends_what_is_known(self):
        rows = [row(6.5, 1), row(13, 0), row(19.5, 2), row(26, 0)]
        self.assertEqual(F.finished(rows, [(3.0, 1, 1)]), ([], 0.0))
        rows = [row(6.5, 0), row(13, 1), row(19.5, 0)]
        self.assertEqual(F.finished(rows, []), ([], 0.0))


class AssignTests(TestCase):
    def test_finish_goes_to_the_nearest_estimate(self):
        sites = [(3.0, 30.0), (4.0, 50.0), (60.0, 90.0)]
        spans = F.assign(sites, [(26, 32.5), (52, 58.5)], 100.0)
        self.assertEqual(spans, {0: (26, 32.5), 1: (52, 58.5), 2: (100.0, math.inf)})

    def test_building_ordered_after_the_finish_cannot_take_it(self):
        spans = F.assign([(3.0, 70.0), (40.0, 35.0)], [(26, 32.5)], 100.0)
        self.assertEqual(spans, {0: (26, 32.5), 1: (100.0, math.inf)})

    def test_building_the_estimate_never_finishes_takes_a_finish_left_over(self):
        spans = F.assign([(3.0, 30.0), (10.0, None)], [(26, 32.5), (52, 58.5)], 100.0)
        self.assertEqual(spans, {0: (26, 32.5), 1: (52, 58.5)})

    def test_building_ordered_after_what_is_known_keeps_its_estimate(self):
        self.assertEqual(F.assign([(120.0, 150.0)], [], 100.0), {})

    def test_birth_that_needed_the_house_moves_it_before_another_building(self):
        sites = [(3.0, 30.0), (4.0, 50.0)]           # a mill, then the house, by the estimate
        spans = F.assign(sites, [(26, 32.5), (52, 58.5)], 100.0)
        self.assertEqual(F.narrow(spans, sites, {1}, [45.0]), {0: (52, 58.5), 1: (26, 32.5)})
        self.assertEqual(F.narrow(spans, sites, {1}, [55.0]), {0: (26, 32.5), 1: (52, 55.0)})
        self.assertEqual(F.narrow(spans, sites, {1}, [80.0]), spans)


class HouseTimeTests(TestCase):
    # 4 pop / cap 5; the house ordered at 40 is, by the estimate, done at 66.875 (test_housing).
    orders = [queue(0, 3), build(40, [20], 22.0, 23.0)]

    def cap_10(self, lists):
        r = H.player_housing(self.orders, player(), 'Franks', 200, lists=lists)
        return next(t for t, _, cap in r['timeline'] if cap == 10), r

    def test_estimate_is_moved_into_the_interval_the_checkpoints_show(self):
        late = [row(t, 1 if 40 < t < 75 else 0) for t in (13, 26, 39, 45.5, 52, 58.5, 65, 71.5, 78, 84.5)]
        at, r = self.cap_10(late)
        self.assertEqual(at, 71.5)                                   # not before the last foundation seen
        self.assertEqual(r['blocks'][0]['to_seconds'], 71.5)
        self.assertEqual(r['houses'], {'source': 'recording_checkpoints', 'counted': 1,
                                       'counted_until_seconds': 84.5, 'estimated': []})
        early = [row(t, 1 if 40 < t < 60 else 0) for t in (39, 45.5, 52, 58.5, 65, 71.5)]
        self.assertEqual(self.cap_10(early)[0], 65)                  # not after it was seen finished
        inside = [row(t, 1 if 40 < t < 66 else 0) for t in (39, 45.5, 52, 58.5, 65, 71.5)]
        self.assertAlmostEqual(self.cap_10(inside)[0], 66.875)       # the estimate, where it fits

    def test_without_checkpoints_the_estimate_stays(self):
        at, r = self.cap_10(None)
        self.assertAlmostEqual(at, 66.875)
        self.assertIsNone(r['houses'])

    def test_house_not_seen_finished_is_marked_estimated(self):
        # the checkpoints end at 52 with the foundation still there
        at, r = self.cap_10([row(39), row(45.5, 1), row(52, 1)])
        self.assertAlmostEqual(at, 66.875)
        self.assertEqual(r['houses']['counted'], 0)
        self.assertEqual(r['houses']['estimated'], [66.9])

    def test_house_nobody_was_seen_building_is_finished_where_the_checkpoints_say(self):
        orders = self.orders + [(41, 1, 'MOVE', {'object_ids': [20], 'x': 40.0, 'y': 40.0}, '')]
        rows = [row(39), row(45.5, 1), row(91, 1), row(97.5, 0), row(104, 0)]
        r = H.player_housing(orders, player(), 'Franks', 200, lists=rows)
        self.assertEqual(next(t for t, _, cap in r['timeline'] if cap == 10), 94.25)

    def test_wall_line_ends_the_reading(self):
        wall = (50, 1, 'WALL', {'object_ids': [21], 'x': 30.0, 'y': 30.0, 'x_end': 34.0, 'y_end': 30.0}, '')
        rows = [row(39), row(45.5, 1), row(52, 4), row(58.5, 3), row(65, 2), row(71.5, 1), row(78, 0)]
        r = H.player_housing(self.orders + [wall], player(), 'Franks', 200, lists=rows)
        self.assertAlmostEqual(next(t for t, _, cap in r['timeline'] if cap == 10), 66.875)
        self.assertEqual(r['houses']['counted'], 0)
        self.assertEqual(r['houses']['counted_until_seconds'], 45.5)

    def test_other_building_takes_its_own_finish(self):
        # a lumber camp (35 s, built by another villager) is seen finished before the house
        orders = [queue(0, 3), build(40, [20], 22.0, 23.0), build(20, [21], 22.0, 21.0, building=562)]
        orders.sort(key=lambda o: o[0])
        rows = [row(13), row(26, 1), row(39, 1), row(45.5, 2), row(52, 2), row(58.5, 1), row(65, 1),
                row(71.5, 1), row(78, 0)]
        r = H.player_housing(orders, player(), 'Franks', 200, lists=rows)
        self.assertEqual(next(t for t, _, cap in r['timeline'] if cap == 10), 71.5)
