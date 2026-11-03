"""Regression checks for evidence quality and preservation of successful data."""
from datetime import timedelta
import gzip
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace as Obj
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import collect


class CollectorTests(unittest.TestCase):
    def test_profile_links_and_ids(self):
        self.assertEqual(collect.profile_id('1234'),1234)
        for invalid in ['https://www.aoe2insights.com/user/1234/','0','-10','https://example.com/user/1234/','https://aoe2insights.com/match/1234/']:
            with self.assertRaises(ValueError): collect.profile_id(invalid)

    def test_gzip_zip_and_size_guards(self):
        payload = b'valid replay header bytes '+b'X'*70
        self.assertEqual(collect.decode_replay(gzip.compress(payload)),payload)
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as archive: archive.writestr('../game.aoe2record',payload)
        self.assertEqual(collect.decode_replay(output.getvalue()),payload)
        with self.assertRaises(ValueError): collect.decode_replay(b'<html>not replay content</html>')
        with patch.object(collect,'MAX_REPLAY',10):
            with self.assertRaises(ValueError): collect.decode_replay(gzip.compress(payload))

    def test_replay_url_host_validation(self):
        row={'id':10,'matchurls':[{'profile_id':1,'url':'https://x.blob.core.windows.net.evil.test/a'},
             {'profile_id':1,'url':'https://x.blob.core.windows.net/a'}]}
        urls=collect.replay_urls(row,1)
        self.assertNotIn('evil.test',' '.join(urls))
        self.assertIn('https://x.blob.core.windows.net/a',urls)

    def test_command_timing_not_completion(self):
        p=Obj(number=1,eapm=35)
        action=Obj(player=p,timestamp=timedelta(seconds=400),type=Obj(name='RESEARCH'),payload={'technology_id':101,'technology':'Feudal Age'})
        action2=Obj(player=p,timestamp=timedelta(seconds=410),type=Obj(name='RESEARCH'),payload={'technology_id':101,'technology':'Feudal Age'})
        metrics=collect.command_metrics(Obj(actions=[action,action2]),p)
        self.assertEqual(metrics['age_commands']['봉건'],400)
        self.assertNotIn('tc_idle',metrics)
        self.assertEqual(metrics['command_counts']['Feudal Age'],2)
        cards=collect.coaching(metrics,[{'metrics':{'age_commands':{'봉건':360}}}],2)
        self.assertIn('40초 늦음',cards[0]['title'])
        self.assertIn('실제 시대 도달 시간은 아님',cards[0]['evidence'])
        self.assertFalse(any('패인' in c['title'] for c in cards))

    def test_team_timing_not_misrepresented_as_duel(self):
        cards=collect.coaching({'age_commands':{'봉건':400}},[{'metrics':{'age_commands':{'봉건':360}}}],4)
        self.assertFalse(any('상대보다' in c['title'] for c in cards))

    def test_api_failure_preserves_success(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'report.json'
            original={'schema_version':1,'updated_at':'original','profile':{'id':1234},'matches':[{'id':2,'analysis_status':'complete'}]}
            collect.write_json(path,original)
            with patch.object(sys,'argv',['collect','--profile-id','1234','--output',str(path)]), patch.object(collect,'fetch',side_effect=OSError('offline')):
                with self.assertRaises(OSError):collect.main()
            saved=json.loads(path.read_text())
            self.assertEqual(saved['matches'],original['matches'])
            self.assertEqual(saved['updated_at'],'original')
            self.assertTrue(saved['sync_error'])
            status=json.loads((path.parent/'status.json').read_text())
            self.assertEqual(status['last_checked_at'],saved['last_checked_at'])
            self.assertEqual(status['updated_at'],'original')
            self.assertEqual(status['sync_error'],saved['sync_error'])
            self.assertNotIn('matches',status)

    def test_profile_switch_does_not_mix_histories(self):
        payload={'result':{'code':0},'profiles':[{'profile_id':222,'alias':'New Player'}],
                 'matchHistoryStats':[{'id':99,'startgametime':10,'completiontime':20,'matchhistoryreportresults':[{'profile_id':222,'resulttype':1,'civilization_id':0},{'profile_id':333,'resulttype':0,'civilization_id':1}]}]}
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'report.json'
            collect.write_json(path,{'profile':{'id':111},'matches':[{'id':1,'analysis_status':'complete'}]})
            with patch.object(sys,'argv',['collect','--profile-id','222','--limit','0','--output',str(path)]),patch.object(collect,'fetch',return_value=json.dumps(payload).encode()):
                collect.main()
            saved=json.loads(path.read_text())
            self.assertEqual([m['id'] for m in saved['matches']],[99])
            self.assertEqual(saved['profile']['id'],222)
            self.assertEqual(saved['matches'][0]['civilization'],'문명 ID 0')

    def test_first_run_accepts_null_profile(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'report.json'
            collect.write_json(path,{'schema_version':1,'profile':None,'matches':[]})
            payload={'result':{'code':0},'profiles':[],'matchHistoryStats':[]}
            with patch.object(sys,'argv',['collect','--profile-id','1234','--limit','0','--output',str(path)]),patch.object(collect,'fetch',return_value=json.dumps(payload).encode()):
                collect.main()
            self.assertEqual(json.loads(path.read_text())['profile']['id'],1234)
            status=json.loads((path.parent/'status.json').read_text())
            self.assertIsNone(status['sync_error'])
            self.assertEqual(status['schema_version'],1)
            self.assertEqual(status['last_checked_at'],json.loads(path.read_text())['last_checked_at'])

    def test_upgrade_failure_keeps_success_and_has_bounded_retries(self):
        old={'analysis':{'analysis_revision':4,'metrics':{'preserved':True}},'analysis_status':'complete'}
        row=dict(old)
        with patch.object(collect,'fetch',side_effect=OSError('expired replay')):
            self.assertTrue(collect.upgrade_analysis(row,old,{'id':123},1))
        self.assertEqual(row['analysis'],old['analysis'])
        self.assertEqual(row['analysis_status'],'complete')
        row['analysis_upgrade']['attempts']=3
        with patch.object(collect,'fetch') as remote:
            self.assertFalse(collect.upgrade_analysis(row,row,{'id':123},1))
            remote.assert_not_called()

    def test_upgrade_success_replaces_analysis_and_clears_retry_state(self):
        old={'analysis':{'analysis_revision':4},'analysis_status':'complete'}
        row=dict(old)
        newer={'analysis_revision':collect.ANALYSIS_REVISION,'metrics':{'age_checkpoints':{}}}
        with patch.object(collect,'fetch',return_value=b'replay'),patch.object(collect,'analyze_replay',return_value=newer):
            self.assertTrue(collect.upgrade_analysis(row,old,{'id':123},1))
        self.assertEqual(row['analysis'],newer)
        self.assertNotIn('analysis_upgrade',row)


if __name__=='__main__': unittest.main()


def test_random_civ_flags_reads_prefer_random(monkeypatch):
    import types, sys as _sys
    fake = types.ModuleType('mgz.fast.header')
    fake.parse = lambda _h: {'de': {'players': [
        {'profile_id': 199325, 'prefer_random': True},
        {'profile_id': 26260702, 'prefer_random': False},
        {'profile_id': -1, 'prefer_random': True},
        {'profile_id': 5, 'prefer_random': None},
    ]}}
    monkeypatch.setitem(_sys.modules, 'mgz.fast.header', fake)
    assert collect.random_civ_flags(b'x') == {199325: True, 26260702: False}


def test_random_civ_flags_unreadable_header_is_empty(monkeypatch):
    import types, sys as _sys
    fake = types.ModuleType('mgz.fast.header')
    def boom(_h): raise RuntimeError('bad')
    fake.parse = boom
    monkeypatch.setitem(_sys.modules, 'mgz.fast.header', fake)
    assert collect.random_civ_flags(b'x') == {}
