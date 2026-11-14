# usage: python3 E13_tr.py <engine .err> <truth.jsonl> <id,id,..> : truth and engine positions side by side per sample
import json,sys,struct
from E6r_tr import rows
ids=[int(x) for x in sys.argv[3].split(',')]
E={}
for l in open(sys.argv[1],errors='replace'):
    if l.startswith('OBJECT'):
        try: r=json.loads(l[7:])
        except Exception: continue
        if r['id'] in ids: E[(r['ms'],r['id'])]=r['position']
ms=[k[0] for k in E]; lo,hi=min(ms),max(ms)
def h(x): return struct.pack('<f',x)
for r in rows(sys.argv[2],lo,hi):
    for p in r['players']:
        for o in p['o']:
            if o[0] in ids:
                e=E.get((r['ms'],o[0]))
                eq='' if e is None else ('==' if h(o[4])==h(e[0]) and h(o[5])==h(e[1]) else '!=')
                print(r['ms'],o[0],'T %.6f %.6f'%(o[4],o[5]),'E' ,None if e is None else '%.6f %.6f'%(e[0],e[1]),eq)
