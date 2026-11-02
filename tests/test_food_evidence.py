from datetime import timedelta
from types import SimpleNamespace as Obj
from unittest import TestCase
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect import food_order_evidence
from mgz import fast

class FoodEvidenceTests(TestCase):
    def test_explicit_worker_only_and_unique_targets(self):
        obj=lambda iid,name:Obj(instance_id=iid,name=name)
        m=Obj(gaia=[obj(100,'Sheep'),obj(101,'Goat')],players=[Obj(number=1,objects=[obj(11,'Villager'),obj(12,'Scout Cavalry')]),Obj(number=2,objects=[obj(22,'Villager')])],restored_at=timedelta(0))
        def action(kind,player,actors,target):return fast.Operation.ACTION,(kind,{'player_id':player,'object_ids':actors,'target_id':target})
        ops=[(fast.Operation.SYNC,(10000,None,None)),action(fast.Action.MOVE,1,[100],0),action(fast.Action.MOVE,1,[100],0),action(fast.Action.GATHER_POINT,1,[11],100),action(fast.Action.ORDER,1,[12],100),action(fast.Action.ORDER,1,[],100),action(fast.Action.ORDER,2,[11],100),action(fast.Action.ORDER,1,[11],100),action(fast.Action.ORDER,1,[11],100),action(fast.Action.ORDER,1,[11],101),EOFError()]
        with patch('mgz.fast.header.parse'),patch('mgz.fast.meta'),patch('mgz.fast.operation',side_effect=ops):
            result=food_order_evidence(b'',m)
        self.assertEqual(result[1]['livestock_control']['observed_targets'],1)
        self.assertEqual(result[2]['livestock_control']['observed_targets'],0)
        self.assertEqual(result[1]['livestock']['observed_targets'],2)
        self.assertEqual(result[1]['livestock']['first_seconds'],10)
        self.assertEqual(result[2]['livestock']['observed_targets'],0)
        self.assertEqual(result[1]['berries']['observed_targets'],0)
        self.assertNotIn('food_collected',result[1]['livestock'])
