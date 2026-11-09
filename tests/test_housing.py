from types import SimpleNamespace as O
from unittest import TestCase
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import housing as H


def obj(iid, name, x, y, class_id=70, object_id=None):
    return O(instance_id=iid, name=name, class_id=class_id, object_id=object_id, position=O(x=x, y=y))


def player(number=1, villagers=3, scout=True):
    objects = [obj(10, 'Town Center', 20, 20, 80, 109)]
    objects += [obj(20 + i, 'Villager', 22, 20 + i) for i in range(villagers)]
    if scout:
        objects.append(obj(30, 'Scout Cavalry', 25, 25))
    objects.append(obj(31, 'Pig', 21, 21))
    return O(number=number, objects=objects, position=O(x=20, y=20))


def queue(at, n=1, unit=83, building=10, player=1):
    return (at, player, 'DE_QUEUE', {'object_ids': [building], 'amount': n, 'unit_id': unit}, '')


def build(at, ids, x, y, building=70, flags='', player=1):
    return (at, player, 'BUILD', {'object_ids': ids, 'building_id': building, 'x': x, 'y': y}, flags)


class HousingTests(TestCase):
    def test_unit_waits_at_the_cap_until_a_house_is_done(self):
        # 4 pop / cap 5: the 5th villager trains, the 6th waits for the house.
        orders = [queue(0, 3), build(40, [20], 22.0, 23.0)]
        r = H.player_housing(orders, player(), 'Franks', 200)
        # house: walk (3 - 1.5) / 0.8 = 1.875 s, built alone in 25 s -> done at 66.875
        self.assertEqual(len(r['blocks']), 1)
        b = r['blocks'][0]
        self.assertEqual(b['from_seconds'], 25.0)
        self.assertEqual(b['to_seconds'], 66.8)            # 66.875, floored to a tenth
        self.assertEqual(b['population'], '5/5')
        self.assertEqual([row[1:] for row in r['timeline']][-1], (7, 10))

    def test_more_builders_finish_faster(self):
        one = H.player_housing([queue(0, 2), build(0, [20], 22.0, 23.0)], player(), 'Franks', 200)
        two = H.player_housing([queue(0, 2), build(0, [20, 21], 22.0, 23.0)], player(), 'Franks', 200)
        self.assertEqual(one['blocks'], [])
        self.assertEqual(two['blocks'], [])
        caps = lambda r: [t for t, _, cap in r['timeline'] if cap == 10]
        self.assertLess(caps(two)[0], caps(one)[0])

    def test_plain_order_takes_builder_off_but_queued_does_not(self):
        leave = [queue(0, 3), build(1, [20], 22.0, 23.0),
                 (5, 1, 'MOVE', {'object_ids': [20], 'x': 40.0, 'y': 40.0}, '')]
        stay = [queue(0, 3), build(1, [20], 22.0, 23.0),
                (5, 1, 'MOVE', {'object_ids': [20], 'x': 40.0, 'y': 40.0}, 'q')]
        r_leave = H.player_housing(leave, player(), 'Franks', 200)
        r_stay = H.player_housing(stay, player(), 'Franks', 200)
        self.assertEqual(r_leave['blocks'][0]['to_seconds'], 200.0)   # never finished
        self.assertEqual(r_stay['blocks'], [])                        # done by 27.9, before the 6th

    def test_plain_order_behind_a_queued_one_waits(self):
        orders = [queue(0, 3), build(1, [20], 22.0, 23.0),
                  (2, 1, 'ORDER', {'object_ids': [20], 'target_id': 999, 'x': 30.0, 'y': 30.0}, 'q'),
                  (3, 1, 'ORDER', {'object_ids': [20], 'target_id': 998, 'x': 31.0, 'y': 30.0}, '')]
        self.assertEqual(H.player_housing(orders, player(), 'Franks', 200)['blocks'], [])

    def test_click_on_foundation_puts_builder_back(self):
        orders = [queue(0, 3), build(1, [20], 22.0, 23.0),
                  (5, 1, 'MOVE', {'object_ids': [20], 'x': 22.0, 'y': 25.0}, ''),
                  (6, 1, 'ORDER', {'object_ids': [], 'target_id': 4000, 'x': 22.0, 'y': 23.0}, '')]
        r = H.player_housing(orders, player(), 'Franks', 200)
        self.assertEqual(r['blocks'], [])

    def test_feudal_window_and_huns(self):
        orders = [queue(0, 3)]
        self.assertIsNone(H.player_housing(orders, player(), 'Huns', 200))
        r = H.player_housing(orders, player(), 'Franks', 40)
        self.assertEqual(r['blocks'][0], {'from_seconds': 25.0, 'to_seconds': 40.0, 'seconds': 15.0, 'population': '5/5'})

    def test_start_without_town_center_is_left_out(self):
        p = player()
        p.objects = [o for o in p.objects if o.class_id != 80]
        self.assertIsNone(H.player_housing([queue(0, 3)], p, 'Britons', 200))
        self.assertIsNone(H.player_housing([queue(0, 3)], player(villagers=6), 'Britons', 200))

    def test_block_reads_population_after_the_birth_it_starts_at(self):
        # the 5th villager appears at 25.0 and the 6th waits from then: 5/5, not 4/5
        r = H.player_housing([queue(0, 2), queue(0.04, 1)], player(), 'Franks', 60)
        self.assertEqual(r['blocks'][0]['population'], '5/5')

    def test_cancelling_the_waiting_unit_ends_the_block_and_loom_runs(self):
        # 5th villager at 25; the 6th waits; at 40 it is given back (index 0), loom then runs.
        cancel = (40, 1, 'CANCEL', {'object_ids': [10], 'index': 0, 'batch': 1}, '')
        loom = (41, 1, 'RESEARCH', {'object_ids': [10], 'technology_id': H.LOOM}, '')
        r = H.player_housing([queue(0, 2), cancel, loom], player(), 'Franks', 120)
        self.assertEqual(r['blocks'], [{'from_seconds': 25.0, 'to_seconds': 40.0, 'seconds': 15.0, 'population': '5/5'}])
        self.assertEqual(r['timeline'][-1][1:], (5, 5))

    def test_cancel_index_counts_the_unit_being_made(self):
        p = H.Production(4, [(0.0, 50)])
        for _ in range(3):
            p.add(10, ('unit', 25.0, 83))
        p.advance(1)
        self.assertEqual(p.cancel(10, 1, 1), [('unit', 25.0, 83)])        # a queued one
        self.assertEqual(len(p.state[10]['q']), 1)
        self.assertEqual(p.cancel(10, 0, 1), [('unit', 25.0, 83)])        # the one being made
        self.assertEqual(p.in_training, 1)                                  # the last one started
        self.assertEqual(p.cancel(10, 5, 1), [])
        q = H.Production(4, [(0.0, 50)])
        for _ in range(7):
            q.add(10, ('unit', 25.0, 83))
        q.advance(1)
        self.assertEqual(len(q.cancel(10, 1, 5)), 5)                        # shift: up to five
        self.assertEqual(len(q.state[10]['q']), 1)

    def test_cancel_packet_bytes(self):
        # UNIT_ORDER from replay 519700670 at 6:06: the Town Center 4031 gives back unit 1.
        body = bytes.fromhex('02210001000000ffffffff0000000000000000ffffffff010000000400000100bf0f0000')
        self.assertEqual(H._cancel(body), {'object_ids': [4031], 'index': 1, 'batch': 1})
        garrison = bytearray(body); garrison[27] = 5
        self.assertIsNone(H._cancel(bytes(garrison)))

    def test_short_blocks_are_dropped(self):
        orders = [queue(0, 3)]
        r = H.player_housing(orders, player(), 'Franks', 25 + H.MIN_BLOCK - 1)
        self.assertEqual(r['blocks'], [])

    def test_civilization_bonuses(self):
        chinese = player(villagers=6)
        r = H.player_housing([queue(0, 9)], chinese, 'Chinese', 400)
        self.assertEqual(r['timeline'][0][1:], (7, 15))
        incas = H.player_housing([queue(0, 3), build(0, [20], 22.0, 23.0)], player(), 'Incas', 200)
        self.assertEqual(max(cap for _, _, cap in incas['timeline']), 15)
        persians = H.player_housing([queue(0, 1)], player(), 'Persians', 100)
        self.assertAlmostEqual(persians['timeline'][1][0], 25 / 1.05)

    def test_food_estimate_refuses_unaffordable_queue_orders(self):
        # 200 food: four villagers are paid, the fifth is refused until more is gathered.
        p = player()
        objects = {o.instance_id: (o.name, o.position.x, o.position.y) for o in p.objects}
        checkpoints = [(10.0, 500.0), (20.0, 500.0)]   # 700 start - 200 food spent, nothing gathered
        r = H.player_housing([queue(1, 5)], p, 'Franks', 30, checkpoints, objects)
        self.assertEqual(r['refused_queue'], 1)
        free = H.player_housing([queue(1, 5)], p, 'Franks', 30)
        self.assertEqual(free['refused_queue'], 0)

    def test_gathering_is_split_by_villager_tasks(self):
        p = player()
        objects = {o.instance_id: (o.name, o.position.x, o.position.y) for o in p.objects}
        objects[500] = ('Tree (Oak Forest)', 40.0, 40.0)
        objects[501] = ('Forage Bush', 10.0, 10.0)
        e = H.Economy('Franks', [(10.0, 800.0)], objects, (20, 20))
        e.tasks = {20: None, 21: None}
        e.command('ORDER', [20], {'target_id': 500, 'x': 40.0, 'y': 40.0}, '')
        e.command('ORDER', [21], {'target_id': 501, 'x': 10.0, 'y': 10.0}, '')
        e.advance(10.0)
        self.assertAlmostEqual(e.stock['wood'], 250.0)
        self.assertAlmostEqual(e.stock['food'], 250.0)

    def test_resource_kind_names(self):
        self.assertEqual(H.resource_kind('Tree (Palm Forest)'), 'wood')
        self.assertEqual(H.resource_kind('Cow B'), 'food')
        self.assertEqual(H.resource_kind('Gold Mine'), 'gold')
        self.assertIsNone(H.resource_kind('Town Center'))
