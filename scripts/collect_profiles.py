"""Collect default, featured and explicitly requested profiles into separate files."""
import os,subprocess,sys
from datetime import datetime,timezone
from collect import ROOT,profile_id
FEATURED=(199325,)
BENCHMARK_PROFILES=(251265,198035,1224481)  # MbL, DauT, KASVA: verified server profile IDs.

def benchmark_target(now=None):
    # One additional replay per run; each player is revisited about every 90 min.
    now=now or datetime.now(timezone.utc)
    pid=BENCHMARK_PROFILES[int(now.timestamp()//1800)%len(BENCHMARK_PROFILES)]
    return pid,ROOT/f'site/data/profiles/{pid}/report.json',1

def targets(request=''):
    requested=profile_id(request) if request.strip() else None
    return [(26260702,ROOT/'site/data/report.json',5)]+[(pid,ROOT/f'site/data/profiles/{pid}/report.json',5 if pid==requested else 2) for pid in dict.fromkeys([*FEATURED,*([requested] if requested and requested!=26260702 else [])])]

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
    if failed:print(f'Collection failed, prior data retained: {failed}');sys.exit(1)

if __name__=='__main__':main()
