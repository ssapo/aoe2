import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_profiles import FEATURED,featured_profiles,targets,write_featured
import json,tempfile
from player_index import normalize

class ProfileTests(unittest.TestCase):
    def test_selected_profile_is_separate_and_default_not_overwritten(self):
        jobs=targets('12345')
        self.assertEqual(jobs[0][0],26260702)
        self.assertEqual(len({str(p) for _,p,_ in jobs}),len(jobs))
        self.assertTrue(jobs[-1][1].as_posix().endswith('/profiles/12345/report.json'))
        self.assertEqual(len(targets('199325')),1+len(FEATURED))
        self.assertEqual(len(targets('26260702')),1+len(FEATURED))

    def test_featured_list_comes_from_config_and_follows_nickname(self):
        self.assertTrue({199325,506898} <= set(FEATURED))
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);cfg=d/'config.json'
            cfg.write_text(json.dumps({'featured_profiles':[{'id':7,'name':'A'},8,{'id':26260702},{'id':'x'},{'id':7,'name':'dup'}]}),encoding='utf-8')
            chosen=featured_profiles(cfg);self.assertEqual(chosen,{7:'A',8:''})
            (d/'profiles/8').mkdir(parents=True);(d/'profiles/8/report.json').write_text(json.dumps({'profile':{'id':8,'name':'New Nick'}}),encoding='utf-8')
            rows=write_featured(d/'featured.json',chosen,d)
            self.assertEqual(rows,[{'id':7,'name':'A','nickname':''},{'id':8,'name':'New Nick','nickname':'New Nick'}])
            self.assertEqual(json.loads((d/'featured.json').read_text(encoding='utf-8'))['profiles'],rows)
            self.assertEqual(featured_profiles(d/'missing.json'),{})

    def test_featured_players_take_turns_for_analysis_but_all_are_listed(self):
        from collect_profiles import analysed_now
        from datetime import datetime,timezone
        ids=list(range(1,15))
        seen=set()
        for k in range(4):
            now=datetime.fromtimestamp(1800*k,timezone.utc);turn=analysed_now(ids,now,4)
            self.assertEqual(len(turn),4);seen|=turn
        self.assertEqual(seen,set(ids))
        self.assertEqual(analysed_now([1,2],None,4),{1,2})
        jobs=targets('',now=datetime.fromtimestamp(0,timezone.utc))
        self.assertEqual(len(jobs),1+len(FEATURED))
        self.assertEqual(sum(1 for _,_,l in jobs[1:] if l==2),min(4,len(FEATURED)))
        self.assertTrue(all(l in (0,2) for _,_,l in jobs[1:]))

    def test_invalid_request_does_not_start_collection(self):
        with self.assertRaises(ValueError):targets('123; echo unsafe')

    def test_search_index_keeps_public_display_data_only(self):
        data={'statGroups':[{'id':5,'members':[{'profile_id':123,'name':'/steam/secret','alias':'nickname','country':'kr'}]}],'leaderboardStats':[{'statgroup_id':5,'rating':2000,'rank':10}]}
        row=normalize(data)[0]
        self.assertEqual(row,{'id':123,'name':'nickname','rating':2000,'rank':10,'country':'kr'})
