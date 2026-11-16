# DOC (2026-11-16): one line per run of a prefix (not the pros): first mismatch per player (s, [words]), checkpoints hold, site span (A1_site rule), stops. Run from genie-replays: python3 runs/DOC_tab.py <prefix>
import re,sys,glob,os
pre=sys.argv[1]
def fmt(t): return '%d:%04.1f'%(t//60,t%60)
for f in sorted(glob.glob('runs/%s_*.out'%pre)):
    if f[len('runs/'+pre):].startswith('P'): continue
    tag=f[len('runs/'+pre)+1:-4]
    cps={}; first={1:None,2:None}
    for l in open(f[:-4]+'.err','rb'):
        if not l.startswith(b'CPWORDS'): continue
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l.decode('latin1'))
        if not m: continue
        p=int(m.group(3)); t=int(m.group(2))/1000; r=m.group(4).split(','); e=m.group(5).split(',')
        bad=[i for i in range(len(r)) if r[i].strip()!=e[i].strip()]
        if bad and p in first and first[p] is None: first[p]=(round(t,1),bad)
        cps.setdefault(t,{})[p]=r[1].strip()==e[1].strip()
    last=None
    for t in sorted(cps):
        if all(cps[t].get(p,True) for p in (1,2)): last=t
        else: break
    out=open(f,errors='replace').read()
    hold=re.findall(r'player ([12]): (no stop|stops at update (\d+): ([^;]*)); (\d+) checkpoints hold',out)
    h={p:(n,s) for p,s,u,why,n in hold}
    print(tag,'| first',first[1],'/',first[2],'| hold',h.get('1',('?',))[0],'/',h.get('2',('?',))[0],'| site',fmt(last) if last else None,'| stops',[(p,s[:90]) for p,(n,s) in h.items() if s!='no stop'])
