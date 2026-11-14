import re,sys
def first(err):
    w={1:None,2:None}; site=None; last_ok=None; done=False
    for l in open(err,'rb'):
        if not l.startswith(b'CPWORDS'): continue
        m=re.match(r'CPWORDS syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[(.*?)\] eng=\[(.*?)\]',l.decode('latin1'))
        if not m: continue
        p=int(m.group(3)); t=int(m.group(2))/1000; rec=m.group(4).split(','); eng=m.group(5).split(',')
        bad=[i for i,(a,b) in enumerate(zip(rec,eng)) if a.strip()!=b.strip()]
        if bad and p in w and w[p] is None: w[p]=(t,bad)
    return w
for e in sys.argv[1:]:
    print(e, first(e))
