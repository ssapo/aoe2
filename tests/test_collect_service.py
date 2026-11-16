import sys,unittest,threading,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from collect_service import Jobs,Busy,Dispatcher,DISPATCH_URL

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


class FakeResponse:
    def __init__(self,status):self.status=status
    def __enter__(self):return self
    def __exit__(self,*a):return False

class DispatchTests(unittest.TestCase):
    """DEC-01: a direct collection asks GitHub to run the published collection for the same profile."""
    TOKEN='github_pat_FAKE_for_test_only'
    def test_without_token_nothing_is_sent(self):
        d=Dispatcher(token='',opener=lambda *a,**k:self.fail('sent'))
        self.assertFalse(d.enabled);self.assertEqual(d.request(199325),'off')

    def test_request_shape_cooldown_and_retry_after_failure(self):
        import json
        sent=[];now=[1000.0];status=[204]
        def opener(request,timeout):sent.append(request);return FakeResponse(status[0])
        d=Dispatcher(token=self.TOKEN,opener=opener,clock=lambda:now[0])
        self.assertEqual(d.request('199325'),'requested')
        r=sent[0]
        self.assertEqual((r.full_url,r.get_method()),(DISPATCH_URL,'POST'))
        self.assertEqual(json.loads(r.data),{'ref':'main','inputs':{'profile_id':'199325'}})
        self.assertEqual(r.get_header('Authorization'),'Bearer '+self.TOKEN)
        self.assertEqual(r.get_header('Accept'),'application/vnd.github+json')
        self.assertEqual(d.request(199325),'recent');self.assertEqual(len(sent),1)
        self.assertEqual(d.request(26260702),'requested')        # another profile is not held back
        now[0]+=1801;status[0]=500
        self.assertEqual(d.request(199325),'failed')
        status[0]=204;self.assertEqual(d.request(199325),'requested')  # a failure does not start the cooldown
        def broken(request,timeout):raise OSError('network down '+request.get_header('Authorization'))
        self.assertEqual(Dispatcher(token=self.TOKEN,opener=broken).request(1),'failed')
        with self.assertRaises(ValueError):d.request('../x')

    def test_token_is_never_shown(self):
        d=Dispatcher(token=self.TOKEN,opener=lambda *a,**k:FakeResponse(204))
        self.assertNotIn(self.TOKEN,repr(d)+str(d)+repr([d]))

    def test_finished_job_records_the_request_and_failed_job_sends_nothing(self):
        calls=[]
        class Fake:
            enabled=True
            def request(self,pid):calls.append(pid);return 'requested'
        jobs=Jobs(runner=lambda pid:{'profile':{'id':pid},'matches':[]},dispatcher=Fake())
        key,_=jobs.start(199325);jobs.pool.shutdown(wait=True)
        self.assertEqual(jobs.get(key)['state'],'complete');self.assertEqual(jobs.get(key)['shared'],'requested');self.assertEqual(calls,[199325])
        jobs=Jobs(runner=lambda pid:{'profile':{'id':1},'matches':[]},dispatcher=Fake())
        key,_=jobs.start(199325);jobs.pool.shutdown(wait=True)
        self.assertEqual(jobs.get(key)['state'],'failed');self.assertEqual(calls,[199325])

    def test_health_says_whether_publishing_is_on_without_the_token(self):
        import json,urllib.request
        from http.server import ThreadingHTTPServer
        from collect_service import Handler
        jobs=Jobs(runner=lambda pid:{'profile':{'id':pid},'matches':[]},dispatcher=Dispatcher(token=self.TOKEN,opener=lambda *a,**k:FakeResponse(204)))
        class TestHandler(Handler):pass
        TestHandler.jobs=jobs
        server=ThreadingHTTPServer(('127.0.0.1',0),TestHandler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            raw=urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/health').read().decode()
            self.assertTrue(json.loads(raw)['publish']);self.assertNotIn(self.TOKEN,raw)
        finally:server.shutdown();server.server_close();thread.join(2);jobs.pool.shutdown(wait=True)
