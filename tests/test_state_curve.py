from datetime import timedelta
from types import SimpleNamespace as O
from unittest import TestCase
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import state_curve

def match(players=(1,2),restored=0):
    return O(players=[O(number=n) for n in players],restored_at=timedelta(seconds=restored))

class StateCurveTests(TestCase):
    def curve(self,rows,**kw):
        with patch.object(state_curve,'read_checkpoints',return_value=rows):
            m=match(**kw)
            return state_curve.state_curve(b'',m,m.players[0])
    def test_points_follow_own_and_opponent_numbers(self):
        c=self.curve([(9500,{1:(600,12),2:(475,11)}),(16000,{1:(500,15),2:(450,17)})])
        self.assertEqual(c['points'],[[9.5,600,12,475,11],[16.0,500,15,450,17]])
        self.assertEqual(c['source'],'recording_checkpoints')
    def test_own_player_two_is_not_swapped(self):
        with patch.object(state_curve,'read_checkpoints',return_value=[(1000,{1:(1,2),2:(3,4)}),(2000,{1:(5,6),2:(7,8)})]):
            m=match();c=state_curve.state_curve(b'',m,m.players[1])
        self.assertEqual(c['points'][0],[1.0,3,4,1,2])
    def test_restored_games_shift_time(self):
        c=self.curve([(1000,{1:(1,1),2:(1,1)}),(2000,{1:(1,1),2:(1,1)})],restored=60)
        self.assertEqual([p[0] for p in c['points']],[61.0,62.0])
    def test_floating_time_and_mean_after_opening(self):
        rows=[(t*1000,{1:(1500 if t>=300 else 100,10),2:(200,10)}) for t in range(0,601,60)]
        s=self.curve(rows)['summary']
        self.assertEqual(s['own_floating_seconds'],300)
        self.assertEqual(s['opponent_floating_seconds'],0)
        self.assertEqual(s['own_mean_resources'],1500)
    def test_largest_swing_inside_window(self):
        rows=[(0,{1:(0,10),2:(0,10)}),(30000,{1:(0,10),2:(0,10)}),(60000,{1:(0,30),2:(0,8)}),(200000,{1:(0,0),2:(0,50)})]
        w=self.curve(rows)['summary']['largest_swing']
        self.assertEqual((w['from_seconds'],w['to_seconds'],w['change']),(0,60,22))
    def test_not_1v1_or_too_few_points(self):
        self.assertIsNone(self.curve([(1,{1:(1,1),2:(1,1),3:(1,1)})]*3,players=(1,2,3)))
        self.assertIsNone(self.curve([(1,{1:(1,1),2:(1,1)})]))
