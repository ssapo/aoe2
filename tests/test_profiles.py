import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_profiles import targets
from player_index import normalize

class ProfileTests(unittest.TestCase):
    def test_selected_profile_is_separate_and_default_not_overwritten(self):
        jobs=targets('12345')
        self.assertEqual(jobs[0][0],26260702)
        self.assertEqual(len({str(p) for _,p,_ in jobs}),len(jobs))
        self.assertTrue(str(jobs[-1][1]).endswith('/profiles/12345/report.json'))
        self.assertEqual(len(targets('199325')),2)
        self.assertEqual(len(targets('26260702')),2)

    def test_invalid_request_does_not_start_collection(self):
        with self.assertRaises(ValueError):targets('123; echo unsafe')

    def test_search_index_keeps_public_display_data_only(self):
        data={'statGroups':[{'id':5,'members':[{'profile_id':123,'name':'/steam/secret','alias':'nickname','country':'kr'}]}],'leaderboardStats':[{'statgroup_id':5,'rating':2000,'rank':10}]}
        row=normalize(data)[0]
        self.assertEqual(row,{'id':123,'name':'nickname','rating':2000,'rank':10,'country':'kr'})
