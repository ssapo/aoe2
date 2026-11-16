"""Public-data collection service.

Collection itself needs no GitHub credential. Optional (DEC-01): with GITHUB_DISPATCH_TOKEN set, a finished
direct collection also asks GitHub to run the published collection for that profile, so the result shows on
every device. Without the variable that step is skipped."""
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import gzip, json, os, re, secrets, subprocess, sys, tempfile, threading, time, urllib.request
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from collect import profile_id, ANALYSIS_REVISION

class Busy(Exception):pass

DISPATCH_URL='https://api.github.com/repos/ssapo/aoe2/actions/workflows/update.yml/dispatches'
DISPATCH_COOLDOWN=1800  # one published-collection request per profile per 30 min

class Dispatcher:
    """DEC-01: request `Collect matches & deploy` (workflow_dispatch, input profile_id) after a direct collection.

    The token comes only from the GITHUB_DISPATCH_TOKEN environment variable (a fine-grained token limited to
    ssapo/aoe2 with "Actions: read and write"). It is never logged, returned or shown in repr; with no token
    request() does nothing and returns 'off'."""
    def __init__(self,token=None,opener=None,clock=time.monotonic,cooldown=DISPATCH_COOLDOWN):
        self.__token=(os.environ.get('GITHUB_DISPATCH_TOKEN','') if token is None else token).strip()
        self.opener=opener or urllib.request.urlopen;self.clock=clock;self.cooldown=cooldown;self.lock=threading.Lock();self.last={}
    @property
    def enabled(self):return bool(self.__token)
    def __repr__(self):return f'Dispatcher(enabled={self.enabled})'
    def request(self,pid):
        """'off' (no token), 'recent' (asked for this profile within the cooldown), 'requested' or 'failed'."""
        if not self.__token:return 'off'
        pid=profile_id(pid);now=self.clock()
        with self.lock:
            if pid in self.last and now-self.last[pid]<self.cooldown:return 'recent'
            self.last[pid]=now
        body=json.dumps({'ref':'main','inputs':{'profile_id':str(pid)}}).encode()
        request=urllib.request.Request(DISPATCH_URL,data=body,method='POST',headers={'Authorization':'Bearer '+self.__token,
            'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'ssapo-aoe2-collect'})
        try:
            with self.opener(request,timeout=15) as response:ok=response.status==204
        except Exception:ok=False  # the error text is not kept: nothing about the request may reach a log
        if not ok:
            with self.lock:self.last.pop(pid,None)
        return 'requested' if ok else 'failed'

class Jobs:
    def __init__(self,runner=None,clock=time.monotonic,dispatcher=None):
        self.lock=threading.Lock();self.clock=clock;self.rows={};self.starts=deque();self.runner=runner or collect;self.pool=ThreadPoolExecutor(max_workers=1)
        self.dispatcher=dispatcher or Dispatcher(token='')
    def start(self,pid):
        pid=profile_id(pid);now=self.clock()
        with self.lock:
            self.rows={k:v for k,v in self.rows.items() if v['state'] in {'queued','running'} or now-v['created']<600}
            for key,row in self.rows.items():
                if row['profile_id']==pid and (row['state'] in {'queued','running'} or now-row['created']<60):return key,row['state']
            if any(v['state'] in {'queued','running'} for v in self.rows.values()):raise Busy('다른 수집을 진행 중이에요. 잠시 후 다시 눌러주세요.')
            while self.starts and now-self.starts[0]>=3600:self.starts.popleft()
            if len(self.starts)>=10:raise Busy('지금은 수집 요청이 많아요. 잠시 후 다시 시도해 주세요.')
            key=secrets.token_hex(16);self.rows[key]={'profile_id':pid,'state':'queued','created':now};self.starts.append(now)
        self.pool.submit(self.run,key);return key,'queued'
    def run(self,key):
        with self.lock:self.rows[key]['state']='running';pid=self.rows[key]['profile_id']
        try:
            report=self.runner(pid)
            if report.get('profile',{}).get('id')!=pid or not isinstance(report.get('matches'),list) or report.get('sync_error'):raise ValueError('Invalid collection result')
        except Exception:
            with self.lock:self.rows[key].update(state='failed',message='수집을 마치지 못했어요. 기존 기록은 그대로 있어요. 잠시 후 다시 시도해 주세요.')
            return
        # DEC-01: publish the same profile through the scheduled collection (no-op without a token); decided
        # before 'complete' so the page sees the answer together with the report
        shared=self.dispatcher.request(pid)
        with self.lock:self.rows[key].update(state='complete',report=report,shared=shared)
    def get(self,key):
        with self.lock:
            row=self.rows.get(key)
            if not row:return None
            return {k:v for k,v in row.items() if k!='created'}


def collect(pid):
    with tempfile.TemporaryDirectory(prefix='ssapo-collect-') as folder:
        path=Path(folder)/'report.json'
        relative='data/report.json' if pid==26260702 else f'data/profiles/{pid}/report.json'
        # Seed only from our fixed public host. Never fetch a caller-supplied URL.
        try:
            with urllib.request.urlopen('https://ssapo.github.io/aoe2/'+relative,timeout=15) as h:raw=h.read(32*1024*1024+1)
            seed=json.loads(raw)
            if len(raw)<=32*1024*1024 and seed.get('profile',{}).get('id')==pid:path.write_bytes(raw)
        except Exception:pass
        result=subprocess.run([sys.executable,str(ROOT/'scripts/collect.py'),'--profile-id',str(pid),'--output',str(path),'--limit','2'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=240)
        if result.returncode!=0:raise RuntimeError('Collection failed')
        return json.loads(path.read_text())


class Handler(BaseHTTPRequestHandler):
    jobs=None
    allowed_origin=os.environ.get('ALLOWED_ORIGIN','https://ssapo.github.io')
    def reply(self,status,data):
        raw=json.dumps(data,ensure_ascii=False,allow_nan=False).encode();self.send_response(status)
        if self.headers.get('Origin')==self.allowed_origin:self.send_header('Access-Control-Allow-Origin',self.allowed_origin)
        self.send_header('Vary','Origin, Accept-Encoding');self.send_header('Cache-Control','no-store');self.send_header('Content-Type','application/json; charset=utf-8')
        if 'gzip' in self.headers.get('Accept-Encoding','') and len(raw)>1024:raw=gzip.compress(raw);self.send_header('Content-Encoding','gzip')
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_OPTIONS(self):
        if self.headers.get('Origin')!=self.allowed_origin:return self.reply(403,{'error':'Origin not allowed'})
        self.send_response(204);self.send_header('Access-Control-Allow-Origin',self.allowed_origin);self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type');self.send_header('Vary','Origin');self.end_headers()
    def do_GET(self):
        if self.path=='/health':return self.reply(200,{'status':'ok','analysis_revision':ANALYSIS_REVISION,'publish':self.jobs.dispatcher.enabled})
        match=re.fullmatch(r'/jobs/([0-9a-f]{32})',self.path)
        if not match:return self.reply(404,{'error':'Not found'})
        row=self.jobs.get(match[1]);self.reply(200,row) if row else self.reply(404,{'error':'수집 결과가 만료됐어요. 다시 수집해 주세요.'})
    def do_POST(self):
        if self.path!='/collect':return self.reply(404,{'error':'Not found'})
        if self.headers.get('Origin')!=self.allowed_origin:return self.reply(403,{'error':'Origin not allowed'})
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.reply(415,{'error':'Expected JSON'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 1<=size<=1024:raise ValueError('Invalid body size')
            data=json.loads(self.rfile.read(size));pid=profile_id(data['profile_id'])
        except (ValueError,KeyError,TypeError):return self.reply(400,{'error':'유효한 게임 서버 프로필 ID가 필요해요.'})
        try:key,state=self.jobs.start(pid)
        except Busy as e:return self.reply(429,{'error':str(e)})
        self.reply(202,{'job_id':key,'state':state,'profile_id':pid})
    def log_message(self,*args):pass


if __name__=='__main__':
    Handler.jobs=Jobs(dispatcher=Dispatcher());ThreadingHTTPServer(('0.0.0.0',int(os.environ.get('PORT','10000'))),Handler).serve_forever()
