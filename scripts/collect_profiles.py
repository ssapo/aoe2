"""Collect default, featured and explicitly requested profiles into separate files."""
import os,subprocess,sys
from collect import ROOT,profile_id
FEATURED=(199325,)

def targets(request=''):
    requested=profile_id(request) if request.strip() else None
    return [(26260702,ROOT/'site/data/report.json',5)]+[(pid,ROOT/f'site/data/profiles/{pid}/report.json',5 if pid==requested else 2) for pid in dict.fromkeys([*FEATURED,*([requested] if requested and requested!=26260702 else [])])]

def main():
    jobs=targets(os.environ.get('REQUESTED_PROFILE_ID',''));failed=[]
    for pid,path,limit in jobs:
        result=subprocess.run([sys.executable,str(ROOT/'scripts/collect.py'),'--profile-id',str(pid),'--output',str(path),'--limit',str(limit)])
        if result.returncode:failed.append(pid)
    if failed:print(f'Collection failed, prior data retained: {failed}');sys.exit(1)

if __name__=='__main__':main()
