# usage: A31_draws.py <draws err> <objects err (tick->ms)> <truth jsonl>
# engine AI-stream (4) draw count at the end of each update vs the game's AI generator count (+0x18)
import json,sys,re
upd=0; n4={}; last=None; at={}
for line in open(sys.argv[1],encoding='utf-8',errors='replace'):
    if line.startswith('DRAWS_UPDATE_DONE'):
        upd=int(line.split()[1]); n4[upd]=last; continue
    if line.startswith('DRAW stream=4 '):
        m=re.match(r'DRAW stream=4 n=(\d+) value=(\d+) at=(\S+)',line); last=int(m.group(1)); at.setdefault(upd+1,[]).append((int(m.group(1)),m.group(3)))
ms={}
for line in open(sys.argv[2],encoding='utf-8',errors='replace'):
    if line.startswith('OBJECT '):
        d=json.loads(line[7:]); ms[d['tick']]=d['ms']
byms={v:k for k,v in ms.items()}
T=[]
for line in open(sys.argv[3],'rb'):
    m=re.search(rb'"ms":(\d+)',line[:30]); t=int(m.group(1))
    a=re.search(rb'"airng":"([0-9A-F]+)"',line[:300]); c=int.from_bytes(bytes.fromhex(a.group(1).decode())[0x18:0x20],'little')
    T.append((t,c))
off=None; pe=pt=None
for t,c in T:
    u=byms.get(t)
    if u is None or n4.get(u) is None: continue
    e=n4[u]
    if off is None: off=c-e
    de=e-pe if pe is not None else 0; dt=c-pt if pt is not None else 0
    flag='' if c-e==off else ' <-- off %d'%(c-e-off)
    if flag or len(sys.argv)>4: print(t,u,'game',c,'eng',e,'d_game',dt,'d_eng',de,flag)
    pe,pt=e,c
print('offset',off)
