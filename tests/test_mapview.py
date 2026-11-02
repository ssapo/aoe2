from datetime import timedelta
from types import SimpleNamespace as O
from pathlib import Path
import sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from mapview import building_map,point
from details import detailed_metrics

class MapTests(unittest.TestCase):
    def test_invalid_coordinates_are_not_invented(self):
        for pos in [None,O(x=float('nan'),y=1),O(x=120,y=0),O(x=-1,y=0)]:self.assertIsNone(point(pos,120))
        self.assertEqual(point(O(x=3,y=4),120),{'x':3,'y':4})

    def test_terrain_orientation_and_tc_auxiliaries(self):
        me=O(number=1,objects=[O(class_id=80,name='Town Center',object_id=i,position=O(x=0,y=0)) for i in [109,618,619,620]])
        match=O(map=O(dimension=2,tiles=[O(terrain=i,elevation=0,position=O(x=i%2,y=i//2)) for i in [3,1,2,0]]),players=[me],gaia=[])
        result=building_map(match,me)
        self.assertEqual([r[0] for r in result['terrain_runs']],[0,1,2,3])
        self.assertEqual(len(result['initial_buildings']),1)
        match.map.tiles.pop();self.assertIsNone(building_map(match,me))

    def test_build_target_preserves_restored_time(self):
        me=O(number=1)
        a=O(player=me,type=O(name='BUILD'),payload={'building':'House'},timestamp=timedelta(seconds=4),position=O(x=12.5,y=18))
        match=O(map=O(dimension=120),actions=[a],uptimes=[],restored=True,restored_at=timedelta(seconds=60))
        e=detailed_metrics(match,me)['full_timeline'][0]
        self.assertEqual((e['x'],e['y'],e['seconds']),(12.5,18,64))
