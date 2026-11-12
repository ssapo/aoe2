from types import SimpleNamespace as O
from unittest import TestCase
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import births as B
import housing as H

# A made-up start (no game data): player 1 owns a Town Center (id 3010), the Town Center object
# that is only there at the start (3011), two villagers (3020, 3021) and a pig (3531); pigs
# 3540..3543 belong to nobody; the highest id in the header is 5000.
S = 3010 + 3011 + 3020 + 3021 + 3531      # id sum of player 1's list at the start
HERD = {3531, 3540, 3541, 3542, 3543}


def obj(iid, name, class_id=70, object_id=None):
    return O(instance_id=iid, name=name, class_id=class_id, object_id=object_id, position=O(x=20.0, y=20.0))


def match():
    own = [obj(3010, 'Town Center', 80, 109), obj(3011, None, 80, 890), obj(3020, 'Villager'),
           obj(3021, 'Villager'), obj(3531, 'Pig'), obj(5000, 'Flare', 10, 332)]
    gaia = [obj(3540 + i, 'Pig') for i in range(4)] + [obj(50, 'Gold Mine', 10)]
    return O(gaia=gaia, players=[O(number=1, objects=own, position=O(x=20.0, y=20.0))])


def counter():
    return B.Counter(5000, {1: (5, S, {3531}, {3011})}, HERD)


class SolveTests(TestCase):
    def test_new_object_has_an_id_above_the_highest(self):
        c = counter()
        self.assertEqual(c.step({1: (6, S + 5003)}), {1: 1})
        self.assertEqual(c.top, 5003)
        self.assertEqual(c.step({1: (6, S + 5003)}), {1: 0})                       # nothing changed
        self.assertEqual(c.step({1: (8, S + 5003 + 5004 + 5006)}), {1: 2})

    def test_herd_animal_taken_or_eaten_is_not_new(self):
        c = counter()
        self.assertEqual(c.step({1: (7, S + 3540 + 3542)}), {1: 0})                # two pigs taken over
        self.assertEqual(c.state[1]['own'], {3531, 3540, 3542})
        self.assertEqual(c.step({1: (6, S + 3540 + 3542 - 3531)}), {1: 0})         # the first pig is eaten
        # one more eaten, one taken and a unit born between two checkpoints
        self.assertEqual(c.step({1: (7, S + 3542 - 3531 + 3543 + 5001)}), {1: 1})

    def test_start_only_object_may_be_gone_at_the_first_checkpoint(self):
        c = counter()
        self.assertEqual(c.step({1: (5, S - 3011 + 5001)}), {1: 1})                # it left, a foundation came
        # later only herd animals leave: the Town Center's id going is not explained
        self.assertEqual(c.step({1: (4, S - 3011 + 5001 - 3010)}), {1: None})

    def test_projectile_with_a_negative_id_is_not_new(self):
        c = counter()
        self.assertEqual(c.step({1: (6, S - 7)}), {1: 0})                          # a hunter's arrow flies
        self.assertEqual(c.step({1: (6, S + 5002)}), {1: 1})                       # it is gone, a unit appeared
        self.assertEqual(c.step({1: (8, S + 5002 - 8 - 9)}), {1: 0})               # two fly

    def test_unexplained_change_is_not_counted(self):
        c = counter()
        self.assertEqual(c.step({1: (5, S)}), {1: 0})
        self.assertEqual(c.step({1: (5, S + 700)}), {1: None})                     # no id fits
        self.assertEqual(c.step({1: (6, S + 700 + 5005)}), {1: 1})                 # the next interval counts again

    def test_new_id_must_lie_in_the_window(self):
        self.assertEqual(B.solve(1, 5000 + B.WINDOW, 5000, set(), set()), {1: [((), (), 5000 + B.WINDOW)]})
        self.assertEqual(B.solve(1, 5000 + B.WINDOW + B.TEMP, 5000, set(), set()), {})
        self.assertEqual(B.solve(1, 5000 - B.TEMP, 5000, set(), set()), {})

    def test_two_explanations_with_different_counts_are_not_counted(self):
        # one new object (5040) while pig 3531 left ...
        self.assertEqual(sorted(B.solve(0, 5040 - 3531, 5000, set(), {3531})), [1])
        # ... or, if the object 5000 may leave as well, two new ones (5020 + 5020) while both left
        self.assertEqual(sorted(B.solve(0, 5040 - 3531, 5000, set(), {3531, 5000})), [1, 2])


class CountedTests(TestCase):
    def test_units_are_new_objects_minus_ordered_foundations(self):
        words = [(10000, {1: (5, S - 3011 + 5001)}),                    # start-only object gone, a house foundation
                 (20000, {1: (6, S - 3011 + 5001 + 5002)}),             # a villager
                 (30000, {1: (8, S - 3011 + 5001 + 5002 + 5003 + 5004)})]   # a villager and a lumber camp foundation
        orders = [(3.0, 1, 'BUILD', {'building_id': 70}, ''), (25.0, 1, 'BUILD', {'building_id': 562}, '')]
        got = B.counted(match(), words, orders, 0.0, H.LIVESTOCK)
        self.assertEqual(got[1], [(0.0, 10.0, 0, 0), (10.0, 20.0, 1, 1), (20.0, 30.0, 1, 1)])

    def test_order_at_the_checkpoint_time_belongs_to_the_next_interval(self):
        words = [(10000, {1: (5, S)}), (20000, {1: (6, S + 5001)})]
        orders = [(10.0, 1, 'BUILD', {'building_id': 70}, '')]
        self.assertEqual(B.counted(match(), words, orders, 0.0, H.LIVESTOCK)[1], [(0.0, 10.0, 0, 0), (10.0, 20.0, 0, 0)])

    def test_wall_lays_one_foundation_per_tile(self):
        words = [(10000, {1: (8, S + 5001 + 5002 + 5003)})]
        orders = [(3.0, 1, 'WALL', {'building_id': 72, 'x': 5, 'y': 5, 'x_end': 5, 'y_end': 7}, '')]
        self.assertEqual(B.counted(match(), words, orders, 0.0, H.LIVESTOCK)[1], [(0.0, 10.0, 0, 2)])

    def test_gate_and_missing_foundation_are_not_counted(self):
        words = [(10000, {1: (5, S)}), (20000, {1: (6, S + 5001)}), (30000, {1: (7, S + 5001 + 5002)})]
        orders = [(3.0, 1, 'BUILD', {'building_id': 70}, ''), (25.0, 1, 'BUILD', {'building_id': 792}, '')]
        got = B.counted(match(), words, orders, 0.0, H.LIVESTOCK)[1]
        self.assertEqual(got, [(0.0, 10.0, None, None), (10.0, 20.0, 1, 1), (20.0, 30.0, None, None)])

    def test_stops_after_until(self):
        words = [(10000, {1: (5, S)}), (20000, {1: (5, S)}), (30000, {1: (5, S)})]
        self.assertEqual(len(B.counted(match(), words, [], 0.0, H.LIVESTOCK, 15.0)[1]), 2)
