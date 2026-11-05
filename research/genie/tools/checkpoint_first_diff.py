# usage: checkpoint_first_diff.py <census stderr with GENIE_PRINT_CHECKPOINTS=1>; first checkpoint where master-sum, live count or id-sum differ
import re,sys
names=['sleep','res','mast','state','held','wp','live','pos','pid','act','ids']
first={}
last={}
for l in open(sys.argv[1]):
    if not l.startswith('CPWORDS'): continue
    m=re.search(r'syncs=(\d+) world_ms=(\d+) player=(\d) rec=\[([^\]]*)\] eng=\[([^\]]*)\]',l)
    s,t,p,r,e=m.groups()
    r=list(map(int,r.split(', '))); e=list(map(int,e.split(', ')))
    last[p]=int(t)
    bad=[names[i] for i in (2,6,10) if r[i]!=e[i]]
    if bad and p not in first: first[p]=(int(t)/1000,bad)
print(sys.argv[1], {p:first.get(p,'none (to %.0fs)'%(last[p]/1000)) for p in sorted(last)})
