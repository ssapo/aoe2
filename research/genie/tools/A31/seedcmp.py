# usage: seedcmp.py <draws err> <objects err> <truth jsonl>: per update, the second SeedAll seed (s1)
# the engine used (from its last AI draw = setLastRandoms) vs the one the game's AI words show
import sys,json,re,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from rng import *
first={}
for s in range(32768):
    st=seed_all(s,5)[4]; first[raw(st)]=s
upd=0; lastv={}
for line in open(sys.argv[1],encoding='utf-8',errors='replace'):
    if line.startswith('DRAWS_UPDATE_DONE'): upd=int(line.split()[1]); continue
    m=re.match(r'DRAW stream=4 n=(\d+) value=(\d+)',line)
    if m: lastv[upd+1]=int(m.group(2))
eng={u:first.get(v) for u,v in lastv.items()}
ms={}
for line in open(sys.argv[2],encoding='utf-8',errors='replace'):
    if line.startswith('OBJECT '):
        d=json.loads(line[7:]); ms[d['ms']]=d['tick']
for line in open(sys.argv[3],'rb'):
    t=int(re.search(rb'"ms":(\d+)',line[:30]).group(1))
    rb=bytes.fromhex(re.search(rb'"airng":"([0-9A-F]+)"',line[:300]).group(1).decode())
    words=[int.from_bytes(rb[k:k+4],'little') for k in range(0x20,0x60,4)]
    g=[first[w] for w in words if w in first]
    u=ms.get(t)
    e=eng.get(u)
    print(t,u,'game',g,'eng',e,'' if (not g or e in g) else '<-- DIFF')
