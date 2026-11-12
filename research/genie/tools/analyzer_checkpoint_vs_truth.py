import sys,re,bisect,csv,io
sys.path.insert(0,'aoe2-main/scripts')
from collect import decode_replay
from state_curve import read_checkpoints
def chk(rep,run,adir):
    raw=open([f for f in __import__('glob').glob(rep+'/*.aoe2record')][0],'rb').read()
    rows=read_checkpoints(decode_replay(raw))
    cp={}
    for l in open('runs/%s.err'%run,errors='replace'):
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\]',l)
        if m: cp[(int(m.group(2)),int(m.group(3)))]=[int(x) for x in m.group(4).split(',')]
    # mgz vs engine's reading of the recording
    n=bad=0
    for ms,pl in rows:
        for p,(tr,oc) in pl.items():
            w=cp.get((ms-13,p))
            if w is None: continue
            n+=1
            if w[1]!=tr or w[6]!=oc: bad+=1
    print(rep,'mgz checkpoints',len(rows),'matched to engine parse',n,'differ',bad,'last ms',rows[-1][0])
    # truth: cache_res.csv  ms, p1 f,w,s,g?, p2...
    T=[[float(x) for x in r] for r in csv.reader(open(adir+'/cache_res.csv'))]
    ts=[r[0] for r in T]
    n=ex=0; worst=0
    for ms,pl in rows:
        if ms>ts[-1] or ms<ts[0]: continue
        i=bisect.bisect_left(ts,ms-13)
        cands=[T[j] for j in (i-2,i-1,i,i+1) if 0<=j<len(T)]
        for p,(tr,oc) in pl.items():
            if p not in (1,2): continue
            sums=[sum(int(v) for v in c[1+4*(p-1):5+4*(p-1)]) for c in cands]
            n+=1
            d=min(abs(s-tr) for s in sums)
            if d==0: ex+=1
            worst=max(worst,d)
    print('   vs truth resources: compared',n,'exact',ex,'worst diff',worst)
chk('518239882','L_p_239','truth/analysis'); chk('518470161','L_p_161','truth/analysis5'); chk('517426097','L_p_097','truth/analysis6')
