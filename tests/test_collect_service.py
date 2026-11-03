import sys,unittest,threading,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from collect_service import Jobs,Busy

class ServiceTests(unittest.TestCase):
    def test_duplicate_requests_share_one_job_and_global_concurrency_is_bounded(self):
        gate=threading.Event();calls=[]
        def run(pid):calls.append(pid);gate.wait(2);return {'profile':{'id':pid},'matches':[]}
        jobs=Jobs(runner=run)
        try:
            key,_=jobs.start(199325);self.assertEqual(jobs.start(199325)[0],key)
            with self.assertRaises(Busy):jobs.start(26260702)
            gate.set();jobs.pool.shutdown(wait=True)
            self.assertEqual(calls,[199325]);self.assertEqual(jobs.get(key)['state'],'complete')
        finally:gate.set();jobs.pool.shutdown(wait=True)

    def test_wrong_account_and_errors_never_complete(self):
        jobs=Jobs(runner=lambda pid:{'profile':{'id':1},'matches':[]})
        key,_=jobs.start(199325);jobs.pool.shutdown(wait=True);self.assertEqual(jobs.get(key)['state'],'failed');self.assertNotIn('report',jobs.get(key))

    def test_invalid_profile_cannot_reach_runner(self):
        jobs=Jobs(runner=lambda pid:self.fail('called'))
        try:
            for value in ['../secret','1; echo x','0','-1']:
                with self.assertRaises(ValueError):jobs.start(value)
        finally:jobs.pool.shutdown(wait=True)

class ServiceHTTPTests(unittest.TestCase):
    def test_health_post_poll_and_origin_rejection_over_http(self):
        import json,urllib.request,urllib.error
        from http.server import ThreadingHTTPServer
        from collect_service import Handler
        jobs=Jobs(runner=lambda pid:{'profile':{'id':pid},'matches':[]})
        class TestHandler(Handler):pass
        TestHandler.jobs=jobs
        server=ThreadingHTTPServer(('127.0.0.1',0),TestHandler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        try:
            self.assertEqual(json.load(urllib.request.urlopen(base+'/health'))['status'],'ok')
            request=urllib.request.Request(base+'/collect',data=b'{"profile_id":199325}',headers={'Content-Type':'application/json','Origin':'https://ssapo.github.io'})
            response=urllib.request.urlopen(request);self.assertEqual(response.status,202);self.assertEqual(response.headers['Access-Control-Allow-Origin'],'https://ssapo.github.io');job=json.load(response)
            jobs.pool.shutdown(wait=True)
            result=json.load(urllib.request.urlopen(base+'/jobs/'+job['job_id']))
            self.assertEqual(result['report']['profile']['id'],199325)
            bad=urllib.request.Request(base+'/collect',data=b'{"profile_id":199325}',headers={'Content-Type':'application/json','Origin':'https://other.example'})
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(bad)
            self.assertEqual(error.exception.code,403)
        finally:server.shutdown();server.server_close();thread.join(2);jobs.pool.shutdown(wait=True)
