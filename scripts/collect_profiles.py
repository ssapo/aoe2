"""Collect default, featured and explicitly requested profiles into separate files."""
import json,os,subprocess,sys
from datetime import datetime,timezone
from collect import ROOT,profile_id
DEFAULT_PROFILE=26260702

def featured_profiles(path=None):
    """Shortcut players from config.json: [{"id": server profile id, "name": button label}]."""
    try:rows=json.loads((path or ROOT/'config.json').read_text(encoding='utf-8')).get('featured_profiles',[])
    except (OSError,ValueError):rows=[]
    out={}
    for row in rows if isinstance(rows,list) else []:
        if isinstance(row,int):row={'id':row}
        if not isinstance(row,dict):continue
        try:pid=int(row.get('id'))
        except (TypeError,ValueError):continue
        if pid>0 and pid!=DEFAULT_PROFILE and pid not in out:out[pid]=str(row.get('name') or '').strip()[:24]
    return out

FEATURED=tuple(featured_profiles())

def write_featured(path=None,profiles=None,data_root=None):
    """Public shortcut list for the site; nickname follows the latest collected report."""
    rows=[]
    for pid,label in (featured_profiles() if profiles is None else profiles).items():
        nickname=''
        try:nickname=str(json.loads(((data_root or ROOT/'site/data')/f'profiles/{pid}/report.json').read_text(encoding='utf-8'))['profile'].get('name') or '')
        except (OSError,ValueError,KeyError,AttributeError,TypeError):pass
        rows.append({'id':pid,'name':label or nickname or f'프로필 {pid}','nickname':nickname})
    path=path or ROOT/'site/data/featured.json'
    path.write_text(json.dumps({'schema_version':1,'profiles':rows},ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
    return rows
BENCHMARK_PROFILES=(251265,198035,1224481)  # MbL, DauT, KASVA: verified server profile IDs.

def benchmark_target(now=None):
    # One additional replay per run; each player is revisited about every 90 min.
    now=now or datetime.now(timezone.utc)
    pid=BENCHMARK_PROFILES[int(now.timestamp()//1800)%len(BENCHMARK_PROFILES)]
    return pid,ROOT/f'site/data/profiles/{pid}/report.json',1

def targets(request=''):
    requested=profile_id(request) if request.strip() else None
    return [(DEFAULT_PROFILE,ROOT/'site/data/report.json',5)]+[(pid,ROOT/f'site/data/profiles/{pid}/report.json',5 if pid==requested else 2) for pid in dict.fromkeys([*FEATURED,*([requested] if requested and requested!=DEFAULT_PROFILE else [])])]

def main():
    jobs=targets(os.environ.get('REQUESTED_PROFILE_ID',''));failed=[]
    required={job[0] for job in jobs}
    extra=benchmark_target()
    if extra[0] not in {job[0] for job in jobs}:jobs.append(extra)
    for pid,path,limit in jobs:
        result=subprocess.run([sys.executable,str(ROOT/'scripts/collect.py'),'--profile-id',str(pid),'--output',str(path),'--limit',str(limit)])
        if result.returncode:
            if pid in required:failed.append(pid)
            else:print(f'Optional benchmark collection failed, prior data retained: {pid}')
    write_featured()
    if failed:print(f'Collection failed, prior data retained: {failed}');sys.exit(1)

if __name__=='__main__':main()
