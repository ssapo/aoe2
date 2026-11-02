"""Guard the distinction between requested quantities and live game state."""
from datetime import timedelta
from pathlib import Path
import sys
from types import SimpleNamespace as Obj
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from details import detailed_metrics


class DetailTests(unittest.TestCase):
    def setUp(self):
        self.me, self.other = Obj(number=1), Obj(number=2)

    def action(self, at, kind, payload, other=False):
        return Obj(timestamp=timedelta(seconds=at), type=Obj(name=kind),
                   payload=payload, player=self.other if other else self.me)

    def metrics(self, actions, notices=(), restored_at=0):
        return detailed_metrics(Obj(actions=actions, uptimes=notices,
            restored_at=timedelta(seconds=restored_at), restored=restored_at>0), self.me)

    def test_snapshot_uses_amount_and_sequence_not_number_of_actions_or_live_count(self):
        result=self.metrics([
            self.action(1,'DE_QUEUE',{'unit':'Villager','amount':5}),
            self.action(2,'DE_QUEUE',{'unit':'Villager','amount':-2}),
            self.action(3,'DE_QUEUE',{'unit':'Villager','amount':40},other=True),
            self.action(300,'DE_QUEUE',{'unit':'Scout Cavalry','amount':3}),
            self.action(400,'RESEARCH',{'technology_id':101,'technology':'Feudal Age'}),
            self.action(400,'DE_QUEUE',{'unit':'Villager','amount':2}),
            self.action(410,'RESEARCH',{'technology_id':101,'technology':'Feudal Age'}),
        ])
        checkpoint=result['age_checkpoints']['봉건']
        self.assertEqual(checkpoint['unit_requests_before_click'],{'Villager':5,'Scout Cavalry':3})
        self.assertEqual(checkpoint['unit_requests_previous_120s'],{'Scout Cavalry':3})
        self.assertEqual(checkpoint['command_seconds'],400)
        self.assertIsNone(checkpoint['villagers_alive'])
        self.assertEqual(result['unit_orders']['Villager']['requested_amount'],7)
        self.assertEqual(result['unit_orders']['Villager']['negative_amount'],2)
        self.assertEqual(result['research_orders']['Feudal Age']['commands'],2)

    def test_age_reached_requires_notice_and_never_assumed_duration(self):
        notice=Obj(age=Obj(name='FEUDAL_AGE'),player=self.me,timestamp=timedelta(seconds=550))
        actions=[self.action(400,'RESEARCH',{'technology_id':101,'technology':'Feudal Age'}),
                 self.action(900,'RESEARCH',{'technology_id':102,'technology':'Castle Age'})]
        result=self.metrics(actions,[notice])
        self.assertEqual(result['age_checkpoints']['봉건']['reached_seconds'],550)
        self.assertNotIn('reached_seconds',result['age_checkpoints']['성주'])

    def test_restored_clock_and_unknown_amount_are_explicit(self):
        result=self.metrics([
            self.action(10,'DE_QUEUE',{'unit':'Villager'}),
            self.action(20,'RESEARCH',{'technology_id':102,'technology':'Castle Age'}),
        ],restored_at=1000)
        point=result['age_checkpoints']['성주']
        self.assertEqual(point['command_seconds'],1020)
        self.assertEqual(point['unknown_unit_request_amounts'],['Villager'])
        self.assertTrue(result['recording_restored'])
        self.assertEqual(result['unit_orders']['Villager']['unknown_amount_commands'],1)

    def test_full_timeline_and_building_lookup_are_not_truncated(self):
        actions=[self.action(i,'BUILD',{'building':'Farm'}) for i in range(110)]
        result=self.metrics(actions)
        self.assertEqual(len(result['full_timeline']),110)
        self.assertEqual(result['building_orders']['Farm']['commands'],110)


if __name__=='__main__': unittest.main()

class MarketTests(unittest.TestCase):
    setUp = DetailTests.setUp
    action = DetailTests.action
    metrics = DetailTests.metrics
    def test_market_units_player_and_click_order(self):
        result=self.metrics([
            self.action(100,'SELL',{'resource_id':2,'amount':500}),
            self.action(200,'BUY',{'resource_id':0,'amount':100}),
            self.action(200,'BUY',{'resource_id':0,'amount':100},other=True),
            self.action(210,'RESEARCH',{'technology_id':102,'technology':'Castle Age'}),
            self.action(210,'BUY',{'resource_id':0,'amount':100}),
            self.action(211,'BUY',{'resource_id':0,'amount':-1}),
            self.action(212,'BUY',{'resource_id':99,'amount':100}),
        ],restored_at=60)
        events=result['market']['events']
        self.assertEqual([e['amount'] for e in events],[500,100,100])
        self.assertEqual(events[0]['seconds'],160)
        self.assertEqual(len(result['age_checkpoints']['성주']['market_previous_120s']),2)
        self.assertEqual(len([e for e in result['full_timeline'] if e['kind']=='BUY']),2)

    def test_empty_market_is_distinct_from_missing_old_analysis(self):
        self.assertEqual(self.metrics([])['market']['events'],[])
