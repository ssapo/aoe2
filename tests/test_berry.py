from types import SimpleNamespace as O
from unittest import TestCase
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from berry import summarize_switches

class BerryTests(TestCase):
    def setup_data(self,events,workers):
        bushes={10:O(position=O(x=1,y=2)),20:O(position=O(x=90,y=90))}
        return summarize_switches({1:events},{1:workers},bushes,{10:10,20:20})[1]
    def event(self,worker,seconds,cluster=10):return {'worker':worker,'seconds':seconds,'cluster':cluster,'task':'건설'}
    def test_individual_moves_do_not_imply_cluster_finished(self):
        x=self.setup_data([self.event(1,100)],{10:{1,2,3}})
        self.assertEqual(x['windows'],[])
        self.assertFalse(x['depletion_confirmed'])
    def test_repeated_orders_are_not_multiple_workers(self):
        x=self.setup_data([self.event(1,100),self.event(1,110)],{10:{1,2}})
        self.assertEqual(x['windows'],[])
    def test_majority_window_and_separate_clusters(self):
        x=self.setup_data([self.event(1,100),self.event(2,120),self.event(3,130,20)],{10:{1,2,4},20:{3,5}})
        self.assertEqual(len(x['windows']),1)
        self.assertEqual(x['windows'][0]['workers'],2)
        self.assertEqual(x['windows'][0]['end_seconds'],120)
