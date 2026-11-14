import re,sys
for e in sys.argv[1:]:
    cps={}
    for l in open(e,'rb'):
        if not l.startswith(b'CPWORDS'): continue
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l.decode('latin1'))
        if not m: continue
        t=int(m.group(2))/1000; p=int(m.group(3))
        ok=m.group(4).split(',')[1].strip()==m.group(5).split(',')[1].strip()
        cps.setdefault(t,{})[p]=ok
    last=None
    for t in sorted(cps):
        if all(cps[t].get(p,True) for p in (1,2)): last=t
        else: break
    print(e,'site until %d:%04.1f'%(last//60,last%60) if last else None)
