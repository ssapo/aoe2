from pathlib import Path
import sys
import unittest
import json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from review import summarize,findings,enrich_report
from opening import classify

def event(t,label,amount=1,kind='QUEUE'):
    return {'seconds':t,'label':label,'amount':amount,'kind':kind}
def metrics(events,feudal=600,castle=1300,**extra):
    return {'full_timeline':events,'age_checkpoints':{'봉건':{'reached_seconds':feudal},'성주':{'reached_seconds':castle}},
            'age_commands':{'봉건':feudal-130,'성주':castle-160},**extra}

class ReviewTests(unittest.TestCase):
    def test_opening_sequence_is_independent_of_first_unit_and_later_totals(self):
        cases=json.loads((Path(__file__).parent/'fixtures/openings.json').read_text())
        for case in cases:
            with self.subTest(case['name']):
                self.assertEqual(classify(case['metrics'],case['duration'])['opening'],case['opening'])
        own=summarize(cases[0]['metrics'],1600)
        self.assertEqual(own['first_military_unit'],'Spearman')
        self.assertEqual(own['opening'],'scouts')

    def test_order_quantities_are_not_action_count_or_living_population(self):
        m=metrics([event(10,'Villager',5),event(20,'Villager',-2),event(30,'Fishing Ship',2),event(700,'Scout Cavalry',3),event(1500,'Villager',1)])
        r=summarize(m,1500)
        self.assertEqual(r['villager_requests'],6)
        self.assertEqual(r['military_requests'],3)
        self.assertEqual(r['first_military_seconds'],700)
        self.assertEqual(r['checkpoints'][2]['villager_requests'],5)
        self.assertEqual(sum(p['villager_requests'] for p in r['phases']),6)
        self.assertNotIn('villagers_alive',r)
        self.assertNotIn('tc_idle',r)

    def test_missing_quantity_and_partial_timeline_never_become_zero(self):
        e=event(20,'Villager');e.pop('amount')
        r=summarize(metrics([e,event(700,'Scout Cavalry')]),1200)
        self.assertIsNone(r['villager_requests'])
        self.assertIsNone(r['checkpoints'][0]['villager_requests'])
        self.assertFalse(summarize({'timeline':[e]},1200)['available'])
        self.assertNotEqual(summarize(metrics([event(700,'Kona')]),1200)['first_military_unit'],summarize(metrics([event(700,'Condottiero')]),1200)['first_military_unit'])

    def test_first_military_delay_is_split_from_age_arrival_delay(self):
        m=metrics([event(686,'Scout Cavalry')],feudal=603)
        o=metrics([event(607,'Scout Cavalry')],feudal=532)
        f=findings(summarize(m,1600),summarize(o,1600),m,o)
        first=next(x for x in f if x['title'].startswith('첫 병력'))
        self.assertIn('8초 차이예요',first['evidence'])
        self.assertEqual(first['stage'],'암흑')
        self.assertIn('봉건이 늦었던 영향',first['action'])

    def test_age_research_gap_is_not_reported_as_tc_idle(self):
        m=metrics([event(450,'Villager'),event(650,'Villager'),event(800,'Villager'),event(1000,'Villager')])
        r=summarize(m,1400)
        self.assertFalse(r['villager_command_gaps'][0]['review_candidate'])
        self.assertTrue(r['villager_command_gaps'][-1]['review_candidate'])
        other=metrics([event(700,'Scout Cavalry')])
        f=findings(r,summarize(other,1400),m,other)
        self.assertFalse(any('TC 유휴' in x['title'] for x in f))

    def test_personal_median_excludes_current_future_and_other_map(self):
        def row(i,time,feudal,mapname='Arabia'):
            return {'id':i,'started_at':time,'analysis':{'map':mapname,'civilization':'Franks','duration_game_seconds':1600,
                'metrics':metrics([event(feudal+60,'Scout Cavalry',2)],feudal=feudal),
                'opponents':[{'metrics':metrics([event(700,'Scout Cavalry')])}]}}
        current=row(5,5,620)
        report={'matches':[row(6,6,100),current,row(1,1,600),row(2,2,640),row(3,3,660),row(4,4,100,'Arena')]}
        enrich_report(report)
        b=current['analysis']['review']['personal_benchmarks'][0]
        self.assertEqual(b['samples'],3)
        self.assertEqual(b['median_seconds'],640)
        self.assertEqual(b['delta_seconds'],-20)
        self.assertNotIn('percentile',b)

    def test_restored_record_does_not_invent_early_zero_checkpoints(self):
        r=summarize(metrics([event(1100,'Villager'),event(1300,'Scout Cavalry')],feudal=1200,castle=1500,recording_restored=True),1700)
        self.assertTrue(all(p['seconds']>=1100 for p in r['checkpoints']))
        self.assertEqual(r['phases'][0]['stage'],'기록 구간')

if __name__=='__main__':unittest.main()
