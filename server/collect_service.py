"""Public-data collection service. No GitHub credential or write access required."""
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import gzip, json, os, re, secrets, subprocess, sys, tempfile, threading, time, urllib.request
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from collect import profile_id

class Busy(Exception):pass

class Jobs:
    def __init__(self,runner=None,clock=time.monotonic):
        self.lock=threading.Lock();self.clock=clock;self.rows={};self.starts=deque();self.runner=runner or collect;self.pool=ThreadPoolExecutor(max_workers=1)
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
            with self.lock:self.rows[key].update(state='complete',report=report)
        except Exception:
            with self.lock:self.rows[key].update(state='failed',message='수집을 마치지 못했어요. 기존 기록은 그대로 있어요. 잠시 후 다시 시도해 주세요.')
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
        if self.path=='/health':return self.reply(200,{'status':'ok'})
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
    Handler.jobs=Jobs();ThreadingHTTPServer(('0.0.0.0',int(os.environ.get('PORT','10000'))),Handler).serve_forever()
